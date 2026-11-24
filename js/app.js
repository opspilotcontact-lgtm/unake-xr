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
import { prepararAudio, sonido, musica, letraLista, fijarAnisotropia, precargarSonidos, audio, img, textura } from './recursos.js';
import { activarMicro, leerMicro, hayMicro } from './microfono.js';
import { ManosVisibles } from './manos_visibles.js';
import { sitioTarjetas } from './minijuegos/marco.js';
import { Portales } from './barrio/portales.js';
import { Encargos, nombreDe } from './barrio/encargos.js';
import { Tienda } from './barrio/tienda.js';
import { Hucha } from './barrio/hucha.js';
import { decorar } from './barrio/deco3d.js';
import { Lugares, juegosDe, nombreJuego, nativoDe, prepararNativos, APUESTAS, OBJETOS, SITIOS_BAR, MODULOS_SALA, moduloSala, todosLosSitios, salaDeClave, SITIOS_PERSONA } from './barrio/lugares.js';
import { Vida, id2d, idXR } from './barrio/vida.js';
import { siguientePaso } from './barrio/portales.js';
import { Reacciones } from './reacciones.js';
import { Ambiente } from './ambiente.js';
import { Fisica, Agarre } from './fisica.js';
import { Viaje } from './viaje.js';
import { Recreativa } from './recreativa.js';
import { MotorHistoria, NATIVOS } from './historia/motor.js';
import { Escenas } from './historia/escenas.js';
import { MunecaHistoria } from './historia/muneca.js';
import { Guia, mundoQuiere, nombreSala } from './historia/guia.js';

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

// viñeta de confort (solo al moverte con el joystick)
const vineta = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 60, 128, 128, 128); r.addColorStop(0, 'rgba(10,6,16,0)'); r.addColorStop(1, 'rgba(10,6,16,1)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  m.position.z = -0.15; m.renderOrder = 99; m.visible = false; camara.add(m); return m;
})();

// ---------- piezas ----------
const ui = new UI(escena);
const xr = montarXR(renderer, escena, camara, { alEntrar, alSalir, aviso });
const manos = () => [xr.manos.derecha, xr.manos.izquierda];
const manosV = new ManosVisibles(escena, xr);
const portales = new Portales({ sonido: (n, o) => sonido(n, o) }); // puertas entre salas y «sigue el humo»
const encargos = new Encargos({ img, sonido: (n, o) => sonido(n, o) }); // el tablón de la tienda y el pedido en tu mano
// la chuleta de cada fase (encima de cada mano; se ve al cambiar y al mirarte la mano de cerca)
const AYUDAS_FASE = {
  contrasena: { gatillo: 'Tocar o señalar una tarjeta', mano: { pellizco: 'Tocar o señalar una tarjeta' } },
  empujar: { gatillo: 'Señala la puerta y empuja' },
  liar: { gatillo: 'Pellizcar / rellenar', lateral: 'Agarrar' },
  encender: { gatillo: 'Sacar llama' },
  fumar: { gatillo: 'Coger el porro', lateral: 'Agarrar / lanzar' },
  minijuego: { gatillo: 'Usar / disparar', lateral: 'Coger' },
  barrio: { gatillo: 'Tocar una sala' },
  historia: { gatillo: 'Tocar o señalar una tarjeta' },
  recreativa: { gatillo: 'Pulsar botones', lateral: 'Coger la palanca' },
};
function ponerAyudas() {
  const base = J.ayudasMj || AYUDAS_FASE[J.fase] || null;
  const humo = J.mundo === 'humo' && !J.minijuego ? { stick: 'Andar', stickDer: 'Girar' } : {};
  manosV.ayudas({ ...(base || {}), ...humo });
}
let humo, puerta, unake, lasslow, blancaso, viaje, recreativa, motor, escenasH, munecaH, guia, reacciones, ambiente, vida;
const fisica = new Fisica(), agarre = new Agarre(fisica);

// ---------- estado del director ----------
const J = {
  fase: 'portada', mundo: 'normal', colocon: 0, modo: null,
  t: 0, enFase: 0,
  dirPuerta: new THREE.Vector3(0, 0, -1), origen: new THREE.Vector3(),
  sitios: [], liar: null, porro: null, mechero: null, manoMechero: null,
  calada: null, encendiendo: 0, cola: [], tareas: [],
  pasesSinPasar: 0, vueltas: 0, transicion: false, bolas: [], vuela: null, ofrecido: null, enManos: null, resultados: [], minijuego: null, menu: false,
};
window.__unake = J; // para pruebas
J.THREE = THREE;
J.obj = () => ({ puerta, lasslow, blancaso, ui, humo, xr, unake, renderer, fisica, agarre, viaje });
J.jugarMinijuego = id => jugarMinijuego(id);
J.jugarRecreativa = c => jugarRecreativa(c);
J.recreativa = () => recreativa;
J.abrirBarrio = () => abrirBarrio();
Object.defineProperty(J, 'barrio', { get: () => B });
J.entrarSala = id => entrarSala(id);
J.salirSala = m => salirSala(m);
J.portales = () => portales;
J.encargos = () => encargos;
J.empezarEncargo = r => empezarEncargo(r || 0);
J.hablarCon = id => { const r = personasAqui().find(o => o.r.id === id || o.id === id)?.r; if (r) hablarCon(r); return !!r; };
J.vida = () => vida;
J.lugares = () => (J.fase === 'barrio' && B.sala ? B.lugares : barLug);
J.tocarLugar = sitio => tocarLugar(sitio);
J.jugarLugar = clave => jugarLugar(clave);
J.genteBar = () => genteBar;
J.puedeTocarGente = () => puedeTocarGente();
J.marcasMaqueta = () => marcasMaqueta();
J.personasAqui = () => personasAqui().map(o => ({ id: o.id, x: +o.r.grupo.position.x.toFixed(2), z: +o.r.grupo.position.z.toFixed(2), visible: o.r.grupo.visible }));
J.cruzar = d => cruzar(d);
J.ocupadoHistoria = () => !!escenasH?.ocupada;
J.abrirMenu = () => abrirMenu();
J.accionHistoria = a => accionHistoria(a || motor?.objetivos()?.historia?.accion);

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
  viaje = new Viaje({ escena, humo, sala: unake, personajes: [lasslow, blancaso], fisica, sonido, xr, img });
  // la gente reacciona (humo en la cara, golpes, el pase) y cada sala suena a lo suyo
  reacciones = new Reacciones({ humo, sonido }); ambiente = new Ambiente({ oyente, sonido, musica });
  await crearCosas();
  recreativa = new Recreativa({ escena, xr, ui, sonido, musica, mundo: () => J.mundo }); recreativa.maquina.visible = false;
  // partidas que el jugador empieza solo, desde la máquina (encender → elegir → START)
  recreativa.alEmpezar = clave => { guardarParaRecreativa(); J.faseRec = J.fase; fase('recreativa'); J.minijuego = { id: 'recreativa:' + clave, inst: { actualizar() { } } }; };
  recreativa.alTerminar = r => {
    if (r && !r.abandonado) { cobrar(r.clave, r); if (recreativa.mision?.clave === r.clave) recreativa.pedir(null); }
    if (J.minijuego?.id?.startsWith('recreativa:')) cerrarMinijuego(J.faseRec);
  };
  // la historia y la economía: el propio código del 2D en el iframe del puente (docs/historia.md)
  motor = await MotorHistoria.crear();
  recreativa.cargando = Promise.resolve(motor.puente);
  escenasH = new Escenas({ escena, xr, mundo: () => J.mundo, prestados: { lasslow, blancaso } });
  munecaH = new MunecaHistoria({ motor, alPulsar: o => accionHistoria(o.accion) });
  motor.on('alPista', q => { guia?.registrar(); decirPista(q.de, q.texto); });
  // la guía activa (js/historia/guia.js): pistas, hilo de humo y la máquina parpadeando con la misión
  guia = new Guia({
    motor,
    entorno: () => ({
      mundo: J.mundo, sala: J.fase === 'barrio' ? B.salaId : null, enSala: J.fase === 'barrio' && !!B.sala,
      enBar: J.mundo === 'humo' && J.fase !== 'barrio' && !!unake?.grupo.visible, encargo: !!encargos.actual,
      libre: libreParaGuia(),
      enBarGente: genteBar.filter(r => r.grupo.visible).map(r => id2d(r.id)),
    }),
    decir: (de, texto) => decirPista(de, texto),
    // el hilo: lo pone la guía, y solo quita el que puso ella (no el de un encargo o una partida pedida a mano)
    hilo: salas => {
      const k = salas ? salas.join(',') : '', ahora = (portales.metas || []).join(',');
      if (salas) { if (k !== ahora) portales.guia(salas); J._metasGuia = k; }
      else if (J._metasGuia && J._metasGuia === ahora) { portales.guia(null); J._metasGuia = ''; }
    },
    // la máquina: la guía pide la misión ★; y solo quita lo que pidió ella (no la partida que pediste tú en una sala)
    maquina: clave => {
      if (recreativa.mision?.clave === (clave || undefined) || recreativa.enUso || (J.minijuego?.id || '').startsWith('recreativa:')) return;
      if (!clave && recreativa.mision && recreativa.mision.clave !== J._maquinaGuia) return;
      J._maquinaGuia = clave || null; recreativa.pedir(clave || null);
    },
    llamar: () => munecaH.llamar(),
  });
  J.guia = guia;
  motor.on('alCobro', c => { if (c.situacion) setTimeout(() => ui.cartela(c.situacion, 4), 6500); });
  motor.on('alDesmayo', ({ perdidos }) => { J.colocon = 0; ui.cartela(`¡Te ha dado un amarillo! Despiertas en tu cuarto${perdidos ? ` (−${perdidos} monchis)` : ''}.`, 5); });
  motor.on('alAcabarCapitulo', e => sonido(e.final ? 'oooh' : 'campanita', { volumen: 0.6 }));
  J.motor = motor;
  // el barrio vivo (js/barrio/vida.js) y los nativos nuevos que ya estén (js/barrio/lugares.js)
  vida = new Vida({ motor, humo, sonido: (n, o) => sonido(n, o) });
  barLug = new Lugares({ motor });
  moduloSala('./cuarto.js').then(C => { J.hayCuarto = !!C; });
  prepararNativos().then(n => { if (n.length) console.info('[lugares] nativos nuevos:', n.join(', ')); }).catch(() => { });
  puerta.grupo.visible = false; unake.grupo.visible = false; lasslow.grupo.visible = false; blancaso.grupo.visible = false;
  precargarSonidos(['lata', 'bonk', 'nam', 'fiu', 'tiroriro', 'zumbido-m', 'toc-toc', 'pin-pin', 'puerta', 'chof', 'papel', 'sorbo', 'mechero', 'mechero-falla', 'fup', 'calada', 'tos', 'tos-grande', 'risa-lasslow', 'fiuuu', 'whoosh', 'campanita', 'pop']);
}
const listo = cargar().catch(e => { console.error(e); aviso('Error cargando: ' + e.message, 20000); });

