import { ProfileSchema, type Profile } from '../../../packages/contracts/src/index.ts';
import { read } from './api.ts';
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
  chipColor: '#d9b66b',
  sound: false,
};
export function storedPreferences(): Preferences {
  const p = read<Preferences>('highlords.preferences', defaults);
  return p.schema === 1 && ProfileSchema.safeParse(p.profile).success
    ? { ...defaults, ...p }
    : defaults;
}
