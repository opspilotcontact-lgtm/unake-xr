// Los lugares de los minijuegos, como en el 2D (base/js/lugares.js → LUGARES_MINIJUEGO, OBJETOS_LUGAR, lugaresDe):
// cada minijuego abierto vive en SU SITIO de una sala, en su mundo, y se juega allí:
//   · si el sitio es una persona (Perico, Palicaso, Cotine, Lasslow, Blancaso, la Pompa), tocándola;
//   · si es una cosa (la M del cuarto, el monitor del reservado, la lona de la feria, el banco de la plaza, la llave
//     del casero, la furgo…), tocando el objeto 3D que se monta aquí, con un brillo suave y un «Jugar» que no grita.
// Qué está abierto lo decide el 2D en el momento (lugaresDe(sitio, mundo) por el puente: abre(), MISIONES, noches).
//
// Nativos: si existe js/minijuegos/<id>.js (import dinámico) se juega en VR ahí mismo; si no, en la máquina con ★.
// Para enchufar un nativo nuevo basta con dejar su archivo: NATIVO_DE ya tiene su clave → id, y prepararNativos()
// lo apunta en NATIVOS (motor.js) para que la ★ de la historia también lo juegue en VR.
//
//   const L = new Lugares({ motor, img });
//   await L.montar(sala.grupo, salaId, mundo, colocar);   // colocar(x, y) → Vector3 local (px del dibujo del 2D)
//   en el bucle: const sitio = L.actualizar(dt, manos, cabeza);   // id del sitio tocado, o null
//   L.quitar();
import * as THREE from 'three';
import { NATIVOS } from '../historia/motor.js';

// clave del 2D → id del módulo nativo
export const NATIVO_DE = {
  Pipas: 'pipas', TiroPato: 'tiropato', Cuentas: 'cuentas', Casetas: 'casetas', Amarillo: 'amarillo', Furgo: 'furgo', Control: 'control',
  Barra: 'barra', Farol: 'farol', Tarta: 'tarta', Palo: 'palo', Periquito: 'periquito', Lasslow: 'lasslow', DJ: 'dj', Blancazo: 'blancazo',
  Sigilo: 'sigilo', Mirando: 'mirando', Inspeccion: 'inspeccion', Escucha: 'escucha',
  Tragaperras: 'tragaperras', Carrera: 'carrera',
};
// Las apuestas no están en la máquina: sin su módulo, «fuera de servicio».
export const APUESTAS = { Tragaperras: 'La tragaperras', Carrera: 'Carreras de humo' };
// Las personas que son sitio (ids del 2D); el resto de sitios son cosas (OBJETOS).
export const SITIOS_PERSONA = ['perico', 'palicaso', 'blancaso', 'pompa', 'cotine', 'lasslow'];

// ---------- ¿hay módulo nativo? ----------
const _existe = new Map();
const soloBase = () => /[?&]nativos=base\b/.test(location.search); // pruebas: solo los nativos de siempre
export function existeNativo(id) {
  if (!id) return Promise.resolve(false);
  if (!_existe.has(id)) _existe.set(id, import(`../minijuegos/${id}.js`).then(m => !!m?.default?.crear).catch(() => false));
  return _existe.get(id);
}
// El id nativo con el que se juega esa clave ahora mismo (o null → máquina).
export async function nativoDe(clave) {
  if (NATIVOS[clave]) return NATIVOS[clave];
  if (soloBase()) return null;
  const id = NATIVO_DE[clave];
  return id && await existeNativo(id) ? id : null;
}
// Al cargar: los módulos nuevos que ya estén se apuntan en NATIVOS (la ★ de la historia los juega en VR).
export async function prepararNativos() {
  if (soloBase()) return [];
  const nuevos = [];
  await Promise.all(Object.entries(NATIVO_DE).map(async ([clave, id]) => {
    if (NATIVOS[clave] || APUESTAS[clave]) return;
    if (await existeNativo(id)) { NATIVOS[clave] = id; nuevos.push(clave); }
  }));
  return nuevos;
}

