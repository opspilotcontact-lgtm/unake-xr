// Fotos de cada fase en el PC (sin gafas). Uso: node herramientas/pruebas/fotos_fases.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const dir = 'herramientas/pruebas/fotos/';
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.type() + ': ' + m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake, null, { timeout: 30000 });
const espera = ms => pag.waitForTimeout(ms);
const fases = (process.argv[3] || 'puerta,salen,liar,humo').split(',');
for (const f of fases) {
  await pag.evaluate(f => window.__unake.prueba.ir(f), f);
  await espera(f === 'humo' ? 6000 : 2500);
  await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0.3, 0, -0.1));
  await espera(400);
  await pag.screenshot({ path: dir + `fase-${f}.jpg`, quality: 75, type: 'jpeg' });
  if (f === 'humo') {
    for (const [n, yaw, pitch] of [['atras', Math.PI, 0], ['izq', 1.2, 0], ['der', -1.2, 0], ['suelo', 0, -0.9], ['techo', 0, 0.9]]) {
      await pag.evaluate(([y, p]) => window.__unake.prueba.mirar(0, 1.5, 0.3, y, p), [yaw, pitch]);
      await espera(300);
      await pag.screenshot({ path: dir + `fase-humo-${n}.jpg`, quality: 70, type: 'jpeg' });
    }
    await pag.evaluate(() => window.__unake.prueba.mirar(1.2, 1.4, -0.6, 0.6, -0.05));
    await espera(300);
    await pag.screenshot({ path: dir + 'fase-humo-lado.jpg', quality: 70, type: 'jpeg' });
  }
  if (f === 'puerta' || f === 'liar') {
    await pag.evaluate(() => window.__unake.prueba.mirar(1.3, 1.5, -0.5, 0.9, -0.15));
    await espera(300);
    await pag.screenshot({ path: dir + `fase-${f}-lado.jpg`, quality: 70, type: 'jpeg' });
  }
}
const info = await pag.evaluate(() => ({ fase: window.__unake.fase, mundo: window.__unake.mundo, colocon: window.__unake.colocon }));
console.log(JSON.stringify(info));
console.log(errores.length ? errores.join('\n') : 'sin errores');
await nav.close();
