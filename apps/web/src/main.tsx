import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n/index.ts';
import './styles.css';
import './club.css';
import './premium.css';
import './experience.css';
import './quick-profile.css';
import './club-premium.css';
import { playTableSound, primeTableAudio } from './table-audio.ts';
import { ClubArtwork, ClubFeatures } from './club-art.tsx';
import {
  ProfileSchema,
  type Profile,
  type Config,
  type Command,
} from '../../../packages/contracts/src/index.ts';
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
import { balance } from '../../../packages/tournament-engine/src/index.ts';
import { RoomDirector, RoomStats } from './room-tools.tsx';
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
import {
  LearningPage,
  DecisionDock,
  TournamentPresentation,
  learningRoute,
  learningPaths,
  type LearningKind,
} from './learning.tsx';
import { visibleHand } from './poker-learning.ts';
function roomPath() {
  return location.pathname.match(/^\/room\/([a-f0-9-]+)$/)?.[1];
}
function App() {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState(storedPreferences);
  const lastSessionProfile = useRef('');
  const [railTab, setRailTab] = useState('players');
  const [directorOpen, setDirectorOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(true);
  const closeDirector = useCallback(() => setDirectorOpen(false), []);
  const [homeScreen, setHomeScreen] = useState(() =>
    location.pathname === '/mesas' ? 'lobby' : 'home',
  );
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [topUp, setTopUp] = useState<number | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [closeRoomOpen, setCloseRoomOpen] = useState(false);
  const dismissCloseRoom = useCallback(() => setCloseRoomOpen(false), []);
  const closeTopUp = useCallback(() => setTopUp(null), []);
  const closeLeave = useCallback(() => setLeaveOpen(false), []);
  const [ready, setReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [roomId, setRoomId] = useState(roomPath);
  const [page, setPage] = useState(learningRoute);
  const [lesson, setLesson] = useState<LearningKind | null>(null);
  const closeLesson = useCallback(() => setLesson(null), []);
  const [coach, setCoach] = useState(() => read<boolean>('highlords.coach', true));
  const toggleCoach = () =>
    setCoach((value) => {
      write('highlords.coach', !value);
      return !value;
    });
  const openLearning = (kind: LearningKind) => {
    if (roomId) {
      setLesson(kind);
      return;
    }
    history.pushState({}, '', learningPaths[kind]);
    setPage(kind);
    window.scrollTo(0, 0);
  };
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lobby, setLobby] = useState<{ rooms: Lobby }>({ rooms: [] });
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
    setPage('play');
    setHomeScreen('home');
    setDirectorOpen(false);
    setLesson(null);
    history.pushState({}, '', id ? `/room/${id}` : '/');
    setRoomId(id);
    setSnapshot(null);
    setTableIndex(0);
  };
  const openLobby = () => {
    history.pushState({}, '', '/mesas');
    setPage('play');
    setHomeScreen('lobby');
    setRoomId(undefined);
    setSnapshot(null);
    setDirectorOpen(false);
  };
  useEffect(() => {
    const fn = () => {
      setHomeScreen(location.pathname === '/mesas' ? 'lobby' : 'home');
      setDirectorOpen(false);
      setPage(learningRoute());
      setRoomId(roomPath());
      setSnapshot(null);
    };
    window.addEventListener('popstate', fn);
    return () => window.removeEventListener('popstate', fn);
  }, []);
  const changeQuickProfile = (profile: Profile) => {
    const updated = { ...prefs, profile };
    setPrefs(updated);
    write('highlords.preferences', updated);
    setError('');
  };
  const saveProfile = async (p: Preferences) => {
    const valid = ProfileSchema.safeParse(p.profile);
    if (!valid.success) {
      fail(new Error('VALIDATION'));
      return;
    }
    write('highlords.preferences', p);
    setPrefs(p);
    setError('');
    setProfileOpen(false);
    await connectProfile(p);
  };
  async function connectProfile(p: Preferences) {
    try {
      const session = await request<{ token: string }>('/api/session', { profile: p.profile });
      setToken(session.token);
      lastSessionProfile.current = JSON.stringify(p.profile);
      setReady(true);
      return true;
    } catch {
      setReady(false);
      setConnected(false);
      return false;
    }
  }
  useEffect(() => {
    // Public pages need no session. Direct room links still authenticate immediately.
    if (roomId && prefs.profile.nickname) void connectProfile(prefs);
  }, []);
  useEffect(() => {
    if (ready || roomId || page !== 'play') return;
    let active = true;
    const poll = async () => {
      try {
        const result = await request<{ rooms: Lobby }>('/api/lobby');
        if (active) {
          setLobby(result);
          setConnected(true);
        }
      } catch {
        if (active) setConnected(false);
      }
    };
    void poll();
    const timer = setInterval(poll, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ready, roomId, page]);
  const refresh = useCallback(async () => {
    if (!ready || page !== 'play') return;
    try {
      if (roomId) {
        const result = await request<Snapshot>(`/api/rooms/${roomId}`);
        setSnapshot(result);
      } else setLobby(await request('/api/lobby'));
      setConnected(true);
    } catch (e) {
      if ((e as Error).message === 'JOIN_REQUIRED') {
        setJoinDialog((d) => d ?? { id: roomId!, watch: false });
      } else if ((e as Error).message === 'ROOM_NOT_FOUND' && roomPath() === roomId) {
        history.replaceState({}, '', '/');
        setRoomId(undefined);
        setSnapshot(null);
        setJoinDialog(null);
        setCloseRoomOpen(false);
        setError('');
        setNotice(t('game:roomGone'));
        try {
          setLobby(await request('/api/lobby'));
          setConnected(true);
        } catch {
          setConnected(false);
        }
      } else fail(e);
    }
  }, [ready, roomId, page, fail, t]);
  useEffect(() => {
    if (!ready || page !== 'play') return;
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
  }, [ready, roomId, page, refresh]);
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
      if (type === 'CLOSE_ROOM') {
        setCloseRoomOpen(false);
        navigate();
        setNotice(t('game:roomClosed'));
        setLobby(await request('/api/lobby'));
        return result;
      }
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
      if (!ProfileSchema.safeParse(prefs.profile).success) throw new Error('VALIDATION');
      if (
        (!ready || lastSessionProfile.current !== JSON.stringify(prefs.profile)) &&
        !(await connectProfile(prefs))
      )
        throw new Error('NETWORK');
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
      if (!ProfileSchema.safeParse(prefs.profile).success) throw new Error('VALIDATION');
      if (
        (!ready || lastSessionProfile.current !== JSON.stringify(prefs.profile)) &&
        !(await connectProfile(prefs))
      )
        throw new Error('NETWORK');
      const result = await command({ type: 'CREATE', payload: { config } });
      setCreateOpen(false);
      navigate(result.roomId);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const filteredRooms = lobby.rooms.filter(
    (r) =>
      r.title.toLowerCase().includes(filter.toLowerCase()) &&
      (!mode || r.mode === mode) &&
      (!status || r.status === status) &&
      (!vacancies || r.players < r.capacity) &&
      (!protection || r.protected === (protection === 'yes')),
  );
  const num = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const me = snapshot?.players.find((p) => p.id === snapshot.me);
  const tables: Snapshot['tables'] =
    snapshot?.status === 'WAITING'
      ? balance(
          snapshot.players.filter((p) => !p.left).map((p) => p.id),
          snapshot.config.seats,
        ).map((ids, i) => ({ id: `preview-${i}`, ids, deadline: 0, hand: undefined }))
      : (snapshot?.tables ?? []);
  const ownTableId = tables.find((t) => t.ids.includes(snapshot?.me ?? ''))?.id;
  useEffect(() => {
    setTableIndex(0);
    setRailTab('players');
    setSelectedPlayer('');
  }, [roomId]);
  useEffect(() => {
    const index = tables.findIndex((t) => t.id === ownTableId);
    if (index >= 0) setTableIndex(index);
  }, [ownTableId]);
  const handActive = snapshot?.tables.some(
    (t) => t.hand && !t.hand.done && t.ids.includes(snapshot.me),
  );
  const canTopUp =
    !!snapshot &&
    !!me &&
    !me.left &&
    !handActive &&
    snapshot.status !== 'FINISHED' &&
    snapshot.config.rebuy &&
    (snapshot.config.mode === 'CASH'
      ? snapshot.config.maxBuyIn - me.stack >= snapshot.config.minBuyIn
      : me.stack === 0 &&
        me.rebuyCount < snapshot.config.rebuyLimit &&
        snapshot.level.index <= snapshot.config.rebuyUntil);
  const canAddOn =
    !!snapshot &&
    !!me &&
    !handActive &&
    snapshot.config.mode !== 'CASH' &&
    snapshot.status !== 'FINISHED' &&
    !me.addOn &&
    me.stack > 0 &&
    snapshot.level.index === snapshot.config.addOnLevel;
  const table = tables[tableIndex] ?? tables.find((t) => t.ids.includes(snapshot!.me)) ?? tables[0];
  useEffect(() => {
    document.title =
      page !== 'play'
        ? `${t(`learn:${page}Nav`)} · Highlords Poker`
        : snapshot
          ? `${snapshot.config.title} · Highlords Poker`
          : 'Highlords Poker';
  }, [page, snapshot?.config.title, t]);
  const played = useRef(new Set<string>());
  useEffect(() => {
    const hand = table?.hand;
    if (hand?.done && snapshot && hand.awards[snapshot.me] && !played.current.has(hand.id)) {
      played.current.add(hand.id);
      const seen = read<string[]>('highlords.wins', []);
      if (!seen.includes(hand.id)) write('highlords.wins', [...seen, hand.id].slice(-1000));
    }
  }, [table?.hand, snapshot?.me]);
  const soundState = useRef<{
    room: string;
    actor: string;
    board: number;
    actions: number;
    chatId: string;
    handId: string;
    done: boolean;
  } | null>(null);
  useEffect(() => {
    if (!snapshot || !roomId) {
      soundState.current = null;
      return;
    }
    const hand = table?.hand;
    const next = {
      room: roomId,
      actor: hand?.actor ?? '',
      board: hand?.board.length ?? 0,
      actions: hand?.log.length ?? 0,
      chatId: snapshot.chat.at(-1)?.id ?? '',
      handId: hand?.id ?? '',
      done: hand?.done ?? false,
    };
    const prev = soundState.current;
    soundState.current = next;
    // Initial room snapshots must remain silent; sounds only accompany live events.
    if (!prev || prev.room !== roomId || !prefs.sound) return;
    if (next.chatId && prev.chatId && prev.chatId !== next.chatId) {
      const newest = snapshot.chat.at(-1);
      if (newest && !newest.code && newest.player !== snapshot.me) playTableSound('message');
    }
    if (next.handId && prev.handId !== next.handId) {
      playTableSound('deal');
    } else if (next.board > prev.board) {
      playTableSound('deal');
    } else if (next.actions > prev.actions) {
      playTableSound('chip');
    }
    if (next.actor && next.actor !== prev.actor && next.actor === snapshot.me) {
      playTableSound('turn');
    }
    if (hand?.done && !prev.done && hand?.awards[snapshot.me]) {
      playTableSound('win');
    }
  }, [snapshot?.version, table?.id, roomId, prefs.sound]);
  return (
    <ErrorContext.Provider value={error}>
      <div
        className={`app club-theme ${roomId ? 'in-room' : 'in-lobby'} view-${homeScreen}`}
        data-theme={prefs.theme}
        data-back={prefs.cardBack}
        style={{ '--chip': prefs.chipColor } as React.CSSProperties}
      >
        {!roomId && (
          <header className="header">
            <a
              className="brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate();
              }}
            >
              <img className="brand-mark" src="/highlords-torch.png" alt="" />
              <span>
                HIGHLORDS<small>POKER CLUB</small>
              </span>
            </a>
            <nav className="desktop-nav">
              <button
                className={
                  !roomId && page === 'play' && homeScreen === 'home' ? 'nav active' : 'nav'
                }
                onClick={() => navigate()}
              >
                {t('club:home')}
              </button>
              <button className={homeScreen === 'lobby' ? 'nav active' : 'nav'} onClick={openLobby}>
                {t('club:tables')}
              </button>
              {(['guide', 'hands', 'help'] as const).map((kind) => (
                <a
                  className={`nav ${page === kind ? 'active' : ''}`}
                  href={learningPaths[kind]}
                  key={kind}
                  onClick={(e) => {
                    e.preventDefault();
                    openLearning(kind);
                  }}
                >
                  {t(`learn:${kind}Nav`)}
                </a>
              ))}
              <button className="nav" onClick={() => setRulesOpen(true)}>
                {t('rules')}
              </button>
            </nav>
            <details className="mobile-nav">
              <summary aria-label={t('learn:menu')}>☰</summary>
              <div>
                <button
                  onClick={(e) => {
                    e.currentTarget.closest('details')!.open = false;
                    navigate();
                  }}
                >
                  {t('club:home')}
                </button>
                <button
                  onClick={(e) => {
                    e.currentTarget.closest('details')!.open = false;
                    openLobby();
                  }}
                >
                  {t('club:tables')}
                </button>
                {(['guide', 'hands', 'help'] as const).map((kind) => (
                  <a
                    href={learningPaths[kind]}
                    key={kind}
                    onClick={(e) => {
                      e.preventDefault();
                      e.currentTarget.closest('details')!.open = false;
                      openLearning(kind);
                    }}
                  >
                    {t(`learn:${kind}Nav`)}
                  </a>
                ))}
                <button
                  onClick={(e) => {
                    e.currentTarget.closest('details')!.open = false;
                    setRulesOpen(true);
                  }}
                >
                  {t('rules')}
                </button>
              </div>
            </details>
            <div className="header-right">
              <label className="language">
                <span className="language-globe" aria-hidden>
                  🌐
                </span>
                <span className="language-code" aria-hidden>
                  {i18n.language === 'en' ? 'EN' : 'PT'}
                </span>
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
        )}
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
        <main onPointerDownCapture={primeTableAudio}>
          {!connected && page === 'play' && <p className="banner">{t('offlineNotice')}</p>}
          {page !== 'play' ? (
            <LearningPage kind={page} onPlay={() => navigate()} onSection={openLearning} />
          ) : !roomId ? (
            <>
              {homeScreen === 'home' && (
                <section className="hero">
                  <div className="hero-copy">
                    <p className="eyebrow">
                      <span /> {t('lobby:eyebrow')}
                    </p>
                    <h1>
                      {t('club:heroFirst')}
                      <br />
                      <em>{t('club:heroSecond')}</em>
                    </h1>
                    <p className="hero-intro">{t('lobby:intro')}</p>
                    <div className="hero-actions">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => setCreateOpen(true)}
                      >
                        <span>{t('lobby:createRoom')}</span>
                        <svg aria-hidden="true" viewBox="0 0 20 20">
                          <path d="M6 14 14 6M6.5 6H14v7.5" />
                        </svg>
                      </button>
                      <button className="hero-find" onClick={openLobby}>
                        <span>{t('club:findTable')}</span>
                        <svg aria-hidden="true" viewBox="0 0 20 20">
                          <path d="M3.5 10h12M10 4.5l5.5 5.5-5.5 5.5" />
                        </svg>
                      </button>
                    </div>
                    <div className="hero-trust">
                      <span>♠</span> {t('lobby:stats')}
                    </div>
                  </div>
                  <ClubArtwork />
                </section>
              )}
              {homeScreen === 'lobby' && (
                <div className="club-lobby-heading">
                  <div>
                    <p className="eyebrow">{t('club:chooseSeat')}</p>
                    <h1>{t('club:lobbyTitle')}</h1>
                    <p>{t('club:lobbyIntro')}</p>
                  </div>
                  <button className="primary" onClick={() => setCreateOpen(true)}>
                    {t('lobby:createRoom')}
                  </button>
                </div>
              )}
              {homeScreen === 'lobby' && (
                <div className="lobby-layout lobby-layout-premium">
                  <section className="rooms">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {t('lobby:rooms')} <span className="count">{lobby.rooms.length}</span>
                        </h2>
                        <p>{t('lobby:subtitle')}</p>
                        <p className="lobby-retention">{t('lobby:retentionHint')}</p>
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
                    <div className="lobby-table" role="region" aria-label={t('lobby:rooms')}>
                      <div className="lobby-table-head" aria-hidden="true">
                        <span>{t('lobby:rooms')}</span>
                        <span>{t('lobby:mode')}</span>
                        <span>Blinds</span>
                        <span>{t('lobby:occupiedSeats')}</span>
                        <span>{t('lobby:status')}</span>
                        <span />
                      </div>
                      <div className="room-list">
                        {filteredRooms.map((r) => (
                          <article className={`room-card room-${r.mode.toLowerCase()}`} key={r.id}>
                            <div className="room-title-cell">
                              <span className="room-symbol" aria-hidden="true">
                                {r.mode === 'CASH' ? '♠' : r.mode === 'SIT_AND_GO' ? '♜' : '♛'}
                              </span>
                              <div className="room-info">
                                <h3>
                                  {r.title}
                                  {r.protected && (
                                    <span className="room-lock" title={t('lobby:protected')}>
                                      ⌑
                                    </span>
                                  )}
                                </h3>
                                <p className="room-presence">
                                  <span className={r.humansOnline ? 'online-dot' : ''}>●</span>{' '}
                                  {t('lobby:humansOnline', { count: r.humansOnline ?? 0 })} ·{' '}
                                  {t('lobby:botsCount', { count: r.bots ?? 0 })}
                                  {r.humansOffline > 0 && (
                                    <> · {t('lobby:humansOffline', { count: r.humansOffline })}</>
                                  )}
                                  {r.spectatorsOnline > 0 && (
                                    <>
                                      {' '}
                                      · {t('lobby:spectatorsOnline', { count: r.spectatorsOnline })}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="room-mode-cell">{t(`game:${r.mode}`)}</span>
                            <strong className="room-blinds-cell">
                              {num(r.small)} / {num(r.big)}
                            </strong>
                            <div className="room-players-cell">
                              <strong>
                                {r.players}/{r.capacity} {t('lobby:occupiedSeats')}
                              </strong>
                              <div
                                className="room-occupancy"
                                aria-label={`${r.players}/${r.capacity}`}
                              >
                                {Array.from({ length: Math.min(r.capacity, 9) }, (_, i) => (
                                  <i className={i < r.players ? 'occupied' : ''} key={i} />
                                ))}
                              </div>
                            </div>
                            <span className={`room-status-cell status-${r.status.toLowerCase()}`}>
                              <i aria-hidden="true" /> {t(`game:${r.status}`)}
                            </span>
                            <div className="room-buttons">
                              <button
                                disabled={
                                  busy ||
                                  r.players >= r.capacity ||
                                  ['FINISHED', 'EXPIRED'].includes(r.status)
                                }
                                className="primary small"
                                onClick={() => setJoinDialog({ id: r.id, watch: false })}
                              >
                                {t('lobby:join')}
                              </button>
                              <button
                                disabled={busy}
                                className="text-button"
                                onClick={() => setJoinDialog({ id: r.id, watch: true })}
                              >
                                {t('watch')}
                              </button>
                            </div>
                          </article>
                        ))}
                        {filteredRooms.length === 0 && (
                          <div className="empty-state">
                            <span>♠</span>
                            <h3>{t(lobby.rooms.length ? 'lobby:noResults' : 'lobby:noRooms')}</h3>
                            <p>
                              {t(lobby.rooms.length ? 'lobby:changeFilters' : 'lobby:noRoomsText')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                  {homeScreen === 'lobby' && (
                    <aside className="lobby-aside">
                      <div className="lobby-aside-crest" aria-hidden="true">
                        ♠
                      </div>
                      <p className="eyebrow">HIGHLORDS POKER CLUB</p>
                      <h2>{t('club:goodCompany')}</h2>
                      <p>{t('club:lobbyIntro')}</p>
                      <div className="lobby-aside-divider" />
                      <strong>{t('learn:guideNav')}</strong>
                      <button onClick={() => openLearning('guide')}>
                        {t('learn:guideNav')} <span>↗</span>
                      </button>
                      <button onClick={() => openLearning('hands')}>
                        {t('learn:handsNav')} <span>↗</span>
                      </button>
                      <button onClick={() => openLearning('help')}>
                        {t('learn:helpNav')} <span>↗</span>
                      </button>
                    </aside>
                  )}
                </div>
              )}
              {homeScreen === 'home' && <ClubFeatures onLearn={() => openLearning('guide')} />}
            </>
          ) : (
            <>
              {snapshot ? (
                <div className="club-room">
                  <div className="room-heading">
                    <button className="room-brand" aria-label={t('back')} onClick={openLobby}>
                      <span>♠</span>
                      <b>
                        HIGHLORDS<small>POKER CLUB</small>
                      </b>
                    </button>
                    <div className="room-name">
                      <h1>{snapshot.config.title}</h1>
                      <p>
                        {t(`game:${snapshot.config.mode}`)} · {num(snapshot.level.small)} /{' '}
                        {num(snapshot.level.big)} · {t(`game:${snapshot.status}`)}
                      </p>
                    </div>
                    <div className="room-controls">
                      <button
                        className="panel-trigger"
                        aria-label={t('game:manageRoom')}
                        onClick={() => {
                          setRailTab('players');
                          setDirectorOpen(true);
                        }}
                      >
                        <span className="button-label">{t('game:manageRoom')}</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 6h16M4 12h16M4 18h16" />
                          <circle cx="9" cy="6" r="2" />
                          <circle cx="15" cy="12" r="2" />
                          <circle cx="9" cy="18" r="2" />
                        </svg>
                      </button>
                      <button
                        className="panel-trigger chat-shortcut"
                        aria-label={t('game:panelchat')}
                        onClick={() => {
                          setMobileChatOpen(true);
                          document
                            .getElementById('table-live-chat')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                      >
                        <span className="button-label">{t('game:panelchat')}</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 4h16v12H9l-5 4Z" />
                          <path d="M8 8h8M8 12h5" />
                        </svg>
                      </button>
                      {snapshot.host && ['RUNNING', 'PAUSED'].includes(snapshot.status) && (
                        <button
                          className="pause-button"
                          disabled={busy}
                          onClick={() =>
                            void run(snapshot.status === 'PAUSED' ? 'RESUME' : 'PAUSE')
                          }
                        >
                          {t(snapshot.status === 'PAUSED' ? 'game:resume' : 'game:pause')}
                        </button>
                      )}
                      <button
                        className="sound-toggle"
                        aria-label={t(prefs.sound ? 'club:muteSound' : 'club:enableSound')}
                        title={t(prefs.sound ? 'club:muteSound' : 'club:enableSound')}
                        aria-pressed={prefs.sound}
                        onClick={() => {
                          const next = { ...prefs, sound: !prefs.sound };
                          setPrefs(next);
                          write('highlords.preferences', next);
                          primeTableAudio();
                          if (next.sound) playTableSound('enable');
                        }}
                      >
                        <span aria-hidden="true">{prefs.sound ? '♪' : '♪̸'}</span>
                        <span className="sound-text">
                          {t(prefs.sound ? 'club:soundOn' : 'club:soundOff')}
                        </span>
                      </button>
                      <label className="language">
                        <select
                          aria-label={t('selectLanguage')}
                          value={i18n.language}
                          onChange={(e) => void i18n.changeLanguage(e.target.value)}
                        >
                          <option value="pt-BR">PT-BR</option>
                          <option value="en">EN</option>
                        </select>
                      </label>
                      <details className="room-options">
                        <summary>{t('learn:options')}</summary>
                        <div>
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
                          <button onClick={() => setProfileOpen(true)}>{t('profile')}</button>
                          <button onClick={() => setLesson('guide')}>{t('learn:guideNav')}</button>
                          <button onClick={() => setLesson('hands')}>{t('learn:handsNav')}</button>
                          <button onClick={() => setLesson('help')}>{t('learn:helpNav')}</button>
                          <button onClick={() => setRulesOpen(true)}>{t('rules')}</button>
                          {snapshot.host && (
                            <>
                              <button onClick={() => void run('EXPORT')}>{t('game:export')}</button>
                              {snapshot.closeSupported && (
                                <button
                                  className="close-room-button"
                                  disabled={busy || !connected}
                                  onClick={() => setCloseRoomOpen(true)}
                                >
                                  {t('game:closeRoom')}
                                </button>
                              )}
                            </>
                          )}
                          <button className="leave-button" onClick={() => setLeaveOpen(true)}>
                            {t('leave')}
                          </button>
                          <button onClick={openLobby}>{t('back')}</button>
                        </div>
                      </details>
                    </div>
                  </div>
                  {snapshot.pauseReason === 'EMPTY' && (
                    <p className="banner">{t('game:pauseEmpty')}</p>
                  )}
                  {snapshot.expiresAt && (
                    <p className="retention-notice">
                      {t(snapshot.status === 'FINISHED' ? 'game:resultsUntil' : 'game:emptyUntil', {
                        time: new Intl.DateTimeFormat(i18n.language, {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(snapshot.expiresAt),
                      })}
                    </p>
                  )}
                  {snapshot.status !== 'FINISHED' && (
                    <>
                      <TournamentPresentation snapshot={snapshot} num={num} />
                    </>
                  )}
                  <div className="game-layout">
                    <section className="game-stage">
                      {snapshot.status !== 'FINISHED' && (
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
                      )}
                      <div className="scene-viewport">
                        {snapshot.status === 'FINISHED' && snapshot.config.mode !== 'CASH' ? (
                          <TournamentPresentation snapshot={snapshot} num={num} finished />
                        ) : (
                          <PokerTable
                            snapshot={snapshot}
                            table={table}
                            bestFive={
                              coach && table?.hand
                                ? visibleHand(
                                    table.hand.players.find((p) => p.id === snapshot.me)?.cards ??
                                      [],
                                    table.hand.board,
                                  )?.bestFive
                                : undefined
                            }
                            clock={clock}
                            num={num}
                            busy={busy || !connected}
                            onSelect={(id) => {
                              setSelectedPlayer(id);
                              setRailTab('players');
                              setDirectorOpen(true);
                            }}
                            onAddBot={() =>
                              void run('ADD_BOTS', { difficulty: 'MEDIUM', count: 1 })
                            }
                            onStart={() => void run('START')}
                          />
                        )}
                      </div>
                      {table?.hand && snapshot.status !== 'FINISHED' && (
                        <div className="decision-zone">
                          <DecisionDock
                            snapshot={snapshot}
                            table={table}
                            coach={coach}
                            onCoach={toggleCoach}
                            onRankings={() => setLesson('hands')}
                          />
                          <ActionBar
                            snapshot={snapshot}
                            table={table}
                            busy={busy || !connected}
                            onAction={(action, amount) => run('ACT', { action, amount })}
                          />
                        </div>
                      )}
                    </section>
                    <aside
                      className={`table-chat-dock ${mobileChatOpen ? 'chat-expanded' : ''}`}
                      id="table-live-chat"
                      aria-label={t('game:panelchat')}
                    >
                      <div className="table-chat-topline">
                        <div>
                          <span className="live-indicator" />
                          <strong>{t('club:liveChat')}</strong>
                          <small>{t('club:chatHint')}</small>
                        </div>
                        <button
                          type="button"
                          className="mobile-chat-toggle"
                          aria-expanded={mobileChatOpen}
                          onClick={() => setMobileChatOpen((value) => !value)}
                        >
                          {mobileChatOpen ? '−' : '+'}
                        </button>
                      </div>
                      <Chat
                        messages={snapshot.chat as Messages}
                        me={snapshot.me}
                        disabled={busy || !connected}
                        onSend={(text) => run('CHAT', { text })}
                        onReact={(messageId, emoji) => run('REACT', { messageId, emoji })}
                      />
                    </aside>
                  </div>
                </div>
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
        {!roomId && (
          <footer>
            <span>♠ HIGHLORDS POKER</span>
            <p>{t('virtual')}</p>
            <span>{t('tagline')}</span>
          </footer>
        )}
        {snapshot && directorOpen && (
          <Modal title={t('game:roomPanel')} onClose={closeDirector}>
            <div className="director-dialog">
              {' '}
              <RoomDirector
                snapshot={snapshot}
                busy={busy || !connected}
                num={num}
                run={run}
                tab={railTab}
                onTab={setRailTab}
                selected={selectedPlayer}
                chat={
                  <Chat
                    messages={snapshot.chat as Messages}
                    me={snapshot.me}
                    disabled={busy || !connected}
                    onSend={(text) => run('CHAT', { text })}
                    onReact={(messageId, emoji) => run('REACT', { messageId, emoji })}
                  />
                }
              />
              <div className="room-extras">
                {railTab === 'structure' && <RoomStats snapshot={snapshot} num={num} />}{' '}
                {snapshot.status !== 'FINISHED' && (
                  <div className="personal-controls">
                    {me && !me.left ? (
                      <>
                        <span>
                          {t('game:bank', { seconds: me.bank })}{' '}
                          {me.sitOut && '· ' + t('game:sitOutStatus')}
                        </span>
                        {snapshot.config.mode === 'CASH' && (
                          <button disabled={busy} onClick={() => void run('SIT_OUT')}>
                            {t(me.sitOut ? 'learn:sitIn' : 'learn:sitOut')}
                          </button>
                        )}
                        <button
                          disabled={busy || !canTopUp}
                          title={t('game:topUpHint')}
                          onClick={() =>
                            setTopUp(
                              snapshot.config.mode === 'CASH'
                                ? snapshot.config.minBuyIn
                                : snapshot.config.stack,
                            )
                          }
                        >
                          {t('game:topUp')}
                        </button>
                        {snapshot.config.mode !== 'CASH' && (
                          <button disabled={busy || !canAddOn} onClick={() => void run('ADD_ON')}>
                            {t('game:addOn')}
                          </button>
                        )}
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
                )}
                {table?.hand && (
                  <details className="history">
                    <summary>{t('game:actions')}</summary>
                    {table.hand.log.map((event, i) => (
                      <p key={i}>
                        {snapshot.players.find((p) => p.id === event.player)?.profile?.nickname} ·{' '}
                        {t(`game:${event.action}`)} {event.amount > 0 ? num(event.amount) : ''}
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
              </div>
            </div>
          </Modal>
        )}
        {topUp !== null && snapshot && (
          <Modal title={t('game:topUp')} onClose={closeTopUp}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run('TOP_UP', { amount: topUp })) setTopUp(null);
              }}
            >
              <p className="muted">{t('game:topUpHint')}</p>
              <label>
                {t('game:amount')}
                <input
                  type="number"
                  required
                  min={
                    snapshot.config.mode === 'CASH'
                      ? snapshot.config.minBuyIn
                      : snapshot.config.stack
                  }
                  max={
                    snapshot.config.mode === 'CASH'
                      ? snapshot.config.maxBuyIn - (me?.stack ?? 0)
                      : snapshot.config.stack
                  }
                  value={topUp}
                  onChange={(e) => setTopUp(Number(e.target.value))}
                />
              </label>
              <button className="primary" disabled={busy}>
                {t('confirm')}
              </button>
            </form>
          </Modal>
        )}
        {closeRoomOpen && (
          <Modal title={t('game:closeRoom')} onClose={dismissCloseRoom}>
            <p>{t('game:closeRoomHint')}</p>
            <div className="modal-actions">
              <button onClick={dismissCloseRoom}>{t('cancel')}</button>
              <button className="danger" disabled={busy} onClick={() => void run('CLOSE_ROOM')}>
                {t('game:confirmCloseRoom')}
              </button>
            </div>
          </Modal>
        )}
        {leaveOpen && (
          <Modal title={t('leave')} onClose={closeLeave}>
            <p>{t('game:leaveHint')}</p>
            <div className="modal-actions">
              <button onClick={closeLeave}>{t('cancel')}</button>
              <button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  if (await run('LEAVE')) {
                    setLeaveOpen(false);
                    navigate();
                  }
                }}
              >
                {t('leave')}
              </button>
            </div>
          </Modal>
        )}
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
          <CreateRoom
            busy={busy}
            onClose={closeCreate}
            onCreate={create}
            onError={fail}
            profile={prefs.profile}
            onProfileChange={changeQuickProfile}
          />
        )}
        {lesson && (
          <Modal title={t('learn:learningModal')} onClose={closeLesson}>
            <LearningPage kind={lesson} onSection={setLesson} />
            <p className="lesson-note">{t('learn:coachingNotice')}</p>
          </Modal>
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
            profile={prefs.profile}
            onProfileChange={changeQuickProfile}
            onJoin={(password, buyIn) => join(joinDialog.id, password, joinDialog.watch, buyIn)}
          />
        )}
      </div>
    </ErrorContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
