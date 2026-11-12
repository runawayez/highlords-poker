import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  EMOTES,
  type BotDifficulty,
  type Profile,
} from '../../../packages/contracts/src/index.ts';
import type { PlayerView, RoomView } from './net.ts';
import { portrait, useNumber, type Send } from './table.tsx';
import { playSound } from './audio.ts';

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
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);
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

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Profile['avatar'];
  onChange: (a: Profile['avatar']) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="avatar-picker" role="radiogroup" aria-label={t('home:avatar')}>
      {AVATARS.map((avatar, index) => (
        <button
          key={avatar}
          type="button"
          role="radio"
          aria-checked={value === avatar}
          aria-label={t('home:portrait', { number: index + 1 })}
          onClick={() => {
            playSound('click');
            onChange(avatar);
          }}
        >
          <img src={portrait(avatar)} alt="" draggable={false} />
        </button>
      ))}
    </div>
  );
}

function Chat({ state, send }: { state: RoomView; send: Send }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [state.chat.length]);
  return (
    <div className="chat">
      <ol ref={list} aria-live="polite">
        {state.chat.length === 0 && <li className="empty">{t('game:chatEmpty')}</li>}
        {state.chat.map((m) =>
          m.sys ? (
            <li key={m.id} className="sys">
              {t(`game:sys_${m.sys}`, m.params)}
            </li>
          ) : (
            <li key={m.id} className={m.from === state.me ? 'mine' : ''}>
              <b>{m.from === state.me ? t('game:you') : m.nickname}</b>
              <span>{m.text}</span>
            </li>
          ),
        )}
      </ol>
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

function TablePanel({
  state,
  send,
  onClosed,
}: {
  state: RoomView;
  send: Send;
  onClosed: () => void;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const [difficulty, setDifficulty] = useState<BotDifficulty>('MEDIUM');
  const [confirming, setConfirming] = useState<
    null | { kind: 'kick'; player: PlayerView } | { kind: 'close' }
  >(null);
  const free = state.config.seats - state.players.length;
  const canBots = state.config.mode === 'CASH' || state.status === 'WAITING';
  const me = state.players.find((p) => p.id === state.me);
  return (
    <div className="manage">
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
                <img src={portrait(p.avatar)} alt="" />
                <span>
                  {p.nickname}
                  {p.id === state.hostId && <em>{t('game:host')}</em>}
                  {p.bot && <em>{t(`game:${p.bot}`)}</em>}
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
            <button
              disabled={!canBots || free < 1}
              onClick={() => send({ type: 'ADD_BOT', difficulty })}
            >
              {t('game:addBot')}
            </button>
            <button
              disabled={!canBots || free < 1}
              onClick={() => {
                for (let i = 0; i < free; i++) send({ type: 'ADD_BOT', difficulty });
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
  if (!state.history.length) return <p className="empty-note">{t('game:noHistory')}</p>;
  return (
    <>
      {state.standings.length > 0 && (
        <section className="standings">
          <h3>{t('game:standings')}</h3>
          <ol>
            {state.standings.map((s) => (
              <li key={s.id}>
                <b>{s.rank}º</b>
                <img src={portrait(s.avatar)} alt="" />
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
}: {
  state: RoomView;
  send: Send;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onClose: () => void;
  onClosed: () => void;
  unread: number;
}) {
  const { t } = useTranslation();
  return (
    <aside className="side-panel" aria-label={t('game:menu')}>
      <header>
        <div role="tablist">
          {(['chat', 'table', 'history'] as const).map((key) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => onTab(key)}>
              {t(`game:tab${key[0].toUpperCase()}${key.slice(1)}`)}
              {key === 'chat' && unread > 0 && tab !== 'chat' && <i className="badge">{unread}</i>}
            </button>
          ))}
        </div>
        <button className="icon-button" onClick={onClose} aria-label={t('common:close')}>
          ✕
        </button>
      </header>
      <div className="side-body">
        {tab === 'chat' && <Chat state={state} send={send} />}
        {tab === 'table' && <TablePanel state={state} send={send} onClosed={onClosed} />}
        {tab === 'history' && <History state={state} />}
      </div>
    </aside>
  );
}
