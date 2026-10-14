'use strict';
// Décors partagés de l'épisode 1 : maison en coupe, camp, scierie, magasin,
// montagne, bourg. Les couches statiques sont mises en cache.
(function () {
  const G = window.G;
  const U = G.U;
  const P = G.PAL;
  const A = G.art;
  const PL = (G.places = G.places || {});
  G.DEV = G.DEV || {};

  // ------------------------------------------------------------------ ambiances de lumière
  PL.SKY = {
    summer: [[0, '#6F93B0'], [0.6, '#A9C0C8'], [1, '#E3D9B5']],
    dawn: [[0, '#39465A'], [0.55, '#8E8A8A'], [1, '#E2B48A']],
    day: [[0, '#7E9AAE'], [0.65, '#B9C0B4'], [1, '#E2C48E']],
    dusk: [[0, '#4F5864'], [0.55, '#9AA5A0'], [1, '#D9A86A']],
    night: [[0, '#0B1120'], [0.6, '#1B263B'], [1, '#33405A']],
    rain: [[0, '#55606A'], [1, '#9AA2A2']],
  };
  PL.LEAVES = {
    summer: ['#3F5E2E', '#5E7A3A', '#6F8F3F', '#4A6B35', '#7C9A4A', '#56713A'],
    autumn: P.autumn,
  };
  const RIDGE = {
    summer: { far: '#6F8A8A', mid: '#3F5636', ground: '#3C3526' },
    autumn: { far: '#7F8580', mid: '#5C4A33', ground: '#3E3123' },
  };

  // Ciel + deux crêtes + feuillage : la couche lointaine, parallaxe 0,5.
  function backLayer(cx, w, h, o) {
    A.sky(cx, w, h, PL.SKY[o.time] || PL.SKY.day);
    if (o.time === 'night') {
      const rnd = U.rng(5);
      cx.fillStyle = '#E8E4D0';
      for (let i = 0; i < 140; i++) { cx.globalAlpha = 0.3 + rnd() * 0.6; cx.fillRect(rnd() * w, rnd() * h * 0.5, 1.6, 1.6); }
      cx.globalAlpha = 1;
      cx.fillStyle = '#EDE6CC';
      cx.beginPath(); cx.arc(w * 0.72, 110, 30, 0, Math.PI * 2); cx.fill();
      A.glow(cx, w * 0.72, 110, 140, 'rgba(230,226,200,0.6)', 0.35);
    }
    const c = RIDGE[o.season] || RIDGE.autumn;
    const far = A.makeRidge(o.seed || 3, w, o.farY || 300, 45, 170);
    A.ridge(cx, far, c.far, h);
    const mid = A.makeRidge((o.seed || 3) + 6, w, o.midY || 380, 34, 130);
    A.ridge(cx, mid, c.mid, h);
    A.dots(cx, (o.seed || 3) + 11, Math.round(w * 0.16), -20, w + 20,
      (x) => [A.ridgeY(mid, x) + 2, A.ridgeY(mid, x) + 150], PL.LEAVES[o.season] || P.autumn, 7, 16, 0.55, 0.92);
    A.texture(cx, w, h, 0.16);
    if (o.time === 'night') { cx.fillStyle = 'rgba(8,12,26,0.5)'; cx.fillRect(0, 0, w, h); }
    if (o.time === 'dawn') { cx.fillStyle = 'rgba(200,190,200,0.12)'; cx.fillRect(0, 0, w, h); }
  }

  // Dessine une couche lointaine (cache) avec parallaxe.
  PL.drawBack = (ctx, cam, worldW, o) => {
    const k = o.parallax != null ? o.parallax : 0.5;
    const w = Math.ceil(G.W + Math.max(0, worldW - G.W) * k) + 4;
    const key = `back:${o.key}:${w}`;
    const layer = A.cached(key, w, G.H, (cx, cw, ch) => backLayer(cx, cw, ch, o), 1);
    A.blit(ctx, layer, -Math.round(cam * k), 0);
  };

  // ------------------------------------------------------------------ éléments
  // Façade du magasin de la compagnie. x = bord gauche, ground = sol.
  PL.storeFront = (ctx, x, ground, o = {}) => {
    const w = 360, h = 190;
    ctx.fillStyle = '#5E4A36';
    ctx.fillRect(x, ground - h - 40, w, h);
    // fronton à faux-front (typique des magasins de compagnie)
    ctx.fillRect(x - 6, ground - h - 92, w + 12, 60);
    ctx.fillStyle = '#E3D6B8';
    ctx.fillRect(x + 20, ground - h - 82, w - 40, 38);
    G.ui.text(ctx, 'HOLLIS LUMBER & STAVE CO.', x + w / 2, ground - h - 69, { size: 15, color: '#2B2420', align: 'center', base: 'middle', bold: true });
    G.ui.text(ctx, 'MAGASIN DE LA COMPAGNIE', x + w / 2, ground - h - 52, { size: 12, color: '#5C4A33', align: 'center', base: 'middle' });
    ctx.strokeStyle = 'rgba(30,22,16,0.4)'; ctx.lineWidth = 2;
    for (let bx = x + 14; bx < x + w; bx += 18) { ctx.beginPath(); ctx.moveTo(bx, ground - h - 40); ctx.lineTo(bx, ground - 40); ctx.stroke(); }
    // vitrines et porte
    ctx.fillStyle = o.night ? '#E9B35A' : '#2C2A28';
    ctx.fillRect(x + 30, ground - h + 20, 90, 90);
    ctx.fillRect(x + w - 120, ground - h + 20, 90, 90);
    ctx.fillStyle = '#2B2016';
    ctx.fillRect(x + w / 2 - 34, ground - h + 10, 68, h - 50);
    // auvent et perron
    ctx.fillStyle = P.tin;
    ctx.beginPath(); ctx.moveTo(x - 20, ground - h + 4); ctx.lineTo(x + w + 20, ground - h + 4); ctx.lineTo(x + w + 34, ground - h + 34); ctx.lineTo(x - 34, ground - h + 34); ctx.fill();
    A.boards(ctx, x - 30, ground - 40, w + 60, 14, '#4A3826');
    ctx.fillStyle = P.beam;
    for (const px of [x - 24, x + w + 18]) ctx.fillRect(px, ground - h + 30, 7, h - 70);
    ctx.fillRect(x - 10, ground - 26, 14, 26);
    ctx.fillRect(x + w - 4, ground - 26, 14, 26);
    // marches
    ctx.fillStyle = '#3A2C1E';
    ctx.fillRect(x + w / 2 - 50, ground - 26, 100, 13);
    ctx.fillRect(x + w / 2 - 60, ground - 13, 120, 13);
    // affiches
    ctx.fillStyle = '#D9CFB6';
    ctx.fillRect(x + 140, ground - h + 40, 34, 46);
    ctx.fillRect(x + 186, ground - h + 52, 28, 36);
  };

  // Scierie : grand hangar ouvert, cheminée de brique avec le sifflet.
  PL.mill = (ctx, x, ground) => {
    // cheminée
    ctx.fillStyle = '#6A3B2A';
    ctx.beginPath(); ctx.moveTo(x + 560, ground - 120); ctx.lineTo(x + 572, ground - 520); ctx.lineTo(x + 606, ground - 520); ctx.lineTo(x + 618, ground - 120); ctx.fill();
    ctx.fillStyle = '#4A2A1E';
    ctx.fillRect(x + 566, ground - 532, 46, 16);
    // sifflet à vapeur (sur le toit)
    ctx.fillStyle = '#B8A16A';
    ctx.fillRect(x + 300, ground - 300, 10, 36);
    ctx.beginPath(); ctx.ellipse(x + 305, ground - 302, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    // hangar
    ctx.fillStyle = '#4B3A2B';
    ctx.fillRect(x, ground - 260, 700, 260);
    ctx.fillStyle = P.tin;
    ctx.beginPath(); ctx.moveTo(x - 30, ground - 252); ctx.lineTo(x + 350, ground - 330); ctx.lineTo(x + 730, ground - 252); ctx.fill();
    ctx.fillStyle = '#1E1814';
    ctx.fillRect(x + 40, ground - 210, 620, 170);
    // poutres et chariot de scie à l'intérieur
    ctx.fillStyle = '#3A2C1E';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 40 + i * 124, ground - 210, 10, 170);
    ctx.fillStyle = '#6E5640';
    ctx.fillRect(x + 120, ground - 92, 420, 26);
    ctx.fillStyle = '#9A9A96';
    ctx.beginPath(); ctx.arc(x + 330, ground - 110, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1E1814';
    ctx.beginPath(); ctx.arc(x + 330, ground - 110, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5C4A33';
    ctx.fillRect(x + 160, ground - 120, 300, 28);
    // enseigne
    ctx.fillStyle = '#E3D6B8';
    ctx.fillRect(x + 190, ground - 248, 320, 30);
    G.ui.text(ctx, 'HOLLIS LUMBER & STAVE CO.', x + 350, ground - 232, { size: 17, color: '#2B2420', align: 'center', base: 'middle', bold: true });
  };

  // Piles de planches et grumes.
  PL.lumber = (ctx, x, ground, w = 180, h = 90) => {
    for (let r = 0; r < Math.floor(h / 12); r++) {
      ctx.fillStyle = r % 2 ? '#B58F5E' : '#A07A4C';
      ctx.fillRect(x + (r % 2) * 6, ground - (r + 1) * 12, w, 10);
      ctx.fillStyle = '#5C4A33';
      ctx.fillRect(x + (r % 2) * 6, ground - (r + 1) * 12 + 10, w, 2);
    }
  };
  PL.logs = (ctx, x, ground, n = 4) => {
    for (let i = 0; i < n; i++) {
      const lx = x + i * 46, ly = ground - 22 - (i % 2) * 6;
      ctx.fillStyle = '#5A4128';
      ctx.fillRect(lx - 60, ly - 18, 120, 36);
      ctx.fillStyle = '#C49A62';
      ctx.beginPath(); ctx.ellipse(lx + 60, ly, 10, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8C6A48'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(lx + 60, ly, 5, 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
  };
  // Corde à linge avec du linge qui bouge au vent.
  PL.laundry = (ctx, x, y, w, colors) => {
    ctx.strokeStyle = '#2B2420'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y + 16, x + w, y); ctx.stroke();
    ctx.fillStyle = P.beam;
    ctx.fillRect(x - 3, y - 4, 5, 110); ctx.fillRect(x + w - 2, y - 4, 5, 110);
    const n = colors.length;
    colors.forEach((c, i) => {
      const t = (i + 0.5) / n;
      const px = x + w * t;
      const py = y + 16 * 4 * t * (1 - t) - 2;
      const sway = Math.sin(G.time * 2 + i) * 3;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.lineTo(px + 12 + sway, py + 38); ctx.lineTo(px - 12 + sway, py + 36);
      ctx.fill();
    });
  };
  // Clôture de piquets.
  PL.fence = (ctx, x, y, w) => {
    ctx.fillStyle = '#5C4A33';
    ctx.fillRect(x, y - 30, w, 4);
    ctx.fillRect(x, y - 16, w, 4);
    for (let fx = x; fx < x + w; fx += 22) ctx.fillRect(fx, y - 40, 5, 40);
  };

  // ------------------------------------------------------------------ le camp de Hollis
  // Variantes : season 'summer' | 'autumn', time 'summer' | 'day' | 'dawn' | 'dusk' | 'night'.
  PL.campWidth = 2700;
  PL.camp = (ctx, cam, o = {}) => {
    const season = o.season || 'autumn';
    const time = o.time || 'day';
    const W = PL.campWidth;
    PL.drawBack(ctx, cam, W, { key: `camp-${season}-${time}`, season, time, seed: 3 });
    const front = A.cached(`camp-front-${season}-${time}`, W, G.H, (cx) => {
      // talus et rangée de maisons du camp, au-dessus de la route
      cx.fillStyle = season === 'summer' ? '#46552F' : '#4E3E2B';
      cx.beginPath(); cx.moveTo(0, 470); cx.quadraticCurveTo(W / 2, 440, W, 480); cx.lineTo(W, G.H); cx.lineTo(0, G.H); cx.fill();
      for (let i = 0; i < 6; i++) {
        const hx = 80 + i * 400;
        if (hx > 1330 && hx < 1950) continue; // place du magasin
        A.campHouse(cx, hx, 500, { lit: time === 'night' || time === 'dusk', smoke: false, w: 210, h: 100 });
      }
      PL.storeFront(cx, 1500, 600, { night: time === 'night' });
      // la route de terre
      cx.fillStyle = season === 'summer' ? '#6B5A40' : '#5E4C36';
      cx.fillRect(0, 590, W, 130);
      cx.fillStyle = 'rgba(30,22,16,0.35)';
      for (let i = 0; i < 70; i++) cx.fillRect((i * 151) % W, 610 + (i * 37) % 90, 40 + (i % 5) * 12, 3);
      // ruisseau au bout du camp, départ de la passerelle
      cx.fillStyle = '#6F8FA0';
      cx.fillRect(2560, 600, 140, 120);
      cx.fillStyle = P.beam;
      cx.fillRect(2540, 470, 8, 132);
      cx.fillRect(2580, 470, 8, 132);
      cx.strokeStyle = '#2B2420'; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(2544, 474); cx.quadraticCurveTo(2650, 530, 2720, 500); cx.stroke();
      A.boards(cx, 2540, 592, 160, 10, '#4A3826');
      A.texture(cx, W, G.H, 0.12);
      if (time === 'night') { cx.fillStyle = 'rgba(8,12,26,0.45)'; cx.fillRect(0, 0, W, G.H); }
    }, 1);
    A.blit(ctx, front, -cam, 0);
    // éléments animés : linge, fumées
    if (season === 'summer' || time === 'day') {
      PL.laundry(ctx, 300 - cam, 470, 160, ['#E8DFCC', '#9AA5A0', '#B4527A', '#E8DFCC']);
      PL.laundry(ctx, 1080 - cam, 476, 140, ['#D8D4C8', '#7A2E1A', '#E8DFCC']);
    }
    for (let i = 0; i < 6; i++) {
      const hx = 80 + i * 400;
      if (hx > 1330 && hx < 1950) continue;
      if (!o.noSmoke) PL.smoke(ctx, hx + 147 - cam, 330, i);
    }
  };
  PL.smoke = (ctx, x, y, seed = 0) => {
    for (let i = 0; i < 4; i++) {
      const k = (G.time * 0.22 + i * 0.25 + seed * 0.13) % 1;
      ctx.fillStyle = `rgba(205,198,186,${0.38 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x + k * 34, y - k * 70, 5 + k * 13, 0, Math.PI * 2); ctx.fill();
    }
  };

  // ------------------------------------------------------------------ la scierie
  PL.millWidth = 2000;
  PL.millYard = (ctx, cam, o = {}) => {
    const W = PL.millWidth;
    PL.drawBack(ctx, cam, W, { key: 'mill', season: 'summer', time: 'summer', seed: 21, midY: 360 });
    const front = A.cached('mill-front', W, G.H, (cx) => {
      cx.fillStyle = '#5A4A33';
      cx.fillRect(0, 560, W, 160);
      // étang à grumes
      cx.fillStyle = '#5F7E85';
      cx.fillRect(0, 600, 380, 120);
      for (let i = 0; i < 7; i++) {
        cx.fillStyle = '#5A4128';
        cx.save(); cx.translate(40 + i * 48, 640 + (i % 3) * 18); cx.rotate(0.1 * (i % 2 ? 1 : -1));
        cx.fillRect(-40, -9, 90, 18); cx.restore();
      }
      PL.mill(cx, 640, 600);
      PL.lumber(cx, 420, 600, 170, 110);
      PL.lumber(cx, 1440, 600, 200, 140);
      PL.logs(cx, 1720, 600, 4);
      // brûleur à sciure, en forme de tipi
      cx.fillStyle = '#4A3F35';
      cx.beginPath(); cx.moveTo(1900, 600); cx.lineTo(1960, 330); cx.lineTo(2020, 600); cx.fill();
      // sol de sciure
      cx.fillStyle = 'rgba(210,180,130,0.25)';
      cx.fillRect(380, 586, 1600, 20);
      A.texture(cx, W, G.H, 0.12);
    }, 1);
    A.blit(ctx, front, -cam, 0);
    if (!o.closed) {
      PL.smoke(ctx, 1228 - cam, 60, 1);
      PL.smoke(ctx, 1960 - cam, 320, 2);
    }
  };

  // ------------------------------------------------------------------ la maison en coupe
  // Inspirée de docs/img/maquette-maison.svg, décalée de +105 px vers le bas.
  // o : { time: 'dawn'|'day'|'dusk'|'night', lamp: bool, stove: bool, sold: [] }
  const DY = 105;
  PL.houseFloor = 560;
  PL.house = (ctx, o = {}) => {
    const time = o.time || 'day';
    const key = `house-${time}-${o.season || 'autumn'}`;
    const bg = A.cached(key, G.W, G.H, (cx) => {
      A.sky(cx, G.W, G.H, PL.SKY[time] || PL.SKY.day);
      if (time === 'night') {
        const rnd = U.rng(9);
        cx.fillStyle = '#E8E4D0';
        for (let i = 0; i < 90; i++) { cx.globalAlpha = 0.3 + rnd() * 0.6; cx.fillRect(rnd() * G.W, rnd() * 300, 1.5, 1.5); }
        cx.globalAlpha = 1;
      }
      A.ridge(cx, [[-40, 335], [150, 255], [420, 300], [700, 245], [1000, 290], [1320, 250]], time === 'night' ? '#252B36' : '#7F8580', G.H);
      const mid = [[-40, 400], [180, 345], [360, 372], [520, 338], [700, 312], [900, 362], [1080, 322], [1320, 300]];
      A.ridge(cx, mid, time === 'night' ? '#221C17' : '#5C4A33', G.H);
      A.dots(cx, 7, 240, 0, G.W, (x) => [A.ridgeY(mid, x) + 4, A.ridgeY(mid, x) + 150], o.season === 'summer' ? PL.LEAVES.summer : P.autumn, 7, 15);
      // sol en pente
      cx.fillStyle = '#3E3123';
      cx.beginPath(); cx.moveTo(0, 600 + DY - 20); cx.lineTo(G.W, 470 + DY); cx.lineTo(G.W, G.H); cx.lineTo(0, G.H); cx.fill();
      A.texture(cx, G.W, G.H, 0.14);
      if (time === 'night') { cx.fillStyle = 'rgba(8,12,26,0.5)'; cx.fillRect(0, 0, G.W, G.H); }
      if (time === 'dusk') { cx.fillStyle = 'rgba(40,20,10,0.15)'; cx.fillRect(0, 0, G.W, G.H); }
      // pilotis
      cx.fillStyle = '#2E241B';
      for (const sx of [90, 190, 330, 460, 600, 740, 880, 1000]) cx.fillRect(sx, 465 + DY, 10, 160);
      // toit
      cx.fillStyle = P.tin;
      cx.beginPath(); cx.moveTo(176, 252 + DY); cx.lineTo(605, 146 + DY); cx.lineTo(1034, 252 + DY); cx.fill();
      cx.fillStyle = '#241D18';
      cx.beginPath(); cx.moveTo(200, 250 + DY); cx.lineTo(605, 166 + DY); cx.lineTo(1010, 250 + DY); cx.fill();
      // murs intérieurs en planches
      const g = cx.createLinearGradient(0, 257 + DY, 0, 455 + DY);
      g.addColorStop(0, '#4E3A28'); g.addColorStop(0.35, '#7E6045'); g.addColorStop(1, '#8E6E4E');
      cx.fillStyle = g;
      cx.fillRect(204, 257 + DY, 802, 198);
      cx.strokeStyle = '#5A4330'; cx.lineWidth = 1.2;
      for (let x = 210; x < 1006; x += 22) { cx.beginPath(); cx.moveTo(x, 257 + DY); cx.lineTo(x, 455 + DY); cx.stroke(); }
      // fenêtres
      for (const wx of [232, 905]) {
        cx.fillStyle = time === 'night' ? '#1E2A40' : time === 'dawn' ? '#9C9AA4' : '#A8AFA6';
        cx.fillRect(wx, 290 + DY, 56, 54);
        cx.strokeStyle = '#2B2420'; cx.lineWidth = 4;
        cx.strokeRect(wx, 290 + DY, 56, 54);
        cx.beginPath(); cx.moveTo(wx + 28, 290 + DY); cx.lineTo(wx + 28, 344 + DY); cx.moveTo(wx, 317 + DY); cx.lineTo(wx + 56, 317 + DY); cx.stroke();
      }
      // structure
      cx.fillStyle = '#2E241B';
      cx.fillRect(78, 455 + DY, 942, 12);
      cx.fillRect(196, 249 + DY, 818, 9);
      cx.fillRect(196, 249 + DY, 8, 80);
      cx.fillRect(1006, 249 + DY, 8, 206);
      for (const px of [420, 755]) cx.fillRect(px, 249 + DY, 8, 70);
      // perron
      cx.fillStyle = P.tin;
      cx.beginPath(); cx.moveTo(62, 300 + DY); cx.lineTo(200, 276 + DY); cx.lineTo(200, 288 + DY); cx.lineTo(62, 312 + DY); cx.fill();
      cx.fillStyle = '#2E241B';
      cx.fillRect(78, 306 + DY, 6, 150);
      cx.fillRect(80, 418 + DY, 116, 4);
      for (let bx = 92; bx < 196; bx += 14) cx.fillRect(bx - 1, 420 + DY, 2, 35);
      // chambre des parents : lit et quilt de Granny
      cx.fillStyle = '#4A3826'; cx.fillRect(315, 408 + DY, 96, 26);
      cx.fillStyle = '#3A2C1E'; cx.fillRect(403, 372 + DY, 9, 83); cx.fillRect(315, 434 + DY, 6, 21);
      ['#7A2E1A', '#B8732A', '#D9A441', '#5E7A3A', '#9AA5A0', '#7A2E1A', '#D9A441'].forEach((c, i) => { cx.fillStyle = c; cx.fillRect(317 + i * 12.5, 398 + DY, 12.5, 12); });
      // chaise de Granny près de la fenêtre
      cx.fillStyle = '#2E241B';
      cx.fillRect(250, 360 + DY, 5, 95); cx.fillRect(250, 418 + DY, 26, 5); cx.fillRect(270, 423 + DY, 4, 32);
      // cuisine : poêle, seau, étagère, table, banc, chaise de Papa
      cx.fillStyle = '#151518';
      cx.beginPath(); cx.roundRect(440, 380 + DY, 56, 62, 4); cx.fill();
      cx.fillRect(444, 442 + DY, 6, 13); cx.fillRect(486, 442 + DY, 6, 13);
      cx.fillRect(463, 160 + DY, 10, 220);
      cx.beginPath(); cx.moveTo(502, 438 + DY); cx.lineTo(520, 438 + DY); cx.lineTo(517, 455 + DY); cx.lineTo(505, 455 + DY); cx.fill();
      cx.fillStyle = '#3A2C1E';
      for (const sy of [290, 318, 346]) cx.fillRect(680, sy + DY, 68, 4);
      cx.fillStyle = '#5C4A33'; cx.fillRect(600, 410 + DY, 131, 8);
      cx.fillStyle = '#3A2C1E';
      cx.fillRect(605, 418 + DY, 6, 37); cx.fillRect(722, 418 + DY, 6, 37);
      cx.fillRect(640, 430 + DY, 80, 6); cx.fillRect(645, 436 + DY, 5, 19); cx.fillRect(712, 436 + DY, 5, 19);
      cx.fillRect(746, 372 + DY, 5, 83); cx.fillRect(733, 420 + DY, 18, 5); cx.fillRect(734, 425 + DY, 4, 30);
      // chambre des garçons : lit
      cx.fillStyle = '#4A3826'; cx.fillRect(880, 408 + DY, 116, 26);
      cx.fillStyle = '#3A2C1E'; cx.fillRect(990, 372 + DY, 9, 83); cx.fillRect(880, 434 + DY, 6, 21);
      cx.fillStyle = '#8C7A64'; cx.fillRect(884, 400 + DY, 100, 10);
      // tas de bois dehors
      for (let row = 0; row < 4; row++) for (let i = 0; i < 5 - row; i++) {
        const lx = 1040 + row * 8 + i * 16, ly = 486 + DY - row * 14;
        cx.fillStyle = '#8C6A48'; cx.beginPath(); cx.arc(lx, ly, 7.5, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#5C4A33'; cx.beginPath(); cx.arc(lx, ly, 2.5, 0, Math.PI * 2); cx.fill();
      }
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, bg, 0, 0);

    // éléments variables : garde-manger, photo, violon, lampe, poêle
    const pantry = Math.min(9, Math.ceil(G.pantryHalves() / 3));
    for (let i = 0; i < pantry; i++) {
      const shelf = Math.floor(i / 3), slot = i % 3;
      ctx.fillStyle = i % 2 ? '#CDBB96' : 'rgba(201,194,180,0.8)';
      ctx.beginPath(); ctx.roundRect(686 + slot * 20, 276 + DY + shelf * 28, 13, 14, 2); ctx.fill();
    }
    ctx.fillStyle = '#7A2E1A';
    ctx.beginPath(); ctx.roundRect(728, 276 + DY, 12, 14, 2); ctx.fill(); // boîte à café
    if (G.flag('photoTaken')) {
      ctx.fillStyle = '#B3A38A'; ctx.fillRect(335, 296 + DY, 46, 34);
      ctx.strokeStyle = '#2B2420'; ctx.lineWidth = 4; ctx.strokeRect(335, 296 + DY, 46, 34);
    }
    if (o.fiddleOnWall) {
      ctx.fillStyle = P.rust;
      ctx.beginPath(); ctx.ellipse(830, 330 + DY, 11, 6, -1.2, 0, Math.PI * 2); ctx.fill();
    }
    const stove = o.stove !== false;
    if (stove) {
      ctx.fillStyle = '#E37A2C';
      ctx.beginPath(); ctx.roundRect(452, 404 + DY, 32, 14, 2); ctx.fill();
      A.glow(ctx, 469, 412 + DY, 110, 'rgba(227,122,44,0.9)', 0.35 + Math.sin(G.time * 7) * 0.04);
    }
    ctx.fillStyle = '#2B2420';
    ctx.beginPath(); ctx.roundRect(450, 364 + DY, 36, 16, 3); ctx.fill(); // marmite
    if (o.lamp) {
      ctx.strokeStyle = '#151518'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(662, 258 + DY); ctx.lineTo(662, 316 + DY); ctx.stroke();
      ctx.fillStyle = P.lamp;
      ctx.beginPath(); ctx.ellipse(662, 324 + DY, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
      A.glow(ctx, 662, 330 + DY, 220, 'rgba(246,207,120,0.9)', 0.4);
    }
    if (stove) PL.smoke(ctx, 468, 140 + DY, 4);
    if (time === 'night' && !o.lamp) {
      ctx.fillStyle = 'rgba(6,8,16,0.35)';
      ctx.fillRect(204, 257 + DY, 802, 198);
    }
  };

  // ------------------------------------------------------------------ intérieur du magasin
  PL.storeInside = (ctx) => {
    const bg = A.cached('store-inside', G.W, G.H, (cx) => {
      cx.fillStyle = '#3A2C20'; cx.fillRect(0, 0, G.W, G.H);
      const g = cx.createLinearGradient(0, 0, 0, G.H);
      g.addColorStop(0, '#2E2219'); g.addColorStop(1, '#6E5640');
      cx.fillStyle = g; cx.fillRect(0, 0, G.W, 560);
      cx.strokeStyle = 'rgba(20,14,10,0.4)'; cx.lineWidth = 1;
      for (let x = 0; x < G.W; x += 24) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 560); cx.stroke(); }
      // étagères hautes, presque pleines (le magasin, lui, a de tout)
      const rnd = U.rng(42);
      for (let s = 0; s < 4; s++) {
        const y = 110 + s * 92;
        cx.fillStyle = '#4A3826'; cx.fillRect(140, y, 1000, 10);
        for (let x = 150; x < 1120;) {
          const kind = Math.floor(rnd() * 3);
          if (kind === 0) { // boîtes de conserve
            for (let k = 0; k < 3; k++) {
              const c = U.pick(['#9C4A22', '#C98F3A', '#7D8A96', '#5E7A3A', '#B4527A']);
              cx.fillStyle = c; cx.fillRect(x + k * 19, y - 30, 17, 30);
              cx.fillStyle = '#E3D6B8'; cx.fillRect(x + k * 19, y - 22, 17, 10);
            }
            x += 62;
          } else if (kind === 1) { // bocaux
            for (let k = 0; k < 2; k++) {
              cx.fillStyle = 'rgba(200,210,205,0.55)'; cx.beginPath(); cx.roundRect(x + k * 26, y - 40, 22, 40, 5); cx.fill();
              cx.fillStyle = U.pick(['#C98F3A', '#7A2E1A', '#D9A441', '#5E7A3A']); cx.fillRect(x + k * 26 + 3, y - 26, 16, 24);
              cx.fillStyle = '#8C8C88'; cx.fillRect(x + k * 26 + 2, y - 44, 18, 6);
            }
            x += 58;
          } else { // sacs et boîtes de carton
            cx.fillStyle = '#CDBB96'; cx.beginPath(); cx.moveTo(x, y); cx.quadraticCurveTo(x + 2, y - 54, x + 22, y - 58); cx.quadraticCurveTo(x + 42, y - 54, x + 44, y); cx.fill();
            cx.fillStyle = '#8C3B2A'; cx.fillRect(x + 50, y - 34, 40, 34);
            cx.fillStyle = '#E3D6B8'; cx.fillRect(x + 56, y - 26, 28, 10);
            x += 100;
          }
          x += 8 + rnd() * 14;
        }
      }
      // fenêtre et lumière
      cx.fillStyle = '#C9C2A6'; cx.fillRect(1160, 90, 100, 200);
      A.glow(cx, 1180, 300, 380, 'rgba(240,226,180,0.8)', 0.25);
      // plancher
      cx.fillStyle = '#5A4430'; cx.fillRect(0, 560, G.W, 160);
      cx.strokeStyle = 'rgba(20,14,10,0.45)';
      for (let y = 570; y < G.H; y += 18) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(G.W, y); cx.stroke(); }
      // tonneau de biscuits, poêle
      cx.fillStyle = '#6E4E30'; cx.beginPath(); cx.roundRect(60, 470, 70, 96, 10); cx.fill();
      cx.fillStyle = '#151518'; cx.fillRect(1160, 440, 60, 120); cx.fillRect(1182, 300, 14, 140);
      A.texture(cx, G.W, G.H, 0.15);
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, bg, 0, 0);
  };
  // Le comptoir, dessiné devant les personnages (caméra à hauteur d'enfant).
  PL.storeCounter = (ctx) => {
    ctx.fillStyle = '#5C4128';
    ctx.fillRect(330, 470, 640, 120);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(316, 458, 668, 16);
    ctx.strokeStyle = 'rgba(20,14,10,0.4)'; ctx.lineWidth = 2;
    for (let x = 350; x < 970; x += 40) { ctx.beginPath(); ctx.moveTo(x, 474); ctx.lineTo(x, 590); ctx.stroke(); }
    // balance et registre
    ctx.fillStyle = '#B8A16A';
    ctx.fillRect(840, 430, 70, 28);
    ctx.fillRect(868, 404, 10, 28);
    ctx.fillStyle = '#E3D6B8';
    ctx.fillRect(400, 440, 90, 18);
  };

  // ------------------------------------------------------------------ la montagne
  PL.mountainWidth = 2600;
  PL.mountain = (ctx, cam, o = {}) => {
    const W = PL.mountainWidth;
    const time = o.time || 'day';
    PL.drawBack(ctx, cam, W, { key: `mtn-${time}`, season: 'autumn', time, seed: 31, farY: 240, midY: 320 });
    const front = A.cached(`mtn-front-${time}`, W, G.H, (cx) => {
      const rnd = U.rng(77);
      // rangée lointaine : troncs fins et pâles, feuillage clair
      for (let i = 0; i < 34; i++) {
        const tx = i * 80 + rnd() * 50;
        A.tree(cx, tx, 520 + rnd() * 20, 220 + rnd() * 140, 'rgba(70,56,44,0.55)', ['rgba(200,150,80,0.5)', 'rgba(170,90,50,0.45)', 'rgba(210,180,100,0.45)'], i + 50);
      }
      cx.fillStyle = 'rgba(210,200,185,0.18)';
      cx.fillRect(0, 380, W, 160);
      // rangée proche : gros troncs irréguliers, houppiers qui sortent du cadre
      for (let i = 0; i < 15; i++) {
        const tx = i * 180 + rnd() * 120;
        const h = 420 + rnd() * 260;
        A.tree(cx, tx, 575 + rnd() * 20, h, '#2E241D', P.autumn, i + 3);
      }
      cx.fillStyle = '#4A3B2A';
      cx.fillRect(0, 568, W, 160);
      cx.fillStyle = '#6B5640';
      cx.beginPath(); cx.moveTo(0, 576); cx.quadraticCurveTo(W / 2, 562, W, 578); cx.lineTo(W, 602); cx.quadraticCurveTo(W / 2, 588, 0, 604); cx.fill();
      A.dots(cx, 88, 700, 0, W, () => [600, 716], ['#9C4A22', '#B8732A', '#7A2E1A', '#5C4A33', '#C98F3A'], 2, 5, 0.5, 0.9);
      for (let i = 0; i < 46; i++) {
        const fx = (i * 61 + rnd() * 40) % W;
        cx.strokeStyle = i % 2 ? '#7C6A3A' : '#8E7A42'; cx.lineWidth = 2;
        for (let k = -3; k <= 3; k++) { cx.beginPath(); cx.moveTo(fx, 602); cx.quadraticCurveTo(fx + k * 6, 574, fx + k * 12, 570 + Math.abs(k) * 4); cx.stroke(); }
      }
      A.texture(cx, W, G.H, 0.14);
      if (time === 'dusk') { cx.fillStyle = 'rgba(40,20,10,0.22)'; cx.fillRect(0, 0, W, G.H); }
    }, 1);
    A.blit(ctx, front, -cam, 0);
    // rais de lumière entre les arbres
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = ((i * 520 + 200) - cam * 0.9) % (G.W + 400) - 200;
      const g = ctx.createLinearGradient(bx, 0, bx + 160, G.H);
      g.addColorStop(0, 'rgba(255,230,170,0.10)');
      g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 70, 0); ctx.lineTo(bx + 260, G.H); ctx.lineTo(bx + 120, G.H); ctx.fill();
    }
    ctx.restore();
  };
  // L'alambic de Dow, dans un creux.
  PL.still = (ctx, x, ground) => {
    ctx.fillStyle = '#9C5A2E';
    ctx.beginPath(); ctx.ellipse(x, ground - 50, 34, 40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7A4424';
    ctx.fillRect(x - 8, ground - 104, 16, 20);
    ctx.strokeStyle = '#7A4424'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, ground - 98); ctx.quadraticCurveTo(x + 60, ground - 120, x + 90, ground - 60); ctx.stroke();
    ctx.fillStyle = '#4A3826'; ctx.fillRect(x + 80, ground - 64, 40, 64);
    ctx.fillStyle = '#5A4128'; ctx.fillRect(x - 46, ground - 14, 92, 14);
    ctx.fillStyle = '#E37A2C'; ctx.fillRect(x - 20, ground - 12, 40, 8);
    A.glow(ctx, x, ground - 10, 70, 'rgba(227,122,44,0.9)', 0.3);
    PL.smoke(ctx, x, ground - 110, 7);
  };

  // ------------------------------------------------------------------ le bourg (perron du magasin), en automne
  PL.townWidth = 1600;
  PL.town = (ctx, cam, o = {}) => {
    const W = PL.townWidth;
    PL.drawBack(ctx, cam, W, { key: 'town', season: 'autumn', time: o.time || 'day', seed: 12 });
    const front = A.cached(`town-front-${o.time || 'day'}`, W, G.H, (cx) => {
      cx.fillStyle = '#4E3E2B';
      cx.beginPath(); cx.moveTo(0, 480); cx.quadraticCurveTo(W / 2, 450, W, 486); cx.lineTo(W, G.H); cx.lineTo(0, G.H); cx.fill();
      A.campHouse(cx, 60, 500, { smoke: false, w: 200, h: 96 });
      PL.storeFront(cx, 560, 600);
      A.campHouse(cx, 1260, 500, { smoke: false, w: 200, h: 96 });
      cx.fillStyle = '#5E4C36'; cx.fillRect(0, 590, W, 130);
      // flaques de la pluie de mercredi
      cx.fillStyle = 'rgba(150,170,180,0.35)';
      for (const [px, pw] of [[180, 120], [700, 90], [1180, 140]]) { cx.beginPath(); cx.ellipse(px, 650, pw, 9, 0, 0, Math.PI * 2); cx.fill(); }
      // camion de l'acheteur de racines
      cx.fillStyle = '#2E3236';
      cx.fillRect(1010, 520, 150, 60); cx.fillRect(1160, 540, 60, 40);
      cx.fillStyle = '#1A1A1C';
      for (const wx of [1040, 1180]) { cx.beginPath(); cx.arc(wx, 584, 18, 0, Math.PI * 2); cx.fill(); }
      cx.fillStyle = '#D9CFB6'; cx.fillRect(1018, 530, 126, 22);
      G.ui.text(cx, 'THORNBURY · RACINES', 1080, 541, { size: 10, color: '#2B2420', align: 'center', base: 'middle', bold: true });
      A.texture(cx, W, G.H, 0.12);
    }, 1);
    A.blit(ctx, front, -cam, 0);
  };

  // Test : la maison au petit matin avec la famille.
  G.DEV.house = () => G.play(G.Scenes.walk({
    width: G.W, floor: PL.houseFloor, start: 850, bounds: [110, 990],
    hud: { date: 'Lundi 17 octobre 1932', goal: 'Parler à M\'man', money: true },
    drawBg: (ctx) => PL.house(ctx, { time: 'dawn', lamp: true }),
    things: [
      { char: 'kenneth', x: 140, label: 'Papa', o: { dir: -1 } },
      { char: 'hattie', x: 262, label: 'Granny', o: { pose: 'sit', seatH: 37, carry: 'pipe' } },
      { char: 'ida', x: 522, label: "M'man", o: { dir: -1, arms: [0.1, 1.2] } },
      { char: 'ruth', x: 655, label: 'Ruth', o: { pose: 'sit', seatH: 25, carry: 'book' } },
      { char: 'pearl', x: 700, label: 'Pearl' },
      { char: 'wes', x: 800, label: 'Wes', o: { carry: 'fiddle', arms: [0.9, 1.3] } },
      { char: 'clay', x: 930, label: 'Clay', o: { pose: 'sit', seatH: 30, dir: -1 } },
    ],
  }));
  G.DEV.camp = () => G.play(G.Scenes.walk({
    width: PL.campWidth, floor: 640, start: 200,
    drawBg: (ctx, cam) => PL.camp(ctx, cam, { season: 'summer', time: 'summer' }),
    things: [{ char: 'nora', x: 420, label: 'Mrs. Napier', o: { dir: -1 } }],
  }));
  G.DEV.walktest = () => G.DEV.camp();
  G.DEV.mill = () => G.play(G.Scenes.walk({
    width: PL.millWidth, floor: 640, start: 200,
    drawBg: (ctx, cam) => PL.millYard(ctx, cam),
    things: [{ char: 'kenneth', x: 900, label: 'Papa', o: { pose: 'sit', seatH: 40 } }],
  }));
  G.DEV.mountain = () => G.play(G.Scenes.walk({
    width: PL.mountainWidth, floor: 590, start: 200, followers: [{ char: 'hattie', gap: 90, o: { carry: 'pipe' } }],
    drawBg: (ctx, cam) => { PL.mountain(ctx, cam); PL.still(ctx, 2300 - cam, 590); },
  }));
  G.DEV.town = () => G.play(G.Scenes.walk({
    width: PL.townWidth, floor: 640, start: 300,
    drawBg: (ctx, cam) => PL.town(ctx, cam),
    things: [{ char: 'thornbury', x: 940, label: 'M. Thornbury', o: { dir: -1 } }, { char: 'whitcomb', x: 480, label: 'M. Whitcomb' }],
  }));
  G.DEV.store = () => G.play(G.makeScene({ draw(ctx) { PL.storeInside(ctx); G.art.char(ctx, 'pruitt', 650, 560, { dir: -1 }); PL.storeCounter(ctx); G.art.finish(ctx); } }));
})();
