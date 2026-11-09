import {
  compare,
  deck,
  evaluate,
  shuffle,
  type Card,
  type Action,
} from '../../poker-engine/src/index.ts';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
// This input deliberately excludes opponents' hole cards and the authoritative deck.
export type BotView = {
  cards: Card[];
  board: Card[];
  opponents: number;
  pot: number;
  bigBlind: number;
  legal: { actions: Action[]; call: number; min: number; max: number };
};
export function decide(view: BotView, difficulty: Difficulty): { action: Action; amount?: number } {
  const options = view.legal;
  if (!options.actions.length) throw new Error('Bot has no legal turn');
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  let equity = 0;
  const samples = difficulty === 'HARD' ? 32 : difficulty === 'MEDIUM' ? 12 : 0;
  const unknown = deck().filter((card) => !view.cards.includes(card) && !view.board.includes(card));
  for (let trial = 0; trial < samples; trial++) {
    const remaining = shuffle(unknown);
    const board = [...view.board];
    while (board.length < 5) board.push(remaining.pop()!);
    const own = evaluate([...view.cards, ...board]);
    let ties = 1;
    let beaten = false;
    for (let opponent = 0; opponent < view.opponents; opponent++) {
      const score = evaluate([remaining.pop()!, remaining.pop()!, ...board]);
      const result = compare(score, own);
      if (result > 0) beaten = true;
      if (result === 0) ties++;
    }
    if (!beaten) equity += 1 / ties;
  }
  equity = samples ? equity / samples : 0.25 + random * 0.5;
  const price = options.call / Math.max(1, view.pot + options.call);
  if (options.call && equity + (difficulty === 'EASY' ? 0.2 : 0.03) < price)
    return { action: 'FOLD' };
  if (
    options.actions.includes('RAISE') &&
    equity > (difficulty === 'EASY' ? 0.85 : 0.65) &&
    random < 0.6
  ) {
    const bet = Math.min(options.max, Math.max(options.min, view.bigBlind * 3));
    return { action: 'RAISE', amount: bet };
  }
  return { action: options.actions.includes('CHECK') ? 'CHECK' : 'CALL' };
}
