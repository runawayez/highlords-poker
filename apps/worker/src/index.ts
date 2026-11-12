/// <reference types="@cloudflare/workers-types" />
import { ROOM_CODE_PATTERN, type LobbyEntry } from '../../../packages/contracts/src/index.ts';
import { handleApi, json, type Backend } from '../../../packages/server/src/api.ts';
import { LobbyRegistry } from '../../../packages/server/src/lobby.ts';
import { RoomRuntime, type RoomInit, type Socket } from '../../../packages/server/src/runtime.ts';
import type { RoomState } from '../../../packages/server/src/room.ts';

interface Env {
  ROOMS: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  ASSETS: Fetcher;
}

const lobbyStub = (env: Env) => env.LOBBY.get(env.LOBBY.idFromName('main'));
const roomStub = (env: Env, id: string) => env.ROOMS.get(env.ROOMS.idFromName(id));

/** Um Worker serve o site e a API: mesmo domínio, sem CORS. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const ws = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)\/ws$/);
    if (ws) {
      const id = ws[1].toUpperCase();
      if (!ROOM_CODE_PATTERN.test(id)) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
        return new Response(null, { status: 426 });
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return new Response(null, { status: 403 });
      return roomStub(env, id).fetch(new Request('https://room/ws', request));
    }

    const backend: Backend = {
      async createRoom(id: string, init: RoomInit) {
        const res = await roomStub(env, id).fetch('https://room/init', {
          method: 'POST',
          body: JSON.stringify({ id, init }),
        });
        return res.status === 201;
      },
      async roomInfo(id: string) {
        const res = await roomStub(env, id).fetch('https://room/info');
        return res.ok ? ((await res.json()) as LobbyEntry) : null;
      },
      async lobby() {
        const res = await lobbyStub(env).fetch('https://lobby/list');
        return (await res.json()) as LobbyEntry[];
      },
    };
    return handleApi(request, backend, request.headers.get('CF-Connecting-IP') ?? 'unknown');
  },
};

/** Uma mesa por Durable Object: isolamento total entre salas. */
export class PokerRoom {
  private runtime: RoomRuntime;
  private ready: Promise<void>;
  constructor(
    private ctx: DurableObjectState,
    env: Env,
  ) {
    this.runtime = new RoomRuntime({
      storage: {
        load: async () => (await ctx.storage.get<RoomState>('state')) ?? null,
        save: async (state) => {
          await ctx.storage.put('state', state);
        },
        remove: async () => {
          await ctx.storage.deleteAll();
        },
      },
      hub: {
        sockets: () =>
          ctx.getWebSockets().map((socket) => ({
            socket: socket as unknown as Socket,
            id: (socket.deserializeAttachment() as { id?: string } | null)?.id,
          })),
        bind: (socket, id) => (socket as unknown as WebSocket).serializeAttachment({ id }),
      },
      scheduler: {
        set: async (at) => {
          if (at === null) await ctx.storage.deleteAlarm();
          else await ctx.storage.setAlarm(at);
        },
      },
      lobby: {
        put: (entry) => {
          ctx.waitUntil(
            lobbyStub(env).fetch('https://lobby/put', {
              method: 'POST',
              body: JSON.stringify(entry),
            }),
          );
        },
        remove: (id) => {
          ctx.waitUntil(
            lobbyStub(env).fetch('https://lobby/remove', {
              method: 'POST',
              body: JSON.stringify({ id }),
            }),
          );
        },
      },
    });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', '{"type":"PONG"}'));
    this.ready = ctx.blockConcurrencyWhile(() => this.runtime.load());
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      const { id, init } = (await request.json()) as { id: string; init: RoomInit };
      return new Response(null, { status: (await this.runtime.create(id, init)) ? 201 : 409 });
    }
    if (url.pathname === '/info') {
      const info = this.runtime.info();
      return info ? json(info) : json({ error: 'ROOM_NOT_FOUND' }, 404);
    }
    if (url.pathname === '/ws') {
      if (!this.runtime.engine) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      if (this.ctx.getWebSockets().length >= 60) return json({ error: 'CAPACITY' }, 503);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response(null, { status: 404 });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    await this.ready;
    await this.runtime.message(ws as unknown as Socket, message);
  }
  async webSocketClose(ws: WebSocket) {
    await this.ready;
    await this.runtime.close(ws as unknown as Socket);
  }
  async webSocketError(ws: WebSocket) {
    await this.ready;
    await this.runtime.close(ws as unknown as Socket);
  }
  async alarm() {
    await this.ready;
    await this.runtime.alarm();
  }
}

/** Lista as salas públicas. Salas renovam a entrada a cada minuto enquanto têm gente. */
export class Lobby {
  private registry = new LobbyRegistry();
  private ready: Promise<void>;
  constructor(private ctx: DurableObjectState) {
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.registry = new LobbyRegistry((await ctx.storage.get<LobbyEntry[]>('entries')) ?? []);
    });
  }
  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const path = new URL(request.url).pathname;
    if (path === '/list') return json(this.registry.list());
    if (request.method === 'POST' && path === '/put') {
      this.registry.put((await request.json()) as LobbyEntry);
      await this.ctx.storage.put('entries', this.registry.snapshot());
      return json({ ok: true });
    }
    if (request.method === 'POST' && path === '/remove') {
      this.registry.remove(((await request.json()) as { id: string }).id);
      await this.ctx.storage.put('entries', this.registry.snapshot());
      return json({ ok: true });
    }
    return new Response(null, { status: 404 });
  }
}
