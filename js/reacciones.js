// La gente reacciona a ti (24/11, «peak para jugar fumado»):
//   · tu humo se les pega a la cara (humo.pegajosos): con tres bocanadas seguidas tosen o se ríen; un aro
//     que les da se les queda de halo;
//   · si les das un manotazo (mano rápida contra el cuerpo) se tambalean sobre los pies;
//   · si les das con algo que has lanzado (gente del barrio; Lasslow y Blancaso ya los lleva app.js) se
//     tambalean, ponen cara y sueltan una frase suya;
//   · el pase: el colega se estira a cogerlo, el mando hace «tirón y suelta» y salta una chispa de humo.
// Barato: unas pocas distancias por fotograma, sin mallas propias (todo sale por el humo instanciado).
import * as THREE from 'three';
import { Recortable } from './recortable.js';

// frases cortas, con la voz de cada uno (criterio §2: una muletilla como mucho)
const TOS = {
  lasslow: ['JA… cof… JAJA. Perdón.', 'Cof. No me río. Cof.'],
  blancaso: ['Cof. Apuntado: humo a la cara.', 'Otra vez no…'],
  perico: ['Pin pin… cof. Nadie me lo va a creer.', 'Cof. Lo he visto venir. Tarde.'],
  palicaso: ['¡Escucha, cof, escucha!', '¡Cof! Una vez a mí me echaron… te cuento.'],
  'la-pompa': ['…', '…Cof. Hace un rato.'],
  cotine: ['Huele a horno. Me gusta.', 'Cof. ¿Eso se come?'],
  puky: ['¿Me llamabais? Cof.', 'Cof. Ni me ha dolido.'],
  vuper: ['Vale, vale… cof.', 'Cof. Eso no ha pasado.'],
  otro: ['¡Cof! ¿Me echas el humo?', 'Cof, cof… qué rico.'],
};
const RISA = {
  lasslow: ['JAJAJA. Perdón. JA.', 'Es que tu cara… JAJA.'],
  blancaso: ['Ja. Apuntado como gracioso.', 'Eso ha tenido gracia. La apunto.'],
  perico: ['Pin pin. ¡Una nube con mi cara!'],
  palicaso: ['¡Escucha! ¡Eso, eso! JA, te cuento…'],
  'la-pompa': ['…Ja. …Ahora me ha hecho gracia.'],
  cotine: ['Jajaja. Me ha dado hambre.'],
  puky: ['¡Ja! ¿Otra?'],
  vuper: ['Ja. Vale, vale.'],
  otro: ['¡Jajaja!'],
};
const HALO = ['¿Llevo algo en la cabeza?', 'Mírame. Soy un santo.', '¿Y esto? Qué elegancia.'];
const GOLPE = {
  perico: ['¡Pin pin! ¡Me han dado!', 'Pin pin. Lo he visto. Lo he sentido.'],
  palicaso: ['¡Escucha, escucha! ¿Eso ha sido a mí?', '¡Eh! Te cuento una cosa: duele.'],
  'la-pompa': ['…', '…Ay. …¿Me has dado?'],
  cotine: ['¡Cuidado, que llevo tarta!', '¿Qué? ¿Eso se come?'],
  puky: ['¿Me llamabais?', '¡Ja! Ni me ha dolido.'],
  vuper: ['Vale, vale…', 'Eso no ha pasado.'],
  lasslow: ['¡Eh! Que soy un señor.', '¡Ay! Me ha dado la risa.'],
  blancaso: ['Apuntado. Me has dado.', 'Otra vez no…'],
  otro: ['¡Ay!', '¡Eh!'],
};
const MANOTAZO = ['¡Eh, eh!', '¡Que me caigo!', 'Uy. Uy. Uy.', '¿Qué haces?'];
const PASE = {
  lasslow: ['Gracias, joven. JA.', 'Ven aquí, precioso.'],
  blancaso: ['Una. Solo una.', 'Apuntado: me lo has pasado.'],
};
const POSE_TOS = ['fumando-tos', 'tosiendo', 'asco', 'sorprendido'];
const POSE_RISA = ['risa-floja', 'riendo', 'rodando-de-risa'];
const POSE_GOLPE_HUMO = ['horror', 'sorprendido'], POSE_GOLPE_DIA = ['sorprendido', 'horror'];

