// Las puertas entre salas (las salidas del 2D: izq/der por la calle o el pasillo, la puerta de Unaké, subir al
// techo) y «sigue el humo»: un hilo de humo dorado por el suelo hacia la puerta que te acerca a donde manda la
// historia. Cada puerta es UN cartón pintado (marco, humo dentro y cartel con el destino): 1 llamada de dibujo,
// más 1 del brillo de la guiada.
//
// Se cruza andando hasta ella (de verdad o con el joystick) o señalándola y pellizcando / gatillo.
//
//   const P = new Portales({ sonido });
//   P.montar(grupoDeLaSala, medidas, 'cocina');         // en coordenadas de la sala (tú en el origen, mirando a −Z)
//   P.guia(['plaza']);                                    // o null
//   en el bucle: const destino = P.actualizar(dt, { cabeza, manos, humo });   // id de sala al cruzar, o null
import * as THREE from 'three';
import { SALAS } from './salas.js';

// conexiones de una sala: [{ dest, tipo }]
export function conexiones(id) {
  const s = SALAS[id]; if (!s) return [];
  return ['izq', 'der', 'puerta', 'sube', 'baja'].filter(t => s[t]).map(t => ({ dest: s[t], tipo: t }));
}
// el siguiente paso desde `desde` hacia cualquiera de `metas` (búsqueda en anchura); null si ya estás o no hay camino
export function siguientePaso(desde, metas) {
  if (!metas?.length || metas.includes(desde)) return null;
  const previo = new Map([[desde, null]]), cola = [desde];
  while (cola.length) {
    const a = cola.shift();
    for (const { dest } of conexiones(a)) {
      if (previo.has(dest)) continue;
      previo.set(dest, a);
      if (metas.includes(dest)) {
        let paso = dest; while (previo.get(paso) !== desde) paso = previo.get(paso);
        return paso;
      }
      cola.push(dest);
    }
  }
  return null;
}

const ANCHO = 1.0, ALTO = 2.1;
const FLECHA = { izq: '←', der: '→', puerta: '↑', sube: '⇡', baja: '⇣' };

