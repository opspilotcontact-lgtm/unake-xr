# RETOMAR · UNAKÉ XR (léelo PRIMERO al volver)

> Traspaso del 23-24/11/2026. Si la sesión se cortó, aquí está todo para seguir en orden. Después lee `docs/PLAN.md` (decisiones, escalas y fases), `docs/minijuegos.md` (contrato de los minijuegos nativos) y `docs/puente.md` (el puente al 2D).

## 1. Qué es y dónde está

- **Juego**: UNAKÉ (serie VOPPË), port a realidad virtual y mixta para **Meta Quest 3S** (WebXR, three.js 0.170 por importmap, sin build).
- **Repo**: `Documents/GitHub/unake-xr` (público: `opspilotcontact-lgtm/unake-xr`, rama **main**).
- **En vivo**: https://opspilotcontact-lgtm.github.io/unake-xr/ (cada push a main actualiza Pages en 1-2 min).
- **Regla de oro**: `base/` es una COPIA del juego 2D (`VOPPE SERIE/07_juego/web`) y **no se toca**; nada de `VOPPE SERIE` se edita (las herramientas lo leen en solo lectura).
- **Criterio del juego** (obligatorio para todo agente): `VOPPE SERIE/07_juego/criterio.md`.
- **Textos del juego**: español de España, de tú. Commits convencionales en español, sin atribución a IA.

## 2. Decisiones del fundador (no re-preguntar)

1. **Día = passthrough (tu casa)**. La calada llena la habitación de humo y aparece el Unaké del humo (VR). Cuando baja el colocón, vuelve tu casa.
2. La **puerta de Unaké va en tu pared real**.
3. **Barrio**: maqueta en tu mesa + entrar a tamaño real.
4. **Puente**: los minijuegos aún no portados se juegan en su Phaser original dentro del mundo.
5. **Micro** solo por volumen (soplar = el humo sale de tu boca: le encanta).
6. Fumar como en el 2D.
7. Solo Quest 3S, de pie o sentado; duración libre.
8. **Partida aparte** (`unake-xr-partida`; el 2D usa `unake-partida` en el mismo origen).
9. **Subagentes sí**, medidos, con plan y pruebas. Opción C: yo hago el esqueleto y los agentes, los minijuegos.
10. Feedback tras probar en la Quest:
    - las manos van bien;
    - quiere física, fumar más largo, notar el pase, moverse físicamente y con joystick;
    - que sea «peak para jugar fumado» con momentos visuales puntuales que no corten.
11. **24/11: TODO hilado con la historia y la economía TAL CUAL el 2D**, nada de piezas sueltas.
    - **Decisión técnica**: el motor único de historia y economía es el propio código del 2D, corriendo en el iframe del puente (`p.win`: `ESTADO`, `apuntar`, `PAGO_ESTRELLAS`…). El XR solo presenta y avisa.

## 3. Qué hay publicado (main, 24/11 tarde) · probado en PC/emulador; en la Quest, F0 y En su punto

| Pieza | Archivos | Prueba |
|---|---|---|
| Flujo: puerta, contraseña, empujar, liar, mechero, caladas, pase, día ↔ humo | `js/app.js`, `puerta.js`, `porro.js`, `recortable.js`, `decorado.js`, `humo.js`, `ui.js`, `xr.js` | `bot_f0.mjs` |
| **Manos visibles** (guantes con mandos; juntas con seguimiento de manos en el humo) y **chuleta de botones** encima de cada mano (al cambiar de fase y al mirarte la mano de cerca) | `js/manos_visibles.js`, `AYUDAS_FASE` en `app.js`; un minijuego puede traer `ayudas` | `bot_f0.mjs` (fotos) |
| Historia: 17 capítulos + economía del 2D (motor = código del 2D en el puente). **Ya sin «Seguir la historia»**: Furgo, Control, Casetas y Amarillo son nativos | `js/historia/` | `historia.mjs` |
| **Puertas entre salas** como en el 2D (calle y Unaké por dentro; el bar del humo es la sala `dentro`) y **«sigue el hilo de humo»** hacia donde manda la historia. Se cruza andando o señalando + gatillo/pellizco | `js/barrio/portales.js`, `cruzar/irASala/pasoPuertas` en `app.js` | `portales.mjs` |
| **Máquina recreativa física**: ENCENDER/ELEGIR/START/SALIR, palanca grande a la izq., botones 1-4 a la dcha. con rótulo por juego, mini interfaz arcade; la misión de la historia sale la primera con ★ (`recreativa.pedir`) | `js/recreativa.js`, `js/recreativa/*`, `maquina.html` | `maquina.mjs`, `recreativa.mjs` |
| Menú de la muñeca en UNA fila: ★ misión · Minijuegos · Mapa · Cerrar | `abrirMenu` en `app.js` | `menu_minijuego.mjs <id>` |
| Fumar: el humo sale solo al segundo de acabar la calada (el micro es un extra) | `app.js` | `bot_f0.mjs` |
| **Nativos**: Liar, Fumar, Pipas, Tiro al pato, Cuentas, Casetas, Furgo, Control, Amarillo. **En su punto vuelve a la máquina** (en la Quest iba fatal) | `js/minijuegos/` | `minijuego.mjs <id> <puerto>` |
| Barrio: 10 salas día/humo + maqueta (ahora «Mapa») | `js/barrio/` | `barrio_juego.mjs` |

