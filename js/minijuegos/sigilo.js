// Los discos de la Pompa (cap. 7, sigilo) · VR nativo, escala «mesa». Reglas de base/js/escenas/sigilo.js.
//
// La casa del casero es un diorama de juguete (~0,64 m) sobre tu mesa real (ctx.mesa()) o, si no hay, sobre un
// mostrador a la altura de tu cintura. Vuper, en miniatura, espera en la puerta.
//   COGER Y ARRASTRAR  pellizco/gatillo o puño sobre Vuper: le llevas por el suelo de la casa.
//   SIGILO             despacio no hace ruido; si le arrastras deprisa, hace ruido (el aro blanco) y quien lo oiga se
//                      gira hacia ti (en el 2D: MANTÉN Mayús).
// El casero, la casera y el gato tuerto patrullan con su cono de visión; las paredes tapan la vista y las macetas
// esconden. Si te ven, sube la sospecha; si se llena, te pillan: vuelves a la puerta (los discos se quedan) y pierdes
// una vida. Coge los tres discos y sal por la puerta. Puntos como el 2D: 300 por disco, rapidez, vidas y +500 si
// nadie te ha visto nunca.

import { Jugo, fusionar } from './jugo.js';

const TINTA = '#140c1c';
const S = 0.00055;                       // metros por píxel del 2D (1160 px de casa → 0,64 m)
const PAREDES = [
  [400, 100, 24, 250], [400, 470, 24, 230], [800, 240, 24, 460], [424, 340, 190, 24], [960, 340, 260, 24], [60, 330, 200, 24],
];
const DISCOS = [[690, 170], [1130, 200], [1020, 630]];
const MACETAS = [[300, 210], [640, 610], [900, 470], [1120, 450]];
const SALIDA = { x: 120, y: 630 };
const VEL_MAX = 260, RUIDOSO = 140;     // px/s: más deprisa que esto, Vuper hace ruido
const ALTO_PARED = 0.045;
const FRASES_PILLADO = ['¡Eh! ¿Tú quién eres?', '¡Fuera de mi casa, rider!', '¿Otra vez el de los monchis?'];

