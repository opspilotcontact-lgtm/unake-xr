// Sesión de las gafas, manos y mandos, cabeza y planos de la habitación real.
// Todo lo demás del juego pregunta aquí: «¿dónde está la mano derecha?, ¿está pellizcando?, ¿dónde está la pared?».
// Manos y mandos se tratan igual: pinza = gatillo o pellizco (índice + pulgar); agarre = botón lateral o puño.
import * as THREE from 'three';

export class Mano {
  constructor(lado) {
    this.lado = lado; this.activa = false; this.esMano = false; this.fuente = null;
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.punta = new THREE.Vector3();          // punta del índice (o del mando)
    this.vel = new THREE.Vector3(); this._prev = new THREE.Vector3(); this._tienePrev = false;
    this.pinza = false; this.pinzaAntes = false; this.agarre = false; this.agarreAntes = false;
    this.valorPinza = 0;
    // rayo para señalar (targetRaySpace): origen y dirección en el mundo; con la mano, el sistema lo saca del hombro
    this.rayoOrigen = new THREE.Vector3(); this.rayoDir = new THREE.Vector3(0, 0, -1); this.tieneRayo = false;
    this.grupo = new THREE.Group(); this.grupo.name = 'mano-' + lado; // lo que llevas en esta mano cuelga de aquí
  }
  get empiezaPinza() { return this.pinza && !this.pinzaAntes; }
  get acabaPinza() { return !this.pinza && this.pinzaAntes; }
  get empiezaAgarre() { return this.agarre && !this.agarreAntes; }
  vibrar(fuerza = 0.4, ms = 30) {
    try { this.fuente?.gamepad?.hapticActuators?.[0]?.pulse?.(fuerza, ms); } catch { /* sin vibración */ }
  }
}

const JUNTAS_DEDOS = ['index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'];

// Ajustes de confort (se guardan en este navegador): postura, giro y tamaño de los textos.
//   postura: 'auto' (se mide al entrar en el humo) · 'pie' · 'sentado' (en el humo, el mundo sube a tu altura de pie)
//   giro: 'saltos' (30°, lo más cómodo) · 'suave' (continuo, con viñeta)
//   texto: 1 normal · 1.3 grande
const CLAVE_AJUSTES = 'unake-xr-ajustes';
export const AJUSTES = { postura: 'auto', giro: 'saltos', texto: 1 };
try { Object.assign(AJUSTES, JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || '{}')); } catch { /* sin almacén */ }
export function guardarAjustes(cambios = {}) {
  Object.assign(AJUSTES, cambios);
  try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(AJUSTES)); } catch { /* sin almacén */ }
}
// altura de los ojos de pie a la que se lleva a quien juega sentado (en el humo) y umbral para «estás sentado»
export const OJOS_DE_PIE = 1.55, UMBRAL_SENTADO = 1.3;

