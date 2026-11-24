// Tus manos, visibles: guantes de dibujo animado con los mandos (el índice se cierra con el gatillo y el resto
// con el botón lateral) y la mano de articulaciones con el seguimiento de manos (solo en el humo: de día, en
// passthrough, ya ves las tuyas). Encima de cada mano, la chuleta de lo que hace cada botón en ese momento.
//
// Barato: TODAS las piezas de las dos manos son instancias de dos mallas (cápsula y esfera) más su contorno de
// tinta: 4 llamadas de dibujo en total, más 2 de las chuletas y 2 de los rayos.
//
//   const mv = new ManosVisibles(escena, xr);
//   mv.ayudas({ gatillo: 'Coger', lateral: 'Agarrar', a: 'Aceptar', b: 'Menú' });   // null = las de siempre
//   en el bucle: mv.actualizar(dt, { reales: J.mundo === 'normal' });
import * as THREE from 'three';

const PIEL = '#f4efe6', TINTA = '#140c1c', CONTORNO = 1.22;
const MAX = 2 * 26;                      // instancias por malla (las dos manos)
const DEDOS = ['index', 'middle', 'ring', 'pinky'];
const JUNTAS_DEDO = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
const JUNTAS_PULGAR = ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'];

// las de siempre (el menú siempre es B/Y)
const AYUDAS_BASE = { gatillo: 'Coger / usar', lateral: 'Agarrar', b: 'Menú' };
const AYUDAS_MANO = { pellizco: 'Coger / usar', puno: 'Agarrar', muneca: 'Toca tu muñeca: menú' };

