// Ayudas comunes de los minijuegos nativos (no es un minijuego: no tiene `crear`).
//   · demo(): la «mano fantasma» que hace el gesto 2-3 s al empezar, con una flecha, para que se entienda sin texto.
//   · chispas(): un estallido de partículas (UNA sola llamada de dibujo para todo el minijuego).
//   · acierto(): chispas + vibración + sonido, el «jugo» de cada acierto.
//   · fusionar(): junta las mallas quietas de un decorado por material (menos llamadas de dibujo en la Quest).
// Uso: const fx = new Jugo(ctx, grupo); … fx.actualizar(dt) en tu actualizar; fx.destruir() en tu destruir.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX_CHISPAS = 220;
let texChispa = null;
function texturaChispa() {
  if (texChispa) return texChispa;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  texChispa = new THREE.CanvasTexture(c); texChispa.colorSpace = THREE.SRGBColorSpace;
  return texChispa;
}

// la mano fantasma: palma + índice + pulgar (3 mallas, un material)
function crearManoFantasma() {
  const mat = new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0, depthWrite: false });
  const g = new THREE.Group();
  const palma = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mat); palma.scale.set(1, 0.42, 1.15); g.add(palma);
  const dedo = new THREE.CapsuleGeometry(0.011, 0.055, 4, 8); dedo.translate(0, 0.0385, 0); dedo.rotateX(-Math.PI / 2);
  const indice = new THREE.Group(); indice.position.set(0.012, 0, -0.045); indice.add(new THREE.Mesh(dedo, mat)); g.add(indice);
  const pulgar = new THREE.Group(); pulgar.position.set(-0.04, 0, -0.01); pulgar.add(new THREE.Mesh(dedo, mat)); pulgar.rotation.y = 0.75; g.add(pulgar);
  // resto de dedos: una sola cápsula ancha (se cierran con el puño)
  const resto = new THREE.Group(); resto.position.set(0.035, 0, -0.04); const rm = new THREE.Mesh(dedo, mat); rm.scale.set(2.2, 0.9, 0.9); resto.add(rm); g.add(resto);
  g.renderOrder = 60; g.traverse(o => { o.renderOrder = 60; });
  return { g, mat, indice, pulgar, resto };
}

// flecha plana que apunta en la dirección del gesto
function crearFlecha() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.05); s.lineTo(0.04, 0.012); s.lineTo(0.016, 0.012); s.lineTo(0.016, -0.05); s.lineTo(-0.016, -0.05); s.lineTo(-0.016, 0.012); s.lineTo(-0.04, 0.012); s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  m.renderOrder = 61;
  return m;
}

export class Jugo {
  constructor(ctx, grupo) {
    this.ctx = ctx; this.grupo = grupo; this.t = 0;
    // chispas: posiciones en coordenadas del MUNDO (la malla no hereda la del grupo)
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_CHISPAS * 3); this.col = new Float32Array(MAX_CHISPAS * 3);
    this.vel = new Float32Array(MAX_CHISPAS * 3); this.vida = new Float32Array(MAX_CHISPAS);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.puntos = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, map: texturaChispa(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.puntos.frustumCulled = false; this.puntos.matrixAutoUpdate = false; this.puntos.matrixWorldAutoUpdate = false; this.puntos.renderOrder = 50;
    this.puntos.visible = false;
    grupo.add(this.puntos);
    this.n = 0; this.demos = [];
  }

