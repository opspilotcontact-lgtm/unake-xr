// UNAKÉ XR · F0. Arranque, bucle y director de la prueba:
//   tu casa (de día, passthrough) → la puerta de Unaké en tu pared → la contraseña en bucle → empujas →
//   salen Lasslow y Blancaso (personas, de día) → liar con las manos → encender → caladas y pasarlo →
//   con colocón ≥ 30 la habitación se llena de humo y estás en Unaké (el humo: criaturas, sala de la serie)
//   → el colocón baja → el humo se va y vuelves a tu casa. Y vuelta a empezar.
import * as THREE from 'three';
import { montarXR } from './xr.js';
import { Recortable } from './recortable.js';
import { Humo } from './humo.js';
import { UI } from './ui.js';
import { Puerta } from './puerta.js';
import { Liar, Mechero, NIVELES_CALADA, CENTRO_CALADA, nivelDe } from './porro.js';
import { montarUnake } from './decorado.js';
import { prepararAudio, sonido, musica, letraLista, fijarAnisotropia, precargarSonidos, audio } from './recursos.js';
import { activarMicro, leerMicro, hayMicro } from './microfono.js';

const $ = id => document.getElementById(id);
const avisoEl = $('aviso');
function aviso(t, ms = 5000) { avisoEl.textContent = t; avisoEl.hidden = false; clearTimeout(aviso._t); aviso._t = setTimeout(() => { avisoEl.hidden = true; }, ms); }
window.addEventListener('error', e => console.error('[unake]', e.message));

// ---------- render ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
fijarAnisotropia(renderer.capabilities.getMaxAnisotropy());
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 80);
camara.position.set(0, 1.6, 0);
escena.add(camara);
const oyente = new THREE.AudioListener(); camara.add(oyente);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
const COLOR_ESCRITORIO = new THREE.Color('#1a1426');
escena.background = COLOR_ESCRITORIO;

// «tu casa» cuando no hay passthrough (modo solo VR o el PC): un suelo neutro
const casaFalsa = new THREE.Group();
{
  const rejilla = new THREE.GridHelper(12, 24, '#8a8070', '#b9b0a0'); casaFalsa.add(rejilla);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: '#d8cfbf' }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.002; casaFalsa.add(suelo);
}
escena.add(casaFalsa);

// ---------- piezas ----------
const ui = new UI(escena);
const xr = montarXR(renderer, escena, camara, { alEntrar, alSalir, aviso });
const manos = () => [xr.manos.derecha, xr.manos.izquierda];
let humo, puerta, unake, lasslow, blancaso;

// ---------- estado del director ----------
const J = {
  fase: 'portada', mundo: 'normal', colocon: 0, modo: null,
  t: 0, enFase: 0,
  dirPuerta: new THREE.Vector3(0, 0, -1), origen: new THREE.Vector3(),
  sitios: [], liar: null, porro: null, mechero: null, manoMechero: null,
  calada: null, encendiendo: 0, cola: [], tareas: [],
  pasesSinPasar: 0, vueltas: 0, transicion: false,
};
window.__unake = J; // para pruebas
J.THREE = THREE;
J.obj = () => ({ puerta, lasslow, blancaso, ui, humo, xr, unake, renderer });

