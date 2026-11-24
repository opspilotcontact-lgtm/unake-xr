// El cuarto de Vuper en VR (base/js/escenas/barrio.js → SALAS.cuarto: `armario`, `taller`; y la fila de estrellas y
// récords de cada minijuego). Tres muebles de cartón alrededor de donde te sientas:
//   · EL ARMARIO (a tu izquierda): dos puertas que abres con la mano (coge el tirador y tira, giran sobre la bisagra).
//     Dentro, en dos barras, las prendas y pieles del 2D (ARMARIO de base/js/armario.js) colgadas de su percha con su
//     etiqueta. Coges una y te la llevas AL PECHO para probártela: si no la tienes se cobra (como el 2D: precio, puerta
//     por acto, sumarStat('prendas')), y Vuper la lleva (ESTADO.armario.puesto, así que el bono del 2D —bonoArmario—
//     ya cuenta en los cobros y en el hambre). Si ya la llevas puesta, al pecho = quitártela. Sin monchis o sin abrir
//     aún (acto), la prenda no se despega: tiembla y te lo dice. En la cara de dentro de la puerta izquierda hay un
//     espejo con Vuper y lo que lleva (anclas del 2D: ANCLAS_ARMARIO/ANCLAS_PRENDA, modo humo).
//   · EL TALLER (a tu derecha): una mesa con los INVENTOS del 2D como planos azules. Coges un plano = lo compras
//     (motor.comprarInvento) y el invento se monta detrás de su plano. Si ya lo tienes, te recuerda qué hace.
//   · EL CORCHO (enfrente, más lejos): una polaroid por minijuego (MISIONES) con sus ★ y su récord. Las estrellas que
//     aún no habías visto aquí brillan; al mirarlas un rato se dan por vistas (ESTADO.corchoVisto, campo del XR).
//     Tócala con el dedo y te dice nivel y récord.
//
//   const c = new Cuarto({ motor, sonido, ui, xr, agarre });
//   c.alVestir = ({ prenda, puesta, compra }) => …;   c.alInventar = invento => …;   // opcionales
//   await c.montar(grupoSala, posLocal, haciaLocal, { armario, taller, corcho });   // posLocal: DONDE TE SIENTAS (suelo);
//      haciaLocal: un punto (local) hacia el que miras. Las opciones (opcionales) cambian el sitio de cada mueble:
//      { pos: Vector3 en el marco «tú en el origen mirando a −z», mira?: Vector3 (por defecto, hacia ti) }.
//   c.actualizar(dt, [xr.manos.derecha, xr.manos.izquierda]);   c.quitar();   c.estado() (bots)
//
// Coste: muebles 2 (cuerpo + casco) + puertas 2 + espejo 1 + una prenda = 1 (11) + un invento = 1 (5) + cartel 1
// + corcho 1 + brillo 1 → 24 llamadas de dibujo.
import * as THREE from 'three';
import { textura } from '../recursos.js';

const COL = { tinta: '#140c1c', carton: '#c8925a', cartonOsc: '#9c6b3c', cartonClaro: '#dcae78', rosa: '#ff5fa2', amarillo: '#ffd628', crema: '#fff3e6', verde: '#7ee081', azul: '#8fd3ff', gris: '#8a7fa0', morado: '#3b2a52', moradoClaro: '#5a4378', madera: '#7a4f2a', corcho: '#c79a62', plano: '#2f5d9e' };
const FUENTE = 'Caprasimo, serif';

// --- medidas (m) ---
const AW_ = 0.8, AH_ = 1.32, AD = 0.36;           // armario
const BARRAS = [1.17, 0.78];                       // alto de las dos barras
// abiertas casi planas (163°): así no tapan el corcho, que queda a su derecha
const PUERTA_W = AW_ / 2 - 0.005, PUERTA_H = AH_ - 0.08, ABIERTA = 2.85;
const PRENDA_W = 0.118, PRENDA_H = PRENDA_W * 384 / 256;
const MESA_Y = 0.66, MESA_W = 0.95, MESA_D = 0.5; // taller
const PLANO_W = 0.16, PLANO_H = 0.2, FIGURA = 0.17;
const CORCHO_W = 1.42, CORCHO_H = CORCHO_W * 1280 / 2048, CORCHO_Y = 1.32;
const ALCANCE = 0.09, AL_PECHO = 0.17;
// dónde va cada mueble (tú en el origen, mirando a −z). Sentado: lo que se coge, a ≤ 0,7 m. El armario, casi de lado
// (85° a tu izquierda) para que sus puertas abiertas no tapen el corcho; el taller a 65° a tu derecha (medido con fotos).
const SITIO = { armario: new THREE.Vector3(-0.777, 0, -0.068), taller: new THREE.Vector3(0.68, 0, -0.317), corcho: new THREE.Vector3(0.14, 0, -1.18) };

