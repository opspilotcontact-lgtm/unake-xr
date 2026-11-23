// Humo con el emulador de Meta (IWER + entorno sintético con paredes): entra en realidad mixta de verdad,
// comprueba que la puerta se pega a una pared detectada y que el bucle de la sesión no da errores.
// Uso: node herramientas/pruebas/emulador_f0.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { const t = m.text(); if ((m.type() === 'error') && !t.includes('404')) errores.push(t); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/?emular&v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake && !document.getElementById('btnAR').disabled, null, { timeout: 40000 });
await pag.waitForTimeout(3000); // que el entorno sintético cargue sus planos
await pag.click('#btnAR');
await pag.waitForFunction(() => window.__unake.fase === 'contrasena' || window.__unake.fase === 'empujar', null, { timeout: 30000 }).catch(() => { });
await pag.waitForTimeout(4000);
const info = await pag.evaluate(() => {
  const J = window.__unake, o = J.obj();
  return {
    fase: J.fase, modo: J.modo, sesion: !!o.xr.sesion, planos: o.xr.planos.length,
    paredes: o.xr.planos.filter(p => p.orientacion === 'vertical').length,
    puerta: o.puerta.grupo.position.toArray().map(v => +v.toFixed(2)),
    cabeza: o.xr.cabeza.toArray().map(v => +v.toFixed(2)),
    manos: Object.values(o.xr.manos).map(m => m.activa),
    tarjetas: o.ui.tarjetas.length,
  };
});
console.log(JSON.stringify(info));
await pag.screenshot({ path: 'herramientas/pruebas/fotos/emulador-f0.jpg', type: 'jpeg', quality: 70 });
console.log(errores.length ? errores.slice(0, 10).join('\n') : 'sin errores');
await nav.close();
