// Prueba completa del puente (puente.html):
//  1. Pipas con teclas sintéticas hasta el final → resultado; «Al barrio (Esc)» del panel vuelve al puente.
//  2. Pipas otra vez (la misma escena reutilizada) → resultado; «Otra vez (Enter)» relanza; cerrar().
//  3. Cuentas con flechas sintéticas, sin panel (panel: false), dos veces seguidas.
//  4. TiroPato con punteros por UV (p.puntero) y una comprobación con el ratón real sobre el plano (raycast).
//  5. localStorage: 'unake-partida' intacta; la partida del puente va a 'unake-xr-puente'.
//  6. Música: nunca suena un hueco del barrio. Cero errores de consola.
// Uso: node herramientas/pruebas/prueba_puente.mjs   (servidor en 18771)
import { abrir, foto, espera } from './comun.mjs';

const { navegador, pagina, errores, avisos } = await abrir();
const fallos = [];
const comprobar = (ok, que) => { console.log(`${ok ? 'OK ' : 'MAL'} ${que}`); if (!ok) fallos.push(que); };

// Jugadores automáticos (en la página): solo usan p.tecla / p.puntero, como lo haría la RV.
await pagina.evaluate(() => {
  const p = __prueba.puente;
  const pulsar = (code, ms = 40) => { p.tecla(code, true); setTimeout(() => p.tecla(code, false), ms); };
  window.__musicas = new Set();
  setInterval(() => { const a = p.ev('Musica').actual; if (a) __musicas.add(a.hueco); }, 200);

  // Pipas: fija el ángulo cerca de 50° y suelta la fuerza cuando la parábola predicha cae en la papelera.
  window.jugarPipas = () => {
    let fasePulsada = null;
    const predecir = (s, f) => {
      const v = s.velocidad(f);
      let x = s.origen.x, y = s.origen.y, vx = Math.cos(s.ang) * v, vy = -Math.sin(s.ang) * v;
      const boca = s.papelera.y - s.papelera.displayHeight + 8;
      for (let i = 0; i < 400; i++) {
        const dt = 1 / 60;
        vy += 900 * dt; vx += s.viento * 260 * dt;
        const antes = y; x += vx * dt; y += vy * dt;
        if (vy > 0 && antes < boca && y >= boca) return x;
      }
      return -1;
    };
    return setInterval(() => {
      const s = p.escena();
      if (!s || s.scene.key !== 'Pipas' || fasePulsada === `${s.tirada}-${s.fase}`) return;
      const lag = 1000 / 60;
      if (s.fase === 'angulo') {
        const t = s.time.now + lag;
        const a = 15 + 60 * (0.5 + 0.5 * Math.sin((t - s.t0) / 380));
        if (Math.abs(a - 50) < 2.5) { fasePulsada = `${s.tirada}-angulo`; pulsar('Space'); }
      } else if (s.fase === 'fuerza') {
        const t = s.time.now + lag;
        const f = 0.5 + 0.5 * Math.sin((t - s.t1) / 300 - Math.PI / 2);
        const x = predecir(s, f);
        if (Math.abs(x - s.papelera.x) < s.papelera.displayWidth * 0.18) { fasePulsada = `${s.tirada}-fuerza`; pulsar('Space'); }
      }
    }, 5);
  };

  // Cuentas: lo de abajo de la cinta, a su bandeja (← monedas, → billetes, ↓ facturas).
  window.jugarCuentas = () => {
    let visto = null;
    return setInterval(() => {
      const s = p.escena();
      if (!s || s.scene.key !== 'Cuentas' || !s.activo || !s.cola.length) return;
      const o = s.cola[0];
      if (o.img === visto || o.img.y < 420) return;
      visto = o.img;
      pulsar(['ArrowLeft', 'ArrowRight', 'ArrowDown'][o.tipo.destino]);
    }, 20);
  };

  // TiroPato: apunta por UV al pato vivo más fácil y dispara (down/up); recarga con R.
  window.jugarTiroPato = () => setInterval(() => {
    const s = p.escena();
    if (!s || s.scene.key !== 'TiroPato' || !s.activo) return;
    if (s.balas <= 0) { if (s.recargando <= 0) pulsar('KeyR'); return; }
    if (s.cooldown > 0 || s.recargando > 0) return;
    const filas = [262, 392, 532];
    const blancos = s.objetivos.filter(o => o.vivo && (o.tipo === 'pato' || o.tipo === 'oro') && o.img.x > 120 && o.img.x < 1160);
    const o = blancos.sort((a, b) => (b.tipo === 'oro') - (a.tipo === 'oro') || b.img.depth - a.img.depth)[0];
    if (!o) return;
    const x = o.img.x + (o.vx || 0) * 0.02;
    const y = Math.min(o.img.y - o.img.displayHeight * 0.62, filas[o.fila] + 4);
    const u = x / 1280, v = 1 - y / 720;
    p.puntero(u, v, 'move');
    p.puntero(u, v, 'down');
    setTimeout(() => p.puntero(u, v, 'up'), 30);
  }, 180);
});

