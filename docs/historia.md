# Motor de historia y economía (F1)

> Archivos: `js/historia/datos.js`, `motor.js`, `escenas.js`, `muneca.js`, `pagina.js` · página de prueba `historia.html` · prueba `herramientas/pruebas/historia.mjs`.
> Nada de `base/` se toca. Lore nuevo = PROPUESTA (está marcado donde lo hay).

## 1. Diseño

**El 2D es el motor único de datos y reglas.** El puente (`js/puente/puente.js`) ya carga todos los scripts de `base/` en un iframe aislado del mismo origen.

- `datos.js` lee de ese iframe:
  - los datos: `CAPITULOS`, `SITUACIONES`, `TIENDA`, `MEJORAS_NEGOCIO`…;
  - las funciones puras: `tareaCumplida`, `recogerDeTarea`, `conDeTarea`, `apuntar`, `estrellasDe`, `cuentasNegocio`, `completarSituacion`…;
  - y su `ESTADO`.
- **Ese `ESTADO` ES la partida del XR.** El puente se crea con la opción nueva `clavePartida: 'unake-xr-partida'` (compatible: por defecto sigue siendo `'unake-xr-puente'`). Así el `guardarPartida()` del 2D escribe en `localStorage['unake-xr-partida']`, y la partida del juego web (`'unake-partida'`) ni se lee ni se pisa (la prueba lo comprueba con una partida centinela).
- Los `hecho()` de los objetivos del 2D se evalúan **tal cual** contra esa partida.
- **Lo que NO se puede llamar del 2D** es lo que vive en métodos de la escena `Barrio`, que el puente no arranca:
  - el bucle de la historia: `historia()`, `tareaTick()`, `completarCapitulo()`;
  - el cobro de `mostrarPanelFinal` (pinta el panel);
  - la tienda, `comer`, liar, la boquilla y el negocio de su ventana.

  `motor.js` repite esos trozos línea a línea con las constantes y funciones del 2D, y cada uno dice de qué método sale. No se ha reinventado ninguna regla.
- El XR añade a la partida solo campos nuevos: `hechos`, `saltados`, `cierreDe`, `ultimoAvance`, `porroContado`, `mundoXR`. El 2D los ignora y los guarda con lo suyo.

### Flujo de un capítulo (igual que el 2D)

1. **Intro**: viñeta del capítulo, sus líneas y, desde el cap. 2, «Lo que toca».
2. Al acabar la intro:
   - se toma la foto de contadores (`baseCap`);
   - se ejecuta `alEmpezar` (la caja: desaparece hasta 150 de la hucha);
   - se crean las situaciones del capítulo con `nuevaSituacion` del 2D. En el XR quedan esperando su minijuego (el paso de recoger por el barrio se salta).
3. **Capítulos de objetivos** (1, 2, 4, 6, 8, 10, 14, 16): todos a la vez. Uno cumplido se queda cumplido.
   - Ojo: en el 2D se reevalúan todos a la vez, y una hucha que baja deshacía uno.
4. **Capítulos de tareas** (3, 5, 7, 9, 11, 12·I, 12·II, 13, 15): de una en una. Cada tarea va así:
   - escena `antes`;
   - la tarea, activa;
   - se cumple;
   - escena `despues`;
   - el `giro`, cuando toca (`giroTras`).
5. **Cierre**: el momento persona y el último chiste. Luego los poscréditos (cap. 1), `premio` y el capítulo siguiente. Tras «La noche épica», modo libre.

### Escenas en VR (`escenas.js`)

- **La viñeta.** El arte `base/assets/img/cap-*.jpg`, de pie en tu sala:
  - a 2,4 m, de 2 m de ancho;
  - marco de tinta, papel y dos patas de cartón;
  - el título en cartela amarilla encima;
  - en las escenas de tarea (antes, después, giro), que no traen arte propio, la viñeta es la sala del capítulo:
    - sale de `FONDO_CAPITULO`, o de `fondoEscena` (el recuerdo);
    - usa `bg-*.jpg` de noche y `bgn-*.jpg` de día.
- **Quien habla.** De pie en arco a tu alrededor, de 42° hacia fuera (para no tapar la viñeta), con su bocadillo. **Una voz a la vez.**
  - Con recortable horneado: Lasslow, Blancaso, Perico, Pompa, Palicaso, Puky y Cotine.
  - Los demás (Mirón, Niebla, casero, agente, Monchiman), en cartón plano con su dibujo del 2D (`base/assets/img`).
