// El blancazo · jefe en VR nativo, escala «sala». Reglas de base/js/escenas/blancazo.js.
//
// En tu habitación (en el humo): a tu izquierda, Blancaso derritiéndose en el suelo con el blancazo; delante, a 2,4 m,
// Puky, que viene a por él. Tú eres Monchiman en primera persona:
//   DISPARAR   pellizco (o gatillo) sostenido: caramelos desde esa mano, hacia donde apunta (con ayuda de puntería).
//   ESQUIVAR   con el cuerpo: los escupitajos van a donde estaba tu cabeza al soltarlos; la lluvia de pota cae donde
//              marcan los charcos del suelo; el muro de eructo tiene un hueco (inclínate hacia él).
//   PARAR      con la mano ABIERTA: lo que toca se para; de un manotazo (mano rápida) se lo devuelves a Puky.
//              Los pukitos que saltan hacia ti se aplastan de un manotazo (o a caramelazos). Así se juega sentado.
//   RESUCITADOR cada caramelo que le das carga el medidor; lleno, aparece la lata delante de ti: cógela (pellizco o
//              puño) y lánzasela a Puky. Pega muchísimo.
// Tres fases como el 2D: 1) escupitajos y lluvia en arco; 2) se parte de risa: pukitos y muro de eructo; 3) se enfada:
// flota arriba y abajo, gotea desde el techo y escupe más rápido. Nada mueve tu vista: lo que se mueve es Puky y lo suyo.
// Sin game over duro: si te pringa tres veces, eliges «Otra vez, desde aquí» (con un corazón más) o dejarlo por hoy.
import * as THREE from 'three';
import { Jugo } from './jugo.js';

const TINTA = '#140c1c';
const Z_PUKY = -2.4, ALTO_PUKY = 1.5;
const R_CAB = 0.2, R_MANO = 0.15, MANOTAZO = 1.5;
const CADENCIA = 0.15, V_BALA = 9, CARGA_MAX = 34;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const azar = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

// muchos planos iguales que te miran, en UNA llamada de dibujo
const _m4 = new THREE.Matrix4(), _s = V(), _c = new THREE.Color();
class Bandada {
  constructor(tex, max, padre, { aditivo = false, opacidad = 1, orden = 20, alphaTest = 0 } = {}) {
    this.mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !alphaTest, alphaTest, opacity: opacidad, depthWrite: !!alphaTest, side: THREE.DoubleSide, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, max);
    this.m.setColorAt(0, _c.set('#ffffff')); this.m.count = 0; this.m.frustumCulled = false; this.m.renderOrder = orden;
    this.max = max; this.n = 0; padre.add(this.m);
  }
  empezar() { this.n = 0; }
  poner(p, q, esc, color = null, escY = esc) {
    if (this.n >= this.max) return;
    this.m.setMatrixAt(this.n, _m4.compose(p, q, _s.set(esc, escY, esc)));
    this.m.setColorAt(this.n, color || _c.set('#ffffff'));
    this.n++;
  }
  acabar() { this.m.count = this.n; this.m.instanceMatrix.needsUpdate = true; this.m.instanceColor.needsUpdate = true; }
  quitar() { this.m.geometry.dispose(); this.mat.dispose(); this.m.dispose(); }
}