const esperarResultados = (n, ms) => pagina.waitForFunction(k => __prueba.resultados.length >= k, n, { timeout: ms, polling: 250 });
const esperarSalidas = (n, ms) => pagina.waitForFunction(k => __prueba.salidas.length >= k, n, { timeout: ms, polling: 250 });

// ---- 1. Pipas ----
let reloj = await pagina.evaluate(() => { __prueba.lanzar('Pipas'); return jugarPipas(); });
await espera(6000);
await foto(pagina, '1-pipas-jugando');
await esperarResultados(1, 120000);
let r = await pagina.evaluate(() => __prueba.resultados.at(-1));
console.log('Pipas 1:', r);
comprobar(r.clave === 'Pipas' && typeof r.puntos === 'number' && 'gana' in r && 'estrellas' in r && !r.abandonado, 'Pipas 1 devuelve {clave, puntos, gana, estrellas}');
await espera(4500); // remate de cómic + panel
await foto(pagina, '2-pipas-panel');
await pagina.evaluate(() => __prueba.puente.tecla('Escape', true));
await esperarSalidas(1, 5000);
let s = await pagina.evaluate(() => __prueba.salidas.at(-1));
comprobar(s.motivo === 'barrio', `«Al barrio (Esc)» vuelve al puente (motivo ${s.motivo})`);
await pagina.evaluate(() => __prueba.puente.tecla('Escape', false));
await espera(800);
await foto(pagina, '3-vuelta-a-espera');

// ---- 2. Pipas otra vez (misma instancia de escena) ----
await pagina.evaluate(() => { __prueba.lanzar('Pipas'); });
await esperarResultados(2, 120000);
r = await pagina.evaluate(() => __prueba.resultados.at(-1));
console.log('Pipas 2:', r);
comprobar(r.clave === 'Pipas' && !r.abandonado, 'Pipas 2 (repetido) devuelve resultado');
await espera(4500);
await pagina.evaluate(() => { const p = __prueba.puente; window.__resultadosEv = 0; p.on('resultado', () => __resultadosEv++); p.tecla('Enter', true); setTimeout(() => p.tecla('Enter', false), 50); });
await espera(3000);
const relanzada = await pagina.evaluate(() => { const s = __prueba.puente.escena(); return s && s.scene.key === 'Pipas' && s.sys.isActive() && !s._acabado && s.tirada <= 1; });
comprobar(relanzada, '«Otra vez (Enter)» del panel relanza Pipas');
await foto(pagina, '4-pipas-otra-vez');
await pagina.evaluate(() => __prueba.puente.cerrar());
await pagina.evaluate(r => clearInterval(r), reloj);

