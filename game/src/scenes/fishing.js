'use strict';
// Mini-jeu « La pêche avec Otis » : Troublesome Creek, fin d'après-midi d'octobre.
// Boucle : lancer (jauge de puissance qui oscille) → attendre la vraie touche →
// ferrer → mouliner sans casser la ligne → la prise. Souris, doigt ou Espace.
//
// G.Scenes.fishing({ between: async ({ index, caught, fish, total }) => {} })
//   « between » est attendu après chaque tentative résolue (mécanique et minuterie en pause).
//   Résultat : { fish: [{ name, halves }], halves, shoe, otis, reason }
//   (la vieille chaussure n'entre pas dans « fish » : shoe vaut alors true).
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ mise en scène
  const BANK_Y = 338;                  // ligne d'eau au pied de la rive d'en face
  const SQ = 0.6;                      // écrasement vertical du plan d'eau (vue de trois quarts)
  const persp = (y) => 0.42 + 0.58 * U.clamp((y - BANK_Y) / (G.H - BANK_Y), 0, 1);
  const CAST_A = { x: 452, y: 606 }, CAST_B = { x: 712, y: 400 };
  const castPt = (t) => ({ x: U.lerp(CAST_A.x, CAST_B.x, t), y: U.lerp(CAST_A.y, CAST_B.y, t) });
  const HENRY = { x: 232, foot: 646 };
  const OTIS = { x: 1088, foot: 648 };
  const OTIS_BOB = { x: 868, y: 528 };
  const OTIS_LAND = { x: 990, y: 618 };
  const LAND = { x: 404, y: 640 };     // là où Henry amène le poisson
  const MIDROCK = { x: 512, y: 514 };
  const HOLE = { x: 662, y: 444 };
  const SESSION = 150;                 // secondes de pêche effective
  const MAX_TRIES = 7, MAX_CATCH = 4;
  const CHARGE_PERIOD = 2.4;           // aller-retour complet de la jauge de puissance
  const BITE_WINDOW = 0.7;
  const RED = 0.88, SLACK = 0.14;
  const PANEL = { x: 470, y: 628, w: 480, h: 80 };

  // ------------------------------------------------------------------ espèces
  const SPECIES = {
    crapet: { name: 'Crapet', halves: 1, len: [5, 7], shadow: 40, hr: 0.29, pull: 0.26, every: [1.8, 2.8], reel: 0.3, hold: 0.6, green: [0.3, 0.74] },
    perche: { name: 'Perche', halves: 2, len: [8, 11], shadow: 50, hr: 0.17, pull: 0.32, every: [1.5, 2.5], reel: 0.23, hold: 0.66, green: [0.33, 0.72] },
    achigan: { name: 'Achigan', halves: 3, len: [12, 16], shadow: 60, hr: 0.2, pull: 0.37, every: [1.3, 2.2], reel: 0.2, hold: 0.72, green: [0.36, 0.7], jumps: true },
    barbue: { name: 'Barbue', halves: 4, len: [18, 24], shadow: 92, hr: 0.13, pull: 0.42, every: [1.3, 2.1], reel: 0.18, hold: 0.78, green: [0.38, 0.68] },
    chaussure: { name: 'une vieille chaussure', title: 'Une vieille chaussure', halves: 0, len: [9, 9], shadow: 0, pull: 0, every: [99, 99], reel: 0.2, hold: 0.66, green: [0.28, 0.76] },
  };
  const FISHCOL = {
    crapet: { back: '#56653A', belly: '#D08A3A', fin: '#4A5632', mark: 'rgba(28,36,18,0.32)' },
    perche: { back: '#B39033', belly: '#E6D592', fin: '#C2682C', mark: 'rgba(52,46,20,0.75)' },
    achigan: { back: '#6C6036', belly: '#CDBE8E', fin: '#655631', mark: 'rgba(44,36,18,0.45)' },
    barbue: { back: '#5A656E', belly: '#CFD1C8', fin: '#4B555D', mark: 'rgba(30,34,40,0.8)' },
  };
  // Coins de pêche, repérés le long de l'axe du lancer (t de 0 à 1).
  const SPOTS = {
    gue: { t: 0.15, dx: -12, r: 24, pool: [['crapet', 1]] },
    rocher: { t: 0.45, dx: 10, r: 22, pool: [['perche', 3], ['crapet', 1], ['achigan', 1.3]] },
    trou: { t: 0.8, dx: 0, r: 30, pool: [['achigan', 2], ['perche', 1]] },
  };
  const spotCenter = (k) => { const s = SPOTS[k], p = castPt(s.t); return { x: p.x + s.dx, y: p.y }; };

  // ------------------------------------------------------------------ petits outils
  const NUM = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze'];
  const bowls = (h) => {
    if (h <= 0) return 'rien';
    if (h === 1) return 'un demi-bol';
    const b = Math.floor(h / 2);
    const base = b === 1 ? 'un bol' : `${NUM[b] || b} bols`;
    return h % 2 ? `${base} et demi` : base;
  };
  const press = () => I.pressed || I.hit('Space') || I.hit('Enter') || I.hit('KeyE');
  const holding = () => I.down || I.key('Space') || I.key('Enter') || I.key('KeyE');
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  // Distance « au sol » sur le plan d'eau, corrigée de la perspective.
  const gdist = (ax, ay, bx, by) => { const s = persp((ay + by) / 2); return Math.hypot((ax - bx) / s, (ay - by) / (s * SQ)); };
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const weighted = (pool) => {
    let sum = 0; for (const [, w] of pool) sum += w;
    let r = Math.random() * sum;
    for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
    return pool[0][0];
  };
  // Chemin fermé lissé passant par les milieux des points.
  const blob = (pts) => {
    const p = new Path2D();
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    p.closePath();
    return p;
  };

  // ------------------------------------------------------------------ dessins : poissons, chaussure, bols
  // Poisson de profil, tête vers la droite, centré en (x, y).
  function drawFish(ctx, kind, x, y, len, o = {}) {
    if (kind === 'chaussure') { drawShoe(ctx, x, y, len, o); return; }
    const sp = SPECIES[kind], col = FISHCOL[kind];
    const L = len, H = L * sp.hr;
    const tb = -L * 0.33;
    const wag = o.wag || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineJoin = 'round';
    // queue
    ctx.fillStyle = col.fin;
    ctx.save();
    ctx.translate(tb + 2, 0);
    ctx.rotate(wag);
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.15);
    if (kind === 'barbue') {
      ctx.lineTo(-L * 0.2, -H * 1.25);
      ctx.lineTo(-L * 0.1, 0);
      ctx.lineTo(-L * 0.2, H * 1.25);
    } else {
      const th = kind === 'crapet' ? H * 0.75 : H * 1.05;
      ctx.quadraticCurveTo(-L * 0.08, -th * 0.5, -L * 0.19, -th);
      ctx.quadraticCurveTo(-L * 0.13, 0, -L * 0.19, th);
      ctx.quadraticCurveTo(-L * 0.08, th * 0.5, 0, H * 0.15);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // nageoires dorsales et anale
    ctx.beginPath();
    if (kind === 'perche') {
      ctx.moveTo(L * 0.2, -H * 0.85); ctx.lineTo(L * 0.12, -H * 1.55); ctx.lineTo(-L * 0.02, -H * 1.45); ctx.lineTo(-L * 0.06, -H * 0.95);
      ctx.moveTo(-L * 0.08, -H * 0.9); ctx.lineTo(-L * 0.12, -H * 1.35); ctx.lineTo(-L * 0.24, -H * 1.0); ctx.lineTo(-L * 0.24, -H * 0.55);
    } else if (kind === 'barbue') {
      ctx.moveTo(L * 0.14, -H * 0.9); ctx.lineTo(L * 0.06, -H * 1.75); ctx.lineTo(-L * 0.02, -H * 0.95);
      ctx.moveTo(-L * 0.2, -H * 0.62); ctx.lineTo(-L * 0.25, -H * 0.95); ctx.lineTo(-L * 0.28, -H * 0.42);
    } else {
      // nageoire épineuse : une dentelure de rayons
      ctx.moveTo(L * 0.2, -H * 0.85);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const fx = L * (0.16 - i * 0.055);
        const top = -H * (1.42 - Math.abs(i - 3) * 0.06);
        ctx.lineTo(fx, top);
        ctx.lineTo(fx - L * 0.022, top + H * 0.2);
      }
      ctx.quadraticCurveTo(-L * 0.24, -H * 1.0, -L * 0.27, -H * 0.45);
    }
    ctx.moveTo(-L * 0.05, H * 0.85); ctx.lineTo(-L * 0.15, H * 1.25); ctx.lineTo(-L * 0.25, H * 0.65);
    ctx.fill();
    // corps
    const body = new Path2D();
    body.moveTo(L * 0.5, H * 0.08);
    body.bezierCurveTo(L * 0.44, -H * 0.85, L * 0.08, -H * 1.08, -L * 0.16, -H * 0.8);
    body.quadraticCurveTo(-L * 0.29, -H * 0.45, tb, -H * 0.2);
    body.lineTo(tb, H * 0.2);
    body.quadraticCurveTo(-L * 0.29, H * 0.45, -L * 0.16, H * 0.78);
    body.bezierCurveTo(L * 0.08, H * 1.06, L * 0.44, H * 0.88, L * 0.5, H * 0.08);
    body.closePath();
    ctx.fillStyle = col.back;
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = col.belly;
    ctx.beginPath(); ctx.ellipse(L * 0.04, H * 1.0, L * 0.5, H * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col.mark;
    if (kind === 'perche') {
      for (let i = 0; i < 6; i++) {
        const bx = L * 0.24 - i * L * 0.085;
        ctx.beginPath(); ctx.moveTo(bx - L * 0.02, -H * 1.2); ctx.lineTo(bx + L * 0.02, -H * 1.2); ctx.lineTo(bx - L * 0.005, H * 0.45); ctx.lineTo(bx - L * 0.035, H * 0.45); ctx.fill();
      }
    } else if (kind === 'crapet') {
      for (let i = 0; i < 6; i++) { const bx = L * 0.22 - i * L * 0.08; ctx.fillRect(bx - L * 0.022, -H * 1.2, L * 0.044, H * 2.0); }
      ctx.fillStyle = '#B0552A'; ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.ellipse(L * 0.28, H * 0.55, L * 0.12, H * 0.32, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha /= 0.55;
    } else if (kind === 'achigan') {
      for (let i = 0; i < 7; i++) {
        const bx = L * 0.2 - i * L * 0.075;
        ctx.beginPath(); ctx.ellipse(bx, -H * 0.15, L * 0.022, H * 0.62, 0.15, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(40,32,16,0.5)'; ctx.lineWidth = Math.max(1, L * 0.012);
      ctx.beginPath(); ctx.moveTo(L * 0.44, -H * 0.05); ctx.lineTo(L * 0.3, H * 0.1); ctx.stroke();
    } else if (kind === 'barbue') {
      const rnd = U.rng(9);
      for (let i = 0; i < 14; i++) {
        ctx.beginPath(); ctx.arc(L * (0.25 - rnd() * 0.5), -H * (0.7 - rnd() * 1.0), Math.max(0.8, L * 0.011), 0, TAU); ctx.fill();
      }
    }
    // dos plus sombre
    ctx.fillStyle = 'rgba(20,18,12,0.18)';
    ctx.beginPath(); ctx.ellipse(L * 0.02, -H * 1.0, L * 0.55, H * 0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // ouïe, œil, bouche
    ctx.strokeStyle = 'rgba(20,16,10,0.45)';
    ctx.lineWidth = Math.max(1, L * 0.012);
    ctx.beginPath(); ctx.arc(L * 0.42, 0, H * 0.75, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
    if (kind === 'crapet') { ctx.fillStyle = '#1C2016'; ctx.beginPath(); ctx.ellipse(L * 0.27, -H * 0.12, L * 0.035, H * 0.16, 0, 0, TAU); ctx.fill(); }
    const er = Math.max(1.2, L * (kind === 'barbue' ? 0.022 : 0.035));
    ctx.fillStyle = kind === 'achigan' ? '#A8432A' : '#F0E6CC';
    ctx.beginPath(); ctx.arc(L * 0.39, -H * 0.3, er, 0, TAU); ctx.fill();
    ctx.fillStyle = '#16120E';
    ctx.beginPath(); ctx.arc(L * 0.395, -H * 0.3, er * 0.55, 0, TAU); ctx.fill();
    // nageoire pectorale
    ctx.fillStyle = col.fin;
    ctx.globalAlpha *= 0.85;
    ctx.beginPath(); ctx.moveTo(L * 0.3, H * 0.25); ctx.quadraticCurveTo(L * 0.18, H * 0.3, L * 0.14, H * 0.62); ctx.quadraticCurveTo(L * 0.24, H * 0.55, L * 0.3, H * 0.25); ctx.fill();
    ctx.globalAlpha /= 0.85;
    if (kind === 'barbue') {
      ctx.strokeStyle = '#3A4248'; ctx.lineWidth = Math.max(1, L * 0.008); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(L * 0.49, H * 0.0); ctx.quadraticCurveTo(L * 0.6, H * 0.2, L * 0.62, H * 1.0);
      ctx.moveTo(L * 0.47, H * 0.2); ctx.quadraticCurveTo(L * 0.52, H * 0.8, L * 0.46, H * 1.4);
      ctx.moveTo(L * 0.46, -H * 0.35); ctx.quadraticCurveTo(L * 0.58, -H * 0.9, L * 0.66, -H * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  // La vieille chaussure : bout vers la droite.
  function drawShoe(ctx, x, y, len, o = {}) {
    const L = len;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    // semelle
    ctx.fillStyle = '#2A1E16';
    ctx.beginPath();
    ctx.moveTo(-L * 0.46, L * 0.12); ctx.lineTo(L * 0.42, L * 0.12);
    ctx.quadraticCurveTo(L * 0.52, L * 0.1, L * 0.5, L * 0.03);
    ctx.lineTo(-L * 0.46, L * 0.03); ctx.closePath(); ctx.fill();
    ctx.fillRect(-L * 0.46, L * 0.1, L * 0.18, L * 0.06);
    // tige et empeigne
    ctx.fillStyle = '#6A4A30';
    ctx.beginPath();
    ctx.moveTo(-L * 0.44, L * 0.04);
    ctx.lineTo(-L * 0.42, -L * 0.36);
    ctx.lineTo(-L * 0.12, -L * 0.36);
    ctx.lineTo(-L * 0.06, -L * 0.12);
    ctx.quadraticCurveTo(L * 0.3, -L * 0.12, L * 0.48, L * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(30,20,12,0.35)';
    ctx.beginPath(); ctx.ellipse(-L * 0.27, -L * 0.36, L * 0.15, L * 0.04, 0, 0, TAU); ctx.fill();
    // lacets
    ctx.strokeStyle = '#C9B48A'; ctx.lineWidth = Math.max(1, L * 0.015);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const lx = -L * 0.11 + i * L * 0.06, ly = -L * 0.3 + i * L * 0.055; ctx.moveTo(lx - L * 0.04, ly); ctx.lineTo(lx + L * 0.04, ly + L * 0.03); }
    ctx.moveTo(-L * 0.1, -L * 0.32); ctx.quadraticCurveTo(-L * 0.05, -L * 0.48, L * 0.04, -L * 0.42);
    ctx.stroke();
    // trou au bout
    ctx.fillStyle = '#1C140E';
    ctx.beginPath(); ctx.ellipse(L * 0.3, -L * 0.02, L * 0.045, L * 0.03, -0.3, 0, TAU); ctx.fill();
    // gouttes
    if (o.drip) {
      ctx.fillStyle = 'rgba(200,220,228,0.8)';
      for (let i = 0; i < 3; i++) {
        const k = ((G.time * 1.3 + i / 3) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(-L * 0.2 + i * L * 0.22, L * 0.14 + k * L * 0.18, Math.max(1, L * 0.016), 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Rangée de bols : chaque bol plein vaut deux demi-bols.
  function drawBowls(ctx, cx, y, halves, size = 26) {
    const n = Math.max(1, Math.ceil(halves / 2));
    const gap = size * 1.35;
    let x = cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const fill = halves <= 0 ? 0 : (i < Math.floor(halves / 2) ? 1 : 0.5);
      ctx.save();
      ctx.translate(x, y);
      const bowl = new Path2D();
      bowl.moveTo(-size * 0.5, -size * 0.1);
      bowl.quadraticCurveTo(-size * 0.48, size * 0.42, 0, size * 0.42);
      bowl.quadraticCurveTo(size * 0.48, size * 0.42, size * 0.5, -size * 0.1);
      bowl.closePath();
      ctx.fillStyle = '#CDBFA2';
      ctx.fill(bowl);
      if (fill > 0) {
        ctx.save();
        ctx.clip(bowl);
        ctx.fillStyle = '#9C5A2A';
        const top = fill >= 1 ? -size * 0.1 : size * 0.16;
        ctx.fillRect(-size * 0.6, top, size * 1.2, size);
        ctx.restore();
      }
      ctx.strokeStyle = '#5C4A33'; ctx.lineWidth = 1.6;
      ctx.stroke(bowl);
      ctx.beginPath(); ctx.ellipse(0, -size * 0.1, size * 0.5, size * 0.1, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      x += gap;
    }
  }

  // Panier de pêche en osier (de face).
  function drawCreel(ctx, x, y, w, catches, o = {}) {
    const h = w * 0.82;
    ctx.save();
    ctx.translate(x, y);
    // queues qui dépassent
    catches.forEach((c, i) => {
      const k = catches.length > 1 ? i / (catches.length - 1) - 0.5 : 0;
      const tx = k * w * 0.6, y0 = -h - w * 0.02;
      ctx.save();
      ctx.translate(tx, y0);
      ctx.rotate(k * 0.8 + Math.sin(i * 2.3) * 0.12);
      if (c.kind === 'chaussure') {
        ctx.fillStyle = '#6A4A30';
        ctx.fillRect(-w * 0.08, -w * 0.26, w * 0.16, w * 0.3);
        ctx.fillStyle = '#2A1E16';
        ctx.fillRect(-w * 0.1, -w * 0.3, w * 0.2, w * 0.06);
      } else {
        ctx.fillStyle = FISHCOL[c.kind].fin;
        ctx.fillRect(-w * 0.05, -w * 0.14, w * 0.1, w * 0.2);
        ctx.beginPath(); ctx.moveTo(0, -w * 0.1); ctx.lineTo(-w * 0.14, -w * 0.34); ctx.lineTo(0, -w * 0.24); ctx.lineTo(w * 0.14, -w * 0.34); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    // corps
    const body = new Path2D();
    body.moveTo(-w * 0.5, -h);
    body.lineTo(w * 0.5, -h);
    body.lineTo(w * 0.44, -h * 0.08);
    body.quadraticCurveTo(w * 0.42, 0, w * 0.3, 0);
    body.lineTo(-w * 0.3, 0);
    body.quadraticCurveTo(-w * 0.42, 0, -w * 0.44, -h * 0.08);
    body.closePath();
    ctx.fillStyle = o.color || '#8C6A48';
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    ctx.strokeStyle = 'rgba(50,34,20,0.55)';
    ctx.lineWidth = Math.max(1, w * 0.03);
    for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-w, -h + i * h / 7); ctx.lineTo(w, -h + i * h / 7); ctx.stroke(); }
    ctx.lineWidth = Math.max(1, w * 0.02);
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.09, -h); ctx.lineTo(i * w * 0.085, 0); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,230,180,0.12)';
    ctx.fillRect(w * 0.1, -h, w * 0.4, h);
    ctx.restore();
    // rebord et sangle
    ctx.fillStyle = o.rim || '#6A4A2E';
    ctx.beginPath(); ctx.roundRect(-w * 0.54, -h - w * 0.06, w * 1.08, w * 0.1, w * 0.04); ctx.fill();
    ctx.strokeStyle = '#4A3420'; ctx.lineWidth = Math.max(1.5, w * 0.05);
    ctx.beginPath(); ctx.moveTo(-w * 0.42, -h); ctx.quadraticCurveTo(0, -h - w * 0.75, w * 0.42, -h); ctx.stroke();
    ctx.restore();
  }

  // Bouchon rouge et blanc (enfoncé de « sink » : 0 = posé, 1 = sous l'eau).
  function drawBobber(ctx, x, y, s, sink = 0, tilt = 0) {
    const r = 10.5 * s;
    ctx.save();
    // creux dans l'eau
    ctx.fillStyle = 'rgba(16,24,26,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.15, r * 1.25, r * 1.25 * SQ * 0.55, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.rect(x - r * 4, y - r * 6, r * 8, r * 6 + r * 0.15); ctx.clip();
    ctx.translate(x, y + sink * r * 2.6);
    ctx.rotate(tilt);
    ctx.strokeStyle = '#1E1814'; ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 1.9); ctx.stroke();
    ctx.fillStyle = '#EDE6D6';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#B5321E';
    ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.6)';
    ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.45, r * 0.25, 0, TAU); ctx.fill();
    ctx.restore();
    // ligne de flottaison
    if (sink < 0.95) {
      ctx.strokeStyle = 'rgba(235,228,210,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.15, r * 1.15 * SQ * 0.5, 0, 0, Math.PI); ctx.stroke();
    }
  }

  // Scion de la canne (même calcul que drawRod) : sert à tracer la ligne avant la canne.
  function rodTip(hand, ang, len, to, bend) {
    let tip = { x: hand.x + Math.cos(ang) * len, y: hand.y + Math.sin(ang) * len };
    if (to && bend > 0) {
      const bx = to.x - tip.x, by = to.y - tip.y, bl = Math.hypot(bx, by) || 1;
      const k = U.clamp(bend, 0, 1.2) * len * 0.3;
      tip = { x: tip.x + (bx / bl) * k, y: tip.y + (by / bl) * k };
    }
    return tip;
  }
  // Canne : renvoie le scion. ang = angle à l'écran, bend vers « to ».
  function drawRod(ctx, hand, ang, len, to, bend) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const butt = { x: hand.x - dx * 30, y: hand.y - dy * 30 };
    let tip = { x: hand.x + dx * len, y: hand.y + dy * len };
    let ctrl = { x: hand.x + dx * len * 0.55, y: hand.y + dy * len * 0.55 };
    if (to && bend > 0) {
      const bx = to.x - tip.x, by = to.y - tip.y, bl = Math.hypot(bx, by) || 1;
      const k = U.clamp(bend, 0, 1.2) * len * 0.3;
      tip = { x: tip.x + (bx / bl) * k, y: tip.y + (by / bl) * k };
      ctrl = { x: ctrl.x + (bx / bl) * k * 0.15, y: ctrl.y + (by / bl) * k * 0.15 };
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2E2219';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y); ctx.stroke();
    // moulinet
    ctx.fillStyle = '#4C4136';
    ctx.beginPath(); ctx.arc(hand.x - dx * 16 - dy * 5, hand.y - dy * 16 + dx * 5, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
    return tip;
  }

  function drawLine(ctx, a, b, sag, alpha = 0.62) {
    ctx.save();
    ctx.strokeStyle = `rgba(240,232,214,${alpha})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  // Texte à contour (exclamations).
  function shout(ctx, text, x, y, size, color, alpha = 1, scale = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = ui.font(size, 'hand', '600');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.12);
    ctx.strokeStyle = 'rgba(18,13,10,0.88)';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // ------------------------------------------------------------------ décors (mis en cache)
  let RIDGE1 = null, RIDGE2 = null;
  function ridges() {
    if (!RIDGE1) {
      RIDGE1 = G.art.makeRidge(11, G.W, 212, 42, 160);
      RIDGE2 = G.art.makeRidge(23, G.W, 262, 16, 120);
    }
  }
  const sunEnd = () => { ridges(); return { x: 958, y: G.art.ridgeY(RIDGE1, 958) + 36 }; };
  const SUN0 = { x: 900, y: 96 };

  function bankLayer() {
    ridges();
    return G.art.cached('fish:bank', G.W, BANK_Y + 8, (cx, w, h) => {
      // crête boisée intermédiaire
      G.art.ridge(cx, RIDGE2, '#76604A', h);
      G.art.dots(cx, 21, 700, 0, w, (x) => { const y = G.art.ridgeY(RIDGE2, x); return [y + 3, y + 60]; },
        ['#8A4A26', '#A0612C', '#B8803A', '#7A5A34', '#6E6A3C', '#9C4A22'], 4, 9, 0.55, 0.9);
      cx.fillStyle = 'rgba(232,200,150,0.18)';
      cx.fillRect(0, 250, w, h - 250);
      // berge d'en face
      cx.fillStyle = '#4C3C2B';
      cx.beginPath();
      cx.moveTo(0, BANK_Y - 10);
      for (let x = 0; x <= w; x += 40) cx.lineTo(x, BANK_Y - 10 - Math.sin(x * 0.013) * 4 - Math.sin(x * 0.05) * 2);
      cx.lineTo(w, h); cx.lineTo(0, h); cx.closePath(); cx.fill();
      // banc de galets sous le soleil
      G.art.dots(cx, 31, 90, 850, 1040, () => [BANK_Y - 9, BANK_Y + 2], ['#A89878', '#8C7C62', '#BBAA88'], 2, 5, 0.7, 1);
      const rnd = U.rng(5);
      const trunk = '#3B2E22';
      const leaves = [P.rust, P.ochre, P.gold, '#9C4A22', '#C98F3A', '#B5562A'];
      let x = -30;
      while (x < w + 40) {
        if (x > 850 && x < 1030) {
          // buissons bas : on garde le soleil visible
          G.art.dots(cx, Math.floor(x), 30, x - 18, x + 18, () => [BANK_Y - 34, BANK_Y - 8], ['#7A3A1E', '#9C5A2A', '#6E5A32'], 4, 8);
          x += 40 + rnd() * 30;
          continue;
        }
        const r = rnd();
        if (r < 0.16) {
          // pruche sombre
          const th = 90 + rnd() * 60;
          cx.fillStyle = '#2F3A2C';
          cx.beginPath();
          cx.moveTo(x, BANK_Y - 8 - th);
          for (let i = 1; i <= 5; i++) {
            const yy = BANK_Y - 8 - th + (th * i) / 5.4;
            cx.lineTo(x + (th * 0.1) * (0.5 + i * 0.5), yy);
            cx.lineTo(x + (th * 0.04) * (0.5 + i * 0.4), yy - 4);
          }
          cx.lineTo(x + th * 0.2, BANK_Y - 10);
          cx.lineTo(x - th * 0.2, BANK_Y - 10);
          for (let i = 5; i >= 1; i--) {
            const yy = BANK_Y - 8 - th + (th * i) / 5.4;
            cx.lineTo(x - (th * 0.04) * (0.5 + i * 0.4), yy - 4);
            cx.lineTo(x - (th * 0.1) * (0.5 + i * 0.5), yy);
          }
          cx.closePath(); cx.fill();
        } else {
          const th = 80 + rnd() * 95;
          G.art.tree(cx, x, BANK_Y - 6, th, trunk, leaves, Math.floor(rnd() * 1000));
        }
        x += 30 + rnd() * 46;
      }
    });
  }

  function reflLayer() {
    return G.art.cached('fish:refl', G.W, 230, (cx, w, h) => {
      const bank = bankLayer();
      cx.save();
      cx.filter = 'blur(2px)';
      cx.scale(1, -0.9);
      cx.translate(0, -BANK_Y - 2);
      cx.drawImage(bank.c, 0, 0, bank.w, bank.h);
      cx.restore();
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = 'rgba(40,52,56,0.35)';
      cx.fillRect(0, 0, w, h);
      cx.globalCompositeOperation = 'destination-out';
      const rnd = U.rng(8);
      for (let i = 0; i < 160; i++) {
        const y = rnd() * h, x = rnd() * w;
        cx.globalAlpha = 0.25 + rnd() * 0.5;
        cx.fillRect(x, y, 40 + rnd() * 160, 1 + rnd() * 2);
      }
      cx.globalAlpha = 1;
      const g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      cx.globalCompositeOperation = 'source-over';
    });
  }

  function waterLayer() {
    return G.art.cached('fish:water', G.W, G.H - BANK_Y, (cx, w, h) => {
      const g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#B7A47A');
      g.addColorStop(0.16, '#8E8E78');
      g.addColorStop(0.5, '#5A706A');
      g.addColorStop(1, '#2F4344');
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      // trou d'eau profond
      cx.save();
      cx.translate(HOLE.x, HOLE.y - BANK_Y);
      cx.scale(1, 0.3);
      const hg = cx.createRadialGradient(0, 0, 10, 0, 0, 150);
      hg.addColorStop(0, 'rgba(18,34,40,0.62)');
      hg.addColorStop(0.6, 'rgba(22,40,46,0.38)');
      hg.addColorStop(1, 'rgba(30,48,52,0)');
      cx.fillStyle = hg;
      cx.beginPath(); cx.arc(0, 0, 150, 0, TAU); cx.fill();
      cx.restore();
      // une vieille branche couchée au fond, et des galets dans le haut-fond
      cx.save();
      cx.globalAlpha = 0.28;
      cx.strokeStyle = '#1E2A28'; cx.lineCap = 'round';
      cx.lineWidth = 11;
      cx.beginPath(); cx.moveTo(690, 334); cx.quadraticCurveTo(770, 318, 880, 326); cx.stroke();
      cx.lineWidth = 5;
      cx.beginPath(); cx.moveTo(760, 322); cx.lineTo(800, 300); cx.moveTo(830, 324); cx.lineTo(872, 344); cx.stroke();
      cx.restore();
      const pr = U.rng(19);
      for (let i = 0; i < 9; i++) {
        const px = 430 + pr() * 520, py = 300 + pr() * 70, r = 5 + pr() * 9;
        cx.fillStyle = `rgba(${pr() < 0.5 ? '96,104,88' : '120,112,90'},0.32)`;
        cx.beginPath(); cx.ellipse(px, py, r, r * 0.45, 0, 0, TAU); cx.fill();
      }
      // reflets du ciel en bandes
      const rnd = U.rng(3);
      for (let i = 0; i < 90; i++) {
        const y = Math.pow(rnd(), 1.6) * h;
        const s = persp(y + BANK_Y);
        cx.fillStyle = `rgba(230,214,170,${0.05 + rnd() * 0.06})`;
        cx.fillRect(rnd() * w, y, (30 + rnd() * 120) * s, 1.5 * s + 0.5);
      }
    });
  }

  function nearLayer() {
    return G.art.cached('fish:near', G.W, G.H, (cx) => {
      // le rocher d'Henry
      const rockH = [[70, 730], [84, 660], [118, 616], [176, 600], [252, 602], [292, 628], [330, 676], [350, 740]];
      paintRock(cx, rockH, 1);
      // le rocher d'Otis
      const rockO = [[976, 740], [994, 680], [1032, 630], [1090, 604], [1176, 608], [1224, 636], [1262, 700], [1270, 740]];
      paintRock(cx, rockO, -1);
      // berges proches (coins)
      cx.fillStyle = '#3A2E22';
      cx.beginPath(); cx.moveTo(0, 590); cx.quadraticCurveTo(60, 600, 96, 650); cx.lineTo(110, 720); cx.lineTo(0, 720); cx.fill();
      cx.beginPath(); cx.moveTo(1280, 600); cx.quadraticCurveTo(1250, 640, 1246, 720); cx.lineTo(1280, 720); cx.fill();
      G.art.dots(cx, 61, 60, 0, 100, (x) => [600 + x * 0.3, 720], ['#7A2E1A', '#B8732A', '#D9A441', '#5C4A33'], 3, 6, 0.7, 1);
      // herbes sèches et roseaux
      const reeds = (x0, x1, seed, lean) => {
        const rnd = U.rng(seed);
        for (let i = 0; i < 26; i++) {
          const x = x0 + rnd() * (x1 - x0), hh = 40 + rnd() * 90, b = 720;
          cx.strokeStyle = rnd() < 0.5 ? '#6A5434' : '#8A6A3A';
          cx.lineWidth = 1.5 + rnd() * 1.5;
          cx.beginPath(); cx.moveTo(x, b); cx.quadraticCurveTo(x + lean * hh * 0.1, b - hh * 0.6, x + lean * hh * (0.25 + rnd() * 0.2), b - hh); cx.stroke();
          if (rnd() < 0.25) {
            cx.fillStyle = '#4A3424';
            cx.beginPath(); cx.ellipse(x + lean * hh * 0.2, b - hh * 0.92, 2.5, 7, lean * 0.3, 0, TAU); cx.fill();
          }
        }
      };
      reeds(0, 70, 4, 0.6);
      reeds(1236, 1280, 7, -0.6);
      // boîte à vers (fer-blanc)
      cx.fillStyle = '#5A6670';
      cx.fillRect(138, 590, 18, 18);
      cx.fillStyle = '#3A444C'; cx.beginPath(); cx.ellipse(147, 590, 9, 3, 0, 0, TAU); cx.fill();
      cx.fillStyle = 'rgba(220,230,235,0.35)'; cx.fillRect(152, 592, 2, 14);
      // seau d'Otis
      cx.fillStyle = '#6E6A64';
      cx.beginPath(); cx.moveTo(1158, 578); cx.lineTo(1190, 578); cx.lineTo(1186, 606); cx.lineTo(1162, 606); cx.closePath(); cx.fill();
      cx.fillStyle = '#3E3A36'; cx.beginPath(); cx.ellipse(1174, 578, 16, 4, 0, 0, TAU); cx.fill();
      cx.strokeStyle = '#3a3632'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(1174, 580, 15, Math.PI * 1.05, Math.PI * 1.95); cx.stroke();
      cx.fillStyle = 'rgba(255,230,180,0.15)'; cx.fillRect(1160, 580, 6, 25);
    });
  }

  function paintRock(cx, pts, side) {
    const path = blob(pts);
    cx.save();
    cx.fillStyle = '#9A8768';
    cx.fill(path);
    cx.clip(path);
    cx.save();
    cx.translate(-side * 7, 11);
    cx.fillStyle = '#6A5C4B';
    cx.fill(path);
    cx.restore();
    // ombre du bas
    const g = cx.createLinearGradient(0, 600, 0, 720);
    g.addColorStop(0, 'rgba(30,24,18,0)');
    g.addColorStop(1, 'rgba(30,24,18,0.55)');
    cx.fillStyle = g;
    cx.fillRect(0, 560, G.W, 200);
    // lumière du soleil couchant sur la face éclairée
    const xs = pts.map((p) => p[0]);
    const lx = side > 0 ? Math.max(...xs) : Math.min(...xs);
    const lg = cx.createLinearGradient(lx, 0, lx - side * 90, 0);
    lg.addColorStop(0, 'rgba(232,170,90,0.42)');
    lg.addColorStop(1, 'rgba(232,170,90,0)');
    cx.fillStyle = lg;
    cx.fillRect(0, 560, G.W, 200);
    // texture
    G.art.dots(cx, Math.floor(pts[0][0]), 90, Math.min(...xs), Math.max(...xs), () => [596, 720], ['#4E4438', '#857560', '#5C5042'], 1, 3, 0.3, 0.6);
    cx.strokeStyle = 'rgba(40,32,24,0.45)'; cx.lineWidth = 1.5;
    const rnd = U.rng(Math.floor(pts[1][0]));
    for (let i = 0; i < 4; i++) {
      const x = U.lerp(Math.min(...xs) + 30, Math.max(...xs) - 30, rnd()), y = 640 + rnd() * 50;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + (rnd() - 0.5) * 30, y + 14 + rnd() * 20); cx.stroke();
    }
    // mousse
    G.art.dots(cx, Math.floor(pts[2][0]), 26, Math.min(...xs) + 20, Math.max(...xs) - 20, () => [600, 620], ['#5E6A34', '#6E7A3A', '#4E5A2E'], 2, 4, 0.6, 0.9);
    cx.restore();
    // clapotis au pied du rocher
    cx.strokeStyle = 'rgba(235,230,215,0.3)'; cx.lineWidth = 1.5;
    const foot = side > 0 ? [[338, 700], [352, 716]] : [[984, 700], [972, 716]];
    for (const [x, y] of foot) {
      cx.beginPath(); cx.ellipse(x + side * 6, y, 18, 3, 0, side > 0 ? -0.4 : Math.PI + 0.4, side > 0 ? 1.6 : Math.PI - 1.6, side < 0); cx.stroke();
    }
  }

  // ------------------------------------------------------------------ ombres de poissons
  function makeShadow(sp, spot, x, y) {
    return { sp, spot, x, y, tx: x, ty: y, ang: U.rand(0, TAU), v: 0, wig: U.rand(0, TAU), retarget: U.rand(0.5, 2.5),
      alpha: 0, vis: 1, state: 'wander', timer: 0, nudge: 0, rare: false };
  }
  function spotPoint(k) {
    const c = spotCenter(k), s = persp(c.y), r = SPOTS[k].r * Math.sqrt(Math.random()), a = U.rand(0, TAU);
    return { x: c.x + Math.cos(a) * r * s, y: c.y + Math.sin(a) * r * s * SQ };
  }
  // Oriente et avance une ombre vers (gx, gy). Vitesse en unités « au sol » par seconde.
  function steer(f, gx, gy, spd, dt) {
    const s = persp(f.y);
    const dx = (gx - f.x) / s, dz = (gy - f.y) / (s * SQ);
    const d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.8) {
      const da = angDiff(f.ang, Math.atan2(dz, dx));
      f.ang += U.clamp(da, -3.2 * dt, 3.2 * dt);
      v = Math.min(spd, d * 2.2) * Math.max(0.15, Math.cos(da));
      f.x += Math.cos(f.ang) * v * s * dt;
      f.y += Math.sin(f.ang) * v * s * SQ * dt;
    }
    f.v = v;
    return d;
  }
  function drawShadow(ctx, f, t) {
    if (f.alpha <= 0.01) return;
    const s = persp(f.y);
    const L = SPECIES[f.sp].shadow;
    const wag = Math.sin(t * (3.5 + f.v * 0.2) + f.wig) * (0.22 + Math.min(0.4, f.v * 0.012));
    const push = f.nudge * 7;
    ctx.save();
    ctx.translate(f.x + Math.cos(f.ang) * push * s, f.y + Math.sin(f.ang) * push * s * SQ);
    ctx.scale(s, s * SQ);
    ctx.rotate(f.ang);
    const deep = f.rare ? 0.8 : 1;
    ctx.fillStyle = '#0F1A1D';
    for (const [k, a] of [[1.3, 0.18], [1, 0.5]]) {
      ctx.globalAlpha = f.alpha * a * deep;
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5 * k, L * 0.16 * k, 0, 0, TAU); ctx.fill();
      ctx.save();
      ctx.translate(-L * 0.44, 0); ctx.rotate(wag);
      ctx.beginPath(); ctx.moveTo(L * 0.05, 0); ctx.lineTo(-L * 0.24 * k, -L * 0.15 * k); ctx.lineTo(-L * 0.24 * k, L * 0.15 * k); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(L * 0.12, 0, L * 0.06, L * 0.3 * k, 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ la scène
  G.Scenes.fishing = (opts = {}) => G.makeScene({
    enter() {
      G.audio.amb(['creek', 'birds', 'wind']);
      ridges();
      bankLayer(); reflLayer(); waterLayer(); nearLayer();
      this.phase = 'aim';
      this.tut = true;             // premier lancer accompagné
      this.clock = 0;              // pêche effective (la minuterie du soleil)
      this.started = false;        // démarre au premier lancer
      this.sunK = 0;
      this.tries = 0;              // tentatives résolues
      this.worms = 0;              // vers utilisés
      this.catches = [];           // { kind, name, halves, size }
      this.shoe = false;
      this.paused = false;         // en attente de « between »
      this.sleeps = [];
      this.pressWait = null;
      this.pops = [];
      this.drops = [];
      this.rings = [];
      this.power = 0;
      this.chargeT = 0;
      this.rodAng = -0.6;
      this.tip = { x: 420, y: 490 };
      this.bob = null;
      this.fly = null;
      this.plan = null;
      this.fight = null;
      this.fpos = null;
      this.lift = null;
      this.card = null;
      this.ended = null;
      this.snapped = null;
      this.yank = null;
      this.noBob = false;
      this.sunNote = false;
      this.hookT = 0;
      this.respawns = [];
      // ombres
      this.shadows = [];
      const add = (sp, spot) => { const p = spotPoint(spot); const f = makeShadow(sp, spot, p.x, p.y); f.alpha = 1; this.shadows.push(f); return f; };
      add('crapet', 'gue'); add('crapet', 'gue');
      add('perche', 'rocher'); add(Math.random() < 0.5 ? 'achigan' : 'perche', 'rocher');
      add('achigan', 'trou');
      const big = add('barbue', 'trou');
      big.rare = true; big.vis = 0.14; big.alpha = 0.14; big.cycle = 9;
      // la surface
      const rnd = U.rng(42);
      this.streaks = [];
      for (let i = 0; i < 34; i++) this.streaks.push({ x: rnd() * 1400 - 60, y: BANK_Y + 10 + Math.pow(rnd(), 0.8) * 370, len: 16 + rnd() * 50, sp: 10 + rnd() * 16, a: 0.05 + rnd() * 0.1 });
      this.leaves = [];
      for (let i = 0; i < 9; i++) this.leaves.push({ x: rnd() * 1300, y: BANK_Y + 30 + rnd() * 330, rot: rnd() * TAU, vr: (rnd() - 0.5) * 0.5, sp: 9 + rnd() * 12, col: P.autumn[i % 5], size: 5 + rnd() * 3 });
      // oiseaux qui passent au loin
      this.birds = [];
      this.nextFlock = 6;
      // Otis
      this.otis = { st: 'idle', t: 0, next: U.rand(15, 20), count: 0, kind: 'crapet' };
    },

    // ---------------------------------------------------------------- outils asynchrones (temps de jeu « vivant »)
    sleep(s) { return new Promise((res) => this.sleeps.push({ left: s, res })); },
    waitPress(max, min = 0.5) { return new Promise((res) => { this.pressWait = { t: 0, max, min, res }; }); },
    pop(text, x, y, o = {}) { this.pops.push(Object.assign({ text, x, y, t: 0, life: 1.7, size: 54, color: P.rim }, o)); },
    splash(x, y, n, power = 1) {
      const s = persp(y);
      for (let i = 0; i < n; i++) {
        this.drops.push({ x: x + U.rand(-6, 6) * s, y, vx: U.rand(-70, 70) * s * power, vy: -U.rand(90, 230) * s * power, life: U.rand(0.35, 0.7), r: U.rand(1.2, 2.6) * s + 0.4, y0: y });
      }
    },
    ring(x, y, max, dur = 1.1, w = 1.4) { this.rings.push({ x, y, t: 0, max, dur, w }); },

    // ---------------------------------------------------------------- boucle
    update(dt) {
      const live = !G.blocked && !this.paused;
      this.animate(dt, live);
      if (!live) return;
      for (let i = this.sleeps.length - 1; i >= 0; i--) {
        const s = this.sleeps[i];
        s.left -= dt;
        if (s.left <= 0) { this.sleeps.splice(i, 1); s.res(); }
      }
      if (this.pressWait) {
        const w = this.pressWait;
        w.t += dt;
        if ((w.t > w.min && press()) || w.t >= w.max) { this.pressWait = null; I.consume(); w.res(); return; }
      }
      const fishing = ['aim', 'charge', 'cast', 'wait', 'bite', 'fight'].includes(this.phase);
      if (this.started && fishing) {
        this.clock += dt;
        if (!this.sunNote && this.clock > SESSION * 0.84) {
          this.sunNote = true;
          ui.toast('Le soleil touche presque la crête.', { color: P.rim });
        }
      }
      switch (this.phase) {
        case 'aim':
          if (this.started && this.clock >= SESSION) { this.endSession('sunset'); break; }
          if (press()) { this.phase = 'charge'; this.chargeT = 0; this.power = 0; this.started = true; }
          break;
        case 'charge':
          this.chargeT += dt;
          this.power = 0.5 - 0.5 * Math.cos((this.chargeT / CHARGE_PERIOD) * TAU);
          if (!holding()) this.cast();
          break;
        case 'cast': {
          const f = this.fly;
          f.t += dt;
          if (f.t >= f.dur) this.land();
          break;
        }
        case 'wait': this.updateWait(dt); break;
        case 'bite':
          this.biteT += dt;
          if (press()) { this.hook(); break; }
          if (this.biteT > BITE_WINDOW) this.resolve('late');
          break;
        case 'fight': this.updateFight(dt); break;
        case 'end':
          this.endT += dt;
          if (this.endT > 0.9 && press()) {
            I.consume();
            this.phase = 'done';
            this.finish(this.result());
          }
          break;
        default: break;
      }
    },

    // Tout ce qui bouge même pendant un dialogue (eau, feuilles, ombres, Otis, particules).
    animate(dt, live) {
      const t = this.t;
      // soleil (visuel)
      const kT = this.phase === 'end' || this.phase === 'done' ? 1 : Math.min(1, this.clock / SESSION);
      this.sunK += (kT - this.sunK) * (1 - Math.exp(-(this.phase === 'end' ? 0.8 : 3) * dt));
      for (const s of this.streaks) {
        s.x += s.sp * persp(s.y) * dt;
        if (s.x > G.W + 60) { s.x = -80; s.y = BANK_Y + 10 + Math.pow(Math.random(), 0.8) * 370; }
      }
      for (const l of this.leaves) {
        l.x += l.sp * persp(l.y) * dt;
        l.rot += l.vr * dt;
        if (l.x > G.W + 30) { l.x = -30; l.y = BANK_Y + 30 + Math.random() * 330; }
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.life -= dt; d.vy += 620 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.life <= 0 || (d.vy > 0 && d.y > d.y0 + 4)) this.drops.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; if (r.t > r.dur) this.rings.splice(i, 1); }
      for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t > p.life) this.pops.splice(i, 1); }
      if (this.card) this.card.t += dt;
      if (this.lift) this.lift.t += dt;
      if (this.yank) this.yank.t += dt;
      const [ra, rate] = this.rodTarget();
      this.rodAng += (ra - this.rodAng) * (1 - Math.exp(-rate * dt));
      if (this.snapped) { this.snapped.t += dt; if (this.snapped.t > 1.2) this.snapped = null; }
      // anneaux réguliers autour du bouchon posé
      if (this.bob && this.phase === 'wait') {
        this.bob.rt = (this.bob.rt || 0) + dt;
        if (this.bob.rt > 1.6) { this.bob.rt = 0; this.ring(this.bob.x, this.bob.y, 16, 1.4, 1); }
      }
      if (this.bob) this.bob.dip = Math.max(0, (this.bob.dip || 0) - dt * 3.2);
      // ombres
      for (let i = this.shadows.length - 1; i >= 0; i--) {
        const f = this.shadows[i];
        f.nudge = Math.max(0, f.nudge - dt * 3);
        if (f.rare && f.state === 'wander' && live) {
          f.cycle -= dt;
          if (f.cycle <= 0) {
            const show = f.vis < 0.5;
            f.vis = show ? 1 : 0.14;
            f.cycle = show ? U.rand(9, 12) : U.rand(11, 17);
          }
        }
        f.alpha += U.clamp(f.vis - f.alpha, -dt * 0.8, dt * 0.8);
        switch (f.state) {
          case 'wander': {
            f.retarget -= dt;
            const d = steer(f, f.tx, f.ty, f.rare ? 7 : 11, dt);
            if (f.retarget <= 0 || d < 3) {
              const p = spotPoint(f.spot);
              f.tx = p.x; f.ty = p.y; f.retarget = U.rand(2, 5);
            }
            break;
          }
          case 'approach': {
            const d = steer(f, f.gx, f.gy, f.aspd, dt);
            if (d < 3) f.state = 'hover';
            break;
          }
          case 'hover': {
            steer(f, f.gx, f.gy, 6, dt);
            if (this.bob) {
              const s = persp(f.y);
              const want = Math.atan2((this.bob.y - f.y) / (s * SQ), (this.bob.x - f.x) / s);
              f.ang += U.clamp(angDiff(f.ang, want), -2 * dt, 2 * dt);
            }
            break;
          }
          case 'flee': {
            steer(f, f.gx, f.gy, 95, dt);
            f.timer -= dt;
            if (f.timer <= 0) { f.vis = 0; f.state = 'away'; f.timer = U.rand(6, 9); }
            break;
          }
          case 'away':
            f.timer -= dt;
            if (f.timer <= 0 && f.alpha < 0.02) {
              if (!f.spot) { this.shadows.splice(i, 1); break; }
              const p = spotPoint(f.spot);
              f.x = p.x; f.y = p.y; f.tx = p.x; f.ty = p.y;
              f.state = 'wander';
              f.vis = f.rare ? 0.14 : 1;
              if (f.rare) f.cycle = U.rand(6, 10);
            }
            break;
          case 'hooked':
            f.vis = 0;
            break;
          default: break;
        }
      }
      // retour des poissons dans les coins
      for (let i = this.respawns.length - 1; i >= 0; i--) {
        const r = this.respawns[i];
        if (t < r.at) continue;
        this.respawns.splice(i, 1);
        const p = spotPoint(r.spot);
        const f = makeShadow(weighted(SPOTS[r.spot].pool), r.spot, p.x, p.y);
        this.shadows.push(f);
      }
      // un vol d'oiseaux de temps en temps
      this.nextFlock -= dt;
      if (this.nextFlock <= 0) {
        this.nextFlock = U.rand(22, 36);
        const n = U.randi(3, 6), y0 = U.rand(110, 190), dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          this.birds.push({ x: dir > 0 ? -30 - i * 26 : G.W + 30 + i * 26, y: y0 + (i % 2) * 12 + i * 3, vx: dir * U.rand(46, 56), ph: Math.random() * TAU, s: U.rand(0.8, 1.1) });
        }
      }
      for (let i = this.birds.length - 1; i >= 0; i--) {
        const b = this.birds[i];
        b.x += b.vx * dt; b.ph += dt * 9;
        if (b.x < -120 || b.x > G.W + 120) this.birds.splice(i, 1);
      }
      this.updateOtis(dt, live);
    },

    // ---------------------------------------------------------------- lancer
    cast() {
      const t = 0.04 + 0.96 * this.power;
      this.castT = t;
      this.phase = 'cast';
      this.worms++;
      const to = castPt(t);
      this.fly = { t: 0, dur: 0.42 + 0.38 * t, from: { x: this.tip.x, y: this.tip.y }, to, h: 70 + 110 * t };
      this.rodAng = -0.25;
      G.audio.sfx('whoosh');
    },
    land() {
      const b = this.fly.to;
      this.fly = null;
      this.bob = { x: b.x, y: b.y, dip: 0, sink: 0, rt: 0 };
      this.phase = 'wait';
      this.wt = 0;
      G.audio.sfx('plop');
      this.ring(b.x, b.y, 30, 1.0, 1.8);
      this.splash(b.x, b.y, 5, 0.6);
      this.plan = this.planBite(b);
      // les autres poissons tout près s'écartent un instant
      for (const f of this.shadows) {
        if (f === this.plan.fish || f.state !== 'wander') continue;
        if (gdist(f.x, f.y, b.x, b.y) < 30) {
          const s = persp(f.y);
          f.tx = f.x + (f.x - b.x) * 1.8 + U.rand(-10, 10) * s;
          f.ty = f.y + (f.y - b.y) * 1.8;
          f.retarget = 2.5;
        }
      }
    },
    // Qui va mordre, et quand. Près d'une ombre : touche rapide, et c'est elle qui mord.
    planBite(b) {
      let best = null, bd = 1e9;
      for (const f of this.shadows) {
        if (f.state !== 'wander' || f.alpha < 0.5) continue;
        const d = gdist(f.x, f.y, b.x, b.y);
        if (d < bd) { bd = d; best = f; }
      }
      const plan = { fish: null, kind: 'crapet', nibs: [], nibIdx: 0, biteAt: 0, size: 0, dist: bd, newcomer: false };
      const shoeOk = !this.shoe && this.tries >= 1;
      let arrive, nib, bias = 0;
      if (best && bd < 50) {
        plan.fish = best; arrive = U.rand(0.8, 1.5); nib = U.randi(1, 2); bias = 0.65;
      } else if (best && bd < 120 && Math.random() < 0.72) {
        plan.fish = best; arrive = U.rand(1.8, 3.0); nib = U.randi(1, 3); bias = 0.3;
      } else if (shoeOk && Math.random() < (this.tries >= 4 ? 0.45 : 0.28)) {
        plan.kind = 'chaussure'; arrive = U.rand(3.8, 5.6); nib = 0;
      } else {
        plan.kind = Math.random() < 0.7 ? 'crapet' : 'perche';
        arrive = U.rand(3.4, 5.2); nib = U.randi(2, 3);
        // un petit poisson arrive de plus loin
        const a = U.rand(0, TAU), s = persp(b.y), r = U.rand(110, 150);
        const x = U.clamp(b.x + Math.cos(a) * r * s, 380, 860), y = U.clamp(b.y + Math.sin(a) * r * s * SQ, BANK_Y + 30, 660);
        const f = makeShadow(plan.kind, null, x, y);
        f.vis = 1; f.alpha = 0;
        this.shadows.push(f);
        plan.fish = f;
        plan.newcomer = true;
      }
      if (plan.fish) {
        const f = plan.fish;
        plan.kind = f.sp;
        const s = persp(b.y);
        const d = gdist(f.x, f.y, b.x, b.y) || 1;
        const ux = (f.x - b.x) / d, uy = (f.y - b.y) / d; // déjà à l'échelle écran / unité
        f.gx = b.x + ux * 9; f.gy = b.y + uy * 9;
        if (!isFinite(f.gx)) { f.gx = b.x - 9 * s; f.gy = b.y; }
        f.state = 'approach';
        f.aspd = U.clamp(d / arrive, 8, 80);
      }
      const sp = SPECIES[plan.kind];
      plan.size = Math.round(U.lerp(sp.len[0], sp.len[1], U.clamp(Math.random() * (1 - bias) + bias * (0.5 + Math.random() * 0.5), 0, 1)));
      let tt = arrive + U.rand(0.3, 0.7);
      for (let i = 0; i < nib; i++) { plan.nibs.push(tt); tt += U.rand(0.8, 1.6); }
      plan.biteAt = nib ? tt + U.rand(0.1, 0.6) : arrive;
      return plan;
    },
    updateWait(dt) {
      this.wt += dt;
      const pl = this.plan;
      if (this.wt > 0.3 && press()) { this.resolve('early'); return; }
      if (pl.nibIdx < pl.nibs.length && this.wt >= pl.nibs[pl.nibIdx]) {
        pl.nibIdx++;
        this.bob.dip = 1;
        if (pl.fish) pl.fish.nudge = 1;
        this.ring(this.bob.x, this.bob.y, 14, 0.7, 1.2);
        G.audio.sfx('tick');
        if (this.tut) this.pop('Ça grignote… attends !', this.bob.x + 20, this.bob.y - 48, { size: 34, life: 1.3, color: P.paper });
      }
      if (this.wt >= pl.biteAt) {
        this.phase = 'bite';
        this.biteT = 0;
        if (pl.fish) { pl.fish.nudge = 1; }
        G.audio.sfx('bite');
        this.splash(this.bob.x, this.bob.y, pl.kind === 'chaussure' ? 3 : 10, 0.9);
        this.ring(this.bob.x, this.bob.y, 40, 0.9, 2);
      }
    },

    // ---------------------------------------------------------------- combat
    hook() {
      const pl = this.plan;
      const sp = SPECIES[pl.kind];
      if (pl.fish) { pl.fish.state = 'hooked'; pl.fish.vis = 0; pl.fish.alpha = 0; }
      this.phase = 'fight';
      this.hookT = 0.35;
      this.fight = {
        sp, kind: pl.kind, T: 0.46, p: 0, red: 0, slack: 0,
        pt: U.rand(0.9, 1.5), tele: 0, pull: null, tick: 0, wob: 0, dart: 0, jump: null, thrash: 0,
        from: { x: this.bob.x, y: this.bob.y }, mod: this.tut ? 0.72 : 1,
      };
      this.fpos = { x: this.bob.x, y: this.bob.y };
      G.audio.sfx('whoosh');
      this.pop(pl.kind === 'chaussure' ? 'Ça accroche…' : 'Ferré !', this.bob.x, this.bob.y - 70, { size: 46, life: 1.1 });
    },
    updateFight(dt) {
      const f = this.fight, sp = f.sp;
      const reel = holding();
      this.hookT = Math.max(0, this.hookT - dt);
      // à-coups du poisson : un éclaboussement prévient (0,4 s), puis il tire
      if (sp.pull > 0) {
        if (!f.tele && !f.pull) {
          f.pt -= dt;
          if (f.pt <= 0) {
            f.tele = 0.4;
            this.splash(this.fpos.x, this.fpos.y, 12, 1.1);
            this.ring(this.fpos.x, this.fpos.y, 34, 0.8, 2);
            G.audio.sfx('splash');
            if (sp.jumps && Math.random() < 0.55) f.jump = { t: 0, dur: 0.75 };
          }
        } else if (f.tele) {
          f.tele = Math.max(0, f.tele - dt);
          if (f.tele === 0) f.pull = { t: 0, dur: 0.45, amt: sp.pull * f.mod };
        }
      }
      if (reel) f.T += (sp.hold - f.T) * (1 - Math.exp(-2.4 * dt));
      else f.T += (0.05 - f.T) * (1 - Math.exp(-1.0 * dt));
      let pulling = 0;
      if (f.pull) {
        const k = dt / f.pull.dur;
        f.T += f.pull.amt * k * (reel ? 2.2 : 1);   // tenir pendant qu'il tire : ça casse
        f.p -= f.pull.amt * 0.08 * k;
        f.dart += dt * 3;
        pulling = 1;
        f.pull.t += dt;
        if (f.pull.t >= f.pull.dur) { f.pull = null; f.pt = U.rand(sp.every[0], sp.every[1]); }
      }
      f.T = U.clamp(f.T, 0, 1);
      // progression vers la rive
      const g0 = sp.green[0], g1 = sp.green[1];
      const eff = f.T > RED ? 0.25 : f.T > g1 ? 0.7 : f.T >= g0 ? 1 : 0.45;
      if (reel) f.p += sp.reel * eff * dt;
      else f.p -= 0.01 * dt;
      f.p = U.clamp(f.p, 0, 1);
      // moulinet
      if (reel) { f.tick -= dt; if (f.tick <= 0) { f.tick = 0.085; G.audio.sfx('tick'); } }
      // seuils
      f.red = f.T > RED ? f.red + dt : 0;
      f.slack = f.T < SLACK ? f.slack + dt : 0;
      // position du poisson : du point de touche vers la rive, en zigzag
      f.wob += dt * (1.3 + pulling * 3);
      f.dart = Math.max(0, f.dart - dt * 1.2);
      const k = U.smooth(f.p);
      const bx = U.lerp(f.from.x, LAND.x, k), by = U.lerp(f.from.y, LAND.y, k);
      const s = persp(by);
      const lx = -(LAND.y - f.from.y), ly = LAND.x - f.from.x, ll = Math.hypot(lx, ly) || 1;
      const lat = (1 - f.p * 0.75) * (24 + f.dart * 16) * Math.sin(f.wob) * s;
      this.fpos = { x: bx + (lx / ll) * lat, y: by + (ly / ll) * lat * SQ };
      f.thrash -= dt;
      if (f.thrash <= 0 && f.kind !== 'chaussure') { f.thrash = U.rand(0.25, 0.6); this.splash(this.fpos.x, this.fpos.y, 3, 0.5); }
      if (f.jump) { f.jump.t += dt; if (f.jump.t > f.jump.dur) { f.jump = null; this.splash(this.fpos.x, this.fpos.y, 10, 1); this.ring(this.fpos.x, this.fpos.y, 30, 0.8, 2); } }
      if (f.p >= 1) { this.resolve('catch'); return; }
      if (f.red > 0.4) { this.resolve('break'); return; }
      if (f.slack > 1.5) { this.resolve('lost'); }
    },

    // ---------------------------------------------------------------- fin d'une tentative
    async resolve(kind) {
      this.phase = 'resolve';
      const pl = this.plan;
      const target = pl.fish;
      let caught = false, fish = null;
      const at = this.fpos || (this.bob ? { x: this.bob.x, y: this.bob.y } : castPt(0.5));
      if (kind === 'catch') {
        const c = { kind: pl.kind, name: SPECIES[pl.kind].name, halves: SPECIES[pl.kind].halves, size: pl.size };
        if (target) this.removeShadow(target, true);
        this.lift = { t: 0, dur: 0.85, kind: pl.kind, from: { x: at.x, y: at.y }, size: pl.size };
        this.splash(at.x, at.y, 12, 1);
        G.audio.sfx('splash');
        this.fight = null;
        this.fpos = null;
        this.bob = null;
        await this.sleep(0.9);
        this.lift = null;
        G.audio.sfx(pl.kind === 'barbue' ? 'perfect' : pl.kind === 'chaussure' ? 'thud' : 'good');
        if (pl.kind === 'chaussure') this.shoe = true;
        this.catches.push(c);
        caught = true;
        fish = { name: c.name, halves: c.halves };
        this.card = { kind: c.kind, size: c.size, t: 0, out: 0 };
        await this.waitPress(4.5, 0.6);
        this.card.out = this.card.t;
        await this.sleep(0.25);
        this.card = null;
      } else {
        const msgs = {
          early: ['Trop tôt !', 'Attends que le bouchon coule pour de bon.'],
          late: ['Trop tard…', 'Il a filé avec le ver.'],
          break: ['Elle a cassé…', 'Trop de tension : lâche quand ça tire.'],
          lost: ['Il s’est décroché…', 'La ligne était trop molle : mouline.'],
        };
        const [m, sub] = msgs[kind];
        this.pop(m, at.x + 40, at.y - 90, { size: 56, color: kind === 'break' ? '#E58C6A' : P.rim, life: 2.2, sub });
        if (kind === 'early' || kind === 'late') {
          G.audio.sfx(kind === 'early' ? 'whoosh' : 'fail');
          if (this.bob) this.yank = { t: 0, from: { x: this.bob.x, y: this.bob.y } };
          this.bob = null;
        } else {
          G.audio.sfx('fail');
          if (kind === 'break') { this.snapped = { t: 0, from: { x: at.x, y: at.y } }; this.noBob = true; G.audio.sfx('splash'); }
          this.splash(at.x, at.y, 8, 0.8);
          this.fight = null;
          this.fpos = null;
          this.bob = null;
          if (kind === 'lost') this.yank = { t: 0, from: { x: at.x, y: at.y } };
        }
        if (target) {
          if (kind === 'break') this.removeShadow(target, true);
          else this.scare(target, at);
        }
        await this.sleep(1.7);
        this.yank = null;
      }
      this.plan = null;
      this.tries++;
      this.tut = false;
      if (opts.between) {
        this.paused = true;
        try {
          await opts.between({ index: this.tries - 1, caught, fish, total: this.total() });
        } catch (err) { console.error(err); }
        this.paused = false;
        I.consume();
      }
      const n = this.catches.filter((c) => c.halves > 0).length;
      if (n >= MAX_CATCH) return this.endSession('full');
      if (this.tries >= MAX_TRIES) return this.endSession('worms');
      if (this.clock >= SESSION) return this.endSession('sunset');
      this.noBob = false;
      this.phase = 'aim';
    },
    removeShadow(f, respawn) {
      const i = this.shadows.indexOf(f);
      if (i >= 0) this.shadows.splice(i, 1);
      if (respawn && f.spot && !f.rare) this.respawns.push({ spot: f.spot, at: this.t + U.rand(8, 14) });
    },
    scare(f, from) {
      const s = persp(f.y);
      const dx = f.x - from.x || U.rand(-1, 1), dy = f.y - from.y || U.rand(-1, 1);
      const d = Math.hypot(dx, dy) || 1;
      f.state = 'flee';
      f.gx = f.x + (dx / d) * 160 * s;
      f.gy = U.clamp(f.y + (dy / d) * 60 * s, BANK_Y + 20, 690);
      f.timer = 1.2;
    },
    total() { return this.catches.reduce((a, c) => a + c.halves, 0); },
    endSession(reason) {
      this.phase = 'end';
      this.ended = reason;
      this.endT = 0;
      this.bob = null;
      G.audio.sfx('page');
    },
    result() {
      const fish = this.catches.filter((c) => c.kind !== 'chaussure').map((c) => ({ name: c.name, halves: c.halves }));
      return { fish, halves: this.total(), shoe: this.shoe, otis: this.otis.count, reason: this.ended };
    },

    // ---------------------------------------------------------------- Otis
    updateOtis(dt, live) {
      const o = this.otis;
      if (!live) return;
      o.t += dt;
      const go = (st) => { o.st = st; o.t = 0; };
      switch (o.st) {
        case 'idle':
          o.next -= dt;
          if (o.next <= 0 && ['aim', 'charge', 'wait', 'cast'].includes(this.phase)) go('dip');
          break;
        case 'dip':
          if (o.t > 1.3) { go('reel'); o.kind = Math.random() < 0.65 ? 'crapet' : 'perche'; }
          break;
        case 'reel':
          if (Math.random() < dt * 3) {
            const k = U.smooth(Math.min(1, o.t / 1.7));
            this.splash(U.lerp(OTIS_BOB.x, OTIS_LAND.x, k), U.lerp(OTIS_BOB.y, OTIS_LAND.y, k), 3, 0.5);
          }
          if (o.t > 1.7) go('lift');
          break;
        case 'lift': if (o.t > 0.7) go('stash'); break;
        case 'stash': if (o.t > 0.5) { go('rest'); o.count++; } break;
        case 'rest': if (o.t > 1.6) go('recast'); break;
        case 'recast':
          if (o.t > 0.6) {
            go('idle');
            o.next = U.rand(24, 38);
            this.ring(OTIS_BOB.x, OTIS_BOB.y, 22, 1, 1.4);
          }
          break;
        default: break;
      }
    },

    // ---------------------------------------------------------------- dessin
    draw(ctx) {
      const t = this.t;
      const k = this.sunK;
      const end = sunEnd();
      const sun = { x: U.lerp(SUN0.x, end.x, k), y: U.lerp(SUN0.y, end.y, Math.pow(k, 1.15)) };
      // ciel
      const top = mix('#7F98A0', '#545575', k), midC = mix('#CDAE76', '#C0704F', k), low = mix('#E9B96C', '#E98A48', k);
      G.art.sky(ctx, G.W, BANK_Y + 4, [[0, top], [0.55, midC], [1, low]]);
      G.art.glow(ctx, sun.x, sun.y, 300 + 80 * k, mix('#F6D890', '#F0A060', k), 0.42);
      G.art.glow(ctx, sun.x, sun.y, 70, '#FFF0C8', 0.55);
      ctx.fillStyle = mix('#FFF3D2', '#FFC27A', k);
      ctx.beginPath(); ctx.arc(sun.x, sun.y, 26, 0, TAU); ctx.fill();
      // oiseaux
      ctx.save();
      ctx.strokeStyle = 'rgba(52,42,38,0.7)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of this.birds) {
        const w = 7 * b.s, f = Math.sin(b.ph) * 4 * b.s;
        ctx.beginPath(); ctx.moveTo(b.x - w, b.y - f); ctx.quadraticCurveTo(b.x - w * 0.4, b.y - 2, b.x, b.y); ctx.quadraticCurveTo(b.x + w * 0.4, b.y - 2, b.x + w, b.y - f); ctx.stroke();
      }
      ctx.restore();
      // crête lointaine (brume)
      G.art.ridge(ctx, RIDGE1, mix('#8E9188', '#6E5F72', k), BANK_Y);
      ctx.fillStyle = `rgba(240,200,140,${0.16 + 0.1 * k})`;
      ctx.fillRect(0, 200, G.W, BANK_Y - 200);
      G.art.blit(ctx, bankLayer(), 0, 0);
      // eau
      G.art.blit(ctx, waterLayer(), 0, BANK_Y);
      ctx.save(); ctx.globalAlpha = 0.55; G.art.blit(ctx, reflLayer(), 0, BANK_Y); ctx.restore();
      // tourbillon du trou d'eau
      ctx.save();
      ctx.strokeStyle = 'rgba(200,214,210,0.12)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const a = t * 0.35 + i * 2.1;
        ctx.beginPath(); ctx.ellipse(HOLE.x, HOLE.y, 60 + i * 26, (60 + i * 26) * 0.24, 0, a, a + 1.4); ctx.stroke();
      }
      ctx.restore();
      // ombres de poissons
      for (const f of this.shadows) drawShadow(ctx, f, t);
      // poisson au bout de la ligne
      if (this.fight && this.fpos) this.drawHookedFish(ctx, t);
      // surface : courant, scintillement, feuilles
      ctx.save();
      for (const s of this.streaks) {
        const ps = persp(s.y);
        ctx.strokeStyle = `rgba(236,226,200,${s.a})`; ctx.lineWidth = ps * 1.3;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len * ps, s.y); ctx.stroke();
      }
      const gl = 1 - 0.5 * k;
      for (let i = 0; i < 46; i++) {
        const yy = BANK_Y + 6 + Math.pow(i / 46, 1.5) * 300;
        const ps = persp(yy);
        const jx = Math.sin(i * 12.9898) * (14 + 70 * (yy - BANK_Y) / 300);
        const a = (0.5 + 0.5 * Math.sin(t * (2.2 + (i % 5)) + i * 1.7)) * 0.55 * gl;
        ctx.fillStyle = `rgba(255,232,170,${a})`;
        ctx.fillRect(sun.x + jx - 8 * ps, yy, (8 + (i % 4) * 6) * ps, 1.6 * ps + 0.4);
      }
      for (const l of this.leaves) {
        const ps = persp(l.y);
        ctx.save();
        ctx.translate(l.x, l.y + Math.sin(t * 1.3 + l.x * 0.05) * 1.5);
        ctx.scale(ps, ps * SQ);
        ctx.rotate(l.rot);
        ctx.fillStyle = l.col;
        ctx.beginPath(); ctx.moveTo(-l.size, 0); ctx.quadraticCurveTo(0, -l.size * 0.8, l.size, 0); ctx.quadraticCurveTo(0, l.size * 0.8, -l.size, 0); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      // rocher au milieu du courant
      this.drawMidRock(ctx, t);
      // ronds dans l'eau
      ctx.save();
      for (const r of this.rings) {
        const q = r.t / r.dur;
        const rad = 4 + r.max * U.easeOut(q);
        const ps = persp(r.y);
        ctx.strokeStyle = `rgba(240,234,220,${0.55 * (1 - q)})`;
        ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad * ps, rad * ps * SQ * 0.75, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      // bouchons
      const o = this.otis;
      let obob = null;
      if (o.st === 'idle' || o.st === 'dip') {
        const dip = o.st === 'dip' ? Math.max(0, Math.sin(o.t * 14)) * (o.t > 0.9 ? 1 : 0.4) : 0;
        obob = { x: OTIS_BOB.x, y: OTIS_BOB.y + Math.sin(t * 2.1) * 0.8 };
        drawBobber(ctx, obob.x, obob.y, persp(OTIS_BOB.y), dip, Math.sin(t * 1.7) * 0.08);
      }
      if (this.bob && (this.phase === 'wait' || this.phase === 'bite' || this.phase === 'aim')) {
        const b = this.bob;
        const sink = this.phase === 'bite' ? Math.min(1, this.biteT / 0.12) : b.dip * 0.45;
        drawBobber(ctx, b.x, b.y + Math.sin(t * 2.3) * 0.8, persp(b.y), sink, Math.sin(t * 1.9) * 0.1 + b.dip * 0.3);
      }
      // rochers proches et personnages
      G.art.blit(ctx, nearLayer(), 0, 0);
      drawCreel(ctx, 187, 605, 34, this.catches);
      this.drawOtis(ctx, t, obob);
      this.drawHenry(ctx, t);
      // gouttes
      ctx.save();
      for (const d of this.drops) {
        ctx.fillStyle = `rgba(232,236,232,${Math.min(1, d.life * 2.2)})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // lumière du soir
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = mix('#FFF4E2', '#B07A6A', U.smooth(k));
      ctx.fillRect(0, 0, G.W, G.H);
      ctx.restore();
      G.art.finish(ctx);
    },

    drawMidRock(ctx, t) {
      const { x, y } = MIDROCK;
      ctx.save();
      // sillage en aval (vers la droite)
      ctx.strokeStyle = 'rgba(236,230,212,0.28)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath(); ctx.moveTo(x + 18 + ph * 40, y - 2 - ph * 4 - i); ctx.lineTo(x + 34 + ph * 60, y - 4 - ph * 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 18 + ph * 40, y + 4 + ph * 3); ctx.lineTo(x + 34 + ph * 60, y + 6 + ph * 5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const p = blob([[x - 26, y + 6], [x - 20, y - 12], [x - 4, y - 20], [x + 14, y - 16], [x + 26, y - 2], [x + 22, y + 8], [x, y + 10]]);
      ctx.fillStyle = '#8C7A5E'; ctx.fill(p);
      ctx.save(); ctx.clip(p);
      ctx.fillStyle = '#54493C';
      ctx.beginPath(); ctx.ellipse(x - 8, y + 6, 30, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(240,190,110,0.35)';
      ctx.beginPath(); ctx.ellipse(x + 16, y - 10, 14, 10, 0, 0, TAU); ctx.fill();
      ctx.restore();
      // écume
      ctx.strokeStyle = `rgba(240,236,224,${0.45 + 0.15 * Math.sin(t * 3)})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y + 7, 30 + Math.sin(t * 2) * 1.5, 6, 0, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.restore();
    },

    drawHookedFish(ctx, t) {
      const f = this.fight, p = this.fpos, s = persp(p.y);
      const dir = Math.atan2((f.from.y - LAND.y) / SQ, f.from.x - LAND.x) + Math.sin(f.wob) * 0.5;
      const L = f.kind === 'chaussure' ? 30 : SPECIES[f.kind].shadow;
      ctx.save();
      // sillage en V
      ctx.strokeStyle = 'rgba(240,234,220,0.4)'; ctx.lineWidth = 1.2;
      for (let i = 1; i <= 3; i++) {
        const back = i * 10 * s;
        const bx = p.x - Math.cos(dir) * back, by = p.y - Math.sin(dir) * back * SQ;
        const w = i * 6 * s;
        ctx.globalAlpha = 0.7 - i * 0.18;
        ctx.beginPath(); ctx.moveTo(bx - Math.sin(dir) * w, by + Math.cos(dir) * w * SQ); ctx.lineTo(p.x, p.y); ctx.lineTo(bx + Math.sin(dir) * w, by - Math.cos(dir) * w * SQ); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!f.jump) {
        ctx.translate(p.x, p.y);
        ctx.scale(s, s * SQ);
        ctx.rotate(dir);
        ctx.fillStyle = 'rgba(236,230,214,0.16)';
        ctx.beginPath(); ctx.ellipse(0, 0, L * 0.7, L * 0.34, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(12,18,20,0.78)';
        ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, L * 0.17, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-L * 0.4, 0); ctx.lineTo(-L * 0.68, -L * 0.15 + Math.sin(t * 14) * 3); ctx.lineTo(-L * 0.68, L * 0.15 + Math.sin(t * 14) * 3); ctx.closePath(); ctx.fill();
        if (Math.sin(t * 9) > 0.7) { ctx.fillStyle = 'rgba(230,230,220,0.35)'; ctx.beginPath(); ctx.ellipse(L * 0.05, -L * 0.04, L * 0.2, L * 0.05, 0, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
      // saut de l'achigan
      if (f.jump) {
        const q = f.jump.t / f.jump.dur;
        const len = (8 + f.sp.len[1] * 3.2) * s;
        drawFish(ctx, f.kind, p.x, p.y - Math.sin(q * Math.PI) * 60 * s, len, { rot: (q - 0.5) * 2.2 * (dir > -Math.PI / 2 && dir < Math.PI / 2 ? 1 : -1), flip: Math.cos(dir) < 0, wag: Math.sin(t * 30) * 0.3 });
      }
    },

    rodTarget() {
      const f = this.fight;
      if (this.phase === 'charge') return [U.lerp(-1.0, -2.05, this.power), 22];
      if (this.phase === 'wait' || this.phase === 'bite') return [-0.55, 9];
      if (this.phase === 'fight' && f) return [this.hookT > 0 ? -1.3 : -1.0 - f.T * 0.12, 9];
      if (this.lift) return [-1.35, 9];
      if (this.yank) return [-1.2, 9];
      return [-0.6, 9];
    },
    drawHenry(ctx, t) {
      const f = this.fight;
      const reeling = this.phase === 'fight' && holding() && !G.blocked;
      const front = 1.25 + (-0.6 - this.rodAng) * 0.55;
      const back = front - 0.4 + (reeling ? Math.sin(t * 16) * 0.35 : 0);
      const lean = this.phase === 'fight' ? -0.1 - (f ? f.T * 0.08 : 0) : this.phase === 'wait' ? 0.08 : 0;
      const r = G.art.char(ctx, 'henry', HENRY.x, HENRY.foot, { dir: 1, pose: 'sit', seatH: 42, arms: [back, front], rim: true, lean, seed: 1 });
      const hand = r.hand;
      const LEN = 172;
      let to = null, bend = 0;
      if (this.phase === 'fight' && this.fpos) { to = this.fpos; bend = 0.15 + f.T * 0.85 + (f.pull ? 0.2 : 0); }
      else if (this.phase === 'bite' && this.bob) { to = this.bob; bend = 0.25; }
      const tip = rodTip(hand, this.rodAng, LEN, to, bend);
      this.tip = tip;
      // la ligne d'abord, la canne par-dessus
      if ((this.phase === 'wait' || this.phase === 'bite') && this.bob) {
        drawLine(ctx, tip, this.bob, this.phase === 'bite' ? 6 : 26, 0.55);
      } else if (this.phase === 'cast' && this.fly) {
        drawLine(ctx, tip, this.flyPos(this.fly.t / this.fly.dur), 10, 0.5);
      } else if (this.phase === 'fight' && this.fpos) {
        const shake = f.T > 0.75 ? Math.sin(t * 60) * (f.T - 0.75) * 10 : 0;
        drawLine(ctx, tip, this.fpos, (1 - f.T) * 30 + shake, 0.7);
        // le bouchon traîne sur la ligne, juste devant le poisson
        const tb = { x: U.lerp(this.fpos.x, tip.x, 0.08), y: U.lerp(this.fpos.y, tip.y, 0.02) };
        drawBobber(ctx, tb.x, tb.y, persp(tb.y), 0.25, -0.5);
      } else if (this.lift) {
        const fp = this.liftPos(Math.min(1, this.lift.t / this.lift.dur));
        drawLine(ctx, tip, { x: fp.x, y: fp.y - 8 }, 0, 0.6);
      } else if (this.yank) {
        const q = Math.min(1, this.yank.t / 0.5);
        const b = { x: U.lerp(this.yank.from.x, tip.x - 10, U.easeOut(q)), y: U.lerp(this.yank.from.y, tip.y + 46, U.easeOut(q)) - Math.sin(q * Math.PI) * 40 };
        drawLine(ctx, tip, b, 4, 0.5);
        drawBobberAir(ctx, b.x, b.y);
      } else if (this.snapped) {
        const q = Math.min(1, this.snapped.t / 0.6);
        const b = { x: U.lerp(tip.x + 40, tip.x + 10, q), y: U.lerp(tip.y + 30, tip.y + 70, q) };
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - this.snapped.t / 1.2); drawLine(ctx, tip, b, 14, 0.5); ctx.restore();
      } else if (this.phase === 'aim' || this.phase === 'charge' || (this.phase === 'resolve' && !this.noBob)) {
        // le bouchon et le ver pendent au bout de la ligne
        const hb = { x: tip.x + Math.sin(t * 1.8) * 4, y: tip.y + 46 };
        drawLine(ctx, tip, hb, 0, 0.55);
        drawBobberAir(ctx, hb.x, hb.y);
      }
      drawRod(ctx, hand, this.rodAng, LEN, to, bend);
      // bouchon en vol
      if (this.phase === 'cast' && this.fly) {
        const b = this.flyPos(this.fly.t / this.fly.dur);
        drawBobberAir(ctx, b.x, b.y);
      }
      // poisson hissé hors de l'eau
      if (this.lift) {
        const q = Math.min(1, this.lift.t / this.lift.dur);
        const fp = this.liftPos(q);
        const len = this.lift.kind === 'chaussure' ? 34 : 14 + this.lift.size * 2.6;
        drawFish(ctx, this.lift.kind, fp.x, fp.y + len * 0.4, len, { rot: Math.PI / 2 + Math.sin(t * 18) * 0.35, wag: Math.sin(t * 25) * 0.3, drip: true });
      }
    },
    flyPos(q) {
      const f = this.fly;
      return { x: U.lerp(f.from.x, f.to.x, q), y: U.lerp(f.from.y, f.to.y, q) - Math.sin(q * Math.PI) * f.h };
    },
    liftPos(q) {
      const a = this.lift.from, b = { x: 318, y: 520 };
      return { x: U.lerp(a.x, b.x, U.easeOut(q)), y: U.lerp(a.y, b.y, q) - Math.sin(q * Math.PI) * 90 };
    },

    drawOtis(ctx, t, obob) {
      const o = this.otis;
      let elev = 0.6, bend = 0, to = null;
      let arms = [0.85, 1.25];
      switch (o.st) {
        case 'dip': elev = 0.58; break;
        case 'reel': elev = 1.0 + Math.sin(t * 7) * 0.04; bend = 0.6; arms = [0.9 + Math.sin(t * 16) * 0.35, 1.55]; break;
        case 'lift': elev = 1.3; arms = [1.2, 1.9]; break;
        case 'stash': elev = 1.0; arms = [0.6, 1.5]; break;
        case 'rest': elev = 0.35; break;
        case 'recast': elev = o.t < 0.15 ? 1.7 : 0.5; break;
        default: elev = 0.6 + Math.sin(t * 0.7) * 0.02; break;
      }
      const r = G.art.char(ctx, 'otis', OTIS.x, OTIS.foot, { dir: -1, pose: 'sit', seatH: 42, arms, seed: 4 });
      const hand = r.hand;
      const ang = Math.PI + elev;
      // poisson d'Otis
      let fishP = null;
      if (o.st === 'reel') {
        const k = U.smooth(Math.min(1, o.t / 1.7));
        fishP = { x: U.lerp(OTIS_BOB.x, OTIS_LAND.x, k) + Math.sin(t * 6) * 8, y: U.lerp(OTIS_BOB.y, OTIS_LAND.y, k) };
        to = fishP;
      }
      const tip0 = { x: hand.x + Math.cos(ang) * 165, y: hand.y + Math.sin(ang) * 165 };
      let tip = tip0;
      if (to) {
        const bx = to.x - tip0.x, by = to.y - tip0.y, bl = Math.hypot(bx, by) || 1;
        tip = { x: tip0.x + (bx / bl) * bend * 30, y: tip0.y + (by / bl) * bend * 30 };
      }
      if (obob) drawLine(ctx, tip, obob, 22, 0.5);
      if (fishP) {
        drawLine(ctx, tip, fishP, 2, 0.6);
        ctx.fillStyle = 'rgba(14,22,24,0.55)';
        ctx.beginPath(); ctx.ellipse(fishP.x, fishP.y, 10, 4, 0, 0, TAU); ctx.fill();
      }
      if (o.st === 'lift' || o.st === 'stash') {
        let fp;
        if (o.st === 'lift') {
          const q = Math.min(1, o.t / 0.7);
          fp = { x: U.lerp(OTIS_LAND.x, hand.x - 30, U.easeOut(q)), y: U.lerp(OTIS_LAND.y, hand.y - 40, q) - Math.sin(q * Math.PI) * 50 };
          drawLine(ctx, tip, { x: fp.x, y: fp.y - 6 }, 0, 0.6);
        } else {
          const q = Math.min(1, o.t / 0.5);
          fp = { x: U.lerp(hand.x - 30, 1174, q), y: U.lerp(hand.y - 40, 574, q) - Math.sin(q * Math.PI) * 40 };
        }
        drawFish(ctx, o.kind, fp.x, fp.y + 10, o.kind === 'crapet' ? 26 : 34, { rot: Math.PI / 2 + Math.sin(t * 18) * 0.4, wag: Math.sin(t * 25) * 0.3 });
      }
      if (o.st === 'recast') {
        const q = Math.min(1, o.t / 0.6);
        const b = { x: U.lerp(tip.x, OTIS_BOB.x, q), y: U.lerp(tip.y, OTIS_BOB.y, q) - Math.sin(q * Math.PI) * 60 };
        drawLine(ctx, tip, b, 6, 0.5);
        drawBobberAir(ctx, b.x, b.y);
      }
      if (o.st === 'rest') drawLine(ctx, tip, { x: tip.x - 4, y: tip.y + 40 }, 0, 0.5);
      // la canne
      const dx = Math.cos(ang), dy = Math.sin(ang);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2E2219';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(hand.x - dx * 30, hand.y - dy * 30); ctx.lineTo(hand.x, hand.y); ctx.stroke();
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(hand.x, hand.y); ctx.quadraticCurveTo(hand.x + dx * 90, hand.y + dy * 90, tip.x, tip.y); ctx.stroke();
      ctx.restore();
      // poissons d'Otis dans le seau
      for (let i = 0; i < Math.min(4, o.count); i++) {
        ctx.fillStyle = FISHCOL[i % 2 ? 'perche' : 'crapet'].fin;
        const fx = 1166 + i * 6, fy = 574;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 5, fy - 10); ctx.lineTo(fx + 1, fy - 6); ctx.lineTo(fx + 6, fy - 11); ctx.closePath(); ctx.fill();
      }
    },

    // ---------------------------------------------------------------- interface
    drawUI(uctx) {
      if (this.phase === 'end' || this.phase === 'done') { this.drawEnd(uctx); return; }
      this.drawHud(uctx);
      const tut = this.tut;
      let hint = null;
      switch (this.phase) {
        case 'aim': hint = tut ? 'Maintiens le clic ou Espace pour armer ton lancer' : 'Maintiens le clic ou Espace pour lancer'; break;
        case 'charge': hint = tut ? 'Relâche quand le repère passe sur une ombre de poisson' : 'Relâche pour lancer'; break;
        case 'wait': hint = tut ? 'Attends que le bouchon coule pour de bon' : 'Attends la vraie touche…'; break;
        case 'bite': hint = 'Ferre ! Clique ou appuie sur Espace'; break;
        case 'fight': hint = tut ? 'Maintiens pour mouliner, lâche quand ça tire' : 'Maintiens pour mouliner · Lâche quand ça tire'; break;
        default: break;
      }
      if (hint && !G.blocked) ui.hint(uctx, hint);
      // repères du tutoriel
      if (tut && !G.blocked && (this.phase === 'aim' || this.phase === 'charge')) {
        const c = spotCenter('rocher'), h = spotCenter('trou');
        ui.tag(uctx, 'Des poissons', c.x + 4, c.y - 30);
        ui.tag(uctx, 'Le trou d’eau', h.x + 70, h.y - 26);
      }
      if (tut && !G.blocked && this.phase === 'wait' && this.bob && this.wt < 2.4 && this.plan && this.plan.nibIdx === 0) ui.tag(uctx, 'Ton bouchon', this.bob.x, this.bob.y - 16);
      if (this.phase === 'charge') this.drawPower(uctx);
      if (this.phase === 'fight') this.drawTension(uctx);
      if (this.phase === 'bite' && this.bob) {
        const q = U.clamp(this.biteT / BITE_WINDOW, 0, 1);
        const b = this.bob;
        uctx.save();
        uctx.strokeStyle = `rgba(242,210,122,${0.9 - q * 0.4})`;
        uctx.lineWidth = 3;
        const rr = U.lerp(70, 14, q);
        uctx.beginPath(); uctx.ellipse(b.x, b.y, rr, rr * 0.62, 0, 0, TAU); uctx.stroke();
        uctx.restore();
        const sc = 1 + 0.25 * Math.max(0, 1 - this.biteT * 8) + Math.sin(this.biteT * 30) * 0.03;
        shout(uctx, 'Ferre !', b.x + 10, b.y - 92, 84, P.rim, 1, sc);
      }
      // textes animés
      for (const p of this.pops) {
        const a = Math.min(1, p.t * 6) * Math.min(1, (p.life - p.t) * 2.5);
        const sc = 0.8 + 0.2 * U.easeOut(Math.min(1, p.t * 5));
        const y = p.y - p.t * 14;
        shout(uctx, p.text, p.x, y, p.size, p.color, a, sc);
        if (p.sub) {
          uctx.save();
          uctx.globalAlpha = a;
          uctx.font = ui.font(20, 'serif', 'italic');
          const w = uctx.measureText(p.sub).width + 28;
          uctx.fillStyle = 'rgba(20,16,13,0.8)';
          uctx.beginPath(); uctx.roundRect(p.x - w / 2, y + p.size * 0.45, w, 32, 16); uctx.fill();
          ui.text(uctx, p.sub, p.x, y + p.size * 0.45 + 17, { size: 20, italic: true, align: 'center', base: 'middle' });
          uctx.restore();
        }
      }
      if (this.card) this.drawCard(uctx);
    },

    drawHud(ctx) {
      const x = 22, y = 18, w = 282, h = 118;
      ctx.save();
      ctx.fillStyle = 'rgba(20,16,13,0.8)';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
      ui.caps(ctx, 'Panier', x + 16, y + 33, { size: 13, color: 'rgba(232,223,204,0.7)' });
      if (!this.catches.length) ui.text(ctx, 'vide pour l’instant', x + 92, y + 32, { size: 18, italic: true, color: 'rgba(232,223,204,0.5)' });
      this.catches.forEach((c, i) => drawFish(ctx, c.kind, x + 112 + i * 37, y + 27, c.kind === 'chaussure' ? 28 : 32, {}));
      ui.caps(ctx, 'Vers', x + 16, y + 69, { size: 13, color: 'rgba(232,223,204,0.7)' });
      for (let i = 0; i < MAX_TRIES; i++) {
        const used = i < this.worms;
        const wx = x + 92 + i * 26, wy = y + 63;
        ctx.strokeStyle = used ? 'rgba(232,223,204,0.18)' : '#C98A7A';
        ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.bezierCurveTo(wx + 5, wy - 7, wx + 9, wy + 7, wx + 14, wy);
        ctx.quadraticCurveTo(wx + 17, wy - 4, wx + 19, wy - 2);
        ctx.stroke();
      }
      // le jour qui reste
      ui.caps(ctx, 'Soleil', x + 16, y + 102, { size: 13, color: 'rgba(232,223,204,0.7)' });
      const left = 1 - U.clamp(this.clock / SESSION, 0, 1);
      const sx = x + 92, sw = 172, sy = y + 97;
      ctx.fillStyle = 'rgba(232,223,204,0.12)';
      ctx.beginPath(); ctx.roundRect(sx, sy - 3, sw, 6, 3); ctx.fill();
      ctx.fillStyle = left < 0.2 ? P.ember : P.gold;
      ctx.beginPath(); ctx.roundRect(sx, sy - 3, Math.max(6, sw * left), 6, 3); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + sw * left, sy, 6, 0, TAU); ctx.fill();
      ctx.restore();
    },

    panel(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(20,16,13,0.84)';
      ctx.beginPath(); ctx.roundRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 12); ctx.fill();
      ctx.restore();
    },

    drawPower(ctx) {
      // repère sur l'eau + axe du lancer
      const t = 0.04 + 0.96 * this.power;
      const pt = castPt(t), s = persp(pt.y);
      ctx.save();
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = 'rgba(242,210,122,0.35)'; ctx.lineWidth = 1.5;
      const a = castPt(0.04), b = castPt(1);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = P.rim; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 22 * s, 22 * s * SQ, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = P.rim;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5, 0, TAU); ctx.fill();
      ctx.restore();
      // jauge
      this.panel(ctx);
      const bx = PANEL.x + 20, bw = PANEL.w - 40, by = PANEL.y + 36, bh = 18;
      ui.caps(ctx, 'Puissance du lancer', bx, PANEL.y + 27, { size: 13, color: 'rgba(232,223,204,0.75)' });
      ui.text(ctx, 'près → loin', bx + bw, PANEL.y + 27, { size: 15, italic: true, color: 'rgba(232,223,204,0.5)', align: 'right' });
      ctx.save();
      ctx.fillStyle = 'rgba(232,223,204,0.12)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill();
      ctx.fillStyle = P.gold;
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * this.power), bh, 9); ctx.fill();
      // les ombres projetées sur l'axe du lancer
      const A = castPt(0.04), B = castPt(1);
      const ax = B.x - A.x, ay = B.y - A.y, al = ax * ax + ay * ay;
      for (const f of this.shadows) {
        if (f.state !== 'wander' || f.alpha < 0.5) continue;
        const q = U.clamp(((f.x - A.x) * ax + (f.y - A.y) * ay) / al, 0, 1);
        const c = { x: A.x + ax * q, y: A.y + ay * q };
        const d = gdist(f.x, f.y, c.x, c.y);
        if (d > 70) continue;
        const L = SPECIES[f.sp].shadow * 0.26 + 6;
        const fx = bx + bw * q;
        ctx.globalAlpha = U.clamp(1.3 - d / 70, 0.25, 1);
        ctx.fillStyle = '#E8DFCC';
        const gy = by + bh + 14;
        ctx.beginPath(); ctx.ellipse(fx, gy, L * 0.5, L * 0.2, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(fx - L * 0.4, gy); ctx.lineTo(fx - L * 0.7, gy - L * 0.2); ctx.lineTo(fx - L * 0.7, gy + L * 0.2); ctx.closePath(); ctx.fill();
        ctx.fillRect(fx - 0.5, by + bh + 1, 1, 6);
      }
      ctx.globalAlpha = 1;
      // aiguille
      const nx = bx + bw * this.power;
      ctx.fillStyle = P.paper;
      ctx.fillRect(nx - 2, by - 4, 4, bh + 8);
      ctx.restore();
    },

    drawTension(ctx) {
      const f = this.fight, sp = f.sp;
      this.panel(ctx);
      const bx = PANEL.x + 20, bw = PANEL.w - 40, by = PANEL.y + 32, bh = 20;
      ui.caps(ctx, 'Tension', bx, PANEL.y + 22, { size: 13, color: 'rgba(232,223,204,0.75)' });
      // état
      let st, col;
      if (f.tele || f.pull) { st = 'Ça tire ! Lâche !'; col = P.ember; }
      else if (f.T > RED) { st = 'Ça va casser !'; col = '#E06A4A'; }
      else if (f.T < SLACK) { st = 'Trop mou… mouline !'; col = '#9CC0D8'; }
      else if (f.T >= sp.green[0] && f.T <= sp.green[1]) { st = 'Bien'; col = P.sprout; }
      else if (f.T > sp.green[1]) { st = 'Ça force…'; col = P.gold; }
      else { st = 'Un peu mou'; col = P.paper; }
      ui.text(ctx, st, bx + bw, PANEL.y + 22, { size: 19, italic: true, bold: true, color: col, align: 'right' });
      ctx.save();
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.clip();
      const zone = (a, b, c) => { ctx.fillStyle = c; ctx.fillRect(bx + bw * a, by, bw * (b - a) + 1, bh); };
      zone(0, SLACK, '#3E4E5A');
      zone(SLACK, sp.green[0], '#6E6248');
      zone(sp.green[0], sp.green[1], '#5E8A3A');
      zone(sp.green[1], RED, '#A8742E');
      zone(RED, 1, '#9E3420');
      ctx.restore();
      // alertes : rouge ou trop mou
      if (f.red > 0 || f.slack > 0) {
        const k = f.red > 0 ? f.red / 0.4 : f.slack / 1.5;
        ctx.save();
        ctx.strokeStyle = f.red > 0 ? `rgba(240,110,80,${0.5 + 0.5 * Math.sin(this.t * 30)})` : `rgba(156,192,216,${0.4 + 0.4 * Math.sin(this.t * 12)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 8); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(bx, by + bh + 4, bw * U.clamp(k, 0, 1), 3);
        ctx.restore();
      }
      // aiguille
      const shake = f.T > RED ? Math.sin(this.t * 70) * 3 : 0;
      const nx = bx + bw * f.T + shake;
      ctx.save();
      ctx.fillStyle = P.paper;
      ctx.fillRect(nx - 2.5, by - 6, 5, bh + 12);
      ctx.beginPath(); ctx.moveTo(nx - 7, by - 10); ctx.lineTo(nx + 7, by - 10); ctx.lineTo(nx, by - 3); ctx.closePath(); ctx.fill();
      ctx.restore();
      // jusqu'à la rive : le poisson avance de gauche à droite vers la rive
      const py = PANEL.y + 66;
      ui.caps(ctx, 'Jusqu’à la rive', bx, py + 5, { size: 12, color: 'rgba(232,223,204,0.7)' });
      const px0 = bx + 150, pw = bw - 150 - 34;
      ctx.save();
      ctx.fillStyle = 'rgba(232,223,204,0.14)';
      ctx.beginPath(); ctx.roundRect(px0, py - 4, pw, 8, 4); ctx.fill();
      const fx = px0 + pw * f.p;
      ctx.fillStyle = 'rgba(159,214,201,0.7)';
      ctx.beginPath(); ctx.roundRect(px0, py - 4, Math.max(8, fx - px0), 8, 4); ctx.fill();
      // la rive : un caillou au bout
      ctx.fillStyle = '#9A8768';
      ctx.beginPath(); ctx.ellipse(px0 + pw + 18, py + 2, 13, 9, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (f.kind === 'chaussure') drawShoe(ctx, fx, py - 2, 22);
      else drawFish(ctx, f.kind, fx, py, 26);
    },

    drawCard(ctx) {
      const c = this.card;
      const inA = U.easeOut(Math.min(1, c.t * 4));
      const outA = c.out ? 1 - Math.min(1, (c.t - c.out) * 4) : 1;
      const a = inA * outA;
      const sp = SPECIES[c.kind];
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(13,11,10,0.35)';
      ctx.fillRect(0, 0, G.W, G.H);
      const w = 540, h = 372, x = G.W / 2 - w / 2, y = 140 + (1 - inA) * 30;
      ctx.translate(G.W / 2, y + h / 2);
      ctx.rotate(-0.012);
      ctx.translate(-G.W / 2, -(y + h / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#EFE6D2';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(92,74,51,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      const cx = G.W / 2;
      const eyebrow = c.kind === 'chaussure' ? 'Euh…' : c.kind === 'barbue' ? 'Quelle prise !' : 'Une prise';
      ui.caps(ctx, eyebrow, cx, y + 44, { size: 14, color: P.rust, align: 'center', spacing: 4 });
      ui.text(ctx, sp.title || sp.name, cx, y + 92, { size: 46, color: P.ink, align: 'center' });
      const len = c.kind === 'chaussure' ? 150 : U.clamp(150 + (c.size - 5) * 9, 140, 320);
      drawFish(ctx, c.kind, cx + (c.kind === 'chaussure' ? 0 : 14), y + (c.kind === 'chaussure' ? 196 : 176), len, { drip: true, wag: Math.sin(this.t * 3) * 0.05 });
      const sizeTxt = c.kind === 'chaussure' ? 'Pointure inconnue. Pleine de vase.' : `${c.size} pouces`;
      ui.text(ctx, sizeTxt, cx, y + 262, { size: 22, italic: true, color: P.tobacco, align: 'center' });
      if (sp.halves > 0) {
        drawBowls(ctx, cx, y + 296, sp.halves, 32);
        ui.text(ctx, `Vaut ${bowls(sp.halves)} pour la marmite`, cx, y + 344, { size: 21, color: P.ink, align: 'center' });
      } else {
        ui.text(ctx, 'Ça ne se mange pas.', cx, y + 314, { size: 22, color: P.ink, align: 'center' });
      }
      ctx.restore();
    },

    drawEnd(ctx) {
      const a = U.easeOut(Math.min(1, this.endT * 1.5));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(13,11,10,0.6)';
      ctx.fillRect(0, 0, G.W, G.H);
      const rows = Math.max(1, this.catches.length);
      const w = 660, h = Math.max(390, 306 + rows * 38), x = G.W / 2 - w / 2, y = (G.H - h) / 2 - 6 + (1 - a) * 20;
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#EFE6D2';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(92,74,51,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      const cx = G.W / 2;
      ui.caps(ctx, 'Fin de la pêche', cx, y + 46, { size: 14, color: P.rust, align: 'center', spacing: 4 });
      ui.text(ctx, 'Le panier', cx, y + 98, { size: 48, color: P.ink, align: 'center' });
      const why = { full: 'Le panier est plein.', worms: 'Plus un ver dans la boîte.', sunset: 'Le soleil est passé derrière la crête.' }[this.ended] || '';
      ui.text(ctx, why, cx, y + 134, { size: 22, italic: true, color: P.tobacco, align: 'center' });
      // le panier dessiné
      drawCreel(ctx, x + 130, y + 330, 150, this.catches);
      // la liste
      const lx = x + 250, rx = x + w - 40;
      let ly = y + 190;
      if (!this.catches.length) {
        ui.text(ctx, 'Rien, ce soir.', lx, ly + 10, { size: 24, italic: true, color: P.ink });
        ly += 44;
      }
      for (const c of this.catches) {
        if (c.kind === 'chaussure') drawShoe(ctx, lx + 20, ly + 2, 30);
        else drawFish(ctx, c.kind, lx + 20, ly, 40);
        const label = c.kind === 'chaussure' ? 'Une vieille chaussure' : `${c.name}, ${c.size} pouces`;
        ui.text(ctx, label, lx + 52, ly + 7, { size: 22, color: P.ink });
        ui.text(ctx, c.halves ? bowls(c.halves) : 'rien', rx, ly + 7, { size: 20, italic: true, color: P.tobacco, align: 'right' });
        ly += 38;
      }
      ctx.strokeStyle = 'rgba(92,74,51,0.4)';
      ctx.beginPath(); ctx.moveTo(lx, ly - 6); ctx.lineTo(rx, ly - 6); ctx.stroke();
      const tot = this.total();
      ui.text(ctx, tot ? `Pour la marmite : ${bowls(tot)}.` : 'Rien pour la marmite.', lx, ly + 24, { size: 23, bold: true, color: P.ink });
      const oc = this.otis.count;
      const otisTxt = oc === 0 ? 'Otis n’a rien pris, pour une fois.' : oc === 1 ? 'Otis en a sorti un.' : `Otis en a sorti ${NUM[oc] || oc}.`;
      ui.text(ctx, otisTxt, lx, ly + 60, { size: 20, italic: true, color: P.tobacco });
      if (this.endT > 0.9) {
        ui.text(ctx, 'Clique ou appuie sur Espace pour rentrer', cx, y + h - 26, { size: 17, italic: true, color: 'rgba(31,26,23,0.55)', align: 'center' });
      }
      ctx.restore();
    },

    exit() {
      this.sleeps = [];
      this.pressWait = null;
    },
  });

  // Bouchon hors de l'eau (au bout de la ligne, ou en vol).
  function drawBobberAir(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#1E1814'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -11); ctx.stroke();
    ctx.fillStyle = '#EDE6D6'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#B5321E'; ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(240,232,214,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 16); ctx.stroke();
    ctx.fillStyle = '#B87A6A'; ctx.beginPath(); ctx.ellipse(0, 18, 2, 3.5, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  G.DEV = G.DEV || {};
  G.DEV.fishing = () => G.play(G.Scenes.fishing({ between: async (e) => { if (e.index === 0) await G.say('otis', 'Pas mal, pour un gars de la scierie.'); } }));
})();
