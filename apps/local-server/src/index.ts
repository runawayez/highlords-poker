import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { PokerService, type State } from '../../../packages/server/src/service.ts';
import { handleApi, limiter } from '../../../packages/server/src/http.ts';
// The single-IP Playwright harness runs many independent clients in one minute.
// Do not disable rate limiting outside an explicitly enabled local test server.
if (process.env.HIGHLORDS_E2E === '1') limiter.take = () => true;
const dbPath = process.env.DATA_PATH ?? '.data/poker.sqlite';
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)',
);
const service = new PokerService(
  {
    async load() {
      const row = db.prepare('SELECT value FROM state WHERE id=1').get() as
        { value: string } | undefined;
      return row ? (JSON.parse(row.value) as State) : null;
    },
    async save(state) {
      db.prepare(
        'INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
      ).run(JSON.stringify(state));
    },
  },
  {
    maxRooms: Number(process.env.MAX_ROOMS ?? 30),
    maintenance: process.env.MAINTENANCE === 'true',
  },
);
await service.init();
const port = Number(process.env.PORT ?? 3001);
const origins = (
  process.env.ALLOWED_ORIGINS ??
  `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://terminal.local:4173,http://localhost:${port}`
).split(',');
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const security = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy':
      "default-src 'self'; connect-src 'self' ws: wss: https:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'",
  };
  if (origin && !origins.includes(origin)) {
    res.writeHead(403, security);
    res.end();
    return;
  }
  const cors = origin
    ? {
        'access-control-allow-origin': origin,
        vary: 'Origin',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      }
    : {};
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...security, ...cors });
    res.end();
    return;
  }
  if (!req.url?.startsWith('/api/')) {
    const root = resolve('apps/web/dist');
    let decoded: string;
    try {
      decoded = decodeURIComponent((req.url ?? '/').split('?')[0]);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let path = resolve(root, '.' + decoded);
    if (!path.startsWith(root + '/') && path !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(path) || !statSync(path).isFile()) path = resolve(root, 'index.html');
    if (!existsSync(path)) {
      res.writeHead(404);
      res.end('Build the frontend with pnpm build');
      return;
    }
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    res.writeHead(200, {
      ...security,
      'content-type': mime[extname(path)] ?? 'application/octet-stream',
    });
    res.end(readFileSync(path));
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const result = await handleApi(service, request, req.socket.remoteAddress ?? 'local');
    res.writeHead(result.status, { ...security, ...Object.fromEntries(result.headers), ...cors });
    res.end(await result.text());
  } catch {
    res.writeHead(503);
    res.end('{"error":"INTERNAL"}');
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
const sockets = new Map<WebSocket, { token: string; roomId?: string }>();
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  if (
    req.url !== '/api/ws' ||
    !origin ||
    !origins.includes(origin) ||
    !limiter.take('ws:' + req.socket.remoteAddress, 30) ||
    wss.clients.size >= 300
  ) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  const timeout = setTimeout(() => {
    if (!sockets.has(ws)) ws.close(1008);
  }, 5000);
  ws.on('message', async (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'AUTH') {
        await service.heartbeat(m.token, typeof m.roomId === 'string' ? m.roomId : undefined);
        sockets.set(ws, {
          token: m.token,
          roomId: typeof m.roomId === 'string' ? m.roomId : undefined,
        });
        await send(ws);
      } else if (m.type === 'PING') {
        const auth = sockets.get(ws);
        if (auth) await service.heartbeat(auth.token, auth.roomId);
      }
    } catch {
      ws.send(JSON.stringify({ error: 'SESSION_EXPIRED' }));
      ws.close(1008);
    }
  });
  ws.on('close', () => {
    clearTimeout(timeout);
    sockets.delete(ws);
  });
});
async function send(ws: WebSocket) {
  const a = sockets.get(ws);
  if (!a || ws.readyState !== 1) return;
  try {
    const data = a.roomId ? await service.snapshot(a.roomId, a.token) : { rooms: service.lobby() };
    if (ws.bufferedAmount > 100000) {
      ws.close(1013);
      return;
    }
    ws.send(JSON.stringify({ type: 'SNAPSHOT', data }));
  } catch {
    ws.send(JSON.stringify({ type: 'REFRESH' }));
  }
}
let ticking = false;
const timer = setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await service.tick();
    await Promise.all([...sockets.keys()].map(send));
  } catch {
    /* Fail closed: uncommitted state is never published. */
  } finally {
    ticking = false;
  }
}, 2000);
server.listen(port, '0.0.0.0', () => console.log(`Highlords Poker http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer);
    for (const ws of wss.clients) ws.close(1001);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