// líneas con baraja sin repetir (criterio §4)
const barajas = new Map();
function sinRepetir(clave, lista) {
  let b = barajas.get(clave);
  if (!b || !b.length) { b = [...lista].sort(() => Math.random() - 0.5); barajas.set(clave, b); }
  return b.pop();
}
const FRASES = {
  bien: [['blancaso', 'Eso. Apuntado.'], ['lasslow', 'Qué bien sienta esto.'], ['blancaso', 'Suave, suave…']],
  epica: [['lasslow', '¡Un aro! Redondo y todo.'], ['blancaso', 'Eso va a la agenda. En la página buena.'], ['lasslow', 'El humo sabe geometría.']],
  tos: [['blancaso', 'Otra vez no…'], ['lasslow', 'Perdón, perdón. Es que…'], ['blancaso', 'Tos número tres. Apuntada.']],
  pide: [['lasslow', '¿Me lo pasas o qué?'], ['blancaso', 'Eso se pasa. Hay normas.'], ['lasslow', 'Yo solo una. Un señor solo da una.']],
  devuelve: [['lasslow', 'Toma, toma. Que se apaga.'], ['blancaso', 'Te lo devuelvo. Lo he contado.'], ['lasslow', 'Uy. Uy. Toma.']],
  humo: [['lasslow', '…¿Habéis visto eso?'], ['blancaso', 'Ya estamos en casa.'], ['lasslow', 'Esto empieza a tener color.']],
  dia: [['blancaso', '¿Ya? Qué bajón.'], ['lasslow', 'Vuelve a ser martes.'], ['blancaso', 'Se acabó la noche. Apuntado.']],
};
function di(personaje, texto) {
  const p = personaje === 'lasslow' ? lasslow : blancaso;
  return p?.decir(texto);
}
function frase(tipo) { const [quien, texto] = sinRepetir(tipo, FRASES[tipo]); return di(quien, texto); }
const espera = s => new Promise(ok => setTimeout(ok, s * 1000));

// ---------- carga ----------
async function cargar() {
  await letraLista();
  [humo, puerta, unake, lasslow, blancaso] = await Promise.all([
    Humo.crear(escena), Puerta.crear(), montarUnake(),
    Recortable.crear('lasslow', 'normal'), Recortable.crear('blancaso', 'normal'),
  ]);
  escena.add(puerta.grupo, unake.grupo, lasslow.grupo, blancaso.grupo);
  puerta.grupo.visible = false; unake.grupo.visible = false; lasslow.grupo.visible = false; blancaso.grupo.visible = false;
  precargarSonidos(['toc-toc', 'pin-pin', 'puerta', 'chof', 'papel', 'sorbo', 'mechero', 'mechero-falla', 'fup', 'calada', 'tos', 'tos-grande', 'risa-lasslow', 'fiuuu', 'whoosh', 'campanita', 'pop']);
}
const listo = cargar().catch(e => { console.error(e); aviso('Error cargando: ' + e.message, 20000); });

// ---------- portada ----------
function comprobarSoporte() {
  if (!navigator.xr) { $('estadoXR').textContent = 'Este navegador no tiene WebXR: abrilo en el navegador de las Quest.'; return; }
  navigator.xr.isSessionSupported('immersive-ar').then(v => { $('btnAR').disabled = !v; if (v) $('estadoXR').textContent = 'Gafas listas.'; }).catch(() => { });
  navigator.xr.isSessionSupported('immersive-vr').then(v => { $('btnVR').disabled = !v; }).catch(() => { });
}
comprobarSoporte();
navigator.xr?.addEventListener?.('devicechange', comprobarSoporte);
$('btnAR').addEventListener('click', () => { prepararAudio(oyente); xr.entrar('ar'); });
$('btnVR').addEventListener('click', () => { prepararAudio(oyente); xr.entrar('vr'); });
$('chkMicro').checked = false;
$('chkMicro').addEventListener('change', async e => {
  if (!e.target.checked) return;
  prepararAudio(oyente);
  const ok = await activarMicro(audio());
  if (!ok) { e.target.checked = false; aviso('Sin micro: soltarás el humo solo, sin soplar.'); }
});

async function alEntrar(modo) {
  await listo;
  J.modo = modo;
  $('portada').hidden = true;
  escena.background = modo === 'ar' ? null : new THREE.Color('#e6dfd2');
  casaFalsa.visible = modo !== 'ar';
  empezar();
}
function alSalir() {
  $('portada').hidden = false; escena.background = COLOR_ESCRITORIO; casaFalsa.visible = true;
  musica(null); J.fase = 'portada';
}

