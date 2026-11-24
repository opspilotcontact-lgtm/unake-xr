// Bot de «Tu propio amarillo» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1: juega bien la fase 1 (dispara con la derecha, coge el dulce de Cotine al vuelo con la izquierda y se lo
// lanza de un puñetazo, para y devuelve lo que le tiran, esquiva las oleadas con un paso lateral); en la fase 2 se
// queda quieto hasta que el amarillo le tumba → Blancaso → «Otra vez, desde aquí» → retoma la fase 2 con un corazón
// más y gana las cuatro fases (nube de Lasslow, burbuja de la Pompa, punto de Puky).
// «Otra vez» del marco. Partida 2: quieto → cae → no elige (sigue solo a los 9 s) → cae otra vez → «Dejarlo por hoy».
const api = () => M.escena.getObjectByName('minijuego-amarillo')?.userData.api;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return false; fotos.add(n); foto(n); return true; };
let tAntes = M.t;
function hacia(m, meta, vmax, pinza) {
  const dt = Math.max(0.001, M.t - tAntes);
  const d = meta.clone().sub(m.pos), l = d.length(), paso = vmax * dt;
  poner(m, l > paso ? m.pos.clone().addScaledVector(d, paso / l) : meta.clone(), pinza, false);
}
const M4 = new T.Matrix4(), ARRIBA = new T.Vector3(0, 1, 0);
function apuntar(m, meta) { M4.lookAt(m.pos, meta, ARRIBA); m.quat.setFromRotationMatrix(M4); }
let cabX = 0;
const cab = () => new T.Vector3(cabX, 1.6, 0);
function moverCabeza(meta, v) { const dt = Math.max(0.001, M.t - tAntes); cabX += Math.sign(meta - cabX) * Math.min(Math.abs(meta - cabX), v * dt); M.mirar(cabX, 1.6, 0, 0, 0.1); }
const REPOSO_D = () => cab().add(new T.Vector3(0.3, -0.7, 0.12)), REPOSO_I = () => cab().add(new T.Vector3(-0.3, -0.7, 0.12));
const llamadas = () => M.renderer.info.render.calls;
let maxLlamadas = 0;
const medir = n => { const c = llamadas(); maxLlamadas = Math.max(maxLlamadas, c); log(`draw calls (${n}): ${c}`); };

poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);
M.mirar(0, 1.6, 0, 0, 0.1);

// un fotograma jugando bien
let puno = null;
function bien(a) {
  const c = cab();
  // derecha: dispara siempre hacia el blanco
  const pd = c.clone().add(new T.Vector3(0.22, -0.28, -0.35));
  hacia(der(), pd, 3, a.estado === 'juego');
  apuntar(der(), a.blanco());
  // cuerpo: fuera de la franja de la oleada
  let metaX = 0;
  for (const o of a.olas()) {
    if (o.z > 0.4) continue;
    if (cabX > o.x0 - 0.2 && cabX < o.x1 + 0.2) metaX = Math.abs(o.x0 - 0.45) < Math.abs(o.x1 + 0.45) ? o.x0 - 0.45 : o.x1 + 0.45;
    else metaX = cabX;
  }
  moverCabeza(T.MathUtils.clamp(metaX, -1.2, 1.2), metaX === 0 ? 0.6 : 2.2);
  // izquierda: dulce, amenazas, nube o reposo
  const ds = a.dulces();
  const llevado = ds.find(d => d.estado === 'mano' && d.lado === 'izquierda');
  const atras = c.clone().add(new T.Vector3(-0.15, -0.25, -0.1)), alante = c.clone().add(new T.Vector3(-0.05, -0.15, -0.9));
  if (llevado) {
    if (!puno) puno = 'atras';
    if (puno === 'atras') { hacia(izq(), atras, 2.5, false); if (izq().pos.distanceTo(atras) < 0.03) puno = 'alante'; }
    else { hacia(izq(), alante, 4, false); if (fotoUna('puno')) log('dulce cogido: puñetazo con él'); }
    return;
  }
  puno = null;
  const vuela = ds.find(d => d.estado === 'vuela' && d.pos.distanceTo(c) < 1.3 && d.pos.z < c.z + 0.1);
  if (vuela) { hacia(izq(), vuela.pos, 3.5, false); return; }
  const amenaza = a.enemigos().filter(e => e.pos.distanceTo(c) < 1.2 && e.vel.dot(c.clone().sub(e.pos)) > 0).sort((p, q) => p.pos.distanceTo(c) - q.pos.distanceTo(c))[0];
  if (amenaza) { hacia(izq(), amenaza.pos, 4.5, false); return; }
  if (a.fase === 2 && a.impulso < 0.3 && a.gas >= 1) { hacia(izq(), a.nube(), 3, false); return; }
  hacia(izq(), c.clone().add(new T.Vector3(-0.28, -0.35, -0.3)), 2, false);
}
function quieto_(a) {
  hacia(der(), REPOSO_D(), 2, false); hacia(izq(), REPOSO_I(), 2, false);
  moverCabeza(0, 1);
  apuntar(der(), a.blanco());
}
function* tocarTarjeta(texto) {
  yield* hasta(() => M.ui.tarjetas.some(m => m.userData.texto === texto), 8);
  const t = M.ui.tarjetas.find(m => m.userData.texto === texto);
  for (let s = 0; s < 0.5; s += 0.016) { hacia(der(), t.position.clone(), 2, false); tAntes = M.t; yield; }
  poner(der(), t.position.clone(), false, false); yield;
  log('toca «' + texto + '»');
}

