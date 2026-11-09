import type { Config } from '../../contracts/src/index.ts';
/** All transfers occur only at a global hand barrier, in one persisted transaction. */
export function balance(ids: string[], seats: number): string[][] {
  if (!ids.length) return [];
  const count = Math.ceil(ids.length / seats);
  const tables = Array.from({ length: count }, () => [] as string[]);
  ids.forEach((id, i) => tables[i % count].push(id));
  return tables;
}
export function levelAt(config: Config, elapsed: number) {
  let end = 0;
  for (let i = 0; i < config.levels.length; i++) {
    const l = config.levels[i];
    end += l.minutes * 60000;
    if (elapsed < end) return { index: i, ...l, break: false, remaining: end - elapsed };
    end += l.breakMinutes * 60000;
    if (elapsed < end) return { index: i, ...l, break: true, remaining: end - elapsed };
  }
  const i = config.levels.length - 1;
  return { index: i, ...config.levels[i], break: false, remaining: 0 };
}
export function prizes(pool: number, ids: string[]): Record<string, number> {
  const weights = ids.length >= 3 ? [0.5, 0.3, 0.2] : ids.length === 2 ? [0.7, 0.3] : [1];
  const out: Record<string, number> = {};
  let left = pool;
  weights.forEach((w, i) => {
    out[ids[i]] = i === weights.length - 1 ? left : Math.floor(pool * w);
    left -= out[ids[i]];
  });
  return out;
}