// ---------- portada ----------
function comprobarSoporte() {
  if (!navigator.xr) { $('estadoXR').textContent = 'Este navegador no tiene WebXR: ábrelo en el navegador de las Quest.'; return; }
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
function fase(f) { J.fase = f; J.enFase = 0; if (f !== 'minijuego') J.ayudasMj = null; ponerAyudas(); }

async function contarEscena() {
  const e = motor.tomarEscena(); if (!e) return;
  const antes = J.fase; fase('historia'); ui.instruccion(null); ui.quitarTarjetas();
  try { await escenasH.contar(e, { objetivos: () => motor.objetivos() }); }
  catch (err) { console.error('[historia] escena', err); }
  finally {
    // si algo cambió la fase mientras tanto (salir de la sala, pruebas), no se pisa con la vieja
    if (J.fase === 'historia') fase(antes); motor.escenaContada(); guia?.empujar('escena', 1.5);
    if (antes === 'barrio' && !motor.escenaPendiente) setTimeout(tarjetasSala, 400); // las tarjetas de la sala, de vuelta
  }
}
// También en una sala del barrio (antes la escena esperaba a que volvieras: cumplías algo y no pasaba nada)
const enSalaLibre = () => J.fase === 'barrio' && B.sala && !B.ocupado && !J.charla && J.minijuego?.id === 'barrio';
const libreParaHistoria = () => (['liar', 'fumar', 'encender'].includes(J.fase) || enSalaLibre()) && !J.calada && !J.enManos
  && !J.vuela && !J.transicion && (!J.minijuego || enSalaLibre()) && !J.menu && !escenasH?.ocupada && !recreativa?.enUso;
// Una pista: la dice un colega con su bocadillo si está a la vista; si no (en las salas), la cartela.
function decirPista(de, texto) {
  const p = de === 'lasslow' ? lasslow : de === 'blancaso' ? blancaso : null;
  if (p && p.grupo.visible && J.fase !== 'barrio' && p.grupo.position.distanceTo(xr.cabeza) < 3.5) return di(de, texto);
  ui.cartela(texto, 5);
}
// La guía solo habla cuando nada ocupa la vista ni las manos (criterio §3).
const libreParaGuia = () => ['liar', 'fumar', 'encender', 'barrio'].includes(J.fase) && !J.calada && !J.enManos && !J.vuela
  && !J.transicion && !J.menu && !J.charla && !B.ocupado && !escenasH?.ocupada && !motor?.escenaPendiente && !recreativa?.enUso
  && (!J.minijuego || J.minijuego.id === 'barrio') && !J.intro;
// El botón ★ (muñeca o menú). Nunca se queda callado: o te lleva, o hace la cosa y lo dice, o te dice qué falta.
function accionHistoria(a) {
  if (!a) return;
  const o = motor.objetivos().historia;
  // de día / de noche: si la misión es del otro mundo, la ★ te lleva a él
  const quiere = mundoQuiere(o);
  if (quiere && quiere !== J.mundo) return cambiarParaMision(quiere);
  if (a.tipo === 'hucha' && motor.monchis <= 0) return ui.cartela('No llevas monchis: haz un encargo en la tienda de 24 h o juega en la máquina.', 4);
  // la hucha está en la plaza (Blancaso): allí, tocarla o la ★ aportan
  if (a.tipo === 'hucha' && B.salaId !== 'plaza') return irAlSitio(o, { salas: ['plaza'], con: [] });
  if (a.tipo === 'barrio') {
    if (B.salaId === 'tienda' && o?.tipo === 'recado') motor.avisar('recado'); // con monchis ya, se compra aquí
    return irAlSitio(o);
  }
  // inventos: en el taller de tu cuarto (js/barrio/cuarto.js), si está
  if (a.tipo === 'invento' && J.hayCuarto) {
    if (B.salaId === 'cuarto') return ui.cartela('El taller de inventos, aquí en tu cuarto: tócalo.', 3.5);
    return irAlSitio(o, { salas: ['cuarto'], con: [] });
  }
  // mejoras y caja: en el bar del humo se hacen en la casa de muñecas del negocio (js/barrio/negocio.js)
  const neg = negocioBar();
  if (neg && (a.tipo === 'mejora' || a.tipo === 'cobrar') && J.mundo === 'humo' && J.fase !== 'barrio' && typeof neg.elegir === 'function') {
    try { neg.elegir(a.id); ui.cartela(a.tipo === 'cobrar' ? 'La caja, en la maqueta del negocio: junto al sofá.' : 'Las mejoras, en la maqueta del negocio: junto al sofá.', 3.5); return; } catch (e) { console.error('[negocio] elegir', e); }
  }
  const antes = motor.monchis;
  const r = motor.hacer(a);
  if (!r) {
    // lo ha hecho el motor: que se note
    const gasto = antes - motor.monchis;
    const t = { hucha: `Aportas ${gasto} monchis a la hucha.`, mejora: `Mejora comprada: ${(a.texto || '').replace(/\s*\(\d+\)$/, '')}. Unaké sube.`, invento: `Invento nuevo en tu cuarto: ${(a.texto || '').replace(/\s*\(\d+\)$/, '')}.`, cobrar: `Cobras la caja de Unaké: +${-gasto} monchis.` }[a.tipo];
    if (t) { ui.cartela(t, 3.5); sonido('campanita', { volumen: 0.5 }); }
    return;
  }
  if (J.fase === 'barrio' && (r.tipo === 'recreativa' || r.tipo === 'nativo')) return jugarDesdeSala(r.clave);
  if (r.tipo === 'recreativa') return irALaMaquina(r.clave);
  if (r.tipo === 'nativo') return jugarMinijuego(r.id);
  if (r.tipo === 'menu') {
    const falta = a.precio ? a.precio - motor.monchis : 0;
    return ui.cartela(falta > 0 ? `Te faltan ${falta} monchis: haz un encargo en la tienda de 24 h o juega en la máquina.` : r.motivo === 'sin monchis' ? 'No llevas monchis: haz un encargo en la tienda de 24 h o juega en la máquina.' : 'Por ahora no se puede más.', 4);
  }
  if (r.tipo === 'fumar') { if (!J.porro && !J.liar && !J.porroGuardado) sacarBandeja(); return ui.cartela('Lía uno en la bandeja y dale una calada.', 3); }
  if (r.tipo === 'pasar') { if (!J.porro && !J.liar && !J.porroGuardado) sacarBandeja(); return ui.cartela('Con el porro encendido, acércaselo a Blancaso a la boca.', 3.5); }
  if (r.tipo === 'puerta') return ui.cartela('Contesta a Perico tocando una tarjeta y empuja la puerta.', 3.5);
}
// Ir a donde manda la misión: de noche, andando con el hilo de humo; de día (o a la barra desde el bar), te lleva.
function irAlSitio(o, sitio = null) {
  const { salas, con } = sitio || motor.sitiosPendientes(o);
  if (!salas.length) return;
  if (B.salaId && salas.includes(B.salaId)) { const p = guia.plan(o); if (p?.texto) ui.cartela(p.texto, 3.5); return; }
  const enBar = J.mundo === 'humo' && J.fase !== 'barrio';
  if (enBar && salas.includes('dentro')) {
    if (o?.tipo === 'recoger') return ui.cartela('Lo que brilla, aquí en el bar: cógelo con la mano.', 3.5);
    const otros = con.filter(c => c !== 'lasslow' && c !== 'blancaso');
    // Palicaso y la Pompa están aquí mismo, en el bar: se les toca
    const aqui = otros.filter(c => genteBar.some(r => id2d(r.id) === c && r.grupo.visible));
    if (otros.length && aqui.length === otros.length) return ui.cartela(`${aqui.map(c => NOMBRE_DE[c] || c).join(' y ')}: aquí en la barra. Acércate y tócale${aqui.length > 1 ? 's' : ''}.`, 4);
    if (otros.length) { ui.cartela('Vamos a la barra.', 2); return irASala('dentro'); }
  }
  const metas = salas.filter(s => !(enBar && s === 'dentro'));
  if (!encargos.actual) portales.guia(metas);
  if (J.mundo === 'humo' || J.fase === 'barrio') return ui.cartela(`Sigue el hilo de humo hasta ${nombreSala(metas[0])}.`, 3.5);
  ui.cartela(`Te llevo a ${nombreSala(metas[0])}.`, 2.5);
  irASala(metas[0]);
}
// La misión es del otro mundo: al humo se va fumando; a casa, se te baja (la ★ lo acelera).
async function cambiarParaMision(quiere) {
  if (J.fase === 'barrio') { salirSala(false); await esperar(() => !B.ocupado && J.fase !== 'barrio'); }
  if (quiere === 'humo') {
    ui.cartela('Eso es de noche: lía uno y fúmatelo para ir al humo.', 4);
    if (!J.porro && !J.liar && !J.porroGuardado) sacarBandeja();
  } else {
    ui.cartela('Eso es de día. Se te va bajando… vuelves a tu casa.', 4);
    J.colocon = Math.min(J.colocon, 11);
  }
}
async function empezar() {
  // la intro del capítulo 1 (si toca) antes de la puerta
  try { while (motor.escenaPendiente) await contarEscena(); } catch (e) { console.error(e); }
  // el primer minuto: los controles, solo la primera vez (en el PC de pruebas, solo con ?intro)
  let visto = false; try { visto = !!localStorage.getItem(CLAVE_INTRO); } catch { /* sin almacenamiento */ }
  if (!visto && (J.modo !== 'pc' || /[?&]intro\b/.test(location.search))) await primerMinuto();
  fase('buscarPared');
  ui.cartela('Tu casa. De día. Mira a una pared libre.', 3.5);
  musica('dia', 0.25);
}

// ---------- el primer minuto (onboarding): 4 cartelas cortas que se pueden saltar ----------
const CLAVE_INTRO = 'unake-xr-visto-intro';
const PASOS_INTRO = [
  { texto: 'Mírate las manos: encima tienes la chuleta de lo que hace cada botón.', s: 5.5 },
  { texto: 'En tu muñeca izquierda está tu misión ★. Tócala con el índice derecho y te lleva.', s: 6.5, muneca: true },
  { texto: 'B o Y abre el menú: la misión, los minijuegos y el mapa del barrio.', s: 5.5 },
  { texto: 'Si te pierdes, Lasslow y Blancaso te dan pistas. Y el hilo de humo te lleva.', s: 5 },
];
async function primerMinuto() {
  J.intro = { paso: 0, saltado: false };
  fase('intro'); // la muñeca ya se ve (el motor corre fuera de la portada)
  const f = xr.adelante.clone().setY(0).normalize();
  const c = xr.cabeza.clone().addScaledVector(f, 0.5); c.y = xr.cabeza.y - 0.38;
  ui.tarjetasEn(['Saltar'], c, f.clone().negate(), () => { if (J.intro) J.intro.saltado = true; });
  manosV.ayudas({ gatillo: 'Tocar / elegir', lateral: 'Agarrar' });
  try {
    for (let i = 0; i < PASOS_INTRO.length && !J.intro.saltado; i++) {
      const p = PASOS_INTRO[i]; J.intro.paso = i;
      ui.cartela(p.texto, p.s);
      if (p.muneca) munecaH.llamar(4);
      const t0 = performance.now();
      await esperar(() => J.intro.saltado || performance.now() - t0 > p.s * 1000, p.s * 1000 + 500);
    }
  } finally {
    ui.quitarTarjetas();
    if (J.intro.saltado) ui.cartela('Vale. Si te pierdes, mira tu muñeca.', 2.5);
    try { localStorage.setItem(CLAVE_INTRO, '1'); } catch { /* sin almacenamiento */ }
    J.introHecha = { ...J.intro }; J.intro = null;
    ponerAyudas();
  }
}
J.primerMinuto = () => primerMinuto();

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
  motor?.avisar('puerta');
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
  if (!J.cosasFuera && J.mundo === 'normal') { J.cosasFuera = true; repartirCosas('normal'); }
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
// formas de soltar el humo sin micro (baraja sin repetir); con micro, la forma la pones tú soplando
const FORMAS = ['chorro', 'aros', 'nariz', 'bola'];
function acabarCalada() {
  const c = J.calada; if (!c) return;
  const nivel = nivelDe(c.valor);
  const idx = nivel ? NIVELES_CALADA.indexOf(nivel) : -1;
  J.porro.gastar();
  motor?.avisar('calada', { nivel: idx });
  if (!nivel) {
    if (c.valor < 25) { J.calada = null; dejarDeFumar(); return; } // ni la ha probado: no cuenta
    J.colocon += 4; ui.cartela('Floja.', 1.2);
    humo.exhalar(xr.boca(), xr.adelante, 0.25);
    J.calada = null; dejarDeFumar(); return;
  }
  // los bonos de la decoración y del armario del 2D (bonoDeco / bonoArmario)
  J.colocon += nivel.sube * (J.porro.calidad ?? 1) * (1 + (motor?.d?.bonoDeco?.('colocon') || 0) + (motor?.d?.bonoArmario?.('colocon') || 0));
  ui.cartela('¡' + nivel.nombre + '!', 1.6);
  sonido(idx >= 3 ? 'oooh' : 'campanita', { volumen: 0.5 });
  Object.assign(c, { estado: 'aguanta', t: 0, nivel, idx, aire: 1 + idx * 0.3, aros: Math.min(5, idx + 2), callado: 0, soplo: false, antes: false });
  dejarDeFumar();
}
// con micro: el humo sale de TU boca mientras soplas, con la fuerza con la que soplas; cada soplido corto
// suelta un aro. Se acaba cuando te quedas sin aire o dejas de soplar un rato.
function soltarConMicro(dt, c) {
  const mic = leerMicro(dt);
  const boca = xr.boca(), dir = xr.adelante;
  if (mic.sopla) {
    if (!c.antes && c.idx >= 1 && c.aros > 0 && c.callado > 0.12) { c.aros--; humo.aro(boca, dir.clone(), 0.035 + mic.nivel * 0.02); sonido('fup', { volumen: 0.25, tono: 1.3 }); }
    c.soplo = true; c.callado = 0;
    c.aire -= dt * (0.55 + mic.nivel);
    const n = Math.ceil(dt * (25 + mic.nivel * 45));
    for (let i = 0; i < n; i++) {
      const v = dir.clone().multiplyScalar(0.35 + mic.nivel * 1.5); v.x += (Math.random() - 0.5) * 0.12; v.y += (Math.random() - 0.4) * 0.1; v.z += (Math.random() - 0.5) * 0.12;
      humo.soltar({ pos: boca, vel: v, tam: 0.03 + Math.random() * 0.03, vida: 2.4 + Math.random(), crece: 0.17, sube: 0.05, frena: 1.3 });
    }
    if (Math.random() < dt * 10) xr.manos.derecha.vibrar(0.08, 10);
  } else c.callado += dt;
  c.antes = mic.sopla;
  if (c.aire <= 0 || (c.soplo && c.callado > 2.2)) acabarSoltar(c, true);
  else if (!c.soplo && c.t > 1.1) soltarSolo(c); // no ha soplado: sale solo al segundo, como en la vida real
}
function soltarSolo(c) {
  const forma = sinRepetir('formas', FORMAS);
  const boca = xr.boca(), dir = xr.adelante.clone(), fuerza = 0.45 + c.idx * 0.1;
  if (forma === 'chorro') humo.exhalar(boca, dir, fuerza);
  else if (forma === 'aros') { humo.exhalar(boca, dir, 0.25); for (let i = 0; i < Math.min(4, c.idx + 1); i++) setTimeout(() => humo.aro(xr.boca(), xr.adelante.clone(), 0.035 + i * 0.01), 300 + i * 380); }
  else if (forma === 'nariz') {
    // dos chorritos por la nariz, hacia abajo: muy de dragón
    const lado = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (const s of [-1, 1]) humo.exhalar(boca.clone().add(new THREE.Vector3(0, 0.035, 0)).addScaledVector(lado, s * 0.012), dir.clone().add(new THREE.Vector3(0, -0.7, 0)).addScaledVector(lado, s * 0.15).normalize(), 0.3);
  } else if (forma === 'bola') {
    // una bola de humo que flota delante: tócala y revienta
    J.bolas.push({ centro: boca.clone().addScaledVector(dir, 0.12), vel: dir.clone().multiplyScalar(0.12).add(new THREE.Vector3(0, 0.02, 0)), t: 0, cada: 0 });
    if (!J.yaBola) { J.yaBola = true; setTimeout(() => ui.cartela('Una bola de humo. Tócala.', 2.5), 600); }
  }
  acabarSoltar(c, false);
}
function acabarSoltar(c, conMicro) {
  ui.instruccion(null);
  if (!conMicro) sonido('fiuuu', { volumen: 0.3 });
  if (c.idx >= 3) frase('epica'); else if (Math.random() < 0.5) frase('bien');
  J.calada = null;
  J.pasesSinPasar++;
  if (J.pasesSinPasar >= 2 && !J.pidio) { J.pidio = true; setTimeout(() => frase('pide'), 1500); }
}
function pasoBolas(dt) {
  for (const b of J.bolas) {
    b.t += dt; b.cada -= dt; b.centro.addScaledVector(b.vel, dt); b.vel.multiplyScalar(1 - 0.3 * dt);
    if (b.cada <= 0) { b.cada = 0.07; humo.soltar({ pos: b.centro.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.03)), tam: 0.05, vida: 0.6, crece: 0.05, sube: 0, frena: 3, brillo: 0.45 }); }
    for (const m of manos()) {
      if (m.activa && m.punta.distanceTo(b.centro) < 0.07) {
        b.t = 99; m.vibrar(0.6, 40); sonido('pop', { volumen: 0.6 });
        for (let i = 0; i < 14; i++) humo.soltar({ pos: b.centro, vel: new THREE.Vector3().randomDirection().multiplyScalar(0.6), tam: 0.04, vida: 1.6, crece: 0.15, sube: 0.05, frena: 2 });
      }
    }
  }
  J.bolas = J.bolas.filter(b => b.t < 9);
}
function toser() {
  J.porro.gastar();
  J.colocon += 3;
  sonido('tos-grande', { volumen: 0.8 });
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
    c.valor += dt * 40 * freno;
    ui.medir(c.valor, NIVELES_CALADA, CENTRO_CALADA, xr.cabeza, xr.cabezaQ);
    if (Math.random() < dt * 12) porro.mano?.vibrar(0.12 + c.valor / 400, 12);
    if (c.valor >= 100) toser();
    else if (porro.boquillaMundo(_a).distanceTo(boca) > 0.09) acabarCalada();
  } else if (c.estado === 'aguanta') {
    c.t += dt;
    if (hayMicro()) soltarConMicro(dt, c);
    else if (c.t > 1.1) soltarSolo(c);
  }
  // pasarlo: al acercarlo, el colega se inclina y lo pide; en su boca, lo coge
  if (!J.calada && porro.mano && porro.encendido) {
    for (const p of [lasslow, blancaso]) {
      const d = porro.boquillaMundo(_a).distanceTo(p.bocaMundo(_b));
      p.inclina = d < 0.6 ? 1 - d / 0.6 : 0;
      if (d < 0.6 && !p.pidiendo) { p.pidiendo = true; p.empujon(0.12); if (Math.random() < 0.5) p.decir(p === lasslow ? '¡Trae, trae!' : 'Por fin. Apuntado.'); }
      if (d > 0.8) p.pidiendo = false;
      if (d < 0.22) { pasar(p); break; }
    }
  } else for (const p of [lasslow, blancaso]) p.inclina = 0;
  if (porro.consumido && !J.calada && porro.mano) acabarPorro();
}

