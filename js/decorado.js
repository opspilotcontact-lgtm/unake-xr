// Decorados del mundo humo.
// «Entrar en la foto» (tour into the picture): los fondos de la serie están pintados en perspectiva de un punto.
// Con el punto de fuga y el rectángulo de la pared del fondo se reconstruye la caja de la sala (suelo, paredes,
// techo y fondo) y la imagen se PROYECTA sobre ella desde el ojo de quien la pintó. Visto desde ahí es el dibujo
// exacto; al moverte, las paredes y el suelo son planos de verdad. Lo que el dibujo no ve (lo que queda a tu
// lado o detrás) se rellena con baldosas y pared del mismo color.
import * as THREE from 'three';
import { textura } from './recursos.js';

const VERT = /* glsl */`
  varying vec3 vSala;
  uniform mat4 uSalaInv;
  #include <fog_pars_vertex>
  void main() {
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vSala = (uSalaInv * mundo).xyz;
    vec4 mvPosition = viewMatrix * mundo;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uMapa;
  uniform vec2 uTam, uFuga;
  uniform float uF, uOjo, uTipo, uLuz, uTono, uOnda, uT;
  uniform vec3 uPared, uBaldosa, uJunta;
  varying vec3 vSala;
  #include <fog_pars_fragment>
  void main() {
    // al espacio del proyector: ojo en (0, uOjo, 0) mirando a -z
    vec3 p = vec3(vSala.x, vSala.y - uOjo, vSala.z);
    vec3 relleno;
    if (uTipo < 0.5) {             // suelo: baldosas de 0,5 m
      vec2 b = fract(vSala.xz / 0.5);
      float j = step(b.x, 0.035) + step(b.y, 0.035);
      relleno = mix(uBaldosa, uJunta, clamp(j, 0.0, 1.0));
    } else if (uTipo < 1.5) {      // pared: el morado de la sala, más oscuro hacia arriba
      relleno = uPared * mix(1.0, 0.55, clamp(vSala.y / 3.2, 0.0, 1.0));
    } else {                       // techo
      relleno = uPared * 0.35;
    }
    float dentro = 0.0;
    // lo que el dibujo no ve: el borde del dibujo estirado y muy desenfocado (sigue sus colores y sus luces),
    // mezclado con la pared o las baldosas para que tenga textura
    vec3 q = p; q.z = min(q.z, -0.35);
    vec2 pxq = vec2(uFuga.x + uF * q.x / -q.z, uFuga.y - uF * q.y / -q.z);
    vec2 uvq = clamp(vec2(pxq.x / uTam.x, 1.0 - pxq.y / uTam.y), 0.002, 0.998);
    vec3 borroso = texture2D(uMapa, uvq, 5.5).rgb;
    vec3 color = uTipo < 0.5 ? relleno * (0.55 + 0.7 * borroso / max(0.2, dot(uBaldosa, vec3(0.333)))) : mix(relleno, borroso, 0.7);
    if (p.z < -0.05) {
      vec2 px = vec2(uFuga.x + uF * p.x / -p.z, uFuga.y - uF * p.y / -p.z);
      vec2 uv = vec2(px.x / uTam.x, 1.0 - px.y / uTam.y);
      vec2 borde = min(uv, 1.0 - uv);
      dentro = smoothstep(0.0, 0.03, min(borde.x, borde.y));
      color = mix(color, texture2D(uMapa, clamp(uv, 0.001, 0.999)).rgb, dentro);
    }
    // momentos de colocón: el color gira (uTono, radianes) y una onda suave recorre la sala (uOnda 0-1)
    if (uTono != 0.0) {
      const vec3 k = vec3(0.57735);
      float c = cos(uTono), s = sin(uTono);
      color = color * c + cross(k, color) * s + k * dot(k, color) * (1.0 - c);
    }
    if (uOnda > 0.0) color *= 1.0 + uOnda * 0.22 * sin(length(vSala.xz) * 3.0 - uT * 2.2);
    gl_FragColor = vec4(color * uLuz, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// La sala de dentro de Unaké (02_escenarios/unake-dentro/capas/fondo.png, 1408×736), medida sobre rejilla:
// fuga (700, 330); pared del fondo x 330-1075, arriba y 60, suelo y 497.
export const SALA_DENTRO = {
  url: 'assets/escenarios/dentro.webp', W: 1408, H: 736, fuga: [700, 330],
  fondo: { x0: 330, x1: 1075, y0: 60, suelo: 497 },
  ojo: 1.2, fov: 90, detras: 2.6,
  pared: '#5a5378', baldosa: '#6f6d98', junta: '#4b4870',
};

export async function salaDesdeFoto(def) {
  const mapa = await textura(def.url);
  mapa.generateMipmaps = true; mapa.anisotropy = 8;
  const { W, H, fuga: [vx, vy], fondo: { x0, x1, y0, suelo }, ojo, fov, detras } = def;
  const mpp = ojo / (suelo - vy);                    // metros por píxel en la pared del fondo
  const F = (W / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const D = F * mpp;                                 // profundidad de la pared del fondo
  const xl = (x0 - vx) * mpp, xr = (x1 - vx) * mpp, alto = ojo + (vy - y0) * mpp;
  const grupo = new THREE.Group(); grupo.name = 'sala';
  const uniforms = {
    uMapa: { value: mapa }, uTam: { value: new THREE.Vector2(W, H) }, uFuga: { value: new THREE.Vector2(vx, vy) },
    uF: { value: F }, uOjo: { value: ojo }, uSalaInv: { value: new THREE.Matrix4() }, uLuz: { value: 1 }, uTono: { value: 0 }, uOnda: { value: 0 }, uT: { value: 0 },
    uPared: { value: new THREE.Color(def.pared) }, uBaldosa: { value: new THREE.Color(def.baldosa) }, uJunta: { value: new THREE.Color(def.junta) },
  };
  const mats = [];
  const mat = tipo => {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: VERT, fragmentShader: FRAG, fog: true, side: THREE.DoubleSide,
    });
    Object.assign(m.uniforms, uniforms, { uTipo: { value: tipo } });
    mats.push(m); return m;
  };
  const plano = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const ancho = xr - xl, largo = D + detras, zMedio = (detras - D) / 2, xMedio = (xl + xr) / 2;
  const suelo_ = plano(ancho, largo, mat(0)); suelo_.rotation.x = -Math.PI / 2; suelo_.position.set(xMedio, 0, zMedio);
  const techo = plano(ancho, largo, mat(2)); techo.rotation.x = Math.PI / 2; techo.position.set(xMedio, alto, zMedio);
  const fondoM = plano(ancho, alto, mat(1)); fondoM.position.set(xMedio, alto / 2, -D);
  const izq = plano(largo, alto, mat(1)); izq.rotation.y = Math.PI / 2; izq.position.set(xl, alto / 2, zMedio);
  const der = plano(largo, alto, mat(1)); der.rotation.y = -Math.PI / 2; der.position.set(xr, alto / 2, zMedio);
  grupo.add(suelo_, techo, fondoM, izq, der);
  const paredes = [fondoM, izq, der];
  // la pared de detrás de ti: el rincón del sofá, de pared a pared
  if (def.paredDetras) {
    const t = await textura(def.paredDetras);
    const atras = plano(ancho, alto, new THREE.MeshBasicMaterial({ map: t, fog: true }));
    atras.rotation.y = Math.PI; atras.position.set(xMedio, alto / 2, detras);
    grupo.add(atras); paredes.push(atras);
  }
  const medidas = { mpp, D, xl, xr, alto, ancho };
  return {
    grupo, medidas,
    // llamar cuando se mueva la sala: el proyector va pegado a ella
    actualizarProyector() { grupo.updateMatrixWorld(true); uniforms.uSalaInv.value.copy(grupo.matrixWorld).invert(); },
    luz(v) { uniforms.uLuz.value = v; },
    efectos({ tono = 0, onda = 0, t = 0 } = {}) { uniforms.uTono.value = tono; uniforms.uOnda.value = onda; uniforms.uT.value = t; },
    // las paredes como planos de física (normal = +Y del plano, como los de las gafas)
    planosFisica() {
      grupo.updateMatrixWorld(true);
      const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      return paredes.map(m => {
        const matriz = m.matrixWorld.clone().multiply(rot);
        const g = m.geometry.parameters;
        return { orientacion: 'vertical', matriz, inv: matriz.clone().invert(), medio: [g.width / 2, g.height / 2] };
      });
    },
  };
}

// Cartón con un dibujo (muebles de las capas): de pie, apoyado en el suelo por abajo
export async function carton(url, altoM, { canto = true } = {}) {
  const t = await textura(url);
  const asp = t.image.width / t.image.height;
  const g = new THREE.Group();
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(altoM * asp, altoM), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5 }));
  frente.position.y = altoM / 2; g.add(frente);
  if (canto) {
    const m = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, color: '#3a2a20', side: THREE.BackSide });
    m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
    m.customProgramCacheKey = () => 'canto-carton';
    const detras = new THREE.Mesh(frente.geometry, m); detras.position.set(0, altoM / 2, -0.012); g.add(detras);
  }
  g.userData.ancho = altoM * asp;
  return g;
}

// Unaké por dentro, montado alrededor de ti: tú en el sitio del ojo, mirando a la barra; el sofá delante con
// sitio para dos, y detrás de ti la pared del rincón del sofá.
export async function montarUnake() {
  const sala = await salaDesdeFoto({ ...SALA_DENTRO, paredDetras: 'assets/escenarios/sofa-pared.webp' });
  const sofa = await carton('assets/escenarios/sofa.webp', 0.86);
  sofa.position.set(0, 0, -1.75);
  sala.grupo.add(sofa);
  return { ...sala, sofa, asientos: [new THREE.Vector3(-0.42, 0.36, -1.62), new THREE.Vector3(0.42, 0.36, -1.62)] };
}
