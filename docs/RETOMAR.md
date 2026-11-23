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

## 3. Qué hay publicado (main, cierre del 24/11 madrugada · `a5415b6`) · probado en PC/emulador; en la Quest solo F0

| Pieza | Archivos | Prueba |
|---|---|---|
| Flujo: puerta, contraseña, empujar, liar, mechero, caladas, pase, día ↔ humo | `js/app.js`, `puerta.js`, `porro.js`, `recortable.js`, `decorado.js`, `humo.js`, `ui.js`, `xr.js` | `bot_f0.mjs` (pasa también las escenas de historia con pellizco) |
| **Historia: 17 capítulos + economía del 2D** (motor único = código del 2D en el iframe del puente, partida `unake-xr-partida`). Escenas en VR, objetivos en la muñeca, tarjeta ★ en el menú | `js/historia/` (datos, motor, escenas, muneca), `docs/historia.md` | `historia.mjs` (14 min), `bot_f0.mjs` |
| Fumar 14 caladas, micro (chorro + aros), formas sin micro, pase en ronda | `app.js` | `bot_f0.mjs` |
| Física, golpes a colegas, joystick en el humo, momentos de colocón | `fisica.js`, `xr.js`, `viaje.js` | `momentos.mjs`, `joystick.mjs` |
| Menú de la muñeca, en dos filas: ★ objetivo, 4 nativos, Recreativa (2D), El barrio | `app.js` | `menu_minijuego.mjs <id>` |
| **6 minijuegos nativos**: Pipas, Tiro al pato, La caja de Blancaso (Cuentas), La Pompa en su punto (en tu techo real) + Liar y Fumar | `js/minijuegos/` | `minijuego.mjs <id>` |
| Recreativa: 22 minijuegos del 2D por el puente (`panel:false`: cobra el motor) | `recreativa.js`, `js/puente/` | `recreativa.mjs` |
| Barrio: 10 salas día/humo + maqueta, dentro del juego (máx. 3 salas en memoria) | `js/barrio/`, `app.js` | `barrio.mjs`, `barrio_juego.mjs` |

## 4. Lo que quedó a medias

Nada a medias: los 4 agentes de la noche terminaron, revisé su trabajo y está todo en main. La rama `wip-f1` se borró.

**Avisos de los informes** (para revisar al probar en la Quest):
- **Historia**:
  - capítulos jugables enteros: 1-10, 12·II, 13, 14 y 16, casi todos con minijuegos de la recreativa;
  - con «Seguir la historia» (sin minijuego aún): 11 La furgo (Furgo + Control), 12·I (Casetas) y 15 (Amarillo);
  - el encargo de la tienda del cap. 1 se cumple ganando cualquier minijuego;
  - las situaciones se saltan el paso de recoger por el barrio.
- **Cuentas**: se pierde con 5 fallos (como en el 2D); Blancaso se derrite a los 3.
- **En su punto**: la Pompa queda a 1 m por encima de tu cabeza como mucho, para alcanzar la válvula.
- **Recreativa y motor**: comparten UN puente (carga ~1 s y ~4 MB al arrancar: medir en la Quest).

## 5. Lo siguiente, en este orden

1. **El fundador prueba en la Quest** y se arregla lo que salga: textos de las escenas, muñeca, pellizcos, rendimiento del puente.
2. **Materiales para liar** (decisión pendiente del fundador). Propuesta del agente: kit al empezar (papel ×3 + mechero) y exigirlo desde el cap. 2, con `motor.gastarLiar()` y `motor.faltaParaLiar()` en `sacarBandeja()`. Hoy se lía gratis para no bloquear el bucle básico.
3. **Tienda en la sala `tienda`** del barrio: comprar tocando productos con `motor.comprar(id)` (precios `TIENDA` del 2D). Comer = llevárselo a la boca (`r.efecto.colocon` → `J.colocon`).
4. **Hucha y monchis visibles**: aportar a Blancaso, monchis en la muñeca. El motor ya los lleva.
5. **Desbloqueos por la historia**: cada minijuego, en su sala del barrio cuando la historia lo abre.
6. **Minijuegos que faltan para la historia**: Furgo + Control (cap. 11), Casetas (cap. 12·I) y Amarillo (cap. 15), primero en nativo.
7. **Tandas de 3 agentes**:
   - el resto a nativo: Barra, Tarta, Periquito, Inspección, Farol, jefes, DJ, Cámaras…;
   - sistemas: negocio, apuestas, encargos, situaciones con recogida en el barrio, armario, logros, noches;
   - cine: intro, final, círculo, cuenta.

## 6. Cuenta de lo que queda (24/11, cierre)

| | Hecho | Falta |
|---|---|---|
| Minijuegos (31) | 6 nativos + ~18 por la recreativa | ~21 a nativo; Furgo+Control, Casetas y Amarillo aún sin jugar en XR |
| Historia | 17 capítulos enganchados (14 enteros, 3 con «Seguir») | pulir escenas en la Quest, cine |
| Economía y sistemas | motor del 2D con pagos, hucha, tienda, hambre, vida y amarillo por API; barrio, fumar, física, joystick, momentos | tienda, materiales y hucha EN VR; negocio, apuestas, encargos, situaciones, armario, logros |
| **Total aprox.** | **~35-40 %** | ~25 encargos, ~6-8 M tokens, ~8-10 tandas |

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

- Local: `python servir_lan.py --local` → http://127.0.0.1:18765 (`?emular` = emulador de Meta). Quest en LAN: `python servir_lan.py` → https://IP:18764.
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
Retoma UNAKÉ XR: lee Documents/GitHub/unake-xr/docs/RETOMAR.md y sigue su sección 5 en orden (lo primero, lo que haya salido al probar en la Quest). Usa subagentes medidos como en la sección 7. Publica en main solo lo que pase bot_f0.mjs sin errores.
```
