// El barrio vivo (base/js/rutinas.js y escenas/barrio.js del 2D, en 3D):
//   · el PARADERO: cada uno está en un solo sitio. Los visitantes del 2D (Cotine, Lasslow, Blancaso, Puky) salen de
//     su casa de visita a otra sala (VISITAS), tardan en llegar, se quedan un rato y vuelven. Se guarda en el ESTADO
//     del 2D (ESTADO.paradero, el mismo formato: { sala, llega, hasta, desde }), así que la maqueta y la guía lo ven.
//     No sale quien tenga una situación, un encargo o una misión de la historia pendiente (te espera en su sitio).
//   · las RUTINAS: cada pocos segundos alguien da unos pasos por su sitio o hace lo suyo (ACTIVIDADES: Perico come
//     pipas, Lasslow suelta uno disimulado y los de al lado se dan cuenta, Blancaso suda con las cuentas…).
//   · las CHARLAS entre ellos cuando coinciden y estás cerca (DIALOGOS del 2D y los del capítulo), una voz cada vez;
//     si no, alguien suelta su tontería. Cuando hablas tú con alguien, el ambiente se calla.
//   · SUCESOS ligeros de noche: la lluvia de humo morado (sube un poco el colocón).
//
//   const V = new Vida({ motor, humo, sonido });
//   V.agenda({ sala, mundo, retener }) → eventos [{ tipo: 'sale'|'llega', id, de, a }]    (cada segundo)
//   V.paso(dt, { personas: [{ id, r }], cabeza, mundo, libre }) → 'lluvia' | null           (cada fotograma)
//   V.andar(r, destinoMundo, alLlegar)   V.callar()   V.estaEn(id, sala)   V.dondeEsta(id)
import * as THREE from 'three';
import { CASAS as CASAS_HIST } from '../historia/motor.js';

export const VISITANTES = ['cotine', 'lasslow', 'blancaso', 'puky'];
const VIAJE_MS = 9000;
const PRIMERA_VISITA_S = 120; // al empezar, nadie se va hasta pasados 2 min (que la gente esté donde la buscas)
const al = xs => xs[Math.floor(Math.random() * xs.length)];
const entre = (a, b) => a + Math.random() * (b - a);
export const id2d = id => (id === 'la-pompa' ? 'pompa' : id);
export const idXR = id => (id === 'pompa' ? 'la-pompa' : id);
// quietos de noche (en el 2D: la Pompa colgada del techo, Perico en la mirilla)
const QUIETOS_HUMO = ['pompa', 'perico'];

export class Vida {
  constructor({ motor, humo, sonido = () => { } }) {
    Object.assign(this, { motor, humo, sonido });
    this.t = 0; this.proxVisita = Date.now() + PRIMERA_VISITA_S * 1000;
    this.tRutina = 4; this.tCharla = 8; this.tSuceso = entre(50, 90);
    this.vozLibre = 0; this.timers = []; this.andando = new Map(); this.casaPos = new WeakMap();
  }
  get d() { return this.motor?.d; }
  get E() { return this.motor?.E; }
  get paradero() { const E = this.E; if (!E) return {}; return (E.paradero = E.paradero || {}); }

  // ---------- el paradero (rutinas.js → casaDe, dondeEsta, estaEn, agendaVisitas) ----------
  casaDe(id) { return CASAS_HIST[id] || null; }
  dondeEsta(id) { const p = this.paradero[id]; return p ? p.sala : this.casaDe(id); }
  estaEn(id, sala) {
    const p = this.paradero[id];
    if (!p) return this.casaDe(id) === sala;
    return p.sala === sala && Date.now() >= p.llega;
  }
  // { idXR: sala } de los que están de visita ya llegados (para las fichas de la maqueta)
  paraderoMaqueta() {
    const out = {}, ahora = Date.now();
    for (const [id, p] of Object.entries(this.paradero)) if (ahora >= p.llega && p.sala !== this.casaDe(id)) out[idXR(id)] = p.sala;
    return out;
  }
  // Quién está a la vista en una sala: los de casa que no se han ido y las visitas ya llegadas. (ids del 2D)
  quienEn(sala, mundo) {
    const out = [];
    for (const [id, casa] of Object.entries(CASAS_HIST)) {
      if (casa === sala && this.estaEn(id, sala)) out.push({ id, visita: false });
    }
    const ahora = Date.now();
    for (const [id, p] of Object.entries(this.paradero)) {
      if (p.sala === sala && this.casaDe(id) !== sala && ahora >= p.llega && !out.some(o => o.id === id)) out.push({ id, visita: true });
    }
    return out.filter(o => mundo === 'humo' || o.id !== 'puky');
  }

