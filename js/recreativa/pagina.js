// Página de prueba de la recreativa: maquina.html monta SOLO la máquina (con gafas o en el PC con manos simuladas
// por un bot, como minijuego.html). window.__maq expone lo necesario a herramientas/pruebas/maquina.mjs.
import * as THREE from 'three';
import { montarXR } from '../xr.js';
import { UI } from '../ui.js';
import { prepararAudio, sonido, musica, letraLista, fijarAnisotropia } from '../recursos.js';
import { Recreativa } from '../recreativa.js';
import { MANDOS, ALTO_BOTON } from './mueble.js';

export async function arrancarPagina() {
  const $ = id => document.getElementById(id);
  const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
  fijarAnisotropia(renderer.capabilities.getMaxAnisotropy());
  const escena = new THREE.Scene(); escena.background = new THREE.Color('#231a33');
  const camara = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 80); camara.position.set(0, 1.6, 0); escena.add(camara);
  const oyente = new THREE.AudioListener(); camara.add(oyente);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
  const suelo = new THREE.GridHelper(12, 24, '#6b5a85', '#3a2d4d'); escena.add(suelo);

  const ui = new UI(escena);
  let modo = null;
  const xr = montarXR(renderer, escena, camara, {
    alEntrar: m => { modo = m; $('portada').hidden = true; escena.background = m === 'ar' ? null : new THREE.Color('#231a33'); suelo.visible = m !== 'ar'; colocarDelante(); },
    alSalir: () => { $('portada').hidden = false; },
    aviso: t => console.warn(t),
  });
  await letraLista();
  const rec = new Recreativa({ escena, xr, ui, sonido, musica, mundo: 'humo' });
  const M = window.__maq = { rec, xr, ui, escena, THREE, renderer, camara, bot: null, t: 0, terminados: [], empezados: [] };
  rec.alEmpezar = clave => M.empezados.push(clave);
  rec.alTerminar = r => { M.terminados.push(r); if (!r.abandonado) ui.cartela(`${r.titulo || r.clave}: ${r.puntos} puntos`, 4); };
  function colocarDelante() { rec.acercar(xr.cabeza.clone().setY(1.6), xr.adelante.clone()); }
  rec.acercar(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));

  // puntos que ven las manos simuladas (en el PC no hay manos dibujadas)
  const bolas = ['izquierda', 'derecha'].map(l => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: l === 'izquierda' ? '#7ee081' : '#5fd3ff' }));
    b.visible = false; escena.add(b); return [l, b];
  });

  // ayudas para el bot: dónde está cada mando en el mundo
  M.donde = (k, alto = ALTO_BOTON + 0.03) => { const b = MANDOS[k]; return rec.panel.localToWorld(new THREE.Vector3(b.x, b.y, alto)); };
  M.bola = (dx = 0, dy = 0) => rec.panel.localToWorld(new THREE.Vector3(MANDOS.palanca.x + dx, MANDOS.palanca.y + dy, 0.125));
  M.centroPantalla = (u = 0.5, v = 0.5) => rec.pantalla.localToWorld(new THREE.Vector3((u - 0.5) * rec.pantalla.geometry.parameters.width, (v - 0.5) * rec.pantalla.geometry.parameters.height, 0));
  M.mirar = (x, y, z, yaw = 0, pitch = 0) => { camara.position.set(x, y, z); camara.rotation.set(pitch, yaw, 0, 'YXZ'); };
  M.medir = () => {
    rec.maquina.visible = false; renderer.render(escena, camara); const base = renderer.info.render.calls;
    rec.maquina.visible = true; renderer.render(escena, camara); return renderer.info.render.calls - base;
  };

  $('btnAR').onclick = () => { prepararAudio(oyente); xr.entrar('ar'); };
  $('btnVR').onclick = () => { prepararAudio(oyente); xr.entrar('vr'); };
  $('btnPC').onclick = () => { prepararAudio(oyente); $('portada').hidden = true; M.mirar(0, 1.6, 0, 0, -0.45); };
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
      rec.actualizar(dt, manos);
      ui.actualizar(dt, xr.cabeza, xr.cabezaQ, manos);
    } catch (e) { if (!M._err) { M._err = true; console.error('[maquina]', e); } }
    for (const [l, b] of bolas) { const m = xr.manos[l]; b.visible = !xr.sesion && m.activa; b.position.copy(m.punta); }
    renderer.render(escena, camara);
  });
}
