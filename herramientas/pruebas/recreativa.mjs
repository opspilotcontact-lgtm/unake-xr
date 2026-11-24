// La recreativa dentro del juego: en el humo, jugar Pipas y Cuentas del 2D por el puente con teclas sintéticas
// (las mismas que mandaría el mando) y cobrar el resultado. Uso: node herramientas/pruebas/recreativa.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
await pag.goto(`http://127.0.0.1:${process.argv[2] || 18765}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.05));
await pag.evaluate(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await pag.screenshot({ path: 'herramientas/pruebas/fotos/rec-bar.jpg', type: 'jpeg', quality: 70 });
await pag.evaluate(() => { window.__unake.fase = 'fumar'; window.__unake.jugarRecreativa('Cuentas'); });
await pag.waitForFunction(() => window.__unake.recreativa().jugando, null, { timeout: 30000 });
await pag.waitForTimeout(2500);
await pag.screenshot({ path: 'herramientas/pruebas/fotos/rec-jugando.jpg', type: 'jpeg', quality: 70 });
// jugar a lo bruto: flechas al azar hasta que acabe (Cuentas: ← ↓ →)
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const sigue = await pag.evaluate(() => !!window.__unake.recreativa().jugando);
  if (!sigue) break;
  await pag.evaluate(() => { const p = window.__unake.recreativa().p, k = ['ArrowLeft', 'ArrowDown', 'ArrowRight'][Math.floor(Math.random() * 3)]; p.tecla(k, true); setTimeout(() => p.tecla(k, false), 60); });
  await pag.waitForTimeout(180);
}
await pag.waitForTimeout(800);
console.log(JSON.stringify(await pag.evaluate(() => ({ fase: window.__unake.fase, res: window.__unake.resultados, calls: window.__unake.obj().renderer.info.render.calls }))));
await pag.screenshot({ path: 'herramientas/pruebas/fotos/rec-fin.jpg', type: 'jpeg', quality: 70 });
console.log(errores.length ? errores.slice(0, 6).join('\n') : 'sin errores');
await nav.close();