  // Cada segundo: llegadas, vueltas y salidas. retener: ids que no deben irse (y, si se fueron, vuelven ya).
  agenda({ mundo, retener = [] } = {}) {
    const E = this.E; if (!E || !this.d) return [];
    const ev = [], ahora = Date.now(), P = this.paradero;
    for (const [id, p] of Object.entries(P)) {
      const casa = this.casaDe(id);
      if (!casa) { delete P[id]; continue; }
      if (!p.llegado && ahora >= p.llega) {
        p.llegado = true;
        if (p.sala === casa) delete P[id];
        ev.push({ tipo: 'llega', id, a: p.sala, de: p.desde || casa });
        continue;
      }
      // se acaba la visita (o alguien le necesita): vuelve a casa
      if (p.llegado && p.sala !== casa && ((p.hasta && ahora >= p.hasta) || retener.includes(id))) {
        P[id] = { sala: casa, llega: ahora + (retener.includes(id) ? 2500 : VIAJE_MS), hasta: 0, desde: p.sala };
        ev.push({ tipo: 'sale', id, de: p.sala, a: casa });
      }
    }
    if (ahora < this.proxVisita) return ev;
    this.proxVisita = ahora + entre(45, 85) * 1000;
    const humo = mundo === 'humo', r = E.recado;
    const cand = VISITANTES.filter(id => !P[id] && !(E.situaciones || {})[id] && !retener.includes(id)
      && !(id === 'blancaso' && (E.blancazo || E.blancazoEn > 0)) && !(id === 'puky' && !(E.pukyInvitado && humo))
      && !(r && (r.a === id || r.de === id)));
    if (!cand.length) return ev;
    const id = al(cand), casa = this.casaDe(id), VIS = this.d.VISITAS || {};
    const destinos = Object.entries(VIS).filter(([n, l]) => n !== casa && l.some(v => v.id === id)).map(([n]) => n);
    if (!destinos.length) return ev;
    const dest = al(destinos);
    P[id] = { sala: dest, llega: ahora + VIAJE_MS, hasta: ahora + entre(70, 140) * 1000, desde: casa };
    ev.push({ tipo: 'sale', id, de: casa, a: dest });
    return ev;
  }
  // La frase de quien llega de visita (VISITAS del 2D)
  fraseVisita(id, sala) { const v = (this.d?.VISITAS?.[sala] || []).find(k => k.id === id); return v ? al(v.dice) : null; }

  // ---------- andar ----------
  andar(r, destino, alLlegar = null, vel = 0.7) {
    this.andando.set(r, { destino: destino.clone(), alLlegar, vel, fase: Math.random() * 6 });
  }
  anda(r) { return this.andando.has(r); }
  ponerCasa(r, pos) { this.casaPos.set(r, pos.clone()); }

  // ---------- la voz: una cada vez ----------
  callar(s = 4) {
    for (const t of this.timers) clearTimeout(t); this.timers = [];
    this.vozLibre = Math.max(this.vozLibre, this.t + s);
  }
  _voz(dura) { if (this.t < this.vozLibre) return false; this.vozLibre = this.t + dura + entre(1.6, 2.8); return true; }
  _decir(r, frase, dur = 2.3) { if (r?.grupo?.visible && frase) { r.decir(frase, { dur }); r.pose?.('hablando', { rebote: 0.08 }); this.timers.push(setTimeout(() => r.pose?.('base', { rebote: 0 }), dur * 1000)); } }

  // ---------- por fotograma ----------
  paso(dt, { personas = [], cabeza, mundo, libre = true } = {}) {
    this.t += dt;
    // los que andan
    for (const [r, a] of this.andando) {
      const p = r.grupo.position, falta = a.destino.clone().sub(p).setY(0), d = falta.length();
      a.fase += dt * 9;
      if (d < 0.04) { this.andando.delete(r); r.cuerpo && (r.cuerpo.rotation.z = 0); a.alLlegar?.(); continue; }
      p.addScaledVector(falta.normalize(), Math.min(d, a.vel * dt));
      if (r.cuerpo) r.cuerpo.rotation.z = Math.sin(a.fase) * 0.06; // el balanceo de andar del 2D
    }
    if (!libre || !cabeza || !personas.length) return null;
    const visibles = personas.filter(o => o.r?.grupo?.visible);
    // rutinas
    this.tRutina -= dt;
    if (this.tRutina <= 0) {
      this.tRutina = entre(4, 8);
      const libres = visibles.filter(o => !this.anda(o.r) && !o.r.hablando && o.r.grupo.position.distanceTo(cabeza) > 1.2 && !o.fijo);
      if (libres.length) {
        const o = al(libres), quieto = mundo === 'humo' && QUIETOS_HUMO.includes(o.id);
        if (!quieto && Math.random() < 0.5) {
          if (!this.casaPos.has(o.r)) this.ponerCasa(o.r, o.r.grupo.position);
          const c = this.casaPos.get(o.r), dest = c.clone().add(new THREE.Vector3(entre(-0.5, 0.5), 0, entre(-0.25, 0.25)));
          this.andar(o.r, dest, null, 0.45);
        } else this._loSuyo(o, visibles, mundo, cabeza);
      }
    }
    // charlas entre ellos (si estás cerca: a menos de 6 m de quien habla)
    this.tCharla -= dt;
    if (this.tCharla <= 0) {
      this.tCharla = entre(9, 16);
      const cerca = visibles.filter(o => o.r.grupo.position.distanceTo(cabeza) < 6);
      this._charla(cerca, mundo);
    }
    // sucesos (de noche)
    this.tSuceso -= dt;
    if (this.tSuceso <= 0) {
      this.tSuceso = entre(70, 120);
      if (mundo === 'humo' && this._voz(4.5)) return this.lluvia(cabeza);
    }
    return null;
  }

