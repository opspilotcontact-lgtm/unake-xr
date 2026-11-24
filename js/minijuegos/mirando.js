// Te están mirando · VR nativo, escala «mesa». Reglas de base/js/escenas/mirando.js.
//
// Un teatrillo del barrio de noche sobre tu mesa real (ctx.mesa()) o, si no hay, sobre un mostrador a la cintura.
// Vuper, en miniatura, cruza la calle él solo mientras tú estás de pie. Los ojos de El Mirón (en farolas, ventanas y
// charcos) tienen su compás: cerrado → entreabierto → abierto → entreabierto, y se ve el párpado bajar.
//   AGÁCHATE DE VERDAD   (o, sentado, inclínate; o mantén el gatillo / el puño) y Vuper se para y se agacha.
//                        Quieto no te ven los ojos pequeños. Agachado detrás de un cubo, ni el ojo grande.
//   LEVÁNTATE            y Vuper sigue andando.
// La altura se mide con xr.cabeza respecto a la de cuando empieza (que se ajusta sola si te estiras).
// Tres tramos sorteados entre cuatro tipos (baraja que no repite entre partidas), como el 2D:
//   fila (cada ojo abre tras el anterior), barrido (el ojo grande barre el suelo: escóndete tras un cubo),
//   dormidos (se despiertan si andas seguido) y lasslow (se ríe al fondo y El Mirón mira hacia allí).
// Si te ven: teoría de El Mirón y vuelves al último escondite. Tres avistamientos y se acaba.

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Jugo, fusionar } from './jugo.js';

const TINTA = '#140c1c';
const S = 0.00055;          // metros por píxel del 2D (1280 px → 0,70 m)
const EK = 1.45;            // los ojos, más grandes que en el 2D: son la señal del juego
const MIR = { suelo: 612, vel: 175, meta: 1180, metaNeon: 1010, vidas: 3, puntosTramo: 200, penal: 120, bonoSinVer: 100 };
const TIPOS = ['fila', 'barrido', 'dormidos', 'lasslow'];
let BARAJA_TIPOS = [];      // vive entre partidas: los tipos no se repiten hasta agotarlos
let BARAJA_TEORIAS = [];
let ULTIMA_TEORIA = null;
const TEORIAS = [
  'Esa farola lleva ahí demasiado tiempo. Anotado.',
  '¿Por qué caminas tan bajito? Sospechoso.',
  'Los charcos me miran. Lo sé.',
  '¿Quién te ha dicho que cruces por aquí?',
  'Monchiman vive cerca. Anotadlo.',
  'Tu sombra va un paso por delante. Anotado.',
  'Hoy hay demasiadas nubes. ¿Quién las ha puesto?',
  'Ese cubo no estaba ahí ayer.',
  'Si corres, huyes. Si paras, esperas. Anotado.',
  'No has dicho nada. Eso es lo que diría uno que sabe algo.',
  'Las ventanas parpadean. Yo lo vi primero.',
  'Un señor con mochila a estas horas. Anotado.',
  'Cuando duermo, mis ojos se turnan. Siempre hay uno de guardia.',
  'Eso lo dices tú.',
];
const PISTAS = {
  fila: 'Ojos en fila: cada uno abre tras el anterior',
  barrido: 'Un ojo grande barre el suelo: escóndete tras un cubo',
  dormidos: 'Están dormidos: si andas seguido, se despiertan',
  lasslow: 'Lasslow se ríe al fondo: aprovecha cuando miren a otro lado',
};
const FONDOS = ['bg-plaza', 'bg-parque'];
const mezclar = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const azar = (a, b) => a + Math.random() * (b - a);

// fase 0..1 del compás de un ojo → apertura (0,06 cerrado, 0,5 entreabierto, 1 abierto)
export function aperturaMirando(f) {
  if (f < 0.46) return 0.06;
  if (f < 0.60) return 0.5;
  if (f < 0.86) return 1;
  return 0.5;
}

