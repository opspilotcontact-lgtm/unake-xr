// El humo: una sola malla instanciada (un draw call) de bocanadas de dibujo (fx-humo-puff de la serie) que
// siempre te miran. Sirve para todo: la calada que sueltas, los aros, el humo de los demás, el ambiente del
// techo y la cortinilla entre mundos (la habitación se llena de humo y, cuando se va, estás en el otro lado).
// Regla del juego (17/11): el humo no tapa la vista salvo en la cortinilla, que es corta.
import * as THREE from 'three';
import { textura } from './recursos.js';

const MAX = 320;
const VERT = /* glsl */`
  attribute vec4 iPos;    // xyz, tamaño
  attribute vec4 iDatos;  // alfa, giro, brillo, -
  varying vec2 vUv; varying float vA; varying float vB;
  void main() {
    vUv = uv; vA = iDatos.x; vB = iDatos.z;
    vec3 derecha = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 arriba = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float c = cos(iDatos.y), s = sin(iDatos.y);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iPos.w;
    vec3 w = (modelMatrix * vec4(iPos.xyz, 1.0)).xyz + derecha * q.x + arriba * q.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uMapa; uniform vec3 uTinte;
  varying vec2 vUv; varying float vA; varying float vB;
  void main() {
    vec4 t = texture2D(uMapa, vUv);
    float a = t.a * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(t.rgb * uTinte, vec3(1.0), vB), a);
    #include <colorspace_fragment>
  }`;

export class Humo {
  static async crear(escena) {
    const h = new Humo(await textura('assets/escenarios/fx-humo-puff.png'));
    escena.add(h.malla);
    return h;
  }
  constructor(mapa) {
    const base = new THREE.PlaneGeometry(1, 0.82);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aDatos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iDatos', this.aDatos);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMapa: { value: mapa }, uTinte: { value: new THREE.Color('#ffffff') } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    this.malla = new THREE.Mesh(g, this.mat); this.malla.frustumCulled = false; this.malla.renderOrder = 10;
    this.malla.name = 'humo';
    this.p = []; // bocanadas vivas
    this.cortinilla = null;
  }

  // una bocanada: pos, vel (m/s), tam (m), vida (s), crece (m/s), sube (m/s²), brillo (0 = color del dibujo, 1 = blanco)
  soltar({ pos, vel = new THREE.Vector3(), tam = 0.12, vida = 2.5, crece = 0.12, sube = 0.05, frena = 1.2, brillo = 0.35, alfa = 0.9, tamMax = 3, ambiente = false }) {
    if (this.p.length >= MAX) this.p.shift();
    const b = { ambiente, pos: pos.clone(), vel: vel.clone(), tam, vida, edad: 0, crece, sube, frena, brillo, alfa, giro: Math.random() * 6.28, vgiro: (Math.random() - 0.5) * 0.6, tamMax };
    this.p.push(b);
    return b;
  }

  // lo que sueltas por la boca tras la calada: fuerza 0-1
  exhalar(boca, dir, fuerza = 0.6) {
    const n = 6 + Math.round(fuerza * 10);
    for (let i = 0; i < n; i++) {
      const d = dir.clone().multiplyScalar(0.35 + fuerza * 0.9 * (0.6 + Math.random() * 0.4));
      d.x += (Math.random() - 0.5) * 0.18; d.y += (Math.random() - 0.3) * 0.12; d.z += (Math.random() - 0.5) * 0.18;
      setTimeout(() => this.soltar({ pos: boca, vel: d, tam: 0.05 + Math.random() * 0.04, vida: 2.6 + Math.random() * 1.5, crece: 0.16, sube: 0.06, frena: 1.4 }), i * 45);
    }
  }
  // un aro: bocanadas pequeñas en círculo que se abre
  aro(boca, dir, tam = 0.05) {
    const eje = dir.clone().normalize();
    const u = new THREE.Vector3().crossVectors(eje, Math.abs(eje.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const v = new THREE.Vector3().crossVectors(eje, u);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      this.soltar({ pos: boca.clone().addScaledVector(r, tam), vel: eje.clone().multiplyScalar(0.55).addScaledVector(r, 0.09), tam: 0.035, vida: 3.2, crece: 0.02, sube: 0.015, frena: 0.35, brillo: 0.55 });
    }
  }
  // quita el humo de ambiente del bar (al volver a tu casa)
  disiparAmbiente() { for (const b of this.p) if (b.ambiente) b.vida = Math.min(b.vida, b.edad + 0.4); }
  // humito de la punta encendida
  hilo(punta) { this.soltar({ pos: punta, vel: new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.06, (Math.random() - 0.5) * 0.02), tam: 0.012, vida: 1.6, crece: 0.05, sube: 0.04, frena: 0.3, brillo: 0.6, alfa: 0.6 }); }