// ---------- fases ----------
function fase(f) { J.fase = f; J.enFase = 0; }

async function empezar() {
  fase('buscarPared');
  ui.cartela('Tu casa. De día. Mira a una pared libre.', 3.5);
  musica('dia', 0.25);
}

function colocarPuerta() {
  const pared = xr.paredDelante();
  let punto, normal;
  if (pared) { punto = pared.punto; normal = pared.normal; }
  else {
    // sin paredes detectadas: delante, a 2,2 m, de pie
    const f = xr.adelante.clone().setY(0).normalize();
    punto = xr.cabeza.clone().addScaledVector(f, 2.2).setY(0); normal = f.clone().negate();
  }
  puerta.colocar(punto, normal);
  puerta.grupo.visible = true;
  J.dirPuerta.copy(normal).negate();
  J.origen.copy(xr.cabeza).setY(0);
  sonido('neon', { en: puerta.grupo, volumen: 0.4 });
  fase('contrasena');
  bucleContrasena();
}

// la contraseña en bucle (escenas/puerta.js y contrasena.js del 2D)
const RONDAS = [
  { perico: 'Contraseña. Contraseña. Contraseña…', ops: ['¿…Unaké?', 'Una moto', 'De mi primo'], bien: 0, luego: '¿Una quéeeee?' },
  { perico: null, ops: ['¿Una… aso?', 'Una casa', 'Un bar'], bien: 0, luego: '¿De quién? ¿De quién?' },
  { perico: null, ops: ['De los hermanos Aso', 'Palito y Blanquito', '«De…»'], bien: -1, luego: 'Nuevo. Nuevo. Te lo explico. Te lo explico.' },
];
async function bucleContrasena() {
  await espera(1.2);
  for (let r = 0; r < RONDAS.length; r++) {
    const R = RONDAS[r];
    if (R.perico) { puerta.perico(R.perico); await espera(2.2); }
    ui.instruccion('Contesta tocando una tarjeta');
    let fallos = 0;
    for (; ;) {
      const elegida = await elegir(R.ops);
      ui.instruccion(null);
      if (R.bien < 0 || elegida === R.bien || fallos >= 1) break;
      fallos++;
      puerta.perico('¿Una qué?'); sonido('pin-pin', { en: puerta.mirilla, volumen: 0.6 });
      await espera(1.8);
    }
    puerta.perico(R.luego); if (r === 0) sonido('pin-pin', { en: puerta.mirilla, volumen: 0.6 });
    await espera(2.4);
  }
  ui.cartela('La puerta no tiene cerradura. Ni pestillo. No los ha tenido nunca.', 5);
  await espera(1.5);
  ui.instruccion('Empuja la puerta con la mano (o señálala y pellizca)');
  puerta.empujable = true;
  puerta.alEmpujar = abrirPuerta;
  fase('empujar');
}
function elegir(ops) {
  return new Promise(ok => {
    const hacia = J.dirPuerta.clone();
    const centro = xr.cabeza.clone().addScaledVector(hacia.clone().setY(0).normalize(), 0.42);
    centro.y = Math.max(0.8, xr.cabeza.y - 0.25);
    // barajadas: la buena no siempre en el mismo sitio; se devuelve el índice original
    const orden = ops.map((_, i) => i).sort(() => Math.random() - 0.5);
    ui.tarjetasEn(orden.map(i => ops[i]), centro, hacia.clone().negate(), (texto, i) => { sonido('pop', { volumen: 0.5 }); ok(orden[i]); });
  });
}

