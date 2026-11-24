// La recreativa de Unaké: una MÁQUINA ARCADE de verdad para jugar los minijuegos del 2D (escenas Phaser originales,
// por el puente: js/puente/puente.js, docs/puente.md) mientras no tengan versión VR nativa.
//
// Se juega con las manos (o los mandos) sobre su panel físico:
//   · ENCENDER (rojo, arriba a la izq.): enciende/apaga. Al encender, arranque CRT y modo atracción.
//   · ELEGIR (lila) o la PALANCA ▲▼: moverte por la lista. START (crema) o el botón 1: jugar.
//   · SALIR (gris, pequeño): durante la partida, vuelve al menú; en el menú, apaga.
//   · PALANCA grande a la izquierda: se coge (pellizco/puño o gatillo/grip cerca de la bola) y se inclina → flechas.
//   · Botones 1-4 a la derecha: se hunden con la punta del dedo (o del mando); debajo, lo que hacen en ESE juego.
//   · Juegos de puntero: apunta a la pantalla con el dedo (desde tu cabeza) o el rayo del mando y pellizca/gatillo.
// Con mandos, además: stick izq. = palanca · gatillo der. = 1 · A = 2 · B = 3 · grip der. = 4 · X = START · Y = ELEGIR
// (solo cuando estás delante de la máquina encendida: ver `enUso`).
//
// API: colocar(pos, mirandoA) · acercar(cabeza, adelante) · actualizar(dt, manos) · jugar(clave, {mundo}) → resultado
//      salir() · elegir(alElegir) · llamar() · encender() · apagar() · pedir(clave, texto) · alEmpezar(clave) / alTerminar(resultado) (partidas que el
//      jugador empieza él solo en la máquina) · encendida · enUso · ocupada · mundo (texto o función).
import * as THREE from 'three';
import { crearMueble, pintarPanel, pintarMarquesina, MANDOS, RECORRIDO, ALTO_BOTON, ALTO_PANEL, SITIO_JUGADOR, COL } from './recreativa/mueble.js';
import { Interfaz } from './recreativa/interfaz.js';

// controles de cada juego (leídos de base/js/escenas/<escena>.js):
// palanca 'lr' | 'ud' | '4' | '8' | null · botones [code, rótulo] (hasta 4) · puntero (apuntar + pellizco = clic)
// · mapa: cambia una flecha de la palanca por otra tecla (Barra: ▼ = X)
const C = (palanca, textoPalanca, botones = [], { puntero = false, mapa = null } = {}) =>
  ({ palanca, textoPalanca, botones: botones.map(([code, texto]) => ({ code, texto })), puntero, mapa });

// los del 2D que se pueden jugar sueltos (docs/puente.md). El orden y las claves los compara historia.mjs con el motor.
export const JUEGOS_2D = [
  ['Cuentas', 'La caja no cuadra', C('4', '◀ monedas  ▶ billetes  ▼ facturas')],
  ['Tarta', 'La tarta entera', C('lr', 'Mover a Cotine')],
  ['Barra', 'Noche de barra', C('ud', '▼ ¡Fuera! (echar a Puky)', [['Digit1', 'Servir 1'], ['Digit2', 'Servir 2'], ['Digit3', 'Servir 3'], ['Digit4', 'Servir 4']], { mapa: { ArrowDown: 'KeyX', ArrowUp: null } })],
  ['Lasslow', 'Un señor', C(null, '', [['Space', 'Tragar risa'], ['KeyP', 'Soltarlo']])],
  ['Periquito', '¡Periquito!', C(null, '', [['Space', '¡Periquito!']])],
  ['Inspeccion', 'La inspección', C(null, '', [['Digit1', 'Tapar 1'], ['Digit2', 'Tapar 2'], ['Digit3', 'Tapar 3'], ['Digit4', 'Tapar 4']], { puntero: true })],
  ['Aires', 'Por los aires', C('lr', 'Inclinarte', [['Space', 'Gas (mantén)']])],
  ['Palo', 'El palo', C('8', 'Moverte', [['Space', '¡Palo!']])],
  ['Sigilo', 'Los discos de la Pompa', C('8', 'Moverte', [['ShiftLeft', 'Sigilo (mantén)']])],
  ['Escucha', 'Escucha, escucha', C(null, '', [['Space', '¡Frena!']])],
  ['Rendija', 'Por debajo de la puerta', C('8', 'Moverte', [['Space', 'Saltar']])],
  ['Compostura', 'La compostura', C('lr', 'Taparte del lado del chiste', [['Space', 'Coger aire (mantén)']])],
  ['EnSuPunto', 'En su punto', C('lr', 'Mover', [['Space', 'Aire (mantén)']])],
  ['Rescate', '¡Que no cunda el amarillo!', C(null, '', [['Space', 'Subir (mantén)']])],
  ['Blancazo', 'El blancazo', C('8', 'Moverte (disparas solo)', [['ShiftLeft', 'Nube'], ['KeyX', 'Resucitador']])],
  ['Farol', 'El farol', C('lr', '◀ me lo creo  ▶ ¡farol!', [['Digit1', 'Me lo creo'], ['KeyF', '¡Farol!']])],
  ['Mirando', 'Te están mirando', C('lr', 'Moverte')],
  ['Tormenta', 'La tormenta', C('8', '▼ esconderte  ▲ saltar', [['Space', 'Saltar'], ['ShiftLeft', 'Correr (mantén)']])],
  ['Recuerdo', 'El recuerdo', C('lr', 'Andar', [['Space', 'Saltar']])],
  ['Camaras', 'Las cámaras', C('lr', 'Cambiar de cámara', [['KeyN', 'Nocturna'], ['KeyT', 'Térmica'], ['Space', 'Normal']], { puntero: true })],
  ['Recreativa', 'La recreativa de Vuper', C('8', 'Moverte', [['Digit1', 'Dulce'], ['Digit2', 'Salado'], ['Digit3', 'Resucitador'], ['Space', 'Disparar']], { puntero: true })],
  ['DJ', 'La Pompa pincha', C('4', '◀ ▼ ▶ al ritmo', [['ArrowLeft', '◀'], ['ArrowDown', '▼'], ['ArrowRight', '▶']])],
];

