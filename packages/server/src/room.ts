import {
  blindLevel,
  BOT_STYLES,
  PROFILE_COLORS,
  type BotDifficulty,
  type BotStyle,
  type ClientMessage,
  type ErrorCode,
  type LobbyEntry,
  type Profile,
  type PublicConfig,
} from '../../contracts/src/index.ts';
import {
  act,
  evaluate,
  demand,
  legal,
  publicHand,
  startHand,
  RuleError,
  type Action,
  type Hand,
} from '../../poker-engine/src/index.ts';
import { decide } from '../../poker-bot/src/index.ts';

/** Pessoa que já entrou na sala (sentada ou assistindo). */
export type Member = Profile & { id: string; lastSeen: number };
export type Seated = {
  id: string;
  seat: number;
  stack: number;
  sitOut: boolean;
  /** Saiu da mesa no meio da mão: faz fold e some quando a mão termina. */
  leaving: boolean;
  timeouts: number;
  bot?: BotDifficulty;
  botStyle?: BotStyle;
  /** Tempo extra disponível (ms) para pedir mais tempo na sua vez. */
  bank?: number;
  /** Prefere esconder as cartas ao perder no showdown. */
  muck?: boolean;
  /** Nome e retrato dos bots; humanos usam `members`. */
  botProfile?: Profile;
};
export type Message = {
  id: number;
  at: number;
  from?: string;
  text?: string;
  /** Mensagem do sistema: código traduzido no cliente. */
  sys?: string;
  params?: Record<string, string | number>;
};
export type HandSummary = {
  no: number;
  at: number;
  pot: number;
  board: string[];
  winners: { id: string; nickname: string; amount: number; category?: number }[];
  /** Jogadores da mão; as cartas só aparecem para quem as mostrou no showdown. */
  players?: { id: string; nickname: string; seat: number; folded: boolean; cards: string[] }[];
  log?: { player: string; action: string; amount: number; street: number }[];
};
export type RoomState = {
  v: 1;
  id: string;
  config: PublicConfig;
  passwordHash?: string;
  salt: string;
  hostId: string;
  created: number;
  status: 'WAITING' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  pauseReason?: 'HOST' | 'EMPTY';
  pausedAt?: number;
  finishedAt?: number;
  members: Record<string, Member>;
  admitted: string[];
  banned: string[];
  players: Seated[];
  standings: {
    id: string;
    rank: number;
    nickname: string;
    avatar: Profile['avatar'];
    color?: Profile['color'];
  }[];
  button: number;
  hand?: Hand;
  handNo: number;
  deadline: number;
  botAt: number;
  nextHandAt: number;
  levelElapsed: number;
  clock: number;
  lastHuman: number;
  chat: Message[];
  emotes: { n: number; id: string; emote: string; at: number }[];
  history: HandSummary[];
  /** Quem escolheu mostrar as cartas depois da mão (vale só para `hand`). */
  revealed?: { hand: string; ids: string[] };
  seq: number;
  closed?: boolean;
};

export const EMPTY_PAUSE_MS = 60_000;
export const EMPTY_EXPIRE_MS = 30 * 60_000;
export const FINISHED_EXPIRE_MS = 60 * 60_000;
const OFFLINE_SEAT_MS = 10 * 60_000;
const BOT_NAMES = ['Dante', 'Raven', 'Vega', 'Nox', 'Luna', 'Atlas', 'Iris', 'Drake'];
export const TIME_BANK_START = 30_000;
export const TIME_BANK_CAP = 45_000;
export const TIME_BANK_STEP = 15_000;

export class RoomEngine {
  constructor(
    public state: RoomState,
    private uuid: () => string = () => crypto.randomUUID(),
  ) {}

