// Lanza un minijuego nativo desde el juego (en el humo) y mira que monta, se ve y se cierra sin errores.
// Uso: node herramientas/pruebas/menu_minijuego.mjs [id]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const id = process.argv[2] || 'pipas';
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
await pag.goto(`http://127.0.0.1:18765/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.15));
await pag.evaluate(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await pag.evaluate(() => { window.__unake.fase = 'fumar'; });
await pag.evaluate(() => window.__unake.abrirMenu());
await pag.waitForTimeout(800);
console.log('tarjetas:', await pag.evaluate(() => window.__unake.obj().ui.tarjetas.map(t => t.userData.texto).join(' | ')));
await pag.screenshot({ path: 'herramientas/pruebas/fotos/menu.jpg', type: 'jpeg', quality: 70 });
await pag.evaluate(() => window.__unake.obj().ui.quitarTarjetas());
await pag.evaluate(id => { window.__unake.menu = false; return window.__unake.jugarMinijuego(id); }, id);
await pag.waitForTimeout(3000);
await pag.screenshot({ path: `herramientas/pruebas/fotos/menu-${id}.jpg`, type: 'jpeg', quality: 70 });
console.log(JSON.stringify(await pag.evaluate(() => ({ fase: window.__unake.fase, mj: window.__unake.minijuego?.id, calls: window.__unake.obj().renderer.info.render.calls }))));
console.log(errores.length ? errores.slice(0, 6).join('\n') : 'sin errores');
await nav.close();
