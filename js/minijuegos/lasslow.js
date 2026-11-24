// Un señor · VR nativo (escala «inmersivo», se juega sentado). Reglas y textos de base/js/escenas/lasslow.js.
//
// Eres Lasslow, cenando con el casero en el bar, y esta noche eres un señor. La risa floja y el pedo te delatan.
// Dos pruebas que nunca coinciden:
//   CHISTE: Palicaso cuenta un chiste; en el remate, un círculo se cierra delante de tu boca.
//           Tápate la boca con la mano JUSTO cuando toque el anillo verde = te tragas la risa. Tarde o pronto = risa floja.
//   TRIPA:  la barriga ruge con cuenta atrás. Respira despacio (sube y baja una mano, o resopla flojito al micro) y
//           la cuenta va más lenta. En algún momento suena un RUIDO: aprieta (gatillo o pellizco) DURANTE el ruido
//           y lo tapa. Sin ruido = «¡Que se me ha escapao!». Si se acaba la cuenta = revienta.
// Tres pajaritas de dignidad. Cada prueba superada acelera la siguiente (y el nivel del 2D también).
import * as THREE from 'three';
import { Jugo } from './jugo.js';
import { lienzo, bolsa, clamp } from './furgo_cabina.js';
import { leerMicro, hayMicro } from '../microfono.js';

