'use strict';
// Son entièrement synthétisé (Web Audio) : ambiances, musique, bruitages.
// Le contexte audio ne démarre qu'après une première interaction du joueur.
(function () {
  const G = window.G;
  const A = (G.audio = { ctx: null, muted: false });
  let ac = null, master, musicBus, sfxBus, ambBus, noiseBuf;
  let wantAmb = [], wantSong = null;

  A.unlock = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { ac = new Ctx(); } catch (_) { return; }
    A.ctx = ac;
    master = ac.createGain();
    master.gain.value = A.muted ? 0 : 0.85;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.amb(wantAmb, true);
    if (wantSong) A.song(wantSong);
  };

  A.toggleMute = () => {
    A.muted = !A.muted;
    if (master) master.gain.setTargetAtTime(A.muted ? 0 : 0.85, ac.currentTime, 0.05);
    return A.muted;
  };

  // ------------------------------------------------------------------ briques
  const now = () => ac.currentTime;
  function noise(dest, t0, dur, o = {}) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    let node = src;
    if (o.type) {
      const f = ac.createBiquadFilter();
      f.type = o.type;
      f.frequency.setValueAtTime(o.f || 1000, t0);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
      f.Q.value = o.q || 0.8;
      node.connect(f);
      node = f;
    }
    const g = ac.createGain();
    env(g.gain, t0, dur, o.vol || 0.3, o.a || 0.005, o.r);
    node.connect(g).connect(dest);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
    return g;
  }
  function tone(dest, t0, dur, freq, o = {}) {
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || dur));
    const g = ac.createGain();
    env(g.gain, t0, dur, o.vol || 0.2, o.a || 0.005, o.r);
    osc.connect(g).connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }
  // Enveloppe : attaque linéaire, décroissance exponentielle.
  function env(p, t0, dur, vol, a, r) {
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(vol, t0 + a);
    if (r === 'hold') { p.setValueAtTime(vol, t0 + dur - 0.05); p.linearRampToValueAtTime(0.0001, t0 + dur); }
    else p.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  // Corde pincée (Karplus-Strong), mise en cache par note et instrument.
  const ksCache = new Map();
  function ks(midi, inst) {
    const key = inst + midi;
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ac.sampleRate;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const cfg = {
      banjo: { dur: 1.1, decay: 0.993, bright: 0.95 },
      dulcimer: { dur: 2.6, decay: 0.9975, bright: 0.6 },
      guitar: { dur: 1.6, decay: 0.996, bright: 0.45 },
    }[inst] || { dur: 1.2, decay: 0.995, bright: 0.7 };
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.round(sr * cfg.dur);
    const buf = ac.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.random() * 2 - 1;
      prev = prev + cfg.bright * (w - prev);
      ring[i] = prev;
    }
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      ring[idx] = cfg.decay * 0.5 * (a + b);
      out[i] = a;
      idx = (idx + 1) % N;
    }
    for (let i = 0; i < 400; i++) out[len - 1 - i] *= i / 400;
    ksCache.set(key, buf);
    return buf;
  }
  function pluck(dest, t0, midi, inst, vol = 0.5) {
    const src = ac.createBufferSource();
    src.buffer = ks(midi, inst);
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(g).connect(dest);
    src.start(t0);
  }
  // Violon : deux dents de scie, filtre, vibrato tardif.
  function fiddle(dest, t0, dur, midi, vol = 0.12) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 1.2;
    const body = ac.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 900; body.gain.value = 5; body.Q.value = 1.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.05);
    g.gain.setValueAtTime(vol * 0.85, t0 + Math.max(0.06, dur - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.04);
    const vib = ac.createOscillator();
    vib.frequency.value = 5.6;
    const vibG = ac.createGain();
    vibG.gain.setValueAtTime(0, t0);
    vibG.gain.linearRampToValueAtTime(f * 0.006, t0 + Math.min(0.3, dur));
    vib.connect(vibG);
    for (const det of [-4, 5]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      vibG.connect(o.frequency);
      o.connect(lp);
      o.start(t0); o.stop(t0 + dur + 0.1);
    }
    lp.connect(body).connect(g).connect(dest);
    vib.start(t0); vib.stop(t0 + dur + 0.1);
  }

  // ------------------------------------------------------------------ notation
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  A.midi = (name) => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  // « D4:1 F#4:.5 r:1 » → [[temps, midi, durée], ...]
  A.seq = (str, start = 0) => {
    const out = [];
    let b = start;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '|') continue;
      const [n, d] = tok.split(':');
      const dur = parseFloat(d || '1');
      if (n !== 'r') {
        for (const part of n.split('+')) out.push([b, A.midi(part), dur]);
      }
      b += dur;
    }
    return out;
  };

  // ------------------------------------------------------------------ chansons
  // def : { bpm, len (en temps), loop, tracks: [{ inst, vol, notes: [[temps, midi, durée]] }] }
  // Renvoie une poignée { t0, spb, beatAt(t), timeOf(b), stop() }.
  let current = null;
  A.song = (def, o = {}) => {
    wantSong = def;
    if (!ac) return null;
    if (current) current.stop(o.xfade != null ? o.xfade : 0.8);
    if (!def) { wantSong = null; return null; }
    const spb = 60 / def.bpm;
    const bus = ac.createGain();
    bus.gain.setValueAtTime(0.0001, now());
    bus.gain.linearRampToValueAtTime(def.vol || 1, now() + (o.fadeIn || 0.6));
    bus.connect(musicBus);
    const t0 = now() + (o.delay || 0.12);
    let nextLoop = 0;
    const handle = {
      def, t0, spb, bus, stopped: false,
      beatAt: (t) => (t - t0) / spb,
      timeOf: (b) => t0 + b * spb,
      beatNow: () => (now() - t0) / spb,
      stop(fade = 0.8) {
        if (this.stopped) return;
        this.stopped = true;
        clearInterval(timer);
        bus.gain.cancelScheduledValues(now());
        bus.gain.setValueAtTime(bus.gain.value, now());
        bus.gain.linearRampToValueAtTime(0.0001, now() + fade);
        setTimeout(() => bus.disconnect(), fade * 1000 + 200);
        if (current === handle) current = null;
      },
    };
    // Planification par fenêtre glissante.
    const flat = [];
    for (const tr of def.tracks) for (const n of tr.notes) flat.push({ b: n[0], m: n[1], d: n[2], tr });
    flat.sort((a, b) => a.b - b.b);
    let idx = 0;
    const tick = () => {
      const horizon = now() + 0.2;
      for (;;) {
        if (idx >= flat.length) {
          if (def.loop === false) return;
          idx = 0;
          nextLoop += def.len;
        }
        const n = flat[idx];
        const t = t0 + (nextLoop + n.b) * spb;
        if (t > horizon) break;
        if (t >= now() - 0.02) play(n, t);
        idx++;
      }
    };
    const play = (n, t) => {
      const v = n.tr.vol != null ? n.tr.vol : 0.5;
      if (n.tr.inst === 'fiddle') fiddle(bus, t, n.d * spb * 0.95, n.m, v);
      else if (n.tr.inst === 'drone') tone(bus, t, n.d * spb, 440 * Math.pow(2, (n.m - 69) / 12), { type: 'triangle', vol: v, a: 0.3, r: 'hold' });
      else pluck(bus, t, n.m, n.tr.inst, v);
    };
    const timer = setInterval(tick, 25);
    tick();
    current = handle;
    return handle;
  };
  A.stopSong = (fade) => { wantSong = null; if (current) current.stop(fade); };
  A.current = () => current;

  // Pattern de banjo « bum-ditty » : mélodie au temps, frappe d'accord, 5e corde.
  A.bumDitty = (melody, chords, start = 0) => {
    const out = [];
    const mel = melody.trim().split(/\s+/);
    const chordNotes = { G: ['G3', 'B3', 'D4'], C: ['C4', 'E4', 'G4'], D: ['D4', 'F#4', 'A4'], Em: ['E3', 'G3', 'B3'], A: ['A3', 'C#4', 'E4'] };
    mel.forEach((n, i) => {
      const b = start + i;
      if (n !== 'r') out.push([b, A.midi(n), 0.5]);
      const ch = chordNotes[chords[Math.floor(i / 4) % chords.length]] || chordNotes.G;
      for (const c of ch) out.push([b + 0.5, A.midi(c), 0.25]);
      out.push([b + 0.75, A.midi('G4'), 0.25]);
    });
    return out;
  };

  // ------------------------------------------------------------------ ambiances
  const AMB = {
    wind(dest) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.5;
      const g = ac.createGain(); g.gain.value = 0.16;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.09;
      const lg = ac.createGain(); lg.gain.value = 0.1;
      lfo.connect(lg).connect(g.gain);
      const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.05;
      const lg2 = ac.createGain(); lg2.gain.value = 160;
      lfo2.connect(lg2).connect(bp.frequency);
      src.connect(bp).connect(g).connect(dest);
      src.start(); lfo.start(); lfo2.start();
      return () => { src.stop(); lfo.stop(); lfo2.stop(); };
    },
    creek(dest) {
      const stops = [];
      for (const [f, q, v] of [[1600, 0.4, 0.08], [520, 0.7, 0.07], [3200, 0.6, 0.025]]) {
        const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const g = ac.createGain(); g.gain.value = v;
        const lfo = ac.createOscillator(); lfo.frequency.value = 2 + Math.random() * 3;
        const lg = ac.createGain(); lg.gain.value = v * 0.5;
        lfo.connect(lg).connect(g.gain);
        src.connect(bp).connect(g).connect(dest);
        src.start(Math.random()); lfo.start();
        stops.push(() => { src.stop(); lfo.stop(); });
      }
      return () => stops.forEach((s) => s());
    },
    fire(dest) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const g = ac.createGain(); g.gain.value = 0.05;
      src.connect(lp).connect(g).connect(dest); src.start();
      let alive = true;
      const crack = () => {
        if (!alive) return;
        const t = now();
        noise(dest, t, 0.02 + Math.random() * 0.04, { type: 'highpass', f: 2500 + Math.random() * 3000, vol: 0.05 + Math.random() * 0.1, a: 0.001 });
        setTimeout(crack, 60 + Math.random() * 420);
      };
      crack();
      return () => { alive = false; src.stop(); };
    },
    birds(dest) {
      let alive = true;
      const chirp = () => {
        if (!alive) return;
        const t = now();
        const base = 2400 + Math.random() * 1600;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone(dest, t + i * 0.11, 0.07, base, { f2: base * (1.2 + Math.random() * 0.4), vol: 0.025, a: 0.005 });
        setTimeout(chirp, 1500 + Math.random() * 5000);
      };
      setTimeout(chirp, 800);
      return () => { alive = false; };
    },
    night(dest) {
      let alive = true;
      const o = ac.createOscillator(); o.frequency.value = 4400;
      const g = ac.createGain(); g.gain.value = 0;
      const am = ac.createOscillator(); am.type = 'square'; am.frequency.value = 28;
      const amg = ac.createGain(); amg.gain.value = 0.006;
      const gate = ac.createOscillator(); gate.type = 'square'; gate.frequency.value = 1.3;
      const gg = ac.createGain(); gg.gain.value = 0.006;
      am.connect(amg).connect(g.gain); gate.connect(gg).connect(g.gain);
      o.connect(g).connect(dest);
      o.start(); am.start(); gate.start();
      // Engoulevent bois-pourri : trois notes sifflées.
      const call = () => {
        if (!alive) return;
        const t = now();
        tone(dest, t, 0.16, 1500, { f2: 1900, vol: 0.03 });
        tone(dest, t + 0.2, 0.1, 1300, { vol: 0.025 });
        tone(dest, t + 0.32, 0.22, 1700, { f2: 2300, vol: 0.03 });
        setTimeout(call, 7000 + Math.random() * 9000);
      };
      setTimeout(call, 3000);
      return () => { alive = false; o.stop(); am.stop(); gate.stop(); };
    },
    mill(dest) {
      const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 46;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
      const g = ac.createGain(); g.gain.value = 0.08;
      hum.connect(lp).connect(g).connect(dest); hum.start();
      let alive = true;
      const saw = () => {
        if (!alive) return;
        const t = now();
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(820, t);
        o.frequency.linearRampToValueAtTime(700, t + 1.6);
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
        const sg = ac.createGain();
        sg.gain.setValueAtTime(0.0001, t);
        sg.gain.linearRampToValueAtTime(0.03, t + 0.3);
        sg.gain.linearRampToValueAtTime(0.0001, t + 1.8);
        o.connect(bp).connect(sg).connect(dest);
        o.start(t); o.stop(t + 1.9);
        setTimeout(saw, 2800 + Math.random() * 2500);
      };
      saw();
      return () => { alive = false; hum.stop(); };
    },
    room(dest) {
      let alive = true;
      const tick = () => {
        if (!alive) return;
        noise(dest, now(), 0.012, { type: 'bandpass', f: 3000, q: 3, vol: 0.05, a: 0.001 });
        setTimeout(tick, 1000);
      };
      tick();
      return () => { alive = false; };
    },
  };
  const ambActive = new Map();
  // A.amb(['wind', 'birds']) : fond sonore, avec fondu enchaîné.
  A.amb = (list, force) => {
    wantAmb = list || [];
    if (!ac) return;
    for (const [name, h] of ambActive) {
      if (!wantAmb.includes(name) || force) {
        h.g.gain.setTargetAtTime(0.0001, now(), 0.4);
        setTimeout(() => h.stop(), 2000);
        ambActive.delete(name);
      }
    }
    for (const name of wantAmb) {
      if (ambActive.has(name) || !AMB[name]) continue;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now());
      g.gain.setTargetAtTime(1, now(), 0.6);
      g.connect(ambBus);
      const stop = AMB[name](g);
      ambActive.set(name, { g, stop });
    }
  };

  // ------------------------------------------------------------------ bruitages
  const SFX = {
    click: (t, d) => tone(d, t, 0.03, 1700, { type: 'square', vol: 0.03 }),
    coin: (t, d) => { tone(d, t, 0.12, 1568, { vol: 0.12 }); tone(d, t + 0.08, 0.3, 2093, { vol: 0.12 }); },
    clink: (t, d) => { for (const f of [2650, 3970, 5210]) tone(d, t, 0.35, f * (0.98 + Math.random() * 0.04), { vol: 0.06, a: 0.001 }); },
    splash: (t, d) => { noise(d, t, 0.6, { type: 'lowpass', f: 2600, f2: 300, vol: 0.35, a: 0.01 }); },
    plop: (t, d) => { noise(d, t, 0.12, { type: 'bandpass', f: 700, vol: 0.2 }); tone(d, t, 0.12, 320, { f2: 140, vol: 0.12 }); },
    bite: (t, d) => { tone(d, t, 0.08, 240, { f2: 110, vol: 0.2 }); tone(d, t + 0.1, 0.08, 220, { f2: 100, vol: 0.18 }); },
    tick: (t, d) => noise(d, t, 0.015, { type: 'bandpass', f: 4000, q: 2, vol: 0.12, a: 0.001 }),
    dig: (t, d) => { noise(d, t, 0.14, { type: 'lowpass', f: 900, vol: 0.3 }); tone(d, t, 0.08, 110, { f2: 60, vol: 0.15 }); },
    crunch: (t, d) => { for (let i = 0; i < 4; i++) noise(d, t + i * 0.035, 0.03, { type: 'bandpass', f: 2500 + Math.random() * 2000, q: 1.5, vol: 0.18, a: 0.001 }); },
    burn: (t, d) => noise(d, t, 0.7, { type: 'highpass', f: 4500, vol: 0.12, a: 0.05 }),
    thud: (t, d) => { tone(d, t, 0.25, 95, { f2: 45, vol: 0.4 }); noise(d, t, 0.08, { type: 'lowpass', f: 400, vol: 0.2 }); },
    step: (t, d) => noise(d, t, 0.07, { type: 'lowpass', f: 500, vol: 0.12 }),
    knock: (t, d) => { for (let i = 0; i < 3; i++) { tone(d, t + i * 0.18, 0.09, 170, { f2: 120, vol: 0.35 }); noise(d, t + i * 0.18, 0.05, { type: 'lowpass', f: 1200, vol: 0.2 }); } },
    bell: (t, d) => { for (const [f, v] of [[1320, 0.08], [1985, 0.05], [2760, 0.04], [3510, 0.02]]) tone(d, t, 1.4, f, { vol: v, a: 0.002 }); },
    page: (t, d) => noise(d, t, 0.22, { type: 'bandpass', f: 2600, f2: 1800, q: 0.7, vol: 0.12, a: 0.03 }),
    shutter: (t, d) => { tone(d, t, 0.02, 2200, { type: 'square', vol: 0.06 }); noise(d, t + 0.02, 0.06, { type: 'highpass', f: 3000, vol: 0.2, a: 0.001 }); },
    cough: (t, d) => { for (let i = 0; i < 2; i++) noise(d, t + i * 0.28, 0.18, { type: 'bandpass', f: 800, q: 1.5, vol: 0.3, a: 0.01 }); },
    bark: (t, d) => {
      for (let i = 0; i < 2; i++) {
        tone(d, t + i * 0.22, 0.12, 420, { type: 'sawtooth', f2: 230, vol: 0.12 });
        noise(d, t + i * 0.22, 0.1, { type: 'bandpass', f: 1100, q: 1, vol: 0.15 });
      }
    },
    fail: (t, d) => tone(d, t, 0.45, 220, { type: 'triangle', f2: 110, vol: 0.15 }),
    good: (t, d) => { pluck(d, t, 67, 'banjo', 0.4); pluck(d, t + 0.09, 74, 'banjo', 0.4); },
    perfect: (t, d) => { pluck(d, t, 74, 'banjo', 0.4); pluck(d, t + 0.07, 79, 'banjo', 0.4); pluck(d, t + 0.14, 86, 'banjo', 0.3); },
    pour: (t, d) => { noise(d, t, 0.3, { type: 'lowpass', f: 700, f2: 300, vol: 0.25, a: 0.02 }); tone(d, t + 0.05, 0.1, 180, { f2: 120, vol: 0.08 }); },
    whoosh: (t, d) => noise(d, t, 0.35, { type: 'bandpass', f: 600, f2: 2400, q: 0.8, vol: 0.18, a: 0.08 }),
    creak: (t, d) => tone(d, t, 0.4, 210, { type: 'sawtooth', f2: 160, vol: 0.03, a: 0.08 }),
    train: (t, d) => { for (const f of [392, 494]) tone(d, t, 1.6, f, { type: 'triangle', vol: 0.06, a: 0.1 }); },
  };
  // vol : volume relatif (1 par défaut), utile pour les sons répétés à chaque temps.
  A.sfx = (name, delay = 0, vol = 1) => {
    if (!ac || A.muted || !SFX[name]) return;
    let dest = sfxBus;
    if (vol !== 1) {
      dest = ac.createGain();
      dest.gain.value = vol;
      dest.connect(sfxBus);
      setTimeout(() => dest.disconnect(), 3000);
    }
    SFX[name](now() + delay, dest);
  };

  // Sifflet à vapeur de l'usine : un accord tenu, avec la vapeur.
  A.whistle = (dur = 2.5, vol = 0.12) => {
    if (!ac) return;
    const t = now();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.35);
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
    lp.connect(g).connect(sfxBus);
    for (const f of [311, 370, 466]) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.9, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.4);
      o.frequency.setValueAtTime(f, t + dur);
      o.frequency.linearRampToValueAtTime(f * 0.86, t + dur + 1.4);
      o.connect(lp); o.start(t); o.stop(t + dur + 1.5);
    }
    noise(sfxBus, t, dur + 1.2, { type: 'bandpass', f: 2200, q: 0.6, vol: vol * 0.6, a: 0.3 });
  };

  // ------------------------------------------------------------------ musiques de l'épisode 1
  const S = (A.SONGS = {});
  // Thème de la vallée : dulcimer lent, ré mixolydien, à trois temps.
  S.valley = {
    bpm: 66, len: 48, vol: 0.9,
    tracks: [
      { inst: 'dulcimer', vol: 0.55, notes: A.seq('A3:1 D4:1 E4:1 F#4:2 E4:1 D4:1 E4:1 F#4:1 A4:3 B4:1 A4:1 F#4:1 A4:2 F#4:1 E4:1 D4:1 B3:1 A3:3 A3:1 D4:1 E4:1 F#4:2 A4:1 B4:1 D5:1 B4:1 A4:3 F#4:1 E4:1 D4:1 E4:2 F#4:1 D4:3 D4:3') },
      { inst: 'dulcimer', vol: 0.28, notes: A.seq('D3+A3:3 D3+A3:3 D3+A3:3 D3+A3:3 G3+B3:3 D3+A3:3 G3+B3:3 A3+E3:3 D3+A3:3 D3+A3:3 G3+B3:3 D3+A3:3 D3+A3:3 A3+E3:3 D3+A3:3 D3+A3:3') },
    ],
  };
  // Air de banjo du camp (sol majeur).
  S.camp = {
    bpm: 100, len: 32, vol: 0.75,
    tracks: [
      { inst: 'banjo', vol: 0.32, notes: A.bumDitty('G4 A4 B4 D5 B4 A4 G4 E4 D4 E4 G4 A4 B4 A4 G4 G4 B4 D5 E5 D5 B4 A4 G4 E4 D4 E4 G4 B4 A4 G4 G4 r', ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G']) },
    ],
  };
  // Air triste : dulcimer seul, mi dorien.
  S.sad = {
    bpm: 56, len: 32, vol: 0.85,
    tracks: [
      { inst: 'dulcimer', vol: 0.5, notes: A.seq('E4:2 G4:1 A4:1 B4:3 A4:1 G4:1 E4:1 D4:1 E4:1 E4:4 B4:2 D5:1 B4:1 A4:2 G4:1 A4:1 B4:1 A4:1 G4:1 E4:1 E4:4') },
      { inst: 'drone', vol: 0.04, notes: [[0, A.midi('E2'), 32]] },
    ],
  };
  // Reel du beurre de pommes (ré majeur), violon + banjo + basse. tempo réglable.
  const reelA = 'D4:.5 F#4:.5 A4:.5 F#4:.5 D5:.5 A4:.5 F#4:.5 A4:.5 G4:.5 B4:.5 D5:.5 B4:.5 A4:.5 F#4:.5 D4:.5 F#4:.5 '
    + 'E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 A4:.5 G4:.5 F#4:.5 E4:.5 D4:.5 E4:.5 F#4:.5 E4:.5 C#4:.5 A3:.5 C#4:.5 '
    + 'D4:.5 F#4:.5 A4:.5 F#4:.5 D5:.5 A4:.5 F#4:.5 A4:.5 G4:.5 B4:.5 D5:.5 B4:.5 A4:.5 F#4:.5 A4:.5 D5:.5 '
    + 'E5:.5 D5:.5 C#5:.5 B4:.5 A4:.5 G4:.5 F#4:.5 E4:.5 D4:.5 F#4:.5 E4:.5 C#4:.5 D4:1 r:1';
  const reelChords = ['D', 'G', 'A', 'A', 'D', 'G', 'A', 'D'];
  const bassLine = (() => {
    const roots = { D: ['D3', 'A2'], G: ['G2', 'D3'], A: ['A2', 'E3'] };
    const out = [];
    reelChords.forEach((c, bar) => {
      out.push([bar * 4, A.midi(roots[c][0]), 1]);
      out.push([bar * 4 + 2, A.midi(roots[c][1]), 1]);
    });
    return out;
  })();
  A.reel = (bpm) => ({
    bpm, len: 32, vol: 0.85,
    tracks: [
      { inst: 'fiddle', vol: 0.085, notes: A.seq(reelA) },
      { inst: 'banjo', vol: 0.18, notes: A.bumDitty('r r r r r r r r r r r r r r r r r r r r r r r r r r r r r r r r', reelChords.map((c) => c)) },
      { inst: 'guitar', vol: 0.5, notes: bassLine },
    ],
  });
})();