// ---------- módulos de sala (API de tienda/hucha: new X({ motor, sonido, ui, xr }), montar, actualizar, quitar) ----------
// sala → [{ archivo, pos, hacia }] (coordenadas locales de la sala; tú entras en el origen mirando a −Z)
export const MODULOS_SALA = {
  cuarto: [{ archivo: './cuarto.js', nombre: 'cuarto', pos: [0, 0, 0], hacia: [0, 0, -1] }],
  // el bar del humo (unake.grupo): la casa de muñecas del negocio, junto al sofá
  bar: [{ archivo: './negocio.js', nombre: 'negocio', pos: [0.55, 0, -0.3], hacia: [0, 0, 0] }],
};
const _mods = new Map();
export function moduloSala(archivo) {
  if (soloBase()) return Promise.resolve(null); // pruebas: sin los módulos de sala nuevos
  if (!_mods.has(archivo)) {
    _mods.set(archivo, import(archivo).then(m => m.default || Object.values(m).find(v => typeof v === 'function' && /^[A-Z]/.test(v.name || '')) || null).catch(() => null));
  }
  return _mods.get(archivo);
}

// ---------- los objetos que alojan minijuegos (OBJETOS_LUGAR del 2D + las apuestas) ----------
// x, y: px del dibujo del 2D (1280×714). forma: cómo se hace en 3D. juegos: fijos (las apuestas, que no son MISIONES).
export const OBJETOS = {
  m: { sala: 'cuarto', mundo: 'humo', x: 640, y: 600, alto: 1.55, forma: 'm', nombre: 'La M' },
  puertacuarto: { sala: 'cuarto', mundo: 'humo', x: 1214, y: 600, forma: 'puerta', nombre: 'La puerta del cuarto' },
  monitor: { sala: 'reservado', mundo: 'humo', x: 1120, y: 650, forma: 'monitor', nombre: 'El monitor de vigilancia' },
  llave: { sala: 'dentro', mundo: 'humo', x: 470, y: 662, alto: 1.0, forma: 'llave', nombre: 'La llave del casero' },
  furgo: { sala: 'fuera', mundo: 'ambos', x: 470, y: 668, forma: 'furgo', nombre: 'La furgo de la aso' },
  tiro: { sala: 'feria', mundo: 'humo', x: 440, y: 520, forma: 'cartel', texto: 'Tiro al pato', nombre: 'La caseta del tiro al pato' },
  casetas: { sala: 'feria', mundo: 'humo', x: 880, y: 560, forma: 'cartel', texto: 'Casetas', nombre: 'Las casetas de la feria' },
  lona: { sala: 'feria', mundo: 'ambos', x: 190, y: 540, dia: { x: 320 }, forma: 'lona', nombre: 'La lona de la caseta antigua' },
  banco: { sala: 'plaza', mundo: 'ambos', x: 740, y: 530, forma: 'marca', nombre: 'El banco del Mirón' },
  tragaperras: { sala: 'tienda', mundo: 'ambos', x: 930, y: 560, forma: 'tragaperras', nombre: 'La tragaperras de Palicaso', juegos: ['Tragaperras'] },
  carrera: { sala: 'plaza', mundo: 'ambos', x: 420, y: 600, forma: 'pizarra', nombre: 'La pizarra de las carreras', juegos: ['Carrera'] },
};
// El bar del humo (Unaké) no es una sala del barrio: sus sitios van en coordenadas suyas.
export const SITIOS_BAR = { llave: [-0.75, 0, -2.3] };