  // estallido de n chispas en `p` (mundo)
  chispas(p, color = '#ffd23f', n = 18, fuerza = 1.2) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      let i = this.n < MAX_CHISPAS ? this.n++ : Math.floor(Math.random() * MAX_CHISPAS);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = fuerza * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * v; this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * v * 0.9 + 0.3; this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v;
      const tono = 0.8 + Math.random() * 0.4;
      this.col[i * 3] = c.r * tono; this.col[i * 3 + 1] = c.g * tono; this.col[i * 3 + 2] = c.b * tono;
      this.vida[i] = 0.45 + Math.random() * 0.35;
    }
    this.puntos.visible = true;
  }

  // el jugo de un acierto: chispas, vibración en la mano y un sonido con el tono que sube con la racha
  acierto(p, { mano = null, color = '#ffd23f', n = 18, sonido = 'campanita', racha = 0, fuerte = false } = {}) {
    this.chispas(p, color, fuerte ? n * 2 : n, fuerte ? 1.8 : 1.2);
    mano?.vibrar?.(fuerte ? 1 : 0.6, fuerte ? 110 : 50);
    if (sonido) this.ctx.sonido?.(sonido, { volumen: 0.35, tono: 1 + Math.min(8, racha) * 0.06 });
  }
  fallo(p, { mano = null } = {}) {
    if (p) this.chispas(p, '#8a7f99', 8, 0.5);
    mano?.vibrar?.(0.25, 30);
  }

  // «cómo se juega» en el propio mundo: una mano fantasma recorre `pasos` (posiciones del mundo) haciendo el gesto.
  //   pasos: [{ p: Vector3, pinza?: bool, puno?: bool, mira?: Vector3 }]  (cada tramo dura `tramo` s)
  //   opciones: { dur: s en total (2,5-3), tramo: s por paso, flecha: bool, mira: hacia dónde mira la palma }
  demo(pasos, { dur = 2.8, tramo = 0.6, flecha = true, retraso = 0.3, escala = 1 } = {}) {
    if (!pasos?.length) return null;
    const m = crearManoFantasma(); m.g.scale.setScalar(escala); m.g.visible = false; this.grupo.add(m.g);
    const f = flecha ? crearFlecha() : null; if (f) { f.visible = false; this.grupo.add(f); }
    const d = { m, f, pasos, dur, tramo, t: -retraso, vivo: true };
    this.demos.push(d);
    return { quitar: () => { d.t = d.dur; } };
  }
  _paso(d, dt) {
    d.t += dt;
    const { m, f, pasos } = d;
    if (d.t < 0) return true;
    if (d.t >= d.dur) { this.grupo.remove(m.g); if (f) this.grupo.remove(f); m.mat.dispose(); m.g.traverse(o => o.geometry?.dispose()); if (f) { f.geometry.dispose(); f.material.dispose(); } return false; }
    const alfa = Math.min(1, d.t / 0.25, (d.dur - d.t) / 0.35);
    m.mat.opacity = 0.55 * alfa; m.g.visible = true;
    const ciclo = pasos.length === 1 ? 0 : (d.t / d.tramo) % (pasos.length - 1 + 0.5); // medio tramo de pausa al final
    const i = Math.min(pasos.length - 2, Math.floor(ciclo)), k = pasos.length === 1 ? 0 : Math.min(1, ciclo - i);
    const a = pasos[Math.max(0, i)], b = pasos[Math.min(pasos.length - 1, i + 1)];
    const e = k * k * (3 - 2 * k);
    m.g.position.copy(a.p).lerp(b.p, e);
    // mira a la cabeza (la palma hacia abajo, los dedos hacia delante)
    const cab = this.ctx.xr.cabeza, haciaDelante = m.g.position.clone().sub(cab).setY(0);
    if (haciaDelante.lengthSq() > 1e-4) m.g.rotation.set(0, Math.atan2(-haciaDelante.x, -haciaDelante.z), 0);
    const cierra = (k > 0.5 ? b : a);
    const pinza = cierra.pinza ? 1 : 0, puno = cierra.puno ? 1 : 0;
    m.indice.rotation.x = THREE.MathUtils.lerp(m.indice.rotation.x, -(pinza * 0.9 + puno * 1.6), Math.min(1, dt * 14));
    m.pulgar.rotation.x = THREE.MathUtils.lerp(m.pulgar.rotation.x, -(pinza * 0.5 + puno * 0.8), Math.min(1, dt * 14));
    m.resto.rotation.x = THREE.MathUtils.lerp(m.resto.rotation.x, -puno * 1.6, Math.min(1, dt * 14));
    if (f) {
      f.visible = true; f.material.opacity = 0.9 * alfa;
      const de = pasos[0].p, a2 = pasos[pasos.length - 1].p;
      const dir = a2.clone().sub(de);
      if (dir.lengthSq() < 1e-5) { f.visible = false; }
      else {
        // la flecha flota encima del recorrido, de cara a ti, apuntando hacia el final
        const centro = de.clone().lerp(a2, 0.5); centro.y += 0.09;
        f.position.copy(centro);
        f.lookAt(cab);
        const enPlano = dir.clone().applyQuaternion(f.quaternion.clone().invert());
        f.rotateZ(Math.atan2(enPlano.y, enPlano.x) - Math.PI / 2);
        const pulso = 0.7 * (1 + 0.15 * Math.sin(d.t * 9));
        f.scale.setScalar(pulso);
      }
    }
    return true;
  }

  actualizar(dt) {
    this.t += dt;
    if (this.demos.length) this.demos = this.demos.filter(d => this._paso(d, dt));
    if (!this.puntos.visible) return;
    let vivos = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) continue;
      this.vida[i] -= dt;
      if (this.vida[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      vivos++;
      this.vel[i * 3 + 1] -= 3.2 * dt;
      const fr = Math.max(0, 1 - dt * 2.5);
      this.vel[i * 3] *= fr; this.vel[i * 3 + 2] *= fr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    const g = this.puntos.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    if (!vivos) { this.puntos.visible = false; this.n = 0; }
  }

  destruir() {
    for (const d of this.demos) { d.t = d.dur; this._paso(d, 0); }
    this.demos = [];
    this.grupo.remove(this.puntos); this.puntos.geometry.dispose(); this.puntos.material.dispose();
  }
}

