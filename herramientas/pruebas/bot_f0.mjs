// Bot de F0: juega el flujo entero en el PC con manos simuladas (las mismas rutas de código que en las gafas).
// Uso: node herramientas/pruebas/bot_f0.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765, dir = 'herramientas/pruebas/fotos/bot-';
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => {
  const t = m.text();
  if ((m.type() === 'error' || m.type() === 'warning') && !t.includes('404')) errores.push(m.type() + ': ' + t);
  if (t.startsWith('[bot]')) console.log(t);
});
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });

await pag.evaluate(() => {
  const J = window.__unake, T = J.THREE;
  const log = m => console.log('[bot] ' + J.t.toFixed(1) + 's ' + m);
  let dt = 0.016, manos;
  const der = () => manos.derecha, izq = () => manos.izquierda;
  function poner(m, pos, pinza) {
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
    if (m._p) m.vel.copy(pos).sub(m._p).divideScalar(Math.max(dt, 0.001)); else m.vel.set(0, 0, 0);
    m._p = pos.clone(); m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
    if (pinza !== undefined) m.pinza = pinza;
  }
  function* quieto(m, seg, pinza) { let t = 0; while (t < seg) { t += dt; poner(m, m.pos.clone(), pinza); yield; } }
  function* mover(m, destino, seg, pinza) {
    const desde = m.pos.clone(); let t = 0;
    while (t < seg) {
      t += dt; const k = Math.min(1, t / seg);
      poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, k * k * (3 - 2 * k)), pinza); yield;
    }
  }
  function* hasta(cond, max = 30) { let t = 0; while (!cond()) { t += dt; if (t > max) throw new Error('timeout esperando: ' + cond.toString()); yield; } }
  const o = new Proxy({}, { get: (_, k) => J.obj()[k] });
  function* principal() {
    poner(der(), new T.Vector3(0.25, 1.2, -0.3), false); poner(izq(), new T.Vector3(-0.25, 1.2, -0.3), false);
    for (let r = 0; r < 3; r++) {
      yield* hasta(() => o.ui.tarjetas.length);
      yield* quieto(der(), 0.3);
      const buenas = ['¿…Unaké?', '¿Una… aso?', 'De los hermanos Aso'];
      const t0 = r === 0 ? o.ui.tarjetas.find(t => t.userData.texto !== buenas[0]) : o.ui.tarjetas.find(t => t.userData.texto === buenas[r]); // en la primera, una mala a propósito
      log('tarjeta: ' + t0.userData.texto);
      yield* mover(der(), () => t0.getWorldPosition(new T.Vector3()), 0.4);
      yield* quieto(der(), 0.2);
      yield* mover(der(), new T.Vector3(0.25, 1.2, -0.3), 0.3);
      if (r === 0) {
        yield* hasta(() => o.ui.tarjetas.length);
        const t1 = o.ui.tarjetas.find(t => t.userData.texto === buenas[0]); log('tarjeta: ' + t1.userData.texto);
        yield* mover(der(), () => t1.getWorldPosition(new T.Vector3()), 0.4);
        yield* mover(der(), new T.Vector3(0.25, 1.2, -0.3), 0.3);
      }
    }
    yield* hasta(() => J.fase === 'empujar', 40);
    log('empujar');
    const fuera = o.puerta.haciaFuera(), centro = o.puerta.hoja.getWorldPosition(new T.Vector3());
    yield* mover(der(), centro.clone().addScaledVector(fuera, 0.3), 0.6);
    yield* mover(der(), centro.clone().addScaledVector(fuera, -0.02), 0.15);
    yield* hasta(() => J.fase === 'liar', 40);
    log('liar');
    const L = () => J.liar, mundo = v => L().grupo.localToWorld(v.clone());
    for (let i = 0; i < 6; i++) {
      yield* mover(der(), mundo(L().montonBase).add(new T.Vector3(0, 0.2, 0)), 0.15);
      yield* mover(der(), mundo(L().montonBase).add(new T.Vector3(0, 0.03, 0)), 0.08);
      yield* quieto(der(), 0.15);
    }
    yield* hasta(() => L().paso === 'rellenar', 3);
    log('rellenar');
    yield* mover(der(), mundo(new T.Vector3(0.06, 0.06, 0.02)), 0.3);
    yield* quieto(der(), 1.9, true);
    yield* quieto(der(), 0.1, false);
    yield* hasta(() => L().paso === 'liar', 3);
    log('liar: pasadas (calidad ' + L().calidad + ')');
    for (let i = 0; i < 6 && L()?.paso === 'liar'; i++) yield* mover(der(), mundo(new T.Vector3(i % 2 ? -0.01 : 0.13, 0.05, 0.02)), 0.25);
    yield* hasta(() => L().paso === 'coger', 3);
    log('coger');
    yield* mover(der(), () => L().porro.grupo.getWorldPosition(new T.Vector3()), 0.3, false);
    yield* quieto(der(), 0.1, true);
    yield* hasta(() => L().paso === 'cerrar', 3);
    log('cerrar: a la boca');
    const boca = () => o.xr.boca(new T.Vector3());
    yield* mover(der(), () => boca().add(new T.Vector3(0.02, -0.02, -0.06)), 0.5, true);
    yield* hasta(() => J.fase === 'encender', 4);
    log('encender');
    yield* mover(der(), new T.Vector3(0.2, 1.25, -0.35), 0.4, true);
    poner(izq(), new T.Vector3(-0.15, 1.2, -0.35), false); yield;
    yield* quieto(izq(), 0.1, true); yield* quieto(izq(), 0.2, false); // falla
    yield* quieto(izq(), 0.1, true);                                     // ahora sí
    yield* mover(izq(), () => J.porro.puntaMundo(new T.Vector3()).add(new T.Vector3(0, -0.04, 0)), 0.4, true);
    yield* hasta(() => J.fase === 'fumar', 4);
    log('fumar');
    yield* quieto(izq(), 0.1, false);
    for (let i = 0; i < 6 && J.mundo === 'normal'; i++) {
      yield* hasta(() => !J.calada && !J.transicion, 8);
      yield* mover(der(), () => boca().add(new T.Vector3(0.02, -0.03, -0.065)), 0.4, true);
      yield* hasta(() => J.calada, 3);
      yield* hasta(() => !J.calada || J.calada.valor >= 70, 4);
      yield* mover(der(), new T.Vector3(0.2, 1.25, -0.4), 0.25, true);
      log(`calada ${i + 1}: colocón ${J.colocon.toFixed(1)}`);
      yield* hasta(() => !J.calada, 5);
      if (i === 1) {
        log('pasar a Lasslow');
        yield* mover(der(), () => o.lasslow.bocaMundo(new T.Vector3()).add(new T.Vector3(0.05, 0, 0.12)), 0.5, true);
        yield* hasta(() => J.ofrecido, 10);
        yield* quieto(der(), 1.0, false);
        yield* mover(der(), () => J.porro.grupo.position.clone(), 0.4, false);
        yield* quieto(der(), 0.1, true);
        yield* hasta(() => J.porro.mano, 2);
        log('lo he recuperado');
      }
    }
    yield* hasta(() => J.mundo === 'humo', 10);
    log('MUNDO HUMO');
    J.botFoto = 'humo';
    yield* quieto(der(), 4, true);
    // una calada en el humo y pasárselo a Blancaso
    yield* mover(der(), () => boca().add(new T.Vector3(0.02, -0.03, -0.065)), 0.4, true);
    yield* hasta(() => J.calada, 3);
    yield* hasta(() => !J.calada || J.calada.valor >= 66, 4);
    yield* mover(der(), new T.Vector3(0.2, 1.25, -0.4), 0.25, true);
    yield* hasta(() => !J.calada, 5);
    log('calada en el humo: colocón ' + J.colocon.toFixed(1));
    yield* mover(der(), () => o.blancaso.bocaMundo(new T.Vector3()).add(new T.Vector3(-0.05, 0, 0.12)), 0.6, true);
    yield* hasta(() => J.enManos, 3);
    J.botFoto = 'pasado';
    yield* hasta(() => J.ofrecido, 10);
    log('vuelta al día');
    J.colocon = 11;
    yield* hasta(() => J.mundo === 'normal' && !J.transicion, 10);
    log('MUNDO NORMAL');
    J.botFoto = 'dia';
    yield* quieto(der(), 2);
    J.botFin = true;
  }
  const it = principal();
  J.bot = (d, m) => { dt = d; manos = m; const r = it.next(); if (r.done) J.bot = null; };
  J.prueba.arrancar();
  J.prueba.mirar(0, 1.6, 0, 0, -0.05);
});

const vistas = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 150000) {
  const e = await pag.evaluate(() => ({ fin: window.__unake.botFin, foto: window.__unake.botFoto, fase: window.__unake.fase, bot: !!window.__unake.bot }));
  if (e.foto && !vistas.has(e.foto)) {
    vistas.add(e.foto);
    await pag.waitForTimeout(e.foto === 'humo' ? 1500 : 600);
    await pag.screenshot({ path: dir + e.foto + '.jpg', type: 'jpeg', quality: 72 });
  }
  for (const f of ['contrasena', 'liar', 'encender', 'fumar']) {
    if (e.fase === f && !vistas.has(f)) { vistas.add(f); await pag.screenshot({ path: dir + f + '.jpg', type: 'jpeg', quality: 72 }); }
  }
  if (e.fin || (!e.bot && e.fase !== 'portada' && Date.now() - t0 > 3000)) break;
  await pag.waitForTimeout(250);
}
const r = await pag.evaluate(() => ({ fin: !!window.__unake.botFin, fase: window.__unake.fase, mundo: window.__unake.mundo, colocon: window.__unake.colocon.toFixed(1) }));
console.log(JSON.stringify(r));
console.log(errores.length ? errores.join('\n') : 'sin errores');
await nav.close();
