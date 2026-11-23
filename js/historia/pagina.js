// Página de prueba del motor de historia (historia.html): arranca en el capítulo N (?cap=N), cuenta las escenas en
// VR, enseña la muñeca y deja simular con botones del PC lo que el director (app.js) avisaría.
//   ?cap=N    empezar en el capítulo N (0-16) con lo que dejan los anteriores
//   ?nuevo    partida nueva (si no, sigue la guardada en 'unake-xr-partida' de este origen)
//   ?humo     escenas en el mundo humo (por defecto, el normal)
//   ?rapido   sin esperas de lectura (las pruebas)
// Teclado: espacio = pasar viñeta · O = cumplir objetivo · B = botón del objetivo · M = plegar/desplegar la muñeca.
import * as THREE from 'three';
import { montarXR } from '../xr.js';
import { UI } from '../ui.js';
import { Recortable } from '../recortable.js';
import { prepararAudio, letraLista, fijarAnisotropia } from '../recursos.js';
import { MotorHistoria, RECREATIVA } from './motor.js';
import { Escenas } from './escenas.js';
import { MunecaHistoria } from './muneca.js';

const q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const H = window.__hist = { listo: false, log: [], errores: [] };
const log = (...x) => { const t = x.join(' '); H.log.push(t); const el = $('log'); if (el) { el.textContent = t + '\n' + el.textContent.slice(0, 1400); } console.log('[historia]', t); };

