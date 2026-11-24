// El negocio de Unaké en VR (base/js/negocio.js + escenas/barrio.js → abrirNegocio): una CASA DE MUÑECAS del bar
// encima de una mesa, a la altura de la mano estando sentado. Cada mejora del 2D se ve en la maqueta según su nivel
// (sofás, barra, neón, máquina de monchis, horno de Cotine, cabina de la Pompa, máquina de bolsitas) y los clientes
// de humo flotan dentro (tantos como clientes tenga el local).
//   · ELEGIR: toca con el dedo una parte de la maqueta → la tarjeta de la mesa dice mejora, nivel, precio y efecto,
//     y en la bandeja aparece la pieza nueva.
//   · COMPRAR = PONERLA: coge la pieza de la bandeja (pellizco, puño o gatillo), llévala a su sitio en la maqueta y
//     suéltala → motor.mejorar(id): se encaja con un clic, vibra y salta una chispa. Si no te llega, la pieza no se
//     despega de la bandeja (tiembla, «Te faltan N monchis»). Si la sueltas lejos, vuelve sola a la bandeja.
//   · COBRAR: la caja registradora de la mesa se va llenando (pantallita + monedas en el cajón); tira de la palanca
//     hacia ti → motor.cobrarCaja(): se abre el cajón y las monedas vuelan a tu mano.
//   · La pizarra de detrás: rango, clientes, monchis/min, caja y la meta del negocio que toca.
//
//   const n = new Negocio({ motor, sonido, ui, xr, agarre });   // agarre opcional (no coge si la mano ya lleva algo)
//   n.alMejorar = (r, mejora) => {};   n.alMeta = meta => {};   n.alCobrar = r => {};   // opcionales (bocadillos)
//   await n.montar(grupoSala, posLocal, haciaLocal);   // posLocal: suelo bajo el centro de la mesa;
//                                                      // haciaLocal: punto (local) donde estás tú (el frente mira ahí)
//   n.actualizar(dt, [xr.manos.derecha, xr.manos.izquierda]);   n.elegir('sofas');   n.quitar();
//
// Coste: maqueta + mesa ≈ 6 (kit: sólido, tinta, sombras, brillo, chispas, humo) + pieza de la bandeja 2-3 +
// palanca 2 + cajón 2 + tarjeta, pizarra, pantallita, anillo, monedas y chispas 1 cada una → ≈ 20 llamadas.
import * as THREE from 'three';
import { crearKit, forma } from './deco/kit.js';
import { textura } from '../recursos.js';

const COL = {
  tinta: '#140c1c', morado: '#3b2a52', moradoClaro: '#5a4378', rosa: '#ff5fa2', amarillo: '#ffd628', crema: '#fff3e6',
  neon: '#5ff2ff', lila: '#b68cff', pared: '#5a5378', baldosa: '#6f6d98', baldosa2: '#8a88b4', madera: '#7a4f3a',
  maderaClara: '#a8744f', gris: '#8a7f99', verde: '#6fbf4a', carton: '#c8925a', azul: '#5fd3ff',
};
const NIVEL_MAX = 5;
const MEJORAS = { // el 2D (MEJORAS_NEGOCIO) por si el motor no trae nombre o desc
  neon: ['Neón de la puerta', 'Atrae clientela'], sofas: ['Sofás nuevos', 'Más aforo: caben más'],
  barra: ['Barra de Palicaso', 'Cada cliente deja más'], maquina: ['Máquina de monchis', 'Vende sola y agranda la caja'],
  horno: ['Horno de Cotine', 'Tartas que se venden solas'], dj: ['Cabina de la Pompa', 'Música: más clientela'],
  bolsitas: ['Máquina de bolsitas', 'Fabrica lo de la aso para liar'],
};
// Lo que da el siguiente nivel (las cuentas de cuentasNegocio() en base/js/negocio.js).
const coma = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
const EFECTO = {
  neon: () => '+1,6 de clientela (si caben)', sofas: () => '+2 de aforo: caben más',
  barra: () => '+0,35 monchis por cliente', maquina: () => '+1 monchi/min y la caja aguanta más',
  horno: () => '+1 monchi/min con las tartas', dj: () => '+1,2 de clientela (si caben)',
  bolsitas: n => `Una bolsita cada ${coma(24 / (n + 1))} min`,
};

