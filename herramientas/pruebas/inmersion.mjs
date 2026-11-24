// Inmersión (24/11): la gente viva (balanceo, humo a la cara, aro de halo), el ambiente por sala y los momentos
// nuevos del viaje. Monta reacciones.js y ambiente.js a mano (por si app.js aún no los llama) y saca fotos.
// Uso: node herramientas/pruebas/inmersion.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765, dir = 'herramientas/pruebas/fotos/inm-';
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [];
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
pag.on('pageerror', e => errores.push('pageerror: ' + e.message));
await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba, null, { timeout: 30000 });
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, 0));
await pag.evaluate(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
const r0 = await pag.evaluate(async () => {
  const J = window.__unake, o = J.obj(), T = J.THREE;
  const { Reacciones } = await import('./js/reacciones.js');
  const { Ambiente } = await import('./js/ambiente.js');
  const { sonido, musica, prepararAudio } = await import('./js/recursos.js');
  const oyente = new T.AudioListener(); prepararAudio(oyente);
  const reac = new Reacciones({ humo: o.humo, sonido });
  const amb = new Ambiente({ oyente, sonido, musica });
  amb.entrar('dentro', 'humo', o.unake, { musica: false });
  window.__inm = { reac, amb, dichos: [] };
  for (const p of [o.lasslow, o.blancaso]) { const d = p.decir.bind(p); p.decir = (t, op) => { window.__inm.dichos.push(p.id + ': ' + t); return d(t, op); }; }
  let ult = performance.now();
  const bucle = () => {
    const ahora = performance.now(), dt = Math.min(0.05, (ahora - ult) / 1000); ult = ahora;
    reac.actualizar(dt, { personajes: [o.lasslow, o.blancaso], golpeables: [], manos: [], cuerpos: [], colocon: J.colocon = 85 });
    amb.actualizar(dt);
    requestAnimationFrame(bucle);
  };
  bucle();
  const b = o.xr.boca();
  return { pegajosos: o.humo.pegajosos.length, distCaras: [o.lasslow, o.blancaso].map(p => +p.bocaMundo(new T.Vector3()).distanceTo(b).toFixed(2)) };
});
await pag.waitForTimeout(500);
const acercar = (id, dist) => pag.evaluate(([id, dist]) => {
  const J = window.__unake, o = J.obj(), p = o[id], c = p.bocaMundo(new J.THREE.Vector3());
  const fuera = new J.THREE.Vector3(0, 1.5, 0).sub(c).setY(0).normalize();
  const cam = c.clone().addScaledVector(fuera, dist); cam.y = c.y + 0.08;
  J.prueba.mirar(cam.x, cam.y, cam.z, Math.atan2(fuera.x, fuera.z), -0.05);
}, [id, dist]);
// humo a la cara de Lasslow: tres chorros seguidos
await acercar('lasslow', 0.75); await pag.waitForTimeout(200);
await pag.evaluate(async () => {
  const J = window.__unake, o = J.obj();
  const boca = o.xr.boca(), cara = o.lasslow.bocaMundo(new J.THREE.Vector3());
  const dir = cara.sub(boca).normalize();
  for (let i = 0; i < 3; i++) { o.humo.exhalar(o.xr.boca(), dir, 1); await new Promise(r => setTimeout(r, 350)); }
});
await pag.waitForTimeout(1400);
await pag.screenshot({ path: dir + 'tos.jpg', type: 'jpeg', quality: 70 });
// un aro a Blancaso
await pag.waitForTimeout(2500);
await acercar('blancaso', 1.1); await pag.waitForTimeout(200);
await pag.evaluate(() => {
  const J = window.__unake, o = J.obj();
  const boca = o.xr.boca(), cara = o.blancaso.bocaMundo(new J.THREE.Vector3());
  o.humo.aro(boca, cara.sub(boca).normalize(), 0.04);
});
await pag.waitForTimeout(2600);
await pag.screenshot({ path: dir + 'halo.jpg', type: 'jpeg', quality: 70 });
// manotazo: Lasslow se tambalea
await pag.evaluate(() => { const o = window.__unake.obj(); o.lasslow.tambalear(1); o.blancaso.cogerPase(); });
await pag.waitForTimeout(180);
await pag.screenshot({ path: dir + 'tambaleo.jpg', type: 'jpeg', quality: 70 });
const estado = await pag.evaluate(() => ({ dichos: window.__inm.dichos, bucles: window.__inm.amb.activos.length, bal: window.__unake.obj().lasslow.bal }));
console.log(JSON.stringify({ ...r0, ...estado }));
// momentos nuevos
await pag.evaluate(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, 0));
for (const [tipo, ms] of [['liquido', 4500], ['criatura', 6500], ['latido', 3000], ['figura', 3500]]) {
  await pag.evaluate(t => { const v = window.__unake.obj().viaje; v.cortar(); v.lanzar(t); }, tipo);
  await pag.evaluate(t => window.__unake.prueba.mirar(0, 1.5, 0, 0, t === 'liquido' ? -0.6 : 0), tipo);
  await pag.waitForTimeout(ms);
  await pag.screenshot({ path: `${dir}${tipo}.jpg`, type: 'jpeg', quality: 70 });
}
console.log(JSON.stringify(await pag.evaluate(() => ({ calls: window.__unake.obj().renderer.info.render.calls, humo: window.__unake.obj().humo.p.length }))));
// el ambiente cambia de sala sin errores
await pag.evaluate(() => { const { amb } = window.__inm, o = window.__unake.obj(); for (const s of ['tienda', 'bano', 'techo', 'feria', 'fuera', 'cuarto', 'plaza', 'cocina', 'reservado']) amb.entrar(s, 'humo', o.unake, { musica: false }); amb.salir(); });
await pag.waitForTimeout(2500);
console.log(errores.length ? errores.slice(0, 8).join('\n') : 'sin errores');
await nav.close();
