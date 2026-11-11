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
