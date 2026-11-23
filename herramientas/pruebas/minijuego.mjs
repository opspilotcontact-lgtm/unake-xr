// Lanzador de bots de minijuegos nativos: carga minijuego.html?m=<nombre> en el PC, ejecuta
// herramientas/pruebas/bots/<nombre>.js con manos simuladas y saca fotos.
// Uso: node herramientas/pruebas/minijuego.mjs <nombre> [puerto] [segundos]
//
// El archivo del bot es el CUERPO de una función generadora que recibe { M, T, der, izq, poner, mover, quieto,
// hasta, log, foto } y hace yield* con los ayudantes (ver bots/ejemplo.js). M = window.__mj (fisica, xr, …).
import { createRequire } from 'module';
import { readFileSync, mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [nombre, puerto = 18765, segs = 120] = process.argv.slice(2);
const cuerpo = readFileSync(`herramientas/pruebas/bots/${nombre}.js`, 'utf8');
mkdirSync('herramientas/pruebas/fotos', { recursive: true });
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404')) errores.push(t);
  if (t.startsWith('[bot]')) console.log(t);
});
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/minijuego.html?m=${nombre}&v=${Date.now()}`);
await pag.waitForFunction(() => window.__mj, null, { timeout: 30000 });
await pag.evaluate(cuerpo => {
  const M = window.__mj, T = M.THREE;
  let dt = 0.016, manos;
  const log = m => console.log('[bot] ' + M.t.toFixed(1) + 's ' + m);
  const der = () => manos.derecha, izq = () => manos.izquierda;
  function poner(m, pos, pinza, agarre) {
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
    if (m._p) m.vel.copy(pos).sub(m._p).divideScalar(Math.max(dt, 0.001)); else m.vel.set(0, 0, 0);
    m._p = pos.clone(); m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
    if (pinza !== undefined) m.pinza = pinza;
    if (agarre !== undefined) m.agarre = agarre;
  }
  function* quieto(m, seg, pinza, agarre) { let t = 0; while (t < seg) { t += dt; poner(m, m.pos.clone(), pinza, agarre); yield; } }
  function* mover(m, destino, seg, pinza, agarre) {
    const desde = m.pos.clone(); let t = 0;
    while (t < seg) { t += dt; const k = Math.min(1, t / seg); poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, k), pinza, agarre); yield; }
  }
  function* hasta(cond, max = 30) { let t = 0; while (!cond()) { t += dt; if (t > max) throw new Error('timeout: ' + cond.toString()); yield; } }
  const foto = n => { M.fotoPedida = n; };
  const gen = new Function('ayuda', `return (function* () { const { M, T, der, izq, poner, mover, quieto, hasta, log, foto } = ayuda; ${cuerpo}\n })();`)({ M, T, der, izq, poner, mover, quieto, hasta, log, foto });
  M.bot = (d, m) => { dt = d; manos = m; const r = gen.next(); if (r.done) { M.bot = null; M.botFin = true; } };
  M.arrancarPC();
}, cuerpo);
const t0 = Date.now(), hechas = new Set();
while (Date.now() - t0 < segs * 1000) {
  const e = await pag.evaluate(() => ({ fin: window.__mj.botFin, foto: window.__mj.fotoPedida, bot: !!window.__mj.bot }));
  if (e.foto && !hechas.has(e.foto)) { hechas.add(e.foto); await pag.screenshot({ path: `herramientas/pruebas/fotos/mj-${nombre}-${e.foto}.jpg`, type: 'jpeg', quality: 72 }); }
  if (e.fin || !e.bot) break;
  await pag.waitForTimeout(200);
}
const r = await pag.evaluate(() => ({ fin: !!window.__mj.botFin, resultados: window.__mj.resultados }));
console.log(JSON.stringify(r));
console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
await nav.close();