// Junta las mallas QUIETAS de `raiz` (respecto a `raiz`) por material parecido: mismo lado, misma transparencia y
// misma imagen de textura (la repetición/desplazamiento de cada clon se hornea en las UV; el color, en el vértice).
// Las mallas originales se quedan en su sitio (por si tienen hijos que se mueven) pero dejan de dibujarse.
//   filtro(malla) → true si se puede fusionar. Devuelve cuántas llamadas de dibujo se ahorran.
const MAT_NADA = new THREE.MeshBasicMaterial({ visible: false });
export function fusionar(raiz, filtro = () => true) {
  raiz.updateMatrixWorld(true);
  const inv = raiz.matrixWorld.clone().invert();
  const grupos = new Map();
  raiz.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.material?.isMeshBasicMaterial) return;
    if (!o.visible || !o.material.visible || o.material.onBeforeCompile?.toString().includes('diffuse') || !filtro(o)) return;
    let v = o.parent, visible = true; while (v && v !== raiz) { if (!v.visible) visible = false; v = v.parent; }
    if (!visible) return;
    const m = o.material, map = m.map;
    if (map && (map.isCanvasTexture && !map.image?.width)) return;
    const clave = [m.side, m.transparent ? 1 : 0, m.opacity, m.alphaTest, m.depthTest ? 1 : 0, m.depthWrite ? 1 : 0, map ? (map.source.uuid + '|' + map.wrapS + '|' + map.wrapT + '|' + map.rotation) : '-', o.renderOrder].join('·');
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(o);
  });
  let ahorro = 0;
  const m4 = new THREE.Matrix4();
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const geos = [];
    for (const o of lista) {
      let g = o.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      for (const nombre of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nombre)) g.deleteAttribute(nombre);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      const map = o.material.map;
      if (map) { // repetición, desplazamiento (y matriz) de este clon, horneados en las UV
        map.updateMatrix();
        const uv = g.attributes.uv, v = new THREE.Vector3();
        for (let i = 0; i < uv.count; i++) { v.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(map.matrix); uv.setXY(i, v.x, v.y); }
      }
      const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld));
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!geo) continue;
    const base = lista[0].material;
    const mat = base.clone(); mat.color.set('#ffffff'); mat.vertexColors = true;
    if (base.map) { const t = base.map.clone(); t.repeat.set(1, 1); t.offset.set(0, 0); t.center.set(0, 0); t.rotation = 0; t.needsUpdate = true; mat.map = t; }
    const fusion = new THREE.Mesh(geo, mat); fusion.name = 'fusion'; fusion.renderOrder = lista[0].renderOrder;
    fusion.userData.fusion = true;
    raiz.add(fusion);
    for (const o of lista) o.material = MAT_NADA;
    ahorro += lista.length - 1;
  }
  return ahorro;
}

// Una geometría con varios materiales (caja o cilindro: un grupo por cara) → UNA geometría y UN material.
// Las caras con textura la conservan; las de color liso llevan su color en el vértice (alfa 1 = liso).
// Todas las caras con textura tienen que usar la MISMA textura. Pasa de 3-6 llamadas de dibujo a 1.
export function unaMalla(geo, mats) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count, col = new Float32Array(n * 4).fill(1);
  let map = null;
  const grupos = geo.index ? geo.groups.map(gr => ({ ...gr })) : g.groups;
  for (const gr of grupos) {
    const m = mats[gr.materialIndex]; if (!m) continue;
    if (m.map) map = map || m.map;
    for (let i = gr.start; i < gr.start + gr.count && i < n; i++) {
      if (m.map) { col[i * 4] = m.color.r; col[i * 4 + 1] = m.color.g; col[i * 4 + 2] = m.color.b; col[i * 4 + 3] = 0; }
      else { col[i * 4] = m.color.r; col[i * 4 + 1] = m.color.g; col[i * 4 + 2] = m.color.b; col[i * 4 + 3] = 1; }
    }
  }
  g.clearGroups();
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  mat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', '#ifdef USE_COLOR_ALPHA\n\tdiffuseColor.rgb = mix(diffuseColor.rgb * vColor.rgb, vColor.rgb, vColor.a);\n#endif'); };
  mat.customProgramCacheKey = () => 'una-malla';
  return { geo: g, mat };
}

// Un minijuego que guarda su estado entre «Furgo» y «Control» (o lo recibe de app.js por ctx.datos)
export function leerDatos(ctx, clave, claveLS) {
  const d = ctx.datos?.[clave];
  if (d !== undefined && d !== null) return d;
  try { return JSON.parse(localStorage.getItem(claveLS) || 'null'); } catch { return null; }
}
