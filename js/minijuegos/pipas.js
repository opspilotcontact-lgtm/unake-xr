// La apuesta de pipas (Perico) en VR nativo, a escala de tu habitación.
// Perico está a tu lado; en la mano izquierda llevas un cucurucho (si no hay mano izquierda, flota a mano).
// Coges una pipa con un pellizco (o el gatillo) y la LANZAS de verdad hacia la papelera de tu suelo.
// Reglas del 2D (base/js/escenas/pipas.js): diez tiradas; la papelera cambia de sitio en cada una y, desde la
// sexta (tercera con nivel 3+), se mueve; viento desde la tercera (desde la primera con nivel 3+; más con 5+);
// encadenar aciertos multiplica (x1, x1,5, x2…) y una «limpia» (por el centro) vale 150 en vez de 100.
// El viento no lo trae la física común: se lo aplicamos aquí a la pipa en vuelo y se ve en hilos de humo.
// Los choques con la papelera (canto, pared y boca) también se resuelven aquí.

const TIRADAS = 10;
const R_BOCA = 0.17, R_FONDO = 0.14, ALTO = 0.45;   // la papelera (metros)
const R_PIPA = 0.014;
const VIENTO_MAX = 1.6;                              // m/s² de empuje lateral con viento a tope
const TINTA = '#140c1c';

// baraja sin repetir hasta agotar (criterio: variedad con memoria)
function baraja(lista) {
  let mazo = [];
  return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); };
}

import { Jugo } from './jugo.js';