const ACCION = ['b1', 'b2', 'b3', 'b4'];
const ARRIBA = ['encender', 'elegir', 'start', 'salir'];
const CLAVE_MEJORES = 'unake-xr-recreativa';
const ANG_PALANCA = 0.42;
// pasos del 2D por segundo: 30 basta para estos juegos y la textura de 1280×720 se sube la mitad de veces (Quest 3S)
export const FPS_PUENTE = 30;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color();

export class Recreativa {
  constructor({ escena, xr, ui, sonido, musica, mundo = 'humo' }) {
    Object.assign(this, { escena, xr, ui, sonido, musica, mundo });
    this.p = null; this.jugando = null; this.teclas = new Set(); this.cargando = null;
    this.alEmpezar = null; this.alTerminar = null; this._alElegir = null;
    this.m = crearMueble();
    this.maquina = this.m.maquina; this.pantalla = this.m.pantalla; this.panel = this.m.panel;
    escena.add(this.maquina);
    this.pantallaUI = new Interfaz();
    this.pantalla.material.map = this.pantallaUI.textura;
    this.rayo = new THREE.Raycaster();
    this.modo = 'apagada'; this.tModo = 0; this.reloj = 0; this._tok = 0; this._dibujoEn = 0;
    this.sel = 0; this.mision = null; this.juego = null; this.ultimo = null;
    this.mejores = {}; try { this.mejores = JSON.parse(localStorage.getItem(CLAVE_MEJORES) || '{}') || {}; } catch { this.mejores = {}; }
    this.palanca = { tx: 0, ty: 0, mano: null, punto: 'punta', ofs: new THREE.Vector3(), dir: '', dirs: new Set(), repetir: 0 };
    this._armado = new Map(); this._abajo = false; this._quienApunta = null;
    this._altura = { cabeza: 1.6, objetivo: 0 };
    this._marq = { fase: -1, clave: '' };
    this._panelClave = '';
    this._pintarPantalla(true); this._pintarPanel(); this._pintarMarquesina(true);
  }

  // ---------- colocar ----------
  colocar(pos, mirandoA) {
    this.maquina.position.copy(pos);
    const d = mirandoA.clone().sub(pos).setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    this.maquina.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
  }
  // «llamar» a la máquina: se pone delante de ti con el panel a tu alcance
  acercar(cabeza = this.xr.cabeza, adelante = this.xr.adelante) {
    const f = adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const pie = cabeza.clone(); pie.y = this.maquina.position.y;
    this.colocar(pie.clone().addScaledVector(f, SITIO_JUGADOR.z), pie);
  }
  _distJugador() {
    const s = this.maquina.localToWorld(_v.copy(SITIO_JUGADOR));
    return Math.hypot(s.x - this.xr.cabeza.x, s.z - this.xr.cabeza.z);
  }
  get encendida() { return this.modo !== 'apagada' && this.modo !== 'apagando'; }
  get ocupada() { return !!this.jugando || this.modo === 'como' || this.modo === 'cargando'; }
  // estás delante de la máquina encendida: tus mandos son suyos (app.js no debe abrir menús ni andar con el stick)
  get enUso() { return this.maquina.visible && this.encendida && this._distJugador() < 1.0; }
  _mundo() { return typeof this.mundo === 'function' ? this.mundo() : this.mundo; }

