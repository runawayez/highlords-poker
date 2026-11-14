import { ConfigSchema, type Profile } from '../../../packages/contracts/src/index.ts';
import { LOCAL_ROOM_CODE } from './net.ts';
import { RoomRuntime, type Socket } from '../../../packages/server/src/runtime.ts';

export type LocalWire = { readyState: number; send(data: string): void; close(): void };

/**
 * Sobe uma sala de verdade (`RoomRuntime`) dentro da página: o armazenamento é a memória, o
 * relógio é `setTimeout` e a "conexão" é uma chamada de função. Nada sai da máquina.
 */
export async function startLocalRoom(options: {
  title: string;
  hostKey: string;
  profile: Profile;
  onMessage: (raw: string) => void;
}): Promise<LocalWire> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let stored: unknown = null;
  const sockets: { socket: Socket; id?: string }[] = [];
  const socket: Socket = {
    send: (data) => {
      if (!stopped) options.onMessage(data);
    },
    close: () => {},
  };
  sockets.push({ socket });
  const runtime: RoomRuntime = new RoomRuntime({
    allowBots: true,
    storage: {
      load: async () => null,
      save: async (state) => {
        stored = state;
      },
      remove: async () => {
        stored = null;
      },
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
        clearTimeout(timer);
        if (at === null || stopped) return;
        timer = setTimeout(() => void runtime.alarm(), Math.max(0, at - Date.now()));
      },
    },
    lobby: { put: () => {}, remove: () => {} },
  });
  void stored;
  const { password, ...config } = ConfigSchema.parse({
    title: options.title,
    mode: 'CASH',
    seats: 6,
    stack: 2000,
    small: 10,
    big: 20,
    botPace: 'CALM',
    isPublic: false,
  });
  void password;
  await runtime.create(LOCAL_ROOM_CODE, {
    config,
    salt: 'local',
    hostKey: options.hostKey,
    profile: options.profile,
  });
  return {
    readyState: 1,
    send: (data) => void runtime.message(socket, data),
    close: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
