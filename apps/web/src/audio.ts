import { prefsStore } from './store.ts';

/**
 * Sons da mesa sintetizados na hora (sem baixar arquivos): ruído filtrado para carta e
 * baralho, estalos curtos para ficha, sinos para a vez e a vitória.
 */
export type Sound =
  | 'deal'
  | 'flip'
  | 'chip'
  | 'chips'
  | 'check'
  | 'fold'
  | 'turn'
  | 'tick'
  | 'win'
  | 'lose'
  | 'join'
  | 'message'
  | 'click';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** Chame dentro de um gesto do usuário para liberar o áudio do navegador. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
  } catch {
    /* sem suporte a áudio */
  }
}
if (typeof window !== 'undefined')
  for (const event of ['pointerdown', 'keydown'])
    window.addEventListener(event, unlockAudio, { once: true, passive: true });

function noise(at: number, duration: number, freq: number, q: number, gain: number, sweep = 0) {
  if (!ctx || !master || !noiseBuffer) return;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, at);
  if (sweep)
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), at + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(env).connect(master);
  source.start(at, Math.random() * 0.5, duration + 0.02);
}

function tone(
  at: number,
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
  slide = 0,
) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), at + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(env).connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** Um estalo de ficha: dois cliques metálicos curtos com ruído agudo. */
function chipClick(at: number, gain = 0.22) {
  const f = 2300 + Math.random() * 900;
  tone(at, f, 0.05, gain * 0.5, 'triangle', 0.6);
  tone(at + 0.004, f * 1.5, 0.04, gain * 0.3, 'sine', 0.7);
  noise(at, 0.035, 5200, 3, gain * 0.9);
}

const recipes: Record<Sound, (t: number) => void> = {
  deal: (t) => noise(t, 0.09, 2600, 0.9, 0.3, 0.45),
  flip: (t) => {
    noise(t, 0.12, 1800, 0.8, 0.28, 2.4);
    noise(t + 0.05, 0.06, 3600, 1.2, 0.12);
  },
  chip: (t) => chipClick(t),
  chips: (t) => {
    chipClick(t, 0.2);
    chipClick(t + 0.045, 0.18);
    chipClick(t + 0.095, 0.16);
    chipClick(t + 0.14, 0.14);
  },
  check: (t) => {
    tone(t, 190, 0.09, 0.4, 'sine', 0.55);
    noise(t, 0.04, 900, 1, 0.12);
    tone(t + 0.11, 170, 0.09, 0.32, 'sine', 0.55);
  },
  fold: (t) => noise(t, 0.2, 2200, 0.7, 0.22, 0.25),
  turn: (t) => {
    tone(t, 880, 0.5, 0.12);
    tone(t, 1320, 0.45, 0.06);
    tone(t + 0.14, 1174.7, 0.6, 0.14);
    tone(t + 0.14, 1762, 0.5, 0.05);
  },
  tick: (t) => tone(t, 1500, 0.04, 0.08, 'square'),
  win: (t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(t + i * 0.09, f, 0.7, 0.13, 'triangle');
      tone(t + i * 0.09, f * 2, 0.5, 0.04);
    });
    for (let i = 0; i < 6; i++) chipClick(t + 0.34 + i * 0.05, 0.12);
  },
  lose: (t) => {
    tone(t, 311, 0.35, 0.12, 'triangle', 0.8);
    tone(t + 0.16, 233, 0.5, 0.12, 'triangle', 0.8);
  },
  join: (t) => {
    tone(t, 660, 0.12, 0.09);
    tone(t + 0.07, 990, 0.16, 0.08);
  },
  message: (t) => {
    tone(t, 740, 0.08, 0.08);
    tone(t + 0.06, 988, 0.12, 0.07);
  },
  click: (t) => noise(t, 0.03, 3000, 2, 0.12),
};

const lastPlayed: Partial<Record<Sound, number>> = {};
/** Toca um efeito; `delay` (s) agenda para o futuro, útil em sequências como distribuir cartas. */
export function playSound(sound: Sound, delay = 0) {
  const prefs = prefsStore.get();
  if (!prefs.sound || !ctx || !master || ctx.state !== 'running') return;
  const now = performance.now();
  if (delay === 0 && now - (lastPlayed[sound] ?? 0) < 40) return;
  lastPlayed[sound] = now;
  master.gain.value = Math.min(1, Math.max(0, prefs.volume)) * 0.9;
  recipes[sound](ctx.currentTime + 0.005 + delay);
}
