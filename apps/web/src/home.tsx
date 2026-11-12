import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProfileSchema,
  ROOM_CODE_PATTERN,
  type Config,
  type LobbyEntry,
} from '../../../packages/contracts/src/index.ts';
import { ApiError, createRoom, fetchLobby, fetchRoom } from './net.ts';
import { AvatarPicker, Modal } from './panels.tsx';
import { playSound } from './audio.ts';
import { profileStore, useStore } from './store.ts';

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
  const { t } = useTranslation();
  const { profile, valid } = useProfileCheck();
  const [rooms, setRooms] = useState<LobbyEntry[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
          <img className="hero-logo" src="/highlords-torch.png" alt="" />
          <h1>{t('home:heroTitle')}</h1>
          <p>{t('home:heroSub')}</p>
        </div>

        <div className="join-card">
          <label htmlFor="nickname">{t('home:yourName')}</label>
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
          <AvatarPicker
            value={profile.avatar}
            onChange={(avatar) => profileStore.set({ avatar })}
          />
          <div className="cta-row">
            <button
              className="primary big"
              onClick={() => {
                playSound('click');
                if (!needName()) setCreating(true);
              }}
            >
              {t('home:createTable')}
            </button>
            <button className="big" disabled={busy} onClick={() => void quickBots()}>
              {t('home:playBots')}
              <small>{t('home:playBotsHint')}</small>
            </button>
          </div>
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
        </div>
      </section>

      <section className="lobby" aria-labelledby="open-tables">
        <h2 id="open-tables">{t('home:openTables')}</h2>
        {rooms === null ? (
          <div className="spinner" aria-label={t('common:loading')} />
        ) : rooms.length === 0 ? (
          <div className="empty-lobby">
            <strong>{t('home:noTables')}</strong>
            <p>{t('home:noTablesText')}</p>
          </div>
        ) : (
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  className="room-card"
                  onClick={() => {
                    playSound('click');
                    if (!needName()) navigate(`/mesa/${room.id}`);
                  }}
                >
                  <span className="room-seats" aria-hidden>
                    {Array.from({ length: room.seats }, (_, i) => (
                      <i key={i} className={i < room.players ? 'taken' : ''} />
                    ))}
                  </span>
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
                    {t(`home:${room.mode}`)} ·{' '}
                    {t('home:blinds', { small: room.small, big: room.big })}
                  </small>
                  <small>
                    {t('home:seatsOf', { players: room.players, seats: room.seats })}
                    {room.online > 0 && ` · ${t('home:online', { count: room.online })}`}
                    {room.host && ` · ${t('home:byHost', { name: room.host })}`}
                  </small>
                  <span className={`status status-${room.status.toLowerCase()}`}>
                    {t(`home:${room.status}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
