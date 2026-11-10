import React from 'react';
export function Card({
  card,
  hidden = false,
  highlighted = false,
}: {
  card?: string;
  hidden?: boolean;
  highlighted?: boolean;
}) {
  const suits: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const rank = card?.[0] === 'T' ? '10' : card?.[0];
  return (
    <div
      className={`playing-card ${highlighted ? 'best-card' : ''} ${hidden ? 'card-back' : !card ? 'card-empty' : ['h', 'd'].includes(card[1]) ? 'red-card' : ''}`}
      aria-label={hidden ? undefined : card ? `${rank} ${suits[card[1]]}` : undefined}
    >
      {hidden ? (
        <span>♠</span>
      ) : card ? (
        <>
          <b>
            {rank}
            <i>{suits[card[1]]}</i>
          </b>
          <span>{suits[card[1]]}</span>
          <b className="card-corner">{rank}</b>
        </>
      ) : (
        <span className="empty-suit">♠</span>
      )}
    </div>
  );
}
