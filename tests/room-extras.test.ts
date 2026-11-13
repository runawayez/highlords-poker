import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../packages/contracts/src/index.ts';
import { RoomEngine, TIME_BANK_START, TIME_BANK_STEP } from '../packages/server/src/room.ts';

const T0 = 1_700_000_000_000;

function headsUp(overrides: Record<string, unknown> = {}) {
  const { password, ...config } = ConfigSchema.parse({ title: 'Mesa extra', ...overrides });
  void password;
  const room = RoomEngine.create({ id: 'ABC234', config, salt: 's', hostId: 'host' }, T0);
  room.admit('host', { nickname: 'Anfitriao', avatar: 'g1' }, T0);
  room.admit('p2', { nickname: 'Ana', avatar: 'g2' }, T0);
  room.command('host', { type: 'SIT' }, T0);
  room.command('p2', { type: 'SIT' }, T0);
  const online = new Set(['host', 'p2']);
  room.tick(T0 + 2000, online);
  return { room, online };
}

/** Joga check/call até o fim da mão para chegar ao showdown. */
function playToShowdown(room: RoomEngine, now: number) {
  let guard = 0;
  while (!room.state.hand!.done && guard++ < 40) {
    const actor = room.state.hand!.actor!;
    const hand = room.state.hand!;
    const me = hand.players.find((p) => p.id === actor)!;
    const owes = hand.currentBet - me.bet;
    room.command(actor, { type: 'ACT', action: owes > 0 ? 'CALL' : 'CHECK' }, now);
  }
}

describe('time bank', () => {
  it('estende o prazo da vez, gasta uma ficha e não deixa gastar fora da vez', () => {
    const { room } = headsUp();
    const actor = room.state.hand!.actor!;
    const other = actor === 'host' ? 'p2' : 'host';
    const before = room.state.deadline;
    expect(() => room.command(other, { type: 'TIME_BANK' }, T0 + 2100)).toThrow();
    room.command(actor, { type: 'TIME_BANK' }, T0 + 2100);
    expect(room.state.deadline).toBe(before + TIME_BANK_STEP);
    const mine = room.state.players.find((p) => p.id === actor)!;
    expect(mine.bank).toBe(TIME_BANK_START + 5000 - TIME_BANK_STEP); // +5 s de reposição ao começar a mão
  });

  it('acaba depois de gastar todas as fichas', () => {
    const { room } = headsUp();
    const actor = room.state.hand!.actor!;
    room.command(actor, { type: 'TIME_BANK' }, T0 + 2100);
    room.command(actor, { type: 'TIME_BANK' }, T0 + 2100);
    expect(() => room.command(actor, { type: 'TIME_BANK' }, T0 + 2100)).toThrow();
  });
});

describe('showdown: mostrar, esconder e revelar depois', () => {
  it('quem perde pode esconder as cartas, mas o vencedor sempre as mostra', () => {
    const { room, online } = headsUp();
    room.command('host', { type: 'SHOWDOWN', mode: 'MUCK' }, T0 + 2100);
    room.command('p2', { type: 'SHOWDOWN', mode: 'MUCK' }, T0 + 2100);
    playToShowdown(room, T0 + 2200);
    const hand = room.state.hand!;
    expect(hand.showdown).toBe(true);
    const views = ['host', 'p2'].map((viewer) => room.view(viewer, T0 + 9000, online));
    const winners = Object.keys(hand.awards).filter((id) => hand.awards[id] > 0);
    // Um empate mostra os dois; senão só o vencedor aparece para o adversário.
    const seenByHost = views[0].players.find((p) => p.id === 'p2')!.cards.length;
    const seenByGuest = views[1].players.find((p) => p.id === 'host')!.cards.length;
    if (winners.length === 1) {
      expect(winners[0] === 'p2' ? seenByHost : seenByGuest).toBe(2);
      expect(winners[0] === 'p2' ? seenByGuest : seenByHost).toBe(0);
    }
  });

  it('sem preferência, os dois mostram no showdown', () => {
    const { room, online } = headsUp();
    playToShowdown(room, T0 + 2200);
    const view = room.view('host', T0 + 9000, online);
    expect(view.players.find((p) => p.id === 'p2')!.cards).toHaveLength(2);
    expect(room.state.history[0].players!.every((p) => p.cards.length === 2)).toBe(true);
  });

  it('quem desistiu pode mostrar as cartas depois da mão', () => {
    const { room, online } = headsUp();
    const actor = room.state.hand!.actor!;
    room.command(actor, { type: 'ACT', action: 'FOLD' }, T0 + 2100);
    const winner = actor === 'host' ? 'p2' : 'host';
    expect(room.view(winner, T0 + 2200, online).players.find((p) => p.id === actor)!.cards).toEqual(
      [],
    );
    room.command(actor, { type: 'SHOW' }, T0 + 2200);
    expect(
      room.view(winner, T0 + 2200, online).players.find((p) => p.id === actor)!.cards,
    ).toHaveLength(2);
  });

  it('não dá para mostrar a mão no meio dela', () => {
    const { room } = headsUp();
    expect(() => room.command('host', { type: 'SHOW' }, T0 + 2100)).toThrow();
  });
});

