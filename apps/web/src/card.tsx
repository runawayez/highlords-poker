import React from 'react';

const suits: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function Suit({ suit }: { suit: string }) {
  if (suit === 'c')
    return (
      <g>
        <circle cx="50" cy="27" r="23" />
        <circle cx="27" cy="59" r="23" />
        <circle cx="73" cy="59" r="23" />
        <path d="M44 57h12v20q0 13 14 20H30q14-7 14-20Z" />
      </g>
    );
  const paths: Record<string, string> = {
    s: 'M50 4C39 22 6 37 6 60c0 24 29 30 41 11-2 12-6 20-14 25h34c-8-5-12-13-14-25 12 19 41 13 41-11C94 37 61 22 50 4Z',
    h: 'M50 94 13 56C-8 33 6 7 28 7c10 0 18 6 22 15C54 13 62 7 72 7c22 0 36 26 15 49Z',
    d: 'M50 3 94 50 50 97 6 50Z',
  };
  return <path d={paths[suit]} />;
}

export function Card({
  card,
  hidden = false,
  highlighted = false,
}: {
  card?: string;
  hidden?: boolean;
  highlighted?: boolean;
}) {
  const rank = card?.[0] === 'T' ? '10' : card?.[0];
  return (
    <div
      className={`playing-card ${highlighted ? 'best-card' : ''} ${hidden ? 'card-back' : !card ? 'card-empty' : ['h', 'd'].includes(card[1]) ? 'red-card' : ''}`}
      aria-label={hidden ? undefined : card ? `${rank} ${suits[card[1]]}` : undefined}
    >
      {hidden ? (
        <span>♠</span>
      ) : card ? (
        <svg className="card-face" viewBox="0 0 100 144" aria-hidden="true" focusable="false">
          <text
            x="9"
            y="34"
            fontFamily="Georgia, serif"
            fontSize="34"
            fontWeight="700"
            fill="currentColor"
          >
            {rank}
          </text>
          <g fill="currentColor" transform="translate(9 48) scale(.18)">
            <Suit suit={card[1]} />
          </g>
          <g fill="currentColor" transform="translate(27 72) scale(.46)">
            <Suit suit={card[1]} />
          </g>
        </svg>
      ) : (
        <span className="empty-suit">♠</span>
      )}
    </div>
  );
}
