// Fotos y medidas de la decoración 3D (deco.html + js/barrio/deco3d.js) en el PC, sin gafas.
// Uso (con el servidor en marcha: python servir_lan.py --local 18777):
//   node herramientas/pruebas/deco.mjs [puerto] [salas separadas por comas] [mundos]
// Saca en herramientas/pruebas/fotos/ deco-<sala>-<mundo>-<frente|izq|der|lado>.jpg (y deco-bar-*.jpg) y escribe
// deco-medidas.json con las llamadas de dibujo de cada sala (sala sola / con decoración) y los avisos.
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18777, soloSalas = '', soloMundos = 'humo,normal'] = process.argv.slice(2);
const dir = 'herramientas/pruebas/fotos/';
mkdirSync(dir, { recursive: true });
const SALAS = ['cuarto', 'plaza', 'fuera', 'tienda', 'feria', 'dentro', 'cocina', 'reservado', 'bano', 'techo', 'bar'];
const salas = soloSalas ? soloSalas.split(',') : SALAS;
const mundos = soloMundos.split(',');

const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errores = [];
try {
  const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
  pag.on('console', m => { if (m.type() === 'error') errores.push('error: ' + m.text()); });
  pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
  pag.on('requestfailed', r => errores.push('requestfailed: ' + r.url()));
  pag.on('response', r => { if (r.status() >= 400) errores.push(r.status() + ': ' + r.url()); });
  await pag.goto(`http://127.0.0.1:${puerto}/deco.html?fotos&sala=${salas[0]}&mundo=${mundos[0]}&v=${Date.now()}`);
  await pag.waitForFunction(() => window.__deco?.listo, null, { timeout: 60000 });
  await pag.evaluate(() => window.__deco.tiempo(3.3)); // tiempo fijo: fotos repetibles
  const medidas = [];
  const vistas = [['frente', 0, 1.6, 0, 0, -0.1], ['izq', 0, 1.6, 0, 0.95, -0.12], ['der', 0, 1.6, 0, -0.95, -0.12], ['lado', 0.45, 1.5, 0.3, 0.15, -0.15]];
  for (const sala of salas) {
    for (const mundo of (sala === 'bar' || sala === 'techo') ? ['humo'] : mundos) {
      const r = await pag.evaluate(([s, m]) => window.__deco.montar(s, m), [sala, mundo]);
      await pag.waitForTimeout(500);
      for (const [nombre, x, y, z, yaw, pitch] of vistas) {
        await pag.evaluate(a => window.__deco.mirar(...a), [x, y, z, yaw, pitch]);
        await pag.waitForTimeout(120);
        await pag.screenshot({ path: `${dir}deco-${sala}-${mundo}-${nombre}.jpg`, type: 'jpeg', quality: 72 });
      }
      await pag.evaluate(() => window.__deco.mirar(0, 1.6, 0, 0, -0.1));
      await pag.waitForTimeout(80);
      const c = await pag.evaluate(() => window.__deco.medir());
      medidas.push(c);
      console.log(`${sala}/${mundo}: sala ${c.llamadasSala} + deco ${c.llamadasDeco} = ${c.llamadasTotal} llamadas, ${c.triangulos} triángulos, ${c.montarMs} ms${c.avisos.length ? '\n   AVISOS: ' + c.avisos.join(' · ') : ''}`);
    }
  }
  writeFileSync(dir + 'deco-medidas.json', JSON.stringify(medidas, null, 1));
} finally {
  await nav.close();
}
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'Sin errores de consola.');
