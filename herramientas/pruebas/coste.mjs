// Coste de render por fase (draw calls, triángulos, texturas) en el PC. Uso: node herramientas/pruebas/coste.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
await pag.goto(`http://127.0.0.1:18765/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });
for (const f of ['liar', 'humo']) {
  await pag.evaluate(f => window.__unake.prueba.ir(f), f);
  await pag.waitForTimeout(f === 'humo' ? 7000 : 2500);
  await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, 0));
  await pag.waitForTimeout(500);
  const r = await pag.evaluate(() => new Promise(ok => requestAnimationFrame(() => { const i = window.__unake.obj().renderer.info; ok({ draws: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries, prog: i.programs.length }); })));
  console.log(f, JSON.stringify(r));
}
await nav.close();
