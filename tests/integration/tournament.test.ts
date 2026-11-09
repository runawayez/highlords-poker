import { it, expect, vi, afterEach } from 'vitest';
import { PokerService, type State, type Store } from '../../packages/server/src/service.ts';
import { ConfigSchema } from '../../packages/contracts/src/index.ts';
import { legal } from '../../packages/poker-engine/src/index.ts';
let saved: State | null = null;
const store: Store = {
  async load() {
    return structuredClone(saved);
  },
  async save(s) {
    saved = structuredClone(s);
  },
};
const cfg = ConfigSchema.parse({
  title: 'Championship',
  mode: 'TOURNAMENT',
  capacity: 18,
  seats: 3,
  stack: 1000,
  small: 50,
  big: 100,
  rebuy: false,
  levels: [{ small: 50, big: 100, ante: 10, minutes: 10, breakMinutes: 0 }],
});
const command = (type: string, roomId?: string, payload: unknown = {}, version?: number) => ({
  id: crypto.randomUUID(),
  type,
  roomId,
  payload,
  version,
});
afterEach(() => {
  vi.useRealTimers();
  saved = null;
});
it('completes a nine-player multitable tournament, restores at every barrier, never duplicates chips or players', async () => {
  vi.useFakeTimers();
  let s = new PokerService(store);
  await s.init();
  const players = [];
  for (let i = 0; i < 9; i++) players.push(await s.openSession({ nickname: 'Player ' + i }));
  const host = players[0];
  const { roomId } = (await s.command(
    host.token,
    command('CREATE', undefined, { config: cfg }),
  )) as { roomId: string };
  for (const p of players.slice(1)) await s.command(p.token, command('JOIN', roomId));
  await s.command(
    host.token,
    command('START', roomId, {}, (await s.snapshot(roomId, host.token)).version),
  );
  let cycles = 0;
  while (s.state.rooms[0].status !== 'FINISHED') {
    expect(++cycles).toBeLessThan(300);
    const r = s.state.rooms[0];
    for (const t of r.tables) {
      while (t.hand && !t.hand.done) {
        const actor = players.find((p) => p.playerId === t.hand!.actor)!;
        const l = legal(t.hand, actor.playerId);
        const action = l.actions.includes('ALL_IN')
          ? 'ALL_IN'
          : l.actions.includes('CALL')
            ? 'CALL'
            : 'CHECK';
        await s.command(actor.token, command('ACT', roomId, { action }, s.state.rooms[0].version));
        t.hand = s.state.rooms[0].tables.find((x) => x.id === t.id)!.hand;
      }
    }
    vi.advanceTimersByTime(9000);
    for (const p of players) await s.heartbeat(p.token);
    await s.tick();
    const room = s.state.rooms[0];
    const committed = room.players.reduce((n, p) => n + p.stack, 0);
    const held = room.tables
      .filter((t) => t.hand && !t.hand.done)
      .flatMap((t) => t.hand!.players)
      .reduce((n, p) => n + p.total, 0);
    expect(committed + held).toBe(9000);
    expect(new Set(room.tables.flatMap((t) => t.ids)).size).toBe(
      room.tables.flatMap((t) => t.ids).length,
    );
    s = new PokerService(store);
    await s.init();
  }
  const r = s.state.rooms[0];
  expect(r.players.filter((p) => p.stack > 0)).toHaveLength(1);
  expect(Object.values(r.payouts).reduce((a, b) => a + b, 0)).toBe(9000);
  expect(r.players.filter((p) => p.rank === 1)).toHaveLength(1);
  expect(new Set(r.players.map((p) => p.rank)).size).toBe(9);
});
it('supports one rebuy and one add-on without duplicating command receipts', async () => {
  vi.useFakeTimers();
  const s = new PokerService(store);
  await s.init();
  const a = await s.openSession({ nickname: 'Alpha' }),
    b = await s.openSession({ nickname: 'Beta' });
  const { roomId } = (await s.command(
    a.token,
    command('CREATE', undefined, {
      config: { ...cfg, mode: 'SIT_AND_GO', seats: 2, rebuy: true, rebuyLimit: 1, addOnLevel: 0 },
    }),
  )) as { roomId: string };
  await s.command(b.token, command('JOIN', roomId));
  const room = () => s.state.rooms[0];
  await s.command(a.token, command('ADD_ON', roomId, {}, room().version));
  await expect(s.command(a.token, command('ADD_ON', roomId, {}, room().version))).rejects.toThrow(
    'INVALID_ACTION',
  );
  expect(room().players[0].stack).toBe(4000);
  await s.command(a.token, command('START', roomId, {}, room().version));
  while (!room().tables[0].hand!.done) {
    const hand = room().tables[0].hand!;
    const actor = hand.actor === a.playerId ? a : b;
    const opts = legal(hand, actor.playerId);
    await s.command(
      actor.token,
      command(
        'ACT',
        roomId,
        {
          action: opts.actions.includes('ALL_IN')
            ? 'ALL_IN'
            : opts.actions.includes('CALL')
              ? 'CALL'
              : 'CHECK',
        },
        room().version,
      ),
    );
  }
  const busted = room().players.find((p) => p.stack === 0);
  if (busted) {
    const actor = busted.id === a.playerId ? a : b;
    const c = command('TOP_UP', roomId, { amount: 1000 }, room().version);
    await s.command(actor.token, c);
    await s.command(actor.token, c);
    expect(room().players.find((p) => p.id === actor.playerId)!.stack).toBe(1000);
    expect(room().players.find((p) => p.id === actor.playerId)!.rebuyCount).toBe(1);
  }
});

