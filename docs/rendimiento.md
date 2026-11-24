# Rendimiento · Quest 3S

Objetivo: **≤ ~60 llamadas de dibujo por ojo** en todo (sin multiview, la Quest dibuja la escena dos veces: el doble por fotograma), triángulos < ~100 mil, y no subir texturas grandes cada fotograma.

Medición: `node herramientas/pruebas/rendimiento.mjs <puerto> [bar,salas,mj,maquina,enjuego]` (Chrome en el PC; un ojo; máximo de 6 vistas girando la cabeza, salvo los minijuegos, de frente). Los nativos sueltos (`mj`) están en `minijuego.html`; **lo que cuenta en la Quest es `enjuego`**: el minijuego dentro del bar del humo (bar, máquina y colegas se siguen dibujando).

## Tabla (24/11, antes → después de este sprint)

Llamadas de dibujo por ojo (máximo de las vistas). «Antes» = al empezar el sprint; «después» = con los cambios de todos los agentes a última hora del 24/11 (pulido también ha bajado minijuegos).

| Escena | Antes | Después | Triángulos | Nota |
|---|---|---|---|---|
| Tu casa (liar, de día) | 21 | 21 | 126 | |
| Bar del humo | 46 | 39 | 8 k | máquina 19 → 9 |
| La máquina sola (`maquina.mjs`) | ~19 | **9** | — | mueble fusionado, botones instanciados |
| Recreativa jugando (bar + puente) | — | 37 | — | textura del 2D a 30 fps y solo si se ve |
| Mapa (maqueta) | 37 | 36 | 8,6 k | |
| Salas del barrio (9) | 9-35 | 9-35 | ≤ 15 k (feria) | la plaza, la más cara (35) |
| Pipas (suelto / en el bar) | 15 / — | 16 / 51 | 9 k | |
| Tiro al pato | 71 / ~90 | 28 / **65** | 14 k | |
| Cuentas | 50 / — | 23 / **68** | 9 k | |
| Casetas | 17 / — | 15 / 52 | 12 k | |
| Furgo (elección de acompañantes) | 46 / ~80 | 25 / **62** | 10 k | dentro de la cabina, el bar no se ve |
| Control | 31 / — | 41 / **71** | 10 k | |
| Amarillo | 34 / — | 30 / **67** | 9 k | |
| En su punto (va a la máquina) | 29 | 30 | 3 k | |

En **negrita**, lo que aún pasa de 60. Con lo pedido a `app.js` (esconder la máquina durante un nativo: −7; esconder el bar si el minijuego te encierra: −25 a −30) quedan todos en ≤ ~64, y la furgo y el control en ~35-45.

## Qué se ha hecho

- **La máquina recreativa: 19 → 9 llamadas** (`js/recreativa/mueble.js`). El contorno de tinta va dentro de la malla del mueble (caras dadas la vuelta, sin `BackSide`), los 8 botones son una sola `InstancedMesh` con el color por instancia, la bola de la palanca lleva su contorno en la misma malla y el arte del panel comparte el atlas con laterales, frontal y bisel (lienzo de 1024 × 1536; el panel se copia a su trozo solo cuando cambia).
- **El puente de la máquina a 30 pasos/s** (antes 45) y **la pantalla no se sube a la GPU si no la ves** (`_pasoPuente`/`_seVe` en `recreativa.js`): el 2D sigue corriendo (su reloj), pero la textura de 1280 × 720 (~3,7 MB) solo se sube cuando la pantalla está en tu campo de visión o a menos de 1,2 m. Mirándola: la mitad de subidas que a 60.
- **Manos visibles**: sus 4 mallas instanciadas no se dibujan cuando no hay piezas (sin manos, o de día con tus manos reales).

## Lo pesado que queda (pedido a otros agentes)

- **Bar del humo ~35**: sala 8 + decoración 3D 6 + máquina 7 + Lasslow y Blancaso 10 + manos/humo. Durante un nativo, `app.js` puede esconder la máquina (−7) y, si el minijuego te mete en un sitio cerrado (la cabina de la furgo), el bar entero (−25 a −30).
- **Furgo**: la cabina 21 llamadas; con el bar, ~60. Fundir lo quieto de la cabina (`fusionar` de `jugo.js`) y esconder el bar.
- **Cuentas, Control, Amarillo** dentro del bar: 65-70. Cada uno debería quedarse en ≤ 25 propias.
- **Tiro al pato** ya bajó de 71 a ~28 propias (pulido).

## Trampas

- `renderer.info.render.calls` cuenta un ojo en el PC; en la Quest, x2.
- En el PC no hay culling de lo que queda detrás de ti en la Quest con otra orientación: por eso el máximo de 6 vistas.
- La primera subida de cada textura (al encender la máquina, al cambiar de sala) es un tirón; no se ve en esta tabla.
