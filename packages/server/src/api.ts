import { z } from 'zod';
import {
  ConfigSchema,
  ProfileSchema,
  ROOM_CODE_PATTERN,
  newRoomCode,
  type LobbyEntry,
} from '../../contracts/src/index.ts';
import type { RoomInit } from './runtime.ts';
import { newSalt } from './security.ts';

/** O que a plataforma (Cloudflare ou Node) precisa oferecer à API HTTP. */
export interface Backend {
  createRoom(id: string, init: RoomInit): Promise<boolean>;
  roomInfo(id: string): Promise<LobbyEntry | null>;
  lobby(): Promise<LobbyEntry[]>;
}

const CreateSchema = z.object({
  key: z.string().min(32).max(128),
  profile: ProfileSchema,
  config: ConfigSchema,
});

export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

/** Limitador simples por IP, em memória do isolate. */
export class RateLimiter {
  private buckets = new Map<string, { at: number; n: number }>();
  take(key: string, limit: number, windowMs = 60_000) {
    const now = Date.now();
    if (this.buckets.size > 2000)
      for (const [k, v] of this.buckets) if (now - v.at > windowMs) this.buckets.delete(k);
    let b = this.buckets.get(key);
    if (!b || now - b.at > windowMs) {
      b = { at: now, n: 0 };
      this.buckets.set(key, b);
    }
    return ++b.n <= limit;
  }
}
const limiter = new RateLimiter();
// Salas novas por minuto e por IP. Os testes de ponta a ponta (Node) elevam o limite pelo ambiente;
// no Worker não existe `process`, então vale o padrão.
const CREATE_LIMIT =
  Number(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.ROOM_CREATE_LIMIT,
  ) || 8;

/** Rotas JSON. WebSocket é tratado por cada plataforma. */
export async function handleApi(req: Request, backend: Backend, ip: string) {
  const url = new URL(req.url);
  const path = url.pathname;
  try {
    if (path === '/api/health') return json({ ok: true });
    if (path === '/api/lobby' && req.method === 'GET') {
      if (!limiter.take('lobby:' + ip, 120)) return json({ error: 'RATE_LIMIT' }, 429);
      return json({ rooms: await backend.lobby() });
    }
    if (path === '/api/rooms' && req.method === 'POST') {
      if (!limiter.take('create:' + ip, CREATE_LIMIT)) return json({ error: 'RATE_LIMIT' }, 429);
      const raw = await req.text();
      if (raw.length > 12_000) return json({ error: 'VALIDATION' }, 413);
      const parsed = CreateSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return json({ error: 'VALIDATION' }, 400);
      const { password, ...config } = parsed.data.config;
      for (let attempt = 0; attempt < 6; attempt++) {
        const id = newRoomCode();
        const created = await backend.createRoom(id, {
          config,
          password: password || undefined,
          salt: newSalt(),
          hostKey: parsed.data.key,
          profile: parsed.data.profile,
        });
        if (created) return json({ id });
      }
      return json({ error: 'CAPACITY' }, 503);
    }
    const match = path.match(/^\/api\/rooms\/([A-Za-z0-9]+)$/);
    if (match && req.method === 'GET') {
      const id = match[1].toUpperCase();
      if (!ROOM_CODE_PATTERN.test(id)) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      const info = await backend.roomInfo(id);
      return info ? json(info) : json({ error: 'ROOM_NOT_FOUND' }, 404);
    }
    return json({ error: 'NOT_FOUND' }, 404);
  } catch (e) {
    if (e instanceof SyntaxError) return json({ error: 'VALIDATION' }, 400);
    console.error('api error', e);
    return json({ error: 'INTERNAL' }, 503);
  }
}
