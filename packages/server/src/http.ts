import { PokerService, errorCode } from './service.ts';
export class RateLimiter {
  private buckets = new Map<string, { at: number; n: number }>();
  take(key: string, limit = 120) {
    const now = Date.now();
    if (this.buckets.size > 5000)
      for (const [k, v] of this.buckets) if (now - v.at > 60000) this.buckets.delete(k);
    let b = this.buckets.get(key);
    if (!b || now - b.at > 60000) {
      b = { at: now, n: 0 };
      this.buckets.set(key, b);
    }
    return ++b.n <= limit;
  }
}
export const limiter = new RateLimiter();
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
export async function handleApi(service: PokerService, req: Request, ip: string) {
  const url = new URL(req.url);
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  try {
    if (!limiter.take(ip)) return json({ error: 'RATE_LIMIT' }, 429);
    if (url.pathname === '/api/health') return json({ ok: true, policy: 'highlords-nlhe-v1' });
    if (url.pathname === '/api/lobby' && req.method === 'GET')
      return json({ rooms: service.lobby() });
    if (url.pathname.startsWith('/api/rooms/') && req.method === 'GET') {
      await service.heartbeat(token);
      return json(await service.snapshot(url.pathname.split('/')[3], token));
    }
    if (req.method === 'POST') {
      const raw = await req.text();
      if (raw.length > 16384) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: 'VALIDATION' }, 400);
      }
      if (!body || typeof body !== 'object') return json({ error: 'VALIDATION' }, 400);
      if (url.pathname === '/api/session') {
        if (!limiter.take('session:' + ip, 20)) return json({ error: 'RATE_LIMIT' }, 429);
        return json(
          await service.openSession((body as { profile?: unknown }).profile, token || undefined),
        );
      }
      if (url.pathname === '/api/command') {
        if (
          (body as { type?: string }).type === 'JOIN' ||
          (body as { type?: string }).type === 'SPECTATE'
        )
          if (!limiter.take('join:' + ip, 12)) return json({ error: 'RATE_LIMIT' }, 429);
        return json(await service.command(token, body));
      }
    }
    return json({ error: 'NOT_FOUND' }, 404);
  } catch (e) {
    const code = errorCode(e);
    return json(
      { error: code },
      code === 'INTERNAL' ? 503 : code === 'SESSION_EXPIRED' ? 401 : 400,
    );
  }
}
