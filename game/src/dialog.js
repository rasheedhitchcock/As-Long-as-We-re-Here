'use strict';
// Dialogues : répliques, narration, cartons, choix (éventuellement minutés), scripts.
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const P = G.PAL;

  // Qui parle : nom affiché et couleur du nom.
  G.WHO = {
    henry: { name: 'Henry', color: '#F2D27A' },
    ida: { name: "M'man", color: '#E9B98A' },
    kenneth: { name: 'Papa', color: '#CBB89A' },
    hattie: { name: 'Granny', color: '#D9C3E3' },
    clay: { name: 'Clay', color: '#E58C6A' },
    wes: { name: 'Wes', color: '#AECBA2' },
    ruth: { name: 'Ruth', color: '#B7D0E6' },
    pearl: { name: 'Pearl', color: '#F3B7C3' },
    otis: { name: 'Otis', color: '#9FD6C9' },
    pruitt: { name: 'Mr. Pruitt', color: '#C6BFAE' },
    dow: { name: 'Dow Slone', color: '#D9A441' },
    nora: { name: 'Mrs. Napier', color: '#DDB49E' },
    abner: { name: 'Abner Napier', color: '#C9A98A' },
    kid: { name: 'Le petit Napier', color: '#E6C8A0' },
    garvey: { name: 'M. Garvey', color: '#ADB3B8' },
    whitcomb: { name: 'M. Whitcomb', color: '#B3C7DA' },
    thornbury: { name: 'M. Thornbury', color: '#CDB27C' },
    farris: { name: 'M. Farris', color: '#B4B4B4' },
    worker: { name: 'Un ouvrier', color: '#C2B49C' },
    crowd: { name: 'Les hommes', color: '#C2B49C' },
    agent: { name: "L'agent", color: '#B4B4B4' },
    old: { name: 'Henry, bien plus tard', color: '#E8DFCC' },
  };

  // Identifiants de dialogue qui ne correspondent pas à un identifiant de personnage.
  G.WHO_CHAR = { garvey: 'super', kid: 'napierKid', agent: 'revenuer' };
  G.speaking = null;

  const BOX = { x: 70, y: G.H - 178, w: G.W - 140, h: 164 };
  const CPS = 52; // caractères par seconde

  // ------------------------------------------------------------------ réplique
  G.say = (who, text, o = {}) => new Promise((resolve) => {
    const info = G.WHO[who] || { name: who, color: P.paper };
    const nar = who === 'nar';
    const ov = {
      modal: true,
      shown: 0,
      t: 0,
      update(dt, top) {
        if (!top) return;
        this.t += dt;
        this.shown = Math.min(text.length, this.shown + dt * (o.cps || CPS));
        // Le personnage « parle » tant que son texte s'affiche.
        G.speaking = !nar && this.shown < text.length ? who : null;
        const close = () => { G.speaking = null; G.popOverlay(ov); resolve(); };
        if (this.t > 0.12 && I.confirm()) {
          I.consume();
          if (this.shown < text.length) this.shown = text.length;
          else close();
        }
        if (o.auto && this.shown >= text.length && this.t > text.length / CPS + o.auto) close();
      },
      draw(ctx) {
        const a = Math.min(1, this.t * 6);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(18,14,12,0.9)';
        ctx.beginPath(); ctx.roundRect(BOX.x, BOX.y, BOX.w, BOX.h, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(232,223,204,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        let ty = BOX.y + 44;
        if (!nar) {
          ui.caps(ctx, info.name, BOX.x + 34, BOX.y + 32, { size: 15, color: info.color });
          ty = BOX.y + 68;
        } else ty = BOX.y + 50;
        ui.text(ctx, text.slice(0, Math.floor(this.shown)), BOX.x + 34, ty, {
          size: 26, maxW: BOX.w - 80, lineH: 33, italic: nar, color: nar ? '#D8CFBC' : P.paper,
        });
        if (this.shown >= text.length) {
          const b = Math.sin(G.time * 5) * 3;
          ctx.fillStyle = 'rgba(232,223,204,0.6)';
          ctx.beginPath();
          ctx.moveTo(BOX.x + BOX.w - 40, BOX.y + BOX.h - 30 + b);
          ctx.lineTo(BOX.x + BOX.w - 26, BOX.y + BOX.h - 30 + b);
          ctx.lineTo(BOX.x + BOX.w - 33, BOX.y + BOX.h - 21 + b);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
    G.pushOverlay(ov);
  });

  // ------------------------------------------------------------------ narration plein écran
  // Le texte apparaît paragraphe par paragraphe sur un fond sombre.
  G.narrate = (text, o = {}) => new Promise((resolve) => {
    const paras = Array.isArray(text) ? text : [text];
    const ov = {
      modal: true, t: 0, i: 0, shown: 0, out: -1,
      update(dt, top) {
        if (!top) return;
        this.t += dt;
        if (this.out >= 0) {
          this.out += dt * 2.2;
          if (this.out >= 1) { G.popOverlay(ov); resolve(); }
          return;
        }
        const cur = paras[this.i];
        this.shown = Math.min(cur.length, this.shown + dt * (o.cps || 38));
        if (this.t > 0.25 && I.confirm()) {
          I.consume();
          if (this.shown < cur.length) this.shown = cur.length;
          else if (this.i < paras.length - 1) { this.i++; this.shown = 0; }
          else this.out = 0;
        }
      },
      draw(ctx) {
        const a = Math.min(1, this.t * 2.5) * (this.out >= 0 ? 1 - this.out : 1);
        ctx.globalAlpha = a * (o.dim != null ? o.dim : 0.86);
        ctx.fillStyle = '#0d0b0a';
        ctx.fillRect(0, 0, G.W, G.H);
        ctx.globalAlpha = a;
        // Les paragraphes déjà lus restent, plus pâles, au-dessus.
        let y = o.y || 230;
        for (let k = 0; k <= this.i; k++) {
          const full = paras[k];
          const s = k < this.i ? full : full.slice(0, Math.floor(this.shown));
          const r = ui.text(ctx, s, G.W / 2, y, {
            size: o.size || 31, italic: true, align: 'center', maxW: 860, lineH: 44,
            color: k < this.i ? 'rgba(232,223,204,0.45)' : P.paper,
          });
          ctx.globalAlpha = a;
          ctx.font = ui.font(o.size || 31, 'serif', 'italic');
          y += ui.wrap(ctx, full, 860).length * 44 + 26;
        }
        if (o.who) ui.caps(ctx, G.WHO[o.who] ? G.WHO[o.who].name : o.who, G.W / 2, (o.y || 230) - 60, { align: 'center', size: 15, color: 'rgba(232,223,204,0.55)' });
        if (paras[this.i] && this.shown >= paras[this.i].length) {
          ui.text(ctx, 'Clique ou appuie sur Espace', G.W / 2, G.H - 50, { size: 16, italic: true, align: 'center', color: 'rgba(232,223,204,0.35)' });
        }
        ctx.globalAlpha = 1;
      },
    };
    G.pushOverlay(ov);
  });

  // ------------------------------------------------------------------ carton (date, titre)
  G.card = (title, sub, o = {}) => new Promise((resolve) => {
    const dur = o.dur || 3.2;
    const ov = {
      modal: true, t: 0,
      update(dt, top) {
        this.t += dt;
        if (top && this.t > 0.6 && I.confirm()) { I.consume(); this.t = Math.max(this.t, dur - 0.5); }
        if (this.t >= dur) { G.popOverlay(ov); resolve(); }
      },
      draw(ctx) {
        const k = this.t < 0.6 ? this.t / 0.6 : this.t > dur - 0.6 ? (dur - this.t) / 0.6 : 1;
        ctx.globalAlpha = (o.bgAlpha != null ? o.bgAlpha : 1) * Math.min(1, k * 1.5);
        ctx.fillStyle = '#0d0b0a';
        ctx.fillRect(0, 0, G.W, G.H);
        ctx.globalAlpha = Math.max(0, k);
        if (o.eyebrow) ui.caps(ctx, o.eyebrow, G.W / 2, G.H / 2 - 66, { align: 'center', size: 16, color: 'rgba(232,223,204,0.6)', spacing: 5 });
        ui.text(ctx, title, G.W / 2, G.H / 2, { size: o.size || 54, align: 'center', base: 'middle', kind: o.kind || 'serif' });
        if (sub) ui.text(ctx, sub, G.W / 2, G.H / 2 + 56, { size: 24, italic: true, align: 'center', color: 'rgba(232,223,204,0.75)' });
        ctx.globalAlpha = 1;
      },
    };
    G.pushOverlay(ov);
  });

  // ------------------------------------------------------------------ choix
  // options : [{ t: 'texte', ... }]. o.timer : secondes avant le choix par défaut
  // (o.def, sinon la dernière option, souvent « Se taire »).
  G.choose = (options, o = {}) => new Promise((resolve) => {
    const n = options.length;
    const rowH = 54;
    const h = 30 + n * (rowH + 10) + (o.prompt ? 40 : 0);
    const y0 = G.H - h - 26;
    const rects = options.map((_, i) => ({ x: 170, y: y0 + (o.prompt ? 52 : 22) + i * (rowH + 10), w: G.W - 340, h: rowH }));
    let sel = -1;
    const ov = {
      modal: true, t: 0,
      update(dt, top) {
        if (!top) return;
        this.t += dt;
        if (this.t < 0.2) return;
        let pick = -1;
        for (let i = 0; i < n; i++) {
          if (ui.hit(rects[i], true)) pick = i;
          if (I.hit('Digit' + (i + 1)) || I.hit('Numpad' + (i + 1))) pick = i;
        }
        if (I.hit('ArrowDown')) sel = (sel + 1) % n;
        if (I.hit('ArrowUp')) sel = (sel - 1 + n) % n;
        if (sel >= 0 && (I.hit('Enter') || I.hit('Space'))) pick = sel;
        if (o.timer && this.t > o.timer + 0.2) pick = o.def != null ? o.def : n - 1;
        if (pick >= 0) {
          I.consume();
          G.popOverlay(ov);
          G.audio && G.audio.sfx('click');
          resolve(pick);
        }
      },
      draw(ctx) {
        const a = Math.min(1, this.t * 6);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(18,14,12,0.9)';
        ctx.beginPath(); ctx.roundRect(140, y0, G.W - 280, h, 8); ctx.fill();
        if (o.prompt) ui.text(ctx, o.prompt, G.W / 2, y0 + 36, { size: 22, italic: true, align: 'center', color: '#D8CFBC' });
        if (o.timer) {
          const k = U.clamp(1 - (this.t - 0.2) / o.timer, 0, 1);
          ctx.fillStyle = k < 0.3 ? G.PAL.ember : G.PAL.gold;
          ctx.fillRect(140, y0, (G.W - 280) * k, 4);
        }
        options.forEach((op, i) => {
          const r = rects[i];
          const hov = ui.hover(r) || sel === i;
          ui.button(ctx, r, op.t, { hover: hov, align: 'left', size: 23, key: String(i + 1), italic: !!op.silent });
        });
        ctx.globalAlpha = 1;
      },
    };
    G.pushOverlay(ov);
  });

  // ------------------------------------------------------------------ scripts
  // Entrées possibles :
  //   ['ida', 'texte']           réplique
  //   'texte'                    narration dans la boîte
  //   { N: 'texte' | [...] }     narration plein écran
  //   { old: 'texte' }           voix du vieil Henry (plein écran)
  //   { c: [options], prompt, timer, def }  choix ; option : { t, set, mood, note, log, do, then, if }
  //   { if: cond, then: [...], else: [...] }  cond : 'flag', '!flag' ou fonction
  //   { do: fn }  { wait: s }  { set: {...} }  { mood: {...} }  { note: 'texte' }  { sfx: 'nom' }
  //   { card: 'titre', sub: '...' }
  const test = (cond) => {
    if (typeof cond === 'function') return !!cond(G.state);
    if (typeof cond === 'string') return cond[0] === '!' ? !G.flag(cond.slice(1)) : G.flag(cond);
    return !!cond;
  };
  G.test = test;

  const apply = (e) => {
    if (e.set) for (const [k, v] of Object.entries(e.set)) G.setFlag(k, v);
    if (e.mood) G.mood(e.mood);
    if (e.note) ui.toast(e.note, { color: G.PAL.rim });
    if (e.log) G.log(e.log);
  };

  G.run = async (script) => {
    for (const e of script) {
      if (e == null) continue;
      if (Array.isArray(e)) { await G.say(e[0], e[1]); continue; }
      if (typeof e === 'string') { await G.say('nar', e); continue; }
      if (e.N) { await G.narrate(e.N, e); continue; }
      if (e.old) { await G.narrate(e.old, { who: 'old' }); continue; }
      if (e.card) { await G.card(e.card, e.sub, e); continue; }
      if (e.c) {
        const opts = e.c.filter((op) => op.if == null || test(op.if));
        const i = await G.choose(opts, e);
        const op = opts[i];
        apply(op);
        if (op.do) await op.do();
        if (op.then) await G.run(op.then);
        if (e.after) await G.run(e.after);
        continue;
      }
      if (e.if != null) {
        if (test(e.if)) { if (e.then) await G.run(e.then); } else if (e.else) await G.run(e.else);
        continue;
      }
      apply(e);
      if (e.sfx) G.audio && G.audio.sfx(e.sfx);
      if (e.do) await e.do();
      if (e.wait) await G.wait(e.wait);
    }
  };
})();
