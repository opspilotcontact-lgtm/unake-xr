// Bot de «El blancazo» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1: juega bien la fase 1 (dispara con la derecha, para y devuelve la pota con la izquierda, se aparta de los
// charcos que avisan, aplasta pukitos, coge el resucitador y se lo lanza); en la fase 2 se queda quieto hasta que Puky
// le pringa → «Otra vez, desde aquí» → retoma con un corazón más, pasa los muros de eructo por el hueco y gana.
// «Otra vez» del marco. Partida 2: quieto → cae → «Dejarlo por hoy». Partida 3: abandonar() a mitad.
const api = () => M.escena.getObjectByName('minijuego-blancazo')?.userData.api;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return false; fotos.add(n); foto(n); return true; };
let tAntes = M.t;
const paso = () => Math.max(0.001, M.t - tAntes);
function hacia(m, meta, vmax, pinza, agarre = false) {
  const d = meta.clone().sub(m.pos), l = d.length(), s = vmax * paso();
  poner(m, l > s ? m.pos.clone().addScaledVector(d, s / l) : meta.clone(), pinza, agarre);
}
const M4 = new T.Matrix4(), ARRIBA = new T.Vector3(0, 1, 0);
function apuntar(m, meta) { M4.lookAt(m.pos, meta, ARRIBA); m.quat.setFromRotationMatrix(M4); }
let cabX = 0, cabY = 1.6;
const cab = () => new T.Vector3(cabX, cabY, 0);
function moverCabeza(mx, my, v) {
  const s = v * paso();
  cabX += Math.sign(mx - cabX) * Math.min(Math.abs(mx - cabX), s);
  cabY += Math.sign(my - cabY) * Math.min(Math.abs(my - cabY), s);
  M.mirar(cabX, cabY, 0, 0, -0.12);
}
const REPOSO_D = () => cab().add(new T.Vector3(0.3, -0.7, 0.12)), REPOSO_I = () => cab().add(new T.Vector3(-0.3, -0.7, 0.12));
const llamadas = () => M.renderer.info.render.calls;
let maxLlamadas = 0;
const medir = n => { const c = llamadas(); maxLlamadas = Math.max(maxLlamadas, c); log(`draw calls (${n}): ${c}`); };

poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);
M.mirar(0, 1.6, 0, 0, -0.12);

let tiro = null; // lanzando la lata: { desde }
function bien(a) {
  const c = cab();
  // ---- cabeza: por el hueco del muro; lejos de los charcos que avisan ----
  let mx = 0, my = 1.6, v = 0.8;
  const muro = a.muros.filter(w => !w.pasado).sort((p, q) => q.z - p.z)[0];
  if (muro) { mx = muro.hx; my = muro.hy; v = 1.6; }
  else {
    const m = a.marcas.filter(k => !k.salpica && Math.hypot(k.x - cabX, k.z) < 0.38)[0];
    if (m) { mx = cabX + (cabX >= m.x ? 1 : -1) * 0.4; v = 1.6; }
    else mx = cabX * 0.98;
  }
  moverCabeza(T.MathUtils.clamp(mx, -0.55, 0.55), T.MathUtils.clamp(my, 1.2, 1.65), v);
  // ---- la lata en una mano (la coge la que pase por ahí): se lanza hacia Puky ----
  const L = a.lata;
  const conLata = L && L.estado === 'mano' ? L.mano : null;
  if (conLata) {
    if (!tiro) tiro = conLata.pos.clone();
    const meta = tiro.clone().add(new T.Vector3(0, 0.1, -0.6));
    const suelta = conLata.pos.distanceTo(tiro) > 0.25;
    hacia(conLata, meta, 4, !suelta, false);
    if (suelta && fotoUna('lanza')) log('lanza el resucitador (' + conLata.lado + ')');
  } else tiro = null;
  // ---- derecha: dispara a Puky (o al pukito más cercano) ----
  if (conLata !== der()) {
    const pd = c.clone().add(new T.Vector3(0.22, -0.28, -0.35));
    hacia(der(), pd, 3, a.estado === 'juego');
    const pk = a.pukitos.slice().sort((p, q) => p.p.distanceTo(c) - q.p.distanceTo(c))[0];
    apuntar(der(), pk && pk.p.distanceTo(c) < 1.6 ? pk.p.clone().add(new T.Vector3(0, 0.12, 0)) : a.centroPuky());
  }
  if (conLata === izq()) return;
  // ---- izquierda: la lata, los pukitos que se lanzan, la pota que viene, o reposo ----
  if (L && L.estado === 'flota') {
    const cerca = izq().pos.distanceTo(L.p) < 0.06;
    if (cerca) { poner(izq(), L.p.clone(), true, false); if (fotoUna('coge-lata')) log('coge el resucitador'); }
    else hacia(izq(), L.p, 3, false);
    return;
  }
  const kk = a.pukitos.filter(k => k.p.distanceTo(c) < 1.1).sort((p, q) => p.p.distanceTo(c) - q.p.distanceTo(c))[0];
  if (kk) { hacia(izq(), kk.p.clone().add(new T.Vector3(0, 0.12, 0)), 4.5, false); return; }
  const g = a.gotas.filter(x => !x.devuelta && x.p.distanceTo(c) < 1.1 && x.v.dot(c.clone().sub(x.p)) > 0).sort((p, q) => p.p.distanceTo(c) - q.p.distanceTo(c))[0];
  if (g) { hacia(izq(), g.p, 4.5, false); return; }
  hacia(izq(), c.clone().add(new T.Vector3(-0.25, -0.35, -0.3)), 2, false);
}
function quieto_(a) {
  hacia(der(), REPOSO_D(), 2, false); hacia(izq(), REPOSO_I(), 2, false);
  moverCabeza(0, 1.6, 1);
  apuntar(der(), a.centroPuky());
}
function* tocarTarjeta(texto) {
  yield* hasta(() => M.ui.tarjetas.some(m => m.userData.texto === texto), 8);
  const t = M.ui.tarjetas.find(m => m.userData.texto === texto);
  for (let s = 0; s < 0.5; s += 0.016) { hacia(der(), t.position.clone(), 2, false); tAntes = M.t; yield; }
  poner(der(), t.position.clone(), false, false); yield;
  log('toca «' + texto + '»');
}

