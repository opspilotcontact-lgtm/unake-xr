# Plan maestro · UNAKÉ XR, un port hecho en condiciones

> Redactado el 24/11/2026 por la noche, tras cuatro rondas de prueba del fundador en la Quest y tres olas de agentes. **Manda sobre cualquier otro plan en todo lo que sea calidad del conjunto.** Todo agente lo lee junto a `docs/RETOMAR.md` y `VOPPE SERIE/07_juego/criterio.md` (solo lectura).
>
> La frase que lo resume, del fundador: «la máquina de jugar es una locura; solo hace falta hilar bien todo. Hay muchos detalles que se me escapan pero hacen que el cómputo pierda potencia».
>
> Mañana se arranca **por la F0**. Antes de empezar, el fundador responde las decisiones del §9.

---

## 1. Diagnóstico: por qué «pierde potencia»

Tenemos casi todas las piezas, pero se hicieron en paralelo y **no comparten un mismo modelo del mundo**. Hay tres errores de diseño, comprobados en el código, que explican casi todos los fallos que viste:

| Síntoma en la Quest | Causa de raíz (comprobada) |
|---|---|
| «Te dejan bloqueado: hay que darle a Volver o Cerrar para poder fumar o salir» | El estado del juego vive en **12 banderas sueltas** en `app.js` (`J.fase` se consulta 71 veces, `J.minijuego` 40, `J.charla` 21, `J.calada` 19, `J.transicion` 17, `B.ocupado` 20…). Cada pieza nueva añadió la suya y algunas se quedan puestas, así que no hay un sitio único que diga qué se puede hacer en cada momento. |
| «El personaje se duplica: ya estaba y al empezar el minijuego vuelve a salir». «La tragaperras: al jugar sale otra» | **17 de los 21 nativos crean su propio personaje y su propia escena** delante de ti, sin usar lo que ya hay en el mundo. El objeto de reposo del sitio (la tragaperras de la tienda) es un modelo distinto del que se juega. |
| «Te sales del cuadrado que es en realidad y le quita realismo» | Las salas son **un dibujo proyectado en una caja**. El joystick no tiene ningún límite y no hay paredes con volumen. |
| «Las carreras tienen un fondo falso y la mitad de los personajes se quedan pillados detrás» | Planos superpuestos sin un orden de profundidad bien hecho. Es el mismo fallo de **ocluidores** que ya sufrimos en el piloto (memoria del 13/11). |
| «Muchos mini fallos» y «detalles que se me escapan» | No hay forma de **anotar un fallo en el momento** desde las gafas, y las pruebas automáticas no juegan como juega una persona (cambiar de idea a mitad, andar mientras habla alguien, salir de un minijuego y ponerse a fumar…). |
| «Nada sigue el hilo», «tiene que sentirse vivo» | Faltan los sistemas del 2D que dan personalidad y ritmo: el lenguaje de cómic, los encuentros, las interrupciones, las noches de cada personaje, el móvil, los retos y la música por escena (ver §3). |

**Conclusión:** antes de añadir nada más, **unificar** el estado, los personajes, el espacio y el lenguaje. Después, rellenar los huecos del 2D. Por último, actuar la historia y pulir en las gafas.

---

## 2. Las reglas del port (se cumplen siempre, en todo encargo)

