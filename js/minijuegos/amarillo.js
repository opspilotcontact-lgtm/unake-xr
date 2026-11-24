// Tu propio amarillo · el jefe final, en VR nativo (escala «inmersivo»). Reglas de base/js/escenas/amarillo.js.
//
// Delante de ti, a 3 m, una versión ENORME, amarilla y deformada de Monchiman (obj-jefe-amarillo en cartón, 2,9 m,
// que respira y gotea). Tú eres Monchiman en primera persona:
//   DISPARAR  pellizco (o gatillo) sostenido: caramelos desde esa mano, hacia donde apunta.
//   ESQUIVAR  con el cuerpo: lo que te tira apunta a donde estaba tu cabeza al avisar (paso lateral, inclinarte,
//             agacharte). Las oleadas cubren un lado: apártate al otro.
//   PARAR     con la mano ABIERTA (sin pellizco): lo que toca se para. De un manotazo (mano rápida) se lo devuelves;
//             lo rosa devuelto pega el doble. También se para una oleada con la mano abierta, baja y por delante.
//             Así se puede jugar sentado.
// Cuatro fases, cada una con quien llega a ayudar (como en el 2D):
//   1. Sudor frío + Cotine: te lanza dulces; cógelo al vuelo y lánzaselo (o dale un puñetazo con él) = golpe fuerte.
//   2. El suelo se inclina (solo se inclina el jefe y lo suyo, nunca tu vista) + Lasslow: mete la mano en su nube y
//      tus tiros salen impulsados; solo así revientan los granos de arriba.
//   3. Todo da vueltas + la Pompa: su burbuja (delante de ti) lo frena todo; lo que entra se devuelve con tocarlo.
//   4. Lo que viene después + Puky: se pega al amarillo y abre el punto débil; dispara ahí cuando se abra.
// Ataques avisados (la boca se abre, marcas en el suelo, la franja de la oleada) y cortos. Sin game over duro: al
// caer, Blancaso te sienta un momento y retomas la fase con un corazón más (o lo dejas por hoy).
import * as THREE from 'three';

const AM = {
  zJefe: -3.0, altoJefe: 2.9,
  pool: [0, 46, 18, 30, 30],
  vBala: 9, vImp: 12, cadencia: 0.17, vidaBala: 0.8,
  rCabeza: 0.19, rMano: 0.16,
  manotazo: 1.6,           // m/s de la mano para devolver (y no solo parar)
  umbrales: [500, 1000, 1400],
};

const FASES = [
  null,
  { nombre: 'Sudor frío', quien: 'cotine', linea: 'Come, que es dulce.', mazo: ['sudor', 'arcada', 'oleada'], pausa: 1.6, color: 0xf5d23a,
    consejo: 'Coge el dulce de Cotine y lánzaselo' },
  { nombre: 'El suelo se inclina', quien: 'lasslow', linea: '¡Agárrese, caballero! JA…', mazo: ['inclina', 'sudor', 'oleada', 'arcada'], fijo: 'inclina', pausa: 1.4, color: 0xf0c21f,
    consejo: 'Mano en la nube de Lasslow y dispara' },
  { nombre: 'Todo da vueltas', quien: 'la-pompa', linea: '…Respira.', mazo: ['arcada', 'sudor', 'oleada'], fijo: 'arcada', pausa: 1.2, color: 0xe9b20f,
    consejo: 'En la burbuja, devuélveselo todo' },
  { nombre: 'Lo que viene después', quien: 'puky', linea: '¿Me llamabais?', mazo: ['arcada', 'sudor', 'oleada'], pausa: 1.3, color: 0xdc9f0b,
    consejo: 'Dispara a Puky cuando se abra' },
];
// granos de la fase 2 y puntos de Puky, en fracciones del dibujo del jefe (u: -0.5..0.5 de ancho, v: 0..1 de alto)
const GRANOS = [[-0.19, 0.87], [-0.045, 0.8], [-0.23, 0.7], [0.12, 0.85], [-0.125, 0.63], [0.08, 0.66]];
const PUNTOS_PUKY = [[-0.1, 0.37], [-0.19, 0.23], [0.12, 0.3], [0, 0.42]];
const ANIMO = [['palicaso', '¡Escucha, escucha! ¡Tú puedes!'], ['perico', 'Pin pin. Aguanta. Aguanta.']];

const TINTA = '#140c1c', PAPEL = '#fffaf0', CARTON = '#b98d5e';
const V = () => new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;
const azar = (a, b) => a + Math.random() * (b - a);
const quitarDe = (l, x) => { const i = l.indexOf(x); if (i >= 0) l.splice(i, 1); };
const barajar = l => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const sale = k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); // easeOutBack

const COL_BLANCO = new THREE.Color('#ffffff');
const MAT_TINTA = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, g, t };
}
function materialSilueta(color, map) {
  const m = new THREE.MeshBasicMaterial({ color, map, alphaTest: 0.5 });
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
  m.customProgramCacheKey = () => 'silueta-am';
  return m;
}

// muchas esferas iguales en una sola llamada (más su contorno de tinta en otra)
const _m4 = new THREE.Matrix4(), _q0 = new THREE.Quaternion(), _s = V(), _s2 = V(), _pp = V(), _col = new THREE.Color();
class Enjambre {
  constructor(geo, max, padre, conTinta = true) {
    this.max = max;
    this.m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), max);
    this.m.setColorAt(0, _col.set('#ffffff'));
    this.m.count = 0; this.m.frustumCulled = false; padre.add(this.m);
    if (conTinta) { this.t = new THREE.InstancedMesh(geo, MAT_TINTA, max); this.t.count = 0; this.t.frustumCulled = false; padre.add(this.t); }
  }
  // fn(item, pos, escala, color, quat) rellena; devuelve false para saltarlo
  pintar(listas, fn) {
    let n = 0;
    for (const lista of listas) for (const it of lista) {
      if (n >= this.max) break;
      _q0.identity();
      if (fn(it, _pp, _s, _col, _q0) === false) continue;
      this.m.setMatrixAt(n, _m4.compose(_pp, _q0, _s)); this.m.setColorAt(n, _col);
      if (this.t) this.t.setMatrixAt(n, _m4.compose(_pp, _q0, _s2.copy(_s).multiplyScalar(1.25)));
      n++;
    }
    this.m.count = n; this.m.instanceMatrix.needsUpdate = true; this.m.instanceColor.needsUpdate = true;
    if (this.t) { this.t.count = n; this.t.instanceMatrix.needsUpdate = true; }
  }
  quitar() { this.m.geometry.dispose(); this.m.material.dispose(); this.m.dispose(); this.t?.dispose(); }
}

