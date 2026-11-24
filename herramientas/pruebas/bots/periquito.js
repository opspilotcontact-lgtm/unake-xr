// Bot de «¡Periquito!» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1 (mala): aprieta en cuanto Perico abre el pico (antes del «Mon…» o en fintas). Debe perder.
// «Otra vez» tocando la tarjeta.
// Partida 2 (buena): solo aprieta (pellizco) cuando la frase es de peligro y ya asoma el «Mon». Debe ganar.
// Partida 3: con el micro simulado (un pico de volumen) corta un «Monchiman» y luego abandonar() → gana:false.
const api = () => M.periquito;
const REPOSO = new T.Vector3(0.2, 1.15, -0.3);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
let maxCalls = 0;
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return; fotos.add(n); foto(n); };
M.mirar(0, 1.6, 0, 0, -0.08);

function* apretar() { poner(der(), REPOSO, true); yield; yield* quieto(der(), 0.1, true); poner(der(), REPOSO, false); yield; }
function* tocar(m, destino, seg = 0.4) {
  const atras = destino.clone().add(new T.Vector3(0, 0, 0.1));
  yield* mover(m, atras, seg, false); yield* mover(m, destino, 0.15, false); yield* quieto(m, 0.1, false); yield* mover(m, atras, 0.15, false);
}

function* partida(buena) {
  yield* hasta(() => api() && !M.resultado && api().fase !== 'cargando', 20);
  const a = api();
  poner(der(), REPOSO, false); poner(izq(), new T.Vector3(-0.25, 1.15, -0.25), false);
  yield* esperar(1.0); if (buena) fotoUna('demo');
  log(`partida ${buena ? 'buena' : 'mala'}`);
  let ultima = 0;
  while (!M.resultado) {
    maxCalls = Math.max(maxCalls, M.renderer.info.render.calls);
    const f = a.activa;
    if (f && a.frase !== ultima) {
      if (buena) {
        if (f.tipo === 'peligro' && f.k >= f.desde + 2) {
          if (f.k > f.desde + 4) fotoUna('mon');
          ultima = a.frase;
          const antes = a.puntos; yield* apretar();
          log(`frase ${a.frase} «${f.txt}» cortada en ${f.k}/${f.largo}: +${a.puntos - antes} (racha ${a.racha})`);
          if (a.racha >= 2) { yield* esperar(0.2); fotoUna('pinpin'); }
          continue;
        }
        if (f.tipo === 'finta' && f.k > 12) fotoUna('finta');
      } else if (f.k >= 2) {
        ultima = a.frase; yield* apretar();
        log(`frase ${a.frase} (${f.tipo}) cortada antes de tiempo · vidas ${a.vidas}`);
        yield* esperar(0.3); fotoUna('ofendido'); continue;
      }
    }
    yield;
  }
  log(`partida ${buena ? 'buena' : 'mala'}: ${JSON.stringify(M.resultado)} · vidas ${a.vidas} · draw calls máx ${maxCalls}`);
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

// partida 3: el micro (simulado) y salir a mitad
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && api() && !M.resultado && api().fase !== 'cargando', 15);
  const a = api(); a.micFalso = 0.02;
  yield* hasta(() => a.activa && a.activa.tipo === 'peligro' && a.activa.k >= a.activa.desde + 2 || a.frase > 6, 30);
  if (a.activa?.tipo !== 'peligro') throw new Error('no salió ningún «Monchiman» en 6 frases');
  a.micFalso = 0.8; yield* esperar(0.15); fotoUna('micro'); a.micFalso = 0.05; yield;
  if (a.puntos <= 0 || a.gritos !== 1) throw new Error('el grito con micro no contó: ' + a.puntos + ' / ' + a.gritos);
  log(`micro: grito cortado · ${a.puntos} puntos`);
  yield* esperar(1);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('dos partidas: ' + M.resultados.slice(0, 2).map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · ') + ` · draw calls máx ${maxCalls}`);
log('FIN OK');
