# Moteur du jeu : guide du développeur

Jeu web sans dépendance : JavaScript classique (pas de modules), deux canvas superposés, résolution logique **1280 × 720**. Tous les scripts s'attachent à l'objet global `window.G`. L'ordre de chargement est fixé par `src/files.txt`.

## Construire et tester

```bash
node game/tools/build.mjs                     # régénère index.html, dev.html et dist/
node game/tools/shot.mjs 'dev.html#fishing' '[{"wait":800},{"shot":"/tmp/x.png"}]'
```

`dev.html#nom` lance `G.DEV.nom()` seul (par exemple `dev.html#fishing`, ou `dev.html#ep1-5` pour démarrer l'épisode au 5e point de sauvegarde). `autotest.html#seed=3&pick=random` joue l'épisode entier tout seul (mini-jeux simulés) et journalise chaque réplique : à lancer après toute modification du déroulé ou des textes. `shot.mjs` pilote Chromium (fenêtre 1280 × 720, donc coordonnées du jeu = pixels) et affiche les erreurs de la console. Étapes possibles : `wait`, `click`, `down`, `move`, `up`, `key`, `hold`, `eval`, `until`, `shot`.

Lancer les commandes avec des chemins absolus, sans `cd`.

## Écrire une scène

```js
'use strict';
(function () {
  const G = window.G, U = G.U, I = G.input, ui = G.ui, P = G.PAL;
  G.Scenes.exemple = (opts = {}) => G.makeScene({
    enter() { G.audio.amb(['creek']); },     // appelé quand la scène s'affiche
    update(dt) {                             // dt en secondes (≤ 0,05)
      if (!G.blocked && I.confirm()) this.finish({ ok: true });
    },
    draw(ctx) { /* décor + personnages, puis : */ G.art.finish(ctx); },
    drawUI(uctx) { ui.hint(uctx, 'Clique ou appuie sur Espace'); },
    exit() {},
  });
  G.DEV = G.DEV || {};
  G.DEV.exemple = () => G.play(G.Scenes.exemple({}));
})();
```

- `G.play(scene)` fait un fondu, affiche la scène et renvoie une **promesse** résolue par `this.finish(résultat)`.
- `draw(ctx)` dessine sur le canvas de **scène**, auquel s'applique le filtre de couleur de l'Espoir (saturation, sépia). `drawUI(uctx)` dessine sur le canvas d'**interface**, non filtré : consignes, jauges, boutons.
- Pendant un dialogue ou un fondu, `G.blocked` vaut vrai et les appuis sont absorbés : la scène doit continuer d'animer mais **mettre sa mécanique en pause** (minuteries comprises). Quand une scène attend une promesse (crochet de dialogue), elle doit aussi se mettre en pause.
- `this.t` : temps écoulé dans la scène.

## Entrées (`G.input`, alias `I`)

| | |
|---|---|
| `I.x`, `I.y` | position du pointeur (coordonnées logiques) |
| `I.down` | pointeur enfoncé (souris ou doigt) |
| `I.pressed` / `I.released` | appui / relâchement pendant cette image |
| `I.key('Space')` | touche maintenue (codes `KeyboardEvent.code`) |
| `I.hit('Space')` | touche enfoncée pendant cette image |
| `I.confirm()` | clic, Espace, Entrée ou E pendant cette image |
| `I.mouse` | faux après un toucher (pas de survol) |
| `I.consume()` | absorbe les appuis de l'image |

**Règle d'accessibilité :** chaque mécanique doit se jouer **à la souris, au doigt et au clavier**. Action principale = clic/toucher ou Espace ; action continue = maintenir le pointeur ou Espace. Rien ne dépend du survol ni du clic droit.

## Utilitaires (`G.U`)

`clamp`, `lerp`, `inv`, `smooth`, `easeOut`, `easeIn`, `easeInOut`, `rand(a,b)`, `randi(a,b)`, `pick(arr)`, `dist`, `inRect(p, r)`, `rng(seed)` (aléatoire déterministe pour les décors), `money(cents)` → « 40 ¢ » ou « 1,25 $ ».

`G.wait(s)` : promesse en temps de jeu. `G.after(s, fn)`.

## Dessin (`G.art`)

- `G.art.char(ctx, id, x, foot, o)` dessine un personnage (silhouette) dont les pieds sont en `(x, foot)`. Identifiants dans `G.CHARS` : `henry`, `kenneth` (Papa), `ida` (M'man), `hattie` (Granny), `clay`, `wes`, `ruth`, `pearl`, `otis`, `pruitt`, `dow`, `nora` (Mrs. Napier), `abner`, `napierKid`, `napierGirl`, `super`, `whitcomb` (photographe), `thornbury`, `farris`, `revenuer`, `worker1-3`.
  - Options `o` : `dir` (1 droite, -1 gauche), `pose` (`stand`, `walk`, `sit`, `crouch`, `kneel`), `phase` (0 à 1, cycle de marche), `seatH` (hauteur du siège pour `sit`), `arms` ([angle bras arrière, angle bras avant] en radians depuis la verticale, positif = vers l'avant), `carry` (`pails`, `crate`, `sack`, `fiddle`, `pipe`, `book`, `rod`, `lantern`, `stick`, `basket`), `rim` (contour doré : le joueur), `tilt`, `lean`, `alpha`, `color`, `thin`, `h`.
  - Renvoie `{ head, hand, top }` en coordonnées écran.
- Décors : `sky(ctx, w, h, [[0,c],[1,c]])`, `ridge(ctx, pts, color, bottom)`, `makeRidge(seed, w, yBase, amp, step)`, `ridgeY(pts, x)`, `dots(ctx, seed, n, xa, xb, yFn, colors, rmin, rmax)` (feuillage en touches), `tree(ctx, x, ground, h, trunk, leaves, seed)`, `campHouse(ctx, x, ground, o)`, `boards(ctx, x, y, w, h)`, `glow(ctx, x, y, r, color, alpha)`.
- Cache : `G.art.cached(clé, w, h, (cx, w, h) => {...})` dessine une fois un décor statique ; `G.art.blit(ctx, o, x, y)`.
- `G.art.texture(ctx, w, h, force)` : grain de papier. `G.art.finish(ctx)` : grain animé + vignettage, à appeler **en fin de `draw`**.
- Palette `G.PAL` : `ink`, `paper`, `sil`, `rust`, `ochre`, `gold`, `tobacco`, `octSky`, `coal`, `slate`, `frost`, `snow`, `ember`, `moss`, `sprout`, `wood`, `woodDark`, `beam`, `tin`, `lamp`, `water`, `rim`, `autumn` (tableau).

Direction artistique : silhouettes sombres sur décors peints en aplats, automne appalachien (rouilles, ocres, ors), grain de papier. Pas de contour noir épais, pas de dégradés criards, pas d'émoji.

## Interface (`G.ui`)

`text(ctx, str, x, y, { size, color, align, base, italic, bold, kind: 'serif'|'hand', maxW, lineH })`, `caps(...)` (petites capitales espacées), `button(ctx, r, label, o)` (dessin) + `hit(r)` (clic), `hint(ctx, texte)` (consigne en haut), `tag(ctx, texte, x, y)` (étiquette), `bar(ctx, x, y, w, h, v)`, `notebook(ctx, x, y, w, lignes)`, `toast(texte)` (notification).

Polices : `G.FONT.serif` (EB Garamond) et `G.FONT.hand` (Caveat, écriture manuscrite).

## Dialogues

- `await G.say('otis', 'Texte')` : une réplique (boîte en bas de l'écran).
- `await G.narrate('Texte' | [paragraphes])` : narration plein écran.
- `await G.card('Titre', 'sous-titre')` : carton.
- `const i = await G.choose([{ t: 'Option' }, ...], { timer: 8, prompt: '...' })` : choix (minuté si `timer`).
- `await G.run(script)` : script complet (voir l'en-tête de `dialog.js`).
- Identifiants des personnes qui parlent : `G.WHO` (`nar` = narration dans la boîte).

Ton : français oral et rural, phrases courtes, pas de patois inventé, pas d'orthographe phonétique. On tutoie le joueur dans les consignes.

## État (`G.state`)

`money` (cagnotte du loyer, en cents), `ardoise`, `pantry` (nourriture), `fam[id].hunger` / `.morale` (0 à 4), `flags`. `G.mood({ ida: +0.5 })`, `G.setFlag('x')`, `G.flag('x')`, `G.addMoney(c, 'raison')`, `G.addFood(id, nom, demiBols, tag)`, `G.espoir()` (0 à 1).

## Son (`G.audio`)

- `G.audio.amb(['wind', 'creek', 'fire', 'birds', 'night', 'mill', 'room'])` : fond sonore.
- `G.audio.sfx(nom, délai, volume)` : `click`, `coin`, `clink`, `splash`, `plop`, `bite`, `tick`, `dig`, `crunch`, `burn`, `thud`, `step`, `knock`, `bell`, `page`, `shutter`, `cough`, `bark`, `fail`, `good`, `perfect`, `pour`, `whoosh`, `creak`, `train`.
- `const h = G.audio.song(def)` : musique. `h.timeOf(temps)`, `h.beatNow()`, `h.stop()`. `G.audio.reel(bpm)` fabrique le reel du beurre de pommes. `G.audio.ctx` : contexte Web Audio (peut être `null` avant le premier clic).
