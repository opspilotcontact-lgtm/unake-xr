// Bot del cuarto de Vuper (cuarto.html, motor falso con 1000 monchis, acto II abierto, la mochila ya inventada).
// Uso (servidor en marcha): node herramientas/pruebas/cuarto.mjs <puerto> [segundos] [real]
// Abre las dos puertas del armario tirando del tirador, se prueba la gorra (la compra), intenta una prenda cerrada por
// acto y otra que no le llega, suelta una sin llevarla al pecho (no cobra), se quita y se vuelve a poner la gorra,
// compra un invento, intenta otro sin monchis, mira el corcho hasta que las estrellas nuevas se dan por vistas, toca
// una polaroid y cierra las puertas. Fotos en herramientas/pruebas/fotos/cuarto-*.jpg
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18799, segs = 120, modo = ''] = process.argv.slice(2);
mkdirSync('herramientas/pruebas/fotos', { recursive: true });

const BOT = function* ({ T, THREE, der, mover, quieto, hasta, log, foto, ok }) {
  const { motor, cuarto } = T, E = motor.E;
  const R = der();
  function* f(n) { foto(n); yield* quieto(R, 0.35); } // la foto llega unos ms tarde: no mover la cámara aún
  const est = () => cuarto.estado();
  const prenda = id => est().prendas.find(p => p.id === id);
  const reposo = new THREE.Vector3(0.15, 0.95, -0.25);
  T.mirar(0, 1.2, 0, 0, -0.05);
  yield* mover(R, reposo, 0.2, false);
  yield* quieto(R, 0.8, false);
  yield* f('inicio');
  T.resultados.llamadas = T.llamadas();
  let propias = 0; cuarto.g.traverse(o => { if ((o.isMesh || o.isPoints) && o.visible) propias++; });
  T.resultados.propias = propias;
  log(`llamadas de dibujo: ${T.llamadas()} en total · objetos del cuarto: ${propias}`);
  ok('≤ 25 llamadas del cuarto', propias <= 25, String(propias));

  // 1) abrir las dos puertas tirando del tirador (arco alrededor de la bisagra)
  T.mirar(0, 1.2, 0, 1.4, -0.3);
  const A = cuarto.gA;
  for (const k of [0, 1]) {
    const d = cuarto.puertas[k], bis = d.piv.position, lado = d.lado;
    const arco = a => A.localToWorld(new THREE.Vector3(bis.x - lado * 0.355 * Math.cos(a), 0.78, bis.z + 0.355 * Math.sin(a)));
    yield* mover(R, est().tiradores[k], 0.4, false);
    yield* quieto(R, 0.1, true);
    for (let i = 1; i <= 12; i++) yield* mover(R, arco(i / 12 * 2.8), 0.05, true);
    yield* quieto(R, 0.1, false);
    yield* mover(R, reposo, 0.3, false);
  }
  yield* quieto(R, 0.6, false);
  ok('puertas abiertas', est().puertas.every(a => a > 2.7), JSON.stringify(est().puertas));
  yield* f('armario-abierto');

  // 2) la gorra: cogerla y al pecho = comprarla y ponérsela
  const m0 = E.monchis;
  yield* mover(R, prenda('gorra').pos, 0.5, false);
  yield* quieto(R, 0.1, true);
  ok('gorra en la mano', prenda('gorra').estado === 'mano', prenda('gorra').estado);
  yield* mover(R, () => est().pecho.clone().add(new THREE.Vector3(0.05, 0.25, -0.25)), 0.4, true);
  yield* f('gorra-mano');
  yield* mover(R, () => est().pecho, 0.4, true);
  yield* quieto(R, 0.1, true);
  ok('gorra comprada y puesta', E.monchis === m0 - 450 && E.armario.tiene.gorra && E.armario.puesto.cabeza === 'gorra' && (E.stats.prendas || 0) === 1, `monchis ${E.monchis} ${JSON.stringify(E.armario)}`);
  ok('alVestir compra', T.vestidos.length === 1 && T.vestidos[0].compra && T.vestidos[0].puesta);
  yield* quieto(R, 0.2, false);
  yield* mover(R, reposo, 0.3, false);
  yield* hasta(() => prenda('gorra').estado === 'colgada', 3);
  ok('la gorra vuelve a su percha', true);

  // 3) corona: cerrada por acto (no se despega)
  yield* mover(R, prenda('corona').pos, 0.5, false);
  yield* quieto(R, 0.15, true);
  ok('corona cerrada no sale', prenda('corona').estado === 'colgada' && E.monchis === 550);
  yield* f('corona-cerrada');
  yield* quieto(R, 0.2, false);
  // 4) gafas (600) con 550: no te llega
  yield* mover(R, prenda('gafas').pos, 0.4, false);
  yield* quieto(R, 0.15, true);
  ok('gafas sin monchis', prenda('gafas').estado === 'colgada' && !E.armario.tiene.gafas);
  yield* quieto(R, 0.2, false);
  // 5) bufanda: la coges y la sueltas lejos del pecho: vuelve, no cobra
  const pb = prenda('bufanda').pos;
  yield* mover(R, pb, 0.5, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, pb.clone().add(new THREE.Vector3(0.15, 0.1, 0.1)), 0.3, true);
  yield* quieto(R, 0.6, false);
  ok('bufanda soltada vuelve sin cobrar', prenda('bufanda').estado === 'colgada' && !E.armario.tiene.bufanda && E.monchis === 550);
  // 6) gorra otra vez: al pecho = quitártela; y otra: ponértela
  for (const quiere of [null, 'gorra']) {
    yield* hasta(() => prenda('gorra').estado === 'colgada', 3);
    yield* mover(R, prenda('gorra').pos, 0.5, false);
    yield* quieto(R, 0.1, true);
    yield* mover(R, () => est().pecho, 0.5, true);
    yield* quieto(R, 0.1, true);
    yield* quieto(R, 0.1, false);
    ok(quiere ? 'gorra otra vez puesta' : 'gorra quitada', (E.armario.puesto.cabeza || null) === quiere && E.monchis === 550, JSON.stringify(E.armario.puesto));
    yield* mover(R, reposo, 0.3, false);
  }
  T.mirar(0, 1.2, 0, 0.75, -0.3);
  yield* quieto(R, 0.6, false);
  yield* f('espejo');

  // ---------- el taller ----------
  T.mirar(0, 1.2, 0, -1.1, -0.55);
  const inv = id => est().inventos.find(i => i.id === id);
  yield* quieto(R, 0.4, false);
  yield* f('taller');
  yield* mover(R, inv('silbato').pos, 0.5, false);
  yield* quieto(R, 0.1, true);
  ok('silbato comprado', E.inventos.silbato && E.monchis === 250 && T.inventados.length === 1, `monchis ${E.monchis}`);
  yield* quieto(R, 0.2, false);
  yield* mover(R, inv('pajarita').pos, 0.4, false);
  yield* quieto(R, 0.15, true);
  ok('pajarita sin monchis', !E.inventos.pajarita && E.monchis === 250);
  yield* quieto(R, 0.2, false);
  yield* mover(R, inv('mochila').pos, 0.4, false);
  yield* quieto(R, 0.15, true);
  yield* quieto(R, 0.6, false);
  yield* f('taller-comprado');
  yield* mover(R, reposo, 0.3, false);

  // ---------- el corcho ----------
  E.estrellas.Farol = 2; E.records.Farol = 2300;  // una estrella nueva más mientras juegas
  T.mirar(0, 1.2, 0, -0.05, 0.1);
  yield* quieto(R, 0.5, false);
  const nuevas = est().nuevas;
  ok('brillan las nuevas', est().brillo && nuevas.includes('Pipas') && nuevas.includes('Cuentas') && nuevas.includes('Farol') && !nuevas.includes('Tarta'), JSON.stringify(nuevas));
  yield* f('corcho-nuevas');
  yield* quieto(R, 5, false);
  ok('vistas al mirarlas', !est().brillo && E.corchoVisto && E.corchoVisto.Pipas === 2, JSON.stringify(E.corchoVisto));
  yield* f('corcho-visto');
  // tocar la polaroid de la tarta
  const pt = est().polaroid('Tarta');
  T.mirar(0, 1.2, 0, 0.3, 0.05);
  yield* mover(R, pt.clone().add(new THREE.Vector3(0, 0, 0.12)), 0.4, false);
  yield* mover(R, pt.clone().add(new THREE.Vector3(0, 0, 0.01)), 0.3, false);
  yield* quieto(R, 0.3, false);
  yield* f('polaroid');
  yield* mover(R, reposo, 0.4, false);

  // ---------- cerrar las puertas ----------
  T.mirar(0, 1.2, 0, 1.4, -0.3);
  for (const k of [0, 1]) {
    const d = cuarto.puertas[k], bis = d.piv.position, lado = d.lado;
    const arco = a => A.localToWorld(new THREE.Vector3(bis.x - lado * 0.355 * Math.cos(a), 0.78, bis.z + 0.355 * Math.sin(a)));
    yield* mover(R, est().tiradores[k], 0.4, false);
    yield* quieto(R, 0.1, true);
    for (let i = 11; i >= 0; i--) yield* mover(R, arco(i / 12 * 2.8), 0.04, true);
    yield* quieto(R, 0.05, false);
    yield* mover(R, reposo, 0.3, false);
  }
  yield* quieto(R, 0.6, false);
  ok('puertas cerradas', est().puertas.every(a => a < 0.05), JSON.stringify(est().puertas));
  yield* f('cerrado');
  ok('guarda la partida', !('guardados' in motor) || motor.guardados >= 4, String(motor.guardados));
};

