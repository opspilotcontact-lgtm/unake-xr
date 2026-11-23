// Prueba del motor de historia: recorre del capítulo 1 al final en historia.html simulando lo que avisaría el
// director (minijuegos ganados, hucha, barrio…), cuenta todas las escenas y saca fotos en fotos/hist-*.jpg.
// Uso (con el servidor en marcha: python servir_lan.py --local 18775):
//   node herramientas/pruebas/historia.mjs [puerto] [capInicial]
// Comprueba: sin errores de página; los 17 capítulos (16 + el doble) empiezan y acaban en orden; ningún objetivo
// se atasca; la recreativa del motor coincide con JUEGOS_2D; la partida va a 'unake-xr-partida' y la del juego
// web ('unake-partida') queda intacta.
import { createRequire } from 'module';
import { mkdirSync, readdirSync, unlinkSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18775, desde = 0] = process.argv.slice(2);
const FOTOS = 'herramientas/pruebas/fotos';
mkdirSync(FOTOS, { recursive: true });
for (const f of readdirSync(FOTOS)) if (f.startsWith('hist-')) unlinkSync(`${FOTOS}/${f}`);

const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon|404 \(File not found\)/.test(t)) errores.push(t); if (/^\[historia\] (▶|■|✓)/.test(t)) console.log(t.slice(11)); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
pag.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errores.push(`${r.status()} ${r.url()}`); });
// una partida «real» del juego web en el mismo origen: no se debe tocar
await pag.addInitScript(() => { if (!localStorage.getItem('unake-partida')) localStorage.setItem('unake-partida', '{"centinela":1,"monchis":777}'); });
await pag.goto(`http://127.0.0.1:${puerto}/historia.html?cap=${desde}&nuevo&rapido&foto&v=${Date.now()}`);
await pag.waitForFunction(() => window.__hist && window.__hist.listo, null, { timeout: 90000 });

// qué líneas se retienen para la foto: la portada y la primera que habla alguien (intro), el momento persona o
// la última del cierre, la primera de «Tú» de cada capítulo de tareas y los poscréditos.
await pag.evaluate(() => {
  const H = window.__hist, vistas = new Set();
  const persona = q => !['titulo', 'narrador', 'vuper', 'objetivos'].includes(q);
  H.escenas.retener = (esc, i, l) => {
    const cap = esc.capitulo.indice, k = (n) => `${String(cap + 1).padStart(2, '0')}-${esc.cap}-${n}`;
    let nombre = null;
    if (esc.tipo === 'intro' && i === 0) nombre = k('portada');
    else if (esc.tipo === 'intro' && persona(l[0]) && !vistas.has(k('intro'))) nombre = k('intro');
    else if (esc.tipo === 'cierre' && l[0] === 'narrador' && /limpian? los ojos/.test(l[1])) nombre = k('momento');
    else if (esc.tipo === 'cierre' && i === esc.lineas.length - 1) nombre = k('cierre');
    else if (esc.tipo === 'poscreditos' && i === 2) nombre = k('poscreditos');
    else if (['antes', 'despues', 'giro'].includes(esc.tipo) && l[0] === 'vuper' && !vistas.has(k('tu'))) nombre = k('tu');
    else if (esc.tipo === 'intro' && l[0] === 'objetivos') nombre = k('objetivos');
    if (!nombre || vistas.has(nombre)) return false;
    vistas.add(nombre); H.fotoNombre = nombre; return true;
  };
});

