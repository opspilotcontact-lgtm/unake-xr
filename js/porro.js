// Liar y fumar con las manos (o los mandos). Es el corazón del bucle: liar → encender → calada → soltar el humo
// → pasarlo. Las mecánicas salen de liar.js y fumar.js del 2D (franjas de calada anidadas alrededor de 70 de 100,
// el mechero que falla una vez, la tos si te pasas), pero con gestos del cuerpo:
//   PICAR     dar palmadas sobre el montón
//   RELLENAR  pellizcar encima del papel: cae de tus dedos; soltar cuando esté lleno
//   LIAR      pasar la mano por encima del papel, de un lado a otro
//   CERRAR    cogerlo y llevártelo a la boca (lametón)
//   ENCENDER  la llama del mechero (pellizco de la otra mano) en la punta
//   CALADA    la boquilla en los labios: el medidor sube solo; apartarlo para parar
//   SOLTAR    soplando de verdad (micro) o solo, al rato
import * as THREE from 'three';
import { sonido } from './recursos.js';

// copiado de base/js/escenas/fumar.js (NIVELES_CALADA), para que la escalada sea la misma que en el 2D
export const CENTRO_CALADA = 70;
export const NIVELES_CALADA = [
  { id: 'bien', nombre: 'Bien', mitad: 15, color: 0x7ee081, sube: 9 },
  { id: 'buena', nombre: 'Buena', mitad: 11.5, color: 0x5adceb, sube: 10 },
  { id: 'muybuena', nombre: 'Muy buena', mitad: 8.5, color: 0x4d8bff, sube: 12 },
  { id: 'epica', nombre: 'Épica', mitad: 6, color: 0xb68cff, sube: 15 },
  { id: 'leyenda', nombre: 'Leyenda', mitad: 4, color: 0xff5fa2, sube: 19 },
  { id: 'snoop', nombre: 'Snoop Dogo', mitad: 2.4, color: 0xff9a3c, sube: 24 },
  { id: '420', nombre: '420', mitad: 1.1, color: 0xffd23f, sube: 32 },
];
export function nivelDe(valor) {
  let mejor = null;
  for (const n of NIVELES_CALADA) if (Math.abs(valor - CENTRO_CALADA) <= n.mitad) mejor = n;
  return mejor;
}

// contorno de dibujo animado: la misma malla, un poco más grande, por dentro y en negro
function conTinta(malla, grosor = 1.12) {
  const t = new THREE.Mesh(malla.geometry, new THREE.MeshBasicMaterial({ color: '#140c1c', side: THREE.BackSide }));
  t.scale.setScalar(grosor); malla.add(t); return malla;
}

// ======================================================================================
export class Porro {
  constructor() {
    this.grupo = new THREE.Group(); this.grupo.name = 'porro';
    this.largo = 0.09;
    // el eje va por +z: la boquilla en z=0 y la punta en z=largo
    const papel = conTinta(new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0042, this.largo, 12, 1, false), new THREE.MeshBasicMaterial({ color: '#fbf6ea' })), 1.13);
    papel.rotation.x = Math.PI / 2; papel.position.z = this.largo / 2;
    const boquilla = new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0044, 0.016, 10), new THREE.MeshBasicMaterial({ color: '#c99a62' }));
    boquilla.rotation.x = Math.PI / 2; boquilla.position.z = 0.006;
    this.brasa = new THREE.Mesh(new THREE.SphereGeometry(0.0066, 10, 8), new THREE.MeshBasicMaterial({ color: '#4a4a4a' }));
    this.brasa.position.z = this.largo; this.brasa.scale.z = 0.5;
    this.papel = papel;
    this.grupo.add(papel, boquilla, this.brasa);
    this.encendido = false; this.caladas = 0; this.caladasMax = 14; this.calidad = 1;
    this.t = 0; this.cadaHilo = 0;
    this.mano = null; // la Mano que lo lleva (o null si lo lleva un personaje / está suelto)
  }
  puntaMundo(v = new THREE.Vector3()) { return this.brasa.getWorldPosition(v); }
  boquillaMundo(v = new THREE.Vector3()) { return this.grupo.localToWorld(v.set(0, 0, 0)); }
  get consumido() { return this.caladas >= this.caladasMax; }

  encender() { this.encendido = true; }
  gastar() {
    this.caladas++;
    const k = 1 - this.caladas / this.caladasMax * 0.6;
    this.papel.scale.y = k; this.papel.position.z = this.largo * k / 2; this.brasa.position.z = this.largo * k;
  }

  // sujeto entre los dedos: la boquilla hacia tu boca, la punta hacia fuera
  seguirMano(mano, boca) {
    const dir = _a.copy(mano.punta).sub(boca);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.grupo.position.copy(mano.punta).addScaledVector(dir, -0.028);
    this.grupo.quaternion.setFromUnitVectors(_z, dir);
  }

  actualizar(dt, humo) {
    this.t += dt;
    if (this.encendido) {
      const brilla = 0.75 + Math.sin(this.t * 9) * 0.1 + Math.random() * 0.15;
      this.brasa.material.color.setRGB(1, 0.35 * brilla, 0.08 * brilla);
      this.cadaHilo -= dt;
      if (this.cadaHilo <= 0 && humo) { this.cadaHilo = 0.16; humo.hilo(this.puntaMundo(_b)); }
    }
  }
}

