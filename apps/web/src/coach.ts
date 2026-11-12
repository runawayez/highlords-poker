import { compare, deck, evaluate, shuffle } from '../../../packages/poker-engine/src/index.ts';

/**
 * Ajudas didáticas calculadas só no navegador, com as cartas do próprio jogador e a mesa:
 * chance de vitória (Monte Carlo), outs e preço do pote. Nada disso sai do cliente.
 */

/** Chance aproximada de ganhar contra `opponents` mãos aleatórias (empate conta pela fração). */
export function estimateEquity(hole: string[], board: string[], opponents: number, samples = 260) {
  if (hole.length !== 2 || opponents < 1) return null;
  const known = new Set([...hole, ...board]);
  const unknown = deck().filter((card) => !known.has(card));
  let score = 0;
  for (let trial = 0; trial < samples; trial++) {
    const remaining = shuffle(unknown);
    const fullBoard = [...board];
    while (fullBoard.length < 5) fullBoard.push(remaining.pop()!);
    const own = evaluate([...hole, ...fullBoard]);
    let ties = 1;
    let beaten = false;
    for (let opponent = 0; opponent < opponents && !beaten; opponent++) {
      const other = evaluate([remaining.pop()!, remaining.pop()!, ...fullBoard]);
      const result = compare(other, own);
      if (result > 0) beaten = true;
      else if (result === 0) ties++;
    }
    if (!beaten) score += 1 / ties;
  }
  return score / samples;
}

/** Cartas que, na próxima rua, melhoram a categoria da sua mão (só no flop e no turn). */
export function countOuts(hole: string[], board: string[]) {
  if (hole.length !== 2 || board.length < 3 || board.length > 4) return null;
  const known = new Set([...hole, ...board]);
  const current = evaluate([...hole, ...board])[0];
  let outs = 0;
  for (const card of deck()) {
    if (known.has(card)) continue;
    if (evaluate([...hole, ...board, card])[0] > current) outs++;
  }
  return outs;
}

/** Quanto do pote final você paga para continuar (0 a 1). */
export const potOdds = (toCall: number, pot: number) => (toCall > 0 ? toCall / (pot + toCall) : 0);

export type Advice = 'valueBet' | 'freeCheck' | 'callWorth' | 'callMarginal' | 'fold';

/** Sugestão simples: compara a chance de vitória com o preço que o pote cobra. */
export function adviseAction(equity: number, toCall: number, pot: number): Advice {
  if (toCall === 0) return equity >= 0.62 ? 'valueBet' : 'freeCheck';
  const price = potOdds(toCall, pot);
  if (equity >= price + 0.08) return 'callWorth';
  if (equity >= price - 0.02) return 'callMarginal';
  return 'fold';
}
