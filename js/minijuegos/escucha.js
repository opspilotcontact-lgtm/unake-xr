// Escucha, escucha · VR nativo (escala «inmersivo», se juega de pie o sentado). Reglas y textos de base/js/escenas/escucha.js.
//
// Una conversación al revés. Blancaso, sentado delante de ti, se confiesa bocadillo a bocadillo. Palicaso, a tu
// izquierda y a mano, nunca deja hueco: lleva encima una burbuja de «¡escucha, escucha!» que se llena con cada pausa.
// Se gana CALLANDO:
//   · cuando la burbuja se pone rosa y tiembla, TÁPALE LA BOCA a Palicaso con la mano (un «shhh» amable). Cuanto
//     más cerca del límite, más puntos (y más riesgo); la racha multiplica;
//   · si se la tapas cuando NO toca (la burbuja aún tranquila, o azul porque es Perico con su «pin pin»), le tapas
//     de más: se enfada, se hincha más rápido y Blancaso se corta;
//   · si la burbuja revienta, Palicaso interrumpe y Blancaso se encoge. Pierdes si su ánimo llega a cero.
//   · ESCUCHA ACTIVA (lo nuevo en VR, sin castigo): ASIENTE con la cabeza mirando a Blancaso (o llévate la mano a la
//     oreja un momento) mientras habla o en su pausa: se siente escuchado (+ánimo, +puntos, una vez por frase).
// El último silencio, el más largo, es el que emociona. Escalada por nivel como el 2D (pausas más cortas, Perico
// desde el 2, el flamenco desde el 3). Música «momento».
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Jugo } from './jugo.js';
import { lienzo, bolsa, clamp, V, TINTA } from './furgo_cabina.js';

const LINEAS = [
  'Palicaso… llevo semanas dándole vueltas a una cosa.',
  'Cada noche hago las cuentas. Cada noche salen justas.',
  'Si falla una sola… se acaba Unaké.',
  'Y tú estás tan contento, y no te lo quiero estropear.',
  'Así que me lo guardo. Y me hundo un poquito cada noche.',
  'Tengo miedo de perder el bar.',
  'Es lo único que tenemos.',
];
const FRENO = ['¡Escucha, escu—!', 'Y esta no te la he contado…', 'Es que me recuerda a una vez que…'];
const BIEN = ['Mm. …Mm-hm. …Sigue, sigue.', '¡Qué fuerte! …Perdón. Sigue.', 'Me muerdo la estela, ¿lo ves? Me la muerdo.', 'Estoy escuchando. Escucho tan fuerte que me zumban las orejas.'];
const DEMAS = ['¡Mmf! ¡Si no iba a decir nada!', '¿Qué? ¡Estaba callado!', 'Oye, que me estoy portando.'];
const VENT = 0.58; // a partir de aquí la burbuja pide freno