// ======================================================================================
export class Mechero {
  constructor() {
    this.grupo = new THREE.Group(); this.grupo.name = 'mechero';
    const cuerpo = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.062, 0.013), new THREE.MeshBasicMaterial({ color: '#ff5fa2' })), 1.1);
    const tapa = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.014), new THREE.MeshBasicMaterial({ color: '#c0c0c8' }));
    tapa.position.y = 0.037;
    this.llama = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.026, 10), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95 }));
    this.llama.position.y = 0.058; this.llama.visible = false;
    const nucleo = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.013, 8), new THREE.MeshBasicMaterial({ color: '#ff7a2b' }));
    nucleo.position.y = -0.005; this.llama.add(nucleo);
    this.grupo.add(cuerpo, tapa, this.llama);
    this.intentos = 0; this.encendida = 0; this.t = 0;
  }
  llamaMundo(v = new THREE.Vector3()) { return this.llama.getWorldPosition(v); }
  // la primera vez falla, como todos (fumar.js)
  chasquear() {
    this.intentos++;
    if (this.intentos === 1) { sonido('mechero-falla', { en: this.grupo, volumen: 0.8 }); return false; }
    sonido('mechero', { en: this.grupo, volumen: 0.8 });
    this.encendida = 1.6; return true;
  }
  seguirMano(mano) {
    this.grupo.position.copy(mano.punta).addScaledVector(_a.set(0, -1, 0).applyQuaternion(mano.quat), 0.02);
    // de pie, girado con la mano solo en horizontal: la llama siempre sube
    _e.setFromQuaternion(mano.quat, 'YXZ');
    this.grupo.rotation.set(0, _e.y, 0);
  }
  actualizar(dt, mano) {
    this.t += dt;
    if (mano?.pinza && this.encendida > 0) this.encendida = Math.max(this.encendida, 0.15);
    this.encendida = Math.max(0, this.encendida - dt);
    this.llama.visible = this.encendida > 0;
    if (this.llama.visible) this.llama.scale.set(1 + Math.sin(this.t * 31) * 0.12, 1 + Math.sin(this.t * 23) * 0.2, 1);
  }
}

