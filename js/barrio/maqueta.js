// La maqueta del barrio sobre tu mesa: cada sala del 2D es un diorama (la misma sala proyectada desde su
// dibujo, en pequeño, sin techo: una caja de zapatos), sobre un tablero de cartón con la calle pintada.
//   · delante, la calle: cuarto · plaza · puerta de Unaké · tienda · feria;
//   · detrás, Unaké por dentro: barra · cocina · reservado · baños, y el techo de la Pompa encima del reservado.
// Los del barrio están donde dice su paradero (casa, o de visita como en base/js/rutinas.js), en fichas
// recortables pequeñas que respiran y te miran.
// Tocar un diorama con la punta del dedo (o pellizcar encima) → alEntrar(idSala).
// Agarrar con una mano la mueve; con las dos, la mueve, la gira y la escala (como «agarrar el mundo» de eon-xr).
// Coste: tablero 1 + peanas 1 + 10 dioramas + fichas 1 + marco de selección 1 + letrero 1 ≈ 15 draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { construirSala, medir } from './proyeccion.js';
import { SALAS, CALLE, DENTRO, CASAS, SOLO_HUMO, mundoDe } from './salas.js';
import { personaje, fotoPersonaje, textura } from '../recursos.js';

const HUECO = 0.13;             // lado de cada diorama
const PASO = 0.155;              // de centro a centro
const TABLERO = { ancho: 0.84, fondo: 0.5, grueso: 0.022 };
const FILA_CALLE = 0.115, FILA_DENTRO = -0.125, ALTO_DENTRO = 0.025; // la fila de Unaké, un poco subida
const ESC_MIN = 0.4, ESC_MAX = 2.5;
const ALTOS = { lasslow: [0.72, 1.62], blancaso: [0.95, 1.68], perico: [0.62, 1.6], 'la-pompa': [0.85, 1.6], palicaso: [1.05, 1.74], puky: [0.6, 1.55], vuper: [0.9, 1.72], cotine: [1.0, 1.6] };

// dónde va cada sala en el tablero (local: +z hacia ti, y = 0 encima del tablero)
function huecos() {
  const h = {};
  CALLE.forEach((id, i) => { h[id] = new THREE.Vector3((i - (CALLE.length - 1) / 2) * PASO, 0, FILA_CALLE); });
  DENTRO.forEach((id, i) => { h[id] = new THREE.Vector3((i - (DENTRO.length - 1) / 2) * PASO, ALTO_DENTRO, FILA_DENTRO); });
  h.techo = h.reservado.clone().add(new THREE.Vector3(0, 0.13, -0.02));
  return h;
}

