import React from 'react';

const suitNames: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const paths: Record<string, string> = {
  s: 'M50 4C39 22 6 37 6 60c0 24 29 30 41 11-2 12-6 20-14 25h34c-8-5-12-13-14-25 12 19 41 13 41-11C94 37 61 22 50 4Z',
  h: 'M50 94 13 56C-8 33 6 7 28 7c10 0 18 6 22 15C54 13 62 7 72 7c22 0 36 26 15 49Z',
  d: 'M50 3 94 50 50 97 6 50Z',
};
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
  return <path d={paths[suit]} />;
}

export function cardLabel(card: string) {
  return `${card[0] === 'T' ? '10' : card[0]}${suitNames[card[1]]}`;
}

/**
 * Carta com um único lado visível: a frente quando `card` é conhecida, senão o verso
 * (cartas dos adversários). Nunca há duas camadas sobrepostas.
 */
export function Card({
  card,
  down = false,
  glow = false,
  dim = false,
  className = '',
  style,
}: {
  card?: string;
  down?: boolean;
  glow?: boolean;
  dim?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const faceDown = down || !card;
  const rank = card ? (card[0] === 'T' ? '10' : card[0]) : '';
  return (
    <div
      className={`card ${faceDown ? 'is-down' : ''} ${glow ? 'is-glow' : ''} ${dim ? 'is-dim' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={faceDown || !card ? undefined : cardLabel(card)}
    >
      {faceDown || !card ? (
        <div className="card-face card-back" aria-hidden="true">
          <span>♠</span>
        </div>
      ) : (
        <div className={`card-face card-front ${'hd'.includes(card[1]) ? 'red' : ''}`}>
          <svg viewBox="0 0 100 140" aria-hidden="true" focusable="false">
            <text x="10" y="30" className="card-rank" textAnchor="start">
              {rank}
            </text>
            <g fill="currentColor" transform="translate(10 38) scale(.19)">
              <Suit suit={card[1]} />
            </g>
            <g fill="currentColor" transform="translate(26 58) scale(.48)">
              <Suit suit={card[1]} />
            </g>
            <g transform="rotate(180 50 70)">
              <text x="10" y="30" className="card-rank" textAnchor="start">
                {rank}
              </text>
              <g fill="currentColor" transform="translate(10 38) scale(.19)">
                <Suit suit={card[1]} />
              </g>
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
