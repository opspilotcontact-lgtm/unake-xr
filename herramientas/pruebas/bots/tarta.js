// Bot de «La tarta entera»: la mano derecha lleva el plato. Partida 1: atrapa los pisos de la receta (esquivando
// colillas), lleva las patatas a la boca de Cotine, sirve dos tartas y luego se deja caer colillas → gana.
// «Otra vez» tocando la tarjeta. Partida 2: no sirve ninguna (atrapa colillas, no le da de comer) → pierde.
// Al final, una partida nueva y abandonar() → gana:false. Cuenta las llamadas de dibujo.
M.mirar(0, 1.6, 0, 0, -0.35);
const api = () => M.escena.getObjectByName('minijuego-tarta')?.userData.api;
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const VEL = 1.6; // m/s de la mano del bot (como una persona)
poner(izq(), new T.Vector3(-0.3, 0.9, -0.1), false);
poner(der(), new T.Vector3(0.16, 1.15, -0.32), false);

// mueve la mano derecha hacia `meta` (local de la sala) a velocidad humana, un fotograma
function paso(a, meta) {
  const m = der(), destino = a.aMundo(meta.clone());
  const d = destino.clone().sub(m.pos), L = d.length(), max = VEL * 0.016 * 1.2;
  poner(m, L > max ? m.pos.clone().addScaledVector(d, max / L) : destino, false);
}

function elegir(a, modo) {
  const E = a.E, cy = a.altoCaptura(), toca = E.pasos[E.hecho];
  let mejor = null, tMejor = 1e9;
  for (const o of a.cayendo) {
    if (o.p.y < cy - 0.02) continue;
    const t = (o.p.y - cy) / o.vy;
    let quiero;
    if (modo === 'ganar') quiero = (o.tipo !== 'colilla' && o.clave === toca) || (o.tipo === 'patatas' && E.hambre > 35 && E.patatasPlato < 2);
    else quiero = o.tipo === 'colilla';
    if (!quiero) continue;
    const x = o.p.x + (o.vx || 0) * t, z = o.p.z;
    if (modo === 'ganar') {
      // que no caiga una colilla en el mismo sitio a la vez
      const peligro = a.cayendo.some(c => c.tipo === 'colilla' && Math.abs((c.p.y - cy) / c.vy - t) < 0.6 && Math.hypot(c.p.x - x, c.p.z - z) < 0.2);
      if (peligro) continue;
    }
    const lejos = Math.hypot(x - a.plato.position.x, z - a.plato.position.z) / VEL;
    if (lejos > t + 0.05) continue;     // no llega
    if (t < tMejor) { tMejor = t; mejor = { x, z, t, o }; }
  }
  return mejor;
}

function* jugar(modo, hastaQue, max) {
  const a = api();
  const t0 = M.t;
  while (!hastaQue(a)) {
    if (M.t - t0 > max) throw new Error('timeout jugando ' + modo + ' · ' + JSON.stringify({ s: a.E.servidas, v: a.E.vidas, h: a.E.hecho }));
    const E = a.E, yPlato = 1.15;
    let meta;
    const boca = a.bocaLocal();
    if (modo === 'ganar' && E.patatasPlato && (E.hambre > 40 || E.patatasPlato >= 2)) meta = boca.clone().add(new T.Vector3(0.06, -0.06, 0.06));
    else {
      const o = elegir(a, modo);
      if (o) meta = new T.Vector3(o.x, yPlato, o.z);
      else {
        // en reposo: lejos de lo que cae (y de las colillas)
        meta = new T.Vector3(0.16, yPlato, -0.18);
        if (modo === 'ganar') for (const c of a.cayendo) if (c.tipo === 'colilla' && Math.hypot(c.p.x - meta.x, c.p.z - meta.z) < 0.18) meta.x = c.p.x > 0.16 ? 0.0 : 0.36;
      }
    }
    paso(a, meta);
    yield;
  }
}

let llamadas = 0;
function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  yield* hasta(() => a.E.activo, 10);
  if (n === 1) {
    foto('inicio');
    yield* jugar('ganar', a => a.E.servidas >= 1 && a.E.hecho >= 1, 120);
    llamadas = M.renderer.info.render.calls;
    log(`llamadas de dibujo (en juego): ${llamadas}`);
    foto('pila');
    yield* jugar('ganar', a => a.E.servidas >= 1 && a.E.hecho >= 2, 120);
    foto('pila2');
    yield* jugar('ganar', a => a.E.servidas >= 2, 150);
    log(`dos tartas servidas · ${a.E.puntos} pts · vidas ${a.E.vidas} · comidas ${a.E.comidas}`);
    yield* esperar(0.2); foto('servida'); yield* esperar(0.4);
    M.mirar(0, 1.6, 0, 0.5, -0.25); yield* esperar(0.3); foto('cotine'); yield* esperar(0.6);
    M.mirar(0, 1.6, 0, 0, 0); yield* esperar(0.3); foto('cartel'); yield* esperar(0.6); M.mirar(0, 1.6, 0, 0, -0.35);
    yield* jugar('perder', () => M.resultado || a.acabado, 150);
  } else {
    yield* jugar('perder', () => M.resultado || a.acabado, 150);
  }
  yield* hasta(() => M.resultado, 6);
  log(`partida ${n}: ` + JSON.stringify(M.resultado) + ` · servidas ${a.E.servidas}`);
  yield* esperar(0.5);
  foto('final' + n);
}

yield* partida(1);
if (!M.resultado.gana) throw new Error('la partida 1 debía ganarse');
// «Otra vez»: tocar la tarjeta con el dedo
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
log('otra vez: partida nueva');
poner(der(), new T.Vector3(0.16, 1.15, -0.32), false);
yield* partida(2);
if (M.resultado.gana !== false) throw new Error('la partida 2 debía perderse');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);
// salir a mitad
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado, 10);
  yield* esperar(5);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  log('abandonar: ' + JSON.stringify(M.resultado));
}
log('FIN OK');
