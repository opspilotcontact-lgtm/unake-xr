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

## 3. Qué hay publicado (main, `eda6e7f`) · probado en PC/emulador, en la Quest solo F0

| Pieza | Archivos | Prueba |
|---|---|---|
| Flujo F0: puerta, contraseña, empujar, liar, mechero, caladas, pase, día ↔ humo | `js/app.js`, `puerta.js`, `porro.js`, `recortable.js`, `decorado.js`, `humo.js`, `ui.js`, `xr.js` | `bot_f0.mjs`, `emulador_f0.mjs` |
| Fumar 14 caladas, micro (chorro + aros por soplido), formas sin micro, pase en ronda | `app.js` | `bot_f0.mjs` |
| Física propia (coger y lanzar contra tu casa real o el bar), golpes a colegas | `fisica.js` | `momentos.mjs` |
| Joystick en el humo (andar, giro 30°, viñeta), recolocación de día | `xr.js` | `joystick.mjs` |
| Momentos de colocón (neón, onda, chuches, figuras, miradas, estrellas) | `viaje.js` | `momentos.mjs` |
| Menú de la muñeca (tocar el panel del colocón o B/Y) | `app.js` | `menu_minijuego.mjs` |
| Pipas y Tiro al pato nativos | `js/minijuegos/` | `minijuego.mjs pipas/tiropato` |
| Recreativa: 22 minijuegos del 2D por el puente | `recreativa.js`, `js/puente/` | `recreativa.mjs` |
| Barrio: 10 salas día/humo + maqueta, dentro del juego | `js/barrio/`, `app.js` | `barrio.mjs`, `barrio_juego.mjs` |

## 4. A medias cuando se escribió esto (copia en la rama `wip-f1`, NO en main)

Tres agentes estaban trabajando. Su trabajo está en el disco y copiado en `origin/wip-f1` (`24655b8`).

| Encargo | Archivos | Puerto |
|---|---|---|
| **Motor de historia + economía**: 17 capítulos, objetivos que se cumplen por cualquier camino, escenas en viñetas/bocadillos, muñeca; economía del 2D vía el iframe del puente | `js/historia/` (datos, motor, escenas, muneca, pagina), `historia.html`, cambio en `js/puente/puente.js`, `docs/historia.md`, `herramientas/pruebas/historia.mjs` | 18775 |
| **Cuentas** nativo (mesa, Blancaso) | `js/minijuegos/cuentas.js` + `bots/cuentas.js` | 18776 |
| **En su punto** nativo (la Pompa en tu techo real) | `js/minijuegos/ensupunto.js` + `bots/ensupunto.js` | 18777 |

**Al volver, si los agentes ya no corren:**
1. `git status`. Si faltan sus archivos en el disco: `git checkout origin/wip-f1 -- js/historia historia.html js/minijuegos/cuentas.js js/minijuegos/ensupunto.js herramientas/pruebas/bots/cuentas.js herramientas/pruebas/bots/ensupunto.js js/puente/puente.js`.
2. Comprobar cada pieza con su prueba (`node herramientas/pruebas/minijuego.mjs cuentas 18765 240`, `… ensupunto …`, `historia.mjs` si existe). Si algo está a medias, se relanza un agente con el mismo encargo («continúa desde lo que hay en el disco»). Los encargos completos están en la sección 7.
3. `js/puente/puente.js` cambiado: volver a pasar `node herramientas/pruebas/recreativa.mjs` (y `prueba_puente.mjs`) antes de publicar.

## 5. Lo siguiente, en este orden (F1: el juego entero hilado)

1. **Enganchar el motor de historia** en `app.js`, siguiendo `docs/historia.md` (lista de llamadas):
   - arranque de partida = prólogo del cap. 1 (la puerta);
   - capítulos en orden con escenas y objetivos en la muñeca;
   - `motor.avisar(...)` en caladas, liar, pase, mundo, salas, minijuegos (nativos y recreativa).
2. **Economía real**:
   - cobrar con la fórmula del 2D (15/35/60/100 por estrellas, ×1,5 en humo, repetición ×0,75/0,5/0,3, +20 por estrella nueva);
   - hucha: aportar a Blancaso;
   - monchis en la muñeca.
3. **Materiales para liar**:
   - papel y mechero en la tienda;
   - bolsita en la barra;
   - boquilla escondida en una sala (la pista de Perico);
   - sin ellos no se lía (como el 2D).
4. **Tienda del barrio** (sala `tienda`): comprar tocando los productos; precios de `TIENDA` en `base/js/escenas/barrio.js`.
5. **Hambre y vida** (`ESTADO.hambre`/`vida` del 2D): comer = llevarse la comida a la boca; con vida 0, amarillo y a tu cuarto.
6. **Desbloqueos por la historia**: cada minijuego aparece en su sala del barrio cuando la historia lo abre, y se queda.
7. **Publicar** y que el fundador pruebe en la Quest.
8. **Después, por tandas de 3 agentes**: el resto de minijuegos a nativo y luego los sistemas.
   - Minijuegos: Barra, Tarta, Periquito, Inspección, Farol, Furgo+Control, Casetas, jefes (Blancazo, Palo, Amarillo), DJ, Cámaras…
   - Sistemas: negocio (tycoon), apuestas, encargos, situaciones, armario, logros.
   - Cine: intro, final, círculo, cuenta, poscréditos.

## 6. Cuenta de lo que queda (24/11)

| | Hecho | Falta |
|---|---|---|
| Minijuegos (31 en el 2D) | 4 nativos (Pipas, Tiro al pato, Liar y Fumar F0) + 2 en curso | ~23 a nativo. Hoy ~18-20 se juegan por la recreativa; Furgo+Control, Casetas y Amarillo aún no |
| Historia (17 caps + intro/final/círculo/cuenta/poscréditos) | motor en curso | enganche y cine |
| Sistemas | barrio, fumar, física, joystick, momentos | economía, tienda, necesidades, negocio, apuestas, encargos, situaciones, armario, logros |
| **Total aprox.** | **~25 %** | ~30 encargos, ~8-10 M tokens, ~10-12 tandas de 3 agentes |

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
Retoma UNAKÉ XR: lee Documents/GitHub/unake-xr/docs/RETOMAR.md y sigue su sección 4 (comprobar lo que quedó a medias en wip-f1) y luego la 5 en orden. Usa subagentes medidos como en la sección 7. Publica en main solo lo que pase bot_f0.mjs sin errores.
```
