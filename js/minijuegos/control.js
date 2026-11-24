// El control · VR nativo (escala «inmersivo», SENTADO). Reglas de base/js/escenas/control.js; textos de base/js/contenido/furgo.js.
//
// La misma cabina de «La furgo» (furgo_cabina.js), parada en el arcén. Delante, el coche de los agentes con las luces
// azules y rojas; el agente del humo se asoma a TU ventanilla y pregunta. Contestas tocando una de las tres tarjetas
// (normal, sospechosa o absurda, barajadas). Mientras, hay que disimular con gestos de verdad:
//   HUMO dentro        → gira la manivela de la ventanilla (izquierda) o abanica junto a ella.
//   OJOS ROJOS         → llévate la mano a los ojos, o coge las gafas del salpicadero y póntelas.
//   LASSLOW se ríe     → tápale la boca con la mano (se te acerca él).
//   PERICO, el pin pin → dedo a los labios (la mano a tu boca).
//   COTINE come        → cógele la bolsa y escóndela en la guantera.
// La barra de sospecha (en el salpicadero) sube con los fallos y baja con las respuestas buenas. Si llega arriba,
// «bajen del vehículo». Ganas si aguantas todas las preguntas.
// Acompañantes: los que subiste en «La furgo» (localStorage['unake-xr-furgo-acompanantes']); si no, Lasslow y Perico.
import * as THREE from 'three';
import { Bocadillo } from '../bocadillo.js';
import { Jugo } from './jugo.js';
import { crearCabina, ACOMP, leerAcompanantes, lienzo, envolver, azar, bolsa, clamp, V, TINTA } from './furgo_cabina.js';

const CTL_POR_DEFECTO = ['lasslow', 'perico'];
const CLAVE_PRIMERA = 'unake-xr-control-primera';
const TELLS = {
  humo: { quien: null, texto: '¡Humo dentro!', ayuda: 'Gira la manivela o abanica' },
  ojos: { quien: null, texto: '¡Te mira a los ojos!', ayuda: 'Tápatelos o ponte las gafas' },
  risa: { quien: 'lasslow', texto: '¡Le entra la risa!', ayuda: 'Tápale la boca' },
  pinpin: { quien: 'perico', texto: 'Pin… pin…', ayuda: 'Dedo a los labios' },
  comer: { quien: 'cotine', texto: '(mastica)', ayuda: 'Cógelo y a la guantera' },
};
const TELL_ORDEN = ['humo', 'ojos', 'risa', 'pinpin', 'comer'];

