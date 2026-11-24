// Las casetas de la feria · VR nativo (escala «inmersivo» con todo lo que se toca a escala mesa).
// Reglas, textos y escalada de base/js/escenas/casetas.js.
//
// Estás en la feria del humo de noche (bg-feria en panorama, bombillas). Delante, una mesa de caseta con el TABLÓN:
// tres huecos de ficha (tiro, noria, martillo) que se juegan en cualquier orden. Tocas una tarjeta (con el dedo o
// con un pellizco) y la caseta aparece en la misma mesa. El feriante (cartón) habla desde la izquierda.
//
//   TIRO      es js/minijuegos/tiropato.js tal cual: se crea aquí dentro con un ctx envuelto cuyo `terminar`
//             intercepta el resultado (ficha si se supera su primer umbral, 600) y vuelve al tablón.
//   NORIA     una noria de juguete (~0,45 m) sobre la mesa y, delante, un volante con dos asas. Lo coges con las dos
//             manos (pellizco/gatillo o puño/agarre) y lo inclinas: la diferencia de altura entre las manos empuja
//             (sube la mano del lado que cae). Frenas juntando las manos o apretando el puño/agarre. Pasajeros con su
//             peso y su manía como en el 2D, 40 s, 3 vidas, vuelco a 26°.
//   MARTILLO  un mazo de verdad tumbado en la mesa (se coge con ctx.agarre). La barra de al lado sube y baja; das un
//             golpe hacia abajo en la base: la altura que alcanza la pieza = el momento de la barra × la fuerza
//             (velocidad del golpe). Tres golpes, cada uno con su regla (rápido, con finta, a ciegas bajo una lona,
//             a su aire). Dos campanazos = ficha.
//
// Las fichas se guardan aunque salgas (localStorage['unake-xr-casetas']). Con las tres se cierra la feria
// (terminar con gana:true y las fichas se gastan). Si sales a medias (cartel «Salir» del tablón), terminar con
// gana:false y los puntos que lleves.
import * as THREE from 'three';
import { Bocadillo } from '../bocadillo.js';
import TiroPato from './tiropato.js';

const CA = {
  limite: 26,          // grados de inclinación a partir de los que se vuelca
  duracion: 40,
  umbralMartillo: 2,   // campanazos para la ficha
  fichaPts: 300,
  umbralTiro: 600,     // primer umbral del tiro al pato (MISIONES.TiroPato.umbrales[0])
};
const CLAVE_LS = 'unake-xr-casetas';

const FRASES = {
  tablon: ['Pasen, pasen. Tres casetas, tres fichas.', 'Con tres fichas se lleva el peluche. Casi.', 'Elija caseta. El tiempo es humo.', 'Hoy hay de todo menos cola.', 'Una ficha por caseta. Las normas son las normas.', 'Si no sabe por dónde empezar, empiece por donde huela a churro.'],
  vuelve: ['Otra vez por aquí. Eso es fidelidad.', 'Le guardo las fichas, no se preocupe.', 'Quedan casetas. Siempre quedan casetas.', 'El tablón no se va a ninguna parte.'],
  fichaTiro: ['Esa ficha se la ganó el pato.', 'Veo que los patos le temen. Ficha para usted.', 'Puntería de feria. Ficha puesta.'],
  tiroKo: ['Los patos han ganado. Otra vez será, pase, pase.', 'Sin ficha. Los patos lo celebran.', 'Hoy los patos tenían el día.'],
  noriaIni: ['Que no se vuelque nadie, que luego pagan seguro.', 'Empuje hacia el lado contrario. Y frene si va a más.', 'La noria es vieja, pero tiene carácter.', 'Suave, suave. Que no es una batidora.'],
  susto: ['¡Eh, eh! ¡Que ahí va gente!', 'Un susto menos. Cuidado con el siguiente.', '¡Equilibrio, caballero!', 'Se me cae la clientela.', 'Eso ha crujido. Eso no es bueno.'],
  lasslow: ['Ese se ríe y la cabina bota.', '¡Que alguien le cuente algo triste!', 'Cuando se ríe, agárrese.', 'Es el único que se ríe de su propio billete.'],
  cotine: ['Eso era algodón, ¿verdad?', 'Come y pesa. Ley de feria.', 'No me mire el género, que es de la casa.'],
  pompa: ['La señorita sube sola.', 'Esa va a tocar el cielo.', 'Ligerita. Demasiado.'],
  palicaso: ['Ese no para quieto ni pagando.', 'Que se siente, por favor.', '¡No salude a todo el mundo!', 'Esa cabina no es una pista de baile.'],
  perico: ['¡El pájaro cambia de cabina!', 'Pin pin, dice. Y se cambia.', 'Los pájaros no pagan billete.', 'Ese se cree que tiene asiento fijo.'],
  bien: ['Así, así. Suave.', 'Eso es mano de feriante.', 'Perfecto. Casi sospechoso.', 'Ni una arruga en la noria.', 'Mire qué elegancia.'],
  noriaOk: ['Todos arriba y todos abajo. ¡Ficha!', 'Ni una cabina volcada. Ficha para usted.', 'La noria y yo estamos muy orgullosos. Ficha.'],
  noriaKo: ['La noria necesita un descanso. Y los pasajeros, una estampita.', 'Se vuelca más que mi paciencia. Pruebe otra vez.', 'Hoy no. Pero la noria sigue ahí.'],
  marIni: ['A ver ese brazo. Tres golpes.', 'La campana está arriba. El brazo, abajo.', 'No es fuerza, es ritmo. Aunque todos creen que es fuerza.'],
  vaiven: ['Este va a su aire.', 'Normal. De los de toda la vida.', 'Este sube y baja como mi sueldo.'],
  rapido: ['Este va con prisa.', 'Rápido, rápido, que hay cola.', 'Este no espera ni a su madre.'],
  finta: ['Ojo, que este se hace el tonto.', 'Mire lo que no es.', 'Este engaña. Como el algodón.', 'Se para, pero no se fíe.'],
  ciegas: ['Bajo la lona un instante. Escuche el ritmo.', 'A ciegas, que es más feria.', 'Ahora no mire. Sienta.'],
  campana: ['¡CLANG! ¡La campana!', 'Eso se oye en el barrio de al lado.', '¡Hasta las bombillas!', 'La campana ha subido hasta las bombillas.'],
  flojo: ['Eso ha sido un cosquilleo.', 'El mazo casi ni se ha enterado.', 'Con cariño, pero sin fuerza.', 'Casi. Casi, casi.'],
  tarde: ['Se le enfrió el brazo.', 'Eso se llama pensárselo demasiado.', 'El golpe se fue sin usted.'],
  marOk: ['Dos campanazos. ¡Ficha!', 'Un brazo con ritmo. Ficha.', 'La campana le debe una cerveza. Ficha.'],
  marKo: ['Dos campanazos o no hay ficha. Pruebe otra vez.', 'La campana no se ha enterado. Otra ronda.', 'El mazo le ha ganado hoy. Mañana, quizá.'],
  cierre: ['¡Tres fichas! Cierro la feria. Por hoy.', 'Se las ha llevado todas. Le dejo hasta el peluche.'],
  salir: ['Le guardo las fichas. Vuelva cuando quiera.', 'El tablón le espera.', 'Váyase, váyase. Las casetas no se mueven.'],
};
// Memoria entre partidas (como el 2D): ninguna frase se repite hasta agotar su tramo.
const BOLSAS = {};
function frase(tipo) {
  const lista = FRASES[tipo];
  if (!BOLSAS[tipo]?.length) {
    const nueva = [...lista].sort(() => Math.random() - 0.5);
    if (BOLSAS[tipo + '_u'] && nueva.length > 1 && nueva[nueva.length - 1] === BOLSAS[tipo + '_u']) nueva.unshift(nueva.pop());
    BOLSAS[tipo] = nueva;
  }
  const f = BOLSAS[tipo].pop();
  BOLSAS[tipo + '_u'] = f;
  return f;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const REGLAS_MARTILLO = {
  vaiven: { nombre: 'A SU AIRE', color: '#7ee081', tramos: () => [[rnd(0.86, 1), rnd(0.8, 1.6)], [rnd(0, 0.12), rnd(0.7, 1.4)]] },
  rapido: { nombre: 'RÁPIDO', color: '#ff5fa2', tramos: () => [[rnd(0.88, 1), rnd(0.45, 0.6)], [rnd(0, 0.1), rnd(0.45, 0.6)]] },
  finta: { nombre: 'CON FINTA', color: '#ffd23f', tramos: () => [[0.74, 0.4], [0.74, 0.65], [0.2, 0.35], [1, 0.3], [0.05, 0.85]] },
  ciegas: { nombre: 'A CIEGAS', color: '#5adceb', tramos: () => [[rnd(0.88, 1), rnd(1.0, 1.25)], [rnd(0, 0.1), rnd(1.0, 1.25)]] },
};
let BOLSA_REGLAS = [];

// Pasajeros de la noria: dibujo, pose de su manía y alto en metros.
const PASAJEROS = {
  lasslow: { tex: 'lasslow', extra: 'lasslow-risa-floja', alto: 0.085 },
  palicaso: { tex: 'palicaso', extra: null, alto: 0.085 },
  pompa: { tex: 'pompa', extra: 'pompa-hinchada', alto: 0.08 },
  cotine: { tex: 'cotine', extra: null, alto: 0.082 },
  perico: { tex: 'perico', extra: 'perico-volando', alto: 0.062 },
};
const SUBEN = [['lasslow', 0], ['palicaso', 4], ['pompa', 9], ['cotine', 15], ['perico', 22]];
const CABINAS_DE = [0, 3, 1, 4, 2];

const TINTA = '#140c1c', PAPEL = '#fffaf0', CARTON = '#b98d5e';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mb = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const MAT_TINTA = mb(TINTA, { side: THREE.BackSide });
function tinta(malla, e = 0.005) {
  malla.geometry.computeBoundingBox();
  const s = malla.geometry.boundingBox.getSize(V());
  const t = new THREE.Mesh(malla.geometry, MAT_TINTA);
  t.scale.set(1 + 2 * e / Math.max(s.x, 1e-3), 1 + 2 * e / Math.max(s.y, 1e-3), 1 + 2 * e / Math.max(s.z, 1e-3));
  malla.add(t);
  return malla;
}
function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g, t };
}
function txt(g, s, x, y, tam, color, { alinear = 'center', borde = true } = {}) {
  g.font = `${tam}px Caprasimo, serif`; g.textAlign = alinear; g.textBaseline = 'middle';
  if (borde) { g.lineJoin = 'round'; g.lineWidth = Math.max(4, tam / 5); g.strokeStyle = TINTA; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
function moneda(g, x, y, r, tiene) {
  g.fillStyle = TINTA; g.beginPath(); g.arc(x, y + 3, r + 5, 0, 7); g.fill();
  g.fillStyle = tiene ? '#ffd23f' : '#4a3d5c'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = tiene ? '#ffe680' : '#5d4f72'; g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.fill();
  if (tiene) {
    g.fillStyle = TINTA; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.2 : r * 0.45; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.fill();
  }
}
// silueta de un color con la transparencia del dibujo (borde de troquel y canto de cartón)
function materialSilueta(color, map) {
  const m = new THREE.MeshBasicMaterial({ color, map, alphaTest: 0.5 });
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
  m.customProgramCacheKey = () => 'silueta-casetas';
  return m;
}
const GEO_PLANO = new THREE.PlaneGeometry(1, 1);

// ---------- iconos de las tarjetas (los del 2D, en canvas) ----------
function iconoTiro(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = TINTA;
  [[-30, 6, 28], [4, 0, 30], [32, 8, 22]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a, b, r + 5, 0, 7); g.fill(); });
  g.beginPath(); g.arc(46, -22, 22, 0, 7); g.fill();
  g.fillStyle = '#f1ecf8';
  [[-30, 6, 28], [4, 0, 30], [32, 8, 22]].forEach(([a, b, r]) => { g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); });
  g.beginPath(); g.arc(46, -22, 17, 0, 7); g.fill();
  g.fillStyle = '#ff9a3b'; g.beginPath(); g.moveTo(60, -24); g.lineTo(78, -18); g.lineTo(60, -12); g.fill();
  g.fillStyle = TINTA; g.beginPath(); g.arc(50, -26, 4, 0, 7); g.fill();
  g.strokeStyle = TINTA; g.lineWidth = 8; g.beginPath(); g.arc(-8, 4, 34, 0, 7); g.stroke();
  g.strokeStyle = '#ff5fa2'; g.lineWidth = 4; g.beginPath(); g.arc(-8, 4, 34, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(-8, -44); g.lineTo(-8, 52); g.moveTo(-56, 4); g.lineTo(40, 4); g.stroke();
  g.restore();
}
function iconoNoria(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = TINTA; g.lineWidth = 8; g.beginPath(); g.moveTo(-36, 70); g.lineTo(0, -6); g.lineTo(36, 70); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.arc(0, -6, 60, 0, 7); g.stroke();
  g.strokeStyle = '#fff3c4'; g.lineWidth = 5; g.beginPath(); g.arc(0, -6, 60, 0, 7); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, cx = Math.sin(a) * 60, cy = -6 - Math.cos(a) * 60;
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, -6); g.lineTo(cx, cy); g.stroke();
    g.fillStyle = TINTA; g.fillRect(cx - 11, cy - 5, 22, 22);
    g.fillStyle = ['#ff5fa2', '#5adceb', '#ffd23f'][i % 3]; g.fillRect(cx - 8, cy - 2, 16, 16);
  }
  g.restore();
}
function iconoMartillo(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = TINTA; g.fillRect(-8, -42, 16, 112); g.fillRect(-44, -56, 88, 42);
  g.fillStyle = '#d9a85e'; g.fillRect(-5, -38, 10, 104);
  g.fillStyle = '#e8364f'; g.fillRect(-40, -52, 80, 34);
  g.fillStyle = TINTA; g.beginPath(); g.moveTo(58, -62); g.lineTo(90, -62); g.lineTo(74, -20); g.fill(); g.fillRect(52, -26, 44, 10); g.beginPath(); g.arc(74, -14, 7, 0, 7); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(61, -58); g.lineTo(87, -58); g.lineTo(74, -26); g.fill();
  g.restore();
}

