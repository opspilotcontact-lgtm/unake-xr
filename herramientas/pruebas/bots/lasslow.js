// Bot de «Un señor» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): no hace nada; la risa le pilla tres veces. Debe perder.
// «Otra vez» tocando la tarjeta.
// Partida 2 (buena): mano a la boca justo cuando el círculo toca el anillo; en la tripa respira (sube y baja la mano
// despacio) y aprieta durante el ruido. Con 6 aciertos se deja llevar (tres fallos) y acaba. Debe ganar (≥ 400).
// Partida 3: abandonar() a mitad → gana:false.
const api = () => M.lasslow;
const REPOSO = new T.Vector3(0.2, 1.1, -0.32), REPOSO_I = new T.Vector3(-0.25, 1.1, -0.28);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let maxCalls = 0;
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return; fotos.add(n); foto(n); };
M.mirar(0, 1.6, 0, 0, -0.12);
function* tocar(m, destino, seg = 0.4) {
  const atras = destino.clone().add(new T.Vector3(0, 0, 0.1));
  yield* mover(m, atras, seg, false); yield* mover(m, destino, 0.15, false); yield* quieto(m, 0.1, false); yield* mover(m, atras, 0.15, false);
}

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado && api().fase !== 'cargando', 20);
  const a = api();
  poner(der(), REPOSO, false); poner(izq(), REPOSO_I, false);
  log(`partida ${buena ? 'buena' : 'mala'} · margen ${a.tol.toFixed(3)} m`);
  let tLog = 0, mano = false;
  while (!M.resultado) {
    maxCalls = Math.max(maxCalls, M.renderer.info.render.calls);
    if (M.t - tLog > 5) { tLog = M.t; log(`${a.fase} · ronda ${a.rondas} · ${a.puntos} pts · pajaritas ${a.dignidad} · bien ${a.bien}, mal ${a.mal} · draw calls ${M.renderer.info.render.calls}`); }
    const p = a.prueba;
    if (!buena || a.bien >= 6 || !p) {
      if (!buena && p?.tipo === 'chiste' && p.t > p.dur * 0.6) fotoUna('chiste-mala');
      if (!buena && a.fase === 'pausa') fotoUna('risa');
      yield; continue;
    }
    if (p.tipo === 'chiste') {
      if (p.t > p.dur * 0.3) fotoUna('chiste');
      if (!mano && p.radio <= a.ANILLO + a.tol * 0.25) {
        mano = true;
        const antes = a.bien;
        yield* mover(der(), () => a.boca().add(new T.Vector3(0, -0.01, -0.05)), 0.06, false);
        if (a.bien > antes) { log(`chiste tragado · ${a.puntos} pts · racha ${a.combo}`); fotoUna('tragada'); }
        yield* quieto(der(), 0.2, false);
        yield* mover(der(), REPOSO, 0.25, false);
        mano = false;
        continue;
      }
    } else if (p.tipo === 'tripa') {
      // respirar: la izquierda sube y baja despacio mientras espera el ruido
      if (!(p.sono && p.t >= p.ruido[0] + 0.15)) {
        const arriba = izq().pos.y > REPOSO_I.y + 0.07;
        yield* mover(izq(), REPOSO_I.clone().add(new T.Vector3(0, arriba ? 0 : 0.14, 0)), 0.5, false);
        if (a.calma > 0.4) fotoUna('respira');
        continue;
      }
      fotoUna('ruido');
      const antes = a.bien;
      poner(der(), der().pos.clone(), true); yield; yield* quieto(der(), 0.08, true); poner(der(), der().pos.clone(), false); yield;
      log(`tripa: ${a.bien > antes ? 'disimulado' : 'FALLO'} · ${a.puntos} pts · calma ${a.calma.toFixed(2)}`);
      continue;
    }
    yield;
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · bien ${a.bien} · mal ${a.mal} · draw calls máx ${maxCalls}`);
  yield* esperar(2.4);
  foto(buena ? 'final-buena' : 'final-mala');
}

yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* tocar(der(), otra.position.clone());
yield* hasta(() => api() && api() !== viejo && !M.resultado, 15);
log('otra vez: partida nueva');
yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && api() && !M.resultado && api().fase !== 'cargando', 15);
  yield* esperar(4);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('dos partidas: ' + M.resultados.slice(0, 2).map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
log('FIN OK');
