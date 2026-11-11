// Tiny WebAudio synth. Every sound is generated: no asset files.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.last = new Map();
    this.enabled = true;
    this.volume = 0.5;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.output = comp; // recordings tap the mix here
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  tone(type, f0, f1, dur, gain, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(dur, gain, freq, q = 1, type = 'lowpass') {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.5 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.25), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // a slow swell: organ pipes and strings
  pad(type, f, dur, gain, attack = 1.2, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t); lp.type = 'lowpass'; lp.frequency.value = type === 'sawtooth' ? 1400 : 4000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.setValueAtTime(gain, t + Math.max(attack, dur - 1.5)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  // The ending narration's music (Milestone 22): a slow organ and strings under ticking clocks,
  // and each scene's own sound (fire, the Horologe's pendulum, the Twain singing, wind, the sea).
  narration(on) {
    clearInterval(this.nTimer); clearInterval(this.sTimer); this.nTimer = this.sTimer = null;
    if (!on || !this.ctx || !this.enabled) return;
    // D minor, B flat, F, C: slow, and then again
    const chords = [[146.8, 220, 293.7, 349.2], [116.5, 174.6, 233.1, 293.7], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6]];
    let k = 0, beat = 0;
    const chord = () => { const ch = chords[k++ % chords.length]; ch.forEach((f, i) => { this.pad('triangle', f, 7.5, i ? 0.018 : 0.03, 1.8); this.pad('sawtooth', f * 2, 7.5, 0.006, 2.5, 0.2); }); };
    chord();
    this.nTimer = setInterval(() => { beat++; if (beat % 7 === 0) chord(); this.burst(0.02, 0.025, 4200, 5, 'bandpass'); }, 1000);
  }
  narrationScene(sound, dark = false) {
    clearInterval(this.sTimer); this.sTimer = null;
    if (!this.ctx || !this.enabled) return;
    let n = 0;
    const each = {
      fire: () => { this.burst(0.5, 0.05, 600, 0.8); if (n % 3 === 0) this.burst(0.15, 0.04, 1800, 2, 'bandpass'); },
      pendulum: () => { this.burst(0.03, 0.06, n % 2 ? 2600 : 1900, 8, 'bandpass'); },
      sing: () => { if (n % 5 === 0) this.play('twain', 0.7); },
      wind: () => { if (n % 3 === 0) this.burst(2.4, 0.03, 500, 0.6); },
      sea: () => { if (n % 4 === 0) this.burst(3.5, 0.035, 380, 0.5); },
    }[sound];
    // a scene he can't remember: only a faint scratching
    const fn = dark ? () => { if (n % 2 === 0) this.burst(0.08, 0.02, 3000, 3, 'bandpass'); } : each;
    if (!fn) return;
    this.sTimer = setInterval(() => { n++; fn(); }, sound === 'pendulum' && !dark ? 1000 : 700);
  }

  play(name, vol = 1) {
    if (!this.ctx || !this.enabled || vol < 0.03) return;
    const now = performance.now();
    const gap = { shard: 60, beam: 70, blast: 120, impact: 90, explode: 80, collapse: 300, deposit: 250, alert: 4000, storm: 1500, comm: 300,
      cannon: 45, pulse: 60, flak: 70, plasma: 110, lance: 180, torpedo: 150, bite: 90, boom: 70, 'boom-big': 220, hit: 50, key: 35, hiss: 600, clank: 200, organ: 1500 }[name] || 40;
    if (now - (this.last.get(name) || 0) < gap) return;
    this.last.set(name, now);
    const v = vol;
    switch (name) {
      case 'select': this.tone('sine', 880, 1320, 0.07, 0.12 * v); break;
      case 'order': this.tone('triangle', 660, 520, 0.08, 0.14 * v); this.tone('triangle', 990, 780, 0.08, 0.1 * v, 0.06); break;
      case 'error': this.tone('square', 200, 150, 0.18, 0.08 * v); break;
      case 'place': this.tone('sine', 440, 880, 0.2, 0.15 * v); this.burst(0.2, 0.08 * v, 3000, 2, 'bandpass'); break;
      case 'complete': [523, 659, 784].forEach((f, i) => this.tone('sine', f, f, 0.22, 0.12 * v, i * 0.09)); break;
      case 'ready': this.tone('sine', 740, 990, 0.12, 0.1 * v); break;
      case 'deposit': this.tone('sine', 1200, 1800, 0.05, 0.04 * v); break;
      case 'alert': this.tone('sawtooth', 330, 330, 0.18, 0.08 * v); this.tone('sawtooth', 247, 247, 0.25, 0.08 * v, 0.2); break;
      case 'shard': this.burst(0.06, 0.12 * v, 6000, 3, 'bandpass'); break;
      case 'beam': this.tone('sawtooth', 1400, 300, 0.14, 0.06 * v); break;
      case 'blast': this.burst(0.25, 0.25 * v, 900); this.tone('sine', 120, 50, 0.25, 0.2 * v); break;
      case 'impact': this.burst(0.4, 0.3 * v, 1400); break;
      case 'explode': this.burst(0.5, 0.35 * v, 1800); this.tone('sine', 90, 40, 0.4, 0.25 * v); break;
      case 'storm': this.burst(2.5, 0.18 * v, 700, 0.7); this.burst(2.0, 0.08 * v, 4000, 1.5, 'bandpass'); break;
      case 'comm': this.tone('sine', 1320, 1320, 0.05, 0.06 * v); this.tone('sine', 1760, 1760, 0.05, 0.05 * v, 0.07); break;
      // Milestone 23, the brass age: a telegraph key, steam from a valve, iron plates, the memory organ
      case 'key': this.burst(0.018, 0.05 * v, 3400, 7, 'bandpass'); this.tone('square', 1900, 1700, 0.012, 0.01 * v); break;
      case 'hiss': this.burst(0.9, 0.07 * v, 5200, 0.9, 'highpass'); this.burst(0.5, 0.04 * v, 2400, 1.2, 'bandpass'); break;
      case 'clank': this.burst(0.06, 0.12 * v, 1400, 4, 'bandpass'); [180, 412, 690].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.35, (0.05 - i * 0.012) * v)); break;
      case 'organ': [131, 196, 262, 330, 392].forEach((f, i) => { this.tone('triangle', f, f, 2.2, 0.035 * v, 0.02 * i); this.tone('sine', f * 2, f * 2, 2.0, 0.012 * v, 0.02 * i); }); break;
      // the voyage
      case 'rankup': [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.09 * v, i * 0.07)); break;
      case 'stitch': this.tone('sine', 180, 1400, 0.55, 0.1 * v); this.burst(0.6, 0.08 * v, 2600, 1.2, 'bandpass'); this.tone('sine', 1400, 300, 0.4, 0.05 * v, 0.5); break;
      case 'event': [392, 523, 659].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.5, 0.06 * v, i * 0.12)); break;
      // All hands: a brass bell, then a short organ chord
      case 'allhands': [1568, 1568 * 2.76].forEach((f, i) => this.tone('sine', f, f, 1.4, (i ? 0.03 : 0.08) * v)); [262, 330, 392, 523].forEach((f) => this.tone('triangle', f, f, 1.2, 0.05 * v, 0.35)); break;
      // a clock tick, faint: a Hand is near
      case 'tick': this.burst(0.025, 0.05 * v, 5200, 6, 'bandpass'); this.tone('square', 2400, 2300, 0.015, 0.012 * v); break;
      // something wet being born, and a demon's death
      case 'birth': this.burst(0.25, 0.06 * v, 380, 1.4); this.tone('sine', 160, 70, 0.3, 0.06 * v); break;
      case 'hand': [98, 147].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 1.6, 0.05 * v, i * 0.4)); this.burst(1.2, 0.08 * v, 300, 0.6); break;
      // the Twain sings: two cold, beating tones that never quite agree
      case 'twain': [523.25, 529.5, 784, 791].forEach((f, i) => this.tone('sine', f, f, 2.4, (i < 2 ? 0.05 : 0.025) * v, i * 0.05)); break;
      case 'deal': this.tone('triangle', 880, 1320, 0.08, 0.09 * v); this.tone('triangle', 1320, 1760, 0.1, 0.07 * v, 0.08); break;
      case 'hint': this.tone('sine', 988, 988, 0.08, 0.05 * v); this.tone('sine', 1319, 1319, 0.12, 0.05 * v, 0.09); break;
      case 'objective': [659, 880].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.1 * v, i * 0.1)); break;
      case 'collapse': this.burst(1.2, 0.5 * v, 1200); this.tone('sine', 70, 30, 1.0, 0.35 * v); break;
      // weapons and destruction
      case 'cannon': this.burst(0.05, 0.1 * v, 3200, 2, 'bandpass'); break;
      case 'pulse': this.tone('square', 520, 180, 0.09, 0.05 * v); this.burst(0.07, 0.06 * v, 1800); break;
      case 'flak': this.burst(0.12, 0.14 * v, 900); break;
      case 'plasma': this.tone('sine', 260, 90, 0.3, 0.12 * v); this.tone('triangle', 900, 300, 0.2, 0.05 * v); break;
      // the lightning lance: a crackle over a falling zap, and the thump of the capacitors
      case 'lance': this.burst(0.35, 0.12 * v, 4800, 0.7, 'highpass'); [0, 0.06, 0.13].forEach((d) => this.tone('sawtooth', 1800 + d * 4000, 300, 0.12, 0.05 * v, d)); this.tone('sine', 140, 60, 0.5, 0.12 * v); break;
      case 'torpedo': this.burst(0.5, 0.08 * v, 700, 0.8); this.tone('sine', 180, 320, 0.4, 0.05 * v); break;
      case 'bite': this.burst(0.08, 0.12 * v, 500, 3, 'bandpass'); this.tone('square', 90, 60, 0.08, 0.06 * v); break;
      case 'hit': this.burst(0.06, 0.07 * v, 2400, 1.5, 'bandpass'); break;
      case 'boom': this.burst(0.6, 0.3 * v, 1500); this.tone('sine', 110, 40, 0.5, 0.22 * v); break;
      case 'boom-big': this.burst(1.6, 0.45 * v, 900, 0.7); this.tone('sine', 70, 25, 1.4, 0.35 * v); this.burst(0.8, 0.2 * v, 3000, 1, 'bandpass'); break;
    }
  }
}
