// El farol (Palicaso, cap. 5 «La caja») en VR nativo, inmersivo: dados de verdad en la barra del bar del humo.
// Coges el cubilete (pellizco, puño, gatillo o botón lateral), lo agitas (suenan los dados) y lo vuelcas en la barra:
// al darle la vuelta de golpe o al soltarlo después de agitar. Los dados ruedan con física debajo, Palicaso mira por
// debajo del cubilete y canta lo que ha salido. Tú decides: la ficha verde «Me lo creo» o la rosa «¡Farol!» (o
// levantarle el cubilete, que también es llamarle mentiroso). Su cara le delata, pero SOLO si te acercas a
// mirarle: de lejos pone cara de póker; a menos de un palmo de distancia le cae la gota y se le escapa la risa.
// Si no tiras en un rato, tira él («Trae, que tiro yo»).
// Reglas del 2D (base/js/escenas/farol.js): doce manos, tres vidas; cuando miente se enrolla; desde la mitad también
// se enrolla diciendo la verdad y miente en corto; acertar seguido multiplica (hasta x5) y decidir rápido suma 50.
// Nivel 3+: lo traicionero empieza antes (mano 4); nivel 5+: se le nota menos.

import { Jugo, unaMalla } from './jugo.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MANOS = 12;
const TINTA = '#140c1c';
const R_DADO = 0.017, LADO_DADO = 0.03;
const CUB_R = 0.052, CUB_H = 0.105;
const CARA = [1, 6, 2, 5, 3, 4];                 // valor de cada cara de BoxGeometry: +x −x +y −y +z −z
const NORMALES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const CERCA = 0.6, LEJOS = 0.8;                   // distancia de tu cabeza a su cara (m): se le nota / cara de póker

const FRASES = {
  verdadCorta: ['Un {n}.', 'He sacado {n}.', '{n}. Tal cual.', 'Pues un {n}.', '{n}, mira tú.'],
  mentiraLarga: [
    '¡Escucha, escucha! Un {n}. Un {n} precioso. Te lo juro por la aso, por Blancaso y por la máquina.',
    '{n}. Pero escucha, que esto tiene historia: la última vez que saqué un {n} fue el día que…',
    '¡Un {n}! ¿Te he contado lo del {n}? Es mi número. Siempre me sale. Siempre. Bueno, casi siempre.',
    'Escucha: {n}. {n}. Y si no te lo crees, pregúntale a Lasslow, que estaba delante. Bueno, no estaba.',
  ],
  verdadLarga: ['¡Escucha! Un {n}. Y esta vez va en serio, que conste. Hoy no me enrollo. Bueno, un poco.', 'Un {n}, de verdad de la buena. ¿Ves? Ni he dicho «escucha». Mierda.'],
  mentiraCorta: ['{n}.', 'Un {n}. Venga.', '{n}… sí.'],
};
const azar = l => l[Math.floor(Math.random() * l.length)];
function baraja(lista) {
  let mazo = [];
  return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); };
}

