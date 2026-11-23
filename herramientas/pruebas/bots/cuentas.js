// Bot de «La caja no cuadra»: dos partidas enteras. En la primera clasifica con los tres gestos (coger y dejar,
// lanzar y manotazo), se equivoca de bandeja dos veces adrede, rescata una cosa que deja tirada en la mesa y gana.
// En la segunda acierta un par, se equivoca a propósito y deja que la cinta se lo lleve todo hasta el bajón: pierde.
// Entre medias, «Otra vez» tocando la tarjeta.
M.mirar(0, 1.6, 0, 0, -0.75);
const api = () => M.escena.getObjectByName('minijuego-cuentas')?.userData.api;
const REPOSO = new T.Vector3(0.22, 1.05, -0.2);
const ARRIBA = y => new T.Vector3(0, y, 0);
poner(izq(), new T.Vector3(-0.35, 1.2, 0.05), false);
poner(der(), REPOSO.clone(), false);
yield* quieto(der(), 0.3);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
function* fotoUna(n, mantener = 0.35) { if (fotos.has(n)) return; fotos.add(n); foto(n); yield* quieto(der(), mantener); }

// lo que va primero en la cinta (lo más cerca del final)
function siguiente(a) {
  return a.items.filter(i => i.estado === 'cinta' && i.x > a.cinta.x0 + 0.07).sort((p, q) => q.x - p.x)[0] || null;
}
const enCinta = a => a.items.filter(i => i.estado === 'cinta').length;