1. **Nada te bloquea.** Ningún estado te deja atrapado. Los carteles, tarjetas y charlas se cierran solos o en cuanto haces otra cosa. Fuera de un minijuego en curso siempre puedes **fumar, cambiar de sala y abrir el menú** (criterio §3: «nada opcional bloquea el bucle básico»).
2. **Cada cosa existe una sola vez.** Un personaje o un objeto está en un único sitio del mundo (criterio §5: «el paradero manda»). Los minijuegos ocurren **ahí y con ellos**: lo que ves en reposo es aquello con lo que juegas.
3. **El espacio es creíble.** Las salas tienen límites y volumen, nada flota, nada se tapa mal y la escala es la de una persona. Si sales andando de verdad, el mundo te lo dice con suavidad.
4. **La personalidad del 2D.** Las sensaciones se ven y no se nombran. Una voz a la vez, frases que no se repiten, el momento persona y el último chiste. Cortinillas con la firma de cada personaje, reacciones al ganar y al perder, y la música de cada momento (criterio §1, §2 y §4).
5. **La linealidad del 2D.** Capítulos con su escena, sus tareas, su giro y su cierre; día y noche; lo que se abre con la historia y se queda para siempre (criterio §4: «lo que engancha se queda»). Puedes dar vueltas, pero la historia está siempre a un gesto (★) y el mundo reacciona a ella.
6. **VR de verdad, no 2D en VR.** Primero el gesto físico: coger, dar, empujar, tapar, agacharse, soplar. La interfaz va en el mundo (la muñeca, el móvil, los carteles de la sala), no flotando. Confort siempre: la cámara no se mueve nunca.
7. **Calidad medible.** Nada sale a `main` sin la batería completa (§7). En la Quest, «Algo va mal» guarda lo que pasaba en ese momento.

---

## 3. Inventario: el 2D frente al XR (sistema por sistema)

Leyenda: ✅ completo · 🟡 parcial o simplificado · ❌ no existe.

| Sistema del 2D (archivo) | Qué hace en el 2D | En el XR hoy | Fase |
|---|---|---|---|
| Historia (`historia.js`, `contenido`) | 17 capítulos, tareas que se comprueban solas, intro, cierre y poscréditos | ✅ El motor es el propio 2D por el puente; 56 objetivos alcanzables (`docs/objetivos-vr.md`) | — |
| Escenas en cómic (`escena_comic.js`) | Los personajes de pie en su sala, plano y contraplano, cartelas | 🟡 Viñeta flotante y recortables a tu alrededor; no ocurre en la sala ni con la gente que ya está allí | F4 |
| Viñetas jugables (`vinetas.js`), cine (`cine.js`) | El principio contado en cómic con la mano del jugador (elegir, machacar, quedarse quieto) | ❌ | F4 |
| Lenguaje de cómic (`comic.js`: `CORTINA_DE`, `REACCION_PIERDE`, emotes, impacto, cartela de personaje) | Firma de cada personaje en cortinillas y reacciones | ❌ (0 usos en el XR) | F2 |
| Música por momento (`musica.js`: `MUSICA_ESCENA`) | Cada minijuego y cada sala con su tema, fundidos y una sola música | 🟡 Música de bar, de día y de algunas salas; los minijuegos no ponen la suya | F2 |
| Barrio y paradero (`rutinas.js`) | Visitas, actividades y un único paradero | ✅ `vida.js` (24/11), pero choca con los minijuegos (duplicados) | F1 |
| Charlas del capítulo (`charlas_capitulo.js`) | El ambiente sigue la historia | 🟡 Hay charlas; falta la coherencia con lo que pasa | F2 |
| Encuentros del modo libre (`encuentros.js`) | Tonterías, memes, titulares, el grupo de la aso y el **móvil** que te enseñan | ❌ | F2 |
| Interrupciones ⚡ (`interrupciones.js`) | 7 sucesos entre capítulos (la madre, Niebla, el control, el ojo, el float…) | ❌ | F2 |
| Vida: logros, retos y sucesos (`vida.js`) | Logros para siempre, 3 retos cada noche y sucesos que se pillan al vuelo | 🟡 Logros en el corcho del cuarto; 1 suceso (lluvia de humo); sin retos | F2 |
| Noches de cada personaje (`noches.js`) | Subir de nivel un minijuego abre su historia en 3 escenas (niveles 3, 5 y 7) | ❌ | F2/F4 |
| Situaciones (`situaciones.js`) | Misiones secundarias procedurales (recoger y un minijuego) | 🟡 Se cobran; no se proponen ni se ven en el mundo | F2 |
| Noche especial (`MODS_PARTIDA`) | Cada partida, un modificador al azar | 🟡 Se aplica al cobrar, pero **no se anuncia** al empezar | F2 |
| Necesidades (hambre, vida, amarillo) | Barra de hambre y vida; si se vacía, amarillo y despiertas en tu cuarto | 🟡 Las lleva el motor, pero **no se ven** (la muñeca no las muestra) | F2 |
| Negocio (`negocio.js`) | Mejoras, clientela, caja y metas | ✅ Casa de muñecas en el bar | F1 (in situ) |
| Armario e inventos (`armario.js`) | Prendas con bono, taller | ✅ El cuarto (24/11) | — |
| Apuestas (`apuestas.js`) | Tragaperras y carreras | 🟡 Funcionan; hay duplicado y oclusión | F1 |
| Encargos, tienda, hucha | — | ✅ (24/11) | — |
| Prólogo guiado (`guia.js`) | 8 pasos, uno a uno, sin agobiar | 🟡 Una intro de 4 carteles y pistas | F2 |
| Minijuegos (31) | — | 21 nativos ✅ y 9 en la máquina; **ninguno in situ** | F1 |
| Liar con materiales | Papel, boquilla, bolsita y mechero | 🟡 Se lía gratis (decisión pendiente, §9) | F2 |

