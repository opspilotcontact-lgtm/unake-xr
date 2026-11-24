// La guía activa y el primer minuto (js/historia/guia.js + app.js):
//   · onboarding: 4 cartelas con «Saltar», solo la primera vez (localStorage unake-xr-visto-intro);
//   · misión en la máquina: la máquina pide la misión ★ (parpadea) y la pista lo dice;
//   · misión de día estando en el humo: la pista lo dice y la ★ te devuelve a casa; de día, la ★ te lleva a la sala;
//   · recoger: lo que hay que coger brilla en el bar y se coge con la mano (ya no basta con entrar);
//   · pista si llevas 60 s sin avanzar, y como mucho una cada 45 s; la ★ de la muñeca late al cambiar el objetivo.
// Uso (servidor en marcha): node herramientas/pruebas/guia.mjs [puerto]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');
const puerto = process.argv[2] || 18765;
const nav = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const pag = await nav.newPage({ viewport: { width: 1280, height: 720 } });
const errores = [], fallos = [];
pag.on('pageerror', e => errores.push(e.message));
pag.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errores.push(m.text()); });
const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); if (!c) fallos.push(t); };
const ev = (f, a) => pag.evaluate(f, a);
const foto = n => pag.screenshot({ path: `herramientas/pruebas/fotos/guia-${n}.jpg`, type: 'jpeg', quality: 70 });
const elegir = texto => ev(t => { const ui = window.__unake.obj().ui; const tj = ui.tarjetas.find(x => x.userData.texto === t); if (tj) ui._elegir(tj, window.__unake.obj().xr.manos.derecha); return !!tj; }, texto);
const libre = () => pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && !window.__unake.barrio.ocupado && !window.__unake.transicion && !window.__unake.motor.escenaPendiente, null, { timeout: 90000 });

await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba && window.__unake.motor, null, { timeout: 90000 });
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));

// ---------- 1. el primer minuto ----------
ok(await ev(() => !localStorage.getItem('unake-xr-visto-intro')), 'perfil nuevo: la intro no está vista');
await ev(() => { const J = window.__unake; J.prueba.ir('liar').then(() => { J.fase = 'portada'; J.primerMinuto(); }); });
await pag.waitForTimeout(1500);
let s = await ev(() => ({ intro: window.__unake.intro, tj: window.__unake.obj().ui.tarjetas.map(t => t.userData.texto) }));
ok(s.intro?.paso === 0 && s.tj.includes('Saltar'), 'la intro arranca con la chuleta y «Saltar»: ' + JSON.stringify(s));
await foto('intro-1');
await pag.waitForTimeout(5500);
s = await ev(() => ({ paso: window.__unake.intro?.paso, fase: window.__unake.fase, pulso: window.__unake.motor && window.__unake.guia && window.__unake.obj && null }));
ok(s.paso === 1 && s.fase === 'intro', 'segundo paso: la muñeca (★ = tu misión): ' + JSON.stringify(s));
await foto('intro-2');
ok(await elegir('Saltar'), 'se toca «Saltar»');
await pag.waitForTimeout(800);
s = await ev(() => ({ intro: window.__unake.intro, hecha: window.__unake.introHecha, visto: localStorage.getItem('unake-xr-visto-intro') }));
ok(!s.intro && s.hecha?.saltado && s.visto === '1', 'saltada y apuntada para no repetirla: ' + JSON.stringify(s));

// ---------- 2. al humo, con la historia en marcha ----------
await ev(() => { const J = window.__unake; J.fase = 'prueba'; J.colocon = 40; });
await pag.waitForFunction(() => window.__unake.mundo === 'humo' && !window.__unake.transicion, null, { timeout: 30000 });
await ev(() => {
  const J = window.__unake; J.fase = 'fumar'; let t = 0;
  J.bot = (d, m) => { const iz = m.izquierda; iz.pinzaAntes = iz.pinza; if (!J.ocupadoHistoria()) { iz.pinza = false; iz.activa = false; return; } t += d; iz.activa = true; iz.pinza = (t % 0.5) < 0.12; };
});
await libre();

// misión en la máquina (cap. 2, «La cuota»: la Barra)
await ev(() => window.__unake.motor.irA(1, { conIntro: false }));
await libre(); await pag.waitForTimeout(2600);
s = await ev(() => { const J = window.__unake, o = J.motor.objetivos().historia; return { o: o.id, plan: J.guia.plan(o), mision: J.recreativa().mision?.clave }; });
// la Barra ya es nativa (24/11): la pista manda a la ★ para jugarla en VR, no a la máquina
ok(!s.plan?.maquina && /★/.test(s.plan?.texto || '') && /barra/i.test(s.plan?.texto || ''), 'misión nativa (Barra): la pista manda a la ★ y no a la máquina: ' + JSON.stringify(s));
let p = await ev(() => window.__unake.guia.pistaYa('prueba'));
ok(!!p?.texto, 'pista dicha: ' + JSON.stringify(p));
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0.9, -0.25));
await pag.waitForTimeout(900); await foto('maquina');
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));

