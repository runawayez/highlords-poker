import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../packages/contracts/src/index.ts';
import { RoomRuntime, type Socket } from '../packages/server/src/runtime.ts';
import { playerIdFromKey } from '../packages/server/src/security.ts';

const START = 1_700_000_000_000;

type Counters = { alarms: number; saves: number; alarmSets: number; lobbyPuts: number };

/**
 * Sala de verdade (`RoomRuntime`) com relógio simulado e armazenamento falso, só para contar
 * quantas acordadas, gravações e agendamentos ela faz: é o que o Cloudflare cobra.
 */
async function simulate(options: {
  minutes: number;
  humanActs: boolean;
  mode?: 'CASH' | 'SIT_AND_GO';
}) {
  let now = START;
  const counters: Counters = { alarms: 0, saves: 0, alarmSets: 0, lobbyPuts: 0 };
  let nextAlarm: number | null = null;
  const sockets: { socket: Socket; id?: string }[] = [];
  const outbox: unknown[] = [];
  const socket: Socket = {
    send: (data) => outbox.push(JSON.parse(data)),
    close: () => {},
  };
  sockets.push({ socket });
  const { password, ...config } = ConfigSchema.parse({
    title: 'carga',
    mode: options.mode ?? 'CASH',
    isPublic: true,
  });
  void password;
  const runtime = new RoomRuntime({
    now: () => now,
    storage: {
      load: async () => null,
      save: async () => {
        counters.saves++;
      },
      remove: async () => {},
    },
    hub: {
      sockets: () => sockets,
      bind: (target, id) => {
        const entry = sockets.find((s) => s.socket === target);
        if (entry) entry.id = id;
      },
    },
    scheduler: {
      set: (at) => {
        counters.alarmSets++;
        nextAlarm = at;
      },
    },
    lobby: {
      put: () => {
        counters.lobbyPuts++;
      },
      remove: () => {},
    },
  });
  const hostKey = 'k'.repeat(32);
  await runtime.create('ABC234', {
    config,
    salt: 's',
    hostKey,
    profile: { nickname: 'Humano', avatar: 'g1' } as never,
  });
  const send = (message: unknown) => runtime.message(socket, JSON.stringify(message));
  await send({ type: 'HELLO', key: hostKey, profile: { nickname: 'Humano', avatar: 'g1' } });
  await send({ type: 'SIT' });
  for (let i = 0; i < 3; i++) await send({ type: 'ADD_BOT', difficulty: 'MEDIUM' });
  if (options.mode === 'SIT_AND_GO') await send({ type: 'START' });
  const humanId = await playerIdFromKey(hostKey);

  const end = START + options.minutes * 60_000;
  let guard = 0;
  while (nextAlarm !== null && now < end && guard++ < 200_000) {
    now = Math.max(now, nextAlarm);
    counters.alarms++;
    await runtime.alarm();
    if (options.humanActs) {
      const hand = runtime.engine!.state.hand;
      if (hand && !hand.done && hand.actor === humanId) await send({ type: 'ACT', action: 'FOLD' });
    }
  }
  return {
    counters,
    runtime,
    status: runtime.engine!.state.status,
    hands: runtime.engine!.state.handNo,
  };
}

describe('consumo da sala (acordadas e gravações)', () => {
  it('mesa com humano ausente e bots não joga para sempre: pausa por inatividade', async () => {
    const result = await simulate({ minutes: 30, humanActs: false });
    expect(result.status).toBe('PAUSED');
    expect(result.runtime.engine!.state.pauseReason).toBe('IDLE');
    // Em vez de ~1.000 acordadas em 30 min, para logo depois da inatividade.
    expect(result.counters.alarms).toBeLessThan(250);
    expect(result.counters.saves).toBeLessThan(100);
  });

  it('humano jogando segue sem pausar, com custo por mão contido', async () => {
    const result = await simulate({ minutes: 30, humanActs: true });
    expect(result.status).toBe('RUNNING');
    const perHand = result.counters.saves / Math.max(1, result.hands);
    expect(perHand).toBeLessThan(5);
  });
});
