'use strict';
// « La photo des huit » : fin de l'épisode 1. M. Whitcomb photographie les Caudill
// sur le perron. Quatre temps : composer la photo (glisser-déposer), regarder dans
// le verre dépoli, ne plus bouger pendant la pose, puis voir le tirage se révéler.
// Résultat : { layout: { id: emplacement }, pearlInArms, retakes, blurry }.
// Le tirage reste dans G.familyPhoto (canvas 900 × 620) pour l'écran de fin.
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL;
  const A = G.art;

  // ------------------------------------------------------------------ géométrie
  const XC = 650;                 // axe de la maison
  const HL = XC - 300, HR = XC + 300; // façade
  const PF = 506;                 // plancher du perron
  const GY = 566;                 // sol de la cour
  const SEAT = 524;               // première marche, où l'on s'assoit
  const SEAT_H = GY - SEAT;
  const FRONT = 576;              // pieds de la rangée avant, debout
  const CROP = { x: XC - 292, y: 262, w: 584, h: 347 }; // cadrage de la chambre
  const PR = { w: 900, h: 620, ix: 40, iy: 34, iw: 820, ih: 487 }; // le tirage
  const GLASS = { x: 250, y: 74, w: 780, h: 463 };
  const BTN = { x: XC - 150, y: 650, w: 300, h: 50 };
  const CAM = { x: 1084, y: 568 };            // tête du trépied
  const WHIT = { x: 1196, foot: 712, h: 190 };
  const YARD = { x: 170, y: 640 };

  const ALL = ['kenneth', 'ida', 'hattie', 'clay', 'wes', 'henry', 'ruth', 'pearl'];

  // Huit places : rangée arrière debout sur le perron, rangée avant assise sur
  // la marche ou debout dans la cour. Chacun regarde vers le milieu.
  const SLOTS = [
    { x: XC - 165, foot: PF, pose: 'stand', row: 0 },
    { x: XC - 62, foot: PF, pose: 'stand', row: 0 },
    { x: XC + 62, foot: PF, pose: 'stand', row: 0 },
    { x: XC + 165, foot: PF, pose: 'stand', row: 0 },
    { x: XC - 232, foot: FRONT, pose: 'stand', row: 1 },
    { x: XC - 68, foot: GY, pose: 'sit', row: 1 },
    { x: XC + 68, foot: GY, pose: 'sit', row: 1 },
    { x: XC + 232, foot: FRONT, pose: 'stand', row: 1 },
  ].map((s, i) => Object.assign(s, {
    i, dir: s.x < XC ? 1 : -1,
    mx: s.pose === 'sit' ? s.x + (s.x < XC ? 10 : -10) : s.x,
    my: s.pose === 'sit' ? SEAT : s.foot,
  }));

  // Où chacun attend dans la cour.
  const HOME = {
    kenneth: { x: 50, y: 590, dir: 1 },
    clay: { x: 118, y: 584, dir: 1 },
    wes: { x: 186, y: 592, dir: 1 },
    ida: { x: 258, y: 586, dir: 1 },
    hattie: { x: 318, y: 606, dir: -1 },
    henry: { x: 84, y: 656, dir: 1 },
    ruth: { x: 158, y: 662, dir: 1 },
    pearl: { x: 226, y: 666, dir: 1 },
  };

  // Bras pour la pose (radians depuis la verticale, positif = vers l'avant).
  const POSE = {
    kenneth: { stand: [-0.04, 0.06] },
    ida: { stand: [0.34, 0.52] },
    hattie: { stand: [0.32, 0.58], sit: [0.78, 0.98] },
    clay: { stand: [-0.08, 0.1] },
    wes: { stand: [-0.03, 0.05] },
    henry: { stand: [-0.05, 0.08] },
    ruth: { stand: [0.3, 0.44] },
    pearl: { stand: [0.18, 0.55] },
  };

  // Comment M. Whitcomb désigne chacun.
  const LABEL = {
    pearl: 'la petite', ruth: 'la petite aux nattes', hattie: 'la grand-mère',
    henry: 'le garçon', ida: 'votre mère', kenneth: 'votre père', clay: 'tout le monde', wes: 'tout le monde',
  };

  const NB = '\u00a0'; // espace insécable avant ? et :
  const EDGE = 'rgba(240,212,160,0.55)';
  const CAPTION = 'Les Caudill, Hollis, Ky. — 22 octobre 1932';
  const THOUGHT = "Tout est à l'envers là-dedans. Comme le reste, cette année.";

  // ------------------------------------------------------------------ petits outils
  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };
  const line = (ctx, x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const inBox = (x, y, b, pad = 0) => b && x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
  const name = (id) => (G.CHARS[id] && G.CHARS[id].name) || id;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Bourdonnement de la mouche : synthèse directe, très discrète.
  function buzz(dur) {
    const ac = G.audio.ctx;
    if (!ac || G.audio.muted) return;
    try {
      const t = ac.currentTime;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(205, t);
      const lfo = ac.createOscillator();
      lfo.frequency.value = 9;
      const lg = ac.createGain();
      lg.gain.value = 22;
      lfo.connect(lg).connect(o.frequency);
      const f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 1.1;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.12);
      g.gain.setValueAtTime(0.022, t + Math.max(0.15, dur - 0.25));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(ac.destination);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    } catch (_) { /* pas de son */ }
  }

  // ------------------------------------------------------------------ décor peint
  function paintBackdrop(cx, w, h) {
    A.sky(cx, w, h, [[0, '#8C9EA6'], [0.28, '#B3B8AB'], [0.46, '#D6C6A0'], [0.64, '#E0C08E']]);
    const sun = cx.createRadialGradient(150, 96, 6, 150, 96, 600);
    sun.addColorStop(0, 'rgba(255,242,210,0.8)');
    sun.addColorStop(0.22, 'rgba(255,232,190,0.3)');
    sun.addColorStop(1, 'rgba(255,232,190,0)');
    cx.fillStyle = sun;
    cx.fillRect(0, 0, w, h);
    cx.fillStyle = 'rgba(246,238,218,0.32)';
    for (const [x, y, rx, ry] of [[430, 92, 130, 13], [520, 80, 70, 11], [860, 128, 160, 12], [950, 116, 80, 10], [1170, 66, 120, 11]]) {
      cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); cx.fill();
    }
    // montagnes au loin, puis la crête boisée en couleurs d'octobre
    A.ridge(cx, [[-60, 290], [110, 240], [280, 266], [450, 220], [620, 252], [800, 212], [980, 250], [1150, 226], [1340, 262]], '#8E9592', h);
    const mid = A.makeRidge(31, w, 322, 22, 120);
    A.ridge(cx, mid, '#6E5D42', h);
    A.dots(cx, 12, 760, -20, w + 20, (x) => [A.ridgeY(mid, x) - 8, A.ridgeY(mid, x) + 130],
      ['#9C4A22', '#B8732A', '#D9A441', '#7A2E1A', '#C98F3A', '#8A6A3A', '#6E7A40'], 6, 13, 0.55, 0.92);
    // les autres maisons du camp, toutes pareilles
    for (const [x, g, ww] of [[14, 482, 150], [196, 474, 120], [1016, 474, 130], [1160, 482, 150]]) {
      A.campHouse(cx, x, g, { w: ww, h: 56, stilt: 12, pitch: 30, smoke: false, wall: '#7A664E', roof: '#5E666E' });
    }
    const haze = cx.createLinearGradient(0, 300, 0, 486);
    haze.addColorStop(0, 'rgba(228,208,164,0)');
    haze.addColorStop(1, 'rgba(228,208,164,0.42)');
    cx.fillStyle = haze;
    cx.fillRect(0, 300, w, 186);
    A.tree(cx, 296, 480, 300, '#3E3024', ['#D9A441', '#C98F3A', '#B8732A', '#9C4A22'], 7);
    A.tree(cx, 1004, 480, 270, '#3E3024', ['#B8732A', '#7A2E1A', '#D9A441', '#9C4A22'], 19);
    // la cour : terre battue, herbe rase, feuilles tombées
    const gr = cx.createLinearGradient(0, 476, 0, h);
    gr.addColorStop(0, '#8C7757');
    gr.addColorStop(0.35, '#7B6547');
    gr.addColorStop(1, '#5B4834');
    cx.fillStyle = gr;
    cx.fillRect(0, 476, w, h - 476);
    const rnd = U.rng(5);
    for (let i = 0; i < 240; i++) {
      const x = rnd() * w, y = 482 + rnd() * 238;
      cx.strokeStyle = rnd() < 0.5 ? 'rgba(98,108,58,0.55)' : 'rgba(140,130,80,0.45)';
      cx.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) line(cx, x + k * 2, y, x + k * 2 + (rnd() - 0.5) * 5, y - 4 - rnd() * 6);
    }
    for (let i = 0; i < 300; i++) {
      const x = rnd() * w, y = 486 + rnd() * 234;
      cx.globalAlpha = 0.35 + rnd() * 0.45;
      cx.fillStyle = P.autumn[Math.floor(rnd() * 5)];
      cx.beginPath(); cx.ellipse(x, y, 2 + rnd() * 3, 1.2 + rnd() * 1.4, rnd() * 3, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
    // pierres plates du perron vers l'appareil
    const stones = [[XC - 4, 590, 26, 6], [XC + 18, 616, 24, 6], [XC - 12, 646, 28, 7], [XC + 12, 680, 30, 8]];
    for (const [x, y, rx, ry] of stones) {
      cx.fillStyle = 'rgba(60,48,34,0.6)'; cx.beginPath(); cx.ellipse(x + 2, y + 2, rx, ry, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#8F8068'; cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,240,210,0.15)'; cx.beginPath(); cx.ellipse(x - 4, y - 2, rx * 0.6, ry * 0.45, 0, 0, Math.PI * 2); cx.fill();
    }
  }

  function drawWindow(ctx, cx, top) {
    const w = 76, h = 86, x = cx - w / 2;
    ctx.fillStyle = '#4A3828';
    ctx.fillRect(x - 7, top - 7, w + 14, h + 14);
    const g = ctx.createLinearGradient(x, top, x + w, top + h);
    g.addColorStop(0, '#C2C8BE');
    g.addColorStop(0.55, '#A2ACA6');
    g.addColorStop(1, '#86918E');
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(255,255,245,0.2)';
    poly(ctx, [[x + 6, top + h], [x + 30, top], [x + 46, top], [x + 22, top + h]]);
    // rideaux taillés dans des sacs de farine
    ctx.fillStyle = '#E2D7BC';
    poly(ctx, [[x, top], [x + 20, top], [x + 9, top + h * 0.52], [x, top + h * 0.6]]);
    poly(ctx, [[x + w, top], [x + w - 20, top], [x + w - 9, top + h * 0.52], [x + w, top + h * 0.6]]);
    ctx.fillStyle = 'rgba(160,82,62,0.45)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(x + 4 + (i % 2) * 6, top + 8 + i * 7, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 4 - (i % 2) * 6, top + 8 + i * 7, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4A3828';
    ctx.fillRect(cx - 2, top, 4, h);
    ctx.fillRect(x, top + h / 2 - 2, w, 4);
    ctx.fillStyle = '#5E4834';
    ctx.fillRect(x - 11, top + h + 6, w + 22, 6);
  }

  // La maison de compagnie, de face, avec son perron couvert.
  function drawHouse(ctx) {
    // ombre de la maison sur la cour (soleil bas, à gauche)
    ctx.fillStyle = 'rgba(46,32,20,0.3)';
    poly(ctx, [[HL - 24, GY], [HR + 24, GY], [HR + 70, GY + 8], [HL + 20, GY + 8]]);
    // toit de tôle
    ctx.fillStyle = '#58626B';
    poly(ctx, [[HL - 26, 258], [HR + 26, 258], [HR - 8, 186], [HL + 8, 186]]);
    ctx.strokeStyle = 'rgba(28,32,38,0.45)';
    ctx.lineWidth = 1.4;
    for (let x = HL - 18; x <= HR + 18; x += 20) line(ctx, XC + (x - XC) * 0.95, 188, x, 258);
    const rg = ctx.createLinearGradient(HL, 186, HR, 258);
    rg.addColorStop(0, 'rgba(255,236,200,0.2)');
    rg.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = rg;
    poly(ctx, [[HL - 26, 258], [HR + 26, 258], [HR - 8, 186], [HL + 8, 186]]);
    ctx.fillStyle = 'rgba(122,46,26,0.1)';
    for (const [x, w] of [[XC - 210, 10], [XC - 40, 14], [XC + 96, 8], [XC + 230, 12]]) poly(ctx, [[x, 200], [x + w, 200], [x + w + 3, 256], [x + 2, 256]]);
    ctx.fillStyle = '#3E464F';
    ctx.fillRect(HL + 6, 183, HR - HL - 12, 5);
    // tuyau du poêle et sa fumée
    ctx.fillStyle = '#1E1E21';
    ctx.fillRect(XC + 132, 132, 10, 56);
    ctx.fillRect(XC + 128, 128, 18, 6);
    for (let i = 0; i < 4; i++) {
      const k = (G.time * 0.18 + i * 0.25) % 1;
      ctx.fillStyle = `rgba(214,208,194,${0.34 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(XC + 137 + k * 46, 122 - k * 70, 5 + k * 14, 0, Math.PI * 2); ctx.fill();
    }
    // façade en planches et couvre-joints
    ctx.fillStyle = '#6E5A44';
    ctx.fillRect(HL, 256, HR - HL, 12);
    const wg = ctx.createLinearGradient(HL, 0, HR, 0);
    wg.addColorStop(0, '#A89070');
    wg.addColorStop(1, '#907859');
    ctx.fillStyle = wg;
    ctx.fillRect(HL, 268, HR - HL, PF - 268);
    const rnd = U.rng(44);
    for (let x = HL; x < HR; x += 22) {
      ctx.fillStyle = rnd() < 0.5 ? `rgba(60,44,30,${0.04 + rnd() * 0.07})` : `rgba(255,240,210,${0.03 + rnd() * 0.06})`;
      ctx.fillRect(x, 268, 22, PF - 268);
    }
    ctx.fillStyle = 'rgba(58,42,28,0.5)';
    for (let x = HL + 21; x < HR; x += 22) ctx.fillRect(x, 268, 3, PF - 268);
    // fenêtres, porte, bassine accrochée
    drawWindow(ctx, XC - 165, 318);
    drawWindow(ctx, XC + 165, 318);
    const dw = 66, dx = XC - dw / 2, dt = 344;
    ctx.fillStyle = '#4A3828';
    ctx.fillRect(dx - 7, dt - 7, dw + 14, PF - dt + 7);
    ctx.fillStyle = '#7A6249';
    ctx.fillRect(dx, dt, dw, PF - dt);
    ctx.strokeStyle = 'rgba(40,28,18,0.55)';
    ctx.lineWidth = 2;
    for (const [px, py, pw, ph] of [[6, 10, 23, 58], [37, 10, 23, 58], [6, 82, 23, 66], [37, 82, 23, 66]]) ctx.strokeRect(dx + px, dt + py, pw, ph);
    ctx.fillStyle = '#C9A85A';
    ctx.beginPath(); ctx.arc(dx + dw - 9, dt + 82, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7E8486';
    ctx.beginPath(); ctx.ellipse(XC + 246, 372, 24, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5A6062'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(XC + 246, 372, 24, 17, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,240,0.25)';
    ctx.beginPath(); ctx.ellipse(XC + 238, 366, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    // ombre sous l'auvent
    const sg = ctx.createLinearGradient(0, 288, 0, 420);
    sg.addColorStop(0, 'rgba(34,24,16,0.5)');
    sg.addColorStop(1, 'rgba(34,24,16,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(HL, 288, HR - HL, 132);
    // auvent du perron
    ctx.fillStyle = '#69737B';
    poly(ctx, [[HL - 18, 266], [HR + 18, 266], [HR + 26, 277], [HL - 26, 277]]);
    ctx.fillStyle = '#5A4430';
    ctx.fillRect(HL - 26, 277, HR - HL + 52, 13);
    ctx.fillStyle = 'rgba(255,230,190,0.16)';
    ctx.fillRect(HL - 26, 277, HR - HL + 52, 3);
    ctx.fillStyle = '#2E241B';
    ctx.fillRect(HL - 22, 290, HR - HL + 44, 4);
    for (const px of [HL - 16, HR + 6]) {
      ctx.fillStyle = '#5E4834'; ctx.fillRect(px, 290, 10, PF - 290);
      ctx.fillStyle = 'rgba(255,236,200,0.2)'; ctx.fillRect(px, 290, 3, PF - 290);
    }
    // seau de soucis au bout du perron
    ctx.fillStyle = '#8A8F8E';
    ctx.fillRect(XC - 268, PF - 24, 22, 24);
    ctx.fillStyle = 'rgba(255,255,240,0.25)';
    ctx.fillRect(XC - 268, PF - 24, 5, 24);
    A.dots(ctx, 77, 18, XC - 274, XC - 240, () => [PF - 44, PF - 24], ['#D9A441', '#E3B64A', '#C98F3A', '#5E7A3A'], 3, 5, 0.85, 1);
    // plancher, jupe de planches sous le perron
    ctx.fillStyle = '#A08A68';
    ctx.fillRect(HL - 28, PF - 5, HR - HL + 56, 5);
    ctx.fillStyle = '#5E4834';
    ctx.fillRect(HL - 28, PF, HR - HL + 56, 9);
    ctx.fillStyle = '#6F5B44';
    ctx.fillRect(HL - 24, PF + 9, HR - HL + 48, GY - PF - 9);
    ctx.fillStyle = 'rgba(40,28,18,0.35)';
    for (let x = HL - 24 + 15; x < HR + 24; x += 16) ctx.fillRect(x, PF + 9, 2, GY - PF - 9);
    const ug = ctx.createLinearGradient(0, PF + 9, 0, PF + 30);
    ug.addColorStop(0, 'rgba(30,20,12,0.45)');
    ug.addColorStop(1, 'rgba(30,20,12,0)');
    ctx.fillStyle = ug;
    ctx.fillRect(HL - 24, PF + 9, HR - HL + 48, 21);
    // les marches
    for (let k = 0; k < 3; k++) {
      const top = PF + k * 20, half = 94 + k * 6;
      if (k > 0) { ctx.fillStyle = '#A8926F'; ctx.fillRect(XC - half, top - 4, half * 2, 4); }
      ctx.fillStyle = k === 0 ? '#6A5440' : '#7C654B';
      ctx.fillRect(XC - half, top + (k === 0 ? 9 : 0), half * 2, k === 0 ? 11 : 20);
      ctx.fillStyle = 'rgba(30,20,12,0.3)';
      ctx.fillRect(XC - half, top + 16, half * 2, 4);
    }
    ctx.fillStyle = '#4E3B2A';
    ctx.fillRect(XC - 108, PF + 4, 8, GY - PF - 4);
    ctx.fillRect(XC + 100, PF + 4, 8, GY - PF - 4);
  }

  // La chambre photographique : bois, soufflet, objectif de laiton, voile noir.
  function drawCamera(ctx, o = {}) {
    const x = CAM.x, y = CAM.y;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4E3B2A';
    ctx.lineWidth = 7;
    for (const [fx, fy] of [[x - 56, 704], [x + 6, 716], [x + 58, 702]]) line(ctx, x, y + 12, fx, fy);
    ctx.strokeStyle = 'rgba(255,230,190,0.18)';
    ctx.lineWidth = 2;
    line(ctx, x - 2, y + 14, x - 56, 702);
    ctx.fillStyle = '#3A2C20';
    ctx.fillRect(x - 16, y + 2, 32, 13);
    ctx.fillStyle = '#6B4F35';
    ctx.fillRect(x - 64, y - 6, 108, 9);
    const rx = x + 18, fx = x - 40;
    ctx.fillStyle = '#1A1714';
    poly(ctx, [[rx, y - 76], [fx, y - 62], [fx, y - 10], [rx, y - 4]]);
    ctx.strokeStyle = 'rgba(140,128,110,0.4)';
    ctx.lineWidth = 1.3;
    for (let i = 1; i < 9; i++) {
      const k = i / 9, xx = U.lerp(rx, fx, k);
      line(ctx, xx, U.lerp(y - 76, y - 62, k) + 1, xx, U.lerp(y - 4, y - 10, k) - 1);
    }
    ctx.fillStyle = '#7E5D3C';
    ctx.fillRect(fx - 10, y - 68, 12, 64);
    ctx.fillStyle = 'rgba(255,230,180,0.22)';
    ctx.fillRect(fx - 10, y - 68, 3, 64);
    ctx.fillStyle = '#B08A3E';
    ctx.beginPath(); ctx.arc(fx - 14, y - 36, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141210';
    ctx.fillRect(fx - 32, y - 45, 18, 18);
    ctx.fillStyle = o.open ? 'rgba(150,170,180,0.6)' : 'rgba(90,100,110,0.5)';
    ctx.beginPath(); ctx.ellipse(fx - 32, y - 36, 2.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    // poire de déclenchement : le câble va de l'objectif à la main du photographe
    if (o.bulb) {
      ctx.strokeStyle = '#1B1816';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx - 20, y - 26);
      ctx.bezierCurveTo(fx - 10, y + 40, o.bulb.x - 40, o.bulb.y + 40, o.bulb.x, o.bulb.y);
      ctx.stroke();
      ctx.fillStyle = '#2A2422';
      ctx.beginPath(); ctx.ellipse(o.bulb.x, o.bulb.y + 2, o.squeeze ? 5 : 7, o.squeeze ? 6 : 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // arrière : cadre de bois, verre dépoli sous le voile noir
    ctx.fillStyle = '#7E5D3C';
    ctx.fillRect(rx, y - 84, 18, 84);
    ctx.fillStyle = 'rgba(255,230,180,0.24)';
    ctx.fillRect(rx, y - 84, 4, 84);
    ctx.fillStyle = '#141110';
    ctx.beginPath();
    ctx.moveTo(rx - 6, y - 88);
    ctx.quadraticCurveTo(rx + 30, y - 98, rx + 44, y - 66);
    ctx.lineTo(rx + 52, y + 34);
    ctx.quadraticCurveTo(rx + 40, y + 46, rx + 26, y + 30);
    ctx.quadraticCurveTo(rx + 22, y - 20, rx + 12, y - 74);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,150,140,0.16)';
    ctx.lineWidth = 2;
    line(ctx, rx + 32, y - 70, rx + 42, y + 28);
    line(ctx, rx + 22, y - 60, rx + 30, y + 22);
    ctx.restore();
  }

  // ------------------------------------------------------------------ tirage
  // Flou [1 2 1] séparable sur un tableau de luminances.
  function blur121(src, w, h) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const a = src[o + (x > 0 ? x - 1 : x)], b = src[o + x], c = src[o + (x < w - 1 ? x + 1 : x)];
        tmp[o + x] = (a + 2 * b + c) * 0.25;
      }
    }
    for (let y = 0; y < h; y++) {
      const ya = (y > 0 ? y - 1 : y) * w, yb = y * w, yc = (y < h - 1 ? y + 1 : y) * w;
      for (let x = 0; x < w; x++) out[yb + x] = (tmp[ya + x] + 2 * tmp[yb + x] + tmp[yc + x]) * 0.25;
    }
    return out;
  }
  // Virage sépia : encre, terre d'ombre, bistre, papier.
  const SEP = [[0, [32, 21, 14]], [0.33, [94, 64, 42]], [0.64, [176, 138, 96]], [1, [244, 232, 206]]];
  function sepia(v, out) {
    for (let i = 0; i < SEP.length - 1; i++) {
      const [a, ca] = SEP[i], [b, cb] = SEP[i + 1];
      if (v <= b || i === SEP.length - 2) {
        const k = clamp01((v - a) / (b - a));
        out[0] = ca[0] + (cb[0] - ca[0]) * k;
        out[1] = ca[1] + (cb[1] - ca[1]) * k;
        out[2] = ca[2] + (cb[2] - ca[2]) * k;
        return out;
      }
    }
    return out;
  }
  // Développe l'image : sépia, contraste, vignettage, grain, léger flou.
  // Renvoie l'image finale et deux couches qui, multipliées, la redonnent :
  // les ombres (qui montent d'abord dans le bain) et le reste.
  function develop(src, soft) {
    const w = src.width, h = src.height;
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    const n = w * h;
    let L = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = (0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]) / 255;
    L = blur121(blur121(L, w, h), w, h);
    if (soft) L = blur121(blur121(L, w, h), w, h);
    const full = new ImageData(w, h), la = new ImageData(w, h), lb = new ImageData(w, h);
    const f = full.data, fa = la.data, fb = lb.data;
    const rnd = U.rng(1932);
    const c = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      const dy = (y / h - 0.5) * 2;
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4;
        let v = L[i];
        v = clamp01((v - 0.47) * 1.4 + 0.5);
        v = v * v * (3 - 2 * v) * 0.5 + v * 0.5;
        const dx = (x / w - 0.5) * 2;
        const r2 = dx * dx * 0.75 + dy * dy;
        v *= 1 - 0.42 * Math.pow(Math.min(1, r2 / 1.75), 1.6);
        v += (rnd() + rnd() + rnd() - 1.5) * 0.055;
        v = 0.05 + 0.9 * clamp01(v);
        sepia(v, c);
        const wgt = Math.pow(clamp01((0.62 - v) / 0.5), 0.75);
        for (let k = 0; k < 3; k++) {
          const cv = c[k];
          const av = 255 - (255 - cv) * wgt;
          f[j + k] = cv;
          fa[j + k] = av;
          fb[j + k] = av > 0 ? Math.min(255, (cv / av) * 255) : 255;
        }
        f[j + 3] = fa[j + 3] = fb[j + 3] = 255;
      }
    }
    const mk = (img) => { const cv = canvas(w, h); cv.getContext('2d').putImageData(img, 0, 0); return cv; };
    return { full: mk(full), a: mk(la), b: mk(lb) };
  }
  // Bord dentelé, en festons réguliers.
  function deckle(ctx, x, y, w, h, step, amp) {
    const nx = Math.round(w / step), ny = Math.round(h / step);
    const sx = w / nx, sy = h / ny;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < nx; i++) ctx.quadraticCurveTo(x + (i + 0.5) * sx, y - amp, x + (i + 1) * sx, y);
    for (let i = 0; i < ny; i++) ctx.quadraticCurveTo(x + w + amp, y + (i + 0.5) * sy, x + w, y + (i + 1) * sy);
    for (let i = 0; i < nx; i++) ctx.quadraticCurveTo(x + w - (i + 0.5) * sx, y + h + amp, x + w - (i + 1) * sx, y + h);
    for (let i = 0; i < ny; i++) ctx.quadraticCurveTo(x - amp, y + h - (i + 0.5) * sy, x, y + h - (i + 1) * sy);
    ctx.closePath();
  }
  function makePaper() {
    const c = canvas(PR.w, PR.h);
    const x = c.getContext('2d');
    deckle(x, 8, 8, PR.w - 16, PR.h - 16, 10, 7);
    x.fillStyle = '#EEE6D2';
    x.fill();
    x.save();
    x.clip();
    const ag = x.createRadialGradient(PR.w / 2, PR.h / 2, 200, PR.w / 2, PR.h / 2, 560);
    ag.addColorStop(0, 'rgba(180,140,80,0)');
    ag.addColorStop(1, 'rgba(170,128,70,0.2)');
    x.fillStyle = ag;
    x.fillRect(0, 0, PR.w, PR.h);
    A.texture(x, PR.w, PR.h, 0.12);
    x.restore();
    x.strokeStyle = 'rgba(130,104,66,0.4)';
    x.lineWidth = 1;
    deckle(x, 8, 8, PR.w - 16, PR.h - 16, 10, 7);
    x.stroke();
    return c;
  }
  // Poussières et une rayure : le tirage a vécu.
  function wear(ctx, alpha) {
    const rnd = U.rng(321);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(250,244,228,0.75)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath(); ctx.ellipse(PR.ix + rnd() * PR.iw, PR.iy + rnd() * PR.ih, 0.6 + rnd() * 1.3, 0.5 + rnd() * 0.9, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(250,244,228,0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(PR.ix + 610, PR.iy + 40);
    ctx.quadraticCurveTo(PR.ix + 650, PR.iy + 160, PR.ix + 628, PR.iy + 260);
    ctx.stroke();
    ctx.restore();
  }
  function drawCaption(ctx, progress) {
    ctx.save();
    ctx.translate(PR.w / 2, PR.iy + PR.ih + 58);
    ctx.rotate(-0.012);
    ctx.font = ui.font(38, 'hand');
    const w = ctx.measureText(CAPTION).width;
    if (progress < 1) {
      ctx.beginPath();
      ctx.rect(-w / 2 - 10, -50, (w + 20) * progress, 80);
      ctx.clip();
    }
    ui.text(ctx, CAPTION, 0, 0, { size: 38, kind: 'hand', color: '#38364C', align: 'center', base: 'middle' });
    ctx.restore();
  }

  // ------------------------------------------------------------------ la scène
  G.Scenes.photo = (opts = {}) => {
    const ids = (opts.members || ALL).filter((id) => ALL.includes(id));

    return G.makeScene({
      enter() {
        this.phase = 'compose';
        this.pt = 0;
        this.members = ids.map((id, k) => {
          const h = HOME[id];
          return { id, k, h: G.CHARS[id].h, seed: k * 1.37 + 0.4, slot: -1, x: h.x, y: h.y, dir: h.dir, phase: 0, moving: false, box: null };
        });
        this.byId = {};
        for (const m of this.members) this.byId[m.id] = m;
        this.inArms = false;
        this.drag = null;
        this.carry = null;          // sélection au clavier ou par toucher
        this.kb = false;            // le clavier est-il utilisé ?
        this.focus = null;          // identifiant (ou 'btn') sous le focus clavier
        this.bub = null;
        this.queue = [];
        this.said = new Set();
        this.hiddenPrev = new Set();
        this.fails = 0;
        this.blurry = false;
        this.cloth = 0;
        this.glassA = 0;
        this.veil = 0;
        this.drawList = [];
        this.leaves = [];
        this.mask = canvas(G.W / 2, G.H / 2);
        this.maskCtx = this.mask.getContext('2d', { willReadFrequently: true });
        this.dummy = canvas(2, 2).getContext('2d');
        this.glassCan = null;
        G.audio.amb(['wind', 'birds']);
        // Tab sert à choisir une personne : on empêche le navigateur d'en faire autre chose.
        this._tab = (e) => { if (e.code === 'Tab') e.preventDefault(); };
        window.addEventListener('keydown', this._tab, true);
        // Position exacte de l'appui : un glissé rapide peut bouger avant l'image suivante.
        this.down = null;
        this._down = (e) => {
          const v = G.view;
          this.down = { x: ((e.clientX - v.x) / v.w) * G.W, y: ((e.clientY - v.y) / v.h) * G.H };
        };
        window.addEventListener('pointerdown', this._down, true);
      },
      exit() {
        window.removeEventListener('keydown', this._tab, true);
        window.removeEventListener('pointerdown', this._down, true);
      },

      // ---------------------------------------------------------------- M. Whitcomb parle
      say(text, key, urgent) {
        if (key) { if (this.said.has(key)) return false; this.said.add(key); }
        const b = { text, t: 0, life: 2.4 + text.length * 0.05 };
        if (!this.bub || urgent || this.bub.t > this.bub.life - 0.3) this.bub = b;
        else this.queue.push(b);
        return true;
      },
      tickBubble(dt) {
        if (!this.bub) return;
        this.bub.t += dt;
        if (this.bub.t >= this.bub.life) this.bub = this.queue.shift() || null;
      },

      // ---------------------------------------------------------------- placement
      allPlaced() {
        if (this.drag || this.carry) return false;
        const ida = this.byId.ida;
        return this.members.every((m) => m.slot >= 0 || (m.id === 'pearl' && this.inArms && ida && ida.slot >= 0));
      },
      targetOf(m) {
        if (m.id === 'pearl' && this.inArms) return null;
        if (m.slot >= 0) { const s = SLOTS[m.slot]; return { x: s.x, y: s.foot, dir: s.dir }; }
        const h = HOME[m.id];
        return { x: h.x, y: h.y, dir: h.dir };
      },
      stepMember(m, dt) {
        if (this.drag && this.drag.m === m) return;
        const t = this.targetOf(m);
        if (!t) { m.moving = false; return; }
        const dx = t.x - m.x, dy = t.y - m.y, d = Math.hypot(dx, dy);
        if (d < 0.8) { m.x = t.x; m.y = t.y; m.moving = false; m.dir = t.dir; return; }
        const sp = (d < 40 ? Math.max(70, d * 10) : 290) * dt;
        const k = Math.min(1, sp / d);
        m.x += dx * k;
        m.y += dy * k;
        m.moving = d > 30;
        if (m.moving) {
          m.dir = Math.sign(dx) || m.dir;
          const before = m.phase;
          m.phase = (m.phase + (k * d) / 150) % 1;
          if (Math.floor(before * 2) !== Math.floor(m.phase * 2)) G.audio.sfx('step');
        } else m.dir = t.dir;
      },
      // Place m sur une cible : { kind: 'slot', i } | { kind: 'arms' } | null (la cour).
      place(m, c) {
        const from = m.id === 'pearl' && this.inArms ? -1 : m.slot;
        if (m.id === 'pearl') this.inArms = false;
        if (c && c.kind === 'arms') {
          this.inArms = true;
          m.slot = -1;
          G.audio.sfx('good');
        } else if (c && c.kind === 'slot') {
          const occ = this.members.find((o) => o !== m && o.slot === c.i);
          if (occ) occ.slot = from;
          m.slot = c.i;
          G.audio.sfx('creak');
        } else {
          m.slot = -1;
          G.audio.sfx('step');
        }
        this.afterChange(m);
      },
      afterChange(m) {
        const hidden = this.hiddenList();
        const fresh = hidden.find((id) => !this.hiddenPrev.has(id));
        this.hiddenPrev = new Set(hidden);
        if (fresh) {
          this.say(`Les grands derrière, sinon on ne verra pas ${LABEL[fresh] || 'tout le monde'}.`, null, true);
          return;
        }
        const ida = this.byId.ida;
        if (m.id === 'hattie' && (m.slot === 5 || m.slot === 6)) this.say('Parfait, la grand-mère au milieu.', 'granny', true);
        else if (m.id === 'pearl' && this.inArms) this.say(`Gardez-la contre vous, madame. Elle bougera moins.`, 'arms', true);
        else if (m.id === 'pearl' && m.slot >= 0 && ida) this.say('La petite ne tiendra jamais trois secondes sans bouger. Sa mère pourrait la prendre.', 'pearl', true);
        else if (m.slot >= 0 && SLOTS[m.slot].row === 1 && SLOTS[m.slot].pose === 'stand' && m.h >= 146 && this.members.some((o) => o.slot >= 0 && o.slot < 4 && o.h < 120)) {
          this.say('Les grands derrière, les petits devant, plutôt.', 'rows', true);
        }
        if (this.allPlaced()) this.say(`Très bien. Quand vous voulez.`, 'all');
      },
      // Qui a le visage caché par quelqu'un de la rangée de devant ?
      hiddenList() {
        const front = [], back = [];
        for (const m of this.members) {
          if (m.slot < 0 || (this.drag && this.drag.m === m)) continue;
          (SLOTS[m.slot].row === 0 ? back : front).push(m);
        }
        if (!front.length || !(back.length)) return [];
        const mx = this.maskCtx;
        mx.setTransform(1, 0, 0, 1, 0, 0);
        mx.clearRect(0, 0, this.mask.width, this.mask.height);
        mx.setTransform(0.5, 0, 0, 0.5, 0, 0);
        for (const f of front) { const s = SLOTS[f.slot]; this.drawAt(mx, f, s.x, s.foot, s.pose, s.dir, { color: '#000', rim: false, still: true }); }
        const mw = this.mask.width, mh = this.mask.height;
        const data = mx.getImageData(0, 0, mw, mh).data;
        const out = [];
        const check = (id, head, r) => {
          let n = 0, hit = 0;
          for (let yy = -r; yy <= r; yy += r / 3) {
            for (let xx = -r; xx <= r; xx += r / 3) {
              if (xx * xx + yy * yy > r * r) continue;
              n++;
              const px = Math.round((head.x + xx) / 2), py = Math.round((head.y + yy) / 2);
              if (px >= 0 && py >= 0 && px < mw && py < mh && data[(py * mw + px) * 4 + 3] > 128) hit++;
            }
          }
          if (n && hit / n > 0.34) out.push(id);
        };
        for (const b of back) {
          const s = SLOTS[b.slot];
          const r = this.drawAt(this.dummy, b, s.x, s.foot, s.pose, s.dir, { rim: false, still: true });
          check(b.id, r.info.head, b.h * 0.085);
          if (r.pearl) check('pearl', r.pearl.head, 72 * 0.085);
        }
        return out;
      },

      // ---------------------------------------------------------------- dessin des personnes
      figOpts(m, pose, dir) {
        const o = { pose, dir, seed: m.seed };
        const pr = POSE[m.id] || {};
        if (pose === 'sit') { o.seatH = SEAT_H; if (pr.sit) o.arms = pr.sit; } else if (pose === 'stand' && pr.stand) o.arms = pr.stand;
        if (m.id === 'hattie') o.carry = 'pipe';
        if (m.id === 'ida' && this.inArms) o.arms = pose === 'sit' ? [0.7, 1.12] : [0.55, 1.0];
        if (m.id === 'henry') o.rim = true;
        return o;
      },
      // Pearl qui gigote (pendant la pose surtout).
      wiggle(level) {
        const t = G.time;
        return {
          tilt: (Math.sin(t * 7.3) * 0.07 + Math.sin(t * 12.1) * 0.03) * level,
          arms: [0.3 + Math.sin(t * 6.1) * 0.9 * level, 0.7 + Math.sin(t * 8.7 + 1) * 1.2 * level],
          hop: Math.max(0, Math.sin(t * 9.4)) * 3 * level,
        };
      },
      // Dessine m en (x, foot). extra : couleur, alpha, rim, still, wiggle…
      drawAt(ctx, m, x, foot, pose, dir, extra = {}) {
        const o = Object.assign(this.figOpts(m, pose, dir), extra);
        if (extra.rim === false) o.rim = false;
        let fy = foot;
        if (m.id === 'pearl' && extra.wiggle) {
          const w = this.wiggle(extra.wiggle);
          o.tilt = w.tilt;
          if (pose === 'stand') { o.arms = w.arms; fy -= w.hop; }
        }
        if (extra.still) o.seed = 0;
        // liseré de soleil (lumière basse, à gauche) : détache les silhouettes qui se chevauchent
        if (extra.edge !== false && !o.rim && o.color !== '#000') {
          A.char(ctx, m.id, x - 1.7, fy - 1.2, Object.assign({}, o, { color: extra.edgeColor || EDGE, rim: false }));
        }
        const info = A.char(ctx, m.id, x, fy, o);
        let pearl = null;
        if (m.id === 'ida' && this.inArms && this.byId.pearl) pearl = this.drawHeld(ctx, x, foot, pose, dir, extra);
        return { info, pearl };
      },
      drawHeld(ctx, x, foot, pose, dir, extra) {
        const p = this.byId.pearl;
        const px = x + dir * (pose === 'sit' ? 25 : 22);
        const hip = pose === 'sit' ? foot - SEAT_H - 8 : foot - 80;
        const o = { pose: 'sit', seatH: 11, dir, arms: [0.55, 1.05], seed: p.seed };
        for (const k of ['color', 'alpha']) if (extra[k] != null) o[k] = extra[k];
        if (extra.wiggle) {
          const w = this.wiggle(extra.wiggle * 0.55);
          o.tilt = w.tilt;
          o.arms = [0.55, 0.9 + (w.arms[1] - 0.7) * 0.6];
        }
        if (extra.edge !== false && o.color !== '#000') A.char(ctx, 'pearl', px - 1.5, hip + 10, Object.assign({}, o, { color: extra.edgeColor || EDGE }));
        const info = A.char(ctx, 'pearl', px, hip + 11, o);
        p.x = px;
        p.y = hip + 11;
        p.heldBox = { x: Math.min(px - 12, px + dir * 34), y: hip - 44, w: 46, h: 56 };
        return info;
      },
      poseOf(m) {
        if (m.moving) return { pose: 'walk', dir: m.dir };
        if (m.slot >= 0 && Math.hypot(m.x - SLOTS[m.slot].x, m.y - SLOTS[m.slot].foot) < 30) return { pose: SLOTS[m.slot].pose, dir: SLOTS[m.slot].dir };
        return { pose: 'stand', dir: m.dir };
      },
      boxOf(m, x, foot, pose, dir) {
        const h = m.h;
        if (pose === 'sit') {
          const top = foot - SEAT_H - h * 0.58;
          return { x: dir > 0 ? x - h * 0.14 : x - h * 0.32, y: top, w: h * 0.46, h: foot - top };
        }
        const w = Math.max(34, h * 0.34);
        return { x: x - w / 2, y: foot - h * 1.04, w, h: h * 1.04 };
      },
      shadow(ctx, m, x, foot, pose) {
        if (foot < PF + 4) {
          ctx.fillStyle = 'rgba(30,20,12,0.16)';
          ctx.beginPath(); ctx.ellipse(x + 4, foot - 1, m.h * 0.16, 3, 0, 0, Math.PI * 2); ctx.fill();
          return;
        }
        ctx.fillStyle = 'rgba(40,26,14,0.28)';
        ctx.beginPath();
        ctx.ellipse(x + (pose === 'sit' ? 16 : 14) + m.h * 0.12, foot + 1, m.h * 0.24, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      },
      // Tout le monde, dans le décor de la cour (phase de composition et de pose).
      drawPeople(ctx) {
        const carrying = this.carry && this.carry.m;
        const list = this.members.filter((m) => !(m.id === 'pearl' && this.inArms) && !(this.drag && this.drag.m === m));
        list.sort((a, b) => a.y - b.y);
        const ghost = this.pz && this.pz.stage === 'fail' ? 1 - clamp01(this.pz.t / 1.4) : this.blurry && this.pz && this.pz.stage === 'done' ? 0.6 : 0;
        const wig = this.phase === 'pose' ? (this.pz.stage === 'expose' ? 1 : 0.45) : 0.12;
        const hl = this.drag && this.drag.cand && this.drag.cand.kind === 'arms';
        const hlKb = this.carry && this.carry.target && this.carry.target.kind === 'arms';
        this.drawList = [];
        for (const m of list) {
          const { pose, dir } = this.poseOf(m);
          this.shadow(ctx, m, m.x, m.y, pose);
          const extra = { phase: m.phase, wiggle: m.id === 'pearl' ? wig : 0 };
          if (m.id === 'ida' && (hl || hlKb)) extra.rim = P.rim;
          if (carrying === m) {
            if (this.carry.src === 'kb' && this.carry.target) extra.alpha = 0.35;
            else extra.rim = P.rim;
          }
          if (this.phase !== 'compose') extra.rim = m.id === 'henry';
          if (ghost > 0) {
            for (const off of [-10, 9]) this.drawAt(ctx, m, m.x + off * ghost, m.y - Math.abs(off) * 0.2 * ghost, pose, dir, Object.assign({}, extra, { alpha: 0.42, rim: false, edge: false }));
          }
          const r = this.drawAt(ctx, m, m.x, m.y, pose, dir, extra);
          m.box = this.boxOf(m, m.x, m.y, pose, dir);
          this.drawList.push(m);
          if (r.pearl) { this.byId.pearl.box = this.byId.pearl.heldBox; this.drawList.push(this.byId.pearl); }
        }
      },
      // Les mêmes, figés à leur place, pour le verre dépoli et le tirage.
      renderFigs(ctx, o = {}) {
        const list = this.members.filter((m) => m.slot >= 0);
        list.sort((a, b) => SLOTS[a.slot].foot - SLOTS[b.slot].foot || SLOTS[a.slot].row - SLOTS[b.slot].row);
        for (const m of list) {
          const s = SLOTS[m.slot];
          const extra = { rim: false, still: !!o.still, color: '#2A221D' };
          if (m.id === 'pearl' && o.wiggle) extra.wiggle = o.wiggle;
          // Bougé : un noyau net et un halo de part et d'autre.
          if (o.soft) {
            for (const off of [-5, 4.5]) this.drawAt(ctx, m, s.x + off, s.foot, s.pose, s.dir, Object.assign({}, extra, { alpha: 0.32, edge: false }));
            this.drawAt(ctx, m, s.x, s.foot, s.pose, s.dir, Object.assign({}, extra, { alpha: 0.9 }));
            continue;
          }
          // Pearl a gigoté, comme tous les enfants sur les photos de ce temps-là.
          if (m.id === 'pearl' && o.pearlSoft) {
            this.drawAt(ctx, m, s.x + 3, s.foot - 1, s.pose, s.dir, Object.assign({}, extra, { alpha: 0.4, edge: false, tilt: 0.08 }));
            this.drawAt(ctx, m, s.x, s.foot, s.pose, s.dir, Object.assign({}, extra, { alpha: 0.85 }));
            continue;
          }
          this.drawAt(ctx, m, s.x, s.foot, s.pose, s.dir, extra);
        }
      },
      renderBack(ctx) {
        A.blit(ctx, A.cached('photo-backdrop', G.W, G.H, paintBackdrop), 0, 0);
        drawHouse(ctx);
      },

      // ---------------------------------------------------------------- entrées : souris et toucher
      pickAt(x, y) {
        for (let i = this.drawList.length - 1; i >= 0; i--) {
          const m = this.drawList[i];
          if (inBox(x, y, m.box, 2)) return m;
        }
        return null;
      },
      candidate(m, fx, fy, px, py) {
        const ida = this.byId.ida;
        if (m.id === 'pearl' && ida && ida !== m && inBox(px, py, ida.box, 8)) return { kind: 'arms' };
        let best = null, bd = 92;
        for (const s of SLOTS) {
          const dd = Math.hypot(fx - s.mx, (fy - s.my) * 1.25);
          if (dd < bd) { bd = dd; best = s; }
        }
        if (!best) return null;
        if (m.id === 'pearl' && ida && ida.slot === best.i) return { kind: 'arms' };
        return { kind: 'slot', i: best.i };
      },
      pointer(dt) {
        const d = this.drag;
        if (!d) {
          if (!I.pressed) return;
          const p0 = this.down || { x: I.x, y: I.y };
          this.down = null;
          if (this.carry && this.carry.src === 'tap') { this.tapDrop(p0); return; }
          if (this.allPlaced() && U.inRect(p0, BTN)) { this.validate(); return; }
          const m = this.pickAt(p0.x, p0.y);
          if (!m) return;
          this.carry = null;
          this.kb = false;
          const fromArms = m.id === 'pearl' && this.inArms;
          if (fromArms) this.inArms = false;
          this.drag = { m, from: m.slot, fromArms, ox: m.x - p0.x, oy: m.y - p0.y, sx: p0.x, sy: p0.y, t: 0, vx: 0, px: I.x, cand: null, gx: p0.x - m.x, gy: p0.y - m.y, moved: false };
          m.slot = -1;
          m.moving = false;
          G.audio.sfx('click');
          return;
        }
        const m = d.m;
        d.t += dt;
        if (Math.hypot(I.x - d.sx, I.y - d.sy) > 8) d.moved = true;
        const fx = I.x + d.ox, fy = I.y + d.oy;
        d.cand = d.moved ? this.candidate(m, fx, fy, I.x, I.y) : null;
        let tx = fx, ty = fy;
        if (d.cand && d.cand.kind === 'slot') {
          const s = SLOTS[d.cand.i];
          tx = U.lerp(fx, s.x, 0.28);
          ty = U.lerp(fy, s.foot, 0.28);
        }
        m.x = tx; m.y = ty;
        d.vx = U.lerp(d.vx, (I.x - d.px) / Math.max(dt, 1e-3), 0.25);
        d.px = I.x;
        if (!I.down) {
          this.drag = null;
          m.slot = d.from;
          if (d.fromArms) this.inArms = true;
          if (!d.moved) {
            // Un simple appui : on sélectionne, on posera d'un second appui.
            this.carry = { m, src: 'tap', target: null };
            return;
          }
          this.place(m, d.cand);
        }
      },
      // Second appui après une sélection : sur une place, sur M'man ou dans la cour.
      tapDrop(p0) {
        const c = this.carry;
        const t = this.targetAt(c.m, p0.x, p0.y);
        this.carry = null;
        if (t === 'none') return;
        if (t === 'self') return;
        this.place(c.m, t);
      },
      targetAt(m, x, y) {
        if (inBox(x, y, m.box, 4)) return 'self';
        const ida = this.byId.ida;
        if (m.id === 'pearl' && ida && inBox(x, y, ida.box, 6)) return { kind: 'arms' };
        for (const s of SLOTS) {
          const occ = this.members.find((o) => o.slot === s.i && o !== m);
          if (Math.hypot(x - s.mx, y - s.my) < 46 || (occ && inBox(x, y, occ.box))) {
            if (m.id === 'pearl' && ida && ida.slot === s.i) return { kind: 'arms' };
            return { kind: 'slot', i: s.i };
          }
        }
        if (x < 370 && y > 470) return null;
        return 'none';
      },

      // ---------------------------------------------------------------- entrées : clavier
      focusItems() {
        const list = this.members.slice().sort((a, b) => {
          const ax = a.box ? a.box.x + a.box.w / 2 : a.x, bx = b.box ? b.box.x + b.box.w / 2 : b.x;
          return ax - bx;
        }).map((m) => m.id);
        if (this.allPlaced()) list.push('btn');
        return list;
      },
      carryTargets(m) {
        const ida = this.byId.ida;
        const out = SLOTS.map((s) => {
          if (m.id === 'pearl' && ida && ida.slot === s.i) return { kind: 'arms', x: s.mx, y: s.my - 60 };
          return { kind: 'slot', i: s.i, x: s.mx, y: s.my };
        });
        if (m.id === 'pearl' && ida && ida.slot < 0) out.push({ kind: 'arms', x: ida.x, y: ida.y - 60 });
        out.push({ kind: 'yard', x: YARD.x, y: YARD.y });
        return out;
      },
      keys() {
        const shift = I.key('ShiftLeft') || I.key('ShiftRight');
        const tab = I.hit('Tab');
        const L = I.hit('ArrowLeft'), R = I.hit('ArrowRight'), Up = I.hit('ArrowUp'), Dn = I.hit('ArrowDown');
        const act = I.hit('Space') || I.hit('Enter') || I.hit('KeyE');
        const esc = I.hit('Escape');
        if (!(tab || L || R || Up || Dn || act || esc)) return;
        if (this.carry) {
          const c = this.carry;
          if (c.src === 'tap' && !(L || R || Up || Dn || tab || act)) { if (esc) this.carry = null; return; }
          this.kb = true;
          c.src = 'kb';
          const ts = this.carryTargets(c.m);
          let cur = c.target ? ts.find((t) => t.kind === c.target.kind && t.i === c.target.i) : null;
          if (!cur) cur = ts[0];
          if (tab) {
            const i = ts.indexOf(cur);
            cur = ts[(i + (shift ? ts.length - 1 : 1)) % ts.length];
          } else if (L || R || Up || Dn) {
            const dx = R ? 1 : L ? -1 : 0, dy = Dn ? 1 : Up ? -1 : 0;
            let best = null, bs = 1e9;
            for (const t of ts) {
              if (t === cur) continue;
              const ox = t.x - cur.x, oy = t.y - cur.y;
              const along = ox * dx + oy * dy;
              if (along <= 4) continue;
              const s = along + Math.abs(ox * dy - oy * dx) * 2.2;
              if (s < bs) { bs = s; best = t; }
            }
            if (best) { cur = best; G.audio.sfx('tick'); }
          }
          c.target = cur;
          if (act) {
            this.carry = null;
            this.place(c.m, cur.kind === 'yard' ? null : cur);
            if (this.allPlaced()) this.focus = 'btn';
            else this.focus = c.m.id;
          } else if (esc) this.carry = null;
          return;
        }
        const items = this.focusItems();
        if (!this.kb || !items.includes(this.focus)) {
          this.kb = true;
          this.focus = this.focus && items.includes(this.focus) ? this.focus : (items.find((id) => id !== 'btn' && this.byId[id].slot < 0 && !(id === 'pearl' && this.inArms)) || items[0]);
          if (!act) return;
        }
        let i = items.indexOf(this.focus);
        if ((tab && !shift) || R || Dn) i = (i + 1) % items.length;
        if ((tab && shift) || L || Up) i = (i + items.length - 1) % items.length;
        if (i !== items.indexOf(this.focus)) G.audio.sfx('tick');
        this.focus = items[i];
        if (act) {
          if (this.focus === 'btn') { this.validate(); return; }
          const m = this.byId[this.focus];
          const ts = this.carryTargets(m);
          const ida = this.byId.ida;
          let target;
          if (m.id === 'pearl' && this.inArms) target = ts.find((t) => t.kind === 'arms');
          else if (m.slot >= 0) target = ts.find((t) => t.kind === 'slot' && t.i === m.slot);
          else {
            const free = SLOTS.find((s) => !this.members.some((o) => o.slot === s.i) && !(m.id === 'pearl' && ida && ida.slot === s.i));
            target = free ? ts.find((t) => t.kind === 'slot' && t.i === free.i) : ts[ts.length - 1];
          }
          this.carry = { m, src: 'kb', target };
          G.audio.sfx('click');
        }
      },

      // ---------------------------------------------------------------- enchaînement des phases
      validate() {
        if (this.phase !== 'compose') return;
        G.audio.sfx('click');
        this.phase = 'toGlass';
        this.pt = 0;
        this.focus = null;
        this.carry = null;
        this.queue = [];
        this.bub = null;
        this.say(`Viens voir, Henry. Mets la tête sous le voile.`, null, true);
      },
      startPose() {
        this.phase = 'pose';
        this.pt = 0;
        this.pz = { stage: 'ready', t: 0, n: -1, readyDur: 1.9 };
        this.say('Bien. Maintenant, ne bougez plus.', null, true);
      },
      toPrint() {
        this.phase = 'toPrint';
        this.pt = 0;
      },
      startPrint() {
        this.makePrint();
        this.phase = 'print';
        this.pt = 0;
        this.pr = { t: 0, doneAt: -1 };
        this.bub = null;
        G.audio.amb(['wind']);
        if (G.audio.SONGS && G.audio.SONGS.valley) G.audio.song(G.audio.SONGS.valley, { fadeIn: 3 });
      },
      finishScene() {
        if (this._done) return;
        const layout = {};
        for (const m of this.members) layout[m.id] = m.slot;
        if (this.inArms && this.byId.ida && layout.pearl != null) layout.pearl = this.byId.ida.slot;
        G.audio.sfx('page');
        this.finish({ layout, pearlInArms: this.inArms, retakes: this.fails, blurry: this.blurry });
      },

      // ---------------------------------------------------------------- mise à jour
      update(dt) {
        if (!G.blocked) this.pt += dt;
        this.tickBubble(dt);
        for (const m of this.members) this.stepMember(m, dt);
        this.updateLeaves(dt);
        switch (this.phase) {
          case 'compose':
            if (!this.said.has('start') && this.t > 0.9) {
              this.said.add('start');
              this.say(this.byId.kenneth
                ? `Prenez votre temps. La lumière est belle jusqu'à cinq heures.`
                : `Votre père ne viendra pas${NB}? … Bon. On fera sans lui.`);
            }
            if (G.blocked) return;
            this.keys();
            if (this.phase === 'compose') this.pointer(dt);
            break;
          case 'toGlass':
            if (this.pt > 1.9) this.cloth = clamp01((this.pt - 1.9) / 0.7);
            if (this.pt > 2.6) { this.phase = 'glass'; this.pt = 0; this.bub = null; }
            break;
          case 'glass':
            this.glassA = clamp01(this.pt / 0.9);
            if (!G.blocked && this.pt > 1.4 && I.confirm()) {
              I.consume();
              G.audio.sfx('whoosh');
              this.phase = 'fromGlass';
              this.pt = 0;
            }
            break;
          case 'fromGlass':
            this.glassA = 1 - clamp01(this.pt / 0.45);
            this.cloth = 1 - clamp01((this.pt - 0.45) / 0.7);
            if (this.pt > 1.2) this.startPose();
            break;
          case 'pose':
            this.updatePose(dt);
            break;
          case 'toPrint':
            this.veil = clamp01(this.pt / 1.1);
            if (this.pt > 1.3) this.startPrint();
            break;
          case 'print':
            this.veil = 1 - clamp01(this.pt / 1.2);
            this.updatePrint(dt);
            break;
          default: break;
        }
      },
      updatePose(dt) {
        const p = this.pz;
        if (G.blocked) return;
        p.t += dt;
        const moved = I.pressed || I.kp.size > 0;
        if (p.stage === 'ready') {
          if (p.t > p.readyDur) { p.stage = 'count'; p.t = 0; p.n = -1; }
        } else if (p.stage === 'count') {
          const n = Math.floor(p.t / 0.95);
          if (n !== p.n && n < 3) { p.n = n; G.audio.sfx('tick'); }
          if (p.t >= 2.85) {
            p.stage = 'expose'; p.t = 0;
            G.audio.sfx('shutter');
            p.buzz2 = false;
            buzz(1.0);
          }
        } else if (p.stage === 'expose') {
          if (moved) {
            I.consume();
            this.fails++;
            G.audio.sfx('shutter');
            if (this.fails >= 3) {
              this.blurry = true;
              p.stage = 'done'; p.t = 0;
              this.say('Tant pis. On la gardera comme elle est.', null, true);
            } else {
              p.stage = 'fail'; p.t = 0;
              this.say(this.fails === 1 ? 'On recommence. Personne ne bouge, cette fois.' : 'Encore une fois. Respirez, et plus un geste.', null, true);
            }
          } else if (p.t >= 2.5 && !p.buzz2) {
            p.buzz2 = true;
            buzz(0.6);
          } else if (p.t >= 3.1) {
            G.audio.sfx('shutter');
            p.stage = 'done'; p.t = 0;
            this.say(this.fails ? 'Voilà. Celle-là, elle est bonne.' : 'Voilà. Merci à vous.', null, true);
          }
        } else if (p.stage === 'fail') {
          if (p.t > 3.0) { p.stage = 'ready'; p.t = 0; p.readyDur = 1.3; this.say('Ne bougez plus.', null, true); }
        } else if (p.stage === 'done') {
          if (p.t > 2.6) this.toPrint();
        }
      },
      updatePrint(dt) {
        const r = this.pr;
        if (G.blocked) return;
        r.t += dt;
        const DEV = 7, CAP = 2.6;
        r.dev = clamp01(r.t / DEV);
        r.cap = clamp01((r.t - DEV + 0.6) / CAP);
        if (r.cap >= 1 && r.doneAt < 0) r.doneAt = r.t;
        if (I.confirm()) {
          if (r.doneAt < 0) { r.t = DEV + CAP; }
          else if (r.t > r.doneAt + 0.5) this.finishScene();
        }
      },
      updateLeaves(dt) {
        if (this.phase === 'print' || this.phase === 'glass') return;
        if (this.leaves.length < 7 && Math.random() < dt * 0.9) {
          const left = Math.random() < 0.5;
          this.leaves.push({
            x: left ? U.rand(220, 380) : U.rand(920, 1090), y: U.rand(190, 300),
            vy: U.rand(18, 32), sw: U.rand(0, 6), rot: U.rand(0, 6), vr: U.rand(-2, 2),
            c: U.pick(['#D9A441', '#B8732A', '#9C4A22', '#C98F3A']), s: U.rand(3, 5),
          });
        }
        for (const l of this.leaves) {
          l.sw += dt * 1.6;
          l.y += l.vy * dt;
          l.x += Math.sin(l.sw) * 26 * dt + 8 * dt;
          l.rot += l.vr * dt;
        }
        this.leaves = this.leaves.filter((l) => l.y < 700);
      },

      // ---------------------------------------------------------------- dessin
      draw(ctx) {
        if (this.phase === 'print') { this.drawPrint(ctx); A.finish(ctx, { grain: 0.05, vignette: 0.6 }); return; }
        if (this.phase === 'glass') { this.drawGlass(ctx); A.finish(ctx, { grain: 0.06 }); return; }
        this.renderBack(ctx);
        if (this.phase === 'compose') this.drawMarkers(ctx);
        this.drawPeople(ctx);
        if (this.phase === 'compose') this.drawGhost(ctx);
        this.drawPhotographer(ctx);
        for (const l of this.leaves) {
          ctx.save();
          ctx.translate(l.x, l.y);
          ctx.rotate(l.rot);
          ctx.fillStyle = l.c;
          ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        if (this.drag) this.drawDragged(ctx);
        if (this.cloth > 0) this.drawCloth(ctx, this.cloth);
        if (this.phase === 'fromGlass' && this.glassA > 0) this.drawGlass(ctx);
        A.finish(ctx);
      },
      drawMarkers(ctx) {
        const d = this.drag;
        const c = this.carry;
        const active = !!(d || c);
        for (const s of SLOTS) {
          const occ = this.members.some((m) => m.slot === s.i && !(d && d.m === m));
          const hot = (d && d.cand && d.cand.kind === 'slot' && d.cand.i === s.i) || (c && c.target && c.target.kind === 'slot' && c.target.i === s.i);
          if (occ && !hot) continue;
          const a = hot ? 0.75 : active ? 0.42 : 0.26 + Math.sin(G.time * 2 + s.i) * 0.06;
          ctx.save();
          ctx.strokeStyle = `rgba(246,236,210,${a})`;
          ctx.lineWidth = hot ? 2.2 : 1.6;
          ctx.setLineDash(hot ? [] : [5, 5]);
          ctx.beginPath(); ctx.ellipse(s.mx, s.my + 1, 26, 6, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // croix à la craie, comme les marques du photographe
          ctx.strokeStyle = `rgba(250,244,230,${a + 0.1})`;
          ctx.lineWidth = 2;
          line(ctx, s.mx - 5, s.my - 2, s.mx + 5, s.my + 3);
          line(ctx, s.mx + 5, s.my - 2, s.mx - 5, s.my + 3);
          if (hot) A.glow(ctx, s.mx, s.my - 30, 70, 'rgba(255,226,150,1)', 0.18);
          ctx.restore();
        }
      },
      // Où la personne va se poser : silhouette en transparence.
      drawGhost(ctx) {
        const d = this.drag, c = this.carry;
        let m = null, s = null;
        if (d && d.cand && d.cand.kind === 'slot') { m = d.m; s = SLOTS[d.cand.i]; }
        if (c && c.target && c.target.kind === 'slot' && c.src === 'kb') { m = c.m; s = SLOTS[c.target.i]; }
        if (c && c.src === 'kb' && c.target && c.target.kind === 'yard') {
          const h = HOME[c.m.id];
          A.char(ctx, c.m.id, h.x, h.y - 6 - Math.sin(G.time * 5) * 3, Object.assign(this.figOpts(c.m, 'stand', 1), { alpha: 0.85, rim: P.rim }));
          return;
        }
        if (!m || !s) return;
        const lift = c ? 6 + Math.sin(G.time * 5) * 3 : 0;
        const o = Object.assign(this.figOpts(m, s.pose, s.dir), { alpha: c ? 0.9 : 0.32, rim: c ? P.rim : false });
        if (m.id === 'ida' && this.inArms) {
          this.drawAt(ctx, m, s.x, s.foot - lift, s.pose, s.dir, { alpha: o.alpha, rim: o.rim });
          return;
        }
        A.char(ctx, m.id, s.x, s.foot - lift, o);
      },
      drawDragged(ctx) {
        const d = this.drag, m = d.m;
        const tilt = U.clamp(-d.vx * 0.0006, -0.3, 0.3);
        const gx = m.x + d.gx, gy = m.y + d.gy;
        // ombre au sol, détachée : on le soulève
        ctx.fillStyle = 'rgba(30,20,12,0.22)';
        ctx.beginPath(); ctx.ellipse(m.x + 6, m.y + 14, m.h * 0.2, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(tilt);
        ctx.translate(-gx, -gy);
        const extra = { rim: m.id === 'henry' ? P.rim : 'rgba(250,242,222,0.92)' };
        if (!(m.id === 'ida' && this.inArms)) extra.arms = [-0.32, 0.42];
        this.drawAt(ctx, m, m.x, m.y, 'stand', m.dir || 1, extra);
        ctx.restore();
        m.box = this.boxOf(m, m.x, m.y, 'stand', 1);
      },
      drawPhotographer(ctx) {
        const st = this.phase === 'pose' ? this.pz.stage : '';
        const posing = this.phase === 'pose' || this.phase === 'toPrint';
        let arms = [0.18, 1.12];
        if (posing) arms = [0.05, 0.75];
        if (this.phase === 'toGlass' && this.pt < 1.9) arms = [0.1, 1.55 + Math.sin(this.pt * 4) * 0.08];
        const info = A.char(ctx, 'whitcomb', WHIT.x, WHIT.foot, { dir: -1, h: WHIT.h, arms, color: '#241D19', seed: 9 });
        this.whitHead = info.head;
        drawCamera(ctx, { open: st === 'expose', bulb: posing ? info.hand : null, squeeze: st === 'expose' });
        // la main par-dessus l'appareil
        if (!posing) {
          ctx.fillStyle = '#241D19';
          ctx.beginPath(); ctx.arc(info.hand.x, info.hand.y, 5, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawCloth(ctx, k) {
        const e = U.easeInOut(k);
        const bottom = -40 + e * (G.H + 120);
        ctx.save();
        ctx.fillStyle = '#0d0b0a';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(G.W, -10);
        for (let x = G.W; x >= 0; x -= 40) ctx.lineTo(x, bottom + Math.sin(x * 0.013 + G.time) * 18 + Math.sin(x * 0.041) * 8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.07;
        ctx.strokeStyle = '#b8ad9c';
        ctx.lineWidth = 14;
        for (let x = 60; x < G.W; x += 150) line(ctx, x, -10, x + 20, bottom - 30);
        ctx.restore();
      },
      // ---------------------------------------------------------------- verre dépoli
      drawGlass(ctx) {
        const g = GLASS, a = this.glassA;
        ctx.fillStyle = '#0b0908';
        ctx.fillRect(0, 0, G.W, G.H);
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#c8bca8';
        for (let i = 0; i < 9; i++) {
          ctx.lineWidth = 30 + (i % 3) * 14;
          const x = i * 160 + 20;
          line(ctx, x, -20, x + 60 + Math.sin(G.time * 0.4 + i) * 10, G.H + 20);
        }
        ctx.restore();
        if (a <= 0) return;
        ctx.save();
        ctx.globalAlpha = a;
        // cadre de bois de l'arrière de la chambre
        ctx.fillStyle = '#4A3424';
        ctx.fillRect(g.x - 24, g.y - 24, g.w + 48, g.h + 48);
        ctx.fillStyle = 'rgba(255,228,180,0.12)';
        ctx.fillRect(g.x - 24, g.y - 24, g.w + 48, 4);
        ctx.fillStyle = '#0a0908';
        ctx.fillRect(g.x - 3, g.y - 3, g.w + 6, g.h + 6);
        // l'image, à l'envers
        const s = Math.min(G.dpr || 1, 1.5);
        if (!this.glassCan) this.glassCan = canvas(Math.round(g.w * s), Math.round(g.h * s));
        const gc = this.glassCan, gx = gc.getContext('2d');
        const k = (g.w / CROP.w) * s;
        if (!this.glassBase) {
          this.glassBase = canvas(gc.width, gc.height);
          const bx = this.glassBase.getContext('2d');
          bx.setTransform(k, 0, 0, k, -CROP.x * k, -CROP.y * k);
          this.renderBack(bx);
        }
        gx.setTransform(1, 0, 0, 1, 0, 0);
        gx.drawImage(this.glassBase, 0, 0);
        gx.setTransform(k, 0, 0, k, -CROP.x * k, -CROP.y * k);
        this.renderFigs(gx, { wiggle: 0.25 });
        gx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.save();
        ctx.translate(g.x + g.w / 2, g.y + g.h / 2 + Math.sin(G.time * 0.7) * 1.2);
        ctx.rotate(Math.PI);
        ctx.globalAlpha = a;
        ctx.drawImage(gc, -g.w / 2, -g.h / 2, g.w, g.h);
        ctx.restore();
        ctx.beginPath();
        ctx.rect(g.x, g.y, g.w, g.h);
        ctx.clip();
        ctx.fillStyle = 'rgba(70,92,88,0.12)';
        ctx.fillRect(g.x, g.y, g.w, g.h);
        A.texture(ctx, G.W, G.H, 0.3);
        A.glow(ctx, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.42, 'rgba(255,240,205,1)', 0.16);
        const hs = ctx.createRadialGradient(g.x + g.w / 2, g.y + g.h / 2, 120, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.62);
        hs.addColorStop(0, 'rgba(0,0,0,0)');
        hs.addColorStop(0.5, 'rgba(0,0,0,0.05)');
        hs.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = hs;
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.strokeStyle = 'rgba(236,230,214,0.2)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          line(ctx, g.x + (g.w * i) / 4, g.y, g.x + (g.w * i) / 4, g.y + g.h);
          line(ctx, g.x, g.y + (g.h * i) / 4, g.x + g.w, g.y + (g.h * i) / 4);
        }
        ctx.strokeStyle = 'rgba(236,230,214,0.35)';
        line(ctx, g.x + g.w / 2 - 10, g.y + g.h / 2, g.x + g.w / 2 + 10, g.y + g.h / 2);
        line(ctx, g.x + g.w / 2, g.y + g.h / 2 - 10, g.x + g.w / 2, g.y + g.h / 2 + 10);
        ctx.restore();
      },

      // ---------------------------------------------------------------- le tirage
      makePrint() {
        const img = canvas(PR.iw, PR.ih);
        const c = img.getContext('2d');
        const k = PR.iw / CROP.w;
        c.setTransform(k, 0, 0, k, -CROP.x * k, -CROP.y * k);
        this.renderBack(c);
        this.renderFigs(c, { still: true, soft: this.blurry, pearlSoft: !this.inArms });
        c.setTransform(1, 0, 0, 1, 0, 0);
        const dv = develop(img, this.blurry);
        const paper = makePaper();
        const out = canvas(PR.w, PR.h);
        const o = out.getContext('2d');
        o.drawImage(paper, 0, 0);
        o.globalCompositeOperation = 'multiply';
        o.drawImage(dv.full, PR.ix, PR.iy);
        o.globalCompositeOperation = 'source-over';
        wear(o, 1);
        drawCaption(o, 1);
        G.familyPhoto = out;
        this.parts = { paper, a: dv.a, b: dv.b };
      },
      // Le tirage en cours de développement, recomposé seulement quand il change.
      printFrame(dev, cap) {
        const qd = Math.round(dev * 90), qc = Math.round(cap * 120);
        if (this.printQ && this.printQ[0] === qd && this.printQ[1] === qc) return this.printCan;
        this.printQ = [qd, qc];
        if (!this.printCan) this.printCan = canvas(PR.w, PR.h);
        const o = this.printCan.getContext('2d');
        o.clearRect(0, 0, PR.w, PR.h);
        o.drawImage(this.parts.paper, 0, 0);
        // le bain : les ombres montent d'abord, puis le reste
        const da = U.smooth(clamp01(dev / 0.6)), db = U.smooth(clamp01((dev - 0.3) / 0.7));
        o.save();
        o.globalCompositeOperation = 'multiply';
        if (da > 0) { o.globalAlpha = da; o.drawImage(this.parts.a, PR.ix, PR.iy); }
        if (db > 0) { o.globalAlpha = db; o.drawImage(this.parts.b, PR.ix, PR.iy); }
        o.restore();
        if (db > 0) wear(o, db);
        if (cap > 0) drawCaption(o, U.easeInOut(cap));
        return this.printCan;
      },
      drawPrint(ctx) {
        const r = this.pr || { dev: 0, cap: 0 };
        A.blit(ctx, A.cached('photo-table', G.W, G.H, (cx, w, h) => {
          cx.fillStyle = '#1A130F';
          cx.fillRect(0, 0, w, h);
          const rnd = U.rng(8);
          for (let i = 0; i < 70; i++) {
            cx.strokeStyle = `rgba(${rnd() < 0.5 ? '96,68,44' : '40,26,18'},${0.08 + rnd() * 0.12})`;
            cx.lineWidth = 1 + rnd() * 3;
            const y = rnd() * h, bend = (rnd() - 0.5) * 24;
            cx.beginPath(); cx.moveTo(0, y); cx.quadraticCurveTo(w / 2, y + bend, w, y + bend * 0.4); cx.stroke();
          }
          const g = cx.createRadialGradient(w / 2, h * 0.44, 40, w / 2, h * 0.44, 700);
          g.addColorStop(0, 'rgba(255,214,150,0.2)');
          g.addColorStop(1, 'rgba(255,214,150,0)');
          cx.fillStyle = g;
          cx.fillRect(0, 0, w, h);
          // ombre portée du tirage, cuite une fois pour toutes
          cx.save();
          cx.shadowColor = 'rgba(0,0,0,0.7)';
          cx.shadowBlur = 28;
          cx.shadowOffsetY = 12;
          cx.fillStyle = '#16100c';
          const s = 0.93;
          cx.fillRect(w / 2 - (PR.w * s) / 2 + 10, 22 + 10, PR.w * s - 20, PR.h * s - 20);
          cx.restore();
        }), 0, 0);
        if (!this.parts) return;
        const s = 0.93, h = PR.h * s;
        ctx.save();
        ctx.translate(G.W / 2, 22 + h / 2);
        ctx.rotate(-0.009);
        ctx.scale(s, s);
        ctx.translate(-PR.w / 2, -PR.h / 2);
        ctx.drawImage(this.printFrame(r.dev, r.cap), 0, 0);
        // reflets du liquide, larges et lents, qui s'effacent
        const wet = 1 - clamp01((r.dev - 0.35) / 0.55);
        if (wet > 0) {
          ctx.beginPath();
          ctx.rect(PR.ix, PR.iy, PR.iw, PR.ih);
          ctx.clip();
          for (let i = 0; i < 3; i++) {
            const y = PR.iy - 120 + ((G.time * 26 + i * 230) % (PR.ih + 240));
            const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
            g.addColorStop(0, 'rgba(255,248,230,0)');
            g.addColorStop(0.5, `rgba(255,248,230,${0.13 * wet})`);
            g.addColorStop(1, 'rgba(255,248,230,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(PR.ix, y - 60);
            for (let x = 0; x <= PR.iw; x += 60) ctx.lineTo(PR.ix + x, y - 60 + Math.sin(x * 0.008 + G.time * 0.9 + i) * 14);
            for (let x = PR.iw; x >= 0; x -= 60) ctx.lineTo(PR.ix + x, y + 60 + Math.sin(x * 0.008 + G.time * 0.9 + i + 1) * 14);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
      },

      // ---------------------------------------------------------------- interface
      drawUI(uctx) {
        if (this.phase === 'compose') this.drawComposeUI(uctx);
        if (this.phase === 'pose') this.drawPoseUI(uctx);
        if (this.phase === 'glass' || (this.phase === 'fromGlass' && this.glassA > 0)) {
          const a = this.glassA;
          const g = GLASS;
          ui.text(uctx, THOUGHT, G.W / 2, g.y + g.h + 76, { size: 29, italic: true, align: 'center', color: '#EADFC4', alpha: a * clamp01((this.pt - 0.5) / 0.8) });
          if (this.phase === 'glass' && this.pt > 1.4) {
            ui.text(uctx, 'Appuie pour continuer', G.W / 2, G.H - 34, { size: 18, italic: true, align: 'center', color: 'rgba(232,223,204,0.62)' });
          }
        }
        if (this.phase !== 'print' && this.phase !== 'glass') this.drawBubble(uctx);
        if (this.phase === 'print' && this.pr && this.pr.doneAt >= 0 && this.pr.t > this.pr.doneAt + 0.5) {
          ui.text(uctx, 'Appuie pour continuer', G.W / 2, G.H - 30, { size: 18, italic: true, align: 'center', color: 'rgba(232,223,204,0.62)', alpha: clamp01((this.pr.t - this.pr.doneAt - 0.5) / 0.8) });
        }
        if (this.veil > 0) {
          uctx.fillStyle = `rgba(13,11,10,${this.veil})`;
          uctx.fillRect(0, 0, G.W, G.H);
        }
      },
      drawComposeUI(uctx) {
        const c = this.carry;
        ui.hint(uctx, c ? `Où va ${name(c.m.id)}${NB}?` : 'Fais glisser chacun à sa place sur le perron');
        const sub = c
          ? (c.src === 'kb' ? 'Flèches pour choisir la place, Espace pour poser, Échap pour annuler'
            : c.m.id === 'pearl' ? 'Touche une place, ou M\'man pour qu\'elle la prenne dans ses bras' : 'Touche une place libre, ou quelqu\'un pour échanger')
          : this.kb && this.focus === 'btn' ? 'Espace pour valider, ou Tab pour changer encore quelqu\'un de place'
            : this.kb ? 'Tab ou flèches pour choisir quelqu\'un, Espace pour le prendre' : 'Au clavier : Tab ou flèches pour choisir, Espace pour prendre et poser';
        this.subHint(uctx, sub);
        // étiquettes
        const d = this.drag;
        if (d) {
          const b = d.m.box;
          let label = name(d.m.id);
          if (d.cand && d.cand.kind === 'arms') label = "Dans les bras de M'man";
          if (b) ui.tag(uctx, label, b.x + b.w / 2, b.y - 6, { active: true });
        } else if (c && c.src === 'kb' && c.target) {
          const t = c.target;
          let label = name(c.m.id), x = t.x, y = t.y - c.m.h - 18;
          if (t.kind === 'arms') label = "Dans les bras de M'man";
          if (t.kind === 'yard') { label = `${name(c.m.id)} attend dans la cour`; y = HOME[c.m.id].y - c.m.h - 18; x = HOME[c.m.id].x; }
          if (t.kind === 'arms') { const ida = this.byId.ida; if (ida && ida.box) { x = ida.box.x + ida.box.w / 2; y = ida.box.y - 8; } }
          if (t.kind === 'slot' && SLOTS[t.i].pose === 'sit') y = SEAT - c.m.h * 0.6 - 16;
          ui.tag(uctx, label, Math.max(110, x), y, { active: true });
        } else if (c && c.m.box) {
          const b = c.m.id === 'pearl' && this.inArms ? c.m.heldBox : c.m.box;
          ui.tag(uctx, name(c.m.id), b.x + b.w / 2, b.y - 6, { active: true });
        } else if (this.kb && this.focus && this.focus !== 'btn') {
          const m = this.byId[this.focus];
          const b = m && (m.id === 'pearl' && this.inArms ? m.heldBox : m.box);
          if (b) {
            ui.tag(uctx, name(m.id), b.x + b.w / 2, b.y - 6, { active: true });
            uctx.strokeStyle = 'rgba(242,210,122,0.85)';
            uctx.lineWidth = 2;
            uctx.beginPath(); uctx.ellipse(b.x + b.w / 2, b.y + b.h + 2, b.w * 0.6, 5, 0, 0, Math.PI * 2); uctx.stroke();
          }
        } else if (I.mouse) {
          const m = this.pickAt(I.x, I.y);
          const b = m && (m.id === 'pearl' && this.inArms ? m.heldBox : m.box);
          if (b) ui.tag(uctx, name(m.id), b.x + b.w / 2, b.y - 6);
        }
        // le bouton, quand tout le monde est placé
        if (this.allPlaced()) {
          this.btnT = (this.btnT || 0) + 1 / 60;
          uctx.save();
          uctx.globalAlpha = clamp01(this.btnT * 3);
          const hov = ui.hover(BTN) || (this.kb && this.focus === 'btn');
          ui.button(uctx, BTN, "C'est bien comme ça", { hover: hov, key: this.kb ? 'Espace' : undefined });
          uctx.restore();
        } else this.btnT = 0;
      },
      subHint(uctx, text) {
        uctx.save();
        uctx.font = ui.font(16, 'serif', 'italic');
        const w = uctx.measureText(text).width + 30;
        uctx.fillStyle = 'rgba(20,16,13,0.6)';
        uctx.beginPath(); uctx.roundRect(G.W / 2 - w / 2, 66, w, 26, 13); uctx.fill();
        ui.text(uctx, text, G.W / 2, 80, { size: 16, italic: true, align: 'center', base: 'middle', color: 'rgba(240,232,214,0.9)' });
        uctx.restore();
      },
      drawPoseUI(uctx) {
        const p = this.pz;
        if (p.stage === 'ready' || p.stage === 'count' || p.stage === 'expose') ui.hint(uctx, 'Ne bouge plus. Ne touche plus à rien.');
        if (p.stage === 'count') {
          const words = ['Trois…', 'Deux…', 'Un…'];
          const n = Math.min(2, Math.floor(p.t / 0.95));
          const k = (p.t % 0.95) / 0.95;
          uctx.save();
          uctx.globalAlpha = Math.min(1, k * 6) * (1 - U.easeIn(k) * 0.7);
          uctx.fillStyle = 'rgba(20,16,13,0.55)';
          uctx.beginPath(); uctx.ellipse(XC, 152, 120, 46, 0, 0, Math.PI * 2); uctx.fill();
          uctx.restore();
          ui.text(uctx, words[n], XC, 150, { size: 66 + k * 10, italic: true, align: 'center', base: 'middle', color: P.paper, alpha: Math.min(1, k * 6) * (1 - U.easeIn(k) * 0.7), shadow: true });
        }
        if (p.stage === 'expose' || (p.stage === 'done' && !this.blurry && p.t < 0.6)) this.drawWatch(uctx, p.stage === 'expose' ? p.t : 3.1);
        if (p.stage === 'expose') this.drawFly(uctx, p.t);
      },
      // La montre de M. Whitcomb : l'aiguille et les secondes défilent.
      drawWatch(uctx, t) {
        const x = 120, y = 150, r = 54;
        uctx.save();
        uctx.strokeStyle = '#B08A3E';
        uctx.lineWidth = 3;
        uctx.beginPath(); uctx.arc(x, y - r - 16, 9, 0, Math.PI * 2); uctx.stroke();
        uctx.beginPath();
        uctx.moveTo(x, y - r - 25);
        uctx.bezierCurveTo(x + 40, y - r - 70, x + 90, y - r - 40, x + 130, y - r - 90);
        uctx.stroke();
        uctx.fillStyle = '#B08A3E';
        uctx.beginPath(); uctx.arc(x, y, r + 7, 0, Math.PI * 2); uctx.fill();
        uctx.fillStyle = '#EFE6CF';
        uctx.beginPath(); uctx.arc(x, y, r, 0, Math.PI * 2); uctx.fill();
        uctx.strokeStyle = '#2A2420';
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          uctx.lineWidth = i % 5 ? 1 : 2;
          const r1 = i % 5 ? r - 5 : r - 9;
          line(uctx, x + Math.sin(a) * r1, y - Math.cos(a) * r1, x + Math.sin(a) * (r - 2), y - Math.cos(a) * (r - 2));
        }
        const a = (t / 60) * Math.PI * 2 * 4 + 0.3;
        uctx.strokeStyle = '#7A2E1A';
        uctx.lineWidth = 2;
        line(uctx, x, y, x + Math.sin(a) * (r - 8), y - Math.cos(a) * (r - 8));
        uctx.fillStyle = '#2A2420';
        uctx.beginPath(); uctx.arc(x, y, 3, 0, Math.PI * 2); uctx.fill();
        uctx.restore();
        ui.text(uctx, `${t.toFixed(2).replace('.', ',')} s`, x, y + r + 40, { size: 30, align: 'center', color: P.paper, shadow: true });
        ui.caps(uctx, 'pose', x, y + r + 64, { size: 12, align: 'center', color: 'rgba(232,223,204,0.6)' });
      },
      // Une mouche se pose, juste devant. Surtout, ne pas la chasser.
      drawFly(uctx, t) {
        let x, y, flying = true;
        const land = { x: 760, y: 392 };
        if (t < 1.0) {
          const k = U.easeOut(t / 1.0);
          x = U.lerp(1320, land.x, k) + Math.sin(t * 23) * 26 * (1 - k);
          y = U.lerp(140, land.y, k) + Math.cos(t * 17) * 22 * (1 - k);
        } else if (t < 2.5) {
          flying = false;
          x = land.x + Math.min(1, (t - 1.4) * 2) * (t > 1.4 ? 9 : 0);
          y = land.y + (t > 1.4 ? Math.min(1, (t - 1.4) * 2) * 3 : 0);
        } else {
          const k = (t - 2.5) * 1.6;
          x = land.x + 9 + k * 260 + Math.sin(t * 25) * 20;
          y = land.y + 3 - k * 230 + Math.cos(t * 21) * 16;
        }
        uctx.save();
        uctx.translate(x, y);
        uctx.scale(2.2, 2.2);
        uctx.fillStyle = '#16120F';
        uctx.strokeStyle = '#16120F';
        uctx.lineWidth = 1;
        const rub = !flying && Math.sin(t * 18) > 0 ? 1.5 : 0;
        for (const s of [-1, 1]) {
          line(uctx, -2, 2, -6 - rub, 6 * s * 0 + 5);
          line(uctx, 1, 2, 2, 6);
          line(uctx, 4, 1, 8 + rub, 4);
        }
        uctx.beginPath(); uctx.ellipse(0, 0, 6, 3.6, 0, 0, Math.PI * 2); uctx.fill();
        uctx.beginPath(); uctx.arc(6, -0.5, 2.6, 0, Math.PI * 2); uctx.fill();
        uctx.fillStyle = 'rgba(122,46,26,0.8)';
        uctx.beginPath(); uctx.arc(7, -1.4, 1.1, 0, Math.PI * 2); uctx.fill();
        uctx.fillStyle = flying ? 'rgba(220,226,230,0.35)' : 'rgba(220,226,230,0.55)';
        const flap = flying ? Math.sin(G.time * 90) * 0.6 : 0.25;
        for (const s of [-1, 1]) {
          uctx.save();
          uctx.rotate(-0.4 * s + flap * s);
          uctx.beginPath(); uctx.ellipse(-4, -3 * s, 5.5, 2.4, 0.3 * s, 0, Math.PI * 2); uctx.fill();
          uctx.restore();
        }
        uctx.restore();
      },
      drawBubble(uctx) {
        const b = this.bub;
        if (!b || !this.whitHead) return;
        const a = Math.min(1, b.t * 5) * clamp01((b.life - b.t) * 3) * (1 - clamp01(this.cloth * 2.5));
        if (a <= 0) return;
        uctx.save();
        uctx.globalAlpha = a;
        uctx.font = ui.font(20, 'serif', 'italic');
        const lines = ui.wrap(uctx, b.text, 290);
        const tw = Math.max(...lines.map((l) => uctx.measureText(l).width));
        const w = tw + 36, h = lines.length * 25 + 42;
        const ax = this.whitHead.x - 14, ay = this.whitHead.y - 26;
        const x = Math.min(G.W - 14 - w, ax - w + 60), y = ay - h - 12;
        uctx.fillStyle = 'rgba(238,230,212,0.95)';
        uctx.beginPath(); uctx.roundRect(x, y, w, h, 10); uctx.fill();
        uctx.beginPath();
        uctx.moveTo(Math.min(ax - 4, x + w - 30), y + h - 1);
        uctx.lineTo(Math.min(ax + 12, x + w - 14), y + h - 1);
        uctx.lineTo(ax + 6, ay);
        uctx.fill();
        ui.caps(uctx, 'M. Whitcomb', x + 18, y + 21, { size: 11, color: '#6A7684' });
        lines.forEach((l, i) => ui.text(uctx, l, x + 18, y + 45 + i * 25, { size: 20, italic: true, color: P.ink }));
        uctx.restore();
      },
    });
  };

  G.DEV = G.DEV || {};
  G.DEV.photo = () => G.play(G.Scenes.photo({}));
  G.DEV.photo7 = () => G.play(G.Scenes.photo({ members: ['ida', 'hattie', 'clay', 'wes', 'henry', 'ruth', 'pearl'] }));
})();
