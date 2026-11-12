import {
  compare,
  deck,
  evaluate,
  shuffle,
  type Card,
  type Action,
} from '../../poker-engine/src/index.ts';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type Style = 'BALANCED' | 'TIGHT' | 'LOOSE' | 'AGGRESSIVE';
/** Ajustes por estilo: tolerância para pagar, nível de equity para aumentar, chance de aumentar e de blefar. */
const STYLES: Record<Style, { call: number; raiseAt: number; raiseChance: number; bluff: number }> =
  {
    BALANCED: { call: 0, raiseAt: 0, raiseChance: 0.6, bluff: 0 },
    TIGHT: { call: -0.04, raiseAt: 0.05, raiseChance: 0.5, bluff: 0 },
    LOOSE: { call: 0.07, raiseAt: 0.05, raiseChance: 0.35, bluff: 0 },
    AGGRESSIVE: { call: 0.02, raiseAt: -0.12, raiseChance: 0.8, bluff: 0.12 },
  };
// This input deliberately excludes opponents' hole cards and the authoritative deck.
export type BotView = {
  cards: Card[];
  board: Card[];
  opponents: number;
  pot: number;
  bigBlind: number;
  legal: { actions: Action[]; call: number; min: number; max: number };
};
export function decide(
  view: BotView,
  difficulty: Difficulty,
  style: Style = 'BALANCED',
): { action: Action; amount?: number } {
  const tune = STYLES[style];
  const options = view.legal;
  if (!options.actions.length) throw new Error('Bot has no legal turn');
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  let equity = 0;
  // Limita o trabalho por decisão: cabe no orçamento de CPU do plano gratuito do Worker.
  const samples = Math.min(
    difficulty === 'HARD' ? 32 : difficulty === 'MEDIUM' ? 12 : 0,
    Math.floor(300 / (view.opponents + 1)),
  );
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
  if (options.call && equity + (difficulty === 'EASY' ? 0.2 : 0.03) + tune.call < price)
    return { action: 'FOLD' };
  const strong = equity > (difficulty === 'EASY' ? 0.85 : 0.65) + tune.raiseAt;
  const bluff = !options.call && equity > 0.25 && random < tune.bluff;
  if (options.actions.includes('RAISE') && ((strong && random < tune.raiseChance) || bluff)) {
    // Aposta entre meio pote e pote, nunca abaixo do mínimo legal.
    const target = options.call + Math.round(view.pot * (0.5 + random * 0.5));
    const bet = Math.min(options.max, Math.max(options.min, target, view.bigBlind * 2));
    return { action: 'RAISE', amount: bet };
  }
  return { action: options.actions.includes('CHECK') ? 'CHECK' : 'CALL' };
}