export default {
  clave: 'Farol', titulo: 'El farol', escala: 'inmersivo', umbrales: [900, 2200, 3600],
  ayudas: { gatillo: 'Coger el cubilete · tocar ficha', lateral: 'Coger el cubilete', mano: { pellizco: 'Coger, agitar y volcar', puno: 'Coger el cubilete' } },
  sitioTarjetas: { d: 0.42, bajo: 0.1 },

  async crear(ctx) {
    const { THREE, xr, ui, sonido, fisica } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-farol';
    const nivel = ctx.nivel ?? 1;
    const fx = new Jugo(ctx, grupo);
    const texturas = [];

    // ---------- estado (todo se reinicia aquí) ----------
    const E = { fase: 'intro', puntos: 0, vidas: 3, mano: 0, racha: 0, miente: false, canta: 0, d: [0, 0], quienTira: null, aciertos: 0, resultados: [], tell: { pose: false, gota: false } };
    let reloj = 0, acabado = false, sucio = true, tEspera = 0, t0 = 0, cercaAntes = false, vozCerca = false, agitado = 0, tRuido = 0;
    const tareas = [], anims = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });
    const animar = (dur, fn, fin) => anims.push({ t: 0, dur, fn, fin });

    // ---------- dónde: la barra delante, Palicaso al otro lado ----------
    const cab0 = xr.cabeza.clone();
    let fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const base = new THREE.Group(); base.name = 'farol-base';
    base.position.set(cab0.x, cab0.y - 0.4, cab0.z);
    base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); base.updateMatrixWorld(true);
    const TOPE = base.position.y;   // altura de la barra (mundo)
    const inv = base.matrixWorld.clone().invert();
    const W = (v, out = V()) => out.copy(v).applyMatrix4(base.matrixWorld);
    const L = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const qBase = base.quaternion.clone();
    const CENTRO = V(0, 0, -0.42), CASA = V(0, 0, -0.36);

    const mb = o => new THREE.MeshBasicMaterial(o);
    const lienzo = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texturas.push(t);
      return { c, g: c.getContext('2d'), t };
    };
    // geometría con color por vértice (sombreado de mentira: luz de arriba a la izquierda)
    const sombrear = (geo, color, k = 0.35) => {
      const c = new THREE.Color(color), n = geo.attributes.normal, col = new Float32Array(n.count * 3), luz = V(-0.4, 0.8, 0.45).normalize();
      for (let i = 0; i < n.count; i++) { const s = 1 - k + k * Math.max(0, n.getX(i) * luz.x + n.getY(i) * luz.y + n.getZ(i) * luz.z); col[i * 3] = c.r * s; col[i * 3 + 1] = c.g * s; col[i * 3 + 2] = c.b * s; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    };

    // ---------- la barra (una llamada) ----------
    {
      const tapa = sombrear(new THREE.BoxGeometry(1.4, 0.05, 0.62).translate(0, -0.025, -0.49).toNonIndexed(), '#7a4a2c', 0.45);
      const frente = sombrear(new THREE.BoxGeometry(1.4, 1.1, 0.5).translate(0, -0.6, -0.53).toNonIndexed(), '#4a2a1a', 0.3);
      const canto = sombrear(new THREE.BoxGeometry(1.42, 0.03, 0.03).translate(0, -0.035, -0.175).toNonIndexed(), '#2e1a10', 0.2);
      const tapete = sombrear(new THREE.CircleGeometry(0.17, 40).rotateX(-Math.PI / 2).translate(0, 0.001, -0.42).toNonIndexed(), '#2f5a3a', 0);
      for (const g of [tapa, frente, canto, tapete]) for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(a)) g.deleteAttribute(a);
      const barra = new THREE.Mesh(mergeGeometries([tapa, frente, canto, tapete]), mb({ vertexColors: true }));
      base.add(barra);
    }

    // ---------- el cubilete: la boca en el origen; de pie, el cuerpo hacia abajo ----------
    const cubilete = (() => {
      const lado = new THREE.CylinderGeometry(CUB_R, CUB_R * 0.86, CUB_H, 28, 1, true).translate(0, -CUB_H / 2, 0).toNonIndexed();
      const fondo = new THREE.CircleGeometry(CUB_R * 0.86, 28).rotateX(Math.PI / 2).translate(0, -CUB_H, 0).toNonIndexed();
      const aro = new THREE.TorusGeometry(CUB_R, 0.005, 6, 28).rotateX(Math.PI / 2).toNonIndexed();
      const franja = new THREE.CylinderGeometry(CUB_R * 0.955, CUB_R * 0.94, 0.012, 28, 1, true).translate(0, -CUB_H * 0.72, 0).scale(1.012, 1, 1.012).toNonIndexed();
      sombrear(lado, '#8a2232', 0.4); sombrear(fondo, '#5a1520', 0); sombrear(aro, '#c8a04a', 0.3); sombrear(franja, '#c8a04a', 0.3);
      for (const g of [lado, fondo, aro, franja]) for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(a)) g.deleteAttribute(a);
      const m = new THREE.Mesh(mergeGeometries([lado, fondo, aro, franja]), mb({ vertexColors: true, side: THREE.DoubleSide }));
      return m;
    })();
    grupo.add(cubilete);
    const ponerCubileteEnCasa = () => { W(CASA, cubilete.position).y += CUB_H; cubilete.quaternion.copy(qBase); };
    ponerCubileteEnCasa();
    const bocaAbajo = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI);

    // ---------- los dados: textura con las seis caras, física de esferas de ctx.fisica ----------
    const texDado = (() => {
      const { g, t } = lienzo(768, 128);
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
      CARA.forEach((n, i) => {
        const x0 = i * 128;
        g.fillStyle = TINTA; g.fillRect(x0, 0, 128, 128);
        g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(x0 + 7, 7, 114, 114, 18); g.fill();
        g.fillStyle = n === 1 ? '#e8364f' : TINTA;
        for (const [dx, dy] of P[n]) { g.beginPath(); g.arc(x0 + 64 + dx * 30, 64 + dy * 30, n === 1 ? 17 : 12, 0, 7); g.fill(); }
      });
      return t;
    })();
    const geoDado = (() => {
      const geo = new THREE.BoxGeometry(LADO_DADO, LADO_DADO, LADO_DADO), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (Math.floor(k / 4) + uv.getX(k)) / 6);
      return geo;
    })();
    const matDado = mb({ map: texDado });
    const dados = [0, 1].map(i => {
      const m = new THREE.Mesh(geoDado, matDado); grupo.add(m);
      const c = fisica.anadir(m, { radio: R_DADO, rebote: 0.35, roce: 0.6, cogible: false, datos: { dado: i } });
      c.dormido = true;
      return { m, c, quieto: 0, valor: 1, rueda: false };
    });
    const offDentro = [V(-0.017, -CUB_H + R_DADO + 0.002, 0.004), V(0.016, -CUB_H + R_DADO + 0.002, -0.006)];
    const _a = V(), _b = V(), _n = V(), _qa = new THREE.Quaternion();
    // los dados dentro del cubilete (de pie): siguen al cubilete; al agitar, bailan
    function dadosDentro(baile = 0) {
      dados.forEach((d, i) => {
        d.c.dormido = true; d.c.vel.set(0, 0, 0); d.rueda = false;
        _a.copy(offDentro[i]);
        if (baile > 0) _a.add(_b.set((Math.random() - 0.5) * 0.02, Math.random() * 0.03 * baile, (Math.random() - 0.5) * 0.02));
        d.m.position.copy(cubilete.localToWorld(_a));
        if (baile > 0) d.m.quaternion.multiply(_qa.setFromEuler(new THREE.Euler(Math.random() * baile, Math.random() * baile, 0)));
      });
    }
    function valorDe(d) {
      let mejor = 0, my = -2;
      NORMALES.forEach((n, i) => { _n.set(...n).applyQuaternion(d.m.quaternion); if (_n.y > my) { my = _n.y; mejor = i; } });
      return { cara: mejor, valor: CARA[mejor] };
    }
    // deja el dado plano con la cara de arriba (sin cambiar cuál es)
    function asentar(d) {
      const { cara, valor } = valorDe(d);
      _n.set(...NORMALES[cara]).applyQuaternion(d.m.quaternion);
      d.m.quaternion.premultiply(_qa.setFromUnitVectors(_n.normalize(), V(0, 1, 0)));
      d.m.position.y = TOPE + LADO_DADO / 2;
      d.c.dormido = true; d.c.vel.set(0, 0, 0); d.c.giro.set(0, 0, 0); d.rueda = false; d.valor = valor;
    }

    // ---------- las fichas: «Me lo creo» y «¡Farol!» ----------
    function ficha(texto, color, x) {
      const { g, t } = lienzo(256, 256);
      g.fillStyle = TINTA; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(128, 128, 116, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.setLineDash([14, 10]); g.beginPath(); g.arc(128, 128, 98, 0, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '50px Caprasimo, serif';
      const l = texto.split('\n'); l.forEach((s, i) => { g.lineWidth = 10; g.strokeStyle = TINTA; g.strokeText(s, 128, 128 + (i - (l.length - 1) / 2) * 56); g.fillText(s, 128, 128 + (i - (l.length - 1) / 2) * 56); });
      const geo = new THREE.CylinderGeometry(0.058, 0.058, 0.018, 32);
      geo.rotateY(Math.PI / 2); // el texto de la tapa, derecho hacia ti
      const { geo: g1, mat } = unaMalla(geo, [mb({ color: new THREE.Color(color).multiplyScalar(0.7) }), mb({ map: t }), mb({ color: TINTA })]);
      const m = new THREE.Mesh(g1, mat);
      const local = V(x, 0.009, -0.3);
      m.position.copy(W(local)); m.quaternion.copy(qBase);
      // un pelín inclinada hacia ti para leerla
      m.quaternion.multiply(_qa.setFromAxisAngle(V(1, 0, 0), 0.35));
      grupo.add(m);
      return { m, local, baja: 0, texto };
    }
    const fCreo = ficha('Me lo\ncreo', '#3d9a4a', -0.2), fFarol = ficha('¡Farol!', '#e0457b', 0.2);

    // ---------- Palicaso, al otro lado de la barra ----------
    const palicaso = await ctx.Recortable.crear('palicaso', 'humo').catch(e => { console.warn('farol: sin Palicaso', e); return null; });
    const CARA_P = V(0, 0.3, -0.85);
    if (palicaso) {
      palicaso.canto1.visible = palicaso.canto2.visible = false; palicaso.enAsiento = true; palicaso.sombra.visible = false;
      palicaso.grupo.position.set(0, 0.3 - (palicaso.alto ?? 1.05) * 0.8, -0.85);
      base.add(palicaso.grupo);
    }
    const posar = p => { if (palicaso && palicaso.poseActual !== p) palicaso.pose(p); };
    const decir = (t, dur) => palicaso?.decir(t, dur ? { dur } : {});
    const texGota = await ctx.img('fx-gota-sudor.png').catch(() => null);
    const gota = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), mb({ map: texGota, color: texGota ? '#ffffff' : '#8fd3ff', transparent: true, opacity: 0, depthWrite: false }));
    gota.renderOrder = 25; gota.visible = false; base.add(gota);
    const frasesCerca = baraja(['¿Qué miras?', 'Escucha, no te acerques tanto.', 'Tengo cara de decir la verdad. Mírala.', 'Uy, qué cerca. ¿Me has visto algo?']);

    // ---------- el marcador: un cartelito de pie en la barra ----------
    const marc = lienzo(512, 256);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), mb({ map: marc.t }));
    cartel.position.copy(W(V(-0.46, 0.13, -0.5))); grupo.add(cartel); cartel.lookAt(cab0);
    function pintar() {
      const { g, t } = marc;
      g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#23302a'; g.fillRect(12, 12, 488, 232);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#f3ecd8'; g.font = '40px Caprasimo, serif'; g.fillText(`Mano ${Math.max(1, E.mano)} de ${MANOS}`, 30, 52);
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.font = '56px Caprasimo, serif'; g.fillText(String(E.puntos), 482, 56);
      g.textAlign = 'left'; g.font = '44px Caprasimo, serif';
      if (E.fase === 'decide' || E.fase === 'destapa') { g.fillStyle = '#ff9ac4'; g.fillText(`Canta: ${E.canta}`, 30, 130); }
      else { g.fillStyle = '#9fe3a8'; g.font = '34px Caprasimo, serif'; g.fillText(E.racha > 1 ? `Racha x${Math.min(E.racha, 5)}` : (E.fase === 'tira' ? 'Agita y vuelca' : ''), 30, 130); }
      for (let i = 0; i < 3; i++) {
        const x = 48 + i * 54, y = 200, r = 21;
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.closePath(); g.fillStyle = i < E.vidas ? '#ffd23f' : '#3d3350'; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke();
      }
      if (E.racha > 1 && (E.fase === 'decide' || E.fase === 'destapa')) { g.textAlign = 'right'; g.fillStyle = '#9fe3a8'; g.font = '34px Caprasimo, serif'; g.fillText(`x${Math.min(E.racha, 5)}`, 482, 200); }
      t.needsUpdate = true; sucio = false;
    }

    // ---------- textos que saltan ----------
    const saltos = [];
    function saltaTexto(texto, color, posMundo, tam = 0.09) {
      const ancho = texto.length > 12 ? 1024 : 512, { g, t } = lienzo(ancho, 160);
      let px = 84; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > ancho - 40 && px > 40) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText(texto, ancho / 2, 84); g.fillStyle = color; g.fillText(texto, ancho / 2, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam * ancho / 512, tam * 160 / 512), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(posMundo); grupo.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- coger, agitar y volcar el cubilete ----------
    let coge = null; const offP = V(), offQ = new THREE.Quaternion();
    const manos = () => [xr.manos.derecha, xr.manos.izquierda].filter(Boolean);
    const centroCubilete = (out = V()) => out.set(0, -CUB_H / 2, 0).applyMatrix4(cubilete.matrixWorld);
    function intentarCoger(m) {
      cubilete.updateMatrixWorld();
      if (centroCubilete(_b).distanceTo(m.punta) > 0.1) return false;
      coge = m;
      const iq = m.quat.clone().invert();
      offP.copy(cubilete.position).sub(m.punta).applyQuaternion(iq);
      offQ.copy(iq).multiply(cubilete.quaternion);
      m.vibrar?.(0.4, 30); sonido('lata', { volumen: 0.25, tono: 1.6 });
      return true;
    }
    function nuevaMano() {
      if (acabado) return;
      if (E.vidas <= 0 || E.mano >= MANOS) return final();
      E.mano++; E.fase = 'tira'; E.quienTira = null; sucio = true; agitado = 0; tEspera = 0; vozCerca = false;
      ponerCubileteEnCasa(); cubilete.updateMatrixWorld(); dadosDentro();
      gota.visible = false; posar('base');
      if (E.mano === 1) {
        ui.instruccion('Coge el cubilete, agítalo y vuélcalo en la barra');
        const c = W(CASA.clone().add(V(0, CUB_H * 0.6, 0))), arr = c.clone().add(V(0, 0.12, 0.02));
        fx.demo([{ p: c.clone().add(V(0, 0.05, 0.05)) }, { p: c, puno: true }, { p: arr, puno: true }, { p: arr.clone().add(V(0.06, 0, 0)), puno: true }, { p: arr.clone().add(V(-0.06, 0, 0)), puno: true }, { p: arr.clone().add(V(0.06, 0, 0)), puno: true }, { p: W(CENTRO).add(V(0, 0.12, 0)), puno: true }, { p: W(CENTRO).add(V(0, 0.16, 0.04)) }], { dur: 3.4, tramo: 0.38 });
      }
    }
    function volcar(enLocal, quien) {
      coge = null; E.quienTira = quien; E.fase = 'rueda'; sucio = true;
      ui.instruccion(null);
      const p = enLocal.clone().setY(0);
      const off = p.clone().sub(CENTRO); if (off.length() > 0.1) p.copy(CENTRO).addScaledVector(off.normalize(), 0.1);
      E.puntoCub = p.clone();
      const desde = cubilete.position.clone(), qDesde = cubilete.quaternion.clone(), qHasta = qBase.clone().multiply(bocaAbajo);
      const hasta = W(p);
      // los dados salen rodando desde donde estaban, ya debajo
      dados.forEach((d, i) => {
        d.m.position.copy(W(p.clone().add(V(i ? 0.016 : -0.016, LADO_DADO, (Math.random() - 0.5) * 0.02))));
        const a = Math.random() * Math.PI * 2, v = 0.25 + Math.random() * 0.2;
        fisica.lanzar(d.c, V(Math.cos(a) * v, -0.4, Math.sin(a) * v), V((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50));
        d.rueda = true; d.quieto = 0; d.t = 0;
      });
      animar(0.12, k => { cubilete.position.lerpVectors(desde, hasta, k); cubilete.quaternion.slerpQuaternions(qDesde, qHasta, k); }, () => {
        sonido('golpe', { volumen: 0.6, tono: 1.2, en: hasta }); sonido('toc-toc', { volumen: 0.3, tono: 1.5 });
        for (const m of manos()) m.vibrar?.(0.8, 70);
        fx.chispas(hasta.clone().add(V(0, 0.01, 0)), '#f3e6c8', 10, 0.6);
      });
      if (quien === 'tu') decir(azar(['¡Eso es tirar!', 'Uy, qué muñeca.', 'Escucha cómo suenan. Eso es buena suerte. Para mí.']));
    }
    // Palicaso tira si tardas
    function tiraEl() {
      E.fase = 'tiraEl'; decir('Trae, que tiro yo.');
      const desde = cubilete.position.clone(), arriba = desde.clone().add(V(0, 0.12, 0));
      animar(0.3, k => cubilete.position.lerpVectors(desde, arriba, k), () => {
        let n = 0;
        animar(0.7, k => {
          cubilete.position.copy(arriba).add(V(Math.sin(k * 40) * 0.035, Math.abs(Math.sin(k * 25)) * 0.02, 0));
          cubilete.updateMatrixWorld(); dadosDentro(1);
          if (Math.floor(k * 8) > n) { n = Math.floor(k * 8); sonido('toc-toc', { volumen: 0.25, tono: 1.4 + Math.random() * 0.6 }); }
        }, () => volcar(CENTRO.clone(), 'el'));
      });
    }

    // ---------- cantar y decidir ----------
    function mira() {
      E.fase = 'mira'; sucio = true;
      E.d = dados.map(d => d.valor);
      posar('espiando');
      sonido('papel', { volumen: 0.3, tono: 0.8 });
      // levanta un poco el cubilete por su lado (tú no lo ves)
      const q0 = cubilete.quaternion.clone(), q1 = q0.clone().multiply(_qa.setFromAxisAngle(V(1, 0, 0), 0.32));
      animar(0.9, k => cubilete.quaternion.slerpQuaternions(q0, q1, Math.sin(k * Math.PI)), () => cubilete.quaternion.copy(q0));
      luego(1.0, cantar);
    }
    function cantar() {
      if (acabado) return;
      const suma = E.d[0] + E.d[1];
      const miente = E.forzarMiente ?? Math.random() < 0.5; E.forzarMiente = undefined;
      let canta = suma;
      if (miente) { do { canta = 2 + Math.floor(Math.random() * 11); } while (canta === suma); }
      E.miente = miente; E.canta = canta;
      const dificil = E.mano > (nivel >= 3 ? 3 : MANOS / 2);
      const lista = miente ? (dificil && Math.random() < 0.5 ? FRASES.mentiraCorta : FRASES.mentiraLarga)
        : (dificil && Math.random() < 0.4 ? FRASES.verdadLarga : FRASES.verdadCorta);
      decir(azar(lista).replaceAll('{n}', canta), 60);
      // el cuerpo habla, pero solo se le ve de cerca: de lejos, cara de póker
      const menos = nivel >= 5 ? 0.8 : 1;
      E.tell = { pose: miente && Math.random() < (dificil ? 0.55 : 0.8) * menos, gota: miente && Math.random() < (dificil ? 0.5 : 0.75) * menos };
      if (E.forzarTell) { E.tell = { pose: E.miente, gota: E.miente }; E.forzarTell = false; }
      posar('contando');
      E.fase = 'decide'; t0 = reloj; sucio = true; cercaAntes = false;
      if (E.mano === 1) {
        ui.instruccion('Acércate a mirarle la cara… y toca una ficha');
        luego(5, () => { if (E.mano === 1) ui.instruccion(null); });
        fx.demo([{ p: W(V(-0.2, 0.1, -0.22)) }, { p: W(fCreo.local).add(V(0, 0.02, 0)) }, { p: W(V(0.2, 0.1, -0.22)) }, { p: W(fFarol.local).add(V(0, 0.02, 0)) }], { dur: 2.6, tramo: 0.55, retraso: 1.2, flecha: false });
      }
    }
    function decidir(creo, como = 'ficha') {
      if (E.fase !== 'decide') return;
      E.fase = 'destapa'; sucio = true; ui.instruccion(null);
      const acierto = creo !== E.miente, rapido = reloj - t0 < 5 ? 50 : 0;
      palicaso?.callar(); gota.visible = false;
      // se levanta el cubilete
      const desde = cubilete.position.clone(), q0 = cubilete.quaternion.clone();
      const arriba = desde.clone().add(W(V(0.13, 0.09, -0.02)).sub(base.position));
      const q1 = q0.clone().multiply(_qa.setFromAxisAngle(V(1, 0, 0), -0.6));
      sonido('fup', { volumen: 0.4 });
      animar(0.3, k => { const e = 1 - (1 - k) * (1 - k); cubilete.position.lerpVectors(desde, arriba, e); cubilete.quaternion.slerpQuaternions(q0, q1, e); });
      const suma = E.d[0] + E.d[1], sobre = W(E.puntoCub.clone().add(V(0, 0.12, 0)));
      luego(0.45, () => {
        saltaTexto(`${E.d[0]} + ${E.d[1]} = ${suma}`, '#fffaf0', sobre.clone(), 0.13);
        if (acierto) {
          E.racha++; E.aciertos++;
          const gana = (100 + rapido) * Math.min(E.racha, 5);
          E.puntos += gana;
          fx.acierto(sobre, { mano: E.manoDecide, racha: E.racha, fuerte: E.racha >= 3, sonido: E.racha >= 3 ? 'platillo' : 'campanita' });
          saltaTexto(`+${gana}`, '#ffd23f', sobre.clone().add(V(0, 0.07, 0)), 0.11);
          posar(E.miente ? 'sorprendido' : 'base');
          decir(E.miente ? azar(['¡Me has pillado! ¿Tanto se me nota?', '¡Escucha! Eso ha sido suerte.', 'Vale, vale… sí. Era un farol.']) : azar(['¿Ves? Cuando digo la verdad, la digo.', 'Verdad verdadera.']), 1.8);
        } else {
          E.racha = 0; E.vidas--;
          sonido('rimshot', { volumen: 0.5 });
          fx.fallo(sobre, { mano: E.manoDecide });
          for (const m of manos()) m.vibrar?.(0.5, 90);
          posar('riendo');
          decir(E.miente ? `¡JA! ¡Te lo has creído! Escucha, escucha: era un ${suma}.` : '¿Farol? ¡Era verdad! A veces digo la verdad, ¿eh?', 1.8);
        }
        E.resultados.push({ mano: E.mano, miente: E.miente, creo, acierto, como, quien: E.quienTira });
        sucio = true;
        luego(1.9, recoger);
      });
    }
    // los dados vuelven al cubilete y el cubilete a su sitio
    function recoger() {
      if (acabado) return;
      const desde = cubilete.position.clone(), q0 = cubilete.quaternion.clone();
      ponerCubileteEnCasa(); const hasta = cubilete.position.clone(), q1 = cubilete.quaternion.clone();
      cubilete.position.copy(desde); cubilete.quaternion.copy(q0);
      const dd = dados.map(d => d.m.position.clone());
      sonido('toc-toc', { volumen: 0.25, tono: 1.3 });
      animar(0.4, k => {
        cubilete.position.lerpVectors(desde, hasta, k); cubilete.quaternion.slerpQuaternions(q0, q1, k);
        cubilete.updateMatrixWorld();
        dados.forEach((d, i) => d.m.position.lerpVectors(dd[i], cubilete.localToWorld(_a.copy(offDentro[i])), k).add(_b.set(0, Math.sin(k * Math.PI) * 0.08, 0)));
      }, () => { posar('base'); luego(0.2, nuevaMano); });
    }

    function final() {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; sucio = true; ui.instruccion(null);
      const gana = E.vidas > 0 && E.puntos >= 900;
      posar(gana ? 'sorprendido' : 'riendo');
      decir(gana ? 'Vale, vale. Te devuelvo las fichas. Y algo de dignidad.' : 'Me quedo con todo. Y te lo voy a contar. Escucha…');
      luego(1.4, () => ctx.terminar({
        puntos: E.puntos, gana,
        linea: gana ? 'Palicaso devuelve las fichas, y algo de dignidad.' : 'Palicaso se queda con todo. Y te lo cuenta.',
      }));
    }

    // ---------- arranque ----------
    pintar(); dadosDentro();
    ctx.musica?.('apuestas');
    luego(0.5, () => decir('¡Escucha! Dados. Tú tiras, yo miro y canto lo que sale. Si me pillas, devuelvo lo de la caja. Bueno, parte.', 4.2));
    luego(1.2, nuevaMano);

    const api = {
      E, dados, cubilete, get fase() { return E.fase; },
      fichaCreo: () => fCreo.m.position.clone(), fichaFarol: () => fFarol.m.position.clone(),
      centroCubilete: () => centroCubilete(), caraPalicaso: () => W(CARA_P), centroBarra: () => W(CENTRO),
      gota: () => (gota.visible ? gota.material.opacity : 0),
    };
    grupo.userData.api = api;

    const _l = V(), _c = V();
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
        // --- tirar: coger, agitar y volcar ---
        if (E.fase === 'tira') {
          tEspera += dt;
          if (coge) {
            if (!coge.activa) { coge = null; ponerCubileteEnCasa(); dadosDentro(); }
            else {
              cubilete.position.copy(coge.punta).add(_a.copy(offP).applyQuaternion(coge.quat));
              cubilete.quaternion.copy(coge.quat).multiply(offQ);
              cubilete.updateMatrixWorld();
              const v = coge.vel.length();
              if (v > 0.35) agitado += v * dt;
              tRuido -= dt;
              if (v > 0.5 && tRuido <= 0) { tRuido = 0.09 + Math.random() * 0.06; sonido('toc-toc', { volumen: Math.min(0.45, 0.12 + v * 0.1), tono: 1.3 + Math.random() * 0.7 }); coge.vibrar?.(0.25, 20); }
              dadosDentro(Math.min(1, v));
              const boca = _b.set(0, 1, 0).applyQuaternion(cubilete.quaternion);
              L(cubilete.position, _l);
              const suelta = !(coge.pinza || coge.agarre);
              if (boca.y < -0.5 && _l.y < 0.17) volcar(_l, 'tu');                   // le das la vuelta contra la barra
              else if (suelta && agitado >= 0.35) volcar(_l, 'tu');                // o lo sueltas después de agitar
              else if (suelta) {
                coge = null; ponerCubileteEnCasa(); dadosDentro();
                decir(azar(['¡Agítalo, hombre! Que suenen.', 'Escucha: así no vale. Agita.']), 2);
              }
            }
          } else {
            for (const m of manos()) if (m.activa && (m.empiezaPinza || m.empiezaAgarre) && intentarCoger(m)) break;
            if (!coge && tEspera > (E.mano === 1 ? 14 : 9)) tiraEl();
          }
        }
        // --- los dados ruedan debajo del cubilete (física de ctx.fisica + la barra y la pared del cubilete aquí) ---
        if (E.fase === 'rueda') {
          let todos = true;
          const cen = W(E.puntoCub, _c), rMax = CUB_R * 0.86 - R_DADO;
          for (const d of dados) {
            if (!d.rueda) continue;
            d.t += dt;
            const p = d.m.position, c = d.c;
            if (p.y < TOPE + R_DADO) {
              p.y = TOPE + R_DADO;
              if (c.vel.y < 0) { const f = -c.vel.y; c.vel.y = f > 0.3 ? f * 0.3 : 0; if (f > 0.3) sonido('toc-toc', { volumen: 0.12, tono: 1.8 }); }
              const k = Math.max(0, 1 - dt * 5); c.vel.x *= k; c.vel.z *= k; c.giro.multiplyScalar(Math.max(0, 1 - dt * 4));
            }
            _a.subVectors(p, cen).setY(0);
            if (_a.length() > rMax) { _a.normalize(); p.x = cen.x + _a.x * rMax; p.z = cen.z + _a.z * rMax; const vn = c.vel.x * _a.x + c.vel.z * _a.z; if (vn > 0) { c.vel.x -= 1.6 * vn * _a.x; c.vel.z -= 1.6 * vn * _a.z; } }
            if (p.y > TOPE + CUB_H - R_DADO) { p.y = TOPE + CUB_H - R_DADO; if (c.vel.y > 0) c.vel.y *= -0.3; }
            d.quieto = Math.hypot(c.vel.x, c.vel.z) < 0.03 && p.y < TOPE + R_DADO + 0.002 ? d.quieto + dt : 0;
            if (d.quieto > 0.25 || d.t > 1.6) asentar(d);
            else todos = false;
          }
          if (todos) mira();
        }
        // --- decidir: tocar una ficha o levantarle el cubilete; y mirarle la cara ---
        if (E.fase === 'decide') {
          for (const m of manos()) {
            if (!m.activa) continue;
            for (const f of [fCreo, fFarol]) if (f.m.position.distanceTo(m.punta) < 0.07) { E.manoDecide = m; f.baja = 1; m.vibrar?.(0.6, 40); sonido('pop', { volumen: 0.5 }); decidir(f === fCreo); break; }
            if (E.fase !== 'decide') break;
            if ((m.empiezaPinza || m.empiezaAgarre) && centroCubilete(_b).distanceTo(m.punta) < 0.1) { E.manoDecide = m; m.vibrar?.(0.5, 40); decidir(false, 'cubilete'); break; }
          }
          // la distancia de tu cabeza a su cara: de lejos, cara de póker; de cerca, se le escapa
          const dist = xr.cabeza.distanceTo(W(CARA_P, _c));
          const k = THREE.MathUtils.clamp((LEJOS - dist) / (LEJOS - CERCA), 0, 1);
          const cerca = cercaAntes ? k > 0.3 : k > 0.6;
          if (cerca && !cercaAntes) {
            if (!vozCerca && Math.random() < 0.35 && reloj - t0 > 1.5) { vozCerca = true; luego(0.6, () => { if (E.fase === 'decide') { decir(frasesCerca(), 1.8); luego(1.9, () => { if (E.fase === 'decide') decir(`${E.canta}. Lo he dicho.`, 60); }); } }); }
          }
          cercaAntes = cerca;
          posar(E.tell.pose && cerca ? 'riendo' : 'contando');
          gota.visible = E.tell.gota && k > 0.05;
          if (gota.visible) {
            gota.material.opacity = k;
            gota.position.set(0.11, CARA_P.y + 0.1 - ((reloj * 0.05) % 0.06), CARA_P.z + 0.06);
            gota.lookAt(xr.cabeza);
          }
        }
        for (const f of [fCreo, fFarol]) {
          f.baja = Math.max(0, f.baja - dt * 3);
          f.m.position.copy(W(_a.copy(f.local).add(_b.set(0, -f.baja * 0.008 + (E.fase === 'decide' ? Math.max(0, Math.sin(reloj * 4 + f.local.x * 10)) * 0.006 : 0), 0))));
        }
        if (sucio) pintar();
        if (palicaso) palicaso.actualizar(dt, xr.cabeza);
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.06; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (1.6 - s.t));
          if (s.t > 1.6) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; ui.instruccion(null); coge = null;
        decir('¿Te vas? Pues me quedo con la caja. Y con la historia.');
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Te levantas en la mano ${E.mano}. Palicaso se queda con todo.` });
      },
      destruir() {
        acabado = true; tareas.length = 0; anims.length = 0; coge = null;
        fx.destruir();
        for (const d of dados) fisica.quitar(d.c);
        ui.instruccion(null);
        palicaso?.callar();
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const t of texturas) t.dispose();
      },
    };
  },
};
