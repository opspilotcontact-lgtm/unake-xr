// Bot de «Los discos de la Pompa»: tres partidas.
//   1) Coge a Vuper con un pellizco y le lleva DESPACIO (sin ruido) por la casa, esperando si un cono va a pillarle,
//      a por los tres discos y de vuelta a la salida: gana.
//   2) «Otra vez» tocando la tarjeta. Le arrastra deprisa (con ruido) hasta el casero y se queda delante: le pillan
//      tres veces y pierde.
//   3) Una partida nueva y abandonar() a los pocos segundos: termina con gana:false.
M.mirar(0, 1.5, 0.05, 0, -0.95);
const api = () => M.escena.getObjectByName('minijuego-sigilo')?.userData.api;
const REPOSO = new T.Vector3(0.25, 1.05, -0.15);
poner(izq(), new T.Vector3(-0.35, 1.1, 0.05), false);
poner(der(), REPOSO.clone(), false);
yield* quieto(der(), 0.2);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
function* fotoUna(n, mantener = 0.35) { if (fotos.has(n)) return; fotos.add(n); foto(n); yield* quieto(der(), mantener, der().pinza); }

// ---------- camino por la casa (rejilla de 15 px, paredes engordadas) ----------
function camino(a, x0, y0, x1, y1) {
  const C = 15, NX = Math.floor((1190 - 90) / C) + 1, NY = Math.floor((670 - 130) / C) + 1;
  const libre = (i, j) => {
    const x = 90 + i * C, y = 130 + j * C;
    for (const [dx, dy] of [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, 10], [10, -10], [-10, -10]]) if (a.enPared(x + dx, y + dy)) return false;
    return true;
  };
  const celda = (x, y) => [Math.max(0, Math.min(NX - 1, Math.round((x - 90) / C))), Math.max(0, Math.min(NY - 1, Math.round((y - 130) / C)))];
  let [si, sj] = celda(x0, y0); const [ei, ej] = celda(x1, y1);
  if (!libre(si, sj)) { let mejor = null; for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) if (libre(i, j)) { const d = (i - si) ** 2 + (j - sj) ** 2; if (!mejor || d < mejor[2]) mejor = [i, j, d]; } [si, sj] = mejor; }
  const prev = new Map(), k = (i, j) => i + j * NX, cola = [[si, sj]];
  prev.set(k(si, sj), -1);
  while (cola.length) {
    const [i, j] = cola.shift();
    if (i === ei && j === ej) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY || prev.has(k(ni, nj)) || !libre(ni, nj)) continue;
      if (di && dj && (!libre(i + di, j) || !libre(i, j + dj))) continue;
      prev.set(k(ni, nj), k(i, j)); cola.push([ni, nj]);
    }
  }
  if (!prev.has(k(ei, ej))) throw new Error(`sin camino de ${x0},${y0} a ${x1},${y1}`);
  const pts = [];
  for (let c = k(ei, ej); c !== -1; c = prev.get(c)) pts.push([90 + (c % NX) * C, 130 + Math.floor(c / NX) * C]);
  pts.reverse(); pts.push([x1, y1]);
  return pts;
}
// ¿algún vigilante vería este punto?
function loVen(a, x, y, margen = 40) {
  return a.vigilantes.some(w => {
    const d = Math.hypot(x - w.x, y - w.y); if (d > w.alcance + margen) return false;
    let ang = Math.atan2(y - w.y, x - w.x) - w.dir; ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
    return ang < w.fov / 2 + 0.35 && !a.tapado(w.x, w.y, x, y);
  });
}

