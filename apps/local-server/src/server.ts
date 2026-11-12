import { createServer, type IncomingMessage } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { ROOM_CODE_PATTERN, type LobbyEntry } from '../../../packages/contracts/src/index.ts';
import { handleApi, type Backend } from '../../../packages/server/src/api.ts';
import { LobbyRegistry } from '../../../packages/server/src/lobby.ts';
import type { RoomState } from '../../../packages/server/src/room.ts';
import { RoomRuntime, type RoomInit, type Socket } from '../../../packages/server/src/runtime.ts';

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
};

/**
 * Mesmo runtime do Worker, em um processo Node: usado em `pnpm dev`, nos testes e
 * para quem quiser hospedar em uma máquina própria. O estado fica na memória.
 */
export function createLocalServer(options: { staticDir?: string } = {}) {
  const lobby = new LobbyRegistry();
  type Entry = {
    runtime: RoomRuntime;
    sockets: Map<WebSocket, string | undefined>;
    timer?: NodeJS.Timeout;
  };
  const rooms = new Map<string, Entry>();

  function room(id: string) {
    let entry = rooms.get(id);
    if (entry) return entry;
    let state: RoomState | null = null;
    const sockets = new Map<WebSocket, string | undefined>();
    const created: Entry = {
      sockets,
      runtime: new RoomRuntime({
        storage: {
          load: async () => state,
          save: async (next) => {
            state = structuredClone(next);
          },
          remove: async () => {
            state = null;
            const current = rooms.get(id);
            if (current?.timer) clearTimeout(current.timer);
            rooms.delete(id);
          },
        },
        hub: {
          sockets: () =>
            [...sockets].map(([socket, playerId]) => ({ socket: socket as Socket, id: playerId })),
          bind: (socket, playerId) => sockets.set(socket as WebSocket, playerId),
        },
        scheduler: {
          set: (at) => {
            if (created.timer) clearTimeout(created.timer);
            created.timer =
              at === null
                ? undefined
                : setTimeout(() => void created.runtime.alarm(), Math.max(0, at - Date.now()));
          },
        },
        lobby: { put: (e) => lobby.put(e), remove: (roomId) => lobby.remove(roomId) },
      }),
    };
    rooms.set(id, created);
    entry = created;
    return created;
  }

  const backend: Backend = {
    async createRoom(id: string, init: RoomInit) {
      const created = await room(id).runtime.create(id, init);
      if (!created) return false;
      return true;
    },
    async roomInfo(id: string) {
      return rooms.get(id)?.runtime.info() ?? null;
    },
    async lobby(): Promise<LobbyEntry[]> {
      return lobby.list();
    },
  };

  const root = resolve(options.staticDir ?? 'apps/web/dist');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      const response = await handleApi(request, backend, req.socket.remoteAddress ?? 'local');
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    let path: string;
    try {
      path = resolve(root, '.' + decodeURIComponent(url.pathname));
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!path.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(path) || !statSync(path).isFile()) path = resolve(root, 'index.html');
    if (!existsSync(path)) {
      res.writeHead(404).end('Rode pnpm build para gerar o site.');
      return;
    }
    res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const match = (req.url ?? '').match(/^\/api\/rooms\/([A-Za-z0-9]+)\/ws/);
    const id = match?.[1].toUpperCase();
    const entry = id && ROOM_CODE_PATTERN.test(id) ? rooms.get(id) : undefined;
    if (!entry?.runtime.engine) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      entry.sockets.set(ws, undefined);
      ws.on(
        'message',
        (data, isBinary) =>
          void entry.runtime.message(ws as Socket, isBinary ? new ArrayBuffer(0) : data.toString()),
      );
      ws.on('close', () => {
        void entry.runtime.close(ws as Socket).finally(() => entry.sockets.delete(ws));
      });
    });
  });

  return {
    server,
    rooms,
    listen: (port: number) =>
      new Promise<number>((done) =>
        server.listen(port, '0.0.0.0', () => done((server.address() as { port: number }).port)),
      ),
    close: () =>
      new Promise<void>((done) => {
        for (const entry of rooms.values()) if (entry.timer) clearTimeout(entry.timer);
        for (const client of wss.clients) client.terminate();
        server.close(() => done());
      }),
  };
}
