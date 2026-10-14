'use strict';
// Fin d'épisode : la photo de famille et le récapitulatif des choix.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  G.Scenes.summary = (opts = {}) => G.makeScene({
    colorOverride: { sat: 1, sepia: 0 },
    enter() {
      this.rows = opts.rows || [];
      G.audio.amb(['wind']);
      G.audio.song(G.audio.SONGS.valley, { fadeIn: 2 });
    },
    btn() { return { x: 760, y: G.H - 84, w: 300, h: 50 }; },
    update() {
      if (G.blocked || this.t < 1.5) return;
      if (ui.hit(this.btn()) || I.hit('Enter')) this.finish({ action: 'title' });
    },
    draw(ctx) {
      const bg = A.cached('summary-bg', G.W, G.H, (cx) => {
        const g = cx.createLinearGradient(0, 0, G.W, G.H);
        g.addColorStop(0, '#2A211A'); g.addColorStop(1, '#14100D');
        cx.fillStyle = g; cx.fillRect(0, 0, G.W, G.H);
        cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 2;
        for (let y = 0; y < G.H; y += 34) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(G.W, y + 6); cx.stroke(); }
        A.texture(cx, G.W, G.H, 0.25);
      }, 1);
      A.blit(ctx, bg, 0, 0);
      A.glow(ctx, 340, 330, 420, 'rgba(246,207,120,0.7)', 0.18);
    },
    drawUI(c) {
      // la photo, posée de travers sur la table
      const ph = G.familyPhoto;
      c.save();
      c.translate(350, 340);
      c.rotate(-0.04);
      c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 24; c.shadowOffsetY = 8;
      if (ph) {
        const w = 560, h = w * ph.height / ph.width;
        c.drawImage(ph, -w / 2, -h / 2, w, h);
      } else {
        c.fillStyle = '#E8DFCC'; c.fillRect(-280, -190, 560, 380);
        c.shadowBlur = 0;
        c.fillStyle = '#B3A38A'; c.fillRect(-256, -166, 512, 300);
      }
      c.restore();

      const a = Math.min(1, this.t * 1.2);
      c.globalAlpha = a;
      ui.caps(c, 'Fin de l\'épisode 1', 700, 82, { size: 15, color: 'rgba(232,223,204,0.65)', spacing: 5 });
      ui.text(c, 'Le dernier sifflet', 700, 134, { size: 50 });
      c.globalAlpha = 1;
      let y = 186;
      this.rows.forEach((r, i) => {
        const k = U.clamp((this.t - 0.6 - i * 0.18) * 3, 0, 1);
        if (k <= 0) return;
        c.globalAlpha = k;
        ui.caps(c, r.label, 700, y, { size: 12, color: 'rgba(232,223,204,0.55)' });
        ui.text(c, r.value, 700, y + 25, { size: 21, maxW: 540, color: r.good === false ? '#E9A07A' : r.good ? '#CFE0B0' : P.paper });
        c.globalAlpha = 1;
        y += 52;
      });
      if (this.t > 1.5) {
        ui.text(c, opts.teaser || '', 700, G.H - 112, { size: 19, italic: true, color: 'rgba(232,223,204,0.7)' });
        ui.button(c, this.btn(), 'Revenir à l\'écran titre', { size: 21 });
      }
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.summary = () => G.play(G.Scenes.summary({
    rows: [{ label: 'Loyer de samedi', value: 'Payé : 8,00 $', good: true }, { label: 'Mrs. Napier', value: 'Tu lui as donné 5 ¢. Elle s\'en souviendra.' }],
    teaser: 'Épisode 2 · Le charbon des voies — décembre 1932',
  }));
})();
