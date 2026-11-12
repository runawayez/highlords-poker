import { describe, it, expect } from 'vitest';
import {
  act,
  legal,
  publicHand,
  startHand,
  shuffle,
  type Action,
  type Hand,
} from '../packages/poker-engine/src/index.ts';

/** PRNG determinístico (mulberry32) para reproduzir falhas pelo número da semente. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playRandomHand(seed: number) {
  const random = rng(seed);
  const count = 2 + Math.floor(random() * 8);
  const seatNumbers = [...Array(9).keys()].sort(() => random() - 0.5).slice(0, count);
  const seats = seatNumbers.map((seat, i) => ({
    id: 'p' + i,
    seat,
    stack: 1 + Math.floor(random() * (random() < 0.3 ? 40 : 600)),
  }));
  const before = seats.reduce((sum, s) => sum + s.stack, 0);
  const big = 1 + Math.floor(random() * 20);
  const small = Math.max(1, Math.floor(big / 2));
  const cards = shuffle(undefined, (n) => Math.floor(random() * n));
  const hand: Hand = startHand(seats, seatNumbers[0], small, big, random() < 0.2 ? 1 : 0, cards);
  let steps = 0;
  while (!hand.done) {
    expect(steps++, `seed ${seed} não terminou`).toBeLessThan(200);
    const id = hand.actor!;
    expect(id, `seed ${seed}: mão sem ator`).toBeTruthy();
    const options = legal(hand, id);
    expect(options.actions.length, `seed ${seed}: ator sem ação`).toBeGreaterThan(0);
    const action = options.actions[Math.floor(random() * options.actions.length)] as Action;
    let amount: number | undefined;
    if (action === 'RAISE' || action === 'BET') {
      const lo = Math.min(options.min, options.max);
      const span = options.max - lo;
      amount = lo + Math.floor(random() * (span + 1));
      if (random() < 0.15) amount = options.max;
    }
    act(hand, id, action, amount);
    // O baralho e as cartas alheias nunca aparecem na visão pública antes do showdown.
    if (!hand.done) {
      const view = publicHand(hand, 'p0');
      expect(JSON.stringify(view)).not.toContain('"deck"');
      for (const p of view.players) if (p.id !== 'p0') expect(p.cards).toEqual([]);
    }
  }
  const after = hand.players.reduce((sum, p) => sum + p.stack, 0);
  expect(after, `seed ${seed}: fichas não conservadas`).toBe(before);
  const awarded = Object.values(hand.awards).reduce((a, b) => a + b, 0);
  const contributed = hand.players.reduce((sum, p) => sum + p.total, 0);
  expect(awarded, `seed ${seed}: prêmios != pote`).toBe(contributed);
  for (const p of hand.players) expect(p.stack).toBeGreaterThanOrEqual(0);
  return hand;
}

describe('fuzz do motor', () => {
  it('conserva fichas, termina e fecha o pote em 3000 mãos aleatórias', () => {
    for (let seed = 1; seed <= 3000; seed++) playRandomHand(seed);
  });
  it('divide pot em empate com ficha ímpar para o primeiro à esquerda do botão', () => {
    const hand = startHand(
      [
        { id: 'a', seat: 0, stack: 100 },
        { id: 'b', seat: 1, stack: 100 },
        { id: 'c', seat: 2, stack: 100 },
      ],
      0,
      1,
      2,
      0,
      // Todos jogam o board (royal flush): empate triplo, pote de 301 não divisível por 3... usa 100 cada.
      boardTie(),
    );
    while (!hand.done) act(hand, hand.actor!, 'ALL_IN');
    const total = Object.values(hand.awards).reduce((a, b) => a + b, 0);
    expect(total).toBe(300);
  });
});

/** Baralho em que o board é um royal flush de espadas: todos empatam. */
function boardTie() {
  const royal = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
  const others = shuffle().filter((c) => !royal.includes(c));
  const privateCards = others.filter((c) => c[1] !== 's').slice(0, 6);
  const burns = others.filter((c) => c[1] !== 's' && !privateCards.includes(c)).slice(0, 3);
  const used = new Set([...royal, ...privateCards, ...burns]);
  const rest = shuffle().filter((c) => !used.has(c));
  // Ordem de saque (pop do fim): 6 privadas, queima, K Q J, queima, T, queima, A.
  const sequence = [...privateCards, burns[0], 'Ks', 'Qs', 'Js', burns[1], 'Ts', burns[2], 'As'];
  return [...rest, ...sequence.reverse()];
}
