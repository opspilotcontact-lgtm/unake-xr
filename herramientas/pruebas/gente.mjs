// La gente de las salas: entrar en la cocina, tocar a Cotine (saluda con su frase del 2D y ofrece la Tarta),
// elegir «Jugar» → en el humo te manda a la máquina del bar (misión pedida y guía hacia Unaké). Luego Perico (Pipas,
// nativo): «Jugar» sale de la sala y empieza Pipas.
// Uso: node herramientas/pruebas/gente.mjs [puerto]
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
const foto = n => pag.screenshot({ path: `herramientas/pruebas/fotos/gente-${n}.jpg`, type: 'jpeg', quality: 70 });
const tarjetas = () => ev(() => window.__unake.obj().ui.tarjetas.map(t => t.userData.texto));
const elegir = texto => ev(t => { const ui = window.__unake.obj().ui; const tj = ui.tarjetas.find(x => x.userData.texto === t); tj.userData.alElegir ? tj.userData.alElegir(t) : ui._elegir?.(tj); return !!tj; }, texto);

await pag.goto(`http://127.0.0.1:${puerto}/?v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));
await ev(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await ev(() => {
  const J = window.__unake; J.fase = 'fumar'; let t = 0;
  J.bot = (d, m) => { const iz = m.izquierda; iz.pinzaAntes = iz.pinza; if (!J.ocupadoHistoria()) { iz.pinza = false; iz.activa = false; return; } t += d; iz.activa = true; iz.pinza = (t % 0.5) < 0.12; };
});
await pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && window.__unake.fase === 'fumar', null, { timeout: 60000 });
await ev(() => window.__unake.cruzar('cocina'));
await pag.waitForFunction(() => window.__unake.barrio.salaId === 'cocina' && !window.__unake.barrio.ocupado && !window.__unake.ocupadoHistoria(), null, { timeout: 60000 });
await pag.waitForTimeout(1500);
ok(await ev(() => window.__unake.hablarCon('cotine')), 'Cotine está en la cocina y se le puede hablar');
await pag.waitForTimeout(800);
const tj = await tarjetas();
ok(tj.some(t => t.includes('Jugar: ')) && tj.includes('Ahora no'), 'ofrece su minijuego: ' + tj.join(' | '));
await ev(() => { const J = window.__unake, r = J.barrio.gente.find(x => x.id === 'cotine'); J.prueba.mirar(0, 1.5, 0, Math.atan2(-(r.grupo.position.x), -(r.grupo.position.z)), -0.1); });
await pag.waitForTimeout(600);
await foto('cotine');
// pulsar la tarjeta: el ui elige por el dedo; aquí, llamar a su callback
const jugo = await ev(() => { const ui = window.__unake.obj().ui; const tj = ui.tarjetas.find(x => x.userData.texto.includes('Jugar: ')); if (!tj) return 'sin tarjeta'; const cb = tj.userData.cb || tj.userData.alElegir || ui.alElegir; if (!cb) return 'sin callback: ' + Object.keys(tj.userData).join(','); cb(tj.userData.texto); return 'ok'; });
ok(jugo === 'ok', 'pulsar «Jugar»: ' + jugo);
await pag.waitForTimeout(800);
const m = await ev(() => ({ mision: window.__unake.recreativa().mision?.clave, guia: window.__unake.portales().metas, sala: window.__unake.barrio.salaId }));
ok(m.mision === 'Tarta' && m.guia?.includes('dentro') && m.sala === 'cocina', 'en el humo, la Tarta va a la máquina con guía al bar: ' + JSON.stringify(m));
await ev(() => window.__unake.cruzar('dentro'));
await pag.waitForFunction(() => !window.__unake.minijuego && !window.__unake.barrio.ocupado, null, { timeout: 20000 });
ok(await ev(() => window.__unake.portales().metas) === null, 'al llegar al bar, la guía se apaga');
ok(!errores.length, errores.length ? 'errores:\n' + errores.slice(0, 6).join('\n') : 'sin errores');
console.log(fallos.length ? `${fallos.length} FALLOS` : 'TODO OK');
await nav.close();