---

## 4. Arquitectura que lo hace posible (F0)

Sin esto, cada arreglo vuelve a romper otra cosa. Es lo primero.

### 4.1 Un solo modelo de estados (`js/estado.js`)
- **Un modo principal**, exactamente uno a la vez: `casa` (día, passthrough) · `bar` (humo) · `sala` (barrio) · `minijuego` · `maquina` · `escena` · `transicion`.
- **Capas no modales** encima, que nunca bloquean: `charla`, `menu`, `cartel`, `encargo`, `calada`, `porroEnMano`.
- **Una tabla de lo permitido** (`puede(accion)`) para `fumar`, `cruzarPuerta`, `abrirMenu`, `hablar`, `jugar`, `andar`, `coger`, `escenaHistoria`. Todo el código pregunta a la tabla, no a banderas.
- **Un único lugar para entrar y salir de cada modo** (`entrar(modo, datos)` y `salir()`), que guarda y restaura el mundo: quién estaba, dónde estaba el porro, qué música sonaba. Así desaparecen las banderas que se quedaban puestas.
- **Prueba de atascos** (`herramientas/pruebas/atascos.mjs`), el equivalente del `probar_trabas2.js` del 2D: un bot hace cientos de acciones al azar durante 10 minutos (andar, cruzar, fumar, tocar gente, jugar y abandonar, abrir el menú) y comprueba que **siempre** puede volver a fumar, cruzar y abrir el menú en menos de 2 s.

### 4.2 Trocear `app.js` (1.791 líneas) por responsabilidades, sin cambiar lo que hace
- `estado.js` (lo de arriba).
- `fumar.js`: liar, encender, caladas y pase.
- `mundo.js`: casa, bar, salas, puertas y paradero.
- `juego.js`: lanzar y cerrar minijuegos, el contrato *in situ*, los finales no modales y la máquina.
- `director.js`: historia, escenas y guía.
- `app.js` queda como arranque y bucle.

Cada archivo con **un dueño** por ola: así varios agentes trabajan a la vez sin pisarse, que es justo lo que falló con un `app.js` único.

### 4.3 El contrato *in situ* (lo usan todos los minijuegos)
- `ctx.ancla = { pos, haciaMi, sala }`: el sitio del mundo donde está la persona o el objeto. El minijuego monta su escena **allí**.
- `ctx.actores = { palicaso: Recortable, … }`: los personajes del mundo que ya están. Si el que necesitas está, lo usas (pose, bocadillo, sitio) y lo devuelves como estaba. El módulo lo declara con `usaActores: true`.
- `ctx.objetoSitio`: el objeto de reposo del sitio. Cada módulo de objeto exporta `modeloSitio(THREE)`, y el mundo pinta en reposo **ese mismo modelo**.
- **Final no modal**: un cartel de resultado con el personaje reaccionando. «Otra vez» es opcional y se va sola a los 8 s o en cuanto haces otra cosa.
- Sin `ancla`, el minijuego se comporta como hoy, así que las páginas de prueba sueltas siguen sirviendo.

