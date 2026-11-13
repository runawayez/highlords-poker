import { QrCode } from './qr.tsx';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotosContext } from './avatar.tsx';
import { useTableFx } from './fx.ts';
import { LearningCenter, type LearningSection } from './learning.tsx';
import { useRoom } from './net.ts';
import { Chat, ChatStrip, Modal, SidePanel, type Tab } from './panels.tsx';
import { ProfileModal } from './profile.tsx';
import { SettingsModal } from './settings.tsx';
import { ActionBar, Table } from './table.tsx';
import { Tour } from './tour.tsx';
import { playSound } from './audio.ts';
import { prefsStore, rememberTable, statsStore, useStore } from './store.ts';

/** Acompanha uma media query (ex.: tela larga) e reage quando ela muda. */
function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function RoomPage({ code, navigate }: { code: string; navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const room = useRoom(code);
  const { state } = room;
  const fx = useTableFx(state);
  const prefs = useStore(prefsStore);
  const wide = useMedia('(min-width: 900px)');
  const [panelRequest, setPanel] = useState<Tab | null>(null);
  // Em tela larga o chat fica fixo ao lado da mesa; o painel só abre Mesa e Mãos.
  const panel = wide && panelRequest === 'chat' ? null : panelRequest;
  const [learning, setLearning] = useState<LearningSection | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [password, setPassword] = useState('');
  const [seenChat, setSeenChat] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tourOn, setTourOn] = useState(false);
  const bootstrapped = useRef(false);
  const statsFrom = useRef<number | null>(null);
  const me = state?.players.find((p) => p.id === state.me);

  // Reaplica no servidor as preferências de showdown quando me sento (valem por conexão/assento).
  const seatedId = me?.id;
  const sendRoom = room.send;
  useEffect(() => {
    if (!seatedId) return;
    const { muck, runTwice } = prefsStore.get();
    if (muck) sendRoom({ type: 'SHOWDOWN', mode: 'MUCK' });
    if (runTwice) sendRoom({ type: 'RUN_TWICE', value: true });
  }, [seatedId, sendRoom]);

  // Mesas recentes: o atalho na home volta para cá pelo código.
  const title = state?.config.title;
  useEffect(() => {
    if (title) rememberTable(code, title);
  }, [code, title]);

  // Estatísticas locais: conta só as mãos que terminam enquanto estou jogando nesta sala.
  useEffect(() => {
    if (!state) return;
    if (statsFrom.current === null) {
      statsFrom.current = state.handNo - (state.hand?.done ? 0 : 1);
      return;
    }
    const last = state.history[state.history.length - 1];
    if (!last || last.no <= statsFrom.current) return;
    statsFrom.current = last.no;
    const mine = last.players?.find((p) => p.id === state.me);
    if (!mine) return;
    const won = last.winners.find((w) => w.id === state.me);
    const current = statsStore.get();
    statsStore.set({
      hands: current.hands + 1,
      won: current.won + (won ? 1 : 0),
      folded: current.folded + (mine.folded ? 1 : 0),
      biggestPot: Math.max(current.biggestPot, won ? won.amount : 0),
    });
  }, [state]);

  // Passo a passo na primeira mesa, quando as primeiras cartas chegam.
  const hasCards = !!me && me.cards.length === 2;
  useEffect(() => {
    if (!prefs.tourDone && hasCards) setTourOn(true);
  }, [prefs.tourDone, hasCards]);
  const finishTour = () => {
    prefsStore.set({ tourDone: true });
    setTourOn(false);
  };

  // O criador senta sozinho; "jogar contra bots" também enche a mesa.
  useEffect(() => {
    if (!state || bootstrapped.current || !state.host || state.players.length > 0) return;
    bootstrapped.current = true;
    room.send({ type: 'SIT' });
    const quick = sessionStorage.getItem(`highlords.quick.${code}`);
    if (quick) {
      sessionStorage.removeItem(`highlords.quick.${code}`);
      for (let i = 0; i < Number(quick); i++) room.send({ type: 'ADD_BOT', difficulty: 'MEDIUM' });
    }
  }, [state, room, code]);

  useEffect(() => {
    if (!room.lastError) return;
    setToast(t(`errors:${room.lastError.code}`));
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [room.lastError, t]);

  const chatCount = state?.chat.filter((m) => m.text).length ?? 0;
  useEffect(() => {
    if (panel === 'chat') setSeenChat(chatCount);
  }, [panel, chatCount]);

  const invite = async () => {
    const url = `${location.origin}/mesa/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* o navegador pode bloquear a área de transferência */
    }
    playSound('click');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (room.fatal)
    return (
      <main className="notice">
        <h1>{room.fatal === 'KICKED' ? t('game:kicked') : t('game:roomGone')}</h1>
        <button className="primary" onClick={() => navigate('/')}>
          {t('game:backHome')}
        </button>
      </main>
    );

  const unread = wide ? 0 : Math.max(0, chatCount - seenChat);
  return (
    <PhotosContext.Provider value={room.photos}>
      <div className={`room ${wide ? 'wide' : 'compact'} ${panel ? 'with-panel' : ''}`}>
        <header className="room-bar">
          <button
            className="logo-button"
            onClick={() => navigate('/')}
            aria-label={t('game:backHome')}
          >
            <img src="/highlords-torch.png" alt="" />
          </button>
          <div className="room-title">
            <strong>{state?.config.title ?? '…'}</strong>
            {state && (
              <small>
                {t('game:code', { code })} ·{' '}
                {state.config.mode === 'CASH' ? t('home:CASH') : t('home:SIT_AND_GO')} ·{' '}
                {t('game:blindsNow', { small: state.level.small, big: state.level.big })}
                {state.level.ante > 0 && ` · ${t('game:ante', { ante: state.level.ante })}`}
              </small>
            )}
          </div>
          <div className="room-tools">
            <button className="primary small" onClick={invite}>
              {copied ? t('game:inviteCopied') : t('game:invite')}
            </button>
            <button
              className="icon-button sound-toggle"
              aria-pressed={prefs.sound}
              aria-label={prefs.sound ? t('game:soundOn') : t('game:soundOff')}
              title={prefs.sound ? t('game:soundOn') : t('game:soundOff')}
              onClick={() => {
                prefsStore.set({ sound: !prefs.sound });
                if (!prefs.sound) setTimeout(() => playSound('click'), 30);
              }}
            >
              {prefs.sound ? '🔊' : '🔇'}
            </button>
            <button
              className="icon-button"
              aria-label={t('game:rankings')}
              title={t('game:rankings')}
              data-tour="ranking"
              onClick={() => setLearning('hands')}
            >
              ?
            </button>
            {!wide && (
              <button
                className="icon-button chat-toggle"
                aria-label={t('game:tabChat')}
                aria-pressed={panel === 'chat'}
                onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
              >
                💬{unread > 0 && panel !== 'chat' && <i className="badge">{unread}</i>}
              </button>
            )}
            <button
              className="icon-button"
              aria-label={t('game:menu')}
              aria-pressed={panel === 'table'}
              onClick={() => setPanel(panel === 'table' ? null : 'table')}
            >
              ☰
            </button>
          </div>
        </header>

        {room.connection === 'reconnecting' && (
          <div className="banner-bar">{t('game:reconnecting')}</div>
        )}

        {!state ? (
          <main className="notice">
            <div className="spinner" aria-hidden />
            <p>{t('game:connecting')}</p>
          </main>
        ) : (
          <>
            <main className="room-main">
              <Table
                state={state}
                sweeps={fx.sweeps}
                emotes={fx.emotes}
                serverNow={room.serverNow}
                send={room.send}
                onPick={(player) =>
                  player.id === state.me ? setProfileOpen(true) : setPanel('table')
                }
              />
              {state.status === 'WAITING' && state.players.length < 2 && (
                <div className="waiting-card">
                  <small>{t('game:shareCode')}</small>
                  <strong>{code}</strong>
                  <QrCode text={`${location.origin}/mesa/${code}`} label={t('game:qrLabel')} />
                  <button className="primary small" onClick={invite}>
                    {copied ? t('game:inviteCopied') : t('game:invite')}
                  </button>
                </div>
              )}
              {!wide && <ChatStrip state={state} unread={unread} onOpen={() => setPanel('chat')} />}
              <ActionBar state={state} send={room.send} serverNow={room.serverNow} />
            </main>
            {wide && (
              <aside className="dock" aria-label={t('game:tabChat')}>
                <header>
                  <h2>{t('game:tabChat')}</h2>
                  <div className="dock-tabs">
                    <button
                      type="button"
                      className="ghost small"
                      aria-pressed={panel === 'table'}
                      onClick={() => setPanel(panel === 'table' ? null : 'table')}
                    >
                      {t('game:tabTable')}
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      aria-pressed={panel === 'history'}
                      onClick={() => setPanel(panel === 'history' ? null : 'history')}
                    >
                      {t('game:tabHistory')}
                    </button>
                  </div>
                </header>
                <Chat state={state} send={room.send} />
              </aside>
            )}
            {panel && (
              <SidePanel
                state={state}
                send={room.send}
                tab={panel}
                hideChat={wide}
                onTab={setPanel}
                onClose={() => setPanel(null)}
                onClosed={() => navigate('/')}
                unread={unread}
                onProfile={() => setProfileOpen(true)}
                onSettings={() => setSettingsOpen(true)}
              />
            )}
            {state.standings.length > 0 && state.status === 'FINISHED' && (
              <Podium state={state} onHome={() => navigate('/')} />
            )}
            {panel === 'table' && (
              <button
                className="leave-link"
                onClick={() => {
                  room.send({ type: 'LEAVE' });
                  navigate('/');
                }}
              >
                {t('game:leave')}
              </button>
            )}
          </>
        )}

        {toast && (
          <div className="toast" role="alert">
            {toast}
          </div>
        )}

        {room.needsPassword && (
          <Modal title={t('game:passwordTitle')} onClose={() => navigate('/')}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                room.submitPassword(password);
              }}
            >
              <p>{t('game:passwordPrompt')}</p>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label={t('home:password')}
              />
              {room.wrongPassword && <p className="error">{t('game:wrongPassword')}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => navigate('/')}>
                  {t('common:cancel')}
                </button>
                <button className="primary" type="submit">
                  {t('game:enter')}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {learning && (
          <Modal title={t('common:learn')} wide onClose={() => setLearning(null)}>
            <LearningCenter section={learning} onSection={setLearning} />
          </Modal>
        )}

        {profileOpen && (
          <ProfileModal
            onClose={() => setProfileOpen(false)}
            onSaved={(profile) => room.send({ type: 'PROFILE', profile })}
          />
        )}
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            send={room.send}
            onTour={() => setTourOn(true)}
          />
        )}
        {tourOn && <Tour onDone={finishTour} />}
      </div>
    </PhotosContext.Provider>
  );
}

function Podium({
  state,
  onHome,
}: {
  state: NonNullable<ReturnType<typeof useRoom>['state']>;
  onHome: () => void;
}) {
  const { t } = useTranslation();
  const champion = state.standings[0];
  return (
    <div className="podium-overlay">
      <div className="podium">
        <span className="trophy" aria-hidden>
          ♛
        </span>
        <p className="eyebrow">{t('game:champion')}</p>
        <h2>{champion?.nickname}</h2>
        <ol>
          {state.standings.slice(0, 3).map((s) => (
            <li key={s.id} data-rank={s.rank}>
              <b>{s.rank}º</b>
              <span>{s.nickname}</span>
            </li>
          ))}
        </ol>
        <button className="primary" onClick={onHome}>
          {t('game:backHome')}
        </button>
      </div>
    </div>
  );
}
