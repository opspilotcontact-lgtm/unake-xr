// Bot de «El control» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): con los acompañantes que haya guardados, no tapa nada y contesta siempre la sospechosa. Debe perder.
// «Otra vez» tocando la tarjeta. Antes deja guardados a Lasslow, Perico y Cotine (la elección de «La furgo»).
// Partida 2 (buena): tapa cada delator con su gesto (manivela con la izquierda; gafas, ojos, boca de Lasslow, dedo a
// los labios y la bolsa de Cotine a la guantera con la derecha) y contesta la normal. Debe ganar.
const api = () => M.control;
const REPOSO_D = new T.Vector3(0.22, 1.12, -0.22), REPOSO_I = new T.Vector3(-0.3, 1.12, -0.2);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let maxCalls = 0, gafasProbadas = false;
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return; fotos.add(n); foto(n); };
M.mirar(0, 1.6, 0, 0, -0.1);
try { localStorage.setItem('unake-xr-furgo-acompanantes', JSON.stringify(['lasslow', 'perico', 'cotine'])); } catch { }

function* tocar(m, destino, seg = 0.4) {
  const atras = destino.clone().add(new T.Vector3(0, 0, 0.1));
  yield* mover(m, atras, seg, false);
  yield* mover(m, destino, 0.15, false);
  yield* quieto(m, 0.1, false);
  yield* mover(m, atras, 0.15, false);
}
function* resolver(tipo) {
  const a = api();
  log(`tapar ${tipo} (quedan ${a.activos.find(x => x.tipo === tipo)?.t.toFixed(1)} s)`);
  if (tipo === 'humo') {
    yield* mover(izq(), a.pomo(), 0.35, false);
    poner(izq(), a.pomo(), true); yield;
    const a0 = a.anguloManivela; let t = 0;
    while (a.activos.some(x => x.tipo === 'humo') && t < 2) { t += 0.016; poner(izq(), a.pomoEn(a0 + 5.5 * t), true); if (t > 0.5) fotoUna('manivela'); yield; }
    poner(izq(), izq().pos.clone(), false); yield;
    yield* mover(izq(), REPOSO_I, 0.3, false);
  } else if (tipo === 'ojos') {
    if (!gafasProbadas) {
      gafasProbadas = true;
      yield* mover(der(), a.gafas(), 0.35, false);
      poner(der(), a.gafas(), true); yield;
      yield* mover(der(), () => a.ojos().add(new T.Vector3(0.02, -0.02, -0.06)), 0.4, true);
      yield* quieto(der(), 0.1, true); fotoUna('gafas');
      poner(der(), der().pos.clone(), false); yield;
    } else { yield* mover(der(), () => a.ojos().add(new T.Vector3(0.03, 0, -0.04)), 0.35, false); yield* quieto(der(), 0.15, false); }
  } else if (tipo === 'risa') {
    yield* mover(der(), () => a.bocaDe('lasslow'), 0.45, false); fotoUna('risa'); yield* quieto(der(), 0.15, false);
  } else if (tipo === 'pinpin') {
    yield* mover(der(), () => a.boca().add(new T.Vector3(0, 0, -0.03)), 0.35, false); yield* quieto(der(), 0.15, false);
  } else if (tipo === 'comer') {
    yield* mover(der(), () => a.bolsa() || der().pos.clone(), 0.45, false);
    fotoUna('bolsa');
    poner(der(), a.bolsa() || der().pos.clone(), true); yield;
    yield* mover(der(), a.guantera(), 0.5, true);
    yield* quieto(der(), 0.1, true);
    poner(der(), der().pos.clone(), false); yield;
  }
  if (tipo !== 'humo') yield* mover(der(), REPOSO_D, 0.3, false);
}

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado && api().fase !== 'cargando', 20);
  const a = api();
  poner(der(), REPOSO_D, false); poner(izq(), REPOSO_I, false);
  log(`partida ${buena ? 'buena' : 'mala'} · a bordo: ${a.comp.join(', ')} · delatores: ${a.tellsOk.join(', ')}`);
  let tLog = 0;
  while (!M.resultado) {
    maxCalls = Math.max(maxCalls, M.renderer.info.render.calls);
    if (M.t - tLog > 6) { tLog = M.t; log(`${a.fase} · pregunta ${a.preg}/${a.total} · sospecha ${Math.round(a.sosp)} · ${a.puntos} pts · tapados ${a.aciertos}, fallos ${a.fallos} · draw calls ${M.renderer.info.render.calls}`); }
    if (a.fase === 'fin') { yield; continue; }
    if (a.preg === 1 && a.fase === 'pregunta' && a.tPreg > 1.5) fotoUna(buena ? 'pregunta' : 'pregunta-mala');
    if (!buena && a.preg === 1 && a.fase === 'pregunta' && a.tPreg > 0.5 && !fotos.has('agente')) { M.mirar(0, 1.6, 0, 0.75, -0.05); yield* quieto(der(), 0.3, false); fotoUna('agente'); yield* quieto(der(), 0.5, false); M.mirar(0, 1.6, 0, 0, -0.1); }
    if (a.activos.length) {
      if (a.activos.length > 1) fotoUna('dos-a-la-vez');
      if (buena) { const t = [...a.activos].sort((x, y) => x.t - y.t)[0]; yield* resolver(t.tipo); continue; }
      fotoUna('delator-' + a.activos[0].tipo);
    }
    if (a.fase === 'pregunta') {
      const cs = a.cartas();
      if (cs.length === 3 && a.tPreg > (buena ? 8.6 : 9.2) && (!buena || !a.activos.length)) {
        const c = cs.find(c => c.tipo === (buena ? 'n' : 's'));
        yield* tocar(der(), c.pos);
        yield* mover(der(), REPOSO_D, 0.3, false);
        continue;
      }
    }
    yield;
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · sospecha ${Math.round(a.sosp)} · tapados ${a.aciertos} · fallos ${a.fallos}`);
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
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
log('FIN OK');
