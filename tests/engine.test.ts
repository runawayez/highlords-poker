import { describe, it, expect } from 'vitest';
import {
  deck,
  shuffle,
  evaluate,
  compare,
  startHand,
  act,
  legal,
  publicHand,
} from '../packages/poker-engine/src/index.ts';
const seats = (stacks: number[]) =>
  stacks.map((stack, seat) => ({ id: String(seat), seat, stack }));
const h = (stacks = [1000, 1000, 1000]) => startHand(seats(stacks), 0, 5, 10);
describe('card evaluation', () => {
  it.each([
    ['As Ks Qs Js Ts 2c 3d', 8],
    ['Ac Ad Ah As Ks Qd 2c', 7],
    ['As Ah Ad Kc Kd Qh Qs', 6],
    ['As Js 9s 5s 3s Kd Qc', 5],
    ['As 2d 3h 4c 5s Kd Qd', 4],
    ['As Ad Ac 5d 6c 7h 9s', 3],
    ['Ac Ad Kc Kd Qs Qh Js', 2],
    ['Ac Ad Qh Js 9d 5c 2h', 1],
    ['As Kc Qd Jh 9s 4d 2c', 0],
  ])('ranks %s', (cards, rank) => expect(evaluate(cards.split(' '))[0]).toBe(rank));
  it('uses kickers, wheel and board ties', () => {
    expect(
      compare(
        evaluate('As Ad Kc Qd Js 2h 3d'.split(' ')),
        evaluate('Ah Ac Kd Qc Ts 2s 3h'.split(' ')),
      ),
    ).toBeGreaterThan(0);
    expect(evaluate('As 2d 3h 4c 5s'.split(' '))).toEqual([4, 5]);
    expect(
      compare(
        evaluate('As Ks Qs Js Ts 3d 2c'.split(' ')),
        evaluate('As Ks Qs Js Ts 4h 5d'.split(' ')),
      ),
    ).toBe(0);
  });
  it('shuffles a unique full deck', () => {
    expect(new Set(shuffle()).size).toBe(52);
    expect(shuffle()).not.toEqual(deck());
  });
});
describe('betting', () => {
  it('heads-up button posts small blind and acts first; BB acts first postflop', () => {
    const hand = h([100, 100]);
    expect(hand.actor).toBe('0');
    act(hand, '0', 'CALL');
    expect(hand.actor).toBe('1');
    act(hand, '1', 'CHECK');
    expect(hand.board).toHaveLength(3);
    expect(hand.actor).toBe('1');
  });
  it('rejects out of turn, under-raises and fractional chips', () => {
    const hand = h();
    expect(() => act(hand, '1', 'CALL')).toThrow();
    expect(() => act(hand, '0', 'RAISE', 15)).toThrow();
    expect(() => act(hand, '0', 'RAISE', 25.5)).toThrow();
  });
  it('does not reopen a short all-in but does reopen cumulative full increases', () => {
    const hand = h([1000, 25, 1000]);
    act(hand, '0', 'RAISE', 20);
    act(hand, '1', 'ALL_IN');
    act(hand, '2', 'CALL');
    expect(legal(hand, '0').actions).not.toContain('RAISE');
    expect(legal(hand, '0').actions).not.toContain('ALL_IN');
    act(hand, '0', 'CALL');
    expect(hand.street).toBe(1);
  });
  it('reopens after cumulative short all-ins', () => {
    const hand = h([1000, 25, 30, 1000]);
    expect(hand.actor).toBe('3');
    act(hand, '3', 'RAISE', 20);
    act(hand, '0', 'CALL');
    act(hand, '1', 'ALL_IN');
    act(hand, '2', 'ALL_IN');
    expect(legal(hand, '3').actions).toContain('RAISE');
    expect(legal(hand, '3').min).toBe(40);
  });
  it('keeps hole cards and deck private, including fold-win hands', () => {
    const hand = h([100, 100]);
    const view = publicHand(hand, '0');
    expect(view.players.find((p) => p.id === '1')!.cards).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('deck');
    act(hand, '0', 'FOLD');
    expect(publicHand(hand).players.every((p) => !p.cards.length)).toBe(true);
  });
  it('runs out all-in side pots and returns uncalled chips', () => {
    const hand = h([100, 300, 500]);
    while (!hand.done) {
      const options = legal(hand, hand.actor!);
      act(
        hand,
        hand.actor!,
        options.actions.includes('ALL_IN')
          ? 'ALL_IN'
          : options.actions.includes('CALL')
            ? 'CALL'
            : 'CHECK',
      );
    }
    expect(hand.board).toHaveLength(5);
    expect(hand.players.reduce((n, p) => n + p.stack, 0)).toBe(900);
    expect(Object.values(hand.awards).reduce((a, b) => a + b, 0)).toBe(
      hand.players.reduce((a, p) => a + p.total, 0),
    );
    expect(hand.players.find((p) => p.id === '2')!.stack).toBeGreaterThanOrEqual(200);
  });
  it('splits tied pots and awards odd chip left of dealer', () => {
    const hand = h([100, 100, 100]);
    hand.street = 3;
    hand.board = 'As Ks Qs Js Ts'.split(' ');
    hand.currentBet = 0;
    hand.actor = '0';
    hand.players.forEach((p, i) => {
      p.cards = [
        ['2c', '3c'],
        ['4c', '5c'],
        ['6c', '7c'],
      ][i];
      p.total = i === 2 ? 1 : 5;
      p.stack = 100 - p.total;
      p.bet = 0;
      p.actedAt = i === 0 ? null : 0;
      p.folded = i === 2;
    });
    act(hand, '0', 'CHECK');
    expect(hand.done).toBe(true);
    expect(hand.awards).toEqual({ '0': 5, '1': 6 });
    expect(hand.players.reduce((n, p) => n + p.stack, 0)).toBe(300);
  });
  it('refunds an unmatched overbet without recording it as a won pot', () => {
    const hand = h([1000, 1000]);
    act(hand, '0', 'ALL_IN');
    act(hand, '1', 'FOLD');
    expect(hand.awards['0']).toBe(20);
    expect(hand.players[0].stack).toBe(1010);
    expect(hand.players.reduce((sum, p) => sum + p.total, 0)).toBe(20);
  });
  it('allows a checked player to complete a short opening all-in to the big blind', () => {
    const hand = h([1000, 1000, 15]);
    act(hand, '0', 'CALL');
    act(hand, '1', 'CALL');
    act(hand, '2', 'CHECK');
    act(hand, '1', 'CHECK');
    act(hand, '2', 'ALL_IN');
    act(hand, '0', 'CALL');
    expect(legal(hand, '1').min).toBe(10);
    expect(legal(hand, '1').actions).toContain('RAISE');
    act(hand, '1', 'RAISE', 10);
    expect(legal(hand, '0').min).toBe(20);
  });
  it('conserves chips across 2000 randomized 2–9 player hands', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      let rand = seed;
      const random = (n: number) => {
        rand = (rand * 1664525 + 1013904223) >>> 0;
        return rand % n;
      };
      const stacks = Array.from({ length: 2 + random(8) }, () => 1 + random(1000));
      const hand = startHand(seats(stacks), 0, 5, 10, random(4), shuffle(deck(), random));
      let steps = 0;
      while (!hand.done) {
        expect(++steps).toBeLessThan(300);
        const o = legal(hand, hand.actor!);
        const selected = o.actions[random(o.actions.length)];
        act(
          hand,
          hand.actor!,
          selected,
          selected === 'RAISE' || selected === 'BET'
            ? Math.min(o.max, o.min + random(100))
            : undefined,
        );
        expect(hand.players.every((p) => Number.isInteger(p.stack) && p.stack >= 0)).toBe(true);
      }
      expect(hand.players.reduce((sum, p) => sum + p.stack, 0)).toBe(
        stacks.reduce((a, b) => a + b, 0),
      );
      expect(new Set([...hand.board, ...hand.players.flatMap((p) => p.cards)]).size).toBe(
        hand.board.length + stacks.length * 2,
      );
    }
  });
});
