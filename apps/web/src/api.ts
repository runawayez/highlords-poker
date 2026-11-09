import type { Command } from '../../../packages/contracts/src/index.ts';
import type { PokerService } from '../../../packages/server/src/service.ts';
export type Snapshot = Awaited<ReturnType<PokerService['snapshot']>>;
export type Lobby = ReturnType<PokerService['lobby']>;
export type Messages = Snapshot['chat'];
export const API = import.meta.env.VITE_API_URL ?? '';
export class ApiError extends Error {}
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* Session still works until tab closes. */
  }
}
export let token = read<string>('highlords.session', '');
export function setToken(value: string) {
  token = value;
  write('highlords.session', value);
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError('NETWORK');
  const value = (await response.json()) as { error?: string };
  if (!response.ok) throw new ApiError(value.error ?? 'INTERNAL');
  return value as T;
}
export function command(c: Omit<Command, 'id'>) {
  return request<{ roomId?: string; room?: unknown; reports?: unknown }>('/api/command', {
    ...c,
    id: actionId(),
  });
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function actionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
