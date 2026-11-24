// La cabina de la furgo de Palicaso · compartida por «La furgo» (furgo.js) y «El control» (control.js).
//
// Vas SENTADO al volante. La cabina se monta alrededor de tu cabeza al empezar y ya no se mueve: lo que se mueve es la
// carretera (y todo lo de fuera) hacia ti. Nunca se toca la cámara.
// Ejes locales de la cabina: −z = hacia delante, +x = a tu derecha, y = alto desde tu suelo. Tu cabeza, en (0, H, 0).
//   · volante a 0,36 m delante y por debajo de los ojos, se coge con pellizco o puño (mandos: gatillo o lateral);
//   · ventanilla del conductor a tu izquierda con su manivela; guantera y gafas en el salpicadero;
//   · banco del copiloto a tu derecha (dos plazas) y un asiento detrás para el tercero.
// Todo lo estático va en DOS mallas (color por vértice + contorno de tinta): el coste de dibujo es casi nada.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TINTA = '#140c1c', PAPEL = '#fffaf0';
export const V = () => new THREE.Vector3();
export const clamp = THREE.MathUtils.clamp;
export const azar = l => l[Math.floor(Math.random() * l.length)];
// baraja sin repetir hasta agotar (criterio §4)
export function bolsa(lista) { let b = []; return () => { if (!b.length) b = [...lista].sort(() => Math.random() - 0.5); return b.pop(); }; }

// Los que pueden subir a la furgo (los del 2D, mismo orden) y su recortable.
export const ACOMP_ORDEN = ['palicaso', 'lasslow', 'perico', 'cotine', 'pompa', 'blancaso', 'puky'];
export const ACOMP = {
  palicaso: { nombre: 'Palicaso', rec: 'palicaso', alt: 'contando', color: '#ffd23f' },
  lasslow: { nombre: 'Lasslow', rec: 'lasslow', alt: 'risa-floja', color: '#ffb38a' },
  perico: { nombre: 'Perico', rec: 'perico', alt: 'silbando', color: '#d0d4dc' },
  cotine: { nombre: 'Cotine', rec: 'cotine', alt: 'plop', color: '#ff8fc0' },
  pompa: { nombre: 'La Pompa', rec: 'la-pompa', alt: 'a-punto-de-reventar', color: '#9fe7ff' },
  blancaso: { nombre: 'Blancaso', rec: 'blancaso', alt: 'mareado', color: '#bfe8ff' },
  puky: { nombre: 'Puky', rec: 'puky', alt: 'que-rico', color: '#f5d23a' },
};
export const MAX_ACOMP = 3;

// Paso de «La furgo» a «El control» mientras el motor de historia no lo haga (ESTADO.furgoAcompanantes en el 2D).
export const CLAVE_ACOMP = 'unake-xr-furgo-acompanantes';
// Primero lo que mande el juego (ctx.datos.acompanantes, p. ej. ESTADO.furgoAcompanantes del motor); si no, localStorage.
export function leerAcompanantes(ctx) {
  const d = ctx?.datos?.acompanantes;
  if (Array.isArray(d)) return d.filter(id => ACOMP[id]).slice(0, MAX_ACOMP);
  try { const l = JSON.parse(localStorage.getItem(CLAVE_ACOMP) || 'null'); if (Array.isArray(l)) return l.filter(id => ACOMP[id]).slice(0, MAX_ACOMP); } catch { /* sin almacenamiento */ }
  return null;
}
export function guardarAcompanantes(l) { try { localStorage.setItem(CLAVE_ACOMP, JSON.stringify(l)); } catch { /* sin almacenamiento */ } }

export function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, g, t };
}
export function envolver(g, texto, ancho) {
  const out = []; let l = '';
  for (const p of texto.split(' ')) { const pr = l ? l + ' ' + p : p; if (g.measureText(pr).width > ancho && l) { out.push(l); l = p; } else l = pr; }
  if (l) out.push(l);
  return out;
}

