// Bot de «La furgo» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (buena): sube a Palicaso, Lasslow y Perico tocando sus recortables del salpicadero, toca «¡A la carretera!», coge el
// volante con las dos manos (pellizco) y lo gira para ir por el carril más limpio (mirando 35 m por delante: la risa
// de Lasslow retrasa el volante). Debe llegar a la meta y ganar. «Otra vez» tocando la tarjeta.
// Partida 2 (mala): solo la Pompa (pierde el doble), coge el volante y se mete en todo lo que pilla. Debe perder.
const api = () => M.furgo;
const REPOSO_D = new T.Vector3(0.25, 0.85, -0.15), REPOSO_I = new T.Vector3(-0.25, 0.85, -0.15);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const llamadas = () => M.renderer.info.render.calls;
let maxCalls = 0, mirado = false; const fotos = new Set();
M.mirar(0, 1.6, 0, 0, -0.12); // la cabina ya se ha montado a la altura de la cámara

function* tocar(m, destino, seg = 0.45) {
  const atras = destino.clone().add(new T.Vector3(0, 0.02, 0.12));
  yield* mover(m, atras, seg, false);
  yield* mover(m, destino, 0.2, false);
  yield* quieto(m, 0.12, false);
  yield* mover(m, atras, 0.2, false);
}
function* elegir(quiero) {
  const a = api();
  log('guardados: ' + a.elegidos.join(', '));
  for (const id of a.elegidos) if (!quiero.includes(id)) { yield* tocar(der(), a.figura(id)); yield* esperar(0.3); }
  for (const id of quiero) if (!a.elegidos.includes(id)) { yield* tocar(der(), a.figura(id)); yield* esperar(0.3); }
  if ([...a.elegidos].sort().join() !== [...quiero].sort().join()) throw new Error('elección mal: ' + a.elegidos.join());
  log('a bordo: ' + a.elegidos.join(', '));
}
function* arrancar() {
  yield* hasta(() => M.ui.tarjetas.length, 5);
  const c = M.ui.tarjetas[0];
  yield* tocar(der(), c.position.clone());
  yield* hasta(() => api().fase !== 'elegir', 3);
}
function* cogerVolante() {
  const a = api();
  yield* mover(izq(), a.puntoVolante(Math.PI).add(new T.Vector3(0, 0, 0.05)), 0.5, false);
  yield* mover(der(), a.puntoVolante(0).add(new T.Vector3(0, 0, 0.05)), 0.5, false);
  poner(izq(), a.puntoVolante(Math.PI), false); poner(der(), a.puntoVolante(0), false); yield;
  poner(izq(), a.puntoVolante(Math.PI), true); poner(der(), a.puntoVolante(0), true); yield;
  yield* hasta(() => a.sujeto, 2);
  log('volante cogido con las dos manos');
}
// qué carril quiere: el más limpio (buena) o el que tenga algo que duela (mala)
function carrilDeseado(buena, actual) {
  const a = api(), coste = [0, 0, 0];
  for (const o of a.obstaculos()) {
    if (o.dz < -0.5 || o.dz > 35 || o.carril == null || o.tipo === 'cartel' || o.tipo === 'gasolinera' || o.tipo === 'humo') continue;
    const malo = ['cono', 'sofa', 'bache', 'charco'].includes(o.tipo);
    coste[o.carril] += malo ? 20 / (o.dz + 2) : -1 / (o.dz + 2);
  }
  if (!buena) { let peor = actual; for (let c = 0; c < 3; c++) if (coste[c] > coste[peor] + 0.05) peor = c; return peor; }
  let mejor = actual; for (let c = 0; c < 3; c++) if (coste[c] < coste[mejor] - 0.05 || (coste[c] === coste[mejor] && Math.abs(c - 1) < Math.abs(mejor - 1) && coste[mejor] > 0)) mejor = c;
  return mejor;
}
function* conducir(buena) {
  const a = api(); let quiere = 1, tAviso = 0;
  while (a.fase !== 'fin') {
    quiere = carrilDeseado(buena, quiere);
    const objetivo = [-0.7, 0, 0.7][quiere]; // rad
    const paso = THREE_clamp(objetivo - a.angulo, -4 * 0.016, 4 * 0.016);
    // las manos siguen agarradas a su sitio del aro y lo giran juntas
    poner(izq(), a.puntoVolante(Math.PI - paso), true); poner(der(), a.puntoVolante(-paso), true);
    maxCalls = Math.max(maxCalls, llamadas());
    if (M.t - tAviso > 8) { tAviso = M.t; log(`${Math.round(a.recorrido)}/${a.meta} m · carril ${a.carril} · ${a.puntos} pts · vidas ${a.vidas} · draw calls ${llamadas()}`); }
    if (a.recorrido > 120 && buena && !fotos.has('c')) { fotos.add('c'); foto('conduciendo'); }
    if (a.recorrido > 200 && buena && !mirado) { mirado = true; M.mirar(0, 1.6, 0, -1.25, -0.15); yield* quieto(izq(), 0.15, true); foto('copiloto'); yield* quieto(izq(), 0.5, true); M.mirar(0, 1.6, 0, 0, -0.12); }
    if (buena && a.charla && !fotos.has('p')) { fotos.add('p'); foto('palicaso'); }
    if (!buena && a.golpes >= 1 && !fotos.has('g')) { fotos.add('g'); foto('golpe'); }
    yield;
  }
}
function THREE_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function* partida(buena) {
  yield* hasta(() => api() && api().fase === 'elegir' && !M.resultado, 20);
  poner(der(), REPOSO_D, false); poner(izq(), REPOSO_I, false);
  yield* esperar(0.5);
  if (buena) foto('elegir');
  yield* elegir(buena ? ['palicaso', 'lasslow', 'perico'] : ['pompa']);
  if (buena) { yield* esperar(0.4); foto('elegidos'); }
  yield* arrancar();
  yield* esperar(0.7);
  if (buena) foto('sentados');
  yield* cogerVolante();
  yield* conducir(buena);
  const a = api();
  log(`partida ${buena ? 'buena' : 'mala'}: ${Math.round(a.recorrido)} m, golpes ${a.golpes}, vidas ${a.vidas}, monchis ${a.monchis}`);
  yield* hasta(() => M.resultado, 6);
  log('resultado: ' + JSON.stringify(M.resultado));
  poner(der(), REPOSO_D, false); poner(izq(), REPOSO_I, false);
  yield* esperar(2.2);
  foto(buena ? 'final1' : 'final2');
}

yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* tocar(der(), otra.position.clone());
yield* hasta(() => api() && api() !== viejo && !M.resultado, 15);
log('otra vez: partida nueva');
yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
log('FIN OK');
