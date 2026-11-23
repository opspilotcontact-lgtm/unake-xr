// Fotos y pruebas del barrio (barrio.html) en el PC, sin gafas.
// Uso (con el servidor en marcha: python servir_lan.py --local 18765):
//   node herramientas/pruebas/barrio.mjs [puerto] [salas separadas por comas] [mundos]
// Saca en herramientas/pruebas/fotos/:
//   barrio-maqueta-<mundo>[-cerca].jpg   la maqueta desde el ojo y de cerca (y mide los draw calls)
//   barrio-<sala>-<mundo>-<vista>.jpg    cada sala desde el ojo (frente, izq, der, atras, suelo) y moviendo la cabeza (lado)
// Prueba además tocar un diorama con una mano simulada, volver a la maqueta y agarrarla con las dos manos.
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const [puerto = 18765, soloSalas = '', soloMundos = 'humo,normal'] = process.argv.slice(2);
const dir = 'herramientas/pruebas/fotos/';
mkdirSync(dir, { recursive: true });
const SALAS = ['cuarto', 'plaza', 'fuera', 'tienda', 'feria', 'dentro', 'cocina', 'reservado', 'bano', 'techo'];
const salas = soloSalas ? soloSalas.split(',') : SALAS;
const mundos = soloMundos.split(',');

const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.type() + ': ' + m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
pag.on('requestfailed', r => errores.push('requestfailed: ' + r.url()));
pag.on('response', r => { if (r.status() >= 400) errores.push(r.status() + ': ' + r.url()); });
const espera = ms => pag.waitForTimeout(ms);
const foto = (n, q = 72) => pag.screenshot({ path: dir + `barrio-${n}.jpg`, type: 'jpeg', quality: q });
const mirar = (x, y, z, yaw, pitch) => pag.evaluate(a => window.__barrio.mirar(...a), [x, y, z, yaw, pitch]);

await pag.goto(`http://127.0.0.1:${puerto}/barrio.html?v=${Date.now()}`);
await pag.waitForFunction(() => window.__barrio, null, { timeout: 30000 });
await pag.evaluate(() => window.__barrio.arrancarPC());
await pag.waitForFunction(() => window.__barrio.listo, null, { timeout: 60000 });
await espera(1500);

async function fotosMaqueta(mundo) {
  await mirar(0, 1.55, 0.05, 0, -0.72); await espera(400);
  await foto(`maqueta-${mundo}`, 80);
  const coste = await pag.evaluate(() => window.__barrio.coste());
  console.log(`maqueta ${mundo}:`, JSON.stringify(coste));
  await mirar(0.42, 1.12, -0.35, 0.75, -0.62); await espera(300);
  await foto(`maqueta-${mundo}-cerca`, 80);
  await mirar(-0.05, 1.05, -0.42, 0, -0.75); await espera(300);
  await foto(`maqueta-${mundo}-dentro`, 80);
  return coste;
}

async function entrar(id) {
  await mirar(0, 1.6, 0, 0, 0);
  await pag.evaluate(id => window.__barrio.entrar(id), id);
  await pag.waitForFunction(id => window.__barrio.estado === 'sala' && window.__barrio.sala === id, id, { timeout: 20000 });
  await espera(2200);
}

