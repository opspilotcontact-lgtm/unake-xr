// La guía activa: que el jugador SIEMPRE sepa qué hacer (feedback del fundador tras la Quest: «no sé cómo empezar
// ninguna misión»). Mira el objetivo ★ de la historia y, sin que lo busques, te empuja:
//   · al cambiar el objetivo, al volver al bar o a casa, al acabar una escena o un minijuego, y si llevas ~60 s
//     sin avanzar: una pista corta y diegética (un colega con su bocadillo, o la cartela si no están);
//   · el hilo de humo hacia la sala buena, y la máquina del bar parpadeando con la misión ★;
//   · si la misión es de noche y es de día (o al revés), la pista dice cómo cambiar.
// Sin agobiar: como mucho una pista cada 45 s (8 s si acaba de cambiar el objetivo).
//
//   const g = new Guia({ motor, entorno: () => ({ mundo, sala, enBar, enSala, libre, colegas, encargo }),
//                        decir: (de, texto) => …, hilo: salas => …, maquina: clave => …, llamar: () => … });
//   en el bucle: g.paso(dt);   g.empujar('volver' | 'minijuego' | 'escena');   g.plan(objetivo) → { de, texto, hilo, maquina }
import { SALAS } from '../barrio/salas.js';
import { CASAS } from './motor.js';

export const NOMBRES = { palicaso: 'Palicaso', cotine: 'Cotine', lasslow: 'Lasslow', perico: 'Perico', pompa: 'la Pompa', puky: 'Puky', blancaso: 'Blancaso', niebla: 'Niebla', miron: 'el Mirón' };
// para ir en mitad de una frase: «la tienda de 24 h», «el cuarto de Vuper»
export const nombreSala = id => { const n = id === 'dentro' ? 'la barra de Unaké' : SALAS[id]?.nombre || id; return n.charAt(0).toLowerCase() + n.slice(1); };
const lista = xs => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1] : xs[0] || '');
// Los objetivos que dependen de día/humo: hablar con alguien (charla/dia) o lo que el XR marca con `mundo`.
export function mundoQuiere(o) {
  if (!o || !o.accion) return null;
  if (o.tipo === 'charla' || o.tipo === 'dia') return o.mundo || null;
  return o.accion.mundo || null;
}

const MIN_PISTA = 45, MIN_CAMBIO = 8, QUIETO = 60, QUIETO_LARGO = 90;

export class Guia {
  constructor({ motor, entorno, decir, hilo, maquina, llamar }) {
    Object.assign(this, { motor, entorno, decir, hilo, maquina, llamar });
    this.t = 0; this.tUltima = -999; this.tAvance = 0; this.firma = null; this.repes = 0;
    this.pendiente = null; this.cada = 0; this.ultima = null; this.historial = [];
  }

  // ---------- qué hacer con un objetivo, según dónde estés ----------
  plan(o) {
    if (!o || !o.accion) return null;
    const a = o.accion, e = this.entorno(), m = this.motor, humo = e.mundo === 'humo';
    const nombreMj = c => m.d?.MISIONES?.[c]?.nombre || c;
    const quiere = mundoQuiere(o);
    if (quiere && quiere !== e.mundo) {
      return quiere === 'humo'
        ? { de: 'blancaso', texto: 'Eso es de noche. Lía uno y fúmatelo: el humo te lleva.', cambiar: 'humo' }
        : { de: 'lasslow', texto: 'Eso es de día. Toca la ★ de tu muñeca y volvemos a tu casa.', cambiar: 'normal' };
    }
    switch (a.tipo) {
      case 'puerta': return null; // la puerta tiene su propia instrucción
      case 'fumar': return { de: 'lasslow', texto: '¿Liamos uno? La bandeja está delante.' };
      case 'pasar': return { de: 'blancaso', texto: 'Eso se pasa. Acércame el porro encendido. Hay normas.' };
      case 'recreativa': {
        const n = nombreMj(a.clave);
        if (!humo) return { de: 'blancaso', texto: `Toca la ★ de tu muñeca: la máquina viene a ti y juegas a ${n}.`, maquina: a.clave };
        if (e.enBar) return { de: 'lasslow', texto: `La máquina del bar parpadea: enciéndela y elige ★ ${n}.`, maquina: a.clave };
        return { de: 'lasslow', texto: `${n} está en la máquina del bar. Sigue el hilo de humo.`, maquina: a.clave, hilo: ['dentro'] };
      }
      case 'nativo': return { de: 'lasslow', texto: `Toca la ★ de tu muñeca y jugamos a ${nombreMj(a.clave)}.` };
      case 'hucha': {
        if (m.monchis <= 0) return { de: 'blancaso', texto: 'Sin monchis no hay hucha. Haz un encargo en la tienda de 24 h o juega en la máquina.' };
        if (e.sala === 'plaza') return { de: 'blancaso', texto: 'Toca la hucha con la mano y suelta tus monchis.' };
        return { de: 'blancaso', texto: `La hucha está en la plaza, conmigo. ${humo ? 'Sigue el hilo de humo.' : 'Toca la ★ y te llevo.'}`, hilo: ['plaza'] };
      }
      case 'mejora': case 'invento': {
        if (a.puede) return { de: 'blancaso', texto: `Toca la ★ de tu muñeca: ${a.texto}.` };
        if (a.precio) return { de: 'blancaso', texto: `Te faltan ${a.precio - m.monchis} monchis. Encargos en la tienda o la máquina del bar.` };
        return null;
      }
      case 'seguir': return { de: 'lasslow', texto: 'Toca la ★ de tu muñeca para seguir la historia.' };
      case 'barrio': return this._planBarrio(o, e);
      default: return null;
    }
  }
  _planBarrio(o, e) {
    const humo = e.mundo === 'humo';
    const { salas, con } = this.motor.sitiosPendientes(o);
    if (!salas.length) return null;
    const recoger = o.tipo === 'recoger';
    if (e.sala && salas.includes(e.sala)) {
      if (recoger) return { texto: 'Lo que brilla, aquí: cógelo con la mano.' };
      if (o.tipo === 'recado' || (!o.tipo && e.sala === 'tienda')) return { texto: e.encargo ? 'Lleva el encargo: sigue el hilo de humo.' : 'Te faltan monchis: toca el tablón de ENCARGOS de aquí.' };
      const aqui = con.filter(c => CASAS[c] === e.sala);
      if (!aqui.length) return null;
      return { texto: `Toca a ${lista(aqui.map(c => NOMBRES[c] || c))} para hablar.` };
    }
    if (e.enBar && salas.includes('dentro')) {
      if (recoger) return { de: 'lasslow', texto: 'Lo que brilla, aquí en el bar: cógelo con la mano.' };
      const quien = con.filter(c => c !== 'lasslow' && c !== 'blancaso').map(c => NOMBRES[c] || c);
      if (quien.length) return { de: 'lasslow', texto: `${lista(quien)}, en la barra. Toca la ★ de tu muñeca y vamos.` };
    }
    const metas = salas.filter(s => !(e.enBar && s === 'dentro'));
    const destino = nombreSala(metas[0] || salas[0]);
    const quien = con.map(c => NOMBRES[c] || c);
    const que = recoger ? `Lo que falta está en ${destino}.` : quien.length ? `${lista(quien)} ${quien.length > 1 ? 'están' : 'está'} en ${destino}.` : `Te toca ir a ${destino}.`;
    if (humo || e.enSala) return { de: 'lasslow', texto: `${que} Sigue el hilo de humo.`, hilo: metas };
    return { de: 'lasslow', texto: `${que} Toca la ★ de tu muñeca y te llevo.`, hilo: metas };
  }

