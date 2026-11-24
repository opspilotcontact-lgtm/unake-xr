// La tienda de 24 h en VR (base/js/escenas/barrio.js → TIENDA, comprarTienda y comer).
// Un mostrador de cartón a la cintura con los productos de motor.tienda() encima, cada uno con su etiqueta de precio
// colgando por delante. COMPRAR = COGERLO (pellizco, puño o gatillo): se cobra con motor.comprar(id), suena la caja,
// vibra y la etiqueta se cae. Si no te llega, el producto no se despega: tiembla y «Te faltan N monchis».
//   · Comida (patatas, kebab, caramelo, resucitador): se queda en tu mano; llévatela a la BOCA y te la comes
//     (ñam, migas, alComer(efecto)). Si la sueltas antes, va sola a tu boca: ya está pagada.
//   · Papel, mechero (y bolsita si se activa): al soltarlos van «a tu bolsillo» (hacia tu cadera) con su cartela.
// Lo que se compra se repone a los REPONER segundos.
//
//   const t = new Tienda({ motor, sonido, ui, agarre, xr });
//   t.alComer = (efecto, producto) => { J.colocon += efecto.colocon || 0; };
//   await t.montar(grupoSala, posLocal, haciaLocal);   // posLocal: suelo, centro del mostrador; haciaLocal: punto
//                                                      // (local) al que mira el frente (donde te pones tú)
//   t.actualizar(dt, [xr.manos.derecha, xr.manos.izquierda]);   t.quitar();
//
// Coste: mostrador 2 + caja registradora 1 + neón 1 + un producto = 1 (dibujo y etiqueta en el mismo atlas) → ~10.
import * as THREE from 'three';
import { textura } from '../recursos.js';

export const COL = { morado: '#3b2a52', moradoOsc: '#2a1d3d', moradoClaro: '#5a4378', tinta: '#140c1c', rosa: '#ff5fa2', amarillo: '#ffd628', crema: '#fff3e6', gris: '#8a7f99', lila: '#b68cff' };

// Cómo se ve cada producto: su dibujo del 2D (base/assets/img) o uno pintado aquí como los del 2D (arranque.js →
// objetosLiar), el alto en metros y si es comida.
const ARTE = {
  patatas: { img: 'patatas.png', alto: 0.16, comida: true },
  kebab: { img: 'obj-kebab.png', alto: 0.2, comida: true },
  caramelo: { img: 'caramelo.png', alto: 0.1, comida: true },
  lata: { img: 'lata.png', alto: 0.13, comida: true, bebida: true },
  papel: { pintar: pintarPapel, alto: 0.09 },
  mechero: { img: 'obj-mechero-voppe.png', alto: 0.11 },
  bolsita: { pintar: pintarBolsita, alto: 0.11 },
};
const BOLSILLO = { papel: 'papel', mechero: 'mechero', bolsita: 'bolsita' }; // id → clave de inv
const NOMBRE_INV = { papel: 'Papel', mechero: 'Mechero', bolsita: 'Bolsita' };

const ALTO_MOSTRADOR = 0.92, ANCHO = 1.0, FONDO = 0.44;
const REPONER = 6;           // s hasta que vuelve a haber
const ALCANCE = 0.085;       // m desde la punta del dedo al centro del producto
const A_LA_BOCA = 0.1;       // m