const ev = f => pag.evaluate(f);
const t0 = Date.now();
let ultimo = '', repetido = 0, fotos = 0, capitulos = [], fallo = null;
const fotoMuneca = new Set([0, 2, 7, 10, 14]);
for (let vuelta = 0; vuelta < 20000; vuelta++) {
  const s = await ev(() => { const H = window.__hist; return { ...H.estado(), retenida: H.escenas.retenida, foto: H.fotoNombre }; });
  if (s.retenida) {
    await pag.waitForTimeout(1500); // que se escriba el bocadillo
    await pag.screenshot({ path: `${FOTOS}/hist-${s.foto}.jpg`, type: 'jpeg', quality: 72 }); fotos++;
    await ev(() => window.__hist.escenas.pasar());
    continue;
  }
  if (s.escena || s.pendiente) { await pag.waitForTimeout(40); continue; }
  if (s.acabada) break;
  if (!s.historia) { await pag.waitForTimeout(60); continue; }
  if (!capitulos.includes(s.cap.id)) {
    capitulos.push(s.cap.id);
    if (fotoMuneca.has(s.cap.indice)) {
      await ev(() => { window.__hist.acciones.cerca(); window.__hist.muneca.desplegar(); });
      await pag.waitForTimeout(500);
      await pag.screenshot({ path: `${FOTOS}/hist-${String(s.cap.indice + 1).padStart(2, '0')}-${s.cap.id}-muneca.jpg`, type: 'jpeg', quality: 80 }); fotos++;
      if (s.cap.indice === 0) { await ev(() => window.__hist.muneca.plegar()); await pag.waitForTimeout(300); await pag.screenshot({ path: `${FOTOS}/hist-01-una-que-muneca-plegada.jpg`, type: 'jpeg', quality: 80 }); fotos++; }
      await ev(() => window.__hist.acciones.cerca());
    }
  }
  const clave = s.historia.id + '|' + JSON.stringify(s.historia.accion) + '|' + s.monchis + '|' + s.hucha;
  repetido = clave === ultimo ? repetido + 1 : 0; ultimo = clave;
  if (repetido > 25) { fallo = `atascado en ${s.cap.id}: ${s.historia.texto} (${s.historia.como})`; break; }
  await ev(() => window.__hist.motor.simularObjetivo());
  await pag.waitForTimeout(30);
}

const fin = await ev(async () => {
  const H = window.__hist, { JUEGOS_2D } = await import('./js/recreativa.js');
  const { RECREATIVA } = await import('./js/historia/motor.js');
  const raw = Storage.prototype.getItem;
  const xr = JSON.parse(raw.call(localStorage, 'unake-xr-partida') || 'null');
  return {
    acabada: H.motor.acabada, capitulo: H.motor.E.capitulo, total: H.motor.d.CAPITULOS.length, hucha: H.motor.hucha, monchis: H.motor.monchis,
    recreativaIgual: JSON.stringify(JUEGOS_2D.map(j => j[0])) === JSON.stringify(RECREATIVA),
    original: raw.call(localStorage, 'unake-partida'), xrGuardada: !!xr, xrCapId: xr && xr.capId, saltadas: H.motor.stat('saltadas'),
    errores: H.errores,
  };
});
await nav.close();

const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLO') + ' ' + m); if (!c) process.exitCode = 1; };
console.log(`\n${capitulos.length} capítulos en ${Math.round((Date.now() - t0) / 1000)} s · ${fotos} fotos`);
if (fallo) ok(false, fallo);
ok(fin.acabada && fin.capitulo === fin.total, `historia acabada (${fin.capitulo}/${fin.total}) · hucha ${fin.hucha} · monchis ${fin.monchis} · «seguir» en ${fin.saltadas} pendientes`);
ok(capitulos.length === fin.total - Number(desde), `capítulos recorridos: ${capitulos.join(', ')}`);
ok(fin.recreativaIgual, 'RECREATIVA del motor = JUEGOS_2D de recreativa.js');
ok(fin.original === '{"centinela":1,"monchis":777}', "la partida del juego web ('unake-partida') sigue intacta");
ok(fin.xrGuardada && fin.xrCapId === 'libre', `partida XR en 'unake-xr-partida' (capId ${fin.xrCapId})`);
ok(!errores.length && !fin.errores.length, errores.length || fin.errores.length ? 'errores:\n' + [...errores, ...fin.errores].slice(0, 15).join('\n') : 'sin errores de página');