// ---- 3. Cuentas (sin panel), dos veces ----
reloj = await pagina.evaluate(() => jugarCuentas());
for (const n of [1, 2]) {
  const antes = await pagina.evaluate(() => __prueba.resultados.length);
  await pagina.evaluate(() => { __prueba.lanzar('Cuentas', { panel: false }); });
  await espera(20000);
  await foto(pagina, `5-cuentas-${n}`);
  await esperarResultados(antes + 1, 90000);
  r = await pagina.evaluate(() => __prueba.resultados.at(-1));
  console.log(`Cuentas ${n}:`, r);
  comprobar(r.clave === 'Cuentas' && !r.abandonado, `Cuentas ${n} devuelve resultado`);
  await espera(2500);
  const enEspera = await pagina.evaluate(() => !__prueba.puente.actual && __prueba.puente.espera.sys.settings.visible);
  comprobar(enEspera, `Cuentas ${n} sin panel vuelve sola a la espera`);
}
await pagina.evaluate(r => clearInterval(r), reloj);

// ---- 4. TiroPato con punteros por UV ----
await pagina.evaluate(() => { __prueba.lanzar('TiroPato'); });
await espera(1500);
// El ratón real sobre el plano three → raycast → p.puntero: la mirilla debe ir a ese punto.
const objetivo = { u: 0.25, v: 0.7 };
const px = await pagina.evaluate(o => __prueba.proyectar(o.u, o.v), objetivo);
await pagina.mouse.move(px.x - 30, px.y - 30);
await pagina.mouse.move(px.x, px.y, { steps: 4 });
await espera(300);
const mira = await pagina.evaluate(() => ({ ...__prueba.puente.escena().mira }));
const esperado = { x: objetivo.u * 1280, y: (1 - objetivo.v) * 720 };
console.log('mirilla', mira, 'esperada', esperado);
comprobar(Math.abs(mira.x - esperado.x) < 12 && Math.abs(mira.y - esperado.y) < 12, 'ratón real → raycast → UV → mirilla de TiroPato en su sitio');
reloj = await pagina.evaluate(() => jugarTiroPato());
await espera(12000);
await foto(pagina, '6-tiropato-jugando');
await esperarResultados(5, 150000);
r = await pagina.evaluate(() => __prueba.resultados.at(-1));
const tp = await pagina.evaluate(() => { const s = __prueba.puente.escena(); return s ? { disparos: s.disparos, aciertos: s.aciertos } : null; });
console.log('TiroPato:', r, tp);
comprobar(r.clave === 'TiroPato' && !r.abandonado && tp && tp.aciertos > 0, 'TiroPato con punteros UV devuelve resultado y acierta');
await espera(4500);
await foto(pagina, '7-tiropato-panel');
await pagina.evaluate(r => clearInterval(r), reloj);
await pagina.evaluate(() => __prueba.puente.cerrar());

// ---- 5. Almacenamiento y 6. música ----
const almacen = await pagina.evaluate(() => {
  const raw = Storage.prototype.getItem;
  return { original: raw.call(localStorage, 'unake-partida'), puente: !!raw.call(localStorage, 'unake-xr-puente'), estadoCentinela: __prueba.puente.estado().centinela };
});
console.log('almacén', almacen);
comprobar(almacen.original === '{"centinela":1,"monchis":777}', "'unake-partida' intacta");
comprobar(almacen.puente && almacen.estadoCentinela === undefined, "la partida del puente va a 'unake-xr-puente' y no lee la original");
const musicas = await pagina.evaluate(() => [...__musicas]);
console.log('músicas que han sonado:', musicas);
comprobar(!musicas.some(m => ['dia', 'noche', 'unake'].includes(m)), 'no suena la música del barrio');

const met = await pagina.evaluate(() => ({ ...__prueba.puente.metricas, mem: __prueba.puente.memoria(), mb: __prueba.puente.descargadoMB() }));
console.log('métricas', JSON.stringify(met));
comprobar(met.faltan.length === 0, 'ninguna textura del catálogo pedida sin cargar');
comprobar(errores.length === 0, `cero errores de consola (${errores.length})`);
if (errores.length) console.log(errores);
if (avisos.length) console.log('avisos:', avisos.slice(0, 20));
await navegador.close();
console.log(fallos.length ? `\nFALLAN ${fallos.length}: ${fallos.join(' | ')}` : '\nTODO OK');
process.exit(fallos.length ? 1 : 0);