// Anclas del 2D (armario.js, modo humo: Vuper es la nube) por si el puente no las da.
const ANCLAS = { cabeza: [0.8, 0.5, 1], ojos: [0.6, 0.56, 0.5], cuello: [0.13, 0.5, 0.5] };
const ANCLAS_P = { cadena: [0.24, 0.3, 0], cascos: [0.14, 0.66, 0.5] };

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
async function imagen(nombre) {
  for (const ext of ['.png', '.jpg']) { try { return (await textura('base/assets/img/' + nombre + ext)).image; } catch { /* la siguiente */ } }
  return null;
}
function encajar(ctx, im, x, y, w, h, abajo = false) { // dibuja la imagen dentro de la caja, sin deformar
  const k = Math.min(w / im.width, h / im.height), dw = im.width * k, dh = im.height * k;
  ctx.drawImage(im, x + (w - dw) / 2, abajo ? y + h - dh : y + (h - dh) / 2, dw, dh);
}
function textoCabe(ctx, t, x, y, max, tam) { // una línea que encoge hasta caber
  let s = tam; ctx.font = `${s}px ${FUENTE}`;
  while (ctx.measureText(t).width > max && s > 12) { s -= 2; ctx.font = `${s}px ${FUENTE}`; }
  ctx.fillText(t, x, y);
}
function envolver(ctx, t, max) {
  const out = []; let l = '';
  for (const p of t.split(' ')) { const n = l ? l + ' ' + p : p; if (ctx.measureText(n).width > max && l) { out.push(l); l = p; } else l = n; }
  if (l) out.push(l); return out;
}
function estrella(ctx, x, y, r, llena) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = llena ? COL.amarillo : '#3d3350'; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.22); ctx.strokeStyle = COL.tinta; ctx.stroke();
}
// Vuper con el tinte de la piel (el 2D usa setTint: multiplica). neón y arcoíris se pintan en franjas.
function tintar(im, tinte) {
  const c = lienzo(im.width, im.height), x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  if (tinte != null) {
    x.globalCompositeOperation = 'multiply';
    if (tinte === 'neon') { const g = x.createLinearGradient(0, 0, im.width, 0); g.addColorStop(0, '#7ff3ff'); g.addColorStop(1, '#ff8ad8'); x.fillStyle = g; }
    else if (tinte === 'arcoiris') { const g = x.createLinearGradient(0, 0, im.width, im.height); ['#ff9ad5', '#ffd36b', '#b8ff9a', '#8fd3ff', '#c9a0ff'].forEach((k, i) => g.addColorStop(i / 4, k)); x.fillStyle = g; }
    else x.fillStyle = '#' + Number(tinte).toString(16).padStart(6, '0');
    x.fillRect(0, 0, im.width, im.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  }
  return c;
}

// ---------- cartón: cajas con color por vértice (toon horneado), como tienda.js ----------
const L = new THREE.Vector3(0.35, 0.85, 0.45).normalize();
function hornear(geo, matriz, color, luz = true) {
  const g = geo.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(matriz);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), base = new THREE.Color(color), c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    let k = 1;
    if (luz) { o.fromBufferAttribute(p, i); a.fromBufferAttribute(p, i + 1).sub(o); b.fromBufferAttribute(p, i + 2).sub(o); const d = a.cross(b).normalize().dot(L); k = d > 0.62 ? 1.12 : d > 0.15 ? 0.92 : 0.7; }
    c.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3; j++) c.toArray(col, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const Mt = (x, y, z, ry = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
function unir(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return r;
}
// un quad con su trozo de atlas: x,y,w,h en px del atlas (AW×AH); la geometría va de -w/2..w/2 y de y0..y0+alto
function quadAtlas(ancho, alto, px, AW, AH, y0 = 0) {
  const g = new THREE.PlaneGeometry(ancho, alto); g.translate(0, y0 + alto / 2, 0);
  const [x, y, w, h] = px, u0 = x / AW, u1 = (x + w) / AW, v1 = 1 - y / AH, v0 = 1 - (y + h) / AH;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2));
  return g;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Cuarto {
  constructor({ motor, sonido = () => { }, ui = null, xr, agarre = null }) {
    Object.assign(this, { motor, sonido, ui, xr, agarre });
    this.alVestir = null;    // ({ prenda, puesta, compra }) cuando te pones / quitas / compras una prenda
    this.alInventar = null;  // (invento) al comprar un invento
    this.g = null; this.puertas = []; this.prendas = []; this.inventos = []; this.llevadas = []; this.agarres = new Map();
    this._t = 0; this._mirar = 0; this._clave = ''; this._claveC = ''; this._visto = 0; this._toque = { k: null, t: 0 };
    this._avisoPecho = false;
  }

  // ---------- datos del 2D (por el puente; el motor falso de cuarto.html da lo mismo) ----------
  _ev(n) { try { return this.motor.d?.puente?.ev(n); } catch { return undefined; } }
  get E() { return this.motor.E; }
  _armario() { const f = this._ev('armario'); if (typeof f === 'function') return f(); const E = this.E; E.armario = E.armario || { tiene: {}, puesto: {}, vista: {} }; return E.armario; }
  _abierta(p) { const f = this._ev('prendaAbierta'); return typeof f === 'function' ? !!f(p) : !p.desde; }
  _acto(p) { const f = this._ev('actoDePrenda'); return typeof f === 'function' ? f(p) : ''; }

  async montar(grupo, posLocal = new THREE.Vector3(), haciaLocal = null, op = {}) {
    const g = this.g = new THREE.Group(); g.name = 'cuarto-vuper';
    g.position.copy(posLocal);
    if (haciaLocal) g.rotation.y = Math.atan2(-(haciaLocal.x - posLocal.x), -(haciaLocal.z - posLocal.z));
    grupo.add(g);
    const sitio = (k, alto = 0) => {
      const s = op[k] || {}, p = (s.pos || SITIO[k]).clone(), m = s.mira || new THREE.Vector3(0, 0, 0);
      const sg = new THREE.Group(); sg.name = k; sg.position.copy(p); sg.position.y = alto;
      sg.rotation.y = Math.atan2(m.x - p.x, m.z - p.z); g.add(sg); return sg;
    };
    this.gA = sitio('armario'); this.gT = sitio('taller'); this.gC = sitio('corcho');
    g.updateMatrixWorld(true);
    // datos
    this.lista = (this.motor.d?.ARMARIO || this._ev('ARMARIO') || []).slice(0, 16);
    this.anclas = this._ev('ANCLAS_ARMARIO')?.humo || ANCLAS;
    const ap = this._ev('ANCLAS_PRENDA'); this.anclasP = ap ? Object.fromEntries(Object.entries(ap).map(([k, v]) => [k, v.humo])) : ANCLAS_P;
    this.listaInv = (this.motor.d?.INVENTOS || []).slice(0, 7);
    const MIS = this.motor.d?.MISIONES || {};
    this.misiones = Object.keys(MIS).map(k => ({ clave: k, ...MIS[k] })).slice(0, 40);
    // imágenes del 2D
    this.imgs = {};
    const nombres = new Set(['vuper', ...this.lista.filter(p => p.sprite).map(p => p.sprite), ...this.listaInv.map(i => i.sprite), ...this.misiones.map(m => m.sprite)]);
    await Promise.all([...nombres].map(async n => { this.imgs[n] = await imagen(n); }));
    this._muebles();
    this._armarioDentro();
    this._taller();
    this._corcho();
    this._redibujar(true);
    return this;
  }

  // ---------- muebles (un solo cuerpo de cartón para los tres + su casco de tinta) ----------
  _muebles() {
    const piezas = [], cascos = [];
    const en = (sg, m) => new THREE.Matrix4().compose(sg.position, sg.quaternion, _v.set(1, 1, 1)).multiply(m);
    const caja = (sg, w, h, d, m, color, casco = true) => {
      const M = en(sg, m);
      piezas.push(hornear(new THREE.BoxGeometry(w, h, d), M, color));
      if (casco) cascos.push(hornear(new THREE.BoxGeometry(w + 0.016, h + 0.016, d + 0.016), M, COL.tinta, false));
    };
    // armario: fondo, lados, techo, zócalo, suelo y las dos barras
    const A = this.gA;
    caja(A, AW_, AH_, 0.02, Mt(0, AH_ / 2, -AD / 2 + 0.01), COL.cartonOsc);
    caja(A, 0.02, AH_, AD, Mt(-AW_ / 2 + 0.01, AH_ / 2, 0), COL.carton);
    caja(A, 0.02, AH_, AD, Mt(AW_ / 2 - 0.01, AH_ / 2, 0), COL.carton);
    caja(A, AW_ + 0.05, 0.05, AD + 0.05, Mt(0, AH_ + 0.025, 0), COL.cartonClaro);
    caja(A, AW_, 0.08, AD, Mt(0, 0.04, 0), COL.tinta, false);
    caja(A, AW_ - 0.04, 0.02, AD - 0.03, Mt(0, 0.4, 0), COL.cartonOsc, false);
    for (const y of BARRAS) caja(A, AW_ - 0.04, 0.016, 0.016, Mt(0, y, 0.03), COL.tinta, false);
    caja(A, AW_ + 0.05, 0.03, 0.012, Mt(0, AH_ - 0.02, AD / 2 + 0.03), COL.rosa, false); // cinta rosa del techo
    // taller: tablero, patas, frente rosa, tablero de atrás y flexo
    const T = this.gT;
    caja(T, MESA_W, 0.04, MESA_D, Mt(0, MESA_Y - 0.02, 0), COL.carton);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) caja(T, 0.045, MESA_Y - 0.04, 0.045, Mt(x * (MESA_W / 2 - 0.05), (MESA_Y - 0.04) / 2, z * (MESA_D / 2 - 0.05)), COL.cartonOsc);
    caja(T, MESA_W - 0.04, 0.05, 0.012, Mt(0, MESA_Y - 0.06, MESA_D / 2), COL.rosa, false);
    caja(T, MESA_W, 0.5, 0.02, Mt(0, MESA_Y + 0.25, -MESA_D / 2 + 0.01), COL.moradoClaro);
    caja(T, 0.02, 0.36, 0.02, Mt(MESA_W / 2 - 0.08, MESA_Y + 0.18, -MESA_D / 2 + 0.08), COL.tinta, false);
    caja(T, 0.12, 0.05, 0.08, Mt(MESA_W / 2 - 0.13, MESA_Y + 0.36, -MESA_D / 2 + 0.11, 0, 0.4), COL.amarillo);
    // corcho: marco de madera y dos patas de caballete
    const C = this.gC;
    caja(C, CORCHO_W + 0.08, CORCHO_H + 0.08, 0.04, Mt(0, CORCHO_Y, -0.03), COL.madera);
    for (const x of [-1, 1]) caja(C, 0.05, CORCHO_Y + 0.1, 0.05, Mt(x * (CORCHO_W / 2 - 0.1), (CORCHO_Y + 0.1) / 2, -0.08), COL.madera);
    const cuerpo = new THREE.Mesh(unir(piezas), new THREE.MeshBasicMaterial({ vertexColors: true }));
    const casco = new THREE.Mesh(unir(cascos), new THREE.MeshBasicMaterial({ color: COL.tinta, side: THREE.BackSide }));
    cuerpo.name = 'cuarto-muebles'; casco.name = 'cuarto-casco';
    this.g.add(cuerpo, casco);
  }

  // ---------- armario: puertas, espejo y prendas ----------
  _armarioDentro() {
    const A = this.gA, matCarton = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.matPuerta = matCarton;
    for (const lado of [-1, 1]) { // −1 izquierda (bisagra a la izquierda), +1 derecha
      const piv = new THREE.Group(); piv.position.set(lado * AW_ / 2, 0.06, AD / 2 + 0.012); A.add(piv);
      const cx = -lado * PUERTA_W / 2, h = PUERTA_H, geos = [];
      geos.push(hornear(new THREE.BoxGeometry(PUERTA_W + 0.014, h + 0.014, 0.012), Mt(cx, h / 2, -0.006), COL.tinta, false));
      geos.push(hornear(new THREE.BoxGeometry(PUERTA_W, h, 0.02), Mt(cx, h / 2, 0), COL.carton));
      geos.push(hornear(new THREE.BoxGeometry(PUERTA_W - 0.09, h - 0.16, 0.006), Mt(cx, h / 2, 0.012), COL.cartonClaro));
      geos.push(hornear(new THREE.BoxGeometry(PUERTA_W - 0.01, h - 0.01, 0.004), Mt(cx, h / 2, -0.014), COL.cartonOsc)); // cara de dentro
      geos.push(hornear(new THREE.BoxGeometry(0.03, 0.16, 0.035), Mt(-lado * (PUERTA_W - 0.045), 0.72, 0.025), COL.tinta, false)); // tirador
      geos.push(hornear(new THREE.BoxGeometry(0.03, 0.03, 0.03), Mt(-lado * (PUERTA_W - 0.045), 0.72, 0.046), COL.amarillo, false));
      const m = new THREE.Mesh(unir(geos), matCarton); m.name = 'puerta-armario'; piv.add(m);
      this.puertas.push({ lado, piv, a: 0, mano: null, tirador: new THREE.Vector3(-lado * (PUERTA_W - 0.045), 0.72, 0.03), sonoAbrir: false });
    }
    // espejo en la cara de dentro de la puerta izquierda (se ve al abrirla)
    this.espejoC = lienzo(256, 384);
    this.espejoT = new THREE.CanvasTexture(this.espejoC); this.espejoT.colorSpace = THREE.SRGBColorSpace;
    const esp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.45), new THREE.MeshBasicMaterial({ map: this.espejoT }));
    esp.position.set(-PUERTA_W / 2, 0.68, -0.0175); esp.rotation.y = Math.PI; esp.name = 'espejo';
    this.puertas[1].piv.add(esp);
    // prendas en dos barras: arriba cabeza y ojos; abajo cuello y pieles
    this.atlasA = lienzo(2048, 1024);
    this.texA = new THREE.CanvasTexture(this.atlasA); this.texA.colorSpace = THREE.SRGBColorSpace; this.texA.anisotropy = 4;
    this.matA = new THREE.MeshBasicMaterial({ map: this.texA, alphaTest: 0.5, side: THREE.DoubleSide });
    const filas = [this.lista.filter(p => p.hueco === 'cabeza' || p.hueco === 'ojos'), this.lista.filter(p => p.hueco !== 'cabeza' && p.hueco !== 'ojos')];
    let i = 0;
    filas.forEach((fila, f) => {
      const n = fila.length, paso = Math.min(PRENDA_W + 0.005, (AW_ - 0.08) / Math.max(1, n));
      fila.forEach((p, k) => {
        const geo = quadAtlas(PRENDA_W, PRENDA_H, [(i % 8) * 256, Math.floor(i / 8) * 384, 256, 384], 2048, 1024, -PRENDA_H);
        const base = new THREE.Vector3((k - (n - 1) / 2) * paso, BARRAS[f] + 0.018, 0.035 + (k % 2) * 0.012);
        const obj = new THREE.Mesh(geo, this.matA); obj.position.copy(base); obj.name = 'prenda-' + p.id;
        A.add(obj);
        this.prendas.push({ i, p, base, obj, estado: 'colgada', tiembla: 0, t: 0 });
        i++;
      });
    });
  }

  _taller() {
    const T = this.gT;
    this.atlasT = lienzo(2048, 1024);
    this.texT = new THREE.CanvasTexture(this.atlasT); this.texT.colorSpace = THREE.SRGBColorSpace; this.texT.anisotropy = 4;
    this.matT = new THREE.MeshBasicMaterial({ map: this.texT, alphaTest: 0.5, side: THREE.DoubleSide });
    const n = this.listaInv.length, paso = n > 1 ? Math.min(0.18, (MESA_W - 0.16) / (n - 1)) : 0;
    this.listaInv.forEach((iv, i) => {
      const pl = quadAtlas(PLANO_W, PLANO_H, [i * 256, 0, 256, 320], 2048, 1024, -PLANO_H / 2);
      pl.applyMatrix4(Mt(0, 0.04, 0.06, 0, -1.2));
      const fg = quadAtlas(FIGURA, FIGURA, [i * 256, 320, 256, 256], 2048, 1024, 0);
      fg.applyMatrix4(Mt(0, 0.002, -0.1));
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array([...pl.attributes.position.array, ...fg.attributes.position.array]);
      const uv = new Float32Array([...pl.attributes.uv.array, ...fg.attributes.uv.array]);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const ix = [...pl.index.array], ix2 = [...fg.index.array].map(k => k + 4);
      geo.setIndex([...ix, ...ix2]); pl.dispose(); fg.dispose();
      const obj = new THREE.Mesh(geo, this.matT); obj.name = 'invento-' + iv.id;
      const base = new THREE.Vector3((i - (n - 1) / 2) * paso, MESA_Y, 0);
      obj.position.copy(base); T.add(obj);
      this.inventos.push({ i, iv, obj, base, tiembla: 0, crece: null, tenia: null });
    });
    // cartel «Taller de inventos» en el tablero de atrás
    const cg = quadAtlas(0.46, 0.0719, [0, 576, 1024, 160], 2048, 1024, 0);
    const cartel = new THREE.Mesh(cg, this.matT); cartel.position.set(-0.1, MESA_Y + 0.4, -MESA_D / 2 + 0.025); cartel.name = 'cartel-taller';
    T.add(cartel);
  }

  _corcho() {
    const C = this.gC;
    this.corchoC = lienzo(2048, 1280);
    this.texC = new THREE.CanvasTexture(this.corchoC); this.texC.colorSpace = THREE.SRGBColorSpace; this.texC.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CORCHO_W, CORCHO_H), new THREE.MeshBasicMaterial({ map: this.texC }));
    m.position.set(0, CORCHO_Y, 0); m.name = 'corcho'; C.add(m);
    // brillo de las estrellas nuevas: puntos aditivos encima de su polaroid
    const b = lienzo(128, 128), x = b.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,240,150,1)'); gr.addColorStop(0.35, 'rgba(255,214,40,.55)'); gr.addColorStop(1, 'rgba(255,214,40,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.texBrillo = new THREE.CanvasTexture(b);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3)); geo.setDrawRange(0, 0);
    this.brillo = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.26, map: this.texBrillo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.brillo.frustumCulled = false; this.brillo.name = 'brillo-corcho'; C.add(this.brillo);
  }

  // ---------- dibujar (solo cuando algo cambia) ----------
  _redibujar(forzar = false) {
    const E = this.E, a = this._armario(), monchis = E.monchis;
    const clave = monchis + '|' + JSON.stringify(a.tiene) + JSON.stringify(a.puesto) + '|' + this.listaInv.map(i => E.inventos?.[i.id] ? 1 : 0).join('') + this.lista.map(p => this._abierta(p) ? 1 : 0).join('');
    if (forzar || clave !== this._clave) { this._clave = clave; this._pintarArmario(a, monchis); this._pintarEspejo(a); this._pintarTaller(monchis); }
    const claveC = JSON.stringify(E.estrellas || {}) + JSON.stringify(E.records || {}) + JSON.stringify(E.corchoVisto || null);
    if (forzar || claveC !== this._claveC) { this._claveC = claveC; this._pintarCorcho(); }
  }

  _pintarArmario(a, monchis) {
    const ctx = this.atlasA.getContext('2d');
    ctx.clearRect(0, 0, 2048, 1024);
    for (const s of this.prendas) {
      const p = s.p, x = (s.i % 8) * 256, y = Math.floor(s.i / 8) * 384;
      const tiene = !!a.tiene[p.id], puesta = a.puesto[p.hueco] === p.id, cerrada = !tiene && !this._abierta(p), puede = tiene || (!cerrada && monchis >= p.precio);
      // percha
      ctx.strokeStyle = COL.tinta; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(x + 128, y + 18, 13, Math.PI, Math.PI * 2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 128, y + 30); ctx.lineTo(x + 36, y + 70); ctx.lineTo(x + 220, y + 70); ctx.closePath();
      ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = COL.cartonClaro; ctx.lineWidth = 5; ctx.stroke();
      // la prenda (o Vuper tintado para las pieles)
      ctx.save();
      if (!puede) ctx.filter = 'grayscale(1) brightness(0.7)';
      if (p.hueco === 'piel') { const v = this.imgs.vuper; if (v) encajar(ctx, tintar(v, p.tinte), x + 24, y + 58, 208, 190); }
      else { const im = this.imgs[p.sprite]; if (im) encajar(ctx, im, x + 16, y + 62, 224, 186); }
      ctx.restore();
      // etiqueta
      const ey = y + 262;
      ctx.strokeStyle = COL.tinta; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 128, y + 236); ctx.lineTo(x + 128, ey + 4); ctx.stroke();
      ctx.fillStyle = puesta ? COL.verde : tiene ? COL.azul : puede ? COL.amarillo : '#b9b2c2';
      ctx.lineWidth = 7; ctx.beginPath(); ctx.roundRect(x + 10, ey, 236, 114, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.tinta; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      textoCabe(ctx, p.nombre.replace(/\s*\(.*\)/, ''), x + 128, ey + 30, 218, 26);
      const linea = puesta ? 'Puesto' : tiene ? 'Ponértelo' : cerrada ? (p.desde === 'libre' ? 'Tras el final' : `Acto ${this._acto(p)}`) : puede ? `${p.precio} monchis` : `Te faltan ${p.precio - monchis}`;
      textoCabe(ctx, linea, x + 128, ey + 78, 218, 40);
    }
    this.texA.needsUpdate = true;
  }

  _pintarEspejo(a) {
    const c = this.espejoC, x = c.getContext('2d'), W = 256, H = 384;
    x.clearRect(0, 0, W, H);
    x.fillStyle = COL.tinta; x.beginPath(); x.roundRect(0, 0, W, H, 40); x.fill();
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#dfe8ff'); g.addColorStop(0.5, '#b8c6ea'); g.addColorStop(1, '#d9d2f2');
    x.fillStyle = g; x.beginPath(); x.roundRect(12, 12, W - 24, H - 24, 32); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 10; x.beginPath(); x.moveTo(40, 120); x.lineTo(110, 40); x.moveTo(52, 170); x.lineTo(150, 56); x.stroke();
    const v = this.imgs.vuper;
    if (v) {
      const piel = this.lista.find(p => p.id === a.puesto.piel);
      const w = 200, h = v.height * w / v.width, cx = W / 2, pies = H - 40;
      x.drawImage(tintar(v, piel ? piel.tinte : null), cx - w / 2, pies - h, w, h);
      for (const hueco of ['cuello', 'ojos', 'cabeza']) {
        const p = this.lista.find(q => q.id === a.puesto[hueco]); const im = p && this.imgs[p.sprite];
        if (!im) continue;
        const [alto, ancho, origen] = this.anclasP[p.id] || this.anclas[hueco];
        const k = w * ancho / im.width, dw = im.width * k, dh = im.height * k, y = pies - h * alto;
        x.drawImage(im, cx - dw / 2, y - origen * dh, dw, dh);
      }
    }
    x.fillStyle = COL.tinta; x.font = `26px ${FUENTE}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('Vuper', W / 2, 34);
    this.espejoT.needsUpdate = true;
  }

  _pintarTaller(monchis) {
    const ctx = this.atlasT.getContext('2d'), E = this.E;
    ctx.clearRect(0, 0, 2048, 1024);
    for (const s of this.inventos) {
      const iv = s.iv, x = s.i * 256, tiene = !!E.inventos?.[iv.id], puede = monchis >= iv.precio, im = this.imgs[iv.sprite];
      // el plano
      ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.roundRect(x + 4, 4, 248, 312, 14); ctx.fill();
      ctx.fillStyle = COL.plano; ctx.beginPath(); ctx.roundRect(x + 10, 10, 236, 300, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      for (let k = 30; k < 300; k += 22) { ctx.beginPath(); ctx.moveTo(x + 10, k); ctx.lineTo(x + 246, k); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + k - 10, 10); ctx.lineTo(x + k - 10, 310); ctx.stroke(); }
      if (im) { ctx.save(); ctx.globalAlpha = 0.9; ctx.filter = 'grayscale(1) brightness(1.9) contrast(1.4)'; encajar(ctx, im, x + 40, 22, 176, 120); ctx.restore(); }
      ctx.fillStyle = COL.crema; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      textoCabe(ctx, iv.nombre, x + 128, 162, 222, 30);
      ctx.font = `19px ${FUENTE}`; ctx.fillStyle = COL.azul;
      envolver(ctx, iv.efecto, 220).slice(0, 2).forEach((l, k) => ctx.fillText(l, x + 128, 196 + k * 23));
      ctx.fillStyle = tiene ? COL.verde : puede ? COL.amarillo : '#b9b2c2'; ctx.strokeStyle = COL.tinta; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(x + 26, 244, 204, 56, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.tinta; textoCabe(ctx, tiene ? 'Lo tienes' : puede ? `${iv.precio} monchis` : `Te faltan ${iv.precio - monchis}`, x + 128, 273, 190, 32);
      if (tiene) { // sello
        ctx.save(); ctx.translate(x + 190, 70); ctx.rotate(-0.35); ctx.strokeStyle = COL.verde; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = COL.verde; ctx.font = `22px ${FUENTE}`; ctx.fillText('¡HECHO!', 0, 2); ctx.restore();
      }
      // la figura (el invento montado)
      if (im) encajar(ctx, im, x + 8, 328, 240, 244, true);
    }
    // cartel
    ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.roundRect(4, 580, 1016, 152, 30); ctx.fill();
    ctx.font = `92px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = COL.amarillo; ctx.shadowBlur = 24; ctx.fillStyle = '#fff3b0'; ctx.fillText('Taller de inventos', 512, 660);
    ctx.shadowBlur = 0;
    this.texT.needsUpdate = true;
  }

  _rejilla() { // celdas de las polaroids en el lienzo del corcho
    const n = this.misiones.length, cols = 8, filas = Math.max(3, Math.ceil(n / cols)), y0 = 150, ch = (1280 - y0 - 10) / filas;
    return { cols, filas, y0, cw: 2048 / cols, ch };
  }
  _pintarCorcho() {
    const c = this.corchoC, x = c.getContext('2d'), E = this.E, est = E.estrellas || {}, rec = E.records || {}, visto = E.corchoVisto || {};
    // corcho con motas
    x.fillStyle = COL.corcho; x.fillRect(0, 0, 2048, 1280);
    let sem = 7; const r = () => (sem = (sem * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 900; k++) { x.fillStyle = r() > 0.5 ? 'rgba(120,80,40,.25)' : 'rgba(255,230,190,.2)'; x.fillRect(r() * 2048, r() * 1280, 3 + r() * 6, 3 + r() * 6); }
    // cabecera
    const total = Object.values(est).reduce((s, n) => s + n, 0), maximo = this.misiones.length * 3;
    const LOGROS = this._ev('LOGROS'); const logros = Array.isArray(LOGROS) ? `  ·  Logros ${LOGROS.filter(l => (E.logros || {})[l.id]).length}/${LOGROS.length}` : '';
    x.fillStyle = COL.crema; x.strokeStyle = COL.tinta; x.lineWidth = 8;
    x.beginPath(); x.roundRect(380, 22, 1288, 108, 16); x.fill(); x.stroke();
    estrella(x, 450, 76, 36, true);
    x.fillStyle = COL.tinta; x.textAlign = 'center'; x.textBaseline = 'middle';
    textoCabe(x, `Tus estrellas: ${total} de ${maximo}${logros}`, 1040, 78, 1100, 58);
    // polaroids
    const R = this._rejilla(); this.nuevas = [];
    this.misiones.forEach((m, i) => {
      const n = est[m.clave] || 0, cx = (i % R.cols + 0.5) * R.cw, cy = R.y0 + (Math.floor(i / R.cols) + 0.5) * R.ch;
      const w = Math.min(230, R.cw - 24), h = Math.min(R.ch - 14, 268), giro = ((i * 37) % 7 - 3) * 0.012;
      const nueva = n > (visto[m.clave] || 0);
      x.save(); x.translate(cx, cy); x.rotate(giro);
      if (nueva) { x.save(); x.shadowColor = COL.amarillo; x.shadowBlur = 40; x.fillStyle = COL.amarillo; x.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16); x.restore(); }
      x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
      x.fillStyle = '#fbf8f0'; x.fillRect(-w / 2, -h / 2, w, h);
      const fw = w - 24, fh = h * 0.52, fy = -h / 2 + 12;
      x.fillStyle = n ? '#2a2440' : '#4a4458'; x.fillRect(-fw / 2, fy, fw, fh);
      const im = this.imgs[m.sprite];
      if (im) { x.save(); x.beginPath(); x.rect(-fw / 2, fy, fw, fh); x.clip(); if (!n) x.filter = 'grayscale(1) brightness(0.55)'; encajar(x, im, -fw / 2 + 4, fy + 4, fw - 8, fh - 4, true); x.restore(); }
      x.fillStyle = COL.tinta; x.textAlign = 'center'; x.textBaseline = 'middle';
      textoCabe(x, m.nombre.replace(/\s*·.*$/, ''), 0, fy + fh + 22, w - 14, 25);
      for (let e = 0; e < 3; e++) estrella(x, (e - 1) * 42, fy + fh + 57, 18, e < n);
      x.font = `20px ${FUENTE}`; x.fillStyle = '#5a4a6a';
      x.fillText(rec[m.clave] ? `Récord ${rec[m.clave]}` : 'Sin jugar', 0, fy + fh + 90);
      x.fillStyle = COL.rosa; x.beginPath(); x.arc(0, -h / 2 + 4, 9, 0, Math.PI * 2); x.fill(); x.strokeStyle = COL.tinta; x.lineWidth = 3; x.stroke(); // chincheta
      if (nueva) { // cinta «¡Nueva!»
        x.save(); x.translate(w / 2 - 34, -h / 2 + 26); x.rotate(0.5); x.fillStyle = COL.rosa; x.fillRect(-52, -15, 104, 30);
        x.fillStyle = COL.crema; x.font = `20px ${FUENTE}`; x.fillText('¡Nueva!', 0, 1); x.restore();
      }
      x.restore();
      if (nueva) this.nuevas.push({ clave: m.clave, cx, cy: cy - h / 2 + 12 + fh + 56 });
    });
    this.texC.needsUpdate = true;
    // brillos
    const pos = this.brillo.geometry.attributes.position;
    this.nuevas.slice(0, 40).forEach((nv, k) => pos.setXYZ(k, (nv.cx / 2048 - 0.5) * CORCHO_W, CORCHO_Y + (0.5 - nv.cy / 1280) * CORCHO_H, 0.02));
    pos.needsUpdate = true; this.brillo.geometry.setDrawRange(0, Math.min(40, this.nuevas.length));
    this.brillo.visible = this.nuevas.length > 0; this.brillo.material.opacity = 1;
  }

  // ---------- cada fotograma ----------
  actualizar(dt, manos = [this.xr.manos.derecha, this.xr.manos.izquierda]) {
    if (!this.g || !this.brillo) return; // montar() es asíncrono
    this._t += dt; this._mirar -= dt;
    if (this._mirar <= 0) { this._mirar = 0.25; this._redibujar(); }
    // empezar a coger
    for (const m of manos) {
      if (!m?.activa || this.agarres.has(m)) continue;
      if (!(m.empiezaPinza || m.empiezaAgarre)) continue;
      if (this.agarre?.lleva?.(m)) continue;
      this._coger(m);
    }
    // lo que llevas
    for (const [m, q] of [...this.agarres]) {
      const suelta = !m.activa || !(m.pinza || m.agarre);
      if (q.tipo === 'puerta') this._arrastrarPuerta(q.d, m, suelta);
      else if (q.tipo === 'prenda') this._llevarPrenda(q.s, m, suelta);
      if (suelta || q.fin) this.agarres.delete(m);
    }
    // puertas sueltas: se quedan abiertas o se cierran solas
    for (const d of this.puertas) {
      if (!d.mano) { const meta = d.a > 0.6 ? ABIERTA : 0; d.a += (meta - d.a) * Math.min(1, dt * 7); if (Math.abs(meta - d.a) < 0.002) d.a = meta; }
      d.piv.rotation.y = d.lado * d.a; // izquierda gira a −y, derecha a +y: el canto libre viene hacia ti
      if (d.a > 1 && !d.sonoAbrir) { d.sonoAbrir = true; this.sonido('puerta', { en: d.piv, volumen: 0.35, tono: 1.4 }); }
      if (d.a < 0.05 && d.sonoAbrir) { d.sonoAbrir = false; this.sonido('plop', { en: d.piv, volumen: 0.4, tono: 0.7 }); }
    }
    // prendas: temblar, volver a su percha, reaparecer
    for (const s of this.prendas) {
      const o = s.obj;
      if (s.estado === 'vuelve' || s.estado === 'puesta') {
        s.t += dt; const k = Math.min(1, s.t / 0.35), e = k * k * (3 - 2 * k);
        if (s.estado === 'vuelve') { o.position.lerpVectors(s.desde, s.base, e); o.rotation.y *= 1 - e; }
        else { o.position.lerpVectors(s.desde, s.meta, e); o.scale.setScalar(Math.max(0.01, 1 - e)); }
        if (k >= 1) {
          if (s.estado === 'puesta') { s.estado = 'crece'; s.t = 0; o.position.copy(s.base); o.rotation.set(0, 0, 0); }
          else { s.estado = 'colgada'; o.position.copy(s.base); o.rotation.set(0, 0, 0); }
        }
      } else if (s.estado === 'crece') {
        s.t += dt * 3; const k = Math.min(1, s.t); o.scale.setScalar(k < 1 ? Math.max(0.01, k * (1 + 0.25 * Math.sin(k * Math.PI))) : 1);
        if (k >= 1) s.estado = 'colgada';
      } else if (s.estado === 'colgada') {
        if (s.tiembla > 0) { s.tiembla -= dt; o.rotation.z = Math.sin(this._t * 55) * 0.12 * Math.min(1, s.tiembla * 3); }
        else o.rotation.z = Math.sin(this._t * 1.3 + s.i) * 0.025; // se mecen un poco
      }
    }
    // inventos: temblar y montarse
    for (const s of this.inventos) {
      const o = s.obj, tiene = !!this.E.inventos?.[s.iv.id];
      o.geometry.setDrawRange(0, tiene ? 12 : 6);
      if (s.tenia === false && tiene) s.crece = 0; // recién montado
      s.tenia = tiene;
      if (s.crece !== null) { s.crece += dt * 2.5; const k = Math.min(1, s.crece); o.scale.set(1, k < 1 ? 0.2 + 0.8 * k * (1 + 0.3 * Math.sin(k * Math.PI)) : 1, 1); if (k >= 1) s.crece = null; }
      if (s.tiembla > 0) { s.tiembla -= dt; o.position.x = s.base.x + Math.sin(this._t * 70) * 0.006 * Math.min(1, s.tiembla * 3); } else o.position.x = s.base.x;
    }
    this._corchoVivo(dt, manos);
  }

  // qué hay más cerca de la mano al pellizcar: tirador o cara de una puerta, una prenda (con su puerta abierta) o un plano
  _coger(m) {
    let mejor = null, md = ALCANCE;
    for (const d of this.puertas) {
      const dd = d.piv.localToWorld(_v.copy(d.tirador)).distanceTo(m.punta) - 0.03;
      if (dd < md) { md = dd; mejor = { tipo: 'puerta', d }; }
    }
    if (!mejor) for (const d of this.puertas) { // o en cualquier sitio de la puerta (abierta, el tirador queda lejos)
      const l = d.piv.worldToLocal(_v.copy(m.punta)), x = -d.lado * l.x;
      if (x > 0.05 && x < PUERTA_W && l.y > 0.05 && l.y < PUERTA_H && Math.abs(l.z) < 0.06) { mejor = { tipo: 'puerta', d }; break; }
    }
    if (!mejor) {
      for (const s of this.prendas) {
        if (s.estado !== 'colgada' || !this._puertaDe(s)) continue;
        const dd = s.obj.localToWorld(_v.set(0, -PRENDA_H * 0.4, 0)).distanceTo(m.punta);
        if (dd < md) { md = dd; mejor = { tipo: 'prenda', s }; }
      }
      for (const s of this.inventos) {
        const dd = s.obj.localToWorld(_v.set(0, 0.045, 0.06)).distanceTo(m.punta);
        if (dd < md) { md = dd; mejor = { tipo: 'invento', s }; }
      }
    }
    if (!mejor) return;
    if (mejor.tipo === 'puerta') { mejor.d.mano = m; this.agarres.set(m, mejor); m.vibrar?.(0.2, 20); this.sonido('papel', { en: mejor.d.piv, volumen: 0.25, tono: 0.7 }); }
    else if (mejor.tipo === 'prenda') this._cogerPrenda(mejor.s, m);
    else this._cogerInvento(mejor.s, m);
  }
  _puertaDe(s) { const d = this.puertas[s.base.x < 0 ? 0 : 1]; return d.a > 0.9; }

  _arrastrarPuerta(d, m, suelta) {
    if (suelta) { d.mano = null; return; }
    const A = this.gA, l = A.worldToLocal(_v.copy(m.punta)), bis = d.piv.position;
    const vx = (l.x - bis.x) * -d.lado, vz = l.z - bis.z;
    d.a = THREE.MathUtils.clamp(Math.atan2(vz, vx), 0, ABIERTA + 0.15);
  }

  _cogerPrenda(s, m) {
    const p = s.p, a = this._armario(), tiene = !!a.tiene[p.id];
    if (!tiene && !this._abierta(p)) return this._noSale(s, m, p.desde === 'libre' ? `${p.nombre}: se abre tras el final de la historia` : `${p.nombre}: se abre en el acto ${this._acto(p)}`);
    if (!tiene && this.E.monchis < p.precio) return this._noSale(s, m, `${p.nombre}: te faltan ${p.precio - this.E.monchis} monchis`);
    s.estado = 'mano'; s.mano = m;
    this.agarres.set(m, { tipo: 'prenda', s });
    m.vibrar?.(0.35, 30); this.sonido('papel', { en: s.obj, volumen: 0.4, tono: 1.3 });
    const puesta = a.puesto[p.hueco] === p.id;
    const que = puesta ? 'Al pecho para quitártela' : tiene ? 'Al pecho para ponértela' : `${p.precio} monchis · al pecho para probártela`;
    this.ui?.cartela(`${p.nombre}: ${p.efecto}. ${que}`, 3.2);
  }
  _noSale(s, m, texto) {
    s.tiembla = 0.5; m.vibrar?.(0.25, 30);
    this.sonido('bonk', { en: s.obj, volumen: 0.35, tono: 1.3 });
    this.ui?.cartela(texto, 2.4);
  }
  _pecho(dest) {
    const f = _w.set(0, 0, -1); if (this.xr.adelante) f.copy(this.xr.adelante); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    dest.copy(this.xr.cabeza).addScaledVector(f, 0.12); dest.y -= 0.34; return dest;
  }
  _llevarPrenda(s, m, suelta) {
    const o = s.obj, A = this.gA;
    const l = A.worldToLocal(_v.copy(m.punta));
    o.position.set(l.x, l.y + PRENDA_H * 0.45, l.z);
    const cab = A.worldToLocal(_w.copy(this.xr.cabeza));
    o.rotation.set(0, Math.atan2(cab.x - l.x, cab.z - l.z), 0);
    const centro = o.localToWorld(new THREE.Vector3(0, -PRENDA_H * 0.45, 0));
    if (centro.distanceTo(this._pecho(new THREE.Vector3())) < AL_PECHO) { this._probar(s, m); this.agarres.get(m).fin = true; return; }
    if (suelta) { s.estado = 'vuelve'; s.t = 0; s.desde = o.position.clone(); s.mano = null; }
  }

  // armario() del 2D: comprar (paga, la tiene y se la pone, sumarStat('prendas')) o ponérsela / quitársela
  _probar(s, m) {
    const p = s.p, a = this._armario(), E = this.E;
    let compra = false, puesta;
    if (!a.tiene[p.id]) {
      if (E.monchis < p.precio) { s.estado = 'vuelve'; s.t = 0; s.desde = s.obj.position.clone(); return this._noSale(s, m, `Te faltan ${p.precio - E.monchis} monchis`); }
      E.monchis -= p.precio; a.tiene[p.id] = true; a.puesto[p.hueco] = p.id; compra = true; puesta = true;
      this.motor.sumar ? this.motor.sumar('prendas') : (E.stats = E.stats || {}, E.stats.prendas = (E.stats.prendas || 0) + 1);
      this.sonido('tiroriro', { volumen: 0.7 }); this.sonido('campanita', { volumen: 0.5, tono: 1.3 });
      m.vibrar?.(0.7, 70);
      this.ui?.cartela(`¡${p.nombre}! ${p.efecto}`, 3.2);
    } else {
      puesta = a.puesto[p.hueco] !== p.id;
      a.puesto[p.hueco] = puesta ? p.id : null;
      this.sonido('pop', { volumen: 0.6, tono: puesta ? 1.2 : 0.8 }); m.vibrar?.(0.4, 40);
      this.ui?.cartela(puesta ? `Te pones: ${p.nombre}. ${p.efecto}` : `Te quitas: ${p.nombre}`, 2.6);
    }
    this.motor.guardar?.();
    this.motor.emitir?.('alCambiar', { tipo: 'armario' });
    s.estado = 'puesta'; s.t = 0; s.desde = s.obj.position.clone(); s.meta = this.gA.worldToLocal(this._pecho(new THREE.Vector3())); s.mano = null;
    this._redibujar(true);
    try { this.alVestir?.({ prenda: { id: p.id, nombre: p.nombre, hueco: p.hueco, efecto: p.efecto, bono: p.bono }, puesta, compra }); } catch (e) { console.error(e); }
  }

  _cogerInvento(s, m) {
    const iv = s.iv;
    if (this.E.inventos?.[iv.id]) { s.tiembla = 0.25; m.vibrar?.(0.2, 20); this.sonido('pop', { en: s.obj, volumen: 0.4 }); this.ui?.cartela(`${iv.nombre}: ${iv.efecto}`, 2.6); return; }
    const r = this.motor.comprarInvento(iv.id);
    if (!r?.ok) {
      s.tiembla = 0.5; m.vibrar?.(0.25, 30); this.sonido('bonk', { en: s.obj, volumen: 0.35, tono: 1.3 });
      this.ui?.cartela(r?.motivo === 'sin monchis' ? `${iv.nombre}: te faltan ${r.faltan} monchis` : `${iv.nombre}: ahora no se puede`, 2.4);
      return;
    }
    this.sonido('tiroriro', { volumen: 0.7 }); this.sonido('golpe', { en: s.obj, volumen: 0.3, tono: 1.4 });
    m.vibrar?.(0.7, 80);
    this.ui?.cartela(`¡${iv.nombre}! ${iv.efecto}`, 3.2);
    this._redibujar(true);
    try { this.alInventar?.({ id: iv.id, nombre: iv.nombre, efecto: iv.efecto }); } catch (e) { console.error(e); }
  }

  // el corcho: brillo de lo nuevo, darlo por visto al mirarlo, y tocar una polaroid
  _corchoVivo(dt, manos) {
    const C = this.gC;
    if (this.brillo.visible) {
      const k = 0.6 + 0.4 * Math.sin(this._t * 4);
      this.brillo.material.size = 0.24 + 0.1 * k; this.brillo.material.opacity = this._apagando != null ? Math.max(0, this._apagando) : k;
      const centro = C.localToWorld(_v.set(0, CORCHO_Y, 0)), haciaC = _w.copy(centro).sub(this.xr.cabeza);
      const lejos = haciaC.length(), dot = haciaC.normalize().dot(this.xr.adelante || _w.set(0, 0, -1));
      if (lejos < 3.5 && dot > 0.8) {
        if (!this._visto) { this.sonido('campanita', { en: C, volumen: 0.5, tono: 1.5 }); this.ui?.cartela(this.nuevas.length === 1 ? 'Una estrella nueva en tu corcho' : `${this.nuevas.length} minijuegos con estrellas nuevas en tu corcho`, 3); }
        this._visto += dt;
      }
      if (this._visto > 3.5 && this._apagando == null) this._apagando = 1;
      if (this._apagando != null) {
        this._apagando -= dt;
        if (this._apagando <= 0) {
          this._apagando = null; this._visto = 0;
          this.E.corchoVisto = { ...(this.E.estrellas || {}) }; this.motor.guardar?.();
          this._redibujar(true);
        }
      }
    }
    this._toque.t -= dt;
    for (const m of manos) {
      if (!m?.activa) continue;
      const l = C.worldToLocal(_v.copy(m.punta)), u = l.x / CORCHO_W + 0.5, v = 0.5 - (l.y - CORCHO_Y) / CORCHO_H;
      if (Math.abs(l.z) > 0.035 || u < 0 || u > 1 || v < 0 || v > 1) continue;
      const R = this._rejilla(), px = u * 2048, py = v * 1280;
      if (py < R.y0) continue;
      const i = Math.floor((py - R.y0) / R.ch) * R.cols + Math.floor(px / R.cw), ms = this.misiones[i];
      if (!ms || (this._toque.k === i && this._toque.t > 0)) continue;
      this._toque = { k: i, t: 1.6 };
      const n = this.E.estrellas?.[ms.clave] || 0, rec = this.E.records?.[ms.clave], nivel = this.E.niveles?.[ms.clave] || 1;
      m.vibrar?.(0.2, 20); this.sonido('papel', { en: C, volumen: 0.35, tono: 1.2 });
      this.ui?.cartela(`${ms.nombre.replace(/\s*·.*$/, '')} · ${'★'.repeat(n)}${'☆'.repeat(3 - n)} · ${rec ? `Récord ${rec} · Nivel ${nivel}` : 'Aún sin jugar'}`, 3);
    }
  }

  // para bots y app.js
  abrirPuertas(si = true) { for (const d of this.puertas) d.a = si ? ABIERTA : 0; }
  estado() {
    const a = this._armario();
    return {
      puertas: this.puertas.map(d => +d.a.toFixed(2)),
      tiradores: this.puertas.map(d => d.piv.localToWorld(d.tirador.clone())),
      prendas: this.prendas.map(s => ({ id: s.p.id, estado: s.estado, pos: s.obj.localToWorld(new THREE.Vector3(0, -PRENDA_H * 0.4, 0)), tiene: !!a.tiene[s.p.id] })),
      puesto: { ...a.puesto },
      inventos: this.inventos.map(s => ({ id: s.iv.id, tiene: !!this.E.inventos?.[s.iv.id], pos: s.obj.localToWorld(new THREE.Vector3(0, 0.045, 0.06)) })),
      nuevas: (this.nuevas || []).map(n => n.clave), brillo: this.brillo.visible,
      polaroid: k => { const i = this.misiones.findIndex(m => m.clave === k), R = this._rejilla(); const cx = (i % R.cols + 0.5) * R.cw, cy = R.y0 + (Math.floor(i / R.cols) + 0.5) * R.ch; return this.gC.localToWorld(new THREE.Vector3((cx / 2048 - 0.5) * CORCHO_W, CORCHO_Y + (0.5 - cy / 1280) * CORCHO_H, 0)); },
      pecho: this._pecho(new THREE.Vector3()),
    };
  }

  quitar() {
    if (!this.g) return;
    this.g.parent?.remove(this.g);
    const vistos = new Set();
    this.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !vistos.has(o.material)) { vistos.add(o.material); o.material.dispose(); } });
    for (const t of [this.texA, this.texT, this.texC, this.espejoT, this.texBrillo]) t?.dispose();
    this.g = null; this.puertas = []; this.prendas = []; this.inventos = []; this.agarres.clear();
  }
}
