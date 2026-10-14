'use strict';
// Dessin : palettes, silhouettes animées, décors, texture de papier, vignettage.
(function () {
  const G = window.G;
  const U = G.U;
  const A = (G.art = {});

  G.PAL = {
    ink: '#1F1A17', paper: '#E8DFCC', sil: '#2B2420', silDark: '#1C1714',
    rust: '#7A2E1A', ochre: '#B8732A', gold: '#D9A441', tobacco: '#5C4A33', octSky: '#9AA5A0',
    coal: '#1C1D21', slate: '#3B4654', frost: '#7D8A96', snow: '#D8D4C8', ember: '#E37A2C',
    moss: '#5E7A3A', sprout: '#A3BE6E',
    wood: '#7E6045', woodDark: '#4A3826', beam: '#2E241B', tin: '#3B4654',
    lamp: '#F6CF78', water: '#6F8FA0', rim: '#F2D27A',
    autumn: ['#7A2E1A', '#B8732A', '#D9A441', '#9C4A22', '#C98F3A', '#5E7A3A'],
  };
  const P = G.PAL;

  // ------------------------------------------------------------------ silhouettes
  // Préréglages des personnages. h : taille en pixels.
  G.CHARS = {
    henry: { h: 134, hat: 'cap', name: 'Henry' },
    kenneth: { h: 168, hat: 'felt', name: 'Papa' },
    ida: { h: 146, hat: 'bun', skirt: true, name: "M'man" },
    hattie: { h: 116, hat: 'bonnet', skirt: true, stoop: 0.22, name: 'Granny' },
    clay: { h: 162, hat: 'cap', name: 'Clay' },
    wes: { h: 166, thin: 0.35, name: 'Wes' },
    ruth: { h: 112, hat: 'braids', skirt: true, name: 'Ruth' },
    pearl: { h: 72, hat: 'bow', skirt: true, name: 'Pearl' },
    otis: { h: 136, hat: 'newsboy', name: 'Otis' },
    pruitt: { h: 156, hat: 'visor', apron: true, belly: 0.2, name: 'Mr. Pruitt' },
    dow: { h: 174, hat: 'felt', thin: 0.45, beard: true, name: 'Dow Slone' },
    nora: { h: 142, hat: 'bonnet', skirt: true, name: 'Mrs. Napier' },
    napierKid: { h: 88, name: 'un petit Napier' },
    napierGirl: { h: 98, skirt: true, hat: 'braids', name: 'une petite Napier' },
    abner: { h: 160, hat: 'felt', beard: true, name: 'Abner Napier' },
    super: { h: 164, hat: 'bowler', coat: true, belly: 0.25, name: 'M. Garvey' },
    whitcomb: { h: 160, hat: 'fedora', coat: true, name: 'M. Whitcomb' },
    thornbury: { h: 152, hat: 'felt', belly: 0.35, coat: true, name: 'M. Thornbury' },
    farris: { h: 162, hat: 'fedora', coat: true, name: 'M. Farris' },
    revenuer: { h: 166, hat: 'felt', coat: true, name: "l'agent" },
    worker1: { h: 160, hat: 'cap', name: 'un ouvrier' },
    worker2: { h: 166, hat: 'felt', name: 'un ouvrier' },
    worker3: { h: 156, hat: 'cap', thin: 0.2, name: 'un ouvrier' },
  };

  // Construit une liste de primitives, puis les dessine (deux passes si contour).
  A.person = (ctx, x, foot, o) => {
    const base = typeof o.char === 'string' ? G.CHARS[o.char] || {} : {};
    o = Object.assign({}, base, o);
    const h = o.h || 140;
    const d = o.dir || 1;
    const prims = [];
    const L = (x1, y1, x2, y2, w) => prims.push({ k: 'l', x1, y1, x2, y2, w });
    const C = (cx, cy, r) => prims.push({ k: 'c', cx, cy, r });
    const E = (cx, cy, rx, ry, rot) => prims.push({ k: 'e', cx, cy, rx, ry, rot: rot || 0 });
    const Pg = (pts) => prims.push({ k: 'p', pts });

    // Celui qui parle : la tête bouge, la main fait des gestes.
    const sid = G.speaking;
    const talking = !!sid && !o.silent && (o.char === sid || (G.WHO_CHAR && G.WHO_CHAR[sid] === o.char));
    const tk = talking ? G.time * 1 + (o.seed || 0) : 0;
    const thin = o.thin || 0;
    const r = h * 0.08;
    const t = h * 0.17 * (1 - 0.28 * thin) * (1 + (o.belly || 0) * 0.5);
    const pose = o.pose || 'stand';
    const ph = o.phase || 0;
    const sw = pose === 'walk' ? Math.sin(ph * Math.PI * 2) : 0;
    const seed = o.seed || 0;
    let bob = pose === 'walk'
      ? -Math.abs(Math.cos(ph * Math.PI * 2)) * h * 0.014
      : Math.sin(G.time * 1.6 + seed) * h * 0.004;
    let stoop = o.stoop || 0;
    let lean = stoop + (o.lean || 0);

    let hip, neck;
    const torsoLen = h * 0.37;
    if (pose === 'sit') {
      const sh = o.seatH != null ? o.seatH : h * 0.27;
      hip = { x: 0, y: -sh };
      L(hip.x, hip.y, h * 0.24, hip.y, h * 0.085);
      L(h * 0.24, hip.y, h * 0.25, -2, h * 0.07);
    } else if (pose === 'crouch' || pose === 'kneel') {
      hip = { x: -h * 0.03, y: -h * 0.27 + bob };
      lean += pose === 'kneel' ? 0.75 : 0.55;
      L(hip.x, hip.y, h * 0.15, -h * 0.2, h * 0.08);
      L(h * 0.15, -h * 0.2, h * 0.07, -2, h * 0.07);
      if (pose === 'kneel') {
        L(hip.x, hip.y, -h * 0.02, -h * 0.03, h * 0.08);
        L(-h * 0.02, -h * 0.03, -h * 0.24, -2, h * 0.07);
      } else {
        L(hip.x, hip.y, -h * 0.1, -h * 0.13, h * 0.08);
        L(-h * 0.1, -h * 0.13, -h * 0.07, -2, h * 0.07);
      }
    } else {
      hip = { x: 0, y: -h * 0.46 + bob };
      const legLen = h * 0.445;
      for (const a of [-sw * 0.42, sw * 0.42]) {
        const fx = Math.sin(a) * legLen;
        const fy = Math.min(-2, hip.y + Math.cos(a) * legLen);
        L(hip.x + (o.skirt ? 0 : 0), hip.y + (o.skirt ? h * 0.3 : 0), fx, fy, h * (o.skirt ? 0.05 : 0.075));
      }
    }
    neck = { x: hip.x + Math.sin(lean) * torsoLen, y: hip.y - Math.cos(lean) * torsoLen };

    // jupe / tablier
    if (o.skirt && pose !== 'sit' && pose !== 'crouch' && pose !== 'kneel') {
      const top = hip.y - h * 0.08;
      const hem = -h * 0.08;
      const s = sw * h * 0.025;
      Pg([[hip.x - h * 0.085, top], [hip.x + h * 0.085, top], [h * 0.16 + s, hem], [-h * 0.15 + s, hem]]);
    } else if (o.skirt && pose === 'sit') {
      Pg([[hip.x - h * 0.08, hip.y - h * 0.05], [h * 0.3, hip.y - h * 0.03], [h * 0.33, -h * 0.12], [h * 0.17, -h * 0.12], [h * 0.1, hip.y + h * 0.04]]);
    }
    if (o.coat && pose !== 'sit') {
      Pg([[hip.x - h * 0.1, hip.y - h * 0.2], [hip.x + h * 0.1, hip.y - h * 0.2], [hip.x + h * 0.12, hip.y + h * 0.12], [hip.x - h * 0.12, hip.y + h * 0.12]]);
    }
    // torse
    const tx = Math.sin(lean), ty = -Math.cos(lean);
    L(hip.x + tx * h * 0.02, hip.y + ty * h * 0.02, neck.x - tx * t * 0.45, neck.y - ty * t * 0.45, t);
    if (o.apron) Pg([[hip.x + h * 0.06, hip.y - h * 0.22], [hip.x + h * 0.1, hip.y - h * 0.22], [hip.x + h * 0.11, hip.y + h * 0.16], [hip.x + h * 0.05, hip.y + h * 0.16]]);

    // bras : angles depuis la verticale (positif = vers l'avant)
    const sh = { x: neck.x + tx * h * 0.02, y: neck.y + h * 0.1 };
    let arms = o.arms;
    if (!arms) {
      if (pose === 'walk') arms = [-sw * 0.5, sw * 0.5];
      else if (pose === 'sit') arms = [0.7, 1.0];
      else if (pose === 'crouch' || pose === 'kneel') arms = [1.4, 1.7];
      else arms = [-0.06, 0.1];
    }
    if (talking) {
      arms = arms.slice();
      const g = Math.sin(tk * 4.2) * 0.22 + Math.sin(tk * 7.1) * 0.08;
      arms[1] = (arms[1] || 0) + (pose === 'walk' ? 0 : 0.45 + g);
    }
    const armLen = h * 0.35;
    const hands = [];
    for (const a of arms) {
      const hx = sh.x + Math.sin(a) * armLen;
      const hy = sh.y + Math.cos(a) * armLen;
      L(sh.x, sh.y, hx, hy, h * 0.055);
      hands.push({ x: hx, y: hy });
    }

    // tête
    const hx = neck.x + tx * r * 0.9 + h * 0.012 + (talking ? Math.sin(tk * 3.3) * h * 0.006 : 0);
    const hy = neck.y - r * 1.05 + (talking ? -Math.abs(Math.sin(tk * 8.5)) * h * 0.008 : 0);
    C(hx, hy, r);
    if (o.beard) E(hx + r * 0.35, hy + r * 0.75, r * 0.55, r * 0.5, 0.3);
    switch (o.hat) {
      case 'felt':
      case 'fedora':
        E(hx, hy - r * 0.45, r * 1.75, r * 0.3);
        Pg([[hx - r * 0.95, hy - r * 0.5], [hx + r * 0.95, hy - r * 0.5], [hx + r * 0.85, hy - r * 1.45], [hx - r * 0.85, hy - r * 1.45]]);
        break;
      case 'bowler':
        E(hx, hy - r * 0.5, r * 1.4, r * 0.25);
        E(hx, hy - r * 0.95, r * 0.95, r * 0.75);
        break;
      case 'cap':
      case 'newsboy':
        E(hx - r * 0.05, hy - r * 0.5, r * (o.hat === 'newsboy' ? 1.2 : 1.05), r * 0.62);
        E(hx + r * 0.95, hy - r * 0.35, r * 0.8, r * 0.2);
        break;
      case 'visor':
        E(hx + r * 0.8, hy - r * 0.55, r * 1.0, r * 0.2, -0.15);
        break;
      case 'bonnet':
        C(hx - r * 0.25, hy - r * 0.15, r * 1.2);
        E(hx + r * 0.7, hy - r * 0.05, r * 0.4, r * 1.25);
        break;
      case 'bun':
        C(hx - r * 0.9, hy - r * 0.45, r * 0.55);
        break;
      case 'braids':
        L(hx - r * 0.85, hy, hx - r * 1.25, hy + r * 2.0, r * 0.42);
        break;
      case 'bow':
        E(hx - r * 0.3, hy - r * 1.0, r * 0.55, r * 0.3, 0.4);
        break;
      default:
        break;
    }

    // accessoires portés
    const front = hands[1] || hands[0];
    const acc = [];
    if (o.carry === 'pails') {
      const swing = Math.sin(G.time * 5 + ph * 6) * 0.15;
      for (let i = 0; i < (o.pails != null ? o.pails : 3); i++) {
        const ax = front.x + i * h * 0.06 - h * 0.05;
        const ay = front.y + h * 0.02;
        acc.push({ k: 'pail', x: ax + Math.sin(swing + i) * 3, y: ay, s: h * 0.075 });
      }
    } else if (o.carry === 'crate') {
      acc.push({ k: 'crate', x: front.x - h * 0.06, y: front.y - h * 0.08, s: h });
    } else if (o.carry === 'sack') {
      acc.push({ k: 'sack', x: sh.x - h * 0.1, y: sh.y - h * 0.05, s: h });
    } else if (o.carry === 'fiddle') {
      acc.push({ k: 'fiddle', x: neck.x + h * 0.08, y: neck.y + h * 0.03, s: h, bow: hands[0] });
    } else if (o.carry === 'pipe') {
      acc.push({ k: 'pipe', x: hx + r * 1.0, y: hy + r * 0.45, s: h });
    } else if (o.carry === 'book') {
      acc.push({ k: 'book', x: front.x, y: front.y, s: h });
    } else if (o.carry === 'rod') {
      acc.push({ k: 'rod', x: front.x, y: front.y, s: h, angle: o.rodAngle || -0.9 });
    } else if (o.carry === 'lantern') {
      acc.push({ k: 'lantern', x: front.x, y: front.y + h * 0.03, s: h });
    } else if (o.carry === 'stick') {
      acc.push({ k: 'stick', x: front.x, y: front.y, s: h });
    } else if (o.carry === 'basket') {
      acc.push({ k: 'basket', x: front.x, y: front.y, s: h });
    }

    const col = o.color || P.sil;
    ctx.save();
    ctx.translate(x, foot);
    if (d < 0) ctx.scale(-1, 1);
    if (o.tilt) ctx.rotate(o.tilt);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pass = (color, extra) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      for (const p of prims) {
        if (p.k === 'l') {
          ctx.lineWidth = p.w + extra * 2;
          ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
        } else if (p.k === 'c') {
          ctx.beginPath(); ctx.arc(p.cx, p.cy, p.r + extra, 0, Math.PI * 2); ctx.fill();
        } else if (p.k === 'e') {
          ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.rx + extra, p.ry + extra, p.rot, 0, Math.PI * 2); ctx.fill();
        } else if (p.k === 'p') {
          ctx.beginPath();
          p.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.closePath();
          ctx.fill();
          if (extra) { ctx.lineWidth = extra * 2; ctx.stroke(); }
        }
      }
    };
    if (o.rim) pass(o.rim === true ? P.rim : o.rim, 2.2);
    pass(col, 0);
    for (const a of acc) drawAcc(ctx, a, col);
    ctx.restore();
    return { head: { x: x + hx * d, y: foot + hy }, hand: { x: x + front.x * d, y: foot + front.y }, top: foot + hy - r * 1.5 };
  };

  function drawAcc(ctx, a, col) {
    ctx.save();
    switch (a.k) {
      case 'pail': {
        ctx.fillStyle = '#6E6A64';
        ctx.strokeStyle = '#3a3632';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y + a.s * 0.5); ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(a.x - a.s * 0.5, a.y + a.s * 0.5, a.s, a.s * 0.9, 2);
        ctx.fill(); ctx.stroke();
        break;
      }
      case 'crate': {
        ctx.fillStyle = '#5C4A33';
        ctx.fillRect(a.x - a.s * 0.12, a.y, a.s * 0.24, a.s * 0.1);
        ctx.fillStyle = 'rgba(205,215,220,0.85)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.roundRect(a.x - a.s * 0.1 + i * a.s * 0.075, a.y - a.s * 0.06, a.s * 0.055, a.s * 0.07, 2);
          ctx.fill();
        }
        break;
      }
      case 'sack': {
        ctx.fillStyle = '#B8A782';
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s * 0.09, a.s * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'fiddle': {
        ctx.fillStyle = P.rust;
        ctx.beginPath(); ctx.ellipse(a.x, a.y, a.s * 0.075, a.s * 0.04, -0.35, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x + a.s * 0.05, a.y - a.s * 0.02); ctx.lineTo(a.x + a.s * 0.17, a.y - a.s * 0.07); ctx.stroke();
        if (a.bow) {
          ctx.strokeStyle = P.paper; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(a.bow.x - a.s * 0.12, a.bow.y - a.s * 0.1); ctx.lineTo(a.bow.x + a.s * 0.12, a.bow.y + a.s * 0.1); ctx.stroke();
        }
        break;
      }
      case 'pipe': {
        ctx.strokeStyle = col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a.x - a.s * 0.02, a.y); ctx.lineTo(a.x + a.s * 0.05, a.y + a.s * 0.01); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(a.x + a.s * 0.045, a.y - a.s * 0.025, a.s * 0.025, a.s * 0.035);
        const puff = (G.time * 0.4) % 1;
        ctx.fillStyle = `rgba(220,214,200,${0.35 * (1 - puff)})`;
        ctx.beginPath(); ctx.arc(a.x + a.s * 0.06 + puff * 8, a.y - a.s * 0.05 - puff * 30, 3 + puff * 8, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'book':
        ctx.fillStyle = '#8C3B2A';
        ctx.fillRect(a.x - a.s * 0.05, a.y - a.s * 0.06, a.s * 0.09, a.s * 0.065);
        break;
      case 'rod':
        ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + Math.cos(a.angle) * a.s * 1.2, a.y + Math.sin(a.angle) * a.s * 1.2); ctx.stroke();
        break;
      case 'lantern':
        ctx.fillStyle = '#151515'; ctx.fillRect(a.x - 5, a.y, 10, 4);
        ctx.fillStyle = P.lamp; ctx.beginPath(); ctx.ellipse(a.x, a.y + 11, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'stick':
        ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y - a.s * 0.1); ctx.lineTo(a.x + a.s * 0.05, a.y + a.s * 0.35); ctx.stroke();
        break;
      case 'basket':
        ctx.fillStyle = '#8C6A48';
        ctx.beginPath(); ctx.ellipse(a.x, a.y + a.s * 0.04, a.s * 0.07, a.s * 0.045, 0, 0, Math.PI); ctx.fill();
        break;
      default: break;
    }
    ctx.restore();
  }

  // Raccourci : dessine un personnage par son identifiant.
  A.char = (ctx, id, x, foot, o = {}) => A.person(ctx, x, foot, Object.assign({ char: id }, o));

  // ------------------------------------------------------------------ hors-écran et cache
  const cache = new Map();
  A.canvas = (w, h, scale = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const cx = c.getContext('2d');
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    return { c, cx, w, h };
  };
  // Dessine une fois, réutilise ensuite (décors statiques).
  A.cached = (key, w, h, draw, scale) => {
    if (cache.has(key)) return cache.get(key);
    const s = scale || Math.min(G.dpr, 1.5);
    const o = A.canvas(w, h, s);
    draw(o.cx, w, h);
    cache.set(key, o);
    return o;
  };
  A.blit = (ctx, o, x, y) => ctx.drawImage(o.c, x, y, o.w, o.h);
  A.clearCache = (prefix) => { for (const k of cache.keys()) if (!prefix || k.startsWith(prefix)) cache.delete(k); };

  // Tuile de grain (papier / photo).
  let grainTile = null;
  A.grainTile = () => {
    if (grainTile) return grainTile;
    const o = A.canvas(256, 256, 1);
    const img = o.cx.createImageData(256, 256);
    const rnd = U.rng(77);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rnd() - 0.5) * 90 + (rnd() - 0.5) * 40;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    o.cx.putImageData(img, 0, 0);
    grainTile = o.c;
    return grainTile;
  };
  // Texture peinte : grain en « overlay » sur une zone.
  A.texture = (ctx, w, h, strength = 0.18) => {
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(A.grainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  // Grain animé plein écran + vignettage, à appeler en fin de draw().
  A.finish = (ctx, opts = {}) => {
    const g = A.grainTile();
    ctx.save();
    ctx.globalAlpha = opts.grain != null ? opts.grain : 0.045;
    ctx.globalCompositeOperation = 'overlay';
    const ox = (G.frame * 37) % 256, oy = (G.frame * 91) % 256;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(g, 'repeat');
    ctx.fillRect(0, 0, G.W + 256, G.H + 256);
    ctx.restore();
    const v = A.cached('vignette', G.W, G.H, (cx, w, h) => {
      const gr = cx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(10,6,4,0.62)');
      cx.fillStyle = gr;
      cx.fillRect(0, 0, w, h);
    }, 0.5);
    ctx.save();
    ctx.globalAlpha = opts.vignette != null ? opts.vignette : 1;
    A.blit(ctx, v, 0, 0);
    ctx.restore();
  };

  // ------------------------------------------------------------------ éléments de décor
  A.sky = (ctx, w, h, stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  // Crête lissée remplie jusqu'en bas. pts : [[x, y], ...]
  A.ridge = (ctx, pts, color, bottom) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    ctx.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const lp = pts[pts.length - 1];
    ctx.lineTo(lp[0], lp[1]);
    ctx.lineTo(lp[0], bottom);
    ctx.closePath();
    ctx.fill();
  };
  // Hauteur d'une crête en x (interpolation linéaire, suffisante pour placer des arbres).
  A.ridgeY = (pts, x) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      if (x >= x1 && x <= x2) return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
    }
    return pts[pts.length - 1][1];
  };
  // Génère une crête aléatoire régulière.
  A.makeRidge = (seed, w, yBase, amp, step = 140) => {
    const rnd = U.rng(seed);
    const pts = [];
    for (let x = -step; x <= w + step; x += step) pts.push([x, yBase + (rnd() - 0.5) * amp * 2]);
    return pts;
  };
  // Feuillage en touches de couleur.
  A.dots = (ctx, seed, n, xa, xb, yFn, colors, rmin, rmax, amin = 0.6, amax = 0.95) => {
    const rnd = U.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = xa + rnd() * (xb - xa);
      const [y1, y2] = yFn(x);
      const y = y1 + rnd() * (y2 - y1);
      ctx.globalAlpha = amin + rnd() * (amax - amin);
      ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
      ctx.beginPath();
      ctx.arc(x, y, rmin + rnd() * (rmax - rmin), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  // Arbre : tronc effilé et houppier en touches.
  A.tree = (ctx, x, ground, h, trunk, leaves, seed) => {
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.035, ground);
    ctx.lineTo(x - h * 0.012, ground - h * 0.75);
    ctx.lineTo(x + h * 0.012, ground - h * 0.75);
    ctx.lineTo(x + h * 0.035, ground);
    ctx.fill();
    ctx.strokeStyle = trunk;
    ctx.lineWidth = h * 0.012;
    ctx.beginPath();
    ctx.moveTo(x, ground - h * 0.5); ctx.lineTo(x - h * 0.15, ground - h * 0.7);
    ctx.moveTo(x, ground - h * 0.6); ctx.lineTo(x + h * 0.14, ground - h * 0.82);
    ctx.stroke();
    if (leaves && leaves.length) {
      A.dots(ctx, seed || x, Math.round(h * 0.45), x - h * 0.3, x + h * 0.3,
        (px) => { const k = 1 - Math.abs(px - x) / (h * 0.3); return [ground - h * (0.6 + 0.4 * k), ground - h * (0.55 - 0.1 * k)]; },
        leaves, h * 0.03, h * 0.07);
    }
  };

  // Maison de compagnie vue de l'extérieur, sur pilotis. x = bord gauche, ground = sol.
  A.campHouse = (ctx, x, ground, o = {}) => {
    const w = o.w || 230, wallH = o.h || 110, stilt = o.stilt || 26;
    const floor = ground - stilt;
    ctx.fillStyle = P.beam;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 8 + i * (w - 24) / 3, floor, 7, stilt);
    ctx.fillStyle = o.wall || '#6E5640';
    ctx.fillRect(x, floor - wallH, w, wallH);
    ctx.strokeStyle = 'rgba(30,22,16,0.45)';
    ctx.lineWidth = 2;
    for (let bx = x + 12; bx < x + w; bx += 16) { ctx.beginPath(); ctx.moveTo(bx, floor - wallH); ctx.lineTo(bx, floor); ctx.stroke(); }
    ctx.fillStyle = o.roof || P.tin;
    ctx.beginPath();
    ctx.moveTo(x - 14, floor - wallH + 4);
    ctx.lineTo(x + w / 2, floor - wallH - (o.pitch || 52));
    ctx.lineTo(x + w + 14, floor - wallH + 4);
    ctx.fill();
    // porche
    ctx.fillStyle = P.beam;
    ctx.fillRect(x - 6, floor - 4, w + 12, 6);
    ctx.fillRect(x + 6, floor - wallH + 18, 5, wallH - 18);
    ctx.fillRect(x + w - 11, floor - wallH + 18, 5, wallH - 18);
    // porte et fenêtres
    ctx.fillStyle = '#2E241B';
    ctx.fillRect(x + w * 0.42, floor - wallH * 0.68, w * 0.14, wallH * 0.68);
    const lit = o.lit;
    for (const wx of [x + w * 0.14, x + w * 0.68]) {
      ctx.fillStyle = lit ? '#F2B65A' : '#2a2a2c';
      ctx.fillRect(wx, floor - wallH * 0.7, w * 0.16, wallH * 0.36);
      ctx.strokeStyle = P.beam; ctx.lineWidth = 3;
      ctx.strokeRect(wx, floor - wallH * 0.7, w * 0.16, wallH * 0.36);
    }
    // tuyau de poêle
    ctx.fillStyle = '#151518';
    ctx.fillRect(x + w * 0.7, floor - wallH - 70, 8, 44);
    if (o.smoke !== false) {
      for (let i = 0; i < 4; i++) {
        const k = ((G.time * 0.25 + i * 0.25) % 1);
        ctx.fillStyle = `rgba(200,194,182,${0.4 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x + w * 0.7 + 4 + k * 30, floor - wallH - 74 - k * 60, 5 + k * 12, 0, Math.PI * 2); ctx.fill();
      }
    }
  };

  // Le sol en planches d'une passerelle ou d'un perron.
  A.boards = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = color || '#4A3826';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(20,14,10,0.5)';
    ctx.lineWidth = 1;
    for (let bx = x + 14; bx < x + w; bx += 14) { ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke(); }
  };

  // Lueur radiale (lampe, poêle, lanterne).
  A.glow = (ctx, x, y, r, color, alpha = 0.5) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
})();
