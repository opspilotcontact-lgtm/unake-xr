// Noche de barra (Palicaso) en VR nativo, inmersivo: estás detrás de la barra del bar del humo.
// Los de la aso se asoman al otro lado (cuatro sitios en arco), cada uno con su pedido en un bocadillo, una barrita
// de paciencia y la mano tendida encima de la barra. Coges lo que piden de los estantes que tienes a los lados
// (pellizco, puño, gatillo o botón lateral) y se lo llevas a la mano: lo cogen solos al llegar. Si Puky se sube a la
// barra, lo echas de un empujón (la velocidad de tu mano cuenta). Palicaso, a tu lado, no para de hablar.
// Reglas del 2D (base/js/escenas/barra.js): 60 s, tres vidas, propina según la paciencia que le quede, racha cada
// cuatro seguidos (x1,5, x2…), equivocarse resta 2 a la racha, Puky echado +60; nivel 3+: Lasslow se tira uno y la
// nube tapa un pedido; nivel 5+: menos paciencia. En VR servir cuesta más que pulsar una tecla, así que la gente
// llega algo menos deprisa y espera un poco más (ver PACIENCIA y LLEGADA).

import { Jugo, fusionar } from './jugo.js';

const DURACION = 60;
const TINTA = '#140c1c';
const PRODUCTOS = [
  { nombre: 'resucitador', img: 'lata.png', caja: '#b8432f', ang: -92 },
  { nombre: 'patatas', img: 'patatas.png', caja: '#d99a2b', ang: -70 },
  { nombre: 'caramelo', img: 'caramelo.png', caja: '#c74f8a', ang: 70 },
  { nombre: 'lo de la aso', img: null, caja: '#4f8a4a', ang: 92 },
];
const CLIENTES = ['lasslow', 'cotine', 'perico', 'la-pompa', 'blancaso', 'vuper'];
const ANG_SITIOS = [-45, -15, 15, 45];
const R_ENTREGA = 0.6, R_CLIENTE = 1.2, R_ESTANTE = 0.42, R_PUKY = 0.66;
const ALTO_CLIENTE = 0.32;                         // cuánto asoman por encima de la barra
const PACIENCIA = (pasado, nivel) => Math.max(5, 10 - pasado / 12) * (nivel >= 5 ? 0.85 : 1);
const PACIENCIA_PUKY = 4.2;
const LLEGADA = pasado => Math.max(1.1, 2.6 - pasado / 30) + Math.random() * 0.6;

function baraja(lista) {
  let mazo = [];
  return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); };
}