  static create(
    input: {
      id: string;
      config: PublicConfig;
      passwordHash?: string;
      salt: string;
      hostId: string;
    },
    now: number,
  ): RoomEngine {
    return new RoomEngine({
      v: 1,
      id: input.id,
      config: input.config,
      passwordHash: input.passwordHash,
      salt: input.salt,
      hostId: input.hostId,
      created: now,
      status: 'WAITING',
      members: {},
      admitted: [],
      banned: [],
      players: [],
      standings: [],
      button: -1,
      handNo: 0,
      deadline: 0,
      botAt: 0,
      nextHandAt: 0,
      levelElapsed: 0,
      clock: now,
      lastHuman: now,
      chat: [],
      emotes: [],
      history: [],
      seq: 0,
    });
  }

  get passwordRequired() {
    return !!this.state.passwordHash;
  }
  isBanned(id: string) {
    return this.state.banned.includes(id);
  }
  isAdmitted(id: string) {
    return this.state.admitted.includes(id) || id === this.state.hostId;
  }

  /** Registra (ou atualiza) quem entrou. A senha já foi conferida pelo runtime. */
  admit(id: string, profile: Profile, now: number) {
    const s = this.state;
    demand(!s.closed, 'ROOM_NOT_FOUND');
    demand(!s.banned.includes(id), 'KICKED');
    const isNew = !s.members[id];
    this.setProfile(id, profile, now);
    if (!s.admitted.includes(id)) s.admitted.push(id);
    if (isNew && Object.keys(s.members).length > 60) demand(false, 'CAPACITY');
    this.touch();
  }

  /** Grava o perfil (nova entrada ou edição); apelido repetido ganha um sufixo. */
  private setProfile(id: string, profile: Profile, now: number) {
    const s = this.state;
    const duplicate = Object.values(s.members).some(
      (m) => m.id !== id && m.nickname.toLowerCase() === profile.nickname.toLowerCase(),
    );
    const nickname = duplicate ? `${profile.nickname} ${id.slice(0, 2)}` : profile.nickname;
    s.members[id] = {
      id,
      nickname,
      avatar: profile.avatar,
      color: profile.color,
      photo: profile.photo,
      lastSeen: now,
    };
  }