  // ---------- el puente ----------
  async _puente() {
    if (this.p) return this.p;
    if (!this.cargando) this.cargando = import('./puente/puente.js').then(m => m.crearPuente({ ancho: 1280, alto: 720, fpsMax: FPS_PUENTE }));
    const p = await this.cargando;
    if (!this.p) { this.p = p; p.textura.colorSpace = THREE.SRGBColorSpace; }
    return this.p;
  }

  // ---------- misión de la historia ----------
  pedir(clave, texto = '') {
    const j = clave && JUEGOS_2D.find(x => x[0] === clave);
    this.mision = j ? { clave, titulo: j[1], texto } : null;
    if (this.modo === 'menu') this.sel = 0;
    this._marq.fase = -1; this._pintarMarquesina(true);
  }
  _lista() {
    const l = JUEGOS_2D.map(([clave, titulo, ctrl]) => ({ clave, titulo, ctrl, ayuda: this._ayuda(clave), mision: this.mision?.clave === clave, estrellas: this.mejores[clave] ?? null }));
    const i = l.findIndex(x => x.mision);
    if (i > 0) l.unshift(...l.splice(i, 1));
    return l;
  }
  _ficha(clave) { const j = JUEGOS_2D.find(x => x[0] === clave); return j ? { clave, titulo: j[1], ctrl: j[2], ayuda: this._ayuda(clave) } : { clave, titulo: clave, ctrl: C(null, '') }; }
  // el texto de ayuda del propio 2D (MISIONES de base/js/comun.js), si el puente ya está cargado
  _ayuda(clave) {
    if (!this._misiones && this.p?.ev) { try { this._misiones = this.p.ev('MISIONES'); } catch { this._misiones = null; } }
    return this._misiones?.[clave]?.texto || '';
  }

  // ---------- estados ----------
  _modo(m) {
    const antes = this.modo;
    this.modo = m; this.tModo = 0;
    if (antes === 'como' && m !== 'como') this._alComoFin?.();
    const mat = this.pantalla.material;
    const mapa = m === 'jugando' && this.p ? this.p.textura : this.pantallaUI.textura;
    if (mat.map !== mapa) { mat.map = mapa; mat.needsUpdate = true; }
    this.m.cristal.material.opacity = m === 'jugando' ? 0.1 : m === 'apagada' ? 0.45 : 0.14;
    if (m !== 'jugando') this.m.mira.visible = false;
    this._pintarPanel(); this._pintarPantalla(true);
  }
  _encender(tras = 'atraccion') {
    if (this.encendida && this.modo !== 'apagando') return;
    this._tras = tras; this._modo('encendiendo');
    this._son('whoosh', { volumen: 0.35, tono: 1.4 });
    this._puente().then(p => p.desbloquearAudio?.()).catch(e => console.error('[recreativa] puente', e));
  }
  _apagar() {
    this._cancelar();
    if (this._alElegir) { const cb = this._alElegir; this._alElegir = null; cb(null); }
    this._modo('apagando');
    this._son('fup', { volumen: 0.3, tono: 0.8 });
  }
  _cancelar() {
    this._tok++;
    if (this.jugando && this.p) this.p.cerrar();
    this._soltarTodo();
    this._alComoFin?.();
  }