// Minijuegos abiertos en un sitio y mundo (el orden de la tabla del 2D). mundo: 'humo' | 'normal'.
export function juegosDe(motor, sitio, mundo) {
  const o = OBJETOS[sitio];
  if (o?.juegos) return (o.mundo === 'ambos' || o.mundo === mundo) ? [...o.juegos] : [];
  try { return [...(motor?.d?.puente?.ev(`lugaresDe(${JSON.stringify(sitio)}, ${JSON.stringify(mundo)})`) || [])]; } catch { return []; }
}
// Nombre de un minijuego para su tarjeta
export function nombreJuego(motor, clave) { return APUESTAS[clave] || motor?.d?.MISIONES?.[clave]?.nombre || clave; }
// En qué sala vive cada clave según la tabla del 2D (para la maqueta y la guía)
export function salaDeClave(motor, clave) {
  const l = (motor?.d?.LUGARES_MINIJUEGO || []).find(x => x.clave === clave);
  if (l) return { sitio: l.sitio, sala: l.sala };
  const o = Object.entries(OBJETOS).find(([, v]) => v.juegos?.includes(clave));
  return o ? { sitio: o[0], sala: o[1].sala } : null;
}
// Todos los sitios del 2D (personas y cosas) con su sala de casa
export function todosLosSitios(motor) {
  const s = new Map();
  for (const l of motor?.d?.LUGARES_MINIJUEGO || []) if (!s.has(l.sitio)) s.set(l.sitio, l.sala);
  for (const [id, o] of Object.entries(OBJETOS)) if (!s.has(id)) s.set(id, o.sala);
  return s;
}