// PREGUNTAS_CONTROL (base/js/contenido/furgo.js), tal cual.
const PREGUNTAS = [
  { id: 'algo', si: null, primera: true, q: '¿Llevan algo? Ya me entiende. Algo para fumar que no sea tabaco.',
    n: ['No, agente. Nada. Solo pipas de Perico.', 'Hm. Las pipas, bien.'], s: ['¿Algo? ¿Algo de algo? ¿Qué es algo?', 'Algo es algo. No me haga repetirlo.'], a: ['Solo lo de la guantera, agente. Pero la guantera es de un señor.', '…No pienso abrir eso. Circulen.', true] },
  { id: 'origen', si: null, q: '¿De dónde vienen?',
    n: ['De un bar del barrio, agente. De cenar con amigos.', 'Hm. Bien.'], s: ['De… eh… ¿De dónde veníamos? (mira atrás) ¿De dónde veníamos?', 'Eso pregunto yo.'], a: ['Del entierro de un pez. Se llamaba Fortunato.', 'Mi más sentido pésame. …¿Era grande?', true] },
  { id: 'destino', si: null, q: '¿A dónde van?',
    n: ['A la feria, agente. Dicen que hay noria.', 'La hay.'], s: ['A ningún sitio. Es decir, a uno. No. A ninguno.', 'Repítame eso.'], a: ['A cobrar un churro que me deben desde el noventa y ocho.', 'Eso ha prescrito. Y usted me toma el pelo.', false] },
  { id: 'bebida', si: null, q: '¿Han bebido?',
    n: ['Solo agua, agente. Y un refresco.', 'Bien.'], s: ['¿Beber? ¿Nosotros? Yo no. ¿Tú? Él no. Nadie ha bebido nada. Ni una calada. Digo, ni un trago.', 'Mm.'], a: ['Solo el ambientador. A mi amiga le entró sed.', 'Lo apunto. «Ambientador».', false] },
  { id: 'olor', si: null, q: '¿Qué es ese olor?',
    n: ['El ambientador, agente. Pino. Muy fuerte.', 'Mucho pino, sí.'], s: ['¿Qué olor? Yo no huelo nada. ¿Tú hueles algo? Es que ya me he acostumbrado.', 'Eso es justo lo que me preocupa.'], a: ['Es colonia. Mucha. Nos la ha echado un tío en un semáforo.', 'Pasa mucho.', true] },
  { id: 'ojos', si: null, q: '¿Por qué tiene los ojos así?',
    n: ['Es la luz de la carretera, agente. Me deslumbra. Por eso las gafas.', 'Entendido.'], s: ['¿Los ojos? ¿Qué les pasa a mis ojos? ¿Se ven mal? ¿Se ven?', 'Se ven.'], a: ['Alergia al polen. Y a los controles.', '«A los controles», dice.', false] },
  { id: 'dueno', si: null, q: 'Documentación. ¿De quién es la furgo?',
    n: ['De un amigo, agente. Aquí tiene los papeles.', 'En regla.'], s: ['Es… prestada. No, comprada. Heredada. Es de la familia.', 'Los papeles.'], a: ['De mi amigo, que es una estrella. Fugaz, pero de las buenas.', 'Con los papeles en regla, me da igual que sea una constelación.', true] },
  { id: 'ventanilla', si: null, q: '¿Por qué llevan la ventanilla bajada con este frío?',
    n: ['Para que se airee, agente. Dormirse al volante es peligroso.', 'Prudente.'], s: ['Calor. Tengo mucho calor. Sudo. Todos sudamos. Estamos sudando mucho, ¿verdad?', 'Se nota.'], a: ['Es que me cae bien el invierno. Quería saludarlo.', 'Salúdelo con la ventanilla subida.', false] },
  { id: 'guantera', si: null, q: '¿Qué hay en la guantera?',
    n: ['Las gafas, los papeles y unos pañuelos.', 'Correcto.'], s: ['Nada. Cosas. Nada ilegal. Cosas normales. Papeles. Y… cosas.', 'Ábrala.'], a: ['Un hámster retirado. Se llama Don Eusebio.', 'Ábrala. …Hay un hámster. Siga.', true] },
  { id: 'maletero', si: null, q: '¿Qué llevan en el maletero?',
    n: ['Una nevera con bebidas y algo de picar. Vamos a una feria.', 'Bien.'], s: ['En el maletero… ¿en cuál? Nada. No lo abra. Que no se abre bien.', 'Lo abro yo.'], a: ['Un sofá. El de la carretera. Se nos cayó y volvimos a por él.', 'Lo he visto en el arcén. Me alegro de que lo recogieran.', true] },
  { id: 'bolsas', si: null, q: '¿Y todas esas bolsas de patatas?',
    n: ['La merienda, agente. Para el viaje.', 'Razonable.'], s: ['Es que nos ha dado hambre. De repente. A los cinco. Sin motivo. Un hambre normal.', 'Mm.'], a: ['Es nuestra dieta. Dulce, salado y un sitio donde sentarse.', 'Hay sitios peores donde sentarse.', true] },
  { id: 'pajaro', si: ['perico'], q: '¿Ese pájaro es suyo?',
    n: ['De un amigo. Va de copiloto y no molesta.', 'Hm.'], s: ['Ese pájaro no sabe nada. No ha visto nada. No le pregunte nada.', 'Se lo voy a preguntar.'], a: ['No es un pájaro. Es el motor. Silba.', 'El motor tiene plumas.', false] },
  { id: 'risa', si: ['lasslow'], q: '¿De qué se ríe el señor?',
    n: ['Es muy risueño, agente. Un caballero risueño.', 'Ya veo.'], s: ['No es nada. Se ríe de… los baches. De las curvas. De nada.', 'De nada, dice.'], a: ['Es su tos. Una tos muy alegre.', 'Que se la mire.', true] },
];
const AGENTE = {
  acercarse: ['Buenas noches. Control de rutina. Ventanilla.', 'Documentación. Y calma, que se les nota la prisa.', 'Apague el motor. Y las risas, si puede.'],
  dejarles_ir: ['Está todo en orden. Circulen.', 'Pueden seguir. Aunque siga oliendo a pino.', 'Una cosa más. ¿Van a la feria? Mi turno acaba ahora. ¿Me hacen un hueco?'],
  pillarles: ['Bajen del vehículo. Todos. Despacio.', 'Voy a necesitar que me acompañen. Es por mi informe, no por ustedes.', 'Multa de veinte monchis. Y no me miren así: yo también tengo prisa.'],
};
const ESCAPES = {
  lasslow: { escapa: ['JA… JAJAJA… perdón, agente, es que… «agente»… JA.', '¡Que se me ha escapao! JAJAJA.'], tapado: 'Mmf… mfjajaja…', reaccion: '…¿Eso ha sido un bache?' },
  perico: { escapa: ['Pin pin. ¡Contraseña! ¡Contraseña!', 'Pin pin. Hay monchis en la guantera. En la guantera.', 'Pin pin. Aquí huele. Aquí huele.'], tapado: 'Pin… (pico tapado) pff.', reaccion: 'El pájaro ha dicho algo.' },
  cotine: { escapa: ['(ñam ñam) ¿Esto es el ambientador? Sabía a pino. ¿Qué? Tenía hambre.', 'Un pellizquito nada más… (cruje una bolsa)'], tapado: 'Ñam. (muy bajito)', reaccion: '¿Se acaba de comer el ambientador?' },
};
const AGENTE_VE = {
  humo: ['¿Eso es humo?', '¿Por qué hay tanta niebla ahí dentro?'], ojos: ['Esos ojos…', 'Míreme a la cara. Esos ojos…'],
  mal: ['¿Todo bien? Se mueven mucho.', 'Quietos ahí, que me ponen nervioso.'],
};
const REACCION = { n: ['Mm. Siga, siga.', 'Vale, vale…', 'Eso cuadra.'], s: ['Qué raro… ¿seguro?', 'Mm. Eso me suena fatal.', '¿Cómo ha dicho?'], tarde: ['¿Hola? ¿Me escuchan?', '¿Se han dormido?'] };
const DICHOS = {
  palicaso: '¿Les cuento lo de mi primo?', pompa: 'No. …Pero sí.', blancaso: 'Apunto: control, 23:41.', puky: '¿Me llamabais?',
  lasslow: 'Ji… no, nada.', perico: 'Pin pin. Digo… nada.', cotine: 'Yo no quería venir.',
};
const EUSEBIO_CONTROL = [
  'Don Eusebio se queda quieto con los ojos muy abiertos. Es un peluche. Siempre lo fue.',
  'El agente le mira. Don Eusebio le mira. Es un duelo de miradas y gana el hámster.',
  'Los carrillos de Don Eusebio han crecido un poco. Nadie ha querido preguntar por qué.',
];

