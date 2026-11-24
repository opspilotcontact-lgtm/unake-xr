# Plan maestro · UNAKÉ XR, un port hecho en condiciones

> 24/11 noche. Tras la ola de 10 agentes el juego tiene casi todo (21 minijuegos nativos, barrio vivo, historia completa), pero **no está hilado**: cada pieza funciona sola y el conjunto pierde potencia. Palabras del fundador: «la máquina de jugar es una locura, solo hace falta hilar bien todo; hay muchos detalles que se me escapan pero hacen que el cómputo pierda potencia». Este plan manda sobre los anteriores para todo lo que sea calidad del conjunto. Todo agente lo lee junto a `RETOMAR.md` y `criterio.md`.

## 1. Las seis reglas del port (se cumplen siempre)

1. **Nada te bloquea.** No existe un estado modal del que haya que salir pulsando algo. Las tarjetas finales, los carteles y las charlas se cierran solos o en cuanto haces otra cosa (andar, fumar, abrir el menú, tocar otra cosa). Siempre puedes fumar, salir de la sala o abrir el menú.
2. **Cada cosa existe UNA vez.** Un personaje o un objeto (Palicaso, la tragaperras, la furgo, la M) está en un solo sitio del mundo. El minijuego ocurre **ahí mismo y con ellos**: no aparece «otro» Palicaso ni «otra» máquina. Lo que ves en reposo es lo mismo con lo que juegas.
3. **El espacio es creíble.** Cada sala tiene límites: con el joystick no se atraviesan paredes, y si andas de verdad fuera, la sala se oscurece y te indica volver. Volumen real en lo que está cerca (paralaje), escala correcta, nada flota.
4. **La personalidad es la del 2D.** Textos, voces, frases sin repetir, humor, ritmo. Cada momento del 2D con identidad (cortinillas `CORTINA_DE`, reacciones al perder `REACCION_PIERDE`, música `MUSICA_ESCENA`, celebraciones) tiene su equivalente en VR.
5. **La linealidad es la del 2D.** Capítulos con su intro, su cierre y sus poscréditos; día y noche; lo que se abre con la historia (`abre()` de `lugares.js`). Puedes dar vueltas, pero la historia siempre está a un gesto (★) y el mundo reacciona a ella.
6. **Calidad medible.** Nada sale a `main` sin la batería entera (`bot_f0`, `historia`, `portales`, `gente`, `encargos`, `guia`, `mundo` y los bots de cada nativo). Y en la Quest hay un **«Algo va mal»** en la muñeca que guarda qué pasaba (estado, últimos mensajes de consola, foto) para que el fundador lo exporte y nos llegue tal cual.

## 2. Fases

| Fase | Qué | Criterio de hecho |
|---|---|---|
| **F1 · Jugabilidad sin roces** | Los fallos del 24/11 y TODA su familia: duplicados de personajes y objetos (contrato *in situ*: `ctx.ancla`, `ctx.actores`), final no modal, límites de sala, carreras (personajes tapados por el fondo falso), tragaperras (una sola máquina, la realista), auditoría de «no me deja fumar/salir», botón «Algo va mal» | Un recorrido entero (cap. 1-3 y modo libre) sin un solo bloqueo ni duplicado; bots y foto por minijuego jugado *in situ* |
| **F2 · Hilado y personalidad** | Transiciones con identidad del 2D (cortinillas en VR, reacción del personaje al ganar o perder, celebración de estrellas), consecuencias visibles en el mundo (ganar la Barra llena el bar, la hucha crece en la plaza, el negocio se ve en el bar real), muñeca con hambre, vida y monchis, noches y sucesos del 2D | Cada minijuego empieza y acaba con su personaje real reaccionando; cada capítulo cambia algo visible en el mundo |
| **F3 · Espacios de verdad** | Salas con volumen: suelo, paredes y muebles principales en 3D sacados de las capas de la serie (`VOPPE SERIE/02_escenarios/*/capas`, solo lectura) en vez de un dibujo proyectado; límites físicos; oclusión correcta de personajes; luz coherente día y noche | Andar por cualquier sala sin ver el truco; el fundador la puede rodear |
| **F4 · Guion actuado** | Escenas de la historia en 3D, con los personajes en su sala, gestos, bocadillos y cámara quieta (sin viñetas flotando); el cine del 2D (intro, final, el círculo, la cuenta, poscréditos) | Cada capítulo se vive como una escena, no se lee |
| **F5 · Pulido en la Quest** | Rondas de prueba del fundador con «Algo va mal»; ajuste de tolerancias, dificultad, textos y rendimiento por escena | Una partida de punta a punta en las gafas sin fallos anotados |

Orden: F1 → (F2 ‖ F3) → F4 → F5. Cada fase es una ola de agentes con **dueños de archivos sin solaparse**, informe corto, la batería completa y publicación solo en verde.

## 3. Contrato *in situ* (F1, lo usan todos los minijuegos)

- `ctx.ancla = { pos, haciaMi, sala }`: dónde está el sitio en el mundo (la persona o el objeto). El minijuego monta su escena **ahí**, no delante de ti en abstracto. Si no viene, se comporta como hoy.
- `ctx.actores`: los personajes del mundo que ya están (`{ palicaso: Recortable, … }`). Si el que necesitas está, **úsalo** (pose, bocadillo, posición) y devuélvelo como estaba al terminar; si no está, créalo como hoy.
- `ctx.objetoSitio`: el objeto de reposo del sitio (la tragaperras, la pizarra, la furgo…). El minijuego lo usa o lo oculta y monta encima el suyo con **el mismo modelo**. Cada módulo de objeto exporta `modeloSitio(THREE)` para que el mundo pinte en reposo exactamente lo mismo.
- Al terminar: cartel de resultado **no modal**; «Otra vez» es opcional y desaparece solo; el mundo vuelve a estar igual.

## 4. Lista de prueba del fundador (cada ronda)

1. Empezar de cero: puerta, contraseña, liar, fumar, pase, humo.
2. Capítulos 1-3 siguiendo la ★.
3. Modo libre: pasear por las 10 salas, hablar con cada personaje y jugar un minijuego de cada uno **en su sitio**.
4. Apuestas, negocio, cuarto, tienda, hucha, encargos.
5. Durante todo: ¿algo duplicado? ¿algo te bloquea? ¿te has salido de la sala? ¿algo flota o se tapa? → «Algo va mal» en la muñeca.
