'use strict';
// Scène d'exploration de profil : Henry marche (clic/toucher ou flèches) et
// interagit avec des personnages ou des objets (« things »).
//
// cfg = {
//   width: largeur du monde, floor: y du sol, bounds: [xmin, xmax], start, dir,
//   amb: ['wind'], song: def | null,
//   drawBg(ctx, camX, scene), drawFg(ctx, camX, scene), drawUI(uctx, scene),
//   things: [{ id, x, y, char, o, label, w, h, act: async (scene) => {}, visible: () => bool,
//              draw(ctx, sx, scene), layer: 'back'|'front', side: -1|1, solid }],
//   followers: [{ char, gap, o }],  triggers: [{ x, act, once }],
//   onEnter: async (scene) => {}, onUpdate(dt, scene), player: { char, o },
// }
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;

  G.Scenes.walk = (cfg) => G.makeScene({
    cfg,
    colorOverride: cfg.colorOverride,
    enter() {
      this.px = cfg.start != null ? cfg.start : 200;
      this.dir = cfg.dir || 1;
      this.phase = 0;
      this.moving = false;
      this.target = null;
      this.busy = false;
      this.floor = cfg.floor || 560;
      this.width = cfg.width || G.W;
      this.bounds = cfg.bounds || [60, this.width - 60];
      this.cam = this.camTarget();
      this.followers = (cfg.followers || []).map((f) => Object.assign({ x: this.px - (f.gap || 90), phase: 0, moving: false, dir: this.dir }, f));
      this.triggers = (cfg.triggers || []).map((t) => Object.assign({ fired: false }, t));
      this.player = Object.assign({ char: 'henry' }, cfg.player || {});
      if (cfg.amb) G.audio.amb(cfg.amb);
      if (cfg.song !== undefined) cfg.song ? G.audio.song(cfg.song) : G.audio.stopSong();
      if (cfg.hud) Object.assign(G.hud, cfg.hud);
      if (cfg.onEnter) this.runAct(cfg.onEnter);
    },
    camTarget() {
      return U.clamp(this.px - G.W / 2, 0, Math.max(0, this.width - G.W));
    },
    things() {
      return (cfg.things || []).filter((t) => !t.visible || t.visible(this));
    },
    // Lance une action asynchrone en bloquant les déplacements.
    async runAct(fn, thing) {
      this.busy = true;
      this.target = null;
      this.moving = false;
      try { await fn(this, thing); } finally { this.busy = false; }
    },
    hitThing(wx, wy) {
      let best = null;
      for (const t of this.things()) {
        if (!t.act && !t.label) continue;
        const w = t.w || (t.char ? 70 : 80);
        const h = t.h || (t.char ? (G.CHARS[t.char] || {}).h || 140 : 100);
        const y = t.y != null ? t.y : this.floor;
        if (Math.abs(wx - t.x) <= w / 2 + 6 && wy <= y + 14 && wy >= y - h - 20) {
          if (!best || Math.abs(wx - t.x) < Math.abs(wx - best.x)) best = t;
        }
      }
      return best;
    },
    nearest() {
      let best = null, bd = 1e9;
      for (const t of this.things()) {
        if (!t.act) continue;
        const d = Math.abs(t.x - this.px);
        if (d < (t.range || 110) && d < bd) { best = t; bd = d; }
      }
      return best;
    },
    update(dt) {
      if (cfg.onUpdate) cfg.onUpdate(dt, this);
      let vx = 0;
      if (!this.busy && !G.blocked) {
        const left = I.key('ArrowLeft') || I.key('KeyA') || I.key('KeyQ');
        const right = I.key('ArrowRight') || I.key('KeyD');
        if (left || right) { this.target = null; vx = right ? 1 : -1; }
        if (I.pressed) {
          const wx = I.x + this.cam;
          const hit = this.hitThing(wx, I.y);
          if (hit && hit.act) this.target = { thing: hit, x: this.standX(hit) };
          else if (I.y > 120) this.target = { x: U.clamp(wx, this.bounds[0], this.bounds[1]) };
        }
        if (I.hit('KeyE') || I.hit('Space') || I.hit('Enter')) {
          const n = this.nearest();
          if (n) this.target = { thing: n, x: this.standX(n) };
        }
        if (this.target && !vx) {
          const dx = this.target.x - this.px;
          if (Math.abs(dx) < 6) {
            const th = this.target.thing;
            this.target = null;
            if (th) {
              this.dir = th.x >= this.px ? 1 : -1;
              if (th.x === this.px) this.dir = th.side ? -th.side : this.dir;
              this.runAct(th.act, th);
            }
          } else vx = Math.sign(dx);
        }
      }
      const speed = cfg.speed || 230;
      this.moving = vx !== 0;
      if (vx) {
        this.dir = vx;
        const nx = U.clamp(this.px + vx * speed * dt, this.bounds[0], this.bounds[1]);
        const moved = Math.abs(nx - this.px);
        const prevHalf = Math.floor(this.phase * 2);
        this.phase = (this.phase + moved / 150) % 1;
        if (moved < 0.01 && this.target) this.target = null;
        this.px = nx;
        if (Math.floor(this.phase * 2) !== prevHalf) G.audio.sfx('step', 0, 0.6); // un pas par demi-cycle
      }
      // Ceux qui suivent Henry (Granny dans la montagne, par exemple).
      let lead = this.px;
      for (const f of this.followers) {
        const want = lead - this.dir * (f.gap || 90);
        const dx = want - f.x;
        f.moving = Math.abs(dx) > 8;
        if (f.moving) {
          const sp = (f.speed || speed * 0.95) * dt;
          const step = Math.sign(dx) * Math.min(Math.abs(dx), sp);
          f.x += step;
          f.dir = Math.sign(step) || f.dir;
          f.phase = (f.phase + Math.abs(step) / 150) % 1;
        } else f.dir = this.px >= f.x ? 1 : -1;
        lead = f.x;
      }
      for (const tr of this.triggers) {
        if (tr.fired || this.busy) continue;
        if ((tr.dir || 1) > 0 ? this.px >= tr.x : this.px <= tr.x) {
          if (tr.if && !G.test(tr.if)) continue;
          tr.fired = true;
          this.runAct(tr.act, tr);
          break;
        }
      }
      const ct = this.camTarget();
      this.cam = U.lerp(this.cam, ct, 1 - Math.pow(0.02, dt));
    },
    standX(t) {
      if (t.standAt != null) return t.standAt;
      const side = t.side || (this.px < t.x ? -1 : 1);
      const off = t.reach != null ? t.reach : (t.char ? 72 : 30);
      return U.clamp(t.x + side * off, this.bounds[0], this.bounds[1]);
    },
    drawThing(ctx, t) {
      const sx = t.x - this.cam;
      if (sx < -300 || sx > G.W + 300) return;
      const y = t.y != null ? t.y : this.floor;
      if (t.draw) t.draw(ctx, sx, this, y);
      else if (t.char) G.art.char(ctx, t.char, sx, y, Object.assign({ seed: t.x }, t.o || {}));
    },
    draw(ctx) {
      const cam = Math.round(this.cam);
      if (cfg.drawBg) cfg.drawBg(ctx, cam, this);
      const things = this.things();
      for (const t of things) if (t.layer !== 'front') this.drawThing(ctx, t);
      for (const f of this.followers) {
        G.art.char(ctx, f.char, f.x - cam, this.floor, Object.assign({ dir: f.dir, pose: f.moving ? 'walk' : 'stand', phase: f.phase, seed: 3 }, f.o || {}));
      }
      G.art.char(ctx, this.player.char, this.px - cam, this.floor, Object.assign({
        dir: this.dir, pose: this.moving ? 'walk' : 'stand', phase: this.phase, rim: cfg.rim !== false,
      }, this.player.o || {}));
      for (const t of things) if (t.layer === 'front') this.drawThing(ctx, t);
      if (cfg.drawFg) cfg.drawFg(ctx, cam, this);
      G.art.finish(ctx, cfg.finish);
    },
    drawUI(uctx) {
      const cam = this.cam;
      if (!this.busy && !G.blocked) {
        const near = this.nearest();
        const hov = I.mouse ? this.hitThing(I.x + cam, I.y) : null;
        for (const t of this.things()) {
          if (!t.label || (t !== near && t !== hov)) continue;
          const y = t.y != null ? t.y : this.floor;
          const h = t.h || (t.char ? (G.CHARS[t.char] || {}).h || 140 : 100);
          ui.tag(uctx, t.label, t.x - cam, (t.tagY != null ? t.tagY : y - h - 12), { active: t === near });
        }
      }
      if (cfg.drawUI) cfg.drawUI(uctx, this);
      ui.drawHud(uctx);
    },
  });
})();
