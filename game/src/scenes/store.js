'use strict';
// Mini-jeu « La liste de M'man » : faire les courses au magasin de la compagnie
// avec quelques cents, sans crédit si possible.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  // halves : demi-bols de nourriture. tag : famille d'aliment (variété).
  const ITEMS = (G.STORE_ITEMS = [
    { id: 'meal10', name: 'Farine de maïs', qty: '10 livres', price: 28, halves: 10, tag: 'grain', note: '5 bols de pain de maïs' },
    { id: 'meal5', name: 'Farine de maïs', qty: '5 livres', price: 15, halves: 5, tag: 'grain', note: '2 bols et demi' },
    { id: 'lard', name: 'Lard salé', qty: '1 livre', price: 10, halves: 2, tag: 'gras', note: '1 bol, et du goût' },
    { id: 'beans', name: 'Haricots secs', qty: '2 livres', price: 11, halves: 4, tag: 'haricots', note: '2 bols' },
    { id: 'potatoes', name: 'Pommes de terre', qty: '5 livres', price: 9, halves: 3, tag: 'legume', note: '1 bol et demi' },
    { id: 'milk', name: 'Lait concentré', qty: '1 boîte', price: 8, halves: 1, tag: 'lait', note: 'Pour Pearl' },
    { id: 'coffee', name: 'Café', qty: '¼ de livre', price: 8, halves: 0, tag: null, note: 'Pour Papa' },
    { id: 'molasses', name: 'Mélasse', qty: '1 chopine', price: 9, halves: 1, tag: 'sucre', note: 'Un peu de douceur' },
    { id: 'kerosene', name: 'Pétrole', qty: '½ gallon', price: 7, halves: 0, tag: null, note: 'Pour la lampe' },
    { id: 'candy', name: 'Sucre d\'orge', qty: '1 bâton', price: 1, halves: 0, tag: null, note: 'Pour Pearl' },
  ]);
  const REMARK = {
    meal10: 'Le grand sac. Ta mère est raisonnable.',
    meal5: 'Le petit sac, hein.',
    lard: 'Du lard. Ça tient au corps.',
    beans: 'Les haricots, c\'est ce qui part le plus, ces temps-ci.',
    potatoes: 'Les dernières de la saison.',
    milk: 'Le lait en boîte, c\'est ce qu\'il y a de mieux pour les petits.',
    coffee: 'Du café ? Ton père a encore du goût, au moins.',
    molasses: 'De la mélasse. On se fait plaisir.',
    kerosene: 'Le pétrole a encore augmenté. C\'est pas moi qui fixe les prix.',
    candy: 'Un sucre d\'orge. Pour la petite, je parie.',
  };

  const PANEL = { x: 40, y: 246, w: 1200, h: 456 };
  const cardRect = (i) => ({ x: 64 + (i % 4) * 226, y: 334 + Math.floor(i / 4) * 118, w: 212, h: 106 });
  const BASKET = { x: 980, y: 334 };

  G.Scenes.store = (opts = {}) => G.makeScene({
    enter() {
      this.cash = opts.cash != null ? opts.cash : 40;
      this.basket = [];
      this.phase = 'intro';
      this.focus = 0;
      this.remark = 'Qu\'est-ce qu\'il te faut, petit ?';
      this.remarkT = 0;
      this.nora = opts.nora !== false ? { x: 420, leaving: false, phase: 0 } : null;
      G.audio.amb(['room']);
      G.audio.song(null);
      G.audio.sfx('bell');
      this.go();
    },
    async go() {
      await G.wait(0.8);
      if (opts.intro) await opts.intro(this);
      if (opts.getCash) this.cash = opts.getCash();
      if (this.nora) { this.nora.leaving = true; G.audio.sfx('bell', 1.2); }
      this.phase = 'shop';
    },
    total() { return this.basket.reduce((a, id) => a + ITEMS.find((it) => it.id === id).price, 0); },
    toggle(i) {
      const it = ITEMS[i];
      const k = this.basket.indexOf(it.id);
      if (k >= 0) { this.basket.splice(k, 1); G.audio.sfx('click'); return; }
      this.basket.push(it.id);
      G.audio.sfx('tick');
      this.remark = REMARK[it.id];
      this.remarkT = 0;
    },
    canCredit() {
      const over = this.total() - this.cash;
      return over > 0 && G.state.ardoise + over <= G.state.creditLimit;
    },
    pay(credit) {
      const total = this.total();
      const fromCash = Math.min(total, this.cash);
      const onCredit = credit ? total - fromCash : 0;
      G.audio.sfx('coin');
      this.phase = 'done';
      this.result = { items: [...this.basket], spent: fromCash, credit: onCredit };
      this.remark = onCredit > 0
        ? `Je marque ${U.money(onCredit)} sur l'ardoise. Ça fait ${U.money(G.state.ardoise + onCredit)}.`
        : total === 0 ? 'Rien ? Comme tu veux.' : 'Ça fait le compte. Dis bonjour à ta mère.';
      this.remarkT = 0;
      this.outro();
    },
    async outro() {
      await G.wait(1.6);
      if (opts.outro) await opts.outro(this);
      this.finish(this.result);
    },
    buttons() {
      const total = this.total();
      const b = [];
      b.push({ id: 'pay', t: 'Payer comptant', r: { x: BASKET.x, y: 596, w: 236, h: 44 }, disabled: total === 0 || total > this.cash });
      if (total > this.cash) b.push({ id: 'credit', t: 'Le reste à l\'ardoise', r: { x: BASKET.x, y: 648, w: 236, h: 40 }, disabled: !this.canCredit() });
      else b.push({ id: 'none', t: 'Ne rien acheter', r: { x: BASKET.x, y: 648, w: 236, h: 40 }, disabled: total > 0 });
      return b;
    },
    update(dt) {
      this.remarkT += dt;
      if (this.nora && this.nora.leaving) {
        this.nora.x -= 140 * dt;
        this.nora.phase = (this.nora.phase + dt * 0.9) % 1;
        if (this.nora.x < -80) this.nora = null;
      }
      if (this.phase !== 'shop' || G.blocked) return;
      for (let i = 0; i < ITEMS.length; i++) if (ui.hit(cardRect(i))) { this.focus = i; this.toggle(i); }
      if (I.hit('ArrowRight')) this.focus = Math.min(ITEMS.length - 1, this.focus + 1);
      if (I.hit('ArrowLeft')) this.focus = Math.max(0, this.focus - 1);
      if (I.hit('ArrowDown')) this.focus = Math.min(ITEMS.length - 1, this.focus + 4);
      if (I.hit('ArrowUp')) this.focus = Math.max(0, this.focus - 4);
      if (I.hit('Space')) this.toggle(this.focus);
      for (const b of this.buttons()) {
        if (b.disabled || !ui.hit(b.r)) continue;
        if (b.id === 'pay' || b.id === 'none') this.pay(false);
        if (b.id === 'credit') this.pay(true);
      }
      if (I.hit('Enter')) {
        const t = this.total();
        if (t > 0 && t <= this.cash) this.pay(false);
      }
    },
    draw(ctx) {
      G.places.storeInside(ctx);
      A.char(ctx, 'pruitt', 700, 470, { dir: -1, arms: [0.2, 0.9] });
      if (this.nora) A.char(ctx, 'nora', this.nora.x, 640, { dir: this.nora.leaving ? -1 : 1, pose: this.nora.leaving ? 'walk' : 'stand', phase: this.nora.phase, carry: 'basket' });
      G.places.storeCounter(ctx);
      A.char(ctx, 'henry', 230, 640, { dir: 1, rim: true });
      A.finish(ctx);
    },
    drawUI(c) {
      if (this.phase === 'intro') { ui.drawHud(c); return; }
      c.save();
      c.fillStyle = 'rgba(18,14,12,0.94)';
      c.beginPath(); c.roundRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 10); c.fill();
      // en-tête : la remarque de Pruitt et ce qu'Henry a en poche
      ui.caps(c, 'Mr. Pruitt', PANEL.x + 24, PANEL.y + 32, { size: 14, color: G.WHO.pruitt.color });
      ui.text(c, `« ${this.remark} »`, PANEL.x + 24, PANEL.y + 64, { size: 23, italic: true, alpha: Math.min(1, this.remarkT * 4 + 0.3) });
      ui.text(c, `Dans ta poche : ${U.money(this.cash)}`, PANEL.x + PANEL.w - 24, PANEL.y + 34, { size: 22, align: 'right' });
      ui.text(c, `Ardoise : ${U.money(G.state.ardoise)} (crédit coupé à ${U.money(G.state.creditLimit)})`, PANEL.x + PANEL.w - 24, PANEL.y + 62, { size: 17, italic: true, align: 'right', color: '#BFB4A0' });
      c.restore();
      ui.notebook(c, 64, 196, 560, [{ t: 'M\'man : farine de maïs, lard, haricots si ça suffit. PAS de crédit !', size: 21 }], { rot: -0.006, lineH: 24 });

      ITEMS.forEach((it, i) => {
        const r = cardRect(i);
        const inB = this.basket.includes(it.id);
        const foc = this.focus === i && !I.mouse;
        const hov = ui.hover(r);
        c.save();
        c.fillStyle = inB ? '#F4EAD2' : hov ? '#EDE3CC' : '#E2D7BE';
        c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 6); c.fill();
        c.strokeStyle = inB ? P.rust : foc ? P.rim : 'rgba(31,26,23,0.35)';
        c.lineWidth = inB || foc ? 3 : 1;
        c.stroke();
        // œillet d'étiquette
        c.fillStyle = 'rgba(31,26,23,0.25)';
        c.beginPath(); c.arc(r.x + 14, r.y + 14, 4, 0, Math.PI * 2); c.fill();
        ui.text(c, it.name, r.x + 26, r.y + 36, { size: it.name.length > 13 ? 18 : 21, color: P.ink, bold: true });
        ui.text(c, it.qty, r.x + 26, r.y + 60, { size: 17, color: '#5C4A33', italic: true });
        ui.text(c, U.money(it.price), r.x + r.w - 14, r.y + 36, { size: 30, kind: 'hand', color: '#2A3A5A', align: 'right' });
        ui.text(c, it.note, r.x + 26, r.y + 90, { size: 16, italic: true, color: P.rust });
        if (inB) ui.text(c, '✓', r.x + r.w - 20, r.y + 92, { size: 24, color: P.rust, align: 'right' });
        c.restore();
      });

      // le panier
      ui.caps(c, 'Ton panier', BASKET.x, BASKET.y + 6, { size: 14, color: P.rim });
      let y = BASKET.y + 40;
      if (!this.basket.length) ui.text(c, 'Vide.', BASKET.x, y, { size: 19, italic: true, color: '#9B917F' });
      for (const id of this.basket) {
        const it = ITEMS.find((x) => x.id === id);
        ui.text(c, it.name + (it.id === 'meal10' || it.id === 'meal5' ? ` (${it.qty})` : ''), BASKET.x, y, { size: 17, maxW: 170 });
        ui.text(c, U.money(it.price), BASKET.x + 236, y, { size: 17, align: 'right' });
        y += 22;
      }
      const total = this.total();
      c.fillStyle = 'rgba(232,223,204,0.3)';
      c.fillRect(BASKET.x, 556, 236, 1);
      ui.text(c, 'Total', BASKET.x, 580, { size: 21 });
      ui.text(c, U.money(total), BASKET.x + 236, 580, { size: 21, align: 'right', color: total > this.cash ? P.ember : P.paper });
      for (const b of this.buttons()) ui.button(c, b.r, b.t, { disabled: b.disabled, size: 19 });
      if (this.phase === 'shop') ui.hint(c, 'Clique sur une étiquette pour la mettre au panier', { y: 150, size: 18 });
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.storegame = () => G.play(G.Scenes.store({ cash: 40 }));
})();
