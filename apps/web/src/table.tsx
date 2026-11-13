import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientMessage } from '../../../packages/contracts/src/index.ts';
import { bestFive } from '../../../packages/poker-engine/src/index.ts';
import { Avatar } from './avatar.tsx';
import { Card } from './card.tsx';
import { adviseAction, countOuts, estimateEquity, potOdds } from './coach.ts';
import { useCountdown, type ActionLabel, type Sweep } from './fx.ts';
import { computeHud, type HudLine } from './hud.ts';
import type { PlayerView, RoomView } from './net.ts';
import { visibleHand } from './poker-learning.ts';
import { playSound } from './audio.ts';
import { prefsStore, useStore } from './store.ts';

export type Send = (message: ClientMessage) => void;
export { portrait } from './avatar.tsx';
export const useNumber = () => {
  const { i18n } = useTranslation();
  return (n: number) => new Intl.NumberFormat(i18n.language).format(n);
};

/** Cadeira `rel` (0 = eu, embaixo) no oval; retorna % do palco. */
function seatPosition(rel: number, count: number, tall: boolean) {
  const angle = Math.PI / 2 + (2 * Math.PI * rel) / count;
  const rx = tall ? 41 : 46;
  const ry = tall ? 38 : 35;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Em pé a mesa é um "estádio" (superelipse): os assentos ocupam os cantos e o centro sobra para o pote.
  const curve = tall ? 0.75 : 1;
  const bend = (v: number) => Math.sign(v) * Math.abs(v) ** curve;
  return { x: 50 + rx * bend(cos), y: 50 + ry * bend(sin) };
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

/** Fichas de cassino: cada valor tem sua cor (1 branca, 5 vermelha, 25 verde, 100 preta...). */
const DENOMINATIONS = [
  { value: 5000, color: '#d6a53a' },
  { value: 1000, color: '#7a4cc2' },
  { value: 500, color: '#2a6fb0' },
  { value: 100, color: '#1e1c22' },
  { value: 25, color: '#2f8a57' },
  { value: 5, color: '#c8353f' },
  { value: 1, color: '#e9e4d8' },
] as const;

function stacksFor(amount: number) {
  const stacks: { color: string; count: number }[] = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const { value, color } of DENOMINATIONS) {
    const count = Math.floor(rest / value);
    if (count > 0) stacks.push({ color, count });
    rest -= count * value;
  }
  // As três maiores pilhas bastam para ler o valor de relance.
  return stacks.slice(0, 3);
}

