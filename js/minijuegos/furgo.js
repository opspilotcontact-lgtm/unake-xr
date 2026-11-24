// La furgo · VR nativo (escala «inmersivo», SENTADO). Reglas de base/js/escenas/furgo.js.
//
// Vas al volante de la furgo de Palicaso, rumbo a la feria. La cabina (furgo_cabina.js) se queda quieta respecto a ti:
// la carretera y lo que viene se mueven hacia ti. Nunca se mueve la cámara; sin curvas ni giros del horizonte.
//   VOLANTE   cógelo con una mano o con las dos (pellizco o puño; con mandos, gatillo o botón lateral) y gíralo:
//             más de ~22° a un lado = carril de ese lado; al centro (o si lo sueltas, que vuelve solo) = carril del medio.
//   ESQUIVA   conos, baches, charcos de Puky y el sofá. Las nubes de humo tapan el parabrisas un instante (< 1 s).
//   COGE      monchis (20; cada 6 seguidos, +100) y el monchi dorado de la gasolinera (+150 y una vida).
// 3 vidas. Gana quien llega a la meta (con los puntos del primer umbral).
// Antes de arrancar eliges hasta 3 acompañantes tocando sus recortables en el salpicadero. Se sientan a tu lado
// (Puky, pegado al parabrisas) y hacen lo suyo como en el 2D. Más gente = más puntos (x1,2 / x1,5 / x1,8) y más lío.
// La elección se guarda en localStorage['unake-xr-furgo-acompanantes'] para «El control».
import * as THREE from 'three';
import { Bocadillo } from '../bocadillo.js';
import { Jugo } from './jugo.js';
import { crearCabina, ACOMP, ACOMP_ORDEN, MAX_ACOMP, guardarAcompanantes, leerAcompanantes, lienzo, azar, bolsa, clamp, V, TINTA } from './furgo_cabina.js';

// Medidas del 2D pasadas a metros (1 px = 0,04 m): 360 px/s → 14,4 m/s; meta 19 000 px → 760 m (~55 s).
const FU = { vBase: 14.4, meta: 760, hueco: 13.2, salida: 46, carril: 3, frente: 1.6, invul: 1.5 };
const MULT_ACOMP = [1, 1.2, 1.5, 1.8];
// tamaño de cada cosa (m): w ancho, h alto, plano = tumbado en el suelo, vuela = altura sobre la carretera
const TIPOS = {
  cono: { w: 0.75, h: 0.95, cap: 10 }, sofa: { w: 1.9, h: 1.15, cap: 4 }, bache: { w: 1.8, h: 1.2, plano: true, cap: 6 },
  charco: { w: 2.0, h: 1.3, plano: true, cap: 6 }, moncho: { w: 0.62, h: 0.62, vuela: 0.75, cap: 14 }, dorado: { w: 0.9, h: 0.9, vuela: 0.85, cap: 3 },
  humo: { w: 5.2, h: 3.4, vuela: 0.1, cap: 3 }, cartel: { w: 1.9, h: 2.9, cap: 4 }, gasolinera: { w: 4.6, h: 4.2, cap: 2 },
};
const DANA = new Set(['cono', 'sofa', 'bache', 'charco']);

// Lo que dicen (FRASES_FURGO y FRASES_ELEGIR_FURGO de base/js/contenido/furgo.js, una selección; sin repetir).
const ELEGIR = {
  palicaso: 'Yo voy, claro. Os cuento por el camino lo de la furgo. Y lo de antes de la furgo.',
  lasslow: 'Caballero, me honra. JA… perdón. Llevaré la compostura. Y la pajarita.',
  perico: 'Pin pin. Voy de copiloto. De copiloto.',
  cotine: 'Yo ya estoy dentro. Y no he dicho que quiera ir.',
  pompa: 'Vale. Pero sin prisa. Si hay prisa, no.',
  blancaso: 'Voy. Pero lo sé: nos vamos a arrepentir.',
  puky: '¿De verdad? ¿A mí? Blurp. ¡Voy a hacer de parabrisas!',
};
const CHARLA = {
  palicaso: ['Y entonces el tío me dice: «Palicaso, ¿y la carretera?». Y yo: «¿Qué carretera?».', 'Yo conducía antes, ¿eh? Hasta que la furgo y yo tuvimos aquella conversación.'],
  lasslow: ['Ese cono, caballero. Tiene un aire de… JA… de cono. Perdón.', 'Esto no ha sido el bache. No miren. Un señor no se explica.'],
  perico: ['Pin pin. ¿Falta mucho? ¿Falta mucho?', 'Pin pin. Vuper no sabe conducir. No sabe.'],
  cotine: ['¿Cuánto falta? Porque yo no he dicho que quiera ir.', 'Un pellizquito nada más… (ñam) …del ambientador.'],
  pompa: ['Esta curva me la tomo con calma.', 'Sobre el bache de hace un rato: no lo noté. Flotaba.'],
  blancaso: ['Lo he apuntado en la agenda: «Viaje en furgo, 21:40, sufrimiento».', 'Si hay un bache, que sea pequeño. Por favor.'],
  puky: ['Blurp. Estoy pegadísimo. Qué buen sitio.', 'Eh, Vuper, el limpiaparabrisas me hace cosquillas.'],
};
const PALICASO = [
  '¡Escucha, escucha! Que te cuento lo de mi primo, el de la furgoneta, que un día…',
  'Y entonces le dije: «mira, que yo ya lo había dicho», y él, que no, que sí…',
  'Pues eso, que como te decía, y no me interrumpas, que viene lo mejor…',
  '¿Te he contado lo de la gasolinera? Pues escucha, que tiene tela…',
];
const EUSEBIO = { // DON_EUSEBIO.frases (narradas)
  arrancar: ['Don Eusebio asoma la nariz por la guantera, huele el pino y vuelve a esconderse con gesto de desaprobación.', 'Don Eusebio comprueba con una patita que sigue siendo martes.'],
  curvas: ['Don Eusebio rueda a la izquierda. Rueda a la derecha. Una pipa le sigue.', 'Don Eusebio se agarra a un paquete de pañuelos como a un salvavidas.'],
  golpe: ['Don Eusebio se hace bola. Bola de pelo. Bola de dignidad herida.', 'Se oye un «pof» pequeño. Después, un bufido largo.'],
  ganar: ['Don Eusebio chasquea la lengua, que es lo que hace cuando todo sale bien.', 'Don Eusebio se llena los carrillos de pipas, satisfecho.'],
  perder: ['Don Eusebio se vuelve a hacer bola. Mañana será otro martes.', 'Don Eusebio mastica una pipa con furia contenida.'],
};
const LINEAS_OK = {
  lasslow: 'Lasslow no ha parado de reírse. Eso no ha ayudado.', palicaso: 'Palicaso lleva dos horas hablando. Nadie ha sabido cuándo empezó.',
  perico: 'Perico ha dicho «pin pin» en cada cartel. Había muchos carteles.', cotine: 'Cotine ha dicho que no quería venir. Lleva el bolsillo lleno de migas.',
  pompa: 'La Pompa ha viajado con mucho cuidado. Mucho.', blancaso: 'Blancaso ha apuntado todas las curvas. Y las ha sufrido todas.', puky: 'Puky ha ido pegado al cristal todo el camino. Queda una marca.',
};

