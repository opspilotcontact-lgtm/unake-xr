// El palo (la noche de Cotine) en VR nativo, escala «inmersivo». Reglas de base/js/escenas/palo.js:
// Perico le ha robado el palo a Cotine para usarlo de percha. Sin palo, Cotine se hincha y flota sobre el barrio
// (tú eres Cotine: estás en una azotea de noche, bg-cielo en panorama). Jefe a lo Cuphead, tres fases:
//   1. pipas sueltas · 2. abanicos de tres · 3. abanicos de cinco y PICADOS (con aviso: «¡!» y se lanza a tu cara).
// En VR, con gestos grandes:
//   LANZAR virutas de azúcar: un gesto rápido de la mano HACIA Perico (como tirar confeti). Con las dos manos, más.
//   ESQUIVAR con el cuerpo (inclinarte o un paso): las pipas van a donde estaba tu cabeza al tirarlas.
//   PARAR con la mano: lo que toca tu mano se para. Así se juega sentado.
// Mientras pica, Perico no recibe. Tres vidas; ganas si recuperas el palo con puntos para la primera estrella.
import * as THREE from 'three';
import { Jugo } from './jugo.js';

const TINTA = '#140c1c';
const Z_PERICO = -2.3;
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
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _col = new THREE.Color(), _e = new THREE.Euler();

