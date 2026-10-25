/**
 * افکت‌های صوتی — همه با WebAudio ساخته می‌شوند؛ هیچ فایل صوتی external لازم نیست.
 * صدای چوب تخته، تاس، مهره، زنگِ تی بسته‌شده و سکهٔ نقد.
 */
let ctx = null, master = null, noise = null;
let on = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 1.2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(v) { on = !!v; if (v) ac(); }
export function soundEnabled() { return on; }

function env(node, t0, a, d, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  node.connect(g);
  return g;
}

function burst({ freq = 1200, q = 3, dur = 0.09, peak = 0.5, type = 'bandpass', decay = 1.6, gain = 1 }) {
  const c = ac(); if (!c || !on) return;
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq * (0.9 + Math.random() * 0.25); f.Q.value = q;
  const g = env(f, t0, 0.004, dur * decay, peak);
  g.gain.value *= gain;
  g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

function tone({ freq = 440, dur = 0.3, type = 'sine', peak = 0.25, delay = 0, slide = 0, gain = 1 }) {
  const c = ac(); if (!c || !on) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  const g = env(o, t0, 0.01, dur, peak);
  g.gain.value *= gain;
  g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.08);
}

export const sfx = {
  /** تاس روی چوب */
  roll() {
    for (let i = 0; i < 7; i++) {
      const t = i * 0.055 + Math.random() * 0.02;
      setTimeout(() => burst({ freq: 900 + Math.random() * 900, q: 2.2, dur: 0.05, peak: 0.22 * (1 - i / 9) }), t * 1000);
    }
  },
  clack() { burst({ freq: 2100, q: 5, dur: 0.05, peak: 0.3 }); burst({ freq: 300, q: 1.2, dur: 0.06, peak: 0.16 }); },
  tap() { burst({ freq: 1500, q: 2.5, dur: 0.035, peak: 0.17 }); tone({ freq: 190, dur: 0.07, type: 'triangle', peak: 0.1 }); },
  hit() { burst({ freq: 480, q: 1.1, dur: 0.12, peak: 0.5, decay: 2.2 }); tone({ freq: 130, dur: 0.16, type: 'sine', peak: 0.3, slide: -60 }); },
  point() { tone({ freq: 1180, dur: 0.5, type: 'sine', peak: 0.16 }); tone({ freq: 1770, dur: 0.42, type: 'sine', peak: 0.09, delay: 0.03 }); },
  enter() { tone({ freq: 640, dur: 0.16, type: 'triangle', peak: 0.13 }); },
  coin() { tone({ freq: 1560, dur: 0.1, type: 'square', peak: 0.06 }); tone({ freq: 2340, dur: 0.14, type: 'square', peak: 0.05, delay: 0.05 }); },
  win() {[0, 0.1, 0.2, 0.34].forEach((d, i) => tone({ freq: [523, 659, 784, 1046][i], dur: 0.5, peak: 0.16, delay: d, type: 'triangle' }));},
  lose() {[0, 0.12, 0.26].forEach((d, i) => tone({ freq: [392, 330, 262][i], dur: 0.55, peak: 0.14, delay: d, type: 'sine' })); },
  tick() { tone({ freq: 2200, dur: 0.03, type: 'square', peak: 0.035 }); },
  alarm() { for (let i = 0; i < 4; i++) tone({ freq: 880, dur: 0.12, peak: 0.12, delay: i * 0.18, type: 'sawtooth', gain: 0.7 }); },
  drum() { tone({ freq: 90, dur: 0.35, type: 'sine', peak: 0.4, slide: -40 }); burst({ freq: 240, q: 0.9, dur: 0.2, peak: 0.22 }); },
  fanfare() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => { tone({ freq: f, dur: 0.5, peak: 0.14, delay: i * 0.12, type: 'triangle' }); tone({ freq: f / 2, dur: 0.6, peak: 0.07, delay: i * 0.12, type: 'sine' }); });
    [0, 0.48, 0.96].forEach((d) => tone({ freq: 130, dur: 0.3, peak: 0.2, delay: d, type: 'sine', slide: -60 }));
  },
};
