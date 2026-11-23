// Bot de «En su punto» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (buena): mirando hacia arriba, pellizca la válvula con la derecha para llevarla a su punto (con
// histéresis, como haría una persona), con la izquierda la para en las rachas, la devuelve al centro y deshace
// las bocanadas de Palicaso; baja los brazos en los respiros. Debe ganar (y salir el «Yo no, que exploto»).
// «Otra vez» tocando la tarjeta. Partida 2 (mala): no le suelta aire nunca → ¡plop! Debe perder.
const api = () => M.escena.getObjectByName('minijuego-ensupunto')?.userData.api;
const REPOSO_D = new T.Vector3(0.25, 1.1, -0.2), REPOSO_I = new T.Vector3(-0.25, 1.1, -0.2);
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return false; fotos.add(n); foto(n); return true; };
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let tAntes = M.t;
// mover una mano hacia `meta` sin teletransportarla (la velocidad de la mano cuenta al empujar)
function hacia(m, meta, vmax, pinza) {
  const dt = Math.max(0.001, M.t - tAntes);
  const d = meta.clone().sub(m.pos), l = d.length(), paso = vmax * dt;
  poner(m, l > paso ? m.pos.clone().addScaledVector(d, paso / l) : meta.clone(), pinza);
}
const mirarArriba = () => M.mirar(0, 1.6, 0, 0, 0.55);