export default {
  clave: 'Barra', titulo: 'Noche de barra', escala: 'inmersivo', umbrales: [1500, 3000, 4500],
  ayudas: { gatillo: 'Coger del estante', lateral: 'Coger del estante', mano: { pellizco: 'Coger y llevárselo', puno: 'Coger · empujar a Puky' } },
  sitioTarjetas: { d: 0.45, bajo: 0.12 },

  async crear(ctx) {
    const { THREE, xr, ui, sonido } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-barra';
    const nivel = ctx.nivel ?? 1;
    const fx = new Jugo(ctx, grupo);
    const texturas = [];

    // ---------- estado (todo se reinicia aquí) ----------
    const E = { fase: 'intro', puntos: 0, vidas: 3, servidos: 0, combo: 0, restante: DURACION, echados: 0, fallos: 0, perdidos: 0, resultados: [] };
    let pukyLibreEn = 0;
    let reloj = 0, acabado = false, proximo = 1, tNube = 6, avisoNube = false, avisoPuky = false, sucio = true, tPintar = 0, vozLibre = 0;
    const tareas = [], anims = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });
    const animar = (dur, fn, fin) => anims.push({ t: 0, dur, fn, fin });

    // ---------- dónde: la barra delante de ti, a la altura de tu cintura (de pie o sentado) ----------
    const cab0 = xr.cabeza.clone();
    let fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const base = new THREE.Group(); base.name = 'barra-base';
    base.position.set(cab0.x, cab0.y - 0.42, cab0.z);
    base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); base.updateMatrixWorld(true);
    const W = (v, out = V()) => out.copy(v).applyMatrix4(base.matrixWorld);
    const dirA = g => { const a = g * Math.PI / 180; return V(Math.sin(a), 0, -Math.cos(a)); };
    const enA = (g, r, y) => dirA(g).multiplyScalar(r).setY(y);
    const yawHaciaMi = p => Math.atan2(-p.x, -p.z);

    // ---------- ayudantes de dibujo ----------
    const mb = o => new THREE.MeshBasicMaterial(o);
    const MAT_TINTA = mb({ color: TINTA, side: THREE.BackSide });
    const lienzo = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texturas.push(t);
      return { c, g: c.getContext('2d'), t };
    };
    const caja = (w, h, d, color, e = 0.005) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mb({ color }));
      if (!e) return m;
      const t = new THREE.Mesh(m.geometry, MAT_TINTA);
      t.scale.set(1 + 2 * e / w, 1 + 2 * e / h, 1 + 2 * e / d); m.add(t);
      return m;
    };

    // ---------- la barra: cuatro tramos en arco, posavasos y la contrabarra con los estantes ----------
    const decorado = new THREE.Group(); base.add(decorado);
    for (const g of ANG_SITIOS) {
      const tramo = new THREE.Group(); tramo.rotation.y = -g * Math.PI / 180; decorado.add(tramo);
      const cuerpo = caja(0.56, 1.2, 0.42, '#4a2a1a', 0); cuerpo.position.set(0, -0.62, -0.71); tramo.add(cuerpo);
      const tapa = caja(0.6, 0.04, 0.46, '#7a4a2c', 0); tapa.position.set(0, -0.02, -0.71); tramo.add(tapa);
      const canto = caja(0.5, 0.06, 0.02, '#5a3420', 0); canto.position.set(0, -0.035, -0.47); tramo.add(canto);
      const pv = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), mb({ color: '#f3e6c8' }));
      pv.rotation.x = -Math.PI / 2; pv.position.set(0, 0.002, -R_ENTREGA); tramo.add(pv);
    }
    for (const lado of [-1, 1]) {
      const cb = new THREE.Group(); cb.rotation.y = -lado * 81 * Math.PI / 180; decorado.add(cb);
      const mueble = caja(0.36, 1.0, 0.2, '#3e2416'); mueble.position.set(0, -0.58, -R_ESTANTE); cb.add(mueble);
      const balda = caja(0.4, 0.025, 0.24, '#7a4a2c'); balda.position.set(0, -0.07, -R_ESTANTE); cb.add(balda);
    }

    // ---------- los productos: un atlas con los cuatro (una sola llamada para todos los del estante) ----------
    const atlas = lienzo(512, 128);
    const imgs = await Promise.all(PRODUCTOS.map(p => p.img ? ctx.img(p.img).catch(() => null) : null));
    function pintarBolsita(g, x0) {
      g.save(); g.translate(x0 + 22, 14);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(0, 0, 84, 100, 14); g.fill();
      g.fillStyle = '#dff3ff'; g.beginPath(); g.roundRect(7, 7, 70, 86, 10); g.fill();
      g.fillStyle = '#6fbf4a'; for (const [x, y, r] of [[24, 66, 13], [46, 72, 14], [58, 56, 11], [32, 50, 10], [50, 42, 9]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.fillStyle = '#ff5fa2'; g.fillRect(7, 14, 70, 9);
      g.restore();
    }
    PRODUCTOS.forEach((p, i) => {
      const g = atlas.g, x0 = i * 128, im = imgs[i]?.image;
      if (im?.width) {
        const k = 112 / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
        g.drawImage(im, x0 + (128 - w) / 2, (128 - h) / 2, w, h);
      } else if (i === 3) pintarBolsita(g, x0);
      else { g.fillStyle = p.caja; g.beginPath(); g.arc(x0 + 64, 64, 48, 0, 7); g.fill(); }
    });
    atlas.t.needsUpdate = true;
    const matProd = mb({ map: atlas.t, alphaTest: 0.5, side: THREE.DoubleSide });
    const geoProd = PRODUCTOS.map((_, i) => {
      const geo = new THREE.PlaneGeometry(0.11, 0.11), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 4);
      return geo;
    });
    const estantes = PRODUCTOS.map((p, i) => {
      const pos = enA(p.ang, R_ESTANTE, -0.03);
      const cj = caja(0.13, 0.06, 0.11, p.caja, 0.004); cj.position.copy(pos); cj.rotation.y = yawHaciaMi(pos); decorado.add(cj);
      // tres en fila, como en un estante de verdad (el de delante es el que coges)
      for (const [dx, dz, dy] of [[-0.035, -0.03, 0.06], [0.035, -0.03, 0.06], [0, 0.015, 0.055]]) {
        const s = new THREE.Mesh(geoProd[i], matProd);
        s.position.copy(pos).add(V(dx, dy, dz).applyAxisAngle(V(0, 1, 0), yawHaciaMi(pos))); s.rotation.y = yawHaciaMi(pos);
        decorado.add(s);
      }
      return { i, local: pos.clone().setY(0.03) };
    });
    const ahorro = fusionar(decorado);

    // ---------- marcador: una pizarra colgada encima de la barra ----------
    const piz = lienzo(512, 200);
    const pizarra = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.18), mb({ map: piz.t }));
    pizarra.position.set(0, 0.8, -1.25); base.add(pizarra); pizarra.lookAt(cab0);
    function pintarPizarra() {
      const { g, t } = piz;
      g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, 512, 200);
      g.fillStyle = '#23302a'; g.fillRect(12, 12, 488, 176);
      g.textBaseline = 'middle'; g.font = '30px Caprasimo, serif'; g.textAlign = 'left';
      const s = Math.ceil(Math.max(0, E.restante));
      g.fillStyle = s <= 10 && E.fase === 'juego' ? '#ff6f7f' : '#f3ecd8'; g.font = '64px Caprasimo, serif'; g.fillText(`${s} s`, 30, 74);
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText(String(E.puntos), 482, 74);
      g.font = '30px Caprasimo, serif'; g.fillStyle = '#9fe3a8';
      const mult = 1 + Math.floor(E.combo / 4) * 0.5;
      g.fillText(E.combo >= 4 ? `Racha x${String(mult).replace('.', ',')}` : `servidos ${E.servidos}`, 482, 150);
      g.textAlign = 'left';
      for (let i = 0; i < 3; i++) {
        const x = 46 + i * 52, y = 150, r = 20;
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.closePath(); g.fillStyle = i < E.vidas ? '#ffd23f' : '#3d3350'; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke();
      }
      t.needsUpdate = true; sucio = false;
    }

    // ---------- textos que saltan (+80, ¡Racha!) ----------
    const saltos = [];
    function saltaTexto(texto, color, posMundo, tam = 0.12) {
      const ancho = texto.length > 12 ? 1024 : 512, { g, t } = lienzo(ancho, 160);
      let px = 84; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > ancho - 40 && px > 40) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText(texto, ancho / 2, 84); g.fillStyle = color; g.fillText(texto, ancho / 2, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam * ancho / 512, tam * 160 / 512), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(posMundo); grupo.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- la gente: recortables (sin canto ni sombra: detrás de la barra no se ven y ahorran) ----------
    const prep = r => { r.canto1.visible = r.canto2.visible = false; r.enAsiento = true; r.sombra.visible = false; r.grupo.visible = false; return r; };
    const cargar = (id, op) => ctx.Recortable.crear(id, 'humo', op).then(prep).catch(e => { console.warn('barra: sin ' + id, e); return null; });
    const [palicaso, puky, ...gente] = await Promise.all([cargar('palicaso'), cargar('puky', { escala: 0.5 }), ...CLIENTES.map(id => cargar(id, { escala: 0.85 }))]);
    const pool = gente.map((r, i) => r && { id: CLIENTES[i], r, libre: true }).filter(Boolean);
    for (const p of pool) base.add(p.r.grupo);
    if (puky) base.add(puky.grupo);
    if (palicaso) {
      const pp = enA(-118, 0.95, 0); palicaso.grupo.position.copy(pp); palicaso.grupo.rotation.y = yawHaciaMi(pp);
      palicaso.grupo.position.y = 0.5 - (palicaso.alto ?? 1.05); palicaso.grupo.visible = true; base.add(palicaso.grupo);
    }
    const decir = (t, prob = 1) => { if (!palicaso || Math.random() > prob || reloj < vozLibre) return; vozLibre = reloj + 2.4; palicaso.decir(t); };
    const frasePalicaso = baraja(['Eso, eso. Como yo te enseñé.', 'Una vez serví a cuarenta. Bueno, a cuatro.', 'El secreto está en la muñeca. Y en hablar.', '¿Ves? Yo hablo y tú sirves. Equipo.', 'Esto en mis tiempos se hacía con una mano. Y hablando.']);
    const poseDe = (r, lista) => lista.find(n => r.indice?.fotos?.[n]) || 'base';

    // ---------- cada sitio: bocadillo con el pedido, barrita de paciencia y la mano tendida ----------
    const BW = 0.2, BH = 0.2 * 200 / 256;
    const geoBarrita = new THREE.PlaneGeometry(1, 1); geoBarrita.translate(0.5, 0, 0);
    const texMano = (() => {
      const { g, t } = lienzo(128, 128);
      g.lineJoin = 'round'; g.strokeStyle = TINTA; g.lineWidth = 7; g.fillStyle = '#fffaf0';
      const dedo = (x, y, w, h, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.roundRect(-w / 2, -h, w, h, w / 2); g.fill(); g.stroke(); g.restore(); };
      dedo(42, 70, 17, 44, -0.25); dedo(58, 64, 17, 52, -0.08); dedo(75, 64, 17, 50, 0.08); dedo(90, 70, 16, 40, 0.25); dedo(34, 92, 17, 34, -1.1);
      g.beginPath(); g.ellipse(64, 92, 32, 28, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(64, 90, 27, 22, 0, 0, 7); g.fill();
      return t;
    })();
    const manos = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), mb({ map: texMano, alphaTest: 0.5, side: THREE.DoubleSide }), ANG_SITIOS.length);
    manos.frustumCulled = false; base.add(manos);
    const texNube = await ctx.img('fx-nube-pedo.png').catch(() => null);
    const nube = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.24), mb({ map: texNube, transparent: true, opacity: 0, depthWrite: false, color: texNube ? '#ffffff' : '#9ccf7a' }));
    nube.visible = false; nube.renderOrder = 30; base.add(nube);
    let nubeEn = null, tNubeVida = 0;

    const sitios = ANG_SITIOS.map((g, i) => {
      const lz = lienzo(256, 200);
      const bocadillo = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), mb({ map: lz.t, alphaTest: 0.5 }));
      bocadillo.visible = false; base.add(bocadillo);
      const barrita = new THREE.Mesh(geoBarrita, mb({ color: '#7ee081' }));
      barrita.position.set(-BW / 2 + BW * 40 / 256, BH * (0.5 - 139 / 200), 0.002); barrita.scale.set(BW * 176 / 256, 0.012, 1);
      bocadillo.add(barrita);
      return {
        i, g, lz, bocadillo, barrita, cliente: null, manoK: 0,
        entrega: enA(g, R_ENTREGA, 0.08), cuerpo: enA(g, R_CLIENTE, 0), pukyEn: enA(g, R_PUKY, 0),
      };
    });
    function pintarBocadillo(s, pedido, puky) {
      const { g, t } = s.lz;
      g.clearRect(0, 0, 256, 200);
      g.lineWidth = 8; g.strokeStyle = TINTA; g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(8, 8, 240, 160, 34); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(112, 164); g.lineTo(128, 194); g.lineTo(146, 164); g.closePath(); g.fill(); g.stroke();
      g.fillRect(108, 156, 42, 10);
      if (puky) {
        g.fillStyle = '#e8364f'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '34px Caprasimo, serif'; g.fillText('¿Me', 128, 54); g.fillText('llamabais?', 128, 96);
      } else g.drawImage(atlas.c, pedido * 128, 0, 128, 128, 78, 18, 100, 100);
      g.fillStyle = '#3d3350'; g.beginPath(); g.roundRect(36, 126, 184, 28, 14); g.fill();
      t.needsUpdate = true;
    }

    // ---------- llegar, servir, echar e irse ----------
    function nuevoCliente() {
      const libres = sitios.filter(s => !s.cliente);
      if (!libres.length) return;
      const s = libres[Math.floor(Math.random() * libres.length)];
      const pasado = DURACION - E.restante;
      const hayPuky = sitios.some(x => x.cliente?.puky);
      const esPuky = !!puky && !hayPuky && reloj > pukyLibreEn && E.forzar !== 'cliente' && (E.forzar === 'puky' || Math.random() < Math.min(0.12 + pasado / 400, 0.25));
      E.forzar = null;
      let r, ficha = null;
      if (esPuky) r = puky;
      else {
        const libresP = pool.filter(p => p.libre);
        if (!libresP.length) return;
        ficha = libresP[Math.floor(Math.random() * libresP.length)]; ficha.libre = false; r = ficha.r;
      }
      const pedido = esPuky ? -1 : Math.floor(Math.random() * PRODUCTOS.length);
      const paciencia = esPuky ? PACIENCIA_PUKY : PACIENCIA(pasado, nivel);
      const c = { r, ficha, puky: esPuky, pedido, paciencia, t: paciencia, estado: 'llega', nube: 0 };
      s.cliente = c;
      // aparece: los de la aso suben por detrás de la barra; Puky trepa a ella
      const destino = esPuky ? s.pukyEn.clone() : s.cuerpo.clone().setY(ALTO_CLIENTE - (r.alto ?? 0.9));
      const desde = esPuky ? enA(s.g, 0.95, -0.4) : destino.clone().setY(destino.y - 0.7);
      r.grupo.position.copy(desde); r.grupo.rotation.y = yawHaciaMi(destino); r.grupo.visible = true;
      r.pose(esPuky ? poseDe(r, ['trepando', 'base']) : 'base', { rebote: 0 });
      c.destino = destino;
      animar(0.38, k => { const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); r.grupo.position.lerpVectors(desde, destino, e); }, () => {
        if (s.cliente !== c) return;
        c.estado = 'espera'; r.empujon(0.18);
        if (esPuky) r.pose('base');
      });
      pintarBocadillo(s, pedido, esPuky);
      s.bocadillo.position.copy(esPuky ? s.pukyEn.clone().setY(0.52) : s.cuerpo.clone().setY(ALTO_CLIENTE + 0.15));
      s.bocadillo.scale.setScalar(0.01); s.bocadillo.visible = true;
      animar(0.26, k => s.bocadillo.scale.setScalar(Math.max(0.01, 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2))));
      sonido(esPuky ? 'blurp' : 'pop', { volumen: 0.5, en: W(destino) });
      if (esPuky) {
        sonido('puky-gracioso', { volumen: 0.5 });
        if (!avisoPuky) {
          avisoPuky = true;
          ui.instruccion('¡Puky en la barra! Échalo de un empujón');
          luego(3.5, () => ui.instruccion(null));
          const p = W(s.pukyEn.clone().setY(0.2)), lat = W(enA(s.g + 25, R_PUKY, 0.2));
          fx.demo([{ p: lat }, { p, puno: true }, { p: p.clone().lerp(W(enA(s.g - 25, R_PUKY + 0.1, 0.3)), 1), puno: true }], { dur: 2, tramo: 0.35, flecha: true });
        }
      }
    }

    function irse(s, contento) {
      const c = s.cliente; if (!c) return;
      s.cliente = null; c.estado = 'vete';
      if (c.puky) pukyLibreEn = reloj + 1.3;
      s.bocadillo.visible = false;
      if (nubeEn === s) { nubeEn = null; nube.visible = false; }
      const r = c.r, desde = r.grupo.position.clone(), hasta = desde.clone().setY(desde.y - 0.8);
      luego(contento ? 0.35 : 0.6, () => animar(0.42, k => r.grupo.position.lerpVectors(desde, hasta, k * k), () => {
        if (c.ficha) c.ficha.libre = true;
        if (!sitios.some(x => x.cliente?.r === r)) { r.grupo.visible = false; r.callar(); }
      }));
    }

    const sumar = n => { E.puntos += n; sucio = true; };
    function servir(s, it, mano) {
      const c = s.cliente;
      c.estado = 'servido';
      E.combo++; E.servidos++;
      const mult = 1 + Math.floor(E.combo / 4) * 0.5;
      const pts = Math.round(Math.round(40 + 60 * (c.t / c.paciencia)) * mult);
      sumar(pts);
      const pe = W(s.entrega), pc = W(s.cuerpo.clone().setY(ALTO_CLIENTE - 0.12));
      fx.acierto(pe, { mano, racha: E.combo, fuerte: E.combo % 4 === 0 });
      sonido('zas', { volumen: 0.35 });
      saltaTexto(`+${pts}`, '#7ee081', pe.clone().add(V(0, 0.16, 0)));
      if (E.combo % 4 === 0) { saltaTexto(`¡Racha x${String(mult).replace('.', ',')}!`, '#ffd23f', pe.clone().add(V(0, 0.3, 0)), 0.14); sonido('platillo', { volumen: 0.4 }); decir(frasePalicaso()); }
      else decir(frasePalicaso(), 0.18);
      if (palicaso) { palicaso.pose(poseDe(palicaso, ['riendo', 'base'])); luego(0.5, () => palicaso.pose('base')); }
      c.r.pose(poseDe(c.r, ['riendo', 'risa-floja', 'emocionado', 'colocado']), { rebote: 0.25 });
      s.manoK = 1.6;
      // lo servido vuela a sus manos
      const desde = it.m.position.clone();
      animar(0.28, k => { it.m.position.lerpVectors(desde, pc, k); it.m.scale.setScalar(1 - k * 0.5); }, () => quitarItem(it));
      E.resultados.push({ ok: true, pts });
      irse(s, true);
    }

    function echar(s, mano) {
      const c = s.cliente;
      c.estado = 'echado'; s.cliente = null; s.bocadillo.visible = false; pukyLibreEn = reloj + 1;
      E.echados++; sumar(60);
      const p = W(c.r.grupo.position.clone().setY(0.18));
      sonido('zas', { volumen: 0.6 }); sonido('puky-triste', { volumen: 0.4 });
      fx.acierto(p, { mano, color: '#ff6fb5', fuerte: true, sonido: null });
      mano?.vibrar?.(1, 120);
      saltaTexto('¡FUERA!', '#ffd23f', p.clone().add(V(0, 0.18, 0)), 0.16);
      decir('¡Eso! ¡Y no vuelvas! Bueno, vuelve mañana.', 0.6);
      // sale volando por donde le has empujado
      const vel = mano ? mano.vel.clone().applyQuaternion(base.quaternion.clone().invert()).setY(0) : V(1, 0, 0);
      if (vel.lengthSq() < 0.01) vel.set(1, 0, 0);
      vel.normalize().multiplyScalar(1.6).add(V(0, 0, -0.9));
      const r = c.r, desde = r.grupo.position.clone();
      r.pose(poseDe(r, ['horror', 'base']), { rebote: 0.3 });
      animar(0.6, k => { r.grupo.position.copy(desde).addScaledVector(vel, k).add(V(0, Math.sin(k * Math.PI) * 0.35 - k * k * 0.6, 0)); r.cuerpo.rotation.z = k * 5; },
        () => { r.cuerpo.rotation.z = 0; if (!sitios.some(x => x.cliente?.r === r)) r.grupo.visible = false; });
    }

    function perder(s, texto) {
      const c = s.cliente;
      E.vidas--; E.combo = 0; E.perdidos++; sucio = true;
      sonido('abucheo', { volumen: 0.5 });
      const p = W(c.puky ? s.pukyEn.clone().setY(0.3) : s.cuerpo.clone().setY(ALTO_CLIENTE + 0.1));
      saltaTexto(texto, '#ff6f7f', p, 0.12);
      fx.fallo(p);
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m?.vibrar?.(0.5, 80);
      c.r.pose(poseDe(c.r, c.puky ? ['charco', 'riendo'] : ['asco', 'horror']), { rebote: 0.3 });
      c.r.tambalear(0.6);
      if (c.puky) sonido('chapoteo', { volumen: 0.5 });
      decir(c.puky ? 'Eso ya no sale. Escucha: eso ya no sale.' : 'Eso le pasa por no esperar. Como yo.', 0.5);
      irse(s, false);
      if (E.vidas <= 0) final();
    }

    // ---------- lo que llevas en la mano ----------
    const lleva = new Map(); // Mano → item
    const items = [];
    function nuevoItem(i, mano) {
      const m = new THREE.Mesh(geoProd[i], matProd); m.renderOrder = 3;
      grupo.add(m);
      const it = { i, m, mano };
      items.push(it); lleva.set(mano, it);
      return it;
    }
    function quitarItem(it) { grupo.remove(it.m); const k = items.indexOf(it); if (k >= 0) items.splice(k, 1); }
    function devolver(it) {
      const desde = it.m.position.clone(), hasta = W(estantes[it.i].local.clone().add(V(0, 0.03, 0)));
      animar(0.25, k => it.m.position.lerpVectors(desde, hasta, k).add(V(0, Math.sin(k * Math.PI) * 0.06, 0)), () => quitarItem(it));
      sonido('fup', { volumen: 0.25, tono: 1.3 });
    }
    const _p = V(), _q = V();
    function manosPaso() {
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!m) continue;
        let it = lleva.get(m);
        if (!m.activa) { if (it) { lleva.delete(m); devolver(it); } continue; }
        const punta = m.punta;
        if (it) {
          it.m.position.copy(punta).add(_p.set(0, 0.02, 0));
          it.m.rotation.set(0, Math.atan2(xr.cabeza.x - punta.x, xr.cabeza.z - punta.z), 0);
          if (!(m.pinza || m.agarre)) { lleva.delete(m); devolver(it); continue; }
          if (E.fase === 'juego') {
            // ¿en la mano de alguien?
            for (const s of sitios) {
              const c = s.cliente;
              if (!c || c.puky || c.estado !== 'espera') continue;
              if (W(s.entrega, _q).distanceTo(punta) > 0.15) continue;
              lleva.delete(m);
              if (c.pedido === it.i) servir(s, it, m);
              else {
                const alguien = sitios.some(x => x.cliente && !x.cliente.puky && x.cliente.estado === 'espera' && x.cliente.pedido === it.i);
                E.combo = Math.max(0, E.combo - 2); E.fallos++; sucio = true;
                sonido('bonk', { volumen: 0.5 });
                saltaTexto(alguien ? '¡Eso no es lo mío!' : '¡Eso no lo ha pedido nadie!', '#ff6f7f', W(s.entrega).add(V(0, 0.18, 0)), 0.1);
                c.r.tambalear(0.4); fx.fallo(W(s.entrega), { mano: m });
                devolver(it);
              }
              break;
            }
          }
        } else if ((m.empiezaPinza || m.empiezaAgarre) && E.fase !== 'fin') {
          let mejor = null, md = 0.13;
          for (const e of estantes) { const d = W(e.local, _q).distanceTo(punta); if (d < md) { md = d; mejor = e; } }
          if (mejor) { nuevoItem(mejor.i, m); m.vibrar?.(0.35, 25); sonido('pop', { volumen: 0.3, tono: 1.2 + mejor.i * 0.1 }); }
        }
        // un empujón a Puky (con la mano que sea, lleve algo o no)
        if (E.fase === 'juego' && m.vel.lengthSq() > 0.8 * 0.8) {
          for (const s of sitios) {
            const c = s.cliente;
            if (!c?.puky || c.estado !== 'espera') continue;
            if (W(c.r.grupo.position.clone().setY(0.17), _q).distanceTo(m.pos) < 0.24 || _q.distanceTo(punta) < 0.24) { echar(s, m); break; }
          }
        }
      }
    }

    // ---------- arranque ----------
    function final() {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; sucio = true;
      ui.instruccion(null);
      for (const s of sitios) if (s.cliente) irse(s, true);
      for (const [m, it] of lleva) { lleva.delete(m); devolver(it); }
      const gana = E.vidas > 0 && E.puntos >= 900;
      if (palicaso) palicaso.pose(poseDe(palicaso, gana ? ['emocionado', 'riendo'] : ['horror', 'base']), { rebote: 0.3 });
      vozLibre = 0;
      decir(E.vidas > 0 ? '¡Cierre de barra! Escucha: ha sido la mejor noche. Como todas.' : 'Se ha ido todo el mundo. Bueno, me quedo yo hablando.');
      sonido(E.vidas > 0 ? 'campanita' : 'suspiro', { volumen: 0.6 });
      luego(1.4, () => ctx.terminar({
        puntos: E.puntos, gana,
        linea: `Has servido a ${E.servidos} de la aso. ${E.vidas > 0 ? 'Palicaso no ha parado de hablar en toda la noche.' : 'Demasiada gente enfadada. Palicaso sigue hablando solo.'}`,
      }));
    }

    pintarPizarra();
    ctx.musica?.('minijuego');
    luego(0.4, () => { decir('¡Escucha, escucha! Hoy viene toda la aso. Tú sirves, yo hablo.'); sonido('campanita', { volumen: 0.4 }); });
    luego(1.0, () => ui.instruccion('Coge del estante lo que piden y llévaselo a la mano'));
    {
      const coge = W(estantes[2].local), da = W(sitios[1].entrega);
      fx.demo([{ p: coge.clone().add(V(0, 0.08, 0.04)) }, { p: coge }, { p: coge, pinza: true }, { p: da, pinza: true }, { p: da }], { dur: 3.2, tramo: 0.55, retraso: 0.6 });
    }
    luego(3.6, () => {
      E.fase = 'juego'; sucio = true;
      E.forzar = 'cliente'; nuevoCliente();
      luego(0.7, () => { E.forzar = 'cliente'; nuevoCliente(); });
      proximo = 2.4;
    });
    luego(9, () => { if (E.fase === 'juego' && E.servidos === 0) ui.instruccion(null); });

    const api = {
      E, sitios, estantes, get fase() { return E.fase; },
      mundo: v => W(v), entrega: i => W(sitios[i].entrega), estante: i => W(estantes[i].local),
      puky: i => sitios[i].cliente?.puky ? W(sitios[i].cliente.r.grupo.position.clone().setY(0.17)) : null,
      forzar: q => { E.forzar = q; },
      llamadas: () => ahorro,
    };
    grupo.userData.api = api;

    const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V(), _vp = V();
    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        for (let i = anims.length - 1; i >= 0; i--) {
          const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur);
          a.fn(k); if (k >= 1) { anims.splice(i, 1); a.fin?.(); }
        }
        manosPaso();
        if (E.fase === 'juego') {
          E.restante -= dt;
          const pasado = DURACION - E.restante;
          proximo -= dt;
          if (proximo <= 0) { nuevoCliente(); proximo = LLEGADA(pasado); }
          // nivel 3+: Lasslow se tira uno y la nube tapa un pedido un rato
          if (nivel >= 3) {
            tNube -= dt;
            const ocupados = sitios.filter(s => s.cliente && !s.cliente.puky && s.cliente.estado === 'espera');
            if (tNube <= 0 && ocupados.length && !nubeEn) {
              tNube = 7 + Math.random() * 4;
              nubeEn = ocupados[Math.floor(Math.random() * ocupados.length)]; tNubeVida = 0;
              nube.position.copy(nubeEn.bocadillo.position).add(V(0, 0, 0.02).applyAxisAngle(V(0, 1, 0), yawHaciaMi(nubeEn.bocadillo.position)));
              nube.visible = true;
              sonido('pedo-silencioso', { volumen: 0.5 });
              if (!avisoNube) { avisoNube = true; saltaTexto('Lasslow se ha tirado uno: ¡no se ve el pedido!', '#ff6fb5', W(V(0, 0.55, -0.9)), 0.1); }
            }
          }
          for (const s of sitios) {
            const c = s.cliente;
            if (!c || c.estado !== 'espera') continue;
            c.t -= dt;
            const f = Math.max(0, c.t / c.paciencia);
            s.barrita.scale.x = BW * 176 / 256 * f;
            s.barrita.material.color.set(f < 0.3 ? '#e8364f' : f < 0.6 ? '#ffd23f' : '#7ee081');
            // impaciencia: se mueve más cuanto menos le queda
            c.r.grupo.position.copy(c.destino).add(_vp.set(Math.sin(reloj * 17) * (1 - f) * 0.012, 0, 0));
            if (c.t <= 0) perder(s, c.puky ? '¡Puky pringa la barra!' : '¡Hmpf! Me voy');
          }
          tPintar -= dt; if (tPintar <= 0) { tPintar = 0.25; sucio = true; }
          if (E.restante <= 0 && !acabado) final();
        }
        if (nubeEn) {
          tNubeVida += dt;
          nube.material.opacity = Math.min(0.95, tNubeVida * 4, (2.65 - tNubeVida) * 2.4);
          nube.lookAt(xr.cabeza);
          if (tNubeVida > 2.65) { nubeEn = null; nube.visible = false; }
        }
        if (sucio) pintarPizarra();
        // los bocadillos te miran; las manos tendidas, solo de quien espera
        let n = 0;
        for (const s of sitios) {
          if (s.bocadillo.visible) s.bocadillo.lookAt(xr.cabeza);
          const espera = s.cliente && !s.cliente.puky && (s.cliente.estado === 'espera' || s.cliente.estado === 'llega');
          s.manoK = espera ? Math.min(1, s.manoK + dt * 5) : Math.max(0, s.manoK > 1 ? s.manoK - dt * 2 : s.manoK - dt * 5);
          const k = Math.min(1, s.manoK), pulso = s.manoK > 1 ? 1 + (s.manoK - 1) * 0.6 : 1 + 0.06 * Math.sin(reloj * 6 + s.i);
          _e.set(-0.9, yawHaciaMi(s.entrega), 0, 'YXZ');
          _m4.compose(s.entrega.clone().setY(0.035 + k * 0.02), _qq.setFromEuler(_e), _s.setScalar(Math.max(0.0001, k * pulso)));
          manos.setMatrixAt(n++, _m4);
        }
        manos.instanceMatrix.needsUpdate = true;
        // la gente: respira, parpadea y se ladea hacia ti (solo quien se ve)
        if (palicaso) palicaso.actualizar(dt, xr.cabeza);
        for (const p of pool) if (p.r.grupo.visible) p.r.actualizar(dt, xr.cabeza);
        if (puky?.grupo.visible) puky.actualizar(dt, xr.cabeza);
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.12; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (1.1 - s.t));
          if (s.t > 1.1) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; ui.instruccion(null);
        for (const s of sitios) if (s.cliente) irse(s, false);
        decir('¿Ya te vas? Pues cierro yo. Hablando.');
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Cierras antes de tiempo. Has servido a ${E.servidos} de la aso.` });
      },
      destruir() {
        acabado = true; tareas.length = 0; anims.length = 0;
        fx.destruir();
        for (const it of items.slice()) quitarItem(it);
        lleva.clear();
        ui.instruccion(null);
        palicaso?.callar(); for (const p of pool) p.r.callar(); puky?.callar();
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const t of texturas) t.dispose();
      },
    };
  },
};
