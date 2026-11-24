// Bot de las casetas (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): noria sin coger el volante (se vuelca tres veces), martillo con golpes flojos y uno tarde, y
//   «Salir de la feria» → terminar con gana:false.
// Partida 2 («Otra vez»): noria bien llevada con las dos manos (y frenando con el puño) → ficha; sale a medias.
// Partida 3 («Otra vez»): la ficha de la noria sigue guardada; martillo con golpes secos en lo verde → ficha;
//   tiro al pato (el nativo, montado dentro) → ficha; con las tres se cierra la feria → gana:true.
const Z = new T.Vector3(0, 0, -1);
const fotos = new Set();
const llamadas = {};
function* fotoUna(n) { if (fotos.has(n)) return; fotos.add(n); foto(n); yield* quieto(der(), 0.35); }
const medir = n => { const c = M.renderer.info.render.calls; llamadas[n] = Math.max(llamadas[n] || 0, c); };
const REPOSO_D = new T.Vector3(0.28, 1.05, -0.12), REPOSO_I = new T.Vector3(-0.28, 1.05, -0.12);
function* manosAbajo() { poner(izq(), REPOSO_I, false, false); yield* mover(der(), REPOSO_D, 0.25, false, false); }

function* tocar(k) {
  yield* hasta(() => M.cas && M.cas.modo === 'tablon', 20);
  yield* quieto(der(), 0.7);
  const it = M.cas.item(k);
  const delante = it.pos.clone().addScaledVector(it.normal, 0.1);
  yield* mover(der(), delante, 0.3, false);
  yield* mover(der(), it.pos.clone().addScaledVector(it.normal, -0.025), 0.2, false);
  yield* mover(der(), delante, 0.15, false);
  log('toca ' + k + ' → ' + M.cas.modo);
}

// ---------- noria ----------
function* noriaMala() {
  yield* tocar('noria');
  if (M.cas.modo !== 'noria') throw new Error('no entró en la noria');
  yield* manosAbajo();
  M.mirar(0, 1.6, 0, 0, -0.55);
  yield* quieto(der(), 1);
  yield* fotoUna('noria-espera');
  let vidas = 3;
  while (M.cas.modo === 'noria') {
    const n = M.cas.noria;
    medir('noria');
    if (n && n.vidas < vidas) { vidas = n.vidas; if (vidas === 2) yield* fotoUna('noria-vuelco'); }
    yield* quieto(der(), 0.1);
  }
  log('noria mala: vidas ' + vidas + ', fichas ' + JSON.stringify(M.cas.fichas));
  if (M.cas.fichas.noria) throw new Error('la noria mala dio ficha');
}
function* noriaBuena() {
  yield* tocar('noria');
  if (M.cas.modo !== 'noria') throw new Error('no entró en la noria');
  M.mirar(0, 1.6, 0, 0, -0.55);
  // coger las dos asas con pellizco
  const asaI = M.cas.noria.asa(-1), asaD = M.cas.noria.asa(1);
  poner(izq(), REPOSO_I, false); poner(der(), REPOSO_D, false);
  yield* mover(izq(), asaI, 0.3, false);
  yield* quieto(izq(), 0.05, true);
  yield* mover(der(), asaD, 0.3, false);
  yield* quieto(der(), 0.05, true);
  log('asas cogidas: ' + M.cas.noria.asas);
  if (M.cas.noria.asas < 2) throw new Error('no cogió las dos asas');
  let frenos = 0, peor = 0, fotoT = 0;
  while (M.cas.modo === 'noria' && M.cas.noria && M.cas.noria.vivo) {
    const n = M.cas.noria;
    medir('noria');
    peor = Math.max(peor, Math.abs(n.phi));
    const u = Math.max(-1, Math.min(1, -(0.1 * n.phi + 0.04 * n.om)));
    // frena con el puño si se embala, y una vez a propósito para probar el freno
    const frena = (Math.abs(n.om) > 45 && n.phi * n.om > 0) || (n.t > 12 && n.t < 12.6);
    if (n.frenando) frenos++; // fotogramas frenando de verdad
    const d = u * 0.07;
    poner(izq(), asaI.clone().setY(asaI.y + d), true, frena);
    poner(der(), asaD.clone().setY(asaD.y - d), true, false);
    if (n.t > 26 && !fotoT) { fotoT = 1; foto('noria'); }
    if (n.frenando) foto('noria-freno');
    yield;
  }
  if (!frenos) throw new Error('el freno (puño) no frenó nunca');
  log(`noria buena: peor ${peor.toFixed(1)}°, frenos ${frenos}, fichas ${JSON.stringify(M.cas.fichas)}`);
  yield* manosAbajo();
  yield* hasta(() => M.cas.modo === 'tablon', 8);
  if (!M.cas.fichas.noria) throw new Error('la noria buena no dio ficha');
}

