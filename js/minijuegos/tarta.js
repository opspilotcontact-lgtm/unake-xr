// La tarta entera (Cotine) en VR nativo, escala «inmersivo»: la cocina de Cotine (bg-cocina en panorama).
// Reglas de base/js/escenas/tarta.js:
//   · Llevas el PLATO en la mano (sigue a tu mano, siempre plano). Caen cosas del humo del techo:
//     - los pisos de la tarta: se atrapan en el orden de la receta (el cartel de enfrente) y se acaba con la guinda;
//     - patatas: son para Cotine. Las atrapas con el plato (o tocándolas con la otra mano) y se las llevas A LA BOCA;
//     - colillas: ensucian la tarta (se pierde el piso de arriba) y quitan una vida.
//   · El hambre de Cotine sube sola; si llega arriba, se come el piso de arriba delante de todos y pierdes una vida.
//   · Cada tarta servida da 100 por piso (+150 si va entera) y la siguiente es más alta. Con el tiempo todo cae
//     más deprisa y hay más colillas; con nivel 3+ hay viento (la ventana abierta); con 5+, más colillas.
//   · Se acaba al perder las tres vidas; ganas si has servido al menos una tarta.
// Cambiar el plato de mano: pellizco o puño con la otra mano junto al plato.
import * as THREE from 'three';
import { Jugo } from './jugo.js';

const TINTA = '#140c1c';
const H_PISO = 0.042, R_PISO = 0.1;            // pisos (metros)
const R_PLATO = 0.13;
const INGR = {
  bizcocho: { nombre: 'bizcocho', color: '#c98a4b' },
  nata: { nombre: 'nata', color: '#fff6e8' },
  fresa: { nombre: 'fresa', color: '#ff7eb0' },
  choco: { nombre: 'chocolate', color: '#6b3b22' },
  guinda: { nombre: 'guinda', color: '#d81e3a' },
};
const PISOS = ['bizcocho', 'nata', 'fresa', 'choco'];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const azar = (a, b) => a + Math.random() * (b - a);
const elige = l => l[Math.floor(Math.random() * l.length)];
function baraja(lista) {
  let mazo = [];
  return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); };
}
function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

// muchas mallas iguales en UNA llamada de dibujo (y su contorno de tinta en otra)
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _col = new THREE.Color();
class Lote {
  constructor(geo, mat, max, padre, tinta = 0) {
    this.max = max; this.n = 0; this.tinta = tinta;
    this.m = new THREE.InstancedMesh(geo, mat, max); this.m.setColorAt(0, _col.set('#ffffff'));
    this.m.count = 0; this.m.frustumCulled = false; padre.add(this.m);
    if (tinta) {
      this.t = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }), max);
      this.t.count = 0; this.t.frustumCulled = false; padre.add(this.t);
    }
  }
  empezar() { this.n = 0; }
  poner(p, q, s, color = '#ffffff') {
    if (this.n >= this.max) return;
    this.m.setMatrixAt(this.n, _m4.compose(p, q, s)); this.m.setColorAt(this.n, _col.set(color));
    if (this.t) this.t.setMatrixAt(this.n, _m4.compose(p, q, _s.set(s.x + this.tinta, s.y + this.tinta, s.z + this.tinta)));
    this.n++;
  }
  acabar() {
    this.m.count = this.n; this.m.instanceMatrix.needsUpdate = true; if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true;
    if (this.t) { this.t.count = this.n; this.t.instanceMatrix.needsUpdate = true; }
  }
  quitar() { this.m.geometry.dispose(); this.m.material.dispose(); this.m.dispose(); if (this.t) { this.t.material.dispose(); this.t.dispose(); } }
}