// ---------- el aspecto (cartón y tinta, como las latas del bar; 1-3 llamadas de dibujo cada uno) ----------
const TINTA = '#140c1c';
function mat(color) { return new THREE.MeshBasicMaterial({ color }); }
function conTinta(m, k = 1.06) { const t = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide })); t.scale.setScalar(k); m.add(t); return m; }
function lienzo(w, h, pintar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; pintar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cartel(texto, ancho, alto, { fondo = '#fff3c4', color = TINTA, fuente = 64 } = {}) {
  const t = lienzo(512, Math.round(512 * alto / ancho), (g, w, h) => {
    g.fillStyle = fondo; g.strokeStyle = TINTA; g.lineWidth = 14;
    g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 26); g.fill(); g.stroke();
    g.fillStyle = color; g.font = `${fuente}px Caprasimo, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texto, w / 2, h / 2 + 4, w - 40);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
}
let _texBrillo = null;
function texBrillo() {
  return _texBrillo || (_texBrillo = lienzo(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 3, 32, 32, 32); r.addColorStop(0, 'rgba(255,226,140,.9)'); r.addColorStop(1, 'rgba(255,226,140,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }));
}
let _texJugar = null;
function texJugar() {
  return _texJugar || (_texJugar = lienzo(256, 96, (g, w, h) => {
    g.fillStyle = 'rgba(20,12,28,.72)'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 40); g.fill();
    g.fillStyle = '#ffe9a8'; g.font = '52px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Jugar', w / 2, h / 2 + 3);
  }));
}

// Devuelve { g, golpe (malla para el rayo), centro (altura del brillo) }
function construir(forma, def) {
  const g = new THREE.Group(); let golpe, centro = 1.0;
  switch (forma) {
    case 'm': { // la M de Monchiman: letrero luminoso en la pared
      const t = lienzo(256, 256, (c, w, h) => { c.fillStyle = '#ffd23f'; c.strokeStyle = TINTA; c.lineWidth = 18; c.font = '230px Caprasimo, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText('M', w / 2, h / 2 + 14); c.fillText('M', w / 2, h / 2 + 14); });
      golpe = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
      centro = def.alto ?? 1.55; golpe.position.y = centro; g.add(golpe); break;
    }
    case 'puerta': {
      golpe = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.06), mat('#34406a')), 1.03); golpe.position.y = 1.0;
      const pomo = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#ffd23f')); pomo.position.set(0.3, 0, 0.05); golpe.add(pomo);
      centro = 1.1; g.add(golpe); break;
    }
    case 'monitor': {
      const pata = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.35), mat('#3b2a52'))); pata.position.y = 0.375;
      golpe = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.34), mat('#34304a'))); golpe.position.y = 0.95;
      const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), mat('#2e7a3c')); pant.position.z = 0.172; golpe.add(pant);
      g.add(pata, golpe); centro = 1.0; break;
    }
    case 'llave': {
      golpe = new THREE.Group();
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 20), mat('#ffd23f'));
      const cana = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), mat('#ffd23f')); cana.position.x = 0.13;
      const diente = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.02), mat('#ffd23f')); diente.position.set(0.18, -0.03, 0);
      golpe.add(aro, cana, diente); centro = def.alto ?? 1.0; golpe.position.y = centro; g.add(golpe); break;
    }
    case 'furgo': {
      golpe = conTinta(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.05, 0.95), mat('#fff6e8')), 1.02); golpe.position.y = 0.75;
      const franja = new THREE.Mesh(new THREE.BoxGeometry(2.01, 0.16, 0.96), mat('#5ad1ff')); golpe.add(franja);
      const luna = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.97), mat('#9fe7ff')); luna.position.set(0.62, 0.25, 0); golpe.add(luna);
      for (const x of [-0.6, 0.6]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 14), mat(TINTA)); r.rotation.x = Math.PI / 2; r.position.set(x, -0.52, 0); golpe.add(r); }
      g.add(golpe); centro = 1.2; break;
    }
    case 'tragaperras': {
      golpe = conTinta(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.45, 0.5), mat('#c0262e')), 1.03); golpe.position.y = 0.725;
      const pant = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), new THREE.MeshBasicMaterial({ map: lienzo(256, 150, (c, w, h) => { c.fillStyle = '#fff3c4'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0262e'; c.font = '96px Caprasimo, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7 7 7', w / 2, h / 2 + 6); }) }));
      pant.position.set(0, 0.28, 0.252); golpe.add(pant);
      const palanca = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), mat('#c8c8d0')); palanca.position.set(0.34, 0.2, 0); golpe.add(palanca);
      const bola = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#ffd23f')); bola.position.set(0.34, 0.42, 0); golpe.add(bola);
      g.add(golpe); centro = 1.1; break;
    }
    case 'pizarra': {
      for (const x of [-0.42, 0.42]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.04), mat('#8a6440')); p.position.set(x, 0.75, 0); g.add(p); }
      golpe = cartel('Carreras', 0.9, 0.6, { fondo: '#24402e', color: '#f4f0e0', fuente: 92 }); golpe.position.y = 1.15; g.add(golpe); centro = 1.15; break;
    }
    case 'cartel': {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), mat('#8a6440')); p.position.y = 0.6; g.add(p);
      golpe = cartel(def.texto || def.nombre, 0.7, 0.24); golpe.position.y = 1.3; g.add(golpe); centro = 1.3; break;
    }
    case 'lona': {
      golpe = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshBasicMaterial({ map: lienzo(256, 210, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#e8463a' : '#fff3e6'; c.fillRect(i * w / 8, 0, w / 8, h); } c.strokeStyle = TINTA; c.lineWidth = 10; c.strokeRect(0, 0, w, h); }), side: THREE.DoubleSide }));
      golpe.position.y = 1.25; g.add(golpe); centro = 1.25; break;
    }
    default: { // marca sobre algo ya pintado (el banco): una esfera invisible para el rayo
      golpe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); golpe.position.y = 0.55; g.add(golpe); centro = 0.75;
    }
  }
  return { g, golpe, centro };
}

export class Lugares {
  constructor({ motor } = {}) {
    this.motor = motor; this.lista = []; this.t = 0; this.espera = 0; this.rayo = new THREE.Raycaster(); this.rayo.far = 6;
  }

  // Monta los objetos con minijuegos abiertos de una sala. colocar(x, y) → Vector3 local del suelo (px del 2D).
  // fijos: { sitio: [x, y, z] } en coordenadas locales (el bar).
  montar(grupo, salaId, mundo, { colocar = null, fijos = null } = {}) {
    this.quitar();
    for (const [id, o] of Object.entries(OBJETOS)) {
      if (o.sala !== salaId || !(o.mundo === 'ambos' || o.mundo === mundo)) continue;
      if (fijos && !fijos[id]) continue;
      if (!o.juegos && !juegosDe(this.motor, id, mundo).length) continue;
      if (id === 'llave') { try { if (this.motor?.d?.puente?.ev('enCap("inspeccion")')) continue; } catch { /* sin capítulo */ } }
      const { g, golpe, centro } = construir(o.forma, o);
      const p = fijos ? new THREE.Vector3(...fijos[id]) : colocar((mundo === 'normal' && o.dia?.x) || o.x, (mundo === 'normal' && o.dia?.y) || o.y);
      g.position.copy(p);
      // de cara a ti (al origen de la sala), solo en horizontal
      g.rotation.y = Math.atan2(-p.x, -p.z);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
      halo.scale.setScalar(o.forma === 'furgo' ? 1.6 : 0.7); halo.position.y = centro; g.add(halo);
      const jugar = new THREE.Sprite(new THREE.SpriteMaterial({ map: texJugar(), transparent: true, depthWrite: false, opacity: 0 }));
      jugar.scale.set(0.22, 0.083, 1); jugar.position.y = centro + (o.forma === 'furgo' ? 0.75 : 0.42); jugar.renderOrder = 30; g.add(jugar);
      g.name = 'lugar-' + id;
      grupo.add(g);
      this.lista.push({ id, def: o, g, golpe, halo, jugar, centro, fase: Math.random() * 6 });
    }
    return this.lista;
  }
  quitar() {
    for (const k of this.lista) {
      k.g.parent?.remove(k.g);
      k.g.traverse(o => { o.geometry?.dispose?.(); if (o.material) { const m = o.material; if (m.map && m.map !== _texBrillo && m.map !== _texJugar) m.map.dispose(); m.dispose(); } });
    }
    this.lista = [];
  }
  get(id) { return this.lista.find(k => k.id === id) || null; }

  // Brillo que respira despacio; el «Jugar» solo de cerca (< 2,4 m) o al señalarlo. Devuelve el sitio tocado.
  actualizar(dt, manos, cabeza, { puede = true } = {}) {
    this.t += dt; this.espera = Math.max(0, this.espera - dt);
    let tocado = null;
    const _p = new THREE.Vector3();
    for (const k of this.lista) {
      k.fase += dt;
      k.halo.material.opacity = 0.18 + 0.12 * Math.sin(k.fase * 1.6);
      const p = k.g.localToWorld(_p.set(0, k.centro, 0));
      const d = cabeza ? p.distanceTo(cabeza) : 9;
      let señalado = false;
      for (const m of manos) {
        if (!m.activa) continue;
        const dir = m.esMano ? m.punta.clone().sub(cabeza).normalize() : new THREE.Vector3(0, 0, -1).applyQuaternion(m.quat);
        this.rayo.set(m.esMano ? cabeza : m.pos, dir);
        const da = this.rayo.intersectObject(k.golpe, true).length > 0;
        if (da) señalado = true;
        if (!puede || this.espera > 0 || tocado) continue;
        const cerca = m.punta.distanceTo(p) < (k.def.forma === 'furgo' ? 0.7 : k.def.forma === 'marca' ? 0.45 : 0.3);
        if (cerca || (da && m.empiezaPinza)) { tocado = k.id; m.vibrar?.(0.4, 40); }
      }
      const meta = puede && (d < 2.4 || señalado) ? 0.85 : 0;
      k.jugar.material.opacity += (meta - k.jugar.material.opacity) * Math.min(1, dt * 4);
      k.jugar.visible = k.jugar.material.opacity > 0.02;
    }
    if (tocado) this.espera = 2.5;
    return tocado;
  }
}
