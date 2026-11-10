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
import { TablePreview } from './room-tools.tsx';
export { PokerTable } from './room-tools.tsx';
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
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  const error = React.useContext(ErrorContext);
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLInputElement>('input:not([type=color])')
      ?.focus({ preventScroll: true });
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
    <dialog ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title}>
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
  const { t, i18n } = useTranslation();
  const [c, setC] = useState<Config>(() => ({ ...defaultConfig, title: t('lobby:defaultTitle') }));
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState('casual');
  const [invalid, setInvalid] = useState('');
  const num = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const numberField = (key: keyof Config, min = 0, max = 10000000) => (
    <label key={key}>
      {t(`lobby:${key}`)}
      <input
        required
        type="number"
        min={min}
        max={max}
        step={1}
        value={String(c[key])}
        onChange={(e) => {
          setC({ ...c, [key]: Number(e.target.value) });
          setInvalid('');
          setPreset('custom');
        }}
      />
    </label>
  );
  const applyPreset = (key: string) => {
    setPreset(key);
    const minutes = key === 'turbo' ? 5 : key === 'deep' ? 15 : 10;
    setC({
      ...c,
      stack: key === 'deep' ? 10000 : 5000,
      minBuyIn: 1000,
      maxBuyIn: 20000,
      small: 25,
      big: 50,
      ante: 0,
      turnSeconds: key === 'turbo' ? 15 : 25,
      levels: defaultConfig.levels.map((l) => ({ ...l, minutes })),
    });
  };
  const updateLevel = (index: number, key: keyof Config['levels'][number], value: number) => {
    setC({ ...c, levels: c.levels.map((l, i) => (i === index ? { ...l, [key]: value } : l)) });
    setPreset('custom');
    setInvalid('');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ConfigSchema.safeParse(c);
    if (!parsed.success) {
      const fields = [
        ...new Set(parsed.error.issues.map((issue) => issue.path[0]).filter(Boolean)),
      ];
      setInvalid(
        t('lobby:reviewErrors') +
          ' ' +
          fields.map((key) => t(`lobby:${key === 'title' ? 'roomName' : key}`)).join(', '),
      );
      setStep(
        parsed.error.issues.some((issue) =>
          ['title', 'password', 'seats', 'capacity'].includes(String(issue.path[0])),
        )
          ? 0
          : 1,
      );
      return;
    }
    try {
      onCreate(parsed.data);
    } catch (e) {
      onError(e);
    }
  };
  return (
    <Modal title={t('lobby:createTitle')} onClose={onClose} wide>
      <form className="room-builder" onSubmit={submit} noValidate>
        <div className="builder-main">
          <p className="builder-intro">{t('lobby:builderIntro')}</p>
          <div className="builder-steps" aria-label={t('lobby:setupSteps')}>
            {['format', 'rules', 'review'].map((key, i) => (
              <button
                type="button"
                key={key}
                aria-current={step === i ? 'step' : undefined}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {t(`lobby:step${key}`)}
              </button>
            ))}
          </div>
          <div className="builder-content">
            <section hidden={step !== 0} aria-label={t('lobby:stepformat')}>
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
              <fieldset>
                <legend>{t('lobby:mode')}</legend>
                <div className="mode-cards">
                  {(['CASH', 'SIT_AND_GO', 'TOURNAMENT'] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={c.mode === mode}
                      onClick={() => setC({ ...c, mode })}
                    >
                      <span>{mode === 'CASH' ? '♠' : mode === 'SIT_AND_GO' ? '♜' : '♛'}</span>
                      <strong>{t(`game:${mode}`)}</strong>
                      <small>{t(`lobby:desc${mode}`)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t('lobby:preset')}</legend>
                <div className="preset-buttons">
                  {['casual', 'turbo', 'deep'].map((key) => (
                    <button
                      type="button"
                      key={key}
                      aria-pressed={preset === key}
                      onClick={() => applyPreset(key)}
                    >
                      {c.mode === 'CASH'
                        ? t(`lobby:preset${key}`).split(' · ')[0]
                        : t(`lobby:preset${key}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="form-grid">
                <label>
                  {t('lobby:seats')}
                  <select
                    value={c.seats}
                    onChange={(e) => setC({ ...c, seats: Number(e.target.value) })}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {c.mode === 'TOURNAMENT' ? numberField('capacity', 2, 90) : numberField('stack', 1)}
              </div>
              <label>
                {t('lobby:password')}
                <input
                  type="password"
                  maxLength={64}
                  value={c.password}
                  onChange={(e) => setC({ ...c, password: e.target.value })}
                  autoComplete="new-password"
                  placeholder={t('lobby:optionalPassword')}
                />
                <small>{t('lobby:passwordHint')}</small>
              </label>
            </section>
            <section hidden={step !== 1} aria-label={t('lobby:steprules')}>
              <h3>{t('lobby:startingRules')}</h3>
              <div className="form-grid">
                {c.mode === 'TOURNAMENT' && numberField('stack', 1)}
                {numberField('turnSeconds', 10, 120)}
                {c.mode === 'CASH' && (
                  <>
                    {numberField('small', 1)}
                    {numberField('big', 1)}
                    {numberField('ante', 0, 100000)}
                  </>
                )}
                {numberField('timeBank', 0, 120)}
              </div>
              {c.mode !== 'CASH' && (
                <div className="blind-editor">
                  <div className="editor-heading">
                    <div>
                      <h3>{t('lobby:levels')}</h3>
                      <p>{t('lobby:levelHint')}</p>
                    </div>
                    <button
                      type="button"
                      disabled={c.levels.length >= 30}
                      onClick={() => {
                        const last = c.levels.at(-1)!;
                        setC({
                          ...c,
                          levels: [
                            ...c.levels,
                            {
                              ...last,
                              small: Math.min(5000000, last.small * 2),
                              big: Math.min(10000000, last.big * 2),
                            },
                          ],
                        });
                      }}
                    >
                      ＋ {t('lobby:addLevel')}
                    </button>
                  </div>
                  <div className="blind-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          {(['small', 'big', 'ante', 'minutes', 'breakMinutes'] as const).map(
                            (key) => (
                              <th key={key}>{t(`lobby:column${key}`)}</th>
                            ),
                          )}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {c.levels.map((l, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            {(['small', 'big', 'ante', 'minutes', 'breakMinutes'] as const).map(
                              (key) => (
                                <td key={key}>
                                  <input
                                    required
                                    aria-label={
                                      t(`lobby:column${key}`) +
                                      ' — ' +
                                      t('game:level', { number: index + 1 })
                                    }
                                    type="number"
                                    min={key === 'ante' || key === 'breakMinutes' ? 0 : 1}
                                    max={
                                      key === 'minutes'
                                        ? 120
                                        : key === 'breakMinutes'
                                          ? 60
                                          : key === 'ante'
                                            ? 100000
                                            : 10000000
                                    }
                                    value={l[key]}
                                    onChange={(e) =>
                                      updateLevel(index, key, Number(e.target.value))
                                    }
                                  />
                                </td>
                              ),
                            )}
                            <td>
                              <button
                                type="button"
                                disabled={c.levels.length <= 1}
                                aria-label={t('lobby:removeLevel', { number: index + 1 })}
                                onClick={() =>
                                  setC({ ...c, levels: c.levels.filter((_, i) => i !== index) })
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <details className="advanced-rules">
                <summary>{t('lobby:advanced')}</summary>
                <div className="form-grid">
                  {numberField('minBuyIn', 1)}
                  {numberField('maxBuyIn', 1)}
                  {numberField('buyIn', 1)}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={c.rebuy}
                      onChange={(e) => setC({ ...c, rebuy: e.target.checked })}
                    />
                    {t('lobby:rebuy')}
                  </label>
                  {c.mode !== 'CASH' && (
                    <>
                      {numberField('rebuyLimit', 0, 20)}
                      {numberField('lateLevels', 0, 30)}
                      {numberField('addOn', 1)}
                      {(['rebuyUntil', 'addOnLevel'] as const).map((key) => (
                        <label key={key}>
                          {t(`lobby:${key}`)}
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={c[key] + 1}
                            onChange={(e) => setC({ ...c, [key]: Number(e.target.value) - 1 })}
                          />
                        </label>
                      ))}
                    </>
                  )}
                </div>
              </details>
            </section>
            <section hidden={step !== 2} aria-label={t('lobby:stepreview')}>
              <div className="review-heading">
                <span>✓</span>
                <h3>{t('lobby:readyToCreate')}</h3>
                <p>{t('lobby:afterCreate')}</p>
              </div>
              <dl className="review-grid">
                {[
                  [t('lobby:mode'), t(`game:${c.mode}`)],
                  [t('lobby:stack'), num(c.stack)],
                  [
                    t('game:blinds'),
                    `${num(c.mode === 'CASH' ? c.small : c.levels[0].small)} / ${num(c.mode === 'CASH' ? c.big : c.levels[0].big)}`,
                  ],
                  [t('lobby:seats'), String(c.seats)],
                  [t('lobby:turnSeconds'), `${c.turnSeconds}s`],
                  [t('lobby:protection'), t(c.password ? 'lobby:protected' : 'lobby:public')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {c.mode !== 'CASH' && <p className="builder-note">{t('game:payoutHint')}</p>}
            </section>
          </div>
          {invalid && (
            <p className="inline-error" role="alert">
              {invalid}
            </p>
          )}
          <div className="builder-footer">
            <button
              type="button"
              className="text-button"
              onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            >
              {step > 0 ? '← ' + t('lobby:previous') : t('cancel')}
            </button>
            {step < 2 && (
              <button type="button" onClick={() => setStep(step + 1)}>
                {t('lobby:next')} →
              </button>
            )}
            <button className="primary" disabled={busy} aria-label={t('lobby:createRoom')}>
              {t('lobby:createRoom')} ↗
            </button>
          </div>
        </div>
        <aside className="builder-preview">
          <div className="preview-heading">
            <span className="pulse-dot" />
            {t('lobby:preview')}
            <small>{t('lobby:livePreview')}</small>
          </div>
          <TablePreview seats={c.seats} stack={c.stack} title={c.title} />
          <h3>{c.title || 'Highlords'}</h3>
          <p>
            {t(`game:${c.mode}`)} · {t(c.password ? 'lobby:protected' : 'lobby:public')}
          </p>
          <div className="preview-stats">
            <div>
              <small>{t('lobby:stack')}</small>
              <strong>{num(c.stack)}</strong>
            </div>
            <div>
              <small>{t('lobby:depth')}</small>
              <strong>
                {Math.floor(c.stack / Math.max(1, c.mode === 'CASH' ? c.big : c.levels[0].big))} BB
              </strong>
            </div>
            <div>
              <small>{t('game:players')}</small>
              <strong>{c.mode === 'TOURNAMENT' ? c.capacity : c.seats}</strong>
            </div>
          </div>
          <p className="preview-help">{t('lobby:previewHelp')}</p>
          <p className="micro">{t('virtual')}</p>
        </aside>
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
  const { t, i18n } = useTranslation();
  const num = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  const opts = table.hand!.legal;
  const [amount, setAmount] = useState(opts.min);
  useEffect(() => setAmount(Math.min(opts.min, opts.max)), [opts.min, opts.max, table.hand?.actor]);
  if (!opts.actions.length || snapshot.status !== 'RUNNING')
    return (
      <div className="action-placeholder" role="status">
        {t(
          snapshot.status === 'PAUSED'
            ? 'game:PAUSED'
            : table.hand!.done
              ? 'game:nextHand'
              : 'game:waitingTurn',
        )}
      </div>
    );
  return (
    <div className="action-bar">
      <div className="action-context">
        <span className="pulse-dot" />
        {t('game:yourTurn')}
      </div>
      <div className="action-buttons">
        {opts.actions
          .filter((a) => a !== 'RAISE' && a !== 'BET')
          .map((a) => (
            <button
              disabled={busy}
              className={a === 'FOLD' ? 'danger' : a === 'ALL_IN' ? '' : 'primary'}
              key={a}
              onClick={() => void onAction(a)}
            >
              {a === 'CALL'
                ? t('learn:callAmount', { amount: num(opts.call) })
                : a === 'ALL_IN'
                  ? t('learn:allinAmount', {
                      amount: num(
                        table.hand!.players.find((p) => p.id === snapshot.me)?.stack ?? 0,
                      ),
                    })
                  : t(`game:${a}`)}
            </button>
          ))}
      </div>
      {(opts.actions.includes('RAISE') || opts.actions.includes('BET')) && (
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
          <div className="bet-shortcuts">
            {[0.5, 1, 2].map((factor) => (
              <button
                type="button"
                key={factor}
                onClick={() =>
                  setAmount(
                    Math.min(
                      opts.max,
                      Math.max(
                        opts.min,
                        Math.round(
                          (table.hand!.players.find((p) => p.id === snapshot.me)?.bet ?? 0) +
                            opts.call +
                            (table.hand!.pot + opts.call) * factor,
                        ),
                      ),
                    ),
                  )
                }
              >
                {factor === 0.5 ? '½' : factor === 1 ? '1×' : '2×'} {t('game:pot')}
              </button>
            ))}
          </div>
          <input
            aria-label={t('game:raiseTo')}
            type="range"
            min={Math.min(opts.min, opts.max)}
            max={opts.max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <button className="primary" disabled={busy}>
            {t(table.hand!.currentBet === 0 ? 'learn:betAmount' : 'learn:raiseAmount', {
              amount: num(amount),
            })}
          </button>
        </form>
      )}
    </div>
  );
}