it.each(['SIT_AND_GO', 'TOURNAMENT'])(
  'finishes %s with eight bots and a human, preserving chips and prizes',
  async (mode) => {
    vi.useFakeTimers();
    let s = new PokerService(store);
    await s.init();
    const host = await s.openSession({ nickname: 'Solo' });
    const { roomId } = (await s.command(
      host.token,
      command('CREATE', undefined, {
        config: {
          ...cfg,
          mode,
          seats: mode === 'TOURNAMENT' ? 3 : 9,
          small: 500,
          big: 1000,
          levels: [{ small: 500, big: 1000, ante: 100, minutes: 10, breakMinutes: 0 }],
        },
      }),
    )) as { roomId: string };
    await s.command(
      host.token,
      command('ADD_BOTS', roomId, { difficulty: 'MEDIUM', count: 8 }, s.state.rooms[0].version),
    );
    await expect(
      s.command(
        host.token,
        command('ADD_BOTS', roomId, { difficulty: 'EASY', count: 1 }, s.state.rooms[0].version),
      ),
    ).rejects.toThrow('CAPACITY');
    await s.command(host.token, command('START', roomId, {}, s.state.rooms[0].version));
    let steps = 0;
    while (s.state.rooms[0].status !== 'FINISHED') {
      expect(++steps).toBeLessThan(1000);
      const humanTable = s.state.rooms[0].tables.find(
        (t) => !t.hand?.done && t.hand?.actor === host.playerId,
      );
      if (humanTable?.hand) {
        const opts = legal(humanTable.hand, host.playerId);
        await s.command(
          host.token,
          command(
            'ACT',
            roomId,
            {
              action: opts.actions.includes('ALL_IN')
                ? 'ALL_IN'
                : opts.actions.includes('CALL')
                  ? 'CALL'
                  : 'CHECK',
            },
            s.state.rooms[0].version,
          ),
        );
      }
      vi.advanceTimersByTime(9000);
      await s.heartbeat(host.token);
      await s.tick();
      const room = s.state.rooms[0];
      const held = room.tables
        .filter((t) => t.hand && !t.hand.done)
        .flatMap((t) => t.hand!.players)
        .reduce((n, p) => n + p.total, 0);
      expect(room.players.reduce((n, p) => n + p.stack, 0) + held).toBe(9000);
      s = new PokerService(store);
      await s.init();
    }
    const room = s.state.rooms[0];
    expect(room.players.filter((p) => p.stack > 0)).toHaveLength(1);
    expect(new Set(room.players.map((p) => p.rank)).size).toBe(9);
    expect(Object.values(room.payouts).reduce((a, b) => a + b, 0)).toBe(9000);
  },
);
