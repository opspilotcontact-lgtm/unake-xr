// Marco de los minijuegos NATIVOS (VR de verdad, no el puente): monta lo común (render, gafas, manos, humo,
// interfaz, física, agarre) y le pasa al minijuego un `ctx`. El mismo marco sirve:
//   · solo, en minijuego.html?m=<nombre> (para hacerlo y probarlo con su bot), y
//   · dentro del juego (app.js lo llama con su propio ctx).
// Contrato del módulo en docs/minijuegos.md.
import * as THREE from 'three';
import { montarXR } from '../xr.js';
import { Humo } from '../humo.js';
import { UI } from '../ui.js';
import { Fisica, Agarre } from '../fisica.js';
import { Recortable } from '../recortable.js';
import { prepararAudio, sonido, musica, textura, img, letraLista, fijarAnisotropia } from '../recursos.js';

export function estrellasDe(umbrales, puntos) { return umbrales.filter(u => puntos >= u).length; }

// ---------- página de prueba: minijuego.html?m=pipas ----------
export async function arrancarPagina() {
  const nombre = new URLSearchParams(location.search).get('m');
  const $ = id => document.getElementById(id);
  const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
  fijarAnisotropia(renderer.capabilities.getMaxAnisotropy());
  const escena = new THREE.Scene(); escena.background = new THREE.Color('#e6dfd2');
  const camara = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 80); camara.position.set(0, 1.6, 0); escena.add(camara);
  const oyente = new THREE.AudioListener(); camara.add(oyente);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
  // «tu casa» de mentira en el PC: suelo, una mesa y una pared (como planos de las gafas)
  const casa = new THREE.Group(); escena.add(casa);
  casa.add(new THREE.GridHelper(12, 24, '#8a8070', '#b9b0a0'));
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: '#a98b6a' })); mesa.position.set(0, 0.72, -0.85); casa.add(mesa);
  const PLANOS_PC = [
    { orientacion: 'horizontal', centro: new THREE.Vector3(0, 0.74, -0.85), ancho: 1.2, largo: 0.7, matriz: new THREE.Matrix4().makeTranslation(0, 0.74, -0.85) },
    { orientacion: 'vertical', centro: new THREE.Vector3(0, 1.3, -3.2), ancho: 5, largo: 2.6, matriz: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.3, -3.2) },
  ];

  const ui = new UI(escena);
  let modo = null;
  const xr = montarXR(renderer, escena, camara, {
    alEntrar: m => { modo = m; $('portada').hidden = true; escena.background = m === 'ar' ? null : new THREE.Color('#e6dfd2'); casa.visible = m !== 'ar'; empezar(); },
    alSalir: () => { $('portada').hidden = false; },
    aviso: t => console.warn(t),
  });
  const humo = await Humo.crear(escena);
  const fisica = new Fisica(), agarre = new Agarre(fisica);
  await letraLista();
  const mod = (await import(`./${nombre}.js`)).default;
  document.title = 'UNAKÉ XR · ' + mod.titulo;
  $('titulo').textContent = mod.titulo;

  const M = window.__mj = { nombre, mod, resultado: null, resultados: [], xr, fisica, agarre, ui, humo, escena, THREE, renderer, bot: null, t: 0 };
  let inst = null;
  const ctx = {
    THREE, escena, xr, humo, ui, fisica, agarre, sonido, musica, textura, img, Recortable,
    get modo() { return modo; },
    // dónde está tu suelo, tu mesa y lo que tienes delante
    delante: (d = 1, alto = null) => { const f = xr.adelante.clone().setY(0).normalize(); const p = xr.cabeza.clone().addScaledVector(f, d); p.y = alto ?? 0; return p; },
    mesa: () => xr.mesaCerca() || (modo ? null : { punto: new THREE.Vector3(0, 0.74, -0.85) }),
    terminar: ({ puntos, gana = true, linea = '' }) => {
      const n = estrellasDe(mod.umbrales, puntos);
      M.resultado = { clave: mod.clave, puntos, gana, estrellas: n }; M.resultados.push(M.resultado);
      ui.cartela(`${mod.titulo}: ${puntos} puntos · ${'★'.repeat(n)}${'☆'.repeat(3 - n)}${linea ? ' · ' + linea : ''}`, 6);
      sonido(n >= 2 ? 'oooh' : 'campanita', { volumen: 0.6 });
      setTimeout(() => {
        const f = xr.adelante.clone().setY(0).normalize();
        const c = xr.cabeza.clone().addScaledVector(f, 0.45); c.y = xr.cabeza.y - 0.25;
        ui.tarjetasEn(['Otra vez', 'Salir'], c, f.clone().negate(), t => { if (t === 'Otra vez') reiniciar(); else xr.sesion?.end(); });
      }, 1800);
    },
  };
  async function empezar() {
    if (modo === 'ar' || modo === null) setInterval(() => { if (modo === 'ar') fisica.planosDesdeXR(xr.planos); }, 1000);
    if (!modo) fisica.planosDesdeXR(PLANOS_PC);
    inst = await mod.crear(ctx);
    escena.add(inst.grupo);
  }
  async function reiniciar() {
    if (inst) { inst.destruir?.(); escena.remove(inst.grupo); }
    M.resultado = null;
    inst = await mod.crear(ctx); escena.add(inst.grupo);
  }
  M.reiniciar = reiniciar;
  M.arrancarPC = () => { $('portada').hidden = true; empezar(); };
  M.mirar = (x, y, z, yaw = 0, pitch = 0) => { camara.position.set(x, y, z); camara.rotation.set(pitch, yaw, 0, 'YXZ'); };

  $('btnAR').onclick = () => { prepararAudio(oyente); xr.entrar('ar'); };
  $('btnVR').onclick = () => { prepararAudio(oyente); xr.entrar('vr'); };
  navigator.xr?.isSessionSupported('immersive-ar').then(v => { $('btnAR').disabled = !v; }).catch(() => { });
  navigator.xr?.isSessionSupported('immersive-vr').then(v => { $('btnVR').disabled = !v; }).catch(() => { });

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop((t, frame) => {
    const dt = Math.min(0.05, reloj.getDelta()); M.t += dt;
    if (xr.sesion) xr.paso(frame, dt);
    else {
      xr.cabeza.copy(camara.position); xr.cabezaQ.copy(camara.quaternion); xr.adelante.set(0, 0, -1).applyQuaternion(camara.quaternion);
      if (M.bot) { try { M.bot(dt, xr.manos); } catch (e) { console.error('bot', e); M.bot = null; } }
    }
    const manos = [xr.manos.derecha, xr.manos.izquierda];
    try {
      agarre.actualizar(dt, manos);
      fisica.actualizar(dt);
      inst?.actualizar(dt);
      humo.mirarDesde(xr.cabeza); humo.actualizar(dt);
      ui.actualizar(dt, xr.cabeza, xr.cabezaQ, manos);
    } catch (e) { if (!M._err) { M._err = true; console.error('[minijuego]', e); } }
    renderer.render(escena, camara);
  });
}
