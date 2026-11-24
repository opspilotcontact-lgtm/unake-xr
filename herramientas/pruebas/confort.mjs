// Confort con el emulador de Meta (IWER): entra en RM, se «sienta» (ojos a 1,10 m), pasa al humo y comprueba que
// el mundo sube a la altura de pie; recentrar; giro suave con el stick derecho; las tarjetas de ajustes; y que no
// hay errores. Uso: node herramientas/pruebas/confort.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { const t = m.text(); if (m.type() === 'error' && !t.includes('404')) errores.push(t); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.addInitScript(() => { try { localStorage.removeItem('unake-xr-ajustes'); } catch { } });
await pag.goto(`http://127.0.0.1:${puerto}/?emular&v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake && !document.getElementById('btnAR').disabled, null, { timeout: 40000 });
await pag.waitForTimeout(3000);
await pag.click('#btnAR');
await pag.waitForFunction(() => window.__unake.obj().xr.sesion, null, { timeout: 30000 });
await pag.waitForTimeout(1500);
const estado = () => pag.evaluate(() => {
  const xr = window.__unake.obj().xr;
  return { mundo: window.__unake.mundo, cabeza: +xr.cabeza.y.toFixed(2), real: +xr.alturaReal.toFixed(2), elevacion: +xr.elevacion.toFixed(2), sentado: xr.sentado, giro: +(xr.movimiento.giro || 0).toFixed(2) };
});
const informe = {};
// sentarse: ojos a 1,10 m
const altura = y => pag.evaluate(y => window.__xrEmulado.remote.dispatch('animate_to', { device: 'headset', position: { x: 0, y, z: 0 }, duration: 0.3 }), y);
await altura(1.1);
await pag.waitForTimeout(800);
informe.sentadoDia = await estado();
// al humo
await pag.evaluate(() => { const J = window.__unake; J.fase = 'fumar'; J.colocon = 45; });
await pag.waitForFunction(() => window.__unake.mundo === 'humo' && !window.__unake.transicion, null, { timeout: 20000 });
await pag.waitForTimeout(1500);
informe.sentadoHumo = await estado();
await pag.screenshot({ path: 'herramientas/pruebas/fotos/confort-sentado-humo.jpg', type: 'jpeg', quality: 70 });
// giro suave con el stick derecho
await pag.evaluate(() => window.__unake.obj().xr.ajustar({ giro: 'suave' }));
const q0 = await pag.evaluate(() => window.__unake.obj().xr.adelante.toArray());
await pag.evaluate(() => window.__xrEmulado.controllers.right.updateAxes('thumbstick', 0.9, 0));
await pag.waitForTimeout(700);
informe.giroSuave = await estado();
await pag.evaluate(() => window.__xrEmulado.controllers.right.updateAxes('thumbstick', 0, 0));
const q1 = await pag.evaluate(() => window.__unake.obj().xr.adelante.toArray());
informe.girado = +Math.acos(Math.max(-1, Math.min(1, q0[0] * q1[0] + q0[2] * q1[2]))).toFixed(2);
// de pie otra vez y recentrar: la elevación se recalcula
await altura(1.62);
await pag.waitForTimeout(500);
await pag.evaluate(() => window.__unake.obj().xr.recentrar());
await pag.waitForTimeout(500);
informe.dePieRecentrado = await estado();
// menú de ajustes
await pag.evaluate(() => { const o = window.__unake.obj(); o.ui.menuAjustes(o.xr, {}); });
await pag.waitForTimeout(600);
informe.ajustes = await pag.evaluate(() => window.__unake.obj().ui.tarjetas.map(t => t.userData.texto));
await pag.screenshot({ path: 'herramientas/pruebas/fotos/confort-ajustes.jpg', type: 'jpeg', quality: 70 });
await pag.evaluate(() => window.__unake.obj().ui.quitarTarjetas());
await pag.evaluate(() => window.__unake.obj().xr.ajustar({ giro: 'saltos' }));
console.log(JSON.stringify(informe, null, 1));
const bien = informe.sentadoHumo.elevacion > 0.3 && Math.abs(informe.sentadoHumo.cabeza - 1.55) < 0.06 && informe.girado > 0.3
  && informe.dePieRecentrado.elevacion === 0 && informe.ajustes.length === 5;
console.log(bien ? 'BIEN' : 'MAL');
console.log(errores.length ? errores.slice(0, 10).join('\n') : 'sin errores');
await nav.close();