  // ---------- partidas ----------
  // desde app.js (la historia o el menú): resuelve con el resultado del 2D. La pantalla se queda en la máquina.
  async jugar(clave, { mundo } = {}) {
    this._alElegir = null;
    // si app.js la tenía escondida (de día), aparece para esta partida y se vuelve a esconder al acabar
    const escondida = !this.maquina.visible; this.maquina.visible = true;
    if (this._distJugador() > 0.75) this.acercar(); // no estás delante: la máquina viene a ti
    if (this.ocupada) this._cancelar();
    if (!this.encendida) { this._tras = null; this._modo('encendiendo'); }
    try { return await this._partida(clave, mundo ?? this._mundo()); } finally { if (escondida) { this.maquina.visible = false; this._modo('apagada'); } }
  }
  salir() { if (this.jugando && this.p) this.p.cerrar(); }
  // atajo antiguo: la máquina viene, se enciende en el menú y el START llama a alElegir(clave) (o null al apagar)
  elegir(alElegir) {
    this._alElegir = alElegir;
    this.llamar('menu');
  }
  // «llamar» a la máquina: viene delante de ti (si no estás ya) y se enciende (en la atracción o en el menú)
  llamar(tras = 'atraccion') {
    if (this._distJugador() > 0.75) this.acercar();
    if (!this.encendida) this._encender(tras); else if (!this.ocupada) this._modo('menu');
  }
  encender(tras = 'atraccion') { this._encender(tras); }
  apagar() { if (this.encendida) this._apagar(); }
  async _propia(clave) {
    try { this.alEmpezar?.(clave); } catch (e) { console.error('[recreativa] alEmpezar', e); }
    const r = await this._partida(clave, this._mundo());
    try { this.alTerminar?.({ ...r, clave }); } catch (e) { console.error('[recreativa] alTerminar', e); }
  }
  _elegirJuego(clave) {
    if (this._alElegir) { const cb = this._alElegir; this._alElegir = null; cb(clave); return; }
    this._propia(clave);
  }
  async _partida(clave, mundo) {
    const tok = ++this._tok;
    this.juego = this._ficha(clave);
    this._soltarTodo();
    const pp = this._puente();
    this._modo('como'); this._comoDur = 2.6;
    await new Promise(res => { this._alComoFin = () => { this._alComoFin = null; res(); }; });
    if (tok !== this._tok) return { abandonado: true, motivo: 'cancelado' };
    if (!this.p) this._modo('cargando');
    let p;
    try { p = await pp; } catch (e) { console.error('[recreativa] puente', e); if (tok === this._tok) this._modo('menu'); return { abandonado: true, motivo: 'puente' }; }
    if (tok !== this._tok) return { abandonado: true, motivo: 'cancelado' };
    try { await p.desbloquearAudio(); } catch { /* sin audio */ }
    this.jugando = clave; this._modo('jugando');
    let r;
    try { r = await p.jugar(clave, { panel: false, mundo }); } catch (e) { console.error('[recreativa]', e); r = { abandonado: true, motivo: 'error' }; }
    this._soltarTodo(); this.jugando = null;
    if (r && !r.abandonado) {
      const n = r.estrellas ?? 0;
      if (!(this.mejores[clave] >= n)) { this.mejores[clave] = n; try { localStorage.setItem(CLAVE_MEJORES, JSON.stringify(this.mejores)); } catch { /* sin almacén */ } }
    }
    if (tok !== this._tok) return r || { abandonado: true };
    if (r && !r.abandonado) { this.ultimo = r; this._modo('resultado'); this._son((r.estrellas ?? 0) >= 2 ? 'oooh' : 'campanita', { volumen: 0.5 }); }
    else this._modo('menu');
    return r || { abandonado: true };
  }

  // ---------- teclas hacia el 2D ----------
  _tecla(code, abajo) {
    if (abajo === this.teclas.has(code)) return;
    if (abajo) this.teclas.add(code); else this.teclas.delete(code);
    this.p?.tecla(code, abajo);
  }
  _soltarTodo() {
    for (const c of [...this.teclas]) this._tecla(c, false);
    if (this._abajo && this.p) this.p.puntero(0.5, 0.5, 'up');
    this._abajo = false;
  }

  // ---------- bucle ----------
  actualizar(dt, manos) {
    this.reloj += dt; this.tModo += dt;
    if (this.p) this._pasoPuente();
    const lista = Array.isArray(manos) ? manos : manos ? Object.values(manos) : Object.values(this.xr.manos || {});
    if (!this.maquina.visible) { this._soltarTodo(); return; }
    this.maquina.updateMatrixWorld();
    this._sentado(dt);
    // tiempos de los estados
    if (this.modo === 'encendiendo' && this.tModo > 0.9) { if (this._tras) this._modo(this._tras); }
    else if (this.modo === 'apagando' && this.tModo > 0.4) this._modo('apagada');
    else if (this.modo === 'como' && this.tModo > this._comoDur) this._alComoFin?.();
    else if (this.modo === 'resultado' && this.tModo > 9) this._modo('menu');
    // entrada
    const usa = this._distJugador() < 1.0;
    const mandos = this._mandos(lista, usa && this.encendida);
    this._botones(dt, lista, mandos);
    this._palanca(dt, lista, mandos);
    this._puntero(lista, mandos);
    if (this.modo === 'jugando') this._teclasJuego(); else if (this.teclas.size) this._soltarTodo();
    this._luces();
    this._pintarMarquesina();
    if (this.modo !== 'jugando' && this.modo !== 'apagada' && this.reloj - this._dibujoEn > 1 / 20) this._pintarPantalla();
  }

