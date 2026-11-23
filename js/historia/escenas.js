// Las escenas de la historia contadas en VR, con el lenguaje del cómic del 2D (escena_comic.js) llevado a tu sala:
//   · la viñeta del capítulo (base/assets/img/cap-*.jpg) de pie delante de ti, enmarcada en tinta, con su título;
//   · los que hablan, de pie a tu alrededor como recortables (js/recortable.js) con su bocadillo: UNA voz a la vez;
//   · el narrador, en cartucho amarillo sobre la viñeta; lo que dices tú (Vuper), en un bocadillo bajo, «Tú»;
//     lo que piensas (entre paréntesis), en bocadillo de pensamiento;
//   · el momento persona («se le limpian los ojos»): un halo detrás de quien se nombra; el último chiste del cierre,
//     con su rebote y su sonido.
// Se pasa con un pellizco o el gatillo (cualquier mano); si no tocas nada, avanza solo a ritmo de lectura.
// Nada se mueve con tu cabeza: la escena se queda quieta en el mundo donde empezó (confort).
//
//   const escenas = new Escenas({ escena, xr, mundo: () => J.mundo, prestados: { lasslow, blancaso } });
//   await escenas.contar(motor.tomarEscena(), { objetivos: () => motor.objetivos() }); motor.escenaContada();
//   en el bucle: escenas.actualizar(dt, [manoDer, manoIzq]);
import * as THREE from 'three';
import { Recortable } from '../recortable.js';
import { Bocadillo } from '../bocadillo.js';
import { img, sonido } from '../recursos.js';

const TINTA = '#140c1c', CREMA = '#fff3e6', AMARILLO = '#ffe066', ORO = '#ffd23f';
// Personajes con recortable horneado (assets/personajes/<id>): id de la historia → id del recortable.
const HORNEADOS = { lasslow: 'lasslow', blancaso: 'blancaso', perico: 'perico', pompa: 'la-pompa', palicaso: 'palicaso', puky: 'puky', cotine: 'cotine' };
// Los demás, cartón plano con su dibujo del 2D (base/assets/img): [humo, normal].
const PLANOS = { miron: ['miron', 'n-miron'], niebla: ['niebla', 'n-niebla'], casero: ['casero', 'n-casero'], agente: ['obj-agente', 'obj-agente'], monchiman: ['monchiman', 'monchiman'], madre: ['n-madre', 'n-madre'] };
const ALTO_PLANO = { humo: 0.95, normal: 1.6 };
const NOMBRES = { palicaso: 'Palicaso', blancaso: 'Blancaso', lasslow: 'Lasslow', perico: 'Perico', cotine: 'Cotine', pompa: 'La Pompa', puky: 'Puky', niebla: 'Niebla', miron: 'El Mirón', casero: 'El casero', agente: 'Agente del humo', monchiman: 'Monchiman', madre: 'La madre' };
const RE_NOMBRES = { blancaso: /Blancaso/, palicaso: /Palicaso/, lasslow: /Lasslow/, perico: /Perico/, cotine: /Cotine/, pompa: /Pompa/, puky: /Puky/, niebla: /Niebla/, casero: /casero/i, miron: /Mirón/, vuper: /Vuper/ };
const RE_MOMENTO = /limpian? los ojos/i;
// sala → nombre del fondo del 2D cuando no coincide (el reservado es el sofá)
const FONDO_SALA = { reservado: 'sofa' };
// las salas que tienen fondo de día (bgn-*.jpg); las demás (carretera, recuerdo…) usan el mismo de noche
const CON_DIA = ['bano', 'cocina', 'cuarto', 'dentro', 'feria', 'fuera', 'parque', 'plaza', 'sofa', 'tienda'];

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), t };
}
function envolver(ctx, texto, ancho) {
  const out = []; let l = '';
  for (const p of String(texto).split(' ')) { const s = l ? l + ' ' + p : p; if (ctx.measureText(s).width > ancho && l) { out.push(l); l = p; } else l = s; }
  if (l) out.push(l); return out;
}
function plano(w, h, t, extra = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, ...extra }));
}
const tiempoLectura = txt => Math.min(9, 2.2 + String(txt).length * 0.055);

