// Bot de «El palo»: partida 1 → lanza virutas con gestos rápidos de la mano derecha hacia Perico, para las pipas
// con la mano izquierda y esquiva los picados con un paso al lado (mueve la cabeza) → recupera el palo y gana.
// «Otra vez» tocando la tarjeta. Partida 2: no hace nada y se come las pipas → pierde. Luego abandonar() → gana:false.
const ALTO = 1.6;
M.mirar(0, ALTO, 0, 0, -0.05);
const api = () => M.escena.getObjectByName('minijuego-palo')?.userData.api;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const R0 = new T.Vector3(0.22, ALTO - 0.22, -0.08), RI = new T.Vector3(-0.25, ALTO - 0.3, -0.2);
poner(der(), R0.clone(), false);
poner(izq(), RI.clone(), false);

function* jugar(a, modo, max) {
  const t0 = M.t; let ciclo = 0, cabX = 0, fotoPicado = false;
  while (!a.acabado) {
    if (M.t - t0 > max) throw new Error('timeout ' + modo + ' · hp ' + a.est.hp.toFixed(1) + ' vidas ' + a.est.vidas);
    const dt = 0.016;
    if (modo === 'ganar') {
      // mano derecha: atrás junto al hombro (0,3 s) y empujón hacia delante (0,13 s)
      ciclo += dt;
      const T1 = 0.45, T2 = 0.14;
      if (ciclo > T1 + T2) ciclo = 0;
      const k = ciclo < T1 ? ciclo / T1 : (ciclo - T1) / T2;
      const lejos = new T.Vector3(0.18, ALTO - 0.08, -0.55);
      poner(der(), ciclo < T1 ? lejos.clone().lerp(R0, Math.min(1, k * 1.5)) : R0.clone().lerp(lejos, k), false);
      // mano izquierda: a la pipa que más cerca viene de tu cara
      let mejor = null, dm = 0.9;
      const cab = a.cab;
      for (const p of a.pipas) { const d = p.p.distanceTo(cab); if (d < dm && p.p.z < cab.z) { dm = d; mejor = p; } }
      const metaI = mejor ? a.aMundo(mejor.p.clone().addScaledVector(mejor.v, 0.05)) : RI.clone().add(new T.Vector3(cabX, 0, 0));
      const mi = izq(), d = metaI.clone().sub(mi.pos), Lm = d.length(), vmax = 3 * dt;
      poner(mi, Lm > vmax ? mi.pos.clone().addScaledVector(d, vmax / Lm) : metaI, false);
      // picado: un paso al lado
      const pic = a.est.picado;
      const quiero = pic && pic.fase !== 'vuelve' ? 0.5 : 0;
      cabX += Math.sign(quiero - cabX) * Math.min(Math.abs(quiero - cabX), 1.2 * dt);
      M.mirar(cabX, ALTO, 0, 0, -0.05);
      if (pic && pic.fase === 'aviso' && !fotoPicado) { fotoPicado = true; foto('picado'); }
    }
    yield;
  }
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  yield* hasta(() => a.est.activo, 10);
  if (n === 1) foto('inicio');
  if (n === 1) {
    // a mitad: foto y llamadas de dibujo
    const it = jugar(a, 'ganar', 150);
    let tomada = false;
    while (true) {
      const r = it.next(); if (r.done) break;
      if (!tomada && a.est.hp < a.est.vidaMax * 0.5 && a.virutas.length) { tomada = true; log('llamadas de dibujo (en juego): ' + M.renderer.info.render.calls); foto('lanzando'); }
      yield;
    }
  } else yield* jugar(a, 'perder', 150);
  yield* hasta(() => M.resultado, 6);
  log(`partida ${n}: ` + JSON.stringify(M.resultado) + ` · hp ${a.est.hp.toFixed(1)} · vidas ${a.est.vidas} · paradas ${a.est.paradas} · lanzados ${a.est.lanzados} · ${a.est.tiempo.toFixed(1)} s`);
  M.mirar(0, ALTO, 0, 0, -0.05);
  yield* esperar(0.4); foto('final' + n);
}

yield* partida(1);
if (!M.resultado.gana) throw new Error('la partida 1 debía ganarse');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
poner(der(), R0.clone(), false); poner(izq(), RI.clone(), false);
yield* partida(2);
if (M.resultado.gana !== false) throw new Error('la partida 2 debía perderse');
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado, 10);
  yield* esperar(5);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
