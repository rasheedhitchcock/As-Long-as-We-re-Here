'use strict';
// La Table : huit bols à remplir avec ce qu'il y a dans la marmite.
// mode 'papa' : Papa sert, on regarde. mode 'player' : Henry sert (clic sur les bols).
(function () {
  const G = window.G;
  const U = G.U;
  const I = G.input;
  const ui = G.ui;
  const A = G.art;
  const P = G.PAL;

  const SEATS = ['pearl', 'ruth', 'hattie', 'henry', 'wes', 'clay', 'ida', 'kenneth'];
  const HIP = { kenneth: 480, ida: 478, hattie: 472, clay: 480, wes: 482, henry: 478, ruth: 468, pearl: 448 };
  const seatX = (i) => 290 + i * 116;
  const TABLE_TOP = 470;
  const FOOT = 610;
  const POT = { x: 196, y: 470 };
  const NAMES = { pearl: 'Pearl', ruth: 'Ruth', hattie: 'Granny', henry: 'Henry', wes: 'Wes', clay: 'Clay', ida: 'M\'man', kenneth: 'Papa' };
  const bowlRect = (i) => ({ x: seatX(i) - 52, y: 380, w: 104, h: 170 });
  const minusRect = (i) => ({ x: seatX(i) - 18, y: 612, w: 36, h: 30 });

  function room(ctx, lamp) {
    const bg = A.cached('table-room', G.W, G.H, (cx) => {
      const g = cx.createLinearGradient(0, 0, 0, G.H);
      g.addColorStop(0, '#2E2219'); g.addColorStop(0.6, '#5E4632'); g.addColorStop(1, '#3A2A1E');
      cx.fillStyle = g; cx.fillRect(0, 0, G.W, G.H);
      cx.strokeStyle = 'rgba(20,14,10,0.45)'; cx.lineWidth = 1.5;
      for (let x = 0; x < G.W; x += 26) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, G.H); cx.stroke(); }
      // fenêtre sur la nuit
      cx.fillStyle = '#1A2234'; cx.fillRect(1110, 150, 110, 120);
      cx.strokeStyle = '#2B2420'; cx.lineWidth = 6; cx.strokeRect(1110, 150, 110, 120);
      cx.beginPath(); cx.moveTo(1165, 150); cx.lineTo(1165, 270); cx.moveTo(1110, 210); cx.lineTo(1220, 210); cx.stroke();
      // calendrier de la compagnie et étagère
      cx.fillStyle = '#D9CFB6'; cx.fillRect(70, 150, 70, 92);
      cx.fillStyle = '#7A2E1A'; cx.fillRect(70, 150, 70, 20);
      cx.fillStyle = '#3A2C1E'; cx.fillRect(170, 230, 160, 6);
      // poêle
      cx.fillStyle = '#151518'; cx.beginPath(); cx.roundRect(20, 360, 90, 110, 6); cx.fill();
      cx.fillRect(56, 0, 16, 360);
      A.texture(cx, G.W, G.H, 0.15);
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, bg, 0, 0);
    ctx.fillStyle = '#E37A2C';
    ctx.beginPath(); ctx.roundRect(36, 400, 56, 18, 3); ctx.fill();
    A.glow(ctx, 64, 410, 160, 'rgba(227,122,44,0.9)', 0.28 + Math.sin(G.time * 7) * 0.03);
    if (lamp) {
      ctx.strokeStyle = '#151518'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(700, 0); ctx.lineTo(700, 210); ctx.stroke();
      ctx.fillStyle = P.lamp;
      ctx.beginPath(); ctx.ellipse(700, 226, 12, 18, 0, 0, Math.PI * 2); ctx.fill();
      A.glow(ctx, 700, 260, 520, 'rgba(246,207,120,0.9)', 0.32);
    }
  }

  // Toile cirée à carreaux sur le devant de la table.
  function tableFront(ctx) {
    const t = A.cached('table-front', G.W, 200, (cx) => {
      cx.fillStyle = '#5C4A33'; cx.fillRect(80, 0, 1120, 14);
      for (let x = 80; x < 1200; x += 20) {
        for (let y = 14; y < 120; y += 20) {
          cx.fillStyle = ((x / 20 + y / 20) | 0) % 2 ? '#B9493A' : '#E4D8BE';
          cx.fillRect(x, y, 20, 20);
        }
      }
      cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.fillRect(80, 14, 1120, 6);
      // ourlet en dents de scie
      cx.fillStyle = '#E4D8BE';
      for (let x = 80; x < 1200; x += 20) { cx.beginPath(); cx.moveTo(x, 120); cx.lineTo(x + 10, 132); cx.lineTo(x + 20, 120); cx.fill(); }
      A.texture(cx, G.W, 200, 0.2);
      cx.fillStyle = 'rgba(40,24,14,0.35)'; cx.fillRect(80, 14, 1120, 120);
    }, Math.min(G.dpr, 1.5));
    A.blit(ctx, t, 0, TABLE_TOP);
  }

  G.Scenes.table = (opts = {}) => G.makeScene({
    enter() {
      this.mode = opts.mode || 'player';
      this.present = new Set(opts.present || SEATS);
      this.pot = opts.pot != null ? opts.pot : G.pantryHalves();
      this.pot0 = this.pot;
      this.bowls = {};
      for (const id of SEATS) this.bowls[id] = 0;
      this.locked = {};
      this.asked = {};
      this.focus = 3;
      this.ladles = [];      // louches en vol
      this.phase = 'intro';
      this.queue = [];
      this.eat = 0;
      this.poured = null;
      this.lamp = opts.lamp !== false;
      G.audio.amb(['fire', 'room']);
      if (opts.song !== undefined) G.audio.song(opts.song);
      this.start();
    },
    async start() {
      await G.wait(0.6);
      if (opts.intro) await opts.intro(this);
      if (this.mode === 'papa') { this.planPapa(); this.phase = 'papa'; this.nextLadle = 0.4; } else this.phase = 'serve';
    },
    need(id) { return G.NEED[id] || 2; },
    needTotal() { let n = 0; for (const id of SEATS) if (this.present.has(id) && !this.locked[id]) n += this.need(id); return n; },
    // Papa sert d'abord les petits ; s'il manque, Ida se prive, puis lui.
    planPapa() {
      let left = this.pot;
      const order = ['pearl', 'ruth', 'hattie', 'wes', 'clay', 'henry', 'ida', 'kenneth'].filter((id) => this.present.has(id));
      const plan = {};
      for (const id of order) plan[id] = 0;
      const total = order.reduce((a, id) => a + this.need(id), 0);
      const short = left < total;
      for (const id of order) {
        let want = this.need(id);
        if (short && id === 'ida') want = 0;
        if (short && id === 'kenneth') want = Math.min(1, want);
        const k = Math.min(want, left);
        plan[id] = k;
        left -= k;
      }
      this.queue = [];
      for (const id of order) for (let k = 0; k < plan[id]; k++) this.queue.push(id);
      this.papaShort = short;
    },
    addLadle(id, auto) {
      if (this.pot <= 0 || this.locked[id] || !this.present.has(id)) { if (!auto) G.audio.sfx('fail'); return false; }
      this.pot--;
      this.bowls[id]++;
      const i = SEATS.indexOf(id);
      this.ladles.push({ t: 0, x0: POT.x, y0: POT.y - 30, x1: seatX(i), y1: TABLE_TOP + 2 });
      G.audio.sfx('pour');
      return true;
    },
    removeLadle(id) {
      if (this.bowls[id] <= 0) return;
      this.bowls[id]--;
      this.pot++;
      G.audio.sfx('click');
    },
    async tryServe(id) {
      if (this.locked[id] || !this.present.has(id)) return;
      if (opts.onFirst && opts.onFirst[id] && !this.asked[id]) {
        this.asked[id] = true;
        this.phase = 'hook';
        const ok = await opts.onFirst[id](this);
        this.phase = 'serve';
        if (ok === false) { this.locked[id] = true; return; }
      }
      this.addLadle(id);
    },
    async serve() {
      this.phase = 'eat';
      this.eat = 0;
      // Ida reverse discrètement son bol dans celui de Pearl.
      if (opts.idaSkips && this.bowls.ida > 0 && this.present.has('ida')) {
        await G.wait(0.5);
        const k = this.bowls.ida;
        this.bowls.ida = 0;
        const room = Math.max(0, 2 - this.bowls.pearl);
        const toPearl = Math.min(room, k);
        this.bowls.pearl += toPearl;
        this.pot += k - toPearl;
        this.poured = { t: 0, from: SEATS.indexOf('ida'), to: SEATS.indexOf('pearl') };
        G.setFlag('idaPouredBack');
        G.audio.sfx('pour');
        await G.wait(1.4);
      }
      this.eating = true;
      await G.wait(2.6);
      this.eating = false;
      if (opts.afterServe) await opts.afterServe(this, Object.assign({}, this.bowls));
      this.finish({ served: Object.assign({}, this.bowls), leftover: this.pot });
    },
    // Transfert après service (« donner la moitié de ton bol à Pearl »).
    transfer(from, to, k) {
      const n = Math.min(k, this.bowls[from]);
      this.bowls[from] -= n;
      this.bowls[to] += n;
      const i0 = SEATS.indexOf(from), i1 = SEATS.indexOf(to);
      this.ladles.push({ t: 0, x0: seatX(i0), y0: TABLE_TOP - 10, x1: seatX(i1), y1: TABLE_TOP + 2 });
      G.audio.sfx('pour');
    },
    serverId() { return this.mode === 'papa' ? 'kenneth' : 'henry'; },
    update(dt) {
      for (const l of this.ladles) l.t += dt * 2.6;
      this.ladles = this.ladles.filter((l) => l.t < 1);
      if (this.poured) this.poured.t += dt;
      if (this.eating) this.eat = Math.min(1, (this.eat || 0) + dt / 2.4);
      if (G.blocked) return;
      if (this.phase === 'papa') {
        this.nextLadle -= dt;
        if (this.nextLadle <= 0) {
          if (this.queue.length) { this.addLadle(this.queue.shift(), true); this.nextLadle = 0.42; }
          else { this.phase = 'wait'; G.after(0.8, () => this.serve()); }
        }
        return;
      }
      if (this.phase !== 'serve') return;
      for (let i = 0; i < SEATS.length; i++) {
        const id = SEATS[i];
        if (!this.present.has(id)) continue;
        if (this.bowls[id] > 0 && ui.hit(minusRect(i))) { this.removeLadle(id); I.consume(); return; }
        if (ui.hit(bowlRect(i))) { this.focus = i; this.tryServe(id); return; }
      }
      if (I.hit('ArrowRight')) this.focus = (this.focus + 1) % SEATS.length;
      if (I.hit('ArrowLeft')) this.focus = (this.focus - 1 + SEATS.length) % SEATS.length;
      if (I.hit('Space') || I.hit('ArrowUp')) this.tryServe(SEATS[this.focus]);
      if (I.hit('ArrowDown') || I.hit('Backspace')) this.removeLadle(SEATS[this.focus]);
      if (ui.hit(this.serveBtn()) || I.hit('Enter')) this.serve();
    },
    serveBtn() { return { x: G.W - 250, y: G.H - 70, w: 220, h: 50 }; },
    draw(ctx) {
      room(ctx, this.lamp);
      const server = this.serverId();
      const serving = this.phase === 'intro' || this.phase === 'papa' || this.phase === 'serve' || this.phase === 'hook' || this.phase === 'wait';
      // la famille assise derrière la table
      SEATS.forEach((id, i) => {
        if (!this.present.has(id)) return;
        if (id === server && serving) return;
        const hip = HIP[id];
        const dir = i < 4 ? 1 : -1;
        const spoon = this.eating && this.bowls[id] > 0 ? Math.sin(G.time * 6 + i) * 0.3 : 0;
        A.char(ctx, id, seatX(i) - dir * 18, FOOT, {
          pose: 'sit', seatH: FOOT - hip, dir, seed: i, rim: id === 'henry',
          arms: this.eating && this.bowls[id] > 0 ? [0.6, 1.4 + spoon] : [0.5, 0.9],
          thin: (G.state.fam[id].hunger || 0) * 0.08,
        });
      });
      // celui qui sert, debout près de la marmite
      if (serving && this.present.has(server)) {
        const lift = this.ladles.length ? 0.6 : 0;
        A.char(ctx, server, 122, FOOT - 6, { dir: 1, arms: [0.2, 1.1 + lift], rim: server === 'henry' });
      }
      tableFront(ctx);
      // la marmite
      ctx.fillStyle = '#1A1A1C';
      ctx.beginPath(); ctx.ellipse(POT.x, POT.y - 22, 48, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2A2A2E'; ctx.fillRect(POT.x - 52, POT.y - 40, 104, 8);
      const lvl = this.pot0 ? this.pot / this.pot0 : 0;
      ctx.fillStyle = '#8C6A3A';
      ctx.beginPath(); ctx.ellipse(POT.x, POT.y - 38, 40 * Math.max(0.15, lvl), 6, 0, 0, Math.PI * 2); ctx.fill();
      PLsteam(ctx, POT.x, POT.y - 50);
      // les bols
      SEATS.forEach((id, i) => {
        const x = seatX(i);
        if (!this.present.has(id)) return;
        const b = this.bowls[id];
        ctx.fillStyle = this.locked[id] ? '#8C7E68' : '#CDBB96';
        ctx.beginPath(); ctx.ellipse(x, TABLE_TOP + 4, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 30, TABLE_TOP + 4); ctx.quadraticCurveTo(x, TABLE_TOP + 34, x + 30, TABLE_TOP + 4); ctx.fill();
        if (b > 0) {
          const eaten = this.eating ? Math.min(1, (this.eat || 0)) : 0;
          const k = Math.min(1, b / 2) * (1 - eaten * 0.9);
          ctx.fillStyle = '#7A5A30';
          ctx.beginPath(); ctx.ellipse(x, TABLE_TOP + 4, 26 * Math.max(0.3, k), 7 * Math.max(0.3, k), 0, 0, Math.PI * 2); ctx.fill();
          if (b > 2 && !this.eating) { ctx.beginPath(); ctx.ellipse(x, TABLE_TOP, 14, 7, 0, Math.PI, 0); ctx.fill(); }
        }
        if (this.locked[id]) {
          ctx.strokeStyle = 'rgba(31,26,23,0.7)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x - 18, TABLE_TOP - 6); ctx.lineTo(x + 18, TABLE_TOP + 14); ctx.stroke();
        }
      });
      // louches en vol
      for (const l of this.ladles) {
        const x = U.lerp(l.x0, l.x1, l.t);
        const y = U.lerp(l.y0, l.y1, l.t) - Math.sin(l.t * Math.PI) * 90;
        ctx.fillStyle = '#7A5A30';
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3A3A3E'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26, y - 30); ctx.stroke();
      }
      if (this.poured && this.poured.t < 1.2) {
        const t = U.clamp(this.poured.t / 1.0, 0, 1);
        const x = U.lerp(seatX(this.poured.from), seatX(this.poured.to), t);
        ctx.fillStyle = '#CDBB96';
        ctx.beginPath(); ctx.ellipse(x, TABLE_TOP - 30 - Math.sin(t * Math.PI) * 60, 26, 9, 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (!this.lamp) { ctx.fillStyle = 'rgba(5,6,12,0.42)'; ctx.fillRect(0, 0, G.W, G.H); }
      A.finish(ctx);
    },
    drawUI(c) {
      const show = this.phase !== 'intro';
      SEATS.forEach((id, i) => {
        const x = seatX(i);
        if (!this.present.has(id)) {
          ui.text(c, 'absent', x, 600, { size: 17, italic: true, align: 'center', color: 'rgba(232,223,204,0.55)', shadow: true });
          return;
        }
        // étiquette sous le bol : nom, besoin, faim
        c.fillStyle = 'rgba(20,16,13,0.82)';
        c.beginPath(); c.roundRect(x - 52, 520, 104, 84, 6); c.fill();
        if (this.focus === i && this.phase === 'serve' && !I.mouse) {
          c.strokeStyle = P.rim; c.lineWidth = 2; c.stroke();
        }
        ui.caps(c, NAMES[id], x, 542, { size: 13, align: 'center', color: id === 'henry' ? P.rim : P.paper });
        const need = this.need(id);
        for (let k = 0; k < Math.max(need, this.bowls[id]); k++) {
          const filled = k < this.bowls[id];
          const over = k >= need;
          c.fillStyle = filled ? (over ? P.gold : '#C9A050') : 'rgba(232,223,204,0.18)';
          c.beginPath(); c.arc(x - (Math.max(need, this.bowls[id]) - 1) * 9 + k * 18, 562, 6.5, 0, Math.PI * 2); c.fill();
        }
        const h = G.state.fam[id].hunger;
        ui.text(c, this.locked[id] ? 'refuse' : G.hungerLabel(h).toLowerCase(), x, 590, {
          size: 15, italic: true, align: 'center', color: h >= 2 ? '#E9A07A' : 'rgba(232,223,204,0.7)',
        });
        if (this.phase === 'serve' && this.bowls[id] > 0) {
          const r = minusRect(i);
          ui.button(c, r, '−', { size: 20 });
        }
      });
      if (!show) return;
      // en-tête : la marmite et ce qu'il faudrait
      const needT = this.needTotal();
      c.fillStyle = 'rgba(20,16,13,0.85)';
      c.beginPath(); c.roundRect(G.W / 2 - 330, 24, 660, 76, 8); c.fill();
      ui.text(c, `La marmite : ${this.pot} louche${this.pot > 1 ? 's' : ''}`, G.W / 2, 56, { size: 27, align: 'center' });
      const served = SEATS.reduce((a, id) => a + this.bowls[id], 0);
      ui.text(c, `Il en faudrait ${needT} pour que tout le monde mange à sa faim · servies : ${served}`, G.W / 2, 86, { size: 18, italic: true, align: 'center', color: '#C9BFA9' });
      if (this.phase === 'serve') {
        ui.hint(c, 'Clique sur un bol pour y verser une louche (½ bol). « − » pour en reprendre.', { y: 112, size: 18 });
        ui.button(c, this.serveBtn(), 'Passer à table', { size: 22 });
      }
      if (this.phase === 'papa') ui.hint(c, 'Papa sert.', { y: 112, size: 18 });
    },
  });

  function PLsteam(ctx, x, y) {
    for (let i = 0; i < 3; i++) {
      const k = (G.time * 0.35 + i / 3) % 1;
      ctx.fillStyle = `rgba(230,224,210,${0.22 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x - 10 + i * 10 + Math.sin(k * 6 + i) * 6, y - k * 60, 6 + k * 10, 0, Math.PI * 2); ctx.fill();
    }
  }

  G.DEV = G.DEV || {};
  G.DEV.table = () => G.play(G.Scenes.table({ mode: 'player', pot: 11, idaSkips: true,
    onFirst: { hattie: async () => { await G.say('hattie', 'Garde mon bol pour la petite.'); return (await G.choose([{ t: 'Insister' }, { t: 'Laisser faire' }])) === 0; } } }));
  G.DEV.tablepapa = () => G.play(G.Scenes.table({ mode: 'papa', pot: 12 }));
})();
