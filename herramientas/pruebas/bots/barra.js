// Bot de «Noche de barra»: partida 1 la gana (coge del estante con un pellizco, lo lleva a la mano de quien lo
// pide, echa a Puky de un empujón y se equivoca una vez adrede); partida 2 la pierde (no sirve a nadie: tres
// enfadados). Prueba el «Otra vez» y abandonar() a mitad.
M.mirar(0, 1.6, 0, 0, -0.35);
const api = () => M.escena.getObjectByName('minijuego-barra')?.userData.api;
const REPOSO_D = new T.Vector3(0.18, 1.12, -0.25), REPOSO_I = new T.Vector3(-0.18, 1.12, -0.25);
poner(der(), REPOSO_D.clone(), false);
poner(izq(), REPOSO_I.clone(), false);
yield* quieto(der(), 0.2);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };

function* servirUno(a, s, prod) {
  const m = prod < 2 ? izq() : der();
  const e = a.estante(prod);
  yield* mover(m, e.clone().add(new T.Vector3(0, 0.05, 0.03)), 0.22, false);
  yield* mover(m, e, 0.1, false);
  yield* quieto(m, 0.05, true);
  const n0 = a.E.servidos, f0 = a.E.fallos;
  yield* mover(m, () => a.entrega(s.i), 0.38, true);
  yield* hasta(() => a.E.servidos > n0 || a.E.fallos > f0 || !s.cliente || a.fase !== 'juego', 2);
  yield* quieto(m, 0.05, false);
  yield* mover(m, prod < 2 ? REPOSO_I : REPOSO_D, 0.18, false);
}

function* empujarPuky(a, s) {
  const p = a.puky(s.i); if (!p) return;
  const m = der();
  const lado = new T.Vector3(0.28, 0, 0.05);
  yield* mover(m, p.clone().add(lado), 0.25, false, true);
  const n0 = a.E.echados;
  yield* mover(m, () => (a.puky(s.i) || p).clone().sub(lado), 0.12, false, true);
  yield* quieto(m, 0.05, false, false);
  log(a.E.echados > n0 ? 'Puky echado de un empujón' : 'el empujón no ha echado a Puky');
  yield* mover(m, REPOSO_D, 0.2, false, false);
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  if (n === 1) { yield* esperar(1.4); foto('demo'); }
  yield* hasta(() => a.fase === 'juego', 10);
  let errorHecho = false, pukyForzado = false, fotos = 0;
  if (n === 2) {
    // sin servir a nadie: se enfadan tres. Una entrega equivocada para ver el rechazo.
    yield* hasta(() => a.sitios.some(s => s.cliente?.estado === 'espera' && !s.cliente.puky), 5);
    const s = a.sitios.find(s => s.cliente?.estado === 'espera' && !s.cliente.puky);
    const f0 = a.E.fallos;
    yield* servirUno(a, s, (s.cliente.pedido + 1) % 4);
    if (a.E.fallos !== f0 + 1) throw new Error('la entrega equivocada no ha contado como fallo');
    log('entrega equivocada rechazada');
    yield* hasta(() => M.resultado, 70);
  } else {
    while (a.fase === 'juego') {
      if (!pukyForzado && M.t > 0 && a.E.servidos >= 3) { pukyForzado = true; a.forzar('puky'); }
      const puky = a.sitios.find(s => s.cliente?.puky && s.cliente.estado === 'espera');
      if (puky) {
        if (fotos === 1) { foto('puky'); fotos++; yield* esperar(0.2); }
        yield* empujarPuky(a, puky); continue;
      }
      const espera = a.sitios.filter(s => s.cliente && !s.cliente.puky && s.cliente.estado === 'espera').sort((x, y) => x.cliente.t - y.cliente.t);
      if (!espera.length) { yield; continue; }
      const s = espera[0];
      let prod = s.cliente.pedido;
      if (!errorHecho && a.E.servidos === 5) { errorHecho = true; prod = (prod + 1) % 4; }
      yield* servirUno(a, s, prod);
      if (fotos === 0 && a.E.servidos >= 2) { foto('juego'); fotos++; log(`llamadas de dibujo (escena entera, con la casa de prueba): ${M.renderer.info.render.calls} · fusionadas ${a.llamadas()}`); }
      if (a.E.servidos === 8 && fotos === 2) { M.mirar(0, 1.6, 0, 0.9, -0.3); foto('estante'); yield* esperar(0.3); M.mirar(0, 1.6, 0, 0, -0.35); fotos++; }
    }
    yield* hasta(() => M.resultado, 5);
  }
  log(`partida ${n}: servidos ${a.E.servidos} · echados ${a.E.echados} · fallos ${a.E.fallos} · vidas ${a.E.vidas} · ${a.E.puntos} pts`);
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
poner(der(), REPOSO_D.clone(), false);
yield* partida(2);
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
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
