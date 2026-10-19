// 所有音效都由 WebAudio 实时合成：无需加载任何音频文件，适合静态部署。
let ac: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') void ac.resume(); return; }
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new Ctor();
    master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo: number | null = null, delay = 0) {
  if (!ac || !sfxBus) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', q = 1, slideTo: number | null = null, delay = 0) {
  if (!ac || !sfxBus || !noiseBuf) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

function bellTone(base: number, vol: number, dur: number, delay = 0) {
  [1, 2.4, 3.0, 4.2, 5.4].forEach((m, i) => tone(base * m, dur * (1 - i * 0.15), 'sine', vol / (i + 1.2), null, delay));
}

export const sfx = {
  jump() { noise(0.09, 0.07, 900, 'bandpass', 1, 1800); },
  land() { noise(0.1, 0.13, 380, 'lowpass'); },
  step() { noise(0.035, 0.025, 700, 'lowpass'); },
  slash() { noise(0.09, 0.24, 1500, 'bandpass', 0.9, 6200); },
  // 命中：高频的「嚓」+ 低频的闷响，后者给出分量
  hit() { noise(0.035, 0.35, 5200, 'highpass'); tone(150, 0.14, 'square', 0.07, 55); tone(90, 0.16, 'sine', 0.32, 42); noise(0.12, 0.3, 1200, 'lowpass'); },
  heavy() { tone(95, 0.32, 'sawtooth', 0.16, 38); noise(0.28, 0.45, 900, 'lowpass'); tone(1400, 0.2, 'triangle', 0.06, 600); },
  kill() { noise(0.35, 0.3, 700, 'lowpass', 1, 120); tone(330, 0.4, 'sine', 0.06, 110); },
  clang() { tone(1300, 0.3, 'triangle', 0.12, 950); tone(1900, 0.2, 'square', 0.035); noise(0.06, 0.22, 4200, 'highpass'); },
  thunk() { tone(240, 0.1, 'triangle', 0.1, 120); noise(0.06, 0.18, 2000, 'bandpass'); },
  throw() { noise(0.22, 0.16, 1200, 'bandpass', 3, 3800); },
  recall() { tone(320, 0.28, 'triangle', 0.08, 1000); noise(0.25, 0.08, 2600, 'bandpass', 4, 6000); },
  catch() { tone(990, 0.07, 'triangle', 0.08); tone(1480, 0.12, 'sine', 0.06, null, 0.04); },
  dash() { noise(0.18, 0.14, 1400, 'bandpass', 1, 260); },
  hurt() { tone(220, 0.3, 'sawtooth', 0.14, 70); noise(0.2, 0.32, 700, 'lowpass'); },
  heal() { tone(392, 0.7, 'sine', 0.09, 784); tone(588, 0.7, 'sine', 0.05, 1176, 0.1); },
  shrine() { bellTone(330, 0.12, 2.2); },
  ember() { tone(1100 + Math.random() * 500, 0.09, 'sine', 0.035); },
  warn() { tone(105, 0.4, 'sawtooth', 0.05, 88); },
  glint() { tone(2300, 0.14, 'sine', 0.06, 3300); },
  boom() { tone(66, 0.8, 'sine', 0.45, 30); noise(0.5, 0.5, 450, 'lowpass'); },
  bell() { bellTone(98, 0.3, 3.2); noise(0.3, 0.2, 300, 'lowpass'); },
  roar() { noise(1.0, 0.3, 380, 'bandpass', 0.7, 110); tone(78, 1.0, 'sawtooth', 0.1, 46); },
  deny() { tone(160, 0.1, 'square', 0.05); },
  menu() { tone(720, 0.05, 'triangle', 0.05); },
  buy() { tone(660, 0.1, 'triangle', 0.07); tone(990, 0.18, 'sine', 0.06, null, 0.08); },
  perfect() { tone(1700, 0.18, 'sine', 0.07, 2600); },
  death() { tone(196, 1.8, 'sine', 0.22, 49); tone(147, 2.0, 'triangle', 0.08, 40); },
  descend() { tone(220, 1.4, 'sine', 0.13, 55); noise(1.2, 0.12, 900, 'lowpass', 1, 90); },
  moth() { noise(0.25, 0.05, 3200, 'bandpass', 6); },
  breakBox() { noise(0.25, 0.3, 900, 'lowpass'); tone(200, 0.15, 'triangle', 0.08, 90); },
};

// ---------- 环境音 ----------
interface Amb { nodes: AudioScheduledSourceNode[]; gain: GainNode; pulse?: GainNode }
let amb: Amb | null = null;
let ambKind = 'none';
let bellTimer = 8;

export function setAmbience(kind: 'none' | 'level' | 'boss') {
  if (!ac || !master || kind === ambKind) return;
  ambKind = kind;
  const t = ac.currentTime;
  if (amb) {
    const old = amb; amb = null;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + 1.5);
    old.nodes.forEach((n) => n.stop(t + 1.6));
  }
  if (kind === 'none') return;
  const gain = ac.createGain(); gain.gain.value = 0; gain.connect(master);
  const nodes: AudioScheduledSourceNode[] = [];
  // 低频持续音
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'boss' ? 260 : 170; lp.connect(gain);
  for (const f of kind === 'boss' ? [55, 82.4, 58.3] : [55, 82.4]) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 10 - 5;
    o.connect(lp); o.start(); nodes.push(o);
  }
  // 风声
  if (noiseBuf) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const wg = ac.createGain(); wg.gain.value = 0.25;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ac.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(bp.frequency);
    s.connect(bp); bp.connect(wg); wg.connect(gain); s.start(); lfo.start(); nodes.push(s, lfo);
  }
  let pulse: GainNode | undefined;
  if (kind === 'boss') {
    // 心跳般的低音脉冲
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 46;
    pulse = ac.createGain(); pulse.gain.value = 0;
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.35;
    const lg = ac.createGain(); lg.gain.value = 0.35; lfo.connect(lg); lg.connect(pulse.gain);
    o.connect(pulse); pulse.connect(gain); o.start(); lfo.start(); nodes.push(o, lfo);
  }
  gain.gain.linearRampToValueAtTime(kind === 'boss' ? 0.11 : 0.07, t + 2.5);
  amb = { nodes, gain, pulse };
}

/** 每帧调用：偶尔的远处钟声 */
export function tickAmbience(dt: number) {
  if (!ac || ambKind !== 'level') return;
  bellTimer -= dt;
  if (bellTimer <= 0) {
    bellTimer = 14 + Math.random() * 14;
    bellTone(110 + Math.random() * 30, 0.05, 4);
  }
}
