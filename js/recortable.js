// Recortables: los personajes de la serie como figuras de cartón grueso.
// Delante, el dibujo horneado (herramientas/hornear_personajes.py); detrás, un borde blanco de troquel
// y dos capas de cartón que se ven como canto al mirarlo de lado. Respiran, parpadean, mueven la boca
// al hablar, cambian de pose con rebote y se ladean hacia ti (sin llegar a ponerse de canto).
// Cada personaje tiene dos mundos: «normal» (la persona, de día) y «humo» (su criatura).
import * as THREE from 'three';
import { personaje, fotoPersonaje } from './recursos.js';
import { Bocadillo } from './bocadillo.js';

const GEO = new THREE.PlaneGeometry(1, 1);
const SOMBRA_MAT = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(20,12,28,.55)'); r.addColorStop(1, 'rgba(20,12,28,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
})();
const CARTON = '#b98d5e', CARTON_OSCURO = '#8a6440', PAPEL = '#fffaf0';

// silueta de un color con la transparencia del dibujo
function materialSilueta(color) {
  const m = new THREE.MeshBasicMaterial({ color, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;');
  };
  m.customProgramCacheKey = () => 'silueta';
  return m;
}

// alto en metros de cada uno (lo visible del cuerpo de la pose base). Ajustado mirando fotos.
const ALTOS = {
  lasslow: { humo: 0.72, normal: 1.62 },
  blancaso: { humo: 0.95, normal: 1.68 },
  perico: { humo: 0.62, normal: 1.6 },
  'la-pompa': { humo: 0.85, normal: 1.6 },
  palicaso: { humo: 1.05, normal: 1.74 },
  puky: { humo: 0.6, normal: 1.55 },
  vuper: { humo: 0.9, normal: 1.72 },
  cotine: { humo: 1.0, normal: 1.6 },
};

export class Recortable {
  static async crear(id, mundo = 'normal', opciones = {}) {
    const r = new Recortable(id, opciones);
    await r.ponerMundo(mundo, false);
    return r;
  }

  constructor(id, { escala = 1, giroMax = 1.0 } = {}) {
    this.id = id; this.escala = escala; this.giroMax = giroMax;
    this.grupo = new THREE.Group(); this.grupo.name = 'recortable-' + id;
    this.pivote = new THREE.Group(); this.grupo.add(this.pivote);   // se ladea hacia ti
    this.cuerpo = new THREE.Group(); this.pivote.add(this.cuerpo);  // respira y rebota
    this.frente = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.FrontSide }));
    this.borde = new THREE.Mesh(GEO, materialSilueta(PAPEL));
    this.canto1 = new THREE.Mesh(GEO, materialSilueta(CARTON));
    this.canto2 = new THREE.Mesh(GEO, materialSilueta(CARTON_OSCURO));
    this.frente.renderOrder = 2;
    this.capas = [this.frente, this.borde, this.canto1, this.canto2];
    // sombra de contacto: les pega al suelo (también al de tu casa)
    this.sombra = new THREE.Mesh(GEO, SOMBRA_MAT); this.sombra.rotation.x = -Math.PI / 2; this.sombra.position.y = 0.004;
    this.sombra.renderOrder = 1; this.grupo.add(this.sombra);
    this.cuerpo.add(this.canto2, this.canto1, this.borde, this.frente);
    this.mundo = null; this.indice = null; this.k = 0.001;
    this.poseActual = 'base'; this.fotoActual = null;
    this.t = Math.random() * 10; this.ritmo = 0.22 + Math.random() * 0.1;
    this.rebote = 0; this.vRebote = 0;
    this.proxParpadeo = 1 + Math.random() * 3; this.parpadeando = 0;
    this.hablando = 0; this.proxBoca = 0; this.bocaActual = null;
    this.mirarHacia = null; this.yawBase = 0;
    this.bocadillo = null;
    this._pedida = 0;
    // vida (24/11): balanceo sobre los pies cuando les das, mecerse en el sitio (más con el colocón),
    // fijarse en ti cuando te acercas y estirarse a coger el porro
    this.bal = 0; this.vBal = 0; this.fase = Math.random() * 6.28;
    this.cerca = false; this._visto = -99; this.prisa = 0; this.pico = 0;
  }

  // cuánto se mece la gente (0-1); lo pone js/reacciones.js según tu colocón
  static mareo = 0;

  // ---------- mundo y poses ----------
  async ponerMundo(mundo, conRebote = true) {
    if (mundo === this.mundo) return;
    const indice = await personaje(this.id, mundo);
    // precarga lo de la base (parpadeo y bocas) para que hablar no espere
    const base = Object.keys(indice.fotos).filter(n => n.startsWith('base'));
    await Promise.all(base.map(n => fotoPersonaje(this.id, mundo, n)));
    this.mundo = mundo; this.indice = indice;
    const alto = (ALTOS[this.id]?.[mundo] ?? 1) * this.escala;
    this.k = alto / indice.alto_cuerpo_px;
    const pose = indice.fotos[this.poseActual] ? this.poseActual : 'base';
    this.poseActual = null;
    await this.pose(pose, { rebote: conRebote ? 0.22 : 0 });
  }

  async pose(nombre, { rebote = 0.12 } = {}) {
    if (!this.indice) return;
    if (!this.indice.fotos[nombre]) nombre = 'base';
    if (nombre === this.poseActual) return;
    const pedida = ++this._pedida;
    await this._mostrar(nombre);
    if (pedida !== this._pedida) return;
    this.poseActual = nombre;
    if (rebote) this.empujon(rebote);
  }

  async _mostrar(nombre) {
    const f = this.indice.fotos[nombre]; if (!f) return;
    const mundo = this.mundo;
    const tex = await fotoPersonaje(this.id, mundo, nombre);
    if (mundo !== this.mundo) return;
    this.fotoActual = nombre;
    const k = this.k, w = f.w * k, h = f.h * k;
    const cx = (f.w / 2 - f.ax) * k, cy = (f.ay - f.h / 2) * k;
    this.alto = f.ay * k;
    const anchoSombra = Math.min(w * 0.8, 0.7);
    this.sombra.scale.set(anchoSombra, anchoSombra * 0.45, 1); this._sombraW = anchoSombra;
    this.sombra.visible = !this.enAsiento;
    for (const m of this.capas) { m.material.map = tex; m.material.needsUpdate = true; m.scale.set(w, h, 1); }
    this.frente.position.set(cx, cy, 0);
    // el borde de troquel: la silueta un poco más grande, justo detrás
    const b = 1 + 0.035 * Math.min(1.4, 1 / Math.max(w, h));
    this.borde.scale.set(w * b, h * b, 1); this.borde.position.set(cx, cy, -0.003);
    this.canto1.position.set(cx, cy, -0.008); this.canto1.scale.set(w * b, h * b, 1);
    this.canto2.position.set(cx, cy, -0.014); this.canto2.scale.set(w * b, h * b, 1);
  }

  // un empujón fuerte (golpe, risa) también los hace bailar sobre los pies
  empujon(fuerza = 0.15) {
    this.vRebote += fuerza * 9;
    if (fuerza >= 0.28) this.vBal += (Math.random() < 0.5 ? -1 : 1) * fuerza * 2.4;
  }
  // tambalearse: dir (Vector3 del mundo, opcional) = hacia dónde le empujan
  tambalear(fuerza = 0.5, dir = null) {
    let lado = Math.random() < 0.5 ? -1 : 1;
    if (dir) { _d.set(1, 0, 0).applyQuaternion(this.pivote.getWorldQuaternion(_q)); lado = dir.dot(_d) >= 0 ? -1 : 1; }
    this.vBal += lado * fuerza * 3.2; this.vRebote -= fuerza * 1.5;
  }
  // coger el porro: se estira hacia ti un instante, rebota y se balancea
  cogerPase() { this.pico = 1; this.empujon(0.2); this.vBal += (Math.random() < 0.5 ? -1 : 1) * 0.5; }

  // ---------- hablar ----------
  decir(texto, { dur = null, color } = {}) {
    if (!this.bocadillo) { this.bocadillo = new Bocadillo(); this.grupo.add(this.bocadillo.malla); }
    const d = dur ?? Math.min(5.5, 1.4 + texto.length * 0.055);
    this.bocadillo.mostrar(texto, d, { color });
    this.hablando = Math.min(d, 0.5 + texto.length * 0.045);
    return new Promise(ok => setTimeout(ok, d * 1000));
  }
  callar() { this.hablando = 0; this.bocadillo?.ocultar(); }

  // posición de la boca en el mundo (para pasar el porro, el humo que suelta…)
  bocaMundo(destino = new THREE.Vector3()) {
    const b = this.indice?.boca || [0, -this.indice?.alto_cuerpo_px * 0.6];
    destino.set(b[0] * this.k, -b[1] * this.k, 0.02);
    return this.cuerpo.localToWorld(destino);
  }
  cabezaMundo(destino = new THREE.Vector3()) {
    destino.set(0, this.alto ?? 1, 0);
    return this.cuerpo.localToWorld(destino);
  }

  mirar(punto) { this.mirarHacia = punto; }

  // ---------- por fotograma ----------
  actualizar(dt, camaraPos) {
    if (!this.indice) return;
    this.t += dt;
    // muelle del rebote (squash & stretch: el área se conserva)
    this.vRebote += (-this.rebote * 160 - this.vRebote * 11) * dt;
    this.rebote += this.vRebote * dt;
    const respira = Math.sin(this.t * Math.PI * 2 * this.ritmo) * 0.012;
    const sy = 1 + this.rebote + respira, sx = 1 / Math.sqrt(Math.max(0.3, sy));
    this.cuerpo.scale.set(sx, sy, 1);
    this.pico = Math.max(0, this.pico - dt * 2.2);
    this.cuerpo.rotation.x += ((this.inclina || 0) * 0.2 + Math.sin(this.pico * Math.PI) * 0.3 - this.cuerpo.rotation.x) * Math.min(1, dt * 9);
    // balanceo sobre los pies (muelle poco amortiguado: dos o tres vaivenes) + mecerse en el sitio
    this.vBal += (-this.bal * 55 - this.vBal * 3.4) * dt; this.bal += this.vBal * dt;
    this.bal = THREE.MathUtils.clamp(this.bal, -0.45, 0.45);
    const mece = Math.sin(this.t * 0.85 + this.fase) * (0.008 + Recortable.mareo * 0.04) + Math.sin(this.t * 0.37 + this.fase * 2) * Recortable.mareo * 0.02;
    this.cuerpo.rotation.z = this.bal + mece;
    if (this.sombra.visible && this._sombraW) { const s = 1 - Math.max(0, this.rebote) * 0.6 + Math.abs(this.bal) * 0.4; this.sombra.scale.x = this._sombraW * s; this.sombra.scale.y = this._sombraW * 0.45 * s; }

    // se ladea hacia ti, con tope para no ponerse de canto; si te acercas, se fija en ti (rebotito y gira rápido)
    const objetivo = this.mirarHacia || camaraPos;
    if (objetivo) {
      const p = this.grupo.getWorldPosition(_v);
      if (camaraPos) {
        const d = Math.hypot(camaraPos.x - p.x, camaraPos.z - p.z);
        if (d < 1.25 && !this.cerca) { this.cerca = true; if (this.t - this._visto > 9) { this._visto = this.t; this.prisa = 1; this.empujon(0.07); } }
        else if (d > 1.7) this.cerca = false;
      }
      this.prisa = Math.max(0, this.prisa - dt);
      const yawMundo = Math.atan2(objetivo.x - p.x, objetivo.z - p.z);
      const padre = this.grupo.getWorldQuaternion(_q);
      _e.setFromQuaternion(padre, 'YXZ');
      let rel = yawMundo - _e.y;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const tope = this.cerca ? Math.max(this.giroMax, 1.15) : this.giroMax;
      rel = THREE.MathUtils.clamp(rel, -tope, tope);
      this.pivote.rotation.y += (rel - this.pivote.rotation.y) * Math.min(1, dt * (this.prisa > 0 ? 7 : 3));
    }

    // parpadeo y boca, solo en la pose base (las demás llevan la cara pintada)
    if (this.poseActual === 'base') {
      let quiere = 'base';
      if (this.hablando > 0 && this.indice.habla.length) {
        this.hablando -= dt; this.proxBoca -= dt;
        if (this.proxBoca <= 0) {
          this.proxBoca = 0.07 + Math.random() * 0.08;
          const op = ['closed', ...this.indice.habla].filter(x => x !== this.bocaActual);
          this.bocaActual = op[Math.floor(Math.random() * op.length)];
        }
        quiere = this.bocaActual === 'closed' && !this.indice.habla.includes('closed') ? 'base' : 'base-boca-' + this.bocaActual;
      } else if (this.indice.parpadea) {
        this.proxParpadeo -= dt;
        if (this.parpadeando > 0) { this.parpadeando -= dt; quiere = 'base-parpadeo'; }
        else if (this.proxParpadeo <= 0) { this.parpadeando = 0.13; this.proxParpadeo = 2 + Math.random() * 3.5; quiere = 'base-parpadeo'; }
      }
      if (!this.indice.fotos[quiere]) quiere = 'base';
      if (quiere !== this.fotoActual) this._mostrar(quiere);
    }
    this.bocadillo?.actualizar(dt, this.alto ?? 1, camaraPos, this.grupo);
  }
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _d = new THREE.Vector3();