// el colega fuma: calada (la brasa se enciende en su boca), aguanta temblando, suelta hacia arriba y reacciona
async function fumaColega(p) {
  const porro = J.porro;
  J.enManos = p;
  await p.pose('fumando-calada', { rebote: 0.15 });
  for (let i = 0; i < 4; i++) { await espera(0.4); p.empujon(0.04); }
  await p.pose('fumando-aguanta', { rebote: 0.1 });
  porro.gastar();
  for (let i = 0; i < 4; i++) { await espera(0.32); p.empujon(0.06); }
  await p.pose('fumando-suelta', { rebote: 0.25 });
  sonido('fiuuu', { en: p.grupo, volumen: 0.4, tono: 0.85 + Math.random() * 0.3 });
  const b = p.bocaMundo(new THREE.Vector3());
  const hacia = xr.cabeza.clone().sub(b).normalize().add(new THREE.Vector3(0, 0.9, 0)).normalize();
  humo.exhalar(b, hacia, 0.75);
  if (J.mundo === 'humo' && Math.random() < 0.6) setTimeout(() => humo.aro(p.bocaMundo(new THREE.Vector3()), hacia.clone(), 0.04), 500);
  await espera(1.4);
  // la reacción, distinta en cada mundo
  if (J.mundo === 'humo') {
    if (p === blancaso && Math.random() < 0.45) { await p.pose('derritiendose', { rebote: 0.2 }); di('blancaso', 'Estoy bien. Estoy bien.'); await espera(2); }
    else if (p === lasslow && Math.random() < 0.5) { await p.pose('risa-floja', { rebote: 0.3 }); sonido('risa-lasslow', { en: p.grupo, volumen: 0.6 }); await espera(2); }
    else { await p.pose('fumado', { rebote: 0.15 }); await espera(1.6); }
  } else { await p.pose('riendo', { rebote: 0.15 }); await espera(1.2); }
  await p.pose('base', { rebote: 0.15 });
  J.colocon += 2; // el ambiente también cuenta
}
async function pasar(p) {
  motor?.avisar('pase', { a: p === lasslow ? 'lasslow' : 'blancaso' });
  const porro = J.porro;
  const m = porro.mano;
  reacciones.pase(p, m); // se nota que te lo cogen (tirón, plop y chispa de humo)
  porro.mano = null; J.pasesSinPasar = 0; J.pidio = false; p.pidiendo = false; p.inclina = 0;
  await fumaColega(p);
  // la ronda: a veces se lo pasa al otro antes de devolvértelo
  const otro = p === lasslow ? blancaso : lasslow;
  let quien = p;
  if (Math.random() < 0.55 && !porro.consumido) {
    di(p === lasslow ? 'lasslow' : 'blancaso', p === lasslow ? 'Toma, Blancaso. Que tú lo apuntas.' : 'Lasslow. Te toca. Una.');
    J.enManos = null; J.vuela = { desde: p.bocaMundo(new THREE.Vector3()), hasta: otro, t: 0 };
    sonido('fiu', { volumen: 0.4 });
    await espera(0.7); J.vuela = null;
    await fumaColega(otro); quien = otro;
  }
  frase('devuelve');
  // te lo tiende: lo sujeta hacia ti hasta que lo coges (si no llegas, al rato viene solo)
  J.enManos = null; J.ofrecido = { quien, t: 0 };
}

function acabarPorro() {
  motor?.avisar('porro');
  const porro = J.porro;
  humo.exhalar(porro.puntaMundo(), new THREE.Vector3(0, 1, 0), 0.4);
  escena.remove(porro.grupo); J.porro = null;
  di('blancaso', 'Se acabó. Lo he contado: catorce.');
  setTimeout(() => { if (!J.porro && J.fase !== 'portada') sacarBandeja(); }, 3500);
}

// ---------- cosas que se cogen y se tiran (física) ----------
async function crearCosas() {
  const lata = (color) => {
    const g = new THREE.Group();
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14), new THREE.MeshBasicMaterial({ color }));
    const tinta = new THREE.Mesh(cil.geometry, new THREE.MeshBasicMaterial({ color: '#140c1c', side: THREE.BackSide })); tinta.scale.setScalar(1.08);
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 14), new THREE.MeshBasicMaterial({ color: '#c8c8d0' })); tapa.position.y = 0.061;
    g.add(cil, tinta, tapa); return g;
  };
  const dibujo = async (nombre, alto) => {
    const t = await img(nombre); const asp = t.image.width / t.image.height;
    return new THREE.Mesh(new THREE.PlaneGeometry(alto * asp, alto), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
  };
  const cojin = () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff5fa2' }));
    m.scale.set(1, 0.45, 1);
    const t = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: '#140c1c', side: THREE.BackSide })); t.scale.setScalar(1.06); m.add(t);
    return m;
  };
  J.cosas = { normal: [], humo: [] };
  const poner = (mundo, obj, radio, extra = {}) => { obj.visible = false; escena.add(obj); J.cosas[mundo].push({ obj, radio, extra }); };
  poner('normal', lata('#e8463a'), 0.04);
  poner('normal', await dibujo('obj-bolsa-salado.png', 0.16), 0.06);
  poner('humo', lata('#4d8bff'), 0.04); poner('humo', lata('#7ee081'), 0.04);
  poner('humo', cojin(), 0.1, { rebote: 0.15 }); poner('humo', cojin(), 0.1, { rebote: 0.15 });
  poner('humo', await dibujo('obj-vinilo.png', 0.2), 0.08);
  poner('humo', await dibujo('obj-donut.png', 0.1), 0.05);
}
// saca las cosas del mundo al que llegas (alrededor tuyo, a mano) y guarda las del otro
function repartirCosas(mundo) {
  if (!J.cosas) return;
  for (const [m, lista] of Object.entries(J.cosas)) for (const k of lista) {
    if (k.c) { fisica.quitar(k.c); k.c = null; }
    k.obj.visible = m === mundo;
  }
  const f = J.dirPuerta.clone().setY(0).normalize(), lat = new THREE.Vector3(-f.z, 0, f.x);
  J.cosas[mundo].forEach((k, i) => {
    const base = mundo === 'humo'
      ? unake.grupo.localToWorld(new THREE.Vector3((i - 2.5) * 0.3, 0.5, -1.25))
      : xr.cabeza.clone().addScaledVector(f, 0.55).addScaledVector(lat, (i ? 1 : -1) * 0.35).setY(0.6);
    k.obj.position.copy(base); k.obj.rotation.set(0, Math.random() * 6, 0);
    k.c = fisica.anadir(k.obj, {
      radio: k.radio, rebote: k.extra.rebote ?? 0.35,
      alGolpear: (c, info) => { if (info.fuerza > 1) sonido(k.radio > 0.09 ? 'chof' : 'lata', { en: c.obj, volumen: Math.min(0.7, info.fuerza / 6), tono: 0.9 + Math.random() * 0.2 }); },
    });
  });
}
const AYES = {
  lasslow: ['¡Eh! Que soy un señor.', 'Perdón, perdón… ¡pero si has sido tú!', '¡Ay! Me ha dado la risa.'],
  blancaso: ['Apuntado. Me has dado.', 'Otra vez no…', 'Eso cuenta como agresión. La apunto.'],
};
function golpesAColegas() {
  for (const c of fisica.cuerpos) {
    if (c.cogido || c.dormido || c.vel.lengthSq() < 2.2) continue;
    for (const [id, p] of [['lasslow', lasslow], ['blancaso', blancaso]]) {
      if (!p.grupo.visible || (p.ayEspera ?? 0) > J.t) continue;
      const centro = p.grupo.position.clone().add(new THREE.Vector3(0, (p.alto ?? 1) * 0.55, 0));
      if (c.obj.position.distanceTo(centro) < (p.alto ?? 1) * 0.35 + c.radio) {
        p.ayEspera = J.t + 1.5;
        c.vel.multiplyScalar(-0.35);
        sonido('bonk', { en: p.grupo, volumen: 0.7 });
        p.pose(J.mundo === 'humo' ? 'horror' : 'sorprendido', { rebote: 0.35 });
        setTimeout(() => p.pose('base', { rebote: 0.1 }), 1500);
        p.decir(sinRepetir('ay-' + id, AYES[id]));
      }
    }
  }
}

