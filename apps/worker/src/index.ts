/// <reference types="@cloudflare/workers-types" />
import { PokerService, type State } from '../../../packages/server/src/service.ts';
import { handleApi } from '../../../packages/server/src/http.ts';
interface Env {
  POKER: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  MAX_ROOMS: string;
  MAINTENANCE: string;
}
export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get('origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',');
    if (origin && !allowed.includes(origin)) return new Response('Forbidden', { status: 403 });
    const headers = {
      'Access-Control-Allow-Origin': origin ?? allowed[0] ?? '',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const response = await env.POKER.get(env.POKER.idFromName('highlords-v1')).fetch(request);
    if (response.status === 101) return response;
    const copy = new Response(response.body, response);
    for (const [k, v] of Object.entries(headers)) copy.headers.set(k, v);
    return copy;
  },
};
/** One bounded coordinator provides atomic multi-table transfers and durable sessions. */
export class PokerCoordinator {
  private service: PokerService;
  private ready: Promise<void>;
  constructor(
    private ctx: DurableObjectState,
    env: Env,
  ) {
    this.service = new PokerService(
      {
        load: async () => (await ctx.storage.get<State>('state')) ?? null,
        save: async (s) => {
          await ctx.storage.put('state', s);
        },
      },
      { maxRooms: Number(env.MAX_ROOMS ?? 30), maintenance: env.MAINTENANCE === 'true' },
    );
    this.ready = ctx.blockConcurrencyWhile(async () => {
      await this.service.init();
      await ctx.storage.setAlarm(Date.now() + 5000);
    });
  }
  async fetch(req: Request) {
    await this.ready;
    const url = new URL(req.url);
    if (url.pathname === '/api/ws') {
      if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return new Response(null, { status: 426 });
      if (this.ctx.getWebSockets().length >= 300) return new Response(null, { status: 503 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ opened: Date.now() });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const response = await handleApi(
      this.service,
      req,
      req.headers.get('CF-Connecting-IP') ?? 'unknown',
    );
    if (req.method === 'POST' && response.ok) await this.ctx.storage.setAlarm(Date.now() + 5000);
    return response;
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      if (typeof message !== 'string' || message.length > 16384) {
        ws.close(1009);
        return;
      }
      const m = JSON.parse(message);
      if (m.type === 'AUTH') {
        await this.service.heartbeat(m.token, typeof m.roomId === 'string' ? m.roomId : undefined);
        ws.serializeAttachment({ token: m.token, roomId: m.roomId, opened: Date.now() });
        await this.send(ws);
      } else if (m.type === 'PING') {
        const a = ws.deserializeAttachment();
        if (a?.token) await this.service.heartbeat(a.token, a.roomId);
      }
    } catch {
      ws.close(1008);
    }
  }
  async send(ws: WebSocket) {
    const a = ws.deserializeAttachment();
    if (!a?.token) {
      if (Date.now() - a.opened > 5000) ws.close(1008);
      return;
    }
    try {
      const data = a.roomId
        ? await this.service.snapshot(a.roomId, a.token)
        : { rooms: this.service.lobby() };
      ws.send(JSON.stringify({ type: 'SNAPSHOT', data }));
    } catch {
      ws.send(JSON.stringify({ type: 'REFRESH' }));
    }
  }
  async alarm() {
    await this.ready;
    try {
      await this.service.tick();
      await Promise.all(this.ctx.getWebSockets().map((ws) => this.send(ws)));
    } finally {
      const active =
        this.ctx.getWebSockets().length > 0 ||
        this.service.state.rooms.some((r) => r.status === 'RUNNING');
      await this.ctx.storage.setAlarm(Date.now() + (active ? 5000 : 60000));
    }
  }
}