// ---------- dibujos de lo que hay en la carretera ----------
function dib(w, h, f) { const l = lienzo(w, h); f(l.g, w, h); l.t.needsUpdate = true; return l.t; }
function texturas(puff, monchi) {
  const ink = (g, w = 8) => { g.lineWidth = w; g.strokeStyle = TINTA; g.lineJoin = 'round'; };
  const T = {};
  T.cono = dib(128, 160, g => {
    ink(g); g.fillStyle = '#ff7a1c'; g.beginPath(); g.moveTo(64, 8); g.lineTo(104, 140); g.lineTo(24, 140); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6e8'; g.fillRect(48, 56, 32, 16); g.fillRect(38, 96, 52, 16);
    g.fillStyle = '#ff7a1c'; g.fillRect(8, 136, 112, 18); g.strokeRect(8, 136, 112, 18);
  });
  T.sofa = dib(256, 160, g => {
    ink(g); g.fillStyle = '#c4513a'; g.beginPath(); g.roundRect(8, 30, 240, 110, 26); g.fill(); g.stroke();
    g.fillStyle = '#e27a52'; g.beginPath(); g.roundRect(30, 10, 196, 64, 20); g.fill(); g.stroke();
    g.fillStyle = '#d96a48'; for (const x of [36, 132]) { g.beginPath(); g.roundRect(x, 78, 88, 50, 14); g.fill(); g.stroke(); }
    g.fillStyle = TINTA; g.fillRect(24, 140, 16, 16); g.fillRect(216, 140, 16, 16);
  });
  T.bache = dib(256, 170, g => {
    g.fillStyle = '#15121f'; g.beginPath(); g.ellipse(128, 85, 116, 74, 0, 0, 7); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#6b5f86'; g.stroke(); ink(g, 6); g.beginPath(); g.ellipse(128, 85, 98, 58, 0, 0, 7); g.stroke();
    g.strokeStyle = '#4a3f62'; g.beginPath(); g.moveTo(70, 60); g.lineTo(110, 85); g.lineTo(98, 118); g.moveTo(150, 66); g.lineTo(190, 92); g.stroke();
  });
  T.charco = dib(256, 170, g => {
    g.fillStyle = '#d9e23a'; g.beginPath(); g.ellipse(128, 85, 118, 76, 0, 0, 7); g.fill(); g.lineWidth = 10; g.strokeStyle = '#6f7a10'; g.stroke();
    g.fillStyle = '#f4f89a'; g.beginPath(); g.ellipse(88, 60, 32, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(172, 104, 10, 0, 7); g.fill();
  });
  T.moncho = monchi;
  T.dorado = dib(192, 192, g => {
    const r = g.createRadialGradient(96, 96, 20, 96, 96, 96); r.addColorStop(0, 'rgba(255,243,160,.9)'); r.addColorStop(1, 'rgba(255,243,160,0)');
    g.fillStyle = r; g.fillRect(0, 0, 192, 192);
    g.filter = 'sepia(1) saturate(4) brightness(1.25)'; g.drawImage(monchi.image, 30, 30, 132, 132); g.filter = 'none';
  });
  T.humo = dib(512, 340, g => {
    g.filter = 'saturate(0.3) brightness(1.7)';
    for (const [x, y, w] of [[0, 120, 230], [140, 40, 260], [300, 110, 210], [90, 160, 300], [240, 170, 270]]) g.drawImage(puff.image, x, y, w, w * 0.78);
  });
  T.cartel = dib(256, 384, g => {
    ink(g); g.fillStyle = '#6b5f86'; g.fillRect(120, 150, 16, 234); g.strokeRect(120, 150, 16, 234);
    g.fillStyle = '#1f8a5a'; g.beginPath(); g.roundRect(8, 8, 240, 150, 18); g.fill(); g.stroke();
    g.strokeStyle = '#fff6e8'; g.lineWidth = 6; g.beginPath(); g.roundRect(20, 20, 216, 126, 10); g.stroke();
    g.fillStyle = '#fff6e8'; g.font = '50px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('FERIA', 110, 100);
    g.beginPath(); g.moveTo(186, 62); g.lineTo(226, 84); g.lineTo(186, 106); g.fill();
  });
  T.gasolinera = dib(256, 240, g => {
    ink(g); g.fillStyle = '#3a2a55'; g.beginPath(); g.roundRect(8, 8, 240, 224, 14); g.fill(); g.stroke();
    g.fillStyle = '#ff3b30'; g.beginPath(); g.roundRect(24, 24, 208, 66, 10); g.fill(); g.stroke();
    g.fillStyle = '#fff6e8'; g.font = '40px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('GASOLINERA', 128, 72);
    g.fillStyle = '#ffd23f'; for (const x of [40, 168]) { g.beginPath(); g.roundRect(x, 120, 48, 96, 8); g.fill(); g.stroke(); }
    g.fillStyle = '#ffe9a8'; g.fillRect(104, 130, 48, 40);
  });
  T.aviso = dib(128, 128, g => {
    ink(g, 9); g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(64, 10); g.lineTo(120, 112); g.lineTo(8, 112); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = TINTA; g.font = '70px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('!', 64, 100);
  });
  T.meta = dib(1024, 160, g => {
    for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? TINTA : '#fff6e8'; g.fillRect(i * 32, 112 + j * 24, 32, 24); }
    g.fillStyle = '#ff5fa2'; g.fillRect(0, 0, 1024, 112); g.lineWidth = 8; g.strokeStyle = TINTA; g.strokeRect(4, 4, 1016, 152);
    g.fillStyle = '#fff6e8'; g.font = '84px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('¡FERIA DE HUMO!', 512, 88);
  });
  return T;
}

