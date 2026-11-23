// Tiro al pato de humo · VR nativo (escala «inmersivo»). Reglas de base/js/escenas/tiropato.js.
//
// La caseta de la feria delante de ti, a 2,5-4 m: mostrador a la altura de la cintura, tres filas de patos de humo
// detrás de sus olas (los del fondo, más pequeños, rápidos y valiosos), el feriante a la izquierda y el marcador en
// la pared del fondo. Detrás, la feria (bg-feria) en un panorama curvo.
//
// La escopeta de corcho está tumbada en el mostrador:
//   COGER     pellizco/gatillo o puño/agarre cerca de ella. Se queda en la mano (no hay que apretar todo el rato).
//   APUNTAR   mando: hacia donde apunta el mando. Mano: mezcla de la palma (el metacarpo no se mueve al pellizcar)
//             y la línea hombro → mano, filtrada; es lo más estable que da el seguimiento de manos.
//   DISPARAR  pellizco o gatillo de esa mano (hay que soltar el gesto con el que la cogiste).
//   DEJARLA   puño/agarre con la escopeta cerca de su sitio en el mostrador (o se vuelve sola si pierdes la mano).
// El corcho sale como cuerpo de ctx.fisica con la gravedad rebajada (se ve el arco y una estela de humo) y rebota
// en los patos, las olas, las paredes y el mostrador (colisiones de la caseta resueltas aquí, por tramo, para que
// a 11 m/s no atraviese nada). Los patos caen hacia atrás al acertar y se deshacen en humo.
//
// Seis corchos por carga. Recarga:
//   a) coger un corcho de la cajita (o uno que haya caído en el mostrador) con la otra mano y metérselo por la boca;
//   b) más rápido: apuntar la escopeta hacia el mostrador; la cajita le escupe los corchos dentro uno a uno.
//
// Puntos como el 2D: filas de 10/20/30, el dorado 100, cada 5 aciertos seguidos sube el multiplicador (hasta x4);
// Perico y la Pompa no son patos (−150); bono de puntería con 10 tiros o más; noches especiales al azar.
import * as THREE from 'three';
import { Bocadillo } from '../bocadillo.js';

const TP = {
  rondas: 3, duracion: 18, cargador: 6, penal: 150,
  vCorcho: 11,          // m/s a la salida del cañón
  gCorcho: 0.4,         // fracción de la gravedad mientras vuela (se ve el arco sin que sea imposible)
  W: 1.78,              // media anchura de la caseta por dentro
  zFrente: -0.8, zFondo: -4.4,
  // 0 = fondo (pequeños, rápidos, valen más), 2 = delante. alto = cresta de la ola sobre el mostrador
  filas: [
    { z: -3.85, alto: 0.95, ancho: 0.24, vel: 0.62, puntos: 30, cada: 1.25, dir: 1, ola: '#7a5bc4', tabla: '#2e1f48' },
    { z: -3.15, alto: 0.6, ancho: 0.3, vel: 0.44, puntos: 20, cada: 1.35, dir: -1, ola: '#8d6ad8', tabla: '#3a2858' },
    { z: -2.45, alto: 0.28, ancho: 0.37, vel: 0.3, puntos: 10, cada: 1.7, dir: 1, ola: '#a47ff0', tabla: '#463068' },
  ],
};

const FRASES = {
  inicio: ['¡Pasen y tiren! Seis corchos por carga.', 'Patos de humo, recién soplados.', 'Al que dé al dorado, premio. Más o menos.'],
  dorado: ['¡Ojo, que ese brilla!', '¡El dorado! ¡El dorado!', 'Ese lo soplé yo con cariño.'],
  oro: ['¡Toma ya!', '¡Puntería de feria!', 'Ese me dolió.'],
  fallos: ['Los patos son los blancos, eh.', 'Respira. Apunta. Luego tiras.', 'El corcho no vuelve solo.'],
  racha: ['¡Qué mano!', 'Me vas a dejar sin patos.', 'Eso ya es vicio.'],
  vacio: ['Recarga, que no muerden.', 'Sin corchos no hay tiro.'],
  perico: ['Eso no puntúa.', 'Ya te lo dijo. Dos veces.', 'El pájaro no entra en el premio.'],
  pompa: ['¡Esa no era un pato!', 'Uy. Esa no.', 'A la chica de los cascos no, hombre.'],
  ronda2: ['Ahora vienen con prisa.', 'Segunda ronda. Más rápido.'],
  ronda3: ['Última ronda: la dorada.', 'Última. Que se note.'],
  feriante: ['¡Eh! ¡Que yo no soy un pato!', 'Al feriante no se le tira.', 'Eso te lo apunto en la cuenta.'],
};
const NOCHES = [
  { id: 'normal', nombre: '' },
  { id: 'viento', nombre: 'Noche de viento: los patos se mecen' },
  { id: 'dorada', nombre: 'Noche dorada: más patos de oro' },
  { id: 'prisa', nombre: 'El feriante tiene prisa: rondas más cortas' },
];

const TINTA = '#140c1c', PAPEL = '#fffaf0', CARTON = '#b98d5e';
const V = () => new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0), CERO = new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;

// ---------- ayudantes de dibujo ----------
const MAT_TINTA = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
// contorno de dibujo animado (como conTinta de js/porro.js) con grosor constante en metros aunque la caja sea alargada
function tinta(malla, e = 0.006) {
  malla.geometry.computeBoundingBox();
  const s = malla.geometry.boundingBox.getSize(V());
  const t = new THREE.Mesh(malla.geometry, MAT_TINTA);
  t.scale.set(1 + 2 * e / Math.max(s.x, 1e-3), 1 + 2 * e / Math.max(s.y, 1e-3), 1 + 2 * e / Math.max(s.z, 1e-3));
  malla.add(t);
  return malla;
}
const mb = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g, t };
}

// silueta de un color con la transparencia del dibujo (el borde de troquel y el canto, como js/recortable.js)
function materialSilueta(color, map) {
  const m = new THREE.MeshBasicMaterial({ color, map, alphaTest: 0.5 });
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
  m.customProgramCacheKey = () => 'silueta-tp';
  return m;
}
const GEO_PLANO = new THREE.PlaneGeometry(1, 1);
// figura de cartón: dibujo delante, borde blanco y canto marrón detrás
function carton(mats, ancho, alto) {
  const g = new THREE.Group();
  const canto = new THREE.Mesh(GEO_PLANO, mats.canto); canto.scale.set(ancho * 1.05, alto * 1.04, 1); canto.position.z = -0.012;
  const borde = new THREE.Mesh(GEO_PLANO, mats.borde); borde.scale.set(ancho * 1.05, alto * 1.04, 1); borde.position.z = -0.004;
  const frente = new THREE.Mesh(GEO_PLANO, mats.frente); frente.scale.set(ancho, alto, 1);
  g.add(canto, borde, frente);
  g.userData.frente = frente;
  return g;
}
function matsCarton(tex) {
  return { frente: new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }), borde: materialSilueta(PAPEL, tex), canto: materialSilueta(CARTON, tex) };
}