// ---------- minijuegos nativos (js/minijuegos/*) desde el menú de la muñeca ----------
// El menú se abre tocando el panel del colocón de tu muñeca izquierda con el índice derecho (o con B/Y).
// Mientras juegas, el porro se queda en el cenicero (se guarda) y la bandeja se aparta.
// Los nativos que se pueden jugar sueltos (los de la historia, como la furgo o el amarillo, los abre la historia).
// El resto de minijuegos del 2D se juegan en la máquina del bar.
const MINIJUEGOS = [
  { id: 'pipas', texto: 'Pipas con Perico' },
  { id: 'tiropato', texto: 'Tiro al pato' },
  { id: 'cuentas', texto: 'La caja de Blancaso' },
  { id: 'casetas', texto: 'Las casetas' },
];
// Menú de la muñeca: una sola fila. Lo que manda es la historia (★); lo demás, a mano.
async function abrirMenu(sub = null) {
  if ((J.menu && !sub) || (J.minijuego && J.minijuego.id !== 'barrio') || J.transicion || J.calada || J.enManos || J.vuela) return;
  J.menu = true; ui.quitarTarjetas();
  const f = xr.adelante.clone().setY(0).normalize();
  const c = xr.cabeza.clone().addScaledVector(f, 0.42); c.y = xr.cabeza.y - 0.22;
  sonido('pop', { volumen: 0.4 });
  const cerrar = () => { J.menu = false; ui.quitarTarjetas(); };
  if (sub === 'minijuegos') {
    const disponibles = [];
    for (const m of MINIJUEGOS) { try { await import(`./minijuegos/${m.id}.js`); disponibles.push(m); } catch { /* aún no existe */ } }
    ui.tarjetasEn([...disponibles.map(m => m.texto), 'La máquina', 'Volver'], c, f.clone().negate(), texto => {
      if (texto === 'Volver') return abrirMenu('raiz');
      cerrar();
      if (texto === 'La máquina') return irALaMaquina();
      const m = disponibles.find(x => x.texto === texto); if (m) jugarMinijuego(m.id);
    });
  } else {
    const oh = motor?.objetivos()?.historia;
    const quiere = mundoQuiere(oh);
    const txt = quiere && quiere !== J.mundo ? (quiere === 'humo' ? 'Ir al humo' : 'Volver a casa') : oh?.accion?.texto;
    const estrella = txt ? ['★ ' + txt] : [];
    ui.tarjetasEn([...estrella, 'Minijuegos', 'Mapa', 'Ajustes', 'Cerrar'], c, f.clone().negate(), texto => {
      if (texto === 'Minijuegos') return abrirMenu('minijuegos');
      if (texto === 'Ajustes') { clearTimeout(abrirMenu._t); return ui.menuAjustes(xr, { alVolver: () => abrirMenu('raiz'), sonido: (n, o) => sonido(n, o) }); }
      cerrar();
      if (texto.startsWith('★ ')) return accionHistoria(oh.accion);
      if (texto === 'Mapa') { if (J.fase === 'barrio') salirSala(true); else abrirBarrio(); }
    });
  }
  clearTimeout(abrirMenu._t);
  abrirMenu._t = setTimeout(() => { if (J.menu && ui.tarjetas.length) cerrar(); }, 12000);
}
// La máquina está en el bar del humo. Desde allí, te giras y vas; de día, se juega en una pantalla delante.
function irALaMaquina(clave = null) {
  if (J.mundo === 'humo' && J.fase !== 'barrio') {
    if (clave) recreativa.pedir(clave);
    ui.cartela(clave ? 'Ve a la máquina del bar, enciéndela y elige la misión ★' : 'La máquina está en el bar: enciéndela y elige.', 4);
    return;
  }
  if (clave) return jugarRecreativa(clave);
  recreativa.elegir(k => { if (k) jugarRecreativa(k); });
}
async function jugarMinijuego(id) {
  const mod = (await import(`./minijuegos/${id}.js`)).default;
  // guardar lo que tienes entre manos
  if (J.porro) { J.porroGuardado = J.porro; J.porro.grupo.visible = false; J.porro.mano = null; J.porro = null; }
  if (J.liar) J.liar.grupo.visible = false;
  if (J.mechero) J.mechero.grupo.visible = false;
  J.ayudasMj = mod.ayudas || null; // un minijuego puede traer su chuleta: { gatillo, lateral, a, mano: {…} }
  // en una sala del barrio se juega allí mismo, en su sitio (js/barrio/lugares.js)
  J.mjEnSala = J.fase === 'barrio' && !!B.sala && !B.ocupado;
  if (J.mjEnSala) { J.charla = false; ui.quitarTarjetas(); vida?.callar(6); }
  const faseAntes = J.fase; fase('minijuego');
  // menos que dibujar: la máquina fuera y, si el minijuego te encierra (la cabina de la furgo), el bar también
  recreativa.maquina.visible = false;
  if (mod.tapaElBar) { unake.grupo.visible = false; lasslow.grupo.visible = blancaso.grupo.visible = false; }
  if (mod.ocultaColegas) lasslow.grupo.visible = blancaso.grupo.visible = false; // («Un señor»: tú eres Lasslow)
  if (mod.tapaElBar && J.mjEnSala) { B.sala.grupo.visible = false; for (const r of B.gente) r.grupo.visible = false; }
  // sitio libre delante: el sofá se aparta y los colegas miran desde los lados, de pie
  J.antesMj = [lasslow, blancaso].map(p => p.grupo.position.clone());
  if (J.mundo === 'humo') unake.sofa.visible = false;
  { const f = xr.adelante.clone().setY(0).normalize(), lat = new THREE.Vector3(-f.z, 0, f.x);
    [lasslow, blancaso].forEach((p, i) => p.grupo.position.copy(xr.cabeza).setY(0).addScaledVector(f, 0.5).addScaledVector(lat, (i ? 1 : -1) * 1.15)); }
  const ctx = {
    THREE, escena, xr, humo, ui, fisica, agarre, sonido, musica, textura, img, Recortable,
    // el nivel del 2D de ese minijuego (sube con las estrellas: nivelDe() de comun.js)
    nivel: (() => { try { return motor?.d?.puente?.ev(`nivelDe(${JSON.stringify(mod.clave)})`) || 1; } catch { return 1; } })(),
    hucha: n => { J.hucha = (J.hucha || 0) + n; }, // hasta que el motor de historia lleve la hucha del 2D
    get modo() { return J.modo; },
    // el micro (js/microfono.js) sin importarlo: soplar/volumen
    get micro() { return hayMicro(); }, leerMicro,
    // el monedero real de las apuestas (motor.monedero(): monchis del 2D y sus stats)
    monchis: motor?.monedero ? motor.monedero() : { get valor() { return 0; }, apostar() { return false; }, cobrar() { } },
    delante: (d = 1, alto = null) => { const f = xr.adelante.clone().setY(0).normalize(); const q = xr.cabeza.clone().addScaledVector(f, d); q.y = alto ?? 0; return q; },
    mesa: () => xr.mesaCerca(),
    // lo que un minijuego le pasa al siguiente (la furgo → el control: quién va a bordo)
    // bandeja: el invento «Bandeja ancha» del 2D (comun.js → INVENTOS, tiene('bandeja')); tipos: Mirando (sin forzar)
    datos: { acompanantes: J.furgoAcompanantes ?? null, bandeja: !!motor?.E?.inventos?.bandeja, tipos: null },
    terminar: ({ puntos, gana = true, linea = '' }) => {
      const dm = J.minijuego?.inst?.datos; if (dm?.acompanantes) J.furgoAcompanantes = dm.acompanantes;
      motor?.avisar('minijuego', { clave: mod.clave, puntos, gana, colocon: J.colocon });
      const n = mod.umbrales.filter(u => puntos >= u).length;
      J.resultados.push({ clave: mod.clave, puntos, gana, estrellas: n });
      ui.cartela(`${mod.titulo}: ${puntos} puntos · ${'★'.repeat(n)}${'☆'.repeat(3 - n)}${linea ? ' · ' + linea : ''}`, 6);
      sonido(n >= 2 ? 'oooh' : 'campanita', { volumen: 0.6 });
      if (n === 3) setTimeout(() => di('blancaso', 'Tres estrellas. Eso va a la agenda.'), 1500);
      else if (!gana) setTimeout(() => di('lasslow', 'Perdón… es que me da la risa.'), 1500);
      setTimeout(() => {
        // donde diga el minijuego (dentro de la cabina de la furgo no van pegadas a la cara)
        const st = sitioTarjetas(mod, J.minijuego.inst, ui);
        ui.tarjetasEn(['Otra vez', 'Volver'], st.centro, st.haciaMi, async t => {
          ui.distanciaTextos = null;
          J.minijuego.inst.destruir?.(); escena.remove(J.minijuego.inst.grupo);
          if (t === 'Otra vez') { J.minijuego.inst = await mod.crear(ctx); escena.add(J.minijuego.inst.grupo); }
          else cerrarMinijuego(faseAntes);
        }, st.opciones);
      }, 1800);
    },
  };
  J.minijuego = { id, mod, inst: await mod.crear(ctx) };
  escena.add(J.minijuego.inst.grupo);
}
// salir a mitad de un minijuego nativo: B/Y una vez avisa; otra vez (en 3 s) sale con lo que lleves
function mirarSalirMinijuego() {
  const inst = J.minijuego?.inst; if (!inst?.abandonar || J.fase !== 'minijuego') return;
  for (const m of [xr.manos.izquierda, xr.manos.derecha]) {
    const b = m.fuente?.gamepad?.buttons?.[5]?.pressed;
    if (b && !m._salirAntes) {
      if (J._salirHasta && J.t < J._salirHasta) { J._salirHasta = 0; inst.abandonar(); }
      else { J._salirHasta = J.t + 3; ui.cartela('Pulsa otra vez B/Y para salir del minijuego', 2.5); }
    }
    m._salirAntes = b;
  }
}
function guardarParaRecreativa() {
  if (J.porro) { J.porroGuardado = J.porro; J.porro.grupo.visible = false; J.porro.mano = null; J.porro = null; }
  if (J.liar) J.liar.grupo.visible = false;
  if (J.mechero) J.mechero.grupo.visible = false;
}
// cobrar una partida de la máquina en el motor (estrellas, monchis, historia)
function cobrar(clave, r) {
  const n = r.estrellas ?? 0; J.resultados.push({ clave, puntos: r.puntos, gana: r.gana, estrellas: n });
  motor?.avisar('minijuego', { clave, puntos: r.puntos, gana: r.gana, colocon: J.colocon });
  ui.cartela(`${r.titulo || clave}: ${r.puntos} puntos · ${'★'.repeat(n)}${'☆'.repeat(3 - n)}`, 5);
  sonido(n >= 2 ? 'oooh' : 'campanita', { volumen: 0.6 });
}
// atajo directo (de día o en pruebas): la máquina viene a ti y arranca ese juego
async function jugarRecreativa(clave) {
  guardarParaRecreativa();
  const faseAntes = J.fase; fase('recreativa'); J.minijuego = { id: 'recreativa:' + clave, inst: { actualizar() { } } };
  const r = await recreativa.jugar(clave, { mundo: J.mundo });
  if (r && !r.abandonado) cobrar(clave, r);
  cerrarMinijuego(faseAntes);
}
function cerrarMinijuego(faseAntes) {
  const eraJuego = J.minijuego && J.minijuego.id !== 'barrio';
  // jugado en su sitio, dentro de una sala del barrio: vuelves a la sala (no al bar)
  const enSala = eraJuego && J.mjEnSala && faseAntes === 'barrio' && !!B.sala; J.mjEnSala = false;
  J.minijuego = enSala ? { id: 'barrio', inst: { actualizar() { } } } : null; fase(faseAntes);
  if (enSala) {
    B.sala.grupo.visible = true; for (const r of B.gente) r.grupo.visible = true;
    ambiente?.entrar(B.salaId, J.mundo, B.sala);
    if (J.antesMj) [lasslow, blancaso].forEach((p, i) => p.grupo.position.copy(J.antesMj[i]));
    guia?.empujar('minijuego', 3);
    setTimeout(tarjetasSala, 700);
    return;
  }
  if (eraJuego) {
    if (J.mundo === 'humo') { recreativa.maquina.visible = true; unake.grupo.visible = true; }
    lasslow.grupo.visible = blancaso.grupo.visible = true;
  }
  if (eraJuego) guia?.empujar('minijuego', 3);
  unake.sofa.visible = true;
  if (J.antesMj) [lasslow, blancaso].forEach((p, i) => p.grupo.position.copy(J.antesMj[i]));
  musica(J.mundo === 'humo' ? 'sofa' : 'dia', J.mundo === 'humo' ? 0.32 : 0.25);
  if (J.porroGuardado) { J.porro = J.porroGuardado; J.porroGuardado = null; J.porro.grupo.visible = true; J.ofrecido = { quien: lasslow, t: 0 }; di('lasslow', 'Te lo he guardado. Casi entero.'); }
  if (J.liar) J.liar.grupo.visible = true;
  if (J.mechero) J.mechero.grupo.visible = true;
}
function mirarMenu() {
  const izq = xr.manos.izquierda, der = xr.manos.derecha;
  // botón B/Y de cualquier mando
  for (const m of [izq, der]) {
    const b = m.fuente?.gamepad?.buttons?.[5]?.pressed;
    if (b && !m._menuAntes && !recreativa?.enUso) abrirMenu();
    m._menuAntes = b;
  }
  // tocar la muñeca
  if (izq.activa && der.activa && ui.munecaM.parent) {
    const p = ui.munecaM.getWorldPosition(_a);
    const cerca = der.punta.distanceTo(p) < 0.045;
    if (cerca && !J._tocaMuneca) { der.vibrar(0.4, 30); abrirMenu(); }
    J._tocaMuneca = cerca;
  }
}