export default {
  clave: 'Palo', titulo: 'El palo', escala: 'inmersivo', umbrales: [1300, 1600, 1950],
  ayudas: {
    gatillo: 'Gesto rápido hacia Perico: virutas', lateral: 'Mano delante: parar pipas',
    mano: { pellizco: 'Gesto rápido hacia Perico: virutas', puno: 'Mano delante: parar pipas' },
  },

  async crear(ctx) {
    const { xr, ui, sonido, humo } = ctx;
    const grupo = new THREE.Group(); grupo.name = 'minijuego-palo';
    const nivel = ctx.nivel ?? 1;
    const fx = new Jugo(ctx, grupo);
    const propias = [];

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const VIDA = 100 * (1 + 0.1 * Math.min(Math.max(0, nivel - 1), 5));
    const est = {
      fase: 'intro', activo: false, hp: VIDA, vidaMax: VIDA, vidas: 3, invul: 0, t: 0, tiempo: 0, proximo: 1.4,
      picando: false, picado: null, faseJefe: 1, golpes: 0, paradas: 0, lanzados: 0, aciertos: 0,
    };
    let reloj = 0, acabado = false, destruido = false;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });

    // ---------- dónde: la azotea mira hacia donde miras ----------
    const fw = xr.adelante.clone().setY(0); if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1); fw.normalize();
    const sala = new THREE.Group(); sala.name = 'azotea-palo';
    sala.position.copy(xr.cabeza).setY(0); sala.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(sala); sala.updateMatrixWorld(true);
    const inv = sala.matrixWorld.clone().invert(), qSi = sala.quaternion.clone().invert();
    const aLocal = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const aMundo = (v, out = V()) => out.copy(v).applyMatrix4(sala.matrixWorld);
    const alto0 = clamp(xr.cabeza.y, 1.0, 1.9);

    // ---------- arte ----------
    const pr = n => ctx.img(n).catch(e => { console.warn('palo: falta', n, e); return null; });
    const [texCielo, perico] = await Promise.all([
      pr('bg-cielo.jpg'),
      ctx.Recortable.crear('perico', 'humo', { escala: 1.8, giroMax: 0.6 }).catch(e => { console.warn('palo: sin Perico', e); return null; }),
    ]);
    if (destruido) return { grupo, actualizar() { }, destruir() { }, abandonar() { } };

    // el cielo de noche y el barrio alrededor (bg-cielo ya viene en espejo), y la azotea bajo tus pies
    const noche = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: '#151a36', side: THREE.BackSide }));
    sala.add(noche); propias.push(noche.geometry, noche.material);
    if (texCielo) {
      const tf = texCielo.clone(); tf.wrapS = THREE.MirroredRepeatWrapping; tf.repeat.set(4, 1); tf.needsUpdate = true; propias.push(tf);
      const pano = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 9, 64, 1, true), new THREE.MeshBasicMaterial({ color: '#c9c4dc', map: tf, side: THREE.BackSide }));
      pano.position.y = 2.6; sala.add(pano); propias.push(pano.geometry, pano.material);
    }
    const texAzotea = (() => {
      const { g, t } = lienzo(128, 128);
      g.fillStyle = '#9a5a44'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#8a4e3b'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
      g.fillStyle = 'rgba(20,12,28,.4)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128); g.fillRect(0, 63, 128, 2); g.fillRect(63, 0, 2, 128);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.needsUpdate = true; return t;
    })();
    const azotea = new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshBasicMaterial({ color: '#b9a8a8', map: texAzotea }));
    azotea.rotation.x = -Math.PI / 2; azotea.position.y = 0.002; sala.add(azotea); propias.push(azotea.geometry, azotea.material, texAzotea);
    const pretil = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.42, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#6e4a52', side: THREE.DoubleSide }));
    pretil.position.y = 0.21; sala.add(pretil); propias.push(pretil.geometry, pretil.material);

    // ---------- Perico con el palo de Cotine ----------
    const BASE = V(0, alto0 - 0.6, Z_PERICO);       // pies de Perico (su centro, a la altura de tus ojos)
    const palo = new THREE.Group();
    {
      const geo = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 12);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff8fc0' }));
      const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide })); b.scale.set(1.5, 1.03, 1.5);
      palo.add(b, m); propias.push(geo, m.material, b.material);
    }
    if (perico) {
      perico.enAsiento = true; perico.sombra.visible = false;    // vuela: sin sombra en el suelo
      perico.grupo.position.set(0, BASE.y, -8);
      sala.add(perico.grupo);
      perico.pose('volando', { rebote: 0 });
      palo.position.set(0.22, 0.35, 0.05); palo.rotation.z = -0.35; perico.grupo.add(palo);
    } else { palo.position.copy(BASE).add(V(0.2, 0.4, 0)); sala.add(palo); }
    const altoP = () => perico?.alto ?? 1.1;
    const _cP = V();
    const centroPerico = (out = _cP) => out.copy(perico ? perico.grupo.position : BASE).add(V(0, altoP() * 0.5, 0));
    let vozLibre = 0;
    const decir = (t, prob = 1) => { if (!perico || Math.random() > prob || reloj < vozLibre) return; vozLibre = reloj + 1.6; perico.decir(t); };
    let tFlash = 0;

    // ---------- el marcador: la vida de Perico y tus vidas ----------
    const marc = lienzo(1024, 200); propias.push(marc.t);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3 * 200 / 1024), new THREE.MeshBasicMaterial({ map: marc.t, transparent: true, depthWrite: false }));
    panel.position.set(0, alto0 + 0.78, Z_PERICO - 0.4); panel.lookAt(V(0, alto0, 0)); panel.renderOrder = 4; sala.add(panel);
    propias.push(panel.geometry, panel.material);
    let clavePanel = '';
    function pintarPanel() {
      const clave = [Math.ceil(est.hp), est.vidas].join('|');
      if (clave === clavePanel) return; clavePanel = clave;
      const { g, c, t } = marc;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(20,12,28,.82)'; g.beginPath(); g.roundRect(6, 6, 1012, 188, 30); g.fill();
      g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = '44px Caprasimo, serif'; g.fillStyle = '#fff3c4'; g.fillText('PERICO · el ladrón de palos', 512, 52);
      g.fillStyle = '#000000'; g.fillRect(212, 100, 600, 40);
      g.fillStyle = '#ff8fc0'; g.fillRect(216, 104, 592 * est.hp / est.vidaMax, 32);
      g.strokeStyle = '#fff3c4'; g.lineWidth = 5; g.strokeRect(212, 100, 600, 40);
      g.fillStyle = '#c9b6ff'; g.fillRect(212 + 600 / 3, 100, 4, 40); g.fillRect(212 + 1200 / 3, 100, 4, 40);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < est.vidas ? '#ff8fc0' : '#3d3350';
        g.beginPath(); g.arc(70 + i * 46, 120, 18, 0, 7); g.fill(); g.strokeStyle = TINTA; g.lineWidth = 5; g.stroke();
      }
      t.needsUpdate = true;
    }

    // ---------- textos que saltan ----------
    const saltos = [];
    const _cam = V();
    function saltaTexto(texto, color, pos, tam = 0.5) {
      const { g, t } = lienzo(512, 160);
      let px = 80; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > 470 && px > 36) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 16; g.strokeStyle = TINTA; g.strokeText(texto, 256, 84); g.fillStyle = color; g.fillText(texto, 256, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam * 160 / 512), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); sala.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- virutas (tuyas) y pipas (de Perico): una llamada de dibujo cada una ----------
    const MAX_V = 80, MAX_P = 40;
    const virutasIM = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.028, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), MAX_V);
    virutasIM.setColorAt(0, _col.set('#ffffff')); virutasIM.count = 0; virutasIM.frustumCulled = false; sala.add(virutasIM);
    const texPipa = (() => {
      const { g, t } = lienzo(64, 32);
      g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#e8e2d0'; for (const x of [6, 22, 38, 54]) g.fillRect(x, 0, 3, 32);
      return t;
    })();
    const geoPipa = new THREE.SphereGeometry(1, 12, 8);
    const pipasIM = new THREE.InstancedMesh(geoPipa, new THREE.MeshBasicMaterial({ map: texPipa }), MAX_P);
    const pipasT = new THREE.InstancedMesh(geoPipa, new THREE.MeshBasicMaterial({ color: '#f2e6c8', side: THREE.BackSide }), MAX_P);
    for (const m of [pipasIM, pipasT]) { m.count = 0; m.frustumCulled = false; sala.add(m); }
    propias.push(virutasIM.geometry, virutasIM.material, texPipa, geoPipa, pipasIM.material, pipasT.material);
    const virutas = [], pipas = [];
    const COLORES = ['#ff8fc0', '#ffd23f', '#5ad1ff'];

    // ---------- tú: cabeza y manos en la azotea ----------
    const cab = V();
    const MANOS = ['derecha', 'izquierda'];
    const L = { derecha: { pos: V(), vel: V(), listo: true, cd: 0 }, izquierda: { pos: V(), vel: V(), listo: true, cd: 0 } };
    function leerCuerpo(dt) {
      aLocal(xr.cabeza, cab);
      for (const k of MANOS) {
        const m = xr.manos[k], l = L[k];
        l.cd = Math.max(0, l.cd - dt);
        if (!m.activa) { l.listo = true; continue; }
        aLocal(m.pos, l.pos); l.vel.copy(m.vel).applyQuaternion(qSi);
      }
    }
    const vibrar = (f, ms, solo = null) => { for (const k of solo ? [solo] : MANOS) if (xr.manos[k].activa) xr.manos[k].vibrar?.(f, ms); };

    // el gesto: la mano sale rápida hacia delante (hacia Perico) → un puñado de virutas
    const _d = V(), _t = V();
    function gestos() {
      for (const k of MANOS) {
        const m = xr.manos[k], l = L[k];
        if (!m.activa) continue;
        const haciaDelante = -l.vel.z, rapidez = l.vel.length();
        if (haciaDelante < 0.4) l.listo = true;
        if (!l.listo || l.cd > 0 || haciaDelante < 1.25 || rapidez < 1.4) continue;
        l.listo = false; l.cd = 0.28;
        lanzar(k, l);
      }
    }
    function lanzar(k, l) {
      est.lanzados++;
      // ayuda de puntería: el gesto marca la dirección, Perico la corrige bastante (en VR apuntar con el brazo cuesta)
      _d.copy(l.vel).normalize();
      _t.copy(centroPerico()).sub(l.pos).normalize();
      const dir = _d.lerp(_t, 0.62).normalize();
      for (let i = 0; i < 4; i++) {
        const v = dir.clone().add(V(azar(-0.05, 0.05), azar(-0.04, 0.06), azar(-0.05, 0.05))).normalize().multiplyScalar(azar(7, 8.5));
        virutas.push({ p: l.pos.clone().addScaledVector(dir, 0.06 + i * 0.03), v, vida: 0.9, rot: Math.random() * 6, color: COLORES[(est.lanzados + i) % 3] });
      }
      while (virutas.length > MAX_V) virutas.shift();
      sonido('fiu', { volumen: 0.3, tono: 1.2 + Math.random() * 0.3 });
      vibrar(0.35, 25, k);
    }

    // ---------- Perico: flota, tira pipas, abanicos o se lanza en picado ----------
    const faseDe = () => { const f = est.hp / est.vidaMax; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; };
    function tirarPipa(desvio) {
      const desde = perico ? aLocal(perico.bocaMundo(V())) : centroPerico().clone();
      desde.z += 0.05;
      const meta = cab.clone().add(V(0, -0.02, 0));
      const dir = meta.sub(desde).normalize().applyAxisAngle(V(0, 1, 0), desvio);
      const v = Math.min(2.7, 1.6 + faseDe() * 0.25 + 0.05 * (nivel - 1));
      pipas.push({ p: desde, v: dir.multiplyScalar(v), rot: Math.random() * 6 });
      while (pipas.length > MAX_P) pipas.shift();
    }
    function escupir(desvios) {
      desvios.forEach(a => tirarPipa(a));
      sonido('pin-pin', { volumen: 0.22, tono: 1 + Math.random() * 0.2 });
      perico?.pose('graznando', { rebote: 0.1 }); luego(0.35, () => { if (!acabado && !est.picando) perico?.pose('volando', { rebote: 0 }); });
    }
    // picado: avisa con «¡!», se pone a la altura de tu cabeza y cruza en línea recta por donde estabas
    function picado() {
      est.picando = true;
      const meta = cab.clone();
      est.picado = { fase: 'aviso', meta, t: 0, desde: perico.grupo.position.clone() };
      saltaTexto('¡!', '#ff4f4f', V(meta.x, meta.y + 0.05, -1.0), 0.35);
      sonido('pin-pin', { volumen: 0.5, tono: 0.8 });
      perico.pose('alas-arriba');
      decir(elige(['¡Pin pin!', 'Ahí voy. Ahí voy.', '¡Percha!']), 0.6);
    }
    function moverPicado(dt) {
      const P = est.picado, g = perico.grupo.position;
      P.t += dt;
      const destino = V(P.meta.x, P.meta.y - altoP() * 0.5, Z_PERICO);
      if (P.fase === 'aviso') {
        g.lerp(destino, Math.min(1, dt * 6));
        if (P.t > 0.95) { P.fase = 'pica'; P.t = 0; sonido('fiuuu', { volumen: 0.6 }); perico.pose('volando'); }
      } else if (P.fase === 'pica') {
        const antes = g.z;
        g.z += dt * 5.2;
        const zC = g.z, xC = g.x, yC = g.y + altoP() * 0.5;
        // cruza tu plano: si tu cabeza sigue donde estaba, te da
        if (antes < cab.z && zC >= cab.z && Math.hypot(cab.x - xC, cab.y - yC) < 0.24) golpe();
        perico.grupo.visible = Math.abs(zC - cab.z) > 0.45;     // nunca te tapa la vista
        if (zC > cab.z + 2.2) { P.fase = 'vuelve'; P.t = 0; perico.grupo.visible = true; g.set(azar(-1.5, 1.5), BASE.y + 1.2, -8); }
      } else {
        g.lerp(BASE, Math.min(1, dt * 2.4));
        if (P.t > 1.4) { est.picando = false; est.picado = null; est.proximo = 0.8; }
      }
    }

    function golpe() {
      if (est.invul > 0 || !est.activo || acabado) return;
      est.invul = 1.4; est.vidas--; est.golpes++;
      sonido('golpe', { volumen: 0.65 });
      vibrar(1, 200);
      const delante = cab.clone().add(V(0, -0.05, -0.35));
      fx.chispas(aMundo(delante), '#ff8fc0', 24, 1.4);
      saltaTexto('¡Au!', '#ff8fc0', delante.clone().add(V(0, 0.18, -0.2)), 0.3);
      perico?.pose('partiendose'); luego(0.8, () => { if (!acabado && !est.picando) perico?.pose('volando', { rebote: 0 }); });
      decir(elige(['Pin pin.', 'Te lo dije. Te lo dije.', 'Mía. La percha es mía.']), 0.5);
      pintarPanel();
      if (est.vidas <= 0) final(false);
    }

    function final(gana) {
      if (acabado) return;
      acabado = true; est.activo = false; est.fase = 'fin';
      ui.instruccion(null);
      pipas.length = 0;
      const puntos = Math.round((1 - est.hp / est.vidaMax) * 1000 + (gana ? est.vidas * 250 + Math.max(0, 90 - est.tiempo) * 5 : 0));
      if (gana) {
        // KO: Perico cae y el palo vuelve a su dueña (a tu mano)
        perico?.pose('horror', { rebote: 0.3 });
        sonido('platillo', { volumen: 0.6 });
        fx.acierto(aMundo(centroPerico().clone()), { color: '#ffd23f', n: 40, sonido: null, fuerte: true });
        saltaTexto('¡PALO RECUPERADO!', '#ffe066', V(0, alto0 + 0.25, -1.2), 0.9);
        vibrar(1, 250);
        if (palo.parent !== sala) { palo.getWorldPosition(_t); palo.parent.remove(palo); sala.add(palo); palo.position.copy(aLocal(_t)); }
        est.caida = true;
      } else {
        perico?.pose('risa-floja', { rebote: 0.2 });
        sonido('deshinchar', { volumen: 0.6 });
        decir('Pin pin. Qué percha más bonita.');
      }
      const ganaMision = gana && puntos >= 1300;
      luego(1.9, () => ctx.terminar({
        puntos, gana: ganaMision,
        linea: gana ? 'Con el palo, Cotine baja al suelo. La tarta, entera. Bueno, casi.' : 'Perico se queda una percha preciosa. Pin pin.',
      }));
    }

    // ---------- arranque ----------
    pintarPanel();
    ctx.musica?.('jefe');
    luego(0.3, () => { sonido('fiuuu', { volumen: 0.4 }); });
    luego(1.3, () => { decir('Pin pin. Ahora es mi percha.'); saltaTexto('PERICO tiene tu palo', '#d0d4dc', V(0, alto0 + 0.35, -1.4), 0.7); });
    luego(2.6, () => {
      saltaTexto('¡A POR EL PALO!', '#ffe066', V(0, alto0 + 0.1, -1.2), 0.8);
      ui.instruccion('¡Lanza virutas! Un gesto rápido hacia Perico');
      // la mano fantasma: atrás junto al hombro y un empujón hacia Perico
      const a = aMundo(V(0.2, alto0 - 0.2, -0.05)), b = aMundo(V(0.18, alto0 - 0.05, -0.5));
      fx.demo([{ p: a }, { p: b }, { p: a }, { p: b }], { dur: 2.6, tramo: 0.32 });
    });
    luego(3.4, () => { est.activo = true; est.fase = 'juego'; sonido('pin-pin', { volumen: 0.4 }); });
    luego(8, () => { if (!acabado) ui.instruccion('Esquiva sus pipas o páralas con la mano'); });
    luego(12, () => { if (!acabado) ui.instruccion(null); });

    // ---------- por fotograma ----------
    const _p = V(), _sc = V();
    function pintar() {
      let n = 0;
      for (const b of virutas) {
        _q.setFromEuler(_e.set(b.rot, b.rot * 1.3, 0));
        virutasIM.setMatrixAt(n, _m4.compose(b.p, _q, _sc.setScalar(1))); virutasIM.setColorAt(n, _col.set(b.color)); n++;
      }
      virutasIM.count = n; virutasIM.instanceMatrix.needsUpdate = true; if (virutasIM.instanceColor) virutasIM.instanceColor.needsUpdate = true;
      n = 0;
      for (const p of pipas) {
        _q.setFromEuler(_e.set(p.rot, p.rot * 0.7, 0.4));
        pipasIM.setMatrixAt(n, _m4.compose(p.p, _q, _sc.set(0.03, 0.055, 0.02)));
        pipasT.setMatrixAt(n, _m4.compose(p.p, _q, _s.set(0.039, 0.065, 0.028))); n++;
      }
      pipasIM.count = pipasT.count = n; pipasIM.instanceMatrix.needsUpdate = true; pipasT.instanceMatrix.needsUpdate = true;
    }

    function actualizarJuego(dt) {
      est.tiempo += dt;
      est.invul = Math.max(0, est.invul - dt);
      gestos();
      const f = faseDe();
      if (f !== est.faseJefe) {
        est.faseJefe = f;
        saltaTexto(f === 2 ? '¡Fase 2!' : '¡Fase 3!', '#ffe066', V(0, alto0 + 0.4, -1.6), 0.6);
        sonido('sting', { volumen: 0.5 });
        decir(f === 2 ? 'Pin pin. Ahora de tres en tres.' : '¡Pin pin pin! ¡Mi percha!');
      }
      // Perico flota (si no está picando) y ataca según la fase
      if (perico && !est.picando) {
        const g = perico.grupo.position;
        const meta = V(Math.sin(est.tiempo * (0.55 + f * 0.12)) * 0.7, BASE.y + Math.sin(est.tiempo * (1 + f * 0.4)) * 0.32, Z_PERICO);
        g.lerp(meta, Math.min(1, dt * 3));
      }
      est.proximo -= dt;
      if (est.proximo <= 0 && !est.picando) {
        if (f === 1) { est.proximo = 1.6; escupir([0]); }
        else if (f === 2) { est.proximo = 1.5; escupir([-0.13, 0, 0.13]); }
        else if (Math.random() < 0.35 && perico) { est.proximo = 2.6; picado(); }
        else { est.proximo = 1.15; escupir([-0.24, -0.12, 0, 0.12, 0.24]); }
      }
      if (est.picando && est.picado) moverPicado(dt);

      // tus virutas
      const cP = centroPerico();
      for (let i = virutas.length - 1; i >= 0; i--) {
        const b = virutas[i];
        b.vida -= dt; b.rot += dt * 12;
        b.p.addScaledVector(b.v, dt);
        if (b.vida <= 0) { virutas.splice(i, 1); continue; }
        if (!est.picando && b.p.distanceTo(cP) < 0.4) {
          virutas.splice(i, 1);
          est.hp = Math.max(0, est.hp - 0.8); est.aciertos++;   // un puñado (4) = 3,2: unos 30 gestos que den
          tFlash = 0.08;
          perico?.empujon(0.05);
          if (est.aciertos % 3 === 0) { fx.chispas(aMundo(b.p.clone()), b.color, 6, 0.8); sonido('pop', { volumen: 0.25, tono: 1.2 + Math.random() * 0.4 }); }
          if (est.hp <= 0) { final(true); return; }
        }
      }
      // las pipas de Perico: te dan en la cabeza o las paras con la mano
      for (let i = pipas.length - 1; i >= 0; i--) {
        const p = pipas[i];
        p.p.addScaledVector(p.v, dt); p.rot += dt * 7;
        let parada = null;
        for (const k of MANOS) if (xr.manos[k].activa && L[k].pos.distanceTo(p.p) < 0.11) parada = k;
        if (parada) {
          pipas.splice(i, 1); est.paradas++;
          fx.acierto(aMundo(p.p.clone()), { mano: xr.manos[parada], color: '#f2e6c8', n: 10, sonido: null });
          sonido('bonk', { volumen: 0.4, tono: 1.2 + Math.random() * 0.3 });
          continue;
        }
        if (p.p.distanceTo(cab) < 0.15) { pipas.splice(i, 1); golpe(); if (acabado) return; continue; }
        if (p.p.z > cab.z + 1.2 || p.p.y < 0 || p.p.length() > 12) pipas.splice(i, 1);
      }
      pintarPanel();
    }

    const api = {
      est, pipas, virutas, aMundo, aLocal, centroPerico: () => centroPerico().clone(), cab,
      get acabado() { return acabado; },
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        fx.actualizar(dt);
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        leerCuerpo(dt);
        if (perico) {
          // entrada: llega volando desde lejos
          if (est.fase === 'intro') perico.grupo.position.lerp(BASE, Math.min(1, dt * 1.6));
          if (est.caida) { perico.grupo.position.y -= dt * 2.2; perico.grupo.rotation.z += dt * 3; if (perico.grupo.position.y < -3) perico.grupo.visible = false; }
          perico.actualizar(dt, xr.cabeza);
          tFlash = Math.max(0, tFlash - dt);
          perico.frente.material.color.set(tFlash > 0 ? '#ff9a9a' : '#ffffff');
        }
        // el palo vuelve a su dueña: flota delante de ti, a un lado (nunca a la cara)
        if (est.caida) {
          const meta = _p.set(0.32, alto0 - 0.3, -0.62);
          palo.position.lerp(meta, Math.min(1, dt * 3)); palo.rotation.z += (0.3 - palo.rotation.z) * Math.min(1, dt * 3);
        }
        if (est.activo && !acabado) actualizarJuego(dt);
        else for (let i = virutas.length - 1; i >= 0; i--) { const b = virutas[i]; b.vida -= dt; b.p.addScaledVector(b.v, dt); if (b.vida <= 0) virutas.splice(i, 1); }
        pintar();
        aLocal(xr.cabeza, _cam);
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.25; s.m.lookAt(_cam);
          s.m.material.opacity = Math.min(1, 3 * (1.4 - s.t));
          if (s.t > 1.4) { sala.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      abandonar() {
        if (acabado) return;
        acabado = true; est.activo = false; est.fase = 'fin'; ui.instruccion(null);
        decir('¿Te rindes? Pin pin. Lo sabía.');
        const puntos = Math.round((1 - est.hp / est.vidaMax) * 1000);
        ctx.terminar({ puntos, gana: false, linea: 'Lo dejas a medias. Perico se queda la percha.' });
      },
      destruir() {
        destruido = true; acabado = true; tareas.length = 0;
        fx.destruir();
        ui.instruccion(null);
        perico?.callar();
        for (const m of [virutasIM, pipasIM, pipasT]) m.dispose();
        for (const s of saltos) { s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); }
        for (const p of propias) p.dispose?.();
      },
    };
  },
};
