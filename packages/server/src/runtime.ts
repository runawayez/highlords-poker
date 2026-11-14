import {
  ClientMessageSchema,
  type ErrorCode,
  type LobbyEntry,
  type Profile,
  type PublicConfig,
} from '../../contracts/src/index.ts';
import { RoomEngine, errorCode, type RoomState } from './room.ts';
import { equal, playerIdFromKey, roomPasswordHash } from './security.ts';

export interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
export interface Hub {
  sockets(): { socket: Socket; id?: string }[];
  bind(socket: Socket, id: string): void;
}
export interface RoomStorage {
  load(): Promise<RoomState | null>;
  save(state: RoomState): Promise<void>;
  remove(): Promise<void>;
}
export interface Scheduler {
  set(at: number | null): Promise<void> | void;
}
export interface LobbyPort {
  put(entry: LobbyEntry): void;
  remove(id: string): void;
}
export type RoomInit = {
  config: PublicConfig;
  password?: string;
  salt: string;
  hostKey: string;
  profile: Profile;
};

// Cabe uma foto pequena no HELLO e no PROFILE; o restante das mensagens é curto.
const MAX_MESSAGE = 12_000;
const HEARTBEAT_MS = 60_000;
const SOFT_SAVE_MS = 10_000;

/**
 * Orquestra uma sala: valida mensagens, aplica no `RoomEngine`, persiste e transmite
 * a cada conexão a visão dela. Não depende de Cloudflare nem de Node.
 */
export class RoomRuntime {
  engine: RoomEngine | null = null;
  private lobbyMemo = '';
  private lastLobbyPut = 0;
  private lastSaveAt = 0;
  private lastWake: number | null = null;
  private buckets = new Map<string, { at: number; n: number }>();
  constructor(
    private deps: {
      storage: RoomStorage;
      hub: Hub;
      scheduler: Scheduler;
      lobby: LobbyPort;
      now?: () => number;
      /** Só a mesa local (contra bots, no navegador) aceita bots; salas online nunca. */
      allowBots?: boolean;
    },
  ) {}
  private now() {
    return this.deps.now?.() ?? Date.now();
  }

  async load() {
    const state = await this.deps.storage.load();
    this.engine = state ? new RoomEngine(state) : null;
  }

  /** Cria a sala. Retorna false se este objeto já tem uma sala. */
  async create(id: string, init: RoomInit) {
    if (this.engine) return false;
    const hostId = await playerIdFromKey(init.hostKey);
    const engine = RoomEngine.create(
      {
        id,
        config: init.config,
        passwordHash: init.password ? await roomPasswordHash(init.password, init.salt) : undefined,
        salt: init.salt,
        hostId,
      },
      this.now(),
    );
    engine.admit(hostId, init.profile, this.now());
    this.engine = engine;
    await this.commit();
    return true;
  }

  private online(exclude?: Socket) {
    const ids = new Set<string>();
    for (const c of this.deps.hub.sockets()) if (c.id && c.socket !== exclude) ids.add(c.id);
    return ids;
  }

