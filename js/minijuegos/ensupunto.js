// En su punto (la Pompa, caps. 3 y 14) en VR nativo, a escala de tu SALA: la exhibición de la realidad mixta.
//
// La Pompa llega POR ENCIMA de su punto, hinchada y temblando, y flota pegada a TU techo (plano horizontal alto de
// las gafas o la etiqueta 'ceiling'; si no hay, a 2,3 m; y nunca más alta de lo que llegas con la mano).
// Su tamaño se ve: dos aros verdes marcan su punto (el de fuera, entero; el de dentro, a trazos). Hay que llevarla
// ahí y mantenerla:
//   · PELLIZCAR SU VÁLVULA (el nudito de abajo; pellizco/gatillo o puño/agarre con la mano cerca) le deja escapar
//     aire con un hilo de humo. Al soltar, el tamaño se queda quieto.
//   · EMPUJARLA con la mano la aparta de las rachas y de los alfileres de tus paredes.
// Lo que la sube sola, como en el 2D (base/js/escenas/ensupunto.js): sube un pelín por sí misma, las risas de Lasslow
// (un «JA» sale de él, en tu suelo, y le da un empujón), las rachas de la gente (humo que entra por un lado de tu
// habitación y la arrastra; con aviso) y las rondas de Palicaso (bocanadas que flotan hacia ella; se pueden deshacer
// de un manotazo). Tocar los alfileres o pasarse = ¡plop!; quedarse sin aire = pffff.
//
// Rondas cortas para jugar con los brazos arriba sin cansar: el tiempo en su punto del 2D se parte en tres rondas con
// un respiro entre ellas (la Pompa se queda quieta y bajas los brazos). Escalada: cada ronda sube un escalón de la
// tabla del 2D (con nivel 1: risas → + gente y alfileres → + Palicaso). Puntos como el 2D (15/s en su punto, la
// racha multiplica hasta x3 y no se pierde en el respiro; +300 si casi no se sale) y umbrales de MISIONES.EnSuPunto.
// Si sale bien, Palicaso le ofrece una ronda: «Yo no, que exploto».
import * as THREE from 'three';
import { Bocadillo } from '../bocadillo.js';

// la misma tabla que el 2D (ESP_NIVELES)
const NIVELES = {
  1: { centro: 0.5, mitad: 0.13, deriva: 0.012, objetivo: 40, risa: [3.8, 5.6], dRisa: 0.045, gente: false, cactus: false, ronda: false },
  2: { centro: 0.5, mitad: 0.095, deriva: 0.018, objetivo: 45, risa: [3.4, 5.0], dRisa: 0.055, gente: true, cactus: true, ronda: false, fuerza: 190, dura: 1.3, cada: [6.5, 9] },
  3: { centro: 0.46, mitad: 0.07, deriva: 0.024, objetivo: 50, risa: [3.0, 4.4], dRisa: 0.065, gente: true, cactus: true, ronda: true, fuerza: 240, dura: 1.4, cada: [5.5, 7.5], doble: 0.4 },
};
const FRASES = {
  empieza: '…Un poco menos. No tanto. Un poquito menos que ese poquito.',
  entra: 'Ahí. …No, ahí era antes.',
  risa: 'Siento un cosquilleo. Creo que es una risa. De otro.',
  tiembla: 'Si me ves temblar, no es la música.',
  brisa: 'Esa brisa ya me la habías prometido hace un rato.',
  alfileres: 'Alfileres en la pared. Lo digo ya, que luego se me pasa.',
  punto: 'Mi punto. Qué casa tan pequeña y tan mía.',
  salvada: 'Plop… no. Todavía no. Gracias.',
  respiro: 'Quieta. Estoy quieta. Baja los brazos, que yo aguanto.',
};
const GRITOS = ['¡Ronda para todos!', '¡Esta la invito yo!', '¡Escucha, escucha: ronda!'];
const RONDAS = 3, RESPIRO = 3.6;
const TECHO_POR_DEFECTO = 2.3, ALCANCE_SOBRE_CABEZA = 1.0;   // su coronilla nunca más alta que esto sobre tu cabeza
const ALTO_FIG = 0.85;                                         // alto del recortable de la Pompa (humo) a escala 1
const radioDe = s => 0.12 + 0.2 * s;                          // radio en metros según su tamaño 0-1
const TINTA = '#140c1c', VERDE = '#7ee081';
const clamp = THREE.MathUtils.clamp;
const azar = (a, b) => a + Math.random() * (b - a);

