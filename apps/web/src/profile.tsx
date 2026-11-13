import React, { useState } from 'react';
import { Icon } from './icons.tsx';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  PHOTO_MAX_LENGTH,
  PROFILE_COLORS,
  ProfileSchema,
  type Profile,
} from '../../../packages/contracts/src/index.ts';
import { Avatar } from './avatar.tsx';
import { randomNickname } from './names.ts';
import { Modal } from './panels.tsx';
import { playSound } from './audio.ts';
import { profileStore, statsStore, useStore } from './store.ts';

/** Reduz a foto no navegador: quadrada, pequena e dentro do limite que o servidor aceita. */
export async function shrinkPhoto(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  for (const size of [112, 96, 80, 64]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    for (const quality of [0.72, 0.55, 0.4]) {
      let url = canvas.toDataURL('image/webp', quality);
      // Navegadores sem WebP devolvem PNG, que é grande demais: cai para JPEG.
      if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= PHOTO_MAX_LENGTH) return url;
    }
  }
  return null;
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: Profile['avatar'];
  onChange: (a: Profile['avatar']) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="avatar-picker" role="radiogroup" aria-label={t('home:avatar')}>
      {AVATARS.map((avatar, index) => (
        <button
          key={avatar}
          type="button"
          role="radio"
          aria-checked={value === avatar}
          aria-label={t('home:portrait', { number: index + 1 })}
          onClick={() => {
            playSound('click');
            onChange(avatar);
          }}
        >
          <Avatar avatar={avatar} />
        </button>
      ))}
    </div>
  );
}

/** Edita o perfil em qualquer momento: apelido, retrato ou emblema, cor da moldura e foto. */
export function ProfileModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** Chamado depois de salvar, para avisar a sala (se houver uma aberta). */
  onSaved?: (profile: Profile) => void;
}) {
  const { t, i18n } = useTranslation();
  const saved = useStore(profileStore);
  const stats = useStore(statsStore);
  const [draft, setDraft] = useState<Profile>(saved);
  const [photoError, setPhotoError] = useState(false);
  const check = ProfileSchema.safeParse(draft);

  const pickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const photo = await shrinkPhoto(file);
    setPhotoError(!photo);
    if (photo) setDraft((current) => ({ ...current, photo }));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!check.success) return;
    profileStore.set(check.data);
    onSaved?.(check.data);
    onClose();
  };

  return (
    <Modal title={t('profile:title')} onClose={onClose}>
      <form className="profile-form" onSubmit={save}>
        <div className="profile-preview" data-frame={draft.color ?? 'brass'}>
          <span className="avatar-frame">
            <Avatar avatar={draft.avatar} photo={draft.photo} />
          </span>
          <input
            value={draft.nickname}
            maxLength={20}
            autoFocus
            aria-label={t('home:yourName')}
            onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
          />
          <button
            type="button"
            className="ghost dice"
            aria-label={t('home:randomName')}
            title={t('home:randomName')}
            onClick={() => setDraft({ ...draft, nickname: randomNickname(i18n.language) })}
          >
            <Icon name="dice" />
          </button>
        </div>
        {!check.success && <p className="error">{t('home:nameShort')}</p>}

        <fieldset>
          <legend>{t('profile:avatar')}</legend>
          <AvatarPicker
            value={draft.avatar}
            onChange={(avatar) => setDraft({ ...draft, avatar, photo: undefined })}
          />
        </fieldset>

        <fieldset>
          <legend>{t('profile:photo')}</legend>
          <div className="photo-row">
            <label className="file-button">
              {t('profile:choosePhoto')}
              <input type="file" accept="image/*" onChange={(e) => void pickPhoto(e)} />
            </label>
            {draft.photo && (
              <button
                type="button"
                className="ghost small"
                onClick={() => setDraft({ ...draft, photo: undefined })}
              >
                {t('profile:removePhoto')}
              </button>
            )}
          </div>
          <small className="field-note">
            {photoError ? t('profile:photoError') : t('profile:photoNote')}
          </small>
        </fieldset>

        <fieldset>
          <legend>{t('profile:frame')}</legend>
          <div className="swatches" role="radiogroup" aria-label={t('profile:frame')}>
            {PROFILE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={(draft.color ?? 'brass') === color}
                aria-label={t(`profile:color_${color}`)}
                data-frame={color}
                onClick={() => setDraft({ ...draft, color })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('profile:statsTitle')}</legend>
          <dl className="stats-grid">
            <div>
              <dt>{t('profile:statHands')}</dt>
              <dd>{stats.hands}</dd>
            </div>
            <div>
              <dt>{t('profile:statWon')}</dt>
              <dd>{stats.hands ? Math.round((100 * stats.won) / stats.hands) : 0}%</dd>
            </div>
            <div>
              <dt>{t('profile:statBiggest')}</dt>
              <dd>{stats.biggestPot}</dd>
            </div>
          </dl>
          <small className="field-note">{t('profile:statsNote')}</small>
        </fieldset>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button className="primary" type="submit" disabled={!check.success}>
            {t('profile:save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