async function abrirPuerta() {
  ui.instruccion(null);
  puerta.abrir();
  fase('salen');
  // el humo de dentro sale por el hueco
  const hueco = puerta.delante(0.05, 1.0), fuera = puerta.haciaFuera();
  for (let i = 0; i < 26; i++) setTimeout(() => humo.soltar({ pos: hueco.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.3) * 1.2, 0)), vel: fuera.clone().multiplyScalar(0.4 + Math.random() * 0.5), tam: 0.15, vida: 3 + Math.random() * 2, crece: 0.25, sube: 0.08, frena: 0.6 }), i * 60);
  musica('unake', 0.3);
  await espera(1.4);
  // sitios: entre tú y la puerta, a un brazo y medio, uno a cada lado
  const d = Math.max(0.9, Math.min(1.3, puerta.grupo.position.distanceTo(J.origen) - 0.4));
  const f = J.dirPuerta.clone().setY(0).normalize(), lat = new THREE.Vector3(-f.z, 0, f.x);
  J.sitios = [J.origen.clone().addScaledVector(f, d).addScaledVector(lat, -0.5), J.origen.clone().addScaledVector(f, d).addScaledVector(lat, 0.5)];
  await Promise.all([salir(lasslow, J.sitios[0], 0), salir(blancaso, J.sitios[1], 0.7)]);
  await blancaso.decir('Llegas tarde. Lo he apuntado.');
  sonido('risa-lasslow', { en: lasslow.grupo, volumen: 0.5 });
  await lasslow.decir('Perdón. Perdón. Es que… la puerta.');
  await blancaso.decir('¿Liamos uno o qué?');
  sacarBandeja();
}
async function salir(p, sitio, retraso) {
  await espera(retraso);
  const desde = puerta.delante(0.1, 0).setY(0);
  p.grupo.position.copy(desde); p.grupo.visible = true;
  p.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), J.dirPuerta.clone().negate().setY(0).normalize());
  await p.pose('caminando', { rebote: 0.1 });
  const T = 2.2;
  J.tareas.push({
    t: 0, dur: T, alAvanzar: k => {
      p.grupo.position.lerpVectors(desde, sitio, k);
      p.grupo.position.y = Math.abs(Math.sin(k * Math.PI * 5)) * 0.035;
    },
  });
  await espera(T);
  p.grupo.position.copy(sitio);
  await p.pose('base', { rebote: 0.18 });
}

function sacarBandeja() {
  if (J.liar) escena.remove(J.liar.grupo);
  J.liar = new Liar();
  const mesa = xr.mesaCerca();
  const f = J.dirPuerta.clone().setY(0).normalize();
  let punto;
  if (mesa) punto = mesa.punto.clone().setY(mesa.punto.y + 0.008);
  else { punto = xr.cabeza.clone().addScaledVector(f, 0.4); punto.y = Math.max(0.62, xr.cabeza.y - 0.62); }
  J.liar.colocar(punto, f.clone().negate());
  escena.add(J.liar.grupo);
  J.liar.alCambiarPaso = pasoLiar;
  fase('liar');
  pasoLiar('picar');
  sonido('campanita', { volumen: 0.4 });
}
const INSTR_LIAR = {
  picar: 'Dale palmadas al montón',
  rellenar: 'Pellizca encima del papel; suelta cuando esté lleno',
  liar: 'Pasa la mano por encima del papel, de lado a lado',
  coger: 'Cógelo con un pellizco',
  cerrar: 'Llévatelo a la boca para cerrarlo',
};
function pasoLiar(p) {
  ui.instruccion(INSTR_LIAR[p] || null);
  if (p === 'rellenar') di('blancaso', 'Seis. Apuntado.');
  if (p === 'liar') di('lasslow', 'No muy gordo, que luego…');
  if (p === 'hecho') { ui.instruccion(null); }
}

function darMechero() {
  J.manoMechero = J.porro.mano === xr.manos.derecha ? xr.manos.izquierda : xr.manos.derecha;
  J.mechero = new Mechero(); escena.add(J.mechero.grupo);
  fase('encender'); J.encendiendo = 0;
  ui.instruccion('Pellizca con la otra mano para sacar llama');
}