// ======================================================================================
export default {
  clave: 'Amarillo', titulo: 'Tu propio amarillo', escala: 'inmersivo', umbrales: AM.umbrales,

  async crear(ctx) {
    const { xr, humo, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-amarillo';
    const propias = []; // texturas, geometrías y materiales que se liberan al salir
    const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };

    // ---------- banderas de partida: TODAS aquí («Otra vez» llama a crear de nuevo) ----------
    const nivel = ctx.nivel || 1;
    const dif = 1 + 0.12 * Math.min(nivel - 1, 8);
    const est = {
      estado: 'intro', activo: false, trans: false, fase: 0, tok: 0, t: 0, tE: 0, tJuego: 0,
      hp: 1, hpMax: 1, vida: 3, vidaMax: 3, rein: 0, invul: 0,
      golpes: 0, parrys: 0, bloqueos: 0, fuertes: 0, limpias: 0, golpeEnFase: false,
      mazo: [], bolsa: [], ultimoAtaque: '', ataqueT: 99,
      cotineT: 99, lanzados: 0, comioCotine: false, gas: 3, impulso: 0, boilReserva: 0,
      aturdido: false, cara: 'idle', caraT: 0, destello: 0, inclinaObj: 0, inclina: 0,
      animoT: 12, tipNormalGrano: false, tipBurbuja: false, tipParar: false, acabado: false, destruido: false,
      caidaT: 0, ultimoClank: 0, ultimoVibra: 0, lento: false, tiembla: 0, derrite: 0, matFondo: null, herido: 0, chispa: 0,
    };
    const eventos = []; // { t, fn, tok, jefe }: los del jefe corren en su tiempo (la burbuja los frena) y se cancelan con tok
    const prog = (seg, fn) => eventos.push({ t: est.tE + seg, fn, tok: est.tok, jefe: true });
    const luego = (seg, fn) => eventos.push({ t: est.t + seg, fn, tok: null, jefe: false });

    // ---------- dónde: la sala mira hacia donde miras, con el suelo en tu suelo ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const sala = new THREE.Group(); sala.name = 'sala-amarillo';
    sala.position.copy(xr.cabeza).setY(0); sala.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(sala); sala.updateMatrixWorld(true);
    const inv = sala.matrixWorld.clone().invert(), qS = sala.quaternion.clone(), qSi = qS.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(sala.matrixWorld);
    const alto0 = clamp(xr.cabeza.y, 1.0, 1.9);   // altura de tu cabeza al empezar (de pie o sentado)

    // ---------- arte ----------
    const pr = (n) => ctx.img(n).catch(e => { console.warn('amarillo: falta', n, e); return null; });
    const rc = (id, escala) => ctx.Recortable.crear(id, 'humo', { escala }).catch(e => { console.warn('amarillo: sin', id, e); return null; });
    const [texJefe, texDonut, texCaramelo, texGota, texNube, texCharco, texFondo, texMonch,
      cotine, lasslow, pompa, puky, blancaso, palicaso, perico] = await Promise.all([
      pr('obj-jefe-amarillo.png'), pr('obj-donut.png'), pr('obj-caramelo.png'), pr('fx-gota-sudor.png'), pr('fx-nube-pedo.png'),
      pr('fx-charco-amarillo.png'), pr('bg-dentro.jpg'), pr('monchiman.png'),
      rc('cotine', 1.05), rc('lasslow', 1.25), rc('la-pompa', 1.1), rc('puky', 1.5), rc('blancaso', 1.1), rc('palicaso', 1.0), rc('perico', 1.15),
    ]);
    const quien = { cotine, lasslow, 'la-pompa': pompa, puky, blancaso, palicaso, perico };
    if (est.destruido) return { grupo, actualizar() { }, destruir() { } };

    // ---------- la sala: tu cuarto del humo, oscuro y amarilleando fase a fase ----------
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), new THREE.MeshBasicMaterial({ color: '#1d1426', side: THREE.BackSide }));
    sala.add(cielo); propias.push(cielo.geometry, cielo.material);
    if (texFondo) {
      const tf = texFondo.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(2, 1); tf.offset.x = -0.33; tf.needsUpdate = true; propias.push(tf);
      const fondo = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 8, 48, 1, true, Math.PI - 1.75, 3.5), new THREE.MeshBasicMaterial({ color: '#7a6a62', map: tf, side: THREE.BackSide }));
      fondo.position.y = 3.2; sala.add(fondo); propias.push(fondo.geometry, fondo.material);
      est.matFondo = fondo.material;
    }
    const tablones = (() => {
      const { g, t } = lz(256, 256);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#6b4a2a', '#5f4225', '#73502e', '#664627'][i]; g.fillRect(i * 64, 0, 64, 256);
        g.fillStyle = 'rgba(20,12,28,.6)'; g.fillRect(i * 64, 0, 4, 256);
        g.fillStyle = 'rgba(20,12,28,.3)'; g.beginPath(); g.arc(i * 64 + 30, 50 + i * 47, 4, 0, 7); g.fill();
      }
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.needsUpdate = true; return t;
    })();
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: '#c9b9a0', map: tablones }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.002; sala.add(suelo); propias.push(suelo.geometry, suelo.material);

    // ---------- el amarillo: cartón enorme sobre su «tarima» (lo único que se inclina) ----------
    const tarima = new THREE.Group(); tarima.position.set(0, 0, AM.zJefe); sala.add(tarima);
    const jefe = new THREE.Group(); tarima.add(jefe);
    const IW = texJefe?.image?.width || 285, IH = texJefe?.image?.height || 320;
    const JH = AM.altoJefe, JW = JH * IW / IH;
    const px = (x, y, z = 0, out = V()) => out.set((x / IW - 0.5) * JW, (1 - y / IH) * JH, z);
    const uv = (u, v, z = 0, out = V()) => out.set(u * JW, v * JH, z);
    const matJefe = new THREE.MeshBasicMaterial({ map: texJefe, alphaTest: 0.5, color: '#ffffff' });
    const matBorde = materialSilueta(PAPEL, texJefe), matCanto = materialSilueta(CARTON, texJefe);
    propias.push(matJefe, matBorde, matCanto);
    const PLANO = new THREE.PlaneGeometry(1, 1); propias.push(PLANO);
    const carton = new THREE.Group(); jefe.add(carton);
    {
      const canto = new THREE.Mesh(PLANO, matCanto); canto.scale.set(JW * 1.04, JH * 1.03, 1); canto.position.set(0, JH / 2, -0.03);
      const borde = new THREE.Mesh(PLANO, matBorde); borde.scale.set(JW * 1.04, JH * 1.03, 1); borde.position.set(0, JH / 2, -0.01);
      const frente = new THREE.Mesh(PLANO, matJefe); frente.scale.set(JW, JH, 1); frente.position.set(0, JH / 2, 0);
      carton.add(canto, borde, frente);
    }
    const colorJefe = new THREE.Color('#ffffff'), colorFase = new THREE.Color('#ffffff');
    function tinteFase(hex) {
      // como el 2D (cada fase lo calienta), pero a medias: que siga siendo AMARILLO
      const g = (hex >> 8) & 0xff, b = hex & 0xff;
      colorFase.setRGB(1, clamp((255 - (0xf5 - g) * 3) / 255, 0, 1), clamp((255 - (0xd2 - b) * 2) / 255, 0, 1)).lerp(COL_BLANCO, 0.5);
    }
    // la cara que avisa: la boca abierta (tele) y los ojos en espiral (mareo)
    const texBoca = (() => {
      const { g, t } = lz(256, 200);
      g.fillStyle = TINTA; g.beginPath(); g.ellipse(128, 100, 118, 90, 0, 0, 7); g.fill();
      g.fillStyle = '#4a2a0a'; g.beginPath(); g.ellipse(128, 100, 100, 72, 0, 0, 7); g.fill();
      g.fillStyle = '#ff6fb0'; g.beginPath(); g.ellipse(128, 142, 62, 26, 0, 0, 7); g.fill();
      g.fillStyle = '#f5d23a'; g.fillRect(96, 30, 14, 34); g.fillRect(150, 30, 14, 44);
      t.needsUpdate = true; return t;
    })();
    const texMareo = (() => {
      const { g, t } = lz(256, 128);
      for (const [cx, s] of [[64, 1], [192, -1]]) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, 64, 56, 0, 7); g.fill();
        g.strokeStyle = TINTA; g.lineWidth = 8; g.beginPath(); g.arc(cx, 64, 56, 0, 7); g.stroke();
        g.lineWidth = 7; g.beginPath();
        for (let a = 0; a < 9.5; a += 0.2) { const r = 2 + a * 5; const x = cx + Math.cos(a * s) * r, y = 64 + Math.sin(a * s) * r; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      t.needsUpdate = true; return t;
    })();
    const BOCA = px(150, 112, 0.04), OJOS = px(146, 84, 0.04);
    const boca = new THREE.Mesh(PLANO, new THREE.MeshBasicMaterial({ map: texBoca, transparent: true, depthWrite: false }));
    boca.scale.set(0.5, 0.39, 1); boca.position.copy(BOCA); boca.visible = false; jefe.add(boca);
    const mareo = new THREE.Mesh(PLANO, new THREE.MeshBasicMaterial({ map: texMareo, transparent: true, depthWrite: false }));
    mareo.scale.set(0.56, 0.28, 1); mareo.position.copy(OJOS); mareo.visible = false; jefe.add(mareo);
    propias.push(boca.material, mareo.material);
    const ponerCara = (c, seg) => { est.cara = c; est.caraT = seg; };

    // ---------- marcador encima del amarillo ----------
    const marc = lz(1024, 190);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7 * 190 / 1024), new THREE.MeshBasicMaterial({ map: marc.t, transparent: true, depthWrite: false }));
    panel.position.set(0, JH + 0.28, AM.zJefe + 0.25); sala.add(panel); propias.push(panel.geometry, panel.material);
    let clavePanel = '';
    function pintarPanel() {
      const segs = [1, 2, 3, 4].map(i => i < est.fase ? 0 : i > est.fase ? 1 : Math.max(0, est.hp / est.hpMax));
      const clave = [segs.map(s => s.toFixed(2)).join(), est.vida, est.vidaMax, est.fase, Math.floor(est.gas), est.impulso > 0, est.herido > 0].join('|');
      if (clave === clavePanel) return; clavePanel = clave;
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.82)'; g.beginPath(); g.roundRect(4, 4, 1016, 182, 24); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '34px Caprasimo, serif'; g.lineWidth = 6; g.strokeStyle = TINTA; g.strokeText('TU PROPIO AMARILLO', 512, 34); g.fillStyle = '#ffd23f'; g.fillText('TU PROPIO AMARILLO', 512, 34);
      for (let i = 0; i < 4; i++) {
        const x = 64 + i * 230, w = 206;
        g.fillStyle = TINTA; g.fillRect(x - 4, 66, w + 8, 34);
        g.fillStyle = '#3a3048'; g.fillRect(x, 70, w, 26);
        g.fillStyle = i + 1 === est.fase ? '#ffd23f' : '#c9a516'; g.fillRect(x, 70, w * segs[i], 26);
      }
      for (let i = 0; i < est.vidaMax; i++) {
        const x = 70 + i * 66, y = 146, lleno = i < est.vida;
        g.globalAlpha = lleno ? 1 : 0.3;
        if (texMonch?.image) { const im = texMonch.image, h = 58, w = h * im.width / im.height; g.drawImage(im, x - w / 2, y - h / 2, w, h); }
        else { g.fillStyle = '#ff5fa2'; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); }
        g.globalAlpha = 1;
      }
      if (est.fase === 2) {
        g.font = '30px Caprasimo, serif'; g.fillStyle = est.impulso > 0 ? '#9be86a' : '#fff3c4';
        g.textAlign = 'right'; g.fillText(est.impulso > 0 ? '¡IMPULSO!' : 'NUBE', 790, 146); g.textAlign = 'center';
        for (let i = 0; i < 3; i++) { g.fillStyle = i < Math.floor(est.gas) ? '#9be86a' : '#3a3048'; g.beginPath(); g.arc(840 + i * 56, 146, 20, 0, 7); g.fill(); }
      }
      if (est.herido > 0) { g.strokeStyle = '#ff5fa2'; g.lineWidth = 10; g.beginPath(); g.roundRect(8, 8, 1008, 174, 22); g.stroke(); }
      t.needsUpdate = true;
    }

    // ---------- los de la aso: ayudante a la izquierda, el coro a la derecha ----------
    const SITIO_AYUDA = new THREE.Vector3(-1.25, 0, -1.6);
    const SITIOS_CORO = { palicaso: new THREE.Vector3(1.45, 0, -2.0), perico: new THREE.Vector3(1.85, 0.0, -1.45), blancaso: new THREE.Vector3(1.15, 0, -1.3) };
    const animaciones = []; // aparecer/moverse con rebote: { r, t, dur, de, a, desde, hasta }
    for (const r of Object.values(quien)) if (r) { r.grupo.visible = false; sala.add(r.grupo); }
    for (const [k, p] of Object.entries(SITIOS_CORO)) if (quien[k]) { quien[k].grupo.position.copy(p); quien[k].grupo.visible = true; }
    function aparecer(r, pos, dur = 0.45) { if (!r) return; r.grupo.visible = true; r.grupo.position.copy(pos); r.grupo.scale.setScalar(0.01); animaciones.push({ r, t: 0, dur, tipo: 'escala' }); sonido('pop', { volumen: 0.35 }); }
    function irA(r, pos, dur = 0.8) { if (!r) return; animaciones.push({ r, t: 0, dur, tipo: 'ir', desde: r.grupo.position.clone(), hasta: pos.clone() }); }
    function esconder(r) { if (!r) return; r.callar(); r.grupo.visible = false; }
    let hablando = null;
    function voz(r, texto, dur) { if (!r || est.destruido) return; if (hablando && hablando !== r) hablando.callar(); r.decir(texto, { dur }); hablando = r; }
    const hayVoz = () => !!hablando?.bocadillo?.malla.visible;
    let ayudante = null;
    function cambiarAyuda(n) {
      const id = FASES[n].quien;
      if (ayudante && ayudante !== quien[id]) esconder(ayudante);
      ayudante = null;
      if (id === 'puky') return;
      const r = quien[id]; if (!r) return;
      ayudante = r;
      if (!r.grupo.visible) aparecer(r, SITIO_AYUDA);
      r.pose(id === 'lasslow' ? 'pedo-disimulo' : id === 'la-pompa' ? 'meciendose' : 'base', { rebote: 0.1 });
    }

    // ---------- proyectiles, marcas y oleadas ----------
    const GEO_BOLA = new THREE.SphereGeometry(1, 14, 10); propias.push(GEO_BOLA);
    const GEO_ARO = new THREE.RingGeometry(0.78, 1, 32); GEO_ARO.rotateX(-Math.PI / 2); propias.push(GEO_ARO);
    const bolas = new Enjambre(GEO_BOLA, 40, sala);      // lo del jefe y lo devuelto
    const balas = new Enjambre(GEO_BOLA, 36, sala);      // tus caramelos
    const aros = new Enjambre(GEO_ARO, 24, sala, false); // marcas y salpicaduras en el suelo
    const enemigos = [];  // { tipo: 'sudor'|'arco', p, v, g, r, rosa, spr? }
    const aliadas = [];   // { tipo: 'normal'|'imp'|'fuerte'|'devuelta', p, v, vida, rosa, zPrev, dirigida, spr? }
    const marcas = [];    // { x, z, r, t, dur, color, tipo: 'aviso'|'salpica' }
    const olas = [];      // { x0, x1, z, zPrev, v, malla, franja }
    const COL = { amarillo: new THREE.Color('#f5d23a'), rosa: new THREE.Color('#ff6fb0'), sudor: new THREE.Color('#8fd8ff'), bala: new THREE.Color('#ffd6ea'), imp: new THREE.Color('#9be86a'), suelo: new THREE.Color('#6b4a2a'), blanco: new THREE.Color('#fff6e8') };

    // sprites reutilizables (gotas, dulces, donuts lanzados)
    function poolSprites(tex, n) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 }); propias.push(mat);
      const libres = [];
      return {
        coger(tam) { const s = libres.pop() || (() => { const m = mat.clone(); propias.push(m); return new THREE.Sprite(m); })(); s.visible = true; s.scale.set(tam, tam * (tex?.image ? tex.image.height / tex.image.width : 1), 1); s.material.rotation = 0; sala.add(s); return s; },
        soltar(s) { s.visible = false; sala.remove(s); if (libres.length < n) libres.push(s); },
      };
    }
    const sprGota = poolSprites(texGota, 8), sprDonut = poolSprites(texDonut, 4), sprCaramelo = poolSprites(texCaramelo, 4);

    // oleada: textura de ola de dibujo, y franja de aviso en el suelo
    const texOla = (() => {
      const { g, t } = lz(256, 128);
      g.fillStyle = TINTA; g.fillRect(0, 48, 256, 80);
      for (const x of [32, 96, 160, 224]) { g.beginPath(); g.arc(x, 54, 38, 0, 7); g.fill(); }
      g.fillStyle = '#f5d23a'; g.fillRect(0, 56, 256, 72);
      for (const x of [32, 96, 160, 224]) { g.beginPath(); g.arc(x, 54, 30, 0, 7); g.fill(); }
      g.fillStyle = '#fff6a8'; for (const x of [20, 84, 148, 212]) { g.beginPath(); g.arc(x, 42, 8, 0, 7); g.fill(); }
      g.fillStyle = '#d9b400'; g.fillRect(0, 112, 256, 16);
      t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t;
    })();
    const texFranja = (() => {
      const { g, t } = lz(128, 256);
      g.fillStyle = 'rgba(245,210,58,.35)'; g.fillRect(0, 0, 128, 256);
      g.strokeStyle = 'rgba(255,246,168,.95)'; g.lineWidth = 14; g.lineJoin = 'round';
      for (const y of [40, 120, 200]) { g.beginPath(); g.moveTo(24, y); g.lineTo(64, y + 36); g.lineTo(104, y); g.stroke(); }
      t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
    })();
    const matOla = new THREE.MeshBasicMaterial({ map: texOla, alphaTest: 0.4, side: THREE.DoubleSide });
    const matFranja = new THREE.MeshBasicMaterial({ map: texFranja, transparent: true, depthWrite: false });
    propias.push(matOla, matFranja);

    // granos (fase 2), punto de Puky (fase 4), nube de Lasslow y burbuja de la Pompa
    const texGrano = (() => {
      const { g, t } = lz(128, 128);
      g.fillStyle = TINTA; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.fillStyle = '#e8832a'; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(64, 64, 36, 0, 7); g.fill();
      g.fillStyle = '#fff6a8'; g.beginPath(); g.arc(55, 55, 15, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(50, 50, 5, 0, 7); g.fill();
      t.needsUpdate = true; return t;
    })();
    const texAro = (color, grosor) => { const { g, t } = lz(256, 256); g.strokeStyle = TINTA; g.lineWidth = grosor + 10; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke(); g.strokeStyle = color; g.lineWidth = grosor; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke(); t.needsUpdate = true; return t; };
    const texHueco = (() => { const { g, t } = lz(256, 256); g.fillStyle = TINTA; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.fillStyle = '#4a2a0a'; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.fill(); g.fillStyle = '#2a1405'; g.beginPath(); g.arc(128, 140, 64, 0, 7); g.fill(); t.needsUpdate = true; return t; })();
    const texBurbuja = (() => {
      const { g, t } = lz(512, 512);
      const r = g.createRadialGradient(256, 256, 150, 256, 256, 250);
      r.addColorStop(0, 'rgba(191,234,255,0.04)'); r.addColorStop(0.85, 'rgba(191,234,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0.0)');
      g.fillStyle = r; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 236, 0, 7); g.stroke();
      g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.arc(256, 256, 200, 3.5, 4.3); g.stroke();
      t.needsUpdate = true; return t;
    })();
    const spr = (tex, tam, padre, extra = {}) => { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, ...extra }); propias.push(m); const s = new THREE.Sprite(m); s.scale.set(tam, tam, 1); padre.add(s); return s; };
    const granos = []; // { u, v, hp, max, s, aro, t }
    const hueco = spr(texHueco, 0.42, jefe); hueco.visible = false;
    const aroPuky = spr(texAro('#ff5fa2', 18), 0.6, jefe); aroPuky.visible = false;
    const nube = spr(texNube, 0.34, sala); nube.visible = false;
    const NUBE = new THREE.Vector3(-0.42, alto0 - 0.32, -0.36);
    // la burbuja se queda delante de ti (no te envuelve la cabeza): se ve a través, solo el borde
    const burbuja = spr(texBurbuja, 1.3, sala); burbuja.visible = false;
    const BURBUJA = new THREE.Vector3(0, alto0 - 0.15, -1.0), R_BURBUJA = 0.68, TAM_BURBUJA = 1.4;
    const charco = new THREE.Mesh(PLANO, new THREE.MeshBasicMaterial({ map: texCharco, transparent: true, depthWrite: false }));
    charco.rotation.x = -Math.PI / 2; charco.position.set(0, 0.01, AM.zJefe + 0.4); charco.visible = false; sala.add(charco); propias.push(charco.material);

    // textos que saltan (¡CONTRA!, ¡Ahora!)
    const etiquetas = [];
    function etiqueta(texto, color, pos, tam = 0.3) {
      const { g, t } = lienzo(512, 128);
      g.font = '84px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText(texto, 256, 66); g.fillStyle = color; g.fillText(texto, 256, 66);
      t.needsUpdate = true;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      s.renderOrder = 35; s.scale.set(tam * 4, tam, 1); s.position.copy(pos); sala.add(s);
      etiquetas.push({ s, vida: 1.1 });
    }

    // ---------- tú: cabeza y manos en el espacio de la sala ----------
    const cab = V();
    const mano = { derecha: { pos: V(), punta: V(), vel: V(), disp: 0, dulce: null }, izquierda: { pos: V(), punta: V(), vel: V(), disp: 0, dulce: null } };
    const MANOS = () => [xr.manos.derecha, xr.manos.izquierda];
    const abierta = m => m.activa && !m.pinza && !m.agarre;
    function leerCuerpo() {
      aLocal(xr.cabeza, cab);
      for (const m of MANOS()) {
        const L = mano[m.lado];
        if (!m.activa) continue;
        aLocal(m.pos, L.pos); aLocal(m.punta, L.punta); L.vel.copy(m.vel).applyQuaternion(qSi);
      }
    }
    function vibrar(f, ms, soloMano = null) { for (const m of soloMano ? [soloMano] : MANOS()) if (m.activa) m.vibrar(f, ms); }

    // ---------- apuntar (como la escopeta de Tiro al pato: palma + hombro→mano, filtrado) ----------
    const _a = V(), _b = V(), _c = V(), _d = V();
    function medirDireccion(m, out) {
      out.set(0, 0, -1).applyQuaternion(m.quat);
      if (m.esMano) {
        const f = _a.copy(xr.adelante).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
        const lado = m.lado === 'derecha' ? 1 : -1;
        const hombro = _b.copy(xr.cabeza).add(_c.set(-f.z * 0.17 * lado, -0.2, f.x * 0.17 * lado));
        const rayo = _c.copy(m.pos).sub(hombro);
        if (rayo.lengthSq() > 1e-4) out.add(rayo.normalize()).normalize();
      }
      return out.applyQuaternion(qSi); // a la sala
    }
    const dirs = { derecha: new THREE.Vector3(0, 0, -1), izquierda: new THREE.Vector3(0, 0, -1) };

    // ---------- a dónde se dispara (para la ayuda de puntería y el bot) ----------
    const _j = V();
    function aSala(vJefe, out = V()) { jefe.localToWorld(out.copy(vJefe)); return aLocal(out, out); }
    function blancos() {
      const l = [];
      if (est.fase === 2) for (const g of granos) l.push(aSala(uv(g.u, g.v, 0.06)));
      if (est.fase === 4 && pk?.abierto) l.push(aSala(uv(pk.u, pk.v, 0.06)));
      l.push(aSala(_j.set(0, JH * 0.5, 0)));
      return l;
    }

    // ---------- tus disparos ----------
    function disparar(m, L) {
      const dir = dirs[m.lado];
      // ayuda de puntería suave: si casi apuntas a un blanco, el tiro se dobla un poco hacia él
      let mejor = null, mejorCos = Math.cos(THREE.MathUtils.degToRad(8));
      for (const b of blancos()) { const d = _d.copy(b).sub(L.pos).normalize(); const cs = d.dot(dir); if (cs > mejorCos) { mejorCos = cs; mejor = b; } }
      const v = dir.clone();
      if (mejor) v.lerp(_d.copy(mejor).sub(L.pos).normalize(), 0.35).normalize();
      const imp = est.fase === 2 && est.impulso > 0;
      aliadas.push({ tipo: imp ? 'imp' : 'normal', p: L.pos.clone().addScaledVector(v, 0.08), v: v.multiplyScalar(imp ? AM.vImp : AM.vBala), vida: AM.vidaBala, zPrev: null });
      if (Math.random() < 0.3) sonido('pop', { volumen: 0.12, tono: imp ? 0.8 : 1.3 + Math.random() * 0.3 });
      m.vibrar(0.12, 12);
    }
    function lanzarFuerte(desde, vel) {
      est.fuertes++;
      const meta = blancos()[0];
      const dir = vel.clone().normalize().lerp(_d.copy(meta).sub(desde).normalize(), 0.6).normalize();
      const s = sprDonut.coger(0.26);
      aliadas.push({ tipo: 'fuerte', p: desde.clone(), v: dir.multiplyScalar(7), vida: 2, zPrev: null, dirigida: true, spr: s });
      sonido('fiuuu', { volumen: 0.6 });
    }
    function devolver(e, m) {
      est.parrys++;
      est.invul = Math.max(est.invul, 0.3);
      const meta = blancos()[0];
      const v = meta.clone().sub(e.p).normalize().multiplyScalar(8);
      aliadas.push({ tipo: 'devuelta', p: e.p.clone(), v, vida: 2.5, rosa: e.rosa, zPrev: null, dirigida: true });
      sonido('campanita', { volumen: 0.5 }); sonido('zas', { volumen: 0.35 });
      vibrar(0.8, 60, m);
      etiqueta(e.rosa ? '¡CONTRA x2!' : '¡CONTRA!', '#ff5fa2', e.p.clone().add(_d.set(0, 0.25, -0.2)), 0.16);
    }
    function bloquear(e, m) {
      est.bloqueos++;
      sonido('bonk', { volumen: 0.4, tono: 1.2 }); sonido('chof', { volumen: 0.25 });
      vibrar(0.5, 40, m);
      salpica(e.p.x, e.p.z, e.tipo === 'sudor' ? COL.sudor : COL.amarillo);
      if (!est.tipParar && est.bloqueos === 2) { est.tipParar = true; consejo('De un manotazo, se lo devuelves', 3.2); }
    }

    // ---------- daño al jefe ----------
    function dano(b) {
      const f = est.fase;
      // en VR apuntar es más fácil que saltar en el 2D: el caramelo pega menos y el gesto de cada fase manda
      if (b.tipo === 'normal') return [0, 0.5, 0.5, 0.15, 0.6][f];
      if (b.tipo === 'imp') return 1.5;
      if (b.tipo === 'fuerte') return [0, 9, 6, 5, 7][f];
      return (b.rosa ? 2 : 1) * [0, 3, 3, 5, 5][f];
    }
    const dentroCuerpo = l => ((l.x) / (JW * 0.36)) ** 2 + ((l.y - JH * 0.5) / (JH * 0.44)) ** 2 <= 1;
    function clank() {
      if (est.t - est.ultimoClank > 0.22) { est.ultimoClank = est.t; sonido('bonk', { volumen: 0.15, tono: 1.4 }); }
    }
    // b llega al plano del jefe en `l` (coordenadas del jefe). Devuelve true si se gasta.
    function impacta(b, l) {
      if (est.trans || !est.activo) return dentroCuerpo(l);
      const f = est.fase, d = dano(b);
      if (f === 2) {
        for (const g of granos) {
          if (Math.hypot(l.x - g.u * JW, l.y - g.v * JH) < 0.24) {
            if (b.tipo === 'normal') { clank(); if (!est.tipNormalGrano) { est.tipNormalGrano = true; consejo('Sin impulso rebota: ¡a la nube!', 3.5); } return true; }
            danarGrano(g, d); return true;
          }
        }
        if (dentroCuerpo(l)) { clank(); return true; }
        return false;
      }
      if (f === 4) {
        if (pk?.abierto && Math.hypot(l.x - pk.u * JW, l.y - pk.v * JH) < 0.32) { danarJefe(d, b); return true; }
        if (dentroCuerpo(l)) { if (b.tipo === 'devuelta') danarJefe(1.5, b); else clank(); return true; }
        return false;
      }
      if (dentroCuerpo(l)) { danarJefe(d, b); return true; }
      return false;
    }
    function danarJefe(d, b) {
      est.hp -= d;
      const fuerte = b.tipo !== 'normal';
      if (fuerte) est.destello = 0.09; else est.chispa = 0.05; // el caramelo solo aclara un poco (sin parpadeo)
      if (est.cara === 'idle' || est.caraT <= 0) ponerCara('golpe', 0.1);
      if (fuerte) { sonido('golpe', { volumen: 0.45 }); vibrar(0.6, 50); }
      else if (est.t - est.ultimoVibra > 0.12) { est.ultimoVibra = est.t; vibrar(0.2, 12); }
      if (est.hp <= 0.001) terminaFase();
    }
    function danarGrano(g, d) {
      const real = Math.min(d, g.hp); g.hp -= real; est.hp -= real;
      g.flash = 0.06; vibrar(0.4, 30);
      if (g.hp <= 0.001) {
        granos.splice(granos.indexOf(g), 1);
        jefe.remove(g.s, g.aro);
        sonido('chof', { volumen: 0.6 }); vibrar(0.9, 80);
        const p = aSala(uv(g.u, g.v, 0.1));
        humo.soltar({ pos: aMundo(p), vel: new THREE.Vector3(0, 0.4, 0).applyQuaternion(qS), tam: 0.12, vida: 0.9, crece: 0.4, sube: 0.2, frena: 1.5, brillo: 0.9 });
        if (est.hp > 0.001) prog(0.7, nuevosGranos);
      }
      if (est.hp <= 0.001) terminaFase();
    }

    // ---------- consejos, voces y ánimo ----------
    let consejoHasta = 0;
    function consejo(texto, seg) { ui.instruccion(texto); consejoHasta = est.t + seg; }

    // ---------- fases ----------
    function mazoDe(n) {
      const F = FASES[n];
      const resto = barajar(F.mazo.filter(p => p !== F.fijo));
      return (F.fijo ? [F.fijo] : []).concat(resto).slice(0, 3);
    }
    function iniciarFase(n, primera = false) {
      est.fase = n; est.tok++; est.trans = false; est.golpeEnFase = false; est.activo = true; est.estado = 'juego';
      est.hpMax = est.hp = AM.pool[n];
      est.mazo = mazoDe(n); est.bolsa = []; est.ataqueT = primera ? 1.8 : 2.4;
      est.aturdido = false; ponerCara('idle', 0);
      tinteFase(FASES[n].color);
      if (est.matFondo) est.matFondo.color.set('#7a6a62').lerp(new THREE.Color('#c9a64a'), 0.12 * n);
      cambiarAyuda(n);
      consejo(FASES[n].consejo, n === 1 ? 6 : 5);
      if (n === 1) {
        est.cotineT = 1.2;
        ui.cartela('¡Que no cunda el amarillo!', 2.4);
        sonido('tiroriro', { volumen: 0.5 });
        luego(0.7, () => voz(ayudante, FASES[1].linea, 1.8));
      } else {
        ui.cartela(`Fase ${n}: ${FASES[n].nombre}`, 2.2);
        if (n !== 4) luego(0.9, () => voz(ayudante, FASES[n].linea, 1.9));
      }
      for (const g of granos) jefe.remove(g.s, g.aro); granos.length = 0;
      nube.visible = n === 2;
      if (n === 2) { est.gas = 3; est.impulso = 0; est.boilReserva = AM.pool[2]; prog(0.9, nuevosGranos); }
      if (n === 3) pb = { estado: 'espera', t: 2.6, pos: V(), k: 0 };
      if (n === 4) llegaPuky();
    }
    function terminaFase() {
      if (est.trans) return;
      est.trans = true; est.hp = 0;
      if (!est.golpeEnFase) est.limpias++;
      limpiar();
      ponerCara('golpe', 1.1); est.destello = 0.12;
      sonido('cristal', { volumen: 0.5 }); sonido('oooh', { volumen: 0.35 });
      vibrar(1, 120);
      const p = aMundo(_d.set(0, JH * 0.55, AM.zJefe + 0.2));
      for (let i = 0; i < 6; i++) humo.soltar({ pos: p.clone().add(_c.set(azar(-0.6, 0.6), azar(-0.5, 0.6), 0)), vel: new THREE.Vector3(azar(-0.3, 0.3), 0.3, 0.2), tam: 0.2, vida: 1.2, crece: 0.4, sube: 0.15, frena: 1.4, brillo: 0.9 });
      if (est.fase === 4) { victoria(); return; }
      const siguiente = est.fase + 1;
      luego(1.4, () => { if (est.activo && !est.acabado) iniciarFase(siguiente); });
    }
    function limpiar() {
      for (const e of enemigos) if (e.spr) sprGota.soltar(e.spr);
      for (const a of aliadas) if (a.spr) sprDonut.soltar(a.spr);
      enemigos.length = 0; aliadas.length = 0; marcas.length = 0;
      for (const o of olas) quitarOla(o); olas.length = 0;
      for (const d of dulces) quitarDulce(d); dulces.length = 0;
      for (const L of Object.values(mano)) L.dulce = null;
      est.tok++;
      salirBurbuja(); if (pb) pb.estado = 'cd';
      est.inclinaObj = 0;
      if (pk) { pk.abierto = false; hueco.visible = aroPuky.visible = false; }
    }

    // ---------- ataques ----------
    function atacar(dtE) {
      if (est.trans || est.aturdido) return;
      if (est.fase === 4 && (!pk || pk.estado !== 'cerrado' || pk.t < 1.2)) return;
      est.ataqueT -= dtE; if (est.ataqueT > 0) return;
      if (!est.bolsa.length) {
        est.bolsa = barajar([...est.mazo]);
        if (est.bolsa.length > 1 && est.bolsa[est.bolsa.length - 1] === est.ultimoAtaque) est.bolsa.reverse();
      }
      const p = est.bolsa.pop(); est.ultimoAtaque = p;
      const dur = { sudor: pSudor, arcada: pArcada, oleada: pOleada, inclina: pInclina }[p]();
      est.ataqueT = dur + FASES[est.fase].pausa / dif;
    }
    function marca(x, z, seg, color, r = 0.2) { marcas.push({ x, z, r, t: 0, dur: seg, color, tipo: 'aviso' }); }
    function salpica(x, z, color) { marcas.push({ x, z, r: 0.12, t: 0, dur: 0.5, color, tipo: 'salpica' }); }
    const BOCA_SALA = () => aSala(_j.copy(BOCA).setZ(0.15));

    // sudor frío: gotas que caen donde estabas, con su marca en el suelo
    function pSudor() {
      const n = (est.fase === 1 ? 3 : 4) + (nivel >= 3 ? 1 : 0);
      ponerCara('tele', 0.6);
      sonido('goteo', { volumen: 0.4 });
      const cols = [[cab.x, cab.z]];
      for (let i = 0; i < 40 && cols.length < n; i++) {
        const x = clamp(cab.x + azar(-1.1, 1.1), -1.3, 1.3), z = clamp(cab.z + azar(-0.5, 0.4), -1.2, 0.6);
        if (cols.every(([a, b]) => Math.hypot(a - x, b - z) > 0.42)) cols.push([x, z]);
      }
      barajar(cols).forEach(([x, z], i) => {
        prog(0.3 + i * 0.34, () => {
          marca(x, z, 0.95, COL.sudor, 0.2);
          prog(0.42, () => {
            const s = sprGota.coger(0.16);
            enemigos.push({ tipo: 'sudor', p: new THREE.Vector3(x, 3.1, z), v: new THREE.Vector3(0, -1.6, 0), g: 9.8, r: 0.07, rosa: false, spr: s });
            sonido('goteo', { volumen: 0.25, tono: 1.3 });
          });
        });
      });
      return 0.3 + n * 0.34 + 1.2;
    }
    // arcadas: la boca se abre y escupe en arco hacia donde estás (una rosa: esa se devuelve doble)
    function pArcada() {
      const n = nivel >= 2 || est.fase >= 3 ? 4 : 3;
      ponerCara('tele', 0.9);
      sonido('arcada', { volumen: 0.4 });
      const rosa = Math.floor(Math.random() * n);
      const objetivo = cab.clone();
      const offs = [0, 0.48, -0.48, 0.95].slice(0, n); barajar(offs);
      offs.forEach((o, i) => {
        const meta = objetivo.clone().add(_d.set(o, azar(-0.1, 0.1), 0));
        marca(meta.x, meta.z, 1.0 + i * 0.22 + 0.9, i === rosa ? COL.rosa : COL.amarillo, 0.16);
        prog(0.9 + i * 0.22, () => {
          const desde = BOCA_SALA(), T = 1.15, g = 5;
          const v = meta.clone().sub(desde).divideScalar(T); v.y -= 0.5 * -g * T;
          enemigos.push({ tipo: 'arco', p: desde, v, g, r: 0.09, rosa: i === rosa });
          sonido('blurp', { volumen: 0.35 });
        });
      });
      return 0.9 + n * 0.22 + 1.3;
    }
    // oleada amarilla por el suelo: cubre un lado entero; apártate al otro (o párala con la mano abierta, baja)
    function pOleada(lado = null, retraso = 0) {
      const n = est.fase === 1 ? 1 : 2;
      ponerCara('tele', 0.8);
      animEstiron = 0.5;
      for (let i = 0; i < n; i++) {
        prog(retraso + i * 1.5, () => {
          const s = lado ?? (Math.random() < 0.5 ? -1 : 1);
          const borde = cab.x - s * 0.15;
          const x0 = Math.min(borde, borde + s * 1.7), x1 = Math.max(borde, borde + s * 1.7);
          nuevaOla(x0, x1, 0.9);
        });
      }
      return retraso + (n - 1) * 1.5 + 2.9;
    }
    function nuevaOla(x0, x1, aviso) {
      const ancho = x1 - x0, cx = (x0 + x1) / 2;
      const franja = new THREE.Mesh(PLANO, matFranja);
      const largo = Math.abs(AM.zJefe) + 1.2;
      franja.scale.set(ancho, largo, 1); franja.rotation.x = -Math.PI / 2; franja.position.set(cx, 0.012, AM.zJefe + largo / 2);
      sala.add(franja);
      const o = { x0, x1, z: AM.zJefe + 0.3, zPrev: AM.zJefe + 0.3, v: (1.9 + 0.2 * est.fase) * Math.sqrt(dif), malla: null, franja, aviso, vivo: true };
      olas.push(o);
      sonido('temblor', { volumen: 0.2 });
    }
    function quitarOla(o) { if (o.malla) sala.remove(o.malla); if (o.franja) sala.remove(o.franja); o.vivo = false; }
    // el suelo se inclina (fase 2): SOLO el amarillo y lo suyo; luego ruedan oleadas por el lado que baja
    function pInclina() {
      ponerCara('tele', 1.0);
      const dir = Math.random() < 0.5 ? -1 : 1; // +1: baja su derecha (tu izquierda)… se mide en x de la sala
      ui.cartela('¡El suelo se inclina!', 1.2);
      sonido('temblor', { volumen: 0.35 });
      est.tiembla = 0.9;
      prog(0.9, () => { est.inclinaObj = dir * 0.17; sonido('whoosh', { volumen: 0.4 }); });
      // al inclinarse a +z, baja el lado de x negativa (rotation.z > 0 sube +x): la ola rueda por el lado bajo
      const ladoBajo = dir > 0 ? -1 : 1;
      prog(1.9, () => nuevaOla(...rango(ladoBajo), 0.7));
      prog(3.4, () => nuevaOla(...rango(ladoBajo), 0.7));
      prog(4.8, () => { est.inclinaObj = 0; });
      return 5.4;
    }
    const rango = s => { const borde = cab.x - s * 0.15; return [Math.min(borde, borde + s * 1.7), Math.max(borde, borde + s * 1.7)]; };
    let animEstiron = 0;

    // ---------- fase 1: Cotine y sus dulces ----------
    const dulces = []; // { p, v, estado: 'vuela'|'mano'|'suelo', m, t, spr }
    function cotineLanza() {
      if (dulces.length >= 2 || !cotine || ayudante !== cotine) return;
      est.lanzados++;
      // Cotine se come lo que cocina (una vez por partida)
      if (est.lanzados === 3 && !est.comioCotine) {
        est.comioCotine = true; cotine.empujon(0.2); sonido('nam', { volumen: 0.5 });
        voz(cotine, '¿Qué? Tenía hambre.', 1.6); return;
      }
      const desde = cotine.grupo.position.clone().add(_d.set(0.2, 0.75, 0.05));
      const meta = cab.clone().add(_d.set(azar(-0.15, 0.25), -0.38, -0.42));
      const T = 1.3, g = 5;
      const v = meta.clone().sub(desde).divideScalar(T); v.y += 0.5 * g * T;
      const caramelo = Math.random() < 0.5 && texCaramelo;
      const s = (caramelo ? sprCaramelo : sprDonut).coger(0.17);
      dulces.push({ p: desde, v, g, estado: 'vuela', m: null, t: 0, spr: s, pool: caramelo ? sprCaramelo : sprDonut });
      cotine.empujon(0.18); sonido('pop', { volumen: 0.35 });
    }
    function quitarDulce(d) { d.pool.soltar(d.spr); }
    function moverDulces(dt) {
      for (let i = dulces.length - 1; i >= 0; i--) {
        const d = dulces[i]; d.t += dt;
        if (d.estado === 'vuela') {
          d.v.y -= d.g * dt; d.p.addScaledVector(d.v, dt);
          d.spr.material.rotation += dt * 5;
          // cogerlo: pellizco o puño cerca, o que caiga en la mano abierta
          for (const m of MANOS()) {
            const L = mano[m.lado];
            if (!m.activa || L.dulce) continue;
            const dist = Math.min(L.pos.distanceTo(d.p), L.punta.distanceTo(d.p));
            if (((m.empiezaPinza || m.empiezaAgarre) && dist < 0.3) || (abierta(m) && dist < 0.2)) {
              d.estado = 'mano'; d.m = m; d.t = 0; L.dulce = d;
              sonido('nam', { volumen: 0.45 }); vibrar(0.5, 40, m);
              if (est.fuertes === 0) consejo('¡Lánzaselo, o un puñetazo!', 3);
              break;
            }
          }
          if (d.estado === 'vuela' && d.p.y < 0.05) { d.estado = 'suelo'; d.t = 0; d.p.y = 0.05; }
          if (d.p.z > 2.5) { quitarDulce(d); dulces.splice(i, 1); continue; }
        } else if (d.estado === 'mano') {
          const L = mano[d.m.lado];
          d.p.copy(L.pos);
          // lanzarlo o un puñetazo: la mano va rápido hacia delante
          const adelante = -L.vel.z;
          if (d.t > 0.12 && adelante > 1.4 && L.vel.length() > 1.6) {
            L.dulce = null; quitarDulce(d); dulces.splice(i, 1);
            lanzarFuerte(L.pos.clone(), L.vel.clone()); vibrar(0.8, 70, d.m);
            continue;
          }
          if (!d.m.activa || d.t > 12) { L.dulce = null; d.estado = 'vuela'; d.v.set(0, 0, 0); d.g = 9.8; }
        } else if (d.t > 2.5) { quitarDulce(d); dulces.splice(i, 1); continue; }
        d.spr.position.copy(d.p);
      }
    }

    // ---------- fase 2: granos ----------
    function nuevosGranos() {
      if (est.fase !== 2 || est.trans) return;
      while (granos.length < 2 && est.boilReserva > 0) {
        const libres = GRANOS.filter(([u, v]) => granos.every(g => Math.hypot((g.u - u) * JW, (g.v - v) * JH) > 0.45));
        const [u, v] = (libres.length ? libres : GRANOS)[Math.floor(Math.random() * (libres.length || GRANOS.length))];
        const hp = Math.min(6, est.boilReserva); est.boilReserva -= hp;
        const s = spr(texGrano, 0.34, jefe); s.position.copy(uv(u, v, 0.06)); s.scale.setScalar(0.01);
        const aro = spr(texAro('#fff6e8', 12), 0.5, jefe); aro.position.copy(uv(u, v, 0.05));
        granos.push({ u, v, hp, max: hp, s, aro, t: 0, flash: 0 });
        sonido('chof', { volumen: 0.3 });
      }
    }

    // ---------- fase 3: la burbuja de la Pompa (tarde, pero llega) ----------
    let pb = null;
    function logicaPompa(dt) {
      if (!pb || !pompa) return;
      pb.t -= dt;
      if (pb.estado === 'espera' && pb.t <= 0) { pb.estado = 'avisa'; pb.t = 1.5; voz(pompa, '…No.', 1.4); pompa.pose('respondiendo-tarde'); }
      else if (pb.estado === 'avisa' && pb.t <= 0) {
        pb.estado = 'viene'; pb.t = 1.2; pb.k = 0;
        pb.desde = pompa.grupo.position.clone().add(_d.set(0.1, 0.7, 0.1));
        burbuja.visible = true; sonido('hinchar', { volumen: 0.4 });
      } else if (pb.estado === 'viene') {
        pb.k = clamp(1 - pb.t / 1.2, 0, 1);
        burbuja.position.lerpVectors(pb.desde, BURBUJA, pb.k);
        burbuja.scale.setScalar(0.2 + pb.k * (TAM_BURBUJA - 0.2));
        if (pb.t <= 0) {
          pb.estado = 'dentro'; pb.t = 5.5; est.lento = true; pompa.pose('meciendose');
          sonido('plop', { volumen: 0.5 }); vibrar(0.3, 40);
          if (!est.tipBurbuja) { est.tipBurbuja = true; consejo('Todo va lento: toca lo que entre', 4); }
        }
      } else if (pb.estado === 'dentro') {
        burbuja.scale.setScalar(TAM_BURBUJA + Math.sin(est.t * 3) * 0.03);
        if (pb.t <= 0) { salirBurbuja(); pb.estado = 'cd'; pb.t = 3.6; }
      } else if (pb.estado === 'cd' && pb.t <= 0) { pb.estado = 'espera'; pb.t = 0.2; }
    }
    function salirBurbuja() {
      if (!burbuja.visible) return;
      burbuja.visible = false; est.lento = false;
      sonido('pop', { volumen: 0.4 });
      humo.soltar({ pos: aMundo(BURBUJA), vel: new THREE.Vector3(0, 0.2, 0), tam: 0.25, vida: 0.8, crece: 0.6, sube: 0.1, frena: 2, brillo: 1, alfa: 0.5 });
    }
    const enBurbuja = p => est.lento && p.distanceTo(BURBUJA) < R_BURBUJA;

    // ---------- fase 4: Puky llega el último y se pega al amarillo ----------
    let pk = null;
    function llegaPuky() {
      if (!puky) return;
      const desde = new THREE.Vector3(-2.4, 0, -2.0);
      puky.grupo.visible = true; puky.grupo.position.copy(desde); puky.grupo.scale.setScalar(1);
      puky.pose('base');
      pk = { estado: 'llega', t: 2.5, u: 0, v: 0, idx: -1, abierto: false, desde, hasta: new THREE.Vector3(-1.0, 0, AM.zJefe + 0.35) };
      luego(0.5, () => voz(puky, '¿Me llamabais?', 1.7));
      luego(2.3, () => voz(blancaso, '…Esta vez sí.', 1.8));
    }
    function siguientePunto() { let i; do { i = Math.floor(Math.random() * PUNTOS_PUKY.length); } while (i === pk.idx); pk.idx = i; [pk.u, pk.v] = PUNTOS_PUKY[i]; }
    function pukySalta(dur) {
      siguientePunto();
      pk.estado = 'salta'; pk.t = dur; pk.dur = dur; pk.desdeSalto = puky.grupo.position.clone();
      puky.pose('base'); sonido('boing', { volumen: 0.3 });
    }
    // pegado al punto; cuando avisa y se abre, se aparta a un lado tirando de él (que el hueco se vea)
    function posPuky(out) {
      const aparte = pk.estado === 'aviso' || pk.estado === 'abierto' ? (pk.u > 0 ? -0.36 : 0.36) / JW : 0;
      aSala(uv(pk.u + aparte, pk.v, 0.14), out); out.y -= (puky.alto ?? 0.8) * 0.55; return out;
    }
    function logicaPuky(dtE) {
      if (!pk || !puky) return;
      pk.t -= dtE;
      if (pk.estado === 'llega') {
        const k = clamp(1 - pk.t / 2.5, 0, 1);
        puky.grupo.position.lerpVectors(pk.desde, pk.hasta, k);
        puky.grupo.position.y = Math.abs(Math.sin(k * 14)) * 0.04;
        if (pk.t <= 0) pukySalta(0.7);
      } else if (pk.estado === 'salta') {
        const k = clamp(1 - pk.t / pk.dur, 0, 1);
        posPuky(_c);
        puky.grupo.position.lerpVectors(pk.desdeSalto, _c, k); puky.grupo.position.y += Math.sin(k * Math.PI) * 0.5;
        if (pk.t <= 0) { pk.estado = 'cerrado'; pk.t = 2.8 / Math.sqrt(dif); puky.pose('abrazo', { rebote: 0.25 }); sonido('chof', { volumen: 0.4 }); }
      } else {
        posPuky(_c); puky.grupo.position.lerp(_c, Math.min(1, dtE * 8));
        if (pk.estado === 'cerrado' && pk.t <= 0) {
          pk.estado = 'aviso'; pk.t = 0.7;
          aroPuky.visible = true; aroPuky.position.copy(uv(pk.u, pk.v, 0.1)); aroPuky.material.color.set('#fff6e8');
          sonido('campanita', { volumen: 0.4 });
        } else if (pk.estado === 'aviso' && pk.t <= 0) {
          pk.estado = 'abierto'; pk.t = 3.6; pk.abierto = true;
          est.aturdido = true; ponerCara('mareo', 99);
          hueco.visible = true; hueco.position.copy(uv(pk.u, pk.v, 0.08)); aroPuky.material.color.set('#ff5fa2');
          puky.pose('riendo');
          sonido('oooh', { volumen: 0.35 });
          etiqueta('¡Ahora!', '#ff5fa2', aSala(uv(pk.u, pk.v + 0.12, 0.3)), 0.28);
        } else if (pk.estado === 'abierto' && pk.t <= 0) {
          pk.abierto = false; est.aturdido = false; ponerCara('idle', 0);
          hueco.visible = aroPuky.visible = false;
          est.ataqueT = 1.0;
          pukySalta(0.6);
        }
      }
    }

    // ---------- golpes a ti ----------
    function tocado(p) {
      if (est.invul > 0 || !est.activo || est.trans) return;
      est.vida--; est.golpes++; est.golpeEnFase = true; est.invul = 1.5; est.herido = 0.5;
      sonido('golpe', { volumen: 0.6 }); sonido('chof', { volumen: 0.4 });
      vibrar(1, 180);
      if (p) salpica(p.x, p.z, COL.amarillo);
      // Lasslow se ríe justo en el momento serio
      if (ayudante === lasslow && Math.random() < 0.5) luego(0.4, () => voz(lasslow, 'JA… perdón.', 1.2));
      if (est.vida <= 0) caida();
    }
    // al caer: Blancaso te sienta un momento y retomas la fase con un corazón más
    function caida() {
      est.activo = false; est.estado = 'caida'; est.caidaT = 0;
      limpiar(); est.aturdido = false; ponerCara('tele', 2.5);
      ui.instruccion(null); consejoHasta = 0;
      sonido('suspiro', { volumen: 0.5 });
      if (blancaso) { irA(blancaso, new THREE.Vector3(cab.x + 0.6, 0, cab.z - 0.6), 0.7); blancaso.pose('esperanza'); }
      luego(0.6, () => voz(blancaso, 'Respira. Otra vez, desde aquí.', 2.2));
      ui.cartela('El amarillo te tumba. Blancaso te sienta un momento.', 3);
      luego(2.2, () => {
        if (est.estado !== 'caida') return;
        const f = xr.adelante.clone().setY(0).normalize();
        const c = xr.cabeza.clone().addScaledVector(f, 0.45); c.y = xr.cabeza.y - 0.22;
        ui.tarjetasEn(['Otra vez, desde aquí', 'Dejarlo por hoy'], c, f.clone().negate(), t => { if (t === 'Dejarlo por hoy') dejarlo(); else retomar(); });
      });
    }
    function retomar() {
      if (est.estado !== 'caida') return;
      ui.quitarTarjetas();
      est.rein++;
      est.vidaMax = Math.min(5, 3 + est.rein); est.vida = est.vidaMax; est.invul = 1.5;
      if (blancaso) { irA(blancaso, SITIOS_CORO.blancaso, 0.8); blancaso.pose('base'); }
      ui.cartela(`Retomas la fase ${est.fase} con un corazón más`, 2.2);
      sonido('campanita', { volumen: 0.5 });
      if (est.fase === 4 && puky) puky.grupo.visible = false;
      iniciarFase(est.fase, true);
    }
    function progreso() { return ((est.fase - 1) + (1 - Math.max(0, est.hp) / est.hpMax)) / 4; }
    function dejarlo() {
      if (est.acabado) return;
      ui.quitarTarjetas();
      est.acabado = true; est.activo = false; est.estado = 'fin';
      const puntos = Math.round(progreso() * 100);
      luego(0.6, () => ctx.terminar({ puntos, gana: false, linea: `Blancaso te sienta. La próxima vez, desde la fase ${est.fase}.` }));
    }

    // ---------- victoria: se deshace en un charco y todos alrededor ----------
    function victoria() {
      est.activo = false; est.estado = 'victoria'; est.acabado = true; est.tok++;
      ui.instruccion(null);
      if (pk) { pk.abierto = false; }
      hueco.visible = aroPuky.visible = false;
      ponerCara('golpe', 3);
      sonido('deshinchar', { volumen: 0.6 }); sonido('chapoteo', { volumen: 0.6 });
      vibrar(1, 250);
      est.derrite = 0;
      charco.visible = true; charco.scale.set(0.01, 0.01, 1);
      const gente = [[cotine, -0.9, -1.5], [lasslow, -0.45, -1.75], [blancaso, 0.5, -1.2], [pompa, 0.1, -1.9], [puky, -0.2, -1.3], [palicaso, 0.95, -1.6], [perico, 1.3, -1.25]];
      luego(1.7, () => gente.forEach(([r, x, z], i) => { if (!r) return; luego(i * 0.12, () => { r.pose(r === blancaso ? 'esperanza' : 'base', { rebote: 0 }); aparecer(r, new THREE.Vector3(cab.x + x, 0, cab.z + z), 0.3); }); }));
      luego(3.3, () => { sonido('aaah', { volumen: 0.5 }); voz(blancaso, 'Quédate. Aquí, en el suelo.', 2.4); });
      const t = Math.round(est.tJuego);
      const puntos = Math.max(0, Math.round(900 + est.vida * 150 + est.limpias * 120 + est.parrys * 25 + est.fuertes * 15 - est.tJuego * 3 - est.rein * 150));
      luego(5.5, () => ctx.terminar({ puntos, gana: true, linea: `Monchiman, en el suelo y todos alrededor. ${t} s, ${est.parrys} contras.` }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('jefe');
    sonido('sting', { volumen: 0.5 });
    ui.cartela('TU PROPIO AMARILLO · pellizca para disparar, esquiva con el cuerpo, para con la mano abierta', 3.2);
    luego(3.0, () => iniciarFase(1, true));

    // ---------- bucle ----------
    const _l = V(), _w = V();
    function moverAliadas(dt) {
      const tok0 = est.tok;
      for (const b of [...aliadas]) {
        if (est.tok !== tok0) break; // limpiar() en medio (fin de fase)
        if (b.dirigida && est.activo && !est.trans) {
          const meta = blancos()[0];
          const vel = b.v.length();
          b.v.lerp(_d.copy(meta).sub(b.p).normalize().multiplyScalar(vel), Math.min(1, dt * 3));
        }
        b.p.addScaledVector(b.v, dt); b.vida -= dt;
        if (b.spr) { b.spr.position.copy(b.p); b.spr.material.rotation += dt * 9; }
        // ¿cruza el plano del jefe?
        jefe.worldToLocal(aMundo(b.p, _l));
        let gastada = false;
        if (b.zPrev !== null && b.zPrev > 0 && _l.z <= 0) gastada = impacta(b, _l);
        b.zPrev = _l.z;
        if (gastada) {
          if (b.tipo !== 'normal') { salpica(b.p.x, AM.zJefe + 0.3, COL.amarillo); humo.soltar({ pos: aMundo(b.p, _w), vel: new THREE.Vector3(0, 0.3, 0), tam: 0.12, vida: 0.6, crece: 0.3, sube: 0.1, frena: 2, brillo: 0.9 }); }
        }
        if (est.tok !== tok0) break;
        if (gastada || b.vida <= 0 || _l.z < -1) { if (b.spr) sprDonut.soltar(b.spr); quitarDe(aliadas, b); }
      }
    }
    function moverEnemigos(dtE) {
      const tok0 = est.tok;
      for (const e of [...enemigos]) {
        if (est.tok !== tok0) break; // te han tumbado: limpiar() ya lo quitó todo
        const k =enBurbuja(e.p) ? 0.45 : 1;
        e.v.y -= e.g * dtE * k; e.p.addScaledVector(e.v, dtE * k);
        if (e.spr) e.spr.position.copy(e.p);
        let fuera = false;
        // tus manos (abiertas): paran; de un manotazo o dentro de la burbuja, lo devuelven
        if (est.activo && !est.trans) {
          for (const m of MANOS()) {
            if (!abierta(m)) continue;
            const L = mano[m.lado];
            if (Math.min(L.pos.distanceTo(e.p), L.punta.distanceTo(e.p)) < AM.rMano + e.r) {
              const rapida = L.vel.length() > AM.manotazo;
              if (rapida || enBurbuja(e.p) || (e.rosa && est.fase === 3)) devolver(e, m); else bloquear(e, m);
              fuera = true; break;
            }
          }
          if (!fuera && e.p.distanceTo(cab) < AM.rCabeza + e.r) { tocado(e.p); fuera = true; }
        }
        if (!fuera && e.p.y < 0.03) { salpica(e.p.x, e.p.z, e.tipo === 'sudor' ? COL.sudor : COL.amarillo); fuera = true; if (Math.random() < 0.4) sonido('chof', { volumen: 0.15 }); }
        if (!fuera && (e.p.z > 3 || Math.abs(e.p.x) > 6)) fuera = true;
        if (est.tok !== tok0) break;
        if (fuera) { if (e.spr) sprGota.soltar(e.spr); quitarDe(enemigos, e); }
      }
    }
    function moverOlas(dtE) {
      const tok0 = est.tok;
      for (const o of [...olas]) {
        if (est.tok !== tok0) break;
        if (!o.vivo) continue;
        if (o.aviso > 0) {
          o.aviso -= dtE;
          o.franja.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(est.t * 9));
          if (o.aviso <= 0) {
            const malla = new THREE.Mesh(PLANO, matOla);
            const t = texOla; void t;
            malla.scale.set(o.x1 - o.x0, 0.85, 1); malla.position.set((o.x0 + o.x1) / 2, 0.42, o.z);
            sala.add(malla); o.malla = malla;
            sonido('chapoteo', { volumen: 0.45 });
          }
          continue;
        }
        o.zPrev = o.z; o.z += o.v * dtE;
        o.malla.position.z = o.z; o.malla.position.y = 0.42 + Math.sin(est.t * 11) * 0.02;
        o.malla.scale.y = 0.6 + 0.25 * clamp((o.z - AM.zJefe) / 1.5, 0, 1);
        let fuera = false;
        if (est.activo && !est.trans) {
          // la mano abierta, baja y por delante, la para
          for (const m of MANOS()) {
            if (!abierta(m)) continue;
            const L = mano[m.lado];
            if (L.pos.y < cab.y - 0.15 && L.pos.z < cab.z - 0.15 && L.pos.x > o.x0 - 0.1 && L.pos.x < o.x1 + 0.1 && o.zPrev < L.pos.z && o.z >= L.pos.z) {
              est.bloqueos++; sonido('chapoteo', { volumen: 0.5 }); vibrar(0.7, 90, m);
              salpica(L.pos.x, L.pos.z, COL.amarillo); fuera = true; break;
            }
          }
          if (!fuera && o.zPrev < cab.z && o.z >= cab.z) {
            if (cab.x > o.x0 - 0.1 && cab.x < o.x1 + 0.1) tocado(_d.set(cab.x, 0, cab.z));
          }
        }
        if (est.tok !== tok0) break;
        if (fuera || o.z > 2.2) { quitarOla(o); quitarDe(olas, o); }
      }
    }
    function pintarCosas(dt) {
      bolas.pintar([enemigos.filter(e => e.tipo !== 'sudor'), aliadas.filter(a => a.tipo === 'devuelta')], (it, p, s, c) => {
        p.copy(it.p); s.setScalar(it.r ?? 0.1);
        c.copy(it.rosa ? COL.rosa : COL.amarillo);
        if (it.tipo === 'devuelta') s.setScalar(0.11);
      });
      balas.pintar([aliadas], (it, p, s, c) => {
        if (it.tipo !== 'normal' && it.tipo !== 'imp') return false;
        p.copy(it.p); s.setScalar(it.tipo === 'imp' ? 0.05 : 0.032); c.copy(it.tipo === 'imp' ? COL.imp : COL.bala);
      });
      for (let i = marcas.length - 1; i >= 0; i--) { marcas[i].t += dt; if (marcas[i].t >= marcas[i].dur) marcas.splice(i, 1); }
      aros.pintar([marcas], (m, p, s, c) => {
        p.set(m.x, 0.015, m.z);
        if (m.tipo === 'aviso') { const k = 1 + 0.15 * Math.sin(m.t * 18); s.set(m.r * k, 1, m.r * k); c.copy(m.color); }
        else { const k = m.t / m.dur; s.set(m.r * (1 + k * 2.5), 1, m.r * (1 + k * 2.5)); c.copy(m.color).lerp(COL.suelo, k); }
      });
    }
    function animarJefe(dt) {
      // respira y se balancea (solo él), se estira al soltar la oleada, tiembla al avisar de la inclinación
      const r = Math.sin(est.t * 2 * Math.PI / 1.8);
      let sx = 1 + 0.025 * r, sy = 1 - 0.025 * r;
      if (animEstiron > 0) { animEstiron -= dt; const k = Math.sin((0.5 - animEstiron) / 0.5 * Math.PI); sx += 0.07 * k; sy -= 0.1 * k; }
      if (est.estado === 'victoria') {
        est.derrite += dt;
        const k = clamp(est.derrite / 1.5, 0, 1), kk = k * k;
        sy = 1 - 0.92 * kk; sx = 1 + 0.2 * kk;
        if (k >= 1) jefe.visible = false;
        const kc = clamp((est.derrite - 0.5) / 1.4, 0, 1);
        const ce = 2.6 * Math.sin(kc * Math.PI / 2);
        charco.scale.set(ce, ce * 0.55, 1);
        if (est.derrite > 3) charco.material.opacity = Math.max(0, 1 - (est.derrite - 3) / 0.9);
      }
      jefe.scale.set(sx, sy, 1);
      jefe.rotation.z = Math.sin(est.t * 2 * Math.PI / 3.4) * 0.024 + (est.fase === 3 && est.activo ? Math.sin(est.t * 1.3) * 0.03 : 0);
      if (est.tiembla > 0) { est.tiembla -= dt; tarima.position.x = Math.sin(est.t * 60) * 0.015; } else tarima.position.x = 0;
      est.inclina += (est.inclinaObj - est.inclina) * Math.min(1, dt * 5);
      tarima.rotation.z = est.inclina;
      // color: el de la fase, destello blanco al recibir
      est.destello -= dt; est.herido -= dt;
      colorJefe.copy(colorFase);
      est.chispa = (est.chispa || 0) - dt;
      if (est.destello > 0 && est.estado === 'juego') colorJefe.setRGB(2.2, 2.2, 2.2);
      else if (est.chispa > 0) colorJefe.lerp(COL_BLANCO, 0.3);
      matJefe.color.copy(colorJefe);
      // cara
      if (est.caraT > 0) { est.caraT -= dt; if (est.caraT <= 0) est.cara = est.aturdido ? 'mareo' : 'idle'; }
      const cara = est.aturdido && est.cara === 'idle' ? 'mareo' : est.cara;
      boca.visible = cara === 'tele';
      if (boca.visible) boca.scale.set(0.5 * (1 + 0.08 * Math.sin(est.t * 30)), 0.39 * (1 + 0.08 * Math.sin(est.t * 30)), 1);
      mareo.visible = cara === 'mareo';
      if (mareo.visible) mareo.material.rotation = 0;
      // granos
      for (const g of granos) {
        g.t += dt; g.flash -= dt;
        g.s.scale.setScalar(0.34 * Math.min(1, sale(Math.min(1, g.t / 0.3))));
        g.s.material.opacity = g.flash > 0 ? 0.5 : 1;
        g.aro.scale.setScalar(0.5 * (1 + 0.15 * Math.abs(Math.sin(g.t * 3.5))));
      }
      if (aroPuky.visible) aroPuky.scale.setScalar(0.6 * (1 + 0.15 * Math.abs(Math.sin(est.t * (pk?.abierto ? 13 : 9)))));
      // la nube de Lasslow
      if (nube.visible) {
        const g = Math.floor(est.gas);
        nube.position.copy(NUBE).add(_d.set(0, Math.sin(est.t * 2) * 0.02, 0));
        nube.scale.setScalar(g > 0 ? 0.22 + 0.05 * g + (est.impulso > 0 ? 0.04 * Math.sin(est.t * 12) : 0) : 0.12);
        nube.material.opacity = g > 0 ? 0.95 : 0.35;
      }
    }

    // para el bot (herramientas/pruebas/bots/amarillo.js)
    const api = {
      est, get fase() { return est.fase; }, get estado() { return est.estado; },
      aMundo: v => aMundo(v), aLocal: v => aLocal(v),
      blanco: () => aMundo(blancos()[0]),
      enemigos: () => enemigos.map(e => ({ tipo: e.tipo, rosa: e.rosa, pos: aMundo(e.p), vel: e.v.clone().applyQuaternion(qS) })),
      olas: () => olas.map(o => ({ x0: o.x0, x1: o.x1, z: o.z, aviso: o.aviso })),
      marcas: () => marcas.filter(m => m.tipo === 'aviso').map(m => ({ x: m.x, z: m.z })),
      dulces: () => dulces.map(d => ({ estado: d.estado, pos: aMundo(d.p), lado: d.m?.lado })),
      nube: () => aMundo(NUBE), get gas() { return est.gas; }, get impulso() { return est.impulso; },
      get burbuja() { return est.lento; }, get puky() { return pk ? { estado: pk.estado, abierto: pk.abierto } : null; },
      granos: () => granos.length,
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        if (est.destruido) return;
        est.t += dt;
        const dtE = (est.activo && !est.trans && est.lento) ? dt * 0.6 : dt;
        est.tE += dtE;
        for (let i = eventos.length - 1; i >= 0; i--) {
          const e = eventos[i];
          if (e.tok !== null && e.tok !== est.tok) { eventos.splice(i, 1); continue; }
          if ((e.jefe ? est.tE : est.t) >= e.t) { eventos.splice(i, 1); try { e.fn(); } catch (err) { console.error(err); } }
        }
        leerCuerpo();
        if (consejoHasta && est.t > consejoHasta) { consejoHasta = 0; ui.instruccion(null); }

        // dirección de cada mano (filtrada) y disparos
        for (const m of MANOS()) {
          if (!m.activa) continue;
          const L = mano[m.lado];
          medirDireccion(m, _a);
          dirs[m.lado].lerp(_a, 1 - Math.exp(-dt * (m.esMano ? 14 : 40))).normalize();
          if (!est.activo || est.trans || L.dulce || !m.pinza) { L.disp = 0; continue; }
          if (m.empiezaPinza) L.disp = 0;
          L.disp -= dt;
          if (L.disp <= 0) { L.disp = AM.cadencia; disparar(m, L); }
        }

        if (est.activo) {
          est.tJuego += dt; est.invul -= dt;
          if (!est.trans) {
            if (est.fase === 1) { est.cotineT -= dtE; if (est.cotineT <= 0) { est.cotineT = 2.6 / Math.sqrt(dif); cotineLanza(); } }
            if (est.fase === 2) {
              est.gas = Math.min(3, est.gas + dt / 3);
              est.impulso = Math.max(0, est.impulso - dt);
              for (const m of MANOS()) {
                if (!m.activa || est.impulso > 0.5 || est.gas < 1) continue;
                const L = mano[m.lado];
                if (Math.min(L.pos.distanceTo(NUBE), L.punta.distanceTo(NUBE)) < 0.22) {
                  est.gas -= 1; est.impulso = 3.2;
                  sonido('pedo', { volumen: 0.5, tono: azar(0.9, 1.2) }); vibrar(0.6, 80, m);
                  humo.soltar({ pos: aMundo(NUBE), vel: new THREE.Vector3(0, 0.15, 0), tam: 0.12, vida: 1, crece: 0.4, sube: 0.1, frena: 2, brillo: 0.8 });
                  if (lasslow && Math.random() < 0.5) voz(lasslow, 'JA… Uy.', 1.0);
                  break;
                }
              }
            }
            if (est.fase === 3) logicaPompa(dtE);
            if (est.fase === 4) logicaPuky(dtE);
            atacar(dtE);
          }
          // ánimo del coro de vez en cuando
          est.animoT -= dt;
          if (est.animoT <= 0 && !hayVoz()) { est.animoT = azar(11, 16); const [k, s] = ANIMO[Math.floor(Math.random() * 2)]; voz(quien[k], s, 1.9); }
        } else if (est.estado === 'caida') {
          est.caidaT += dt;
          if (est.caidaT > 9) retomar(); // si no eliges, sigues tú solo
        }
        moverEnemigos(dtE); moverAliadas(dt); moverOlas(dtE); moverDulces(dt);
        pintarCosas(dt);
        animarJefe(dt);
        for (let i = animaciones.length - 1; i >= 0; i--) {
          const a = animaciones[i]; a.t += dt; const k = clamp(a.t / a.dur, 0, 1);
          if (a.tipo === 'escala') a.r.grupo.scale.setScalar(Math.max(0.01, sale(k)));
          else { a.r.grupo.position.lerpVectors(a.desde, a.hasta, k * k * (3 - 2 * k)); a.r.grupo.position.y = Math.sin(k * Math.PI) * 0.08; }
          if (k >= 1) animaciones.splice(i, 1);
        }
        for (const r of Object.values(quien)) if (r?.grupo.visible) r.actualizar(dt, xr.cabeza);
        for (let i = etiquetas.length - 1; i >= 0; i--) {
          const e = etiquetas[i]; e.vida -= dt;
          e.s.position.y += dt * 0.3; e.s.material.opacity = Math.min(1, e.vida * 2.5);
          if (e.vida <= 0) { sala.remove(e.s); e.s.material.map.dispose(); e.s.material.dispose(); etiquetas.splice(i, 1); }
        }
        pintarPanel();
      },
      destruir() {
        est.destruido = true; eventos.length = 0;
        ui.instruccion(null);
        if (est.estado === 'caida') ui.quitarTarjetas();
        for (const e of etiquetas) { e.s.material.map.dispose(); e.s.material.dispose(); }
        for (const o of olas) quitarOla(o);
        bolas.quitar(); balas.quitar(); aros.quitar();
        for (const p of propias) p.dispose?.();
        if (grupo.userData.api === api) grupo.userData.api = null;
      },
      // si el juego sale a mitad (no hay botón de salir en el contrato): cuenta como «no gana» con lo hecho
      abandonar() { if (!est.acabado && est.fase > 0) { est.acabado = true; est.activo = false; ctx.terminar({ puntos: Math.round(progreso() * 100), gana: false, linea: 'Lo dejas a medias.' }); } },
    };
  },
};
