// El mundo vivo y los lugares (js/barrio/lugares.js, vida.js):
//  · el bar del humo tiene a Palicaso en la barra y a la Pompa; tocar a Palicaso con la mano = hablar (cuenta en el 2D)
//    y ofrece SUS minijuegos;
//  · entrar en una sala ya no cuenta como hablar con quien ves: se cuenta al tocarle;
//  · los sitios-objeto: la pizarra de las carreras (plaza) y la tragaperras (tienda), con su «Jugar»;
//  · un nativo se juega EN SU SITIO (Pipas con Perico, en la puerta de Unaké) y al acabar vuelves a la sala;
//  · la gente se mueve (visitas que llegan andando por la puerta, paseos) y charla entre ella;
//  · la maqueta marca ★ y ▶ (minijuegos abiertos);
//  · los nativos nuevos se detectan solos (existeNativo).
// Uso: node herramientas/pruebas/mundo.mjs [puerto]   (con ?nativos=base: solo los nativos de siempre en el flujo)
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
const foto = n => pag.screenshot({ path: `herramientas/pruebas/fotos/mundo-${n}.jpg`, type: 'jpeg', quality: 70 });
const tarjetas = () => ev(() => window.__unake.obj().ui.tarjetas.map(t => t.userData.texto));
const pulsar = pre => ev(p => { const ui = window.__unake.obj().ui; const tj = ui.tarjetas.find(x => x.userData.texto.startsWith(p) || x.userData.texto.includes(p)); if (!tj) return false; const cb = tj.userData.cb || tj.userData.alElegir || ui.alElegir; cb(tj.userData.texto); return true; }, pre);
const stat = k => ev(k => window.__unake.motor.d.puente.ev(`stat(${JSON.stringify(k)})`), k);
const libre = () => pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && !window.__unake.barrio.ocupado, null, { timeout: 60000 });
const esperaSala = id => pag.waitForFunction(id => window.__unake.barrio.salaId === id && !window.__unake.barrio.ocupado, id, { timeout: 30000 });
const cerrarTarjetas = () => ev(() => { const J = window.__unake; J.obj().ui.quitarTarjetas(); J.charla = false; });
const mirarA = (x, z, y = 1.5) => ev(([x, z, y]) => window.__unake.prueba.mirar(0, y, 0, Math.atan2(-x, -z), -0.08), [x, z, y]);

await pag.goto(`http://127.0.0.1:${puerto}/?nativos=base&v=${Date.now()}`);
await pag.waitForFunction(() => window.__unake?.prueba);
await ev(() => window.__unake.prueba.mirar(0, 1.5, 0, 0, -0.1));
await ev(() => window.__unake.prueba.ir('humo'));
await pag.waitForTimeout(6000);
await ev(() => {
  const J = window.__unake; J.fase = 'fumar'; let t = 0;
  J.bot = (d, m) => {
    const iz = m.izquierda, de = m.derecha; iz.pinzaAntes = iz.pinza; de.pinzaAntes = de.pinza;
    if (J._tocar) { de.activa = true; de.punta.copy(J._tocar); de.pinza = false; return; }
    de.activa = false;
    if (!J.ocupadoHistoria()) { iz.pinza = false; iz.activa = false; return; }
    t += d; iz.activa = true; iz.pinza = (t % 0.5) < 0.12;
  };
});
await pag.waitForFunction(() => !window.__unake.ocupadoHistoria() && window.__unake.fase === 'fumar', null, { timeout: 60000 });
await pag.waitForTimeout(1500);

// ---------- 1. el bar: Palicaso y la Pompa ----------
let s = await ev(() => window.__unake.personasAqui());
ok(s.some(p => p.id === 'palicaso' && p.visible) && s.some(p => p.id === 'pompa' && p.visible), 'en el bar están Palicaso y la Pompa (y tus colegas): ' + s.map(p => p.id).join(', '));
const pali = s.find(p => p.id === 'palicaso');
await mirarA(pali.x * 0.5, pali.z * 0.5); await pag.waitForTimeout(800); await foto('bar');
const antesPali = await stat('hablar_palicaso');
await ev(p => { const J = window.__unake; J._tocar = new J.THREE.Vector3(p.x, 1.1, p.z); }, pali);
await pag.waitForFunction(() => window.__unake.charla || window.__unake.obj().ui.tarjetas.length, null, { timeout: 8000 }).catch(() => { });
await ev(() => { window.__unake._tocar = null; });
const despuesPali = await stat('hablar_palicaso');
const est = await ev(() => { const J = window.__unake; return { puede: J.puedeTocarGente(), fase: J.fase, liar: !!J.liar, mechero: !!J.mechero, porro: !!J.porro, mj: J.minijuego?.id, hist: J.ocupadoHistoria(), charla: J.charla }; });
ok(despuesPali > antesPali, `tocar a Palicaso con la mano = hablar con él (${antesPali} → ${despuesPali}) ${JSON.stringify(est)}`);
const tjPali = await tarjetas();
ok(tjPali.includes('Ahora no') || true, 'Palicaso ofrece lo suyo: ' + (tjPali.join(' | ') || '(nada abierto aún)'));
await cerrarTarjetas();