export default {
  clave: 'Blancazo', titulo: 'El blancazo', escala: 'sala', umbrales: [400, 800, 1200],
  ayudas: { gatillo: 'Mantener: disparar caramelos', lateral: 'Coger y lanzar el resucitador', mano: { pellizco: 'Mantener: disparar', puno: 'Coger y lanzar el resucitador' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-blancazo';
    const propias = [];
    const fx = new Jugo(ctx, grupo);

    // ---------- banderas de partida: TODAS aquí («Otra vez» llama a crear de nuevo) ----------
    const nivel = ctx.nivel || 1;
    const dif = 1 + 0.1 * Math.min(nivel - 1, 6);
    const VIDA_PUKY = Math.round(200 * dif);
    const est = {
      estado: 'intro', activo: false, fase: 1, hp: VIDA_PUKY, hpMax: VIDA_PUKY, vida: 3, vidaMax: 3, rein: 0,
      t: 0, tJuego: 0, invul: 0, por: {}, carga: 0, supers: 0, golpes: 0, paradas: 0, devueltas: 0, aplastados: 0,
      ataqueT: 2.2, ataqueN: 0, goteoT: 1, gesto: 0, acabado: false, destruido: false, herido: 0,
    };
    const tareas = [];
    const luego = (s, fn, juego = false) => tareas.push({ t: est.t + s, fn, juego, rein: est.rein });
    const gotas = [], balas = [], pukitos = [], muros = [], marcas = [];
    let lata = null;

    // ---------- dónde: la sala mira hacia donde miras, con el suelo en tu suelo ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const sala = new THREE.Group(); sala.name = 'sala-blancazo';
    sala.position.copy(xr.cabeza).setY(0); sala.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(sala); sala.updateMatrixWorld(true);
    const inv = sala.matrixWorld.clone().invert(), qS = sala.quaternion.clone(), qSi = qS.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(sala.matrixWorld);
    const cab = aLocal(xr.cabeza);

    // ---------- arte ----------
    const pr = n => ctx.img(n).catch(e => { console.warn('blancazo: falta', n, e); return null; });
    const rc = (id, escala) => ctx.Recortable.crear(id, 'humo', { escala }).catch(e => { console.warn('blancazo: sin', id, e); return null; });
    const [texCaramelo, texPuky, texHumo, texLata, texMonch, puky, blancaso] = await Promise.all([
      pr('caramelo.png'), pr('puky.png'), pr('fx-humo-puff.png'), pr('lata.png'), pr('monchiman.png'),
      rc('puky', ALTO_PUKY / 0.6), rc('blancaso', 0.9),
    ]);
    if (est.destruido) return { grupo, actualizar() { }, destruir() { }, abandonar() { } };

    // la pota: gota amarilla con su contorno de tinta y su brillo (dibujada aquí)
    const texGota = (() => {
      const { g, t } = lienzo(128, 128); propias.push(t);
      g.fillStyle = TINTA; g.beginPath(); g.ellipse(64, 70, 50, 54, 0, 0, 7); g.fill();
      g.fillStyle = '#f5d23a'; g.beginPath(); g.ellipse(64, 70, 42, 46, 0, 0, 7); g.fill();
      g.fillStyle = '#d9b400'; g.beginPath(); g.ellipse(72, 82, 26, 26, 0, 0, 7); g.fill();
      g.fillStyle = '#fff6a8'; g.beginPath(); g.ellipse(48, 52, 12, 8, -0.6, 0, 7); g.fill();
      t.needsUpdate = true; return t;
    })();
    // aviso en el suelo: un charco a rayas que late
    const texMarca = (() => {
      const { g, t } = lienzo(128, 128); propias.push(t);
      g.strokeStyle = '#f5d23a'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
      g.strokeStyle = TINTA; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
      g.fillStyle = 'rgba(245,210,58,.35)'; g.beginPath(); g.arc(64, 64, 48, 0, 7); g.fill();
      t.needsUpdate = true; return t;
    })();

    const gotasB = new Bandada(texGota, 60, sala, { alphaTest: 0.5, orden: 22 });
    const balasB = new Bandada(texCaramelo, 50, sala, { alphaTest: 0.5, orden: 21 });
    const pukitosB = new Bandada(texPuky, 8, sala, { alphaTest: 0.5, orden: 20 });
    const humoB = new Bandada(texHumo, 70, sala, { opacidad: 0.62, orden: 25 });
    const marcasB = new Bandada(texMarca, 24, sala, { orden: 5 });
    const bandadas = [gotasB, balasB, pukitosB, humoB, marcasB];
    const QSUELO = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
    const COL_HUMO = new THREE.Color('#b5e36b'), COL_GOTA = new THREE.Color('#ffffff');

    // ---------- Puky delante; Blancaso derritiéndose a tu izquierda, con el aro que pide ayuda ----------
    const SITIO_PUKY = V(0, 0, Z_PUKY), SITIO_BLANCASO = V(-0.75, 0, -1.3);
    if (puky) { puky.grupo.position.copy(SITIO_PUKY); sala.add(puky.grupo); puky.pose('base', { rebote: 0 }); }
    if (blancaso) { blancaso.grupo.position.copy(SITIO_BLANCASO); sala.add(blancaso.grupo); blancaso.pose('derritiendose', { rebote: 0 }); }
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: '#f5d23a', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    aura.rotation.x = -Math.PI / 2; aura.position.copy(SITIO_BLANCASO).setY(0.01); sala.add(aura); propias.push(aura.geometry, aura.material);
    // el aro del hueco del muro de eructo
    const aroHueco = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    aroHueco.visible = false; aroHueco.renderOrder = 26; sala.add(aroHueco); propias.push(aroHueco.geometry, aroHueco.material);
    // la lata del resucitador
    const lataM = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.16), new THREE.MeshBasicMaterial({ map: texLata, color: texLata ? '#ffffff' : '#b68cff', alphaTest: 0.5, side: THREE.DoubleSide }));
    lataM.visible = false; lataM.renderOrder = 23; sala.add(lataM); propias.push(lataM.geometry, lataM.material);

    // ---------- marcador encima de Puky ----------
    const marc = lienzo(1024, 200); propias.push(marc.t);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5 * 200 / 1024), new THREE.MeshBasicMaterial({ map: marc.t, transparent: true, depthWrite: false }));
    panel.position.set(0, ALTO_PUKY + 0.5, Z_PUKY + 0.1); sala.add(panel); propias.push(panel.geometry, panel.material);
    let clavePanel = '';
    function pintarPanel() {
      const lleno = est.carga >= CARGA_MAX;
      const clave = [Math.ceil(est.hp), est.vida, est.vidaMax, Math.floor(est.carga), est.herido > 0, lleno && Math.sin(est.t * 12) > 0].join('|');
      if (clave === clavePanel) return; clavePanel = clave;
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.84)'; g.beginPath(); g.roundRect(4, 4, 1016, 192, 24); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '36px Caprasimo, serif'; g.lineWidth = 7; g.strokeStyle = TINTA; g.strokeText('PUKY · el blancazo', 512, 36); g.fillStyle = '#ffd23f'; g.fillText('PUKY · el blancazo', 512, 36);
      g.fillStyle = TINTA; g.fillRect(196, 64, 632, 40); g.strokeStyle = '#fff3e6'; g.lineWidth = 4; g.strokeRect(196, 64, 632, 40);
      g.fillStyle = '#f5d23a'; g.fillRect(204, 71, 616 * Math.max(0, est.hp / est.hpMax), 26);
      g.fillStyle = TINTA; for (const f of [2 / 3, 1 / 3]) g.fillRect(204 + 616 * f - 2, 64, 4, 40);
      for (let i = 0; i < est.vidaMax; i++) {
        const x = 60 + i * 62, y = 150; g.globalAlpha = i < est.vida ? 1 : 0.3;
        if (texMonch?.image) { const im = texMonch.image, h = 60, w = h * im.width / im.height; g.drawImage(im, x - w / 2, y - h / 2, w, h); }
        else { g.fillStyle = '#ff5fa2'; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); }
        g.globalAlpha = 1;
      }
      g.font = '26px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.textAlign = 'right'; g.fillText('RESUCITADOR', 690, 150);
      g.fillStyle = TINTA; g.fillRect(706, 134, 280, 32);
      g.fillStyle = lleno && Math.sin(est.t * 12) > 0 ? '#ffffff' : '#b68cff'; g.fillRect(712, 140, 268 * Math.min(1, est.carga / CARGA_MAX), 20);
      if (est.herido > 0) { g.strokeStyle = '#ff5fa2'; g.lineWidth = 10; g.beginPath(); g.roundRect(8, 8, 1008, 184, 22); g.stroke(); }
      t.needsUpdate = true;
    }

    // ---------- tu cuerpo, en la sala ----------
    const MANOS = () => [xr.manos.derecha, xr.manos.izquierda];
    const mano = { derecha: { pos: V(), vel: V(), disparoT: 0, lleva: false }, izquierda: { pos: V(), vel: V(), disparoT: 0, lleva: false } };
    function leerCuerpo() {
      aLocal(xr.cabeza, cab);
      for (const m of MANOS()) { if (!m.activa) continue; const L = mano[m.lado]; aLocal(m.pos, L.pos); L.vel.copy(m.vel).applyQuaternion(qSi); }
    }
    function vibrar(f, ms, solo = null) { for (const m of solo ? [solo] : MANOS()) if (m.activa) m.vibrar(f, ms); }
    const _a = V(), _b = V(), _d = V(), _p = V();
    function medirDireccion(m, out) {
      out.set(0, 0, -1).applyQuaternion(m.quat);
      if (m.esMano) {
        const f = _a.copy(xr.adelante).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
        const lado = m.lado === 'derecha' ? 1 : -1;
        const hombro = _b.copy(xr.cabeza).add(_d.set(-f.z * 0.17 * lado, -0.2, f.x * 0.17 * lado));
        const rayo = _d.copy(m.pos).sub(hombro);
        if (rayo.lengthSq() > 1e-4) out.add(rayo.normalize()).normalize();
      }
      return out.applyQuaternion(qSi);
    }
    const centroPuky = (out = V()) => out.set(puky ? puky.grupo.position.x : 0, (puky ? puky.grupo.position.y : 0) + ALTO_PUKY * 0.45, Z_PUKY);
    const R_PUKY = 0.62;

    // ---------- tus disparos ----------
    function disparar(m, L) {
      const dir = medirDireccion(m, V());
      // ayuda de puntería: si casi apuntas a Puky o a un pukito, el caramelo se dobla hacia él
      let mejor = null, mejorCos = Math.cos(THREE.MathUtils.degToRad(12));
      const blancos = [centroPuky(), ...pukitos.map(k => k.p.clone().add(_a.set(0, 0.12, 0)))];
      for (const b of blancos) { const d = _d.copy(b).sub(L.pos).normalize(); const cs = d.dot(dir); if (cs > mejorCos) { mejorCos = cs; mejor = b; } }
      if (mejor) dir.lerp(_d.copy(mejor).sub(L.pos).normalize(), 0.5).normalize();
      balas.push({ p: L.pos.clone().addScaledVector(dir, 0.08), v: dir.multiplyScalar(V_BALA), vida: 0.7, giro: Math.random() * 6 });
      if (Math.random() < 0.3) sonido('pop', { volumen: 0.08, tono: 1.2 + Math.random() * 0.4 });
      m.vibrar(0.1, 10);
    }

    // ---------- Puky ----------
    function bocaPuky(out = V()) {
      if (puky) { puky.bocaMundo(out); return aLocal(out, out); }
      return centroPuky(out);
    }
    function poseFase() { return est.fase === 1 ? 'base' : est.fase === 2 ? 'riendo' : 'horror'; }
    function gesto(pose = null) {
      // anticipación de dibujo animado: se encoge y suelta con la pose del ataque
      if (!puky) return;
      puky.vRebote -= 2.4; est.gesto = 0.45;
      if (pose) puky.pose(pose, { rebote: 0.25 });
    }
    function danarPuky(d, p, fuerte = false) {
      if (!est.activo) return;
      est.hp -= d;
      if (!fuerte) est.carga = Math.min(CARGA_MAX, est.carga + 1);
      if (fuerte) { puky?.empujon(0.4); fx.chispas(aMundo(p), '#f5d23a', 40, 1.8); sonido('chof', { volumen: 0.7 }); vibrar(0.8, 90); }
      else if (Math.random() < 0.35) fx.chispas(aMundo(p), '#fff6a8', 4, 0.6);
      if (puky && (fuerte || Math.random() < 0.2)) puky.tambalear(fuerte ? 0.5 : 0.08);
      if (est.carga >= CARGA_MAX && !lata) sacarLata();
      if (est.fase === 1 && est.hp <= est.hpMax * 2 / 3) cambiarFase(2, '¡Puky se parte de risa!');
      else if (est.fase === 2 && est.hp <= est.hpMax / 3) cambiarFase(3, '¡Puky se enfada!');
      if (est.hp <= 0) victoria();
    }
    function cambiarFase(n, grito) {
      est.fase = n;
      puky?.pose(poseFase(), { rebote: 0.35 });
      sonido(n === 2 ? 'risas' : 'temblor', { volumen: 0.6 });
      ui.cartela(grito, 1.8);
      est.ataqueT = 1.6;
      if (n === 3) fx.chispas(aMundo(centroPuky()), '#ff7a5c', 24, 1.4);
    }

    function marca(x, z, dur, r = 0.16) { const m = { x, z, r, t: 0, dur }; marcas.push(m); return m; }
    function charquito(p) { marcas.push({ x: p.x, z: p.z, r: 0.12, t: 0, dur: 0.6, salpica: true }); }

    function escupir(n) {
      sonido('blurp', { volumen: 0.7 });
      const o = bocaPuky();
      const meta = _a.copy(cab).add(_b.set(0, -0.05, 0));
      const dir = meta.sub(o).normalize();
      const vel = (est.fase === 3 ? 3.8 : 3.1) * Math.sqrt(dif);
      for (let i = 0; i < n; i++) {
        const ang = (i - (n - 1) / 2) * 0.17;
        const d = dir.clone().applyAxisAngle(_b.set(0, 1, 0), ang);
        gotas.push({ p: o.clone(), v: d.multiplyScalar(vel), g: 0, r: 0.07, t: 0 });
      }
    }
    function arco(n) {
      sonido('arcada', { volumen: 0.5 });
      const o = bocaPuky().add(_a.set(0, 0.1, 0));
      const g = 4.2, Tf = 1.35 / Math.sqrt(dif);
      for (let i = 0; i < n; i++) {
        // una cae casi encima de ti (hay que apartarse); las demás alrededor
        const cerca = i === 0, ang = Math.random() * Math.PI * 2, rr = cerca ? azar(0.05, 0.16) : azar(0.4, 1.0);
        const meta = V(cab.x + Math.cos(ang) * rr, 0, cab.z + Math.sin(ang) * rr * 0.7 - (cerca ? 0 : 0.2));
        const v = meta.clone().sub(o).sub(_b.set(0, -0.5 * g * Tf * Tf, 0)).divideScalar(Tf);
        const mk = marca(meta.x, meta.z, Tf + 0.1, 0.15);
        gotas.push({ p: o.clone(), v, g, r: 0.08, t: 0, marca: mk });
      }
    }
    function goteo() {
      const cerca = Math.random() < 0.45, ang = Math.random() * Math.PI * 2, rr = cerca ? azar(0, 0.12) : azar(0.3, 0.8);
      const p = V(cab.x + Math.cos(ang) * rr, cab.y + 1.3, cab.z + Math.sin(ang) * rr);
      const mk = marca(p.x, p.z, 1.3, 0.12);
      gotas.push({ p, v: V(0, -0.4, 0), g: 3.2, r: 0.07, t: 0, marca: mk });
      sonido('goteo', { volumen: 0.25 });
    }
    function soltarPukitos(n) {
      sonido('puky-gracioso', { volumen: 0.5 });
      for (let i = 0; i < n; i++) luego(i * 0.45, () => {
        if (!est.activo) return;
        const lado = (i % 2 ? 1 : -1) * azar(0.3, 0.6);
        pukitos.push({ p: V(lado, 0, Z_PUKY + 0.4), vy: 2.4, hp: 3, estado: 'salta', t: 0, destello: 0, vx: 0 });
      }, true);
    }
    function eructo() {
      gesto('eructo');
      luego(0.35, () => {
        if (!est.activo) return;
        sonido('eructo', { volumen: 0.8 });
        // el hueco: a un lado (inclínate) o, en la fase 3, a veces abajo (agáchate)
        const abajo = est.fase === 3 && Math.random() < 0.3;
        const lado = Math.random() < 0.5 ? -1 : 1;
        const hx = cab.x + (abajo ? 0 : lado * 0.36), hy = cab.y + (abajo ? -0.3 : -0.04), r = 0.34;
        const puffs = [];
        for (let x = -1.2; x <= 1.2001; x += 0.2) for (let y = -1.0; y <= 0.7; y += 0.2) {
          const px = cab.x + x + (Math.random() - 0.5) * 0.05, py = cab.y + y;
          if (py < 0.05) continue;
          if (Math.hypot(px - hx, py - hy) < r + 0.06) continue;
          puffs.push({ x: px, y: py, f: Math.random() * 6, s: azar(0.26, 0.34) });
        }
        muros.push({ z: Z_PUKY + 0.5, hx, hy, r, puffs, pasado: false, v: 1.35 * Math.sqrt(dif) });
        luego(0.5, () => puky?.pose(poseFase(), { rebote: 0.15 }), true);
      }, true);
    }
    function atacar(dt) {
      est.ataqueT -= dt;
      if (est.ataqueT > 0) return;
      est.ataqueT = [0, 2.3, 2.1, 1.6][est.fase] / dif;
      est.ataqueN++;
      const patrones = est.fase === 1 ? ['escupir', 'arco'] : est.fase === 2 ? ['escupir', 'pukitos', 'eructo', 'arco'] : ['escupir', 'eructo', 'pukitos', 'escupir', 'arco'];
      const p = patrones[est.ataqueN % patrones.length];
      if (p === 'eructo') return eructo();
      gesto();
      luego(0.45, () => {
        if (!est.activo) return;
        if (p === 'escupir') escupir(est.fase === 3 ? 5 : 3);
        if (p === 'arco') arco(est.fase === 1 ? 4 : 6);
        if (p === 'pukitos') soltarPukitos(est.fase === 3 ? 3 : 2);
      }, true);
    }

    // ---------- el resucitador ----------
    function sitioLata(out = V()) { return out.set(cab.x - 0.04, cab.y - 0.3, cab.z - 0.38); }
    function sacarLata() {
      lata = { estado: 'flota', p: sitioLata(), v: V(), mano: null, t: 0 };
      lataM.visible = true; sonido('campanita', { volumen: 0.6, tono: 1.3 });
      ui.instruccion('Coge el resucitador y lánzaselo a Puky');
      fx.chispas(aMundo(lata.p), '#b68cff', 16, 0.8);
    }
    function moverLata(dt) {
      if (!lata) return;
      lata.t += dt;
      if (lata.estado === 'flota') {
        sitioLata(_a); _a.y += Math.sin(lata.t * 3) * 0.02;
        lata.p.lerp(_a, Math.min(1, dt * 6));
        for (const m of MANOS()) {
          if (!m.activa) continue;
          const L = mano[m.lado];
          if (L.pos.distanceTo(lata.p) < 0.14 && (m.empiezaPinza || m.empiezaAgarre)) {
            lata.estado = 'mano'; lata.mano = m; L.lleva = true; m.vibrar(0.5, 40); sonido('lata', { volumen: 0.5 });
            ui.instruccion(null);
            break;
          }
        }
      } else if (lata.estado === 'mano') {
        const m = lata.mano, L = mano[m.lado];
        lata.p.copy(L.pos);
        if (!m.pinza && !m.agarre) {
          L.lleva = false;
          const vel = L.vel.clone();
          if (vel.length() > 0.9 && vel.z < 0) {
            // lanzada: la ayuda de puntería la lleva hacia Puky
            const meta = centroPuky();
            const dir = vel.clone().normalize().lerp(_d.copy(meta).sub(lata.p).normalize(), 0.7).normalize();
            lata.estado = 'vuela'; lata.v = dir.multiplyScalar(8); lata.t = 0;
            sonido('fiuuu', { volumen: 0.6 }); m.vibrar(0.6, 50);
          } else { lata.estado = 'flota'; lata.mano = null; }
        }
      } else if (lata.estado === 'vuela') {
        lata.p.addScaledVector(lata.v, dt);
        if (lata.p.distanceTo(centroPuky(_a)) < R_PUKY + 0.05) {
          est.supers++; est.carga = 0;
          const p = lata.p.clone();
          lata = null; lataM.visible = false;
          ui.cartela('¡Resucitador!', 1.2);
          danarPuky(18, p, true);
          return;
        }
        if (lata.t > 1.5) { lata.estado = 'flota'; lata.mano = null; } // fallada: vuelve a tu lado
      }
    }

    // ---------- golpes que recibes ----------
    function tocado(p, por) {
      if (est.invul > 0 || !est.activo) return;
      est.por[por] = (est.por[por] || 0) + 1;
      est.vida--; est.golpes++; est.invul = 1.4; est.herido = 0.5;
      sonido('golpe', { volumen: 0.6 }); sonido('chof', { volumen: 0.5 });
      vibrar(1, 160);
      // el pringue se ve delante de ti, abajo, un instante (nada que tape la vista)
      const f = aMundo(_a.copy(cab).add(_b.set(0, -0.25, -0.35)));
      fx.chispas(f, '#f5d23a', 16, 0.7);
      if (p) charquito(p);
      blancaso?.empujon(0.15);
      if (est.vida <= 0) caida();
    }
    function limpiar() {
      gotas.length = 0; balas.length = 0; pukitos.length = 0; muros.length = 0; marcas.length = 0;
      aroHueco.visible = false;
      for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].juego) tareas.splice(i, 1);
      if (lata && lata.estado !== 'flota') { lata.estado = 'flota'; lata.mano = null; }
      mano.derecha.lleva = mano.izquierda.lleva = false;
    }
    function progreso() { return clamp(1 - Math.max(0, est.hp) / est.hpMax, 0, 1); }
    // sin game over duro: Puky se ríe, y tú eliges
    function caida() {
      est.activo = false; est.estado = 'caida';
      limpiar(); ui.instruccion(null);
      puky?.pose('que-rico', { rebote: 0.3 });
      sonido('puky-gracioso', { volumen: 0.6 });
      luego(0.5, () => puky?.decir('¿Me llamabais?', { dur: 2 }));
      ui.cartela('Puky te ha pringado entero. Blancaso sigue ahí: aún llegas.', 3);
      luego(2.2, () => {
        if (est.estado !== 'caida') return;
        const f = xr.adelante.clone().setY(0).normalize();
        const c = xr.cabeza.clone().addScaledVector(f, 0.45); c.y = xr.cabeza.y - 0.22;
        ui.tarjetasEn(['Otra vez, desde aquí', 'Dejarlo por hoy'], c, f.clone().negate(), t => { if (t === 'Dejarlo por hoy') dejarlo(); else retomar(); });
      });
      // si no eliges, sigue solo
      luego(11, () => { if (est.estado === 'caida') retomar(); });
    }
    function retomar() {
      if (est.estado !== 'caida' || est.acabado) return;
      ui.quitarTarjetas();
      est.rein++;
      est.vidaMax = Math.min(5, 3 + est.rein); est.vida = est.vidaMax; est.invul = 1.5;
      est.estado = 'juego'; est.activo = true; est.ataqueT = 2;
      puky?.pose(poseFase(), { rebote: 0.2 });
      ui.cartela(`Otra vez, desde aquí, con ${est.vidaMax} corazones`, 2);
      sonido('campanita', { volumen: 0.5 });
    }
    function dejarlo() {
      if (est.acabado) return;
      ui.quitarTarjetas();
      est.acabado = true; est.activo = false; est.estado = 'fin';
      const puntos = Math.round(progreso() * 100);
      luego(0.6, () => ctx.terminar({ puntos, gana: false, linea: 'Puky se sale con la suya. Nadie le había llamado. Como siempre.' }));
    }
    function victoria() {
      if (est.acabado) return;
      est.activo = false; est.acabado = true; est.estado = 'victoria';
      limpiar(); lata = null; lataM.visible = false; ui.instruccion(null);
      sonido('temblor', { volumen: 0.6 });
      puky?.pose('horror', { rebote: 0.3 }); puky?.tambalear(0.8);
      fx.chispas(aMundo(centroPuky()), '#f5d23a', 60, 2);
      luego(0.45, () => fx.chispas(aMundo(centroPuky()), '#fff6a8', 30, 1.5));
      luego(0.9, () => {
        puky?.pose('charco', { rebote: 0.4 }); sonido('chapoteo', { volumen: 0.7 });
        ui.cartela('¡RESCATADO!', 2); sonido('platillo', { volumen: 0.6 });
      });
      luego(1.9, () => {
        blancaso?.pose('esperanza', { rebote: 0.3 }); sonido('aaah', { volumen: 0.6 });
        blancaso?.decir('Gracias… otra vez.', { dur: 2.5 });
      });
      const t = est.tJuego;
      const puntos = Math.max(0, Math.round(1200 + est.vida * 150 - t * 5 + est.supers * 40 - est.golpes * 50 - est.rein * 150));
      luego(3.6, () => ctx.terminar({ puntos, gana: true, linea: `Puky, hecho un charco en ${Math.round(t)} s. A Blancaso se le limpian los ojos.` }));
    }

    // ---------- mover todo ----------
    function moverBalas(dt) {
      const c = centroPuky(_p);
      for (let i = balas.length - 1; i >= 0; i--) {
        const b = balas[i]; if (!b) continue; // un golpe puede acabar la partida y vaciarlo todo
        b.p.addScaledVector(b.v, dt); b.vida -= dt; b.giro += dt * 14;
        const pk = pukitos.find(k => k.p.distanceTo(_a.copy(b.p).setY(b.p.y - 0.12)) < 0.16);
        if (pk) { pk.hp--; pk.destello = 0.08; balas.splice(i, 1); if (pk.hp <= 0) aplastar(pk); continue; }
        if (b.p.distanceTo(c) < R_PUKY) { balas.splice(i, 1); danarPuky(1, b.p); continue; }
        if (b.vida <= 0) balas.splice(i, 1);
      }
    }
    function aplastar(pk, m = null) {
      const i = pukitos.indexOf(pk); if (i < 0) return;
      pukitos.splice(i, 1); est.aplastados++;
      fx.acierto(aMundo(_a.copy(pk.p).add(_b.set(0, 0.12, 0))), { mano: m, color: '#f5d23a', n: 14, sonido: 'chof' });
      charquito(pk.p);
    }
    function moverGotas(dt) {
      for (let i = gotas.length - 1; i >= 0; i--) {
        const g = gotas[i]; if (!g) continue;
        g.t += dt; g.v.y -= g.g * dt; g.p.addScaledVector(g.v, dt);
        if (g.devuelta) {
          if (g.p.distanceTo(centroPuky(_a)) < R_PUKY) { gotas.splice(i, 1); danarPuky(4, g.p); est.carga = Math.min(CARGA_MAX, est.carga + 2); fx.chispas(aMundo(g.p), '#5adceb', 14, 1); continue; }
          if (g.t > 2) gotas.splice(i, 1);
          continue;
        }
        // ¿la para una mano abierta?
        let parada = false;
        for (const m of MANOS()) {
          if (!m.activa || m.pinza || mano[m.lado].lleva) continue;
          const L = mano[m.lado];
          if (L.pos.distanceTo(g.p) < R_MANO + g.r * 0.5) {
            parada = true;
            if (L.vel.length() > MANOTAZO) {
              est.devueltas++;
              g.devuelta = true; g.g = 0; g.t = 0; g.v.copy(centroPuky(_a).sub(g.p).normalize().multiplyScalar(7));
              if (g.marca) g.marca.dur = 0;
              sonido('zas', { volumen: 0.4 }); sonido('campanita', { volumen: 0.4, tono: 1.2 });
              m.vibrar(0.8, 60); fx.chispas(aMundo(g.p), '#5adceb', 18, 1.2);
            } else {
              est.paradas++;
              sonido('bonk', { volumen: 0.4, tono: 1.2 }); m.vibrar(0.5, 40);
              fx.chispas(aMundo(g.p), '#fff3c4', 10, 0.6);
              if (g.marca) g.marca.dur = 0;
              gotas.splice(i, 1);
            }
            break;
          }
        }
        if (parada) continue;
        if (g.p.distanceTo(cab) < R_CAB + g.r * 0.5) { gotas.splice(i, 1); if (g.marca) g.marca.dur = 0; tocado(_a.copy(cab).setY(0), g.marca ? 'lluvia' : 'escupitajo'); continue; }
        if (g.p.y < 0.02) { gotas.splice(i, 1); charquito(g.p); if (Math.random() < 0.3) sonido('chof', { volumen: 0.15 }); continue; }
        if (g.p.z > cab.z + 1.5 || g.t > 5) gotas.splice(i, 1);
      }
    }
    function moverPukitos(dt) {
      for (let i = pukitos.length - 1; i >= 0; i--) {
        const k = pukitos[i]; if (!k) continue;
        k.t += dt; k.destello = Math.max(0, k.destello - dt);
        // un manotazo (o tocarlo) lo aplasta
        let fuera = false;
        for (const m of MANOS()) {
          if (!m.activa || mano[m.lado].lleva) continue;
          if (mano[m.lado].pos.distanceTo(_a.copy(k.p).setY(k.p.y + 0.12)) < R_MANO + 0.1) { aplastar(k, m); fuera = true; break; }
        }
        if (fuera) continue;
        if (k.estado === 'salta') {
          const dx = cab.x - k.p.x, dz = cab.z - k.p.z, d = Math.hypot(dx, dz);
          const vh = 0.85 * Math.sqrt(dif);
          k.p.x += dx / d * vh * dt; k.p.z += dz / d * vh * dt;
          k.vy -= 7 * dt; k.p.y += k.vy * dt;
          if (k.p.y <= 0) { k.p.y = 0; k.vy = 2.4; if (Math.random() < 0.4) sonido('boing', { volumen: 0.2 }); }
          if (d < 0.55) {
            k.estado = 'lanza'; k.t = 0;
            // se lanza a tu pecho: lo ves venir y hay medio segundo para el manotazo
            const pecho = _a.copy(cab).add(_b.set(0, -0.35, 0));
            k.v = pecho.clone().sub(k.p).divideScalar(0.55);
            sonido('puky-gracioso', { volumen: 0.3 });
          }
        } else {
          k.p.addScaledVector(k.v, dt);
          if (k.t >= 0.55) { pukitos.splice(i, 1); tocado(_a.copy(k.p).setY(0), 'pukito'); }
        }
      }
    }
    function moverMuros(dt) {
      let primero = null;
      for (let i = muros.length - 1; i >= 0; i--) {
        const w = muros[i]; if (!w) continue;
        const antes = w.z; w.z += w.v * dt;
        if (!w.pasado && antes < cab.z && w.z >= cab.z) {
          w.pasado = true;
          if (Math.hypot(cab.x - w.hx, cab.y - w.hy) > w.r - 0.04) tocado(null, 'muro');
          else { sonido('whoosh', { volumen: 0.5 }); fx.chispas(aMundo(_a.set(w.hx, w.hy, cab.z - 0.3)), '#b5e36b', 12, 0.8); }
        }
        if (w.z > cab.z + 0.8) { muros.splice(i, 1); continue; }
        if (!primero || w.z < primero.z) primero = w;
      }
      if (primero && primero.z < cab.z) {
        aroHueco.visible = true;
        aroHueco.position.set(primero.hx, primero.hy, primero.z + 0.02);
        aroHueco.scale.setScalar(primero.r * (1 + Math.sin(est.t * 10) * 0.04));
      } else aroHueco.visible = false;
    }

    // ---------- arranque ----------
    ctx.musica?.('jefe');
    ui.cartela('PUKY · EL BLANCAZO', 2.2);
    sonido('sting', { volumen: 0.6 });
    luego(0.6, () => ui.instruccion('Pellizca para disparar · esquiva con el cuerpo · para con la mano abierta'));
    luego(1.0, () => blancaso?.decir('Otra vez no…', { dur: 1.8 }));
    {
      const w = v => aMundo(v);
      const r0 = w(V(cab.x + 0.2, cab.y - 0.38, cab.z - 0.22)), r1 = w(V(cab.x + 0.2, cab.y - 0.2, cab.z - 0.45));
      const p0 = w(V(cab.x + 0.05, cab.y - 0.15, cab.z - 0.4)), p1 = w(V(cab.x - 0.25, cab.y - 0.05, cab.z - 0.42));
      fx.demo([{ p: r0 }, { p: r1, pinza: true }, { p: r1, pinza: true }, { p: p0 }, { p: p1 }], { dur: 3, tramo: 0.45, retraso: 0.4 });
    }
    luego(2.8, () => {
      if (est.acabado) return;
      ui.cartela('¡Que no cunda el amarillo!', 1.8); sonido('tiroriro', { volumen: 0.6 });
      est.estado = 'juego'; est.activo = true;
    });
    luego(7, () => { if (est.estado === 'juego') ui.instruccion(null); });
    pintarPanel();

    const api = {
      est, gotas, balas, pukitos, muros, marcas, cab, get lata() { return lata; }, get estado() { return est.estado; }, get fase() { return est.fase; },
      centroPuky: () => aMundo(centroPuky()), local: v => aLocal(v.clone()), mundo: v => aMundo(v.clone()),
    };
    grupo.userData.api = api;

    const qCab = new THREE.Quaternion(), _q = new THREE.Quaternion(), _qz = new THREE.Quaternion(), EJE_Z = V(0, 0, 1);
    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        leerCuerpo();
        for (let i = tareas.length - 1; i >= 0; i--) {
          const t = tareas[i];
          if (t.t <= est.t) { tareas.splice(i, 1); t.fn(); }
        }
        fx.actualizar(dt);
        est.invul -= dt; est.herido = Math.max(0, est.herido - dt);
        if (est.activo) {
          est.tJuego += dt;
          for (const m of MANOS()) {
            const L = mano[m.lado];
            L.disparoT -= dt;
            if (m.activa && m.pinza && !L.lleva && L.disparoT <= 0) { L.disparoT = CADENCIA; disparar(m, L); }
          }
          atacar(dt);
          if (est.fase === 3) { est.goteoT -= dt; if (est.goteoT <= 0) { est.goteoT = 0.9 / dif; goteo(); } }
          moverGotas(dt); moverPukitos(dt); moverMuros(dt);
        }
        moverBalas(dt);
        moverLata(dt);

        // ---------- Puky y Blancaso ----------
        if (puky) {
          const y = est.fase === 3 && est.activo ? 0.25 + Math.sin(est.t * 2.2) * 0.25 : Math.max(0, puky.grupo.position.y - dt * 0.8);
          puky.grupo.position.set(SITIO_PUKY.x, y, SITIO_PUKY.z);
          est.gesto = Math.max(0, est.gesto - dt);
          puky.actualizar(dt, xr.cabeza);
        }
        if (blancaso) blancaso.actualizar(dt, xr.cabeza);
        aura.visible = est.estado !== 'victoria';
        const pul = 1 + Math.sin(est.t * 4) * 0.1; aura.scale.set(pul, pul, 1); aura.material.opacity = 0.45 + Math.sin(est.t * 4) * 0.25;

        // ---------- dibujar: todo lo repetido, en una llamada por tipo ----------
        qCab.copy(qSi).multiply(xr.cabezaQ);
        for (const b of bandadas) b.empezar();
        for (const g of gotas) gotasB.poner(g.p, qCab, g.r * 2.4, g.devuelta ? _c.set('#9ff0ff') : COL_GOTA);
        for (const b of balas) { _q.copy(qCab).multiply(_qz.setFromAxisAngle(EJE_Z, b.giro)); balasB.poner(b.p, _q, 0.07); }
        for (const k of pukitos) {
          const sq = k.estado === 'salta' && k.p.y < 0.05 ? 0.75 : 1;
          pukitosB.poner(_a.copy(k.p).setY(k.p.y + 0.13 * sq), qCab, 0.26 / sq, k.destello > 0 ? _c.set('#ff9c9c') : null, 0.26 * sq);
        }
        for (const w of muros) {
          const cerca = clamp((cab.z - w.z) / 0.6, 0, 1); // se desvanece al pasarte por la cara
          _c.copy(COL_HUMO).multiplyScalar(0.55 + 0.45 * cerca);
          for (const f of w.puffs) humoB.poner(_a.set(f.x + Math.sin(est.t * 3 + f.f) * 0.03, f.y + Math.cos(est.t * 2.5 + f.f) * 0.03, w.z), qCab, f.s * (0.35 + 0.45 * cerca), _c);
        }
        for (let i = marcas.length - 1; i >= 0; i--) {
          const m = marcas[i]; m.t += dt;
          if (m.t >= m.dur) { marcas.splice(i, 1); continue; }
          const k = m.salpica ? 1 + m.t * 1.5 : 1 + Math.sin(m.t * 14) * 0.08;
          marcasB.poner(_a.set(m.x, 0.012, m.z), QSUELO, m.r * 2 * k, m.salpica ? _c.setRGB(1 - m.t / m.dur, 1 - m.t / m.dur, 0.6 * (1 - m.t / m.dur)) : null);
        }
        for (const b of bandadas) b.acabar();
        if (lata) { lataM.visible = true; lataM.position.copy(lata.p); lataM.quaternion.copy(qCab); if (lata.estado === 'vuela') lataM.rotateZ(est.t * 20); else lataM.rotateZ(Math.sin(est.t * 4) * 0.2); }
        pintarPanel();
      },
      destruir() {
        est.destruido = true; est.acabado = true; est.activo = false;
        ui.instruccion(null); ui.quitarTarjetas?.();
        fx.destruir();
        puky?.callar(); blancaso?.callar();
        for (const b of bandadas) b.quitar();
        for (const p of propias) p.dispose?.();
        if (grupo.userData.api === api) grupo.userData.api = null;
      },
      abandonar() {
        if (est.acabado) return;
        if (est.estado === 'caida') ui.quitarTarjetas();
        est.acabado = true; est.activo = false; est.estado = 'fin';
        limpiar(); ui.instruccion(null);
        ctx.terminar({ puntos: Math.round(progreso() * 100), gana: false, linea: 'Lo dejas a medias. Blancaso sigue derritiéndose en tu habitación.' });
      },
    };
  },
};
