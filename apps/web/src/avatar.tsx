import { createContext, useContext } from 'react';
import { EMBLEMS, normalizeAvatar } from '../../../packages/contracts/src/index.ts';

/** Fotos recebidas do servidor (id do jogador para data URL), fora do estado de cada mão. */
export const PhotosContext = createContext<Record<string, string>>({});

/** Emblemas desenhados no cliente: um símbolo sobre um fundo colorido. */
const EMBLEM_LOOK: Record<string, { glyph: string; hue: number }> = {
  g1: { glyph: '♠', hue: 215 },
  g2: { glyph: '♥', hue: 350 },
  g3: { glyph: '♦', hue: 18 },
  g4: { glyph: '♣', hue: 145 },
  g5: { glyph: '♛', hue: 42 },
  g6: { glyph: '♞', hue: 270 },
  g7: { glyph: '⚜', hue: 48 },
  g8: { glyph: '☾', hue: 235 },
  g9: { glyph: '★', hue: 28 },
  g10: { glyph: '✦', hue: 185 },
  g11: { glyph: '☀', hue: 38 },
  g12: { glyph: '❖', hue: 310 },
};
export const isEmblem = (avatar: string) => (EMBLEMS as readonly string[]).includes(avatar);

/** Emblema ou foto: o mesmo círculo em qualquer lugar da interface. */
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
  avatar = String(normalizeAvatar(avatar));
  const source = photo ?? (id ? photos[id] : undefined);
  if (source) return <img src={source} alt="" draggable={false} />;
  const look = EMBLEM_LOOK[isEmblem(avatar) ? avatar : 'g1'];
  return (
    <span
      className="emblem"
      aria-hidden
      style={{ ['--hue' as string]: look.hue } as React.CSSProperties}
    >
      {look.glyph}
    </span>
  );
}
