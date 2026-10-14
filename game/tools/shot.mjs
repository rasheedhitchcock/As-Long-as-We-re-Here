// Pilote le jeu dans Chromium pour les tests.
// node tools/shot.mjs <page relative à game/, ex. "dev.html#fishing"> '<étapes JSON>'
// Étapes : {"wait":ms} {"click":[x,y]} {"down":[x,y]} {"move":[x,y]} {"up":1}
//          {"key":"Space"} {"hold":["ArrowRight",ms]} {"shot":"/chemin.png"} {"eval":"js"}
//          {"until":"expression js", "timeout":ms}
// La fenêtre fait 1280×720 : les coordonnées logiques du jeu = pixels.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [page = 'dev.html', stepsJson = '[]'] = process.argv.slice(2);
const steps = JSON.parse(stepsJson);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('console', (m) => { const t = m.text(); if (m.type() === 'error') errors.push(t); console.log(`[${m.type()}] ${t}`); });
p.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', e.message); });
const [file, hash] = page.split('#');
await p.goto('file://' + join(root, file) + (hash ? '#' + hash : ''));
await p.waitForTimeout(600);
for (const s of steps) {
  if (s.wait) await p.waitForTimeout(s.wait);
  if (s.click) { await p.mouse.click(s.click[0], s.click[1]); await p.waitForTimeout(60); }
  if (s.down) { await p.mouse.move(s.down[0], s.down[1]); await p.mouse.down(); }
  if (s.move) await p.mouse.move(s.move[0], s.move[1], { steps: 5 });
  if (s.up) await p.mouse.up();
  if (s.key) { await p.keyboard.press(s.key); await p.waitForTimeout(60); }
  if (s.hold) { await p.keyboard.down(s.hold[0]); await p.waitForTimeout(s.hold[1]); await p.keyboard.up(s.hold[0]); }
  if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('[eval]', JSON.stringify(r)); }
  if (s.until) { await p.waitForFunction(s.until, null, { timeout: s.timeout || 15000 }).catch(() => console.log('[until] délai dépassé :', s.until)); }
  if (s.shot) { await p.screenshot({ path: s.shot }); console.log('[shot]', s.shot); }
}
const fatal = await p.evaluate(() => window.G && window.G.fatal);
if (fatal) errors.push(fatal);
console.log(errors.length ? `ERREURS (${errors.length})` : 'AUCUNE ERREUR');
await browser.close();
