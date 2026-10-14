'use strict';
// Pilote automatique (tests uniquement) : joue l'épisode seul, journalise chaque
// réplique et chaque choix. autotest.html#seed=3&pick=random&cp=0
(function () {
  const G = window.G;
  const params = new URLSearchParams(location.hash.slice(1));
  const rnd = G.U.rng(+(params.get('seed') || 1) * 7919);
  const pickMode = params.get('pick') || 'random';
  const startCp = +(params.get('cp') || 0);
  G.timeScale = +(params.get('speed') || 10);
  const log = (...a) => console.log('[jeu]', ...a);
  const pick = (n) => (pickMode === 'first' ? 0 : pickMode === 'last' ? n - 1 : Math.floor(rnd() * n));
  const tiny = () => G.wait(0.02);

  const realSay = G.say;
  const showTalk = params.get('talk') === '1';
  G.say = async (who, text) => { log(`${who}: ${text}`); if (showTalk) await realSay(who, text, { auto: 0.15, cps: 160 }); else await tiny(); };
  G.narrate = async (t) => { (Array.isArray(t) ? t : [t]).forEach((x) => log('NARRATION', x)); await tiny(); };
  G.card = async (t, s) => { log('CARTON', t, s || ''); await tiny(); };
  G.choose = async (opts, o = {}) => { const i = pick(opts.length); log('CHOIX', o.prompt || '', '→', opts[i].t); await tiny(); return i; };

  const until = async (f) => { while (!f()) await G.wait(0.05); };
  const EXITS = ['door', 'bridge', 'spot', 'home', 'bed'];
  const realWalk = G.Scenes.walk;
  G.Scenes.walk = (cfg) => {
    const sc = realWalk(cfg);
    const enter = sc.enter.bind(sc);
    sc.enter = function () {
      enter();
      (async () => {
        await G.wait(0.1);
        await until(() => !sc.busy || sc._done);
        for (const tr of sc.triggers) {
          if (sc._done) return;
          if (tr.fired || (tr.if && !G.test(tr.if))) continue;
          tr.fired = true; sc.px = tr.x; await sc.runAct(tr.act, tr);
        }
        const acts = (cfg.things || []).filter((t) => t.act);
        const normal = acts.filter((t) => !EXITS.includes(t.id));
        // veillée : une seule personne au hasard
        const isVeillee = acts.some((t) => t.id === 'bed');
        const list = isVeillee ? [normal[pick(normal.length)]] : normal;
        for (const t of list) {
          if (sc._done) return;
          if (t.visible && !t.visible(sc)) continue;
          sc.px = t.x - 70; await sc.runAct(t.act, t);
        }
        for (const t of acts.filter((t) => EXITS.includes(t.id))) { if (sc._done) return; await sc.runAct(t.act, t); }
      })().catch((e) => { console.error(e); G.fatal = String(e.stack || e); });
    };
    return sc;
  };

  const stub = (name, fn) => {
    G.Scenes[name] = (opts = {}) => G.makeScene({
      enter() { (async () => { await G.wait(0.1); this.finish(await fn(opts, this)); })().catch((e) => { console.error(e); G.fatal = String(e.stack || e); }); },
      draw(ctx) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, G.W, G.H); G.ui.text(ctx, name, 40, 60, { size: 30 }); },
    });
  };
  stub('footbridge', async () => { const p = 1 + Math.floor(rnd() * 3); log('PASSERELLE', p, 'gamelles'); return { pails: p, lost: [] }; });
  stub('fishing', async (o) => {
    const fish = [];
    for (let i = 0; i < 4; i++) {
      const f = rnd() < 0.7 ? { name: ['Crapet', 'Perche', 'Achigan'][i % 3], halves: 1 + (i % 3) } : null;
      if (f) fish.push(f);
      if (o.between) await o.between({ index: i, caught: !!f, fish: f, total: fish.length });
    }
    log('PÊCHE', fish.length, 'poissons'); return { fish, halves: fish.reduce((a, f) => a + f.halves, 0) };
  });
  stub('ginseng', async (o) => {
    if (o.onMistake) await o.onMistake({ kind: G.U.pick(['ivy', 'jack', 'creeper', 'sarsaparilla']) });
    const n = Math.floor(rnd() * 4);
    const roots = [];
    for (let i = 0; i < n; i++) { roots.push({ quality: 0.4 + rnd() * 0.6 }); if (o.onRoot) await o.onRoot({ index: i, quality: roots[i].quality }); }
    log('GINSENG', n, 'racines'); return { roots, mistakes: {}, itchy: true };
  });
  stub('applebutter', async (o) => { for (const i of [0, 1]) if (o.interlude) await o.interlude(i); return { score: 0.7, perfects: 20, goods: 30, misses: 10, jars: 1 + Math.floor(rnd() * 3), burned: false }; });
  stub('moonshine', async (o) => { if (o.onArrive) await o.onArrive(); const j = 3 + Math.floor(rnd() * 4); log('LIVRAISON', j, 'bocaux'); return { jars: j, broken: 6 - j, caught: 1, seconds: 160 }; });
  stub('photo', async (o) => { log('PHOTO', (o.members || []).length, 'personnes'); G.familyPhoto = null; return { layout: {}, pearlInArms: false, retakes: 0 }; });
  stub('haggle', async () => { const c = 250 + Math.floor(rnd() * 250); log('VENTE', c); return { cents: c, soldTo: 'thornbury' }; });
  stub('store', async (o) => {
    if (o.intro) await o.intro();
    const cash = o.getCash ? o.getCash() : 40;
    const items = cash >= 40 ? ['meal10', 'lard'] : ['meal5', 'beans', 'candy'];
    if (o.outro) await o.outro();
    log('MAGASIN', items.join(','));
    return { items, spent: 38, credit: 0 };
  });
  // La table : la vraie scène, pilotée.
  const realTable = G.Scenes.table;
  G.Scenes.table = (opts) => {
    const sc = realTable(opts);
    const enter = sc.enter.bind(sc);
    sc.enter = function () {
      enter();
      (async () => {
        if (sc.mode !== 'player') return;
        await until(() => sc.phase === 'serve');
        for (const id of ['pearl', 'ruth', 'hattie', 'henry', 'wes', 'clay', 'ida']) {
          while (sc.present.has(id) && !sc.locked[id] && sc.bowls[id] < G.NEED[id] && sc.pot > 0) await sc.tryServe(id);
        }
        log('TABLE servie', JSON.stringify(sc.bowls), 'reste', sc.pot);
        sc.serve();
      })().catch((e) => { console.error(e); G.fatal = String(e.stack || e); });
    };
    return sc;
  };

  G.loadFonts().then(() => G.start(async () => {
    G.newGame();
    G.state.cp = startCp;
    G.inEpisode = true;
    await G.episode1();
    log('FIN', JSON.stringify({ money: G.state.money, ardoise: G.state.ardoise, flags: G.state.flags, fam: G.state.fam, minutes: Math.round(G.state.playSeconds / 60) }));
    window.__done = true;
  }));
})();
