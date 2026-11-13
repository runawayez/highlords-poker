import { useEffect, useRef, useState } from 'react';
import type { RoomView } from './net.ts';
import { playSound } from './audio.ts';

export type Sweep = { id: string; amount: number; key: number };

/**
 * Transforma mudanças entre dois estados da sala em efeitos: sons, rótulos da última
 * ação de cada jogador, fichas indo para o pote e emotes flutuantes.
 */
export function useTableFx(state: RoomView | null) {
  const previous = useRef<RoomView | null>(null);
  const [sweeps, setSweeps] = useState<Sweep[]>([]);
  const [emotes, setEmotes] = useState<{ n: number; id: string; emote: string }[]>([]);
  const sweepKey = useRef(0);

  useEffect(() => {
    if (!state) return;
    const before = previous.current;
    previous.current = state;
    if (!before) return;
    const hand = state.hand;
    const was = before.hand;

    // Nova mão: distribuir cartas.
    if (hand && hand.id !== was?.id) {
      setSweeps([]);
      const seated = state.players.filter((p) => p.inHand).length;
      for (let i = 0; i < seated * 2; i++) playSound('deal', 0.32 + i * 0.11);
    }

    if (hand && was && hand.id === was.id) {
      const fresh = Math.min(hand.logCount - was.logCount, hand.log.length);
      if (fresh > 0) {
        const entries = hand.log.slice(-fresh);
        const last = entries[entries.length - 1];
        playSound(
          last.action === 'FOLD'
            ? 'fold'
            : last.action === 'CHECK'
              ? 'check'
              : last.action === 'CALL'
                ? 'chip'
                : 'chips',
        );
      }
      // Rua nova: as apostas voam para o pote e as cartas viram.
      if (hand.board.length > was.board.length) {
        const gathered = before.players
          .filter((p) => p.bet > 0)
          .map((p) => ({ id: p.id, amount: p.bet, key: ++sweepKey.current }));
        setSweeps(gathered);
        const count = hand.board.length - was.board.length;
        for (let i = 0; i < count; i++) playSound('flip', 0.3 + i * 0.13);
        setTimeout(() => setSweeps([]), 900);
      }
      if (hand.done && !was.done) {
        const mine = hand.awards[state.me] ?? 0;
        const gathered = before.players
          .filter((p) => p.bet > 0)
          .map((p) => ({ id: p.id, amount: p.bet, key: ++sweepKey.current }));
        setSweeps(gathered);
        setTimeout(() => setSweeps([]), 900);
        if (mine > 0) playSound('win', 0.4);
        else if (state.players.some((p) => p.id === state.me && p.inHand && !p.folded))
          playSound('lose', 0.4);
        else playSound('chips', 0.3);
      }
    }

    // Minha vez.
    if (hand && !hand.done && hand.actor === state.me && was?.actor !== state.me) {
      playSound('turn');
      navigator.vibrate?.(70);
    }

    if (state.players.length > before.players.length) playSound('join');

    const lastChat = state.chat[state.chat.length - 1];
    if (
      lastChat?.text &&
      lastChat.id !== before.chat[before.chat.length - 1]?.id &&
      lastChat.from !== state.me
    )
      playSound('message');

    const lastSeen = before.emotes[before.emotes.length - 1]?.n ?? 0;
    const fresh = state.emotes.filter((e) => e.n > lastSeen);
    if (fresh.length) {
      setEmotes((current) => [...current, ...fresh].slice(-8));
      setTimeout(
        () => setEmotes((current) => current.filter((e) => !fresh.some((f) => f.n === e.n))),
        2600,
      );
    }
  }, [state]);

  return { sweeps, emotes };
}

/** Segundos restantes até `deadline`, atualizados a cada 250 ms. */
export function useCountdown(deadline: number | undefined, serverNow: () => number) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!deadline) return;
    setNow(serverNow());
    const timer = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(timer);
  }, [deadline, serverNow]);
  return deadline ? Math.max(0, deadline - now) : 0;
}