### 4.4 «Algo va mal» (desde la muñeca)
Guarda en IndexedDB la fecha, el modo, la sala, el capítulo y el objetivo, el minijuego, la posición, las últimas 200 líneas de consola, los errores y una foto pequeña del lienzo. La página `informes.html` los lista y los descarga en un JSON. **Así los detalles que se te escapan nos llegan con su contexto.**

---

## 5. Fases

Orden: **F0 → F1 → (F2 en paralelo con F3) → F4 → F5**. Cada fase es una ola de agentes con dueños de archivos sin solapes, un informe corto y la batería completa. Solo se publica en verde.

### F0 · Cimientos (1 sesión · 3-4 agentes)
- El modelo de estados con su tabla `puede()` y la prueba de atascos.
- Trocear `app.js` (§4.2) sin cambiar el comportamiento: la batería actual debe dar lo mismo antes y después.
- «Algo va mal» e `informes.html`.
- Batería ampliada: `atascos.mjs`, `dosveces.mjs` (cada nativo dos veces seguidas: lo que el 2D aprendió con `scene.start`) e `insitu.mjs`.
- **Hecho cuando:** la batería da verde antes y después del troceo, y `atascos.mjs` aguanta 10 minutos sin quedarse atrapado.

### F1 · Jugabilidad sin roces (1 sesión · 3 agentes)
- El contrato *in situ* en los 21 nativos: primero los que tienen personaje de sitio (Palicaso: Barra, Farol y Escucha; Cotine: Tarta y Palo; Perico: Pipas y Periquito; Blancaso: Cuentas; la Pompa: DJ; Lasslow) y luego los de objeto (tragaperras, carreras, furgo, la M, el monitor, la lona).
- La tragaperras y la pizarra de las carreras con `modeloSitio`. Las carreras, sin el fondo que tapa a los corredores, revisadas con fotos desde donde mira el jugador, sentado y de pie (regla de ocluidores).
- Límites de sala con el joystick (con `medidas.limites`). Si sales andando de verdad, la vista se oscurece y un aviso suave te pide volver.
- Repaso de la familia «mini fallos» en los 21 nativos: nada aparece pegado a la cara, nada surge de la nada, todo se alcanza sentado y todo se devuelve como estaba.
- **Hecho cuando:** un recorrido entero (capítulos 1-3 y modo libre por las 10 salas, jugando un minijuego de cada personaje en su sitio) sin un solo duplicado ni bloqueo; `insitu.mjs`, `atascos.mjs` y la batería, en verde.

### F2 · Hilado y personalidad (1-2 sesiones · 4-5 agentes)
- **Lenguaje de cómic en VR**: cortinillas con firma (estrella de Palicaso, burbuja de la Pompa, pringue de Puky, iris de la puerta, barrido) hechas con el humo y la luz de tu sala, sin tapar más de 0,5 s; reacción del personaje real al ganar o perder (`REACCION_PIERDE`); emotes; cartela la primera vez que sale alguien; celebración de 3 estrellas con nombre propio.
- **Música por momento** con `MUSICA_ESCENA`: cada minijuego con la suya y fundidos.
- **El mundo reacciona**:
  - ganar la Barra llena el bar;
  - la hucha crece en la plaza;
  - el negocio se ve en el bar de verdad, no solo en la maqueta;
  - si pierdes, te vacilan;
  - las charlas del capítulo hablan de lo que acaba de pasar.
- **El móvil**: un móvil de verdad en tu mano. Te escriben los del barrio (como en el 2D), salen memes, titulares y el grupo de la aso (`encuentros.js`). Es la pieza diegética que falta.
- **Encuentros del modo libre** al hablar con alguien sin misión, e **interrupciones ⚡** entre capítulos (las 7 del 2D).
- **La muñeca completa**: hambre, vida y monchis. El amarillo, como en el 2D, te despierta en tu cuarto.
- **Retos de la noche** (3 cada noche), **sucesos** del barrio (los del 2D, no solo la lluvia) y la **noche especial** anunciada al empezar cada partida.
- **Situaciones** propuestas por los personajes, con sus cosas brillando en el mundo.
- **Prólogo guiado** como el del 2D: 8 pasos de uno en uno, con aro y flecha en el mundo.
- **Materiales para liar**, según la decisión del §9.
- **Hecho cuando:** cada minijuego empieza y acaba con su personaje reaccionando y su música, y en una hora de modo libre no se repite nada y siempre pasa algo (criterio §4: nunca más de 3 minutos sin algo nuevo).

