import { ProfileSchema, type Profile } from '../../../packages/contracts/src/index.ts';
import { read, write } from './api.ts';
export type Preferences = {
  schema: 1;
  profile: Profile;
  theme: 'felt' | 'midnight' | 'crimson';
  cardBack: 'classic' | 'geometric';
  chipColor: string;
  sound: boolean;
};
export const defaults: Preferences = {
  schema: 1,
  profile: { nickname: '', avatar: '♠', frame: 'plain', accent: '#df3449', tagline: '' },
  theme: 'felt',
  cardBack: 'classic',
  chipColor: '#b22232',
  sound: true,
};
const avatars: Profile['avatar'][] = ['♠', '♣', '♦', '♥', '☠', '♜', '⚔', '☾'];
const accents = ['#dc303d', '#d85d70', '#b8435c', '#b7a8b5', '#985366', '#ed8496'];
export function guestProfile(random = crypto.getRandomValues(new Uint32Array(1))[0]): Profile {
  return {
    nickname: 'Highlord-' + String(100000 + (random % 900000)),
    avatar: avatars[random % avatars.length],
    frame: 'plain',
    accent: accents[Math.floor(random / avatars.length) % accents.length],
    tagline: '',
  };
}
export function storedPreferences(): Preferences {
  const saved = read<unknown>('highlords.preferences', null);
  if (
    saved &&
    typeof saved === 'object' &&
    'schema' in saved &&
    saved.schema === 1 &&
    'profile' in saved &&
    ProfileSchema.safeParse(saved.profile).success
  ) {
    return { ...defaults, ...(saved as Preferences) };
  }
  const guest: Preferences = { ...defaults, profile: guestProfile() };
  write('highlords.preferences', guest);
  return guest;
}
