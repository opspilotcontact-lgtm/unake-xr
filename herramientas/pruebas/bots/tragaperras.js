// Bot de «La tragaperras de Palicaso»: coge fichas del estante y las mete por la ranura, baja la palanca con la
// mano y prueba premio (tres iguales), Puky, Monchiman que salva, dos iguales con suspense, palanca sin ficha,
// ficha de más, «Me planto» (gana), «Otra vez», quedarse sin monchis (pierde) y abandonar() con los rodillos girando.
M.mirar(0, 1.6, 0, 0, -0.35);
const api = () => M.escena.getObjectByName('minijuego-tragaperras')?.userData.api;
const REPOSO = new T.Vector3(0.22, 1.15, -0.15);
poner(der(), REPOSO.clone(), false);
poner(izq(), new T.Vector3(-0.3, 1.0, -0.1), false);
yield* quieto(der(), 0.3);
const esperar = function* (s) { const t0 = M.t; yield* hasta(() => M.t - t0 >= s, s + 1); };

function* meter(a, i, debeEntrar = true) {
  const f = a.fichas[i];
  yield* hasta(() => f.estado === 'estante' && f.c.cogible, 5);
  yield* mover(der(), () => f.m.position.clone(), 0.4, false);
  yield* quieto(der(), 0.1, true);
  if (f.estado !== 'mano') throw new Error('no se ha cogido la ficha de ' + f.valor);
  yield* mover(der(), () => a.ranura(), 0.5, true);
  yield* hasta(() => f.estado !== 'mano', 2);
  yield* quieto(der(), 0.1, false);
  yield* mover(der(), REPOSO.clone(), 0.3, false);
  if (debeEntrar && f.estado !== 'entrando' && !a.E.credito) throw new Error('la ficha no ha entrado (' + f.estado + ')');
}
function* palanca(a, fotoLado = null) {
  yield* mover(der(), () => a.bola(0), 0.4, false);
  const t0 = M.t;
  while (M.t - t0 < 0.35) { poner(der(), a.bola(Math.min(1.4, (M.t - t0) / 0.35 * 1.4)), false, true); yield; }
  yield* quieto(der(), 0.1, false, true);
  if (fotoLado) { M.mirar(0.75, 1.55, -0.2, 1.0, -0.2); yield* quieto(der(), 0.4, false, true); foto(fotoLado); yield* quieto(der(), 0.6, false, true); M.mirar(0, 1.6, 0, 0, -0.35); }
  yield* mover(der(), REPOSO.clone(), 0.3, false, false);
}
function* tirada(a, i, ids, nombre) {
  const n0 = a.E.resultados.length, antes = a.bolsa.n;
  a.forzar(ids);
  yield* meter(a, i);
  if (a.E.credito !== a.fichas[i].valor) throw new Error('crédito ' + a.E.credito);
  yield* palanca(a, nombre === 'suspense' ? 'palanca-lado' : null);
  if (a.E.fase !== 'girando') throw new Error('la palanca no ha tirado (fase ' + a.E.fase + ')');
  if (nombre === 'premio') { yield* esperar(0.5); foto('girando'); log('llamadas de dibujo (girando): ' + M.renderer.info.render.calls); }
  yield* hasta(() => a.E.resultados.length === n0 + 1, 8);
  const r = a.E.resultados[n0];
  yield* hasta(() => a.rodillosQuietos(), 3);
  const vistas = a.caras().join(',');
  if (vistas !== ids.join(',')) throw new Error('los rodillos enseñan ' + vistas + ' y salió ' + ids.join(','));
  log(`${nombre}: ${r.ids.join(' ')} → ${r.tipo}, apuesta ${r.apuesta}, cobra ${r.cobro} · monchis ${antes} → ${a.bolsa.n}`);
  if (a.bolsa.n !== antes - r.apuesta + r.cobro) throw new Error('las cuentas no cuadran');
  if (['premio', 'puky', 'suspense'].includes(nombre)) { foto(nombre); yield* esperar(0.6); }
  yield* hasta(() => a.E.fase !== 'girando', 3);
}