  // el 2D sigue corriendo siempre (su reloj), pero la textura de la pantalla solo se sube a la GPU si la ves
  _pasoPuente() {
    const p = this.p;
    if (this.modo !== 'jugando' || this._seVe()) { p.actualizar(); return; }
    // paso sin subir la textura (queda «sucia» y se sube en cuanto vuelvas a mirar). Si el puente cambiara y no
    // tuviera _quizaPaso, no se toca nada: su propio reloj de respaldo sigue moviendo el 2D.
    if (typeof p._quizaPaso !== 'function') return;
    const ahora = performance.now(); p._ultimoExterno = ahora; p._quizaPaso(ahora);
  }
  _seVe() {
    if (!this.maquina.visible) return false;
    const c = this.pantalla.getWorldPosition(_v), cab = this.xr.cabeza;
    const d = _w.copy(c).sub(cab); const dist = d.length();
    if (dist < 1.2) return true;
    return d.multiplyScalar(1 / dist).dot(this.xr.adelante) > 0.45; // ~63° desde el centro de la vista (el campo de la Quest 3S ~ ±50°)
  }

  _sentado(dt) {
    const A = this._altura;
    if (this._distJugador() < 1.1) A.cabeza += (this.xr.cabeza.y - A.cabeza) * Math.min(1, dt / 2.5);
    if (A.cabeza < 1.30) A.objetivo = 0.74 - ALTO_PANEL; else if (A.cabeza > 1.42) A.objetivo = 0;
    // Bajar el mueble entero lo mete 25 cm bajo el suelo: en el bar lo tapa el suelo virtual, pero en tu casa
    // (passthrough) se vería atravesando el suelo real. Allí se encoge desde el suelo (panel a la misma altura).
    const enAR = this.xr.modo === 'ar' && this._mundo() !== 'humo';
    const cu = this.m.cuerpo, objY = enAR ? 0 : A.objetivo, objS = enAR ? 1 + A.objetivo / ALTO_PANEL : 1;
    const paso = dt * 0.4;
    const d = objY - cu.position.y;
    if (Math.abs(d) > 1e-4) cu.position.y += Math.sign(d) * Math.min(Math.abs(d), paso);
    const ds = objS - cu.scale.y;
    if (Math.abs(ds) > 1e-4) cu.scale.setScalar(cu.scale.y + Math.sign(ds) * Math.min(Math.abs(ds), paso / ALTO_PANEL));
  }

  // botones de los mandos de las gafas (solo si estás delante de la máquina encendida)
  _mandos(lista, activos) {
    const r = { forzar: {}, stick: null, quien: {}, gatilloLibre: true };
    if (!activos) return r;
    for (const m of lista) {
      const gp = m?.activa && !m.esMano ? m.fuente?.gamepad : null;
      if (!gp) continue;
      const b = i => !!gp.buttons?.[i]?.pressed;
      if (m.lado === 'derecha') {
        if (m !== this.palanca.mano) { r.forzar.b1 = b(0) && !this._gatilloEsClic; r.forzar.b4 = b(1); r.quien.b1 = r.quien.b4 = m; }
        r.forzar.b2 = b(4); r.forzar.b3 = b(5); r.quien.b2 = r.quien.b3 = m;
      } else {
        r.forzar.start = b(4); r.forzar.elegir = b(5); r.quien.start = r.quien.elegir = m;
        const ax = gp.axes?.[2] ?? 0, ay = gp.axes?.[3] ?? 0;
        if (Math.hypot(ax, ay) > 0.2) r.stick = { x: ax, y: -ay, mano: m };
      }
    }
    return r;
  }

  _botones(dt, lista, mandos) {
    const B = this.m.botones;
    let movidos = false;
    for (const [k, b] of Object.entries(B)) {
      let hondo = 0, quien = null;
      for (const m of lista) {
        if (!m?.activa) continue;
        const l = this.panel.worldToLocal(_v.copy(m.punta));
        const dentro = Math.hypot(l.x - b.x, l.y - b.y) < b.r + 0.012;
        const id = k + m.lado;
        if (!dentro || l.z < -0.05 || l.z > ALTO_BOTON + 0.08) { this._armado.delete(id); continue; }
        if (l.z > ALTO_BOTON + 0.004) this._armado.set(id, true);
        if (!this._armado.get(id)) continue;
        const h = THREE.MathUtils.clamp(ALTO_BOTON + 0.006 - l.z, 0, RECORRIDO);
        if (h > hondo) { hondo = h; quien = m; }
      }
      if (mandos.forzar[k]) { hondo = RECORRIDO; quien = mandos.quien[k]; }
      b.hundido += (hondo - b.hundido) * Math.min(1, dt * 30);
      if (Math.abs(b.malla.position.z + b.hundido) > 1e-5) { b.malla.position.z = -b.hundido; movidos = true; }
      if (!b.pulsado && hondo > RECORRIDO * 0.6) { b.pulsado = true; this._alPulsar(k, quien); }
      else if (b.pulsado && hondo < RECORRIDO * 0.3) b.pulsado = false;
    }
    if (movidos) this.m.botonesListos();
  }