// Un personaje sin recortable horneado: su dibujo del 2D en cartón, con bocadillo (misma interfaz que Recortable).
class Carton {
  static async crear(id, mundo) {
    const c = new Carton(id); await c.ponerMundo(mundo); return c;
  }
  constructor(id) {
    this.id = id; this.grupo = new THREE.Group(); this.cuerpo = new THREE.Group(); this.grupo.add(this.cuerpo);
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide }));
    this.cuerpo.add(this.malla); this.alto = 1; this.t = Math.random() * 6; this.rebote = 0; this.vRebote = 0;
  }
  async ponerMundo(mundo) {
    if (mundo === this.mundo) return;
    const [h, n] = PLANOS[this.id] || [this.id, this.id];
    let tex; try { tex = await img((mundo === 'humo' ? h : n) + '.png'); } catch { tex = await img(h + '.png'); }
    const alto = ALTO_PLANO[mundo] || 1.2, asp = tex.image.width / tex.image.height;
    this.malla.material.map = tex; this.malla.material.needsUpdate = true;
    this.malla.scale.set(alto * asp, alto, 1); this.malla.position.y = alto / 2; this.alto = alto; this.mundo = mundo;
  }
  pose() { return Promise.resolve(); }
  empujon(f = 0.15) { this.vRebote += f * 9; }
  decir(texto, { dur = 4 } = {}) {
    if (!this.bocadillo) { this.bocadillo = new Bocadillo(); this.grupo.add(this.bocadillo.malla); }
    this.bocadillo.mostrar(texto, dur); return Promise.resolve();
  }
  callar() { this.bocadillo?.ocultar(); }
  actualizar(dt, cam) {
    this.t += dt;
    this.vRebote += (-this.rebote * 160 - this.vRebote * 11) * dt; this.rebote += this.vRebote * dt;
    const sy = 1 + this.rebote + Math.sin(this.t * 1.5) * 0.01; this.cuerpo.scale.set(1 / Math.sqrt(Math.max(0.3, sy)), sy, 1);
    if (cam) { const p = this.grupo.getWorldPosition(_v); this.cuerpo.rotation.y = Math.atan2(cam.x - p.x, cam.z - p.z) - this.grupo.rotation.y; }
    this.bocadillo?.actualizar(dt, this.alto, cam, this.grupo);
  }
}

export class Escenas {
  // escena: THREE.Scene · xr: { cabeza, adelante } · mundo(): 'humo'|'normal' · prestados: recortables del director
  // que la escena usa en vez de crear otros (se devuelven donde estaban). rapido: para pruebas (sin esperas).
  constructor({ escena, xr, mundo = () => 'humo', prestados = {}, rapido = false } = {}) {
    Object.assign(this, { escena, xr, mundoDe: mundo, prestados, rapido });
    this.cache = new Map();
    this.activa = null;
    this.pedido = false;
    this.ayudaVista = 0;
  }
  get ocupada() { return !!this.activa; }
  get retenida() { return !!(this.activa && this.activa.espera && this.activa.espera.retenida && this.activa.espera.t > 0.6); }
  pasar() { this.pedido = true; if (this.activa && this.activa.espera) this.activa.espera.retenida = false; }

  // Cuenta una escena del motor ({ tipo, lineas, arte, capitulo, mundo, fondo, premio, final }). Promesa al acabar.
  async contar(esc, { objetivos = null } = {}) {
    if (!esc) return;
    if (this.activa) throw new Error('Ya hay una escena en curso');
    const mundo = esc.mundo || this.mundoDe() || 'humo';
    const A = this.activa = { esc, mundo, grupo: new THREE.Group(), actores: new Map(), texturas: [], t: 0 };
    A.grupo.name = 'escena-historia';
    this._colocar(A);
    this.escena.add(A.grupo);
    try {
      await this._montarViñeta(A);
      // los que hablan, de pie alrededor (como mucho 5; Vuper eres tú)
      const quienes = [...new Set(esc.lineas.map(l => l[0]).filter(q => HORNEADOS[q] || PLANOS[q]))].slice(0, 5);
      await this._montarActores(A, quienes);
      const ultimaHablada = esc.tipo === 'cierre' ? [...esc.lineas].reverse().find(l => HORNEADOS[l[0]] || PLANOS[l[0]]) : null;
      for (let i = 0; i < esc.lineas.length; i++) {
        const [quien, texto] = esc.lineas[i];
        A.idx = i; A.linea = esc.lineas[i];
        await this._linea(A, quien, texto, { objetivos, ultimoChiste: esc.lineas[i] === ultimaHablada, primera: i === 0 });
      }
      if (esc.tipo === 'cierre' && esc.premio) { this._cartucho(A, `+${esc.premio} monchis`, { color: '#8be78b' }); sonido('campanita', { volumen: 0.6 }); await this._esperar(A, 1.6, true); }
    } finally {
      this._desmontar(A);
      this.activa = null;
    }
  }

