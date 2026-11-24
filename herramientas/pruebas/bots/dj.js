// Bot de «La Pompa pincha» (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs).
// Partida 1: toca cada burbuja en su plato justo en el golpe (izquierda ← rosa, derecha → amarillo, el centro la mano
// libre; los acordes, con las dos) → gana. «Otra vez». Partida 2: no toca nada → la Pompa se hincha y revienta.
// Partida 3: abandonar() a los pocos segundos → terminar con gana:false.
const api = () => M.escena.getObjectByName('minijuego-dj')?.userData.api;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
const fotoUna = n => { if (fotos.has(n)) return false; fotos.add(n); foto(n); return true; };
const llamadas = () => M.renderer.info.render.calls;
let maxLlamadas = 0;
const medir = n => { const c = llamadas(); maxLlamadas = Math.max(maxLlamadas, c); log(`draw calls (${n}): ${c}`); };
const cab = () => new T.Vector3(0, 1.6, 0);
const REPOSO_D = () => cab().add(new T.Vector3(0.3, -0.7, 0.12)), REPOSO_I = () => cab().add(new T.Vector3(-0.3, -0.7, 0.12));
M.mirar(0, 1.6, 0, -0.2, -0.42);
poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);

function* tocarTarjeta(texto) {
  yield* hasta(() => M.ui.tarjetas.some(m => m.userData.texto === texto), 8);
  const t = M.ui.tarjetas.find(m => m.userData.texto === texto);
  yield* mover(der(), t.position.clone(), 0.4, false);
  poner(der(), t.position.clone(), false, false); yield;
  log('toca «' + texto + '»');
}

// ---------------- partida 1: perfecta ----------------
yield* hasta(() => api() && api().fase === 'juego', 20);
let a = api();
log(`empieza · ${a.notas.length} burbujas · audio ${a.est.audio}`);
{
  // reparte las notas entre las manos
  const libre = { derecha: -9, izquierda: -9 }, lado = new Map();
  for (const n of a.notas) {
    let l = n.carril === 0 ? 'izquierda' : n.carril === 2 ? 'derecha' : (libre.derecha < libre.izquierda ? 'derecha' : 'izquierda');
    if (libre[l] > n.t - 0.12) l = l === 'derecha' ? 'izquierda' : 'derecha';
    lado.set(n, l); libre[l] = n.t;
  }
  const st = { derecha: { dip: false }, izquierda: { dip: false } };
  const m = { derecha: der, izquierda: izq };
  const sobre = (i, y) => a.platos[i].clone().add(new T.Vector3(0, y, 0));
  while (!M.resultado) {
    const dt = 0.016;
    for (const l of ['derecha', 'izquierda']) {
      const prox = a.notas.find(n => !n.juzgada && lado.get(n) === l);
      if (st[l].dip) { st[l].dip = false; poner(m[l](), prox ? sobre(prox.carril, 0.26) : (l === 'derecha' ? REPOSO_D() : REPOSO_I()), false, false); continue; }
      if (prox && a.T + dt >= prox.t + 0.012 - 0.006) { poner(m[l](), sobre(prox.carril, 0.02), false, false); st[l].dip = true; continue; }
      poner(m[l](), prox && prox.t - a.T < 1.2 ? sobre(prox.carril, 0.26) : (l === 'derecha' ? REPOSO_D() : REPOSO_I()), false, false);
    }
    if (a.T > 3 && fotoUna('burbujas')) medir('burbujas');
    if (a.est.combo === 10 && fotoUna('racha')) medir('racha de 10');
    if (a.est.vuelta === 1 && a.T > 26 && fotoUna('segunda')) medir('segunda vuelta');
    yield;
  }
}
log(`partida 1: ${JSON.stringify(M.resultado)} · aciertos ${a.est.aciertos}, perfectos ${a.est.perfectos}, fallos ${a.est.fallos}, mejor racha ${a.est.mejorCombo}`);
if (!M.resultado.gana) throw new Error('la partida 1 no ganó');
if (a.est.fallos > 0) throw new Error('el bot perfecto ha fallado ' + a.est.fallos);
yield* esperar(0.5); foto('victoria');

// ---------------- «Otra vez» → partida 2: no toca nada ----------------
yield* tocarTarjeta('Otra vez');
yield* hasta(() => api() && api() !== a && api().fase === 'juego', 15);
a = api();
poner(der(), REPOSO_D(), false, false); poner(izq(), REPOSO_I(), false, false);
log('otra vez: partida nueva');
yield* hasta(() => { if (a.est.presion >= 5) fotoUna('hinchada'); return M.resultado; }, 40);
log(`partida 2: ${JSON.stringify(M.resultado)} · presión ${a.est.presion}`);
if (M.resultado.gana) throw new Error('la partida 2 ganó');
yield* esperar(0.3); foto('plop');

// ---------------- partida 3: abandonar a mitad ----------------
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api()?.fase === 'juego', 15);
  yield* esperar(2);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
if (M.resultados.length !== 3) throw new Error('faltan resultados: ' + M.resultados.length);
log('máximo de draw calls medido: ' + maxLlamadas);
log('FIN OK');