### F3 · Espacios de verdad (1-2 sesiones · 2-3 agentes, y arte si se aprueba)
- **Salas por capas**, la técnica que ya funcionó en el piloto (memoria del 15/11, «decorados por capas»): fondo vacío lejano y muebles sueltos como piezas 3D con grosor y canto, colocadas por su `y` (detrás, asiento, delante). Así la oclusión es correcta, no hay recortes y los personajes nunca quedan tapados.
  - Hay capas para **5 de 11 escenarios** (`unake-dentro` con 17, `unake-cocina` con 8, `plaza-banco` con 7, `unake-fuera` con 6 y `unake-sofa` con 5).
  - Faltan las del cuarto, la tienda, el baño, el techo, la calle y el cielo. Para esas, ver la decisión del §9: generarlas (Gemini, objeto aislado sobre verde croma, criterio §6) o resolverlas con geometría hecha en código.
- **Paredes, techo y suelo sólidos** y coherentes con el dibujo; exteriores cerrados con fachadas, vallas o niebla, sin bordes visibles.
- **`medidas.limites`** andables, para la F1.
- Luz pintada coherente de día y de noche, y escala de persona real.
- **Hecho cuando:** puedes rodear cualquier sala sin ver el truco, y la revisión con fotos por mueble y por ángulo no encuentra a nadie tapado (regla de ocluidores).

### F4 · Guion actuado (2 sesiones · 3-4 agentes)
- **Escenas de la historia en su sala y con la gente que ya está**: llegan andando, hablan con su bocadillo (una voz a la vez) y hacen gestos. Nada de viñetas flotando; la viñeta del capítulo queda como cuadro en la pared o como portada al empezar.
- **Viñetas jugables** del principio (`vinetas.js`) con la mano del jugador hecha gesto: elegir qué decir tocando, machacar, quedarse quieto, dar la calada.
- **El cine del 2D**: intro, final, el círculo, la cuenta y poscréditos.
- **Las noches de cada personaje** (niveles 3, 5 y 7) como escenas actuadas.
- **Hecho cuando:** cada capítulo se vive como una escena, no se lee; el momento persona y el último chiste se notan.

### F5 · Pulido en la Quest (rondas, mientras dure)
- Rondas tuyas con «Algo va mal». Cada ronda termina en una lista priorizada y una ola corta de arreglos.
- Ajustes de tolerancia de manos, dificultad, textos, legibilidad y rendimiento por escena (por debajo de 60 llamadas de dibujo por ojo).
- **Hecho cuando:** completas una partida de punta a punta en las gafas sin fallos anotados.

**Estimación total:** 7-9 sesiones, más las rondas de prueba. El ritmo lo marcan tus pruebas.

---

## 6. Cómo se encarga y se integra cada ola (proceso)

1. **Encargo**: cada agente lee este plan, `RETOMAR.md` y `criterio.md`, y recibe archivos de su propiedad, lo que no puede tocar, el criterio de «hecho», las pruebas y un presupuesto de unos 250-300 mil tokens.
2. **Memoria**: con unos 6 GB libres, un navegador por agente si son 6 o más, y dos si son menos.
3. **Integración** (yo):
   - leo cada informe;
   - miro las fotos;
   - paso la batería completa;
   - reviso con el criterio §7 (sensación sin nombrarla, momento persona, que haga reír);
   - publico por partes con commits convencionales.
4. **Lo aprendido** se añade a la tabla de fallos de `criterio.md` (pidiéndolo, porque es de VOPPE SERIE) o a `RETOMAR.md` §9.

---

## 7. La batería de pruebas (todo en verde antes de publicar)

