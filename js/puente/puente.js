// El «puente»: cualquier minijuego del juego web original (base/, Phaser 3) jugado DENTRO de una
// escena three.js como textura, mientras se porta a RV nativa. Ver docs/puente.md.
//
//   const p = await crearPuente({ ancho: 1280, alto: 720 });
//   malla.material.map = p.textura;
//   const r = await p.jugar('Pipas');   // → { clave, puntos, gana, estrellas, ... }
//   p.tecla('Space', true); p.tecla('Space', false);
//   p.puntero(u, v, 'down');            // UV de three (origen abajo-izquierda, como intersection.uv)
//   en el bucle: p.actualizar();        // pone textura.needsUpdate cuando Phaser ha pintado
//   p.cerrar();                         // detiene el minijuego y libera lo que solo usaba él
//
// Cómo: el juego original se carga en un iframe oculto del mismo origen (sus ~400 globales no
// ensucian la página XR) y su lienzo es la fuente de la CanvasTexture. NADA de base/ se modifica:
// todo se arregla en tiempo de ejecución desde aquí.

import * as THREE from 'three';

const BASE = new URL('../../base/', import.meta.url).href;
const PHASER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js';
const FUENTES_URL = 'https://fonts.googleapis.com/css2?family=Caprasimo&display=swap';
const CLAVE_ORIGINAL = 'unake-partida';   // la partida del juego web: el puente no la toca nunca
const CLAVE_PUENTE = 'unake-xr-puente';
const SCRIPTS_FUERA = ['js/main.js', 'js/tactil.js']; // main arranca su propio Phaser.Game; tactil, mandos HTML
const ESCENAS_FUERA = ['Arranque', 'Barrio'];         // Arranque carga 60 MB y pide la edad; Barrio se sustituye
const ANCHO = 1280;
const ALTO = 720;

// Teclado sintético: code → [key, keyCode] (Phaser usa keyCode; algunos minijuegos miran e.key).
const TECLADO = {
  Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8],
  ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
  ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], ControlRight: ['Control', 17],
  AltLeft: ['Alt', 18],
};
for (let i = 0; i < 26; i++) { const l = String.fromCharCode(97 + i); TECLADO[`Key${l.toUpperCase()}`] = [l, 65 + i]; }
for (let i = 0; i < 10; i++) TECLADO[`Digit${i}`] = [String(i), 48 + i];
const ALIAS = { ' ': 'Space', Shift: 'ShiftLeft', Control: 'ControlLeft', Alt: 'AltLeft' };
function normalizarCode(code) {
  if (TECLADO[code]) return code;
  if (ALIAS[code]) return ALIAS[code];
  if (typeof code === 'string' && code.length === 1) {
    if (/[a-z]/i.test(code)) return `Key${code.toUpperCase()}`;
    if (/[0-9]/.test(code)) return `Digit${code}`;
  }
  return null;
}

// Claves que el escaneo no ve (se construyen con concatenaciones o variables): sacadas del barrido
// (herramientas/pruebas/barrido.mjs) y de leer las escenas.
const EXTRA = {
  Liar: [1, 2, 3, 4, 5, 6].flatMap(i => [`mano-n-${i}`, `mano-h-${i}`]),
  Control: ['lasslow-digno'],
};

