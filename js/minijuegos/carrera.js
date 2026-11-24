// Las carreras de humo (la pizarra de la plaza) en VR nativo, a escala de mesa.
// Reglas del 2D (base/js/apuestas.js): cinco corredores al azar de seis, cada uno con su fuerza de hoy y su cuota
// (x0,9 / probabilidad, mínimo x1,3); eliges corredor y ficha (10, 25, 50, 100, 250); el ganador se sortea con
// las probabilidades de las cuotas y la carrera se anima para llegar a él, con tirones, frenazos y el truco de
// cada uno. Si gana el tuyo, cobras apuesta × cuota. Sin panel final en el 2D: «Otra carrera» o te vas.
// Aquí: la pizarra delante de ti, a mano (tocas la ficha del corredor, la ficha de monchis y «¡Salida!»); la
// carrera ocurre en una pista en miniatura sobre tu mesa (o flotando a la altura de una mesa si no hay), con los
// corredores dejando su estela de humo. Mientras corren, agita el puño para animar al tuyo (solo da ánimos: el
// resultado ya está echado, como en el 2D).
import * as THREE from 'three';
import { Jugo, unaMalla } from './jugo.js';
import { monedero } from './tragaperras.js';

const FICHAS = [10, 25, 50, 100, 250];
const CORREDORES = [
  { id: 'vuper', nombre: 'Vuper', sprite: 'vuper-colocado', truco: 'se para a mirar el cielo' },
  { id: 'palicaso', nombre: 'Palicaso', sprite: 'palicaso-contando', truco: 'se para a contar algo' },
  { id: 'lasslow', nombre: 'Lasslow', sprite: 'lasslow-pedo', truco: '¡turbo de pedo!' },
  { id: 'pompa', nombre: 'La Pompa', sprite: 'pompa', truco: 'se la lleva el viento' },
  { id: 'puky', nombre: 'Puky', sprite: 'puky-riendo', truco: 'resbala en su charco' },
  { id: 'cotine', nombre: 'Cotine', sprite: 'cotine', truco: 'se para a por una miga' },
];
const GRITOS = ['¡Corre!', '¡Vamos, {n}!', '¡Que te pillan!', '¡Esa es mía!', '¡Venga, {n}, venga!'];
const TINTA = '#140c1c';
const COL = { pizarra: '#2f6b3f', pizarraOsc: '#245533', tiza: '#fff6e8', amarillo: '#ffd628', rosa: '#ff5fa2', morado: '#3b2a52', moradoOsc: '#2a1d3d', cian: '#5fd3ff', madera: '#a9774a' };

// pista (metros, local: +X hacia tu derecha = sentido de la carrera, +Z hacia ti)
const PISTA = { largo: 0.72, fondo: 0.34, alto: 0.02 };
const SALIDA = -0.28, META = 0.27;
const zCarril = i => -0.12 + i * 0.06;
const ALTO_CORREDOR = 0.1;
// pizarra (lienzo 1024 × 640 → 0,48 × 0,30 m)
const PIZ = { w: 0.48, h: 0.30, cw: 1024, ch: 640 };
const CARTA = i => ({ x: 22 + i * 198, y: 92, w: 184, h: 262 });
const CHIP = i => ({ x: 82 + i * 112, y: 432, r: 44 });
const SALIDA_BTN = { x: 612, y: 388, w: 388, h: 90 };
const PLANTO_BTN = { x: 760, y: 566, w: 240, h: 62 };
const N_LLUVIA = 40;

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; };
function ajustarLetra(g, texto, px, ancho) {
  g.font = `${px}px Caprasimo, serif`;
  while (g.measureText(texto).width > ancho && px > 12) { px -= 2; g.font = `${px}px Caprasimo, serif`; }
  return px;
}
const dentroRect = (p, r, holgura = 0) => p.x >= r.x - holgura && p.x <= r.x + r.w + holgura && p.y >= r.y - holgura && p.y <= r.y + r.h + holgura;
function baraja(lista) { let mazo = []; return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); }; }