- **El narrador**, en cartucho amarillo sobre la esquina de la viñeta.
- **Vuper eres tú.** Lo que dices sale en un bocadillo bajo con «Tú»; lo que piensas (entre paréntesis), en nube de pensamiento.
- **Momento persona** (narrador con «se le limpian los ojos»): la viñeta se apaga un poco y sale un halo cálido detrás de quien se nombra.
- **Último chiste del cierre**: rebote y `tiroriro`.
- **Cierre**: «+N monchis».
- **Cómo se pasa**: con un pellizco o el gatillo (cualquier mano). Sin tocar nada, avanza solo a ritmo de lectura (×1,6 + 1 s).
- **Confort**: la escena se queda quieta en el mundo donde empezó. Nada sigue a la cabeza.
- **Recortables prestados**: Lasslow y Blancaso del director se usan en la escena y se devuelven a su sitio.

### Muñeca (`muneca.js`) y dónde va cada cosa

- **El colocón** de `ui.js` no se toca: dorso de la muñeca izquierda, `(0, 0.035, 0.05)`. Se toca para abrir el menú.
- **Los objetivos** van en la **misma cara, más arriba del antebrazo** (grupo en `z = 0.13`), como la correa del reloj. Al mirar el reloj se ve, de los dedos al codo:
  - el colocón;
  - la **banda dorada** (el objetivo de la historia, con su progreso y su botón «toca: …»);
  - el resto: como mucho 2 líneas apagadas (lo que falta de la historia y lo opcional: hucha, caja del bar), el capítulo y tus monchis.
- La banda queda a ~6 cm del colocón (el colocón reacciona a < 4,5 cm): **tocarla no abre el menú**.
- **Tocar**:
  - con la muñeca plegada, se despliega;
  - la banda dorada: su botón (`alPulsar`);
  - el resto: se pliega.
- Se despliega sola 5-6 s al cambiar de objetivo o empezar capítulo; luego se pliega.

## 2. Tabla de equivalencias

`como`:
- **gafas**: lo hace el XR de serie o el motor;
- **nativo**: minijuego VR;
- **recreativa**: el 2D por el puente;
- **barrio**: entrar en la sala del barrio XR cuenta como hablar con quien vive allí, recoger lo que hay o comprar el recado;
- **equivalente**: otro camino que cuenta igual;
- **pendiente**: sin equivalente. El botón ofrece **«Seguir la historia»** (`motor.saltar()`), que lo da por hecho. Nunca bloquea.

### Capítulos de objetivos

| Cap. | Objetivo del 2D | En el XR | Cómo |
|---|---|---|---|
| 1 ¿Una qué? | Encargo de la tienda de 24 h | Gana cualquier minijuego (o `entrega`) | equivalente |
| | Entra en Unaké | `avisar('puerta')` (o el primer humo) | gafas |
| | Lía y fuma | `avisar('calada')` tras `liar` | gafas |
| 2 La cuota | Se acaba el género | Barra (situación `genero`, sin buscar cajas) | recreativa |
| | Tarta, 1 estrella | Tarta | recreativa |
| | Una mejora del negocio | `motor.mejorar()` al precio del 2D | gafas |
| | Hucha 100 | `hacer({tipo:'hucha'})` | gafas |
| 4 El blancazo | Pásale el porro a Blancaso | `avisar('pase', {a:'blancaso'})` | gafas |
| | Salva a Blancaso de Puky | Blancazo | recreativa |
| 6 Un señor | Pajarita y cena | Lasslow (situación `pajarita`) | recreativa |
| | Facturas | Cuentas (situación `facturas`) | recreativa |
| | Un invento | `motor.comprarInvento()` (el más barato, 240) | gafas |
| | Negocio nivel 5 | Mejoras + caja | gafas |
| | Hucha 300 | Hucha | gafas |
| 8 La caja | Gana «La caja no cuadra» | Cuentas | recreativa |
| | Pregúntale a Perico | Entrar en `fuera` (Perico) → `pistaCaja` | barrio |
| | El farol | Farol | recreativa |
| 10 Perico lo sabe | ¡Periquito! | Periquito | recreativa |
| | Apuesta de pipas | Pipas | **nativo** |
| | De día, Perico a solas | Entrar en `fuera` de día → `secretoPerico` | barrio |
| | Hucha 500 | Hucha | gafas |
| 14 La inspección | Discos (Sigilo) | Sigilo | recreativa |
| | Inspección | Inspeccion | recreativa |
| | Rescate | Rescate | recreativa |
| | Negocio nivel 20 | Mejoras + caja | gafas |
| | Hucha 750 | Hucha | gafas |
| 16 La noche épica | Tarta esta noche | Tarta | recreativa |
| | Hucha 1000 | Hucha | gafas |

