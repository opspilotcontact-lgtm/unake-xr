# El puente: minijuegos originales dentro de three.js

`js/puente/puente.js` permite jugar cualquier escena del juego web original (`base/`, Phaser 3.80.1) **dentro** de una escena three.js como textura (pantalla flotante, máquina recreativa…) mientras cada minijuego se porta a RV nativa. Devuelve el resultado real para cobrarlo en el motor XR.

```js
import { crearPuente } from './js/puente/puente.js';
const p = await crearPuente({ ancho: 1280, alto: 720 });
pantalla.material.map = p.textura;            // CanvasTexture sRGB del lienzo de Phaser
const r = await p.jugar('Pipas', { panel: true, mundo: 'humo' });
// r = { clave, puntos, gana, estrellas, titulo, linea, escena, ms }   (o { abandonado: true, motivo })
p.tecla('Space', true); p.tecla('Space', false);  // code estándar: Space, ArrowLeft, KeyX, Digit1…
p.puntero(hit.uv.x, hit.uv.y, 'down');            // UV de three tal cual (intersection.uv)
renderer.setAnimationLoop(() => { p.actualizar(); renderer.render(escena, camara); });
p.cerrar();                                       // detiene el minijuego y suelta lo que solo usaba él
```

Extras: `p.on('resultado' | 'salir' | 'escena', fn)`, `p.escena()` (la escena Phaser en curso), `p.estado()` (el `ESTADO` del puente), `p.desbloquearAudio()`, `p.audioContext`, `p.memoria()`, `p.descargadoMB()`, `p.metricas`, `p.destruir()`. Opciones de `crearPuente`: `renderizador` (`'webgl'` por defecto, `'canvas'`), `fpsMax` (60), `musica` (true), `panel` (true), `esperaSinPanel` (1500 ms), `liberar` (true), `audioContext`, `clavePartida` (`'unake-xr-puente'`; el motor de historia usa `'unake-xr-partida'`: su ESTADO es la partida del XR, ver `docs/historia.md`). Opciones de `jugar`: `panel`, `mundo` (`'humo'|'normal'`), `nivel`, `estado` (se mezcla en `ESTADO`), `datos` (los de `scene.start`).

Prueba sin gafas: `puente.html` (teclado del PC reenviado con `p.tecla`, clic sobre la pantalla → raycast → `p.puntero`). `?r=canvas` usa canvas 2D; `?sin` no crea el puente (para medir).

## Cómo funciona

1. **Iframe oculto del mismo origen** (`srcdoc` con `<base href="base/">`, fuera de pantalla a 1280×720). Los ~400 globales del juego (`ESTADO`, `ANCHO`, `class Barrio`…) no ensucian la página XR, el teclado real no le llega y `destruir()` lo libera todo quitando el iframe.
2. Carga Phaser 3.80.1 de cdnjs y **los scripts de `base/index.html` en su orden**, salvo `main.js` (crea su propio `Phaser.Game`) y `tactil.js` (mandos HTML). Se bajan con `fetch` y se insertan en línea con `sourceURL`; así el texto queda a mano para el escaneo de recursos.
3. Crea su propio `Phaser.Game` con la lista de escenas de `main.js` (leída de su texto) **sin `Arranque` ni `Barrio`**, más dos suyas: `PuenteEspera` (pantalla de espera que dibuja las texturas de `Arranque` prestándole sus métodos, sin su `preload` ni la pregunta de la edad) y una `Barrio` de sustitución que devuelve el control al puente.
4. **Carga perezosa**: `Arranque` bajaría 48 MB de imágenes y todo el sonido. El puente escanea el código del archivo de cada escena (literales `'clave'` y plantillas `` `n-${id}-caminando` ``) contra el catálogo de `Arranque` (`IMAGENES`, `SPRITES`, `SONIDOS`) y baja solo eso, más lo común de `comun.js`/`comic.js` (sin sus tablas por minijuego). Lo que el escaneo no ve va en `EXTRA` (Liar, Control); si aun así una escena pide una textura del catálogo sin cargar, se apunta en `metricas.faltan`, se avisa con `console.info` y se baja en el acto.
5. **Bucle**: Phaser no usa su `requestAnimationFrame` (se anula `loop.raf.start` en `postBoot`). En una sesión inmersiva la página no recibe rAF, así que lo mueve `p.actualizar()` desde el bucle de three/XR (como mucho `fpsMax` pasos por segundo, con deuda acumulada para 72/90/120 Hz) y solo entonces marca `textura.needsUpdate`. Si nadie llama a `actualizar()` durante 100 ms, un `setInterval` de respaldo sigue moviéndolo (arranque, cargas).
6. **Entrada**: `tecla()` despacha `KeyboardEvent` sintéticos en la ventana del iframe con `key`, `code`, `keyCode`/`which` y `repeat` (como `tactil.js`). `puntero()` llama directamente a `onMouseDown/Move/Up` del `InputManager` de Phaser con un evento falso cuyo `target` es el lienzo (Phaser solo emite `pointerdown` si el elemento pulsado es su canvas); `windowEvents: false` y `touch: false` evitan que el ratón real de la página se cuele.

