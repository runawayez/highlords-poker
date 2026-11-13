import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../packages/contracts/src/index.ts';
import { RoomEngine } from '../packages/server/src/room.ts';

const T0 = 1_700_000_000_000;
function makeRoom(overrides: Record<string, unknown> = {}) {
  const { password, ...config } = ConfigSchema.parse({ title: 'Mesa teste', ...overrides });
  void password;
  const room = RoomEngine.create({ id: 'ABC234', config, salt: 's', hostId: 'host' }, T0);
  room.admit('host', { nickname: 'Anfitriao', avatar: 'g1' }, T0);
  return room;
}
const join = (room: RoomEngine, id: string, name: string, now = T0) =>
  room.admit(id, { nickname: name, avatar: 'g2' }, now);

describe('sala (cash game)', () => {
  it('começa sozinha quando o segundo jogador senta e distribui a mão', () => {
    const room = makeRoom();
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    expect(room.state.status).toBe('WAITING');
    room.command('p2', { type: 'SIT', seat: 3 }, T0);
    expect(room.state.status).toBe('RUNNING');
    const online = new Set(['host', 'p2']);
    room.tick(T0 + 2000, online);
    expect(room.state.hand).toBeTruthy();
    expect(room.state.handNo).toBe(1);
  });

  it('cada jogador vê só as próprias cartas e nunca o baralho', () => {
    const room = makeRoom();
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    const online = new Set(['host', 'p2']);
    room.tick(T0 + 2000, online);
    const a = room.view('host', T0 + 2000, online);
    const b = room.view('p2', T0 + 2000, online);
    expect(a.players.find((p) => p.id === 'host')!.cards).toHaveLength(2);
    expect(a.players.find((p) => p.id === 'p2')!.cards).toHaveLength(0);
    expect(b.players.find((p) => p.id === 'p2')!.cards).toHaveLength(2);
    expect(JSON.stringify(a)).not.toContain('deck');
  });

  it('só quem tem a vez pode agir e fold encerra a mão heads-up', () => {
    const room = makeRoom();
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    const online = new Set(['host', 'p2']);
    room.tick(T0 + 2000, online);
    const actor = room.state.hand!.actor!;
    const other = actor === 'host' ? 'p2' : 'host';
    expect(() => room.command(other, { type: 'ACT', action: 'FOLD' }, T0 + 2100)).toThrow();
    room.command(actor, { type: 'ACT', action: 'FOLD' }, T0 + 2100);
    expect(room.state.hand!.done).toBe(true);
    expect(room.state.history).toHaveLength(1);
    const total = room.state.players.reduce((sum, p) => sum + p.stack, 0);
    expect(total).toBe(4000);
  });

  it('timeout faz check/fold e dois seguidos colocam o jogador em sit-out', () => {
    const room = makeRoom({ turnSeconds: 10 });
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    const online = new Set(['host', 'p2']);
    let now = T0 + 2000;
    room.tick(now, online);
    // Ninguém joga: o relógio resolve mão após mão.
    for (let i = 0; i < 6; i++) {
      now += 11_000;
      room.tick(now, online);
      now += 8000;
      room.tick(now, online);
    }
    expect(room.state.players.some((p) => p.sitOut)).toBe(true);
  });

  it('pausa por ausência, retoma quando alguém volta e expira depois de 30 minutos', () => {
    const room = makeRoom();
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    room.tick(T0 + 2000, new Set(['host', 'p2']));
    room.tick(T0 + 70_000, new Set());
    expect(room.state.status).toBe('PAUSED');
    room.tick(T0 + 80_000, new Set(['host']));
    expect(room.state.status).toBe('RUNNING');
    expect(room.isExpired(T0 + 80_000 + 6 * 60_000, new Set())).toBe(true);
    expect(room.isExpired(T0 + 80_000 + 3 * 60_000, new Set())).toBe(false);
  });

  it('bots completam mãos sozinhos e o anfitrião controla bots e kick', () => {
    const room = makeRoom();
    room.command('host', { type: 'SIT' }, T0);
    room.command('host', { type: 'ADD_BOT', difficulty: 'MEDIUM' }, T0);
    room.command('host', { type: 'ADD_BOT', difficulty: 'EASY' }, T0);
    expect(room.state.players.filter((p) => p.bot)).toHaveLength(2);
    join(room, 'p2', 'Ana');
    expect(() => room.command('p2', { type: 'ADD_BOT', difficulty: 'EASY' }, T0)).toThrow();
    expect(() => room.command('p2', { type: 'KICK', id: 'host' }, T0)).toThrow();
    const online = new Set(['host']);
    let now = T0 + 2000;
    room.tick(now, online);
    const start = room.state.handNo;
    // O humano dá fold sempre que for a vez; os bots tocam o resto.
    for (let i = 0; i < 400 && room.state.handNo < start + 3; i++) {
      now += 1000;
      const h = room.state.hand;
      if (h && !h.done && h.actor === 'host')
        room.command('host', { type: 'ACT', action: 'FOLD' }, now);
      room.tick(now, online);
    }
    expect(room.state.handNo).toBeGreaterThanOrEqual(start + 3);
    // Fichas na mesa (pote em andamento) também contam; bots podem ter recomprado.
    const live = room.state.hand && !room.state.hand.done ? room.state.hand.players : [];
    const chips =
      room.state.players.reduce((sum, p) => sum + p.stack, 0) +
      live.reduce((sum, p) => sum + p.total, 0);
    expect(chips % 2000).toBe(0);
    expect(chips).toBeGreaterThanOrEqual(6000);
    room.command('host', { type: 'KICK', id: 'p2' }, now);
    expect(room.isBanned('p2')).toBe(true);
    expect(() => join(room, 'p2', 'Ana', now)).toThrow();
  });

  it('rebuy só entre mãos e só abaixo do stack inicial', () => {
    const room = makeRoom({ stack: 1000, small: 10, big: 20 });
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    expect(() => room.command('host', { type: 'REBUY' }, T0)).toThrow();
    room.tick(T0 + 2000, new Set(['host', 'p2']));
    room.state.players[0].stack = 5;
    room.state.hand = undefined;
    room.command('host', { type: 'REBUY' }, T0 + 3000);
    expect(room.state.players[0].stack).toBe(1000);
  });
});