// ---------- medidas (locales del grupo: suelo bajo el centro de la mesa, el frente mira a +z) ----------
const MESA = 0.7;                 // alto del tablero: se llega sentado
const Y = MESA + 0.02;            // suelo de la maqueta
// Zonas de cada mejora: centro (y sobre el suelo de la maqueta) y donde se encaja su pieza.
const ZONAS = {
  neon: [-0.14, 0.235, -0.232], dj: [-0.205, 0.05, -0.17], bolsitas: [-0.07, 0.05, -0.18], barra: [0.13, 0.045, -0.17],
  maquina: [0.235, 0.06, -0.05], horno: [0.12, 0.035, 0.0], sofas: [-0.15, 0.03, -0.02],
};
const R_ZONA = 0.05;              // tocar una zona con la punta del dedo
const ENCAJA = 0.075;             // soltar la pieza a menos de esto de su zona
const COGER = 0.075;              // coger la pieza de la bandeja
const BANDEJA = new THREE.Vector3(-0.27, MESA + 0.012, 0.165);
const ESCALA_BANDEJA = 1.7;       // en la bandeja se ve más grande; en la mano baja a su tamaño de maqueta
const CAJA = new THREE.Vector3(0.29, MESA, 0.16);
const PIVOTE = new THREE.Vector3(CAJA.x + 0.08, MESA + 0.05, CAJA.z);
const POMO = 0.095;               // alto del pomo sobre el pivote de la palanca
const TIRADA = 0.95;              // rad: a partir de aquí cobra
const MAX_MONEDAS = 24;

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function encoger(ctx, texto, ancho, tam, fuente = 'Caprasimo, serif') { // baja la letra hasta que quepa
  let t = tam; ctx.font = `${t}px ${fuente}`;
  while (t > 12 && ctx.measureText(texto).width > ancho) { t -= 2; ctx.font = `${t}px ${fuente}`; }
  return t;
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _arriba = new THREE.Vector3(0, 1, 0);

// ---------- las piezas (con el kit de la deco: cajas y cilindros fusionados con contorno) ----------
const caja = (k, w, h, d, color, p, o = {}) => k.solido(forma.caja(w, h, d), color, { p, ...o });
const cil = (k, rt, rb, h, color, p, o = {}) => k.solido(forma.cil(rt, rb, h, o.seg ?? 10), color, { p, ...o });

function sofa(k, x, y, z, color, s = 1) {
  caja(k, 0.07 * s, 0.018 * s, 0.04 * s, color, [x, y + 0.009 * s, z]);
  caja(k, 0.07 * s, 0.036 * s, 0.012 * s, color, [x, y + 0.018 * s, z - 0.018 * s]);
  for (const dx of [-1, 1]) caja(k, 0.01 * s, 0.026 * s, 0.04 * s, COL.moradoClaro, [x + dx * 0.035 * s, y + 0.013 * s, z]);
}
function maquinaMonchis(k, x, y, z, n) {
  caja(k, 0.06, 0.12, 0.045, n >= 5 ? COL.amarillo : COL.rosa, [x, y + 0.06, z]);
  caja(k, 0.042, 0.075, 0.004, '#a8f6ff', [x - 0.004, y + 0.07, z + 0.0225], { emis: 0.55, linea: false });
  const tonos = [COL.amarillo, COL.verde, COL.rosa, COL.azul, COL.crema];
  for (let i = 0; i < Math.max(1, n); i++) for (let j = 0; j < 3; j++) caja(k, 0.009, 0.008, 0.004, tonos[(i + j) % 5], [x - 0.017 + j * 0.013, y + 0.044 + i * 0.013, z + 0.025], { linea: false });
  caja(k, 0.01, 0.02, 0.004, COL.tinta, [x + 0.022, y + 0.075, z + 0.0235], { linea: false });
  if (n >= 3) caja(k, 0.056, 0.016, 0.01, COL.amarillo, [x, y + 0.128, z + 0.012], { emis: 0.9, anim: [0, 0, 1.3, 1], linea: false });
}
function horno(k, x, y, z) {
  caja(k, 0.07, 0.05, 0.045, '#d8cfe6', [x, y + 0.025, z]);
  caja(k, 0.046, 0.024, 0.004, '#ff9a3c', [x - 0.008, y + 0.024, z + 0.0225], { emis: 0.85, anim: [0, 0, 0.4, 1], linea: false });
  for (const dx of [0.02, 0.028]) cil(k, 0.003, 0.003, 0.004, COL.tinta, [x + dx, y + 0.04, z + 0.024], { r: [Math.PI / 2, 0, 0], linea: false, seg: 6 });
}
function tarta(k, x, y, z, i, s = 1) {
  cil(k, 0.012 * s, 0.012 * s, 0.01 * s, i % 2 ? COL.amarillo : COL.rosa, [x, y + 0.005 * s, z]);
  cil(k, 0.012 * s, 0.012 * s, 0.003 * s, COL.crema, [x, y + 0.0115 * s, z], { linea: false });
  caja(k, 0.003 * s, 0.006 * s, 0.003 * s, '#e8242f', [x, y + 0.016 * s, z], { linea: false });
}
function altavoz(k, x, y, z, s = 1) {
  caja(k, 0.022 * s, 0.03 * s, 0.02 * s, COL.tinta, [x, y + 0.015 * s, z]);
  cil(k, 0.007 * s, 0.007 * s, 0.003 * s, COL.gris, [x, y + 0.019 * s, z + 0.0105 * s], { r: [Math.PI / 2, 0, 0], linea: false, seg: 10 });
  cil(k, 0.004 * s, 0.004 * s, 0.003 * s, COL.gris, [x, y + 0.007 * s, z + 0.0105 * s], { r: [Math.PI / 2, 0, 0], linea: false, seg: 8 });
}
function cabina(k, x, y, z) {
  caja(k, 0.11, 0.015, 0.08, COL.morado, [x, y + 0.0075, z]);
  caja(k, 0.08, 0.035, 0.028, COL.tinta, [x, y + 0.0325, z + 0.012]);
  caja(k, 0.078, 0.004, 0.002, COL.neon, [x, y + 0.03, z + 0.027], { emis: 1, anim: [0, 0, 2.1, 1], linea: false });
  for (const dx of [-0.02, 0.02]) cil(k, 0.012, 0.012, 0.004, COL.gris, [x + dx, y + 0.052, z + 0.012], { linea: false, seg: 12 });
}
function maquinaBolsitas(k, x, y, z) {
  caja(k, 0.05, 0.072, 0.04, '#3f8a4a', [x, y + 0.036, z]);
  k.solido(forma.cono(0.022, 0.03, 10), COL.gris, { p: [x, y + 0.087, z], r: [Math.PI, 0, 0] });
  caja(k, 0.03, 0.02, 0.004, '#dff3ff', [x, y + 0.045, z + 0.02], { emis: 0.4, linea: false });
  caja(k, 0.014, 0.008, 0.012, COL.tinta, [x, y + 0.016, z + 0.024], { linea: false });
}
function bolsita(k, x, y, z, ry = 0, s = 1) {
  caja(k, 0.013 * s, 0.017 * s, 0.004 * s, '#dff3ff', [x, y + 0.0085 * s, z], { r: [-0.3, ry, 0] });
  caja(k, 0.013 * s, 0.003 * s, 0.0045 * s, COL.rosa, [x, y + 0.0145 * s, z - 0.001 * s], { r: [-0.3, ry, 0], linea: false });
}
function tuboNeon(k, pts, color, fase, grosor = 0.0024) {
  k.solido(forma.tubo(pts, grosor, { radial: 5 }), color, { emis: 1, anim: [0, 0, fase, 2], linea: false });
  k.brillo(forma.tubo(pts, grosor * 3.2, { radial: 6 }), color, { fuerza: 0.9, anim: [0, 0, fase, 2] });
}
function onda(x0, x1, y, z, amp = 0.01, n = 14) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n; p.push([x0 + (x1 - x0) * t, y + Math.sin(t * Math.PI * 3) * amp, z]); } return p; }