  _alPulsar(k, mano) {
    mano?.vibrar?.(0.5, 25);
    this._son('pop', { volumen: 0.22, tono: k === 'encender' ? 0.7 : 1.6 });
    const modo = this.modo;
    if (k === 'encender') { if (this.encendida) this._apagar(); else this._encender(); return; }
    if (!this.encendida || modo === 'encendiendo') return;
    const lista = this._lista();
    if (k === 'start' || (k === 'b1' && (modo === 'menu' || modo === 'atraccion'))) {
      if (modo === 'atraccion') return this._modo('menu');
      if (modo === 'menu') return this._elegirJuego(lista[this.sel].clave);
      if (modo === 'como') return this._alComoFin?.();
      if (modo === 'resultado' && this.juego) return this._propia(this.juego.clave);
      return;
    }
    if (k === 'elegir') {
      if (modo === 'atraccion' || modo === 'resultado') return this._modo('menu');
      if (modo === 'menu') { this.sel = (this.sel + 1) % lista.length; this._pintarPantalla(true); }
      return;
    }
    if (k === 'salir') {
      if (modo === 'jugando') return this.salir();
      if (modo === 'como' || modo === 'cargando') { this._cancelar(); return this._modo('menu'); }
      if (modo === 'resultado') return this._modo('menu');
      return this._apagar();
    }
  }

  _palanca(dt, lista, mandos) {
    const P = this.palanca, px = MANDOS.palanca.x, py = MANDOS.palanca.y;
    const reposo = this.panel.localToWorld(_w.set(px, py, 0.125));
    // coger / soltar
    if (P.mano && (!P.mano.activa || !(P.mano.pinza || P.mano.agarre))) P.mano = null;
    if (!P.mano) {
      for (const m of lista) {
        if (!m?.activa || !(m.pinza || m.agarre)) continue;
        const dPunta = m.punta.distanceTo(reposo), dPos = m.pos.distanceTo(reposo);
        const d = Math.min(dPunta, dPos);
        if (d < 0.075) {
          P.mano = m; P.punto = dPunta <= dPos ? 'punta' : 'pos';
          P.ofs.copy(this.panel.worldToLocal(_v.copy(m[P.punto]))).sub(_w.set(px, py, 0.125));
          m.vibrar?.(0.4, 30); break;
        }
      }
    }
    let tx = 0, ty = 0;
    if (P.mano) {
      const l = this.panel.worldToLocal(_v.copy(P.mano[P.punto])).sub(P.ofs);
      tx = (l.x - px) / 0.05; ty = (l.y - py) / 0.05;
    } else if (mandos.stick) { tx = mandos.stick.x; ty = mandos.stick.y; }
    const mag = Math.hypot(tx, ty); if (mag > 1) { tx /= mag; ty /= mag; }
    const k = P.mano || mandos.stick ? 1 : Math.min(1, dt * 18);
    P.tx += (tx - P.tx) * k; P.ty += (ty - P.ty) * k;
    this.m.pivote.rotation.set(-P.ty * ANG_PALANCA, P.tx * ANG_PALANCA, 0);
    // dirección según el tipo de palanca del juego (en el menú, ▲▼)
    const tipo = this.modo === 'jugando' || this.modo === 'como' ? this.juego?.ctrl.palanca : '4';
    const dirs = dirsDe(P.tx, P.ty, tipo);
    const clave = [...dirs].join();
    if (clave !== P.dir) {
      if (dirs.size) { (P.mano || mandos.stick?.mano)?.vibrar?.(0.3, 18); this._son('pop', { volumen: 0.08, tono: 2.2 }); }
      P.dir = clave; P.dirs = dirs; P.repetir = 0;
      this._palancaMenu(dirs);
    } else if (dirs.size && this.modo === 'menu') {
      P.repetir += dt; if (P.repetir > 0.38) { P.repetir = 0.2; this._palancaMenu(dirs); }
    }
  }
  _palancaMenu(dirs) {
    if (!dirs.size || !this.encendida) return;
    if (this.modo === 'atraccion') return this._modo('menu');
    if (this.modo !== 'menu') return;
    const n = this._lista().length;
    if (dirs.has('ArrowUp') || dirs.has('ArrowLeft')) this.sel = (this.sel + n - 1) % n;
    else if (dirs.has('ArrowDown') || dirs.has('ArrowRight')) this.sel = (this.sel + 1) % n;
    this._pintarPantalla(true);
  }

