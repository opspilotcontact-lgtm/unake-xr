// El barrio dentro del juego: desde el humo, abrir la maqueta, entrar en dos salas, volver y regresar a Unaké.
// Uso: node herramientas/pruebas/barrio_juego.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
await pag.goto(`http://127.0.0.1:18765/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.3));
await pag.evaluate(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await pag.evaluate(() => { window.__unake.fase = 'fumar'; return window.__unake.abrirBarrio(); });
await pag.waitForTimeout(2500);
await pag.screenshot({ path: 'herramientas/pruebas/fotos/bj-maqueta.jpg', type: 'jpeg', quality: 70 });
for (const id of ['tienda', 'plaza']) {
  await pag.evaluate(id => window.__unake.entrarSala(id), id);
  await pag.waitForFunction(id => window.__unake.barrio.salaId === id && !window.__unake.barrio.ocupado, id, { timeout: 20000 });
  await pag.waitForTimeout(2500);
  await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, 0));
  await pag.screenshot({ path: `herramientas/pruebas/fotos/bj-${id}.jpg`, type: 'jpeg', quality: 70 });
  await pag.evaluate(() => window.__unake.salirSala(true));
  await pag.waitForTimeout(2500);
}
await pag.evaluate(() => window.__unake.entrarSala('cuarto'));
await pag.waitForTimeout(4000);
await pag.evaluate(() => window.__unake.salirSala(false));
await pag.waitForTimeout(3000);
await pag.screenshot({ path: 'herramientas/pruebas/fotos/bj-vuelta.jpg', type: 'jpeg', quality: 70 });
console.log(JSON.stringify(await pag.evaluate(() => ({ fase: window.__unake.fase, mundo: window.__unake.mundo, mj: window.__unake.minijuego, unake: window.__unake.obj().unake.grupo.visible, cache: window.__unake.barrio.cache.size }))));
console.log(errores.length ? errores.slice(0, 6).join('\n') : 'sin errores');
await nav.close();