// ---------- martillo ----------
function* cogerMazo() {
  M.mirar(0, 1.6, 0, 0, -0.6);
  yield* mover(der(), () => M.cas.martillo.mango(), 0.35, false);
  yield* quieto(der(), 0.05, true);
  yield* quieto(der(), 0.1, true);
  if (!M.cas.martillo.cogido) throw new Error('no cogió el mazo');
  log('mazo cogido');
}
// mano en vertical sobre la base (el mazo va tumbado: cabeza 0,4 m delante del puño)
function sobreBase(alto) { const b = M.cas.martillo.base(); const c = M.cas.martillo.cara(); const mano = der().pos; return mano.clone().add(b.clone().sub(c)).add(new T.Vector3(0, alto, 0)); }
function* golpe(seco) {
  const arriba = sobreBase(0.32);
  const abajo = arriba.clone().add(new T.Vector3(0, -0.36, 0));
  if (seco) yield* mover(der(), abajo, 0.08, true); else yield* mover(der(), abajo, 0.55, true);
  yield* quieto(der(), 0.12, true);
  yield* mover(der(), arriba, 0.3, true);
}
function* martillo(bueno) {
  yield* tocar('martillo');
  if (M.cas.modo !== 'martillo') throw new Error('no entró en el martillo');
  yield* cogerMazo();
  yield* mover(der(), sobreBase(0.32), 0.3, true);
  yield* fotoUna(bueno ? 'martillo' : 'martillo-mal');
  let golpes = 0;
  while (M.cas.modo === 'martillo' && M.cas.martillo) {
    const m = M.cas.martillo;
    medir('martillo');
    if (m.estado === 'fin') { yield* quieto(der(), 0.1, true); continue; }
    if (m.estado !== 'corre') { yield* quieto(der(), 0.05, true); continue; }
    if (!bueno && m.i === 1) { yield* quieto(der(), 0.1, true); continue; } // se le pasa: «tarde»
    if (bueno ? m.pos >= m.lo + 0.04 : m.pos > 0.5) {
      golpes++;
      const antes = m.campanas;
      yield* golpe(bueno);
      if (M.cas.martillo && M.cas.martillo.campanas > antes) yield* fotoUna('campana');
      if (m.regla === 'ciegas') yield* fotoUna('ciegas');
      continue;
    }
    if (m.regla === 'ciegas' && m.t > 0.6) foto('lona');
    yield* quieto(der(), 0.016, true);
  }
  log(`martillo ${bueno ? 'bueno' : 'malo'}: golpes ${golpes} ${JSON.stringify(M.casGolpes)} fichas ${JSON.stringify(M.cas.fichas)}`);
  M.casGolpes = [];
  yield* manosAbajo();
  yield* hasta(() => M.cas.modo === 'tablon', 8);
  if (bueno && !M.cas.fichas.martillo) throw new Error('el martillo bueno no dio ficha');
  if (!bueno && M.cas.fichas.martillo) throw new Error('el martillo malo dio ficha');
}

