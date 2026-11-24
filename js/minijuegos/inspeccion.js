// La inspección · VR nativo (escala «sala», se juega de pie o sentado). Reglas y textos de base/js/escenas/inspeccion.js.
//
// El casero recorre Unaké de noche. Escondite inglés: delante tienes la barra con las pruebas encima y, a tu derecha,
// el cajón abierto. Al fondo, el casero de espaldas. Cuando NO mira, quita de en medio lo que no debe ver:
//   CENICERO, MECHERO, ZAPATILLA, DADOS → cógelos (pellizco/puño; gatillo/lateral) y llévalos al cajón.
//   CHARCO DE PUKY                      → frótalo con la mano (de lado a lado) hasta que se seque.
//   NUBE DE LASSLOW                     → abanícala con la mano hasta deshacerla.
// La llave tintinea («¡clinc!») justo antes de girarse: es el aviso. Si se gira y te pilla con algo en la mano (o
// frotando, o abanicando), sospecha. Tres sospechas y se acabó la aso. Cada vez se gira antes y aparecen más cosas.
// Puntos como el 2D: +100 por cosa escondida; al final, −50 por cada una que se quede a la vista. Ganas si aguantas
// los 50 s con el primer umbral. El 2D no se endurece con el nivel (MISIONES.Inspeccion.escala): aquí, desde el
// nivel 2, el casero se gira un poco antes (sin bajar nunca del aviso mínimo que da tiempo a soltar con la mano).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Bocadillo } from '../bocadillo.js';
import { Jugo } from './jugo.js';
import { lienzo, azar, bolsa, clamp, V, TINTA } from './furgo_cabina.js';

const DURACION = 50;
// las del 2D; `gesto` es lo que hay que hacer con cada una en VR. Aspecto = ancho/alto del PNG.
const PRUEBAS = [
  { clave: 'colilla', nombre: 'cenicero', gesto: 'cajon', ancho: 0.13, asp: 191 / 93 },
  { clave: 'fx-charco-amarillo', nombre: 'charco de Puky', gesto: 'limpiar', ancho: 0.2, asp: 320 / 252 },
  { clave: 'fx-nube-pedo', nombre: 'nube de Lasslow', gesto: 'abanicar', ancho: 0.22, asp: 320 / 269 },
  { clave: 'obj-mechero-grande', nombre: 'mechero', gesto: 'cajon', alto: 0.12, asp: 116 / 320 },
  { clave: 'obj-zapatilla', nombre: 'zapatilla de alguien', gesto: 'cajon', ancho: 0.17, asp: 320 / 209 },
  { clave: 'obj-dado', nombre: 'dados de Palicaso', gesto: 'cajon', ancho: 0.1, asp: 320 / 212 },
];
// huecos de la barra (x, z locales: −z = hacia delante); todos a menos de ~0,6 m de tus ojos
const HUECOS = [[-0.4, -0.33], [-0.2, -0.3], [0.0, -0.32], [-0.32, -0.51], [-0.11, -0.52], [0.1, -0.5], [0.3, -0.5]];
const PILLADO = ['¿Qué escondes ahí?', 'Ajá. Ya veo.', '¿Y eso de quién es?', 'Interesante. Muy interesante.'];
const CASERO_W = 1.62 * 245 / 520, CASERO_H = 1.62;
const GEO = new THREE.PlaneGeometry(1, 1);

