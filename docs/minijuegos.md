# Minijuegos nativos · contrato

Un minijuego nativo es un módulo ES en `js/minijuegos/<nombre>.js`. Se prueba solo en `minijuego.html?m=<nombre>` (también con `&emular` en el PC) y luego `app.js` lo monta dentro del juego con el mismo `ctx`.

```js
export default {
  clave: 'Pipas',            // la MISMA clave del 2D (MISIONES en base/js/comun.js): estrellas y economía
  titulo: 'La apuesta de pipas',
  escala: 'sala',            // 'sala' (tu habitación), 'mesa' (juguete en tu mesa) o 'inmersivo' (VR completa)
  umbrales: [500, 1000, 1800], // copiados de MISIONES[clave].umbrales
  async crear(ctx) {
    // monta todo dentro de `grupo` (y en ctx.fisica lo que tenga física)
    return {
      grupo,                 // THREE.Group; el marco lo añade a la escena
      actualizar(dt) { },    // cada fotograma (después de manos, agarre y física)
      destruir() { },        // quita lo que metiste en fisica/humo/ui; «Otra vez» llama a destruir() y crear() de nuevo
    };
  },
};
```

## `ctx`

| Campo | Qué es |
|---|---|
| `THREE` | three.js 0.170 |
| `escena` | la escena (mejor no tocarla: usa tu `grupo`) |
| `xr` | `xr.manos.derecha/izquierda` (`activa, esMano, pos, quat, punta, vel, pinza, empiezaPinza, acabaPinza, agarre, empiezaAgarre, vibrar(f, ms), grupo`), `xr.cabeza`, `xr.cabezaQ`, `xr.adelante`, `xr.boca()`, `xr.planos`, `xr.mesaCerca()`, `xr.paredDelante()` |
| `fisica` | `js/fisica.js`: `anadir(obj, {radio, rebote, roce, masa, alGolpear, cogible, datos})`, `quitar(c)`, `lanzar(c, vel)`, `objetivo({centro, radio, alto, alEntrar})`, `quitarObjetivo(o)`, `ponerCaja(min, max)`. Solo esferas, contra el suelo, tus mesas y paredes y entre ellas |
| `agarre` | coger/lanzar con pellizco o puño: `lleva(mano)`, `poner(mano, c)`, `soltar(mano, lanzar)`, `alCoger`, `alSoltar` |
| `humo` | `soltar({...})`, `exhalar(boca, dir, fuerza)`, `aro(pos, dir)`, `hilo(punta)` |
| `ui` | `cartela(texto, dur)`, `instruccion(texto|null)`, `tarjetasEn(ops, centro, haciaMi, alElegir)` |
| `sonido(nombre, {en, volumen, tono})` | sonidos de `base/assets/snd/<nombre>.mp3` |
| `musica(nombre)` | `base/assets/musica/<nombre>.mp3`; una sola a la vez |
| `textura(url)`, `img(nombre)` | cargadores (`img` = `base/assets/img/<nombre>`) |
| `Recortable` | `await Recortable.crear(id, 'humo'|'normal')` → personaje de cartón: `.grupo`, `.pose(nombre)`, `.decir(texto)`, `.bocaMundo()`, `.actualizar(dt, camaraPos)` (llámalo tú en tu `actualizar`) |
| `delante(d, alto)` | punto en el suelo a `d` m delante de ti (o a esa altura) |
| `mesa()` | `{ punto }` de tu mesa real (o la del PC en pruebas), o `null` |
| `terminar({ puntos, gana, linea })` | se acaba: cartela con estrellas y tarjetas «Otra vez / Salir» |

## Reglas

- **Lee antes** `VOPPE SERIE/07_juego/criterio.md` (solo lectura) y la escena original en `base/js/escenas/`: las reglas, los textos y la escalada vienen de ahí.
- **Confort**: nunca muevas la cámara ni el mundo con ella; nada que tape la vista más de un instante; todo a mano (≤ 0,7 m) o se acerca solo; se puede jugar sentado.
- **Manos y mandos**: todo funciona con los dos. El seguimiento de manos tiembla, así que gestos grandes y con tolerancia. Vibración en cada contacto.
- Toda bandera de partida se reinicia en `crear()` (la lección de Phaser con `scene.start`).
- No se tocan los archivos comunes (`js/xr.js`, `fisica.js`, `ui.js`, `humo.js`, `recortable.js`, `marco.js`, `app.js`): si hace falta algo, se pide en el informe.
- **Prueba obligatoria**: `herramientas/pruebas/bots/<nombre>.js` y `node herramientas/pruebas/minijuego.mjs <nombre> <puerto>`. Que gane, que pierda y que «Otra vez» funcione; cero errores; mirar las fotos.