// ---------- el barrio: maqueta en tu mesa → tocar una sala → estás dentro (js/barrio/) ----------
// Se abre desde la muñeca. Mientras paseas, Lasslow y Blancaso te esperan donde estaban (en casa o en Unaké).
const B = { maqueta: null, sala: null, salaId: null, gente: [], cache: new Map(), ocupado: false };
let barrioMods = null;
async function modsBarrio() {
  if (!barrioMods) barrioMods = Promise.all([import('./barrio/maqueta.js'), import('./barrio/proyeccion.js'), import('./barrio/salas.js')])
    .then(([m, p, s]) => ({ Maqueta: m.Maqueta, construirSala: p.construirSala, ...s }));
  return barrioMods;
}
function guardarManos() {
  if (J.porro) { J.porroGuardado = J.porro; J.porro.grupo.visible = false; J.porro.mano = null; J.porro = null; }
  if (J.liar) J.liar.grupo.visible = false;
  if (J.mechero) J.mechero.grupo.visible = false;
}
async function abrirBarrio() {
  const M = await modsBarrio();
  guardarManos();
  B.faseAntes = J.fase; fase('barrio');
  J.minijuego = { id: 'barrio', inst: { actualizar() { } } };
  if (!B.maqueta) { B.maqueta = await M.Maqueta.crear({ mundo: J.mundo, alEntrar: id => entrarSala(id) }); escena.add(B.maqueta.grupo); }
  else await B.maqueta.cambiarMundo(J.mundo);
  ponerMaqueta();
  ui.cartela('El barrio. Toca una sala para entrar.', 3);
}
function ponerMaqueta() {
  const m = xr.mesaCerca();
  let punto;
  if (m) punto = m.punto.clone().setY(m.punto.y + 0.012);
  else { const f = xr.adelante.clone().setY(0).normalize(); punto = xr.cabeza.clone().addScaledVector(f, 0.6); punto.y = Math.max(0.6, xr.cabeza.y - 0.6); }
  B.maqueta.colocar(punto, xr.cabeza); B.maqueta.grupo.visible = true;
  // quién está dónde (paradero vivo) y dónde está cada cosa: ★ la misión, ▶ los minijuegos abiertos
  try { B.maqueta.marcar(marcasMaqueta()); } catch (e) { console.error('[maqueta] marcas', e); }
  if (vida) B.maqueta.ponerParadero(vida.paraderoMaqueta(), J.mundo === 'humo' ? 'dentro' : 'cuarto').catch(e => console.error('[maqueta] paradero', e));
  const f = xr.adelante.clone().setY(0).normalize(), lado = new THREE.Vector3(-f.z, 0, f.x);
  const c = xr.cabeza.clone().addScaledVector(f, 0.45).addScaledVector(lado, 0.35); c.y = xr.cabeza.y - 0.3;
  ui.tarjetasEn([J.mundo === 'humo' ? 'Volver a Unaké' : 'Volver a casa'], c, f.clone().negate(), () => cerrarBarrio());
}
async function salaMontada(id) {
  const M = await modsBarrio(), k = id + '/' + J.mundo;
  if (!B.cache.has(k)) {
    B.cache.set(k, M.construirSala(M.mundoDe(id, J.mundo)));
    // como mucho 3 salas en memoria (el agente avisó: sin límite se acumulan las texturas)
    while (B.cache.size > 3) {
      const [viejo, prom] = B.cache.entries().next().value; B.cache.delete(viejo);
      prom.then(sl => { if (sl !== B.sala) sl.grupo.traverse(o => { o.geometry?.dispose(); }); }).catch(() => { });
    }
  }
  return B.cache.get(k);
}
async function entrarSala(id) {
  if (B.ocupado) return; B.ocupado = true;
  try {
    const M = await modsBarrio();
    ui.quitarTarjetas(); sonido('whoosh', { volumen: 0.6 });
    const nueva = await salaMontada(id);
    const def = M.mundoDe(id, J.mundo), gente = [];
    // la decoración 3D de la sala (se crea nueva en cada entrada: las salas van en caché)
    let deco = null; try { deco = await decorar(id, J.mundo, nueva, { THREE }); } catch (e) { console.error('[deco]', id, e); }
    // quién está: los de casa que no se han ido de visita y las visitas ya llegadas (paradero del 2D, js/barrio/vida.js)
    const sinVer = []; let nVisita = 0;
    for (const q of vida ? vida.quienEn(id, J.mundo) : Object.entries(M.CASAS).filter(([, c]) => c === id).map(([q]) => ({ id: id2d(q), visita: false }))) {
      const quien = idXR(q.id);
      const px = q.visita ? def.visita : def.sitios?.[quien];
      if (!px || (J.mundo !== 'humo' && M.SOLO_HUMO.includes(quien))) { if (!q.visita && M.CASAS[quien] === id) sinVer.push(q.id); continue; }
      try {
        const r = await Recortable.crear(quien, J.mundo);
        const dx = q.visita ? (nVisita++) * def.W * 0.08 : 0;
        r.userData = { local: nueva.sueloDe(px[0] + dx, px[1]) }; r.userData.local.y += px[2] || 0; gente.push(r);
      } catch { if (!q.visita) sinVer.push(q.id); }
    }
    const metasAntes = portales.metas ? [...portales.metas] : null, salaAntes = B.salaId || (J.mundo === 'humo' ? 'dentro' : 'cuarto');
    await new Promise(ok => humo.llenar(xr.cabeza.clone(), () => {
      if (B.maqueta) B.maqueta.grupo.visible = false;
      if (B.sala) escena.remove(B.sala.grupo);
      for (const r of B.gente) escena.remove(r.grupo);
      unake.grupo.visible = false; puerta.grupo.visible = false; casaFalsa.visible = false;
      lasslow.grupo.visible = false; blancaso.grupo.visible = false; recreativa.maquina.visible = false;
      if (J.cosas) for (const l of Object.values(J.cosas)) for (const k of l) k.obj.visible = false;
      B.sala = nueva; B.salaId = id; B.gente = gente;
      ambiente?.entrar(id, J.mundo, nueva); viaje?.enSala?.(nueva, gente);
      const f = xr.adelante.clone().setY(0).normalize();
      nueva.grupo.position.copy(xr.cabeza).setY(0);
      nueva.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), f);
      escena.add(nueva.grupo); nueva.actualizarProyector();
      B.deco?.quitar(); B.deco = deco; if (deco) nueva.grupo.add(deco.grupo);
      if (portales.metas?.includes(id)) portales.guia(null); // has llegado a donde te llevaba el humo
      portales.montar(nueva.grupo, nueva.medidas, id);
      if (id === 'tienda') encargos.montarTablon(nueva.grupo, new THREE.Vector3(Math.max((nueva.medidas?.xl ?? -2) + 0.35, -1.7), 0, -1.1));
      else encargos.quitarTablon();
      montarCosasSala(id, nueva, def);
      // hablar = tocar: entrar ya no cuenta como hablar con quien VES (hay que tocarle); solo con quien no tiene figura
      motor?.avisar('sala', { id, gente: sinVer });
      for (const r of gente) { r.grupo.position.copy(nueva.grupo.localToWorld(r.userData.local.clone())); escena.add(r.grupo); vida?.ponerCasa(r, r.grupo.position); }
      // a tu aire: si entras donde no manda la historia, la guía se calla un rato
      if (metasAntes && !metasAntes.includes(id) && siguientePaso(salaAntes, metasAntes) !== id) guia?.jugandoLibre(120);
      escena.background = new THREE.Color('#1a1426');
      fisica.planos = []; xr.permitirMovimiento(true);
      ok();
    }));
    setTimeout(tarjetasSala, 900);
  } catch (e) { console.error('[barrio] entrar', id, e); }
  B.ocupado = false;
}
// las dos tarjetas de siempre en una sala (a la cintura, a un lado)
function tarjetasSala() {
  if (J.fase !== 'barrio' || !B.sala || J.charla) return;
  const f = xr.adelante.clone().setY(0).normalize(), lado = new THREE.Vector3(-f.z, 0, f.x);
  // a tu izquierda, de lado: que no tapen lo que hay delante (el mostrador, la gente)
  const c = xr.cabeza.clone().addScaledVector(f, 0.28).addScaledVector(lado, -0.45); c.y = xr.cabeza.y - 0.3;
  ui.tarjetasEn(['Mapa', J.mundo === 'humo' ? 'A Unaké' : 'A casa'], c, xr.cabeza.clone().setY(c.y).sub(c).normalize(), t => (t === 'Mapa' ? salirSala(true) : salirSala(false)));
}

// ---------- la gente de cada sala: tocarla (o señalarla y pellizcar) = te habla y te ofrece lo suyo ----------
// Las frases son las del 2D (SALUDOS y CHARLAS de escenas/barrio.js, leídas por el motor).
// El minijuego principal de cada uno (su marca en el 2D); el resto de lo suyo sale de lugaresDe() del 2D.
const MISION_DE = { palicaso: 'Barra', cotine: 'Tarta', lasslow: 'Lasslow', perico: 'Pipas' };
const NOMBRE_DE = { palicaso: 'Palicaso', cotine: 'Cotine', lasslow: 'Lasslow', perico: 'Perico', pompa: 'La Pompa', puky: 'Puky', blancaso: 'Blancaso' };

// ---------- el bar del humo: Palicaso en la barra y la Pompa flotando (como en el 2D), además de tus colegas ----------
// Medidas de SALA_DENTRO (decorado.js) y los sitios de salas.js → dentro.humo: Palicaso (704, 520), la Pompa (960, 560, +1 m).
let genteBar = [], barLug = null, _montandoBar = false;
const SITIO_BAR = { palicaso: new THREE.Vector3(0.02, 0, -4.4), 'la-pompa': new THREE.Vector3(1.36, 1.0, -3.67) };
async function montarGenteBar() {
  if (genteBar.length || _montandoBar) return colocarGenteBar();
  _montandoBar = true;
  try {
    for (const id of Object.keys(SITIO_BAR)) {
      try { const r = await Recortable.crear(id, 'humo'); r.userData = { local: SITIO_BAR[id].clone(), bar: true }; escena.add(r.grupo); genteBar.push(r); } catch { /* sin dibujo */ }
    }
  } finally { _montandoBar = false; }
  colocarGenteBar();
}
function colocarGenteBar() {
  for (const r of genteBar) { r.grupo.position.copy(unake.grupo.localToWorld(r.userData.local.clone())); vida?.ponerCasa(r, r.grupo.position); }
}
const enElBar = () => J.mundo === 'humo' && !!unake?.grupo.visible && J.fase !== 'barrio' && !J.transicion;

// ---------- quién hay aquí (en la sala o en el bar) ----------
// fijo: no pasea (tus colegas en el sofá). soloRayo: en el bar, a Lasslow y Blancaso se les habla señalando y
// pellizcando (tocar de cerca es pasarles el porro).
function personasAqui() {
  if (J.fase === 'barrio' && B.sala && !B.ocupado) return B.gente.map(r => ({ id: id2d(r.id), r }));
  if (J.fase === 'minijuego' || J.fase === 'recreativa') return [];
  if (!enElBar()) return [];
  const out = genteBar.filter(r => r.grupo.visible).map(r => ({ id: id2d(r.id), r }));
  for (const [id, r] of [['lasslow', lasslow], ['blancaso', blancaso]]) if (r?.grupo.visible) out.push({ id, r, fijo: true, soloRayo: true });
  return out;
}
// ¿se puede tocar a alguien ahora? (en el bar, solo con las manos libres y sin pases a medias)
function puedeTocarGente() {
  if (B.ocupado || J.menu || J.charla || escenasH?.ocupada || recreativa?.enUso || J.transicion) return false;
  if (J.fase === 'barrio') return !!B.sala;
  return enElBar() && J.fase === 'fumar' && !J.minijuego && !J.calada && !J.enManos && !J.vuela && !J.ofrecido && !J.liar && !J.mechero;
}
const _rayoG = new THREE.Raycaster();
function pasoGente(dt, ms) {
  J._esperaGente = Math.max(0, (J._esperaGente || 0) - dt);
  if (J._esperaGente > 0 || !puedeTocarGente()) return;
  _rayoG.far = 6;
  const libres = ms.filter(m => m.activa && J.porro?.mano !== m && !agarre.lleva?.(m));
  for (const o of personasAqui()) {
    const r = o.r, p = r.grupo.position;
    if (!r.grupo.visible) continue;
    for (const m of libres) {
      let toca = !o.soloRayo && Math.hypot(m.punta.x - p.x, m.punta.z - p.z) < 0.3 && m.punta.y > p.y + 0.3 && m.punta.y < p.y + 2.2;
      if (!toca && m.empiezaPinza) {
        const dir = m.esMano ? m.punta.clone().sub(xr.cabeza).normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(m.quat);
        _rayoG.set(m.esMano ? xr.cabeza : m.pos, dir);
        toca = _rayoG.intersectObject(r.grupo, true).length > 0;
      }
      if (toca) { m.vibrar(0.4, 40); J._esperaGente = 2.5; return hablarCon(r); }
    }
  }
}
// Los minijuegos de un sitio (persona u objeto), con la misión ★ primero.
function juegosDelSitio(sitio) {
  const mundo = J.mundo === 'humo' ? 'humo' : 'normal';
  const lista = juegosDe(motor, sitio, mundo);
  const principal = MISION_DE[sitio];
  if (principal && motor?.d?.MISIONES?.[principal] && !lista.includes(principal) && mundo === 'humo') lista.unshift(principal);
  const mision = motor?.objetivos()?.historia?.accion?.clave;
  if (mision && lista.includes(mision)) { lista.splice(lista.indexOf(mision), 1); lista.unshift(mision); }
  return { lista: lista.slice(0, 4), mision };
}
// Las tarjetas «Jugar: …» delante de quien (o de lo que) te lo ofrece.
function ofrecerJuegos(sitio, haciaPunto, { alCerrar = null } = {}) {
  const { lista, mision } = juegosDelSitio(sitio);
  if (!lista.length) return false;
  J.charla = true;
  const haciaEl = haciaPunto.clone().sub(xr.cabeza).setY(0).normalize();
  const c = xr.cabeza.clone().addScaledVector(haciaEl, 0.45); c.y = xr.cabeza.y - 0.34; // por debajo de su cara
  const textos = lista.map(k => (k === mision ? '★ ' : '') + 'Jugar: ' + nombreJuego(motor, k));
  ui.tarjetasEn([...textos, 'Ahora no'], c, haciaEl.clone().negate(), t => {
    J.charla = false; ui.quitarTarjetas();
    const i = textos.indexOf(t);
    if (i >= 0) { if (lista[i] !== mision) guia?.jugandoLibre(180); return jugarLugar(lista[i]); }
    alCerrar ? alCerrar() : tarjetasSala();
  });
  clearTimeout(ofrecerJuegos._t);
  ofrecerJuegos._t = setTimeout(() => { if (J.charla) { J.charla = false; ui.quitarTarjetas(); alCerrar ? alCerrar() : tarjetasSala(); } }, 10000);
  return true;
}
function hablarCon(r) {
  const id = id2d(r.id), d = motor?.d;
  vida?.callar(5); // cuando hablas tú, el ambiente se calla
  motor?.avisar('hablar', { con: id });
  if (encargos.actual?.destino.id === id) return entregarEncargo(r, id);
  const lineas = d?.SALUDOS?.[id]?.[J.mundo] || d?.SALUDOS?.[id]?.humo || d?.CHARLAS?.[J.mundo]?.[id] || ['…'];
  const linea = sinRepetir('saludo-' + id, lineas);
  r.decir(linea, { dur: 3.5 });
  // de lejos el bocadillo se lee mal: la frase también en la cartela
  if (r.grupo.position.distanceTo(xr.cabeza) > 1.4) ui.cartela(`${NOMBRE_DE[id] || id}: «${linea}»`, 3.5);
  sonido('pop', { volumen: 0.3 });
  // si no era nadie de la misión, estás dando vueltas: la guía no persigue
  const { con } = motor ? motor.sitiosPendientes(motor.objetivos().historia) : { con: [] };
  if (!con.includes(id)) guia?.jugandoLibre(120);
  if (!SITIOS_PERSONA.includes(id)) return;
  const enBar = J.fase !== 'barrio';
  ofrecerJuegos(id, r.grupo.position, { alCerrar: enBar ? () => { } : null });
}
// Tocar un objeto con minijuegos (la M, el monitor, la lona, la tragaperras…)
function tocarLugar(sitio) {
  const k = (J.fase === 'barrio' ? B.lugares : barLug)?.get(sitio);
  const o = OBJETOS[sitio];
  sonido('pop', { volumen: 0.35 });
  if (o) ui.cartela(o.nombre, 2.5);
  const donde = k ? k.g.getWorldPosition(new THREE.Vector3()) : xr.cabeza.clone().addScaledVector(xr.adelante, 1);
  return ofrecerJuegos(sitio, donde, { alCerrar: J.fase === 'barrio' ? null : () => { } });
}
// Jugar un minijuego desde su sitio: nativo si hay módulo (allí mismo); si no, la máquina con ★.
async function jugarLugar(clave) {
  const id = await nativoDe(clave);
  if (id) {
    if (J.fase === 'barrio' && B.sala) return jugarMinijuego(id);
    if (J.fase === 'barrio' || J.minijuego) return; // de camino (maqueta, otra partida)
    return jugarMinijuego(id);
  }
  if (APUESTAS[clave]) { ui.cartela(`${APUESTAS[clave]}: fuera de servicio. Palicaso dice que mañana la arregla.`, 3.5); if (J.fase === 'barrio') tarjetasSala(); return; }
  if (J.fase === 'barrio') return jugarDesdeSala(clave);
  return irALaMaquina(clave);
}

