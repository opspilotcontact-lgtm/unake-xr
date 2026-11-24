// Bot del negocio de Unaké, la casa de muñecas (negocio.html, motor falso con 300 monchis, caja 40, máximo nivel 3).
// Uso (servidor en marcha): node herramientas/pruebas/negocio.mjs <puerto> [segundos]
// Toca una zona (elige), coge la pieza de la bandeja y la pone en su sitio (compra + meta «primera mejora»), suelta
// otra lejos (vuelve a la bandeja), intenta una que no le llega, mira una «más adelante», tira de la palanca (cobra y
// las monedas vuelan a la mano), tira con la caja vacía y por último enseña el bar al máximo.
// Fotos en herramientas/pruebas/fotos/negocio-*.jpg
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18800, segs = 90] = process.argv.slice(2);
mkdirSync('herramientas/pruebas/fotos', { recursive: true });

const BOT = function* ({ T, THREE, der, mover, quieto, hasta, log, foto, ok }) {
  const { motor, negocio: N } = T;
  const st = () => N.estado();
  const R = der();
  const reposo = () => st().zonas.horno.clone().add(new THREE.Vector3(0, 0.18, 0)).lerp(T.xr.cabeza, 0.35);
  T.mirar(0, 1.2, 0, -0.75, -0.62);
  yield* mover(R, reposo(), 0.2, false);
  yield* quieto(R, 0.8, false);
  foto('inicio');
  T.resultados.llamadas = T.llamadas(); log('llamadas de dibujo: ' + T.llamadas());
  ok('elige la más barata al montar', st().sel === 'neon' && st().pieza?.estado === 'bandeja', JSON.stringify({ sel: st().sel, p: st().pieza }));

  // 1) tocar los sofás
  yield* mover(R, () => st().zonas.sofas, 0.5, false);
  yield* quieto(R, 0.4, false);
  ok('tocar elige sofás', st().sel === 'sofas' && st().pieza?.id === 'sofas', st().sel);
  foto('elegir');
  // 2) coger la pieza de la bandeja y ponerla en su sitio
  yield* mover(R, () => st().pieza.pos, 0.5, false);
  yield* quieto(R, 0.1, true);
  ok('coge la pieza', st().pieza?.estado === 'mano', st().pieza?.estado);
  yield* mover(R, () => st().zonas.sofas, 0.7, true);
  yield* quieto(R, 0.15, true);
  foto('llevando');
  const m0 = motor.monchis;
  yield* quieto(R, 0.08, false);
  yield* quieto(R, 0.3, false);
  foto('encaja');
  yield* quieto(R, 0.4, false);
  ok('compra sofás nivel 1', st().niveles.sofas === 1 && motor.monchis === m0 - 70 + 20, `nivel ${st().niveles.sofas} monchis ${motor.monchis}`);
  ok('alMejorar', T.mejoras.some(x => x.id === 'sofas' && x.nivel === 1), JSON.stringify(T.mejoras));
  yield* quieto(R, 1.4, false);
  ok('alMeta primera mejora', T.metas.includes('Compra tu primera mejora'), JSON.stringify(T.metas));
  ok('pieza nueva de sofás en la bandeja', st().pieza?.id === 'sofas' && st().pieza.estado === 'bandeja', JSON.stringify(st().pieza));
  foto('sofa-puesto');
  // 3) la barra: cogerla y soltarla lejos → vuelve a la bandeja
  yield* mover(R, reposo(), 0.3, false);
  yield* mover(R, () => st().zonas.barra, 0.5, false);
  yield* quieto(R, 0.3, false);
  ok('tocar elige barra', st().sel === 'barra', st().sel);
  yield* mover(R, () => st().pieza.pos, 0.6, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, () => st().pieza.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 0.4, true);
  yield* quieto(R, 0.1, false);
  yield* quieto(R, 0.6, false);
  ok('soltada lejos vuelve', st().pieza?.estado === 'bandeja' && !st().niveles.barra, JSON.stringify(st().pieza));
  // 4) una que no te llega: la cabina (160) con 30 monchis
  const guardo = motor.E.monchis; motor.E.monchis = 30;
  yield* mover(R, reposo(), 0.3, false);
  yield* mover(R, () => st().zonas.dj, 0.6, false);
  yield* quieto(R, 0.4, false);
  yield* mover(R, () => st().pieza.pos, 0.6, false);
  yield* quieto(R, 0.15, true);
  ok('sin monchis no se despega', st().pieza?.estado === 'bandeja' && motor.monchis === 30 && !st().niveles.dj, JSON.stringify(st().pieza));
  foto('no-llega');
  yield* quieto(R, 0.3, false);
  motor.E.monchis = guardo;
  // 5) más adelante: el máximo del acto
  T.setMax(1);
  yield* mover(R, reposo(), 0.3, false);
  yield* mover(R, () => st().zonas.sofas, 0.5, false);
  yield* quieto(R, 0.5, false);
  ok('al máximo del acto: sin pieza', st().sel === 'sofas' && !st().pieza, JSON.stringify(st().pieza));
  foto('mas-adelante');
  T.setMax(3);
  yield* mover(R, reposo(), 0.3, false);
  yield* quieto(R, 0.4, false);

  // ---------- la caja ----------
  motor.E.negocio.caja = 50;
  yield* quieto(R, 0.4, false);
  foto('caja-llena');
  const antes = motor.monchis;
  yield* mover(R, () => st().pomo, 0.5, false);
  yield* quieto(R, 0.1, true);
  const tirar = () => { const p = st().pomo.clone(), h = T.xr.cabeza.clone().setY(p.y); return p.add(h.sub(p).normalize().multiplyScalar(0.11)).add(new THREE.Vector3(0, -0.08, 0)); };
  const destino = tirar();
  yield* mover(R, destino, 0.4, true);
  yield* quieto(R, 0.15, true);
  foto('cobrando');
  ok('tirar de la palanca cobra', T.cobros.length === 1 && motor.monchis === antes + 50 + 25, `palanca ${st().palanca.toFixed(2)} monchis ${motor.monchis} cobros ${JSON.stringify(T.cobros)}`);
  yield* quieto(R, 0.6, true);
  ok('monedas a la mano', st().monedas === 0, 'monedas ' + st().monedas);
  yield* quieto(R, 0.5, false);
  ok('la palanca vuelve', st().palanca < 0.05, st().palanca);
  // vacía
  motor.E.negocio.caja = 0;
  yield* mover(R, () => st().pomo, 0.4, false);
  yield* quieto(R, 0.1, true);
  yield* mover(R, tirar(), 0.4, true);
  yield* quieto(R, 0.2, false);
  ok('caja vacía no cobra', T.cobros.length === 1, JSON.stringify(T.cobros));

  // ---------- el bar al máximo ----------
  for (const id of ['neon', 'sofas', 'barra', 'maquina', 'horno', 'dj', 'bolsitas']) motor.E.negocio.niveles[id] = 5;
  T.setMax(5); motor.E.negocio.caja = 300;
  yield* mover(R, reposo(), 0.3, false);
  yield* quieto(R, 0.8, false);
  ok('se rehace al máximo', st().niveles.dj === 5 && st().clientes > 5, JSON.stringify(st().niveles) + ' clientes ' + st().clientes);
  T.resultados.llamadasMax = T.llamadas(); log('llamadas al máximo: ' + T.llamadas());
  foto('maximo');
  const cen = st().zonas.sofas.clone().lerp(st().zonas.barra, 0.5), cab = T.xr.cabeza.clone();
  T.camara.position.copy(cen.clone().lerp(cab, 0.55)); T.camara.lookAt(cen);
  yield* quieto(R, 0.4, false);
  foto('maximo-cerca');
  // otra vez a nivel 1 para ver el bar a medias
  for (const [id, n] of Object.entries({ neon: 2, sofas: 2, barra: 1, maquina: 1, horno: 2, dj: 0, bolsitas: 0 })) motor.E.negocio.niveles[id] = n;
  T.mirar(0, 1.2, 0, -0.75, -0.62);
  yield* quieto(R, 0.6, false);
  foto('a-medias');
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
try {
  await pag.goto(`http://127.0.0.1:${puerto}/negocio.html?pc&v=${Date.now()}`);
  await pag.waitForFunction(() => window.__t && window.__t.listo, null, { timeout: 30000 });
  await pag.evaluate(src => {
    const T = window.__t, THREE = T.THREE;
    let dt = 0.016, manos;
    T.resultados = { checks: [] };
    const log = m => console.log('[bot] ' + T.t.toFixed(1) + 's ' + m);
    const ok = (nombre, si, info = '') => { T.resultados.checks.push({ nombre, si: !!si, info: String(info) }); log((si ? 'OK  ' : 'MAL ') + nombre + (si ? '' : ' · ' + info)); };
    function poner(m, pos, pinza, agarre) {
      m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.activa = true;
      m.pos.copy(pos); m.punta.copy(pos); m.grupo.position.copy(pos);
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
    if (e.foto && !hechas.has(e.foto)) { hechas.add(e.foto); await pag.screenshot({ path: `herramientas/pruebas/fotos/negocio-${e.foto}.jpg`, type: 'jpeg', quality: 72 }); }
    if (e.fin || !e.bot) break;
    await pag.waitForTimeout(60);
  }
  const r = await pag.evaluate(() => ({ fin: !!window.__t.botFin, ...window.__t.resultados }));
  console.log(JSON.stringify({ fin: r.fin, llamadas: r.llamadas, llamadasMax: r.llamadasMax, mal: r.checks.filter(c => !c.si), bien: r.checks.filter(c => c.si).length }));
} finally {
  console.log(errores.length ? errores.slice(0, 12).join('\n') : 'sin errores');
  await nav.close();
}
