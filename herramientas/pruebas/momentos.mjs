// Fotos de cada momento de colocón y de las cosas con física, en el humo (PC). Uso: node herramientas/pruebas/momentos.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:18765/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, 0));
await pag.evaluate(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
// lanzar un objeto contra Lasslow (física + reacción)
await pag.evaluate(() => {
  const J = window.__unake, o = J.obj(), T = J.THREE;
  const c = o.fisica.cuerpos.find(c => c.radio < 0.05);
  c.obj.position.set(0, 1.3, -0.3); const d = o.lasslow.grupo.position.clone().add(new T.Vector3(0, 0.4, 0)).sub(c.obj.position);
  o.fisica.lanzar(c, d.normalize().multiplyScalar(4.5).add(new T.Vector3(0, 0.6, 0)));
});
await pag.waitForTimeout(700);
await pag.screenshot({ path: 'herramientas/pruebas/fotos/mom-golpe.jpg', type: 'jpeg', quality: 70 });
for (const tipo of ['neon', 'monchis', 'figura', 'miradas', 'estrellas', 'respira']) {
  await pag.evaluate(t => { const v = window.__unake.obj().viaje; v.cortar(); v.lanzar(t); }, tipo);
  await pag.waitForTimeout(tipo === 'monchis' ? 6000 : tipo === 'miradas' ? 5200 : 4500);
  await pag.screenshot({ path: `herramientas/pruebas/fotos/mom-${tipo}.jpg`, type: 'jpeg', quality: 70 });
}
console.log(JSON.stringify(await pag.evaluate(() => ({ cuerpos: window.__unake.obj().fisica.cuerpos.length, calls: window.__unake.obj().renderer.info.render.calls }))));
console.log(errores.length ? errores.slice(0, 8).join('\n') : 'sin errores');
await nav.close();
