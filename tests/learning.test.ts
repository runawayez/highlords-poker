import { it, expect } from 'vitest';
import { visibleHand, rankExamples } from '../apps/web/src/poker-learning.ts';
import { compare, evaluate } from '../packages/poker-engine/src/index.ts';
it('identifies the current hand without inventing future community cards', () => {
  expect(visibleHand(['As', 'Kh'], [])).toBeNull();
  expect(visibleHand(['As', 'Kh'], ['Ad', '7c'])).toBeNull();
  expect(visibleHand([], ['As', 'Ks', 'Qs', 'Js', 'Ts'])).toBeNull();
  expect(visibleHand(['As', 'Kh'], ['Ad', '7c', '2h'])?.category).toBe(1);
  const own = ['As', 'Kh'],
    board = ['Ad', '7c', '2h', 'Ks', '9d'];
  const result = visibleHand(own, board)!;
  expect(result.category).toBe(2);
  expect(new Set(result.bestFive)).toEqual(new Set(['As', 'Kh', 'Ad', 'Ks', '9d']));
  expect(own).toEqual(['As', 'Kh']);
  expect(board).toEqual(['Ad', '7c', '2h', 'Ks', '9d']);
});
it('can play the entire board and handles ace-low straights correctly', () => {
  const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
  expect(visibleHand(['2h', '3c'], board)).toEqual({ category: 9, bestFive: board });
  expect(visibleHand(['As', '2d'], ['3c', '4h', '5s', 'Kd', 'Qh'])?.category).toBe(4);
  expect(visibleHand(['Qs', 'Kd'], ['Ac', '2h', '3s', '4d', '9h'])?.category).toBe(0);
});
it('every teaching example matches its stated rank and strength order', () => {
  rankExamples.forEach((cards, index) => {
    const score = evaluate(cards);
    expect(score[0] === 8 && score[1] === 14 ? 9 : score[0]).toBe(index);
    if (index) expect(compare(score, evaluate(rankExamples[index - 1]))).toBeGreaterThan(0);
  });
});
