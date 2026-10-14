'use strict';
// « La livraison » : mini-jeu d'infiltration, la nuit.
// Henry porte une caisse de six bocaux de moonshine pour Dow Slone, à travers les
// bois, jusqu'au vieux hangar du carreau de la mine. En contrebas, sur la route,
// un agent fédéral de la Prohibition rôde avec sa lanterne.
//
//   G.Scenes.moonshine({ onArrive: async (résultat, scène) => {} })
//   → promesse résolue par { jars, broken, caught, seconds }
//
// Commandes : → ou D avancer, ← ou Q reculer, ↓, S ou Maj se baisser (maintenu),
// Espace, clic ou toucher pour rattraper un bocal et sauter de pierre en pierre.
// À l'écran : « Reculer » et « Avancer » (maintenus), « Se baisser » (bascule).
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL;
  const W = G.W, H = G.H, TAU = Math.PI * 2;

  // ================================================================== le terrain
  const WORLD = 3700;
  const CHUNK = 740;
  const NCHUNK = Math.ceil(WORLD / CHUNK);
  const TRAIL = 420;                 // hauteur moyenne du sentier (pieds d'Henry)
  const ROAD = 666;                  // pieds de l'agent, sur la route en contrebas
  const START_X = 150;
  const CPS = [START_X, 1040, 2340, 3060]; // départ, puis les trois points de passage
  const SAFE_X = 3330;               // au-delà, l'agent ne voit plus Henry
  const ARRIVE_X = 3380;
  const HENRY_STOP = 3420;
  const HANGAR_X = 3492;
  const LIGE_WALL = HANGAR_X + 104, LIGE_MEET = 3468; // Lige attend contre le mur, dans l'ombre
  const SPEED = 54, CROUCH_SPEED = 30;
  const AG_H = (G.CHARS.revenuer && G.CHARS.revenuer.h) || 166;
  const BEAM_HW = 92;                // demi-largeur de la tache de lumière sur le sentier
  const PF = { far: 0.08, mid: 0.22, trees: 0.5 };

  const CREEK = { x0: 1950, x1: 2290, mid: 2120 };
  const STONES = [
    { x: 2018, period: 1.7, phase: 0.15 },
    { x: 2086, period: 1.45, phase: 0.85 },
    { x: 2154, period: 1.9, phase: 0.4 },
    { x: 2222, period: 1.6, phase: 1.15 },
  ];
  const STABLE = 0.42;               // part du cycle où la pierre ne bouge pas
  const HOP = 0.36;
  const LOGS = [950, 2540];          // troncs couchés : un bocal glisse
  const SLIP = 0.22, WIN = 0.8;
  const TRUNKS = [
    { x: 480, w: 88 }, { x: 650, w: 96 }, { x: 1120, w: 92 },
    { x: 1835, w: 100 }, { x: 2620, w: 92 }, { x: 2995, w: 96 },
  ];
  const ROCKS = [{ x: 1600, w: 150, h: 146 }, { x: 3145, w: 146, h: 142 }];
  const FERNS = [[222, 332], [730, 862], [1348, 1472], [2356, 2470], [2832, 2932], [3282, 3352]];
  const LEAVES = [[530, 612], [1180, 1320], [1665, 1785], [2668, 2752], [3195, 3268]];
  const STICKS = [400, 1500, 1730, 2712, 3240];
  const DOG_X = 2790, DOG_R = 430;
  const FARM_X = 2690, FARM_W = 176;
  const CROUCH_KEYS = ['ArrowDown', 'KeyS', 'ShiftLeft', 'ShiftRight', 'KeyC'];

  const BTN = {
    back: { x: 20, y: 622, w: 132, h: 80 },
    fwd: { x: 162, y: 622, w: 214, h: 80 },
    crouch: { x: W - 20 - 232, y: 622, w: 232, h: 80 },
  };

  // ------------------------------------------------------------------ relief
  const trailBase = (x) => TRAIL + 12 * Math.sin(x / 280 + 0.6) + 6 * Math.sin(x / 113 + 2.1);
  function creekDip(x) {
    const a = CREEK.x0 - 170, b = CREEK.x0 - 10, c = CREEK.x1 + 10, d = CREEK.x1 + 170;
    if (x <= a || x >= d) return 0;
    if (x < b) return 24 * U.smooth((x - a) / (b - a));
    if (x > c) return 24 * U.smooth((d - x) / (d - c));
    return 24;
  }
  function trailY(x) {
    const y = trailBase(x) + creekDip(x);
    const k = U.smooth(U.clamp((x - 3240) / 140, 0, 1)); // le carreau de la mine est plat
    return y * (1 - k) + (TRAIL + 8) * k;
  }
  function logBump(x) {
    for (const lx of LOGS) {
      const d = Math.abs(x - lx);
      if (d < 34) return -20 * (0.5 + 0.5 * Math.cos(Math.PI * d / 34));
    }
    return 0;
  }
  const footY = (x) => trailY(x) + logBump(x);
  const upY = (x) => 340 + 14 * Math.sin(x / 390 + 1.3) + 8 * Math.sin(x / 141);
  const WATER_Y = trailY(CREEK.mid) + 16;

  const inRanges = (x, list) => list.some(([a, b]) => x >= a && x <= b);
  const onLeaves = (x) => inRanges(x, LEAVES);
  function coverAt(x, crouched) {
    for (const t of TRUNKS) if (Math.abs(x - t.x) < t.w / 2 - 8) return 'trunk';
    for (const r of ROCKS) if (Math.abs(x - r.x) < r.w / 2 - 14) return 'rock';
    if (crouched) for (const [a, b] of FERNS) if (x >= a + 8 && x <= b - 8) return 'ferns';
    return null;
  }

  // ------------------------------------------------------------------ la lanterne
  // Position de la lanterne selon la hauteur du bras (lift : 0 baissé, 1 levé).
  function lanternPos(a) {
    const ang = U.lerp(0.14, 2.45, U.smooth(U.clamp(a.lift, 0, 1)));
    const shY = -0.73 * AG_H;
    const hx = Math.sin(ang) * 0.35 * AG_H, hy = shY + Math.cos(ang) * 0.35 * AG_H;
    return { x: a.x + a.dir * hx, y: ROAD + hy + AG_H * 0.03 + 11, ang };
  }
  const beamTarget = (x) => ({ x, y: trailY(x) - 62 });
  function inBeam(L, T, px, py) {
    const dx = T.x - L.x, dy = T.y - L.y, d = Math.hypot(dx, dy);
    const half = Math.atan2(BEAM_HW, d);
    const ex = px - L.x, ey = py - L.y;
    if (Math.hypot(ex, ey) > d * 1.5) return false;
    let da = Math.atan2(ey, ex) - Math.atan2(dy, dx);
    da = Math.atan2(Math.sin(da), Math.cos(da));
    return Math.abs(da) < half;
  }
  function evalPath(p, t) {
    if (t <= p[0][0]) return p[0][1];
    for (let i = 0; i < p.length - 1; i++) {
      const [t0, x0] = p[i], [t1, x1] = p[i + 1];
      if (t <= t1) return t1 > t0 ? U.lerp(x0, x1, U.smooth((t - t0) / (t1 - t0))) : x1;
    }
    return p[p.length - 1][1];
  }
  function stoneState(i, t) {
    const s = STONES[i];
    const u = (((t + s.phase) % s.period) + s.period) % s.period / s.period;
    if (u < STABLE) return { stable: true, rot: 0, dy: 0, u };
    const k = (u - STABLE) / (1 - STABLE);
    const env = Math.sin(Math.PI * k);
    return { stable: false, rot: Math.sin(k * TAU * 2) * 0.24 * env, dy: Math.abs(Math.sin(k * TAU * 2)) * 3 * env, u };
  }
  // Un peu d'indulgence : la pierre compte encore comme stable un court instant.
  const stoneStable = (i, t) => {
    const st = stoneState(i, t);
    return st.stable || st.u > 1 - 0.05 / STONES[i].period || st.u < STABLE + 0.08 / STONES[i].period;
  };
  const stoneTop = (i, t) => WATER_Y - 10 + stoneState(i, t).dy;

  const camFor = (x) => U.clamp(x - W * 0.4, 0, WORLD - W);

  function mix(c1, c2, k) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ch = (s) => Math.round(U.lerp((a >> s) & 255, (b >> s) & 255, k));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ================================================================== décor peint (caches)
  function fillBetween(cx, xa, xb, topFn, botFn, style, step = 8) {
    cx.beginPath();
    cx.moveTo(xa, topFn(xa));
    for (let x = xa; x < xb; x += step) cx.lineTo(x, topFn(x));
    cx.lineTo(xb, topFn(xb));
    for (let x = xb; x > xa; x -= step) cx.lineTo(x, botFn(x));
    cx.lineTo(xa, botFn(xa));
    cx.closePath();
    cx.fillStyle = style;
    cx.fill();
  }
  function strokeAlong(cx, xa, xb, fn, style, width, step = 8) {
    cx.beginPath();
    cx.moveTo(xa, fn(xa));
    for (let x = xa; x < xb; x += step) cx.lineTo(x, fn(x));
    cx.lineTo(xb, fn(xb));
    cx.strokeStyle = style;
    cx.lineWidth = width;
    cx.stroke();
  }

  function drawSky(cx) {
    G.art.sky(cx, W, H, [[0, '#060b17'], [0.35, '#0f1b31'], [0.62, '#1f2f4d'], [1, '#22324f']]);
    const rnd = U.rng(42);
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W, y = rnd() * 320, big = rnd() < 0.08;
      cx.globalAlpha = (0.2 + rnd() * 0.6) * (1 - y / 420);
      cx.fillStyle = '#dfe6f0';
      cx.beginPath(); cx.arc(x, y, big ? 1.4 : 0.8, 0, TAU); cx.fill();
    }
    cx.globalAlpha = 1;
    const mx = 1010, my = 112;
    const g = cx.createRadialGradient(mx, my, 20, mx, my, 330);
    g.addColorStop(0, 'rgba(205,218,240,0.34)');
    g.addColorStop(0.25, 'rgba(160,182,220,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#EDEAD9';
    cx.beginPath(); cx.arc(mx, my, 34, 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(150,152,160,0.28)';
    for (const [dx, dy, r] of [[-10, -8, 9], [8, 6, 7], [-4, 13, 5], [12, -12, 4], [-15, 8, 4]]) {
      cx.beginPath(); cx.arc(mx + dx, my + dy, r, 0, TAU); cx.fill();
    }
  }

  function drawFarRidge(cx, w) {
    const r = G.art.makeRidge(11, w, 226, 32, 130);
    G.art.ridge(cx, r, '#1a2742', H);
    cx.save();
    cx.beginPath();
    cx.moveTo(r[0][0], r[0][1]);
    for (let i = 1; i < r.length - 1; i++) {
      cx.quadraticCurveTo(r[i][0], r[i][1], (r[i][0] + r[i + 1][0]) / 2, (r[i][1] + r[i + 1][1]) / 2);
    }
    cx.strokeStyle = 'rgba(150,172,210,0.16)';
    cx.lineWidth = 2;
    cx.stroke();
    cx.restore();
    const g = cx.createLinearGradient(0, 240, 0, 330);
    g.addColorStop(0, 'rgba(70,90,124,0)');
    g.addColorStop(1, 'rgba(70,90,124,0.4)');
    cx.fillStyle = g;
    cx.fillRect(0, 240, w, 100);
  }

  function drawMidRidge(cx, w) {
    const r = G.art.makeRidge(23, w, 274, 24, 110);
    G.art.ridge(cx, r, '#131d32', H);
    G.art.dots(cx, 7, Math.round(w / 2.4), 0, w, (x) => { const y = G.art.ridgeY(r, x); return [y - 6, y + 30]; },
      ['#152036', '#111b2f', '#18253e'], 3, 7, 0.8, 1);
    const g = cx.createLinearGradient(0, 290, 0, 360);
    g.addColorStop(0, 'rgba(60,80,112,0)');
    g.addColorStop(1, 'rgba(60,80,112,0.35)');
    cx.fillStyle = g;
    cx.fillRect(0, 290, w, 80);
  }

  function drawFarTrees(cx, w) {
    const rnd = U.rng(55);
    for (let x = 0; x < w; x += 20 + rnd() * 46) {
      const tw = 3 + rnd() * 9, base = 338 + rnd() * 26, k = rnd();
      cx.fillStyle = mix('#22304a', '#172338', k);
      cx.beginPath();
      cx.moveTo(x - tw / 2, base);
      cx.lineTo(x - tw * 0.28, -10);
      cx.lineTo(x + tw * 0.28, -10);
      cx.lineTo(x + tw / 2, base);
      cx.fill();
      cx.strokeStyle = cx.fillStyle;
      cx.lineWidth = 1.5;
      for (let b = 0; b < 3; b++) {
        const by = 40 + rnd() * 220, s = rnd() < 0.5 ? -1 : 1;
        cx.beginPath(); cx.moveTo(x, by); cx.lineTo(x + s * (14 + rnd() * 26), by - 18 - rnd() * 26); cx.stroke();
      }
    }
    const g = cx.createLinearGradient(0, 250, 0, 372);
    g.addColorStop(0, 'rgba(64,84,116,0)');
    g.addColorStop(1, 'rgba(64,84,116,0.5)');
    cx.fillStyle = g;
    cx.fillRect(0, 250, w, 130);
  }

  // Troncs du fond, sur la pente du haut : du décor, pas des abris.
  const BG_TRUNKS = (() => {
    const rnd = U.rng(901);
    const out = [];
    for (let x = -40; x < WORLD + 60; x += 30 + rnd() * 58) {
      const d = rnd(), seed = Math.floor(rnd() * 1e6), skip = rnd();
      if (x > FARM_X - 40 && x < FARM_X + FARM_W + 40) continue;
      if (x > 3290 && skip < 0.8) continue;
      if (Math.abs(x - CREEK.mid) < 80) continue;
      out.push({ x, d, w: U.lerp(4, 17, d * d), seed });
    }
    return out.sort((a, b) => a.d - b.d);
  })();
  function bgTrunk(cx, t) {
    const base = U.lerp(upY(t.x) + 6, trailY(t.x) - 12, t.d);
    const rnd = U.rng(t.seed);
    const lean = (rnd() - 0.5) * 8;
    cx.fillStyle = mix('#1f2c45', '#0b111b', t.d);
    cx.beginPath();
    cx.moveTo(t.x - t.w / 2 - 2, base);
    cx.lineTo(t.x - t.w * 0.3 + lean, -10);
    cx.lineTo(t.x + t.w * 0.3 + lean, -10);
    cx.lineTo(t.x + t.w / 2 + 2, base);
    cx.fill();
    cx.strokeStyle = cx.fillStyle;
    cx.lineWidth = Math.max(1, t.w * 0.18);
    for (let b = 0; b < 2; b++) {
      const by = 30 + rnd() * 200, s = rnd() < 0.5 ? -1 : 1;
      cx.beginPath(); cx.moveTo(t.x + lean * (1 - by / base), by); cx.lineTo(t.x + s * (16 + rnd() * 30), by - 20 - rnd() * 30); cx.stroke();
    }
    if (t.d > 0.35) {
      cx.strokeStyle = `rgba(140,165,205,${0.08 + 0.14 * t.d})`;
      cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(t.x + t.w / 2, base - 4); cx.lineTo(t.x + t.w * 0.28 + lean, -10); cx.stroke();
    }
  }

  function drawLeaves(cx, a, b) {
    const taper = (x) => Math.sin(Math.PI * U.clamp((x - a) / (b - a), 0, 1));
    fillBetween(cx, a - 6, b + 6, (x) => trailY(x) - 2 - 4 * taper(x), (x) => trailY(x) + 9, 'rgba(128,104,68,0.5)', 4);
    const rnd = U.rng(a * 13 + 7);
    const n = Math.round((b - a) * 2.2);
    for (let i = 0; i < n; i++) {
      const x = a - 8 + rnd() * (b - a + 16), dy = rnd(), c = Math.floor(rnd() * 6), rx = rnd(), ry = rnd(), rot = rnd(), al = rnd(), keep = rnd();
      if (keep > 0.25 + 0.75 * taper(x)) continue;
      cx.globalAlpha = 0.72 + al * 0.28;
      cx.fillStyle = ['#8a7550', '#7d6a48', '#a48c5e', '#6b5a3e', '#94603a', '#b3955f'][c];
      cx.beginPath();
      cx.ellipse(x, trailY(x) - 5 * taper(x) + dy * 14, 2.3 + rx * 2.6, 1.2 + ry * 1.3, rot * Math.PI, 0, TAU);
      cx.fill();
    }
    cx.globalAlpha = 1;
  }

  function drawStick(cx, x) {
    const y = trailY(x) + 3;
    cx.save();
    cx.lineCap = 'round';
    cx.strokeStyle = '#7d7262';
    cx.lineWidth = 2.6;
    cx.beginPath(); cx.moveTo(x - 20, y - 3); cx.lineTo(x + 22, y + 5); cx.stroke();
    cx.strokeStyle = '#a19582';
    cx.lineWidth = 3.6;
    cx.beginPath(); cx.moveTo(x - 32, y + 3); cx.lineTo(x + 30, y - 3); cx.stroke();
    cx.lineWidth = 2;
    for (const [x1, y1, x2, y2] of [[-12, 1.5, -22, -10], [4, -0.5, 12, -13], [15, -1.5, 27, 4], [-22, 2, -33, -5], [-4, 0, -8, -9]]) {
      cx.beginPath(); cx.moveTo(x + x1, y + y1); cx.lineTo(x + x2, y + y2); cx.stroke();
    }
    cx.restore();
  }

  function drawLog(cx, x) {
    const y = trailY(x) + 8;
    cx.save();
    cx.translate(x, y);
    cx.rotate(-0.05);
    cx.fillStyle = '#17120e';
    cx.beginPath(); cx.roundRect(-44, -28, 88, 28, 12); cx.fill();
    cx.strokeStyle = 'rgba(8,6,4,0.8)';
    cx.lineWidth = 1.5;
    for (const yy of [-21, -14, -8]) { cx.beginPath(); cx.moveTo(-36, yy); cx.lineTo(38, yy + 1); cx.stroke(); }
    cx.strokeStyle = 'rgba(160,180,210,0.4)';
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(-34, -27); cx.lineTo(36, -27); cx.stroke();
    cx.fillStyle = '#6e5e48';
    cx.beginPath(); cx.ellipse(-44, -14, 7.5, 14, 0, 0, TAU); cx.fill();
    cx.strokeStyle = '#4a3d2e';
    cx.lineWidth = 1;
    for (const k of [0.7, 0.4]) { cx.beginPath(); cx.ellipse(-44, -14, 7.5 * k, 14 * k, 0, 0, TAU); cx.stroke(); }
    cx.fillStyle = '#26352a';
    for (const [mx, mw] of [[-20, 14], [8, 10], [24, 8]]) { cx.beginPath(); cx.ellipse(mx, -27, mw, 3, 0, 0, TAU); cx.fill(); }
    cx.strokeStyle = '#17120e';
    cx.lineWidth = 4;
    cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(14, -26); cx.lineTo(24, -44); cx.stroke();
    cx.restore();
  }

  function drawCreekStatic(cx) {
    const { x0, x1, mid } = CREEK;
    const wy = WATER_Y;
    // le ruisseau qui descend de la pente du haut
    cx.fillStyle = '#132336';
    cx.beginPath();
    cx.moveTo(mid - 70, wy + 2);
    cx.quadraticCurveTo(mid - 26, wy - 24, mid - 10, upY(mid) + 6);
    cx.lineTo(mid + 6, upY(mid) + 6);
    cx.quadraticCurveTo(mid + 24, wy - 24, mid + 70, wy + 2);
    cx.fill();
    cx.strokeStyle = 'rgba(160,190,220,0.18)';
    cx.lineWidth = 1.2;
    for (const [k, w] of [[0.3, 8], [0.6, 14], [0.85, 22]]) {
      const y = U.lerp(upY(mid) + 6, wy, k);
      cx.beginPath(); cx.moveTo(mid - w, y); cx.lineTo(mid + w * 0.6, y + 1); cx.stroke();
    }
    // berges
    cx.fillStyle = '#0a0f17';
    cx.beginPath();
    cx.moveTo(x0 - 40, trailY(x0 - 40) + 4); cx.lineTo(x0 + 6, trailY(x0) + 2); cx.lineTo(x0 + 22, wy + 16); cx.lineTo(x0 - 40, wy + 40);
    cx.fill();
    cx.beginPath();
    cx.moveTo(x1 + 40, trailY(x1 + 40) + 4); cx.lineTo(x1 - 6, trailY(x1) + 2); cx.lineTo(x1 - 22, wy + 16); cx.lineTo(x1 + 40, wy + 40);
    cx.fill();
    // la cascade jusqu'à la route
    const gs = cx.createLinearGradient(0, wy, 0, ROAD);
    gs.addColorStop(0, '#1b2f46');
    gs.addColorStop(1, '#132236');
    cx.fillStyle = gs;
    cx.beginPath();
    cx.moveTo(x0 + 14, wy + 12);
    cx.bezierCurveTo(x0 + 70, wy + 60, mid - 120, wy + 70, mid - 70, wy + 130);
    cx.bezierCurveTo(mid - 40, wy + 170, mid - 110, ROAD - 70, mid - 92, ROAD - 8);
    cx.lineTo(mid + 92, ROAD - 8);
    cx.bezierCurveTo(mid + 70, ROAD - 80, mid + 40, wy + 170, mid + 64, wy + 130);
    cx.bezierCurveTo(mid + 110, wy + 70, x1 - 70, wy + 60, x1 - 14, wy + 12);
    cx.closePath();
    cx.fill();
    // petites chutes d'écume
    cx.strokeStyle = 'rgba(170,198,222,0.28)';
    cx.lineWidth = 2;
    for (const [fy, fw] of [[wy + 40, 120], [wy + 128, 60], [ROAD - 70, 70]]) {
      cx.beginPath(); cx.moveTo(mid - fw / 2, fy); cx.quadraticCurveTo(mid, fy + 6, mid + fw / 2, fy); cx.stroke();
    }
    G.art.dots(cx, 61, 70, x0 - 10, x1 + 10, (x) => {
      const k = Math.abs(x - mid) / ((x1 - x0) / 2);
      return [wy + 30 + (1 - k) * 160, ROAD - 20];
    }, ['#0b1119', '#0e151f', '#121b27'], 5, 13, 0.9, 1);
    // l'eau du gué
    cx.fillStyle = '#1d3349';
    cx.fillRect(x0 + 4, wy - 1, x1 - x0 - 8, 15);
    cx.fillStyle = 'rgba(150,180,210,0.25)';
    cx.fillRect(x0 + 6, wy - 1, x1 - x0 - 12, 1.5);
  }

  function drawFarm(cx) {
    const x0 = FARM_X, w = FARM_W, base = 394, wallH = 60;
    cx.fillStyle = '#0f1622';
    cx.beginPath(); cx.ellipse(x0 + w / 2, base + 4, w * 0.7, 12, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#131b28';
    cx.fillRect(x0, base - wallH, w, wallH);
    cx.strokeStyle = 'rgba(80,98,128,0.32)';
    cx.lineWidth = 1.5;
    for (let y = base - wallH + 7; y < base; y += 8) { cx.beginPath(); cx.moveTo(x0, y); cx.lineTo(x0 + w, y); cx.stroke(); }
    cx.fillStyle = '#0c111a';
    cx.beginPath(); cx.moveTo(x0 - 14, base - wallH + 4); cx.lineTo(x0 + w * 0.5, base - wallH - 40); cx.lineTo(x0 + w + 14, base - wallH + 4); cx.fill();
    cx.strokeStyle = 'rgba(160,182,215,0.4)';
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(x0 + w * 0.5, base - wallH - 40); cx.lineTo(x0 + w + 14, base - wallH + 4); cx.stroke();
    cx.fillStyle = '#161e2b';
    cx.fillRect(x0 + w - 42, base - wallH - 50, 18, 46);
    cx.fillStyle = '#4c3418';
    cx.fillRect(x0 + 32, base - wallH + 18, 26, 21);
    cx.fillStyle = '#131b28';
    cx.fillRect(x0 + 44, base - wallH + 18, 2, 21);
    cx.fillRect(x0 + 32, base - wallH + 28, 26, 2);
    cx.fillStyle = '#080b10';
    cx.fillRect(x0 + 100, base - 44, 22, 44);
    // clôture à perches le long du sentier
    cx.strokeStyle = '#141c28';
    cx.lineCap = 'round';
    for (let x = 2596; x <= 2950; x += 46) {
      const y = trailY(x) - 4;
      cx.lineWidth = 4;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 1, y - 34); cx.stroke();
      if (x + 46 <= 2950) {
        const y2 = trailY(x + 46) - 4;
        cx.lineWidth = 2.5;
        cx.beginPath(); cx.moveTo(x, y - 28); cx.lineTo(x + 46, y2 - 20); cx.stroke();
        cx.beginPath(); cx.moveTo(x, y - 16); cx.lineTo(x + 46, y2 - 11); cx.stroke();
      }
    }
    // niche
    const kx = DOG_X + 54, ky = trailY(DOG_X + 54) - 2;
    cx.fillStyle = '#0d131c';
    cx.beginPath(); cx.moveTo(kx - 24, ky); cx.lineTo(kx - 24, ky - 22); cx.lineTo(kx, ky - 40); cx.lineTo(kx + 24, ky - 22); cx.lineTo(kx + 24, ky); cx.fill();
    cx.fillStyle = '#04060a';
    cx.beginPath(); cx.moveTo(kx - 9, ky); cx.lineTo(kx - 9, ky - 16); cx.arc(kx, ky - 16, 9, Math.PI, 0); cx.lineTo(kx + 9, ky); cx.fill();
    cx.strokeStyle = 'rgba(160,182,215,0.35)';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(kx, ky - 40); cx.lineTo(kx + 24, ky - 22); cx.stroke();
  }

  function drawYardBack(cx) {
    // terril
    cx.fillStyle = '#0d121b';
    cx.beginPath();
    cx.moveTo(3520, trailY(3520) + 4);
    cx.quadraticCurveTo(3590, 300, 3650, 258);
    cx.quadraticCurveTo(3700, 250, 3760, 290);
    cx.lineTo(3760, H); cx.lineTo(3520, H);
    cx.fill();
    // chevalement en bois
    const bx = 3318, top = 146, base = 392;
    cx.strokeStyle = '#0a0e16';
    cx.lineCap = 'butt';
    cx.lineWidth = 7;
    for (const [x1, x2] of [[bx, bx + 16], [bx + 84, bx + 68]]) { cx.beginPath(); cx.moveTo(x1, base); cx.lineTo(x2, top + 52); cx.stroke(); }
    cx.lineWidth = 3;
    for (let y = base - 30; y > top + 60; y -= 56) {
      const k1 = (base - y) / (base - top - 52), k2 = (base - y + 56) / (base - top - 52);
      const l1 = bx + 16 * k1, r1 = bx + 84 - 16 * k1, l2 = bx + 16 * Math.min(1, k2), r2 = bx + 84 - 16 * Math.min(1, k2);
      cx.beginPath(); cx.moveTo(l1, y); cx.lineTo(r1, y); cx.moveTo(l1, y); cx.lineTo(r2, y - 56); cx.moveTo(r1, y); cx.lineTo(l2, y - 56); cx.stroke();
    }
    cx.fillStyle = '#0b0f17';
    cx.fillRect(bx - 6, top, 96, 56);
    cx.beginPath(); cx.moveTo(bx - 12, top + 2); cx.lineTo(bx + 42, top - 26); cx.lineTo(bx + 96, top + 2); cx.fill();
    cx.lineWidth = 9;
    cx.beginPath(); cx.moveTo(bx + 88, top + 40); cx.lineTo(HANGAR_X + 70, 262); cx.stroke();
    cx.strokeStyle = 'rgba(160,182,215,0.28)';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(bx + 42, top - 26); cx.lineTo(bx + 96, top + 2); cx.stroke();
    cx.beginPath(); cx.moveTo(bx + 90, top + 35); cx.lineTo(HANGAR_X + 72, 257); cx.stroke();
  }

  function drawYardFront(cx) {
    // rails et traverses
    for (let x = 3250; x < WORLD + 20; x += 15) {
      cx.fillStyle = '#121822';
      cx.fillRect(x, trailY(x) + 2, 9, 6);
    }
    strokeAlong(cx, 3250, WORLD + 20, (x) => trailY(x) + 1, '#2b3341', 2.5);
    strokeAlong(cx, 3250, WORLD + 20, (x) => trailY(x), 'rgba(170,190,220,0.3)', 1);
    // wagonnet
    const wx = 3405, wy = trailY(wx);
    cx.fillStyle = '#0d1219';
    cx.beginPath(); cx.moveTo(wx - 30, wy - 34); cx.lineTo(wx + 30, wy - 34); cx.lineTo(wx + 24, wy - 9); cx.lineTo(wx - 24, wy - 9); cx.fill();
    cx.fillStyle = '#080b10';
    cx.beginPath(); cx.ellipse(wx, wy - 35, 26, 7, 0, Math.PI, 0); cx.fill();
    for (const dx of [-15, 15]) { cx.beginPath(); cx.arc(wx + dx, wy - 5, 6, 0, TAU); cx.fill(); }
    cx.strokeStyle = 'rgba(160,182,215,0.3)';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(wx - 30, wy - 34); cx.lineTo(wx + 30, wy - 34); cx.stroke();
    // le vieux hangar
    const x0 = HANGAR_X, x1 = WORLD + 40, base = trailY(x0) + 10, top = base - 178;
    cx.fillStyle = '#121822';
    cx.fillRect(x0, top, x1 - x0, base - top);
    for (let x = x0 + 3; x < x1; x += 7) {
      cx.fillStyle = (x / 7) % 2 < 1 ? 'rgba(8,11,16,0.6)' : 'rgba(120,140,170,0.07)';
      cx.fillRect(x, top, 3, base - top);
    }
    cx.fillStyle = 'rgba(122,46,26,0.22)';
    for (const [rx, rw, rh] of [[x0 + 120, 10, 70], [x0 + 170, 6, 110], [x0 + 92, 5, 40]]) cx.fillRect(rx, top + 8, rw, rh);
    cx.fillStyle = '#0b0f16';
    cx.beginPath(); cx.moveTo(x0 - 18, top + 8); cx.lineTo(x0 - 18, top - 2); cx.lineTo(x1, top - 34); cx.lineTo(x1, top - 22); cx.fill();
    cx.strokeStyle = 'rgba(165,188,222,0.4)';
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(x0 - 18, top - 2); cx.lineTo(x1, top - 34); cx.stroke();
    // porte ouverte : l'intérieur est chaud
    const dx0 = x0 + 18, dw = 64, dh = 118;
    cx.fillStyle = '#2b1b0f';
    cx.fillRect(dx0, base - dh, dw, dh);
    cx.fillStyle = '#3b2615';
    cx.fillRect(dx0 + 8, base - 40, 30, 22);
    cx.fillStyle = '#0d1219';
    cx.fillRect(dx0 + dw + 2, base - dh - 4, 62, dh + 4);
    cx.strokeStyle = '#080b10';
    cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(dx0 + dw + 4, base - 4); cx.lineTo(dx0 + dw + 62, base - dh); cx.stroke();
    cx.fillStyle = '#080b10';
    cx.fillRect(dx0 - 4, base - dh - 6, dw + 70, 6);
  }

  function drawRoad(cx, xa, xb) {
    const top = (x) => ROAD - 18 + 3 * Math.sin(x / 210);
    const g = cx.createLinearGradient(0, ROAD - 20, 0, H);
    g.addColorStop(0, '#3a4354');
    g.addColorStop(0.25, '#2b3241');
    g.addColorStop(1, '#1b2029');
    fillBetween(cx, xa, xb, top, () => H + 2, g);
    strokeAlong(cx, xa, xb, top, 'rgba(160,180,210,0.22)', 1.5);
    strokeAlong(cx, xa, xb, (x) => ROAD + 9 + 2 * Math.sin(x / 90), 'rgba(12,15,20,0.55)', 3);
    strokeAlong(cx, xa, xb, (x) => ROAD + 32 + 2 * Math.sin(x / 120 + 1), 'rgba(12,15,20,0.5)', 4);
    G.art.dots(cx, 71, 600, 0, WORLD, () => [ROAD - 12, H], ['#404a5b', '#20252f', '#4a5466'], 0.8, 2, 0.5, 0.9);
    // le pont sur le ruisseau
    const m = CREEK.mid;
    if (xb > m - 160 && xa < m + 160) {
      cx.fillStyle = '#132236';
      cx.fillRect(m - 110, ROAD + 10, 220, H - ROAD);
      cx.fillStyle = '#2a2219';
      cx.fillRect(m - 118, ROAD - 16, 236, 26);
      cx.strokeStyle = 'rgba(10,8,6,0.7)';
      cx.lineWidth = 1;
      for (let x = m - 112; x < m + 118; x += 12) { cx.beginPath(); cx.moveTo(x, ROAD - 16); cx.lineTo(x, ROAD + 10); cx.stroke(); }
      cx.strokeStyle = '#151009';
      cx.lineWidth = 5;
      for (let x = m - 116; x <= m + 116; x += 58) { cx.beginPath(); cx.moveTo(x, ROAD - 14); cx.lineTo(x, ROAD - 52); cx.stroke(); }
      cx.lineWidth = 4;
      cx.beginPath(); cx.moveTo(m - 118, ROAD - 48); cx.lineTo(m + 118, ROAD - 48); cx.stroke();
      cx.strokeStyle = 'rgba(160,180,210,0.25)';
      cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(m - 118, ROAD - 50); cx.lineTo(m + 118, ROAD - 50); cx.stroke();
    }
  }

  // Broussailles de la pente du bas : des touffes sombres, un peu de lune sur le dessus.
  const BUSHES = (() => {
    const rnd = U.rng(321);
    const out = [];
    for (let x = -30; x < WORLD + 40; x += 40 + rnd() * 90) {
      const k = rnd(), seed = Math.floor(rnd() * 1e6), sz = rnd();
      if (Math.abs(x - CREEK.mid) < 150) continue;
      out.push({ x, k, seed, r: 16 + sz * 30 });
    }
    return out;
  })();
  function drawBushes(cx, xa, xb) {
    for (const b of BUSHES) {
      if (b.x < xa - 80 || b.x > xb + 80) continue;
      const y = U.lerp(trailY(b.x) + 40, ROAD - 34, b.k);
      const rnd = U.rng(b.seed);
      const n = Math.round(b.r * 0.9);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI, d = Math.sqrt(rnd()) * b.r;
        const px = b.x + Math.cos(a) * d * 1.4, py = y - Math.sin(a) * d * 0.8;
        const lit = (px - b.x) / b.r - (py - y) / b.r > 0.9;
        cx.fillStyle = lit ? 'rgba(36,46,60,0.8)' : ['#0a1018', '#0c131c', '#0e1620'][Math.floor(rnd() * 3)];
        cx.beginPath(); cx.arc(px, py, 2.5 + rnd() * 4, 0, TAU); cx.fill();
      }
      cx.strokeStyle = '#0a1018';
      cx.lineWidth = 1.4;
      cx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const gx = b.x - b.r * 1.5 + rnd() * b.r * 3, h = 6 + rnd() * 14;
        cx.beginPath(); cx.moveTo(gx, y + 3); cx.lineTo(gx + (rnd() - 0.5) * 8, y + 3 - h); cx.stroke();
      }
    }
    G.art.dots(cx, 34, 220, 0, WORLD, (x) => [trailY(x) + 40, ROAD - 30], ['#253041', '#1d2533'], 1.2, 2.6, 0.45, 0.8);
  }

  function drawMain(cx, xa, xb) {
    // la pente du haut, derrière le sentier
    const gu = cx.createLinearGradient(0, 320, 0, 440);
    gu.addColorStop(0, '#131c2e');
    gu.addColorStop(1, '#0b111c');
    fillBetween(cx, xa, xb, upY, () => H, gu);
    strokeAlong(cx, xa, xb, upY, 'rgba(120,145,185,0.16)', 2);
    for (const t of BG_TRUNKS) if (t.x > xa - 50 && t.x < xb + 50) bgTrunk(cx, t);
    if (xb > FARM_X - 120 && xa < 2960) drawFarm(cx);
    if (xb > 3220) drawYardBack(cx);
    G.art.dots(cx, 31, 1100, 0, WORLD, (x) => [trailY(x) - 30, trailY(x) - 4], ['#111b24', '#152026', '#1a2731', '#0e161e'], 3, 9, 0.75, 1);
    // la pente du bas, jusqu'à la route
    const gs = cx.createLinearGradient(0, 420, 0, ROAD);
    gs.addColorStop(0, '#0e1520');
    gs.addColorStop(1, '#0a0f17');
    fillBetween(cx, xa, xb, (x) => trailY(x) + 6, () => H, gs);
    drawBushes(cx, xa, xb);
    if (xb > CREEK.x0 - 220 && xa < CREEK.x1 + 220) drawCreekStatic(cx);
    // le sentier, éclairé par la lune
    for (const [a, b] of [[xa, Math.min(xb, CREEK.x0 + 6)], [Math.max(xa, CREEK.x1 - 6), xb]]) {
      if (b <= a) continue;
      fillBetween(cx, a, b, (x) => trailY(x) - 4, (x) => trailY(x) + 10, '#273142', 6);
      strokeAlong(cx, a, b, (x) => trailY(x) - 4, 'rgba(150,172,205,0.3)', 1.5, 6);
    }
    G.art.dots(cx, 33, 700, 0, WORLD, (x) => [trailY(x) - 2, trailY(x) + 8], ['#344052', '#1c2431', '#3d4a5d'], 0.8, 2, 0.6, 1);
    for (const [a, b] of LEAVES) if (b > xa - 30 && a < xb + 30) drawLeaves(cx, a, b);
    for (const x of STICKS) if (x > xa - 60 && x < xb + 60) drawStick(cx, x);
    for (const x of LOGS) if (x > xa - 80 && x < xb + 80) drawLog(cx, x);
    if (xb > 3220) drawYardFront(cx);
    drawRoad(cx, xa, xb);
  }

  // --- premier plan : les abris (troncs, rochers, fougères) et les herbes du bas
  function trunkPath(cx, t, lean, base) {
    const { x, w } = t;
    cx.beginPath();
    cx.moveTo(x - w / 2 - 24, base + 4);
    cx.quadraticCurveTo(x - w / 2 - 2, base - 6, x - w / 2, base - 44);
    cx.lineTo(x - w * 0.42 + lean, -20);
    cx.lineTo(x + w * 0.42 + lean, -20);
    cx.lineTo(x + w / 2, base - 44);
    cx.quadraticCurveTo(x + w / 2 + 2, base - 6, x + w / 2 + 26, base + 4);
    cx.closePath();
  }
  function drawTrunk(cx, t) {
    const base = trailY(t.x) + 20;
    const rnd = U.rng(t.x * 3 + 1);
    const lean = (rnd() - 0.5) * 18;
    const xAt = (x0, y) => x0 + lean * (1 - (y + 20) / (base + 20));
    trunkPath(cx, t, lean, base);
    cx.fillStyle = '#06090f';
    cx.fill();
    cx.save();
    trunkPath(cx, t, lean, base);
    cx.clip();
    const g = cx.createLinearGradient(t.x - t.w * 0.1, 0, t.x + t.w * 0.55, 0);
    g.addColorStop(0, 'rgba(100,125,165,0)');
    g.addColorStop(1, 'rgba(100,125,165,0.22)');
    cx.fillStyle = g;
    cx.fillRect(t.x - t.w, -30, t.w * 2 + 40, base + 40);
    cx.strokeStyle = 'rgba(3,4,8,0.8)';
    cx.lineWidth = 2;
    for (let i = 0; i < t.w / 6; i++) {
      const bx = t.x - t.w / 2 + 6 + rnd() * (t.w - 12);
      const y0 = base - 20 - rnd() * 120, y1 = y0 - 60 - rnd() * 260;
      cx.beginPath(); cx.moveTo(xAt(bx, y0), y0); cx.lineTo(xAt(bx, y1), y1); cx.stroke();
    }
    cx.strokeStyle = 'rgba(120,145,185,0.18)';
    cx.lineWidth = 1.2;
    for (let i = 0; i < t.w / 10; i++) {
      const bx = t.x + rnd() * t.w * 0.42;
      const y0 = base - 30 - rnd() * 140, y1 = y0 - 40 - rnd() * 200;
      cx.beginPath(); cx.moveTo(xAt(bx, y0), y0); cx.lineTo(xAt(bx, y1), y1); cx.stroke();
    }
    cx.restore();
    cx.strokeStyle = 'rgba(170,192,225,0.5)';
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(t.x + t.w / 2 - 1, base - 44); cx.lineTo(t.x + t.w * 0.42 + lean - 1, -20); cx.stroke();
    // moignon de branche
    const sy = 70 + rnd() * 90, sx = xAt(t.x + t.w * 0.4, sy);
    cx.strokeStyle = '#06090f';
    cx.lineWidth = 9;
    cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(sx - 6, sy + 10); cx.lineTo(sx + 26, sy - 14); cx.stroke();
  }

  function drawRock(cx, r) {
    const base = trailY(r.x) + 24;
    const rnd = U.rng(r.x * 5 + 2);
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const ang = Math.PI + (i / n) * Math.PI;
      const rad = 1 + (rnd() - 0.5) * 0.16;
      pts.push([r.x + Math.cos(ang) * (r.w / 2) * rad, base + Math.sin(ang) * r.h * rad * (i === 0 || i === n ? 0 : 1)]);
    }
    const path = () => {
      cx.beginPath();
      cx.moveTo(pts[0][0] - 8, base + 4);
      cx.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        cx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      cx.lineTo(pts[n][0] + 8, base + 4);
      cx.closePath();
    };
    path();
    cx.fillStyle = '#0e131c';
    cx.fill();
    cx.save();
    path();
    cx.clip();
    const g = cx.createRadialGradient(r.x + r.w * 0.28, base - r.h * 1.05, 6, r.x + r.w * 0.2, base - r.h * 0.8, r.w * 0.75);
    g.addColorStop(0, 'rgba(130,150,182,0.5)');
    g.addColorStop(1, 'rgba(130,150,182,0)');
    cx.fillStyle = g;
    cx.fillRect(r.x - r.w, base - r.h - 20, r.w * 2, r.h + 30);
    G.art.dots(cx, r.x, 40, r.x - r.w / 2, r.x + r.w / 2, () => [base - r.h, base - r.h * 0.6], ['#24322b', '#1c2924'], 3, 7, 0.7, 1);
    cx.strokeStyle = 'rgba(4,6,10,0.8)';
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(r.x - r.w * 0.1, base - r.h * 0.9); cx.lineTo(r.x - r.w * 0.02, base - r.h * 0.55); cx.lineTo(r.x - r.w * 0.12, base - r.h * 0.2); cx.stroke();
    cx.restore();
  }

  const quadAt = (a, b, c, s) => (1 - s) * (1 - s) * a + 2 * (1 - s) * s * b + s * s * c;
  const quadD = (a, b, c, s) => 2 * (1 - s) * (b - a) + 2 * s * (c - b);
  function frond(cx, f) {
    const bx = f.x, by = trailY(f.x) + 20;
    const tx = bx + f.lean * f.hgt * 0.6, ty = by - f.hgt * (1 - Math.abs(f.lean) * 0.22);
    const qx = bx + f.lean * f.hgt * 0.05, qy = by - f.hgt * 0.78;
    cx.strokeStyle = f.lit > 0.82 ? '#3a5a45' : f.lit > 0.5 ? '#21402f' : '#162c22';
    cx.lineWidth = f.w;
    cx.beginPath(); cx.moveTo(bx, by); cx.quadraticCurveTo(qx, qy, tx, ty); cx.stroke();
    cx.lineWidth = f.w * 0.85;
    for (let s = 0.16; s < 0.97; s += 0.07) {
      const px = quadAt(bx, qx, tx, s), py = quadAt(by, qy, ty, s);
      const dx = quadD(bx, qx, tx, s), dy = quadD(by, qy, ty, s), dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl, L = (1 - s) * 17 + 3;
      for (const sd of [-1, 1]) {
        cx.beginPath();
        cx.moveTo(px, py);
        cx.lineTo(px + nx * sd * L + (dx / dl) * L * 0.4, py + ny * sd * L + (dy / dl) * L * 0.4);
        cx.stroke();
      }
    }
  }
  function drawFerns(cx, a, b) {
    const len = b - a;
    cx.fillStyle = '#0a1411';
    cx.beginPath();
    cx.moveTo(a - 12, trailY(a) + 24);
    for (let x = a - 12; x <= b + 12; x += 5) {
      const k = Math.sin(Math.PI * U.clamp((x - a + 12) / (len + 24), 0, 1));
      const hgt = 36 + 72 * Math.pow(k, 0.5) + Math.sin(x * 0.7) * 5 + Math.sin(x * 0.23) * 4;
      cx.lineTo(x, trailY(x) + 18 - hgt);
    }
    cx.lineTo(b + 12, trailY(b) + 24);
    cx.closePath();
    cx.fill();
    const rnd = U.rng(a * 7 + 11);
    const fronds = [];
    const n = Math.round(len / 3.6);
    for (let i = 0; i < n; i++) {
      const x = a - 6 + rnd() * (len + 12);
      const k = Math.sin(Math.PI * U.clamp((x - a) / len, 0, 1));
      fronds.push({ x, hgt: (58 + 66 * Math.pow(k, 0.5)) * (0.78 + rnd() * 0.32), lean: (rnd() - 0.5) * 1.3, lit: rnd(), w: 1.3 + rnd() * 1.1 });
    }
    fronds.sort((p, q) => p.lit - q.lit);
    cx.lineCap = 'round';
    for (const f of fronds) frond(cx, f);
  }

  function drawFg(cx, xa, xb) {
    for (const [a, b] of FERNS) if (b > xa - 80 && a < xb + 80) drawFerns(cx, a, b);
    for (const t of TRUNKS) if (t.x > xa - 120 && t.x < xb + 120) drawTrunk(cx, t);
    for (const r of ROCKS) if (r.x > xa - 120 && r.x < xb + 120) drawRock(cx, r);
    // herbes et broussailles tout devant, au bord de la route
    const rnd = U.rng(777);
    cx.strokeStyle = '#04060b';
    cx.lineCap = 'round';
    for (let x = -20; x < WORLD + 20;) {
      const gap = 3 + rnd() * 9, h = 8 + rnd() * 30, lean = (rnd() - 0.5) * 16, wdt = 1.5 + rnd() * 2, big = rnd();
      if (x > xa - 40 && x < xb + 40) {
        cx.lineWidth = wdt;
        cx.beginPath(); cx.moveTo(x, H + 4); cx.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); cx.stroke();
        if (big > 0.965) {
          cx.fillStyle = '#04060b';
          cx.beginPath(); cx.ellipse(x, H + 6, 40 + big * 20, 26 + h * 0.4, 0, Math.PI, 0); cx.fill();
        }
      }
      x += gap;
    }
  }

  // --- petits calques plein écran
  function drawMistSprite(cx, w, h) {
    cx.save();
    cx.translate(w / 2, h / 2);
    cx.scale(1, h / w);
    const g = cx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, 'rgba(170,190,218,1)');
    g.addColorStop(0.5, 'rgba(170,190,218,0.45)');
    g.addColorStop(1, 'rgba(170,190,218,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(0, 0, w / 2, 0, TAU); cx.fill();
    cx.restore();
  }
  function drawNight(cx, w, h) {
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(3,6,14,0.42)');
    g.addColorStop(0.22, 'rgba(3,6,14,0)');
    g.addColorStop(0.86, 'rgba(3,6,14,0)');
    g.addColorStop(1, 'rgba(3,6,14,0.35)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
  }

  let LY = null;
  function layers() {
    if (LY) return LY;
    const A = G.art;
    const lw = (p) => Math.ceil(W + (WORLD - W) * p) + 4;
    LY = {
      sky: A.cached('ms-sky', W, H, drawSky),
      far: A.cached('ms-far', lw(PF.far), H, drawFarRidge, 1),
      mid: A.cached('ms-mid', lw(PF.mid), H, drawMidRidge, 1),
      trees: A.cached('ms-trees', lw(PF.trees), H, drawFarTrees, 1),
      mist: A.cached('ms-mist', 600, 160, drawMistSprite, 1),
      night: A.cached('ms-night', W, H, drawNight, 0.5),
      main: [],
      fg: [],
    };
    for (let i = 0; i < NCHUNK; i++) {
      LY.main.push(A.cached('ms-main' + i, CHUNK, H, (cx) => { cx.translate(-i * CHUNK, 0); drawMain(cx, i * CHUNK - 4, (i + 1) * CHUNK + 4); }, 1));
      LY.fg.push(A.cached('ms-fg' + i, CHUNK, H, (cx) => { cx.translate(-i * CHUNK, 0); drawFg(cx, i * CHUNK - 4, (i + 1) * CHUNK + 4); }, 1));
    }
    return LY;
  }

  // ================================================================== éléments animés
  function drawDogShape(ctx, d, t) {
    const lying = d.bark <= 0;
    const j = !lying && d.bark > 0.25 ? Math.sin(t * 24) * 1.6 : 0;
    ctx.beginPath();
    if (!lying) {
      ctx.lineWidth = 4;
      for (const [a, b, c2] of [[-16, -18, -18], [-10, -18, -8], [12, -18, 10], [17, -18, 20]]) { ctx.moveTo(a, b); ctx.lineTo(c2, 0); }
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -24, 24, 9.5, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(15, -26); ctx.lineTo(24, -36 + j); ctx.stroke();
      ctx.beginPath(); ctx.arc(27, -39 + j, 7.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(31, -43 + j); ctx.lineTo(42, -41 + j); ctx.lineTo(41, -37 + j); ctx.lineTo(31, -36 + j); ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(32, -35 + j); ctx.lineTo(41, -30 + j * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23, -44 + j); ctx.lineTo(25, -53 + j); ctx.lineTo(29, -45 + j); ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-22, -27); ctx.quadraticCurveTo(-32, -34, -30, -46); ctx.stroke();
    } else {
      ctx.ellipse(0, -9, 24, 9, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(30, -2); ctx.stroke();
      if (d.alert > 0.3) {
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(21, -22); ctx.stroke();
        ctx.beginPath(); ctx.arc(24, -25, 7, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(28, -28); ctx.lineTo(37, -25); ctx.lineTo(36, -21); ctx.lineTo(28, -21); ctx.fill();
        ctx.beginPath(); ctx.moveTo(19, -29); ctx.lineTo(22, -38); ctx.lineTo(25, -29); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(25, -8, 7, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(29, -9); ctx.lineTo(38, -6); ctx.lineTo(37, -2); ctx.lineTo(29, -3); ctx.fill();
        ctx.beginPath(); ctx.moveTo(19, -12); ctx.lineTo(26, -15); ctx.lineTo(23, -9); ctx.fill();
      }
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-22, -6); ctx.quadraticCurveTo(-32, -2, -18, 2); ctx.stroke();
    }
  }
  function drawDog(ctx, d, t) {
    const y = trailY(d.x) - 4;
    ctx.save();
    // chaîne jusqu'au piquet devant la niche
    ctx.strokeStyle = 'rgba(120,128,140,0.55)';
    ctx.lineWidth = 1.2;
    const sx = DOG_X + 34, sy = trailY(sx) - 2;
    const cx2 = d.x + d.dir * (d.bark > 0 ? 20 : 16), cy2 = y - (d.bark > 0 ? 30 : 12);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + cx2) / 2, Math.max(sy, cy2) + 8, cx2, cy2); ctx.stroke();
    ctx.translate(d.x, y);
    ctx.scale(d.dir, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(1, -1.5);
    ctx.fillStyle = ctx.strokeStyle = 'rgba(150,172,206,0.35)';
    drawDogShape(ctx, d, t);
    ctx.restore();
    ctx.fillStyle = ctx.strokeStyle = '#05070b';
    drawDogShape(ctx, d, t);
    if (d.bark > 0.3) {
      ctx.strokeStyle = `rgba(232,223,204,${0.6 * Math.min(1, d.bark)})`;
      ctx.lineWidth = 2;
      const k = (t * 3) % 1;
      for (let i = 0; i < 3; i++) {
        const r = 10 + i * 8 + k * 8;
        ctx.beginPath(); ctx.arc(44, -40, r, -0.6, 0.6); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawJar(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(206,220,230,0.9)';
    ctx.beginPath(); ctx.roundRect(-7, -9, 14, 20, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-4.5, -6, 2.2, 13);
    ctx.fillStyle = '#7d8590';
    ctx.fillRect(-6, -13, 12, 4.5);
    ctx.restore();
  }

  function drawBeam(ctx, L, T, alpha, t) {
    const dx = T.x - L.x, dy = T.y - L.y, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const half = Math.atan2(BEAM_HW, d), len = d * 1.5;
    const fl = 0.93 + 0.07 * Math.sin(t * 17) * Math.sin(t * 7.3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(L.x, L.y, 6, L.x, L.y, len);
    g.addColorStop(0, `rgba(255,216,146,${0.5 * alpha * fl})`);
    g.addColorStop(0.5, `rgba(246,186,104,${0.22 * alpha * fl})`);
    g.addColorStop(0.72, `rgba(246,186,104,${0.13 * alpha * fl})`);
    g.addColorStop(1, 'rgba(246,186,104,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.arc(L.x, L.y, len, ang - half, ang + half); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.arc(L.x, L.y, len * 0.9, ang - half * 0.5, ang + half * 0.5); ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(T.x, T.y + 34);
    ctx.scale(1, 0.62);
    const pg = ctx.createRadialGradient(0, 0, 8, 0, 0, 150);
    pg.addColorStop(0, `rgba(255,212,140,${0.32 * alpha * fl})`);
    pg.addColorStop(1, 'rgba(255,212,140,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function chevron(u, x, y, dirn, s) {
    u.beginPath();
    if (dirn === 'right') { u.moveTo(x - s * 0.45, y - s); u.lineTo(x + s * 0.5, y); u.lineTo(x - s * 0.45, y + s); }
    else if (dirn === 'left') { u.moveTo(x + s * 0.45, y - s); u.lineTo(x - s * 0.5, y); u.lineTo(x + s * 0.45, y + s); }
    else if (dirn === 'down') { u.moveTo(x - s, y - s * 0.45); u.lineTo(x, y + s * 0.5); u.lineTo(x + s, y - s * 0.45); }
    else { u.moveTo(x - s, y + s * 0.45); u.lineTo(x, y - s * 0.5); u.lineTo(x + s, y + s * 0.45); }
    u.stroke();
  }

  // Étiquette sous un élément, pointe vers le haut (la pierre suivante).
  function tagUp(u, text, x, y, active) {
    u.save();
    u.font = ui.font(19, 'serif', 'italic');
    const w = u.measureText(text).width + 26;
    const bob = Math.sin(G.time * 4) * 2;
    u.fillStyle = active ? 'rgba(242,210,122,0.96)' : 'rgba(232,223,204,0.85)';
    u.beginPath(); u.moveTo(x, y + bob); u.lineTo(x - 7, y + 9 + bob); u.lineTo(x + 7, y + 9 + bob); u.fill();
    u.beginPath(); u.roundRect(x - w / 2, y + 8 + bob, w, 30, 15); u.fill();
    ui.text(u, text, x, y + 24 + bob, { size: 19, italic: true, color: G.PAL.ink, align: 'center', base: 'middle' });
    u.restore();
  }

  function jarIcon(u, x, y, full, shake) {
    u.save();
    u.translate(x + shake, y);
    if (full) {
      u.fillStyle = 'rgba(214,226,232,0.95)';
      u.beginPath(); u.roundRect(-8, -10, 16, 22, 4); u.fill();
      u.fillStyle = 'rgba(255,255,255,0.65)';
      u.fillRect(-5, -6, 2.5, 13);
      u.fillStyle = '#8a929c';
      u.fillRect(-6.5, -14.5, 13, 4.5);
    } else {
      u.strokeStyle = 'rgba(227,122,44,0.7)';
      u.lineWidth = 1.5;
      u.setLineDash([3, 3]);
      u.beginPath(); u.roundRect(-8, -10, 16, 22, 4); u.stroke();
      u.setLineDash([]);
      u.beginPath(); u.moveTo(-6, -4); u.lineTo(-1, 1); u.lineTo(-4, 5); u.lineTo(3, 10); u.stroke();
    }
    u.restore();
  }

  // ================================================================== la scène
  G.Scenes.moonshine = (opts = {}) => G.makeScene({
    enter() {
      const __t0 = performance.now(); layers(); console.log('LAYERS_MS', Math.round(performance.now() - __t0));
      G.audio.amb(['night', 'wind']);
      if (G.audio.stopSong) G.audio.stopSong(1.2);
      this.state = 'intro';
      this.introA = 0;
      this.introT = 0;
      this.hx = START_X;
      this.dir = 1;
      this.phase = 0;
      this.moving = false;
      this.crouch = false;
      this.crouchToggle = false;
      this.inFwd = this.inBack = false;
      this.noise = 0;
      this.maxed = false;
      this.clinkT = 0;
      this.clinkFlash = 0;
      this.cp = 0;
      this.broken = 0;
      this.caught = 0;
      this.seconds = 0;
      this.playT = 0;
      this.hasCrate = true;
      this.cam = camFor(this.hx);
      this.prevCam = this.cam;
      this.viewX = this.hx;
      this.agent = { x: 820, dir: -1, phase: 0, mode: 'walk', t: 0, lift: 0, cur: 0, path: null, aimed: false, teleEnd: 1.2, turnT: 4 };
      this.nextSweep = 8;
      this.sweeps = 0;
      this.leaving = false;
      this.logs = LOGS.map((x) => ({ x, done: false }));
      this.dog = { x: DOG_X, dir: -1, alert: 0, bark: 0, cool: 0 };
      this.creek = null;
      this.qte = null;
      this.exposure = 0;
      this.lit = false;
      this.covered = null;
      this.fx = [];
      this.stains = [];
      this.snaps = [];
      this.flashMsg = null;
      this.nearCreek = false;
      this.hand = { x: this.hx + 30, y: footY(this.hx) - 70 };
      this.head = { x: this.hx, y: footY(this.hx) - 140 };
      this.lantern = null;
      this.fall = [];
      for (let i = 0; i < 12; i++) this.fall.push(this.newLeaf(true));
    },

    newLeaf(init) {
      return {
        x: U.rand(-20, W + 120), y: init ? U.rand(-40, H) : U.rand(-60, -10),
        vx: U.rand(-16, -4), vy: U.rand(16, 32), r: U.rand(0, TAU), vr: U.rand(-2.2, 2.2),
        s: U.rand(3, 5.5), sw: U.rand(0, TAU), c: U.pick(['#6b4a2e', '#7a5a34', '#5a3a26', '#8a6a3c', '#6e3a24']),
      };
    },

    // ---------------------------------------------------------------- mise à jour
    update(dt) {
      this.animate(dt);
      if (G.blocked) return;
      if (this.state === 'intro') {
        this.introT += dt;
        if (this.introT > 0.6 && I.confirm()) {
          I.consume();
          this.state = 'play';
          G.audio.sfx('click');
        }
        return;
      }
      if (this.state === 'play' || this.state === 'caught') this.seconds += dt;
      if (this.state === 'play') this.updatePlay(dt);
      else if (this.state === 'caught') this.updateCaught(dt);
      else if (this.state === 'arrive') this.updateArrive(dt);
    },

    // Animations qui continuent même pendant un dialogue ou un fondu.
    animate(dt) {
      // Le carton-consigne attend la fin d'un éventuel dialogue d'ouverture.
      if (this.state === 'intro' && !G.blocked) this.introA = Math.min(1, this.introA + dt * 3);
      else this.introA = Math.max(0, this.introA - dt * (this.state === 'intro' ? 6 : 2.4));
      const ar = this.arr;
      if (ar && ar.step !== 'walk' && ar.lige > LIGE_MEET) {
        const st = Math.min(ar.lige - LIGE_MEET, 40 * dt);
        ar.lige -= st;
        ar.lph = (ar.lph + st / 150) % 1;
        ar.lmove = ar.lige > LIGE_MEET + 0.5;
      } else if (ar) ar.lmove = false;
      this.prevCam = this.cam;
      this.cam = U.lerp(this.cam, camFor(this.viewX), 1 - Math.pow(0.04, dt));
      const dcam = this.cam - this.prevCam;
      for (const p of this.fx) {
        p.t += dt;
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > p.floor) { p.y = p.floor; p.vx *= 0.4; p.vy *= -0.25; }
      }
      this.fx = this.fx.filter((p) => p.t < p.life);
      for (const s of this.snaps) s.t -= dt;
      this.snaps = this.snaps.filter((s) => s.t > 0);
      for (let i = 0; i < this.fall.length; i++) {
        const p = this.fall[i];
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(this.t * 1.3 + p.sw) * 12) * dt - dcam;
        p.r += p.vr * dt;
        if (p.y > H + 20 || p.x < -60 || p.x > W + 160) this.fall[i] = this.newLeaf(false);
      }
      this.clinkFlash = Math.max(0, this.clinkFlash - dt);
      if (this.flashMsg) { this.flashMsg.t -= dt; if (this.flashMsg.t <= 0) this.flashMsg = null; }
      const d = this.dog;
      d.bark = Math.max(0, d.bark - dt);
      d.dir = this.hx > d.x ? 1 : -1;
      const near = Math.abs(this.hx - CREEK.mid) < 560;
      if (near !== this.nearCreek) {
        this.nearCreek = near;
        G.audio.amb(near ? ['night', 'wind', 'creek'] : ['night', 'wind']);
      }
    },

    flash(text, color, dur = 1.3) { this.flashMsg = { text, color, t: dur, dur }; },

    updatePlay(dt) {
      this.playT += dt;
      if (this.qte) { this.updateQte(dt); return; }
      if (this.creek) {
        this.updateCreek(dt);
        this.updateAgent(dt);
        this.updateDog(dt);
        return;
      }
      // --- commandes
      const kR = I.key('ArrowRight') || I.key('KeyD');
      const kL = I.key('ArrowLeft') || I.key('KeyA') || I.key('KeyQ');
      this.inFwd = I.down && U.inRect(I, BTN.fwd);
      this.inBack = I.down && U.inRect(I, BTN.back);
      if (I.pressed && U.inRect(I, BTN.crouch)) { this.crouchToggle = !this.crouchToggle; G.audio.sfx('click'); }
      if (CROUCH_KEYS.some((k) => I.hit(k))) this.crouchToggle = false;
      this.crouch = this.crouchToggle || CROUCH_KEYS.some((k) => I.key(k));
      const vx = (kR || this.inFwd ? 1 : 0) - (kL || this.inBack ? 1 : 0);

      // --- déplacement
      const prev = this.hx;
      if (vx) {
        this.dir = vx;
        let nx = this.hx + vx * (this.crouch ? CROUCH_SPEED : SPEED) * dt;
        nx = U.clamp(nx, 110, ARRIVE_X + 4);
        if (prev < CREEK.x0) nx = Math.min(nx, CREEK.x0 - 14);
        else if (prev > CREEK.x1) nx = Math.max(nx, CREEK.x1 + 14);
        this.hx = nx;
      }
      const moved = Math.abs(this.hx - prev);
      this.moving = moved > 0.001;
      const leaves = onLeaves(this.hx);
      if (this.moving) {
        const prevPh = this.phase;
        this.phase = (this.phase + moved / (this.crouch ? 70 : 150)) % 1;
        if (Math.floor(prevPh * 2) !== Math.floor(this.phase * 2)) {
          if (leaves) G.audio.sfx('crunch');
          else if (!this.crouch) G.audio.sfx('step');
        }
      }

      // --- le bruit des bocaux
      if (this.moving) {
        let rate = leaves ? 0.42 : 0.08;
        if (this.crouch) rate *= 0.3;
        this.noise += rate * dt;
      } else this.noise -= (this.crouch ? 0.38 : 0.3) * dt;
      for (const sx of STICKS) {
        if ((prev - sx) * (this.hx - sx) < 0 || (prev !== this.hx && this.hx === sx)) {
          if (this.crouch) { this.noise += 0.08; G.audio.sfx('tick'); }
          else { this.noise += 0.32; G.audio.sfx('crunch'); G.audio.sfx('crunch', 0.08); this.snaps.push({ x: sx, t: 0.5 }); }
        }
      }
      this.noise = U.clamp(this.noise, 0, 1);
      if (this.noise > 0.55 && this.moving) {
        this.clinkT -= dt;
        if (this.clinkT <= 0) {
          G.audio.sfx('clink');
          this.clinkFlash = 0.35;
          this.clinkT = U.lerp(1.1, 0.35, (this.noise - 0.55) / 0.45);
        }
      } else this.clinkT = Math.min(this.clinkT, 0.2);
      if (this.noise >= 1 && !this.maxed) {
        this.maxed = true;
        G.audio.sfx('clink');
        this.clinkFlash = 0.4;
        this.startSweep(true, 1.2);
      }
      if (this.noise < 0.75) this.maxed = false;

      // --- le terrain
      if (vx > 0) {
        for (const L of this.logs) {
          if (!L.done && prev < L.x - 2 && this.hx >= L.x - 2) {
            this.hx = L.x - 2;
            if (this.broken < 6) { this.startQte(L); return; }
            L.done = true;
          }
        }
        if (prev < CREEK.x0 && this.hx >= CREEK.x0 - 14) {
          this.hx = CREEK.x0 - 14;
          this.creek = { idx: -1, hop: null, wet: 0 };
          this.crouchToggle = false;
          this.crouch = false;
          return;
        }
      }
      for (let i = this.cp + 1; i < CPS.length; i++) {
        if (this.hx >= CPS[i]) {
          this.cp = i;
          ui.toast('Point de passage', { color: P.rim });
          G.audio.sfx('tick');
        }
      }
      if (this.hx >= SAFE_X && !this.leaving) {
        this.leaving = true;
        const a = this.agent;
        if (a.mode === 'raise' || a.mode === 'sweep') { a.mode = 'lower'; a.t = (1 - a.lift) * 0.6; }
      }
      if (this.hx >= ARRIVE_X) { this.startArrive(); return; }

      this.updateAgent(dt);
      this.updateDog(dt);
      this.detect(dt);
    },

    sweepsAllowed() {
      return this.state === 'play' && !this.creek && !this.qte && !this.leaving && this.hx > 260;
    },

    makePath(aimed) {
      const a = this.agent, hx = this.hx;
      const lim = (x) => U.clamp(x, Math.max(140, a.x - 760), Math.min(SAFE_X + 60, a.x + 760));
      if (aimed) {
        const side = Math.sign(a.x - hx) || 1;
        const tgt = lim(hx);
        return [[0, lim(hx + side * 250)], [0.9, tgt], [1.9, tgt], [2.8, lim(hx - side * 230)]];
      }
      const side = Math.random() < 0.5 ? -1 : 1;
      return [[0, lim(hx + side * U.rand(290, 370))], [U.rand(2.4, 2.9), lim(hx - side * U.rand(200, 340))]];
    },

    // L'agent s'arrête et lève sa lanterne (avertissement), puis balaie le versant.
    startSweep(aimed, tele = 1.2) {
      const a = this.agent;
      if (this.leaving || this.state !== 'play') return;
      if (a.mode === 'sweep' || a.mode === 'raise') {
        if (aimed && !a.aimed) {
          a.aimed = true;
          if (a.mode === 'sweep') {
            const from = a.cur, tgt = this.hx, side = Math.sign(tgt - from) || 1;
            a.path = [[0, from], [0.8, tgt], [1.8, tgt], [2.6, tgt + side * 220]];
            a.t = 0;
          } else a.path = this.makePath(true);
        }
        return;
      }
      const lift0 = a.mode === 'lower' ? a.lift : 0;
      a.mode = 'raise';
      a.t = lift0 * 0.55;
      a.teleEnd = a.t + tele;
      a.aimed = aimed;
      a.dir = this.hx >= a.x ? 1 : -1;
      a.path = this.makePath(aimed);
      a.cur = a.path[0][1];
      this.sweeps++;
      G.audio.sfx('creak');
    },

    updateAgent(dt) {
      const a = this.agent;
      a.t += dt;
      if (a.mode === 'walk') {
        let want = a.dir, sp = 30;
        if (this.leaving) { want = -1; sp = 46; }
        else {
          const rel = a.x - this.hx;
          a.turnT -= dt;
          if (rel < -360) { want = 1; if (rel < -420) sp = 64; }
          else if (rel > 580) want = -1;
          else if (a.turnT <= 0) { a.turnT = U.rand(3.5, 7); if (Math.random() < 0.55) want = -a.dir; }
        }
        a.dir = want;
        a.x += a.dir * sp * dt;
        a.phase = (a.phase + (sp * dt) / 150) % 1;
        if (this.sweepsAllowed()) {
          this.nextSweep -= dt;
          if (this.nextSweep <= 0) this.startSweep(false);
        }
      } else if (a.mode === 'raise') {
        a.lift = Math.min(1, a.t / 0.55);
        if (a.t >= a.teleEnd) { a.mode = 'sweep'; a.t = 0; }
      } else if (a.mode === 'sweep') {
        a.cur = evalPath(a.path, a.t);
        if (a.t >= a.path[a.path.length - 1][0] + 0.15) { a.mode = 'lower'; a.t = 0; }
      } else if (a.mode === 'lower') {
        a.lift = 1 - Math.min(1, a.t / 0.6);
        if (a.t >= 0.6) {
          a.mode = 'walk';
          a.lift = 0;
          a.t = 0;
          a.aimed = false;
          this.nextSweep = U.rand(5, 8);
        }
      }
    },

    updateDog(dt) {
      const d = this.dog;
      d.cool -= dt;
      const near = Math.abs(this.hx - d.x) < DOG_R && !this.leaving && this.state === 'play' && !this.creek;
      if (near && this.noise > 0.3) d.alert = Math.min(1, d.alert + dt * 2.5);
      else d.alert = Math.max(0, d.alert - dt * 0.5);
      if (near && this.noise > 0.6 && d.cool <= 0) {
        d.bark = 1.9;
        d.cool = 8;
        d.alert = 1;
        G.audio.sfx('bark');
        G.audio.sfx('bark', 0.75);
        this.startSweep(true, 1.1);
      }
    },

    detect(dt) {
      const a = this.agent;
      this.covered = coverAt(this.hx, this.crouch);
      this.lit = false;
      if (a.mode === 'sweep' && !this.leaving) {
        const L = lanternPos(a), T = beamTarget(a.cur);
        this.lit = inBeam(L, T, this.hx, footY(this.hx) - (this.crouch ? 48 : 80));
      }
      if (this.lit && !this.covered) {
        this.exposure += dt;
        if (this.exposure > 0.3) this.getCaught();
      } else this.exposure = Math.max(0, this.exposure - dt * 2);
    },

    // ---------------------------------------------------------------- repéré
    getCaught() {
      this.state = 'caught';
      this.ct = 0;
      this.caught++;
      this.respawned = false;
      this.ran = false;
      this.fleePh = 0;
      this.crouchToggle = false;
      this.crouch = false;
      const a = this.agent;
      a.mode = 'spot';
      a.lift = 1;
      a.dir = this.hx >= a.x ? 1 : -1;
      a.cur = this.hx;
      G.audio.sfx('fail');
    },

    updateCaught(dt) {
      this.ct += dt;
      const a = this.agent;
      if (!this.respawned) {
        a.cur = U.lerp(a.cur, this.hx, 1 - Math.pow(0.002, dt));
        if (this.ct > 0.95) {
          if (!this.ran) { this.ran = true; G.audio.sfx('whoosh'); }
          this.hx -= 150 * dt;
          this.fleePh = (this.fleePh + dt * 2.2) % 1;
        }
      }
      if (this.ct >= 1.9 && !this.respawned) this.respawn();
      if (this.ct >= 3.6) this.state = 'play';
    },

    respawn() {
      this.respawned = true;
      this.hx = CPS[this.cp];
      this.viewX = this.hx;
      this.dir = 1;
      this.noise = 0;
      this.maxed = false;
      this.exposure = 0;
      this.crouchToggle = false;
      this.crouch = false;
      this.moving = false;
      this.creek = null;
      this.qte = null;
      this.lit = false;
      const a = this.agent;
      a.mode = 'walk';
      a.lift = 0;
      a.t = 0;
      a.aimed = false;
      a.x = this.hx + 540;
      a.dir = 1;
      a.turnT = 2.5;
      this.nextSweep = 7.5;
      this.dog.alert = 0;
      this.dog.bark = 0;
      this.dog.cool = 2;
      this.cam = camFor(this.hx);
      this.prevCam = this.cam;
    },

    // ---------------------------------------------------------------- le bocal qui glisse
    startQte(L) {
      this.qte = { log: L, t: 0, res: null, rt: 0, slipped: false, shattered: false };
      this.crouchToggle = false;
      this.crouch = false;
      this.moving = false;
      this.inFwd = this.inBack = false;
      G.audio.sfx('thud');
    },

    qteJar() {
      const q = this.qte;
      const d = this.dir;
      const hx = this.hand.x - d * 6, hy = this.hand.y - 22;
      const k = U.clamp((q.t - SLIP) / WIN, 0, 1);
      let x = hx + d * (6 + 30 * k);
      let y = hy - 12 * Math.sin(Math.PI * Math.min(1, k * 2.2)) * (1 - k) + 34 * k * k;
      let rot = d * k * 1.6;
      if (q.t < SLIP) { const s = q.t / SLIP; x = hx + d * 4 * s; y = hy - 6 * s; rot = d * 0.2 * s; }
      if (q.res === 'ok') {
        const b = U.clamp(q.rt / 0.25, 0, 1);
        x = U.lerp(q.jx, hx, U.easeOut(b)); y = U.lerp(q.jy, hy, U.easeOut(b)); rot = U.lerp(q.jr, 0, b);
        return b >= 1 ? null : { x, y, rot };
      }
      if (q.res === 'fail') {
        const b = U.clamp(q.rt / 0.22, 0, 1);
        if (b >= 1) return null;
        x = q.jx + d * 18 * b; y = U.lerp(q.jy, footY(this.hx) - 4, b * b); rot = q.jr + d * b * 2;
      }
      return { x, y, rot };
    },

    updateQte(dt) {
      const q = this.qte;
      q.t += dt;
      if (q.res == null) {
        if (q.t >= SLIP && !q.slipped) { q.slipped = true; G.audio.sfx('clink'); }
        const j = this.qteJar();
        if (q.t >= SLIP && I.confirm()) {
          I.consume();
          q.res = 'ok';
          q.rt = 0;
          q.jx = j.x; q.jy = j.y; q.jr = j.rot;
          G.audio.sfx('good');
          this.flash('Rattrapé !', P.rim, 1.1);
        } else if (q.t >= SLIP + WIN) {
          q.res = 'fail';
          q.rt = 0;
          q.jx = j.x; q.jy = j.y; q.jr = j.rot;
          this.broken++;
          this.noise = Math.min(1, this.noise + 0.2);
          G.audio.sfx('clink');
          G.audio.sfx('splash', 0.2);
          this.flash('Le bocal s’est brisé…', '#E9A27A', 1.6);
        }
      } else {
        q.rt += dt;
        if (q.res === 'fail' && !q.shattered && q.rt >= 0.22) {
          q.shattered = true;
          const gx = q.jx + this.dir * 18, gy = footY(this.hx) - 4;
          this.stains.push({ x: gx, seed: Math.random() * 1000 });
          for (let i = 0; i < 14; i++) {
            this.fx.push({ kind: i < 8 ? 'shard' : 'drop', x: gx, y: gy - 2, vx: U.rand(-110, 110), vy: U.rand(-260, -80), t: 0, life: U.rand(0.5, 0.9), floor: gy + U.rand(0, 8), r: U.rand(0, TAU) });
          }
        }
        if (q.rt >= (q.res === 'ok' ? 0.55 : 1.0)) {
          q.log.done = true;
          this.qte = null;
        }
      }
    },

    // ---------------------------------------------------------------- le ruisseau
    creekPos(idx) {
      if (idx < 0) return { x: CREEK.x0 - 14, y: footY(CREEK.x0 - 14) };
      if (idx >= STONES.length) return { x: CREEK.x1 + 14, y: footY(CREEK.x1 + 14) };
      return { x: STONES[idx].x, y: stoneTop(idx, this.t) };
    },

    updateCreek(dt) {
      const c = this.creek;
      c.ok = c.idx + 1 >= STONES.length || stoneStable(c.idx + 1, this.t);
      this.noise = Math.max(0, this.noise - 0.3 * dt);
      c.wet = Math.max(0, c.wet - dt * 1.4);
      this.moving = false;
      if (c.hop) {
        c.hop.t += dt;
        if (c.hop.t >= HOP) {
          const fail = c.hop.fail;
          c.idx = c.hop.to;
          c.hop = null;
          if (fail) {
            G.audio.sfx('splash');
            this.noise = Math.min(0.9, this.noise + 0.22);
            c.wet = 1;
            const p = this.creekPos(c.idx);
            for (let i = 0; i < 12; i++) {
              this.fx.push({ kind: 'drop', x: p.x + U.rand(-12, 12), y: WATER_Y, vx: U.rand(-90, 90), vy: U.rand(-280, -120), t: 0, life: 0.7, floor: WATER_Y + 4 });
            }
            this.flash('Pied dans l’eau !', '#B7D0E6', 1.1);
          } else G.audio.sfx('step');
          if (c.idx >= STONES.length) {
            this.creek = null;
            this.hx = CREEK.x1 + 14;
            this.viewX = this.hx;
          } else this.hx = STONES[c.idx].x;
        }
      } else if (I.confirm() || I.hit('ArrowRight') || I.hit('KeyD')) {
        I.consume();
        const nxt = c.idx + 1;
        const ok = nxt >= STONES.length || stoneStable(nxt, this.t);
        c.hop = { from: c.idx, to: nxt, t: 0, fail: !ok };
        this.dir = 1;
      }
    },

    // ---------------------------------------------------------------- l'arrivée
    startArrive() {
      this.state = 'arrive';
      this.crouchToggle = false;
      this.crouch = false;
      this.inFwd = this.inBack = false;
      this.final = { jars: 6 - this.broken, broken: this.broken, caught: this.caught, seconds: Math.round(this.seconds) };
      this.arr = { t: 0, step: 'walk', lige: LIGE_WALL, lph: 0, lmove: false, k: 0, e: 0, hookDone: false };
    },

    updateArrive(dt) {
      const ar = this.arr;
      ar.t += dt;
      this.updateAgent(dt);
      if (ar.step === 'walk') {
        const dx = HENRY_STOP - this.hx;
        this.moving = Math.abs(dx) > 0.5;
        if (this.moving) {
          const st = Math.min(Math.abs(dx), 56 * dt);
          this.hx += Math.sign(dx) * st;
          this.phase = (this.phase + st / 150) % 1;
          this.dir = 1;
        }
        if (!this.moving && ar.t > 0.9) { ar.step = 'hook'; this.runHook(); }
      } else if (ar.step === 'hook') {
        // Lige se détache du mur (voir animate) ; on attend aussi la fin du crochet.
        if (ar.hookDone && !ar.lmove) { ar.step = 'give'; ar.k = 0; }
      } else if (ar.step === 'give') {
        ar.k += dt / 1.2;
        if (ar.k >= 0.55 && this.hasCrate) { this.hasCrate = false; G.audio.sfx('clink'); }
        if (ar.k >= 1) { ar.step = 'end'; ar.e = 0; }
      } else if (ar.step === 'end') {
        ar.e += dt;
        if (ar.e >= 0.5) this.finish(this.final);
      }
    },

    runHook() {
      const done = () => { if (this.arr) this.arr.hookDone = true; };
      let p = null;
      try { p = opts.onArrive ? opts.onArrive(this.final, this) : G.wait(1.6); } catch (e) { console.error(e); }
      Promise.resolve(p).then(done, (e) => { console.error(e); done(); });
    },

    // ---------------------------------------------------------------- dessin
    henryPose() {
      const o = { x: this.hx, y: footY(this.hx), pose: 'stand', phase: this.phase, dir: this.dir, tilt: 0, arms: [0.72, 0.92] };
      const watching = this.agent.mode === 'raise' || this.agent.mode === 'sweep';
      if (this.state === 'caught' && this.ct > 0.95 && !this.respawned) {
        o.pose = 'walk'; o.dir = -1; o.phase = this.fleePh; o.arms = [0.8, 1.0];
      } else if (this.creek) {
        const c = this.creek;
        if (c.hop) {
          const k = U.clamp(c.hop.t / HOP, 0, 1);
          const a = this.creekPos(c.hop.from), b = this.creekPos(c.hop.to);
          o.x = U.lerp(a.x, b.x, k);
          o.y = U.lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * 26;
          o.pose = 'walk'; o.phase = 0.25; o.arms = [0.9, 1.1];
        } else {
          const p = this.creekPos(c.idx);
          o.x = p.x; o.y = p.y + 7 * c.wet;
          if (c.idx >= 0 && c.idx < STONES.length) o.tilt = stoneState(c.idx, this.t).rot * 0.35;
          o.tilt += 0.1 * c.wet;
        }
      } else if (this.qte) {
        const q = this.qte;
        o.arms = q.res === 'ok' ? [0.8, 1.2] : [0.95, 1.45];
        o.tilt = this.dir * (q.res ? 0.02 : 0.06 * Math.min(1, q.t / SLIP));
      } else if (this.state === 'arrive') {
        o.pose = this.moving ? 'walk' : 'stand';
        if (this.arr.step === 'give' && this.hasCrate) o.arms = [1.1, 1.38];
        if (!this.hasCrate) o.arms = [0.05, 0.25];
      } else if (this.crouch) {
        o.pose = 'crouch';
        o.arms = [1.25, 1.5];
        if (this.moving) o.y -= Math.abs(Math.sin(this.phase * TAU)) * 2.5;
      } else if (this.moving) {
        o.pose = 'walk';
        o.arms = [0.66 + Math.sin(this.phase * TAU) * 0.05, 0.9];
      }
      if (this.state === 'caught' && !this.respawned) o.rim = P.ember;
      else if (this.lit && !this.covered) o.rim = P.ember;
      else if (watching && this.covered) o.rim = 'rgba(242,210,122,0.4)';
      else o.rim = true;
      return o;
    },

    draw(ctx) {
      const L = layers();
      const cam = Math.round(this.cam);
      const t = this.t;
      G.art.blit(ctx, L.sky, 0, 0);
      // quelques étoiles qui scintillent
      ctx.fillStyle = '#eef2f8';
      for (let i = 0; i < 7; i++) {
        const a = 0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) + i * 2.1);
        ctx.globalAlpha = a * 0.8;
        ctx.beginPath(); ctx.arc((i * 181 + 40) % W, 30 + ((i * 97) % 200), 1.3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      G.art.blit(ctx, L.far, -cam * PF.far, 0);
      G.art.blit(ctx, L.mid, -cam * PF.mid, 0);
      G.art.blit(ctx, L.trees, -cam * PF.trees, 0);
      this.drawMist(ctx, L, cam, 352, 0.65, 0.12);
      for (let i = 0; i < NCHUNK; i++) {
        const x = i * CHUNK - cam;
        if (x < W && x + CHUNK > 0) G.art.blit(ctx, L.main[i], x, 0);
      }
      ctx.save();
      ctx.translate(-cam, 0);
      this.drawLive(ctx, cam, t);
      ctx.restore();
      for (let i = 0; i < NCHUNK; i++) {
        const x = i * CHUNK - cam;
        if (x < W && x + CHUNK > 0) G.art.blit(ctx, L.fg[i], x, 0);
      }
      this.drawMist(ctx, L, cam, 650, 1.15, 0.16);
      for (const p of this.fall) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      G.art.blit(ctx, L.night, 0, 0);
      G.art.finish(ctx);
    },

    drawMist(ctx, L, cam, y, par, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const span = W + 700;
      for (let i = 0; i < 5; i++) {
        const x = (((i * 430 - cam * par + this.t * (6 + i * 2)) % span) + span) % span - 350;
        ctx.drawImage(L.mist.c, x, y - 80 + Math.sin(i * 1.9) * 18, 620, 160);
      }
      ctx.restore();
    },

    drawLive(ctx, cam, t) {
      const vis = (x, m = 200) => x > cam - m && x < cam + W + m;
      // le ruisseau : reflets, écume, pierres
      if (vis(CREEK.mid, 400)) {
        const { x0, x1, mid } = CREEK;
        ctx.save();
        ctx.strokeStyle = 'rgba(175,205,230,1)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 18; i++) {
          const x = x0 + 10 + ((i * 47 + t * (14 + (i % 3) * 6)) % (x1 - x0 - 34));
          const y = WATER_Y + 2 + (i % 4) * 2.8;
          ctx.globalAlpha = 0.18 + 0.22 * Math.sin(t * 3 + i * 1.7);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + (i % 3) * 4, y); ctx.stroke();
        }
        for (let i = 0; i < 34; i++) {
          const k = (t * 0.28 + i * 0.137) % 1;
          const y = WATER_Y + 18 + k * (ROAD - 34 - WATER_Y);
          const spread = k < 0.3 ? U.lerp((x1 - x0) / 2 - 40, 70, k / 0.3) : U.lerp(70, 80, (k - 0.3) / 0.7);
          const x = mid + (((i * 0.618) % 1) - 0.5) * 2 * spread + Math.sin(k * 9 + i) * 6;
          ctx.globalAlpha = 0.3 * Math.sin(k * Math.PI);
          ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x, y + 2, x + 4, y + 1); ctx.stroke();
        }
        ctx.restore();
        for (let i = 0; i < STONES.length; i++) {
          const s = STONES[i], st = stoneState(i, t);
          const next = this.creek && !this.creek.hop && this.creek.idx + 1 === i;
          ctx.save();
          if (!st.stable) {
            ctx.strokeStyle = 'rgba(160,190,220,0.35)';
            ctx.lineWidth = 1;
            const rk = (t * 1.5 + i * 0.3) % 1;
            ctx.globalAlpha = 1 - rk;
            ctx.beginPath(); ctx.ellipse(s.x, WATER_Y + 5, 24 + rk * 16, 4 + rk * 2, 0, 0, TAU); ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.translate(s.x, WATER_Y + 4 + st.dy);
          ctx.rotate(st.rot);
          ctx.fillStyle = '#1a212d';
          ctx.beginPath(); ctx.ellipse(0, -3, 25, 11, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = st.stable ? (next ? 'rgba(242,222,160,0.75)' : 'rgba(190,210,235,0.5)') : 'rgba(110,130,160,0.3)';
          ctx.beginPath(); ctx.ellipse(2, -10, 17, 3.8, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
      // taches des bocaux brisés
      for (const s of this.stains) {
        const y = trailY(s.x) + 3;
        ctx.fillStyle = 'rgba(6,9,14,0.55)';
        ctx.beginPath(); ctx.ellipse(s.x, y, 26, 4, 0, 0, TAU); ctx.fill();
        const rnd = U.rng(Math.floor(s.seed) + 1);
        ctx.fillStyle = 'rgba(210,225,235,0.7)';
        for (let i = 0; i < 6; i++) ctx.fillRect(s.x - 18 + rnd() * 36, y - 3 + rnd() * 5, 2, 1.5);
      }
      // la ferme et le hangar : fenêtres chaudes
      if (vis(FARM_X + 40, 300)) {
        const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7);
        G.art.glow(ctx, FARM_X + 45, 394 - 60 + 28, 60, 'rgba(240,170,90,1)', 0.5 * fl);
      }
      if (vis(HANGAR_X + 50, 300)) {
        const fl = 0.85 + 0.15 * Math.sin(t * 8) * Math.sin(t * 2.9);
        const by = trailY(HANGAR_X) + 10;
        G.art.glow(ctx, HANGAR_X + 50, by - 70, 150, 'rgba(240,165,85,1)', 0.42 * fl);
        ctx.fillStyle = '#ffe2a8';
        ctx.beginPath(); ctx.arc(HANGAR_X + 64, by - 88, 3, 0, TAU); ctx.fill();
      }
      // les chiffons blancs de Dow marquent les points de passage
      for (let i = 1; i < CPS.length; i++) {
        const x = CPS[i] - 46;
        if (!vis(x)) continue;
        const y = trailY(x) - 4;
        ctx.strokeStyle = '#121822';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y - 88); ctx.moveTo(x - 3, y - 50); ctx.lineTo(x - 16, y - 66); ctx.stroke();
        const f = Math.sin(t * 3 + i) * 4;
        ctx.fillStyle = i <= this.cp ? 'rgba(216,212,200,0.6)' : '#DCD7C8';
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 86);
        ctx.quadraticCurveTo(x + 6, y - 88 + f * 0.3, x + 18 + f, y - 80 + f * 0.6);
        ctx.lineTo(x + 14 + f * 0.6, y - 72 + f * 0.4);
        ctx.quadraticCurveTo(x + 4, y - 76, x - 4, y - 74);
        ctx.fill();
      }
      // branches qui craquent
      for (const s of this.snaps) {
        const y = trailY(s.x) - 6;
        ctx.strokeStyle = `rgba(232,223,204,${s.t * 1.6})`;
        ctx.lineWidth = 2;
        for (const a of [-2.2, -1.6, -0.9]) {
          ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(s.x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.stroke();
        }
      }
      // le chien
      if (vis(DOG_X)) drawDog(ctx, this.dog, t);
      // Lige, l'homme de Dow : d'abord une ombre contre le mur du hangar
      if (vis(LIGE_WALL, 300)) {
        const ar = this.arr;
        const lx = ar ? ar.lige : LIGE_WALL;
        const has = ar && !this.hasCrate;
        let arms;
        if (has) arms = [0.75, 0.95];
        else if (ar && ar.step === 'give') arms = [0.4, 1.25];
        G.art.person(ctx, lx, footY(lx), {
          h: 160, hat: 'felt', thin: 0.3, dir: -1, seed: 5, color: '#07090d',
          pose: ar && ar.lmove ? 'walk' : 'stand', phase: ar ? ar.lph : 0,
          carry: has ? 'crate' : undefined, arms,
        });
      }
      // l'agent, sa lanterne et sa lueur
      const a = this.agent;
      if (a.x > cam - 400 && a.x < cam + W + 400) {
        const Lp = lanternPos(a);
        const fl = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 5.1);
        G.art.glow(ctx, Lp.x, Lp.y, 150 + a.lift * 40, 'rgba(255,196,112,1)', (0.34 + 0.3 * a.lift) * fl);
        ctx.save();
        ctx.translate(a.x, ROAD - 2);
        ctx.scale(1, 0.22);
        G.art.glow(ctx, 0, 0, 170, 'rgba(255,190,110,1)', 0.25 * fl);
        ctx.restore();
        const walking = a.mode === 'walk';
        const sw = walking ? Math.sin(a.phase * TAU) : 0;
        const r = G.art.char(ctx, 'revenuer', a.x, ROAD, {
          dir: a.dir, pose: walking ? 'walk' : 'stand', phase: a.phase, carry: 'lantern',
          arms: [walking ? -sw * 0.4 : -0.05, Lp.ang + (walking ? sw * 0.06 : 0)], color: '#07090d',
        });
        this.lantern = { x: r.hand.x, y: r.hand.y + AG_H * 0.03 + 11 };
        G.art.glow(ctx, this.lantern.x, this.lantern.y, 22, 'rgba(255,240,200,1)', 0.9 * fl);
      } else this.lantern = null;
      // Henry
      const hp = this.henryPose();
      const r = G.art.char(ctx, 'henry', hp.x, hp.y, {
        dir: hp.dir, pose: hp.pose, phase: hp.phase, carry: this.hasCrate ? 'crate' : undefined,
        rim: hp.rim, arms: hp.arms, tilt: hp.tilt,
      });
      this.viewX = hp.x;
      this.hand = r.hand;
      this.head = { x: hp.x, y: r.top };
      // bocaux qui tintent
      if (this.clinkFlash > 0 && this.hasCrate) {
        ctx.strokeStyle = `rgba(235,240,250,${this.clinkFlash * 2})`;
        ctx.lineWidth = 1.6;
        const jx = r.hand.x - hp.dir * 6, jy = r.hand.y - 26;
        for (const ang of [-2.4, -1.57, -0.7]) {
          ctx.beginPath(); ctx.moveTo(jx + Math.cos(ang) * 14, jy + Math.sin(ang) * 14); ctx.lineTo(jx + Math.cos(ang) * 22, jy + Math.sin(ang) * 22); ctx.stroke();
        }
      }
      // le bocal qui glisse
      if (this.qte) {
        const j = this.qteJar();
        this.jarAt = j;
        if (j) drawJar(ctx, j.x, j.y, j.rot);
      } else this.jarAt = null;
      // éclats et gouttes
      for (const p of this.fx) {
        const al = 1 - p.t / p.life;
        if (p.kind === 'shard') {
          ctx.fillStyle = `rgba(215,228,236,${al})`;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r + p.t * 8); ctx.fillRect(-2.5, -1, 5, 2); ctx.restore();
        } else {
          ctx.fillStyle = `rgba(170,200,225,${al * 0.8})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, TAU); ctx.fill();
        }
      }
      // le faisceau de la lanterne
      let alpha = 0, tx = 0;
      if (a.mode === 'raise') { alpha = 0.32 * U.clamp((a.t - 0.25) / Math.max(0.3, a.teleEnd - 0.25), 0, 1); tx = a.path[0][1]; }
      else if (a.mode === 'sweep' || a.mode === 'spot') { alpha = 1; tx = a.cur; }
      else if (a.mode === 'lower') { alpha = 1 - U.clamp(a.t / 0.6, 0, 1); tx = a.cur; }
      if (alpha > 0.01) drawBeam(ctx, this.lantern || lanternPos(a), beamTarget(tx), alpha, t);
    },

    // ---------------------------------------------------------------- interface
    hintText() {
      if (this.state !== 'play' || this.qte) return null;
      const a = this.agent;
      if (this.creek) return 'Saute quand la pierre suivante ne bouge plus.';
      const inFerns = FERNS.some(([f0, f1]) => this.hx >= f0 + 8 && this.hx <= f1 - 8);
      if ((a.mode === 'raise' || a.mode === 'sweep') && !this.leaving && inFerns && !this.crouch) return 'Baisse-toi dans les fougères !';
      if (a.mode === 'raise') {
        return this.sweeps <= 1 ? 'Il lève sa lanterne… Vite, derrière un tronc ou dans les fougères !' : 'Il lève sa lanterne… Cache-toi !';
      }
      if (a.mode === 'sweep' && !this.leaving) {
        if (this.covered) return 'Ne bouge plus…';
        return this.lit ? 'La lumière ! Cache-toi !' : 'La lumière balaie le versant. Cache-toi !';
      }
      if (this.dog.bark > 0) return 'Le chien aboie !';
      if (this.dog.alert > 0.5) return 'Le chien dresse l’oreille… Doucement.';
      if (this.noise > 0.75) return 'Les bocaux tintent ! Arrête-toi un instant.';
      if (onLeaves(this.hx) && !this.crouch) return 'Feuilles sèches : baisse-toi pour passer sans bruit.';
      if (this.leaving) return 'Le vieux hangar du carreau. Encore quelques pas.';
      if (this.playT < 7) return 'Porte la caisse jusqu’au vieux hangar de la mine.';
      return null;
    },

    drawUI(u) {
      if (this.introA < 1) {
        this.drawHud(u);
        this.drawPrompts(u);
        this.drawButtons(u);
      }
      if (this.state === 'caught') this.drawCaught(u);
      if (this.introA > 0) this.drawIntro(u, this.introA);
    },

    drawHud(u) {
      const x = 22, y = 18, w = 296, h = 118;
      u.save();
      u.fillStyle = 'rgba(14,12,11,0.74)';
      u.beginPath(); u.roundRect(x, y, w, h, 10); u.fill();
      u.strokeStyle = 'rgba(232,223,204,0.14)';
      u.lineWidth = 1;
      u.stroke();
      const lab = { size: 13, color: 'rgba(232,223,204,0.62)' };
      ui.caps(u, 'Bocaux', x + 16, y + 34, lab);
      for (let i = 0; i < 6; i++) {
        const full = i < 6 - this.broken;
        const shake = full && this.noise > 0.55 ? Math.sin(G.time * 47 + i * 2.1) * (this.noise - 0.5) * 3 : 0;
        jarIcon(u, x + 112 + i * 29, y + 28, full, shake);
      }
      ui.caps(u, 'Bruit', x + 16, y + 69, lab);
      const bx = x + 102, by = y + 58, bw = 178, bh = 14, n = this.noise;
      u.fillStyle = 'rgba(232,223,204,0.1)';
      u.beginPath(); u.roundRect(bx, by, bw, bh, 7); u.fill();
      u.globalAlpha = n > 0.8 ? 0.7 + 0.3 * Math.sin(G.time * 12) : 1;
      u.fillStyle = n < 0.5 ? '#9fb4c6' : n < 0.8 ? P.gold : P.ember;
      if (n > 0.01) { u.beginPath(); u.roundRect(bx, by, Math.max(bh, bw * n), bh, 7); u.fill(); }
      u.globalAlpha = 1;
      ui.caps(u, 'Chemin', x + 16, y + 103, lab);
      const tx0 = x + 104, tx1 = x + 258, ty = y + 98;
      u.strokeStyle = 'rgba(232,223,204,0.32)';
      u.lineWidth = 2;
      u.setLineDash([3, 4]);
      u.beginPath(); u.moveTo(tx0, ty); u.lineTo(tx1, ty); u.stroke();
      u.setLineDash([]);
      const px = (wx) => U.lerp(tx0, tx1, U.clamp((wx - START_X) / (HENRY_STOP - START_X), 0, 1));
      for (let i = 1; i < CPS.length; i++) {
        u.fillStyle = i <= this.cp ? P.rim : 'rgba(232,223,204,0.35)';
        u.beginPath(); u.arc(px(CPS[i]), ty, 3.5, 0, TAU); u.fill();
      }
      u.fillStyle = 'rgba(232,223,204,0.7)';
      u.beginPath(); u.moveTo(tx1 + 6, ty + 6); u.lineTo(tx1 + 6, ty - 2); u.lineTo(tx1 + 13, ty - 8); u.lineTo(tx1 + 20, ty - 2); u.lineTo(tx1 + 20, ty + 6); u.fill();
      u.fillStyle = P.rim;
      u.strokeStyle = '#1F1A17';
      u.lineWidth = 2;
      u.beginPath(); u.arc(px(this.viewX), ty, 5.5, 0, TAU); u.fill(); u.stroke();
      u.restore();
    },

    drawPrompts(u) {
      const cam = this.cam, a = this.agent;
      const hint = this.hintText();
      if (hint) ui.hint(u, hint);
      if (this.state === 'play' && !this.qte && !this.creek && this.covered && (a.mode === 'raise' || a.mode === 'sweep') && !this.leaving) {
        ui.tag(u, 'À l’abri', this.head.x - cam, this.head.y - 12, { active: true });
      }
      // l'agent hors de l'écran : une flèche au bord
      if (this.state === 'play' && (a.mode === 'raise' || a.mode === 'sweep')) {
        const sx = a.x - cam;
        if (sx < 10 || sx > W - 10) {
          const left = sx < 10, ex = left ? 30 : W - 30, ey = ROAD - 120;
          u.save();
          u.fillStyle = 'rgba(255,200,120,0.9)';
          u.beginPath();
          if (left) { u.moveTo(ex - 14, ey); u.lineTo(ex + 6, ey - 12); u.lineTo(ex + 6, ey + 12); }
          else { u.moveTo(ex + 14, ey); u.lineTo(ex - 6, ey - 12); u.lineTo(ex - 6, ey + 12); }
          u.fill();
          u.restore();
        }
      }
      // le ruisseau : la pierre suivante
      if (this.state === 'play' && this.creek && !this.creek.hop) {
        const nxt = this.creek.idx + 1;
        if (nxt < STONES.length) {
          const ok = stoneStable(nxt, this.t);
          tagUp(u, ok ? 'Maintenant !' : 'Ça bouge…', STONES[nxt].x - cam, WATER_Y + 20, ok);
        } else tagUp(u, 'La berge', CREEK.x1 + 24 - cam, footY(CREEK.x1 + 24) + 18, true);
      }
      // le bocal qui glisse
      const q = this.qte;
      if (q && q.t >= SLIP && q.res == null && this.jarAt) {
        const k = U.clamp(1 - (q.t - SLIP) / WIN, 0, 1);
        ui.text(u, 'Rattrape le bocal !', W / 2, 196, { size: 46, align: 'center', base: 'middle', bold: true, shadow: true });
        ui.text(u, 'Espace, clic ou toucher', W / 2, 242, { size: 21, italic: true, align: 'center', base: 'middle', color: 'rgba(232,223,204,0.8)', shadow: true });
        const jx = this.jarAt.x - cam, jy = this.jarAt.y;
        u.save();
        u.strokeStyle = 'rgba(20,16,13,0.6)';
        u.lineWidth = 7;
        u.beginPath(); u.arc(jx, jy, 26, 0, TAU); u.stroke();
        u.strokeStyle = k > 0.35 ? P.rim : P.ember;
        u.lineWidth = 4;
        u.beginPath(); u.arc(jx, jy, 26, -Math.PI / 2, -Math.PI / 2 + TAU * k); u.stroke();
        u.restore();
      }
      if (this.flashMsg) {
        const f = this.flashMsg;
        const al = Math.min(1, f.t * 3, (f.dur - f.t) * 6 + 0.2);
        ui.text(u, f.text, W / 2, 196, { size: 36, align: 'center', base: 'middle', italic: true, color: f.color, alpha: al, shadow: true });
      }
    },

    drawButtons(u) {
      if (this.state !== 'play' || this.qte) return;
      if (this.creek) {
        if (!this.creek.hop) this.btn(u, BTN.fwd, 'Sauter', 'up', false, 'Espace');
        return;
      }
      this.btn(u, BTN.back, 'Reculer', 'left', this.inBack, '← Q');
      this.btn(u, BTN.fwd, 'Avancer', 'right', this.inFwd, '→ D');
      this.btn(u, BTN.crouch, this.crouchToggle ? 'Se relever' : 'Se baisser', this.crouchToggle ? 'up' : 'down', this.crouch, '↓ S Maj');
    },

    btn(u, r, label, icon, active, key) {
      u.save();
      u.fillStyle = active ? 'rgba(242,210,122,0.24)' : 'rgba(16,13,11,0.6)';
      u.strokeStyle = active ? P.rim : 'rgba(232,223,204,0.32)';
      u.lineWidth = active ? 2 : 1.2;
      u.beginPath(); u.roundRect(r.x, r.y, r.w, r.h, 14); u.fill(); u.stroke();
      u.strokeStyle = active ? P.rim : P.paper;
      u.lineWidth = 3.2;
      u.lineCap = 'round';
      u.lineJoin = 'round';
      chevron(u, r.x + 30, r.y + r.h / 2 - 6, icon, 9);
      ui.text(u, label, r.x + 52 + (r.w - 52) / 2 - 6, r.y + r.h / 2 - 6, { size: 24, align: 'center', base: 'middle', color: P.paper });
      ui.text(u, key, r.x + r.w / 2, r.y + r.h - 13, { size: 14, align: 'center', base: 'middle', color: 'rgba(232,223,204,0.42)' });
      u.restore();
    },

    drawCaught(u) {
      const ct = this.ct, a = this.agent;
      if (ct < 1.9) {
        const al = U.clamp(ct * 5, 0, 1) * (ct > 1.5 ? 1 - (ct - 1.5) / 0.4 : 1);
        const sx = U.clamp(a.x - this.cam, 150, W - 150), sy = ROAD - AG_H - 96;
        u.save();
        u.globalAlpha = al;
        u.fillStyle = 'rgba(18,14,12,0.92)';
        u.beginPath(); u.roundRect(sx - 135, sy, 270, 76, 8); u.fill();
        ui.caps(u, G.WHO.agent ? G.WHO.agent.name : 'L’agent', sx - 115, sy + 26, { size: 13, color: (G.WHO.agent && G.WHO.agent.color) || '#B4B4B4' });
        ui.text(u, 'Hé ! Qui va là ?', sx - 115, sy + 58, { size: 28, color: P.paper });
        u.restore();
      }
      let b = 0;
      if (ct > 1.3) b = U.clamp((ct - 1.3) / 0.6, 0, 1);
      if (ct > 3.0) b = 1 - U.clamp((ct - 3.0) / 0.6, 0, 1);
      if (b > 0) {
        u.fillStyle = `rgba(8,7,6,${b})`;
        u.fillRect(0, 0, W, H);
      }
      if (ct > 1.95 && ct < 3.25) {
        const al = Math.min(1, (ct - 1.95) * 4, (3.25 - ct) * 4);
        ui.text(u, 'Tu détales entre les arbres et tu attends que la lanterne s’éloigne.', W / 2, H / 2 - 12, { size: 28, italic: true, align: 'center', base: 'middle', alpha: al, maxW: 900 });
        ui.caps(u, 'Retour au dernier point de passage', W / 2, H / 2 + 36, { size: 14, align: 'center', color: 'rgba(232,223,204,0.55)', alpha: al, spacing: 4 });
      }
    },

    drawIntro(u, a) {
      u.save();
      u.globalAlpha = a * 0.94;
      u.fillStyle = '#0d0b0a';
      u.fillRect(0, 0, W, H);
      u.globalAlpha = a;
      ui.caps(u, 'Octobre 1932 · la nuit', W / 2, 118, { align: 'center', size: 16, color: 'rgba(232,223,204,0.6)', spacing: 5 });
      ui.text(u, 'La livraison', W / 2, 178, { size: 54, align: 'center', base: 'middle' });
      ui.text(u, 'Six bocaux pour Dow Slone, à travers les bois, jusqu’au vieux hangar de la mine.', W / 2, 236, { size: 24, italic: true, align: 'center', color: 'rgba(232,223,204,0.75)' });
      const rows = [
        ['Avancer', '→ ou D, ou maintiens « Avancer »'],
        ['Reculer', '← ou Q, ou maintiens « Reculer »'],
        ['Se baisser', '↓, S ou Maj, ou touche « Se baisser »'],
        ['Rattraper, sauter', 'Espace, clic ou toucher'],
      ];
      rows.forEach(([k, v], i) => {
        const y = 312 + i * 38;
        ui.caps(u, k, W / 2 - 24, y, { align: 'right', size: 14, color: P.rim, spacing: 3 });
        ui.text(u, v, W / 2 + 4, y + 1, { size: 22, color: P.paper });
      });
      ui.text(u, 'Les feuilles sèches et les branches mortes font tinter les bocaux : arrête-toi pour qu’ils se taisent. Quand l’agent lève sa lanterne, cache-toi derrière un gros tronc ou un rocher, ou baisse-toi dans les hautes fougères.',
        W / 2, 488, { size: 22, italic: true, align: 'center', maxW: 820, lineH: 30, color: 'rgba(232,223,204,0.82)' });
      const blink = 0.35 + 0.15 * Math.sin(G.time * 3);
      ui.text(u, 'Clique ou appuie sur Espace pour partir', W / 2, H - 56, { size: 17, italic: true, align: 'center', color: `rgba(232,223,204,${blink})` });
      u.restore();
    },

    exit() {},
  });

  // Données du parcours, pour les outils de test.
  G.Scenes.moonshine.layout = { TRUNKS, ROCKS, FERNS, LEAVES, STICKS, LOGS, CREEK, CPS, SAFE_X, ARRIVE_X, coverAt };

  G.DEV = G.DEV || {};
  G.DEV.moonshine = () => G.play(G.Scenes.moonshine({}));
})();