## Qué se parchea en tiempo de ejecución (nada de `base/` se toca)

| Qué | Cómo |
|---|---|
| `localStorage` | En el `Storage.prototype` **del iframe**, `getItem/setItem/removeItem` de `'unake-partida'` van a `'unake-xr-puente'`. La partida del juego web ni se lee ni se pisa (comprobado con una partida centinela). |
| `panelFinal` | Envuelto: entrega el resultado **al instante** y luego deja (o no, con `panel: false`) el panel original. |
| `irA` | `irA(escena, 'Barrio')` o hacia una escena no registrada → vuelta a la espera sin cortinilla (evento `salir`). Las demás (p. ej. «Otra vez») siguen su curso. |
| `Barrio` | Escena de sustitución: si un minijuego hace `scene.start('Barrio')` por su cuenta, vuelve al puente. |
| `Musica.poner` | Solo suena la música del minijuego mientras hay uno en marcha (`musica: false` la apaga). La del barrio no puede sonar: `Barrio` nunca se ejecuta. |
| `matchMedia('(pointer: coarse)')` | Falso solo mientras se cargan los scripts: `MOVIL = false` (maqueta de escritorio, mirilla que sigue al puntero). |
| `TextureManager.get` | Detecta texturas del catálogo pedidas sin cargar. |
| Sonido | Phaser usa un `AudioContext` de la página XR (`audio.context`) y `pauseOnBlur = false`. |

**Cuándo resuelve `jugar()`**: en cuanto el minijuego llama a `panelFinal`, no al cerrar el panel. Es lo robusto: no depende de que alguien pulse un botón del panel, ni del remate de cómic, ni de `mostrarPanelFinal` (que toca economía del barrio: `bonoDeco`, `aplicarModPartida`, situaciones). El panel se sigue viendo (`panel: true`): «Al barrio (Esc)» vuelve a la espera y «Otra vez (Enter)» relanza la escena (esa nueva partida llega por el evento `resultado`, no por la promesa). Con `panel: false` no se pinta panel ni se apunta nada en `ESTADO` y se vuelve solo a la espera a los 1,5 s. Si se sale sin `panelFinal` (Esc en mitad, `cerrar()`, otro `jugar()`), la promesa resuelve `{ abandonado: true, motivo }`.

## Coste medido

PC con Intel UHD (ANGLE/D3D11), Chrome headless, ventana 1280×800, `herramientas/pruebas/medir.mjs`. Son números de PC: **hay que repetirlos en la Quest 3S**.

| | fps bucle three | CPU/fotograma (actualizar + render) | paso de Phaser |
|---|---|---|---|
| Sin puente (`?sin`) | 165 | 0,16 ms | — |
| Puente WebGL, en espera | 56 | 0,58 ms | 0,22 ms |
| Puente WebGL, Pipas en marcha | 51 | 0,86 ms | 0,67 ms |
| Puente canvas 2D, en espera | 128 | 0,39 ms | 0,21 ms |
| Puente canvas 2D, Pipas en marcha | 70 | 0,46 ms | 0,35 ms |

- La CPU apenas sube; el coste está en la **GPU**: copiar 60 veces por segundo un lienzo WebGL de otro contexto (con `preserveDrawingBuffer`) a una textura de three. Canvas 2D sale más barato aquí, pero pierde lo que solo hace WebGL (tintes, máscaras, que usan 30 de los 40 archivos de escena). Queda `webgl` por defecto por fidelidad; en la Quest hay que medir los dos y probar `fpsMax: 30`.
- **Arranque**: 0,8-1,3 s en local (iframe + Phaser + 26 scripts + letra + 53 recursos comunes, ≈4 MB). **Carga por minijuego**: 20-250 ms y 4-93 archivos (Pipas 9, TiroPato 16, Fumar 93). Descarga total de una sesión Pipas: 4,2 MB, frente a los 101 MB de `base/assets`.
- **Memoria**: texturas ≈20 MB RGBA en espera + minijuego; heap JS 21-28 MB; el tema de música decodificado ≈40 MB de PCM (por eso `cerrar()` lo suelta). Al cambiar de minijuego se descarga lo que solo usaba el anterior.