// ---------- caladas ----------
function dejarDeFumar() { ui.medir(null); }
function iniciarCalada() {
  J.calada = { valor: 0, t: 0, estado: 'dentro' };
  sonido('calada', { volumen: 0.7 });
}
function acabarCalada() {
  const c = J.calada; if (!c) return;
  const nivel = nivelDe(c.valor);
  const idx = nivel ? NIVELES_CALADA.indexOf(nivel) : -1;
  J.porro.gastar();
  if (!nivel) {
    if (c.valor < 25) { J.calada = null; dejarDeFumar(); return; } // ni la ha probado: no cuenta
    J.colocon += 4; ui.cartela('Floja.', 1.2);
    humo.exhalar(xr.boca(), xr.adelante, 0.25);
    J.calada = null; dejarDeFumar(); return;
  }
  J.colocon += nivel.sube * (J.porro.calidad ?? 1);
  ui.cartela('¡' + nivel.nombre + '!', 1.6);
  sonido(idx >= 3 ? 'oooh' : 'campanita', { volumen: 0.5 });
  c.estado = 'aguanta'; c.t = 0; c.nivel = nivel; c.idx = idx;
  if (hayMicro()) ui.instruccion('Sopla para soltarlo');
}
function soltarHumo(fuerza) {
  const c = J.calada; ui.instruccion(null);
  const boca = xr.boca(), dir = xr.adelante.clone();
  humo.exhalar(boca, dir, Math.max(0.35, fuerza));
  sonido('fiuuu', { volumen: 0.35 });
  const aros = Math.min(3, c.idx);
  for (let i = 0; i < aros; i++) setTimeout(() => humo.aro(xr.boca(), xr.adelante.clone(), 0.04 + i * 0.01), 380 + i * 420);
  if (c.idx >= 3) frase('epica'); else if (Math.random() < 0.6) frase('bien');
  J.calada = null; dejarDeFumar();
  J.pasesSinPasar++;
  if (J.pasesSinPasar >= 2 && !J.pidio) { J.pidio = true; setTimeout(() => frase('pide'), 1500); }
}
function toser() {
  J.porro.gastar();
  J.colocon += 3;
  sonido('tos-grande', { volumen: 0.8 });
  const boca = xr.boca();
  for (let i = 0; i < 3; i++) setTimeout(() => humo.exhalar(xr.boca(), xr.adelante.clone().add(new THREE.Vector3(0, -0.3, 0)), 0.9), i * 280);
  lasslow.pose('riendo', { rebote: 0.25 }); sonido('risa-lasslow', { en: lasslow.grupo, volumen: 0.6 });
  setTimeout(() => lasslow.pose('base'), 2200);
  frase('tos');
  J.calada = null; dejarDeFumar();
}

function pasoFumar(dt) {
  const porro = J.porro; if (!porro) return;
  const boca = xr.boca();
  const enLabios = porro.mano && porro.boquillaMundo(_a).distanceTo(boca) < 0.065;
  const c = J.calada;
  if (!c) {
    if (enLabios && porro.encendido && !J.transicion) iniciarCalada();
  } else if (c.estado === 'dentro') {
    const nivel = nivelDe(c.valor);
    const freno = nivel ? [1, 1, 1, 0.6, 0.45, 0.32, 0.3][NIVELES_CALADA.indexOf(nivel)] : 1;
    c.valor += dt * 44 * freno;
    ui.medir(c.valor, NIVELES_CALADA, CENTRO_CALADA, xr.cabeza, xr.cabezaQ);
    if (Math.random() < dt * 12) porro.mano?.vibrar(0.12, 12);
    if (c.valor >= 100) toser();
    else if (porro.boquillaMundo(_a).distanceTo(boca) > 0.09) acabarCalada();
  } else if (c.estado === 'aguanta') {
    c.t += dt;
    const mic = leerMicro(dt);
    if (mic.sopla) soltarHumo(0.5 + mic.nivel);
    else if (c.t > (hayMicro() ? 4 : 1.1)) soltarHumo(0.4 + c.idx * 0.1);
  }
  // pasarlo: la boquilla cerca de la boca de un colega
  if (!J.calada && porro.mano && porro.encendido) {
    for (const p of [lasslow, blancaso]) {
      if (porro.boquillaMundo(_a).distanceTo(p.bocaMundo(_b)) < 0.22) { pasar(p); break; }
    }
  }
  if (porro.consumido && !J.calada && porro.mano) acabarPorro();
}