// Cómo se ve cada mejora a su nivel `n` (0 = aún no: un solar apagado).
const DIBUJO = {
  neon(k, n) {
    const [x, , z] = ZONAS.neon, y = Y + ZONAS.neon[1];
    caja(k, 0.23, 0.07, 0.008, COL.tinta, [x, y, z - 0.008]);
    if (!n) { k.solido(forma.tubo(onda(x - 0.09, x + 0.09, y, z), 0.0022, { radial: 5 }), COL.gris, { linea: false }); return; }
    tuboNeon(k, onda(x - 0.085, x + 0.085, y + 0.004, z), COL.rosa, 0.3);
    if (n >= 2) k.solido(forma.estrella(0.016, 0.003), COL.neon, { p: [x - 0.1, y + 0.018, z], emis: 1, anim: [0, 0, 1.7, 2], linea: false });
    if (n >= 3) tuboNeon(k, [[x - 0.085, y - 0.026, z], [x + 0.085, y - 0.026, z]], COL.amarillo, 2.4, 0.002);
    if (n >= 4) tuboNeon(k, [[x + 0.1, y + 0.025, z], [x + 0.1, y - 0.02, z], [x + 0.09, y - 0.01, z]], COL.neon, 3.1, 0.002);
    if (n >= 5) for (let i = 0; i < 10; i++) k.halo([x - 0.11 + i * 0.0245, y + 0.04, z + 0.002], i % 2 ? COL.amarillo : COL.crema, 0.007, [0, 0, i * 0.9, 3]);
    k.charco(x, z + 0.07, 0.12, 0.07, COL.rosa, 0.2 + 0.06 * n, Y + 0.002);
  },
  sofas(k, n) {
    const sitios = [[-0.22, -0.07], [-0.1, -0.07], [-0.22, 0.025], [-0.1, 0.025], [0.0, 0.03]], tonos = [COL.rosa, COL.lila, COL.amarillo, COL.neon, COL.rosa];
    if (!n) { caja(k, 0.04, 0.035, 0.04, COL.carton, [sitios[0][0], Y + 0.0175, sitios[0][1]], { r: [0, 0.2, 0] }); return; }
    for (let i = 0; i < n; i++) { sofa(k, sitios[i][0], Y, sitios[i][1], tonos[i]); k.sombra(sitios[i][0], sitios[i][1], 0.045, 0.028, 0.5, Y + 0.002); }
    if (n >= 2) { cil(k, 0.014, 0.014, 0.004, COL.maderaClara, [-0.16, Y + 0.022, -0.022]); cil(k, 0.003, 0.003, 0.02, COL.tinta, [-0.16, Y + 0.01, -0.022], { linea: false, seg: 6 }); }
  },
  barra(k, n) {
    const x0 = 0.01, L = 0.11 + 0.032 * n, cx = x0 + L / 2, z = -0.19;
    caja(k, L, 0.055, 0.045, n ? COL.morado : COL.gris, [cx, Y + 0.0275, z]);
    caja(k, L + 0.01, 0.008, 0.055, n >= 5 ? COL.amarillo : COL.madera, [cx, Y + 0.059, z]);
    if (n >= 2) caja(k, L - 0.01, 0.005, 0.002, COL.rosa, [cx, Y + 0.045, z + 0.0235], { emis: 0.9, anim: [0, 0, 0.8, 1], linea: false });
    for (let i = 0; i < n; i++) cil(k, 0.004, 0.004, 0.02, COL.amarillo, [x0 + 0.02 + i * 0.032, Y + 0.073, z - 0.01], { seg: 6 });
    for (let i = 0; i < Math.min(n, 4); i++) {
      const sx = x0 + 0.025 + i * 0.05;
      cil(k, 0.011, 0.011, 0.006, COL.rosa, [sx, Y + 0.035, z + 0.045]); cil(k, 0.003, 0.003, 0.032, COL.tinta, [sx, Y + 0.016, z + 0.045], { linea: false, seg: 6 });
    }
    if (n >= 3) {
      caja(k, L, 0.005, 0.018, COL.madera, [cx, Y + 0.11, -0.236]);
      const t = [COL.verde, COL.amarillo, COL.rosa, COL.azul];
      for (let i = 0; i < Math.floor(L / 0.02); i++) cil(k, 0.0045, 0.0045, 0.022, t[i % 4], [x0 + 0.01 + i * 0.02, Y + 0.124, -0.236], { seg: 6 });
    }
    k.sombra(cx, z + 0.01, L / 2 + 0.01, 0.04, 0.5, Y + 0.002);
  },
  maquina(k, n) {
    const [x, , z] = ZONAS.maquina;
    if (!n) return k.charco(x, z, 0.035, 0.03, COL.crema, 0.12, Y + 0.002);
    maquinaMonchis(k, x, Y, z, n); k.sombra(x, z, 0.04, 0.032, 0.55, Y + 0.002);
  },
  horno(k, n) {
    const [x, , z] = ZONAS.horno;
    if (!n) return k.charco(x, z, 0.04, 0.03, COL.crema, 0.12, Y + 0.002);
    horno(k, x, Y, z); k.sombra(x, z, 0.045, 0.032, 0.55, Y + 0.002);
    const pos = [[-0.02, 0], [0.002, 0], [0.024, 0], [-0.009, 1], [0.013, 1]];
    for (let i = 0; i < n; i++) tarta(k, x + pos[i][0], Y + 0.05 + pos[i][1] * 0.0135, z, i);
    if (n >= 4) {
      cil(k, 0.006, 0.006, 0.03, COL.gris, [x - 0.025, Y + 0.065, z - 0.014], { seg: 8 });
      k.particulas({ tipo: 'sube', n: 6, centro: [x - 0.025, Y + 0.085, z - 0.014], caja: [0.003, 0.003, 0.003], mueve: [0.01, 0.06, 0.01], color: '#f2eaff', tam: 0.008, vel: 2, humo: true, azar: 5 });
    }
  },
  dj(k, n) {
    const [x, , z] = ZONAS.dj;
    if (!n) return k.charco(x, z, 0.05, 0.035, COL.crema, 0.12, Y + 0.002);
    cabina(k, x, Y, z); k.sombra(x, z, 0.06, 0.042, 0.5, Y + 0.002);
    for (let i = 0; i < n; i++) altavoz(k, x + (i % 2 ? 0.068 : -0.068), Y + Math.floor(i / 2) * 0.031, z - 0.015);
    if (n >= 3) {
      cil(k, 0.0012, 0.0012, 0.1, COL.tinta, [x, Y + 0.2, z], { linea: false, seg: 4 });
      k.solido(forma.esf(0.012, 10, 8), '#e8e4f4', { p: [x, Y + 0.145, z], emis: 0.5, anim: [0, 0, 0.5, 3] });
      k.particulas({ tipo: 'polvo', n: 10, centro: [x + 0.02, Y + 0.12, z + 0.06], caja: [0.07, 0.04, 0.05], mueve: [0.01, 0.01, 0.01], color: [COL.neon, COL.rosa, COL.amarillo], tam: 0.004, vel: 6, azar: 3 });
    }
    if (n >= 5) for (const [dx, c] of [[-0.03, COL.rosa], [0.03, COL.neon]]) k.brillo(forma.cono(0.03, 0.12, 8), c, { modo: 'cono', fuerza: 0.7, p: [x + dx, Y + 0.08, z + 0.02], r: [0.5, 0, dx > 0 ? -0.35 : 0.35] });
    k.charco(x, z + 0.06, 0.08, 0.06, COL.neon, 0.15 + 0.05 * n, Y + 0.002);
  },
  bolsitas(k, n) {
    const [x, , z] = ZONAS.bolsitas;
    if (!n) return k.charco(x, z, 0.035, 0.03, COL.crema, 0.12, Y + 0.002);
    maquinaBolsitas(k, x, Y, z); k.sombra(x, z, 0.035, 0.03, 0.55, Y + 0.002);
    for (let i = 0; i < n; i++) bolsita(k, x - 0.02 + i * 0.01, Y, z + 0.034 + (i % 2) * 0.006, (i - 2) * 0.25);
  },
};

// La pieza nueva de la bandeja: lo que añade el nivel `n` (de pie en el origen). Devuelve su alto.
function unidad(k, id, n) {
  switch (id) {
    case 'neon': caja(k, 0.07, 0.03, 0.006, COL.tinta, [0, 0.015, -0.006]); tuboNeon(k, onda(-0.03, 0.03, 0.015, 0, 0.006, 10), [COL.rosa, COL.neon, COL.amarillo, COL.neon, COL.amarillo][n - 1] || COL.rosa, 0.3); return 0.03;
    case 'sofas': sofa(k, 0, 0, 0, [COL.rosa, COL.lila, COL.amarillo, COL.neon, COL.rosa][n - 1] || COL.rosa); return 0.036;
    case 'barra': caja(k, 0.032, 0.055, 0.045, COL.morado, [0, 0.0275, 0]); caja(k, 0.04, 0.008, 0.055, COL.madera, [0, 0.059, 0]); cil(k, 0.004, 0.004, 0.02, COL.amarillo, [0, 0.073, -0.01], { seg: 6 }); return 0.083;
    case 'maquina': if (n <= 1) { maquinaMonchis(k, 0, 0, 0, 1); return 0.12; }
      caja(k, 0.045, 0.014, 0.012, COL.tinta, [0, 0.007, 0]); for (let j = 0; j < 3; j++) caja(k, 0.01, 0.009, 0.008, [COL.amarillo, COL.verde, COL.rosa][j], [-0.013 + j * 0.013, 0.018, 0], { linea: false }); return 0.023;
    case 'horno': if (n <= 1) { horno(k, 0, 0, 0); return 0.05; } tarta(k, 0, 0, 0, n, 1.4); return 0.024;
    case 'dj': if (n <= 1) { cabina(k, 0, 0, 0); return 0.056; } altavoz(k, 0, 0, 0); return 0.03;
    case 'bolsitas': if (n <= 1) { maquinaBolsitas(k, 0, 0, 0); return 0.1; } for (let i = 0; i < 3; i++) bolsita(k, -0.01 + i * 0.01, 0, (i % 2) * 0.005, (i - 1) * 0.3); return 0.017;
  }
  return 0.03;
}