### Capítulos de tareas (por tipo; la tabla sale de `equivTarea`)

| Tipo del 2D | En el XR |
|---|---|
| `minijuego` X | Nativo si existe (Pipas, TiroPato); si no, la recreativa (22 del puente); si no, **pendiente** |
| `charla` / `dia` | Entrar en la sala del barrio de quien toca (`CASAS`; con «de día»/«de noche», en ese mundo) o `avisar('hablar', {con})` |
| `recoger` | Entrar en las salas donde están (`recogerDeTarea`): se coge todo lo de esa sala |
| `recado` | Entrar en la tienda: se compra al precio de `OBJETOS_RECADO` (sin monchis, la pista dice cuánto falta) |
| `flashback` | Sin minijuego: se cuenta y pasa solo |

Pendientes hoy (ofrecen «Seguir la historia»):
- **Furgo** (11: conducir y aparcar);
- **Control** (11);
- **Casetas** (12·I);
- **Amarillo** (15).

Niebla y el Mirón aún no tienen sala en el XR: PROPUESTA, la plaza.

### Qué capítulos quedan jugables enteros en el XR hoy

- **Enteros** (con recreativa, nativo, barrio y gafas): 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12·II, 13, 14 y 16.
  - Dependen del **puente** (la recreativa): 2, 3, 4, 5, 6, 7, 8, 9, 10, 12·II, 13, 14, 15 y 16.
  - Solo el **1** no lo necesita.
- **Con algún «Seguir la historia»**:
  - **11 La furgo**: 3 de sus 4 tareas;
  - **12·I Algodón de feria**: las casetas;
  - **15 Monchiman, el pesado**: el amarillo.

  Se acaban igual, pero esas tareas no se juegan.
- **Cumplido por equivalencia** (se juega otra cosa):
  - el encargo de la tienda (cap. 1);
  - las situaciones: el paso de recoger por el barrio se salta.

## 3. Economía (la del 2D, tal cual)

| Qué | Regla (archivo del 2D) |
|---|---|
| **Minijuego ganado** | `PAGO_ESTRELLAS[estrellas]` = 15 / 35 / 60 / 100 (`comun.js`, `mostrarPanelFinal`) |
| Minijuego perdido | `min(10, puntos / divisor)`: migajas |
| De noche (colocón ≥ 30) | ×1,5 |
| El mismo seguido | ×1 / 0,75 / 0,5 / 0,3 (`PAGO_REPETIDO`; se olvida a los 6 min) |
| Bonos | decoración y armario (`bonoDeco('pago')`, `bonoArmario('pago')`), noche especial del sitio (`aplicarModPartida`) |
| `apuntar()` | récord, estrellas (+20 por estrella nueva), nivel del minijuego (`premioNivel`: 35, 50, 65, 75, 85…) |
| Situación de historia | `completarSituacion`: su premio sorteado (monchis, hucha, bolsitas, papel…) al ganar su minijuego |
| Premio de capítulo | 30, 40, 0, 60, 0, 80, 0, 90, 0, 100, 110, 115, 120, 125, 120, 130, 0 |
| **Hucha** | Se aporta de tus monchis hasta 1.000 (`hucha()` de Blancaso). «La caja» se lleva hasta 150 |
| **Tienda de 24 h** (`TIENDA`) | Comida (se come en el momento): ver la lista de abajo |
| | Para liar: **papel** 8 · **mechero** 15 (para siempre) |
| **Bolsita** | 30 (Palicaso, en la barra; `PRECIO_BOLSITA`). La máquina de bolsitas del negocio también las fabrica |
| **Liar** | Hace falta papel + boquilla + bolsita + mechero. Se gastan papel, boquilla y bolsita |
| **Boquilla** | Brilla en una sala (`SALAS_BOQUILLA`: cuarto, plaza, fuera, tienda, cocina). Al entrar en ella, +2 |
| **Hambre y vida** (`tiempos`) | El hambre sube `0,15 + colocón·0,006` por segundo. Con ≥ 85, la vida baja 1,8/s; con < 50, sube 0,4/s |
| **Amarillo** | Con vida 0, te despiertas con vida 45, hambre 30, colocón 0 y hasta −20 monchis |
| **Negocio** (`negocio.js`) | 7 mejoras (base 50-220; precio `base·1,9ⁿ`, niveles 4 y 5 ×2 y ×3; tope por acto: 2/3/4/5) |
| | La caja se llena sola con la hora real (al 60 % fuera del juego) |
| | Cobrar: +25 de bono al día. Metas con premio (20 a 1.000) |
| **Inventos** | 240 a 500 (`INVENTOS`) |
| Recados de historia | `OBJETOS_RECADO`: cerrojo 25, máscara 15, pruebas 15 |
| Encargos de la tienda | **Pendiente** (el reparto por el barrio). `avisar('entrega', {pago})` cuando exista |