function* coger(it) {
  yield* mover(der(), () => it.m.position.clone().add(ARRIBA(0.12)), 0.16, false);
  yield* mover(der(), () => it.m.position.clone(), 0.09, false);
  yield* quieto(der(), 0.04, true);
  return !!it.c.cogido;
}
function* dejar(a, it, b) {
  if (!(yield* coger(it))) return false;
  yield* mover(der(), a.centroBandeja(b).add(ARRIBA(0.1)), 0.22, true);
  yield* quieto(der(), 0.12, true);
  yield* quieto(der(), 0.03, false);
  return true;
}
function* lanzar(a, it, b) {
  if (!(yield* coger(it))) return false;
  const p = it.m.position.clone(), c = a.centroBandeja(b);
  const dir = new T.Vector3(c.x - p.x, 0, c.z - p.z).normalize().add(ARRIBA(0.5)).normalize();
  const p0 = der().pos.clone(), t0 = M.t;
  while (true) {
    const tt = M.t - t0, suelta = tt >= 0.1;
    poner(der(), p0.clone().addScaledVector(dir, 1.6 * tt), !suelta);
    yield;
    if (suelta) break;
  }
  return true;
}
function* manotazo(a, it, b, fotoN = null) {
  const dirF = () => { const c = a.centroBandeja(b), p = it.m.position; return new T.Vector3(c.x - p.x, 0, c.z - p.z).normalize(); };
  yield* mover(der(), () => it.m.position.clone().addScaledVector(dirF(), -0.11).add(ARRIBA(0.16)), 0.15, false);
  yield* mover(der(), () => it.m.position.clone().addScaledVector(dirF(), -0.11).add(ARRIBA(0.01)), 0.08, false);
  const d = dirF(), p0 = der().pos.clone();
  yield* mover(der(), p0.clone().addScaledVector(d, 0.32), 0.09, false);
  if (fotoN) { yield* fotoUna(fotoN, 0.4); }
  yield* mover(der(), der().pos.clone().add(ARRIBA(0.15)), 0.1, false);
  return true;
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  yield* hasta(() => a.fase === 'juego', 10);
  if (n === 1) {
    yield* esperar(2.2); yield* fotoUna('inicio');
    M.mirar(0.05, 1.22, -0.05, 0, -0.62); yield* fotoUna('cerca', 0.4); M.mirar(0, 1.6, 0, 0, -0.75);
  }
  let k = 0, rescate = false, derrite = false;
  while (a.fase === 'juego') {
    if (n === 2 && a.E.bajon >= 3 && !derrite) { derrite = true; yield* esperar(0.4); yield* fotoUna('derrite'); }
    const it = siguiente(a);
    if (!it || (n === 2 && k >= 5)) { poner(der(), REPOSO.clone(), false); yield; continue; }
    k++;
    const bien = it.tipo.destino, mal = (bien + 1) % 3;
    if (n === 1) {
      if (k === 5 && !rescate) {
        // la deja tirada en la mesa y la rescata antes de que cuente como caída
        if (!(yield* coger(it))) continue;
        yield* mover(der(), a.mundo(0.52, 0.08, 0.15), 0.2, true);
        yield* quieto(der(), 0.1, true); yield* quieto(der(), 0.03, false);
        yield* hasta(() => it.estado === 'mesa' || it.estado === 'fin', 2);
        if (it.estado !== 'mesa') throw new Error('la cosa soltada en la mesa no se ha quedado en la mesa: ' + it.estado);
        yield* esperar(0.15); yield* fotoUna('rescate', 0.2);
        yield* dejar(a, it, bien);
        yield* hasta(() => it.estado === 'fin', 2);
        rescate = true;
        log('rescate de la mesa: ' + JSON.stringify(a.E.resultados.at(-1)) + ' · bajón ' + a.E.bajon);
        if (a.E.bajon) throw new Error('el rescate ha contado como fallo');
        continue;
      }
      // la hucha solo sale con nivel 3+: aquí se fuerza una para probarla
      if (k === 9) { a.forzar('hucha'); }
      if (it.clave === 'hucha') { yield* fotoUna('hucha', 0.4); }
      const destino = (k === 7 || k === 19) && it.clave !== 'hucha' ? mal : bien;
      const modo = enCinta(a) >= 3 || k % 3 === 0 ? 'manotazo' : k % 3 === 1 ? 'dejar' : 'lanzar';
      if (modo === 'manotazo') yield* manotazo(a, it, destino, k >= 6 ? 'manotazo' : null);
      else if (modo === 'dejar') yield* dejar(a, it, destino);
      else yield* lanzar(a, it, destino);
      if (k === 2) { yield* esperar(0.2); M.mirar(0.9, 1.3, -0.45, Math.PI / 2, -0.4); yield* fotoUna('lado', 0.4); M.mirar(0, 1.6, 0, 0, -0.75); }
    } else {
      const destino = k <= 2 ? bien : mal;
      if (k <= 2) yield* manotazo(a, it, destino); else yield* dejar(a, it, destino);
    }
    poner(der(), der().pos.clone(), false);
  }
  const E = a.E, r = E.resultados;
  const cuenta = c => r.filter(x => x.como === c && x.bien).length;
  log(`partida ${n}: ${E.puntos} pts · ${E.aciertos} aciertos (mano ${cuenta('mano')}, lanzadas ${cuenta('lanzada')}, manotazos ${cuenta('manotazo')}) · ${r.filter(x => !x.bien).length} a la bandeja mala · bajón ${E.bajon} · hucha ${E.aHucha}`);
  log('a la mala: ' + JSON.stringify(r.filter(x => !x.bien)));
  yield* hasta(() => M.resultado, 10);
  log('resultado ' + JSON.stringify(M.resultado));
  yield* esperar(1.9);
  M.mirar(0, 1.6, 0, 0, -0.3);
  yield* fotoUna('final' + n, 0.4);
}

yield* partida(1);
if (!M.resultado.gana) throw new Error('la partida buena no ha ganado');
if (api().E.resultados.filter(x => !x.bien).length < 2) throw new Error('no se ha equivocado de bandeja');
if (!api().E.resultados.some(x => x.clave === 'hucha' && x.bien)) throw new Error('la hucha no ha llegado a su bandeja');
// «Otra vez»: tocar la tarjeta con el dedo
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
M.mirar(0, 1.6, 0, 0, -0.75);
yield* partida(2);
if (M.resultado.gana) throw new Error('la partida mala ha ganado');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
log('FIN OK');
