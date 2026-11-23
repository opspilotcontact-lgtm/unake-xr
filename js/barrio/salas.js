// Las salas del barrio (base/js/escenas/barrio.js → SALAS) en 3D, cada una en sus dos mundos:
//   humo = de noche (bg-*.jpg, o el fondo limpio de las capas de la serie + sus muebles de cartón);
//   normal = de día (bgn-*.jpg).
// Se montan con js/barrio/proyeccion.js. Medidas sacadas sobre la rejilla (herramientas/rejilla.py,
// fotos en herramientas/pruebas/fotos/grid-*.jpg) y repasadas con fotos desde el ojo y de lado
// (herramientas/pruebas/barrio.mjs).
//
// Cada mundo: { tipo, url, mini, W, H, fuga, fondo | tramos, bastidores, piezas, ojo, fov, pared, baldosa, junta,
// losa, cielo, sitios }.  `sitios`: dónde pisa cada personaje en el dibujo (px), para la maqueta y la sala.
// `mini`: la miniatura de la maqueta (otra imagen, mismas medidas relativas: va escalada a su ancho).
import { SALA_DENTRO } from '../decorado.js';

const F = 'assets/escenarios/barrio/fondos/', MINI = 'assets/escenarios/barrio/mini/', CAPAS = 'assets/escenarios/barrio/capas/';
const K = 1376 / 1280; // capas de la serie (1376×768) frente a los bg del 2D (1280×714)

// medidas tomadas sobre un bg de 1280 y llevadas a otra imagen del mismo encuadre
const xk = (k, o) => Object.fromEntries(Object.entries(o).map(([n, v]) => [n, typeof v === 'number' ? v * k : v]));

