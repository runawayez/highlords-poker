import { z } from 'zod';
export const ProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\p{N}_ .-]+$/u),
  avatar: z.enum(['♠', '♣', '♦', '♥', '☠', '♜', '⚔', '☾']).default('♠'),
  avatarImage: z
    .string()
    .max(8192)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional(),
  frame: z.enum(['plain', 'red', 'gold']).default('plain'),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#df3449'),
  tagline: z.string().max(80).default(''),
});
export type Profile = z.infer<typeof ProfileSchema>;
const chips = z.number().int().min(1).max(10000000);
export const LevelSchema = z
  .object({
    small: chips,
    big: chips,
    ante: z.number().int().min(0).max(100000),
    minutes: z.number().int().min(1).max(120),
    breakMinutes: z.number().int().min(0).max(60).default(0),
  })
  .refine((l) => l.small <= l.big);
export const ConfigSchema = z
  .object({
    title: z.string().trim().min(3).max(50),
    password: z.string().max(64).default(''),
    mode: z.enum(['CASH', 'SIT_AND_GO', 'TOURNAMENT']),
    seats: z.number().int().min(2).max(9),
    capacity: z.number().int().min(2).max(90).default(18),
    stack: chips,
    small: chips,
    big: chips,
    ante: z.number().int().min(0).max(100000).default(0),
    minBuyIn: chips.default(1000),
    maxBuyIn: chips.default(10000),
    buyIn: chips.default(1000),
    rebuy: z.boolean().default(true),
    rebuyLimit: z.number().int().min(0).max(20).default(3),
    rebuyUntil: z.number().int().min(0).max(30).default(3),
    addOn: chips.default(3000),
    addOnLevel: z.number().int().min(0).max(30).default(3),
    lateLevels: z.number().int().min(0).max(30).default(2),
    turnSeconds: z.number().int().min(10).max(120).default(25),
    timeBank: z.number().int().min(0).max(120).default(30),
    levels: z.array(LevelSchema).min(1).max(30),
  })
  .refine(
    (c) =>
      c.small <= c.big &&
      c.minBuyIn <= c.maxBuyIn &&
      c.stack >= c.minBuyIn &&
      c.stack <= c.maxBuyIn,
    'Invalid blinds/buy-in range',
  );
export type Config = z.infer<typeof ConfigSchema>;
export const CommandSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  version: z.number().int().nonnegative().optional(),
  type: z.enum([
    'CREATE',
    'CLOSE_ROOM',
    'ADD_BOTS',
    'REMOVE_BOT',
    'JOIN',
    'SPECTATE',
    'LEAVE',
    'START',
    'PAUSE',
    'RESUME',
    'ACT',
    'SIT_OUT',
    'TOP_UP',
    'ADD_ON',
    'TIME_BANK',
    'CHAT',
    'REACT',
    'MODERATE',
    'REPORT',
    'EXPORT',
  ]),
  payload: z.record(z.unknown()).default({}),
});
export type Command = z.infer<typeof CommandSchema>;
export const ChatSchema = z.string().trim().min(1).max(300);
