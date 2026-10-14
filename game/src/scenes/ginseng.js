'use strict';
// « Le sang » : le ginseng, avec Granny. Deux phases dans une même scène.
//   1. Chercher : on fouille un sous-bois d'octobre, en pente, deux écrans et demi
//      de large. Toucher une plante ouvre une fiche d'examen (gros plan à côté de la
//      règle de Granny) : Creuser ou Laisser. Les leurres coûtent du jour.
//   2. Déterrer : vue en coupe du sol. On gratte la terre au bâton (rapide, mais il
//      blesse la racine) ou aux doigts (lent, sans danger pour les radicelles),
//      puis on tire la racine.
//
// G.Scenes.ginseng(opts) → this.finish({ roots: [{ quality }], mistakes: { creeper,
//   sarsaparilla, ivy, jack }, itchy })
//   opts.onRoot({ index, quality })  async, attendue après chaque racine (index à partir de 0)
//   opts.onMistake({ kind })         async, remplace la réplique de Granny après un leurre
//   opts.goal (3 racines)  opts.time (180 s de jour)  opts.seed (décor)
//   opts.intro / opts.outro : false pour taire les répliques d'ouverture et de fin.
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL, A = G.art;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ réglages
  const WW = 3200;                                 // largeur du sous-bois
  const PF = 0.25, PM = 0.55, PFG = 1.15, PTR = 1.35; // parallaxes
  const FORE_Y = 596, FORE_H = 124;                // bande de fougères au premier plan
  const SY = 214;                                  // phase 2 : niveau du sol
  const CELL = 8;                                  // maille de la grille de terre
  const PULL_AT = 0.85;                            // terre à dégager avant de tirer
  const PENALTY = 12;                              // secondes de jour perdues par leurre
  const TOOLS = {
    stick: { r: 26, a: 0.8, gap: 9, rate: 6 },
    fingers: { r: 14, a: 0.15, gap: 7, rate: 1.6 },
  };
  const TYPES = ['ginseng', 'ginseng', 'ginseng', 'ginseng', 'ginseng',
    'creeper', 'creeper', 'sarsaparilla', 'sarsaparilla', 'ivy', 'ivy', 'jack', 'jack'];
  const RULE = ['Trois ou quatre branches', 'cinq feuilles par branche', 'une grappe de baies rouges au milieu'];

  // ------------------------------------------------------------------ répliques
  const LINES = {
    intro: 'Le sang se cache sous les autres feuilles. Regarde bien, et compte avant de creuser.',
    firstDig: 'Gratte autour avec le bâton, mais pas trop près. Contre la racine, prends tes doigts.',
    done: 'Trois. Ça suffit pour aujourd\'hui. Le reste, on le laisse grandir.',
    dusk: 'Le jour tombe. On rentre.',
    mistake: {
      creeper: 'De la vigne vierge. Cinq feuilles, je te l\'accorde. Mais t\'as déjà vu le sang grimper aux arbres ?',
      sarsaparilla: 'De la salsepareille. Pas une baie rouge au milieu. Ça fait de la tisane, pas des sous.',
      ivy: 'C\'est de l\'herbe à puce, mon garçon. Ça va te gratter jusqu\'à dimanche.',
      jack: 'Un petit-prêcheur. Les baies sont rouges, d\'accord. Compte les feuilles : deux, de trois chacune.',
    },
    root: {
      whole: 'Ça, c\'est du beau sang. Regarde-moi ces jambes.',
      hurt: 'Elle est marquée, mais elle se vendra.',
      broken: 'Cassée. Le marchand en donnera moitié moins. La prochaine, prends ton temps.',
    },
  };
  const AMBIENT = [
    'En octobre, le sang jaunit avant les autres.',
    'Regarde par terre, pas dans les arbres.',
    'Il aime l\'ombre, et les pentes qui regardent le nord.',
    'Prends ton temps. Il a mis des années à pousser.',
    'Ton grand-père, il le trouvait rien qu\'à l\'odeur. Moi, je regarde.',
  ];
  const GOOD_LEAVE = ['Bien. Celle-là, on la laisse.', 'T\'as l\'œil.', 'Bon. Continue.'];

  // ------------------------------------------------------------------ utilitaires
  const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => {
    const x = hexRgb(a), y = hexRgb(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
  };
  const rgba = (c, a) => { const x = hexRgb(c); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };
  const pickR = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr, rnd) => {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  };
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    const t = U.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    const x = x1 + dx * t, y = y1 + dy * t;
    return { d: Math.hypot(px - x, py - y), t, x, y };
  }
  const ell = (ctx, x, y, rx, ry, rot, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    ctx.fill();
  };
  const rrect = (ctx, r, rad) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); };
  // Ligne de crête du sentier (pieds de Granny) ; la pente descend vers nous.
  const groundTop = (x) => 446 + 20 * Math.sin(x / 430 + 1) + 9 * Math.sin(x / 167 + 2);

  // ------------------------------------------------------------------ feuilles
  // Une foliole, base en (x, y), pointe dans la direction ang. k < 1 : la feuille
  // est à plat, vue d'en haut et en biais (écrasement vertical).
  function leaflet(ctx, x, y, ang, len, wid, fill, o) {
    ctx.save();
    ctx.translate(x, y);
    if (o.k != null && o.k !== 1) ctx.scale(1, o.k);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (o.shape === 'ovate') {
      ctx.bezierCurveTo(len * 0.12, -wid * 1.05, len * 0.62, -wid * 0.95, len, 0);
      ctx.bezierCurveTo(len * 0.62, wid * 0.95, len * 0.12, wid * 1.05, 0, 0);
    } else {
      ctx.bezierCurveTo(len * 0.28, -wid * 0.42, len * 0.72, -wid * 1.12, len, 0);
      ctx.bezierCurveTo(len * 0.72, wid * 1.12, len * 0.28, wid * 0.42, 0, 0);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (o.det) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(40,22,8,0.16)';
      ctx.fillRect(0, 0, len, wid * 1.3);
      if (o.edge) { ctx.strokeStyle = o.edge; ctx.lineWidth = wid * 0.4; ctx.stroke(); }
      ctx.restore();
      if (o.teeth) {
        ctx.save();
        ctx.setLineDash([len * 0.035, len * 0.035]);
        ctx.strokeStyle = 'rgba(50,30,10,0.4)';
        ctx.lineWidth = len * 0.025;
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(60,36,12,0.38)';
      ctx.lineWidth = Math.max(0.5, len * 0.026);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(len * 0.93, 0);
      for (const t of [0.3, 0.48, 0.66]) {
        ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.16), -wid * 0.62);
        ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.16), wid * 0.62);
      }
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(50,30,10,0.28)';
      ctx.lineWidth = Math.max(0.4, len * 0.04);
      ctx.beginPath(); ctx.moveTo(len * 0.1, 0); ctx.lineTo(len * 0.85, 0); ctx.stroke();
    }
    if (o.gloss) {
      ctx.strokeStyle = 'rgba(255,236,210,0.5)';
      ctx.lineWidth = len * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(len * 0.22, -wid * 0.3);
      ctx.quadraticCurveTo(len * 0.5, -wid * 0.62, len * 0.8, -wid * 0.26);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Feuille palmée : folioles en éventail autour de phi (les petites d'abord).
  const PALM5 = [[-1.22, 0.46], [1.22, 0.46], [-0.6, 0.8], [0.6, 0.8], [0, 1]];
  function palm(ctx, x, y, phi, L, cols, o) {
    PALM5.forEach(([off, lk], i) => {
      const len = L * lk;
      leaflet(ctx, x, y, phi + off * (o.spread || 1), len, len * (o.wr || 0.36), cols[i % cols.length], o);
    });
  }
  // Feuille pennée (salsepareille) : deux paires et une foliole au bout.
  function pinnate(ctx, wx, wy, phi, Lr, L, cols, o) {
    const at = (d) => [wx + Math.cos(phi) * d, wy + Math.sin(phi) * d * o.k + (o.droop || 0) * d / Lr];
    const [ex, ey] = at(Lr);
    ctx.strokeStyle = o.stemC;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo((wx + ex) / 2, (wy + ey) / 2 - 3, ex, ey); ctx.stroke();
    [[0.48, -1.0, 0.7], [0.48, 1.0, 0.7], [0.76, -0.78, 0.84], [0.76, 0.78, 0.84]].forEach(([f, off, lk], i) => {
      const [x, y] = at(Lr * f);
      leaflet(ctx, x, y, phi + off, L * lk, L * lk * 0.42, cols[i], o);
    });
    leaflet(ctx, ex, ey, phi, L, L * 0.42, cols[4], o);
  }
  function berry(ctx, x, y, r, c, hl) {
    ell(ctx, x, y, r, r, 0, c);
    if (hl) ell(ctx, x - r * 0.35, y - r * 0.38, r * 0.34, r * 0.28, 0, hl);
  }

  // ------------------------------------------------------------------ les plantes
  const YEL = ['#D9AE44', '#CFA23C', '#E0BC58', '#C9A23E', '#D6B04C', '#BFA545', '#C8B04E'];
  const BRZ = ['#B49446', '#A88A3E', '#C2A452', '#9C8040', '#B89A50', '#A69048'];
  const JAK = ['#C9B45A', '#BDA34A', '#D2BE68', '#B09A48'];
  const RED = ['#B02E1C', '#C8442A', '#9E2818', '#D25A30', '#A63A20'];
  const IVY = ['#C2401E', '#A8301A', '#D0582A', '#B84822', '#DA6A36'];

  function makeParams(type, rnd) {
    const q = {};
    const ball = (n, R, cols, rmin, rmax) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, rr = R * Math.sqrt(rnd());
        out.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.85, r: rmin + rnd() * (rmax - rmin), c: pickR(rnd, cols) });
      }
      return out.sort((a, b) => a.y - b.y);
    };
    const five = (pal) => [pickR(rnd, pal), pickR(rnd, pal), pickR(rnd, pal), pickR(rnd, pal), pickR(rnd, pal)];
    const spokes = (base) => {
      const flip = rnd() < 0.5;
      return base.map((f) => { const a = f + (rnd() - 0.5) * 0.35; return flip ? Math.PI - a : a; });
    };
    if (type === 'ginseng') {
      q.H = 48 + rnd() * 10; q.lean = (rnd() - 0.5) * 8; q.bend = (rnd() - 0.5) * 6;
      q.Lp = 19 + rnd() * 5; q.L = 23 + rnd() * 4; q.k = 0.54;
      q.phis = spokes(rnd() < 0.5 ? [0, TAU / 3, 2 * TAU / 3] : [0.785, 2.356, 3.927, 5.498]);
      q.cols = q.phis.map(() => { const c = pickR(rnd, YEL); return [c, pickR(rnd, YEL), c, pickR(rnd, YEL), c]; });
      q.stemC = pickR(rnd, ['#7A6A38', '#86603A', '#74683A']);
      q.ped = 9 + rnd() * 4; q.bx = (rnd() - 0.5) * 3;
      q.berries = ball(10 + Math.floor(rnd() * 6), 4.6, ['#C42A1E', '#D8402A', '#B0201A', '#E04A30'], 2.1, 2.7);
    } else if (type === 'sarsaparilla') {
      q.H = 60 + rnd() * 9; q.lean = (rnd() - 0.5) * 8; q.bend = (rnd() - 0.5) * 8;
      q.Lr = 27 + rnd() * 4; q.L = 17 + rnd() * 3; q.k = 0.5; q.droop = 4;
      q.phis = spokes([0, TAU / 3, 2 * TAU / 3]);
      q.cols = q.phis.map(() => five(BRZ));
      q.stemC = '#7A5A36';
      const side = rnd() < 0.5 ? -1 : 1;
      q.sx = side * (12 + rnd() * 6); q.Hb = 28 + rnd() * 6;
      q.umbels = [[-6, -2], [0, -6], [6, -1]].map(([x, y]) => ({
        x: x + (rnd() - 0.5) * 2, y,
        b: ball(7 + Math.floor(rnd() * 3), 3.2, ['#2E1F3A', '#3C2848', '#241830', '#463056'], 1.6, 2.1),
      }));
    } else if (type === 'jack') {
      q.k = 0.52; q.L = 25 + rnd() * 4; q.cols = JAK;
      q.leaves = [
        { bx: -3, tx: -18 - rnd() * 6, H: 66 + rnd() * 7, phi0: rnd() * TAU, c: 0 },
        { bx: 3, tx: 17 + rnd() * 6, H: 52 + rnd() * 6, phi0: rnd() * TAU, c: 1 },
      ];
      if (rnd() < 0.5) q.leaves.forEach((l) => { l.tx = -l.tx; l.bx = -l.bx; });
      q.Hc = 26 + rnd() * 5; q.cx = (rnd() - 0.5) * 4;
      q.club = [];
      for (let r = 0; r < 7; r++) {
        const wf = Math.sin(Math.PI * (r + 0.6) / 7.4);
        for (const c of [-1, 0, 1]) {
          q.club.push({ x: (c * 3.1 + (r % 2 ? 0.8 : -0.8)) * wf, y: -18 + r * 2.7, r: 2 + rnd() * 0.4, c: pickR(rnd, ['#D6301E', '#E8452C', '#C42818']) });
        }
      }
    } else if (type === 'ivy') {
      q.H = 32 + rnd() * 10;
      const side = rnd() < 0.5 ? -1 : 1;
      const s0 = [[0, 0], [(rnd() - 0.5) * 6, -q.H * 0.5], [(rnd() - 0.5) * 10, -q.H]];
      const br = [s0[1][0] + 15 * side, s0[1][1] - 13];
      q.stems = [s0, [s0[1], br]];
      const leaf = (x, y, ang) => ({ x, y, ang, pl: 8 + rnd() * 5, L: 15 + rnd() * 5, cols: [pickR(rnd, IVY), pickR(rnd, IVY), pickR(rnd, IVY)] });
      q.leaves = [
        leaf(s0[1][0], s0[1][1] + 8, -Math.PI / 2 - side * 1.25),
        leaf(br[0], br[1], -Math.PI / 2 + side * 0.85),
        leaf(s0[2][0], s0[2][1], -Math.PI / 2 + (rnd() - 0.5) * 0.5),
      ];
      if (rnd() < 0.6) q.leaves.unshift(leaf(s0[0][0], -q.H * 0.18, -Math.PI / 2 + side * 1.45));
      q.berries = [{ x: s0[1][0] - side * 4, y: s0[1][1] + 7, b: ball(7, 4, ['#E8E0C8', '#D8CFB0', '#EEE6D2'], 1.8, 2.3) }];
    } else if (type === 'creeper') {
      q.tw = 46 + rnd() * 12; q.L = 17;
      q.vine = [];
      let x = (rnd() - 0.5) * 8;
      for (let i = 0; i <= 14; i++) { q.vine.push([x + Math.sin(i * 0.9 + rnd()) * 4, -i * 12.5]); x += (rnd() - 0.5) * 3; }
      q.leaves = [];
      let side = rnd() < 0.5 ? -1 : 1;
      for (const vi of [2, 5, 8, 11, 14]) {
        q.leaves.push({ vi, ang: -Math.PI / 2 + side * (0.95 + rnd() * 0.55), pl: 10 + rnd() * 5, L: 20 + rnd() * 4, cols: five(RED) });
        side = -side;
      }
      q.bunches = [5, 9].map((vi, i) => ({ vi, side: i ? 1 : -1, b: ball(6, 3.5, ['#28304E', '#1E2540', '#33406A'], 2, 2.6) }));
      q.ground = [{ x: -24, y: -1, phi: Math.PI + 0.3 }, { x: 22, y: 1, phi: -0.25 }];
      q.cols = RED;
    }
    return q;
  }

  // Dessin d'une plante en unités (≈ 1 px à l'échelle 1), base en (0, 0).
  // det : gros plan (nervures, dents, reflets).
  const DRAW = {
    ginseng(ctx, q, det) {
      const wx = q.lean, wy = -q.H;
      ctx.lineCap = 'round';
      ctx.strokeStyle = q.stemC; ctx.lineWidth = 2.3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(q.bend, -q.H * 0.55, wx, wy); ctx.stroke();
      const prongs = q.phis.map((phi, i) => ({ phi, i, z: Math.sin(phi) })).sort((a, b) => a.z - b.z);
      for (const pr of prongs) {
        const ex = wx + Math.cos(pr.phi) * q.Lp, ey = wy + Math.sin(pr.phi) * q.Lp * q.k - 2;
        ctx.strokeStyle = q.stemC; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(ex, ey); ctx.stroke();
        palm(ctx, ex, ey, pr.phi, q.L, q.cols[pr.i], { k: q.k, det, teeth: true });
      }
      // la grappe de baies rouges, au milieu
      const bx = wx + q.bx, by = wy - q.ped;
      ctx.strokeStyle = q.stemC; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(bx, by); ctx.stroke();
      for (const b of q.berries) berry(ctx, bx + b.x, by + b.y, b.r, b.c, 'rgba(255,215,190,0.6)');
    },
    sarsaparilla(ctx, q, det) {
      ctx.lineCap = 'round';
      // les baies sombres poussent à part, plus bas que la feuille
      const sx = q.sx, top = -q.Hb;
      ctx.strokeStyle = '#6A5034'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx * 0.3, 0); ctx.quadraticCurveTo(sx, -q.Hb * 0.5, sx, top); ctx.stroke();
      ctx.lineWidth = 0.9;
      for (const u of q.umbels) { ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(sx + u.x, top + u.y); ctx.stroke(); }
      for (const u of q.umbels) for (const b of u.b) berry(ctx, sx + u.x + b.x, top + u.y + b.y, b.r, b.c, 'rgba(190,170,210,0.45)');
      const wx = q.lean, wy = -q.H;
      ctx.strokeStyle = q.stemC; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(q.bend, -q.H * 0.6, wx, wy); ctx.stroke();
      const prongs = q.phis.map((phi, i) => ({ phi, i, z: Math.sin(phi) })).sort((a, b) => a.z - b.z);
      for (const pr of prongs) {
        pinnate(ctx, wx, wy, pr.phi, q.Lr, q.L, q.cols[pr.i], { k: q.k, det, shape: 'ovate', teeth: true, droop: q.droop, stemC: q.stemC });
      }
    },
    jack(ctx, q, det) {
      ctx.lineCap = 'round';
      const leaf = (lf) => {
        ctx.strokeStyle = '#7C6A3E'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(lf.bx, 0); ctx.quadraticCurveTo(lf.bx, -lf.H * 0.6, lf.tx, -lf.H); ctx.stroke();
        const lfl = [0, 1, 2].map((i) => ({ phi: lf.phi0 + i * TAU / 3, i })).sort((a, b) => Math.sin(a.phi) - Math.sin(b.phi));
        for (const l of lfl) {
          const len = q.L * (l.i === 0 ? 1 : 0.9);
          leaflet(ctx, lf.tx, -lf.H, l.phi, len, len * 0.36, q.cols[(l.i + lf.c) % q.cols.length],
            { k: q.k, det, shape: 'ovate', edge: 'rgba(120,80,35,0.55)' });
        }
      };
      leaf(q.leaves[0]);
      // l'épi de baies rouges, sur sa propre tige
      ctx.strokeStyle = '#6E5E36'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q.cx, -q.Hc); ctx.stroke();
      if (det) ell(ctx, q.cx, -q.Hc + 1, 3.2, 2, 0, '#6A4A2A');
      for (const b of q.club) berry(ctx, q.cx + b.x, -q.Hc + b.y, b.r, b.c, 'rgba(255,215,190,0.6)');
      leaf(q.leaves[1]);
    },
    ivy(ctx, q, det) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5A3A26'; ctx.lineWidth = 2.2;
      for (const st of q.stems) {
        ctx.beginPath();
        st.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      for (const bc of q.berries) for (const b of bc.b) berry(ctx, bc.x + b.x, bc.y + b.y, b.r, b.c, 'rgba(255,255,250,0.75)');
      for (const lf of q.leaves) {
        const ca = Math.cos(lf.ang), sa = Math.sin(lf.ang);
        const ex = lf.x + ca * lf.pl, ey = lf.y + sa * lf.pl;
        const tx = ex + ca * lf.L * 0.2, ty = ey + sa * lf.L * 0.2;
        ctx.strokeStyle = '#7A3A22'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(lf.x, lf.y); ctx.lineTo(tx, ty); ctx.stroke();
        const o = { k: 1, det, shape: 'ovate', wr: 0.5, gloss: true };
        leaflet(ctx, ex, ey, lf.ang - 1.35, lf.L * 0.74, lf.L * 0.37, lf.cols[0], o);
        leaflet(ctx, ex, ey, lf.ang + 1.35, lf.L * 0.74, lf.L * 0.37, lf.cols[1], o);
        leaflet(ctx, tx, ty, lf.ang, lf.L, lf.L * 0.5, lf.cols[2], o);
      }
    },
    creeper(ctx, q, det) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const g of q.ground) palm(ctx, g.x, g.y, g.phi, q.L * 0.8, q.cols, { k: 0.45, det, teeth: true });
      ctx.strokeStyle = '#6E2C1A'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      q.vine.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      if (det) {
        // vrilles à ventouses, collées à l'écorce
        ctx.lineWidth = 0.6;
        for (let i = 1; i < q.vine.length; i += 2) {
          const [x, y] = q.vine[i], s = i % 4 === 1 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 4, y - 1, x + s * 6, y + 3); ctx.stroke();
          ell(ctx, x + s * 6, y + 3, 0.9, 0.9, 0, '#8E3A22');
        }
      }
      for (const bn of q.bunches) {
        const [vx, vy] = q.vine[bn.vi];
        const ex = vx + bn.side * 8, ey = vy + 5;
        ctx.strokeStyle = '#C0452A'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(ex, ey);
        for (const b of bn.b) { ctx.moveTo(ex, ey); ctx.lineTo(ex + b.x, ey + 3 + b.y); }
        ctx.stroke();
        for (const b of bn.b) berry(ctx, ex + b.x, ey + 3 + b.y, b.r, b.c, 'rgba(170,190,230,0.55)');
      }
      for (const lf of q.leaves) {
        const [vx, vy] = q.vine[lf.vi];
        const ex = vx + Math.cos(lf.ang) * lf.pl, ey = vy + Math.sin(lf.ang) * lf.pl;
        ctx.strokeStyle = '#8E2A18'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(ex, ey); ctx.stroke();
        palm(ctx, ex, ey, lf.ang, lf.L, lf.cols, { k: 1, det, teeth: true, wr: 0.34 });
      }
    },
  };
  // Cadres des plantes (unités) : [x0, y0, x1, y1] pour les images, zones à toucher.
  const BOUNDS = {
    ginseng: [-64, -100, 64, 14], sarsaparilla: [-64, -100, 64, 14], jack: [-64, -106, 64, 14],
    ivy: [-60, -82, 60, 14], creeper: [-62, -204, 62, 16],
  };
  const HIT = {
    ginseng: [-50, -94, 50, 10], sarsaparilla: [-50, -94, 50, 10], jack: [-50, -96, 50, 10],
    ivy: [-46, -72, 46, 10], creeper: [-46, -192, 46, 12],
  };
  // Gros plan : échelle et marge sous la base dans le cadre de la fiche.
  const ZOOM = {
    ginseng: { s: 3.7, by: 44 }, sarsaparilla: { s: 3.5, by: 44 }, jack: { s: 3.5, by: 40 },
    ivy: { s: 4.4, by: 56 }, creeper: { s: 2.15, by: 30 },
  };

  function makeSprite(type, q, s) {
    const B = BOUNDS[type];
    const w = (B[2] - B[0]) * s, h = (B[3] - B[1]) * s;
    const o = A.canvas(w, h, Math.min(G.dpr, 1.5));
    o.cx.translate(-B[0] * s, -B[1] * s);
    o.cx.scale(s, s);
    DRAW[type](o.cx, q, false);
    return { c: o.c, w, h, ox: -B[0] * s, oy: -B[1] * s };
  }

  // Tronc de tulipier (au premier plan, la vigne vierge y grimpe).
  function drawTrunk(ctx, x, base, w, seed, top) {
    const rnd = U.rng(seed + 99);
    ctx.save();
    ctx.fillStyle = '#463A31';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.78, base + 4);
    ctx.quadraticCurveTo(x - w * 0.5, base - w * 0.15, x - w * 0.46, base - w * 0.9);
    ctx.lineTo(x - w * 0.4, top);
    ctx.lineTo(x + w * 0.4, top);
    ctx.lineTo(x + w * 0.46, base - w * 0.9);
    ctx.quadraticCurveTo(x + w * 0.5, base - w * 0.15, x + w * 0.78, base + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(18,12,8,0.32)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, top); ctx.lineTo(x + w * 0.4, top); ctx.lineTo(x + w * 0.46, base - w * 0.9);
    ctx.quadraticCurveTo(x + w * 0.5, base - w * 0.15, x + w * 0.78, base + 4); ctx.lineTo(x + w * 0.18, base + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(26,18,12,0.5)';
    ctx.lineWidth = Math.max(1, w * 0.03);
    for (let i = 0; i < 6; i++) {
      const fx = x + (rnd() - 0.5) * w * 0.7;
      ctx.beginPath();
      ctx.moveTo(fx, base - 2);
      ctx.bezierCurveTo(fx + (rnd() - 0.5) * w * 0.12, base + (top - base) * 0.35, fx + (rnd() - 0.5) * w * 0.12, base + (top - base) * 0.7, fx, top);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,180,100,0.12)';
    ctx.fillRect(x - w * 0.4, top, w * 0.14, base - top - w * 0.6);
    ell(ctx, x - w * 0.3, base - 2, w * 0.4, w * 0.07, 0, 'rgba(94,122,58,0.55)');
    ctx.restore();
  }

  function drawMound(ctx, x, y, s, seed) {
    ell(ctx, x, y + 1, 30 * s, 8 * s, 0, 'rgba(20,12,6,0.4)');
    ell(ctx, x - 4 * s, y - 2 * s, 24 * s, 7 * s, 0, '#3E2A18');
    ell(ctx, x + 8 * s, y - 4 * s, 12 * s, 5 * s, 0.2, '#4E3622');
    ell(ctx, x - 2 * s, y - 1 * s, 9 * s, 3 * s, 0, '#1E130B');
    const rnd = U.rng(seed + 3);
    for (let i = 0; i < 9; i++) {
      ell(ctx, x + (rnd() - 0.5) * 50 * s, y - rnd() * 6 * s, (1.5 + rnd() * 2) * s, (1 + rnd()) * s, 0, rnd() < 0.5 ? '#5E4028' : '#4A3220');
    }
  }

  // ------------------------------------------------------------------ fougères
  function frond(cx, x, y, ang, len, col, w = 1.3) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const droop = len * 0.5 * Math.abs(dx);
    const pt = (t) => [x + dx * len * t, y + dy * len * t + droop * t * t];
    cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = w;
    cx.beginPath(); cx.moveTo(x, y);
    for (let t = 0.1; t <= 1.001; t += 0.1) { const [px, py] = pt(t); cx.lineTo(px, py); }
    cx.stroke();
    for (let t = 0.1; t < 0.97; t += 0.065) {
      const [px, py] = pt(t), [qx, qy] = pt(t + 0.02);
      const ta = Math.atan2(qy - py, qx - px);
      const pl = len * 0.17 * (1 - t * 0.8);
      for (const s of [-1, 1]) {
        const a = ta + s * 1.05;
        cx.beginPath();
        cx.ellipse(px + Math.cos(a) * pl * 0.5, py + Math.sin(a) * pl * 0.5, pl * 0.5, pl * 0.17, a, 0, TAU);
        cx.fill();
      }
    }
  }
  const FERN_PAL = [
    ['#56703A', '#4A622E', '#647E40'], ['#C9A24E', '#B38A3E', '#D4B15E'], ['#9A6A35', '#7E5530', '#A8783E'],
    ['#6B7A3A', '#B8963E', '#8A6A35'], ['#4E6634', '#5A7038', '#7A8A44'], ['#B07A3A', '#C9963E', '#8A5A2E'],
  ];
  function fernSprite(v) {
    return A.cached('gs-fern-' + v, 220, 120, (cx, w, h) => {
      const rnd = U.rng(500 + v * 17);
      const pal = FERN_PAL[v % FERN_PAL.length];
      const n = 5 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.5 + (rnd() - 0.5) * 0.3;
        frond(cx, w / 2 + (rnd() - 0.5) * 10, h - 6, ang, 58 + rnd() * 38, pal[i % pal.length]);
      }
    });
  }

  // ------------------------------------------------------------------ décors (en cache)
  const LITTER = ['#7A2E1A', '#9C4A22', '#B8732A', '#C98F3A', '#D9A441', '#6B4A2A', '#5C4A33', '#8A5A2E', '#A0602C'];

  function paintSky(cx, w, h) {
    A.sky(cx, w, h, [[0, '#E8C67E'], [0.32, '#D5A862'], [0.6, '#A8804E'], [1, '#5A3E26']]);
    const g = cx.createRadialGradient(240, 40, 10, 240, 40, 520);
    g.addColorStop(0, 'rgba(255,236,180,0.55)');
    g.addColorStop(1, 'rgba(255,236,180,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
  }
  function paintFar(cx, w, h, seed) {
    const rnd = U.rng(seed + 1);
    const pts = A.makeRidge(seed + 2, w, 372, 24, 160);
    A.ridge(cx, pts, '#A88C62', h);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * w, tw = 5 + rnd() * 10;
      const base = A.ridgeY(pts, x) + 10 + rnd() * 20;
      cx.fillStyle = rgba('#8E7A5E', 0.5 + rnd() * 0.35);
      cx.fillRect(x - tw / 2, 0, tw, base);
    }
    A.dots(cx, seed + 3, 300, 0, w, () => [-20, 150], ['#D2A75E', '#C08A4A', '#DDB872', '#B07A44', '#C9A060'], 10, 26, 0.35, 0.7);
  }
  function paintMid(cx, w, h, seed) {
    const rnd = U.rng(seed + 11);
    const pts = A.makeRidge(seed + 12, w, 410, 16, 180);
    A.ridge(cx, pts, '#76593A', h);
    A.dots(cx, seed + 13, 1000, 0, w, (x) => [A.ridgeY(pts, x) + 2, A.ridgeY(pts, x) + 60], ['#8A5A2E', '#9C6A34', '#7A4A26', '#B07A3A'], 2, 5, 0.4, 0.8);
    for (let i = 0; i < 22; i++) {
      const x = rnd() * w, tw = 12 + rnd() * 16, base = A.ridgeY(pts, x) + 6 + rnd() * 14;
      cx.fillStyle = pickR(rnd, ['#5C4838', '#544234', '#66523F', '#6E6A5E']);
      cx.beginPath();
      cx.moveTo(x - tw * 0.62, base); cx.lineTo(x - tw * 0.4, -10); cx.lineTo(x + tw * 0.4, -10); cx.lineTo(x + tw * 0.62, base);
      cx.fill();
      cx.fillStyle = 'rgba(20,12,6,0.25)';
      cx.fillRect(x + tw * 0.08, -10, tw * 0.32, base + 10);
    }
    A.dots(cx, seed + 14, 240, 0, w, () => [-30, 120], ['#C0602A', '#D08A3A', '#E0B050', '#A84A22', '#C98F3A'], 12, 30, 0.55, 0.9);
  }
  function bgTrunk(cx, x, base, tw, beech, rnd) {
    cx.fillStyle = beech ? '#77736A' : '#4E4238';
    cx.beginPath();
    cx.moveTo(x - tw * 0.8, base);
    cx.quadraticCurveTo(x - tw * 0.52, base - tw * 0.3, x - tw * 0.5, base - tw * 1.2);
    cx.lineTo(x - tw * 0.42, -10); cx.lineTo(x + tw * 0.42, -10);
    cx.lineTo(x + tw * 0.5, base - tw * 1.2);
    cx.quadraticCurveTo(x + tw * 0.52, base - tw * 0.3, x + tw * 0.8, base);
    cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(20,14,10,0.28)';
    cx.beginPath();
    cx.moveTo(x + tw * 0.12, -10); cx.lineTo(x + tw * 0.42, -10); cx.lineTo(x + tw * 0.5, base - tw * 1.2);
    cx.quadraticCurveTo(x + tw * 0.52, base - tw * 0.3, x + tw * 0.8, base); cx.lineTo(x + tw * 0.2, base);
    cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(240,200,120,0.12)';
    cx.fillRect(x - tw * 0.42, -10, tw * 0.16, base - tw);
    if (beech) {
      for (let i = 0; i < 7; i++) ell(cx, x + (rnd() - 0.5) * tw * 0.5, 30 + rnd() * (base - 100), tw * 0.12, 2.2, 0, 'rgba(40,36,30,0.45)');
    } else {
      cx.strokeStyle = 'rgba(28,20,14,0.45)'; cx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const fx = x + (rnd() - 0.5) * tw * 0.6;
        cx.beginPath(); cx.moveTo(fx, base - 6); cx.lineTo(fx + (rnd() - 0.5) * 6, -10); cx.stroke();
      }
    }
    ell(cx, x - tw * 0.2, base - 5, tw * 0.5, 5, 0, 'rgba(94,122,58,0.45)');
  }
  function rock(cx, x, y, r) {
    ell(cx, x + r * 0.15, y + r * 0.22, r * 1.15, r * 0.32, 0, 'rgba(20,12,6,0.35)');
    cx.fillStyle = '#6A665C';
    cx.beginPath();
    cx.moveTo(x - r, y + r * 0.2);
    cx.quadraticCurveTo(x - r * 0.9, y - r * 0.7, x - r * 0.1, y - r * 0.75);
    cx.quadraticCurveTo(x + r * 0.9, y - r * 0.7, x + r, y + r * 0.2);
    cx.closePath(); cx.fill();
    ell(cx, x - r * 0.25, y - r * 0.42, r * 0.45, r * 0.16, -0.2, 'rgba(170,160,140,0.35)');
    ell(cx, x + r * 0.22, y - r * 0.55, r * 0.5, r * 0.15, 0.1, 'rgba(94,122,58,0.75)');
  }
  function paintGround(cx, w, h, seed, plants) {
    const rnd = U.rng(seed + 21);
    const g = cx.createLinearGradient(0, 400, 0, h);
    g.addColorStop(0, '#6E4E2C'); g.addColorStop(0.5, '#5A3E24'); g.addColorStop(1, '#3E2A18');
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) cx.lineTo(x, groundTop(x));
    cx.lineTo(w, h);
    cx.closePath();
    cx.fill();
    for (let x = 120 + rnd() * 120; x < w; x += 250 + rnd() * 210) bgTrunk(cx, x, groundTop(x) + 6, 30 + rnd() * 30, rnd() < 0.4, rnd);
    // le sentier, à flanc
    cx.lineCap = 'round';
    cx.strokeStyle = 'rgba(150,112,66,0.3)'; cx.lineWidth = 12;
    cx.beginPath();
    for (let x = 0; x <= w; x += 16) (x ? cx.lineTo(x, groundTop(x) + 13) : cx.moveTo(x, groundTop(x) + 13));
    cx.stroke();
    // litière : feuilles mortes, plus grandes vers nous
    for (let i = 0; i < 7000; i++) {
      const x = rnd() * w, gt = groundTop(x);
      const y = gt + 2 + Math.pow(rnd(), 0.85) * (h - gt);
      const k = U.clamp((y - 440) / 280, 0, 1);
      cx.globalAlpha = 0.45 + rnd() * 0.5;
      ell(cx, x, y, (1.6 + rnd() * 3.4) * (0.7 + k), (0.8 + rnd() * 1.5) * (0.7 + k * 0.6), rnd() * Math.PI, pickR(rnd, LITTER));
    }
    cx.globalAlpha = 1;
    // taches de soleil
    for (let i = 0; i < 40; i++) {
      const x = rnd() * w, gt = groundTop(x), y = gt + 20 + rnd() * (h - gt - 40), rx = 30 + rnd() * 60;
      cx.save();
      cx.translate(x, y); cx.scale(1, 0.2);
      const sg = cx.createRadialGradient(0, 0, 0, 0, 0, rx);
      sg.addColorStop(0, 'rgba(255,214,140,0.16)'); sg.addColorStop(1, 'rgba(255,214,140,0)');
      cx.fillStyle = sg;
      cx.fillRect(-rx, -rx, rx * 2, rx * 2);
      cx.restore();
    }
    // rochers, entre les plantes
    const gaps = [];
    for (let i = 0; i < plants.length - 1; i++) gaps.push((plants[i].x + plants[i + 1].x) / 2);
    shuffle(gaps, rnd);
    for (let i = 0; i < 5 && i < gaps.length; i++) rock(cx, gaps[i] + (rnd() - 0.5) * 40, 520 + rnd() * 120, 12 + rnd() * 14);
    // petites fougères au bord du sentier
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = groundTop(x) + 26 + rnd() * 30, s = 0.42 + rnd() * 0.2;
      const sp = fernSprite(Math.floor(rnd() * 6));
      cx.drawImage(sp.c, x - 110 * s, y - 114 * s, 220 * s, 120 * s);
    }
    A.texture(cx, w, h, 0.16);
  }
  function paintFore(cx, w, h, seed) {
    const rnd = U.rng(seed + 31);
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(20,14,9,0)'); g.addColorStop(0.7, 'rgba(20,14,9,0.3)'); g.addColorStop(1, 'rgba(20,14,9,0.72)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      frond(cx, rnd() * w, h + 6, -Math.PI / 2 + (rnd() - 0.5) * 2.3, 40 + rnd() * 52,
        pickR(rnd, ['#22180F', '#2C2015', '#33261A', '#3A2A1A']), 2);
    }
    for (let i = 0; i < 160; i++) {
      ell(cx, rnd() * w, h - rnd() * 26, 3 + rnd() * 5, 1.5 + rnd() * 2, rnd() * Math.PI, pickR(rnd, ['#5A2A16', '#6E3A1C', '#7A4A22', '#4A2E1A']));
    }
  }
  // Fond du gros plan : la litière vue de près.
  function paintCardBg(cx, w, h) {
    const rnd = U.rng(4242);
    cx.fillStyle = '#3A2A1C';
    cx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * h, l = 18 + rnd() * 34, a = rnd() * TAU;
      cx.globalAlpha = 0.35 + rnd() * 0.35;
      leaflet(cx, x, y, a, l, l * 0.38, pickR(rnd, ['#6E4426', '#7E5230', '#5E3A20', '#8A5A2E', '#9C6A34', '#4E3420']), { k: 1, shape: 'ovate' });
    }
    cx.globalAlpha = 1;
    cx.strokeStyle = 'rgba(30,20,12,0.7)'; cx.lineWidth = 2.5; cx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w, y = rnd() * h, a = rnd() * TAU, l = 40 + rnd() * 80;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); cx.stroke();
    }
    const g = cx.createRadialGradient(w / 2, h * 0.55, h * 0.2, w / 2, h * 0.55, h * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,5,3,0.6)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
    A.texture(cx, w, h, 0.2);
  }

  // ------------------------------------------------------------------ phase 2 : la racine
  const cap = (x1, y1, x2, y2, r1, r2, kind, part) => ({ x1, y1, x2, y2, r1, r2, kind, part });
  // Racine fourchue « en petit bonhomme » : collet, corps, bras, jambes, radicelles.
  function makeRoot(rnd, cx) {
    const caps = [], rootlets = [];
    const top = SY + 4;
    const n2 = { x: cx + (rnd() - 0.5) * 8, y: top + 30 + rnd() * 14 };
    caps.push(cap(cx, top, n2.x, n2.y, 4.5, 6.5, 'neck', 'top'));
    const lean = (rnd() - 0.5) * 0.35;
    const bodyL = 92 + rnd() * 30;
    const b2 = { x: n2.x + Math.sin(lean) * bodyL, y: n2.y + Math.cos(lean) * bodyL };
    const bm = { x: (n2.x + b2.x) / 2 + (rnd() - 0.5) * 10, y: (n2.y + b2.y) / 2 };
    const fat = 14 + rnd() * 4;
    caps.push(cap(n2.x, n2.y, bm.x, bm.y, 8, fat, 'body', 'top'));
    caps.push(cap(bm.x, bm.y, b2.x, b2.y, fat, fat * 0.8, 'body', 'top'));
    for (const side of [-1, 1]) {
      if (rnd() < 0.2) continue;
      const t = 0.22 + rnd() * 0.2;
      const ax = U.lerp(n2.x, b2.x, t), ay = U.lerp(n2.y, b2.y, t);
      const a = side * (0.95 + rnd() * 0.45) + lean;
      const L = 44 + rnd() * 28;
      const e1 = { x: ax + Math.sin(a) * L * 0.6, y: ay + Math.cos(a) * L * 0.6 };
      const a2 = a - side * 0.4;
      const e2 = { x: e1.x + Math.sin(a2) * L * 0.4, y: e1.y + Math.cos(a2) * L * 0.4 };
      caps.push(cap(ax, ay, e1.x, e1.y, 6.5, 4.5, 'arm', 'top'));
      caps.push(cap(e1.x, e1.y, e2.x, e2.y, 4.5, 2, 'arm', 'top'));
    }
    for (const side of [-1, 1]) {
      const a = lean + side * (0.22 + rnd() * 0.22);
      const L = 86 + rnd() * 42;
      const s0 = { x: b2.x + side * fat * 0.35, y: b2.y - 6 };
      const k1 = { x: s0.x + Math.sin(a) * L * 0.55, y: s0.y + Math.cos(a) * L * 0.55 };
      const a2 = a + (rnd() - 0.5) * 0.5;
      const k2 = { x: k1.x + Math.sin(a2) * L * 0.45, y: k1.y + Math.cos(a2) * L * 0.45 };
      caps.push(cap(s0.x, s0.y, k1.x, k1.y, fat * 0.62, fat * 0.42, 'leg', 'bottom'));
      caps.push(cap(k1.x, k1.y, k2.x, k2.y, fat * 0.42, 2.2, 'leg', 'bottom'));
    }
    const hosts = caps.filter((c) => c.kind !== 'neck');
    const N = 12 + Math.floor(rnd() * 5);
    for (let i = 0; i < N; i++) {
      const c = hosts[Math.floor(rnd() * hosts.length)];
      const t = 0.25 + rnd() * 0.75;
      const x = U.lerp(c.x1, c.x2, t), y = U.lerp(c.y1, c.y2, t), r = U.lerp(c.r1, c.r2, t);
      const side = rnd() < 0.5 ? -1 : 1;
      let ang = Math.atan2(c.y2 - c.y1, c.x2 - c.x1) + side * (0.7 + rnd() * 0.7);
      const L = 30 + rnd() * 50, seg = 6;
      let px = x + Math.cos(ang) * r * 0.8, py = y + Math.sin(ang) * r * 0.8;
      const pts = [[px, py]];
      for (let k = 0; k < seg; k++) {
        ang += (rnd() - 0.5) * 0.6;
        ang += (Math.PI / 2 - ang) * 0.1;
        px = U.clamp(px + Math.cos(ang) * L / seg, 16, G.W - 16);
        py = U.clamp(py + Math.sin(ang) * L / seg, SY + 14, G.H - 90);
        pts.push([px, py]);
      }
      rootlets.push({ pts, w: 1.1 + rnd() * 0.6, part: c.part, broken: -1 });
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of caps) {
      x0 = Math.min(x0, c.x1 - c.r1, c.x2 - c.r2); x1 = Math.max(x1, c.x1 + c.r1, c.x2 + c.r2);
      y0 = Math.min(y0, c.y1 - c.r1, c.y2 - c.r2); y1 = Math.max(y1, c.y1 + c.r1, c.y2 + c.r2);
    }
    for (const rl of rootlets) for (const [x, y] of rl.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { cx, caps, rootlets, bb: { x0, y0, x1, y1 }, brk: { x: b2.x, y: b2.y - 2, r: fat * 0.8, ang: lean } };
  }
  function capPath(ctx, c, grow, dx, dy) {
    const ux = c.x2 - c.x1, uy = c.y2 - c.y1, l = Math.hypot(ux, uy) || 1;
    const nx = -uy / l, ny = ux / l, ang = Math.atan2(uy, ux);
    const r1 = c.r1 + grow, r2 = c.r2 + grow;
    const x1 = c.x1 + dx, y1 = c.y1 + dy, x2 = c.x2 + dx, y2 = c.y2 + dy;
    ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.arc(x2, y2, r2, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
    ctx.arc(x1, y1, r1, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
  }
  // part : 'all', 'top' (collet, corps, bras) ou 'bottom' (jambes).
  function drawRoot(ctx, R, marks, part, ox, oy, broken) {
    const has = (o) => part === 'all' || o.part === part;
    const caps = R.caps.filter(has);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const rl of R.rootlets) {
      if (!has(rl)) continue;
      const n = rl.broken >= 0 ? rl.broken + 1 : rl.pts.length - 1;
      ctx.strokeStyle = '#CDB68A'; ctx.lineWidth = rl.w;
      ctx.beginPath(); ctx.moveTo(rl.pts[0][0], rl.pts[0][1]);
      for (let k = 1; k <= n; k++) {
        let [x, y] = rl.pts[k];
        if (rl.broken >= 0 && k === n) { const [px, py] = rl.pts[k - 1]; x = px + (x - px) * 0.45; y = py + (y - py) * 0.45; }
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath(); for (const c of caps) capPath(ctx, c, 0.6, 2.2, 2.2);
    ctx.fillStyle = '#8A7050'; ctx.fill();
    ctx.beginPath(); for (const c of caps) capPath(ctx, c, 0, 0, 0);
    ctx.fillStyle = '#E2CFA4'; ctx.fill();
    ctx.save();
    ctx.clip();
    for (const c of caps) {
      const ux = c.x2 - c.x1, uy = c.y2 - c.y1, l = Math.hypot(ux, uy) || 1;
      const nx = -uy / l, ny = ux / l;
      const rm = (c.r1 + c.r2) / 2;
      ctx.strokeStyle = 'rgba(120,92,58,0.45)'; ctx.lineWidth = rm * 0.7;
      ctx.beginPath(); ctx.moveTo(c.x1 + nx * rm * 0.75, c.y1 + ny * rm * 0.75); ctx.lineTo(c.x2 + nx * c.r2 * 0.75, c.y2 + ny * c.r2 * 0.75); ctx.stroke();
      ctx.strokeStyle = 'rgba(250,240,214,0.55)'; ctx.lineWidth = rm * 0.35;
      ctx.beginPath(); ctx.moveTo(c.x1 - nx * rm * 0.45, c.y1 - ny * rm * 0.45); ctx.lineTo(c.x2 - nx * c.r2 * 0.45, c.y2 - ny * c.r2 * 0.45); ctx.stroke();
      // rides annulaires, cicatrices du collet
      const neck = c.kind === 'neck';
      ctx.strokeStyle = neck ? 'rgba(104,78,46,0.85)' : 'rgba(128,98,60,0.42)';
      const wr = U.rng(Math.round(c.x1 * 13 + c.y1 * 7));
      for (let s = 3 + wr() * 3; s < l - 1; s += neck ? 4.5 + wr() * 2 : 5 + wr() * 7) {
        const px = c.x1 + ux / l * s, py = c.y1 + uy / l * s, r = U.lerp(c.r1, c.r2, s / l);
        const a = 0.35 + wr() * 0.6, b = 0.4 + wr() * 0.6;
        ctx.lineWidth = neck ? 1.1 : 0.7 + wr() * 0.6;
        ctx.beginPath();
        ctx.moveTo(px + nx * r * a, py + ny * r * a);
        ctx.quadraticCurveTo(px + ux / l * r * 0.35, py + uy / l * r * 0.35, px - nx * r * b, py - ny * r * b);
        ctx.stroke();
      }
    }
    for (const m of marks) {
      if (!has(m)) continue;
      if (m.k === 'gash') {
        ell(ctx, m.x, m.y, 7, 2.8, m.a, '#3E2414');
        ell(ctx, m.x - 1, m.y - 0.6, 4, 1, m.a, '#6A4426');
      } else ell(ctx, m.x, m.y, 4.5, 2.2, m.a, 'rgba(150,112,70,0.7)');
    }
    if (broken) {
      const b = R.brk, ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      ctx.strokeStyle = '#8A6E48'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const x = b.x + ca * i * b.r / 3.2, y = b.y - sa * i * b.r / 3.2 + (i % 2 ? 3 : -2);
        i === -3 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
  function paintDirt(cx, w, h, rnd) {
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2E1F13'); g.addColorStop(0.08, '#3C2918'); g.addColorStop(0.35, '#4A3220');
    g.addColorStop(0.75, '#553A24'); g.addColorStop(1, '#5E4128');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
    for (let b = 0; b < 7; b++) {
      const y0 = 30 + b * 70 + rnd() * 30, th = 8 + rnd() * 22;
      cx.fillStyle = rnd() < 0.5 ? 'rgba(120,84,50,0.16)' : 'rgba(20,12,6,0.16)';
      cx.beginPath();
      cx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 40) cx.lineTo(x, y0 + Math.sin(x / 140 + b) * 8);
      for (let x = w; x >= 0; x -= 40) cx.lineTo(x, y0 + th + Math.sin(x / 120 + b * 2) * 6);
      cx.closePath(); cx.fill();
    }
    for (let i = 0; i < 9000; i++) {
      cx.fillStyle = rnd() < 0.5 ? 'rgba(18,10,5,0.5)' : 'rgba(130,98,64,0.35)';
      const s = 1 + rnd() * 1.6;
      cx.fillRect(rnd() * w, rnd() * h, s, s);
    }
    for (let i = 0; i < 420; i++) {
      ell(cx, rnd() * w, rnd() * h, 2 + rnd() * 4, 1.5 + rnd() * 3, rnd() * Math.PI, rnd() < 0.5 ? 'rgba(90,62,38,0.6)' : 'rgba(36,24,14,0.5)');
    }
    cx.strokeStyle = 'rgba(34,22,14,0.8)'; cx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = rnd() * w, y = 0, a = Math.PI / 2 + (rnd() - 0.5) * 0.8;
      cx.lineWidth = 1 + rnd() * 2;
      cx.beginPath(); cx.moveTo(x, y);
      const n = 6 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 22; y += Math.sin(a) * 22; cx.lineTo(x, y); }
      cx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = 20 + rnd() * (h - 20), r = 2.5 + rnd() * (rnd() < 0.15 ? 12 : 5);
      ell(cx, x + 1, y + 1.5, r, r * 0.72, 0, 'rgba(14,8,4,0.6)');
      ell(cx, x, y, r, r * 0.72, rnd(), pickR(rnd, ['#7E7466', '#6A6256', '#8C8170', '#5C544A', '#776A58']));
      ell(cx, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.22, 0, 'rgba(220,210,190,0.25)');
    }
    for (let i = 0; i < 260; i++) {
      ell(cx, rnd() * w, rnd() * 18, 1.5 + rnd() * 3, 1 + rnd(), rnd() * Math.PI, pickR(rnd, ['#7A2E1A', '#9C4A22', '#B8732A', '#5A3A20']));
    }
    A.texture(cx, w, h, 0.25);
  }
  const brushes = {};
  function brush(r) {
    if (brushes[r]) return brushes[r];
    const o = A.canvas(r * 2, r * 2, 1);
    const g = o.cx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.68, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.cx.fillStyle = g;
    o.cx.fillRect(0, 0, r * 2, r * 2);
    brushes[r] = o;
    return o;
  }

  // ------------------------------------------------------------------ interface : rectangles
  const CARD = {
    panel: { x: 140, y: 58, w: 1000, h: 528 },
    frame: { x: 164, y: 82, w: 540, h: 480 },
    col: 736,
    dig: { x: 736, y: 456, w: 178, h: 58 },
    leave: { x: 928, y: 456, w: 178, h: 58 },
  };
  const EDGE_L = { x: 10, y: 300, w: 54, h: 130 };
  const EDGE_R = { x: G.W - 64, y: 300, w: 54, h: 130 };
  const DIGUI = {
    stick: { x: 24, y: 650, w: 150, h: 52 },
    fingers: { x: 186, y: 650, w: 150, h: 52 },
    pull: { x: 1016, y: 646, w: 240, h: 58 },
  };
  const RES = { panel: { x: 330, y: 88, w: 620, h: 404 }, cont: { x: 696, y: 412, w: 226, h: 54 } };

  // Ne copie que la tranche visible d'un grand décor en cache (x0 : décalage dans le décor).
  function blitSlice(ctx, o, x0, y) {
    const k = o.c.width / o.w;
    const sx = U.clamp(x0, 0, o.w - G.W);
    ctx.drawImage(o.c, sx * k, 0, G.W * k, o.c.height, 0, y, G.W, o.h);
  }
  function panelBox(ctx, r, a = 0.82) {
    ctx.fillStyle = `rgba(20,16,13,${a})`;
    rrect(ctx, r, 10);
    ctx.fill();
  }
  // Petite racine dessinée (compteur).
  function rootIcon(ctx, x, y, full) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = full ? '#E2CFA4' : 'rgba(232,223,204,0.32)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -6); ctx.stroke();
    ctx.lineWidth = full ? 7 : 2;
    if (full) { ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.stroke(); } else { ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, TAU); ctx.stroke(); }
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-6, 13); ctx.moveTo(2, 5); ctx.lineTo(6, 13); ctx.moveTo(-3, -2); ctx.lineTo(-8, 2); ctx.moveTo(3, -2); ctx.lineTo(8, 1); ctx.stroke();
    ctx.restore();
  }

  // ================================================================== la scène
  G.Scenes.ginseng = (opts = {}) => G.makeScene({
    enter() {
      this.seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e6);
      this.dur = opts.time || 180;
      this.mode = 'search';
      this.busyN = 0;
      this.light = 1;
      this.cam = 0; this.camV = 0; this.camGoal = null;
      this.sel = null; this.card = null; this.drag = null; this.edge = 0; this.kbd = false;
      this.roots = [];
      this.mistakes = { creeper: 0, sarsaparilla: 0, ivy: 0, jack: 0 };
      this.itchy = false;
      this.fx = []; this.caption = null; this.capCd = 22; this.flags = {};
      this.idle = 0; this.hintSeen = false; this.decoy = null; this.xf = null; this.dig = null;
      this.genWorld(this.seed);
      this.goal = U.clamp(opts.goal || 3, 1, this.plants.filter((p) => p.type === 'ginseng').length);
      this.granny = { x: 1010, dir: -1, moving: false, phase: 0, crouch: 0, idle: 6, target: null };
      this.gHead = null;
      G.audio.amb(['wind', 'birds']);
      if (opts.intro !== false) this.act(async () => { await G.wait(0.6); await G.say('hattie', LINES.intro); });
    },
    exit() {
      A.clearCache('gs-');
      for (const p of this.plants || []) p.spr = null;
    },

    // ---------------------------------------------------------------- outils
    async act(fn) {
      this.busyN++;
      try { await fn(); } finally { this.busyN--; }
    },
    paused() { return G.blocked || this.busyN > 0 || !!this.xf || !!this._done || !!this.ending; },
    say2(text, life) { this.caption = { text, t: 0, life: life || Math.max(3.5, text.length / 14) }; },
    fadeSwap(mid) { return new Promise((res) => { this.xf = { t: 0, dur: 0.8, mid, res, fired: false }; }); },
    crumb(x, y, world, up) {
      if (this.fx.length > 280) return;
      this.fx.push({
        x, y, vx: U.rand(-90, 90), vy: U.rand(up ? -220 : -120, up ? -80 : -30), t: 0, life: U.rand(0.35, 0.75),
        r: U.rand(1.2, 3), c: U.pick(['#4A3220', '#5E4028', '#3A2616', '#6A4A2E']), world,
      });
    },
    result() {
      return { roots: this.roots.map((r) => ({ quality: r.quality })), mistakes: Object.assign({}, this.mistakes), itchy: this.itchy };
    },
    async end(reason) {
      if (this.ending) return;
      this.ending = true;
      this.card = null;
      this.busyN++;
      if (opts.outro !== false) await G.say('hattie', reason === 'dusk' ? LINES.dusk : LINES.done);
      this.finish(this.result());
    },

    // ---------------------------------------------------------------- le monde
    genWorld(seed) {
      const rnd = U.rng(seed * 7 + 13);
      let types = TYPES.slice();
      for (let tries = 0; tries < 80; tries++) {
        shuffle(types, rnd);
        const first = types.slice(0, 4);
        const g = first.filter((t) => t === 'ginseng').length;
        let ok = g >= 1 && g <= 2 && first.some((t) => t === 'jack' || t === 'sarsaparilla');
        for (let i = 1; i < types.length; i++) if (types[i] === types[i - 1] && types[i] !== 'ginseng') ok = false;
        if (ok) break;
      }
      const n = types.length, x0 = 250, x1 = WW - 230, step = (x1 - x0) / (n - 1);
      this.plants = types.map((type, i) => {
        const x = x0 + i * step + (rnd() - 0.5) * step * 0.4;
        const y = 548 + rnd() * 110;
        const s = U.lerp(1.15, 1.5, (y - 540) / 125);
        const pseed = Math.floor(rnd() * 1e6);
        return { kind: 'plant', id: i, type, x, y, s, seed: pseed, q: makeParams(type, U.rng(pseed)), dug: false };
      });
      this.ferns = [];
      for (const p of this.plants) {
        if (p.type === 'creeper' || rnd() < 0.4) continue;
        const side = rnd() < 0.5 ? -1 : 1;
        this.ferns.push({ kind: 'fern', x: p.x + side * (38 + rnd() * 22) * p.s, y: p.y + 6 + rnd() * 10, s: p.s * (0.62 + rnd() * 0.25), v: Math.floor(rnd() * 6) });
      }
      for (let i = 0; i < 60 && this.ferns.length < 46; i++) {
        const x = rnd() * WW, y = 506 + rnd() * 170;
        if (this.plants.some((p) => Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 60)) continue;
        this.ferns.push({ kind: 'fern', x, y, s: U.lerp(0.55, 1.05, (y - 506) / 170), v: Math.floor(rnd() * 6) });
      }
      this.items = [...this.plants, ...this.ferns].sort((a, b) => a.y - b.y);
    },
    layers() {
      if (this.L && this.L.seed === this.seed) return this.L;
      const s = this.seed, res = Math.min(G.dpr, 1.25);
      const farW = Math.ceil(G.W + (WW - G.W) * PF), midW = Math.ceil(G.W + (WW - G.W) * PM), foreW = Math.ceil(G.W + (WW - G.W) * PFG);
      this.L = {
        seed: s,
        sky: A.cached('gs-sky', G.W, G.H, paintSky, 1),
        far: A.cached('gs-far-' + s, farW, G.H, (cx, w, h) => paintFar(cx, w, h, s), 1),
        mid: A.cached('gs-mid-' + s, midW, G.H, (cx, w, h) => paintMid(cx, w, h, s), 1),
        ground: A.cached('gs-ground-' + s, WW, G.H, (cx, w, h) => paintGround(cx, w, h, s, this.plants), res),
        fore: A.cached('gs-fore-' + s, foreW, FORE_H, (cx, w, h) => paintFore(cx, w, h, s), res),
      };
      return this.L;
    },
    sprite(p) {
      if (!p.spr) p.spr = makeSprite(p.type, p.q, p.s);
      return p.spr;
    },
    plantBox(p) {
      const B = HIT[p.type];
      return { x: p.x + B[0] * p.s - 8, y: p.y + B[1] * p.s - 8, w: (B[2] - B[0]) * p.s + 16, h: (B[3] - B[1]) * p.s + 16 };
    },
    hitPlant(sx, sy) {
      const wx = sx + this.cam;
      let best = null, bd = 1e9;
      for (const p of this.plants) {
        if (p.dug) continue;
        const b = this.plantBox(p);
        if (wx < b.x || wx > b.x + b.w || sy < b.y || sy > b.y + b.h) continue;
        const cy = p.type === 'creeper' ? U.clamp(sy, b.y + 20, p.y - 10) : p.y - 45 * p.s;
        const d = Math.hypot(wx - p.x, (sy - cy) * 0.7) - p.y * 0.01;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    maxCam() { return WW - G.W; },

    // ---------------------------------------------------------------- mise à jour
    update(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.t += dt; f.vy += 520 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.t > f.life) this.fx.splice(i, 1);
      }
      if (this.decoy) this.decoy.t += dt;
      if (this.xf) {
        const x = this.xf;
        x.t += dt;
        if (!x.fired && x.t >= x.dur / 2) { x.fired = true; x.mid(); }
        if (x.t >= x.dur) { this.xf = null; x.res(); }
      }
      if (this.caption) { this.caption.t += dt; if (this.caption.t > this.caption.life) this.caption = null; }
      if (this.mode === 'dig' && this.dig) this.updateDig(dt);
      else this.updateSearch(dt);
    },

    // -------- phase 1 : chercher
    updateSearch(dt) {
      this.updateGranny(dt);
      const paused = this.paused();
      if (paused) { this.drag = null; this.edge = 0; }
      else {
        this.idle += dt;
        if (this.card) this.updateCard(dt);
        else this.updateBrowse(dt);
        this.light = Math.max(0, this.light - dt / this.dur);
        if (!this.flags.dim && this.light < 0.4) { this.flags.dim = true; this.say2('Le jour baisse, mon garçon.'); }
        if (!this.flags.night && this.light < 0.22) { this.flags.night = true; G.audio.amb(['wind', 'night']); }
        if (!this.flags.last && this.light < 0.12) { this.flags.last = true; this.say2('Encore un peu, et on rentre.'); }
        this.capCd -= dt;
        if (this.capCd <= 0 && !this.caption && !this.card) { this.capCd = 30 + Math.random() * 16; this.say2(U.pick(AMBIENT)); }
        if (this.light <= 0) this.end('dusk');
      }
      // caméra
      const mc = this.maxCam();
      if (!this.drag || !this.drag.moved) {
        if (this.edge) { this.cam += this.edge * 760 * dt; this.camGoal = null; this.camV = 0; }
        else if (this.camGoal != null) {
          this.cam = U.lerp(this.cam, this.camGoal, 1 - Math.pow(0.004, dt));
          if (Math.abs(this.cam - this.camGoal) < 0.5) this.camGoal = null;
        } else if (Math.abs(this.camV) > 5) { this.cam += this.camV * dt; this.camV *= Math.pow(0.03, dt); } else this.camV = 0;
      }
      if (this.cam <= 0 || this.cam >= mc) this.camV = 0;
      this.cam = U.clamp(this.cam, 0, mc);
    },
    updateGranny(dt) {
      const g = this.granny, cam = this.cam;
      if (Math.abs(g.x - (cam + G.W / 2)) > G.W * 1.1) g.x = g.x < cam ? cam - 60 : cam + G.W + 60;
      if (g.x < cam + 140) g.target = cam + 320;
      else if (g.x > cam + G.W - 140) g.target = cam + G.W - 320;
      if (g.target != null) {
        const dx = g.target - g.x;
        if (Math.abs(dx) < 4) { g.target = null; g.moving = false; }
        else {
          g.moving = true; g.dir = Math.sign(dx);
          const seen = g.x > cam - 30 && g.x < cam + G.W + 30;
          const st = Math.sign(dx) * Math.min(Math.abs(dx), (seen ? 130 : 700) * dt);
          g.x += st;
          g.phase = (g.phase + Math.abs(st) / 110) % 1;
        }
      } else g.moving = false;
      if (g.moving) g.crouch = 0;
      else {
        g.idle -= dt;
        if (g.crouch > 0) g.crouch -= dt;
        else if (g.idle <= 0) {
          g.idle = 8 + Math.random() * 8;
          if (Math.random() < 0.5) g.crouch = 2.6; else g.dir = -g.dir;
        }
      }
      g.x = U.clamp(g.x, 60, WW - 60);
    },
    edgeAt(x, y) {
      if (U.inRect({ x, y }, EDGE_L) && this.cam > 1) return -1;
      if (U.inRect({ x, y }, EDGE_R) && this.cam < this.maxCam() - 1) return 1;
      return 0;
    },
    select(p) {
      this.sel = p;
      const sx = p.x - this.cam;
      if (sx < 220 || sx > G.W - 220) this.camGoal = U.clamp(p.x - G.W / 2, 0, this.maxCam());
      G.audio.sfx('tick');
    },
    moveSel(dx, dy) {
      const list = this.plants.filter((p) => !p.dug);
      if (!list.length) return;
      const cur = this.sel && !this.sel.dug ? this.sel : null;
      if (!cur || (!dx && !dy)) {
        const cx = this.cam + G.W / 2;
        let best = null, bd = 1e9;
        for (const p of list) { const d = Math.abs(p.x - cx) + Math.abs(p.y - 600) * 0.5; if (d < bd) { bd = d; best = p; } }
        if (best) this.select(best);
        return;
      }
      let best = null, bs = 1e9;
      for (const q of list) {
        if (q === cur) continue;
        const vx = q.x - cur.x, vy = (q.y - cur.y) * 2.5;
        const along = vx * dx + vy * dy;
        if (along <= 4) continue;
        const sc = along + Math.abs(dx ? vy : vx) * 1.5;
        if (sc < bs) { bs = sc; best = q; }
      }
      if (best) this.select(best);
      else if (dx) this.camGoal = U.clamp(this.cam + dx * 320, 0, this.maxCam());
    },
    updateBrowse(dt) {
      const K = [['ArrowLeft', -1, 0], ['KeyA', -1, 0], ['KeyQ', -1, 0], ['ArrowRight', 1, 0], ['KeyD', 1, 0],
        ['ArrowUp', 0, -1], ['KeyW', 0, -1], ['KeyZ', 0, -1], ['ArrowDown', 0, 1], ['KeyS', 0, 1]];
      for (const [code, dx, dy] of K) if (I.hit(code)) { this.kbd = true; this.idle = 0; this.moveSel(dx, dy); }
      if (I.hit('Space') || I.hit('Enter') || I.hit('KeyE')) {
        this.kbd = true; this.idle = 0;
        if (this.sel && !this.sel.dug) { this.camGoal = U.clamp(this.sel.x - G.W / 2, 0, this.maxCam()); this.openCard(this.sel); } else this.moveSel(0, 0);
      }
      if (I.pressed) {
        this.kbd = false; this.idle = 0;
        const e = this.edgeAt(I.x, I.y);
        if (e) this.edge = e;
        else this.drag = { x0: I.x, cam0: this.cam, moved: false, lx: I.x, v: 0 };
        this.camGoal = null; this.camV = 0;
      }
      if (this.drag && I.down) {
        const dx = I.x - this.drag.x0;
        if (!this.drag.moved && Math.abs(dx) > 12) this.drag.moved = true;
        if (this.drag.moved) {
          this.cam = U.clamp(this.drag.cam0 - dx, 0, this.maxCam());
          this.drag.v = U.lerp(this.drag.v, -(I.x - this.drag.lx) / Math.max(dt, 1e-3), 0.5);
        }
        this.drag.lx = I.x;
      }
      if (I.released || (!I.down && (this.drag || this.edge))) {
        if (this.drag && !this.drag.moved) {
          const p = this.hitPlant(I.x, I.y);
          if (p) this.openCard(p);
        } else if (this.drag && this.drag.moved) this.camV = U.clamp(this.drag.v, -2400, 2400);
        this.drag = null; this.edge = 0;
      }
    },
    openCard(p) {
      this.card = { p, t: 0, focus: 0 };
      this.sel = p;
      this.hintSeen = true;
      G.audio.sfx('page');
    },
    updateCard(dt) {
      const c = this.card;
      c.t += dt;
      if (c.t < 0.22) return;
      let act = -1;
      if (I.pressed) {
        this.kbd = false;
        if (U.inRect(I, CARD.dig)) act = 0;
        else if (U.inRect(I, CARD.leave)) act = 1;
        else if (!U.inRect(I, CARD.panel)) act = 1;
      }
      for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyQ', 'KeyW', 'KeyS', 'KeyZ']) {
        if (I.hit(k)) { c.focus = 1 - c.focus; this.kbd = true; G.audio.sfx('tick'); break; }
      }
      if (I.hit('Space') || I.hit('Enter') || I.hit('KeyE')) { this.kbd = true; act = c.focus; }
      if (I.hit('KeyC')) act = 0;
      if (I.hit('KeyL') || I.hit('Escape') || I.hit('Backspace')) act = 1;
      if (act < 0) return;
      I.consume();
      G.audio.sfx('click');
      this.idle = 0;
      if (act === 1) this.leavePlant(c.p);
      else if (c.p.type === 'ginseng') this.startDig(c.p);
      else this.digDecoy(c.p);
    },
    leavePlant(p) {
      this.card = null;
      if (p.type === 'ginseng') {
        if (!p.leftOnce) { p.leftOnce = true; this.say2('Hm. Tu laisses passer du bon, là.'); }
      } else if (!p.okOnce) {
        p.okOnce = true;
        if (Math.random() < 0.6) this.say2(U.pick(GOOD_LEAVE));
      }
    },
    digDecoy(p) {
      this.card = null;
      const kind = p.type;
      this.act(async () => {
        this.decoy = { p, t: 0 };
        G.audio.sfx('dig'); G.audio.sfx('dig', 0.25); G.audio.sfx('dig', 0.5);
        for (let i = 0; i < 28; i++) this.crumb(p.x + U.rand(-14, 14), p.y - 4, true, true);
        await G.wait(0.75);
        p.dug = true;
        this.decoy = null;
        this.mistakes[kind]++;
        this.light = Math.max(0.02, this.light - PENALTY / this.dur);
        if (kind === 'ivy') this.itchy = true;
        G.audio.sfx('fail');
        if (opts.onMistake) await opts.onMistake({ kind });
        else await G.say('hattie', LINES.mistake[kind]);
      });
    },

    // -------- phase 2 : déterrer
    startDig(p) {
      this.card = null;
      this.act(async () => {
        G.audio.sfx('dig');
        await this.fadeSwap(() => { this.mode = 'dig'; this.dig = this.makeDig(p); });
        if (!this.flags.firstDig) {
          this.flags.firstDig = true;
          await G.say('hattie', LINES.firstDig);
        }
      });
    },
    makeDig(p) {
      const rnd = U.rng(p.seed * 3 + 11);
      const root = makeRoot(rnd, 640);
      const H = G.H - SY;
      const dirt = A.canvas(G.W, H, Math.min(G.dpr, 1.5));
      paintDirt(dirt.cx, G.W, H, rnd);
      const gw = Math.ceil(G.W / CELL), gh = Math.ceil(H / CELL);
      const grid = new Float32Array(gw * gh).fill(1);
      const zone = [];
      const bb = root.bb;
      for (let j = 0; j < gh; j++) {
        const y = SY + j * CELL + CELL / 2;
        if (y < bb.y0 - 30 || y > bb.y1 + 30) continue;
        for (let i = 0; i < gw; i++) {
          const x = i * CELL + CELL / 2;
          if (x < bb.x0 - 30 || x > bb.x1 + 30) continue;
          let near = false;
          for (const c of root.caps) {
            const s = segDist(x, y, c.x1, c.y1, c.x2, c.y2);
            if (s.d - U.lerp(c.r1, c.r2, s.t) < 24) { near = true; break; }
          }
          if (!near) {
            for (const rl of root.rootlets) {
              for (let k = 0; k < rl.pts.length - 1 && !near; k++) {
                if (segDist(x, y, rl.pts[k][0], rl.pts[k][1], rl.pts[k + 1][0], rl.pts[k + 1][1]).d < 9) near = true;
              }
              if (near) break;
            }
          }
          if (near) zone.push(j * gw + i);
        }
      }
      return {
        p, root, dirt, grid, gw, gh, zone, index: this.roots.length + 1,
        spr: makeSprite('ginseng', p.q, 1.55),
        tool: 'stick', cur: { x: 540, y: 300 }, mx: I.x, my: I.y, last: null, acc: 0,
        q: 1, marks: [], hitCd: 0, rub: 0, scuffCd: 0, sfxCd: 0, crunchCd: 0, shake: 0,
        cleared: 0, ready: false, pull: null, result: null, hits: 0, rubbed: 0, lost: 0,
        ptr: false, rubbing: false, scraping: false, armed: !I.key('Space'), warned: false,
      };
    },
    dirtAt(x, y) {
      const d = this.dig;
      const i = Math.floor(x / CELL), j = Math.floor((y - SY) / CELL);
      if (i < 0 || j < 0 || i >= d.gw || j >= d.gh) return 0;
      return d.grid[j * d.gw + i];
    },
    stamp(x, y, a) {
      const d = this.dig, T = TOOLS[d.tool];
      const c = d.dirt.cx, b = brush(T.r);
      const jr = T.r * (0.92 + Math.random() * 0.16);
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = a;
      c.drawImage(b.c, x - jr + U.rand(-1.5, 1.5), y - SY - jr + U.rand(-1.5, 1.5), jr * 2, jr * 2);
      c.restore();
      const R = T.r * 0.82;
      const i0 = Math.max(0, Math.floor((x - R) / CELL)), i1 = Math.min(d.gw - 1, Math.floor((x + R) / CELL));
      const j0 = Math.max(0, Math.floor((y - SY - R) / CELL)), j1 = Math.min(d.gh - 1, Math.floor((y - SY + R) / CELL));
      let had = 0;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = i * CELL + CELL / 2, cy = SY + j * CELL + CELL / 2;
          if ((cx - x) * (cx - x) + (cy - y) * (cy - y) > R * R) continue;
          const k = j * d.gw + i, v = d.grid[k];
          had += v * a;
          d.grid[k] = v * (1 - a);
        }
      }
      if (had > 0.4) {
        if (Math.random() < Math.min(1, had * 0.25)) this.crumb(x + U.rand(-T.r, T.r) * 0.6, y, false, d.tool === 'stick');
        if (d.sfxCd <= 0) { G.audio.sfx('dig'); d.sfxCd = d.tool === 'stick' ? 0.16 : 0.3; }
      }
      this.hurt(x, y);
    },
    scrape(x0, y0, x1, y1, dt) {
      const d = this.dig, T = TOOLS[d.tool];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 0.5) { this.stamp(x1, y1, 1 - Math.exp(-T.rate * dt)); return; }
      let s = T.gap - d.acc;
      while (s <= L) {
        const k = s / L;
        this.stamp(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, T.a);
        s += T.gap;
      }
      d.acc = L - (s - T.gap);
    },
    // Le bâton blesse la racine et casse les radicelles ; les doigts n'abîment
    // que le corps à nu, et seulement si on insiste.
    hurt(x, y) {
      const d = this.dig, R = d.root;
      if (d.tool === 'stick') {
        if (d.hitCd <= 0) {
          for (const c of R.caps) {
            const s = segDist(x, y, c.x1, c.y1, c.x2, c.y2);
            const r = U.lerp(c.r1, c.r2, s.t);
            if (s.d < r + 13) {
              d.q = Math.max(0.15, d.q - 0.15);
              d.hits++; d.hitCd = 0.45; d.shake = 0.25;
              const k = Math.min(1, (r * 0.55) / Math.max(1, s.d));
              d.marks.push({ k: 'gash', x: s.x + (x - s.x) * k, y: s.y + (y - s.y) * k, a: Math.atan2(c.y2 - c.y1, c.x2 - c.x1) + 1.3 + U.rand(-0.4, 0.4), part: c.part });
              G.audio.sfx('crunch');
              for (let i = 0; i < 6; i++) this.crumb(s.x, s.y, false, true);
              if (!d.warned) { d.warned = true; this.say2('Pas le bâton, si près ! Prends tes doigts.'); }
              break;
            }
          }
        }
        for (const rl of R.rootlets) {
          if (rl.broken >= 0) continue;
          for (let k = 0; k < rl.pts.length - 1; k++) {
            if (segDist(x, y, rl.pts[k][0], rl.pts[k][1], rl.pts[k + 1][0], rl.pts[k + 1][1]).d < 11) {
              rl.broken = Math.max(0, k);
              d.q = Math.max(0.15, d.q - 0.03);
              d.lost++;
              if (d.crunchCd <= 0) { G.audio.sfx('crunch'); d.crunchCd = 0.25; }
              break;
            }
          }
        }
      } else if (this.dirtAt(x, y) < 0.3) {
        for (const c of R.caps) {
          const s = segDist(x, y, c.x1, c.y1, c.x2, c.y2);
          if (s.d < U.lerp(c.r1, c.r2, s.t) * 0.95 + 3) { d.rubbing = true; d.rubPt = { x: s.x, y: s.y, part: c.part }; break; }
        }
      }
    },
    setTool(t) {
      const d = this.dig;
      if (d.tool === t) return;
      d.tool = t; d.last = null; d.acc = 0;
      G.audio.sfx('click');
    },
    updateDig(dt) {
      const d = this.dig;
      d.hitCd -= dt; d.sfxCd -= dt; d.crunchCd -= dt;
      d.shake = Math.max(0, d.shake - dt);
      if (d.pull) d.pull.t += dt;
      if (d.result) d.result.t += dt;
      if (!I.key('Space')) d.armed = true;
      if (this.paused()) { d.last = null; d.ptr = false; d.scraping = false; return; }
      if (d.result) {
        if (d.result.canGo && (I.confirm() || ui.hit(RES.cont))) { I.consume(); this.leaveDig(); }
        return;
      }
      if (d.pull) return;
      if (I.hit('Digit1') || I.hit('Numpad1') || I.hit('KeyB')) this.setTool('stick');
      if (I.hit('Digit2') || I.hit('Numpad2') || I.hit('KeyF')) this.setTool('fingers');
      if (I.hit('Tab')) this.setTool(d.tool === 'stick' ? 'fingers' : 'stick');
      if (I.hit('KeyT') || (d.ready && I.hit('Enter'))) { this.pull(); return; }
      if (I.pressed) {
        if (U.inRect(I, DIGUI.stick)) this.setTool('stick');
        else if (U.inRect(I, DIGUI.fingers)) this.setTool('fingers');
        else if (U.inRect(I, DIGUI.pull)) { this.pull(); return; }
        else if (I.y > SY - 24) { d.ptr = true; this.kbd = false; }
      }
      if (!I.down) d.ptr = false;
      let kx = 0, ky = 0;
      if (I.key('ArrowLeft') || I.key('KeyA') || I.key('KeyQ')) kx -= 1;
      if (I.key('ArrowRight') || I.key('KeyD')) kx += 1;
      if (I.key('ArrowUp') || I.key('KeyW') || I.key('KeyZ')) ky -= 1;
      if (I.key('ArrowDown') || I.key('KeyS')) ky += 1;
      if (kx || ky) {
        this.kbd = true;
        const l = Math.hypot(kx, ky), sp = d.tool === 'stick' ? 320 : 220;
        d.cur.x += kx / l * sp * dt; d.cur.y += ky / l * sp * dt;
      }
      if (I.x !== d.mx || I.y !== d.my) {
        if (I.mouse && I.y > SY - 40) { d.cur.x = I.x; d.cur.y = I.y; this.kbd = false; }
        d.mx = I.x; d.my = I.y;
      }
      if (d.ptr) { d.cur.x = I.x; d.cur.y = I.y; }
      d.cur.x = U.clamp(d.cur.x, 8, G.W - 8);
      d.cur.y = U.clamp(d.cur.y, SY + 4, G.H - 8);
      const want = d.ptr || (d.armed && I.key('Space'));
      d.rubbing = false;
      if (want) {
        if (!d.last) { this.stamp(d.cur.x, d.cur.y, TOOLS[d.tool].a); d.last = { x: d.cur.x, y: d.cur.y }; d.acc = 0; }
        else { this.scrape(d.last.x, d.last.y, d.cur.x, d.cur.y, dt); d.last.x = d.cur.x; d.last.y = d.cur.y; }
        d.scraping = true;
      } else { d.last = null; d.scraping = false; }
      if (d.rubbing) {
        d.rub += dt;
        if (d.rub > 0.6) {
          d.q = Math.max(0.15, d.q - 0.09 * dt);
          d.rubbed += dt;
          d.scuffCd -= dt;
          if (d.scuffCd <= 0) {
            d.scuffCd = 0.35;
            d.marks.push({ k: 'scuff', x: d.rubPt.x + U.rand(-4, 4), y: d.rubPt.y + U.rand(-4, 4), a: U.rand(0, Math.PI), part: d.rubPt.part });
          }
        }
      } else d.rub = Math.max(0, d.rub - dt * 2);
      if (d.scraping) {
        let n = 0;
        for (const i of d.zone) if (d.grid[i] < 0.2) n++;
        d.cleared = d.zone.length ? n / d.zone.length : 1;
        if (!d.ready && d.cleared >= PULL_AT) {
          d.ready = true;
          G.audio.sfx('good');
          this.say2('Elle est dégagée. Tire doucement, maintenant.');
        }
      }
    },
    buried(rl) {
      let n = 0;
      for (const [x, y] of rl.pts) if (this.dirtAt(x, y) > 0.4) n++;
      return n / rl.pts.length;
    },
    pull() {
      const d = this.dig;
      if (d.pull) return;
      const broken = d.cleared < PULL_AT;
      let lostNow = 0;
      if (!broken) {
        for (const rl of d.root.rootlets) {
          if (rl.broken < 0 && this.buried(rl) > 0.5) { rl.broken = Math.max(1, Math.floor(rl.pts.length / 2)); lostNow++; }
        }
      }
      d.q = Math.max(0.15, d.q - lostNow * 0.02);
      d.lost += lostNow;
      if (broken) d.q *= 0.5;
      d.pull = { t: 0, broken };
      d.ptr = false; d.scraping = false;
      G.audio.sfx(broken ? 'crunch' : 'dig');
      if (broken) G.audio.sfx('fail', 0.2);
      this.act(async () => {
        await G.wait(1.3);
        const q = Math.round(d.q * 100) / 100;
        const label = broken ? 'Cassée' : q >= 0.86 ? 'Racine entière' : 'Un peu abîmée';
        let sub;
        if (broken) sub = 'Tirée trop tôt : les jambes sont restées dans la terre.';
        else if (q >= 0.86) sub = d.lost ? 'Quelques radicelles en moins, mais elle est belle.' : 'Pas une marque, et toutes ses radicelles.';
        else if (d.hits) sub = d.hits > 1 ? 'Le bâton l\'a marquée plusieurs fois.' : 'Le bâton l\'a marquée.';
        else if (d.rubbed > 0.5) sub = 'Tu l\'as trop frottée avec les doigts.';
        else sub = 'Des radicelles arrachées.';
        d.result = { label, q, sub, t: 0, canGo: false, broken };
        G.audio.sfx(broken ? 'thud' : q >= 0.86 ? 'perfect' : 'good');
        this.roots.push({ quality: q });
        const index = this.roots.length - 1;
        await G.wait(0.7);
        if (opts.onRoot) await opts.onRoot({ index, quality: q });
        else await G.say('hattie', broken ? LINES.root.broken : q >= 0.86 ? LINES.root.whole : LINES.root.hurt);
        d.result.canGo = true;
      });
    },
    leaveDig() {
      const d = this.dig;
      d.result.canGo = false;
      d.p.dug = true;
      this.act(async () => {
        await this.fadeSwap(() => { this.mode = 'search'; this.dig = null; });
        if (this.roots.length >= this.goal) this.end('done');
      });
    },

    // ---------------------------------------------------------------- dessin
    draw(ctx) {
      if (this.mode === 'dig' && this.dig) this.drawDig(ctx);
      else this.drawSearch(ctx);
      A.finish(ctx);
    },
    drawSearch(ctx) {
      const L = this.layers();
      const cam = Math.round(this.cam);
      A.blit(ctx, L.sky, 0, 0);
      blitSlice(ctx, L.far, Math.round(cam * PF), 0);
      blitSlice(ctx, L.mid, Math.round(cam * PM), 0);
      blitSlice(ctx, L.ground, cam, 0);
      const g = this.granny;
      const gr = A.char(ctx, 'hattie', g.x - cam, groundTop(g.x) + 11, {
        dir: g.dir, pose: g.moving ? 'walk' : g.crouch > 0 ? 'crouch' : 'stand', phase: g.phase, carry: 'pipe', h: 104, seed: 5,
        arms: g.crouch > 0 && !g.moving ? [0.45, 0.75] : undefined,
      });
      this.gHead = gr.head;
      for (const it of this.items) {
        const sx = it.x - cam;
        if (sx < -260 || sx > G.W + 260) continue;
        if (it.kind === 'fern') {
          const sp = fernSprite(it.v);
          ctx.drawImage(sp.c, sx - 110 * it.s, it.y - 114 * it.s, 220 * it.s, 120 * it.s);
        } else this.drawPlant(ctx, it, sx);
      }
      for (const f of this.fx) {
        if (!f.world) continue;
        ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
        ell(ctx, f.x - cam, f.y, f.r, f.r * 0.8, 0, f.c);
      }
      ctx.globalAlpha = 1;
      blitSlice(ctx, L.fore, Math.round(cam * PFG), FORE_Y);
      this.drawForeTrunks(ctx, cam);
      this.drawShafts(ctx, cam);
      this.drawDusk(ctx, 1 - this.light);
    },
    drawPlant(ctx, p, sx) {
      if (p.type === 'creeper') drawTrunk(ctx, sx, p.y, p.q.tw * p.s, p.seed, -20);
      if (p.dug) { drawMound(ctx, sx, p.y, p.s, p.seed); return; }
      const spr = this.sprite(p);
      let rot = p.type === 'creeper' ? 0 : Math.sin(G.time * 1.1 + (p.seed % 7)) * 0.016, sy = 1, jx = 0;
      if (this.decoy && this.decoy.p === p) {
        const k = U.clamp(this.decoy.t / 0.75, 0, 1);
        jx = Math.sin(this.decoy.t * 50) * 3 * (1 - k);
        sy = 1 - k * 0.85;
        rot += k * 0.3;
      }
      ctx.save();
      ctx.translate(sx + jx, p.y);
      ctx.rotate(rot);
      ctx.scale(1, sy);
      ctx.drawImage(spr.c, -spr.ox, -spr.oy, spr.w, spr.h);
      ctx.restore();
    },
    drawForeTrunks(ctx, cam) {
      for (const [wx, tw] of [[1180, 50], [2700, 60]]) {
        const x = wx - cam * PTR;
        if (x < -80 || x > G.W + 80) continue;
        ctx.fillStyle = '#1B140E';
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.7, G.H + 4);
        ctx.quadraticCurveTo(x - tw * 0.5, G.H - 40, x - tw * 0.46, G.H - 130);
        ctx.lineTo(x - tw * 0.42, -10); ctx.lineTo(x + tw * 0.42, -10);
        ctx.lineTo(x + tw * 0.46, G.H - 130);
        ctx.quadraticCurveTo(x + tw * 0.5, G.H - 40, x + tw * 0.7, G.H + 4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(230,180,100,${0.1 * this.light})`;
        ctx.fillRect(x - tw * 0.42, -10, tw * 0.13, G.H - 120);
      }
    },
    drawShafts(ctx, cam) {
      const L = Math.pow(this.light, 1.3);
      if (L < 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 7; i++) {
        const x = 80 + i * 520 - cam * 0.45;
        if (x < -700 || x > G.W + 60) continue;
        const tw = 46 + (i * 37) % 60, bw = tw * 2.8, dx = 340;
        const a = (0.1 + 0.04 * Math.sin(this.t * 0.4 + i * 1.7)) * L;
        const g = ctx.createLinearGradient(0, 0, 0, G.H);
        g.addColorStop(0, `rgba(255,222,150,${a})`);
        g.addColorStop(0.6, `rgba(255,205,120,${a * 0.5})`);
        g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, -10); ctx.lineTo(x + tw, -10); ctx.lineTo(x + dx + bw, G.H); ctx.lineTo(x + dx, G.H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    drawDusk(ctx, k) {
      if (k <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = mix('#FFFFFF', '#5A6280', Math.min(1, k));
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.restore();
      if (k > 0.55) { ctx.fillStyle = `rgba(8,10,20,${(k - 0.55) * 0.5})`; ctx.fillRect(0, 0, G.W, G.H); }
    },
    digLayers() {
      const s = this.seed;
      return {
        top: A.cached('gs-dtop-' + s, G.W, SY + 14, (cx, w, h) => {
          const rnd = U.rng(s + 51);
          A.sky(cx, w, h, [[0, '#C9A060'], [0.7, '#8E6A42'], [1, '#5A4028']]);
          for (let i = 0; i < 18; i++) { const x = rnd() * w, tw = 6 + rnd() * 12; cx.fillStyle = rgba('#9A8462', 0.5 + rnd() * 0.3); cx.fillRect(x, 0, tw, h); }
          A.dots(cx, s + 52, 140, 0, w, () => [-20, 60], ['#D2A75E', '#C0602A', '#E0B050', '#A84A22'], 8, 20, 0.5, 0.85);
          for (let i = 0; i < 7; i++) {
            const x = rnd() * w, tw = 22 + rnd() * 22;
            cx.fillStyle = pickR(rnd, ['#5C4838', '#544234', '#66523F']);
            cx.fillRect(x - tw / 2, 0, tw, h);
            cx.fillStyle = 'rgba(20,12,6,0.25)'; cx.fillRect(x + tw * 0.1, 0, tw * 0.4, h);
          }
          cx.fillStyle = '#4A3220';
          cx.fillRect(0, SY - 14, w, h - SY + 14);
          A.texture(cx, w, h, 0.18);
        }),
        hole: A.cached('gs-dhole', G.W, G.H - SY, (cx, w, h) => {
          const g = cx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#22160D'); g.addColorStop(1, '#140D07');
          cx.fillStyle = g;
          cx.fillRect(0, 0, w, h);
          const rnd = U.rng(77);
          for (let i = 0; i < 2500; i++) { cx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(80,58,36,0.3)'; cx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
          A.texture(cx, w, h, 0.2);
        }),
        lip: A.cached('gs-dlip', G.W, 30, (cx, w, h) => {
          const rnd = U.rng(78);
          for (let i = 0; i < 900; i++) {
            cx.globalAlpha = 0.6 + rnd() * 0.4;
            ell(cx, rnd() * w, 6 + rnd() * 14, 2 + rnd() * 4, 1 + rnd() * 1.8, rnd() * Math.PI, pickR(rnd, LITTER));
          }
          cx.globalAlpha = 1;
        }),
      };
    },
    drawDig(ctx) {
      const d = this.dig, L = this.digLayers();
      const sh = d.shake > 0 ? (Math.random() - 0.5) * 7 * d.shake / 0.25 : 0;
      ctx.save();
      ctx.translate(sh, 0);
      A.blit(ctx, L.top, 0, 0);
      A.blit(ctx, L.hole, 0, SY);
      const pk = d.pull ? U.easeInOut(U.clamp(d.pull.t / 1.1, 0, 1)) : 0;
      const lift = pk * 130;
      const broken = d.pull && d.pull.broken;
      if (!d.pull) drawRoot(ctx, d.root, d.marks, 'all', 0, 0, false);
      else if (broken) drawRoot(ctx, d.root, d.marks, 'bottom', 0, 0, false);
      ctx.save();
      const k = G.view.scale * G.dpr;
      ctx.shadowColor = 'rgba(6,4,2,0.7)';
      ctx.shadowOffsetY = 6 * k;
      ctx.drawImage(d.dirt.c, 0, SY, G.W, G.H - SY);
      ctx.restore();
      if (d.pull) drawRoot(ctx, d.root, d.marks, broken ? 'top' : 'all', 0, -lift, broken);
      A.blit(ctx, L.lip, 0, SY - 16);
      // la plante, au-dessus du collet
      const n = d.root.caps[0];
      ctx.save();
      ctx.translate(n.x1, SY + 4 - lift);
      ctx.rotate(Math.sin(G.time * 1.1) * 0.012);
      ctx.drawImage(d.spr.c, -d.spr.ox, -d.spr.oy, d.spr.w, d.spr.h);
      ctx.restore();
      // Henry à genoux, Granny debout
      const sc = d.scraping ? Math.sin(G.time * 13) : 0;
      // l'herbe à puce : de temps en temps, Henry se gratte le bras
      const itch = this.itchy && !d.scraping && G.time % 6 < 1.1;
      A.char(ctx, 'henry', 480, SY + 3, {
        pose: 'kneel', dir: 1, rim: true, seed: 2,
        arms: itch ? [1.5 + Math.sin(G.time * 34) * 0.18, 1.05] : [0.8 + sc * 0.12, 1.05 + sc * 0.22],
      });
      const gr = A.char(ctx, 'hattie', 850, SY + 3, { dir: -1, carry: 'pipe', seed: 5 });
      this.gHead = gr.head;
      for (const f of this.fx) {
        if (f.world) continue;
        ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
        ell(ctx, f.x, f.y, f.r, f.r * 0.8, 0, f.c);
      }
      ctx.globalAlpha = 1;
      if (!d.pull && !d.result) this.drawTool(ctx, d);
      ctx.restore();
      this.drawDusk(ctx, (1 - this.light) * 0.55);
    },
    drawTool(ctx, d) {
      const { x, y } = d.cur;
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const wob = d.scraping ? Math.sin(G.time * 22) * 3 : 0;
      if (d.tool === 'stick') {
        const ex = x + 48 + wob, ey = y - 122;
        ctx.strokeStyle = P.rim; ctx.lineWidth = 9.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#5A4128'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,160,110,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 2, y - 6); ctx.lineTo(ex - 1, ey + 4); ctx.stroke();
      } else {
        // une main qui gratte, venue d'en haut à gauche (bouts des doigts sur le curseur)
        const cl = d.scraping ? Math.sin(G.time * 18) * 2.5 : 0;
        const tips = [[-11, -2 + cl], [-4, 2 - cl], [3, 2 + cl], [10, -1 - cl]];
        for (const [col, extra] of [[P.rim, 2.2], [P.sil, 0]]) {
          ctx.strokeStyle = col; ctx.fillStyle = col;
          ctx.lineWidth = 17 + extra * 2;
          ctx.beginPath(); ctx.moveTo(x - 52 + wob, y - 96); ctx.lineTo(x - 8 + wob * 0.5, y - 36); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x - 2, y - 25, 17 + extra, 14 + extra, 0.35, 0, TAU); ctx.fill();
          ctx.lineWidth = 7.5 + extra * 2;
          for (const [fx, fy] of tips) {
            ctx.beginPath(); ctx.moveTo(x + fx * 0.8, y - 20); ctx.quadraticCurveTo(x + fx * 1.08, y - 9, x + fx, y + fy); ctx.stroke();
          }
          ctx.lineWidth = 7 + extra * 2;
          ctx.beginPath(); ctx.moveTo(x + 9, y - 31); ctx.quadraticCurveTo(x + 23, y - 27, x + 21, y - 13); ctx.stroke();
        }
      }
      ctx.restore();
    },

    // ---------------------------------------------------------------- interface
    drawUI(uctx) {
      if (this.mode === 'dig' && this.dig) this.drawDigUI(uctx);
      else this.drawSearchUI(uctx);
      if (this.xf) {
        const x = this.xf;
        uctx.globalAlpha = U.clamp(1 - Math.abs(x.t - x.dur / 2) / (x.dur / 2), 0, 1);
        uctx.fillStyle = '#0d0b0a';
        uctx.fillRect(0, 0, G.W, G.H);
        uctx.globalAlpha = 1;
      }
    },
    drawSearchUI(uctx) {
      const paused = this.paused();
      // la règle de Granny, sur un bout de papier
      ui.notebook(uctx, 18, 16, 356, [{ t: 'Le sang, d\'après Granny :', size: 23, color: '#7A2E1A' }, ...RULE], { lineH: 26 });
      this.drawStatus(uctx);
      // plante choisie (clavier) ou survolée (souris)
      if (!this.card && !paused) {
        const hov = I.mouse && !(this.drag && this.drag.moved) && !this.edge ? this.hitPlant(I.x, I.y) : null;
        const show = [];
        if (this.sel && this.kbd && !this.sel.dug) show.push(this.sel);
        if (hov && !show.includes(hov)) show.push(hov);
        for (const p of show) {
          const sx = p.x - this.cam, b = this.plantBox(p);
          uctx.save();
          uctx.strokeStyle = 'rgba(242,210,122,0.85)'; uctx.lineWidth = 2;
          uctx.setLineDash([6, 5]);
          uctx.beginPath(); uctx.ellipse(sx, p.y + 2, 44 * p.s, 11 * p.s, 0, 0, TAU); uctx.stroke();
          uctx.restore();
          ui.tag(uctx, 'Examiner', sx, Math.max(60, b.y + 6), { active: p === this.sel && this.kbd });
        }
      }
      this.drawEdges(uctx);
      // barre de défilement
      const tw = 360, tx = (G.W - tw) / 2, ty = G.H - 14;
      uctx.fillStyle = 'rgba(232,223,204,0.16)';
      uctx.beginPath(); uctx.roundRect(tx, ty, tw, 5, 2.5); uctx.fill();
      uctx.fillStyle = 'rgba(232,223,204,0.6)';
      uctx.beginPath(); uctx.roundRect(tx + tw * this.cam / WW, ty, tw * G.W / WW, 5, 2.5); uctx.fill();
      // consigne
      if (!this.card && (!this.hintSeen || this.idle > 22) && !G.blocked && !this.ending) {
        const h = this.kbd ? 'Flèches : choisir une plante · Espace : l\'examiner'
          : I.mouse ? 'Clique sur une plante pour l\'examiner · glisse pour avancer' : 'Touche une plante pour l\'examiner · glisse pour avancer';
        ui.hint(uctx, h, { y: 16, size: 20 });
      }
      this.drawCaption(uctx);
      if (this.card) this.drawCard(uctx);
    },
    drawStatus(uctx) {
      const w = 252, x = G.W - w - 18, y = 16, h = this.itchy ? 100 : 76;
      panelBox(uctx, { x, y, w, h });
      ui.caps(uctx, 'Racines', x + 18, y + 30, { size: 13, color: 'rgba(232,223,204,0.75)' });
      for (let i = 0; i < this.goal; i++) rootIcon(uctx, x + 132 + i * 36, y + 23, i < this.roots.length);
      ui.caps(uctx, 'Jour', x + 18, y + 59, { size: 13, color: 'rgba(232,223,204,0.75)' });
      ui.bar(uctx, x + 116, y + 51, 118, 9, this.light, { color: this.light < 0.25 ? P.ember : P.gold });
      if (this.itchy) ui.text(uctx, 'Ça te gratte le bras.', x + 18, y + 88, { size: 18, italic: true, color: '#E9B98A' });
    },
    drawEdges(uctx) {
      if (this.card) return;
      for (const s of [-1, 1]) {
        const can = s < 0 ? this.cam > 1 : this.cam < this.maxCam() - 1;
        if (!can) continue;
        const r = s < 0 ? EDGE_L : EDGE_R;
        const on = this.edge === s;
        uctx.save();
        uctx.fillStyle = on ? 'rgba(52,42,34,0.8)' : 'rgba(20,16,13,0.45)';
        rrect(uctx, r, 27); uctx.fill();
        uctx.strokeStyle = on ? P.rim : 'rgba(232,223,204,0.8)';
        uctx.lineWidth = 3; uctx.lineCap = 'round'; uctx.lineJoin = 'round';
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        uctx.beginPath(); uctx.moveTo(cx - s * 6, cy - 14); uctx.lineTo(cx + s * 7, cy); uctx.lineTo(cx - s * 6, cy + 14); uctx.stroke();
        uctx.restore();
      }
    },
    drawCaption(uctx) {
      const c = this.caption;
      if (!c || !this.gHead || G.blocked) return;
      const a = Math.max(0, Math.min(1, c.t * 5, (c.life - c.t) * 3));
      uctx.save();
      uctx.globalAlpha = a;
      uctx.font = ui.font(19, 'serif', 'italic');
      const lines = ui.wrap(uctx, c.text, 300);
      let tw = 70;
      for (const l of lines) tw = Math.max(tw, uctx.measureText(l).width);
      const w = tw + 32, h = lines.length * 24 + 42;
      const hx = this.gHead.x, hy = this.gHead.y;
      const side = this.mode === 'dig';
      let x = side ? hx + 40 : hx - w / 2, y = side ? hy - h / 2 - 10 : hy - 40 - h;
      x = U.clamp(x, 14, G.W - w - 14);
      y = U.clamp(y, 8, G.H - h - 8);
      const tail = hx > 20 && hx < G.W - 20;
      uctx.fillStyle = 'rgba(18,14,12,0.88)';
      uctx.beginPath(); uctx.roundRect(x, y, w, h, 8); uctx.fill();
      uctx.beginPath();
      if (!tail) { /* Granny hors champ : pas de pointe */ } else if (side) { uctx.moveTo(x, hy - 18); uctx.lineTo(x - 10, hy - 8); uctx.lineTo(x, hy - 2); }
      else { const px = U.clamp(hx, x + 16, x + w - 16); uctx.moveTo(px - 8, y + h); uctx.lineTo(px, y + h + 10); uctx.lineTo(px + 8, y + h); }
      uctx.fill();
      ui.caps(uctx, 'Granny', x + 16, y + 21, { size: 12, color: G.WHO.hattie.color });
      ui.text(uctx, c.text, x + 16, y + 44, { size: 19, italic: true, maxW: 300, lineH: 24 });
      uctx.restore();
    },
    drawCard(uctx) {
      const c = this.card, p = c.p, R = CARD;
      const a = U.clamp(c.t / 0.18, 0, 1);
      uctx.save();
      uctx.globalAlpha = a;
      uctx.fillStyle = 'rgba(8,6,4,0.55)';
      uctx.fillRect(0, 0, G.W, G.H);
      uctx.shadowColor = 'rgba(0,0,0,0.5)'; uctx.shadowBlur = 24;
      uctx.fillStyle = 'rgba(24,19,15,0.97)';
      rrect(uctx, R.panel, 12); uctx.fill();
      uctx.shadowBlur = 0;
      uctx.strokeStyle = 'rgba(232,223,204,0.16)'; uctx.lineWidth = 1; uctx.stroke();
      // le gros plan
      const F = R.frame, Z = ZOOM[p.type];
      uctx.save();
      rrect(uctx, F, 8); uctx.clip();
      A.blit(uctx, A.cached('gs-cardbg', F.w, F.h, paintCardBg), F.x, F.y);
      uctx.translate(F.x + F.w / 2, F.y + F.h - Z.by);
      uctx.scale(Z.s, Z.s);
      if (p.type === 'creeper') drawTrunk(uctx, 0, 0, p.q.tw, p.seed, -300);
      else ell(uctx, 0, 1, 16, 2.6, 0, 'rgba(10,6,3,0.45)');
      uctx.rotate(Math.sin(G.time * 0.9) * 0.008);
      DRAW[p.type](uctx, p.q, true);
      uctx.restore();
      uctx.strokeStyle = 'rgba(232,223,204,0.2)'; uctx.lineWidth = 1;
      rrect(uctx, F, 8); uctx.stroke();
      // la règle, à côté
      const x = R.col;
      ui.caps(uctx, 'De près', x, 112, { size: 13, color: 'rgba(232,223,204,0.55)', spacing: 3 });
      ui.text(uctx, 'C\'est le sang, ça ?', x, 152, { size: 32 });
      ui.notebook(uctx, x + 2, 178, 368, [{ t: 'La règle de Granny :', size: 23, color: '#7A2E1A' }, ...RULE], { lineH: 27, rot: 0.008 });
      ui.text(uctx, 'Compte les branches, puis les feuilles de chacune. Et regarde où sont les baies.', x, 362, { size: 19, italic: true, color: '#D8CFBC', maxW: 372, lineH: 25 });
      const hv = (i, r) => (this.kbd && c.focus === i) || ui.hover(r);
      ui.button(uctx, R.dig, 'Creuser', { hover: hv(0, R.dig), size: 24 });
      ui.button(uctx, R.leave, 'Laisser', { hover: hv(1, R.leave), size: 24 });
      ui.text(uctx, 'C : creuser · L ou Échap : laisser', x, 546, { size: 15, italic: true, color: 'rgba(232,223,204,0.42)' });
      uctx.restore();
    },
    drawDigUI(uctx) {
      const d = this.dig;
      // en haut à gauche : où on en est
      const bx = 20, by = 16;
      panelBox(uctx, { x: bx, y: by, w: 300, h: 112 });
      ui.caps(uctx, `Racine ${d.index} sur ${this.goal}`, bx + 18, by + 28, { size: 13, color: P.rim });
      ui.text(uctx, 'Terre dégagée autour', bx + 18, by + 56, { size: 18, italic: true, color: 'rgba(232,223,204,0.8)' });
      ui.bar(uctx, bx + 18, by + 66, 264, 10, d.cleared, { color: d.ready ? P.gold : '#A88A5A' });
      uctx.fillStyle = P.paper;
      uctx.fillRect(bx + 18 + 264 * PULL_AT - 1, by + 62, 2, 18);
      const st = d.q >= 0.97 ? 'La racine est intacte.' : d.q >= 0.86 ? 'Une petite marque.' : d.q >= 0.6 ? 'La racine est abîmée.' : 'La racine est bien abîmée.';
      ui.text(uctx, st, bx + 18, by + 100, { size: 18, italic: true, color: d.q >= 0.86 ? '#CFE0A8' : '#E9A27A' });
      if (!d.result && !d.pull) {
        // outils
        for (const t of ['stick', 'fingers']) {
          const r = DIGUI[t], on = d.tool === t;
          ui.button(uctx, r, t === 'stick' ? 'Bâton' : 'Doigts', { hover: on || ui.hover(r), size: 23, key: t === 'stick' ? '1' : '2' });
          if (on) { uctx.fillStyle = P.rim; uctx.fillRect(r.x + 16, r.y + r.h - 5, r.w - 32, 3); }
        }
        ui.text(uctx, d.tool === 'stick' ? 'Bâton : rapide, mais gare à la racine.' : 'Doigts : lent, mais sans danger pour les radicelles.',
          DIGUI.stick.x + 2, DIGUI.stick.y - 12, { size: 18, italic: true, color: 'rgba(232,223,204,0.85)', shadow: true });
        // tirer
        const r = DIGUI.pull;
        if (d.ready) {
          const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
          uctx.save();
          uctx.shadowColor = `rgba(242,210,122,${0.4 + 0.4 * pulse})`; uctx.shadowBlur = 18;
          uctx.fillStyle = P.gold;
          rrect(uctx, r, 6); uctx.fill();
          uctx.restore();
          ui.text(uctx, 'Tirer la racine', r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 24, color: P.ink, align: 'center', base: 'middle', bold: true });
          ui.text(uctx, 'T', r.x + r.w - 14, r.y + r.h / 2 + 1, { size: 15, color: 'rgba(31,26,23,0.5)', align: 'right', base: 'middle' });
        } else {
          ui.button(uctx, r, 'Tirer la racine', { size: 22, key: 'T', disabled: !ui.hover(r) });
          ui.text(uctx, 'Trop tôt : elle risque de casser.', r.x + r.w, r.y - 12, { size: 17, italic: true, color: '#E9A27A', align: 'right', shadow: true });
        }
        // anneau de l'outil
        const T = TOOLS[d.tool];
        uctx.save();
        uctx.strokeStyle = d.rub > 0.1 ? P.ember : 'rgba(232,223,204,0.5)';
        uctx.lineWidth = d.rub > 0.1 ? 2.5 : 1.5;
        uctx.setLineDash([5, 4]);
        uctx.beginPath(); uctx.arc(d.cur.x, d.cur.y, T.r * 0.85, 0, TAU); uctx.stroke();
        uctx.restore();
        if (d.rub > 0.1) ui.text(uctx, 'Doucement…', d.cur.x, d.cur.y + T.r + 22, { size: 18, italic: true, color: '#F2C9A0', align: 'center', shadow: true });
        if (!G.blocked) {
          ui.hint(uctx, this.kbd ? 'Flèches : déplacer · Espace : gratter · 1 / 2 : outil · T : tirer' : 'Maintiens et glisse pour gratter la terre', { y: 16, size: 19 });
        }
      }
      this.drawCaption(uctx);
      if (d.result) this.drawResult(uctx, d);
    },
    drawResult(uctx, d) {
      const r = d.result, R = RES.panel;
      const a = U.clamp(r.t * 3, 0, 1);
      uctx.save();
      uctx.globalAlpha = a;
      uctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      uctx.rotate(-0.01);
      uctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
      uctx.shadowColor = 'rgba(0,0,0,0.5)'; uctx.shadowBlur = 18; uctx.shadowOffsetY = 4;
      uctx.fillStyle = '#EFE8D6';
      uctx.fillRect(R.x, R.y, R.w, R.h);
      uctx.shadowBlur = 0; uctx.shadowOffsetY = 0;
      // la racine, posée sur le papier
      const part = r.broken ? 'top' : 'all';
      const caps = d.root.caps.filter((c) => part === 'all' || c.part === part);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of caps) {
        x0 = Math.min(x0, c.x1 - c.r1, c.x2 - c.r2); x1 = Math.max(x1, c.x1 + c.r1, c.x2 + c.r2);
        y0 = Math.min(y0, c.y1 - c.r1, c.y2 - c.r2); y1 = Math.max(y1, c.y1 + c.r1, c.y2 + c.r2);
      }
      for (const rl of d.root.rootlets) {
        if (part !== 'all' && rl.part !== part) continue;
        for (const [x, y] of rl.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const box = { x: R.x + 24, y: R.y + 30, w: 250, h: R.h - 60 };
      const sc = Math.min(box.w / (x1 - x0), box.h / (y1 - y0 + 20), 1.1);
      uctx.save();
      uctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      uctx.scale(sc, sc);
      uctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2 + 10);
      const n = d.root.caps[0];
      uctx.strokeStyle = '#7A6A38'; uctx.lineWidth = 3; uctx.lineCap = 'round';
      uctx.beginPath(); uctx.moveTo(n.x1, n.y1); uctx.lineTo(n.x1 + 2, n.y1 - 22); uctx.stroke();
      drawRoot(uctx, d.root, d.marks, part, 0, 0, r.broken);
      uctx.restore();
      const tx = R.x + 300;
      ui.caps(uctx, `Racine ${d.index}`, tx, R.y + 50, { size: 14, color: 'rgba(31,26,23,0.55)', spacing: 3 });
      ui.text(uctx, r.label, tx, R.y + 108, { size: 52, kind: 'hand', color: r.broken ? '#8C2A1A' : '#2A3A5A' });
      ui.text(uctx, r.sub, tx, R.y + 152, { size: 21, italic: true, color: '#3A302A', maxW: 296, lineH: 27 });
      ui.caps(uctx, 'Qualité', tx, R.y + 268, { size: 12, color: 'rgba(31,26,23,0.55)' });
      ui.bar(uctx, tx, R.y + 280, 280, 10, r.q, { bg: 'rgba(31,26,23,0.15)', color: r.q >= 0.86 ? '#6E8A3A' : r.q >= 0.5 ? P.ochre : P.rust });
      uctx.restore();
      if (r.canGo) {
        uctx.save();
        uctx.globalAlpha = a;
        ui.button(uctx, RES.cont, 'Continuer', { hover: true, size: 23, key: 'Espace' });
        uctx.restore();
      }
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.ginseng = () => G.play(G.Scenes.ginseng({}));
})();