export default {
  clave: 'EnSuPunto', titulo: 'En su punto', escala: 'sala', umbrales: [650, 1100, 1550],

  async crear(ctx) {
    const { xr, humo, ui, sonido } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-ensupunto';
    const nivel = Math.max(1, ctx.nivel ?? 1);
    const extra = Math.max(0, nivel - 3);
    const tabla = n => {
      const b = NIVELES[Math.min(3, n)];
      return { ...b, deriva: b.deriva + extra * 0.002, mitad: Math.max(0.05, b.mitad - extra * 0.004) };
    };
    const base = tabla(nivel);
    const objetivo = base.objetivo + extra * 2;
    const tramo = objetivo / RONDAS;

    // ---------- estado de la partida (todo se reinicia aquí: «Otra vez» llama a crear) ----------
    const E = {
      fase: 'intro', ronda: 1, P: tabla(nivel), c: base.centro, w: base.mitad, s: Math.min(0.92, base.centro + base.mitad + 0.2),
      cola: 0, aireV: 0, tBanda: 0, tRonda: 0, racha: 0, puntos: 0, fuera: 0, estuvo: false, dentro: false, dentroAntes: false,
      peligro: 0, limiteVisto: false, motivo: null, gana: null, pinchos: 0, empujones: 0, bocanadasDeshechas: 0, risas: 0, rachas: 0,
    };
    let reloj = 0, acabado = false, destruido = false;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });
    let tRisa = 3, tGust = 4, tRonda = 3, soploFinal = false, tLatido = 0, tAireFx = 0, tDeshinchar = 0, tTecho = 0, pulso = 0, vPulso = 0;
    let gust = null, gustCola = null;
    const dichas = {};
    let vozLibre = 0;

    // ---------- dónde: delante de ti y arriba, contra tu techo ----------
    const origen = xr.cabeza.clone();
    const fwd = xr.adelante.clone().setY(0); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    const der = V(-fwd.z, 0, fwd.x);
    const suelo = origen.clone().setY(0);
    const casa = suelo.clone().addScaledVector(fwd, 0.5);          // en planta, sobre la que flota
    function buscarTecho() {
      let mejor = null;
      for (const p of xr.planos || []) {
        if (p.orientacion !== 'horizontal') continue;
        const y = p.centro.y;
        const etiquetado = p.etiqueta === 'ceiling';
        if (!etiquetado && !(y > xr.cabeza.y + 0.35 && y < 4.5)) continue;
        const rango = etiquetado ? 0 : 1;
        if (!mejor || rango < mejor.rango || (rango === mejor.rango && y < mejor.y)) mejor = { y, rango };
      }
      return mejor?.y ?? null;
    }
    const techoReal = buscarTecho();
    let techoY = techoReal ?? TECHO_POR_DEFECTO;
    const topeDe = t => Math.min(t - 0.02, origen.y + ALCANCE_SOBRE_CABEZA);
    let tope = topeDe(techoY);

    // ---------- materiales ----------
    const basic = o => new THREE.MeshBasicMaterial(o);
    const texturas = [];
    const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texturas.push(t); return { c, g: c.getContext('2d'), t }; };
    const matTinta = basic({ color: TINTA, side: THREE.BackSide });

    // ---------- la Pompa: el recortable, de cara a ti siempre (también mirando hacia arriba) ----------
    const [pompa, lasslow, palicaso, puff] = await Promise.all([
      ctx.Recortable.crear('la-pompa', 'humo', { giroMax: 0 }),
      ctx.Recortable.crear('lasslow', 'humo').catch(e => { console.warn('ensupunto: sin Lasslow', e); return null; }),
      ctx.Recortable.crear('palicaso', 'humo').catch(e => { console.warn('ensupunto: sin Palicaso', e); return null; }),
      ctx.img('fx-humo-puff.png').catch(() => null),
    ]);
    if (destruido) return { grupo, actualizar() { }, destruir() { } };
    pompa.enAsiento = true; pompa.sombra.visible = false;           // flota: sin sombra en el suelo
    const porta = new THREE.Group(); porta.name = 'pompa'; grupo.add(porta);   // centro de la burbuja; mira a tu cabeza
    porta.add(pompa.grupo); pompa.grupo.position.y = -ALTO_FIG / 2;
    // la válvula: el nudito de abajo (se ve, se pellizca)
    const valvula = new THREE.Group(); porta.add(valvula); valvula.position.set(0, -ALTO_FIG / 2 - 0.035, 0.03);
    {
      const nudo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), basic({ color: '#d9eef7' })); nudo.scale.set(1, 0.8, 1);
      const nudoB = new THREE.Mesh(nudo.geometry, matTinta); nudoB.scale.setScalar(1.22); nudo.add(nudoB);
      const boquilla = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.018, 0.06, 14), basic({ color: '#bcdbe8' })); boquilla.position.y = 0.04;
      const boqB = new THREE.Mesh(boquilla.geometry, matTinta); boqB.scale.set(1.25, 1.05, 1.25); boquilla.add(boqB);
      valvula.add(boquilla, nudo);
    }
    const brilloValvula = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 6, 28), basic({ color: '#ffe066', transparent: true, opacity: 0 }));
    valvula.add(brilloValvula);
    const posValvula = (o = V()) => valvula.getWorldPosition(o);

    // los dos aros de su punto (no se escalan con ella): fuera entero, dentro a trazos
    const aros = new THREE.Group(); aros.name = 'aros'; grupo.add(aros);
    const matAro = basic({ color: VERDE, transparent: true, opacity: 0.85, depthWrite: false });
    const aroFuera = new THREE.Group(); aros.add(aroFuera);
    aroFuera.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 72), matAro));
    const aroFueraB = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 72), basic({ color: TINTA, transparent: true, opacity: 0.55, depthWrite: false })); aroFueraB.position.z = -0.01; aroFuera.add(aroFueraB);
    const discoPunto = new THREE.Mesh(new THREE.CircleGeometry(1, 48), basic({ color: VERDE, transparent: true, opacity: 0.08, depthWrite: false })); discoPunto.position.z = -0.08; aroFuera.add(discoPunto);
    const aroDentro = new THREE.Group(); aros.add(aroDentro);
    const geoTrazo = new THREE.TorusGeometry(1, 0.03, 5, 6, Math.PI * 2 / 24 * 0.55);
    for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(geoTrazo, matAro); m.rotation.z = i / 24 * Math.PI * 2; aroDentro.add(m); }

    // su propio bocadillo, a un lado y por debajo (el del recortable saldría por el techo)
    const bocadilloP = new Bocadillo();
    const habla = new THREE.Group(); grupo.add(habla); habla.add(bocadilloP.malla);
    function decir(id, texto, repetible = false) {
      if (E.fase !== 'juego' && E.fase !== 'respiro' && E.fase !== 'intro' && E.fase !== 'fin') return false;
      if (reloj < vozLibre) return false;
      if (!repetible && dichas[id]) return false;
      dichas[id] = true;
      const d = Math.min(5.5, 1.6 + texto.length * 0.055);
      bocadilloP.mostrar(texto, d);
      vozLibre = reloj + d + 1.8;
      return true;
    }

    // ---------- Lasslow (y Palicaso) en tu suelo ----------
    const enSuelo = (r, lado, d) => { r.grupo.position.copy(suelo).addScaledVector(fwd, d).addScaledVector(der, lado); grupo.add(r.grupo); };
    if (lasslow) { enSuelo(lasslow, -0.6, 1.35); lasslow.pose('base', { rebote: 0 }); }
    if (palicaso) { enSuelo(palicaso, 0.65, 1.45); palicaso.grupo.visible = false; }

    // ---------- los alfileres de tus paredes ----------
    // a cada lado: si hay una pared real cerca, la tira va pegada a ella; si no, a ~1 m (como las tiras del 2D)
    const yAlfiler = () => tope - 0.32;
    function paredA(dir) {
      let mejor = null;
      const o = casa.clone().setY(yAlfiler());
      for (const p of xr.planos || []) {
        if (p.orientacion !== 'vertical') continue;
        const n = p.normal.clone().setY(0); if (n.lengthSq() < 0.25) continue; n.normalize();
        const den = dir.dot(n); if (Math.abs(den) < 0.35) continue;
        const t = p.centro.clone().sub(o).dot(n) / den;
        if (t < 0.55 || t > 1.5) continue;
        const l = o.clone().addScaledVector(dir, t).applyMatrix4(p.matriz.clone().invert());
        if (Math.abs(l.x) > p.ancho / 2 + 0.3 || Math.abs(l.z) > p.largo / 2 + 0.3) continue;
        if (!mejor || t < mejor) mejor = t;
      }
      return mejor;
    }
    const LARGO_PIN = 0.1;
    const geoPin = new THREE.ConeGeometry(0.014, LARGO_PIN, 8); geoPin.rotateZ(-Math.PI / 2); geoPin.translate(LARGO_PIN / 2, 0, 0); // apunta a +x
    const matPin = basic({ color: '#e9e4f2' }), matCabeza = basic({ color: '#ff5a4f' });
    const geoCabeza = new THREE.SphereGeometry(0.02, 8, 6);
    const tiras = [-1, 1].map(lado => {
      const g = new THREE.Group(); g.visible = false; grupo.add(g);
      const tabla_ = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.8), basic({ color: '#3a2a4c' }));
      const tablaB = new THREE.Mesh(tabla_.geometry, matTinta); tablaB.scale.set(1.3, 1.03, 1.02); tabla_.add(tablaB);
      g.add(tabla_);
      for (let y = -0.24; y <= 0.25; y += 0.12) for (let z = -0.34; z <= 0.35; z += 0.12) {
        const pin = new THREE.Mesh(geoPin, matPin); pin.position.set(0.02, y + ((Math.round(z * 10) % 2) ? 0.03 : 0), z); g.add(pin);
        const cab = new THREE.Mesh(geoCabeza, matCabeza); cab.position.set(0.02, pin.position.y, z); g.add(cab);
      }
      return { g, lado, D: 0.85, real: false };
    });
    function colocarTiras() {
      for (const t of tiras) {
        const dir = der.clone().multiplyScalar(t.lado);
        const real = paredA(dir);
        t.real = real != null; t.D = real != null ? real - 0.03 : 0.85;
        t.g.position.copy(casa).addScaledVector(dir, t.D).setY(yAlfiler());
        t.g.lookAt(t.g.position.clone().sub(dir));      // +z hacia dentro…
        t.g.rotateY(-Math.PI / 2);                       // …y los alfileres (+x) también
      }
    }
    colocarTiras();
    const puntaAlfiler = lado => tiras.find(t => t.lado === lado).D - 0.02 - LARGO_PIN;

    // ---------- marcador pequeño, a tu izquierda de la Pompa ----------
    const marc = lienzo(512, 224);
    const marcador = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.13), basic({ map: marc.t, transparent: true, depthWrite: false }));
    grupo.add(marcador);
    let marcadorAntes = '';
    function pintarMarcador() {
      const clave = `${E.ronda}|${Math.floor(E.tRonda * 4)}|${Math.round(E.puntos)}|${E.racha >= 5 ? Math.floor(E.racha / 5) : 0}|${E.fase}`;
      if (clave === marcadorAntes) return; marcadorAntes = clave;
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.86)'; g.beginPath(); g.roundRect(6, 6, 500, 212, 28); g.fill();
      g.strokeStyle = VERDE; g.lineWidth = 6; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '42px Caprasimo, serif'; g.fillStyle = '#fff3c4';
      g.fillText(E.fase === 'respiro' ? 'Respira…' : `Ronda ${E.ronda}/${RONDAS}`, 28, 50);
      g.textAlign = 'right'; g.fillStyle = '#ffe066'; g.fillText(`${Math.round(E.puntos)}`, 484, 50); g.textAlign = 'left';
      // barra: tiempo en su punto de esta ronda
      const p = clamp(E.tRonda / tramo, 0, 1);
      g.fillStyle = '#3a2d4f'; g.beginPath(); g.roundRect(28, 96, 456, 34, 17); g.fill();
      if (p > 0) { g.fillStyle = VERDE; g.beginPath(); g.roundRect(28, 96, Math.max(34, 456 * p), 34, 17); g.fill(); }
      g.font = '34px Caprasimo, serif';
      const mult = 1 + Math.min(2, Math.floor(E.racha / 5) * 0.5);
      g.fillStyle = E.racha >= 5 ? VERDE : '#c9b6ff';
      g.fillText(E.racha >= 5 ? `Seguida x${mult}` : 'en su punto', 28, 176);
      t.needsUpdate = true;
    }

    // ---------- textos que saltan ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.5) {
      const { g, c, t } = lienzo(512, 160);
      let px = 78; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > 470 && px > 40) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), basic({ map: t, transparent: true, depthTest: false, depthWrite: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- la Pompa en el mundo ----------
    const M = { L: 0, F: 0, vL: 0, vF: 0 };       // desplazamiento lateral (der) y hacia delante (fwd) y sus velocidades
    const centro = V();
    let R = radioDe(E.s), bob = 0, temblor = V();
    function colocarPompa(dt) {
      R = radioDe(E.s) * (1 + pulso);
      bob += dt;
      centro.copy(casa).addScaledVector(der, M.L).addScaledVector(fwd, M.F);
      centro.y = tope - radioDe(E.s) + Math.sin(bob * 1.5) * 0.012;
      const sobre = Math.max(0, E.peligro);
      const amp = sobre > 0 ? 0.004 + sobre * sobre * 0.03 : 0;
      temblor.set(azar(-amp, amp), azar(-amp, amp) * 0.6, azar(-amp, amp));
      porta.position.copy(centro).add(temblor);
      porta.lookAt(xr.cabeza);
      const k = 2 * R / ALTO_FIG;
      let sx = k, sy = k;
      if (E.s < E.c - E.w && E.fase !== 'fin') { const arr = clamp((E.c - E.w - E.s) / Math.max(0.05, E.c - E.w), 0, 1); sy = k * (0.9 - 0.25 * arr); }
      porta.scale.set(sx, sy, k);
      if (sobre > 0) porta.rotateZ(Math.sin(reloj * 40) * (0.02 + sobre * 0.06));
      // aros
      aros.position.copy(centro); aros.lookAt(xr.cabeza);
      aroFuera.scale.setScalar(radioDe(E.c + E.w) + 0.02);
      aroDentro.scale.setScalar(radioDe(E.c - E.w));
      const pul = 0.55 + 0.45 * Math.sin(reloj * 6);
      matAro.color.set(E.dentro ? '#b9ffb0' : VERDE);
      matAro.opacity = E.dentro ? 0.7 + 0.3 * pul : 0.85;
      discoPunto.material.opacity = E.dentro ? 0.2 : 0.08;
      aros.visible = E.fase !== 'fin' || E.gana;
      // color: se pone colorada cuando está a una brisa
      const rojo = E.fase === 'fin' ? 0 : clamp((sobre - 0.45) / 0.55, 0, 1) * (0.6 + 0.4 * Math.sin(reloj * (1.4 + 7 * sobre) * Math.PI * 2));
      pompa.frente.material.color.setRGB(1, 1 - 0.55 * rojo, 1 - 0.55 * rojo);
      // bocadillo: a tu derecha de la Pompa, un poco más bajo (no tapa ni a ella ni la vista)
      const haciaMi = xr.cabeza.clone().sub(centro).setY(0).normalize();
      const tuDer = V(haciaMi.z, 0, -haciaMi.x);
      habla.position.copy(centro).addScaledVector(tuDer, -(R + 0.32)).add(V(0, -0.5, 0)).addScaledVector(haciaMi, 0.1);
      marcador.position.copy(centro).addScaledVector(tuDer, R + 0.3).add(V(0, -0.2, 0)).addScaledVector(haciaMi, 0.1);
      marcador.lookAt(xr.cabeza);
    }
    function poseSegunEstado() {
      if (E.fase === 'fin') return;
      const sobre = E.peligro;
      let p = 'base';
      if (E.s < E.c - E.w) p = 'aplastada';
      else if (E.dentro) p = E.racha > 6 ? 'meditando' : 'base';
      else if (sobre > 0.6) p = 'a-punto-de-reventar';
      else if (sobre > 0) p = 'respondiendo-tarde';
      if (tRisaPose > 0) p = 'risa-floja';
      pompa.pose(p, { rebote: 0.06 });
    }
    let tRisaPose = 0;

    // ---------- tus manos: la válvula y los empujones ----------
    let pinzador = null, tocando = new Set();
    const manos = () => [xr.manos.derecha, xr.manos.izquierda];
    function manosEnPompa(dt) {
      const pv = posValvula();
      let aire = false;
      // pellizcar la válvula: empieza cerca de ella y aguanta mientras sigas apretando sin alejarte mucho
      if (pinzador && (!pinzador.activa || !(pinzador.pinza || pinzador.agarre) || pinzador.punta.distanceTo(pv) > 0.3)) pinzador = null;
      if (!pinzador && (E.fase === 'juego')) {
        for (const m of manos()) {
          if (!m.activa) continue;
          if ((m.empiezaPinza || m.empiezaAgarre || m.pinza || m.agarre) && m.punta.distanceTo(pv) < 0.13) { pinzador = m; m.vibrar(0.4, 30); E.pinchos++; break; }
        }
      }
      if (pinzador && E.fase === 'juego') aire = true;
      // brillo de la válvula: te dice «aquí» cuando la mano se acerca
      let cerca = 0;
      for (const m of manos()) if (m.activa) cerca = Math.max(cerca, 1 - clamp((m.punta.distanceTo(pv) - 0.1) / 0.35, 0, 1));
      brilloValvula.material.opacity = aire ? 0.95 : cerca * 0.7;
      brilloValvula.scale.setScalar(aire ? 1.15 + 0.1 * Math.sin(reloj * 14) : 1);
      // empujar: la mano que no pellizca y toca la burbuja la aparta (con tolerancia: la mano tiembla)
      for (const m of manos()) {
        if (!m.activa || m === pinzador) { tocando.delete(m); continue; }
        if (m.punta.distanceTo(pv) < 0.11) { tocando.delete(m); continue; }
        if (E.fase !== 'juego' && E.fase !== 'respiro') continue;
        const d = centro.clone().sub(m.punta); const dist = d.length();
        const lim = R + 0.05;
        if (dist < lim && dist > 1e-4) {
          d.setY(0); if (d.lengthSq() < 1e-6) continue; d.normalize();
          // un muelle blando (cuanto más dentro, más empuja) y, si la mano va más rápida que ella, la arrastra
          const pen = lim - dist;
          const imp = pen * 160 * dt;
          M.vL += d.dot(der) * imp; M.vF += d.dot(fwd) * imp;
          const vMano = Math.min(1.0, m.vel.dot(d)), vYa = M.vL * d.dot(der) + M.vF * d.dot(fwd);
          if (vMano > vYa) { const k = (vMano - vYa) * Math.min(1, dt * 12); M.vL += d.dot(der) * k; M.vF += d.dot(fwd) * k; }
          if (!tocando.has(m)) { tocando.add(m); m.vibrar(0.35, 30); sonido('pop', { volumen: 0.12, tono: 1.6 }); E.empujones++; pompa.empujon(0.05); }
        } else if (dist > lim + 0.06) tocando.delete(m);
      }
      return aire;
    }

    // ---------- los empujones de fuera ----------
    // risa de Lasslow: se le nota antes de que llegue (un «JA» que sube de él a ella)
    const jas = [];
    function risaLasslow() {
      if (!lasslow) return;
      E.risas++;
      sonido('risa-lasslow', { en: lasslow.grupo, volumen: 0.45 });
      lasslow.pose('riendo'); luego(1.5, () => { if (!acabado) lasslow.pose('base'); });
      decir('risa', FRASES.risa);
      const { g, t } = lienzo(256, 128);
      g.font = '96px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 14; g.strokeStyle = TINTA; g.strokeText('JA', 128, 68); g.fillStyle = '#ffe066'; g.fillText('JA', 128, 68);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), basic({ map: t, transparent: true, depthWrite: false }));
      m.renderOrder = 30; m.position.copy(lasslow.cabezaMundo()).add(V(0, 0.1, 0)); grupo.add(m);
      jas.push({ m, t: 0, desde: m.position.clone(), espera: 0.35, dura: 0.75 });
    }
    function moverJas(dt) {
      for (let i = jas.length - 1; i >= 0; i--) {
        const j = jas[i]; j.t += dt;
        const k = clamp((j.t - j.espera) / j.dura, 0, 1), e = k * k;
        j.m.position.copy(j.desde).lerp(centro, e); j.m.position.y += Math.sin(Math.PI * k) * 0.2;
        j.m.scale.setScalar(1 + 0.5 * k); j.m.lookAt(xr.cabeza); j.m.rotateZ(Math.sin(j.t * 12) * 0.15);
        if (k >= 1) {
          grupo.remove(j.m); j.m.geometry.dispose(); j.m.material.dispose(); jas.splice(i, 1);
          if (E.fase === 'juego') { E.cola += E.P.dRisa * azar(0.85, 1.2); sacude(); tRisaPose = 0.9; }
        }
      }
    }
    function sacude() { sonido('pop', { volumen: 0.25 }); vPulso += 0.9; pompa.empujon(0.12); }

    // rachas de la gente: humo que entra por un lado de tu habitación y la arrastra
    function lanzarRacha(dir, fuerza, dura, gorda = false) {
      E.rachas++;
      gust = { dir, fuerza, dura, aviso: 0.9, activa: false, t: 0, gorda, tAviso: 0 };
      decir('brisa', FRASES.brisa);
      sonido('fiu', { volumen: 0.35 });
    }
    function rachaViva(dt) {
      const g = gust;
      const desde = casa.clone().addScaledVector(der, -g.dir * 1.6).setY(centro.y);
      if (g.aviso > 0) {
        g.aviso -= dt; g.tAviso -= dt;
        // el aviso: el humo se arremolina en ese lado
        if (g.tAviso <= 0) {
          g.tAviso = 0.05;
          const a = Math.random() * Math.PI * 2;
          const p = desde.clone().addScaledVector(fwd, Math.cos(a) * 0.3).add(V(0, Math.sin(a) * 0.25, 0));
          humo.soltar({ pos: p, vel: der.clone().multiplyScalar(g.dir * 0.25), tam: 0.06, vida: 0.9, crece: 0.08, sube: 0, frena: 0.5, brillo: 0.45, alfa: 0.7, tamMax: 0.18 });
        }
        if (g.aviso <= 0) { g.activa = true; sonido('whoosh', { volumen: g.gorda ? 0.6 : 0.4 }); }
        return;
      }
      g.t += dt;
      for (let i = 0; i < 2; i++) {
        const p = desde.clone().addScaledVector(fwd, azar(-0.6, 0.6)).add(V(0, azar(-0.35, 0.2), 0));
        for (let k = 0; k < 3; k++) humo.soltar({ pos: p.clone().addScaledVector(der, -g.dir * k * 0.05), vel: der.clone().multiplyScalar(g.dir * azar(1.6, 2.2)), tam: 0.05 - k * 0.01, vida: 1.5, crece: 0.03, sube: 0, frena: 0.1, brillo: 0.45, alfa: 0.75 - k * 0.15, tamMax: 0.1 });
      }
      if (g.t >= g.dura) gust = null;
    }

    // rondas de Palicaso: bocanadas que flotan hacia ella (se deshacen de un manotazo)
    const bocanadas = [];
    const matBocanada = puff ? new THREE.SpriteMaterial({ map: puff, color: '#e6e2ee', transparent: true, depthWrite: false }) : new THREE.SpriteMaterial({ color: '#e6e2ee', transparent: true, depthWrite: false });
    function rondaPalicaso() {
      if (!palicaso) return;
      palicaso.pose('riendo'); luego(1.8, () => { if (!acabado) palicaso.pose('base'); });
      palicaso.decir(GRITOS[Math.floor(Math.random() * GRITOS.length)], { dur: 1.8 });
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) luego(0.7 + i * 0.8, () => { if (E.fase === 'juego') bocanada(); });
    }
    function bocanada() {
      const g = new THREE.Group();
      for (const [x, y, r] of [[0, 0, 0.13], [-0.09, 0.03, 0.1], [0.09, 0.04, 0.1], [0.02, 0.08, 0.09]]) {
        const s = new THREE.Sprite(matBocanada); s.position.set(x, y, 0); s.scale.setScalar(r * 2); g.add(s);
      }
      g.position.copy(palicaso.bocaMundo()); grupo.add(g);
      sonido('fiuuu', { en: palicaso.grupo, volumen: 0.3 });
      bocanadas.push({ g, vel: V(0, 0.35, 0), vida: 7 });
    }
    function deshacer(b, conMano) {
      for (let i = 0; i < 8; i++) humo.soltar({ pos: b.g.position, vel: V().randomDirection().multiplyScalar(0.5), tam: 0.05, vida: 0.8, crece: 0.15, sube: 0.05, frena: 2, brillo: 0.6, alfa: 0.7 });
      grupo.remove(b.g);
      if (conMano) { E.bocanadasDeshechas++; sonido('pop', { volumen: 0.35, tono: 1.3 }); saltaTexto('¡fuera!', '#fff3c4', b.g.position.clone().add(V(0, 0.15, 0)), 0.3); }
    }
    function moverBocanadas(dt) {
      for (let i = bocanadas.length - 1; i >= 0; i--) {
        const b = bocanadas[i]; b.vida -= dt;
        const d = centro.clone().sub(b.g.position); const dist = d.length() || 1;
        b.vel.lerp(d.divideScalar(dist).multiplyScalar(0.42), Math.min(1, 0.7 * dt));
        b.g.position.addScaledVector(b.vel, dt);
        b.g.scale.setScalar(1 + Math.sin(reloj * 6 + b.vida) * 0.06);
        let mano = null;
        for (const m of manos()) if (m.activa && m !== pinzador && m.punta.distanceTo(b.g.position) < 0.17) mano = m;
        if (mano) { mano.vibrar(0.5, 40); deshacer(b, true); bocanadas.splice(i, 1); continue; }
        if (dist < R * 0.85 + 0.1) {
          if (E.fase === 'juego') { E.cola += E.aireV > 0.5 ? 0.04 : 0.085; saltaTexto('¡pof!', '#fff3c4', b.g.position.clone(), 0.3); sacude(); }
          deshacer(b, false); bocanadas.splice(i, 1); continue;
        }
        if (b.vida <= 0 || E.fase === 'respiro') { deshacer(b, false); bocanadas.splice(i, 1); }
      }
    }

    function eventos(dt) {
      const P = E.P;
      tRisa -= dt;
      if (tRisa <= 0) { tRisa = azar(P.risa[0], P.risa[1]); risaLasslow(); }
      if (P.gente) {
        tGust -= dt;
        if (tGust <= 0 && !gust) {
          tGust = azar(P.cada[0], P.cada[1]);
          const dir = Math.random() < 0.5 ? 1 : -1;
          lanzarRacha(dir, P.fuerza, P.dura);
          if (P.doble && Math.random() < P.doble) gustCola = { en: P.dura + 1.0, dir: -dir };
        }
      }
      if (gust) rachaViva(dt);
      if (gustCola && !gust) {
        gustCola.en -= dt;
        if (gustCola.en <= 0) { const d = gustCola.dir; gustCola = null; lanzarRacha(d, P.fuerza * 1.05, P.dura * 0.9); }
      }
      if (P.ronda) {
        tRonda -= dt;
        if (tRonda <= 0) { tRonda = azar(8, 10.5); rondaPalicaso(); }
        // el soplo gordo del final
        if (!soploFinal && E.tBanda >= objetivo - 8) {
          soploFinal = true;
          lanzarRacha(Math.random() < 0.5 ? 1 : -1, P.fuerza * 1.25, 1.5, true);
          luego(0.9, () => { if (E.fase === 'juego') E.cola += 0.09; });
        }
      }
    }

    // ---------- rondas y respiros (la escalada) ----------
    function aplicarRonda() {
      E.P = tabla(nivel + E.ronda - 1);
      for (const t of tiras) t.g.visible = E.P.cactus;
      if (E.P.cactus && !dichas.alfileres) luego(1.2, () => decir('alfileres', FRASES.alfileres));
      if (E.P.ronda && palicaso && !palicaso.grupo.visible) { palicaso.grupo.visible = true; palicaso.pose('sirviendo', { rebote: 0.3 }); sonido('boing', { en: palicaso.grupo, volumen: 0.4 }); }
      tGust = Math.min(tGust, 3.5); tRonda = 3;
    }
    function respiro() {
      E.fase = 'respiro'; gust = null; gustCola = null;
      pinzador = null; ui.instruccion('Baja los brazos: respira');
      decir('respiro', FRASES.respiro);
      sonido('campanita', { volumen: 0.4, tono: 1.2 });
      saltaTexto(`Ronda ${E.ronda} hecha`, VERDE, centro.clone().add(V(0, -R - 0.35, 0)).addScaledVector(fwd, -0.15), 0.5);
      luego(RESPIRO, () => {
        if (acabado) return;
        E.ronda++; E.tRonda = 0; aplicarRonda();
        ui.instruccion(null);
        saltaTexto(`Ronda ${E.ronda}`, '#ffe066', centro.clone().add(V(0, -R - 0.35, 0)).addScaledVector(fwd, -0.15), 0.5);
        sonido('boing', { volumen: 0.35, tono: 1.2 });
        E.fase = 'juego';
      });
    }

    // ---------- se ve y se oye ----------
    function chorritoAire(dt) {
      tAireFx -= dt; if (tAireFx > 0) return;
      tAireFx = 0.05;
      const pv = posValvula();
      const abajo = pv.clone().sub(centro).normalize();
      humo.hilo(pv);
      humo.soltar({ pos: pv, vel: abajo.multiplyScalar(0.35).add(V(azar(-0.08, 0.08), 0, azar(-0.08, 0.08))), tam: 0.03, vida: 1.2, crece: 0.07, sube: 0.08, frena: 1.5, brillo: 0.4, alfa: 0.8, tamMax: 0.11 });
      tDeshinchar -= 0.05;
      if (tDeshinchar <= 0) { tDeshinchar = 1.2; sonido('deshinchar', { en: porta, volumen: 0.35 }); }
    }
    function avisos(dt) {
      const sobre = E.s - (E.c + E.w);
      E.peligro = clamp(sobre / (1 - (E.c + E.w)), 0, 1);
      if (E.peligro > 0.35) decir('tiembla', FRASES.tiembla);
      if (E.peligro > 0.8) E.limiteVisto = true;
      else if (E.limiteVisto && E.peligro < 0.5) { E.limiteVisto = false; decir('salvada', FRASES.salvada, true); }
      if (E.peligro > 0.12) {
        tLatido -= dt;
        if (tLatido <= 0) { tLatido = 0.75 - 0.5 * E.peligro; sonido('latido', { volumen: 0.12 + 0.4 * E.peligro }); for (const m of manos()) if (m === pinzador) m.vibrar(0.15 + 0.4 * E.peligro, 25); }
      }
    }
    function puntuar(dt) {
      const dentro = E.s >= E.c - E.w && E.s <= E.c + E.w;
      if (dentro) {
        E.tBanda += dt; E.tRonda += dt; E.racha += dt;
        const mult = 1 + Math.min(2, Math.floor(E.racha / 5) * 0.5);
        E.puntos += 15 * mult * dt;
        if (!E.dentroAntes) { E.estuvo = true; sonido('campanita', { volumen: 0.25 }); decir('entra', FRASES.entra); }
        if (E.racha > 6) decir('punto', FRASES.punto);
        if ([5, 10, 15].some(x => E.racha - dt < x && E.racha >= x)) saltaTexto(`Seguida x${mult}`, VERDE, centro.clone().add(V(0, -R - 0.25, 0)).addScaledVector(fwd, 0.05), 0.3);
      } else {
        if (E.dentroAntes && E.racha > 1.5) saltaTexto('Se ha ido…', '#ff9ac8', centro.clone().add(V(0, -R - 0.25, 0)).addScaledVector(fwd, 0.05), 0.3);
        E.racha = 0;
        if (E.estuvo) E.fuera += dt;
      }
      E.dentroAntes = dentro; E.dentro = dentro;
    }
    function moverPompa(dt) {
      // empujones de tu mano, el muelle que la devuelve despacio a su sitio y la racha
      M.vL += (-0.9 * M.L - 2.2 * M.vL) * dt;
      M.vF += (-1.4 * M.F - 2.6 * M.vF) * dt;
      const g = gust && gust.activa ? gust.dir * gust.fuerza * 0.0017 : 0;
      M.L += (M.vL + g) * dt; M.F += M.vF * dt;
      if (Math.abs(M.F) > 0.35) { M.F = Math.sign(M.F) * 0.35; M.vF = 0; }
      // sin alfileres, una pared blanda (como el 2D)
      if (!E.P.cactus) for (const lado of [-1, 1]) {
        const lim = 0.85 - R * 0.8;
        if (M.L * lado > lim) { M.L = lado * lim; if (M.vL * lado > 0) M.vL = 0; }
      }
    }
    function tocaAlfiler() {
      if (!E.P.cactus) return false;
      for (const lado of [-1, 1]) if (M.L * lado + R * 0.8 > puntaAlfiler(lado)) return true;
      return false;
    }
    function cercaDeAlfiler() {
      if (!E.P.cactus) return false;
      for (const lado of [-1, 1]) if (M.L * lado + R * 0.8 > puntaAlfiler(lado) - 0.18) return true;
      return false;
    }

    // ---------- finales ----------
    function ganar() {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; E.gana = true; E.motivo = 'plop-no'; pinzador = null;
      ui.instruccion(null);
      sonido('platillo', { volumen: 0.5 });
      saltaTexto('¡En su punto!', VERDE, centro.clone().add(V(0, -R - 0.3, 0)).addScaledVector(fwd, -0.2), 0.7);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; humo.soltar({ pos: centro, vel: V(Math.cos(a) * 0.5, Math.sin(a) * 0.3, 0).applyQuaternion(porta.quaternion), tam: 0.04, vida: 1.2, crece: 0.08, sube: 0.05, frena: 2, brillo: 0.9, alfa: 0.7 }); }
      pompa.pose('meditando', { rebote: 0.2 });
      lasslow?.pose('aguantando-lagrimas');
      // el momento: le ofrecen una ronda y, por una vez, dice que no a tiempo
      luego(1.3, () => {
        if (palicaso) { palicaso.grupo.visible = true; palicaso.pose('sirviendo'); palicaso.decir('¿Una rondita para la Pompa?', { dur: 2 }); }
      });
      luego(3.0, () => {
        pompa.pose('fumando-no-gracias', { rebote: 0.25 });
        vozLibre = 0; decir('yono', 'Yo no, que exploto.', true);
        sonido('oooh', { volumen: 0.35 });
      });
      luego(6.2, () => cerrar(true, 'plop-no'));
    }
    function plop(motivo) {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; E.gana = false; E.motivo = motivo; pinzador = null;
      ui.instruccion(null); bocadilloP.ocultar();
      sonido('plop', { en: porta, volumen: 0.8 });
      pompa.pose('reventando', { rebote: 0.3 });
      for (const m of manos()) m.vibrar(0.9, 120);
      for (let i = 0; i < 26; i++) humo.soltar({ pos: centro.clone().add(V().randomDirection().multiplyScalar(R * 0.6)), vel: V().randomDirection().multiplyScalar(azar(0.4, 1.1)), tam: 0.04, vida: azar(0.9, 1.6), crece: 0.12, sube: 0.02, frena: 2.2, brillo: 0.9, alfa: 0.8 });
      saltaTexto(motivo === 'alfiler' ? '¡Alfiler! PLOP' : '¡PLOP!', '#ff9ac8', centro.clone().add(V(0, -R - 0.3, 0)).addScaledVector(fwd, -0.2), 0.7);
      luego(0.6, () => { porta.visible = false; aros.visible = false; });
      lasslow?.pose('rodando-de-risa');
      luego(0.4, () => { if (lasslow) sonido('risa-lasslow', { en: lasslow.grupo, volumen: 0.5 }); });
      luego(1.6, () => cerrar(false, motivo));
    }
    function pffff() {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; E.gana = false; E.motivo = 'pffff'; pinzador = null;
      ui.instruccion(null);
      sonido('suspiro', { volumen: 0.6 });
      pompa.pose('aplastada', { rebote: 0.2 });
      saltaTexto('pffff…', '#8fd3ff', centro.clone().add(V(0, -0.3, 0)).addScaledVector(fwd, -0.2), 0.6);
      luego(1.6, () => cerrar(false, 'pffff'));
    }
    function cerrar(gana, motivo) {
      const textos = {
        'plop-no': 'La Pompa se ha quedado en su punto. Te da las gracias. …Ahora. Un rato después.',
        plop: 'Se ha pasado de su punto. Lasslow se ríe. Claro que se ríe.',
        alfiler: 'Los alfileres de la pared tenían razón. Lo había avisado, eso sí. Después.',
        pffff: 'Se ha quedado sin aire. Dice que, bien mirado, tampoco se estaba mal.',
      };
      if (gana && E.fuera <= 3) E.puntos += 300;
      ctx.terminar({ puntos: Math.round(E.puntos), gana, linea: textos[motivo] });
    }

    // ---------- arranque ----------
    aplicarRonda();
    colocarPompa(0);
    pompa.pose('a-punto-de-reventar', { rebote: 0 });
    ctx.musica?.('minijuego');
    sonido('fiuuu', { volumen: 0.35, tono: 0.8 });
    luego(1.0, () => decir('empieza', FRASES.empieza));
    luego(2.4, () => { E.fase = 'juego'; ui.instruccion('Pellizca su válvula para soltarle aire'); });

    const api = {
      E, M, get fase() { return E.fase; }, get radio() { return R; }, get tope() { return tope; }, techoReal,
      centro: () => centro.clone(), valvula: () => posValvula(), der: der.clone(), fwd: fwd.clone(), casa: casa.clone(),
      get gust() { return gust; }, get pinzando() { return !!pinzador; }, bocanadas: () => bocanadas.map(b => b.g.position.clone()),
      puntaAlfiler, get alfileres() { return !!E.P.cactus; }, tramo, objetivo,
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        // el techo real puede llegar tarde (los planos se leen cada medio segundo): se sube a él con calma
        tTecho -= dt;
        if (tTecho <= 0) { tTecho = 1; const t = buscarTecho(); if (t != null) techoY = t; }
        tope += (topeDe(techoY) - tope) * Math.min(1, dt * 1.5);
        vPulso += (-pulso * 120 - vPulso * 10) * dt; pulso += vPulso * dt * 0.1;
        tRisaPose = Math.max(0, tRisaPose - dt);

        const aire = manosEnPompa(dt);
        if (E.fase === 'juego') {
          E.aireV = clamp(E.aireV + (aire ? 1 : -1) * dt * 9, 0, 1);
          if (E.aireV > 0.2) chorritoAire(dt);
          const entra = Math.min(E.cola, 0.5 * dt); E.cola -= entra;
          E.s = Math.min(1, E.s - 0.2 * E.aireV * dt + E.P.deriva * dt + entra);
          moverPompa(dt);
          eventos(dt);
          puntuar(dt);
          avisos(dt);
          if (cercaDeAlfiler()) decir('alfileres', FRASES.alfileres);
          if (E.pinchos && reloj > 6 && ui._instr === 'Pellizca su válvula para soltarle aire') ui.instruccion(null);
          if (E.P.gente && E.rachas === 1 && gust && !dichas.empujaInstr) { dichas.empujaInstr = true; ui.instruccion('Empújala con la mano: apártala de la racha'); luego(5, () => { if (ui._instr?.startsWith('Empújala')) ui.instruccion(null); }); }
          if (E.s >= 1) plop('plop');
          else if (E.s <= 0.015) pffff();
          else if (tocaAlfiler()) plop('alfiler');
          else if (E.tRonda >= tramo) { if (E.ronda < RONDAS) respiro(); else ganar(); }
        } else if (E.fase === 'respiro') {
          E.aireV = 0;
          moverPompa(dt);
          // se va poniendo en el punto de la ronda que viene (los aros se mueven despacio)
          const sig = tabla(nivel + E.ronda);
          E.c += (sig.centro - E.c) * Math.min(1, dt * 1.2); E.w += (sig.mitad - E.w) * Math.min(1, dt * 1.2);
          E.dentro = E.s >= E.c - E.w && E.s <= E.c + E.w;
        } else if (E.fase === 'intro') {
          E.peligro = clamp((E.s - (E.c + E.w)) / (1 - (E.c + E.w)), 0, 1);
        }
        if (E.fase === 'juego') { E.c += (E.P.centro - E.c) * Math.min(1, dt * 1.2); E.w += (E.P.mitad - E.w) * Math.min(1, dt * 1.2); }
        moverJas(dt);
        moverBocanadas(dt);
        poseSegunEstado();
        colocarPompa(dt);
        pompa.actualizar(dt, null);
        bocadilloP.actualizar(dt, 0, xr.cabeza, habla);
        if (lasslow) lasslow.actualizar(dt, xr.cabeza);
        if (palicaso?.grupo.visible) palicaso.actualizar(dt, xr.cabeza);
        if (E.fase !== 'fin') pintarMarcador();
        marcador.visible = E.fase !== 'fin';
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.15; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (1.4 - s.t));
          if (s.t > 1.4) { grupo.remove(s.m); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      destruir() {
        destruido = true; acabado = true; tareas.length = 0;
        ui.instruccion(null);
        bocadilloP.ocultar();
        lasslow?.callar(); palicaso?.callar(); pompa.callar();
        for (const t of texturas) t.dispose();
      },
    };
  },
};
