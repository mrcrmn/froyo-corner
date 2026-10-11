import { audioCtx } from './sfx';

/**
 * Generative, ruhige Lo-Fi-Musik (komplett im Browser synthetisiert – keine Lizenzfragen).
 * Optional kann eine eigene (z.B. CC0-)Datei unter public/music/track.mp3 abgespielt werden.
 */
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// Akkordfolgen (MIDI-Noten), jeweils 1 Takt pro Akkord
const PROGRESSIONS: number[][][] = [
  [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], // Fmaj7 Em7 Dm7 Cmaj7
  [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]], // Dm7 G7 Cmaj7 Am7
  [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]], // Am7 Fmaj7 Cmaj7 Gmaj7
  [[52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65]], // Em7 Am7 Dm7 G7
];
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79];

export class Music {
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private prog = PROGRESSIONS[0];
  private bpm = 72;
  private noise: AudioBuffer | null = null;
  private crackle: AudioBufferSourceNode | null = null;
  private fileEl: HTMLAudioElement | null = null;
  volume = 0.5;
  source: 'generativ' | 'datei' = 'generativ';
  playing = false;
  onFileError: (() => void) | null = null;

  start(): void {
    if (this.playing) return;
    this.playing = true;
    if (this.source === 'datei') {
      this.startFile();
      return;
    }
    const ac = audioCtx();
    if (ac.state === 'suspended') void ac.resume();
    this.gain = ac.createGain();
    this.gain.gain.value = this.volume * 0.35;
    this.filter = ac.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2400;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.gain).connect(ac.destination);
    const len = ac.sampleRate * 2;
    this.noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startCrackle(ac);
    this.nextTime = ac.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private startFile(): void {
    this.fileEl = new Audio('music/track.mp3');
    this.fileEl.loop = true;
    this.fileEl.volume = this.volume;
    this.fileEl.play().catch(() => {
      this.fileEl = null;
      this.playing = false;
      this.source = 'generativ';
      this.onFileError?.();
      this.start();
    });
    this.fileEl.onerror = () => {
      this.fileEl = null;
      this.playing = false;
      this.source = 'generativ';
      this.onFileError?.();
      this.start();
    };
  }

  stop(): void {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.crackle?.stop();
    this.crackle = null;
    if (this.gain) this.gain.disconnect();
    this.gain = null;
    if (this.fileEl) { this.fileEl.pause(); this.fileEl = null; }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v * 0.35;
    if (this.fileEl) this.fileEl.volume = v;
  }

  setSource(src: 'generativ' | 'datei'): void {
    if (src === this.source) return;
    const was = this.playing;
    this.stop();
    this.source = src;
    if (was) this.start();
  }

  private startCrackle(ac: AudioContext): void {
    // Vinyl-Knistern: leises Rauschen + seltene Knackser
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.012;
      if (Math.random() < 0.0004) d[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3000;
    src.connect(f).connect(this.gain!);
    src.start();
    this.crackle = src;
  }

  private schedule(): void {
    const ac = audioCtx();
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextTime < ac.currentTime + 0.2) {
      this.playStep(this.nextTime, this.step);
      // Swing
      const swing = this.step % 2 === 0 ? 1.18 : 0.82;
      this.nextTime += sixteenth * swing;
      this.step++;
      if (this.step % 16 === 0) {
        this.bar++;
        if (this.bar % 8 === 0) this.prog = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)];
      }
    }
  }

  private playStep(t: number, step: number): void {
    const s = step % 16;
    const chord = this.prog[this.bar % this.prog.length];
    const beatLen = 60 / this.bpm;
    // Akkorde (Rhodes-artig)
    if (s === 0) chord.forEach((n, i) => this.rhodes(midi(n), t + i * 0.012, beatLen * 3.6, 0.07));
    if (s === 10 && Math.random() < 0.5) chord.slice(1).forEach((n) => this.rhodes(midi(n + 12), t, beatLen * 1.2, 0.035));
    // Bass
    if (s === 0) this.bass(midi(chord[0] - 12), t, beatLen * 1.8);
    if (s === 11 && Math.random() < 0.6) this.bass(midi(chord[2] - 24), t, beatLen * 0.8);
    // Drums
    if (s === 0 || (s === 10 && Math.random() < 0.7)) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
    // Melodie (sparsam)
    if (s % 4 === 0 && Math.random() < 0.28) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      this.bell(midi(n), t, beatLen * 1.5);
    }
  }

  private env(t: number, dur: number, peak: number): GainNode {
    const ac = audioCtx();
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private rhodes(f: number, t: number, dur: number, vol: number): void {
    const ac = audioCtx();
    const car = ac.createOscillator();
    const mod = ac.createOscillator();
    const modG = ac.createGain();
    car.frequency.value = f * (1 + (Math.random() - 0.5) * 0.003);
    mod.frequency.value = f * 2;
    modG.gain.setValueAtTime(f * 1.2, t);
    modG.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
    mod.connect(modG).connect(car.frequency);
    const g = this.env(t, dur, vol);
    car.connect(g).connect(this.filter!);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  }

  private bell(f: number, t: number, dur: number): void {
    const ac = audioCtx();
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = this.env(t, dur, 0.035);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private bass(f: number, t: number, dur: number): void {
    const ac = audioCtx();
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = this.env(t, dur, 0.16);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private kick(t: number): void {
    const ac = audioCtx();
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    const g = this.env(t, 0.3, 0.32);
    o.connect(g).connect(this.filter!);
    o.start(t);
    o.stop(t + 0.35);
  }

  private snare(t: number): void {
    const ac = audioCtx();
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = this.env(t, 0.18, 0.09);
    src.connect(f).connect(g).connect(this.filter!);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  private hat(t: number, vol: number): void {
    const ac = audioCtx();
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.env(t, 0.05, vol);
    src.connect(f).connect(g).connect(this.filter!);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }
}
