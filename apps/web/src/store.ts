import { useSyncExternalStore } from 'react';
import { EMBLEMS, PROFILE_COLORS, type Profile } from '../../../packages/contracts/src/index.ts';
import { randomNickname } from './names.ts';

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
  return {
    nickname: randomNickname(),
    avatar: EMBLEMS[n % EMBLEMS.length],
    color: PROFILE_COLORS[n % PROFILE_COLORS.length],
  };
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

export type Theme = 'night' | 'emerald' | 'royal' | 'crimson';
export type CardBack = 'crimson' | 'azure' | 'onyx';
export type TextSize = 'm' | 'l' | 'xl';
export type CardSize = 's' | 'm' | 'l';
export type Prefs = {
  sound: boolean;
  volume: number;
  /** Dicas didáticas: mão atual, chance de vitória, pot odds e sugestão. */
  coach: boolean;
  /** Mostra VPIP/PFR dos adversários na placa de nome. */
  hud: boolean;
  theme: Theme;
  /** Naipes em quatro cores (espadas preto, copas vermelho, ouros azul, paus verde). */
  fourColor: boolean;
  cardBack: CardBack;
  textSize: TextSize;
  contrast: boolean;
  /** Esconde as cartas ao perder no showdown (muck). */
  muck: boolean;
  /** Aceita dividir o pote em duas rodadas quando todos em all-in concordam. */
  runTwice: boolean;
  /** Tamanho das cartas na mesa. */
  cardSize: CardSize;
  /** Já viu o passo a passo da primeira mesa. */
  tourDone: boolean;
  /** Jogadores silenciados no chat (só para mim). */
  muted: string[];
};
export const prefsStore = createStore<Prefs>('highlords.prefs', () => ({
  sound: true,
  volume: 0.7,
  coach: true,
  hud: false,
  theme: 'night',
  fourColor: false,
  cardBack: 'crimson',
  textSize: 'm',
  contrast: false,
  muck: false,
  runTwice: false,
  cardSize: 'm',
  tourDone: false,
  muted: [],
}));

/** Estatísticas só deste navegador: nada disso sobe para o servidor. */
export type Stats = { hands: number; won: number; biggestPot: number; folded: number };
export const statsStore = createStore<Stats>('highlords.stats', () => ({
  hands: 0,
  won: 0,
  biggestPot: 0,
  folded: 0,
}));

export type RecentTable = { id: string; title: string; at: number };
export const recentStore = createStore<{ tables: RecentTable[] }>('highlords.recent', () => ({
  tables: [],
}));
export function rememberTable(id: string, title: string) {
  const others = recentStore.get().tables.filter((t) => t.id !== id);
  recentStore.set({ tables: [{ id, title, at: Date.now() }, ...others].slice(0, 5) });
}

export function useStore<T extends object>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

/** Reflete as preferências visuais no <html>: o CSS reage aos atributos data-*. */
export function applyPrefs(prefs: Prefs = prefsStore.get()) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.text = prefs.textSize;
  root.dataset.contrast = String(prefs.contrast);
  root.dataset.fourColor = String(prefs.fourColor);
  root.dataset.back = prefs.cardBack;
  root.dataset.cards = prefs.cardSize;
}