export class ManosVisibles {
  constructor(escena, xr) {
    this.xr = xr; this.grupo = new THREE.Group(); this.grupo.name = 'manos-visibles'; escena.add(this.grupo);
    const capsula = new THREE.CapsuleGeometry(0.5, 1, 4, 8);      // a lo largo de Y, de -1 a 1 (con sus tapas)
    const esfera = new THREE.SphereGeometry(1, 12, 8);
    const piel = new THREE.MeshBasicMaterial({ color: PIEL });
    const tinta = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
    const im = (g, m) => { const x = new THREE.InstancedMesh(g, m, MAX); x.frustumCulled = false; x.count = 0; this.grupo.add(x); return x; };
    this.cap = im(capsula, piel); this.capT = im(capsula, tinta);
    this.esf = im(esfera, piel); this.esfT = im(esfera, tinta);
    // el esqueleto del guante (sin mallas): solo para calcular dónde va cada pieza
    this.guantes = { izquierda: guante(1), derecha: guante(-1) };
    // rayo de los mandos (para señalar)
    this.rayos = {};
    for (const lado of ['izquierda', 'derecha']) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffd628', transparent: true, opacity: 0.35 }));
      l.scale.z = 0.9; l.visible = false; this.grupo.add(l); this.rayos[lado] = l;
    }
    // chuletas
    this.chuletas = {};
    for (const lado of ['izquierda', 'derecha']) {
      const c = document.createElement('canvas'); c.width = 384; c.height = 256;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      // 15 × 10 cm: la letra (28 px de 256) mide ~1,1 cm, ~1,4° a 45 cm (antes 12 × 8, ~1,1°)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
      m.renderOrder = 50; m.visible = false; this.grupo.add(m);
      this.chuletas[lado] = { c, t, m, texto: '', hasta: 0 };
    }
    this.t = 0; this._ayudas = null; this._clave = '';
    this.ayudas(null);
  }

  // qué hace cada botón ahora. Se ve unos segundos al cambiar, y siempre que te miras la mano de cerca.
  ayudas(a) {
    const mandos = { ...AYUDAS_BASE, ...(a || {}) }, manos = { ...AYUDAS_MANO, ...(a?.mano || {}) };
    if (a?.gatillo && !a?.mano?.pellizco) manos.pellizco = a.gatillo;
    if (a?.lateral && !a?.mano?.puno) manos.puno = a.lateral;
    const clave = JSON.stringify([mandos, manos]);
    if (clave === this._clave) return;
    this._clave = clave; this._ayudas = { mandos, manos };
    for (const ch of Object.values(this.chuletas)) { ch.texto = ''; ch.hasta = this.t + 7; }
  }

  actualizar(dt, { reales = false } = {}) {
    this.t += dt;
    const xr = this.xr, cab = xr.cabeza;
    let nc = 0, ne = 0;
    const M = new THREE.Matrix4(), MT = new THREE.Matrix4(), S = new THREE.Matrix4().makeScale(CONTORNO, CONTORNO, CONTORNO);
    const ponC = (mat) => { this.cap.setMatrixAt(nc, mat); MT.multiplyMatrices(mat, S); this.capT.setMatrixAt(nc, MT); nc++; };
    const ponE = (mat) => { this.esf.setMatrixAt(ne, mat); MT.multiplyMatrices(mat, S); this.esfT.setMatrixAt(ne, MT); ne++; };
    for (const lado of ['izquierda', 'derecha']) {
      const m = xr.manos[lado], ray = this.rayos[lado], ch = this.chuletas[lado];
      ray.visible = false;
      if (!m.activa) { ch.m.visible = false; continue; }
      if (!m.esMano) {
        // guante: pegado al mando, índice con el gatillo, el resto con el lateral
        const g = this.guantes[lado];
        g.raiz.position.copy(m.pos); g.raiz.quaternion.copy(m.quat);
        const ind = m.valorPinza ?? (m.pinza ? 1 : 0), resto = m.agarre ? 1 : 0.18;
        g.cierre.indice += (ind - g.cierre.indice) * Math.min(1, dt * 25);
        g.cierre.resto += (resto - g.cierre.resto) * Math.min(1, dt * 18);
        g.posar();
        g.raiz.updateMatrixWorld(true);
        for (const p of g.piezas) { M.multiplyMatrices(p.obj.matrixWorld, p.forma); p.esfera ? ponE(M) : ponC(M); }
        // rayo
        ray.position.copy(m.pos); ray.quaternion.copy(m.quat); ray.visible = true;
      } else if (!reales && m.juntas?.size) {
        // seguimiento de manos en el humo: bolitas en las juntas y huesos entre ellas
        const J = m.juntas;
        const hueso = (a, b, r) => {
          const pa = J.get(a), pb = J.get(b); if (!pa || !pb) return;
          const d = _v.subVectors(pb, pa), largo = d.length(); if (largo < 1e-4) return;
          _q.setFromUnitVectors(_y, d.multiplyScalar(1 / largo));
          M.compose(_m.addVectors(pa, pb).multiplyScalar(0.5), _q, _s.set(r * 2, largo / 2, r * 2)); ponC(M);
        };
        for (const d of DEDOS) for (let i = 0; i < 4; i++) hueso(`${d}-finger-${JUNTAS_DEDO[i]}`, `${d}-finger-${JUNTAS_DEDO[i + 1]}`, i === 0 ? 0.006 : 0.0085);
        for (let i = 0; i < 3; i++) hueso(JUNTAS_PULGAR[i], JUNTAS_PULGAR[i + 1], 0.0095);
        hueso('wrist', 'thumb-metacarpal', 0.01);
        // la palma: una bola achatada entre la muñeca y los nudillos
        const w = J.get('wrist'), k = J.get('middle-finger-phalanx-proximal');
        if (w && k) {
          const d = _v.subVectors(k, w), largo = d.length();
          _q.setFromUnitVectors(_y, d.normalize());
          M.compose(_m.addVectors(w, k).multiplyScalar(0.5), _q, _s.set(0.038, largo * 0.55, 0.02)); ponE(M);
        }
      }
      this._chuleta(lado, m, ch, cab, dt);
    }
    // sin piezas (sin manos, o de día con tus manos reales) no se dibujan: ni llamada ni subida de matrices
    for (const x of [this.cap, this.capT]) { x.count = nc; x.visible = nc > 0; if (nc) x.instanceMatrix.needsUpdate = true; }
    for (const x of [this.esf, this.esfT]) { x.count = ne; x.visible = ne > 0; if (ne) x.instanceMatrix.needsUpdate = true; }
  }

  _chuleta(lado, m, ch, cab, dt) {
    // se ve unos segundos tras cambiar, o si te acercas la mano a la cara para mirarla
    const cerca = m.pos.distanceTo(cab) < 0.42 && _v.subVectors(m.pos, cab).normalize().dot(this.xr.adelante) > 0.75;
    const quiere = this.t < ch.hasta || cerca;
    const op = ch.m.material.opacity + ((quiere ? 1 : 0) - ch.m.material.opacity) * Math.min(1, dt * 6);
    ch.m.material.opacity = op; ch.m.visible = op > 0.02;
    if (!ch.m.visible) return;
    const lineas = this._lineas(lado, m.esMano);
    const texto = lineas.map(l => l.join('|')).join('/');
    if (texto !== ch.texto) { ch.texto = texto; pintar(ch, lineas); }
    // encima de la mano y un poco hacia fuera (a tu izquierda la izquierda, a tu derecha la derecha): no tapa lo
    // que tienes entre manos ni lo que tocas delante
    const fuera = _m.set(-this.xr.adelante.z, 0, this.xr.adelante.x); // derecha de la mirada, en horizontal
    if (fuera.lengthSq() < 1e-4) fuera.set(1, 0, 0);
    fuera.normalize().multiplyScalar(lado === 'izquierda' ? -0.05 : 0.05);
    ch.m.position.copy(m.pos).add(fuera); ch.m.position.y += 0.12;
    ch.m.scale.setScalar(THREE.MathUtils.clamp(this.xr.ajustes?.texto || 1, 0.8, 1.6));
    ch.m.lookAt(cab);
  }
  _lineas(lado, esMano) {
    const a = this._ayudas; if (!a) return [];
    if (esMano) {
      const h = a.manos, out = [];
      if (h.pellizco) out.push(['Pellizca', h.pellizco]);
      if (h.puno) out.push(['Puño', h.puno]);
      if (lado === 'derecha' && h.muneca) out.push(['', h.muneca]);
      return out;
    }
    const b = a.mandos, out = [];
    if (b.gatillo) out.push(['Gatillo', b.gatillo]);
    if (b.lateral) out.push(['Lateral', b.lateral]);
    if (lado === 'derecha' && b.a) out.push(['A', b.a]);
    if (b.b) out.push([lado === 'derecha' ? 'B' : 'Y', b.b]);
    if (lado === 'izquierda' && b.stick) out.push(['Stick', b.stick]);
    if (lado === 'derecha' && b.stickDer) out.push(['Stick', b.stickDer]);
    return out;
  }
}

