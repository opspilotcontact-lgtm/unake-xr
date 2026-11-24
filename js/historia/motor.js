// El motor de historia y economía del XR (F1). El 2D es el motor único de DATOS y REGLAS (ver datos.js): su ESTADO,
// vivo en el iframe del puente, ES la partida del XR (localStorage['unake-xr-partida']; NUNCA 'unake-partida').
// Aquí solo se repite lo que en el 2D vive dentro de métodos de la escena Barrio (que el puente no arranca), con
// sus mismas constantes y funciones, y se traduce lo que pasa en las gafas a lo que el 2D espera.
//
//   const motor = await MotorHistoria.crear();             // crea el puente compartido (o usa el que le pases)
//   motor.on('alEscena', …)                                // hay una escena de cómic esperando (escenas.js la cuenta)
//   motor.avisar('minijuego', { clave: 'Cuentas', puntos: 900, gana: true });   // cobra como el 2D
//   motor.objetivos()                                      // lo que pinta la muñeca
//   motor.hacer(objetivo.accion)                           // botón del objetivo: lo hace el motor o lo devuelve
//   motor.paso(dt, { colocon })                            // cada fotograma: hambre, vida, caja del negocio, pista
//
// Entrada (`avisar(tipo, datos)`):
//   'minijuego' {clave, puntos, gana}  nativo (js/minijuegos) o recreativa (puente con panel: false): cobra igual
//   'calada' {nivel}  'liar'  'porro'  'pase' {a}  'puerta'  'mundo' {mundo}  'sala' {id, gente?}  'hablar' {con}
//   'recoger' {sala?, tipo?}  'hucha' {monchis}  'entrega' {pago}
// Salida (`on(nombre, fn)`): alEmpezarCapitulo {cap}, alCumplirObjetivo {cap, objetivo}, alAcabarCapitulo {cap,
//   premio, final}, alEscena {escena}, alPista {de, texto}, alCobro {clave, monchis, linea…}, alDesmayo {perdidos},
//   alCambiar {tipo}.
import { cargarDatos, CLAVE_PARTIDA } from './datos.js';

export { CLAVE_PARTIDA };

// ---------- lo que hay hoy en el XR ----------
// Si un minijuego está en NATIVOS, la historia lo juega en VR aunque también esté en la recreativa.
// En su punto NO: en la Quest iba fatal (24/11); se juega en la máquina.
export const NATIVOS = { Pipas: 'pipas', TiroPato: 'tiropato', Cuentas: 'cuentas', Casetas: 'casetas', Amarillo: 'amarillo', Furgo: 'furgo', Control: 'control' };
// Copia de JUEGOS_2D (js/recreativa.js); la prueba historia.mjs comprueba que coinciden.
export const RECREATIVA = ['Cuentas', 'Tarta', 'Barra', 'Lasslow', 'Periquito', 'Inspeccion', 'Aires', 'Palo', 'Sigilo',
  'Escucha', 'Rendija', 'Compostura', 'EnSuPunto', 'Rescate', 'Blancazo', 'Farol', 'Mirando', 'Tormenta', 'Recuerdo',
  'Camaras', 'Recreativa', 'DJ'];
// Quién vive en cada sala del barrio XR (js/barrio/salas.js → CASAS, con los ids de la historia).
// Niebla y el Mirón aún no tienen sala propia en el XR: PROPUESTA, la plaza (ella deambula; él vigila el banco).
export const CASAS = { blancaso: 'plaza', perico: 'fuera', palicaso: 'dentro', pompa: 'dentro', lasslow: 'dentro', cotine: 'cocina', puky: 'bano', niebla: 'plaza', miron: 'plaza' };
const SOLO_HUMO = ['puky'];
const PISTA_MS = 180000; // TAREA_PISTA_MS del 2D

// ---------- equivalencias de los capítulos de objetivos (todos a la vez) ----------
// clave `${capId}#${índice}`. como: gafas (lo hace el XR o el motor) · nativo · recreativa (puente) · barrio (entrar en
// la sala) · equivalente (otro camino que cuenta igual) · pendiente (sin equivalente: ofrece «Seguir la historia»).
// `cumple(s)` se suma al `hecho()` del 2D (basta uno de los dos). `accion`: el botón del objetivo.
const nat = clave => ({ como: 'nativo', accion: { tipo: 'nativo', id: NATIVOS[clave], clave } });
const rec = clave => NATIVOS[clave] ? nat(clave) : { como: 'recreativa', accion: { tipo: 'recreativa', clave } };
const hucha = meta => ({ como: 'gafas', accion: { tipo: 'hucha', meta }, ayuda: 'Aporta tus monchis a la hucha de Blancaso' });
export const EQUIV_OBJETIVOS = {
  'una-que#0': { como: 'barrio', ayuda: 'En la tienda de 24 h, toca el tablón de ENCARGOS y lleva el pedido', cumple: s => s.stat('victorias') >= 1 || s.stat('entregas') >= 1, accion: { tipo: 'barrio', salas: ['tienda'] } },
  'una-que#1': { como: 'gafas', ayuda: 'Contraseña y empuja la puerta', accion: { tipo: 'puerta' } },
  'una-que#2': { como: 'gafas', ayuda: 'Lía y da una calada', accion: { tipo: 'fumar' } },
  'cuota#0': { ...rec('Barra'), ayuda: 'Sirve la barra (buscar las cajas por el barrio se salta en el XR)' },
  'cuota#1': rec('Tarta'),
  'cuota#2': { como: 'gafas', ayuda: 'Una mejora del negocio (el mismo precio que en el 2D)', accion: { tipo: 'mejora' } },
  'cuota#3': hucha(100),
  'blancazo#0': { como: 'gafas', ayuda: 'Con el porro encendido, acércaselo a Blancaso', accion: { tipo: 'pasar', a: 'blancaso' } },
  'blancazo#1': { ...rec('Blancazo'), cumple: s => s.stat('gana_Blancazo') >= 1 },
  'senor#0': { ...rec('Lasslow'), ayuda: 'Aguanta la cena (la pajarita se da por encontrada en el XR)' },
  'senor#1': { ...rec('Cuentas'), ayuda: 'Cuadra las facturas (buscarlas por el barrio se salta en el XR)' },
  'senor#2': { como: 'gafas', ayuda: 'El taller de tu cuarto: el invento más barato', accion: { tipo: 'invento' } },
  'senor#3': { como: 'gafas', ayuda: 'Mejoras del negocio y cobrar su caja', accion: { tipo: 'mejora' } },
  'senor#4': hucha(300),
  'caja#0': rec('Cuentas'),
  'caja#1': { como: 'barrio', ayuda: 'Ve a ver a Perico a la puerta', accion: { tipo: 'barrio', salas: ['fuera'], con: 'perico' } },
  'caja#2': rec('Farol'),
  'perico#0': rec('Periquito'),
  'perico#1': nat('Pipas'),
  'perico#2': { como: 'barrio', ayuda: 'De día, ve a ver a Perico a la puerta', accion: { tipo: 'barrio', salas: ['fuera'], con: 'perico', mundo: 'normal' } },
  'perico#3': hucha(500),
  'inspeccion#0': rec('Sigilo'),
  'inspeccion#1': rec('Inspeccion'),
  'inspeccion#2': rec('Rescate'),
  'inspeccion#3': { como: 'gafas', ayuda: 'Mejoras del negocio y cobrar su caja', accion: { tipo: 'mejora' } },
  'inspeccion#4': hucha(750),
  'epica#0': rec('Tarta'),
  'epica#1': hucha(1000),
};

