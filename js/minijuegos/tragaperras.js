// La tragaperras de Palicaso (tienda de 24 h) en VR nativo, a escala de tu habitación.
// Reglas del 2D (base/js/apuestas.js): tres rodillos con las caras del grupo; tres iguales multiplican (x5 a x30,
// Monchiman x100), dos iguales x2, un Monchiman suelto te devuelve la apuesta y Puky se la come. Fichas de
// 10, 25, 50, 100 y 250. En el 2D no hay panel final: se juega lo que quieras y te vas («Me planto»).
// Aquí: la máquina de verdad delante de ti, a tu altura; coges una ficha del estante, la METES por la ranura y
// BAJAS LA PALANCA con la mano. Los rodillos giran con inercia (más fuerte bajas, más rápido giran), frenan uno
// a uno y rebotan; si los dos primeros coinciden, el tercero se hace esperar. Premio = lluvia de monedas en la
// bandeja. Palicaso, de cartón a tu izquierda, no deja de hablar.
// Economía: los monchis de verdad vienen del juego (ctx.apostar / ctx.cobrar, ver monedero()); en la página de
// prueba hay un monedero falso de 100 que se conserva entre partidas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Jugo } from './jugo.js';

const FICHAS = [10, 25, 50, 100, 250];
const RODILLO = [
  { id: 'vuper', sprite: 'vuper', peso: 20, tres: 5 },
  { id: 'palicaso', sprite: 'palicaso', peso: 18, tres: 6 },
  { id: 'blancaso', sprite: 'blancaso', peso: 16, tres: 8 },
  { id: 'perico', sprite: 'perico', peso: 14, tres: 10 },
  { id: 'cotine', sprite: 'cotine', peso: 11, tres: 15 },
  { id: 'pompa', sprite: 'pompa', peso: 8, tres: 30 },
  { id: 'monchiman', sprite: 'monchiman', peso: 5, tres: 100 },
  { id: 'puky', sprite: 'puky', peso: 8, tres: 0 },
];
const FRASES = {
  entrar: ['¡Escucha! Esta máquina la puse yo. Paga. A veces.', 'Una tirada y lo dejas. Eso dicen todos.', 'Los monchis no se multiplican solos… o sí.'],
  gana: ['¡LO SABÍA! ¡Esta máquina te quiere!', '¡Ole! Invita a algo, ¿no?', '¡Escucha cómo suena eso!'],
  gordo: ['¡¡MONCHIMAN!! ¡¡EL GORDO!! ¡Cierra la tienda!', '¡Llamad a todo el barrio! ¡HA SALIDO EL GORDO!'],
  pierde: ['Casi. Casi es lo más bonito que hay.', 'La próxima sale. Te lo juro por la aso.', 'Bueno, para la máquina, que también tiene que comer.'],
  puky: ['Puky se lo ha comido. Todo. Hasta la palanca.', 'Ha salido Puky… mejor no preguntes dónde están tus monchis.'],
  pobre: ['Sin monchis no hay tirada. Vuelve cuando seas rico.', 'Aquí se juega con monchis, no con promesas.'],
  // las de la máquina de verdad (no existen en el 2D: fichas y palanca)
  sinFicha: ['Primero la ficha, luego la palanca. Así funciona el progreso.', 'Sin ficha la palanca no hace nada. Bueno, ejercicio.'],
  yaHay: ['Una ficha por tirada. Baja la palanca, anda.', 'Ya hay una dentro. ¡La palanca!'],
  caida: ['Esa se te ha caído. Te la recojo yo… por esta vez.', 'Las fichas, a la ranura. No al suelo.'],
  suspense: ['Uy… uy… UY.', 'Que sale, que sale…'],
};
const TINTA = '#140c1c';
const COL = { cuerpo: '#d23a6a', morado: '#3b2a52', moradoOsc: '#2a1d3d', moradoClaro: '#5a4378', amarillo: '#ffd628', rosa: '#ff5fa2', crema: '#fff3e6', rojo: '#ff4d4d', gris: '#cfc6dc', cian: '#5fd3ff', verde: '#7ee081' };
const COLOR_FICHA = ['#fff3e6', '#5fd3ff', '#7ee081', '#ff5fa2', '#ffd628'];

// geometría de la máquina (metros, local: origen en el centro de la ventana de rodillos, +Z hacia ti)
const R_ROD = 0.1, ANCHO_ROD = 0.13, X_ROD = [-0.14, 0, 0.14], Z_ROD = -0.105;
const VENT = 0.085;                       // media altura de la ventana
const RANURA = new THREE.Vector3(0.165, -0.14, 0.05);
const BOTON = { x: 0.165, y: -0.225, w: 0.10, h: 0.05 };
const PIVOTE = new THREE.Vector3(0.315, -0.02, -0.12), L_PAL = 0.22, R_BOLA = 0.034;
const TH_MAX = 1.45, TH_DISPARO = 1.0;
const R_FICHA = 0.024, G_FICHA = 0.007;
const ESTANTE = { x0: -0.245, paso: 0.052, y: -0.31 + 0.01 + G_FICHA / 2, z: 0.07 };
const BANDEJA = { y: -0.445, x: 0.13, z0: 0.01, z1: 0.115 };
const N_LLUVIA = 60;
const LUZ = new THREE.Vector3(0.35, 0.85, 0.45).normalize();

function pesoAlAzar(lista) {
  let r = Math.random() * lista.reduce((a, x) => a + x.peso, 0);
  for (const x of lista) { r -= x.peso; if (r < 0) return x; }
  return lista[lista.length - 1];
}
function pagoTragaperras(ids) {
  const [a, b, c] = ids;
  if (a === b && b === c) return { mult: RODILLO.find(x => x.id === a).tres, tipo: a === 'puky' ? 'puky' : a === 'monchiman' ? 'gordo' : 'tres' };
  if (ids.includes('puky')) return { mult: 0, tipo: 'puky' };
  if (a === b || b === c || a === c) return { mult: 2, tipo: 'dos' };
  if (ids.includes('monchiman')) return { mult: 1, tipo: 'salva' };
  return { mult: 0, tipo: 'nada' };
}
// baraja sin repetir hasta agotar (criterio: variedad con memoria)
function baraja(lista) { let mazo = []; return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); }; }