// el pato de humo: bocanadas de fx-humo-puff con pico, ojo a media asta y ala, sobre su palo
function texPato(puff, oro, izquierda) {
  const { c, g, t } = lienzo(320, 264);
  g.save();
  if (izquierda) { g.translate(320, 0); g.scale(-1, 1); }
  g.fillStyle = TINTA; g.fillRect(134, 188, 36, 76); g.fillStyle = '#8a5a2b'; g.fillRect(141, 192, 22, 72);
  g.filter = oro ? 'sepia(1) saturate(6) hue-rotate(-14deg) brightness(1.45)' : 'saturate(0.3) brightness(1.8)';
  g.drawImage(puff, 2, 92, 96, 82);
  g.drawImage(puff, 26, 52, 222, 172);
  g.drawImage(puff, 150, 2, 128, 110);
  g.filter = 'none';
  const cuerpo = oro ? '#ffd23f' : '#ece6f4', sombra = oro ? '#e09a1f' : '#c9bde0';
  // ala
  g.lineCap = 'round'; g.strokeStyle = TINTA; g.lineWidth = 12;
  g.beginPath(); g.arc(128, 136, 38, 0.25, 2.6); g.stroke();
  g.strokeStyle = sombra; g.lineWidth = 6; g.beginPath(); g.arc(128, 136, 38, 0.25, 2.6); g.stroke();
  // pico
  g.fillStyle = '#ff9a3b'; g.strokeStyle = TINTA; g.lineWidth = 7; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(258, 44); g.quadraticCurveTo(316, 38, 314, 62); g.quadraticCurveTo(300, 70, 258, 66); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(260, 66); g.quadraticCurveTo(306, 70, 304, 84); g.quadraticCurveTo(280, 90, 258, 80); g.closePath(); g.fill(); g.stroke();
  // ojo a media asta: el pato está tranquilo
  g.fillStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(232, 44, 17, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = TINTA; g.beginPath(); g.arc(237, 48, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = cuerpo; g.fillRect(213, 24, 38, 18);
  g.strokeStyle = TINTA; g.lineWidth = 5; g.beginPath(); g.moveTo(214, 42); g.lineTo(250, 42); g.stroke();
  g.restore();
  t.needsUpdate = true;
  return t;
}

// ======================================================================================
export default {
  clave: 'TiroPato', titulo: 'Tiro al pato de humo', escala: 'inmersivo', umbrales: [600, 2200, 2800],

  async crear(ctx) {
    const { xr, fisica, agarre, humo, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'tiropato';
    const texturasPropias = [];
    const lz = (w, h) => { const l = lienzo(w, h); texturasPropias.push(l.t); return l; };

    // ---------- banderas de partida: TODAS aquí («Otra vez» llama a crear de nuevo) ----------
    const est = {
      fase: 'espera', t: 0, puntos: 0, ronda: 0, restante: 0, balas: TP.cargador, racha: 0, mejorRacha: 0,
      fallosSeguidos: 0, disparos: 0, aciertos: 0, patos: 0, dorados: 0, malos: 0, dioPerico: 0, dioPompa: 0,
      avisoVacio: false, cooldown: 0, filaT: [0.2, 0.6, 0.3], intrusoT: 5, ultimaFrase: -9, acabado: false,
      cogidaVez: false, bajando: 0, cadaCarga: 0, multPintado: 1, destruido: false,
    };
    const eventos = []; // [{ t, fn }] (en vez de setTimeout: destruir los cancela)
    const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn });
    const bolsas = {};
    const sacar = (clave, lista) => {
      if (!bolsas[clave]?.length) bolsas[clave] = [...lista].sort(() => Math.random() - 0.5);
      return bolsas[clave].pop();
    };
    const noche = NOCHES[Math.floor(Math.random() * NOCHES.length)];

    // ---------- dónde: delante de ti, con el mostrador a tu cintura (de pie o sentado) ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const H = clamp(xr.cabeza.y - 0.62, 0.6, 1.05);
    const W = TP.W;
    const caseta = new THREE.Group(); caseta.name = 'caseta';
    caseta.position.copy(xr.cabeza).setY(0); caseta.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(caseta); caseta.updateMatrixWorld(true);
    const inv = caseta.matrixWorld.clone().invert(), qC = caseta.quaternion.clone(), qCi = qC.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(caseta.matrixWorld);

    // la sala VR no tiene tus mesas ni tus paredes: fuera planos y caja mientras se juega (se devuelven al salir)
    const planosAntes = fisica.planos, cajaAntes = fisica.caja;
    fisica.planos = []; fisica.caja = null;

    // ---------- arte ----------
    const [puff, texFer, texFerE, texFondo, perico, pompa] = await Promise.all([
      ctx.img('fx-humo-puff.png'), ctx.img('feriante.png'), ctx.img('feriante-emocionado.png').catch(() => null), ctx.img('bg-feria.jpg'),
      ctx.Recortable.crear('perico', 'humo', { escala: 0.9 }).catch(e => { console.warn('tiropato: sin Perico', e); return null; }),
      ctx.Recortable.crear('la-pompa', 'humo', { escala: 0.9 }).catch(e => { console.warn('tiropato: sin la Pompa', e); return null; }),
    ]);
    const texPatos = {
      patoD: texPato(puff.image, false, false), patoI: texPato(puff.image, false, true),
      oroD: texPato(puff.image, true, false), oroI: texPato(puff.image, true, true),
    };
    texturasPropias.push(...Object.values(texPatos));
    const matsPato = Object.fromEntries(Object.entries(texPatos).map(([k, t]) => [k, matsCarton(t)]));

    // ---------- la feria ----------
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), mb('#24183f', { side: THREE.BackSide }));
    caseta.add(cielo);
    const tf = texFondo.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(2, 1); tf.offset.x = -0.33; tf.needsUpdate = true; texturasPropias.push(tf);
    const fondo = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 12, 64, 1, true, Math.PI - 1.65, 3.3), mb('#ffffff', { map: tf, side: THREE.BackSide }));
    fondo.position.y = 2.6; caseta.add(fondo);
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(30, 48), mb('#2e2433'));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.003; caseta.add(suelo);

    // tablones (paredes y mostrador)
    const tablones = (() => {
      const { c, g, t } = lz(256, 256);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#f2efe8', '#e2ddd2', '#ebe7de', '#d9d3c6'][i]; g.fillRect(i * 64, 0, 64, 256);
        g.fillStyle = 'rgba(20,12,28,.55)'; g.fillRect(i * 64, 0, 4, 256);
        g.fillStyle = 'rgba(20,12,28,.25)'; g.beginPath(); g.arc(i * 64 + 32, 40 + i * 50, 4, 0, 7); g.fill();
      }
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return { c, t };
    })();
    const madera = (color, rx, ry) => { const t = tablones.t.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; texturasPropias.push(t); return mb(color, { map: t }); };

    const prof = TP.zFrente - TP.zFondo, zMedio = (TP.zFrente + TP.zFondo) / 2;
    const ALTO_FONDO = Math.min(2.75, H + 1.75), Z_TECHO = -2.0;
    for (const s of [-1, 1]) {
      const pared = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.75, prof), madera('#5a3a70', 6, 1)), 0.008);
      pared.position.set(s * (W + 0.03), 1.375, zMedio); caseta.add(pared);
      const poste = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 0.14), mb('#9a6232')), 0.01);
      poste.position.set(s * (W + 0.07), 1.4, TP.zFrente); caseta.add(poste);
    }
    // la pared del fondo llega justo por encima del marcador y el techo es solo un tejadillo: por encima asoma la feria
    const paredFondo = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * W + 0.12, ALTO_FONDO, 0.06), madera('#3a2550', 8, 1)), 0.008);
    paredFondo.position.set(0, ALTO_FONDO / 2, TP.zFondo); caseta.add(paredFondo);
    const techo = new THREE.Mesh(new THREE.PlaneGeometry(2 * W + 0.2, TP.zFrente - Z_TECHO), mb('#1a1226', { side: THREE.DoubleSide }));
    techo.rotation.x = Math.PI / 2; techo.position.set(0, 2.75, (TP.zFrente + Z_TECHO) / 2); caseta.add(techo);
    const sueloCaseta = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, prof), mb('#1d1626'));
    sueloCaseta.rotation.x = -Math.PI / 2; sueloCaseta.position.set(0, 0.006, zMedio); caseta.add(sueloCaseta);

    // toldo de rayas
    const toldo = (() => {
      const { g, t } = lz(1024, 96);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#fff3c4' : '#e8364f'; g.fillRect(i * 64, 0, 64, 96); }
      g.fillStyle = TINTA; g.fillRect(0, 88, 1024, 8); g.fillRect(0, 0, 1024, 6);
      t.needsUpdate = true; return t;
    })();
    const valance = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * W + 0.4, 0.3, 0.04), mb('#ffffff', { map: toldo })), 0.008);
    valance.position.set(0, 2.62, TP.zFrente - 0.02); caseta.add(valance);

    // bombillas (una sola malla instanciada) que parpadean a turnos
    const bombillasPos = [];
    for (let x = -W + 0.1; x <= W - 0.1; x += 0.3) bombillasPos.push([x, 2.44, TP.zFrente + 0.02]);
    for (let x = -W + 0.15; x <= W - 0.15; x += 0.28) bombillasPos.push([x, ALTO_FONDO + 0.035, TP.zFondo]);
    const bombillas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), mb('#ffffff'), bombillasPos.length);
    const COLORES_BOMBILLA = ['#ffd23f', '#ff5fa2', '#5adceb', '#7ee081'].map(c => new THREE.Color(c));
    { const m4 = new THREE.Matrix4(); bombillasPos.forEach((p, i) => { bombillas.setMatrixAt(i, m4.makeTranslation(...p)); bombillas.setColorAt(i, COLORES_BOMBILLA[i % 4]); }); }
    caseta.add(bombillas);
    let parpadeo = 0, turno = 0;
    const _col = new THREE.Color();
    function parpadear(dt) {
      parpadeo -= dt; if (parpadeo > 0) return;
      parpadeo = 0.38; turno ^= 1;
      for (let i = 0; i < bombillasPos.length; i++) bombillas.setColorAt(i, _col.copy(COLORES_BOMBILLA[i % 4]).multiplyScalar((i + turno) % 2 ? 1 : 0.35));
      bombillas.instanceColor.needsUpdate = true;
    }

    // mostrador (a la cintura) con su letrero
    const MOS = { x: W + 0.15, z0: -0.79, z1: -0.37 };
    const tapa = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * MOS.x, 0.05, MOS.z1 - MOS.z0), madera('#c08347', 1, 10)), 0.006);
    tapa.rotation.y = 0; tapa.position.set(0, H - 0.025, (MOS.z0 + MOS.z1) / 2); caseta.add(tapa);
    const letrero = (() => {
      const { g, t } = lz(1024, 256);
      g.fillStyle = '#8a3a2b'; g.fillRect(0, 0, 1024, 256);
      for (let i = 0; i < 1024; i += 128) { g.fillStyle = 'rgba(20,12,28,.35)'; g.fillRect(i, 0, 5, 256); }
      g.font = '96px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.strokeText('TIRO AL PATO', 512, 120); g.fillStyle = '#ffd23f'; g.fillText('TIRO AL PATO', 512, 120);
      g.font = '40px Caprasimo, serif'; g.lineWidth = 8; g.strokeText('de humo · seis corchos por carga', 512, 212); g.fillStyle = '#fff3c4'; g.fillText('de humo · seis corchos por carga', 512, 212);
      t.needsUpdate = true; return t;
    })();
    const frenteMos = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * MOS.x, H - 0.05, 0.04), mb('#8a5a2b')), 0.006);
    frenteMos.position.set(0, (H - 0.05) / 2, MOS.z1 + 0.02); caseta.add(frenteMos);
    const cartelMos = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), mb('#ffffff', { map: letrero }));
    cartelMos.position.set(0, H * 0.62, MOS.z1 + 0.042); caseta.add(cartelMos);

    // cajita de corchos (de aquí salen los corchos para recargar a mano)
    const PUNTO_CAJA = new THREE.Vector3(0, H + 0.075, -0.52);
    const caja = tinta(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.1), mb('#c23b3b')), 0.005);
    caja.position.set(0, H + 0.03, -0.52); caseta.add(caja);
    const GEO_CORCHO = new THREE.CylinderGeometry(0.0115, 0.0095, 0.028, 10);
    const MAT_CORCHO = mb('#d9a85e');
    const corchosCaja = new THREE.InstancedMesh(GEO_CORCHO, MAT_CORCHO, 7);
    { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 7; i++) { q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)); corchosCaja.setMatrixAt(i, m4.compose(new THREE.Vector3(-0.05 + (i % 4) * 0.033, 0.035, i < 4 ? -0.018 : 0.02), q, new THREE.Vector3(1, 1, 1))); } }
    caja.add(corchosCaja);

    // ---------- las filas: tabla, ola y listón; los patos asoman por encima ----------
    const olaTex = (() => {
      const { g, t } = lz(128, 64);
      g.fillStyle = TINTA; g.fillRect(0, 22, 128, 42); g.beginPath(); g.arc(32, 26, 30, 0, 7); g.arc(96, 26, 30, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(0, 28, 128, 36); g.beginPath(); g.arc(32, 26, 23, 0, 7); g.arc(96, 26, 23, 0, 7); g.arc(160, 26, 23, 0, 7); g.arc(-32, 26, 23, 0, 7); g.fill();
      t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t;
    })();
    const filas = TP.filas.map(f => {
      const olaTop = H + f.alto;
      const tabla = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * W, olaTop - 0.1, 0.03), mb(f.tabla)), 0.006);
      tabla.position.set(0, (olaTop - 0.1) / 2, f.z + 0.06); caseta.add(tabla);
      const t = olaTex.clone(); t.repeat.set(2 * W / 0.34, 1); t.needsUpdate = true; texturasPropias.push(t);
      const ola = new THREE.Mesh(new THREE.PlaneGeometry(2 * W, 0.17), mb(f.ola, { map: t, alphaTest: 0.5 }));
      ola.position.set(0, olaTop - 0.085 + 0.012, f.z + 0.078); caseta.add(ola);
      const liston = tinta(new THREE.Mesh(new THREE.BoxGeometry(2 * W, 0.03, 0.05), mb('#8a5a2b')), 0.005);
      liston.position.set(0, olaTop - 0.16, f.z + 0.09); caseta.add(liston);
      return { ...f, olaTop, zTabla: f.z + 0.095, tex: t };
    });

    // marcador en la pared del fondo
    const marcador = lz(1024, 220);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4 * 220 / 1024), mb('#ffffff', { map: marcador.t, transparent: true }));
    panel.position.set(0, Math.min(2.47, H + 1.4), TP.zFondo + 0.04); caseta.add(panel);
    let marcadorClave = '';
    function pintarMarcador() {
      const mult = multiplicador();
      const tiempo = est.fase === 'ronda' ? Math.max(0, Math.ceil(est.restante)) : '';
      const clave = [est.puntos, est.ronda, tiempo, mult, est.racha, est.fase].join('|');
      if (clave === marcadorClave) return;
      marcadorClave = clave;
      const { g, c, t } = marcador;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(4, 4, 1016, 212, 26); g.fill();
      g.fillStyle = '#3b2a52'; g.beginPath(); g.roundRect(14, 14, 996, 192, 18); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = (s, x, y, tam, color) => { g.font = `${tam}px Caprasimo, serif`; g.lineWidth = tam / 6; g.strokeStyle = TINTA; g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y); };
      txt('TIRO AL PATO DE HUMO', 512, 44, 34, '#ffd6ea');
      txt(String(est.puntos), 512, 136, 96, '#ffd23f');
      txt(est.ronda ? `Ronda ${est.ronda}/${TP.rondas}` : '¡Pasen y tiren!', 170, 110, 40, '#fff3c4');
      if (tiempo !== '') txt(`${tiempo} s`, 170, 162, 46, tiempo <= 5 ? '#ff5fa2' : '#5adceb');
      txt(mult > 1 ? `x${mult}` : est.racha > 0 ? `racha ${est.racha}` : '', 856, 130, mult > 1 ? 80 : 42, mult >= 4 ? '#ff5fa2' : mult >= 2 ? '#ffd23f' : '#7ee081');
      t.needsUpdate = true;
    }

    // ---------- el feriante (cartón) con su bocadillo ----------
    const altoFer = 1.32;
    const matsFer = matsCarton(texFer);
    const feriante = new THREE.Group(); feriante.position.set(-W + 0.3, 0, -1.8);
    feriante.rotation.y = Math.atan2(-feriante.position.x, -feriante.position.z);
    const anchoFer = altoFer * texFer.image.width / texFer.image.height;
    const ferCarton = carton(matsFer, anchoFer, altoFer); ferCarton.position.y = altoFer / 2; feriante.add(ferCarton);
    caseta.add(feriante);
    const bocFer = new Bocadillo(); feriante.add(bocFer.malla);
    let ferContento = 0, ferT = 0;
    function cambiarFeriante(contento) {
      const tex = contento && texFerE ? texFerE : texFer;
      for (const m of [matsFer.frente, matsFer.borde, matsFer.canto]) { m.map = tex; m.needsUpdate = true; }
      const ancho = altoFer * tex.image.width / tex.image.height;
      ferCarton.children.forEach((h, i) => h.scale.set(ancho * (i < 2 ? 1.05 : 1), altoFer * (i < 2 ? 1.04 : 1), 1));
      ferContento = contento ? 1.4 : 0;
    }

    // ---------- voces: una a la vez ----------
    let hablando = null;
    const voces = {
      feriante: { decir: (s, d) => bocFer.mostrar(s, d ?? Math.min(4, 1.6 + s.length * 0.05)), callar: () => bocFer.ocultar(), activo: () => bocFer.malla.visible },
    };
    function voz(quien, texto, dur) {
      if (!quien) return;
      if (hablando && hablando !== quien) hablando.callar();
      quien.decir(texto, dur); hablando = quien;
    }
    const hayVoz = () => !!hablando?.activo?.();
    function feriantDice(tipo, siempre = false) {
      if (est.destruido) return;
      if (!siempre && (est.t - est.ultimaFrase < 3 || hayVoz())) return;
      est.ultimaFrase = est.t;
      voz(voces.feriante, sacar(tipo, FRASES[tipo]), 1.9);
    }
    const vozRecortable = r => r && { decir: (s, d) => r.decir(s, { dur: d }), callar: () => r.callar(), activo: () => !!r.bocadillo?.malla.visible };
    voces.perico = vozRecortable(perico); voces.pompa = vozRecortable(pompa);
    for (const r of [perico, pompa]) if (r) { r.enAsiento = true; r.sombra.visible = false; r.grupo.visible = false; caseta.add(r.grupo); }

    // ---------- la escopeta de corcho ----------
    const escopeta = new THREE.Group(); escopeta.name = 'escopeta';
    const pieza = (geo, color, pos, rot, e = 0.004) => { const m = tinta(new THREE.Mesh(geo, mb(color)), e); m.position.set(...pos); if (rot) m.rotation.set(...rot); escopeta.add(m); return m; };
    pieza(new THREE.BoxGeometry(0.042, 0.075, 0.2), '#7a4f2a', [0, -0.025, 0.115], [0.12, 0, 0]);          // culata
    pieza(new THREE.BoxGeometry(0.034, 0.085, 0.045), '#6a4222', [0, -0.055, 0.005], [-0.3, 0, 0]);       // empuñadura
    pieza(new THREE.BoxGeometry(0.048, 0.05, 0.22), '#b0773c', [0, 0.004, -0.1]);                         // cajón
    const canon = pieza(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 14), '#4a4a58', [0, 0.018, -0.37], [Math.PI / 2, 0, 0]);
    pieza(new THREE.TorusGeometry(0.016, 0.005, 8, 16), '#2b2b36', [0, 0.018, -0.55]);                    // boca
    pieza(new THREE.SphereGeometry(0.006, 8, 6), '#ff5fa2', [0, 0.037, -0.53], null, 0.002);              // punto de mira
    pieza(new THREE.BoxGeometry(0.03, 0.012, 0.012), '#2b2b36', [0, 0.034, -0.02], null, 0.002);          // alza
    pieza(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), '#2b2b36', [0, -0.03, -0.035], [0, Math.PI / 2, Math.PI], 0.002); // guardamonte
    canon.material.color.set('#4a4a58');
    const corchoBoca = new THREE.Mesh(GEO_CORCHO, MAT_CORCHO); corchoBoca.rotation.x = Math.PI / 2; corchoBoca.position.set(0, 0.018, -0.562);
    escopeta.add(corchoBoca);
    // los seis corchos de la carga, a la vista en el costado (se leen sin mirar ningún marcador)
    const cargador = [];
    for (let i = 0; i < TP.cargador; i++) {
      const c = new THREE.Mesh(GEO_CORCHO, MAT_CORCHO); c.scale.setScalar(0.7); c.rotation.x = Math.PI / 2;
      c.position.set(-0.03, 0.006, -0.035 - i * 0.026); escopeta.add(c); cargador.push(c);
    }
    const BOCA = new THREE.Vector3(0, 0.018, -0.57);
    grupo.add(escopeta);
    const REPOSO = new THREE.Vector3(0.4, H + 0.03, -0.6);
    const reposoPos = aMundo(REPOSO);
    const reposoQ = qC.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.22, Math.PI / 2)));
    escopeta.position.copy(reposoPos); escopeta.quaternion.copy(reposoQ);
    const arma = { mano: null, armado: false, sinMano: 0, retroceso: 0, dir: new THREE.Vector3(0, 0, -1).applyQuaternion(qC), cogidaEn: 0 };
    const bocaMundo = (out = V()) => escopeta.localToWorld(out.copy(BOCA));
    function pintarCorchos() {
      cargador.forEach((c, i) => { c.visible = i < est.balas; });
      corchoBoca.visible = est.balas > 0;
    }
    pintarCorchos();

    // la mira: dónde caería el corcho a la altura de la fila del medio (ayuda justa, no láser)
    const mira = new THREE.Group();
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 24), mb('#ff5fa2', { depthTest: false, transparent: true, opacity: 0.85 }));
    const anilloT = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 24), mb(TINTA, { depthTest: false, transparent: true, opacity: 0.6 }));
    anillo.renderOrder = 41; anilloT.renderOrder = 40; mira.add(anilloT, anillo); mira.visible = false; grupo.add(mira);

    // ---------- patos e intrusos ----------
    let patos = [];
    const intrusos = []; // { tipo, r, vivo, x, y, z, vx, vy, t, cae }
    const velocidad = () => 1 + 0.16 * Math.max(0, est.ronda - 1);
    const multiplicador = () => Math.min(4, 1 + Math.floor(est.racha / 5));

    function nuevoPato(i, oro) {
      const fl = filas[i];
      const w = fl.ancho, h = w * 0.825;
      const clave = (oro ? 'oro' : 'pato') + (fl.dir < 0 ? 'I' : 'D');
      const mats = oro ? { ...matsPato[clave], frente: matsPato[clave].frente.clone() } : matsPato[clave];
      const fig = carton(mats, w, h); fig.position.y = h / 2;
      const piv = new THREE.Group(); piv.add(fig);
      const baseY = fl.olaTop - 0.3 * h;
      piv.position.set(-fl.dir * (W + 0.3), baseY, fl.z);
      caseta.add(piv);
      const p = { tipo: oro ? 'oro' : 'pato', fila: i, piv, mats, vivo: true, vx: fl.dir * fl.vel * velocidad() * (oro ? 1.55 : 1), fase: Math.random() * 6, baseY, w, h, cae: -1 };
      patos.push(p);
      if (oro && (est.patos + est.dorados > 0 || est.ronda > 1)) feriantDice('dorado');
    }
    function quitarPato(p) { caseta.remove(p.piv); if (p.tipo === 'oro') p.mats.frente.dispose(); }

    function intruso(tipo) {
      const r = tipo === 'perico' ? perico : pompa;
      if (!r || est.fase !== 'ronda' || intrusos.some(o => o.r === r)) return;
      if (tipo === 'perico') {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const o = { tipo, r, vivo: true, x: -dir * (W + 0.2), y: H + 0.45 + Math.random() * 0.75, z: -1.95, vx: dir * 0.6, vy: 0, t: 0, cae: false };
        o.baseY = o.y; intrusos.push(o);
        r.pose('volando', { rebote: 0 }); r.grupo.rotation.set(0, 0, 0); r.grupo.visible = true; r.grupo.position.set(o.x, o.y, o.z);
        sonido('pin-pin', { en: r.grupo, volumen: 0.5 });
        programar(0.35, () => { if (o.vivo) voz(voces.perico, '¡Que no soy un pato!', 1.3); });
        programar(1.9, () => { if (o.vivo) voz(voces.perico, '¡Que NO soy un pato!', 1.3); });
        programar(3.2, () => { if (o.vivo && est.fase === 'ronda') voz(voces.feriante, 'Ya, ya.', 1.2); });
      } else {
        const o = { tipo, r, vivo: true, x: (Math.random() - 0.5) * 2.2, y: H + 0.28 - 0.85, z: -2.8, vx: 0, vy: 0.2, t: 0, cae: false, fase: Math.random() * 6 };
        o.baseX = o.x; intrusos.push(o);
        r.pose('meciendose', { rebote: 0 }); r.grupo.rotation.set(0, 0, 0); r.grupo.visible = true; r.grupo.position.set(o.x, o.y, o.z);
      }
    }
    function quitarIntruso(o) { o.vivo = false; o.r.grupo.visible = false; o.r.callar(); const i = intrusos.indexOf(o); if (i >= 0) intrusos.splice(i, 1); }

    // ---------- textos que saltan (+30, -150…) ----------
    const etiquetas = [];
    function etiqueta(texto, color, posLocal, tam = 0.14) {
      const { g, t } = lienzo(256, 128);
      g.font = '86px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText(texto, 128, 66); g.fillStyle = color; g.fillText(texto, 128, 66);
      t.needsUpdate = true;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      s.renderOrder = 35; s.scale.set(tam * 2, tam, 1); s.position.copy(posLocal); caseta.add(s);
      etiquetas.push({ s, vida: 1 });
    }

    // ---------- puntos ----------
    function sumar(n) { est.puntos = Math.max(0, est.puntos + n); }
    function vibrarArma(f, ms) { arma.mano?.vibrar(f, ms); }
    function humoEn(posLocal, n, oro) {
      const p = aMundo(posLocal);
      for (let i = 0; i < n; i++) {
        humo.soltar({ pos: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.06, 0)), vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1 + Math.random() * 0.25, (Math.random() - 0.5) * 0.2), tam: 0.05 + Math.random() * 0.04, vida: 1 + Math.random() * 0.6, crece: 0.22, sube: 0.12, frena: 1.5, brillo: oro ? 0.9 : 0.55 });
      }
    }

    function acierto(p) {
      p.vivo = false; p.cae = 0;
      est.aciertos++; est.racha++; est.mejorRacha = Math.max(est.mejorRacha, est.racha); est.fallosSeguidos = 0;
      const oro = p.tipo === 'oro';
      if (oro) est.dorados++; else est.patos++;
      const mult = multiplicador();
      const gana = (oro ? 100 : filas[p.fila].puntos) * mult;
      sumar(gana);
      const centro = new THREE.Vector3(p.piv.position.x, p.baseY + p.h * 0.62, p.piv.position.z);
      etiqueta(`+${gana}`, oro ? '#ffd23f' : '#fff3c4', centro.clone().add(new THREE.Vector3(0, 0.12, 0.05)), oro ? 0.2 : 0.13 + p.fila * 0.005);
      sonido('pop', { en: p.piv, volumen: 0.5, tono: 1.4 });
      if (oro) {
        sonido('platillo', { volumen: 0.45 }); vibrarArma(1, 120);
        cambiarFeriante(true); feriantDice('oro', true);
      } else { sonido(Math.random() < 0.5 ? 'fup' : 'plop', { en: p.piv, volumen: 0.6 }); vibrarArma(0.6, 60); }
      const m = multiplicador();
      if (m > est.multPintado) sonido('campanita', { volumen: 0.4, tono: 1 + m * 0.08 });
      est.multPintado = m;
      if (est.racha > 0 && est.racha % 10 === 0) { feriantDice('racha'); cambiarFeriante(true); etiqueta(`¡Racha ${est.racha}!`, '#ff5fa2', new THREE.Vector3(0, H + 1.15, -2.2), 0.3); }
    }
    function fallo() {
      est.racha = 0; est.multPintado = 1; est.fallosSeguidos++;
      sonido('fiu', { volumen: 0.3 });
      if (est.fallosSeguidos === 3) feriantDice('fallos');
    }
    function darIntruso(o) {
      o.vivo = false; o.cae = true; o.t = 0;
      est.malos++; est.racha = 0; est.multPintado = 1;
      sumar(-TP.penal);
      vibrarArma(1, 160);
      const pos = new THREE.Vector3(o.x, o.y + 0.5, o.z);
      etiqueta(`-${TP.penal}`, '#ff5fa2', pos, 0.2);
      if (o.tipo === 'perico') {
        est.dioPerico++; o.vy = 0.8;
        o.r.pose('graznando'); sonido('pin-pin', { en: o.r.grupo, volumen: 0.7 }); sonido('golpe', { volumen: 0.5 });
        voz(voces.perico, '¡Te lo dije! ¡Te lo dije!', 1.4);
        programar(1.5, () => feriantDice('perico', true));
      } else {
        est.dioPompa++;
        o.r.pose('aplastada'); sonido('plop', { en: o.r.grupo, volumen: 0.8 }); sonido('oooh', { volumen: 0.4 });
        feriantDice('pompa', true);
        // ella contesta. Tarde.
        programar(2.4, () => { if (!est.acabado && o.r.grupo.visible) { o.r.pose('respondiendo-tarde'); voz(voces.pompa, '…No.', 1.4); } });
      }
    }

    // ---------- disparar ----------
    const corchos = []; // cuerpos de física que son corchos
    function nuevoCorcho(pos, datos = {}) {
      const malla = tinta(new THREE.Mesh(GEO_CORCHO, MAT_CORCHO), 0.003);
      malla.position.copy(pos); grupo.add(malla);
      const c = fisica.anadir(malla, {
        radio: 0.012, rebote: 0.45, roce: 0.6, masa: 0.2, cogible: true,
        alGolpear: (cc, info) => {
          if (cc.datos.vuela) { cc.datos.vuela = false; resolverTiro(cc, false); }
          if (info.fuerza > 0.6) sonido('bonk', { en: cc.obj, volumen: Math.min(0.3, info.fuerza / 12), tono: 1.6 });
        },
        datos: { corcho: true, vuela: false, tiro: null, prev: pos.clone(), edad: 0, rastro: 0, suelo: 0, ...datos },
      });
      corchos.push(c);
      // como mucho 18 corchos sueltos: el más viejo se va
      if (corchos.length > 18) { const viejo = corchos.find(x => !x.cogido); if (viejo) quitarCorcho(viejo); }
      return c;
    }
    function quitarCorcho(c) {
      if (c.cogido) agarre.soltar(c.cogido, false);
      fisica.quitar(c); grupo.remove(c.obj);
      const i = corchos.indexOf(c); if (i >= 0) corchos.splice(i, 1);
    }
    function resolverTiro(c, acerto) {
      const tiro = c.datos.tiro; if (!tiro || tiro.resuelto) return;
      tiro.resuelto = true;
      if (!acerto && tiro.cuenta) fallo();
    }

    function disparar() {
      if (est.cooldown > 0 || est.fase === 'final') return;
      if (est.balas <= 0) {
        sonido('bonk', { en: escopeta, volumen: 0.5, tono: 1.3 }); vibrarArma(0.25, 20);
        if (!est.avisoVacio) { est.avisoVacio = true; feriantDice('vacio', true); }
        ui.instruccion('Recarga: apunta al mostrador o mete un corcho');
        return;
      }
      est.cooldown = 0.14; est.balas--; pintarCorchos();
      const cuenta = est.fase === 'ronda';
      if (cuenta) est.disparos++;
      const boca = bocaMundo();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(escopeta.quaternion);
      const c = nuevoCorcho(boca, { vuela: true, tiro: { cuenta, resuelto: false } });
      c.cogible = false;
      c.obj.quaternion.copy(escopeta.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
      fisica.lanzar(c, dir.multiplyScalar(TP.vCorcho));
      arma.retroceso = 1;
      sonido('pop', { en: escopeta, volumen: 0.8, tono: 0.9 + Math.random() * 0.2 });
      vibrarArma(0.75, 45);
      humo.soltar({ pos: boca, vel: dir.clone().setLength(0.5), tam: 0.03, vida: 0.9, crece: 0.12, sube: 0.06, frena: 2.5, brillo: 0.6, alfa: 0.8 });
      if (est.balas === 0) programar(0.3, () => { if (est.balas === 0 && arma.mano) ui.instruccion('Recarga: apunta al mostrador o mete un corcho'); });
    }
    function cargarUno(desdeCaja) {
      if (est.balas >= TP.cargador) return false;
      est.balas++; pintarCorchos();
      sonido('pop', { en: escopeta, volumen: 0.3, tono: 1.5 + est.balas * 0.08 });
      vibrarArma(0.3, 18);
      if (desdeCaja) saltarines.push({ t: 0, desde: aMundo(PUNTO_CAJA), malla: (() => { const m = new THREE.Mesh(GEO_CORCHO, MAT_CORCHO); grupo.add(m); return m; })() });
      if (est.balas === TP.cargador) { sonido('zas', { volumen: 0.35 }); vibrarArma(0.6, 50); }
      ui.instruccion(null);
      return true;
    }
    const saltarines = []; // corchos que la cajita escupe dentro del cañón (solo se ven)

    // ---------- coger, apuntar y dejar la escopeta ----------
    const _a = V(), _b = V(), _c = V(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion();
    function medirDireccion(m, out) {
      out.set(0, 0, -1).applyQuaternion(m.quat);
      if (!m.esMano) return out;
      // mano: la palma (no se mueve al pellizcar) mezclada con la línea hombro → mano, como el rayo del sistema
      const f = _a.copy(xr.adelante).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
      const lado = m.lado === 'derecha' ? 1 : -1;
      const hombro = _b.copy(xr.cabeza).add(_c.set(-f.z * 0.17 * lado, -0.2, f.x * 0.17 * lado));
      const rayo = _c.copy(m.pos).sub(hombro);
      if (rayo.lengthSq() > 1e-4) out.add(rayo.normalize()).normalize();
      return out;
    }
    function coger(m) {
      arma.mano = m; arma.armado = !m.pinza; arma.sinMano = 0; arma.cogidaEn = est.t;
      medirDireccion(m, arma.dir);
      m.vibrar(0.5, 40); sonido('golpe', { en: escopeta, volumen: 0.25, tono: 1.6 });
      if (!est.cogidaVez) {
        est.cogidaVez = true; ui.instruccion(null);
        if (est.fase === 'espera') {
          est.fase = 'intro';
          if (noche.nombre) ui.cartela(noche.nombre, 2.6);
          programar(noche.nombre ? 2.4 : 1.0, empezarRonda);
        }
      }
    }
    function dejar() { arma.mano = null; mira.visible = false; arma.volver = 0; }
    function actualizarArma(dt) {
      const m = arma.mano;
      if (!m) {
        // vuelve a su sitio del mostrador
        escopeta.position.lerp(reposoPos, 1 - Math.exp(-dt * 10));
        escopeta.quaternion.slerp(reposoQ, 1 - Math.exp(-dt * 10));
        if (est.fase === 'final') return;
        for (const mano of [xr.manos.derecha, xr.manos.izquierda]) {
          if (!mano.activa || agarre.lleva(mano) || !(mano.empiezaPinza || mano.empiezaAgarre)) continue;
          const d = Math.min(mano.pos.distanceTo(escopeta.position), mano.punta.distanceTo(escopeta.position));
          if (d < 0.17) { coger(mano); break; }
        }
        return;
      }
      if (!m.activa) { arma.sinMano += dt; if (arma.sinMano > 1) dejar(); return; }
      arma.sinMano = 0;
      // con esta mano no se lleva nada más: si la física le ha puesto un corcho, se cae
      if (agarre.lleva(m)) agarre.soltar(m, false);
      medirDireccion(m, _a);
      arma.dir.lerp(_a, 1 - Math.exp(-dt * (m.esMano ? 14 : 40))).normalize();
      _m4.lookAt(CERO, arma.dir, ARRIBA);
      escopeta.quaternion.setFromRotationMatrix(_m4);
      arma.retroceso = Math.max(0, arma.retroceso - dt * 7);
      if (arma.retroceso > 0) escopeta.quaternion.multiply(_q.setFromAxisAngle(_b.set(1, 0, 0), arma.retroceso * 0.22));
      escopeta.position.copy(m.pos).addScaledVector(arma.dir, -0.045 * arma.retroceso);
      escopeta.updateMatrixWorld(true);
      if (!m.pinza) arma.armado = true;
      if (m.empiezaPinza && arma.armado) disparar();
      // dejarla: puño/agarre con la escopeta junto a su sitio
      if (m.empiezaAgarre && est.t - arma.cogidaEn > 0.3 && escopeta.position.distanceTo(reposoPos) < 0.35) { dejar(); m.vibrar(0.3, 30); return; }
      // recarga rápida: la escopeta apuntando al mostrador (boca baja)
      const boca = bocaMundo(_c);
      if (arma.dir.y < -0.55 && boca.y < H + 0.45 && est.balas < TP.cargador && est.fase !== 'final') {
        est.bajando += dt;
        if (est.bajando > 0.2) { est.cadaCarga -= dt; if (est.cadaCarga <= 0) { est.cadaCarga = 0.12; cargarUno(true); } }
      } else { est.bajando = 0; est.cadaCarga = 0; }
      // la mira
      ponerMira();
    }
    function ponerMira() {
      if (est.fase === 'final' || est.balas <= 0) { mira.visible = false; return; }
      const p = bocaMundo(_a), v = _b.copy(arma.dir).multiplyScalar(TP.vCorcho), g = 9.8 * TP.gCorcho;
      const zObj = filas[1].z;
      let ok = false;
      for (let i = 0; i < 80; i++) {
        p.addScaledVector(v, 0.01); v.y -= g * 0.01;
        aLocal(p, _c);
        if (_c.z < zObj) { ok = true; break; }
        if (_c.y < 0 || _c.z > 0.5) break;
      }
      mira.visible = ok;
      if (ok) { mira.position.copy(p); mira.quaternion.copy(qC); }
    }

    // ---------- recarga a mano: corcho de la cajita → boca del cañón ----------
    function recargaManual() {
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!m.activa || m === arma.mano) continue;
        const lleva = agarre.lleva(m);
        if (!lleva && (m.empiezaPinza || m.empiezaAgarre) && est.fase !== 'final') {
          const caja = aMundo(PUNTO_CAJA, _a);
          if (Math.min(m.punta.distanceTo(caja), m.pos.distanceTo(caja)) < 0.13) {
            const c = nuevoCorcho(m.punta);
            agarre.poner(m, c);
            m.vibrar(0.35, 25); sonido('plop', { en: caja ? c.obj : grupo, volumen: 0.35, tono: 1.4 });
          }
        }
        if (lleva?.datos?.corcho && arma.mano && est.balas < TP.cargador && lleva.obj.position.distanceTo(bocaMundo(_b)) < 0.09) {
          agarre.soltar(m, false); quitarCorcho(lleva);
          cargarUno(false); m.vibrar(0.5, 35);
        }
      }
    }

    // ---------- choques de los corchos con la caseta (en su espacio local, por tramo) ----------
    const _A = V(), _B = V(), _P = V(), _vl = V();
    function primerChoque(A, B) {
      let mejor = null;
      const prueba = (t, tipo, obj) => { if (t >= 0 && t <= 1 && (!mejor || t < mejor.t)) mejor = { t, tipo, obj }; };
      const cruceZ = z => (A.z > z && B.z <= z) ? (A.z - z) / (A.z - B.z) : -1;
      const enT = (t, out) => out.copy(A).lerp(B, t);
      // patos: el plano de su fila, dentro de la elipse del cuerpo y por encima de la ola
      for (let i = 0; i < filas.length; i++) {
        const fl = filas[i];
        const t = cruceZ(fl.z + 0.01); if (t < 0) continue;
        enT(t, _P);
        for (const p of patos) {
          if (!p.vivo || p.fila !== i) continue;
          const cx = p.piv.position.x, cy = p.piv.position.y + p.h * 0.6;
          const rx = p.w * 0.47 + 0.02, ry = p.h * 0.42 + 0.02;
          if (_P.y > fl.olaTop - 0.02 && ((_P.x - cx) / rx) ** 2 + ((_P.y - cy) / ry) ** 2 < 1) prueba(t, 'pato', p);
        }
        // la tabla de la ola (delante de los patos)
        const tt = cruceZ(fl.zTabla);
        if (tt >= 0) { enT(tt, _P); if (_P.y < fl.olaTop && Math.abs(_P.x) < W) prueba(tt, 'tabla', fl); }
      }
      for (const o of intrusos) {
        if (!o.vivo) continue;
        const t = cruceZ(o.z); if (t < 0) continue;
        enT(t, _P);
        const alto = o.r.alto ?? 0.6, cy = o.y + alto * 0.5;
        if (((_P.x - o.x) / (alto * 0.45)) ** 2 + ((_P.y - cy) / (alto * 0.5)) ** 2 < 1) prueba(t, 'intruso', o);
      }
      { // el feriante
        const fp = feriante.position, t = cruceZ(fp.z);
        if (t >= 0) { enT(t, _P); if (Math.abs(_P.x - fp.x) < anchoFer * 0.4 && _P.y > 0.1 && _P.y < altoFer) prueba(t, 'feriante', null); }
      }
      { const t = cruceZ(TP.zFondo + 0.045); if (t >= 0) { enT(t, _P); if (_P.y < ALTO_FONDO && Math.abs(_P.x) < W) prueba(t, 'fondo', null); } }
      for (const s of [-1, 1]) {
        const x = s * (W - 0.015);
        if (s * A.x < s * x && s * B.x >= s * x) { const t = (x - A.x) / (B.x - A.x); enT(t, _P); if (_P.z < TP.zFrente) prueba(t, 'lado', s); }
      }
      if (A.y < 2.73 && B.y >= 2.73) { const t = (2.73 - A.y) / (B.y - A.y); enT(t, _P); if (_P.z < TP.zFrente && _P.z > Z_TECHO && Math.abs(_P.x) < W) prueba(t, 'techo', null); }
      return mejor;
    }
    function choques(c, dt) {
      const d = c.datos, pos = c.obj.position;
      aLocal(d.prev, _A); aLocal(pos, _B);
      const ch = primerChoque(_A, _B);
      if (ch) {
        _P.copy(_A).lerp(_B, Math.max(0, ch.t - 0.02));
        aMundo(_P, pos);
        _vl.copy(c.vel).applyQuaternion(qCi);
        const golpe = Math.abs(_vl.z);
        if (ch.tipo === 'pato') {
          acierto(ch.obj); resolverTiro(c, true);
          _vl.set(_vl.x * 0.3, 1.1, Math.abs(_vl.z) * 0.18);
        } else if (ch.tipo === 'intruso') {
          darIntruso(ch.obj); resolverTiro(c, true);
          _vl.set(_vl.x * 0.3, 0.8, Math.abs(_vl.z) * 0.2);
        } else if (ch.tipo === 'feriante') {
          resolverTiro(c, false);
          voz(voces.feriante, sacar('feriante', FRASES.feriante), 1.8); cambiarFeriante(false);
          sonido('bonk', { en: feriante, volumen: 0.5 });
          _vl.set(_vl.x * 0.3, 0.6, Math.abs(_vl.z) * 0.25);
        } else {
          resolverTiro(c, false);
          if (ch.tipo === 'lado') _vl.x = -_vl.x * 0.35;
          else if (ch.tipo === 'techo') _vl.y = -Math.abs(_vl.y) * 0.3;
          else _vl.z = Math.abs(_vl.z) * 0.3;
          if (golpe > 2) sonido('bonk', { en: c.obj, volumen: Math.min(0.35, golpe / 30), tono: ch.tipo === 'tabla' ? 1.2 : 0.9 });
        }
        c.vel.copy(_vl.applyQuaternion(qC));
        c.giro.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        d.vuela = false;
      }
      // el mostrador (caja sólida): empujar fuera por la cara más cercana
      aLocal(pos, _P);
      const r = c.radio;
      if (_P.x > -MOS.x - r && _P.x < MOS.x + r && _P.z > MOS.z0 - r && _P.z < MOS.z1 + r && _P.y < H + r && _P.y > 0) {
        const pen = [['y', H + r - _P.y, 1], ['z', MOS.z1 + r - _P.z, 1], ['z', _P.z - (MOS.z0 - r), -1], ['x', MOS.x + r - _P.x, 1], ['x', _P.x + MOS.x + r, -1]];
        pen.sort((a, b) => a[1] - b[1]);
        const [eje, cuanto, signo] = pen[0];
        _P[eje] += cuanto * signo;
        aMundo(_P, pos);
        _vl.copy(c.vel).applyQuaternion(qCi);
        if (_vl[eje] * signo < 0) {
          const f = Math.abs(_vl[eje]);
          _vl[eje] = f > 0.5 ? f * signo * 0.3 : 0;
          if (f > 0.8) sonido('bonk', { en: c.obj, volumen: Math.min(0.25, f / 15), tono: 1.8 });
          if (d.vuela) { d.vuela = false; resolverTiro(c, false); }
        }
        if (eje === 'y') { const k = Math.max(0, 1 - 10 * dt); _vl.x *= k; _vl.z *= k; c.giro.multiplyScalar(k); }
        c.vel.copy(_vl.applyQuaternion(qC));
      }
    }
    function actualizarCorchos(dt) {
      for (const c of [...corchos]) {
        const d = c.datos;
        d.edad += dt;
        if (c.cogido) { d.prev.copy(c.obj.position); d.vuela = false; continue; }
        if (d.vuela) {
          c.vel.y += 9.8 * (1 - TP.gCorcho) * dt; // gravedad rebajada mientras vuela
          c.obj.quaternion.setFromUnitVectors(ARRIBA, _a.copy(c.vel).normalize());
          d.rastro -= dt;
          if (d.rastro <= 0) { d.rastro = 0.025; humo.soltar({ pos: c.obj.position, tam: 0.014, vida: 0.5, crece: 0.04, sube: 0.02, frena: 1, brillo: 0.7, alfa: 0.55 }); }
          if (d.edad > 1.6) { d.vuela = false; resolverTiro(c, false); }
        }
        choques(c, dt);
        c.cogible = c.vel.lengthSq() < 2;
        // en el suelo un rato: se va (los del mostrador se quedan para recargar)
        if (c.obj.position.y < 0.06) { d.suelo += dt; if (d.suelo > 2.5) { quitarCorcho(c); continue; } } else d.suelo = 0;
        d.prev.copy(c.obj.position);
      }
      for (let i = saltarines.length - 1; i >= 0; i--) {
        const s = saltarines[i]; s.t += dt / 0.16;
        const hasta = bocaMundo(_b);
        s.malla.position.copy(s.desde).lerp(hasta, Math.min(1, s.t)); s.malla.position.y += Math.sin(Math.min(1, s.t) * Math.PI) * 0.12;
        s.malla.rotation.x += dt * 25;
        if (s.t >= 1) { grupo.remove(s.malla); saltarines.splice(i, 1); }
      }
    }

    // ---------- rondas ----------
    function empezarRonda() {
      if (est.acabado || est.destruido) return;
      est.ronda++;
      est.restante = TP.duracion * (noche.id === 'prisa' ? 0.8 : 1);
      est.balas = TP.cargador; pintarCorchos();
      est.intrusoT = 3 + Math.random() * 3;
      est.filaT = [0.2, 0.6, 0.3];
      ui.cartela(`¡Ronda ${est.ronda}!`, 1.6);
      sonido('tiroriro', { volumen: 0.5 });
      est.fase = 'ronda';
      if (est.ronda === 1) programar(0.4, () => feriantDice('inicio', true));
    }
    function finRonda() {
      est.fase = 'entre';
      for (const p of patos) { if (p.vivo) humoEn(new THREE.Vector3(p.piv.position.x, p.baseY + p.h * 0.6, p.z ?? p.piv.position.z), 2, p.tipo === 'oro'); quitarPato(p); }
      patos = [];
      for (const o of [...intrusos]) if (o.vivo) quitarIntruso(o);
      if (est.ronda >= TP.rondas) { programar(0.7, final); return; }
      programar(0.5, () => feriantDice(est.ronda === 1 ? 'ronda2' : 'ronda3', true));
      programar(2.1, empezarRonda);
    }
    function generar(dt) {
      const v = velocidad();
      TP.filas.forEach((f, i) => {
        est.filaT[i] -= dt;
        if (est.filaT[i] > 0) return;
        est.filaT[i] = (f.cada / v) * (0.75 + Math.random() * 0.6);
        nuevoPato(i, Math.random() < (noche.id === 'dorada' ? 0.16 : 0.06) + (est.ronda === 3 ? 0.06 : 0));
      });
      est.intrusoT -= dt;
      if (est.intrusoT <= 0) {
        est.intrusoT = (5.5 + Math.random() * 3) / (1 + 0.15 * (est.ronda - 1));
        intruso(sacar('intruso', ['perico', 'pompa']));
      }
    }
    function moverPatos(dt) {
      const viento = noche.id === 'viento' ? 3 : 1;
      patos = patos.filter(p => {
        if (p.cae >= 0) {
          // cae hacia atrás como los de chapa y se deshace en humo
          p.cae += dt;
          p.piv.rotation.x = -Math.min(1.5, p.cae * p.cae * 40);
          if (p.cae > 0.28) { humoEn(new THREE.Vector3(p.piv.position.x, p.baseY + p.h * 0.4, p.piv.position.z), p.tipo === 'oro' ? 9 : 5, p.tipo === 'oro'); quitarPato(p); return false; }
          return true;
        }
        p.piv.position.x += p.vx * dt;
        p.piv.position.y = p.baseY + Math.sin(est.t * 5 + p.fase) * 0.008 * viento;
        p.piv.rotation.z = Math.sin(est.t * 3 + p.fase) * 0.06 * viento;
        if (p.tipo === 'oro') p.mats.frente.color.setScalar(Math.sin(est.t * 22) > 0 ? 1 : 0.72);
        if (Math.abs(p.piv.position.x) > W + 0.4) { quitarPato(p); return false; }
        return true;
      });
      filas.forEach(fl => { fl.tex.offset.x -= dt * 0.12 * fl.dir; });
    }
    function moverIntrusos(dt) {
      for (const o of [...intrusos]) {
        o.t += dt;
        if (o.tipo === 'perico') {
          if (o.cae) { o.vy -= 9.8 * dt; o.y += o.vy * dt; o.r.grupo.rotation.z += dt * 7; if (o.y < -0.6) { quitarIntruso(o); continue; } }
          else { o.x += o.vx * dt; o.y = o.baseY + Math.sin(o.t * 4) * 0.08; if (Math.abs(o.x) > W + 0.35) { quitarIntruso(o); continue; } }
        } else if (o.cae) {
          o.y -= dt * 0.08; if (o.t > 3.9) { quitarIntruso(o); continue; }
        } else {
          o.y += o.vy * dt; o.x = o.baseX + Math.sin(o.t * 1.1 + o.fase) * 0.25;
          o.r.grupo.rotation.z = Math.sin(o.t * 1.5 + o.fase) * 0.14;
          if (o.y > H + 2) {
            // se va sin que nadie le haya preguntado nada, y saluda ahora
            if (Math.random() < 0.4 && est.fase === 'ronda') voz(voces.pompa, '…Hola.', 1.4);
            const r = o.r; o.vivo = false; intrusos.splice(intrusos.indexOf(o), 1);
            programar(1.4, () => { if (!intrusos.some(x => x.r === r)) r.grupo.visible = false; });
            continue;
          }
        }
        o.r.grupo.position.set(o.x, o.y, o.z);
      }
    }

    function final() {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'final';
      dejar(); ui.instruccion(null);
      for (const p of patos) quitarPato(p); patos = [];
      for (const o of [...intrusos]) quitarIntruso(o);
      const punteria = est.disparos ? est.aciertos / est.disparos : 0;
      const bono = est.disparos >= 10 ? Math.round(punteria * 200) : 0;
      est.puntos = Math.max(0, est.puntos + bono);
      if (bono) etiqueta(`Puntería +${bono}`, '#7ee081', new THREE.Vector3(0, H + 1.05, -2.2), 0.3);
      const umbrales = [600, 2200, 2800];
      const gana = est.puntos >= umbrales[0];
      const tres = est.puntos >= umbrales[2];
      if (gana) cambiarFeriante(true);
      let linea;
      if (tres) linea = `«¡Vuper, me has vaciado la caseta!» ${est.patos} patos, ${est.dorados} dorados y ${Math.round(punteria * 100)} % de puntería.`;
      else if (gana) linea = `${est.patos + est.dorados} patos de humo y ${Math.round(punteria * 100)} % de puntería. El peluche, «para otra noche».`;
      else linea = 'El feriante sopla otro pato y te lo deja delante. «Este, gratis. Por pena.»';
      if (est.dioPerico) linea += ' Perico sigue diciendo que no es un pato.';
      if (est.dioPompa) linea += ' La Pompa todavía está contestando.';
      pintarMarcador();
      programar(1.1, () => ctx.terminar({ puntos: est.puntos, gana, linea }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('minijuego');
    ui.instruccion('Coge la escopeta del mostrador');
    sonido('sting', { volumen: 0.45 });
    programar(1.2, () => voz(voces.feriante, '¡Pasen y tiren! Coja la escopeta.', 2.2));
    pintarMarcador();

    // para el bot (herramientas/pruebas/bots/tiropato.js)
    const api = {
      get fase() { return est.fase; }, get balas() { return est.balas; }, get puntos() { return est.puntos; },
      get ronda() { return est.ronda; }, get llevada() { return !!arma.mano; }, get aciertos() { return est.aciertos; },
      get disparos() { return est.disparos; }, get malos() { return est.malos; }, H, V: TP.vCorcho, G: 9.8 * TP.gCorcho,
      empunadura: () => escopeta.position.clone(), boca: () => bocaMundo(), caja: () => aMundo(PUNTO_CAJA),
      haciaDelante: () => new THREE.Vector3(0, 0, -1).applyQuaternion(qC),
      blancos: () => [
        ...patos.filter(p => p.vivo).map(p => ({ tipo: p.tipo, fila: p.fila, pos: aMundo(new THREE.Vector3(p.piv.position.x, p.baseY + p.h * 0.62, p.piv.position.z)), vel: new THREE.Vector3(p.vx, 0, 0).applyQuaternion(qC) })),
        ...intrusos.filter(o => o.vivo).map(o => ({ tipo: o.tipo, pos: aMundo(new THREE.Vector3(o.x, o.y + (o.r.alto ?? 0.6) * 0.5, o.z)), vel: new THREE.Vector3(o.vx, o.vy, 0).applyQuaternion(qC) })),
      ],
      // dirección para dar a un blanco que se mueve, desde la mano (con caída y adelanto)
      apuntarA(pos, vel, mano) {
        let dir = pos.clone().sub(mano).normalize();
        for (let i = 0; i < 4; i++) {
          const boca = mano.clone().addScaledVector(dir, 0.57);
          const t = pos.distanceTo(boca) / TP.vCorcho + 0.03;
          const p = pos.clone().addScaledVector(vel, t); p.y += 0.5 * 9.8 * TP.gCorcho * t * t;
          dir = p.sub(boca).normalize();
        }
        return dir;
      },
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.tp = api;

    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        if (fisica.planos.length) fisica.planos = []; // el juego los vuelve a poner cada segundo en el mundo normal
        est.cooldown -= dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        actualizarArma(dt);
        recargaManual();
        actualizarCorchos(dt);
        if (est.fase === 'ronda') {
          est.restante -= dt;
          generar(dt);
          if (est.restante <= 0) finRonda();
        }
        moverPatos(dt);
        moverIntrusos(dt);
        parpadear(dt);
        if (ferContento > 0) { ferContento -= dt; if (ferContento <= 0) cambiarFeriante(false); }
        ferT += dt; ferCarton.position.y = altoFer / 2 + Math.sin(ferT * 3.3) * 0.006;
        bocFer.actualizar(dt, altoFer, xr.cabeza, feriante);
        for (const r of [perico, pompa]) if (r?.grupo.visible) r.actualizar(dt, xr.cabeza);
        for (let i = etiquetas.length - 1; i >= 0; i--) {
          const e = etiquetas[i]; e.vida -= dt;
          e.s.position.y += dt * 0.28; e.s.material.opacity = Math.min(1, e.vida * 2.5);
          if (e.vida <= 0) { caseta.remove(e.s); e.s.material.map.dispose(); e.s.material.dispose(); etiquetas.splice(i, 1); }
        }
        pintarMarcador();
      },
      destruir() {
        est.destruido = true; eventos.length = 0;
        for (const c of [...corchos]) quitarCorcho(c);
        for (const s of saltarines) grupo.remove(s.malla);
        ui.instruccion(null);
        fisica.planos = planosAntes; fisica.caja = cajaAntes;
        for (const e of etiquetas) { e.s.material.map.dispose(); e.s.material.dispose(); }
        for (const t of texturasPropias) t.dispose();
        if (typeof window !== 'undefined' && window.__mj?.tp === api) window.__mj.tp = null;
      },
    };
  },
};
