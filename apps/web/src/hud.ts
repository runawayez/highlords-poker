import type { RoomView } from './net.ts';

export type HudLine = { hands: number; vpip: number; pfr: number; aggression: number | null };

/**
 * Perfil de cada adversário nas últimas mãos da sala (o histórico guarda 15):
 * VPIP = % de mãos em que pagou ou apostou antes do flop; PFR = % em que aumentou antes do flop;
 * agressão = apostas e aumentos para cada pagamento depois do flop.
 */
export function computeHud(history: RoomView['history']): Record<string, HudLine> {
  const raw: Record<
    string,
    { hands: number; vpip: number; pfr: number; aggressive: number; calls: number }
  > = {};
  for (const hand of history) {
    if (!hand.players || !hand.log) continue;
    for (const player of hand.players) {
      const line = (raw[player.id] ??= { hands: 0, vpip: 0, pfr: 0, aggressive: 0, calls: 0 });
      line.hands++;
      const mine = hand.log.filter((entry) => entry.player === player.id);
      const pre = mine.filter((entry) => entry.street === 0);
      if (pre.some((e) => e.action !== 'FOLD' && e.action !== 'CHECK')) line.vpip++;
      if (pre.some((e) => e.action === 'RAISE' || e.action === 'BET' || e.action === 'ALL_IN'))
        line.pfr++;
      for (const entry of mine.filter((e) => e.street > 0)) {
        if (entry.action === 'RAISE' || entry.action === 'BET' || entry.action === 'ALL_IN')
          line.aggressive++;
        else if (entry.action === 'CALL') line.calls++;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(raw).map(([id, line]) => [
      id,
      {
        hands: line.hands,
        vpip: Math.round((100 * line.vpip) / line.hands),
        pfr: Math.round((100 * line.pfr) / line.hands),
        aggression: line.calls ? Math.round((10 * line.aggressive) / line.calls) / 10 : null,
      },
    ]),
  );
}
