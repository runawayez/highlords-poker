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

it('tournament overview retains an all-in player and includes committed chips in the average', async () => {
  const { PokerService } = await import('../packages/server/src/service.ts');
  const { ConfigSchema } = await import('../packages/contracts/src/index.ts');
  const { TournamentPresentation } = await import('../apps/web/src/learning.tsx');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createInstance } = await import('i18next');
  const { I18nextProvider } = await import('react-i18next');
  const { readFileSync } = await import('node:fs');
  const i18n = createInstance();
  await i18n.init({
    lng: 'en',
    resources: {
      en: {
        learn: JSON.parse(readFileSync('apps/web/src/i18n/locales/en/learn.json', 'utf8')),
        game: { average: 'Average', finalLevel: 'Final level' },
      },
    },
  });
  const service = new PokerService({
    async load() {
      return null;
    },
    async save() {},
  });
  await service.init();
  const a = await service.openSession({ nickname: 'First' }),
    b = await service.openSession({ nickname: 'Second' });
  const config = ConfigSchema.parse({
    title: 'All-in overview',
    mode: 'SIT_AND_GO',
    seats: 2,
    capacity: 2,
    stack: 1000,
    small: 500,
    big: 1000,
    rebuy: false,
    levels: [{ small: 500, big: 1000, ante: 0, minutes: 10, breakMinutes: 0 }],
  });
  const { roomId } = (await service.command(a.token, {
    id: crypto.randomUUID(),
    type: 'CREATE',
    payload: { config },
  })) as { roomId: string };
  await service.command(b.token, { id: crypto.randomUUID(), type: 'JOIN', roomId, payload: {} });
  await service.command(a.token, {
    id: crypto.randomUUID(),
    type: 'START',
    roomId,
    payload: {},
    version: (await service.snapshot(roomId, a.token)).version,
  });
  const snapshot = await service.snapshot(roomId, a.token);
  expect(snapshot.players.some((p) => p.stack === 0)).toBe(true);
  expect(snapshot.tables[0].hand!.done).toBe(false);
  const html = renderToStaticMarkup(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(TournamentPresentation, { snapshot, num: (n) => n.toLocaleString('en-US') }),
    ),
  );
  expect(html).toContain('2 / 2');
  expect(html).toContain('1,000');
});