export default {
  clave: 'Pipas', titulo: 'La apuesta de pipas', escala: 'sala', umbrales: [500, 1000, 1800],
  ayudas: { gatillo: 'Coger la pipa (suelta al lanzar)', lateral: 'Coger y lanzar', mano: { pellizco: 'Coger la pipa y lanzar', puno: 'Coger y lanzar' } },

  async crear(ctx) {
    const { THREE, fisica, agarre, humo, ui, sonido, xr } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-pipas';
    const nivel = ctx.nivel ?? 1;
    const fx = new Jugo(ctx, grupo);

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const E = { fase: 'intro', tirada: 0, puntos: 0, racha: 0, aciertos: 0, resultados: [] };
    let reloj = 0, acabado = false, esperando = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // dónde estás al empezar: todo se coloca respecto a esto (no te persigue)
    const origen = xr.cabeza.clone();
    const fwd = xr.adelante.clone().setY(0); if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    const der = V(-fwd.z, 0, fwd.x);
    const suelo = origen.clone().setY(0);

    // ---------- materiales y texturas hechas a mano ----------
    const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; };
    const basic = (o) => new THREE.MeshBasicMaterial(o);
    const tinta = basic({ color: TINTA, side: THREE.BackSide });
    const texPipa = (() => {
      const { g, t } = lienzo(64, 32);
      g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#e8e2d0'; for (const x of [6, 22, 38, 54]) g.fillRect(x, 0, 3, 32);
      return t;
    })();
    const matPipa = basic({ map: texPipa });
    const geoPipa = new THREE.SphereGeometry(1, 14, 10);
    const hacerPipa = () => {
      const m = new THREE.Mesh(geoPipa, matPipa); m.scale.set(0.0095, 0.017, 0.0055);
      const borde = new THREE.Mesh(geoPipa, tinta); borde.scale.setScalar(1.18); m.add(borde);
      return m;
    };

    // ---------- Perico, a tu derecha ----------
    const perico = await ctx.Recortable.crear('perico', 'humo');
    perico.grupo.position.copy(suelo).addScaledVector(der, 0.68).addScaledVector(fwd, 0.55); // a ~0,9 m, en el borde de la vista
    grupo.add(perico.grupo);
    perico.pose('pipas', { rebote: 0 });
    let vozLibre = 0;
    const decir = (t, prob = 1) => { if (Math.random() > prob || reloj < vozLibre) return; vozLibre = reloj + 1.2; perico.decir(t); };

    // ---------- la papelera ----------
    const papelera = new THREE.Group(); grupo.add(papelera);
    const cuerpoP = new THREE.Group(); papelera.add(cuerpoP);   // lo que se aplasta al encestar
    const texRayas = (() => {
      const { g, t } = lienzo(256, 64);
      g.fillStyle = '#4cae4f'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#3d8d40'; for (let x = 8; x < 256; x += 32) g.fillRect(x, 0, 10, 64);
      t.wrapS = THREE.RepeatWrapping; return t;
    })();
    const geoCil = new THREE.CylinderGeometry(R_BOCA, R_FONDO, ALTO, 32, 1, true);
    const fuera_ = new THREE.Mesh(geoCil, basic({ map: texRayas })); fuera_.position.y = ALTO / 2;
    const dentro_ = new THREE.Mesh(geoCil, basic({ color: '#22301f', side: THREE.BackSide })); dentro_.position.y = ALTO / 2;
    const contorno = new THREE.Mesh(geoCil, tinta); contorno.position.y = ALTO / 2; contorno.scale.set(1.06, 1.01, 1.06);
    const fondo = new THREE.Mesh(new THREE.CircleGeometry(R_FONDO, 24), basic({ color: '#1b2418' })); fondo.rotation.x = -Math.PI / 2; fondo.position.y = 0.012;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(R_BOCA + 0.004, 0.016, 8, 40), basic({ color: TINTA })); aro.rotation.x = Math.PI / 2; aro.position.y = ALTO;
    const aroBrillo = new THREE.Mesh(new THREE.TorusGeometry(R_BOCA + 0.004, 0.006, 6, 40), basic({ color: '#ffe066' })); aroBrillo.rotation.x = Math.PI / 2; aroBrillo.position.y = ALTO + 0.012;
    cuerpoP.add(contorno, fuera_, dentro_, fondo, aro, aroBrillo);
    const sombraP = (() => {
      const { g, t } = lienzo(128, 128); const r = g.createRadialGradient(64, 64, 8, 64, 64, 62);
      r.addColorStop(0, 'rgba(20,12,28,.55)'); r.addColorStop(1, 'rgba(20,12,28,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), basic({ map: t, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m;
    })();
    papelera.add(sombraP);
    let squash = 0, vSquash = 0;

    // movimiento: salto a un sitio nuevo y, desde la sexta, vaivén lateral
    const P = { desde: suelo.clone().addScaledVector(fwd, 2), hasta: suelo.clone().addScaledVector(fwd, 2), t0: -10, amp: 0, w: 0, lado: der.clone() };
    const SALTO = 0.45;
    function papeleraEn(tt) {
      const k = THREE.MathUtils.clamp((tt - P.t0) / SALTO, 0, 1);
      const p = P.desde.clone().lerp(P.hasta, k);
      if (k < 1) p.y = Math.sin(Math.PI * k) * 0.25;
      else if (P.amp) p.addScaledVector(P.lado, P.amp * Math.sin(P.w * (tt - P.t0 - SALTO)));
      return p;
    }
    papelera.position.copy(P.hasta);
    // que no se meta en una pared real (planos de las gafas)
    // ni debajo de una mesa (se vería mal y no entraría nada)
    function libre(p) {
      for (const pl of fisica.planos) {
        if (pl.orientacion === 'vertical') {
          const l = p.clone().setY(0.4).applyMatrix4(pl.inv);
          if (Math.abs(l.x) < pl.medio[0] + 0.4 && Math.abs(l.z) < pl.medio[1] + 0.4 && Math.abs(l.y) < 0.45) return false;
        } else if (pl.centroY > 0.2) {
          const l = p.clone().setY(pl.centroY).applyMatrix4(pl.inv);
          if (Math.abs(l.x) < pl.medio[0] + 0.3 && Math.abs(l.z) < pl.medio[1] + 0.3) return false;
        }
      }
      return p.distanceTo(perico.grupo.position) > 0.6;
    }
    function sitioNuevo() {
      const lejos = 0.6 + 0.7 * Math.min(1, E.tirada / 6);
      for (let i = 0; i < 30; i++) {
        const ang = (Math.random() - 0.5) * 1.2, d = 1.5 + Math.random() * lejos * (1 - i / 40);
        const dir = fwd.clone().applyAxisAngle(V(0, 1, 0), ang);
        const p = suelo.clone().addScaledVector(dir, d);
        if (p.distanceTo(P.hasta) > 0.35 && libre(p)) return p;
      }
      return suelo.clone().addScaledVector(fwd, 1.5);
    }

    // ---------- el cucurucho ----------
    const cucurucho = new THREE.Group(); grupo.add(cucurucho);  // su origen es el centro de la boca
    const geoCono = new THREE.ConeGeometry(0.05, 0.17, 24, 1, true);
    const cono = new THREE.Mesh(geoCono, basic({ color: '#f6f2ea', side: THREE.DoubleSide })); cono.rotation.x = Math.PI; cono.position.y = -0.085;
    const conoB = new THREE.Mesh(geoCono, tinta); conoB.rotation.x = Math.PI; conoB.position.y = -0.085; conoB.scale.set(1.1, 1.03, 1.1);
    const tapa = new THREE.Mesh(new THREE.CircleGeometry(0.048, 20), basic({ color: '#3a3a3e' })); tapa.rotation.x = -Math.PI / 2; tapa.position.y = -0.004;
    cucurucho.add(conoB, cono, tapa);
    for (let i = 0; i < 9; i++) {
      const m = hacerPipa(); const a = i * 2.4, r = 0.012 + (i % 3) * 0.011;
      m.position.set(Math.cos(a) * r, 0.004 + (i % 2) * 0.004, Math.sin(a) * r);
      m.rotation.set(1.2 + Math.random() * 0.6, a, Math.random()); cucurucho.add(m);
    }
    // marcador pequeño al lado del cucurucho (se lee al mirarte la mano)
    const marc = lienzo(512, 256);
    const marcador = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.095), basic({ map: marc.t, transparent: true }));
    grupo.add(marcador);
    let cucuMano = false, sinMano = 0;
    const flotaEn = origen.clone().addScaledVector(fwd, 0.32).addScaledVector(der, -0.2); flotaEn.y = Math.max(0.5, origen.y - 0.45);
    cucurucho.position.copy(flotaEn);
    function colocarCucurucho(dt) {
      const izq = xr.manos.izquierda;
      const tieneMano = izq.activa;
      sinMano = tieneMano ? 0 : sinMano + dt;
      cucuMano = tieneMano || (cucuMano && sinMano < 0.6);
      if (cucuMano && izq.activa) {
        // de pie sobre la palma: no gira con la muñeca (así no se caen las pipas)
        const meta = izq.pos.clone().add(V(0, 0.075, 0));
        cucurucho.position.lerp(meta, Math.min(1, dt * 25));
      } else {
        // flotando a mano: a tu izquierda, delante, a la altura del pecho; te sigue con calma si giras
        const f = xr.adelante.clone().setY(0); if (f.lengthSq() > 1e-4) f.normalize(); else f.copy(fwd);
        const d = V(-f.z, 0, f.x);
        const meta = xr.cabeza.clone().addScaledVector(f, 0.32).addScaledVector(d, -0.2); meta.y = Math.max(0.5, xr.cabeza.y - 0.45);
        flotaEn.lerp(meta, Math.min(1, dt * 0.8));
        cucurucho.position.copy(flotaEn); cucurucho.position.y += Math.sin(reloj * 1.7) * 0.006;
      }
      const haciaMi = xr.cabeza.clone().sub(cucurucho.position).setY(0).normalize();
      const tuDerecha = V(haciaMi.z, 0, -haciaMi.x);
      marcador.position.copy(cucurucho.position).addScaledVector(tuDerecha, -0.15).add(V(0, 0.02, 0)); // a tu izquierda del cucurucho
      marcador.lookAt(xr.cabeza);
    }
    function pintarMarcador() {
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.86)'; g.beginPath(); g.roundRect(6, 6, 500, 244, 28); g.fill();
      g.strokeStyle = '#ffe066'; g.lineWidth = 6; g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = '46px Caprasimo, serif'; g.fillStyle = '#fff3c4';
      g.fillText(`Tirada ${Math.max(1, E.tirada)}/${TIRADAS}`, 28, 52);
      g.font = '64px Caprasimo, serif'; g.fillStyle = '#ffe066';
      g.fillText(`${E.puntos}`, 28, 128);
      g.font = '40px Caprasimo, serif'; g.fillStyle = E.racha >= 2 ? '#7ee08a' : '#c9b6ff';
      g.fillText(E.racha >= 2 ? `racha x${1 + (E.racha - 1) * 0.5}` : `${E.aciertos} dentro`, 28, 200);
      // el viento visto desde donde estás: arriba = hacia delante
      const cx = 400, cy = 118;
      g.strokeStyle = 'rgba(255,243,196,.35)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 66, 0, Math.PI * 2); g.stroke();
      const m = viento.length();
      if (m < 0.05) { g.font = '34px Caprasimo, serif'; g.fillStyle = '#c9b6ff'; g.textAlign = 'center'; g.fillText('calma', cx, cy); }
      else {
        const x = viento.dot(der) / m, y = -viento.dot(fwd) / m, L = 30 + 30 * Math.min(1, m / VIENTO_MAX);
        g.strokeStyle = '#8fd3ff'; g.fillStyle = '#8fd3ff'; g.lineWidth = 12; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - x * L, cy - y * L); g.lineTo(cx + x * L, cy + y * L); g.stroke();
        const a = Math.atan2(y, x); g.beginPath();
        g.moveTo(cx + x * (L + 14), cy + y * (L + 14));
        g.lineTo(cx + x * L + Math.cos(a + 2.4) * 26, cy + y * L + Math.sin(a + 2.4) * 26);
        g.lineTo(cx + x * L + Math.cos(a - 2.4) * 26, cy + y * L + Math.sin(a - 2.4) * 26); g.fill();
      }
      g.font = '28px Caprasimo, serif'; g.fillStyle = '#8fd3ff'; g.textAlign = 'center'; g.fillText('viento', cx, 222);
      t.needsUpdate = true;
    }

    // ---------- textos que saltan (¡Dentro!, ¡Clonc!) ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.5) {
      const { g, c, t } = lienzo(512, 160);
      let px = 78; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > 470 && px > 40) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), basic({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- el rastro de la pipa (enseña la trayectoria) ----------
    const N_RASTRO = 48;
    const rastro = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 4), basic({ color: '#fffaf0', transparent: true, opacity: 0.75 }), N_RASTRO);
    rastro.count = 0; rastro.frustumCulled = false; grupo.add(rastro);
    const _mat = new THREE.Matrix4();
    let tRastro = 0;
    function apuntarRastro(p) {
      if (rastro.count >= N_RASTRO) return;
      _mat.makeTranslation(p.x, p.y, p.z); rastro.setMatrixAt(rastro.count++, _mat); rastro.instanceMatrix.needsUpdate = true;
    }

    // ---------- viento ----------
    const viento = V();
    let tHilo = 0;
    function soplarHilos(dt) {
      tHilo -= dt; if (tHilo > 0) return;
      const m = viento.length();
      tHilo = m < 0.05 ? 0.35 : 0.11 - 0.04 * Math.min(1, m / VIENTO_MAX);
      // un punto al azar entre tú y la papelera, a la altura del vuelo
      const p = suelo.clone().lerp(papelera.position, 0.15 + Math.random() * 0.9);
      p.addScaledVector(der, (Math.random() - 0.5) * 1.2); p.y = 0.35 + Math.random() * 1.5;
      if (m < 0.05) { humo.soltar({ pos: p, vel: V(0, 0.08, 0), tam: 0.02, vida: 2, crece: 0.02, sube: 0.02, frena: 0, brillo: 0.7, alfa: 0.4 }); return; }
      const dir = viento.clone().divideScalar(m), vel = dir.clone().multiplyScalar(0.35 + 0.9 * m / VIENTO_MAX);
      for (let i = 0; i < 4; i++) {
        humo.soltar({ pos: p.clone().addScaledVector(dir, -i * 0.045), vel, tam: 0.026 - i * 0.004, vida: 1.6, crece: 0.01, sube: 0, frena: 0, brillo: 0.75, alfa: 0.6 - i * 0.1, tamMax: 0.05 });
      }
    }

    // ---------- pipas ----------
    let pipa = null;                // la de la tirada: { m, c, enCono }
    const cascaras = [];            // las que se quedan en el suelo
    let lanzador = null, tVuelo = 0, enSuelo = 0, prevPos = V(), clonc = 0;
    function nuevaPipa() {
      const m = hacerPipa(); grupo.add(m);
      m.position.copy(cucurucho.position).add(V(0, 0.022, 0));
      const c = fisica.anadir(m, { radio: R_PIPA, rebote: 0.3, roce: 0.9, masa: 0.2, datos: { pipa: true } });
      c.dormido = true;
      pipa = { m, c, enCono: true };
    }
    function aCascara(p) {
      p.c.cogible = false; cascaras.push(p);
      while (cascaras.length > 14) { const v = cascaras.shift(); fisica.quitar(v.c); grupo.remove(v.m); }
    }

    const alCogerAntes = agarre.alCoger, alSoltarAntes = agarre.alSoltar;
    agarre.alCoger = (c, mano) => {
      alCogerAntes?.(c, mano);
      if (!pipa || c !== pipa.c) return;
      pipa.enCono = false; esperando = 0;
      sonido('papel', { volumen: 0.25, tono: 1.4 });
    };
    agarre.alSoltar = (c, mano) => {
      alSoltarAntes?.(c, mano);
      if (!pipa || c !== pipa.c || E.fase !== 'apunta') return;
      const v = c.vel.length();
      if (v < 0.75) { // con manos el lanzamiento sale más flojo: más tolerancia
        // se te ha caído: no cuenta, sale otra
        aCascara(pipa); pipa = null;
        luego(0.35, () => { if (E.fase === 'apunta' && !pipa) nuevaPipa(); });
        if (Math.random() < 0.5) decir('*crac* Esa no vale.', 1);
        return;
      }
      c.cogible = false; lanzador = mano;
      E.fase = 'vuelo'; tVuelo = 0; enSuelo = 0; clonc = 0; prevPos.copy(c.obj.position);
      rastro.count = 0; tRastro = 0;
      ui.instruccion(null);
      sonido('fiu', { volumen: 0.55, tono: 0.9 + Math.random() * 0.25 });
      perico.pose('silbando');
    };

    // ---------- la partida ----------
    const frasesAcierto = baraja(['¡Trampa! ¡Pin pin!', 'Eso ha sido suerte.', 'Pues yo meto más. Algún día.', 'Suerte. Pura suerte. Suerte.']);
    const frasesFallo = baraja(['Pin pin. Te lo dije.', 'Te lo dije. Te lo dije.', 'Fuera. Pin pin.', 'Ni una. Ya te lo dije.']);
    const frasesEspera = baraja(['*crac*', 'Pipa.', 'Pin pin… *crac*', 'Tira, que me como el cucurucho.']);

    function nuevaTirada() {
      if (acabado) return;
      if (E.tirada >= TIRADAS) return final();
      E.tirada++;
      if (E.tirada > 2) rastro.count = 0;
      // la papelera salta a otro sitio; desde la sexta (tercera con nivel 3+) se mueve
      P.desde = papelera.position.clone().setY(0); P.hasta = sitioNuevo(); P.t0 = reloj;
      const desdeQue = nivel >= 3 ? 3 : 6;
      if (E.tirada >= desdeQue) {
        const haciaMi = suelo.clone().sub(P.hasta).setY(0).normalize();
        P.lado.set(-haciaMi.z, 0, haciaMi.x);
        P.amp = 0.22 + 0.04 * (E.tirada - desdeQue);
        P.w = Math.PI / Math.max(0.9, 1.6 - E.tirada * 0.06);
      } else P.amp = 0;
      sonido('boing', { en: papelera, volumen: 0.35, tono: 1.3 });
      // viento: sin viento en las dos primeras (nivel < 3)
      const sinViento = E.tirada <= (nivel >= 3 ? 0 : 2);
      if (sinViento) viento.set(0, 0, 0);
      else {
        const ang = Math.random() * Math.PI * 2, f = (0.3 + 0.7 * Math.random()) * Math.min(1, E.tirada / 6) * (nivel >= 5 ? 1.5 : 1);
        viento.set(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(f * VIENTO_MAX);
        if (E.tirada === (nivel >= 3 ? 1 : 3)) { sonido('whoosh', { volumen: 0.4 }); luego(0.6, () => decir('Uy, viento. Pin pin.', 1)); }
      }
      if (E.tirada === (nivel >= 3 ? 3 : 6)) luego(0.8, () => decir('Ahora se mueve. Te lo juro.', 1));
      pintarMarcador();
      E.fase = 'apunta'; esperando = 0;
      perico.pose('pipas');
      nuevaPipa();
      if (E.tirada === 1) {
        ui.instruccion('Coge una pipa y lánzala a la papelera');
        // la mano fantasma: pellizca la pipa del cucurucho, echa el brazo atrás y la suelta hacia la papelera
        const p0 = cucurucho.position.clone().add(V(0, 0.03, 0));
        const atras = xr.cabeza.clone().addScaledVector(der, 0.22).add(V(0, -0.15, 0.05));
        const suelta = papelera.position.clone().lerp(xr.cabeza, 0.62); suelta.y = xr.cabeza.y - 0.05;
        fx.demo([{ p: p0 }, { p: p0, pinza: true }, { p: atras, pinza: true }, { p: suelta, pinza: true }, { p: suelta }], { dur: 3, tramo: 0.5 });
      }
    }

    function resolver(dentro, centrado = 1) {
      E.fase = 'espera';
      if (dentro) {
        E.racha++; E.aciertos++;
        const limpio = centrado < 0.35;
        const pts = Math.round((limpio ? 150 : 100) * (1 + (E.racha - 1) * 0.5));
        E.puntos += pts;
        E.resultados.push({ dentro: true, pts });
        // la pipa se queda dentro (se ven las que llevas)
        fisica.quitar(pipa.c);
        cuerpoP.add(pipa.m); pipa.m.position.set((Math.random() - 0.5) * 0.12, 0.03 + Math.min(0.15, E.aciertos * 0.012), (Math.random() - 0.5) * 0.12);
        pipa = null;
        vSquash -= 2.2;
        sonido('lata', { en: papelera, volumen: 0.7 }); sonido('campanita', { volumen: 0.45 });
        lanzador?.vibrar(0.7, 70);
        const boca = papelera.position.clone().setY(ALTO + 0.05);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2;
          humo.soltar({ pos: boca, vel: V(Math.cos(a) * 0.35, 0.5 + Math.random() * 0.3, Math.sin(a) * 0.35), tam: 0.04, vida: 1.1, crece: 0.08, sube: 0.1, frena: 2, brillo: 0.8, alfa: 0.8 });
        }
        fx.acierto(boca, { color: limpio ? '#ffe066' : '#7ee08a', sonido: null, fuerte: limpio || E.racha >= 3, n: 14 + E.racha * 4 });
        const txt = (clonc ? '¡De rebote! ' : limpio ? '¡Limpia! ' : '¡Dentro! ') + `+${pts}`;
        saltaTexto(txt, '#7ee08a', boca.clone().add(V(0, 0.35, 0)), 0.62);
        if (E.racha === 3 || E.racha === 5 || E.racha === 8) {
          luego(0.35, () => { saltaTexto(`¡Racha de ${E.racha}!`, '#ffe066', papelera.position.clone().setY(ALTO + 0.75), 0.7); sonido('oooh', { volumen: 0.5 }); });
        }
        perico.pose(E.racha >= 3 ? 'tapandose' : 'horror');
        if (E.racha >= 3) luego(0.4, () => decir(frasesAcierto()));
        else if (E.racha === 1 && E.aciertos === 1) luego(0.4, () => decir('¿Qué? Pin pin.'));
        luego(1.5, nuevaTirada);
      } else {
        E.racha = 0;
        E.resultados.push({ dentro: false, pts: 0 });
        if (pipa) { fx.fallo(pipa.m.position.clone(), { mano: lanzador }); aCascara(pipa); pipa = null; }
        sonido('pop', { volumen: 0.3 });
        luego(0.25, () => sonido('pin-pin', { en: perico.grupo, volumen: 0.55 }));
        perico.pose(Math.random() < 0.5 ? 'partiendose' : 'silbando');
        luego(0.5, () => decir(frasesFallo(), 0.45));
        luego(1.3, nuevaTirada);
      }
      pintarMarcador();
    }

    function final() {
      if (acabado) return;
      acabado = true; E.fase = 'fin';
      ui.instruccion(null); rastro.count = 0;
      const gana = E.aciertos >= 5;
      perico.pose(gana ? 'tapandose' : 'alas-arriba');
      perico.decir(gana ? 'Ha sido suerte. Pin pin.' : 'Pin pin. Te lo dije.');
      sonido(gana ? 'oooh' : 'pin-pin', { volumen: 0.5 });
      luego(1.4, () => ctx.terminar({
        puntos: E.puntos, gana,
        linea: `${E.aciertos} de ${TIRADAS} dentro. ${gana ? 'Le ganas a Perico.' : 'Perico se ríe de ti.'}`,
      }));
    }

    // choques de la pipa con la papelera: boca (dentro), canto (¡clonc!) y pared de fuera
    const _d = V();
    function chocarPapelera(c) {
      const p = c.obj.position, b = papelera.position;
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
      const qdx = prevPos.x - b.x, qdz = prevPos.z - b.z, qd = Math.hypot(qdx, qdz);
      const H = b.y + ALTO;
      // cruza la boca bajando
      if (prevPos.y >= H && p.y < H) {
        const k = (prevPos.y - H) / Math.max(1e-6, prevPos.y - p.y);
        const cx = qdx + (dx - qdx) * k, cz = qdz + (dz - qdz) * k, dc = Math.hypot(cx, cz);
        if (dc < R_BOCA - R_PIPA * 0.5) return resolver(true, dc / R_BOCA);
      }
      // el canto (un toro): rebote de verdad, y a veces cae dentro
      const rx = d > 1e-5 ? dx / d : 1, rz = d > 1e-5 ? dz / d : 0;
      _d.set(dx - rx * R_BOCA, p.y - H, dz - rz * R_BOCA);
      const dist = _d.length(), lim = R_PIPA + 0.016;
      if (dist < lim && dist > 1e-6) {
        _d.divideScalar(dist);
        const vn = c.vel.dot(_d);
        p.addScaledVector(_d, lim - dist);
        if (vn < 0) {
          c.vel.addScaledVector(_d, -vn * 1.45); c.vel.multiplyScalar(0.8);
          clonc++;
          sonido('bonk', { en: papelera, volumen: Math.min(0.7, 0.25 + -vn * 0.15), tono: 1.1 + Math.random() * 0.3 });
          lanzador?.vibrar(0.45, 35);
          saltaTexto('¡Clonc!', '#fff3c4', b.clone().setY(H + 0.25), 0.45);
          perico.pose('graznando');
        }
        return;
      }
      // pared de fuera, por debajo del canto
      const rPared = R_FONDO + (R_BOCA - R_FONDO) * THREE.MathUtils.clamp((p.y - b.y) / ALTO, 0, 1) + R_PIPA;
      if (p.y < H && p.y > b.y && d < rPared && qd >= rPared - 0.005) {
        p.x = b.x + rx * rPared; p.z = b.z + rz * rPared;
        const vr = c.vel.x * rx + c.vel.z * rz;
        if (vr < 0) {
          c.vel.x -= rx * vr * 1.4; c.vel.z -= rz * vr * 1.4;
          sonido('bonk', { en: papelera, volumen: 0.3, tono: 0.8 });
          lanzador?.vibrar(0.3, 25);
        }
      }
    }

    // ---------- arranque ----------
    pintarMarcador();
    colocarCucurucho(1);
    ctx.musica?.('apuestas');
    luego(0.6, () => { perico.pose('graznando'); perico.decir('Pin pin. Te apuesto a que no metes ni una.'); sonido('pin-pin', { en: perico.grupo, volumen: 0.5 }); });
    // Perico tira la suya para enseñarte… y se queda corto
    let pipaPerico = null;
    luego(2.6, () => {
      const m = hacerPipa(); grupo.add(m);
      m.position.copy(perico.bocaMundo());
      const c = fisica.anadir(m, { radio: R_PIPA, rebote: 0.3, roce: 0.9, masa: 0.2, cogible: false });
      const hacia = papelera.position.clone().sub(m.position).setY(0).normalize();
      fisica.lanzar(c, hacia.multiplyScalar(1.3).add(V(0, 2.2, 0)));
      pipaPerico = { m, c }; perico.pose('silbando'); sonido('fiu', { volumen: 0.4, tono: 1.3 });
    });
    luego(3.9, () => { if (pipaPerico) aCascara(pipaPerico); perico.pose('horror'); decir('Esa no cuenta.'); });
    luego(5.2, nuevaTirada);

    const api = {
      E, get fase() { return E.fase; }, get pipa() { return pipa; }, viento, alto: ALTO,
      papeleraEn: s => papeleraEn(reloj + s).setY(ALTO),
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        perico.actualizar(dt, xr.cabeza);
        colocarCucurucho(dt);
        // papelera: salto, vaivén y aplastón
        papelera.position.copy(papeleraEn(reloj));
        vSquash += (-squash * 140 - vSquash * 9) * dt; squash += vSquash * dt;
        cuerpoP.scale.set(1 / Math.sqrt(Math.max(0.4, 1 + squash)), 1 + squash, 1 / Math.sqrt(Math.max(0.4, 1 + squash)));
        aroBrillo.material.color.setHSL(0.14, 1, 0.6 + 0.1 * Math.sin(reloj * 5));
        if (E.fase !== 'fin') soplarHilos(dt);
        // textos que saltan
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.3; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (1.3 - s.t));
          if (s.t > 1.3) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
        if (!pipa) return;
        const c = pipa.c;
        if (pipa.enCono && !c.cogido) {
          c.obj.position.copy(cucurucho.position).add(V(0, 0.022, 0)); c.obj.rotation.set(1.3, reloj * 0.5, 0);
          c.vel.set(0, 0, 0); c.dormido = true;
          if (E.fase === 'apunta') {
            esperando += dt;
            if (esperando > 9) { esperando = 0; decir(frasesEspera(), 0.8); if (E.tirada <= 3) ui.instruccion('Pellizca una pipa y lánzala'); }
          }
          return;
        }
        if (E.fase !== 'vuelo') return;
        tVuelo += dt;
        // viento: empuja la pipa en el aire
        if (!c.dormido && c.obj.position.y > R_PIPA + 0.01) c.vel.addScaledVector(viento, dt);
        chocarPapelera(c);
        if (!pipa) return; // ha entrado
        tRastro -= dt;
        if (tRastro <= 0 && c.obj.position.distanceTo(xr.cabeza) > 0.6) { tRastro = 0.025; apuntarRastro(c.obj.position); } // cerca de la cara molestaría
        prevPos.copy(c.obj.position);
        if (c.obj.position.y <= R_PIPA + 0.004) enSuelo += dt;
        const lejos = c.obj.position.distanceTo(suelo) > 9;
        if (enSuelo > 0.45 || c.dormido || tVuelo > 5 || lejos) resolver(false);
      },
      // salir a mitad: cuenta lo que llevas, sin ganar
      abandonar() {
        if (acabado) return;
        acabado = true; E.fase = 'fin'; ui.instruccion(null);
        perico.pose('alas-arriba'); perico.decir('¿Te rindes? Pin pin. Lo sabía.');
        ctx.terminar({ puntos: E.puntos, gana: false, linea: `Lo dejas en la tirada ${E.tirada}. Perico se queda tus pipas.` });
      },
      destruir() {
        acabado = true; tareas.length = 0;
        fx.destruir();
        agarre.alCoger = alCogerAntes; agarre.alSoltar = alSoltarAntes;
        for (const m of [xr.manos.derecha, xr.manos.izquierda]) if (pipa && agarre.lleva(m) === pipa.c) agarre.soltar(m, false);
        if (pipa) fisica.quitar(pipa.c);
        if (pipaPerico) fisica.quitar(pipaPerico.c);
        for (const v of cascaras) fisica.quitar(v.c);
        ui.instruccion(null);
        perico.callar();
        marc.t.dispose();
      },
    };
  },
};
