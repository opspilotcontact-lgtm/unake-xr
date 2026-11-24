// Los encargos de la tienda de 24 h (base/js/escenas/barrio.js → empezarReparto, comprobarEntrega): el tablón de la
// tienda te da un pedido para alguien del barrio; lo llevas colgando de la mano izquierda (con su cuenta atrás), el
// hilo de humo te guía a su sala y se lo das tocándole. Cobras como en el 2D (más cuanto antes llegues y más racha).
// Los datos (DESTINOS, PEDIDOS) son los del 2D, leídos por el motor.
//
//   const E = new Encargos({ img, sonido });
//   E.montarTablon(grupoSala, posLocal);                 // en la tienda
//   E.pedir(destinos, pedidos, salaActual, racha)        // → el encargo (o null si no hay a quién)
//   en el bucle: E.actualizar(dt, manos, cabeza, manoIzq) → 'tablon' al tocar el tablón · 'fallo' si se acaba el tiempo
//   E.entregar() → { pago, racha } (y deja de llevarlo)
import * as THREE from 'three';

const NOMBRES = { blancaso: 'Blancaso', perico: 'Perico', palicaso: 'Palicaso', lasslow: 'Lasslow', pompa: 'la Pompa', cotine: 'Cotine' };
export const nombreDe = id => NOMBRES[id] || id;

export class Encargos {
  constructor({ img, sonido }) {
    this.img = img; this.sonido = sonido; this.actual = null; this.tablon = null; this.t = 0; this._seg = -1;
    // lo que llevas: un cartel con el dibujo del pedido, siempre mirándote
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    this.lienzo = c; this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.bolsa = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
    this.bolsa.scale.set(0.2, 0.0625, 1); this.bolsa.renderOrder = 60; this.bolsa.visible = false;
    this.icono = null;
  }

  montarTablon(grupo, pos) {
    this.quitarTablon();
    const c = document.createElement('canvas'); c.width = 384; c.height = 512; const g = c.getContext('2d');
    g.fillStyle = '#3b2a52'; g.strokeStyle = '#140c1c'; g.lineWidth = 10; g.lineJoin = 'round';
    g.beginPath(); g.roundRect(10, 10, 364, 492, 24); g.fill(); g.stroke();
    g.fillStyle = '#ffd628'; g.beginPath(); g.roundRect(34, 34, 316, 96, 16); g.fill(); g.stroke();
    g.fillStyle = '#140c1c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '52px Caprasimo, serif'; g.fillText('ENCARGOS', 192, 84);
    g.fillStyle = '#fff6e0'; g.font = '30px Caprasimo, serif';
    ['Lleva el pedido', 'a quien toque', 'antes de que', 'se enfríe.'].forEach((l, i) => g.fillText(l, 192, 190 + i * 44));
    // la campana
    g.fillStyle = '#ffd628'; g.beginPath(); g.arc(192, 430, 46, Math.PI, 0); g.lineTo(250, 446); g.lineTo(134, 446); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#140c1c'; g.font = '22px Caprasimo, serif'; g.fillText('¡Toca!', 192, 478);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.64), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
    m.position.copy(pos).setY(1.25);
    // mirando hacia el centro de la sala
    m.lookAt(new THREE.Vector3(0, 1.25, 0)); m.name = 'tablon-encargos';
    grupo.add(m); this.tablon = m;
  }
  quitarTablon() { if (this.tablon) { this.tablon.parent?.remove(this.tablon); this.tablon.geometry.dispose(); this.tablon.material.map.dispose(); this.tablon.material.dispose(); this.tablon = null; } }

  // un encargo nuevo (destino en otra sala; en el humo, nadie del bar: allí no hay a quién tocar)
  pedir(destinos, pedidos, salaActual, racha = 0, mundo = 'humo') {
    const posibles = destinos.filter(d => d.sala !== salaActual && !(mundo === 'humo' && d.sala === 'dentro'));
    if (!posibles.length || !pedidos?.length) return null;
    const destino = posibles[Math.floor(Math.random() * posibles.length)];
    const pedido = pedidos[Math.floor(Math.random() * pedidos.length)];
    // en VR se anda más que en el 2D (y cada puerta es una cortinilla): más tiempo
    const total = 90 - Math.min(racha * 5, 30);
    this.actual = { destino, pedido, racha, total, restante: total };
    this.icono = null; this._seg = -1;
    this.img(pedido.clave + '.png').then(t => { if (this.actual?.pedido === pedido) { this.icono = t.image; this._pintar(); } }).catch(() => { });
    this.sonido?.('campanita', { volumen: 0.5 });
    return this.actual;
  }
  entregar() {
    const r = this.actual; if (!r) return null;
    // la fórmula del 2D, con el tiempo que te sobra llevado a sus 30 s
    const sobra = r.restante * 30 / r.total;
    const pago = Math.round((4 + Math.floor(sobra / 3)) * (1 + Math.min(r.racha, 4) * 0.2));
    this.actual = null; this.bolsa.visible = false;
    this.sonido?.('campanita'); this.sonido?.('lata', { volumen: 0.5 });
    return { pago, racha: r.racha + 1, destino: r.destino };
  }
  dejar() { this.actual = null; this.bolsa.visible = false; }

  actualizar(dt, manos, cabeza, manoIzq) {
    this.t += dt;
    let evento = null;
    if (this.actual) {
      this.actual.restante -= dt;
      if (this.actual.restante <= 0) { this.actual = null; this.bolsa.visible = false; this.sonido?.('oooh', { volumen: 0.6 }); return 'fallo'; }
      // colgando de tu mano izquierda (o delante, abajo, si no la ves)
      if (this.bolsa.parent !== manoIzq?.grupo && manoIzq?.grupo) manoIzq.grupo.add(this.bolsa);
      this.bolsa.position.set(0, 0.09, 0); this.bolsa.visible = !!manoIzq?.activa;
      const s = Math.ceil(this.actual.restante);
      if (s !== this._seg) { this._seg = s; this._pintar(); }
    }
    // tocar el tablón (con la punta del dedo o del mando)
    if (this.tablon?.parent && !this.actual) {
      const p = this.tablon.getWorldPosition(_a);
      for (const m of manos) {
        if (!m.activa) continue;
        if (m.punta.distanceTo(p) < 0.3) { m.vibrar?.(0.6, 50); evento = 'tablon'; break; }
      }
    }
    return evento;
  }

  _pintar() {
    const r = this.actual; if (!r) return;
    const g = this.lienzo.getContext('2d'), W = this.lienzo.width, H = this.lienzo.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,12,28,.88)'; g.strokeStyle = '#ffd628'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 22); g.fill(); g.stroke();
    if (this.icono) { const a = this.icono.width / this.icono.height, h = 120; g.drawImage(this.icono, 20, 20, h * a, h); }
    g.fillStyle = '#fff6e0'; g.font = '34px Caprasimo, serif'; g.textBaseline = 'middle';
    g.fillText(`→ ${nombreDe(r.destino.id)}`, 160, 52, W - 180);
    const f = r.restante / r.total;
    g.fillStyle = f < 0.25 ? '#ff5fa2' : '#ffd628'; g.font = '30px Caprasimo, serif';
    g.fillText(`${Math.max(0, Math.ceil(r.restante))} s${r.racha ? ` · racha ×${r.racha + 1}` : ''}`, 160, 108);
    this.tex.needsUpdate = true;
  }
}
const _a = new THREE.Vector3();
