import { z } from 'zod';

/** Retratos (a1-a4) e emblemas desenhados no cliente (g1-g12); o cliente mapeia cada id. */
export const PORTRAITS = ['a1', 'a2', 'a3', 'a4'] as const;
export const EMBLEMS = [
  'g1',
  'g2',
  'g3',
  'g4',
  'g5',
  'g6',
  'g7',
  'g8',
  'g9',
  'g10',
  'g11',
  'g12',
] as const;
export const AVATARS = [...PORTRAITS, ...EMBLEMS] as const;
/** Cor da moldura do avatar. */
export const PROFILE_COLORS = [
  'brass',
  'crimson',
  'emerald',
  'azure',
  'violet',
  'amber',
  'rose',
  'slate',
] as const;
/** Foto pequena (já reduzida no navegador); o servidor só confere o formato e o tamanho. */
export const PHOTO_MAX_LENGTH = 9000;
export const PhotoSchema = z
  .string()
  .max(PHOTO_MAX_LENGTH)
  .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/);

export const ProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[\p{L}\p{N}_ .-]+$/u),
  avatar: z.enum(AVATARS).default('a1'),
  color: z.enum(PROFILE_COLORS).optional(),
  photo: PhotoSchema.optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

const chips = z.number().int().min(1).max(10_000_000);

export const ConfigSchema = z
  .object({
    title: z.string().trim().min(2).max(40),
    password: z.string().max(40).default(''),
    mode: z.enum(['CASH', 'SIT_AND_GO']).default('CASH'),
    seats: z.number().int().min(2).max(9).default(6),
    stack: chips.default(2000),
    small: chips.default(10),
    big: chips.default(20),
    turnSeconds: z.number().int().min(10).max(120).default(25),
    /** Minutos por nível de blinds (apenas Sit & Go). */
    levelMinutes: z.number().int().min(1).max(30).default(5),
    isPublic: z.boolean().default(true),
  })
  .refine((c) => c.small <= c.big, 'Blinds inválidos');
export type Config = z.infer<typeof ConfigSchema>;
export type PublicConfig = Omit<Config, 'password'>;

export const BotDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export type BotDifficulty = z.infer<typeof BotDifficultySchema>;
/** Estilo de jogo do bot: ajuda quem está aprendendo a reconhecer perfis de adversário. */
export const BOT_STYLES = ['BALANCED', 'TIGHT', 'LOOSE', 'AGGRESSIVE'] as const;
export const BotStyleSchema = z.enum(BOT_STYLES);
export type BotStyle = z.infer<typeof BotStyleSchema>;

export const ChatTextSchema = z.string().trim().min(1).max(200);
export const EMOTES = ['👍', '🔥', '😂', '😮', '😡', '🎉'] as const;

/** Mensagens enviadas pelo cliente por WebSocket. */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HELLO'),
    key: z.string().min(32).max(128),
    profile: ProfileSchema,
    password: z.string().max(40).optional(),
  }),
  z.object({ type: z.literal('PING') }),
  z.object({ type: z.literal('SIT'), seat: z.number().int().min(0).max(8).optional() }),
  z.object({ type: z.literal('STAND') }),
  z.object({ type: z.literal('LEAVE') }),
  z.object({ type: z.literal('START') }),
  z.object({ type: z.literal('PAUSE') }),
  z.object({ type: z.literal('RESUME') }),
  z.object({
    type: z.literal('ACT'),
    action: z.enum(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']),
    amount: z.number().int().optional(),
  }),
  z.object({ type: z.literal('SIT_OUT'), value: z.boolean() }),
  z.object({ type: z.literal('REBUY') }),
  z.object({
    type: z.literal('ADD_BOT'),
    difficulty: BotDifficultySchema,
    style: BotStyleSchema.optional(),
  }),
  z.object({ type: z.literal('PROFILE'), profile: ProfileSchema }),
  /** Gasta uma ficha de tempo extra na sua vez. */
  z.object({ type: z.literal('TIME_BANK') }),
  /** Preferência no showdown: mostrar as cartas ao perder ou escondê-las (muck). */
  z.object({ type: z.literal('SHOWDOWN'), mode: z.enum(['SHOW', 'MUCK']) }),
  /** Mostra suas cartas depois que a mão acabou (mesmo se você desistiu). */
  z.object({ type: z.literal('SHOW') }),
  z.object({ type: z.literal('REMOVE_BOT'), id: z.string().max(40) }),
  z.object({ type: z.literal('KICK'), id: z.string().max(40) }),
  z.object({ type: z.literal('CLOSE') }),
  z.object({ type: z.literal('CHAT'), text: ChatTextSchema }),
  z.object({ type: z.literal('EMOTE'), emote: z.enum(EMOTES) }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Códigos de erro enviados ao cliente. */
export type ErrorCode =
  | 'VALIDATION'
  | 'INVALID_ACTION'
  | 'WRONG_PASSWORD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'FORBIDDEN'
  | 'NEED_PLAYERS'
  | 'RATE_LIMIT'
  | 'CAPACITY'
  | 'KICKED'
  | 'SEAT_TAKEN'
  | 'INVALID_STACK'
  | 'MIN_RAISE'
  | 'HAND_IN_PROGRESS'
  | 'NOT_YOUR_TURN'
  | 'INTERNAL';

/** Gera um código curto de sala fácil de ditar: sem 0/O/1/I. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

/** Níveis de blinds do Sit & Go: dobram a cada dois níveis, com passos suaves. */
export function blindLevel(config: Pick<PublicConfig, 'small' | 'big' | 'mode'>, index: number) {
  if (config.mode === 'CASH') return { small: config.small, big: config.big, ante: 0, index: 0 };
  const steps = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const factor = steps[Math.min(index, steps.length - 1)];
  const small = Math.max(1, Math.round(config.small * factor));
  const big = Math.max(small, Math.round(config.big * factor));
  return { small, big, ante: index >= 6 ? Math.round(big / 10) : 0, index };
}

export type LobbyEntry = {
  id: string;
  title: string;
  mode: PublicConfig['mode'];
  seats: number;
  small: number;
  big: number;
  players: number;
  bots: number;
  online: number;
  status: 'WAITING' | 'RUNNING' | 'PAUSED' | 'FINISHED';
  locked: boolean;
  host: string;
  updated: number;
};
