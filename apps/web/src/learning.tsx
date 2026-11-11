import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './room-tools.tsx';
import { rankExamples, visibleHand } from './poker-learning.ts';
import type { Snapshot } from './api.ts';
export type LearningKind = 'guide' | 'hands' | 'help';
export type LearningSection = LearningKind | 'rules';
const sections: LearningSection[] = ['guide', 'hands', 'rules', 'help'];
export const learningPaths: Record<LearningSection, string> = {
  guide: '/como-jogar',
  hands: '/ranking-de-maos',
  help: '/ajuda',
  rules: '/regras-da-casa',
};
export function learningRoute(): LearningSection | 'play' {
  return (
    (Object.entries(learningPaths).find(
      ([, path]) => path === location.pathname.replace(/\/$/, ''),
    )?.[0] as LearningSection) ?? 'play'
  );
}
export function LearningPage({
  kind,
  onPlay,
  onSection,
  embedded = false,
}: {
  kind: LearningKind;
  onPlay?: () => void;
  onSection?: (kind: LearningKind) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const Title = embedded ? 'h2' : 'h1';
  const cards = [
    ['As', 'Kh'],
    ['As', 'Kh'],
    ['As', 'Kh', 'Ad', '7c', '2h'],
    ['As', 'Kh', 'Ad', '7c', '2h', 'Ks'],
    ['As', 'Kh', 'Ad', '7c', '2h', 'Ks', '9d'],
    ['As', 'Kh', 'Ad', '7c', '2h', 'Ks', '9d'],
  ];
  return (
    <article className={`learning-page learning-${kind}`}>
      <header className="learning-heading">
        {!embedded && <p className="eyebrow">HIGHLORDS / {t('learn:academy')}</p>}
        <Title className="learning-title">{t(`learn:${kind}Title`)}</Title>
        <p>{t(`learn:${kind}Intro`)}</p>
        {!embedded && onSection && (
          <nav aria-label={t('learn:sections')}>
            {(['guide', 'hands', 'help'] as const).map((k) => (
              <a
                key={k}
                href={learningPaths[k]}
                aria-current={kind === k ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onSection(k);
                }}
              >
                {t(`learn:${k}Nav`)}
              </a>
            ))}
          </nav>
        )}
      </header>
      {kind === 'guide' && (
        <>
          <section className="learn-basics">
            <h2>{t('learn:goalTitle')}</h2>
            <p>{t('learn:goal')}</p>
            <div className="learn-facts">
              {['private', 'board', 'best'].map((key) => (
                <div key={key}>
                  <strong>{key === 'private' ? '2' : key === 'board' ? '5' : '5 / 7'}</strong>
                  <span>{t(`learn:fact${key}`)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="hand-walkthrough">
            <div className="walkthrough-nav" aria-label={t('learn:handSteps')}>
              {Array.from({ length: 6 }, (_, i) => (
                <button key={i} aria-pressed={step === i} onClick={() => setStep(i)}>
                  <span>{i + 1}</span>
                  {t(`learn:step${i}Title`)}
                </button>
              ))}
            </div>
            <div className="walkthrough-scene">
              <span className="badge">{t('learn:exampleOnly')}</span>
              <div className="example-cards">
                {cards[step].map((card, i) => (
                  <Card key={`${step}-${i}`} card={card} />
                ))}
              </div>
              <h2>{t(`learn:step${step}Title`)}</h2>
              <p>{t(`learn:step${step}Body`)}</p>
              <div className="walkthrough-buttons">
                <button disabled={step === 0} onClick={() => setStep(step - 1)}>
                  {t('learn:previous')}
                </button>
                <button className="primary" disabled={step === 5} onClick={() => setStep(step + 1)}>
                  {t('learn:next')}
                </button>
              </div>
            </div>
          </section>
          <section>
            <h2>{t('learn:actionsTitle')}</h2>
            <div className="lesson-grid">
              {['fold', 'check', 'call', 'bet', 'raise', 'allin'].map((key) => (
                <div className="lesson-card" key={key}>
                  <h3>{t(`learn:${key}Title`)}</h3>
                  <p>{t(`learn:${key}Body`)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="lesson-card">
            <h2>{t('learn:formatsTitle')}</h2>
            <p>{t('learn:formats')}</p>
          </section>
        </>
      )}
      {kind === 'hands' && (
        <>
          <p className="lesson-note">{t('learn:rankingNote')}</p>
          <div className="rank-grid">
            {[...rankExamples].reverse().map((cards, i) => (
              <section key={i} className="rank-card">
                <span className="rank-number">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{t(`learn:rank${9 - i}`)}</h2>
                  <p>{t(`learn:rank${9 - i}Body`)}</p>
                  <div className="example-cards">
                    {cards.map((card) => (
                      <Card key={card} card={card} />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <section className="lesson-card">
            <h2>{t('learn:tiesTitle')}</h2>
            <p>{t('learn:ties')}</p>
          </section>
        </>
      )}
      {kind === 'help' && (
        <>
          <section>
            <h2>{t('learn:faqTitle')}</h2>
            {Array.from({ length: 8 }, (_, i) => (
              <details key={i} className="faq-item">
                <summary>{t(`learn:faq${i}Q`)}</summary>
                <p>{t(`learn:faq${i}A`)}</p>
              </details>
            ))}
          </section>
          <section>
            <div className="glossary-heading">
              <h2>{t('learn:glossary')}</h2>
              <label>
                <span className="sr-only">{t('learn:searchTerms')}</span>
                <input
                  placeholder={t('learn:searchTerms')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <dl className="glossary-list">
              {Array.from({ length: 12 }, (_, i) => i)
                .filter((i) =>
                  (t(`learn:term${i}`) + ' ' + t(`learn:definition${i}`))
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((i) => (
                  <div key={i}>
                    <dt>{t(`learn:term${i}`)}</dt>
                    <dd>{t(`learn:definition${i}`)}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </>
      )}
      {onPlay && (
        <div className="learn-cta">
          <div>
            <h2>{t('learn:tryTitle')}</h2>
            <p>{t('learn:tryBody')}</p>
          </div>
          <button className="primary" onClick={onPlay}>
            {t('learn:play')}
          </button>
        </div>
      )}
      <p className="lesson-note">{t('virtual')}</p>
    </article>
  );
}
/** One navigation owner for every in-app learning entry point. */
export function LearningCenter({
  section,
  onSection,
  standalone = false,
  onPlay,
}: {
  section: LearningSection;
  onSection: (section: LearningSection) => void;
  standalone?: boolean;
  onPlay?: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const content = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    content.current?.scrollTo({ top: 0, left: 0 });
  }, [section]);
  return (
    <div className={`learning-center${standalone ? ' learning-hub' : ''}`}>
      {standalone && (
        <header className="learning-hub-heading">
          <p className="eyebrow">HIGHLORDS / {t('learn:academy')}</p>
          <h1>{t('learn:guideNav')}</h1>
        </header>
      )}
      <div className="learning-tabs" role="tablist" aria-label={t('learn:sections')}>
        {sections.map((key, index) => (
          <button
            key={key}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-${key}`}
            aria-selected={section === key}
            aria-controls={`${id}-content`}
            tabIndex={section === key ? 0 : -1}
            onClick={() => onSection(key)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % sections.length
                  : event.key === 'ArrowLeft'
                    ? (index + sections.length - 1) % sections.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? sections.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              onSection(sections[next]);
              tabs.current[next]?.focus();
            }}
          >
            {key === 'rules' ? t('rules') : t(`learn:${key}Nav`)}
          </button>
        ))}
      </div>
      <div
        ref={content}
        className="learning-center-content"
        id={`${id}-content`}
        role="tabpanel"
        aria-labelledby={`${id}-${section}`}
        tabIndex={0}
      >
        {section === 'rules' ? (
          <section className="house-rules">
            <h2 className="learning-title">{t('rules')}</h2>
            <p className="rules-intro">{t('virtual')}</p>
            <div className="house-rules-copy">
              <p>{t('rulesText')}</p>
            </div>
          </section>
        ) : (
          <LearningPage key={section} kind={section} embedded onPlay={onPlay} />
        )}
      </div>
    </div>
  );
}

export function DecisionDock({
  snapshot,
  table,
  coach,
  onCoach,
  onRankings,
}: {
  snapshot: Snapshot;
  table: Snapshot['tables'][number];
  coach: boolean;
  onCoach: () => void;
  onRankings: () => void;
}) {
  const { t, i18n } = useTranslation();
  const h = table.hand!;
  const own = h.players.find((p) => p.id === snapshot.me);
  if (!own || own.cards.length !== 2) return null;
  const hand = visibleHand(own.cards, h.board);
  const num = (n: number) => new Intl.NumberFormat(i18n.language).format(n);
  return (
    <section className="decision-dock" aria-label={t('learn:yourCards')}>
      <div className="decision-summary">
        <span className="badge">{t('learn:yourCards')}</span>
        <strong>
          {own.folded
            ? t('game:folded')
            : h.actor === snapshot.me && !h.done
              ? t('game:yourTurn')
              : t('learn:watchAction')}
        </strong>
        <small>
          {t('game:stack')}: {num(own.stack)}
        </small>
        {coach && (
          <p className="current-hand" role="status">
            {hand
              ? t('learn:currentHand', { hand: t(`learn:rank${hand.category}`) })
              : t('learn:beforeFlop')}
          </p>
        )}
      </div>
      <div className="coach-controls">
        <button aria-pressed={coach} onClick={onCoach}>
          ? {t('learn:tableHelp')}
        </button>
        <button className="text-button" onClick={onRankings}>
          {t('learn:handsNav')}
        </button>
      </div>
      {coach && (
        <details className="coach-explanation">
          <summary>{t('club:tip')}</summary>
          <p className="coach-tip">
            {own.folded
              ? t('learn:foldedTip')
              : h.done
                ? t('learn:handOverTip')
                : h.actor === snapshot.me
                  ? h.legal.call
                    ? t('learn:callTip', { amount: num(h.legal.call) })
                    : t('learn:checkTip')
                  : t('learn:watchTip')}
          </p>
        </details>
      )}
    </section>
  );
}
export function TournamentPresentation({
  snapshot,
  num,
  finished = false,
}: {
  snapshot: Snapshot;
  num: (n: number) => string;
  finished?: boolean;
}) {
  const { t } = useTranslation();
  if (snapshot.config.mode === 'CASH') return null;
  const liveHands = snapshot.tables.flatMap((table) =>
    table.hand && !table.hand.done ? [table.hand] : [],
  );
  const pending = new Set(liveHands.flatMap((hand) => hand.players.map((player) => player.id)));
  const active = snapshot.players.filter((p) => !p.left && (p.stack > 0 || pending.has(p.id))),
    next = snapshot.config.levels[snapshot.level.index + 1];
  const chips =
    snapshot.players.reduce((sum, p) => sum + p.stack, 0) +
    liveHands.reduce((sum, hand) => sum + hand.pot, 0);
  const ranked = [...snapshot.players].filter((p) => p.rank).sort((a, b) => a.rank! - b.rank!);
  if (finished)
    return (
      <section className="tournament-finish">
        <span className="trophy" aria-hidden>
          ♛
        </span>
        <p className="eyebrow">{t('learn:tournamentComplete')}</p>
        <h2>{t('learn:champion')}</h2>
        <h3>{ranked[0]?.profile?.nickname ?? t('learn:noChampion')}</h3>
        <p>{t('learn:finalResult')}</p>
        <div className="podium">
          {ranked.slice(0, 3).map((p) => (
            <article key={p.id} data-rank={p.rank}>
              <b>#{p.rank}</b>
              <span style={{ color: p.profile?.accent }}>{p.profile?.avatar}</span>
              <strong>{p.profile?.nickname}</strong>
              <small>
                {t('game:prize')}: {num(snapshot.payouts[p.id] ?? 0)}
              </small>
            </article>
          ))}
        </div>
        <p>{t('learn:finalHint')}</p>
      </section>
    );
  return (
    <section className="tournament-overview" aria-label={t('learn:tournamentOverview')}>
      <div>
        <small>{t('learn:remaining')}</small>
        <strong>
          {active.length} / {snapshot.players.filter((p) => !p.left).length}
        </strong>
      </div>
      <div>
        <small>{t('learn:activeTables')}</small>
        <strong>
          {snapshot.tables.length || Math.ceil(active.length / snapshot.config.seats)}
        </strong>
      </div>
      <div>
        <small>{t('game:average')}</small>
        <strong>{num(active.length ? Math.round(chips / active.length) : 0)}</strong>
      </div>
      <div>
        <small>{t('learn:nextLevel')}</small>
        <strong>{next ? `${num(next.small)} / ${num(next.big)}` : t('game:finalLevel')}</strong>
      </div>
      <p>
        {snapshot.config.rebuy && snapshot.level.index <= snapshot.config.rebuyUntil
          ? t('learn:rebuyOpen', { level: snapshot.config.rebuyUntil + 1 })
          : t('learn:rebuyClosed')}{' '}
        · {t('learn:addonAt', { level: snapshot.config.addOnLevel + 1 })}
      </p>
    </section>
  );
}