  /** Fotos dos membros (id para data URL), enviadas à parte para não pesar em cada estado. */
  photos(onlyId?: string): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const m of Object.values(this.state.members))
      if (!onlyId || m.id === onlyId) out[m.id] = m.photo ?? null;
    return out;
  }

  private touch() {
    this.state.seq++;
  }
  private say(sys: string, params?: Message['params'], from?: string, now = Date.now()) {
    this.state.chat.push({ id: ++this.state.seq, at: now, sys, params, from });
    this.state.chat = this.state.chat.slice(-60);
  }
  private nameOf(id: string) {
    const p = this.state.players.find((x) => x.id === id);
    return p?.botProfile?.nickname ?? this.state.members[id]?.nickname ?? '?';
  }
  private seated(id: string) {
    return this.state.players.find((p) => p.id === id && !p.leaving);
  }
  private inHand(id: string) {
    const h = this.state.hand;
    return !!h && !h.done && h.players.some((p) => p.id === id);
  }
  private humans() {
    return this.state.players.filter((p) => !p.bot && !p.leaving);
  }

  // ---------------------------------------------------------------- comandos

  command(id: string, msg: ClientMessage, now: number) {
    const s = this.state;
    demand(!s.closed, 'ROOM_NOT_FOUND');
    demand(s.members[id] && !s.banned.includes(id), 'FORBIDDEN');
    const isHost = id === s.hostId;
    const me = this.seated(id);
    switch (msg.type) {
      case 'PING':
      case 'HELLO':
        return;
      case 'SIT': {
        demand(!me, 'INVALID_ACTION');
        demand(s.status !== 'FINISHED', 'INVALID_ACTION');
        demand(s.config.mode === 'CASH' || s.status === 'WAITING', 'INVALID_ACTION');
        demand(!s.players.some((p) => p.id === id), 'HAND_IN_PROGRESS');
        this.seat(id, undefined, msg.seat);
        this.say('SAT', { name: this.nameOf(id) }, id, now);
        this.maybeAutoStart(now);
        break;
      }
      case 'STAND':
      case 'LEAVE': {
        if (me) this.removeSeat(id, now);
        if (msg.type === 'LEAVE') s.members[id].lastSeen = 0;
        break;
      }
      case 'START': {
        demand(isHost, 'FORBIDDEN');
        demand(s.status === 'WAITING', 'INVALID_ACTION');
        demand(this.eligible().length >= 2, 'NEED_PLAYERS');
        this.begin(now);
        break;
      }
      case 'PAUSE': {
        demand(isHost && s.status === 'RUNNING', 'FORBIDDEN');
        this.pause('HOST', now);
        break;
      }
      case 'RESUME': {
        demand(isHost && s.status === 'PAUSED', 'FORBIDDEN');
        this.resume(now);
        break;
      }
      case 'ACT': {
        demand(me && s.status === 'RUNNING' && s.hand && !s.hand.done, 'INVALID_ACTION');
        demand(s.hand.actor === id, 'NOT_YOUR_TURN');
        me.timeouts = 0;
        this.apply(id, msg.action as Action, msg.amount, now);
        break;
      }
      case 'SIT_OUT': {
        demand(me, 'INVALID_ACTION');
        me.sitOut = msg.value;
        me.timeouts = 0;
        if (!msg.value && s.status === 'WAITING') this.maybeAutoStart(now);
        break;
      }
      case 'REBUY': {
        demand(me && s.config.mode === 'CASH', 'INVALID_ACTION');
        demand(!this.inHand(id), 'HAND_IN_PROGRESS');
        demand(me.stack < s.config.stack, 'INVALID_STACK');
        me.stack = s.config.stack;
        me.sitOut = false;
        me.timeouts = 0;
        this.say('REBUY', { name: this.nameOf(id) }, id, now);
        this.maybeAutoStart(now);
        break;
      }
      case 'PROFILE': {
        this.setProfile(id, msg.profile, now);
        break;
      }
      case 'TIME_BANK': {
        demand(me && s.status === 'RUNNING' && s.hand && !s.hand.done, 'INVALID_ACTION');
        demand(s.hand.actor === id, 'NOT_YOUR_TURN');
        const bank = me.bank ?? TIME_BANK_START;
        demand(bank >= TIME_BANK_STEP, 'INVALID_ACTION');
        me.bank = bank - TIME_BANK_STEP;
        s.deadline += TIME_BANK_STEP;
        break;
      }
      case 'SHOWDOWN': {
        demand(me, 'INVALID_ACTION');
        me.muck = msg.mode === 'MUCK';
        break;
      }
      case 'SHOW': {
        const h = s.hand;
        demand(me && h?.done && h.players.some((p) => p.id === id), 'INVALID_ACTION');
        if (s.revealed?.hand !== h.id) s.revealed = { hand: h.id, ids: [] };
        if (!s.revealed.ids.includes(id)) s.revealed.ids.push(id);
        break;
      }
      case 'ADD_BOT': {
        demand(isHost, 'FORBIDDEN');
        demand(s.config.mode === 'CASH' || s.status === 'WAITING', 'INVALID_ACTION');
        demand(s.status !== 'FINISHED', 'INVALID_ACTION');
        const botId = 'bot-' + this.uuid().slice(0, 8);
        const used = s.players.filter((p) => p.bot).map((p) => p.botProfile?.nickname);
        const name = BOT_NAMES.find((n) => !used.includes(n)) ?? botId.slice(4);
        const player = this.seat(botId, msg.difficulty);
        const nth = s.players.filter((p) => p.bot).length;
        player.botStyle = msg.style ?? BOT_STYLES[(nth + 1) % BOT_STYLES.length];
        player.botProfile = {
          nickname: name,
          avatar: (['a1', 'a2', 'a3', 'a4'] as const)[nth % 4],
          color: PROFILE_COLORS[(nth * 3 + 1) % PROFILE_COLORS.length],
        };
        this.say('SAT', { name }, botId, now);
        this.maybeAutoStart(now);
        break;
      }
      case 'REMOVE_BOT': {
        demand(isHost, 'FORBIDDEN');
        demand(s.config.mode === 'CASH' || s.status === 'WAITING', 'INVALID_ACTION');
        const bot = s.players.find((p) => p.id === msg.id && p.bot);
        demand(bot, 'INVALID_ACTION');
        this.removeSeat(bot.id, now);
        break;
      }
      case 'KICK': {
        demand(isHost && msg.id !== id, 'FORBIDDEN');
        demand(s.members[msg.id], 'INVALID_ACTION');
        if (this.seated(msg.id)) this.removeSeat(msg.id, now);
        s.banned.push(msg.id);
        this.say('KICKED', { name: this.nameOf(msg.id) }, undefined, now);
        break;
      }
      case 'CLOSE': {
        demand(isHost, 'FORBIDDEN');
        s.closed = true;
        break;
      }
      case 'CHAT': {
        const last = [...s.chat].reverse().find((m) => m.from === id && m.text);
        demand(!last || now - last.at > 800, 'RATE_LIMIT');
        s.chat.push({ id: ++s.seq, at: now, from: id, text: msg.text });
        s.chat = s.chat.slice(-60);
        break;
      }
      case 'EMOTE': {
        const last = [...s.emotes].reverse().find((e) => e.id === id);
        demand(!last || now - last.at > 1200, 'RATE_LIMIT');
        s.emotes.push({ n: ++s.seq, id, emote: msg.emote, at: now });
        s.emotes = s.emotes.slice(-12);
        break;
      }
    }
    this.touch();
  }

  // --------------------------------------------------------------- assentos

  private seat(id: string, bot?: BotDifficulty, wanted?: number): Seated {
    const s = this.state;
    const taken = new Set(
      s.players.filter((p) => !p.leaving || this.inHand(p.id)).map((p) => p.seat),
    );
    let seat = wanted;
    if (seat !== undefined) {
      demand(seat < s.config.seats, 'INVALID_ACTION');
      demand(!taken.has(seat), 'SEAT_TAKEN');
    } else {
      seat = [...Array(s.config.seats).keys()].find((n) => !taken.has(n));
      demand(seat !== undefined, 'ROOM_FULL');
    }
    const player: Seated = {
      id,
      seat,
      stack: s.config.stack,
      sitOut: false,
      leaving: false,
      timeouts: 0,
      bot,
      bank: TIME_BANK_START,
    };
    s.players.push(player);
    return player;
  }

  private removeSeat(id: string, now: number) {
    const s = this.state;
    const p = s.players.find((x) => x.id === id);
    if (!p) return;
    if (this.inHand(id)) {
      p.leaving = true;
      p.sitOut = true;
    } else s.players = s.players.filter((x) => x.id !== id);
    this.say('STOOD', { name: this.nameOf(id) }, id, now);
    if (s.status === 'RUNNING' && this.eligible().length < 2 && !this.inHand(id) && !s.hand?.done)
      this.settleIdle();
  }

  private eligible() {
    return this.state.players.filter(
      (p) => !p.leaving && p.stack > 0 && (this.state.config.mode === 'SIT_AND_GO' || !p.sitOut),
    );
  }

  // ----------------------------------------------------------------- fluxo

  private maybeAutoStart(now: number) {
    const s = this.state;
    if (s.config.mode === 'CASH' && s.status === 'WAITING' && this.eligible().length >= 2)
      this.begin(now);
    else if (
      s.config.mode === 'SIT_AND_GO' &&
      s.status === 'WAITING' &&
      s.players.length >= s.config.seats
    )
      this.begin(now);
  }

  private begin(now: number) {
    const s = this.state;
    s.status = 'RUNNING';
    s.clock = now;
    s.nextHandAt = now + 1200;
    this.say('STARTED', undefined, undefined, now);
  }

  private pause(reason: 'HOST' | 'EMPTY', now: number) {
    const s = this.state;
    this.advanceClock(now);
    s.status = 'PAUSED';
    s.pauseReason = reason;
    s.pausedAt = now;
    this.say(reason === 'HOST' ? 'PAUSED' : 'PAUSED_EMPTY', undefined, undefined, now);
  }

  private resume(now: number) {
    const s = this.state;
    const gap = now - (s.pausedAt ?? now);
    s.deadline += gap;
    s.nextHandAt += gap;
    s.botAt = s.botAt ? s.botAt + gap : 0;
    s.status = 'RUNNING';
    s.clock = now;
    delete s.pauseReason;
    delete s.pausedAt;
    this.say('RESUMED', undefined, undefined, now);
  }

  private advanceClock(now: number) {
    const s = this.state;
    if (s.status === 'RUNNING') s.levelElapsed += Math.max(0, now - s.clock);
    s.clock = now;
  }

  private level() {
    const s = this.state;
    const index =
      s.config.mode === 'SIT_AND_GO'
        ? Math.floor(s.levelElapsed / (s.config.levelMinutes * 60_000))
        : 0;
    return blindLevel(s.config, index);
  }

  private apply(id: string, action: Action, amount: number | undefined, now: number) {
    const s = this.state;
    act(s.hand!, id, action, amount);
    this.afterAction(now);
  }

  private afterAction(now: number) {
    const s = this.state;
    const h = s.hand!;
    for (const hp of h.players) {
      const p = s.players.find((x) => x.id === hp.id);
      if (p) p.stack = hp.stack;
    }
    s.deadline = now + s.config.turnSeconds * 1000;
    s.botAt = 0;
    if (!h.done) return;
    s.nextHandAt = now + (h.showdown ? 7000 : 3800);
    const winners = Object.entries(h.awards)
      .filter(([, amount]) => amount > 0)
      .map(([pid, amount]) => {
        const hp = h.players.find((p) => p.id === pid)!;
        return {
          id: pid,
          nickname: this.nameOf(pid),
          amount,
          category: h.showdown ? evaluate([...hp.cards, ...h.board])[0] : undefined,
        };
      });
    s.history.push({
      no: s.handNo,
      at: now,
      pot: winners.reduce((sum, w) => sum + w.amount, 0),
      board: [...h.board],
      winners,
      players: h.players.map((hp) => ({
        id: hp.id,
        nickname: this.nameOf(hp.id),
        seat: hp.seat,
        folded: hp.folded,
        cards: this.showsAtShowdown(h, hp.id) ? [...hp.cards] : [],
      })),
      log: h.log.map((entry) => ({ ...entry })),
    });
    s.history = s.history.slice(-15);
  }

  /** No showdown quem ganhou sempre mostra; quem perdeu mostra, salvo se escolheu esconder (muck). */
  private showsAtShowdown(h: Hand, id: string) {
    const hp = h.players.find((p) => p.id === id);
    if (!h.done || !h.showdown || !hp || hp.folded) return false;
    if ((h.awards[id] ?? 0) > 0) return true;
    return !this.state.players.find((p) => p.id === id)?.muck;
  }

  /** Sem mãos possíveis: a sala volta a esperar jogadores. */
  private settleIdle() {
    const s = this.state;
    delete s.hand;
    if (s.config.mode === 'CASH') s.status = 'WAITING';
  }

  private nextHand(now: number) {
    const s = this.state;
    // Limpa quem saiu e trata eliminações antes de distribuir.
    s.players = s.players.filter((p) => !p.leaving);
    if (s.config.mode === 'SIT_AND_GO') {
      const alive = s.players.filter((p) => p.stack > 0);
      const busted = s.players.filter((p) => p.stack === 0);
      busted
        .sort((a, b) => a.seat - b.seat)
        .forEach((p, i) => {
          s.standings.push({
            id: p.id,
            rank: alive.length + busted.length - i,
            nickname: this.nameOf(p.id),
            avatar: p.botProfile?.avatar ?? s.members[p.id]?.avatar ?? 'a1',
            color: p.botProfile?.color ?? s.members[p.id]?.color,
          });
        });
      s.players = alive;
      if (alive.length <= 1) {
        if (alive[0])
          s.standings.push({
            id: alive[0].id,
            rank: 1,
            nickname: this.nameOf(alive[0].id),
            avatar: alive[0].botProfile?.avatar ?? s.members[alive[0].id]?.avatar ?? 'a1',
            color: alive[0].botProfile?.color ?? s.members[alive[0].id]?.color,
          });
        s.standings.sort((a, b) => a.rank - b.rank);
        s.status = 'FINISHED';
        s.finishedAt = now;
        delete s.hand;
        this.say('FINISHED', undefined, undefined, now);
        return;
      }
    } else {
      for (const p of s.players)
        if (p.stack === 0) {
          // Bots recompram sozinhos; humanos escolhem quando recomprar.
          if (p.bot) p.stack = s.config.stack;
          else p.sitOut = true;
        }
    }
    const live = this.eligible();
    if (live.length < 2) {
      this.settleIdle();
      return;
    }
    const seats = live.sort((a, b) => a.seat - b.seat);
    const after = seats.find((p) => p.seat > s.button) ?? seats[0];
    s.button = after.seat;
    const level = this.level();
    s.hand = startHand(
      seats.map((p) => ({ id: p.id, seat: p.seat, stack: p.stack })),
      s.button,
      level.small,
      level.big,
      level.ante,
    );
    s.handNo++;
    for (const p of s.players) p.bank = Math.min(TIME_BANK_CAP, (p.bank ?? TIME_BANK_START) + 5000);
    s.deadline = now + s.config.turnSeconds * 1000;
    s.botAt = 0;
    for (const hp of s.hand.players) {
      const p = s.players.find((x) => x.id === hp.id)!;
      p.stack = hp.stack;
    }
    if (s.hand.done) this.afterAction(now);
  }

  /** Avança o relógio: timeouts, bots, próxima mão, pausas e limpeza. */
  tick(now: number, online: ReadonlySet<string>) {
    const s = this.state;
    if (s.closed) return;
    for (const id of online) if (s.members[id]) s.members[id].lastSeen = now;
    const humanOnline = [...online].some((id) => s.members[id]);
    if (humanOnline) s.lastHuman = now;

    // Anfitrião ausente por muito tempo: passa o comando para quem está aqui.
    const host = s.members[s.hostId];
    if (host && !online.has(s.hostId) && now - host.lastSeen > 2 * 60_000) {
      const next = [...online].find((id) => s.members[id]);
      if (next) {
        s.hostId = next;
        this.say('NEW_HOST', { name: s.members[next].nickname }, next, now);
      }
    }

    if (s.status === 'PAUSED' && s.pauseReason === 'EMPTY' && humanOnline) this.resume(now);
    if (s.status === 'RUNNING' && !humanOnline && now - s.lastHuman >= EMPTY_PAUSE_MS)
      this.pause('EMPTY', s.lastHuman + EMPTY_PAUSE_MS);

    if (s.status === 'RUNNING') {
      this.advanceClock(now);
      this.runGame(now);
    }

    // Humanos sentados e ausentes por muito tempo liberam a cadeira.
    if (!s.hand || s.hand.done)
      for (const p of [...s.players])
        if (
          !p.bot &&
          !online.has(p.id) &&
          s.status !== 'FINISHED' &&
          now - (s.members[p.id]?.lastSeen ?? 0) > OFFLINE_SEAT_MS
        )
          this.removeSeat(p.id, now);
  }

  private runGame(now: number) {
    const s = this.state;
    let guard = 0;
    while (s.status === 'RUNNING' && guard++ < 40) {
      const h = s.hand;
      if (!h) {
        if (now < s.nextHandAt) return;
        this.nextHand(now);
        this.touch();
        if (!s.hand) return;
        continue;
      }
      if (h.done) {
        if (now < s.nextHandAt) return;
        this.nextHand(now);
        this.touch();
        continue;
      }
      const actorId = h.actor!;
      const p = s.players.find((x) => x.id === actorId)!;
      if (p.bot) {
        if (!s.botAt) {
          s.botAt = now + 700 + Math.floor(Math.random() * 900);
          this.touch();
        }
        if (now < s.botAt) return;
        const own = h.players.find((x) => x.id === actorId)!;
        const decision = decide(
          {
            cards: [...own.cards],
            board: [...h.board],
            opponents: h.players.filter((x) => x.id !== actorId && !x.folded).length,
            pot: h.players.reduce((sum, x) => sum + x.total, 0),
            bigBlind: h.bigBlind,
            legal: legal(h, actorId),
          },
          p.bot,
          p.botStyle,
        );
        this.apply(actorId, decision.action, decision.amount, now);
        this.touch();
        continue;
      }
      const absent = p.sitOut || p.leaving;
      if (absent || now >= s.deadline) {
        if (!absent) {
          p.timeouts++;
          if (p.timeouts >= 2) {
            p.sitOut = true;
            this.say('AUTO_SIT_OUT', { name: this.nameOf(actorId) }, actorId, now);
          }
        }
        const options = legal(h, actorId);
        this.apply(actorId, options.actions.includes('CHECK') ? 'CHECK' : 'FOLD', undefined, now);
        this.touch();
        continue;
      }
      return;
    }
  }

  /** Próximo instante em que `tick` precisa rodar; null quando nada está agendado. */
  nextWake(now: number, online: ReadonlySet<string>): number | null {
    const s = this.state;
    if (s.closed) return null;
    const times: number[] = [];
    const humanOnline = [...online].some((id) => s.members[id]);
    if (!humanOnline) times.push(s.lastHuman + EMPTY_EXPIRE_MS);
    if (s.status === 'FINISHED') times.push((s.finishedAt ?? now) + FINISHED_EXPIRE_MS);
    if (s.status === 'RUNNING') {
      if (!humanOnline) times.push(s.lastHuman + EMPTY_PAUSE_MS);
      const h = s.hand;
      if (!h || h.done) times.push(s.nextHandAt);
      else {
        const actor = s.players.find((p) => p.id === h.actor);
        if (actor?.bot) times.push(s.botAt || now + 50);
        else times.push(actor && (actor.sitOut || actor.leaving) ? now + 50 : s.deadline);
      }
    }
    if (s.status === 'PAUSED' && s.pauseReason === 'EMPTY')
      times.push(s.lastHuman + EMPTY_EXPIRE_MS);
    const seatsOffline = s.players.filter((p) => !p.bot && !online.has(p.id));
    for (const p of seatsOffline)
      times.push((s.members[p.id]?.lastSeen ?? now) + OFFLINE_SEAT_MS + 1000);
    if (!times.length) return null;
    return Math.max(now + 25, Math.min(...times));
  }

  /** Sala sem ninguém por tempo demais, ou resultado final já velho. */
  isExpired(now: number, online: ReadonlySet<string>) {
    const s = this.state;
    if (s.closed) return true;
    if (s.status === 'FINISHED' && now - (s.finishedAt ?? now) > FINISHED_EXPIRE_MS) return true;
    return ![...online].some((id) => s.members[id]) && now - s.lastHuman > EMPTY_EXPIRE_MS;
  }

  // ----------------------------------------------------------------- vistas

  /** Cartas que `viewer` pode ver de `owner`: as próprias, as mostradas no showdown ou reveladas depois. */
  private visibleCards(viewer: string, owner: string, fromPublic: string[]) {
    const h = this.state.hand;
    if (!h?.done || viewer === owner) return fromPublic;
    const raw = h.players.find((p) => p.id === owner);
    if (!raw) return [];
    const shown = this.state.revealed?.hand === h.id && this.state.revealed.ids.includes(owner);
    return shown || this.showsAtShowdown(h, owner) ? [...raw.cards] : [];
  }

  view(id: string, now: number, online: ReadonlySet<string>) {
    const s = this.state;
    const h = s.hand;
    const pub = h ? publicHand(h, id) : undefined;
    const level = this.level();
    const players = s.players.map((p) => {
      const hp = pub?.players.find((x) => x.id === p.id);
      const profile = p.botProfile ?? s.members[p.id];
      return {
        id: p.id,
        seat: p.seat,
        nickname: profile?.nickname ?? '?',
        avatar: profile?.avatar ?? 'a1',
        bot: p.bot,
        stack: hp?.stack ?? p.stack,
        sitOut: p.sitOut,
        leaving: p.leaving,
        online: !!p.bot || online.has(p.id),
        inHand: !!hp,
        folded: hp?.folded ?? false,
        bet: hp?.bet ?? 0,
        cards: this.visibleCards(id, p.id, hp?.cards ?? []),
        isButton: !!pub && pub.button === p.seat,
        color: profile?.color,
        botStyle: p.botStyle,
        bank: p.bank ?? TIME_BANK_START,
        muck: !!p.muck,
        /** As cartas desta mão estão à mostra para a mesa (showdown ou revelação voluntária). */
        shown:
          !!h?.done &&
          (this.showsAtShowdown(h, p.id) ||
            (this.state.revealed?.hand === h.id && this.state.revealed.ids.includes(p.id))),
      };
    });
    return {
      id: s.id,
      me: id,
      host: s.hostId === id,
      hostId: s.hostId,
      serverNow: now,
      version: s.seq,
      config: s.config,
      locked: !!s.passwordHash,
      status: s.status,
      pauseReason: s.pauseReason,
      level: {
        ...level,
        remainingMs:
          s.config.mode === 'SIT_AND_GO'
            ? (level.index + 1) * s.config.levelMinutes * 60_000 - s.levelElapsed
            : 0,
      },
      handNo: s.handNo,
      players,
      standings: s.standings,
      spectators: Object.values(s.members)
        .filter((m) => online.has(m.id) && !s.players.some((p) => p.id === m.id))
        .map((m) => ({ id: m.id, nickname: m.nickname, avatar: m.avatar })),
      hand: pub
        ? {
            id: pub.id,
            board: pub.board,
            street: pub.street,
            actor: pub.actor,
            done: pub.done,
            showdown: pub.showdown,
            awards: pub.awards,
            pot: pub.pot,
            currentBet: pub.currentBet,
            legal: pub.legal,
            logCount: pub.log.length,
            log: pub.log.slice(-12),
            deadline: s.deadline,
            nextHandAt: pub.done ? s.nextHandAt : 0,
          }
        : undefined,
      chat: s.chat.map((m) => ({
        ...m,
        nickname: m.from ? this.nameOf(m.from) : undefined,
      })),
      emotes: s.emotes,
      history: s.history,
    };
  }

  summary(online: ReadonlySet<string>): LobbyEntry {
    const s = this.state;
    return {
      id: s.id,
      title: s.config.title,
      mode: s.config.mode,
      seats: s.config.seats,
      small: s.config.small,
      big: s.config.big,
      players: s.players.filter((p) => !p.leaving).length,
      bots: s.players.filter((p) => p.bot).length,
      online: [...online].filter((id) => s.members[id]).length,
      status: s.status,
      locked: !!s.passwordHash,
      host: s.members[s.hostId]?.nickname ?? '',
      updated: Date.now(),
    };
  }
}

export function errorCode(e: unknown): ErrorCode {
  if (e instanceof RuleError) return e.code as ErrorCode;
  if ((e as { name?: string })?.name === 'ZodError') return 'VALIDATION';
  return 'INTERNAL';
}