poner(der(), REPOSO_D, false); poner(izq(), REPOSO_I, false);

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  mirarArriba();
  log(`techo: ${a.techoReal == null ? 'no hay (por defecto)' : a.techoReal.toFixed(2)} · coronilla a ${a.tope.toFixed(2)} m`);
  yield* hasta(() => a.fase === 'juego', 10);
  if (buena) { foto('inicio'); yield* esperar(0.4); }
  let pellizca = false, rondaAntes = 1, tAviso = 0, devolviendo = false, rodeo = { lado: 0 };
  while (!M.resultado) {
    const E = a.E, c = a.centro(), R = a.radio, v = a.valvula();
    if (!buena) {
      hacia(der(), REPOSO_D, 1.5, false); hacia(izq(), REPOSO_I, 1.5, false);
      if (E.s > 0.9) fotoUna('a-punto');
      if (E.fase === 'fin') { yield* esperar(0.35); fotoUna('plop'); }
      tAntes = M.t; yield; continue;
    }
    if (E.fase === 'respiro') {
      pellizca = false;
      hacia(der(), REPOSO_D, 1.5, false); hacia(izq(), REPOSO_I, 1.5, false);
      if (fotoUna('respiro')) log(`respiro tras la ronda ${E.ronda}: ${Math.round(E.puntos)} pts, racha ${E.racha.toFixed(1)} s`);
      tAntes = M.t; yield; continue;
    }
    if (E.fase !== 'juego') { hacia(der(), REPOSO_D, 1.5, false); hacia(izq(), REPOSO_I, 1.5, false); tAntes = M.t; yield; continue; }
    if (E.ronda !== rondaAntes) { rondaAntes = E.ronda; log(`ronda ${E.ronda}: punto ${E.P.centro}±${E.P.mitad}, gente ${E.P.gente}, alfileres ${E.P.cactus}, Palicaso ${E.P.ronda}`); }
    // derecha: la válvula, con histéresis
    if (!pellizca && E.s > E.c + E.w * 0.3) pellizca = true;
    if (pellizca && E.s < E.c - E.w * 0.3) pellizca = false;
    if (pellizca) {
      const cerca = der().pos.distanceTo(v) < 0.06;
      hacia(der(), v, 2.2, cerca);
      if (cerca && a.pinzando && fotoUna('valvula')) log('pellizcando la válvula: sale el hilo de humo');
    } else hacia(der(), v.clone().add(new T.Vector3(0.14, -0.14, 0.1)), 2.2, false);
    // izquierda: bocanadas, rachas y devolverla al centro (por fuera, empujando hacia dentro)
    const bs = a.bocanadas().filter(b => b.distanceTo(c) < 1.1).sort((p, q) => p.distanceTo(c) - q.distanceTo(c));
    const g = a.gust, L = a.M.L;
    const abajo = c.clone().add(new T.Vector3(0, -R - 0.32, 0)).addScaledVector(a.der, -0.06).addScaledVector(a.fwd, -0.08); // espera ahí, debajo
    let metaI = abajo, vI = 2.5, lado = 0;
    if (bs.length && !g) { metaI = bs[0]; if (fotoUna('bocanada')) log('bocanada de Palicaso hacia ella: manotazo'); }
    else if (g) {
      // a sotavento, apoyada en ella: la sujeta contra la racha (si ya está del otro lado, no la toca)
      lado = g.dir;
      metaI = c.clone().addScaledVector(a.der, lado * (L * lado < -0.12 ? R + 0.12 : R + 0.01)).add(new T.Vector3(0, -0.04, 0));
      if (g.activa && fotoUna('racha')) log('racha: la izquierda la sujeta');
    } else if (Math.abs(L) > (devolviendo ? 0.06 : 0.15)) {
      // devolverla despacio, apoyando la mano por fuera (si la lanzas, se va contra los alfileres del otro lado)
      lado = Math.sign(L);
      metaI = c.clone().addScaledVector(a.der, lado * (R + 0.02)).add(new T.Vector3(0, -0.04, 0));
      vI = 0.7;
    }
    devolviendo = !g && !bs.length && lado !== 0;
    if (lado) {
      // nunca cruzar la burbuja: se va por debajo (baja, va de lado y sube por fuera)
      const h = izq().pos.clone().sub(c), ladoMano = h.dot(a.der) * lado;
      if (rodeo.lado !== lado) rodeo = { lado, fase: ladoMano >= R + 0.03 ? 'subir' : 'bajar' };
      if (rodeo.fase === 'subir' && ladoMano < R * 0.4) rodeo.fase = 'bajar';
      if (rodeo.fase === 'bajar') { if (h.y < -R - 0.2) rodeo.fase = 'lado'; else { metaI = izq().pos.clone().setY(c.y - R - 0.32); vI = 2.5; } }
      if (rodeo.fase === 'lado') {
        if (ladoMano > R + 0.1) rodeo.fase = 'subir';
        else { metaI = c.clone().addScaledVector(a.der, lado * (R + 0.18)).setY(c.y - R - 0.32); vI = 2.5; }
      }
    } else rodeo = { lado: 0 };
    hacia(izq(), metaI, vI, false);
    if (E.ronda === 3 && E.tRonda > 2 && fotoUna('ronda3')) log('ronda 3 con Palicaso');
    if (M.t - tAviso > 6) { tAviso = M.t; log(`ronda ${E.ronda} · tamaño ${E.s.toFixed(2)} (punto ${(E.c - E.w).toFixed(2)}-${(E.c + E.w).toFixed(2)}) · lateral ${a.M.L.toFixed(2)} · ${E.tBanda.toFixed(1)}/${a.objetivo} s · ${Math.round(E.puntos)} pts`); }
    tAntes = M.t; yield;
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · motivo ${a.E.motivo} · válvula ${a.E.pinchos} veces, empujones ${a.E.empujones}, bocanadas deshechas ${a.E.bocanadasDeshechas}, risas ${a.E.risas}, rachas ${a.E.rachas}`);
  if (buena) {
    poner(der(), REPOSO_D, false); poner(izq(), REPOSO_I, false);
    yield* esperar(0.6); foto('ganada');
    yield* esperar(2.6); foto('yo-no');
    yield* esperar(0.8);
    M.mirar(0, 1.6, 0, 0, -0.1); yield* esperar(0.4); foto('final1');
  } else {
    yield* esperar(1.0); M.mirar(0, 1.6, 0, 0, -0.1); yield* esperar(0.4); foto('final2');
  }
}

yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
// «Otra vez»: tocar la tarjeta con el dedo
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
for (let t = 0; t < 0.4; t += 0.016) { hacia(der(), otra.position.clone(), 2, false); tAntes = M.t; yield; }
poner(der(), otra.position.clone(), false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
if (api().E.motivo !== 'plop') throw new Error('la mala tenía que acabar en plop: ' + api().E.motivo);
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
log('FIN OK');
