import { useTranslation } from 'react-i18next';
import { Card } from './card.tsx';
import type { RoomView } from './net.ts';
import { Modal } from './panels.tsx';
import { useNumber } from './table.tsx';

type Entry = RoomView['history'][number];
const STREAMS = [0, 1, 2, 3] as const;

/** Rever uma mão já terminada: mesa, cartas mostradas e as ações rua por rua. */
export function ReplayModal({
  hand,
  me,
  onClose,
}: {
  hand: Entry;
  me: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useNumber();
  const names = Object.fromEntries((hand.players ?? []).map((p) => [p.id, p.nickname]));
  const nameOf = (id: string) => (id === me ? t('game:you') : (names[id] ?? '?'));
  const log = hand.log ?? [];
  const winners = new Set(hand.winners.map((w) => w.id));

  return (
    <Modal title={t('game:replayTitle', { n: hand.no })} wide onClose={onClose}>
      <div className="replay">
        <div className="replay-board" aria-label={t('game:board')}>
          {hand.board.length ? (
            hand.board.map((card) => <Card key={card} card={card} className="mini" />)
          ) : (
            <p className="empty-note">{t('game:replayNoBoard')}</p>
          )}
          <span className="replay-pot">
            {t('game:pot')} {format(hand.pot)}
          </span>
        </div>

        {hand.players && (
          <ul className="replay-players">
            {hand.players.map((p) => (
              <li key={p.id} className={winners.has(p.id) ? 'won' : p.folded ? 'folded' : ''}>
                <b>{nameOf(p.id)}</b>
                <span className="replay-cards">
                  {p.cards.length ? (
                    p.cards.map((card) => <Card key={card} card={card} className="mini" />)
                  ) : (
                    <em>{p.folded ? t('game:folded') : t('game:mucked')}</em>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {log.length === 0 ? (
          <p className="empty-note">{t('game:replayNoLog')}</p>
        ) : (
          STREAMS.map((street) => {
            const entries = log.filter((entry) => entry.street === street);
            if (!entries.length) return null;
            return (
              <section key={street} className="replay-street">
                <h4>{t(`game:street${street}`)}</h4>
                <ol>
                  {entries.map((entry, i) => (
                    <li key={i}>
                      <b>{nameOf(entry.player)}</b>{' '}
                      {t(`game:replay_${entry.action}`, { amount: format(entry.amount) })}
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        )}

        {hand.winners.map((w) => (
          <p key={w.id} className="replay-result">
            {t('game:won', { name: nameOf(w.id), amount: format(w.amount) })}
            {w.category !== undefined && (
              <em> {t('game:wonWith', { hand: t(`learn:rank${w.category}`).toLowerCase() })}</em>
            )}
          </p>
        ))}
      </div>
    </Modal>
  );
}