// ---------- equivalencia de una tarea (capítulos nuevos, de una en una) ----------
export function equivTarea(t, d) {
  switch (t.tipo) {
    case 'minijuego':
      if (NATIVOS[t.minijuego]) return nat(t.minijuego);
      if (RECREATIVA.includes(t.minijuego)) return rec(t.minijuego);
      return { como: 'pendiente', ayuda: `«${t.minijuego}» aún no está en el XR`, accion: { tipo: 'seguir' } };
    case 'flashback':
      if (t.minijuego) return equivTarea({ ...t, tipo: 'minijuego' }, d);
      return { como: 'gafas', ayuda: 'Es un recuerdo: déjalo correr', accion: null };
    case 'recoger': {
      const salas = [...new Set(d.recogerDeTarea(t).map(r => r.sala))];
      return { como: 'barrio', ayuda: `Entra en ${salas.length > 1 ? 'esas salas' : 'esa sala'} del barrio y lo coges`, accion: { tipo: 'barrio', salas } };
    }
    case 'recado': {
      const ob = d.OBJETOS_RECADO[d.objetoDeTarea(t)];
      return { como: 'barrio', ayuda: ob ? `En la tienda de 24 h: ${ob.nombre.toLowerCase()} (${ob.precio} monchis)` : 'En la tienda de 24 h', accion: { tipo: 'barrio', salas: ['tienda'] } };
    }
    case 'charla': case 'dia': {
      const con = d.conDeTarea(t);
      return { como: 'barrio', ayuda: 'Ve a su sala del barrio', accion: { tipo: 'barrio', salas: [...new Set(con.map(id => CASAS[id]).filter(Boolean))], con } };
    }
    default: return { como: 'pendiente', accion: { tipo: 'seguir' } };
  }
}

const sinParentesis = x => (x || '').replace(/\s*\([^)]*\)/g, '').trim();
// Lo que el XR añade a la partida del 2D (campos nuevos: el 2D los ignora y los guarda con lo suyo).
const EXTRA_XR = () => ({ hechos: {}, saltados: {}, cierreDe: null, ultimoAvance: Date.now(), porroContado: false, mundoXR: 'normal' });

export class MotorHistoria {
  // op: { puente (uno ya creado con clavePartida), datos (ya cargados), nueva }
  static async crear(op = {}) {
    const m = new MotorHistoria();
    m.d = op.datos || await cargarDatos({ puente: op.puente });
    m.puente = m.d.puente;
    if (op.nueva) m.d.reemplazarEstado(m.d.partidaNueva());
    m.preparar();
    return m;
  }

  constructor() {
    this.oyentes = {};
    this.cola = []; this.enCurso = null;
    this.ultimaPista = 0; this.tGuardar = 0; this.tNegocio = 0;
  }

  // ---------- partida (el ESTADO del 2D) ----------
  get E() { return this.d.estado(); }
  preparar() {
    const E = this.E, x = EXTRA_XR();
    for (const k of Object.keys(x)) if (E[k] === undefined) E[k] = x[k];
    E.stats = E.stats || {}; E.estrellas = E.estrellas || {}; E.inventos = E.inventos || {}; E.situaciones = E.situaciones || {};
    if (E.capitulo === undefined) E.capitulo = 0;
    this.cola = []; this.enCurso = null;
    this.d.negocio();
    this.guardar();
  }
  guardar() { try { this.d.guardarPartida(); } catch (e) { console.warn('[historia] guardar', e.message); } }
  reiniciar() { this.d.reemplazarEstado(this.d.partidaNueva()); this.preparar(); this.emitir('alCambiar', { tipo: 'reinicio' }); this.tic(); }

  // Pruebas: empezar en el capítulo n con lo que los anteriores habrían dejado (hucha, dentro, fumado).
  irA(n, { conIntro = true } = {}) {
    const E = this.d.partidaNueva();
    const metas = [0, 0, 100, 100, 100, 100, 300, 300, 300, 300, 500, 500, 500, 500, 500, 750, 750];
    E.hucha = metas[Math.min(n, metas.length - 1)] || 0;
    E.capitulo = Math.max(0, Math.min(n, this.d.CAPITULOS.length));
    if (n > 0) { E.dentro = true; E.stats = { fumadas: 1 }; }
    this.d.reemplazarEstado(E); this.preparar();
    if (!conIntro && !this.acabada) { this.E.introCapId = this.cap.id; this.E.introCap = this.E.capitulo; this.E.baseCap = { ...this.E.stats }; }
    this.emitir('alCambiar', { tipo: 'irA' });
    this.tic();
  }

