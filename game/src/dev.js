'use strict';
// Banc d'essai : dev.html#nom lance G.DEV.nom() seul et affiche le résultat.
(function () {
  const G = window.G;
  G.DEV = G.DEV || {};
  G.loadFonts().then(() => G.start(async () => {
    const name = decodeURIComponent(location.hash.slice(1));
    const fn = G.DEV[name];
    if (!fn) {
      console.log('DEV_LIST', Object.keys(G.DEV).join(','));
      await G.narrate('Scènes disponibles : ' + Object.keys(G.DEV).join(', '));
      return;
    }
    const res = await fn();
    window.__devResult = res === undefined ? null : res;
    console.log('DEV_RESULT', JSON.stringify(window.__devResult));
    await G.narrate('Résultat : ' + JSON.stringify(window.__devResult));
  }));
})();
