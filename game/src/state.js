'use strict';
// État de la partie : famille, argent, nourriture, choix. Sauvegarde locale.
(function () {
  const G = window.G;

  // Fiche des huit membres. h = taille de la silhouette en pixels.
  G.FAMILY = ['kenneth', 'ida', 'hattie', 'clay', 'wes', 'henry', 'ruth', 'pearl'];
  G.NEED = { kenneth: 2, ida: 2, hattie: 2, clay: 2, wes: 2, henry: 2, ruth: 2, pearl: 1 }; // en demi-bols

  const MORALE = ['Brisé', 'Abattu', 'Triste', 'Serein', 'Content'];
  const HUNGER = ['Rassasié', 'Faim', 'Affamé', 'Épuisé', 'Mourant'];
  G.moraleLabel = (m) => MORALE[Math.max(0, Math.min(4, Math.round(m)))];
  G.hungerLabel = (h) => HUNGER[Math.max(0, Math.min(4, Math.round(h)))];

  function fresh() {
    const fam = {};
    for (const id of G.FAMILY) fam[id] = { hunger: 1, morale: 2.6 };
    fam.kenneth.morale = 2.2;
    fam.clay.morale = 2.2;
    fam.pearl.morale = 3;
    return {
      ep: 1,
      cp: 0,               // dernier point de sauvegarde atteint
      money: 0,            // cagnotte du loyer, en cents
      rent: 800,           // loyer dû samedi
      ardoise: 1740,       // dette au magasin de la compagnie
      creditLimit: 2500,
      pantry: [],          // [{ id, name, halves, tag }] : demi-bols de nourriture
      fam,
      flags: {},
      log: [],             // faits marquants pour le résumé de fin d'épisode
      startedAt: Date.now(),
      playSeconds: 0,
    };
  }

  G.state = fresh();
  G.newGame = () => { G.state = fresh(); G.snapColor && G.snapColor(); };

  // Espoir : moyenne du moral de la famille, ramenée entre 0 et 1.
  G.espoir = () => {
    const s = G.state;
    let sum = 0;
    for (const id of G.FAMILY) sum += s.fam[id].morale;
    return Math.max(0, Math.min(1, sum / G.FAMILY.length / 4));
  };

  G.flag = (k) => !!G.state.flags[k];
  G.setFlag = (k, v = true) => { G.state.flags[k] = v; };

  // Change le moral d'un ou plusieurs membres : G.mood({ ida: +0.5, all: -0.2 }).
  G.mood = (changes) => {
    for (const [k, v] of Object.entries(changes)) {
      const ids = k === 'all' ? G.FAMILY : [k];
      for (const id of ids) {
        const m = G.state.fam[id];
        if (m) m.morale = Math.max(0, Math.min(4, m.morale + v));
      }
    }
  };

  G.addMoney = (c, why) => {
    G.state.money += c;
    if (why) G.ui && G.ui.toast(`${c >= 0 ? '+' : ''}${G.U.money(c)} · ${why}`);
  };

  // Garde-manger
  G.addFood = (id, name, halves, tag) => {
    G.state.pantry.push({ id, name, halves, tag });
    G.ui && G.ui.toast(`+ ${name}`);
  };
  G.pantryHalves = () => G.state.pantry.reduce((a, f) => a + f.halves, 0);
  G.pantryTags = () => new Set(G.state.pantry.filter((f) => f.halves > 0).map((f) => f.tag));
  // Prend n demi-bols, en vidant d'abord les aliments périssables (poisson).
  G.takeFood = (n) => {
    const order = ['poisson', 'verdure', 'haricots', 'gras', 'grain', 'lait', 'sucre'];
    const items = [...G.state.pantry].sort((a, b) => order.indexOf(a.tag) - order.indexOf(b.tag));
    const used = new Set();
    let left = n;
    for (const it of items) {
      if (left <= 0) break;
      const k = Math.min(it.halves, left);
      it.halves -= k;
      left -= k;
      if (k > 0) used.add(it.tag);
    }
    G.state.pantry = G.state.pantry.filter((f) => f.halves > 0);
    return { taken: n - left, tags: used };
  };

  G.log = (text) => G.state.log.push(text);

  // ------------------------------------------------------------------ sauvegarde
  const KEY = 'tqel-episode1-v1';
  G.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(G.state)); } catch (_) { /* stockage indisponible */ }
  };
  G.loadSave = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.ep === 1 ? s : null;
    } catch (_) { return null; }
  };
  G.clearSave = () => { try { localStorage.removeItem(KEY); } catch (_) { /* rien */ } };
  G.checkpoint = (n) => {
    if (G.state.cp < n) G.state.cp = n;
    G.save();
  };
})();