export default {
  clave: 'Tarta', titulo: 'La tarta entera', escala: 'inmersivo', umbrales: [300, 900, 1800],
  ayudas: {
    gatillo: 'Junto al plato: cambiarlo de mano', lateral: 'Junto al plato: cambiarlo de mano',
    mano: { pellizco: 'Junto al plato: cambiarlo de mano', puno: 'Junto al plato: cambiarlo de mano' },
  },

  async crear(ctx) {
    const { xr, ui, sonido, humo } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-tarta';
    const nivel = ctx.nivel ?? 1;
    const fx = new Jugo(ctx, grupo);
    const propias = [];

    // ---------- estado de la partida (todo se reinicia aquí: «Otra vez» llama a crear de nuevo) ----------
    const E = {
      fase: 'intro', activo: false, puntos: 0, vidas: 3, hambre: 10, servidas: 0, tiempo: 0,
      pasos: [], hecho: 0, sinBocados: true, pila: [], patatasPlato: 0, patatasMano: 0, viento: 0, comidas: 0,
    };
    let reloj = 0, acabado = false, destruido = false, proximo = 1.0, tViento = 0, avisoPatatas = false, tHambreVoz = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // ---------- dónde: la cocina mira hacia donde miras, con el suelo en tu suelo ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const sala = new THREE.Group(); sala.name = 'cocina-tarta';
    sala.position.copy(xr.cabeza).setY(0); sala.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(sala); sala.updateMatrixWorld(true);
    const inv = sala.matrixWorld.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(sala.matrixWorld);
    const alto0 = clamp(xr.cabeza.y, 1.0, 1.9);   // tu cabeza al empezar (de pie o sentado)
    const Y_CAE = alto0 + 0.28;                    // de dónde salen las cosas (sin tener que mirar al techo)
    const ZONA = { x0: -0.08, x1: 0.42, z0: -0.34, z1: -0.58 };
    const REPOSO = V(0.16, alto0 - 0.45, -0.32);   // el plato, si no hay mano

    // ---------- arte ----------
    const pr = n => ctx.img(n).catch(e => { console.warn('tarta: falta', n, e); return null; });
    const [texCocina, texPatatas, texColilla, cotine] = await Promise.all([
      pr('bg-cocina.jpg'), pr('patatas.png'), pr('colilla.png'),
      ctx.Recortable.crear('cotine', 'humo', { escala: 0.85 }).catch(e => { console.warn('tarta: sin Cotine', e); return null; }),
    ]);
    if (destruido) return { grupo, actualizar() { }, destruir() { }, abandonar() { } };

    // la cocina: cielo oscuro, el dibujo de la cocina en panorama y un suelo de baldosas
    const fondoOsc = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 8), new THREE.MeshBasicMaterial({ color: '#2a1d22', side: THREE.BackSide }));
    sala.add(fondoOsc); propias.push(fondoOsc.geometry, fondoOsc.material);
    if (texCocina) {
      const tf = texCocina.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(2, 1); tf.offset.x = -0.5; tf.needsUpdate = true; propias.push(tf);
      const pano = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5.2, 48, 1, true, Math.PI - 1.6, 3.2), new THREE.MeshBasicMaterial({ color: '#d8ccc4', map: tf, side: THREE.BackSide }));
      pano.position.y = 2.1; sala.add(pano); propias.push(pano.geometry, pano.material);
    }
    const baldosas = (() => {
      const { g, t } = lienzo(128, 128);
      g.fillStyle = '#d9cbb0'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#b7a58a'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
      g.fillStyle = 'rgba(20,12,28,.35)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128); g.fillRect(0, 63, 128, 2); g.fillRect(63, 0, 2, 128);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); t.needsUpdate = true; return t;
    })();
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshBasicMaterial({ color: '#cfc2b4', map: baldosas }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.002; sala.add(suelo); propias.push(suelo.geometry, suelo.material, baldosas);

    // la encimera de Cotine, a tu izquierda y a mano: Cotine está de pie encima (su boca, a la altura de tu barbilla)
    const hEnc = Math.max(0.4, alto0 - 0.7);
    const POS_COT = V(-0.42, hEnc, -0.64);
    const encimera = new THREE.Mesh(new THREE.BoxGeometry(0.52, hEnc, 0.46), new THREE.MeshBasicMaterial({ color: '#cdb48d' }));
    encimera.position.set(POS_COT.x, hEnc / 2, POS_COT.z - 0.02); sala.add(encimera);
    const encB = new THREE.Mesh(encimera.geometry, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide }));
    encB.scale.setScalar(1.04); encimera.add(encB);
    propias.push(encimera.geometry, encimera.material, encB.material);
    if (cotine) { cotine.grupo.position.copy(POS_COT); sala.add(cotine.grupo); }
    let vozLibre = 0;
    const decir = (t, prob = 1) => { if (!cotine || Math.random() > prob || reloj < vozLibre) return; vozLibre = reloj + 1.6; cotine.decir(t); };
    const _boca = V();
    const bocaLocal = () => cotine ? aLocal(cotine.bocaMundo(_boca), _boca) : _boca.set(POS_COT.x, hEnc + 0.5, POS_COT.z);

    // el plato (siempre plano; sigue a tu mano)
    const plato = new THREE.Group(); sala.add(plato);
    {
      const geo = new THREE.CylinderGeometry(R_PLATO, R_PLATO * 0.75, 0.016, 28);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#fffaf0' }));
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide })); b.scale.set(1.05, 1.35, 1.05);
      plato.add(b, m); propias.push(geo, m.material, b.material);
    }
    plato.position.copy(REPOSO);

    // lo que cae, la pila y la tarta que sale volando: lotes instanciados (pocas llamadas de dibujo)
    const texPiso = (() => {
      // costado del piso: crema arriba, cuerpo y una raya de tinta abajo (el color lo pone cada instancia)
      const { g, t } = lienzo(64, 64);
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#d6d0cc'; g.fillRect(0, 14, 64, 44);
      g.fillStyle = '#fffaf2'; for (let x = 0; x < 64; x += 16) { g.beginPath(); g.arc(x + 8, 14, 7, 0, Math.PI); g.fill(); }
      g.fillStyle = '#7d7470'; g.fillRect(0, 58, 64, 6);
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); t.needsUpdate = true; return t;
    })();
    propias.push(texPiso);
    const pisos = new Lote(new THREE.CylinderGeometry(1, 1, 1, 22), new THREE.MeshBasicMaterial({ map: texPiso }), 64, sala, 0.008);
    const guindas = new Lote(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 12, sala, 0.006);
    const planoGeo = new THREE.PlaneGeometry(1, 1);
    const patatas = new Lote(planoGeo, new THREE.MeshBasicMaterial({ map: texPatatas, alphaTest: 0.5, side: THREE.DoubleSide }), 20, sala);
    const colillas = new Lote(planoGeo.clone(), new THREE.MeshBasicMaterial({ map: texColilla, alphaTest: 0.5, side: THREE.DoubleSide }), 14, sala);
    const sombras = new Lote(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: TINTA, transparent: true, opacity: 0.28, depthWrite: false }), 24, sala);
    sombras.m.renderOrder = 3;
    const lotes = [pisos, guindas, patatas, colillas, sombras];
    const aspecto = t => t?.image ? t.image.height / t.image.width : 1;
    const ASP_PAT = aspecto(texPatatas), ASP_COL = aspecto(texColilla);

    // ---------- el cartel: receta, puntos, tartas y vidas (enfrente, por encima de lo que cae) ----------
    const cart = lienzo(1024, 300); propias.push(cart.t);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96 * 300 / 1024), new THREE.MeshBasicMaterial({ map: cart.t, transparent: true, depthWrite: false }));
    cartel.position.set(0.12, alto0 + 0.5, -1.3); cartel.lookAt(V(0, alto0, 0)); cartel.renderOrder = 4; sala.add(cartel);
    propias.push(cartel.geometry, cartel.material);
    let claveCartel = '';
    function pintarCartel() {
      const clave = [E.pasos.join(), E.hecho, E.puntos, E.servidas, E.vidas].join('|');
      if (clave === claveCartel) return; claveCartel = clave;
      const { g, c, t } = cart;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.84)'; g.beginPath(); g.roundRect(6, 6, 1012, 288, 34); g.fill();
      g.strokeStyle = '#ffe066'; g.lineWidth = 6; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '40px Caprasimo, serif'; g.fillStyle = '#fff3c4'; g.fillText('Receta', 34, 52);
      // los pisos de la receta, de abajo (izquierda) a arriba (derecha)
      const n = E.pasos.length, paso = Math.min(110, 640 / Math.max(1, n));
      E.pasos.forEach((k, i) => {
        const x = 70 + i * paso, y = 150;
        g.globalAlpha = i < E.hecho ? 0.3 : 1;
        if (k === 'guinda') {
          g.fillStyle = INGR.guinda.color; g.beginPath(); g.arc(x, y + 6, 26, 0, 7); g.fill();
          g.strokeStyle = TINTA; g.lineWidth = 6; g.stroke();
          g.strokeStyle = '#3f7a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y - 18); g.quadraticCurveTo(x + 8, y - 36, x + 18, y - 40); g.stroke();
        } else {
          g.fillStyle = INGR[k].color; g.beginPath(); g.roundRect(x - 40, y - 22, 80, 46, 10); g.fill();
          g.strokeStyle = TINTA; g.lineWidth = 6; g.stroke();
          g.fillStyle = 'rgba(255,250,240,.85)'; g.fillRect(x - 36, y - 18, 72, 8);
        }
        g.globalAlpha = 1;
        if (i === E.hecho) { g.strokeStyle = '#ffe066'; g.lineWidth = 7; g.beginPath(); g.roundRect(x - 50, y - 42, 100, 84, 14); g.stroke(); }
        if (i < n - 1) { g.fillStyle = '#c9b6ff'; g.font = '34px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('›', x + paso / 2, y); g.textAlign = 'left'; }
      });
      if (E.pasos[E.hecho]) {
        g.font = '36px Caprasimo, serif'; g.fillStyle = '#ffe066';
        g.fillText(`Toca: ${INGR[E.pasos[E.hecho]].nombre}`, 34, 250);
      }
      g.textAlign = 'right';
      g.font = '62px Caprasimo, serif'; g.fillStyle = '#ffe066'; g.fillText(`${E.puntos}`, 990, 70);
      g.font = '38px Caprasimo, serif'; g.fillStyle = '#fff3c4'; g.fillText(`Tartas: ${E.servidas}`, 990, 150);
      for (let i = 0; i < 3; i++) {
        const x = 960 - i * 62, y = 238, viva = i < E.vidas;
        g.fillStyle = viva ? '#ff5f8f' : '#3d3350';
        g.beginPath(); g.moveTo(x, y + 22); g.bezierCurveTo(x - 40, y - 4, x - 22, y - 34, x, y - 14); g.bezierCurveTo(x + 22, y - 34, x + 40, y - 4, x, y + 22); g.fill();
        g.strokeStyle = TINTA; g.lineWidth = 5; g.stroke();
      }
      t.needsUpdate = true;
    }

    // ---------- la barra de hambre, encima de Cotine ----------
    const hamb = lienzo(256, 72); propias.push(hamb.t);
    const barra = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3 * 72 / 256), new THREE.MeshBasicMaterial({ map: hamb.t, transparent: true, depthWrite: false }));
    barra.renderOrder = 5; sala.add(barra); propias.push(barra.geometry, barra.material);
    let claveHambre = -1;
    function pintarHambre() {
      const k = Math.round(clamp(E.hambre, 0, 100) / 4);
      if (k === claveHambre) return; claveHambre = k;
      const { g, c, t } = hamb;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.85)'; g.beginPath(); g.roundRect(2, 2, 252, 68, 16); g.fill();
      g.font = '24px Caprasimo, serif'; g.fillStyle = '#ff9fc4'; g.textBaseline = 'middle'; g.fillText('HAMBRE', 12, 22);
      g.fillStyle = '#3d3350'; g.fillRect(12, 40, 232, 20);
      g.fillStyle = k * 4 > 70 ? '#ff4f7f' : '#ff9fc4'; g.fillRect(12, 40, 232 * k / 25, 20);
      g.strokeStyle = '#fff3c4'; g.lineWidth = 3; g.strokeRect(12, 40, 232, 20);
      t.needsUpdate = true;
    }

    // ---------- textos que saltan ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.4) {
      const { g, t } = lienzo(512, 160);
      let px = 78; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > 470 && px > 36) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); sala.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- la receta ----------
    function nuevaReceta() {
      const n = Math.min(2 + E.servidas, 6);
      E.pasos = ['bizcocho'];
      while (E.pasos.length < n) E.pasos.push(elige(PISOS));
      E.pasos.push('guinda');
      E.hecho = 0; E.sinBocados = true;
      pintarCartel();
    }

    // ---------- tú: la mano del plato ----------
    let manoPlato = 'derecha', sinMano = 9;
    const otra = l => (l === 'derecha' ? 'izquierda' : 'derecha');
    const _mp = V(), _mo = V(), _cam = V();
    function colocarPlato(dt) {
      let m = xr.manos[manoPlato];
      if (!m.activa && xr.manos[otra(manoPlato)].activa && sinMano > 0.8) { manoPlato = otra(manoPlato); m = xr.manos[manoPlato]; }
      sinMano = m.activa ? 0 : sinMano + dt;
      if (m.activa) {
        aLocal(m.pos, _mp); _mp.y += 0.03;
        plato.position.lerp(_mp, Math.min(1, dt * 30));
      } else if (sinMano > 0.6) {
        plato.position.lerp(REPOSO, Math.min(1, dt * 3));
        plato.position.y = REPOSO.y + Math.sin(reloj * 1.6) * 0.008;
      }
      // cambiar de mano: pellizco o puño con la otra mano junto al plato
      const o = xr.manos[otra(manoPlato)];
      if (o.activa && (o.empiezaPinza || o.empiezaAgarre) && aLocal(o.pos, _mo).distanceTo(plato.position) < 0.17) {
        manoPlato = otra(manoPlato); sinMano = 0;
        E.patatasPlato = Math.min(4, E.patatasPlato + E.patatasMano); E.patatasMano = 0;
        o.vibrar?.(0.5, 40); sonido('pop', { volumen: 0.35, tono: 0.9 });
      }
    }
    const altoCaptura = () => plato.position.y + 0.012 + E.pila.length * H_PISO;
    const radioCaptura = () => R_PLATO - 0.005 + (ctx.datos?.bandeja ? 0.035 : 0);

    // ---------- lo que cae ----------
    const cayendo = [];
    let ultimoX = 0.15;
    function soltar() {
      const lvl = E.servidas + E.tiempo / 15;
      const r = Math.random();
      const pColilla = Math.min(0.12 + lvl * 0.035, 0.32) + (nivel >= 5 ? 0.06 : 0);
      let tipo, clave;
      if (r < 0.42) { clave = E.pasos[E.hecho] || 'bizcocho'; tipo = clave === 'guinda' ? 'guinda' : 'piso'; }
      else if (r < 0.62) { clave = elige([...PISOS, 'guinda']); tipo = clave === 'guinda' ? 'guinda' : 'piso'; }
      else if (r < 1 - pColilla) { tipo = 'patatas'; clave = 'patatas'; }
      else { tipo = 'colilla'; clave = 'colilla'; }
      // que no caiga siempre en el mismo sitio
      let x = azar(ZONA.x0, ZONA.x1);
      for (let i = 0; i < 4 && Math.abs(x - ultimoX) < 0.12; i++) x = azar(ZONA.x0, ZONA.x1);
      ultimoX = x;
      const p = V(x, Y_CAE, azar(ZONA.z1, ZONA.z0));
      const vy = Math.min(0.9, 0.36 + lvl * 0.045 + Math.random() * 0.12) * (nivel >= 5 ? 1.08 : 1);
      cayendo.push({ tipo, clave, p, vy, vx: nivel >= 3 ? E.viento : 0, giro: azar(-2, 2), rot: Math.random() * 6, t: 0, prevY: p.y });
      humo.soltar({ pos: aMundo(p.clone().add(V(0, 0.05, 0))), vel: V(0, 0.05, 0), tam: 0.05, vida: 0.9, crece: 0.12, sube: 0.04, frena: 2, brillo: 0.85, alfa: 0.55 });
    }

    function atrapar(o) {
      const arriba = V(plato.position.x, altoCaptura(), plato.position.z);
      const mano = xr.manos[manoPlato];
      if (o.tipo === 'patatas') {
        E.patatasPlato = Math.min(4, E.patatasPlato + 1);
        sonido('papel', { volumen: 0.45, tono: 1.2 });
        fx.acierto(aMundo(arriba), { mano, color: '#ffd23f', n: 8, sonido: null });
        if (!avisoPatatas) { avisoPatatas = true; ensenarBoca(); }
        else decir(elige(['¡Mías!', 'Dámelas, dámelas.', '¿Son para mí?']), 0.5);
        return;
      }
      if (o.tipo === 'colilla') {
        E.vidas--; E.sinBocados = false;
        const habia = quitarPiso();
        sonido('arcada', { volumen: 0.7 });
        mano?.vibrar?.(1, 160);
        fx.chispas(aMundo(arriba), '#9ccf5a', 26, 1.4);
        saltaTexto('¡PUAJ!', '#9ccf5a', arriba.clone().add(V(0, 0.22, 0)), 0.42);
        if (habia) decir('Eso… eso no va en la tarta.', 0.6);
        cotine?.pose('plop'); luego(0.9, () => { if (!acabado) cotine?.pose('base'); });
        pintarCartel();
        if (E.vidas <= 0) luego(0.4, final);
        return;
      }
      const toca = E.pasos[E.hecho];
      if (o.clave !== toca) {
        sonido('chof', { volumen: 0.6 });
        fx.fallo(aMundo(arriba), { mano });
        saltaTexto(`¡Toca ${INGR[toca].nombre}!`, '#ff8fc0', arriba.clone().add(V(0, 0.2, 0)), 0.42);
        return;
      }
      E.pila.push(o.clave); E.hecho++; E.puntos += 20; estiron = 1;
      fx.acierto(aMundo(arriba), { mano, color: INGR[o.clave].color === '#fff6e8' ? '#fff3c4' : INGR[o.clave].color, sonido: 'pop', racha: E.hecho, n: 14 });
      if (E.hecho >= E.pasos.length) servir();
      else pintarCartel();
    }

    function quitarPiso() {
      if (!E.pila.length) return false;
      const k = E.pila.pop();
      E.hecho = Math.max(0, E.hecho - 1);
      const p = V(plato.position.x, altoCaptura() + H_PISO / 2, plato.position.z);
      fx.chispas(aMundo(p), INGR[k].color, 12, 0.9);
      pintarCartel();
      return true;
    }

    // la tarta sale volando hacia la barra y Cotine te da un plato nuevo
    const volando = [];
    const frasesServir = baraja(['¡Una entera! ¿Qué? Me la habría comido.', 'Mira. Entera. Casi lloro.', '¿Ves? Te lo juro que la sirvo.']);
    function servir() {
      const pisosN = E.pasos.length;
      const bonus = E.sinBocados ? 150 : 0;
      E.puntos += 100 * pisosN + bonus;
      E.servidas++;
      const p = V(plato.position.x, plato.position.y, plato.position.z);
      volando.push({ pila: E.pila.slice(), p, v: V(0.9, 1.4, -1.2), t: 0 });
      E.pila = [];
      sonido('campanita', { volumen: 0.6 }); sonido('aaah', { volumen: 0.45 });
      xr.manos[manoPlato]?.vibrar?.(1, 140);
      fx.acierto(aMundo(p.clone().add(V(0, 0.15, 0))), { color: '#ffe066', n: 30, sonido: null, fuerte: true });
      saltaTexto(bonus ? '¡ENTERA! Cotine no se lo cree' : '¡SERVIDA!', '#ffe066', V(0.12, alto0 + 0.2, -0.9), 0.6);
      cotine?.empujon(0.3);
      if (bonus) luego(0.5, () => decir(frasesServir()));
      nuevaReceta();
    }

    function bocado() {
      E.hambre = 35;
      const habia = quitarPiso();
      if (habia) E.sinBocados = false;
      E.vidas--;
      sonido('nam', { volumen: 0.8 });
      cotine?.cogerPase(); cotine?.empujon(0.3);
      xr.manos[manoPlato]?.vibrar?.(0.9, 120);
      const b = bocaLocal().clone();
      fx.chispas(aMundo(b), '#ff8fc0', 18, 1.1);
      saltaTexto(habia ? '¡Se la come delante de todos!' : '¡Qué hambre!', '#ff8fc0', b.clone().add(V(0.15, 0.3, 0)), 0.55);
      luego(0.5, () => decir('¿Qué? Tenía hambre.'));
      pintarCartel();
      if (E.vidas <= 0) luego(0.5, final);
    }

    // las patatas, a la boca de Cotine (desde el plato o desde la mano)
    function comer(cuantas, mano) {
      E.hambre = Math.max(0, E.hambre - 45 * cuantas);
      E.puntos += 5 * cuantas; E.comidas += cuantas;
      sonido('nam', { volumen: 0.7, tono: 1 + Math.random() * 0.15 });
      mano?.vibrar?.(0.7, 70);
      cotine?.cogerPase();
      const b = bocaLocal().clone();
      fx.acierto(aMundo(b), { color: '#ffd23f', n: 16, sonido: null });
      saltaTexto('¡Ñam!', '#ffe066', b.clone().add(V(0.1, 0.22, 0)), 0.38);
      pintarCartel();
    }

    function ensenarBoca() {
      ui.instruccion('Las patatas, a la boca de Cotine');
      luego(4, () => { if (!acabado) ui.instruccion(null); });
      decir('¿Son para mí? Tráemelas.');
      const p0 = aMundo(plato.position.clone().add(V(0, -0.02, 0)));
      const b = aMundo(bocaLocal().clone().add(V(0.05, -0.03, 0.06)));
      fx.demo([{ p: p0 }, { p: b }, { p: b }], { dur: 2.6, tramo: 0.7 });
    }

    function final() {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; E.activo = false;
      ui.instruccion(null);
      cayendo.length = 0;
      cotine?.pose('plop', { rebote: 0.3 });
      sonido('plop', { volumen: 0.7 });
      saltaTexto('¡PLOP!', '#ff8fc0', V(0.12, alto0 + 0.15, -0.9), 0.7);
      const t = E.servidas;
      const gana = t > 0;
      luego(0.6, () => decir(t >= 3 ? 'Nunca había servido tanto. Ni yo me lo creo.' : '¿Qué? Tenía hambre.'));
      luego(1.6, () => ctx.terminar({
        puntos: E.puntos, gana,
        linea: t ? `${t} tarta${t > 1 ? 's' : ''} servida${t > 1 ? 's' : ''}.` : 'Ni una tarta.',
      }));
    }

    // ---------- arranque: Cotine lo promete y la mano fantasma enseña a atrapar ----------
    nuevaReceta(); pintarHambre();
    colocarPlato(1);
    ctx.musica?.('minijuego');
    luego(0.5, () => { decir('Hoy sirvo una tarta entera, te lo juro.'); cotine?.empujon(0.2); });
    luego(1.2, () => {
      ui.instruccion('Atrapa los pisos en el orden de la receta');
      const a = aMundo(V(0.22, alto0 - 0.35, -0.38)), b = aMundo(V(0.05, alto0 - 0.35, -0.45));
      const c = aMundo(V(0.05, alto0 - 0.2, -0.45));
      fx.demo([{ p: a }, { p: b }, { p: c }, { p: b }], { dur: 2.8, tramo: 0.55 });
    });
    luego(3.6, () => { E.fase = 'juego'; E.activo = true; sonido('boing', { volumen: 0.4 }); });
    luego(7.5, () => { if (!acabado && !avisoPatatas) ui.instruccion(null); });

    // ---------- por fotograma ----------
    const _p = V(), _sc = V(), _hp = V(), _up = V(0, 1, 0);
    let estiron = 0, tHilo = 0;
    function pintar() {
      aLocal(xr.cabeza, _cam);
      const cy = altoCaptura();
      for (const l of lotes) l.empezar();
      const yaw = p => _q.setFromAxisAngle(_up, Math.atan2(_cam.x - p.x, _cam.z - p.z));
      // lo que cae
      for (const o of cayendo) {
        const s = Math.min(1, o.t / 0.18);
        if (o.tipo === 'piso') {
          _q.setFromEuler(new THREE.Euler(Math.sin(o.rot) * 0.35, o.rot, Math.cos(o.rot * 0.7) * 0.25));
          pisos.poner(o.p, _q, _sc.set(R_PISO * 0.9 * s, H_PISO * s, R_PISO * 0.9 * s), INGR[o.clave].color);
        } else if (o.tipo === 'guinda') guindas.poner(o.p, _q.identity(), _sc.setScalar(0.03 * s), INGR.guinda.color);
        else if (o.tipo === 'patatas') { yaw(o.p); _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(o.rot) * 0.4)); patatas.poner(o.p, _q, _sc.set(0.11 * s, 0.11 * ASP_PAT * s, 1)); }
        else { yaw(o.p); _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), o.rot)); colillas.poner(o.p, _q, _sc.set(0.1 * s, 0.1 * ASP_COL * s, 1)); }
        // su sombra, a la altura del plato: cuanto más cerca, más grande
        if (o.p.y > cy && E.activo) {
          const k = 1 - clamp((o.p.y - cy) / 0.9, 0, 1);
          sombras.poner(_p.set(o.p.x, cy + 0.002, o.p.z), _q.identity(), _sc.set(0.02 + 0.045 * k, 1, 0.02 + 0.045 * k));
        }
      }
      // la pila del plato (se estira un poco al caer un piso)
      const est = 1 + estiron * 0.25;
      E.pila.forEach((k, i) => {
        const y = plato.position.y + 0.008 + i * H_PISO;
        if (k === 'guinda') guindas.poner(_p.set(plato.position.x, y + 0.026, plato.position.z), _q.identity(), _sc.setScalar(0.03), INGR.guinda.color);
        else { const r = (R_PISO - i * 0.004) / Math.sqrt(est); pisos.poner(_p.set(plato.position.x, y + H_PISO / 2, plato.position.z), _q.identity(), _sc.set(r, H_PISO * (i === E.pila.length - 1 ? est : 1), r), INGR[k].color); }
      });
      // patatas en el plato (en el borde) y en la mano libre
      for (let i = 0; i < E.patatasPlato; i++) {
        const a = Math.PI * 0.75 + i * 0.6;
        _p.set(plato.position.x + Math.cos(a) * 0.095, plato.position.y + 0.045, plato.position.z + Math.sin(a) * 0.095);
        yaw(_p); patatas.poner(_p, _q, _sc.set(0.07, 0.07 * ASP_PAT, 1));
      }
      const libre = xr.manos[otra(manoPlato)];
      if (E.patatasMano && libre.activa) { aLocal(libre.pos, _hp).y += 0.04; yaw(_hp); patatas.poner(_hp, _q, _sc.set(0.08, 0.08 * ASP_PAT, 1)); }
      // las tartas servidas, volando
      for (const v of volando) v.pila.forEach((k, i) => {
        const y = v.p.y + 0.008 + i * H_PISO;
        if (k === 'guinda') guindas.poner(_p.set(v.p.x, y + 0.026, v.p.z), _q.identity(), _sc.setScalar(0.03), INGR.guinda.color);
        else pisos.poner(_p.set(v.p.x, y + H_PISO / 2, v.p.z), _q.identity(), _sc.set(R_PISO - i * 0.004, H_PISO, R_PISO - i * 0.004), INGR[k].color);
      });
      for (const l of lotes) l.acabar();
    }

    function actualizarJuego(dt) {
      E.tiempo += dt;
      // el viento cambia de vez en cuando (nivel 3+)
      if (nivel >= 3) {
        tViento -= dt;
        if (tViento <= 0) {
          tViento = azar(5, 9);
          E.viento = azar(-0.14, 0.14);
          saltaTexto(E.viento < 0 ? '← Viento' : 'Viento →', '#8fd3ff', V(0.12, alto0 + 0.28, -1.0), 0.4);
          sonido('whoosh', { volumen: 0.35 });
        }
        tHilo -= dt;
        if (tHilo <= 0 && Math.abs(E.viento) > 0.03) {
          tHilo = 0.25;
          const p = V(azar(ZONA.x0 - 0.2, ZONA.x1 + 0.2), azar(alto0 - 0.3, alto0 + 0.5), azar(ZONA.z1, ZONA.z0) - 0.1);
          humo.soltar({ pos: aMundo(p), vel: aMundo(V(E.viento * 4, 0, 0)).sub(sala.position), tam: 0.02, vida: 1.2, crece: 0.01, sube: 0, frena: 0, brillo: 0.75, alfa: 0.45 });
        }
      }
      // el hambre sube sola; arriba del todo, Cotine se come el piso de arriba
      E.hambre += dt * (4.2 + Math.min(E.servidas, 4) * 1.0) * (nivel >= 5 ? 1.15 : 1);
      if (E.hambre > 70 && reloj > tHambreVoz) { tHambreVoz = reloj + 6; decir(elige(['Qué hambre…', '¿Hay patatas?', 'Solo un bocadito…']), 0.8); cotine?.cogerPase(); }
      if (E.hambre >= 100) bocado();

      proximo -= dt;
      if (proximo <= 0) {
        soltar();
        proximo = Math.max(0.55, 1.25 - (E.servidas + E.tiempo / 15) * 0.07) + Math.random() * 0.3;
      }

      const cy = altoCaptura(), R = radioCaptura();
      const libre = xr.manos[otra(manoPlato)];
      const libreL = libre.activa ? aLocal(libre.pos, _hp) : null;
      for (let i = cayendo.length - 1; i >= 0; i--) {
        const o = cayendo[i];
        o.t += dt; o.prevY = o.p.y;
        o.p.y -= o.vy * dt; o.p.x += (o.vx || 0) * dt; o.rot += o.giro * dt;
        const d = Math.hypot(o.p.x - plato.position.x, o.p.z - plato.position.z);
        // cae en el plato (o en lo alto de la pila)
        if (o.p.y < cy + 0.012 && o.prevY >= cy - 0.06 && d < R) { cayendo.splice(i, 1); atrapar(o); if (acabado) return; continue; }
        // patatas: también se cogen tocándolas con la mano libre
        if (o.tipo === 'patatas' && libreL && libreL.distanceTo(o.p) < 0.09 && E.patatasMano < 3) {
          cayendo.splice(i, 1); E.patatasMano++;
          libre.vibrar?.(0.5, 40); sonido('papel', { volumen: 0.4, tono: 1.3 });
          fx.chispas(aMundo(o.p), '#ffd23f', 8, 0.7);
          if (!avisoPatatas) { avisoPatatas = true; ensenarBoca(); }
          continue;
        }
        if (o.p.y < 0.04) { cayendo.splice(i, 1); if (o.tipo === 'piso' && Math.random() < 0.4) sonido('chof', { volumen: 0.18, tono: 1.3 }); }
      }
      // a la boca de Cotine
      const b = bocaLocal();
      if (E.patatasPlato && plato.position.distanceTo(b) < 0.25) { const n = E.patatasPlato; E.patatasPlato = 0; comer(n, xr.manos[manoPlato]); }
      if (E.patatasMano && libreL && libreL.distanceTo(b) < 0.2) { const n = E.patatasMano; E.patatasMano = 0; comer(n, libre); }
    }

    const api = {
      E, cayendo, sala, aMundo, aLocal, plato, bocaLocal, altoCaptura, radioCaptura,
      get manoPlato() { return manoPlato; }, get acabado() { return acabado; },
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        if (cotine) {
          // Cotine viene a por las patatas: si se las acercas, se estira hacia ellas (hasta 25 cm)
          const conPatatas = E.patatasPlato ? plato.position : (E.patatasMano && xr.manos[otra(manoPlato)].activa ? aLocal(xr.manos[otra(manoPlato)].pos, _hp) : null);
          _p.copy(POS_COT);
          if (conPatatas && !acabado) {
            const dx = conPatatas.x - POS_COT.x, dz = conPatatas.z - POS_COT.z, d = Math.hypot(dx, dz);
            if (d < 0.75 && d > 1e-3) { const k = Math.min(0.25, d) / d; _p.x += dx * k; _p.z += dz * k; }
          }
          cotine.grupo.position.lerp(_p, Math.min(1, dt * 5));
          cotine.actualizar(dt, xr.cabeza);
          cotine.frente.material.color.lerp(_col.set(E.hambre > 70 && !acabado ? '#ffc0d8' : '#ffffff'), Math.min(1, dt * 4));
          // a su lado (encima va el bocadillo)
          barra.position.copy(cotine.grupo.position).add(V(0.36, 0, 0.04)).setY(hEnc + (cotine.alto ?? 0.85) * 0.78); barra.lookAt(aLocal(xr.cabeza, _cam));
        }
        colocarPlato(dt);
        estiron = Math.max(0, estiron - dt * 5);
        if (E.activo && !acabado) actualizarJuego(dt);
        pintarHambre();
        for (let i = volando.length - 1; i >= 0; i--) {
          const v = volando[i]; v.t += dt;
          v.v.y -= 2.2 * dt; v.p.addScaledVector(v.v, dt);
          if (v.t > 1.1) volando.splice(i, 1);
        }
        pintar();
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.25; s.m.lookAt(aLocal(xr.cabeza, _cam));
          s.m.material.opacity = Math.min(1, 3 * (1.3 - s.t));
          if (s.t > 1.3) { sala.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      // salir a mitad: cuenta lo que llevas, sin ganar
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; E.activo = false; ui.instruccion(null);
        decir('¿Ya? Pues me la como yo.');
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Lo dejas con ${E.servidas} tarta${E.servidas === 1 ? '' : 's'}. Cotine se come el resto.` });
      },
      destruir() {
        destruido = true; acabado = true; tareas.length = 0;
        fx.destruir();
        ui.instruccion(null);
        cotine?.callar();
        for (const l of lotes) l.quitar();
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const p of propias) p.dispose?.();
      },
    };
  },
};