  // ---------- consultas ----------
  idx(id) { return this.d.capIdx(id); }
  get acabada() { return (this.E.capitulo || 0) >= this.d.CAPITULOS.length; }
  get cap() { return this.acabada ? null : this.d.normalizarCapitulo(this.d.CAPITULOS[this.E.capitulo]); }
  get monchis() { return this.E.monchis; }
  get hucha() { return this.E.hucha; }
  get metaHucha() { return this.d.META_HUCHA; }
  stat(k) { return this.d.stat(k); }
  desdeCap(k) { return this.d.desdeCap(k); }
  sumar(k, n = 1) { const E = this.E; E.stats[k] = (E.stats[k] || 0) + n; }
  capitulo() {
    const c = this.cap; if (!c) return { id: 'libre', titulo: 'Modo libre', indice: this.d.CAPITULOS.length, etiqueta: '', final: true };
    return { id: c.id, titulo: c.titulo, indice: this.E.capitulo, etiqueta: this.d.etiquetaCap(this.E.capitulo), arte: c.arte, premio: c.premio || 0, final: !!c.final, deTareas: !!c.tareas };
  }
  enIntro() { return !this.acabada && this.E.introCapId !== this.cap.id; }
  // Necesidades e inventario, para el HUD del director.
  necesidades() { const E = this.E; return { hambre: E.hambre, vida: E.vida, monchis: E.monchis, hucha: E.hucha, inv: { ...E.inv } }; }

  // Lo que pinta la muñeca: { cap, historia, otros, opcionales, todos, enIntro }.
  objetivos() {
    const E = this.E, cap = this.cap;
    if (!cap) return { cap: this.capitulo(), historia: null, otros: [], opcionales: [], todos: [], enIntro: false };
    const todos = cap.tareas ? this._objetivosTareas(cap) : this._objetivosViejos(cap);
    const historia = todos.find(o => o.actual && !o.hecho) || todos.find(o => !o.hecho) || null;
    const otros = todos.filter(o => !o.hecho && o !== historia);
    // Lo opcional (se ve pero no grita): la hucha si este capítulo no la pide, y la caja del negocio por cobrar.
    const opcionales = [];
    if (!todos.some(o => o.accion && o.accion.tipo === 'hucha') && E.capitulo >= this.idx('cuota') && E.hucha < this.d.META_HUCHA) {
      opcionales.push({ id: 'hucha', texto: `Hucha de la aso: ${E.hucha}/${this.d.META_HUCHA}`, corto: `Hucha ${E.hucha}/${this.d.META_HUCHA}`, opcional: true, como: 'gafas', accion: this._accionViva({ tipo: 'hucha', meta: this.d.META_HUCHA }) });
    }
    const caja = Math.floor(this.d.negocio().caja || 0);
    if (caja >= 5) opcionales.push({ id: 'caja', texto: `La caja de Unaké: ${caja} monchis`, corto: `Caja del bar: ${caja}`, opcional: true, como: 'gafas', accion: { tipo: 'cobrar', puede: true, texto: 'Cobrar' } });
    return { cap: this.capitulo(), historia, otros, opcionales, todos, enIntro: this.enIntro() };
  }
  _objetivosViejos(cap) {
    const hechos = this.E.hechos[cap.id] || [];
    const primero = cap.objetivos.findIndex((_, j) => !hechos.includes(j));
    return cap.objetivos.map((o, i) => {
      const k = `${cap.id}#${i}`, eq = EQUIV_OBJETIVOS[k] || { como: 'pendiente', accion: { tipo: 'seguir' } };
      let progreso = '';
      try { progreso = o.progreso ? o.progreso() : ''; } catch { /* sin progreso */ }
      return { id: k, texto: o.texto, corto: sinParentesis(o.texto), hecho: hechos.includes(i), actual: i === primero, progreso, como: eq.como, ayuda: eq.ayuda || '', accion: this._accionViva(eq.accion), indice: i };
    });
  }
  _objetivosTareas(cap) {
    const T = this.E.tarea && this.E.tarea.cap === cap.id ? this.E.tarea : null;
    const i = T ? T.i : 0;
    // como en el 2D: las ya hechas y la actual (las siguientes no se ven hasta su momento)
    return cap.tareas.slice(0, Math.min(cap.tareas.length, i + 1)).map((t, k) => {
      const eq = equivTarea(t, this.d);
      const hecho = k < i || (k === i && T && T.fase === 'despues');
      return {
        id: `${cap.id}:${t.id}`, texto: t.texto, corto: sinParentesis(t.texto), hecho, actual: k === i,
        progreso: k === i && T ? this.d.progresoTarea(t, T) : '', como: eq.como, ayuda: eq.ayuda || '',
        accion: this._accionViva(eq.accion), tipo: t.tipo, indice: k, mundo: this.d.mundoDeTarea(t),
      };
    });
  }
  _accionViva(a) {
    if (!a) return null;
    const E = this.E;
    if (a.tipo === 'hucha') {
      const falta = Math.max(0, a.meta - E.hucha);
      return { ...a, falta, puede: E.monchis > 0 && falta > 0, texto: E.monchis > 0 ? `Aportar ${Math.min(falta, E.monchis)}` : 'Gana monchis jugando' };
    }
    if (a.tipo === 'mejora') { const m = this.mejoraMasBarata(); return { ...a, mejora: m && m.id, precio: m && m.precio, puede: !!m && E.monchis >= m.precio, texto: m ? `${m.nombre} (${m.precio})` : 'Negocio al máximo por ahora' }; }
    if (a.tipo === 'invento') { const iv = this.inventoMasBarato(); return { ...a, invento: iv && iv.id, precio: iv && iv.precio, puede: !!iv && E.monchis >= iv.precio, texto: iv ? `${iv.nombre} (${iv.precio})` : 'Ya los tienes todos' }; }
    const textos = { recreativa: 'Jugar en la recreativa', nativo: 'Jugar', barrio: 'Ir al barrio', seguir: 'Seguir la historia', menu: 'Elegir minijuego', fumar: 'Liar y fumar', pasar: 'Pasárselo', puerta: 'La puerta' };
    return { ...a, puede: true, texto: textos[a.tipo] || '' };
  }

