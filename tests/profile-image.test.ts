import { describe, expect, it } from 'vitest';
import { ProfileSchema } from '../packages/contracts/src/index.ts';

describe('profile image transport', () => {
  it('keeps existing symbol identifiers compatible and accepts a bounded JPEG thumbnail', () => {
    expect(ProfileSchema.parse({ nickname: 'Berkas', avatar: '☠' }).avatar).toBe('☠');
    const avatarImage = 'data:image/jpeg;base64,/9j/2Q==';
    expect(ProfileSchema.parse({ nickname: 'Berkas', avatarImage }).avatarImage).toBe(avatarImage);
  });
  it('rejects remote URLs, SVG content and thumbnails that exceed the command payload budget', () => {
    for (const avatarImage of [
      'https://example.com/a.jpg',
      'data:image/svg+xml;base64,AAAA',
      'data:image/jpeg;base64,' + 'A'.repeat(8192),
    ])
      expect(ProfileSchema.safeParse({ nickname: 'Berkas', avatarImage }).success).toBe(false);
  });
});

it('room photos stay out of the public lobby while the host and stock portraits are listed', async () => {
  const { PokerService } = await import('../packages/server/src/service.ts');
  const { ConfigSchema } = await import('../packages/contracts/src/index.ts');
  const service = new PokerService({
    async load() {
      return null;
    },
    async save() {},
  });
  await service.init();
  const avatarImage = 'data:image/jpeg;base64,/9j/2Q==';
  const host = await service.openSession({ nickname: 'Berkas', avatar: '♠', avatarImage });
  await service.command(host.token, {
    id: crypto.randomUUID(),
    type: 'CREATE',
    payload: {
      config: ConfigSchema.parse({
        title: 'Public table',
        levels: [{ small: 25, big: 50, ante: 0, minutes: 10, breakMinutes: 0 }],
        mode: 'CASH',
        seats: 6,
        stack: 5000,
        small: 25,
        big: 50,
      }),
    },
  });
  const room = service.lobby()[0];
  expect(room.hostProfile).toEqual({ nickname: 'Berkas', avatar: '♠' });
  expect(room.playerProfiles).toEqual([{ nickname: 'Berkas', avatar: '♠' }]);
  expect(JSON.stringify(room)).not.toContain('base64');
});