La comida de la tienda:
- **patatas** 15: hambre −40;
- **kebab** 30: hambre −80, vida +10;
- **caramelo** 10: hambre −20, vida +10;
- **resucitador** 20: vida +45, colocón −10.

API de economía del motor:
- `tienda()` y `comprar(id)`, que devuelve `{ ok, efecto: { colocon } }`;
- `faltaParaLiar()` y `gastarLiar()`;
- `negocio()`, `mejorar(id?)` y `cobrarCaja()`;
- `comprarInvento(id?)` y `aportar(n)`;
- `paso(dt, { colocon })` (hambre, vida, caja y pista) y `necesidades()`.

**Ojo:**
- La recreativa juega con `panel: false`, así que el 2D no cobra nada: cobra el motor al recibir `avisar('minijuego')`. Si algún día se pone `panel: true`, se cobraría dos veces.
- `p.jugar(..., { mundo })` del puente fija `ESTADO.colocon` a 60 o 0. No importa: `paso()` lo vuelve a poner con el del XR en cada fotograma.

## 4. Lo que tienes que añadir en `app.js`

```js
// 1) imports
import { MotorHistoria } from './historia/motor.js';
import { Escenas } from './historia/escenas.js';
import { MunecaHistoria } from './historia/muneca.js';
let motor, escenasH, munecaH;

// 2) en cargar(), después de crear la recreativa
motor = await MotorHistoria.crear();                    // crea el puente con 'unake-xr-partida' (≈1 s, ~4 MB)
recreativa.cargando = Promise.resolve(motor.puente);    // la recreativa usa EL MISMO puente (y su ESTADO)
escenasH = new Escenas({ escena, xr, mundo: () => J.mundo, prestados: { lasslow, blancaso } });
munecaH = new MunecaHistoria({ motor, alPulsar: o => accionHistoria(o.accion) });
motor.on('alPista', p => (p.de === 'lasslow' || p.de === 'blancaso') ? di(p.de, p.texto) : ui.cartela(p.texto, 5));
motor.on('alCobro', c => { if (c.situacion) setTimeout(() => ui.cartela(c.situacion, 4), 6500); });
motor.on('alDesmayo', ({ perdidos }) => { J.colocon = 0; ui.cartela(`¡Te ha dado un amarillo! Despiertas en tu cuarto${perdidos ? ` (−${perdidos} monchis)` : ''}.`, 5); });
motor.on('alAcabarCapitulo', e => sonido(e.final ? 'oooh' : 'campanita', { volumen: 0.6 }));
J.motor = motor;

// 3) escenas: solo cuando nada más ocupa la vista (criterio §3)
async function contarEscena() {
  const e = motor.tomarEscena(); if (!e) return;
  const antes = J.fase; fase('historia'); ui.instruccion(null); ui.quitarTarjetas();
  try { await escenasH.contar(e, { objetivos: () => motor.objetivos() }); }
  finally { fase(antes); motor.escenaContada(); }
}
const libreParaHistoria = () => ['liar', 'fumar', 'encender'].includes(J.fase) && !J.calada && !J.enManos
  && !J.vuela && !J.transicion && !J.minijuego && !J.menu && !escenasH.ocupada;

// 4) empezar(): la intro del cap. 1 antes de buscar la pared
async function empezar() {
  while (motor.escenaPendiente) await contarEscena();
  fase('buscarPared'); /* …lo de siempre… */
}

// 5) avisos (una línea en cada sitio)
//   abrirPuerta(), al principio:                  motor.avisar('puerta');
//   director, cuando J.liar devuelve el porro:     motor.avisar('liar');
//   acabarCalada(), tras `if (!nivel) {…}`:         motor.avisar('calada', { nivel: idx });
//   acabarPorro():                                 motor.avisar('porro');
//   pasar(p), al principio:                        motor.avisar('pase', { a: p === lasslow ? 'lasslow' : 'blancaso' });
//   cambiarMundo(), antes de J.transicion = false: motor.avisar('mundo', { mundo: J.mundo });
//   entrarSala(id), tras montar la gente:          motor.avisar('sala', { id, gente: gente.map(r => r.id === 'la-pompa' ? 'pompa' : r.id) });
//   jugarMinijuego → ctx.terminar, al principio:   motor.avisar('minijuego', { clave: mod.clave, puntos, gana, colocon: J.colocon });
//   jugarRecreativa, si r && !r.abandonado:        motor.avisar('minijuego', { clave, puntos: r.puntos, gana: r.gana, colocon: J.colocon });

// 6) director(dt), en cualquier sitio después de ui.actualizar
motor.paso(dt, { colocon: J.colocon });
escenasH.actualizar(dt, ms);
munecaH.actualizar(dt, xr.manos.izquierda, xr.manos.derecha);
if (motor.escenaPendiente && libreParaHistoria()) contarEscena();
//   y mientras hay escena, que el pellizco no haga otra cosa: cambia
//   `else if (J.fase === 'fumar' || …) mirarMenu();` por `else if (!escenasH.ocupada && (J.fase === 'fumar' || …)) mirarMenu();`

// 7) el botón del objetivo (muñeca) y en el menú de la muñeca, la primera tarjeta
function accionHistoria(a) {
  const r = motor.hacer(a); if (!r) return;               // aportar, mejorar, invento, cobrar, seguir: ya está
  if (r.tipo === 'recreativa') return jugarRecreativa(r.clave);
  if (r.tipo === 'nativo') return jugarMinijuego(r.id);
  if (r.tipo === 'barrio') return abrirBarrio();            // r.salas: dónde ir (para resaltar en la maqueta)
  if (r.tipo === 'menu') { if (r.motivo) ui.cartela('Te faltan monchis: gánalos jugando.', 3); return abrirMenu(); }
  if (r.tipo === 'fumar') { if (!J.porro && !J.liar) sacarBandeja(); return; }
  if (r.tipo === 'pasar') return ui.cartela('Acércale el porro encendido a Blancaso.', 3);
}
//   en abrirMenu(): const oh = motor.objetivos().historia;
//     opciones = [...(oh?.accion?.texto ? ['★ ' + oh.accion.texto] : []), …las de siempre]
//     y en el callback: if (texto.startsWith('★ ')) return accionHistoria(oh.accion);

// 8) comer: lo que devuelve comprar() trae el cambio de colocón
//   const r = motor.comprar('lata'); if (r.ok && r.efecto.colocon) J.colocon += r.efecto.colocon;
```

