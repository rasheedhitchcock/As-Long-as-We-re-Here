'use strict';
// Mini-jeu « Touiller en rythme » : la nuit du beurre de pommes chez les Napier.
// Wes joue le reel, Henry touille la bassine de cuivre sur le temps.
// Un essai, puis trois couplets de 32 temps (96, 112 puis 128 bpm).
// Contrôles : clic, toucher ou Espace quand le cercle touche la palette.
// Horloge : celle du Web Audio (handle.timeOf comparé à ctx.currentTime, latence
// de sortie compensée) ; repli sur le temps de jeu quand il n'y a pas de son.
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL;

  // ------------------------------------------------------------------ réglages
  const WIN_PERFECT = 0.07;   // ± secondes
  const WIN_GOOD = 0.14;
  const WIN_EARLY = 0.22;     // au-delà, l'appui ne vise aucune note
  const INPUT_LAG = 0.008;    // l'appui n'est lu qu'à l'image suivante
  const COUNT_IN = 2;         // « Un, deux… »
  const GROUND = 612;
  const KET = { x: 600, rimY: 528, rx: 92, ry: 20, depth: 54 };
  const SURF = { x: KET.x, y: KET.rimY + 5, rx: KET.rx - 11, ry: KET.ry - 6 };
  const EIGHT = { ax: 42, ay: 18 };             // amplitude du huit dans la bassine
  const STEM = 40;                              // pale verticale visible au-dessus du beurre
  const TARGET = { x: KET.x, y: SURF.y - 16, r: 21, r0: 110 };
  const SPOT = { henry: 416, nora: 322, near: 382 };
  const FEET = { front: 612, back: 600 };
  const SIL = '#110C0A';                        // silhouettes à contre-jour du feu

  const range = (a, b, s = 1) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(v); return o; };
  // Couplet 1 : un temps sur deux. Couplet 2 : chaque temps. Couplet 3 : chaque temps
  // et quelques contretemps (jamais plus d'une croche isolée de suite).
  const COUPLETS = [
    { bpm: 96, beats: range(0, 30, 2), name: 'Premier couplet' },
    { bpm: 112, beats: range(0, 30, 1), name: 'Deuxième couplet' },
    { bpm: 128, beats: range(0, 30, 1).concat([7.5, 15.5, 19.5, 21.5, 23.5, 25.5, 27.5]).sort((a, b) => a - b), name: 'Dernier couplet' },
  ];
  const TRIAL = { bpm: 90, beats: [0, 2, 4, 6], end: 8 };

  // Wes s'accorde : doubles cordes à vide, une basse à la guitare.
  const trialDef = () => {
    const A = G.audio;
    return {
      bpm: TRIAL.bpm, len: 9, vol: 0.85, loop: false,
      tracks: [
        { inst: 'fiddle', vol: 0.075, notes: A.seq('A3+E4:2 D4+A4:2 A3+E4:2 D4+A4:2') },
        { inst: 'guitar', vol: 0.45, notes: [[0, A.midi('D3'), 1], [2, A.midi('A2'), 1], [4, A.midi('D3'), 1], [6, A.midi('A2'), 1]] },
      ],
    };
  };
  // Même chanson, sans boucle, éventuellement reprise à partir d'un temps donné.
  const fromBeat = (def, from) => ({
    bpm: def.bpm, len: Math.max(1, def.len - from), vol: def.vol, loop: false,
    tracks: def.tracks.map((tr) => ({
      inst: tr.inst, vol: tr.vol,
      notes: tr.notes.filter((n) => n[0] >= from - 1e-6).map((n) => [n[0] - from, n[1], n[2]]),
    })),
  });
  // Interpolation douce entre images clés [[temps, valeur], ...].
  const kf = (r, keys) => {
    if (r <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (r <= keys[i][0]) {
        const [a, va] = keys[i - 1], [b, vb] = keys[i];
        return U.lerp(va, vb, U.smooth((r - a) / (b - a)));
      }
    }
    return keys[keys.length - 1][1];
  };
  const mix = (c1, c2, k) => c1.map((v, i) => Math.round(U.lerp(v, c2[i], k)));
  const NUM = ['Zéro', 'Un', 'Deux', 'Trois'];

  // ------------------------------------------------------------------ décor fixe
  function drawSky(cx, w, h) {
    G.art.sky(cx, w, h, [[0, '#080B16'], [0.34, '#111830'], [0.6, '#1F2540'], [0.78, '#352B38'], [1, '#2A1D18']]);
    const mx = 1012, my = 92;
    const g = cx.createRadialGradient(mx, my, 10, mx, my, 160);
    g.addColorStop(0, 'rgba(220,214,190,0.22)');
    g.addColorStop(1, 'rgba(220,214,190,0)');
    cx.fillStyle = g;
    cx.fillRect(mx - 160, my - 160, 320, 320);
    cx.fillStyle = '#E6DEC4';
    cx.beginPath(); cx.arc(mx, my, 19, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = 'rgba(160,150,128,0.35)';
    cx.beginPath(); cx.arc(mx - 6, my - 4, 5, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(mx + 7, my + 6, 3.5, 0, Math.PI * 2); cx.fill();
  }

  function drawLand(cx, w, h) {
    const A = G.art;
    const far = A.makeRidge(51, w, 372, 28, 170);
    A.ridge(cx, far, '#1A2034', h);
    A.dots(cx, 52, 240, 0, w, (x) => [A.ridgeY(far, x) - 16, A.ridgeY(far, x) + 8], ['#1A2032', '#1F2539', '#181C2B'], 4, 9);
    const near = A.makeRidge(83, w, 446, 20, 130);
    A.ridge(cx, near, '#13151D', h);
    A.dots(cx, 84, 260, 0, w, (x) => [A.ridgeY(near, x) - 20, A.ridgeY(near, x) + 6], ['#14151B', '#1A181D', '#1E1919'], 5, 11);
    // sol de la cour
    const g = cx.createLinearGradient(0, 520, 0, h);
    g.addColorStop(0, '#1A1411');
    g.addColorStop(0.4, '#1C1510');
    g.addColorStop(1, '#0F0B09');
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(0, 560);
    cx.quadraticCurveTo(w * 0.5, 540, w, 566);
    cx.lineTo(w, h); cx.lineTo(0, h);
    cx.fill();
    // la maison des Napier, fenêtres allumées
    A.campHouse(cx, -24, 590, { w: 244, h: 100, stilt: 22, lit: true, smoke: false, wall: '#2A231E', roof: '#20232B', pitch: 48 });
    // grand chêne à droite
    A.tree(cx, 1222, 600, 330, '#100D0B', ['#2C1C14', '#38211A', '#23170F', '#1A120E'], 9);
    // touffes d'herbe sèche
    const rnd = U.rng(1932);
    cx.strokeStyle = '#0E0A08';
    cx.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = 622 + rnd() * 96;
      for (let k = -2; k <= 2; k++) {
        cx.beginPath(); cx.moveTo(x + k * 2, y); cx.lineTo(x + k * 4 + (rnd() - 0.5) * 4, y - 6 - rnd() * 10); cx.stroke();
      }
    }
    // table de planches avec les pots, à droite
    cx.fillStyle = '#1A130E';
    cx.fillRect(1150, 556, 116, 7);
    cx.fillRect(1156, 563, 5, 44);
    cx.fillRect(1256, 563, 5, 44);
    for (let i = 0; i < 6; i++) {
      const jx = 1160 + i * 15, jy = 556;
      cx.fillStyle = i < 4 ? '#4A2210' : 'rgba(150,140,120,0.25)';
      cx.beginPath(); cx.roundRect(jx, jy - 18, 11, 18, 2); cx.fill();
      cx.fillStyle = '#2A2420';
      cx.fillRect(jx - 1, jy - 21, 13, 3);
    }
  }

  // Les étoiles (scintillement calculé à chaque image).
  const STARS = (() => {
    const rnd = U.rng(714);
    const out = [];
    for (let i = 0; i < 150; i++) {
      const x = rnd() * G.W, y = rnd() * rnd() * 380;
      if (Math.hypot(x - 1012, y - 92) < 40) continue;
      out.push({ x, y, s: 0.6 + rnd() * 1.4, p: rnd() * 6.28, f: 0.6 + rnd() * 2 });
    }
    return out;
  })();

  // ------------------------------------------------------------------ scène
  G.Scenes.applebutter = (opts = {}) => G.makeScene({
    enter() {
      G.audio.amb(['fire', 'night']);
      this.state = 'intro';
      this.seg = null;
      this.couplet = -1;
      this.stats = { perfects: 0, goods: 0, misses: 0, total: COUPLETS.reduce((s, c) => s + c.beats.length, 0) };
      this.trialHits = 0;
      this.gauge = 0;
      this.gaugeShown = 0;
      this.burned = false;
      this.streak = 0;
      this.take = null;
      this.ph = 0;
      this.stroke = null;
      this.jolt = 0;
      this.pops = [];
      this.sparks = [];
      this.smoke = [];
      this.bubbles = [];
      this.ripples = [];
      this.msg = null;
      this.says = null;
      this.mbeat = 0;
      this.groove = 0;
      this.lastSfx = -1;
      this.lastReal = performance.now();
      this.hiccup = false;
      this.demoN = 0;
      this.pos = { henry: { x: SPOT.henry, foot: FEET.front, phase: 0, walk: false }, nora: { x: SPOT.nora, foot: FEET.back, phase: 0, walk: false } };
      this.heads = {};
      this.result = null;
      this.waiter = null;
      this.flow().catch((err) => { console.error(err); G.fatal = String(err && err.stack || err); });
    },

    exit() {
      if (this.seg && this.seg.clk && this.seg.clk.handle) this.seg.clk.handle.stop(0.3);
    },

    // -------------------------------------------------------------- déroulé
    async flow() {
      await this.waitPress(0.4);
      G.audio.sfx('click');
      // Essai : Wes s'accorde, Henry touille quatre fois.
      for (let k = 0; k < 3; k++) {
        this.state = 'trial';
        this.trialHits = 0;
        await this.playSeg({ kind: 'trial', bpm: TRIAL.bpm, beats: TRIAL.beats, end: TRIAL.end, def: trialDef });
        const ok = this.trialHits >= 2;
        this.state = 'trialMsg';
        this.showMsg(ok ? 'C\'est ça. Wes attaque le reel !' : k < 2 ? 'Pas tout à fait. Encore une fois.' : 'Ça viendra en touillant. On y va !', 1.9);
        await G.wait(1.9);
        if (ok) break;
      }
      // Trois couplets, de plus en plus vite.
      for (let i = 0; i < COUPLETS.length; i++) {
        const c = COUPLETS[i];
        this.couplet = i;
        this.state = 'couplet';
        await this.playSeg({ kind: 'couplet', bpm: c.bpm, beats: c.beats, end: 32, def: () => G.audio.reel(c.bpm), index: i });
        if (i < COUPLETS.length - 1) {
          this.state = 'interlude';
          this.gauge = Math.min(this.gauge, 0.5);
          if (opts.interlude) await opts.interlude(i);
          await G.card('Plus vite !', i === 0 ? 'Wes accélère.' : 'Wes donne tout ce qu\'il a.', {
            dur: 1.9, bgAlpha: 0.55, size: 60, eyebrow: COUPLETS[i + 1].name,
          });
        }
      }
      this.state = 'end';
      this.result = this.computeResult();
      this.endT = this.t;
      await this.waitPress(1.2);
      G.audio.sfx('click');
      this.finish(this.result);
    },

    // Attend un appui (clic, toucher ou Espace) hors dialogue.
    waitPress(guard) {
      return new Promise((res) => { this.waiter = { res, t0: this.t + guard }; });
    },

    showMsg(text, dur) { this.msg = { text, t0: this.t, dur }; },

    computeResult() {
      const s = this.stats;
      const score = U.clamp((s.perfects + 0.6 * s.goods) / Math.max(1, s.total), 0, 1);
      let jars = score >= 0.75 ? 3 : score >= 0.45 ? 2 : 1;
      if (this.burned) jars = Math.min(jars, 2);
      return { score: Math.round(score * 1000) / 1000, perfects: s.perfects, goods: s.goods, misses: s.misses, jars, burned: this.burned };
    },

    // -------------------------------------------------------------- horloge
    // Une « portion » de musique : l'essai ou un couplet, avec sa grille de notes.
    playSeg(spec) {
      return new Promise((resolve) => {
        const seg = Object.assign({}, spec, {
          spb: 60 / spec.bpm,
          notes: spec.beats.map((b) => ({ b, owner: 'henry', res: null })),
          resolve, paused: false, done: false, beat: -COUNT_IN, clk: null,
        });
        this.seg = seg;
        this.take = null;
        this.startClock(seg, 0);
      });
    },

    startClock(seg, from) {
      const ac = G.audio.ctx;
      const lead = COUNT_IN * seg.spb + 0.2;
      const clk = { from, spb: seg.spb, audio: false, handle: null, vt: 0, t0: lead, lat: 0 };
      if (ac && ac.state === 'running') {
        const h = G.audio.song(fromBeat(seg.def(), from), { delay: lead, fadeIn: 0.25, xfade: 0.2 });
        if (h) {
          clk.audio = true;
          clk.handle = h;
          clk.lat = U.clamp(ac.outputLatency || ac.baseLatency || 0, 0, 0.15);
          // Wes tape du pied : « Un, deux… »
          for (let k = COUNT_IN; k >= 1; k--) {
            const d = h.timeOf(-k) - ac.currentTime;
            if (d > -0.01) G.audio.sfx('tick', Math.max(0, d));
          }
        }
      }
      seg.clk = clk;
      seg.paused = false;
      seg.beat = from - COUNT_IN;
    },
    now(clk) { return clk.audio ? G.audio.ctx.currentTime - clk.lat : clk.vt; },
    timeOf(clk, b) { return clk.audio ? clk.handle.timeOf(b - clk.from) : clk.t0 + (b - clk.from) * clk.spb; },
    beatOf(clk) { return clk.from + (this.now(clk) - this.timeOf(clk, clk.from)) / clk.spb; },

    // Dialogue, onglet caché ou contexte audio suspendu : on coupe la musique
    // et on reprendra au début de la mesure de la prochaine note.
    pauseSeg(seg) {
      if (seg.clk && seg.clk.handle) seg.clk.handle.stop(0.15);
      seg.paused = true;
      seg.pauseT = G.time;
      const next = seg.notes.find((n) => !n.res);
      seg.resumeFrom = next ? Math.max(0, Math.floor(next.b / 4) * 4) : null;
    },

    endSeg(seg) {
      if (seg.done) return;
      seg.done = true;
      if (seg.clk && seg.clk.handle) seg.clk.handle.stop(seg.kind === 'trial' ? 0.5 : 1.2);
      if (this.seg === seg) this.seg = null;
      this.take = null;
      seg.resolve();
    },

    updateSeg(seg, dt) {
      if (seg.paused) {
        if (!G.blocked && G.time - seg.pauseT > 0.3) {
          if (seg.resumeFrom == null) this.endSeg(seg);
          else this.startClock(seg, seg.resumeFrom);
        }
        return;
      }
      const clk = seg.clk;
      const ac = G.audio.ctx;
      if (G.blocked || (clk.audio && (this.hiccup || !ac || ac.state !== 'running'))) { this.pauseSeg(seg); return; }
      if (!clk.audio) clk.vt += dt;
      const now = this.now(clk);
      seg.beat = this.beatOf(clk);

      // Appui du joueur : la note la plus proche dans le temps.
      if (I.confirm()) {
        const tp = now - INPUT_LAG;
        let best = null, bd = 1e9;
        for (const n of seg.notes) {
          if (n.res || n.owner !== 'henry') continue;
          const d = tp - this.timeOf(clk, n.b);
          if (Math.abs(d) < Math.abs(bd)) { best = n; bd = d; }
        }
        if (best && Math.abs(bd) <= WIN_EARLY) {
          const ad = Math.abs(bd);
          this.judge(seg, best, ad <= WIN_PERFECT ? 'perfect' : ad <= WIN_GOOD ? 'good' : 'miss');
        } else this.jolt = Math.max(this.jolt, 0.5);
      }
      // Notes passées : ratées, ou jouées par Mrs. Napier.
      for (const n of seg.notes) {
        if (n.res) continue;
        const t = this.timeOf(clk, n.b);
        if (n.owner === 'nora') {
          if (now >= t) { n.res = 'nora'; this.startStroke(this.gapAfter(seg, n)); this.burst(3); }
        } else if (n.owner === 'skip') {
          if (now >= t) n.res = 'skip';
        } else if (now > t + WIN_GOOD) this.judge(seg, n, 'miss');
      }
      // Mrs. Napier : la jauge redescend pendant qu'elle touille.
      const rel = this.takeRel();
      if (rel != null) {
        if (rel >= 2 && rel <= 10) this.gauge = Math.min(this.gauge, U.lerp(1, 0.25, (rel - 2) / 8));
        if (rel >= 10 && !this.take.back) {
          this.take.back = true;
          this.says = { who: 'nora', text: 'À toi.', t0: this.t, dur: 1.6 };
        }
      }
      if (seg.beat >= seg.end && seg.notes.every((n) => n.res)) this.endSeg(seg);
    },

    gapAfter(seg, n) {
      const next = seg.notes.find((m) => m.b > n.b + 1e-6);
      return (next ? next.b - n.b : 2) * seg.spb;
    },

    judge(seg, n, kind) {
      n.res = kind;
      const trial = seg.kind === 'trial';
      if (kind === 'miss') {
        this.streak = 0;
        this.pop('Raté', '#D58E66');
        this.sfx('fail', 0.17);
        this.jolt = 1;
        if (!trial) {
          this.stats.misses++;
          this.gauge = Math.min(1, this.gauge + 0.2);
          G.audio.sfx('burn', 0.06);
          this.puff(this.gauge);
          if (this.gauge >= 1 && !this.takeActive()) this.startTake(seg);
        }
        return;
      }
      if (trial) this.trialHits++;
      else {
        if (kind === 'perfect') this.stats.perfects++; else this.stats.goods++;
        this.gauge = Math.max(0, this.gauge - (kind === 'perfect' ? 0.09 : 0.05));
      }
      this.streak++;
      this.pop(kind === 'perfect' ? 'Parfait' : 'Bien', kind === 'perfect' ? P.rim : P.paper);
      G.audio.sfx(kind, 0, 0.25); // discret, à chaque réussite, sous la musique
      this.startStroke(this.gapAfter(seg, n));
      this.burst(kind === 'perfect' ? 6 : 3);
    },

    // Bruitages espacés : à 128 bpm, un arpège de banjo à chaque temps
    // couvrirait le violon. Les réussites rapprochées restent muettes (le
    // jugement s'affiche quand même) ; un raté s'entend toujours.
    sfx(name, gap) {
      if (G.time - this.lastSfx < gap) return;
      this.lastSfx = G.time;
      G.audio.sfx(name);
    },

    // « Donne, petit. Regarde. » : Mrs. Napier prend la palette deux mesures.
    startTake(seg) {
      const b0 = seg.beat;
      this.take = { seg, b0, back: false };
      this.burned = true;
      this.streak = 0;
      for (const n of seg.notes) {
        if (n.res) continue;
        const r = n.b - b0;
        if (r < 2 || (r >= 10 && r < 11.5)) n.owner = 'skip';
        else if (r < 10) n.owner = 'nora';
      }
      this.says = { who: 'nora', text: 'Donne, petit. Regarde.', t0: this.t, dur: 2.6 };
    },
    takeRel() { return this.take && this.seg === this.take.seg ? this.seg.beat - this.take.b0 : null; },
    takeActive() { const r = this.takeRel(); return r != null && r < 12; },

    // -------------------------------------------------------------- palette
    // Un huit complet si on a le temps, sinon une seule boucle.
    startStroke(gap) {
      const full = gap >= 0.42;
      const base = Math.round(this.ph * 2) / 2;
      this.stroke = { from: this.ph, to: base + (full ? 1 : 0.5), t0: G.time, dur: U.clamp(gap * 0.88, 0.16, full ? 1.0 : 0.45) };
    },
    paddle() {
      const th = this.ph * Math.PI * 2;
      const idle = Math.sin(G.time * 1.3) * 1.5;
      const jolt = this.jolt * Math.sin(G.time * 70) * 3;
      const ex = EIGHT.ax * Math.sin(th) + idle + jolt;
      const ey = EIGHT.ay * Math.sin(th) * Math.cos(th);
      return { ex, ey, sx: SURF.x + ex, sy: SURF.y + ey, jx: SURF.x + ex, jy: SURF.y + ey - STEM };
    },
    // Épaule d'une silhouette debout (même calcul que G.art.person).
    shoulder(id, x, foot, dir, lean) {
      const h = G.CHARS[id].h;
      const hipY = -h * 0.46, tl = h * 0.37;
      const nx = Math.sin(lean) * tl, ny = hipY - Math.cos(lean) * tl;
      return { x: x + (nx + Math.sin(lean) * h * 0.02) * dir, y: foot + ny + h * 0.1, L: h * 0.35 };
    },
    // Le manche part de la pale et passe dans les deux mains.
    grips(sh, J, dir) {
      const Q = { x: sh.x + dir * sh.L * 0.3, y: sh.y + sh.L * 0.78 };
      let ux = Q.x - J.x, uy = Q.y - J.y;
      const len = Math.hypot(ux, uy) || 1;
      ux /= len; uy /= len;
      const R = sh.L * 0.97;
      const wx = J.x - sh.x, wy = J.y - sh.y;
      const b = ux * wx + uy * wy, c = wx * wx + wy * wy - R * R;
      const disc = b * b - c;
      const r = disc > 0 ? Math.sqrt(disc) : 0;
      const s1 = -b - r, s2 = -b + r;
      const front = { x: J.x + ux * s1, y: J.y + uy * s1 };
      const back = { x: J.x + ux * s2, y: J.y + uy * s2 };
      const T = { x: J.x + ux * (s2 + 20), y: J.y + uy * (s2 + 20) };
      const ang = (p) => Math.atan2((p.x - sh.x) * dir, p.y - sh.y);
      return { arms: [ang(back), ang(front)], T };
    },

    // -------------------------------------------------------------- particules
    pop(text, color) { this.pops = [{ text, color, t0: this.t }]; },
    burst(n) {
      for (let i = 0; i < n; i++) this.spark(true);
    },
    spark(bright) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.sparks.push({
        x: KET.x + side * U.rand(60, 104), y: KET.rimY + U.rand(10, 40),
        vx: side * U.rand(4, 26) + U.rand(-8, 8), vy: -U.rand(50, bright ? 170 : 120),
        life: U.rand(1.0, bright ? 2.6 : 2.0), age: 0, s: U.rand(0.9, bright ? 2.4 : 1.8), w: U.rand(0, 6.28),
      });
    },
    puff(g) {
      for (let i = 0; i < 5; i++) this.smoke.push(this.smokeP(Math.min(1, g + 0.35), true));
    },
    smokeP(g, big) {
      const c = mix([214, 204, 188], [30, 24, 20], Math.pow(g, 0.7));
      return {
        x: SURF.x + U.rand(-48, 48), y: SURF.y - 4, vx: U.rand(-5, 5) + 3, vy: -U.rand(16, 32),
        r: U.rand(12, big ? 28 : 18), age: 0, life: U.rand(2.4, 4), c, a: U.lerp(0.2, 0.66, g),
      };
    },

    // -------------------------------------------------------------- mise à jour
    update(dt) {
      const real = performance.now();
      this.hiccup = real - this.lastReal > 400;
      this.lastReal = real;

      // Appui attendu (écran-consigne, écran de fin).
      if (this.waiter && !G.blocked && this.t >= this.waiter.t0 && I.confirm()) {
        I.consume();
        const w = this.waiter;
        this.waiter = null;
        w.res();
      }
      if (this.seg) this.updateSeg(this.seg, dt);

      // Temps musical pour animer la compagnie.
      const playing = this.seg && !this.seg.paused && this.seg.beat >= this.seg.clk.from - 0.05;
      if (playing) this.mbeat = this.seg.beat;
      else this.mbeat += dt * 0.6;
      this.groove = U.lerp(this.groove, playing ? 1 : 0, 1 - Math.pow(0.02, dt));

      // Démonstration sur l'écran-consigne : la palette touille seule.
      if (this.state === 'intro') {
        const n = Math.floor((this.t - 0.4) / 1.5);
        if (n > this.demoN && this.t > 0.4) { this.demoN = n; this.startStroke(1.3); }
      }

      // Palette
      if (this.stroke) {
        const s = this.stroke;
        const k = U.clamp((G.time - s.t0) / s.dur, 0, 1);
        this.ph = U.lerp(s.from, s.to, U.smooth(k));
        if (k >= 1) { this.ph = s.to - Math.floor(s.to); this.stroke = null; }
        if (Math.random() < dt * 22) { const pd = this.paddle(); this.ripples.push({ x: pd.sx, y: pd.sy, age: 0 }); }
      }
      this.jolt = Math.max(0, this.jolt - dt * 3);
      this.gaugeShown = U.lerp(this.gaugeShown, this.gauge, 1 - Math.pow(0.01, dt));

      // Henry et Mrs. Napier (passage de la palette).
      const rel = this.takeRel();
      const r = rel == null ? -1 : rel;
      const tg = {
        henry: { x: kf(r, [[1.6, SPOT.henry], [2.6, SPOT.nora + 8], [10, SPOT.nora + 8], [10.6, SPOT.near - 10], [11.2, SPOT.henry]]),
          foot: kf(r, [[1.6, FEET.front], [2.6, FEET.back], [10, FEET.back], [11.2, FEET.front]]) },
        nora: { x: kf(r, [[0, SPOT.nora], [1.6, SPOT.near], [2.2, SPOT.henry], [10.6, SPOT.henry], [11.8, SPOT.nora]]),
          foot: kf(r, [[1.6, FEET.back], [2.2, FEET.front], [10.6, FEET.front], [11.8, FEET.back]]) },
      };
      if (rel == null) { tg.henry = { x: SPOT.henry, foot: FEET.front }; tg.nora = { x: SPOT.nora, foot: FEET.back }; }
      for (const id of ['henry', 'nora']) {
        const p = this.pos[id];
        // Pendant la reprise, on suit les images clés ; sinon chacun regagne sa place.
        let nx = tg[id].x, nf = tg[id].foot;
        if (rel == null) {
          const step = 140 * dt;
          nx = p.x + U.clamp(nx - p.x, -step, step);
          nf = p.foot + U.clamp(nf - p.foot, -step * 0.2, step * 0.2);
        }
        const dx = nx - p.x;
        p.walk = Math.abs(dx) > 0.25;
        p.phase = (p.phase + Math.abs(dx) / 120) % 1;
        p.x = nx;
        p.foot = nf;
      }
      if (rel != null) this.stirrer = rel >= 1.9 && rel < 10.8 ? 'nora' : 'henry';
      else this.stirrer = Math.abs(this.pos.nora.x - SPOT.henry) < Math.abs(this.pos.henry.x - SPOT.henry) ? 'nora' : 'henry';

      // Particules
      const g = this.gaugeShown;
      if (Math.random() < dt * (16 + 10 * this.groove)) this.spark(false);
      if (Math.random() < dt * (5 + 16 * g)) this.smoke.push(this.smokeP(g, g > 0.6));
      if (Math.random() < dt * (3 + 4 * g)) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.8;
        this.bubbles.push({ x: SURF.x + Math.cos(a) * SURF.rx * d, y: SURF.y + Math.sin(a) * SURF.ry * d, age: 0, life: U.rand(0.5, 1.1), r: U.rand(2.5, 5) });
      }
      for (const s of this.sparks) {
        s.age += dt;
        s.x += (s.vx + Math.sin(s.w + s.age * 5) * 14) * dt;
        s.y += s.vy * dt;
        s.vy *= 1 - dt * 0.35;
      }
      for (const s of this.smoke) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 14; }
      for (const b of this.bubbles) b.age += dt;
      for (const rp of this.ripples) rp.age += dt;
      const alive = (arr) => arr.filter((p) => p.age < (p.life || 0.7));
      this.sparks = alive(this.sparks);
      this.smoke = alive(this.smoke);
      this.bubbles = alive(this.bubbles);
      this.ripples = alive(this.ripples);
      this.pops = this.pops.filter((p) => this.t - p.t0 < 0.8);
      if (this.says && this.t - this.says.t0 > this.says.dur) this.says = null;
      if (this.msg && this.t - this.msg.t0 > this.msg.dur) this.msg = null;
    },

    // -------------------------------------------------------------- dessin
    draw(ctx) {
      const A = G.art;
      const t = G.time;
      const fl = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.1 + 1);

      A.blit(ctx, A.cached('ab-sky', G.W, G.H, drawSky), 0, 0);
      for (const s of STARS) {
        ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.f + s.p));
        ctx.fillStyle = '#E8E2CF';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
      A.blit(ctx, A.cached('ab-land', G.W, G.H, drawLand), 0, 0);

      // Lueurs : fenêtres, lanternes, et surtout le feu.
      A.glow(ctx, 18, 518, 70, '#F2B65A', 0.35);
      A.glow(ctx, 150, 518, 70, '#F2B65A', 0.35);
      A.glow(ctx, 1252, 548, 90, P.lamp, 0.45);
      A.glow(ctx, KET.x, 590, 560, '#E07A2E', 0.34 * fl);
      A.glow(ctx, KET.x, 600, 260, '#FFA850', 0.32 * fl);
      // lanterne posée sur la table
      ctx.fillStyle = '#151210';
      ctx.fillRect(1243, 540, 14, 4);
      ctx.fillStyle = P.lamp;
      ctx.beginPath(); ctx.ellipse(1250, 550, 6, 8, 0, 0, Math.PI * 2); ctx.fill();

      // La compagnie
      const pad = this.paddle();
      const cast = this.cast(pad);
      for (const c of cast) this.shadow(ctx, c);
      const back = cast.filter((c) => c.foot < 607).sort((a, b) => a.foot - b.foot);
      const front = cast.filter((c) => c.foot >= 607).sort((a, b) => a.foot - b.foot);
      for (const c of back) this.drawChar(ctx, c);
      this.drawFireAndKettle(ctx, pad, fl);
      for (const c of front) this.drawChar(ctx, c);
      this.drawHandle(ctx, pad);

      // Étincelles et fumée
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of this.sparks) {
        const k = s.age / s.life;
        ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(s.age * 30 + s.w));
        ctx.fillStyle = k < 0.4 ? '#FFD27A' : '#F08A3A';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.restore();
      for (const s of this.smoke) {
        const k = s.age / s.life;
        const a = s.a * Math.min(1, k * 4) * (1 - k);
        const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        gr.addColorStop(0, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a.toFixed(3)})`);
        gr.addColorStop(1, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      // voile chaud sur toute la cour
      A.glow(ctx, KET.x, 560, 420, '#E58A3A', 0.07 * fl);
      A.finish(ctx);
    },

    // Positions et poses de chacun.
    cast(pad) {
      const g = this.groove, mb = this.mbeat;
      const hop = (o) => Math.abs(Math.sin(Math.PI * (mb + o))) * g;
      const clap = Math.abs(Math.sin(Math.PI * mb)) * g;
      const bow = Math.sin(Math.PI * mb);
      const list = [
        { id: 'abner', x: 92, foot: 596, o: { dir: 1, carry: 'lantern', arms: [0.02, 0.62], lean: 0.035 * Math.sin(Math.PI * mb) * g, seed: 1 } },
        { id: 'hattie', x: 196, foot: 604, o: { dir: 1, pose: 'sit', seatH: 30, carry: 'pipe', seed: 2 }, stump: true },
        { id: 'napierKid', x: 770, foot: 615 - hop(0) * 8, o: { dir: -1, arms: [-0.3 - hop(0) * 1.6, 0.3 + hop(0) * 2.2], seed: 5 } },
        { id: 'napierGirl', x: 842, foot: 609 - hop(0.5) * 6, o: { dir: -1, arms: [U.lerp(0.1, 1.9 - 0.45 * clap, g), U.lerp(0.25, 1.9 + 0.3 * clap, g)], seed: 6 } },
        { id: 'ida', x: 962, foot: 603, o: { dir: -1, arms: [U.lerp(0.1, 1.95 - 0.4 * clap, g), U.lerp(0.3, 1.95 + 0.25 * clap, g)], lean: 0.04 * g, seed: 3 } },
        { id: 'wes', x: 1104, foot: 606, o: { dir: -1, carry: 'fiddle', arms: [U.lerp(0.25, 1.3 + 0.38 * bow, g), U.lerp(0.5, 2.05, g)], lean: -0.05 * g + 0.03 * Math.sin(Math.PI * mb * 0.5) * g, seed: 4 } },
      ];
      // Henry et Mrs. Napier : celui qui touille tient la palette.
      this.grip = null;
      for (const id of ['henry', 'nora']) {
        const p = this.pos[id];
        const o = { dir: 1, seed: id === 'henry' ? 7 : 8, rim: id === 'henry' };
        if (p.walk) { o.pose = 'walk'; o.phase = p.phase; }
        if (this.stirrer === id) {
          o.lean = 0.16 + 0.06 * (pad.ex / EIGHT.ax);
          o.pose = 'stand';
          const sh = this.shoulder(id, p.x, p.foot, 1, o.lean);
          const gr = this.grips(sh, { x: pad.jx, y: pad.jy }, 1);
          o.arms = gr.arms;
          this.grip = gr;
        }
        list.push({ id, x: p.x, foot: p.foot, o });
      }
      if (!this.grip) {
        // Personne ne tient la palette (fin) : elle reste appuyée sur le bord.
        this.grip = { T: { x: pad.jx - 190, y: pad.jy - 30 } };
      }
      return list;
    },

    shadow(ctx, c) {
      const away = c.x < KET.x ? -1 : 1;
      const d = Math.abs(c.x - KET.x);
      const k = U.clamp(1 - d / 900, 0.25, 1);
      ctx.fillStyle = `rgba(6,4,3,${(0.45 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(c.x + away * 26, c.foot + 1, 34 + 14 * k, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    drawChar(ctx, c) {
      if (c.stump) {
        ctx.fillStyle = '#211812';
        ctx.fillRect(c.x - 10, c.foot - 30, 26, 30);
        ctx.fillStyle = '#3A2A1C';
        ctx.beginPath(); ctx.ellipse(c.x + 3, c.foot - 30, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      const r = G.art.char(ctx, c.id, c.x, c.foot, Object.assign({ color: SIL }, c.o));
      this.heads[c.id] = r.head;
    },

    flame(ctx, x, base, w, h, sway) {
      ctx.beginPath();
      ctx.moveTo(x - w, base);
      ctx.quadraticCurveTo(x - w * 0.9, base - h * 0.55, x + sway, base - h);
      ctx.quadraticCurveTo(x + w * 0.9, base - h * 0.55, x + w, base);
      ctx.closePath();
      ctx.fill();
    },

    drawFireAndKettle(ctx, pad, fl) {
      const { x, rimY, rx, ry, depth } = KET;
      const t = G.time;
      const base = GROUND - 6;
      // pieds du trépied
      ctx.strokeStyle = '#120F0D';
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x + 6, rimY + depth - 4); ctx.lineTo(x + 10, GROUND - 14);
      ctx.stroke();
      // flammes de fond
      const tongues = [-70, -48, -26, -6, 14, 34, 56, 74];
      const layers = [['#B8441A', 1, 0.9], ['#EA7A2A', 0.68, 0.95], ['#FFC861', 0.36, 1]];
      for (const [col, sc, al] of layers) {
        ctx.fillStyle = col;
        ctx.globalAlpha = al;
        tongues.forEach((ox, i) => {
          const hh = (34 + (i % 3) * 8) * (0.75 + 0.2 * Math.sin(t * 7 + i * 1.7) + 0.12 * Math.sin(t * 13.3 + i * 2.3));
          this.flame(ctx, x + ox, base, 14 * sc + 4, hh * (0.4 + 0.6 * sc) + 6, Math.sin(t * 5 + i) * 5);
        });
      }
      ctx.globalAlpha = 1;
      // bûches
      ctx.save();
      for (const [lx, ly, a, len] of [[x - 34, base + 2, -0.16, 128], [x + 30, base + 4, 0.19, 120]]) {
        ctx.save();
        ctx.translate(lx, ly); ctx.rotate(a);
        ctx.fillStyle = '#24170F';
        ctx.fillRect(-len / 2, -7, len, 13);
        ctx.fillStyle = `rgba(240,120,40,${(0.55 * fl).toFixed(3)})`;
        ctx.fillRect(-len / 2 + 14, -7, len - 28, 2.5);
        ctx.restore();
      }
      ctx.restore();

      // corps de la bassine (cuivre), éclairé par en dessous
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, rimY, rx, depth, 0, 0, Math.PI);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, rimY, 0, rimY + depth);
      g.addColorStop(0, '#6E3519');
      g.addColorStop(0.5, '#5A2913');
      g.addColorStop(1, '#B85A26');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      const sh = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
      sh.addColorStop(0, 'rgba(0,0,0,0.35)');
      sh.addColorStop(0.3, 'rgba(255,170,90,0.12)');
      sh.addColorStop(0.42, 'rgba(255,190,120,0.22)');
      sh.addColorStop(0.55, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = sh;
      ctx.fillRect(x - rx, rimY, rx * 2, depth + 2);
      G.art.glow(ctx, x, rimY + depth + 6, 70, '#FF9A40', 0.5 * fl);
      ctx.restore();
      // anneau et pieds avant du trépied
      ctx.strokeStyle = '#120F0D';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, rimY + 18, rx * 0.93, ry * 0.9, 0, 0.05, Math.PI - 0.05); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.86, rimY + 24); ctx.lineTo(x - rx - 16, GROUND - 2);
      ctx.moveTo(x + rx * 0.86, rimY + 24); ctx.lineTo(x + rx + 16, GROUND - 2);
      ctx.stroke();
      // petites flammes devant, qui lèchent le fond
      ctx.fillStyle = '#EA7A2A';
      ctx.globalAlpha = 0.85;
      [-30, 2, 28].forEach((ox, i) => this.flame(ctx, x + ox, base + 2, 9, 18 + 8 * Math.sin(t * 9 + i * 2), Math.sin(t * 6 + i) * 3));
      ctx.fillStyle = '#FFC861';
      [-30, 2, 28].forEach((ox, i) => this.flame(ctx, x + ox, base + 2, 4, 9 + 5 * Math.sin(t * 9 + i * 2), Math.sin(t * 6 + i) * 2));
      ctx.globalAlpha = 1;

      // intérieur et beurre
      ctx.fillStyle = '#26130A';
      ctx.beginPath(); ctx.ellipse(x, rimY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      const gs = this.gaugeShown;
      const cIn = mix([128, 60, 24], [70, 32, 14], gs), cOut = mix([74, 33, 13], [36, 17, 8], gs);
      const bg = ctx.createRadialGradient(SURF.x - 10, SURF.y - 3, 4, SURF.x, SURF.y, SURF.rx);
      bg.addColorStop(0, `rgb(${cIn})`);
      bg.addColorStop(1, `rgb(${cOut})`);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(SURF.x, SURF.y, SURF.rx, SURF.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.clip();
      // reflet de lune et de feu sur la pâte
      ctx.fillStyle = 'rgba(255,190,120,0.10)';
      ctx.beginPath(); ctx.ellipse(SURF.x - 24, SURF.y - 4, 30, 4, -0.05, 0, Math.PI * 2); ctx.fill();
      // bulles
      for (const b of this.bubbles) {
        const k = b.age / b.life;
        if (k < 0.8) {
          const rr = b.r * U.easeOut(k / 0.8);
          ctx.fillStyle = 'rgba(40,18,8,0.55)';
          ctx.beginPath(); ctx.ellipse(b.x, b.y, rr, rr * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(210,130,70,0.35)';
          ctx.beginPath(); ctx.ellipse(b.x - rr * 0.3, b.y - rr * 0.25, rr * 0.35, rr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          const q = (k - 0.8) / 0.2;
          ctx.strokeStyle = `rgba(200,120,60,${(0.4 * (1 - q)).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * (1 + q), b.r * 0.6 * (1 + q), 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // remous laissés par la palette
      for (const rp of this.ripples) {
        const k = rp.age / 0.7;
        ctx.strokeStyle = `rgba(190,110,55,${(0.45 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 5 + k * 16, (5 + k * 16) * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // taches qui attachent
      if (gs > 0.3) {
        ctx.fillStyle = `rgba(12,6,3,${((gs - 0.3) * 0.7).toFixed(3)})`;
        for (const [ox, oy, rr] of [[-50, 4, 12], [38, -3, 10], [-12, 7, 9], [58, 5, 7]]) {
          ctx.beginPath(); ctx.ellipse(SURF.x + ox, SURF.y + oy, rr, rr * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      // bord arrière
      ctx.strokeStyle = '#8E4C25';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, rimY, rx, ry, 0, Math.PI, Math.PI * 2); ctx.stroke();

      // pale verticale qui plonge dans le beurre
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#3A2918';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(pad.jx, pad.jy); ctx.lineTo(pad.sx, pad.sy); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,120,60,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad.jx + 3, pad.jy + 2); ctx.lineTo(pad.sx + 3, pad.sy); ctx.stroke();
      ctx.fillStyle = 'rgba(60,26,10,0.9)';
      ctx.beginPath(); ctx.ellipse(pad.sx, pad.sy, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineCap = 'round';

      // bord avant, cuivre éclairé
      ctx.strokeStyle = '#C47E46';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, rimY, rx, ry, 0, 0.02, Math.PI - 0.02); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,150,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, rimY - 1, rx - 1, ry - 1, 0, 0.35, 1.25); ctx.stroke();
      // anses
      ctx.strokeStyle = '#2A1A10';
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(x + s * (rx + 2), rimY + 6, 7, s > 0 ? -1.2 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.2); ctx.stroke();
      }
    },

    // Le long manche, de la pale aux mains de celui qui touille.
    drawHandle(ctx, pad) {
      const T = this.grip.T;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#33241A';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(pad.jx, pad.jy); ctx.stroke();
      ctx.strokeStyle = 'rgba(214,130,64,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(T.x + 2, T.y + 2.5); ctx.lineTo(pad.jx + 1, pad.jy + 2.5); ctx.stroke();
      ctx.fillStyle = '#2A1D14';
      ctx.beginPath(); ctx.arc(pad.jx, pad.jy, 4.5, 0, Math.PI * 2); ctx.fill();
    },

    // -------------------------------------------------------------- interface
    drawUI(uctx) {
      const seg = this.seg;
      const st = this.state;
      if (st === 'intro') this.drawIntro(uctx);
      if (seg && !seg.paused) this.drawRings(uctx, seg);
      else if (st === 'trial' || st === 'trialMsg' || st === 'couplet') this.drawTarget(uctx, 0);

      // consignes
      if (st === 'trial') {
        ui.hint(uctx, 'Essai : clique ou appuie sur Espace quand le cercle touche la palette.');
        ui.text(uctx, 'Wes accorde son violon.', G.W / 2, 84, { size: 18, italic: true, align: 'center', color: 'rgba(232,223,204,0.6)' });
      } else if (st === 'couplet' && this.couplet === 0 && seg && seg.beat < 10) {
        ui.hint(uctx, 'Clique ou appuie sur Espace quand le cercle touche la palette.');
      }
      if (seg && !seg.paused) this.drawCount(uctx, seg);
      if (this.msg) {
        const k = this.t - this.msg.t0;
        const a = Math.min(1, k * 4) * Math.min(1, (this.msg.dur - k) * 3);
        ui.text(uctx, this.msg.text, G.W / 2, 330, { size: 34, italic: true, align: 'center', base: 'middle', alpha: Math.max(0, a), shadow: true });
      }

      // jugements
      for (const p of this.pops) {
        const k = (this.t - p.t0) / 0.8;
        ui.text(uctx, p.text, TARGET.x, TARGET.y - 44 - U.easeOut(k) * 26, {
          size: p.text === 'Parfait' ? 26 : 23, italic: true, align: 'center', base: 'middle', color: p.color, alpha: 1 - k * k, shadow: true,
        });
      }

      // couplet, jauge « Ça attache », série
      if (st === 'couplet') {
        ui.caps(uctx, `Couplet ${this.couplet + 1} / 3`, 32, 42, { size: 14, color: 'rgba(232,223,204,0.62)' });
        ui.text(uctx, `${COUPLETS[this.couplet].bpm} temps à la minute`, 32, 64, { size: 16, italic: true, color: 'rgba(232,223,204,0.42)' });
        this.drawGauge(uctx);
      }

      // bulle de Mrs. Napier
      if (this.says && this.heads.nora) {
        const k = this.t - this.says.t0;
        const a = Math.min(1, k * 5) * Math.min(1, (this.says.dur - k) * 4);
        this.bubble(uctx, this.says.text, this.heads.nora.x, this.heads.nora.y - 30, Math.max(0, a));
      }
      if (st === 'end') this.drawEnd(uctx);
    },

    drawTarget(uctx, glow) {
      uctx.save();
      uctx.strokeStyle = `rgba(232,223,204,${(0.42 + 0.4 * glow).toFixed(3)})`;
      uctx.lineWidth = 2;
      uctx.beginPath(); uctx.arc(TARGET.x, TARGET.y, TARGET.r, 0, Math.PI * 2); uctx.stroke();
      if (glow > 0) {
        uctx.fillStyle = `rgba(242,210,122,${(0.14 * glow).toFixed(3)})`;
        uctx.beginPath(); uctx.arc(TARGET.x, TARGET.y, TARGET.r, 0, Math.PI * 2); uctx.fill();
      }
      uctx.restore();
    },

    // Cercles d'approche : un par note, qui se resserre sur la palette.
    drawRings(uctx, seg) {
      const clk = seg.clk;
      const now = this.now(clk);
      const app = U.clamp(seg.spb * 1.7, 0.75, 1.1);
      let glow = 0;
      uctx.save();
      for (const n of seg.notes) {
        if (n.res || n.owner !== 'henry') continue;
        const dt = this.timeOf(clk, n.b) - now;
        if (dt > app || dt < -WIN_GOOD) continue;
        const k = U.clamp(dt / app, 0, 1);
        const r = TARGET.r + k * (TARGET.r0 - TARGET.r);
        const a = Math.min(1, (1 - k) * 3) * (dt < 0 ? 1 + dt / WIN_GOOD : 1);
        const off = Math.abs(n.b % 1) > 0.01;
        uctx.strokeStyle = off ? `rgba(232,150,90,${(0.9 * a).toFixed(3)})` : `rgba(242,210,122,${(0.9 * a).toFixed(3)})`;
        uctx.lineWidth = 2 + (1 - k) * 1.5;
        uctx.beginPath(); uctx.arc(TARGET.x, TARGET.y, r, 0, Math.PI * 2); uctx.stroke();
        if (Math.abs(dt) < WIN_PERFECT) glow = Math.max(glow, 1 - Math.abs(dt) / WIN_PERFECT);
      }
      uctx.restore();
      this.drawTarget(uctx, glow);
    },

    // « Un… deux… » avant chaque départ.
    drawCount(uctx, seg) {
      const from = seg.clk.from;
      const b = seg.beat;
      if (b < from - COUNT_IN || b >= from) return;
      const k = b - Math.floor(b);
      const word = b < from - 1 ? 'Un…' : 'deux…';
      ui.text(uctx, word, G.W / 2, 330, {
        size: 44 + (1 - k) * 8, italic: true, align: 'center', base: 'middle', alpha: 1 - k * 0.6, shadow: true, color: P.paper,
      });
    },

    drawGauge(uctx) {
      const x = 32, y = 662, w = 210, h = 9;
      const g = this.gaugeShown;
      const pulse = g > 0.7 ? 0.5 + 0.5 * Math.sin(this.t * 9) : 0;
      ui.caps(uctx, 'Ça attache', x, y - 10, { size: 13, color: g > 0.7 ? `rgba(227,122,44,${(0.7 + 0.3 * pulse).toFixed(3)})` : 'rgba(232,223,204,0.6)' });
      const c = g < 0.5 ? mix([217, 164, 65], [227, 122, 44], g * 2) : mix([227, 122, 44], [150, 40, 22], (g - 0.5) * 2);
      ui.bar(uctx, x, y, w, h, g, { color: `rgb(${c})`, bg: 'rgba(232,223,204,0.16)' });
      if (this.streak >= 4) {
        ui.text(uctx, `Série : ${this.streak}`, x, y + 34, { size: 18, italic: true, color: 'rgba(242,210,122,0.75)' });
      }
    },

    bubble(uctx, text, x, y, alpha) {
      uctx.save();
      uctx.globalAlpha = alpha;
      uctx.font = ui.font(21, 'serif', 'italic');
      const w = uctx.measureText(text).width + 30;
      const bx = U.clamp(x - w / 2, 12, G.W - w - 12), by = y - 38;
      uctx.fillStyle = 'rgba(236,228,210,0.95)';
      uctx.beginPath(); uctx.roundRect(bx, by, w, 36, 10); uctx.fill();
      uctx.beginPath(); uctx.moveTo(x - 6, by + 35); uctx.lineTo(x + 6, by + 35); uctx.lineTo(x + 1, by + 46); uctx.fill();
      ui.text(uctx, text, bx + w / 2, by + 19, { size: 21, italic: true, color: P.ink, align: 'center', base: 'middle' });
      uctx.restore();
    },

    drawIntro(uctx) {
      const a = U.clamp((this.t - 0.2) * 2.5, 0, 1);
      // anneau de démonstration
      const k = ((this.t - 0.4) % 1.5) / 1.5;
      if (this.t > 0.4) {
        uctx.save();
        uctx.globalAlpha = a;
        uctx.strokeStyle = `rgba(242,210,122,${(0.85 * Math.min(1, k * 3)).toFixed(3)})`;
        uctx.lineWidth = 2 + k * 1.5;
        uctx.beginPath(); uctx.arc(TARGET.x, TARGET.y, TARGET.r + (1 - k) * (TARGET.r0 - TARGET.r), 0, Math.PI * 2); uctx.stroke();
        uctx.restore();
        this.drawTarget(uctx, k > 0.92 ? (k - 0.92) / 0.08 : 0);
      }
      const pw = 700, ph = 214, px = G.W / 2 - pw / 2, py = 74;
      uctx.save();
      uctx.globalAlpha = a;
      uctx.fillStyle = 'rgba(18,14,12,0.86)';
      uctx.beginPath(); uctx.roundRect(px, py, pw, ph, 10); uctx.fill();
      uctx.strokeStyle = 'rgba(232,223,204,0.16)';
      uctx.lineWidth = 1;
      uctx.stroke();
      ui.caps(uctx, 'Touiller en rythme', G.W / 2, py + 40, { size: 15, align: 'center', color: P.rim, spacing: 4 });
      ui.text(uctx, 'Toute la nuit, on touille sans s\'arrêter, sinon ça attache au fond.', G.W / 2, py + 84, {
        size: 21, italic: true, align: 'center', color: '#D8CFBC',
      });
      ui.text(uctx, 'Clique ou appuie sur Espace quand le cercle touche la palette.', G.W / 2, py + 140, { size: 25, align: 'center' });
      const blink = 0.55 + 0.45 * Math.sin(this.t * 3.2);
      ui.text(uctx, 'Clique ou appuie sur Espace pour un essai', G.W / 2, py + 186, { size: 18, italic: true, align: 'center', color: P.rim, alpha: blink });
      uctx.restore();
    },

    drawEnd(uctx) {
      const r = this.result;
      if (!r) return;
      const k = U.clamp((this.t - this.endT) * 2, 0, 1);
      const pw = 560, ph = 300, px = G.W / 2 - pw / 2, py = 70;
      uctx.save();
      uctx.globalAlpha = k;
      uctx.fillStyle = 'rgba(18,14,12,0.88)';
      uctx.beginPath(); uctx.roundRect(px, py, pw, ph, 10); uctx.fill();
      uctx.strokeStyle = 'rgba(232,223,204,0.16)';
      uctx.lineWidth = 1;
      uctx.stroke();
      ui.caps(uctx, 'Au petit jour', G.W / 2, py + 40, { size: 15, align: 'center', color: P.rim, spacing: 4 });
      // les pots
      for (let i = 0; i < 3; i++) {
        const jx = G.W / 2 - 75 + i * 75, jy = py + 70;
        const full = i < r.jars;
        uctx.fillStyle = full ? '#7A3A17' : 'rgba(232,223,204,0.08)';
        uctx.strokeStyle = full ? 'rgba(232,223,204,0.55)' : 'rgba(232,223,204,0.25)';
        uctx.lineWidth = 1.5;
        uctx.beginPath(); uctx.roundRect(jx - 20, jy + 8, 40, 50, 7); uctx.fill(); uctx.stroke();
        uctx.fillStyle = full ? '#C9A26A' : 'rgba(232,223,204,0.2)';
        uctx.fillRect(jx - 22, jy, 44, 9);
        if (full) {
          uctx.fillStyle = 'rgba(255,200,140,0.18)';
          uctx.fillRect(jx - 14, jy + 14, 6, 36);
        }
      }
      const jarsTxt = `${NUM[r.jars]} pot${r.jars > 1 ? 's' : ''} de beurre de pommes`;
      ui.text(uctx, jarsTxt, G.W / 2, py + 168, { size: 27, align: 'center' });
      ui.text(uctx, `Parfait : ${r.perfects}   ·   Bien : ${r.goods}   ·   Raté : ${r.misses}`, G.W / 2, py + 206, {
        size: 19, italic: true, align: 'center', color: '#D8CFBC',
      });
      if (r.burned) {
        ui.text(uctx, 'Ça a attaché un moment : Mrs. Napier a dû reprendre la palette.', G.W / 2, py + 238, {
          size: 17, italic: true, align: 'center', color: 'rgba(227,150,100,0.85)',
        });
      }
      if (this.t - this.endT > 1.2) {
        const blink = 0.55 + 0.45 * Math.sin(this.t * 3.2);
        ui.text(uctx, 'Clique ou appuie sur Espace', G.W / 2, py + ph - 22, { size: 17, italic: true, align: 'center', color: P.rim, alpha: blink });
      }
      uctx.restore();
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.applebutter = () => G.play(G.Scenes.applebutter({
    interlude: async (i) => G.say('nora', i === 0 ? 'Pas mal, le petit Caudill !' : 'Wes, accélère, on va voir ce qu\'il a dans le ventre.'),
  }));
})();
