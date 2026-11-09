import { it, expect } from 'vitest';
import { decide, type Difficulty } from '../packages/poker-bot/src/index.ts';
import { startHand, legal, act } from '../packages/poker-engine/src/index.ts';

it.each(['EASY', 'MEDIUM', 'HARD'] as Difficulty[])(
  '%s bots finish hands legally and conserve chips',
  (difficulty) => {
    for (let trial = 0; trial < 25; trial++) {
      const hand = startHand(
        Array.from({ length: 4 }, (_, seat) => ({
          id: String(seat),
          seat,
          stack: 200 + seat * 50,
        })),
        0,
        5,
        10,
      );
      let steps = 0;
      while (!hand.done) {
        expect(++steps).toBeLessThan(200);
        const own = hand.players.find((p) => p.id === hand.actor)!;
        const choice = decide(
          {
            cards: own.cards,
            board: hand.board,
            opponents: hand.players.filter((p) => !p.folded && p.id !== own.id).length,
            pot: hand.players.reduce((n, p) => n + p.total, 0),
            bigBlind: 10,
            legal: legal(hand, own.id),
          },
          difficulty,
        );
        expect(() => act(hand, own.id, choice.action, choice.amount)).not.toThrow();
      }
      expect(hand.players.reduce((n, p) => n + p.stack, 0)).toBe(1100);
    }
  },
);
