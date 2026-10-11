/** Gemeinsamer Audio-Kontext + kleine Synth-Soundeffekte. */
let ctxSingleton: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!ctxSingleton) ctxSingleton = new AudioContext();
  return ctxSingleton;
}

export type SfxName =
  | 'coin' | 'pop' | 'happy' | 'wrong' | 'slap' | 'munch' | 'bell' | 'pour' | 'sizzle' | 'click' | 'place' | 'trash' | 'ding' | 'buy';

export class Sfx {
  volume = 0.7;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private ensure(): { ac: AudioContext; out: GainNode } {
    const ac = audioCtx();
    if (!this.out) {
      this.out = ac.createGain();
      this.out.connect(ac.destination);
      const len = ac.sampleRate;
      this.noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    this.out.gain.value = this.volume * 0.5;
    return { ac, out: this.out };
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    const { ac, out } = this.ensure();
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, filter: BiquadFilterType, freq: number, vol: number, when = 0): void {
    const { ac, out } = this.ensure();
    const t = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  play(name: SfxName): void {
    if (this.volume <= 0) return;
    try {
      switch (name) {
        case 'coin':
          this.tone(988, 0.08, 'square', 0.12);
          this.tone(1319, 0.25, 'square', 0.12, 0.07);
          break;
        case 'buy':
          this.tone(660, 0.08, 'triangle', 0.25);
          this.tone(880, 0.08, 'triangle', 0.25, 0.08);
          this.tone(1320, 0.2, 'triangle', 0.25, 0.16);
          break;
        case 'pop':
          this.tone(500, 0.08, 'sine', 0.35, 0, 900);
          break;
        case 'click':
          this.tone(1200, 0.03, 'square', 0.06);
          break;
        case 'place':
          this.tone(220, 0.12, 'triangle', 0.35, 0, 120);
          this.noiseBurst(0.06, 'lowpass', 900, 0.2);
          break;
        case 'happy':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, i * 0.07));
          break;
        case 'wrong':
          this.tone(300, 0.18, 'sawtooth', 0.12, 0, 200);
          this.tone(200, 0.3, 'sawtooth', 0.12, 0.16, 140);
          break;
        case 'slap':
          this.noiseBurst(0.12, 'bandpass', 2400, 0.9);
          this.tone(180, 0.1, 'sine', 0.4, 0, 80);
          break;
        case 'munch':
          for (let i = 0; i < 3; i++) this.noiseBurst(0.05, 'bandpass', 1500 + i * 300, 0.35, i * 0.09);
          break;
        case 'bell':
          this.tone(1568, 0.6, 'sine', 0.2);
          this.tone(2093, 0.8, 'sine', 0.12, 0.02);
          break;
        case 'ding':
          this.tone(1760, 0.4, 'sine', 0.18);
          break;
        case 'pour':
          this.noiseBurst(0.7, 'lowpass', 700, 0.25);
          break;
        case 'sizzle':
          this.noiseBurst(1.0, 'highpass', 4000, 0.18);
          break;
        case 'trash':
          this.noiseBurst(0.2, 'lowpass', 500, 0.5);
          this.tone(120, 0.15, 'square', 0.1);
          break;
      }
    } catch {
      /* Audio nicht verfügbar */
    }
  }
}