async function pasar(p) {
  const porro = J.porro;
  porro.mano.vibrar(0.5, 40);
  porro.mano = null; J.pasesSinPasar = 0; J.pidio = false;
  J.enManos = p;
  await p.pose('fumando-calada', { rebote: 0.15 });
  await espera(1.3);
  await p.pose('fumando-aguanta', { rebote: 0.1 });
  porro.gastar();
  await espera(1.0);
  await p.pose('fumando-suelta', { rebote: 0.2 });
  const hacia = xr.cabeza.clone().sub(p.bocaMundo(_b)).normalize().add(new THREE.Vector3(0, 0.5, 0)).normalize();
  humo.exhalar(p.bocaMundo(new THREE.Vector3()), hacia, 0.55);
  if (p === blancaso && J.mundo === 'humo' && Math.random() < 0.4) { await espera(1); await p.pose('derritiendose', { rebote: 0.2 }); di('blancaso', 'Estoy bien. Estoy bien.'); await espera(1.6); }
  else await espera(1.2);
  await p.pose('base', { rebote: 0.15 });
  frase('devuelve');
  J.colocon += 2; // el ambiente también cuenta
  J.enManos = null; J.ofrecido = true; // flota delante de ti hasta que lo coges
}

function acabarPorro() {
  const porro = J.porro;
  humo.exhalar(porro.puntaMundo(), new THREE.Vector3(0, 1, 0), 0.4);
  escena.remove(porro.grupo); J.porro = null;
  di('blancaso', 'Se acabó. Lo he contado: ocho.');
  setTimeout(() => { if (!J.porro && J.fase !== 'portada') sacarBandeja(); }, 3500);
}

// ---------- los dos mundos ----------
function cambiarMundo(aHumo) {
  if (J.transicion) return;
  J.transicion = true;
  sonido('whoosh', { volumen: 0.6 });
  humo.llenar(xr.cabeza.clone(), async () => {
    if (aHumo) {
      // Unaké alrededor de ti, mirando a donde estaban ellos
      unake.grupo.position.copy(xr.cabeza).setY(0);
      unake.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), J.dirPuerta.clone().setY(0).normalize());
      unake.actualizarProyector();
      unake.grupo.visible = true; puerta.grupo.visible = false; casaFalsa.visible = false;
      escena.background = new THREE.Color('#231a33');
      const asientos = unake.asientos.map(a => unake.grupo.localToWorld(a.clone()));
      for (const [p, a] of [[lasslow, asientos[0]], [blancaso, asientos[1]]]) { p.grupo.position.copy(a); await p.ponerMundo('humo'); }
      J.mundo = 'humo'; musica('sofa', 0.32);
      setTimeout(() => frase('humo'), 1600);
    } else {
      humo.disiparAmbiente();
      unake.grupo.visible = false; puerta.grupo.visible = true; casaFalsa.visible = J.modo !== 'ar';
      escena.background = J.modo === 'ar' ? null : new THREE.Color('#e6dfd2');
      for (const [p, s] of [[lasslow, J.sitios[0]], [blancaso, J.sitios[1]]]) { p.grupo.position.copy(s); await p.ponerMundo('normal'); }
      J.mundo = 'normal'; musica('dia', 0.25);
      setTimeout(() => frase('dia'), 1400);
    }
    J.transicion = false;
  });
}

