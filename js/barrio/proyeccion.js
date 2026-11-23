// «Entrar en la foto» para TODAS las salas del barrio (generaliza salaDesdeFoto de js/decorado.js).
// Un fondo de la serie se proyecta desde el ojo de quien lo pintó sobre unos pocos planos de verdad:
//   · 'caja'   (interiores, un punto de fuga): suelo, pared del fondo, paredes, techo y la pared de detrás de ti;
//   · 'telon'  (exteriores): suelo y uno o varios telones verticales (fachadas a distinta distancia), sin techo:
//              arriba está el cielo (el color de fondo de la escena);
//   · 'cupula' (el techo de la Pompa, pintado mirando hacia arriba): una cúpula alrededor de ti.
// Los «bastidores» son planos de pie sobre el suelo (un mostrador, un banco): el dibujo se proyecta también
// sobre ellos y así tienen relieve al mover la cabeza. Las «piezas» son cartones recortados de las capas de la
// serie (muebles sueltos sobre un fondo limpio).
// Todos los planos de una sala van en UNA malla (un draw call); cada pieza, en otra.
// Con { mini: true } sale la sala en diorama para la maqueta: sin techo ni pared de detrás y recortada por
// delante donde el dibujo deja de ver el suelo.
//
// Medidas (px de la imagen): fuga = [vx, vy] (vy = altura de los ojos, el horizonte); fondo = rectángulo de la
// pared del fondo (x0, x1, arriba y0, suelo); tramos de telón = { x0, x1, suelo }; bastidor = { x0, x1, y0, suelo }.
// Un punto del suelo pintado en (x, y) está a z = -ojo·F/(y - vy) y x = (x - vx)·|z|/F, con F = (W/2)/tan(fov/2).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { textura } from '../recursos.js';
import { carton } from '../decorado.js';

