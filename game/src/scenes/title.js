'use strict';
// Écran d'accueil (« Clique pour entrer », nécessaire pour le son) puis écran titre.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  // Vallée au crépuscule, en couches de plus en plus sombres.
  function valley(ctx) {
    const bg = A.cached('title-valley', G.W, G.H, (cx) => {
      A.sky(cx, G.W, G.H, [[0, '#2A3346'], [0.5, '#6C6F78'], [0.78, '#C99A6A'], [1, '#D9A86A']]);
      const layers = [
        { y: 330, amp: 40, c: '#5E6672', seed: 4 },
        { y: 380, amp: 46, c: '#4A4A50', seed: 8 },
        { y: 440, amp: 36, c: '#3A332E', seed: 13 },
        { y: 520, amp: 30, c: '#2A221D', seed: 19 },
      ];
      layers.forEach((l, i) => {
        const pts = A.makeRidge(l.seed, G.W, l.y, l.amp, 160);
        A.ridge(cx, pts, l.c, G.H);
        if (i >= 1) A.dots(cx, l.seed + 1, 90 + i * 30, 0, G.W, (x) => [A.ridgeY(pts, x) + 2, A.ridgeY(pts, x) + 60], i === 1 ? ['#6A5A50', '#7A6656'] : ['#7A2E1A', '#9C4A22', '#5C4A33', '#B8732A'], 5, 11, 0.35, 0.7);
      });
      // cheminée de l'usine, éteinte
      cx.fillStyle = '#231C18';
      cx.beginPath(); cx.moveTo(930, 470); cx.lineTo(938, 300); cx.lineTo(954, 300); cx.lineTo(962, 470); cx.fill();
      cx.fillRect(934, 292, 24, 10);
      A.texture(cx, G.W, G.H, 0.16);
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, bg, 0, 0);
    // maison éclairée sur sa pente
    A.campHouse(ctx, 250, 560, { lit: true, w: 170, h: 80, wall: '#3A2E24', roof: '#252A32', stilt: 30 });
    // lucioles tardives
    for (let i = 0; i < 14; i++) {
      const t = G.time * 0.4 + i * 1.7;
      const x = 120 + ((i * 97) % 1040) + Math.sin(t) * 18;
      const y = 520 + ((i * 53) % 160) + Math.cos(t * 1.3) * 10;
      const a = 0.4 + 0.4 * Math.sin(t * 2.3 + i);
      A.glow(ctx, x, y, 10, 'rgba(233,226,122,1)', Math.max(0, a) * 0.6);
    }
  }

  G.Scenes.title = (opts = {}) => G.makeScene({
    colorOverride: { sat: 1, sepia: 0.08 },
    enter() {
      this.phase = G.audio.ctx ? 'menu' : 'gate';
      this.k = 0;
      this.hasSave = !!opts.hasSave;
      this.focus = 0;
      if (this.phase === 'menu') this.startMusic();
    },
    startMusic() {
      G.audio.amb(['wind', 'night']);
      G.audio.song(G.audio.SONGS.valley, { fadeIn: 3 });
    },
    buttons() {
      const list = [];
      if (this.hasSave) list.push({ id: 'continue', t: 'Reprendre' });
      list.push({ id: 'new', t: this.hasSave ? 'Recommencer l\'épisode' : 'Commencer' });
      list.push({ id: 'sound', t: G.audio.muted ? 'Son : coupé' : 'Son : activé' });
      list.push({ id: 'full', t: G.isFullscreen() ? 'Quitter le plein écran' : 'Plein écran (F)' });
      const y0 = list.length > 3 ? 392 : 430;
      return list.map((b, i) => Object.assign(b, { r: { x: G.W / 2 - 160, y: y0 + i * 60, w: 320, h: 48 } }));
    },
    update(dt) {
      this.k = Math.min(1, this.k + dt * 0.5);
      if (G.blocked) return;
      if (this.phase === 'gate') {
        if (I.confirm()) {
          I.consume();
          G.audio.unlock();
          this.phase = 'menu';
          this.k = 0;
          this.startMusic();
        }
        return;
      }
      const bs = this.buttons();
      if (I.hit('ArrowDown')) this.focus = (this.focus + 1) % bs.length;
      if (I.hit('ArrowUp')) this.focus = (this.focus - 1 + bs.length) % bs.length;
      let pick = null;
      bs.forEach((b, i) => { if (ui.hit(b.r)) pick = b; if (ui.hover(b.r)) this.focus = i; });
      if (!pick && (I.hit('Enter') || I.hit('Space'))) pick = bs[this.focus];
      if (!pick) return;
      G.audio.sfx('click');
      if (pick.id === 'sound') { G.audio.toggleMute(); return; }
      if (pick.id === 'full') { G.toggleFullscreen(); return; }
      this.finish({ action: pick.id });
    },
    draw(ctx) {
      valley(ctx);
      A.finish(ctx, { grain: 0.05 });
    },
    drawUI(c) {
      if (this.phase === 'gate') {
        c.fillStyle = 'rgba(10,8,7,0.72)';
        c.fillRect(0, 0, G.W, G.H);
        const a = 0.55 + 0.45 * Math.sin(G.time * 2.4);
        ui.text(c, 'Clique ou appuie sur Espace pour entrer', G.W / 2, G.H / 2, { size: 28, italic: true, align: 'center', base: 'middle', color: `rgba(232,223,204,${a})` });
        ui.text(c, 'Avec un casque, c\'est mieux.', G.W / 2, G.H / 2 + 46, { size: 19, italic: true, align: 'center', color: 'rgba(232,223,204,0.5)' });
        return;
      }
      const a = U.smooth(this.k);
      c.globalAlpha = a;
      ui.caps(c, 'Kentucky · 1932', G.W / 2, 170, { align: 'center', size: 16, color: 'rgba(232,223,204,0.7)', spacing: 6 });
      ui.text(c, 'Tant qu’on est là', G.W / 2, 262, { size: 92, align: 'center', base: 'alphabetic', shadow: true });
      ui.text(c, 'Épisode 1 · Le dernier sifflet', G.W / 2, 322, { size: 30, italic: true, align: 'center', color: '#E2CFA8', shadow: true });
      const bs = this.buttons();
      bs.forEach((b, i) => ui.button(c, b.r, b.t, { hover: this.focus === i && (I.mouse ? ui.hover(b.r) || !bs.some((o) => ui.hover(o.r)) : true), size: 24 }));
      ui.text(c, 'Souris, clavier ou toucher. F : plein écran. Échap : menu en cours de partie.', G.W / 2, G.H - 34, { size: 16, italic: true, align: 'center', color: 'rgba(232,223,204,0.45)' });
      c.globalAlpha = 1;
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.title = () => G.play(G.Scenes.title({ hasSave: false }));
})();