// ---------- bucle ----------
const reloj = new THREE.Clock();
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
renderer.setAnimationLoop((t, frame) => {
  const dt = Math.min(0.05, reloj.getDelta());
  J.t += dt; J.enFase += dt;
  if (xr.sesion) xr.paso(frame, dt);
  else {
    xr.cabeza.copy(camara.position); xr.cabezaQ.copy(camara.quaternion); xr.adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
    if (J.bot) { try { J.bot(dt, xr.manos); } catch (e) { console.error('bot', e); J.bot = null; } } // pruebas: manos simuladas
  }
  try { director(dt); } catch (e) { if (!director._visto) { director._visto = true; console.error('director', e); } }
  renderer.render(escena, camara);
});

function director(dt) {
  if (!humo) return;
  const cab = xr.cabeza, ms = manos();
  humo.mirarDesde(cab); humo.actualizar(dt);
  ui.actualizar(dt, cab, xr.cabezaQ, ms);
  for (const p of [lasslow, blancaso]) p.actualizar(dt, cab);
  for (const ta of J.tareas) { ta.t += dt; ta.alAvanzar(Math.min(1, ta.t / ta.dur)); }
  J.tareas = J.tareas.filter(ta => ta.t < ta.dur);
  if (puerta.grupo.visible) puerta.actualizar(dt, cab, ms);
  // empujar desde lejos: señalar la puerta y pellizcar
  if (J.fase === 'empujar' && puerta.empujable) {
    for (const m of ms) {
      if (!m.activa || !m.empiezaPinza) continue;
      const dir = m.esMano ? m.punta.clone().sub(cab).normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(m.quat);
      const ray = new THREE.Raycaster(m.esMano ? cab : m.pos, dir, 0, 8);
      if (ray.intersectObject(puerta.hoja, false).length) { m.vibrar(0.9, 80); puerta.empujable = false; abrirPuerta(); break; }
    }
  }
  if (J.fase === 'buscarPared' && (J.enFase > 3 || xr.paredDelante()) && J.enFase > 1.2) colocarPuerta();

  if (J.liar && J.fase === 'liar') {
    const porro = J.liar.actualizar(dt, ms, xr.boca());
    if (porro) {
      J.porro = porro; escena.remove(J.liar.grupo); J.liar = null;
      di('lasslow', 'Ahí está. Precioso.');
      darMechero();
    }
  }
  const porro = J.porro;
  if (porro) {
    if (porro.mano) porro.seguirMano(porro.mano, xr.boca());
    else if (J.enManos) {
      // lo tiene un colega: entre los dedos, junto a su boca
      const b = J.enManos.bocaMundo(_a);
      porro.grupo.position.copy(b).add(_b.set(0, -0.04, 0.03));
      porro.grupo.lookAt(cab);
    } else if (J.ofrecido) {
      // flota delante de tu pecho hasta que lo pellizcas
      const meta = cab.clone().addScaledVector(xr.adelante.clone().setY(0).normalize(), 0.33); meta.y = cab.y - 0.3;
      porro.grupo.position.lerp(meta, Math.min(1, dt * 3));
      porro.grupo.rotation.y += dt * 1.2;
      ui.instruccion('Coge el porro con un pellizco');
      for (const m of ms) if (m.activa && m.empiezaPinza && m.punta.distanceTo(porro.grupo.position) < 0.13) { porro.mano = m; J.ofrecido = false; m.vibrar(0.5, 30); ui.instruccion(null); }
    }
    porro.actualizar(dt, humo);
  }
  if (J.mechero) {
    const m = J.manoMechero;
    if (m?.activa) J.mechero.seguirMano(m);
    J.mechero.actualizar(dt, m);
    if (m?.empiezaPinza && J.mechero.chasquear()) ui.instruccion('Acerca la llama a la punta');
    if (J.mechero.llama.visible && J.porro && J.mechero.llamaMundo(_a).distanceTo(J.porro.puntaMundo(_b)) < 0.04) {
      J.encendiendo += dt;
      if (J.encendiendo > 0.5 && !J.porro.encendido) {
        J.porro.encender(); sonido('fup', { volumen: 0.7 });
        const mech = J.mechero; setTimeout(() => { escena.remove(mech.grupo); }, 900); J.mechero = null;
        ui.instruccion('Boquilla a los labios: calada. Apártalo para parar');
        fase('fumar');
        di('blancaso', 'Despacito. Que nos conocemos.');
      }
    }
  }
  if (J.fase === 'fumar') {
    pasoFumar(dt);
    if (J.calada && ui._instr?.startsWith('Boquilla')) ui.instruccion(null);
  }
  // en el humo, el techo de Unaké siempre tiene humo flotando (poco y lejos: no tapa nada)
  if (J.mundo === 'humo' && !J.transicion) {
    J.cadaAmbiente = (J.cadaAmbiente ?? 0) - dt;
    if (J.cadaAmbiente <= 0) {
      J.cadaAmbiente = 0.45;
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.8;
      humo.soltar({ pos: new THREE.Vector3(cab.x + Math.cos(a) * r, 2.3 + Math.random() * 0.6, cab.z + Math.sin(a) * r), vel: new THREE.Vector3(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05), tam: 0.4, vida: 14, crece: 0.05, sube: 0, frena: 0, brillo: 0.15, alfa: 0.55, tamMax: 1.1, ambiente: true });
    }
  }
  // el colocón baja solo; los mundos cambian con histéresis
  J.colocon = Math.max(0, Math.min(100, J.colocon - dt * (J.mundo === 'humo' ? 0.28 : 0.06)));
  if (xr.manos.izquierda.activa) ui.colocon(J.colocon, xr.manos.izquierda);
  if (!J.transicion && !J.calada && J.fase !== 'portada') {
    if (J.mundo === 'normal' && J.colocon >= 30) cambiarMundo(true);
    else if (J.mundo === 'humo' && J.colocon < 12) cambiarMundo(false);
  }
}

