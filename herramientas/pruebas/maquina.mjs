// Bot de la recreativa física (maquina.html): enciende, mueve la palanca, elige Tarta (teclas) y Cámaras (puntero),
// pulsa START, juega con la palanca y los botones (comprueba que la textura del 2D cambia), sale, prueba la misión
// (pedir('Periquito') → ★ primero), el stick del mando, el modo sentado, y cuenta las llamadas de dibujo.
// Uso: node herramientas/pruebas/maquina.mjs [puerto]   (servidor: python servir_lan.py --local 18774)
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18774;
mkdirSync('herramientas/pruebas/fotos', { recursive: true });
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404')) errores.push(t);
  if (t.startsWith('[bot]')) console.log(t);
});
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/maquina.html?v=${Date.now()}`);
await pag.waitForFunction(() => window.__maq, null, { timeout: 30000 });

// el cuerpo del bot corre DENTRO de la página, un paso por fotograma (como minijuego.mjs)
function* cuerpo({ M, T, der, izq, poner, mover, quieto, hasta, log, foto, informe }) {
  const R = M.rec;
  const vista3_4 = () => M.mirar(0.95, 1.5, 0.25, 0.68, -0.3);
  const vistaJugador = () => M.mirar(0, 1.6, 0, 0, -0.42);
  const espera = function* (s) { const t0 = M.t; while (M.t - t0 < s) yield; };
  // pulsar un botón con la punta del dedo: encima, abajo (hundido), arriba
  const pulsar = function* (k, m = der()) {
    const arriba = M.donde(k), abajo = M.donde(k, 0.006);
    yield* mover(m, arriba, 0.15, false, false);
    yield* mover(m, abajo, 0.1, false, false);
    yield* quieto(m, 0.12, false, false);
    yield* mover(m, arriba, 0.1, false, false);
  };
  const huella = () => {
    const c = R.p?.textura?.image; if (!c) return 0;
    const t = document.createElement('canvas'); t.width = 48; t.height = 27; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 48, 27);
    const d = g.getImageData(0, 0, 48, 27).data; let s = 0; for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; return s;
  };
  const elegirHasta = function* (clave) {
    let n = 0;
    while (R._lista()[R.sel].clave !== clave) { yield* pulsar('elegir'); if (++n > 30) throw new Error('no llego a ' + clave); }
  };
  const inclinar = function* (m, dx, dy, seg) {
    yield* mover(m, M.bola(), 0.2, false, false);
    yield* quieto(m, 0.05, true, false);
    yield* mover(m, () => M.bola(dx, dy), 0.12, true, false);
    yield* quieto(m, seg, true, false);
    yield* mover(m, M.bola(), 0.1, true, false);
    yield* quieto(m, 0.05, false, false);
    yield* mover(m, M.bola(0, -0.12).add(new T.Vector3(0, 0.12, 0)), 0.15, false, false);
  };

  poner(der(), M.donde('b2').add(new T.Vector3(0.05, 0.12, 0.1)), false, false);
  poner(izq(), M.bola(0, -0.12).add(new T.Vector3(0, 0.12, 0)), false, false);
  vista3_4(); yield* espera(0.6);
  informe.llamadas = M.medir();
  yield* foto('apagada'); yield* espera(0.4);
  vistaJugador();
  // 1. ENCENDER
  yield* pulsar('encender', izq());
  informe.encendida = R.modo; yield* hasta(() => R.modo === 'atraccion', 5);
  yield* espera(0.4); yield* foto('atraccion'); yield* espera(0.3);
  // 2. palanca: de la atracción al menú y ▼ baja en la lista
  yield* inclinar(izq(), 0, -0.05, 0.25);
  yield* hasta(() => R.modo === 'menu', 3);
  const sel0 = R.sel;
  yield* inclinar(izq(), 0, -0.05, 0.2);
  informe.palancaMueve = R.sel !== sel0;
  log('menú, sel ' + sel0 + ' → ' + R.sel);
  // 3. Tarta: ELEGIR hasta ella, START, palanca ◀ ▶
  yield* elegirHasta('Tarta');
  yield* foto('menu'); yield* espera(0.3);
  yield* pulsar('start');
  yield* hasta(() => R.modo === 'como', 3); yield* espera(0.8); yield* foto('como');
  yield* hasta(() => R.modo === 'jugando', 40);
  yield* espera(4.5);
  const h0 = huella();
  yield* inclinar(izq(), -0.05, 0, 0.4); informe.tartaIzq = R.teclas.has('ArrowLeft') || informe.tartaIzq;
  // mantener a la derecha y mirar las teclas a mitad
  yield* mover(izq(), M.bola(), 0.2, false, false); yield* quieto(izq(), 0.05, true, false);
  yield* mover(izq(), () => M.bola(0.05, 0), 0.12, true, false); yield* quieto(izq(), 0.2, true, false);
  informe.tartaTeclas = [...R.teclas];
  yield* quieto(izq(), 0.8, true, false);
  yield* foto('tarta');
  yield* mover(izq(), M.bola(), 0.1, true, false); yield* quieto(izq(), 0.05, false, false);
  const h1 = huella();
  informe.tartaCambia = h0 !== h1;
  log('Tarta: teclas ' + informe.tartaTeclas + ', textura cambia ' + informe.tartaCambia);
  // 4. SALIR → menú
  yield* pulsar('salir');
  yield* hasta(() => R.modo === 'menu', 5);
  informe.salirMenu = R.modo;
  // 5. Cámaras: puntero + botones
  yield* elegirHasta('Camaras');
  yield* pulsar('start');
  yield* hasta(() => R.modo === 'jugando', 40);
  yield* espera(6.5);
  const c0 = huella();
  yield* pulsar('b1'); informe.camTeclaN = R.juego.ctrl.botones[0].code;
  yield* espera(0.6);
  yield* inclinar(izq(), 0.05, 0, 0.2);
  yield* espera(0.6);
  // apuntar con el mando derecho (rayo) y pellizcar en varios sitios
  const d = der();
  poner(d, M.donde('b2').add(new T.Vector3(0.05, 0.15, 0.15)), false, false);
  for (const [u, v] of [[0.3, 0.6], [0.5, 0.5], [0.7, 0.45]]) {
    const dir = M.centroPantalla(u, v).sub(d.pos).normalize();
    d.quat.setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
    yield* quieto(d, 0.25, false, false);
    yield* quieto(d, 0.12, true, false);
    yield* quieto(d, 0.12, false, false);
  }
  const dir = M.centroPantalla(0.6, 0.55).sub(d.pos).normalize(); d.quat.setFromUnitVectors(new T.Vector3(0, 0, -1), dir);
  yield* quieto(d, 0.2, false, false);
  informe.mira = R.m.mira.visible;
  yield* foto('camaras');
  const c1 = huella();
  informe.camarasCambia = c0 !== c1;
  log('Cámaras: mira ' + informe.mira + ', textura cambia ' + informe.camarasCambia);
  d.quat.identity();
  yield* pulsar('salir');
  yield* hasta(() => R.modo === 'menu', 5);
  // 6. misión
  R.pedir('Periquito', 'Ve a la recreativa y juega a ¡Periquito!');
  yield* espera(0.5);
  informe.mision = { primero: R._lista()[0].clave, marcado: R._lista()[0].mision, sel: R.sel };
  yield* foto('mision');
  vista3_4(); yield* espera(1.6); yield* foto('mision-fuera'); vistaJugador();
  // 7. stick del mando izquierdo mueve la palanca (y se ve)
  const iz = izq(); iz.fuente = { gamepad: { axes: [0, 0, 0, 1], buttons: [] } };
  const s1 = R.sel;
  yield* quieto(iz, 0.3, false, false);
  informe.stick = { sel: [s1, R.sel], giro: +R.m.pivote.rotation.x.toFixed(2) };
  iz.fuente = null;
  yield* quieto(iz, 0.3, false, false);
  // 8. sentado: la cabeza baja → el panel baja
  M.mirar(0, 1.15, 0, 0, -0.3);
  yield* espera(6);
  informe.sentado = +R.m.cuerpo.position.y.toFixed(2);
  yield* foto('sentado');
  M.mirar(0, 1.6, 0, 0, -0.42);
  // 9. SALIR en el menú apaga
  yield* pulsar('salir');
  yield* hasta(() => R.modo === 'apagada', 3);
  informe.final = R.estado();
  log('fin');
}

await pag.evaluate(fuente => {
  const M = window.__maq, T = M.THREE;
  let dt = 0.016, manos = M.xr.manos;
  const informe = M.informe = {};
  const log = m => console.log('[bot] ' + M.t.toFixed(1) + 's ' + m);
  const der = () => manos.derecha, izq = () => manos.izquierda;
  function poner(m, pos, pinza, agarre) {
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
    m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
    if (pinza !== undefined) m.pinza = pinza;
    if (agarre !== undefined) m.agarre = agarre;
  }
  function* quieto(m, seg, pinza, agarre) { let t = 0; while (t < seg) { t += dt; poner(m, m.pos.clone(), pinza, agarre); yield; } }
  function* mover(m, destino, seg, pinza, agarre) {
    const desde = m.pos.clone(); let t = 0;
    while (t < seg) { t += dt; const k = Math.min(1, t / seg); poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, k), pinza, agarre); yield; }
  }
  function* hasta(cond, max = 30) { let t = 0; while (!cond()) { t += dt; if (t > max) throw new Error('timeout: ' + cond.toString()); yield; } }
  const foto = function* (n) { M.fotos = M.fotos || []; M.fotos.push(n); M.esperaFoto = n; while (M.esperaFoto) yield; };
  const gen = new Function('ayuda', `return (${fuente})(ayuda);`)({ M, T, der, izq, poner, mover, quieto, hasta, log, foto, informe });
  document.getElementById('portada').hidden = true;
  M.bot = (d, m) => { dt = d; manos = m; const r = gen.next(); if (r.done) { M.bot = null; M.botFin = true; } };
}, cuerpo.toString());

const t0 = Date.now(), hechas = new Set();
while (Date.now() - t0 < 180000) {
  const e = await pag.evaluate(() => ({ fin: window.__maq.botFin, fotos: window.__maq.fotos || [], bot: !!window.__maq.bot }));
  for (const f of e.fotos) if (!hechas.has(f)) { hechas.add(f); await pag.screenshot({ path: `herramientas/pruebas/fotos/maquina-${f}.jpg`, type: 'jpeg', quality: 75 }); }
  if (e.fotos.length) await pag.evaluate(() => { window.__maq.esperaFoto = null; });
  if (e.fin || !e.bot) break;
  await pag.waitForTimeout(120);
}
const r = await pag.evaluate(() => ({ fin: !!window.__maq.botFin, informe: window.__maq.informe, terminados: window.__maq.terminados, empezados: window.__maq.empezados }));
console.log(JSON.stringify(r, null, 1));
const ok = r.fin && r.informe.palancaMueve && r.informe.tartaCambia && r.informe.camarasCambia && r.informe.mision?.primero === 'Periquito' && r.informe.mision?.marcado
  && r.informe.tartaTeclas?.includes('ArrowRight') && r.informe.stick?.sel[0] !== r.informe.stick?.sel[1] && r.informe.sentado < -0.1 && r.informe.final?.modo === 'apagada';
console.log(ok ? 'BIEN' : 'MAL');
console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
await nav.close();
process.exit(ok && !errores.length ? 0 : 1);
