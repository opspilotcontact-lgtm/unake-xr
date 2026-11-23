// La historia y la economía del 2D, VIVAS, sin copiar nada: se leen del iframe del puente (js/puente/puente.js),
// que ya carga todos los scripts de base/ (salvo main.js y tactil.js) en su orden y sin tocarlos.
//
// Decisión (director, 23/11): el 2D es el MOTOR ÚNICO de datos y economía. Su `ESTADO` ES la partida del XR:
// el puente se crea con `clavePartida: 'unake-xr-partida'`, así que el `guardarPartida()` del 2D escribe ahí
// (y su 'unake-partida' nunca se lee ni se pisa). Los objetivos `hecho()` del 2D, `apuntar()`, `cuentasNegocio()`,
// `completarSituacion()`… se ejecutan dentro del iframe sobre ese ESTADO, tal cual.
// Lo que NO se puede usar del 2D es lo que vive en métodos de la escena `Barrio` (que el puente no arranca):
// el bucle de la historia (historia(), tareaTick(), completarCapitulo()), el cobro de mostrarPanelFinal (que pinta
// el panel), la tienda, comer, liar, la boquilla y el negocio de su ventana. Eso lo repite el motor (motor.js)
// línea a línea con las constantes y funciones de aquí, y cada trozo dice de qué método del 2D sale.
//
// ---------- Qué se usa del 2D (todo global del iframe) ----------
// historia.js     CAPITULOS, META_HUCHA, nuevaTarea, tareaCumplida, recogerDeTarea, conDeTarea, quienDicePista,
//                 textoPista, progresoTarea, mundoDeTarea, objetoDeTarea, OBJETOS_RECADO, normalizarCapitulo,
//                 capIdx, sumarStat, stat, desdeCap
// numeracion.js   etiquetaCap, totalCapitulos            situaciones.js  SITUACIONES, nuevaSituacion, completarSituacion
// comun.js        ESTADO, ESTADO_INICIAL, guardarPartida, MISIONES, estrellasDe, apuntar, PAGO_ESTRELLAS,
//                 vecesSeguidas, multiplicadorRepeticion, apuntarRepeticion, enMundoHumo, UMBRAL_HUMO, INVENTOS
// negocio.js      negocio, cuentasNegocio, actualizarNegocio, MEJORAS_NEGOCIO, precioMejora, nivelNegocio,
//                 nivelMaxPorCapitulo, METAS_NEGOCIO, bonoDeco, rangoSiguiente
// armario.js      bonoArmario           lugares.js  aplicarModPartida
// escenas/barrio.js  TIENDA, PRECIO_BOLSITA, SALAS_BOQUILLA (constantes de su cabecera)
// charlas_capitulo.js CHARLAS_CAP · noches.js NOCHES · escena_comic.js FONDO_CAPITULO, CARTELAS · contenido/capitulos.js CONTENIDO_CAPITULOS
//
// Campos de cada capítulo (CAPITULOS[i]) que usa el XR:
//   id, titulo, arte (→ base/assets/img/<arte>.jpg), intro, cierre, posCierre {opciones, lineas}, premio, final,
//   alEmpezar (cap. «caja»: falta dinero de la hucha), situaciones [[personaje, plantilla]…],
//   objetivos [{texto, hecho(), progreso()}]          (capítulos «viejos»: todos a la vez)
//   tareas [{id, texto, tipo, minijuego, cumple, multa, recoger, objeto, con, pistaDe, pista, antes, despues,
//            mundoEscena, fondoEscena, escena}], giroTras, giro   (capítulos nuevos: de una en una)
// Líneas: ['quien', 'texto']; quien = personaje, 'narrador', 'titulo' (cartela) u 'objetivos' (enseñar los objetivos).

export const CLAVE_PARTIDA = 'unake-xr-partida';

const NOMBRES = [
  'CAPITULOS', 'META_HUCHA', 'OBJETOS_RECADO', 'CHARLAS_CAP', 'DIALOGOS_CAP', 'CONTENIDO_CAPITULOS', 'SITUACIONES', 'NOCHES',
  'FONDO_CAPITULO', 'CARTELAS', 'ESTADO_INICIAL', 'MISIONES', 'PAGO_ESTRELLAS', 'UMBRAL_HUMO', 'INVENTOS',
  'MEJORAS_NEGOCIO', 'METAS_NEGOCIO', 'TIENDA', 'PRECIO_BOLSITA', 'SALAS_BOQUILLA',
  'nuevaTarea', 'tareaCumplida', 'recogerDeTarea', 'conDeTarea', 'quienDicePista', 'textoPista', 'progresoTarea',
  'mundoDeTarea', 'objetoDeTarea', 'normalizarCapitulo', 'capIdx', 'sumarStat', 'stat', 'desdeCap', 'etiquetaCap',
  'totalCapitulos', 'nuevaSituacion', 'completarSituacion', 'estrellasDe', 'apuntar', 'vecesSeguidas',
  'multiplicadorRepeticion', 'apuntarRepeticion', 'enMundoHumo', 'negocio', 'cuentasNegocio', 'actualizarNegocio',
  'precioMejora', 'nivelNegocio', 'nivelMaxPorCapitulo', 'rangoSiguiente', 'bonoDeco', 'bonoArmario',
  'aplicarModPartida', 'guardarPartida',
];

// Crea (o reutiliza) el puente y devuelve los datos vivos del 2D. `puente`: uno ya creado CON clavePartida.
export async function cargarDatos({ puente = null, opcionesPuente = {} } = {}) {
  let p = puente;
  if (!p) {
    const { crearPuente } = await import('../puente/puente.js');
    p = await crearPuente({ ancho: 1280, alto: 720, fpsMax: 45, ...opcionesPuente, clavePartida: CLAVE_PARTIDA });
  }
  if ((p.op && p.op.clavePartida) !== CLAVE_PARTIDA) console.warn('[historia] el puente no guarda en', CLAVE_PARTIDA, ': la partida del XR no se guardará');
  const d = { puente: p };
  // const/let/function del 2D son globales del iframe: eval indirecta (p.ev) los ve todos.
  for (const n of NOMBRES) {
    try { d[n] = p.ev(n); } catch (e) { throw new Error(`[historia] el 2D ya no tiene «${n}»: ${e.message}`); }
  }
  // El ESTADO se lee SIEMPRE en el momento: el 2D puede reasignarlo (nueva partida).
  d.estado = () => p.ev('ESTADO');
  d.reemplazarEstado = obj => { p.win.__estadoNuevo = obj; p.ev('ESTADO = window.__estadoNuevo; delete window.__estadoNuevo;'); };
  d.partidaNueva = () => p.ev('structuredClone(ESTADO_INICIAL)');
  return d;
}