export default {
  clave: 'Carrera', titulo: 'Las carreras de humo', escala: 'mesa',
  // sin ficha de misión en el 2D: las estrellas son lo que le sacas a la pizarra
  umbrales: [50, 250, 1000],
  sitioTarjetas: { d: 0.4, bajo: 0.12 },
  ayudas: { gatillo: 'Tocar la pizarra', lateral: 'Agita el puño: ¡ánimo!', mano: { pellizco: 'Toca con el dedo', puno: 'Agita el puño para animar' } },

  async crear(ctx) {
    const { ui, sonido, xr, humo } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-carrera';
    const fx = new Jugo(ctx, grupo);
    const bolsa = monedero(ctx);
    const basic = o => new THREE.MeshBasicMaterial(o);
    const grito = baraja(GRITOS);

    // ---------- estado (todo se reinicia aquí) ----------
    const E = { fase: 'intro', mio: 0, apuesta: 25, apostado: 0, cobrado: 0, carreras: 0, animos: 0, resultados: [], forzar: null, aviso: '', avisoColor: COL.tiza };
    let reloj = 0, acabado = false, carriles = [], ganador = null, t0 = 0, cuenta = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // ---------- dónde ----------
    const cab = xr.cabeza.clone();
    const fwd = xr.adelante.clone().setY(0); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    const der = V(-fwd.z, 0, fwd.x);
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    const pista = new THREE.Group(); grupo.add(pista);
    {
      const mesa = ctx.mesa?.();
      let p = null;
      if (mesa?.punto) {
        const d = mesa.punto.clone().sub(cab).setY(0), dist = d.length();
        if (dist > 0.35 && dist < 1.1 && d.normalize().dot(fwd) > 0.5 && cab.y - mesa.punto.y > 0.25) p = mesa.punto.clone().add(V(0, 0.002, 0));
      }
      if (!p) { p = cab.clone().addScaledVector(fwd, 0.62); p.y = cab.y - 0.5; }
      pista.position.copy(p); pista.rotation.y = yaw;
    }
    const pizarra = new THREE.Group(); grupo.add(pizarra);
    const pizBase = cab.clone().addScaledVector(fwd, 0.36); pizBase.y = cab.y - 0.33;
    pizarra.position.copy(pizBase);
    pizarra.lookAt(cab);
    grupo.updateMatrixWorld(true);
    let bajada = 0; // 0 = a mano; 1 = bajada para ver la carrera

    // ---------- la pista (UNA malla: caja con la tapa pintada) ----------
    const texPista = lienzo(1024, 512);
    {
      const { g } = texPista;
      g.fillStyle = COL.moradoOsc; g.fillRect(0, 0, 1024, 512);
      const x0 = (SALIDA + PISTA.largo / 2) / PISTA.largo * 1024, x1 = (META + PISTA.largo / 2) / PISTA.largo * 1024;
      for (let i = 0; i < 5; i++) {
        const y = ((zCarril(i) - 0.03) + PISTA.fondo / 2) / PISTA.fondo * 512, h = 0.06 / PISTA.fondo * 512;
        g.fillStyle = i % 2 ? '#3a2a52' : '#47335f'; g.fillRect(20, y, 984, h);
        g.strokeStyle = 'rgba(255,246,232,.5)'; g.lineWidth = 3; g.setLineDash([18, 14]); g.beginPath(); g.moveTo(20, y); g.lineTo(1004, y); g.stroke(); g.setLineDash([]);
        g.font = '40px Caprasimo, serif'; g.fillStyle = 'rgba(255,246,232,.75)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${i + 1}`, 42, y + h / 2);
      }
      g.fillStyle = COL.tiza; g.fillRect(x0 - 3, 30, 6, 452);
      for (let k = 0; k < 18; k++) for (let j = 0; j < 2; j++) { g.fillStyle = (k + j) % 2 ? TINTA : COL.tiza; g.fillRect(x1 + j * 13, 30 + k * 25.1, 13, 25.1); }
      g.strokeStyle = TINTA; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 498);
    }
    {
      const mats = Array.from({ length: 6 }, (_, i) => basic(i === 2 ? { map: texPista.t } : { color: i === 3 ? TINTA : COL.morado }));
      const box = new THREE.BoxGeometry(PISTA.largo, PISTA.alto, PISTA.fondo); box.translate(0, PISTA.alto / 2, 0);
      const { geo, mat } = unaMalla(box, mats);
      pista.add(new THREE.Mesh(geo, mat));
      box.dispose();
    }

    // ---------- imágenes ----------
    const imgs = {};
    await Promise.all(CORREDORES.map(c => ctx.img(`${c.sprite}.png`).then(t => { imgs[c.id] = t; }).catch(() => { })));
    let bandera = null;
    try {
      const t = await ctx.img('obj-bandera-meta.png');
      const h = 0.13, w = h * t.image.width / t.image.height;
      const g = new THREE.PlaneGeometry(w, h); g.translate(w * 0.35, h / 2, 0);
      bandera = new THREE.Mesh(g, basic({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
      bandera.position.set(META + 0.02, PISTA.alto, -PISTA.fondo / 2 - 0.005); pista.add(bandera);
    } catch { /* sin bandera */ }

    // ---------- la pizarra (UNA malla, UN lienzo) ----------
    const piz = lienzo(PIZ.cw, PIZ.ch);
    const pizMesh = new THREE.Mesh(new THREE.PlaneGeometry(PIZ.w, PIZ.h), basic({ map: piz.t }));
    pizarra.add(pizMesh);
    function pintarPizarra() {
      const { g, t } = piz;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.fillStyle = COL.madera; g.fillRect(0, 0, PIZ.cw, PIZ.ch);
      g.fillStyle = COL.pizarra; g.fillRect(12, 12, PIZ.cw - 24, PIZ.ch - 24);
      g.strokeStyle = TINTA; g.lineWidth = 8; g.strokeRect(4, 4, PIZ.cw - 8, PIZ.ch - 8); g.strokeRect(12, 12, PIZ.cw - 24, PIZ.ch - 24);
      g.font = '50px Caprasimo, serif'; g.fillStyle = COL.amarillo; g.fillText('Carreras de humo', 512, 52);
      const enJuego = E.fase === 'elegir';
      carriles.forEach((c, i) => {
        const r = CARTA(i), mio = i === E.mio, gana = ganador === c && (E.fase === 'meta' || E.fase === 'fin');
        g.fillStyle = mio ? '#fff2b0' : COL.tiza; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 18); g.fill();
        g.lineWidth = mio ? 10 : 5; g.strokeStyle = mio ? COL.amarillo : TINTA; g.stroke();
        if (mio) { g.lineWidth = 3; g.strokeStyle = TINTA; g.beginPath(); g.roundRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 22); g.stroke(); }
        const im = imgs[c.id]?.image;
        if (im) { const e = Math.min(150 / im.height, 160 / im.width), w = im.width * e, h = im.height * e; g.drawImage(im, r.x + r.w / 2 - w / 2, r.y + 88 - h / 2, w, h); }
        g.fillStyle = 'rgba(20,12,28,.65)'; g.font = '26px Caprasimo, serif'; g.textAlign = 'left'; g.fillText(`${i + 1}`, r.x + 10, r.y + 22); g.textAlign = 'center';
        ajustarLetra(g, c.nombre, 34, r.w - 16); g.fillStyle = TINTA; g.fillText(c.nombre, r.x + r.w / 2, r.y + 190);
        g.font = '46px Caprasimo, serif'; g.lineWidth = 8; g.strokeStyle = TINTA; g.strokeText(`x${c.cuota.toFixed(1)}`, r.x + r.w / 2, r.y + 236);
        g.fillStyle = COL.amarillo; g.fillText(`x${c.cuota.toFixed(1)}`, r.x + r.w / 2, r.y + 236);
        if (gana) { g.fillStyle = COL.rosa; g.beginPath(); g.roundRect(r.x + 20, r.y - 22, r.w - 40, 40, 14); g.fill(); g.font = '28px Caprasimo, serif'; g.fillStyle = COL.tiza; g.fillText('¡GANA!', r.x + r.w / 2, r.y - 2); }
        else if (mio) { g.fillStyle = COL.amarillo; g.beginPath(); g.roundRect(r.x + 40, r.y - 20, r.w - 80, 36, 12); g.fill(); g.font = '24px Caprasimo, serif'; g.fillStyle = TINTA; g.fillText('el tuyo', r.x + r.w / 2, r.y - 2); }
      });
      // fichas de monchis
      FICHAS.forEach((v, i) => {
        const c = CHIP(i), sel = v === E.apuesta, puede = bolsa.n >= v;
        g.globalAlpha = puede ? 1 : 0.35;
        g.fillStyle = TINTA; g.beginPath(); g.arc(c.x + 3, c.y + 5, c.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = sel ? COL.amarillo : COL.tiza; g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.fill();
        g.lineWidth = sel ? 8 : 5; g.strokeStyle = TINTA; g.stroke();
        ajustarLetra(g, `${v}`, 36, 70); g.fillStyle = TINTA; g.fillText(`${v}`, c.x, c.y + 2);
        g.globalAlpha = 1;
      });
      // ¡Salida! / Otra carrera
      const b = SALIDA_BTN, txt = E.fase === 'fin' ? 'Otra carrera' : enJuego ? '¡Salida!' : E.fase === 'cuenta' ? 'Preparados…' : 'Corriendo…';
      const activo = enJuego || E.fase === 'fin';
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(b.x + 5, b.y + 8, b.w, b.h, 26); g.fill();
      g.fillStyle = activo ? COL.amarillo : '#8a7f99'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 26); g.fill();
      g.lineWidth = 6; g.strokeStyle = TINTA; g.stroke();
      ajustarLetra(g, txt, 52, b.w - 30); g.fillStyle = TINTA; g.fillText(txt, b.x + b.w / 2, b.y + b.h / 2 + 2);
      // la línea de abajo
      const c = carriles[E.mio];
      const linea = E.aviso || (c ? `Vas con ${c.nombre} (x${c.cuota.toFixed(1)}). Si gana: +${Math.round(E.apuesta * c.cuota)} monchis.` : '');
      ajustarLetra(g, linea, 34, 960); g.fillStyle = E.aviso ? E.avisoColor : COL.tiza; g.fillText(linea, 512, 520);
      g.font = '32px Caprasimo, serif'; g.textAlign = 'left'; g.fillStyle = COL.tiza; g.fillText(`Tienes ${bolsa.n} monchis`, 40, 598); g.textAlign = 'center';
      const p = PLANTO_BTN;
      g.fillStyle = enJuego || E.fase === 'fin' ? COL.rosa : '#8a7f99'; g.beginPath(); g.roundRect(p.x, p.y, p.w, p.h, 20); g.fill();
      g.lineWidth = 5; g.strokeStyle = TINTA; g.stroke();
      g.font = '34px Caprasimo, serif'; g.fillStyle = COL.tiza; g.lineWidth = 6; g.strokeText('Me planto', p.x + p.w / 2, p.y + p.h / 2 + 2); g.fillText('Me planto', p.x + p.w / 2, p.y + p.h / 2 + 2);
      t.needsUpdate = true;
    }
    const avisar = (txt, color = COL.tiza, s = 2.6) => { E.aviso = txt; E.avisoColor = color; pintarPizarra(); luego(s, () => { if (E.aviso === txt) { E.aviso = ''; pintarPizarra(); } }); };
    // punto del lienzo → mundo (para la mano fantasma y el bot)
    const lienzoAMundo = (px, py, z = 0) => pizarra.localToWorld(V((px / PIZ.cw - 0.5) * PIZ.w, (0.5 - py / PIZ.ch) * PIZ.h, z));

    // ---------- corredores (una malla cada uno) ----------
    const geos = [];
    function nuevosCorredores() {
      for (const c of carriles) { pista.remove(c.m); c.m.material.dispose(); }
      const elegidos = CORREDORES.slice().sort(() => Math.random() - 0.5).slice(0, 5);
      const fuerzas = elegidos.map(() => 0.6 + Math.random() * 2.4);
      const total = fuerzas.reduce((a, b) => a + b, 0);
      carriles = elegidos.map((c, i) => {
        const p = fuerzas[i] / total;
        const cuota = Math.max(1.3, Math.round((0.9 / p) * 10) / 10);
        const t = imgs[c.id];
        const asp = t ? t.image.width / t.image.height : 1;
        const h = ALTO_CORREDOR, w = Math.min(0.11, h * asp);
        const g = new THREE.PlaneGeometry(w, w / asp); g.translate(0, w / asp / 2, 0); geos.push(g);
        const m = new THREE.Mesh(g, basic({ map: t || null, color: t ? '#ffffff' : COL.rosa, alphaTest: 0.5, side: THREE.DoubleSide }));
        m.position.set(SALIDA - 0.02, PISTA.alto, zCarril(i)); pista.add(m);
        return { ...c, i, p, cuota, m, prog: 0, salto: 0, avisado: false, llego: false, tHumo: Math.random() * 0.05 };
      });
    }

    // ---------- textos que saltan y lluvia de monchis ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.3, dur = 1.8) {
      const { g, t } = lienzo(512, 160);
      ajustarLetra(g, texto, 78, 470);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.lineJoin = 'round'; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), basic({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0, dur });
    }
    const lluvia = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.0025, 12), basic({ color: COL.amarillo }), N_LLUVIA);
    lluvia.count = 0; lluvia.frustumCulled = false; pista.add(lluvia);
    const monedas = [];
    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(1, 1, 1);
    function soltarMonedas(n, x) {
      for (let i = 0; i < Math.min(N_LLUVIA, n); i++) {
        monedas.push({ p: V(x + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.1, (Math.random() - 0.5) * 0.28), v: V(0, -Math.random() * 0.3, 0), r: V(Math.random() * 6, 0, Math.random() * 6), w: V((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20), t: -i * 0.025, vida: 3.5 + Math.random() });
      }
      while (monedas.length > N_LLUVIA) monedas.shift();
    }
    function moverMonedas(dt) {
      let n = 0;
      for (let k = monedas.length - 1; k >= 0; k--) {
        const c = monedas[k]; c.t += dt;
        if (c.t < 0) continue;
        if (c.t > c.vida) { monedas.splice(k, 1); continue; }
        c.v.y -= 6 * dt; c.p.addScaledVector(c.v, dt);
        if (c.p.y < PISTA.alto + 0.002) {
          c.p.y = PISTA.alto + 0.002;
          if (c.v.y < -0.4) { c.v.y *= -0.35; if (Math.random() < 0.2) sonido('lata', { en: pista, volumen: 0.1, tono: 2 + Math.random() * 0.5 }); }
          else { c.v.set(0, 0, 0); c.w.multiplyScalar(0); c.r.x = c.r.z = 0; }
        } else c.r.addScaledVector(c.w, dt);
        _s.setScalar(Math.max(0.001, Math.min(1, (c.vida - c.t) / 0.4)));
        _m4.compose(c.p, _q.setFromEuler(_e.set(c.r.x, c.r.y, c.r.z)), _s);
        lluvia.setMatrixAt(n++, _m4);
      }
      lluvia.count = n; lluvia.instanceMatrix.needsUpdate = true;
    }
    const sobrePista = (x = 0, y = 0.14) => pista.localToWorld(V(x, y, 0));

    // ---------- la partida ----------
    function elegir(i) {
      if (E.fase !== 'elegir' || !carriles[i]) return;
      E.mio = i; E.aviso = '';
      sonido('pop', { en: pizarra, volumen: 0.4, tono: 1.1 });
      const c = carriles[i]; c.salto = 0.25;
      pintarPizarra();
    }
    function apostar(v) {
      if (E.fase !== 'elegir') return;
      if (bolsa.n < v) { avisar(`Te faltan ${v - bolsa.n} monchis para esa ficha.`, COL.rosa); sonido('bonk', { en: pizarra, volumen: 0.35 }); return; }
      E.apuesta = v; E.aviso = '';
      sonido('pop', { en: pizarra, volumen: 0.4, tono: 0.9 + FICHAS.indexOf(v) * 0.08 });
      pintarPizarra();
    }
    function salida() {
      if (E.fase === 'fin') return otraCarrera();
      if (E.fase !== 'elegir') return;
      if (bolsa.n < E.apuesta || bolsa.n < FICHAS[0]) {
        avisar('Sin monchis no hay carrera. Gánalos en las misiones.', COL.rosa, 3);
        sonido('bonk', { en: pizarra, volumen: 0.4 });
        if (bolsa.n < FICHAS[0]) luego(3, () => final('pobre'));
        return;
      }
      if (!bolsa.apostar(E.apuesta)) return avisar('Sin monchis no hay carrera. Gánalos en las misiones.', COL.rosa);
      E.fase = 'cuenta'; E.apostado += E.apuesta; E.carreras++;
      E.enJuego = E.apuesta;
      ui.instruccion(null);
      // el ganador se sortea con las probabilidades de las cuotas; la carrera se anima para llegar a él
      if (E.forzar !== null) { ganador = carriles[E.forzar]; E.forzar = null; }
      else { let r = Math.random(); ganador = carriles.find(c => (r -= c.p) < 0) || carriles[0]; }
      const base = 4.2;
      for (const c of carriles) {
        c.dura = c === ganador ? base : base + 0.25 + Math.random() * 1.35;
        const pasos = [0];
        for (let k = 0; k < 8; k++) pasos.push(pasos[k] + 0.2 + Math.random() * 1.6);
        c.curva = pasos.map(v => v / pasos[8]);
        c.momento = 1 + Math.floor(Math.random() * 6);
        c.avisado = false; c.llego = false; c.prog = 0;
      }
      pintarPizarra();
      cuenta = 3; t0 = reloj + 3;
      const marca = () => {
        const txt = cuenta ? `${cuenta}` : '¡YA!';
        saltaTexto(txt, cuenta ? COL.amarillo : COL.rosa, sobrePista(0, 0.16), cuenta ? 0.16 : 0.24, 0.9);
        sonido(cuenta ? 'pop' : 'bocina', { volumen: cuenta ? 0.5 : 0.35, tono: cuenta ? 1 : 1.2 });
        if (!cuenta) { E.fase = 'corriendo'; pintarPizarra(); return; }
        cuenta--; luego(1, marca);
      };
      luego(0.05, marca);
      if (E.carreras === 1) luego(3.4, () => ui.instruccion('¡Agita el puño para animar al tuyo!'));
    }
    function meta() {
      E.fase = 'meta';
      ui.instruccion(null);
      const mio = carriles[E.mio], gana = ganador === mio;
      const cobro = gana ? Math.round(E.enJuego * mio.cuota) : 0;
      bolsa.cobrar(cobro, { juego: 'carrera', apostado: E.enJuego, gana, cuota: mio.cuota, batacazo: gana && mio.cuota >= 5 });
      E.cobrado += cobro;
      E.resultados.push({ apuesta: E.enJuego, mio: mio.id, ganador: ganador.id, cuota: mio.cuota, cobro });
      ganador.salto = 0.5;
      const p = ganador.m.getWorldPosition(V()).add(V(0, 0.06, 0));
      if (gana) {
        saltaTexto(`¡Gana ${ganador.nombre}! +${cobro}`, COL.amarillo, sobrePista(0, 0.2), 0.42, 2.6);
        soltarMonedas(Math.min(N_LLUVIA, Math.round(mio.cuota * 6)), META - 0.05);
        sonido('platillo', { volumen: 0.5 });
        fx.acierto(p, { mano: xr.manos.derecha, color: COL.amarillo, n: 26, fuerte: mio.cuota >= 5, sonido: 'campanita' });
        xr.manos.izquierda?.vibrar?.(0.6, 90);
      } else {
        saltaTexto(`Gana ${ganador.nombre}. Tu ${mio.nombre}, ni olerlo.`, COL.rosa, sobrePista(0, 0.2), 0.5, 2.6);
        sonido('rimshot', { volumen: 0.4 });
        fx.chispas(p, COL.tiza, 10, 0.5);
      }
      pintarPizarra();
      luego(1.8, () => {
        if (acabado) return;
        E.fase = 'fin'; pintarPizarra();
        if (bolsa.n < FICHAS[0]) { avisar('Sin monchis no hay carrera. Gánalos en las misiones.', COL.rosa, 3); luego(3, () => final('pobre')); }
      });
    }
    function otraCarrera() {
      if (E.fase !== 'fin') return;
      nuevosCorredores(); ganador = null;
      E.fase = 'elegir'; E.mio = Math.min(E.mio, carriles.length - 1); E.aviso = '';
      if (bolsa.n < E.apuesta) E.apuesta = [...FICHAS].reverse().find(v => v <= bolsa.n) || FICHAS[0];
      sonido('whoosh', { volumen: 0.35 });
      pintarPizarra();
    }
    // los ánimos (puño agitado): el tuyo da un salto y suelta humo; el resultado no cambia
    let tAnimo = 0;
    function animar(mano) {
      if (E.fase !== 'corriendo' || reloj < tAnimo) return;
      tAnimo = reloj + 0.55; E.animos++;
      const c = carriles[E.mio]; c.salto = 0.3;
      const p = c.m.getWorldPosition(V()).add(V(0, 0.09, 0));
      saltaTexto(grito().replace('{n}', c.nombre), COL.tiza, p, 0.16, 1.1);
      fx.chispas(p, COL.cian, 8, 0.4);
      mano?.vibrar?.(0.4, 40);
      sonido('aaah', { volumen: 0.18, tono: 1.3 + Math.random() * 0.3 });
    }
    function final(como = 'planto') {
      if (acabado) return;
      acabado = true; E.fase = 'fin-partida'; ui.instruccion(null);
      const neto = E.cobrado - E.apostado, gana = neto > 0;
      const linea = !E.carreras ? 'Ni una carrera. La pizarra sigue esperando.'
        : gana ? `Le sacas ${neto} monchis a las carreras.`
          : neto < 0 ? (como === 'pobre' ? 'Sin monchis no hay carrera. Gánalos en las misiones.' : `Las carreras se quedan ${-neto} monchis.`)
            : 'Ni ganas ni pierdes.';
      sonido(gana ? 'oooh' : 'rimshot', { volumen: 0.45 });
      luego(1.2, () => ctx.terminar({ puntos: Math.max(0, neto), gana, linea }));
    }

    // ---------- tocar la pizarra ----------
    const tocaba = new Map();
    function mirarPizarra() {
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!m?.activa) { tocaba.delete(m); continue; }
        const l = pizarra.worldToLocal(m.punta.clone());
        const px = (l.x / PIZ.w + 0.5) * PIZ.cw, py = (0.5 - l.y / PIZ.h) * PIZ.ch;
        const toca = l.z > -0.03 && l.z < 0.025 && px > -20 && px < PIZ.cw + 20 && py > -20 && py < PIZ.ch + 20;
        if (toca && !tocaba.get(m) && bajada < 0.2 && !acabado) {
          const p = { x: px, y: py };
          let hecho = true;
          const carta = carriles.findIndex((_, i) => dentroRect(p, CARTA(i), 6));
          const chip = FICHAS.findIndex((_, i) => { const c = CHIP(i); return Math.hypot(p.x - c.x, p.y - c.y) < c.r + 12; });
          if (carta >= 0) elegir(carta);
          else if (chip >= 0) apostar(FICHAS[chip]);
          else if (dentroRect(p, SALIDA_BTN, 8)) salida();
          else if (dentroRect(p, PLANTO_BTN, 8)) { if (E.fase === 'elegir' || E.fase === 'fin') final('planto'); }
          else hecho = false;
          m.vibrar?.(hecho ? 0.5 : 0.15, hecho ? 35 : 15);
          if (!hecho) sonido('toc-toc', { en: pizarra, volumen: 0.15, tono: 1.6 });
        }
        tocaba.set(m, toca);
        // ánimos: el puño (o la mano) agitado rápido durante la carrera
        if (E.fase === 'corriendo' && m.vel && m.vel.length() > 1.4) animar(m);
      }
    }

    // ---------- arranque ----------
    nuevosCorredores();
    if (bolsa.n < E.apuesta) E.apuesta = [...FICHAS].reverse().find(v => v <= bolsa.n) || FICHAS[0];
    E.fase = 'elegir';
    pintarPizarra();
    ctx.musica?.('apuestas');
    if (bolsa.n < FICHAS[0]) { avisar('Sin monchis no hay carrera. Gánalos en las misiones.', COL.rosa, 3); luego(3.2, () => final('pobre')); }
    else {
      E.aviso = 'Elige corredor y apuesta. Si gana el tuyo, cobras apuesta × cuota.'; pintarPizarra();
      luego(4, () => { if (E.aviso.startsWith('Elige')) { E.aviso = ''; pintarPizarra(); } });
      ui.instruccion('Toca la ficha de tu corredor y luego «¡Salida!»');
      // la mano fantasma: toca una carta, una ficha y la salida
      const r = CARTA(1), c = CHIP(1), b = SALIDA_BTN;
      const pasos = [[r.x + r.w / 2, r.y + r.h / 2], [c.x, c.y], [b.x + b.w / 2, b.y + b.h / 2]].flatMap(([x, y]) => [{ p: lienzoAMundo(x, y, 0.06) }, { p: lienzoAMundo(x, y, 0.01), pinza: true }, { p: lienzoAMundo(x, y, 0.06) }]);
      fx.demo(pasos, { dur: 3.2, tramo: 0.32, flecha: false, retraso: 0.6 });
    }

    const api = {
      E, bolsa, get fase() { return E.fase; }, get carriles() { return carriles; }, get ganador() { return ganador; },
      forzar: i => { E.forzar = i; },
      // puntos del lienzo en el mundo (z = separación delante de la pizarra)
      carta: (i, z = 0) => { const r = CARTA(i); return lienzoAMundo(r.x + r.w / 2, r.y + r.h / 2, z); },
      chip: (i, z = 0) => { const c = CHIP(i); return lienzoAMundo(c.x, c.y, z); },
      salida: (z = 0) => lienzoAMundo(SALIDA_BTN.x + SALIDA_BTN.w / 2, SALIDA_BTN.y + SALIDA_BTN.h / 2, z),
      planto: (z = 0) => lienzoAMundo(PLANTO_BTN.x + PLANTO_BTN.w / 2, PLANTO_BTN.y + PLANTO_BTN.h / 2, z),
      pista: () => pista.position.clone(),
      get bajada() { return bajada; },
    };
    grupo.userData.api = api;

    const _haciaMi = V();
    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        // la pizarra baja mientras corren (para ver la pista) y vuelve a mano después
        const quiere = E.fase === 'cuenta' || E.fase === 'corriendo' || E.fase === 'meta' ? 1 : 0;
        bajada += (quiere - bajada) * Math.min(1, dt * 5);
        pizarra.position.copy(pizBase).addScaledVector(fwd, -0.04 * bajada); pizarra.position.y -= 0.27 * bajada;
        mirarPizarra();
        // corredores
        const ahora = reloj - t0;
        for (const c of carriles) {
          if (E.fase === 'corriendo' || E.fase === 'meta') {
            if (ahora >= 0) {
              const f = Math.min(1, ahora / c.dura);
              const tramo = Math.min(7.999, f * 8), k = Math.floor(tramo);
              c.prog = c.curva[k] + (c.curva[k + 1] - c.curva[k]) * (tramo - k);
              if (k === c.momento && !c.avisado) {
                c.avisado = true;
                saltaTexto(c.truco, COL.tiza, c.m.getWorldPosition(V()).add(V(0, 0.1, 0)), 0.2, 1.4);
                if (c.id === 'lasslow') { sonido('pedo-silencioso', { en: c.m, volumen: 0.4 }); humo.soltar({ pos: c.m.getWorldPosition(V()).add(V(0, 0.03, 0)), vel: V(0, 0.1, 0), tam: 0.04, vida: 1.2, crece: 0.05, sube: 0.04, frena: 2, brillo: 0.6, alfa: 0.7 }); }
                else sonido('fup', { en: c.m, volumen: 0.25, tono: 1.2 });
              }
              if (f >= 1 && !c.llego) { c.llego = true; if (c === ganador && E.fase === 'corriendo') meta(); }
              // estela de humo
              c.tHumo -= dt;
              if (c.tHumo <= 0 && f < 1) {
                c.tHumo = 0.07;
                const p = c.m.getWorldPosition(V()).add(V(0, 0.015, 0)).addScaledVector(der, -0.015);
                humo.soltar({ pos: p, vel: der.clone().multiplyScalar(-0.04).add(V(0, 0.04, 0)), tam: 0.012, vida: 0.9, crece: 0.025, sube: 0.02, frena: 1, brillo: 0.8, alfa: 0.55 });
              }
            }
          } else if (E.fase === 'elegir' || E.fase === 'cuenta') c.prog = 0;
          c.salto = Math.max(0, c.salto - dt);
          const corre = (E.fase === 'corriendo' || E.fase === 'meta') && !c.llego && ahora >= 0;
          const bote = corre ? Math.abs(Math.sin(reloj * 14 + c.i)) * 0.008 : 0;
          const hop = c.salto > 0 ? Math.sin(c.salto / 0.3 * Math.PI) * 0.03 : 0;
          c.m.position.set(SALIDA - 0.02 + c.prog * (META - SALIDA + 0.02), PISTA.alto + bote + hop, zCarril(c.i));
          // de cara a ti (como un recortable), ladeándose al correr
          _haciaMi.copy(cab).sub(c.m.getWorldPosition(V()));
          c.m.rotation.set(0, Math.atan2(_haciaMi.x, _haciaMi.z) - yaw, corre ? Math.sin(reloj * 11 + c.i) * 0.12 : 0, 'YXZ');
          c.m.scale.setScalar(c === carriles[E.mio] && E.fase === 'elegir' ? 1.15 + 0.05 * Math.sin(reloj * 5) : 1);
        }
        if (bandera) bandera.rotation.y = Math.sin(reloj * 3) * 0.15;
        moverMonedas(dt);
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.04; s.m.lookAt(xr.cabeza);
          s.m.scale.setScalar(Math.min(1, s.t * 6));
          s.m.material.opacity = Math.min(1, 3 * (s.dur - s.t));
          if (s.t > s.dur) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      // salir a mitad: si la carrera ya ha salido, se resuelve (el ganador ya estaba echado)
      abandonar() {
        if (acabado) return;
        if (E.fase === 'cuenta' || E.fase === 'corriendo') meta();
        acabado = true; E.fase = 'fin-partida'; ui.instruccion(null);
        const neto = E.cobrado - E.apostado;
        ctx.terminar({ puntos: Math.max(0, neto), gana: false, linea: neto >= 0 ? `Te vas con ${neto} monchis de más.` : `Te vas con ${-neto} monchis de menos.` });
      },
      destruir() {
        if (!acabado && (E.fase === 'cuenta' || E.fase === 'corriendo')) meta();
        acabado = true; tareas.length = 0;
        fx.destruir();
        ui.instruccion(null);
        for (const c of carriles) c.m.material.dispose();
        geos.forEach(g => g.dispose());
        for (const t of [piz.t, texPista.t]) t.dispose();
        lluvia.geometry.dispose(); pizMesh.geometry.dispose();
      },
    };
  },
};
