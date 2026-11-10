/** Small original synthesised effects; no audio asset downloads or external dependencies. */
export type TableSound = 'deal' | 'chip' | 'turn' | 'message' | 'win' | 'enable';
let context: AudioContext | null = null;
let lastSound = 0;
export function primeTableAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
  } catch {
    // Unsupported browser, disabled audio hardware, or autoplay protection.
  }
}
export function playTableSound(kind: TableSound) {
  if (!context || context.state !== 'running') return;
  const time = performance.now();
  if (time - lastSound < 80) return;
  lastSound = time;
  const voice = (frequency: number, offset: number, duration: number, volume: number, type: OscillatorType) => {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, context.currentTime + offset);
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(context.currentTime + offset);
    osc.stop(context.currentTime + offset + duration + 0.012);
  };
  switch (kind) {
    case 'deal':
      voice(385, 0, 0.065, 0.018, 'triangle');
      voice(310, 0.075, 0.055, 0.014, 'triangle');
      break;
    case 'chip':
      voice(720, 0, 0.075, 0.017, 'sine');
      voice(1030, 0.025, 0.055, 0.011, 'sine');
      break;
    case 'message':
      voice(700, 0, 0.055, 0.012, 'sine');
      voice(960, 0.06, 0.09, 0.012, 'sine');
      break;
    case 'turn':
      voice(540, 0, 0.11, 0.022, 'sine');
      voice(810, 0.12, 0.12, 0.025, 'sine');
      break;
    case 'win':
      voice(520, 0, 0.18, 0.025, 'sine');
      voice(660, 0.12, 0.18, 0.024, 'sine');
      voice(780, 0.24, 0.29, 0.027, 'sine');
      break;
    case 'enable':
      voice(620, 0, 0.09, 0.02, 'sine');
      break;
  }
}