  _puntero(lista, mandos) {
    const mira = this.m.mira;
    if (this.modo !== 'jugando' || !this.juego?.ctrl.puntero || !this.p) { mira.visible = false; this._gatilloEsClic = false; return; }
    // quién apunta: la derecha si puede (y no lleva la palanca), si no la izquierda
    let quien = null;
    for (const m of [lista.find(x => x?.lado === 'derecha'), lista.find(x => x?.lado === 'izquierda')]) {
      if (!m?.activa || m === this.palanca.mano) continue;
      if (m.esMano) { // la mano sobre el panel está pulsando botones, no apuntando
        const l = this.panel.worldToLocal(_v.copy(m.punta));
        if (l.z < 0.09 && Math.abs(l.x) < 0.45 && Math.abs(l.y) < 0.22) continue;
      }
      quien = m; break;
    }
    let hit = null;
    if (quien) {
      const origen = quien.esMano ? this.xr.cabeza : quien.pos;
      const dir = quien.esMano ? _w.copy(quien.punta).sub(this.xr.cabeza).normalize() : _w.set(0, 0, -1).applyQuaternion(quien.quat);
      this.rayo.set(origen, dir);
      hit = this.rayo.intersectObject(this.pantalla, false)[0];
    }
    const pulsa = !!quien?.pinza && !!hit;
    if (hit?.uv) {
      mira.visible = true;
      mira.position.set((hit.uv.x - 0.5) * this.pantalla.geometry.parameters.width, (hit.uv.y - 0.5) * this.pantalla.geometry.parameters.height, 0.005);
      mira.scale.setScalar(pulsa ? 0.8 : 1);
      this.p.puntero(hit.uv.x, hit.uv.y, pulsa && !this._abajo ? 'down' : !pulsa && this._abajo ? 'up' : 'move');
      if (pulsa && !this._abajo) quien.vibrar?.(0.3, 15);
      // con el mando, el gatillo que apunta a la pantalla es clic, no el botón 1
      if (!quien.esMano && quien.lado === 'derecha') this._gatilloEsClic = true;
    } else {
      mira.visible = false;
      if (this._abajo) this.p.puntero(0.5, 0.5, 'up');
      this._gatilloEsClic = false;
    }
    this._abajo = pulsa && !!hit;
  }

  _teclasJuego() {
    const c = this.juego?.ctrl; if (!c) return;
    const quiero = new Set();
    for (const d of this.palanca.dirs) {
      const code = c.mapa && d in c.mapa ? c.mapa[d] : d;
      if (code) quiero.add(code);
    }
    ACCION.forEach((k, i) => {
      const b = this.m.botones[k];
      if (!c.botones[i] || !b.pulsado) return;
      quiero.add(c.botones[i].code);
    });
    if (this.m.botones.start.pulsado) quiero.add('Enter');
    for (const code of new Set([...this.teclas, ...quiero])) this._tecla(code, quiero.has(code));
  }