// ---------------- partida 1 ----------------
yield* hasta(() => api() && api().estado === 'juego', 20);
let a = api();
yield* esperar(0.6); fotoUna('inicio');
let faseAntes = 0, tFase = M.t, caidas = 0;
while (!M.resultado) {
  if (a.fase !== faseAntes) { faseAntes = a.fase; tFase = M.t; log(`fase ${a.fase} · hp ${Math.round(a.est.hp)} · vida ${a.est.vida}/${a.est.vidaMax} · paradas ${a.est.paradas}, devueltas ${a.est.devueltas}, aplastados ${a.est.aplastados}, resucitadores ${a.est.supers}`); }
  const enFase = M.t - tFase;
  if (a.estado === 'caida') {
    caidas++;
    log(`¡te pringa! en la fase ${a.fase} (golpes ${a.est.golpes}: ${JSON.stringify(a.est.por)}) · hp ${Math.round(a.est.hp)}`);
    quieto_(a); tAntes = M.t; yield;
    yield* esperar(1.2); fotoUna('caida');
    yield* tocarTarjeta('Otra vez, desde aquí');
    yield* hasta(() => a.estado === 'juego', 4);
    log(`retoma la fase ${a.fase} con ${a.est.vida}/${a.est.vidaMax} corazones`);
    if (a.est.vidaMax !== 4) throw new Error('no dio el corazón extra');
    tAntes = M.t; yield; continue;
  }
  if (a.estado === 'victoria') { tAntes = M.t; yield; continue; }
  if (a.fase === 2 && caidas === 0 && enFase > 3) quieto_(a); else bien(a);
  if (a.marcas.some(m => !m.salpica) && fotoUna('arco')) medir('lluvia en arco');
  if (a.muros.some(w => w.z > -1.2 && w.z < -0.4) && fotoUna('muro')) medir('muro de eructo');
  if (a.pukitos.length >= 2 && fotoUna('pukitos')) medir('pukitos');
  if (a.fase === 3 && enFase > 2 && fotoUna('f3')) medir('fase 3');
  if (M.t - tFase > 120) throw new Error('fase ' + a.fase + ' atascada');
  tAntes = M.t; yield;
}
log(`partida 1: ${JSON.stringify(M.resultado)} · caídas ${caidas}, paradas ${a.est.paradas}, devueltas ${a.est.devueltas}, aplastados ${a.est.aplastados}, resucitadores ${a.est.supers}, golpes ${a.est.golpes}, ${Math.round(a.est.tJuego)} s`);
if (!M.resultado.gana) throw new Error('la partida 1 no ganó');
if (caidas < 1) throw new Error('la partida 1 tenía que caer una vez');
if (a.est.supers < 1) throw new Error('no lanzó ningún resucitador');
poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);
yield* esperar(0.3); foto('victoria'); medir('victoria');

// ---------------- «Otra vez» → partida 2: quieto, cae y lo deja ----------------
yield* tocarTarjeta('Otra vez');
const viejo = a;
yield* hasta(() => api() && api() !== viejo && api().estado === 'juego', 15);
a = api();
cabX = 0; cabY = 1.6;
log('otra vez: partida nueva');
yield* hasta(() => { quieto_(a); tAntes = M.t; return a.estado === 'caida'; }, 90);
log('partida 2: cae quieto en la fase ' + a.fase);
yield* esperar(0.4);
yield* tocarTarjeta('Dejarlo por hoy');
yield* hasta(() => M.resultado, 5);
yield* esperar(0.5); foto('dejarlo');
log(`partida 2: ${JSON.stringify(M.resultado)}`);
if (M.resultado.gana) throw new Error('la partida 2 ganó');

// ---------------- partida 3: abandonar a mitad ----------------
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api()?.estado === 'juego', 15);
  yield* esperar(2);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
if (M.resultados.length !== 3) throw new Error('faltan resultados: ' + M.resultados.length);
log('máximo de draw calls medido: ' + maxLlamadas);
log('FIN OK');