const VERT = /* glsl */`
  attribute float aTipo;
  varying vec3 vSala;
  varying float vTipo;
  uniform mat4 uSalaInv;
  #include <fog_pars_vertex>
  void main() {
    vTipo = aTipo;
    vec4 mundo = modelMatrix * vec4(position, 1.0);
    vSala = (uSalaInv * mundo).xyz;
    vec4 mvPosition = viewMatrix * mundo;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FRAG = /* glsl */`
  uniform sampler2D uMapa;
  uniform vec2 uTam, uFuga;
  uniform float uF, uOjo, uLuz, uLosa, uBorde, uNiebla;
  uniform mat3 uProy;
  uniform vec3 uPared, uBaldosa, uJunta, uCielo;
  varying vec3 vSala;
  varying float vTipo;
  #include <fog_pars_fragment>
  void main() {
    // al espacio del proyector: ojo en (0, uOjo, 0) mirando a -z (girado por uProy en la cúpula)
    vec3 p = uProy * vec3(vSala.x, vSala.y - uOjo, vSala.z);
    vec3 relleno;
    if (vTipo < 0.5) {             // suelo: baldosas (o liso si uLosa = 0)
      if (uLosa > 0.0) {
        vec2 b = fract(vSala.xz / uLosa);
        float j = step(b.x, 0.035) + step(b.y, 0.035);
        relleno = mix(uBaldosa, uJunta, clamp(j, 0.0, 1.0));
      } else relleno = uBaldosa;
    } else if (vTipo < 1.5) {      // pared: su color, más oscuro hacia arriba
      relleno = uPared * mix(1.0, 0.55, clamp(vSala.y / 4.0, 0.0, 1.0));
    } else {                       // techo
      relleno = uPared * 0.35;
    }
    // ¿dónde cae en el dibujo? (fuera = cuánto se sale: 0 dentro, 1 muy fuera o detrás de ti)
    float fuera = 1.0, dentro = 0.0;
    vec2 uv = vec2(0.0);
    if (p.z < -0.05) {
      vec2 px = vec2(uFuga.x + uF * p.x / -p.z, uFuga.y - uF * p.y / -p.z);
      uv = vec2(px.x / uTam.x, 1.0 - px.y / uTam.y);
      vec2 borde = min(uv, 1.0 - uv);
      dentro = smoothstep(0.0, uBorde, min(borde.x, borde.y));
      fuera = clamp(-min(borde.x, borde.y), 0.0, 1.0);
    }
    // lo que el dibujo no ve: junto al borde, el borde estirado y muy desenfocado (sigue sus colores y luces);
    // más lejos, el color liso de la sala (sin rayas largas)
    vec3 q = p; q.z = min(q.z, -0.35);
    vec2 pxq = vec2(uFuga.x + uF * q.x / -q.z, uFuga.y - uF * q.y / -q.z);
    vec2 uvq = clamp(vec2(pxq.x / uTam.x, 1.0 - pxq.y / uTam.y), 0.002, 0.998);
    vec3 borroso = texture2D(uMapa, uvq, 6.5).rgb;
    float lejos = smoothstep(0.0, 0.45, fuera);
    vec3 color = vTipo < 0.5
      ? relleno * mix(0.55 + 0.7 * borroso / max(0.2, dot(uBaldosa, vec3(0.333))), vec3(1.0), lejos)
      : mix(relleno, borroso, mix(0.7, 0.15, lejos));
    if (dentro > 0.0) color = mix(color, texture2D(uMapa, clamp(uv, 0.001, 0.999)).rgb, dentro);
    // exteriores: lo que el dibujo no ve se deshace en el color del cielo (sin paredes ni bordes duros);
    // el suelo, solo lejos de ti
    if (uNiebla > 0.0) {
      float n = vTipo < 0.5 ? smoothstep(3.5, 13.0, length(vSala.xz)) * smoothstep(0.0, 0.12, fuera)
                            : smoothstep(0.0, 0.28, fuera);
      color = mix(color, uCielo, n * uNiebla);
    }
    gl_FragColor = vec4(color * uLuz, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// el color medio de una franja del dibujo (para el cielo de los exteriores: así el borde no se nota)
export function colorMedio(imagen, { y0 = 0, y1 = 0.1, x0 = 0, x1 = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 18;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(imagen, 0, 0, 32, 18);
  const d = g.getImageData(Math.floor(x0 * 32), Math.floor(y0 * 18), Math.max(1, Math.round((x1 - x0) * 32)), Math.max(1, Math.round((y1 - y0) * 18))).data;
  let r = 0, gg = 0, b = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

// un rectángulo con su tipo (0 suelo, 1 pared, 2 techo)
function plano(w, h, tipo, colocar) {
  const g = new THREE.PlaneGeometry(w, h);
  const o = new THREE.Object3D(); colocar(o); o.updateMatrix();
  g.applyMatrix4(o.matrix);
  g.setAttribute('aTipo', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(tipo), 1));
  return g;
}

// Las cuentas de una sala (sin texturas): para la sala grande, el diorama y las pruebas
export function medir(def) {
  const { W, H, fuga: [vx, vy] } = def;
  const fov = def.fov ?? 90, ojo = def.ojo ?? 1.2;
  const F = (W / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const prof = y => ojo * F / Math.max(1, y - vy);          // profundidad del suelo pintado en la fila y
  const X = (x, z) => (x - vx) * z / F;                        // x del mundo de la columna x a esa profundidad
  const Y = (y, z) => ojo + (vy - y) * z / F;                  // altura de la fila y a esa profundidad
  return { F, fov, ojo, prof, X, Y, vx, vy, W, H };
}

export async function construirSala(def, { mini = false, mapa = null } = {}) {
  const m = medir(def);
  const { F, ojo, prof, X, Y, W, H } = m;
  mapa = mapa || await textura(def.url);
  mapa.generateMipmaps = true;
  const geos = [];
  const tipo = def.tipo || 'caja';
  const detras = def.detras ?? (tipo === 'telon' ? 5 : 2.6);
  let medidas;

  if (tipo === 'caja') {
    const { x0, x1, y0, suelo } = def.fondo;
    const D = prof(suelo), xl = X(x0, D), xr = X(x1, D), alto = Y(y0, D);
    // el diorama empieza donde el dibujo empieza a ver el suelo (la fila de abajo)
    const zCerca = mini ? -Math.min(D * 0.8, prof(H) * 0.9) : detras;
    const largo = D + zCerca, zMedio = (zCerca - D) / 2, ancho = xr - xl, xMedio = (xl + xr) / 2;
    geos.push(plano(ancho, largo, 0, o => { o.rotation.x = -Math.PI / 2; o.position.set(xMedio, 0, zMedio); }));
    geos.push(plano(ancho, alto, 1, o => o.position.set(xMedio, alto / 2, -D)));
    geos.push(plano(largo, alto, 1, o => { o.rotation.y = Math.PI / 2; o.position.set(xl, alto / 2, zMedio); }));
    geos.push(plano(largo, alto, 1, o => { o.rotation.y = -Math.PI / 2; o.position.set(xr, alto / 2, zMedio); }));
    if (!mini) {
      geos.push(plano(ancho, largo, 2, o => { o.rotation.x = Math.PI / 2; o.position.set(xMedio, alto, zMedio); }));
      geos.push(plano(ancho, alto, 1, o => { o.rotation.y = Math.PI; o.position.set(xMedio, alto / 2, detras); }));
    }
    medidas = { D, xl, xr, alto, ancho, zCerca, largo };
  } else if (tipo === 'telon') {
    const tramos = def.tramos;
    const D = Math.max(...tramos.map(t => prof(t.suelo)));
    // en el diorama se puede recortar a lo de en medio (miniX: px), que los exteriores son muy anchos
    const [mx0, mx1] = mini && def.miniX ? def.miniX : [0, W];
    const xl = X(mx0, D), xr = X(mx1, D);
    const zCerca = mini ? -Math.min(D * 0.6, prof(H) * 0.9) : detras;
    let altoMax = 0;
    for (const t of tramos) {
      const z = prof(t.suelo);
      let x0 = Math.max(t.x0, mx0), x1 = Math.min(t.x1, mx1);
      if (x1 <= x0) continue;
      let a = X(x0, z), b = X(x1, z), alto = Y(t.y0 ?? 0, z);
      altoMax = Math.max(altoMax, alto);
      // de tamaño real, el telón sigue más allá del dibujo por los lados que dan al borde y por arriba:
      // ahí el sombreado lo deshace en el cielo (uNiebla)
      if (!mini) {
        const extra = (b - a) * 0.6;
        if (t.x0 <= 0) a -= extra;
        if (t.x1 >= W) b += extra;
        if ((t.y0 ?? 0) <= 0) alto *= 1.45;
      }
      geos.push(plano(b - a, alto, 1, o => o.position.set((a + b) / 2, alto / 2, -z)));
      // un telón más cerca que el del fondo: su canto hasta el siguiente, para que no se vea el hueco de lado
      if (t.canto) {
        const zFin = prof(t.canto.suelo), xc = t.canto.lado === 'izq' ? X(t.x0, z) : X(t.x1, z);
        geos.push(plano(zFin - z, alto, 1, o => { o.rotation.y = Math.PI / 2; o.position.set(xc, alto / 2, -(z + zFin) / 2); }));
      }
    }
    if (mini) {
      const largo = D + zCerca;
      geos.push(plano(xr - xl, largo, 0, o => { o.rotation.x = -Math.PI / 2; o.position.set((xl + xr) / 2, 0, (zCerca - D) / 2); }));
      medidas = { D, xl, xr, alto: altoMax, ancho: xr - xl, zCerca, largo };
    } else {
      // un suelo grande que se pierde en el cielo; sin paredes: lo que no pintó el dibujo es neblina
      const R = Math.max(D * 1.6, 24);
      geos.push(plano(2 * R, 2 * R, 0, o => { o.rotation.x = -Math.PI / 2; o.position.set(0, 0, -D * 0.3); }));
      medidas = { D, xl, xr, alto: altoMax, ancho: xr - xl, zCerca, largo: D + zCerca };
    }
  } else if (tipo === 'cupula') {
    // media esfera de radio r alrededor del ojo y un suelo; el proyector mira hacia arriba (pitch)
    // (en el diorama, solo la mitad de atrás: una concha abierta hacia ti)
    const r = def.radio ?? 4;
    const g = mini
      ? new THREE.SphereGeometry(r, 20, 10, Math.PI, Math.PI, 0, Math.PI * 0.5)
      : new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    if (!mini) g.translate(0, ojo - 0.4, 0);
    g.setAttribute('aTipo', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(1), 1));
    geos.push(g);
    if (!mini) geos.push(plano(2 * r, 2 * r, 0, o => { o.rotation.x = -Math.PI / 2; }));
    medidas = mini ? { D: r, xl: -r, xr: r, alto: r, ancho: 2 * r, zCerca: 0, largo: r }
      : { D: r, xl: -r, xr: r, alto: r, ancho: 2 * r, zCerca: r, largo: 2 * r };
  }
  // bastidores: el dibujo proyectado sobre un plano de pie en su línea de suelo
  for (const b of def.bastidores || []) {
    const z = prof(b.suelo), a = X(b.x0, z), c = X(b.x1, z), alto = Y(b.y0, z);
    if (mini && (z < -medidas.zCerca - 0.01 || (def.miniX && (b.x1 < def.miniX[0] || b.x0 > def.miniX[1])))) continue;
    geos.push(plano(c - a, alto, 1, o => o.position.set((a + c) / 2, alto / 2, -z)));
  }

  const geo = mergeGeometries(geos.map(g => g.toNonIndexed()), false);
  geos.forEach(g => g.dispose());
  const pitch = THREE.MathUtils.degToRad(def.pitch ?? 0);
  // el cielo: en los exteriores, el color de arriba del dibujo (con def.cielo se fuerza)
  const cielo = new THREE.Color(def.cielo || '#141022');
  if (tipo === 'telon' && !def.cieloFijo && mapa.image) cielo.copy(colorMedio(mapa.image, { y0: 0, y1: 0.12 }));
  // la pared y el suelo de relleno: los colores del propio dibujo (sus lados y su franja de abajo)
  const pared = new THREE.Color(def.pared || '#4a4060'), baldosa = new THREE.Color(def.baldosa || '#6a6280');
  const junta = new THREE.Color(def.junta || '#3e3852');
  if (!def.coloresFijos && mapa.image) {
    pared.copy(colorMedio(mapa.image, { x0: 0, x1: 0.1, y0: 0.15, y1: 0.7 })).lerp(colorMedio(mapa.image, { x0: 0.9, x1: 1, y0: 0.15, y1: 0.7 }), 0.5).multiplyScalar(0.85);
    baldosa.copy(colorMedio(mapa.image, { y0: 0.88, y1: 1, x0: 0.2, x1: 0.8 }));
    junta.copy(baldosa).multiplyScalar(0.72);
  }
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  Object.assign(uniforms, {
    uMapa: { value: mapa }, uTam: { value: new THREE.Vector2(W, H) }, uFuga: { value: new THREE.Vector2(m.vx, m.vy) },
    uF: { value: F }, uOjo: { value: ojo }, uSalaInv: { value: new THREE.Matrix4() }, uLuz: { value: 1 },
    uLosa: { value: def.losa ?? (tipo === 'caja' ? 0.5 : 0) }, uBorde: { value: def.borde ?? (tipo === 'telon' && !mini ? 0.09 : 0.03) },
    uNiebla: { value: tipo === 'telon' && !mini ? 1 : 0 }, uCielo: { value: cielo },
    // el proyector mira hacia arriba: rota el punto hacia abajo
    uProy: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(-pitch)) },
    uPared: { value: pared }, uBaldosa: { value: baldosa }, uJunta: { value: junta },
  });
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, fog: !mini, side: THREE.DoubleSide });
  const malla = new THREE.Mesh(geo, mat); malla.name = 'sala-' + (def.id || '');
  const grupo = new THREE.Group(); grupo.name = 'sala'; grupo.add(malla);

  // piezas de cartón (capas de la serie), en su sitio del dibujo
  const piezas = [];
  if (!mini) {
    const k = def.escalaPiezas ?? 1; // px de capas.json → px de este fondo
    await Promise.all((def.piezas || []).map(async p => {
      const z = prof(p.y * k), altoM = p.alto * k * z / F;
      const c = await carton(p.url, altoM, { canto: p.canto ?? altoM > 0.5 });
      c.position.set(X(p.x * k, z), 0, -z - (p.atras ?? 0));
      c.name = 'pieza'; grupo.add(c); piezas.push(c);
    }));
  }
  return {
    grupo, malla, medidas, medida: m, piezas, def, cielo,
    // llamar cuando se mueva la sala: el proyector va pegado a ella
    actualizarProyector() { grupo.updateMatrixWorld(true); uniforms.uSalaInv.value.copy(malla.matrixWorld).invert(); },
    luz(v) { uniforms.uLuz.value = v; },
    // de un punto del dibujo (px) a un punto del suelo de la sala (local)
    sueloDe(x, y, destino = new THREE.Vector3()) { const z = prof(y); return destino.set(X(x, z), 0, -z); },
    destruir() { geo.dispose(); mat.dispose(); },
  };
}
