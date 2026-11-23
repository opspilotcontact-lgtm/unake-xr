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

export function montarXR(renderer, escena, camara, { alEntrar, alSalir, aviso }) {
  const manos = { izquierda: new Mano('izquierda'), derecha: new Mano('derecha') };
  escena.add(manos.izquierda.grupo, manos.derecha.grupo);
  let sesion = null, modo = null, ref = null;
  const cabeza = new THREE.Vector3(), adelante = new THREE.Vector3(0, 0, -1), cabezaQ = new THREE.Quaternion();
  let planos = [], cadaPlanos = 0;

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
      ref = renderer.xr.getReferenceSpace();
    } catch (err) {
      if (s) { s.removeEventListener('end', terminar); s.end().catch(() => { }); }
      sesion = null; modo = null;
      aviso('No se pudo entrar: ' + (err?.message || err));
      return;
    }
    alEntrar(m, micro);
  }
  function terminar() {
    sesion = null; modo = null; ref = null; planos = [];
    for (const m of Object.values(manos)) { m.activa = false; m.fuente = null; }
    alSalir();
  }

  function leerMano(m, fuente, frame) {
    m.fuente = fuente; m.esMano = !!fuente.hand; m.activa = false;
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre;
    if (fuente.hand) {
      const j = n => { const e = fuente.hand.get(n); return e ? frame.getJointPose(e, ref) : null; };
      const palma = j('middle-finger-metacarpal') || j('wrist'), indice = j('index-finger-tip'), pulgar = j('thumb-tip'), muneca = j('wrist');
      if (!palma || !indice || !pulgar) return;
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
    cadaPlanos -= dt;
    if (cadaPlanos <= 0 && frame.detectedPlanes) { cadaPlanos = 0.5; planos = leerPlanos(frame); }
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
    paredDelante, mesaCerca,
    // dónde está tu boca: un poco por debajo y por delante de los ojos
    boca(destino = new THREE.Vector3()) {
      return destino.set(0, -0.075, -0.07).applyQuaternion(cabezaQ).add(cabeza);
    },
  };
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