// ---------- pruebas en el PC (sin gafas): saltar a una fase y mirar ----------
J.prueba = {
  async ir(que) {
    await listo;
    $('portada').hidden = true; J.modo = 'pc'; J.fase = 'prueba';
    const f = new THREE.Vector3(0, 0, -1);
    puerta.colocar(new THREE.Vector3(0, 0, -2.4), new THREE.Vector3(0, 0, 1));
    puerta.grupo.visible = true; J.dirPuerta.set(0, 0, -1); J.origen.set(0, 0, 0);
    J.sitios = [new THREE.Vector3(-0.5, 0, -1.3), new THREE.Vector3(0.5, 0, -1.3)];
    escena.background = new THREE.Color('#e6dfd2'); casaFalsa.visible = true;
    if (que === 'puerta') { puerta.perico('Contraseña. Contraseña. Contraseña…'); return; }
    for (const [p, s] of [[lasslow, J.sitios[0]], [blancaso, J.sitios[1]]]) { p.grupo.position.copy(s); p.grupo.visible = true; p.grupo.lookAt(0, 0, 0); }
    if (que === 'salen') { puerta.abrir(); blancaso.decir('Llegas tarde. Lo he apuntado.'); return; }
    if (que === 'liar') { puerta.abrir(); sacarBandeja(); return; }
    if (que === 'humo') { puerta.abrir(); J.colocon = 40; return; }
  },
  // el flujo entero como en las gafas, pero en el PC (las manos las mueve J.bot)
  async arrancar() { await listo; $('portada').hidden = true; J.modo = 'pc'; escena.background = new THREE.Color('#e6dfd2'); casaFalsa.visible = true; empezar(); },
  mirar(x, y, z, yaw = 0, pitch = 0) { camara.position.set(x, y, z); camara.rotation.set(pitch, yaw, 0, 'YXZ'); },
};
