// Bot de «Las carreras de humo»: toca la pizarra con el dedo (corredor, ficha, «¡Salida!»), mira la carrera en
// la pista de la mesa, agita el puño para animar y prueba: gana (el de cuota más alta), pierde, «Otra carrera»,
// ficha que no puedes pagar, «Me planto» (gana), «Otra vez», quedarse sin monchis (pierde) y abandonar() a mitad.
M.mirar(0, 1.6, 0, 0, -0.6);
const api = () => M.escena.getObjectByName('minijuego-carrera')?.userData.api;
const REPOSO = new T.Vector3(0.28, 1.1, -0.05);
poner(der(), REPOSO.clone(), false);
poner(izq(), new T.Vector3(-0.3, 1.0, -0.05), false);
yield* quieto(der(), 0.3);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };
function* tocar(punto) {
  yield* mover(der(), () => punto(0.07), 0.3, false);
  yield* mover(der(), () => punto(0.004), 0.15, false);
  yield* quieto(der(), 0.08);
  yield* mover(der(), () => punto(0.08), 0.15, false);
}
function* agitar(seg) {
  const t0 = M.t, c = der().pos.clone();
  while (M.t - t0 < seg) { const k = Math.floor((M.t - t0) / 0.06) % 2; poner(der(), c.clone().add(new T.Vector3(k ? 0.12 : -0.12, 0, 0)), false, true); yield; }
}
function* carrera(a, carta, chip, gana, fotos = false) {
  const n0 = a.E.resultados.length, antes = a.bolsa.n;
  yield* tocar(z => a.carta(carta, z));
  if (a.E.mio !== carta) throw new Error('no se ha elegido el corredor ' + carta);
  yield* tocar(z => a.chip(chip, z));
  const apuesta = [10, 25, 50, 100, 250][chip];
  if (a.E.apuesta !== apuesta) throw new Error('no se ha elegido la ficha ' + apuesta);
  if (fotos) { yield* esperar(0.2); foto('elegido'); yield* esperar(0.5); }
  a.forzar(gana ? carta : (carta + 1) % 5);
  yield* tocar(z => a.salida(z));
  if (a.E.fase !== 'cuenta') throw new Error('no ha salido (fase ' + a.E.fase + ')');
  yield* mover(der(), REPOSO.clone(), 0.3, false);
  if (fotos) { M.mirar(0, 1.5, -0.25, 0, -0.85); yield* esperar(0.9); foto('cuenta'); }
  yield* hasta(() => a.E.fase === 'corriendo', 5);
  yield* esperar(1.2);
  const animos = a.E.animos;
  yield* agitar(0.5);
  if (a.E.animos <= animos) throw new Error('agitar el puño no anima');
  if (fotos) { foto('carrera'); log('llamadas de dibujo (carrera): ' + M.renderer.info.render.calls); }
  yield* mover(der(), REPOSO.clone(), 0.3, false);
  yield* hasta(() => a.E.resultados.length === n0 + 1, 9);
  const r = a.E.resultados[n0];
  log(`carrera: ${r.mio} (x${r.cuota}) con ${r.apuesta} · gana ${r.ganador} · cobra ${r.cobro} · monchis ${antes} → ${a.bolsa.n} · ánimos ${a.E.animos}`);
  if (a.bolsa.n !== antes - r.apuesta + r.cobro) throw new Error('las cuentas no cuadran');
  if (gana !== (r.cobro > 0) || (gana && r.cobro !== Math.round(apuesta * r.cuota))) throw new Error('cobro mal');
  if (fotos) { yield* esperar(0.4); foto('meta'); yield* esperar(0.6); }
  M.mirar(0, 1.6, 0, 0, -0.6);
  yield* hasta(() => a.E.fase === 'fin' || M.resultado, 4);
}

// ---------- partida 1: gana, pierde y «Me planto» ----------
globalThis.__monederoApuestas = { n: 100 };
yield* hasta(() => api() && api().fase === 'elegir', 15);
let a = api();
yield* esperar(1.0);
foto('pizarra');
yield* esperar(0.5);
const mejor = a.carriles.reduce((m, c, i, l) => c.cuota > l[m].cuota ? i : m, 0);
yield* carrera(a, mejor, 2, true, true);
yield* tocar(z => a.salida(z)); // «Otra carrera»
if (a.E.fase !== 'elegir') throw new Error('«Otra carrera» no funciona');
log('otra carrera: ' + a.carriles.map(c => c.nombre + ' x' + c.cuota).join(', '));
yield* carrera(a, 0, 0, false);
yield* tocar(z => a.planto(z));
yield* hasta(() => M.resultado, 4);
log('me planto: ' + JSON.stringify(M.resultado));
if (!M.resultado.gana) throw new Error('debía ganar');
yield* mover(der(), REPOSO.clone(), 0.3, false);
yield* esperar(0.4); foto('final1'); yield* esperar(0.4);

// ---------- «Otra vez» y sin monchis (pierde) ----------
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
yield* mover(der(), REPOSO.clone(), 0.3, false);
a = api();
yield* hasta(() => a.fase === 'elegir', 5);
log('otra vez: partida nueva con ' + a.bolsa.n + ' monchis');
a.bolsa.n = 15;
yield* tocar(z => a.chip(2, z));
if (a.E.apuesta === 50) throw new Error('ficha de 50 con 15 monchis');
log('ficha de 50 con 15 monchis: rechazada');
yield* carrera(a, 1, 0, false);
yield* hasta(() => M.resultado, 7);
log('sin monchis: ' + JSON.stringify(M.resultado) + ' · quedan ' + a.bolsa.n);
if (M.resultado.gana !== false) throw new Error('sin monchis debía perder');
yield* esperar(0.3); foto('pobre'); yield* esperar(0.4);
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);

// ---------- abandonar a mitad de carrera: se resuelve igual ----------
globalThis.__monederoApuestas.n = 100;
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api()?.fase === 'elegir', 10);
  a = api();
  yield* tocar(z => a.carta(0, z));
  yield* tocar(z => a.chip(1, z));
  a.forzar(0);
  yield* tocar(z => a.salida(z));
  yield* hasta(() => a.E.fase === 'corriendo', 5);
  yield* esperar(1);
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  const esperado = 100 - 25 + Math.round(25 * a.carriles[0].cuota);
  if (a.bolsa.n !== esperado) throw new Error('abandonar no ha pagado la carrera: ' + a.bolsa.n + ' ≠ ' + esperado);
  log('abandonar: ' + JSON.stringify(M.resultado) + ' · monchis ' + a.bolsa.n);
}
log('FIN OK');