**Liar con inventario** (como en el 2D): cuando haya tienda en el XR, en `sacarBandeja()` pon `if (!motor.gastarLiar()) { ui.cartela('Para liar te falta: ' + motor.faltaParaLiar().join(', '), 4); return; }`.
- **Hoy NO**: sin tienda no hay forma de conseguir papel ni mechero, y bloquearía el bucle básico (criterio §3).
- La alternativa intermedia: dar al empezar un kit (papel 3, mechero) y exigirlo solo desde el cap. 2.

## 5. Cómo probar

- Servidor: `python servir_lan.py --local 18775`.
- Página de prueba: `historia.html?cap=N&nuevo`.
  - `&humo`: escenas en el mundo humo.
  - `&rapido`: sin esperas.
  - Teclas: espacio = pasar · O = cumplir objetivo · B = botón · M = plegar.
  - Los botones del panel simulan cada aviso.
- Prueba completa: `node herramientas/pruebas/historia.mjs 18775 [capInicial]`.
  - Recorre del 1 al final y comprueba que no haya errores.
  - Comprueba también que `RECREATIVA` coincida con `JUEGOS_2D`, y que las dos partidas (la del XR y la centinela del 2D) queden bien.
  - Fotos en `herramientas/pruebas/fotos/hist-*.jpg`: portada, intro, objetivos, «Tú», momento, cierre, poscréditos y muñeca.

Última pasada (24/11/2026), con `historia.mjs` y sin errores de página:
- recorre los 17 capítulos, del 1 al final, en ≈15 min y con ≈120 fotos;
- se pulsa «Seguir la historia» en 5 tareas pendientes: Furgo ×2, Control, Casetas y Amarillo;
- la partida del 2D queda intacta y la del XR acaba en `capId: 'libre'`.

## 6. Pendiente

- **Las noches de cada personaje** (`NOCHES`, niveles 3/5/7 de su minijuego): el motor ya guarda `niveles` (vía `apuntar`), pero aún no las dispara. Se haría con `nochePendiente()` del 2D al estar libre.
- **Encargos de la tienda** (reparto).
- **Chats del móvil** (`CONTENIDO_CAPITULOS`).
- **Frases de ambiente por capítulo** (`CHARLAS_CAP`).
- **Minijuegos sin equivalente**: Furgo, Control, Casetas y Amarillo.
- **Medir en la Quest** la carga del puente al arrancar.
- **Fallo de `ui.js` que ya estaba** (no es de este encargo): en el panel del colocón, «colocón NN» se pisa con «toca: jugar». Se ve en `hist-*-muneca.jpg`.