## 4. Lo que quedó a medias

Nada a medias: todo lo de la tabla está en main.

**Para probar en la Quest** (avisos de los agentes):
- Manos: que los guantes casen con el mando; la chuleta legible.
- Puertas: que cruzar andando no salte sin querer en el bar (están a ≥1,3 m); el hilo de humo es blanco (el brillo de la puerta, dorado).
- Máquina: pulsar botones con la mano real (tolerancia 1,2 cm); el gatillo al coger la palanca puede pulsar el botón 1; sentado, la máquina se hunde un poco.
- Furgo: girar el volante con manos; si el cambio de carril marea; la elección de acompañantes pesa (~80 llamadas de dibujo con 7 personajes).
- Amarillo: mano abierta para parar vs pellizco; la burbuja de la Pompa 5,5 s delante.
- Casetas: la noria (altura entre manos) y el golpe de martillo sentado.

## 5. Lo siguiente, en este orden

1. **El fundador prueba en la Quest** (manos, chuleta, puertas, máquina, furgo) y se arregla lo que salga.
2. **Materiales para liar** (decisión pendiente: A kit + exigir desde el cap. 2 · B gratis · C exigir con regalo).
3. **Las cosas de cada sala**: tocar a Cotine/Palicaso/Lasslow te da su misión allí; la tienda (comprar tocando, `motor.comprar`); la hucha en la plaza (aportar tocando a Blancaso); comer = llevarlo a la boca.
4. **Pendientes técnicos pedidos por agentes**: `ctx.nivel` real; `inst.abandonar()` al salir a mitad (amarillo); `ESTADO.furgoAcompanantes` en el motor en vez de localStorage; `ui.tarjetasEn` multilínea; dónde poner «Otra vez / Salir» (dentro de la cabina queda pegado); hornear al feriante.
5. **Sistemas**: negocio, apuestas, encargos, situaciones con recogida, armario, logros, noches.
6. **Cine**: intro, final, círculo, cuenta.

## 6. Cuenta de lo que queda (24/11 noche, tras la ola de 10 agentes)

Decisiones del fundador (24/11): no todo a nativo, pero que el mundo sea **vivo y jugable** y ordenado como el 2D (dar vueltas o seguir la historia).

| | Hecho | Falta |
|---|---|---|
| Minijuegos | **21 nativos** (Pipas, Tiro, Cuentas, Casetas, Furgo, Control, Amarillo, Barra, Farol, Tarta, Palo, Periquito, Un señor, Sigilo, Mirando, Inspección, Escucha, DJ, Blancazo + Tragaperras y Carreras); 9 en la máquina (Rescate, Aires, Rendija, Compostura, Tormenta, Recuerdo, Cámaras, Recreativa, En su punto) | probar en la Quest y ajustar dificultad/tolerancias |
| Mundo | cada minijuego en su sitio y con su personaje (`js/barrio/lugares.js`), gente que se mueve y charla (`vida.js`), puertas y guía de humo, encargos, tienda, hucha, negocio (casa de muñecas), cuarto (armario, taller, logros), decoración 3D, sonido ambiente | — |
| Historia | 17 capítulos, 56 objetivos alcanzables (`docs/objetivos-vr.md`), guía y pistas | escenas actuadas en 3D (hoy viñetas), cine (intro, final, círculo, cuenta) |
| **Total aprox.** | **~75-80 %** | escenas y cine + rondas de prueba en la Quest |

