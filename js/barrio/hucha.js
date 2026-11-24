// La hucha de la aso en VR (base/js/escenas/barrio.js → hucha(c)): el cerdito de cartón (obj-hucha del 2D) encima
// de una caja de fruta, a la altura de la mano, junto a Blancaso en la plaza, con su marcador «hucha / META».
// APORTAR: pellizca (o cierra el puño, o gatillo) encima de la ranura y MANTÉN → caen monchis de 10 en 10
// (motor.aportar(10) cada 0,12 s) con su «clin» y la cifra subiendo. Sin monchis: «No llevas monchis». Al llenarse:
// confeti de humo amarillo y alLlenar('¡Mil! ¡Unaké se queda!') para que Blancaso lo diga en su bocadillo.
//
//   const h = new Hucha({ motor, sonido, ui, xr });
//   h.alLlenar = linea => bocadilloDe(blancaso, linea);    // al llenar la hucha (o la meta del capítulo, si hay)
//   h.alHablar = linea => bocadilloDe(blancaso, linea);    // opcional: lo que dice al aportar o si no llevas nada
//   await h.montar(grupoSala, posLocal);                    // posLocal: el suelo donde va la caja (mira hacia ti sola)
//   h.setMeta(300);                                         // opcional: la meta del capítulo (raya en el marcador)
//   h.actualizar(dt, [xr.manos.derecha, xr.manos.izquierda]);   h.quitar();
//
// Coste: caja 2 + cerdito 1 + marcador 1 + monedas 1 (instanciadas) + humo 1 = 6 llamadas de dibujo.
import * as THREE from 'three';
import { textura } from '../recursos.js';

const COL = { tinta: '#140c1c', amarillo: '#ffd628', rosa: '#ff5fa2', crema: '#fff3e6', carton: '#c8925a', cartonOsc: '#9c6b3c', morado: '#3b2a52' };
const ALTO_CAJA = 0.82, ALTO_CERDO = 0.24;
const RANURA = new THREE.Vector3(-0.006, ALTO_CAJA + ALTO_CERDO * 0.885, 0); // medido sobre obj-hucha.png (320×260)
const ENTRA = 0.11, SIGUE = 0.15;   // radio para empezar a aportar y para seguir aportando
const CADA = 0.12, DE = 10;
const LINEAS = ['Apuntado. Las cuentas casi cuadran.', 'Gracias. Una noche menos de bajón.', 'Esto sí que es una aso.'];
const LLENA = '¡Mil! ¡Unaké se queda!', YA_LLENA = 'La hucha ya está llena. ¡Unaké se queda!', SIN = 'Sin monchis no hay hucha. Haz encargos, rider.';

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _arriba = new THREE.Vector3(0, 1, 0);

export class Hucha {
  constructor({ motor, sonido = () => { }, ui = null, xr }) {
    Object.assign(this, { motor, sonido, ui, xr });
    this.alLlenar = null; this.alHablar = null; this.alAportar = null; // alAportar(cant, hucha) en cada moneda
    this.meta = null; this.g = null; this.manos = new Map(); this.monedas = []; this._clave = ''; this._t = 0;
  }
  get metaTotal() { return this.motor.metaHucha ?? this.motor.d?.META_HUCHA ?? 1000; }

  setMeta(n) { this.meta = n && n < this.metaTotal ? n : null; this._clave = ''; this._metaAvisada = this.motor.hucha >= (this.meta ?? Infinity); }