function* coger(a) {
  yield* hasta(() => !a.vu.vuelta && a.fase === 'juego', 5);
  yield* mover(der(), () => a.vuper().add(new T.Vector3(0, 0.06, 0.03)), 0.25, false);
  yield* mover(der(), () => a.vuper(), 0.12, false);
  yield* quieto(der(), 0.05, true);
  if (!a.vu.mano) throw new Error('no ha cogido a Vuper');
}
// lleva a Vuper hasta (x, y) a `vel` px/s; con `cauto`, espera si el siguiente tramo lo ve alguien
function* llevar(a, x, y, vel, cauto) {
  for (let intento = 0; intento < 8; intento++) {
    const pillados = a.E.pillados;
    if (!a.vu.mano) yield* coger(a);
    const pts = camino(a, a.vu.x, a.vu.y, x, y);
    let hx = a.vu.x, hy = a.vu.y, roto = false, tUlt = M.t;
    for (const [px, py] of pts) {
      const tE = M.t;
      while (cauto && M.t - tE < 3 && loVen(a, px, py) && !loVen(a, a.vu.x, a.vu.y, 0)) { poner(der(), a.mundo(hx, hy), true); yield; }
      tUlt = M.t;
      while (Math.hypot(px - hx, py - hy) > 1) {
        const d = Math.hypot(px - hx, py - hy), paso = Math.min(d, vel * Math.max(0, M.t - tUlt)); tUlt = M.t;
        hx += (px - hx) / d * paso; hy += (py - hy) / d * paso;
        poner(der(), a.mundo(hx, hy), true);
        yield;
        if (a.E.pillados !== pillados || a.fase !== 'juego') { roto = true; break; }
      }
      if (roto) break;
    }
    if (a.fase !== 'juego') return;
    if (roto) { poner(der(), der().pos.clone(), false); yield* esperar(0.8); continue; }
    yield* quieto(der(), 0.25, true);
    if (Math.hypot(a.vu.x - x, a.vu.y - y) < 30) return;
  }
  throw new Error(`no llega a ${x},${y}`);
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  if (n === 1) { yield* esperar(1.6); yield* fotoUna('demo'); }
  yield* hasta(() => a.fase === 'juego', 10);
  if (n === 1) {
    yield* coger(a);
    for (const [i, d] of a.discos.entries()) {
      yield* llevar(a, d.x, d.y, 105, true);
      yield* hasta(() => !d.vivo, 2);
      log(`disco ${i + 1}: ${a.E.puntos} pts · pillados ${a.E.pillados} · t ${a.E.t.toFixed(1)} s · llamadas de dibujo ${M.renderer.info.render.calls}`);
      if (i === 0) { M.mirar(0.25, 1.15, -0.2, 0.5, -0.7); yield* fotoUna('cerca', 0.3); M.mirar(0, 1.5, 0.05, 0, -0.95); }
    }
    yield* llevar(a, a.salida.x, a.salida.y, 105, true);
  } else {
    yield* coger(a);
    yield* esperar(0.3);
    while (a.fase === 'juego') {
      const w = a.vigilantes[0];
      const pillados = a.E.pillados;
      try { yield* llevar(a, w.x - 50, w.y - 10, 320, false); } catch (e) { log('reintento: ' + e.message); }
      if (a.E.ruidoso) yield* fotoUna('ruido', 0.1);
      const t0 = M.t;
      while (a.fase === 'juego' && a.E.pillados === pillados && M.t - t0 < 4) {
        if (a.E.sospecha > 0.7) yield* fotoUna('visto', 0.05);
        poner(der(), a.mundo(w.x - 50, w.y - 10), true); yield;
      }
    }
  }
  poner(der(), REPOSO.clone(), false);
  const E = a.E;
  log(`partida ${n}: ${E.puntos} pts · discos ${E.cogidos} · pillados ${E.pillados} · vidas ${E.vidas} · visto nunca ${E.vistoNunca} · ${E.t.toFixed(1)} s`);
  yield* hasta(() => M.resultado, 10);
  log('resultado ' + JSON.stringify(M.resultado));
  yield* esperar(1.9);
  M.mirar(0, 1.5, 0.05, 0, -0.5);
  yield* fotoUna('final' + n, 0.4);
  M.mirar(0, 1.5, 0.05, 0, -0.95);
}

yield* partida(1);
if (!M.resultado.gana) throw new Error('la partida buena no ha ganado');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
yield* partida(2);
if (M.resultado.gana) throw new Error('la partida mala ha ganado');
if (api().E.vidas !== 0) throw new Error('ha perdido sin quedarse sin vidas');
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
log('tres partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
log('FIN OK');