// Los monchis. En el juego: ctx.monchis = { valor, apostar(n) → bool, cobrar(n, info) } o ctx.apostar/ctx.cobrar
// (+ ctx.monchis número). En la página de prueba: un monedero falso de 100 (se conserva entre «Otra vez»).
export function monedero(ctx) {
  const m = ctx.monchis;
  if (m && typeof m === 'object' && typeof m.apostar === 'function') {
    return { real: true, get n() { return m.valor ?? m.n ?? 0; }, apostar: v => m.apostar(v) !== false, cobrar: (v, info) => m.cobrar?.(v, info) };
  }
  if (typeof ctx.apostar === 'function') {
    return { real: true, get n() { return typeof ctx.monchis === 'function' ? ctx.monchis() : (ctx.monchis ?? 0); }, apostar: v => ctx.apostar(v) !== false, cobrar: (v, info) => ctx.cobrar?.(v, info) };
  }
  const falso = (globalThis.__monederoApuestas ??= { n: 100 });
  return {
    real: false, get n() { return falso.n; }, set n(v) { falso.n = v; },
    apostar(v) { if (falso.n < v) return false; falso.n -= v; return true; },
    cobrar(v) { falso.n += v; },
  };
}

// mallas quietas → UNA geometría con color por vértice y sombreado toon horneado; y su contorno de tinta
function fundir(partes) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), o = new THREE.Vector3(), c = new THREE.Color();
  const geos = partes.map(({ geo, m, color }) => {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(m);
    if (color === null) return g;
    const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    c.set(color);
    for (let i = 0; i < n; i += 3) {
      o.fromBufferAttribute(p, i); a.fromBufferAttribute(p, i + 1).sub(o); b.fromBufferAttribute(p, i + 2).sub(o);
      const d = a.cross(b).normalize().dot(LUZ), k = d > 0.62 ? 1.1 : d > 0.15 ? 0.92 : 0.72;
      for (let j = 0; j < 3; j++) { col[(i + j) * 3] = c.r * k; col[(i + j) * 3 + 1] = c.g * k; col[(i + j) * 3 + 2] = c.b * k; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const r = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return r;
}
// una pieza: su malla de color y su casco de tinta (un poco más grande, por detrás)
function pieza(lista, geo, { pos = [0, 0, 0], rot = [0, 0, 0], color, borde = 0.005 }) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  lista.cuerpo.push({ geo, m, color });
  if (borde) {
    geo.computeBoundingBox();
    const s = geo.boundingBox.getSize(new THREE.Vector3());
    const g = geo.clone(); g.scale(s.x > 1e-4 ? (s.x + 2 * borde) / s.x : 1, s.y > 1e-4 ? (s.y + 2 * borde) / s.y : 1, s.z > 1e-4 ? (s.z + 2 * borde) / s.z : 1);
    lista.borde.push({ geo: g, m, color: null });
  }
}
const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; };
function ajustarLetra(g, texto, px, ancho, familia = 'Caprasimo, serif') {
  g.font = `${px}px ${familia}`;
  while (g.measureText(texto).width > ancho && px > 12) { px -= 2; g.font = `${px}px ${familia}`; }
  return px;
}

export default {
  clave: 'Tragaperras', titulo: 'La tragaperras de Palicaso', escala: 'sala',
  // sin ficha de misión en el 2D (no da estrellas allí): aquí las estrellas son lo que le sacas a la máquina
  umbrales: [50, 250, 1000],
  sitioTarjetas: { d: 0.36, bajo: 0.05 },
  ayudas: { gatillo: 'Coger la ficha · bajar la palanca', lateral: 'Coger la ficha · bajar la palanca', mano: { pellizco: 'Coger la ficha', puno: 'Agarrar la palanca' } },

  async crear(ctx) {
    const { fisica, agarre, ui, sonido, xr } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-tragaperras';
    const fx = new Jugo(ctx, grupo);
    const bolsa = monedero(ctx);
    const basic = o => new THREE.MeshBasicMaterial(o);
    const tiraFrase = Object.fromEntries(Object.entries(FRASES).map(([k, v]) => [k, baraja(v)]));

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const E = { fase: 'intro', credito: 0, apostado: 0, cobrado: 0, tiradas: 0, resultados: [], forzar: null };
    let reloj = 0, acabado = false, ensenadaPalanca = false, tTick = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // ---------- dónde: delante de ti, a tu altura (de pie o sentado) ----------
    const cab = xr.cabeza.clone();
    const fwd = xr.adelante.clone().setY(0); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    const der = V(-fwd.z, 0, fwd.x);
    const maq = new THREE.Group(); grupo.add(maq);
    maq.position.copy(cab).addScaledVector(fwd, 0.42); maq.position.y = cab.y - 0.15;
    maq.rotation.y = Math.atan2(-fwd.x, -fwd.z);
    grupo.updateMatrixWorld(true);
    const bajo = THREE.MathUtils.clamp(maq.position.y, 0.5, 1.6);     // el mueble llega hasta el suelo
    const suelo = maq.position.y - bajo;

    // ---------- el mueble (fundido: 2 llamadas) ----------
    const L = { cuerpo: [], borde: [] };
    const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    pieza(L, caja(0.56, 0.30 + bajo, 0.32), { pos: [0, (0.30 - bajo) / 2, -0.19], color: COL.cuerpo });
    pieza(L, caja(0.56, 0.30 - VENT, 0.03), { pos: [0, (0.30 + VENT) / 2, 0.005], color: COL.cuerpo, borde: 0 });
    pieza(L, caja(0.56, bajo - VENT, 0.03), { pos: [0, (-bajo - VENT) / 2, 0.005], color: COL.cuerpo, borde: 0 });
    for (const s of [-1, 1]) pieza(L, caja(0.08, 2 * VENT, 0.03), { pos: [s * 0.24, 0, 0.005], color: COL.cuerpo, borde: 0 });
    for (const s of [-1, 1]) pieza(L, caja(0.02, 2 * VENT, 0.012), { pos: [s * 0.07, 0, 0.0], color: COL.morado, borde: 0 });
    // marco de la ventana (tinta) y marquesina
    pieza(L, caja(0.42, 0.012, 0.012), { pos: [0, VENT + 0.004, 0.024], color: TINTA, borde: 0 });
    pieza(L, caja(0.42, 0.012, 0.012), { pos: [0, -VENT - 0.004, 0.024], color: TINTA, borde: 0 });
    for (const s of [-1, 1]) pieza(L, caja(0.012, 2 * VENT + 0.02, 0.012), { pos: [s * 0.205, 0, 0.024], color: TINTA, borde: 0 });
    pieza(L, caja(0.62, 0.17, 0.08), { pos: [0, 0.385, -0.005], color: COL.amarillo });
    pieza(L, caja(0.60, 0.02, 0.36), { pos: [0, 0.29, -0.18], color: COL.morado });
    // estante de fichas, ranura, boca y bandeja de premios
    pieza(L, caja(0.28, 0.02, 0.12), { pos: [-0.14, -0.31, 0.06], color: COL.moradoClaro });
    pieza(L, caja(0.06, 0.08, 0.015), { pos: [RANURA.x, RANURA.y, 0.025], color: COL.amarillo });
    pieza(L, caja(0.007, 0.05, 0.004), { pos: [RANURA.x, RANURA.y, 0.034], color: TINTA, borde: 0 });
    pieza(L, caja(0.13, 0.045, 0.01), { pos: [BANDEJA.x, -0.40, 0.022], color: TINTA, borde: 0 });
    pieza(L, caja(0.20, 0.012, 0.13), { pos: [BANDEJA.x, BANDEJA.y - 0.006, 0.065], color: COL.moradoOsc });
    pieza(L, caja(0.20, 0.04, 0.012), { pos: [BANDEJA.x, BANDEJA.y + 0.014, 0.126], color: COL.morado });
    for (const s of [-1, 1]) pieza(L, caja(0.012, 0.04, 0.13), { pos: [BANDEJA.x + s * 0.1, BANDEJA.y + 0.014, 0.065], color: COL.morado });
    // base de la palanca
    pieza(L, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), { pos: [0.295, PIVOTE.y, PIVOTE.z], rot: [0, 0, Math.PI / 2], color: COL.morado });
    const mueble = new THREE.Mesh(fundir(L.cuerpo), basic({ vertexColors: true }));
    const contorno = new THREE.Mesh(fundir(L.borde), basic({ color: TINTA, side: THREE.BackSide }));
    maq.add(contorno, mueble);
    L.cuerpo.forEach(p => p.geo.dispose());

    // ---------- el panel pintado (marquesina, cartel, botón y cristal): UNA malla, UN lienzo ----------
    const panel = lienzo(1024, 1024);
    {
      const zonas = [
        // [x, y, w, h del lienzo], [cx, cy, z, ancho, alto en metros]
        [[0, 0, 1024, 256], [0, 0.385, 0.037, 0.60, 0.15]],
        [[0, 256, 1024, 512], [-0.04, -0.185, 0.022, 0.30, 0.15]],
        [[0, 768, 512, 256], [BOTON.x, BOTON.y, 0.022, BOTON.w, BOTON.h]],
        [[512, 768, 512, 256], [0, 0, 0.004, 0.40, 2 * VENT]],
      ];
      const geos = zonas.map(([[x, y, w, h], [cx, cy, z, an, al]]) => {
        const g = new THREE.PlaneGeometry(an, al); g.translate(cx, cy, z);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / 1024, 1 - (y + (1 - uv.getY(i)) * h) / 1024);
        return g;
      });
      const m = new THREE.Mesh(mergeGeometries(geos), basic({ map: panel.t, transparent: true }));
      m.renderOrder = 3; maq.add(m);
    }
    let avisoPanel = '', tAviso = 0;
    function pintarPanel() {
      const { g, t } = panel;
      g.clearRect(0, 0, 1024, 1024);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      // marquesina
      g.fillStyle = COL.amarillo; g.fillRect(0, 0, 1024, 256);
      ajustarLetra(g, 'La tragaperras de Palicaso', 96, 940);
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText('La tragaperras de Palicaso', 512, 110);
      g.fillStyle = COL.rosa; g.fillText('La tragaperras de Palicaso', 512, 110);
      g.font = '44px Caprasimo, serif'; g.fillStyle = TINTA;
      g.fillText(`Tienes ${bolsa.n} monchis${E.credito ? ` · apuestas ${E.credito}` : ''}`, 512, 205);
      // cartel de abajo
      g.fillStyle = COL.moradoOsc; g.beginPath(); g.roundRect(6, 262, 1012, 500, 36); g.fill();
      g.lineWidth = 10; g.strokeStyle = COL.amarillo; g.stroke();
      const estado = tAviso > reloj ? avisoPanel
        : E.fase === 'girando' ? '¡Giran!'
          : E.fase === 'fin' ? 'Cerrado por Palicaso'
            : E.credito ? '¡Baja la palanca!' : 'Mete una ficha por la ranura';
      ajustarLetra(g, estado, 70, 960);
      g.fillStyle = E.credito && E.fase === 'libre' ? COL.amarillo : COL.crema; g.fillText(estado, 512, 340);
      g.font = '42px Caprasimo, serif'; g.textAlign = 'left';
      const tabla = [['Tres iguales', 'x5 a x30', COL.crema], ['Tres Monchiman', 'x100', COL.amarillo], ['Dos iguales', 'x2', COL.crema], ['Un Monchiman', 'recuperas', COL.cian], ['Puky', 'se lo come', COL.rosa]];
      tabla.forEach(([a, b, col], i) => {
        const y = 430 + i * 66;
        g.fillStyle = col; g.fillText(a, 60, y);
        g.textAlign = 'right'; g.fillText(b, 964, y); g.textAlign = 'left';
      });
      g.textAlign = 'center';
      // botón «Me planto»
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(10, 790, 492, 224, 50); g.fill();
      g.fillStyle = E.fase === 'girando' ? '#8a7f99' : COL.rosa; g.beginPath(); g.roundRect(22, 780, 468, 210, 44); g.fill();
      g.lineWidth = 10; g.strokeStyle = TINTA; g.stroke();
      g.font = '92px Caprasimo, serif'; g.fillStyle = COL.crema; g.lineWidth = 14; g.strokeText('Me planto', 256, 880); g.fillText('Me planto', 256, 880);
      // cristal: sombra arriba y abajo y la línea de premio
      const gr = g.createLinearGradient(0, 768, 0, 1024);
      gr.addColorStop(0, 'rgba(20,12,28,.8)'); gr.addColorStop(0.3, 'rgba(20,12,28,0)'); gr.addColorStop(0.7, 'rgba(20,12,28,0)'); gr.addColorStop(1, 'rgba(20,12,28,.8)');
      g.fillStyle = gr; g.fillRect(512, 768, 512, 256);
      g.fillStyle = 'rgba(255,77,77,.55)'; g.fillRect(512, 894, 22, 4); g.fillRect(1002, 894, 22, 4);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(560, 768); g.lineTo(640, 768); g.lineTo(580, 1024); g.lineTo(520, 1024); g.fill();
      t.needsUpdate = true;
    }
    const avisar = (txt, s = 2.2) => { avisoPanel = txt; tAviso = reloj + s; pintarPanel(); luego(s + 0.05, pintarPanel); };

    // ---------- bombillas de la marquesina (instanciadas: 1 llamada) ----------
    const N_LUZ = 26;
    const luces = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 10, 8), basic({ color: '#ffffff' }), N_LUZ);
    {
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < N_LUZ; i++) {
        const k = i % 13, arriba = i >= 13;
        m4.makeTranslation(-0.27 + k * 0.045, arriba ? 0.462 : 0.308, 0.037);
        luces.setMatrixAt(i, m4); luces.setColorAt(i, new THREE.Color('#ffffff'));
      }
    }
    maq.add(luces);
    let fiesta = 0; // segundos de luces locas (premio)
    const _cl = new THREE.Color();
    function pintarLuces() {
      for (let i = 0; i < N_LUZ; i++) {
        let on;
        if (fiesta > 0) on = Math.floor(reloj * 14 + i) % 3 === 0;
        else if (E.fase === 'girando') on = Math.floor(reloj * 9 + i) % 2 === 0;
        else on = Math.floor(reloj * 2.2 + i * 0.5) % 2 === 0;
        _cl.set(on ? (i % 2 ? COL.amarillo : '#ffffff') : '#7a5a2a');
        if (fiesta > 0 && on) _cl.set(i % 3 ? COL.rosa : COL.amarillo);
        luces.setColorAt(i, _cl);
      }
      luces.instanceColor.needsUpdate = true;
    }

    // ---------- los rodillos: una tira con las 8 caras alrededor de un cilindro (3 llamadas) ----------
    const tira = lienzo(256, 2048);
    {
      const { g } = tira;
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 2048);
      const imgs = await Promise.all(RODILLO.map(s => ctx.img(`${s.sprite}.png`).then(t => t.image).catch(() => null)));
      RODILLO.forEach((s, k) => {
        const y0 = 2048 - (k + 1) * 256; // celda k: v en [k/8, (k+1)/8]
        g.fillStyle = k % 2 ? '#fff6e8' : '#ffffff'; g.fillRect(0, y0, 256, 256);
        g.fillStyle = 'rgba(20,12,28,.18)'; g.fillRect(0, y0, 256, 4);
        const im = imgs[k];
        if (im) {
          const e = Math.min(210 / im.height, 210 / im.width), w = im.width * e, h = im.height * e;
          g.drawImage(im, 128 - w / 2, y0 + 128 - h / 2, w, h);
        } else { g.fillStyle = TINTA; g.font = '40px Caprasimo, serif'; g.textAlign = 'center'; g.fillText(s.id, 128, y0 + 128); }
      });
      tira.t.anisotropy = 4;
    }
    function geoRodillo() {
      const N = 48, pos = [], uv = [], idx = [];
      for (let j = 0; j <= N; j++) {
        const a = -Math.PI / 8 + (2 * Math.PI * j) / N, y = R_ROD * Math.sin(a), z = R_ROD * Math.cos(a);
        pos.push(-ANCHO_ROD / 2, y, z, ANCHO_ROD / 2, y, z); uv.push(0, j / N, 1, j / N);
      }
      for (let j = 0; j < N; j++) { const a0 = j * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3; idx.push(a0, a1, b1, a0, b1, b0); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      return g;
    }
    const matRod = basic({ map: tira.t });
    const geoRod = geoRodillo();
    const PASO = Math.PI / 4;
    const rodillos = X_ROD.map((x, i) => {
      const mesh = new THREE.Mesh(geoRod, matRod); mesh.position.set(x, 0, Z_ROD); maq.add(mesh);
      const k = Math.floor(Math.random() * RODILLO.length);
      const r = { mesh, i, rho: k * PASO, w: 0, fase: 'quieto', k, t: 0 };
      mesh.rotation.x = r.rho;
      return r;
    });

    // ---------- la palanca (se mueve: 2 llamadas) ----------
    const palanca = new THREE.Group(); palanca.position.copy(PIVOTE); maq.add(palanca);
    let matBola;
    {
      const P = { cuerpo: [], borde: [] };
      pieza(P, new THREE.CylinderGeometry(0.011, 0.011, L_PAL, 12), { pos: [0, L_PAL / 2, 0], color: COL.gris, borde: 0.004 });
      pieza(P, new THREE.SphereGeometry(R_BOLA, 18, 14), { pos: [0, L_PAL, 0], color: COL.rojo, borde: 0.005 });
      matBola = basic({ vertexColors: true, color: '#ffffff' });
      palanca.add(new THREE.Mesh(fundir(P.borde), basic({ color: TINTA, side: THREE.BackSide })), new THREE.Mesh(fundir(P.cuerpo), matBola));
    }
    const PAL = { th: 0, v: 0, mano: null, disparada: false, vMano: 0, thAntes: 0 };
    const bolaLocal = th => V(PIVOTE.x, PIVOTE.y + Math.cos(th) * L_PAL, PIVOTE.z + Math.sin(th) * L_PAL);
    const bolaMundo = th => maq.localToWorld(bolaLocal(th ?? PAL.th));

    // ---------- fichas del estante (una por valor; cogibles) ----------
    const fichaTex = lienzo(768, 128);
    {
      const { g } = fichaTex;
      FICHAS.forEach((v, i) => {
        const x = i * 128 + 64;
        g.fillStyle = TINTA; g.beginPath(); g.arc(x, 64, 64, 0, Math.PI * 2); g.fill();
        g.fillStyle = COL.amarillo; g.beginPath(); g.arc(x, 64, 58, 0, Math.PI * 2); g.fill();
        g.fillStyle = COLOR_FICHA[i]; g.beginPath(); g.arc(x, 64, 44, 0, Math.PI * 2); g.fill();
        g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'middle'; ajustarLetra(g, `${v}`, 52, 76);
        g.fillStyle = TINTA; g.fillText(`${v}`, x, 66);
      });
      g.fillStyle = '#c9a019'; g.fillRect(640, 0, 128, 128);
    }
    const matFicha = basic({ map: fichaTex.t });
    function geoFicha(i) {
      const g = new THREE.CylinderGeometry(R_FICHA, R_FICHA, G_FICHA, 28).toNonIndexed();
      const uv = g.attributes.uv;
      for (const gr of g.groups) for (let j = gr.start; j < gr.start + gr.count; j++) {
        if (gr.materialIndex === 0) uv.setXY(j, 5.5 / 6, 0.5);
        else uv.setXY(j, (i + uv.getX(j)) / 6, uv.getY(j));
      }
      g.clearGroups();
      return g;
    }
    const sitioFicha = i => maq.localToWorld(V(ESTANTE.x0 + i * ESTANTE.paso, ESTANTE.y, ESTANTE.z));
    const fichas = FICHAS.map((valor, i) => {
      const m = new THREE.Mesh(geoFicha(i), matFicha); grupo.add(m);
      m.position.copy(sitioFicha(i)); m.quaternion.copy(maq.quaternion);
      const c = fisica.anadir(m, { radio: R_FICHA, rebote: 0.35, roce: 0.8, masa: 0.3, datos: { ficha: valor } });
      c.dormido = true;
      return { i, valor, m, c, estado: 'estante', t: 0, desde: V(), q0: new THREE.Quaternion() };
    });
    const ranuraMundo = () => maq.localToWorld(RANURA.clone());
    function aEstante(f, conPop = true) {
      f.estado = conPop ? 'vuelve' : 'estante'; f.t = 0;
      f.c.cogible = !conPop; f.c.dormido = true; f.c.vel.set(0, 0, 0);
      f.m.position.copy(sitioFicha(f.i)); f.m.quaternion.copy(maq.quaternion);
      f.m.visible = true; f.m.scale.setScalar(conPop ? 0.01 : 1);
    }

    // ---------- Palicaso, a tu izquierda ----------
    const palicaso = await ctx.Recortable.crear('palicaso', 'humo');
    palicaso.grupo.position.copy(cab).addScaledVector(fwd, 0.72).addScaledVector(der, -0.78); palicaso.grupo.position.y = suelo;
    grupo.add(palicaso.grupo);
    let vozLibre = 0;
    const decir = (t, { pose = null, prob = 1, fuerza = false } = {}) => {
      if (pose) palicaso.pose(pose);
      if (!t || Math.random() > prob || (!fuerza && reloj < vozLibre)) return;
      vozLibre = reloj + 1.4; palicaso.decir(t);
    };

    // ---------- textos que saltan y lluvia de monedas ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.4) {
      const { g, t } = lienzo(512, 160);
      ajustarLetra(g, texto, 78, 470);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.lineJoin = 'round'; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), basic({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0 });
    }
    const lluvia = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 14), basic({ color: COL.amarillo }), N_LLUVIA);
    lluvia.count = 0; lluvia.frustumCulled = false; maq.add(lluvia);
    const monedas = [];
    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1);
    function soltarMonedas(n, gordo = false) {
      for (let i = 0; i < n; i++) {
        const desdeArriba = gordo && i % 2;
        monedas.push({
          p: desdeArriba ? V((Math.random() - 0.5) * 0.5, 0.5, 0.06) : V(BANDEJA.x + (Math.random() - 0.5) * 0.08, -0.40, 0.03),
          v: desdeArriba ? V((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, 0.3 + Math.random() * 0.5) : V((Math.random() - 0.5) * 0.25, Math.random() * 0.15, 0.25 + Math.random() * 0.35),
          r: V(Math.random() * 6, Math.random() * 6, 0), w: V((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0),
          t: -i * (gordo ? 0.03 : 0.06), quieta: false, vida: 7 + Math.random(),
        });
      }
      while (monedas.length > N_LLUVIA) monedas.shift();
    }
    function moverMonedas(dt) {
      let n = 0;
      for (let k = monedas.length - 1; k >= 0; k--) {
        const c = monedas[k]; c.t += dt;
        if (c.t < 0) continue;
        if (c.t > c.vida || c.p.y < -bajo - 0.2) { monedas.splice(k, 1); continue; }
        if (!c.quieta) {
          c.v.y -= 9.8 * dt; c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt);
          const enBandeja = Math.abs(c.p.x - BANDEJA.x) < 0.09 && c.p.z > BANDEJA.z0 && c.p.z < BANDEJA.z1;
          if (enBandeja && c.p.y < BANDEJA.y + 0.002 && c.v.y < 0) {
            c.p.y = BANDEJA.y + 0.002 + Math.random() * 0.006;
            if (Math.abs(c.v.y) > 0.6) { c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.4; if (Math.random() < 0.25) sonido('lata', { en: maq, volumen: 0.12, tono: 1.6 + Math.random() * 0.6 }); }
            else { c.quieta = true; c.r.set((Math.random() - 0.5) * 0.3, Math.random() * 6, 0); }
          }
          if (c.p.z > BANDEJA.z1 && c.p.z < BANDEJA.z1 + 0.02 && Math.abs(c.p.x - BANDEJA.x) < 0.1 && c.p.y < BANDEJA.y + 0.03) c.v.z *= -0.4;
        }
        const desv = Math.min(1, (c.vida - c.t) / 0.5);
        _s.setScalar(Math.max(0.001, desv));
        _m4.compose(c.p, _q.setFromEuler(_e.set(c.r.x, c.r.y, c.r.z)), _s);
        lluvia.setMatrixAt(n++, _m4);
      }
      lluvia.count = n; lluvia.instanceMatrix.needsUpdate = true;
    }

    // ---------- sucesos de la partida ----------
    function meterFicha(f) {
      const valor = f.valor;
      if (E.fase === 'fin' || acabado) return aEstante(f);
      if (E.fase === 'girando' || E.credito) { decir(tiraFrase.yaHay(), { fuerza: true }); sonido('bonk', { en: maq, volumen: 0.4 }); avisar('Ya hay una ficha dentro'); return aEstante(f); }
      if (bolsa.n < valor) {
        decir(tiraFrase.pobre(), { pose: 'contando', fuerza: true }); sonido('bonk', { en: maq, volumen: 0.4 });
        avisar(bolsa.n < FICHAS[0] ? 'Sin monchis no hay tirada' : `Te faltan ${valor - bolsa.n} monchis`);
        return aEstante(f);
      }
      if (!bolsa.apostar(valor)) { decir(tiraFrase.pobre(), { fuerza: true }); return aEstante(f); }
      E.credito = valor; E.apostado += valor;
      f.estado = 'entrando'; f.t = 0; f.c.cogible = false; f.c.dormido = true; f.c.vel.set(0, 0, 0);
      f.desde.copy(f.m.position); f.q0.copy(f.m.quaternion);
      sonido('lata', { en: maq, volumen: 0.45, tono: 1.4 });
      luego(0.35, () => sonido('campanita', { en: maq, volumen: 0.35 }));
      pintarPanel();
      ui.instruccion(null);
      if (!ensenadaPalanca) {
        ensenadaPalanca = true;
        luego(0.5, () => {
          if (E.credito && E.fase === 'libre') {
            ui.instruccion('Ahora baja la palanca');
            const pasos = [0, 0, 0.5, 1.0, 1.4].map((th, i) => ({ p: bolaMundo(th), puno: i > 0 }));
            fx.demo(pasos, { dur: 2.6, tramo: 0.45 });
          }
        });
      }
    }
    function tirar(fuerza) {
      E.fase = 'girando'; E.tiradas++;
      const apuesta = E.credito; E.credito = 0;
      const caras = E.forzar ? E.forzar.map(id => RODILLO.find(r => r.id === id)) : rodillos.map(() => pesoAlAzar(RODILLO));
      E.forzar = null;
      const suspense = caras[0].id === caras[1].id;
      const w0 = 13 + 12 * THREE.MathUtils.clamp(fuerza / 7, 0, 1);
      rodillos.forEach((r, i) => {
        r.fase = 'gira'; r.w = w0 * (1 + i * 0.06); r.objetivo = RODILLO.indexOf(caras[i]);
        r.tPara = 0.95 + i * 0.5 + (i === 2 && suspense ? 1.0 : 0); r.t = 0;
      });
      if (suspense) luego(1.6, () => { decir(tiraFrase.suspense(), { pose: 'sorprendido', fuerza: true }); sonido('latido', { en: maq, volumen: 0.5 }); temblor = 1.0; });
      sonido('zas', { en: maq, volumen: 0.5 });
      E.tirada = { apuesta, ids: caras.map(s => s.id), resuelta: false };
      pintarPanel(); ui.instruccion(null);
      palicaso.pose('emocionado');
    }
    let temblor = 0;
    function resultado(silencio = false) {
      const tr = E.tirada; if (!tr || tr.resuelta) return;
      tr.resuelta = true;
      const { mult, tipo } = pagoTragaperras(tr.ids);
      const cobro = Math.round(tr.apuesta * mult);
      bolsa.cobrar(cobro, { juego: 'tragaperras', apostado: tr.apuesta, tipo, ids: tr.ids });
      E.cobrado += cobro;
      E.resultados.push({ apuesta: tr.apuesta, ids: tr.ids, tipo, cobro });
      if (silencio) { E.fase = 'libre'; return; }
      const sobre = maq.localToWorld(V(0, 0.16, 0.07));
      const mano = PAL.mano || xr.manos.derecha;
      if (cobro > tr.apuesta) {
        const gordo = tipo === 'gordo';
        saltaTexto(gordo ? `¡¡EL GORDO!! +${cobro}` : `+${cobro} monchis`, COL.amarillo, sobre, gordo ? 0.5 : 0.36);
        soltarMonedas(gordo ? N_LLUVIA : Math.min(40, Math.max(6, mult * 3)), gordo);
        fiesta = gordo ? 5 : mult >= 5 ? 3 : 1.5;
        sonido(tipo === 'tres' || gordo ? 'platillo' : 'pop', { en: maq, volumen: 0.6 });
        if (gordo) luego(0.4, () => sonido('oooh', { volumen: 0.6 }));
        fx.acierto(maq.localToWorld(V(0, 0, 0.05)), { mano, color: COL.amarillo, n: gordo ? 40 : 20, fuerte: mult >= 5, sonido: 'campanita' });
        xr.manos.izquierda?.vibrar?.(0.5, 80);
        temblor = gordo ? 0.8 : mult >= 5 ? 0.4 : 0.15;
        decir(gordo ? tiraFrase.gordo() : tiraFrase.gana(), { pose: gordo ? 'emocionado' : 'riendo', fuerza: true });
      } else if (cobro === tr.apuesta) {
        saltaTexto('Monchiman te salva: recuperas', COL.cian, sobre, 0.42);
        soltarMonedas(Math.max(3, Math.round(tr.apuesta / 10)));
        sonido('campanita', { en: maq, volumen: 0.45 });
        decir('Monchiman no deja a nadie tirado. Ni en la máquina.', { pose: 'hablando', fuerza: true });
      } else if (tipo === 'puky') {
        saltaTexto(`Puky se come ${tr.apuesta}`, COL.rosa, sobre, 0.38);
        sonido('blurp', { en: maq, volumen: 0.6 });
        luego(0.3, () => sonido('eructo', { en: maq, volumen: 0.35 }));
        charco();
        fx.fallo(maq.localToWorld(V(0, 0, 0.05)), { mano });
        decir(tiraFrase.puky(), { pose: 'asco', fuerza: true });
      } else {
        saltaTexto(`−${tr.apuesta}`, COL.rosa, sobre, 0.3);
        sonido('rimshot', { en: maq, volumen: 0.35 });
        fx.fallo(null, { mano });
        decir(tiraFrase.pierde(), { pose: 'contando', fuerza: true });
      }
      luego(0.9, () => {
        if (acabado) return;
        E.fase = 'libre'; pintarPanel();
        if (bolsa.n < FICHAS[0]) {
          decir(tiraFrase.pobre(), { pose: 'contando', fuerza: true });
          avisar('Sin monchis no hay tirada', 3);
          luego(3, () => final('pobre'));
        }
      });
    }
    // Puky deja su charco en el cristal (un momento)
    let charcoM = null;
    async function charco() {
      try {
        const t = await ctx.img('fx-charco-amarillo.png');
        if (acabado) return;
        if (!charcoM) { charcoM = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), basic({ map: t, transparent: true, depthWrite: false })); charcoM.renderOrder = 5; maq.add(charcoM); }
        charcoM.position.set((Math.random() - 0.5) * 0.15, 0.02, 0.03); charcoM.visible = true; charcoM.userData.t = 0; charcoM.scale.setScalar(0.01);
      } catch { /* sin charco */ }
    }

    function final(como = 'planto') {
      if (acabado) return;
      if (E.credito) { bolsa.cobrar(E.credito, { juego: 'tragaperras', devuelta: true }); E.apostado -= E.credito; E.credito = 0; }
      acabado = true; E.fase = 'fin'; ui.instruccion(null); pintarPanel();
      const neto = E.cobrado - E.apostado, gana = neto > 0;
      let linea, frase;
      if (!E.tiradas) { linea = 'Ni una tirada. Palicaso no se lo cree.'; frase = '¿Te vas sin tirar? Esta máquina no se paga sola.'; }
      else if (gana) { linea = `Le sacas ${neto} monchis a la máquina de Palicaso.`; frase = 'Vuelve mañana, que hoy la máquina está rara.'; }
      else if (neto < 0) { linea = `La máquina se queda ${-neto} monchis. Palicaso, encantado.`; frase = como === 'pobre' ? 'Sin monchis no hay tirada. Vuelve cuando seas rico.' : 'Gracias por tu aportación al barrio.'; }
      else { linea = 'Ni ganas ni pierdes. Palicaso, tampoco.'; frase = 'Empate. Eso no lo había visto nunca.'; }
      decir(frase, { pose: gana ? 'sorprendido' : 'riendo', fuerza: true });
      sonido(gana ? 'oooh' : 'rimshot', { volumen: 0.45 });
      luego(1.4, () => ctx.terminar({ puntos: Math.max(0, neto), gana, linea }));
    }

    // ---------- coger y soltar fichas ----------
    const alCogerAntes = agarre.alCoger, alSoltarAntes = agarre.alSoltar;
    agarre.alCoger = (c, mano) => {
      alCogerAntes?.(c, mano);
      const f = fichas.find(x => x.c === c); if (!f) return;
      f.estado = 'mano'; sonido('pop', { volumen: 0.25, tono: 1.5 });
    };
    agarre.alSoltar = (c, mano) => {
      alSoltarAntes?.(c, mano);
      const f = fichas.find(x => x.c === c); if (!f || f.estado !== 'mano') return;
      if (f.m.position.distanceTo(ranuraMundo()) < 0.075) return meterFicha(f);
      f.estado = 'suelta'; f.t = 0;
    };

    // ---------- botón «Me planto» ----------
    const tocando = new Map();
    function mirarBoton() {
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!m?.activa) { tocando.delete(m); continue; }
        const p = maq.worldToLocal(m.punta.clone());
        const dentro = Math.abs(p.x - BOTON.x) < BOTON.w / 2 + 0.01 && Math.abs(p.y - BOTON.y) < BOTON.h / 2 + 0.01 && p.z > -0.01 && p.z < 0.045;
        if (dentro && !tocando.get(m) && !agarre.lleva(m)) {
          if (E.fase === 'libre') { m.vibrar?.(0.6, 50); sonido('pop', { en: maq, volumen: 0.5 }); final('planto'); }
          else if (E.fase === 'girando') { m.vibrar?.(0.2, 20); avisar('Espera a que paren'); }
        }
        tocando.set(m, dentro);
      }
    }

    // ---------- la palanca con la mano ----------
    function moverPalanca(dt) {
      PAL.thAntes = PAL.th;
      if (PAL.mano && (!PAL.mano.activa || PAL.mano.punta.distanceTo(bolaMundo()) > 0.15 || agarre.lleva(PAL.mano))) PAL.mano = null;
      if (!PAL.mano) {
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
          if (m?.activa && !agarre.lleva(m) && m.punta.distanceTo(bolaMundo()) < 0.085) { PAL.mano = m; m.vibrar?.(0.3, 25); sonido('golpe', { en: maq, volumen: 0.15, tono: 1.6 }); break; }
        }
      }
      if (PAL.mano && E.fase !== 'fin') {
        const p = maq.worldToLocal(PAL.mano.punta.clone()).sub(PIVOTE);
        const th = THREE.MathUtils.clamp(Math.atan2(p.z, p.y), 0, TH_MAX);
        PAL.th = THREE.MathUtils.lerp(PAL.th, th, Math.min(1, dt * 30)); PAL.v = 0;
        if (Math.abs(PAL.th - PAL.thAntes) > 0.03) PAL.mano.vibrar?.(0.12 + PAL.th * 0.1, 16);
      } else {
        PAL.v += (-PAL.th * 70 - PAL.v * 6) * dt; PAL.th += PAL.v * dt;
        if (PAL.th < -0.12) { PAL.th = -0.12; PAL.v *= -0.3; }
      }
      const vel = (PAL.th - PAL.thAntes) / Math.max(dt, 1e-3);
      PAL.vMano = PAL.vMano * 0.7 + vel * 0.3;
      if (PAL.th >= TH_DISPARO && !PAL.disparada && PAL.mano) {
        PAL.disparada = true;
        PAL.mano.vibrar?.(1, 120);
        sonido('golpe', { en: maq, volumen: 0.5, tono: 0.8 });
        if (E.fase === 'libre' && E.credito) tirar(Math.max(PAL.vMano, 2));
        else if (E.fase === 'libre') {
          decir(bolsa.n < FICHAS[0] ? tiraFrase.pobre() : tiraFrase.sinFicha(), { pose: 'hablando', fuerza: true });
          avisar(bolsa.n < FICHAS[0] ? 'Sin monchis no hay tirada' : 'Primero, una ficha');
        }
      }
      if (PAL.th < 0.4) PAL.disparada = false;
      palanca.rotation.x = PAL.th;
      // la bola brilla cuando hay ficha dentro
      const brillo = E.credito && E.fase === 'libre' ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(reloj * 8)) : 1;
      matBola.color.setScalar(brillo);
    }

    function moverRodillos(dt) {
      let algunoGira = false;
      for (const r of rodillos) {
        if (r.fase === 'quieto') continue;
        algunoGira = true; r.t += dt;
        if (r.fase === 'gira') {
          r.rho += r.w * dt;
          if (r.i === 2 && temblor > 0) r.mesh.position.x = X_ROD[2] + Math.sin(reloj * 60) * 0.002;
          if (r.t >= r.tPara) {
            const k = r.objetivo, base = r.rho + r.w * 0.3;
            const m = Math.ceil((base - k * PASO) / (2 * Math.PI));
            r.rho0 = r.rho; r.rhoT = k * PASO + 2 * Math.PI * m; r.w0 = r.w;
            r.Tb = 2 * (r.rhoT - r.rho0) / r.w0; r.fase = 'frena'; r.t = 0;
          }
        } else if (r.fase === 'frena') {
          const t = Math.min(r.t, r.Tb), a = r.w0 / r.Tb;
          r.rho = r.rho0 + r.w0 * t - 0.5 * a * t * t; r.w = r.w0 - a * t;
          if (r.t >= r.Tb) {
            r.rho = r.rhoT; r.fase = 'rebote'; r.t = 0; r.k = r.objetivo; r.mesh.position.x = X_ROD[r.i];
            sonido('rimshot', { en: r.mesh, volumen: 0.25, tono: 1 + r.i * 0.08 });
            (PAL.mano || xr.manos.derecha)?.vibrar?.(0.45, 40);
            fx.chispas(maq.localToWorld(V(X_ROD[r.i], 0, 0.02)), COL.crema, 6, 0.5);
            if (r.i === 2) resultado();
          }
        } else if (r.fase === 'rebote') {
          if (r.t > 0.6) { r.fase = 'quieto'; r.mesh.rotation.x = r.rhoT; continue; }
        }
        const rebote = r.fase === 'rebote' ? -0.16 * Math.sin(r.t * 26) * Math.exp(-r.t * 8) : 0;
        r.mesh.rotation.x = r.rho + rebote;
      }
      // tic-tic de los rodillos al pasar las caras
      if (algunoGira && E.fase === 'girando') {
        tTick -= dt;
        if (tTick <= 0) { tTick = 0.09; sonido('pop', { en: maq, volumen: 0.07, tono: 1.8 + Math.random() * 0.3 }); }
      }
    }

    function moverFichas(dt) {
      const ranura = ranuraMundo();
      for (const f of fichas) {
        f.t += dt;
        if (f.estado === 'estante') {
          f.m.position.copy(sitioFicha(f.i)); f.m.quaternion.copy(maq.quaternion); f.c.vel.set(0, 0, 0); f.c.dormido = true;
          // se pide la ficha que no puedes pagar: más apagada
          f.m.scale.setScalar(bolsa.n >= f.valor ? 1 : 0.85);
        } else if (f.estado === 'mano') {
          if (!f.c.cogido) { f.estado = 'suelta'; f.t = 0; continue; }
          // la ranura «chupa» la ficha si la acercas (con manos tiembla: tolerancia)
          if (f.m.position.distanceTo(ranura) < 0.045) agarre.soltar(f.c.cogido, false);
        } else if (f.estado === 'suelta') {
          if (f.t > 1.3 || f.m.position.y < suelo + 0.05 || f.c.dormido && f.t > 0.4) {
            if (f.t > 0.2) decir(tiraFrase.caida(), { prob: 0.5 });
            aEstante(f);
          }
        } else if (f.estado === 'entrando') {
          // a la boca de la ranura, de canto, y para dentro
          const k1 = Math.min(1, f.t / 0.3), k2 = THREE.MathUtils.clamp((f.t - 0.3) / 0.25, 0, 1);
          const boca = ranura.clone(), dentro = maq.localToWorld(V(RANURA.x, RANURA.y, -0.02));
          const e = k1 * k1 * (3 - 2 * k1);
          f.m.position.copy(f.desde).lerp(boca, e).lerp(dentro, k2);
          const qCanto = maq.quaternion.clone().multiply(_q.setFromEuler(_e.set(Math.PI / 2, 0, Math.PI / 2)));
          f.m.quaternion.copy(f.q0).slerp(qCanto, e);
          if (f.t > 0.58) { f.m.visible = false; if (f.t > 0.9) aEstante(f); }
        } else if (f.estado === 'vuelve') {
          const k = Math.min(1, f.t / 0.3);
          f.m.position.copy(sitioFicha(f.i)); f.m.quaternion.copy(maq.quaternion); f.m.visible = true;
          f.m.scale.setScalar(Math.max(0.01, 1 + Math.sin(k * Math.PI) * 0.25) * (k < 1 ? k : 1));
          if (k >= 1) { f.estado = 'estante'; f.c.cogible = true; }
        }
      }
    }

    // ---------- arranque ----------
    pintarPanel();
    ctx.musica?.('apuestas');
    ctx.sonido?.('neon', { en: maq, volumen: 0.3 });
    luego(0.5, () => {
      if (bolsa.n < FICHAS[0]) {
        E.fase = 'libre';
        decir(tiraFrase.pobre(), { pose: 'contando', fuerza: true }); avisar('Sin monchis no hay tirada', 3);
        luego(3.2, () => final('pobre'));
        return;
      }
      E.fase = 'libre';
      decir(tiraFrase.entrar(), { pose: 'hablando', fuerza: true });
      ui.instruccion('Coge una ficha y métela por la ranura');
      // la mano fantasma: pellizca la ficha de 25, la lleva a la ranura y la suelta
      const p0 = sitioFicha(1).add(V(0, 0.012, 0)), arriba = p0.clone().add(V(0, 0.08, 0)), r = ranuraMundo();
      fx.demo([{ p: p0 }, { p: p0, pinza: true }, { p: arriba, pinza: true }, { p: r, pinza: true }, { p: r }], { dur: 3, tramo: 0.5 });
    });

    const api = {
      E, bolsa, fichas, palanca: PAL,
      get fase() { return E.fase; },
      ranura: ranuraMundo, bola: th => bolaMundo(th), boton: () => maq.localToWorld(V(BOTON.x, BOTON.y, 0.03)),
      forzar: ids => { E.forzar = ids; },
      rodillosQuietos: () => rodillos.every(r => r.fase === 'quieto'),
      caras: () => rodillos.map(r => RODILLO[r.k].id),
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        palicaso.actualizar(dt, xr.cabeza);
        moverPalanca(dt);
        moverRodillos(dt);
        moverFichas(dt);
        moverMonedas(dt);
        mirarBoton();
        if (fiesta > 0) fiesta -= dt;
        pintarLuces();
        // la máquina tiembla (suspense, premio gordo)
        if (temblor > 0) { temblor -= dt; mueble.position.x = contorno.position.x = Math.sin(reloj * 70) * 0.003 * Math.min(1, temblor * 2); }
        else mueble.position.x = contorno.position.x = 0;
        if (charcoM?.visible) {
          const t = (charcoM.userData.t += dt);
          charcoM.scale.setScalar(Math.min(1, t * 6)); charcoM.position.y -= dt * 0.02;
          charcoM.material.opacity = Math.min(1, (2.2 - t) * 2);
          if (t > 2.2) charcoM.visible = false;
        }
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.035; s.m.lookAt(xr.cabeza);
          s.m.scale.setScalar(Math.min(1, s.t * 6));
          s.m.material.opacity = Math.min(1, 3 * (2.4 - s.t));
          if (s.t > 2.4) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      // salir a mitad: si los rodillos giran, la tirada se paga igual; si hay ficha sin tirar, se devuelve
      abandonar() {
        if (acabado) return;
        if (E.fase === 'girando') resultado(true);
        if (E.credito) { bolsa.cobrar(E.credito, { juego: 'tragaperras', devuelta: true }); E.apostado -= E.credito; E.credito = 0; }
        acabado = true; E.fase = 'fin'; ui.instruccion(null);
        const neto = E.cobrado - E.apostado;
        decir('¿Ya te vas? La máquina lo apunta.', { pose: 'contando', fuerza: true });
        ctx.terminar({ puntos: Math.max(0, neto), gana: false, linea: neto >= 0 ? `Te vas con ${neto} monchis de más.` : `Te vas con ${-neto} monchis de menos.` });
      },
      destruir() {
        // nada se pierde: tirada a medias se paga, ficha sin tirar se devuelve
        if (E.fase === 'girando') resultado(true);
        if (E.credito && !acabado) { bolsa.cobrar(E.credito, { juego: 'tragaperras', devuelta: true }); E.credito = 0; }
        acabado = true; tareas.length = 0;
        fx.destruir();
        agarre.alCoger = alCogerAntes; agarre.alSoltar = alSoltarAntes;
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) { const c = agarre.lleva(m); if (c && fichas.some(f => f.c === c)) agarre.soltar(m, false); }
        for (const f of fichas) fisica.quitar(f.c);
        ui.instruccion(null);
        palicaso.callar();
        for (const t of [panel.t, tira.t, fichaTex.t]) t.dispose();
        for (const g of [mueble.geometry, contorno.geometry, geoRod, lluvia.geometry, luces.geometry]) g.dispose();
      },
    };
  },
};
