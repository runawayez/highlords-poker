import { createContext, useContext, useId } from 'react';
import { AVATARS, normalizeAvatar } from '../../../packages/contracts/src/index.ts';

/** Fotos recebidas do servidor (id do jogador para data URL), fora do estado de cada mão. */
export const PhotosContext = createContext<Record<string, string>>({});

type HairStyle = 'short' | 'slick' | 'bald' | 'long' | 'bob' | 'bun' | 'curly' | 'pony';

type Look = {
  skin: string;
  hair: string;
  style: HairStyle;
  jacket: string;
  shirt?: string;
  tie?: string;
  /** Pano de fundo: duas cores do degradê. */
  back: [string, string];
  beard?: 'full' | 'stubble' | 'mustache';
  glasses?: boolean;
  earring?: boolean;
};

/** Doze pessoas desenhadas em SVG: sóbrias, de terno, com tons de pele e penteados variados. */
const PEOPLE: Record<string, Look> = {
  g1: {
    skin: '#e8c4a0',
    hair: '#1d1a18',
    style: 'short',
    jacket: '#1c2536',
    tie: '#7a1f2b',
    back: ['#2b3a52', '#0d1118'],
  },
  g2: {
    skin: '#c68a63',
    hair: '#15110f',
    style: 'long',
    jacket: '#2b1f33',
    back: ['#4a3556', '#120d16'],
    earring: true,
  },
  g3: {
    skin: '#8d5a3b',
    hair: '#0f0d0c',
    style: 'short',
    jacket: '#1f2022',
    tie: '#c8a96a',
    back: ['#3d3a35', '#0d0d0c'],
    beard: 'full',
  },
  g4: {
    skin: '#f1cfb4',
    hair: '#c9a35c',
    style: 'bob',
    jacket: '#3a2a22',
    back: ['#5a4636', '#15100c'],
  },
  g5: {
    skin: '#e0b794',
    hair: '#a4a4a4',
    style: 'slick',
    jacket: '#232427',
    tie: '#c8a96a',
    back: ['#3a4a4a', '#0b1010'],
    glasses: true,
  },
  g6: {
    skin: '#6e4430',
    hair: '#0e0b0a',
    style: 'curly',
    jacket: '#4a1822',
    back: ['#5b2a35', '#150a0d'],
    earring: true,
  },
  g7: {
    skin: '#f0d2b6',
    hair: '#4a4a4a',
    style: 'bald',
    jacket: '#14262d',
    tie: '#8e2a3a',
    back: ['#2d4a54', '#0a1114'],
    beard: 'full',
  },
  g8: {
    skin: '#d9a47c',
    hair: '#2b1a12',
    style: 'bun',
    jacket: '#1d2d26',
    back: ['#2f4a3e', '#0b130f'],
    glasses: true,
  },
  g9: {
    skin: '#b5784f',
    hair: '#100d0b',
    style: 'slick',
    jacket: '#2c2520',
    tie: '#1c2536',
    back: ['#54402e', '#130e0a'],
    beard: 'mustache',
  },
  g10: {
    skin: '#f3d9c2',
    hair: '#7a2e1b',
    style: 'long',
    jacket: '#1c2230',
    back: ['#33405a', '#0b0e15'],
  },
  g11: {
    skin: '#59382a',
    hair: '#0c0a09',
    style: 'curly',
    jacket: '#2b2b33',
    tie: '#b9bcc4',
    back: ['#44444f', '#0e0e11'],
    beard: 'stubble',
  },
  g12: {
    skin: '#e6b99a',
    hair: '#5b4a3f',
    style: 'pony',
    jacket: '#332029',
    back: ['#4d3140', '#120a0e'],
    earring: true,
  },
};

export const isPerson = (avatar: string) => (AVATARS as readonly string[]).includes(avatar);

/** Cabelo que fica atrás da cabeça (longo, bob, rabo de cavalo e coque). */
function HairBack({ look }: { look: Look }) {
  const { style, hair } = look;
  if (style === 'long')
    return <path d="M29 47 C25 18 75 18 71 47 L74 82 C60 88 40 88 26 82 Z" fill={hair} />;
  if (style === 'bob')
    return <path d="M30 46 C27 18 73 18 70 46 L71 66 C60 70 40 70 29 66 Z" fill={hair} />;
  if (style === 'pony')
    return <path d="M66 30 C84 30 86 58 78 74 C76 58 72 46 66 40 Z" fill={hair} />;
  if (style === 'bun') return <circle cx="50" cy="16" r="9" fill={hair} />;
  return null;
}

