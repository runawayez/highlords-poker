import { evaluate, compare } from '../../../packages/poker-engine/src/index.ts';
// Only the viewer's own cards and the public board may enter this helper.
export function visibleHand(own: string[], board: string[]) {
  if (own.length !== 2 || board.length < 3 || board.length > 5) return null;
  const cards = [...own, ...board];
  let best: number[] = [];
  let bestFive: string[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const five = [cards[a], cards[b], cards[c], cards[d], cards[e]],
              score = evaluate(five);
            if (compare(score, best) > 0) {
              best = score;
              bestFive = five;
            }
          }
  return { category: best[0] === 8 && best[1] === 14 ? 9 : best[0], bestFive };
}
export const rankExamples = [
  ['As', 'Kd', '9h', '6c', '3d'],
  ['As', 'Ad', 'Kh', '9c', '3d'],
  ['As', 'Ad', 'Kh', 'Kc', '3d'],
  ['As', 'Ad', 'Ah', 'Kc', '3d'],
  ['9s', '8d', '7h', '6c', '5d'],
  ['As', 'Js', '9s', '6s', '3s'],
  ['As', 'Ad', 'Ah', 'Kc', 'Kd'],
  ['As', 'Ad', 'Ah', 'Ac', 'Kd'],
  ['9s', '8s', '7s', '6s', '5s'],
  ['As', 'Ks', 'Qs', 'Js', 'Ts'],
];
