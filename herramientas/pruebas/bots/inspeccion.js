// Bot de «La inspección» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): coge/frota lo primero que ve sin mirar al casero → tres sospechas, pierde.
// «Otra vez» tocando la tarjeta.
// Partida 2 (buena): solo actúa con el casero de espaldas; al «¡clinc!» suelta y se aparta. Lleva cosas al cajón,
// frota el charco y abanica la nube. Debe ganar.
// Al final, una partida nueva y abandonar() a los pocos segundos → terminar con gana:false.
const api = () => M.inspeccion;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let maxCalls = 0;
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return; fotos.add(n); foto(n); };
M.mirar(0, 1.6, 0, 0, -0.5);
const seguro = () => api() && api().casero === 'espaldas' && !M.resultado;

function* paso(m, destino, seg, pinza) {
  const desde = m.pos.clone(); let t = 0;
  while (t < seg) {
    if (!seguro()) return false;
    t += 0.016; poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, Math.min(1, t / seg)), pinza); yield;
  }
  return true;
}
function* retirar(m) { poner(m, m.pos.clone(), false); yield; yield* mover(m, api().reposo(), 0.2, false); }

function* hacer(p) {
  const a = api(), m = der();
  if (p.gesto === 'cajon') {
    if (!(yield* paso(m, p.pos, 0.25, false))) return yield* retirar(m);
    poner(m, p.pos, true); yield;
    fotoUna('llevar');
    if (!(yield* paso(m, () => a.cajon().add(new T.Vector3(0, 0.05, 0)), 0.4, true))) return yield* retirar(m);
    yield* quieto(m, 0.05, true);
    return yield* retirar(m);
  }
  // frotar el charco o abanicar la nube: de lado a lado hasta que desaparece
  const amp = p.gesto === 'limpiar' ? 0.07 : 0.1, base = p.pos.clone().add(new T.Vector3(0, p.gesto === 'limpiar' ? 0.03 : 0, 0));
  const lado = a.lado().multiplyScalar(amp);
  if (!(yield* paso(m, base.clone().sub(lado), 0.25, false))) return yield* retirar(m);
  let k = 0;
  while (a.pruebas().some(q => q.pos.distanceTo(p.pos) < 0.02) && k < 12) {
    if (!(yield* paso(m, base.clone()[k % 2 ? 'sub' : 'add'](lado), 0.15, false))) return yield* retirar(m);
    if (k === 3) fotoUna(p.gesto);
    k++;
  }
  return yield* retirar(m);
}

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado && api().fase === 'juego', 20);
  const a = api();
  poner(der(), a.reposo(), false); poner(izq(), a.mano(), false);
  log(`partida ${buena ? 'buena' : 'mala'}`);
  let tLog = 0;
  while (!M.resultado) {
    maxCalls = Math.max(maxCalls, M.renderer.info.render.calls);
    if (M.t - tLog > 6) { tLog = M.t; log(`${a.casero} · ${Math.ceil(a.restante)} s · ${a.puntos} pts · vidas ${a.vidas} · escondidas ${a.escondidas} · a la vista ${a.pruebas().length} · draw calls ${M.renderer.info.render.calls}`); }
    if (a.fase !== 'juego') { yield; continue; }
    if (a.casero === 'mira') fotoUna(buena ? 'mira' : 'mira-mala');
    const ps = a.pruebas();
    if (!ps.length) { yield; continue; }
    if (buena) {
      if (!seguro()) { yield; continue; }
      const p = ps.find(q => q.gesto === 'cajon') || ps[0];
      yield* hacer(p);
      continue;
    }
    // la mala: a lo loco, mire o no mire
    const p = ps[0], m = der();
    if (p.gesto === 'cajon') { yield* mover(m, p.pos, 0.2, false); poner(m, p.pos, true); yield; yield* quieto(m, 0.6, true); poner(m, m.pos.clone(), false); yield; }
    else { const l = a.lado().multiplyScalar(0.07); for (let i = 0; i < 6 && !M.resultado; i++) yield* mover(m, p.pos.clone().add(new T.Vector3(0, 0.03, 0))[i % 2 ? 'sub' : 'add'](l), 0.15, false); }
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · escondidas ${a.escondidas} · vidas ${a.vidas}`);
  yield* esperar(2.4);
  foto(buena ? 'final-buena' : 'final-mala');
  yield* esperar(0.6); // que la foto salga antes de tocar nada
}

yield* hasta(() => api(), 20);
yield* esperar(1.2); foto('intro');
yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), otra.position.clone().add(new T.Vector3(0, 0, 0.1)), 0.3, false);
yield* mover(der(), otra.position.clone(), 0.2, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 15);
log('otra vez: partida nueva');
yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
// salir a mitad
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api() && api().fase === 'juego', 15);
  yield* esperar(2);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