function conPlazo(promesa, ms) { return Promise.race([promesa, new Promise(r => setTimeout(r, ms))]); }
function escaparRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Claves del catálogo que aparecen en un código fuente: literales exactos y plantillas `n-${id}-caminando`.
function clavesEnTexto(texto, catalogo) {
  const halladas = new Set();
  for (const m of texto.matchAll(/'([^'\n\\]{2,80})'|"([^"\n\\]{2,80})"/g)) {
    const s = m[1] ?? m[2];
    if (catalogo.has(s)) halladas.add(s);
  }
  for (const m of texto.matchAll(/`([^`]{2,160})`/g)) {
    const t = m[1];
    if (!t.includes('${')) { if (catalogo.has(t)) halladas.add(t); continue; }
    const partes = t.split(/\$\{[^}]*\}/);
    if (partes.join('').replace(/[^a-z]/gi, '').length < 3) continue; // `${x}` a secas casaría con todo
    const re = new RegExp(`^${partes.map(escaparRegex).join('[a-z0-9-]+')}$`);
    for (const k of catalogo.keys()) if (re.test(k)) halladas.add(k);
  }
  return halladas;
}

export async function crearPuente(opciones = {}) {
  const p = new Puente(opciones);
  await p._arrancar();
  return p;
}

class Puente {
  constructor(op) {
    this.op = {
      ancho: ANCHO, alto: ALTO,
      renderizador: 'webgl',   // 'webgl' (como el original: tintes, máscaras) o 'canvas'
      fpsMax: 60,              // pasos de Phaser por segundo como mucho (las gafas van a 72-120 Hz)
      musica: true,            // la música del propio minijuego (la del barrio no suena nunca)
      panel: true,             // enseñar el panel final original (el resultado se entrega igual, al instante)
      esperaSinPanel: 1500,    // ms que se ve el final antes de volver a la espera cuando panel: false
      liberar: true,           // al cerrar o cambiar de minijuego, se descarga lo que solo usaba el anterior
      audioContext: null,      // el de la página XR, si ya tiene uno
      contenedor: document.body,
      // dónde guarda el iframe su partida (su 'unake-partida' se redirige aquí). El motor de historia usa
      // 'unake-xr-partida' para que el ESTADO del iframe SEA la partida del XR (docs/historia.md).
      clavePartida: CLAVE_PUENTE,
      ...op,
    };
    if (this.op.ancho !== ANCHO || this.op.alto !== ALTO) {
      console.warn(`Puente: el juego original está maquetado a ${ANCHO}×${ALTO} (constantes ANCHO/ALTO); se ignora ${this.op.ancho}×${this.op.alto}.`);
    }
    this.oyentes = {};
    this.pulsadas = new Set();
    this.metricas = { arranqueMs: 0, cargas: {}, faltan: [] };
    this.faltan = new Set();
    this.cargadas = new Set();   // claves del catálogo cargadas ahora mismo
    this.comunes = new Set();    // las que se quedan siempre (comun.js, comic.js)
    this.actual = null;          // { clave, resolver, resuelto, panel, t0 }
    this._ultimoExterno = 0;
    this._deuda = 0;
    this._ultimoPaso = 0;
    this._sucio = false;
  }

  // ---------------- Eventos: 'resultado', 'salir', 'escena' ----------------
  on(evento, fn) { (this.oyentes[evento] ||= []).push(fn); return () => this.off(evento, fn); }
  off(evento, fn) { this.oyentes[evento] = (this.oyentes[evento] || []).filter(f => f !== fn); }
  _emitir(evento, dato) { (this.oyentes[evento] || []).forEach(fn => { try { fn(dato); } catch (e) { console.error(e); } }); }

  // ---------------- Arranque ----------------
  async _arrancar() {
    const t0 = performance.now();
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.setAttribute('allow', 'autoplay');
    marco.tabIndex = -1;
    // Fuera de la vista pero con su tamaño real (con display:none el ScaleManager mide 0).
    marco.style.cssText = `position:fixed;left:-20000px;top:0;width:${ANCHO}px;height:${ALTO}px;border:0;opacity:0;pointer-events:none;`;
    marco.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${BASE}">`
      + `<link href="${FUENTES_URL}" rel="stylesheet">`
      + '<style>html,body{margin:0;background:#1b1028;overflow:hidden}</style></head><body><div id="juego"></div></body></html>';
    const cargado = new Promise(r => marco.addEventListener('load', r, { once: true }));
    this.op.contenedor.appendChild(marco);
    await cargado;
    this.marco = marco;
    const win = this.win = marco.contentWindow;
    const doc = win.document;

    this._redirigirAlmacen(win);

    // Phaser, igual que el original (cdnjs 3.80.1).
    await new Promise((ok, mal) => {
      const s = doc.createElement('script');
      s.src = PHASER_URL;
      s.onload = ok;
      s.onerror = () => mal(new Error('Puente: no se pudo cargar Phaser'));
      doc.head.appendChild(s);
    });

    // Los scripts del juego, en el orden de base/index.html (salvo main.js y tactil.js).
    const indice = await (await fetch(new URL('index.html', BASE))).text();
    const rutas = [...indice.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
    const textoMain = await (await fetch(new URL('js/main.js', BASE))).text();
    const textos = await Promise.all(rutas.filter(r => !SCRIPTS_FUERA.includes(r)).map(async ruta => {
      const res = await fetch(new URL(ruta, BASE));
      if (!res.ok) throw new Error(`Puente: falta ${ruta}`);
      return { ruta, texto: await res.text() };
    }));
    this.textos = textos;

    // MOVIL sale de matchMedia('(pointer: coarse)'): en las gafas el puente va siempre con la maqueta
    // de escritorio (la textura es 1280×720 y se apunta como con ratón). Solo mientras se cargan los scripts.
    const matchMediaOriginal = win.matchMedia;
    win.matchMedia = q => (/pointer:\s*coarse/.test(q) ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} } : matchMediaOriginal.call(win, q));
    let errorScript = null;
    const alError = e => { errorScript ||= e.error || new Error(e.message); };
    win.addEventListener('error', alError);
    for (const { ruta, texto } of textos) {
      const s = doc.createElement('script');
      s.textContent = `${texto}\n//# sourceURL=${BASE}${ruta}`;
      doc.head.appendChild(s); // los scripts en línea se ejecutan al insertarlos, en orden
      if (errorScript) break;
    }
    win.removeEventListener('error', alError);
    win.matchMedia = matchMediaOriginal;
    if (errorScript) throw errorScript;

    const ev = this.ev = codigo => win.eval(codigo); // eval indirecta: ve los const/let globales del juego

    // La letra (como main.js: como mucho 3 s).
    await conPlazo(doc.fonts ? doc.fonts.load(`40px ${ev('FUENTE')}`) : Promise.resolve(), 3000);

    // Catálogo de recursos de Arranque: clave → { tipo, url }.
    // Una clave puede ser imagen y sonido a la vez ('lata'): cada una lleva su lista.
    this.catalogo = new Map();
    const alta = (k, e) => { if (!this.catalogo.has(k)) this.catalogo.set(k, []); this.catalogo.get(k).push(e); };
    ev('IMAGENES').forEach(k => alta(k, { tipo: 'imagen', url: `assets/img/${k}.jpg` }));
    ev('SPRITES').forEach(k => alta(k, { tipo: 'imagen', url: `assets/img/${k}.png` }));
    ev('SONIDOS').forEach(k => alta(k, { tipo: 'audio', url: `assets/snd/${k}.mp3` }));

    // Qué archivo define cada escena (para saber qué recursos pide) y la lista de escenas de main.js.
    this.archivoDe = {};
    for (const { ruta, texto } of textos) for (const m of texto.matchAll(/super\('(\w+)'\)/g)) this.archivoDe[m[1]] = ruta;
    const lista = (textoMain.match(/scene:\s*\[([^\]]+)\]/) || [])[1] || '';
    const nombres = lista.split(',').map(s => s.trim()).filter(Boolean);
    const clases = nombres.filter(n => !ESCENAS_FUERA.includes(n)).map(n => ev(n));
    this.escenas = new Set();
    // Clave real de cada escena (Puerta usa `constructor(clave = 'Puerta')`) → el archivo que define su clase.
    nombres.filter(n => !ESCENAS_FUERA.includes(n)).forEach((n, i) => {
      let k = null;
      try { k = new clases[i]().sys.settings.key; } catch { return; }
      this.escenas.add(k);
      const t = textos.find(x => new RegExp(`class ${n} extends`).test(x.texto));
      if (t) this.archivoDe[k] = t.ruta;
    });
    const texto = ruta => (textos.find(t => t.ruta === ruta) || {}).texto || '';
    // Lo común: lo que usan comun.js y comic.js, sin las tablas por minijuego (MISIONES, INVENTOS,
    // REACCION_PIERDE): la reacción al perder de cada uno se añade en necesarias().
    const sinTablas = t => t.replace(/const (MISIONES|INVENTOS|REACCION_PIERDE|CORTINA_DE) = [[{][\s\S]*?\n[\]}];/g, '')
      .replace(/^.*\bMIRA\b.*$/gm, ''); // hacia dónde mira cada dibujo: no es una carga
    for (const k of clavesEnTexto(sinTablas(texto('js/comun.js')) + sinTablas(texto('js/comic.js')), this.catalogo)) this.comunes.add(k);

    this._parchear(win, ev);

    // El sonido: un AudioContext de esta página (la XR lo puede reanudar al entrar en la sesión).
    this.audioContext = this.op.audioContext || new (window.AudioContext || window.webkitAudioContext)();

    const puente = this;
    const Phaser = win.Phaser;
    let listo;
    const esperaLista = new Promise(r => { listo = r; });

    // La pantalla de espera: dibuja las texturas de Arranque (sin su carga ni la edad) y se queda
    // debajo de todo; su cargador baja los recursos de cada minijuego.
    class Espera extends Phaser.Scene {
      constructor() { super({ key: 'PuenteEspera', active: true }); }
      create() {
        // Los dibujos de Arranque (pisos, objetos, viñeta…) sin su preload: se le prestan sus métodos.
        const A = ev('Arranque').prototype;
        Object.getOwnPropertyNames(A).forEach(n => { if (!['constructor', 'preload', 'create'].includes(n) && !(n in this)) this[n] = A[n]; });
        this.texturas();
        ev('texturasApuestas')(this);
        this.add.rectangle(ANCHO / 2, ALTO / 2, ANCHO, ALTO, ev('HEX').tinta);
        ev('texto')(this, ANCHO / 2, ALTO / 2 - 30, 'UNAKÉ', 96, ev('COLOR').amarillo);
        this.rotulo = ev('texto')(this, ANCHO / 2, ALTO / 2 + 70, 'Elige un minijuego', 34, ev('COLOR').crema);
        listo(this);
      }
    }
    // Sustituta de Barrio: si algún minijuego arranca 'Barrio' por su cuenta, se vuelve al puente.
    class BarrioPuente extends Phaser.Scene {
      constructor() { super('Barrio'); }
      create(datos) { puente._salir('barrio', datos); }
    }

    const game = this.game = new Phaser.Game({
      type: this.op.renderizador === 'canvas' ? Phaser.CANVAS : Phaser.WEBGL,
      parent: doc.getElementById('juego'),
      width: ANCHO,
      height: ALTO,
      backgroundColor: ev('COLOR').tinta,
      scale: { mode: Phaser.Scale.NONE },
      // preserveDrawingBuffer: three lee el lienzo cuando quiere, no justo tras pintar.
      render: { preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' },
      // Sin escuchas en window: los punteros llegan solo por puntero().
      input: { activePointers: 1, windowEvents: false, touch: false, gamepad: false },
      audio: { context: this.audioContext },
      // 32 descargas a la vez (por defecto) tumbaban el servidor local con Fumar (93 archivos).
      loader: { maxParallelDownloads: 8 },
      banner: false,
      callbacks: {
        // Phaser no lleva su propio requestAnimationFrame (en una sesión inmersiva la página no recibe
        // rAF): el bucle lo mueve actualizar() desde el de three, o un reloj de respaldo si nadie lo llama.
        postBoot: g => { g.loop.raf.start = () => {}; },
      },
      scene: [Espera, BarrioPuente, ...clases],
    });
    win.juego = game; // musica.js busca window.juego
    this._reloj = setInterval(() => {
      const ahora = performance.now();
      if (ahora - this._ultimoExterno > 100) this._quizaPaso(ahora);
    }, 1000 / 60);

    this.espera = await esperaLista;
    game.sound.pauseOnBlur = false;
    if (this.op.renderizador !== 'canvas' && game.renderer.type !== Phaser.WEBGL) console.warn('Puente: sin WebGL, Phaser dibuja en canvas 2D');

    // Lo común (bocadillos, cómic, panel final) se carga una vez.
    await this._cargar([...this.comunes]);

    this.textura = new THREE.CanvasTexture(game.canvas);
    this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.minFilter = THREE.LinearFilter;
    this.textura.generateMipmaps = false;
    this.metricas.arranqueMs = Math.round(performance.now() - t0);
  }

  // localStorage: la partida del original ('unake-partida') se redirige a la del puente (op.clavePartida). Solo esa clave,
  // y solo dentro del iframe (la página XR conserva su localStorage intacto).
  _redirigirAlmacen(win) {
    const proto = win.Storage.prototype;
    const destino = this.op.clavePartida || CLAVE_PUENTE;
    if (destino === CLAVE_ORIGINAL) throw new Error('Puente: la partida del juego web no se toca');
    const cambiar = k => (k === CLAVE_ORIGINAL ? destino : k);
    const { getItem, setItem, removeItem } = proto;
    proto.getItem = function (k) { return getItem.call(this, cambiar(k)); };
    proto.setItem = function (k, v) { return setItem.call(this, cambiar(k), v); };
    proto.removeItem = function (k) { return removeItem.call(this, cambiar(k)); };
  }

  // Envolturas en tiempo de ejecución (las funciones globales de comun.js son propiedades de window).
  _parchear(win, ev) {
    const puente = this;
    const panelFinalOriginal = win.panelFinal;
    win.panelFinal = function (scene, opciones) {
      if (!scene.sys || !scene.sys.isActive()) return;
      const mostrar = puente._final(scene, opciones);
      if (mostrar) return panelFinalOriginal.call(this, scene, opciones);
      scene.panelAbierto = true;
      const partida = puente.actual;
      setTimeout(() => { if (puente.actual === partida) puente._salir('final'); }, puente.op.esperaSinPanel);
    };
    const irAOriginal = win.irA;
    win.irA = function (scene, clave, datos) {
      // «Al barrio (Esc)» del panel, o cualquier salida al barrio: vuelta al puente sin cortinilla.
      if (clave === 'Barrio' || !puente.escenas.has(clave)) return puente._salir('barrio', datos);
      return irAOriginal.call(this, scene, clave, datos);
    };
    // Música: solo la del minijuego (la del barrio nunca, porque Barrio no se ejecuta); o ninguna.
    const Musica = ev('Musica');
    const ponerOriginal = Musica.poner.bind(Musica);
    Musica.poner = (scene, hueco) => (puente.op.musica && puente.actual ? ponerOriginal(scene, hueco) : Musica.parar());
    // Avisar de texturas del catálogo que una escena pide sin estar cargadas (se ven como un cuadro verde).
    const TM = win.Phaser.Textures.TextureManager.prototype;
    const getOriginal = TM.get;
    TM.get = function (clave) {
      if (typeof clave === 'string' && !this.list[clave] && puente.catalogo.has(clave) && !puente.faltan.has(clave)) {
        // Clave construida en tiempo de ejecución que el escaneo no vio: se apunta (para EXTRA) y se baja
        // ya, para que la siguiente vez que se pida esté (esta vez se ve el cuadro de «falta»).
        puente.faltan.add(clave);
        puente.metricas.faltan.push({ clave, escena: puente.actual && puente.actual.clave });
        console.info(`Puente: «${puente.actual && puente.actual.clave}» pide «${clave}» sin cargar; se baja ahora`);
        setTimeout(() => puente._cargar([clave]), 0);
      }
      return getOriginal.call(this, clave);
    };
  }

  // ---------------- Bucle ----------------
  _quizaPaso(ahora) {
    const periodo = 1000 / this.op.fpsMax;
    this._deuda += Math.min(250, ahora - (this._ultimoPaso || ahora));
    this._ultimoPaso = ahora;
    if (this._deuda + 1 < periodo) return false;
    this._deuda = Math.min(this._deuda - periodo, periodo);
    if (this._deuda < 0) this._deuda = 0;
    const loop = this.game.loop;
    if (!loop.callback) return false; // aún arrancando
    loop.inFocus = true; // sin foco Phaser fija el delta a 16,6 ms
    const c0 = performance.now();
    loop.step(ahora);
    this.metricas.pasoMs = +((this.metricas.pasoMs || 0) * 0.95 + (performance.now() - c0) * 0.05).toFixed(2);
    this._sucio = true;
    return true;
  }

  // Por fotograma, desde el bucle de three (o el de XR). Devuelve true si la textura ha cambiado.
  actualizar(ahora = performance.now()) {
    if (!this.game) return false;
    this._ultimoExterno = ahora;
    this._quizaPaso(ahora);
    if (!this._sucio) return false;
    this._sucio = false;
    this.textura.needsUpdate = true;
    return true;
  }

  // ---------------- Recursos ----------------
  necesarias(clave) {
    const ruta = this.archivoDe[clave];
    const texto = (this.textos.find(t => t.ruta === ruta) || {}).texto || '';
    const set = clavesEnTexto(texto, this.catalogo);
    this.comunes.forEach(k => set.add(k));
    (EXTRA[clave] || []).forEach(k => set.add(k));
    try {
      const reaccion = this.ev('REACCION_PIERDE')[clave];
      if (reaccion && this.catalogo.has(reaccion[0])) set.add(reaccion[0]);
      const sprite = this.ev('MISIONES')[clave]?.sprite;
      if (sprite && this.catalogo.has(sprite)) set.add(sprite);
    } catch { /* sin tablas */ }
    return set;
  }

  _cargar(claves) {
    const L = this.espera.load;
    const T = this.game.textures;
    const A = this.game.cache.audio;
    const pendientes = [];
    claves.forEach(k => (this.catalogo.get(k) || []).forEach(c => {
      if (c.tipo === 'imagen' ? T.exists(k) : A.exists(k)) return;
      pendientes.push(k);
      if (c.tipo === 'imagen') L.image(k, c.url); else L.audio(k, c.url);
    }));
    claves.forEach(k => this.cargadas.add(k));
    if (!pendientes.length) return Promise.resolve(0);
    return new Promise(ok => {
      const fallo = f => console.warn(`Puente: no se pudo cargar ${f.key}`);
      L.on('loaderror', fallo);
      L.once('complete', () => { L.off('loaderror', fallo); ok(pendientes.length); });
      L.start();
    });
  }

  // Descarga lo que no es común ni necesita `quedarse` (el minijuego que va a empezar).
  _liberar(quedarse = new Set()) {
    const T = this.game.textures;
    const A = this.game.cache.audio;
    for (const k of [...this.cargadas]) {
      if (this.comunes.has(k) || quedarse.has(k)) continue;
      if (T.exists(k)) T.remove(k);
      if (A.exists(k)) { this.game.sound.removeByKey(k); A.remove(k); }
      this.cargadas.delete(k);
    }
  }

  // ---------------- Jugar ----------------
  escena() { return this.actual ? this.game.scene.getScene(this.actual.escena || this.actual.clave) : null; }
  estado() { return this.ev('ESTADO'); }

  async jugar(clave, op = {}) {
    if (!this.escenas.has(clave)) throw new Error(`Puente: no hay escena «${clave}»`);
    if (this.actual) this._salir('cambio');
    const t0 = performance.now();
    const necesarias = this.necesarias(clave);
    if (this.op.liberar) this._liberar(necesarias);
    const bajadas = await this._cargar([...necesarias]);
    this.metricas.cargas[clave] = { ms: Math.round(performance.now() - t0), archivos: bajadas, claves: necesarias.size };

    const ESTADO = this.estado();
    if (op.mundo) ESTADO.colocon = op.mundo === 'humo' ? 60 : 0; // enMundoHumo(): fondos y pagos de noche
    if (op.nivel) { ESTADO.niveles = ESTADO.niveles || {}; ESTADO.niveles[clave] = op.nivel; }
    if (op.estado) Object.assign(ESTADO, op.estado);
    ESTADO.situacionEnJuego = null; // el puente no cobra situaciones del barrio

    return new Promise(resolver => {
      this.actual = { clave, escena: clave, resolver, resuelto: false, panel: op.panel ?? this.op.panel, t0: performance.now() };
      this.espera.sys.setVisible(false);
      this.game.scene.start(clave, op.datos || {});
      this._emitir('escena', { clave });
    });
  }

  // Llamado por la envoltura de panelFinal. Devuelve si se enseña el panel original.
  _final(scene, opciones) {
    const ev = this.ev;
    const { clave, puntos = 0 } = opciones;
    const gana = opciones.gana !== false;
    let estrellas = 0;
    try { estrellas = gana ? ev('estrellasDe')(clave, puntos) : 0; } catch { /* misión sin umbrales */ }
    const r = {
      clave, puntos, gana, estrellas, titulo: opciones.titulo, linea: opciones.linea,
      escena: scene.scene.key, ms: this.actual ? Math.round(performance.now() - this.actual.t0) : 0,
    };
    this.ultimo = r;
    this._emitir('resultado', r);
    const a = this.actual;
    if (a && !a.resuelto) { a.resuelto = true; a.resolver(r); }
    // «Otra vez» del panel reutiliza la escena: se cuenta como nueva partida (sin promesa; evento 'resultado').
    if (a) { a.t0 = performance.now(); a.resuelto = true; }
    return a ? a.panel : true;
  }

  // Vuelta a la pantalla de espera: «Al barrio», Barrio arrancado a mano, cerrar() o cambio de minijuego.
  _salir(motivo, datos) {
    const a = this.actual;
    this.actual = null;
    const g = this.game;
    g.scene.getScenes(true).forEach(s => { if (s.scene.key !== 'PuenteEspera') g.scene.stop(s.scene.key); });
    try { this.ev('Musica').silencio(); } catch { /* sin música */ }
    g.sound.getAllPlaying().forEach(s => s.stop());
    this._soltarTeclas();
    this.espera.sys.setVisible(true);
    if (a && !a.resuelto) {
      a.resuelto = true;
      a.resolver({ clave: a.clave, puntos: 0, gana: false, estrellas: 0, abandonado: true, motivo });
    }
    if (a) this._emitir('salir', { clave: a.clave, motivo, datos });
  }

  cerrar() {
    this._salir('cerrar');
    if (this.op.liberar) {
      this._liberar();
      // La música decodificada pesa (≈40 MB un tema de 3-4 min en PCM): se suelta tras su fundido de 0,5 s.
      setTimeout(() => {
        if (!this.game || this.actual) return;
        this.game.cache.audio.getKeys().filter(k => k.startsWith('m-')).forEach(k => { this.game.sound.removeByKey(k); this.game.cache.audio.remove(k); });
      }, 700);
    }
  }

  destruir() {
    this.cerrar();
    clearInterval(this._reloj);
    this.game.destroy(true);
    this.textura.dispose();
    this.marco.remove();
    if (!this.op.audioContext) this.audioContext.close();
    this.game = null;
  }

  desbloquearAudio() { return this.audioContext.state === 'suspended' ? this.audioContext.resume() : Promise.resolve(); }

  // ---------------- Entrada ----------------
  // Teclado sintético en el iframe (como base/js/tactil.js): code del estándar (Space, ArrowLeft, KeyX…).
  tecla(code, abajo = true) {
    const c = normalizarCode(code);
    if (!c) return false;
    const [key, keyCode] = TECLADO[c];
    const repetida = abajo && this.pulsadas.has(c);
    if (abajo) this.pulsadas.add(c); else this.pulsadas.delete(c);
    const ev = new this.win.KeyboardEvent(abajo ? 'keydown' : 'keyup', { key, code: c, repeat: repetida, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
    Object.defineProperty(ev, 'which', { get: () => keyCode });
    this.win.dispatchEvent(ev);
    return true;
  }

  _soltarTeclas() { [...this.pulsadas].forEach(c => this.tecla(c, false)); }

  // Puntero en UV de la textura tal como las da three (intersection.uv: u a la derecha, v hacia arriba).
  puntero(u, v, tipo = 'move') {
    const g = this.game;
    if (!g || !g.input || !g.input.mousePointer) return;
    const x = Math.min(1, Math.max(0, u)) * ANCHO;
    const y = (1 - Math.min(1, Math.max(0, v))) * ALTO;
    const sm = g.scale;
    const b = sm.canvasBounds;
    const pageX = b.left + x / sm.displayScale.x;
    const pageY = b.top + y / sm.displayScale.y;
    if (tipo === 'down') this._botones = 1;
    if (tipo === 'up') this._botones = 0;
    const evento = {
      type: `mouse${tipo === 'down' ? 'down' : tipo === 'up' ? 'up' : 'move'}`,
      pageX, pageY, clientX: pageX, clientY: pageY, button: 0, buttons: this._botones || 0,
      timeStamp: performance.now(), target: g.canvas, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false,
      preventDefault() {}, stopPropagation() {},
    };
    const im = g.input;
    if (tipo === 'down') im.onMouseDown(evento);
    else if (tipo === 'up') im.onMouseUp(evento);
    else im.onMouseMove(evento);
  }

  // Memoria aproximada de lo cargado: texturas (RGBA) y sonido decodificado.
  memoria() {
    let tex = 0;
    let n = 0;
    Object.values(this.game.textures.list).forEach(t => {
      (t.source || []).forEach(s => { tex += (s.width || 0) * (s.height || 0) * 4; n++; });
    });
    let audio = 0;
    this.game.cache.audio.entries.each((_k, b) => { if (b && b.length) audio += b.length * b.numberOfChannels * 4; });
    const heap = performance.memory ? performance.memory.usedJSHeapSize : null;
    return { texturasMB: +(tex / 1048576).toFixed(1), texturas: n, audioMB: +(audio / 1048576).toFixed(1), heapMB: heap ? +(heap / 1048576).toFixed(1) : null };
  }

  descargadoMB() {
    const e = this.win.performance.getEntriesByType('resource');
    return +(e.reduce((a, r) => a + (r.encodedBodySize || r.transferSize || 0), 0) / 1048576).toFixed(1);
  }
}
