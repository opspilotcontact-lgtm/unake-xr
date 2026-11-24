// El mueble de la recreativa: geometría barata (MeshBasic + colores por vértice con un sombreado «toon» horneado),
// contorno de tinta por casco invertido y el arte pintado en lienzos. Lo estático va fusionado en pocas mallas;
// lo que se mueve (palanca, botones) va suelto. ~20 llamadas de dibujo la máquina entera.
//
// Ejes locales de la máquina: origen en el suelo, en el centro de su planta; +Z mira al jugador; +Y arriba.
// Ejes locales del panel de mandos: x a la derecha, y hacia el fondo (hacia la pantalla), z = normal (arriba).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const COL = {
  morado: '#3b2a52', moradoOsc: '#2a1d3d', moradoClaro: '#5a4378', tinta: '#140c1c', rosa: '#ff5fa2', amarillo: '#ffd628',
  crema: '#fff3e6', cian: '#5fd3ff', verde: '#7ee081', lila: '#b68cff', rojo: '#ff4d4d', gris: '#8a7f99', apagado: '#3a3046',
};

// perfil del lateral (z, y): pie, panel inclinado, pantalla echada hacia atrás, marquesina
const PERFIL = [[-0.40, 0], [0.40, 0], [0.40, 0.82], [0.60, 0.88], [0.60, 0.95], [0.27, 1.03], [0.27, 1.08], [0.11, 1.66],
  [0.24, 1.70], [0.24, 1.95], [-0.40, 1.95]];
const HUECO = 0.80, LADO = 0.03;
export const ALTO_PANEL = 0.99; // centro del panel de pie
const ANG_PANEL = Math.atan2(0.08, 0.33), ANG_PANT = Math.atan2(0.16, 0.58);
export const PANT = { ancho: 0.70, alto: 0.70 * 9 / 16 };
export const SITIO_JUGADOR = new THREE.Vector3(0, 0, 0.88); // dónde quedan tus pies/ojos al jugar (local)

// mandos en coordenadas del panel (m)
export const MANDOS = {
  palanca: { x: -0.22, y: -0.03 },
  b1: { x: 0.05, y: -0.05, r: 0.034, color: COL.amarillo },
  b2: { x: 0.15, y: -0.03, r: 0.034, color: COL.rosa },
  b3: { x: 0.25, y: -0.05, r: 0.034, color: COL.cian },
  b4: { x: 0.335, y: 0.045, r: 0.026, color: COL.verde },
  encender: { x: -0.335, y: 0.115, r: 0.02, color: COL.rojo, txt: 'ENCENDER' },
  elegir: { x: -0.10, y: 0.115, r: 0.022, color: COL.lila, txt: 'ELEGIR' },
  start: { x: 0.06, y: 0.115, r: 0.022, color: COL.crema, txt: 'START' },
  salir: { x: 0.215, y: 0.125, r: 0.016, color: COL.gris, txt: 'SALIR' },
};
export const RECORRIDO = 0.012, ALTO_BOTON = 0.022;

