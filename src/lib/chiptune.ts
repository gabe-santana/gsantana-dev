// Tiny 8-bit synth for the 404 game: an original dungeon loop, jingles and
// sound effects, generated live with the Web Audio API (square/triangle
// waves + noise, like old consoles). No audio files, nothing to license.
//
// Browsers only allow audio after a user gesture, so nothing is created
// until the first call made from a click/keypress (starting the game).

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

type Step = [note: number | null, length: number];

// Original composition, A minor, in eighth notes (8 per bar, 8 bars).
const MELODY: Step[] = [
  [69, 2],
  [72, 1],
  [76, 1],
  [74, 2],
  [72, 1],
  [71, 1],
  [69, 2],
  [64, 2],
  [69, 1],
  [71, 1],
  [72, 2],
  [74, 2],
  [77, 1],
  [76, 1],
  [74, 2],
  [72, 1],
  [74, 1],
  [76, 4],
  [null, 2],
  [76, 1],
  [79, 1],
  [81, 2],
  [79, 1],
  [76, 1],
  [77, 2],
  [76, 1],
  [74, 1],
  [72, 2],
  [69, 2],
  [71, 1],
  [72, 1],
  [74, 2],
  [76, 2],
  [72, 1],
  [69, 1],
  [71, 2],
  [68, 2],
  [69, 4],
  [null, 4],
];
// Bass root per bar: Am Am Dm E F C E Am.
const BASS_ROOTS = [45, 45, 50, 40, 41, 48, 40, 45];
const LOOP_EIGHTHS = 64;
const BPM = 140;
const EIGHTH = 60 / BPM / 2;

// Melody events indexed by the eighth they start on.
const MELODY_AT = new Map<number, Step>();
{
  let at = 0;
  for (const step of MELODY) {
    MELODY_AT.set(at, step);
    at += step[1];
  }
}

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  dest?: AudioNode;
}

export class Chiptune {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private nextTime = 0;
  private step = 0;
  private muted = false;

  constructor(muted = false) {
    this.muted = muted;
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      const buffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate,
        this.ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    options: ToneOptions = {},
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const {
      type = "square",
      gain = 0.08,
      slideTo,
      dest = this.master,
    } = options;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo)
      osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    env.gain.setValueAtTime(gain, start + duration * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(dest);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private hiss(
    start: number,
    duration: number,
    gain: number,
    cutoff = 6000,
    dest?: AudioNode,
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src
      .connect(filter)
      .connect(env)
      .connect(dest ?? this.master);
    src.start(start);
    src.stop(start + duration + 0.02);
  }

  private jingle(steps: Step[], unit: number, options: ToneOptions) {
    const ctx = this.ensure();
    if (!ctx) return;
    let t = ctx.currentTime + 0.02;
    for (const [note, length] of steps) {
      if (note !== null)
        this.tone(midi(note), t, length * unit * 0.95, options);
      t += length * unit;
    }
  }

  // Look-ahead scheduler: every 50ms, queue the notes of the next 250ms.
  private schedule = () => {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const i = this.step % LOOP_EIGHTHS;
      const bar = Math.floor(i / 8);
      const melody = MELODY_AT.get(i);
      if (melody && melody[0] !== null) {
        this.tone(midi(melody[0]), this.nextTime, melody[1] * EIGHTH * 0.9, {
          gain: 0.045,
          dest: this.music,
        });
      }
      if (i % 2 === 0) {
        const root = BASS_ROOTS[bar]!;
        this.tone(
          midi(i % 4 === 0 ? root : root + 12),
          this.nextTime,
          EIGHTH * 1.8,
          {
            type: "triangle",
            gain: 0.12,
            dest: this.music,
          },
        );
      } else {
        this.hiss(this.nextTime, 0.03, 0.018, 7000, this.music);
      }
      this.nextTime += EIGHTH;
      this.step++;
    }
  };

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopMusic();
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
    this.schedule();
    this.timer = window.setInterval(this.schedule, 50);
  }

  /** Stops the loop immediately, including notes already queued. */
  stopMusic() {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.music?.disconnect();
    this.music = null;
  }

  chest() {
    this.jingle(
      [
        [72, 1],
        [76, 1],
        [79, 1],
        [84, 1],
        [88, 4],
      ],
      0.075,
      { gain: 0.07 },
    );
    this.jingle(
      [
        [60, 1],
        [64, 1],
        [67, 1],
        [72, 1],
        [76, 4],
      ],
      0.075,
      { type: "triangle", gain: 0.12 },
    );
  }

  mimic() {
    this.jingle(
      [
        [64, 1],
        [63, 1],
        [62, 1],
        [61, 1],
        [52, 6],
      ],
      0.085,
      { gain: 0.07 },
    );
    const ctx = this.ensure();
    if (ctx) this.hiss(ctx.currentTime + 0.35, 0.45, 0.06, 900);
  }

  win() {
    this.jingle(
      [
        [67, 1],
        [72, 1],
        [76, 1],
        [79, 2],
        [76, 1],
        [79, 6],
      ],
      0.11,
      { gain: 0.07 },
    );
    this.jingle(
      [
        [48, 2],
        [52, 2],
        [55, 2],
        [60, 6],
      ],
      0.11,
      { type: "triangle", gain: 0.13 },
    );
  }

  lose() {
    this.jingle(
      [
        [64, 2],
        [63, 2],
        [62, 2],
        [61, 6],
      ],
      0.17,
      { type: "triangle", gain: 0.13 },
    );
    this.jingle(
      [
        [52, 2],
        [51, 2],
        [50, 2],
        [49, 6],
      ],
      0.17,
      { gain: 0.04 },
    );
  }

  swing() {
    const ctx = this.ensure();
    if (ctx) this.hiss(ctx.currentTime, 0.07, 0.05, 3000);
  }

  hit() {
    const ctx = this.ensure();
    if (ctx)
      this.tone(880, ctx.currentTime, 0.09, { slideTo: 330, gain: 0.06 });
  }

  hurt() {
    const ctx = this.ensure();
    if (ctx)
      this.tone(330, ctx.currentTime, 0.25, { slideTo: 110, gain: 0.08 });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.5,
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