// La mesa, la maqueta vacía (suelo, paredes), la bandeja, el atril de la tarjeta, el cuerpo de la caja y los postes
// de la pizarra, más todas las mejoras a su nivel y la clientela.
function construirMaqueta(niv, clientes) {
  const k = crearKit({ noche: true });
  // mesa de bar con pie
  caja(k, 0.84, 0.035, 0.54, COL.madera, [0, MESA - 0.0175, -0.01]);
  caja(k, 0.84, 0.01, 0.004, COL.rosa, [0, MESA - 0.02, 0.262], { linea: false });
  cil(k, 0.045, 0.05, MESA - 0.035, COL.tinta, [0, (MESA - 0.035) / 2, -0.01]);
  cil(k, 0.24, 0.26, 0.03, COL.morado, [0, 0.015, -0.01], { seg: 20 });
  k.sombra(0, -0.01, 0.5, 0.36, 0.6);
  // la base de la maqueta, el suelo de baldosas y las paredes (abierta por delante y por la derecha, como una casa de muñecas)
  caja(k, 0.6, 0.02, 0.32, COL.tinta, [0, MESA + 0.01, -0.1]);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) caja(k, 0.07, 0.002, 0.075, COL.baldosa2, [-0.245 + i * 0.07, Y + 0.001, -0.2125 + j * 0.075], { linea: false });
  caja(k, 0.56, 0.0015, 0.3, COL.baldosa, [0, Y + 0.0005, -0.1], { linea: false });
  caja(k, 0.58, 0.2, 0.012, COL.pared, [0, Y + 0.1, -0.252]);
  caja(k, 0.012, 0.2, 0.3, COL.pared, [-0.284, Y + 0.1, -0.1]);
  caja(k, 0.004, 0.13, 0.075, COL.morado, [-0.277, Y + 0.065, -0.02], { linea: false });       // la puerta
  caja(k, 0.004, 0.004, 0.012, COL.amarillo, [-0.274, Y + 0.065, 0.005], { linea: false });     // su pomo
  caja(k, 0.59, 0.01, 0.016, COL.rosa, [0, Y + 0.205, -0.252]);
  caja(k, 0.016, 0.01, 0.31, COL.rosa, [-0.284, Y + 0.205, -0.1]);
  caja(k, 0.012, 0.03, 0.3, COL.pared, [0.284, Y + 0.015, -0.1]);
  // las mejoras
  for (const id of Object.keys(DIBUJO)) DIBUJO[id](k, niv[id] || 0);
  // la clientela: bolitas de humo con ojos que flotan
  const sitios = [[-0.16, -0.12], [-0.03, -0.11], [0.08, -0.12], [-0.05, -0.01], [0.04, 0.02], [-0.2, 0.0], [0.17, -0.1], [-0.13, -0.17], [0.02, -0.05], [0.18, 0.04], [-0.24, -0.12], [0.1, -0.04]];
  const tonos = ['#d8cfe6', '#c9f3ff', '#ffd6e8', '#e0ffd8', '#fff1c2'];
  for (let i = 0; i < Math.min(sitios.length, Math.floor(clientes)); i++) {
    const [x, z] = sitios[i], y = Y + 0.075 + (i % 3) * 0.012, an = [-100, 0.006, i * 1.37, 0];
    k.solido(forma.esf(0.013, 10, 8), tonos[i % 5], { p: [x, y, z], anim: an });
    for (const dx of [-0.005, 0.005]) {
      k.solido(forma.esf(0.0037, 6, 5), '#ffffff', { p: [x + dx, y + 0.002, z + 0.011], anim: an, linea: false });
      k.solido(forma.esf(0.0019, 5, 4), COL.tinta, { p: [x + dx, y + 0.002, z + 0.0142], anim: an, linea: false });
    }
  }
  // bandeja (madera clara con borde)
  caja(k, 0.17, 0.008, 0.13, COL.maderaClara, [BANDEJA.x, MESA + 0.004, BANDEJA.z]);
  for (const [w, d, x, z] of [[0.17, 0.006, 0, 0.062], [0.17, 0.006, 0, -0.062], [0.006, 0.13, 0.082, 0], [0.006, 0.13, -0.082, 0]]) caja(k, w, 0.016, d, COL.madera, [BANDEJA.x + x, MESA + 0.012, BANDEJA.z + z]);
  // atril de la tarjeta
  caja(k, 0.2, 0.012, 0.03, COL.tinta, [0.02, MESA + 0.006, 0.205]);
  // la caja registradora (el cajón y la palanca se mueven: van aparte)
  caja(k, 0.15, 0.065, 0.12, COL.gris, [CAJA.x, MESA + 0.028 + 0.0325, CAJA.z]);
  caja(k, 0.13, 0.012, 0.05, COL.moradoClaro, [CAJA.x, MESA + 0.1, CAJA.z + 0.03], { r: [0.35, 0, 0] });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) caja(k, 0.022, 0.006, 0.014, COL.crema, [CAJA.x - 0.03 + i * 0.03, MESA + 0.104 + j * 0.007, CAJA.z + 0.042 - j * 0.02], { r: [0.35, 0, 0], linea: false });
  caja(k, 0.03, 0.03, 0.02, COL.gris, [CAJA.x, MESA + 0.105, CAJA.z - 0.035]);
  caja(k, 0.018, 0.02, 0.02, COL.tinta, [PIVOTE.x - 0.008, PIVOTE.y, PIVOTE.z]);
  k.sombra(CAJA.x, CAJA.z + 0.01, 0.1, 0.08, 0.5, MESA + 0.002);
  // postes de la pizarra (sobre la pared del fondo)
  for (const dx of [-0.19, 0.19]) caja(k, 0.01, 0.13, 0.01, COL.tinta, [dx, Y + 0.27, -0.256]);
  // luces pintadas
  if (niv.neon) k.luz([ZONAS.neon[0], Y + 0.2, -0.17], COL.rosa, 0.25, 0.6 + 0.1 * niv.neon);
  if (niv.dj) k.luz([ZONAS.dj[0], Y + 0.1, -0.12], COL.neon, 0.2, 0.5 + 0.1 * niv.dj);
  if (niv.horno) k.luz([ZONAS.horno[0], Y + 0.03, 0.04], '#ff9a3c', 0.12, 0.7);
  return k.construir({ ancho: 0.0026, fuerzaHumo: 0.5 });
}

export class Negocio {
  constructor({ motor, sonido = () => { }, ui = null, xr, agarre = null }) {
    Object.assign(this, { motor, sonido, ui, xr, agarre });
    this.alMejorar = null; this.alMeta = null; this.alCobrar = null;
    this.g = null; this.sel = null; this.pieza = null; this.datos = null; this.extra = {};
    this.palanca = { ang: 0, mano: null, tirada: false }; this.cajon = { abre: 0, t: 0 };
    this.monedas = []; this.manos = new Map(); this._t = 0; this._leerT = 0; this._claveM = ''; this._claveT = ''; this._claveP = ''; this._claveC = '';
  }