const costes = {};
for (const mundo of mundos) {
  await pag.evaluate(m => window.__barrio.ponerMundo(m), mundo);
  await espera(1200);
  // la maqueta solo se ve en su estado
  if (await pag.evaluate(() => window.__barrio.estado) === 'maqueta') costes[mundo] = await fotosMaqueta(mundo);
  for (const id of salas) {
    if (mundo === 'normal' && id === 'techo') continue;
    await entrar(id);
    for (const [v, x, y, z, yaw, pitch] of [
      ['frente', 0, 1.6, 0, 0, -0.08], ['izq', 0, 1.6, 0, 1.25, -0.1], ['der', 0, 1.6, 0, -1.25, -0.1],
      ['atras', 0, 1.6, 0, Math.PI, -0.1], ['suelo', 0, 1.6, 0, 0, -0.75], ['lado', 0.7, 1.55, -0.6, 0.55, -0.12],
    ]) {
      await mirar(x, y, z, yaw, pitch); await espera(200);
      await foto(`${id}-${mundo}-${v}`, 66);
    }
    const c = await pag.evaluate(() => window.__barrio.coste());
    console.log(`${id}/${mundo}:`, JSON.stringify(c));
  }
  // vuelta a la maqueta
  await mirar(0, 1.6, 0, 0, 0);
  await pag.evaluate(() => window.__barrio.volver());
  await pag.waitForFunction(() => window.__barrio.estado === 'maqueta', null, { timeout: 20000 });
  await espera(1500);
  if (!costes[mundo]) costes[mundo] = await fotosMaqueta(mundo);
}

// tocar un diorama con la punta del dedo (mano simulada) → entra en esa sala
await mirar(0, 1.55, 0.05, 0, -0.72);
const toque = await pag.evaluate(async () => {
  const B = window.__barrio, T = B.THREE, d = B.maqueta.dioramas.tienda;
  const p = B.maqueta.grupo.localToWorld(d.caja.getCenter(new T.Vector3()));
  const m = B.xr.manos.derecha;
  let t = 0;
  B.bot = (dt, manos) => {
    t += dt; m.activa = true; m.pinzaAntes = m.pinza; m.agarreAntes = m.agarre; m.pinza = false; m.agarre = false;
    const q = p.clone(); q.y += Math.max(0, 0.15 - t * 0.3); m.pos.copy(q); m.punta.copy(q);
    if (t > 1.5) { m.activa = false; B.bot = null; }
  };
  for (let i = 0; i < 80 && !(B.estado === 'sala' && B.sala === 'tienda'); i++) await new Promise(r => setTimeout(r, 100));
  return { estado: B.estado, sala: B.sala };
});
console.log('tocar la tienda →', JSON.stringify(toque));
await espera(2000);
await pag.evaluate(() => window.__barrio.volver());
await pag.waitForFunction(() => window.__barrio.estado === 'maqueta', null, { timeout: 20000 });
await espera(1500);

// agarrar con las dos manos: separar las manos escala, girarlas gira
const agarre = await pag.evaluate(async () => {
  const B = window.__barrio, T = B.THREE, g = B.maqueta.grupo;
  const antes = { s: g.scale.x, y: g.rotation.y, p: g.position.toArray().map(v => +v.toFixed(3)) };
  const i = B.xr.manos.izquierda, d = B.xr.manos.derecha, c = g.position.clone().add(new T.Vector3(0, 0.1, 0.25));
  let t = 0;
  B.bot = dt => {
    t += dt;
    const k = Math.min(1, t / 1.2), sep = 0.2 + 0.15 * k, ang = 0.5 * k;
    for (const [m, s] of [[i, -1], [d, 1]]) {
      m.activa = true; m.agarreAntes = m.agarre; m.agarre = t < 1.4; m.pinzaAntes = m.pinza; m.pinza = false;
      m.pos.set(c.x + s * sep * Math.cos(ang), c.y, c.z - s * sep * Math.sin(ang)); m.punta.copy(m.pos);
    }
    if (t > 1.6) { i.activa = d.activa = false; B.bot = null; }
  };
  await new Promise(r => setTimeout(r, 2200));
  return { antes, despues: { s: +g.scale.x.toFixed(3), y: +g.rotation.y.toFixed(3), p: g.position.toArray().map(v => +v.toFixed(3)) }, estado: B.estado };
});
console.log('agarrar con dos manos →', JSON.stringify(agarre));
await mirar(0, 1.55, 0.05, 0, -0.72); await espera(300);
await foto('maqueta-agarrada', 75);

console.log('costes maqueta:', JSON.stringify(costes));
console.log(errores.length ? errores.slice(0, 20).join('\n') : 'sin errores');
await nav.close();