export class Portales {
  constructor({ sonido } = {}) {
    this.sonido = sonido; this.lista = []; this.metas = null; this.t = 0; this.cada = 0;
    this.rayo = new THREE.Raycaster(); this.id = null;
    this.brillo = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO * 1.5, ALTO * 1.25), new THREE.MeshBasicMaterial({ map: texturaBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.brillo.visible = false;
  }

  montar(grupo, medidas, id, { zLado: zFijo } = {}) {
    this.quitar();
    this.id = id;
    const { xl = -3, xr = 3, D = 3 } = medidas || {};
    const zLado = zFijo ?? -THREE.MathUtils.clamp(D * 0.5, 1.3, 2.4);
    for (const { dest, tipo } of conexiones(id)) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, ALTO), new THREE.MeshBasicMaterial({ map: pintarPuerta(SALAS[dest]?.nombre || dest, FLECHA[tipo]), transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
      m.geometry.translate(0, ALTO / 2, 0);
      // dónde: en las paredes de los lados (sin irse más de 2,6 m), al fondo o delante
      if (tipo === 'izq') { m.position.set(Math.max(xl + 0.3, -2.6), 0, zLado); m.rotation.y = Math.PI / 2; }
      else if (tipo === 'der') { m.position.set(Math.min(xr - 0.3, 2.6), 0, zLado); m.rotation.y = -Math.PI / 2; }
      else if (tipo === 'puerta') m.position.set(0.9, 0, -THREE.MathUtils.clamp(D - 0.3, 1.6, 3.2));
      else if (tipo === 'sube') m.position.set(-0.9, 0, -THREE.MathUtils.clamp(D - 0.3, 1.6, 3.2));
      else { m.position.set(0, 0, 1.6); m.rotation.y = Math.PI; }
      m.name = 'portal-' + dest;
      grupo.add(m);
      this.lista.push({ dest, tipo, malla: m, cerca: 0 });
    }
    this.grupo = grupo; grupo.add(this.brillo);
    this._colocarBrillo();
  }
  quitar() {
    for (const p of this.lista) { p.malla.parent?.remove(p.malla); p.malla.geometry.dispose(); p.malla.material.map?.dispose(); p.malla.material.dispose(); }
    this.lista = []; this.brillo.parent?.remove(this.brillo); this.brillo.visible = false; this.id = null;
  }

  // a dónde quiere llevarte la historia (ids de sala); null = sin guía
  guia(metas) { this.metas = metas?.length ? metas : null; this._colocarBrillo(); }
  get guiada() { return this.id ? this.lista.find(p => p.dest === siguientePaso(this.id, this.metas)) || null : null; }
  _colocarBrillo() {
    const g = this.guiada;
    this.brillo.visible = !!g;
    if (g) { this.brillo.position.copy(g.malla.position).add(new THREE.Vector3(0, ALTO / 2, 0)); this.brillo.rotation.copy(g.malla.rotation); this.brillo.translateZ(-0.02); }
  }

  actualizar(dt, { cabeza, manos, humo }) {
    if (!this.lista.length || !this.grupo?.parent) return null;
    this.t += dt;
    const g = this.guiada;
    if (g) this.brillo.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 3);
    // el hilo de humo: del suelo a tus pies hasta la puerta guiada
    if (g && humo) {
      this.cada -= dt;
      if (this.cada <= 0) {
        this.cada = 0.09;
        const fin = g.malla.getWorldPosition(_a).setY(0.12), ini = _b.copy(cabeza).setY(0.12);
        const total = ini.distanceTo(fin);
        if (total > 0.5) {
          const dir = _c.subVectors(fin, ini).normalize();
          const s = 0.35 + ((this.t * 0.9) % 1) * (total - 0.35);
          const pos = ini.clone().addScaledVector(dir, s); pos.x += (Math.random() - 0.5) * 0.08; pos.z += (Math.random() - 0.5) * 0.08;
          humo.soltar({ pos, vel: dir.clone().multiplyScalar(0.5), tam: 0.05, vida: 1.6, crece: 0.07, sube: 0.02, frena: 0.6, brillo: 0.85, alfa: 0.8 });
        }
      }
    }
    // cruzar: andando hasta ella, o señalarla y pellizcar
    for (const p of this.lista) {
      const w = p.malla.getWorldPosition(_a);
      const d = Math.hypot(w.x - cabeza.x, w.z - cabeza.z);
      if (d < 0.45) return this._cruzar(p);
    }
    for (const m of manos) {
      if (!m.activa) continue;
      const dir = m.esMano ? _c.subVectors(m.punta, cabeza).normalize() : _c.set(0, 0, -1).applyQuaternion(m.quat);
      this.rayo.set(m.esMano ? cabeza : m.pos, dir); this.rayo.far = 9;
      const hit = this.rayo.intersectObjects(this.lista.map(p => p.malla), false)[0];
      for (const p of this.lista) { const sobre = hit?.object === p.malla; p.malla.scale.setScalar(THREE.MathUtils.lerp(p.malla.scale.x, sobre ? 1.06 : 1, Math.min(1, dt * 10))); if (sobre && !p._sobre) m.vibrar?.(0.15, 15); p._sobre = sobre; }
      if (hit && m.empiezaPinza) { m.vibrar?.(0.8, 60); return this._cruzar(this.lista.find(p => p.malla === hit.object)); }
    }
    return null;
  }
  _cruzar(p) { this.sonido?.('puerta', { volumen: 0.5 }); return p.dest; }
}

function pintarPuerta(nombre, flecha) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 540; const g = c.getContext('2d');
  // el hueco: humo oscuro con remolinos
  const r = g.createRadialGradient(128, 330, 10, 128, 330, 190);
  r.addColorStop(0, '#6b4f9a'); r.addColorStop(0.55, '#2a1d40'); r.addColorStop(1, '#0d0816');
  g.fillStyle = r; g.fillRect(34, 120, 188, 410);
  g.strokeStyle = 'rgba(214,200,232,.25)'; g.lineWidth = 5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(128 + (i % 2 ? 18 : -14), 250 + i * 70, 30 + i * 9, 0.4 + i, 3.6 + i); g.stroke(); }
  // el marco de cartón, con su tinta
  g.lineJoin = 'round';
  g.fillStyle = '#3b2a52'; g.strokeStyle = '#140c1c'; g.lineWidth = 8;
  g.beginPath(); g.rect(14, 104, 228, 432); g.rect(40, 126, 176, 410); g.fill('evenodd'); g.stroke();
  // el cartel con el destino
  g.fillStyle = '#ffd628'; g.beginPath(); g.roundRect(8, 8, 240, 92, 16); g.fill(); g.stroke();
  g.fillStyle = '#140c1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '40px Caprasimo, serif'; g.fillText(flecha || '', 128, 36);
  let tam = 30; g.font = `${tam}px Caprasimo, serif`;
  while (g.measureText(nombre).width > 222 && tam > 16) { tam -= 2; g.font = `${tam}px Caprasimo, serif`; }
  g.fillText(nombre, 128, 74);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaBrillo() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 64, 8, 32, 64, 64);
  r.addColorStop(0, 'rgba(255,214,40,.9)'); r.addColorStop(1, 'rgba(255,214,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(c);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
