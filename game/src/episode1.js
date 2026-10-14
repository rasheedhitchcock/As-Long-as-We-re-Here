'use strict';
// Épisode 1 · Le dernier sifflet : le déroulé, scène par scène.
// Chaque chapitre se termine par un point de sauvegarde (G.checkpoint).
(function () {
  const G = window.G;
  const U = G.U;
  const T = G.T1;
  const PL = G.places;
  const SUMMER = { sat: 1.08, sepia: 0.04 };

  const walk = (cfg) => G.play(G.Scenes.walk(cfg));
  const hud = (date, goal, money) => Object.assign(G.hud, { date, goal, money: !!money, show: true });

  // Joue une scène et lance un script dès qu'elle est affichée.
  async function playWith(scene, script) {
    const p = G.play(scene);
    await G.wait(0.45);
    while (G.fade.a > 0.05) await G.wait(0.05);
    if (script) await G.run(script);
    return p;
  }

  // Un dialogue qui ne se joue qu'une fois ; ensuite, une réplique plus courte.
  const once = (script, again) => {
    let done = false;
    return async () => {
      if (done) { if (again) await G.run(again); return; }
      done = true;
      await G.run(typeof script === 'function' ? script() : script);
    };
  };

  // Scène fixe : un décor et un script, sans déplacement.
  const stage = (drawBg, script, o = {}) => walk(Object.assign({
    width: G.W, floor: PL.houseFloor, start: o.x || 600, bounds: [o.x || 600, o.x || 600], rim: false,
    drawBg, things: o.things || [], player: { o: { alpha: o.hideHenry ? 0 : 1 } },
    onEnter: async (s) => { await G.wait(0.6); await G.run(script); s.finish(); },
  }, o.cfg || {}));

  // Écran noir (avant une narration d'ouverture, par exemple).
  const black = () => G.play(G.makeScene({
    enter() { this.finish(); },
    draw(ctx) { ctx.fillStyle = '#0d0b0a'; ctx.fillRect(0, 0, G.W, G.H); },
  }));

  // Après un repas : faim et moral de chacun.
  G.eatMeal = (served, present) => {
    for (const id of present) {
      const m = G.state.fam[id];
      const need = G.NEED[id];
      const got = served[id] || 0;
      if (got >= need) { m.hunger = Math.max(0, m.hunger - 1); G.mood({ [id]: 0.1 }); }
      else if (got * 2 >= need) { G.mood({ [id]: -0.05 }); }
      else { m.hunger = Math.min(4, m.hunger + 1); G.mood({ [id]: id === 'pearl' || id === 'ruth' ? -0.3 : -0.18 }); }
    }
    const kidsHungry = ['pearl', 'ruth'].some((id) => present.includes(id) && (served[id] || 0) < G.NEED[id]);
    if (kidsHungry) G.mood({ ida: -0.2, kenneth: -0.15 });
    const total = Object.values(served).reduce((a, b) => a + b, 0);
    G.takeFood(total);
  };

  // ------------------------------------------------------------------ positions dans la maison
  const HOUSE = PL.houseFloor;
  const fam = (id, x, o, act, label) => ({ id, char: id, x, o: Object.assign({ seed: x }, o || {}), act, label: label || G.CHARS[id].name });

  // ================================================================== PROLOGUE
  async function prologue() {
    G.hud.show = false;
    G.audio.amb(['wind']);
    await black();
    await G.narrate(T.intro, { who: 'old' });
    await G.card('Hollis, Kentucky', 'Vendredi 12 août 1932', { eyebrow: 'Prologue' });
    hud('Vendredi 12 août 1932', 'Porter les gamelles à l\'usine');

    // La maison, à midi
    await walk({
      width: G.W, floor: HOUSE, start: 880, dir: -1, bounds: [110, 990], colorOverride: SUMMER,
      amb: ['birds', 'wind', 'fire'], song: G.audio.SONGS.camp,
      drawBg: (ctx) => PL.house(ctx, { time: 'summer', season: 'summer', fiddleOnWall: true }),
      things: [
        fam('ida', 522, { dir: -1, arms: [0.1, 1.2] }, async (s) => {
          if (G.flag('gotPails')) { await G.say('ida', 'Allez, file. Et tu cours pas.'); return; }
          await G.run(T.pIda);
          s.player.o = { carry: 'pails' };
          G.hud.goal = 'Porter les gamelles à l\'usine (par le camp)';
        }),
        fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' }, once(T.pHattie, [['hattie', 'File, avant que le lard refroidisse.']])),
        fam('ruth', 655, { pose: 'sit', seatH: 25, carry: 'book' }, once(T.pRuth, [['ruth', 'Chut. Je lis.']])),
        fam('pearl', 704, { dir: -1 }, once(T.pPearl, [['pearl', 'Jusqu\'à vingt ! Tu verras !']])),
        { id: 'door', x: 120, w: 90, h: 190, label: 'Sortir', act: async (s) => {
          if (!G.flag('gotPails')) { await G.run(T.pNeedPails); return; }
          s.finish();
        } },
      ],
    });

    // Le camp
    await walk({
      width: PL.campWidth, floor: 626, start: 140, bounds: [80, 2600], colorOverride: SUMMER,
      amb: ['birds', 'wind'], song: G.audio.SONGS.camp, player: { o: { carry: 'pails' } },
      drawBg: (ctx, cam) => PL.camp(ctx, cam, { season: 'summer', time: 'summer' }),
      things: [
        { id: 'nora', char: 'nora', x: 470, o: { dir: -1, arms: [0.2, 1.3] }, label: 'Mrs. Napier', act: once(T.pNora, [['nora', 'Va, va.']]) },
        { id: 'kid', char: 'napierKid', x: 840, o: { dir: -1 }, label: 'Jimmy Napier', act: once(T.pKid, [['kid', 'Poule mouillée !']]) },
        { id: 'pruitt', char: 'pruitt', x: 1690, y: 560, o: { dir: -1, carry: 'stick' }, label: 'Mr. Pruitt', act: once(T.pPruitt, [['pruitt', 'Les comptes, c\'est les comptes.']]) },
        { id: 'otis', char: 'otis', x: 2290, o: { dir: -1 }, label: 'Otis', act: once(T.pOtis, [['otis', 'Demain, au trou de la Barbue !']]) },
        { id: 'bridge', x: 2560, w: 110, h: 220, label: 'La passerelle', act: async (s) => s.finish() },
      ],
    });

    // La passerelle
    const fb = await G.play(G.Scenes.footbridge({}));
    const pails = fb ? fb.pails : 3;
    G.setFlag('pails', pails);
    if (pails < 3) G.log(`pailsLost:${3 - pails}`);
    const has = { kenneth: pails >= 1, clay: pails >= 2, wes: pails >= 3 };

    // La scierie
    const given = {};
    let carried = pails;
    let announced = false;
    const workersStanding = { v: false };
    const mill = G.Scenes.walk({
      width: PL.millWidth, floor: 626, start: 440, bounds: [420, 1860], colorOverride: SUMMER,
      amb: ['mill', 'wind'], song: null, player: { o: { carry: 'pails', pails } },
      hud: { goal: 'Donner les gamelles à Papa, Clay et Wes' },
      drawBg: (ctx, cam) => {
        PL.millYard(ctx, cam, { closed: announced });
        PL.logs(ctx, 960 - cam, 626, 3);
        if (announced) { ctx.fillStyle = '#5A4128'; ctx.fillRect(1470 - cam, 586, 60, 40); }
      },
      onEnter: async () => {
        await G.wait(0.8);
        G.audio.whistle(2.4, 0.11);
        await G.wait(0.4);
        await G.run(T.pMillArrive);
      },
      things: [
        { id: 'w1', char: 'worker1', x: 560, o: { pose: 'sit', seatH: 46 }, label: 'Les ouvriers', act: once(T.pWorker, [['worker', 'Va donc, petit.']]) },
        { id: 'w2', char: 'worker2', x: 650, o: { dir: -1 } },
        { id: 'w3', char: 'worker3', x: 720, o: { pose: 'sit', seatH: 40, dir: -1 } },
        { id: 'papa', char: 'kenneth', x: 990, o: { pose: 'sit', seatH: 44 }, label: 'Papa', act: async (s) => {
          if (given.kenneth) { await G.say('kenneth', 'Va voir tes frères.'); return; }
          given.kenneth = true;
          await G.run(T.pPapa(has.kenneth));
          carried -= has.kenneth ? 1 : 0; s.player.o = { carry: 'pails', pails: carried };
          await checkAll(s);
        } },
        { id: 'clay', char: 'clay', x: 1150, o: { dir: -1, lean: -0.08 }, label: 'Clay', act: async (s) => {
          if (given.clay) { await G.say('clay', 'Quoi ?'); return; }
          given.clay = true;
          await G.run(T.pClay(has.clay));
          carried -= has.clay ? 1 : 0; s.player.o = { carry: 'pails', pails: carried };
          await checkAll(s);
        } },
        { id: 'wes', char: 'wes', x: 1290, o: { pose: 'sit', seatH: 40, dir: -1 }, label: 'Wes', act: async (s) => {
          if (given.wes) { await G.say('wes', 'Ce soir. Tu vas pleurer.'); return; }
          given.wes = true;
          await G.run(T.pWes(has.wes));
          carried -= has.wes ? 1 : 0; s.player.o = { carry: 'pails', pails: carried };
          await checkAll(s);
        } },
        { id: 'garvey', char: 'super', x: 1500, o: { dir: -1 } },
      ],
    });
    async function checkAll(s) {
      if (!(given.kenneth && given.clay && given.wes) || announced) return;
      announced = true;
      G.hud.goal = '';
      s.player.o = {};
      await G.wait(0.6);
      const garvey = s.cfg.things.find((t) => t.id === 'garvey');
      garvey.y = 586;
      await G.run(T.pAnnounce);
      G.audio.amb(['wind']);
      G.audio.whistle(9, 0.15);
      for (const t of s.cfg.things) if (t.o && t.o.pose === 'sit') { t.o = Object.assign({}, t.o, { pose: 'stand' }); }
      const papa = s.cfg.things.find((t) => t.id === 'papa');
      papa.o = { hat: null, arms: [-0.05, 0.6] };
      for (const line of T.pWhistleThoughts) await G.say('nar', line, { cps: 30 });
      G.audio.song(G.audio.SONGS.sad, { fadeIn: 3 });
      await G.run(T.pAfterWhistle);
      await G.run(T.pPapaPail(has.kenneth));
      if (has.kenneth) G.setFlag('papaPailBack');
      await G.wait(0.4);
      s.finish();
    }
    await G.play(mill);

    G.hud.show = false;
    await G.narrate(T.pAfterMill, { who: 'old' });
    // Deux mois plus tard : l'argent est parti, la faim est là.
    G.mood({ all: -0.55, kenneth: -0.45, clay: -0.25 });
    for (const id of G.FAMILY) G.state.fam[id].hunger = 1;
    G.state.pantry = [{ id: 'reste', name: 'Le fond du sac de farine', halves: 6, tag: 'grain' }];
    G.state.money = 0;
  }

  // ================================================================== JOUR 1 : MATIN ET MAGASIN
  async function day1Morning() {
    G.audio.stopSong();
    await G.card('Lundi 17 octobre 1932', 'Deux mois plus tard', { eyebrow: 'Jour 1' });
    hud('Lundi 17 octobre 1932', 'Parler à M\'man');
    await walk({
      width: G.W, floor: HOUSE, start: 860, dir: -1, bounds: [110, 990],
      amb: ['fire', 'wind'], song: null,
      drawBg: (ctx) => PL.house(ctx, { time: 'dawn', lamp: false, fiddleOnWall: false }),
      onEnter: async () => { await G.wait(0.8); await G.run(T.d1Wake); },
      things: [
        fam('kenneth', 140, { dir: -1 }, once(T.d1Papa, [['kenneth', 'Va. Ta mère t\'attend.']])),
        fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' }, once(T.d1Hattie, [['hattie', 'Demain. Avant le jour.']])),
        fam('ida', 522, { dir: -1, arms: [0.1, 1.2] }, async () => {
          if (G.flag('gotErrand')) { await G.run(T.d1IdaAgain); return; }
          await G.run(T.d1Ida);
          hud('Lundi 17 octobre 1932', 'Aller au magasin de la compagnie (40 ¢)', true);
        }),
        fam('ruth', 655, { pose: 'sit', seatH: 25, carry: 'book' }, once(T.d1Ruth, [['ruth', 'Cent vingt comtés…']])),
        fam('pearl', 704, { dir: -1 }, once(T.d1Pearl, [['pearl', 'Houuuuu !']])),
        fam('wes', 800, { carry: 'fiddle', arms: [0.9, 1.3] }, once(T.d1Wes, [['wes', 'Trois cordes, Henry. Trois.']])),
        fam('clay', 950, { pose: 'sit', seatH: 30, dir: -1, arms: [1.2, 1.5] }, once(T.d1Clay, [['clay', 'Laisse-moi.']])),
        { id: 'door', x: 120, w: 90, h: 190, label: 'Aller au magasin', act: async (s) => {
          if (!G.flag('gotErrand')) { await G.say('ida', 'Henry ! Viens là d\'abord.'); return; }
          s.finish();
        } },
      ],
    });

    const res = await G.play(G.Scenes.store({
      cash: 40,
      intro: async () => G.run(T.d1StoreIntro),
      getCash: () => (G.flag('helpedNapier') ? 35 : 40),
      outro: async () => G.run(T.d1StoreOutro),
    }));
    for (const id of res.items) {
      const it = G.STORE_ITEMS.find((x) => x.id === id);
      if (it.halves > 0) G.state.pantry.push({ id: it.id, name: `${it.name} (${it.qty})`, halves: it.halves, tag: it.tag });
      if (id === 'coffee') G.setFlag('coffee');
      if (id === 'kerosene') G.setFlag('lamp');
      if (id === 'candy') { G.setFlag('candy'); G.mood({ pearl: 0.5 }); }
      if (id === 'milk') G.mood({ pearl: 0.2, ida: 0.1 });
      if (id === 'molasses') G.mood({ all: 0.08 });
    }
    if (res.credit > 0) { G.state.ardoise += res.credit; G.setFlag('usedCredit'); G.log('usedCredit'); }
    G.setFlag('boughtItems', res.items.join(','));
  }

  // ================================================================== JOUR 1 : LA PÊCHE
  async function day1Fishing() {
    hud('Lundi 17 octobre 1932', 'Pêcher avec Otis', true);
    const res = await playWith(G.Scenes.fishing({
      between: async (e) => { const s = T.d1FishTalk[e.index]; if (s) await G.run(s); },
    }), T.d1FishIntro());
    const fish = (res && res.fish) || [];
    await G.run(T.d1FishEnd(fish.length));
    let kept = fish.slice().sort((a, b) => b.halves - a.halves);
    if (G.flag('gaveFishOtis') && kept.length) kept = kept.slice(1);
    if (G.flag('otisGaveFish')) kept.push({ name: 'Perche (d\'Otis)', halves: 2 });
    for (const f of kept) if (f.halves > 0) G.state.pantry.push({ id: 'fish', name: f.name, halves: f.halves, tag: 'poisson' });
    G.setFlag('fishCount', fish.length);
  }

  // ================================================================== JOUR 1 : LA TABLE ET LA VEILLÉE
  async function day1Evening() {
    hud('Lundi 17 octobre 1932', 'Le souper', true);
    const intro = [...T.d1TableIntro];
    if (G.flag('usedCredit')) intro.push(['ida', 'Pruitt m\'a dit pour le crédit, Henry.'], ['ida', 'On en reparlera.'], { mood: { ida: -0.2 } });
    if (G.flag('coffee')) intro.push('Il y avait du café. Papa le but lentement, les deux mains autour de la tasse, comme on se chauffe.', { mood: { kenneth: 0.4 } });
    if (G.flag('candy')) intro.push('Pearl suçait son sucre d\'orge en faisant durer, les yeux fermés.');
    if (!G.flag('lamp')) intro.push('La lampe était vide. On mangea à la lueur du poêle.', { mood: { all: -0.06 } });
    const present = [...G.FAMILY];
    const res = await G.play(G.Scenes.table({
      mode: 'papa', pot: G.pantryHalves(), lamp: G.flag('lamp'), present,
      intro: async () => G.run(intro),
      afterServe: async (scene) => {
        T.hooks.transfer = (a, b, k) => scene.transfer(a, b, k);
        await G.run(T.d1TableAfter(scene.papaShort));
      },
    }));
    G.eatMeal(res.served, present);
    G.checkpoint(4);
    await veillee(T.v1, T.v1Prompt, T.v1Sleep, ['kenneth', 'ida', 'wes', 'ruth', 'pearl', 'hattie', 'clay'], 'Lundi 17 octobre 1932', 'v1done');
  }

  // Veillée : une seule conversation, puis au lit.
  async function veillee(V, prompt, sleep, ids, date, doneFlag) {
    hud(date, 'La veillée : parle à quelqu\'un, puis va dormir');
    const spots = {
      kenneth: [140, { pose: 'sit', seatH: 20, dir: -1 }], ida: [560, { dir: -1, arms: [0.3, 1.1] }],
      hattie: [262, { pose: 'sit', seatH: 37, carry: 'pipe' }], ruth: [655, { pose: 'sit', seatH: 25, carry: 'book' }],
      pearl: [370, { pose: 'sit', seatH: 44 }], wes: [800, { carry: 'fiddle', arms: [0.9, 1.3] }],
      clay: [950, { pose: 'sit', seatH: 30, dir: -1 }],
    };
    let talked = false;
    await walk({
      width: G.W, floor: HOUSE, start: 600, dir: 1, bounds: [110, 990],
      amb: ['fire', 'night'], song: null,
      drawBg: (ctx) => PL.house(ctx, { time: 'night', lamp: G.flag('lamp'), fiddleOnWall: false }),
      onEnter: async () => { await G.wait(0.6); await G.say('nar', prompt); },
      things: [
        ...ids.filter((id) => spots[id] && (id !== 'kenneth' || !G.flag('papaAway')) && (id !== 'clay' || !G.flag('clayAway'))).map((id) => fam(id, spots[id][0], spots[id][1], async (s) => {
          if (talked) return;
          talked = true;
          await G.run(V[id]());
          await G.run(sleep);
          s.finish();
        })),
        { id: 'bed', x: 990, w: 80, h: 120, label: 'Aller dormir', act: async (s) => { await G.run(sleep); s.finish(); } },
      ],
    });
    if (doneFlag) { G.setFlag(doneFlag); G.save(); }
  }

  // ================================================================== JOUR 2 : LA MONTAGNE
  async function day2Mountain() {
    await G.card('Mardi 18 octobre 1932', null, { eyebrow: 'Jour 2' });
    G.setFlag('papaAway'); G.setFlag('clayAway');
    hud('Mardi 18 octobre 1932', 'Suivre Granny jusqu\'aux hêtres', true);
    await walk({
      width: PL.mountainWidth, floor: 590, start: 150, bounds: [100, 2480], speed: 170,
      amb: ['wind', 'birds'], song: null, player: { o: { carry: 'sack' } },
      followers: [{ char: 'hattie', gap: 100, speed: 150, o: { carry: 'pipe' } }],
      drawBg: (ctx, cam) => PL.mountain(ctx, cam, { time: 'dawn' }),
      onEnter: async () => { await G.wait(0.6); await G.run(T.d2Start); },
      triggers: T.d2Walk.map((sc, i) => ({ x: 520 + i * 640, act: async () => G.run(sc) })),
      things: [{ id: 'spot', x: 2440, w: 120, h: 260, label: 'Le coin des hêtres', act: async (s) => s.finish() }],
    });

    const res = await G.play(G.Scenes.ginseng({
      outro: false,
      onRoot: async (e) => { await G.run(T.d2RootQuality(e.quality)); const s = T.d2Root[e.index]; if (s) await G.run(s); },
      onMistake: async (e) => { const s = T.d2Mistake[e.kind]; if (s) await G.run(s); },
    }));
    let roots = (res && res.roots) || [];
    if (roots.length > 0 && roots.length < 3) await G.run(T.d2Dusk);
    if (!roots.length) {
      await G.run([['hattie', 'Rien ? Bon. Regarde.'], 'Granny se pencha, écarta trois feuilles mortes et sortit une racine du premier coup, comme on sort un mouchoir de sa poche.', ['hattie', 'Ça vient avec les années. Ou jamais.']]);
      roots = [{ quality: 0.7 }];
    }
    G.state.flags.roots = roots;
    if (res && res.itchy) G.setFlag('itchy');
    hud('Mardi 18 octobre 1932', 'Redescendre au camp', true);

    await walk({
      width: PL.mountainWidth, floor: 590, start: 2400, dir: -1, bounds: [100, 2480], speed: 170,
      amb: ['wind'], song: null, player: { o: { carry: 'sack' } },
      followers: [{ char: 'hattie', gap: -100, speed: 150, o: { carry: 'pipe' } }],
      drawBg: (ctx, cam) => { PL.mountain(ctx, cam, { time: 'dusk' }); PL.still(ctx, 1180 - cam, 590); },
      triggers: [{ x: 1500, dir: -1, act: async () => G.run(T.d2Dow) }],
      things: [
        { id: 'dow', char: 'dow', x: 1320, o: { dir: 1, carry: 'stick' }, visible: () => true },
        { id: 'home', x: 140, w: 120, h: 260, label: 'Rentrer', act: async (s) => s.finish() },
      ],
    });
  }

  // ================================================================== JOUR 2 : LE SOIR
  async function day2Evening() {
    hud('Mardi 18 octobre 1932', 'Le souper', true);
    const present = G.FAMILY.filter((id) => id !== 'kenneth' && id !== 'clay');
    if (G.flag('helpedNapier')) {
      G.state.pantry.push({ id: 'beans', name: 'Haricots des Napier', halves: 4, tag: 'haricots' });
    }
    let idaPoured = false;
    const tags = G.pantryTags();
    const grainOnly = [...tags].every((t) => t === 'grain' || t === 'gras');
    const pot = G.pantryHalves();
    const needT = present.reduce((a, id) => a + G.NEED[id], 0);
    const res = await G.play(G.Scenes.table({
      mode: 'player', pot, lamp: G.flag('lamp'), present,
      idaSkips: pot < needT && !G.flag('confrontedIda'),
      intro: async () => G.run([...(G.flag('helpedNapier') ? T.d2NoraKnock : []), ...T.d2TableIntro]),
      onFirst: {
        hattie: async () => {
          await G.run(T.d2HattieRefuse);
          const i = await G.choose(T.d2HattieChoice);
          if (i === 0) { G.mood({ hattie: 0.2 }); await G.say('hattie', '… Une demi-louche, alors. Pour te faire plaisir.'); return true; }
          G.setFlag('hattieSkipped');
          return false;
        },
      },
      afterServe: async (scene, served) => {
        idaPoured = G.flag('idaPouredBack');
        await G.run(T.d2TableAfter({ idaPoured, idaAte: (served.ida || 0) > 0 && G.flag('confrontedIda'), grainOnly }));
      },
    }));
    G.eatMeal(res.served, present);
    G.checkpoint(6);
    await veillee(T.v2, T.v2Prompt, T.v2Sleep, ['hattie', 'ida', 'ruth', 'wes', 'pearl'], 'Mardi 18 octobre 1932', 'v2done');
  }

  // ================================================================== JOUR 3 : LE BOURG
  async function day3Town() {
    await G.card('Jeudi 20 octobre 1932', null, { eyebrow: 'Jour 3' });
    G.state.flags.papaAway = false;
    await G.narrate(T.d3Intro);
    hud('Jeudi 20 octobre 1932', 'Vendre les racines à M. Thornbury', true);
    const whit = { id: 'whitcomb', char: 'whitcomb', x: 420, o: { dir: 1 }, label: 'L\'homme au chapeau', act: once(T.d3Whitcomb, [['whitcomb', 'Samedi, alors. J\'espère.']]) };
    await walk({
      width: PL.townWidth, floor: 626, start: 180, bounds: [100, 1500],
      amb: ['wind', 'birds'], song: null,
      drawBg: (ctx, cam) => PL.town(ctx, cam),
      things: [
        whit,
        { id: 'thornbury', char: 'thornbury', x: 960, o: { dir: -1, carry: 'pipe' }, label: 'M. Thornbury', act: async (s) => { await G.run(T.d3Thornbury); s.finish(); } },
      ],
    });
    const h = await G.play(G.Scenes.haggle({ roots: G.state.flags.roots || [] }));
    G.addMoney(h.cents, 'les racines');
    G.setFlag('rootMoney', h.cents);
    G.setFlag('soldTo', h.soldTo);
    await G.run(T.d3Sold(h.cents, h.soldTo));
    if (!G.flag('metWhitcomb')) {
      hud('Jeudi 20 octobre 1932', 'Rentrer à la maison', true);
      await walk({
        width: PL.townWidth, floor: 626, start: 900, dir: -1, bounds: [100, 1500],
        amb: ['wind', 'birds'], song: null,
        drawBg: (ctx, cam) => PL.town(ctx, cam),
        things: [
          Object.assign({}, whit, { x: 700, act: async () => G.run(T.d3Whitcomb) }),
          { id: 'home', x: 140, w: 120, h: 220, label: 'Rentrer', act: async (s) => {
            if (!G.flag('metWhitcomb')) { await G.say('whitcomb', 'Jeune homme ! Une minute, s\'il te plaît !'); await G.run(T.d3Whitcomb); }
            s.finish();
          } },
        ],
      });
    }
  }

  // ================================================================== JOUR 3 : LE BEURRE DE POMMES
  async function day3AppleButter() {
    hud('Jeudi 20 octobre 1932', 'Touiller le beurre de pommes chez les Napier', true);
    G.hud.show = false;
    const res = await playWith(G.Scenes.applebutter({
      interlude: async (i) => { const s = T.d3AppleInterlude[i]; if (s) await G.run(s); },
    }), T.d3AppleIntro);
    let jars = (res && res.jars) || 1;
    await G.run(T.d3AppleAfter(jars));
    if (G.flag('extraJar')) jars++;
    G.state.pantry.push({ id: 'applebutter', name: 'Beurre de pommes', halves: jars * 2, tag: 'sucre' });
    G.mood({ all: 0.12 * jars });
    G.setFlag('jars', jars);
  }

  // ================================================================== JOUR 4 : VENDREDI SOIR
  const houseNight = (ctx) => PL.house(ctx, { time: 'night', lamp: G.flag('lamp') });
  async function day4Night() {
    await G.card('Vendredi 21 octobre 1932', null, { eyebrow: 'Jour 4' });
    hud('Vendredi 21 octobre 1932', 'Le loyer est demain', true);
    await stage(houseNight, [...T.d4Count(G.state.money), ...T.d4Choice], {
      x: 640, things: [fam('ida', 600, { dir: 1, arms: [0.4, 1.1] }), fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' })],
      cfg: { amb: ['night', 'fire'], song: null },
    });
    if (G.flag('wentDow')) {
      G.hud.show = false;
      const res = await playWith(G.Scenes.moonshine({ onArrive: async () => G.run(T.d4Arrive) }), T.d4Start);
      const jars = res ? res.jars : 6;
      const pay = Math.max(0, 200 - 25 * (6 - jars));
      G.setFlag('dowMoney', pay);
      G.setFlag('dowJars', jars);
      G.log('wentDow');
      await G.run(T.d4Lige(jars, pay));
      await stage(houseNight, T.d4Back, { x: 600, things: [fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' })], cfg: { amb: ['night', 'fire'] } });
    } else {
      await stage(houseNight, T.d4Stay, { x: 960, cfg: { amb: ['night'] } });
    }
  }

  // ================================================================== JOUR 5 : SAMEDI
  async function day5Saturday() {
    await G.card('Samedi 22 octobre 1932', null, { eyebrow: 'Jour 5' });
    G.state.flags.clayAway = false;
    hud('Samedi 22 octobre 1932', 'Le loyer : huit dollars', true);
    const clayMoney = G.flag('clayDidRun') || G.flag('sidedClay') ? 150 : 0;
    const clayHurt = G.flag('clayDidRun');
    const dowMoney = G.state.flags.dowMoney || 0;
    const henryMoney = G.state.money + dowMoney;
    const family = [
      fam('kenneth', 760, { pose: 'sit', seatH: 30, dir: -1 }), fam('ida', 560, { dir: 1, arms: [0.3, 1.0] }),
      fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' }), fam('clay', 880, { dir: -1 }),
      fam('wes', 820, { dir: -1 }), fam('ruth', 655, { pose: 'sit', seatH: 25 }), fam('pearl', 700, { dir: -1 }),
    ];
    await stage((ctx) => PL.house(ctx, { time: 'day' }), T.d5Pool({ clayMoney, clayHurt, dowMoney, henryMoney, rootCount: (G.state.flags.roots || []).length }), {
      x: 620, things: family, cfg: { amb: ['fire', 'wind'], song: null },
    });
    G.state.money = henryMoney + 60 + 10 + 75 + 25 + clayMoney;
    G.hud.money = true;
    if (clayHurt) G.mood({ clay: -0.2, ida: -0.2 });
    if (clayMoney && !clayHurt) G.mood({ kenneth: -0.3 });
  }

  async function day5Photo() {
    hud('Samedi 22 octobre 1932', 'La photo', true);
    let papaIn = false;
    await stage((ctx) => PL.house(ctx, { time: 'day' }), [...T.d5Photo, ...T.d5PapaChoice], {
      x: 300, things: [fam('kenneth', 150, { dir: 1 }), fam('ida', 230, { dir: -1 }), { id: 'w', char: 'whitcomb', x: 60, o: { dir: 1 } }],
      cfg: { amb: ['wind', 'birds'] },
    });
    papaIn = G.flag('papaPersuaded');
    const members = G.FAMILY.filter((id) => papaIn || id !== 'kenneth');
    await G.play(G.Scenes.photo({ members }));
    G.setFlag('photoTaken');
    G.setFlag('photoCount', members.length);
    await G.run(T.d5WhitcombPays);
    G.addMoney(100, 'M. Whitcomb');
    if (papaIn) G.mood({ ida: 0.5, all: 0.15 }); else G.mood({ ida: -0.2 });

    // M. Farris, à la fin de la journée
    const money = G.state.money;
    await stage((ctx) => PL.house(ctx, { time: 'dusk', lamp: G.flag('lamp') }), T.d5Farris({ paid: money >= 800, money }), {
      x: 300, things: [fam('ida', 230, { dir: -1 }), fam('hattie', 262, { pose: 'sit', seatH: 37, carry: 'pipe' }), { id: 'f', char: 'farris', x: 140, o: { dir: 1 } }],
      cfg: { amb: ['wind', 'fire'], song: null },
    });
    if (money >= 800) { G.setFlag('rentPaid'); G.state.money -= 800; G.mood({ all: 0.25 }); }
    else if (G.flag('rentOnCredit')) { G.state.ardoise += 800 - money; G.state.money = 0; G.mood({ all: -0.1 }); }
    else { G.mood({ all: -0.25 }); }
  }

  // ================================================================== FIN
  async function ending() {
    G.hud.show = false;
    G.audio.song(G.audio.SONGS.valley, { fadeIn: 3 });
    const eight = (G.state.flags.photoCount || 8) === 8;
    await G.narrate(eight ? T.end8 : T.end7, { who: 'old' });
    const f = G.state.flags;
    const hungry = G.FAMILY.filter((id) => G.state.fam[id].hunger >= 2).length;
    const rows = [
      { label: 'Le loyer de samedi', value: f.rentPaid ? 'Payé. Huit dollars, comptés deux fois.' : f.rentOnCredit ? `Le reste est sur l'ardoise : ${U.money(G.state.ardoise)}.` : 'Premier avertissement de la compagnie.', good: !!f.rentPaid },
      { label: 'La table', value: hungry === 0 ? 'Personne n\'a vraiment faim ce soir.' : `${hungry} membre${hungry > 1 ? 's' : ''} de la famille ${hungry > 1 ? 'ont' : 'a'} faim.`, good: hungry === 0 ? true : hungry > 2 ? false : undefined },
      { label: 'Mrs. Napier', value: f.helpedNapier ? 'Tu lui as donné cinq cents. Les Napier n\'oublient pas.' : 'Tu ne l\'as pas aidée au magasin.' },
      { label: 'Otis', value: f.gaveFishOtis || f.otisApple ? 'Tu as partagé avec Otis, malgré le camp d\'en haut.' : 'Tu as gardé ta pêche pour la famille.' },
      { label: 'Granny et le ginseng', value: `${(f.roots || []).length} racine${(f.roots || []).length > 1 ? 's' : ''} vendue${(f.roots || []).length > 1 ? 's' : ''} ${U.money(f.rootMoney || 0)}. ${f.plantedBerries ? 'Les baies sont replantées.' : 'Les baies sont perdues.'}` },
      { label: 'Dow Slone', value: f.wentDow ? `Tu as porté son whisky : ${f.dowJars} bocaux sur 6.${f.liedToPapa ? ' Tu as menti à Papa.' : f.toldPapaTruth ? ' Tu as dit la vérité à Papa.' : ''}` : 'Tu as refusé. Clay y est allé à ta place.' },
      { label: 'Papa et Clay', value: f.sidedClay ? 'Tu as soutenu Clay. Il a travaillé pour la Black Mountain.' : f.sidedPapa ? 'Tu as soutenu Papa contre Clay.' : 'Tu t\'es tu.' },
      { label: 'La photo', value: eight ? 'Huit sur la photo.' : 'Sept sur la photo. Papa est resté derrière la porte.', good: eight },
    ];
    G.clearSave();
    G.state.cp = 99;
    await G.play(G.Scenes.summary({ rows, teaser: T.teaser }));
  }

  // ================================================================== ENCHAÎNEMENT
  G.episode1 = async () => {
    const S = G.state;
    const tick = setInterval(() => { G.state.playSeconds++; }, 1000);
    const V1 = () => veillee(T.v1, T.v1Prompt, T.v1Sleep, ['kenneth', 'ida', 'wes', 'ruth', 'pearl', 'hattie', 'clay'], 'Lundi 17 octobre 1932', 'v1done');
    const V2 = () => veillee(T.v2, T.v2Prompt, T.v2Sleep, ['hattie', 'ida', 'ruth', 'wes', 'pearl'], 'Mardi 18 octobre 1932', 'v2done');
    try {
      if (S.cp < 1) { await prologue(); G.checkpoint(1); }
      if (S.cp < 2) { await day1Morning(); G.checkpoint(2); }
      if (S.cp < 3) { await day1Fishing(); G.checkpoint(3); }
      if (S.cp < 4) await day1Evening();
      else if (S.cp === 4 && !G.flag('v1done')) await V1();
      if (S.cp < 5) { await day2Mountain(); G.checkpoint(5); }
      if (S.cp < 6) await day2Evening();
      else if (S.cp === 6 && !G.flag('v2done')) await V2();
      if (S.cp < 7) { await day3Town(); G.checkpoint(7); }
      if (S.cp < 8) { await day3AppleButter(); G.checkpoint(8); }
      if (S.cp < 9) { await day4Night(); G.checkpoint(9); }
      if (S.cp < 10) { await day5Saturday(); G.checkpoint(10); }
      if (S.cp < 11) { await day5Photo(); G.checkpoint(11); }
      await ending();
    } finally {
      clearInterval(tick);
    }
  };

  // Menu (Échap ou bouton en haut à droite)
  function installMenu() {
    const btn = { x: G.W - 112, y: 14, w: 96, h: 36 };
    let open = false;
    const menu = {
      modal: false,
      update() {
        if (open || !G.inEpisode) return;
        if (G.input.hit('Escape') || G.ui.hit(btn, true)) { G.input.consume(); openMenu(); }
      },
      draw(c) {
        if (!G.inEpisode || open) return;
        G.ui.button(c, btn, 'Menu', { size: 17 });
      },
    };
    G.pushOverlay(menu);
    async function openMenu() {
      open = true;
      const opts = [{ t: 'Reprendre' }, { t: G.audio.muted ? 'Activer le son' : 'Couper le son' }, { t: 'Revenir au dernier point de sauvegarde' }, { t: 'Recommencer l\'épisode depuis le début' }];
      const i = await G.choose(opts, { prompt: 'Pause' });
      open = false;
      if (i === 1) G.audio.toggleMute();
      if (i === 2) { G.save(); location.reload(); }
      if (i === 3) { G.clearSave(); location.reload(); }
    }
  }

  // ================================================================== DÉMARRAGE
  G.main = async () => {
    installMenu();
    for (;;) {
      G.inEpisode = false;
      const save = G.loadSave();
      const t = await G.play(G.Scenes.title({ hasSave: !!save && save.cp > 0 && save.cp < 99 }));
      if (t.action === 'continue' && save) G.state = save;
      else { G.clearSave(); G.newGame(); }
      G.snapColor();
      G.inEpisode = true;
      await G.episode1();
    }
  };

  G.DEV = G.DEV || {};
  // Lance l'épisode à partir d'un chapitre donné : dev.html#ep1-5
  for (let k = 0; k <= 10; k++) {
    G.DEV['ep1-' + k] = async () => {
      G.newGame();
      G.state.cp = k;
      if (k >= 1) { G.state.pantry = [{ id: 'reste', name: 'Le fond du sac de farine', halves: 6, tag: 'grain' }]; for (const id of G.FAMILY) G.state.fam[id].hunger = 1; }
      if (k >= 5) G.state.flags.roots = [{ quality: 0.8 }, { quality: 0.7 }, { quality: 0.6 }];
      if (k >= 7) G.state.money = 350;
      G.inEpisode = true;
      installMenu();
      await G.episode1();
      return { done: true, flags: G.state.flags, money: G.state.money };
    };
  }
})();