const L = new THREE.Vector3(0.35, 0.85, 0.45).normalize();
const _c = new THREE.Color(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

// geometría «plana»: solo posición + color por vértice con tres bandas de luz (toon)
function hornear(geo, matriz, color, { luz = true, normalLocal = null } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(matriz);
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  if (matriz.determinant() < 0) { // una reflexión invierte el giro de los triángulos: se devuelve
    const a = p.array;
    for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) { const t = a[(i + 1) * 3 + k]; a[(i + 1) * 3 + k] = a[(i + 2) * 3 + k]; a[(i + 2) * 3 + k] = t; }
  }
  const base = new THREE.Color(color);
  for (let i = 0; i < n; i += 3) {
    let k = 1;
    if (luz) {
      _a.fromBufferAttribute(p, i + 1).sub(_n.fromBufferAttribute(p, i));
      _b.fromBufferAttribute(p, i + 2).sub(_n.fromBufferAttribute(p, i));
      const d = _a.cross(_b).normalize().dot(normalLocal || L);
      k = d > 0.62 ? 1.12 : d > 0.15 ? 0.92 : 0.7;
    }
    _c.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3; j++) { col[(i + j) * 3] = _c.r; col[(i + j) * 3 + 1] = _c.g; col[(i + j) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texturaDe(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function crearMueble() {
  const maquina = new THREE.Group(); maquina.name = 'recreativa';
  const cuerpo = new THREE.Group(); cuerpo.name = 'recreativa-cuerpo'; maquina.add(cuerpo); // baja si juegas sentado

  // ---------- el panel (su marco de referencia) ----------
  const panel = new THREE.Group(); panel.name = 'recreativa-panel';
  panel.position.set(0, ALTO_PANEL, (0.60 + 0.27) / 2);
  panel.rotation.x = -(Math.PI / 2 - ANG_PANEL);
  cuerpo.add(panel); panel.updateMatrix();
  const MP = panel.matrix.clone();
  const enPanel = (x, y, z, rx = 0) => MP.clone().multiply(M(x, y, z, rx));

  // ---------- lo estático fusionado ----------
  const piezas = [], cascos = [];
  const caja = (w, h, d, m, color, casco = true) => {
    piezas.push(hornear(new THREE.BoxGeometry(w, h, d), m, color));
    if (casco) cascos.push(hornear(new THREE.BoxGeometry(w + 0.016, h + 0.016, d + 0.016), m, COL.tinta, { luz: false }));
  };
  // laterales: el perfil extruido
  const forma = new THREE.Shape(PERFIL.map(([z, y]) => new THREE.Vector2(z, y)));
  const lat = new THREE.ExtrudeGeometry(forma, { depth: LADO, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const x = s > 0 ? HUECO / 2 : -HUECO / 2 - LADO;
    // la forma está en (X=z, Y=y): girar -90° en Y pasa X→-Z… se gira +90° y se refleja para que X sea z
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)).setPosition(x, 0, 0);
    piezas.push(hornear(lat, m, COL.morado));
    const mc = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1.02), new THREE.Vector3(0, 1.008, 0), new THREE.Vector3(1.5, 0, 0)).setPosition(x - LADO * 0.25, -0.006, 0.0);
    cascos.push(hornear(lat, mc, COL.tinta, { luz: false }));
  }
  caja(HUECO, 1.66, 0.46, M(0, 0.83, -0.17), COL.morado);                 // cajón trasero (acaba detrás de la pantalla)
  caja(HUECO, 0.74, 0.02, M(0, 0.45, 0.39), COL.morado);                  // frontal de abajo (lleva arte)
  caja(HUECO, 0.02, 0.21, M(0, 0.85, 0.50, -Math.atan2(0.06, 0.20)), COL.moradoOsc, false); // bajo el panel
  caja(HUECO + 0.08, 0.08, 0.84, M(0, 0.04, 0.0), COL.tinta, false);      // zócalo
  caja(HUECO, 0.28, 0.66, M(0, 1.81, -0.08), COL.morado);                 // caja de la marquesina
  caja(HUECO + 0.10, 0.03, 0.72, M(0, 1.965, -0.08), COL.moradoClaro);    // tapa con vuelo
  // el panel: tabla gruesa y su canto rosa
  piezas.push(hornear(new THREE.BoxGeometry(HUECO + 2 * LADO + 0.02, 0.36, 0.05), enPanel(0, 0, -0.025), COL.moradoOsc));
  cascos.push(hornear(new THREE.BoxGeometry(HUECO + 2 * LADO + 0.036, 0.376, 0.066), enPanel(0, 0, -0.025), COL.tinta, { luz: false }));
  piezas.push(hornear(new THREE.BoxGeometry(HUECO + 2 * LADO + 0.02, 0.05, 0.012), enPanel(0, -0.185, -0.03, Math.PI / 2), COL.rosa));
  // marco de la pantalla (va detrás del arte del bisel)
  const centroPant = new THREE.Vector3(0, (1.08 + 1.66) / 2, (0.27 + 0.11) / 2);
  piezas.push(hornear(new THREE.BoxGeometry(HUECO, 0.62, 0.03), M(centroPant.x, centroPant.y, centroPant.z - 0.016, -ANG_PANT), COL.tinta));
  // aros de los botones y la base de la palanca, en el panel
  for (const [k, b] of Object.entries(MANDOS)) {
    if (k === 'palanca') continue;
    piezas.push(hornear(new THREE.CylinderGeometry(b.r + 0.008, b.r + 0.011, 0.01, 22), enPanel(b.x, b.y, 0.004, Math.PI / 2), COL.tinta));
  }
  const domo = new THREE.SphereGeometry(0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  piezas.push(hornear(domo, enPanel(MANDOS.palanca.x, MANDOS.palanca.y, 0, Math.PI / 2), COL.tinta));
  const estaticos = new THREE.Mesh(mergeGeometries(piezas), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const contorno = new THREE.Mesh(mergeGeometries(cascos), new THREE.MeshBasicMaterial({ color: COL.tinta, side: THREE.BackSide }));
  estaticos.name = 'recreativa-mueble'; contorno.name = 'recreativa-contorno';
  cuerpo.add(estaticos, contorno);

  // ---------- arte pintado (un atlas para laterales, frontal y bisel) ----------
  const atlas = lienzo(1024, 1024);
  pintarAtlas(atlas.getContext('2d'));
  const texAtlas = texturaDe(atlas);
  const artes = [];
  // laterales: la forma del perfil con UV al trozo del atlas (izquierdo 0-256, derecho 256-512; derecho espejado)
  for (const s of [-1, 1]) {
    const g = new THREE.ShapeGeometry(forma);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const z = p.getX(i), y = p.getY(i);
      const u = s < 0 ? (z + 0.40) / 1.0 : (0.60 - z) / 1.0;
      uv.setXY(i, s < 0 ? u * 0.25 : 0.25 + u * 0.25, y / 1.95);
    }
    const x = s > 0 ? HUECO / 2 + LADO + 0.002 : -HUECO / 2 - LADO - 0.002;
    // forma X→z, Y→y, normal→±x. En el derecho es una reflexión: se invierte el giro de los triángulos
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(s, 0, 0)).setPosition(x, 0, 0);
    g.applyMatrix4(m);
    if (s > 0) g.index.array.reverse();
    artes.push(g);
  }
  const plano = (w, h, u0, v0, u1, v1, m) => {
    const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    g.applyMatrix4(m); return g;
  };
  artes.push(plano(HUECO, 0.74, 0.5, 0.5, 1, 1, M(0, 0.45, 0.401)));                                   // frontal
  artes.push(plano(HUECO, 0.62, 0.5, 0, 1, 0.5, M(centroPant.x, centroPant.y, centroPant.z, -ANG_PANT))); // bisel
  const arte = new THREE.Mesh(mergeGeometries(artes.map(g => g.index ? g.toNonIndexed() : g)), new THREE.MeshBasicMaterial({ map: texAtlas }));
  arte.name = 'recreativa-arte';
  cuerpo.add(arte);

  // ---------- marquesina iluminada ----------
  const cMarq = lienzo(1024, 288);
  const marquesina = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76 * 288 / 1024), new THREE.MeshBasicMaterial({ map: texturaDe(cMarq), toneMapped: false }));
  marquesina.position.set(0, 1.81, 0.253); marquesina.name = 'recreativa-marquesina';
  cuerpo.add(marquesina);

  // ---------- pantalla, cristal y punto de mira ----------
  const normalPant = new THREE.Vector3(0, Math.sin(ANG_PANT), Math.cos(ANG_PANT));
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(PANT.ancho, PANT.alto), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  pantalla.position.copy(centroPant).addScaledVector(normalPant, 0.004); pantalla.rotation.x = -ANG_PANT; pantalla.name = 'recreativa-pantalla';
  const cCrist = lienzo(256, 144); pintarCristal(cCrist.getContext('2d'));
  const cristal = new THREE.Mesh(new THREE.PlaneGeometry(PANT.ancho, PANT.alto), new THREE.MeshBasicMaterial({ map: texturaDe(cCrist), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  cristal.position.z = 0.003; cristal.renderOrder = 2; pantalla.add(cristal);
  const cMira = lienzo(64, 64); pintarMira(cMira.getContext('2d'));
  const mira = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), new THREE.MeshBasicMaterial({ map: texturaDe(cMira), transparent: true, depthWrite: false, toneMapped: false }));
  mira.position.z = 0.005; mira.renderOrder = 3; mira.visible = false; pantalla.add(mira);
  cuerpo.add(pantalla);

  // ---------- el panel: arte (cambia con el juego), palanca y botones ----------
  const cPanel = lienzo(1024, 448);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.80, 0.35), new THREE.MeshBasicMaterial({ map: texturaDe(cPanel) }));
  decal.position.z = 0.0015; decal.name = 'recreativa-panel-arte';
  panel.add(decal);

  const pivote = new THREE.Group(); pivote.position.set(MANDOS.palanca.x, MANDOS.palanca.y, 0.0);
  const varilla = hornear(new THREE.CylinderGeometry(0.0075, 0.0095, 0.115, 10), M(0, 0, 0.0575, Math.PI / 2), '#2b2433', { normalLocal: new THREE.Vector3(0, 0.3, 1).normalize() });
  const bolaG = hornear(new THREE.SphereGeometry(0.034, 18, 12), M(0, 0, 0.125), '#ffffff', { normalLocal: new THREE.Vector3(-0.3, 0.4, 1).normalize() });
  // la bola se tiñe con el color de la palanca: el blanco de los vértices × color
  const palo = new THREE.Mesh(mergeGeometries([varilla, bolaG]), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.0375, 14, 10), new THREE.MeshBasicMaterial({ color: COL.tinta, side: THREE.BackSide }));
  bola.position.z = 0.125;
  pivote.add(palo, bola); panel.add(pivote);
  palo.material.color.set(COL.rosa);

  const botones = {};
  const tapa = r => hornear(new THREE.CylinderGeometry(r, r * 1.04, ALTO_BOTON, 24), M(0, 0, ALTO_BOTON / 2, Math.PI / 2), '#ffffff', { normalLocal: new THREE.Vector3(0, 0.3, 1).normalize() });
  for (const [k, b] of Object.entries(MANDOS)) {
    if (k === 'palanca') continue;
    const malla = new THREE.Mesh(tapa(b.r), new THREE.MeshBasicMaterial({ vertexColors: true, color: COL.apagado }));
    malla.position.set(b.x, b.y, 0); malla.name = 'boton-' + k;
    panel.add(malla);
    botones[k] = { malla, ...b, hundido: 0, pulsado: false, forzado: false, luz: 0 };
  }

  // ---------- luz del monedero y sombra en el suelo ----------
  const moneda = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.105), new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  moneda.position.set(-0.059, 0.514, 0.403); moneda.name = 'recreativa-monedero';
  cuerpo.add(moneda);
  const cSombra = lienzo(64, 64); { const g = cSombra.getContext('2d'); const r = g.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(10,5,15,0.55)'); r.addColorStop(1, 'rgba(10,5,15,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cSombra), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.set(0, 0.003, 0.05); sombra.renderOrder = -1;
  maquina.add(sombra);

  return { maquina, cuerpo, panel, pantalla, cristal, mira, decal, cPanel, marquesina, cMarq, pivote, palo, botones, moneda };
}