// ---------- el barrio ----------
// Conexiones del 2D: la calle (cuarto ↔ plaza ↔ fuera ↔ tienda ↔ feria) y Unaké por dentro
// (fuera → dentro ↔ cocina ↔ reservado ↔ baño; del reservado se sube al techo).
export const SALAS = {
  cuarto: {
    nombre: 'El cuarto de Vuper', der: 'plaza',
    humo: {
      tipo: 'caja', url: F + 'bg-cuarto.webp', mini: MINI + 'bg-cuarto.webp', W: 1280, H: 896,
      fuga: [645, 400], fondo: { x0: 340, x1: 920, y0: 215, suelo: 590 }, ojo: 1.2,
      pared: '#2a2440', baldosa: '#3b3046', losa: 0, cielo: '#141022',
      sitios: { vuper: [640, 700] },
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-cuarto.webp', mini: MINI + 'bgn-cuarto.webp', W: 1280, H: 714,
      fuga: [630, 330], fondo: { x0: 300, x1: 945, y0: 135, suelo: 515 }, ojo: 1.2,
      pared: '#d6cec2', baldosa: '#c09868', losa: 0, cielo: '#e6dfd2',
      sitios: { vuper: [650, 600] },
    },
  },
  plaza: {
    nombre: 'La plaza', izq: 'cuarto', der: 'fuera',
    humo: {
      // fondo limpio de la serie + banco, farola y contenedor de cartón
      tipo: 'telon', url: CAPAS + 'plaza-banco-fondo.webp', mini: MINI + 'bg-plaza.webp', miniW: 1280, miniH: 714, W: 1376, H: 768,
      fuga: [520 * K, 415 * K], tramos: [{ x0: 0, x1: 1376, suelo: 458 * K }], ojo: 1.1, miniX: [200 * K, 1180 * K],
      piezas: [
        { url: CAPAS + 'plaza-banco-banco.webp', x: 894, y: 680, alto: 185 },
        { url: CAPAS + 'plaza-banco-farola.webp', x: 1157, y: 652, alto: 506 },
        { url: CAPAS + 'plaza-banco-contenedor.webp', x: 185, y: 768, alto: 333 },
      ],
      pared: '#3a3050', baldosa: '#5a4e62', cielo: '#2e2748',
      sitios: { blancaso: [900 * K, 600 * K], niebla: [600 * K, 615 * K] },
      visita: [700 * K, 610 * K],
    },
    normal: {
      tipo: 'telon', url: F + 'bgn-plaza.webp', mini: MINI + 'bgn-plaza.webp', W: 1280, H: 714,
      fuga: [520, 415], tramos: [{ x0: 0, x1: 1280, suelo: 458 }], ojo: 1.1, miniX: [200, 1180],
      bastidores: [{ x0: 616, x1: 1032, y0: 455, suelo: 628 }],
      pared: '#9c8c78', baldosa: '#c9c2b4', cielo: '#a9cbe6',
      sitios: { blancaso: [820, 640], niebla: [560, 650] },
      visita: [700, 640],
    },
  },
  fuera: {
    nombre: 'La puerta de Unaké', izq: 'plaza', der: 'tienda', puerta: 'dentro',
    humo: {
      // la fachada (cerca) y la calle que se va a la izquierda (más lejos), con la esquina del edificio
      tipo: 'telon', url: F + 'bg-fuera.webp', mini: MINI + 'bg-fuera.webp', W: 1024, H: 1024,
      fuga: [400, 460], ojo: 1.3, miniX: [200, 1024],
      tramos: [{ x0: 0, x1: 470, suelo: 600 }, { x0: 440, x1: 1024, suelo: 705, canto: { suelo: 600, lado: 'izq' } }],
      pared: '#1c2238', baldosa: '#3a4050', cielo: '#16203a',
      sitios: { perico: [700, 760] },
      visita: [560, 820],
    },
    normal: {
      tipo: 'telon', url: F + 'bgn-fuera.webp', mini: MINI + 'bgn-fuera.webp', W: 1280, H: 714,
      fuga: [560, 400], ojo: 1.15, miniX: [300, 1280],
      tramos: [{ x0: 0, x1: 600, suelo: 470 }, { x0: 570, x1: 1280, suelo: 605, canto: { suelo: 470, lado: 'izq' } }],
      pared: '#b89870', baldosa: '#cfcac0', cielo: '#b8d4ea',
      sitios: { perico: [650, 662] },
      visita: [460, 640],
    },
  },
  tienda: {
    nombre: 'La tienda de 24 h', izq: 'fuera', der: 'feria',
    humo: {
      tipo: 'caja', url: F + 'bg-tienda.webp', mini: MINI + 'bg-tienda.webp', W: 1280, H: 714,
      fuga: [610, 300], fondo: { x0: 400, x1: 815, y0: 150, suelo: 400 }, ojo: 1.2,
      bastidores: [{ x0: 365, x1: 975, y0: 420, suelo: 590 }],
      pared: '#2c2a48', baldosa: '#6a6a88', junta: '#46445e', cielo: '#141022',
      sitios: {}, visita: [520, 660],
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-tienda.webp', mini: MINI + 'bgn-tienda.webp', W: 1280, H: 714,
      fuga: [615, 300], fondo: { x0: 400, x1: 820, y0: 150, suelo: 405 }, ojo: 1.2,
      bastidores: [{ x0: 360, x1: 985, y0: 420, suelo: 578 }],
      pared: '#d8cbb0', baldosa: '#e0dcd2', junta: '#bdb8ac', cielo: '#e6dfd2',
      sitios: {}, visita: [520, 650],
    },
  },
  feria: {
    nombre: 'La feria (el descampado)', izq: 'tienda',
    humo: {
      tipo: 'telon', url: F + 'bg-feria.webp', mini: MINI + 'bg-feria.webp', W: 1280, H: 714,
      fuga: [640, 447], tramos: [{ x0: 0, x1: 1280, suelo: 498 }], ojo: 1.3, miniX: [60, 1220],
      bastidores: [{ x0: 48, x1: 332, y0: 240, suelo: 526 }, { x0: 330, x1: 546, y0: 288, suelo: 516 }],
      pared: '#3a3050', baldosa: '#5a4a48', cielo: '#2a2240',
      sitios: {}, visita: [640, 620],
    },
    normal: {
      tipo: 'telon', url: F + 'bgn-feria.webp', mini: MINI + 'bgn-feria.webp', W: 1280, H: 714,
      fuga: [640, 392], tramos: [{ x0: 0, x1: 1280, suelo: 432 }], ojo: 1.2, miniX: [80, 1200],
      bastidores: [{ x0: 105, x1: 475, y0: 190, suelo: 495 }],
      pared: '#8a7868', baldosa: '#c8b08a', cielo: '#b9d3ea',
      sitios: {}, visita: [640, 600],
    },
  },
  dentro: {
    nombre: 'Unaké', izq: 'fuera', der: 'cocina',
    humo: {
      // la sala de F0 (SALA_DENTRO) con sus muebles de la serie
      ...SALA_DENTRO, tipo: 'caja', mini: MINI + 'bg-dentro.webp', miniW: 1280, miniH: 669, cielo: '#231a33',
      piezas: [
        { url: CAPAS + 'unake-dentro-barra.webp', x: 689, y: 572, alto: 142 },
        ...[[433, 585], [516, 588], [605, 590], [685, 591], [771, 590], [862, 588], [947, 585]].map(([x, y], i) => (
          { url: CAPAS + `unake-dentro-taburete-${i + 1}.webp`, x, y, alto: 120, canto: false })),
        { url: CAPAS + 'unake-dentro-mesa.webp', x: 463, y: 728, alto: 118 },
        { url: CAPAS + 'unake-dentro-mesa-2.webp', x: 917, y: 728, alto: 124 },
        { url: CAPAS + 'unake-dentro-sofa.webp', x: 177, y: 725, alto: 257 },
        { url: CAPAS + 'unake-dentro-sofa-2.webp', x: 1231, y: 736, alto: 266 },
      ],
      // palicaso detrás de la barra; la Pompa flota (se sube 1 m); Lasslow junto a la vitrina
      sitios: { palicaso: [704, 520], 'la-pompa': [960, 560, 1.0], lasslow: [1245, 654] },
      visita: [560, 650],
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-dentro.webp', mini: MINI + 'bgn-dentro.webp', W: 1280, H: 669,
      fuga: [645, 330], fondo: { x0: 365, x1: 925, y0: 118, suelo: 440 }, ojo: 1.2,
      bastidores: [{ x0: 352, x1: 942, y0: 392, suelo: 506 }],
      pared: '#d9c7a8', baldosa: '#b89a78', junta: '#8a6e52', cielo: '#e6dfd2',
      sitios: { palicaso: [640, 470], 'la-pompa': [860, 525], lasslow: [540, 545] },
      visita: [560, 600],
    },
  },
  cocina: {
    nombre: 'La cocina de Cotine', izq: 'dentro', der: 'reservado',
    humo: {
      tipo: 'caja', url: CAPAS + 'unake-cocina-fondo.webp', mini: MINI + 'bg-cocina.webp', miniW: 1280, miniH: 714, W: 1376, H: 768,
      fuga: [620 * K, 345 * K], fondo: xk(K, { x0: 350, x1: 890, y0: 130, suelo: 495 }), ojo: 1.2,
      piezas: [
        { url: CAPAS + 'unake-cocina-encimera.webp', x: 532, y: 668, alto: 292 },
        { url: CAPAS + 'unake-cocina-sofa-izq.webp', x: 76, y: 850, alto: 330 },
        { url: CAPAS + 'unake-cocina-sofa-der.webp', x: 1391, y: 908, alto: 330 },
        { url: CAPAS + 'unake-cocina-taburete.webp', x: 1183, y: 760, alto: 163, canto: false },
      ],
      pared: '#3e2f58', baldosa: '#8c86a8', junta: '#4a4466', losa: 0.45, cielo: '#141022',
      sitios: { cotine: [880 * K, 600 * K] }, visita: [900 * K, 620 * K],
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-cocina.webp', mini: MINI + 'bgn-cocina.webp', W: 1280, H: 714,
      fuga: [620, 345], fondo: { x0: 350, x1: 890, y0: 130, suelo: 495 }, ojo: 1.2,
      bastidores: [{ x0: 145, x1: 848, y0: 415, suelo: 602 }],
      pared: '#cfc8bf', baldosa: '#d8d8d8', junta: '#9a9a9a', losa: 0.45, cielo: '#e6dfd2',
      sitios: { cotine: [880, 600] }, visita: [900, 620],
    },
  },
  reservado: {
    nombre: 'El reservado', izq: 'cocina', der: 'bano', sube: 'techo',
    humo: {
      tipo: 'caja', url: CAPAS + 'unake-sofa-fondo.webp', mini: MINI + 'bg-sofa.webp', miniW: 1280, miniH: 714, W: 1376, H: 768,
      fuga: [640 * K, 430 * K], fondo: xk(K, { x0: 290, x1: 1135, y0: 270, suelo: 490 }), ojo: 0.9,
      piezas: [{ url: 'assets/escenarios/sofa.webp', x: 690, y: 695, alto: 262 }],
      pared: '#2e2a4a', baldosa: '#4e4a6c', junta: '#34304c', losa: 0.6, cielo: '#141022',
      sitios: {}, visita: [450 * K, 640 * K],
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-sofa.webp', mini: MINI + 'bgn-sofa.webp', W: 1280, H: 714,
      fuga: [640, 430], fondo: { x0: 290, x1: 1135, y0: 270, suelo: 490 }, ojo: 0.9,
      bastidores: [{ x0: 312, x1: 968, y0: 402, suelo: 642 }],
      pared: '#d8d4cc', baldosa: '#e2ded6', junta: '#c4c0b8', losa: 0.6, cielo: '#e6dfd2',
      sitios: {}, visita: [450, 660],
    },
  },
  bano: {
    nombre: 'Los baños de Unaké', izq: 'reservado',
    humo: {
      tipo: 'caja', url: F + 'bg-bano.webp', mini: MINI + 'bg-bano.webp', W: 1280, H: 714,
      fuga: [640, 400], fondo: { x0: 410, x1: 875, y0: 50, suelo: 540 }, ojo: 1.2,
      pared: '#244444', baldosa: '#4a3a58', junta: '#2e2438', losa: 0.4, cielo: '#141022',
      sitios: { puky: [1000, 680] }, visita: [640, 640],
    },
    normal: {
      tipo: 'caja', url: F + 'bgn-bano.webp', mini: MINI + 'bgn-bano.webp', W: 1280, H: 714,
      fuga: [640, 400], fondo: { x0: 410, x1: 875, y0: 50, suelo: 540 }, ojo: 1.2,
      pared: '#cfe0e0', baldosa: '#e6ecec', junta: '#c0c8c8', losa: 0.4, cielo: '#e6dfd2',
      sitios: {}, visita: [640, 640],
    },
  },
  techo: {
    nombre: 'El techo de la Pompa', baja: 'reservado',
    // pintado mirando hacia arriba: cúpula alrededor de ti. Solo existe de noche (en el 2D, de día es el mismo).
    humo: {
      tipo: 'cupula', url: F + 'bg-techo.webp', mini: MINI + 'bg-techo.webp', W: 1280, H: 714,
      fuga: [640, 357], pitch: 38, radio: 3.6, ojo: 1.2,
      pared: '#2a2448', baldosa: '#262040', cielo: '#141022',
      sitios: {}, visita: [640, 640],
    },
  },
};
SALAS.techo.normal = SALAS.techo.humo;

// las salas de la calle y las de dentro de Unaké (para la maqueta)
export const CALLE = ['cuarto', 'plaza', 'fuera', 'tienda', 'feria'];
export const DENTRO = ['dentro', 'cocina', 'reservado', 'bano'];

// quién vive en cada sala (el paradero de casa, como casaDe() en base/js/rutinas.js)
export const CASAS = {
  blancaso: 'plaza', perico: 'fuera', palicaso: 'dentro', 'la-pompa': 'dentro', lasslow: 'dentro',
  cotine: 'cocina', puky: 'bano',
};
// los que salen de visita en el 2D (rutinas.js → VISITANTES); Puky solo existe en el humo
export const VISITANTES = ['cotine', 'lasslow', 'blancaso', 'puky'];
export const SOLO_HUMO = ['puky'];

export function mundoDe(id, mundo) {
  const s = SALAS[id]; if (!s) throw new Error('No hay sala ' + id);
  return { id, nombre: s.nombre, ...(s[mundo] || s.humo) };
}