// ---------- piezas estáticas: todo a una malla con color por vértice y otra de contorno ----------
function piezas() {
  const col = [], tin = [];
  const limpia = g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g.index ? g.toNonIndexed() : g; };
  const pintar = (g, color) => {
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  const mat = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  return {
    caja(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0, t = 0.007) {
      const m = mat(x, y, z, rx, ry, rz);
      col.push(pintar(limpia(new THREE.BoxGeometry(w, h, d)).applyMatrix4(m), color));
      if (t) tin.push(limpia(new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t)).applyMatrix4(m));
    },
    geo(g, gTinta, color, m) {
      col.push(pintar(limpia(g).applyMatrix4(m), color));
      if (gTinta) tin.push(limpia(gTinta).applyMatrix4(m));
    },
    mat,
    mallas() {
      const a = new THREE.Mesh(mergeGeometries(col), new THREE.MeshBasicMaterial({ vertexColors: true }));
      const b = new THREE.Mesh(mergeGeometries(tin), new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }));
      return [a, b];
    },
  };
}

// ---------- texturas de fuera (dibujadas aquí, estilo serie) ----------
function texCarretera() {
  const { c, g, t } = lienzo(512, 512);
  g.fillStyle = '#2b2840'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < 0.5 ? '#34304c' : '#25223a'; g.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 14, 3); }
  g.strokeStyle = '#1a1726'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) { g.beginPath(); let x = 60 + Math.random() * 400, y = Math.random() * 512; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 50; y += 20 + Math.random() * 30; g.lineTo(x, y); } g.stroke(); }
  const px = 512 / 11; // 11 m de ancho: arcén 1 m, tres carriles de 3 m, arcén 1 m
  g.fillStyle = '#41e0e8'; g.fillRect(0, 0, px * 0.25, 512);
  g.fillStyle = '#ff5fc8'; g.fillRect(512 - px * 0.25, 0, px * 0.25, 512);
  g.fillStyle = '#fff6e8'; g.fillRect(px * 1 - 5, 0, 10, 512); g.fillRect(px * 10 - 5, 0, 10, 512);
  g.fillStyle = '#ffd23f';
  for (const x of [px * 4, px * 7]) for (let y = 0; y < 512; y += 512 / 3) g.fillRect(x - 6, y + 20, 12, 90);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texCampo() {
  const { g, t } = lienzo(256, 256);
  g.fillStyle = '#16302f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() < 0.5 ? '#1d3c38' : '#122826'; g.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 16, 4); }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function texCielo() {
  const { g, t } = lienzo(64, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#0b0818'); gr.addColorStop(0.42, '#1d1538'); gr.addColorStop(0.5, '#4a2d63'); gr.addColorStop(0.53, '#2a2045'); gr.addColorStop(1, '#120d22');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,246,232,${0.4 + Math.random() * 0.6})`; g.fillRect(Math.random() * 64, Math.random() * 220, 1.2, 1.2); }
  return t;
}
function texCiudad() {
  const { g, t } = lienzo(1024, 128);
  let x = 0;
  while (x < 1024) {
    const w = 30 + Math.random() * 60, h = 30 + Math.random() * 80;
    g.fillStyle = '#0f0b1d'; g.fillRect(x, 128 - h, w, h);
    g.fillStyle = '#ffd23f';
    for (let yy = 128 - h + 8; yy < 120; yy += 12) for (let xx = x + 5; xx < x + w - 6; xx += 10) if (Math.random() < 0.3) g.fillRect(xx, yy, 4, 5);
    x += w + Math.random() * 20;
  }
  // la noria de la feria, a lo lejos
  g.strokeStyle = '#ff5fa2'; g.lineWidth = 3; g.beginPath(); g.arc(700, 62, 40, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(700, 62); g.lineTo(700 + Math.cos(a) * 40, 62 + Math.sin(a) * 40); g.stroke(); }
  return t;
}
function texArbol() {
  const { g, t } = lienzo(128, 256);
  g.fillStyle = TINTA; g.fillRect(56, 150, 18, 106); g.fillStyle = '#5a3a28'; g.fillRect(60, 150, 10, 106);
  for (const [x, y, r] of [[64, 92, 52], [40, 120, 34], [88, 118, 34]]) { g.fillStyle = TINTA; g.beginPath(); g.arc(x, y, r + 5, 0, 7); g.fill(); }
  for (const [x, y, r] of [[64, 92, 52], [40, 120, 34], [88, 118, 34]]) { g.fillStyle = '#1f5a46'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = '#2a7a5c'; g.beginPath(); g.arc(50, 74, 18, 0, 7); g.fill();
  return t;
}
function texFarola() {
  const { g, t } = lienzo(128, 512);
  const r = g.createRadialGradient(64, 60, 4, 64, 60, 62); r.addColorStop(0, 'rgba(255,214,90,.7)'); r.addColorStop(1, 'rgba(255,214,90,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.fillStyle = TINTA; g.fillRect(56, 60, 16, 452); g.fillStyle = '#6b5f86'; g.fillRect(60, 60, 8, 452);
  g.fillStyle = TINTA; g.beginPath(); g.arc(64, 60, 16, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(64, 60, 11, 0, 7); g.fill();
  return t;
}

// ======================================================================================
// crearCabina(ctx) → la cabina montada (en `raiz`), con su carretera, volante, manivela, guantera y gafas.
export async function crearCabina(ctx) {
  const { xr } = ctx;
  const propias = [];
  const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };
  const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
  const H = clamp(xr.cabeza.y, 0.95, 1.85); // tu cabeza: sentado ~1,15; de pie ~1,6 (vale igual)
  const raiz = new THREE.Group(); raiz.name = 'cabina';
  raiz.position.set(xr.cabeza.x, 0, xr.cabeza.z); raiz.rotation.y = Math.atan2(-fw.x, -fw.z);
  raiz.updateMatrixWorld(true);
  const aLocal = (v, out = V()) => raiz.worldToLocal(out.copy(v));
  const aMundo = (v, out = V()) => raiz.localToWorld(out.copy(v));

  const [imgGafas, ...imgEus] = await Promise.all([
    ctx.img('obj-acc-gafas.png'),
    ...['obj-eusebio.png', 'obj-eusebio-dormido.png', 'obj-eusebio-susto.png', 'obj-eusebio-feliz.png', 'obj-eusebio-peluche.png', 'obj-eusebio-pipas.png'].map(n => ctx.img(n).catch(() => null)),
  ]);
  const texEus = { normal: imgEus[0], dormido: imgEus[1], susto: imgEus[2], feliz: imgEus[3], peluche: imgEus[4], pipas: imgEus[5] };

  // ---------- la cabina (estática) ----------
  const P = piezas();
  const MORADO = '#4a3670', MORADO_O = '#2f2446', ROSA = '#e0559b', AMARILLO = '#ffd23f', ASIENTO = '#c94f8a';
  P.caja(2.3, 0.04, 2.2, '#2a2236', 0.45, -0.02, 0.25, 0, 0, 0, 0);                       // suelo
  P.caja(2.1, 0.44, 0.42, MORADO_O, 0.45, H - 0.53, -0.69);                                  // salpicadero
  P.caja(2.1, 0.05, 0.5, MORADO, 0.45, H - 0.3, -0.72, 0.14);                                // su tapa acolchada
  P.caja(2.1, Math.max(0.1, H - 0.75), 0.08, '#231a36', 0.45, (H - 0.75) / 2, -0.86, 0, 0, 0, 0); // bajo el salpicadero
  P.caja(0.28, 0.12, 0.02, '#5b3a8c', 0.36, H - 0.42, -0.475);                               // guantera
  P.caja(0.05, 0.02, 0.025, AMARILLO, 0.36, H - 0.39, -0.46, 0, 0, 0, 0.004);                // su tirador
  P.caja(0.06, 0.06, 0.3, '#1a1426', 0, H - 0.47, -0.5, -0.45);                              // columna del volante
  for (const x of [-0.62, 1.52]) {
    P.caja(0.07, 0.72, 0.07, ROSA, x, H + 0.04, -0.8, -0.32);                                // montantes del parabrisas
    P.caja(0.06, Math.max(0.2, H - 0.27), 1.25, ROSA, x + (x < 0 ? -0.03 : 0.03), (H - 0.22) / 2 + 0.03, -0.05); // puertas
    P.caja(0.09, 0.04, 1.25, AMARILLO, x + (x < 0 ? 0.01 : -0.01), H - 0.22, -0.05);        // repisa de la ventanilla
    P.caja(0.07, 0.62, 0.07, ROSA, x, H + 0.07, 0.58);                                       // montante de atrás
  }
  P.caja(2.25, 0.05, 2.0, '#3d2d5c', 0.45, H + 0.42, 0.25, 0, 0, 0, 0);                      // techo
  P.caja(2.25, 0.09, 0.1, ROSA, 0.45, H + 0.37, -0.74);                                       // travesaño del parabrisas
  P.caja(0.24, 0.07, 0.03, '#1a1426', 0.18, H + 0.27, -0.66);                                 // retrovisor
  P.caja(0.2, 0.05, 0.005, '#8fb7e0', 0.18, H + 0.27, -0.648, 0, 0, 0, 0);
  P.caja(1.0, 0.12, 0.5, ASIENTO, 1.0, H - 0.68, 0.05);                                       // banco del copiloto
  P.caja(1.0, 0.62, 0.1, ASIENTO, 1.0, H - 0.37, 0.34, -0.1);
  P.caja(1.7, 0.12, 0.5, ASIENTO, 0.55, H - 0.64, 0.86);                                      // asiento de atrás
  P.caja(1.7, 0.6, 0.1, ASIENTO, 0.55, H - 0.32, 1.12, -0.1);
  P.caja(2.25, H + 0.4, 0.04, '#3d2d5c', 0.45, (H + 0.4) / 2, 1.22, 0, 0, 0, 0);             // pared de atrás
  // el pino del retrovisor (cuelga quieto: nada que se mueva solo en tu vista)
  P.geo(new THREE.ConeGeometry(0.03, 0.08, 4), new THREE.ConeGeometry(0.036, 0.09, 4), '#3fa34d', P.mat(0.12, H + 0.17, -0.65));
  const [cabMalla, cabTinta] = P.mallas();
  raiz.add(cabMalla, cabTinta);

  // ---------- el volante (gira sobre su eje; se coge con las dos manos) ----------
  const R_VOL = 0.17;
  const volBase = new THREE.Group(); volBase.position.set(0, H - 0.36, -0.36); volBase.rotation.x = -0.45; raiz.add(volBase);
  const volante = new THREE.Group(); volBase.add(volante);
  {
    const Q = piezas();
    Q.geo(new THREE.TorusGeometry(R_VOL, 0.018, 8, 36), new THREE.TorusGeometry(R_VOL, 0.026, 8, 36), '#231c33', new THREE.Matrix4());
    Q.geo(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), new THREE.CylinderGeometry(0.057, 0.057, 0.04, 16), '#2f2446', Q.mat(0, 0, 0.005, Math.PI / 2));
    Q.geo(new THREE.CylinderGeometry(0.022, 0.022, 0.035, 12), null, AMARILLO, Q.mat(0, 0, 0.01, Math.PI / 2));
    Q.caja(R_VOL * 2 - 0.02, 0.022, 0.012, '#2f2446', 0, 0, 0);
    Q.caja(0.022, R_VOL - 0.01, 0.012, '#2f2446', 0, -R_VOL / 2, 0);
    Q.caja(0.03, 0.02, 0.02, AMARILLO, 0, R_VOL, 0.004, 0, 0, 0, 0.004); // marca de arriba: se ve cuánto has girado
    const [a, b] = Q.mallas(); volante.add(a, b);
  }

  // ---------- la ventanilla del conductor y su manivela ----------
  const VENT = { x: -0.615, y0: H - 0.22, alto: 0.58, z0: -0.62, z1: 0.52 };
  const cristal = new THREE.Mesh(new THREE.PlaneGeometry(VENT.z1 - VENT.z0, VENT.alto), new THREE.MeshBasicMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  cristal.rotation.y = Math.PI / 2; cristal.position.set(VENT.x - 0.02, VENT.y0 + VENT.alto / 2, (VENT.z0 + VENT.z1) / 2);
  cristal.renderOrder = 5; raiz.add(cristal);
  const manBase = new THREE.Group(); manBase.position.set(-0.58, H - 0.43, -0.14); raiz.add(manBase);
  const manivela = new THREE.Group(); manBase.add(manivela);
  {
    const Q = piezas();
    Q.geo(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), null, '#6b5f86', Q.mat(0, 0, 0, 0, 0, Math.PI / 2));
    Q.caja(0.014, 0.075, 0.014, '#cfc6e0', 0.012, -0.035, 0, 0, 0, 0, 0.004);
    Q.geo(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), new THREE.CylinderGeometry(0.019, 0.019, 0.058, 10), AMARILLO, Q.mat(0.04, -0.07, 0, 0, 0, Math.PI / 2));
    const [a, b] = Q.mallas(); manivela.add(a, b);
  }
  const POMO = new THREE.Vector3(0.04, -0.07, 0); // el pomo, en local de la manivela

  // ---------- gafas, Don Eusebio, el marcador y el pie de texto ----------
  const GAFAS_SITIO = new THREE.Vector3(0.2, H - 0.285, -0.52);
  const gafas = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.0645), new THREE.MeshBasicMaterial({ map: imgGafas, alphaTest: 0.4, side: THREE.DoubleSide }));
  gafas.position.copy(GAFAS_SITIO); gafas.rotation.x = -1.1; raiz.add(gafas);
  const eus = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.113), new THREE.MeshBasicMaterial({ map: texEus.dormido || texEus.normal, alphaTest: 0.4 }));
  eus.position.set(0.56, H - 0.22, -0.62);
  eus.rotation.set(-0.35, -0.6, 0); raiz.add(eus);
  let eusEstado = 'dormido', eusVuelve = 0;
  const eusebio = (estado, seg = 0) => { const t = texEus[estado] || texEus.normal; if (t) eus.material.map = t; eus.material.needsUpdate = true; eusEstado = estado; eusVuelve = seg; eus.position.y = H - 0.2; };

  const pieL = lz(768, 200);
  const pie = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.0885), new THREE.MeshBasicMaterial({ map: pieL.t, transparent: true, depthWrite: false }));
  pie.position.set(0.5, H - 0.1, -0.62); pie.rotation.set(-0.15, -0.55, 0); pie.visible = false; pie.renderOrder = 8; raiz.add(pie);
  let pieVida = 0;
  function ponerPie(texto, seg = 3.6) {
    if (!texto) return;
    const { c, g, t } = pieL; g.clearRect(0, 0, c.width, c.height);
    g.font = 'italic 34px Caprasimo, serif';
    const ls = envolver(g, texto, c.width - 60).slice(0, 4);
    const alto = ls.length * 40 + 28;
    g.fillStyle = 'rgba(20,12,28,.78)'; g.beginPath(); g.roundRect(6, (c.height - alto) / 2, c.width - 12, alto, 22); g.fill();
    g.fillStyle = '#fff3e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (ls.length - 1) / 2) * 40));
    t.needsUpdate = true; pie.visible = true; pieVida = seg;
  }

  // ---------- etiquetas que suben y se van (¡PLAM!, +20…) ----------
  const etiquetas = [];
  function etiqueta(texto, color, posLocal, tam = 0.3, vida = 1.1) {
    const l = lz(512, 128);
    l.g.font = '84px Caprasimo, serif'; l.g.textAlign = 'center'; l.g.textBaseline = 'middle';
    l.g.lineWidth = 16; l.g.strokeStyle = TINTA; l.g.strokeText(texto, 256, 66); l.g.fillStyle = color; l.g.fillText(texto, 256, 66);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam / 4), new THREE.MeshBasicMaterial({ map: l.t, transparent: true, depthWrite: false, depthTest: false }));
    s.renderOrder = 30; s.position.copy(posLocal);
    s.lookAt(aMundo(new THREE.Vector3(0, H, 0))); // lookAt usa el mundo: la cabina está quieta, así que vale
    raiz.add(s); etiquetas.push({ s, vida, total: vida, l });
    if (etiquetas.length > 4) quitarEtiqueta(etiquetas[0]);
  }
  function quitarEtiqueta(e) { raiz.remove(e.s); e.s.geometry.dispose(); e.s.material.dispose(); e.l.t.dispose(); propias.splice(propias.indexOf(e.l.t), 1); etiquetas.splice(etiquetas.indexOf(e), 1); }

  // ---------- fuera: cielo, ciudad lejana, campo, carretera, árboles y farolas ----------
  const mundo = new THREE.Group(); mundo.name = 'carretera'; mundo.position.y = -0.55; raiz.add(mundo);
  const texC = texCarretera(), texK = texCampo(), texS = texCielo(), texU = texCiudad(), texA = texArbol(), texF = texFarola();
  propias.push(texC, texK, texS, texU, texA, texF);
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(72, 16, 10), new THREE.MeshBasicMaterial({ map: texS, side: THREE.BackSide, depthWrite: false, fog: false }));
  cielo.renderOrder = -10; mundo.add(cielo);
  const ciudad = new THREE.Mesh(new THREE.CylinderGeometry(62, 62, 12, 24, 1, true, Math.PI - 1.3, 2.6), new THREE.MeshBasicMaterial({ map: texU, side: THREE.BackSide, alphaTest: 0.5, fog: false }));
  ciudad.position.y = 4.6; mundo.add(ciudad);
  const LARGO = 84, Z0 = 8; // la cámara ve hasta 80 m
  const fundido = (geo, lejos) => { // vértices lejanos hacia el color del horizonte (sin niebla de escena)
    const p = geo.attributes.position, a = new Float32Array(p.count * 3), c = new THREE.Color(), hz = new THREE.Color('#2a2045');
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const f = clamp((-z - 22) / lejos, 0, 1); c.set('#ffffff').lerp(hz, f); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  };
  const geoCarr = new THREE.PlaneGeometry(11, LARGO, 1, 12); geoCarr.rotateX(-Math.PI / 2); geoCarr.translate(0, 0, Z0 - LARGO / 2); fundido(geoCarr, 48);
  texC.repeat.set(1, LARGO / 12);
  const carretera = new THREE.Mesh(geoCarr, new THREE.MeshBasicMaterial({ map: texC, vertexColors: true, fog: false }));
  carretera.position.y = 0.01; mundo.add(carretera);
  const geoCampo = new THREE.PlaneGeometry(150, LARGO, 1, 12); geoCampo.rotateX(-Math.PI / 2); geoCampo.translate(0, 0, Z0 - LARGO / 2); fundido(geoCampo, 48);
  texK.repeat.set(19, LARGO / 8);
  const campo = new THREE.Mesh(geoCampo, new THREE.MeshBasicMaterial({ map: texK, vertexColors: true, fog: false })); mundo.add(campo);
  // árboles y farolas: dos mallas instanciadas que corren hacia ti
  const geoPlano = new THREE.PlaneGeometry(1, 1); geoPlano.translate(0, 0.5, 0);
  const N_LADO = 7, PASO = 12;
  const arboles = new THREE.InstancedMesh(geoPlano, new THREE.MeshBasicMaterial({ map: texA, alphaTest: 0.5, fog: false }), N_LADO * 2);
  const farolas = new THREE.InstancedMesh(geoPlano, new THREE.MeshBasicMaterial({ map: texF, alphaTest: 0.08, transparent: true, depthWrite: false, fog: false }), N_LADO);
  arboles.frustumCulled = farolas.frustumCulled = false;
  mundo.add(arboles, farolas);
  const deco = [];
  for (let i = 0; i < N_LADO * 2; i++) { const lado = i % 2 ? 1 : -1; deco.push({ m: arboles, i, x: lado * (8 + Math.random() * 6), z: Z0 - (i / 2) * PASO - Math.random() * 5, w: 3 + Math.random(), h: 6 + Math.random() * 2 }); }
  for (let i = 0; i < N_LADO; i++) deco.push({ m: farolas, i, x: i % 2 ? 6.4 : -6.4, z: Z0 - i * PASO - 4, w: 1.2, h: 5.6 });
  const _m4 = new THREE.Matrix4(), _p = V(), _q = new THREE.Quaternion(), _s = V();
  function pintarDeco() {
    for (const d of deco) { _m4.compose(_p.set(d.x, 0, d.z), _q.identity(), _s.set(d.w, d.h, 1)); d.m.setMatrixAt(d.i, _m4); }
    arboles.instanceMatrix.needsUpdate = farolas.instanceMatrix.needsUpdate = true;
  }
  pintarDeco();
  const carr = { v: 0, recorrido: 0, desplX: 0 };
  function avanzar(dt) {
    const d = carr.v * dt; if (!d) return;
    carr.recorrido += d;
    texC.offset.y = (texC.offset.y + d / 12) % 1;
    texK.offset.y = (texK.offset.y + d / 8) % 1;
    for (const o of deco) { o.z += d; if (o.z > Z0) o.z -= N_LADO * PASO; }
    pintarDeco();
  }

  // ---------- asientos (dónde va cada acompañante) ----------
  const ASIENTOS = [
    { pos: new THREE.Vector3(0.6, H - 0.63, 0.0), escala: 0.68 },     // copiloto, a tu derecha
    { pos: new THREE.Vector3(1.04, H - 0.63, 0.04), escala: 0.68 },   // el de la ventanilla derecha
    { pos: new THREE.Vector3(0.38, H - 0.59, 0.82), escala: 0.72 },   // detrás, asomado entre los asientos
  ];
  const PARABRISAS = { z: -0.9, y: H + 0.05 }; // Puky va pegado aquí, por fuera
  function sentar(r, i) {
    const a = ASIENTOS[i];
    r.grupo.position.copy(a.pos); r.grupo.scale.setScalar(a.escala);
    r.enAsiento = true; r.sombra.visible = false;
    const d = new THREE.Vector3(0, H, 0).sub(a.pos); r.grupo.rotation.set(0, Math.atan2(d.x, d.z), 0);
    if (r.grupo.parent !== raiz) raiz.add(r.grupo);
  }

  // ---------- el volante con las manos ----------
  const vol = { ang: 0, manos: { derecha: null, izquierda: null }, vueltas: 0 };
  const _l = V();
  const enVolante = p => volBase.worldToLocal(_l.copy(p));
  function actualizarVolante(dt) {
    for (const lado of ['derecha', 'izquierda']) {
      const m = xr.manos[lado], s = vol.manos[lado];
      const gesto = m.activa && (m.pinza || m.agarre);
      const l = enVolante(m.pos), r = Math.hypot(l.x, l.y), a = Math.atan2(l.y, l.x);
      // con seguimiento de manos el pellizco parpadea y la mano tiembla: más margen de gracia y de distancia, y vale
      // cerrar la mano ANTES de llegar al aro (con mandos hay que apretar ya en el aro)
      const mano = !!m.esMano, margen = mano ? 0.12 : 0.085, gracia = mano ? 0.35 : 0.2;
      if (s) {
        if (gesto) s.gracia = gracia; else s.gracia -= dt;
        if (s.gracia <= 0 || !m.activa || Math.abs(r - R_VOL) > 0.22 || Math.abs(l.z) > 0.22) { vol.manos[lado] = null; continue; }
        let d = a - s.a; d = Math.atan2(Math.sin(d), Math.cos(d)); s.a = a;
        if (mano && r < 0.05) d = 0; // cerca del eje el ángulo de la mano no significa nada (temblaría el volante)
        s.d = d;
      } else if (gesto && (m.empiezaPinza || m.empiezaAgarre || mano) && Math.abs(r - R_VOL) < margen && Math.abs(l.z) < margen + 0.02) {
        vol.manos[lado] = { a, d: 0, gracia }; m.vibrar(0.5, 40);
      }
    }
    const sj = ['derecha', 'izquierda'].map(k => vol.manos[k]).filter(Boolean);
    if (sj.length) {
      const d = sj.reduce((t, s) => t + s.d, 0) / sj.length; for (const s of sj) s.d = 0;
      vol.ang = clamp(vol.ang - d, -1.7, 1.7);
    } else vol.ang -= Math.sign(vol.ang) * Math.min(Math.abs(vol.ang), 2.4 * dt); // suelto, vuelve al centro
    volante.rotation.z = -vol.ang;
  }

  // ---------- la manivela (y abanicar junto a la ventanilla) ----------
  const man = { mano: null, a: 0, giro: 0, abierta: 0, abanico: 0, cerrarEn: 0 };
  const _k = V();
  const enManivela = p => manBase.worldToLocal(_k.copy(p));
  function actualizarManivela(dt) {
    if (man.mano) {
      const m = xr.manos[man.mano], l = enManivela(m.pos);
      const gesto = m.activa && (m.pinza || m.agarre);
      if (gesto) man.gracia = m.esMano ? 0.35 : 0.2; else man.gracia -= dt;
      if (man.gracia <= 0 || !m.activa || l.length() > (m.esMano ? 0.26 : 0.22)) man.mano = null;
      else {
        const a = Math.atan2(-l.z, -l.y); let d = a - man.a; d = Math.atan2(Math.sin(d), Math.cos(d)); man.a = a;
        manivela.rotation.x += d; man.giro += Math.abs(d); man.cerrarEn = 1.6;
        if (Math.abs(d) > 0.05) m.vibrar(0.15, 15);
      }
    } else {
      for (const lado of ['izquierda', 'derecha']) {
        const m = xr.manos[lado]; if (!m.activa || !(m.empiezaPinza || m.empiezaAgarre || (m.esMano && (m.pinza || m.agarre)))) continue;
        const pomo = manivela.localToWorld(_k.copy(POMO)), tol = m.esMano ? 0.11 : 0.08;
        if (m.pos.distanceTo(pomo) < tol || enManivela(m.pos).length() < tol - 0.01) { const l = enManivela(m.pos); man.mano = lado; man.a = Math.atan2(-l.z, -l.y); man.gracia = 0.2; m.vibrar(0.5, 40); break; }
      }
    }
    // abanicar: mano rápida junto a la ventanilla
    const centroV = aMundo(_k.set(VENT.x + 0.12, VENT.y0 + 0.25, -0.1));
    for (const lado of ['izquierda', 'derecha']) {
      const m = xr.manos[lado];
      if (m.activa && m.pos.distanceTo(centroV) < 0.38 && m.vel.length() > 1.1) { man.abanico += dt; man.cerrarEn = Math.max(man.cerrarEn, 0.8); }
    }
    man.abanico = Math.max(0, man.abanico - dt * 0.25);
    // la ventanilla baja con lo girado (una vuelta entera = abajo del todo) y sube sola si la dejas
    if (man.cerrarEn > 0) man.cerrarEn -= dt; else man.giro = Math.max(0, man.giro - dt * 2.5);
    man.giro = Math.min(man.giro, Math.PI * 2);
    man.abierta = man.giro / (Math.PI * 2);
    cristal.position.y = VENT.y0 + VENT.alto / 2 - man.abierta * (VENT.alto - 0.04);
  }

  function actualizar(dt) {
    avanzar(dt);
    actualizarVolante(dt);
    actualizarManivela(dt);
    if (eusVuelve > 0 && (eusVuelve -= dt) <= 0) eusebio('normal');
    eus.position.y += (H - 0.22 - eus.position.y) * Math.min(1, dt * 8);
    if (pieVida > 0 && (pieVida -= dt) <= 0) pie.visible = false;
    for (let i = etiquetas.length - 1; i >= 0; i--) {
      const e = etiquetas[i]; e.vida -= dt; e.s.position.y += dt * 0.12; e.s.material.opacity = Math.min(1, e.vida * 3);
      if (e.vida <= 0) quitarEtiqueta(e);
    }
  }

  return {
    raiz, H, aLocal, aMundo, mundo, carr, propias, lz,
    volante: vol, volBase, R_VOL,
    manivela: man, manBase, pomo: () => manivela.localToWorld(V().copy(POMO)), cristal, VENT,
    // dónde estaría el pomo con la manivela girada `a` radianes (para los bots)
    pomoEn: a => manBase.localToWorld(V().copy(POMO).applyAxisAngle(new THREE.Vector3(1, 0, 0), a)),
    get anguloManivela() { return manivela.rotation.x; },
    gafas, GAFAS_SITIO, guantera: new THREE.Vector3(0.36, H - 0.42, -0.46),
    eusebio, get eusEstado() { return eusEstado; }, ponerPie, etiqueta,
    ASIENTOS, PARABRISAS, sentar,
    actualizar,
    // un punto del aro del volante (ángulo en radianes desde las 3 en punto, contando el giro actual) — para los bots
    puntoVolante(a) { return volBase.localToWorld(V().set(Math.cos(a - vol.ang) * R_VOL, Math.sin(a - vol.ang) * R_VOL, 0)); },
    destruir() {
      for (const e of [...etiquetas]) quitarEtiqueta(e);
      for (const t of propias) t.dispose();
      // (los recortables los quita cada juego antes: comparten geometría entre todos)
      const limpiar = o => { if (o.name.startsWith('recortable-')) return; if (o.isMesh) o.geometry?.dispose?.(); o.children.forEach(limpiar); };
      limpiar(raiz);
    },
  };
}
