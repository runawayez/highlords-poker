import { useSyncExternalStore } from 'react';
import { AVATARS, type Profile } from '../../../packages/contracts/src/index.ts';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento opcional: a sessão continua funcionando até fechar a aba */
  }
}

/** Chave secreta deste navegador. É a única "conta": o servidor guarda só um hash. */
export function playerKey(): string {
  let key = read<string>('highlords.key', '');
  if (!/^[a-f0-9]{64}$/.test(key)) {
    key = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    write('highlords.key', key);
  }
  return key;
}

export function guestProfile(): Profile {
  const n = crypto.getRandomValues(new Uint32Array(1))[0];
  return { nickname: 'Highlord' + String(100 + (n % 900)), avatar: AVATARS[n % AVATARS.length] };
}

function createStore<T extends object>(key: string, initial: () => T) {
  const saved = read<Partial<T> | null>(key, null);
  let value: T = { ...initial(), ...saved };
  if (!saved) write(key, value);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(patch: Partial<T>) {
      value = { ...value, ...patch };
      write(key, value);
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const profileStore = createStore<Profile>('highlords.profile', guestProfile);
export const prefsStore = createStore<{ sound: boolean; volume: number; coach: boolean }>(
  'highlords.prefs',
  () => ({ sound: true, volume: 0.7, coach: true }),
);

export function useStore<T extends object>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
