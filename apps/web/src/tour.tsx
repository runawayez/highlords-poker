import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STEPS = [
  { target: '.seat.me .hole', key: 'cards' },
  { target: '.center', key: 'pot' },
  { target: '.action-bar', key: 'actions' },
  { target: '[data-tour="ranking"]', key: 'ranking' },
] as const;

type Box = { top: number; left: number; width: number; height: number };

/** Passo a passo de 4 balões, na primeira mesa: só aponta para elementos que já existem na tela. */
export function Tour({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = STEPS[index];

  useLayoutEffect(() => {
    const measure = () => {
      const element = document.querySelector(step.target);
      if (!element) return setBox(null);
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const last = index === STEPS.length - 1;
  const below = !!box && box.top < window.innerHeight / 2;
  return (
    <div className="tour" role="dialog" aria-label={t('tour:title')}>
      {box && (
        <span
          className="tour-ring"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
          }}
        />
      )}
      <div
        className={`tour-card ${box ? (below ? 'below' : 'above') : 'center'}`}
        style={
          box
            ? {
                top: below ? box.top + box.height + 16 : undefined,
                bottom: below ? undefined : window.innerHeight - box.top + 16,
              }
            : undefined
        }
      >
        <small>
          {index + 1}/{STEPS.length}
        </small>
        <strong>{t(`tour:${step.key}Title`)}</strong>
        <p>{t(`tour:${step.key}Text`)}</p>
        <div className="tour-actions">
          <button className="ghost small" onClick={onDone}>
            {t('tour:skip')}
          </button>
          <button className="primary small" onClick={() => (last ? onDone() : setIndex(index + 1))}>
            {last ? t('tour:done') : t('tour:next')}
          </button>
        </div>
      </div>
    </div>
  );
}
