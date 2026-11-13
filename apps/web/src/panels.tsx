import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BOT_STYLES,
  EMOTES,
  type BotDifficulty,
  type BotStyle,
} from '../../../packages/contracts/src/index.ts';
import { Avatar } from './avatar.tsx';
import type { PlayerView, RoomView } from './net.ts';
import { ReplayModal } from './replay.tsx';
import { prefsStore, statsStore, useStore } from './store.ts';
import { useNumber, type Send } from './table.tsx';

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // O Escape usa sempre a versão mais recente de onClose, sem refazer o efeito a cada render:
  // refazer o efeito devolvia o foco ao diálogo e tirava o cursor dos campos de texto.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Só foca o diálogo se nenhum campo dentro dele já pediu foco (autoFocus).
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('common:close')}>
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const QUICK_PHRASES = ['gg', 'quickNice', 'quickGood', 'quickThinking'] as const;

export function Chat({ state, send }: { state: RoomView; send: Send }) {
  const { t } = useTranslation();
  const prefs = useStore(prefsStore);
  const [text, setText] = useState('');
  const toggleMute = (id: string) =>
    prefsStore.set({
      muted: prefs.muted.includes(id) ? prefs.muted.filter((m) => m !== id) : [...prefs.muted, id],
    });
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [state.chat.length]);
  return (
    <div className="chat">
      <ol ref={list} aria-live="polite">
        {state.chat.length === 0 && <li className="empty">{t('game:chatEmpty')}</li>}
        {state.chat
          .filter((m) => !m.from || m.from === state.me || !prefs.muted.includes(m.from))
          .map((m) =>
            m.sys ? (
              <li key={m.id} className="sys">
                {t(`game:sys_${m.sys}`, m.params)}
              </li>
            ) : (
              <li key={m.id} className={m.from === state.me ? 'mine' : ''}>
                <b>{m.from === state.me ? t('game:you') : m.nickname}</b>
                <span>{m.text}</span>
                {m.from && m.from !== state.me && (
                  <button
                    type="button"
                    className="ghost mute"
                    title={t('game:muteHint')}
                    aria-label={t('game:mute', { name: m.nickname ?? '' })}
                    onClick={() => toggleMute(m.from!)}
                  >
                    🔇
                  </button>
                )}
              </li>
            ),
          )}
      </ol>
      {prefs.muted.length > 0 && (
        <button
          type="button"
          className="ghost small unmute"
          onClick={() => prefsStore.set({ muted: [] })}
        >
          {t('game:unmuteAll', { count: prefs.muted.length })}
        </button>
      )}
      <div className="quick-chat">
        {QUICK_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            className="small"
            onClick={() => send({ type: 'CHAT', text: t(`game:${phrase}`) })}
          >
            {t(`game:${phrase}`)}
          </button>
        ))}
      </div>
      <div className="emotes">
        {EMOTES.map((emote) => (
          <button key={emote} onClick={() => send({ type: 'EMOTE', emote })} aria-label={emote}>
            {emote}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send({ type: 'CHAT', text: text.trim() });
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('game:chatPlaceholder')}
          maxLength={200}
          aria-label={t('game:chatPlaceholder')}
        />
        <button className="primary" type="submit">
          {t('game:send')}
        </button>
      </form>
    </div>
  );
}