  // la cortinilla: la habitación se llena de humo alrededor de la cabeza; a mitad (cubierto) se llama a alCubrir
  // y luego el humo sube y se va. Unos 2,6 s en total, sin quitarte el mando.
  llenar(cabeza, alCubrir) {
    const bs = [];
    for (let i = 0; i < 70; i++) {
      const dir = new THREE.Vector3().randomDirection(); dir.y = dir.y * 0.6;
      const r = 0.45 + Math.random() * 1.4;
      const b = this.soltar({ pos: cabeza.clone().addScaledVector(dir, r * 1.8).setY(Math.max(0.1, cabeza.y + dir.y * r)), vel: dir.clone().multiplyScalar(-0.5 * r), tam: 0.05, vida: 99, crece: 2.4, sube: 0, frena: 1.8, brillo: 0.25, alfa: 1, tamMax: 0.9 + r * 0.9 });
      bs.push(b);
    }
    this.cortinilla = { bs, t: 0, cubierto: false, alCubrir, centro: cabeza.clone() };
  }

  actualizar(dt) {
    const c = this.cortinilla;
    if (c) {
      c.t += dt;
      if (!c.cubierto && c.t > 1.0) { c.cubierto = true; try { c.alCubrir?.(); } catch (e) { console.error(e); } }
      if (c.t > 1.3 && !c.soltado) {
        // se abre: cada bocanada se aleja de tu cabeza y se apaga rápido (menos de un segundo tapando)
        c.soltado = true;
        for (const b of c.bs) {
          const fuera = b.pos.clone().sub(c.centro); fuera.y = Math.abs(fuera.y) + 0.3;
          b.vel.copy(fuera.normalize().multiplyScalar(1.6)); b.frena = 0.4; b.sube = 0.4; b.crece = 0;
          b.vida = b.edad + 0.55 + Math.random() * 0.35;
        }
      }
      if (c.t > 1.35) this.cortinilla = null;
    }
    const vivos = [];
    for (const b of this.p) {
      b.edad += dt;
      if (b.edad >= b.vida) continue;
      b.vel.multiplyScalar(Math.max(0, 1 - b.frena * dt));
      b.vel.y += b.sube * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.tam = Math.min(b.tamMax, b.tam + b.crece * dt);
      b.giro += b.vgiro * dt;
      vivos.push(b);
    }
    this.p = vivos;
    // de lejos a cerca (transparencias): la cámara manda
    const cam = this._cam;
    if (cam) for (const b of vivos) b.d = b.pos.distanceToSquared(cam);
    vivos.sort((a, b) => (b.d || 0) - (a.d || 0));
    const P = this.aPos.array, Dt = this.aDatos.array;
    vivos.forEach((b, i) => {
      const fin = b.vida - b.edad;
      const a = b.alfa * Math.min(1, b.edad / 0.12) * Math.min(1, fin / 0.9);
      P[i * 4] = b.pos.x; P[i * 4 + 1] = b.pos.y; P[i * 4 + 2] = b.pos.z; P[i * 4 + 3] = b.tam;
      Dt[i * 4] = a; Dt[i * 4 + 1] = b.giro; Dt[i * 4 + 2] = b.brillo;
    });
    this.malla.geometry.instanceCount = vivos.length;
    this.aPos.needsUpdate = true; this.aDatos.needsUpdate = true;
  }
  mirarDesde(v) { this._cam = v; }
}
