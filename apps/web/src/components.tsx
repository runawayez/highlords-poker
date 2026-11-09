import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProfileSchema,
  ConfigSchema,
  type Profile,
  type Config,
} from '../../../packages/contracts/src/index.ts';
import { read, download, type Snapshot, type Messages } from './api.ts';
import type { Preferences } from './preferences.ts';
const defaultConfig = {
  title: 'Highlords Night',
  password: '',
  mode: 'CASH' as const,
  seats: 6,
  capacity: 18,
  stack: 5000,
  small: 25,
  big: 50,
  ante: 0,
  minBuyIn: 1000,
  maxBuyIn: 10000,
  buyIn: 1000,
  rebuy: true,
  rebuyLimit: 3,
  rebuyUntil: 3,
  addOn: 3000,
  addOnLevel: 3,
  lateLevels: 2,
  turnSeconds: 25,
  timeBank: 30,
  levels: [
    { small: 25, big: 50, ante: 0, minutes: 10, breakMinutes: 0 },
    { small: 50, big: 100, ante: 10, minutes: 10, breakMinutes: 0 },
    { small: 100, big: 200, ante: 25, minutes: 10, breakMinutes: 5 },
    { small: 200, big: 400, ante: 50, minutes: 10, breakMinutes: 0 },
    { small: 400, big: 800, ante: 100, minutes: 10, breakMinutes: 0 },
  ],
};
export const ErrorContext = React.createContext('');
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  const error = React.useContext(ErrorContext);
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLInputElement>('input:not([type=color])')?.focus();
    const d = dialog.current;
    const listener = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d?.addEventListener('cancel', listener);
    return () => {
      d?.removeEventListener('cancel', listener);
      d?.close();
    };
  }, [onClose]);
  return (
    <dialog ref={dialog} className="modal">
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" className="icon" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </div>
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
export function JoinDialog({
  onJoin,
  onClose,
  busy,
}: {
  onJoin: (password: string, buyIn?: number) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [pw, setPw] = useState('');
  const [buyIn, setBuyIn] = useState('');
  return (
    <Modal title={t('lobby:joinTitle')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(pw, buyIn ? Number(buyIn) : undefined);
        }}
      >
        <label>
          {t('lobby:password')}
          <input
            autoFocus
            type="password"
            maxLength={64}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          {t('lobby:joinBuyIn')}
          <input type="number" min={1} value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
        </label>
        <p className="muted">{t('lobby:passwordHint')}</p>
        <button className="primary" disabled={busy}>
          {t('confirm')}
        </button>
      </form>
    </Modal>
  );
}
export function ProfileEditor({
  value,
  onClose,
  onSave,
  busy,
  onError,
}: {
  value: Preferences;
  onClose: () => void;
  onSave: (p: Preferences) => void;
  busy: boolean;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const [p, setP] = useState(value);
  const set = (key: keyof Profile, value: string) =>
    setP((p) => ({ ...p, profile: { ...p.profile, [key]: value } }));
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10000) throw Error('VALIDATION');
      const v = JSON.parse(await file.text());
      const profile = ProfileSchema.parse(v.profile);
      if (
        v.schema !== 1 ||
        !['felt', 'midnight', 'crimson'].includes(v.theme) ||
        !['classic', 'geometric'].includes(v.cardBack) ||
        !/^#[0-9a-f]{6}$/i.test(v.chipColor)
      )
        throw Error('VALIDATION');
      setP({
        schema: 1,
        profile,
        theme: v.theme,
        cardBack: v.cardBack,
        chipColor: v.chipColor,
        sound: v.sound === true,
      });
    } catch {
      onError(Error('VALIDATION'));
    }
  };
  return (
    <Modal title={t('profile:title')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(p);
        }}
      >
        <div className={`avatar-preview ${p.profile.frame}`} style={{ color: p.profile.accent }}>
          {p.profile.avatar}
        </div>
        <label>
          {t('profile:nickname')}
          <input
            autoFocus
            required
            minLength={2}
            maxLength={24}
            value={p.profile.nickname}
            onChange={(e) => set('nickname', e.target.value)}
          />
        </label>
        <fieldset>
          <legend>{t('profile:avatar')}</legend>
          <div className="avatar-options">
            {['♠', '♣', '♦', '♥', '☠', '♜', '⚔', '☾'].map((a) => (
              <button
                type="button"
                aria-pressed={p.profile.avatar === a}
                key={a}
                onClick={() => set('avatar', a)}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            {t('profile:frame')}
            <select value={p.profile.frame} onChange={(e) => set('frame', e.target.value)}>
              {['plain', 'red', 'gold'].map((f) => (
                <option key={f} value={f}>
                  {t(`profile:${f}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('profile:accent')}
            <input
              type="color"
              value={p.profile.accent}
              onChange={(e) => set('accent', e.target.value)}
            />
          </label>
        </div>
        <label>
          {t('profile:tagline')}
          <input
            maxLength={80}
            value={p.profile.tagline}
            onChange={(e) => set('tagline', e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            {t('profile:theme')}
            <select
              value={p.theme}
              onChange={(e) => setP({ ...p, theme: e.target.value as Preferences['theme'] })}
            >
              {['felt', 'midnight', 'crimson'].map((x) => (
                <option key={x} value={x}>
                  {t(`profile:${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('profile:cardBack')}
            <select
              value={p.cardBack}
              onChange={(e) => setP({ ...p, cardBack: e.target.value as Preferences['cardBack'] })}
            >
              {['classic', 'geometric'].map((x) => (
                <option key={x} value={x}>
                  {t(`profile:${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('profile:chipColor')}
            <input
              type="color"
              value={p.chipColor}
              onChange={(e) => setP({ ...p, chipColor: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={p.sound}
              onChange={(e) => setP({ ...p, sound: e.target.checked })}
            />
            {t('profile:sound')}
          </label>
        </div>
        <p>{t('profile:handsWon', { count: read<string[]>('highlords.wins', []).length })}</p>
        <div className="profile-tools">
          <button type="button" onClick={() => download('highlords-profile.json', p)}>
            {t('profile:export')}
          </button>
          <label className="file-button">
            {t('profile:import')}
            <input
              type="file"
              accept="application/json"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </label>
        </div>
        <p className="muted">{t('profile:local')}</p>
        <button disabled={busy} className="primary">
          {t('save')}
        </button>
      </form>
    </Modal>
  );
}
export function CreateRoom({
  onClose,
  onCreate,
  busy,
  onError,
}: {
  onClose: () => void;
  onCreate: (c: Config) => void;
  busy: boolean;
  onError: (e: unknown) => void;
}) {
  const { t } = useTranslation();
  const [c, setC] = useState(defaultConfig);
  const [levels, setLevels] = useState(
    c.levels.map((l) => [l.small, l.big, l.ante, l.minutes, l.breakMinutes].join(', ')).join('\n'),
  );
  const numeric = (key: keyof typeof c) => (
    <label key={key}>
      {t(`lobby:${key}`)}
      <input
        required
        type="number"
        min={
          ['ante', 'lateLevels', 'timeBank', 'rebuyUntil', 'rebuyLimit', 'addOnLevel'].includes(key)
            ? 0
            : 1
        }
        max={10000000}
        value={String(c[key])}
        onChange={(e) => setC({ ...c, [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <Modal title={t('lobby:createTitle')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const parsed = ConfigSchema.parse({
              ...c,
              levels: levels
                .split('\n')
                .filter((x) => x.trim())
                .map((row) => {
                  const [small, big, ante, minutes, breakMinutes = 0] = row.split(',').map(Number);
                  return { small, big, ante, minutes, breakMinutes };
                }),
            });
            onCreate(parsed);
          } catch {
            onError(Error('VALIDATION'));
          }
        }}
      >
        <label>
          {t('lobby:roomName')}
          <input
            required
            minLength={3}
            maxLength={50}
            value={c.title}
            onChange={(e) => setC({ ...c, title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            {t('lobby:mode')}
            <select
              value={c.mode}
              onChange={(e) => setC({ ...c, mode: e.target.value as typeof c.mode })}
            >
              {['CASH', 'SIT_AND_GO', 'TOURNAMENT'].map((m) => (
                <option key={m} value={m}>
                  {t(`game:${m}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('lobby:seats')}
            <select value={c.seats} onChange={(e) => setC({ ...c, seats: Number(e.target.value) })}>
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          {numeric('stack')}
          {numeric('small')}
          {numeric('big')}
          {numeric('ante')}
        </div>
        <label>
          {t('lobby:password')}
          <input
            type="password"
            maxLength={64}
            value={c.password}
            onChange={(e) => setC({ ...c, password: e.target.value })}
            autoComplete="new-password"
          />
        </label>
        <details>
          <summary>{t('lobby:advanced')}</summary>
          <div className="form-grid">
            {(
              [
                'capacity',
                'minBuyIn',
                'maxBuyIn',
                'buyIn',
                'rebuyLimit',
                'rebuyUntil',
                'addOn',
                'addOnLevel',
                'lateLevels',
                'turnSeconds',
                'timeBank',
              ] as const
            ).map(numeric)}
            <label className="check">
              <input
                type="checkbox"
                checked={c.rebuy}
                onChange={(e) => setC({ ...c, rebuy: e.target.checked })}
              />
              {t('lobby:rebuy')}
            </label>
          </div>
          <label>
            {t('lobby:levels')}
            <textarea rows={6} value={levels} onChange={(e) => setLevels(e.target.value)} />
          </label>
          <p className="muted">{t('lobby:levelHelp')}</p>
        </details>
        <p className="muted">{t('virtual')}</p>
        <button disabled={busy} className="primary">
          {t('lobby:createRoom')}
        </button>
      </form>
    </Modal>
  );
}
export function Chat({
  messages,
  me,
  onSend,
  onReact,
  disabled,
}: {
  messages: Messages;
  me: string;
  onSend: (s: string) => Promise<unknown>;
  onReact?: (id: string, emoji: string) => Promise<unknown>;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);
  return (
    <aside className="chat">
      <div className="chat-heading">
        <span className="online-dot">●</span>
        <h2>{t(me ? 'chat:title' : 'chat:lobby')}</h2>
        <span>↗</span>
      </div>
      <div className="messages" aria-live="polite" aria-relevant="additions">
        {!messages.length && <p className="muted chat-empty">{t('chat:empty')}</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.code ? 'system-message' : m.player === me ? 'message own' : 'message'}
          >
            {m.code ? (
              <p>{t(`chat:${m.code}`, { name: m.profile?.nickname ?? '' })}</p>
            ) : (
              <>
                <div className="message-heading">
                  <span style={{ color: m.profile?.accent }}>
                    {m.profile?.avatar} <strong>{m.profile?.nickname ?? '—'}</strong>
                  </span>
                  <time>
                    {new Intl.DateTimeFormat(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(m.at)}
                  </time>
                </div>
                <p>{m.text}</p>
                {onReact && (
                  <div className="reactions">
                    {['👍', '🔥', '😂', '♥'].map((emoji) => (
                      <button
                        disabled={disabled}
                        aria-label={`${t('chat:reaction')} ${emoji}`}
                        aria-pressed={m.reactions[emoji]?.includes(me) ?? false}
                        key={emoji}
                        onClick={() => void onReact(m.id, emoji)}
                      >
                        {emoji}
                        {m.reactions[emoji]?.length || ''}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form
        className="chat-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim() && (await onSend(text))) setText('');
        }}
      >
        <input
          aria-label={t('chat:placeholder')}
          placeholder={t('chat:placeholder')}
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={disabled || !text.trim()} aria-label={t('chat:send')}>
          ↑
        </button>
      </form>
    </aside>
  );
}
function Card({ card, hidden = false }: { card?: string; hidden?: boolean }) {
  const suits: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return (
    <div
      className={`playing-card ${hidden ? 'card-back' : !card ? 'card-empty' : ['h', 'd'].includes(card[1]) ? 'red-card' : ''}`}
    >
      {hidden ? (
        <span>♠</span>
      ) : card ? (
        <>
          <b>{card[0] === 'T' ? '10' : card[0]}</b>
          <span>{suits[card[1]]}</span>
        </>
      ) : null}
    </div>
  );
}
export function PokerTable({
  snapshot,
  table,
  clock,
  num,
}: {
  snapshot: Snapshot;
  table: Snapshot['tables'][number];
  clock: number;
  num: (n: number) => string;
}) {
  const { t } = useTranslation();
  const h = table.hand!;
  const actor = snapshot.players.find((p) => p.id === h.actor);
  return (
    <div className="table-shell">
      <div className="poker-table">
        <div className="felt-border" />
        <div className="table-center">
          <span className="table-watermark">HIGHLORDS ♠</span>
          <div className="community">
            {Array.from({ length: 5 }, (_, i) => (
              <Card key={i} card={h.board[i]} />
            ))}
          </div>
          <p className="pot">
            <span className="chip-dot" />
            {t('game:pot')} <strong>{num(h.pot)}</strong>
          </p>
          <p className="street">
            {h.done
              ? t('game:nextHand')
              : t(`game:${['preflop', 'flop', 'turnStreet', 'river'][h.street]}`)}
          </p>
        </div>
        {h.players.map((p, i) => {
          const profile = snapshot.players.find((x) => x.id === p.id)?.profile;
          const angle = (i / h.players.length) * Math.PI * 2 + Math.PI / 2;
          const x = 50 + 47 * Math.cos(angle),
            y = 50 + 48 * Math.sin(angle);
          return (
            <div
              className={`seat ${h.actor === p.id ? 'acting' : ''} ${p.folded ? 'folded' : ''} ${p.id === snapshot.me ? 'self' : ''}`}
              style={
                { left: `${x}%`, top: `${y}%`, '--accent': profile?.accent } as React.CSSProperties
              }
              key={p.id}
            >
              <div className="hole-cards">
                {p.cards.length
                  ? p.cards.map((c) => <Card key={c} card={c} />)
                  : [0, 1].map((n) => <Card key={n} hidden />)}
              </div>
              <div className={`seat-profile ${profile?.frame ?? ''}`} title={profile?.tagline}>
                <span className="seat-avatar">{profile?.avatar}</span>
                <div>
                  <strong>{profile?.nickname}</strong>
                  <small>
                    {num(p.stack)} {p.bet > 0 && <span className="bet">+{num(p.bet)}</span>}
                  </small>
                </div>
                {p.seat === h.button && (
                  <span className="dealer" aria-label={t('game:dealer')}>
                    D
                  </span>
                )}
              </div>
              {h.done && h.awards[p.id] ? (
                <span className="winner">{t('game:won', { amount: num(h.awards[p.id]) })}</span>
              ) : p.folded ? (
                <span className="seat-status">{t('game:folded')}</span>
              ) : p.stack === 0 ? (
                <span className="seat-status">{t('game:allIn')}</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="turn-indicator">
        {!h.done && actor && (
          <>
            <span className="pulse-dot" />
            {h.actor === snapshot.me ? t('game:yourTurn') : actor.profile?.nickname}{' '}
            <strong>{Math.max(0, Math.ceil((table.deadline - clock) / 1000))}s</strong>
          </>
        )}
      </div>
    </div>
  );
}
export function ActionBar({
  snapshot,
  table,
  busy,
  onAction,
}: {
  snapshot: Snapshot;
  table: Snapshot['tables'][number];
  busy: boolean;
  onAction: (action: string, amount?: number) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const opts = table.hand!.legal;
  const [amount, setAmount] = useState(opts.min);
  useEffect(() => setAmount(Math.min(opts.min, opts.max)), [opts.min, opts.max, table.hand?.actor]);
  if (!opts.actions.length || snapshot.status !== 'RUNNING')
    return <div className="action-placeholder" />;
  return (
    <div className="action-bar">
      <div className="action-buttons">
        {opts.actions
          .filter((a) => a !== 'RAISE')
          .map((a) => (
            <button
              disabled={busy}
              className={a === 'FOLD' ? 'danger' : a === 'ALL_IN' ? '' : 'primary'}
              key={a}
              onClick={() => void onAction(a)}
            >
              {t(`game:${a}`)}
              {a === 'CALL' ? ` ${opts.call}` : ''}
            </button>
          ))}
      </div>
      {opts.actions.includes('RAISE') && (
        <form
          className="raise-controls"
          onSubmit={(e) => {
            e.preventDefault();
            void onAction(table.hand!.currentBet === 0 ? 'BET' : 'RAISE', amount);
          }}
        >
          <label>
            {t('game:raiseTo')}
            <input
              type="number"
              min={Math.min(opts.min, opts.max)}
              max={opts.max}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <input
            aria-label={t('game:raiseTo')}
            type="range"
            min={Math.min(opts.min, opts.max)}
            max={opts.max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button className="primary" disabled={busy}>
            {t(table.hand!.currentBet === 0 ? 'game:BET' : 'game:RAISE')}
          </button>
        </form>
      )}
    </div>
  );
}
