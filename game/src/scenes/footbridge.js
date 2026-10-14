'use strict';
// Mini-jeu « La passerelle » : traverser le pont suspendu avec trois gamelles
// sans en faire tomber dans le ruisseau. Équilibre : flèches, ou maintenir le
// pointeur à gauche ou à droite de l'écran.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  const X0 = 150, X1 = 1130;          // départ et arrivée d'Henry sur le tablier
  const DECK = 470, SAG = 46;         // hauteur du tablier aux piles, flèche au milieu
  const LIMIT = 0.55;                 // angle au-delà duquel une gamelle glisse
  const OWNERS = ['de Wes', 'de Clay', 'de Papa'];

  const deckY = (x, bounce) => {
    const t = U.clamp((x - 100) / (1180 - 100), 0, 1);
    return DECK + SAG * 4 * t * (1 - t) + bounce * 4 * t * (1 - t);
  };

  function scenery(ctx) {
    const bg = A.cached('footbridge-bg', G.W, G.H, (cx) => {
      A.sky(cx, G.W, G.H, [[0, '#6F93B0'], [0.6, '#A9C0C8'], [1, '#E3D9B5']]);
      const far = A.makeRidge(41, G.W, 250, 40, 170);
      A.ridge(cx, far, '#6F8A8A', G.H);
      const mid = A.makeRidge(47, G.W, 330, 30, 140);
      A.ridge(cx, mid, '#3F5636', G.H);
      A.dots(cx, 49, 220, 0, G.W, (x) => [A.ridgeY(mid, x), A.ridgeY(mid, x) + 140], ['#3F5E2E', '#5E7A3A', '#6F8F3F', '#4A6B35', '#7C9A4A'], 7, 15);
      // berges
      cx.fillStyle = '#46552F';
      cx.beginPath(); cx.moveTo(0, 440); cx.quadraticCurveTo(80, 450, 130, 520); cx.lineTo(170, G.H); cx.lineTo(0, G.H); cx.fill();
      cx.beginPath(); cx.moveTo(G.W, 440); cx.quadraticCurveTo(1200, 450, 1150, 520); cx.lineTo(1110, G.H); cx.lineTo(G.W, G.H); cx.fill();
      // l'eau
      const g = cx.createLinearGradient(0, 560, 0, G.H);
      g.addColorStop(0, '#7E9DAA'); g.addColorStop(1, '#4E6E7A');
      cx.fillStyle = g;
      cx.fillRect(150, 590, 980, G.H - 590);
      // rochers
      cx.fillStyle = '#5E5A52';
      for (const [rx, ry, rw] of [[300, 640, 46], [520, 660, 30], [760, 630, 56], [980, 655, 36]]) {
        cx.beginPath(); cx.ellipse(rx, ry, rw, rw * 0.45, 0, Math.PI, 0); cx.fill();
      }
      A.texture(cx, G.W, G.H, 0.14);
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, bg, 0, 0);
    // reflets mouvants
    ctx.strokeStyle = 'rgba(230,240,240,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = 610 + (i % 7) * 15;
      const x = 180 + ((i * 131 + G.time * 40) % 920);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke();
    }
  }

  G.Scenes.footbridge = (opts = {}) => G.makeScene({
    colorOverride: { sat: 1.05, sepia: 0.05 },
    enter() {
      this.x = X0;
      this.th = 0;          // angle d'Henry
      this.om = 0;          // vitesse angulaire
      this.pails = 3;
      this.lost = [];
      this.falling = [];    // gamelles qui tombent
      this.nextGust = 2.5;
      this.gustText = 0;
      this.bounce = 0;
      this.bounceV = 0;
      this.phase = 'intro';
      this.introT = 0;
      this.qte = null;
      this.kid = null;
      this.kidDone = false;
      this.stumble = 0;
      this.walkPhase = 0;
      G.audio.amb(['creek', 'wind', 'birds']);
    },
    input() {
      let dir = 0;
      if (I.key('ArrowLeft') || I.key('KeyA') || I.key('KeyQ')) dir -= 1;
      if (I.key('ArrowRight') || I.key('KeyD')) dir += 1;
      if (I.down && !G.blocked) dir += I.x < G.W / 2 ? -1 : 1;
      return U.clamp(dir, -1, 1);
    },
    losePail() {
      if (this.pails <= 0) { this.th = 0; this.om = 0; this.stumble = 0.8; return; }
      const who = OWNERS[3 - this.pails];
      this.pails--;
      this.lost.push(who);
      const y = deckY(this.x, this.bounce);
      this.falling.push({ x: this.x + (this.th > 0 ? 40 : -40), y: y - 60, vy: -80, vx: this.th > 0 ? 60 : -60, rot: 0 });
      ui.toast(`La gamelle ${who} est tombée à l'eau !`, { color: '#F2B6A0' });
      G.audio.sfx('whoosh');
      this.th = 0;
      this.om = 0;
      this.stumble = 0.8;
    },
    update(dt) {
      // animation de l'eau et des gamelles qui tombent, même en pause
      for (const f of this.falling) {
        if (f.done) continue;
        f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 6;
        if (f.y > 610) { f.done = true; G.audio.sfx('splash'); f.splash = 0; }
      }
      for (const f of this.falling) if (f.splash != null) f.splash += dt;
      this.bounceV += (-this.bounce * 40 - this.bounceV * 3) * dt;
      this.bounce += this.bounceV * dt;
      if (G.blocked) return;

      if (this.phase === 'intro') {
        this.introT += dt;
        if (this.introT > 0.4 && (I.confirm() || this.introT > 6)) { I.consume(); this.phase = 'walk'; }
        return;
      }
      if (this.phase === 'end') {
        this.endT += dt;
        if (this.endT > 1.4) this.finish({ pails: this.pails, lost: this.lost });
        return;
      }

      // QTE « Accroche-toi au câble ! »
      if (this.qte) {
        this.qte.t += dt;
        this.th += Math.sign(this.qte.side) * dt * 0.35;
        if (I.confirm()) {
          I.consume();
          G.audio.sfx('good');
          ui.toast('Rattrapé de justesse.');
          this.qte = null;
          this.th = 0; this.om = 0;
          return;
        }
        if (this.qte.t > 0.95) { this.qte = null; this.losePail(); }
        return;
      }

      const dir = this.input();
      // pendule inversé : l'équilibre s'écroule tout seul si on ne le corrige pas
      const sway = Math.sin(this.t * 1.7) * 0.32 + Math.sin(this.t * 0.63 + 1) * 0.18;
      this.om += (this.th * 2.4 + sway * 0.55 + dir * 2.7) * dt;
      this.nextGust -= dt;
      if (this.nextGust <= 0) {
        const s = Math.random() < 0.5 ? -1 : 1;
        this.om += s * U.rand(0.6, 1.0);
        this.nextGust = U.rand(1.8, 3.4);
        this.gustText = 1.2;
        this.gustSide = s;
        G.audio.sfx('whoosh');
      }
      this.gustText = Math.max(0, this.gustText - dt);
      this.om *= 1 - 1.5 * dt;
      this.th += this.om * dt;
      if (Math.abs(this.th) > LIMIT) this.losePail();

      // avance : plus lent quand Henry vacille
      this.stumble = Math.max(0, this.stumble - dt);
      const steady = Math.abs(this.th) < 0.28 && this.stumble <= 0;
      const speed = this.stumble > 0 ? 0 : steady ? 44 : 20;
      this.x += speed * dt;
      this.walkPhase = (this.walkPhase + speed * dt / 120) % 1;
      if (speed > 0 && Math.random() < dt * 1.2) G.audio.sfx('creak');

      // le petit Napier déboule sur la passerelle au milieu
      if (!this.kidDone && this.x > 560) {
        this.kidDone = true;
        this.kid = { x: 1180, t: 0 };
      }
      if (this.kid) {
        this.kid.t += dt;
        this.kid.x -= 260 * dt;
        if (!this.kid.hit && this.kid.x < this.x + 260) {
          this.kid.hit = true;
          this.bounceV = 260;
          const side = this.th >= 0 ? 1 : -1;
          this.om += side * 1.4;
          this.qte = { t: 0, side };
          G.audio.sfx('thud');
        }
        if (this.kid.x < this.x + 70 && !this.kid.jumped) {
          this.kid.jumped = true;
          ui.toast('« Pardon, Henry ! »');
        }
        if (this.kid.x < 60) this.kid = null;
      }

      if (this.x >= X1) { this.x = X1; this.phase = 'end'; this.endT = 0; }
    },
    draw(ctx) {
      scenery(ctx);
      // pylônes et câbles
      ctx.fillStyle = P.beam;
      for (const px of [96, 1176]) ctx.fillRect(px - 6, 300, 12, 260);
      const rail = (x, k) => deckY(x, this.bounce) - 125 + k + 3 * Math.sin(x / 90 + this.t * 1.3);
      ctx.strokeStyle = '#2B2420';
      ctx.lineWidth = 3;
      for (const k of [0, 22]) {
        ctx.beginPath();
        for (let x = 96; x <= 1176; x += 12) (x === 96 ? ctx.moveTo(x, rail(x, k)) : ctx.lineTo(x, rail(x, k)));
        ctx.stroke();
      }
      // suspentes et tablier
      ctx.lineWidth = 1.5;
      for (let x = 120; x < 1170; x += 36) {
        ctx.beginPath(); ctx.moveTo(x, deckY(x, this.bounce)); ctx.lineTo(x, rail(x, 0)); ctx.stroke();
      }
      for (let x = 100; x < 1180; x += 16) {
        const y = deckY(x, this.bounce);
        ctx.fillStyle = (x / 16) % 3 ? '#6A4C30' : '#4A3826';
        ctx.fillRect(x, y - 2, 14, 10);
        ctx.fillStyle = '#2E241B';
        ctx.fillRect(x, y + 8, 14, 2);
      }
      // gamelles qui tombent
      for (const f of this.falling) {
        if (!f.done) {
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
          ctx.fillStyle = '#6E6A64'; ctx.fillRect(-7, -7, 14, 14);
          ctx.restore();
        } else if (f.splash < 0.8) {
          ctx.strokeStyle = `rgba(230,240,240,${0.8 - f.splash})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(f.x, 612, 10 + f.splash * 50, 3 + f.splash * 8, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // le petit Napier
      if (this.kid) A.char(ctx, 'napierKid', this.kid.x, deckY(this.kid.x, this.bounce), { dir: -1, pose: 'walk', phase: (this.kid.t * 2.6) % 1 });
      // Henry
      const y = deckY(this.x, this.bounce);
      A.char(ctx, 'henry', this.x, y, {
        dir: 1, pose: this.phase === 'walk' && !this.stumble ? 'walk' : 'stand', phase: this.walkPhase,
        tilt: this.th * 0.9, carry: 'pails', pails: this.pails, rim: true, arms: [-0.6 - this.th, 0.5 + this.th],
      });
      A.finish(ctx);
    },
    drawUI(c) {
      if (this.phase === 'intro') {
        ui.hint(c, 'Garde l\'équilibre : ← → ou maintiens le doigt à gauche / à droite');
        ui.text(c, 'Trois gamelles. Celle au nœud rouge, c\'est celle de Papa.', G.W / 2, 110, { size: 24, italic: true, align: 'center', shadow: true });
        ui.text(c, 'Clique pour y aller', G.W / 2, 150, { size: 18, italic: true, align: 'center', color: 'rgba(232,223,204,0.7)', shadow: true });
      }
      // jauge d'équilibre en arc
      const cx = G.W / 2, cy = 120, r = 70;
      c.save();
      c.lineCap = 'round';
      c.lineWidth = 10;
      c.strokeStyle = 'rgba(20,16,13,0.6)';
      c.beginPath(); c.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      c.strokeStyle = 'rgba(94,122,58,0.9)';
      c.beginPath(); c.arc(cx, cy, r, Math.PI * 1.5 - 0.16, Math.PI * 1.5 + 0.16); c.stroke();
      const a = Math.PI * 1.5 + U.clamp(this.th / LIMIT, -1, 1) * Math.PI * 0.3;
      c.strokeStyle = Math.abs(this.th) > LIMIT * 0.7 ? P.ember : P.paper;
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8)); c.stroke();
      c.restore();
      if (this.phase !== 'intro') ui.text(c, `Gamelles : ${this.pails} / 3`, 40, 60, { size: 24, shadow: true });
      if (this.gustText > 0) ui.text(c, this.gustSide > 0 ? 'Coup de vent →' : '← Coup de vent', cx, 170, { size: 20, italic: true, align: 'center', alpha: Math.min(1, this.gustText * 2), shadow: true });
      if (this.qte) {
        const k = 1 + 0.08 * Math.sin(G.time * 20);
        c.save(); c.translate(G.W / 2, 290); c.scale(k, k);
        ui.text(c, 'Accroche-toi au câble !', 0, 0, { size: 44, align: 'center', base: 'middle', color: P.rim, shadow: true });
        c.restore();
        ui.text(c, 'Clique ou appuie sur Espace', G.W / 2, 330, { size: 20, italic: true, align: 'center', shadow: true });
        ui.bar(c, G.W / 2 - 120, 350, 240, 8, 1 - this.qte.t / 0.95, { color: P.ember });
      }
      // zones tactiles
      if (!I.mouse && this.phase === 'walk') {
        c.globalAlpha = 0.18;
        c.fillStyle = P.paper;
        c.beginPath(); c.roundRect(20, G.H - 140, 120, 120, 16); c.fill();
        c.beginPath(); c.roundRect(G.W - 140, G.H - 140, 120, 120, 16); c.fill();
        c.globalAlpha = 0.7;
        ui.text(c, '←', 80, G.H - 80, { size: 50, align: 'center', base: 'middle' });
        ui.text(c, '→', G.W - 80, G.H - 80, { size: 50, align: 'center', base: 'middle' });
        c.globalAlpha = 1;
      }
    },
  });

  G.DEV = G.DEV || {};
  G.DEV.footbridge = () => G.play(G.Scenes.footbridge({}));
})();
