// El kit de la decoración 3D hecha con código (js/barrio/deco3d.js).
// Todo se apunta en unos pocos «lotes» y al final sale en muy pocas mallas (≈ 6 llamadas de dibujo por sala):
//   · sólido   : cajas, cilindros, esferas y tubos con color por vértice y sombreado de dibujo animado (3 bandas)
//                + hasta 4 «charcos de luz» pintados (luces falsas sin coste de sombras);
//   · tinta    : el contorno (la misma geometría inflada por sus normales suaves, por detrás);
//   · brillo   : neones, conos de luz y charcos de luz en el suelo, aditivos;
//   · sombras  : discos oscuros de contacto bajo cada cosa (que no floten);
//   · chispas  : partículas aditivas (polvo en la luz, luciérnagas, polillas, halos, vapor, gotas);
//   · humo     : bocanadas de humo con mezcla normal.
// El balanceo (lámparas, globos, palomas) y el parpadeo (neones, bombillas) van en el shader con el tiempo (uT):
// nada se mueve en la CPU. Coordenadas locales de la sala: tú en el origen mirando a −Z.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const PALETA = {
  morado: '#3b2a52', tinta: '#140c1c', rosa: '#ff5fa2', amarillo: '#ffd628', crema: '#fff6e0', neon: '#5ff2ff',
};

// aAnim = (pivoteY, amplitud, fase, parpadeo). Pivote ≤ -100 → sube y baja (flota) en vez de balancearse.
// parpadeo: 0 nada, 1 respira, 2 neón que falla de vez en cuando, 3 titila (bombillas de feria, estrellas)
const GLSL_ANIM = /* glsl */`
  uniform float uT;
  vec3 balanceo(vec3 p, vec4 an) {
    if (an.y == 0.0) return p;
    if (an.x <= -100.0) { p.y += an.y * sin(uT * 1.3 + an.z); p.x += an.y * 0.3 * sin(uT * 0.7 + an.z * 2.0); return p; }
    float a = an.y * sin(uT * 1.25 + an.z), b = an.y * 0.55 * sin(uT * 0.93 + an.z * 1.7);
    float d = an.x - p.y;
    p.x += sin(a) * d; p.z += sin(b) * d; p.y += (2.0 - cos(a) - cos(b)) * d * 0.5;
    return p;
  }
  float parpadeo(float k, float ph) {
    if (k < 0.5) return 1.0;
    if (k < 1.5) return 0.82 + 0.18 * sin(uT * 2.1 + ph);
    if (k < 2.5) {
      float tramo = fract(sin(floor(uT * 0.8 + ph) * 78.233 + ph) * 43758.5453);
      float r = fract(sin(floor(uT * 14.0 + ph * 7.0) * 12.9898 + ph) * 43758.5453);
      return tramo > 0.72 ? (r > 0.45 ? 1.0 : 0.12) : 1.0;
    }
    return 0.55 + 0.45 * sin(uT * 2.7 + ph * 5.0) * sin(uT * 1.3 + ph * 3.0);
  }`;