// ======================================================================================
export default {
  clave: 'Furgo', titulo: 'La furgo', escala: 'inmersivo', tapaElBar: true, umbrales: [800, 1400, 2100],
  ayudas: { gatillo: 'Tocar / coger el volante', lateral: 'Coger el volante', mano: { pellizco: 'Coger el volante', puno: 'Coger el volante' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-furgo';
    const nivel = Math.max(1, ctx.nivel ?? 1);
    const fx = new Jugo(ctx, grupo);

    // ---------- banderas de partida: TODAS aquí («Otra vez» vuelve a llamar a crear) ----------
    const est = {
      fase: 'cargando', t: 0, base: 0, monchis: 0, vidas: 3, golpes: 0, racha: 0, recorrido: 0, vel: 0,
      carril: 1, objetivo: 1, fx: 0, invul: 0, retraso: 0, pendiente: null, sigPx: 20, sigCartel: 40,
      factorVel: 1, mult: 1, cotineOk: false, acabado: false, destruido: false, elegidos: [], niebla: 0, grietas: 0,
      tmr: {}, voz: null, vozT: 9, cuenta: 0, ultimoCarril: 1, salpicon: 0, bajaVolante: 0,
    };
    const eventos = []; const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn });
    const obs = [];
    const sacaCharla = bolsa(Object.keys(CHARLA)), sacaPalicaso = bolsa(PALICASO);

    const cab = await crearCabina(ctx);
    grupo.add(cab.raiz);
    const { H } = cab;
    const L = (x, y, z) => new THREE.Vector3(x, y, z);

    const [puff, monchi] = await Promise.all([ctx.img('fx-humo-puff.png'), ctx.img('obj-ficha-monchi.png')]);
    const T = texturas(puff, monchi);
    const propias = Object.entries(T).filter(([k]) => k !== 'moncho').map(([, t]) => t);

    // ---------- lo de la carretera: una malla instanciada por tipo ----------
    const geoDePie = new THREE.PlaneGeometry(1, 1); geoDePie.translate(0, 0.5, 0);
    const geoTumbado = new THREE.PlaneGeometry(1, 1); geoTumbado.rotateX(-Math.PI / 2);
    const mallas = {};
    for (const [tipo, d] of Object.entries(TIPOS)) {
      const m = new THREE.InstancedMesh(d.plano ? geoTumbado : geoDePie, new THREE.MeshBasicMaterial({ map: T[tipo], alphaTest: tipo === 'humo' || tipo === 'dorado' ? 0.02 : 0.4, transparent: tipo === 'humo' || tipo === 'dorado', depthWrite: tipo !== 'humo', fog: false }), d.cap);
      m.frustumCulled = false; m.count = 0; m.visible = false; m.renderOrder = tipo === 'humo' ? 3 : 0;
      cab.mundo.add(m); mallas[tipo] = m;
    }
    const meta = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 1.8), new THREE.MeshBasicMaterial({ map: T.meta, fog: false }));
    meta.visible = false; cab.mundo.add(meta);
    const aviso = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: T.aviso, alphaTest: 0.4, fog: false, depthTest: false }));
    aviso.visible = false; aviso.renderOrder = 12; cab.mundo.add(aviso);
    let avisoT = 0;

    // ---------- el parabrisas: humo que tapa un instante, salpicones y grietas ----------
    const vidrio = (w, h, tex, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, fog: false }));
      m.renderOrder = 9; m.visible = false; cab.raiz.add(m); return m;
    };
    const niebla = vidrio(2.3, 0.8, T.humo, 0); niebla.position.set(0.45, H + 0.04, -0.86);
    const salpL = lienzo(512, 256); propias.push(salpL.t);
    const salp = vidrio(1.0, 0.5, salpL.t, 1); salp.position.set(0.1, H + 0.02, -0.855);
    const grietL = lienzo(1024, 384); propias.push(grietL.t);
    const griet = vidrio(2.1, 0.78, grietL.t, 0.85); griet.position.set(0.45, H + 0.04, -0.85);
    function salpicon(tipo) {
      const col = { charco: '#d9e23a', sofa: '#e27a52', cono: '#ff7a1c', bache: '#6b5f86' }[tipo] || '#fff6e8';
      const { g, c, t } = salpL; g.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < 15; i++) {
        const a = Math.random() * 7, d = Math.random() * 200, x = 256 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.5, r = Math.max(6, (12 + Math.random() * 24) * (1 - d / 260));
        g.fillStyle = col; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x, y, r * 1.05, r * 0.85, 0, 0, 7); g.fill(); g.globalAlpha = 1;
        g.lineWidth = 3; g.strokeStyle = TINTA; g.stroke();
      }
      t.needsUpdate = true;
      salp.position.x = -0.1 + Math.random() * 0.9; salp.visible = true; salp.material.opacity = 1; est.salpicon = 2.2;
      if (est.grietas++ < 5) {
        const G = grietL; const cx = (salp.position.x - 0.45 + 1.05) / 2.1 * 1024, cy = 192 + (Math.random() - 0.5) * 120;
        G.g.strokeStyle = 'rgba(255,255,255,.8)'; G.g.lineWidth = 3;
        for (let i = 0; i < 7; i++) { let x = cx, y = cy, a = i / 7 * 6.28 + Math.random() * 0.6; G.g.beginPath(); G.g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += Math.cos(a) * (22 + Math.random() * 40); y += Math.sin(a) * (22 + Math.random() * 40); G.g.lineTo(x, y); a += (Math.random() - 0.5); } G.g.stroke(); }
        G.t.needsUpdate = true; griet.visible = true;
      }
    }

    // ---------- marcador en el salpicadero ----------
    const hudL = lienzo(640, 200); propias.push(hudL.t);
    const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.094), new THREE.MeshBasicMaterial({ map: hudL.t, transparent: true }));
    hud.position.set(-0.36, H - 0.235, -0.56); hud.rotation.set(-0.5, 0.25, 0); cab.raiz.add(hud);
    let hudAntes = '';
    function pintarHud() {
      const pts = Math.round(est.base * est.mult), prog = clamp(est.recorrido / FU.meta, 0, 1);
      const clave = `${pts}|${est.vidas}|${est.mult}|${Math.round(prog * 50)}|${est.fase}`;
      if (clave === hudAntes) return; hudAntes = clave;
      const { g, c, t } = hudL; g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
      g.font = '58px Caprasimo, serif'; g.fillStyle = '#ffd23f'; g.textBaseline = 'middle'; g.fillText(`${pts} puntos`, 26, 56);
      for (let i = 0; i < 3; i++) { g.fillStyle = i < est.vidas ? '#ff5fa2' : '#3d3350'; g.beginPath(); const x = 470 + i * 52, y = 56; g.moveTo(x, y + 18); g.bezierCurveTo(x - 30, y - 6, x - 10, y - 26, x, y - 8); g.bezierCurveTo(x + 10, y - 26, x + 30, y - 6, x, y + 18); g.fill(); }
      g.font = '34px Caprasimo, serif'; g.fillStyle = '#fff3e6';
      const n = est.elegidos.length;
      g.fillText(n ? `x${String(est.mult).replace('.', ',')} · ${n} a bordo` : 'sin nadie a bordo', 26, 116);
      g.fillStyle = '#3d3350'; g.fillRect(26, 150, 588, 22); g.fillStyle = '#7ee081'; g.fillRect(26, 150, 588 * prog, 22);
      g.fillStyle = '#fff3e6'; g.font = '26px Caprasimo, serif'; g.textAlign = 'right'; g.fillText('feria', 614, 128); g.textAlign = 'left';
      t.needsUpdate = true;
    }

    // ---------- los acompañantes: recortables en el salpicadero para elegir ----------
    const figuras = {};
    const capas = (r, si) => { for (const k of ['borde', 'canto1', 'canto2']) if (r[k]) r[k].visible = si; };
    // de tres en tres: siete personajes a la vez son ~60 peticiones de golpe (el servidor local las rechazaba)
    const cargar = async (id, i) => {
      const r = await ctx.Recortable.crear(ACOMP[id].rec, 'humo').catch(e => { console.warn('furgo: sin', id, e); return null; });
      if (!r) return;
      const estante = L(-0.42 + i * 0.145, H - 0.27, -0.57);
      r.grupo.position.copy(estante); r.grupo.scale.setScalar(0.24); r.sombra.visible = false; r.enAsiento = true;
      capas(r, false); // en el salpicadero miden 20 cm: sin borde ni canto (de 4 llamadas de dibujo a 1 cada uno)
      cab.raiz.add(r.grupo);
      figuras[id] = { id, r, estante, toque: 0, vuelve: 0, sitio: null, hinch: 1 };
    };
    for (let k = 0; k < ACOMP_ORDEN.length; k += 3) await Promise.all(ACOMP_ORDEN.slice(k, k + 3).map((id, j) => cargar(id, k + j)));
    const centroFigura = f => f.r.grupo.localToWorld(V().set(0, 0.36, 0));

    // título de la elección
    const titL = lienzo(1024, 220); propias.push(titL.t);
    const titulo = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.12), new THREE.MeshBasicMaterial({ map: titL.t, transparent: true, depthWrite: false }));
    titulo.position.set(0.03, H + 0.03, -0.66); titulo.renderOrder = 7; cab.raiz.add(titulo);
    function pintarEleccion() {
      const { g, c, t } = titL; g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(91,58,140,.92)'; g.strokeStyle = TINTA; g.lineWidth = 10; g.beginPath(); g.roundRect(8, 8, 1008, 204, 34); g.fill(); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '70px Caprasimo, serif'; g.fillStyle = '#ffd23f'; g.fillText('¿Quién se sube a la furgo?', 512, 76);
      const n = est.elegidos.length;
      g.font = '40px Caprasimo, serif'; g.fillStyle = '#fff3e6';
      g.fillText(n === 0 ? 'Tócalos · hasta 3 · más gente, más puntos y más lío' : `A bordo: ${est.elegidos.map(id => ACOMP[id].nombre).join(', ')} · x${String(MULT_ACOMP[n]).replace('.', ',')}`, 512, 160);
      t.needsUpdate = true;
      // la tarjeta para arrancar, encima del título: lejos del camino de la mano hacia los recortables
      const pc = cab.aMundo(L(0.03, H + 0.16, -0.6));
      ui.tarjetasEn([n ? '¡A la carretera!' : 'Salir sin nadie'], pc, cab.aMundo(L(0, H, 0)).sub(pc).setY(0).normalize(), () => arrancar());
    }
    function consejo(a, b) {
      const { g, c, t } = titL; g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.85)'; g.beginPath(); g.roundRect(8, 8, 1008, 204, 34); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '46px Caprasimo, serif'; g.fillStyle = '#ffe066'; g.fillText(a, 512, 80, 980);
      g.font = '40px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText(b, 512, 156);
      t.needsUpdate = true; titulo.visible = true;
    }
    function alternar(id) {
      const f = figuras[id]; if (!f || est.fase !== 'elegir') return;
      const i = est.elegidos.indexOf(id);
      if (i >= 0) { est.elegidos.splice(i, 1); sonido('pop', { volumen: 0.35 }); f.r.callar(); }
      else if (est.elegidos.length < MAX_ACOMP) { est.elegidos.push(id); sonido('boing', { volumen: 0.35 }); f.r.empujon(0.25); hablar(id, ELEGIR[id], 2.6); }
      else { sonido('bonk', { volumen: 0.4 }); f.r.empujon(0.1); return; }
      for (const g of Object.values(figuras)) g.r.grupo.position.y = g.estante.y + (est.elegidos.includes(g.id) ? 0.035 : 0);
      pintarEleccion();
    }

    // una sola voz a la vez
    function hablar(id, texto, dur) {
      const f = figuras[id]; if (!f || !texto || est.fase === 'fin') return;
      if (est.voz && est.voz !== f.r) est.voz.callar();
      f.r.decir(texto, dur ? { dur } : {}); est.voz = f.r;
    }
    function cara(id, alt, seg = 1.2) {
      const f = figuras[id]; if (!f) return;
      f.r.pose(alt ? ACOMP[id].alt : 'base'); f.vuelve = alt ? seg : 0;
    }
    const va = id => est.elegidos.includes(id);

    // ---------- arrancar ----------
    function arrancar() {
      if (est.fase !== 'elegir') return;
      est.fase = 'cuenta'; est.cuenta = 0.9; est.vel = 3;
      guardarAcompanantes(est.elegidos);
      ui.quitarTarjetas();
      est.mult = MULT_ACOMP[est.elegidos.length];
      let asiento = 0;
      for (const f of Object.values(figuras)) {
        if (!va(f.id)) { f.r.grupo.visible = false; continue; }
        capas(f.r, true); // a tu lado, a tamaño grande: otra vez de cartón con su canto
        f.desde ={ p: f.r.grupo.position.clone(), s: f.r.grupo.scale.x }; f.vuela = 0;
        if (f.id === 'puky') f.sitio = { pos: L(0.3, H - 0.12, cab.PARABRISAS.z), escala: 0.62, puky: true };
        else f.sitio = { ...cab.ASIENTOS[asiento], i: asiento++ };
      }
      est.tmr = { lasslow: 5 + Math.random() * 3, palicaso: 6 + Math.random() * 4, cotine: 7 + Math.random() * 3, blancaso: 4 + Math.random() * 3 };
      est.factorVel = va('pompa') ? 0.78 : 1;
      cab.eusebio('normal'); if (Math.random() < 0.6) cab.ponerPie(azar(EUSEBIO.arrancar));
      sonido('bocina', { volumen: 0.5 });
      cab.etiqueta('¡Arranca!', '#ffd23f', L(0.1, H + 0.1, -0.8), 0.45, 1.2);
      consejo('Coge el volante y gíralo para cambiar de carril', 'Si lo sueltas, vuelve solo al centro'); hud.visible = true;
      // la mano fantasma coge el aro y lo gira a un lado y al otro
      fx.demo([{ p: cab.puntoVolante(0.3).add(V(0.06, -0.05, 0.08)) }, { p: cab.puntoVolante(0.3) }, { p: cab.puntoVolante(0.3), puno: true }, { p: cab.puntoVolante(-0.4), puno: true }, { p: cab.puntoVolante(0.9), puno: true }, { p: cab.puntoVolante(0.3), puno: true }], { dur: 3, tramo: 0.45, flecha: false });
      programar(6, () => { if (est.fase !== 'elegir') titulo.visible = false; });
      pintarHud();
    }

    // ---------- objetos ----------
    const xCarril = c => (c - 1) * FU.carril;
    function poner(tipo, carril, extra = 0) {
      const d = TIPOS[tipo]; if (obs.filter(o => o.tipo === tipo).length >= d.cap) return null;
      const o = { tipo, carril, x: tipo === 'gasolinera' ? 7.6 : tipo === 'cartel' ? (Math.random() < 0.5 ? -6.6 : 6.6) : xCarril(carril), dz: FU.salida + extra, tomado: false, giro: Math.random() * 6 };
      obs.push(o); return o;
    }
    function generar() {
      const prog = est.recorrido / FU.meta;
      if (Math.random() < 0.58) {
        const tipos = ['cono', 'cono', 'bache', 'charco']; if (prog > 0.18) tipos.push('sofa');
        const t = azar(tipos), c = Math.floor(Math.random() * 3);
        if (va('perico') && Math.random() < 0.45) { // Perico avisa un momento antes de que salga
          programar(0.9, () => { if (est.fase === 'viaje') poner(t, c); });
          aviso.position.set(xCarril(c), 2.6, -(FU.frente + 34)); aviso.visible = true; avisoT = 1;
          sonido('pin-pin', { volumen: 0.4 }); cara('perico', true, 0.9); hablar('perico', 'Pin pin… ¡cuidado!', 1.2);
        } else poner(t, c);
      } else if (Math.random() < 0.18 && prog > 0.1) poner('humo', Math.floor(Math.random() * 3));
      else { const c = Math.floor(Math.random() * 3); for (let i = 0; i < 3; i++) poner('moncho', c, i * 3.8); }
    }
    function quitar(o) { const i = obs.indexOf(o); if (i >= 0) obs.splice(i, 1); }

    function toca(o) {
      const pos = L(0.1 + (o.x - est.fx) * 0.05, H + 0.0, -0.85);
      if (o.tipo === 'moncho') {
        o.tomado = true; quitar(o); est.monchis++; est.racha++; est.base += 20; sonido('pop', { volumen: 0.3, tono: 1 + (est.racha % 6) * 0.07 });
        vibrar(0.25, 25);
        fx.chispas(cab.aMundo(pos.clone()), '#ffd23f', est.racha % 6 === 0 ? 40 : 14, est.racha % 6 === 0 ? 1.6 : 0.9);
        if (est.racha % 6 === 0) { est.base += 100; cab.etiqueta(`¡Racha de ${est.racha}! +100`, '#ffd23f', pos, 0.42); sonido('campanita', { volumen: 0.45 }); }
        else cab.etiqueta('+20', '#ffd23f', pos, 0.22, 0.7);
        return;
      }
      if (o.tipo === 'dorado') {
        o.tomado = true; quitar(o); est.base += 150; est.cotineOk = true; sonido('campanita', { volumen: 0.6 }); vibrar(0.5, 60);
        fx.chispas(cab.aMundo(pos.clone()), '#ffe066', 44, 1.8);
        if (est.vidas < 3) { est.vidas++; cab.etiqueta('¡Una vida más!', '#7ee081', pos, 0.42); } else cab.etiqueta('¡Monchi dorado! +150', '#ffd23f', pos, 0.46);
        if (va('cotine')) { cara('cotine', false); hablar('cotine', '…Vale. Ya no digo nada.', 2.2); }
        return;
      }
      if (o.tipo === 'charco' && va('puky')) { // los charcos de Puky no le hacen daño a nadie que vaya con él
        o.tomado = true; est.base += 30; cara('puky', true, 0.9); cab.etiqueta('¡Qué rico!', '#ffd23f', pos, 0.3); sonido('chapoteo', { volumen: 0.4 }); vibrar(0.2, 30);
        return;
      }
      if (est.invul > 0) return;
      choque(o);
    }
    function vibrar(f, ms) { xr.manos.derecha.vibrar(f, ms); xr.manos.izquierda.vibrar(f, ms); }
    function choque(o) {
      o.tomado = true; est.invul = FU.invul; est.racha = 0; est.golpes++;
      cab.eusebio('susto', 1.3); if (Math.random() < 0.6) cab.ponerPie(azar(EUSEBIO.golpe));
      const dano = va('pompa') ? 2 : 1;
      est.vidas = Math.max(0, est.vidas - dano);
      sonido(o.tipo === 'sofa' ? 'bocina' : 'golpe', { volumen: 0.6 }); if (o.tipo === 'sofa') sonido('boing', { volumen: 0.4 });
      vibrar(1, 140);
      salpicon(o.tipo);
      cab.etiqueta(azar(['¡PLAM!', '¡BONK!', '¡CRAC!']), '#ff5fa2', L(salp.position.x, H + 0.12, -0.84), 0.4);
      if (o.tipo === 'charco') quitar(o);
      if (va('pompa')) { // ella pierde el doble: se hincha, a punto de reventar
        const f = figuras.pompa; f.hinch = 1 + 0.12 * est.golpes; f.r.pose(ACOMP.pompa.alt); f.vuelve = 0; f.r.empujon(0.3);
        hablar('pompa', 'Yo no, que exploto.', 1.8);
      }
      pintarHud();
      if (est.vidas <= 0) final(false);
    }

    // ---------- lo que hace cada acompañante (sin decir qué siente: se ve) ----------
    function companeros(dt) {
      const t = est.tmr;
      if (va('lasslow') && (t.lasslow -= dt) <= 0) {
        t.lasslow = 9 + Math.random() * 5;
        cara('lasslow', true, 1.4); hablar('lasslow', azar(['Ji ji ji… ¡jajaja!', 'Perdón, perdón… ¡jajaja!', '¡Es que… jajaja!']), 1.5);
        sonido('risa-lasslow', { volumen: 0.5 }); figuras.lasslow.r.empujon(0.3);
        est.retraso = 0.9; // la risa: el volante obedece tarde
      }
      if (va('palicaso') && (t.palicaso -= dt) <= 0) { t.palicaso = 12 + Math.random() * 5; palicasoHabla(); }
      if (va('cotine') && !est.cotineOk && (t.cotine -= dt) <= 0) {
        t.cotine = 15 + Math.random() * 5;
        hablar('cotine', azar(['¡Para en esa gasolinera!', '¡Para, para, que me ha entrado el hambre!', '¡Gasolinera! ¡Ahí!']), 2.2); cara('cotine', true, 1.5);
        poner('gasolinera', 2, 4); poner('dorado', 2, 4);
      }
      if (va('blancaso') && (t.blancaso -= dt) <= 0) {
        t.blancaso = 7 + Math.random() * 4;
        cara('blancaso', true, 2); figuras.blancaso.r.frente.material.color.set('#c4ffb4'); figuras.blancaso.verde = 2;
        if (Math.random() < 0.5) hablar('blancaso', azar(['Uf… otra curva.', 'Apunto: mareo, 14:32.', 'Cuando pares, me bajo. Un momentito.']), 1.7);
      }
      // y de vez en cuando, alguien comenta (una voz, y solo si nadie habla)
      if (est.elegidos.length && (est.vozT -= dt) <= 0) {
        est.vozT = 9 + Math.random() * 5;
        let id = sacaCharla(); for (let k = 0; k < 7 && !va(id); k++) id = sacaCharla();
        if (va(id) && !(est.voz?.bocadillo?.malla.visible)) hablar(id, azar(CHARLA[id]));
      }
    }
    // el bocadillo enorme de Palicaso tapa la carretera lejana unos segundos (lo cercano se sigue viendo)
    const charla = new Bocadillo(); const charlaAncla = new THREE.Group();
    charlaAncla.position.set(0.25, H - 0.92, -3.6); charlaAncla.scale.setScalar(4); charlaAncla.add(charla.malla); cab.raiz.add(charlaAncla);
    function palicasoHabla() {
      cara('palicaso', true, 3.2); charla.mostrar(sacaPalicaso(), 3.6); figuras.palicaso.r.empujon(0.2);
    }

    // ---------- el bucle ----------
    function viaje(dt) {
      // acelera poco a poco hacia la meta (hasta +12 %) y con el nivel del 2D (hasta +16 %)
      const subida = 1 + 0.12 * clamp(est.recorrido / FU.meta, 0, 1) + Math.min(0.16, 0.04 * (nivel - 1));
      const objetivo = est.fase === 'viaje' ? FU.vBase * est.factorVel * subida : est.fase === 'cuenta' ? 3 : 0;
      est.vel += (objetivo - est.vel) * Math.min(1, 2.2 * dt);
      est.recorrido += est.vel * dt;
      est.invul = Math.max(0, est.invul - dt);
      // el volante manda el carril (con histéresis: el seguimiento de manos tiembla)
      const a = cab.volante.ang * 180 / Math.PI;
      if (a > 22) est.objetivo = 2; else if (a < -22) est.objetivo = 0; else if (Math.abs(a) < 10) est.objetivo = 1;
      if (est.retraso > 0) { est.retraso -= dt; est.pendiente = est.objetivo; }
      else { if (est.pendiente != null) est.pendiente = null; est.carril = est.objetivo; }
      if (est.carril !== est.ultimoCarril) {
        est.ultimoCarril = est.carril; sonido('whoosh', { volumen: 0.12 }); vibrar(0.2, 20);
        if (Math.random() < 0.22) { cab.eusebio('feliz', 0.5); if (Math.random() < 0.5) cab.ponerPie(azar(EUSEBIO.curvas), 3); }
      }
      // generar por distancia
      est.sigPx -= est.vel * dt;
      if (est.sigPx <= 0 && est.recorrido < FU.meta - 60) { generar(); est.sigPx = FU.hueco * (0.9 + Math.random() * 0.45); }
      est.sigCartel -= est.vel * dt;
      if (est.sigCartel <= 0) { const o = poner('cartel', 1, 0); if (o) o.esCartel = true; est.sigCartel = 68 + Math.random() * 28; }
      // mover y chocar
      for (let i = obs.length - 1; i >= 0; i--) {
        const o = obs[i]; o.dz -= est.vel * dt;
        if (o.tipo === 'cartel' && !o.pasado && o.dz < 0) {
          o.pasado = true;
          if (va('perico') && est.fase === 'viaje') { sonido('pin-pin', { volumen: 0.35 }); cara('perico', true, 0.7); if (Math.random() < 0.5) hablar('perico', azar(['Pin pin.', 'Pin pin, pin pin.', '¡Cartel! Pin pin.']), 0.9); }
        }
        if (o.tipo === 'humo' && !o.pasado && o.dz < 0.5 && Math.abs(o.x - est.fx) < 3) { o.pasado = true; est.niebla = 0.9; sonido('fup', { volumen: 0.4 }); }
        if (o.dz < -6) { quitar(o); continue; }
        if (o.tomado || o.tipo === 'humo' || o.tipo === 'cartel' || o.tipo === 'gasolinera' || est.fase !== 'viaje') continue;
        if (Math.abs(o.x - est.fx) < 1.45 && o.dz < 0.6 && o.dz > -1.2) toca(o);
      }
      if (est.fase === 'viaje' && est.recorrido >= FU.meta) final(true);
    }

    function pintarObjetos() {
      const n = {}; for (const k in mallas) n[k] = 0;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), s = V(), Y = L(0, 1, 0);
      for (const o of obs) {
        const d = TIPOS[o.tipo], m = mallas[o.tipo];
        if (o.tomado && o.tipo !== 'charco' && DANA.has(o.tipo)) { /* el que te has comido sigue ahí, tumbado */ }
        const z = -(FU.frente + o.dz);
        if (o.tipo === 'moncho' || o.tipo === 'dorado') q.setFromAxisAngle(Y, est.t * 3 + o.giro); else q.identity();
        if (o.tomado && DANA.has(o.tipo) && !d.plano) q.setFromAxisAngle(L(0, 0, 1), o.x > est.fx ? -1.2 : 1.2);
        m4.compose(p.set(o.x, d.vuela || 0, z), q, s.set(d.w, d.h, 1));
        m.setMatrixAt(n[o.tipo]++, m4);
      }
      for (const k in mallas) { const m = mallas[k]; m.count = n[k]; m.visible = n[k] > 0; if (n[k]) m.instanceMatrix.needsUpdate = true; }
      // la meta, cuando ya se ve
      const falta = FU.meta - est.recorrido;
      meta.visible = falta < 72 && falta > -30; meta.position.set(0, 3.6, -(FU.frente + falta));
    }

    function final(llega) {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin';
      ui.instruccion(null); charla.ocultar();
      titulo.visible = false; est.bajaVolante = 0.001; // el volante se aparta para dejar sitio a las tarjetas
      if (llega) est.base += 400 + est.vidas * 80 + (est.golpes === 0 ? 200 : 0);
      else est.base += Math.round(300 * Math.min(1, est.recorrido / FU.meta));
      const puntos = Math.round(est.base * est.mult);
      const gana = llega && puntos >= 800;
      pintarHud();
      cab.eusebio(llega ? 'feliz' : 'susto'); cab.ponerPie(azar(llega ? EUSEBIO.ganar : EUSEBIO.perder), 5);
      if (llega) { sonido('platillo', { volumen: 0.5 }); cab.etiqueta('¡Se ve la feria!', '#7ee081', L(0.1, H + 0.12, -0.85), 0.5, 1.8); }
      else cab.etiqueta('Fin del viaje', '#ff5fa2', L(0.1, H + 0.12, -0.85), 0.45, 1.8);
      const extra = est.elegidos.length ? LINEAS_OK[azar(est.elegidos)] : 'Don Eusebio y tú, con la radio puesta. Muy dignos.';
      const linea = llega ? `Todos a bordo y la furgo casi entera. ${extra}` : 'La furgo se ha quedado a medio camino. La culpa es del sofá, que nadie sabe de quién es.';
      programar(llega ? 1.6 : 1.1, () => ctx.terminar({ puntos, gana, linea }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('minijuego');
    est.elegidos = (leerAcompanantes(ctx) || []).filter(id => figuras[id]);
    est.fase = 'elegir';
    for (const g of Object.values(figuras)) g.r.grupo.position.y = g.estante.y + (est.elegidos.includes(g.id) ? 0.035 : 0);
    pintarEleccion(); pintarHud(); hud.visible = false; // en la elección, el salpicadero es de ellos
    cab.carr.v = 3;
    // la mano fantasma toca a dos de ellos con el dedo (así se eligen)
    { const fs = Object.values(figuras); if (fs.length >= 2) { const a = centroFigura(fs[1]), b = centroFigura(fs[fs.length - 2]), arr = V(0, 0.08, 0.1);
      fx.demo([{ p: a.clone().add(arr) }, { p: a }, { p: a.clone().add(arr) }, { p: b.clone().add(arr) }, { p: b }, { p: b.clone().add(arr) }], { dur: 3, tramo: 0.4, flecha: false, retraso: 0.6 }); } }

    // para el bot (herramientas/pruebas/bots/furgo.js)
    const api = {
      get fase() { return est.fase; }, get puntos() { return Math.round(est.base * est.mult); }, get vidas() { return est.vidas; },
      get golpes() { return est.golpes; }, get recorrido() { return est.recorrido; }, meta: FU.meta, get carril() { return est.carril; },
      get fx() { return est.fx; }, get elegidos() { return [...est.elegidos]; }, get monchis() { return est.monchis; }, get angulo() { return cab.volante.ang; },
      get charla() { return charla.malla.visible; }, get sujeto() { return !!(cab.volante.manos.derecha || cab.volante.manos.izquierda); }, get retraso() { return est.retraso; },
      figura: id => figuras[id] ? centroFigura(figuras[id]) : null,
      obstaculos: () => obs.filter(o => !o.tomado).map(o => ({ tipo: o.tipo, carril: o.carril, x: o.x, dz: o.dz })),
      puntoVolante: a => cab.puntoVolante(a),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.furgo = api;
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        cab.actualizar(dt);
        const cam = xr.cabeza;
        if (est.fase === 'elegir') {
          // tocar un recortable con la punta del dedo (o del mando) lo sube o lo baja
          for (const f of Object.values(figuras)) {
            f.toque = Math.max(0, f.toque - dt);
            for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
              if (!m.activa || f.toque > 0) continue;
              if (m.punta.distanceTo(centroFigura(f)) < (m.esMano ? 0.09 : 0.075)) { f.toque = 0.8; m.vibrar(0.5, 35); alternar(f.id); }
            }
          }
        }
        if (est.fase === 'cuenta' && (est.cuenta -= dt) <= 0) est.fase = 'viaje';
        if (est.fase === 'viaje' || est.fase === 'cuenta' || est.fase === 'fin') {
          viaje(dt);
          cab.carr.v = est.vel;
          if (est.fase === 'viaje') companeros(dt);
        }
        est.fx += (xCarril(est.carril) - est.fx) * Math.min(1, 4.5 * dt);
        cab.mundo.position.x = -est.fx;
        pintarObjetos();
        if (avisoT > 0) { avisoT -= dt; aviso.visible = avisoT > 0 && Math.floor(avisoT * 8) % 2 === 0; aviso.position.z += est.vel * dt; }
        // el humo del parabrisas: sube rápido, se queda un instante y se va (menos de 1 s en total)
        if (est.niebla > 0) { est.niebla -= dt; const k = est.niebla; niebla.visible = k > 0; niebla.material.opacity = Math.min(0.85, (0.9 - k) * 6, k * 2.4); }
        if (est.salpicon > 0) { est.salpicon -= dt; salp.material.opacity = Math.min(1, est.salpicon / 1.3); salp.position.y -= dt * 0.02; if (est.salpicon <= 0) { salp.visible = false; salp.position.y = H + 0.02; } }
        // los acompañantes: del salpicadero a su asiento, y su vida
        for (const f of Object.values(figuras)) {
          if (!f.r.grupo.visible) continue;
          if (f.sitio && f.vuela < 1) {
            f.vuela = Math.min(1, f.vuela + dt / 0.6); const k = f.vuela * f.vuela * (3 - 2 * f.vuela);
            f.r.grupo.position.lerpVectors(f.desde.p, f.sitio.pos, k); f.r.grupo.position.y += Math.sin(k * Math.PI) * 0.15;
            f.r.grupo.scale.setScalar(f.desde.s + (f.sitio.escala - f.desde.s) * k);
            if (f.vuela >= 1) { if (f.sitio.puky) { f.r.grupo.rotation.set(0, 0, 0); f.r.pose('asomandose'); } else cab.sentar(f.r, f.sitio.i); }
          }
          if (f.sitio?.puky && f.vuela >= 1) f.r.grupo.position.x = 0.3 + Math.sin(est.t * 0.92) * 0.55;
          if (f.hinch > 1 && f.vuela >= 1 && !f.sitio?.puky) f.r.grupo.scale.setScalar(f.sitio.escala * f.hinch);
          if (f.vuelve > 0 && (f.vuelve -= dt) <= 0 && !(f.id === 'pompa' && est.golpes > 0)) f.r.pose(f.sitio?.puky ? 'asomandose' : 'base');
          if (f.verde > 0 && (f.verde -= dt) <= 0) f.r.frente.material.color.set('#ffffff');
          f.r.actualizar(dt, cam);
        }
        charla.actualizar(dt, 0, cam, charlaAncla);
        if (est.bajaVolante > 0 && est.bajaVolante < 1) { est.bajaVolante = Math.min(1, est.bajaVolante + dt / 0.8); cab.volBase.position.y = H - 0.36 - 0.2 * est.bajaVolante; cab.volBase.position.z = -0.36 - 0.12 * est.bajaVolante; }
        pintarHud();
        fx.actualizar(dt);
      },
      // para app.js: lo elegido, por si quiere guardarlo en el motor (ESTADO.furgoAcompanantes) y pasarlo a «El control»
      get datos() { return { acompanantes: [...est.elegidos] }; },
      // salir a mitad: se acaba el viaje con lo que lleves
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin'; ui.instruccion(null); ui.quitarTarjetas?.(); charla.ocultar(); titulo.visible = false;
        est.bajaVolante = 0.001;
        ctx.terminar({ puntos: Math.round(est.base * est.mult), gana: false, linea: 'Paras en el arcén y os bajáis a estirar las piernas. La feria, otro día.' });
      },
      destruir() {
        est.destruido = true; eventos.length = 0;
        fx.destruir();
        ui.instruccion(null); ui.quitarTarjetas?.();
        for (const f of Object.values(figuras)) { f.r.callar(); f.r.frente.material.color.set('#ffffff'); f.r.grupo.parent?.remove(f.r.grupo); }
        for (const t of propias) t.dispose();
        for (const m of Object.values(mallas)) { m.material.dispose(); m.dispose?.(); }
        charla.tex.dispose(); charla.malla.geometry.dispose(); charla.malla.material.dispose();
        cab.destruir();
        if (typeof window !== 'undefined' && window.__mj?.furgo === api) window.__mj.furgo = null;
      },
    };
  },
};
