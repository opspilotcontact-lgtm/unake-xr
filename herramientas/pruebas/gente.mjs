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
// la Tarta ya es nativa: se juega aquí mismo, en la cocina, y al acabar vuelves a la sala
await pag.waitForFunction(() => window.__unake.minijuego?.id === 'tarta', null, { timeout: 30000 }).catch(() => { });
ok(await ev(() => window.__unake.minijuego?.id) === 'tarta', 'la Tarta (nativa) empieza en la cocina');
await pag.waitForTimeout(3000);
await foto('tarta');
await ev(() => window.__unake.minijuego?.inst?.abandonar?.());
// «Volver» en las tarjetas finales
await pag.waitForFunction(() => window.__unake.obj().ui.tarjetas.some(t => t.userData.texto === 'Volver'), null, { timeout: 20000 }).catch(() => { });
await ev(() => { const ui = window.__unake.obj().ui; const tj = ui.tarjetas.find(t => t.userData.texto === 'Volver'); (tj?.userData.cb || ui.alElegir)?.('Volver'); });
await pag.waitForFunction(() => !window.__unake.barrio.ocupado && window.__unake.fase === 'barrio' && window.__unake.barrio.salaId === 'cocina', null, { timeout: 30000 }).catch(() => { });
ok(await ev(() => window.__unake.barrio.salaId) === 'cocina' && await ev(() => window.__unake.fase) === 'barrio', 'al acabar vuelves a la cocina: ' + JSON.stringify(await ev(() => ({ fase: window.__unake.fase, sala: window.__unake.barrio.salaId }))));
ok(!errores.length, errores.length ? 'errores:\n' + errores.slice(0, 6).join('\n') : 'sin errores');
console.log(fallos.length ? `${fallos.length} FALLOS` : 'TODO OK');
await nav.close();