// ---------- pintura ----------
function estrella(g, x, y, r, puntas = 5) {
  g.beginPath();
  for (let i = 0; i < puntas * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / puntas, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}
function rayas(g, x, y, w, h, n = 14, alfa = 0.25) {
  g.save(); g.strokeStyle = `rgba(255,243,230,${alfa})`; g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = x + Math.random() * w, b = y + Math.random() * h, l = 6 + Math.random() * 22, an = -0.6 + Math.random() * 0.5;
    g.beginPath(); g.moveTo(a, b); g.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); g.stroke();
  }
  g.restore();
}
function pintarAtlas(g) {
  g.fillStyle = COL.morado; g.fillRect(0, 0, 1024, 1024);
  // --- laterales (0-256 izq., 256-512 der.): 256 px = 1 m de fondo, 1024 px = 1,95 m de alto
  for (const s of [0, 1]) {
    g.save(); g.translate(s * 256, 0); g.beginPath(); g.rect(0, 0, 256, 1024); g.clip();
    // en este trozo la X va de la trasera (0) al frente (256) en el izquierdo; espejado en el derecho
    const frente = s ? 0 : 256, dir = s ? 1 : -1; // hacia dónde está el frente
    // dos franjas en diagonal, rosa y amarilla, que bajan hacia el frente
    for (const [col, off, w] of [[COL.rosa, 0, 30], [COL.amarillo, 44, 16]]) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(frente + dir * 10, 700 + off); g.lineTo(frente + dir * 10, 700 + off + w);
      g.lineTo(frente + dir * 270, 380 + off + w); g.lineTo(frente + dir * 270, 380 + off); g.closePath(); g.fill();
    }
    // el nombre en vertical (el trozo tiene la mitad de px por metro en horizontal: se compensa)
    g.save(); g.translate(frente + dir * 170, 860); g.rotate(-Math.PI / 2); g.scale(1, 0.49);
    g.font = '96px Caprasimo, serif'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = COL.tinta; g.fillStyle = COL.amarillo;
    g.strokeText('UNAKÉ', 0, 0); g.fillText('UNAKÉ', 0, 0); g.restore();
    // pegatina: estrella con el «¡humo!»
    g.save(); g.translate(frente + dir * 120, 1000 - 0.62 * 525); g.scale(0.49, 1); g.rotate(0.25 * dir);
    g.fillStyle = COL.tinta; estrella(g, 0, 0, 42); g.fill(); g.fillStyle = COL.rosa; estrella(g, 0, 0, 36); g.fill();
    g.fillStyle = COL.tinta; g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('¡HUMO!', 0, 5); g.restore();
    rayas(g, 0, 0, 256, 1024, 26, 0.22);
    g.restore();
  }
  // --- frontal (512-1024 × 0-512): 0,80 × 0,74 m → 640 px/m ancho, 692 px/m alto
  g.save(); g.translate(512, 0);
  g.fillStyle = COL.morado; g.fillRect(0, 0, 512, 512);
  g.fillStyle = COL.amarillo; g.fillRect(0, 0, 512, 14); g.fillStyle = COL.rosa; g.fillRect(0, 18, 512, 6);
  // altavoces
  for (const x of [96, 416]) {
    g.fillStyle = COL.tinta; g.beginPath(); g.arc(x, 92, 46, 0, 7); g.fill();
    g.fillStyle = '#2b2236'; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i * i + j * j <= 10) { g.beginPath(); g.arc(x + i * 11, 92 + j * 11, 3.2, 0, 7); g.fill(); }
  }
  // puerta del monedero
  const px = 166, py = 150, pw = 180, ph = 250;
  g.fillStyle = COL.tinta; g.fillRect(px - 6, py - 6, pw + 12, ph + 12);
  g.fillStyle = '#4a4058'; g.fillRect(px, py, pw, ph);
  g.strokeStyle = '#6f6582'; g.lineWidth = 3; g.strokeRect(px + 8, py + 8, pw - 16, ph - 16);
  for (const [x, t] of [[px + 52, '1 MONCHI'], [px + 128, '1 MONCHI']]) {
    g.fillStyle = COL.tinta; g.fillRect(x - 20, py + 30, 40, 64);
    g.fillStyle = '#7a3b10'; g.fillRect(x - 3, py + 40, 6, 44);
    g.fillStyle = COL.crema; g.font = 'bold 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(t, x, py + 116);
  }
  g.fillStyle = COL.amarillo; g.font = 'bold 17px system-ui, sans-serif'; g.fillText('INSERTE MONCHI', px + pw / 2, py + 160);
  g.fillStyle = COL.tinta; g.fillRect(px + pw / 2 - 26, py + 190, 52, 10); // cerradura
  // pegatinas
  g.save(); g.translate(78, 300); g.rotate(-0.18);
  g.fillStyle = COL.tinta; g.fillRect(-62, -26, 124, 52); g.fillStyle = COL.amarillo; g.fillRect(-58, -22, 116, 44);
  g.fillStyle = COL.tinta; g.font = 'bold 14px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('¡NO DAR', 0, -3); g.fillText('GOLPES!', 0, 14); g.restore();
  g.save(); g.translate(440, 330); g.rotate(0.2);
  g.fillStyle = COL.tinta; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.fillStyle = COL.cian; g.beginPath(); g.arc(0, 0, 35, 0, 7); g.fill();
  g.fillStyle = COL.tinta; g.font = '22px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('100%', 0, -2); g.font = 'bold 11px system-ui, sans-serif'; g.fillText('MONCHIS', 0, 15); g.restore();
  rayas(g, 0, 0, 512, 512, 40, 0.28);
  g.restore();
  // --- bisel de la pantalla (512-1024 × 512-1024): 0,80 × 0,62 m → 640 × 496 px (el resto, tinta)
  g.save(); g.translate(512, 512);
  g.fillStyle = COL.tinta; g.fillRect(0, 0, 512, 512);
  const sy = 512 / 0.62; // px por metro en vertical en este trozo (640 en horizontal)
  const ventW = 0.70 * 640, ventH = 0.394 * sy, vx = (512 - ventW) / 2, vy = (512 - ventH) / 2;
  g.strokeStyle = COL.rosa; g.lineWidth = 6; g.strokeRect(vx - 9, vy - 9, ventW + 18, ventH + 18);
  g.strokeStyle = COL.amarillo; g.lineWidth = 2; g.strokeRect(vx - 16, vy - 16, ventW + 32, ventH + 32);
  g.fillStyle = COL.crema; g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('1 JUGADOR', vx - 10, vy - 26);
  g.textAlign = 'right'; g.fillStyle = COL.amarillo; g.fillText('★ ★ ★', vx + ventW + 10, vy - 26);
  g.textAlign = 'center'; g.fillStyle = COL.rosa; g.font = '26px Caprasimo, serif'; g.fillText('UNAKÉ', 256, vy + ventH + 50);
  g.restore();
}
function pintarCristal(g) {
  g.clearRect(0, 0, 256, 144);
  const r = g.createLinearGradient(0, 0, 256, 144);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.28, 'rgba(255,255,255,0)'); r.addColorStop(0.33, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.42, 'rgba(255,255,255,0.08)'); r.addColorStop(0.47, 'rgba(255,255,255,0.32)'); r.addColorStop(0.52, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 144);
  const v = g.createRadialGradient(128, 72, 40, 128, 72, 150); v.addColorStop(0, 'rgba(120,90,160,0)'); v.addColorStop(1, 'rgba(120,90,160,0.35)');
  g.fillStyle = v; g.fillRect(0, 0, 256, 144);
}
function pintarMira(g) {
  g.lineWidth = 7; g.strokeStyle = COL.tinta; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke();
  g.lineWidth = 4; g.strokeStyle = COL.amarillo; g.beginPath(); g.arc(32, 32, 20, 0, 7); g.stroke();
  g.fillStyle = COL.rosa; g.beginPath(); g.arc(32, 32, 5, 0, 7); g.fill();
  g.strokeStyle = COL.amarillo; g.lineWidth = 3;
  for (const [a, b, c, d] of [[32, 2, 32, 10], [32, 54, 32, 62], [2, 32, 10, 32], [54, 32, 62, 32]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
}

// arte del panel: rótulos de cada botón (según el juego), halos de los que valen y la rejilla de la palanca
export function pintarPanel(c, { rotulos = {}, luces = {}, palanca = '', t = 0 } = {}) {
  const g = c.getContext('2d'), S = 1280; // px por metro
  const X = x => (x + 0.40) * S, Y = y => (0.175 - y) * S;
  g.fillStyle = COL.moradoOsc; g.fillRect(0, 0, c.width, c.height);
  // rayado suave y franjas
  g.save(); g.globalAlpha = 0.08; g.strokeStyle = COL.rosa; g.lineWidth = 10;
  for (let i = -500; i < 1100; i += 46) { g.beginPath(); g.moveTo(i, 448); g.lineTo(i + 300, 0); g.stroke(); }
  g.restore();
  g.fillStyle = COL.amarillo; g.fillRect(0, 436, 1024, 12); g.fillStyle = COL.rosa; g.fillRect(0, 426, 1024, 5);
  g.fillStyle = COL.tinta; g.fillRect(0, 0, 1024, 6);
  // zona de la palanca
  const px = X(MANDOS.palanca.x), py = Y(MANDOS.palanca.y);
  g.fillStyle = 'rgba(20,12,28,0.65)'; g.beginPath(); g.arc(px, py, 92, 0, 7); g.fill();
  g.strokeStyle = palanca ? COL.rosa : '#4a3d5c'; g.lineWidth = 4; g.beginPath(); g.arc(px, py, 92, 0, 7); g.stroke();
  g.fillStyle = palanca ? COL.crema : '#6a5d7c';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.save(); g.translate(px + Math.cos(a) * 76, py - Math.sin(a) * 76); g.rotate(-a); g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, -7); g.lineTo(-5, 7); g.closePath(); g.fill(); g.restore(); }
  const texto = (s, x, y, tam, col, max = 200) => {
    if (!s) return;
    let t2 = tam; g.font = `bold ${t2}px system-ui, sans-serif`;
    while (g.measureText(s).width > max && t2 > 12) { t2 -= 1; g.font = `bold ${t2}px system-ui, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = COL.tinta; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  };
  texto(palanca || '', px, py + 118, 28, COL.crema, 280);
  // botones: halo si vale y rótulo debajo
  for (const [k, b] of Object.entries(MANDOS)) {
    if (k === 'palanca') continue;
    const x = X(b.x), y = Y(b.y), r = b.r * S;
    const luz = luces[k] || 0;
    if (luz > 0) {
      const h = g.createRadialGradient(x, y, r * 0.9, x, y, r * 2.1);
      h.addColorStop(0, b.color); h.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = Math.min(1, luz) * 0.85; g.fillStyle = h; g.beginPath(); g.arc(x, y, r * 2.1, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    const rot = rotulos[k] ?? b.txt ?? '';
    const arriba = ['encender', 'elegir', 'start', 'salir'].includes(k);
    texto(rot, x, y + r + (arriba ? 22 : 30), arriba ? 22 : 27, luz > 0 ? (arriba ? COL.crema : b.color) : '#7d708f', arriba ? 150 : 128);
  }
  void t;
}

// la marquesina: «RECREATIVA» o la misión
export function pintarMarquesina(c, { texto = 'RECREATIVA', sub = '', encendida = true, brillo = 1 } = {}) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = COL.rosa; g.fillRect(0, 0, w, h);
  g.save(); g.globalAlpha = 0.35; g.fillStyle = COL.amarillo;
  for (let i = 0; i < 9; i++) { estrella(g, 60 + i * 115, i % 2 ? 40 : h - 40, 20); g.fill(); }
  g.restore();
  g.strokeStyle = COL.tinta; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let tam = sub ? 92 : 128; g.font = `${tam}px Caprasimo, serif`;
  while (g.measureText(texto).width > w - 80 && tam > 40) { tam -= 4; g.font = `${tam}px Caprasimo, serif`; }
  const y = sub ? h * 0.40 : h * 0.54;
  g.lineWidth = 14; g.strokeStyle = COL.tinta; g.strokeText(texto, w / 2, y);
  g.fillStyle = COL.amarillo; g.fillText(texto, w / 2, y);
  if (sub) {
    let t2 = 50; g.font = `bold ${t2}px system-ui, sans-serif`;
    while (g.measureText(sub).width > w - 80 && t2 > 22) { t2 -= 2; g.font = `bold ${t2}px system-ui, sans-serif`; }
    g.lineWidth = 8; g.strokeText(sub, w / 2, h * 0.78); g.fillStyle = COL.crema; g.fillText(sub, w / 2, h * 0.78);
  }
  if (!encendida || brillo < 1) { g.fillStyle = `rgba(20,12,28,${encendida ? 1 - brillo : 0.45})`; g.fillRect(0, 0, w, h); }
}