const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404')) errores.push(t);
  if (t.startsWith('[bot]')) console.log(t);
});
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
try {
  await pag.goto(`http://127.0.0.1:${puerto}/cuarto.html?pc${modo === 'real' ? '&real' : ''}&v=${Date.now()}`);
  await pag.waitForFunction(() => window.__t && window.__t.listo, null, { timeout: 60000 });
  await pag.evaluate(src => {
    const T = window.__t, THREE = T.THREE;
    let dt = 0.016, manos;
    T.resultados = { checks: [] };
    const log = m => console.log('[bot] ' + T.t.toFixed(1) + 's ' + m);
    const ok = (nombre, si, info = '') => { T.resultados.checks.push({ nombre, si: !!si, info }); log((si ? 'OK  ' : 'MAL ') + nombre + (si ? '' : ' · ' + info)); };
    function poner(m, pos, pinza, agarre) {
      m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
      if (m._p) m.vel.copy(pos).sub(m._p).divideScalar(Math.max(dt, 0.001)); else m.vel.set(0, 0, 0);
      m._p = pos.clone(); m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
      if (pinza !== undefined) m.pinza = pinza;
      if (agarre !== undefined) m.agarre = agarre;
    }
    function* quieto(m, seg, pinza, agarre) { let t = 0; while (t < seg) { t += dt; poner(m, m.pos.clone(), pinza, agarre); yield; } }
    function* mover(m, destino, seg, pinza, agarre) {
      const desde = m.pos.clone(); let t = 0;
      while (t < seg) { t += dt; const k = Math.min(1, t / seg); poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, k), pinza, agarre); yield; }
    }
    function* hasta(cond, max = 30) { let t = 0; while (!cond()) { t += dt; if (t > max) throw new Error('timeout: ' + cond.toString()); yield; } }
    const foto = n => { T.fotoPedida = n; };
    const bot = (0, eval)('(' + src + ')');
    let gen = null;
    T.bot = (d, m) => {
      dt = d; manos = m;
      if (!gen) gen = bot({ T, THREE, der: () => manos.derecha, mover, quieto, hasta, log, foto, ok });
      const r = gen.next(); if (r.done) { T.bot = null; T.botFin = true; }
    };
    T.arrancarPC();
  }, BOT.toString());
  const t0 = Date.now(), hechas = new Set();
  while (Date.now() - t0 < segs * 1000) {
    const e = await pag.evaluate(() => ({ fin: window.__t.botFin, foto: window.__t.fotoPedida, bot: !!window.__t.bot }));
    if (e.foto && !hechas.has(e.foto)) { hechas.add(e.foto); await pag.screenshot({ path: `herramientas/pruebas/fotos/cuarto-${e.foto}.jpg`, type: 'jpeg', quality: 72 }); }
    if (e.fin || !e.bot) break;
    await pag.waitForTimeout(100);
  }
  const r = await pag.evaluate(() => ({ fin: !!window.__t.botFin, ...window.__t.resultados }));
  console.log(JSON.stringify({ fin: r.fin, llamadas: r.llamadas, propias: r.propias, mal: r.checks.filter(c => !c.si), bien: r.checks.filter(c => c.si).length }));
} finally {
  console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
  await nav.close();
}
