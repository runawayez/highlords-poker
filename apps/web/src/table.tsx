import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientMessage } from '../../../packages/contracts/src/index.ts';
import { Card } from './card.tsx';
import { useCountdown, type ActionLabel, type Sweep } from './fx.ts';
import type { PlayerView, RoomView } from './net.ts';
import { visibleHand } from './poker-learning.ts';
import { playSound } from './audio.ts';
import { prefsStore, useStore } from './store.ts';

export type Send = (message: ClientMessage) => void;
export const portrait = (avatar: string) => `/avatars/avatar-${avatar.replace('a', '') || 1}.webp`;
export const useNumber = () => {
  const { i18n } = useTranslation();
  return (n: number) => new Intl.NumberFormat(i18n.language).format(n);
};

/** Cadeira `rel` (0 = eu, embaixo) no oval; retorna % do palco. */
function seatPosition(rel: number, count: number, tall: boolean) {
  const angle = Math.PI / 2 + (2 * Math.PI * rel) / count;
  const rx = tall ? 40 : 42;
  const ry = tall ? 38 : 34;
  return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
}

function useTall() {
  const query = '(max-aspect-ratio: 1/1)';
  const [tall, setTall] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setTall(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return tall;
}

const chipColors = ['#e9e4d8', '#c8353f', '#2f8a57', '#1e1c22', '#7a4cc2', '#d6a53a'];
/** Pilha de fichas: a cor reflete a grandeza do valor. */
export function Chips({ amount, className = '' }: { amount: number; className?: string }) {
  const format = useNumber();
  const tier = Math.min(
    chipColors.length - 1,
    Math.max(0, Math.floor(Math.log10(Math.max(1, amount)) - 0.7)),
  );
  const discs = Math.min(5, 1 + Math.floor(Math.log2(Math.max(1, amount)) / 3));
  return (
    <div className={`chips ${className}`}>
      <span className="chip-stack" style={{ ['--chip' as string]: chipColors[tier] }}>
        {Array.from({ length: discs }, (_, i) => (
          <i key={i} style={{ bottom: `${i * 4}px` }} />
        ))}
      </span>
      <b>{format(amount)}</b>
    </div>
  );
}

function TimerRing({
  remaining,
  total,
  urgent,
}: {
  remaining: number;
  total: number;
  urgent: boolean;
}) {
  const ratio = total ? Math.min(1, remaining / total) : 0;
  return (
    <svg className={`timer-ring ${urgent ? 'urgent' : ''}`} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" pathLength="100" />
      <circle
        className="timer-progress"
        cx="50"
        cy="50"
        r="46"
        pathLength="100"
        strokeDasharray={`${ratio * 100} 100`}
      />
    </svg>
  );
}

function Seat({
  player,
  state,
  x,
  y,
  label,
  handName,
  serverNow,
  canKick,
  onPick,
}: {
  player: PlayerView;
  state: RoomView;
  x: number;
  y: number;
  label?: ActionLabel;
  handName?: string;
  serverNow: () => number;
  canKick: boolean;
  onPick: (p: PlayerView) => void;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const hand = state.hand;
  const acting = !!hand && !hand.done && hand.actor === player.id;
  const remaining = useCountdown(acting ? hand!.deadline : undefined, serverNow);
  const isMe = player.id === state.me;
  const award = hand?.done ? (hand.awards[player.id] ?? 0) : 0;
  const allIn = player.inHand && !player.folded && player.stack === 0 && !hand?.done;
  const showCards = player.inHand && (!hand?.done || !player.folded);
  const labelText = label
    ? label.action === 'FOLD'
      ? t('game:actFold')
      : label.action === 'CHECK'
        ? t('game:actCheck')
        : label.action === 'CALL'
          ? t('game:actCall')
          : label.action === 'BET'
            ? t('game:actBet', { amount: format(label.amount) })
            : label.action === 'RAISE'
              ? t('game:actRaise', { amount: format(label.amount) })
              : t('game:actAllIn', { amount: format(label.amount) })
    : '';
  return (
    <div
      className={[
        'seat',
        isMe && 'me',
        acting && 'acting',
        player.folded && 'folded',
        award > 0 && 'winner',
        (player.sitOut || !player.online) && 'away',
        !player.inHand && 'idle',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-seat={player.seat}
    >
      {showCards && (
        <div className="hole">
          {[0, 1].map((i) => (
            <Card
              key={`${hand?.id}-${i}`}
              card={player.cards[i]}
              down={!player.cards[i]}
              glow={award > 0 && !!player.cards[i]}
              className="hole-card"
              style={{ ['--i' as string]: i + player.seat * 2 }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="avatar"
        onClick={() => onPick(player)}
        aria-label={player.nickname}
        title={canKick || !isMe ? player.nickname : undefined}
      >
        {acting && (
          <TimerRing
            remaining={remaining}
            total={state.config.turnSeconds * 1000}
            urgent={isMe && remaining < 6000}
          />
        )}
        <img src={portrait(player.avatar)} alt="" draggable={false} />
        {player.isButton && (
          <span className="dealer" title={t('game:dealer')}>
            D
          </span>
        )}
        {player.bot && <span className="bot-tag">BOT</span>}
      </button>
      <div className="plate">
        <strong>{isMe ? t('game:you') : player.nickname}</strong>
        <span>
          {allIn
            ? t('game:allInTag')
            : player.sitOut
              ? t('game:sittingOut')
              : !player.online
                ? t('game:offline')
                : format(player.stack)}
        </span>
      </div>
      {label && !hand?.done && (
        <span className="act-label" key={label.at}>
          {labelText}
        </span>
      )}
      {award > 0 && (
        <span className="win-pop" key={hand?.id}>
          +{format(award)}
          {handName && <small>{handName}</small>}
        </span>
      )}
    </div>
  );
}

function EmptySeat({
  x,
  y,
  canSit,
  onSit,
}: {
  x: number;
  y: number;
  canSit: boolean;
  onSit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="seat empty" style={{ left: `${x}%`, top: `${y}%` }}>
      <button
        type="button"
        className="avatar sit"
        disabled={!canSit}
        onClick={onSit}
        aria-label={t('game:sit')}
      >
        <span>+</span>
      </button>
      {canSit && (
        <div className="plate">
          <span>{t('game:sit')}</span>
        </div>
      )}
    </div>
  );
}

export function Table({
  state,
  labels,
  sweeps,
  emotes,
  serverNow,
  send,
  onPick,
}: {
  state: RoomView;
  labels: Record<string, ActionLabel>;
  sweeps: Sweep[];
  emotes: { n: number; id: string; emote: string }[];
  serverNow: () => number;
  send: Send;
  onPick: (p: PlayerView) => void;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const tall = useTall();
  const count = state.config.seats;
  const mine = state.players.find((p) => p.id === state.me);
  const base = mine?.seat ?? 0;
  const hand = state.hand;
  const canSit =
    !mine &&
    state.status !== 'FINISHED' &&
    (state.config.mode === 'CASH' || state.status === 'WAITING') &&
    state.players.length < count;
  const lastWin = state.history[state.history.length - 1];
  const winners = hand?.done && lastWin?.no === state.handNo ? lastWin.winners : [];
  const handNames = Object.fromEntries(
    winners
      .filter((w) => w.category !== undefined)
      .map((w) => [w.id, t(`learn:rank${w.category}`)]),
  );
  const bySeat = useMemo(() => new Map(state.players.map((p) => [p.seat, p])), [state.players]);
  const meWon = !!hand?.done && (hand.awards[state.me] ?? 0) > 0;

  return (
    <div className={`stage ${tall ? 'tall' : ''}`}>
      <div className="rail">
        <div className="felt">
          <div className="felt-mark" aria-hidden>
            <span>♠</span>
            <em>HIGHLORDS</em>
          </div>
        </div>
      </div>

      <div className="center">
        {hand && hand.pot > 0 && (
          <div className="pot" key={hand.pot}>
            <Chips amount={hand.pot} />
            <small>{t('game:pot')}</small>
          </div>
        )}
        <div className="board">
          {Array.from({ length: 5 }, (_, i) =>
            hand?.board[i] ? (
              <Card
                key={hand.board[i]}
                card={hand.board[i]}
                className={`board-card ${i < 3 ? 'flop' : ''}`}
                style={{ ['--i' as string]: i < 3 ? i : 0 }}
              />
            ) : (
              <div key={i} className="board-slot" />
            ),
          )}
        </div>
        {winners.length > 0 && (
          <div className="banner" key={hand?.id} role="status">
            {winners.slice(0, 2).map((w) => (
              <span key={w.id}>
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
              </span>
            ))}
          </div>
        )}
        {state.status !== 'RUNNING' && (
          <div className="status-pill">
            {state.status === 'PAUSED'
              ? state.pauseReason === 'EMPTY'
                ? t('game:pausedEmpty')
                : t('game:paused')
              : state.status === 'FINISHED'
                ? t('game:finished')
                : t('game:waitingPlayers')}
          </div>
        )}
      </div>

      {Array.from({ length: count }, (_, seat) => {
        const rel = (seat - base + count) % count;
        const { x, y } = seatPosition(rel, count, tall);
        const player = bySeat.get(seat);
        return player ? (
          <Seat
            key={seat}
            player={player}
            state={state}
            x={x}
            y={y}
            label={labels[player.id]}
            handName={handNames[player.id]}
            serverNow={serverNow}
            canKick={state.host}
            onPick={onPick}
          />
        ) : (
          <EmptySeat
            key={seat}
            x={x}
            y={y}
            canSit={canSit}
            onSit={() => {
              playSound('click');
              send({ type: 'SIT', seat });
            }}
          />
        );
      })}

      {state.players.map((p) => {
        const bet = hand && !hand.done ? p.bet : 0;
        const rel = (p.seat - base + count) % count;
        const { x, y } = seatPosition(rel, count, tall);
        const bx = 50 + (x - 50) * 0.56;
        const by = 50 + (y - 50) * 0.56;
        const sweep = sweeps.find((s) => s.id === p.id);
        return (
          <React.Fragment key={p.id}>
            {bet > 0 && (
              <div
                className="bet"
                style={{
                  left: `${bx}%`,
                  top: `${by}%`,
                  ['--from-x' as string]: `${(x - bx) * 8}px`,
                  ['--from-y' as string]: `${(y - by) * 8}px`,
                }}
                key={bet}
              >
                <Chips amount={bet} />
              </div>
            )}
            {sweep && (
              <div
                className="bet sweep"
                key={sweep.key}
                style={{
                  left: `${bx}%`,
                  top: `${by}%`,
                  ['--to-x' as string]: `${(50 - bx) * 8}px`,
                  ['--to-y' as string]: `${(46 - by) * 8}px`,
                }}
              >
                <Chips amount={sweep.amount} />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {emotes.map((e) => {
        const p = state.players.find((x) => x.id === e.id);
        if (!p) return null;
        const { x, y } = seatPosition((p.seat - base + count) % count, count, tall);
        return (
          <span key={e.n} className="emote" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden>
            {e.emote}
          </span>
        );
      })}

      {meWon && (
        <div className="confetti" key={hand?.id} aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Barra de ações: decisões na minha vez; atalhos de sala nas demais situações. */
export function ActionBar({
  state,
  send,
  serverNow,
}: {
  state: RoomView;
  send: Send;
  serverNow: () => number;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const prefs = useStore(prefsStore);
  const hand = state.hand;
  const me = state.players.find((p) => p.id === state.me);
  const legal = hand?.legal;
  const myTurn = !!hand && !hand.done && hand.actor === state.me && !!legal?.actions.length;
  const [raising, setRaising] = useState(false);
  const [amount, setAmount] = useState(0);
  const nextIn = useCountdown(hand?.done ? hand.nextHandAt : undefined, serverNow);

  const canRaise = !!legal && (legal.actions.includes('RAISE') || legal.actions.includes('BET'));
  const min = legal ? Math.min(legal.min, legal.max) : 0;
  const max = legal?.max ?? 0;
  const pot = hand?.pot ?? 0;
  const toCall = legal?.call ?? 0;
  const potRaise = (fraction: number) =>
    Math.max(min, Math.min(max, Math.round((hand?.currentBet ?? 0) + fraction * (pot + toCall))));

  useEffect(() => {
    setRaising(false);
    setAmount(min);
  }, [hand?.id, hand?.street, myTurn, min]);

  useEffect(() => {
    if (!myTurn) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (key === 'f') send({ type: 'ACT', action: 'FOLD' });
      else if (key === 'c') send({ type: 'ACT', action: toCall ? 'CALL' : 'CHECK' });
      else if (key === 'r' && canRaise) setRaising((r) => !r);
      else if (key === 'escape') setRaising(false);
      else if (key === 'enter' && raising) confirmRaise();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const confirmRaise = () => {
    const isAllIn = amount >= max;
    send(
      isAllIn
        ? { type: 'ACT', action: 'ALL_IN' }
        : {
            type: 'ACT',
            action: legal!.actions.includes('BET') && hand!.currentBet === 0 ? 'BET' : 'RAISE',
            amount,
          },
    );
    setRaising(false);
  };

  const coachLine = useMemo(() => {
    if (!prefs.coach || !me || !hand || me.cards.length !== 2 || me.folded) return null;
    const best = visibleHand(me.cards, hand.board);
    return best
      ? t('game:youHave', { hand: t(`learn:rank${best.category}`) })
      : t('game:preflopHint');
  }, [prefs.coach, me, hand, t]);

  const sitOutToggle = me && (
    <button className="ghost" onClick={() => send({ type: 'SIT_OUT', value: !me.sitOut })}>
      {me.sitOut ? t('game:imBack') : t('game:sitOut')}
    </button>
  );

  let content: React.ReactNode;
  if (myTurn && legal) {
    content = raising ? (
      <div className="raise-panel">
        <div className="quick">
          <button onClick={() => setAmount(min)}>{t('game:minimum')}</button>
          <button onClick={() => setAmount(potRaise(0.5))}>{t('game:halfPot')}</button>
          <button onClick={() => setAmount(potRaise(0.75))}>{t('game:threeQuarterPot')}</button>
          <button onClick={() => setAmount(potRaise(1))}>{t('game:fullPot')}</button>
          <button onClick={() => setAmount(max)}>{t('game:allInTag')}</button>
        </div>
        <div className="slider-row">
          <button
            className="ghost"
            onClick={() => setRaising(false)}
            aria-label={t('common:cancel')}
          >
            ✕
          </button>
          <input
            type="range"
            min={min}
            max={max}
            step={Math.max(1, Math.round(state.level.big / 2))}
            value={Math.min(Math.max(amount, min), max)}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label={t('game:amount')}
          />
          <input
            className="amount-input"
            type="number"
            min={min}
            max={max}
            value={amount}
            onChange={(e) =>
              setAmount(Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))))
            }
            aria-label={t('game:amount')}
          />
          <button
            className="primary"
            disabled={amount < min && amount < max}
            onClick={confirmRaise}
          >
            {amount >= max
              ? t('game:allIn', { amount: format(max) })
              : hand!.currentBet === 0
                ? t('game:bet', { amount: format(amount) })
                : t('game:raiseTo', { amount: format(amount) })}
          </button>
        </div>
      </div>
    ) : (
      <div className="actions">
        <button className="danger" onClick={() => send({ type: 'ACT', action: 'FOLD' })}>
          {t('game:fold')} <kbd>F</kbd>
        </button>
        <button
          className="call"
          onClick={() => send({ type: 'ACT', action: toCall ? 'CALL' : 'CHECK' })}
        >
          {toCall ? t('game:call', { amount: format(toCall) }) : t('game:check')} <kbd>C</kbd>
        </button>
        {canRaise ? (
          <button className="primary" onClick={() => setRaising(true)}>
            {hand!.currentBet === 0 ? t('game:betLabel') : t('game:raiseLabel')} <kbd>R</kbd>
          </button>
        ) : legal.actions.includes('ALL_IN') ? (
          <button className="primary" onClick={() => send({ type: 'ACT', action: 'ALL_IN' })}>
            {t('game:allIn', { amount: format(max) })}
          </button>
        ) : null}
      </div>
    );
  } else if (!me) {
    const canSit = state.status !== 'FINISHED' && state.players.length < state.config.seats;
    content = (
      <div className="actions single">
        <p className="hint">{canSit ? t('game:spectating') : t('game:spectatingFull')}</p>
        {canSit && (
          <button className="primary" onClick={() => send({ type: 'SIT' })}>
            {t('game:sitAny')}
          </button>
        )}
      </div>
    );
  } else if (state.config.mode === 'CASH' && me.stack === 0 && !me.inHand) {
    content = (
      <div className="actions single">
        <p className="hint">{t('game:bustedHint')}</p>
        <button className="primary" onClick={() => send({ type: 'REBUY' })}>
          {t('game:rebuy')}
        </button>
      </div>
    );
  } else if (state.status === 'WAITING') {
    content = (
      <div className="actions single">
        <p className="hint">
          {state.config.mode === 'SIT_AND_GO' ? t('game:sngHint') : t('game:waitingHint')}
        </p>
        {state.host && state.config.mode === 'SIT_AND_GO' && (
          <button
            className="primary"
            disabled={state.players.length < 2}
            onClick={() => send({ type: 'START' })}
          >
            {t('game:start')}
          </button>
        )}
      </div>
    );
  } else if (state.status === 'PAUSED' && state.host) {
    content = (
      <div className="actions single">
        <p className="hint">{t('game:paused')}</p>
        <button className="primary" onClick={() => send({ type: 'RESUME' })}>
          {t('game:resume')}
        </button>
      </div>
    );
  } else if (hand && !hand.done && hand.actor) {
    const actor = state.players.find((p) => p.id === hand.actor);
    content = <p className="hint">{t('game:waitingFor', { name: actor?.nickname ?? '…' })}</p>;
  } else if (hand?.done && nextIn > 0) {
    content = (
      <p className="hint">
        {t('game:handNo', { n: state.handNo })} · {Math.ceil(nextIn / 1000)}s
      </p>
    );
  } else content = <p className="hint">{t('game:connecting')}</p>;

  return (
    <footer className={`action-bar ${myTurn ? 'my-turn' : ''}`}>
      <div className="action-meta">
        {coachLine && <span className="coach">{coachLine}</span>}
        {me && state.config.mode === 'CASH' && me.stack > 0 && sitOutToggle}
      </div>
      {content}
    </footer>
  );
}