export default {
  clave: 'Escucha', titulo: 'Escucha, escucha', escala: 'inmersivo', umbrales: [900, 1800, 2600],
  sitioTarjetas: { d: 0.42, bajo: 0.2 },
  ayudas: { gatillo: 'Mano a la boca de Palicaso', lateral: 'Mano a la boca de Palicaso', mano: { pellizco: 'Tápale la boca (burbuja rosa)', puno: 'Asiente o mano a la oreja' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-escucha';
    const nivel = Math.max(1, ctx.nivel ?? 1);
    const i3 = Math.min(nivel, 3) - 1, extra = Math.max(0, nivel - 3) * 0.04;
    const dif = {
      vel: [0.046, 0.038, 0.030][i3], pausa: [[2.8, 3.5], [1.9, 2.5], [0.9, 1.3]][i3],
      rateH: [0.05, 0.08, 0.11][i3] + extra, rateP: [0.30, 0.42, 0.55][i3] + extra, rateS: [0.22, 0.30, 0.34][i3] + extra,
      mult: 1 + 0.25 * i3, falsas: i3 >= 1, flamenco: i3 >= 2,
    };
    const fx = new Jugo(ctx, grupo);
    // ---------- banderas de partida: TODAS aquí ----------
    const est = {
      t: 0, puntos: 0, animo: 100, racha: 0, presion: 0.1, linea: 0, fase: 'espera', tf: 0, durPausa: 2,
      huboFallo: false, falsaEn: null, falsaHasta: -9, falsasHechas: 0, libreDesde: 0, palHasta: 0, blaHasta: 0,
      acabado: false, armado: true, asentido: false, oreja: 0, pitchBase: null, abajo: -9, demoHecha: false,
      pistaAsentir: false, instrFuera: false, palPose: null, blaPose: null,
    };
    const eventos = []; const programar = (s, fn) => eventos.push({ t: est.t + s, fn });
    const sacaFreno = bolsa(FRENO), sacaBien = bolsa(BIEN), sacaDemas = bolsa(DEMAS);

    // ---------- dónde: delante de ti, a tu altura (de pie o sentado) ----------
    const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const raiz = new THREE.Group(); raiz.position.set(xr.cabeza.x, 0, xr.cabeza.z); raiz.rotation.y = Math.atan2(-f.x, -f.z);
    grupo.add(raiz); grupo.updateMatrixWorld(true);
    const OJ = xr.cabeza.y;
    const L = (x, y, z) => new THREE.Vector3(x, y, z);
    const aMundo = v => raiz.localToWorld(v.clone());

    // ---------- los personajes, cada uno en su taburete con la boca a la altura que toca ----------
    // Palicaso, a mano y más pequeño (a medio metro, a tamaño real te taparía media vista)
    const crearR = (id, escala = 1) => ctx.Recortable.crear(id, 'humo', { escala }).catch(e => { console.warn('escucha: sin', id, e); return null; });
    const [pal, bla, per] = await Promise.all([crearR('palicaso', 0.55), crearR('blancaso'), dif.falsas ? crearR('perico') : null]);
    const taburetes = [];
    function sentar(r, x, z, bocaY) {
      if (!r) return;
      r.grupo.position.set(x, 0, z); raiz.add(r.grupo); r.grupo.updateMatrixWorld(true);
      const b = raiz.worldToLocal(r.bocaMundo(V()));
      const y = Math.max(0, bocaY - b.y);
      r.grupo.position.y = y;
      if (y > 0.05) taburetes.push([x, y, z]);
    }
    const PAL_XZ = [-0.32, -0.46], BLA_XZ = [0.22, -1.15], PER_XZ = [0.66, -0.95];
    sentar(pal, ...PAL_XZ, OJ - 0.3);
    sentar(bla, ...BLA_XZ, OJ - 0.24);
    sentar(per, ...PER_XZ, OJ - 0.3);
    if (per) per.grupo.visible = false;
    // los taburetes de la barra (asiento, pata y pie): una malla
    let tabM = null;
    if (taburetes.length) {
      const pieza = (rt, rb, h, x, y, z) => { const g = new THREE.CylinderGeometry(rt, rb, h, 18).toNonIndexed(); g.deleteAttribute('uv'); g.translate(x, y, z); return g; };
      const geos = taburetes.flatMap(([x, y, z]) => [pieza(0.17, 0.15, 0.045, x, y - 0.0225, z - 0.02), pieza(0.022, 0.022, y, x, y / 2, z - 0.02), pieza(0.13, 0.15, 0.02, x, 0.01, z - 0.02)]);
      const geo = mergeGeometries(geos); geos.forEach(g => g.dispose());
      tabM = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#5e3a26' })); raiz.add(tabM);
    }
    if (pal && bla) pal.mirar(aMundo(L(BLA_XZ[0], OJ, BLA_XZ[1]))); // Palicaso mira a Blancaso
    if (bla) bla.mirar(aMundo(L(-0.1, OJ, -0.2)));                    // Blancaso, entre Palicaso y tú
    const propias = [];
    const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };

    // ---------- la burbuja de Palicaso: aro blanco, relleno que crece y el texto encima (3 llamadas) ----------
    const bur = new THREE.Group(); grupo.add(bur);
    const aroL = lz(256, 256);
    { const g = aroL.g; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill(); g.lineWidth = 12; g.strokeStyle = TINTA; g.stroke(); aroL.t.needsUpdate = true; }
    const textoL = lz(256, 256);
    { const g = textoL.g; g.font = '40px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.85)';
      ['¡escucha,', 'escucha!'].forEach((l, i) => { g.strokeText(l, 128, 108 + i * 44); g.fillStyle = TINTA; g.fillText(l, 128, 108 + i * 44); }); textoL.t.needsUpdate = true; }
    const BUR_R = 0.1;
    const aro = new THREE.Mesh(new THREE.PlaneGeometry(BUR_R * 2, BUR_R * 2), new THREE.MeshBasicMaterial({ map: aroL.t, transparent: true, depthWrite: false }));
    const relleno = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, depthWrite: false }));
    relleno.position.z = 0.002;
    const rotulo = new THREE.Mesh(new THREE.PlaneGeometry(BUR_R * 2, BUR_R * 2), new THREE.MeshBasicMaterial({ map: textoL.t, transparent: true, depthWrite: false }));
    rotulo.position.z = 0.004;
    aro.renderOrder = 21; relleno.renderOrder = 22; rotulo.renderOrder = 23;
    bur.add(aro, relleno, rotulo);

    // ---------- la mano de nube («shhh») que aparece en su boca ----------
    const nubeL = lz(256, 192);
    { const g = nubeL.g; g.fillStyle = '#ffffff'; g.strokeStyle = TINTA; g.lineWidth = 9;
      const c = [[80, 104, 46], [132, 82, 54], [184, 104, 46], [132, 124, 46]];
      c.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); });
      c.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r - 5, 0, 7); g.fill(); });
      g.fillStyle = TINTA; g.font = '44px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('shhh', 132, 104); nubeL.t.needsUpdate = true; }
    const nube = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.112), new THREE.MeshBasicMaterial({ map: nubeL.t, transparent: true, depthWrite: false }));
    nube.renderOrder = 24; nube.visible = false; grupo.add(nube);
    let nubeVida = 0;

    // ---------- el marcador: ánimo de Blancaso, puntos, racha y las frases (pips) ----------
    const panL = lz(640, 200);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.1), new THREE.MeshBasicMaterial({ map: panL.t, transparent: true }));
    panel.position.copy(L(0.52, OJ - 0.3, -0.78)); panel.renderOrder = 8; raiz.add(panel);
    let panAntes = '';
    function pintarPanel() {
      const clave = `${Math.round(est.animo)}|${est.puntos}|${est.racha}|${est.linea}|${est.fase}`;
      if (clave === panAntes) return; panAntes = clave;
      const { g, t } = panL; g.clearRect(0, 0, 640, 200);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
      g.textBaseline = 'middle'; g.font = '36px Caprasimo, serif'; g.textAlign = 'left'; g.fillStyle = '#fff3e6'; g.fillText('Ánimo', 24, 46);
      g.fillStyle = '#3d3350'; g.beginPath(); g.roundRect(150, 30, 260, 32, 12); g.fill();
      const w = 260 * Math.max(0, est.animo) / 100;
      if (w > 2) { g.fillStyle = est.animo > 40 ? '#7ee081' : '#ff5fa2'; g.beginPath(); g.roundRect(150, 30, w, 32, 12); g.fill(); }
      g.lineWidth = 5; g.strokeStyle = TINTA; g.beginPath(); g.roundRect(150, 30, 260, 32, 12); g.stroke();
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText(`${est.puntos}`, 616, 46);
      g.textAlign = 'left'; g.font = '30px Caprasimo, serif'; g.fillStyle = '#7ee081'; g.fillText(est.racha > 1 ? `Racha x${Math.min(est.racha, 4)}` : '', 430, 150);
      const acabadas = est.fase === 'silencio' || est.fase === 'fin' ? LINEAS.length : est.linea;
      for (let k = 0; k < LINEAS.length; k++) { g.beginPath(); g.arc(40 + k * 50, 148, 15, 0, 7); g.fillStyle = k < acabadas ? '#7ee081' : k === est.linea ? '#ffd23f' : '#3d3350'; g.fill(); g.lineWidth = 4; g.strokeStyle = TINTA; g.stroke(); }
      t.needsUpdate = true;
    }

    // ---------- etiqueta flotante ----------
    const etL = lz(512, 128);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshBasicMaterial({ map: etL.t, transparent: true, depthTest: false }));
    etiqueta.renderOrder = 30; etiqueta.visible = false; grupo.add(etiqueta);
    let etVida = 0;
    function decirEtiqueta(txt, color, pos) {
      const { g, t } = etL; g.clearRect(0, 0, 512, 128);
      g.font = '50px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = TINTA; g.strokeText(txt, 256, 64, 490); g.fillStyle = color; g.fillText(txt, 256, 64, 490);
      t.needsUpdate = true; etiqueta.position.copy(pos); etiqueta.visible = true; etVida = 1.2;
    }

    // ---------- ayudas ----------
    const bocaPal = () => (pal ? pal.bocaMundo(V()) : aMundo(L(PAL_XZ[0], OJ - 0.28, PAL_XZ[1])));
    const sobrePal = () => (pal ? pal.cabezaMundo(V()) : aMundo(L(PAL_XZ[0], OJ - 0.1, PAL_XZ[1]))).add(V().set(0, 0.16, 0));
    const poseP = (n, ms = 0) => { if (ms) est.palHasta = est.t + ms; if (pal && est.palPose !== n) { est.palPose = n; pal.pose(n); } };
    const poseB = (n, ms = 0) => { if (ms) est.blaHasta = est.t + ms; if (bla && est.blaPose !== n) { est.blaPose = n; bla.pose(n); } };
    const palDice = (txt, color, dur = 1.7) => pal?.decir(txt, { dur, color: color || undefined });
    function sumar(n) { est.puntos = Math.max(0, est.puntos + Math.round(n * (n > 0 ? dif.mult : 1))); pintarPanel(); }

    // ---------- flujo de la conversación ----------
    function empezarLinea() {
      if (est.acabado) return;
      est.fase = 'habla'; est.tf = 0; est.huboFallo = false; est.asentido = false; est.oreja = 0;
      const l = LINEAS[est.linea];
      bla?.decir(l, { dur: l.length * dif.vel + dif.pausa[1] + 0.8 });
      poseB('base');
      pintarPanel();
    }
    function empezarPausa() {
      est.fase = 'pausa'; est.tf = 0;
      const [a, b] = dif.pausa; est.durPausa = a + Math.random() * (b - a);
      est.falsaEn = null;
      if (dif.falsas && per && est.falsasHechas < 3 && est.linea % 2 === 1 && est.durPausa > 0.8 && est.linea < LINEAS.length - 1) {
        est.falsaEn = 0.3 + Math.random() * 0.4; est.falsasHechas++;
      }
      if (dif.flamenco && (est.linea === 2 || est.linea === 4)) {
        programar(0.25, () => { if (est.fase !== 'pausa') return; est.presion = Math.max(est.presion, 0.82); palDice('¡Es que el flamenco…!', '#ffd0d6'); });
      }
    }
    function finPausa() {
      if (!est.huboFallo) {
        sumar(40);
        est.animo = Math.min(100, est.animo + 4);
        decirEtiqueta('silencio respetado +40', '#fff3e6', aMundo(L(BLA_XZ[0], OJ - 0.32, BLA_XZ[1] + 0.25)));
      }
      est.linea++;
      if (est.linea >= LINEAS.length) {
        est.fase = 'silencio'; est.tf = 0; est.huboFallo = false;
        bla?.decir('…', { dur: 5.2 });
        poseB('esperanza');
        pintarPanel();
        return;
      }
      empezarLinea();
    }

    // ---------- lo que hace el jugador: el «shhh» ----------
    function frenar(m) {
      if (est.acabado || !['habla', 'pausa', 'silencio'].includes(est.fase)) return;
      if (est.t < est.libreDesde) return; // sin ametralladora
      est.libreDesde = est.t + 0.32;
      const falsa = est.t < est.falsaHasta;
      const b = bocaPal();
      nube.visible = true; nubeVida = 0.7; nube.position.copy(b).add(xr.cabeza.clone().sub(b).setY(0).normalize().multiplyScalar(0.05));
      if (est.presion >= VENT && !falsa) {
        const riesgo = clamp((est.presion - VENT) / (1 - VENT), 0, 1);
        est.racha++;
        const g = Math.round((60 + 140 * riesgo) * (1 + 0.25 * (Math.min(est.racha, 4) - 1)));
        sumar(g);
        est.presion = 0.12;
        palDice(sacaFreno(), null);
        poseP('sorprendido', 0.9); pal?.empujon(0.12);
        poseB('esperanza', 1.1);
        sonido('fup', { volumen: 0.5 });
        fx.acierto(b, { mano: m, color: riesgo > 0.6 ? '#ffd23f' : '#7ee081', n: riesgo > 0.6 ? 26 : 16, racha: est.racha, sonido: null });
        decirEtiqueta(`Shhh · +${Math.round(g * dif.mult)}`, '#7ee081', b.clone().add(V().set(0, 0.12, 0)));
        // la primera vez: ya sabes frenar; ahora, la escucha activa (sin tapar a nadie: el cartel abajo)
        if (!est.instrFuera) { est.instrFuera = true; if (!est.pistaAsentir) { est.pistaAsentir = true; ui.instruccion('Asiente a Blancaso: se siente escuchado'); programar(10, () => { if (est.pistaAsentir === true) ui.instruccion(null); }); } else ui.instruccion(null); }
        if (est.racha >= 2 && Math.random() < 0.35) programar(1.8, () => { if (!est.acabado && est.fase !== 'corte') palDice(sacaBien(), null, 2); });
      } else {
        est.huboFallo = true; est.racha = 0;
        sumar(-60);
        est.animo = Math.max(0, est.animo - 12);
        est.presion = Math.min(0.98, est.presion + 0.12);
        palDice(sacaDemas(), '#ffd0d6');
        poseP('contando', 0.8);
        sonido('bonk', { volumen: 0.4 });
        m?.vibrar(0.9, 120);
        fx.fallo(b, { mano: m });
        decirEtiqueta(falsa ? '¡Era Perico!' : '¡Tapas de más!', '#ff5fa2', b.clone().add(V().set(0, 0.12, 0)));
        pintarPanel();
        if (est.animo <= 0) perder();
      }
    }
    function interrumpir() {
      est.huboFallo = true; est.racha = 0;
      est.animo = Math.max(0, est.animo - 34);
      est.presion = 0.1;
      poseP('hablando', 1.3); pal?.empujon(0.3);
      poseB('mareado'); bla?.tambalear(0.5);
      palDice('¡Escucha, escucha! ¡Y esta no te la he contado!', '#ffd0d6', 2);
      const l = LINEAS[Math.min(est.linea, LINEAS.length - 1)];
      if (est.fase !== 'silencio') bla?.decir(l.slice(0, Math.max(4, Math.floor(l.length * 0.5))) + '—', { dur: 1.4 }); else bla?.callar();
      sonido('oooh', { volumen: 0.5 });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(0.8, 140);
      fx.chispas(sobrePal(), '#ff5fa2', 24, 1.1); // la burbuja revienta
      pintarPanel();
      est.fase = 'corte'; est.tf = 0;
      if (est.animo <= 0) perder();
    }
    function mostrarFalsa() {
      est.falsaHasta = est.t + 0.9;
      sonido('pin-pin', { volumen: 0.55 });
      if (per) { per.grupo.visible = true; per.pose('chivato'); per.empujon(0.2); per.decir('Pin pin', { dur: 0.9 }); }
      programar(0.95, () => { if (per) { per.callar(); per.grupo.visible = false; } });
    }
    // escucha activa: asentir (mirando a Blancaso) o la mano a la oreja
    function escuchaActiva(como) {
      if (est.asentido || est.acabado || !['habla', 'pausa'].includes(est.fase)) return;
      est.asentido = true;
      if (est.pistaAsentir === true) ui.instruccion(null);
      est.pistaAsentir = 'hecho';
      sumar(20);
      est.animo = Math.min(100, est.animo + 3);
      bla?.empujon(0.1);
      const p = aMundo(L(BLA_XZ[0], OJ + 0.02, BLA_XZ[1] + 0.2));
      fx.chispas(p, '#9fe7ff', 10, 0.5);
      decirEtiqueta(como === 'oreja' ? 'Te está escuchando +20' : 'Mm-hm +20', '#9fe7ff', p.add(V().set(0, -0.3, 0)));
      sonido('pop', { volumen: 0.18, tono: 1.3 });
    }

    // ---------- final ----------
    function ganar() {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin';
      est.presion = 0; poseP('base'); poseB('esperanza');
      bla?.callar(); palDice('(silencio)', null, 2.6);
      sumar(100);
      sonido('campanita', { volumen: 0.5 });
      fx.chispas(aMundo(L(-0.05, OJ - 0.1, -0.8)), '#ff8fc0', 30, 0.6);
      ui.instruccion(null);
      programar(2.7, () => ctx.terminar({ puntos: est.puntos, gana: true, linea: 'El silencio más largo de Unaké. Palicaso ha escuchado de verdad. Blancaso respira.' }));
    }
    function perder() {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin';
      bla?.decir('Da igual. Mañana.', { dur: 2.6, color: '#ffd0d6' });
      poseB('mareado');
      sonido('suspiro', { volumen: 0.5 });
      ui.instruccion(null);
      programar(1.9, () => ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Da igual. Mañana. Blancaso recoge su agenda; Palicaso se queda con la historia a medias.' }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('momento');
    pintarPanel();
    programar(0.9, () => { ui.instruccion('Burbuja rosa: tápale la boca a Palicaso'); empezarLinea(); });
    programar(16, () => { if (!est.instrFuera) { est.instrFuera = true; ui.instruccion(null); } });

    // para el bot (herramientas/pruebas/bots/escucha.js)
    const api = {
      get fase() { return est.fase; }, get presion() { return est.presion; }, get falsa() { return est.t < est.falsaHasta; },
      get puntos() { return est.puntos; }, get animo() { return est.animo; }, get linea() { return est.linea; }, get racha() { return est.racha; },
      get asentido() { return est.asentido; }, VENT, boca: () => bocaPal(), reposo: () => aMundo(L(0.12, OJ - 0.42, -0.25)),
      oreja: () => xr.cabeza.clone().add(V().set(-0.09, 0, 0).applyQuaternion(xr.cabezaQ)),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.escucha = api;

    const _e = new THREE.Euler();
    const blaMundo = aMundo(L(BLA_XZ[0], OJ, BLA_XZ[1]));
    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        est.tf += dt;
        const d = dif;
        if (est.fase === 'habla') {
          est.presion += d.rateH * dt;
          if (est.tf >= LINEAS[est.linea].length * d.vel) empezarPausa();
        } else if (est.fase === 'pausa') {
          est.presion += d.rateP * dt;
          if (est.falsaEn != null && est.tf >= est.falsaEn) { est.falsaEn = null; mostrarFalsa(); }
          if (est.tf >= est.durPausa) finPausa();
        } else if (est.fase === 'silencio') {
          est.presion += d.rateS * dt;
          if (est.tf >= 5) ganar();
        } else if (est.fase === 'corte') {
          if (est.tf >= 1.5 && !est.acabado) { if (est.animo <= 0) perder(); else { poseB('base'); empezarLinea(); } }
        }
        if (['habla', 'pausa', 'silencio'].includes(est.fase) && est.presion >= 1) interrumpir();
        // la primera vez que la burbuja pide freno, la mano fantasma enseña el gesto
        if (!est.demoHecha && est.presion >= VENT && !est.acabado) {
          est.demoHecha = true;
          const b = bocaPal(), reposo = aMundo(L(0.05, OJ - 0.42, -0.28));
          fx.demo([{ p: reposo }, { p: b.clone().lerp(reposo, 0.4) }, { p: b.clone().add(xr.cabeza.clone().sub(b).setY(0).normalize().multiplyScalar(0.04)) }], { dur: 2.4, tramo: 0.45, retraso: 0 });
        }
        // el gesto: la mano (o la punta del dedo) en la boca de Palicaso; se rearma al apartarla
        const b = bocaPal();
        let dMin = Infinity, mano = null;
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) {
          if (!m.activa) continue;
          const dd = Math.min(m.pos.distanceTo(b), m.punta.distanceTo(b)) - (m.esMano ? 0.02 : 0);
          if (dd < dMin) { dMin = dd; mano = m; }
        }
        if (est.armado && dMin < 0.13) { est.armado = false; mano.vibrar(0.5, 40); frenar(mano); }
        else if (!est.armado && dMin > 0.22) est.armado = true;
        // escucha activa: asentir con la cabeza mirando a Blancaso…
        _e.setFromQuaternion(xr.cabezaQ, 'YXZ');
        const pitch = _e.x;
        if (est.pitchBase === null) est.pitchBase = pitch;
        est.pitchBase += (pitch - est.pitchBase) * Math.min(1, dt * 1.2);
        const haciaBla = blaMundo.clone().sub(xr.cabeza).setY(0).normalize(), mira = xr.adelante.clone().setY(0).normalize();
        const deCara = haciaBla.dot(mira) > 0.8;
        if (pitch - est.pitchBase < -0.09) { if (est.abajo < 0) est.abajo = est.t; }
        else if (est.abajo >= 0 && pitch - est.pitchBase > -0.03) { if (est.t - est.abajo < 0.9 && deCara) escuchaActiva('asentir'); est.abajo = -9; }
        if (est.abajo >= 0 && est.t - est.abajo > 1.2) est.abajo = -9;
        // …o la mano a la oreja un momento
        const oreja = [V().set(-0.09, 0, 0), V().set(0.09, 0, 0)].map(o => xr.cabeza.clone().add(o.applyQuaternion(xr.cabezaQ)));
        const enOreja = [xr.manos.derecha, xr.manos.izquierda].some(m => m.activa && oreja.some(o => m.pos.distanceTo(o) < 0.13));
        est.oreja = enOreja ? est.oreja + dt : 0;
        if (est.oreja > 0.5) escuchaActiva('oreja');

        // Palicaso: pose según la presión (si no hay una puesta) y la burbuja encima
        const p = clamp(est.presion, 0, 1), t = est.t;
        if (t >= est.palHasta && est.fase !== 'fin') poseP(p > 0.5 ? 'emocionado' : 'base');
        if (t >= est.blaHasta && est.fase !== 'fin' && est.fase !== 'corte' && est.fase !== 'silencio' && est.blaPose === 'esperanza') poseB('base');
        const alta = p >= VENT, falsa = t < est.falsaHasta;
        const parpadeo = 0.5 + 0.5 * Math.sin(t * 1000 / (alta ? 70 : 160));
        bur.visible = est.fase !== 'fin';
        bur.position.copy(sobrePal());
        if (alta) bur.position.x += Math.sin(t * 1000 / 35) * 0.006;
        bur.lookAt(xr.cabeza);
        bur.scale.setScalar(1 + (alta ? 0.12 * p : 0));
        relleno.material.color.set(falsa ? '#3aa0ff' : alta ? (parpadeo > 0.5 ? '#ff3b30' : '#ff5fa2') : '#ffd23f');
        relleno.material.opacity = falsa ? 0.4 + 0.5 * parpadeo : 1;
        relleno.scale.setScalar(BUR_R * 0.92 * (falsa ? (30 + 20 * parpadeo) / 64 : (8 + 52 * p) / 64));
        // la nube del «shhh», la etiqueta y los personajes
        if (nubeVida > 0) { nubeVida -= dt; nube.lookAt(xr.cabeza); nube.scale.setScalar(1 + 0.08 * Math.sin(Math.min(1, (0.7 - nubeVida) / 0.24) * Math.PI)); nube.material.opacity = Math.min(1, nubeVida * 4); if (nubeVida <= 0) nube.visible = false; }
        if (etVida > 0) { etVida -= dt; etiqueta.position.y += dt * 0.07; etiqueta.material.opacity = Math.min(1, etVida * 2.5); etiqueta.lookAt(xr.cabeza); if (etVida <= 0) etiqueta.visible = false; }
        panel.lookAt(xr.cabeza);
        pal?.actualizar(dt, xr.cabeza); bla?.actualizar(dt, xr.cabeza); if (per?.grupo.visible) per.actualizar(dt, xr.cabeza);
        pintarPanel();
        fx.actualizar(dt);
      },
      // salir a mitad: Blancaso se queda con la frase a medias
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin';
        ui.instruccion(null);
        bla?.decir('…Vale. Otro día.', { dur: 2 }); poseB('mareado');
        ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Te vas a mitad. Blancaso se guarda lo que iba a decir.' });
      },
      destruir() {
        eventos.length = 0; est.acabado = true;
        ui.instruccion(null); ui.quitarTarjetas?.();
        fx.destruir();
        for (const r of [pal, bla, per]) if (r) { r.callar(); r.grupo.parent?.remove(r.grupo); }
        for (const tx of propias) tx.dispose();
        for (const m of [aro, relleno, rotulo, nube, panel, etiqueta]) { m.geometry.dispose(); m.material.dispose(); }
        if (tabM) { tabM.geometry.dispose(); tabM.material.dispose(); }
        if (typeof window !== 'undefined' && window.__mj?.escucha === api) window.__mj.escucha = null;
      },
    };
  },
};