const barajas = new Map();
function una(clave, lista) {
  let b = barajas.get(clave);
  if (!b || !b.length) { b = [...lista].sort(() => Math.random() - 0.5); barajas.set(clave, b); }
  return b.pop();
}
const pose = (p, lista) => lista.find(n => p.indice?.fotos?.[n]) || 'base';
const deLista = (dic, id) => dic[id] || dic.otro;

export class Reacciones {
  constructor({ humo, sonido }) {
    this.humo = humo; this.sonido = sonido;
    this.t = 0; this.caras = new Map(); this.previas = new Map();
  }

  // cada fotograma. personajes: los que ves (los tuyos y la gente de la sala); golpeables: los que no lleva
  // app.js (la gente del barrio); ocupado(p): true si está en mitad de algo (fumando, en una escena…)
  actualizar(dt, { personajes = [], golpeables = [], manos = [], cuerpos = [], colocon = 0, ocupado = () => false } = {}) {
    this.t += dt;
    Recortable.mareo = THREE.MathUtils.clamp((colocon - 20) / 80, 0, 1);
    // las caras, pegajosas para tu humo
    const peg = this.humo.pegajosos; peg.length = 0;
    for (const p of personajes) {
      if (!p?.indice || !p.grupo.visible || !p.grupo.parent) continue;
      let c = this.caras.get(p);
      if (!c) { c = { c: new THREE.Vector3(), r: 0.2, golpes: [], espera: 0, alPegar: (b, tipo) => this._pegado(p, c, tipo) }; this.caras.set(p, c); }
      p.bocaMundo(c.c); c.c.y += 0.04;
      c.r = THREE.MathUtils.clamp((p.alto ?? 1) * 0.16, 0.16, 0.3);
      c.ocupado = ocupado(p);
      peg.push(c);
    }
    // manotazos
    for (const m of manos) {
      if (!m?.activa) { this.previas.delete(m); continue; }
      const prev = this.previas.get(m) || m.punta.clone();
      const vel = _v.subVectors(m.punta, prev).divideScalar(Math.max(dt, 0.008));
      this.previas.set(m, prev.copy(m.punta));
      const rapidez = vel.length();
      if (rapidez < 1.0) continue;
      for (const p of personajes) {
        const c = this.caras.get(p); if (!c || (c.manotazo ?? 0) > this.t) continue;
        const pos = p.grupo.getWorldPosition(_p), alto = p.alto ?? 1;
        if (Math.hypot(m.punta.x - pos.x, m.punta.z - pos.z) > 0.24 || m.punta.y < pos.y + alto * 0.15 || m.punta.y > pos.y + alto * 1.05) continue;
        c.manotazo = this.t + 1.2;
        p.tambalear(Math.min(1, rapidez / 2.5), vel);
        m.vibrar?.(0.55, 45);
        this.sonido('boing', { en: p.grupo, volumen: 0.35, tono: 1.3 + Math.random() * 0.3 });
        if (!c.ocupado && Math.random() < 0.4 && !(p.hablando > 0)) p.decir(una('mano', MANOTAZO), { dur: 1.8 });
      }
    }
    // golpes con cosas lanzadas (solo la gente que no lleva app.js)
    for (const c of cuerpos) {
      if (c.cogido || c.dormido || c.vel.lengthSq() < 2.2) continue;
      for (const p of golpeables) {
        if (!p?.indice || !p.grupo.visible) continue;
        const k = this.caras.get(p); if (k && (k.golpe ?? 0) > this.t) continue;
        const alto = p.alto ?? 1, centro = p.grupo.getWorldPosition(_p); centro.y += alto * 0.55;
        if (c.obj.position.distanceTo(centro) > alto * 0.35 + c.radio) continue;
        if (k) k.golpe = this.t + 1.5;
        p.tambalear(1, c.vel);
        c.vel.multiplyScalar(-0.35);
        this.sonido('bonk', { en: p.grupo, volumen: 0.7 });
        p.pose(pose(p, p.mundo === 'humo' ? POSE_GOLPE_HUMO : POSE_GOLPE_DIA), { rebote: 0.35 });
        setTimeout(() => p.pose('base', { rebote: 0.1 }), 1500);
        p.decir(una('golpe-' + p.id, deLista(GOLPE, p.id)), { dur: 2.4 });
      }
    }
  }

