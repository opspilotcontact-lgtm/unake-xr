// La Pompa pincha · VR nativo, escala «inmersivo». Reglas de base/js/escenas/dj.js.
//
// Estás en el techo del humo, de noche. Delante, a la altura de tu cintura (de pie o sentado), una mesa de DJ con
// TRES PLATOS (izquierda rosa, centro azul, derecha amarillo, como el ← ↓ → del 2D). A tu derecha, la Pompa pincha.
// Suena la canción de la serie (93,5 BPM, un golpe cada 0,6417 s) y las burbujas vienen flotando desde el fondo y
// caen cada una en su plato justo en el golpe. Un aro que se encoge sobre el plato marca cuándo llega.
//   TOCAR EL PLATO  baja la mano (o el mando) sobre el plato cuando la burbuja llegue al aro. Con el mando, también
//                   vale apretar el gatillo con la mano encima. Ventana generosa; nada castiga tocar de más.
// La canción suena dos veces: la segunda, con acordes (dos platos a la vez) y contratiempos. Nivel 3+: acordes desde
// la primera; nivel 5+: también los contratiempos. Cada burbuja que se escapa hincha a la Pompa; con 8, revienta.
// El ritmo sale del RELOJ DEL AUDIO (WebAudio, con su latencia de salida descontada), no de los fotogramas; si no hay
// audio (página de prueba sin gafas), de un reloj propio.
import * as THREE from 'three';
import { Jugo } from './jugo.js';
import { audio } from '../recursos.js';

const BPM_PERIODO = 0.6417, BPM_FASE = 0.06, DURACION_TEMA = 23.25;
const CAIDA = 1.6;                       // s que tarda una burbuja en llegar al plato
const V_PERFECTA = 0.09, V_BIEN = 0.2, V_BUSCA = 0.26;   // más generosas que en el 2D (manos que tiemblan)
const LAT_MANO = 0.035, LAT_MANDO = 0.012;               // lo que tarda en llegar la posición de la mano/mando
const PRESION_MAX = 8;
const COLORES = ['#ff5fa2', '#5ad1ff', '#ffd23f'];
const TINTA = '#140c1c';
const R_PLATO = 0.13, SEP = 0.3, Z_PLATO = -0.4;
let BUF = null, CARGANDO = null;        // la canción, decodificada una vez para todas las partidas

function cargarTema() {
  const ac = audio();
  if (!ac || BUF) return Promise.resolve(BUF);
  if (!CARGANDO) CARGANDO = fetch('base/assets/snd/musica-intro.mp3').then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(b => { BUF = b; return b; }).catch(() => { CARGANDO = null; return null; });
  return CARGANDO;
}

// Las notas sobre los golpes del tema (como el 2D): 1.ª vuelta, una por golpe; 2.ª, acordes y contratiempos.
function componer(nivel, semilla) {
  const notas = [];
  const azar = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let k = 2; ; k++) {
      const t = BPM_FASE + k * BPM_PERIODO;
      if (t > DURACION_TEMA - 0.5) break;
      const base = vuelta * DURACION_TEMA + t;
      const carril = Math.floor(azar() * 3);
      notas.push({ t: base, carril });
      if ((vuelta === 1 || nivel >= 3) && k % 4 === 3) notas.push({ t: base, carril: (carril + 1 + Math.floor(azar() * 2)) % 3 });
      if ((vuelta === 1 || nivel >= 5) && k % 2 === 1 && t + BPM_PERIODO / 2 < DURACION_TEMA - 0.5) {
        // el contratiempo, en otro plato (en VR una mano no llega a dar dos veces el mismo en 0,3 s con soltura)
        notas.push({ t: base + BPM_PERIODO / 2, carril: (carril + 1 + Math.floor(azar() * 2)) % 3 });
      }
    }
  }
  return notas.sort((a, b) => a.t - b.t).map((n, i) => ({ ...n, i, juzgada: false, pos: new THREE.Vector3(), viva: false }));
}

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, g: c.getContext('2d'), t };
}