  // ---------- cuándo hablar ----------
  empujar(motivo, retraso = 2.5) {
    if (this.pendiente && this.pendiente.motivo === 'cambio') return;
    this.pendiente = { motivo, en: this.t + retraso };
  }
  registrar() { this.tUltima = this.t; }
  refrescar() { this.cada = 0; this.cadaAplicar = 0; } // algo ha cambiado (has cogido algo): hilo y máquina ya // alguien ya ha dado una pista (el motor, una reacción)
  pistaYa(motivo = 'forzada') {
    const o = this.motor.objetivos().historia, p = this.plan(o);
    if (!p || !p.texto) return null;
    this.tUltima = this.t;
    this._aplicar(p);
    this.decir(p.de || null, p.texto);
    this.llamar?.();
    this.ultima = { motivo, texto: p.texto, de: p.de || null, objetivo: o.id };
    this.historial.push(this.ultima); if (this.historial.length > 30) this.historial.shift();
    return this.ultima;
  }
  _aplicar(p) {
    const e = this.entorno();
    if (!e.encargo) this.hilo(p && p.hilo ? p.hilo : null);
    this.maquina(p && p.maquina ? p.maquina : null);
  }

  paso(dt) {
    this.t += dt; this.cada -= dt;
    if (this.cada > 0) return;
    this.cada = 0.5;
    const o = this.motor.objetivos().historia;
    const firma = o ? o.id + '|' + (o.accion && o.accion.tipo) : '';
    if (firma !== this.firma) {
      const habia = this.firma !== null;
      this.firma = firma; this.tAvance = this.t; this.repes = 0;
      if (o && habia) this.pendiente = { motivo: 'cambio', en: this.t + 1.5 };
      if (o && habia) this.llamar?.();
    }
    if (!o) return;
    const e = this.entorno();
    // el hilo y la máquina siguen al objetivo aunque no se hable
    this.cadaAplicar = (this.cadaAplicar || 0) - 0.5;
    if (this.cadaAplicar <= 0) { this.cadaAplicar = 2; this._aplicar(this.plan(o)); }
    if (!e.libre) return;
    const desde = this.t - this.tUltima;
    if (this.pendiente && this.t >= this.pendiente.en && desde > (this.pendiente.motivo === 'cambio' ? MIN_CAMBIO : MIN_PISTA)) {
      const motivo = this.pendiente.motivo; this.pendiente = null;
      this.pistaYa(motivo); return;
    }
    if (this.pendiente && this.pendiente.motivo !== 'cambio' && this.t > this.pendiente.en + 5) this.pendiente = null; // ya pasó su momento
    if (e.encargo) return; // con un encargo en la mano, el encargo manda
    const quieto = this.repes >= 2 ? QUIETO_LARGO : QUIETO;
    if (this.t - Math.max(this.tAvance, this.tUltima) > quieto && desde > MIN_PISTA) { this.repes++; this.pistaYa('quieto'); }
  }
}