describe('sala (Sit & Go)', () => {
  it('só começa com o anfitrião e termina com pódio quando sobra um jogador', () => {
    const room = makeRoom({ mode: 'SIT_AND_GO', seats: 3, stack: 100, small: 10, big: 20 });
    join(room, 'p2', 'Ana');
    join(room, 'p3', 'Beto');
    for (const id of ['host', 'p2', 'p3']) room.command(id, { type: 'SIT' }, T0);
    // Mesa cheia: começa sozinha.
    expect(room.state.status).toBe('RUNNING');
    const online = new Set(['host', 'p2', 'p3']);
    let now = T0 + 2000;
    room.tick(now, online);
    for (let i = 0; i < 2000 && room.state.status === 'RUNNING'; i++) {
      now += 500;
      const h = room.state.hand;
      if (h && !h.done && h.actor) room.command(h.actor, { type: 'ACT', action: 'ALL_IN' }, now);
      room.tick(now, online);
    }
    expect(room.state.status).toBe('FINISHED');
    expect(room.state.standings.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it('não aceita entrada depois de começar', () => {
    const room = makeRoom({ mode: 'SIT_AND_GO', seats: 4 });
    join(room, 'p2', 'Ana');
    room.command('host', { type: 'SIT' }, T0);
    room.command('p2', { type: 'SIT' }, T0);
    room.command('host', { type: 'START' }, T0);
    join(room, 'p3', 'Beto');
    expect(() => room.command('p3', { type: 'SIT' }, T0)).toThrow();
  });
});
