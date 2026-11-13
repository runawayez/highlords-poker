import React from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './avatar.tsx';
import { Card } from './card.tsx';
import { Modal } from './panels.tsx';
import {
  prefsStore,
  useStore,
  type CardBack,
  type Prefs,
  type TextSize,
  type Theme,
} from './store.ts';
import { Chips, type Send } from './table.tsx';

const THEMES: Theme[] = ['night', 'emerald', 'royal', 'crimson'];
const BACKS: CardBack[] = ['crimson', 'azure', 'onyx'];
const SIZES: TextSize[] = ['m', 'l', 'xl'];

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>
        {label}
        {note && <small>{note}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** Mesa em miniatura que reflete na hora tema, verso, naipes, tamanhos e contraste escolhidos. */
function AppearancePreview() {
  const { t } = useTranslation();
  return (
    <div className="pv" role="img" aria-label={t('settings:previewLabel')}>
      <div className="pv-rail">
        <div className="pv-felt">
          <span className="pv-pot">{t('game:pot')} 240</span>
          <div className="pv-board">
            {['As', 'Kh', 'Qd', 'Jc', 'Ts'].map((card) => (
              <Card key={card} card={card} className="pv-card" />
            ))}
          </div>
          <Chips amount={65} className="pv-chips" />
        </div>
      </div>
      <div className="pv-seat pv-top">
        <div className="pv-hole">
          <Card down className="pv-card pv-small" />
          <Card down className="pv-card pv-small" />
        </div>
        <span className="pv-avatar">
          <Avatar avatar="g3" />
        </span>
        <span className="pv-plate">
          <b>Raven</b>
          <i>1.980</i>
        </span>
      </div>
      <div className="pv-seat pv-me">
        <div className="pv-hole">
          <Card card="Ah" className="pv-card pv-small" />
          <Card card="Ac" className="pv-card pv-small" />
        </div>
        <span className="pv-avatar">
          <Avatar avatar="g1" />
        </span>
        <span className="pv-plate">
          <b>{t('game:you')}</b>
          <i>2.000</i>
        </span>
      </div>
    </div>
  );
}

/** Ajustes do navegador: som, ajudas, aparência e acessibilidade. Ficam salvos neste aparelho. */
export function SettingsModal({
  onClose,
  send,
  onTour,
}: {
  onClose: () => void;
  /** Dentro de uma sala, a preferência de esconder cartas também vai ao servidor. */
  send?: Send;
  onTour?: () => void;
}) {
  const { t } = useTranslation();
  const prefs = useStore(prefsStore);
  const set = (patch: Partial<Prefs>) => prefsStore.set(patch);
  const reset = () =>
    set({
      theme: 'night',
      cardBack: 'crimson',
      fourColor: false,
      textSize: 'm',
      cardSize: 'm',
      contrast: false,
      reduceMotion: false,
    });

  return (
    <Modal title={t('settings:title')} wide onClose={onClose}>
      <div className="settings-grid">
        <AppearancePreview />
        <div className="settings settings-options">
          <section>
            <h3>{t('settings:look')}</h3>
            <div className="option-row" role="radiogroup" aria-label={t('settings:theme')}>
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={prefs.theme === theme}
                  className={`theme-chip theme-${theme}`}
                  onClick={() => set({ theme })}
                >
                  <i aria-hidden />
                  {t(`settings:theme_${theme}`)}
                </button>
              ))}
            </div>
            <div className="option-row" role="radiogroup" aria-label={t('settings:cardBack')}>
              {BACKS.map((back) => (
                <button
                  key={back}
                  type="button"
                  role="radio"
                  aria-checked={prefs.cardBack === back}
                  className="back-chip"
                  data-back={back}
                  aria-label={t(`settings:back_${back}`)}
                  onClick={() => set({ cardBack: back })}
                >
                  <Card down className="mini" />
                </button>
              ))}
              <span className="suits-preview" aria-hidden>
                <Card card="As" className="mini" />
                <Card card="Kh" className="mini" />
                <Card card="Qd" className="mini" />
                <Card card="Jc" className="mini" />
              </span>
            </div>
            <Toggle
              label={t('settings:fourColor')}
              note={t('settings:fourColorNote')}
              checked={prefs.fourColor}
              onChange={(fourColor) => set({ fourColor })}
            />
          </section>

          <section>
            <h3>{t('settings:access')}</h3>
            <div className="option-row" role="radiogroup" aria-label={t('settings:textSize')}>
              {SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={prefs.textSize === size}
                  onClick={() => set({ textSize: size })}
                >
                  {t(`settings:size_${size}`)}
                </button>
              ))}
            </div>
            <div className="option-row" role="radiogroup" aria-label={t('settings:cardSize')}>
              {(['s', 'm', 'l'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={prefs.cardSize === size}
                  onClick={() => set({ cardSize: size })}
                >
                  {t(`settings:cards_${size}`)}
                </button>
              ))}
            </div>
            <Toggle
              label={t('settings:contrast')}
              checked={prefs.contrast}
              onChange={(contrast) => set({ contrast })}
            />
            <Toggle
              label={t('settings:reduceMotion')}
              note={t('settings:reduceMotionNote')}
              checked={prefs.reduceMotion}
              onChange={(reduceMotion) => set({ reduceMotion })}
            />
          </section>
          <section>
            <h3>{t('settings:help')}</h3>
            <Toggle
              label={t('settings:coach')}
              note={t('settings:coachNote')}
              checked={prefs.coach}
              onChange={(coach) => set({ coach })}
            />
            <Toggle
              label={t('settings:hud')}
              note={t('settings:hudNote')}
              checked={prefs.hud}
              onChange={(hud) => set({ hud })}
            />
            <Toggle
              label={t('settings:muck')}
              note={t('settings:muckNote')}
              checked={prefs.muck}
              onChange={(muck) => {
                set({ muck });
                send?.({ type: 'SHOWDOWN', mode: muck ? 'MUCK' : 'SHOW' });
              }}
            />
            <Toggle
              label={t('settings:runTwice')}
              note={t('settings:runTwiceNote')}
              checked={prefs.runTwice}
              onChange={(runTwice) => {
                set({ runTwice });
                send?.({ type: 'RUN_TWICE', value: runTwice });
              }}
            />
            {onTour && (
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  set({ tourDone: false });
                  onTour();
                  onClose();
                }}
              >
                {t('settings:tourAgain')}
              </button>
            )}
          </section>

          <section>
            <h3>{t('settings:sound')}</h3>
            <Toggle
              label={t('settings:soundOn')}
              checked={prefs.sound}
              onChange={(sound) => set({ sound })}
            />
            <label className="slider-field">
              {t('settings:volume')}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                disabled={!prefs.sound}
                onChange={(e) => set({ volume: Number(e.target.value) })}
              />
            </label>
          </section>

          <button type="button" className="ghost small reset" onClick={reset}>
            {t('settings:reset')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