  // lo suyo (rutinas.js → hacerLoSuyo): pose, efecto y, si hay turno, su frase
  _loSuyo(o, visibles, mundo, cabeza) {
    const A = this.d?.ACTIVIDADES?.[o.id] || {}, r = o.r, humo = mundo === 'humo';
    r.pose?.(humo ? 'riendo' : al(['riendo', 'hablando']), { rebote: 0.18 });
    this.timers.push(setTimeout(() => r.pose?.('base', { rebote: 0.05 }), 2600));
    const pos = r.grupo.position.clone();
    if (humo && A.fx && this.humo) {
      const color = { pedo: [0.15, 1.2], cascaras: [0.6, 0.5], migas: [0.7, 0.5], sudor: [0.7, 1.4], notas: [0.8, 1.6] }[A.fx] || [0.5, 1];
      for (let i = 0; i < 6; i++) this.humo.soltar({ pos: pos.clone().add(new THREE.Vector3(entre(-0.15, 0.15), color[1] * (r.alto ?? 1) * 0.6, entre(-0.1, 0.1))), vel: new THREE.Vector3(entre(-0.2, 0.2), 0.2, entre(-0.2, 0.2)), tam: 0.06, vida: 1.6, crece: 0.12, sube: 0.08, frena: 1.5, brillo: color[0], alfa: 0.7 });
    }
    if (humo && A.sonido && pos.distanceTo(cabeza) < 5) this.sonido(A.sonido, { en: r.grupo, volumen: 0.3 });
    if (humo && A.dice && Math.random() < 0.6 && this._voz(2.3)) this._decir(r, al(A.dice));
    if (humo && A.reaccion) {
      // el pedo de Lasslow: los de al lado se dan cuenta
      visibles.filter(x => x !== o && x.r.grupo.position.distanceTo(pos) < 3).forEach((x, i) => {
        this.timers.push(setTimeout(() => { x.r.pose?.('horror', { rebote: 0.2 }); this.timers.push(setTimeout(() => x.r.pose?.('base', { rebote: 0 }), 1600)); }, 900 + i * 250));
      });
    }
  }

  // charlas (escenas/barrio.js → charlaAmbiente): las del capítulo primero; si no, las de siempre; si no, una tontería
  _charla(cerca, mundo) {
    if (!cerca.length || this.t < this.vozLibre) return;
    const p = this.d?.puente, por = id => cerca.find(o => o.id === id);
    const sinVuper = d => Array.isArray(d) && d.length && d.every(l => Array.isArray(l) && por(l[0]));
    let delCap = [], siempre = [];
    try { delCap = (p.ev('(DIALOGOS_CAP[capId()] || [])') || []).filter(sinVuper); } catch { /* sin capítulo */ }
    try { siempre = (p.ev('dialogosDisponibles()') || []).filter(sinVuper); } catch { siempre = (this.d?.DIALOGOS || []).filter(sinVuper); }
    const posibles = delCap.length && Math.random() < 0.6 ? delCap : siempre;
    if (cerca.length >= 2 && posibles.length && Math.random() < 0.75) {
      let charla = al(posibles);
      if (posibles === siempre) { try { p.win.__charlas = posibles; charla = p.ev('elegirDialogo(window.__charlas)') || charla; delete p.win.__charlas; } catch { /* al azar */ } }
      if (!this._voz(charla.length * 2.4)) return;
      charla.forEach(([id, frase], i) => this.timers.push(setTimeout(() => this._decir(por(id)?.r, frase, 2.2), i * 2400)));
      return;
    }
    const o = al(cerca); if (!o) return;
    let frase = null;
    try { if (this.d?.TONTERIAS?.[o.id]) frase = p.ev(`elegirTonteria(${JSON.stringify(o.id)})`); } catch { /* sin tonterías */ }
    if (!frase) frase = al(this.d?.CHARLAS?.[mundo]?.[o.id] || this.d?.SALUDOS?.[o.id]?.[mundo] || ['…']);
    if (Math.random() < 0.8 && this._voz(2.4)) this._decir(o.r, frase);
  }

  // la lluvia de humo morado (vida.js → SUCESOS 'lluvia'): cae a tu alrededor unos segundos
  lluvia(cabeza) {
    if (!this.humo) return null;
    let n = 0;
    const gota = () => {
      if (n++ > 40) return;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, rr = entre(0.4, 2.2);
        this.humo.soltar({ pos: new THREE.Vector3(cabeza.x + Math.cos(a) * rr, cabeza.y + 1.2, cabeza.z + Math.sin(a) * rr), vel: new THREE.Vector3(0, -0.9, 0), tam: 0.05, vida: 2.2, crece: 0.06, sube: -0.1, frena: 0.2, brillo: 0.25, alfa: 0.75 });
      }
      this.timers.push(setTimeout(gota, 90));
    };
    gota();
    this.sonido('fiuuu', { volumen: 0.3 });
    return 'lluvia';
  }
}
