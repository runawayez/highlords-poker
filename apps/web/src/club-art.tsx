import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './card.tsx';

export function Knight({ color = '#c3ac7e' }: { color?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#20272b" />
      <path d="M11 100q2-25 27-28h24q25 3 27 28" fill="#171e22" stroke={color} strokeWidth="2" />
      <path d="M50 13 25 29l3 38 22 17 22-17 3-38Z" fill={color} />
      <path d="M50 13v71L28 67l-3-38Z" fill="#171e2580" />
      <path d="m25 39 23 8 27-8-5 16-20 6-20-6Z" fill="#10171a" />
      <path d="m32 46 13 4m10 0 13-4" stroke={color} strokeWidth="2" />
      <path d="M50 43v33m-13-9 9 3m8 0 9-3" stroke="#172024" strokeWidth="3" />
      <path d="m45 16 5-10 5 10" fill={color} />
    </svg>
  );
}

export function ClubArtwork() {
  return (
    <div className="club-art" aria-hidden="true">
      <div className="mini-table">
        <div className="hero-hand">
          <Card card="As" />
          <Card card="Kh" />
          <Card card="Qc" />
        </div>
        <span className="mini-mark">HIGHLORDS ♠</span>
      </div>
    </div>
  );
}

export function ClubFeatures({ onLearn }: { onLearn: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="club-features">
      {['rules', 'champion', 'learn'].map((key, i) => (
        <div key={key}>
          <span className="feature-icon" aria-hidden>
            {['⌑', '♛', '♧'][i]}
          </span>
          <h3>{t(`club:${key}Title`)}</h3>
          <p>
            {t(`club:${key}Body`)}{' '}
            {key === 'learn' && <button onClick={onLearn}>{t('club:startHere')} →</button>}
          </p>
        </div>
      ))}
    </section>
  );
}