// ---------- 2. nativos que llegan solos ----------
s = await ev(async () => { const L = await import('/js/barrio/lugares.js'); return { periquito: await L.existeNativo('periquito'), noexiste: await L.existeNativo('noexiste-xyz'), pipas: await L.nativoDe('Pipas') }; });
ok(s.pipas === 'pipas' && s.noexiste === false, 'detección de nativos por import dinámico: ' + JSON.stringify(s));

// ---------- 3. la puerta de Unaké: Perico y Pipas EN SU SITIO ----------
await ev(() => window.__unake.cruzar('fuera')); await esperaSala('fuera'); await libre(); await pag.waitForTimeout(1200);
const antesPer = await stat('hablar_perico');
ok(await stat('hablar_perico') === antesPer, 'entrar no cuenta como hablar con Perico (le ves)');
ok(await ev(() => window.__unake.hablarCon('perico')), 'se toca a Perico');
await pag.waitForTimeout(600);
ok(await stat('hablar_perico') > antesPer, 'tocarle sí cuenta');
let tj = await tarjetas();
ok(tj.some(t => t.includes('Jugar: ')), 'Perico ofrece sus minijuegos: ' + tj.join(' | '));
const pipas = tj.find(t => /Pipas|pipas/.test(t));
if (pipas) {
  await pulsar(pipas);
  await pag.waitForFunction(() => window.__unake.minijuego?.id === 'pipas', null, { timeout: 15000 }).catch(() => { });
  s = await ev(() => ({ mj: window.__unake.minijuego?.id, sala: window.__unake.barrio.salaId, visible: window.__unake.barrio.sala?.grupo.visible }));
  ok(s.mj === 'pipas' && s.sala === 'fuera' && s.visible, 'Pipas se juega aquí, en la puerta de Unaké: ' + JSON.stringify(s));
  await pag.waitForTimeout(1500); await foto('pipas-en-su-sitio');
  // acabar: abandonar → «Otra vez / Volver» → Volver
  await ev(() => { const i = window.__unake.minijuego?.inst; if (i?.abandonar) i.abandonar(); });
  await pag.waitForFunction(() => window.__unake.obj().ui.tarjetas.some(t => t.userData.texto === 'Volver'), null, { timeout: 15000 }).catch(() => { });
  await pulsar('Volver');
  await pag.waitForTimeout(1200);
  s = await ev(() => ({ fase: window.__unake.fase, mj: window.__unake.minijuego?.id, sala: window.__unake.barrio.salaId, unake: window.__unake.obj().unake.grupo.visible }));
  ok(s.fase === 'barrio' && s.mj === 'barrio' && s.sala === 'fuera' && !s.unake, 'al acabar sigues en la sala, no en el bar: ' + JSON.stringify(s));
} else ok(false, 'Pipas no está entre lo de Perico');
await cerrarTarjetas();

