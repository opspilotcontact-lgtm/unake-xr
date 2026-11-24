// Bot de «La apuesta de pipas»: dos partidas enteras de 10 tiradas. Coge cada pipa del cucurucho (mano
// izquierda), la lanza con un gesto de verdad calculado para caer en la papelera (con viento y papelera que se
// mueve) y falla adrede en algunas; prueba también que una pipa que se cae no gasta tirada y el «Otra vez».
M.mirar(0, 1.6, 0, 0, -0.3);
const api = () => M.escena.getObjectByName('minijuego-pipas')?.userData.api;
poner(izq(), new T.Vector3(-0.22, 1.05, -0.3), false);
poner(der(), new T.Vector3(0.25, 1.1, -0.2), false);
yield* quieto(der(), 0.3);

const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const T_VUELO = 0.75, IMPULSO = M.agarre.impulso;
// velocidad de salida para estar en `meta` dentro de T segundos (gravedad + viento; el aire frena un pelín)
function velPara(desde, meta, viento) {
  const a = new T.Vector3(viento.x, -9.8, viento.z);
  return meta.clone().sub(desde).addScaledVector(a, -0.5 * T_VUELO * T_VUELO).divideScalar(T_VUELO).multiplyScalar(1.03);
}

function* coger(a) {
  yield* hasta(() => a.fase === 'apunta' && a.pipa && a.pipa.enCono, 15);
  yield* mover(der(), () => a.pipa.m.position.clone(), 0.35, false);
  yield* quieto(der(), 0.08, true);
  if (!a.pipa?.c.cogido) throw new Error('no se ha cogido la pipa');
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  yield* hasta(() => a.fase === 'apunta', 15);
  if (n === 1) {
    foto('inicio');
    yield* esperar(0.4); M.mirar(0, 1.6, 0, 0.35, -0.95); foto('mano');
    yield* esperar(0.5); M.mirar(0, 1.6, 0, 0, -0.3);
  }
  for (let i = 0; i < 10; i++) {
    yield* coger(a);
    if (n === 2 && i === 0) {
      // se le cae (suelta sin velocidad): no debe gastar tirada
      yield* quieto(der(), 0.1, false);
      yield* esperar(0.6);
      if (a.E.resultados.length !== 0 || a.fase !== 'apunta') throw new Error('la pipa caída ha contado');
      log('pipa caída: no cuenta, sale otra');
      yield* coger(a);
    }
    // la primera la gana (7 de 10); la segunda la pierde (4 de 10)
    const falla = n === 1 ? [2, 5, 8].includes(i) : [1, 2, 4, 6, 8, 9].includes(i);
    const R0 = new T.Vector3(0.15, 1.35, -0.25);
    // planear el armado y volver a apuntar justo antes de lanzar (la papelera se mueve)
    let meta = a.papeleraEn(0.35 + 0.15 + T_VUELO).add(new T.Vector3(0, 0.03, 0));
    let vh = velPara(R0, meta, a.viento).divideScalar(IMPULSO);
    const W = R0.clone().addScaledVector(vh, -0.15);
    yield* mover(der(), W, 0.35, true);
    meta = a.papeleraEn(0.15 + T_VUELO).add(new T.Vector3(0, 0.03, 0));
    if (falla) meta.add(new T.Vector3(0.75, 0, 0));
    vh = velPara(W.clone().addScaledVector(vh, 0.15), meta, a.viento).divideScalar(IMPULSO);
    const t0 = M.t;
    while (true) {
      const tt = M.t - t0, suelta = tt >= 0.15;
      poner(der(), W.clone().addScaledVector(vh, tt), !suelta);
      yield;
      if (suelta) break;
    }
    if (a.fase !== 'vuelo') throw new Error('la pipa no ha salido volando (fase ' + a.fase + ')');
    if (n === 1 && i === 0) { yield* esperar(0.35); foto('vuelo'); }
    if (n === 1 && i === 7) { yield* esperar(0.3); foto('movil'); }
    if (n === 2 && i === 3) {
      yield* esperar(0.25);
      M.mirar(2.3, 1.5, -1.0, Math.PI / 2, -0.32); foto('lado');
      yield* esperar(0.5); M.mirar(0, 1.6, 0, 0, -0.3);
    }
    yield* hasta(() => a.E.resultados.length === i + 1, 9);
    const r = a.E.resultados[i];
    log(`partida ${n} · tirada ${i + 1}: ${r.dentro ? 'DENTRO +' + r.pts : 'fuera'}${falla ? ' (fallo adrede)' : ''} · viento ${a.viento.length().toFixed(2)} · ${a.E.puntos} pts`);
    if (n === 1 && r.dentro && !M._fotoDentro) { M._fotoDentro = true; yield* esperar(0.25); foto('dentro'); }
    poner(der(), new T.Vector3(0.25, 1.1, -0.2), false);
  }
  yield* hasta(() => M.resultado, 10);
  log('resultado ' + JSON.stringify(M.resultado) + ' · aciertos ' + a.E.aciertos);
  yield* esperar(0.4);
  foto('final' + n);
}

yield* partida(1);
// «Otra vez»: tocar la tarjeta con el dedo
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
yield* partida(2);
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
// salir a mitad: una partida nueva y abandonar() a los pocos segundos → terminar con gana:false
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado, 10);
  yield* esperar(3);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