  async montar(grupo, posLocal = new THREE.Vector3(), haciaLocal = null) {
    const g = this.g = new THREE.Group(); g.name = 'negocio-maqueta';
    g.position.copy(posLocal);
    if (haciaLocal) g.rotation.y = Math.atan2(haciaLocal.x - posLocal.x, haciaLocal.z - posLocal.z);
    grupo.add(g);
    this._leer();
    // cajón y palanca de la caja
    let k = crearKit({ noche: true });
    caja(k, 0.13, 0.024, 0.1, COL.moradoClaro, [0, 0.012, 0]);
    caja(k, 0.12, 0.004, 0.09, COL.tinta, [0, 0.0225, 0], { linea: false });
    caja(k, 0.03, 0.008, 0.008, COL.amarillo, [0, 0.012, 0.053]);
    this.cajonK = k.construir({ ancho: 0.0025 });
    this.cajonK.grupo.position.set(CAJA.x, MESA, CAJA.z + 0.005); g.add(this.cajonK.grupo);
    k = crearKit({ noche: true });
    cil(k, 0.006, 0.006, POMO, COL.gris, [0, POMO / 2, 0], { seg: 8 });
    k.solido(forma.esf(0.017, 12, 9), COL.rosa, { p: [0, POMO, 0] });
    this.palancaK = k.construir({ ancho: 0.003 });
    this.palancaK.grupo.position.copy(PIVOTE); g.add(this.palancaK.grupo);
    // tarjeta (mejora elegida), pizarra (metas) y pantallita de la caja
    this.lTarjeta = lienzo(512, 320); this.tTarjeta = canvasTex(this.lTarjeta);
    this.tarjeta = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.15).translate(0, 0.075, 0), new THREE.MeshBasicMaterial({ map: this.tTarjeta, transparent: true }));
    this.tarjeta.position.set(0.02, MESA + 0.008, 0.2); this.tarjeta.rotation.x = -0.6; g.add(this.tarjeta);
    this.lPizarra = lienzo(1024, 512); this.tPizarra = canvasTex(this.lPizarra);
    this.pizarra = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.22), new THREE.MeshBasicMaterial({ map: this.tPizarra, transparent: true }));
    this.pizarra.position.set(0, Y + 0.44, -0.25); g.add(this.pizarra);
    this.lPant = lienzo(256, 112); this.tPant = canvasTex(this.lPant);
    this.pant = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.044), new THREE.MeshBasicMaterial({ map: this.tPant }));
    this.pant.position.set(CAJA.x, MESA + 0.142, CAJA.z - 0.024); this.pant.rotation.x = -0.25; g.add(this.pant);
    // anillo que marca la zona elegida (y dónde soltar la pieza)
    this.anillo = new THREE.Mesh(new THREE.RingGeometry(0.044, 0.052, 32), new THREE.MeshBasicMaterial({ color: COL.amarillo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.anillo.renderOrder = 9; this.anillo.visible = false; g.add(this.anillo);
    this._chispas();
    const tm = await textura('base/assets/img/obj-ficha-monchi.png');
    if (this.g !== g) return this; // la quitaron mientras cargaba
    this.fichas = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.028, 0.028), new THREE.MeshBasicMaterial({ map: tm, alphaTest: 0.5, side: THREE.DoubleSide }), MAX_MONEDAS);
    this.fichas.count = 0; this.fichas.frustumCulled = false; g.add(this.fichas);
    this._rehacer(true);
    this.elegir(this.sel || this._masBarata());
    this._dibujar(true);
    this.listo = true;
    return this;
  }

  // ---------- leer el motor ----------
  _leer() {
    const n = this.datos = this.motor.negocio();
    // Lo que motor.negocio() aún no da, se lee del 2D (motor.d): tope, clientes, aforo y la meta que toca.
    const d = this.motor.d || {}; let c = null;
    try { c = d.cuentasNegocio?.(); } catch { c = null; }
    const iMeta = n.metaIndice ?? d.negocio?.()?.metas ?? 0, M = d.METAS_NEGOCIO;
    this.extra = {
      tope: n.tope ?? (c ? c.tope : null), clientes: n.clientes ?? (c ? c.clientes : 0), aforo: n.aforo ?? (c ? c.aforo : null),
      meta: n.meta !== undefined ? n.meta : (M ? (M[iMeta] ? { texto: M[iMeta].texto, premio: M[iMeta].premio } : null) : undefined),
      max: n.mejoras[0]?.max ?? 2,
    };
    return n;
  }
  _mejora(id) { return this.datos?.mejoras.find(m => m.id === id) || null; }
  _masBarata() {
    const l = this.datos.mejoras.filter(m => m.nivel < m.max).sort((a, b) => a.precio - b.precio);
    return (l.find(m => m.puede) || l[0] || this.datos.mejoras[0]).id;
  }
  _niveles() { const o = {}; for (const m of this.datos.mejoras) o[m.id] = m.nivel; return o; }

  // la maqueta entera (solo cuando cambia un nivel o la clientela)
  _rehacer(forzar = false) {
    const niv = this._niveles(), cl = Math.floor(this.extra.clientes || 0);
    const clave = JSON.stringify(niv) + '|' + cl;
    if (!forzar && clave === this._claveM) return false;
    this._claveM = clave;
    this.maqueta?.quitar();
    this.maqueta = construirMaqueta(niv, cl);
    this.g.add(this.maqueta.grupo);
    return true;
  }

  // ---------- elegir una mejora ----------
  elegir(id) {
    if (!this.g || !MEJORAS[id]) return;
    if (this.pieza?.estado === 'mano' || this.pieza?.estado === 'encaja') return;
    this.sel = id; this._claveP = ''; this._piezaNueva(); this._dibujar(true);
  }
  _piezaNueva() {
    const m = this._mejora(this.sel), clave = m ? `${m.id}|${m.nivel}|${m.max}` : '';
    if (clave === this._claveP) return;
    this._claveP = clave;
    if (this.pieza) { this.pieza.kit.quitar(); this.pieza.grupo.parent?.remove(this.pieza.grupo); this.pieza = null; }
    if (!m || m.nivel >= m.max || m.nivel >= NIVEL_MAX) return;
    const k = crearKit({ noche: true }), alto = unidad(k, m.id, m.nivel + 1), kit = k.construir({ ancho: 0.0026 });
    const grupo = new THREE.Group(); grupo.add(kit.grupo); grupo.name = 'pieza-' + m.id;
    grupo.position.copy(BANDEJA); grupo.scale.setScalar(0.01);
    this.g.add(grupo);
    const sol = kit.mallas.find(x => x.name === 'deco-solido');
    this.pieza = { id: m.id, kit, grupo, alto, estado: 'bandeja', crece: 0, tiembla: 0, mano: null, desde: null, t: 0, sol, tinte: sol?.material.uniforms.uTinte.value.clone() };
  }
  _centroPieza(dest = new THREE.Vector3()) { const p = this.pieza; return dest.set(0, p.alto / 2, 0).multiplyScalar(p.grupo.scale.x).add(p.grupo.position); }
  _zonaLocal(id, dest = new THREE.Vector3()) { const z = ZONAS[id]; return dest.set(z[0], Y + z[1], z[2]); }

  // ---------- pintar tarjeta, pizarra y pantallita ----------
  _dibujar(forzar = false) {
    const n = this.datos, e = this.extra, monchis = this.motor.monchis, m = this._mejora(this.sel);
    const clave = `${this.sel}|${monchis}|${m ? m.nivel + '/' + m.max + '/' + m.precio : ''}`;
    if (forzar || clave !== this._claveT) { this._claveT = clave; this._tarjeta(m, monchis); }
    const claveC = `${n.caja}|${n.bolsitas}|${e.tope}|${n.rango}|${Math.floor(e.clientes)}|${n.porMin}|${e.meta?.texto}|${monchis}|${e.max}`;
    if (forzar || claveC !== this._claveC) { this._claveC = claveC; this._pizarra(n, e, monchis); this._pantalla(n, e); }
  }
  _tarjeta(m, monchis) {
    const x = this.lTarjeta.getContext('2d'), W = 512, H = 320;
    x.clearRect(0, 0, W, H);
    x.fillStyle = COL.crema; x.strokeStyle = COL.tinta; x.lineWidth = 10;
    x.beginPath(); x.roundRect(6, 6, W - 12, H - 12, 22); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = COL.tinta;
    if (!m) { x.font = '40px Caprasimo, serif'; x.fillText('Toca una parte', W / 2, 130); x.fillText('del bar', W / 2, 180); this.tTarjeta.needsUpdate = true; return; }
    const [nombre, desc] = [m.nombre || MEJORAS[m.id][0], m.desc || MEJORAS[m.id][1]];
    encoger(x, nombre, W - 60, 44); x.fillText(nombre, W / 2, 50);
    x.fillStyle = COL.moradoClaro; encoger(x, desc, W - 60, 26); x.fillText(desc, W / 2, 92);
    // nivel: puntos (los que este acto aún no deja, con candado)
    for (let i = 0; i < NIVEL_MAX; i++) {
      const cx = W / 2 + (i - 2) * 46, cy = 136, lleno = i < m.nivel, cerrado = i >= m.max;
      x.beginPath(); x.arc(cx, cy, 15, 0, Math.PI * 2);
      x.fillStyle = lleno ? COL.amarillo : cerrado ? '#c9c2d4' : '#ffffff'; x.fill();
      x.lineWidth = 5; x.strokeStyle = COL.tinta; x.stroke();
      if (cerrado && !lleno) { x.beginPath(); x.moveTo(cx - 8, cy + 8); x.lineTo(cx + 8, cy - 8); x.lineWidth = 4; x.stroke(); }
    }
    x.fillStyle = COL.tinta; x.font = '24px Caprasimo, serif'; x.fillText(`Nivel ${m.nivel}`, W / 2, 172);
    let banda, texto, sub = null;
    if (m.nivel >= NIVEL_MAX) { banda = COL.verde; texto = 'Al máximo'; }
    else if (m.nivel >= m.max) { banda = COL.azul; texto = 'Más adelante'; sub = 'La historia aún no deja subirla'; }
    else {
      sub = `Siguiente: ${EFECTO[m.id](m.nivel)}`;
      if (m.puede) { banda = COL.amarillo; texto = `${m.precio} monchis · ponla`; }
      else { banda = '#b9b2c2'; texto = `Te faltan ${Math.max(1, m.precio - monchis)} monchis`; }
    }
    if (sub) { x.fillStyle = COL.moradoClaro; encoger(x, sub, W - 60, 24); x.fillText(sub, W / 2, 208); }
    x.fillStyle = banda; x.beginPath(); x.roundRect(26, 236, W - 52, 62, 14); x.fill(); x.lineWidth = 6; x.strokeStyle = COL.tinta; x.stroke();
    x.fillStyle = COL.tinta; encoger(x, texto, W - 90, 36); x.fillText(texto, W / 2, 268);
    this.tTarjeta.needsUpdate = true;
  }
  _pizarra(n, e, monchis) {
    const x = this.lPizarra.getContext('2d'), W = 1024, H = 512;
    x.clearRect(0, 0, W, H);
    x.fillStyle = '#231833'; x.strokeStyle = COL.madera; x.lineWidth = 18;
    x.beginPath(); x.roundRect(10, 10, W - 20, H - 20, 26); x.fill(); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = COL.amarillo; x.font = '64px Caprasimo, serif'; x.fillText('El negocio de Unaké', W / 2, 74);
    const rango = n.siguiente ? `${n.rango} · siguiente: ${n.siguiente}` : n.rango;
    x.fillStyle = '#ffd0e6'; encoger(x, rango, W - 80, 36); x.fillText(rango, W / 2, 136);
    const cl = Math.floor(e.clientes || 0), linea = `${cl} cliente${cl === 1 ? '' : 's'}${e.aforo != null ? ` (caben ${e.aforo})` : ''} · ${coma(n.porMin || 0)} monchis/min`;
    x.fillStyle = COL.crema; encoger(x, linea, W - 80, 36); x.fillText(linea, W / 2, 192);
    // la caja
    const bx = 90, by = 230, bw = W - 180, bh = 40, f = e.tope ? Math.min(1, n.caja / e.tope) : 0;
    x.fillStyle = '#3a3046'; x.beginPath(); x.roundRect(bx, by, bw, bh, 12); x.fill();
    if (f > 0) { x.fillStyle = COL.amarillo; x.beginPath(); x.roundRect(bx, by, Math.max(24, bw * f), bh, 12); x.fill(); }
    x.strokeStyle = COL.crema; x.lineWidth = 4; x.beginPath(); x.roundRect(bx, by, bw, bh, 12); x.stroke();
    x.fillStyle = COL.tinta; x.font = '28px Caprasimo, serif';
    const tc = `Caja: ${n.caja}${e.tope ? ` / ${e.tope}` : ''}${n.bolsitas ? ` · ${n.bolsitas} bolsita${n.bolsitas > 1 ? 's' : ''}` : ''}`;
    x.fillStyle = f > 0.5 ? COL.tinta : COL.crema; x.fillText(tc, W / 2, by + bh / 2 + 1);
    // la meta
    const meta = e.meta === undefined ? null : e.meta ? `Meta: ${e.meta.texto} (+${e.meta.premio})` : '¡Todas las metas cumplidas!';
    if (meta) { x.fillStyle = COL.neon; encoger(x, meta, W - 80, 40); x.fillText(meta, W / 2, 334); }
    x.fillStyle = '#c9c2d4'; x.font = '30px Caprasimo, serif';
    x.fillText(`Por ahora, mejoras hasta nivel ${e.max} · llevas ${monchis} monchis`, W / 2, 400);
    x.fillStyle = '#8f86a3'; x.font = '26px Caprasimo, serif';
    x.fillText('Toca el bar · pon la pieza · tira de la palanca para cobrar', W / 2, 452);
    this.tPizarra.needsUpdate = true;
  }
  _pantalla(n, e) {
    const x = this.lPant.getContext('2d');
    x.fillStyle = '#10241a'; x.fillRect(0, 0, 256, 112);
    x.fillStyle = '#7ee081'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '50px Caprasimo, serif';
    x.fillText(String(n.caja), 128, 46);
    const f = e.tope ? Math.min(1, n.caja / e.tope) : 0;
    x.fillStyle = '#21452f'; x.fillRect(24, 86, 208, 14); x.fillStyle = '#7ee081'; x.fillRect(24, 86, 208 * f, 14);
    this.tPant.needsUpdate = true;
  }

  // ---------- chispas ----------
  _chispas() {
    const N = 40, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const c = lienzo(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.chispas = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), vertexColors: true, size: 0.016, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.chispas.visible = false; this.chispas.frustumCulled = false;
    this.chispas.userData = { vel: Array.from({ length: N }, () => new THREE.Vector3()), t: 0, dur: 0.8 };
    this.g.add(this.chispas);
  }
  _soltarChispas(centro, fuerte = false) {
    const h = this.chispas, pos = h.geometry.attributes.position, col = h.geometry.attributes.color, c = new THREE.Color();
    const tonos = [COL.amarillo, COL.rosa, '#ffffff', COL.neon];
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, centro.x, centro.y, centro.z); c.set(tonos[i % 4]); col.setXYZ(i, c.r, c.g, c.b);
      const a = Math.random() * Math.PI * 2, r = (fuerte ? 0.35 : 0.18) * (0.4 + Math.random());
      h.userData.vel[i].set(Math.cos(a) * r, (fuerte ? 0.5 : 0.3) + Math.random() * 0.5, Math.sin(a) * r);
    }
    pos.needsUpdate = col.needsUpdate = true; h.visible = true; h.userData.t = h.userData.dur = fuerte ? 1.4 : 0.8; h.material.opacity = 1;
  }

  // ---------- cada fotograma ----------
  actualizar(dt, manos = [this.xr.manos.derecha, this.xr.manos.izquierda]) {
    if (!this.g || !this.listo) return; // montar() es asíncrono
    this._t += dt;
    for (const k of [this.maqueta, this.cajonK, this.palancaK, this.pieza?.kit]) k?.tiempo(this._t);
    this._leerT -= dt;
    if (this._leerT <= 0) {
      this._leerT = 0.25; this._leer();
      if (this.pieza?.estado !== 'encaja') { this._rehacer(); this._piezaNueva(); }
      this._dibujar();
    }
    for (const m of manos) this._mano(m);
    this._animarPieza(dt);
    this._animarCaja(dt);
    this._animarAnillo(dt);
    const h = this.chispas;
    if (h.visible) {
      h.userData.t -= dt; const pos = h.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const v = h.userData.vel[i]; v.y -= 1.6 * dt; v.multiplyScalar(1 - 1.5 * dt); pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt); }
      pos.needsUpdate = true; h.material.opacity = Math.min(1, h.userData.t / (h.userData.dur * 0.6));
      if (h.userData.t <= 0) h.visible = false;
    }
  }

  _mano(m) {
    if (!m) return;
    let e = this.manos.get(m); if (!e) this.manos.set(m, e = { zona: null });
    const p = this.pieza;
    if (!m.activa) { if (p?.mano === m && p.estado === 'mano') this._soltar(); if (this.palanca.mano === m) this.palanca.mano = null; e.zona = null; return; }
    const sujeta = m.pinza || m.agarre, empieza = m.empiezaPinza || m.empiezaAgarre;
    if (p?.mano === m && p.estado === 'mano') { if (!sujeta) this._soltar(); return; }
    if (this.palanca.mano === m) { if (!sujeta) this.palanca.mano = null; else this._tirar(m); return; }
    if (empieza && !this.agarre?.lleva?.(m)) {
      if (p?.estado === 'bandeja' && p.crece >= 1 && this.g.localToWorld(this._centroPieza(_v)).distanceTo(m.punta) < COGER) return this._coger(m);
      if (this.palancaK.grupo.localToWorld(_v.set(0, POMO, 0)).distanceTo(m.punta) < 0.06) { this.palanca.mano = m; this.sonido('papel', { en: this.palancaK.grupo, volumen: 0.3, tono: 1.6 }); m.vibrar(0.2, 20); return; }
    }
    // tocar una parte del bar con el dedo
    const local = this.g.worldToLocal(_w.copy(m.punta));
    let zona = null, md = R_ZONA;
    for (const id of Object.keys(ZONAS)) { const d = this._zonaLocal(id, _v).distanceTo(local); if (d < md) { md = d; zona = id; } }
    if (zona && zona !== e.zona && zona !== this.sel && !(p && (p.estado === 'mano' || p.estado === 'encaja'))) {
      this.elegir(zona); this.sonido('pop', { en: this.g, volumen: 0.35, tono: 1.5 }); m.vibrar(0.25, 20);
    }
    e.zona = zona;
  }

  _coger(m) {
    const p = this.pieza, mj = this._mejora(p.id);
    if (!mj?.puede) {
      p.tiembla = 0.5; m.vibrar(0.25, 30); this.sonido('bonk', { en: p.grupo, volumen: 0.35, tono: 1.3 });
      this.ui?.cartela(mj && mj.nivel >= mj.max ? 'Esta mejora sube más adelante en la historia' : `Te faltan ${Math.max(1, (mj?.precio ?? 0) - this.motor.monchis)} monchis`, 2.2);
      return;
    }
    p.estado = 'mano'; p.mano = m; p.tiembla = 0;
    this.sonido('pop', { en: p.grupo, volumen: 0.5, tono: 1.2 }); m.vibrar(0.4, 30);
  }

  _soltar() {
    const p = this.pieza, cerca = this._zonaLocal(p.id, _w).distanceTo(this._centroPieza(_v)) < ENCAJA, mano = p.mano;
    p.mano = null;
    if (cerca) return this._comprar(mano);
    p.estado = 'vuelve'; p.t = 0; p.desde = p.grupo.position.clone(); p.escDesde = p.grupo.scale.x;
    this.sonido('fiu', { en: p.grupo, volumen: 0.3, tono: 1.4 });
  }

  _comprar(m) {
    const p = this.pieza;
    const r = this.motor.mejorar(p.id);
    if (!r?.ok) {
      p.estado = 'vuelve'; p.t = 0; p.desde = p.grupo.position.clone(); p.escDesde = p.grupo.scale.x;
      this.sonido('bonk', { en: p.grupo, volumen: 0.35, tono: 1.3 });
      this.ui?.cartela(r?.motivo === 'sin monchis' ? `Te faltan ${r.faltan ?? '?'} monchis` : r?.motivo === 'al máximo por ahora' ? 'Esta mejora sube más adelante en la historia' : 'Ahora no se puede', 2.2);
      return;
    }
    // ¡clic! encaja
    p.estado = 'encaja'; p.t = 0; p.desde = p.grupo.position.clone(); p.escDesde = p.grupo.scale.x; p.r = r;
    const destino = this._zonaLocal(p.id, new THREE.Vector3()); destino.y -= p.alto / 2; p.hasta = destino;
    m?.vibrar?.(0.8, 70);
    this.sonido('golpe', { en: p.grupo, volumen: 0.5, tono: 1.8 });
  }

  _encajado() {
    const p = this.pieza, r = p.r, mj = this._mejora(p.id), nombre = mj?.nombre || MEJORAS[p.id][0];
    this._leer(); this._rehacer(true);
    this._soltarChispas(this._zonaLocal(p.id, new THREE.Vector3()), r.metas?.length > 0);
    this.sonido('tiroriro', { en: this.g, volumen: 0.7 });
    this.sonido(p.id === 'neon' ? 'neon' : 'pop', { en: this.g, volumen: 0.5 });
    this.ui?.cartela(`${nombre}: nivel ${r.nivel}`, 2.2);
    p.kit.quitar(); p.grupo.parent?.remove(p.grupo); this.pieza = null; this._claveP = '';
    this._piezaNueva(); this._dibujar(true);
    try { this.alMejorar?.(r, { id: r.mejora, nombre }); } catch (e) { console.error(e); }
    (r.metas || []).forEach((meta, i) => setTimeout(() => {
      if (!this.g) return;
      this.sonido('oooh', { en: this.g, volumen: 0.6 }); this.sonido('campanita', { en: this.g, volumen: 0.7 });
      this._soltarChispas(new THREE.Vector3(0, Y + 0.3, -0.2), true);
      this.ui?.cartela(`Meta del negocio cumplida: ${meta.texto} · +${meta.premio} monchis`, 3.5);
      try { this.alMeta?.(meta); } catch (e) { console.error(e); }
    }, 1300 + i * 2600));
  }

  _animarPieza(dt) {
    const p = this.pieza; if (!p) return;
    const pos = p.grupo.position;
    if (p.estado === 'bandeja') {
      if (p.crece < 1) { p.crece = Math.min(1, p.crece + dt * 3); const k = p.crece; p.grupo.scale.setScalar(ESCALA_BANDEJA * (k < 1 ? k * (1 + 0.25 * Math.sin(k * Math.PI)) : 1)); }
      pos.copy(BANDEJA); p.grupo.rotation.y = Math.sin(this._t * 0.8) * 0.35;
      if (p.tiembla > 0) { p.tiembla -= dt; pos.x += Math.sin(this._t * 70) * 0.006 * Math.min(1, p.tiembla * 3); p.grupo.rotation.z = Math.sin(this._t * 55) * 0.08 * Math.min(1, p.tiembla * 3); }
      else p.grupo.rotation.z = 0;
      // gris si no te llega
      const mj = this._mejora(p.id);
      if (p.sol && p.tinte) p.sol.material.uniforms.uTinte.value.copy(p.tinte).multiplyScalar(mj?.puede ? 1 : 0.45);
    } else if (p.estado === 'mano') {
      const local = this.g.worldToLocal(_v.copy(p.mano.punta));
      const s = THREE.MathUtils.lerp(p.grupo.scale.x, 1, Math.min(1, dt * 8)); p.grupo.scale.setScalar(s);
      pos.set(local.x, local.y - p.alto * s / 2, local.z);
      p.grupo.rotation.set(0, THREE.MathUtils.lerp(p.grupo.rotation.y, 0, Math.min(1, dt * 8)), 0);
    } else {
      p.t += dt; const dur = p.estado === 'encaja' ? 0.16 : 0.35, k = Math.min(1, p.t / dur), e = k * k * (3 - 2 * k);
      const meta = p.estado === 'encaja' ? p.hasta : BANDEJA, esc = p.estado === 'encaja' ? 1 : ESCALA_BANDEJA;
      pos.lerpVectors(p.desde, meta, e); if (p.estado === 'vuelve') pos.y += Math.sin(k * Math.PI) * 0.05;
      p.grupo.scale.setScalar(THREE.MathUtils.lerp(p.escDesde, esc, e));
      if (k >= 1) { if (p.estado === 'encaja') this._encajado(); else { p.estado = 'bandeja'; p.crece = 1; } }
    }
  }

  _animarAnillo(dt) {
    const a = this.anillo, p = this.pieza;
    if (!this.sel) { a.visible = false; return; }
    a.visible = true;
    const llevando = p && (p.estado === 'mano' || p.estado === 'encaja');
    this._zonaLocal(llevando ? p.id : this.sel, a.position);
    a.lookAt(this.xr.cabeza); // mira hacia ti
    let cerca = false;
    if (llevando && p.estado === 'mano') cerca = this._zonaLocal(p.id, _w).distanceTo(this._centroPieza(_v)) < ENCAJA;
    a.material.color.set(cerca ? COL.verde : llevando ? COL.neon : COL.amarillo);
    const k = llevando ? 1 + 0.18 * Math.sin(this._t * 9) : 1 + 0.06 * Math.sin(this._t * 3);
    a.scale.setScalar(cerca ? 1.25 : k);
    a.material.opacity = llevando ? 0.95 : 0.65;
  }

  // ---------- la caja: palanca, cajón y monedas ----------
  _tirar(m) {
    const local = this.g.worldToLocal(_v.copy(m.punta)).sub(PIVOTE);
    const ang = THREE.MathUtils.clamp(Math.atan2(local.z, Math.max(0.001, local.y)), 0, 1.25);
    this.palanca.ang = ang;
    if (!this.palanca.tirada && ang > TIRADA) { this.palanca.tirada = true; this._cobrar(m); }
  }
  _cobrar(m) {
    const r = this.motor.cobrarCaja();
    if (!r?.ok) {
      this.sonido('bonk', { en: this.palancaK.grupo, volumen: 0.4, tono: 1.1 }); m.vibrar(0.3, 40);
      this.ui?.cartela('La caja está vacía: vuelve en un rato', 2.2);
      return;
    }
    this.cajon.abre = 1; this.cajon.t = 2.2;
    this.sonido('zas', { en: this.cajonK.grupo, volumen: 0.5 }); this.sonido('campanita', { en: this.cajonK.grupo, volumen: 0.8 });
    m.vibrar(0.7, 60);
    const n = Math.min(14, Math.max(3, Math.ceil((r.monchis || 0) / 10)));
    for (let i = 0; i < n; i++) this.monedas.push({ t: -i * 0.06, mano: m, gira: Math.random() * 6, desde: new THREE.Vector3(CAJA.x + (Math.random() - 0.5) * 0.08, MESA + 0.03, CAJA.z + 0.08 + (Math.random() - 0.5) * 0.05) });
    this.ui?.cartela(`+${r.monchis} monchis${r.bolsitas ? ` · +${r.bolsitas} bolsita${r.bolsitas > 1 ? 's' : ''}` : ''}${r.bono ? ` · bono del día +${r.bono}` : ''}`, 2.8);
    this._leer(); this._dibujar(true);
    try { this.alCobrar?.(r); } catch (e) { console.error(e); }
  }
  _animarCaja(dt) {
    // la palanca vuelve sola cuando la sueltas
    const pl = this.palanca;
    if (!pl.mano) { pl.ang = Math.max(0, pl.ang - dt * 5); if (pl.ang < 0.4) pl.tirada = false; }
    this.palancaK.grupo.rotation.x = pl.ang;
    // el cajón: entreabierto si hay caja, abierto al cobrar
    const caja = this.datos?.caja || 0;
    if (this.cajon.t > 0) this.cajon.t -= dt; else this.cajon.abre = caja >= 5 ? 0.35 : 0;
    const z = CAJA.z + 0.005 + this.cajon.abre * 0.075, cg = this.cajonK.grupo;
    cg.position.z += (z - cg.position.z) * Math.min(1, dt * 10);
    // monedas: montón en el cajón (cuánto se ha llenado) + las que vuelan a tu mano
    const f = this.fichas; if (!f) return;
    let n = 0;
    const fr = this.extra.tope ? Math.min(1, caja / this.extra.tope) : Math.min(1, caja / 100);
    const monton = caja >= 1 && this.cajon.t <= 0 ? Math.max(1, Math.round(fr * 8)) : 0;
    for (let i = 0; i < monton; i++) {
      _v.set(cg.position.x - 0.035 + (i % 4) * 0.023, MESA + 0.026 + Math.floor(i / 4) * 0.004, cg.position.z + 0.02 - Math.floor(i / 4) * 0.022);
      _q.setFromAxisAngle(_s.set(1, 0, 0), -Math.PI / 2);
      _m.compose(_v, _q, _s.set(1, 1, 1)); f.setMatrixAt(n++, _m);
    }
    const cab = this.g.worldToLocal(_w.copy(this.xr.cabeza)).clone();
    for (const c of [...this.monedas]) {
      c.t += dt;
      if (c.t > 0.42) { this.monedas.splice(this.monedas.indexOf(c), 1); this.sonido('lata', { volumen: 0.3, tono: 1.5 + Math.random() * 0.5 }); c.mano?.vibrar?.(0.15, 12); continue; }
      if (c.t < 0 || n >= MAX_MONEDAS) continue;
      const k = Math.min(1, c.t / 0.4), e = k * k * (3 - 2 * k);
      const meta = this.g.worldToLocal(_w.copy(c.mano.punta));
      _v.copy(c.desde).lerp(meta, e); _v.y += Math.sin(k * Math.PI) * 0.12;
      _m.lookAt(cab, _v, _arriba); _q.setFromRotationMatrix(_m);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(_arriba, c.gira + c.t * 12));
      _m.compose(_v, _q, _s.setScalar(1 - 0.4 * e)); f.setMatrixAt(n++, _m);
    }
    f.count = n; f.instanceMatrix.needsUpdate = true;
  }

  // ---------- para bots y app.js ----------
  estado() {
    if (!this.g) return null;
    const p = this.pieza, W = v => this.g.localToWorld(v.clone());
    return {
      sel: this.sel, niveles: this.datos ? this._niveles() : {}, caja: this.datos?.caja, monchis: this.motor.monchis,
      zonas: Object.fromEntries(Object.keys(ZONAS).map(id => [id, W(this._zonaLocal(id))])),
      pieza: p ? { id: p.id, estado: p.estado, pos: W(this._centroPieza(new THREE.Vector3())) } : null,
      pomo: this.palancaK ? this.palancaK.grupo.localToWorld(new THREE.Vector3(0, POMO, 0)) : null,
      palanca: this.palanca.ang, monedas: this.monedas.length, clientes: Math.floor(this.extra.clientes || 0),
    };
  }

  quitar() {
    if (!this.g) return;
    this.maqueta?.quitar(); this.cajonK?.quitar(); this.palancaK?.quitar(); this.pieza?.kit.quitar();
    this.g.parent?.remove(this.g);
    // la ficha monchi es de textura() (caché compartida): solo se sueltan los lienzos propios
    this.g.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); if (o.material) { if (o.material.map?.isCanvasTexture) o.material.map.dispose(); o.material.dispose(); } } });
    this.g = null; this.pieza = null; this.maqueta = null; this.monedas = []; this.manos.clear(); this.listo = false;
  }
}