/** Faixa do celular: as duas últimas mensagens sempre à vista; toque abre o chat completo. */
export function ChatStrip({
  state,
  unread,
  onOpen,
}: {
  state: RoomView;
  unread: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const prefs = useStore(prefsStore);
  const recent = state.chat
    .filter((m) => m.text && (!m.from || m.from === state.me || !prefs.muted.includes(m.from)))
    .slice(-2);
  return (
    <button type="button" className="chat-strip" onClick={onOpen} aria-label={t('game:tabChat')}>
      <span className="chat-strip-icon" aria-hidden>
        💬{unread > 0 && <i className="badge">{unread}</i>}
      </span>
      <span className="chat-strip-lines">
        {recent.length === 0 ? (
          <em>{t('game:chatEmpty')}</em>
        ) : (
          recent.map((m) => (
            <span key={m.id}>
              <b>{m.from === state.me ? t('game:you') : m.nickname}</b> {m.text}
            </span>
          ))
        )}
      </span>
    </button>
  );
}

function TablePanel({
  state,
  send,
  onClosed,
  onProfile,
  onSettings,
}: {
  state: RoomView;
  send: Send;
  onClosed: () => void;
  onProfile: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const [difficulty, setDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [style, setStyle] = useState<BotStyle | 'RANDOM'>('RANDOM');
  const botStyle = style === 'RANDOM' ? undefined : style;
  const [confirming, setConfirming] = useState<
    null | { kind: 'kick'; player: PlayerView } | { kind: 'close' }
  >(null);
  const free = state.config.seats - state.players.length;
  const canBots = state.config.mode === 'CASH' || state.status === 'WAITING';
  const me = state.players.find((p) => p.id === state.me);
  return (
    <div className="manage">
      <section className="me-tools">
        <button onClick={onProfile}>{t('profile:edit')}</button>
        <button onClick={onSettings}>{t('settings:title')}</button>
      </section>
      <section>
        <h3>
          {t('game:players')}{' '}
          <small>
            {state.players.length}/{state.config.seats}
          </small>
        </h3>
        <ul className="roster">
          {state.players
            .slice()
            .sort((a, b) => a.seat - b.seat)
            .map((p) => (
              <li key={p.id} className={p.online ? '' : 'away'}>
                <span className="roster-avatar" data-frame={p.color ?? 'brass'}>
                  <Avatar avatar={p.avatar} id={p.id} />
                </span>
                <span>
                  {p.nickname}
                  {p.id === state.hostId && <em>{t('game:host')}</em>}
                  {p.bot && <em>{t(`game:${p.bot}`)}</em>}
                  {p.bot && p.botStyle && (
                    <em className="style-tag" title={t(`game:styleHint_${p.botStyle}`)}>
                      {t(`game:style_${p.botStyle}`)}
                    </em>
                  )}
                </span>
                <b>{format(p.stack)}</b>
                {state.host && p.id !== state.me && (
                  <button
                    className="ghost small"
                    disabled={!!p.bot && !canBots}
                    onClick={() =>
                      p.bot
                        ? send({ type: 'REMOVE_BOT', id: p.id })
                        : setConfirming({ kind: 'kick', player: p })
                    }
                  >
                    {p.bot ? t('game:removeBot') : t('game:kick')}
                  </button>
                )}
              </li>
            ))}
        </ul>
        {state.spectators.length > 0 && (
          <p className="watching">
            {t('game:spectators')}: {state.spectators.map((s) => s.nickname).join(', ')}
          </p>
        )}
      </section>

      {state.host && (
        <section>
          <h3>{t('game:host')}</h3>
          <div className="bot-row">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as BotDifficulty)}
              aria-label={t('game:botLevel')}
            >
              {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                <option key={d} value={d}>
                  {t(`game:${d}`)}
                </option>
              ))}
            </select>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as BotStyle | 'RANDOM')}
              aria-label={t('game:botStyle')}
            >
              <option value="RANDOM">{t('game:styleRandom')}</option>
              {BOT_STYLES.map((value) => (
                <option key={value} value={value}>
                  {t(`game:style_${value}`)}
                </option>
              ))}
            </select>
            <button
              disabled={!canBots || free < 1}
              onClick={() => send({ type: 'ADD_BOT', difficulty, style: botStyle })}
            >
              {t('game:addBot')}
            </button>
            <button
              disabled={!canBots || free < 1}
              onClick={() => {
                for (let i = 0; i < free; i++)
                  send({ type: 'ADD_BOT', difficulty, style: botStyle });
              }}
            >
              {t('game:fillBots')}
            </button>
          </div>
          <div className="bot-row">
            {state.status === 'RUNNING' && (
              <button onClick={() => send({ type: 'PAUSE' })}>{t('game:pause')}</button>
            )}
            {state.status === 'PAUSED' && (
              <button className="primary" onClick={() => send({ type: 'RESUME' })}>
                {t('game:resume')}
              </button>
            )}
            {state.status === 'WAITING' && state.config.mode === 'SIT_AND_GO' && (
              <button
                className="primary"
                disabled={state.players.length < 2}
                onClick={() => send({ type: 'START' })}
              >
                {t('game:start')}
              </button>
            )}
            <button className="danger" onClick={() => setConfirming({ kind: 'close' })}>
              {t('game:closeRoom')}
            </button>
          </div>
        </section>
      )}

      <section>
        {me && (
          <button className="ghost" onClick={() => send({ type: 'STAND' })}>
            {t('game:standUp')}
          </button>
        )}
      </section>

      {confirming && (
        <Modal title={t('common:confirm')} onClose={() => setConfirming(null)}>
          <p>
            {confirming.kind === 'kick'
              ? t('game:kickConfirm', { name: confirming.player.nickname })
              : t('game:closeConfirm')}
          </p>
          <div className="modal-actions">
            <button onClick={() => setConfirming(null)}>{t('common:cancel')}</button>
            <button
              className="danger"
              onClick={() => {
                if (confirming.kind === 'kick') send({ type: 'KICK', id: confirming.player.id });
                else {
                  send({ type: 'CLOSE' });
                  onClosed();
                }
                setConfirming(null);
              }}
            >
              {t('common:confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function History({ state }: { state: RoomView }) {
  const { t } = useTranslation();
  const format = useNumber();
  const stats = useStore(statsStore);
  const [replay, setReplay] = useState<RoomView['history'][number] | null>(null);
  if (!state.history.length) return <p className="empty-note">{t('game:noHistory')}</p>;
  const biggest = state.history.reduce((top, h) => Math.max(top, h.pot), 0);
  return (
    <>
      <p className="table-stats">
        {t('game:tableStats', { hands: state.handNo, biggest: format(biggest) })}
        {stats.hands > 0 && ` · ${t('game:myStats', { won: stats.won, hands: stats.hands })}`}
      </p>
      {replay && <ReplayModal hand={replay} me={state.me} onClose={() => setReplay(null)} />}
      {state.standings.length > 0 && (
        <section className="standings">
          <h3>{t('game:standings')}</h3>
          <ol>
            {state.standings.map((s) => (
              <li key={s.id}>
                <b>{s.rank}º</b>
                <span className="roster-avatar" data-frame={s.color ?? 'brass'}>
                  <Avatar avatar={s.avatar} id={s.id} />
                </span>
                <span>{s.nickname}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <ol className="history">
        {state.history
          .slice()
          .reverse()
          .map((h) => (
            <li key={h.no}>
              <header>
                <b>{t('game:handNo', { n: h.no })}</b>
                <span>
                  {t('game:pot')} {format(h.pot)}
                </span>
                {h.log && h.log.length > 0 && (
                  <button className="ghost small" onClick={() => setReplay(h)}>
                    {t('game:replay')}
                  </button>
                )}
              </header>
              {h.winners.map((w) => (
                <p key={w.id}>
                  {t('game:won', {
                    name: w.id === state.me ? t('game:you') : w.nickname,
                    amount: format(w.amount),
                  })}
                  {w.category !== undefined && (
                    <em>
                      {' '}
                      {t('game:wonWith', { hand: t(`learn:rank${w.category}`).toLowerCase() })}
                    </em>
                  )}
                </p>
              ))}
            </li>
          ))}
      </ol>
    </>
  );
}

export type Tab = 'chat' | 'table' | 'history';
export function SidePanel({
  state,
  send,
  tab,
  onTab,
  onClose,
  onClosed,
  unread,
  onProfile,
  onSettings,
  hideChat = false,
}: {
  state: RoomView;
  send: Send;
  tab: Tab;
  hideChat?: boolean;
  onTab: (tab: Tab) => void;
  onClose: () => void;
  onClosed: () => void;
  unread: number;
  onProfile: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="side-panel" aria-label={t('game:menu')}>
      <header>
        <div role="tablist">
          {(['chat', 'table', 'history'] as const)
            .filter((key) => !(hideChat && key === 'chat'))
            .map((key) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => onTab(key)}>
                {t(`game:tab${key[0].toUpperCase()}${key.slice(1)}`)}
                {key === 'chat' && unread > 0 && tab !== 'chat' && (
                  <i className="badge">{unread}</i>
                )}
              </button>
            ))}
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t('common:close')}>
          ✕
        </button>
      </header>
      <div className="side-body">
        {tab === 'chat' && <Chat state={state} send={send} />}
        {tab === 'table' && (
          <TablePanel
            state={state}
            send={send}
            onClosed={onClosed}
            onProfile={onProfile}
            onSettings={onSettings}
          />
        )}
        {tab === 'history' && <History state={state} />}
      </div>
    </aside>
  );
}