// ---------- 3. pista si no avanzas, y no más de una cada 45 s ----------
await ev(() => { const g = window.__unake.guia; g.tUltima = g.t - 70; g.tAvance = g.t - 70; g.repes = 0; g.pendiente = null; });
await pag.waitForTimeout(1500);
s = await ev(() => window.__unake.guia.ultima);
ok(s?.motivo === 'quieto', '60 s sin avanzar: pista sola: ' + JSON.stringify(s));
const n1 = await ev(() => window.__unake.guia.historial.length);
await ev(() => { const g = window.__unake.guia; g.tAvance = g.t - 70; g.empujar('volver', 0); });
await pag.waitForTimeout(1500);
ok(await ev(() => window.__unake.guia.historial.length) === n1, 'pero no otra antes de 45 s (ni al volver)');

// ---------- 4. misión de día estando en el humo ----------
await ev(() => window.__unake.motor.irA(6, { conIntro: false })); // «El nuevo»: de día, sigue a Lasslow
await libre(); await pag.waitForTimeout(1200);
s = await ev(() => { const J = window.__unake, o = J.motor.objetivos().historia; return { o: o.id, plan: J.guia.plan(o), pulso: J.obj && null }; });
ok(s.plan?.cambiar === 'normal' && /de día/.test(s.plan.texto), 'misión de día en el humo: la pista dice cómo volver: ' + JSON.stringify(s));
await ev(() => window.__unake.accionHistoria());
await pag.waitForFunction(() => window.__unake.mundo === 'normal' && !window.__unake.transicion, null, { timeout: 30000 });
await libre(); await pag.waitForTimeout(600);
ok(true, 'la ★ te devuelve a casa (de día)');
s = await ev(() => { const J = window.__unake, o = J.motor.objetivos().historia; return { o: o.id, plan: J.guia.plan(o) }; });
ok(/te llevo/.test(s.plan?.texto || ''), 'de día, la pista ofrece llevarte: ' + JSON.stringify(s.plan));
await ev(() => { window.__unake.fase = 'fumar'; window.__unake.accionHistoria(); });
await pag.waitForFunction(() => window.__unake.barrio.salaId === 'dentro', null, { timeout: 30000 });
await libre(); await pag.waitForTimeout(1500);
// hablar = tocar: entrar ya no basta si le ves; se le toca (y se cierra su oferta de minijuegos)
await ev(() => { const J = window.__unake; J.hablarCon('lasslow'); J.obj().ui.quitarTarjetas(); J.charla = false; });
await pag.waitForTimeout(600); await libre(); await pag.waitForTimeout(600);
s = await ev(() => { const o = window.__unake.motor.objetivos(); return { hecho: o.todos[0]?.hecho, actual: o.historia?.id }; });
ok(s.hecho, 'la ★ te lleva a la barra y Lasslow cuenta: ' + JSON.stringify(s));
await foto('dia-barra');
await ev(() => window.__unake.salirSala(false));
await pag.waitForFunction(() => window.__unake.fase !== 'barrio' && !window.__unake.barrio.ocupado, null, { timeout: 30000 });

// ---------- 5. recoger: brilla y se coge con la mano (cap. 3, «La Pompa»: agua en la barra) ----------
await ev(() => { const J = window.__unake; J.motor.irA(2, { conIntro: false }); J.colocon = 40; J.fase = 'fumar'; });
await pag.waitForFunction(() => window.__unake.mundo === 'humo' && !window.__unake.transicion, null, { timeout: 30000 });
await libre();
await ev(() => window.__unake.motor.simularObjetivo()); // hablar con la Pompa
await libre(); await pag.waitForTimeout(2500);
s = await ev(() => { const J = window.__unake, o = J.motor.objetivos().historia; return { o: o.id, tipo: o.tipo, progreso: o.progreso, cosas: J.recogibles().cosas.map(k => k.tipo), sala: J.recogibles().sala }; });
ok(s.tipo === 'recoger' && s.cosas.includes('agua') && s.sala === 'dentro', 'el agua brilla en el bar (no se coge sola): ' + JSON.stringify(s));
await foto('recoger');
await ev(() => {
  const J = window.__unake, T = J.THREE, k = J.recogibles().cosas[0]; const pos = k.cosa.getWorldPosition(new T.Vector3());
  const bot = J.bot; let n = 0;
  J.bot = (d, m) => { bot(d, m); const de = m.derecha; if (n++ < 15) { de.activa = true; de.punta.copy(pos); de.pos.copy(pos); } else { de.activa = false; J.bot = bot; } };
});
await pag.waitForTimeout(1200);
s = await ev(() => { const J = window.__unake, o = J.motor.objetivos().historia; return { progreso: o.progreso, cosas: J.recogibles().cosas.length, plan: J.guia.plan(o) }; });
ok(s.progreso === '1/2' && s.cosas === 0, 'tocarla la coge (1/2): ' + JSON.stringify(s));
ok((s.plan?.hilo || []).includes('tienda') && /hilo de humo/.test(s.plan.texto), 'y el hilo lleva a la tienda a por lo salado: ' + JSON.stringify(s.plan));
ok(await ev(() => window.__unake.portales().metas?.includes('tienda')), 'el hilo de humo apunta a la tienda');

// ---------- 6. la ★ late al cambiar el objetivo ----------
ok(await ev(() => window.__unake.guia.historial.some(h => h.motivo === 'cambio' || h.motivo === 'escena' || h.motivo === 'volver')), 'hubo pistas al cambiar el objetivo / al volver');

await nav.close();
console.log(errores.length ? 'errores:\n' + errores.join('\n') : 'sin errores');
if (errores.length) fallos.push('errores');
console.log(fallos.length ? fallos.length + ' FALLOS' : 'TODO OK');
process.exit(fallos.length ? 1 : 0);
