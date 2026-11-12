import {
  ChatSchema,
  CommandSchema,
  ConfigSchema,
  ProfileSchema,
  type Config,
  type Profile,
} from '../../contracts/src/index.ts';
import {
  act,
  startHand,
  publicHand,
  legal,
  demand,
  RuleError,
  type Hand,
  type Action,
} from '../../poker-engine/src/index.ts';
import { decide, type Difficulty } from '../../poker-bot/src/index.ts';
import { balance, levelAt, prizes } from '../../tournament-engine/src/index.ts';
import { hash, passwordHash, secret, equal } from './security.ts';
export type Session = { id: string; hash: string; profile: Profile; seen: number; expires: number };
type Player = {
  bot?: { difficulty: Difficulty; profile: Profile };
  id: string;
  seat: number;
  stack: number;
  sitOut: boolean;
  left: boolean;
  rebuyCount: number;
  addOn: boolean;
  bank: number;
  rank?: number;
  eliminatedAt?: number;
};
type Table = {
  id: string;
  ids: string[];
  button: number;
  hand?: Hand;
  deadline: number;
  next: number;
  bankUsed: boolean;
};
type Message = {
  id: string;
  player: string;
  text?: string;
  code?: string;
  at: number;
  reactions: Record<string, string[]>;
};
export type Room = {
  id: string;
  config: Omit<Config, 'password'>;
  password?: string;
  salt: string;
  host: string;
  created: number;
  updated: number;
  version: number;
  status: 'WAITING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'EXPIRED';
  players: Player[];
  spectators: string[];
  tables: Table[];
  chat: Message[];
  muted: Record<string, number>;
  banned: Record<string, number>;
  reports: { player: string; target: string; text: string; at: number }[];
  receipts: Record<string, { actor: string; result: unknown }>;
  elapsed: number;
  clock: number;
  pool: number;
  payouts: Record<string, number>;
  history: ReturnType<typeof publicHand>[];
  pauseReason?: string;
  presence?: Record<string, number>;
  finishedAt?: number;
  expiredAt?: number;
};
export type State = {
  schema: 1;
  sessions: Session[];
  rooms: Room[];
  chat: Message[];
  lobbyReceipts: string[];
  budget?: { day: string; writes: number };
};
export interface Store {
  load(): Promise<State | null>;
  save(state: State): Promise<void>;
}
const empty = (): State => ({ schema: 1, sessions: [], rooms: [], chat: [], lobbyReceipts: [] });
const uuid = () => crypto.randomUUID();
const now = () => Date.now();
export const PRESENCE_TTL = 60_000;
export const EMPTY_ROOM_TTL = 30 * 60_000;
export const FINISHED_ROOM_TTL = 60 * 60_000;
export class PokerService {
  state: State = empty();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private store: Store,
    private options = { maxRooms: 30, maintenance: false },
  ) {}
  async init() {
    this.state = (await this.store.load()) ?? empty();
    demand(this.state.schema === 1, 'SCHEMA_MISMATCH');
    // Upgrade old saved rooms without discarding sessions or game state.
    for (const room of this.state.rooms) {
      room.presence ??= Object.fromEntries(
        this.state.sessions
          .filter(
            (s) =>
              room.players.some((p) => !p.bot && p.id === s.id) || room.spectators.includes(s.id),
          )
          .map((s) => [s.id, s.seen]),
      );
      if (room.status === 'FINISHED') room.finishedAt ??= room.updated;
    }
  }
  private transaction<T>(fn: (s: State) => Promise<T> | T, skipUnchanged = false): Promise<T> {
    const job = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = await fn(draft);
      if (skipUnchanged && JSON.stringify(draft) === JSON.stringify(this.state)) return result;
      const day = new Date().toISOString().slice(0, 10);
      draft.budget = { day, writes: (draft.budget?.day === day ? draft.budget.writes : 0) + 1 };
      demand(draft.budget.writes <= 40000, 'MAINTENANCE');
      demand(new TextEncoder().encode(JSON.stringify(draft)).length < 6 * 1024 * 1024, 'CAPACITY');
      await this.store.save(draft);
      this.state = draft;
      return result;
    });
    this.queue = job.catch(() => {});
    return job;
  }
  private session(s: State, token: string) {
    const session = s.sessions.find((p) => equal(p.hash, token));
    demand(session && session.expires > now(), 'SESSION_EXPIRED');
    return session;
  }
  async authenticate(token: string) {
    return this.session(this.state, await hash(token)).id;
  }
  async openSession(profile: unknown, token?: string) {
    const parsed = ProfileSchema.parse(profile);
    const tokenHash = token ? await hash(token) : '';
    return this.transaction(async (s) => {
      let p = tokenHash
        ? s.sessions.find((p) => equal(p.hash, tokenHash) && p.expires > now())
        : undefined;
      let credential = token;
      if (!p) {
        demand(!this.options.maintenance, 'MAINTENANCE');
        s.sessions = s.sessions.filter((p) => p.expires > now());
        demand(s.sessions.length < 500, 'CAPACITY');
        credential = secret();
        p = {
          id: uuid(),
          hash: await hash(credential),
          profile: parsed,
          seen: now(),
          expires: now() + 7 * 86400000,
        };
        s.sessions.push(p);
      }
      p.profile = parsed;
      p.seen = now();
      p.expires = now() + 7 * 86400000;
      return { token: credential!, playerId: p.id };
    });
  }
  private humanOnline(r: Room, id: string, time = now()) {
    const session = this.state.sessions.find((s) => s.id === id);
    return !!session && session.expires > time && time - (r.presence?.[id] ?? 0) < PRESENCE_TTL;
  }
  private hasHuman(r: Room, time = now()) {
    return (
      r.players.some((p) => !p.bot && !p.left && this.humanOnline(r, p.id, time)) ||
      r.spectators.some((id) => this.humanOnline(r, id, time))
    );
  }
  private pauseEmpty(r: Room, time = now()) {
    if (r.status !== 'RUNNING' || this.hasHuman(r, time)) return false;
    const pausedAt = Math.min(time, this.lastPresence(r) + PRESENCE_TTL);
    r.elapsed += Math.max(0, pausedAt - r.clock);
    r.status = 'PAUSED';
    r.pauseReason = 'EMPTY';
    r.clock = pausedAt;
    r.version++;
    return true;
  }
  private lastPresence(r: Room) {
    // Presence only belongs to authenticated humans; bots never heartbeat.
    return Math.max(r.created, ...Object.values(r.presence ?? {}));
  }
  private expiryAt(r: Room) {
    return r.status === 'FINISHED'
      ? (r.finishedAt ?? r.updated) + FINISHED_ROOM_TTL
      : this.lastPresence(r) + PRESENCE_TTL + EMPTY_ROOM_TTL;
  }
  private available(r: Room) {
    return r.status !== 'EXPIRED' && now() < this.expiryAt(r);
  }
  private expire(r: Room, time: number) {
    r.status = 'EXPIRED';
    r.expiredAt = time;
    r.updated = time;
    r.tables = [];
    r.chat = [];
    r.history = [];
    r.receipts = {};
    r.players = [];
    r.spectators = [];
    r.presence = {};
    r.reports = [];
    r.payouts = {};
  }
  async heartbeat(token: string, roomId?: string) {
    const h = await hash(token);
    const session = this.session(this.state, h);
    const room = roomId ? this.state.rooms.find((r) => r.id === roomId) : undefined;
    if (roomId) {
      demand(room && this.available(room), 'ROOM_NOT_FOUND');
      demand(
        room.players.some((p) => p.id === session.id && !p.left) ||
          room.spectators.includes(session.id),
        'JOIN_REQUIRED',
      );
      demand(!(room.banned[session.id] > now()), 'BANNED');
    }
    if (
      now() - session.seen < 15000 &&
      (!room || now() - (room.presence?.[session.id] ?? 0) < 15000)
    )
      return;
    await this.transaction((s) => {
      const current = this.session(s, h);
      current.seen = now();
      if (roomId) {
        const currentRoom = s.rooms.find((r) => r.id === roomId)!;
        demand(currentRoom && this.available(currentRoom), 'ROOM_NOT_FOUND');
        demand(
          currentRoom.players.some((p) => p.id === current.id && !p.left) ||
            currentRoom.spectators.includes(current.id),
          'JOIN_REQUIRED',
        );
        demand(!(currentRoom.banned[current.id] > now()), 'BANNED');
        this.pauseEmpty(currentRoom);
        (currentRoom.presence ??= {})[current.id] = now();
      }
    });
  }
  lobby() {
    return this.state.rooms
      .filter((r) => this.available(r))
      .map((r) => ({
        id: r.id,
        title: r.config.title,
        hostProfile: (() => {
          const profile = this.state.sessions.find((session) => session.id === r.host)?.profile;
          return profile ? { nickname: profile.nickname, avatar: profile.avatar } : undefined;
        })(),
        playerProfiles: r.players
          .filter((player) => !player.left)
          .slice(0, 5)
          .map((player) => {
            const profile =
              player.bot?.profile ??
              this.state.sessions.find((session) => session.id === player.id)?.profile;
            return profile ? { nickname: profile.nickname, avatar: profile.avatar } : undefined;
          }),
        mode: r.config.mode,
        seats: r.config.seats,
        capacity: r.config.mode === 'TOURNAMENT' ? r.config.capacity : r.config.seats,
        players: r.players.filter((p) => !p.left).length,
        humansOnline: r.players.filter((p) => !p.bot && !p.left && this.humanOnline(r, p.id))
          .length,
        humansOffline: r.players.filter((p) => !p.bot && !p.left && !this.humanOnline(r, p.id))
          .length,
        bots: r.players.filter((p) => p.bot && !p.left).length,
        spectatorsOnline: r.spectators.filter((id) => this.humanOnline(r, id)).length,
        status: r.status,
        protected: !!r.password,
        small: r.config.small,
        big: r.config.big,
        version: r.version,
      }));
  }
  async snapshot(roomId: string, token: string) {
    const id = await this.authenticate(token);
    const r = this.state.rooms.find((r) => r.id === roomId && this.available(r));
    demand(r, 'ROOM_NOT_FOUND');
    demand(
      r.players.some((p) => p.id === id && !p.left) || r.spectators.includes(id),
      'JOIN_REQUIRED',
    );
    demand(!(r.banned[id] > now()), 'BANNED');
    return this.view(r, id);
  }
  private view(r: Room, id: string) {
    const level = this.level(r);
    return {
      id: r.id,
      botsSupported: true,
      closeSupported: true,
      expiresAt: r.status === 'FINISHED' || !this.hasHuman(r) ? this.expiryAt(r) : undefined,
      config: r.config,
      status: r.status,
      version: r.version,
      host: r.host === id,
      me: id,
      level,
      elapsed: r.elapsed,
      pool: r.pool,
      payouts: r.payouts,
      pauseReason: r.pauseReason,
      players: r.players.map((p) => ({
        ...p,
        profile: p.bot?.profile ?? this.state.sessions.find((s) => s.id === p.id)?.profile,
        online: !p.left && (!!p.bot || this.humanOnline(r, p.id)),
        muted: r.muted[p.id] > now(),
      })),
      tables: r.tables.map((t) => ({
        id: t.id,
        ids: t.ids,
        deadline: t.deadline,
        hand: t.hand ? publicHand(t.hand, id) : undefined,
      })),
      chat: r.chat.map((m) => ({
        ...m,
        profile:
          r.players.find((p) => p.id === m.player)?.bot?.profile ??
          this.state.sessions.find((s) => s.id === m.player)?.profile,
      })),
      history: r.history,
    };
  }
  private level(r: Room) {
    return r.config.mode === 'CASH'
      ? {
          index: 0,
          small: r.config.small,
          big: r.config.big,
          ante: r.config.ante,
          break: false,
          remaining: 0,
        }
      : levelAt({ ...r.config, password: '' }, r.elapsed);
  }
  private message(r: Room, code: string, player = '') {
    r.chat.push({ id: uuid(), player, code, at: now(), reactions: {} });
    r.chat = r.chat.slice(-100);
  }
  async command(token: string, input: unknown) {
    const c = CommandSchema.parse(input);
    const tokenHash = await hash(token);
    return this.transaction(async (s) => {
      const me = this.session(s, tokenHash);
      me.seen = now();
      demand(!this.options.maintenance, 'MAINTENANCE');
      if (c.type === 'CREATE') {
        const duplicate = s.rooms.find((r) => r.receipts[c.id]?.actor === me.id);
        if (duplicate) return duplicate.receipts[c.id].result;
        demand(s.rooms.filter((r) => this.available(r)).length < this.options.maxRooms, 'CAPACITY');
        demand(
          s.rooms.filter((r) => r.host === me.id && this.available(r)).length < 3,
          'RATE_LIMIT',
        );
        const cfg = ConfigSchema.parse(c.payload.config);
        const salt = secret();
        const { password, ...config } = cfg;
        const r: Room = {
          id: uuid(),
          config,
          password: password ? await passwordHash(password, salt) : undefined,
          salt,
          host: me.id,
          created: now(),
          updated: now(),
          version: 1,
          status: 'WAITING',
          players: [],
          spectators: [],
          tables: [],
          chat: [],
          muted: {},
          banned: {},
          reports: [],
          receipts: {},
          elapsed: 0,
          clock: now(),
          pool: 0,
          payouts: {},
          history: [],
          presence: { [me.id]: now() },
        };
        this.join(r, me.id);
        s.rooms.push(r);
        const result = { roomId: r.id };
        r.receipts[c.id] = { actor: me.id, result };
        return result;
      }
      demand(c.roomId, 'ROOM_NOT_FOUND');
      const r = s.rooms.find((r) => r.id === c.roomId);
      demand(r, 'ROOM_NOT_FOUND');
      const receipt = r.receipts[c.id];
      if (receipt) {
        demand(receipt.actor === me.id, 'FORBIDDEN');
        return receipt.result;
      }
      demand(this.available(r), 'ROOM_NOT_FOUND');
      demand(!(r.banned[me.id] > now()), 'BANNED');
      const joining = c.type === 'JOIN' || c.type === 'SPECTATE';
      const member = r.players.find((p) => p.id === me.id && !p.left);
      if (!joining) demand(member || r.spectators.includes(me.id), 'JOIN_REQUIRED');
      // Pausing is a host intent independent of which player just acted.
      // Keep optimistic version checks for bets and chip/seat mutations.
      if (
        ![
          'JOIN',
          'SPECTATE',
          'CHAT',
          'REACT',
          'REPORT',
          'EXPORT',
          'PAUSE',
          'RESUME',
          'CLOSE_ROOM',
        ].includes(c.type)
      )
        demand(c.version === r.version, 'STALE_VERSION');
      let result: unknown = { ok: true };
      if (joining) {
        if (r.password)
          demand(
            equal(r.password, await passwordHash(String(c.payload.password ?? ''), r.salt)),
            'INVALID_PASSWORD',
          );
        if (c.type === 'JOIN') {
          this.join(r, me.id, c.payload.buyIn as number | undefined);
          r.spectators = r.spectators.filter((x) => x !== me.id);
        } else if (!member && !r.spectators.includes(me.id)) {
          demand(r.spectators.length < 20, 'CAPACITY');
          r.spectators.push(me.id);
        }
      } else if (c.type === 'ADD_BOTS') {
        demand(r.host === me.id, 'FORBIDDEN');
        demand(r.status === 'WAITING', 'INVALID_ACTION');
        const difficulty = c.payload.difficulty as Difficulty;
        demand(['EASY', 'MEDIUM', 'HARD'].includes(difficulty), 'VALIDATION');
        const count = c.payload.count as number;
        demand(Number.isInteger(count) && count >= 1 && count <= 8, 'VALIDATION');
        demand(r.players.filter((p) => p.bot && !p.left).length + count <= 8, 'CAPACITY');
        for (let i = 0; i < count; i++) {
          const id = uuid();
          this.join(r, id);
          const player = r.players.find((p) => p.id === id)!;
          player.bot = {
            difficulty,
            profile: {
              nickname:
                'Highlord Bot ' +
                (['Dante', 'Raven', 'Vega', 'Nox', 'Luna', 'Atlas', 'Iris', 'Drake'].find(
                  (name) =>
                    !r.players.some((p) => p.bot?.profile.nickname === 'Highlord Bot ' + name),
                ) ?? id.slice(0, 4)),
              avatar: (['♠', '♥', '♣', '♦'] as const)[r.players.filter((p) => p.bot).length % 4],
              frame: 'plain',
              accent: '#df3449',
              tagline: '',
            },
          };
        }
      } else if (c.type === 'REMOVE_BOT') {
        demand(r.host === me.id, 'FORBIDDEN');
        demand(r.status === 'WAITING', 'INVALID_ACTION');
        const player = r.players.find((p) => p.id === c.payload.target && p.bot && !p.left);
        demand(player, 'INVALID_ACTION');
        r.players = r.players.filter((p) => p.id !== player.id);
        r.pool -= r.config.buyIn;
      } else if (c.type === 'CLOSE_ROOM') {
        demand(r.host === me.id, 'FORBIDDEN');
        this.expire(r, now());
      } else if (c.type === 'START') {
        demand(r.host === me.id, 'FORBIDDEN');
        demand(r.status === 'WAITING', 'INVALID_ACTION');
        demand(r.players.filter((p) => !p.left).length >= 2, 'NEED_PLAYERS');
        r.status = 'RUNNING';
        r.clock = now();
        this.deal(r);
        this.message(r, 'STARTED');
      } else if (c.type === 'PAUSE' || c.type === 'RESUME') {
        demand(r.host === me.id, 'FORBIDDEN');
        demand(r.status === (c.type === 'PAUSE' ? 'RUNNING' : 'PAUSED'), 'INVALID_ACTION');
        if (c.type === 'PAUSE') {
          r.elapsed += now() - r.clock;
          r.status = 'PAUSED';
          r.clock = now();
          r.pauseReason = 'HOST';
        } else {
          const gap = now() - r.clock;
          for (const t of r.tables) t.deadline += gap;
          r.clock = now();
          r.status = 'RUNNING';
          delete r.pauseReason;
        }
      } else if (c.type === 'ACT') {
        demand(member && r.status === 'RUNNING', 'INVALID_ACTION');
        const t = r.tables.find((t) => t.ids.includes(me.id));
        demand(t?.hand && !t.hand.done, 'INVALID_ACTION');
        act(t.hand, me.id, c.payload.action as Action, c.payload.amount as number);
        this.afterAction(r, t);
      } else if (c.type === 'TIME_BANK') {
        demand(member && member.bank > 0 && r.status === 'RUNNING', 'INVALID_ACTION');
        const t = r.tables.find((t) => t.hand?.actor === me.id);
        demand(t && !t.bankUsed, 'INVALID_ACTION');
        t.deadline += member.bank * 1000;
        member.bank = 0;
        t.bankUsed = true;
      } else if (c.type === 'SIT_OUT') {
        demand(member && r.config.mode === 'CASH', 'INVALID_ACTION');
        member.sitOut = !member.sitOut;
      } else if (c.type === 'LEAVE') {
        if (member) {
          member.sitOut = true;
          member.left = true;
          if (!r.tables.some((t) => t.hand && !t.hand.done && t.ids.includes(me.id)))
            member.stack = 0;
        }
        r.spectators = r.spectators.filter((x) => x !== me.id);
      } else if (c.type === 'TOP_UP' || c.type === 'ADD_ON') {
        demand(member, 'INVALID_ACTION');
        demand(
          !r.tables.some((t) => t.hand && !t.hand.done && t.ids.includes(me.id)),
          'HAND_IN_PROGRESS',
        );
        const lv = this.level(r);
        if (c.type === 'ADD_ON') {
          demand(
            r.config.mode !== 'CASH' &&
              lv.index === r.config.addOnLevel &&
              !member.addOn &&
              member.stack > 0,
            'INVALID_ACTION',
          );
          member.stack += r.config.addOn;
          member.addOn = true;
          r.pool += r.config.buyIn;
        } else {
          const amount = c.payload.amount as number;
          demand(Number.isSafeInteger(amount) && amount > 0, 'INVALID_STACK');
          if (r.config.mode === 'CASH') {
            demand(r.config.rebuy, 'INVALID_ACTION');
            demand(
              amount >= r.config.minBuyIn && member.stack + amount <= r.config.maxBuyIn,
              'INVALID_STACK',
            );
            member.stack += amount;
          } else {
            demand(
              r.config.rebuy &&
                lv.index <= r.config.rebuyUntil &&
                member.stack === 0 &&
                member.rebuyCount < r.config.rebuyLimit &&
                r.status !== 'FINISHED',
              'INVALID_ACTION',
            );
            member.stack = r.config.stack;
            member.rebuyCount++;
            r.pool += r.config.buyIn;
            delete member.rank;
            delete member.eliminatedAt;
          }
        }
      } else if (c.type === 'CHAT') {
        demand(!(r.muted[me.id] > now()), 'MUTED');
        const text = ChatSchema.parse(c.payload.text);
        demand(
          !r.chat.some((m) => m.player === me.id && !m.code && now() - m.at < 1500),
          'RATE_LIMIT',
        );
        r.chat.push({ id: uuid(), player: me.id, text, at: now(), reactions: {} });
        r.chat = r.chat.slice(-100);
      } else if (c.type === 'REACT') {
        const m = r.chat.find((m) => m.id === c.payload.messageId);
        demand(m, 'INVALID_ACTION');
        const emoji = String(c.payload.emoji);
        demand(['👍', '🔥', '😂', '♥'].includes(emoji));
        const list = m.reactions[emoji] ?? [];
        m.reactions[emoji] = list.includes(me.id)
          ? list.filter((x) => x !== me.id)
          : [...list, me.id].slice(-90);
      } else if (c.type === 'MODERATE') {
        demand(r.host === me.id, 'FORBIDDEN');
        const target = String(c.payload.target);
        demand(target !== r.host && r.players.some((p) => p.id === target), 'INVALID_ACTION');
        if (c.payload.action === 'MUTE') r.muted[target] = now() + 600000;
        else {
          demand(['KICK', 'BAN'].includes(String(c.payload.action)));
          r.banned[target] = now() + (c.payload.action === 'BAN' ? 86400000 : 60000);
          const p = r.players.find((p) => p.id === target)!;
          p.left = true;
          p.sitOut = true;
          r.spectators = r.spectators.filter((x) => x !== target);
        }
      } else if (c.type === 'REPORT') {
        demand(!r.reports.some((x) => x.player === me.id && now() - x.at < 60000), 'RATE_LIMIT');
        r.reports.push({
          player: me.id,
          target: String(c.payload.target).slice(0, 64),
          text: ChatSchema.parse(c.payload.text),
          at: now(),
        });
        r.reports = r.reports.slice(-100);
      } else if (c.type === 'EXPORT') {
        demand(r.host === me.id, 'FORBIDDEN');
        result = {
          room: this.view(r, ''),
          reports: r.reports,
          policy: 'public-v1; secret deck, credentials and unrevealed hole cards excluded',
        };
      }
      if (r.status !== 'EXPIRED') (r.presence ??= {})[me.id] = now();
      r.updated = now();
      r.version++;
      r.chat = r.chat.filter((m) => now() - m.at < 3600000);
      r.receipts[c.id] = { actor: me.id, result };
      const entries = Object.entries(r.receipts);
      if (entries.length > 500) r.receipts = Object.fromEntries(entries.slice(-500));
      return result;
    });
  }
  private join(r: Room, id: string, buyIn?: number) {
    demand(r.status !== 'FINISHED', 'REGISTRATION_CLOSED');
    const old = r.players.find((p) => p.id === id);
    if (old && !old.left) return;
    demand(!old, 'REGISTRATION_CLOSED');
    demand(
      r.players.filter((p) => !p.left).length <
        (r.config.mode === 'TOURNAMENT' ? r.config.capacity : r.config.seats),
      'ROOM_FULL',
    );
    if (r.status !== 'WAITING' && r.config.mode !== 'CASH')
      demand(
        r.config.mode === 'TOURNAMENT' && this.level(r).index < r.config.lateLevels,
        'REGISTRATION_CLOSED',
      );
    if (buyIn !== undefined)
      demand(
        r.config.mode === 'CASH' &&
          Number.isSafeInteger(buyIn) &&
          buyIn >= r.config.minBuyIn &&
          buyIn <= r.config.maxBuyIn,
        'INVALID_STACK',
      );
    r.players.push({
      id,
      seat: r.players.length % 9,
      stack: buyIn ?? r.config.stack,
      sitOut: false,
      left: false,
      rebuyCount: 0,
      addOn: false,
      bank: r.config.timeBank,
    });
    r.pool += r.config.buyIn;
    this.message(r, 'JOINED', id);
  }
  private deal(r: Room) {
    const live = r.players.filter(
      (p) => !p.left && p.stack > 0 && (r.config.mode !== 'CASH' || !p.sitOut),
    );
    if (live.length < 2) return;
    const assignments = balance(
      live.map((p) => p.id),
      r.config.seats,
    );
    const level = this.level(r);
    if (level.break) return;
    r.tables = assignments.map((ids, i) => {
      const previous = r.tables[i];
      const players = ids.map((id, seat) => ({
        id,
        seat,
        stack: r.players.find((p) => p.id === id)!.stack,
      }));
      const button = previous ? (previous.button + 1) % ids.length : 0;
      const hand =
        ids.length >= 2
          ? startHand(players, button, level.small, level.big, level.ante)
          : undefined;
      return {
        id: `table-${i + 1}`,
        ids,
        button,
        hand,
        deadline: now() + r.config.turnSeconds * 1000,
        next: 0,
        bankUsed: false,
      };
    });
    for (const t of r.tables) {
      if (t.hand?.done) this.afterAction(r, t);
      else this.sync(r, t);
    }
  }
  private sync(r: Room, t: Table) {
    if (t.hand)
      for (const hp of t.hand.players) {
        const p = r.players.find((p) => p.id === hp.id)!;
        p.stack = hp.stack;
      }
  }
  private afterAction(r: Room, t: Table) {
    this.sync(r, t);
    t.deadline = now() + r.config.turnSeconds * 1000;
    t.bankUsed = false;
    if (t.hand?.done) {
      t.next = now() + 8000;
      const publicView = publicHand(t.hand);
      r.history.push({
        ...publicView,
        players: publicView.players.map((p) => ({
          ...p,
          cards: t.hand!.showdown && !p.folded ? p.cards : [],
        })),
      });
      r.history = r.history.slice(-30);
      this.message(r, 'HAND_FINISHED');
    }
  }
  async tick() {
    return this.transaction((s) => {
      let changed = false;
      const time = now();
      for (const r of s.rooms) {
        if (r.status === 'EXPIRED') continue;
        if (time >= this.expiryAt(r)) {
          this.expire(r, time);
          r.version++;
          changed = true;
          continue;
        }
        if (r.status !== 'RUNNING') continue;
        changed = true;
        const gameState = () =>
          JSON.stringify({
            tables: r.tables,
            players: r.players,
            status: r.status,
            level: this.level(r).index,
            break: this.level(r).break,
          });
        const beforeGame = gameState();
        if (this.pauseEmpty(r, time)) continue;
        r.elapsed += time - r.clock;
        r.clock = time;
        for (const t of r.tables) {
          if (!t.hand || t.hand.done) continue;
          const p = r.players.find((p) => p.id === t.hand!.actor);
          if (p?.bot && !p.left && !p.sitOut) {
            const own = t.hand.players.find((hp) => hp.id === p.id)!;
            const decision = decide(
              {
                cards: [...own.cards],
                board: [...t.hand.board],
                opponents: t.hand.players.filter((hp) => hp.id !== p.id && !hp.folded).length,
                pot: t.hand.players.reduce((sum, hp) => sum + hp.total, 0),
                bigBlind: t.hand.bigBlind,
                legal: legal(t.hand, p.id),
              },
              p.bot.difficulty,
            );
            act(t.hand, p.id, decision.action, decision.amount);
            this.afterAction(r, t);
          } else if (p && (time >= t.deadline || p.left || p.sitOut)) {
            const opts = legal(t.hand, p.id);
            act(t.hand, p.id, opts.actions.includes('CHECK') ? 'CHECK' : 'FOLD');
            this.afterAction(r, t);
          }
        }
        if (
          r.tables.every((t) => !t.hand || t.hand.done) &&
          r.tables.every((t) => time >= t.next)
        ) {
          if (r.config.mode !== 'CASH') {
            const busted = r.players.filter((p) => !p.left && p.stack === 0 && !p.eliminatedAt);
            const alive = r.players.filter((p) => !p.left && p.stack > 0);
            busted
              .sort((a, b) => a.id.localeCompare(b.id))
              .forEach((p) => {
                p.eliminatedAt = time;
              });
            r.players
              .filter((p) => !p.left && p.eliminatedAt)
              .sort((a, b) => b.eliminatedAt! - a.eliminatedAt! || a.id.localeCompare(b.id))
              .forEach((p, i) => {
                p.rank = alive.length + i + 1;
              });
            const rebuyWaiting = r.players.some(
              (p) =>
                !p.left &&
                p.stack === 0 &&
                r.config.rebuy &&
                this.level(r).index <= r.config.rebuyUntil &&
                p.rebuyCount < r.config.rebuyLimit &&
                time - (p.eliminatedAt ?? time) < 60000,
            );
            if (alive.length <= 1 && !rebuyWaiting) {
              r.status = 'FINISHED';
              r.finishedAt = time;
              if (alive[0]) alive[0].rank = 1;
              const order = r.players
                .filter((p) => !p.left)
                .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                .map((p) => p.id);
              r.payouts = order.length ? prizes(r.pool, order) : {};
              r.updated = time;
              this.message(r, 'TOURNAMENT_FINISHED');
            } else if (!rebuyWaiting) this.deal(r);
          } else this.deal(r);
        }
        if (gameState() !== beforeGame) r.version++;
      }
      s.rooms = s.rooms.filter(
        (r) => r.status !== 'EXPIRED' || time - (r.expiredAt ?? r.updated) < FINISHED_ROOM_TTL,
      );
      s.chat = s.chat.filter((m) => time - m.at < 3600000);
      return changed;
    }, true);
  }
}
export function errorCode(e: unknown) {
  return e instanceof RuleError
    ? e.code
    : (e as { name?: string })?.name === 'ZodError'
      ? 'VALIDATION'
      : 'INTERNAL';
}
