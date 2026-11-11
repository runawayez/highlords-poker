import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile, Command } from '../../../packages/contracts/src/index.ts';
import type { Snapshot } from './api.ts';
import { Avatar } from './avatar.tsx';
import { Card } from './card.tsx';

/** Fit the complete table, including seats, inside the space left above the actions. */
export function FittedScene({ children }: { children: React.ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = viewport.current!;
    const scene = canvas.current!;
    const fit = () => {
      const scale = Math.min(
        1,
        Math.max(0, host.clientHeight - 12) / Math.max(1, scene.offsetHeight),
      );
      scene.style.setProperty('--scene-scale', String(scale));
      const actions = host.nextElementSibling as HTMLElement | null;
      host.parentElement?.parentElement?.style.setProperty(
        '--controls-height',
        `${actions?.classList.contains('decision-zone') ? actions.offsetHeight + 20 : 0}px`,
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    observer.observe(scene);
    fit();
    return () => observer.disconnect();
  }, []);
  return (
    <div className="scene-viewport" ref={viewport}>
      <div className="scene-canvas" ref={canvas}>
        {children}
      </div>
    </div>
  );
}

export const difficultyLabels = {
  EASY: 'game:botEASY',
  MEDIUM: 'game:botMEDIUM',
  HARD: 'game:botHARD',
} as const;
// Coordinates belong to the full arena, keeping cards and seats clear of the board.
export function seatPosition(index: number, count: number) {
  const positions: Record<number, number[][]> = {
    2: [
      [50, 90],
      [50, 13],
    ],
    3: [
      [50, 90],
      [17, 26],
      [83, 26],
    ],
    4: [
      [50, 90],
      [12, 50],
      [50, 13],
      [88, 50],
    ],
    5: [
      [50, 90],
      [12, 65],
      [26, 15],
      [74, 15],
      [88, 65],
    ],
    6: [
      [50, 90],
      [13, 69],
      [13, 27],
      [50, 13],
      [87, 27],
      [87, 69],
    ],
    7: [
      [50, 90],
      [15, 77],
      [12, 38],
      [35, 13],
      [65, 13],
      [88, 38],
      [85, 77],
    ],
    8: [
      [50, 90],
      [22, 83],
      [12, 51],
      [24, 17],
      [50, 13],
      [76, 17],
      [88, 51],
      [78, 83],
    ],
    9: [
      [50, 90],
      [22, 82],
      [12, 57],
      [17, 25],
      [38, 13],
      [65, 13],
      [85, 25],
      [88, 57],
      [78, 82],
    ],
  };
  const [x, y] = (positions[count] ?? positions[6])[index % count];
  return { left: `${x}%`, top: `${y}%` };
}
export { Card } from './card.tsx';
export function TablePreview({
  seats,
  stack,
  title,
}: {
  seats: number;
  stack: number;
  title: string;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="table-preview" aria-label={t('lobby:preview')}>
      <div className="preview-felt">
        <span>
          HIGHLORDS <b>♠</b>
        </span>
        <small>{title}</small>
      </div>
      {Array.from({ length: seats }, (_, i) => (
        <div
          key={i}
          className={`preview-seat ${i === 0 ? 'preview-self' : ''}`}
          style={seatPosition(i, seats)}
        >
          <span>{i === 0 ? '♠' : i + 1}</span>
          <small>
            {i === 0 ? new Intl.NumberFormat(i18n.language).format(stack) : t('game:seat')}
          </small>
        </div>
      ))}
    </div>
  );
}
export function PokerTable({
  snapshot,
  selfProfile,
  table,
  bestFive,
  clock,
  num,
  onSelect,
  onAddBot,
  onStart,
  busy,
}: {
  snapshot: Snapshot;
  selfProfile?: Profile;
  table?: Snapshot['tables'][number];
  bestFive?: string[];
  clock: number;
  num: (n: number) => string;
  onSelect: (id: string) => void;
  onAddBot: () => void;
  onStart: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation(),
    h = table?.hand,
    waiting = snapshot.status === 'WAITING';
  const players = h
    ? h.players.map((hp) => ({ ...snapshot.players.find((p) => p.id === hp.id)!, ...hp }))
    : snapshot.players
        .filter((p) => !p.left && (!table || table.ids.includes(p.id)))
        .slice(0, snapshot.config.seats)
        .map((p) => ({ ...p, cards: [] as string[], folded: false, bet: 0 }));
  const self = players.findIndex((p) => p.id === snapshot.me),
    rotated = self > 0 ? [...players.slice(self), ...players.slice(0, self)] : players;
  const seats = waiting ? snapshot.config.seats : Math.max(2, players.length),
    active = snapshot.players.filter((p) => !p.left),
    canAdd =
      waiting &&
      snapshot.host &&
      snapshot.botsSupported &&
      active.length <
        (snapshot.config.mode === 'TOURNAMENT'
          ? snapshot.config.capacity
          : snapshot.config.seats) &&
      active.filter((p) => p.bot).length < 8;
  const actor = snapshot.players.find((p) => p.id === h?.actor),
    own = h?.players.find((p) => p.id === snapshot.me),
    seconds = Math.max(0, Math.ceil(((table?.deadline ?? clock) - clock) / 1000));
  const won = !!h?.done && Object.values(h.awards).some((n) => n > 0);
  return (
    <div
      className={`table-shell ${waiting ? 'table-waiting' : ''} ${won ? 'hand-won' : ''}`}
      data-seats={seats}
    >
      <div className="poker-table">
        <div className="felt-border" />
      </div>
      <span className="table-watermark">
        HIGHLORDS <b>♠</b>
        <small>POKER CLUB · NO LIMIT HOLD’EM</small>
      </span>
      <div className="table-center">
        {h ? (
          <>
            <div className="pot">
              <span className="chip-stack" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span>
                {t('game:pot')} <strong>{num(h.pot)}</strong>
              </span>
            </div>
            <div className="community">
              {Array.from({ length: 5 }, (_, i) => (
                <Card
                  key={h.id + '-' + i}
                  card={h.board[i]}
                  highlighted={bestFive?.includes(h.board[i])}
                />
              ))}
            </div>
            <p className="street">
              {h.done
                ? t('club:handComplete')
                : t(`game:${['preflop', 'flop', 'turnStreet', 'river'][h.street]}`)}
            </p>
          </>
        ) : (
          <div className="table-waiting-center">
            <h2>{t(waiting ? 'game:readyTable' : 'game:waitingRebuy')}</h2>
            <p>{t(waiting ? 'game:waitingHint' : 'game:noSeat')}</p>
            {waiting && snapshot.host && (
              <>
                <button
                  className="primary start-game"
                  aria-label={t('game:start')}
                  disabled={busy || active.length < 2}
                  onClick={onStart}
                >
                  ▶ {t('game:start')}
                </button>
                <button
                  className="text-button quick-bot"
                  hidden={!canAdd}
                  disabled={busy || !canAdd}
                  onClick={onAddBot}
                >
                  {t('club:quickBot')}
                </button>
              </>
            )}
            {waiting && snapshot.host && active.length < 2 && <small>{t('game:needTwo')}</small>}
            {waiting && !snapshot.host && <small>{t('game:hostStarts')}</small>}
          </div>
        )}
      </div>
      {own && own.cards.length === 2 && (
        <div className={`own-hand ${own.folded ? 'folded' : ''}`} aria-label={t('learn:yourCards')}>
          <div className="decision-cards">
            {own.cards.map((card) => (
              <Card key={h!.id + card} card={card} highlighted={bestFive?.includes(card)} />
            ))}
          </div>
          <small>{own.folded ? t('game:folded') : t('game:you')}</small>
        </div>
      )}
      {Array.from({ length: seats }, (_, i) => {
        const p = rotated[i],
          position = seatPosition(i, seats),
          x = parseFloat(position.left),
          y = parseFloat(position.top);
        if (!p)
          return (
            <div className="seat empty-seat" key={'empty-' + i} style={position}>
              <button
                disabled={!canAdd || busy}
                onClick={onAddBot}
                aria-label={t('game:addAtSeat', { number: i + 1 })}
              >
                <b>＋</b>
                <small>{t(canAdd ? 'club:botSeat' : 'game:seat')}</small>
              </button>
            </div>
          );
        const acting = snapshot.status === 'RUNNING' && !h?.done && h?.actor === p.id,
          last = h?.log.filter((e) => e.player === p.id).at(-1),
          isSelf = p.id === snapshot.me;
        const betPosition = {
          left: (isSelf ? 65 : 50 + (x - 50) * 0.72) + '%',
          top: (isSelf ? 84 : 50 + (y - 50) * 0.72) + '%',
        };
        return (
          <React.Fragment key={p.id}>
            <div
              data-edge={y > 70 ? 'bottom' : y < 30 ? 'top' : x < 50 ? 'left' : 'right'}
              className={`seat ${acting ? 'acting' : ''} ${p.folded ? 'folded' : ''} ${isSelf ? 'self' : ''}`}
              style={{ ...position, '--accent': '#DC2626' } as React.CSSProperties}
            >
              {h && !isSelf && !p.folded && (
                <div className="hole-cards">
                  {p.cards.length
                    ? p.cards.map((c) => <Card key={c} card={c} />)
                    : [0, 1].map((n) => <Card key={n} hidden />)}
                </div>
              )}
              <button
                className={`seat-profile ${p.profile?.frame ?? ''}`}
                title={p.profile?.nickname}
                onClick={() => onSelect(p.id)}
              >
                <span className="seat-avatar">
                  <Avatar
                    profile={isSelf ? (selfProfile ?? p.profile) : p.bot ? undefined : p.profile}
                    seed={p.id}
                  />
                </span>
                <span className="seat-identity">
                  <strong>
                    {p.bot ? p.profile?.nickname.replace(/^Highlord /, '') : p.profile?.nickname}
                  </strong>
                  <small>{num(p.stack)}</small>
                </span>
                {h && p.seat === h.button && (
                  <span className="dealer" aria-label={t('game:dealer')}>
                    D
                  </span>
                )}
                {p.bot && <span className="bot-tag">BOT</span>}
              </button>
              {acting && (
                <div className="seat-timer">
                  <i
                    style={{
                      width: Math.min(100, (seconds / snapshot.config.turnSeconds) * 100) + '%',
                    }}
                  />
                </div>
              )}
              {h?.done && h.awards[p.id] ? (
                <span className="winner">{t('game:won', { amount: num(h.awards[p.id]) })}</span>
              ) : (
                <span className="seat-status">
                  {p.folded
                    ? t('game:folded')
                    : h && p.stack === 0
                      ? t('game:allIn')
                      : p.sitOut
                        ? t('game:sitOutStatus')
                        : last
                          ? t(`game:${last.action}`)
                          : isSelf
                            ? t('game:you')
                            : p.bot
                              ? t(difficultyLabels[p.bot.difficulty])
                              : t('game:ready')}
                </span>
              )}
            </div>
            {p.bet > 0 && (
              <span className="seat-bet" style={betPosition}>
                <i className="tiny-chip" />
                {num(p.bet)}
              </span>
            )}
          </React.Fragment>
        );
      })}
      <div
        className={`turn-indicator ${h?.actor === snapshot.me && !h.done ? 'your-turn' : ''}`}
        role="status"
      >
        {snapshot.status === 'PAUSED' ? (
          t('game:PAUSED')
        ) : h && !h.done && actor ? (
          <>
            <span className="pulse-dot" />
            {h.actor === snapshot.me
              ? t('game:yourTurn')
              : t('game:actingPlayer', { name: actor.profile?.nickname })}
            <strong>{seconds}s</strong>
          </>
        ) : h?.done ? (
          t('game:nextHand')
        ) : (
          t('game:setupTable')
        )}
      </div>
    </div>
  );
}
export function RoomStats({ snapshot, num }: { snapshot: Snapshot; num: (n: number) => string }) {
  const { t } = useTranslation();
  const active = snapshot.players.filter((p) => !p.left && !p.rank);
  const avg = active.length
    ? Math.round(active.reduce((n, p) => n + p.stack, 0) / active.length)
    : 0;
  return (
    <div className="room-stats">
      <div>
        <small>{t('game:blinds')}</small>
        <strong>
          {num(snapshot.level.small)} <span>/</span> {num(snapshot.level.big)}
        </strong>
      </div>
      <div>
        <small>{t('lobby:ante')}</small>
        <strong>{num(snapshot.level.ante)}</strong>
      </div>
      <div>
        <small>{t('game:players')}</small>
        <strong>
          {snapshot.status === 'FINISHED'
            ? snapshot.players.filter((p) => !p.left).length
            : active.length}
          <span>
            {' '}
            /{' '}
            {snapshot.config.mode === 'TOURNAMENT'
              ? snapshot.config.capacity
              : snapshot.config.seats}
          </span>
        </strong>
      </div>
      {snapshot.config.mode !== 'CASH' ? (
        <>
          <div>
            <small>{t('game:level', { number: snapshot.level.index + 1 })}</small>
            <strong>
              {snapshot.level.break
                ? t('game:break')
                : snapshot.level.remaining === 0
                  ? t('game:finalLevel')
                  : `${Math.floor(Math.max(0, snapshot.level.remaining) / 60000)}:${String(Math.floor((Math.max(0, snapshot.level.remaining) % 60000) / 1000)).padStart(2, '0')}`}
            </strong>
          </div>
          <div>
            <small>{t('game:prizePool')}</small>
            <strong>{num(snapshot.pool)}</strong>
          </div>
        </>
      ) : (
        <div>
          <small>{t('game:average')}</small>
          <strong>{num(avg)}</strong>
        </div>
      )}
      <div>
        <small>{t('game:elapsed')}</small>
        <strong>{Math.floor(snapshot.elapsed / 60000)} min</strong>
      </div>
    </div>
  );
}
export function RoomDirector({
  snapshot,
  busy,
  num,
  run,
  tab,
  onTab,
  selected,
  chat,
}: {
  snapshot: Snapshot;
  busy: boolean;
  num: (n: number) => string;
  run: (type: Command['type'], payload?: Record<string, unknown>) => Promise<unknown>;
  tab: string;
  onTab: (tab: string) => void;
  selected: string;
  chat: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [confirmation, setConfirmation] = useState<{
    target: string;
    action: string;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const active = snapshot.players.filter((p) => !p.left);
  const botCount = active.filter((p) => p.bot).length;
  const limit =
    snapshot.config.mode === 'TOURNAMENT' ? snapshot.config.capacity : snapshot.config.seats;
  const fill = Math.max(0, Math.min(8 - botCount, snapshot.config.seats - active.length));
  const waiting = snapshot.status === 'WAITING';
  return (
    <aside className="room-rail" id="room-director">
      <div className="rail-tabs" role="tablist" aria-label={t('game:roomPanel')}>
        {['players', 'chat', 'structure'].map((key) => (
          <button
            role="tab"
            id={`tab-${key}`}
            aria-controls={`panel-${key}`}
            aria-selected={tab === key}
            key={key}
            onKeyDown={(e) => {
              const keys = ['players', 'chat', 'structure'];
              const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (direction) {
                e.preventDefault();
                const next = keys[(keys.indexOf(key) + direction + 3) % 3];
                onTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => onTab(key)}
          >
            {t(`game:panel${key}`)}
            {key === 'players' && <span>{active.length}</span>}
          </button>
        ))}
      </div>
      <section
        id="panel-players"
        role="tabpanel"
        aria-labelledby="tab-players"
        hidden={tab !== 'players'}
      >
        {snapshot.host && waiting && snapshot.botsSupported && (
          <div className="director-tools">
            <div className="rail-heading">
              <span>♜</span>
              <div>
                <h2>{t('game:hostPanel')}</h2>
                <p>{t('game:botsHint')}</p>
              </div>
            </div>
            <label>
              {t('game:botDifficulty')}
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {(Object.keys(difficultyLabels) as (keyof typeof difficultyLabels)[]).map(
                  (level) => (
                    <option key={level} value={level}>
                      {t(difficultyLabels[level])}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="director-actions">
              <button
                disabled={busy || active.length >= limit || botCount >= 8}
                aria-label={t('game:addBot')}
                onClick={() => void run('ADD_BOTS', { difficulty, count: 1 })}
              >
                ＋ {t('game:addBot')}
              </button>
              <button
                disabled={busy || fill < 1}
                onClick={() => void run('ADD_BOTS', { difficulty, count: fill })}
              >
                {t('game:fillBots')}
              </button>
            </div>
          </div>
        )}
        {!waiting && (
          <div className="rail-heading">
            <span>♛</span>
            <div>
              <h2>{t('game:standings')}</h2>
              <p>{t('game:clickPlayer')}</p>
            </div>
          </div>
        )}
        <div className="roster-wrap">
          <table className="roster">
            <caption>
              {t('game:players')} · {active.length}/{limit}
            </caption>
            <thead>
              <tr>
                <th>{t('game:player')}</th>
                <th>{t('game:stack')}</th>
                <th>
                  <span className="sr-only">{t('game:manage')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...snapshot.players]
                .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.stack - a.stack)
                .map((p) => (
                  <tr
                    key={p.id}
                    className={`${selected === p.id ? 'selected-player' : ''} ${p.left ? 'left-player' : ''}`}
                  >
                    <td>
                      <div className="roster-name">
                        <span className="roster-avatar" style={{ color: p.profile?.accent }}>
                          <Avatar profile={p.bot ? undefined : p.profile} seed={p.id} />
                        </span>
                        <div>
                          <strong>{p.profile?.nickname}</strong>
                          <small>
                            {p.bot
                              ? 'BOT · ' + t(difficultyLabels[p.bot.difficulty])
                              : p.id === snapshot.me
                                ? t('game:you')
                                : p.online
                                  ? t('online')
                                  : t('game:disconnected')}
                            {p.rank ? ` · #${p.rank}` : ''}
                            {p.left ? ' · ' + t('game:left') : ''}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {num(p.stack)}
                      {snapshot.payouts[p.id] > 0 && (
                        <small className="payout">+{num(snapshot.payouts[p.id])}</small>
                      )}
                    </td>
                    <td>
                      {p.bot && snapshot.host && waiting && !p.left ? (
                        <button
                          className="remove-player"
                          disabled={busy}
                          title={t('game:removeBot')}
                          aria-label={t('game:removeBot')}
                          onClick={() => void run('REMOVE_BOT', { target: p.id })}
                        >
                          ×
                        </button>
                      ) : (
                        p.id !== snapshot.me &&
                        !p.left && (
                          <details className="moderation">
                            <summary
                              aria-label={t('game:managePlayer', { name: p.profile?.nickname })}
                            >
                              ⋯
                            </summary>
                            {snapshot.host &&
                              ['MUTE', 'KICK', 'BAN'].map((action) => (
                                <button
                                  key={action}
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirmation({
                                      target: p.id,
                                      action,
                                      name: p.profile?.nickname ?? '',
                                    })
                                  }
                                >
                                  {t(`chat:${action.toLowerCase()}`)}
                                </button>
                              ))}
                            {!p.bot && (
                              <button
                                onClick={() =>
                                  setConfirmation({
                                    target: p.id,
                                    action: 'REPORT',
                                    name: p.profile?.nickname ?? '',
                                  })
                                }
                              >
                                {t('chat:report')}
                              </button>
                            )}
                          </details>
                        )
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {confirmation && (
          <div className="confirm-panel" role="alertdialog" aria-label={t('game:confirmManage')}>
            <strong>{t('game:confirmManage')}</strong>
            <p>
              {t(`chat:${confirmation.action.toLowerCase()}`)} · {confirmation.name}
            </p>
            {confirmation.action === 'REPORT' && (
              <label>
                {t('chat:reportReason')}
                <input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            <div>
              <button
                disabled={busy || (confirmation.action === 'REPORT' && !reason.trim())}
                className="primary"
                onClick={async () => {
                  const ok = await run(
                    confirmation.action === 'REPORT' ? 'REPORT' : 'MODERATE',
                    confirmation.action === 'REPORT'
                      ? { target: confirmation.target, text: reason }
                      : { target: confirmation.target, action: confirmation.action },
                  );
                  if (ok) {
                    setConfirmation(null);
                    setReason('');
                  }
                }}
              >
                {t('confirm')}
              </button>
              <button onClick={() => setConfirmation(null)}>{t('cancel')}</button>
            </div>
          </div>
        )}
        <p className="rail-note">{waiting ? t('game:seatHint') : t('game:botLocked')}</p>
      </section>
      <section id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" hidden={tab !== 'chat'}>
        {chat}
      </section>
      <section
        id="panel-structure"
        role="tabpanel"
        aria-labelledby="tab-structure"
        hidden={tab !== 'structure'}
        className="structure-panel"
      >
        <h2>{t('game:roomStructure')}</h2>
        <dl>
          <div>
            <dt>{t('lobby:mode')}</dt>
            <dd>{t(`game:${snapshot.config.mode}`)}</dd>
          </div>
          <div>
            <dt>{t('lobby:stack')}</dt>
            <dd>{num(snapshot.config.stack)}</dd>
          </div>
          <div>
            <dt>{t('lobby:turnSeconds')}</dt>
            <dd>{snapshot.config.turnSeconds}s</dd>
          </div>
          <div>
            <dt>{t('lobby:rebuy')}</dt>
            <dd>{t(snapshot.config.rebuy ? 'yes' : 'no')}</dd>
          </div>
          <div>
            <dt>{t('lobby:buyIn')}</dt>
            <dd>{num(snapshot.config.buyIn)}</dd>
          </div>
        </dl>
        {snapshot.config.mode !== 'CASH' && (
          <>
            <h3>{t('lobby:levels')}</h3>
            <div className="levels-list">
              {snapshot.config.levels.map((l, i) => (
                <div key={i} className={i === snapshot.level.index ? 'current-level' : ''}>
                  <b>{i + 1}</b>
                  <span>
                    {num(l.small)} / {num(l.big)}
                    <small>
                      Ante {num(l.ante)}{' '}
                      {l.breakMinutes > 0 ? ` · ${t('game:break')} ${l.breakMinutes}m` : ''}
                    </small>
                  </span>
                  <strong>{l.minutes}m</strong>
                </div>
              ))}
            </div>
            <p className="rail-note">{t('game:payoutHint')}</p>
          </>
        )}
      </section>
    </aside>
  );
}