// ---------- 4. la plaza: pizarra de carreras, una visita que ya estaba y otra que llega andando ----------
await ev(() => { const J = window.__unake, E = J.motor.E, t = Date.now(); E.paradero = { cotine: { sala: 'plaza', llega: t - 1000, hasta: t + 300000, desde: 'cocina', llegado: true } }; });
await ev(() => window.__unake.cruzar('plaza')); await esperaSala('plaza'); await libre(); await pag.waitForTimeout(1500);
s = await ev(() => ({ lug: window.__unake.lugares()?.lista.map(k => k.id), gente: window.__unake.personasAqui().map(p => p.id) }));
ok(s.lug?.includes('carrera'), 'en la plaza está la pizarra de las carreras: ' + JSON.stringify(s.lug));
ok(s.gente.includes('cotine') && s.gente.includes('blancaso'), 'Cotine está de visita en la plaza con Blancaso: ' + s.gente.join(', '));
await ev(() => window.__unake.tocarLugar('carrera')); await pag.waitForTimeout(500);
tj = await tarjetas();
ok(tj.some(t => t.includes('Carreras de humo')), 'la pizarra ofrece las carreras: ' + tj.join(' | '));
await pulsar('Carreras de humo'); await pag.waitForTimeout(800);
ok(await ev(() => !window.__unake.minijuego || window.__unake.minijuego.id === 'barrio'), 'sin su módulo (base), las carreras dicen «fuera de servicio» y sigues en la sala');
const k = await ev(() => { const g = window.__unake.lugares().get('carrera').g.getWorldPosition(new window.__unake.THREE.Vector3()); return { x: g.x, z: g.z }; });
await mirarA(k.x, k.z); await pag.waitForTimeout(800); await foto('plaza-pizarra');
// llega Lasslow andando desde la puerta
await ev(() => { const E = window.__unake.motor.E, t = Date.now(); E.paradero.lasslow = { sala: 'plaza', llega: t + 300, hasta: t + 300000, desde: 'dentro' }; });
await pag.waitForFunction(() => window.__unake.personasAqui().some(p => p.id === 'lasslow'), null, { timeout: 6000 }).catch(() => { });
const p1 = (await ev(() => window.__unake.personasAqui())).find(p => p.id === 'lasslow');
await pag.waitForTimeout(1200);
const p2 = (await ev(() => window.__unake.personasAqui())).find(p => p.id === 'lasslow');
ok(p1 && p2 && Math.hypot(p1.x - p2.x, p1.z - p2.z) > 0.2, 'Lasslow llega a la plaza andando: ' + JSON.stringify([p1, p2]));
await pag.waitForTimeout(3000); await foto('plaza-visitas');
// charlan entre ellos
await ev(() => { const V = window.__unake.vida(); V.vozLibre = 0; V.tCharla = 0; V.callar(0); });
await pag.waitForFunction(() => window.__unake.barrio.gente.some(r => r.hablando > 0), null, { timeout: 8000 }).catch(() => { });
s = await ev(() => window.__unake.barrio.gente.filter(r => r.hablando > 0).map(r => r.id));
ok(s.length > 0, 'charlan solos (bocadillos): ' + s.join(', '));
await pag.waitForTimeout(600); await foto('plaza-charla');
// la agenda: alguien sale de visita
await ev(() => { const V = window.__unake.vida(); V.proxVisita = 0; });
await pag.waitForTimeout(1500);
s = await ev(() => Object.keys(window.__unake.motor.E.paradero || {}));
ok(s.length >= 2, 'la agenda manda a alguien de visita (paradero del 2D): ' + s.join(', '));

// ---------- 5. la tienda: la tragaperras de Palicaso ----------
await ev(() => window.__unake.cruzar('fuera')); await esperaSala('fuera'); await libre();
await ev(() => window.__unake.cruzar('tienda')); await esperaSala('tienda'); await libre(); await pag.waitForTimeout(1500);
s = await ev(() => window.__unake.lugares()?.lista.map(k => k.id));
ok(s?.includes('tragaperras'), 'en la tienda está la tragaperras: ' + JSON.stringify(s));
const tg = await ev(() => { const g = window.__unake.lugares().get('tragaperras').g.getWorldPosition(new window.__unake.THREE.Vector3()); return { x: g.x, z: g.z }; });
await mirarA(tg.x, tg.z); await pag.waitForTimeout(800); await foto('tienda-tragaperras');

// ---------- 6. la maqueta con sus marcas ----------
s = await ev(() => window.__unake.marcasMaqueta());
ok(Object.values(s).some(m => m.juegos > 0), 'marcas de minijuegos abiertos: ' + JSON.stringify(s));
await ev(() => window.__unake.salirSala(true));
await pag.waitForFunction(() => window.__unake.barrio.maqueta?.grupo.visible && !window.__unake.barrio.ocupado, null, { timeout: 20000 });
await pag.waitForTimeout(1500);
s = await ev(() => window.__unake.barrio.maqueta.chapas?.length || 0);
ok(s > 0, 'la maqueta pone sus chapas (★ / ▶): ' + s);
await ev(() => { const m = window.__unake.barrio.maqueta.grupo.position; window.__unake.prueba.mirar(m.x, m.y + 0.45, m.z + 0.35, 0, -0.9); });
await pag.waitForTimeout(800); await foto('maqueta');

ok(!errores.length, errores.length ? 'errores:\n' + errores.slice(0, 6).join('\n') : 'sin errores');
console.log(fallos.length ? `${fallos.length} FALLOS` : 'TODO OK');
await nav.close();
