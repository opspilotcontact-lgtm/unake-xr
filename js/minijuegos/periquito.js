// ¡Periquito! · VR nativo (escala «inmersivo», se juega sentado). Reglas y textos de base/js/escenas/periquito.js.
//
// Perico, subido a un barril delante de ti, va soltando frases letra a letra en su bocadillo. Cuando va a decir
// «¡Vuper es Monchiman!», hay que gritarle «¡periquito!» en cuanto asome el «Mon…»: le salta el pin pin y se le
// olvida. Ojo con las fintas («Vuper es mono», «Monchu, mi primo»): si le cortas sin motivo, se ofende.
//   GRITAR → con micro, un grito de verdad (un pico de volumen); sin micro (o además), gatillo o pellizco.
// Tres vidas; 16 frases; cada vez habla más rápido (y más con el nivel del 2D).
import * as THREE from 'three';
import { Jugo } from './jugo.js';
import { lienzo, envolver, bolsa, clamp, azar } from './furgo_cabina.js';
import { leerMicro, hayMicro } from '../microfono.js';

const FRASES_PERICO = {
  peligro: [
    '¡Vuper es Monchiman!', '¡Escuchad todos! ¡Vuper es Monchiman!', 'Lo sé de buena tinta: Vuper es Monchiman.',
    'Pin pin… ¡Vuper es Monchiman!', 'Os lo digo en serio: Vuper es Monchiman.', 'El rider ese, Vuper, es Monchiman.',
  ],
  finta: [
    '¡Vuper es mono! Muy mono.', '¡Vuper es Monchu, mi primo! No, espera.', 'Vuper es monótono. Pin pin.',
    '¡Vuper es Mon… tañero! Le gusta el monte.', 'Vuper es monchi… no, monchi no. Majo. Es majo.',
  ],
  inocua: [
    'Pin pin. ¿Alguien quiere pipas?', 'Hoy hace un día de pipas.', 'El casero tiene cara de llave.',
    '¡Periquito! Digo… nada, nada.', 'Lasslow huele raro. Más raro.', 'Yo de mayor quiero ser portero. Ah, que ya.',
  ],
};
const OFENDIDO = ['¿Qué? ¡Si no he dicho nada!', 'Periquito tu madre.', '¡Que no iba a decir eso! Pin… pin.'];
const FRASES_TOTAL = 16;
const TINTA = '#2a1d33';
const UMBRAL_GRITO = 0.5, UMBRAL_CALLA = 0.3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export default {
  clave: 'Periquito', titulo: '¡Periquito!', escala: 'inmersivo', umbrales: [800, 1700, 2800],
  ayudas: { gatillo: '¡Periquito! (o grítalo)', mano: { pellizco: '¡Periquito! (o grítalo)' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-periquito';
    const nivel = clamp(ctx.nivel ?? 1, 1, 5);
    const fx = new Jugo(ctx, grupo);
    // ---------- banderas de partida: TODAS aquí ----------
    const est = {
      fase: 'cargando', t: 0, puntos: 0, vidas: 3, frase: 0, racha: 0, activa: null, espera: 0,
      acabado: false, micArriba: false, micFalso: null, nivelMic: 0, gritos: 0, etiquetaT: 0, ayudaFuera: false,
    };
    const eventos = []; const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn });
    const saca = { peligro: bolsa(FRASES_PERICO.peligro), finta: bolsa(FRASES_PERICO.finta), inocua: bolsa(FRASES_PERICO.inocua) };
    const propias = [];
    const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };

    // ---------- dónde está todo: delante de ti, a tu altura ----------
    const cab = xr.cabeza.clone();
    const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const lat = V(-f.z, 0, f.x); // tu derecha
    const enSuelo = (d, l) => cab.clone().addScaledVector(f, d).addScaledVector(lat, l).setY(0);
    const mirarA = (m) => { const p = cab.clone(); p.y = m.position.y; m.lookAt(p); };

    // el barril de Perico (una malla, una textura de duelas)
    const alto = Math.max(0.45, cab.y - 0.74);
    const duelas = lz(256, 128);
    { const g = duelas.g; g.fillStyle = '#8a5a34'; g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#7a4d2b' : '#94643b'; g.fillRect(i * 32, 0, 30, 128); }
      g.fillStyle = '#3d3350'; g.fillRect(0, 18, 256, 10); g.fillRect(0, 100, 256, 10); duelas.t.needsUpdate = true; }
    const barril = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, alto, 16, 1), new THREE.MeshBasicMaterial({ map: duelas.t }));
    barril.position.copy(enSuelo(1.0, 0)).setY(alto / 2); grupo.add(barril);

    const [perico, palicaso] = await Promise.all([
      ctx.Recortable.crear('perico', 'humo'),
      ctx.Recortable.crear('palicaso', 'humo').catch(() => null),
    ]);
    perico.grupo.position.copy(enSuelo(1.0, 0)).setY(alto + 0.005); perico.sombra.visible = false;
    grupo.add(perico.grupo); perico.pose('cotilleando');
    if (palicaso) { palicaso.grupo.position.copy(enSuelo(1.5, 0.95)); grupo.add(palicaso.grupo); }

    // ---------- el bocadillo de Perico (letra a letra) ----------
    const bocL = lz(1024, 360);
    const bocM = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.3234), new THREE.MeshBasicMaterial({ map: bocL.t, transparent: true }));
    bocM.position.copy(enSuelo(0.98, 0.12)).setY(cab.y + 0.12); mirarA(bocM); bocM.renderOrder = 5; grupo.add(bocM);
    function pintarBocadillo(texto, { rojo = false } = {}) {
      const { g, t } = bocL; g.clearRect(0, 0, 1024, 360);
      g.fillStyle = rojo ? '#ffe1e6' : '#ffffff'; g.strokeStyle = TINTA; g.lineWidth = 10;
      g.beginPath(); g.roundRect(8, 8, 1008, 270, 40); g.fill(); g.stroke();
      // el pico, hacia Perico (abajo a la izquierda)
      g.beginPath(); g.moveTo(330, 272); g.lineTo(420, 272); g.lineTo(300, 352); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(330, 278); g.lineTo(300, 352); g.lineTo(420, 278); g.stroke();
      if (texto) {
        let tam = 66, ls; do { g.font = `${tam}px Caprasimo, serif`; ls = envolver(g, texto, 930); tam -= 4; } while (ls.length * tam * 1.15 > 240 && tam > 34);
        tam += 4; g.fillStyle = TINTA; g.textAlign = 'center'; g.textBaseline = 'middle';
        ls.forEach((x, k) => g.fillText(x, 512, 143 + (k - (ls.length - 1) / 2) * tam * 1.15));
      }
      t.needsUpdate = true;
    }
    pintarBocadillo('Pin pin…');

    // ---------- el marcador (puntos, frase, racha y vidas) ----------
    const panL = lz(640, 240);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1275), new THREE.MeshBasicMaterial({ map: panL.t, transparent: true }));
    panel.position.copy(enSuelo(0.8, -0.5)).setY(cab.y - 0.22); panel.lookAt(cab); grupo.add(panel);
    let panAntes = '';
    function estrella(g, x, y, r, llena) {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = llena ? '#ffd23f' : '#3d3350'; g.fill(); g.strokeStyle = TINTA; g.lineWidth = 5; g.stroke();
    }
    function pintarPanel() {
      const clave = `${est.puntos}|${est.frase}|${est.racha}|${est.vidas}`;
      if (clave === panAntes) return; panAntes = clave;
      const { g, t } = panL; g.clearRect(0, 0, 640, 240);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 232, 30); g.fill();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '50px Caprasimo, serif'; g.fillStyle = '#ffd23f'; g.fillText(`${est.puntos} puntos`, 28, 58);
      g.font = '36px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText(est.frase ? `Frase ${est.frase} de ${FRASES_TOTAL}` : '¡Periquito!', 28, 128);
      g.fillStyle = '#7ee081'; g.fillText(est.racha > 1 ? `Racha x${Math.min(est.racha, 4)}` : '', 28, 190);
      for (let i = 0; i < 3; i++) estrella(g, 450 + i * 68, 180, 28, i < est.vidas);
      t.needsUpdate = true;
    }

    // ---------- el micro: una barrita junto al marcador (solo si hay micro) ----------
    const micFondo = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.12), new THREE.MeshBasicMaterial({ color: '#3d3350' }));
    const micBarra = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.112), new THREE.MeshBasicMaterial({ color: '#7ee081' }));
    micBarra.geometry.translate(0, 0.056, 0); micBarra.position.set(0, -0.056, 0.002); micFondo.add(micBarra);
    micFondo.position.copy(panel.position).addScaledVector(lat, 0.21); micFondo.quaternion.copy(panel.quaternion);
    micFondo.visible = false; grupo.add(micFondo);

    // ---------- la etiqueta que sube («+250», «¡Lo ha oído todo el bar!») ----------
    const etL = lz(1024, 160);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.094), new THREE.MeshBasicMaterial({ map: etL.t, transparent: true, depthTest: false }));
    etiqueta.renderOrder = 30; etiqueta.visible = false; grupo.add(etiqueta);
    const etBase = V();
    function etiquetar(texto, color, pos) {
      const { g, t } = etL; g.clearRect(0, 0, 1024, 160);
      g.font = '84px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText(texto, 512, 82, 1000); g.fillStyle = color; g.fillText(texto, 512, 82, 1000);
      t.needsUpdate = true; etBase.copy(pos); est.etiquetaT = 1.3; etiqueta.visible = true;
    }

    // ---------- el ritmo de las frases ----------
    function siguiente() {
      if (est.acabado) return;
      if (est.vidas <= 0 || est.frase >= FRASES_TOTAL) return final();
      est.frase++;
      perico.pose('cotilleando'); palicaso?.pose('base');
      // las fintas llegan a partir de la cuarta frase (de la tercera con nivel 3+)
      const r = Math.random(), sinFintas = nivel >= 3 ? 2 : 3, pFinta = nivel >= 3 ? 0.35 : 0.3;
      const tipo = est.frase <= sinFintas ? (r < 0.6 ? 'peligro' : 'inocua') : r < 0.45 ? 'peligro' : r < 0.45 + pFinta ? 'finta' : 'inocua';
      const txt = saca[tipo]();
      const mon = txt.indexOf('Monchiman');
      // un poco más lento que el 2D: aquí se lee en el aire; el nivel lo acelera
      const paso = Math.max(0.05, (92 - est.frase * 3 - (nivel - 1) * 6) / 1000);
      est.activa = { tipo, txt, k: 0, desde: mon >= 0 ? mon : -1, paso, acc: 0, colchon: 0 };
      est.fase = 'hablando';
      bocM.scale.setScalar(0.9);
      pintarBocadillo('');
      pintarPanel();
      if (est.frase === 4 && !est.ayudaFuera) { est.ayudaFuera = true; ui.instruccion(null); }
    }
    // la frase se ha dicho entera sin que la cortes
    function acabo() {
      const a = est.activa; if (!a) return;
      est.activa = null; est.fase = 'pausa';
      const cabezaP = perico.cabezaMundo(V());
      if (a.tipo === 'peligro') {
        est.vidas--; est.racha = 0;
        sonido('oooh', { volumen: 0.5 }); sonido('abucheo', { volumen: 0.25 });
        perico.pose('chivato'); palicaso?.pose('horror'); palicaso?.decir('¿Qué ha dicho el pájaro?', { dur: 1.6 });
        etiquetar('¡Lo ha oído todo el bar!', '#ff5fa2', cabezaP);
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(1, 180);
      } else {
        est.puntos += 30;
        etiquetar('Bien aguantado · +30', '#7ee081', cabezaP);
        sonido('pop', { volumen: 0.3 });
      }
      pintarPanel();
      programar(1.3, siguiente);
    }

    function gritar(mano, conMicro) {
      const a = est.activa; if (!a || est.acabado) return;
      est.activa = null; est.fase = 'pausa'; est.gritos++;
      const boca = xr.boca().addScaledVector(xr.adelante, 0.3);
      fx.chispas(boca, '#ffd23f', 10, 0.6);
      const cabezaP = perico.cabezaMundo(V());
      const enVentana = a.tipo === 'peligro' && a.k >= a.desde + 1;
      if (enVentana) {
        // pin pin: se le olvida lo que iba a decir. Cuanto antes (pero ya en «Mon…»), más puntos.
        est.racha++;
        const quedaba = (a.txt.length - a.k) / a.txt.length;
        const gana = Math.round((100 + quedaba * 200) * Math.min(est.racha, 4));
        est.puntos += gana;
        sonido('pin-pin', { volumen: 0.7 });
        perico.pose('silbando'); perico.empujon(0.35);
        palicaso?.pose('riendo');
        pintarBocadillo(a.txt.slice(0, a.k) + '… ¡PIN PIN!');
        fx.acierto(cabezaP, { mano, racha: est.racha, fuerte: est.racha >= 3, sonido: 'campanita' });
        if (!mano) for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(0.6, 60);
        etiquetar(`¡Periquito! +${gana}`, '#ffd23f', cabezaP);
      } else {
        // le has cortado sin motivo (o antes de tiempo): se ofende
        est.racha = 0; est.vidas--;
        sonido('rimshot', { volumen: 0.5 });
        perico.pose('graznando'); perico.tambalear(0.4);
        palicaso?.pose('sorprendido');
        pintarBocadillo(azar(OFENDIDO), { rojo: true });
        fx.fallo(cabezaP, { mano });
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(0.9, 140);
        etiquetar(a.tipo === 'peligro' ? '¡Aún no! Espera al «Mon…»' : a.tipo === 'finta' ? '¡Era una finta!' : '¡Si no iba a decir nada!', '#ff5fa2', cabezaP);
      }
      pintarPanel();
      programar(1.3, siguiente);
    }

    function final() {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin'; est.activa = null;
      const gana = est.vidas > 0 && est.puntos >= 800;
      if (gana) { perico.pose('silbando'); sonido('platillo', { volumen: 0.5 }); pintarBocadillo('Pin pin. ¿De qué hablábamos?'); }
      else { perico.pose('chivato'); pintarBocadillo('¡VUPER ES MONCHIMAN! Pin pin.'); palicaso?.pose('horror'); }
      programar(0.6, () => ctx.terminar({
        puntos: est.puntos, gana,
        linea: gana ? 'Perico se ha pasado la noche diciendo «pin pin». Nadie sospecha nada. Por ahora.' : 'Bueno, nadie le ha creído. Es un pájaro. Pero el casero viene esta semana…',
      }));
    }

    // ---------- arranque: la mano fantasma enseña el gesto (gatillo/pellizco delante de la boca) ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('minijuego');
    est.fase = 'intro';
    pintarPanel();
    ui.instruccion(hayMicro() ? 'Grita «¡periquito!» (o aprieta) SOLO cuando empiece con «Mon…»' : 'Aprieta (gatillo o pellizco) SOLO cuando empiece con «Mon…»');
    {
      const regazo = cab.clone().addScaledVector(f, 0.32).addScaledVector(lat, 0.12); regazo.y -= 0.36;
      const frente = xr.boca().addScaledVector(f, 0.22);
      fx.demo([{ p: regazo }, { p: frente }, { p: frente, pinza: true }, { p: frente }, { p: frente, pinza: true }], { dur: 2.8, tramo: 0.45, retraso: 0.2 });
    }
    programar(2.6, siguiente);

    // para el bot (herramientas/pruebas/bots/periquito.js)
    const api = {
      get fase() { return est.fase; }, get puntos() { return est.puntos; }, get vidas() { return est.vidas; }, get frase() { return est.frase; },
      get racha() { return est.racha; }, get gritos() { return est.gritos; },
      get activa() { const a = est.activa; return a ? { tipo: a.tipo, k: a.k, desde: a.desde, largo: a.txt.length, txt: a.txt } : null; },
      set micFalso(v) { est.micFalso = v; }, get micFalso() { return est.micFalso; },
      boca: () => xr.boca(),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.periquito = api;
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        // Perico habla letra a letra
        const a = est.activa;
        if (a) {
          if (a.k < a.txt.length) {
            a.acc += dt;
            let cambia = false;
            while (a.acc >= a.paso && a.k < a.txt.length) { a.acc -= a.paso; a.k++; cambia = true; if (a.k % 3 === 0) sonido('pop', { volumen: 0.1, tono: 1.3 }); }
            if (cambia) pintarBocadillo(a.txt.slice(0, a.k));
          } else if ((a.colchon += dt) >= 0.25) acabo(); // un respiro tras la última letra
        }
        // gritar: micro (un pico de volumen) o gatillo/pellizco
        const mic = est.micFalso ?? (hayMicro() ? leerMicro(dt).nivel : null);
        if (mic !== null) {
          micFondo.visible = true;
          est.nivelMic += (mic - est.nivelMic) * Math.min(1, dt * 20);
          micBarra.scale.y = Math.max(0.02, Math.min(1, est.nivelMic / 0.8));
          micBarra.material.color.set(est.nivelMic > UMBRAL_GRITO ? '#ffd23f' : '#7ee081');
          if (!est.micArriba && mic > UMBRAL_GRITO) { est.micArriba = true; gritar(null, true); }
          else if (est.micArriba && mic < UMBRAL_CALLA) est.micArriba = false;
        }
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) if (m.activa && m.empiezaPinza) { m.vibrar(0.4, 30); gritar(m, false); break; }
        // el bocadillo aparece con un rebote
        if (bocM.scale.x < 1) bocM.scale.setScalar(Math.min(1, bocM.scale.x + dt * 0.8));
        // la etiqueta sube y se apaga
        if (est.etiquetaT > 0) {
          est.etiquetaT -= dt;
          const k = 1 - est.etiquetaT / 1.3;
          etiqueta.position.copy(etBase).add(V(0, 0.08 + k * 0.12, 0)).lerp(cab, 0.25);
          etiqueta.lookAt(xr.cabeza);
          etiqueta.material.opacity = Math.min(1, est.etiquetaT / 0.35);
          if (est.etiquetaT <= 0) etiqueta.visible = false;
        }
        perico.actualizar(dt, xr.cabeza);
        palicaso?.actualizar(dt, xr.cabeza);
        fx.actualizar(dt);
      },
      // salir a mitad: Perico se queda hablando solo, con los puntos que lleves
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin'; est.activa = null;
        pintarBocadillo('¿Ya te vas? Pin pin. Pues se lo cuento a otro.');
        ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Te vas y Perico sigue hablando. A ver a quién se lo cuenta.' });
      },
      destruir() {
        est.acabado = true; eventos.length = 0;
        ui.instruccion(null);
        fx.destruir();
        for (const r of [perico, palicaso]) if (r) { r.callar(); r.grupo.parent?.remove(r.grupo); }
        for (const t of propias) t.dispose();
        for (const m of [barril, bocM, panel, micFondo, micBarra, etiqueta]) { m.geometry.dispose(); m.material.dispose(); }
        if (typeof window !== 'undefined' && window.__mj?.periquito === api) window.__mj.periquito = null;
      },
    };
  },
};
