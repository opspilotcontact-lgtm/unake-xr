// La puerta de Unaké, anclada a una pared real de tu casa: un trozo de la fachada de la serie (el hueco con el
// interior morado, sus ladrillos y el neón), con la hoja de la puerta encima, con bisagra.
// Es el final del piloto jugado (escenas/puerta.js del 2D): Perico pregunta la contraseña en bucle y lo que
// rompe el bucle no es acertar, es EMPUJAR. La puerta no tiene cerradura.
import * as THREE from 'three';
import { textura, sonido } from './recursos.js';
import { Bocadillo } from './bocadillo.js';

// medidas del recorte (herramientas/preparar_escenarios.py): fachada 262×454 px; hueco x 51-211, y 38-444
const ALTO_PUERTA = 1.9, PX = ALTO_PUERTA / 406;
const FACH_W = 262 * PX, FACH_H = 454 * PX;
const HUECO_X0 = (51 - 131) * PX, HUECO_Y0 = (454 - 444) * PX, HOJA_W = 160 * PX;

export class Puerta {
  static async crear() {
    const [fach, hoja, neon] = await Promise.all(['fachada', 'puerta', 'neon'].map(n => textura(`assets/escenarios/${n}.webp`)));
    return new Puerta(fach, hoja, neon);
  }
  constructor(fach, hoja, neon) {
    this.grupo = new THREE.Group(); this.grupo.name = 'puerta-unake';
    const fachada = new THREE.Mesh(new THREE.PlaneGeometry(FACH_W, FACH_H), new THREE.MeshBasicMaterial({ map: fach, transparent: true, depthWrite: false }));
    fachada.position.set(0, FACH_H / 2, 0.004); fachada.renderOrder = 1;
    // la luz que sale de dentro cuando se abre (detrás de la hoja)
    this.luz = new THREE.Mesh(new THREE.PlaneGeometry(HOJA_W * 0.96, ALTO_PUERTA * 0.98), new THREE.MeshBasicMaterial({ color: '#ff7ad1', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.luz.position.set(HUECO_X0 + HOJA_W / 2, HUECO_Y0 + ALTO_PUERTA / 2, 0.008); this.luz.renderOrder = 2;
    this.bisagra = new THREE.Group(); this.bisagra.position.set(HUECO_X0, HUECO_Y0, 0.012);
    const hojaM = new THREE.Mesh(new THREE.PlaneGeometry(HOJA_W, ALTO_PUERTA), new THREE.MeshBasicMaterial({ map: hoja, alphaTest: 0.5, side: THREE.DoubleSide }));
    hojaM.position.set(HOJA_W / 2, ALTO_PUERTA / 2, 0);
    // grosor de la hoja: un canto oscuro
    const canto = new THREE.Mesh(new THREE.BoxGeometry(0.035, ALTO_PUERTA * 0.98, 0.035), new THREE.MeshBasicMaterial({ color: '#1c2a33' }));
    canto.position.set(HOJA_W - 0.017, ALTO_PUERTA / 2, -0.02);
    this.bisagra.add(hojaM, canto); this.hoja = hojaM;
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05 * 210 / 390), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false }));
    this.neon.position.set(0.05, FACH_H + 0.12, 0.006); this.neon.rotation.z = 0.03; this.neon.renderOrder = 1;
    // la voz de Perico sale por la mirilla
    // (el bocadillo se dibuja ~1,55 m por encima de su origen: así queda junto a la mirilla, a la derecha de la puerta)
    this.mirilla = new THREE.Group(); this.mirilla.position.set(HUECO_X0 + HOJA_W + 0.42, 0.05, 0.12);
    this.bocadillo = new Bocadillo(); this.mirilla.add(this.bocadillo.malla);
    this.grupo.add(fachada, this.luz, this.bisagra, this.neon, this.mirilla);
    this.abierta = false; this.angulo = 0; this.meta = 0; this.vibra = 0; this.t = 0;
    this.empujable = false; this.alEmpujar = null;
  }

  // pegarla a la pared: punto en el suelo y normal hacia ti
  colocar(punto, normal) {
    this.grupo.position.copy(punto);
    this.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().setY(0).normalize());
    this.grupo.updateMatrixWorld(true);
  }
  // el centro del hueco y la dirección hacia ti, en el mundo (para tarjetas y para que salgan los personajes)
  delante(dist = 0.5, alto = 1.25) {
    return this.grupo.localToWorld(new THREE.Vector3(HUECO_X0 + HOJA_W / 2, alto, dist));
  }
  haciaFuera() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.grupo.quaternion); }

  perico(texto, dur) {
    this.bocadillo.mostrar(texto, dur ?? Math.min(5, 1.5 + texto.length * 0.06));
    this.vibra = 0.35; sonido('toc-toc', { en: this.mirilla, volumen: 0.5 });
  }

  abrir() {
    if (this.abierta) return;
    this.abierta = true; this.meta = 1.75; // hacia dentro de la pared: se mete en el hueco
    sonido('puerta', { en: this.mirilla, volumen: 0.9 });
  }

  actualizar(dt, camaraPos, manos) {
    this.t += dt;
    // neón que parpadea a veces
    const parpadeo = Math.sin(this.t * 37) > 0.97 || (this.t % 7 > 6.85) ? 0.55 : 1;
    this.neon.material.color.setScalar(parpadeo);
    // Perico aporrea desde dentro
    this.vibra = Math.max(0, this.vibra - dt);
    const tiembla = this.vibra > 0 && !this.abierta ? Math.sin(this.t * 70) * 0.012 * this.vibra : 0;
    this.angulo += (this.meta - this.angulo) * Math.min(1, dt * (this.abierta ? 2.2 : 10));
    this.bisagra.rotation.y = this.angulo + tiembla;
    this.luz.material.opacity = THREE.MathUtils.clamp(this.angulo / 1.75, 0, 1) * (0.55 + Math.sin(this.t * 3) * 0.05);
    this.bocadillo.actualizar(dt, 1.05, camaraPos, this.mirilla);
    // empujar: la mano entra en la hoja yendo hacia la pared
    if (this.empujable && !this.abierta && manos) {
      for (const m of manos) {
        if (!m.activa) continue;
        const l = this.bisagra.worldToLocal(_v.copy(m.pos));
        const dentroHoja = l.x > 0.05 && l.x < HOJA_W - 0.02 && l.y > 0.4 && l.y < ALTO_PUERTA - 0.1;
        const haciaPared = -m.vel.dot(this.haciaFuera());
        if (dentroHoja && l.z < 0.09 && l.z > -0.15 && (haciaPared > 0.25 || m.empiezaPinza)) {
          m.vibrar(0.9, 80);
          this.empujable = false;
          this.alEmpujar?.();
          return;
        }
        // al acercar la mano, la hoja cede un poco: se nota que se mueve
        if (dentroHoja && l.z < 0.2 && l.z > -0.1) this.meta = 0.08 * (1 - THREE.MathUtils.clamp(l.z / 0.2, 0, 1));
        else if (!this.abierta) this.meta = 0;
      }
    }
  }
}
const _v = new THREE.Vector3();
