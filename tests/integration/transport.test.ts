import { it, expect } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import { ConfigSchema } from '../../packages/contracts/src/index.ts';
it('real HTTP + WebSocket preserve private cards, enforce origins, and restore SQLite after process restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'highlords-test-'));
  let process: ChildProcess | undefined;
  const port = 43999;
  const base = `http://localhost:${port}`;
  const sockets: WebSocket[] = [];
  const start = async () => {
    process = spawn(
      globalThis.process.execPath,
      ['--import', 'tsx', 'apps/local-server/src/index.ts'],
      {
        env: {
          ...globalThis.process.env,
          PORT: String(port),
          DATA_PATH: join(dir, 'game.sqlite'),
          ALLOWED_ORIGINS: 'https://poker.test',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server did not start')), 10000);
      process!.stdout!.on('data', (data) => {
        if (String(data).includes('Highlords Poker')) {
          clearTimeout(timer);
          resolve();
        }
      });
      process!.on('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Server exited ' + code));
      });
    });
  };
  const stop = async () => {
    if (process && process.exitCode === null) {
      process.kill('SIGTERM');
      await once(process, 'exit');
    }
  };
  const post = async (path: string, body: unknown, token?: string) => {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as any;
    expect(response.ok, JSON.stringify(data)).toBe(true);
    return data;
  };
  const snapshot = async (token: string, id: string) => {
    const res = await fetch(base + '/api/rooms/' + id, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as any;
  };
  const command = async (
    token: string,
    type: string,
    roomId?: string,
    payload = {},
    version?: number,
  ) => post('/api/command', { id: crypto.randomUUID(), type, roomId, payload, version }, token);
  try {
    await start();
    const a = await post('/api/session', { profile: { nickname: 'Alice' } }),
      b = await post('/api/session', { profile: { nickname: 'Bob' } }),
      c = await post('/api/session', { profile: { nickname: 'Spectator' } });
    const cfg = ConfigSchema.parse({
      title: 'Network table',
      mode: 'CASH',
      seats: 2,
      stack: 1000,
      small: 5,
      big: 10,
      levels: [{ small: 5, big: 10, ante: 0, minutes: 10, breakMinutes: 0 }],
    });
    const { roomId } = await command(a.token, 'CREATE', undefined, { config: cfg });
    await command(b.token, 'JOIN', roomId);
    await command(c.token, 'SPECTATE', roomId);
    await command(a.token, 'START', roomId, {}, (await snapshot(a.token, roomId)).version);
    for (const p of [a, b, c]) {
      const ws = new WebSocket(base.replace('http', 'ws') + '/api/ws', {
        origin: 'https://poker.test',
      });
      sockets.push(ws);
      await once(ws, 'open');
      const message = once(ws, 'message');
      ws.send(JSON.stringify({ type: 'AUTH', token: p.token, roomId }));
      const [raw] = await message;
      const view = JSON.parse(String(raw)).data;
      expect(view.tables[0].hand.players.filter((x: any) => x.cards.length).length).toBe(
        p === c ? 0 : 1,
      );
      expect(
        view.tables[0].hand.players
          .filter((x: any) => x.cards.length)
          .every((x: any) => x.id === p.playerId),
      ).toBe(true);
    }
    const forbidden = await fetch(base + '/api/lobby', {
      headers: { Origin: 'https://evil.test' },
    });
    expect(forbidden.status).toBe(403);
    const before = await snapshot(a.token, roomId);
    for (const ws of sockets) ws.close();
    await stop();
    await start();
    const after = await snapshot(a.token, roomId);
    expect(after.tables[0].hand).toEqual(before.tables[0].hand);
    expect(after.players.map((p: any) => [p.id, p.stack])).toEqual(
      before.players.map((p: any) => [p.id, p.stack]),
    );
  } finally {
    for (const ws of sockets) ws.terminate();
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
