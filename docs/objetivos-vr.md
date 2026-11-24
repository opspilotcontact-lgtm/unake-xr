# Objetivos de la historia en VR · auditoría de alcanzabilidad (24/11)

Qué tiene que hacer **físicamente** el jugador en las gafas para cumplir cada objetivo de los 17 capítulos, dónde, y si existe y lleva a cumplirlo. Fuente: `EQUIV_OBJETIVOS` y `equivTarea` (`js/historia/motor.js`), las tareas del 2D (`base/js/historia.js` y los guiones) y el director (`js/app.js`). La tabla se sacó volcando todos los objetivos desde el puente.

**Cómo se guía ahora** (`js/historia/guia.js`): la ★ de la muñeca late y vibra al cambiar el objetivo. Además hay una pista corta (un colega con su bocadillo; en las salas, la cartela) en cuatro momentos: al cambiar el objetivo, al volver al bar o a casa, al acabar una escena o un minijuego, y tras 60 s sin avanzar. Como mucho sale una cada 45 s. Si el objetivo está en una sala, sale el hilo de humo hacia ella. Si está en la máquina, la máquina del bar se pone en «★ MISIÓN» y parpadea, y sale un hilo de humo hasta ella.

- **Día y humo**: si la misión es del otro mundo, la pista te dice cómo cambiar. La ★ y el menú pasan a «Ir al humo» (te saca la bandeja para liar) o a «Volver a casa» (se te baja el colocón).
- **De día**, la ★ te lleva directamente a la sala.
- **En el humo** se va andando con el hilo. Para hablar con la gente de la barra, la ★ te lleva a la barra.

Leyenda del estado: **OK** = existía y funcionaba · **ARREGLADO** = estaba roto o sin guía, arreglado en este sprint.

