'use strict';
// Noyau : canvas, boucle, entrées, scènes asynchrones, superpositions, minuteries.
(function () {
  const G = (window.G = window.G || {});
  G.W = 1280;
  G.H = 720;
  G.Scenes = G.Scenes || {};

  // ------------------------------------------------------------------ utilitaires
  const U = (G.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    inv: (a, b, v) => (v - a) / (b - a),
    smooth: (t) => t * t * (3 - 2 * t),
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeIn: (t) => t * t * t,
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    inRect: (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    // Générateur pseudo-aléatoire déterministe (xorshift) pour les décors.
    rng(seed) {
      let s = seed >>> 0 || 1;
      return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
      };
    },
    // Montants en cents → « 40 ¢ » ou « 1,25 $ ».
    money(c) {
      c = Math.round(c);
      if (Math.abs(c) < 100) return `${c} ¢`;
      const d = (c / 100).toFixed(2).replace('.', ',');
      return `${d} $`;
    },
  });

  // ------------------------------------------------------------------ canvas
  // Deux canvas superposés : « scene » reçoit le filtre de couleur de l'Espoir,
  // « ui » (dialogues, interface, fondus) reste net et non filtré.
  const sceneCanvas = document.getElementById('scene');
  const uiCanvas = document.getElementById('ui');
  G.ctx = sceneCanvas.getContext('2d');
  G.uctx = uiCanvas.getContext('2d');
  G.dpr = 1;
  G.view = { x: 0, y: 0, w: G.W, h: G.H, scale: 1 };

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / G.W, vh / G.H);
    const w = Math.floor(G.W * scale);
    const h = Math.floor(G.H * scale);
    const x = Math.floor((vw - w) / 2);
    const y = Math.floor((vh - h) / 2);
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [sceneCanvas, uiCanvas]) {
      c.style.left = x + 'px';
      c.style.top = y + 'px';
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      c.width = Math.round(w * G.dpr);
      c.height = Math.round(h * G.dpr);
    }
    G.view = { x, y, w, h, scale };
    const k = scale * G.dpr;
    G.ctx.setTransform(k, 0, 0, k, 0, 0);
    G.uctx.setTransform(k, 0, 0, k, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------------ entrées
  const I = (G.input = {
    x: G.W / 2, y: G.H / 2,
    down: false, pressed: false, released: false,
    keys: new Set(), kp: new Set(),
    mouse: true, // faux après un toucher : pas de survol à afficher
    key: (c) => I.keys.has(c),
    hit: (c) => I.kp.has(c),
    // Appui « valider » : clic, Espace, Entrée ou E.
    confirm: () => I.pressed || I.kp.has('Space') || I.kp.has('Enter') || I.kp.has('KeyE'),
    consume() { I.pressed = false; I.released = false; I.kp.clear(); },
  });
  function toLogical(e) {
    I.x = ((e.clientX - G.view.x) / G.view.w) * G.W;
    I.y = ((e.clientY - G.view.y) / G.view.h) * G.H;
  }
  uiCanvas.addEventListener('pointerdown', (e) => {
    toLogical(e);
    I.mouse = e.pointerType === 'mouse';
    I.down = true;
    I.pressed = true;
    try { uiCanvas.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    G.audio && G.audio.unlock();
    e.preventDefault();
  });
  uiCanvas.addEventListener('pointermove', (e) => {
    toLogical(e);
    if (e.pointerType === 'mouse') I.mouse = true;
  });
  const up = (e) => {
    toLogical(e);
    if (I.down) I.released = true;
    I.down = false;
  };
  uiCanvas.addEventListener('pointerup', up);
  uiCanvas.addEventListener('pointercancel', up);
  uiCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const BLOCK = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  window.addEventListener('keydown', (e) => {
    if (BLOCK.includes(e.code)) e.preventDefault();
    if (!e.repeat) I.kp.add(e.code);
    I.keys.add(e.code);
    G.audio && G.audio.unlock();
  });
  window.addEventListener('keyup', (e) => I.keys.delete(e.code));
  window.addEventListener('blur', () => { I.keys.clear(); I.down = false; });

  // ------------------------------------------------------------------ minuteries (temps de jeu)
  G.time = 0;
  const timers = [];
  G.after = (sec, fn) => timers.push({ t: G.time + sec, fn });
  G.wait = (sec) => new Promise((res) => G.after(sec, res));
  // Attend un appui « valider ».
  G.waitConfirm = () => new Promise((res) => {
    const o = { modal: true, update() { if (I.confirm()) { I.consume(); G.popOverlay(o); res(); } }, draw() {} };
    G.pushOverlay(o);
  });

  // ------------------------------------------------------------------ superpositions
  // Une superposition « modale » (dialogue, choix) capte les entrées : la scène
  // continue de s'animer mais ne reçoit plus les appuis (G.blocked vaut vrai).
  G.overlays = [];
  G.pushOverlay = (o) => { G.overlays.push(o); return o; };
  G.popOverlay = (o) => { const i = G.overlays.indexOf(o); if (i >= 0) G.overlays.splice(i, 1); };
  G.blocked = false;

  // ------------------------------------------------------------------ scènes
  // Une scène est un objet { enter(), update(dt), draw(ctx), drawUI(uctx), exit() }.
  // G.play(scene) l'affiche (avec un fondu) et renvoie une promesse résolue
  // quand la scène appelle this.finish(résultat).
  G.scene = null;
  G.fade = { a: 1, target: 0, speed: 2.4, color: '#0d0b0a' };

  G.makeScene = (obj) => {
    obj.t = 0;
    obj.finish = (result) => {
      if (obj._done) return;
      obj._done = true;
      obj._resolve && obj._resolve(result);
    };
    return obj;
  };

  let pending = null;
  G.play = (scene, opts = {}) => new Promise((res) => {
    if (!scene.finish) G.makeScene(scene);
    scene._resolve = res;
    pending = { scene, fadeSpeed: opts.fade || 2.4, color: opts.color || '#0d0b0a' };
    G.fade.color = pending.color;
    G.fade.speed = pending.fadeSpeed;
    G.fade.target = 1;
  });

  function swapIfReady() {
    if (!pending || G.fade.a < 0.999) return;
    const old = G.scene;
    if (old && old.exit) old.exit();
    G.scene = pending.scene;
    pending = null;
    G.scene.t = 0;
    if (G.scene.enter) G.scene.enter();
    G.fade.target = 0;
  }

  // ------------------------------------------------------------------ Espoir → couleur
  // Le filtre CSS ne s'applique qu'au canvas de scène.
  let satCur = 1, sepCur = 0, filterStr = '';
  function updateFilter(dt) {
    const e = G.state ? G.espoir() : 1;
    const override = G.scene && G.scene.colorOverride;
    const satT = override ? override.sat : 0.32 + 0.78 * e;
    const sepT = override ? override.sepia : (1 - e) * 0.62;
    const k = 1 - Math.pow(0.15, dt);
    satCur = U.lerp(satCur, satT, k);
    sepCur = U.lerp(sepCur, sepT, k);
    const s = `saturate(${satCur.toFixed(3)}) sepia(${sepCur.toFixed(3)})`;
    if (s !== filterStr) { filterStr = s; sceneCanvas.style.filter = s; }
  }
  G.snapColor = () => {
    const e = G.espoir();
    satCur = 0.32 + 0.78 * e;
    sepCur = (1 - e) * 0.62;
  };

  // ------------------------------------------------------------------ boucle
  let last = performance.now();
  G.frame = 0;
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    if (G.timeScale) dt *= G.timeScale;
    G.time += dt;
    G.frame++;

    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].t <= G.time) { const t = timers.splice(i, 1)[0]; t.fn(); }
    }

    // Fondu
    G.fade.a = G.fade.a < G.fade.target
      ? Math.min(G.fade.target, G.fade.a + dt * G.fade.speed)
      : Math.max(G.fade.target, G.fade.a - dt * G.fade.speed);
    swapIfReady();

    // Les superpositions passent avant la scène et consomment les entrées.
    const top = G.overlays[G.overlays.length - 1];
    G.blocked = G.overlays.some((o) => o.modal) || G.fade.a > 0.4;
    for (let i = G.overlays.length - 1; i >= 0; i--) {
      const o = G.overlays[i];
      if (o.update) o.update(dt, o === top);
    }
    if (G.blocked) I.consume();

    const ctx = G.ctx;
    const uctx = G.uctx;
    if (G.scene) {
      G.scene.t += dt;
      if (G.scene.update) G.scene.update(dt);
    }
    ctx.save();
    ctx.fillStyle = '#0d0b0a';
    ctx.fillRect(0, 0, G.W, G.H);
    if (G.scene && G.scene.draw) G.scene.draw(ctx);
    ctx.restore();

    uctx.clearRect(0, 0, G.W, G.H);
    uctx.save();
    if (G.scene && G.scene.drawUI) G.scene.drawUI(uctx);
    uctx.restore();
    for (const o of G.overlays) { uctx.save(); if (o.draw) o.draw(uctx); uctx.restore(); }
    if (G.ui && G.ui.drawToasts) G.ui.drawToasts(uctx, dt);
    if (G.fade.a > 0) {
      uctx.globalAlpha = G.fade.a;
      uctx.fillStyle = G.fade.color;
      uctx.fillRect(0, 0, G.W, G.H);
      uctx.globalAlpha = 1;
    }

    updateFilter(dt);
    I.pressed = false;
    I.released = false;
    I.kp.clear();
    requestAnimationFrame(loop);
  }

  G.start = (main) => {
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
    Promise.resolve().then(main).catch((err) => {
      console.error(err);
      G.fatal = String(err && err.stack || err);
    });
  };
})();