  async montar(grupo, posLocal = new THREE.Vector3(), haciaLocal = null) {
    const g = this.g = new THREE.Group(); g.name = 'hucha-aso';
    g.position.copy(posLocal); grupo.add(g);
    this.fija = !!haciaLocal;
    if (haciaLocal) g.rotation.y = Math.atan2(haciaLocal.x - posLocal.x, haciaLocal.z - posLocal.z);
    // la caja de fruta (cartón) con su casco de tinta
    // un solo material: el tono de cada cara va horneado en los vértices
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.34, ALTO_CAJA, 0.3));
    caja.geometry.clearGroups(); const col = []; const pos = caja.geometry.attributes.position;
    const tonos = [0.78, 0.78, 1.1, 0.6, 0.95, 0.88]; // +x −x +y −y +z −z
    for (let i = 0; i < pos.count; i++) { const k = tonos[Math.floor(i / 4)], c = new THREE.Color(COL.carton).multiplyScalar(k); col.push(c.r, c.g, c.b); }
    caja.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    caja.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    caja.position.y = ALTO_CAJA / 2;
    const casco = new THREE.Mesh(new THREE.BoxGeometry(0.356, ALTO_CAJA + 0.016, 0.316), new THREE.MeshBasicMaterial({ color: COL.tinta, side: THREE.BackSide }));
    casco.position.y = ALTO_CAJA / 2;
    g.add(caja, casco);
    // el cerdito
    const t = await textura('base/assets/img/obj-hucha.png');
    const asp = t.image.width / t.image.height;
    this.cerdo = new THREE.Mesh(new THREE.PlaneGeometry(ALTO_CERDO * asp, ALTO_CERDO).translate(0, ALTO_CERDO / 2, 0), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.cerdo.position.y = ALTO_CAJA; g.add(this.cerdo);
    // el marcador
    this.lienzoM = lienzo(512, 256);
    this.texM = new THREE.CanvasTexture(this.lienzoM); this.texM.colorSpace = THREE.SRGBColorSpace; this.texM.anisotropy = 4;
    this.marcador = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: this.texM, transparent: true }));
    this.marcador.position.set(0, ALTO_CAJA + ALTO_CERDO + 0.14, 0); g.add(this.marcador);
    // monedas (fichas monchi) instanciadas
    const tm = await textura('base/assets/img/obj-ficha-monchi.png');
    if (this.g !== g) return this; // la quitaron mientras cargaba (saliste de la plaza enseguida)
    this.fichas = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.045, 0.045), new THREE.MeshBasicMaterial({ map: tm, alphaTest: 0.5, side: THREE.DoubleSide }), 12);
    this.fichas.count = 0; this.fichas.frustumCulled = false; g.add(this.fichas);
    this._humo();
    this._dibujar(true);
    this._llenaAvisada = this.motor.hucha >= this.metaTotal;
    return this;
  }

  _humo() {
    const N = 60, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const c = lienzo(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.humo = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: COL.amarillo, size: 0.06, transparent: true, depthWrite: false }));
    this.humo.visible = false; this.humo.frustumCulled = false;
    this.humo.userData = { vel: Array.from({ length: N }, () => new THREE.Vector3()), t: 0 };
    this.g.add(this.humo);
  }
  _celebrar() {
    const h = this.humo, pos = h.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, RANURA.x, RANURA.y, RANURA.z);
      const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.5;
      h.userData.vel[i].set(Math.cos(a) * r, 0.3 + Math.random() * 0.8, Math.sin(a) * r);
    }
    pos.needsUpdate = true; h.visible = true; h.userData.t = 1.8; h.material.size = 0.03; h.material.opacity = 1;
    this.sonido('oooh', { en: this.g, volumen: 0.7 });
    this.sonido('campanita', { en: this.g, volumen: 0.8 });
  }

  _dibujar(forzar = false) {
    const hucha = this.motor.hucha, monchis = this.motor.monchis, total = this.metaTotal;
    const clave = `${hucha}|${monchis}|${this.meta}`;
    if (!forzar && clave === this._clave) return;
    this._clave = clave;
    const c = this.lienzoM, x = c.getContext('2d');
    x.clearRect(0, 0, 512, 256);
    x.fillStyle = COL.crema; x.strokeStyle = COL.tinta; x.lineWidth = 8;
    x.beginPath(); x.roundRect(6, 6, 500, 244, 22); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = COL.tinta;
    x.font = '38px Caprasimo, serif'; x.fillText('La hucha de la aso', 256, 46);
    // barra
    const bx = 36, by = 86, bw = 440, bh = 44;
    x.fillStyle = '#3a3046'; x.beginPath(); x.roundRect(bx, by, bw, bh, 12); x.fill();
    const f = Math.min(1, hucha / total);
    if (f > 0) { x.fillStyle = COL.amarillo; x.beginPath(); x.roundRect(bx, by, Math.max(24, bw * f), bh, 12); x.fill(); }
    x.strokeStyle = COL.tinta; x.lineWidth = 6; x.beginPath(); x.roundRect(bx, by, bw, bh, 12); x.stroke();
    if (this.meta) { // la meta del capítulo: una raya rosa
      const mx = bx + bw * this.meta / total;
      x.strokeStyle = COL.rosa; x.lineWidth = 8; x.beginPath(); x.moveTo(mx, by - 12); x.lineTo(mx, by + bh + 12); x.stroke();
    }
    x.fillStyle = COL.tinta; x.font = '50px Caprasimo, serif';
    x.fillText(`${hucha} / ${total}`, 256, 172);
    x.font = '28px Caprasimo, serif'; x.fillStyle = '#5a4378';
    x.fillText(this.meta && hucha < this.meta ? `Este mes: ${this.meta} · llevas ${monchis}` : `Llevas ${monchis} monchis`, 256, 222);
    this.texM.needsUpdate = true;
  }

  actualizar(dt, manos = [this.xr.manos.derecha, this.xr.manos.izquierda]) {
    if (!this.g) return;
    this._t += dt;
    // mira hacia ti (solo gira en vertical)
    if (!this.fija && this.g.parent) {
      const cab = this.g.parent.worldToLocal(_v.copy(this.xr.cabeza));
      const meta = Math.atan2(cab.x - this.g.position.x, cab.z - this.g.position.z);
      let d = meta - this.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.g.rotation.y += d * Math.min(1, dt * 3);
    }
    const ranura = this.g.localToWorld(_w.copy(RANURA).add(_v.set(0, 0.04, 0.02)));
    for (const m of manos) {
      if (!m) continue;
      let e = this.manos.get(m); if (!e) this.manos.set(m, e = { dentro: false, cuenta: 0, dado: 0, avisado: false });
      const sujeta = m.activa && (m.pinza || m.agarre), d = m.activa ? m.punta.distanceTo(ranura) : Infinity;
      if (sujeta && d < (e.dentro ? SIGUE : ENTRA)) {
        if (!e.dentro) { e.dentro = true; e.cuenta = 0; e.dado = 0; e.avisado = false; }
        e.cuenta -= dt;
        if (e.cuenta <= 0) { e.cuenta = CADA; this._echar(m, e); }
      } else if (e.dentro && !sujeta || e.dentro && d >= SIGUE) {
        e.dentro = false; e.cuenta = 0;
        if (e.dado > 0 && this.motor.hucha < this.metaTotal) this.alHablar?.(LINEAS[Math.floor(Math.random() * LINEAS.length)]);
      }
    }
    this._monedas(dt);
    // el cerdito se bambolea con cada moneda
    if (this._bote > 0) { this._bote -= dt; const k = Math.max(0, this._bote / 0.25); this.cerdo.scale.set(1 + 0.06 * k, 1 - 0.05 * k, 1); }
    // humo de fiesta
    const h = this.humo;
    if (h.visible) {
      h.userData.t -= dt; const pos = h.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const v = h.userData.vel[i]; v.multiplyScalar(1 - 1.8 * dt); v.y += 0.15 * dt; pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt); }
      pos.needsUpdate = true; h.material.size = 0.03 + (1.8 - h.userData.t) * 0.035; h.material.opacity = Math.min(1, h.userData.t / 0.8);
      if (h.userData.t <= 0) h.visible = false;
    }
    this._dibujar();
  }

  _echar(m, e) {
    if (this.motor.hucha >= this.metaTotal) {
      if (!e.avisado) { e.avisado = true; this.ui?.cartela('La hucha ya está llena', 2); this.alHablar?.(YA_LLENA); }
      return;
    }
    if (this.motor.monchis <= 0) {
      if (!e.avisado) { e.avisado = true; this.ui?.cartela('No llevas monchis', 2); this.sonido('bonk', { en: this.g, volumen: 0.3 }); m.vibrar(0.2, 30); this.alHablar?.(SIN); }
      return;
    }
    const cant = this.motor.aportar(DE);
    if (!cant) return;
    e.dado += cant;
    this.sonido('lata', { en: this.cerdo, volumen: 0.45, tono: 1.5 + Math.random() * 0.4 });
    m.vibrar(0.3, 20);
    this._bote = 0.25;
    this.monedas.push({ t: 0, desde: this.g.worldToLocal(m.punta.clone()), gira: Math.random() * 6 });
    this.alAportar?.(cant, this.motor.hucha);
    this._dibujar();
    if (this.meta && !this._metaAvisada && this.motor.hucha >= this.meta && this.motor.hucha < this.metaTotal) {
      this._metaAvisada = true; this._celebrar(); this.ui?.cartela(`¡Meta del capítulo! Hucha ${this.motor.hucha}/${this.metaTotal}`, 3);
      this.alLlenar?.(LINEAS[2], { meta: this.meta });
    }
    if (!this._llenaAvisada && this.motor.hucha >= this.metaTotal) {
      this._llenaAvisada = true; this._celebrar(); this.ui?.cartela(`¡Hucha llena! ${this.motor.hucha}/${this.metaTotal}`, 3.5);
      this.alLlenar?.(LLENA, { llena: true });
    }
  }

  _monedas(dt) {
    const f = this.fichas; let n = 0;
    const cab = this.g.worldToLocal(_v.copy(this.xr.cabeza));
    for (const c of [...this.monedas]) {
      c.t += dt; const k = Math.min(1, c.t / 0.22);
      if (c.t > 0.3) { this.monedas.splice(this.monedas.indexOf(c), 1); continue; }
      if (n >= 12) continue;
      const p = _w.copy(c.desde).lerp(RANURA, k); p.y += Math.sin(k * Math.PI) * 0.04 - Math.max(0, c.t - 0.22) * 0.4;
      _m.lookAt(cab, p, _arriba); _q.setFromRotationMatrix(_m);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(_arriba, c.gira + c.t * 9));
      _m.compose(p, _q, _s.setScalar(1 - Math.max(0, c.t - 0.22) * 6));
      f.setMatrixAt(n++, _m);
    }
    f.count = n; f.instanceMatrix.needsUpdate = true;
  }

  estado() { return { hucha: this.motor.hucha, monchis: this.motor.monchis, meta: this.meta, total: this.metaTotal, ranura: this.g ? this.g.localToWorld(RANURA.clone()) : null, aportando: [...this.manos.values()].some(e => e.dentro) }; }

  quitar() {
    if (!this.g) return;
    this.g.parent?.remove(this.g);
    this.g.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map && m.map.isCanvasTexture) m.map.dispose(); m.dispose(); } });
    this.g = null; this.monedas = []; this.manos.clear();
  }
}
