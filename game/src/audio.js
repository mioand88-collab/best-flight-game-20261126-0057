// Skyline Courier — sound, synthesised, no audio files.
// The engine is two detuned oscillators through a low-pass filter, the
// wind is filtered noise, and the chimes are short sine blips. Nothing
// is loaded from anywhere: every sound is made by the Web Audio API at
// run time, so the game still has no network request.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.muted = false;
    this.started = false;
  }

  // Browsers only let audio start after a gesture, so the game calls
  // this from the first key press or click, never on load.
  ensure() {
    if (this.started) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.buildEngine();
      this.buildWind();
      this.started = true;
    } catch {
      this.started = false;
    }
  }

  buildEngine() {
    const ctx = this.ctx;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 62;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 31;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  buildWind() {
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();
  }

  // Called every frame: the engine follows the throttle, the wind
  // follows the airspeed.
  update(plane) {
    if (!this.started || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;
    const throttle = plane.throttle;
    const engineLevel = this.muted ? 0 : 0.05 + throttle * 0.11;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    this.engineOsc1.frequency.setTargetAtTime(58 + throttle * 66, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(29 + throttle * 33, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + throttle * 700, t, 0.1);
    const windLevel = this.muted ? 0 : Math.max(0, (plane.speed - 25) / 220);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(380 + plane.speed * 9, t, 0.15);
  }

  blip(frequency = 880, duration = 0.14, type = 'sine', level = 0.22) {
    if (!this.started || !this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  ringChime() {
    this.blip(880, 0.16);
    setTimeout(() => this.blip(1318, 0.22), 90);
  }

  thud() {
    this.blip(70, 0.3, 'triangle', 0.4);
  }

  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.3), i * 110));
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
