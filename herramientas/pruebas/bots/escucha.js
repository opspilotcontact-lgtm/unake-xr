// Bot de «Escucha, escucha» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): tapa la boca de Palicaso cuando NO toca (burbuja tranquila) y nunca cuando sí → pierde.
// «Otra vez» tocando la tarjeta.
// Partida 2 (buena): tapa la boca solo con la burbuja rosa y asiente con la cabeza en cada frase. Debe ganar.
// Al final, una partida nueva y abandonar() a los pocos segundos → terminar con gana:false.
const api = () => M.escucha;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let maxCalls = 0;
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return; fotos.add(n); foto(n); };
const PITCH = -0.12;
M.mirar(0, 1.6, 0, 0, PITCH);
const hablando = a => ['habla', 'pausa', 'silencio'].includes(a.fase);

function* shhh(a) {
  const m = der();
  yield* mover(m, () => a.boca(), 0.12, false);
  yield* quieto(m, 0.08, false);
  fotoUna('shhh');
  yield* mover(m, a.reposo(), 0.2, false);
}
function* asentir() {
  let t = 0;
  while (t < 0.3) { t += 0.016; const k = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.15; M.mirar(0, 1.6, 0, 0, PITCH - 0.3 * k); if (t > 0.14 && t < 0.17) fotoUna('asentir'); yield; }
  M.mirar(0, 1.6, 0, 0, PITCH);
}

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado && api().fase !== 'espera', 20);
  const a = api();
  poner(der(), a.reposo(), false); poner(izq(), a.reposo().add(new T.Vector3(-0.25, 0, 0)), false);
  log(`partida ${buena ? 'buena' : 'mala'}`);
  let tLog = 0, sigAsentir = 0, sigMal = M.t + 1.5, asentidas = 0, frenos = 0;
  while (!M.resultado) {
    maxCalls = Math.max(maxCalls, M.renderer.info.render.calls);
    if (M.t - tLog > 5) { tLog = M.t; log(`${a.fase} · frase ${a.linea} · presión ${a.presion.toFixed(2)} · ánimo ${a.animo} · ${a.puntos} pts · racha ${a.racha} · draw calls ${M.renderer.info.render.calls}`); }
    if (a.presion >= a.VENT && hablando(a)) fotoUna(buena ? 'rosa' : 'rosa-mala');
    if (a.fase === 'corte') fotoUna(buena ? 'corte-buena' : 'corte');
    if (buena) {
      if (hablando(a) && a.presion >= 0.74 && !a.falsa) { yield* shhh(a); frenos++; continue; }
      if (!a.asentido && (a.fase === 'habla' || a.fase === 'pausa') && a.presion < 0.55 && M.t > sigAsentir) { yield* asentir(); sigAsentir = M.t + 0.8; if (a.asentido) asentidas++; continue; }
    } else if (hablando(a) && a.presion < 0.35 && M.t > sigMal) { sigMal = M.t + 2; yield* shhh(a); continue; }
    yield;
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · ánimo ${a.animo} · frenos ${frenos} · asentidas ${asentidas}`);
  yield* esperar(2.4);
  foto(buena ? 'final-buena' : 'final-mala');
  yield* esperar(0.6); // que la foto salga antes de tocar nada
}

yield* hasta(() => api(), 20);
yield* esperar(1.5); foto('intro');
yield* partida(false);
if (M.resultado.gana) throw new Error('la partida mala ganó');
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), otra.position.clone().add(new T.Vector3(0, 0, 0.1)), 0.3, false);
yield* mover(der(), otra.position.clone(), 0.2, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 15);
log('otra vez: partida nueva');
yield* partida(true);
if (!M.resultado.gana) throw new Error('la partida buena no ganó');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
log('dos partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api() && api().fase !== 'espera', 15);
  yield* esperar(2);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