// piezas de caja → UNA malla con color por vértice (las caras de lado, más oscuras)
function bloque(piezas) {
  const geos = piezas.map(([w, h, d, x, y, z, c]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.translate(x, y, z);
    const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3), nr = g.attributes.normal;
    for (let i = 0; i < n; i++) { const k = nr.getY(i) > 0.5 ? 1 : nr.getZ(i) > 0.5 ? 0.8 : 0.62; a[i * 3] = col.r * k; a[i * 3 + 1] = col.g * k; a[i * 3 + 2] = col.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  });
  const geo = mergeGeometries(geos); geos.forEach(g => g.dispose());
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

export default {
  clave: 'Inspeccion', titulo: 'La inspección', escala: 'sala', umbrales: [500, 1100, 1800],
  sitioTarjetas: { d: 0.4, bajo: 0.1 },
  ayudas: { gatillo: 'Coger y al cajón', lateral: 'Coger y al cajón', mano: { pellizco: 'Coger y al cajón', puno: 'Coger, frotar, abanicar' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-inspeccion';
    const nivel = clamp(ctx.nivel ?? 1, 1, 6);
    const fx = new Jugo(ctx, grupo);
    // ---------- banderas de partida: TODAS aquí ----------
    const est = {
      fase: 'intro', t: 0, puntos: 0, vidas: 3, restante: DURACION, mira: false, casero: 'espera', proxima: 3,
      agarrada: null, activo: false, lado: 1, ladoAct: 1, acabado: false, escondidas: 0, racha: 0, girando: 0, gracia: -9, ruido: 0,
      pruebas: [], saliendo: [], demos: new Set(), pendDemo: null, instrFuera: false,
    };
    const eventos = []; const programar = (s, fn) => eventos.push({ t: est.t + s, fn });
    const sacaTipo = bolsa(PRUEBAS);

    // ---------- dónde: delante de ti, a tu altura (de pie o sentado) ----------
    const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const raiz = new THREE.Group(); raiz.position.set(xr.cabeza.x, 0, xr.cabeza.z); raiz.rotation.y = Math.atan2(-f.x, -f.z);
    grupo.add(raiz); grupo.updateMatrixWorld(true);
    const OJ = xr.cabeza.y, H = clamp(OJ - 0.45, 0.62, 1.08);
    const L = (x, y, z) => new THREE.Vector3(x, y, z);
    const aMundo = v => raiz.localToWorld(v.clone());
    const aLocal = v => raiz.worldToLocal(v.clone());

    // ---------- la barra y el cajón (una malla) ----------
    const madera = '#7a4a2e', oscura = '#4e2f1f', cajonC = '#9a6a44';
    const CAJ = L(0.34, H - 0.13, -0.15); // centro del cajón abierto (sale hacia ti, a tu derecha)
    const barra = bloque([
      [1.12, 0.045, 0.42, 0, H - 0.0225, -0.43, madera],     // tablero
      [1.12, 0.2, 0.03, 0, H - 0.145, -0.235, oscura],       // faldón delantero
      [0.06, H - 0.245, 0.06, -0.52, (H - 0.245) / 2, -0.28, oscura], [0.06, H - 0.245, 0.06, 0.52, (H - 0.245) / 2, -0.28, oscura],
      [0.06, H - 0.045, 0.06, -0.52, (H - 0.045) / 2, -0.6, oscura], [0.06, H - 0.045, 0.06, 0.52, (H - 0.045) / 2, -0.6, oscura],
      // el cajón sacado: fondo, laterales, frente (con tirador) y trasera
      [0.26, 0.012, 0.2, CAJ.x, CAJ.y - 0.05, CAJ.z, oscura],
      [0.012, 0.1, 0.2, CAJ.x - 0.13, CAJ.y, CAJ.z, cajonC], [0.012, 0.1, 0.2, CAJ.x + 0.13, CAJ.y, CAJ.z, cajonC],
      [0.27, 0.11, 0.014, CAJ.x, CAJ.y, CAJ.z + 0.1, cajonC], [0.27, 0.1, 0.012, CAJ.x, CAJ.y, CAJ.z - 0.1, cajonC],
      [0.07, 0.016, 0.02, CAJ.x, CAJ.y + 0.01, CAJ.z + 0.115, '#d8b25a'],
    ]);
    raiz.add(barra);
    const cajonMundo = () => aMundo(CAJ);

    // ---------- texturas ----------
    const texs = {};
    const [texCasero, texMira] = await Promise.all([ctx.img('casero.png'), ctx.img('casero-mira.png'),
      ...PRUEBAS.map(async p => { texs[p.clave] = await ctx.img(p.clave + '.png'); })]);

    // ---------- el casero, al fondo ----------
    // de frente, su dibujo; de espaldas, el cartón de detrás (como los recortables). Al girarse se «da la vuelta».
    const casero = new THREE.Group(); raiz.add(casero);
    const caseroFrente = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ map: texCasero, alphaTest: 0.5, side: THREE.DoubleSide }));
    const caseroCarton = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ map: texCasero, color: '#8a6440', alphaTest: 0.5, side: THREE.DoubleSide }));
    caseroCarton.material.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
    caseroCarton.material.customProgramCacheKey = () => 'silueta-casero';
    caseroCarton.scale.x = -1; caseroCarton.visible = false;
    casero.add(caseroFrente, caseroCarton);
    const CASERO_POS = L(0.05, CASERO_H / 2, -2.1);
    casero.position.copy(CASERO_POS); casero.scale.set(CASERO_W, CASERO_H, 1);
    const bocC = new Bocadillo(); const anclaC = new THREE.Group(); anclaC.add(bocC.malla); raiz.add(anclaC);
    anclaC.position.set(CASERO_POS.x - 0.1, CASERO_H + 0.12, CASERO_POS.z + 0.05);
    const caseroDice = (txt, dur = 1.8, color) => bocC.mostrar(txt, dur, { color });
    function ponerCasero(modo) {
      est.casero = modo;
      est.lado = modo === 'mira' || modo === 'fin' ? 1 : -1;
      caseroFrente.material.map = modo === 'espera' ? texCasero : texMira; caseroFrente.material.needsUpdate = true;
      caseroCarton.material.color.set(modo === 'aviso' ? '#b98d5e' : '#8a6440');
      pintarPanel();
    }

    // ---------- el marcador (sospecha, tiempo, puntos y qué hace el casero), a tu izquierda ----------
    const panL = lienzo(640, 200); const propias = [panL.t];
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.106), new THREE.MeshBasicMaterial({ map: panL.t, transparent: true }));
    panel.position.set(-0.44, H + 0.2, -0.56); raiz.add(panel); panel.renderOrder = 8;
    let panAntes = '';
    function pintarPanel() {
      const s = Math.max(0, Math.ceil(est.restante)), clave = `${s}|${est.puntos}|${est.vidas}|${est.casero}`;
      if (clave === panAntes) return; panAntes = clave;
      const { g, t } = panL; g.clearRect(0, 0, 640, 200);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
      g.textBaseline = 'middle'; g.font = '36px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.textAlign = 'left'; g.fillText('Sospecha', 24, 48);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(214 + i * 44, 48, 15, 0, 7); g.fillStyle = i < 3 - est.vidas ? '#ff3b30' : '#7ee081'; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke(); }
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText(`${est.puntos} puntos`, 616, 48);
      g.textAlign = 'left'; g.fillStyle = '#fff3e6'; g.fillText(`${s} s`, 24, 146);
      const [txt, col] = { espaldas: ['(de espaldas)', '#7ee081'], aviso: ['¡clinc!', '#ffd23f'], mira: ['MIRA', '#ff5fa2'], fin: ['Apunta en su libreta', '#fff3e6'] }[est.casero] || ['El casero', '#fff3e6'];
      g.textAlign = 'right'; g.font = (est.casero === 'mira' ? '54px' : '40px') + ' Caprasimo, serif'; g.fillStyle = col; g.fillText(txt, 616, 146);
      t.needsUpdate = true;
    }

    // ---------- etiqueta flotante (+100, ¡te ha visto!) ----------
    const etL = lienzo(512, 128); propias.push(etL.t);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshBasicMaterial({ map: etL.t, transparent: true, depthTest: false }));
    etiqueta.renderOrder = 30; etiqueta.visible = false; grupo.add(etiqueta);
    let etVida = 0;
    function decirEtiqueta(txt, color, pos) {
      const { g, t } = etL; g.clearRect(0, 0, 512, 128);
      g.font = '50px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = TINTA; g.strokeText(txt, 256, 64, 490); g.fillStyle = color; g.fillText(txt, 256, 64, 490);
      t.needsUpdate = true; etiqueta.position.copy(pos); etiqueta.visible = true; etVida = 1.1;
    }

    // ---------- el anillo de progreso (frotar / abanicar) ----------
    const ANILLOS = Array.from({ length: 21 }, (_, i) => new THREE.RingGeometry(0.05, 0.064, 28, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.001, i / 20)));
    const anillo = new THREE.Mesh(ANILLOS[0], new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide, depthTest: false, transparent: true }));
    anillo.renderOrder = 12; anillo.visible = false; grupo.add(anillo);

    // ---------- las pruebas ----------
    const manos = () => [xr.manos.derecha, xr.manos.izquierda].filter(m => m.activa);
    const R = m => (m.esMano ? 0.11 : 0.09);
    const maxPruebas = 6;
    function nuevaPrueba() {
      if (!est.activo) return;
      const libres = HUECOS.filter(h => !est.pruebas.some(p => p.hueco === h));
      if (!libres.length || est.pruebas.length >= maxPruebas) return;
      const hueco = azar(libres), tipo = sacaTipo();
      const w = tipo.ancho ?? tipo.alto * tipo.asp, h = tipo.alto ?? tipo.ancho / tipo.asp;
      const m = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ map: texs[tipo.clave], transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false }));
      m.renderOrder = 5;
      const sitio = tipo.gesto === 'limpiar' ? L(hueco[0], H + 0.004, hueco[1]) : tipo.gesto === 'abanicar' ? L(hueco[0], H + 0.17, hueco[1]) : L(hueco[0], H + h / 2 + 0.004, hueco[1]);
      if (tipo.gesto === 'limpiar') m.rotation.x = -Math.PI / 2;
      m.position.copy(sitio); m.scale.set(0.01, 0.01, 1); raiz.add(m);
      const p = { tipo, m, hueco, sitio, w, h, prog: 0, aparece: 0, activoHasta: -1, mano: null, fase: Math.random() * 6 };
      est.pruebas.push(p);
      sonido('plop', { volumen: 0.25, tono: 0.9 + Math.random() * 0.2 });
      quiereDemo(p);
    }
    const mundoDe = p => p.m.getWorldPosition(V());

    // la primera vez de cada gesto, la mano fantasma lo enseña
    function quiereDemo(p) {
      if (est.demos.has(p.tipo.gesto)) return;
      if (fx.demos.length) { est.pendDemo = est.pendDemo || p; return; }
      est.demos.add(p.tipo.gesto);
      const w = mundoDe(p), lado = aMundo(L(0.08, 0, 0)).sub(aMundo(L(0, 0, 0)));
      const reposo = aMundo(L(0.12, H + 0.14, -0.14));
      let pasos;
      if (p.tipo.gesto === 'cajon') { const c = cajonMundo(); pasos = [{ p: reposo }, { p: w }, { p: w, pinza: true }, { p: c.clone().add(V().set(0, 0.06, 0)), pinza: true }, { p: c }]; }
      else if (p.tipo.gesto === 'limpiar') { const a = w.clone().add(V().set(0, 0.03, 0)); pasos = [{ p: a.clone().sub(lado) }, { p: a.clone().add(lado) }, { p: a.clone().sub(lado) }, { p: a.clone().add(lado) }, { p: a.clone().sub(lado) }]; }
      else { const l2 = lado.clone().multiplyScalar(1.6); pasos = [{ p: w.clone().sub(l2) }, { p: w.clone().add(l2) }, { p: w.clone().sub(l2) }, { p: w.clone().add(l2) }]; }
      fx.demo(pasos, { dur: 2.8, tramo: p.tipo.gesto === 'cajon' ? 0.5 : 0.32, retraso: 0.2 });
    }

    function cogerPrueba(p, m) {
      if (est.mira) { pillado(p); return; }
      p.mano = m; est.agarrada = p; m.vibrar(0.5, 40); sonido('pop', { volumen: 0.2 });
    }
    function soltarPrueba(p) { if (!p) return; p.mano = null; if (est.agarrada === p) est.agarrada = null; }
    function actuar(p, inc, m) {
      if (!est.activo) return;
      if (est.mira) { pillado(p); return; }
      p.prog += inc; p.activoHasta = est.t + 0.3;
      if ((est.ruido -= inc) <= 0) { est.ruido = 0.22; sonido(p.tipo.gesto === 'limpiar' ? 'chapoteo' : 'fiu', { volumen: 0.18, tono: 0.9 + p.prog * 0.3 }); m.vibrar(0.25, 25); }
      if (p.prog >= 1) esconder(p, m);
    }
    const actuando = () => est.agarrada || est.pruebas.find(p => p.activoHasta > est.t);

    function esconder(p, m) {
      const i = est.pruebas.indexOf(p); if (i < 0) return;
      est.pruebas.splice(i, 1);
      soltarPrueba(p);
      p.sale = 0; p.desde = p.m.position.clone(); est.saliendo.push(p);
      est.puntos += 100; est.escondidas++; est.racha++;
      const w = mundoDe(p);
      fx.acierto(w, { mano: m, color: '#7ee081', racha: est.racha, sonido: 'pop' });
      decirEtiqueta(`+100 · ${p.tipo.nombre}`, '#7ee081', w.add(V().set(0, 0.1, 0)));
      if (!est.instrFuera) { est.instrFuera = true; ui.instruccion(null); }
      pintarPanel();
    }

    function pillado(p) {
      if (est.t < est.gracia || !est.activo) return;
      est.gracia = est.t + 1.3;
      const q = p || actuando();
      if (q) { soltarPrueba(q); q.prog = 0; q.activoHasta = -1; }
      est.vidas--; est.racha = 0;
      sonido('oooh', { volumen: 0.5 });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(1, 160);
      caseroDice(azar(PILLADO), 1.6, '#ffd0d6');
      if (q) { const w = mundoDe(q); fx.chispas(w, '#ff3b30', 16, 0.7); decirEtiqueta('¡Te ha visto!', '#ff5fa2', w.add(V().set(0, 0.12, 0))); }
      pintarPanel();
      if (est.vidas <= 0) final(false);
    }

    // ---------- el casero: de espaldas → aviso → mira ----------
    const prisa = () => 1 - est.restante / DURACION;
    const kNivel = Math.max(0.72, 1 - 0.07 * (nivel - 1));
    const entre = (a, b) => a + Math.random() * (b - a);
    function espaldas() {
      if (!est.activo) return;
      est.mira = false; ponerCasero('espaldas');
      programar(entre(1.4, 2.8) * (1 - prisa() * 0.4) * kNivel, aviso);
    }
    function aviso() {
      if (!est.activo) return;
      ponerCasero('aviso'); est.girando = 0.32;
      sonido('campanita', { volumen: 0.5, tono: 1.25 });
      // el 2D da 0,52 s; con la mano de verdad hace falta un poco más para soltar (nunca menos de 0,42 s)
      programar(Math.max(0.42, (0.66 - prisa() * 0.2) * kNivel), mirar);
    }
    function mirar() {
      if (!est.activo) return;
      est.mira = true; ponerCasero('mira');
      sonido('whoosh', { volumen: 0.4 });
      if (actuando()) pillado(actuando());
      programar(entre(1.0, 2.0), espaldas);
    }

    // ---------- el final ----------
    function final(aguanto) {
      if (est.acabado) return;
      est.acabado = true; est.activo = false; est.fase = 'fin';
      soltarPrueba(est.agarrada);
      ui.instruccion(null);
      const vistas = est.pruebas.length;
      est.puntos = Math.max(0, est.puntos - vistas * 50);
      const gana = aguanto && est.puntos >= 500;
      ponerCasero('fin');
      for (const p of est.pruebas) fx.chispas(mundoDe(p), '#ff5fa2', 6, 0.4);
      if (gana) { caseroDice('Todo en orden… creo.', 2.4); sonido('platillo', { volumen: 0.4 }); }
      else { caseroDice('Mm. Lo apunto.', 2.4, '#ffd0d6'); sonido('sting', { volumen: 0.4 }); }
      const linea = gana ? `Inspección superada. Se le quedaron a la vista ${vistas} cosas.` : 'El casero ha visto demasiado. Apunta algo en su libreta. Y luego otra cosa. Y otra.';
      programar(1.6, () => ctx.terminar({ puntos: est.puntos, gana, linea }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('sigilo');
    ponerCasero('espera'); est.lado = est.ladoAct = 1;
    programar(0.6, () => caseroDice('Buenas noches. Vengo a ver la aso. Por dentro.', 2.4));
    programar(3.0, () => {
      est.activo = true; est.fase = 'juego';
      ui.instruccion('Cuando NO mire, esconde lo que no debe ver');
      for (let i = 0; i < 3; i++) nuevaPrueba();
      espaldas();
    });

    // para el bot (herramientas/pruebas/bots/inspeccion.js)
    const api = {
      get fase() { return est.fase; }, get casero() { return est.casero; }, get mira() { return est.mira; }, get puntos() { return est.puntos; },
      get vidas() { return est.vidas; }, get restante() { return est.restante; }, get escondidas() { return est.escondidas; },
      pruebas: () => est.pruebas.filter(p => p.aparece >= 1).map(p => ({ gesto: p.tipo.gesto, nombre: p.tipo.nombre, pos: mundoDe(p), prog: p.prog, lleva: !!p.mano })),
      cajon: () => cajonMundo(), lado: () => aMundo(L(1, 0, 0)).sub(aMundo(L(0, 0, 0))),
      reposo: () => aMundo(L(0.14, H + 0.16, -0.1)), mano: () => aMundo(L(-0.14, H + 0.16, -0.1)),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.inspeccion = api;

    const _v = V();
    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        if (est.activo) {
          est.restante -= dt;
          est.proxima -= dt;
          if (est.proxima <= 0) { est.proxima = Math.max(1.5, 3.4 - (DURACION - est.restante) / 20); nuevaPrueba(); }
          if (est.restante <= 0) { est.restante = 0; final(true); }
        }
        if (est.pendDemo && !fx.demos.length) { const p = est.pendDemo; est.pendDemo = null; if (est.pruebas.includes(p)) quiereDemo(p); }
        // el casero: tiembla con el tintineo de la llave
        est.girando = Math.max(0, est.girando - dt);
        casero.rotation.z = est.girando > 0 ? Math.sin(est.t * 70) * 0.05 : 0;
        // darse la vuelta: se estrecha hasta el canto y sale por el otro lado (0,16 s)
        est.ladoAct += clamp(est.lado - est.ladoAct, -dt * 12, dt * 12);
        casero.scale.x = CASERO_W * Math.max(0.04, Math.abs(est.ladoAct));
        caseroFrente.visible = est.ladoAct >= 0; caseroCarton.visible = est.ladoAct < 0;
        casero.position.y = CASERO_POS.y + Math.abs(Math.sin(est.t * 1.6)) * 0.01;
        // las pruebas
        let activa = null;
        for (const p of [...est.pruebas]) {
          if (p.aparece < 1) { p.aparece = Math.min(1, p.aparece + dt / 0.26); }
          const a = p.aparece, k = a < 1 ? 1 + 2.7 * Math.pow(a - 1, 3) + 1.7 * Math.pow(a - 1, 2) : 1; // Back.out
          const g = p.tipo.gesto;
          if (g === 'cajon') {
            p.m.scale.set(p.w * k, p.h * k, 1);
            p.m.lookAt(_v.copy(xr.cabeza).setY(p.m.getWorldPosition(V()).y));
            if (p.mano) {
              const m = p.mano;
              p.m.position.copy(aLocal(m.pos));
              if (!m.activa || !(m.pinza || m.agarre)) soltarPrueba(p);
              else if (m.pos.distanceTo(cajonMundo()) < 0.15) { m.vibrar(0.7, 60); esconder(p, m); continue; }
            } else {
              p.m.position.lerp(p.sitio, Math.min(1, dt * 10));
              if (est.activo && !est.agarrada && a >= 1) {
                const w = mundoDe(p);
                for (const m of manos()) if ((m.empiezaPinza || m.empiezaAgarre) && m.pos.distanceTo(w) < R(m) + p.w * 0.25) { cogerPrueba(p, m); break; }
              }
            }
          } else if (g === 'limpiar') {
            const s = 1 - p.prog * 0.45;
            p.m.scale.set(p.w * k * s, p.h * k * s, 1); p.m.material.opacity = 1 - p.prog * 0.6;
            if (a >= 1) {
              const w = mundoDe(p);
              for (const m of manos()) {
                const dh = Math.hypot(m.pos.x - w.x, m.pos.z - w.z), dv = m.pos.y - w.y, vel = Math.hypot(m.vel.x, m.vel.z);
                if (dh < p.w * 0.6 + 0.04 && dv > -0.05 && dv < 0.13 && vel > 0.12) { actuar(p, dt * clamp(vel / 0.45, 0.4, 1.6) / 0.9, m); activa = p; break; }
              }
            }
          } else {
            const s = 1 + p.prog * 0.5;
            p.m.scale.set(p.w * k * s, p.h * k * s, 1); p.m.material.opacity = 1 - p.prog * 0.7;
            p.m.position.y = p.sitio.y + Math.sin(est.t * 1.8 + p.fase) * 0.012;
            p.m.lookAt(xr.cabeza);
            if (a >= 1) {
              const w = mundoDe(p);
              for (const m of manos()) {
                if (m.pos.distanceTo(w) < 0.15 + p.w * 0.3 && m.vel.length() > 0.25) { actuar(p, dt * clamp(m.vel.length() / 0.6, 0.4, 1.6) / 0.8, m); activa = p; break; }
              }
            }
          }
        }
        // el anillo encima de lo que estás frotando o abanicando
        const conAnillo = activa || est.pruebas.find(p => p.activoHasta > est.t);
        if (conAnillo && conAnillo.prog > 0) {
          anillo.visible = true; anillo.geometry = ANILLOS[clamp(Math.round(conAnillo.prog * 20), 0, 20)];
          anillo.position.copy(mundoDe(conAnillo)).add(V().set(0, conAnillo.tipo.gesto === 'limpiar' ? 0.09 : 0.14, 0)); anillo.lookAt(xr.cabeza);
        } else anillo.visible = false;
        // lo escondido: al cajón (o se deshace)
        for (const p of [...est.saliendo]) {
          p.sale += dt / 0.3; const s = Math.max(0, 1 - p.sale);
          if (p.tipo.gesto === 'cajon') p.m.position.lerpVectors(p.desde, CAJ, Math.min(1, p.sale)); else p.m.rotation.z += dt * 9;
          p.m.scale.set(p.w * s + 0.001, p.h * s + 0.001, 1);
          if (p.sale >= 1) { est.saliendo.splice(est.saliendo.indexOf(p), 1); raiz.remove(p.m); p.m.material.dispose(); }
        }
        if (etVida > 0) { etVida -= dt; etiqueta.position.y += dt * 0.08; etiqueta.material.opacity = Math.min(1, etVida * 2.5); etiqueta.lookAt(xr.cabeza); if (etVida <= 0) etiqueta.visible = false; }
        panel.lookAt(xr.cabeza);
        bocC.actualizar(dt, 0, xr.cabeza, anclaC);
        pintarPanel();
        fx.actualizar(dt);
      },
      // salir a mitad: el casero se queda con lo que ha visto
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.activo = false; est.fase = 'fin';
        soltarPrueba(est.agarrada); ui.instruccion(null);
        ponerCasero('fin'); caseroDice('¿Ya se va? Mm.', 2);
        ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Te vas a mitad de la inspección. El casero lo apunta todo.' });
      },
      destruir() {
        eventos.length = 0; est.activo = false;
        ui.instruccion(null); ui.quitarTarjetas?.();
        fx.destruir();
        for (const p of [...est.pruebas, ...est.saliendo]) p.m.material.dispose();
        for (const t of propias) t.dispose();
        ANILLOS.forEach(g => g.dispose()); anillo.material.dispose();
        barra.geometry.dispose(); barra.material.dispose(); caseroFrente.material.dispose(); caseroCarton.material.dispose();
        panel.geometry.dispose(); panel.material.dispose(); etiqueta.geometry.dispose(); etiqueta.material.dispose();
        bocC.tex.dispose(); bocC.malla.geometry.dispose(); bocC.malla.material.dispose();
        if (typeof window !== 'undefined' && window.__mj?.inspeccion === api) window.__mj.inspeccion = null;
      },
    };
  },
};