  // La pista del objetivo que toca: { de, texto } (de = quien la dice, con su voz).
  pista() {
    const cap = this.cap; if (!cap) return null;
    if (cap.tareas) {
      const T = this.E.tarea; if (!T || T.cap !== cap.id) return null;
      const t = cap.tareas[T.i]; if (!t || !t.pista) return null;
      return { de: this.d.quienDicePista(t) || 'narrador', texto: this.d.textoPista(t, 95) };
    }
    const o = this.objetivos().historia; if (!o) return null;
    return { de: 'narrador', texto: `Te falta: ${o.corto}.` };
  }

  // ---------- eventos de entrada ----------
  avisar(tipo, x = {}) {
    const E = this.E;
    switch (tipo) {
      case 'minijuego': this.cobrar(x); break;
      case 'liar': this.sumar('liados'); E.porroContado = false; break;
      case 'calada':
        this.sumar('caladas');
        // Un porro liado y fumado = una «fumada» del 2D (fumar.js la apunta al acabar la escena de fumar).
        if (!E.porroContado) { E.porroContado = true; this.sumar('fumadas'); }
        break;
      case 'porro': E.porroContado = false; break;
      case 'pase':
        this.sumar('pases'); if (x.a) this.sumar(`pase_${x.a}`);
        if (x.a === 'blancaso') this.sumar('blancasoFumo');
        break;
      case 'puerta': E.dentro = true; this.sumar('puertaEmpujada'); break;
      case 'mundo':
        E.mundoXR = x.mundo === 'humo' ? 'humo' : 'normal';
        if (E.mundoXR === 'humo') E.dentro = true;
        break;
      case 'sala': this._entrarSala(x.id, x.gente); break;
      case 'hablar': this._hablar(x.con); break;
      case 'recoger': this._recoger(x.sala, x.tipo); break;
      case 'hucha': this.aportar(x.monchis ?? E.monchis); break;
      case 'entrega': this.sumar('entregas'); E.monchis += x.pago || 0; break;
      default: console.warn('[historia] evento desconocido', tipo);
    }
    this.guardar();
    this.tic();
    this.emitir('alCambiar', { tipo });
  }

  // ---------- economía (reglas del 2D) ----------
  // El cobro de un minijuego: comun.js → mostrarPanelFinal, sin el panel. De noche ×1,5; por estrellas
  // (PAGO_ESTRELLAS); perdiendo, migajas (puntos / divisor, máx. 10); el mismo seguido paga menos; bonos de
  // decoración y armario; noche especial del sitio; apuntar() (récord, estrellas, bono por estrella nueva, nivel);
  // y la situación que esperaba justo este minijuego (completarSituacion).
  cobrar({ clave, puntos = 0, gana = true, colocon } = {}) {
    const d = this.d, E = this.E;
    if (!clave) return null;
    if (colocon !== undefined) E.colocon = colocon;
    if (!d.MISIONES[clave]) { // sin ficha en el 2D: solo se cuenta (no pasa con ninguno de hoy)
      this.sumar('partidas'); this.sumar(`jugada_${clave}`); if (gana) { this.sumar('victorias'); this.sumar(`gana_${clave}`); }
      return null;
    }
    const humo = d.enMundoHumo() ? 1.5 : 1;
    const divisor = d.MISIONES[clave].divisor || 20;
    const base = gana ? d.PAGO_ESTRELLAS[d.estrellasDe(clave, puntos)] : Math.min(10, Math.round(puntos / divisor));
    const multRep = d.multiplicadorRepeticion(clave);
    d.apuntarRepeticion(clave);
    let monchis = Math.round(base * humo * multRep * (1 + d.bonoDeco('pago') + d.bonoArmario('pago')));
    const mod = d.aplicarModPartida(clave, gana, puntos, monchis);
    monchis = mod.monchis;
    const r = d.apuntar(clave, puntos, monchis, gana);
    let lineaSituacion = '';
    if (gana && E.situaciones) {
      const id = Object.keys(E.situaciones).find(k => { const s = E.situaciones[k]; return s.paso === s.pasos.length - 1 && s.pasos[s.paso].mision === clave; });
      if (id) lineaSituacion = d.completarSituacion(id);
    }
    if (gana && clave === 'Blancazo') this.sumar('blancazos'); // escenas/blancazo.js lo apunta al salvarle
    const cobro = { clave, puntos, gana, estrellas: r.ganadas, monchis: monchis + r.subido + r.bonoEstrellas, nuevoRecord: r.nuevoRecord, subido: r.subido, nivel: r.nivel, situacion: lineaSituacion, linea: mod.linea || '' };
    this.emitir('alCobro', cobro);
    return cobro;
  }

  // Blancaso, en la plaza (escenas/barrio.js → hucha): aportar hasta llenar la hucha.
  aportar(n) {
    const E = this.E;
    const cant = Math.max(0, Math.min(n ?? E.monchis, E.monchis, this.d.META_HUCHA - E.hucha));
    E.monchis -= cant; E.hucha += cant;
    return cant;
  }