// ---------- partida 1: varias tiradas y «Me planto» (gana) ----------
globalThis.__monederoApuestas = { n: 100 };
yield* hasta(() => api() && api().fase === 'libre', 15);
let a = api();
yield* esperar(0.6);
foto('inicio');
M.mirar(0, 1.6, 0, 0, -0.75); yield* esperar(0.3); foto('estante'); yield* esperar(0.6);
 M.mirar(0.9, 1.5, -0.1, 1.1, -0.15); yield* esperar(0.3); foto('lado'); yield* esperar(0.6); M.mirar(0, 1.6, 0, 0, -0.35);
// palanca sin ficha: no tira
yield* palanca(a);
if (a.E.tiradas !== 0) throw new Error('ha tirado sin ficha');
log('palanca sin ficha: no tira');
yield* tirada(a, 1, ['vuper', 'vuper', 'vuper'], 'premio');
yield* tirada(a, 0, ['puky', 'vuper', 'palicaso'], 'puky');
yield* tirada(a, 0, ['monchiman', 'vuper', 'palicaso'], 'salva');
yield* tirada(a, 2, ['perico', 'perico', 'cotine'], 'suspense');
// una ficha de más: la segunda no entra
yield* meter(a, 0);
yield* meter(a, 1, false);
if (a.E.credito !== 10) throw new Error('ha entrado una segunda ficha');
log('ficha de más: rechazada');
a.forzar(['blancaso', 'cotine', 'vuper']);
yield* palanca(a);
yield* hasta(() => a.E.resultados.length === 5 && a.E.fase === 'libre', 8);
log('neto: ' + (a.E.cobrado - a.E.apostado));
// «Me planto»
yield* mover(der(), () => a.boton(), 0.5, false);
yield* hasta(() => M.resultado, 4);
log('me planto: ' + JSON.stringify(M.resultado));
if (!M.resultado.gana) throw new Error('debía ganar');
yield* mover(der(), REPOSO.clone(), 0.3, false);
yield* esperar(0.5); foto('final1');

// ---------- «Otra vez» y sin monchis (pierde) ----------
yield* hasta(() => M.ui.tarjetas.length, 6);
const otra = M.ui.tarjetas.find(m => m.userData.texto === 'Otra vez');
const viejo = api();
yield* mover(der(), () => otra.position.clone(), 0.4, false);
yield* hasta(() => api() && api() !== viejo && !M.resultado, 8);
yield* mover(der(), REPOSO.clone(), 0.3, false);
a = api();
yield* hasta(() => a.fase === 'libre', 5);
log('otra vez: partida nueva con ' + a.bolsa.n + ' monchis');
a.bolsa.n = 15;
yield* meter(a, 1, false);
if (a.E.credito) throw new Error('ha entrado una ficha de 25 con 15 monchis');
log('ficha de 25 con 15 monchis: rechazada');
yield* tirada(a, 0, ['vuper', 'palicaso', 'blancaso'], 'pierde');
yield* hasta(() => M.resultado, 6);
log('sin monchis: ' + JSON.stringify(M.resultado) + ' · quedan ' + a.bolsa.n);
if (M.resultado.gana !== false) throw new Error('sin monchis debía perder');
yield* esperar(0.4); foto('pobre');
if (M.resultados.length !== 2) throw new Error('faltan resultados: ' + M.resultados.length);

// ---------- abandonar con los rodillos girando: la tirada se paga igual ----------
globalThis.__monederoApuestas.n = 100;
{
  const o = M.mod.crear; M.inst = null;
  M.mod.crear = async ctx => (M.inst = await o.call(M.mod, ctx));
  M.ui.quitarTarjetas?.(); M.reiniciar();
  yield* hasta(() => M.inst && !M.resultado && api()?.fase === 'libre', 10);
  a = api();
  a.forzar(['vuper', 'vuper', 'palicaso']);
  yield* meter(a, 1);
  yield* palanca(a);
  if (a.E.fase !== 'girando') throw new Error('no gira');
  M.inst.abandonar();
  yield* hasta(() => M.resultado, 3);
  if (M.resultado.gana !== false) throw new Error('abandonar no termina con gana:false');
  if (a.bolsa.n !== 100 - 25 + 50) throw new Error('abandonar no ha pagado la tirada: ' + a.bolsa.n);
  log('abandonar: ' + JSON.stringify(M.resultado) + ' · monchis ' + a.bolsa.n);
}
log('FIN OK');
