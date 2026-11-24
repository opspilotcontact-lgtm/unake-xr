// Encargos en el juego: del bar a la tienda (foto del mostrador, la tienda y el tablón), coger un encargo, seguir la
// guía de puerta en puerta hasta la sala del destino, entregarlo tocando a la persona y cobrar (entregas +1).
// Uso: node herramientas/pruebas/encargos.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [], fallos = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos.push(t); };
const ev = (f, a) => pag.evaluate(f, a);
const foto = n => pag.screenshot({ path: `herramientas/pruebas/fotos/encargo-${n}.jpg`, type: 'jpeg', quality: 70 });
const libre = () => pag.waitForFunction(() => !window.__unake.barrio.ocupado && !window.__unake.ocupadoHistoria(), null, { timeout: 60000 });

await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.2));
await ev(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await ev(() => {
  const J = window.__unake; J.fase = 'fumar'; let t = 0;
  J.bot = (d, m) => { const iz = m.izquierda; iz.pinzaAntes = iz.pinza; if (!J.ocupadoHistoria()) { iz.pinza = false; return; } t += d; iz.activa = true; iz.pinza = (t % 0.5) < 0.12; };
});
await pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && window.__unake.fase === 'fumar', null, { timeout: 60000 });
const antes = await ev(() => ({ monchis: window.__unake.motor?.monchis, entregas: window.__unake.motor?.d?.stat?.('entregas') }));
for (const id of ['fuera', 'tienda']) { await ev(id => window.__unake.cruzar(id), id); await pag.waitForFunction(id => window.__unake.barrio.salaId === id, id, { timeout: 30000 }); await libre(); }
await pag.waitForTimeout(2500);
ok(await ev(() => !!window.__unake.encargos().tablon), 'la tienda tiene el tablón de encargos');
ok(await ev(() => !!window.__unake.barrio.tienda), 'la tienda tiene su mostrador');
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0.5, -0.35));
await pag.waitForTimeout(800); await foto('tienda');
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.25));
await pag.waitForTimeout(400); await foto('mostrador');
// tocar el tablón con la mano derecha
await ev(() => {
  const J = window.__unake, T = J.THREE, p = J.encargos().tablon.getWorldPosition(new T.Vector3());
  const bot = J.bot; let n = 0;
  J.bot = (d, m) => { bot(d, m); const de = m.derecha; if (n++ < 20) { de.activa = true; de.punta.copy(p); de.pos.copy(p); } else { de.activa = false; J.bot = bot; } };
});
await pag.waitForTimeout(800);
const e = await ev(() => { const a = window.__unake.encargos().actual; return a && { destino: a.destino, pedido: a.pedido.clave, guia: window.__unake.portales().metas }; });
ok(!!e && e.guia?.includes(e.destino.sala), 'tocar el tablón da un encargo con guía: ' + JSON.stringify(e));
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, -0.6, -0.5));
await pag.waitForTimeout(600); await foto('mano');
// seguir la guía de puerta en puerta
for (let i = 0; i < 6 && e; i++) {
  const sala = await ev(() => window.__unake.barrio.salaId);
  if (sala === e.destino.sala) break;
  const sig = await ev(() => window.__unake.portales().guiada?.dest);
  if (!sig) break;
  await ev(id => window.__unake.cruzar(id), sig);
  // en el humo, «dentro» es el propio bar (Unaké), no una sala del barrio
  if (sig === 'dentro') await pag.waitForFunction(() => !window.__unake.minijuego && window.__unake.fase !== 'barrio', null, { timeout: 30000 });
  else await pag.waitForFunction(id => window.__unake.barrio.salaId === id, sig, { timeout: 30000 });
  await libre();
}
ok(await ev(() => window.__unake.barrio.salaId) === e?.destino.sala, 'la guía lleva hasta ' + e?.destino.sala);
await pag.waitForTimeout(1500);
const id = e?.destino.id === 'pompa' ? 'la-pompa' : e?.destino.id;
ok(await ev(id => window.__unake.hablarCon(id), id), 'el destinatario está en la sala: ' + id);
await pag.waitForTimeout(800);
const despues = await ev(() => ({ monchis: window.__unake.motor?.monchis, entregas: window.__unake.motor?.d?.stat?.('entregas'), lleva: !!window.__unake.encargos().actual, tarjetas: window.__unake.obj().ui.tarjetas.map(t => t.userData.texto) }));
ok(despues.monchis > antes.monchis && !despues.lleva, `entregado y cobrado: ${antes.monchis} → ${despues.monchis} monchis · entregas ${antes.entregas} → ${despues.entregas}`);
ok(despues.tarjetas.some(t => t.startsWith('Otro encargo')), 'ofrece otro encargo: ' + despues.tarjetas.join(' | '));
await foto('entrega');
ok(!errores.length, errores.length ? 'errores:\n' + errores.slice(0, 6).join('\n') : 'sin errores');
console.log(fallos.length ? `${fallos.length} FALLOS` : 'TODO OK');
await nav.close();