export async function arrancar() {
  const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.xr.enabled = true;
  fijarAnisotropia(renderer.capabilities.getMaxAnisotropy());
  const escena = new THREE.Scene();
  const humo = q.has('humo');
  escena.background = new THREE.Color(humo ? '#231a33' : '#e6dfd2');
  const camara = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 80); camara.position.set(0, 1.6, 0); escena.add(camara);
  const oyente = new THREE.AudioListener(); camara.add(oyente);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
  escena.add(new THREE.GridHelper(12, 24, humo ? '#4a3a66' : '#8a8070', humo ? '#3a2d4f' : '#b9b0a0'));
  const xr = montarXR(renderer, escena, camara, { alEntrar() { $('portada').hidden = true; }, alSalir() { $('portada').hidden = false; }, aviso: t => log(t) });
  const ui = new UI(escena);
  await letraLista();

  log('cargando el 2D en el puente…');
  const motor = await MotorHistoria.crear({ nueva: q.has('nuevo') });
  if (q.has('cap')) motor.irA(Number(q.get('cap')) || 0);
  else motor.tic();
  const mundo = { v: humo ? 'humo' : 'normal' };
  motor.avisar('mundo', { mundo: mundo.v });

  // los dos colegas del director, prestados a las escenas (como en app.js)
  const lasslow = await Recortable.crear('lasslow', mundo.v), blancaso = await Recortable.crear('blancaso', mundo.v);
  lasslow.grupo.position.set(-0.7, 0, -1.4); blancaso.grupo.position.set(0.7, 0, -1.4);
  escena.add(lasslow.grupo, blancaso.grupo);
  const escenas = new Escenas({ escena, xr, mundo: () => mundo.v, prestados: { lasslow, blancaso }, rapido: q.has('rapido') });

  // una mano izquierda de mentira, delante y abajo a la izquierda, con el colocón y la muñeca de la historia
  const manoIzq = { grupo: new THREE.Group(), activa: true, punta: new THREE.Vector3(), lado: 'izquierda' };
  manoIzq.grupo.rotation.x = Math.PI / 2.4; // el dorso hacia ti
  escena.add(manoIzq.grupo);
  const lejos = () => { manoIzq.grupo.position.set(-0.3, 1.18, -0.55); };
  // de cerca: el reloj delante de los ojos (el grupo de la mano gira 75°: el antebrazo baja hacia ti)
  const cerca = () => { manoIzq.grupo.position.set(0, 1.68, -0.3); };
  lejos();
  const manoDer = { activa: true, punta: new THREE.Vector3(9, 9, 9), empiezaPinza: false, vibrar() { } };
  const muneca = new MunecaHistoria({ motor, alPulsar: o => { const r = motor.hacer(o.accion); log('botón:', o.corto, '→', r ? JSON.stringify(r) : 'lo hace el motor'); } });
  ui.colocon(humo ? 45 : 12, manoIzq);

  motor.on('alEmpezarCapitulo', e => log('▶ empieza', e.cap.etiqueta, e.cap.titulo));
  motor.on('alCumplirObjetivo', e => log('✓', e.objetivo.texto));
  motor.on('alAcabarCapitulo', e => log('■ acaba', e.cap.etiqueta, e.cap.titulo, '+' + e.premio, e.final ? '(FINAL)' : ''));
  motor.on('alPista', p => log('pista de', p.de + ':', p.texto));
  motor.on('alCobro', c => log('cobro', c.clave, '+' + c.monchis, c.situacion || ''));

  // el «director» de la página: escenas cuando está libre
  const contar = () => {
    if (escenas.ocupada || !motor.escenaPendiente) return;
    const e = motor.tomarEscena();
    escenas.contar(e, { objetivos: () => motor.objetivos() }).catch(err => { console.error(err); H.errores.push(String(err)); }).finally(() => motor.escenaContada());
  };

  const estado = () => {
    const o = motor.objetivos(), n = motor.necesidades();
    return { cap: o.cap, historia: o.historia && { id: o.historia.id, texto: o.historia.corto, como: o.historia.como, accion: o.historia.accion }, otros: o.otros.length, escena: escenas.activa ? escenas.activa.esc.tipo : null, pendiente: !!motor.escenaPendiente, ...n, acabada: motor.acabada };
  };
  const pintarEstado = () => {
    const s = estado();
    $('estado').textContent = `Cap. ${s.cap.etiqueta} · ${s.cap.titulo}\n${s.escena ? 'Escena: ' + s.escena : s.historia ? '★ ' + s.historia.texto + ' [' + s.historia.como + ']' : '—'}\nMonchis ${s.monchis} · Hucha ${s.hucha} · Hambre ${Math.round(s.hambre)} · Vida ${Math.round(s.vida)}\nPapel ${s.inv.papel} · Boquilla ${s.inv.boquilla} · Bolsita ${s.inv.bolsita} · Mechero ${s.inv.mechero ? 'sí' : 'no'}`;
  };
  motor.on('alCambiar', pintarEstado);

  // ---------- botones del PC ----------
  const sel = $('clave'); for (const c of ['Pipas', 'TiroPato', ...RECREATIVA]) sel.add(new Option(c, c));
  const acciones = {
    pasar: () => escenas.pasar(),
    cumplir: () => { const o = motor.simularObjetivo(); log('simulado:', o ? o.corto : 'nada'); },
    boton: () => { const o = motor.objetivos().historia; if (o) { const r = motor.hacer(o.accion); log('botón →', r ? JSON.stringify(r) : 'lo hace el motor'); } },
    gana: () => motor.avisar('minijuego', { clave: sel.value, puntos: 1500, gana: true }),
    pierde: () => motor.avisar('minijuego', { clave: sel.value, puntos: 80, gana: false }),
    liar: () => motor.avisar('liar'), calada: () => motor.avisar('calada', { nivel: 2 }),
    pase: () => motor.avisar('pase', { a: 'blancaso' }), puerta: () => motor.avisar('puerta'),
    humo: () => { mundo.v = mundo.v === 'humo' ? 'normal' : 'humo'; motor.avisar('mundo', { mundo: mundo.v }); escena.background.set(mundo.v === 'humo' ? '#231a33' : '#e6dfd2'); lasslow.ponerMundo(mundo.v); blancaso.ponerMundo(mundo.v); log('mundo', mundo.v); },
    sala: () => motor.avisar('sala', { id: $('sala').value }),
    hucha: () => motor.avisar('hucha', { monchis: 50 }),
    monchis: () => motor.avisar('entrega', { pago: 100 }),
    seguir: () => motor.saltar(),
    papel: () => log('comprar papel', JSON.stringify(motor.comprar('papel'))),
    mejorar: () => log('mejorar', JSON.stringify(motor.mejorar())),
    caja: () => log('caja', JSON.stringify(motor.cobrarCaja())),
    muneca: () => (muneca.plegada ? muneca.desplegar() : muneca.plegar()),
    cerca: () => { H.cerca = !H.cerca; (H.cerca ? cerca : lejos)(); },
    reiniciar: () => motor.reiniciar(),
  };
  document.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { prepararAudio(oyente); acciones[b.dataset.a](); }));
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); acciones.pasar(); }
    if (e.code === 'KeyO') acciones.cumplir();
    if (e.code === 'KeyB') acciones.boton();
    if (e.code === 'KeyM') acciones.muneca();
  });
  $('btnVR').onclick = () => { prepararAudio(oyente); xr.entrar('vr'); };
  navigator.xr?.isSessionSupported('immersive-vr').then(v => { $('btnVR').disabled = !v; }).catch(() => { });

  const reloj = new THREE.Clock();
  renderer.setAnimationLoop((t, frame) => {
    const dt = Math.min(0.05, reloj.getDelta());
    if (xr.sesion) xr.paso(frame, dt);
    else { xr.cabeza.copy(camara.position); xr.cabezaQ.copy(camara.quaternion); xr.adelante.set(0, 0, -1).applyQuaternion(camara.quaternion); }
    const manos = xr.sesion ? [xr.manos.derecha, xr.manos.izquierda] : [manoDer];
    try {
      motor.paso(dt, { colocon: mundo.v === 'humo' ? 45 : 10 });
      contar();
      escenas.actualizar(dt, manos);
      for (const p of [lasslow, blancaso]) p.actualizar(dt, xr.cabeza);
      muneca.actualizar(dt, xr.sesion ? xr.manos.izquierda : manoIzq, xr.sesion ? xr.manos.derecha : manoDer);
      ui.actualizar(dt, xr.cabeza, xr.cabezaQ, manos);
    } catch (e) { if (!H._err) { H._err = true; console.error('[historia] bucle', e); } }
    renderer.render(escena, camara);
  });

  Object.assign(H, { motor, escenas, muneca, acciones, estado, THREE, camara, listo: true });
  pintarEstado();
  log('listo');
}
