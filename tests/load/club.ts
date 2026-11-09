import { performance } from 'node:perf_hooks';
import { startHand, act, legal, publicHand } from '../../packages/poker-engine/src/index.ts';
const times: number[] = [];
let snapshots = 0;
const begin = performance.now();
for (let i = 0; i < 1000; i++) {
  const t = performance.now();
  const h = startHand(
    Array.from({ length: 9 }, (_, seat) => ({ id: String(seat), seat, stack: 1000 })),
    i % 9,
    5,
    10,
  );
  while (!h.done) {
    const opts = legal(h, h.actor!);
    act(
      h,
      h.actor!,
      opts.actions.includes('ALL_IN') ? 'ALL_IN' : opts.actions.includes('CALL') ? 'CALL' : 'CHECK',
    );
    for (const p of h.players) {
      publicHand(h, p.id);
      snapshots++;
    }
  }
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    hands: 1000,
    privateSnapshots: snapshots,
    elapsedMs: Math.round(performance.now() - begin),
    handP50ms: times[500],
    handP95ms: times[950],
    scope: 'local rules/projection benchmark; not production capacity',
  }),
);