  // La tienda de 24 h (escenas/barrio.js → TIENDA y comprarTienda/comer) y la bolsita de la barra (PRECIO_BOLSITA).
  tienda() {
    const E = this.E;
    return [...this.d.TIENDA.map(p => ({ id: p.id, nombre: p.nombre, precio: p.precio, efecto: p.efecto, tengo: p.id === 'mechero' ? !!E.inv.mechero : undefined })),
      { id: 'bolsita', nombre: 'La bolsita (Palicaso, en la barra)', precio: this.d.PRECIO_BOLSITA, efecto: 'Para liar' }]
      .map(p => ({ ...p, puede: E.monchis >= p.precio && !(p.id === 'mechero' && E.inv.mechero) }));
  }
  // Devuelve { ok, efecto: { colocon } } (el director aplica el cambio de colocón a J.colocon) o { ok: false, motivo }.
  comprar(id) {
    const E = this.E;
    const p = id === 'bolsita' ? { id, precio: this.d.PRECIO_BOLSITA } : this.d.TIENDA.find(x => x.id === id);
    if (!p) return { ok: false, motivo: 'no existe' };
    if (id === 'mechero' && E.inv.mechero) return { ok: false, motivo: 'ya lo tienes' };
    if (E.monchis < p.precio) return { ok: false, motivo: 'sin monchis', faltan: p.precio - E.monchis };
    E.monchis -= p.precio;
    let efecto = {};
    if (id === 'bolsita') E.inv.bolsita++;
    else if (id === 'papel') E.inv.papel++;
    else if (id === 'mechero') E.inv.mechero = true;
    else { // comer(p)
      E.hambre = Math.max(0, E.hambre - (p.hambre || 0));
      E.vida = Math.min(100, E.vida + (p.vida || 0));
      if (p.colocon) { E.colocon = Math.max(0, E.colocon + p.colocon); efecto = { colocon: p.colocon }; }
      this.sumar('comidas');
    }
    this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'compra' });
    return { ok: true, efecto };
  }
  // Para liar hacen falta papel, boquilla, bolsita y mechero (escenas/barrio.js → sofa()). Devuelve lo que falta.
  faltaParaLiar() {
    const inv = this.E.inv;
    return ['papel', 'boquilla', 'bolsita', 'mechero'].filter(k => (k === 'mechero' ? !inv.mechero : !inv[k]));
  }
  gastarLiar() {
    const inv = this.E.inv;
    if (this.faltaParaLiar().length) return false;
    inv.papel--; inv.boquilla--; inv.bolsita--;
    if (!inv.boquilla) this.esconderBoquilla();
    this.guardar(); this.emitir('alCambiar', { tipo: 'liar' });
    return true;
  }
  // La boquilla perdida: brilla en una sala (SALAS_BOQUILLA); al entrar en ella, se coge (+2).
  esconderBoquilla() {
    const E = this.E, s = this.d.SALAS_BOQUILLA;
    E.boquillaEn = { sala: s[Math.floor(Math.random() * s.length)], x: 640, y: 600 };
  }
  // El negocio (negocio.js + escenas/barrio.js → abrirNegocio).
  negocio() {
    const d = this.d; d.actualizarNegocio();
    const n = d.negocio(), c = d.cuentasNegocio(), max = d.nivelMaxPorCapitulo(this.E.capitulo);
    return {
      caja: Math.floor(n.caja), bolsitas: Math.floor(n.bolsitas), rango: c.rango, total: c.total, porMin: c.porMin, siguiente: d.rangoSiguiente(c.total),
      mejoras: d.MEJORAS_NEGOCIO.map(m => ({ id: m.id, nombre: m.nombre, desc: m.desc, nivel: d.nivelNegocio(m.id), max, precio: d.precioMejora(m), puede: d.nivelNegocio(m.id) < max && this.E.monchis >= d.precioMejora(m) })),
    };
  }
  mejoraMasBarata() {
    const d = this.d, max = d.nivelMaxPorCapitulo(this.E.capitulo);
    return d.MEJORAS_NEGOCIO.filter(m => d.nivelNegocio(m.id) < max).map(m => ({ id: m.id, nombre: m.nombre, precio: d.precioMejora(m) })).sort((a, b) => a.precio - b.precio)[0] || null;
  }
  mejorar(id) {
    const d = this.d, E = this.E;
    const m = d.MEJORAS_NEGOCIO.find(x => x.id === (id || (this.mejoraMasBarata() || {}).id));
    if (!m) return { ok: false, motivo: 'al máximo' };
    if (d.nivelNegocio(m.id) >= d.nivelMaxPorCapitulo(E.capitulo)) return { ok: false, motivo: 'al máximo por ahora' };
    const precio = d.precioMejora(m);
    if (E.monchis < precio) return { ok: false, motivo: 'sin monchis', faltan: precio - E.monchis };
    E.monchis -= precio;
    const n = d.negocio(); n.niveles[m.id] = d.nivelNegocio(m.id) + 1;
    const metas = [];
    let cn = d.cuentasNegocio();
    while (d.METAS_NEGOCIO[n.metas] && d.METAS_NEGOCIO[n.metas].hecho(cn)) { const meta = d.METAS_NEGOCIO[n.metas]; E.monchis += meta.premio; n.metas++; metas.push(meta); cn = d.cuentasNegocio(); }
    this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'negocio' });
    return { ok: true, mejora: m.id, nivel: d.nivelNegocio(m.id), metas };
  }
  cobrarCaja() {
    const d = this.d, E = this.E; d.actualizarNegocio();
    const n = d.negocio(), m = Math.floor(n.caja), b = Math.floor(n.bolsitas);
    const hoy = new Date().toDateString(), bono = n.ultimoDia !== hoy && m > 0 ? 25 : 0;
    if (!m && !b) return { ok: false };
    n.caja -= m; n.bolsitas -= b; if (bono) n.ultimoDia = hoy;
    this.sumar('cobros'); E.monchis += m + bono; E.inv.bolsita += b;
    this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'caja' });
    return { ok: true, monchis: m, bolsitas: b, bono };
  }
  inventoMasBarato() { return this.d.INVENTOS.filter(i => !this.E.inventos[i.id]).sort((a, b) => a.precio - b.precio)[0] || null; }
  comprarInvento(id) {
    const E = this.E, iv = id ? this.d.INVENTOS.find(i => i.id === id) : this.inventoMasBarato();
    if (!iv || E.inventos[iv.id]) return { ok: false };
    if (E.monchis < iv.precio) return { ok: false, motivo: 'sin monchis', faltan: iv.precio - E.monchis };
    E.monchis -= iv.precio; E.inventos[iv.id] = true;
    this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'invento' });
    return { ok: true, invento: iv.id };
  }

  // Cada fotograma (escenas/barrio.js → tiempos): hambre que sube (más cuanto más colocado), vida que baja con
  // mucha hambre y se recupera con poca; con vida 0, un amarillo (desmayo). El colocón lo lleva el XR (J.colocon).
  paso(dt, { colocon } = {}) {
    const d = this.d, E = this.E;
    if (colocon !== undefined) E.colocon = colocon;
    E.hambre = Math.min(100, E.hambre + dt * (0.15 + E.colocon * 0.006) * (1 + d.bonoDeco('hambre') + d.bonoArmario('hambre')));
    if (E.hambre >= 85) E.vida -= dt * 1.8;
    else if (E.hambre < 50) E.vida = Math.min(100, E.vida + dt * 0.4);
    if (E.vida <= 0) this.desmayo();
    this.tNegocio -= dt; if (this.tNegocio <= 0) { this.tNegocio = 5; d.actualizarNegocio(); }
    this.tGuardar -= dt; if (this.tGuardar <= 0) { this.tGuardar = 10; this.guardar(); this._mirarPista(); }
  }
  // escenas/barrio.js → desmayo: vida 45, hambre 30, colocón 0 y se pierden hasta 20 monchis. Despiertas en tu cuarto.
  desmayo() {
    const E = this.E, perdidos = Math.min(20, E.monchis);
    Object.assign(E, { vida: 45, hambre: 30, colocon: 0, monchis: E.monchis - perdidos });
    this.sumar('desmayos'); this.guardar();
    this.emitir('alDesmayo', { perdidos });
  }

  // El botón de un objetivo. Lo que puede, lo hace el motor (aportar, mejorar, invento, cobrar caja, seguir); si no,
  // devuelve la acción para el director: { tipo: 'recreativa', clave } · nativo · barrio · menu · fumar · pasar · puerta.
  hacer(accion) {
    if (!accion) return null;
    const E = this.E;
    const fin = r => { this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'accion' }); return r || null; };
    switch (accion.tipo) {
      case 'hucha': {
        const falta = Math.max(0, (accion.meta ?? this.d.META_HUCHA) - E.hucha);
        if (!E.monchis) return { tipo: 'menu', motivo: 'sin monchis' };
        this.aportar(falta); return fin();
      }
      case 'mejora': { const r = this.mejorar(); return r.ok ? fin() : { tipo: 'menu', motivo: r.motivo }; }
      case 'invento': { const r = this.comprarInvento(); return r.ok ? fin() : { tipo: 'menu', motivo: r.motivo }; }
      case 'cobrar': this.cobrarCaja(); return fin();
      case 'seguir': this.saltar(); return null;
      default: return accion;
    }
  }

  // «Seguir la historia»: da por hecho el objetivo que toca si no tiene equivalente en el XR (nunca bloquea).
  saltar() {
    const E = this.E, cap = this.cap; if (!cap) return;
    if (cap.tareas) {
      const T = E.tarea; if (!T || T.cap !== cap.id || T.fase !== 'activa') return;
      T.cumplida = true; this.sumar('saltadas');
      const t = cap.tareas[T.i]; if (t.cumple) this.sumar(t.cumple); // Furgo, Control: cuenta «jugarlo»
    } else {
      const o = this.objetivos().historia; if (!o) return;
      E.saltados[o.id] = true; this.sumar('saltadas');
    }
    this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'saltar' });
  }

  // Resuelve el objetivo que toca como si el jugador lo hubiera hecho en las gafas (pruebas y página de prueba).
  simularObjetivo() {
    const o = this.objetivos().historia; if (!o) return null;
    const a = o.accion || {}, E = this.E;
    const gana = clave => this.avisar('minijuego', { clave, puntos: (this.d.MISIONES[clave]?.umbrales || [0, 1000])[1] || 1000, gana: true });
    switch (a.tipo) {
      case 'recreativa': case 'nativo': gana(a.clave); break;
      case 'hucha': E.monchis = Math.max(E.monchis, a.falta); this.hacer(a); break;
      case 'mejora': case 'invento': E.monchis += (a.precio || 0); this.hacer(a); break;
      case 'menu': gana('Pipas'); break;
      case 'puerta': this.avisar('puerta'); break;
      case 'fumar': this.avisar('liar'); this.avisar('calada', { nivel: 2 }); break;
      case 'pasar': this.avisar('pase', { a: a.a }); break;
      case 'barrio': {
        const mundo = o.mundo || a.mundo; if (mundo) this.avisar('mundo', { mundo });
        if (a.con) for (const c of [].concat(a.con)) this.avisar('hablar', { con: c });
        else { if (o.tipo === 'recado') E.monchis += 50; for (const s of a.salas || []) this.avisar('sala', { id: s }); }
        break;
      }
      case 'seguir': this.saltar(); break;
      default: this.tic();
    }
    return o;
  }

  // ---------- barrio: salas, hablar, recoger, comprar ----------
  _entrarSala(id, gente) {
    const E = this.E; if (!id) return;
    this.sumar(`sala_${id}`);
    const aqui = gente || Object.entries(CASAS).filter(([p, s]) => s === id && (E.mundoXR === 'humo' || !SOLO_HUMO.includes(p))).map(([p]) => p);
    for (const p of aqui) this._hablar(p);
    this._recoger(id);
    if (id === 'tienda') this._comprarRecado();
    if (E.boquillaEn && E.boquillaEn.sala === id) { E.boquillaEn = null; E.inv.boquilla += 2; this.emitir('alCambiar', { tipo: 'boquilla' }); }
  }
  _hablar(con) {
    const E = this.E; if (!con) return;
    const id = con === 'la-pompa' ? 'pompa' : con;
    this.sumar(`hablar_${id}`); this.sumar(`hablar_${E.mundoXR}_${id}`);
    // lo que el 2D apunta al hablar con alguien en su capítulo (escenas/barrio.js y rutinas.js)
    if (id === 'perico' && this.cap?.id === 'caja') this.sumar('pistaCaja');
    if (id === 'perico' && this.cap?.id === 'perico' && E.mundoXR === 'normal') this.sumar('secretoPerico');
    const a = this._tareaActiva(); if (!a) return;
    const { t, T } = a;
    if (t.tipo !== 'charla' && t.tipo !== 'dia') return;
    const quiere = this.d.mundoDeTarea(t);
    if (quiere && quiere !== E.mundoXR) return; // «de día» / «de noche»: lo dice el texto y la pista
    const con2 = this.d.conDeTarea(t);
    if (!con2.includes(id)) return;
    T.hablados = T.hablados || [];
    if (!T.hablados.includes(id)) T.hablados.push(id);
    if (con2.every(c => T.hablados.includes(c))) T.cumplida = true;
  }
  _recoger(sala, tipo) {
    const a = this._tareaActiva(); if (!a || a.t.tipo !== 'recoger') return;
    const T = a.T;
    T.pendientes = T.pendientes || this.d.recogerDeTarea(a.t);
    const antes = T.pendientes.length;
    T.pendientes = T.pendientes.filter(r => !((!sala || r.sala === sala) && (!tipo || r.tipo === tipo)));
    T.hechos = (T.hechos || 0) + (antes - T.pendientes.length);
  }
  // El recado de la tarea se compra en la tienda, al precio del 2D (OBJETOS_RECADO). Sin monchis, la pista lo dice.
  _comprarRecado() {
    const a = this._tareaActiva(); if (!a || a.t.tipo !== 'recado') return;
    const k = this.d.objetoDeTarea(a.t), ob = this.d.OBJETOS_RECADO[k], E = this.E;
    if (ob) {
      if (E.monchis < ob.precio) { this.emitir('alPista', { de: 'narrador', texto: `${ob.nombre}: ${ob.precio} monchis. Te faltan ${ob.precio - E.monchis}.` }); return; }
      E.monchis -= ob.precio;
    }
    a.T.objeto = k;
  }
  _tareaActiva() {
    const cap = this.cap; if (!cap || !cap.tareas) return null;
    const T = this.E.tarea; if (!T || T.cap !== cap.id || T.fase !== 'activa') return null;
    return { cap, t: cap.tareas[T.i], T };
  }

  // ---------- el avance (escenas/barrio.js → historia, tareaTick, completarCapitulo) ----------
  tic() {
    if (this._enTic) return; this._enTic = true;
    try { this._tic(); } catch (e) { console.error('[historia] tic', e); } finally { this._enTic = false; }
  }
  _tic() {
    const E = this.E;
    if (this.acabada || this.cola.length || this.enCurso) return;
    const cap = this.cap;
    if (E.cierreDe === cap.id) return this._encolarCierre(cap);
    if (E.introCapId !== cap.id) {
      const lineas = [['titulo', `Capítulo ${this.d.etiquetaCap(E.capitulo)} · ${cap.titulo}`], ...cap.intro, ...(cap.id === 'una-que' ? [] : [['objetivos', '']])];
      return this._encolar({ tipo: 'intro', cap: cap.id, arte: cap.arte, lineas }, () => this._empezarCapitulo(cap));
    }
    if (cap.tareas) this._ticTareas(cap); else this._ticObjetivos(cap);
  }
  _empezarCapitulo(cap) {
    const E = this.E;
    E.introCapId = cap.id; E.introCap = E.capitulo; // marcarIntroVista()
    E.baseCap = { ...E.stats };                        // los objetivos «de este capítulo» cuentan desde aquí
    if (cap.alEmpezar) cap.alEmpezar();                // caja: falta parte de la hucha
    // situacionesDeCapitulo(): las crea el 2D (nuevaSituacion). En el XR el paso de recoger por el barrio se salta:
    // la situación queda esperando su minijuego (el último paso), que la cumple desde donde se gane.
    for (const [pj, pl] of cap.situaciones || []) {
      const actual = E.situaciones[pj];
      if (this.stat(`sit_${pl}`) >= 1 || (actual && (actual.pl === pl || actual.aceptada))) continue;
      const s = this.d.nuevaSituacion(pj, pl); if (!s) continue;
      s.aceptada = true; s.paso = s.pasos.length - 1;
      E.situaciones[pj] = s;
    }
    E.ultimoAvance = Date.now();
    this.guardar();
    this.emitir('alEmpezarCapitulo', { cap: this.capitulo() });
  }
  _ticObjetivos(cap) {
    const E = this.E;
    const hechos = E.hechos[cap.id] = E.hechos[cap.id] || [];
    const s = { stat: k => this.stat(k), desdeCap: k => this.desdeCap(k), E };
    cap.objetivos.forEach((o, i) => {
      if (hechos.includes(i)) return;
      const k = `${cap.id}#${i}`, eq = EQUIV_OBJETIVOS[k];
      let si = false;
      try { si = !!o.hecho(); } catch (e) { console.warn('[historia] objetivo del 2D', k, e.message); }
      if (!si && eq && eq.cumple) si = !!eq.cumple(s);
      if (!si && E.saltados[k]) si = true;
      if (!si) return;
      // Una vez cumplido, se queda cumplido (en el 2D se reevalúan todos a la vez: una hucha que baja deshacía uno).
      hechos.push(i); E.ultimoAvance = Date.now();
      this.guardar();
      this.emitir('alCumplirObjetivo', { cap: this.capitulo(), objetivo: { id: k, texto: o.texto, indice: i } });
    });
    if (hechos.length >= cap.objetivos.length) this._completar(cap);
  }
  _ticTareas(cap) {
    const E = this.E;
    let T = E.tarea;
    if (!T || T.cap !== cap.id) { T = E.tarea = this.d.nuevaTarea(cap); this.guardar(); }
    if (T.i >= cap.tareas.length) return this._completar(cap);
    const t = cap.tareas[T.i];
    const opc = { mundo: t.mundoEscena, fondo: t.fondoEscena };
    if (T.fase === 'antes') {
      if (t.tipo === 'recoger') { T.pendientes = this.d.recogerDeTarea(t); T.total = T.pendientes.length; T.hechos = 0; }
      const listo = () => { T.fase = 'activa'; E.ultimoAvance = Date.now(); this.guardar(); this.emitir('alCambiar', { tipo: 'tarea' }); };
      if (t.antes && t.antes.length) return this._encolar({ tipo: 'antes', cap: cap.id, tarea: t.id, lineas: t.antes, ...opc }, listo);
      listo();
    }
    if (T.fase === 'activa') {
      if (t.tipo === 'flashback' && !t.minijuego) {
        if (t.escena && !T.lanzado) { T.lanzado = true; return this._encolar({ tipo: 'flashback', cap: cap.id, tarea: t.id, lineas: t.escena, ...opc }, () => { T.cumplida = true; }); }
        T.cumplida = true;
      }
      if (!this.d.tareaCumplida(t, T)) return;
      T.fase = 'despues'; E.ultimoAvance = Date.now();
      this.guardar();
      this.emitir('alCumplirObjetivo', { cap: this.capitulo(), objetivo: { id: `${cap.id}:${t.id}`, texto: t.texto, indice: T.i } });
    }
    if (T.fase === 'despues') {
      const giro = cap.giro && cap.giroTras === T.i + 1 && !T.giroVisto ? cap.giro : null;
      const siguiente = () => {
        T.i++; T.fase = 'antes'; T.base = { ...E.stats };
        T.hechos = 0; T.total = 0; T.hablados = []; T.objeto = false; T.cumplida = false; T.lanzado = false; T.pendientes = null;
        this.guardar(); this.emitir('alCambiar', { tipo: 'tarea' });
      };
      const despues = t.despues && t.despues.length ? t.despues : null;
      if (despues && giro) return this._encolar({ tipo: 'despues', cap: cap.id, tarea: t.id, lineas: despues, ...opc }, () => this._encolar({ tipo: 'giro', cap: cap.id, lineas: giro }, () => { T.giroVisto = true; siguiente(); }));
      if (despues || giro) return this._encolar({ tipo: despues ? 'despues' : 'giro', cap: cap.id, tarea: t.id, lineas: despues || giro, ...opc }, () => { if (giro) T.giroVisto = true; siguiente(); });
      siguiente(); this.tic();
    }
  }
  _completar(cap) { this.E.cierreDe = cap.id; this.guardar(); this._encolarCierre(cap); }
  _encolarCierre(cap) {
    const E = this.E, n = E.capitulo;
    const lineas = [['titulo', `Capítulo ${this.d.etiquetaCap(n)} completado · ${cap.titulo}`], ...(cap.cierre || [])];
    const acabar = () => {
      E.cierreDe = null; E.tarea = null;
      E.monchis += cap.premio || 0;
      E.capitulo = n + 1; // avanzarCap(); capId lo pone sincronizarCapId() al guardar
      E.ultimoAvance = Date.now();
      this.guardar();
      this.emitir('alAcabarCapitulo', { cap: { id: cap.id, titulo: cap.titulo, etiqueta: this.d.etiquetaCap(n), indice: n }, premio: cap.premio || 0, final: !!cap.final });
      this.emitir('alCambiar', { tipo: 'capitulo' });
    };
    this._encolar({ tipo: 'cierre', cap: cap.id, arte: cap.arte, lineas, momento: true, premio: cap.premio || 0, final: !!cap.final }, () => {
      if (cap.posCierre) this._encolar({ tipo: 'poscreditos', cap: cap.id, arte: cap.arte, lineas: cap.posCierre.lineas, ...cap.posCierre.opciones }, acabar);
      else acabar();
    });
  }
  _mirarPista() {
    const E = this.E, ahora = Date.now();
    if (this.cola.length || this.enCurso) return;
    if (ahora - (E.ultimoAvance || ahora) < PISTA_MS || ahora - this.ultimaPista < PISTA_MS) return;
    const p = this.pista(); if (!p) return;
    this.ultimaPista = ahora;
    this.emitir('alPista', p);
  }

  // ---------- escenas: una a la vez, cuando el director está libre ----------
  _encolar(escena, alAcabar) {
    escena.lineas = (escena.lineas || []).filter(l => Array.isArray(l) && l.length);
    escena.capitulo = this.capitulo();
    // las escenas de tarea no traen viñeta: su fondo es la sala del capítulo (FONDO_CAPITULO de escena_comic.js)
    if (!escena.arte) escena.sala = escena.fondo || this.d.FONDO_CAPITULO[escena.cap] || 'dentro';
    this.cola.push({ escena, alAcabar });
    this.emitir('alEscena', { escena });
  }
  get escenaPendiente() { return !this.enCurso && this.cola.length ? this.cola[0].escena : null; }
  // El director la toma cuando nada más ocupa la vista (criterio §3: nunca encima de otra ventana)…
  tomarEscena() {
    if (this.enCurso || !this.cola.length) return null;
    this.enCurso = this.cola.shift();
    return this.enCurso.escena;
  }
  // …y avisa al acabarla. Entonces sigue la historia.
  escenaContada() {
    const c = this.enCurso; if (!c) return;
    this.enCurso = null;
    try { c.alAcabar && c.alAcabar(); } finally { this.guardar(); this.tic(); this.emitir('alCambiar', { tipo: 'escena' }); }
  }

  // ---------- oyentes ----------
  on(nombre, fn) { (this.oyentes[nombre] = this.oyentes[nombre] || []).push(fn); return () => this.off(nombre, fn); }
  off(nombre, fn) { this.oyentes[nombre] = (this.oyentes[nombre] || []).filter(f => f !== fn); }
  emitir(nombre, datos) { for (const fn of this.oyentes[nombre] || []) { try { fn(datos); } catch (e) { console.error('[historia]', nombre, e); } } }
}
