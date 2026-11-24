// Bot de la tienda de 24 h y la hucha de Blancaso (tienda.html, motor falso con 300 monchis).
// Uso (servidor en marcha): node herramientas/pruebas/tienda.mjs <puerto> [segundos]
// Compra algo que te llega, intenta algo que no, se come una comida (comprueba alComer), compra papel y lo suelta
// (al bolsillo), aporta a la hucha hasta llenarla (pasando por la meta del capítulo) y prueba sin monchis.
// Fotos en herramientas/pruebas/fotos/tienda-*.jpg
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18776, segs = 90] = process.argv.slice(2);
mkdirSync('herramientas/pruebas/fotos', { recursive: true });

// cuerpo del bot: generador que se llama una vez por fotograma
const BOT = function* ({ T, THREE, der, mover, quieto, hasta, log, foto, ok }) {
  const { motor, tienda, hucha, xr } = T;
  const posDe = id => tienda.estado().productos.find(p => p.id === id).pos.clone();
  const R = der();
  T.mirar(0, 1.55, 0.2, 0.15, -0.62);
  yield* mover(R, new THREE.Vector3(0.2, 1.05, -0.3), 0.3, false);
  yield* quieto(R, 0.6, false);
  foto('inicio');
  log('llamadas de dibujo: ' + T.llamadas());
  T.resultados.llamadas = T.llamadas();

  // 1) comprar patatas (15): te llegan
  const m0 = motor.monchis, pp = posDe('patatas');
  yield* mover(R, pp, 0.5, false);
  yield* quieto(R, 0.1, true);
  ok('compra patatas', motor.monchis === m0 - 15 && tienda.estado().llevando.includes('patatas'), `monchis ${motor.monchis}`);
  yield* mover(R, pp.clone().add(new THREE.Vector3(0, 0.15, 0.15)), 0.4, true);
  foto('comprado');
  // 2) a la boca: se la come
  yield* mover(R, () => xr.boca(new THREE.Vector3()), 0.6, true);
  yield* quieto(R, 0.2, true);
  ok('come patatas', T.comidas.some(c => c.id === 'patatas'), JSON.stringify(T.comidas));
  foto('comer');
  yield* mover(R, new THREE.Vector3(0.2, 1.05, -0.3), 0.3, false);
  // 3) resucitador: alComer con colocon −10
  yield* mover(R, posDe('lata'), 0.5, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, () => xr.boca(new THREE.Vector3()), 0.6, true);
  yield* quieto(R, 0.2, true);
  const lata = T.comidas.find(c => c.id === 'lata');
  ok('alComer con colocon', !!lata && lata.efecto.colocon === -10 && T.colocon === 30, JSON.stringify(lata) + ' colocon ' + T.colocon);
  yield* mover(R, new THREE.Vector3(0.2, 1.05, -0.3), 0.3, false);
  // 4) caramelo y soltarlo sin llevarlo a la boca: va solo a la boca
  const pc = posDe('caramelo');
  yield* mover(R, pc, 0.5, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, pc.clone().add(new THREE.Vector3(0, 0.2, 0.1)), 0.3, true);
  yield* quieto(R, 0.8, false);
  ok('caramelo soltado se come solo', T.comidas.some(c => c.id === 'caramelo'));
  // 5) papel: comprar y soltar → al bolsillo
  const pa = posDe('papel');
  yield* mover(R, pa, 0.5, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, pa.clone().add(new THREE.Vector3(0.1, 0.25, 0.2)), 0.4, true);
  yield* quieto(R, 0.12, false);
  foto('bolsillo');
  yield* quieto(R, 0.7, false);
  ok('papel al bolsillo', motor.E.inv.papel === 1 && tienda.estado().volando.length === 0, JSON.stringify(motor.E.inv));
  // 6) mechero y luego otra vez: «ya lo tienes» (no se despega)
  yield* mover(R, posDe('mechero'), 0.5, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, new THREE.Vector3(0.25, 1.2, -0.2), 0.3, true);
  yield* quieto(R, 0.8, false);
  ok('mechero', motor.E.inv.mechero === true);
  // 7) algo que no te llega: con 12 monchis, el kebab (30)
  const guardo = motor.E.monchis; motor.E.monchis = 12;
  yield* quieto(R, 0.3, false);
  yield* mover(R, posDe('kebab'), 0.5, false);
  yield* quieto(R, 0.15, true);
  ok('kebab no se despega', motor.monchis === 12 && !tienda.estado().llevando.length && tienda.estado().productos.find(p => p.id === 'kebab').hay);
  foto('no-llega');
  yield* quieto(R, 0.3, false);
  yield* mover(R, new THREE.Vector3(0.2, 1.05, -0.3), 0.3, false);
  // 8) reposición
  yield* hasta(() => tienda.estado().productos.find(p => p.id === 'patatas').hay, 10);
  ok('se repone', true);
  foto('repuesto');

  // ---------- la hucha ----------
  motor.E.monchis = 240; motor.E.hucha = 800; hucha.setMeta(900);
  T.mirar(0, 1.55, 0.2, -0.9, -0.45);
  yield* quieto(R, 0.5, false);
  foto('hucha');
  const ranura = () => hucha.estado().ranura.clone().add(new THREE.Vector3(0, 0.04, 0));
  yield* mover(R, ranura, 0.6, false);
  yield* quieto(R, 0.7, true);
  foto('aportando');
  yield* quieto(R, 2.2, true);
  foto('llena');
  yield* quieto(R, 0.3, false);
  const hs = hucha.estado();
  ok('hucha llena', hs.hucha === 1000 && motor.monchis === 40, JSON.stringify(hs));
  ok('alLlenar meta y llena', T.llenos.some(l => l.meta === 900) && T.llenos.some(l => l.llena && l.linea === '¡Mil! ¡Unaké se queda!'), JSON.stringify(T.llenos));
  // sin monchis
  motor.E.hucha = 500; motor.E.monchis = 0;
  yield* quieto(R, 0.3, false);
  yield* quieto(R, 0.5, true);
  ok('sin monchis', motor.hucha === 500 && T.frases.some(f => f.startsWith('Sin monchis')), JSON.stringify(T.frases));
  foto('sin-monchis');
  yield* quieto(R, 0.3, false);
};

