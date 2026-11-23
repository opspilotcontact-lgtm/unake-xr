// Bot del tiro al pato (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (buena): coge la escopeta con pellizco, apunta a patos concretos con adelanto y caída, falla a
// propósito de vez en cuando, recarga a mano (corcho de la cajita a la boca) y bajando la escopeta. Debe ganar.
// Partida 2 (mala), tras «Otra vez»: la coge con el puño, tira a Perico y a la Pompa y casi todo al techo. Debe perder.
const Z = new T.Vector3(0, 0, -1);
const SUJETA = new T.Vector3(0.16, 1.22, -0.3);
const fotos = new Set();
// el lanzador mira la petición cada 200 ms: se espera un poco antes de cambiar la escena
function* fotoUna(n, mano = der()) { if (fotos.has(n)) return; fotos.add(n); foto(n); yield* quieto(mano, 0.35); }

function* apuntar(dirFn, seg, pos = SUJETA) {
  const t0 = M.t;
  do { const d = dirFn(); if (d) der().quat.setFromUnitVectors(Z, d); poner(der(), pos, false); yield; } while (M.t - t0 < seg);
}
function* disparo() { poner(der(), SUJETA, true); yield; poner(der(), SUJETA, false); yield; }
function elegir(tipos) {
  const bs = M.tp.blancos().filter(b => tipos.includes(b.tipo) && Math.abs(b.pos.x) < 1.2);
  return bs.length ? bs[Math.floor(Math.random() * bs.length)] : null;
}
function* tiroA(b, seg = 0.2) {
  const t0 = M.t;
  yield* apuntar(() => M.tp.apuntarA(b.pos.clone().addScaledVector(b.vel, M.t - t0), b.vel, SUJETA), seg);
  yield* disparo();
}
function* alAire(dir) { yield* apuntar(() => dir.clone().normalize(), 0.12); yield* disparo(); }
function* recargaBajando() {
  der().quat.setFromUnitVectors(Z, new T.Vector3(0, -1, -0.25).normalize());
  yield* mover(der(), new T.Vector3(0.2, M.tp.H + 0.3, -0.3), 0.2, false);
  yield* hasta(() => M.tp.balas >= 6 || M.tp.fase === 'final', 4);
  log('recargada bajando: ' + M.tp.balas);
}
function* recargaAMano(n) {
  const antes = M.tp.balas;
  for (let i = 0; i < n; i++) {
    yield* mover(izq(), () => M.tp.caja(), 0.35, false);
    yield* quieto(izq(), 0.05, true);               // pellizco en la cajita: un corcho en la mano
    yield* mover(izq(), () => M.tp.boca(), 0.35, true);
    if (i === 0) yield* fotoUna('recarga-mano', izq());
    yield* quieto(izq(), 0.08, true);
    yield* quieto(izq(), 0.05, false);
  }
  yield* mover(izq(), new T.Vector3(-0.35, 1.0, -0.15), 0.2, false);
  log(`recarga a mano: ${antes} → ${M.tp.balas}`);
  if (M.tp.balas <= antes && M.tp.fase !== 'final') throw new Error('la recarga a mano no metió corchos');
}

function* coger(conPuno) {
  yield* hasta(() => M.tp && M.tp.fase === 'espera', 15);
  M.mirar(0, 1.6, 0, 0, -0.5);
  poner(izq(), new T.Vector3(-0.35, 1.0, -0.15), false);
  poner(der(), new T.Vector3(0.25, 1.15, -0.15), false);
  yield* quieto(der(), 0.6);
  yield* fotoUna(conPuno ? 'inicio-2' : 'inicio');
  yield* mover(der(), () => M.tp.empunadura(), 0.5, false, false);
  if (conPuno) yield* quieto(der(), 0.06, false, true); else yield* quieto(der(), 0.06, true);
  yield* mover(der(), SUJETA, 0.4, !conPuno, !!conPuno);
  yield* quieto(der(), 0.05, false, false);
  log('escopeta cogida (' + (conPuno ? 'puño' : 'pellizco') + '): ' + M.tp.llevada);
  if (!M.tp.llevada) throw new Error('no cogió la escopeta');
  M.mirar(0, 1.6, 0, 0, -0.06);
}

function* partida(buena) {
  yield* coger(!buena);
  let tiros = 0, recargas = 0, pericoHecho = false, pompaHecha = false;
  while (M.tp.fase !== 'final') {
    if (M.tp.fase !== 'ronda') { yield* apuntar(() => M.tp.haciaDelante(), 0.1); continue; }
    if (M.tp.balas === 0) {
      recargas++;
      if (recargas === 2) M.mirar(0, 1.6, 0, 0, -0.45);
      if (recargas % 2 === 0) yield* recargaAMano(buena ? 2 : 1);
      if (recargas === 2) { yield* mover(der(), new T.Vector3(0.2, M.tp.H + 0.3, -0.3), 0.2, false); yield* quieto(der(), 0.3); yield* fotoUna('recarga'); }
      yield* recargaBajando();
      if (recargas === 2) M.mirar(0, 1.6, 0, 0, -0.06);
      continue;
    }
    tiros++;
    let b = null;
    if (buena) {
      if (tiros % 8 === 0) { yield* alAire(new T.Vector3(0.4, 0.6, -1)); continue; } // fallo a propósito
      b = elegir(['oro']) || elegir(['pato']);
    } else {
      if (!pericoHecho && (b = elegir(['perico']))) pericoHecho = true;
      else if (!pompaHecha && (b = elegir(['pompa']))) pompaHecha = true;
      else if (tiros % 6 === 0) b = elegir(['pato']);
      else { yield* alAire(new T.Vector3((Math.random() - 0.5) * 0.8, 0.7, -1)); yield* apuntar(() => null, 0.25); continue; }
    }
    if (!b) { yield* apuntar(() => M.tp.haciaDelante(), 0.1); continue; }
    const antes = M.tp.aciertos, malosAntes = M.tp.malos;
    if (tiros === 2) yield* fotoUna(buena ? 'apuntando' : 'apuntando-2');
    yield* tiroA(b);
    yield* apuntar(() => null, 0.22);
    if (M.tp.aciertos > antes) yield* fotoUna(buena ? 'acierto' : 'acierto-2');
    if (M.tp.malos > malosAntes) { log('apuntaba a ' + b.tipo + ' y dio a un intruso (−150)'); yield* fotoUna('intruso-' + b.tipo); }
    if (M.tp.ronda === 2 && buena) yield* fotoUna('ronda2');
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${M.tp.disparos} disparos, ${M.tp.aciertos} aciertos, ${M.tp.malos} malos, ${M.tp.puntos} puntos`);
  yield* hasta(() => M.resultado, 10);
  yield* quieto(der(), 2.2);
  M.mirar(0, 1.6, 0, 0, -0.2);
  yield* quieto(der(), 0.3);
  yield* fotoUna(buena ? 'final' : 'final-2');
  log('resultado ' + JSON.stringify(M.resultado));
}

yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
const viejo = M.tp;
M.reiniciar();
yield* hasta(() => M.tp && M.tp !== viejo, 15);
yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