// ---------- el tablero: cartón con la calle, los caminos y los nombres pintados ----------
function pintarTablero(h, mundo) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = Math.round(2048 * TABLERO.fondo / TABLERO.ancho);
  const g = c.getContext('2d'), k = c.width / TABLERO.ancho;
  const P = v => [c.width / 2 + v.x * k, c.height / 2 + v.z * k];
  const humo = mundo === 'humo';
  g.fillStyle = humo ? '#3a2e4a' : '#c9a77c'; g.fillRect(0, 0, c.width, c.height);
  // vetas del cartón
  g.globalAlpha = 0.08; g.strokeStyle = '#000';
  for (let y = 6; y < c.height; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y + Math.sin(y) * 3); g.stroke(); }
  g.globalAlpha = 1;
  // la calle: una franja por delante de la fila de la calle
  const [, yCalle] = P(new THREE.Vector3(0, 0, FILA_CALLE + HUECO / 2 + 0.035));
  g.fillStyle = humo ? '#2a2236' : '#8e8a84'; g.fillRect(40, yCalle - 34, c.width - 80, 68);
  g.setLineDash([40, 30]); g.lineWidth = 6; g.strokeStyle = humo ? '#ffd34d88' : '#f4f1e8';
  g.beginPath(); g.moveTo(60, yCalle); g.lineTo(c.width - 60, yCalle); g.stroke(); g.setLineDash([]);
  // la puerta de Unaké lleva a la barra: un caminito
  const [xf, yf] = P(h.fuera), [xd, yd] = P(h.dentro);
  g.strokeStyle = humo ? '#ff6fb5' : '#7a4e2a'; g.lineWidth = 14; g.lineCap = 'round'; g.setLineDash([2, 26]);
  g.beginPath(); g.moveTo(xf, yf - HUECO * k / 2 - 10); g.bezierCurveTo(xf, (yf + yd) / 2, xd, (yf + yd) / 2, xd, yd + HUECO * k / 2 + 10); g.stroke();
  g.setLineDash([]);
  // los nombres, debajo de cada diorama
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [id, v] of Object.entries(h)) {
    if (id === 'techo') continue;
    const [x, y] = P(v);
    const nombre = SALAS[id].nombre.replace(/ \(.*\)/, '');
    g.font = '30px Caprasimo, serif';
    const w = Math.min(HUECO * k, g.measureText(nombre).width + 26);
    g.fillStyle = humo ? '#fff3c4' : '#fffaf0'; g.strokeStyle = '#140c1c'; g.lineWidth = 4;
    g.beginPath(); g.roundRect(x - w / 2, y + HUECO * k / 2 + 8, w, 42, 8); g.fill(); g.stroke();
    g.fillStyle = '#140c1c'; g.fillText(nombre, x, y + HUECO * k / 2 + 30, HUECO * k - 20);
  }
  g.fillStyle = humo ? '#ffe066' : '#3a2a1a'; g.font = '44px Caprasimo, serif'; g.textAlign = 'left';
  g.fillText('El barrio', 40, 46);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------- las fichas: todos los personajes en UNA malla (atlas + sombreado que les hace mirarte) ----------
