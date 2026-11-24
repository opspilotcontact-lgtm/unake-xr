// Bocadillos de cómic en 3D: globo blanco con tinta negra y piquito, letra Caprasimo, texto a máquina.
// Flotan sobre la cabeza de quien habla y miran siempre hacia ti. Uno por personaje.
import * as THREE from 'three';
import { AJUSTES } from './xr.js';

const W = 768, H = 384, PX_M = 0.0011; // ~85 cm de ancho a tamaño completo

export class Bocadillo {
  constructor() {
    this.lienzo = document.createElement('canvas'); this.lienzo.width = W; this.lienzo.height = H;
    this.ctx = this.lienzo.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.lienzo); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(W * PX_M, H * PX_M),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: true }));
    this.malla.renderOrder = 20; this.malla.visible = false;
    this.texto = ''; this.escrito = 0; this.vida = 0; this.aparecer = 0; this.color = '#ffffff';
  }

  mostrar(texto, dur, { color = '#ffffff' } = {}) {
    this.texto = texto; this.escrito = 0; this.vida = dur; this.aparecer = 0; this.color = color;
    this.malla.visible = true; this._pintar();
  }
  ocultar() { this.vida = 0; this.malla.visible = false; }

  _lineas(ctx, texto, ancho) {
    const palabras = texto.split(' '), out = []; let l = '';
    for (const p of palabras) {
      const prueba = l ? l + ' ' + p : p;
      if (ctx.measureText(prueba).width > ancho && l) { out.push(l); l = p; } else l = prueba;
    }
    if (l) out.push(l);
    return out;
  }

  _pintar() {
    const c = this.ctx; c.clearRect(0, 0, W, H);
    let tam = 58; c.font = `${tam}px Caprasimo, serif`;
    let lineas = this._lineas(c, this.texto, W - 120);
    while (lineas.length > 3 && tam > 30) { tam -= 6; c.font = `${tam}px Caprasimo, serif`; lineas = this._lineas(c, this.texto, W - 120); }
    const alto = lineas.length * tam * 1.12 + 56;
    const ancho = Math.min(W - 16, Math.max(...lineas.map(l => c.measureText(l).width)) + 90);
    const x0 = (W - ancho) / 2, y0 = Math.max(8, (H - 70 - alto) / 2 + 10);
    // globo
    c.lineWidth = 9; c.strokeStyle = '#140c1c'; c.fillStyle = this.color;
    c.beginPath(); c.roundRect(x0, y0, ancho, alto, 46); c.fill(); c.stroke();
    // piquito hacia abajo
    c.beginPath(); c.moveTo(W / 2 - 30, y0 + alto - 4); c.lineTo(W / 2 - 8, y0 + alto + 52); c.lineTo(W / 2 + 22, y0 + alto - 4);
    c.closePath(); c.fill(); c.stroke();
    c.fillRect(W / 2 - 26, y0 + alto - 12, 44, 12);
    // texto escrito hasta donde toca
    c.fillStyle = '#140c1c'; c.textAlign = 'center'; c.textBaseline = 'top';
    let quedan = Math.floor(this.escrito);
    lineas.forEach((l, i) => {
      const parte = l.slice(0, Math.max(0, quedan)); quedan -= l.length + 1;
      c.fillText(parte, W / 2, y0 + 28 + i * tam * 1.12);
    });
    this.tex.needsUpdate = true;
  }

  actualizar(dt, altoCabeza, camaraPos, padre) {
    if (!this.malla.visible) return;
    this.vida -= dt;
    if (this.vida <= 0) { this.malla.visible = false; return; }
    const antes = Math.floor(this.escrito);
    this.escrito = Math.min(this.texto.length, this.escrito + dt * 38);
    if (Math.floor(this.escrito) !== antes) this._pintar();
    this.aparecer = Math.min(1, this.aparecer + dt * 6);
    const salida = Math.min(1, this.vida * 4);
    // ~45-60 cm de ancho; de lejos crece para que la letra no baje de ~1° (a 3 m, 58 px = 6,4 cm × k)
    let base = Math.min(0.7, Math.max(0.5, altoCabeza / 1.6));
    if (camaraPos) base = Math.min(1.3, Math.max(base, 0.27 * this.malla.getWorldPosition(_w).distanceTo(camaraPos)));
    const k = easeBack(this.aparecer) * salida * base * (AJUSTES.texto || 1);
    this.malla.scale.setScalar(Math.max(0.001, k));
    this.malla.position.set(0, altoCabeza + 0.08 + 0.2 * k, 0.05);
    if (camaraPos) {
      _m.lookAt(_v.copy(camaraPos), this.malla.getWorldPosition(_w), _arriba);
      this.malla.quaternion.setFromRotationMatrix(_m);
      padre.getWorldQuaternion(_q).invert();
      this.malla.quaternion.premultiply(_q);
    }
  }
}
const easeBack = t => { const s = 1.7; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _arriba = new THREE.Vector3(0, 1, 0);
