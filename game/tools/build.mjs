// Génère les pages du jeu à partir de src/files.txt :
//   index.html               version de développement (scripts séparés)
//   dev.html                 banc d'essai : lance une scène seule (dev.html#fishing)
//   dist/tant-quon-est-la.html   un seul fichier, à ouvrir directement dans un navigateur
//   dist/artifact.html       même contenu, sans squelette <html> (publication en page jouable)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = readFileSync(join(root, 'src/files.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);

const head = `<title>Tant qu'on est là</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap">
<style>
  /* Écran unique, sombre : le jeu se dessine dans deux canvas superposés. */
  :root { --bg: #0d0b0a; --fg: #e8dfcc; --muted: #9b917f; color-scheme: dark; }
  html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); overflow: hidden; }
  body { font-family: 'EB Garamond', Georgia, serif; }
  canvas { position: absolute; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
  #rotate { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); padding: 10px 14px;
    background: rgba(31, 26, 23, 0.92); color: var(--fg); font-style: italic; font-size: 17px; text-align: center; border-radius: 8px; pointer-events: none; display: none; }
  @media (orientation: portrait) and (max-width: 760px) { #rotate { display: block; } }
</style>`;

const body = `<canvas id="scene" aria-label="Tant qu'on est là, épisode 1"></canvas>
<canvas id="ui"></canvas>
<p id="rotate">Tourne ton téléphone à l'horizontale pour jouer en grand.</p>`;

const doc = (inner) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
</head>
<body>
${inner}
</body>
</html>
`;

const tags = (list) => list.map((f) => `<script src="${f}"></script>`).join('\n');
writeFileSync(join(root, 'index.html'), doc(`${body}\n${tags([...files, 'src/main.js'])}`));
writeFileSync(join(root, 'dev.html'), doc(`${body}\n${tags([...files, 'src/dev.js'])}`));
writeFileSync(join(root, 'autotest.html'), doc(`${body}\n${tags([...files, 'src/autotest.js'])}`));

const js = [...files, 'src/main.js'].map((f) => `// ---- ${f}\n${readFileSync(join(root, f), 'utf8')}`).join('\n');
const inline = `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/tant-quon-est-la.html'), doc(`${body}\n${inline}`));
writeFileSync(join(root, 'dist/artifact.html'), `${head}\n${body}\n${inline}\n`);
console.log(`ok : ${files.length + 1} scripts, ${(js.length / 1024).toFixed(0)} Ko de JS`);
