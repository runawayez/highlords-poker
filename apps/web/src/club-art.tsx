import { Avatar } from './avatar.tsx';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './card.tsx';

export function Knight({ color = '#dc303d' }: { color?: string }) {
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
  const { t } = useTranslation();
  return (
    <div className="club-art" aria-hidden="true">
      <div className="art-topline">
        <span className="pulse-dot" /> {t('club:tablePreview')}
        <span>NLH / 06</span>
      </div>
      <div className="art-scene">
        <div className="mini-table">
          <div className="mini-mark">
            HIGHLORDS <span>POKER CLUB</span>
          </div>
          <div className="hero-hand">
            <Card card="As" />
            <Card card="Kh" />
            <Card card="Qs" />
            <Card card="Jh" />
            <Card card="Ts" />
          </div>
        </div>
        <div className="art-player art-player-top">
          <span>
            <Avatar profile={{ avatar: '♠' }} />
          </span>
          <div>
            HIGH LORD<small>5.000</small>
          </div>
        </div>
        <div className="art-player art-player-left">
          <span>
            <Avatar profile={{ avatar: '♣' }} />
          </span>
          <div>
            THE KNIGHT<small>4.750</small>
          </div>
        </div>
        <div className="art-player art-player-right">
          <span>
            <Avatar profile={{ avatar: '♥' }} />
          </span>
          <div>
            CRIMSON<small>6.250</small>
          </div>
        </div>
        <div className="art-own">
          <Card card="Ah" />
          <Card card="Ad" />
        </div>
        <div className="art-player art-player-self">
          <span>
            <Avatar profile={{ avatar: '♦' }} />
          </span>
          <div>
            HIGHLORD<small>5.000</small>
          </div>
          <b>YOU</b>
        </div>
      </div>
      <p className="art-caption">
        {t('club:previewNote')} <span>♠ ♥ ♣ ♦</span>
      </p>
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
            0{i + 1}
          </span>
          <div>
            <h3>{t(`club:${key}Title`)}</h3>
            <p>{t(`club:${key}Body`)}</p>
            {key === 'learn' && (
              <button className="text-button" onClick={onLearn}>
                {t('club:startHere')} →
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