function pintar(ch, lineas) {
  const { c, t } = ch, g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (!lineas.length) { t.needsUpdate = true; return; }
  const alto = 20 + lineas.length * 46;
  g.fillStyle = 'rgba(20,12,28,.82)'; g.beginPath(); g.roundRect(4, c.height - alto - 4, c.width - 8, alto, 18); g.fill();
  g.textBaseline = 'middle';
  lineas.forEach(([boton, que], i) => {
    const y = c.height - alto + 10 + 23 + i * 46;
    let x = 18;
    if (boton) {
      g.font = 'bold 26px system-ui, sans-serif';
      const w = g.measureText(boton).width + 20;
      g.fillStyle = '#ffd628'; g.beginPath(); g.roundRect(x, y - 17, w, 34, 10); g.fill();
      g.fillStyle = '#140c1c'; g.fillText(boton, x + 10, y + 1); x += w + 12;
    }
    g.font = '28px Caprasimo, serif'; g.fillStyle = '#fff6e0'; g.fillText(que, x, y + 1, c.width - x - 14);
  });
  t.needsUpdate = true;
}

// Esqueleto de un guante (en el espacio del mando: −Z hacia delante, +Y arriba). s = 1 mano izquierda, −1 derecha
// (el pulgar va hacia dentro).
function guante(s) {
  const raiz = new THREE.Object3D(), piezas = [], cierre = { indice: 0, resto: 0.18 };
  const forma = (rx, ry, rz) => new THREE.Matrix4().makeScale(rx, ry, rz);
  // la palma, un poco por detrás y por debajo del mando (como si lo agarraras)
  const palma = new THREE.Object3D(); palma.position.set(0, -0.012, 0.03); palma.rotation.x = -0.35; raiz.add(palma);
  piezas.push({ obj: palma, forma: forma(0.034, 0.02, 0.042), esfera: true });
  const dedos = [];
  // índice, corazón, anular, meñique: de fuera a dentro, cada uno con 3 falanges
  const xs = [0.024, 0.008, -0.008, -0.022].map(x => x * s), largos = [0.027, 0.029, 0.026, 0.021];
  xs.forEach((x, i) => {
    let padre = palma; const fal = [];
    for (let k = 0; k < 3; k++) {
      const o = new THREE.Object3D();
      o.position.set(k ? 0 : x, k ? 0 : 0.004, k ? -largos[i] : -0.036);
      padre.add(o); fal.push(o);
      // la cápsula va de la articulación hacia delante (−Z)
      const f = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(forma(0.019, largos[i] * 0.55, 0.019));
      piezas.push({ obj: o, forma: new THREE.Matrix4().makeTranslation(0, 0, -largos[i] / 2).multiply(f) });
      padre = o;
    }
    dedos.push(fal);
  });
  // pulgar, por encima del mando
  const pulgar = new THREE.Object3D(); pulgar.position.set(0.028 * s, 0.012, 0.005); pulgar.rotation.set(0.2, -0.8 * s, 0); palma.add(pulgar);
  const p2 = new THREE.Object3D(); p2.position.set(0, 0, -0.028); pulgar.add(p2);
  for (const o of [pulgar, p2]) piezas.push({ obj: o, forma: new THREE.Matrix4().makeTranslation(0, 0, -0.014).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(forma(0.021, 0.016, 0.021)) });
  function posar() {
    dedos.forEach((fal, i) => {
      const c = i === 0 ? cierre.indice : cierre.resto;
      fal[0].rotation.x = -c * 1.25; fal[1].rotation.x = -c * 1.45; fal[2].rotation.x = -c * 1.1;
    });
  }
  return { raiz, piezas, cierre, posar };
}

const _v = new THREE.Vector3(), _m = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0);