  // ---------- montaje ----------
  _colocar(A) {
    const cab = this.xr.cabeza.clone(), f = this.xr.adelante.clone().setY(0);
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
    f.normalize();
    A.origen = cab.clone().setY(0); A.f = f; A.lado = new THREE.Vector3(-f.z, 0, f.x); A.ojo = Math.max(1.1, cab.y);
    A.grupo.position.copy(A.origen);
    A.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), f);
  }
  async _montarViñeta(A) {
    const esc = A.esc, D = 2.4, W = 2.0;
    let tex = null;
    if (esc.arte) { try { tex = await img(esc.arte + '.jpg'); } catch { tex = null; } }
    else if (esc.sala) {
      // la sala de la escena, de día o de noche (los fondos del 2D: base/assets/img/bg-*.jpg y bgn-*.jpg)
      const f = FONDO_SALA[esc.sala] || esc.sala;
      const n = A.mundo === 'normal' && CON_DIA.includes(f) ? `bgn-${f}` : `bg-${f}`;
      try { tex = await img(`${n}.jpg`); } catch { tex = null; }
    }
    if (!tex && esc.capitulo && esc.capitulo.arte) { try { tex = await img(esc.capitulo.arte + '.jpg'); } catch { tex = null; } }
    const H = tex ? W * tex.image.height / tex.image.width : W * 0.56;
    const vin = new THREE.Group(); vin.position.set(0, A.ojo - 0.05, -D); A.grupo.add(vin); A.vineta = vin;
    // marco de tinta y papel (la viñeta de pie)
    const marco = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.09, H + 0.09), new THREE.MeshBasicMaterial({ color: TINTA })); marco.position.z = -0.01; vin.add(marco);
    const papel = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.05, H + 0.05), new THREE.MeshBasicMaterial({ color: '#fffaf0' })); papel.position.z = -0.005; vin.add(papel);
    const dib = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial(tex ? { map: tex } : { color: '#2a1f3a' }));
    vin.add(dib); A.dibujo = dib; A.W = W; A.H = H;
    // pies de la viñeta: dos patas de cartón, para que esté «de pie» en tu sala
    for (const s of [-1, 1]) { const pata = new THREE.Mesh(new THREE.BoxGeometry(0.05, vin.position.y - H / 2, 0.05), new THREE.MeshBasicMaterial({ color: '#8a6440' })); pata.position.set(s * W * 0.38, -(H / 2) - (vin.position.y - H / 2) / 2, -0.03); vin.add(pata); }
    // título (banda de arriba)
    const ti = lienzo(1024, 128); A.texturas.push(ti.t);
    const bw = W * 0.9, bh = bw / 8;
    const banda = plano(bw, bh, ti.t); banda.position.set(0, H / 2 + bh / 2 + 0.03, 0.02); banda.renderOrder = 30; vin.add(banda);
    A.titulo = { ...ti, malla: banda }; banda.visible = false;
    // aparece con un pequeño crecimiento (no se mueve la cámara)
    vin.scale.setScalar(0.85); A.crece = 0;
    sonido('whoosh', { volumen: 0.4 });
  }
  async _montarActores(A, quienes) {
    // en arco a tu alrededor, a los lados de la viñeta (que no la tapen)
    // la viñeta ocupa ±23°: ellos, de 42° hacia fuera (un cuerpo ancho ocupa ±11°), alternando lados
    const lados = [], R = 1.8;
    quienes.forEach((q, i) => { const izq = i % 2 === 0, k = Math.floor(i / 2); lados.push((izq ? -1 : 1) * (42 + k * 19) * Math.PI / 180); });
    await Promise.all(quienes.map(async (q, i) => {
      const a = await this._actor(q, A.mundo); if (!a) return;
      const ang = lados[i];
      const local = new THREE.Vector3(Math.sin(ang) * R, 0, -Math.cos(ang) * R);
      if (a.prestado) a.antes = { pos: a.grupo.position.clone(), quat: a.grupo.quaternion.clone(), visible: a.grupo.visible, padre: a.grupo.parent };
      A.grupo.add(a.grupo);
      a.grupo.position.copy(local);
      a.grupo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-local.x, 0, -local.z).normalize());
      a.grupo.visible = true;
      A.actores.set(q, a);
    }));
  }
  async _actor(q, mundo) {
    const pr = this.prestados[q];
    if (pr) { const mundoAntes = pr.mundo; await pr.ponerMundo(mundo); return { r: pr, grupo: pr.grupo, prestado: true, mundoAntes }; }
    const k = q + '/' + mundo;
    if (!this.cache.has(k)) this.cache.set(k, (HORNEADOS[q] ? Recortable.crear(HORNEADOS[q], mundo) : Carton.crear(q, mundo)).catch(e => { console.warn('[escenas] sin dibujo', q, e.message); return null; }));
    const r = await this.cache.get(k);
    return r ? { r, grupo: r.grupo, prestado: false } : null;
  }
  _desmontar(A) {
    if (A.halo) { A.halo.padre.remove(A.halo.malla); A.halo.malla.geometry.dispose(); A.halo.malla.material.dispose(); }
    for (const a of A.actores.values()) {
      a.r.callar?.(); a.r.mirar?.(null);
      if (a.prestado && a.antes) {
        (a.antes.padre || this.escena).add(a.grupo);
        a.grupo.position.copy(a.antes.pos); a.grupo.quaternion.copy(a.antes.quat); a.grupo.visible = a.antes.visible;
        if (a.mundoAntes && a.mundoAntes !== a.r.mundo) a.r.ponerMundo(a.mundoAntes); // los poscréditos del cap. 1 son de humo
      } else A.grupo.remove(a.grupo);
    }
    this.escena.remove(A.grupo);
    A.grupo.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); // las texturas de img() son de la caché: no se tocan
    for (const t of A.texturas) t.dispose();
  }

  // ---------- líneas ----------
  async _linea(A, quien, texto, { objetivos, ultimoChiste, primera }) {
    this._limpiarVoces(A);
    if (quien === 'titulo') {
      this._pintarTitulo(A, texto);
      if (primera) { await this._esperar(A, this.rapido ? 0.1 : 1.6, true); return; }
      this._cartucho(A, texto, { grande: true });
      return this._esperar(A, tiempoLectura(texto));
    }
    if (quien === 'objetivos') {
      const o = objetivos ? objetivos() : null;
      const lista = o ? [o.historia, ...o.otros].filter(Boolean).slice(0, 4) : [];
      if (!lista.length) return;
      this._cartucho(A, ['Lo que toca:', ...lista.map((x, i) => (i === 0 ? '★ ' : '· ') + x.corto)].join('\n'), { lista: true });
      return this._esperar(A, 3 + lista.length * 1.2);
    }
    if (quien === 'narrador') {
      this._cartucho(A, texto);
      if (RE_MOMENTO.test(texto)) this._momentoPersona(A, texto);
      return this._esperar(A, tiempoLectura(texto));
    }
    if (quien === 'vuper') {
      const piensa = /^\(.*\)$/.test(texto.trim());
      this._tuBocadillo(A, piensa ? texto.trim().slice(1, -1) : texto, piensa);
      return this._esperar(A, tiempoLectura(texto));
    }
    const a = A.actores.get(quien);
    if (a) {
      a.r.decir(texto, { dur: 60 });
      a.r.empujon?.(0.08);
      if (ultimoChiste) { a.r.empujon?.(0.3); sonido('tiroriro', { volumen: 0.45 }); }
      A.hablando = a;
    } else {
      // alguien sin dibujo: su nombre y su frase en el cartucho
      this._cartucho(A, `${NOMBRES[quien] || quien}: «${texto}»`);
    }
    return this._esperar(A, tiempoLectura(texto));
  }
  _limpiarVoces(A) {
    if (A.hablando) { A.hablando.r.callar?.(); A.hablando = null; }
    if (A.cartuchoM) { A.vineta.remove(A.cartuchoM); A.cartuchoM.geometry.dispose(); A.cartuchoM = null; }
    if (A.tuM) { A.grupo.remove(A.tuM); A.tuM.geometry.dispose(); A.tuM = null; }
  }
  _pintarTitulo(A, texto) {
    const { ctx, c, t, malla } = A.titulo;
    ctx.clearRect(0, 0, c.width, c.height);
    let tam = 60; ctx.font = `${tam}px Caprasimo, serif`;
    while (ctx.measureText(texto).width > c.width - 90 && tam > 30) { tam -= 4; ctx.font = `${tam}px Caprasimo, serif`; }
    const w = Math.min(c.width - 8, ctx.measureText(texto).width + 70);
    ctx.fillStyle = AMARILLO; ctx.strokeStyle = TINTA; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.roundRect((c.width - w) / 2, 12, w, 104, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = TINTA; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, c.width / 2, 66);
    t.needsUpdate = true; malla.visible = true;
  }
  // Cartucho del narrador: caja amarilla sobre la esquina de arriba de la viñeta (como en el cómic).
  _cartucho(A, texto, { grande = false, lista = false, color = AMARILLO } = {}) {
    const W = 1024, l = lienzo(W, 512); A.texturas.push(l.t);
    const { ctx } = l, tam = grande ? 64 : 54;
    ctx.font = `${tam}px Caprasimo, serif`;
    const lineas = String(texto).split('\n').flatMap(p => envolver(ctx, p, W - 90)).slice(0, Math.floor(460 / (tam * 1.18)));
    const alto = lineas.length * tam * 1.18 + 50;
    const ancho = Math.min(W - 10, Math.max(...lineas.map(x => ctx.measureText(x).width)) + 80);
    ctx.fillStyle = color; ctx.strokeStyle = TINTA; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.roundRect(5, 5, ancho, alto, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = TINTA; ctx.textBaseline = 'top'; ctx.textAlign = lista ? 'left' : 'left';
    lineas.forEach((x, i) => ctx.fillText(x, 42, 30 + i * tam * 1.18));
    l.t.needsUpdate = true;
    const mw = lista ? 1.7 : 1.3, mh = mw * 512 / W;
    const m = plano(mw, mh, l.t); m.renderOrder = 31;
    // arriba a la izquierda de la viñeta, por delante y un poco salido
    m.position.set(-A.W / 2 + mw / 2 - 0.06, A.H / 2 - mh / 2 + 0.08, 0.04);
    A.vineta.add(m); A.cartuchoM = m;
  }
  // Lo que dices tú: un bocadillo bajo, delante de ti, con «Tú»; lo que piensas, nube de pensamiento.
  _tuBocadillo(A, texto, piensa) {
    const W = 768, H = 300, l = lienzo(W, H); A.texturas.push(l.t);
    const { ctx } = l; let tam = 46; ctx.font = `${tam}px Caprasimo, serif`;
    let lineas = envolver(ctx, texto, W - 120);
    while (lineas.length > 3 && tam > 30) { tam -= 4; ctx.font = `${tam}px Caprasimo, serif`; lineas = envolver(ctx, texto, W - 120); }
    const alto = lineas.length * tam * 1.15 + 70, ancho = Math.min(W - 16, Math.max(...lineas.map(x => ctx.measureText(x).width)) + 90);
    const x0 = (W - ancho) / 2, y0 = 30;
    ctx.fillStyle = piensa ? '#eef0ff' : '#ffffff'; ctx.strokeStyle = TINTA; ctx.lineWidth = 8;
    if (piensa) ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.roundRect(x0, y0, ancho, alto, piensa ? 70 : 40); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (piensa) for (const [x, y, r] of [[W / 2 - 40, y0 + alto + 16, 14], [W / 2 - 70, y0 + alto + 42, 9]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // etiqueta «Tú»
    ctx.font = '30px Caprasimo, serif'; const et = piensa ? 'Piensas' : 'Tú';
    const ew = ctx.measureText(et).width + 30;
    ctx.fillStyle = '#9fd3ff'; ctx.beginPath(); ctx.roundRect(x0 + 18, y0 - 22, ew, 44, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = TINTA; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(et, x0 + 33, y0);
    ctx.font = `${tam}px Caprasimo, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lineas.forEach((x, i) => ctx.fillText(x, W / 2, y0 + 34 + i * tam * 1.15));
    l.t.needsUpdate = true;
    const mw = 0.72, m = plano(mw, mw * H / W, l.t, { depthTest: false }); m.renderOrder = 40;
    m.position.set(0, A.ojo - 0.36, -1.0);
    A.grupo.add(m); A.tuM = m;
  }
  // Momento persona: un halo cálido detrás de quien se nombra y la viñeta se apaga un poco.
  _momentoPersona(A, texto) {
    const id = Object.keys(RE_NOMBRES).find(k => RE_NOMBRES[k].test(texto));
    const a = id && A.actores.get(id);
    sonido('oooh', { volumen: 0.35 });
    if (A.dibujo.material.color) A.dibujo.material.color.setScalar(0.62);
    if (!a) return;
    const l = lienzo(256, 256); A.texturas.push(l.t);
    const g = l.ctx.createRadialGradient(128, 128, 10, 128, 128, 126); g.addColorStop(0, 'rgba(255,236,170,.95)'); g.addColorStop(1, 'rgba(255,236,170,0)');
    l.ctx.fillStyle = g; l.ctx.fillRect(0, 0, 256, 256); l.t.needsUpdate = true;
    const h = plano(1.3, 1.3, l.t); h.position.set(0, (a.r.alto || 1) * 0.6, -0.06); h.renderOrder = 0;
    a.grupo.add(h); A.halo = { malla: h, padre: a.grupo };
    a.r.empujon?.(0.2);
  }

  // Espera el tiempo de lectura o un pellizco/gatillo (o pasar()). `fijo`: no se puede saltar.
  // `retener(esc, i, linea)` (pruebas): si devuelve true, esa línea se queda hasta pasar() (para sacar la foto).
  _esperar(A, seg, fijo = false) {
    this.pedido = false;
    if (this.retener && this.retener(A.esc, A.idx, A.linea)) return new Promise(ok => { A.espera = { t: 0, seg: Infinity, fijo: false, retenida: true, ok }; });
    if (this.rapido) seg = Math.min(seg, 0.05);
    return new Promise(ok => { A.espera = { t: 0, seg: fijo ? seg : seg * 1.6 + 1, fijo, ok }; });
  }

  actualizar(dt, manos = []) {
    const A = this.activa; if (!A) return;
    A.t += dt;
    if (A.vineta && A.crece < 1) { A.crece = Math.min(1, A.crece + dt * 4); A.vineta.scale.setScalar(0.85 + 0.15 * (1 - Math.pow(1 - A.crece, 3))); }
    const cab = this.xr.cabeza;
    for (const a of A.actores.values()) if (!a.prestado) a.r.actualizar(dt, cab);
    // los prestados los sigue actualizando el director en su bucle (no se actualizan dos veces)
    if (A.tuM) A.tuM.lookAt(cab);
    const e = A.espera; if (!e) return;
    e.t += dt;
    const pellizco = manos.some(m => m && m.activa && m.empiezaPinza);
    if (pellizco) manos.forEach(m => m?.empiezaPinza && m.vibrar?.(0.3, 20));
    if (e.t >= e.seg || (!e.fijo && e.t > 0.35 && (pellizco || this.pedido))) {
      A.espera = null; this.pedido = false;
      e.ok();
    }
  }
}
const _v = new THREE.Vector3();
