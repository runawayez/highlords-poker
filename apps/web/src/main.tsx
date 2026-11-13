import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from './icons.tsx';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import './i18n/index.ts';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/manrope/index.css';
import './styles.css';
import './repaginada3.css';
import './premium.css';
import './apresentacao.css';
import { ROOM_CODE_PATTERN } from '../../../packages/contracts/src/index.ts';
import { Home } from './home.tsx';
import { LearningCenter, learningPaths, learningRoute, type LearningSection } from './learning.tsx';
import { RoomPage } from './room.tsx';
import { SettingsModal } from './settings.tsx';
import { applyPrefs, prefsStore } from './store.ts';

// Tema, tamanho de texto, contraste e naipes refletem no <html> desde o primeiro quadro.
applyPrefs();
prefsStore.subscribe(() => applyPrefs());

function usePath() {
  const [path, setPath] = useState(() => location.pathname.replace(/\/$/, '') || '/');
  useEffect(() => {
    const update = () => setPath(location.pathname.replace(/\/$/, '') || '/');
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = useCallback((next: string) => {
    if (next !== location.pathname) history.pushState(null, '', next);
    setPath(next.replace(/\/$/, '') || '/');
    window.scrollTo({ top: 0 });
  }, []);
  return [path, navigate] as const;
}

function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const english = i18n.language === 'en';
  return (
    <button
      className="ghost small"
      aria-label={t('common:language')}
      onClick={() => void i18n.changeLanguage(english ? 'pt-BR' : 'en')}
    >
      {english ? 'PT' : 'EN'}
    </button>
  );
}

function Shell({
  navigate,
  children,
}: {
  navigate: (path: string) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="shell">
      <a className="skip" href="#content">
        {t('common:skip')}
      </a>
      <header className="site-bar">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          <img src="/highlords-torch.png" alt="" />
          <span>
            <b>{t('common:brand')}</b> {t('common:poker')}
          </span>
        </a>
        <nav>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            {t('common:play')}
          </a>
          <a
            href="/#open-tables"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
              setTimeout(
                () =>
                  document.getElementById('open-tables')?.scrollIntoView({ behavior: 'smooth' }),
                60,
              );
            }}
          >
            {t('common:openTables')}
          </a>
          <a
            href={learningPaths.guide}
            onClick={(e) => {
              e.preventDefault();
              navigate(learningPaths.guide);
            }}
          >
            {t('common:learn')}
          </a>
          <button
            className="ghost small"
            aria-label={t('settings:title')}
            title={t('settings:title')}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="gear" />
          </button>
          <LanguageToggle />
        </nav>
      </header>
      {children}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function App() {
  const [path, navigate] = usePath();
  const room = path.match(/^\/mesa\/([A-Za-z0-9]+)$/);
  if (room) {
    const code = room[1].toUpperCase();
    if (ROOM_CODE_PATTERN.test(code))
      return <RoomPage key={code} code={code} navigate={navigate} />;
  }
  const section = learningRoute();
  return (
    <Shell navigate={navigate}>
      {path === '/' ? (
        <Home navigate={navigate} />
      ) : section !== 'play' ? (
        <main className="learn-page" id="content">
          <LearningCenter
            standalone
            section={section}
            onSection={(next: LearningSection) => navigate(learningPaths[next])}
            onPlay={() => navigate('/')}
          />
        </main>
      ) : (
        <NotFound navigate={navigate} />
      )}
    </Shell>
  );
}

function NotFound({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <main className="notice" id="content">
      <h1>{t('common:notFound')}</h1>
      <button className="primary" onClick={() => navigate('/')}>
        {t('game:backHome')}
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