// ======================================================================================
export default {
  clave: 'Control', titulo: 'El control', escala: 'inmersivo', tapaElBar: true, umbrales: [600, 1100, 1700],
  ayudas: { gatillo: 'Contestar / coger gafas, bolsa, manivela', lateral: 'Coger y girar la manivela', mano: { pellizco: 'Tocar respuesta / coger', puno: 'Coger y girar' } },

  async crear(ctx) {
    const { xr, ui, sonido } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-control';

    // el nivel del 2D: una pregunta más por nivel (hasta 4) y un pelín menos de plazo para disimular
    const nivel = clamp(ctx.nivel ?? 1, 1, 4);
    const fx = new Jugo(ctx, grupo);
    const demosVistas = new Set();
    // ---------- banderas de partida: TODAS aquí ----------
    const est = {
      fase: 'cargando', t: 0, sosp: 15, puntos: 0, preg: 0, total: 5 + nivel,
      tiempoQ: 12,   // el 2D da 9,5 s: aquí hay que leer en el aire y moverse
      plazo: 3.6 - 0.15 * (nivel - 1), // el 2D da 2,5 s con una tecla: un gesto de verdad pide más
      activos: [], programa: [], tq: 0, tPreg: 0, q: null, orden: [], respondida: false, malCD: 0,
      fallos: 0, aciertosTell: 0, acabado: false, destruido: false, quipT: 6, latidoT: 0.5, espera: 0,
      luzT: 0, gafasPuestas: 0, intro: 0, cerca: 0, zoomFijo: false, humoFin: -9, giroSinHumo: false, manoManivela: null,
    };
    const eventos = []; const programar = (seg, fn) => eventos.push({ t: est.t + seg, fn });
    const guardada = leerAcompanantes(ctx);
    const comp = (guardada && guardada.length ? guardada : CTL_POR_DEFECTO).slice();
    const tellsOk = TELL_ORDEN.filter(t => !TELLS[t].quien || comp.includes(TELLS[t].quien));
    const maxSim = comp.length >= 3 ? 2 : 1;
    const sacaTell = bolsa(tellsOk);
    const apto = p => !p.si || p.si.some(id => comp.includes(id));
    let usaPrimera = false; try { usaPrimera = !localStorage.getItem(CLAVE_PRIMERA); } catch { usaPrimera = false; }
    const primera = PREGUNTAS.find(p => p.primera);
    const lista = PREGUNTAS.filter(p => apto(p) && !(usaPrimera && p.primera));
    const sacaPreg = bolsa(lista);

    const cab = await crearCabina(ctx);
    grupo.add(cab.raiz);
    const { H } = cab;
    const L = (x, y, z) => new THREE.Vector3(x, y, z);
    const propias = [];
    const lz = (w, h) => { const l = lienzo(w, h); propias.push(l.t); return l; };
    // aparcados: la carretera se para y el volante se aparta para dejar sitio a las tarjetas
    cab.carr.v = 6;
    cab.volBase.position.set(0, H - 0.56, -0.48);
    cab.eusebio('peluche');

    const [imgAgente, puff] = await Promise.all([ctx.img('obj-agente.png'), ctx.img('fx-humo-puff.png')]);

    // ---------- el coche de los agentes, delante, con sus luces ----------
    const coche = new THREE.Group(); coche.position.set(-3.6, 0, -9); coche.rotation.y = 0.25; cab.mundo.add(coche);
    const caja = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.set(x, y, z); coche.add(m); return m; };
    caja(1.9, 0.9, 4.2, '#1b2a5a', 0, 0.75, 0); caja(1.7, 0.6, 2.0, '#e8ecf5', 0, 1.45, 0.2);
    caja(1.92, 0.18, 1.0, '#e8ecf5', 0, 0.95, 0.4); // la franja blanca de la puerta
    const luzAzul = caja(0.8, 0.26, 0.45, '#2a6bff', -0.42, 1.88, 0.2), luzRoja = caja(0.8, 0.26, 0.45, '#ff3b30', 0.42, 1.88, 0.2);
    // y su reflejo en la cabina: un velo azul/rojo que late en el parabrisas y la ventanilla
    const velo = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.8), new THREE.MeshBasicMaterial({ color: '#2a6bff', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
    velo.position.set(0.45, H + 0.04, -0.84); velo.renderOrder = 10; cab.raiz.add(velo);

    // ---------- el agente del humo, asomado a tu ventanilla ----------
    const agente = new THREE.Group(); agente.rotation.y = Math.PI / 2; cab.raiz.add(agente);
    const AG_W = 0.66, AG_H = AG_W * 282 / 320;
    const agTrasera = new THREE.Mesh(new THREE.PlaneGeometry(AG_W * 1.04, AG_H * 1.03), new THREE.MeshBasicMaterial({ color: '#b98d5e', map: imgAgente, alphaTest: 0.5 }));
    agTrasera.material.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = diffuse;'); };
    agTrasera.material.customProgramCacheKey = () => 'silueta-agente';
    agTrasera.position.z = -0.006;
    const agFrente = new THREE.Mesh(new THREE.PlaneGeometry(AG_W, AG_H), new THREE.MeshBasicMaterial({ map: imgAgente, alphaTest: 0.5 }));
    agente.add(agTrasera, agFrente);
    const AG_FUERA = L(-1.0, H - 0.02, 2.2), AG_SITIO = L(-0.98, H - 0.02, -0.42);
    agente.position.copy(AG_FUERA);
    const bocA = new Bocadillo(); const anclaA = new THREE.Group(); anclaA.add(bocA.malla); cab.raiz.add(anclaA);
    anclaA.position.set(-0.4, H - 0.02, -0.62); // entre él y tus tarjetas: se lee sin girar la cabeza
    function agenteDice(texto, dur = 2.2, rojo = false) { bocA.mostrar(texto, dur, { color: rojo ? '#ffd0d6' : '#ffffff' }); }

    // ---------- los acompañantes, en sus asientos ----------
    const figuras = {};
    let asiento = 0;
    await Promise.all(comp.map(async id => {
      const r = await ctx.Recortable.crear(ACOMP[id].rec, 'humo').catch(e => { console.warn('control: sin', id, e); return null; });
      if (!r) return;
      const f = { id, r, puky: id === 'puky' };
      figuras[id] = f;
    }));
    for (const id of comp) {
      const f = figuras[id]; if (!f) continue;
      if (f.puky) { f.r.grupo.position.set(0.55, H - 0.12, cab.PARABRISAS.z); f.r.grupo.scale.setScalar(0.62); f.r.sombra.visible = false; cab.raiz.add(f.r.grupo); f.r.pose('asomandose'); continue; }
      f.i = asiento; f.sitio = cab.ASIENTOS[asiento++]; cab.sentar(f.r, f.i);
      f.acercar = 0; f.cerca = L(0.47, H - 0.63, -0.14);
    }

    // ---------- humo dentro de la cabina (una malla instanciada) ----------
    const humo = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.27), new THREE.MeshBasicMaterial({ map: puff, transparent: true, opacity: 0, depthWrite: false, fog: false }), 7);
    humo.frustumCulled = false; humo.renderOrder = 6; humo.visible = false; cab.raiz.add(humo);
    const bocanadas = Array.from({ length: 7 }, (_, i) => ({ base: L(-0.35 + i * 0.17, H - 0.1 + (i % 3) * 0.09, -0.55 + (i % 2) * 0.12), p: V(), sale: 0 }));
    let humoVal = 0, humoSale = 0;
    function pintarHumo(dt) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V();
      bocanadas.forEach((b, i) => {
        b.p.copy(b.base); b.p.y += Math.sin(est.t * 0.8 + i) * 0.03;
        if (humoSale > 0) b.p.x -= (1 - humoSale) * 1.4;
        q.setFromAxisAngle(L(0, 0, 1), est.t * 0.2 + i);
        humo.setMatrixAt(i, m4.compose(b.p, q, s.setScalar(0.8 + humoVal * 0.7)));
      });
      humo.instanceMatrix.needsUpdate = true;
      if (humoSale > 0) humoSale = Math.max(0, humoSale - dt / 0.8);
      const op = humoSale > 0 ? humoSale * 0.8 : humoVal * 0.8;
      humo.material.opacity = op; humo.visible = op > 0.01;
    }

    // ---------- los ojos rojos: un velo rojo en los bordes de tu vista ----------
    const vinL = lz(256, 256);
    { const g = vinL.g, r = g.createRadialGradient(128, 128, 60, 128, 128, 128); r.addColorStop(0, 'rgba(140,0,30,0)'); r.addColorStop(1, 'rgba(140,0,30,.95)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); vinL.t.needsUpdate = true; }
    const vineta = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: vinL.t, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    vineta.renderOrder = 40; vineta.visible = false; grupo.add(vineta);

    // ---------- la bolsa de Cotine ----------
    const bolsaL = lz(128, 160);
    { const g = bolsaL.g; g.fillStyle = '#ffd23f'; g.strokeStyle = TINTA; g.lineWidth = 8; g.beginPath(); g.moveTo(14, 20); g.lineTo(114, 20); g.lineTo(106, 150); g.lineTo(22, 150); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff5fa2'; g.beginPath(); g.arc(64, 84, 30, 0, 7); g.fill(); g.stroke(); g.fillStyle = TINTA; g.font = '22px Caprasimo, serif'; g.textAlign = 'center'; g.fillText('patatas', 64, 92); bolsaL.t.needsUpdate = true; }
    const bolsaM = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.14), new THREE.MeshBasicMaterial({ map: bolsaL.t, alphaTest: 0.4, side: THREE.DoubleSide }));
    bolsaM.visible = false; cab.raiz.add(bolsaM);
    const bolsaE = { mano: null, enCotine: false };

    // ---------- tarjetas de respuesta (con varias líneas: las respuestas son largas) ----------
    const cartas = [0, 1, 2].map(i => {
      const l = lz(768, 200);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.0885), new THREE.MeshBasicMaterial({ map: l.t, transparent: true }));
      m.position.set(0.08, H - 0.075 - i * 0.097, -0.43); m.lookAt(cab.aMundo(L(0, H + 0.05, 0))); m.visible = false; m.renderOrder = 4;
      cab.raiz.add(m); return { m, l, tipo: null };
    });
    function pintarCarta(c, texto) {
      const { g, t } = c.l; g.clearRect(0, 0, 768, 200);
      g.fillStyle = '#fffaf0'; g.strokeStyle = TINTA; g.lineWidth = 10; g.beginPath(); g.roundRect(6, 6, 756, 188, 30); g.fill(); g.stroke();
      let tam = 46, ls; do { g.font = `${tam}px Caprasimo, serif`; ls = envolver(g, texto, 700); tam -= 4; } while (ls.length * (tam + 4) * 1.1 > 176 && tam > 22);
      tam += 4; g.fillStyle = TINTA; g.textAlign = 'center'; g.textBaseline = 'middle';
      ls.forEach((x, k) => g.fillText(x, 384, 100 + (k - (ls.length - 1) / 2) * tam * 1.1));
      t.needsUpdate = true;
    }
    const barraT = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.008), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    barraT.position.set(0.08, H - 0.32, -0.43); barraT.quaternion.copy(cartas[2].m.quaternion); barraT.visible = false; cab.raiz.add(barraT);

    // ---------- la sospecha, en el salpicadero (a la izquierda) ----------
    const panL = lz(640, 200);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.094), new THREE.MeshBasicMaterial({ map: panL.t, transparent: true }));
    panel.position.set(-0.36, H - 0.235, -0.56); panel.rotation.set(-0.5, 0.25, 0); cab.raiz.add(panel);
    let panAntes = '';
    function pintarPanel() {
      const s = Math.round(est.sosp), clave = `${s}|${est.puntos}|${est.preg}`;
      if (clave === panAntes) return; panAntes = clave;
      const { g, c, t } = panL; g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 632, 192, 26); g.fill();
      g.textBaseline = 'middle'; g.font = '40px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText('Sospecha', 24, 44);
      g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText(`${est.puntos} puntos`, 616, 44); g.textAlign = 'left';
      g.fillStyle = '#3d3350'; g.fillRect(24, 82, 592, 44);
      g.fillStyle = s < 40 ? '#7ee081' : s < 70 ? '#ffd23f' : '#ff3b30'; g.fillRect(24, 82, 592 * s / 100, 44);
      g.strokeStyle = TINTA; g.lineWidth = 5; g.strokeRect(24, 82, 592, 44);
      g.font = '32px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText(est.preg ? `Pregunta ${est.preg} de ${est.total}` : 'Control de rutina', 24, 162);
      t.needsUpdate = true;
    }

    // ---------- los avisos de lo que te delata (con su cuenta atrás) ----------
    const avisos = {};
    for (const tipo of tellsOk) {
      const l = lz(512, 170), T = TELLS[tipo];
      const g = l.g; g.fillStyle = 'rgba(20,12,28,.88)'; g.beginPath(); g.roundRect(4, 4, 504, 162, 30); g.fill();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '50px Caprasimo, serif'; g.fillStyle = '#ff5fa2'; g.fillText(T.texto, 256, 54, 480);
      g.font = '38px Caprasimo, serif'; g.fillStyle = '#fff3e6'; g.fillText(T.ayuda, 256, 118, 480); l.t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.073), new THREE.MeshBasicMaterial({ map: l.t, transparent: true, depthTest: false }));
      m.renderOrder = 25; m.visible = false;
      const barra = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.01), new THREE.MeshBasicMaterial({ color: '#7ee081', depthTest: false }));
      barra.position.y = -0.045; barra.renderOrder = 26; m.add(barra);
      cab.raiz.add(m); avisos[tipo] = { m, barra };
    }
    const OJOS_LOCAL = L(0, H, -0.05);
    function dondeAviso(tipo) {
      if (tipo === 'humo') return L(-0.4, H - 0.12, -0.36); // junto a la manivela
      if (tipo === 'ojos') return L(0.14, H + 0.19, -0.5);
      const f = figuras[TELLS[tipo].quien]; if (!f) return L(0.3, H + 0.1, -0.4);
      return cab.aLocal(f.r.grupo.localToWorld(V().set(0, 0.98, 0)));
    }

    // ---------- el ritmo de las preguntas ----------
    function siguientePregunta() {
      if (est.acabado) return;
      if (est.preg >= est.total) { est.fase = 'acabando'; est.espera = 0; return; }
      est.preg++;
      let q;
      if (usaPrimera && est.preg === 1) { q = primera; try { localStorage.setItem(CLAVE_PRIMERA, '1'); } catch { /* sin almacenamiento */ } }
      else q = sacaPreg();
      est.q = q; est.respondida = false;
      est.orden = ['n', 's', 'a'].sort(() => Math.random() - 0.5);
      est.fase = 'hablando';
      agenteDice(q.q, est.tiempoQ + 2);
      programar(Math.min(2.2, 0.6 + q.q.length * 0.026), () => {
        if (est.acabado) return;
        est.fase = 'pregunta'; est.tq = est.tiempoQ; est.tPreg = 0;
        cartas.forEach((c, i) => { c.tipo = est.orden[i]; pintarCarta(c, q[c.tipo][0]); c.m.visible = true; c.m.scale.setScalar(0.01); c.aparece = -i * 0.07; });
        barraT.visible = true;
        planificarTells();
      });
      pintarPanel();
    }
    function planificarTells() {
      let l;
      if (est.preg === 1) l = ['humo'];
      else if (est.preg === 2 && tellsOk.includes('ojos')) l = ['ojos'];
      else { const n = 1 + (Math.random() < 0.55 ? 1 : 0) + (comp.length >= 3 && Math.random() < 0.7 ? 1 : 0); l = []; for (let i = 0; i < n; i++) l.push(sacaTell()); }
      const hasta = est.tiempoQ - est.plazo - 0.6;
      est.programa = l.map((t, i) => ({ tipo: t, t: 0.9 + (hasta - 0.9) * ((i + Math.random() * 0.6) / l.length) })).sort((a, b) => a.t - b.t);
    }
    function responder(i) {
      if (est.fase !== 'pregunta' || est.respondida) return;
      est.respondida = true;
      const q = est.q, tipo = est.orden[i], c = cartas[i];
      let txt, ds, pts = 0, cuela = false;
      if (tipo === 'n') { ds = -7; pts = 100; txt = q.n[1] || azar(REACCION.n); }
      else if (tipo === 's') { ds = 14; txt = q.s[1] || azar(REACCION.s); }
      else { cuela = q.a[2] !== undefined ? q.a[2] : Math.random() < 0.55; ds = cuela ? -12 : 12; pts = cuela ? 180 : 0; txt = q.a[1]; if (cuela && !q.primera) sonido('risas', { volumen: 0.4 }); }
      subeSosp(ds); est.puntos += pts;
      cab.etiqueta(pts ? `+${pts}` : '¡Uy!', pts ? '#7ee081' : '#ff5fa2', cab.aLocal(c.m.getWorldPosition(V())).add(L(0.2, 0.03, 0)), 0.16);
      for (const k of cartas) k.m.visible = false; barraT.visible = false;
      if (q.primera && tipo === 'a') { // silencio, el agente se te acerca y «…¿Cómo dice?»
        est.fase = 'respuesta'; est.zoomFijo = true; agenteDice('…', 1.8);
        programar(1.8, () => { if (!est.acabado) agenteDice('…¿Cómo dice?', 1.3); });
        programar(3.1, () => { est.zoomFijo = false; if (!est.acabado) { if (cuela) sonido('risas', { volumen: 0.4 }); cierraPregunta(txt, 'a'); } });
        return;
      }
      cierraPregunta(txt, tipo);
    }
    function cierraPregunta(txt, tipo) {
      est.fase = 'respuesta';
      for (const k of cartas) k.m.visible = false; barraT.visible = false;
      sonido(tipo === 's' ? 'oooh' : 'pop', { volumen: 0.3 });
      agenteDice(txt, Math.min(3.2, 1.2 + txt.length * 0.04));
      programar(Math.min(3.2, 1.2 + txt.length * 0.04) + 0.5, siguientePregunta);
    }
    function subeSosp(d) {
      est.sosp = clamp(est.sosp + d, 0, 100);
      if (est.sosp >= 100 && !est.acabado) final(false);
    }

    // ---------- lo que te delata ----------
    function empezarTell(tipo) {
      if (est.activos.some(a => a.tipo === tipo)) return;
      const d = est.plazo * (tipo === 'comer' ? 1.4 : 1);
      const a = { tipo, t: d, d };
      est.activos.push(a);
      const av = avisos[tipo]; av.m.visible = true; av.m.scale.setScalar(0.01); av.aparece = 0;
      sonido('neon', { volumen: 0.25 });
      const quien = TELLS[tipo].quien, f = quien && figuras[quien];
      if (f) f.acercar = 1;
      if (tipo === 'humo') humoVal = 0.01;
      if (tipo === 'ojos') { vineta.visible = true; if (est.gafasPuestas > 0) programar(0.3, () => { const b = est.activos.find(x => x.tipo === 'ojos'); if (b) tapa(b); }); }
      if (tipo === 'risa') { f.r.pose(ACOMP.lasslow.alt); f.r.decir('Ji… ji…', { dur: d }); sonido('risa-fondo', { volumen: 0.3 }); }
      if (tipo === 'pinpin') { f.r.pose('chivato'); f.r.decir('Pin…', { dur: d }); }
      if (tipo === 'comer') { bolsaM.visible = true; bolsaE.enCotine = true; f.r.decir('(mastica)', { dur: d }); }
      demoTell(tipo, f);
    }
    // la primera vez de cada cosa que te delata, la mano fantasma enseña el gesto (sin llegar a tu cara)
    function demoTell(tipo, f) {
      if (demosVistas.has(tipo)) return;
      demosVistas.add(tipo);
      const ad = xr.adelante.clone(), regazo = xr.cabeza.clone().addScaledVector(ad, 0.38).add(V(0.12, -0.3, 0));
      const cerca = p => p.clone().addScaledVector(ad, 0.14); // se queda delante: a 5 cm de los ojos no se ve
      let pasos = null;
      if (tipo === 'humo') {
        const c = cab.aMundo(dondeAviso('humo')).add(V(0, -0.05, 0.04));
        pasos = [{ p: c.clone().add(V(0.05, 0.05, 0.05)) }, { p: c, puno: true }, { p: c.clone().add(V(0, 0.06, -0.04)), puno: true }, { p: c.clone().add(V(0, 0, -0.08)), puno: true }, { p: c.clone().add(V(0, -0.06, -0.04)), puno: true }, { p: c, puno: true }];
      } else if (tipo === 'ojos') pasos = [{ p: regazo }, { p: cerca(ojosMundo()) }, { p: cerca(ojosMundo()) }];
      else if (tipo === 'pinpin') pasos = [{ p: regazo }, { p: cerca(xr.boca()), pinza: true }, { p: cerca(xr.boca()), pinza: true }];
      else if (tipo === 'risa' && f) { const b = f.r.bocaMundo(V()); pasos = [{ p: regazo }, { p: b.clone().lerp(xr.cabeza, 0.25) }, { p: b }]; }
      else if (tipo === 'comer') { const b = bolsaM.getWorldPosition(V()), g = cab.aMundo(cab.guantera); pasos = [{ p: regazo }, { p: b }, { p: b, puno: true }, { p: g, puno: true }, { p: g }]; }
      if (pasos) fx.demo(pasos, { dur: Math.min(2.6, est.plazo * 0.75), tramo: 0.45, retraso: 0.1 });
    }
    function quitarAviso(a) {
      const av = avisos[a.tipo]; av.m.visible = false;
      const quien = TELLS[a.tipo].quien, f = quien && figuras[quien];
      if (f) { f.acercar = 0; f.r.pose('base'); f.r.callar(); }
      if (a.tipo === 'ojos') vineta.visible = false;
      if (a.tipo === 'comer') { bolsaE.enCotine = false; if (bolsaE.mano) { bolsaE.mano = null; } bolsaM.visible = false; }
    }
    function tapa(a) {
      const i = est.activos.indexOf(a); if (i < 0) return;
      est.activos.splice(i, 1);
      const rapido = a.t > a.d * 0.5, g = 50 + (rapido ? 25 : 0);
      est.puntos += g; est.aciertosTell++; subeSosp(-3);
      const pos = dondeAviso(a.tipo);
      quitarAviso(a);
      if (a.tipo === 'humo') { humoSale = 1; humoVal = 0; est.humoFin = est.t; sonido('whoosh', { volumen: 0.5 }); }
      if (a.tipo === 'ojos') sonido('fup', { volumen: 0.4 });
      const quien = TELLS[a.tipo].quien;
      if (quien) { const f = figuras[quien]; f?.r.decir(ESCAPES[quien].tapado, { dur: 1.2 }); f?.r.empujon(0.2); sonido(a.tipo === 'comer' ? 'fup' : 'plop', { volumen: 0.4 }); }
      if (a.tipo === 'comer') { cab.eusebio('pipas', 1.6); }
      fx.chispas(cab.aMundo(pos.clone()), rapido ? '#ffd23f' : '#7ee081', rapido ? 28 : 14, rapido ? 1 : 0.6);
      cab.etiqueta(rapido ? `¡Justo! +${g}` : `+${g}`, '#7ee081', pos.add(L(0, 0.06, 0)), 0.2);
      sonido('campanita', { volumen: 0.3, tono: 1 + Math.min(6, est.aciertosTell) * 0.05 });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(0.6, 50);
    }
    function falla(a) {
      const i = est.activos.indexOf(a); if (i < 0) return;
      est.activos.splice(i, 1); est.fallos++;
      const pos = dondeAviso(a.tipo);
      quitarAviso(a);
      if (a.tipo === 'humo') { humoSale = 0.6; humoVal = 0; est.humoFin = est.t; }
      subeSosp(24 + 2 * (nivel - 1));
      sonido('sting', { volumen: 0.4 });
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(1, 160);
      const quien = TELLS[a.tipo].quien;
      if (quien && ESCAPES[quien]) { figuras[quien]?.r.decir(azar(ESCAPES[quien].escapa), { dur: 2.4 }); agenteDice(ESCAPES[quien].reaccion, 1.6, true); }
      else agenteDice(azar(AGENTE_VE[a.tipo]), 1.6, true);
      if (est.fase === 'pregunta' && est.q) programar(1.7, () => { if (est.fase === 'pregunta' && !est.respondida) agenteDice(est.q.q, est.tq); });
      cab.etiqueta('¡Te ha visto!', '#ff5fa2', pos, 0.24);
    }

    // ---------- los gestos ----------
    const manos = () => [xr.manos.derecha, xr.manos.izquierda].filter(m => m.activa);
    const ojosMundo = () => xr.cabeza.clone().add(xr.adelante.clone().multiplyScalar(0.05));
    const gafas = { mano: null };
    function gestos(dt) {
      // gafas: cogerlas del salpicadero y llevarlas a los ojos
      if (!gafas.mano && est.gafasPuestas <= 0) {
        cab.gafas.material.transparent = false; cab.gafas.material.opacity = 1;
        for (const m of manos()) if ((m.empiezaPinza || m.empiezaAgarre) && m.pos.distanceTo(cab.gafas.getWorldPosition(V())) < 0.09) { gafas.mano = m; m.vibrar(0.5, 40); break; }
      }
      if (gafas.mano) {
        const m = gafas.mano;
        if (!m.activa || !(m.pinza || m.agarre)) { gafas.mano = null; cab.gafas.position.copy(cab.GAFAS_SITIO); cab.gafas.rotation.set(-1.1, 0, 0); }
        else {
          cab.gafas.position.copy(cab.aLocal(m.pos)); cab.gafas.lookAt(xr.cabeza);
          if (m.pos.distanceTo(ojosMundo()) < 0.16) { gafas.mano = null; est.gafasPuestas = 2.3; m.vibrar(0.6, 50); sonido('fup', { volumen: 0.4 }); const a = est.activos.find(x => x.tipo === 'ojos'); if (a) tapa(a); }
        }
      }
      if (est.gafasPuestas > 0) {
        est.gafasPuestas -= dt;
        // puestas: un poco por delante y por debajo de los ojos, translúcidas (a 5 cm no se puede enfocar)
        cab.gafas.material.transparent = true; cab.gafas.material.opacity = 0.45;
        cab.gafas.position.copy(cab.aLocal(ojosMundo().add(xr.adelante.clone().multiplyScalar(0.09)).add(V().set(0, -0.035, 0))));
        cab.gafas.quaternion.copy(cab.raiz.quaternion.clone().invert().multiply(xr.cabezaQ));
        if (est.gafasPuestas <= 0) { cab.gafas.position.copy(cab.GAFAS_SITIO); cab.gafas.rotation.set(-1.1, 0, 0); }
      }
      // la bolsa de Cotine: en su mano hasta que se la quitas; a la guantera
      const cot = figuras.cotine;
      if (bolsaM.visible && cot) {
        if (bolsaE.mano) {
          const m = bolsaE.mano;
          bolsaM.position.copy(cab.aLocal(m.pos)); bolsaM.lookAt(xr.cabeza);
          if (cab.aMundo(cab.guantera).distanceTo(m.pos) < 0.13) { bolsaE.mano = null; const a = est.activos.find(x => x.tipo === 'comer'); if (a) tapa(a); m.vibrar(0.7, 60); }
          else if (!m.activa || !(m.pinza || m.agarre)) bolsaE.mano = null; // se le cae: vuelve con Cotine
        } else {
          bolsaM.position.copy(cab.aLocal(cot.r.bocaMundo(V()).add(V().set(-0.06, -0.06, 0))));
          bolsaM.lookAt(xr.cabeza);
          for (const m of manos()) if ((m.empiezaPinza || m.empiezaAgarre || m.agarre || m.pinza) && m.pos.distanceTo(bolsaM.getWorldPosition(V())) < 0.1) { bolsaE.mano = m; m.vibrar(0.5, 40); sonido('papel', { volumen: 0.4 }); break; }
        }
      }
      // cada delator activo, con su gesto
      for (const a of [...est.activos]) {
        if (a.tipo === 'humo' && (cab.manivela.abierta > 0.55 || cab.manivela.abanico > 0.45)) tapa(a);
        else if (a.tipo === 'ojos') { for (const m of manos()) if (m.pos.distanceTo(ojosMundo()) < (m.esMano ? 0.17 : 0.14) &&!(est.activos.some(x => x.tipo === 'pinpin') && m.pos.distanceTo(xr.boca()) < m.pos.distanceTo(ojosMundo()))) { tapa(a); break; } }
        else if (a.tipo === 'risa') { const b = figuras.lasslow.r.bocaMundo(V()), e = (m) => m.esMano ? 0.03 : 0; for (const m of manos()) if (m.pos.distanceTo(b) < 0.14 + e(m) || m.punta.distanceTo(b) < 0.12 + e(m)) { tapa(a); break; } }
        else if (a.tipo === 'pinpin') { const b = xr.boca(); for (const m of manos()) if ((m.punta.distanceTo(b) < (m.esMano ? 0.12 : 0.1) || m.pos.distanceTo(b) < (m.esMano ? 0.14 : 0.11)) &&!(est.activos.some(x => x.tipo === 'ojos') && m.pos.distanceTo(ojosMundo()) < m.pos.distanceTo(b))) { tapa(a); break; } }
      }
      // girar la manivela sin que haga falta: el agente se huele algo
      est.malCD = Math.max(0, est.malCD - dt);
      // (solo si la cogiste sin humo y hace rato que no lo había: seguir girando tras taparlo no cuenta)
      if (cab.manivela.mano && !est.manoManivela) est.giroSinHumo = !est.activos.some(x => x.tipo === 'humo') && est.t - est.humoFin > 3;
      est.manoManivela = cab.manivela.mano;
      if (est.giroSinHumo && cab.manivela.mano && cab.manivela.abierta > 0.3 && est.malCD <= 0 && (est.fase === 'pregunta' || est.fase === 'respuesta')) {
        est.malCD = 4; subeSosp(6); est.fallos++; agenteDice(azar(AGENTE_VE.mal), 1.5, true);
      }
    }

    // ---------- el final ----------
    function final(gana) {
      if (est.acabado) return;
      est.acabado = true; est.fase = 'fin';
      for (const a of [...est.activos]) quitarAviso(a); est.activos = [];
      for (const c of cartas) c.m.visible = false; barraT.visible = false; humoVal = 0;
      let linea;
      if (gana) {
        est.puntos += 400 + Math.round((100 - est.sosp) * 4);
        sonido('platillo', { volumen: 0.5 });
        agenteDice(AGENTE.dejarles_ir[2], 3.2);
        linea = 'El agente se ha subido a la furgo. Hay que explicárselo a Palicaso.';
        cab.eusebio('feliz'); cab.ponerPie('Don Eusebio deja de ser un peluche. Se despereza. Nadie le aplaude. Él no lo necesita.', 4);
      } else {
        agenteDice(AGENTE.pillarles[0], 3, true);
        sonido('puerta', { volumen: 0.6 });
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) m.vibrar(1, 200);
        linea = 'Los bajan a todos. Al pájaro le piden los papeles otra vez. Sigue sin tenerlos.';
        cab.eusebio('susto');
      }
      pintarPanel();
      const g = gana && est.puntos >= 600;
      programar(gana ? 2.4 : 1.8, () => ctx.terminar({ puntos: est.puntos, gana: g, linea }));
    }

    // ---------- arranque ----------
    ui.quitarTarjetas?.();
    ctx.musica?.('sigilo');
    est.fase = 'intro';
    pintarPanel();
    sonido('sting', { volumen: 0.5 });
    programar(1.4, () => { sonido('puerta', { volumen: 0.35 }); est.intro = 0.001; });
    programar(2.7, () => { agenteDice(AGENTE.acercarse[0], 2.4); cab.ponerPie(azar(EUSEBIO_CONTROL), 4); });
    programar(4.2, siguientePregunta);

    // para el bot (herramientas/pruebas/bots/control.js)
    const api = {
      get fase() { return est.fase; }, get sosp() { return est.sosp; }, get puntos() { return est.puntos; }, get preg() { return est.preg; },
      get total() { return est.total; }, get tPreg() { return est.tPreg; }, comp, tellsOk,
      get activos() { return est.activos.map(a => ({ tipo: a.tipo, t: a.t })); },
      get aciertos() { return est.aciertosTell; }, get fallos() { return est.fallos; },
      cartas: () => cartas.filter(c => c.m.visible).map(c => ({ tipo: c.tipo, pos: c.m.getWorldPosition(V()) })),
      pomo: () => cab.pomo(), pomoEn: a => cab.pomoEn(a), get anguloManivela() { return cab.anguloManivela; }, get ventanilla() { return cab.manivela.abierta; },
      ojos: () => ojosMundo(), boca: () => xr.boca(), bocaDe: id => figuras[id]?.r.bocaMundo(V()),
      bolsa: () => bolsaM.visible ? bolsaM.getWorldPosition(V()) : null, guantera: () => cab.aMundo(cab.guantera),
      gafas: () => cab.gafas.getWorldPosition(V()),
    };
    if (typeof window !== 'undefined' && window.__mj) window.__mj.control = api;
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        est.t += dt;
        for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].t <= est.t) { const e = eventos.splice(i, 1)[0]; try { e.fn(); } catch (err) { console.error(err); } }
        cab.carr.v = Math.max(0, cab.carr.v - dt * 4.5);
        cab.actualizar(dt);
        const s = est.sosp / 100;
        // luces: azul y roja alternándose
        est.luzT += dt;
        const azul = Math.floor(est.luzT * 2.8) % 2 === 0;
        luzAzul.material.color.set(azul ? '#5a95ff' : '#1a2a66'); luzRoja.material.color.set(azul ? '#5a1a1a' : '#ff4a3a');
        velo.material.color.set(azul ? '#2a6bff' : '#ff3b30'); velo.material.opacity = 0.06 + 0.06 * Math.abs(Math.sin(est.luzT * 8.8));
        // el agente llega por detrás y se asoma; con la sospecha se acerca
        if (est.intro > 0 && est.intro < 1) est.intro = Math.min(1, est.intro + dt / 1.1);
        if (est.intro > 0) {
          const k = 1 - Math.pow(1 - est.intro, 3);
          agente.position.lerpVectors(AG_FUERA, AG_SITIO, k);
          if (est.intro >= 1) { const objX = est.zoomFijo ? -0.8 : -0.98 + 0.14 * s; agente.position.x += (objX - agente.position.x) * Math.min(1, 2 * dt); }
          agente.position.y = H - 0.02 + Math.sin(est.t * 1.3) * 0.006;
          agente.rotation.y = Math.atan2(-agente.position.x, -agente.position.z); // de cara a ti
        }
        // el ritmo de la pregunta
        if (est.fase === 'pregunta') {
          est.tq -= dt; est.tPreg += dt;
          barraT.scale.x = Math.max(0.01, est.tq / est.tiempoQ); barraT.material.color.set(est.tq / est.tiempoQ < 0.3 ? '#ff5a4f' : '#ffd23f');
          while (est.programa.length && est.programa[0].t <= est.tPreg && est.activos.length < maxSim) empezarTell(est.programa.shift().tipo);
          est.sosp = Math.min(100, est.sosp + 0.45 * dt);
          if (est.tq <= 0 && !est.respondida) { est.respondida = true; subeSosp(16); if (!est.acabado) cierraPregunta(azar(REACCION.tarde), 's'); }
          // tocar una tarjeta
          for (const m of manos()) for (let i = 0; i < 3; i++) {
            const c = cartas[i]; if (!c.m.visible || c.m.scale.x < 0.9) continue;
            const l = c.m.worldToLocal(m.punta.clone());
            if (Math.abs(l.x) < 0.17 && Math.abs(l.y) < 0.044 && Math.abs(l.z) < 0.05) { m.vibrar(0.6, 40); responder(i); break; }
          }
          if ((est.quipT -= dt) <= 0 && !est.activos.length) {
            est.quipT = 7 + Math.random() * 3;
            const id = azar(comp); figuras[id]?.r.decir(DICHOS[id], { dur: 1.7 });
          }
        }
        for (const c of cartas) if (c.m.visible && c.m.scale.x < 1) { c.aparece += dt; c.m.scale.setScalar(clamp(c.aparece / 0.22, 0.01, 1)); }
        // los delatores activos: cuenta atrás
        for (const a of [...est.activos]) {
          a.t -= dt; const r = Math.max(0, a.t / a.d), av = avisos[a.tipo];
          av.m.position.copy(dondeAviso(a.tipo)); av.m.lookAt(xr.cabeza);
          av.aparece = Math.min(1, av.aparece + dt / 0.2); av.m.scale.setScalar(Math.max(0.01, av.aparece));
          av.barra.scale.x = Math.max(0.01, r); av.barra.material.color.set(r < 0.35 ? '#ff3b30' : '#7ee081');
          if (a.tipo === 'humo') humoVal = Math.min(1, (1 - r) * 1.1);
          if (a.tipo === 'ojos') vineta.material.opacity = 0.25 + 0.25 * (1 - r);
          if (a.t <= 0) falla(a);
        }
        if (est.fase === 'acabando') { est.espera += dt; if (!est.activos.length || est.espera > 3) final(true); }
        gestos(dt);
        pintarHumo(dt);
        if (vineta.visible) { vineta.position.copy(xr.cabeza).add(xr.adelante.clone().multiplyScalar(0.14)); vineta.quaternion.copy(xr.cabezaQ); }
        // los acompañantes: se acercan solos cuando les toca
        for (const f of Object.values(figuras)) {
          if (f.sitio) {
            const objetivo = f.acercar ? f.cerca : f.sitio.pos;
            f.r.grupo.position.lerp(objetivo, Math.min(1, dt * 4));
          }
          f.r.actualizar(dt, xr.cabeza);
        }
        bocA.actualizar(dt, 0, xr.cabeza, anclaA);
        // el latido: se acelera con la sospecha
        if ((est.latidoT -= dt) <= 0 && !est.acabado) { est.latidoT = 1.5 - 1.0 * s; sonido('latido', { volumen: 0.12 + 0.55 * s }); }
        pintarPanel();
        fx.actualizar(dt);
      },
      // salir a mitad: arrancas y te vas (sin ganar), con los puntos que lleves
      abandonar() {
        if (est.acabado) return;
        est.acabado = true; est.fase = 'fin';
        for (const a of [...est.activos]) quitarAviso(a); est.activos = [];
        for (const c of cartas) c.m.visible = false; barraT.visible = false; humoVal = 0;
        agenteDice('¿Adónde va? ¡Eh!', 2, true); sonido('bocina', { volumen: 0.4 });
        ctx.terminar({ puntos: est.puntos, gana: false, linea: 'Arrancas sin despedirte. Eso también se apunta.' });
      },
      destruir() {
        est.destruido = true; eventos.length = 0;
        fx.destruir();
        ui.quitarTarjetas?.();
        for (const f of Object.values(figuras)) { f.r.callar(); f.r.grupo.parent?.remove(f.r.grupo); }
        for (const t of propias) t.dispose();
        bocA.tex.dispose(); bocA.malla.geometry.dispose(); bocA.malla.material.dispose();
        vineta.geometry.dispose(); vineta.material.dispose();
        humo.material.dispose(); humo.dispose?.();
        cab.destruir();
        if (typeof window !== 'undefined' && window.__mj?.control === api) window.__mj.control = null;
      },
    };
  },
};
