import { describe, it, expect } from 'vitest';
import { act, deck, legal, publicHand, startHand } from '../packages/poker-engine/src/index.ts';

const seat = (id: string, n: number, stack = 1000) => ({ id, seat: n, stack });

describe('straddle', () => {
  it('o under the gun posta o dobro do big blind e fala por último antes do flop', () => {
    const h = startHand(
      [seat('a', 0), seat('b', 1), seat('c', 2), seat('d', 3)],
      0,
      5,
      10,
      0,
      undefined,
      undefined,
      { straddle: true },
    );
    // Botão em 0: SB é 1, BB é 2, straddle é 3 e quem abre a ação é o botão.
    expect(h.straddler).toBe('d');
    expect(h.currentBet).toBe(20);
    expect(h.players.find((p) => p.id === 'd')!.bet).toBe(20);
    expect(h.actor).toBe('a');
    act(h, 'a', 'CALL');
    act(h, 'b', 'CALL');
    act(h, 'c', 'CALL');
    // O straddler ainda tem a opção de aumentar depois que todos pagaram.
    expect(h.actor).toBe('d');
    expect(legal(h, 'd').actions).toContain('RAISE');
    expect(legal(h, 'd').min).toBe(30);
    act(h, 'd', 'CHECK');
    expect(h.street).toBe(1);
  });

  it('não há straddle com menos de 3 jogadores', () => {
    const h = startHand([seat('a', 0), seat('b', 1)], 0, 5, 10, 0, undefined, undefined, {
      straddle: true,
    });
    expect(h.straddler).toBeNull();
    expect(h.currentBet).toBe(10);
  });

  it('straddle curto vira all-in sem estragar o pote', () => {
    const h = startHand(
      [seat('a', 0), seat('b', 1), seat('c', 2), seat('d', 3, 15)],
      0,
      5,
      10,
      0,
      undefined,
      undefined,
      { straddle: true },
    );
    expect(h.currentBet).toBe(15);
    expect(h.players.find((p) => p.id === 'd')!.stack).toBe(0);
  });
});

describe('run it twice', () => {
  /** Monta um baralho em que as cartas saem na ordem dada (o motor tira do fim). */
  const stacked = (popOrder: string[]) => {
    const rest = deck().filter((c) => !popOrder.includes(c));
    return [...rest, ...[...popOrder].reverse()];
  };

  it('divide o pote entre os dois tabuleiros quando todos aceitam', () => {
    const cards = stacked([
      // Cartas fechadas: B (seat 1) recebe primeiro, depois A (botão).
      'Kc',
      'As',
      'Ks',
      'Ah',
      // Primeiro tabuleiro: queima, flop, queima, turn, queima, river.
      '2d',
      '7c',
      '8d',
      '9h',
      '3h',
      '2s',
      '4s',
      '3c',
      // Segundo tabuleiro.
      '5h',
      'Kh',
      'Kd',
      '4c',
      '6d',
      '5d',
      '7s',
      '6s',
    ]);
    const h = startHand(
      [seat('a', 0, 100), seat('b', 1, 100)],
      0,
      5,
      10,
      0,
      cards,
      '00000000-0000-4000-8000-000000000001',
      {
        twice: ['a', 'b'],
      },
    );
    act(h, 'a', 'ALL_IN');
    act(h, 'b', 'CALL');
    expect(h.done).toBe(true);
    expect(h.board).toEqual(['7c', '8d', '9h', '2s', '3c']);
    expect(h.board2).toEqual(['Kh', 'Kd', '4c', '5d', '6s']);
    // A ganha o primeiro (ases) e B o segundo (quadra de reis): cada um leva a metade.
    expect(h.awards).toEqual({ a: 100, b: 100 });
    expect(h.players.map((p) => p.stack)).toEqual([100, 100]);
    expect(publicHand(h).board2).toHaveLength(5);
  });

  it('com um só aceitando, o pote é decidido em um tabuleiro', () => {
    const h = startHand(
      [seat('a', 0, 100), seat('b', 1, 100)],
      0,
      5,
      10,
      0,
      undefined,
      '00000000-0000-4000-8000-000000000002',
      {
        twice: ['a'],
      },
    );
    act(h, 'a', 'ALL_IN');
    act(h, 'b', 'CALL');
    expect(h.done).toBe(true);
    expect(h.board2).toBeUndefined();
    expect(h.board).toHaveLength(5);
  });

  it('ficha ímpar fica com o primeiro tabuleiro e nada se perde', () => {
    for (let n = 0; n < 200; n++) {
      const h = startHand(
        [seat('a', 0, 51), seat('b', 1, 51), seat('c', 2, 51)],
        0,
        1,
        2,
        0,
        undefined,
        undefined,
        { twice: ['a', 'b', 'c'] },
      );
      for (const id of ['a', 'b', 'c']) if (!h.done && h.actor === id) act(h, id, 'ALL_IN');
      while (!h.done) act(h, h.actor!, 'ALL_IN');
      const paid = Object.values(h.awards).reduce((x, y) => x + y, 0);
      expect(paid).toBe(153);
      expect(h.players.reduce((sum, p) => sum + p.stack, 0)).toBe(153);
    }
  });
});
