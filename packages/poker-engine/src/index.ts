/** Highlords NLHE policy v1. Pure rules; callers supply a securely shuffled deck. */
export type Card = string;
export type Action = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';
export type Seat = { id: string; seat: number; stack: number };
export type HandPlayer = Seat & {
  cards: Card[];
  folded: boolean;
  bet: number;
  total: number;
  actedAt: number | null;
};
export type Hand = {
  id: string;
  players: HandPlayer[];
  deck: Card[];
  board: Card[];
  button: number;
  bigBlind: number;
  currentBet: number;
  minRaise: number;
  street: number;
  actor: string | null;
  done: boolean;
  showdown: boolean;
  awards: Record<string, number>;
  /** Segundo tabuleiro quando a mão foi decidida em duas rodadas (run it twice). */
  board2?: Card[];
  /** Quem aceitou decidir um all-in em duas rodadas. */
  twice: string[];
  /** Jogador que pagou o straddle (blind extra do under the gun), se houve. */
  straddler: string | null;
  log: { player: string; action: string; amount: number; street: number }[];
};
export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function demand(ok: unknown, code = 'INVALID_ACTION'): asserts ok {
  if (!ok) throw new RuleError(code);
}
export function deck(): Card[] {
  return [...'23456789TJQKA'].flatMap((r) => [...'cdhs'].map((s) => r + s));
}
export function shuffle(
  cards = deck(),
  random = (n: number) => {
    const a = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / n) * n;
    do {
      crypto.getRandomValues(a);
    } while (a[0] >= limit);
    return a[0] % n;
  },
): Card[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function score5(cards: Card[]): number[] {
  const ranks = cards.map((c) => '23456789TJQKA'.indexOf(c[0]) + 2).sort((a, b) => b - a);
  const groups = [...new Set(ranks)]
    .map((r) => [ranks.filter((x) => x === r).length, r])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const unique = [...new Set(ranks)];
  if (unique[0] === 14) unique.push(1);
  let straight = 0;
  for (let i = 0; i <= unique.length - 5; i++)
    if (unique[i] - unique[i + 4] === 4) {
      straight = unique[i];
      break;
    }
  const flush = cards.every((c) => c[1] === cards[0][1]);
  if (flush && straight) return [8, straight];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  if (groups[0][0] === 2 && groups[1][0] === 2)
    return [2, ...groups.slice(0, 2).map((g) => g[1]), groups[2][1]];
  if (groups[0][0] === 2) return [1, ...groups.map((g) => g[1])];
  return [0, ...ranks];
}
export function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
export function evaluate(cards: Card[]): number[] {
  demand(cards.length >= 5 && cards.length <= 7, 'INVALID_CARDS');
  let best: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (compare(s, best) > 0) best = s;
          }
  return best;
}
/** As cinco cartas que formam a melhor mão (para destacar no showdown). */
export function bestFive(cards: Card[]): Card[] {
  demand(cards.length >= 5 && cards.length <= 7, 'INVALID_CARDS');
  let best: number[] = [];
  let pick: Card[] = cards.slice(0, 5);
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const s = score5(five);
            if (compare(s, best) > 0) {
              best = s;
              pick = five;
            }
          }
  return pick;
}
function pay(p: HandPlayer, n: number, street = true) {
  n = Math.min(p.stack, n);
  p.stack -= n;
  p.total += n;
  if (street) p.bet += n;
}
function clockwise(h: Hand, after: number) {
  return [...h.players].sort(
    (a, b) => ((a.seat - after + 9) % 9 || 9) - ((b.seat - after + 9) % 9 || 9),
  );
}
function finish(h: Hand) {
  // Uncalled excess is a refund, not a won pot or an achievement.
  const byContribution = [...h.players].sort((a, b) => b.total - a.total);
  const refund = byContribution[0].total - (byContribution[1]?.total ?? 0);
  if (refund > 0) {
    byContribution[0].total -= refund;
    byContribution[0].stack += refund;
    byContribution[0].bet = Math.max(0, byContribution[0].bet - refund);
  }

  const live = h.players.filter((p) => !p.folded);
  h.showdown = live.length > 1;
  h.done = true;
  h.actor = null;
  const levels = [...new Set(h.players.map((p) => p.total).filter(Boolean))].sort((a, b) => a - b);
  const boards = h.board2 ? [h.board, h.board2] : [h.board];
  let prev = 0;
  for (const level of levels) {
    const contributors = h.players.filter((p) => p.total >= level);
    const amount = (level - prev) * contributors.length;
    prev = level;
    let eligible = contributors.filter((p) => !p.folded);
    if (!eligible.length) eligible = contributors;
    // Em duas rodadas cada tabuleiro vale metade do pote; a ficha ímpar fica com o primeiro.
    boards.forEach((board, run) => {
      const share = Math.floor(amount / boards.length) + (run < amount % boards.length ? 1 : 0);
      let winners = eligible;
      if (eligible.length > 1) {
        let best: number[] = [];
        winners = [];
        for (const p of eligible) {
          const s = evaluate([...p.cards, ...board]);
          const c = compare(s, best);
          if (c > 0) {
            best = s;
            winners = [p];
          } else if (c === 0) winners.push(p);
        }
      }
      const order = clockwise(h, h.button).filter((p) => winners.some((w) => w.id === p.id));
      order.forEach((p, i) => {
        const prize = Math.floor(share / order.length) + (i < share % order.length ? 1 : 0);
        p.stack += prize;
        h.awards[p.id] = (h.awards[p.id] ?? 0) + prize;
      });
    });
  }
}
/** Completa um tabuleiro com queima antes de cada rua, sem mexer na mão. */
function runout(board: Card[], cards: Card[]) {
  const out = [...board];
  const rest = [...cards];
  while (out.length < 5) {
    rest.pop();
    for (let n = out.length === 0 ? 3 : 1; n > 0; n--) out.push(rest.pop()!);
  }
  return { board: out, rest };
}
function progress(h: Hand, after: number) {
  const live = h.players.filter((p) => !p.folded);
  if (live.length === 1) {
    finish(h);
    return;
  }
  const active = live.filter((p) => p.stack > 0);
  const needs = active.filter((p) => p.actedAt === null || p.bet < h.currentBet);
  if (needs.length && !(active.length === 1 && active[0].bet >= h.currentBet)) {
    h.actor = clockwise(h, after).find((p) => needs.includes(p))!.id;
    return;
  }
  if (h.street === 3) {
    finish(h);
    return;
  }
  // All-in sem mais apostas: se todos aceitaram, o pote é decidido em dois tabuleiros.
  if (active.length < 2 && h.twice.length && live.every((p) => h.twice.includes(p.id))) {
    const first = runout(h.board, h.deck);
    const second = runout(h.board, first.rest);
    h.board = first.board;
    h.board2 = second.board;
    h.deck = second.rest;
    h.street = 3;
    finish(h);
    return;
  }
  h.street++;
  h.deck.pop();
  h.board.push(...Array.from({ length: h.street === 1 ? 3 : 1 }, () => h.deck.pop()!));
  h.currentBet = 0;
  h.minRaise = h.bigBlind;
  for (const p of h.players) {
    p.bet = 0;
    p.actedAt = null;
  }
  if (active.length < 2) {
    progress(h, h.button);
    return;
  }
  h.actor = clockwise(h, h.button).find((p) => !p.folded && p.stack > 0)!.id;
}
export function startHand(
  seats: Seat[],
  button: number,
  smallBlind: number,
  bigBlind: number,
  ante = 0,
  cards = shuffle(),
  id = crypto.randomUUID(),
  options: { straddle?: boolean; twice?: string[] } = {},
): Hand {
  demand(seats.length >= 2 && seats.length <= 9, 'NEED_PLAYERS');
  demand(
    [smallBlind, bigBlind, ante].every(Number.isSafeInteger) &&
      smallBlind > 0 &&
      bigBlind >= smallBlind &&
      ante >= 0,
    'INVALID_STACK',
  );
  demand(
    new Set(seats.map((p) => p.id)).size === seats.length &&
      new Set(seats.map((p) => p.seat)).size === seats.length &&
      seats.every((p) => p.seat >= 0 && p.seat < 9) &&
      seats.some((p) => p.seat === button),
    'INVALID_ACTION',
  );
  demand(
    seats.every((s) => Number.isSafeInteger(s.stack) && s.stack > 0),
    'INVALID_STACK',
  );
  demand(
    new Set(cards).size === 52 && cards.length === 52 && cards.every((c) => deck().includes(c)),
    'INVALID_DECK',
  );
  const h: Hand = {
    id,
    players: seats.map((s) => ({
      ...s,
      cards: [],
      folded: false,
      bet: 0,
      total: 0,
      actedAt: null,
    })),
    deck: [...cards],
    board: [],
    button,
    bigBlind,
    currentBet: bigBlind,
    minRaise: bigBlind,
    street: 0,
    actor: null,
    done: false,
    showdown: false,
    awards: {},
    twice: [...(options.twice ?? [])],
    straddler: null,
    log: [],
  };
  const order = clockwise(h, button);
  for (let n = 0; n < 2; n++) for (const p of order) p.cards.push(h.deck.pop()!);
  for (const p of h.players) pay(p, ante, false);
  const sb = seats.length === 2 ? h.players.find((p) => p.seat === button)! : order[0];
  const bb = clockwise(h, sb.seat)[0];
  pay(sb, smallBlind);
  pay(bb, bigBlind);
  let last = bb;
  // Straddle: o under the gun posta o dobro do big blind e é o último a falar antes do flop.
  if (options.straddle && seats.length >= 3) {
    const straddler = clockwise(h, bb.seat)[0];
    pay(straddler, bigBlind * 2);
    h.straddler = straddler.id;
    h.currentBet = Math.max(bigBlind, straddler.bet);
    last = straddler;
  }
  progress(h, last.seat);
  return h;
}
export function legal(h: Hand, id: string) {
  const p = h.players.find((p) => p.id === id);
  if (h.done || h.actor !== id || !p) return { actions: [] as Action[], call: 0, min: 0, max: 0 };
  const call = Math.min(p.stack, h.currentBet - p.bet);
  const canRaise =
    (p.actedAt === null ||
      (p.actedAt === 0 && h.currentBet < h.bigBlind) ||
      h.currentBet - p.actedAt >= h.minRaise) &&
    h.players.some((o) => o.id !== id && !o.folded && o.stack > 0);
  const max = p.bet + p.stack;
  const actions: Action[] = ['FOLD', call ? 'CALL' : 'CHECK'];
  if (canRaise && max > h.currentBet) {
    actions.push('RAISE');
    if (h.currentBet === 0) actions.push('BET');
  }
  if (max <= h.currentBet || canRaise) actions.push('ALL_IN');
  return {
    actions,
    call,
    min: h.currentBet < h.bigBlind ? h.bigBlind : h.currentBet + h.minRaise,
    max,
  };
}
export function act(h: Hand, id: string, action: Action, amount?: number) {
  const options = legal(h, id);
  demand(options.actions.includes(action));
  const p = h.players.find((p) => p.id === id)!;
  if (action === 'FOLD') p.folded = true;
  else if (action === 'CALL') pay(p, options.call);
  else if (action === 'RAISE' || action === 'BET' || action === 'ALL_IN') {
    const target = action === 'ALL_IN' ? options.max : amount!;
    demand(Number.isSafeInteger(target) && target > p.bet && target <= options.max);
    if (target > h.currentBet) {
      demand(options.actions.includes('RAISE'));
      demand(target >= options.min || target === options.max, 'MIN_RAISE');
      const raise = target - h.currentBet;
      if (raise >= h.minRaise) h.minRaise = raise;
      h.currentBet = target;
    } else demand(action === 'ALL_IN');
    pay(p, target - p.bet);
  }
  p.actedAt = h.currentBet;
  h.log.push({ player: id, action, amount: p.bet, street: h.street });
  progress(h, p.seat);
}
export function publicHand(h: Hand, id?: string) {
  return {
    id: h.id,
    board: h.board,
    board2: h.board2,
    straddler: h.straddler,
    button: h.button,
    street: h.street,
    actor: h.actor,
    done: h.done,
    showdown: h.showdown,
    awards: h.awards,
    pot: h.players.reduce((s, p) => s + p.total, 0),
    currentBet: h.currentBet,
    players: h.players.map(({ cards, actedAt: _actedAt, ...p }) => ({
      ...p,
      cards: p.id === id || (h.done && h.showdown && !p.folded) ? cards : [],
    })),
    legal: legal(h, id ?? ''),
    log: h.log,
  };
}