// ---------- el mundo vivo: paradero, rutinas, charlas y sucesos (js/barrio/vida.js) ----------
function pasoVida(dt) {
  if (!vida || !motor) return;
  J._cadaAgenda = (J._cadaAgenda ?? 1) - dt;
  if (J._cadaAgenda <= 0) {
    J._cadaAgenda = 1;
    const o = motor.objetivos().historia, { con } = motor.sitiosPendientes(o);
    const retener = [...con, encargos.actual?.destino.id].filter(Boolean);
    for (const e of vida.agenda({ mundo: J.mundo, retener })) aplicarVisita(e);
  }
  const libre = !J.charla && !J.menu && !escenasH?.ocupada && !B.ocupado && !J.transicion && !recreativa?.enUso && (J.fase === 'barrio' ? !!B.sala : enElBar() && !J.minijuego && !J.calada && !J.enManos && !J.vuela && !J.ofrecido);
  const s = vida.paso(dt, { personas: personasAqui(), cabeza: xr.cabeza, mundo: J.mundo, libre });
  if (s === 'lluvia') { J.colocon = Math.min(100, J.colocon + 5); ui.cartela('Llueve humo morado. Respira hondo.', 3); }
}
// Una salida o una llegada en la sala donde estás: se le ve irse andando a la puerta, o llegar por ella.
function puertaHacia(dest) {
  const paso = siguientePaso(B.salaId, [dest]) || dest;
  const p = portales.lista.find(x => x.dest === paso) || portales.lista[0];
  if (!p) return null;
  const w = p.malla.getWorldPosition(new THREE.Vector3());
  return w.lerp(B.sala.grupo.getWorldPosition(new THREE.Vector3()).setY(0), 0.12).setY(0);
}
async function aplicarVisita(e) {
  if (J.fase !== 'barrio' || !B.sala || B.ocupado) return;
  const sala = B.salaId, quien = idXR(e.id);
  if (e.tipo === 'sale' && e.de === sala) {
    const r = B.gente.find(x => x.id === quien); if (!r) return;
    const fin = puertaHacia(e.a);
    const quitar = () => { escena.remove(r.grupo); B.gente = B.gente.filter(x => x !== r); };
    if (!fin) return quitar();
    if (Math.random() < 0.6) r.decir(sinRepetir('adios', ['Ahora vuelvo.', 'Voy un momento a ver una cosa.', 'Me voy a dar una vuelta.']), { dur: 2 });
    vida.andar(r, fin, quitar, 0.8);
  }
  if (e.tipo === 'llega' && e.a === sala && !B.gente.some(x => x.id === quien)) {
    const M = await modsBarrio(), def = M.mundoDe(sala, J.mundo), casa = M.CASAS[quien] === sala;
    const px = casa ? def.sitios?.[quien] : def.visita;
    if (!px || (J.mundo !== 'humo' && M.SOLO_HUMO.includes(quien))) return;
    let r; try { r = await Recortable.crear(quien, J.mundo); } catch { return; }
    if (B.salaId !== sala || !B.sala) return;
    const meta = B.sala.grupo.localToWorld(B.sala.sueloDe(px[0] + (casa ? 0 : B.gente.length * def.W * 0.05), px[1]));
    const ini = puertaHacia(e.de) || meta.clone();
    r.grupo.position.copy(ini); escena.add(r.grupo); B.gente.push(r);
    vida.andar(r, meta, () => { vida.ponerCasa(r, meta); const f = casa ? null : vida.fraseVisita(e.id, sala); if (f) r.decir(f, { dur: 2.6 }); }, 0.8);
  }
}
// Las marcas de la maqueta: ★ donde manda la historia, ▶ donde hay minijuegos abiertos (con su gente donde esté).
function marcasMaqueta() {
  const marcas = {}, mundo = J.mundo === 'humo' ? 'humo' : 'normal';
  const poner = (sala, k, v) => { if (!sala) return; (marcas[sala] = marcas[sala] || { estrella: false, juegos: 0 })[k] = k === 'juegos' ? marcas[sala].juegos + v : v; };
  if (motor) {
    const o = motor.objetivos().historia, a = o?.accion;
    if (a) {
      for (const s of motor.sitiosPendientes(o).salas) poner(s, 'estrella', true);
      if (a.tipo === 'hucha') poner('plaza', 'estrella', true);
      if (a.tipo === 'recreativa' && mundo === 'humo') poner('dentro', 'estrella', true);
      if ((a.tipo === 'nativo' || a.tipo === 'recreativa') && a.clave) { const l = salaDeClave(motor, a.clave); if (l) poner(SITIOS_PERSONA.includes(l.sitio) ? (vida?.dondeEsta(l.sitio) || l.sala) : l.sala, 'estrella', true); }
    }
    for (const [sitio, sala] of todosLosSitios(motor)) {
      const n = juegosDelSitio(sitio).lista.length; if (!n) continue;
      poner(SITIOS_PERSONA.includes(sitio) ? (vida?.dondeEsta(sitio) || sala) : sala, 'juegos', n);
    }
  }
  return marcas;
}

// ---------- la tienda de 24 h y la hucha de Blancaso (js/barrio/tienda.js, hucha.js) ----------
function quitarCosasSala() {
  B.tienda?.quitar(); B.tienda = null; B.hucha?.quitar(); B.hucha = null; B.lugares?.quitar();
  for (const m of B.modsSala || []) { try { m.quitar?.(); } catch (e) { console.error('[sala] quitar', e); } }
  B.modsSala = [];
}
// Los módulos de sala que existan (js/barrio/cuarto.js, negocio.js…: API de la tienda). Se enchufan solos.
function montarModulosSala(id, grupo, lista, donde) {
  for (const { archivo, pos, hacia, nombre } of MODULOS_SALA[id] || []) {
    moduloSala(archivo).then(C => {
      if (!C || !donde()) return;
      let m; try { m = new C({ motor, sonido: (n, o) => sonido(n, o), ui, xr, agarre }); } catch (e) { console.error('[sala] módulo', archivo, e); return; }
      m.nombreMod = nombre || archivo;
      if (m.nombreMod === 'negocio') {
        // lo que pasa en el negocio lo dicen Palicaso (mejoras, metas) y Blancaso (la caja)
        const di2 = (quien, l) => { if (!l) return; const r = quien === 'palicaso' ? genteBar.find(x => x.id === 'palicaso') : blancaso; if (r?.grupo.visible) r.decir(l, { dur: 3.2 }); else ui.cartela(l, 3); };
        m.alMejorar = (r, x) => di2('palicaso', `¡Escucha! ${x?.nombre || 'Mejora'} para Unaké. ¡Esto ya es otra cosa!`);
        m.alMeta = meta => di2('palicaso', meta?.texto ? `¡Meta cumplida! ${meta.texto}` : '¡Meta cumplida!');
        m.alCobrar = r => di2('blancaso', `Caja cobrada${r?.monchis ? ': +' + r.monchis + ' monchis' : ''}. Apuntado.`);
      }
      if (m.nombreMod === 'cuarto') {
        m.alVestir = x => ui.cartela(x?.nombre ? `Te pones: ${x.nombre}.` : 'Ropa nueva.', 2.5);
        m.alInventar = x => ui.cartela(x?.nombre ? `Invento nuevo: ${x.nombre}.` : 'Invento nuevo en tu cuarto.', 2.5);
      }
      lista.push(m);
      Promise.resolve(m.montar?.(grupo, new THREE.Vector3(...pos), new THREE.Vector3(...hacia))).then(() => { m.lista = true; if (!donde()) m.quitar?.(); }).catch(e => console.error('[sala] montar', archivo, e));
    });
  }
}
function montarCosasSala(id, sala, def) {
  quitarCosasSala();
  if (!motor) return;
  // los minijuegos que viven en cosas de esta sala (la M, el monitor, la lona, la tragaperras…), en su sitio del 2D
  if (!B.lugares) B.lugares = new Lugares({ motor });
  const kx = (def.W || 1280) / 1280, ky = (def.H || 714) / 714, md = sala.medidas || {};
  const colocar = (x, y) => {
    const p = sala.sueloDe(x * kx, y * ky);
    p.x = THREE.MathUtils.clamp(p.x, (md.xl ?? -3) + 0.45, (md.xr ?? 3) - 0.45);
    p.z = THREE.MathUtils.clamp(p.z, -Math.max(1.2, (md.D ?? 3) - 0.35), -1.0);
    return p;
  };
  try { B.lugares.montar(sala.grupo, id, J.mundo === 'humo' ? 'humo' : 'normal', { colocar }); } catch (e) { console.error('[lugares]', id, e); }
  montarModulosSala(id, sala.grupo, B.modsSala, () => B.salaId === id && B.sala === sala);
  if (id === 'tienda') {
    const t = new Tienda({ motor, sonido, ui, agarre, xr });
    t.alComer = e => { J.colocon = Math.max(0, J.colocon + (e?.colocon || 0)); };
    B.tienda = t;
    t.montar(sala.grupo, new THREE.Vector3(0.2, 0, -0.8), new THREE.Vector3(0, 0, 0)).then(() => { t.lista = true; }).catch(e => console.error('[tienda]', e));
  }
  if (id === 'plaza' && def.sitios?.blancaso) {
    const h = new Hucha({ motor, sonido, ui, xr });
    const [bx, by] = def.sitios.blancaso;
    const habla = l => { const b = B.gente.find(r => r.id === 'blancaso'); if (b && l) b.decir(l, { dur: 3.5 }); else if (l) ui.cartela('Blancaso: «' + l + '»', 3.5); };
    h.alLlenar = habla; h.alHablar = habla;
    B.hucha = h;
    h.montar(sala.grupo, sala.sueloDe(bx - 110, by + 12)).then(() => {
      h.lista = true;
      const a = motor.objetivos()?.historia?.accion; if (a?.tipo === 'hucha' && a.meta) h.setMeta(a.meta);
    }).catch(e => console.error('[hucha]', e));
  }
}