const FICHA_VERT = /* glsl */`
  attribute vec3 aCentro; attribute vec2 aEsquina; attribute float aFase;
  uniform float uT;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 c = (modelMatrix * vec4(aCentro, 1.0)).xyz;
    float esc = length(modelMatrix[0].xyz);
    // de pie (eje vertical del mundo) y girada hacia la cámara
    vec3 der = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
    float resp = 1.0 + 0.03 * sin(uT * 1.6 + aFase);
    float salto = max(0.0, sin(uT * 0.9 + aFase * 3.0)) ;
    salto = pow(salto, 30.0) * 0.004;
    vec3 w = c + der * aEsquina.x * esc / sqrt(resp) + vec3(0.0, aEsquina.y * resp * esc + salto * esc, 0.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const FICHA_FRAG = /* glsl */`
  uniform sampler2D uMapa; varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMapa, vUv);
    if (t.a < 0.5) discard;
    gl_FragColor = vec4(t.rgb, 1.0);
    #include <colorspace_fragment>
  }`;

async function atlasFichas(ids, mundo) {
  const CEL = 256, cols = 4, filas = Math.ceil(ids.length / cols);
  const c = document.createElement('canvas'); c.width = CEL * cols; c.height = CEL * filas;
  const g = c.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = CEL;
  const tg = tmp.getContext('2d');
  const datos = {};
  await Promise.all(ids.map(async (id, i) => {
    const ind = await personaje(id, mundo);
    const tex = await fotoPersonaje(id, mundo, 'base');
    const im = tex.image, f = ind.fotos.base;
    const borde = 7, esc = (CEL - 2 * borde) / Math.max(im.width, im.height);
    const w = im.width * esc, hh = im.height * esc;
    const ox = (i % cols) * CEL + (CEL - w) / 2, oy = Math.floor(i / cols) * CEL + (CEL - hh) - borde;
    // borde blanco de troquel: la silueta en blanco, desplazada alrededor
    tg.clearRect(0, 0, CEL, CEL); tg.globalCompositeOperation = 'source-over';
    tg.drawImage(im, 0, 0, w, hh); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fffaf0'; tg.fillRect(0, 0, CEL, CEL);
    for (let a = 0; a < 12; a++) g.drawImage(tmp, ox + Math.cos(a / 12 * 6.283) * borde, oy + Math.sin(a / 12 * 6.283) * borde);
    g.drawImage(im, ox, oy, w, hh);
    // dónde están los pies en la celda (ancla de la pose) y el tamaño
    datos[id] = {
      u0: ((i % cols) * CEL) / c.width, u1: ((i % cols + 1) * CEL) / c.width,
      v0: 1 - (Math.floor(i / cols) + 1) * CEL / c.height, v1: 1 - Math.floor(i / cols) * CEL / c.height,
      pies: (oy + f.ay * esc - Math.floor(i / cols) * CEL) / CEL,          // 0 arriba, 1 abajo
      xAncla: (ox + f.ax * esc - (i % cols) * CEL) / CEL,
      cuerpo: ind.alto_cuerpo_px * esc / CEL,                                // fracción de la celda que es cuerpo
    };
  }));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { textura: t, datos };
}

export class Maqueta {
  // opciones: { mundo: 'humo'|'normal', paradero: { id: sala }, aqui: sala donde estás (la ficha de Vuper), alEntrar(id) }
  static async crear(opciones = {}) {
    const m = new Maqueta(opciones);
    await m.montar();
    return m;
  }
  constructor({ mundo = 'humo', paradero = {}, aqui = 'cuarto', alEntrar = () => { } } = {}) {
    this.mundo = mundo; this.paradero = paradero; this.aqui = aqui; this.alEntrar = alEntrar;
    this.grupo = new THREE.Group(); this.grupo.name = 'maqueta';
    this.huecos = huecos();
    this.dioramas = {};   // id → { sala, caja (Box3 local), grupo }
    this.encima = null; this.tEncima = 0; this.bloqueo = 0;
    this.agarres = []; this.base = null;
    this.t = 0;
  }

  async montar() {
    const h = this.huecos;
    // tablero
    this.matTablero = new THREE.MeshBasicMaterial({ map: pintarTablero(h, this.mundo) });
    this.tablero = new THREE.Mesh(new THREE.BoxGeometry(TABLERO.ancho, TABLERO.grueso, TABLERO.fondo), this.matTablero);
    this.tablero.position.y = -TABLERO.grueso / 2; this.tablero.name = 'tablero';
    this.grupo.add(this.tablero);
    // peanas: un taco de cartón bajo cada diorama de dentro y el pilar del techo (una sola malla)
    const geos = [];
    for (const id of DENTRO) { const b = new THREE.BoxGeometry(HUECO + 0.012, ALTO_DENTRO, HUECO + 0.012); b.translate(h[id].x, ALTO_DENTRO / 2, h[id].z); geos.push(b); }
    const pilar = new THREE.CylinderGeometry(0.006, 0.006, h.techo.y - ALTO_DENTRO, 8); pilar.translate(h.techo.x, (h.techo.y + ALTO_DENTRO) / 2, h.techo.z - 0.04); geos.push(pilar);
    const plato = new THREE.CylinderGeometry(0.05, 0.05, 0.006, 20); plato.translate(h.techo.x, h.techo.y - 0.003, h.techo.z - 0.02); geos.push(plato);
    this.matPeana = new THREE.MeshBasicMaterial({ color: this.mundo === 'humo' ? '#2a2036' : '#a88458' });
    this.peanas = new THREE.Mesh(mergeGeometries(geos.map(g => g.toNonIndexed())), this.matPeana);
    geos.forEach(g => g.dispose());
    this.grupo.add(this.peanas);
    // marco de selección (un aro que se pone bajo el diorama que tocas) y su letrero
    const aro = new THREE.RingGeometry(HUECO * 0.62, HUECO * 0.7, 40); aro.rotateX(-Math.PI / 2);
    this.marco = new THREE.Mesh(aro, new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.9, depthWrite: false }));
    this.marco.visible = false; this.grupo.add(this.marco);
    const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128;
    this.letrero = { c: lc, g: lc.getContext('2d'), t: new THREE.CanvasTexture(lc) };
    this.letrero.t.colorSpace = THREE.SRGBColorSpace;
    this.letreroM = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshBasicMaterial({ map: this.letrero.t, transparent: true, depthTest: false }));
    this.letreroM.renderOrder = 40; this.letreroM.visible = false; this.grupo.add(this.letreroM);
    await this.ponerDioramas();
    await this.ponerFichas();
  }

  async ponerDioramas() {
    for (const d of Object.values(this.dioramas)) { this.grupo.remove(d.grupo); d.sala.destruir(); }
    this.dioramas = {};
    await Promise.all(Object.keys(this.huecos).map(async id => {
      const def = mundoDe(id, this.mundo);
      const mapa = await textura(def.mini || def.url);
      const sala = await construirSala(def, { mini: true, mapa });
      const md = sala.medidas;
      const s = Math.min(HUECO / md.ancho, HUECO / Math.max(0.01, md.largo), id === 'techo' ? 0.1 / md.alto : Infinity);
      const g = new THREE.Group(); g.name = 'diorama-' + id;
      sala.grupo.scale.setScalar(s);
      sala.grupo.position.set(-(md.xl + md.xr) / 2 * s, 0, -(md.zCerca - md.D) / 2 * s);
      g.add(sala.grupo); g.position.copy(this.huecos[id]);
      this.grupo.add(g);
      const caja = new THREE.Box3(new THREE.Vector3(-HUECO / 2, 0, -HUECO / 2), new THREE.Vector3(HUECO / 2, Math.min(0.12, md.alto * s) + 0.01, HUECO / 2));
      caja.translate(this.huecos[id]);
      this.dioramas[id] = { id, sala, grupo: g, caja, s };
    }));
    this.actualizarProyectores();
  }

  // las fichas: quién está en cada sala según el paradero, y tú (Vuper) donde estés
  async ponerFichas() {
    if (this.fichas) { this.grupo.remove(this.fichas); this.fichas.geometry.dispose(); this.fichas.material.dispose(); this.atlas?.textura.dispose(); }
    const quien = [];
    for (const [id, casa] of Object.entries(CASAS)) {
      if (this.mundo !== 'humo' && SOLO_HUMO.includes(id)) continue;
      const sala = this.paradero[id] || casa;
      if (this.dioramas[sala]) quien.push({ id, sala, visita: sala !== casa });
    }
    if (this.dioramas[this.aqui]) quien.push({ id: 'vuper', sala: this.aqui, visita: true });
    this.atlas = await atlasFichas([...new Set(quien.map(q => q.id))], this.mundo);
    const pos = [], uv = [], centro = [], esquina = [], fase = [], idx = [];
    const ocupados = {};
    quien.forEach((q, i) => {
      const d = this.dioramas[q.sala], def = d.sala.def, a = this.atlas.datos[q.id];
      let px = (q.visita ? def.visita : def.sitios?.[q.id]) || def.visita || [def.W / 2, def.H * 0.85];
      // si ya hay alguien en ese sitio, un poco al lado
      const n = (ocupados[q.sala] = (ocupados[q.sala] || 0) + (q.visita ? 1 : 0));
      const p = d.sala.sueloDe(px[0] + (q.visita ? (n - 1) * def.W * 0.08 : 0), px[1]);
      p.y += (px[2] || 0);
      const local = d.sala.grupo.localToWorld(p.clone()); // (todavía relativo al grupo de la maqueta)
      this.grupo.worldToLocal(local);
      // tamaño: el de verdad a la escala de su diorama, pero que se vea (mín. 2,6 cm)
      const altoReal = (ALTOS[q.id] || [1, 1.6])[this.mundo === 'humo' ? 0 : 1];
      const alto = THREE.MathUtils.clamp(altoReal * d.s, 0.026, 0.05) / a.cuerpo;  // alto de la celda entera
      const x0 = -a.xAncla * alto, x1 = (1 - a.xAncla) * alto, y0 = -(1 - a.pies) * alto, y1 = a.pies * alto;
      const b = i * 4;
      for (const [ex, ey, u, v] of [[x0, y0, a.u0, a.v0], [x1, y0, a.u1, a.v0], [x1, y1, a.u1, a.v1], [x0, y1, a.u0, a.v1]]) {
        pos.push(local.x, local.y, local.z); centro.push(local.x, local.y, local.z); esquina.push(ex, ey); uv.push(u, v); fase.push(i * 1.7);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCentro', new THREE.Float32BufferAttribute(centro, 3));
    geo.setAttribute('aEsquina', new THREE.Float32BufferAttribute(esquina, 2));
    geo.setAttribute('aFase', new THREE.Float32BufferAttribute(fase, 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.matFichas = new THREE.ShaderMaterial({ uniforms: { uMapa: { value: this.atlas.textura }, uT: { value: 0 } }, vertexShader: FICHA_VERT, fragmentShader: FICHA_FRAG, side: THREE.DoubleSide });
    this.fichas = new THREE.Mesh(geo, this.matFichas); this.fichas.frustumCulled = false; this.fichas.name = 'fichas';
    this.fichas.renderOrder = 3;
    this.grupo.add(this.fichas);
    this.quien = quien;
  }

  async cambiarMundo(mundo) {
    if (mundo === this.mundo) return;
    this.mundo = mundo;
    this.matTablero.map.dispose(); this.matTablero.map = pintarTablero(this.huecos, mundo); this.matTablero.needsUpdate = true;
    this.matPeana.color.set(mundo === 'humo' ? '#2a2036' : '#a88458');
    await this.ponerDioramas();
    await this.ponerFichas();
  }
  async ponerParadero(paradero, aqui = this.aqui) { this.paradero = paradero; this.aqui = aqui; await this.ponerFichas(); }

  // Las marcas de dónde está cada cosa: encima de cada diorama, una chapita con ★ (la misión) y/o los minijuegos
  // abiertos allí (un mando y cuántos). marcas = { salaId: { estrella: bool, juegos: n } }. 1 llamada por chapita.
  marcar(marcas = {}) {
    for (const s of this.chapas || []) { this.grupo.remove(s); s.material.map?.dispose(); s.material.dispose(); }
    this.chapas = []; this.marcas = marcas;
    for (const [id, m] of Object.entries(marcas)) {
      const d = this.dioramas[id]; if (!d || (!m.estrella && !m.juegos)) continue;
      const c = document.createElement('canvas'); c.width = 192; c.height = 80;
      const g = c.getContext('2d'), partes = [];
      if (m.estrella) partes.push(['★', '#ffd23f']);
      if (m.juegos) partes.push([`▶${m.juegos > 1 ? m.juegos : ''}`, '#9fe7ff']);
      const w = 30 + partes.length * 66;
      g.fillStyle = 'rgba(20,12,28,.85)'; g.beginPath(); g.roundRect((192 - w) / 2, 6, w, 68, 30); g.fill();
      g.font = '50px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      partes.forEach(([t, col], i) => { g.fillStyle = col; g.fillText(t, 96 + (i - (partes.length - 1) / 2) * 66, 42); });
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false }));
      s.scale.set(0.06, 0.025, 1); s.renderOrder = 41; s.name = 'chapa-' + id;
      s.position.set(this.huecos[id].x, d.caja.max.y + 0.018, this.huecos[id].z);
      this.grupo.add(s); this.chapas.push(s);
    }
  }

  // colocar: sobre una mesa (punto de su superficie) o flotando a la cintura; de cara a la cabeza
  colocar(punto, cabeza) {
    this.grupo.position.copy(punto);
    const u = cabeza.clone().sub(punto).setY(0);
    this.grupo.rotation.set(0, Math.atan2(u.x, u.z), 0);
    this.actualizarProyectores();
  }
  actualizarProyectores() {
    this.grupo.updateMatrixWorld(true);
    for (const d of Object.values(this.dioramas)) d.sala.actualizarProyector();
  }

  // la sala cuyo diorama está bajo un punto del mundo (la punta del dedo)
  salaEn(puntoMundo, margen = 0.008) {
    const l = this.grupo.worldToLocal(puntoMundo.clone());
    for (const d of Object.values(this.dioramas)) if (d.caja.clone().expandByScalar(margen).containsPoint(l)) return d.id;
    return null;
  }
  // con el ratón (pruebas en el PC): un rayo
  salaDelRayo(rayo) {
    const l = rayo.ray.clone().applyMatrix4(this.grupo.matrixWorld.clone().invert());
    let mejor = null, dMin = Infinity;
    for (const d of Object.values(this.dioramas)) {
      const p = l.intersectBox(d.caja, new THREE.Vector3());
      if (p) { const dd = p.distanceTo(l.origin); if (dd < dMin) { dMin = dd; mejor = d.id; } }
    }
    return mejor;
  }

  // ---------- por fotograma: manos (tocar y agarrar), fichas y letrero ----------
  actualizar(dt, manos, cabeza) {
    this.t += dt; this.matFichas.uniforms.uT.value = this.t;
    this.bloqueo = Math.max(0, this.bloqueo - dt);
    this.pasoAgarre(manos);
    // tocar: la punta del dedo dentro de un diorama un momento, o pellizcar encima
    let tocada = null, mano = null;
    for (const m of manos) {
      if (!m.activa || m.agarre) continue;
      const id = this.salaEn(m.punta);
      if (id) { tocada = id; mano = m; if (m.empiezaPinza) this.tEncima = 1; break; }
    }
    if (tocada !== this.encima) { this.encima = tocada; this.tEncima = 0; this.señalar(tocada); if (tocada) mano?.vibrar(0.2, 15); }
    else if (tocada) this.tEncima += dt;
    if (this.encima && this.tEncima >= 0.25 && !this.bloqueo && !this.agarres.length) {
      const id = this.encima; this.bloqueo = 2; this.encima = null; this.señalar(null);
      mano?.vibrar(0.6, 40);
      this.alEntrar(id);
    }
    if (this.letreroM.visible && cabeza) this.letreroM.lookAt(cabeza);
    if (this.marco.visible) this.marco.material.opacity = 0.6 + 0.3 * Math.sin(this.t * 6);
  }

  señalar(id) {
    this.marco.visible = !!id; this.letreroM.visible = !!id;
    if (!id) return;
    const h = this.huecos[id], d = this.dioramas[id];
    this.marco.position.set(h.x, h.y + 0.002, h.z);
    this.letreroM.position.set(h.x, d.caja.max.y + 0.035, h.z);
    const { c, g, t } = this.letrero;
    g.clearRect(0, 0, c.width, c.height);
    g.font = '52px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff3c4'; g.strokeStyle = '#140c1c'; g.lineWidth = 8;
    g.beginPath(); g.roundRect(6, 10, c.width - 12, c.height - 20, 22); g.fill(); g.stroke();
    g.fillStyle = '#140c1c'; g.fillText('Entrar: ' + SALAS[id].nombre.replace(/ \(.*\)/, ''), c.width / 2, c.height / 2 + 2, c.width - 40);
    t.needsUpdate = true;
  }

  // agarrar: una mano mueve; dos manos mueven, giran (en horizontal) y escalan
  pasoAgarre(manos) {
    const ahora = manos.filter(m => m.activa && m.agarre);
    const cambia = ahora.length !== this.agarres.length || ahora.some((m, i) => m !== this.agarres[i]);
    if (cambia) {
      this.agarres = ahora;
      const g = this.grupo;
      this.base = !ahora.length ? null : { pos: g.position.clone(), q: g.quaternion.clone(), s: g.scale.x };
      if (ahora.length === 1) this.base.h = ahora[0].pos.clone();
      else if (ahora.length >= 2) {
        const [a, b] = ahora;
        this.base.mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
        this.base.d = Math.max(0.03, a.pos.distanceTo(b.pos));
        this.base.ang = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      }
      for (const m of ahora) m.vibrar(0.25, 15);
      return;
    }
    if (!this.base) return;
    const g = this.grupo;
    if (ahora.length === 1) {
      g.position.copy(this.base.pos).add(ahora[0].pos).sub(this.base.h);
    } else {
      const [a, b] = ahora;
      const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
      const s = THREE.MathUtils.clamp(this.base.s * a.pos.distanceTo(b.pos) / this.base.d, ESC_MIN, ESC_MAX), k = s / this.base.s;
      const dAng = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z) - this.base.ang;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dAng);
      g.position.copy(this.base.pos).sub(this.base.mid).multiplyScalar(k).applyQuaternion(q).add(mid);
      g.quaternion.copy(q).multiply(this.base.q);
      g.scale.setScalar(s);
    }
    this.actualizarProyectores();
  }
}

export { medir };