const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404')) errores.push(t);
  if (t.startsWith('[bot]')) console.log(t);
});
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/tienda.html?pc&v=${Date.now()}`);
await pag.waitForFunction(() => window.__t && window.__t.listo, null, { timeout: 30000 });
await pag.evaluate(src => {
  const T = window.__t, THREE = T.THREE;
  let dt = 0.016, manos;
  T.resultados = { checks: [] };
  const log = m => console.log('[bot] ' + T.t.toFixed(1) + 's ' + m);
  const ok = (nombre, si, info = '') => { T.resultados.checks.push({ nombre, si: !!si, info }); log((si ? 'OK  ' : 'MAL ') + nombre + (si ? '' : ' · ' + info)); };
  const der = () => manos.derecha;
  function poner(m, pos, pinza, agarre) {
    m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
    if (m._p) m.vel.copy(pos).sub(m._p).divideScalar(Math.max(dt, 0.001)); else m.vel.set(0, 0, 0);
    m._p = pos.clone(); m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
    if (pinza !== undefined) m.pinza = pinza;
    if (agarre !== undefined) m.agarre = agarre;
  }
  function* quieto(m, seg, pinza, agarre) { let t = 0; while (t < seg) { t += dt; poner(m, m.pos.clone(), pinza, agarre); yield; } }
  function* mover(m, destino, seg, pinza, agarre) {
    const desde = m.pos.clone(); let t = 0;
    while (t < seg) { t += dt; const k = Math.min(1, t / seg); poner(m, desde.clone().lerp(typeof destino === 'function' ? destino() : destino, k), pinza, agarre); yield; }
  }
  function* hasta(cond, max = 30) { let t = 0; while (!cond()) { t += dt; if (t > max) throw new Error('timeout: ' + cond.toString()); yield; } }
  const foto = n => { T.fotoPedida = n; };
  const bot = (0, eval)('(' + src + ')');
  let gen = null;
  T.bot = (d, m) => {
    dt = d; manos = m;
    if (!gen) gen = bot({ T, THREE, der: () => manos.derecha, mover, quieto, hasta, log, foto, ok });
    const r = gen.next(); if (r.done) { T.bot = null; T.botFin = true; }
  };
  T.arrancarPC();
}, BOT.toString());
const t0 = Date.now(), hechas = new Set();
while (Date.now() - t0 < segs * 1000) {
  const e = await pag.evaluate(() => ({ fin: window.__t.botFin, foto: window.__t.fotoPedida, bot: !!window.__t.bot }));
  if (e.foto && !hechas.has(e.foto)) { hechas.add(e.foto); await pag.screenshot({ path: `herramientas/pruebas/fotos/tienda-${e.foto}.jpg`, type: 'jpeg', quality: 72 }); }
  if (e.fin || !e.bot) break;
  await pag.waitForTimeout(100);
}
const r = await pag.evaluate(() => ({ fin: !!window.__t.botFin, ...window.__t.resultados }));
console.log(JSON.stringify({ fin: r.fin, llamadas: r.llamadas, mal: r.checks.filter(c => !c.si), bien: r.checks.filter(c => c.si).length }));
console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
await nav.close();