/** Cabelo à frente: topo da cabeça e franja. */
function HairFront({ look }: { look: Look }) {
  const { style, hair } = look;
  switch (style) {
    case 'bald':
      return null;
    case 'slick':
      return (
        <path
          d="M32 45 C29 22 44 17 52 18 C66 19 71 30 68 45 C66 36 60 29 49 29 C41 29 35 35 32 45 Z"
          fill={hair}
        />
      );
    case 'curly':
      return (
        <g fill={hair}>
          {[
            [36, 29, 8],
            [45, 23, 9],
            [55, 23, 9],
            [64, 29, 8],
            [32, 38, 6],
            [68, 38, 6],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case 'long':
    case 'bob':
      return (
        <path
          d="M31 46 C28 24 42 18 52 19 C66 20 72 30 69 46 C66 36 58 31 50 31 C40 31 34 37 31 46 Z"
          fill={hair}
        />
      );
    default:
      return (
        <path
          d="M32 44 C30 25 42 19 50 19 C59 19 70 25 68 44 C66 37 60 31 50 31 C40 31 34 37 32 44 Z"
          fill={hair}
        />
      );
  }
}

/** Retrato de uma pessoa desenhado em SVG. */
function Person({ look }: { look: Look }) {
  const uid = useId().replace(/:/g, '');
  const woman = ['long', 'bob', 'bun', 'pony'].includes(look.style);
  return (
    <svg className="person" viewBox="0 0 100 100" aria-hidden focusable="false">
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="30%" r="85%">
          <stop offset="0" stopColor={look.back[0]} />
          <stop offset="1" stopColor={look.back[1]} />
        </radialGradient>
        <linearGradient id={`face${uid}`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`vig${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg${uid})`} />
      <HairBack look={look} />
      {/* ombros e paletó */}
      <path d="M4 100 C6 80 26 72 50 72 C74 72 94 80 96 100 Z" fill={look.jacket} />
      <path d="M36 73 L50 96 L64 73 L58 70 L50 80 L42 70 Z" fill={look.shirt ?? '#ece6d8'} />
      {look.tie && <path d="M50 80 L45.5 100 L54.5 100 Z" fill={look.tie} />}
      <path d="M36 73 L44 100 L26 100 C24 88 28 78 36 73 Z" fill="#000" opacity="0.22" />
      <path d="M64 73 L56 100 L74 100 C76 88 72 78 64 73 Z" fill="#000" opacity="0.22" />
      {/* pescoço */}
      <path d="M43 58 L43 74 Q50 81 57 74 L57 58 Z" fill={look.skin} />
      <path d="M43 66 Q50 72 57 66 L57 74 Q50 81 43 74 Z" fill="#000" opacity="0.25" />
      {/* orelhas e cabeça */}
      <ellipse cx="33" cy="49" rx="3.6" ry="5.4" fill={look.skin} />
      <ellipse cx="67" cy="49" rx="3.6" ry="5.4" fill={look.skin} />
      {look.earring && <circle cx="33" cy="55" r="1.6" fill="#e6d3a3" />}
      {look.earring && <circle cx="67" cy="55" r="1.6" fill="#e6d3a3" />}
      <ellipse cx="50" cy="46" rx="17" ry={woman ? 20 : 21} fill={look.skin} />
      <ellipse cx="50" cy="46" rx="17" ry={woman ? 20 : 21} fill={`url(#face${uid})`} />
      {/* barba */}
      {look.beard === 'full' && (
        <path
          d="M33.5 50 C34 72 66 72 66.5 50 C63 60 57 63 50 63 C43 63 37 60 33.5 50 Z"
          fill={look.hair}
          opacity="0.95"
        />
      )}
      {look.beard === 'stubble' && (
        <path
          d="M34 52 C36 70 64 70 66 52 C62 62 56 65 50 65 C44 65 38 62 34 52 Z"
          fill={look.hair}
          opacity="0.35"
        />
      )}
      {look.beard === 'mustache' && (
        <path d="M42 56 C46 53 54 53 58 56 C54 58 46 58 42 56 Z" fill={look.hair} />
      )}
      <HairFront look={look} />
      {/* rosto: sobrancelhas, olhos, nariz e boca discretos, expressão séria */}
      <g stroke={look.hair === '#a4a4a4' ? '#6f6f6f' : look.hair} strokeLinecap="round" fill="none">
        <path d="M39 41 L46 40" strokeWidth="1.8" opacity="0.85" />
        <path d="M54 40 L61 41" strokeWidth="1.8" opacity="0.85" />
      </g>
      <ellipse cx="42.5" cy="45" rx="1.7" ry="1.2" fill="#14100e" />
      <ellipse cx="57.5" cy="45" rx="1.7" ry="1.2" fill="#14100e" />
      <path d="M50 46 L48.6 53 Q50 54.4 51.6 53" stroke="#000" strokeOpacity="0.28" fill="none" />
      <path
        d="M45 59 Q50 60.4 55 59"
        stroke="#3a1c18"
        strokeOpacity="0.65"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {look.glasses && (
        <g fill="none" stroke="#e6d3a3" strokeWidth="1.2" opacity="0.9">
          <rect x="36" y="41" width="12.5" height="9" rx="3.5" />
          <rect x="51.5" y="41" width="12.5" height="9" rx="3.5" />
          <path d="M48.5 45 L51.5 45" />
        </g>
      )}
      <rect width="100" height="100" fill={`url(#vig${uid})`} />
    </svg>
  );
}

/** Retrato desenhado ou foto enviada: o mesmo círculo em qualquer lugar da interface. */
export function Avatar({
  avatar,
  photo,
  id,
}: {
  avatar: string;
  /** Foto direta (prévia do perfil); no resto da interface vem do contexto pelo `id`. */
  photo?: string | null;
  id?: string;
}) {
  const photos = useContext(PhotosContext);
  const key = String(normalizeAvatar(avatar));
  const source = photo ?? (id ? photos[id] : undefined);
  if (source) return <img src={source} alt="" draggable={false} />;
  return <Person look={PEOPLE[isPerson(key) ? key : 'g1']} />;
}