const VERT_SOLIDO = /* glsl */`
  attribute vec4 aAnim; attribute vec2 aGlow;
  varying vec3 vN, vP, vCol; varying float vEmis;
  ${GLSL_ANIM}
  void main() {
    vec3 p = balanceo(position, aAnim);
    vN = normal; vP = p; vCol = color;
    vEmis = aGlow.y * parpadeo(aAnim.w, aAnim.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG_SOLIDO = /* glsl */`
  uniform vec3 uTinte, uLuzDir, uSombra;
  uniform vec4 uLuces[4]; uniform vec3 uLucesCol[4];
  varying vec3 vN, vP, vCol; varying float vEmis;
  void main() {
    vec3 n = normalize(vN);
    float d = dot(n, uLuzDir);
    float banda = d > 0.3 ? 1.0 : (d > -0.25 ? 0.8 : 0.62);
    vec3 c = vCol * mix(uSombra, uTinte, banda);
    for (int i = 0; i < 4; i++) {
      float k = clamp(1.0 - distance(vP, uLuces[i].xyz) / uLuces[i].w, 0.0, 1.0);
      c += vCol * uLucesCol[i] * k * k * (0.55 + 0.45 * max(d, 0.0) + 0.3 * max(n.y, 0.0));
    }
    c = mix(c, vCol * (0.25 + vEmis), step(0.001, vEmis));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;
const VERT_TINTA = /* glsl */`
  attribute vec4 aAnim;
  uniform float uAncho;
  ${GLSL_ANIM}
  void main() {
    vec3 p = balanceo(position, aAnim) + normal * uAncho;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FRAG_TINTA = /* glsl */`
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }`;
// brillo: aGlow = (intensidad, modo) · modo 0 tubo (fresnel), 1 cono (se apaga hacia abajo), 2 charco (radial)
const VERT_BRILLO = /* glsl */`
  attribute vec4 aAnim; attribute vec2 aGlow;
  varying vec3 vN, vV, vCol; varying vec2 vUv; varying float vI, vModo;
  ${GLSL_ANIM}
  void main() {
    vec3 p = balanceo(position, aAnim);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalMatrix * normal; vV = -mv.xyz; vUv = uv; vCol = color;
    vI = aGlow.x * parpadeo(aAnim.w, aAnim.z); vModo = aGlow.y;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG_BRILLO = /* glsl */`
  uniform float uFuerza;
  varying vec3 vN, vV, vCol; varying vec2 vUv; varying float vI, vModo;
  void main() {
    float a;
    if (vModo > 1.5) { float r = length(vUv - 0.5) * 2.0; a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6); }
    else {
      float f = abs(dot(normalize(vN), normalize(vV)));
      if (vModo > 0.5) a = pow(f, 1.4) * pow(vUv.y, 1.8) * 0.55;
      else a = pow(f, 2.2);
    }
    gl_FragColor = vec4(vCol * a * vI * uFuerza, 1.0);
    #include <colorspace_fragment>
  }`;
// partículas: aP = (tamaño, tipo, semilla, velocidad); aCaja = cuánto se mueven
// tipo 0 polvo, 1 luciérnaga, 2 halo fijo (con balanceo y parpadeo), 3 sube (vapor, chispas, humo), 4 cae (gotas, hojas), 5 polilla
const VERT_PART = /* glsl */`
  attribute vec2 aEsq; attribute vec4 aP; attribute vec3 aCaja; attribute vec4 aAnim;
  varying vec2 vUv; varying float vA; varying vec3 vCol;
  ${GLSL_ANIM}
  void main() {
    vec3 c = position; float s = aP.x, k = aP.y, sd = aP.z, v = aP.w, al = 1.0;
    if (k < 0.5) {
      c += aCaja * vec3(sin(uT * 0.11 * v + sd * 6.3), sin(uT * 0.07 * v + sd * 3.1), cos(uT * 0.09 * v + sd * 4.7));
      al = 0.45 + 0.55 * sin(uT * 0.9 * v + sd * 20.0);
    } else if (k < 1.5) {
      c += aCaja * vec3(sin(uT * 0.31 * v + sd * 9.0) * cos(uT * 0.13 + sd), sin(uT * 0.27 * v + sd * 4.0), cos(uT * 0.23 * v + sd * 7.0));
      al = smoothstep(0.15, 0.9, 0.5 + 0.5 * sin(uT * 1.4 * v + sd * 30.0));
    } else if (k < 2.5) {
      c = balanceo(c, aAnim); al = parpadeo(aAnim.w, aAnim.z);
    } else if (k < 3.5) {
      float ph = fract(uT * v * 0.1 + sd);
      c.y += ph * aCaja.y; c.x += aCaja.x * sin(ph * 5.0 + sd * 10.0) * ph; c.z += aCaja.z * cos(ph * 4.0 + sd * 7.0) * ph;
      al = sin(ph * 3.1416); s *= mix(0.5, 1.6, ph);
    } else if (k < 4.5) {
      float ph = fract(uT * v * 0.1 + sd);
      c.y -= ph * aCaja.y; c.x += aCaja.x * sin(ph * 7.0 + sd * 5.0); c.z += aCaja.z * cos(ph * 6.0 + sd * 3.0);
      al = smoothstep(0.0, 0.1, ph) * smoothstep(1.0, 0.85, ph);
    } else {
      float an = uT * v * 2.2 + sd * 6.283;
      c += vec3(cos(an) * aCaja.x, sin(uT * v * 3.1 + sd * 9.0) * aCaja.y, sin(an * 1.3) * aCaja.z);
      al = 0.7 + 0.3 * sin(uT * 20.0 + sd * 50.0);
    }
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += aEsq * s;
    vUv = aEsq; vA = al; vCol = color;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG_PART = /* glsl */`
  uniform float uFuerza, uMezcla;
  varying vec2 vUv; varying float vA; varying vec3 vCol;
  void main() {
    float r = length(vUv);
    if (r > 1.0) discard;
    float a = pow(1.0 - r, 1.8) * vA;
    if (uMezcla > 0.5) gl_FragColor = vec4(vCol, a * uFuerza);
    else gl_FragColor = vec4(vCol * a * uFuerza, 1.0);
    #include <colorspace_fragment>
  }`;

const TIPOS = { polvo: 0, luciernaga: 1, halo: 2, sube: 3, cae: 4, polilla: 5 };
const _o = new THREE.Object3D(), _c = new THREE.Color();

function matriz({ p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  _o.position.set(...p); _o.rotation.set(r[0], r[1], r[2], 'YXZ');
  if (Array.isArray(s)) _o.scale.set(...s); else _o.scale.setScalar(s);
  _o.updateMatrix(); return _o.matrix.clone();
}
function atributo(geo, nombre, valor, n) {
  const arr = new Float32Array(geo.attributes.position.count * n);
  for (let i = 0; i < arr.length; i += n) for (let j = 0; j < n; j++) arr[i + j] = valor[j];
  geo.setAttribute(nombre, new THREE.BufferAttribute(arr, n));
}

// ---------- formas ----------
export const forma = {
  caja: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cil: (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg),
  esf: (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs),
  toro: (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts),
  cono: (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  // un tubo por unos puntos (suave con curva = true; si no, por tramos rectos)
  tubo(puntos, r, { curva = true, seg, radial = 6 } = {}) {
    const v = puntos.map(p => new THREE.Vector3(...p));
    let camino;
    if (curva) camino = new THREE.CatmullRomCurve3(v);
    else { camino = new THREE.CurvePath(); for (let i = 1; i < v.length; i++) camino.add(new THREE.LineCurve3(v[i - 1], v[i])); }
    return new THREE.TubeGeometry(camino, seg ?? Math.max(8, puntos.length * 8), r, radial, false);
  },
  // un perfil de puntos [x, y] extruido (estrellas, banderines)
  extruir(puntos, fondo) {
    const s = new THREE.Shape(puntos.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: fondo, bevelEnabled: false });
    g.translate(0, 0, -fondo / 2); return g;
  },
  estrella(r, fondo, puntas = 5, dentro = 0.45) {
    const pts = [];
    for (let i = 0; i < puntas * 2; i++) { const a = Math.PI / 2 + i * Math.PI / puntas, rr = i % 2 ? r * dentro : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    return forma.extruir(pts, fondo);
  },
};

// la catenaria (un cable que cuelga) de a a b con una flecha de `caida` m
export function colgar(a, b, caida, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - caida * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

// textura de la sombra de contacto (un degradado radial)
let texSombra = null;
function texturaSombra() {
  if (texSombra) return texSombra;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  texSombra = new THREE.CanvasTexture(c); return texSombra;
}

export function crearKit({ noche = true } = {}) {
  const solidos = [], tintas = [], brillos = [], sombras = [], chispas = [], humos = [], luces = [];
  const kit = {
    noche,
    // una pieza maciza. emis > 0 = se ve encendida (no le afecta la luz; parpadea con anim.w)
    solido(geo, color, { emis = 0, anim = [0, 0, 0, 0], linea = true, ...m } = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      g.applyMatrix4(matriz(m));
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
      if (!g.attributes.uv) atributo(g, 'uv', [0, 0], 2);
      _c.set(color); atributo(g, 'color', [_c.r, _c.g, _c.b], 3);
      atributo(g, 'aAnim', anim, 4); atributo(g, 'aGlow', [0, emis], 2);
      solidos.push(g);
      if (linea) {
        const t = new THREE.BufferGeometry(); t.setAttribute('position', g.attributes.position.clone());
        atributo(t, 'aAnim', anim, 4);
        const u = mergeVertices(t, 1e-4); u.computeVertexNormals(); t.dispose();
        tintas.push(u);
      }
      return kit;
    },
    // brillo aditivo: modo 'tubo' (neón), 'cono' (haz de luz que se apaga hacia abajo) o 'charco' (disco en el suelo)
    brillo(geo, color, { fuerza = 1, modo = 'tubo', anim = [0, 0, 0, 0], ...m } = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      g.applyMatrix4(matriz(m));
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
      if (!g.attributes.uv) atributo(g, 'uv', [0, 0], 2);
      _c.set(color); atributo(g, 'color', [_c.r, _c.g, _c.b], 3);
      atributo(g, 'aAnim', anim, 4); atributo(g, 'aGlow', [fuerza, { tubo: 0, cono: 1, charco: 2 }[modo]], 2);
      brillos.push(g); return kit;
    },
    // un charco de luz en el suelo (o en una mesa, a la altura y)
    charco(x, z, rx, rz, color, fuerza = 0.5, y = 0.006, anim) {
      const g = new THREE.PlaneGeometry(2 * rx, 2 * rz); g.rotateX(-Math.PI / 2);
      return kit.brillo(g, color, { modo: 'charco', fuerza, p: [x, y, z], anim });
    },
    // sombra de contacto: elipse oscura bajo una cosa (fuerza 0-1)
    sombra(x, z, rx, rz = rx, fuerza = 0.55, y = 0.004) { sombras.push([x, y, z, rx, rz, fuerza]); return kit; },
    // partículas: tipo (ver TIPOS), n, centro, caja = dónde nacen (±), mueve = cuánto se mueven
    particulas({ tipo = 'polvo', n = 20, centro = [0, 1, 0], caja = [1, 1, 1], mueve = [0.2, 0.2, 0.2], color = '#ffffff', tam = 0.01, vel = 1, anim = [0, 0, 0, 0], humo = false, azar = 1 }) {
      const lista = humo ? humos : chispas;
      let s = (azar * 9301 + 49297) % 233280;
      const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
      const cols = Array.isArray(color) ? color : [color];
      for (let i = 0; i < n; i++) {
        _c.set(cols[i % cols.length]);
        lista.push({
          p: [centro[0] + (rnd() * 2 - 1) * caja[0], centro[1] + (rnd() * 2 - 1) * caja[1], centro[2] + (rnd() * 2 - 1) * caja[2]],
          tam: tam * (0.7 + rnd() * 0.6), tipo: TIPOS[tipo], semilla: rnd(), vel: vel * (0.7 + rnd() * 0.6), mueve, col: [_c.r, _c.g, _c.b], anim,
        });
      }
      return kit;
    },
    halo(p, color, tam, anim = [0, 0, 0, 0]) { return kit.particulas({ tipo: 'halo', n: 1, centro: p, caja: [0, 0, 0], mueve: [0, 0, 0], color, tam, anim }); },
    // luz pintada: tiñe lo macizo cercano (máx. 4 por sala)
    luz(p, color, radio, fuerza = 1) { if (luces.length < 4) luces.push({ p, color, radio, fuerza }); return kit; },

    construir({ tinte, sombra: sombraTinte, luzDir = [-0.45, 1, 0.55], fuerzaBrillo = 1, fuerzaChispas = 1, fuerzaHumo = 0.35, ancho = 0.011 } = {}) {
      const grupo = new THREE.Group(); grupo.name = 'deco3d';
      const uT = { value: 0 };
      const mallas = [];
      tinte = new THREE.Color(...(tinte || (noche ? [0.62, 0.56, 0.8] : [1.0, 0.98, 0.94])));
      sombraTinte = new THREE.Color(...(sombraTinte || (noche ? [0.36, 0.3, 0.55] : [0.62, 0.58, 0.66])));
      if (solidos.length) {
        const geo = mergeGeometries(solidos, false); solidos.forEach(g => g.dispose());
        const lv = [0, 1, 2, 3].map(i => luces[i] ? new THREE.Vector4(...luces[i].p, luces[i].radio) : new THREE.Vector4(0, -50, 0, 0.001));
        const lc = [0, 1, 2, 3].map(i => luces[i] ? new THREE.Color(luces[i].color).multiplyScalar(luces[i].fuerza) : new THREE.Color(0, 0, 0));
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT_SOLIDO, fragmentShader: FRAG_SOLIDO, vertexColors: true, side: THREE.DoubleSide,
          uniforms: { uT, uTinte: { value: tinte }, uSombra: { value: sombraTinte }, uLuzDir: { value: new THREE.Vector3(...luzDir).normalize() }, uLuces: { value: lv }, uLucesCol: { value: lc } },
        });
        const m = new THREE.Mesh(geo, mat); m.name = 'deco-solido'; mallas.push(m);
      }
      if (tintas.length) {
        const geo = mergeGeometries(tintas, false); tintas.forEach(g => g.dispose());
        const mat = new THREE.ShaderMaterial({ vertexShader: VERT_TINTA, fragmentShader: FRAG_TINTA, side: THREE.BackSide, uniforms: { uT, uAncho: { value: ancho }, uColor: { value: new THREE.Color(PALETA.tinta) } } });
        const m = new THREE.Mesh(geo, mat); m.name = 'deco-tinta'; mallas.push(m);
      }
      if (sombras.length) {
        const geos = sombras.map(([x, y, z, rx, rz, f]) => {
          const g = new THREE.PlaneGeometry(2 * rx, 2 * rz); g.rotateX(-Math.PI / 2); g.translate(x, y, z);
          _c.set(PALETA.tinta); atributo(g, 'color', [_c.r, _c.g, _c.b, f], 4); return g;
        });
        const geo = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
        const mat = new THREE.MeshBasicMaterial({ map: texturaSombra(), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const m = new THREE.Mesh(geo, mat); m.name = 'deco-sombras'; m.renderOrder = 1; mallas.push(m);
      }
      if (brillos.length) {
        const geo = mergeGeometries(brillos, false); brillos.forEach(g => g.dispose());
        const mat = new THREE.ShaderMaterial({ vertexShader: VERT_BRILLO, fragmentShader: FRAG_BRILLO, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT, uFuerza: { value: fuerzaBrillo } } });
        const m = new THREE.Mesh(geo, mat); m.name = 'deco-brillo'; m.renderOrder = 5; mallas.push(m);
      }
      for (const [lista, mezcla, fuerza, nombre] of [[chispas, 0, fuerzaChispas, 'deco-chispas'], [humos, 1, fuerzaHumo, 'deco-humo']]) {
        if (!lista.length) continue;
        const n = lista.length, pos = new Float32Array(n * 12), esq = new Float32Array(n * 8), pp = new Float32Array(n * 16), caja = new Float32Array(n * 12), col = new Float32Array(n * 12), an = new Float32Array(n * 16), idx = [];
        const E = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        lista.forEach((q, i) => {
          for (let k = 0; k < 4; k++) {
            const v = i * 4 + k;
            pos.set(q.p, v * 3); esq.set(E[k], v * 2); pp.set([q.tam, q.tipo, q.semilla, q.vel], v * 4);
            caja.set(q.mueve, v * 3); col.set(q.col, v * 3); an.set(q.anim, v * 4);
          }
          const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aEsq', new THREE.BufferAttribute(esq, 2));
        geo.setAttribute('aP', new THREE.BufferAttribute(pp, 4)); geo.setAttribute('aCaja', new THREE.BufferAttribute(caja, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aAnim', new THREE.BufferAttribute(an, 4));
        geo.setIndex(idx);
        const mat = new THREE.ShaderMaterial({
          vertexShader: VERT_PART, fragmentShader: FRAG_PART, vertexColors: true, transparent: true, depthWrite: false,
          blending: mezcla ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { uT, uFuerza: { value: fuerza }, uMezcla: { value: mezcla } },
        });
        const m = new THREE.Mesh(geo, mat); m.name = nombre; m.frustumCulled = false; m.renderOrder = mezcla ? 7 : 6; mallas.push(m);
      }
      grupo.add(...mallas);
      return {
        grupo, mallas,
        tiempo(t) { uT.value = t; },
        quitar() { grupo.parent?.remove(grupo); for (const m of mallas) { m.geometry.dispose(); m.material.dispose(); } },
      };
    },
  };
  return kit;
}