const CHISTES = [
  ['¿Sabes qué le dice una nube a otra?', '¡Qué colocada vas!'],
  ['Entra un copo de nieve en un bar…', '…y le da un blancazo. ¡Mi hermano!'],
  ['¿Cómo se llama el primo de Puky?', '¡Pukyto!'],
  ['¿Vamos a Unaké?', '¿A una qué? ¡A una aso!'],
  ['¿Qué hace Perico en el gimnasio?', '¡Pin pin… pesas!'],
  ['¿Por qué Cotine no sale en las fotos?', '¡Porque se las come!'],
  ['Le digo a la Pompa: «¿Bailas?»', 'Me contesta mañana.'],
  ['¿Sabe usted cuánto cobra el casero?', '¡Lo mismo que cobra el humo: todo!'],
];
const RUIDOS = [
  { quien: 'cristal', texto: '¡CRASH!', sonido: 'cristal' },
  { quien: 'palicaso', texto: '¡ESCUCHA, ESCUCHA!', sonido: 'bocina' },
  { quien: 'casero', texto: '¡ACHÍS!', sonido: 'pop' },
];
const TINTA = '#2a1d33';
const ANILLO = 0.06;       // radio del anillo verde (m)
const R0 = 0.22, R1 = 0.02; // el círculo se cierra de R0 a R1
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export default {
  clave: 'Lasslow', titulo: 'Un señor', escala: 'inmersivo', umbrales: [400, 1000, 1800],
  ayudas: { gatillo: 'Soltarlo, solo con el RUIDO', mano: { pellizco: 'Soltarlo, solo con el RUIDO' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-lasslow';
    const nivel = clamp(ctx.nivel ?? 1, 1, 5);
    const fx = new Jugo(ctx, grupo);
    // ---------- banderas de partida: TODAS aquí ----------
    const est = {
      fase: 'cargando', t: 0, dignidad: 3, puntos: 0, combo: 0, rondas: 0, prueba: null, ultima: null,
      // nivel 3+: la cena empieza más animada (todo va más rápido)
      ritmo: 1 + Math.min(0.5, Math.max(0, nivel - 2) * 0.12),
      tol: Math.max(0.016, 0.024 - (nivel - 1) * 0.002), // margen del anillo (m de radio): ≈ 0,5 s al principio
      acabado: false, calma: 0, dentro: { derecha: false, izquierda: false }, etiquetaT: 0, nubeT: 0, ojoRojo: 0,
      demoChiste: false, demoTripa: false, bien: 0, mal: 0, cartelAntes: '', asiente: 0, ayudaFuera: false,
    };
    const eventos = []; const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn });
    const sacaChiste = bolsa(CHISTES), sacaRuido = bolsa(RUIDOS);
    const propias = [];
    const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };
    const manos = () => [xr.manos.derecha, xr.manos.izquierda].filter(m => m.activa);

    // ---------- la cena, delante de ti ----------
    const cab = xr.cabeza.clone();
    const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const lat = V(-f.z, 0, f.x); // tu derecha
    const en = (d, l, y) => cab.clone().addScaledVector(f, d).addScaledVector(lat, l).setY(y);
    const yaw = Math.atan2(-f.x, -f.z);
    const mesaY = cab.y - 0.5;

    const [texCasero, texMira, texVelas, texPajarita, texPuff] = await Promise.all([
      ctx.img('casero.png'), ctx.img('casero-mira.png'), ctx.img('obj-velas.png'), ctx.img('pajarita.png'), ctx.img('fx-humo-puff.png'),
    ]);

    // la mesa con mantel (una malla)
    const mantel = lz(256, 256);
    { const g = mantel.g; g.fillStyle = '#fff6e8'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#f0e4cf'; for (let i = 0; i < 256; i += 32) g.fillRect(i, 0, 3, 256); g.fillStyle = '#ff5fa2'; g.fillRect(0, 238, 256, 10); mantel.t.needsUpdate = true; }
    const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 1.1), new THREE.MeshBasicMaterial({ map: mantel.t }));
    mesa.position.copy(en(0.95, 0, mesaY - 0.02)); mesa.rotation.y = yaw; grupo.add(mesa);
    const faldon = new THREE.Mesh(new THREE.PlaneGeometry(1.25, mesaY - 0.04), new THREE.MeshBasicMaterial({ color: '#f0e4cf' }));
    faldon.position.copy(en(0.4, 0, (mesaY - 0.04) / 2)); faldon.rotation.y = yaw; grupo.add(faldon);
    // las velas
    const velasAsp = texVelas.image ? texVelas.image.width / texVelas.image.height : 1;
    const velas = new THREE.Mesh(new THREE.PlaneGeometry(0.26 * velasAsp, 0.26), new THREE.MeshBasicMaterial({ map: texVelas, alphaTest: 0.4 }));
    velas.geometry.translate(0, 0.13, 0); velas.position.copy(en(1.05, -0.32, mesaY)); velas.rotation.y = yaw; grupo.add(velas);
    // el casero, en la cabecera de enfrente, juzgándote
    const casAsp = texCasero.image ? texCasero.image.width / texCasero.image.height : 0.8;
    const casero = new THREE.Mesh(new THREE.PlaneGeometry(1.05 * casAsp, 1.05), new THREE.MeshBasicMaterial({ map: texCasero, alphaTest: 0.5 }));
    casero.geometry.translate(0, 0.525, 0);
    const caseroBase = en(1.65, 0.05, mesaY - 0.45); casero.position.copy(caseroBase); casero.rotation.y = yaw; grupo.add(casero);
    // Palicaso, a tu derecha, contando chistes
    const palicaso = await ctx.Recortable.crear('palicaso', 'humo').catch(() => null);
    if (palicaso) { palicaso.grupo.position.copy(en(1.2, 0.72, 0)); grupo.add(palicaso.grupo); }

    // ---------- el anillo del chiste, delante de tu boca ----------
    const anillo = new THREE.Mesh(new THREE.RingGeometry(ANILLO - 0.007, ANILLO + 0.007, 48), new THREE.MeshBasicMaterial({ color: '#7ee081', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    const circulo = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, side: THREE.DoubleSide }));
    anillo.renderOrder = circulo.renderOrder = 28; anillo.visible = circulo.visible = false;
    grupo.add(anillo, circulo);
    const centroAnillo = V();

    // ---------- la tripa: la cuenta atrás y la calma ----------
    const tripaFondo = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.04), new THREE.MeshBasicMaterial({ color: '#2a1d33' }));
    const tripaBarra = new THREE.Mesh(new THREE.PlaneGeometry(0.388, 0.024), new THREE.MeshBasicMaterial({ color: '#7ee081' }));
    tripaBarra.geometry.translate(0.194, 0, 0); tripaBarra.position.set(-0.194, 0, 0.002); tripaFondo.add(tripaBarra);
    tripaFondo.position.copy(en(0.62, 0, cab.y - 0.4)); tripaFondo.lookAt(cab); tripaFondo.visible = false; grupo.add(tripaFondo);

    // ---------- el cartel (CHISTE / TRIPA / ¡RUIDO!) sobre la mesa ----------
    const cartL = lz(1024, 150);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.091), new THREE.MeshBasicMaterial({ map: cartL.t, transparent: true }));
    cartel.position.copy(en(0.62, 0, cab.y - 0.33)); cartel.lookAt(cab); grupo.add(cartel);
    function ponerCartel(texto, color = '#ffd23f') {
      const clave = texto + color; if (clave === est.cartelAntes) return; est.cartelAntes = clave;
      const { g, t } = cartL; g.clearRect(0, 0, 1024, 150);
      if (texto) {
        g.font = '72px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 12; g.strokeStyle = TINTA; g.strokeText(texto, 512, 78, 1000); g.fillStyle = color; g.fillText(texto, 512, 78, 1000);
      }
      t.needsUpdate = true;
    }

    // ---------- el marcador (pajaritas, puntos, racha) ----------
    const panL = lz(640, 200);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.1), new THREE.MeshBasicMaterial({ map: panL.t, transparent: true }));
    panel.position.copy(en(0.75, -0.48, cab.y - 0.3)); panel.lookAt(cab); grupo.add(panel);
    let panAntes = '';
    function pintarPanel() {
      const clave = `${Math.round(est.puntos)}|${est.dignidad}|${est.combo}`;
      if (clave === panAntes) return; panAntes = clave;
      const { g, t } = panL; g.clearRect(0, 0, 640, 200);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 28); g.fill();
      const im = texPajarita.image;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = i < est.dignidad ? 1 : 0.25;
        if (im) { const w = 120, h = w * im.height / im.width; g.drawImage(im, 24 + i * 130, 62 - h / 2, w, h); }
      }
      g.globalAlpha = 1; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '46px Caprasimo, serif'; g.fillStyle = '#ffd23f'; g.fillText(`${Math.round(est.puntos)} puntos`, 28, 150);
      const x = 1 + Math.floor(est.combo / 3) * 0.5;
      g.textAlign = 'right'; g.font = '36px Caprasimo, serif'; g.fillStyle = '#7ee081'; g.fillText(est.combo >= 3 ? `Racha x${x}` : '', 612, 150);
      t.needsUpdate = true;
    }

    // ---------- la etiqueta que sube y la nube verde ----------
    const etL = lz(1024, 160);
    const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.0875), new THREE.MeshBasicMaterial({ map: etL.t, transparent: true, depthTest: false }));
    etiqueta.renderOrder = 30; etiqueta.visible = false; grupo.add(etiqueta);
    const etBase = V();
    function etiquetar(texto, color, pos) {
      const { g, t } = etL; g.clearRect(0, 0, 1024, 160);
      g.font = '84px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText(texto, 512, 82, 1000); g.fillStyle = color; g.fillText(texto, 512, 82, 1000);
      t.needsUpdate = true; etBase.copy(pos); est.etiquetaT = 1.4; etiqueta.visible = true;
    }
    const nube = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.32), new THREE.MeshBasicMaterial({ map: texPuff, color: '#a8e07a', transparent: true, depthWrite: false }));
    nube.renderOrder = 20; nube.visible = false; grupo.add(nube);
    let nubeTam = 1;
    function soltarNube(tam) { nubeTam = tam; est.nubeT = 1.4; nube.visible = true; }

    // ---------- el ritmo de la cena ----------
    function siguiente() {
      if (est.acabado || est.dignidad <= 0) return;
      palicaso?.pose('base'); palicaso?.callar();
      ponerCartel('');
      // primero solo chistes; luego se mezclan (nunca dos tripas seguidas)
      const tripa = est.rondas >= 2 && est.ultima !== 'tripa' && Math.random() < 0.38;
      est.ultima = tripa ? 'tripa' : 'chiste';
      est.rondas++;
      est.fase = 'espera';
      programar(Math.max(0.6, 1.2 / est.ritmo), () => (tripa ? empezarTripa() : empezarChiste()));
    }

    // ---------- CHISTE ----------
    function empezarChiste() {
      if (est.acabado) return;
      const [planteo, remate] = sacaChiste();
      est.fase = 'chiste';
      palicaso?.pose('contando'); palicaso?.decir(`¡Escucha! ${planteo}`, { dur: 2.4 / est.ritmo + 0.2 });
      ponerCartel('CHISTE');
      programar(2.2 / est.ritmo, () => {
        if (est.acabado) return;
        palicaso?.decir(remate, { dur: 2.2 });
        palicaso?.pose('riendo'); palicaso?.empujon(0.25);
        sonido('rimshot', { volumen: 0.5 });
        // el anillo, delante de tu boca (se queda quieto en el mundo)
        centroAnillo.copy(xr.boca()).addScaledVector(xr.adelante, 0.4);
        anillo.position.copy(centroAnillo); anillo.lookAt(xr.cabeza);
        circulo.position.copy(centroAnillo); circulo.quaternion.copy(anillo.quaternion);
        anillo.visible = circulo.visible = true;
        // VR: ~1,7× lo que dura en el 2D (hay que llevar la mano a la boca, no pulsar una tecla)
        est.prueba = { tipo: 'chiste', t: 0, dur: Math.max(1.6, 2.3 / est.ritmo), manoFuera: !manos().some(m => cerca(m)) };
        ponerCartel('¡Tápate la boca en el anillo!', '#7ee081');
        if (!est.demoChiste) {
          est.demoChiste = true;
          const regazo = cab.clone().addScaledVector(f, 0.3).addScaledVector(lat, 0.14); regazo.y -= 0.38;
          const boca = xr.boca().addScaledVector(xr.adelante, 0.13);
          fx.demo([{ p: regazo }, { p: regazo }, { p: boca }, { p: boca }], { dur: est.prueba.dur, tramo: est.prueba.dur / 3.6, retraso: 0 });
        }
      });
    }
    const radio = p => R0 + (R1 - R0) * (p.t / p.dur);
    function cerca(m) { const b = xr.boca(), e = m.esMano ? 0.03 : 0; return m.pos.distanceTo(b) < 0.13 + e || m.punta.distanceTo(b) < 0.11 + e; }
    function tragar(m) {
      const p = est.prueba; if (!p || p.tipo !== 'chiste') return;
      const error = Math.abs(radio(p) - ANILLO);
      if (error < est.tol) { m?.vibrar(0.7, 60); bien(error < est.tol * 0.45 ? '¡Tragada!' : 'Por los pelos', error < est.tol * 0.45 ? 120 : 70, centroAnillo, m); }
      else mal('risa');
    }

    // ---------- TRIPA ----------
    function empezarTripa() {
      if (est.acabado) return;
      est.fase = 'tripa';
      ponerCartel('TRIPA: respira y espera el ruido…', '#7ee081');
      sonido('temblor', { volumen: 0.5 });
      const dur = Math.max(3.2, 5.4 / est.ritmo);
      const inicio = 1.2 + Math.random() * Math.max(0.2, dur - 2.6);
      est.prueba = { tipo: 'tripa', t: 0, dur, ruido: [inicio, inicio + 1.25], sono: false, calmaT: 0 };
      est.calma = 0;
      tripaFondo.visible = true;
      if (!est.demoTripa) {
        est.demoTripa = true;
        const p0 = cab.clone().addScaledVector(f, 0.3).addScaledVector(lat, 0.12); p0.y -= 0.42;
        const p1 = p0.clone(); p1.y += 0.14;
        fx.demo([{ p: p0 }, { p: p1 }, { p: p0 }, { p: p1 }, { p: p0 }], { dur: 2.6, tramo: 0.6, retraso: 0.1 });
      }
    }
    function ruido() {
      const p = est.prueba; if (!p || p.tipo !== 'tripa' || est.acabado) return;
      p.sono = true;
      const r = sacaRuido();
      let pos;
      if (r.quien === 'palicaso' && palicaso) { palicaso.pose('emocionado'); palicaso.empujon(0.4); palicaso.decir('¡Escucha, escucha!', { dur: 1.2 }); pos = palicaso.cabezaMundo(V()); }
      else if (r.quien === 'casero') { casero.material.map = texMira; est.ojoRojo = 0; casero.position.y = caseroBase.y + 0.03; pos = casero.position.clone().add(V(0, 0.95, 0)); }
      else { pos = en(1.4, -0.9, cab.y - 0.1); fx.chispas(pos, '#bfe9ff', 26, 1.4); }
      sonido(r.sonido, { volumen: 0.8 });
      etiquetar(r.texto, '#ffd23f', pos);
      ponerCartel('¡RUIDO! ¡AHORA! (aprieta)', '#ffd23f');
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(0.5, 120);
    }
    function soltar(m) {
      const p = est.prueba; if (!p || p.tipo !== 'tripa') return;
      if (p.t >= p.ruido[0] && p.t <= p.ruido[1]) {
        sonido('pedo-silencioso', { volumen: 0.7 });
        soltarNube(0.6);
        bien('Disimulado', 150, tripaFondo.getWorldPosition(V()), m);
      } else mal('escapao');
    }

    // ---------- resultado de cada prueba ----------
    function limpiarPrueba() {
      est.prueba = null; anillo.visible = circulo.visible = false; tripaFondo.visible = false;
      casero.material.map = texCasero; casero.position.y = caseroBase.y;
    }
    function bien(texto, base, pos, m) {
      if (est.acabado) return;
      limpiarPrueba(); est.bien++;
      est.combo++;
      est.ritmo = Math.min(1.9, est.ritmo + 0.08);
      const pts = base * (1 + Math.floor(est.combo / 3) * 0.5);
      est.puntos += pts;
      fx.acierto(pos, { mano: m, racha: est.combo, fuerte: est.combo % 3 === 0 });
      etiquetar(`${texto} +${Math.round(pts)}`, '#7ee081', pos);
      ponerCartel(est.combo % 3 === 0 ? `¡Racha de ${est.combo}!` : 'Todo un señor', '#7ee081');
      // el casero asiente
      est.asiente = 0.5;
      palicaso?.pose('base');
      pintarPanel();
      est.fase = 'pausa';
      programar(0.9, siguiente);
    }
    function mal(tipo) {
      if (est.acabado) return;
      limpiarPrueba(); est.mal++;
      est.combo = 0; est.dignidad--;
      const delante = cab.clone().addScaledVector(f, 0.55); delante.y -= 0.1;
      if (tipo === 'risa') {
        sonido('risa-lasslow');
        etiquetar('¡JAJAJAJA!', '#ff5fa2', delante);
        palicaso?.pose('riendo'); palicaso?.empujon(0.4);
      } else if (tipo === 'escapao') {
        sonido('pedo', { volumen: 0.8 });
        programar(0.25, () => sonido('se-me-ha-escapao'));
        soltarNube(1);
        etiquetar('¡Que se me ha escapao!', '#ff5fa2', delante);
        palicaso?.pose('asco');
      } else {
        sonido('pedo-tuba');
        soltarNube(1.8);
        etiquetar('¡PRRRRRT!', '#ff5fa2', delante);
        palicaso?.pose('horror'); palicaso?.tambalear(0.6);
      }
      // el casero se indigna: se pone rojo
      est.ojoRojo = 0.9;
      sonido('abucheo', { volumen: 0.35 });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(1, 170);
      ponerCartel(est.dignidad > 0 ? `Te quedan ${est.dignidad} pajarita${est.dignidad > 1 ? 's' : ''}` : 'Se acabó el señor', '#ff5fa2');
      pintarPanel();
      est.fase = 'pausa';
      programar(1.4, () => (est.dignidad <= 0 ? final() : siguiente()));
    }

    function final() {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin'; limpiarPrueba();
      const puntos = Math.round(est.puntos);
      programar(0.6, () => ctx.terminar({
        puntos, gana: puntos >= 400,
        linea: `Aguantaste ${Math.max(0, est.rondas - 1)} pruebas ante el casero. Nadie se lo cree, pero lo intentaste.`,
      }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('escena');
    est.fase = 'intro';
    pintarPanel();
    ponerCartel('Esta noche eres un señor');
    ui.instruccion('CHISTE: mano a la boca cuando el círculo toque el anillo · TRIPA: aprieta solo con el RUIDO');
    programar(2.4, siguiente);

    // para el bot (herramientas/pruebas/bots/lasslow.js)
    const api = {
      get fase() { return est.fase; }, get puntos() { return Math.round(est.puntos); }, get dignidad() { return est.dignidad; },
      get combo() { return est.combo; }, get rondas() { return est.rondas; }, get bien() { return est.bien; }, get mal() { return est.mal; },
      get tol() { return est.tol; }, get calma() { return est.calma; },
      get prueba() { const p = est.prueba; if (!p) return null; return p.tipo === 'chiste' ? { tipo: 'chiste', t: p.t, dur: p.dur, radio: radio(p) } : { tipo: 'tripa', t: p.t, dur: p.dur, ruido: p.ruido.slice(), sono: p.sono }; },
      anillo: () => centroAnillo.clone(), boca: () => xr.boca(), ANILLO,
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.lasslow = api;
    grupo.userData.api = api;

    const v = V();
    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        const p = est.prueba;
        // la mano a la boca (solo cuenta al LLEGAR: si ya la tenías ahí, apártala)
        for (const lado of ['derecha', 'izquierda']) {
          const m = xr.manos[lado], dentro = m.activa && cerca(m);
          if (p && p.tipo === 'chiste') {
            if (!p.manoFuera && !manos().some(x => cerca(x))) p.manoFuera = true;
            if (dentro && !est.dentro[lado] && p.manoFuera) tragar(m);
          }
          est.dentro[lado] = dentro;
        }
        // apretar (gatillo o pellizco): solo cuenta en la tripa
        if (est.prueba?.tipo === 'tripa') for (const m of manos()) if (m.empiezaPinza) { soltar(m); break; }
        const q = est.prueba;
        if (q && q.tipo === 'chiste') {
          q.t += dt;
          const r = radio(q);
          circulo.scale.setScalar(Math.max(0.008, r));
          const pasado = r < ANILLO - est.tol, cercaAnillo = Math.abs(r - ANILLO) < est.tol;
          circulo.material.color.set(pasado ? '#ff3b30' : cercaAnillo ? '#ffd23f' : '#ffffff');
          anillo.scale.setScalar(cercaAnillo ? 1.12 : 1);
          if (pasado) mal('risa');
        } else if (q && q.tipo === 'tripa') {
          // respirar: una mano que sube y baja despacio (o resoplar flojito al micro) calma la tripa
          let respira = false;
          for (const m of manos()) { const vy = Math.abs(m.vel.y); if (vy > 0.04 && vy < 0.45 && m.pos.y < xr.cabeza.y - 0.15) respira = true; }
          if (hayMicro()) { const n = leerMicro(dt).nivel; if (n > 0.04 && n < 0.3) respira = true; }
          est.calma = clamp(est.calma + (respira ? dt * 1.6 : -dt * 0.9), 0, 1);
          q.t += dt * (1 - 0.4 * est.calma);
          if (!q.sono && q.t >= q.ruido[0]) ruido();
          const fr = Math.max(0, 1 - q.t / q.dur);
          tripaBarra.scale.x = Math.max(0.01, fr);
          tripaBarra.material.color.set(fr < 0.25 ? '#ff3b30' : est.calma > 0.4 ? '#7ecbff' : '#7ee081');
          tripaFondo.scale.setScalar(1 + Math.sin(est.t * 30) * 0.02 * (1 - fr));
          if (q.sono && q.t > q.ruido[1]) ponerCartel('Se pasó el ruido… ¡ya no hay quien lo tape!', '#ff5fa2');
          else if (!q.sono) ponerCartel(est.calma > 0.4 ? 'Respirando… espera el ruido' : 'TRIPA: respira y espera el ruido…', est.calma > 0.4 ? '#7ecbff' : '#7ee081');
          if (q.t >= q.dur) mal('revienta');
        }
        // el casero: asiente o se pone rojo
        if (est.asiente > 0) { est.asiente -= dt; casero.rotation.z = Math.sin((0.5 - est.asiente) * 12) * 0.05; } else casero.rotation.z = 0;
        if (est.ojoRojo > 0) { est.ojoRojo -= dt; casero.material.color.set(est.ojoRojo > 0 ? '#ff8a80' : '#ffffff'); }
        velas.scale.y = 1 + Math.sin(est.t * 11) * 0.03;
        // la nube verde (sale de debajo de la mesa, de tu silla)
        if (est.nubeT > 0) {
          est.nubeT -= dt;
          const k = 1 - est.nubeT / 1.4;
          nube.position.copy(cab).addScaledVector(f, 0.45).addScaledVector(lat, -0.1); nube.position.y = mesaY + 0.05 + k * 0.35;
          nube.lookAt(xr.cabeza); nube.scale.setScalar(nubeTam * (0.4 + k * 0.9));
          nube.material.opacity = 0.9 * (1 - k);
          if (est.nubeT <= 0) nube.visible = false;
        }
        // la etiqueta sube y se apaga
        if (est.etiquetaT > 0) {
          est.etiquetaT -= dt;
          const k = 1 - est.etiquetaT / 1.4;
          etiqueta.position.copy(etBase).add(v.set(0, 0.06 + k * 0.12, 0)).lerp(xr.cabeza, 0.2);
          etiqueta.lookAt(xr.cabeza);
          etiqueta.material.opacity = Math.min(1, est.etiquetaT / 0.35);
          if (est.etiquetaT <= 0) etiqueta.visible = false;
        }
        if (est.t > 9 && est.rondas >= 3 && !est.ayudaFuera) { est.ayudaFuera = true; ui.instruccion(null); }
        palicaso?.actualizar(dt, xr.cabeza);
        fx.actualizar(dt);
      },
      // salir a mitad: te levantas de la mesa, con los puntos que lleves
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin'; limpiarPrueba();
        palicaso?.decir('¿Ya te vas? ¡Si venía lo mejor!', { dur: 2 });
        ctx.terminar({ puntos: Math.round(est.puntos), gana: false, linea: 'Te levantas de la mesa. El casero apunta algo en su libreta.' });
      },
      destruir() {
        est.acabado = true; eventos.length = 0;
        ui.instruccion(null);
        fx.destruir();
        if (palicaso) { palicaso.callar(); palicaso.grupo.parent?.remove(palicaso.grupo); }
        for (const t of propias) t.dispose();
        for (const m of [mesa, faldon, velas, casero, anillo, circulo, tripaFondo, tripaBarra, cartel, panel, etiqueta, nube]) { m.geometry.dispose(); m.material.dispose(); }
        if (typeof window !== 'undefined' && window.__mj?.lasslow === api) window.__mj.lasslow = null;
      },
    };
  },
};
