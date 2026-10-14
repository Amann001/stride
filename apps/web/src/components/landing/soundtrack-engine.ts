// A running beat made live in the browser with the Web Audio API: drums, bass and chords,
// all synthesised, so there is no music file and nothing to license. Each start picks a
// key and small variations, so it is never quite the same twice.
//
// It also shows what the Stride app does with your own music: while the voice speaks
// ("1 kilometre..."), the music dips, then comes back up.

export type Vibe = { id: "easy" | "steady" | "sprint"; name: string; bpm: number; feel: string };

export const VIBES: Vibe[] = [
  { id: "easy", name: "Easy jog", bpm: 150, feel: "Warm chords, laid-back drums" },
  { id: "steady", name: "Steady run", bpm: 165, feel: "Four on the floor, rolling bass" },
  { id: "sprint", name: "Sprint", bpm: 180, feel: "Fast breaks, bright arpeggios" },
];

type State = { playing: boolean; vibe: Vibe; speaking: string | null };
type Listener = () => void;

// Semitones above A for each chord root, over a four-bar loop: i, VI, III, VII.
const PROGRESSION = [
  { root: 0, third: 3 },
  { root: -4, third: 4 },
  { root: 3, third: 4 },
  { root: -2, third: 4 },
];
const KEYS = [0, 2, -2, 3, -3]; // A, B, G, C, F# minor

const hz = (semisFromA2: number) => 110 * 2 ** (semisFromA2 / 12);

class Engine {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private step = 0;
  private nextTime = 0;
  private key = 0;
  private fills = new Set<number>();
  private unduckTimer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<Listener>();
  state: State = { playing: false, vibe: VIBES[1], speaking: null };

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState = () => this.state;
  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private setup() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.music = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.music.connect(comp).connect(this.out).connect(ctx.destination);
    this.out.connect(this.analyser);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.ctx = ctx;
    return ctx;
  }

  setVibe(vibe: Vibe) {
    this.set({ vibe });
  }

  async start(vibe = this.state.vibe) {
    const ctx = this.setup();
    if (ctx.state === "suspended") await ctx.resume();
    this.key = KEYS[Math.floor(Math.random() * KEYS.length)];
    this.fills = new Set([3, 7].filter(() => Math.random() > 0.3));
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.music!.gain.cancelScheduledValues(ctx.currentTime);
    this.music!.gain.setValueAtTime(0, ctx.currentTime);
    this.music!.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    this.set({ playing: true, vibe });
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    if (this.ctx && this.music) {
      const t = this.ctx.currentTime;
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.setValueAtTime(this.music.gain.value, t);
      this.music.gain.linearRampToValueAtTime(0, t + 0.3);
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.set({ playing: false, speaking: null });
  }

  // Speaks like the app's voice updates, with the music turned down underneath.
  say(text: string) {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.lang = "en-GB";
    const done = () => this.unduck();
    u.onend = done;
    u.onerror = done;
    this.duck();
    this.set({ speaking: text });
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    clearTimeout(this.unduckTimer);
    this.unduckTimer = setTimeout(done, 12000);
  }

  private duck() {
    if (!this.ctx || !this.music) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(this.state.playing ? 0.2 : 0, t + 0.18);
  }

  private unduck() {
    clearTimeout(this.unduckTimer);
    this.set({ speaking: null });
    if (!this.ctx || !this.music || !this.state.playing) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(1, t + 0.7);
  }

  private schedule() {
    const ctx = this.ctx!;
    const sixteenth = 60 / this.state.vibe.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.play(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  // One sixteenth note of the pattern for the current vibe.
  private play(step: number, t: number, len: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROGRESSION[bar];
    const root = this.key + chord.root;
    const fill = this.fills.has(bar) && s >= 12;
    const id = this.state.vibe.id;

    if (id === "easy") {
      if (s === 0 || s === 7 || s === 10) this.kick(t, 0.8);
      if (s === 4 || s === 12) this.snare(t, 0.35);
      if (s % 2 === 0) this.hat(t + (s % 4 === 2 ? len * 0.25 : 0), 0.12);
      if (s === 0) this.chord(t, root, chord.third, len * 15, "triangle", 0.11, 1400);
      if (s === 0 || s === 10) this.bass(t, root, len * 5, "triangle", 0.45);
      if (fill && s % 2 === 1) this.snare(t, 0.18);
    } else if (id === "steady") {
      if (s % 4 === 0) this.kick(t, 1);
      if (s === 4 || s === 12) this.snare(t, 0.4);
      if (s % 4 === 2) this.hat(t, 0.22, 0.12);
      else if (s % 2 === 1) this.hat(t, 0.07);
      if (s % 4 === 2) this.bass(t, root + 12, len * 1.6, "sawtooth", 0.3);
      if (s === 3 || s === 11) this.chord(t, root, chord.third, len * 1.5, "sawtooth", 0.07, 2600);
      if (fill) this.snare(t, 0.12 + (s - 12) * 0.06);
    } else {
      if (s === 0 || s === 10) this.kick(t, 1);
      if (s === 4 || s === 12 || (s === 15 && bar % 2)) this.snare(t, 0.45);
      this.hat(t, s % 2 ? 0.06 : 0.12);
      if (s === 0) this.bass(t, root, len * 14, "sawtooth", 0.35);
      const arp = [0, chord.third, 7, 12][s % 4] + (s >= 8 ? 12 : 0);
      this.lead(t, root + 24 + arp, len * 0.9, 0.06);
      if (fill && s % 2 === 0) this.snare(t, 0.2);
    }
  }

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.music!);
    return g;
  }

  private kick(t: number, v: number) {
    const o = this.ctx!.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(this.env(t, v, 0.003, 0.32));
    o.start(t);
    o.stop(t + 0.4);
  }

  private noiseHit(t: number, v: number, decay: number, type: BiquadFilterType, freq: number) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.env(t, v, 0.002, decay));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  private hat(t: number, v: number, decay = 0.04) {
    this.noiseHit(t, v, decay, "highpass", 7500);
  }

  private snare(t: number, v: number) {
    this.noiseHit(t, v, 0.16, "bandpass", 1900);
    const o = this.ctx!.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(190, t);
    o.connect(this.env(t, v * 0.6, 0.002, 0.08));
    o.start(t);
    o.stop(t + 0.12);
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, v: number, cutoff: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = this.ctx!.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + dur);
    o.connect(f).connect(this.env(t, v, 0.01, dur));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bass(t: number, semis: number, dur: number, type: OscillatorType, v: number) {
    this.tone(t, hz(semis - 12), dur, type, v, 700);
  }

  private chord(t: number, semis: number, third: number, dur: number, type: OscillatorType, v: number, cutoff: number) {
    for (const n of [0, third, 7, 12]) {
      this.tone(t, hz(semis + n + 12) * (1 + (Math.random() - 0.5) * 0.004), dur, type, v, cutoff);
    }
  }

  private lead(t: number, semis: number, dur: number, v: number) {
    this.tone(t, hz(semis), dur, "square", v, 3200);
  }
}

// One engine for the whole page, so the beat keeps playing while you scroll and the run
// tracker can speak the kilometres over it.
export const soundtrack = new Engine();