// ======================================================================================
export default {
  clave: 'Casetas', titulo: 'Las casetas de la feria', escala: 'inmersivo', umbrales: [2200, 2550, 2800],

  async crear(ctx) {
    const { xr, fisica, agarre, humo, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'casetas';
    const texturasPropias = [];
    const lz = (w, h) => { const l = lienzo(w, h); texturasPropias.push(l.t); return l; };
    const nivel = ctx.nivel ?? 1;
    const dif = 1 + 0.1 * Math.min(nivel - 1, 8);

    // ---------- banderas de partida: TODAS aquí («Otra vez» llama a crear de nuevo) ----------
    const est = {
      modo: 'cargando', t: 0, gen: 0, acabado: false, destruido: false, ultimaFrase: -9,
      tocarEspera: 0, hover: null, tablonClave: '', hudClave: '', confeti: 0, recoger: 0,
    };
    let N = null, M = null, tiro = null;
    const eventos = []; // [{ t, fn, gen }] (en vez de setTimeout: destruir los cancela)
    const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn, gen: null });
    const espera = (seg, fn) => eventos.push({ t: est.t + seg, fn, gen: est.gen }); // se anula al cambiar de modo

    // ---------- fichas guardadas (sobreviven a salir) ----------
    function leerFichas() {
      let c = {};
      try { c = JSON.parse(localStorage.getItem(CLAVE_LS) || '{}') || {}; } catch { c = {}; }
      return { tiro: !!c.tiro, noria: !!c.noria, martillo: !!c.martillo, pNoria: +c.pNoria || 0, pMartillo: +c.pMartillo || 0, pTiro: +c.pTiro || 0 };
    }
    const fichas = leerFichas();
    const guardar = () => { try { localStorage.setItem(CLAVE_LS, JSON.stringify(fichas)); } catch { /* sin almacenamiento */ } };
    const fichasN = () => ['tiro', 'noria', 'martillo'].filter(k => fichas[k]).length;
    const puntosTotales = () => fichasN() * CA.fichaPts + Math.round(fichas.pNoria) + Math.round(fichas.pMartillo);

    // ---------- dónde: delante de ti, la mesa a tu cintura (de pie o sentado) ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const H = clamp(xr.cabeza.y - 0.62, 0.6, 1.05);
    const base = new THREE.Group(); base.name = 'feria';
    base.position.copy(xr.cabeza).setY(0); base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); grupo.updateMatrixWorld(true);
    const qBase = base.quaternion.clone();
    const aMundo = (x, y, z, out = V()) => out.set(x, y, z).applyMatrix4(base.matrixWorld);
    const aLocal = (v, out = V()) => base.worldToLocal(out.copy(v));

    // ---------- arte ----------
    const nombresPas = [...new Set(Object.values(PASAJEROS).flatMap(p => [p.tex, p.extra]).filter(Boolean))];
    const [texFer, texFerE, texFondo, ...texPas] = await Promise.all([
      ctx.img('feriante.png'), ctx.img('feriante-emocionado.png').catch(() => null), ctx.img('bg-feria.jpg'),
      ...nombresPas.map(n => ctx.img(n + '.png').catch(() => null)),
    ]);
    const TEX = Object.fromEntries(nombresPas.map((n, i) => [n, texPas[i]]));
    if (est.destruido) return { grupo, actualizar() { }, destruir() { } };

    // ---------- la feria de noche ----------
    const escenario = new THREE.Group(); base.add(escenario);
    escenario.add(new THREE.Mesh(new THREE.SphereGeometry(30, 20, 10), mb('#1d1433', { side: THREE.BackSide })));
    const tf = texFondo.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(2, 1); tf.offset.x = -0.33; tf.needsUpdate = true; texturasPropias.push(tf);
    const pano = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 8, 48, 1, true, Math.PI - 1.75, 3.5), mb('#9a8fb8', { map: tf, side: THREE.BackSide }));
    pano.position.y = 2.6; escenario.add(pano);
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(20, 40), mb('#2a2131'));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.003; escenario.add(suelo);
    // guirnaldas de bombillas en arco por encima (una malla instanciada)
    const bombPos = [];
    for (let i = 0; i <= 26; i++) {
      const a = -1.25 + i * 2.5 / 26;
      bombPos.push([Math.sin(a) * 2.6, 2.55 + Math.cos(i * 0.48) * 0.12, -Math.cos(a) * 2.6]);
    }
    for (let i = 0; i <= 12; i++) bombPos.push([-1.6 + i * 3.2 / 12, 2.25 + Math.sin(i * Math.PI / 6) * 0.08, -1.7]);
    const bombillas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), mb('#ffffff'), bombPos.length);
    const COL_BOMB = ['#ffd23f', '#ff5fa2', '#5adceb', '#7ee081'].map(c => new THREE.Color(c));
    { const m4 = new THREE.Matrix4(); bombPos.forEach((p, i) => { bombillas.setMatrixAt(i, m4.makeTranslation(...p)); bombillas.setColorAt(i, COL_BOMB[i % 4]); }); }
    escenario.add(bombillas);
    let parpadeo = 0, turno = 0;
    const _col = new THREE.Color();
    function parpadear(dt) {
      parpadeo -= dt; if (parpadeo > 0) return;
      parpadeo = 0.42; turno ^= 1;
      for (let i = 0; i < bombPos.length; i++) bombillas.setColorAt(i, _col.copy(COL_BOMB[i % 4]).multiplyScalar((i + turno) % 2 ? 1 : 0.35));
      bombillas.instanceColor.needsUpdate = true;
    }

    // ---------- la mesa de la caseta (sirve al tablón, a la noria y al martillo) ----------
    const MESA = { x: 0.43, z0: -0.72, z1: -0.2 };
    const madera = (() => {
      const { g, t } = lz(256, 256);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#c08347', '#b0773c', '#c58a4c', '#a86f37'][i]; g.fillRect(0, i * 64, 256, 64);
        g.fillStyle = 'rgba(20,12,28,.5)'; g.fillRect(0, i * 64, 256, 4);
      }
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
    })();
    const mesaTapa = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * MESA.x, 0.04, MESA.z1 - MESA.z0), mb('#ffffff', { map: madera })), 0.006);
    mesaTapa.position.set(0, H - 0.02, (MESA.z0 + MESA.z1) / 2); escenario.add(mesaTapa);
    const mesaFrente = new THREE.Mesh(new THREE.BoxGeometry(2 * MESA.x - 0.04, H - 0.04, MESA.z1 - MESA.z0 - 0.04), mb('#6e3f2a'));
    mesaFrente.position.set(0, (H - 0.04) / 2, (MESA.z0 + MESA.z1) / 2); escenario.add(mesaFrente);
    // faldón de rayas con el letrero
    const faldon = (() => {
      const { g, t } = lz(1024, 160);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#fff3c4' : '#e8364f'; g.fillRect(i * 64, 0, 64, 160); }
      g.fillStyle = TINTA; g.fillRect(0, 0, 1024, 8); g.fillRect(0, 152, 1024, 8);
      g.fillStyle = 'rgba(20,12,28,.78)'; g.beginPath(); g.roundRect(232, 26, 560, 108, 22); g.fill();
      txt(g, 'LAS CASETAS', 512, 82, 70, '#ffd23f');
      t.needsUpdate = true; return t;
    })();
    const cartelMesa = new THREE.Mesh(new THREE.PlaneGeometry(2 * MESA.x - 0.04, (2 * MESA.x - 0.04) * 160 / 1024), mb('#ffffff', { map: faldon }));
    cartelMesa.position.set(0, H - 0.1, MESA.z1 + 0.003); escenario.add(cartelMesa);

    // ---------- el feriante (cartón) con su bocadillo ----------
    const matsFer = { frente: mb('#ffffff', { map: texFer, alphaTest: 0.5 }), borde: materialSilueta(PAPEL, texFer), canto: materialSilueta(CARTON, texFer) };
    const altoFer = 1.35;
    const feriante = new THREE.Group(); feriante.position.set(-1.2, 0, -1.25); // a tu izquierda, fuera del tablón
    feriante.rotation.y = Math.atan2(-feriante.position.x, -feriante.position.z);
    const ferCarton = new THREE.Group(); ferCarton.position.y = altoFer / 2; feriante.add(ferCarton);
    const capasFer = [['canto', -0.012, 1.05, 1.04], ['borde', -0.004, 1.05, 1.04], ['frente', 0, 1, 1]].map(([k, z, sx, sy]) => {
      const m = new THREE.Mesh(GEO_PLANO, matsFer[k]); m.position.z = z; m.userData.s = [sx, sy]; ferCarton.add(m); return m;
    });
    function vestirFeriante(tex) {
      for (const m of Object.values(matsFer)) { m.map = tex; m.needsUpdate = true; }
      const ancho = altoFer * tex.image.width / tex.image.height;
      capasFer.forEach(m => m.scale.set(ancho * m.userData.s[0], altoFer * m.userData.s[1], 1));
    }
    vestirFeriante(texFer);
    escenario.add(feriante);
    const bocFer = new Bocadillo(); feriante.add(bocFer.malla);
    let ferContento = 0, ferT = 0;
    function cambiarFeriante(contento) {
      vestirFeriante(contento && texFerE ? texFerE : texFer);
      ferContento = contento ? 1.5 : 0;
    }
    // Frase del feriante; una voz a la vez. Lo que no corre prisa no interrumpe.
    function dice(tipo, siempre = false, dur = 2.2) {
      if (est.destruido) return;
      if (!siempre && (est.t - est.ultimaFrase < 3 || bocFer.malla.visible)) return;
      est.ultimaFrase = est.t;
      const f = frase(tipo);
      bocFer.mostrar(f, Math.max(dur, Math.min(4.2, 1.4 + f.length * 0.05)));
    }

    // ---------- humo de feria (confeti de bocanadas) ----------
    function bocanadas(posLocal, n, brillo = 0.8, fuerza = 0.5) {
      const p = aMundo(posLocal.x, posLocal.y, posLocal.z);
      for (let i = 0; i < n; i++) {
        humo.soltar({ pos: p.clone().add(V((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.1)), vel: V((Math.random() - 0.5) * fuerza, 0.15 + Math.random() * fuerza, (Math.random() - 0.5) * fuerza * 0.5), tam: 0.035 + Math.random() * 0.04, vida: 0.9 + Math.random() * 0.8, crece: 0.15, sube: 0.1, frena: 1.6, brillo, alfa: 0.75 });
      }
    }

    // ======================================================================================
    // EL TABLÓN
    // ======================================================================================
    const TW = 0.84, TH = 0.525, PXW = 1024, PXH = 640;
    const tablon = new THREE.Group(); tablon.name = 'tablon';
    tablon.position.set(0, H + 0.03 + TH / 2 * Math.cos(0.3), -0.46); tablon.rotation.x = -0.3;
    base.add(tablon);
    const marcoT = tinta(new THREE.Mesh(new THREE.BoxGeometry(TW + 0.05, TH + 0.05, 0.025), mb('#7a4a26')), 0.006);
    marcoT.position.z = -0.016; tablon.add(marcoT);
    const caraT = lz(PXW, PXH);
    const caraMalla = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), mb('#ffffff', { map: caraT.t }));
    tablon.add(caraMalla);
    const aMetros = (px, py) => [(px / PXW - 0.5) * TW, (0.5 - py / PXH) * TH];
    const ITEMS = [
      { k: 'tiro', px: 212, py: 352, w: 262, h: 360, nombre: 'Tiro al pato', pista: ['Corchos, patos y', 'cuidado con', 'los pájaros'], icono: iconoTiro },
      { k: 'noria', px: 512, py: 352, w: 262, h: 360, nombre: 'La noria', pista: ['Que no se vuelque', 'nadie durante', '40 segundos'], icono: iconoNoria },
      { k: 'martillo', px: 812, py: 352, w: 262, h: 360, nombre: 'El martillo', pista: ['Tres golpes, la', 'campana arriba y', 'el ritmo manda'], icono: iconoMartillo },
      { k: 'salir', px: 512, py: 588, w: 330, h: 72, nombre: 'Salir de la feria' },
    ];
    for (const it of ITEMS) { const [x, y] = aMetros(it.px, it.py); Object.assign(it, { x, y, wm: it.w / PXW * TW, hm: it.h / PXH * TH }); }
    function pintarTablon() {
      const clave = [fichas.tiro, fichas.noria, fichas.martillo, est.hover, est.modo].join('|');
      if (clave === est.tablonClave) return;
      est.tablonClave = clave;
      const { g, t } = caraT;
      g.fillStyle = '#3b2a52'; g.fillRect(0, 0, PXW, PXH);
      for (let x = 0; x < PXW; x += 128) { g.fillStyle = 'rgba(20,12,28,.25)'; g.fillRect(x, 0, 5, PXH); }
      txt(g, 'LAS CASETAS', 290, 62, 62, '#ffd23f');
      const n = fichasN();
      txt(g, `Fichas ${n}/3`, 660, 62, 34, '#fff3c4');
      [0, 1, 2].forEach(i => moneda(g, 800 + i * 58, 62, 21, i < n));
      for (const it of ITEMS) {
        const x = it.px - it.w / 2, y = it.py - it.h / 2, sobre = est.hover === it.k;
        if (it.k === 'salir') {
          g.fillStyle = TINTA; g.beginPath(); g.roundRect(x + 4, y + 8, it.w, it.h, 20); g.fill();
          g.fillStyle = sobre ? '#8fd3ff' : '#5a8fd0'; g.beginPath(); g.roundRect(x, y, it.w, it.h, 20); g.fill();
          g.strokeStyle = TINTA; g.lineWidth = 6; g.stroke();
          txt(g, it.nombre, it.px, it.py + 2, 34, '#fff3c4');
          continue;
        }
        const tiene = fichas[it.k];
        g.fillStyle = TINTA; g.beginPath(); g.roundRect(x + 5, y + 10, it.w, it.h, 26); g.fill();
        g.fillStyle = tiene ? '#6b8f3a' : sobre ? '#c4813f' : '#9a6232'; g.beginPath(); g.roundRect(x, y, it.w, it.h, 26); g.fill();
        g.strokeStyle = sobre ? '#ffd23f' : TINTA; g.lineWidth = sobre ? 10 : 6; g.stroke();
        g.fillStyle = '#b0773c'; g.beginPath(); g.roundRect(x + 12, y + 12, it.w - 24, 150, 18); g.fill();
        it.icono(g, it.px, y + 92, 0.95);
        moneda(g, x + 38, y + 38, 18, tiene);
        txt(g, it.nombre, it.px, y + 196, 38, '#fff3c4');
        it.pista.forEach((l, i) => txt(g, l, it.px, y + 240 + i * 26, 22, 'rgba(255,243,196,.85)', { borde: false }));
        txt(g, tiene ? '¡Ficha ganada!' : 'Tócala', it.px, y + it.h - 30, 30, tiene ? '#7ee081' : '#ffd23f');
      }
      t.needsUpdate = true;
    }
    // tocar con el dedo (atravesar la cara) o pellizcar delante de ella
    const zAntes = new Map();
    const _p = V();
    function itemEn(m) {
      tablon.worldToLocal(_p.copy(m.punta));
      for (const it of ITEMS) if (Math.abs(_p.x - it.x) < it.wm / 2 + 0.01 && Math.abs(_p.y - it.y) < it.hm / 2 + 0.01) return { it, z: _p.z };
      return { it: null, z: _p.z };
    }
    function tocarTablon(dt) {
      est.tocarEspera -= dt;
      let hover = null;
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!m.activa) { zAntes.delete(m); continue; }
        const { it, z } = itemEn(m);
        const antes = zAntes.get(m) ?? 1;
        zAntes.set(m, z);
        if (it && z < 0.12 && z > -0.1) hover = it.k;
        if (!it || est.tocarEspera > 0) continue;
        const toque = (antes >= 0.012 && z < 0.012 && z > -0.08) || ((m.empiezaPinza || m.empiezaAgarre) && z < 0.1 && z > -0.08);
        if (toque) { m.vibrar(0.5, 40); est.tocarEspera = 0.6; elegir(it.k); return; }
      }
      if (hover !== est.hover) { est.hover = hover; if (hover) sonido('pop', { volumen: 0.12, tono: 1.6 }); }
      pintarTablon();
    }

    // ---------- HUD de las casetas (un cartel a tu derecha, mirándote; el feriante queda a la izquierda) ----------
    const hud = lz(640, 400);
    const hudMalla = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2125), mb('#ffffff', { map: hud.t, transparent: true }));
    hudMalla.position.set(0.52, H + 0.38, -0.55); hudMalla.rotation.order = 'YXZ'; hudMalla.rotation.y = Math.atan2(-0.52, 0.55); hudMalla.rotation.x = -0.1;
    hudMalla.visible = false; base.add(hudMalla);
    function fondoHud(g) {
      g.clearRect(0, 0, 640, 400);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(4, 4, 632, 392, 30); g.fill();
      g.fillStyle = '#3b2a52'; g.beginPath(); g.roundRect(14, 14, 612, 372, 22); g.fill();
    }

    // ======================================================================================
    // LA NORIA (juguete sobre la mesa) y su volante
    // ======================================================================================
    const NR = { z: -0.56, hub: 0.37, R: 0.2 };
    const noria = new THREE.Group(); noria.name = 'noria'; noria.visible = false; base.add(noria);
    const pivote = new THREE.Group(); pivote.position.set(0, H, NR.z); noria.add(pivote);
    {
      const plataforma = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.12), mb('#8a5a2b')), 0.004);
      plataforma.position.y = 0.0125; pivote.add(plataforma);
      const largo = Math.hypot(0.11, NR.hub);
      for (const s of [-1, 1]) for (const dz of [-0.035, 0.035]) {
        const pata = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.014, largo, 0.014), mb('#b7a9cc')), 0.003);
        pata.position.set(s * 0.055, NR.hub / 2, dz); pata.rotation.z = s * Math.atan2(0.11, NR.hub); pivote.add(pata);
      }
    }
    const rueda = new THREE.Group(); rueda.position.y = NR.hub; pivote.add(rueda);
    {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(NR.R, 0.007, 6, 48), mb('#fff3c4')); rueda.add(aro);
      const aroT = new THREE.Mesh(new THREE.TorusGeometry(NR.R, 0.012, 6, 48), mb(TINTA)); aroT.position.z = -0.002; rueda.add(aroT);
      const radios = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, NR.R, 0.006), mb('#b7a9cc'), 12);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        q.setFromAxisAngle(V(0, 0, 1), -a);
        radios.setMatrixAt(i, m4.compose(V(Math.sin(a) * NR.R / 2, Math.cos(a) * NR.R / 2, 0), q, V(1, 1, 1)));
      }
      rueda.add(radios);
      const eje = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), mb('#ffd23f')), 0.004);
      eje.rotation.x = Math.PI / 2; rueda.add(eje);
    }
    const bombRueda = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), mb('#ffffff'), 24);
    { const m4 = new THREE.Matrix4(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; bombRueda.setMatrixAt(i, m4.makeTranslation(Math.sin(a) * (NR.R + 0.004), Math.cos(a) * (NR.R + 0.004), 0.008)); bombRueda.setColorAt(i, COL_BOMB[i % 3]); } }
    rueda.add(bombRueda);
    const anilloFreno = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.006, 6, 24), mb('#e8364f')); anilloFreno.position.set(0, NR.hub, 0.03); anilloFreno.visible = false; pivote.add(anilloFreno);
    // cabinas: cubo (instanciado, con su tinta) y tejadillo
    const CAB = { w: 0.07, h: 0.036, d: 0.055, cuelga: 0.082 };  // hueco entre el tejadillo y el cubo: ahí asoman
    const COL_CAB = ['#ff5fa2', '#5adceb', '#ffd23f', '#7ee081', '#b98cf0', '#ff9a3b'].map(c => new THREE.Color(c));
    const cubos = new THREE.InstancedMesh(new THREE.BoxGeometry(CAB.w, CAB.h, CAB.d), mb('#ffffff'), 6);
    const cubosT = new THREE.InstancedMesh(new THREE.BoxGeometry(CAB.w + 0.008, CAB.h + 0.008, CAB.d + 0.008), MAT_TINTA, 6);
    const techos = new THREE.InstancedMesh(new THREE.ConeGeometry(0.048, 0.022, 4), mb('#ffffff'), 6);
    const varillas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, CAB.cuelga - CAB.h / 2, 0.004), MAT_TINTA, 12);
    for (let k = 0; k < 6; k++) { cubos.setColorAt(k, COL_CAB[k]); techos.setColorAt(k, COL_CAB[(k + 2) % 6]); }
    pivote.add(cubosT, cubos, techos, varillas);
    // pasajeros: dibujos planos sentados en su cubo
    const pasajeros = SUBEN.map(([id]) => {
      const def = PASAJEROS[id];
      const mat = mb('#ffffff', { map: TEX[def.tex], alphaTest: 0.5, side: THREE.DoubleSide });
      const malla = new THREE.Mesh(GEO_PLANO, mat); malla.visible = false; pivote.add(malla);
      return { id, def, mat, malla, texActual: def.tex };
    });
    // el volante: barra con dos asas sobre un poste, delante de la noria
    const VOL = { z: -0.27, y: 0.15, medio: 0.2 };
    const volante = new THREE.Group(); volante.position.set(0, H + VOL.y, VOL.z); noria.add(volante);
    {
      const poste = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, VOL.y, 10), mb('#4a4a58')), 0.003);
      poste.position.set(0, H + VOL.y / 2, VOL.z); noria.add(poste);
      const barra = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 2 * VOL.medio, 12), mb('#b7a9cc')), 0.003);
      barra.rotation.z = Math.PI / 2; volante.add(barra);
      const centro = tinta(new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), mb('#ffd23f')), 0.003); volante.add(centro);
    }
    const asasMalla = [-1, 1].map(s => {
      const a = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 12), mb('#e8364f')), 0.004);
      a.position.x = s * VOL.medio; a.rotation.z = Math.PI / 2; volante.add(a); return a;
    });
    const asaMundo = (s, out = V()) => aMundo(s * VOL.medio, H + VOL.y, VOL.z, out);

    function empezarNoria() {
      est.modo = 'noria'; est.gen++;
      tablon.visible = false; noria.visible = true; hudMalla.visible = true; est.hudClave = '';
      N = {
        t: 0, phi: 0, om: 0, u: 0, vidas: 3, inv: 0, freno: 100, frenando: false, frenoLock: false, ang: 0, pts: 0, vivo: true,
        empezada: false, espera: 0, bote: [0, 0, 0, 0, 0, 0], boteT: [9, 9, 9, 9, 9, 9], humoT: 0, ultimoBien: 0, calma: 0,
        asas: { '-1': null, '1': null }, sinAsa: 0, roll: 0,
        riders: pasajeros.map((p, i) => ({ ...p, cab: CABINAS_DE[i], cuando: SUBEN[i][1] / (nivel > 1 ? 1.1 : 1), sube: false, w: 0, jit: 0, infl: 0, finInfl: 0, flota: 0, dx: 0, jump: null, prox: 0, fase: Math.random() * 6, ria: 0 })),
      };
      for (const r of N.riders) { r.malla.visible = false; vestir(r, r.def.tex); }
      pintarNoria();
      sonido('sting', { volumen: 0.4 });
      dice('noriaIni', true, 2.6);
      ui.instruccion('Coge el volante con las dos manos');
    }
    function vestir(r, clave, mult = 1) {
      const tex = TEX[clave] || TEX[r.def.tex];
      if (!tex) return;
      r.texActual = clave; r.mat.map = tex; r.mat.needsUpdate = true;
      r.altoM = r.def.alto * mult; r.anchoM = r.altoM * tex.image.width / tex.image.height;
    }

    // las manos en las asas: cada una coge la suya (la libre más cercana) con pellizco o puño
    function manosEnAsas(dt) {
      const manos = [xr.manos.izquierda, xr.manos.derecha];
      for (const s of ['-1', '1']) {
        const a = N.asas[s];
        if (!a) continue;
        const m = a.mano;
        const pos = asaMundo(+s, _p);
        const lejos = !m.activa || m.pos.distanceTo(pos) > 0.32;
        const suelta = !m.pinza && !m.agarre;
        a.suelta = (suelta || lejos) ? a.suelta + dt : 0;
        if (a.suelta > 0.35) { N.asas[s] = null; m.vibrar(0.2, 20); }
      }
      for (const m of manos) {
        if (!m.activa || !(m.empiezaPinza || m.empiezaAgarre)) continue;
        if (Object.values(N.asas).some(a => a?.mano === m)) continue;
        let mejor = null, md = 0.15;
        for (const s of ['-1', '1']) {
          if (N.asas[s]) continue;
          const d = Math.min(m.pos.distanceTo(asaMundo(+s, _p)), m.punta.distanceTo(_p));
          if (d < md) { md = d; mejor = s; }
        }
        if (mejor) {
          N.asas[mejor] = { mano: m, por: m.empiezaPinza ? 'pinza' : 'agarre', suelta: 0 };
          m.vibrar(0.45, 35); sonido('pop', { volumen: 0.25, tono: 1.3 });
          if (!N.empezada) { N.empezada = true; ui.instruccion(null); }
        }
      }
      // mando: diferencia de altura entre las manos (sube la del lado que cae); freno: juntarlas o apretar
      const altura = s => { const a = N.asas[s]; return a ? a.mano.pos.y - (H + VOL.y) : 0; };
      const dif_ = altura('-1') - altura('1');
      let objetivo = Math.abs(dif_) < 0.012 ? 0 : clamp(dif_ / 0.14, -1, 1);
      const izq = N.asas['-1']?.mano, der = N.asas['1']?.mano;
      let pidoFreno = !!(izq && der && izq.pos.distanceTo(der.pos) < 0.24);
      for (const a of Object.values(N.asas)) if (a && a.por === 'pinza' && a.mano.agarre) pidoFreno = true;
      if (!izq && !der) objetivo = 0;
      return { objetivo, pidoFreno };
    }

    function logicaPasajero(r, dt) {
      const t = N.t, D = dif;
      if (!r.sube) {
        if (t >= r.cuando) {
          r.sube = true; r.malla.visible = true; r.aparece = 0;
          r.prox = t + 3 + Math.random() * 3;
          sonido('pop', { en: pivote, volumen: 0.3 });
        } else { r.w = 0; return; }
      }
      r.aparece = Math.min(1, (r.aparece ?? 1) + dt / 0.26);
      if (r.id === 'palicaso') {
        // no para quieto: va de un lado al otro de la cabina
        r.w = 1.0;
        r.jit = Math.sin(t * 3.4 + r.fase) * 0.75;
        r.dx = r.jit * 0.016;
        if (Math.random() < dt * 0.08) dice('palicaso');
      } else if (r.id === 'lasslow') {
        r.w = 1.0;
        if (r.ria <= 0) r.dx = 0;
        if (r.ria > 0) {
          r.ria -= dt;
          r.dx = Math.sin(t * 55) * 0.0025;
          if (r.ria <= 0) {
            // la risa se le sale: la cabina bota y empuja hacia su lado
            const a = N.ang + r.cab * Math.PI / 3;
            const s = Math.abs(Math.sin(a)) > 0.25 ? Math.sign(Math.sin(a)) : (Math.random() < 0.5 ? 1 : -1);
            N.om += s * rnd(30, 44) * D;
            N.bote[r.cab] = 0.28; N.boteT[r.cab] = 0;
            sonido('boing', { en: pivote, volumen: 0.45 });
            for (const a2 of Object.values(N.asas)) a2?.mano.vibrar(0.4, 60);
            vestir(r, r.def.tex);
          }
        } else if (t >= r.prox) {
          r.ria = 0.75;
          r.prox = t + rnd(5, 8) / D;
          vestir(r, 'lasslow-risa-floja');
          dice('lasslow');
        }
      } else if (r.id === 'cotine') {
        // se come el algodón: se hincha y pesa
        if (r.infl > 0 && t >= r.finInfl) r.infl = Math.max(0, r.infl - dt * 1.4);
        if (r.infl === 0 && t >= r.prox) { r.infl = 0.01; r.finInfl = t + 3.4; r.prox = t + rnd(9, 12); dice('cotine'); sonido('fup', { en: pivote, volumen: 0.4 }); }
        if (r.infl > 0 && t < r.finInfl) r.infl = Math.min(1, r.infl + dt * 2.2);
        r.w = 1.05 + r.infl * 0.85;
      } else if (r.id === 'pompa') {
        // se hincha y sube: pesa menos que nada y empuja hacia arriba
        if (r.infl > 0 && t >= r.finInfl) r.infl = Math.max(0, r.infl - dt * 1.2);
        if (r.infl === 0 && t >= r.prox) { r.infl = 0.01; r.finInfl = t + 3.3; r.prox = t + rnd(7, 10); dice('pompa'); sonido('plop', { en: pivote, volumen: 0.4 }); }
        if (r.infl > 0 && t < r.finInfl) r.infl = Math.min(1, r.infl + dt * 2);
        r.w = -0.45 - r.infl * 0.75;
        r.flota = r.infl * 0.02;
        const nueva = r.infl > 0.5 && TEX['pompa-hinchada'] ? 'pompa-hinchada' : r.def.tex;
        if (r.texActual !== nueva) vestir(r, nueva, nueva === 'pompa' ? 1 : 1.15);
      } else if (r.id === 'perico') {
        r.w = 0.45;
        if (r.jump) {
          r.jump.t += dt / 0.75;
          if (r.jump.t >= 1) { r.cab = r.jump.a; r.jump = null; vestir(r, 'perico'); sonido('pin-pin', { en: pivote, volumen: 0.3 }); }
        } else if (t >= r.prox) {
          const ocupadas = N.riders.filter(o => o !== r && o.sube).map(o => o.cab);
          const libres = [0, 1, 2, 3, 4, 5].filter(k => k !== r.cab && !ocupadas.includes(k));
          if (libres.length) {
            r.jump = { t: 0, de: r.cab, a: libres[Math.floor(Math.random() * libres.length)] };
            vestir(r, 'perico-volando', 1.25);
            sonido('pin-pin', { en: pivote, volumen: 0.4 });
            dice('perico');
          }
          r.prox = t + rnd(5, 7.5) / D;
        }
      }
    }

    function actualizarNoria(dt) {
      if (!N || !N.vivo) { if (N) pintarNoria(); return; }
      const { objetivo, pidoFreno } = manosEnAsas(dt);
      // sin manos no empieza (unos segundos de gracia); luego arranca igual, como el 2D
      if (!N.empezada) {
        N.espera += dt;
        if (N.espera > 6) { N.empezada = true; ui.instruccion(null); }
        pintarNoria(); pintarHudNoria(); return;
      }
      const D = dif;
      N.t += dt;
      N.inv = Math.max(0, N.inv - dt);
      N.ang += dt * 0.36 * (1 + 0.05 * (nivel - 1));
      let tau = 0;
      for (const r of N.riders) {
        logicaPasajero(r, dt);
        if (!r.sube) continue;
        const cab = r.jump ? (r.jump.t < 0.5 ? r.jump.de : r.jump.a) : r.cab;
        tau += r.w * (Math.sin(N.ang + cab * Math.PI / 3) + r.jit);
      }
      N.u += (objetivo - N.u) * Math.min(1, dt * 12);
      if (N.frenoLock && N.freno > 25) N.frenoLock = false;
      N.frenando = pidoFreno && !N.frenoLock && N.freno > 0;
      if (N.frenando) { N.freno = Math.max(0, N.freno - dt * 60); if (N.freno <= 0) N.frenoLock = true; }
      else N.freno = Math.min(100, N.freno + dt * 28);
      const amort = 1.3 + (N.frenando ? 11 : 0);
      const alfa = 24 * D * tau + 1.7 * N.phi + 130 * N.u - amort * N.om;
      N.om = clamp(N.om + alfa * dt, -140, 140);
      N.phi += N.om * dt;
      // vuelco: se pierde una vida, la noria se recoloca y se da un respiro
      if (Math.abs(N.phi) >= CA.limite && N.inv <= 0) vuelco(Math.sign(N.phi));
      if (!N.vivo) return;
      // puntos: segundos aguantados, y más cuanto más centrada
      const centro = 1 - Math.min(1, Math.abs(N.phi) / CA.limite);
      N.pts += dt * (10 + 10 * centro);
      N.calma = centro > 0.7 ? N.calma + dt : 0;
      if (N.calma > 7 && N.t - N.ultimoBien > 9) { N.ultimoBien = N.t; N.calma = 0; dice('bien'); }
      // aviso en las manos cuando se va
      if (Math.abs(N.phi) / CA.limite > 0.75 && Math.random() < dt * 6) for (const a of Object.values(N.asas)) a?.mano.vibrar(0.15, 15);
      // humo bajo la noria
      N.humoT -= dt;
      if (N.humoT <= 0) { N.humoT = 0.6; bocanadas(V(rnd(-0.12, 0.12), H + 0.02, NR.z), 1, 0.45, 0.08); }
      pintarNoria(dt);
      pintarHudNoria();
      if (N.t >= CA.duracion) noriaGanada();
    }

    function vuelco(lado) {
      N.vidas--;
      N.inv = 1.4;
      N.phi = lado * CA.limite * 0.5;
      N.om = -lado * 25;
      sonido('golpe', { en: pivote, volumen: 0.6 });
      for (const a of Object.values(N.asas)) a?.mano.vibrar(1, 160);
      const pesados = N.riders.filter(r => r.sube).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
      if (pesados[0]) { N.bote[pesados[0].cab] = 0.4; N.boteT[pesados[0].cab] = 0; }
      bocanadas(V(lado * 0.2, H + 0.25, NR.z), 6, 0.5, 0.3);
      ui.cartela('¡Se vuelca!', 1.2);
      dice('susto', true);
      if (N.vidas <= 0) noriaPerdida();
    }

    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1), _v = V(), _v2 = V();
    const cabPos = [];
    function pintarNoria(dt = 0) {
      const ph = THREE.MathUtils.degToRad(N.phi);
      pivote.rotation.z = -ph;
      rueda.rotation.z = -N.ang;
      for (let k = 0; k < 6; k++) {
        const a = N.ang + k * Math.PI / 3;
        const ocupante = N.riders.find(r => r.sube && !r.jump && r.cab === k);
        const sag = ocupante ? Math.max(0, ocupante.w) * 0.004 : 0;
        N.boteT[k] += dt;
        const swing = N.bote[k] * Math.sin(N.boteT[k] * 16) * Math.exp(-N.boteT[k] * 3.2);
        const rot = ph * 0.85 + swing;
        const ax = Math.sin(a) * NR.R, ay = NR.hub + Math.cos(a) * NR.R;
        // la cabina cuelga de su punto del aro
        const cx = ax + Math.sin(rot) * (CAB.cuelga + sag), cy = ay - Math.cos(rot) * (CAB.cuelga + sag);
        cabPos[k] = { cx, cy, rot };
        _q.setFromEuler(_e.set(0, 0, rot));
        cubos.setMatrixAt(k, _m4.compose(_v.set(cx, cy, 0), _q, _s));
        cubosT.setMatrixAt(k, _m4);
        techos.setMatrixAt(k, _m4.compose(_v.set(ax, ay - 0.004, 0), _q, _s));
        // dos varillas del tejadillo al cubo, por los lados
        const mid = (CAB.cuelga + sag - CAB.h / 2) / 2;
        for (const [j, lx] of [[0, -CAB.w / 2 + 0.004], [1, CAB.w / 2 - 0.004]]) {
          varillas.setMatrixAt(k * 2 + j, _m4.compose(_v.set(ax + lx * Math.cos(rot) + Math.sin(rot) * mid, ay + lx * Math.sin(rot) - Math.cos(rot) * mid, 0), _q, _s));
        }
      }
      cubos.instanceMatrix.needsUpdate = true; cubosT.instanceMatrix.needsUpdate = true; techos.instanceMatrix.needsUpdate = true; varillas.instanceMatrix.needsUpdate = true;
      for (const r of N.riders) {
        if (!r.sube) continue;
        let x, y, rot;
        if (r.jump) {
          const A = cabPos[r.jump.de], B = cabPos[r.jump.a], u = r.jump.t;
          x = A.cx + (B.cx - A.cx) * u; y = A.cy + (B.cy - A.cy) * u + Math.sin(u * Math.PI) * 0.06 - CAB.h / 2 + r.altoM / 2; rot = 0;
        } else {
          const C = cabPos[r.cab];
          const lx = r.dx, ly = -CAB.h / 2 + r.altoM / 2 + r.flota;
          x = C.cx + lx * Math.cos(C.rot) - ly * Math.sin(C.rot); y = C.cy + lx * Math.sin(C.rot) + ly * Math.cos(C.rot); rot = C.rot * 0.7;
        }
        const ap = r.aparece ?? 1;
        const inflX = r.id === 'cotine' ? 1 + 0.26 * r.infl : 1, inflY = r.id === 'cotine' ? 1 + 0.2 * r.infl : 1;
        r.malla.position.set(x, y, 0.004); r.malla.rotation.z = rot;
        r.malla.scale.set(r.anchoM * inflX * ap, r.altoM * inflY * ap, 1);
      }
      // bombillas de la rueda: parpadean y se ponen rojas si se va
      const f = Math.abs(N.phi) / CA.limite;
      for (let i = 0; i < 24; i++) bombRueda.setColorAt(i, f > 0.75 && i % 2 ? _col.set('#e8364f') : _col.copy(COL_BOMB[i % 3]).multiplyScalar((i + Math.floor(est.t / 0.36)) % 2 ? 1 : 0.4));
      bombRueda.instanceColor.needsUpdate = true;
      anilloFreno.visible = !!N.frenando;
      anilloFreno.material.color.set(N.frenoLock ? '#7a3b3b' : '#e8364f');
      // el volante enseña tu mano: se inclina con la diferencia de altura
      const alt = s => { const a = N.asas[s]; return a ? a.mano.pos.y - (H + VOL.y) : 0; };
      const roll = Math.atan2(alt('1') - alt('-1'), 2 * VOL.medio);
      N.roll += (clamp(roll, -0.6, 0.6) - N.roll) * Math.min(1, dt * 15 || 1);
      volante.rotation.z = N.roll;
      asasMalla.forEach((a, i) => a.material.color.set(N.asas[i ? '1' : '-1'] ? '#ffd23f' : '#e8364f'));
    }

    function pintarHudNoria() {
      const f = clamp(N.phi / CA.limite, -1, 1);
      const resta = Math.max(0, Math.ceil(CA.duracion - N.t));
      const alerta = Math.abs(f) > 0.4;
      const clave = ['n', resta, Math.round(N.pts), N.vidas, Math.round(f * 40), Math.round(N.freno / 5), N.frenoLock, alerta && Math.floor(est.t * 4) % 2, N.empezada, Math.floor(N.t / 7)].join('|');
      if (clave === est.hudClave) return;
      est.hudClave = clave;
      const { g, t } = hud;
      fondoHud(g);
      txt(g, 'LA NORIA', 320, 48, 38, '#ffd6ea');
      txt(g, String(resta), 110, 130, 76, resta <= 5 ? '#ff5fa2' : '#ffd23f');
      txt(g, 'TIEMPO', 110, 184, 22, '#5adceb', { borde: false });
      txt(g, String(Math.round(N.pts)), 320, 130, 60, '#fff3c4');
      txt(g, 'PUNTOS', 320, 184, 22, '#5adceb', { borde: false });
      for (let i = 0; i < 3; i++) { g.fillStyle = TINTA; g.beginPath(); g.arc(480 + i * 48, 128, 20, 0, 7); g.fill(); g.fillStyle = i < N.vidas ? '#ff5fa2' : '#4a3d5c'; g.beginPath(); g.arc(480 + i * 48, 128, 15, 0, 7); g.fill(); }
      txt(g, 'VIDAS', 528, 184, 22, '#5adceb', { borde: false });
      // equilibrio
      const bx = 320, bw = 520, by = 240;
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(bx - bw / 2 - 6, by - 6, bw + 12, 40, 14); g.fill();
      g.fillStyle = '#4a3d5c'; g.fillRect(bx - bw / 2, by, bw, 28);
      g.fillStyle = '#ffd23f'; g.fillRect(bx - bw * 0.36, by, bw * 0.72, 28);
      g.fillStyle = '#7ee081'; g.fillRect(bx - bw * 0.14, by, bw * 0.28, 28);
      g.fillStyle = Math.abs(f) > 0.75 ? '#e8364f' : Math.abs(f) > 0.45 ? '#ffd23f' : '#fff3c4';
      g.strokeStyle = TINTA; g.lineWidth = 5; g.beginPath(); g.roundRect(bx + f * bw / 2 - 9, by - 10, 18, 48, 5); g.fill(); g.stroke();
      if (!N.empezada) txt(g, 'Coge el volante', 320, 312, 36, '#ffd23f');
      else if (alerta) { if (Math.floor(est.t * 4) % 2 === 0) txt(g, f > 0 ? 'Sube la derecha ↑' : '↑ Sube la izquierda', 320, 312, 38, '#ffd23f'); }
      else if (N.t < 7) txt(g, 'Sube la mano del lado que cae', 320, 312, 30, 'rgba(255,243,196,.85)', { borde: false });
      else if (N.t < 14) txt(g, 'Junta las manos o aprieta: frena', 320, 312, 30, 'rgba(255,243,196,.85)', { borde: false });
      // freno
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(150, 350, 340, 22, 8); g.fill();
      g.fillStyle = N.frenoLock ? '#7a3b3b' : '#e8364f'; g.fillRect(154, 354, 332 * N.freno / 100, 14);
      txt(g, 'FRENO', 90, 361, 22, '#ff9a9a', { borde: false });
      t.needsUpdate = true;
    }

    function noriaPerdida() {
      N.vivo = false;
      sonido('oooh', { volumen: 0.5 });
      cambiarFeriante(false);
      ui.cartela('Noria parada', 2);
      dice('noriaKo', true, 2.6);
      espera(3, () => irTablon());
    }
    function noriaGanada() {
      N.vivo = false;
      ganarFicha('noria', Math.round(N.pts) + N.vidas * 40, 'noriaOk');
    }

    // ======================================================================================
    // EL MARTILLO
    // ======================================================================================
    const MZ = { padZ: -0.47, padR: 0.085, padH: 0.035, torreZ: -1.25, torreAlto: 1.0, medX: -0.24, medZ: -0.5, medY0: 0.07, medAlto: 0.4 };
    const padTop = H + MZ.padH;
    const martillo = new THREE.Group(); martillo.name = 'martillo'; martillo.visible = false; base.add(martillo);
    const pad = tinta(new THREE.Mesh(new THREE.CylinderGeometry(MZ.padR, MZ.padR * 1.1, MZ.padH, 24), mb('#e8364f')), 0.005);
    pad.position.set(0, H + MZ.padH / 2, MZ.padZ); martillo.add(pad);
    const padDiana = new THREE.Mesh(new THREE.CircleGeometry(MZ.padR * 0.55, 20), mb('#ffd23f'));
    padDiana.rotation.x = -Math.PI / 2; padDiana.position.set(0, padTop + 0.001, MZ.padZ); martillo.add(padDiana);
    // la torre con la pieza y la campana, detrás
    const torreT = lz(128, 1024);
    {
      const { g, t } = torreT;
      g.fillStyle = '#e9dcc3'; g.fillRect(0, 0, 128, 1024);
      g.fillStyle = 'rgba(107,143,58,.55)'; g.fillRect(0, 0, 128, 1024 * 0.2);
      for (let i = 0; i <= 10; i++) { const y = 1024 - i * 1024 / 10; g.fillStyle = TINTA; g.fillRect(0, y - (i % 5 === 0 ? 4 : 2), i % 5 === 0 ? 90 : 50, i % 5 === 0 ? 8 : 4); }
      g.save(); g.translate(96, 620); g.rotate(-Math.PI / 2); txt(g, 'FUERZA', 0, 0, 44, '#e8364f'); g.restore();
      t.needsUpdate = true;
    }
    const torre = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.16, MZ.torreAlto, 0.04), mb('#ffffff', { map: torreT.t })), 0.008);
    torre.position.set(0, H + MZ.torreAlto / 2, MZ.torreZ); martillo.add(torre);
    const pieAlto = 0.06;
    const torreY = p => H + pieAlto + (MZ.torreAlto - 2 * pieAlto) * p; // 0 = abajo, 1 = campana
    const pieza = tinta(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), mb('#e8364f')), 0.005);
    pieza.position.set(0, torreY(0), MZ.torreZ + 0.045); martillo.add(pieza);
    const campana = new THREE.Group(); campana.position.set(0, H + MZ.torreAlto + 0.02, MZ.torreZ + 0.02); martillo.add(campana);
    {
      const cuerpo = tinta(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.13, 20, 1, true), mb('#ffd23f', { side: THREE.DoubleSide })), 0.008);
      cuerpo.position.y = 0.12; campana.add(cuerpo);
      const badajo = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mb(TINTA)); badajo.position.y = 0.05; campana.add(badajo);
    }
    // el medidor junto a la base: barra que sube y baja con la zona verde arriba
    const medT = lz(64, 512);
    const medidor = new THREE.Group(); medidor.position.set(MZ.medX, H + MZ.medY0, MZ.medZ); medidor.rotation.x = -0.25; medidor.rotation.y = 0.25; martillo.add(medidor);
    const medCara = new THREE.Mesh(new THREE.PlaneGeometry(0.07, MZ.medAlto), mb('#ffffff', { map: medT.t }));
    medCara.position.y = MZ.medAlto / 2; medidor.add(medCara);
    const medFondo = new THREE.Mesh(new THREE.BoxGeometry(0.085, MZ.medAlto + 0.02, 0.012), mb(TINTA)); medFondo.position.set(0, MZ.medAlto / 2, -0.008); medidor.add(medFondo);
    const marca = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.012), mb('#fff3c4')), 0.004);
    marca.position.z = 0.008; medidor.add(marca);
    const lonaT = lz(128, 256);
    {
      const { g, t } = lonaT;
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff3c4' : '#3d7cc4'; g.fillRect(i * 16, 0, 16, 256); }
      g.strokeStyle = TINTA; g.lineWidth = 10; g.strokeRect(0, 0, 128, 256);
      txt(g, '?', 64, 128, 110, '#ffd23f');
      t.needsUpdate = true;
    }
    const lona = new THREE.Mesh(new THREE.PlaneGeometry(0.1, MZ.medAlto * 0.42), mb('#ffffff', { map: lonaT.t }));
    lona.position.set(0, MZ.medAlto * 0.51, 0.016); lona.visible = false; medidor.add(lona);
    function pintarMedidor(lo) {
      const { g, t } = medT;
      g.fillStyle = '#2d2146'; g.fillRect(0, 0, 64, 512);
      g.fillStyle = '#7ee081'; g.fillRect(0, 0, 64, 512 * (1 - lo));
      for (let i = 0; i <= 10; i++) { g.fillStyle = 'rgba(255,243,196,.5)'; g.fillRect(0, 512 - i * 51.2 - 2, i % 5 ? 20 : 40, 4); }
      t.needsUpdate = true;
    }
    // el mazo: mango hacia ti y cabeza al fondo, tumbado en la mesa
    const CABEZA = V(0, 0, -0.4), MEDIA_CABEZA = 0.07;
    const mazo = new THREE.Group(); mazo.name = 'mazo';
    {
      const mango = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.46, 10), mb('#d9a85e')), 0.004);
      mango.rotation.x = Math.PI / 2; mango.position.z = -0.17; mazo.add(mango);
      const punio = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 10), mb('#6a4222')), 0.004);
      punio.rotation.x = Math.PI / 2; punio.position.z = 0.01; mazo.add(punio);
      const cabeza = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2 * MEDIA_CABEZA, 16), mb('#e8364f')), 0.006);
      cabeza.position.copy(CABEZA); mazo.add(cabeza);
      const aros = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 16), mb('#fff3c4')); aros.position.copy(CABEZA); mazo.add(aros);
    }
    mazo.visible = false; grupo.add(mazo);
    const REPOSO = V(0.3, H + MEDIA_CABEZA, -0.24);
    const reposoMundo = aMundo(REPOSO.x, REPOSO.y, REPOSO.z);
    const reposoQ = qBase.clone();
    mazo.position.copy(reposoMundo); mazo.quaternion.copy(reposoQ);
    let cuerpoMazo = null;
    const cara = { prev: V(), vel: V(), tiene: false, armado: true, tocaba: false };
    function caraMazo(out) {
      // la cara de la cabeza que está más abajo
      const a = mazo.localToWorld(_v.set(CABEZA.x, MEDIA_CABEZA, CABEZA.z));
      const b = mazo.localToWorld(_v2.set(CABEZA.x, -MEDIA_CABEZA, CABEZA.z));
      return out.copy(a.y < b.y ? a : b);
    }

    function empezarMartillo() {
      est.modo = 'martillo'; est.gen++;
      tablon.visible = false; martillo.visible = true; hudMalla.visible = true; est.hudClave = '';
      // tres reglas distintas, sin repetir hasta agotar la bolsa (entre partidas también)
      const reglas = [];
      while (reglas.length < 3) {
        if (!BOLSA_REGLAS.length) BOLSA_REGLAS = ['vaiven', 'rapido', 'finta', 'ciegas'].sort(() => Math.random() - 0.5);
        const r = BOLSA_REGLAS.pop();
        if (!reglas.includes(r)) reglas.push(r);
      }
      const lo = Math.min(0.88, 0.8 + 0.02 * (nivel - 1));
      M = { reglas, i: -1, pts: 0, campanas: 0, estado: 'inicio', t: 0, pos: 0, lo, tope: 10, cola: [], leg: null, regla: null, ultimaFuerza: null, ultimoPts: null, pieza: { p: 0, anim: null }, campanaT: 9 };
      pintarMedidor(lo);
      marca.position.y = 0; lona.visible = false;
      mazo.visible = true; mazo.position.copy(reposoMundo); mazo.quaternion.copy(reposoQ);
      cuerpoMazo = fisica.anadir(mazo, { radio: 0.045, gravedad: 0, rebote: 0.1, cogible: true, datos: { mazo: true } });
      cuerpoMazo.dormido = true;
      cara.tiene = false; cara.armado = true; cara.tocaba = false;
      pieza.position.y = torreY(0);
      dice('marIni', true, 2.4);
      ui.instruccion('Coge el mazo y golpea cuando la barra esté en lo verde');
      espera(2.3, nuevoGolpe);
    }
    function quitarMazo() {
      if (!cuerpoMazo) return;
      if (cuerpoMazo.cogido) agarre.soltar(cuerpoMazo.cogido, false);
      fisica.quitar(cuerpoMazo); cuerpoMazo = null; mazo.visible = false;
    }

    function nuevoGolpe() {
      M.i++;
      if (M.i >= 3) { martilloFin(); return; }
      const r = M.reglas[M.i];
      M.regla = r; M.estado = 'corre'; M.t = 0; M.cola = []; M.leg = null; M.pos = 0;
      marca.visible = true;
      lona.visible = r === 'ciegas'; lona.scale.y = r === 'ciegas' ? 0.01 : 1;
      dice(r, true, 2.2);
      sonido('campanita', { volumen: 0.25 });
    }

    function actualizarMartillo(dt) {
      // el mazo: en la mano lo lleva ctx.agarre; suelto, vuelve solo a la mesa
      if (cuerpoMazo) {
        if (!cuerpoMazo.cogido) {
          cuerpoMazo.vel.set(0, 0, 0); cuerpoMazo.giro.set(0, 0, 0); cuerpoMazo.dormido = true;
          mazo.position.lerp(reposoMundo, 1 - Math.exp(-dt * 8));
          mazo.quaternion.slerp(reposoQ, 1 - Math.exp(-dt * 8));
        } else if (!M.cogidoVez) { M.cogidoVez = true; ui.instruccion(null); sonido('golpe', { volumen: 0.2, tono: 1.6 }); }
        mazo.updateMatrixWorld(true);
        // velocidad de la cara del mazo (suavizada)
        const c = caraMazo(V());
        if (cara.tiene && dt > 0) cara.vel.lerp(_v.copy(c).sub(cara.prev).divideScalar(dt), 0.6);
        cara.prev.copy(c); cara.tiene = true;
        const l = aLocal(c);
        const dentro = Math.hypot(l.x, l.z - MZ.padZ) < MZ.padR + 0.06;
        if (l.y > padTop + 0.1) cara.armado = true;
        const toca = dentro && l.y < padTop + 0.015 && cuerpoMazo.cogido;
        if (toca && !cara.tocaba) {
          const m = cuerpoMazo.cogido;
          const vBaja = Math.max(-cara.vel.y, -(m.vel?.y ?? 0));
          if (M.estado === 'corre' && cara.armado && vBaja > 0.35) { cara.armado = false; golpear(false, vBaja, m); }
          else if (vBaja > 0.3) { sonido('bonk', { volumen: 0.25 }); m.vibrar(0.3, 30); }
        }
        cara.tocaba = toca;
      }
      // la pieza que sube por la torre
      const P = M.pieza;
      if (P.anim) {
        // sube (frenando), se queda arriba un momento si ha sonado la campana y baja
        const A = P.anim; A.t += dt;
        const quieta = A.campana ? 0.6 : 0, baja = 0.5;
        if (A.t < A.sube) P.p = A.to * (1 - (1 - A.t / A.sube) ** 2);
        else if (A.t < A.sube + quieta) { P.p = A.to; if (A.campana && !A.sono) { A.sono = true; suenaCampana(); } }
        else { const k = Math.min(1, (A.t - A.sube - quieta) / baja); P.p = A.to * (1 - k * k); if (k >= 1) { P.p = 0; P.anim = null; } }
      }
      pieza.position.y = torreY(P.p);
      M.campanaT += dt;
      campana.rotation.z = M.campanaT < 1.2 ? Math.sin(M.campanaT * 22) * 0.3 * Math.exp(-M.campanaT * 3.5) : 0;
      // la barra
      if (M.estado === 'corre') {
        M.t += dt;
        if (lona.visible && lona.scale.y < 1) lona.scale.y = Math.min(1, lona.scale.y + dt / 0.26);
        if (M.t > M.tope) golpear(true);
        else {
          // cada tramo parte de donde está la barra: el movimiento nunca da saltos
          if (!M.leg || M.leg.t >= M.leg.dur) {
            if (!M.cola.length) M.cola = REGLAS_MARTILLO[M.regla].tramos();
            const [to, dur] = M.cola.shift();
            M.leg = { from: M.pos, to, dur, t: 0 };
            if (to > M.pos + 0.3) sonido('pop', { volumen: 0.12 }); // un tictac al empezar cada subida: el ritmo se oye
          }
          const L = M.leg;
          L.t += dt * dif;
          const u = Math.min(1, L.t / L.dur);
          const e = M.regla === 'finta' && L.to === 1 ? u : 0.5 - 0.5 * Math.cos(Math.PI * u);
          M.pos = L.from + (L.to - L.from) * e;
        }
      }
      marca.position.y = M.pos * MZ.medAlto;
      // la diana de la base se enciende en lo verde (no a ciegas)
      padDiana.material.color.set(M.estado === 'corre' && M.regla !== 'ciegas' && M.pos >= M.lo ? '#7ee081' : '#ffd23f');
      pintarHudMartillo();
    }

    function golpear(tarde, vBaja = 0, mano = null) {
      if (est.modo !== 'martillo' || !M || M.estado !== 'corre') return;
      M.estado = 'golpe';
      // fuerza: la velocidad del golpe (llena a ~1,8 m/s); altura = momento de la barra × fuerza
      const fuerza = tarde ? 0 : clamp((vBaja - 0.3) / 1.5, 0, 1);
      const pos = tarde ? 0 : M.pos * (0.4 + 0.6 * fuerza);
      const bell = !tarde && pos >= M.lo;
      const pts = tarde ? 0 : Math.round(300 * Math.pow(Math.max(0, (pos - 0.2) / 0.8), 2)) + (bell ? 100 : 0);
      M.pts += pts; M.ultimaFuerza = tarde ? null : fuerza; M.ultimoPts = pts;
      if (bell) M.campanas++;
      if (!tarde) {
        sonido('golpe', { volumen: 0.8 });
        mano?.vibrar(1, 140);
        bocanadas(V(0, padTop + 0.02, MZ.padZ), 4 + Math.round(fuerza * 6), 0.5, 0.25 + fuerza * 0.5);
        M.pieza.anim = { t: 0, sube: 0.15 + pos * 0.45, to: bell ? 1 : Math.max(0.03, pos), campana: bell };
      }
      lona.visible = false;
      const tipo = tarde ? 'tarde' : bell ? 'campana' : 'flojo';
      programar(bell ? 0.7 : 0.35, () => { if (M && est.modo === 'martillo') dice(tipo, true, 1.8); });
      if (tarde) ui.cartela('¡Tarde!', 1.2);
      espera(1.9, nuevoGolpe);
      if (window.__mj) window.__mj.casGolpes = (window.__mj.casGolpes || []).concat([{ pos: +pos.toFixed(2), barra: +M.pos.toFixed(2), fuerza: +fuerza.toFixed(2), bell }]);
    }
    function suenaCampana() {
      sonido('campanita', { volumen: 0.7 });
      sonido('platillo', { volumen: 0.3 });
      M.campanaT = 0;
      bocanadas(V(0, H + MZ.torreAlto + 0.1, MZ.torreZ), 8, 0.95, 0.6);
      cuerpoMazo?.cogido?.vibrar(0.8, 200);
      cambiarFeriante(true);
    }
    function pintarHudMartillo() {
      const def = M.regla ? REGLAS_MARTILLO[M.regla] : null;
      const clave = ['m', M.i, M.estado, M.pts, M.campanas, M.ultimaFuerza?.toFixed(1)].join('|');
      if (clave === est.hudClave) return;
      est.hudClave = clave;
      const { g, t } = hud;
      fondoHud(g);
      txt(g, 'EL MARTILLO', 320, 48, 38, '#ffd6ea');
      if (def && M.i < 3) txt(g, `Golpe ${M.i + 1}/3 · ${def.nombre}`, 320, 112, 42, def.color);
      else txt(g, 'Tres golpes', 320, 112, 42, '#fff3c4');
      txt(g, String(M.pts), 130, 200, 64, '#ffd23f');
      txt(g, 'PUNTOS', 130, 250, 22, '#5adceb', { borde: false });
      [0, 1, 2].forEach(i => moneda(g, 380 + i * 64, 200, 24, i < M.campanas));
      txt(g, '2 campanazos = ficha', 444, 250, 24, '#fff3c4', { borde: false });
      if (M.ultimaFuerza !== null) {
        txt(g, 'FUERZA', 90, 330, 24, '#ff9a9a', { borde: false });
        g.fillStyle = TINTA; g.beginPath(); g.roundRect(160, 314, 400, 32, 10); g.fill();
        g.fillStyle = M.ultimaFuerza > 0.75 ? '#7ee081' : M.ultimaFuerza > 0.4 ? '#ffd23f' : '#e8364f';
        g.fillRect(166, 320, 388 * M.ultimaFuerza, 20);
      } else txt(g, 'Golpe seco hacia abajo', 320, 330, 30, 'rgba(255,243,196,.8)', { borde: false });
      t.needsUpdate = true;
    }
    function martilloFin() {
      M.estado = 'fin';
      marca.visible = false; lona.visible = false;
      if (M.campanas >= CA.umbralMartillo) { espera(0.6, () => { quitarMazo(); ganarFicha('martillo', M.pts, 'marOk'); }); }
      else {
        sonido('oooh', { volumen: 0.5 });
        ui.cartela(`${M.campanas} campanazo${M.campanas === 1 ? '' : 's'}`, 2);
        dice('marKo', true, 2.6);
        espera(3, () => irTablon());
      }
    }

    // ======================================================================================
    // EL TIRO: el tiro al pato nativo, montado aquí dentro
    // ======================================================================================
    async function empezarTiro() {
      est.modo = 'tiro'; est.gen++;
      const id = est.gen;
      escenario.visible = false; tablon.visible = false; bocFer.ocultar();
      ui.instruccion(null);
      const ctxTiro = Object.create(ctx);
      ctxTiro.terminar = r => { if (tiro && tiro.id === id) finTiro(r); };
      tiro = { id, inst: null, fin: null };
      let inst;
      try { inst = await TiroPato.crear(ctxTiro); }
      catch (e) { console.error('casetas: no arranca el tiro', e); tiro = null; escenario.visible = true; irTablon(); return; }
      if (est.destruido || !tiro || tiro.id !== id) { inst.destruir?.(); return; }
      tiro.inst = inst; grupo.add(inst.grupo);
    }
    function finTiro(r) {
      if (tiro.fin) return;
      tiro.fin = r;
      fichas.pTiro = Math.max(fichas.pTiro, r.puntos || 0);
      const gana = (r.puntos || 0) >= CA.umbralTiro;
      ui.cartela(gana ? `Tiro al pato: ${r.puntos} puntos. ¡Ficha!` : `Tiro al pato: ${r.puntos} puntos. Hacían falta ${CA.umbralTiro}`, 2.4);
      programar(2.6, () => {
        cerrarTiro();
        escenario.visible = true;
        if (gana) ganarFicha('tiro', 0, 'fichaTiro');
        else { cambiarFeriante(false); dice('tiroKo', true); irTablon(); }
      });
    }
    function cerrarTiro() {
      if (!tiro) return;
      if (tiro.inst) { try { tiro.inst.destruir?.(); } catch (e) { console.error(e); } grupo.remove(tiro.inst.grupo); }
      tiro = null;
      ui.quitarTarjetas?.();
      ctx.musica?.('minijuego');
    }

    // ======================================================================================
    // FLUJO: tablón → caseta → tablón … → cierre
    // ======================================================================================
    function elegir(k) {
      if (est.modo !== 'tablon' || est.acabado) return;
      if (k === 'salir') { salir(); return; }
      sonido('zas', { volumen: 0.35 });
      if (k === 'tiro') empezarTiro();
      else if (k === 'noria') empezarNoria();
      else if (k === 'martillo') empezarMartillo();
    }
    function ganarFicha(k, pts, tipoFrase) {
      const nueva = !fichas[k];
      fichas[k] = true;
      if (k === 'noria') fichas.pNoria = Math.max(fichas.pNoria, pts);
      if (k === 'martillo') fichas.pMartillo = Math.max(fichas.pMartillo, pts);
      guardar();
      cambiarFeriante(true);
      dice(tipoFrase, true, 2.4);
      sonido('platillo', { volumen: 0.5 });
      ui.cartela(nueva ? '¡FICHA!' : '¡Ficha repetida, mejor marca!', 2);
      est.confeti = 1.2;
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) if (m.activa) m.vibrar(0.6, 90);
      espera(2.8, () => irTablon());
    }
    function irTablon(primero = false) {
      est.modo = 'tablon'; est.gen++;
      N = null; quitarMazo(); M = null;
      noria.visible = false; martillo.visible = false; hudMalla.visible = false; tablon.visible = true; escenario.visible = true;
      est.tablonClave = ''; est.tocarEspera = 0.6; zAntes.clear();
      pintarTablon();
      const n = fichasN();
      ui.instruccion(n >= 3 ? null : 'Toca una caseta del tablón');
      if (!primero || n > 0) programar(0.5, () => { if (est.modo === 'tablon' && !bocFer.malla.visible) dice(n > 0 ? 'vuelve' : 'tablon', true); });
      else programar(0.8, () => dice('tablon', true));
      if (n >= 3) espera(1.7, final);
    }
    function final() {
      if (est.acabado) return;
      est.acabado = true; est.modo = 'fin';
      const puntos = puntosTotales();
      const pn = Math.round(fichas.pNoria), pm = Math.round(fichas.pMartillo);
      // se cierra la feria: las fichas se gastan (terminar apunta la victoria en este mismo paso)
      fichas.tiro = fichas.noria = fichas.martillo = false; fichas.pNoria = fichas.pMartillo = fichas.pTiro = 0;
      guardar();
      ui.instruccion(null);
      cambiarFeriante(true);
      dice('cierre', true, 2.6);
      est.confeti = 2;
      sonido('platillo', { volumen: 0.6 });
      programar(1.5, () => { recogerTablon(); ctx.terminar({ puntos, gana: true, linea: `Tiro, noria (${pn}) y martillo (${pm}). El peluche, «para otra noche».` }); });
    }
    // al terminar, el tablón se tumba sobre la mesa: deja sitio a las tarjetas «Otra vez / Salir» del marco
    function recogerTablon() { est.recoger = 1; ui.instruccion(null); }
    function animarRecogida(dt) {
      if (!est.recoger) return;
      est.recoger = Math.min(2, est.recoger + dt * 2.5);
      const k = Math.min(1, est.recoger - 1);
      tablon.rotation.x = -0.3 - k * 1.2;
      tablon.position.y = H + 0.03 + TH / 2 * Math.cos(0.3) * (1 - k * 0.8);
      tablon.position.z = -0.46 - k * 0.12;
    }
    function salir() {
      if (est.acabado) return;
      est.acabado = true; est.modo = 'fin';
      ui.instruccion(null);
      const n = fichasN();
      dice('salir', true);
      recogerTablon();
      programar(0.6, () => ctx.terminar({ puntos: puntosTotales(), gana: false, linea: n ? `Llevas ${n} ficha${n === 1 ? '' : 's'} de 3. Se quedan guardadas en el tablón.` : 'Sin fichas por hoy. El tablón te espera.' }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('minijuego');
    sonido('sting', { volumen: 0.4 });
    irTablon(true);

    // para el bot (herramientas/pruebas/bots/casetas.js)
    const api = {
      get modo() { return est.modo; }, get fichas() { return { ...fichas }; }, get puntos() { return puntosTotales(); }, H,
      item: k => { const it = ITEMS.find(i => i.k === k); return { pos: tablon.localToWorld(V(it.x, it.y, 0)), normal: V(0, 0, 1).applyQuaternion(tablon.getWorldQuaternion(new THREE.Quaternion())) }; },
      get noria() { return N && { phi: N.phi, om: N.om, vidas: N.vidas, t: N.t, vivo: N.vivo, empezada: N.empezada, frenando: N.frenando, asas: Object.keys(N.asas).filter(s => N.asas[s]).length, asa: s => asaMundo(s) }; },
      get martillo() { return M && { pos: M.pos, lo: M.lo, estado: M.estado, i: M.i, campanas: M.campanas, regla: M.regla, cogido: !!cuerpoMazo?.cogido, mango: () => mazo.position.clone(), base: () => aMundo(0, padTop, MZ.padZ), cara: () => caraMazo(V()), q: () => qBase.clone() }; },
      get tiro() { return tiro; },
      aMundo: (x, y, z) => aMundo(x, y, z),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.cas = api;

    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) {
          if (eventos[i].t > est.t) continue;
          const e = eventos.splice(i, 1)[0];
          if (e.gen !== null && e.gen !== est.gen) continue;
          try { e.fn(); } catch (err) { console.error(err); }
        }
        if (est.modo === 'tiro') { if (tiro?.inst) tiro.inst.actualizar(dt); return; }
        if (est.modo === 'tablon') tocarTablon(dt);
        else if (est.modo === 'noria' && N) actualizarNoria(dt);
        else if (est.modo === 'martillo' && M) actualizarMartillo(dt);
        parpadear(dt);
        animarRecogida(dt);
        if (est.confeti > 0) { est.confeti -= dt; if (Math.random() < dt * 14) bocanadas(V(rnd(-0.3, 0.3), H + 0.5, -0.6), 1, 0.95, 0.6); }
        if (ferContento > 0) { ferContento -= dt; if (ferContento <= 0) cambiarFeriante(false); }
        ferT += dt; ferCarton.position.y = altoFer / 2 + Math.sin(ferT * 3.3) * 0.006; ferCarton.rotation.z = Math.sin(ferT * 2.8) * 0.02;
        bocFer.actualizar(dt, altoFer, xr.cabeza, feriante);
      },
      destruir() {
        est.destruido = true; eventos.length = 0;
        if (tiro) { const t = tiro; tiro = null; if (t.inst) { try { t.inst.destruir?.(); } catch (e) { console.error(e); } grupo.remove(t.inst.grupo); } }
        quitarMazo();
        ui.instruccion(null);
        for (const t of texturasPropias) t.dispose();
        bocFer.tex?.dispose?.();
        if (typeof window !== 'undefined' && window.__mj?.cas === api) window.__mj.cas = null;
      },
    };
  },
};