  // tu humo le ha llegado a la cara
  _pegado(p, c, tipo) {
    if (c.ocupado || c.espera > this.t) return;
    if (tipo === 'aro') {
      c.espera = this.t + 5;
      p.empujon(0.18);
      this.sonido('campanita', { en: p.grupo, volumen: 0.3, tono: 1.4 });
      if (!(p.hablando > 0)) setTimeout(() => p.decir(una('halo', HALO), { dur: 2.6 }), 500);
      return;
    }
    c.golpes.push(this.t);
    while (c.golpes.length && this.t - c.golpes[0] > 1.6) c.golpes.shift();
    if (c.golpes.length < 3) { p.empujon(0.03); return; }
    c.golpes.length = 0; c.espera = this.t + 6;
    const id = p.id, ries = Math.random() < (id === 'lasslow' ? 0.65 : 0.35);
    if (ries) {
      p.pose(pose(p, POSE_RISA), { rebote: 0.3 });
      this.sonido(id === 'lasslow' ? 'risa-lasslow' : 'risas', { en: p.grupo, volumen: 0.45 });
      if (!(p.hablando > 0)) p.decir(una('risa-' + id, deLista(RISA, id)), { dur: 2.2 });
    } else {
      p.pose(pose(p, POSE_TOS), { rebote: 0.2 });
      this.sonido(Math.random() < 0.5 ? 'tos-pequena' : 'tos', { en: p.grupo, volumen: 0.55, tono: 0.9 + Math.random() * 0.3 });
      p.tambalear(0.35);
      // el «cof»: le sale una nubecita hacia ti
      const b = p.bocaMundo(new THREE.Vector3());
      for (let i = 0; i < 3; i++) setTimeout(() => this.humo.soltar({ pos: b, vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15, (Math.random() - 0.5) * 0.3), tam: 0.03, vida: 1.4, crece: 0.12, sube: 0.05, frena: 2.5, brillo: 0.5, alfa: 0.8, tuyo: false }), i * 200);
      if (!(p.hablando > 0)) p.decir(una('tos-' + id, deLista(TOS, id)), { dur: 2.2 });
    }
    setTimeout(() => { if (!c.ocupado) p.pose('base', { rebote: 0.12 }); }, 2400);
  }

  // el colega te coge el porro: se estira, el mando da un tirón y suelta, y salta una chispa de humo
  pase(p, mano) {
    p.cogerPase();
    if (mano?.vibrar) { mano.vibrar(0.9, 35); setTimeout(() => mano.vibrar(0.45, 45), 90); setTimeout(() => mano.vibrar(0.2, 70), 210); }
    this.sonido('plop', { en: p.grupo, volumen: 0.5, tono: 1.15 });
    this.sonido('fup', { en: p.grupo, volumen: 0.25, tono: 1.5 });
    this._chispa(p.bocaMundo(new THREE.Vector3()));
    if (PASE[p.id] && Math.random() < 0.3 && !(p.hablando > 0)) setTimeout(() => p.decir(una('pase-' + p.id, PASE[p.id]), { dur: 1.8 }), 250);
  }
  // lo coges tú de su mano
  recibir(p, mano, donde) {
    p.tambalear(0.25);
    if (mano?.vibrar) { mano.vibrar(0.6, 40); setTimeout(() => mano.vibrar(0.3, 30), 110); }
    this.sonido('pop', { volumen: 0.4, tono: 0.8 });
    if (donde) this._chispa(donde);
  }
  _chispa(pos) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      this.humo.soltar({ pos, vel: new THREE.Vector3(Math.cos(a) * 0.35, 0.1 + Math.sin(a) * 0.3, Math.sin(a) * 0.12), tam: 0.014, vida: 0.75, crece: 0.06, sube: 0.05, frena: 3, brillo: 0.95, alfa: 1, tuyo: false });
    }
  }
}
const _v = new THREE.Vector3(), _p = new THREE.Vector3();
