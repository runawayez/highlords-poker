import { describe, it, expect, vi, afterEach } from 'vitest';
import { PokerService, type State, type Store } from '../../packages/server/src/service.ts';
import { ConfigSchema } from '../../packages/contracts/src/index.ts';
import { balance, levelAt } from '../../packages/tournament-engine/src/index.ts';
const cfg = ConfigSchema.parse({
  title: 'Test room',
  mode: 'CASH',
  seats: 6,
  stack: 1000,
  small: 5,
  big: 10,
  levels: [{ small: 5, big: 10, ante: 0, minutes: 1, breakMinutes: 1 }],
});
class Memory implements Store {
  state: State | null = null;
  fail = false;
  async load() {
    return structuredClone(this.state);
  }
  async save(s: State) {
    if (this.fail) throw Error('disk unavailable');
    this.state = structuredClone(s);
  }
}
async function setup() {
  const db = new Memory();
  const s = new PokerService(db);
  await s.init();
  const a = await s.openSession({ nickname: 'Alice' }),
    b = await s.openSession({ nickname: 'Bob' });
  return { db, s, a, b };
}
const cmd = (type: string, roomId?: string, payload: unknown = {}, version?: number) => ({
  id: crypto.randomUUID(),
  type,
  roomId,
  payload,
  version,
});
async function create(s: PokerService, token: string, overrides = {}) {
  return (await s.command(
    token,
    cmd('CREATE', undefined, { config: { ...cfg, ...overrides } }),
  )) as { roomId: string };
}
afterEach(() => vi.useRealTimers());
describe('durable service', () => {
  it('restores a confirmed hand and secret session after backend restart', async () => {
    const { s, db, a, b } = await setup();
    const { roomId } = await create(s, a.token!);
    await s.command(b.token!, cmd('JOIN', roomId));
    let view = await s.snapshot(roomId, a.token!);
    await s.command(a.token!, cmd('START', roomId, {}, view.version));
    view = await s.snapshot(roomId, a.token!);
    const reboot = new PokerService(db);
    await reboot.init();
    expect(await reboot.snapshot(roomId, a.token!)).toEqual(view);
    expect(view.tables[0].hand!.players.find((p) => p.id === b.playerId)!.cards).toEqual([]);
    expect(view.tables[0].hand!.players.find((p) => p.id === a.playerId)!.cards).toHaveLength(2);
  });
  it('rejects nickname impersonation, host escalation, wrong passwords and leaks', async () => {
    const { s, a, b } = await setup();
    const { roomId } = await create(s, a.token!, { password: 'secret' });
    expect(JSON.stringify(s.lobby())).not.toContain('secret');
    await expect(s.command(b.token!, cmd('JOIN', roomId, { password: 'wrong' }))).rejects.toThrow(
      'INVALID_PASSWORD',
    );
    await s.command(b.token!, cmd('JOIN', roomId, { password: 'secret' }));
    const v = await s.snapshot(roomId, b.token!);
    await expect(s.command(b.token!, cmd('START', roomId, {}, v.version))).rejects.toThrow(
      'FORBIDDEN',
    );
    const imp = await s.openSession({ nickname: 'Alice' });
    expect(imp.playerId).not.toBe(a.playerId);
    await expect(s.snapshot(roomId, imp.token!)).rejects.toThrow('JOIN_REQUIRED');
  });
  it('deduplicates commands and isolates rooms', async () => {
    const { s, a, b } = await setup();
    const c = cmd('CREATE', undefined, { config: cfg });
    const first = await s.command(a.token!, c);
    expect(await s.command(a.token!, c)).toEqual(first);
    expect(s.lobby()).toHaveLength(1);
    const second = await create(s, b.token!);
    expect(second.roomId).not.toBe((first as any).roomId);
    await expect(s.snapshot(second.roomId, a.token!)).rejects.toThrow('JOIN_REQUIRED');
  });
  it('fails closed on storage errors', async () => {
    const { s, db, a, b } = await setup();
    const { roomId } = await create(s, a.token!);
    const before = structuredClone(s.state);
    db.fail = true;
    await expect(s.command(b.token!, cmd('JOIN', roomId))).rejects.toThrow();
    expect(s.state).toEqual(before);
    db.fail = false;
    await expect(s.snapshot(roomId, b.token!)).rejects.toThrow('JOIN_REQUIRED');
  });
  it('serializes competing commands and rejects stale versions', async () => {
    const { s, a, b } = await setup();
    const { roomId } = await create(s, a.token!);
    await s.command(b.token!, cmd('JOIN', roomId));
    const v = await s.snapshot(roomId, a.token!);
    const results = await Promise.allSettled([
      s.command(a.token!, cmd('START', roomId, {}, v.version)),
      s.command(a.token!, cmd('START', roomId, {}, v.version)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('moderates and rate-limits chat; treats HTML as plain text', async () => {
    const { s, a, b } = await setup();
    const { roomId } = await create(s, a.token!);
    await s.command(b.token!, cmd('JOIN', roomId));
    await s.command(b.token!, cmd('CHAT', roomId, { text: '<img onerror=alert(1)>' }));
    expect((await s.snapshot(roomId, a.token!)).chat.at(-1)!.text).toBe('<img onerror=alert(1)>');
    await expect(s.command(b.token!, cmd('CHAT', roomId, { text: 'spam' }))).rejects.toThrow(
      'RATE_LIMIT',
    );
    const v = await s.snapshot(roomId, a.token!);
    await s.command(
      a.token!,
      cmd('MODERATE', roomId, { target: b.playerId, action: 'MUTE' }, v.version),
    );
    await expect(s.command(b.token!, cmd('CHAT', roomId, { text: 'hello' }))).rejects.toThrow(
      'MUTED',
    );
  });
  it('exports no unrevealed cards, deck, token or password hash', async () => {
    const { s, a, b } = await setup();
    const { roomId } = await create(s, a.token!);
    await s.command(b.token!, cmd('JOIN', roomId));
    const v = await s.snapshot(roomId, a.token!);
    await s.command(a.token!, cmd('START', roomId, {}, v.version));
    const exported = await s.command(a.token!, cmd('EXPORT', roomId));
    const text = JSON.stringify(exported);
    expect(text).not.toContain(a.token);
    expect(text).not.toContain('\"deck\"');
    expect(text).not.toContain('password');
    expect(
      (exported as any).room.tables[0].hand.players.every((p: any) => p.cards.length === 0),
    ).toBe(true);
  });
  it('persists multitable transfers atomically and can restore coordinator', async () => {
    const { s, db, a, b } = await setup();
    const { roomId } = await create(s, a.token!, {
      mode: 'TOURNAMENT',
      seats: 2,
      capacity: 9,
      rebuy: false,
    });
    const sessions = [a, b];
    for (let i = 0; i < 3; i++) sessions.push(await s.openSession({ nickname: 'Player ' + i }));
    for (const p of sessions.slice(1)) await s.command(p.token!, cmd('JOIN', roomId));
    let v = await s.snapshot(roomId, a.token!);
    await s.command(a.token!, cmd('START', roomId, {}, v.version));
    v = await s.snapshot(roomId, a.token!);
    expect(v.tables).toHaveLength(3);
    expect(v.tables.flatMap((t) => t.ids)).toHaveLength(5);
    const before =
      s.state.rooms[0].players.reduce((sum, p) => sum + p.stack, 0) +
      s.state.rooms[0].tables
        .flatMap((t) => t.hand?.players ?? [])
        .reduce((sum, p) => sum + p.total, 0);
    expect(before).toBe(5000);
    const reboot = new PokerService(db);
    await reboot.init();
    expect((await reboot.snapshot(roomId, a.token!)).tables).toEqual(v.tables);
  });
  it('pauses empty rooms and freezes elapsed blind time', async () => {
    vi.useFakeTimers();
    const { s, a, b } = await setup();
    const { roomId } = await create(s, a.token!, { mode: 'SIT_AND_GO' });
    await s.command(b.token!, cmd('JOIN', roomId));
    let v = await s.snapshot(roomId, a.token!);
    await s.command(a.token!, cmd('START', roomId, {}, v.version));
    vi.advanceTimersByTime(61000);
    await s.tick();
    v = await s.snapshot(roomId, a.token!);
    expect(v.status).toBe('PAUSED');
    const elapsed = v.elapsed;
    vi.advanceTimersByTime(600000);
    await s.tick();
    expect((await s.snapshot(roomId, a.token!)).elapsed).toBe(elapsed);
  });
  it('validates configuration and typed payloads', async () => {
    const { s, a } = await setup();
    await expect(create(s, a.token!, { stack: -1 })).rejects.toThrow();
    await expect(s.command(a.token!, { type: 'WIN', stack: 9999 })).rejects.toThrow();
  });
});
it('balances tables without duplicate seats and computes breaks', () => {
  for (let n = 2; n <= 90; n++) {
    const out = balance(
      Array.from({ length: n }, (_, i) => String(i)),
      9,
    );
    expect(new Set(out.flat()).size).toBe(n);
    expect(
      Math.max(...out.map((t) => t.length)) - Math.min(...out.map((t) => t.length)),
    ).toBeLessThanOrEqual(1);
  }
  expect(levelAt(cfg, 61000).break).toBe(true);
});

it('enforces the durable daily write brake and resets on the next UTC day', async () => {
  vi.useFakeTimers();
  const { s, a } = await setup();
  s.state.budget = { day: new Date().toISOString().slice(0, 10), writes: 40000 };
  await expect(create(s, a.token)).rejects.toThrow('MAINTENANCE');
  expect(s.lobby()).toHaveLength(0);
  vi.advanceTimersByTime(86400000);
  expect((await create(s, a.token)).roomId).toBeTruthy();
  expect(s.state.budget!.writes).toBe(1);
});
it('clock-only ticks do not invalidate a current betting version', async () => {
  vi.useFakeTimers();
  const { s, a, b } = await setup();
  const { roomId } = await create(s, a.token);
  await s.command(b.token, cmd('JOIN', roomId));
  await s.command(a.token, cmd('START', roomId, {}, (await s.snapshot(roomId, a.token)).version));
  const before = await s.snapshot(roomId, a.token);
  vi.advanceTimersByTime(5000);
  await s.tick();
  expect((await s.snapshot(roomId, a.token)).version).toBe(before.version);
});
it('rejects global chat and isolates messages by room', async () => {
  const { s, a, b } = await setup();
  const first = await create(s, a.token),
    second = await create(s, b.token);
  await expect(s.command(a.token, cmd('CHAT', undefined, { text: 'global' }))).rejects.toThrow(
    'ROOM_NOT_FOUND',
  );
  await expect(s.command(b.token, cmd('CHAT', first.roomId, { text: 'intruder' }))).rejects.toThrow(
    'JOIN_REQUIRED',
  );
  await s.command(a.token, cmd('CHAT', first.roomId, { text: 'private conversation' }));
  expect(
    (await s.snapshot(second.roomId, b.token)).chat.some((m) => m.text === 'private conversation'),
  ).toBe(false);
});

it.each(['EASY', 'MEDIUM', 'HARD'])(
  'runs durable %s bots with one human and no bot credentials',
  async (difficulty) => {
    vi.useFakeTimers();
    const { s, db, a } = await setup();
    const { roomId } = await create(s, a.token);
    const version = () => s.state.rooms[0].version;
    const add = cmd('ADD_BOTS', roomId, { difficulty, count: 3 }, version());
    await s.command(a.token, add);
    await s.command(a.token, add);
    expect(s.state.rooms[0].players.filter((p) => p.bot)).toHaveLength(3);
    expect(s.state.sessions).toHaveLength(2);
    await s.command(a.token, cmd('START', roomId, {}, version()));
    await expect(
      s.command(
        a.token,
        cmd('REMOVE_BOT', roomId, { target: s.state.rooms[0].players[1].id }, version()),
      ),
    ).rejects.toThrow('INVALID_ACTION');
    const restored = new PokerService(db);
    await restored.init();
    for (let step = 0; step < 200 && !restored.state.rooms[0].tables[0].hand!.done; step++) {
      const r = restored.state.rooms[0];
      const h = r.tables[0].hand!;
      if (h.actor === a.playerId) {
        const opts = (await restored.snapshot(roomId, a.token)).tables[0].hand!.legal;
        await restored.command(
          a.token,
          cmd(
            'ACT',
            roomId,
            {
              action: opts.actions.includes('ALL_IN')
                ? 'ALL_IN'
                : opts.actions.includes('CALL')
                  ? 'CALL'
                  : 'CHECK',
            },
            r.version,
          ),
        );
      }
      vi.advanceTimersByTime(5000);
      await restored.heartbeat(a.token);
      await restored.tick();
    }
    const h = restored.state.rooms[0].tables[0].hand!;
    expect(h.done).toBe(true);
    expect(h.players.reduce((sum, p) => sum + p.stack, 0)).toBe(4000);
    vi.advanceTimersByTime(61000);
    await restored.tick();
    expect(restored.state.rooms[0].status).toBe('PAUSED');
  },
);
it('restricts bot management to the host, bounds capacity and removes waiting bots', async () => {
  const { s, a, b } = await setup();
  const { roomId } = await create(s, a.token, { seats: 2 });
  await s.command(b.token, cmd('SPECTATE', roomId));
  const version = () => s.state.rooms[0].version;
  await expect(
    s.command(b.token, cmd('ADD_BOTS', roomId, { difficulty: 'EASY', count: 1 }, version())),
  ).rejects.toThrow('FORBIDDEN');
  await s.command(a.token, cmd('ADD_BOTS', roomId, { difficulty: 'HARD', count: 1 }, version()));
  await expect(
    s.command(a.token, cmd('ADD_BOTS', roomId, { difficulty: 'HARD', count: 1 }, version())),
  ).rejects.toThrow('ROOM_FULL');
  const view = await s.snapshot(roomId, a.token);
  expect(view.players[1].profile!.nickname).toContain('Bot');
  await s.command(a.token, cmd('REMOVE_BOT', roomId, { target: view.players[1].id }, version()));
  expect(s.state.rooms[0].players).toHaveLength(1);
  expect(s.state.rooms[0].pool).toBe(cfg.buyIn);
});
