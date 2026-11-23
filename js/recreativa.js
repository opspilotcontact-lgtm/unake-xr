// La recreativa de Unaké: los minijuegos del 2D (escenas Phaser originales) mientras no tengan versión VR nativa.
// Usa el puente (js/puente/puente.js, ver docs/puente.md). La máquina está en el bar; al jugar, la pantalla
// se pone delante de ti (cómodo, de pie o sentado) y vuelve a su sitio al acabar.
//
// Mandos → teclas del 2D: stick = flechas · gatillo der. = espacio (+ clic donde apuntes) · grip der. = X ·
// gatillo izq. = Mayús · grip izq. = P · A = Enter · B/Y = salir. Con las manos: apuntas con el índice
// (desde tu cabeza) y el pellizco es clic + espacio.
import * as THREE from 'three';

// los del 2D que se pueden jugar sueltos (docs/puente.md: los que acaban en panelFinal sin datos de entrada)
export const JUEGOS_2D = [
  ['Cuentas', 'La caja no cuadra'], ['Tarta', 'La tarta entera'], ['Barra', 'Noche de barra'], ['Lasslow', 'Un señor'],
  ['Periquito', '¡Periquito!'], ['Inspeccion', 'La inspección'], ['Aires', 'Por los aires'], ['Palo', 'El palo'],
  ['Sigilo', 'Los discos de la Pompa'], ['Escucha', 'Escucha, escucha'], ['Rendija', 'Por debajo de la puerta'],
  ['Compostura', 'La compostura'], ['EnSuPunto', 'En su punto'], ['Rescate', '¡Que no cunda el amarillo!'],
  ['Blancazo', 'El blancazo'], ['Farol', 'El farol'], ['Mirando', 'Te están mirando'], ['Tormenta', 'La tormenta'],
  ['Recuerdo', 'El recuerdo'], ['Camaras', 'Las cámaras'], ['Recreativa', 'La recreativa de Vuper'], ['DJ', 'La Pompa pincha'],
];

const W = 1.1, H = W * 9 / 16;

