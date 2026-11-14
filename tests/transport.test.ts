import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createLocalServer } from '../apps/local-server/src/server.ts';

const app = createLocalServer({ staticDir: 'apps/web/dist' });
let base = '';
beforeAll(async () => {
  base = `127.0.0.1:${await app.listen(0)}`;
});
afterAll(() => app.close());

const key = (n: string) => n.repeat(40).slice(0, 40);
const profile = (nickname: string) => ({ nickname, avatar: 'a1' });

async function createRoom(hostKey: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`http://${base}/api/rooms`, {
    method: 'POST',
    body: JSON.stringify({
      key: hostKey,
      profile: profile('Host'),
      config: { title: 'Mesa de teste', ...extra },
    }),
  });
  return { status: res.status, body: (await res.json()) as { id: string; error?: string } };
}

type Client = {
  ws: WebSocket;
  states: any[];
  errors: string[];
  send: (m: object) => void;
  until: (predicate: (state: any) => boolean, ms?: number) => Promise<any>;
};
async function connect(id: string): Promise<Client> {
  const ws = new WebSocket(`ws://${base}/api/rooms/${id}/ws`);
  const client: Client = {
    ws,
    states: [],
    errors: [],
    send: (m) => ws.send(JSON.stringify(m)),
    until: (predicate, ms = 4000) =>
      new Promise((resolve, reject) => {
        const found = [...client.states].reverse().find(predicate);
        if (found) return resolve(found);
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        ws.on('message', function check() {
          const hit = [...client.states].reverse().find(predicate);
          if (hit) {
            clearTimeout(timer);
            ws.off('message', check);
            resolve(hit);
          }
        });
      }),
  };
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === 'STATE') client.states.push(m.data);
    if (m.type === 'ERROR') client.errors.push(m.code);
  });
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  return client;
}
const hello = (c: Client, k: string, name: string, password?: string) =>
  c.send({ type: 'HELLO', key: k, profile: profile(name), password });

describe('transporte WebSocket', () => {
  it('cria sala, lista no lobby e joga uma mão entre dois navegadores', async () => {
    const created = await createRoom(key('a'));
    expect(created.status).toBe(200);
    expect(created.body.id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const id = created.body.id;

    // Sala sem ninguém online não aparece no lobby.
    const empty = (await (await fetch(`http://${base}/api/lobby`)).json()) as { rooms: any[] };
    expect(empty.rooms.map((r) => r.id)).not.toContain(id);

    const a = await connect(id);
    const b = await connect(id);
    hello(a, key('a'), 'Host');
    hello(b, key('b'), 'Ana');
    await a.until((s) => s.me);
    await expect
      .poll(async () => {
        const list = (await (await fetch(`http://${base}/api/lobby`)).json()) as { rooms: any[] };
        return list.rooms.map((r) => r.id);
      })
      .toContain(id);
    a.send({ type: 'SIT' });
    b.send({ type: 'SIT' });
    const state = await a.until((s) => s.hand && s.hand.actor);
    expect(state.players).toHaveLength(2);
    const mine = state.players.find((p: any) => p.id === state.me);
    const theirs = state.players.find((p: any) => p.id !== state.me);
    expect(mine.cards).toHaveLength(2);
    expect(theirs.cards).toHaveLength(0);
    expect(JSON.stringify(state)).not.toContain('"deck"');

    const actor = state.hand.actor === state.me ? a : b;
    actor.send({ type: 'ACT', action: 'FOLD' });
    const finished = await a.until((s) => s.hand?.done);
    expect(finished.history.length).toBeGreaterThanOrEqual(1);
    a.ws.close();
    b.ws.close();
  });

  it('sala online recusa bots: eles só existem na mesa local do navegador', async () => {
    const { body } = await createRoom(key('f'));
    const host = await connect(body.id);
    hello(host, key('f'), 'Host');
    await host.until((s) => s.me);
    host.send({ type: 'SIT' });
    host.send({ type: 'ADD_BOT', difficulty: 'MEDIUM' });
    await new Promise((r) => setTimeout(r, 200));
    expect(host.errors).toContain('FORBIDDEN');
    const state = await host.until((s) => s.players.length > 0);
    expect(state.players.filter((p: any) => p.bot)).toHaveLength(0);
    host.ws.close();
  });

  it('exige senha e aceita a senha correta', async () => {
    const { body } = await createRoom(key('c'), { password: 'segredo' });
    const intruder = await connect(body.id);
    hello(intruder, key('d'), 'Intruso');
    hello(intruder, key('d'), 'Intruso', 'errada');
    await new Promise((r) => setTimeout(r, 200));
    expect(intruder.errors).toEqual(['WRONG_PASSWORD', 'WRONG_PASSWORD']);
    hello(intruder, key('d'), 'Intruso', 'segredo');
    const state = await intruder.until((s) => s.me);
    expect(state.locked).toBe(true);
    intruder.ws.close();
  });

  it('rejeita mensagens sem HELLO, inválidas e salas inexistentes', async () => {
    const { body } = await createRoom(key('e'));
    const c = await connect(body.id);
    c.send({ type: 'SIT' });
    c.send({ type: 'ACT', action: 'EXPLODE' });
    await new Promise((r) => setTimeout(r, 200));
    expect(c.errors).toEqual(['FORBIDDEN', 'VALIDATION']);
    c.ws.close();
    expect((await fetch(`http://${base}/api/rooms/ZZZZZZ`)).status).toBe(404);
    expect((await createRoom('curta')).status).toBe(400);
  });

  it('o anfitrião fecha a sala e ela some do lobby', async () => {
    const { body } = await createRoom(key('f'));
    const host = await connect(body.id);
    hello(host, key('f'), 'Host');
    await host.until((s) => s.me);
    const closed = new Promise<void>((resolve) => host.ws.on('close', () => resolve()));
    host.send({ type: 'CLOSE' });
    await closed;
    const lobby = (await (await fetch(`http://${base}/api/lobby`)).json()) as { rooms: any[] };
    expect(lobby.rooms.map((r) => r.id)).not.toContain(body.id);
  });
});
