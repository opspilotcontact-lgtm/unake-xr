// Rendimiento por escena (llamadas de dibujo y triángulos de UN ojo; en la Quest, sin multiview, se dibuja dos veces).
// Mide de frente y girando la cabeza (máximo de 6 vistas) en: tu casa (liar), el bar del humo, la máquina encendida,
// cada sala del barrio y cada minijuego nativo en su estado inicial.
// Uso: node herramientas/pruebas/rendimiento.mjs [puerto] [solo=bar,salas,mj,maquina]   (servidor: python servir_lan.py --local <puerto>)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const solo = (process.argv[3] || 'bar,salas,mj,maquina').split(',');
const BASE = `http://127.0.0.1:${puerto}`;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const filas = [], errores = [];
const espera = ms => new Promise(r => setTimeout(r, ms));
async function pagina(ruta) {
  const pag = await nav.newPage({ viewport: { width: 960, height: 540 } });
  pag.on('pageerror', e => errores.push(ruta + ': ' + e.message));
  pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(ruta + ': ' + m.text()); });
  await pag.goto(BASE + ruta);
  return pag;
}
// mide en 6 vistas desde (x, y, z): frente, ±45°, ±90°, detrás; y la de frente un poco hacia abajo
async function medir(pag, nombre, global, { x = 0, y = 1.6, z = 0, yaw0 = 0 } = {}) {
  const r = await pag.evaluate(async ({ global, x, y, z, yaw0 }) => {
    const G = global === 'mj' ? window.__mj : window.__unake;
    const mirar = global === 'mj' ? (...a) => G.mirar(...a) : (...a) => G.prueba.mirar(...a);
    const ren = global === 'mj' ? G.renderer : G.obj().renderer;
    const frame = () => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(() => ok({ c: ren.info.render.calls, t: ren.info.render.triangles }))));
    const vistas = [[0, -0.15], [0.8, -0.1], [-0.8, -0.1], [1.57, -0.1], [-1.57, -0.1], [3.14, -0.1]];
    const out = [];
    for (const [yaw, pitch] of vistas) { mirar(x, y, z, yaw0 + yaw, pitch); out.push(await frame()); }
    return { frente: out[0], max: out.reduce((a, b) => (b.c > a.c ? b : a)), tex: ren.info.memory.textures, geo: ren.info.memory.geometries, prog: ren.info.programs.length };
  }, { global, x, y, z, yaw0 });
  const fila = { escena: nombre, frente: r.frente.c, max: r.max.c, tris: r.max.t, tex: r.tex, geo: r.geo, prog: r.prog };
  filas.push(fila); console.log(JSON.stringify(fila));
}

if (solo.includes('bar') || solo.includes('salas') || solo.includes('maquina')) {
  const pag = await pagina(`/?v=${Date.now()}`);
  await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });
  if (solo.includes('bar')) {
    await pag.evaluate(() => window.__unake.prueba.ir('liar'));
    await espera(2500);
    await medir(pag, 'casa (liar)', 'app');
  }
  await pag.evaluate(() => window.__unake.prueba.ir('humo'));
  await espera(7000);
  if (solo.includes('bar')) await medir(pag, 'bar del humo', 'app');
  if (solo.includes('maquina')) {
    await pag.evaluate(() => { const r = window.__unake.recreativa(); window.__unake.fase = 'fumar'; r.llamar('menu'); });
    await espera(2500);
    await medir(pag, 'máquina (menú)', 'app');
  }
  if (solo.includes('salas')) {
    await pag.evaluate(() => { window.__unake.recreativa().apagar(); window.__unake.fase = 'fumar'; return window.__unake.abrirBarrio(); });
    await espera(2500);
    await medir(pag, 'mapa (maqueta)', 'app');
    for (const id of ['cuarto', 'plaza', 'fuera', 'tienda', 'feria', 'cocina', 'reservado', 'bano', 'techo']) {
      try {
        await pag.evaluate(id => window.__unake.entrarSala(id), id);
        await pag.waitForFunction(id => window.__unake.barrio.salaId === id && !window.__unake.barrio.ocupado, id, { timeout: 20000 });
        await espera(2500);
        await medir(pag, 'sala ' + id, 'app');
        await pag.evaluate(() => window.__unake.salirSala(true));
        await espera(2000);
      } catch (e) { console.log('sala ' + id + ': ' + e.message.split('\n')[0]); }
    }
  }
  await pag.close();
}
if (solo.includes('mj')) {
  for (const id of ['pipas', 'tiropato', 'cuentas', 'casetas', 'furgo', 'control', 'amarillo', 'ensupunto']) {
    const pag = await pagina(`/minijuego.html?m=${id}&v=${Date.now()}`);
    try {
      await pag.waitForFunction(() => window.__mj, null, { timeout: 30000 });
      await pag.evaluate(() => { window.__mj.mirar(0, 1.6, 0, 0, -0.12); window.__mj.arrancarPC(); });
      await espera(9000);
      await medir(pag, 'mj ' + id, 'mj');
    } catch (e) { console.log('mj ' + id + ': ' + e.message.split('\n')[0]); }
    await pag.close();
  }
}
// los nativos DENTRO del juego: en el bar del humo (el bar, la máquina y los colegas se dibujan también)
if (solo.includes('enjuego')) {
  for (const id of ['pipas', 'tiropato', 'cuentas', 'casetas', 'furgo', 'control', 'amarillo']) {
    const pag = await pagina(`/?v=${Date.now()}`);
    try {
      await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });
      await pag.evaluate(() => window.__unake.prueba.ir('humo'));
      await espera(6000);
      await pag.evaluate(id => { window.__unake.fase = 'fumar'; window.__unake.prueba.mirar(0, 1.6, 0, 0, -0.12); return window.__unake.jugarMinijuego(id); }, id);
      await espera(9000);
      await medir(pag, 'bar + ' + id, 'app');
    } catch (e) { console.log('enjuego ' + id + ': ' + e.message.split('\n')[0]); }
    await pag.close();
  }
}
console.log('\n| Escena | Frente | Máx. (6 vistas) | Triángulos | Texturas |\n|---|---|---|---|---|');
for (const f of filas) console.log(`| ${f.escena} | ${f.frente} | ${f.max} | ${f.tris} | ${f.tex} |`);
console.log(errores.length ? errores.slice(0, 10).join('\n') : 'sin errores');
await nav.close();
