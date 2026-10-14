'use strict';
// Interface : texte, boutons, notifications, carnet d'Henry, consignes.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = (G.ui = {});

  G.FONT = {
    serif: "'EB Garamond', Georgia, 'Times New Roman', serif",
    hand: "'Caveat', 'Segoe Print', 'Bradley Hand', cursive",
  };
  ui.font = (size, kind = 'serif', style = '') => `${style} ${size}px ${G.FONT[kind] || G.FONT.serif}`.trim();

  const wrapCache = new Map();
  ui.wrap = (ctx, str, maxW) => {
    const key = ctx.font + '|' + maxW + '|' + str;
    if (wrapCache.has(key)) return wrapCache.get(key);
    const out = [];
    for (const para of String(str).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      out.push(line);
    }
    if (wrapCache.size > 600) wrapCache.clear();
    wrapCache.set(key, out);
    return out;
  };

  // Texte avec retour à la ligne. Renvoie la hauteur occupée.
  ui.text = (ctx, str, x, y, o = {}) => {
    const size = o.size || 22;
    const style = `${o.italic ? 'italic ' : ''}${o.bold ? '600 ' : ''}`;
    ctx.font = ui.font(size, o.kind || 'serif', style);
    ctx.fillStyle = o.color || G.PAL.paper;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    const prevA = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevA * o.alpha;
    const lh = o.lineH || size * 1.28;
    const lines = o.maxW ? ui.wrap(ctx, str, o.maxW) : String(str).split('\n');
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6; }
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    ctx.shadowBlur = 0;
    ctx.globalAlpha = prevA;
    return { h: lines.length * lh, lines };
  };

  // Petites capitales espacées (étiquettes).
  ui.caps = (ctx, str, x, y, o = {}) => {
    const size = o.size || 14;
    ctx.font = ui.font(size, 'serif', '600');
    ctx.fillStyle = o.color || G.PAL.paper;
    ctx.textAlign = 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    const s = String(str).toUpperCase();
    const sp = o.spacing != null ? o.spacing : size * 0.18;
    let w = 0;
    for (const ch of s) w += ctx.measureText(ch).width + sp;
    w -= sp;
    let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const prevA = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevA * o.alpha;
    for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
    ctx.globalAlpha = prevA;
    return w;
  };

  // ------------------------------------------------------------------ boutons
  ui.hover = (r) => I.mouse && U.inRect(I, r);
  // Clic dans un rectangle. overlay=true : utilisable depuis une superposition modale.
  ui.hit = (r, overlay = false) => (overlay || !G.blocked) && I.pressed && U.inRect(I, r);

  ui.button = (ctx, r, label, o = {}) => {
    const hov = o.hover != null ? o.hover : ui.hover(r);
    const disabled = !!o.disabled;
    ctx.save();
    if (o.style === 'paper') {
      ctx.fillStyle = disabled ? 'rgba(232,223,204,0.45)' : hov ? '#F3ECDB' : G.PAL.paper;
      ctx.strokeStyle = hov ? G.PAL.rust : 'rgba(31,26,23,0.5)';
    } else {
      ctx.fillStyle = disabled ? 'rgba(31,26,23,0.55)' : hov ? 'rgba(52,42,34,0.96)' : 'rgba(31,26,23,0.9)';
      ctx.strokeStyle = hov ? G.PAL.rim : 'rgba(232,223,204,0.35)';
    }
    ctx.lineWidth = hov ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.stroke();
    const color = o.style === 'paper' ? G.PAL.ink : disabled ? 'rgba(232,223,204,0.45)' : G.PAL.paper;
    ui.text(ctx, label, r.x + (o.align === 'left' ? 18 : r.w / 2), r.y + r.h / 2 + 1, {
      size: o.size || 22, color, align: o.align === 'left' ? 'left' : 'center', base: 'middle', italic: o.italic,
    });
    if (o.key) ui.text(ctx, o.key, r.x + r.w - 14, r.y + r.h / 2 + 1, { size: 15, color: 'rgba(232,223,204,0.45)', align: 'right', base: 'middle' });
    ctx.restore();
    return hov;
  };

  // ------------------------------------------------------------------ notifications
  const toasts = [];
  ui.toast = (text, o = {}) => toasts.push({ text, t: 0, life: o.life || 2.8, color: o.color });
  ui.drawToasts = (ctx, dt) => {
    let y = 66;
    for (let i = 0; i < toasts.length; i++) {
      const t = toasts[i];
      t.t += dt;
      const a = Math.min(1, t.t * 4) * Math.min(1, (t.life - t.t) * 2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = ui.font(20, 'serif', 'italic');
      const w = ctx.measureText(t.text).width + 36;
      ctx.fillStyle = 'rgba(31,26,23,0.88)';
      ctx.beginPath();
      ctx.roundRect(G.W - w - 24, y, w, 38, 6);
      ctx.fill();
      ui.text(ctx, t.text, G.W - 24 - 18, y + 20, { size: 20, italic: true, align: 'right', base: 'middle', color: t.color || G.PAL.paper });
      ctx.restore();
      y += 46;
    }
    for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].t > toasts[i].life) toasts.splice(i, 1);
  };

  // ------------------------------------------------------------------ carnet d'Henry (HUD)
  // Petite page de cahier en haut à gauche : la date et l'objectif du moment.
  ui.notebook = (ctx, x, y, w, lines, o = {}) => {
    const lh = o.lineH || 26;
    const h = 18 + lines.length * lh + 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot != null ? o.rot : -0.012);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#EFE8D6';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#9AB0C0';
    ctx.lineWidth = 1;
    for (let i = 0; i < lines.length; i++) {
      ctx.beginPath(); ctx.moveTo(6, 22 + i * lh + 6); ctx.lineTo(w - 6, 22 + i * lh + 6); ctx.stroke();
    }
    ctx.strokeStyle = '#C0605A';
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(26, h); ctx.stroke();
    lines.forEach((l, i) => {
      const txt = typeof l === 'string' ? l : l.t;
      ui.text(ctx, txt, 34, 22 + i * lh, { size: (typeof l === 'object' && l.size) || 22, kind: 'hand', color: (typeof l === 'object' && l.color) || '#2A3A5A' });
    });
    ctx.restore();
    return h;
  };

  // HUD standard : date + objectif + cagnotte du loyer.
  G.hud = { date: '', goal: '', show: true, money: false };
  ui.drawHud = (ctx) => {
    if (!G.hud.show || !G.hud.date) return;
    const lines = [{ t: G.hud.date, size: 24 }];
    if (G.hud.goal) lines.push(G.hud.goal);
    if (G.hud.money) lines.push(`Loyer de samedi : ${U.money(G.state.money)} / ${U.money(G.state.rent)}`);
    ui.notebook(ctx, 22, 18, 380, lines);
  };

  // Consigne de mini-jeu en haut au centre.
  ui.hint = (ctx, text, o = {}) => {
    ctx.save();
    ctx.font = ui.font(o.size || 21, 'serif', 'italic');
    const w = ctx.measureText(text).width + 44;
    const x = G.W / 2 - w / 2, y = o.y || 20;
    ctx.fillStyle = 'rgba(20,16,13,0.82)';
    ctx.beginPath(); ctx.roundRect(x, y, w, 40, 20); ctx.fill();
    ui.text(ctx, text, G.W / 2, y + 21, { size: o.size || 21, italic: true, align: 'center', base: 'middle' });
    ctx.restore();
  };

  // Étiquette au-dessus d'un élément interactif.
  ui.tag = (ctx, text, x, y, o = {}) => {
    ctx.save();
    ctx.font = ui.font(18, 'serif', 'italic');
    const w = ctx.measureText(text).width + 24;
    const bob = Math.sin(G.time * 3) * 2;
    ctx.fillStyle = o.active ? 'rgba(242,210,122,0.95)' : 'rgba(232,223,204,0.88)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 30 + bob, w, 28, 14); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y - 3 + bob); ctx.lineTo(x + 6, y - 3 + bob); ctx.lineTo(x, y + 4 + bob); ctx.fill();
    ui.text(ctx, text, x, y - 16 + bob, { size: 18, italic: true, color: G.PAL.ink, align: 'center', base: 'middle' });
    ctx.restore();
  };

  // Jauge horizontale simple.
  ui.bar = (ctx, x, y, w, h, v, o = {}) => {
    ctx.save();
    ctx.fillStyle = o.bg || 'rgba(20,16,13,0.75)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = o.color || G.PAL.gold;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * U.clamp(v, 0, 1)), h, h / 2); ctx.fill();
    ctx.restore();
  };
})();

// Chargement des polices (avec délai maximal : le jeu démarre quand même hors ligne).
(function () {
  const G = window.G;
  G.loadFonts = () => {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const loads = ['27px "EB Garamond"', 'italic 27px "EB Garamond"', '600 15px "EB Garamond"', '22px "Caveat"']
      .map((f) => document.fonts.load(f).catch(() => null));
    return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
  };
})();

// Plein écran : bouton du titre, menu pause et touche F.
(function () {
  const G = window.G;
  const el = document.documentElement;
  G.isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  G.toggleFullscreen = () => {
    try {
      if (G.isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
      }
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) throw new Error('indisponible');
      const p = req.call(el);
      if (p && p.catch) p.catch(() => G.ui.toast('Plein écran refusé ici : appuie sur F11.'));
    } catch (_) {
      G.ui.toast('Plein écran indisponible ici : appuie sur F11.');
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) G.toggleFullscreen();
  });
})();