export default {
  clave: 'DJ', titulo: 'La Pompa pincha', escala: 'inmersivo', umbrales: [4000, 8000, 12000],
  sitioTarjetas: { d: 0.5, bajo: 0.12 },
  ayudas: { gatillo: 'Con el mando encima del plato: golpe', lateral: 'Baja el mando al plato', mano: { pellizco: 'Toca el plato', puno: 'Toca el plato' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-dj';
    const propias = [];
    const fx = new Jugo(ctx, grupo);

    // ---------- banderas de partida: TODAS aquí («Otra vez» llama a crear de nuevo) ----------
    const nivel = ctx.nivel || 1;
    const est = {
      fase: 'intro', puntos: 0, combo: 0, mejorCombo: 0, presion: 0, aciertos: 0, perfectos: 0, fallos: 0,
      vuelta: 0, T: -99, reloj: 0, acabado: false, destruido: false, avisoExplota: false, audio: false,
    };
    const notas = componer(nivel, 1 + Math.floor(Math.random() * 5000));
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: est.reloj + s, fn });
    let tema = null;
    ctx.musica?.(null); // una sola música: la del bar se apaga, aquí suena la canción de la serie
    cargarTema();

    // ---------- dónde: la cabina mira hacia donde miras, el suelo en tu suelo ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const sala = new THREE.Group(); sala.name = 'sala-dj';
    sala.position.copy(xr.cabeza).setY(0); sala.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(sala); sala.updateMatrixWorld(true);
    const inv = sala.matrixWorld.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(sala.matrixWorld);
    const hP = THREE.MathUtils.clamp(xr.cabeza.y - 0.55, 0.55, 1.2);  // la altura de los platos: tu cintura
    const PLATOS = [0, 1, 2].map(i => V((i - 1) * SEP, hP, Z_PLATO));

    // ---------- arte ----------
    const pr = n => ctx.img(n).catch(e => { console.warn('dj: falta', n, e); return null; });
    const [texVinilo, texTecho, pompa] = await Promise.all([
      pr('obj-vinilo.png'), pr('bg-techo.jpg'),
      ctx.Recortable.crear('la-pompa', 'humo', { escala: 1.25 }).catch(e => { console.warn('dj: sin la Pompa', e); return null; }),
    ]);
    if (est.destruido) return { grupo, actualizar() { }, destruir() { }, abandonar() { } };

    // el techo del humo: cielo oscuro y el fondo del 2D en un cilindro lejano (late con el golpe)
    const matCielo = new THREE.MeshBasicMaterial({ color: '#1d1426', side: THREE.BackSide });
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(30, 20, 10), matCielo); sala.add(cielo);
    propias.push(cielo.geometry, matCielo);
    let matFondo = null;
    if (texTecho) {
      const tf = texTecho.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(2, 1); tf.needsUpdate = true; propias.push(tf);
      matFondo = new THREE.MeshBasicMaterial({ color: '#5a4a62', map: tf, side: THREE.BackSide });
      const fondo = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 8, 40, 1, true, Math.PI - 1.9, 3.8), matFondo);
      fondo.position.y = 3; sala.add(fondo); propias.push(fondo.geometry, matFondo);
    }
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: '#2a1f36' }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.002; sala.add(suelo); propias.push(suelo.geometry, suelo.material);

    // ---------- la mesa de DJ: un tablero (sin patas: si estás sentado, no te pisa las rodillas) ----------
    {
      const m = new THREE.Mesh(new THREE.BoxGeometry(SEP * 2 + 0.42, 0.045, 0.36), new THREE.MeshBasicMaterial({ color: '#3a2d4f' }));
      m.position.set(0, hP - 0.03, Z_PLATO - 0.01); sala.add(m); propias.push(m.geometry, m.material);
      // el canto que mira hacia ti, de neón: late con el golpe
      const borde = new THREE.Mesh(new THREE.BoxGeometry(SEP * 2 + 0.46, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#b68cff' }));
      borde.position.set(0, hP - 0.03, Z_PLATO + 0.17); sala.add(borde); propias.push(borde.geometry, borde.material);
      est.borde = borde;
    }

    // ---------- los platos: vinilos que giran (una llamada), aros de color (otra) y el aro que avisa (otra) ----------
    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _p = V(), _c = new THREE.Color();
    const QSUELO = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2);
    const matVinilo = new THREE.MeshBasicMaterial({ map: texVinilo, color: texVinilo ? '#ffffff' : '#222' , transparent: false, alphaTest: 0.4 });
    const vinilos = new THREE.InstancedMesh(new THREE.CircleGeometry(R_PLATO, 40), matVinilo, 3);
    vinilos.frustumCulled = false; sala.add(vinilos); propias.push(vinilos.geometry, matVinilo);
    const matAro = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const aros = new THREE.InstancedMesh(new THREE.RingGeometry(R_PLATO, R_PLATO + 0.022, 48), matAro, 6);
    aros.frustumCulled = false; sala.add(aros); propias.push(aros.geometry, matAro);
    // destellos al reventar: anillos aditivos que se abren y se apagan (por instancia, el color va a negro)
    const matDestello = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const destellos = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1, 40), matDestello, 6);
    destellos.frustumCulled = false; destellos.renderOrder = 40; sala.add(destellos); propias.push(destellos.geometry, matDestello);
    const plato = PLATOS.map(() => ({ giro: Math.random() * 6, vGiro: 1.2, squash: 0, vSquash: 0, destello: 1, colDest: null }));
    const COLS = COLORES.map(c => new THREE.Color(c));

    // ---------- las burbujas: un solo dibujo para todas (las de la canción y las del ambiente) ----------
    const texBurbuja = (() => {
      const { c, g, t } = lienzo(128, 128);
      const r = g.createRadialGradient(64, 64, 20, 64, 64, 62);
      r.addColorStop(0, 'rgba(255,255,255,.12)'); r.addColorStop(0.72, 'rgba(255,255,255,.35)'); r.addColorStop(0.9, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
      g.strokeStyle = TINTA; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 57, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(44, 40, 14, 8, -0.7, 0, 7); g.fill();
      g.beginPath(); g.arc(80, 30, 4, 0, 7); g.fill();
      t.needsUpdate = true; propias.push(t); return t;
    })();
    const N_AMB = 14, MAX_B = 24 + N_AMB;
    const matBurbuja = new THREE.MeshBasicMaterial({ map: texBurbuja, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const burbujas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), matBurbuja, MAX_B);
    burbujas.frustumCulled = false; burbujas.renderOrder = 30; burbujas.count = 0; sala.add(burbujas);
    burbujas.setColorAt(0, _c.set('#ffffff'));
    propias.push(burbujas.geometry, matBurbuja);
    const ambiente = Array.from({ length: N_AMB }, (_, i) => {
      const a = -1.6 + (i / N_AMB) * 3.2 + Math.random() * 0.2, d = 3 + Math.random() * 3;
      return { p: V(Math.sin(a) * d, Math.random() * 4, -Math.cos(a) * d), v: 0.12 + Math.random() * 0.2, r: 0.15 + Math.random() * 0.3, col: COLS[i % 3].clone().multiplyScalar(0.45), fase: Math.random() * 6 };
    });

    // ---------- carteles: el marcador detrás de los platos y el juicio de cada plato ----------
    const marc = lienzo(640, 200); propias.push(marc.t);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56 * 200 / 640), new THREE.MeshBasicMaterial({ map: marc.t, transparent: true, depthWrite: false }));
    panel.position.set(0, hP + 0.36, Z_PLATO - 0.42); panel.rotation.x = -0.25; sala.add(panel); propias.push(panel.geometry, panel.material);
    let clavePanel = '';
    function pintarPanel() {
      const clave = [est.puntos, est.combo, est.presion].join('|');
      if (clave === clavePanel) return; clavePanel = clave;
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.84)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
      g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.font = '46px Caprasimo, serif'; g.textAlign = 'left';
      g.lineWidth = 8; g.strokeStyle = TINTA; g.strokeText(`${est.puntos} puntos`, 28, 56); g.fillStyle = '#ffd23f'; g.fillText(`${est.puntos} puntos`, 28, 56);
      if (est.combo >= 5) { g.font = '34px Caprasimo, serif'; g.fillStyle = '#9be86a'; g.fillText(`${est.combo} seguidas`, 28, 112); }
      g.textAlign = 'right'; g.font = '26px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText('PRESIÓN', 612, 112);
      g.fillStyle = TINTA; g.fillRect(24, 140, 592, 38);
      g.fillStyle = '#3a3048'; g.fillRect(30, 146, 580, 26);
      const k = Math.min(1, est.presion / PRESION_MAX);
      g.fillStyle = k >= 0.6 ? '#ff5fa2' : '#e85a5a'; g.fillRect(30, 146, 580 * k, 26);
      t.needsUpdate = true;
    }
    const juicios = (() => {
      const hacer = (txt, color) => {
        const { g, t } = lienzo(256, 96); propias.push(t);
        g.font = '52px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = 12; g.strokeStyle = TINTA; g.strokeText(txt, 128, 50); g.fillStyle = color; g.fillText(txt, 128, 50);
        t.needsUpdate = true; return t;
      };
      return { perfecto: hacer('¡Perfecto!', '#ffd23f'), bien: hacer('Bien', '#9be86a'), fallo: hacer('Fallo', '#ff5fa2') };
    })();
    const etiquetas = PLATOS.map(p => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.075), new THREE.MeshBasicMaterial({ map: juicios.bien, transparent: true, depthWrite: false, opacity: 0 }));
      m.position.copy(p).add(V(0, 0.2, 0)); m.visible = false; m.renderOrder = 45; sala.add(m); propias.push(m.geometry, m.material);
      return { m, t: 9 };
    });
    function juicio(i, cual) {
      const e = etiquetas[i]; e.m.material.map = juicios[cual]; e.m.material.needsUpdate = true; e.t = 0; e.m.visible = true;
    }

    // ---------- la Pompa, a tu derecha ----------
    const SITIO_POMPA = V(1.15, 0, -1.2);
    let escPompa = 1, poseFija = 'dj';
    if (pompa) {
      pompa.grupo.position.copy(SITIO_POMPA); sala.add(pompa.grupo);
      pompa.pose('dj', { rebote: 0 });
    }
    const pompaPose = p => { if (pompa && p !== poseFija) { poseFija = p; pompa.pose(p, { rebote: 0.2 }); } };

    // ---------- la canción: el reloj del audio manda ----------
    function tocarTema() {
      const ac = audio();
      if (!ac || !BUF || ac.state !== 'running') return false;
      const g = ac.createGain(); g.gain.value = 0.8; g.connect(ac.destination);
      const t0 = ac.currentTime + 0.12;
      const s1 = ac.createBufferSource(); s1.buffer = BUF; s1.connect(g); s1.start(t0); s1.stop(t0 + DURACION_TEMA);
      const s2 = ac.createBufferSource(); s2.buffer = BUF; s2.connect(g); s2.start(t0 + DURACION_TEMA);
      tema = { ac, g, s: [s1, s2], t0 };
      return true;
    }
    function pararTema() {
      if (!tema) return;
      const { ac, g, s } = tema; tema = null;
      try { g.gain.setTargetAtTime(0, ac.currentTime, 0.12); } catch { }
      for (const x of s) { try { x.stop(ac.currentTime + 0.6); } catch { } }
      setTimeout(() => { try { g.disconnect(); } catch { } }, 900);
    }
    function relojTema(dt) {
      if (tema) {
        const ac = tema.ac;
        const lat = (ac.outputLatency || 0) || (ac.baseLatency || 0);
        return ac.currentTime - tema.t0 - lat;
      }
      return est.T + dt;
    }

    function empezar() {
      if (est.acabado) return;
      est.audio = tocarTema();
      est.T = est.audio ? relojTema(0) : 0;
      est.fase = 'juego';
      ui.instruccion(null);
    }

    // ---------- tocar un plato ----------
    function golpe(i, m) {
      if (est.fase !== 'juego') return;
      const lat = m ? (m.esMano ? LAT_MANO : LAT_MANDO) : 0;
      const T = est.T - lat;
      const pl = plato[i];
      pl.vSquash -= 2.2; pl.vGiro = 9;
      m?.vibrar?.(0.25, 18);
      let n = null, mejor = V_BUSCA;
      for (const x of notas) {
        if (x.t - T > V_BUSCA) break;
        if (x.juzgada || x.carril !== i) continue;
        const e = Math.abs(x.t - T); if (e < mejor) { mejor = e; n = x; }
      }
      // tocar de más no castiga (en VR la mano pasa por encima de los platos); lo muy tarde ya cae solo como fallo
      if (!n || mejor > V_BIEN) return;
      n.juzgada = true; n.viva = false;
      const perfecto = mejor <= V_PERFECTA;
      est.combo++; est.aciertos++; if (perfecto) est.perfectos++;
      est.mejorCombo = Math.max(est.mejorCombo, est.combo);
      est.presion = Math.max(0, est.presion - 0.6);
      est.puntos += Math.round((perfecto ? 100 : 60) * (1 + est.combo / 20));
      juicio(i, perfecto ? 'perfecto' : 'bien');
      const p = aMundo(_p.copy(PLATOS[i]).add(_s.set(0, 0.04, 0)));
      fx.acierto(p, { mano: m, color: COLORES[i], n: perfecto ? 22 : 12, sonido: 'pop', racha: est.combo, fuerte: est.combo % 10 === 0 });
      pl.destello = 0; pl.colDest = COLS[i];
      if (est.combo % 10 === 0) {
        ui.cartela(`¡${est.combo} seguidas!`, 1.2);
        sonido('tiroriro', { volumen: 0.35 });
        pompa?.empujon(0.3);
      }
    }

    function fallo(n, porTocar = false) {
      n.juzgada = true; n.viva = false;
      est.combo = 0; est.fallos++; est.presion += 1;
      juicio(n.carril, 'fallo');
      const p = aMundo(_p.copy(PLATOS[n.carril]).add(_s.set(0, 0.04, 0)));
      fx.fallo(p);
      plato[n.carril].destello = 0; plato[n.carril].colDest = new THREE.Color('#6a5a7a');
      sonido('pop', { volumen: 0.25, tono: 0.7 });
      if (!porTocar) sonido('hinchar', { volumen: 0.2, tono: 1 + est.presion * 0.05 });
      pompa?.empujon(0.12 + est.presion * 0.02);
      if (est.presion >= 5) pompaPose('a-punto-de-reventar');
      if (est.presion >= 6 && !est.avisoExplota) { est.avisoExplota = true; pompa?.decir('Yo no, que exploto.', { dur: 1.8 }); }
      if (est.presion >= PRESION_MAX) final(false);
    }

    // ---------- las manos: entrar en el plato desde arriba es un golpe (con histéresis para no repetir) ----------
    const manos = { derecha: { dentro: [false, false, false] }, izquierda: { dentro: [false, false, false] } };
    const _l = V();
    function leerManos() {
      for (const lado of ['derecha', 'izquierda']) {
        const m = xr.manos[lado], st = manos[lado];
        if (!m?.activa) { st.dentro.fill(false); continue; }
        aLocal(m.esMano && m.punta ? m.punta : m.pos, _l);
        for (let i = 0; i < 3; i++) {
          const P = PLATOS[i], d = Math.hypot(_l.x - P.x, _l.z - P.z), dy = _l.y - P.y;
          const entra = d < R_PLATO + 0.03 && dy > -0.08 && dy < 0.12;
          const sigue = d < R_PLATO + 0.07 && dy > -0.14 && dy < 0.18;
          if (entra && !st.dentro[i]) { st.dentro[i] = true; golpe(i, m); }
          else if (st.dentro[i] && !sigue) st.dentro[i] = false;
          else if (st.dentro[i] && m.empiezaPinza) golpe(i, m); // con el mando: gatillo con la mano encima
        }
      }
    }

    // ---------- final ----------
    function final(acabo) {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin';
      ui.instruccion(null);
      pararTema();
      for (const n of notas) if (n.viva) { n.viva = false; fx.chispas(aMundo(n.pos, _p), '#ffffff', 4, 0.4); }
      const total = est.aciertos + est.fallos;
      if (!acabo) {
        sonido('plop', { volumen: 0.8 });
        pompaPose('reventando');
        if (pompa) { pompa.empujon(0.5); const p = pompa.cabezaMundo(V()); fx.chispas(p, '#ff9ccc', 60, 2); }
        luego(0.45, () => { if (pompa) pompa.grupo.visible = false; });
        ui.cartela('¡PLOP!', 1.2);
      } else {
        sonido('aaah', { volumen: 0.6 });
        ui.cartela('¡Qué temazo!', 1.6);
        pompaPose('risa-floja');
        luego(0.9, () => pompa?.decir('…¿Ya? Me ha parecido un segundo.', { dur: 3 }));
        for (let i = 0; i < 3; i++) luego(i * 0.15, () => fx.chispas(aMundo(_p.copy(PLATOS[i]).add(_s.set(0, 0.1, 0))), COLORES[i], 30, 1.6));
      }
      luego(1.3, () => ctx.terminar({
        puntos: est.puntos, gana: acabo,
        linea: `${acabo ? 'La Pompa ha pinchado' : 'La Pompa ha reventado'}. ${est.aciertos} de ${total} burbujas al ritmo. ${acabo ? '«…¿Ya? Me ha parecido un segundo.»' : '«Yo no, que exploto.» Y explotó.'}`,
      }));
    }

    // ---------- arranque: cartela, instrucción, la mano fantasma y la cuenta atrás al ritmo ----------
    pintarPanel();
    ui.cartela('La Pompa pincha', 2.4);
    luego(0.6, () => ui.instruccion('Toca el plato cuando la burbuja llegue al aro'));
    luego(0.9, () => sonido('neon', { volumen: 0.4 }));
    {
      const w = i => aMundo(V(PLATOS[i].x, PLATOS[i].y, PLATOS[i].z));
      const arriba = i => w(i).add(V(0, 0.16, 0)), sobre = i => w(i).add(V(0, 0.02, 0));
      fx.demo([{ p: arriba(1) }, { p: sobre(1) }, { p: arriba(1) }, { p: arriba(2) }, { p: sobre(2) }, { p: arriba(2) }], { dur: 3.2, tramo: 0.4, escala: 0.9 });
    }
    // empieza cuando la canción está lista (o a los 6 s sin ella: sin gafas no hay audio y se juega con el reloj)
    let esperaTema = 0;
    luego(3.4, () => { est.fase = 'espera'; });

    const api = {
      est, notas, platos: PLATOS.map(p => aMundo(p.clone())), get T() { return est.T; }, get fase() { return est.fase; },
      CAIDA, V_PERFECTA, V_BIEN, LAT_MANO, LAT_MANDO,
      mallas: { vinilos, aros, destellos, burbujas, panel },
    };
    grupo.userData.api = api;

    const BLANCO = new THREE.Color('#ffffff'), _a = V(), _b = V();
    return {
      grupo,
      actualizar(dt) {
        est.reloj += dt;
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= est.reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        fx.actualizar(dt);
        if (est.fase === 'espera') {
          esperaTema += dt;
          const ac = audio();
          if ((ac && BUF && ac.state === 'running') || esperaTema > 6 || !ac) empezar();
        }
        if (est.fase === 'juego') {
          est.T = relojTema(dt);
          const vuelta = est.T >= DURACION_TEMA ? 1 : 0;
          if (vuelta !== est.vuelta) { est.vuelta = vuelta; ui.cartela('¡Otra vez, más rápido!', 1.6); sonido('sting', { volumen: 0.4 }); }
          leerManos();
          let pendientes = 0;
          for (const n of notas) {
            if (n.juzgada) continue;
            pendientes++;
            const falta = n.t - est.T;
            if (falta < -V_BIEN - 0.04) { fallo(n); continue; }
            if (falta > CAIDA) break;
            // de lejos y por arriba, en arco, hasta caer en su plato justo en el golpe
            n.viva = true;
            const k = 1 - Math.max(-0.3, falta) / CAIDA, P = PLATOS[n.carril];
            const e = 1 - (1 - Math.min(1, k)) ** 2;
            _a.set(P.x * 2.6 + (n.carril - 1) * 0.4, P.y + 1.25, Z_PLATO - 3.2);
            n.pos.lerpVectors(_a, _b.set(P.x, P.y + 0.06, P.z), e);
            n.pos.y += Math.sin(Math.min(1, k) * Math.PI) * 0.3 - Math.max(0, k - 1) * 0.15;
            n.pos.x += Math.sin(est.T * 5 + n.i) * 0.015 * (1 - Math.min(1, k));
          }
          if (!est.acabado && (est.T >= 2 * DURACION_TEMA + 0.4 || (pendientes === 0 && est.T > 2 * DURACION_TEMA - 0.6))) final(true);
        }

        // ---------- dibujar ----------
        const T = est.fase === 'juego' ? est.T : est.reloj;
        const fase = (((T - BPM_FASE) % BPM_PERIODO) + BPM_PERIODO) % BPM_PERIODO / BPM_PERIODO;
        const latido = est.fase === 'juego' ? Math.exp(-fase * 6) : 0;
        matCielo.color.setRGB(0.114 + latido * 0.03, 0.078 + latido * 0.01, 0.15 + latido * 0.05);
        if (matFondo) matFondo.color.setRGB(0.35 + latido * 0.06, 0.29 + latido * 0.03, 0.38 + latido * 0.06);
        // platos
        const qCab = _q.copy(sala.quaternion).invert().multiply(xr.cabezaQ);
        for (let i = 0; i < 3; i++) {
          const pl = plato[i];
          pl.vGiro += (1.2 - pl.vGiro) * Math.min(1, dt * 2); pl.giro += pl.vGiro * dt;
          pl.vSquash += (-pl.squash * 170 - pl.vSquash * 12) * dt; pl.squash += pl.vSquash * dt;
          const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -pl.giro).multiply(QSUELO);
          const P = PLATOS[i];
          vinilos.setMatrixAt(i, _m4.compose(_p.set(P.x, P.y + 0.002 + pl.squash * 0.02, P.z), q, _s.set(1 - pl.squash * 0.3, 1 - pl.squash * 0.3, 1)));
          const r = 1 + latido * 0.06 - pl.squash * 0.2;
          aros.setMatrixAt(i, _m4.compose(_p.set(P.x, P.y + 0.004, P.z), QSUELO, _s.set(r, r, 1)));
          aros.setColorAt(i, COLS[i]);
          // el aro que avisa: se encoge hasta el plato con la siguiente burbuja de ese plato
          let prox = null;
          for (const n of notas) { if (n.t - est.T > CAIDA) break; if (!n.juzgada && n.carril === i && est.fase === 'juego') { prox = n; break; } }
          if (prox) {
            const f = Math.max(0, prox.t - est.T) / CAIDA, ra = 1 + f * 0.9;
            aros.setMatrixAt(3 + i, _m4.compose(_p.set(P.x, P.y + 0.006, P.z), QSUELO, _s.set(ra, ra, 1)));
            aros.setColorAt(3 + i, _c.copy(COLS[i]).lerp(BLANCO, 0.5 * (1 - f)));
          } else aros.setMatrixAt(3 + i, _m4.makeScale(0, 0, 0));
          // destello al reventar
          pl.destello = Math.min(1, pl.destello + dt * 3.2);
          const k = pl.destello, rd = R_PLATO * (1 + k * 1.4);
          destellos.setMatrixAt(i, _m4.compose(_p.set(P.x, P.y + 0.01, P.z), QSUELO, _s.set(rd, rd, 1)));
          destellos.setColorAt(i, _c.copy(pl.colDest || COLS[i]).multiplyScalar(Math.max(0, 1 - k) * 0.9));
          // el juicio sube y se apaga
          const et = etiquetas[i];
          if (et.m.visible) {
            et.t += dt; et.m.position.y = P.y + 0.19 + et.t * 0.08; et.m.quaternion.copy(qCab);
            et.m.material.opacity = Math.max(0, 1 - Math.max(0, et.t - 0.25) / 0.4); et.m.scale.setScalar(1 + Math.max(0, 0.2 - et.t) * 1.5);
            if (et.t > 0.7) et.m.visible = false;
          }
        }
        for (let i = 3; i < 6; i++) destellos.setMatrixAt(i, _m4.makeScale(0, 0, 0));
        vinilos.instanceMatrix.needsUpdate = true;
        aros.instanceMatrix.needsUpdate = true; aros.instanceColor.needsUpdate = true;
        destellos.instanceMatrix.needsUpdate = true; destellos.instanceColor.needsUpdate = true;
        est.borde.material.color.setRGB(0.71 + latido * 0.29, 0.55 + latido * 0.3, 1);
        // burbujas
        let c = 0;
        for (const n of notas) {
          if (!n.viva || c >= MAX_B - N_AMB) continue;
          const falta = n.t - est.T, cerca = Math.max(0, 1 - Math.abs(falta) / 0.3);
          const s = 0.1 * (1 + latido * 0.08 + cerca * 0.15);
          burbujas.setMatrixAt(c, _m4.compose(n.pos, qCab, _s.set(s, s, s)));
          burbujas.setColorAt(c, _c.copy(COLS[n.carril]).lerp(BLANCO, cerca * 0.4));
          c++;
        }
        for (const a of ambiente) {
          a.p.y += a.v * dt; if (a.p.y > 5) a.p.y = -0.3;
          const s = a.r * (1 + Math.sin(est.reloj * 1.3 + a.fase) * 0.05);
          _p.copy(a.p); _p.x += Math.sin(est.reloj * 0.4 + a.fase) * 0.2;
          burbujas.setMatrixAt(c, _m4.compose(_p, qCab, _s.set(s, s, s)));
          burbujas.setColorAt(c, a.col); c++;
        }
        burbujas.count = c; burbujas.instanceMatrix.needsUpdate = true; if (burbujas.instanceColor) burbujas.instanceColor.needsUpdate = true;
        // la Pompa: se hincha con la presión y bota con el golpe
        if (pompa) {
          escPompa += ((1 + est.presion * 0.05) - escPompa) * Math.min(1, dt * 6);
          const tiembla = est.presion >= 5 && !est.acabado ? Math.sin(est.reloj * 40) * 0.01 : 0;
          pompa.grupo.scale.set(escPompa * (1 + latido * 0.05), escPompa * (1 - latido * 0.035), escPompa);
          pompa.grupo.position.set(SITIO_POMPA.x + tiembla, 0, SITIO_POMPA.z);
          if (est.fase === 'juego' && latido > 0.97) pompa.empujon(0.03);
          pompa.actualizar(dt, xr.cabeza);
        }
        pintarPanel();
      },
      destruir() {
        est.destruido = true; est.acabado = true;
        pararTema();
        ui.instruccion(null);
        fx.destruir();
        pompa?.callar();
        for (const p of propias) p.dispose?.();
        if (grupo.userData.api === api) grupo.userData.api = null;
      },
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin';
        ui.instruccion(null); pararTema();
        pompaPose('meciendose');
        ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Lo dejas a medias. La Pompa sigue pinchando sola.' });
      },
    };
  },
};
