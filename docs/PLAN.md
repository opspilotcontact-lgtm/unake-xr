# UNAKÉ XR · plan del port a realidad virtual y mixta

> **Antes que nada: `docs/PLAN-MAESTRO.md` (24/11 noche) manda sobre este plan en todo lo que sea calidad del conjunto.**
> **Retomar leyendo esto.** Juego: UNAKÉ (VOPPË), port del juego web en Phaser (`base/`, COPIA de `VOPPE SERIE/07_juego/web`) a WebXR para **Meta Quest 3S**.
> Regla de oro: **nunca se toca `base/` ni nada de `VOPPE SERIE`** (los scripts de `herramientas/` leen la serie en solo lectura).
> Criterio del juego: `base/../` → el original vive en `VOPPE SERIE/07_juego/criterio.md`. Todo agente lo lee antes de empezar.

## 1. Decisiones del fundador (23/11/2026)

- **Los dos mundos son el hardware.** De día = realidad mixta (tu casa por el passthrough). La calada llena la habitación de humo y, cuando se va, estás en el Unaké del humo (VR). Cuando el colocón baja, el humo se va y vuelve tu casa.
- **La puerta de Unaké se ancla a una pared real.** Se abre empujándola, como en el final del piloto.
- **Barrio**: maqueta en tu mesa + entrar a tamaño real en cada sala.
- **Puente**: mientras un minijuego no esté portado, se juega su versión Phaser original en una pantalla dentro del mundo (`js/puente/`, ver `docs/puente.md`).
- **Micro opcional, solo volumen** (soplar el humo, gritar «¡periquito!»). El reconocimiento de voz no es fiable en el navegador de la Quest.
- **Fumar como en el 2D.**
- Solo gafas (Quest 3S), **de pie o sentado**. La duración, libre.
- **Partida aparte**: clave `unake-xr-partida`. El 2D usa `unake-partida` en el MISMO origen de GitHub Pages: no se pisan.
- Subagentes sí, pero medidos, con plan y con pruebas.

## 2. Arte: «la serie en recortable»

- **Personajes**: `herramientas/hornear_personajes.py` usa el motor de la serie (`motor/v1/rig.py`) para hornear cada pose, el parpadeo y las bocas de hablar → `assets/personajes/<id>/{humo,normal}/`. Tarda unos 14 min; con `--indices` rehace solo los índices.
  - En el juego son recortables de cartón (`js/recortable.js`): borde de troquel, canto, respiran, parpadean, mueven la boca al hablar, cambian de pose con rebote y se ladean hacia ti.
  - El mundo **normal** sale casi de foto (personas con cabeza de su sensación); el **humo**, de dibujo.
- **Salas desde la foto** (`js/decorado.js`, «tour into the picture»): un fondo de la serie en perspectiva de un punto se convierte en una caja 3D (suelo, paredes, techo), y la imagen se proyecta desde el ojo de quien la pintó. Lo que el dibujo no ve se rellena con el borde desenfocado.
  - Medidas de cada sala: punto de fuga + rectángulo de la pared del fondo (`SALA_DENTRO`).
  - Para medir una sala nueva, sacar una rejilla como `herramientas/pruebas/fotos/grid-dentro.jpg`.
- **Decorados**: `herramientas/preparar_escenarios.py` recorta de `02_escenarios/*/capas/` (fachada con la puerta, neón, sofá, paredes).
- **Objetos que se cogen** (porro, mechero, bandeja): 3D sencillo con contorno de tinta (`porro.js`).
- **Humo**: una sola malla instanciada con la bocanada de la serie (`fx-humo-puff`). Sirve para exhalar, los aros, el ambiente y la cortinilla.

## 3. Escalas y cada minijuego en la suya

MESA = juguete sobre tu mesa · SALA = lo del humo entra en tu habitación real · INMERSIVO = VR completa.

| Minijuego | Escala | Cómo |
|---|---|---|
| Liar | inmersivo / mesa real | Con las manos: picar, rellenar, liar, cerrar. **HECHO en F0** |
| Fumar | inmersivo | Boquilla a los labios, medidor de franjas de fumar.js, soplar al micro, pasarlo en mano. **HECHO en F0** |
| Contraseña (puerta) | sala | Tarjetas que se tocan; la puerta se empuja. **HECHO en F0** |
| Pipas | sala | Lanzar de verdad a una papelera que se mueve por tu suelo |
| Tiro al pato | inmersivo | Escopeta de corcho; recargar metiendo el corcho |
| Casetas | inmersivo / mesa | Martillo de verdad; noria inclinando con las dos manos |
| Cuentas | mesa | Clasificar con la mano en bandejas |
| Barra | inmersivo | Coger del estante y dárselo al cliente; a Puky, de un empujón |
| Tarta | inmersivo | Plato en la mano; patatas a la boca de Cotine |
| Inspección | sala | Esconder cosas detrás de la espalda cuando el casero se gira |
| En su punto | sala | La Pompa en TU techo real; válvula con pellizco |
| Furgo + Control | inmersivo, sentado | Volante con dos manos; gafas, manivela, tapar bocas |
| Blancazo / Palo / Amarillo | sala (el amarillo, inmersivo) | Jefes en tu habitación; esquivar con el cuerpo |
| ¡Periquito! / Escucha / Compostura / Un señor | inmersivo | Gritar al micro, mano en la boca, respirar |
| Farol | inmersivo | Dados en la barra; acercarte a mirarle |
| DJ | inmersivo | Burbujas sobre tres platos a 93,5 BPM (sin clonar juegos de sables) |
| Cámaras | inmersivo | Pared de monitores; nocturna/térmica = gafas que te pones |
| Sigilo / Rendija / Mirando | mesa | Diorama con conos de visión; agacharte de verdad en «Mirando» |
| Recuerdo | mesa | La memoria es una bola de nieve que inclinas |
| Rescate / Aires / Tormenta | mesa | Volar o huir en primera persona marea: juguete pilotado |
| Recreativa | inmersivo | Máquina arcade de verdad con su Phaser dentro (por diseño) |
| Negocio | mesa | Casa de muñecas del bar que mejoras |
| Barrio | mesa + inmersivo | Maqueta en la mesa; tocas una sala y entras |