  // ---------- luces y pintura ----------
  _luces() {
    const B = this.m.botones, modo = this.modo, c = this.juego?.ctrl, t = this.reloj;
    const parp = (v = 3) => 0.55 + 0.45 * Math.sin(t * v * Math.PI);
    const L = {};
    if (modo === 'apagada' || modo === 'apagando') L.encender = this.mision ? parp(3) : parp(1);
    else {
      L.encender = 1; L.salir = 0.8;
      if (modo === 'atraccion') { L.start = parp(2.5); L.elegir = 1; L.b1 = 0.8; }
      else if (modo === 'menu') { L.start = parp(2); L.elegir = 1; L.b1 = 1; }
      else if (modo === 'resultado') { L.start = parp(2); L.elegir = 1; }
      else if (modo === 'como' || modo === 'jugando' || modo === 'cargando') {
        c?.botones.forEach((_, i) => { L[ACCION[i]] = modo === 'como' ? parp(4) : 1; });
        L.start = modo === 'como' ? 1 : 0.5;
      }
    }
    for (const [k, b] of Object.entries(B)) {
      const v = L[k] || 0;
      _c.set(v > 0 ? b.color : COL.apagado);
      if (v > 0) _c.multiplyScalar(0.45 + 0.55 * v + (b.pulsado ? 0.25 : 0));
      if (!b._c) b._c = new THREE.Color(-1, -1, -1);
      if (!b._c.equals(_c)) { b._c.copy(_c); this.m.colorBoton(k, _c); }
    }
    const usaPalanca = (modo === 'menu' || modo === 'atraccion') || ((modo === 'como' || modo === 'jugando') && c?.palanca);
    this.m.palo.material.color.set(usaPalanca ? COL.rosa : '#6a5878');
    if (modo === 'como' && c?.palanca) this.m.palo.material.color.multiplyScalar(parp(4));
    // monedero: late; con misión, más deprisa
    this.m.moneda.material.opacity = this.mision ? 0.35 + 0.6 * Math.abs(Math.sin(t * 5)) : 0.3 + 0.35 * Math.abs(Math.sin(t * 1.4));
  }
  _pintarPanel() {
    const modo = this.modo, c = this.juego?.ctrl;
    const enJuego = (modo === 'como' || modo === 'jugando' || modo === 'cargando' || modo === 'resultado') && c;
    const clave = modo + '|' + (enJuego ? this.juego.clave : '');
    if (clave === this._panelClave) return;
    this._panelClave = clave;
    const rotulos = {}, luces = {};
    let palanca = '';
    if (!this.encendida) { luces.encender = 1; }
    else if (enJuego) {
      c.botones.forEach((b, i) => { rotulos[ACCION[i]] = b.texto; luces[ACCION[i]] = 1; });
      palanca = c.palanca ? (c.textoPalanca || 'Moverte') : '';
      Object.assign(luces, { encender: 1, start: 1, salir: 1 });
      if (modo === 'resultado') { for (const k of ACCION) { delete luces[k]; delete rotulos[k]; } palanca = ''; luces.elegir = 1; rotulos.start = 'OTRA VEZ'; }
    } else {
      rotulos.b1 = 'JUGAR'; palanca = '▲▼ ELEGIR JUEGO';
      Object.assign(luces, { b1: 1, encender: 1, start: 1, elegir: 1, salir: 1 });
    }
    for (const k of ACCION) if (!(k in rotulos)) rotulos[k] = '';
    pintarPanel(this.m.cPanel, { rotulos, luces, palanca });
    this.m.actualizarPanel();
  }
  _pintarMarquesina(forzar = false) {
    const M = this._marq;
    const fase = this.mision ? Math.floor(this.reloj / 1.4) % 2 : 0;
    const enc = this.encendida;
    const clave = `${fase}|${enc}|${this.mision?.clave || ''}`;
    if (!forzar && clave === M.clave) return;
    M.clave = clave;
    const o = this.mision && fase ? { texto: '★ MISIÓN ★', sub: this.mision.titulo.toUpperCase() } : { texto: 'RECREATIVA', sub: this.mision ? '¡ENCIÉNDEME!' : '' };
    if (this.mision && enc && !fase) o.sub = 'ELIGE: ' + this.mision.titulo.toUpperCase();
    pintarMarquesina(this.m.cMarq, { ...o, encendida: true, brillo: enc ? 1 : 0.8 });
    this.m.marquesina.material.map.needsUpdate = true;
  }
  _pintarPantalla(forzar = false) {
    if (!forzar && this.modo === 'apagada') return;
    this._dibujoEn = this.reloj;
    if (this.juego && !this.juego.ayuda) this.juego.ayuda = this._ayuda(this.juego.clave);
    const lista = this._lista();
    this.sel = Math.min(this.sel, lista.length - 1);
    this.pantallaUI.dibujar({
      modo: this.modo, t: this.tModo, reloj: this.reloj, lista, sel: this.sel, mision: this.mision,
      juego: this.juego, resultado: this.ultimo, dur: this._comoDur || 2.6, cargando: !this.p,
    });
  }
  _son(n, o) { try { this.sonido?.(n, o); } catch { /* sin sonido */ } }

  // para las pruebas y para app.js: el estado en una línea
  estado() {
    return { modo: this.modo, sel: this.sel, juego: this.juego?.clave || null, jugando: this.jugando, mision: this.mision?.clave || null, teclas: [...this.teclas], palanca: this.palanca.dir, enUso: this.enUso };
  }
}

// flechas de la palanca según su tipo: 'lr' solo ◀▶ · 'ud' solo ▲▼ · '4' el eje dominante · '8' las diagonales también
function dirsDe(tx, ty, tipo) {
  const s = new Set(), U = 0.38;
  if (!tipo || Math.hypot(tx, ty) < 0.35) return s;
  const h = tx > U ? 'ArrowRight' : tx < -U ? 'ArrowLeft' : null, v = ty > U ? 'ArrowUp' : ty < -U ? 'ArrowDown' : null;
  if (tipo === 'lr') { if (h) s.add(h); }
  else if (tipo === 'ud') { if (v) s.add(v); }
  else if (tipo === '4') { if (Math.abs(tx) >= Math.abs(ty)) { if (h) s.add(h); } else if (v) s.add(v); }
  else { if (h) s.add(h); if (v) s.add(v); }
  return s;
}