// ---------------- partida 1 ----------------
yield* hasta(() => api() && api().fase === 1, 20);
let a = api();
yield* esperar(1.2); fotoUna('inicio');
let faseAntes = 0, tFase = M.t, caidas = 0;
while (!M.resultado) {
  if (a.fase !== faseAntes) { faseAntes = a.fase; tFase = M.t; log(`fase ${a.fase} · vida ${a.est.vida}/${a.est.vidaMax} · ${a.est.parrys} contras, ${a.est.bloqueos} paradas, ${a.est.fuertes} fuertes`); }
  const enFase = M.t - tFase;
  if (a.estado === 'caida') {
    caidas++;
    log(`¡te tumba! en la fase ${a.fase} (golpes ${a.est.golpes})`);
    quieto_(a); tAntes = M.t; yield;
    yield* esperar(1.6); fotoUna('caida-blancaso');
    const faseCaida = a.fase;
    yield* tocarTarjeta('Otra vez, desde aquí');
    yield* hasta(() => a.estado === 'juego', 4);
    log(`retoma la fase ${a.fase} con ${a.est.vida}/${a.est.vidaMax} corazones`);
    if (a.fase !== faseCaida || a.est.vidaMax !== 3 + a.est.rein) throw new Error('no retomó bien');
    poner(der(), cab().add(new T.Vector3(0.22, -0.28, -0.35)), false, false);
    tAntes = M.t; yield; continue;
  }
  // en la fase 2 se queda quieto (la primera vez) para que le tumbe
  if (a.fase === 2 && caidas === 0 && enFase > 3) quieto_(a); else bien(a);
  if (a.fase === 1 && enFase > 3 && a.enemigos().length && fotoUna('f1-ataque')) medir('fase 1, ataque');
  if (a.olas().some(o => o.aviso <= 0 && o.z > -1.5) && fotoUna('oleada')) medir('oleada');
  if (a.fase === 2 && a.granos() && enFase > 2 && fotoUna('f2-granos')) medir('fase 2, granos');
  if (a.fase === 2 && a.est.inclina && Math.abs(a.est.inclina) > 0.12) fotoUna('f2-inclina');
  if (a.fase === 3 && a.burbuja && fotoUna('f3-burbuja')) medir('fase 3, burbuja');
  if (a.fase === 4 && a.puky?.abierto && fotoUna('f4-puky')) medir('fase 4, punto de Puky');
  if (M.t - tFase > 150) throw new Error('fase ' + a.fase + ' atascada');
  tAntes = M.t; yield;
}
log(`partida 1: ${JSON.stringify(M.resultado)} · caídas ${caidas}, contras ${a.est.parrys}, paradas ${a.est.bloqueos}, fuertes ${a.est.fuertes}, golpes ${a.est.golpes}`);
if (!M.resultado.gana) throw new Error('la partida 1 no ganó');
if (caidas < 1) throw new Error('la partida 1 tenía que caer una vez');
poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);
fotoUna('victoria');
yield* esperar(0.3);
medir('victoria');

// ---------------- «Otra vez» ----------------
yield* tocarTarjeta('Otra vez');
const viejo = a;
yield* hasta(() => api() && api() !== viejo && api().fase === 1, 15);
a = api();
log('otra vez: partida nueva (fase ' + a.fase + ', vida ' + a.est.vida + ')');
poner(der(), REPOSO_D(), false, false);
cabX = 0;
yield* hasta(() => { quieto_(a); tAntes = M.t; return a.estado === 'caida'; }, 90);
log('partida 2: cae quieto en la fase ' + a.fase);
// no elige: sigue sola a los 9 s
yield* hasta(() => { quieto_(a); tAntes = M.t; return a.estado === 'juego'; }, 14);
log(`sigue sola: fase ${a.fase}, ${a.est.vida}/${a.est.vidaMax} corazones, rein ${a.est.rein}`);
if (a.est.vidaMax !== 4) throw new Error('no dio el corazón extra');
yield* hasta(() => { quieto_(a); tAntes = M.t; return a.estado === 'caida'; }, 90);
yield* esperar(0.4);
yield* tocarTarjeta('Dejarlo por hoy');
yield* hasta(() => M.resultado, 5);
yield* esperar(0.5); foto('dejarlo');
log(`partida 2: ${JSON.stringify(M.resultado)}`);
if (M.resultado.gana) throw new Error('la partida 2 ganó');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('máximo de draw calls medido: ' + maxLlamadas);
log('FIN OK');
