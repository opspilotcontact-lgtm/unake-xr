// Bot de «El farol»: partida 1 la gana (coge el cubilete, lo agita, lo suelta para volcarlo, se acerca a mirarle la
// cara y comprueba que la gota SOLO se ve de cerca; decide con fichas y alguna vez levantándole el cubilete);
// partida 2 la pierde (no tira: tira Palicaso; y decide al revés). Prueba el «Otra vez» y abandonar() a mitad.
const LEJOS = [0, 1.6, 0], CERCA = [0, 1.62, -0.3];
M.mirar(...LEJOS, 0, -0.45);
const api = () => M.escena.getObjectByName('minijuego-farol')?.userData.api;
const REPOSO = new T.Vector3(0.16, 1.1, -0.2);
poner(der(), REPOSO.clone(), false);
poner(izq(), new T.Vector3(-0.2, 1.05, -0.2), false);
yield* quieto(der(), 0.2);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };

function* tirar(a) {
  const c = a.centroCubilete();
  yield* mover(der(), c.clone().add(new T.Vector3(0, 0.06, 0.05)), 0.25, false);
  yield* mover(der(), c, 0.12, false);
  yield* quieto(der(), 0.05, true);
  if (a.fase !== 'tira') throw new Error('fase rara al coger: ' + a.fase);
  // agitar: vaivén rápido
  const arriba = c.clone().add(new T.Vector3(0, 0.12, 0.03));
  yield* mover(der(), arriba, 0.15, true);
  for (let i = 0; i < 6; i++) yield* mover(der(), arriba.clone().add(new T.Vector3(i % 2 ? -0.07 : 0.07, 0, 0)), 0.09, true);
  yield* mover(der(), a.centroBarra().add(new T.Vector3(0.03, 0.1, 0)), 0.15, true);
  yield* quieto(der(), 0.05, false);   // soltar = volcar
  yield* mover(der(), REPOSO, 0.2, false);
  if (!['rueda', 'mira', 'decide'].includes(a.fase)) throw new Error('no se ha volcado: ' + a.fase);
}

function* decidirCon(a, creo, cubilete = false) {
  const n0 = a.E.resultados.length;
  if (cubilete) {
    const c = a.centroCubilete();
    yield* mover(der(), c.clone().add(new T.Vector3(0, 0.05, 0.06)), 0.25, false);
    yield* mover(der(), c, 0.1, false);
    yield* quieto(der(), 0.06, true);
  } else {
    const f = creo ? a.fichaCreo() : a.fichaFarol();
    yield* mover(der(), f.clone().add(new T.Vector3(0, 0.08, 0.05)), 0.25, false);
    yield* mover(der(), () => (creo ? a.fichaCreo() : a.fichaFarol()), 0.15, false);
  }
  yield* hasta(() => a.E.resultados.length > n0, 3);
  yield* quieto(der(), 0.05, false);
  yield* mover(der(), REPOSO, 0.2, false);
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  while (!M.resultado) {
    yield* hasta(() => a.fase === 'tira' || M.resultado, 12);
    if (M.resultado) break;
    const mano = a.E.mano;
    if (n === 1 && mano === 1) { yield* esperar(0.9); foto('demo'); }
    if (n === 1) yield* tirar(a);
    if (n === 1 && mano === 1) { yield* esperar(0.05); foto('rueda'); }
    if (n === 1 && mano === 2) a.E.forzarMiente = true, a.E.forzarTell = true; // para ver la pista de cerca
    yield* hasta(() => a.fase === 'decide' || M.resultado, n === 2 ? 25 : 8);
    if (M.resultado) break;
    if (n === 2 && mano === 1) log(`tiró ${a.E.quienTira === 'el' ? 'Palicaso (no has cogido el cubilete)' : 'el bot'}`);
    if (n === 1 && mano === 2) {
      // de lejos, cara de póker; de cerca, la gota
      yield* esperar(0.3);
      const lejos = a.gota();
      M.mirar(...CERCA, 0, -0.05); yield* esperar(0.4);
      const cerca = a.gota();
      foto('cerca'); yield* esperar(0.6);
      log(`miente: gota de lejos ${lejos.toFixed(2)} · de cerca ${cerca.toFixed(2)}`);
      if (lejos > 0.01 || cerca < 0.5) throw new Error('la gota no depende de la distancia');
      M.mirar(...LEJOS, 0, -0.45);
    }
    const verdad = !a.E.miente;
    const creo = n === 1 ? verdad : !verdad;
    yield* decidirCon(a, creo, n === 1 && !creo && mano % 3 === 0);
    const r = a.E.resultados[a.E.resultados.length - 1];
    log(`partida ${n} · mano ${mano}: canta ${a.E.canta} · dados ${a.E.d.join('+')} · ${a.E.miente ? 'miente' : 'verdad'} · ${r.como} · ${r.acierto ? 'ACIERTO' : 'fallo'} · ${a.E.puntos} pts`);
    if (n === 1 && mano === 1) { yield* esperar(0.4); foto('destapa'); log(`llamadas de dibujo (escena entera, con la casa de prueba): ${M.renderer.info.render.calls}`); }
    if (a.E.d.some(v => v < 1 || v > 6)) throw new Error('dado raro');
  }
  yield* hasta(() => M.resultado, 6);
  log('resultado ' + JSON.stringify(M.resultado));
  if (n === 1 && !M.resultado.gana) throw new Error('la partida 1 debía ganarse');
  if (n === 2 && M.resultado.gana) throw new Error('la partida 2 debía perderse');
  yield* esperar(0.5);
  foto('final' + n);
}

yield* partida(1);
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
poner(der(), REPOSO.clone(), false);
yield* partida(2);
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado, 10);
  yield* esperar(4);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
