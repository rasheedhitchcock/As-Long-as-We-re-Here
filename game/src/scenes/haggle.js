'use strict';
// Mini-jeu « Le marchand de racines » : vendre le ginseng à M. Thornbury.
// On pousse sa chance : demander plus, montrer la qualité, faire mine de partir.
// Sa patience se lit à sa pipe et à ses gestes.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  const LINES = {
    open: 'Voyons ça. Racines fraîches, pas séchées… Je t\'en donne {offer}.',
    up: ['Bon. {offer}, et c\'est bien parce que t\'as une bonne tête.', 'Tu marchandes comme ta grand-mère. {offer}.', 'Allez. {offer}.'],
    refuse: ['Tu me prends pour la Croix-Rouge ?', 'Non, petit. Ça vaut pas ça.', 'Ho. On se calme.'],
    last: 'Mon dernier prix, petit : {offer}. Après, je remonte dans mon camion.',
    show: 'Hm. Les radicelles sont intactes. Ça, c\'est du travail propre. Je peux monter un peu.',
    showBad: 'Je les ai vues, tes radicelles. Justement.',
    leaveBack: 'Attends, attends ! Reviens. {offer}, et on n\'en parle plus.',
    leaveGone: 'Comme tu veux. Pruitt t\'en donnera la moitié.',
    deal: 'Marché conclu.',
  };
  const fill = (s, offer) => s.replace('{offer}', U.money(offer));

  G.Scenes.haggle = (opts = {}) => G.makeScene({
    enter() {
      const roots = opts.roots && opts.roots.length ? opts.roots : [{ quality: 0.8 }, { quality: 0.6 }];
      this.roots = roots;
      this.avgQ = roots.reduce((a, r) => a + r.quality, 0) / roots.length;
      this.value = roots.reduce((a, r) => a + Math.round(100 + 90 * r.quality), 0);
      this.max = Math.round(this.value * U.rand(0.95, 1.05));
      this.offer = Math.round(this.value * 0.58 / 5) * 5;
      this.patience = 3;
      this.shown = false;
      this.final = false;
      this.phase = 'talk';
      this.line = fill(LINES.open, this.offer);
      this.lineT = 0;
      this.puff = 0;
      this.mood = 0; // 0 calme, 1 agacé, 2 à bout
      this.history = [];
      G.audio.amb(['wind', 'birds']);
    },
    say(s) { this.line = s; this.lineT = 0; },
    annoy() {
      this.patience--;
      this.mood = this.patience >= 2 ? 0 : this.patience === 1 ? 1 : 2;
      this.puff = 1;
      G.audio.sfx('knock');
    },
    ask(step) {
      if (this.final) {
        this.say(LINES.leaveGone);
        this.done(Math.round(this.value * 0.45 / 5) * 5, 'pruitt');
        return;
      }
      const want = this.offer + step;
      // Il accepte tant qu'on reste sous son plafond ; il rogne un peu la demande.
      if (want <= this.max && (step <= 15 || Math.random() < 0.75)) {
        const gain = step <= 15 ? step : Math.round(step * U.rand(0.5, 0.9) / 5) * 5;
        this.offer = Math.min(this.max, this.offer + Math.max(5, gain));
        this.say(fill(U.pick(LINES.up), this.offer));
        if (this.max - this.offer < 30 || step > 15) this.annoy();
        G.audio.sfx('coin');
      } else {
        this.say(U.pick(LINES.refuse));
        this.annoy();
      }
      if (this.patience <= 0 && !this.final) {
        this.final = true;
        this.say(fill(LINES.last, this.offer));
      }
    },
    show() {
      this.shown = true;
      if (this.avgQ >= 0.6) {
        this.max = Math.round(this.max * 1.12);
        this.patience = Math.min(3, this.patience + 1);
        this.mood = Math.max(0, this.mood - 1);
        this.say(LINES.show);
      } else {
        this.max = Math.round(this.max * 0.95);
        this.say(LINES.showBad);
        this.annoy();
      }
    },
    leave() {
      if (!this.final && this.patience >= 2 && this.offer < this.max) {
        this.offer = Math.min(this.max, Math.round((this.offer + (this.max - this.offer) * 0.6) / 5) * 5);
        this.final = true;
        this.say(fill(LINES.leaveBack, this.offer));
        G.audio.sfx('coin');
      } else {
        this.say(LINES.leaveGone);
        this.done(Math.round(this.value * 0.45 / 5) * 5, 'pruitt');
      }
    },
    done(cents, to) {
      this.phase = 'done';
      this.result = { cents, soldTo: to };
      if (to === 'thornbury') { this.say(LINES.deal); G.audio.sfx('coin'); }
      G.after(2.2, () => this.finish(this.result));
    },
    buttons() {
      const b = [
        { id: 'accept', t: `Accepter ${U.money(this.offer)}` },
        { id: 'ask10', t: 'Demander 10 ¢ de plus' },
        { id: 'ask50', t: 'Demander 50 ¢ de plus' },
      ];
      if (!this.shown) b.push({ id: 'show', t: 'Montrer les radicelles' });
      b.push({ id: 'leave', t: 'Remballer les racines' });
      return b.map((x, i) => Object.assign(x, { r: { x: 760, y: 300 + i * 62, w: 440, h: 52 }, key: String(i + 1) }));
    },
    update(dt) {
      this.lineT += dt;
      this.puff = Math.max(0, this.puff - dt * 0.6);
      if (this.phase !== 'talk' || G.blocked) return;
      const bs = this.buttons();
      bs.forEach((b, i) => {
        if (!ui.hit(b.r) && !I.hit('Digit' + (i + 1))) return;
        I.consume();
        G.audio.sfx('click');
        if (b.id === 'accept') this.done(this.offer, 'thornbury');
        if (b.id === 'ask10') this.ask(10);
        if (b.id === 'ask50') this.ask(50);
        if (b.id === 'show') this.show();
        if (b.id === 'leave') this.leave();
      });
    },
    draw(ctx) {
      G.places.town(ctx, 440, { time: 'day' });
      // caisse, balance suspendue et racines
      ctx.fillStyle = '#5A4128';
      ctx.fillRect(520, 580, 80, 50);
      ctx.strokeStyle = '#2B2420'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(470, 470); ctx.lineTo(470, 500); ctx.stroke();
      ctx.fillStyle = '#B8A16A';
      ctx.beginPath(); ctx.arc(470, 510, 14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(450, 545); ctx.lineTo(490, 545); ctx.lineTo(480, 555); ctx.lineTo(460, 555); ctx.fill();
      ctx.strokeStyle = '#2B2420'; ctx.beginPath(); ctx.moveTo(470, 524); ctx.lineTo(452, 545); ctx.moveTo(470, 524); ctx.lineTo(488, 545); ctx.stroke();
      this.roots.forEach((r, i) => {
        ctx.strokeStyle = r.quality > 0.7 ? '#E2D2A8' : '#C9B482';
        ctx.lineWidth = 4;
        const x = 458 + i * 10;
        ctx.beginPath(); ctx.moveTo(x, 538); ctx.lineTo(x + 3, 548); ctx.stroke();
      });
      // M. Thornbury assis sur sa caisse, Henry debout
      const tapping = this.mood >= 1 ? Math.sin(G.time * (this.mood === 2 ? 12 : 6)) * 0.15 : 0;
      A.char(ctx, 'thornbury', 560, 640, { pose: 'sit', seatH: 48, dir: -1, carry: 'pipe', arms: [0.6, 1.3 + tapping] });
      A.char(ctx, 'henry', 360, 640, { dir: 1, rim: true });
      // fumée de pipe : plus épaisse quand il s'agace
      for (let i = 0; i < 3 + this.mood * 2; i++) {
        const k = (G.time * (0.3 + this.mood * 0.2) + i / (3 + this.mood * 2)) % 1;
        ctx.fillStyle = `rgba(210,204,190,${(0.25 + this.mood * 0.12) * (1 - k)})`;
        ctx.beginPath(); ctx.arc(520 - k * 20, 520 - k * 90, 5 + k * (10 + this.mood * 6), 0, Math.PI * 2); ctx.fill();
      }
      A.finish(ctx);
    },
    drawUI(c) {
      // ardoise de l'offre
      c.save();
      c.fillStyle = '#2A2E2C';
      c.beginPath(); c.roundRect(760, 150, 440, 120, 8); c.fill();
      c.strokeStyle = '#6E5640'; c.lineWidth = 8; c.stroke();
      ui.text(c, 'Offre de M. Thornbury', 790, 192, { size: 20, kind: 'hand', color: 'rgba(232,223,204,0.7)' });
      ui.text(c, U.money(this.offer), 790, 248, { size: 52, kind: 'hand', color: '#F0EBDD' });
      const moodTxt = ['Il tire sur sa pipe, tranquille.', 'Il tapote sa pipe sur la caisse.', 'Il range sa balance à moitié.'][this.mood];
      ui.text(c, moodTxt, 1180, 248, { size: 17, italic: true, align: 'right', color: this.mood === 2 ? '#E9A07A' : '#BFB4A0' });
      c.restore();
      // réplique
      c.fillStyle = 'rgba(18,14,12,0.88)';
      c.beginPath(); c.roundRect(70, 120, 640, 120, 8); c.fill();
      ui.caps(c, 'M. Thornbury', 96, 152, { size: 14, color: G.WHO.thornbury.color });
      ui.text(c, `« ${this.line} »`, 96, 188, { size: 23, italic: true, maxW: 590, lineH: 30 });
      if (this.phase === 'talk') this.buttons().forEach((b) => ui.button(c, b.r, b.t, { size: 21, align: 'left', key: b.key }));
      ui.text(c, `${this.roots.length} racine${this.roots.length > 1 ? 's' : ''} sur la balance`, 470, 600, { size: 16, italic: true, align: 'center', shadow: true });
      ui.drawHud(c);
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.haggle = () => G.play(G.Scenes.haggle({ roots: [{ quality: 0.9 }, { quality: 0.75 }, { quality: 0.5 }] }));
})();