export class Recreativa {
  constructor({ escena, xr, ui, sonido, musica }) {
    Object.assign(this, { escena, xr, ui, sonido, musica });
    this.p = null; this.jugando = null; this.teclas = new Set(); this.cargando = null;
    // la máquina: mueble morado con contorno, marquesina y la pantalla
    this.maquina = new THREE.Group(); this.maquina.name = 'recreativa';
    const mueble = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.7, 0.6), new THREE.MeshBasicMaterial({ color: '#3b2a52' }));
    mueble.position.y = 0.85;
    const tinta = new THREE.Mesh(mueble.geometry, new THREE.MeshBasicMaterial({ color: '#140c1c', side: THREE.BackSide })); tinta.scale.setScalar(1.025); mueble.add(tinta);
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#ff5fa2'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#140c1c'; g.font = '64px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RECREATIVA', 256, 68);
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.175), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    marq.position.set(0, 1.58, 0.302);
    this.pantalla = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: '#120c1f', toneMapped: false }));
    this.pantalla.scale.setScalar(0.56 / W); this.pantalla.position.set(0, 1.2, 0.302);
    this.maquina.add(mueble, marq, this.pantalla);
    this.sitioPantalla = { pos: this.pantalla.position.clone(), esc: this.pantalla.scale.x };
    escena.add(this.maquina);
    this.rayo = new THREE.Raycaster();
  }

  colocar(pos, mirandoA) {
    this.maquina.position.copy(pos);
    const d = mirandoA.clone().sub(pos).setY(0).normalize();
    this.maquina.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  }

  async _puente() {
    if (this.p) return this.p;
    if (!this.cargando) this.cargando = import('./puente/puente.js').then(m => m.crearPuente({ ancho: 1280, alto: 720, fpsMax: 45 }));
    this.p = await this.cargando;
    this.p.textura.colorSpace = THREE.SRGBColorSpace;
    this.pantalla.material.map = this.p.textura; this.pantalla.material.color.set('#ffffff'); this.pantalla.material.needsUpdate = true;
    return this.p;
  }

  // elegir un juego: tarjetas en páginas de 5
  elegir(alElegir, pagina = 0) {
    const f = this.xr.adelante.clone().setY(0).normalize();
    const c = this.xr.cabeza.clone().addScaledVector(f, 0.45); c.y = this.xr.cabeza.y - 0.2;
    const trozo = JUEGOS_2D.slice(pagina * 5, pagina * 5 + 5);
    const hay = (pagina + 1) * 5 < JUEGOS_2D.length;
    const ops = [...trozo.map(j => j[1]), hay ? 'Más…' : 'Volver'];
    const cb = t => this._elegido(t, alElegir, pagina);
    this.ui.tarjetasEn(ops.slice(0, 3), c.clone().add(new THREE.Vector3(0, 0.05, 0)), f.clone().negate(), cb);
    this.ui.tarjetasEn(ops.slice(3), c.clone().add(new THREE.Vector3(0, -0.07, 0)), f.clone().negate(), cb, { anadir: true });
  }
  _elegido(t, alElegir, pagina) {
    if (t === 'Más…') return this.elegir(alElegir, pagina + 1);
    if (t === 'Volver') return alElegir(null);
    const j = JUEGOS_2D.find(x => x[1] === t);
    alElegir(j ? j[0] : null);
  }

  // jugar: la pantalla se pone delante de ti; resuelve con el resultado del 2D
  async jugar(clave, { mundo = 'humo' } = {}) {
    this.ui.cartela('Cargando…', 1.5);
    const p = await this._puente();
    await p.desbloquearAudio();
    const f = this.xr.adelante.clone().setY(0).normalize();
    this.escena.attach(this.pantalla);
    this.pantalla.position.copy(this.xr.cabeza).addScaledVector(f, 0.95); this.pantalla.position.y = this.xr.cabeza.y - 0.08;
    this.pantalla.lookAt(this.xr.cabeza); this.pantalla.scale.setScalar(1);
    this.jugando = clave;
    this.ui.instruccion('B/Y para salir');
    setTimeout(() => { if (this.ui._instr === 'B/Y para salir') this.ui.instruccion(null); }, 4000);
    let r;
    try { r = await p.jugar(clave, { panel: false, mundo }); } catch (e) { console.error('[recreativa]', e); r = { abandonado: true }; }
    this._soltarTodo();
    this.jugando = null;
    this.maquina.attach(this.pantalla);
    this.pantalla.position.copy(this.sitioPantalla.pos); this.pantalla.quaternion.identity(); this.pantalla.scale.setScalar(this.sitioPantalla.esc);
    return r;
  }
  salir() { if (this.jugando && this.p) { this.p.cerrar(); } }

  _tecla(code, abajo) {
    if (abajo === this.teclas.has(code)) return;
    if (abajo) this.teclas.add(code); else this.teclas.delete(code);
    this.p.tecla(code, abajo);
  }
  _soltarTodo() { if (this.p) for (const c of [...this.teclas]) this._tecla(c, false); this._abajo = false; }

  actualizar(dt, manos) {
    if (!this.p) return;
    this.p.actualizar();
    if (!this.jugando) return;
    const izq = manos.find(m => m.lado === 'izquierda'), der = manos.find(m => m.lado === 'derecha');
    const gp = m => (m?.activa && !m.esMano ? m.fuente?.gamepad : null);
    const gi = gp(izq), gd = gp(der);
    // stick → flechas
    const ax = gi?.axes?.[2] ?? gd?.axes?.[2] ?? 0, ay = gi?.axes?.[3] ?? gd?.axes?.[3] ?? 0;
    this._tecla('ArrowLeft', ax < -0.5); this._tecla('ArrowRight', ax > 0.5);
    this._tecla('ArrowUp', ay < -0.5); this._tecla('ArrowDown', ay > 0.5);
    const b = (g, i) => !!g?.buttons?.[i]?.pressed;
    this._tecla('KeyX', b(gd, 1)); this._tecla('ShiftLeft', b(gi, 0)); this._tecla('KeyP', b(gi, 1)); this._tecla('Enter', b(gd, 4));
    if (b(gd, 5) || b(gi, 5)) { this.salir(); return; }
    // apuntar a la pantalla: con mando, su rayo; con la mano, desde tu cabeza por el índice
    const quien = der?.activa ? der : izq;
    if (!quien?.activa) return;
    const origen = quien.esMano ? this.xr.cabeza : quien.pos;
    const dir = quien.esMano ? quien.punta.clone().sub(this.xr.cabeza).normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(quien.quat);
    this.rayo.set(origen, dir);
    const hit = this.rayo.intersectObject(this.pantalla, false)[0];
    const pulsa = quien.pinza;
    if (hit?.uv) this.p.puntero(hit.uv.x, hit.uv.y, pulsa && !this._abajo ? 'down' : !pulsa && this._abajo ? 'up' : 'move');
    else if (!pulsa && this._abajo) this.p.puntero(0.5, 0.5, 'up');
    this._abajo = pulsa;
    this._tecla('Space', pulsa);
  }
}