// ---------- lo que hay que recoger (tareas «recoger»): brilla en la sala y se coge con la mano ----------
// Antes se cumplía solo con entrar en la sala; ahora cada cosa flota y brilla delante de ti (en abanico, a 1,1 m)
// y se coge tocándola o señalándola y pellizcando. En el humo, lo de «dentro» está en el propio bar.
const SPRITE_RECOGER = { agua: 'obj-botella-agua', sal: 'obj-bolsa-salado', flor: 'obj-flor-humo', llaves: 'obj-llave', bateria: 'obj-bateria', ambientador: 'obj-ambientador', cartel: 'obj-cartel-roto', mota: 'obj-mota-rosa', hilo: 'obj-palo-pringado', huella: 'obj-cono', mechero: 'obj-mechero-grande', pajarita: 'pajarita' };
const NOMBRE_RECOGER = { agua: 'el agua', sal: 'algo salado', flor: 'una flor', llaves: 'las llaves', bateria: 'la batería', ambientador: 'el ambientador', cartel: 'un trozo del cartel', mota: 'una mota rosa', hilo: 'un hilo de almíbar', huella: 'los agujeritos', mechero: 'un mechero', pajarita: 'una pajarita', paquete: 'un paquete' };
const R = { sala: null, cosas: [], firma: '', cada: 0 };
let texBrillo = null;
function brilloRecoger() {
  if (texBrillo) return texBrillo;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(255,214,40,.95)'); r.addColorStop(1, 'rgba(255,214,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (texBrillo = new THREE.CanvasTexture(c));
}
function quitarRecogibles() {
  for (const k of R.cosas) { k.g.parent?.remove(k.g); k.g.traverse(o => { if (o.material && o.material.map !== texBrillo) o.material.map?.dispose?.(); o.material?.dispose?.(); }); }
  R.cosas = []; R.sala = null; R.firma = '';
}
function dondeEstoy() {
  if (J.fase === 'barrio' && B.sala && !B.ocupado) return { id: B.salaId, grupo: B.sala.grupo };
  if (J.mundo === 'humo' && unake?.grupo.visible && !J.minijuego && !J.transicion) return { id: 'dentro', grupo: unake.grupo };
  return null;
}
function refrescarRecogibles() {
  const d = dondeEstoy(), lista = d && motor ? motor.recogerEn(d.id) : [];
  const firma = d && lista.length ? d.id + ':' + lista.map(r => r.tipo).join(',') : '';
  if (firma === R.firma) return;
  quitarRecogibles(); R.firma = firma; if (!firma) return;
  R.sala = d.id;
  lista.forEach((r, i) => {
    // un poco a la derecha (delante suelen estar el sofá y la gente), a la altura del pecho
    const g = new THREE.Group(), n = lista.length, ang = 0.55 + (i - (n - 1) / 2) * 0.5;
    g.position.set(Math.sin(ang) * 1.0, 1.2, -Math.cos(ang) * 1.0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloRecoger(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.42); g.add(halo);
    const cosa = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd23f', transparent: true }));
    cosa.scale.setScalar(0.1); g.add(cosa);
    const sp = SPRITE_RECOGER[r.tipo];
    if (sp) img(sp + '.png').then(t => { cosa.material.map = t; cosa.material.color.set('#ffffff'); cosa.material.needsUpdate = true; const asp = t.image.width / t.image.height; cosa.scale.set(0.26 * Math.min(1, asp), 0.26 * Math.min(1, 1 / asp), 1); }).catch(() => { });
    g.name = 'recoger-' + r.tipo;
    d.grupo.add(g);
    R.cosas.push({ g, halo, cosa, tipo: r.tipo, fase: Math.random() * 6 });
  });
}
const _rayoR = new THREE.Raycaster();
function pasoRecogibles(dt, ms) {
  R.cada -= dt; if (R.cada <= 0) { R.cada = 0.8; refrescarRecogibles(); }
  if (!R.cosas.length || J.calada || J.charla || J.menu || escenasH?.ocupada || B.ocupado) return;
  _rayoR.camera = camara;
  for (const k of R.cosas) {
    k.fase += dt; k.cosa.position.y = Math.sin(k.fase * 2) * 0.03; k.halo.material.opacity = 0.6 + 0.35 * Math.sin(k.fase * 3);
    const p = k.cosa.getWorldPosition(_a);
    for (const m of ms) {
      if (!m.activa || J.porro?.mano === m) continue;
      let toca = m.punta.distanceTo(p) < 0.16;
      if (!toca && m.empiezaPinza) {
        const dir = m.esMano ? m.punta.clone().sub(xr.cabeza).normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(m.quat);
        _rayoR.set(m.esMano ? xr.cabeza : m.pos, dir); _rayoR.far = 5;
        toca = _rayoR.intersectObject(k.halo, false).length > 0;
      }
      if (toca) { m.vibrar?.(0.6, 50); return cogerRecogible(k); }
    }
  }
}
function cogerRecogible(k) {
  sonido('pop', { volumen: 0.6, tono: 1.2 });
  const p = k.cosa.getWorldPosition(new THREE.Vector3());
  for (let i = 0; i < 10; i++) humo.soltar({ pos: p, vel: new THREE.Vector3().randomDirection().multiplyScalar(0.4), tam: 0.03, vida: 1.1, crece: 0.08, sube: 0.1, frena: 2, brillo: 0.9 });
  motor.avisar('recoger', { sala: R.sala, tipo: k.tipo });
  const o = motor.objetivos().historia;
  ui.cartela(`Cogido: ${NOMBRE_RECOGER[k.tipo] || k.tipo}${o?.tipo === 'recoger' && o.progreso ? ` (${o.progreso})` : ''}.`, 2.5);
  R.firma = '__'; refrescarRecogibles(); guia?.refrescar();
}
J.recogibles = () => R;

// ---------- encargos de la tienda (los del 2D) ----------
function pasoEncargos(dt, ms) {
  const ev = encargos.actualizar(dt, ms, xr.cabeza, xr.manos.izquierda);
  if (ev === 'tablon' && J.fase === 'barrio' && B.salaId === 'tienda' && !J.charla && !B.ocupado) empezarEncargo(0);
  if (ev === 'fallo') { portales.guia(null); ui.cartela('¡Se ha enfriado! Vuelve a la tienda a por otro encargo.', 4); }
}
function empezarEncargo(racha) {
  const d = motor?.d;
  const e = encargos.pedir(d?.DESTINOS || [], d?.PEDIDOS || [], B.salaId, racha, J.mundo);
  if (!e) { ui.cartela('Ahora no hay encargos.', 2.5); return; }
  portales.guia([e.destino.sala]);
  ui.cartela(`Lleva ${e.pedido.nombre} a ${nombreDe(e.destino.id)}. Sigue el hilo de humo.`, 4.5);
}
function entregarEncargo(r, id) {
  const res = encargos.entregar(); if (!res) return;
  motor?.avisar('entrega', { pago: res.pago });
  r.decir(sinRepetir('gracias', ['¡Gracias, rider!', '¡Por fin!', 'Justo lo que necesitaba.', '¿Y la propina? …Era broma.']), { dur: 3 });
  ui.cartela(`+${res.pago} monchis`, 3);
  J.charla = true;
  const haciaEl = r.grupo.position.clone().sub(xr.cabeza).setY(0).normalize();
  const c = xr.cabeza.clone().addScaledVector(haciaEl, 0.45); c.y = xr.cabeza.y - 0.34;
  ui.tarjetasEn([`Otro encargo (racha ×${res.racha + 1})`, 'Basta por hoy'], c, haciaEl.clone().negate(), t => {
    J.charla = false; ui.quitarTarjetas();
    if (t.startsWith('Otro')) empezarEncargo(res.racha); else tarjetasSala();
  });
  setTimeout(() => { if (J.charla) { J.charla = false; ui.quitarTarjetas(); tarjetasSala(); } }, 10000);
}
const esperar = (cond, ms = 8000) => new Promise(ok => { const t0 = performance.now(); const f = () => (cond() || performance.now() - t0 > ms) ? ok() : setTimeout(f, 100); f(); });
// nativo: se juega ya (en el bar o en casa); el resto, en la máquina del bar (de día, la máquina viene a ti)
async function jugarDesdeSala(clave) {
  const nativo = NATIVOS[clave] || await nativoDe(clave);
  // nativo: en su sitio, aquí mismo en la sala (cerrarMinijuego te devuelve a ella)
  if (nativo && J.fase === 'barrio' && B.sala && !B.ocupado) return jugarMinijuego(nativo);
  if (!nativo && J.mundo === 'humo') {
    recreativa.pedir(clave); portales.guia(['dentro']);
    ui.cartela('A la máquina del bar: sigue el hilo de humo. Tu partida sale la primera ★', 4);
    tarjetasSala(); return;
  }
  salirSala(false);
  await esperar(() => !B.ocupado && J.fase !== 'barrio');
  if (nativo) jugarMinijuego(nativo); else jugarRecreativa(clave);
}
function salirSala(aMaqueta) {
  if (B.ocupado) return; B.ocupado = true;
  ui.quitarTarjetas(); sonido('whoosh', { volumen: 0.6 });
  humo.llenar(xr.cabeza.clone(), () => {
    if (B.sala) escena.remove(B.sala.grupo);
    for (const r of B.gente) escena.remove(r.grupo);
    B.sala = null; B.salaId = null; B.gente = []; portales.quitar(); encargos.quitarTablon(); quitarCosasSala();
    B.deco?.quitar(); B.deco = null;
    restaurarMundo();
    // al Mapa: si llegaste andando (sin maqueta aún) se crea; si es del otro mundo, se cambia
    if (aMaqueta) {
      modsBarrio().then(async M => {
        if (!B.maqueta) { B.maqueta = await M.Maqueta.crear({ mundo: J.mundo, alEntrar: id => entrarSala(id) }); escena.add(B.maqueta.grupo); }
        else await B.maqueta.cambiarMundo(J.mundo);
        if (J.fase === 'barrio' && !B.sala) ponerMaqueta();
      }).catch(e => console.error('[barrio] mapa', e));
    } else cerrarBarrio(true);
    B.ocupado = false;
  });
}
// deja el mundo como estaba antes del paseo (de día vuelves a tu sitio real)
function restaurarMundo() {
  lasslow.grupo.visible = true; blancaso.grupo.visible = true;
  if (J.mundo === 'humo') {
    unake.grupo.visible = true; recreativa.maquina.visible = true; escena.background = new THREE.Color('#231a33');
    fisica.planos = unake.planosFisica();
    montarPuertasUnake();
    viaje?.enSala?.(null); ambiente?.entrar('dentro', 'humo', unake, { musica: false });
  } else {
    viaje?.enSala?.(null); ambiente?.salir();
    xr.permitirMovimiento(false);
    puerta.grupo.visible = true; casaFalsa.visible = J.modo !== 'ar';
    escena.background = J.modo === 'ar' ? null : new THREE.Color('#e6dfd2'); fisica.planos = [];
  }
  if (J.cosas) for (const k of J.cosas[J.mundo]) k.obj.visible = true;
}
// Unaké (el bar del humo) es la sala «dentro» del barrio: sus puertas llevan a la calle y a la cocina
// (las de los lados, más al fondo que la máquina, que está en z = −0,9)
function montarPuertasUnake() {
  if (!J.decoBar && !J._decoBarPidiendo) { J._decoBarPidiendo = true; decorar('bar', 'humo', unake, { THREE }).then(d => { J.decoBar = d; unake.grupo.add(d.grupo); }).catch(e => console.error('[deco] bar', e)); } portales.montar(unake.grupo, unake.medidas, 'dentro', { zLado: -2.3 }); montarBar(); }
// Lo vivo del bar del humo: Palicaso y la Pompa, los minijuegos en cosas (la llave del casero) y el negocio.
function montarBar() {
  montarGenteBar().catch(e => console.error('[bar] gente', e));
  if (barLug) { try { barLug.montar(unake.grupo, 'dentro', 'humo', { fijos: SITIOS_BAR }); } catch (e) { console.error('[bar] lugares', e); } }
  if (!J.modsBar) { const l = J.modsBar = []; montarModulosSala('bar', unake.grupo, l, () => J.modsBar === l && J.mundo === 'humo'); }
}
// al irte del humo, el negocio (y lo que haya en el bar) se quita; vuelve a montarse en la próxima noche
function quitarModsBar() {
  for (const m of J.modsBar || []) { try { m.quitar?.(); } catch (e) { console.error('[bar] quitar', e); } }
  J.modsBar = null;
}
const negocioBar = () => (J.modsBar || []).find(m => m.nombreMod === 'negocio' && m.lista) || null;
// ir andando a una sala desde Unaké (sin maqueta)
async function irASala(id) {
  if (B.ocupado || J.transicion) return;
  guardarManos();
  B.faseAntes = J.fase; fase('barrio');
  J.minijuego = { id: 'barrio', inst: { actualizar() { } } };
  await entrarSala(id);
}
// cruzar una puerta: de Unaké a una sala, de sala en sala, o de vuelta al bar
function cruzar(dest) {
  if (J.fase !== 'barrio') return irASala(dest);
  if (dest === 'dentro' && J.mundo === 'humo') return salirSala(false);
  entrarSala(dest);
}
function pasoPuertas(dt, ms) {
  if (!portales.lista.length || J.charla || B.ocupado || J.transicion || J.calada || J.enManos || J.vuela || J.menu || escenasH?.ocupada) return;
  const enSala = J.fase === 'barrio' && B.sala;
  const enUnake = J.mundo === 'humo' && !J.minijuego && ['fumar', 'liar', 'encender'].includes(J.fase);
  if (!enSala && !enUnake) return;
  // en el bar, la mano que lleva el porro o el mechero no abre puertas
  const libres = ms.filter(m => J.porro?.mano !== m && !agarre.lleva?.(m));
  const d = portales.actualizar(dt, { cabeza: xr.cabeza, manos: libres, humo });
  if (d) cruzar(d);
}
function cerrarBarrio(yaRestaurado = false) {
  if (B.sala) { escena.remove(B.sala.grupo); for (const r of B.gente) escena.remove(r.grupo); B.sala = null; B.salaId = null; B.gente = []; }
  quitarCosasSala(); encargos.quitarTablon(); B.deco?.quitar(); B.deco = null;
  if (portales.metas?.includes('dentro')) portales.guia(null); // ya estás en el bar
  if (J.mundo === 'humo') montarPuertasUnake(); else portales.quitar();
  if (!yaRestaurado) restaurarMundo();
  if (B.maqueta) B.maqueta.grupo.visible = false;
  ui.quitarTarjetas();
  cerrarMinijuego(B.faseAntes);
  if (J.mundo === 'humo') llegarAlBar(); else guia?.empujar('volver', 2);
}
// Vuelves al bar del humo (Unaké = la sala «dentro»): Lasslow está contigo, así que cuenta como verle; la guía
// te recuerda la misión.
function llegarAlBar() {
  motor?.avisar('sala', { id: 'dentro', gente: ['lasslow'] });
  guia?.empujar('volver', 3);
}

// ---------- los dos mundos ----------
function cambiarMundo(aHumo) {
  if (J.transicion) return;
  J.transicion = true;
  sonido('whoosh', { volumen: 0.6 });
  viaje?.cortar();
  humo.llenar(xr.cabeza.clone(), async () => {
    if (aHumo) {
      // Unaké alrededor de ti, mirando a donde estaban ellos
      unake.grupo.position.copy(xr.cabeza).setY(0);
      unake.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), J.dirPuerta.clone().setY(0).normalize());
      unake.actualizarProyector();
      unake.grupo.visible = true; puerta.grupo.visible = false; casaFalsa.visible = false;
      escena.background = new THREE.Color('#231a33');
      fisica.planos = unake.planosFisica();
      const asientos = unake.asientos.map(a => unake.grupo.localToWorld(a.clone()));
      for (const [p, a] of [[lasslow, asientos[0]], [blancaso, asientos[1]]]) { p.grupo.position.copy(a); await p.ponerMundo('humo'); }
      repartirCosas('humo');
      recreativa.colocar(unake.grupo.localToWorld(new THREE.Vector3(-1.9, 0, -0.9)), unake.grupo.localToWorld(new THREE.Vector3(0, 0, -0.6))); recreativa.maquina.visible = true;
      J.mundo = 'humo'; musica('sofa', 0.32); ambiente?.entrar('dentro', 'humo', unake, { musica: false });
      montarPuertasUnake();
      xr.permitirMovimiento(true);
      setTimeout(() => frase('humo'), 1600);
      if (!J.yaExplicoMover && J.modo !== 'pc') { J.yaExplicoMover = true; setTimeout(() => ui.cartela('Aquí puedes andar con el joystick izquierdo y girar con el derecho.', 4), 4000); }
    } else {
      xr.permitirMovimiento(false); // de vuelta a tu sitio real: la casa tiene que cuadrar
      humo.disiparAmbiente(); quitarModsBar();
      unake.grupo.visible = false; puerta.grupo.visible = true; casaFalsa.visible = J.modo !== 'ar';
      portales.quitar();
      escena.background = J.modo === 'ar' ? null : new THREE.Color('#e6dfd2');
      fisica.planos = []; J.planosEn = 0;
      for (const [p, s] of [[lasslow, J.sitios[0]], [blancaso, J.sitios[1]]]) { p.grupo.position.copy(s); await p.ponerMundo('normal'); }
      repartirCosas('normal'); recreativa.maquina.visible = false;
      J.mundo = 'normal'; musica('dia', 0.25); ambiente?.salir();
      setTimeout(() => frase('dia'), 1400);
    }
    motor?.avisar('mundo', { mundo: J.mundo });
    J.transicion = false;
    if (J.mundo === 'humo') llegarAlBar(); else guia?.empujar('volver', 4);
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

// En el bar, con una misión en la máquina: un hilo de humo de tus pies a la máquina (como el de las puertas).
function pasoHiloMaquina(dt) {
  if (J.mundo !== 'humo' || J.fase === 'barrio' || J.minijuego || !recreativa?.mision || !recreativa.maquina.visible || recreativa.enUso || J.transicion) return;
  J.cadaHiloMq = (J.cadaHiloMq ?? 0) - dt; if (J.cadaHiloMq > 0) return;
  J.cadaHiloMq = 0.1;
  const fin = recreativa.maquina.getWorldPosition(_b).setY(0.12), ini = xr.cabeza.clone().setY(0.12);
  const total = ini.distanceTo(fin); if (total < 1.0) return;
  const dir = fin.clone().sub(ini).normalize();
  const pos = ini.addScaledVector(dir, 0.35 + ((J.t * 0.9) % 1) * (total - 0.6)); pos.x += (Math.random() - 0.5) * 0.08; pos.z += (Math.random() - 0.5) * 0.08;
  humo.soltar({ pos, vel: dir.multiplyScalar(0.5), tam: 0.05, vida: 1.6, crece: 0.07, sube: 0.02, frena: 0.6, brillo: 0.85, alfa: 0.8 });
}
function director(dt) {
  if (!humo) return;
  const cab = xr.cabeza, ms = manos();
  humo.mirarDesde(cab); humo.actualizar(dt);
  ui.actualizar(dt, cab, xr.cabezaQ, ms);
  if (J._mundoAyudas !== J.mundo) { J._mundoAyudas = J.mundo; ponerAyudas(); }
  manosV.actualizar(dt, { reales: J.mundo !== 'humo' && xr.modo === 'ar' });
  // física: de día, contra tus mesas y paredes reales (se refrescan cada segundo)
  if (J.mundo === 'normal' && xr.sesion && !J.minijuego) { J.planosEn = (J.planosEn ?? 0) - dt; if (J.planosEn <= 0) { J.planosEn = 1; fisica.planosDesdeXR(xr.planos); } }
  agarre.actualizar(dt, ms); fisica.actualizar(dt); golpesAColegas(); pasoBolas(dt);
  reacciones?.actualizar(dt, { personajes: [lasslow, blancaso, ...(B.gente || [])], golpeables: B.gente || [], manos: ms, cuerpos: fisica.cuerpos, colocon: J.colocon, ocupado: p => p === J.enManos || p === J.ofrecido?.quien || !!escenasH?.ocupada });
  ambiente?.actualizar(dt);
  recreativa?.actualizar(dt, ms);
  xr.pausarMovimiento?.(!!recreativa?.enUso);
  if (!recreativa?.enUso) { pasoPuertas(dt, ms); pasoGente(dt, ms); }
  pasoEncargos(dt, ms);
  if (B.deco && B.sala) B.deco.actualizar(dt, J.t, xr.cabeza);
  if (J.decoBar && unake?.grupo.visible) J.decoBar.actualizar(dt, J.t, xr.cabeza);
  // tienda y hucha: solo cuando su montar() (asíncrono) ha terminado
  if (J.fase === 'barrio' && !J.charla) { if (B.tienda?.lista) B.tienda.actualizar(dt, ms); if (B.hucha?.lista) B.hucha.actualizar(dt, ms); }
  // los módulos de sala (cuarto, negocio…) y los sitios con minijuegos; el bar del humo, con su gente
  const tocable = !recreativa?.enUso && puedeTocarGente();
  const manosLibres = ms.filter(m => J.porro?.mano !== m && !agarre.lleva?.(m));
  if (J.fase === 'barrio' && B.sala && !J.charla) {
    for (const m of B.modsSala || []) if (m.lista) { try { m.actualizar?.(dt, ms); } catch (e) { if (!m._err) { m._err = true; console.error('[sala] módulo', e); } } }
    const s = B.lugares?.actualizar(dt, manosLibres, cab, { puede: tocable }); if (s) tocarLugar(s);
  }
  const barVisible = enElBar() && !(J.minijuego && J.minijuego.id !== 'barrio');
  for (const r of genteBar) { r.grupo.visible = barVisible; if (barVisible) r.actualizar(dt, cab); }
  if (barVisible) {
    for (const m of J.modsBar || []) if (m.lista && !J.charla && ['fumar', 'liar', 'encender'].includes(J.fase) && !J.minijuego) { try { m.actualizar?.(dt, ms); } catch (e) { if (!m._err) { m._err = true; console.error('[bar] módulo', e); } } }
    const s = barLug?.actualizar(dt, manosLibres, cab, { puede: tocable }); if (s) tocarLugar(s);
  }
  pasoVida(dt);
  if (J.fase === 'barrio') { if (B.maqueta?.grupo.visible) B.maqueta.actualizar(dt, ms, cab); for (const r of B.gente) r.actualizar(dt, cab); }
  if (J.minijuego) { mirarSalirMinijuego(); try { J.minijuego.inst.actualizar(dt); } catch (e) { if (!J._errMj) { J._errMj = true; console.error('[minijuego]', e); } } }
  if (!escenasH?.ocupada && !J.charla && (J.fase === 'fumar' || J.fase === 'liar' || J.fase === 'encender' || (J.fase === 'barrio' && B.sala && !B.ocupado))) mirarMenu();
  if (motor && J.fase !== 'portada' && J.fase !== 'prueba') {
    motor.paso(dt, { colocon: J.colocon });
    escenasH.actualizar(dt, ms);
    if (xr.manos.izquierda.activa) munecaH.actualizar(dt, xr.manos.izquierda, xr.manos.derecha);
    if (motor.escenaPendiente && libreParaHistoria()) contarEscena();
    if (J.fase !== 'intro') { guia.paso(dt); pasoRecogibles(dt, ms); pasoHiloMaquina(dt); }
  }
  viaje?.actualizar(dt, { puede: J.mundo === 'humo' && !J.transicion && !J.calada && !J.enManos && !J.vuela && !(J.minijuego && J.minijuego.id !== 'barrio') && !recreativa?.enUso, colocon: J.colocon });
  vineta.material.opacity = Math.min(0.85, (xr.movimiento?.velocidad ?? 0) / 1.5 * 0.85);
  vineta.visible = vineta.material.opacity > 0.01;
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
      motor?.avisar('liar');
      di('lasslow', 'Ahí está. Precioso.');
      darMechero();
    }
  }
  const porro = J.porro;
  if (porro) {
    if (porro.mano) porro.seguirMano(porro.mano, xr.boca());
    else if (J.vuela) {
      // de un colega al otro, en arco
      const v = J.vuela; v.t = Math.min(1, v.t + dt / 0.7);
      const hasta = v.hasta.bocaMundo(_a);
      porro.grupo.position.lerpVectors(v.desde, hasta, v.t); porro.grupo.position.y += Math.sin(v.t * Math.PI) * 0.25;
      porro.grupo.rotation.x += dt * 9;
    } else if (J.enManos) {
      // lo tiene un colega: entre los dedos, junto a su boca
      const b = J.enManos.bocaMundo(_a);
      porro.grupo.position.copy(b).add(_b.set(0, -0.04, 0.03));
      porro.grupo.lookAt(cab);
    } else if (J.ofrecido) {
      // te lo tiende: sujeto hacia ti, a la altura de su mano; si en 7 s no llegas, viene solo
      const o = J.ofrecido; o.t += dt;
      let meta;
      if (o.t < 7) {
        const b = o.quien.bocaMundo(_a);
        const hacia = cab.clone().sub(b).setY(0).normalize();
        meta = b.clone().addScaledVector(hacia, 0.32); meta.y = b.y - 0.18 + Math.sin(J.t * 3) * 0.01;
        o.quien.inclina = 0.8;
      } else { meta = cab.clone().addScaledVector(xr.adelante.clone().setY(0).normalize(), 0.33); meta.y = cab.y - 0.3; o.quien.inclina = 0; }
      porro.grupo.position.lerp(meta, Math.min(1, dt * 4));
      porro.grupo.lookAt(cab);
      ui.instruccion('Cógelo de su mano con un pellizco');
      for (const m of ms) if (m.activa && m.empiezaPinza && m.punta.distanceTo(porro.grupo.position) < 0.14) {
        porro.mano = m; o.quien.inclina = 0; ui.instruccion(null);
        reacciones.recibir(o.quien, m, porro.grupo.position); J.ofrecido = null;
        break;
      }
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
      J.cadaAmbiente = 0.8;
      const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.8;
      humo.soltar({ pos: new THREE.Vector3(cab.x + Math.cos(a) * r, 2.3 + Math.random() * 0.6, cab.z + Math.sin(a) * r), vel: new THREE.Vector3(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05), tam: 0.4, vida: 14, crece: 0.05, sube: 0, frena: 0, brillo: 0.15, alfa: 0.38, tamMax: 0.95, ambiente: true });
    }
  }
  // el colocón baja solo; los mundos cambian con histéresis
  J.colocon = Math.max(0, Math.min(100, J.colocon - dt * (J.mundo === 'humo' ? 0.16 : 0.05)));
  if (xr.manos.izquierda.activa) ui.colocon(J.colocon, xr.manos.izquierda);
  if (!J.transicion && !J.calada && J.fase !== 'portada' && !J.minijuego) {
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
