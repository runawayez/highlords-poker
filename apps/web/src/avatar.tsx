import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Profile } from '../../../packages/contracts/src/index.ts';

// Keep saved profiles compatible; the existing identifiers now select portraits.
export const portraitChoices = ['♠', '♥', '♣', '♦', '☠', '♜'] as const;
const legacy = ['♠', '♥', '♣', '♦', '☠', '♜', '⚔', '☾'];
export function Avatar({ profile, seed = '' }: { profile?: Partial<Profile>; seed?: string }) {
  const index = profile?.avatar
    ? Math.max(0, legacy.indexOf(profile.avatar)) % 6
    : [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
  if (profile?.avatarImage)
    return <img className="portrait" src={profile.avatarImage} alt="" draggable={false} />;
  // Reuse the approved portraits as a sprite; the game UI remains live components.
  const [cx, cy, diameter] = [
    [566, 170, 102],
    [155, 260, 104],
    [989, 260, 102],
    [126, 524, 106],
    [991, 524, 102],
    [550, 660, 122],
  ][index];
  const scale = 100 / diameter;
  return (
    <svg
      className="portrait"
      data-portrait={index + 1}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <image
        href="/portrait-reference.png"
        x={50 - cx * scale}
        y={50 - cy * scale}
        width={1586 * scale}
        height={992 * scale}
      />
    </svg>
  );
}

export async function prepareAvatar(file: File): Promise<string> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('IMAGE_INVALID');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 96;
    const context = canvas.getContext('2d')!;
    const side = Math.min(bitmap.width, bitmap.height);
    context.fillStyle = '#161218';
    context.fillRect(0, 0, 96, 96);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      96,
      96,
    );
    for (const quality of [0.8, 0.65, 0.45, 0.25]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 8192) return data;
    }
    throw new Error('IMAGE_INVALID');
  } finally {
    bitmap.close();
  }
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Profile;
  onChange: (value: Profile) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <fieldset className="portrait-picker">
      <legend>{t('profile:avatar')}</legend>
      <div className="avatar-options">
        {portraitChoices.map((avatar, index) => (
          <button
            type="button"
            key={avatar}
            aria-label={t('profile:portrait', { number: index + 1 })}
            aria-pressed={!value.avatarImage && value.avatar === avatar}
            onClick={() => {
              setError('');
              onChange({ ...value, avatar, avatarImage: undefined });
            }}
          >
            <Avatar profile={{ avatar }} />
          </button>
        ))}
      </div>
      <label className="photo-upload">
        <span>{loading ? t('loading') : t('profile:upload')}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={loading}
          aria-label={t('profile:upload')}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            setLoading(true);
            setError('');
            try {
              onChange({ ...value, avatarImage: await prepareAvatar(file) });
            } catch {
              setError(t('profile:photoError'));
            } finally {
              setLoading(false);
            }
          }}
        />
      </label>
      <p className="photo-hint">{t('profile:photoHint')}</p>
      {value.avatarImage && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange({ ...value, avatarImage: undefined })}
        >
          {t('profile:removePhoto')}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