Cómo se enchufa un nativo nuevo: dejar `js/minijuegos/<id>.js` y su clave en `NATIVO_DE` (`js/barrio/lugares.js`); la historia lo usa sola (`_accionViva` convierte «recreativa» en «nativo» si existe).

## 7. Cómo encargar a un agente (plantilla probada)

Cada encargo ha ido bien con esto:
- contexto (`docs/PLAN.md`, `docs/minijuegos.md`, `criterio.md`, la escena original en `base/js/escenas/`);
- diseño VR concreto (escala, gestos, personajes);
- «no toques los archivos comunes, pídelo en el informe»;
- **servidor propio en un puerto 1877x** y bot con `node herramientas/pruebas/minijuego.mjs <id> <puerto>`;
- «que gane, que pierda, “Otra vez”, cero errores, mira las fotos»;
- informe corto.

Los agentes gastan 160-280 mil tokens cada uno.

Pendientes técnicos que pidieron los agentes:
- `fisica.js`: viento global, cilindros abiertos, varios oyentes de agarre e ignorar planos en los inmersivos;
- exportar `conTinta` de `porro.js`;
- `xr.js`: `targetRaySpace`;
- `marco.js`: que `reiniciar` quite las tarjetas;
- unificar `decorado.js` con `barrio/proyeccion.js`;
- arranque común (marco/pagina/app);
- `ALTOS` duplicado;
- Tiro al pato pesa ~90-130 draw calls.

## 8. Probar

- Local: `python servir_lan.py --local` (cola de 128 conexiones: con la de 5, Windows rechazaba las del puente) → http://127.0.0.1:18765 (`?emular` = emulador de Meta). Quest en LAN: `python servir_lan.py` → https://IP:18764.
- Pruebas (servidor local en marcha), en `herramientas/pruebas/`: `bot_f0.mjs` (flujo entero), `emulador_f0.mjs`, `joystick.mjs`, `momentos.mjs`, `menu_minijuego.mjs <id>`, `recreativa.mjs`, `barrio.mjs`, `barrio_juego.mjs`, `minijuego.mjs <id> <puerto> <s>`, `coste.mjs`.
- **Antes de cada push**: `bot_f0.mjs` con `"fin":true` y «sin errores». Ojo: no encadenar `&&` tras un `tail` (una vez se publicó sin mirar el error).
- Playwright: `Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core`, `chromium.launch({ channel: 'chrome' })`.

## 9. Trampas aprendidas

- **WebXR**: el joystick desplaza el espacio de referencia (`getOffsetReferenceSpace`). Signos medidos en el emulador: origen en −v = te mueves +v. De día hay que volver a `refBase` o la puerta se despega de la pared.
- **Chrome**: cachea los módulos (el servidor manda `no-store`, o se usa `?v=`). Los puertos 875x y 18744/5 son de otras sesiones.
- **TDZ**: no usar en `J.*` una `const` declarada más abajo de `app.js` (rompió la carga una vez; usar un getter).
- **Parches**: los parches con heredoc en bash se rompen con comillas y acentos. Escribir el script a un archivo del scratchpad y ejecutarlo.
- **Horneado**: `hornear_personajes.py` tarda ~14 min (`--indices` para solo los índices).
- **Cortinilla**: menos de 2 s tapando; el humo de ambiente del bar se disipa al volver al día.

## 10. Prompt para pegar al volver

```
Retoma UNAKÉ XR: lee Documents/GitHub/unake-xr/docs/PLAN-MAESTRO.md (manda sobre todo), luego docs/RETOMAR.md y VOPPE SERIE/07_juego/criterio.md. Te paso mis respuestas a las decisiones del §9 del plan. Arranca la F0 con agentes medidos (dueños de archivos sin solapes) y publica en main solo lo que pase la batería del §7.
```