## Qué se ha probado

`herramientas/pruebas/prueba_puente.mjs` (capturas en `herramientas/pruebas/fotos/`), todo en verde y con cero errores de consola:

- **Pipas** jugado hasta el final con `p.tecla('Space')` → resultado; «Al barrio (Esc)» vuelve a la espera. **Pipas otra vez** (misma instancia de escena) → resultado; «Otra vez (Enter)» relanza; `cerrar()`.
- **Cuentas** dos veces seguidas con flechas sintéticas y `panel: false` → resultado y vuelta sola a la espera.
- **TiroPato** con `p.puntero(u, v)` (123 disparos, 121 aciertos) → resultado; además, el ratón real sobre el plano (raycast → UV → `puntero`) deja la mirilla en el píxel esperado.
- `'unake-partida'` intacta, la partida del puente en `'unake-xr-puente'`; solo ha sonado el hueco de música `minijuego`.

`herramientas/pruebas/barrido.mjs` arranca las 40 escenas registradas unos segundos: **todas arrancan sin errores ni texturas que falten**. Sin `EXTRA`, a Liar le faltaba `mano-h-*` y a Control `lasslow-digno`; Fumar (93 archivos) tumbaba el servidor local con las 32 descargas en paralelo de Phaser, por eso el puente baja de 8 en 8 (Fumar: 320 ms).

## Las 40 escenas: qué espero que falle y por qué

Cómo vuelven al barrio: los minijuegos acaban en `panelFinal` (comun.js) y su panel sale por `irA(escena, 'Barrio')`; ninguno llama a `scene.start('Barrio')` a pelo. Los que no tienen `panelFinal` salen por `irA` hacia otra escena.

- **Funcionan tal cual** (terminan en `panelFinal`, sin datos de entrada): Pipas, Cuentas, TiroPato (probados), Tarta, Lasslow, Barra, Periquito, Inspeccion, Aires, Palo, Sigilo, Escucha, Rendija, Compostura, EnSuPunto, Mirando, Recuerdo, Recreativa, Tormenta, Rescate, Blancazo.
- **Necesitan arreglo o cuidado**:
  - **DJ**: el ritmo sale de `musica.seek` del tema de la intro; si el `AudioContext` está suspendido (en la Quest, sin gesto), no avanza. Hay que llamar a `p.desbloquearAudio()` al entrar en la sesión.
  - **Liar → Fumar**: no tienen `panelFinal`; Liar salta a Fumar y Fumar sale al barrio → la promesa resuelve `abandonado`. Fumar sin `datos` (porro, calidad, tipo) arranca con valores por defecto. Hace falta un resultado propio (envolver `Fumar.prototype` al salir).
  - **Furgo ↔ Control**: se pasan el turno con `irA(…, { encargo, resumen })`; Control suelto, sin `desdeFurgo`, no tiene encargo. Hay que lanzarlos como cadena y cobrar el último `panelFinal`.
  - **Casetas**: hace `irA(this, 'TiroPato')`; los recursos de TiroPato no se han bajado antes (el escaneo es por archivo) → falta el respaldo perezoso o un `EXTRA`.
  - **Contrasena, Farol, Amarillo, Camaras**: dependen de `ESTADO` del barrio (`dentro`, `faltaCaja`, la fase guardada de Amarillo, `camarasVistos`). Con la partida limpia del puente funcionan, pero no reflejan la del jugador: hay que pasar el estado con `jugar(…, { estado })`.
  - **Tragaperras, Carrera** (apuestas.js): sin `panelFinal`; salen con «Volver (Esc)» → `abandonado`. Necesitan su propio resultado.
  - **Escenas de historia** (Portada, Intro, Puerta, Circulo, Final, Cuenta, Poscreditos): no son minijuegos; se registran para que `irA` no reviente, pero no dan resultado.
- **Riesgos para la Quest**: coste de GPU de la copia de textura (ver tabla); dos contextos WebGL en la misma página; el audio necesita gesto (`desbloquearAudio()` en el `select` que abre la sesión); el texto de 1280×720 en un plano de 1,6 m se lee justo a 1-1,5 m; la memoria de la música decodificada.