| Prueba | Qué garantiza |
|---|---|
| `bot_f0.mjs` | El flujo completo: puerta, liar, fumar, pase, humo y vuelta |
| `historia.mjs` | 17 capítulos y 56 objetivos, sin «Seguir la historia» |
| `atascos.mjs` (F0) | Nunca te quedas atrapado |
| `dosveces.mjs` (F0) | Cada nativo dos veces seguidas sin quedarse parado |
| `insitu.mjs` (F1) | Sin duplicados; el mundo queda igual al terminar |
| `portales`, `gente`, `encargos`, `guia`, `mundo`, `maquina`, `recreativa`, `confort`, `inmersion` | Lo que ya funciona sigue funcionando |
| `minijuego.mjs <id>` × 21 y `menu_minijuego.mjs <id>` × 21 | Ganar, perder, «Otra vez», `abandonar` y cero errores, suelto y dentro del juego |
| `rendimiento.mjs` | Llamadas de dibujo por escena dentro del presupuesto |
| Fotos | Revisadas a ojo: nada flota, nada tapa, nada fuera de sitio |

---

## 8. Tu lista de prueba en la Quest (cada ronda, unos 30 min)

1. **Empezar de cero**: puerta, contraseña, liar, fumar, pase, humo y vuelta al día.
2. **Historia**: capítulos 1 a 3 siguiendo la ★.
3. **Modo libre**: recorrer las 10 salas, hablar con cada personaje y jugar un minijuego de cada uno **en su sitio**.
4. **Sistemas**: apuestas, negocio, cuarto, tienda, hucha y encargos.
5. **Durante todo**: ¿algo se duplica? ¿algo te bloquea? ¿te has salido de la sala? ¿algo flota o se tapa? ¿alguna frase suena rara? → «Algo va mal» al momento.

---

## 9. Decisiones del fundador para arrancar mañana

1. **Materiales para liar** (pendiente desde el 24/11): A) kit inicial y se exigen desde el capítulo 2 (como el 2D) · B) gratis · C) se exigen, pero te regalan uno si no tienes.
2. **Arte de las capas que faltan** (cuarto, tienda, baño, techo, calle, cielo): generarlas con Gemini, objeto aislado sobre verde croma (más fieles, pero gastan cupo y hay que revisarlas una a una) **o** hacerlas con geometría en código (sin cupo, menos fieles al dibujo).
3. **El móvil en VR**: ¿un móvil físico en tu mano (lo saco del bolsillo, vibra cuando te escriben) o los mensajes en la muñeca?
4. **Cine**: ¿escenas actuadas en 3D para todo, o recuperar algún corte del piloto como pantalla dentro del bar (una tele)?
5. **Orden**: ¿F0 y F1 seguidas antes de tu próxima prueba (recomendado: la siguiente prueba ya sin bloqueos ni duplicados), o publicar al acabar cada fase?

---

## 10. Registro del feedback del fundador (para no repetirlo)

| Fecha | Lo que dijo | Estado |
|---|---|---|
| 23/11 | Las manos bien; quiere física, fumar más largo, notar el pase, moverse; «peak para jugar fumado»; el micro le encanta | ✅ Física, pase y momentos de colocón · 🟡 el micro, ahora como extra |
| 24/11 (1) | «No tengo manos»; no es intuitivo qué botones pulsar; el humo con micro no va (mejor solo, al segundo); En su punto va fatal; nada sigue el hilo | ✅ Guantes y chuleta · ✅ humo automático · ✅ En su punto a la máquina · 🟡 el hilo (F1/F2) |
| 24/11 (2) | No sé cómo empezar ninguna misión; los encargos no tienen nada; los entornos son planos | ✅ Encargos, guía y decoración 3D · 🟡 espacios (F3) |
| 24/11 (3) | 7 nativos son pocos; el mundo tiene que estar vivo y ser jugable; apuestas; andar por el barrio; ordenado como el juego (dar vueltas o seguir la historia) | ✅ 21 nativos, apuestas y barrio vivo · 🟡 sin hilar (F1/F2) |
| 24/11 (4) | Duplicados; salirse del cuadrado; las carreras con fondo falso; la tragaperras sale otra; bloqueo hasta Volver; los fondos se pueden mejorar mucho; plan maestro | 📋 Este plan: F0, F1 y F3 |