// atlas: fila de dibujos (256×256) y fila de etiquetas (256×128), una columna por producto
const CW = 256, CH = 256, EH = 128, AW = 2048, AH = 512;

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function pintarPapel(ctx, w, h) { // librito de papel de liar
  const s = Math.min(w / 96, h / 80) * 0.9, x = (w - 96 * s) / 2, y = h - 80 * s;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.roundRect(0, 8, 96, 64, 8); ctx.fill();
  ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.roundRect(5, 13, 86, 54, 6); ctx.fill();
  ctx.fillStyle = '#e9e2d0'; ctx.fillRect(5, 54, 86, 7);
  ctx.strokeStyle = '#d8cfb8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, 26); ctx.lineTo(76, 26); ctx.moveTo(20, 36); ctx.lineTo(76, 36); ctx.stroke();
  ctx.fillStyle = COL.rosa; ctx.fillRect(5, 13, 86, 7);
  ctx.restore();
}
function pintarBolsita(ctx, w, h) {
  const s = Math.min(w / 84, h / 96) * 0.9, x = (w - 84 * s) / 2, y = h - 96 * s;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.roundRect(4, 6, 76, 84, 12); ctx.fill();
  ctx.fillStyle = 'rgba(223,243,255,.95)'; ctx.beginPath(); ctx.roundRect(10, 12, 64, 72, 9); ctx.fill();
  ctx.fillStyle = '#6fbf4a';
  for (const [cx, cy, r] of [[26, 60, 12], [46, 66, 13], [56, 52, 10], [34, 46, 9], [48, 40, 8]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = COL.rosa; ctx.fillRect(10, 18, 64, 8);
  ctx.restore();
}
function pintarGenerico(ctx, w, h, nombre) { // por si el motor trae algo que aquí no se conoce
  ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.roundRect(w * 0.18, h * 0.3, w * 0.64, h * 0.66, 18); ctx.fill();
  ctx.fillStyle = COL.amarillo; ctx.beginPath(); ctx.roundRect(w * 0.18 + 8, h * 0.3 + 8, w * 0.64 - 16, h * 0.66 - 16, 12); ctx.fill();
  ctx.fillStyle = COL.tinta; ctx.font = '34px Caprasimo, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(nombre.split(' ')[0].slice(0, 9), w / 2, h * 0.63);
}

// ---------- mostrador: cajas con colores por vértice (toon horneado) y casco de tinta ----------
const L = new THREE.Vector3(0.35, 0.85, 0.45).normalize();
function hornear(geo, matriz, color, luz = true) {
  const g = geo.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.applyMatrix4(matriz);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), base = new THREE.Color(color), c = new THREE.Color();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    let k = 1;
    if (luz) {
      o.fromBufferAttribute(p, i); a.fromBufferAttribute(p, i + 1).sub(o); b.fromBufferAttribute(p, i + 2).sub(o);
      const d = a.cross(b).normalize().dot(L); k = d > 0.62 ? 1.12 : d > 0.15 ? 0.92 : 0.7;
    }
    c.copy(base).multiplyScalar(k);
    for (let j = 0; j < 3; j++) c.toArray(col, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const Mt = (x, y, z, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
function unir(geos) { // mergeGeometries sin dependencias: todas tienen position + color
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return r;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _boca = new THREE.Vector3();

export class Tienda {
  constructor({ motor, sonido = () => { }, ui = null, agarre = null, xr }) {
    Object.assign(this, { motor, sonido, ui, agarre, xr });
    this.alComer = null;          // (efecto {colocon?}, producto {id, nombre, efecto}) → aplica efecto.colocon a tu colocón
    this.alComprar = null;        // opcional: (producto) al cobrar
    this.excluir = ['bolsita'];   // en el 2D la bolsita la vende Palicaso en la barra, no la tienda: quítalo para venderla aquí
    this.g = null; this.slots = []; this.llevados = []; this.volando = []; this.etiquetas = []; this.migas = null;
    this._clave = ''; this._t = 0; this._mirar = 0;
  }

  async montar(grupo, posLocal = new THREE.Vector3(), haciaLocal = null) {
    const g = this.g = new THREE.Group(); g.name = 'tienda-24h';
    g.position.copy(posLocal);
    if (haciaLocal) g.rotation.y = Math.atan2(haciaLocal.x - posLocal.x, haciaLocal.z - posLocal.z);
    grupo.add(g);
    this._mostrador();
    // atlas compartido por todos los productos (1 material)
    this.atlas = lienzo(AW, AH);
    this.tex = new THREE.CanvasTexture(this.atlas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.lista = this.motor.tienda().filter(p => !this.excluir.includes(p.id)).slice(0, AW / CW);
    this.imgs = {};
    await Promise.all(this.lista.map(async p => {
      const a = ARTE[p.id];
      if (a?.img) { try { this.imgs[p.id] = (await textura('base/assets/img/' + a.img)).image; } catch { /* se pinta genérico */ } }
    }));
    const n = this.lista.length, x0 = -ANCHO / 2 + 0.09, paso = n > 1 ? (ANCHO - 0.18) / (n - 1) : 0;
    this.lista.forEach((p, i) => {
      const s = { i, id: p.id, p, alto: ARTE[p.id]?.alto ?? 0.12, base: new THREE.Vector3(x0 + i * paso, ALTO_MOSTRADOR + 0.02, FONDO / 2 - 0.1), obj: null, falta: 0, tiembla: 0 };
      s.geo = this._geometria(i, s.alto, s.base);
      this.slots.push(s);
      this._reponer(s, false);
    });
    this._migas();
    this._redibujar(true);
    return this;
  }

  _mostrador() {
    const piezas = [], cascos = [];
    const caja = (w, h, d, m, color, casco = true) => {
      piezas.push(hornear(new THREE.BoxGeometry(w, h, d), m, color));
      if (casco) cascos.push(hornear(new THREE.BoxGeometry(w + 0.016, h + 0.016, d + 0.016), m, COL.tinta, false));
    };
    const A = ALTO_MOSTRADOR;
    caja(ANCHO, 0.06, FONDO, Mt(0, 0.03, 0), COL.tinta, false);                        // zócalo
    caja(ANCHO - 0.02, A - 0.1, FONDO - 0.04, Mt(0, 0.06 + (A - 0.1) / 2, 0), COL.morado); // cuerpo
    caja(ANCHO + 0.06, 0.04, FONDO + 0.06, Mt(0, A - 0.02, 0), COL.moradoClaro);         // tablero con vuelo
    caja(ANCHO - 0.06, 0.05, 0.012, Mt(0, A - 0.1, FONDO / 2 - 0.01), COL.rosa, false);   // canto rosa
    caja(ANCHO - 0.06, 0.03, 0.012, Mt(0, 0.16, FONDO / 2 - 0.01), COL.amarillo, false);  // y uno amarillo abajo
    // caja registradora atrás a la derecha
    caja(0.22, 0.1, 0.18, Mt(0.33, A + 0.05, -0.12), COL.gris);
    caja(0.2, 0.05, 0.08, Mt(0.33, A + 0.12, -0.17), COL.moradoOsc);
    // poste del neón
    caja(0.025, 0.42, 0.025, Mt(-0.4, A + 0.21, -0.17), COL.tinta, false);
    const cuerpo = new THREE.Mesh(unir(piezas), new THREE.MeshBasicMaterial({ vertexColors: true }));
    const casco = new THREE.Mesh(unir(cascos), new THREE.MeshBasicMaterial({ color: COL.tinta, side: THREE.BackSide }));
    this.g.add(cuerpo, casco);
    // pantallita de la caja: cuánto llevas
    this.pant = lienzo(256, 96);
    this.pantT = new THREE.CanvasTexture(this.pant); this.pantT.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.064), new THREE.MeshBasicMaterial({ map: this.pantT }));
    pm.position.set(0.33, A + 0.12, -0.128); pm.rotation.x = -0.35; this.g.add(pm);
    // el neón «24 h»
    const c = lienzo(512, 256), x = c.getContext('2d');
    x.fillStyle = COL.tinta; x.beginPath(); x.roundRect(8, 8, 496, 240, 26); x.fill();
    x.strokeStyle = COL.moradoClaro; x.lineWidth = 6; x.stroke();
    x.font = '150px Caprasimo, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = COL.rosa; x.shadowBlur = 34; x.fillStyle = '#ffd0e6';
    for (let k = 0; k < 3; k++) x.fillText('24 h', 256, 134);
    x.shadowBlur = 0; x.lineWidth = 5; x.strokeStyle = COL.rosa; x.strokeText('24 h', 256, 134);
    const nt = new THREE.CanvasTexture(c); nt.colorSpace = THREE.SRGBColorSpace;
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: nt }));
    this.neon.position.set(-0.4, A + 0.5, -0.155); this.neon.rotation.y = 0.12; this.g.add(this.neon);
  }

  // geometría de un producto: su dibujo (de pie, base en el origen) + la etiqueta colgando del borde del mostrador
  _geometria(i, alto, base) {
    const u0 = (i * CW) / AW, u1 = ((i + 1) * CW) / AW;
    const vT = 1, vB = 1 - CH / AH, eT = 1 - CH / AH, eB = 1 - (CH + EH) / AH;
    // la etiqueta cuelga del canto con el pie un poco hacia fuera: así mira algo hacia arriba, hacia tus ojos
    const w = alto, ez = FONDO / 2 + 0.03 + 0.012 - base.z, ey = -0.012, ew = 0.13, eh = 0.065, sale = 0.03;
    const pos = [-w / 2, 0, 0, w / 2, 0, 0, w / 2, alto, 0, -w / 2, alto, 0,
      -ew / 2, ey - eh, ez + sale, ew / 2, ey - eh, ez + sale, ew / 2, ey, ez, -ew / 2, ey, ez];
    const uv = [u0, vB, u1, vB, u1, vT, u0, vT, u0, eB, u1, eB, u1, eT, u0, eT];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    return geo;
  }

  _reponer(s, pop = true) {
    const m = new THREE.Mesh(s.geo.clone(), this.mat);
    m.position.copy(s.base); m.name = 'producto-' + s.id;
    if (pop) { m.scale.setScalar(0.01); m.userData.crece = 0; }
    this.g.add(m); s.obj = m; s.falta = 0;
  }

  _redibujar(forzar = false) {
    const lista = this.motor.tienda(), monchis = this.motor.monchis;
    const clave = monchis + '|' + lista.map(p => (p.puede ? 1 : 0) + '' + (p.tengo ? 1 : 0)).join('');
    if (!forzar && clave === this._clave) return;
    this._clave = clave;
    const ctx = this.atlas.getContext('2d');
    ctx.clearRect(0, 0, AW, AH);
    this.slots.forEach(s => {
      const p = lista.find(x => x.id === s.id) || s.p; s.p = p;
      const x = s.i * CW, pint = ARTE[s.id]?.pintar, im = this.imgs[s.id];
      ctx.save();
      if (!p.puede) ctx.filter = 'grayscale(1) brightness(0.75)';
      if (im) {
        const k = Math.min((CW - 16) / im.width, (CH - 8) / im.height), w = im.width * k, h = im.height * k;
        ctx.drawImage(im, x + (CW - w) / 2, CH - h - 2, w, h);
      } else { ctx.translate(x, 0); (pint || ((c, w, h) => pintarGenerico(c, w, h, p.nombre)))(ctx, CW, CH); }
      ctx.restore();
      if (!p.puede) { // tachado
        ctx.strokeStyle = COL.tinta; ctx.lineWidth = 14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 40, CH - 40); ctx.lineTo(x + CW - 40, 60); ctx.stroke();
      }
      // etiqueta: cordel + cartulina
      const y = CH;
      ctx.strokeStyle = COL.tinta; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + CW / 2, y); ctx.lineTo(x + CW / 2, y + 22); ctx.stroke();
      ctx.fillStyle = p.puede ? COL.amarillo : '#b9b2c2'; ctx.strokeStyle = COL.tinta; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.roundRect(x + 10, y + 18, CW - 20, EH - 26, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.tinta; ctx.beginPath(); ctx.arc(x + CW / 2, y + 30, 6, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = COL.tinta;
      if (p.tengo) { ctx.font = '46px Caprasimo, serif'; ctx.fillText('Lo tienes', x + CW / 2, y + 74); }
      else if (p.puede) {
        ctx.font = '62px Caprasimo, serif'; ctx.fillText(String(p.precio), x + CW / 2, y + 62);
        ctx.font = '30px Caprasimo, serif'; ctx.fillText('monchis', x + CW / 2, y + 102);
      } else {
        ctx.font = '36px Caprasimo, serif'; ctx.fillText('Te faltan', x + CW / 2, y + 56);
        ctx.font = '48px Caprasimo, serif'; ctx.fillText(String(Math.max(0, p.precio - monchis)), x + CW / 2, y + 98);
      }
    });
    this.tex.needsUpdate = true;
    // la pantallita de la caja
    const c = this.pant.getContext('2d');
    c.fillStyle = '#10241a'; c.fillRect(0, 0, 256, 96);
    c.fillStyle = '#7ee081'; c.font = '40px Caprasimo, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${monchis} monchis`, 128, 50);
    this.pantT.needsUpdate = true;
  }

  _migas() {
    const N = 24, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.migas = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, depthWrite: false }));
    this.migas.visible = false; this.migas.frustumCulled = false; this.migas.userData = { vel: Array.from({ length: N }, () => new THREE.Vector3()), t: 0 };
    this.g.add(this.migas);
  }
  _soltarMigas(posMundo, bebida) {
    const m = this.migas, pos = m.geometry.attributes.position, col = m.geometry.attributes.color, c = new THREE.Color();
    const centro = this.g.worldToLocal(posMundo.clone());
    const tonos = bebida ? ['#b68cff', '#ffffff', '#d9c8ff'] : ['#f5d23a', '#ffd23f', '#ff8fc0'];
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, centro.x, centro.y, centro.z); c.set(tonos[i % 3]); col.setXYZ(i, c.r, c.g, c.b);
      m.userData.vel[i].set((Math.random() - 0.5) * 0.9, Math.random() * 0.6 - 0.1, (Math.random() - 0.5) * 0.9);
    }
    pos.needsUpdate = col.needsUpdate = true; m.visible = true; m.userData.t = 0.8; m.material.opacity = 1;
  }

  // ---------- cada fotograma ----------
  actualizar(dt, manos = [this.xr.manos.derecha, this.xr.manos.izquierda]) {
    if (!this.g || !this.migas) return; // montar() es asíncrono: hasta que acabe, nada
    this._t += dt; this._mirar -= dt;
    if (this._mirar <= 0) { this._mirar = 0.2; this._redibujar(); }
    // parpadeo del neón, de vez en cuando
    const parp = Math.sin(this._t * 23) > 0.2 && (this._t % 7) < 0.35;
    this.neon.material.color.setScalar(parp ? 0.45 : 1);
    // reponer y temblar
    for (const s of this.slots) {
      if (!s.obj) { s.falta += dt; if (s.falta > REPONER) { this._reponer(s); this.sonido('pop', { en: this.g, volumen: 0.3 }); } continue; }
      const o = s.obj;
      if (o.userData.crece !== undefined) { o.userData.crece += dt * 3; const k = Math.min(1, o.userData.crece); o.scale.setScalar(k < 1 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1); if (k >= 1) delete o.userData.crece; }
      if (s.tiembla > 0) { s.tiembla -= dt; o.position.x = s.base.x + Math.sin(this._t * 70) * 0.008 * Math.min(1, s.tiembla * 3); o.rotation.z = Math.sin(this._t * 55) * 0.06 * Math.min(1, s.tiembla * 3); }
      else if (o.rotation.z !== 0) { o.position.copy(s.base); o.rotation.z = 0; }
    }
    // coger: comprar
    for (const m of manos) {
      if (!m?.activa) continue;
      if (this.llevados.some(l => l.mano === m)) continue;
      if (!(m.empiezaPinza || m.empiezaAgarre)) continue;
      if (this.agarre?.lleva?.(m)) continue;
      let mejor = null, md = ALCANCE;
      for (const s of this.slots) {
        if (!s.obj || s.obj.userData.crece !== undefined) continue;
        const d = s.obj.localToWorld(_v.set(0, s.alto / 2, 0)).distanceTo(m.punta) - s.alto * 0.25; // los grandes, desde más lejos
        if (d < md) { md = d; mejor = s; }
      }
      if (mejor) this._coger(mejor, m);
    }
    // lo que llevas en la mano
    const boca = this.xr.boca(_boca);
    for (const l of [...this.llevados]) {
      const m = l.mano;
      this._aMano(l, m);
      const centro = l.obj.localToWorld(_w.set(0, l.alto / 2, 0));
      if (l.comida && centro.distanceTo(boca) < A_LA_BOCA) { this._comer(l); continue; }
      if (!m.activa || !(m.pinza || m.agarre)) { // soltado
        this.llevados.splice(this.llevados.indexOf(l), 1);
        this.volando.push({ ...l, t: 0, dur: l.comida ? 0.45 : 0.5, desde: l.obj.position.clone(), a: l.comida ? 'boca' : 'bolsillo' });
      }
    }
    // lo que vuela a tu boca o a tu bolsillo
    for (const v of [...this.volando]) {
      v.t += dt; const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k);
      let meta;
      if (v.a === 'boca') meta = this.g.worldToLocal(this.xr.boca(_w).clone());
      else { // la cadera del lado de la mano: bajo la cabeza, a un palmo hacia fuera
        const der = _q.copy(this.xr.cabezaQ ?? new THREE.Quaternion()), lat = _v.set(v.mano.lado === 'izquierda' ? -0.2 : 0.2, 0, 0).applyQuaternion(der);
        lat.y = 0; meta = this.g.worldToLocal(_w.copy(this.xr.cabeza).add(lat).setY(this.xr.cabeza.y - 0.72).clone());
      }
      v.obj.position.lerpVectors(v.desde, meta, e);
      if (v.a === 'bolsillo') v.obj.scale.setScalar(1 - 0.75 * e);
      if (k >= 1) {
        this.volando.splice(this.volando.indexOf(v), 1);
        if (v.a === 'boca') this._comer(v);
        else this._alBolsillo(v);
      }
    }
    // etiquetas que se caen
    for (const e of [...this.etiquetas]) {
      e.t += dt; e.vel.y -= 9.8 * dt * 0.6; e.obj.position.addScaledVector(e.vel, dt); e.obj.rotation.z += e.giro * dt; e.obj.rotation.x += dt * 2;
      if (e.t > 1.2 || e.obj.position.y < 0.01) { this.g.remove(e.obj); e.obj.geometry.dispose(); this.etiquetas.splice(this.etiquetas.indexOf(e), 1); }
    }
    // migas
    const mg = this.migas;
    if (mg.visible) {
      mg.userData.t -= dt; const pos = mg.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const v = mg.userData.vel[i]; v.y -= 2.2 * dt; pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt); }
      pos.needsUpdate = true; mg.material.opacity = Math.max(0, mg.userData.t / 0.8);
      if (mg.userData.t <= 0) mg.visible = false;
    }
  }

  _aMano(l, m) {
    const local = this.g.worldToLocal(_v.copy(m.punta));
    l.obj.position.set(local.x, local.y - l.alto / 2, local.z); // el centro del dibujo, en la punta de tus dedos
    const cab = this.g.worldToLocal(_w.copy(this.xr.cabeza));   // de pie y mirándote (solo gira en vertical)
    l.obj.rotation.set(0, Math.atan2(cab.x - local.x, cab.z - local.z), 0);
  }

  _coger(s, m) {
    const p = s.p;
    if (!p.puede) return this._noLlega(s, m, p.tengo ? { motivo: 'ya lo tienes' } : { motivo: 'sin monchis', faltan: Math.max(1, p.precio - this.motor.monchis) });
    const r = this.motor.comprar(s.id);
    if (!r?.ok) return this._noLlega(s, m, r || {});
    // ¡clinc! cobrado
    this.sonido('campanita', { en: this.g, volumen: 0.7, tono: 1.35 });
    this.sonido('lata', { en: this.g, volumen: 0.35, tono: 1.6 });
    m.vibrar(0.7, 60);
    const o = s.obj; s.obj = null; s.falta = 0; s.tiembla = 0; o.rotation.set(0, 0, 0);
    // la etiqueta se separa y se cae
    o.geometry.setDrawRange(0, 6);
    const eg = s.geo.clone(); eg.setIndex([4, 5, 6, 4, 6, 7]);
    const et = new THREE.Mesh(eg, this.mat); et.position.copy(o.position); this.g.add(et);
    this.etiquetas.push({ obj: et, t: 0, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4, 0.35), giro: (Math.random() - 0.5) * 8 });
    const l = { obj: o, id: s.id, alto: s.alto, mano: m, p, comida: !!ARTE[s.id]?.comida || !BOLSILLO[s.id] && !!(r.efecto && Object.keys(r.efecto).length), efecto: r.efecto || {} };
    this.llevados.push(l);
    this._aMano(l, m);
    this._redibujar(true);
    this.alComprar?.(p);
  }

  _noLlega(s, m, r) {
    s.tiembla = 0.5;
    m.vibrar(0.25, 30);
    this.sonido('bonk', { en: this.g, volumen: 0.35, tono: 1.3 });
    this.ui?.cartela(r.motivo === 'ya lo tienes' ? 'Ya tienes mechero: te dura siempre' : `Te faltan ${r.faltan ?? '?'} monchis`, 2.2);
  }

  _comer(l) {
    const i = this.llevados.indexOf(l); if (i >= 0) this.llevados.splice(i, 1);
    const centro = l.obj.localToWorld(new THREE.Vector3(0, l.alto / 2, 0));
    this.g.remove(l.obj); l.obj.geometry.dispose();
    const bebida = !!ARTE[l.id]?.bebida;
    this.sonido(bebida ? 'sorbo' : 'nam', { volumen: 0.8 });
    if (!bebida) setTimeout(() => this.sonido('nam', { volumen: 0.55 }), 450);
    this._soltarMigas(centro, bebida);
    l.mano?.vibrar?.(0.3, 40);
    this.ui?.cartela(`${bebida ? '¡Glu, glu!' : '¡Ñam!'} ${l.p.efecto || ''}`.trim(), 2.6);
    try { this.alComer?.(l.efecto || {}, { id: l.id, nombre: l.p.nombre, efecto: l.p.efecto }); } catch (e) { console.error(e); }
  }

  _alBolsillo(v) {
    this.g.remove(v.obj); v.obj.geometry.dispose();
    this.sonido(v.id === 'mechero' ? 'mechero' : v.id === 'papel' ? 'papel' : 'plop', { volumen: 0.6 });
    v.mano?.vibrar?.(0.2, 25);
    const inv = this.motor.necesidades?.().inv || {}, clave = BOLSILLO[v.id];
    const n = inv[clave];
    const nombre = NOMBRE_INV[v.id] || v.p.nombre;
    this.ui?.cartela(typeof n === 'number' ? `${nombre} ×${n} · al bolsillo` : `${nombre} · al bolsillo`, 2.2);
  }

  // lo que hay en el mostrador (para bots y para app.js)
  estado() {
    return {
      productos: this.slots.map(s => ({ id: s.id, hay: !!s.obj, puede: s.p.puede, pos: s.obj ? s.obj.localToWorld(new THREE.Vector3(0, s.alto / 2, 0)) : null })),
      llevando: this.llevados.map(l => l.id), volando: this.volando.map(v => v.id + '→' + v.a),
    };
  }

  quitar() {
    if (!this.g) return;
    this.g.parent?.remove(this.g);
    this.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== this.mat) { o.material.map?.dispose(); o.material.dispose(); } });
    this.mat.dispose(); this.tex.dispose();
    for (const s of this.slots) s.geo.dispose();
    this.g = null; this.slots = []; this.llevados = []; this.volando = []; this.etiquetas = [];
  }
}
