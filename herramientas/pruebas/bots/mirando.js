// Bot de «Te están mirando»: tres partidas.
//   1) Se agacha DE VERDAD (baja la cabeza 20 cm) cuando un ojo cercano va a abrirse o se despierta, y en el barrido
//      espera agachado tras un cubo hasta que el ojo grande cierra; el segundo tramo lo hace con el gatillo (pinza)
//      en vez de con el cuerpo. Gana.
//   2) «Otra vez» tocando la tarjeta. No se agacha nunca: tres avistamientos y pierde.
//   3) Una partida nueva y abandonar() a los pocos segundos: termina con gana:false.
const DE_PIE = 1.5, AGACHADO = 1.3;
const cabeza = ag => M.mirar(0, ag ? AGACHADO : DE_PIE, 0.05, 0, ag ? -0.55 : -0.75);
cabeza(false);
const api = () => M.escena.getObjectByName('minijuego-mirando')?.userData.api;
const REPOSO = new T.Vector3(0.25, 1.0, -0.1);
poner(izq(), new T.Vector3(-0.35, 1.0, 0.05), false);
poner(der(), REPOSO.clone(), false);
yield* quieto(der(), 0.2);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
const fotos = new Set();
function* fotoUna(n, mantener = 0.3) { if (fotos.has(n)) return; fotos.add(n); foto(n); yield* quieto(der(), mantener, der().pinza); }

// ¿hay que pararse ahora?
function peligro(a) {
  const E = a.E, t = E.reloj;
  for (const o of a.ojos) {
    if (o.forzar) continue;
    if (o.tipo === 'grande') {
      const f = ((t + o.off) % o.P) / o.P;
      const libre = f < 0.6 ? (0.6 - f) * o.P : f >= 0.86 ? (1.6 - f) * o.P : 0;
      const cubo = a.refugios.find(r => Math.abs(E.px - r.x) < 45);
      const sig = Math.min(E.meta, ...a.refugios.filter(r => r.x > E.px + 50).map(r => r.x));
      const necesita = (sig - E.px) / a.vel + 0.35;
      if (cubo || E.px < 100) { if (libre < necesita) return true; }
      else if (libre < 0.15 && Math.abs(E.px - a.cono.cx) < a.cono.ancho + 120) return true;
      continue;
    }
    if (Math.abs(E.px - o.x) > o.rango + 45) continue;
    if (E.ventana > 0 && a.lasslow) continue;
    if (o.dormido) { if (o.despierto || o.ruido > 0.5) return true; continue; }
    if (o.cierre > 0.2 || a.apertura(((t + 0.3 + o.off) % o.P) / o.P) >= 0.4) return true;
  }
  return false;
}

function* partida(n) {
  yield* hasta(() => api() && !M.resultado, 15);
  const a = api();
  cabeza(false);
  if (n === 1) { yield* esperar(1.4); yield* fotoUna('demo'); }
  yield* hasta(() => a.fase === 'juego', 10);
  let agachadoAntes = false, conMano = 0, tramoAntes = 0;
  while (!['fin', 'perdiendo'].includes(a.fase)) {
    const E = a.E;
    if (E.tramo !== tramoAntes) { tramoAntes = E.tramo; log(`tramo ${E.tramo}: ${E.tipo} · ${E.puntos} pts · vistos ${E.vistos} · llamadas de dibujo ${M.renderer.info.render.calls}`); }
    const mano = n === 1 && E.tramo === 2;
    const ag = n === 1 && a.fase === 'juego' && peligro(a);
    if (mano) { cabeza(false); poner(der(), REPOSO.clone(), ag); if (ag) conMano += 1; }
    else { poner(der(), REPOSO.clone(), false); if (ag !== agachadoAntes) cabeza(ag); }
    agachadoAntes = ag && !mano;
    if (n === 1 && E.escondido && E.ocultoT > 0.4) yield* fotoUna('escondido', 0.05);
    if (n === 1 && E.tipo === 'barrido' && a.ojos[0]?.vigila) yield* fotoUna('barrido', 0.05);
    if (n === 2 && E.sosp > 80) yield* fotoUna('visto', 0.05);
    yield;
  }
  cabeza(false); poner(der(), REPOSO.clone(), false);
  const E = a.E;
  log(`partida ${n}: ${E.puntos} pts · tramos ${a.tipos.join(', ')} · vistos ${E.vistos} · pasos agachado con la mano ${conMano}`);
  if (n === 1 && !conMano) throw new Error('no se ha agachado con la mano');
  yield* hasta(() => M.resultado, 10);
  log('resultado ' + JSON.stringify(M.resultado));
  yield* esperar(1.9);
  yield* fotoUna('final' + n, 0.4);
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
log('tres partidas: ' + M.resultados.map(r => `${r.puntos} (${r.estrellas}★, gana ${r.gana})`).join(' · '));
log('FIN OK');