// ======================================================================================
// La bandeja de liar: se pone en tu mesa real (o delante, a la altura de la cintura)
export class Liar {
  constructor() {
    this.grupo = new THREE.Group(); this.grupo.name = 'bandeja';
    const tabla = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 0.24), new THREE.MeshBasicMaterial({ color: '#3b2a52' })), 1.02);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.006, 0.25), new THREE.MeshBasicMaterial({ color: '#ff5fa2' }));
    borde.position.y = -0.006;
    this.grupo.add(tabla, borde);
    // el papel, a la derecha; el montón, a la izquierda
    this.papel = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.052), new THREE.MeshBasicMaterial({ color: '#fbf6ea' }));
    this.papel.rotation.x = -Math.PI / 2; this.papel.position.set(0.06, 0.0085, 0.02);
    this.montonBase = new THREE.Vector3(-0.09, 0.022, 0);
    this.monton = conTinta(new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 1), new THREE.MeshBasicMaterial({ color: '#6b7a3a' })), 1.08);
    this.monton.scale.set(1, 0.55, 1); this.monton.position.copy(this.montonBase);
    // el relleno: un cilindro que crece tumbado sobre el papel
    this.relleno = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.085, 10), new THREE.MeshBasicMaterial({ color: '#7d8a45' }));
    this.relleno.rotation.z = Math.PI / 2; this.relleno.position.set(0.06, 0.012, 0.02); this.relleno.scale.set(0.01, 1, 0.01);
    // migas (instanciadas: un solo dibujo)
    this.migas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.004, 0.006), new THREE.MeshBasicMaterial({ color: '#566330' }), 80);
    this.migas.count = 0;
    this.grupo.add(this.papel, this.monton, this.relleno, this.migas);
    this.paso = 'picar'; this.golpes = 0; this.lleno = 0; this.pasadas = 0; this._lado = 0; this._ext = null;
    this.enfriar = 0; this.porro = null; this.calidad = 1;
    this.alCambiarPaso = null;
  }

  colocar(punto, haciaMi) {
    this.grupo.position.copy(punto);
    this.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), haciaMi.clone().setY(0).normalize());
    this.grupo.updateMatrixWorld(true);
  }

  _cambiar(paso) { this.paso = paso; this.alCambiarPaso?.(paso); }

  _miga(x, z) {
    if (this.migas.count >= 80) return;
    _m.makeRotationY(Math.random() * 3).setPosition(x, 0.009, z);
    this.migas.setMatrixAt(this.migas.count++, _m); this.migas.instanceMatrix.needsUpdate = true;
  }

  // devuelve el Porro cuando está liado y cerrado
  actualizar(dt, manos, boca) {
    this.enfriar = Math.max(0, this.enfriar - dt);
    const locales = manos.filter(m => m.activa).map(m => ({ m, l: this.grupo.worldToLocal(m.punta.clone()), lp: this.grupo.worldToLocal(m.pos.clone()) }));
    if (this.paso === 'picar') {
      for (const { m, lp, l } of locales) {
        const cerca = Math.hypot(l.x - this.montonBase.x, l.z - this.montonBase.z) < 0.1 || Math.hypot(lp.x - this.montonBase.x, lp.z - this.montonBase.z) < 0.1;
        const vy = m.vel.y;
        if (cerca && Math.min(l.y, lp.y) < 0.13 && vy < -0.45 && this.enfriar <= 0) {
          this.enfriar = 0.2; this.golpes++;
          m.vibrar(0.7, 40); sonido('chof', { en: this.grupo, volumen: 0.6, tono: 0.9 + Math.random() * 0.3 });
          this.monton.scale.multiplyScalar(0.9); this.monton.scale.y = Math.max(0.2, this.monton.scale.y * 0.85);
          for (let i = 0; i < 6; i++) this._miga(this.montonBase.x + (Math.random() - 0.5) * 0.09, (Math.random() - 0.5) * 0.08);
          if (this.golpes >= 6) this._cambiar('rellenar');
        }
      }
    } else if (this.paso === 'rellenar') {
      let echando = false;
      for (const { m, l } of locales) {
        const encima = Math.abs(l.x - 0.06) < 0.08 && Math.abs(l.z - 0.02) < 0.06 && l.y > 0 && l.y < 0.14;
        if (encima && m.pinza) {
          echando = true;
          this.lleno += dt / 1.8;
          if (Math.random() < dt * 25) this._miga(0.06 + (Math.random() - 0.5) * 0.07, 0.02 + (Math.random() - 0.5) * 0.02);
          if (Math.random() < dt * 8) m.vibrar(0.15, 10);
        }
        if (m.acabaPinza && this.lleno > 0.55) {
          this.calidad = this.lleno > 1.35 ? 0.75 : this.lleno < 0.8 ? 0.85 : 1;
          this._cambiar('liar');
        }
      }
      this.monton.visible = this.lleno < 0.95;
      const k = Math.min(1.5, this.lleno);
      this.relleno.scale.set(Math.max(0.01, k), 1, Math.max(0.01, k));
      this._echando = echando;
    } else if (this.paso === 'liar') {
      // pasadas de un lado a otro por encima del papel (con 5 cm de recorrido cuentan)
      for (const { m, l } of locales) {
        const encima = Math.abs(l.x - 0.06) < 0.14 && Math.abs(l.z - 0.02) < 0.1 && l.y > -0.01 && l.y < 0.16;
        if (!encima) continue;
        if (this._ext === null) this._ext = l.x;
        const lado = Math.sign(l.x - this._ext);
        if (Math.abs(l.x - this._ext) > 0.05 && lado !== 0 && lado !== this._lado) {
          this._lado = lado; this._ext = l.x; this.pasadas++;
          sonido('papel', { en: this.grupo, volumen: 0.6, tono: 0.9 + this.pasadas * 0.05 }); m.vibrar(0.3, 25);
        } else if (lado === this._lado) this._ext = lado > 0 ? Math.max(this._ext, l.x) : Math.min(this._ext, l.x);
      }
      const k = Math.min(1, this.pasadas / 4);
      this.papel.scale.y = 1 - k * 0.8;
      this.relleno.material.color.set(k > 0.5 ? '#fbf6ea' : '#7d8a45');
      if (this.pasadas >= 4) {
        this.papel.visible = false; this.relleno.visible = false;
        this.porro = new Porro(); this.porro.calidad = this.calidad;
        this.porro.grupo.position.set(0.06, 0.016, 0.02); this.porro.grupo.rotation.y = Math.PI / 2;
        this.grupo.add(this.porro.grupo);
        this._cambiar('coger');
      }
    } else if (this.paso === 'coger') {
      // pellizcarlo para cogerlo
      for (const { m } of locales) {
        const p = this.porro.grupo.getWorldPosition(_a);
        if (m.empiezaPinza && m.punta.distanceTo(p) < 0.1) {
          this.porro.mano = m; m.vibrar(0.5, 30);
          this.grupo.parent.attach(this.porro.grupo);
          this._lamer = 0; this._cambiar('cerrar');
          break;
        }
      }
    } else if (this.paso === 'cerrar') {
      const m = this.porro.mano;
      if (!m?.pinza && m?.esMano === false) { /* con mando hay que mantener el gatillo: si suelta, se queda en la mano igual */ }
      this.porro.seguirMano(m, boca);
      if (this.porro.grupo.getWorldPosition(_a).distanceTo(boca) < 0.11) {
        this._lamer += dt;
        if (this._lamer > 0.5) { sonido('sorbo', { volumen: 0.8 }); m.vibrar(0.4, 60); this._cambiar('hecho'); return this.porro; }
      }
    }
    return null;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _e = new THREE.Euler(), _m = new THREE.Matrix4();
