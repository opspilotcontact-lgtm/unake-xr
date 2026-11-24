// Las puertas entre salas y «sigue el humo»: desde Unaké (humo) con la guía hacia la plaza, cruzar a la puerta de
// Unaké, a la plaza (la guía se apaga), volver andando hasta una puerta y regresar al bar.
// Uso: node herramientas/pruebas/portales.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [], fallos = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos.push(t); };
const ev = (f, a) => pag.evaluate(f, a);
const foto = n => pag.screenshot({ path: `herramientas/pruebas/fotos/portal-${n}.jpg`, type: 'jpeg', quality: 70 });
const esperaSala = id => pag.waitForFunction(id => window.__unake.barrio.salaId === id && !window.__unake.barrio.ocupado, id, { timeout: 20000 });

await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.15));
await ev(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await ev(() => {
  const J = window.__unake; J.fase = 'fumar';
  // las escenas de la historia se pasan con un pellizco de la izquierda, como en las gafas
  let t = 0;
  J.bot = (d, m) => { const iz = m.izquierda; iz.pinzaAntes = iz.pinza; if (!J.ocupadoHistoria()) { iz.pinza = false; iz.activa = false; return; } t += d; iz.activa = true; iz.pinza = (t % 0.5) < 0.12; };
});
await pag.waitForTimeout(1500);
await pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && window.__unake.fase === 'fumar', null, { timeout: 60000 });
const enBar = await ev(() => window.__unake.portales().lista.map(p => p.dest));
ok(enBar.includes('fuera') && enBar.includes('cocina'), 'Unaké tiene puertas a la calle y a la cocina: ' + enBar.join(', '));
await ev(() => window.__unake.portales().guia(['plaza']));
ok(await ev(() => window.__unake.portales().guiada?.dest) === 'fuera', 'la guía hacia la plaza señala la puerta de la calle');
// mirar a la izquierda (donde está la puerta de la calle) para la foto
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, Math.PI / 2, -0.1));
await pag.waitForTimeout(1500);
await foto('bar');
await pag.waitForFunction(() => !window.__unake.ocupadoHistoria(), null, { timeout: 60000 });
await ev(() => window.__unake.cruzar('fuera'));
await esperaSala('fuera');
ok(await ev(() => window.__unake.fase) === 'barrio', 'cruzar desde el bar abre el barrio sin maqueta');
ok(await ev(() => window.__unake.portales().guiada?.dest) === 'plaza', 'en la puerta de Unaké, la guía señala la plaza');
await pag.waitForTimeout(1500);
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, Math.PI / 2, -0.1));
await pag.waitForTimeout(800);
await foto('fuera');
// andar hasta la puerta de la plaza (la guiada): pon la cabeza encima
await ev(() => {
  const P = window.__unake.portales(), p = P.lista.find(x => x.dest === 'plaza');
  const w = p.malla.getWorldPosition(new window.__unake.THREE.Vector3());
  window.__unake.prueba.mirar(w.x, 1.5, w.z, 0, 0);
});
await pag.waitForFunction(() => window.__unake.barrio.salaId === 'plaza' && !window.__unake.barrio.ocupado, null, { timeout: 60000 }).catch(() => { });
const est = await ev(() => JSON.stringify({ sala: window.__unake.barrio.salaId, cab: window.__unake.obj().xr.cabeza, hist: window.__unake.ocupadoHistoria(), fase: window.__unake.fase, ocup: window.__unake.barrio.ocupado }));
ok(est.includes('"sala":"plaza"'), 'andando hasta la puerta se cruza (a la plaza) ' + est);
ok(await ev(() => window.__unake.portales().metas) === null, 'al llegar a la plaza, la guía se apaga');
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));
await pag.waitForTimeout(1500);
await foto('plaza');
await ev(() => window.__unake.cruzar('fuera'));
await esperaSala('fuera');
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));
await ev(() => window.__unake.cruzar('dentro'));
await pag.waitForFunction(() => !window.__unake.minijuego && !window.__unake.barrio.ocupado, null, { timeout: 20000 });
await pag.waitForTimeout(2000);
const fin = await ev(() => ({ fase: window.__unake.fase, unake: window.__unake.obj().unake.grupo.visible, puertas: window.__unake.portales().lista.length, mj: window.__unake.minijuego }));
ok(['fumar', 'historia'].includes(fin.fase) && fin.unake && fin.puertas === 2 && !fin.mj, 'por la puerta del bar vuelves a Unaké con sus puertas: ' + JSON.stringify(fin));
await foto('vuelta');
ok(!errores.length, errores.length ? 'errores:\n' + errores.slice(0, 6).join('\n') : 'sin errores');
console.log(fallos.length ? `${fallos.length} FALLOS` : 'TODO OK');
await nav.close();