// ---------- tiro (el nativo, montado dentro) ----------
const SUJETA = new T.Vector3(0.16, 1.22, -0.3);
function* apuntar(dirFn, seg, pos = SUJETA) {
  const t0 = M.t;
  do { const d = dirFn(); if (d) der().quat.setFromUnitVectors(Z, d); poner(der(), pos, false); medir('tiro'); yield; } while (M.t - t0 < seg);
}
function* disparo() { poner(der(), SUJETA, true); yield; poner(der(), SUJETA, false); yield; }
function elegir() {
  const bs = M.tp.blancos().filter(b => (b.tipo === 'oro' || b.tipo === 'pato') && Math.abs(b.pos.x) < 1.2);
  return bs.find(b => b.tipo === 'oro') || (bs.length ? bs[Math.floor(Math.random() * bs.length)] : null);
}
function* tiro() {
  yield* tocar('tiro');
  yield* hasta(() => M.tp && M.tp.fase === 'espera', 15);
  M.mirar(0, 1.6, 0, 0, -0.5);
  yield* quieto(der(), 0.4);
  yield* fotoUna('tiro');
  yield* mover(der(), () => M.tp.empunadura(), 0.5, false);
  yield* quieto(der(), 0.06, true);
  yield* mover(der(), SUJETA, 0.4, true);
  yield* quieto(der(), 0.05, false);
  if (!M.tp.llevada) throw new Error('no cogió la escopeta');
  M.mirar(0, 1.6, 0, 0, -0.06);
  while (M.tp && M.tp.fase !== 'final') {
    if (M.tp.fase !== 'ronda') { yield* apuntar(() => M.tp.haciaDelante(), 0.1); continue; }
    if (M.tp.balas === 0) {
      der().quat.setFromUnitVectors(Z, new T.Vector3(0, -1, -0.25).normalize());
      yield* mover(der(), new T.Vector3(0.2, M.tp.H + 0.3, -0.3), 0.2, false);
      yield* hasta(() => !M.tp || M.tp.balas >= 6 || M.tp.fase === 'final', 4);
      continue;
    }
    const b = elegir();
    if (!b) { yield* apuntar(() => M.tp.haciaDelante(), 0.1); continue; }
    const t0 = M.t;
    yield* apuntar(() => M.tp.apuntarA(b.pos.clone().addScaledVector(b.vel, M.t - t0), b.vel, SUJETA), 0.2);
    yield* disparo();
    yield* apuntar(() => null, 0.22);
  }
  log(`tiro: ${M.tp?.puntos} puntos`);
  yield* manosAbajo();
  yield* hasta(() => M.cas.modo === 'tablon' || M.cas.modo === 'fin', 12);
  log('tras el tiro: modo ' + M.cas.modo + ' fichas ' + JSON.stringify(M.cas.fichas));
}

// ======================================================================
M.mirar(0, 1.6, 0, 0, -0.35);
yield* hasta(() => M.cas && M.cas.modo === 'tablon', 20);
yield* manosAbajo();
yield* quieto(der(), 1.2);
medir('tablon');
yield* fotoUna('tablon');

// --- partida 1: mala ---
yield* noriaMala();
yield* martillo(false);
yield* tocar('salir');
yield* hasta(() => M.resultado, 6);
log('partida 1: ' + JSON.stringify(M.resultado));
if (M.resultado.gana) throw new Error('la partida mala ganó');
yield* quieto(der(), 2.2);
yield* fotoUna('final-1');

// --- partida 2: noria y fuera ---
let viejo = M.cas;
M.reiniciar();
yield* hasta(() => M.cas && M.cas !== viejo, 15);
M.mirar(0, 1.6, 0, 0, -0.35);
yield* noriaBuena();
yield* tocar('salir');
yield* hasta(() => M.resultado, 6);
log('partida 2: ' + JSON.stringify(M.resultado));
if (M.resultado.gana) throw new Error('salir a medias no debe ganar');
yield* quieto(der(), 2.2);
yield* fotoUna('final-2');

// --- partida 3: la ficha sigue ahí; martillo y tiro ---
viejo = M.cas;
M.reiniciar();
yield* hasta(() => M.cas && M.cas !== viejo, 15);
M.mirar(0, 1.6, 0, 0, -0.35);
if (!M.cas.fichas.noria) throw new Error('la ficha de la noria no se guardó');
yield* quieto(der(), 1);
yield* fotoUna('tablon-1ficha');
yield* martillo(true);
yield* tiro();
yield* hasta(() => M.resultado, 15);
yield* quieto(der(), 2.2);
M.mirar(0, 1.6, 0, 0, -0.3);
yield* fotoUna('final-3');
log('partida 3: ' + JSON.stringify(M.resultado));
if (!M.resultado.gana) throw new Error('con las tres fichas no ganó');
const guardado = JSON.parse(localStorage.getItem('unake-xr-casetas') || '{}');
if (guardado.tiro || guardado.noria || guardado.martillo) throw new Error('las fichas no se gastaron al cerrar la feria');
log('draw calls: ' + JSON.stringify(llamadas));
log('resultados: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