| Cap. | Objetivo | Qué haces en VR | Dónde (mundo) | Estado |
|---|---|---|---|---|
| 1 una-que | Entra en Unaké (contraseña) | Tocar tarjetas y empujar la puerta | Tu casa (día) | OK. La ★ ahora pide esto PRIMERO: antes pedía el encargo mientras Perico te pedía la contraseña |
| 1 | Lía y fuma | Bandeja: liar, mechero, calada | Casa (día) | OK |
| 1 | Haz un encargo de la tienda | Tablón de ENCARGOS de la tienda → llevarlo a quien sea | Tienda (día o humo) | ARREGLADO: ahora va tercero y la ★ te lleva o pone el hilo a la tienda |
| 2 cuota | Sirve la barra (Barra) | Máquina del bar (de día viene a ti) | Bar (humo) | ARREGLADO: la máquina pide la misión sola y hay hilo hasta ella |
| 2 | Tarta (de noche) | Máquina | Bar | ARREGLADO (como arriba) |
| 2 | Compra una mejora | ★ → compra la más barata | Cualquiera | ARREGLADO: antes el botón no decía nada. Ahora dice «Mejora comprada…» o «Te faltan N monchis…» |
| 2 | Hucha 100 | Tocar la hucha de Blancaso | Plaza | ARREGLADO: antes se aportaba desde el botón, lejos. Ahora la ★ te lleva o pone el hilo a la plaza; allí, tocar la hucha o la ★ aporta. Sin monchis, dice cómo ganarlos |
| 3 pompa | Habla con la Pompa | Entrar en la barra | Barra (los dos mundos) | ARREGLADO: en el humo, el bar no tiene a la Pompa y el hilo no salía (ya «estabas» en `dentro`). Ahora la ★ te lleva a la barra |
| 3 | Agua (barra) y algo salado (tienda) | Coger con la mano lo que brilla | Bar y tienda | ARREGLADO: antes se cumplía solo con entrar. Ahora cada cosa flota y brilla y se coge tocándola o con pellizco. Lo del bar sale en el propio bar del humo |
| 3 | EnSuPunto / DJ | Máquina | Bar | ARREGLADO (máquina) |
| 4 blancazo | Pásale el porro a Blancaso | Acercárselo encendido a la boca | Casa o bar | ARREGLADO: la ★ saca la bandeja si no hay porro y lo explica |
| 4 | Blancazo | Máquina | Bar | ARREGLADO (máquina) |
| 5 mejor-amigo | Cerrojo en la tienda | Entrar en la tienda (con 25 monchis) | Tienda | ARREGLADO: sin monchis, la pista manda al tablón. Con monchis, la ★ allí lo compra sin salir |
| 5 | Rendija | Máquina | Bar | ARREGLADO (máquina) |
| 5 | Cuentas | Nativo (★ → jugar) | Cualquiera | OK |
| 5 | Habla con Puky de noche | Entrar en los baños | Baños (humo) | ARREGLADO: de día, Puky no está y no pasaba nada. Ahora la pista y la ★ te mandan al humo |
| 6 senor | Lasslow (pajarita) / Cuentas | Máquina / nativo | Bar / cualquiera | OK (la situación se cumple al ganar) |
| 6 | Invento | ★ → compra el más barato | Cualquiera | ARREGLADO: ahora avisa al comprar o dice cuánto falta |
| 6 | Bareto (nivel 5) | ★ varias veces (una mejora cada vez) | Cualquiera | ARREGLADO: avisa al comprar o dice cuánto falta |
| 6 | Hucha 300 | Hucha en la plaza | Plaza | ARREGLADO (hucha) |
| 7 nuevo | De día, sigue a Lasslow | La ★ te lleva a la barra de día | Barra (día) | ARREGLADO: en el humo no había forma. Ahora «Eso es de día» y la ★ te devuelve a casa |
| 7 | Pajaritas (plaza, tienda, barra) | Coger lo que brilla | 3 salas | ARREGLADO (recoger) |
| 7 | Flores (tienda y plaza ×3) | Coger lo que brilla (una a una) | 2 salas | ARREGLADO: antes, entrar recogía las 3 de golpe |
| 7 | Compostura | Máquina | Bar | ARREGLADO (máquina) |
| 8 caja | Cuentas | Nativo | Cualquiera | OK |
| 8 | Pregúntale a Perico | Entrar en la puerta de Unaké | Fuera | OK + hilo |
| 8 | Farol | Máquina | Bar | ARREGLADO (máquina) |
| 9 escucha | Pregunta a Niebla, Cotine y Lasslow | Entrar en la plaza, la cocina y la barra | 3 salas | ARREGLADO: **era imposible**, porque Niebla no tiene figura en la plaza y nunca contaba. Ahora entrar en su sala cuenta como verla (igual que el Mirón) |
| 9 | De noche, Perico a solas | Entrar en la puerta | Fuera (humo) | ARREGLADO (día/humo) |
| 9 | Escucha / Barra | Máquina | Bar | ARREGLADO (máquina) |
| 10 perico | Periquito | Máquina | Bar | ARREGLADO (máquina) |
| 10 | Pipas | Nativo | Cualquiera | OK |
| 10 | De día, Perico a solas | Entrar en la puerta de día | Fuera (día) | ARREGLADO: en el humo no daba ni una pista |
| 10 | Hucha 500 | Plaza | Plaza | ARREGLADO (hucha) |
| 11 furgo | Llaves, batería, ambientador | Coger lo que brilla | Fuera, tienda, bar | ARREGLADO (recoger) |
| 11 | Furgo / Control / Furgo | Nativos | Cualquiera | OK |
| 12 feria | Convence a Cotine | Entrar en la cocina | Cocina | OK + hilo |
| 12 | Casetas | Nativo | Cualquiera | OK |
| 12 | 3 trozos del cartel | Coger lo que brilla | Feria | ARREGLADO (recoger) |
| 12 | Palo | Máquina | Bar | ARREGLADO (máquina) |
| 13 senal | Flashback | Se cuenta solo | — | OK |
| 13 | Recuerdo | Máquina | Bar | ARREGLADO (máquina) |
| 13 | Tela roja y una M | Entrar en la tienda (15 monchis) | Tienda | ARREGLADO (recado) |
| 13 | Pistas del dulce | Coger lo que brilla | Feria | ARREGLADO (recoger) |
| 14 miron | Mirando / Cámaras | Máquina | Bar | ARREGLADO (máquina) |
| 14 | Pruebas falsas | Tienda | Tienda | ARREGLADO (recado) |
| 14 | Pregunta por los mecheros | Barra y cocina | 2 salas | ARREGLADO: en el humo, la ★ te lleva a la barra (Palicaso) |
| 14 | Mecheros tras el cartel | Coger lo que brilla | Fuera | ARREGLADO (recoger) |
| 15 inspeccion | Sigilo / Inspección / Rescate | Máquina | Bar | ARREGLADO (máquina) |
| 15 | Local de moda (nivel 20) | ★ mejoras | Cualquiera | ARREGLADO (avisos) |
| 15 | Hucha 750 | Plaza | Plaza | ARREGLADO (hucha) |
| 16 pesado | Rescate | Máquina | Bar | ARREGLADO (máquina) |
| 16 | Perdón a Palicaso, Cotine y la Pompa | Barra y cocina | 2 salas | ARREGLADO (como miron) |
| 16 | Amarillo | Nativo | Cualquiera | OK |
| 17 epica | Tarta | Máquina | Bar | ARREGLADO (máquina) |
| 17 | Hucha 1000 | Plaza | Plaza | ARREGLADO (hucha) |

## Otros arreglos del flujo

- **Escenas en las salas**: antes, si cumplías algo dentro de una sala, la escena esperaba a que volvieras al bar o a casa: cumplías y no pasaba nada. Ahora se cuenta allí mismo y luego vuelven las tarjetas de la sala.
- **Volver al bar** del humo cuenta como estar en la barra con Lasslow. Además, la guía te recuerda la misión al volver al bar o a casa.
- **Primer minuto** (solo la primera vez, `unake-xr-visto-intro`; se puede saltar): son cuatro cartelas.
  1. Chuleta de las manos.
  2. La ★ de la muñeca (late).
  3. B/Y = menú.
  4. Pistas y hilo de humo.

  En la portada hay una línea con lo mismo.

## Lo que sigue simplificado (honesto)

- **Hablar**: basta con entrar en la sala de esa persona (como antes). Tocarla sigue dándote su minijuego.
- **Mejoras e inventos**: se compran con la ★, no en un mostrador físico.
- **«Volver a casa»** de la ★ baja el colocón a 11, y el paso al día llega en cuanto acabas lo que tengas entre manos.

## Pruebas

`node herramientas/pruebas/guia.mjs <puerto>` cubre:
- la intro y «Saltar»;
- la máquina con la misión;
- la pista por estar quieto y el límite de 45 s;
- una misión de día estando en el humo: la ★ te devuelve a casa y luego te lleva a la barra;
- recoger con la mano en el bar y el hilo a la tienda.