/** Pilhas de fichas por valor ao lado do total. */
export function Chips({ amount, className = '' }: { amount: number; className?: string }) {
  const format = useNumber();
  return (
    <div className={`chips ${className}`}>
      <span className="chip-pile" aria-hidden>
        {stacksFor(amount).map((stack, index) => (
          <span key={index} className="chip-stack" style={{ ['--chip' as string]: stack.color }}>
            {Array.from({ length: Math.min(5, stack.count) }, (_, i) => (
              <i key={i} style={{ bottom: `${i * 3.5}px` }} />
            ))}
          </span>
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
  hud,
  fiveCards,
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
  hud?: HudLine;
  /** As cinco cartas que formaram a mão vencedora deste jogador (só no showdown). */
  fiveCards?: Set<string>;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const hand = state.hand;
  const acting = !!hand && !hand.done && hand.actor === player.id;
  const remaining = useCountdown(acting ? hand!.deadline : undefined, serverNow);
  const isMe = player.id === state.me;
  // Últimos 5 segundos da minha vez: um tique por segundo.
  const secondsLeft = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (isMe && acting && secondsLeft > 0 && secondsLeft <= 5) playSound('tick');
  }, [isMe, acting, secondsLeft]);
  const award = hand?.done ? (hand.awards[player.id] ?? 0) : 0;
  const allIn = player.inHand && !player.folded && player.stack === 0 && !hand?.done;
  const showCards = player.inHand && (!hand?.done || !player.folded || player.shown);
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
        allIn && 'allin',
        (player.sitOut || !player.online) && 'away',
        !player.inHand && 'idle',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-seat={player.seat}
    >
      {showCards && (
        <div className="hole" key={`hole-${hand?.id}`}>
          {[0, 1].map((i) => (
            <Card
              key={`${hand?.id}-${i}`}
              card={player.cards[i]}
              down={!player.cards[i]}
              glow={
                award > 0 && !!player.cards[i] && (!fiveCards || fiveCards.has(player.cards[i]))
              }
              dim={!!fiveCards && award > 0 && !!player.cards[i] && !fiveCards.has(player.cards[i])}
              className="hole-card"
              style={{ ['--i' as string]: i + player.seat * 2 }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="avatar"
        data-frame={player.color ?? 'brass'}
        onClick={() => onPick(player)}
        aria-label={player.nickname}
        title={
          player.botStyle && player.bot
            ? `${player.nickname} · ${t(`game:style_${player.botStyle}`)}`
            : canKick || !isMe
              ? player.nickname
              : undefined
        }
      >
        {acting && (
          <TimerRing
            remaining={remaining}
            total={state.config.turnSeconds * 1000}
            urgent={isMe && remaining < 6000}
          />
        )}
        <Avatar avatar={player.avatar} id={player.id} />
        {player.isButton && (
          <span className="dealer" title={t('game:dealer')}>
            D
          </span>
        )}
        {player.bot && <span className="bot-tag">BOT</span>}
        {hand?.straddler === player.id && (
          <span className="straddle-tag" title={t('game:straddle')}>
            S
          </span>
        )}
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
        {hud && hud.hands >= 4 && (
          <small className="hud" title={t('game:hudTitle', { hands: hud.hands })}>
            V{hud.vpip} · P{hud.pfr}
            {hud.aggression !== null && ` · A${hud.aggression}`}
          </small>
        )}
      </div>
      {label && !hand?.done && (
        <span className="act-label" key={label.at}>
          {labelText}
        </span>
      )}
      {award > 0 && (
        <span className="win-pop" key={`win-${hand?.id}`}>
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
  const prefs = useStore(prefsStore);
  const hud = useMemo(
    () => (prefs.hud ? computeHud(state.history) : {}),
    [prefs.hud, state.history],
  );
  // No showdown, destaca as cinco cartas da mão vencedora e apaga o resto da mesa.
  const highlight = useMemo(() => {
    if (!hand?.done || !hand.showdown || hand.board.length < 5 || hand.board2) return null;
    const board = new Set<string>();
    const perPlayer: Record<string, Set<string>> = {};
    for (const [id, amount] of Object.entries(hand.awards)) {
      const winner = state.players.find((p) => p.id === id);
      if (amount <= 0 || !winner || winner.cards.length !== 2) continue;
      const five = bestFive([...winner.cards, ...hand.board]);
      perPlayer[id] = new Set(five);
      for (const card of five) if (hand.board.includes(card)) board.add(card);
    }
    return board.size || Object.keys(perPlayer).length ? { board, perPlayer } : null;
  }, [hand, state.players]);

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
                dim={!!highlight && !highlight.board.has(hand.board[i])}
                glow={!!highlight && highlight.board.has(hand.board[i])}
                className={`board-card ${i < 3 ? 'flop' : ''}`}
                style={{ ['--i' as string]: i < 3 ? i : 0 }}
              />
            ) : (
              <div key={i} className="board-slot" />
            ),
          )}
        </div>
        {hand?.board2 && (
          <div className="board board-second" aria-label={t('game:secondBoard')}>
            <small>{t('game:secondBoard')}</small>
            {hand.board2.map((card) => (
              <Card key={card} card={card} className="board-card" />
            ))}
          </div>
        )}
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

      {hand?.done &&
        Object.entries(hand.awards).map(([id, amount]) => {
          const winner = amount > 0 ? state.players.find((p) => p.id === id) : undefined;
          if (!winner) return null;
          const { x, y } = seatPosition((winner.seat - base + count) % count, count, tall);
          return (
            <span
              key={`award-${hand.id}-${id}`}
              className="award"
              aria-hidden
              style={{ ['--x' as string]: `${x}%`, ['--y' as string]: `${y}%` }}
            >
              <Chips amount={Math.min(amount, 1500)} />
            </span>
          );
        })}

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
            hud={hud[player.id]}
            fiveCards={highlight?.perPlayer[player.id]}
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

  // Tempo extra: cada ficha vale 15 s.
  const canBank = myTurn && (me?.bank ?? 0) >= 15_000;
  const banks = Math.floor((me?.bank ?? 0) / 15_000);
  // Atalhos 1 a 5 do painel de aumento: mínimo, 1/3, 1/2, 3/4 do pote... e all-in.
  const quickAmounts = [min, potRaise(1 / 3), potRaise(0.5), potRaise(0.75), potRaise(1), max];

  useEffect(() => {
    if (!myTurn) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (key === 'f') send({ type: 'ACT', action: 'FOLD' });
      else if (key === 'c') send({ type: 'ACT', action: toCall ? 'CALL' : 'CHECK' });
      else if (key === 'r' && canRaise) setRaising((r) => !r);
      else if (key === 't' && canBank) send({ type: 'TIME_BANK' });
      else if (key === 'escape') setRaising(false);
      else if (key === 'enter' && raising) confirmRaise();
      else if (raising && quickAmounts[Number(key) - 1] !== undefined)
        setAmount(quickAmounts[Number(key) - 1]);
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

  const opponents = state.players.filter((p) => p.inHand && !p.folded && p.id !== state.me).length;
  const holeKey = me?.cards.join('') ?? '';
  const inPlay = !!me && !!hand && !hand.done && !me.folded && me.cards.length === 2;
  const [equity, setEquity] = useState<number | null>(null);
  useEffect(() => {
    if (!prefs.coach || !inPlay || opponents < 1) return setEquity(null);
    const timer = setTimeout(
      () => setEquity(estimateEquity(me!.cards, hand!.board, opponents)),
      30,
    );
    return () => clearTimeout(timer);
  }, [prefs.coach, inPlay, hand?.id, hand?.board.length, holeKey, opponents]);
  const outs = useMemo(
    () => (prefs.coach && inPlay ? countOuts(me!.cards, hand!.board) : null),
    [prefs.coach, inPlay, hand?.board.length, holeKey],
  );
  const advice = equity !== null && myTurn ? adviseAction(equity, toCall, pot) : null;

  // Dica didática sobre o último agressor, quando é um bot de estilo conhecido.
  const botHint = useMemo(() => {
    if (!prefs.coach || !myTurn || toCall <= 0 || !hand) return null;
    const lastRaise = [...hand.log]
      .reverse()
      .find((e) => e.action === 'BET' || e.action === 'RAISE' || e.action === 'ALL_IN');
    const aggressor = lastRaise && state.players.find((p) => p.id === lastRaise.player);
    return aggressor?.bot && aggressor.botStyle && aggressor.id !== state.me
      ? { name: aggressor.nickname, style: aggressor.botStyle }
      : null;
  }, [prefs.coach, myTurn, toCall, hand, state.players, state.me]);

  const coachLine = useMemo(() => {
    if (!prefs.coach || !me || !hand || me.cards.length !== 2 || me.folded) return null;
    const best = visibleHand(me.cards, hand.board);
    return best
      ? t('game:youHave', { hand: t(`learn:rank${best.category}`) })
      : t('game:preflopHint');
  }, [prefs.coach, me, hand, t]);

  // Depois da mão, quem ainda não mostrou as cartas pode revelá-las (útil ao desistir ou ao ganhar sem showdown).
  const canShowHand = !!me && !!hand?.done && me.inHand && me.cards.length === 2 && !me.shown;

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
          <button onClick={() => setAmount(quickAmounts[0])}>
            {t('game:minimum')} <kbd>1</kbd>
          </button>
          <button onClick={() => setAmount(quickAmounts[1])}>
            {t('game:thirdPot')} <kbd>2</kbd>
          </button>
          <button onClick={() => setAmount(quickAmounts[2])}>
            {t('game:halfPot')} <kbd>3</kbd>
          </button>
          <button onClick={() => setAmount(quickAmounts[3])}>
            {t('game:threeQuarterPot')} <kbd>4</kbd>
          </button>
          <button onClick={() => setAmount(quickAmounts[4])}>
            {t('game:fullPot')} <kbd>5</kbd>
          </button>
          <button onClick={() => setAmount(max)}>
            {t('game:allInTag')} <kbd>6</kbd>
          </button>
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
        {canBank && (
          <button
            className="ghost bank"
            onClick={() => send({ type: 'TIME_BANK' })}
            title={t('game:timeBankHint')}
          >
            {t('game:timeBank', { count: banks })} <kbd>T</kbd>
          </button>
        )}
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
        <div className="coach-group">
          {coachLine && <span className="coach">{coachLine}</span>}
          {equity !== null && (
            <span className="coach-stat" title={t('game:equityHint')}>
              {t('game:equity', { pct: Math.round(equity * 100) })}
            </span>
          )}
          {inPlay && toCall > 0 && (
            <span className="coach-stat" title={t('game:potOddsHint')}>
              {t('game:potOdds', { pct: Math.round(potOdds(toCall, pot) * 100) })}
            </span>
          )}
          {outs !== null && outs > 0 && (
            <span className="coach-stat" title={t('game:outsHint')}>
              {t('game:outs', { count: outs })}
            </span>
          )}
          {botHint && (
            <span className="coach">
              {t(`game:botHint_${botHint.style}`, { name: botHint.name })}
            </span>
          )}
          {advice && (
            <span className={`coach advice advice-${advice}`}>{t(`game:advice_${advice}`)}</span>
          )}
        </div>
        <div className="meta-buttons">
          {canShowHand && (
            <button className="ghost small" onClick={() => send({ type: 'SHOW' })}>
              {t('game:showHand')}
            </button>
          )}
          {me && state.config.mode === 'CASH' && me.stack > 0 && sitOutToggle}
        </div>
      </div>
      {content}
    </footer>
  );
}
