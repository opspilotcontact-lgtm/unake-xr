// Página de prueba del barrio (barrio.html): la maqueta en tu mesa; al tocar una sala, la cortinilla de humo y
// apareces dentro, a tamaño real; con la tarjeta «Volver a la maqueta», vuelta a la mesa.
// Arranque copiado de js/minijuegos/marco.js (sin tocarlo). Confort: la cámara no se mueve nunca; la sala
// aparece alrededor de ti, con el suelo en tu suelo y el fondo del dibujo hacia donde miras.
// ?mundo=normal|humo (por defecto, humo) · ?sala=<id> entra directo · ?emular con el emulador de Meta.
import * as THREE from 'three';
import { montarXR } from '../xr.js';
import { Humo } from '../humo.js';
import { UI } from '../ui.js';
import { Recortable } from '../recortable.js';
import { prepararAudio, sonido, letraLista, fijarAnisotropia } from '../recursos.js';
import { construirSala } from './proyeccion.js';
import { Maqueta } from './maqueta.js';
import { SALAS, CASAS, SOLO_HUMO, mundoDe } from './salas.js';

const FONDO_CASA = new THREE.Color('#e6dfd2');

export async function arrancarPagina() {
  const params = new URLSearchParams(location.search);
  const $ = id => document.getElementById(id);
  const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
  fijarAnisotropia(renderer.capabilities.getMaxAnisotropy());
  const escena = new THREE.Scene(); escena.background = FONDO_CASA.clone();
  const camara = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 120); camara.position.set(0, 1.6, 0); escena.add(camara);
  const oyente = new THREE.AudioListener(); camara.add(oyente);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
  // «tu casa» de mentira en el PC: suelo y una mesa
  const casa = new THREE.Group(); escena.add(casa);
  casa.add(new THREE.GridHelper(12, 24, '#8a8070', '#b9b0a0'));
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: '#a98b6a' })); mesa.position.set(0, 0.72, -0.75); casa.add(mesa);

  const ui = new UI(escena);
  let modo = null; // 'ar' | 'vr' | null (PC)
  const xr = montarXR(renderer, escena, camara, {
    alEntrar: m => { modo = m; $('portada').hidden = true; empezar(); },
    alSalir: () => { $('portada').hidden = false; },
    aviso: t => console.warn(t),
  });
  const humo = await Humo.crear(escena);
  await letraLista();

  const B = window.__barrio = {
    THREE, escena, renderer, xr, ui, humo, camara, t: 0, listo: false,
    estado: 'maqueta', sala: null, mundo: params.get('mundo') === 'normal' ? 'normal' : 'humo', errores: [],
  };
  const cache = new Map();   // id/mundo → sala montada (se reutiliza al volver)
  let maqueta = null, sala = null, gente = [], empezado = false, ocupado = false;

  function fondoEscena() {
    if (B.estado === 'sala') escena.background = sala?.cielo?.clone() || new THREE.Color(mundoDe(B.sala, B.mundo).cielo || '#141022');
    else escena.background = modo === 'ar' ? null : (B.mundo === 'humo' ? new THREE.Color('#1a1428') : FONDO_CASA.clone());
    casa.visible = B.estado === 'maqueta' && modo !== 'ar';
  }

  // ---------- la maqueta ----------
  async function ponerMaqueta() {
    if (!maqueta) {
      maqueta = await Maqueta.crear({ mundo: B.mundo, alEntrar: id => entrar(id) });
      escena.add(maqueta.grupo);
      B.maqueta = maqueta;
    }
    // sobre tu mesa real si la hay; si no, flotando delante, a la cintura
    const m = xr.mesaCerca() || (modo ? null : { punto: new THREE.Vector3(0, 0.74, -0.75) });
    let punto;
    if (m) punto = m.punto.clone().setY(m.punto.y + 0.012);
    else {
      const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
      punto = xr.cabeza.clone().addScaledVector(f, 0.6); punto.y = Math.max(0.6, xr.cabeza.y - 0.6);
    }
    maqueta.colocar(punto, xr.cabeza);
    maqueta.grupo.visible = true;
    tarjetasMaqueta();
  }
  function tarjetasMaqueta() {
    const otro = B.mundo === 'humo' ? 'De día' : 'De noche (humo)';
    const p = maqueta.grupo.localToWorld(new THREE.Vector3(0.36, 0.07, 0.2));
    const hacia = xr.cabeza.clone().sub(p).setY(0).normalize();
    ui.tarjetasEn([otro], p, hacia, async () => {
      B.mundo = B.mundo === 'humo' ? 'normal' : 'humo';
      sonido('whoosh', { volumen: 0.4 });
      await maqueta.cambiarMundo(B.mundo);
      fondoEscena(); tarjetasMaqueta();
    });
  }

  // ---------- entrar en una sala ----------
  async function montarSala(id) {
    const k = id + '/' + B.mundo;
    if (!cache.has(k)) cache.set(k, construirSala(mundoDe(id, B.mundo)));
    return cache.get(k);
  }
  async function entrar(id) {
    if (ocupado) return; ocupado = true;
    try {
      ui.quitarTarjetas();
      sonido('whoosh', { volumen: 0.6 });
      const nueva = await montarSala(id);   // se carga antes de la cortinilla: así no hay saltos tapados de más
      const personas = await genteDe(id);
      await new Promise(ok => humo.llenar(xr.cabeza.clone(), () => {
        if (maqueta) maqueta.grupo.visible = false;
        if (sala) escena.remove(sala.grupo);
        for (const r of gente) escena.remove(r.grupo);
        sala = nueva; B.sala = id; B.estado = 'sala';
        // tú en el sitio del ojo, mirando al fondo del dibujo; el suelo de la sala en tu suelo
        const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
        sala.grupo.position.copy(xr.cabeza).setY(0);
        sala.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), f);
        escena.add(sala.grupo); sala.actualizarProyector();
        gente = personas;
        for (const r of gente) { r.grupo.position.copy(sala.grupo.localToWorld(r.userData.local.clone())); escena.add(r.grupo); }
        fondoEscena();
        ok();
      }));
      setTimeout(() => tarjetaVolver(), 900);
    } catch (e) { console.error('[barrio] entrar', id, e); }
    ocupado = false;
  }
  // quién está en la sala (recortables a tamaño real en su sitio)
  async function genteDe(id) {
    const def = mundoDe(id, B.mundo), out = [];
    const s = await montarSala(id);
    for (const [quien, casaDe] of Object.entries(CASAS)) {
      if (casaDe !== id || (B.mundo !== 'humo' && SOLO_HUMO.includes(quien))) continue;
      const px = def.sitios?.[quien]; if (!px) continue;
      try {
        const r = await Recortable.crear(quien, B.mundo);
        r.userData = { local: s.sueloDe(px[0], px[1]).add(new THREE.Vector3(0, px[2] || 0, 0)) };
        out.push(r);
      } catch (e) { console.warn('[barrio] sin recortable', quien, e.message); }
    }
    return out;
  }
  function tarjetaVolver() {
    const f = xr.adelante.clone().setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const lado = new THREE.Vector3(-f.z, 0, f.x);
    const c = xr.cabeza.clone().addScaledVector(f, 0.5).addScaledVector(lado, -0.18); c.y = xr.cabeza.y - 0.3;
    ui.tarjetasEn(['Volver a la maqueta'], c, f.clone().negate(), () => volver());
  }
  function volver() {
    if (ocupado) return; ocupado = true;
    ui.quitarTarjetas(); sonido('whoosh', { volumen: 0.6 });
    humo.llenar(xr.cabeza.clone(), async () => {
      if (sala) escena.remove(sala.grupo);
      for (const r of gente) escena.remove(r.grupo);
      sala = null; gente = []; B.estado = 'maqueta';
      fondoEscena();
      await maqueta.ponerParadero(maqueta.paradero, B.sala);   // tu ficha (Vuper) se queda donde estabas
      await ponerMaqueta();
      ocupado = false;
    });
  }
  B.entrar = id => entrar(id);
  B.volver = () => volver();
  B.ponerMundo = async m => { B.mundo = m; cache.clear(); if (maqueta) await maqueta.cambiarMundo(m); fondoEscena(); };

  async function empezar() {
    if (empezado) return; empezado = true;
    try {
      await ponerMaqueta(); fondoEscena();
      if (params.get('sala') && SALAS[params.get('sala')]) entrar(params.get('sala'));
      B.listo = true;
    } catch (e) { console.error('[barrio] arranque', e); }
  }

  // en el PC: clic sobre un diorama (sin gafas)
  const rayo = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', ev => {
    if (xr.sesion || !maqueta || B.estado !== 'maqueta') return;
    rayo.setFromCamera(new THREE.Vector2(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1), camara);
    const id = maqueta.salaDelRayo(rayo); if (id) entrar(id);
  });

  B.arrancarPC = () => { $('portada').hidden = true; empezar(); };
  B.mirar = (x, y, z, yaw = 0, pitch = 0) => { camara.position.set(x, y, z); camara.rotation.set(pitch, yaw, 0, 'YXZ'); };
  B.coste = () => ({ llamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, texturas: renderer.info.memory.textures });

  $('btnAR').onclick = () => { prepararAudio(oyente); xr.entrar('ar'); };
  $('btnVR').onclick = () => { prepararAudio(oyente); xr.entrar('vr'); };
  $('btnPC').onclick = () => { prepararAudio(oyente); B.arrancarPC(); };
  navigator.xr?.isSessionSupported('immersive-ar').then(v => { $('btnAR').disabled = !v; }).catch(() => { });
  navigator.xr?.isSessionSupported('immersive-vr').then(v => { $('btnVR').disabled = !v; }).catch(() => { });

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop((t, frame) => {
    const dt = Math.min(0.05, reloj.getDelta()); B.t += dt;
    if (xr.sesion) xr.paso(frame, dt);
    else {
      xr.cabeza.copy(camara.position); xr.cabezaQ.copy(camara.quaternion); xr.adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
      if (B.bot) { try { B.bot(dt, xr.manos); } catch (e) { console.error('bot', e); B.bot = null; } }
    }
    const manos = [xr.manos.derecha, xr.manos.izquierda];
    try {
      if (maqueta?.grupo.visible) maqueta.actualizar(dt, manos, xr.cabeza);
      for (const r of gente) r.actualizar(dt, xr.cabeza);
      // humo que sube de la maqueta por la noche (de la puerta de Unaké): un poco de vida
      if (maqueta?.grupo.visible && B.mundo === 'humo' && Math.random() < dt * 1.2) {
        const d = maqueta.dioramas.dentro;
        if (d) humo.soltar({ pos: maqueta.grupo.localToWorld(d.grupo.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.09, 0))), vel: new THREE.Vector3(0, 0.03, 0), tam: 0.015, vida: 2.4, crece: 0.02, sube: 0.01, frena: 0.3, brillo: 0.5, alfa: 0.55 });
      }
      humo.mirarDesde(xr.cabeza); humo.actualizar(dt);
      ui.actualizar(dt, xr.cabeza, xr.cabezaQ, manos);
    } catch (e) { if (!B._err) { B._err = true; console.error('[barrio]', e); } }
    renderer.render(escena, camara);
  });
}
