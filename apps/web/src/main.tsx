import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n/index.ts';
import './styles.css';
import { ProfileSchema, type Config, type Command } from '../../../packages/contracts/src/index.ts';
import {
  API,
  request,
  command,
  download,
  token,
  setToken,
  read,
  write,
  type Snapshot,
  type Lobby,
  type Messages,
} from './api.ts';
import { storedPreferences, type Preferences } from './preferences.ts';
import {
  ErrorContext,
  Modal,
  JoinDialog,
  ProfileEditor,
  CreateRoom,
  Chat,
  PokerTable,
  ActionBar,
} from './components.tsx';
function roomPath() {
  return location.pathname.match(/^\/room\/([a-f0-9-]+)$/)?.[1];
}
function App() {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState(storedPreferences);
  const [ready, setReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(!prefs.profile.nickname);
  const [createOpen, setCreateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [roomId, setRoomId] = useState(roomPath);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lobby, setLobby] = useState<{ rooms: Lobby; chat: Messages }>({ rooms: [], chat: [] });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinDialog, setJoinDialog] = useState<{ id: string; watch: boolean } | null>(null);
  const [filter, setFilter] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [protection, setProtection] = useState('');
  const [vacancies, setVacancies] = useState(false);
  const [tableIndex, setTableIndex] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const closeProfile = useCallback(() => setProfileOpen(false), []),
    closeCreate = useCallback(() => setCreateOpen(false), []),
    closeRules = useCallback(() => setRulesOpen(false), []),
    closeJoin = useCallback(() => setJoinDialog(null), []);
  const fail = useCallback(
    (e: unknown) => {
      const code = (e as Error).message;
      setError(t(`errors:${code}`, { defaultValue: t('error') }));
      if (code === 'SESSION_EXPIRED') {
        setReady(false);
        setProfileOpen(true);
        setToken('');
      }
    },
    [t],
  );
  const navigate = (id?: string) => {
    history.pushState({}, '', id ? `/room/${id}` : '/');
    setRoomId(id);
    setSnapshot(null);
    setTableIndex(0);
  };
  useEffect(() => {
    const fn = () => {
      setRoomId(roomPath());
      setSnapshot(null);
    };
    window.addEventListener('popstate', fn);
    return () => window.removeEventListener('popstate', fn);
  }, []);
  const saveProfile = async (p: Preferences) => {
    const valid = ProfileSchema.safeParse(p.profile);
    if (!valid.success) {
      fail(new Error('VALIDATION'));
      return;
    }
    setBusy(true);
    try {
      const session = await request<{ token: string }>('/api/session', { profile: valid.data });
      setToken(session.token);
      setPrefs(p);
      write('highlords.preferences', p);
      setReady(true);
      setProfileOpen(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (prefs.profile.nickname) void saveProfile(prefs);
  }, []);
  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      if (roomId) {
        const result = await request<Snapshot>(`/api/rooms/${roomId}`);
        setSnapshot(result);
      } else setLobby(await request('/api/lobby'));
      setConnected(true);
    } catch (e) {
      if ((e as Error).message === 'JOIN_REQUIRED') {
        setJoinDialog((d) => d ?? { id: roomId!, watch: false });
      } else fail(e);
    }
  }, [ready, roomId, fail]);
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let ws: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout>;
    let ping: ReturnType<typeof setInterval>;
    const connect = () => {
      const base = API ? new URL(API) : new URL(location.origin);
      base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
      base.pathname = '/api/ws';
      ws = new WebSocket(base);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'AUTH', token, roomId }));
        ping = setInterval(() => {
          if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'PING' }));
        }, 20000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'SNAPSHOT') {
            if (roomId) setSnapshot(msg.data);
            else setLobby(msg.data);
            setConnected(true);
          } else if (msg.type === 'REFRESH') void refresh();
        } catch {
          /* HTTP fallback recovers. */
        }
      };
      ws.onerror = () => setConnected(false);
      ws.onclose = () => {
        clearInterval(ping);
        setConnected(false);
        if (!disposed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    void refresh();
    const fallback = setInterval(() => {
      if (ws?.readyState !== 1) void refresh();
    }, 5000);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(ping);
      clearInterval(fallback);
      ws?.close();
    };
  }, [ready, roomId, refresh]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!error && !notice) return;
    const id = setTimeout(() => {
      setError('');
      setNotice('');
    }, 6000);
    return () => clearTimeout(id);
  }, [error, notice]);
  const run = async (
    type: Command['type'],
    payload: Record<string, unknown> = {},
    targetRoom = roomId,
  ) => {
    setBusy(true);
    try {
      const result = await command({
        type,
        payload,
        roomId: targetRoom,
        version: snapshotRef.current?.version,
      });
      if (type === 'EXPORT') {
        download('highlords-public-record.json', result);
        setNotice(t('game:download'));
      }
      if (type === 'REPORT') setNotice(t('chat:reported'));
      await refresh();
      return result;
    } catch (e) {
      fail(e);
      if ((e as Error).message === 'STALE_VERSION') await refresh();
    } finally {
      setBusy(false);
    }
  };
  const join = async (id: string, password: string, watch: boolean, buyIn?: number) => {
    setBusy(true);
    try {
      await command({
        type: watch ? 'SPECTATE' : 'JOIN',
        roomId: id,
        payload: { password, buyIn },
      });
      setJoinDialog(null);
      navigate(id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const create = async (config: Config) => {
    setBusy(true);
    try {
      const result = await command({ type: 'CREATE', payload: { config } });
      setCreateOpen(false);
      navigate(result.roomId);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const num = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const me = snapshot?.players.find((p) => p.id === snapshot.me);
  const tables = snapshot?.tables ?? [];
  const table = tables[tableIndex] ?? tables.find((t) => t.ids.includes(snapshot!.me)) ?? tables[0];
  const played = useRef(new Set<string>());
  useEffect(() => {
    const hand = table?.hand;
    if (hand?.done && snapshot && hand.awards[snapshot.me] && !played.current.has(hand.id)) {
      played.current.add(hand.id);
      const seen = read<string[]>('highlords.wins', []);
      if (!seen.includes(hand.id)) write('highlords.wins', [...seen, hand.id].slice(-1000));
    }
  }, [table?.hand, snapshot?.me]);
  const previousActor = useRef('');
  useEffect(() => {
    const actor = table?.hand?.actor ?? '';
    if (actor !== previousActor.current && actor === snapshot?.me && prefs.sound) {
      try {
        const ctx = new AudioContext();
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.value = 0.05;
        o.frequency.value = 660;
        o.start();
        o.stop(ctx.currentTime + 0.12);
        setTimeout(() => void ctx.close(), 300);
      } catch {
        /* browser may require a user gesture */
      }
    }
    previousActor.current = actor;
  }, [table?.hand?.actor, snapshot?.me, prefs.sound]);
  return (
    <ErrorContext.Provider value={error}>
      <div
        className="app"
        data-theme={prefs.theme}
        data-back={prefs.cardBack}
        style={{ '--chip': prefs.chipColor } as React.CSSProperties}
      >
        <header className="header">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate();
            }}
          >
            <span className="crest">♠</span>
            <span>
              HIGHLORDS<small>POKER CLUB</small>
            </span>
          </a>
          <nav>
            <button className={!roomId ? 'nav active' : 'nav'} onClick={() => navigate()}>
              {t('lobby')}
            </button>
            <button className="nav" onClick={() => setRulesOpen(true)}>
              {t('rules')}
            </button>
          </nav>
          <div className="header-right">
            <label className="language">
              <span aria-hidden>🌐</span>
              <select
                aria-label={t('selectLanguage')}
                value={i18n.language}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              className="profile-trigger"
              aria-label={prefs.profile.nickname || t('profile')}
              onClick={() => setProfileOpen(true)}
            >
              <span style={{ color: prefs.profile.accent }}>{prefs.profile.avatar}</span>
              <span>{prefs.profile.nickname || t('profile')}</span>
            </button>
          </div>
        </header>
        {(error || notice) && (
          <div className={`toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
            {error || notice}
            <button
              onClick={() => {
                setError('');
                setNotice('');
              }}
              aria-label={t('close')}
            >
              ×
            </button>
          </div>
        )}
        <main>
          {!ready && !profileOpen && (
            <div className="banner">
              <button onClick={() => setProfileOpen(true)}>{t('profile')}</button>
            </div>
          )}
          {!roomId ? (
            <>
              <section className="hero">
                <div>
                  <p className="eyebrow">
                    <span /> {t('lobby:eyebrow')}
                  </p>
                  <h1>{t('lobby:hero')}</h1>
                  <p className="hero-intro">{t('lobby:intro')}</p>
                  <button
                    className="primary"
                    disabled={!ready || busy}
                    onClick={() => setCreateOpen(true)}
                  >
                    ＋ {t('lobby:createRoom')} <span>↗</span>
                  </button>
                  <p className="micro">{t('lobby:stats')}</p>
                </div>
                <div className="hero-art" aria-hidden>
                  <div className="halo" />
                  <div className="art-card black">
                    A<span>♠</span>
                    <small>A</small>
                  </div>
                  <div className="art-card red">
                    K<span>♥</span>
                    <small>K</small>
                  </div>
                  <div className="art-chip">H</div>
                  <span className="art-caption">{t('lobby:artCaption')}</span>
                </div>
              </section>
              <div className="lobby-layout">
                <section className="rooms">
                  <div className="section-heading">
                    <div>
                      <h2>
                        {t('lobby:rooms')} <span className="count">{lobby.rooms.length}</span>
                      </h2>
                      <p>{t('lobby:subtitle')}</p>
                    </div>
                    <span className={`connection ${connected ? 'live' : ''}`}>
                      ● {t(connected ? 'online' : 'offline')}
                    </span>
                  </div>
                  <div className="filters">
                    <input
                      aria-label={t('lobby:search')}
                      placeholder={'⌕ ' + t('lobby:search')}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                    <select
                      aria-label={t('lobby:mode')}
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="">{t('lobby:all')}</option>
                      {['CASH', 'SIT_AND_GO', 'TOURNAMENT'].map((m) => (
                        <option key={m} value={m}>
                          {t(`game:${m}`)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t('lobby:status')}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">{t('lobby:status')}</option>
                      {['WAITING', 'RUNNING', 'PAUSED', 'FINISHED'].map((s) => (
                        <option key={s} value={s}>
                          {t(`game:${s}`)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t('lobby:protection')}
                      value={protection}
                      onChange={(e) => setProtection(e.target.value)}
                    >
                      <option value="">{t('lobby:protection')}</option>
                      <option value="yes">{t('lobby:protected')}</option>
                      <option value="no">{t('lobby:public')}</option>
                    </select>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={vacancies}
                        onChange={(e) => setVacancies(e.target.checked)}
                      />
                      {t('lobby:vacancies')}
                    </label>
                  </div>
                  <div className="room-list">
                    {lobby.rooms
                      .filter(
                        (r) =>
                          r.title.toLowerCase().includes(filter.toLowerCase()) &&
                          (!mode || r.mode === mode) &&
                          (!status || r.status === status) &&
                          (!vacancies || r.players < r.capacity) &&
                          (!protection || r.protected === (protection === 'yes')),
                      )
                      .map((r) => (
                        <article className="room-card" key={r.id}>
                          <div className="room-symbol">
                            {r.mode === 'CASH' ? '♠' : r.mode === 'SIT_AND_GO' ? '♜' : '♛'}
                          </div>
                          <div className="room-info">
                            <span className="badge">{t(`game:${r.mode}`)}</span>
                            <h3>
                              {r.title}{' '}
                              {r.protected && <span aria-label={t('lobby:protected')}>⌑</span>}
                            </h3>
                            <p>
                              {num(r.small)} / {num(r.big)} · {r.players}/{r.capacity} ·{' '}
                              {t(`game:${r.status}`)}
                            </p>
                          </div>
                          <div className="room-buttons">
                            <button
                              disabled={!ready || busy}
                              className="primary small"
                              onClick={() => setJoinDialog({ id: r.id, watch: false })}
                            >
                              {t('lobby:join')}
                            </button>
                            <button
                              disabled={!ready || busy}
                              className="text-button"
                              onClick={() => setJoinDialog({ id: r.id, watch: true })}
                            >
                              {t('watch')}
                            </button>
                          </div>
                        </article>
                      ))}
                    {lobby.rooms.length === 0 && (
                      <div className="empty-state">
                        <span>♧</span>
                        <h3>{t('lobby:noRooms')}</h3>
                        <p>{t('lobby:noRoomsText')}</p>
                      </div>
                    )}
                  </div>
                </section>
                <Chat
                  messages={lobby.chat}
                  me=""
                  disabled={!ready || busy}
                  onSend={(text) => run('CHAT', { text }, undefined)}
                />
              </div>
            </>
          ) : (
            <>
              {snapshot ? (
                <>
                  <div className="room-heading">
                    <div>
                      <button className="text-button" onClick={() => navigate()}>
                        ← {t('back')}
                      </button>
                      <p className="eyebrow">
                        {t(`game:${snapshot.config.mode}`)} / {t(`game:${snapshot.status}`)}
                      </p>
                      <h1>{snapshot.config.title}</h1>
                    </div>
                    <div className="room-controls">
                      <span className={`connection ${connected ? 'live' : ''}`}>
                        ● {t(connected ? 'online' : 'offline')}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard
                            .writeText(location.href)
                            .then(() => setNotice(t('copied')))
                            .catch(() => fail(new Error('INTERNAL')));
                        }}
                      >
                        {t('copy')}
                      </button>
                      {snapshot.host && (
                        <>
                          <button
                            disabled={busy || snapshot.status !== 'WAITING'}
                            onClick={() => void run('START')}
                          >
                            {t('game:start')}
                          </button>
                          <button
                            disabled={busy || !['RUNNING', 'PAUSED'].includes(snapshot.status)}
                            onClick={() =>
                              void run(snapshot.status === 'PAUSED' ? 'RESUME' : 'PAUSE')
                            }
                          >
                            {t(snapshot.status === 'PAUSED' ? 'game:resume' : 'game:pause')}
                          </button>
                          <button onClick={() => void run('EXPORT')}>{t('game:export')}</button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          if (await run('LEAVE')) navigate();
                        }}
                      >
                        {t('leave')}
                      </button>
                    </div>
                  </div>
                  {snapshot.pauseReason === 'EMPTY' && (
                    <p className="banner">{t('game:pauseEmpty')}</p>
                  )}
                  {snapshot.config.mode !== 'CASH' && (
                    <div className="tournament-bar">
                      <span>
                        {snapshot.level.break
                          ? t('game:break')
                          : t('game:level', { number: snapshot.level.index + 1 })}
                      </span>
                      <strong>
                        {num(snapshot.level.small)} / {num(snapshot.level.big)}
                      </strong>
                      <span>{Math.ceil(snapshot.level.remaining / 60000)} min</span>
                      <span>
                        {t('game:prizePool')}: {num(snapshot.pool)}
                      </span>
                    </div>
                  )}
                  <div className="game-layout">
                    <section>
                      <div className="table-tabs">
                        {tables.map((tb, i) => (
                          <button
                            className={table?.id === tb.id ? 'selected' : ''}
                            key={tb.id}
                            onClick={() => setTableIndex(i)}
                          >
                            {t('game:table', { number: i + 1 })}
                          </button>
                        ))}
                      </div>
                      {table?.hand ? (
                        <>
                          <PokerTable snapshot={snapshot} table={table} clock={clock} num={num} />
                          <ActionBar
                            snapshot={snapshot}
                            table={table}
                            busy={busy || !connected}
                            onAction={(action, amount) => run('ACT', { action, amount })}
                          />
                        </>
                      ) : (
                        <div className="waiting-table">
                          <span>♠</span>
                          <h2>
                            {t(
                              snapshot.status === 'WAITING' ? 'game:waiting' : 'game:waitingRebuy',
                            )}
                          </h2>
                          <div className="waiting-players">
                            {snapshot.players
                              .filter((p) => !p.left)
                              .map((p) => (
                                <div key={p.id}>
                                  <span style={{ color: p.profile?.accent }}>
                                    {p.profile?.avatar}
                                  </span>
                                  {p.profile?.nickname}
                                  <small>{num(p.stack)}</small>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="personal-controls">
                        {me && !me.left ? (
                          <>
                            <span>
                              {t('game:bank', { seconds: me.bank })}{' '}
                              {me.sitOut && '· ' + t('game:sitOutStatus')}
                            </span>
                            {snapshot.config.mode === 'CASH' && (
                              <button disabled={busy} onClick={() => void run('SIT_OUT')}>
                                {t('game:sitOut')}
                              </button>
                            )}
                            <button
                              disabled={busy}
                              onClick={() => {
                                const value = prompt(
                                  t('game:amount'),
                                  String(
                                    snapshot.config.mode === 'CASH'
                                      ? snapshot.config.minBuyIn
                                      : snapshot.config.stack,
                                  ),
                                );
                                if (value) void run('TOP_UP', { amount: Number(value) });
                              }}
                            >
                              {t('game:topUp')}
                            </button>
                            <button
                              disabled={busy || snapshot.config.mode === 'CASH'}
                              onClick={() => void run('ADD_ON')}
                            >
                              {t('game:addOn')}
                            </button>
                            <button
                              disabled={busy || !me.bank || table?.hand?.actor !== snapshot.me}
                              onClick={() => void run('TIME_BANK')}
                            >
                              {t('game:timeBank')}
                            </button>
                          </>
                        ) : (
                          <p>{t('game:noSeat')}</p>
                        )}
                      </div>
                      {table?.hand && (
                        <details className="history">
                          <summary>{t('game:actions')}</summary>
                          {table.hand.log.map((event, i) => (
                            <p key={i}>
                              {
                                snapshot.players.find((p) => p.id === event.player)?.profile
                                  ?.nickname
                              }{' '}
                              · {t(`game:${event.action}`)}{' '}
                              {event.amount > 0 ? num(event.amount) : ''}
                            </p>
                          ))}
                        </details>
                      )}
                      <details className="history">
                        <summary>
                          {t('game:history')} ({snapshot.history.length})
                        </summary>
                        {snapshot.history
                          .slice()
                          .reverse()
                          .map((h) => (
                            <div className="history-hand" key={h.id}>
                              <strong>
                                {h.board.join(' ') || '—'} · {num(h.pot)}
                              </strong>
                              {Object.entries(h.awards).map(([id, amount]) => (
                                <p key={id}>
                                  {snapshot.players.find((p) => p.id === id)?.profile?.nickname}: +
                                  {num(amount as number)}
                                </p>
                              ))}
                            </div>
                          ))}
                      </details>
                      <section className="standings">
                        <h2>{t('game:standings')}</h2>
                        {snapshot.config.mode !== 'CASH' && <p>{t('game:rebuyWindow')}</p>}
                        <table>
                          <thead>
                            <tr>
                              <th>{t('game:rank')}</th>
                              <th>{t('profile:nickname')}</th>
                              <th>{t('game:stack')}</th>
                              <th>{t('game:prize')}</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {[...snapshot.players]
                              .sort(
                                (a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.stack - a.stack,
                              )
                              .map((p) => (
                                <tr key={p.id}>
                                  <td>{p.rank ?? '—'}</td>
                                  <td>
                                    <span className={p.online ? 'online-dot' : ''}>●</span>{' '}
                                    {p.profile?.avatar} {p.profile?.nickname} {p.left ? '↗' : ''}
                                  </td>
                                  <td>{num(p.stack)}</td>
                                  <td>{num(snapshot.payouts[p.id] ?? 0)}</td>
                                  <td>
                                    {p.id !== snapshot.me && (
                                      <details className="moderation">
                                        <summary>⋯</summary>
                                        {snapshot.host &&
                                          ['MUTE', 'KICK', 'BAN'].map((a) => (
                                            <button
                                              key={a}
                                              onClick={() =>
                                                void run('MODERATE', { target: p.id, action: a })
                                              }
                                            >
                                              {t(`chat:${a.toLowerCase()}`)}
                                            </button>
                                          ))}
                                        <button
                                          onClick={() => {
                                            const reason = prompt(t('chat:reportReason'));
                                            if (reason)
                                              void run('REPORT', { target: p.id, text: reason });
                                          }}
                                        >
                                          {t('chat:report')}
                                        </button>
                                      </details>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </section>
                    </section>
                    <Chat
                      messages={snapshot.chat as Messages}
                      me={snapshot.me}
                      disabled={busy || !connected}
                      onSend={(text) => run('CHAT', { text })}
                      onReact={(messageId, emoji) => run('REACT', { messageId, emoji })}
                    />
                  </div>
                </>
              ) : (
                <div className="loading">
                  <p>{t('loading')}</p>
                  <button onClick={() => setJoinDialog({ id: roomId, watch: false })}>
                    {t('lobby:join')}
                  </button>
                  <button onClick={() => navigate()}>{t('back')}</button>
                </div>
              )}
            </>
          )}
        </main>
        <footer>
          <span>♠ HIGHLORDS POKER</span>
          <p>{t('virtual')}</p>
          <span>{t('tagline')}</span>
        </footer>
        {profileOpen && (
          <ProfileEditor
            value={prefs}
            busy={busy}
            onClose={closeProfile}
            onSave={saveProfile}
            onError={fail}
          />
        )}
        {createOpen && (
          <CreateRoom busy={busy} onClose={closeCreate} onCreate={create} onError={fail} />
        )}
        {rulesOpen && (
          <Modal title={t('rules')} onClose={closeRules}>
            <p className="rules-text">{t('rulesText')}</p>
          </Modal>
        )}
        {joinDialog && (
          <JoinDialog
            busy={busy}
            onClose={closeJoin}
            onJoin={(password, buyIn) => join(joinDialog.id, password, joinDialog.watch, buyIn)}
          />
        )}
      </div>
    </ErrorContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