export function montarXR(renderer, escena, camara, { alEntrar, alSalir, aviso, alReset = null }) {
  const manos = { izquierda: new Mano('izquierda'), derecha: new Mano('derecha') };
  escena.add(manos.izquierda.grupo, manos.derecha.grupo);
  let sesion = null, modo = null, ref = null;
  const cabeza = new THREE.Vector3(), adelante = new THREE.Vector3(0, 0, -1), cabezaQ = new THREE.Quaternion();
  let planos = [], cadaPlanos = 0;
  // locomoción con joystick (solo cuando se activa: en el humo). Se desplaza el ESPACIO DE REFERENCIA,
  // nunca la cámara: stick izquierdo = andar hacia donde miras; stick derecho = giro a saltos de 30°.
  let refBase = null, movil = false, pausa = false, giroEspera = 0;
  const VEL = 1.5, GIRO = Math.PI / 6, GIRO_SUAVE = Math.PI / 2; // 90°/s
  // velocidad: m/s del joystick (el giro suave también cuenta: la viñeta de app.js la usa)
  const movimiento = { velocidad: 0, giro: 0 };
  // sentado en el humo: el mundo sube (el suelo virtual baja) hasta que tus ojos quedan a la altura de pie
  let elevacion = 0;

  async function entrar(m, { micro = null } = {}) {
    if (sesion || !navigator.xr) return;
    const opciones = m === 'ar'
      ? { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'plane-detection', 'anchors', 'hit-test'] }
      : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking'] };
    let s = null;
    try {
      // requestSession sin esperas antes: necesita el toque del usuario
      s = await navigator.xr.requestSession(m === 'ar' ? 'immersive-ar' : 'immersive-vr', opciones);
      sesion = s; modo = m;
      s.addEventListener('end', terminar);
      renderer.xr.setReferenceSpaceType('local-floor');
      renderer.xr.setFoveation(1);
      await renderer.xr.setSession(s);
      ref = renderer.xr.getReferenceSpace(); refBase = ref;
      // mantener el botón Meta (recentrar del sistema): el espacio salta; los planos se releen ya
      try { refBase.addEventListener('reset', () => { cadaPlanos = 0; alReset?.(); }); } catch { /* sin evento */ }
    } catch (err) {
      if (s) { s.removeEventListener('end', terminar); s.end().catch(() => { }); }
      sesion = null; modo = null;
      aviso('No se pudo entrar: ' + (err?.message || err));
      return;
    }
    alEntrar(m, micro);
  }
  function terminar() {
    sesion = null; modo = null; ref = null; refBase = null; movil = false; planos = []; elevacion = 0;
    for (const m of Object.values(manos)) { m.activa = false; m.fuente = null; }
    alSalir();
  }

  function leerMano(m, fuente, frame) {
    m.fuente = fuente; m.esMano = !!fuente.hand; m.activa = false;
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre;
    const rp = fuente.targetRaySpace ? frame.getPose(fuente.targetRaySpace, ref) : null;
    m.tieneRayo = !!rp;
    if (rp) {
      m.rayoOrigen.copy(rp.transform.position);
      m.rayoDir.set(0, 0, -1).applyQuaternion(_qr.copy(rp.transform.orientation));
    }
    if (fuente.hand) {
      const j = n => { const e = fuente.hand.get(n); return e ? frame.getJointPose(e, ref) : null; };
      const palma = j('middle-finger-metacarpal') || j('wrist'), indice = j('index-finger-tip'), pulgar = j('thumb-tip'), muneca = j('wrist');
      if (!palma || !indice || !pulgar) return;
      // las 25 articulaciones, para dibujar la mano (js/manos_visibles.js)
      if (!m.juntas) m.juntas = new Map();
      for (const [nombre, espacio] of fuente.hand) {
        const p = frame.getJointPose(espacio, ref);
        if (!p) continue;
        let v = m.juntas.get(nombre); if (!v) m.juntas.set(nombre, v = new THREE.Vector3());
        v.copy(p.transform.position);
      }
      m.pos.copy(palma.transform.position); m.quat.copy(palma.transform.orientation);
      m.punta.copy(indice.transform.position);
      const d = _a.copy(indice.transform.position).distanceTo(_b.copy(pulgar.transform.position));
      // con histéresis: el seguimiento de manos tiembla (guía de Meta: tolerancia)
      m.pinza = m.pinza ? d < 0.035 : d < 0.02;
      m.valorPinza = THREE.MathUtils.clamp(1 - (d - 0.015) / 0.04, 0, 1);
      if (muneca) {
        let suma = 0, n = 0;
        for (const nombre of JUNTAS_DEDOS) { const p = j(nombre); if (p) { suma += _a.copy(p.transform.position).distanceTo(_b.copy(muneca.transform.position)); n++; } }
        const media = n ? suma / n : 1;
        m.agarre = m.agarre ? media < 0.11 : media < 0.085;
      }
    } else {
      const pose = fuente.gripSpace ? frame.getPose(fuente.gripSpace, ref) : null;
      if (!pose) return;
      m.pos.copy(pose.transform.position); m.quat.copy(pose.transform.orientation);
      m.punta.set(0, -0.02, -0.07).applyQuaternion(m.quat).add(m.pos);
      const b = fuente.gamepad?.buttons || [];
      m.valorPinza = b[0]?.value ?? 0;
      m.pinza = m.pinza ? m.valorPinza > 0.3 : m.valorPinza > 0.6;
      m.agarre = (b[1]?.value ?? 0) > 0.5;
    }
    m.activa = true;
  }

  function paso(frame, dt) {
    if (!sesion || !frame || !ref) return;
    const camXR = renderer.xr.getCamera();
    camXR.getWorldPosition(cabeza); camXR.getWorldQuaternion(cabezaQ);
    adelante.set(0, 0, -1).applyQuaternion(cabezaQ);
    const vistas = new Set();
    for (const fuente of sesion.inputSources) {
      const lado = fuente.handedness === 'left' ? 'izquierda' : fuente.handedness === 'right' ? 'derecha' : null;
      if (!lado || vistas.has(lado)) continue;
      vistas.add(lado);
      leerMano(manos[lado], fuente, frame);
    }
    for (const [lado, m] of Object.entries(manos)) {
      if (!vistas.has(lado)) { m.activa = false; m.pinzaAntes = m.pinza; m.pinza = false; m.agarreAntes = m.agarre; m.agarre = false; }
      if (m.activa) {
        if (m._tienePrev && dt > 0) m.vel.lerp(_a.copy(m.pos).sub(m._prev).divideScalar(dt), 0.5);
        m._prev.copy(m.pos); m._tienePrev = true;
        m.grupo.position.copy(m.pos); m.grupo.quaternion.copy(m.quat);
      } else m._tienePrev = false;
      m.grupo.visible = m.activa;
    }
    if (movil && !pausa) moverConMandos(dt);
    cadaPlanos -= dt;
    if (cadaPlanos <= 0 && frame.detectedPlanes) { cadaPlanos = 0.5; planos = leerPlanos(frame); }
  }

  function desplazar(dx, dz, giro) {
    // el nuevo origen, expresado en el espacio actual (medido en el emulador: origen en -v = tú te mueves +v)
    let t;
    if (giro) {
      // girar alrededor de tu cabeza: T(h)·R(giro)·T(-h)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro);
      const h = cabeza.clone().setY(0);
      const pos = h.clone().sub(h.clone().applyQuaternion(q));
      t = new XRRigidTransform({ x: pos.x, y: 0, z: pos.z }, { x: q.x, y: q.y, z: q.z, w: q.w });
    } else t = new XRRigidTransform({ x: dx, y: 0, z: dz });
    ref = ref.getOffsetReferenceSpace(t);
    renderer.xr.setReferenceSpace(ref);
  }
  function moverConMandos(dt) {
    let ax = 0, ay = 0, gx = 0;
    for (const f of sesion.inputSources) {
      const a = f.gamepad?.axes; if (!a || a.length < 4 || f.hand) continue;
      if (f.handedness === 'left') { ax = a[2]; ay = a[3]; } else if (f.handedness === 'right') gx = a[2];
    }
    const zona = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    ax = zona(ax); ay = zona(ay);
    const f = adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const der = new THREE.Vector3(-f.z, 0, f.x);
    const v = f.multiplyScalar(-ay).add(der.multiplyScalar(ax)).multiplyScalar(VEL * dt);
    movimiento.velocidad = v.length() / Math.max(dt, 1e-3);
    if (v.lengthSq() > 1e-8) desplazar(-v.x, -v.z, 0); // el origen se mueve al revés que tú
    movimiento.giro = 0;
    if (AJUSTES.giro === 'suave') {
      const g = zona(gx);
      if (g) { const a = -g * GIRO_SUAVE * dt; desplazar(0, 0, a); movimiento.giro = Math.abs(a) / Math.max(dt, 1e-3); }
      // la viñeta también al girar en continuo (es lo que más marea)
      movimiento.velocidad = Math.max(movimiento.velocidad, movimiento.giro * 1.2);
      return;
    }
    giroEspera -= dt;
    if (Math.abs(gx) > 0.7 && giroEspera <= 0) { giroEspera = 0.35; desplazar(0, 0, Math.sign(gx) * GIRO); }
    if (Math.abs(gx) < 0.3) giroEspera = 0;
  }
  // altura real de tus ojos (sin la elevación de «sentado»)
  const alturaReal = () => cabeza.y - elevacion;
  function quiereElevar() {
    if (AJUSTES.postura === 'pie') return false;
    if (AJUSTES.postura === 'sentado') return true;
    return alturaReal() > 0.3 && alturaReal() < UMBRAL_SENTADO; // auto: se mide al entrar en el humo
  }
  // sube (o deja) el mundo para quien está sentado; solo con el joystick activo (en el humo: de día la casa cuadra)
  function ajustarElevacion() {
    if (!sesion || !ref || !movil) return;
    const quiero = quiereElevar() ? THREE.MathUtils.clamp(OJOS_DE_PIE - alturaReal(), 0, 0.8) : 0;
    const dy = quiero - elevacion;
    if (Math.abs(dy) < 0.02) return;
    // el origen se mueve al revés que tú (como en desplazar)
    ref = ref.getOffsetReferenceSpace(new XRRigidTransform({ x: 0, y: -dy, z: 0 }));
    renderer.xr.setReferenceSpace(ref);
    elevacion = quiero; cabeza.y += dy;
  }

  function leerPlanos(frame) {
    const out = [];
    for (const p of frame.detectedPlanes) {
      if (!p.polygon?.length) continue;
      let pose = null; try { pose = frame.getPose(p.planeSpace, ref); } catch { pose = null; }
      if (!pose) continue;
      const M = new THREE.Matrix4().fromArray(pose.transform.matrix);
      const pts = p.polygon.map(q => new THREE.Vector3(q.x, q.y, q.z).applyMatrix4(M));
      const centro = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(M);
      // tamaño en su propio plano
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const q of p.polygon) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z); }
      out.push({ orientacion: p.orientation, etiqueta: p.semanticLabel || '', centro, normal, ancho: maxX - minX, largo: maxZ - minZ, matriz: M });
    }
    return out;
  }

  // la pared que tienes delante (para la puerta): devuelve { punto, normal } con la normal mirándote
  function paredDelante() {
    let mejor = null;
    const f = _a.copy(adelante).setY(0).normalize();
    for (const p of planos) {
      if (p.orientacion !== 'vertical' || p.ancho < 0.9) continue;
      const n = p.normal.clone().setY(0).normalize();
      const haciaMi = cabeza.clone().sub(p.centro).setY(0);
      if (n.dot(haciaMi) < 0) n.negate();
      // punto de la pared en la dirección de la mirada
      const denom = f.dot(n);
      if (denom > -0.3) continue; // la pared no está delante
      const t = p.centro.clone().sub(cabeza).dot(n) / denom;
      if (t < 0.6 || t > 4.5) continue;
      const punto = cabeza.clone().addScaledVector(f, t).setY(0);
      // que no se salga de la pared
      const lateral = new THREE.Vector3(-n.z, 0, n.x);
      const off = punto.clone().sub(p.centro).dot(lateral);
      const lim = Math.max(0, p.ancho / 2 - 0.55);
      punto.addScaledVector(lateral, THREE.MathUtils.clamp(off, -lim, lim) - off);
      const coste = t + (p.etiqueta === 'wall' ? 0 : 0.8);
      if (!mejor || coste < mejor.coste) mejor = { punto, normal: n, coste };
    }
    return mejor;
  }
  // la mesa más cercana (para la bandeja de liar)
  function mesaCerca() {
    let mejor = null;
    for (const p of planos) {
      if (p.orientacion !== 'horizontal') continue;
      const alto = p.centro.y;
      if (alto < 0.4 || alto > 1.2 || p.ancho * p.largo < 0.12) continue;
      const d = p.centro.clone().sub(cabeza).setY(0).length();
      if (d > 1.8) continue;
      if (!mejor || d < mejor.d) mejor = { punto: p.centro.clone(), d };
    }
    return mejor;
  }

  return {
    manos, cabeza, adelante, cabezaQ, entrar, paso,
    get sesion() { return sesion; }, get modo() { return modo; },
    get planos() { return planos; },
    paredDelante, mesaCerca, movimiento,
    // activar el joystick (en el humo) o volver a tu sitio real (de día: la casa tiene que cuadrar con la realidad)
    // dejar de andar un rato (p. ej. usando la palanca de la máquina) SIN volver a tu sitio real
    pausarMovimiento(si) { pausa = !!si; if (pausa) movimiento.velocidad = 0; },
    permitirMovimiento(si) {
      const antes = movil;
      movil = !!si;
      if (!si && refBase && ref !== refBase) { ref = refBase; renderer.xr.setReferenceSpace(refBase); }
      if (!si) elevacion = 0;
      movimiento.velocidad = 0;
      if (si && !antes) ajustarElevacion(); // al entrar en el humo (va tapado por la cortinilla)
    },
    // ajustes de confort (postura, giro, texto): se guardan y la postura se aplica ya
    get ajustes() { return AJUSTES; },
    ajustar(cambios) { guardarAjustes(cambios); if ('postura' in cambios) ajustarElevacion(); },
    get elevacion() { return elevacion; },
    get alturaReal() { return alturaReal(); },
    // ¿estás sentado? (por la altura real de tus ojos, o lo que hayas elegido)
    get sentado() { return AJUSTES.postura === 'sentado' || (AJUSTES.postura !== 'pie' && !!sesion && alturaReal() < UMBRAL_SENTADO); },
    // vuelve a tu sitio real (deshace lo andado con el joystick) y recalcula la altura.
    // Lo de mantener el botón Meta lo hace el sistema (evento reset).
    recentrar() {
      if (!sesion || !refBase) return;
      if (ref !== refBase) { ref = refBase; renderer.xr.setReferenceSpace(refBase); }
      cabeza.y -= elevacion; elevacion = 0;
      ajustarElevacion();
    },
    // dónde está tu boca: un poco por debajo y por delante de los ojos
    boca(destino = new THREE.Vector3()) {
      return destino.set(0, -0.075, -0.07).applyQuaternion(cabezaQ).add(cabeza);
    },
  };
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _qr = new THREE.Quaternion();
