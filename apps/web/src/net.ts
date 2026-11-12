import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientMessage,
  Config,
  ErrorCode,
  LobbyEntry,
  Profile,
} from '../../../packages/contracts/src/index.ts';
import type { RoomEngine } from '../../../packages/server/src/room.ts';
import { playerKey, profileStore } from './store.ts';

export type RoomView = ReturnType<RoomEngine['view']>;
export type PlayerView = RoomView['players'][number];

export class ApiError extends Error {
  constructor(public code: ErrorCode | 'NETWORK') {
    super(code);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError('NETWORK');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: ErrorCode };
  if (!res.ok) throw new ApiError(data.error ?? 'INTERNAL');
  return data;
}

export const fetchLobby = async () => (await request<{ rooms: LobbyEntry[] }>('/api/lobby')).rooms;
export const fetchRoom = (code: string) => request<LobbyEntry>(`/api/rooms/${code}`);
export async function createRoom(config: Partial<Config> & { title: string }, profile: Profile) {
  return (await request<{ id: string }>('/api/rooms', { key: playerKey(), profile, config })).id;
}

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'closed';
export type RoomFatal = 'ROOM_NOT_FOUND' | 'KICKED' | null;

/** Conexão em tempo real com a sala: reconecta sozinha e expõe o estado mais recente. */
export function useRoom(code: string) {
  const [state, setState] = useState<RoomView | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<Connection>('connecting');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [fatal, setFatal] = useState<RoomFatal>(null);
  const [lastError, setLastError] = useState<{ code: ErrorCode; at: number } | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const password = useRef<string | undefined>(undefined);
  const attempt = useRef(0);
  const offset = useRef(0);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const open = async () => {
      if (stopped) return;
      // Confere se a sala existe antes de insistir em conectar.
      try {
        await fetchRoom(code);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ROOM_NOT_FOUND') {
          setFatal('ROOM_NOT_FOUND');
          return;
        }
      }
      if (stopped) return;
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${scheme}://${location.host}/api/rooms/${code}/ws`);
      socket.current = ws;
      ws.onopen = () => {
        attempt.current = 0;
        ws.send(
          JSON.stringify({
            type: 'HELLO',
            key: playerKey(),
            profile: profileStore.get(),
            password: password.current,
          }),
        );
        heartbeat = setInterval(() => ws.readyState === 1 && ws.send('ping'), 20_000);
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as
          | { type: 'STATE'; data: RoomView }
          | { type: 'ERROR'; code: ErrorCode }
          | { type: 'CLOSED' }
          | { type: 'PHOTOS'; data: Record<string, string | null> }
          | { type: 'PONG' };
        if (message.type === 'STATE') {
          offset.current = message.data.serverNow - Date.now();
          setConnection('open');
          setNeedsPassword(false);
          setWrongPassword(false);
          setState(message.data);
        } else if (message.type === 'ERROR') {
          if (message.code === 'WRONG_PASSWORD') {
            setNeedsPassword(true);
            setWrongPassword(!!password.current);
          } else if (message.code === 'KICKED' || message.code === 'ROOM_NOT_FOUND')
            setFatal(message.code);
          else setLastError({ code: message.code, at: Date.now() });
        } else if (message.type === 'PHOTOS') {
          setPhotos((current) => {
            const next = { ...current };
            for (const [id, photo] of Object.entries(message.data))
              if (photo) next[id] = photo;
              else delete next[id];
            return next;
          });
        } else if (message.type === 'CLOSED') setFatal('ROOM_NOT_FOUND');
      };
      ws.onclose = () => {
        clearInterval(heartbeat);
        if (stopped) return;
        setConnection('reconnecting');
        const delay = Math.min(5000, 400 * 2 ** attempt.current++);
        timer = setTimeout(() => void open(), delay);
      };
    };
    void open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      socket.current?.close();
    };
  }, [code]);

  // Quando a sala some ou o jogador é expulso, não adianta insistir.
  useEffect(() => {
    if (fatal) {
      setConnection('closed');
      socket.current?.close();
    }
  }, [fatal]);

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState === 1) socket.current.send(JSON.stringify(message));
  }, []);

  const submitPassword = useCallback((value: string) => {
    password.current = value;
    const ws = socket.current;
    if (ws?.readyState === 1)
      ws.send(
        JSON.stringify({
          type: 'HELLO',
          key: playerKey(),
          profile: profileStore.get(),
          password: value,
        }),
      );
  }, []);

  /** Hora do servidor aproximada, para contagens regressivas sem depender do relógio local. */
  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return {
    state,
    photos,
    connection,
    needsPassword,
    wrongPassword,
    fatal,
    lastError,
    send,
    submitPassword,
    serverNow,
  };
}