  private send(socket: Socket, payload: unknown) {
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      /* conexão já fechou */
    }
  }
  private fail(socket: Socket, code: ErrorCode) {
    this.send(socket, { type: 'ERROR', code });
  }

  private limited(id: string) {
    const now = this.now();
    const b = this.buckets.get(id);
    if (!b || now - b.at > 10_000) {
      this.buckets.set(id, { at: now, n: 1 });
      return false;
    }
    return ++b.n > 60;
  }

  /** Uma operação por vez: HELLO (assíncrono) nunca é ultrapassado pela mensagem seguinte. */
  private queue: Promise<void> = Promise.resolve();
  private serial(task: () => Promise<void>) {
    const next = this.queue.then(task, task);
    this.queue = next.catch((error) => console.error('room queue error', error));
    return next;
  }

  message(socket: Socket, raw: string | ArrayBuffer) {
    return this.serial(() => this.handleMessage(socket, raw));
  }

  private async handleMessage(socket: Socket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return socket.close(1003);
    if (raw === 'ping') return this.send(socket, { type: 'PONG' });
    if (raw.length > MAX_MESSAGE) return socket.close(1009);
    const engine = this.engine;
    if (!engine) return this.fail(socket, 'ROOM_NOT_FOUND');
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.fail(socket, 'VALIDATION');
    }
    const parsed = ClientMessageSchema.safeParse(json);
    if (!parsed.success) return this.fail(socket, 'VALIDATION');
    const msg = parsed.data;
    const now = this.now();
    try {
      if (msg.type === 'HELLO') {
        const id = await playerIdFromKey(msg.key);
        if (engine.isBanned(id)) {
          this.fail(socket, 'KICKED');
          return socket.close(4003, 'KICKED');
        }
        if (engine.passwordRequired && !engine.isAdmitted(id)) {
          const ok =
            !!msg.password &&
            equal(
              engine.state.passwordHash!,
              await roomPasswordHash(msg.password, engine.state.salt),
            );
          if (!ok) return this.fail(socket, 'WRONG_PASSWORD');
        }
        engine.admit(id, msg.profile, now);
        this.deps.hub.bind(socket, id);
        engine.tick(now, this.online());
        this.send(socket, { type: 'PHOTOS', data: engine.photos() });
        this.sharePhoto(engine, id, socket);
      } else {
        const entry = this.deps.hub.sockets().find((c) => c.socket === socket);
        if (!entry?.id) return this.fail(socket, 'FORBIDDEN');
        if (this.limited(entry.id)) return this.fail(socket, 'RATE_LIMIT');
        if (msg.type === 'ADD_BOT' && !this.deps.allowBots) return this.fail(socket, 'FORBIDDEN');
        engine.command(entry.id, msg, now);
        engine.tick(now, this.online());
        if (msg.type === 'PROFILE') this.sharePhoto(engine, entry.id);
      }
    } catch (e) {
      const code = errorCode(e);
      if (code === 'INTERNAL') console.error('room error', e);
      return this.fail(socket, code);
    }
    // Chat e emote não precisam gravar a cada envio: entram no próximo salvamento.
    await this.commit(undefined, msg.type === 'CHAT' || msg.type === 'EMOTE' ? 'soft' : 'now');
  }

  /** Avisa os outros que a foto de `id` mudou (a própria conexão já recebeu o mapa completo). */
  private sharePhoto(engine: RoomEngine, id: string, except?: Socket) {
    const data = engine.photos(id);
    for (const c of this.deps.hub.sockets())
      if (c.id && c.socket !== except) this.send(c.socket, { type: 'PHOTOS', data });
  }

  close(socket: Socket) {
    return this.serial(() => this.handleClose(socket));
  }

  private async handleClose(socket: Socket) {
    if (!this.engine) return;
    this.engine.tick(this.now(), this.online(socket));
    await this.commit(socket);
  }

  alarm() {
    return this.serial(() => this.handleAlarm());
  }

  private async handleAlarm() {
    const engine = this.engine;
    if (!engine) return;
    // O alarme que acabou de disparar não está mais pendente (mesmo que o relógio chegue
    // um pouco antes do horário marcado).
    this.lastWake = null;
    const now = this.now();
    const online = this.online();
    engine.tick(now, online);
    if (engine.isExpired(now, online)) return this.destroy();
    await this.commit(undefined, 'alarm');
  }

  /** Persiste, transmite e reagenda. */
  private async commit(closing?: Socket, mode: 'now' | 'soft' | 'alarm' = 'now') {
    const engine = this.engine;
    if (!engine) return;
    const now = this.now();
    if (engine.state.closed) return this.destroy();
    // Chutados saem da sala.
    for (const c of this.deps.hub.sockets())
      if (c.id && engine.isBanned(c.id)) {
        this.fail(c.socket, 'KICKED');
        c.socket.close(4003, 'KICKED');
      }
    // Chat e jogadas de bot (acordadas do relógio) gravam no máximo a cada 10 s. Ação de humano,
    // fim de mão e mudanças estruturais gravam na hora, para nunca perder uma jogada.
    const hand = engine.state.hand;
    const botOnTurn =
      mode === 'alarm' &&
      engine.state.status === 'RUNNING' &&
      !!hand &&
      !hand.done &&
      !!engine.state.players.find((p) => p.id === hand.actor)?.bot;
    if (!(mode === 'soft' || botOnTurn) || now - this.lastSaveAt >= SOFT_SAVE_MS) {
      await this.deps.storage.save(engine.state);
      this.lastSaveAt = now;
    }
    const online = this.online(closing);
    for (const c of this.deps.hub.sockets()) {
      if (!c.id || c.socket === closing) continue;
      this.send(c.socket, { type: 'STATE', data: engine.view(c.id, now, online) });
    }
    this.publishLobby(online, now);
    const wake = engine.nextWake(now, online);
    const cap = online.size ? now + HEARTBEAT_MS : null;
    const target = wake && cap ? Math.min(wake, cap) : (wake ?? cap);
    // Já existe um alarme pendente igual ou mais cedo: regravar só gastaria cota.
    const pending = this.lastWake !== null && this.lastWake > now;
    if (target === null ? this.lastWake !== null : !(pending && target >= this.lastWake!)) {
      this.lastWake = target;
      await this.deps.scheduler.set(target);
    }
  }

  private publishLobby(online: ReadonlySet<string>, now: number) {
    const engine = this.engine!;
    if (!engine.state.config.isPublic) return;
    const entry = engine.summary(online);
    const memo = JSON.stringify({ ...entry, updated: 0 });
    // Só reenvia quando algo mudou, ou a cada 60 s para renovar o prazo da entrada.
    if (memo !== this.lobbyMemo || now - this.lastLobbyPut >= HEARTBEAT_MS - 1000) {
      this.lobbyMemo = memo;
      this.lastLobbyPut = now;
      this.deps.lobby.put({ ...entry, updated: now });
    }
  }

  info(): LobbyEntry | null {
    return this.engine ? this.engine.summary(this.online()) : null;
  }

  private async destroy() {
    const engine = this.engine;
    this.engine = null;
    for (const c of this.deps.hub.sockets()) {
      this.send(c.socket, { type: 'CLOSED' });
      c.socket.close(1000, 'CLOSED');
    }
    if (engine) this.deps.lobby.remove(engine.state.id);
    await this.deps.storage.remove();
    await this.deps.scheduler.set(null);
  }
}