export default {
  clave: 'Mirando', titulo: 'Te están mirando', escala: 'mesa', umbrales: [350, 800, 1050],
  ayudas: { gatillo: 'Mantén: Vuper se para', lateral: 'Mantén: Vuper se para', mano: { pellizco: 'Agáchate o pellizca: quieto', puno: 'Agáchate o puño: quieto' } },

  async crear(ctx) {
    const { THREE, ui, sonido, xr } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-mirando';
    const nivel = ctx.nivel ?? 1;
    const dif = 1 + 0.1 * Math.min(Math.max(0, nivel - 1), 8);
    const texturas = [];
    const fx = new Jugo(ctx, grupo);

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const E = {
      fase: 'intro', reloj: 0, tramo: 0, puntos: 0, vistos: 0, vidasQ: MIR.vidas, sosp: 0, gracia: 0, bloqueo: 0,
      px: 70, check: 70, escondido: false, ocultoT: 0, agach: 0, moviendo: false, cara: 1, ventana: 0, lassT: 99,
      tTramo: 0, sonT: 0, cerrando: false, pistaDicha: false, meta: MIR.meta, tipo: null, agachado: false, ref: null,
      porMano: false, cuerpo: false,
    };
    const tipos = Array.isArray(ctx.datos?.tipos) ? ctx.datos.tipos.slice(0, 3) : sortearTipos();
    const fondos = mezclar([...FONDOS]);
    let acabado = false, sucio = true, tPintar = 0, ojos = [], refugios = [], cono = null, lasslow = null, mironGrande = null, mironFin = null, neon = null;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: E.reloj + s, fn });

    function sortearTipos() {
      if (BARAJA_TIPOS.length < 3) BARAJA_TIPOS = BARAJA_TIPOS.concat(mezclar([...TIPOS]));
      const t = [];
      while (t.length < 3) {
        const i = BARAJA_TIPOS.findIndex(x => !t.includes(x));
        t.push(i >= 0 ? BARAJA_TIPOS.splice(i, 1)[0] : TIPOS.find(x => !t.includes(x)));
      }
      return t;
    }
    function teoria() {
      if (!BARAJA_TEORIAS.length) {
        BARAJA_TEORIAS = mezclar([...TEORIAS]);
        if (ULTIMA_TEORIA && BARAJA_TEORIAS[BARAJA_TEORIAS.length - 1] === ULTIMA_TEORIA) BARAJA_TEORIAS.unshift(BARAJA_TEORIAS.pop());
      }
      ULTIMA_TEORIA = BARAJA_TEORIAS.pop();
      return ULTIMA_TEORIA;
    }

    // ---------- dónde: tu mesa, o un mostrador a la cintura ----------
    const mesa = ctx.mesa();
    const cab = xr.cabeza.clone().setY(0);
    let fw = mesa ? mesa.punto.clone().setY(0).sub(cab) : xr.adelante.clone().setY(0);
    const dMesa = mesa ? fw.length() : 0;
    if (fw.lengthSq() < 1e-4) fw = xr.adelante.clone().setY(0);
    if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1);
    fw.normalize();
    const alturaMesa = mesa ? mesa.punto.y : THREE.MathUtils.clamp(xr.cabeza.y - 0.62, 0.6, 1.05);
    const dist = mesa ? THREE.MathUtils.clamp(dMesa - 0.2, 0.42, 0.55) : 0.46;
    const base = new THREE.Group(); base.name = 'teatrillo-mirando';
    base.position.copy(cab).addScaledVector(fw, dist).setY(alturaMesa);
    base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); base.updateMatrixWorld(true);
    const W = (x, y, z, out = V()) => out.set(x, y, z).applyMatrix4(base.matrixWorld);
    const Y0 = 0.02;                                   // el suelo de la calle
    const LX = px => (px - 640) * S, LY = py => Y0 + (MIR.suelo - py) * S;
    const Z = { fondo: -0.085, ventana: -0.07, ojo: -0.055, luz: -0.03, vuper: 0, cubo: 0.032, charco: 0.06 };

    // ---------- ayudantes de dibujo ----------
    const mb = o => new THREE.MeshBasicMaterial(o);
    const MAT_TINTA = mb({ color: TINTA, side: THREE.BackSide });
    function tinta(malla, e = 0.003) {
      malla.geometry.computeBoundingBox();
      const s = malla.geometry.boundingBox.getSize(V());
      const t = new THREE.Mesh(malla.geometry, MAT_TINTA);
      t.scale.set(1 + 2 * e / Math.max(s.x, 1e-3), 1 + 2 * e / Math.max(s.y, 1e-3), 1 + 2 * e / Math.max(s.z, 1e-3));
      malla.add(t);
      return malla;
    }
    const lienzo = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texturas.push(t);
      return { c, g: c.getContext('2d'), t };
    };
    const caja = (w, h, d, color, e = 0.003) => tinta(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mb({ color })), e);
    function carton(tex, alto, color = '#ffffff') {
      const a = tex?.image ? tex.image.width / tex.image.height : 0.6;
      const geo = new THREE.PlaneGeometry(alto * a, alto); geo.translate(0, alto / 2, 0);
      return new THREE.Mesh(geo, tex ? mb({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color }) : mb({ color: '#9a5b6e' }));
    }
    const imagen = n => ctx.img(n).catch(() => null);
    const nombresImg = ['vn-caminando', 'vn-sorprendido', 'vn-hablando', 'miron', 'miron-relajado', 'miron-alterado', 'miron-mira', 'n-lasslow-riendo'];
    const IMG = Object.fromEntries((await Promise.all(nombresImg.map(n => imagen(n + '.png')))).map((t, i) => [nombresImg[i], t]));
    const fondoTex = {};
    await Promise.all(['bg-plaza', 'bg-parque', 'bg-fuera-apagado'].map(async n => { fondoTex[n] = await imagen(n + '.jpg'); }));

    // ---------- el teatrillo: tabla, laterales y el dintel con el marcador ----------
    const ANCHO = 1280 * S, ALTO = MIR.suelo * S, FONDO = 0.2;
    if (!mesa) {
      const m = caja(ANCHO + 0.14, alturaMesa, FONDO + 0.12, '#a98b6a', 0.005);
      m.position.set(0, -alturaMesa / 2 - 0.001, 0.01); base.add(m);
    }
    const caseta = new THREE.Group(); base.add(caseta);
    { const t = caja(ANCHO + 0.04, Y0, FONDO, '#2a2238', 0.003); t.position.set(0, Y0 / 2, -0.01); caseta.add(t); }
    { const t = caja(ANCHO, 0.003, 0.11, '#3a3350', 0.001); t.position.set(0, Y0 + 0.0015, 0.02); caseta.add(t); } // la acera
    for (const s of [-1, 1]) { const p = caja(0.018, ALTO + 0.06, FONDO, '#4a2f5c', 0.003); p.position.set(s * (ANCHO / 2 + 0.009), Y0 + (ALTO + 0.06) / 2, -0.01); caseta.add(p); }
    const dintel = caja(ANCHO + 0.054, 0.05, 0.03, '#4a2f5c', 0.003); dintel.position.set(0, Y0 + ALTO + 0.035, -0.095); caseta.add(dintel);
    fusionar(caseta);
    // el marcador, en el dintel (de cara a ti)
    const marc = lienzo(1024, 96);
    const marcador = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, ANCHO * 96 / 1024), mb({ map: marc.t, transparent: true }));
    marcador.position.set(0, Y0 + ALTO + 0.035, -0.079); base.add(marcador);
    let pistaTxt = '', pistaT = 0;
    function ojoHud(g, x, y, w, h, a, vivo = true) {
      g.fillStyle = '#2a1a3d'; g.strokeStyle = TINTA; g.lineWidth = 4;
      g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, 7); g.fill(); g.stroke();
      if (vivo) {
        g.fillStyle = '#fff6e8'; g.beginPath(); g.ellipse(x, y, w / 2 - 4, Math.max(1, (h / 2 - 4) * a), 0, 0, 7); g.fill();
        g.fillStyle = TINTA; g.beginPath(); g.arc(x + 2, y, Math.min(8, h * 0.22) * Math.min(1, a + 0.2), 0, 7); g.fill();
      } else { g.strokeStyle = '#0e0818'; g.lineWidth = 5; g.beginPath(); g.arc(x, y - h * 0.5, w * 0.5, 1.05, 2.09); g.stroke(); }
    }
    function pintarMarcador() {
      const { g, t } = marc;
      g.clearRect(0, 0, 1024, 96);
      g.fillStyle = 'rgba(20,12,28,.92)'; g.beginPath(); g.roundRect(0, 0, 1024, 96, 20); g.fill();
      for (let i = 0; i < MIR.vidas; i++) ojoHud(g, 40 + i * 52, 48, 44, 34, 1, i < E.vidasQ);
      // sospecha con su ojo
      const f = THREE.MathUtils.clamp(E.sosp / 100, 0, 1), x0 = 250, w = 300;
      ojoHud(g, x0 - 30, 48, 40, 32, 0.25 + f * 0.75);
      g.fillStyle = '#3d3350'; g.beginPath(); g.roundRect(x0, 36, w, 24, 10); g.fill();
      if (f > 0.01) { g.fillStyle = f < 0.4 ? '#ffe066' : f < 0.75 ? '#ff9a3b' : '#e8364f'; g.beginPath(); g.roundRect(x0, 36, Math.max(16, w * f), 24, 10); g.fill(); }
      // de pie / agachado
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = '30px Caprasimo, serif';
      const ag = E.agachado;
      g.fillStyle = ag ? '#7ee081' : '#ffe066'; g.beginPath(); g.roundRect(590, 18, 200, 60, 30); g.fill();
      g.fillStyle = TINTA; g.fillText(E.fase === 'juego' ? (ag ? 'Agachado' : 'Andando') : (ag ? 'Agachado' : 'De pie'), 690, 50);
      g.fillStyle = '#fff6e8'; g.font = '40px Caprasimo, serif'; g.fillText(E.tramo ? `${E.tramo}/${tipos.length}` : '', 960, 50);
      if (pistaT > 0 && pistaTxt) { g.fillStyle = 'rgba(20,12,28,.95)'; g.fillRect(230, 0, 690, 96); g.fillStyle = '#5fb8ff'; g.font = '30px Caprasimo, serif'; g.fillText(pistaTxt, 575, 50, 670); }
      t.needsUpdate = true; sucio = false;
    }

    // ---------- el fondo de cada tramo (la foto del barrio, de noche) ----------
    const fondoMalla = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, ALTO), mb({ color: '#7a6fa8' }));
    fondoMalla.position.set(0, Y0 + ALTO / 2, Z.fondo); base.add(fondoMalla);
    function ponerFondo(clave) {
      const t = fondoTex[clave] || fondoTex['bg-fuera-apagado'];
      if (!t) return;
      if (fondoMalla.material.map !== t) {
        fondoMalla.material.map = t; fondoMalla.material.needsUpdate = true;
        // del dibujo del 2D (720 de alto) solo va del suelo (612) hacia arriba
        const uv = fondoMalla.geometry.attributes.uv, v0 = (720 - MIR.suelo) / 720;
        for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? 1 : v0);
        uv.needsUpdate = true;
      }
    }

    // ---------- Vuper ----------
    const vuper = carton(IMG['vn-caminando'], 190 * S); vuper.position.set(LX(70), Y0, Z.vuper); base.add(vuper);
    const ponerVuper = n => { const t = IMG[n] || IMG['vn-caminando']; if (t && vuper.material.map !== t) vuper.material.map = t; };

    // ---------- las luces (lo que ve cada ojo abierto): una sola malla ----------
    const MAXO = 6, SEGP = 12, VPO = 4 + SEGP + 2;
    const luzPos = new Float32Array(MAXO * VPO * 3);
    const geoLuz = new THREE.BufferGeometry();
    geoLuz.setAttribute('position', new THREE.BufferAttribute(luzPos, 3).setUsage(THREE.DynamicDrawUsage));
    { const idx = []; for (let k = 0; k < MAXO; k++) { const o = k * VPO; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); for (let s = 0; s < SEGP; s++) idx.push(o + 4, o + 5 + s, o + 6 + s); } geoLuz.setIndex(idx); }
    const luces = new THREE.Mesh(geoLuz, mb({ color: '#ffe9a8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    luces.frustumCulled = false; luces.renderOrder = 4; base.add(luces);

    // ---------- los ojos: un lienzo con todos (una celda cada uno) y UNA malla ----------
    const CEL = 128, atlas = lienzo(CEL * 8, CEL);
    const matOjos = mb({ map: atlas.t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
    let mallaOjos = null;
    function dibujarOjo(g, o, cx, cy) {
      const R = o.R, a = o.cierre, W2 = R * 2, H = R * 1.7, k = (CEL - 8) / (W2 + 16);
      g.save(); g.translate(cx, cy); g.scale(k, k);
      g.fillStyle = '#2a1a3d'; g.strokeStyle = TINTA; g.lineWidth = 6;
      g.beginPath(); g.ellipse(0, 0, (W2 + 16) / 2 - 3, (H + 16) / 2 - 3, 0, 0, 7); g.fill(); g.stroke();
      // un filo claro: de noche, sobre el fondo oscuro, el ojo cerrado también se tiene que ver
      g.strokeStyle = 'rgba(243,227,184,.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, (W2 + 16) / 2 - 7, (H + 16) / 2 - 7, 0, 0, 7); g.stroke();
      if (a > 0.14) {
        const h = H * a;
        g.fillStyle = o.vigila ? '#fff6e8' : '#f3e3b8'; g.beginPath(); g.ellipse(0, 0, W2 / 2, h / 2, 0, 0, 7); g.fill();
        if (a > 0.6) {
          g.strokeStyle = 'rgba(217,83,79,.75)'; g.lineWidth = 3; g.beginPath();
          g.moveTo(-W2 * 0.48, -h * 0.05); g.lineTo(-W2 * 0.28, h * 0.08); g.moveTo(-W2 * 0.44, h * 0.18); g.lineTo(-W2 * 0.26, h * 0.1);
          g.moveTo(W2 * 0.48, h * 0.06); g.lineTo(W2 * 0.3, -h * 0.08); g.moveTo(W2 * 0.42, -h * 0.2); g.lineTo(W2 * 0.28, -h * 0.1); g.stroke();
        }
        const pr = R * (o.vigila ? 0.3 : 0.36), px = o.mx * (W2 / 2 - pr * 1.25), py = o.my * Math.max(0, h / 2 - pr * 1.1);
        g.fillStyle = TINTA; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.28, 0, 7); g.fill();
        g.strokeStyle = TINTA; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, W2 / 2, h / 2, 0, 0, 7); g.stroke();
        g.fillStyle = 'rgba(42,26,61,.85)'; g.beginPath(); g.ellipse(0, -h / 2 + 6, W2 * 0.46, Math.max(2, (14 * (1 - a) + 6) / 2), 0, 0, 7); g.fill();
        if (o.vigila) { g.strokeStyle = '#1b1028'; g.lineWidth = 8; g.beginPath(); g.moveTo(-R * 0.95, -H * 0.62); g.lineTo(R * 0.75, -H * 0.82); g.stroke(); }
      } else {
        g.strokeStyle = '#c9b8e8'; g.lineWidth = 8; g.beginPath(); g.arc(0, -R * 0.9, R * 1.3, 1.05, 2.09); g.stroke();
        g.lineWidth = 5; g.beginPath();
        for (const kk of [-0.5, 0, 0.5]) { g.moveTo(kk * R * 1.2, R * 0.28 - Math.abs(kk) * 8); g.lineTo(kk * R * 1.5, R * 0.55); }
        g.stroke();
      }
      // dormido: la zeta
      if (o.dormido && !o.despierto && o.ruido < 0.5 && !o.forzar) {
        g.fillStyle = `rgba(95,184,255,${0.5 + 0.5 * Math.sin(E.reloj * 3 + o.x)})`; g.font = '40px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('z', R * 0.95, -R * 0.6 - Math.abs(Math.sin(E.reloj * 1.6 + o.x)) * 6);
      }
      g.restore();
    }
    function pintarOjos() {
      const g = atlas.g; g.clearRect(0, 0, atlas.c.width, CEL);
      ojos.forEach((o, i) => dibujarOjo(g, o, i * CEL + CEL / 2, CEL / 2));
      atlas.t.needsUpdate = true;
    }
    function montarMallaOjos() {
      if (mallaOjos) { tramoG.remove(mallaOjos); mallaOjos.geometry.dispose(); mallaOjos = null; }
      if (!ojos.length) return;
      const geos = ojos.map((o, i) => {
        const lado = (o.R * 2 + 16) * S * EK * (o.tipo === 'grande' ? 0.85 : 1);
        const g = new THREE.PlaneGeometry(lado, lado);
        const uv = g.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / 8);
        if (o.kind === 'charco') { g.scale(1, 0.62, 1); g.rotateX(-1.05); }
        g.translate(o.lx, o.ly, o.lz);
        return g;
      });
      mallaOjos = new THREE.Mesh(mergeGeometries(geos, false), matOjos); mallaOjos.renderOrder = 6;
      geos.forEach(g => g.dispose());
      tramoG.add(mallaOjos);
    }

    // ---------- textos y voces (una voz a la vez) ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.12, vida = 1.1) {
      const ancho = texto.length > 12 ? 1024 : 512, { g, t } = lienzo(ancho, 160);
      let px = 84; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > ancho - 40 && px > 36) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText(texto, ancho / 2, 84); g.fillStyle = color; g.fillText(texto, ancho / 2, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam * ancho / 512, tam * 160 / 512), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0, vida, sube: 0.08 });
    }
    let vozActual = null;
    function decir(texto, pos, dur = 1.7, ancho = 0.2) {
      callar();
      const { g, c, t } = lienzo(640, 200);
      g.font = '38px Caprasimo, serif';
      const palabras = texto.split(' '), lineas = []; let l = '';
      for (const p of palabras) { const n = l ? l + ' ' + p : p; if (g.measureText(n).width > 560 && l) { lineas.push(l); l = p; } else l = n; }
      lineas.push(l);
      const alto = 40 + lineas.length * 46;
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(6, 100 - alto / 2 - 4, 628, alto + 8, 30); g.fill();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(12, 100 - alto / 2 + 2, 616, alto - 4, 24); g.fill();
      g.fillStyle = TINTA; g.textAlign = 'center'; g.textBaseline = 'middle';
      lineas.slice(0, 3).forEach((s, i) => g.fillText(s, 320, 100 + (i - (lineas.length - 1) / 2) * 46));
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * c.height / c.width), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 41; m.position.copy(pos); grupo.add(m);
      vozActual = { m, t: 0, vida: dur, tex: t };
    }
    function callar() {
      if (!vozActual) return;
      grupo.remove(vozActual.m); vozActual.m.geometry.dispose(); vozActual.m.material.dispose(); vozActual.tex.dispose();
      const k = texturas.indexOf(vozActual.tex); if (k >= 0) texturas.splice(k, 1);
      vozActual = null;
    }
    // El Mirón asoma por la izquierda del teatrillo con su teoría y se va
    const retrato = carton(IMG['miron-alterado'] || IMG.miron, 0.13); retrato.position.set(-ANCHO / 2 - 0.1, Y0, 0.11); retrato.visible = false; base.add(retrato);
    let retratoT = 0, retratoDur = 0;
    function mironDice(tex, texto, dur = 2) {
      if (IMG[tex]) retrato.material.map = IMG[tex];
      retrato.visible = true; retratoT = 0; retratoDur = dur;
      decir(texto, W(-ANCHO / 2 - 0.06, Y0 + 0.2, 0.12), dur, 0.24);
    }

    // ---------- cada tramo ----------
    const tramoG = new THREE.Group(); base.add(tramoG);
    let anim = null; // el telón entre tramos: el decorado se pliega y se despliega
    function limpiarTramo() {
      for (const o of [...tramoG.children]) { tramoG.remove(o); o.traverse(m => { if (m.isMesh && m.geometry) m.geometry.dispose(); if (m.userData.fusion) { m.material.map?.dispose(); m.material.dispose(); } }); }
      mallaOjos = null; ojos = []; refugios = []; cono = null; lasslow = null; mironGrande = null; mironFin = null; neon = null;
    }
    function crearCubo(x) {
      const g = new THREE.Group(); g.position.set(LX(x), Y0, Z.cubo); tramoG.add(g);
      const cuerpo = caja(152 * S, 112 * S, 0.042, '#3f6b4e'); cuerpo.position.y = 56 * S; g.add(cuerpo);
      const tapa = caja(176 * S, 22 * S, 0.05, '#2d4d38'); tapa.position.y = 120 * S; g.add(tapa);
      for (const dx of [-20, 24]) { const r = caja(5 * S, 86 * S, 0.002, TINTA, 0.0005); r.position.set(dx * S, 56 * S, 0.0215); g.add(r); }
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), mb({ color: '#6b6b7a' })); led.position.set(62 * S, 132 * S, 0.012); led.userData.vivo = true; g.add(led);
      refugios.push({ x, led, usado: false });
    }
    function crearOjo({ x, kind, P, off, rango, dormido = false }) {
      const R = kind === 'charco' ? 40 : kind === 'ventana' ? 36 : 38;
      const y = kind === 'charco' ? MIR.suelo + 56 : kind === 'ventana' ? 206 : 292;
      const lx = LX(x);
      let ly = LY(y), lz = Z.ojo;
      const lado = (R * 2 + 16) * S * EK;
      if (kind === 'farola') {
        const poste = caja(14 * S, ly - Y0, 0.01, '#4a4658', 0.002); poste.position.set(lx, Y0 + (ly - Y0) / 2, Z.ojo - 0.01); tramoG.add(poste);
        const cabeza = caja(lado * 0.8, 0.008, 0.018, '#2a2633', 0.002); cabeza.position.set(lx, ly + lado / 2 + 0.004, Z.ojo - 0.006); tramoG.add(cabeza);
      } else if (kind === 'ventana') {
        const marco = caja(lado * 1.25, lado * 1.2, 0.006, '#15102e', 0.004); marco.position.set(lx, ly, Z.ventana); tramoG.add(marco);
        const alfeizar = caja(lado * 1.3, 0.008, 0.016, '#6a5a86', 0.002); alfeizar.position.set(lx, ly - lado * 0.62, Z.ventana + 0.006); tramoG.add(alfeizar);
      } else {
        const charco = new THREE.Mesh(new THREE.CircleGeometry(1, 24), mb({ color: '#1f2c5c' })); charco.rotation.x = -Math.PI / 2;
        charco.scale.set(R * 1.7 * S * EK, R * 0.75 * S * EK, 1); charco.position.set(lx, Y0 + 0.002, Z.charco); tramoG.add(charco);
        ly = Y0 + 0.012; lz = Z.charco;
      }
      ojos.push({
        tipo: 'ojo', kind, x, y, R, P, off, rango, dormido, lx, ly, lz,
        cierre: 0.06, a: 0.06, vigila: false, aviso: false, mx: 0, my: 0, ruido: 0, despierto: false, tDesp: 0, enfria: 0, aPrev: 0.06, forzar: false,
      });
    }
    function crearGrande(P) {
      const m = carton(IMG.miron, 280 * S); m.position.set(LX(640), LY(360), Z.ventana + 0.004); m.userData.vivo = true; tramoG.add(m);
      mironGrande = m;
      ojos.push({ tipo: 'grande', kind: 'grande', x: 640, y: 214, R: 62, P, off: Math.random() * P, rango: 0, lx: LX(640), ly: LY(214), lz: Z.ojo + 0.012, cierre: 0.06, a: 0.06, vigila: false, aviso: false, mx: 0, my: 0, aPrev: 0.06, forzar: false });
      cono = { cx: 640, ancho: 125, fase: Math.random() * 6 };
    }
    function crearLasslow() {
      const m = carton(IMG['n-lasslow-riendo'], 150 * S); m.position.set(LX(1100), LY(MIR.suelo - 40), Z.ventana + 0.006); m.userData.vivo = true; tramoG.add(m);
      lasslow = m; E.lassT = 3.2;
    }
    function crearNeon() {
      const { g, t } = lienzo(640, 96);
      g.fillStyle = 'rgba(20,12,28,.85)'; g.beginPath(); g.roundRect(0, 0, 640, 96, 30); g.fill();
      g.strokeStyle = '#ff6fb5'; g.lineWidth = 7; g.beginPath(); g.roundRect(12, 12, 616, 72, 24); g.stroke();
      g.fillStyle = '#ff6fb5'; g.font = '48px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BREATHE AND FLOAT', 320, 50);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(580 * S, 580 * S * 96 / 640), mb({ map: t, transparent: true })); m.position.set(LX(1010), LY(112), Z.ventana + 0.003); m.userData.vivo = true; tramoG.add(m);
      neon = m;
      const f = carton(IMG.miron, 200 * S); f.position.set(LX(1140), Y0, Z.luz + 0.01); f.userData.vivo = true; tramoG.add(f);
      mironFin = f;
    }
    function montarTramo(n) {
      limpiarTramo();
      E.tramo = n; E.tipo = tipos[n - 1]; E.tTramo = 0; E.px = 70; E.check = 70; E.sosp = 0; E.gracia = 1.3; E.bloqueo = 0;
      E.escondido = false; E.ocultoT = 0; E.agach = 0; E.ventana = 0; E.cerrando = false;
      E.meta = n === tipos.length ? MIR.metaNeon : MIR.meta;
      ponerFondo(n === 3 ? 'bg-fuera-apagado' : fondos[n - 1] || 'bg-plaza');
      const bins = E.tipo === 'barrido' ? [330, 640, 950] : [520, 860];
      bins.forEach(crearCubo);
      const rango = 150 + 8 * (dif - 1) * 5;
      const xs = [260, 430, 600, 770, 940];
      const kinds = mezclar(['farola', 'ventana', 'charco', 'farola', 'ventana']);
      const P = 4.4 / Math.pow(dif, 0.6);
      if (E.tipo === 'fila') {
        const dir = Math.random() < 0.5 ? 1 : -1;
        xs.forEach((x, i) => crearOjo({ x, kind: kinds[i], P, off: (dir > 0 ? i : xs.length - 1 - i) * P / 6, rango }));
      } else if (E.tipo === 'dormidos') xs.forEach((x, i) => crearOjo({ x, kind: kinds[i], P, off: 0, rango: rango - 10, dormido: true }));
      else if (E.tipo === 'lasslow') { xs.forEach((x, i) => crearOjo({ x, kind: kinds[i], P: azar(3.4, 4.8) / Math.pow(dif, 0.6), off: Math.random() * 5, rango })); crearLasslow(); }
      else crearGrande(P * 1.2);
      if (n === tipos.length) crearNeon();
      fusionar(tramoG, o => !o.userData.vivo && !o.parent?.userData?.vivo);
      montarMallaOjos();
      ponerVuper('vn-caminando'); vuper.material.color.set('#ffffff');
      E.fase = 'juego';
      sucio = true;
      pista(PISTAS[E.tipo]);
      if (!E.pistaDicha) {
        E.pistaDicha = true;
        luego(1.5, () => { if (E.fase === 'juego' && !vozActual) decir('(Cuenta los parpadeos.)', W(LX(E.px + 30), LY(MIR.suelo - 230), Z.vuper + 0.02)); });
      }
    }
    function pista(texto) { pistaTxt = texto; pistaT = 2.7; sucio = true; ui.instruccion(texto); luego(2.7, () => { if (ui._instr === texto) ui.instruccion(null); }); }

    // ---------- agacharte: tu cabeza respecto a la de cuando empezaste ----------
    function medirPostura(dt) {
      const y = xr.cabeza.y;
      if (E.ref === null) E.ref = y;
      const umbral = (xr.sentado || E.ref < 1.3) ? 0.07 : 0.12;
      const baja = E.ref - y;
      if (!E.cuerpo && baja > umbral) E.cuerpo = true;
      else if (E.cuerpo && baja < umbral * 0.6) E.cuerpo = false;
      if (y > E.ref) E.ref += (y - E.ref) * Math.min(1, dt * 2);                 // te estiras: se ajusta enseguida
      else if (!E.cuerpo) E.ref -= Math.min(E.ref - y, 0.03 * dt);              // te vas hundiendo sin querer: poco a poco
      E.porMano = [xr.manos.derecha, xr.manos.izquierda].some(m => m.activa && (m.pinza || m.agarre));
      const antes = E.agachado;
      E.agachado = E.cuerpo || E.porMano;
      if (antes !== E.agachado) {
        sucio = true;
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar?.(E.agachado ? 0.25 : 0.15, 20);
        if (E.agachado && !E.yaAgachado && E.fase === 'juego') { E.yaAgachado = true; sonido('pop', { volumen: 0.25, tono: 0.8 }); }
      }
    }

    // ---------- bucle ----------
    function moverJugador(dt) {
      const puede = E.fase === 'juego' && E.bloqueo <= 0 && !E.cerrando;
      if (E.bloqueo > 0) E.bloqueo -= dt;
      E.moviendo = puede && !E.agachado;
      if (E.moviendo) { E.cara = 1; E.px = Math.min(E.px + MIR.vel * dt, E.meta + 40); }
      const ref = refugios.find(r => Math.abs(E.px - r.x) < 64);
      E.escondido = !!(puede && E.agachado && ref);
      if (E.escondido) {
        E.ocultoT += dt;
        if (E.ocultoT > 0.35 && !ref.usado) {
          ref.usado = true; ref.led.material.color.set('#7ee081');
          sonido('pop', { volumen: 0.3 });
          fx.chispas(ref.led.getWorldPosition(V()), '#7ee081', 10, 0.5);
        }
        if (E.ocultoT > 0.35) E.check = ref.x;
      } else E.ocultoT = 0;
      E.agach += ((E.agachado && E.fase !== 'fin' ? 1 : 0) - E.agach) * Math.min(1, dt * 12);
      if (E.fase === 'juego' && E.px >= E.meta && !E.cerrando) tramoHecho();
      if (E.fase === 'juego') E.tTramo += dt;
    }

    function actualizarOjos(dt) {
      const t = E.reloj;
      const enRango = (o, k = 1) => Math.abs(E.px - o.x) < o.rango * k;
      for (const o of ojos) {
        let a;
        if (o.forzar) a = 0.06;
        else if (o.tipo === 'grande') a = aperturaMirando(((t + o.off) % o.P) / o.P);
        else if (o.dormido) {
          o.enfria -= dt;
          if (o.despierto) {
            o.tDesp -= dt; a = 1;
            if (o.tDesp <= 0) { o.despierto = false; o.ruido = 0; o.enfria = 0.8; }
          } else {
            const ruidoso = E.moviendo && E.fase === 'juego' && enRango(o, 1.7);
            if (o.enfria <= 0) o.ruido = Math.max(0, o.ruido + (ruidoso ? 0.55 : -0.8) * dt * (ruidoso ? dif : 1));
            if (o.ruido >= 1) { o.despierto = true; o.tDesp = 2.3; }
            a = 0.06 + Math.min(1, o.ruido) * 0.44;
          }
        } else if (E.ventana > 0 && lasslow) a = 1; // abiertos, pero mirando a Lasslow
        else a = aperturaMirando(((t + o.off) % o.P) / o.P);
        o.a = a;
        o.cierre += (a - o.cierre) * Math.min(1, dt * 16);
        const distraido = E.ventana > 0 && !!lasslow && o.tipo === 'ojo';
        o.vigila = !o.forzar && !distraido && o.cierre > 0.93;
        o.aviso = !o.forzar && !distraido && !o.vigila && o.cierre > 0.3;
        // aviso: sonido y un toque en las manos, solo de los ojos cercanos y sin atropellarse
        if (o.aPrev < 0.2 && a >= 0.4 && !o.dormido && E.sonT <= 0 && E.fase === 'juego') {
          const cerca = o.tipo === 'grande' || Math.abs(E.px - o.x) < 340;
          if (cerca) { sonido('fiu', { volumen: 0.16, tono: 1.7 }); E.sonT = 0.25; for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar?.(0.2, 25); }
        }
        if (o.dormido && o.aPrev < 0.99 && a >= 0.99 && E.sonT <= 0 && E.fase === 'juego') { sonido('latido', { volumen: 0.4 }); E.sonT = 0.3; }
        o.aPrev = a;
        // la pupila te sigue si mira; si no, se pierde
        let tx = 0, ty = 0;
        if (distraido) { tx = THREE.MathUtils.clamp((1100 - o.x) / 300, -1, 1); ty = 0.55; }
        else if (o.cierre > 0.3 && !o.forzar) {
          const dx = E.px - o.x, dy = (MIR.suelo - 90) - o.y, d = Math.max(1, Math.hypot(dx, dy));
          tx = dx / d; ty = dy / d;
          if (!o.vigila) { tx *= 0.4; ty *= 0.4; }
        }
        o.mx += (tx - o.mx) * Math.min(1, dt * 10);
        o.my += (ty - o.my) * Math.min(1, dt * 10);
      }
      if (cono) cono.cx = 640 + 450 * Math.sin(0.5 * Math.sqrt(dif) * t + cono.fase);
      if (E.ventana > 0) E.ventana -= dt;
      if (mironGrande) mironGrande.material.color.set(ojos[0]?.aviso ? '#ffe9a8' : '#ffffff');
    }

    function detectar(dt) {
      let amenaza = 0;
      if (E.fase === 'juego' && E.bloqueo <= 0 && !E.cerrando) {
        if (E.gracia > 0) E.gracia -= dt;
        else {
          const mueve = E.moviendo && !E.escondido;
          for (const o of ojos) {
            if (o.tipo === 'grande') {
              if (o.vigila && !E.escondido && Math.abs(E.px - cono.cx) < cono.ancho) amenaza = Math.max(amenaza, 175);
              continue;
            }
            if (Math.abs(E.px - o.x) >= o.rango) continue;
            if (o.vigila && mueve) amenaza = Math.max(amenaza, 250);
            else if (o.aviso && mueve) amenaza = Math.max(amenaza, 45);
          }
        }
      }
      E.sosp = THREE.MathUtils.clamp(E.sosp + (amenaza > 0 ? amenaza : -70) * dt, 0, 100);
      if (!E.rojo) vuper.material.color.set(E.sosp > 30 ? (E.sosp > 65 ? '#ff7a7a' : '#ffc2a0') : '#ffffff');
      if (E.sosp >= 100 && E.fase === 'juego' && E.bloqueo <= 0) visto();
    }

    // las luces: lo que ve cada ojo abierto (un trapecio hasta el suelo y la mancha en la acera)
    function pintarLuces() {
      for (let k = 0; k < MAXO; k++) {
        const o = ojos[k], b = k * VPO * 3;
        if (!o || !o.vigila) { luzPos.fill(0, b, b + VPO * 3); continue; }
        let x0, x1, xa, xb, yTop, cx, rx;
        if (o.tipo === 'grande') { cx = LX(cono.cx); rx = cono.ancho * S; x0 = o.lx - 34 * S; x1 = o.lx + 34 * S; xa = cx - rx; xb = cx + rx; yTop = o.ly - 46 * S; }
        else { cx = o.lx; rx = o.rango * S; x0 = o.lx - o.R * 0.8 * S; x1 = o.lx + o.R * 0.8 * S; xa = cx - rx; xb = cx + rx; yTop = o.kind === 'charco' ? Y0 + 0.004 : o.ly - o.R * S * EK * 0.5; }
        const z = Z.luz, yF = Y0 + 0.002;
        const P = [[x0, yTop, z], [x1, yTop, z], [xb, yF, z + 0.02], [xa, yF, z + 0.02]];
        if (o.kind === 'charco') { P[0] = [xa, yF, Z.charco]; P[1] = [xb, yF, Z.charco]; P[2] = [xb, yF, Z.charco]; P[3] = [xa, yF, Z.charco]; }
        P.forEach((p, i) => { luzPos[b + i * 3] = p[0]; luzPos[b + i * 3 + 1] = p[1]; luzPos[b + i * 3 + 2] = p[2]; });
        const c = b + 4 * 3; luzPos[c] = cx; luzPos[c + 1] = yF + 0.0005; luzPos[c + 2] = 0.01;
        for (let s = 0; s <= SEGP; s++) {
          const a = s / SEGP * Math.PI * 2, j = c + (s + 1) * 3;
          luzPos[j] = cx + Math.cos(a) * rx; luzPos[j + 1] = yF + 0.0005; luzPos[j + 2] = 0.01 + Math.sin(a) * 0.045;
        }
      }
      geoLuz.attributes.position.needsUpdate = true;
    }

    // ---------- Lasslow: la ventana extra ----------
    function gagLasslow(dt) {
      E.lassT -= dt;
      if (E.lassT > 0 || E.cerrando) return;
      E.lassT = azar(8.5, 10.5);
      E.ventana = 3.6;
      sonido('risa-lasslow', { volumen: 0.5 });
      E.risa = 1.4;
      decir('JA…', W(LX(1040), LY(MIR.suelo - 200), Z.ventana + 0.03), 1.6, 0.12);
      luego(0.45, () => { if (E.fase === 'juego') mironDice('miron-mira', '¿De mí?', 1.7); });
    }

    // ---------- ver y ser visto ----------
    function visto() {
      E.vistos++; E.vidasQ = Math.max(0, MIR.vidas - E.vistos);
      E.puntos = Math.max(0, E.puntos - MIR.penal);
      E.sosp = 0; E.bloqueo = 1.3; sucio = true;
      ponerVuper('vn-sorprendido');
      sonido('oooh', { volumen: 0.4 });
      E.rojo = true; vuper.material.color.set('#ff3b3b'); luego(0.26, () => { E.rojo = false; });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar?.(0.9, 120);
      fx.chispas(W(LX(E.px), LY(MIR.suelo - 200), Z.vuper), '#5fb8ff', 8, 0.4);
      for (const o of ojos) o.mx = 0;
      if (E.vistos >= MIR.vidas) {
        E.fase = 'perdiendo';
        mironDice('miron-alterado', teoria(), 2.2);
        luego(1.7, () => final(false));
        return;
      }
      mironDice('miron-alterado', teoria(), 2.3);
      luego(0.55, () => { if (E.fase === 'juego') E.vuelta = { de: E.px, t: 0 }; });
      luego(1.3, () => { if (E.fase !== 'juego') return; ponerVuper('vn-caminando'); E.vuelta = null; E.px = E.check; E.gracia = 1.8; });
    }

    function tramoHecho() {
      E.fase = 'pausa'; E.cerrando = true;
      const rapido = Math.max(0, Math.round(150 - Math.max(0, E.tTramo - 10) * 10));
      const gana = MIR.puntosTramo + rapido;
      E.puntos += gana; sucio = true;
      const p = W(LX(Math.min(E.px, 1100)), LY(MIR.suelo - 240), Z.vuper + 0.02);
      fx.acierto(p, { color: '#ffe066', n: 20, racha: E.tramo * 2, fuerte: E.tramo === tipos.length });
      saltaTexto(`+${gana}`, '#ffe066', p, 0.1);
      if (E.tramo >= tipos.length) { luego(0.25, llegada); return; }
      luego(0.5, () => { anim = { t: 0, cambiado: false }; sonido('zas', { volumen: 0.25 }); });
    }

    // el neón: por una vez, El Mirón cierra todos los ojos
    function llegada() {
      for (const o of ojos) o.forzar = true;
      E.ventana = 0;
      ponerVuper('vn-hablando');
      if (mironFin && IMG['miron-relajado']) mironFin.material.map = IMG['miron-relajado'];
      sonido('suspiro', { volumen: 0.5 });
      fx.chispas(W(LX(1140), LY(MIR.suelo - 230), Z.luz), '#ff6fb5', 16, 0.6);
      decir('Respira y flota…', W(LX(1000), LY(MIR.suelo - 260), Z.vuper + 0.03), 1.8);
      luego(2.1, () => final(true));
    }

    function final(gana) {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; E.cerrando = true; sucio = true;
      ui.instruccion(null);
      if (gana && E.vistos === 0) E.puntos += MIR.bonoSinVer;
      let titulo, linea;
      if (gana) {
        titulo = E.vistos === 0 ? 'Ni un parpadeo.' : 'Cruzado el barrio.';
        linea = E.vistos === 0
          ? 'Ningún ojo te ha pillado. Bajo el neón, él cierra todos los suyos. Por una vez.'
          : `${E.vistos} ${E.vistos === 1 ? 'avistamiento' : 'avistamientos'}, tres tramos y un neón. Debajo, él ha cerrado todos los ojos.`;
      } else { titulo = 'Anotado.'; linea = 'Tres avistamientos. Esa noche, en su libreta, eres tú.'; }
      E.gana = gana;
      ctx.terminar({ puntos: E.puntos, gana, linea: `${titulo} ${linea}` });
    }

    // ---------- arranque ----------
    ctx.musica?.('sigilo');
    pintarMarcador();
    luego(0.3, () => { ui.cartela(nivel > 1 ? `TE ESTÁN MIRANDO · Nivel ${nivel}` : 'TE ESTÁN MIRANDO · Cuenta los parpadeos', 2.6); sonido('sting', { volumen: 0.4 }); });
    luego(0.9, () => ui.instruccion('Agáchate de verdad y Vuper se para · de pie, anda'));
    // la mano fantasma: baja con la palma, «agáchate»
    {
      const a = W(0.16, 0.36, 0.14), b = W(0.16, 0.13, 0.14);
      fx.demo([{ p: a }, { p: b, puno: true }, { p: b, puno: true }], { dur: 2.8, tramo: 0.7, escala: 0.9, retraso: 0.6 });
    }
    luego(3.4, () => { E.ref = null; montarTramo(1); });

    const api = {
      E, tipos, get ojos() { return ojos; }, get refugios() { return refugios; }, get cono() { return cono; }, get lasslow() { return lasslow; },
      get fase() { return E.fase; }, apertura: aperturaMirando, vel: MIR.vel,
    };
    grupo.userData.api = api;

    const _cab = V(), inv = base.matrixWorld.clone().invert();
    return {
      grupo,
      actualizar(dt) {
        E.reloj += dt; E.sonT -= dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= E.reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        medirPostura(dt);
        if (E.tramo) {
          moverJugador(dt);
          if (E.vuelta) { E.vuelta.t += dt; const k = Math.min(1, E.vuelta.t / 0.48), e = k * k * (3 - 2 * k); E.px = E.vuelta.de + (E.check - E.vuelta.de) * e; }
          actualizarOjos(dt);
          detectar(dt);
          pintarOjos();
          pintarLuces();
          if (lasslow && E.fase === 'juego') gagLasslow(dt);
        }
        // el telón entre tramos
        if (anim) {
          anim.t += dt;
          if (anim.t < 0.22) tramoG.scale.y = 1 - anim.t / 0.22;
          else if (!anim.cambiado) { anim.cambiado = true; montarTramo(E.tramo + 1); tramoG.scale.y = 0.01; }
          else tramoG.scale.y = Math.min(1, (anim.t - 0.22) / 0.26);
          if (anim.t > 0.5) { tramoG.scale.y = 1; anim = null; }
        }
        // Vuper: anda (bote), se agacha contigo
        const cabL = _cab.copy(xr.cabeza).applyMatrix4(inv);
        const bob = E.moviendo ? Math.sin(E.reloj * 14) : 0;
        vuper.position.set(LX(E.px), Y0 + Math.abs(bob) * 4 * S, Z.vuper);
        vuper.rotation.set(0, 0, E.moviendo ? -bob * 0.05 : 0);
        vuper.scale.set(E.cara > 0 ? -1 : 1, 1 - 0.42 * E.agach, 1);
        // El Mirón del lateral
        if (retrato.visible) {
          retratoT += dt;
          const k = Math.min(1, retratoT / 0.26), sale = retratoT > retratoDur ? Math.min(1, (retratoT - retratoDur) / 0.26) : 0;
          retrato.scale.setScalar(Math.max(0.001, (k < 1 ? 1.15 * k - 0.15 * k * k : 1) * (1 - sale)));
          retrato.rotation.y = Math.atan2(cabL.x - retrato.position.x, cabL.z - retrato.position.z);
          if (sale >= 1) retrato.visible = false;
        }
        if (lasslow && E.risa > 0) { E.risa -= dt; lasslow.rotation.z = Math.sin(E.reloj * 28) * 0.1; } else if (lasslow) lasslow.rotation.z = 0;
        if (mironGrande) mironGrande.position.y = LY(360) + Math.sin(E.reloj * 1.85) * 3 * S;
        if (neon) neon.material.opacity = (Math.floor(E.reloj / 0.42) % 2) ? 0.62 : 1;
        if (mironFin && E.fase === 'fin') mironFin.position.y = Y0 + Math.abs(Math.sin(E.reloj * 1.1)) * 6 * S;
        // textos
        if (vozActual) { vozActual.t += dt; vozActual.m.lookAt(xr.cabeza); if (vozActual.t > vozActual.vida) callar(); }
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * s.sube; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (s.vida - s.t));
          if (s.t > s.vida) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
        if (pistaT > 0) { pistaT -= dt; if (pistaT <= 0) sucio = true; }
        tPintar -= dt; if (tPintar <= 0) { tPintar = 0.1; sucio = true; }
        if (sucio) pintarMarcador();
      },
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; E.cerrando = true; ui.instruccion(null);
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Te vas a casa a mitad del barrio. ${E.vistos ? 'Él lo ha anotado.' : 'Ni te ha visto.'}` });
      },
      destruir() {
        acabado = true; tareas.length = 0;
        fx.destruir(); callar();
        ui.instruccion(null);
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const t of texturas) t.dispose();
        grupo.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      },
    };
  },
};