**Confort** (más estricto que el 2D):
- nunca se mueve ni se inclina tu cámara;
- nada de temblores de pantalla;
- el humo solo tapa en la cortinilla, que dura menos de 2 s;
- viñeta si hay desplazamiento;
- se puede jugar sentado.

## 4. Fases

| Fase | Qué | Puerta de calidad |
|---|---|---|
| **F0** | Puerta en tu pared, contraseña, empujar, salen Lasslow y Blancaso, liar y fumar con las manos, pasarlo, cambio de día a humo con la sala desde la foto, prueba del puente | El fundador lo prueba en la Quest: ¿se siente UNAKÉ?, ≥ 72 fps, ¿los recortables y la sala convencen? |
| F1 | Maqueta del barrio, necesidades, tienda, bucle día/humo, motor de historia con los datos de `base/js/historia.js` y `contenido/`, guardado. Todos los minijuegos por el puente | Las 17 historias se acaban de principio a fin en las gafas |
| F2 | Ola física: pipas, tiro, martillo, cuentas, barra, tarta, inspección, en su punto, furgo + control | Uno a uno: ¿más divertido que el 2D? Si no, se queda en el puente |
| F3 | Ola social y jefes | Igual |
| F4 | Ola de mesa y cine (portada, final, poscréditos, círculo) | Repaso del criterio §7 |
| F5 | Pulido, rendimiento y publicación (repo público `unake-xr` en Pages, robots Disallow) | — |

## 5. Estado (23/11/2026, madrugada) · F0 cerrada, F1 en marcha

Publicado en https://opspilotcontact-lgtm.github.io/unake-xr/ (repo público, rama main; cada push actualiza Pages).

**Hecho y probado en el PC** (bots sin errores; en la Quest solo F0):
- **F0**: puerta en tu pared, contraseña, liar y fumar con las manos, día ↔ humo (`bot_f0.mjs`).
- **Fumar**:
  - 14 caladas;
  - soplar al micro saca el humo con su fuerza, y cada soplido corto es un aro;
  - sin micro, formas variadas: chorro, aros, por la nariz y bola que revienta.
- **Pase en ronda**: el colega se inclina y lo pide, a veces lo pasa al otro y te lo tiende.
- **Física propia** (`js/fisica.js` + `Agarre`): coger y lanzar contra tus mesas y paredes reales o las del bar. Los colegas reaccionan si les das.
- **Joystick** en el humo: andar y giro de 30°, con viñeta. De día vuelves a tu sitio real (`joystick.mjs`).
- **Momentos de colocón** (`js/viaje.js`): neón, onda, lluvia de chuches, figuras de humo, miradas y estrellas (`momentos.mjs`).
- **Menú en la muñeca** (tocar el panel del colocón o B/Y):
  - **Pipas** y **Tiro al pato** nativos (`js/minijuegos/`, contrato en `docs/minijuegos.md`);
  - **Recreativa** con 22 minijuegos del 2D por el puente (`js/recreativa.js`).
- **Barrio**: 10 salas en día y humo proyectadas (`js/barrio/`) y maqueta sobre la mesa. Por ahora es una página aparte, `barrio.html`.

**Siguiente (F1)**:
- motor de historia (17 capítulos);
- barrio dentro del juego;
- Cuentas y En su punto nativos;
- necesidades y tienda.

**Pendientes técnicos** (de los informes de los agentes):
- caché de salas sin límite (82 texturas);
- unificar `decorado.js` con `barrio/proyeccion.js`;
- arranque común (marco/pagina/app);
- `ALTOS` duplicado;
- `fisica`: viento, cilindros y oyentes múltiples de agarre;
- exportar `conTinta`;
- Tiro al pato pesa unos 90-130 draw calls.

## 6. Cómo probar

- PC: `python servir_lan.py --local` → http://127.0.0.1:18765 (con `?emular` sale el emulador de Meta).
- Quest: `python servir_lan.py` → https://IP-DEL-PC:18764. En las gafas, «Avanzado» → «Continuar» (certificado propio).
- Pruebas: `node herramientas/pruebas/bot_f0.mjs`, `emulador_f0.mjs`, `fotos_fases.mjs` (con el servidor local en marcha).
- Trampas que ya conocemos:
  - Chrome cachea los módulos (el servidor manda `no-store`; si no, `?v=`).
  - Los puertos 875x y 18744/5 los usan otras sesiones: aquí usamos 1876x.