export default {
  clave: 'Sigilo', titulo: 'Los discos de la Pompa', escala: 'mesa', umbrales: [1300, 1800, 2300],
  ayudas: { gatillo: 'Coger a Vuper y llevarle', lateral: 'Coger a Vuper', mano: { pellizco: 'Coger a Vuper y llevarle', puno: 'Coger a Vuper' } },

  async crear(ctx) {
    const { THREE, ui, sonido, xr } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-sigilo';
    const nivel = ctx.nivel ?? 1;
    const texturas = [];
    const fx = new Jugo(ctx, grupo);
    const dif = 1 + 0.05 * Math.min(Math.max(0, nivel - 1), 6);

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const E = { fase: 'intro', vidas: 3, puntos: 0, cogidos: 0, sospecha: 0, t: 0, vistoNunca: true, pillados: 0, ruidoso: false, escondido: false };
    let reloj = 0, acabado = false, sonoAviso = false, sucio = true, tPintar = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // ---------- dónde: tu mesa, o un mostrador a la cintura ----------
    const mesa = ctx.mesa();
    const cab = xr.cabeza.clone().setY(0);
    let fw = mesa ? mesa.punto.clone().setY(0).sub(cab) : xr.adelante.clone().setY(0);
    const dMesa = mesa ? fw.length() : 0;
    if (fw.lengthSq() < 1e-4) fw = xr.adelante.clone().setY(0);
    if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1);
    fw.normalize();
    const alturaMesa = mesa ? mesa.punto.y : THREE.MathUtils.clamp(xr.cabeza.y - 0.62, 0.6, 1.05);
    const dist = mesa ? THREE.MathUtils.clamp(dMesa - 0.2, 0.4, 0.55) : 0.44;
    const base = new THREE.Group(); base.name = 'diorama-sigilo';
    base.position.copy(cab).addScaledVector(fw, dist).setY(alturaMesa);
    base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); base.updateMatrixWorld(true);
    const inv = base.matrixWorld.clone().invert();
    const W = (x, y, z, out = V()) => out.set(x, y, z).applyMatrix4(base.matrixWorld);
    const L = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    // del plano del 2D (px) al diorama (m) y al revés
    const LX = px => (px - 640) * S, LZ = py => (py - 400) * S;
    const PX = x => x / S + 640, PY = z => z / S + 400;

    // ---------- ayudantes de dibujo ----------
    const mb = o => new THREE.MeshBasicMaterial(o);
    const MAT_TINTA = mb({ color: TINTA, side: THREE.BackSide });
    function tinta(malla, e = 0.003) {
      malla.geometry.computeBoundingBox();
      const s = malla.geometry.boundingBox.getSize(V());
      const t = new THREE.Mesh(malla.geometry, MAT_TINTA);
      t.scale.set(1 + 2 * e / Math.max(s.x, 1e-3), 1 + 2 * e / Math.max(s.y, 1e-3), 1 + 2 * e / Math.max(s.z, 1e-3));
      malla.add(t);
      return malla;
    }
    const lienzo = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texturas.push(t);
      return { c, g: c.getContext('2d'), t };
    };
    const caja = (w, h, d, color, e = 0.003) => tinta(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mb({ color })), e);
    // un dibujo de pie (de cartón), con el origen en los pies
    function carton(tex, alto, color = '#ffffff') {
      const a = tex?.image ? tex.image.width / tex.image.height : 0.6;
      const geo = new THREE.PlaneGeometry(alto * a, alto); geo.translate(0, alto / 2, 0);
      const m = new THREE.Mesh(geo, tex ? mb({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color }) : mb({ color: '#9a5b6e' }));
      m.userData.ancho = alto * a;
      return m;
    }
    const imagen = n => ctx.img(n).catch(() => null);
    const [texVuper, texVuperSorpresa, texVuperRie, texCasero, texCaseroMira, texGato, texVinilo] = await Promise.all(
      ['vn-caminando.png', 'vn-sorprendido.png', 'vn-riendo.png', 'n-casero.png', 'n-casero-sorprendido.png', 'obj-gato.png', 'obj-vinilo.png'].map(imagen));

    // ---------- el mostrador (si no hay mesa) y la tabla del diorama ----------
    const ANCHO = 1160 * S + 0.04, FONDO = 600 * S + 0.04;
    if (!mesa) {
      const m = caja(ANCHO + 0.12, alturaMesa, FONDO + 0.14, '#a98b6a', 0.005);
      m.position.set(0, -alturaMesa / 2 - 0.001, 0.02); base.add(m);
    }
    const tabla = caja(ANCHO, 0.012, FONDO, '#3a2a24', 0.003); tabla.position.y = 0.006; base.add(tabla);
    // el suelo: parqué, alfombras y la puerta (pintado como el 2D)
    {
      const K = 1024 / 1160, { g, t } = lienzo(1024, Math.round(600 * K));
      const X = px => (px - 60) * K, Y = py => (py - 100) * K;
      g.fillStyle = '#d8c3a0'; g.fillRect(0, 0, 1024, 600 * K);
      g.strokeStyle = '#c4ad88'; g.lineWidth = 2;
      for (let y = 100; y < 700; y += 30) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(1024, Y(y)); g.stroke(); }
      for (let y = 100, k = 0; y < 700; y += 30, k++) for (let x = 60 + (k % 2) * 60; x < 1220; x += 120) { g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x), Y(y + 30)); g.stroke(); }
      g.fillStyle = 'rgba(154,91,110,.6)'; g.beginPath(); g.roundRect(X(470), Y(420), 280 * K, 220 * K, 18); g.fill();
      g.fillStyle = 'rgba(91,122,154,.6)'; g.beginPath(); g.roundRect(X(880), Y(120), 300 * K, 180 * K, 18); g.fill();
      g.fillStyle = 'rgba(126,224,129,.38)'; g.fillRect(X(SALIDA.x - 45), Y(SALIDA.y - 45), 90 * K, 90 * K);
      g.strokeStyle = '#3d8d40'; g.lineWidth = 4; g.strokeRect(X(SALIDA.x - 45), Y(SALIDA.y - 45), 90 * K, 90 * K);
      g.fillStyle = '#2f6b31'; g.font = '26px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Salida', X(SALIDA.x), Y(SALIDA.y + 32));
      const suelo = new THREE.Mesh(new THREE.PlaneGeometry(1160 * S, 600 * S), mb({ map: t }));
      suelo.rotation.x = -Math.PI / 2; suelo.position.set(0, 0.0125, 0); base.add(suelo);
    }
    const Y0 = 0.0125; // el suelo de la casa
    const decorado = new THREE.Group(); base.add(decorado);
    // paredes (las de dentro, altas; el borde de la casa, bajito para ver dentro)
    for (const [x, y, w, h] of PAREDES) {
      const p = caja(w * S, ALTO_PARED, h * S, '#5a4034'); p.position.set(LX(x + w / 2), Y0 + ALTO_PARED / 2, LZ(y + h / 2)); decorado.add(p);
    }
    for (const [w, d, x, z] of [[1160 * S + 0.012, 0.008, 0, LZ(100) - 0.004], [1160 * S + 0.012, 0.008, 0, LZ(700) + 0.004], [0.008, 600 * S, LX(60) - 0.004, 0], [0.008, 600 * S, LX(1220) + 0.004, 0]]) {
      const p = caja(w, 0.022, d, '#5a4034', 0.002); p.position.set(x, Y0 + 0.011, z); decorado.add(p);
    }
    // macetas: escondites
    const geoHoja = new THREE.SphereGeometry(1, 10, 8);
    for (const [x, y] of MACETAS) {
      const m = new THREE.Group(); m.position.set(LX(x), Y0, LZ(y)); decorado.add(m);
      const tiesto = tinta(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.02, 14), mb({ color: '#c0673f' }))); tiesto.position.y = 0.01; m.add(tiesto);
      for (const [dx, dy, dz, r, c] of [[0, 0.03, 0, 0.019, '#3f7a3a'], [-0.01, 0.042, 0.006, 0.012, '#5aa04f'], [0.011, 0.038, -0.004, 0.011, '#5aa04f'], [0.002, 0.05, -0.008, 0.01, '#6bbf5c']]) {
        const h = tinta(new THREE.Mesh(geoHoja, mb({ color: c })), 0.0025); h.scale.setScalar(r); h.position.set(dx, dy, dz); m.add(h);
      }
    }
    fusionar(base, o => o.parent !== null && !o.userData.vivo);

    // ---------- los discos ----------
    const discos = DISCOS.map(([x, y], i) => {
      const m = carton(texVinilo, 0.04); m.position.set(LX(x), Y0 + 0.012, LZ(y)); m.userData.vivo = true; base.add(m);
      return { x, y, m, vivo: true, fase: i * 2.1 };
    });

    // ---------- vigilantes: el casero, el gato tuerto y la casera ----------
    function vigilante(tex, alto, ruta, vel, alcance, fov, color) {
      const m = carton(tex, alto, color); m.userData.vivo = true; base.add(m);
      m.position.set(LX(ruta[0][0]), Y0, LZ(ruta[0][1]));
      return { m, ruta, i: 1, x: ruta[0][0], y: ruta[0][1], vel: vel * dif, alcance: alcance * dif, fov: fov * Math.PI / 180, dir: 0, alerta: 0, ve: false, bote: 0 };
    }
    const vigilantes = [
      vigilante(texCasero, 0.1, [[520, 470], [740, 470], [740, 640], [520, 640]], 70, 240, 70),
      vigilante(texGato, 0.045, [[880, 190], [1170, 190], [1170, 260], [880, 260]], 55, 170, 60),
      vigilante(texCasero, 0.095, [[140, 160], [340, 160], [340, 280], [140, 280]], 60, 200, 65, '#ffd0a0'),
    ];

    // ---------- los conos de visión: una sola malla para los tres ----------
    const SEG = 12, VPC = SEG + 2; // vértices por cono (centro + arco)
    const conoPos = new Float32Array(vigilantes.length * VPC * 3), conoCol = new Float32Array(vigilantes.length * VPC * 3);
    const idx = [];
    for (let k = 0; k < vigilantes.length; k++) for (let s = 0; s < SEG; s++) idx.push(k * VPC, k * VPC + 1 + s, k * VPC + 2 + s);
    const geoConos = new THREE.BufferGeometry();
    geoConos.setAttribute('position', new THREE.BufferAttribute(conoPos, 3).setUsage(THREE.DynamicDrawUsage));
    geoConos.setAttribute('color', new THREE.BufferAttribute(conoCol, 3).setUsage(THREE.DynamicDrawUsage));
    geoConos.setIndex(idx);
    const conos = new THREE.Mesh(geoConos, mb({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    conos.frustumCulled = false; conos.renderOrder = 5; base.add(conos);

    // ---------- Vuper en miniatura ----------
    const vuper = carton(texVuper, 0.075); base.add(vuper);
    const vu = { x: SALIDA.x, y: SALIDA.y, vs: 0, cara: 1, mano: null, off: { x: 0, y: 0 }, vuelta: null, cerca: 0 };
    // su peana: se ilumina cuando tu mano está cerca para cogerle
    const peana = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.024, 28), mb({ color: '#ffe066', transparent: true, opacity: 0.6, depthWrite: false }));
    peana.rotation.x = -Math.PI / 2; peana.renderOrder = 6; base.add(peana);
    // el aro del ruido (en el 2D, un círculo de 140 px)
    const aroRuido = new THREE.Mesh(new THREE.RingGeometry(140 * S - 0.003, 140 * S, 48), mb({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
    aroRuido.rotation.x = -Math.PI / 2; aroRuido.renderOrder = 6; aroRuido.visible = false; base.add(aroRuido);

    // ---------- el marcador: un cartelito al fondo de la casa ----------
    const marc = lienzo(640, 128);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), mb({ map: marc.t, transparent: true }));
    cartel.position.set(0, Y0 + 0.1, LZ(100) - 0.05); cartel.rotation.x = -0.2; base.add(cartel);
    const patas = caja(0.006, 0.08, 0.006, '#5a4034', 0.0015); patas.position.set(0, -0.06, -0.004); cartel.add(patas);
    function pintarMarcador() {
      const { g, t } = marc;
      g.clearRect(0, 0, 640, 128);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(0, 0, 640, 128, 26); g.fill();
      g.fillStyle = '#2a1f33'; g.beginPath(); g.roundRect(8, 8, 624, 112, 20); g.fill();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#ffe066'; g.font = '40px Caprasimo, serif'; g.fillText(`Discos ${E.cogidos}/3`, 26, 64);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < E.vidas ? '#7ee081' : '#e8364f'; g.strokeStyle = TINTA; g.lineWidth = 6;
        g.beginPath(); g.arc(262 + i * 36, 64, 13, 0, 7); g.fill(); g.stroke();
      }
      g.fillStyle = '#fff6e8'; g.font = '26px Caprasimo, serif'; g.fillText('Sospecha', 380, 40);
      g.fillStyle = '#000'; g.beginPath(); g.roundRect(380, 62, 230, 30, 10); g.fill();
      g.strokeStyle = '#fff6e8'; g.lineWidth = 3; g.stroke();
      if (E.sospecha > 0.01) { g.fillStyle = E.sospecha > 0.6 ? '#e8364f' : '#ff9a3b'; g.beginPath(); g.roundRect(383, 65, 224 * E.sospecha, 24, 8); g.fill(); }
      t.needsUpdate = true; sucio = false;
    }

    // ---------- textos que saltan (¡Un disco!, lo que dice el casero) ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.12, vida = 1.1) {
      const ancho = texto.length > 12 ? 1024 : 512, { g, t } = lienzo(ancho, 160);
      let px = 84; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > ancho - 40 && px > 36) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText(texto, ancho / 2, 84); g.fillStyle = color; g.fillText(texto, ancho / 2, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam * ancho / 512, tam * 160 / 512), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0, vida });
    }

    // ---------- geometría del 2D ----------
    const enPared = (x, y) => PAREDES.some(([rx, ry, w, h]) => x >= rx && x <= rx + w && y >= ry && y <= ry + h);
    // ¿la línea entre dos puntos atraviesa alguna pared? (segmento contra caja, por franjas)
    function tapado(x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      return PAREDES.some(([rx, ry, w, h]) => {
        let t0 = 0, t1 = 1;
        for (const [p, q] of [[-dx, x1 - rx], [dx, rx + w - x1], [-dy, y1 - ry], [dy, ry + h - y1]]) {
          if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
          const r = q / p;
          if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
        }
        return true;
      });
    }
    const escondido = () => MACETAS.some(([x, y]) => Math.hypot(x - vu.x, y - vu.y) < 42);
    const envolver = a => Math.atan2(Math.sin(a), Math.cos(a));
    const girarHacia = (a, b, paso) => { const d = envolver(b - a); return Math.abs(d) <= paso ? b : a + Math.sign(d) * paso; };

    // ---------- coger a Vuper y llevarle ----------
    const vuperMundo = (out = V()) => W(LX(vu.x), Y0 + 0.035, LZ(vu.y), out);
    const _m = V(), _l = V();
    function manos(dt) {
      const centro = vuperMundo(_m);
      let cerca = 0;
      for (const mano of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!mano.activa) continue;
        const d = mano.punta.distanceTo(centro), radio = mano.esMano ? 0.1 : 0.085;
        if (d < radio) cerca = 1;
        if (!vu.mano && E.fase === 'juego' && !vu.vuelta && (mano.empiezaPinza || mano.empiezaAgarre) && d < radio) {
          vu.mano = mano;
          const l = L(mano.punta, _l);
          vu.off.x = vu.x - PX(l.x); vu.off.y = vu.y - PY(l.z);
          mano.vibrar(0.5, 40);
          sonido('pop', { volumen: 0.3, tono: 1.4 });
          if (!E.cogidoUnaVez) { E.cogidoUnaVez = true; ui.instruccion('Despacio no hace ruido · las macetas esconden'); luego(4, () => { if (E.fase === 'juego') ui.instruccion(null); }); }
        }
      }
      if (vu.mano && (!vu.mano.activa || !(vu.mano.pinza || vu.mano.agarre))) { vu.mano.vibrar(0.25, 25); vu.mano = null; }
      vu.cerca += ((vu.mano ? 1 : cerca) - vu.cerca) * Math.min(1, dt * 10);
      // a dónde quiere ir: donde tu mano (con lo que le cogiste de margen)
      let mx = 0, my = 0;
      if (vu.mano) {
        const l = L(vu.mano.punta, _l);
        const tx = PX(l.x) + vu.off.x, ty = PY(l.z) + vu.off.y;
        const dx = tx - vu.x, dy = ty - vu.y, d = Math.hypot(dx, dy);
        const paso = Math.min(d, VEL_MAX * dt);
        if (d > 2) { mx = dx / d * paso; my = dy / d * paso; }
      }
      // con choque contra paredes (eje a eje, como el 2D)
      const ox = vu.x, oy = vu.y;
      const nx = THREE.MathUtils.clamp(vu.x + mx, 90, 1190); if (!enPared(nx, vu.y)) vu.x = nx;
      const ny = THREE.MathUtils.clamp(vu.y + my, 130, 670); if (!enPared(vu.x, ny)) vu.y = ny;
      const v = Math.hypot(vu.x - ox, vu.y - oy) / Math.max(dt, 1e-3);
      vu.vs += (v - vu.vs) * Math.min(1, dt * 8);
      if (Math.abs(vu.x - ox) > 0.3) vu.cara = vu.x > ox ? 1 : -1;
      // si choca contra la pared, vibra un poco
      if (vu.mano && (Math.abs(mx) > 0.5 && Math.abs(vu.x - ox) < 0.01 || Math.abs(my) > 0.5 && Math.abs(vu.y - oy) < 0.01) && reloj > (vu.choque || 0)) { vu.choque = reloj + 0.35; vu.mano.vibrar(0.2, 20); }
    }

    // ---------- un disco ----------
    function coger(dsc) {
      dsc.vivo = false; dsc.m.visible = false;
      E.cogidos++; E.puntos += 300; sucio = true;
      const p = W(LX(dsc.x), Y0 + 0.03, LZ(dsc.y));
      fx.acierto(p, { mano: vu.mano, color: '#ffe066', n: 22, racha: E.cogidos * 2 });
      saltaTexto('¡Un disco!', '#ffe066', p.clone().add(V(0, 0.07, 0)), 0.1);
      if (E.cogidos === 3) luego(0.6, () => { ui.instruccion('¡Los tres! Ahora, a la salida'); sonido('tiroriro', { volumen: 0.4 }); });
    }

    // ---------- te pillan ----------
    function pillado() {
      E.vidas--; E.pillados++; E.sospecha = 0; sucio = true;
      sonido('oooh', { volumen: 0.5 });
      if (vu.mano) { vu.mano.vibrar(1, 140); vu.mano = null; }
      vuper.material.map = texVuperSorpresa || texVuper; vuper.material.color.set('#ff5a4f');
      luego(0.22, () => vuper.material.color.set('#ffffff'));
      const w = vigilantes.reduce((a, b) => (Math.hypot(b.x - vu.x, b.y - vu.y) < Math.hypot(a.x - vu.x, a.y - vu.y) ? b : a));
      if (w.m.material.map === texCasero && texCaseroMira) { w.m.material.map = texCaseroMira; luego(1.5, () => { w.m.material.map = texCasero; }); }
      saltaTexto(FRASES_PILLADO[Math.floor(Math.random() * FRASES_PILLADO.length)], '#fff6e8', W(LX(w.x), Y0 + 0.16, LZ(w.y)), 0.11, 1.6);
      if (E.vidas <= 0) return final(false);
      // de vuelta a la puerta (los discos cogidos se quedan)
      vu.vuelta = { x0: vu.x, y0: vu.y, t: 0 };
    }

    function final(sale) {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; sucio = true;
      if (vu.mano) vu.mano = null;
      ui.instruccion(null);
      aroRuido.visible = false;
      if (sale) E.puntos += Math.max(0, Math.round(120 - E.t) * 8) + E.vidas * 150 + (E.vistoNunca ? 500 : 0);
      E.gana = sale && E.puntos >= 1300;
      if (sale) {
        sonido('aaah', { volumen: 0.5 });
        vuper.material.map = texVuperRie || texVuper;
        const p = vuperMundo();
        for (let i = 0; i < 4; i++) luego(i * 0.18, () => fx.chispas(p.clone().add(V((Math.random() - 0.5) * 0.12, 0.05, (Math.random() - 0.5) * 0.12)), ['#ffe066', '#ff6fb5', '#7ee081', '#5fb8ff'][i], 26, 1));
      }
      const titulo = sale ? '¡Los discos de la Pompa!' : 'Te han pillado';
      const linea = sale ? `${E.vistoNunca ? 'Ni te han visto. ' : ''}La Pompa podrá pinchar la noche de la inspección.` : 'El casero te acompaña a la puerta. Muy amablemente. Demasiado.';
      luego(0.9, () => ctx.terminar({ puntos: E.puntos, gana: E.gana, linea: `${titulo} ${linea}` }));
    }

    // ---------- arranque ----------
    pintarMarcador();
    ctx.musica?.('sigilo');
    luego(0.4, () => { ui.cartela('La casa del casero · de día', 2.6); sonido('sting', { volumen: 0.4 }); });
    luego(1.0, () => ui.instruccion('Coge a Vuper y llévale a por los 3 discos sin que te vean'));
    luego(3.4, () => { E.fase = 'juego'; ui.instruccion('Pellizca a Vuper y arrástrale despacio'); });
    luego(9, () => { if (E.fase === 'juego' && !E.cogidoUnaVez) ui.instruccion('Pellizca a Vuper (o gatillo) y arrástrale'); });
    // la mano fantasma: pellizca a Vuper y le lleva despacio hacia dentro
    {
      const p0 = W(LX(SALIDA.x), Y0 + 0.04, LZ(SALIDA.y)), p1 = W(LX(SALIDA.x + 150), Y0 + 0.04, LZ(SALIDA.y - 160));
      fx.demo([{ p: p0.clone().add(V(0, 0.08, 0.04)) }, { p: p0 }, { p: p0, pinza: true }, { p: p1, pinza: true }, { p: p1 }], { dur: 3.2, tramo: 0.55, escala: 0.75 });
    }

    const api = {
      E, vu, vigilantes, discos, paredes: PAREDES, macetas: MACETAS, salida: SALIDA,
      get fase() { return E.fase; },
      mundo: (px, py, alto = 0.035) => W(LX(px), Y0 + alto, LZ(py)), vuper: () => vuperMundo(), enPared, tapado,
    };
    grupo.userData.api = api;

    const _cab = V();
    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        const cabL = L(xr.cabeza, _cab);
        const activo = E.fase === 'juego' && !vu.vuelta;
        if (E.fase === 'juego') E.t += dt;
        if (activo || E.fase === 'intro') manos(dt); else { vu.vs = 0; vu.cerca = Math.max(0, vu.cerca - dt * 4); }
        // de vuelta a la puerta tras pillarte
        if (vu.vuelta) {
          const r = vu.vuelta; r.t += dt; const k = Math.min(1, r.t / 0.6), e = k * k * (3 - 2 * k);
          vu.x = r.x0 + (SALIDA.x - r.x0) * e; vu.y = r.y0 + (SALIDA.y - r.y0) * e;
          if (k >= 1) { vu.vuelta = null; vuper.material.map = texVuper; }
        }
        const oculto = escondido();
        E.escondido = oculto;
        E.ruidoso = activo && vu.mano && vu.vs > RUIDOSO && !oculto;

        if (activo) {
          for (const d of discos) if (d.vivo && Math.hypot(d.x - vu.x, d.y - vu.y) < 40) coger(d);
          if (E.cogidos >= 3 && Math.hypot(vu.x - SALIDA.x, vu.y - SALIDA.y) < 50) final(true);
        }

        // vigilantes: patrulla, oído y vista
        let visto = false;
        for (const w of vigilantes) {
          if (E.fase === 'juego') {
            const [ox0, oy0] = w.ruta[w.i];
            const ox = ox0 - w.x, oy = oy0 - w.y, d = Math.hypot(ox, oy);
            const distV = Math.hypot(vu.x - w.x, vu.y - w.y);
            if (E.ruidoso && distV < 150) { if (w.alerta <= 0) { w.bote = 1; sonido('boing', { volumen: 0.2, tono: 1.6 }); } w.alerta = 1.6; }
            if (w.alerta > 0) {
              w.alerta -= dt;
              w.dir = girarHacia(w.dir, Math.atan2(vu.y - w.y, vu.x - w.x), 4 * dt);
            } else if (d < 4) w.i = (w.i + 1) % w.ruta.length;
            else {
              w.x += ox / d * w.vel * dt; w.y += oy / d * w.vel * dt;
              w.dir = girarHacia(w.dir, Math.atan2(oy, ox), 5 * dt);
            }
            const ang = Math.abs(envolver(Math.atan2(vu.y - w.y, vu.x - w.x) - w.dir));
            w.ve = activo && !oculto && distV < w.alcance && ang < w.fov / 2 && !tapado(w.x, w.y, vu.x, vu.y);
            if (w.ve) visto = true;
          } else w.ve = false;
          // el dibujo: anda con saltitos y se gira a ti
          w.bote = Math.max(0, w.bote - dt * 3);
          const andando = E.fase === 'juego' && w.alerta <= 0;
          w.m.position.set(LX(w.x), Y0 + (andando ? Math.abs(Math.sin(reloj * 9 + w.ruta[0][0])) * 0.004 : 0) + Math.sin(w.bote * Math.PI) * 0.012, LZ(w.y));
          w.m.rotation.set(0, Math.atan2(cabL.x - w.m.position.x, cabL.z - w.m.position.z), andando ? Math.sin(reloj * 9 + w.ruta[0][0]) * 0.06 : 0);
          w.m.scale.x = Math.cos(w.dir) > 0 ? -1 : 1;
        }
        // los conos
        vigilantes.forEach((w, k) => {
          const o = k * VPC * 3, cx = LX(w.x), cz = LZ(w.y), y = Y0 + 0.003;
          const col = w.ve ? [1, 0.35, 0.31] : [1, 0.89, 0.48];
          conoPos[o] = cx; conoPos[o + 1] = y; conoPos[o + 2] = cz;
          conoCol[o] = col[0]; conoCol[o + 1] = col[1]; conoCol[o + 2] = col[2];
          for (let s = 0; s <= SEG; s++) {
            const a = w.dir - w.fov / 2 + w.fov * s / SEG, j = o + (s + 1) * 3;
            conoPos[j] = cx + Math.cos(a) * w.alcance * S; conoPos[j + 1] = y; conoPos[j + 2] = cz + Math.sin(a) * w.alcance * S;
            conoCol[j] = col[0] * 0.8; conoCol[j + 1] = col[1] * 0.8; conoCol[j + 2] = col[2] * 0.8;
          }
        });
        geoConos.attributes.position.needsUpdate = true; geoConos.attributes.color.needsUpdate = true;
        conos.visible = E.fase !== 'intro' || reloj > 1.2;

        if (E.fase === 'juego') {
          if (visto) {
            E.vistoNunca = false;
            E.sospecha = Math.min(1, E.sospecha + 1.15 * dt);
            if (!sonoAviso) { sonoAviso = true; sonido('boing', { volumen: 0.4 }); vu.mano?.vibrar(0.6, 60); saltaTexto('!', '#e8364f', vuperMundo().add(V(0, 0.07, 0)), 0.12, 0.7); }
          } else {
            sonoAviso = false;
            E.sospecha = Math.max(0, E.sospecha - 0.35 * dt);
          }
          tPintar -= dt; if (tPintar <= 0) { tPintar = 0.1; sucio = true; }
          if (E.sospecha >= 1) pillado();
        }
        if (sucio) pintarMarcador();

        // Vuper: anda, se agacha en las macetas, enrojece con la sospecha
        const andando = vu.vs > 20;
        vuper.position.set(LX(vu.x), Y0 + (andando ? Math.abs(Math.sin(reloj * (E.ruidoso ? 16 : 8))) * 0.005 : 0) + (vu.mano ? 0.004 : 0), LZ(vu.y));
        vuper.rotation.set(0, Math.atan2(cabL.x - vuper.position.x, cabL.z - vuper.position.z), andando ? Math.sin(reloj * (E.ruidoso ? 16 : 8)) * 0.1 : 0);
        vuper.scale.set(vu.cara > 0 ? -1 : 1, oculto ? 0.75 : 1, 1);
        vuper.material.opacity = 1;
        if (!vu.vuelta && E.fase === 'juego') vuper.material.color.setRGB(1, 1 - E.sospecha * 0.55, 1 - E.sospecha * 0.6);
        peana.position.set(vuper.position.x, Y0 + 0.002, vuper.position.z);
        peana.material.opacity = 0.25 + 0.55 * vu.cerca + (vu.mano ? 0.15 * Math.sin(reloj * 12) : 0);
        peana.scale.setScalar(1 + 0.25 * vu.cerca);
        peana.material.color.set(oculto ? '#7ee081' : vu.mano ? '#ffe066' : '#fff6e8');
        aroRuido.visible = !!E.ruidoso;
        if (E.ruidoso) { aroRuido.position.set(vuper.position.x, Y0 + 0.002, vuper.position.z); aroRuido.scale.setScalar(0.85 + 0.15 * Math.sin(reloj * 14)); }
        // los discos giran
        for (const d of discos) if (d.vivo) {
          d.m.rotation.y = reloj * 2 + d.fase;
          d.m.position.y = Y0 + 0.008 + Math.sin(reloj * 3 + d.fase) * 0.003;
        }
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.05; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (s.vida - s.t));
          if (s.t > s.vida) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; ui.instruccion(null);
        vu.mano = null;
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Sales de la casa con ${E.cogidos} de 3 discos.` });
      },
      destruir() {
        acabado = true; tareas.length = 0; vu.mano = null;
        fx.destruir();
        ui.instruccion(null);
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const t of texturas) t.dispose();
        grupo.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      },
    };
  },
};