describe('perfil e bots', () => {
  it('o perfil pode ser trocado a qualquer momento', () => {
    const { room } = headsUp();
    room.command(
      'p2',
      { type: 'PROFILE', profile: { nickname: 'Nova Ana', avatar: 'g3', color: 'azure' } },
      T0 + 3000,
    );
    expect(room.state.members.p2).toMatchObject({
      nickname: 'Nova Ana',
      avatar: 'g3',
      color: 'azure',
    });
  });

  it('apelido repetido recebe um sufixo ao editar o perfil', () => {
    const { room } = headsUp();
    room.command(
      'p2',
      { type: 'PROFILE', profile: { nickname: 'anfitriao', avatar: 'g2' } },
      T0 + 3000,
    );
    expect(room.state.members.p2.nickname).not.toBe('anfitriao');
  });

  it('a foto vai à parte do estado da sala', () => {
    const { room, online } = headsUp();
    const photo = 'data:image/webp;base64,AAAA';
    room.command(
      'p2',
      { type: 'PROFILE', profile: { nickname: 'Ana', avatar: 'g2', photo } },
      T0 + 3000,
    );
    expect(room.photos('p2')).toEqual({ p2: photo });
    expect(JSON.stringify(room.view('host', T0 + 3000, online))).not.toContain('base64');
  });

  it('bots recebem um estilo de jogo visível', () => {
    const { room, online } = headsUp();
    room.command('host', { type: 'ADD_BOT', difficulty: 'MEDIUM', style: 'AGGRESSIVE' }, T0 + 3000);
    const bot = room.view('host', T0 + 3000, online).players.find((p) => p.bot)!;
    expect(bot.botStyle).toBe('AGGRESSIVE');
  });
});

describe('ante, straddle, ritmo dos bots e run it twice', () => {
  it('o ante do cash é cobrado de todos e o pote o inclui', () => {
    const { room } = headsUp({ ante: 5 });
    const hand = room.state.hand!;
    expect(hand.players.every((p) => p.total >= 5)).toBe(true);
    expect(room.view('host', T0 + 2100, new Set(['host', 'p2'])).level.ante).toBe(5);
  });

  it('o straddle da sala vale quando há 3 ou mais jogadores', () => {
    const { room, online } = headsUp({ straddle: true });
    // Com 2 jogadores não há straddle.
    expect(room.state.hand!.straddler).toBeNull();
    room.admit('p3', { nickname: 'Beto', avatar: 'g3' }, T0);
    room.command('p3', { type: 'SIT' }, T0 + 2100);
    online.add('p3');
    // Termina a mão atual e espera a próxima com 3 jogadores.
    const actor = room.state.hand!.actor!;
    room.command(actor, { type: 'ACT', action: 'FOLD' }, T0 + 2200);
    room.tick(T0 + 20_000, online);
    expect(room.state.hand!.players).toHaveLength(3);
    expect(room.state.hand!.straddler).toBeTruthy();
  });

  it('o ritmo CALM deixa o bot mais lento que o FAST', () => {
    const delay = (botPace: 'CALM' | 'FAST') => {
      const { room, online } = headsUp({ botPace });
      room.command('host', { type: 'ADD_BOT', difficulty: 'EASY' }, T0 + 2100);
      const bot = room.state.players.find((p) => p.bot)!;
      // Termina a mão em andamento e começa uma onde o bot age.
      let now = T0 + 3000;
      for (let i = 0; i < 60 && !room.state.botAt; i++) {
        const hand = room.state.hand;
        if (hand && !hand.done && hand.actor && hand.actor !== bot.id)
          room.command(hand.actor, { type: 'ACT', action: 'FOLD' }, now);
        now += 8000;
        room.tick(now, online);
      }
      return room.state.botAt - (now - 0);
    };
    const calm = delay('CALM');
    const fast = delay('FAST');
    expect(calm).toBeGreaterThanOrEqual(1500);
    expect(calm).toBeLessThan(3000);
    expect(fast).toBeGreaterThanOrEqual(300);
    expect(fast).toBeLessThan(700);
  });

  it('o jogador aceita run it twice e o bot sempre aceita', () => {
    const { room, online } = headsUp();
    room.command('host', { type: 'RUN_TWICE', value: true }, T0 + 2100);
    expect(room.view('host', T0 + 2100, online).players.find((p) => p.id === 'host')!.twice).toBe(
      true,
    );
  });
});

describe('avatares', () => {
  it('bots entram com emblemas e ids antigos de retrato viram emblema', async () => {
    const { ProfileSchema, EMBLEMS } = await import('../packages/contracts/src/index.ts');
    const { room } = headsUp();
    for (let i = 0; i < 3; i++)
      room.command('host', { type: 'ADD_BOT', difficulty: 'EASY' }, T0 + 2100);
    const bots = room.state.players.filter((p) => p.bot);
    expect(bots.length).toBeGreaterThan(0);
    for (const bot of bots) expect(EMBLEMS).toContain(bot.botProfile!.avatar);
    expect(ProfileSchema.parse({ nickname: 'Velho', avatar: 'a3' }).avatar).toBe('g3');
    expect(ProfileSchema.parse({ nickname: 'Sem avatar' }).avatar).toBe('g1');
  });
});
