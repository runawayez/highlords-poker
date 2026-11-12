import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProfileSchema,
  ROOM_CODE_PATTERN,
  type Config,
  type LobbyEntry,
} from '../../../packages/contracts/src/index.ts';
import { ApiError, createRoom, fetchLobby, fetchRoom } from './net.ts';
import { Avatar } from './avatar.tsx';
import { Card } from './card.tsx';
import { randomNickname } from './names.ts';
import { Modal } from './panels.tsx';
import { ProfileModal } from './profile.tsx';
import { playSound } from './audio.ts';
import { profileStore, recentStore, useStore } from './store.ts';

const BLINDS = [
  [10, 20],
  [25, 50],
  [50, 100],
] as const;

function useProfileCheck() {
  const profile = useStore(profileStore);
  const valid = ProfileSchema.safeParse(profile).success;
  return { profile, valid };
}

export function Home({ navigate }: { navigate: (path: string) => void }) {
  const { t, i18n } = useTranslation();
  const { profile, valid } = useProfileCheck();
  const [rooms, setRooms] = useState<LobbyEntry[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CASH' | 'SIT_AND_GO'>('ALL');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [stakes, setStakes] = useState<'ALL' | 'LOW' | 'MID' | 'HIGH'>('ALL');
  const recent = useStore(recentStore).tables;

  useEffect(() => {
    let stopped = false;
    const load = () =>
      fetchLobby()
        .then((list) => !stopped && setRooms(list))
        .catch(() => !stopped && setRooms((current) => current ?? []));
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const visibleRooms = (rooms ?? []).filter(
    (room) =>
      (filter === 'ALL' || room.mode === filter) &&
      (stakes === 'ALL' ||
        (stakes === 'LOW'
          ? room.big <= 20
          : stakes === 'MID'
            ? room.big > 20 && room.big <= 100
            : room.big > 100)) &&
      (!onlyOpen || (room.players < room.seats && room.status !== 'FINISHED')),
  );

  const needName = () => {
    if (valid) return false;
    setMessage(t('home:nameShort'));
    document.getElementById('nickname')?.focus();
    return true;
  };

  const quickBots = async () => {
    if (needName()) return;
    setBusy(true);
    try {
      const id = await createRoom(
        {
          title: t('home:defaultTitle', { name: profile.nickname }),
          mode: 'CASH',
          seats: 6,
          stack: 2000,
          small: 10,
          big: 20,
          botPace: 'CALM',
        },
        profile,
      );
      sessionStorage.setItem(`highlords.quick.${id}`, '3');
      navigate(`/mesa/${id}`);
    } catch {
      setMessage(t('home:createError'));
      setBusy(false);
    }
  };

  const joinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(value)) return setMessage(t('home:codeInvalid'));
    if (needName()) return;
    try {
      await fetchRoom(value);
      navigate(`/mesa/${value}`);
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.code === 'ROOM_NOT_FOUND'
          ? t('home:roomNotFound')
          : t('home:createError'),
      );
    }
  };

  return (
    <main className="home" id="content">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('home:eyebrow')}</p>
          <h1>{t('home:heroTitle')}</h1>
          <p>{t('home:heroSub')}</p>
          <HeroTable />
        </div>

        <div className="join-card">
          <label htmlFor="nickname">{t('home:yourName')}</label>
          <div className="name-row">
            <input
              id="nickname"
              value={profile.nickname}
              maxLength={20}
              autoComplete="nickname"
              onChange={(e) => {
                setMessage('');
                profileStore.set({ nickname: e.target.value });
              }}
            />
            <button
              type="button"
              className="dice"
              aria-label={t('home:randomName')}
              title={t('home:randomName')}
              onClick={() => {
                playSound('click');
                setMessage('');
                profileStore.set({ nickname: randomNickname(i18n.language) });
              }}
            >
              🎲
            </button>
          </div>
          <button
            type="button"
            className="profile-chip"
            data-frame={profile.color ?? 'brass'}
            onClick={() => setProfileOpen(true)}
          >
            <span className="avatar-frame">
              <Avatar avatar={profile.avatar} photo={profile.photo} />
            </span>
            <span>
              <b>{t('profile:customize')}</b>
              <small>{t('profile:customizeHint')}</small>
            </span>
          </button>
          <button className="primary huge" disabled={busy} onClick={() => void quickBots()}>
            {t('home:playBots')}
            <small>{t('home:playBotsHint')}</small>
          </button>
          <button
            className="big"
            onClick={() => {
              playSound('click');
              if (!needName()) setCreating(true);
            }}
          >
            {t('home:createTable')}
          </button>
          <form className="code-row" onSubmit={joinByCode}>
            <label htmlFor="code">{t('home:joinCode')}</label>
            <input
              id="code"
              value={code}
              maxLength={6}
              placeholder={t('home:joinPlaceholder')}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => {
                setMessage('');
                setCode(e.target.value.toUpperCase());
              }}
            />
            <button type="submit">{t('home:join')}</button>
          </form>
          {message && (
            <p className="error" role="alert">
              {message}
            </p>
          )}
          {recent.length > 0 && (
            <div className="recent">
              <small>{t('home:recent')}</small>
              <ul>
                {recent.map((table) => (
                  <li key={table.id}>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => !needName() && navigate(`/mesa/${table.id}`)}
                    >
                      {table.title} <code>{table.id}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="lobby" aria-labelledby="open-tables">
        <div className="lobby-head">
          <h2 id="open-tables">{t('home:openTables')}</h2>
          <div className="lobby-filters" role="group" aria-label={t('home:filters')}>
            <div className="segmented-bar" role="group" aria-label={t('home:format')}>
              {(['ALL', 'CASH', 'SIT_AND_GO'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'ALL' ? t('home:filterAll') : t(`home:${value}`)}
                </button>
              ))}
            </div>
            <div className="segmented-bar" role="group" aria-label={t('home:filterStakes')}>
              {(['ALL', 'LOW', 'MID', 'HIGH'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={stakes === value}
                  onClick={() => setStakes(value)}
                >
                  {t(`home:stakesShort_${value}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="toggle-chip"
              aria-pressed={onlyOpen}
              onClick={() => setOnlyOpen(!onlyOpen)}
            >
              {t('home:filterOpen')}
            </button>
          </div>
        </div>
        {rooms === null ? (
          <div className="spinner" aria-label={t('common:loading')} />
        ) : rooms.length === 0 ? (
          <div className="empty-lobby">
            <strong>{t('home:noTables')}</strong>
            <p>{t('home:noTablesText')}</p>
          </div>
        ) : (
          <ul className="room-list">
            <li className="room-head" aria-hidden>
              <span>{t('home:colTable')}</span>
              <span>{t('home:colBlinds')}</span>
              <span>{t('home:colSeats')}</span>
              <span>{t('home:colStatus')}</span>
            </li>
            {visibleRooms.map((room) => (
              <li key={room.id}>
                <button
                  className="room-card"
                  onClick={() => {
                    playSound('click');
                    if (!needName()) navigate(`/mesa/${room.id}`);
                  }}
                >
                  <span className="room-name">
                    <strong>
                      {room.title}
                      {room.locked && (
                        <span title={t('home:locked')} aria-label={t('home:locked')}>
                          {' '}
                          🔒
                        </span>
                      )}
                    </strong>
                    <small>
                      {t(`home:${room.mode}`)}
                      {room.host && ` · ${t('home:byHost', { name: room.host })}`}
                    </small>
                  </span>
                  <span className="room-blinds">
                    {room.small}/{room.big}
                  </span>
                  <span className="room-seats-cell">
                    <span className="room-seats" aria-hidden>
                      {Array.from({ length: room.seats }, (_, i) => (
                        <i key={i} className={i < room.players ? 'taken' : ''} />
                      ))}
                    </span>
                    <small>{t('home:seatsOf', { players: room.players, seats: room.seats })}</small>
                  </span>
                  <span className={`status status-${room.status.toLowerCase()}`}>
                    {t(`home:${room.status}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/mesa/${id}`)}
        />
      )}
      <footer className="home-footer">
        <p>{t('common:virtual')}</p>
        <p>{t('home:footerNote')}</p>
      </footer>
    </main>
  );
}

/** Mesa de vitrine do hero: puramente visual, mostra o clima do jogo antes de entrar. */
function HeroTable() {
  const seats = [
    { avatar: 'g5', style: { left: '50%', top: '4%' } },
    { avatar: 'g2', style: { left: '88%', top: '30%' } },
    { avatar: 'g9', style: { left: '80%', top: '82%' } },
    { avatar: 'g4', style: { left: '20%', top: '82%' } },
    { avatar: 'g8', style: { left: '12%', top: '30%' } },
  ];
  return (
    <div className="hero-table" aria-hidden>
      <div className="hero-rail">
        <div className="hero-felt">
          <div className="hero-board">
            {['As', 'Kh', 'Qd', 'Jc', 'Ts'].map((card, i) => (
              <Card key={card} card={card} className="hero-card" style={{ ['--i' as string]: i }} />
            ))}
          </div>
          <span className="hero-pot">♠ 1.240</span>
        </div>
      </div>
      {seats.map((seat, i) => (
        <span key={i} className="hero-seat" style={seat.style}>
          <Avatar avatar={seat.avatar} />
        </span>
      ))}
    </div>
  );
}

function CreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { profile } = useProfileCheck();
  const [title, setTitle] = useState(t('home:defaultTitle', { name: profile.nickname }));
  const [mode, setMode] = useState<Config['mode']>('CASH');
  const [seats, setSeats] = useState(6);
  const [blinds, setBlinds] = useState<(typeof BLINDS)[number]>(BLINDS[0]);
  const [depth, setDepth] = useState(100);
  const [password, setPassword] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [turnSeconds, setTurnSeconds] = useState(25);
  const [levelMinutes, setLevelMinutes] = useState(5);
  const [antePercent, setAntePercent] = useState(0);
  const [straddle, setStraddle] = useState(false);
  const [botPace, setBotPace] = useState<Config['botPace']>('NORMAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return setError(t('home:createError'));
    setBusy(true);
    try {
      const id = await createRoom(
        {
          title: title.trim(),
          password,
          mode,
          seats,
          small: blinds[0],
          big: blinds[1],
          stack: blinds[1] * depth,
          turnSeconds,
          levelMinutes,
          isPublic,
          ante: mode === 'CASH' ? Math.round((blinds[1] * antePercent) / 100) : 0,
          straddle: mode === 'CASH' && straddle,
          botPace,
        },
        profile,
      );
      onCreated(id);
    } catch {
      setError(t('home:createError'));
      setBusy(false);
    }
  };

  return (
    <Modal title={t('home:createTitle')} onClose={onClose}>
      <form className="create-form" onSubmit={submit}>
        <label>
          {t('home:tableName')}
          <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <fieldset>
          <legend>{t('home:format')}</legend>
          <div className="segmented two">
            {(['CASH', 'SIT_AND_GO'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                <strong>{value === 'CASH' ? t('home:formatCash') : t('home:formatSng')}</strong>
                <small>
                  {value === 'CASH' ? t('home:formatCashHint') : t('home:formatSngHint')}
                </small>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('home:seats')}</legend>
          <div className="segmented chips">
            {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button type="button" key={n} aria-pressed={seats === n} onClick={() => setSeats(n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('home:blindsLabel')}</legend>
          <div className="segmented chips">
            {BLINDS.map((b) => (
              <button
                type="button"
                key={b[0]}
                aria-pressed={blinds === b}
                onClick={() => setBlinds(b)}
              >
                {b[0]}/{b[1]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('home:stackLabel')}</legend>
          <div className="segmented chips">
            {[50, 100, 200].map((n) => (
              <button type="button" key={n} aria-pressed={depth === n} onClick={() => setDepth(n)}>
                {t('home:bigBlinds', { count: n })}
              </button>
            ))}
          </div>
        </fieldset>

        <details>
          <summary>{t('home:advanced')}</summary>
          <label>
            {t('home:password')}
            <input
              type="password"
              value={password}
              maxLength={40}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>{t('home:passwordHint')}</small>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            {t('home:listPublic')}
          </label>
          <label>
            {t('home:turnSeconds')}
            <select value={turnSeconds} onChange={(e) => setTurnSeconds(Number(e.target.value))}>
              {[15, 25, 40, 60].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            {t('home:botPace')}
            <select
              value={botPace}
              onChange={(e) => setBotPace(e.target.value as Config['botPace'])}
            >
              {(['CALM', 'NORMAL', 'FAST'] as const).map((pace) => (
                <option key={pace} value={pace}>
                  {t(`home:pace_${pace}`)}
                </option>
              ))}
            </select>
          </label>
          {mode === 'CASH' && (
            <>
              <label>
                {t('home:ante')}
                <select
                  value={antePercent}
                  onChange={(e) => setAntePercent(Number(e.target.value))}
                >
                  {[0, 10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t('home:anteNone') : t('home:antePercent', { percent: n })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={straddle}
                  onChange={(e) => setStraddle(e.target.checked)}
                />
                {t('home:straddle')}
              </label>
            </>
          )}
          {mode === 'SIT_AND_GO' && (
            <label>
              {t('home:levelMinutes')}
              <select
                value={levelMinutes}
                onChange={(e) => setLevelMinutes(Number(e.target.value))}
              >
                {[3, 5, 10].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </details>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? t('home:creating') : t('home:create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
