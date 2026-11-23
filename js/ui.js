// Interfaz dentro del mundo, con la letra de la serie (Caprasimo):
// - cartela: el narrador, en una tira de papel que te sigue la mirada con calma (no pegada a la cara);
// - instrucción: lo que toca hacer ahora, pequeña y abajo, hasta que se cumple (guiar sin agobiar);
// - tarjetas: opciones que se eligen TOCÁNDOLAS con el dedo (o la punta del mando);
// - medidor de calada: el arco con las franjas anidadas de fumar.js, solo mientras das la calada;
// - muñeca: el colocón en tu muñeca izquierda.
import * as THREE from 'three';

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), t };
}
function envolver(ctx, texto, ancho) {
  const out = []; let l = '';
  for (const p of texto.split(' ')) { const s = l ? l + ' ' + p : p; if (ctx.measureText(s).width > ancho && l) { out.push(l); l = p; } else l = s; }
  if (l) out.push(l); return out;
}

// un panel que flota delante de ti, sigue la mirada con retraso y siempre te mira
class Flotante {
  constructor(w, h, metrosAncho, { distancia = 1.1, bajo = -0.18, retraso = 2.2 } = {}) {
    Object.assign(this, lienzo(w, h));
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(metrosAncho, metrosAncho * h / w),
      new THREE.MeshBasicMaterial({ map: this.t, transparent: true, depthTest: false, depthWrite: false }));
    this.malla.renderOrder = 50; this.malla.visible = false;
    this.distancia = distancia; this.bajo = bajo; this.retraso = retraso; this.vida = 0; this.alfa = 0;
  }
  seguir(dt, cabeza, cabezaQ, primeraVez) {
    const f = _f.set(0, 0, -1).applyQuaternion(cabezaQ); f.y = THREE.MathUtils.clamp(f.y, -0.5, 0.3); f.normalize();
    const meta = _m.copy(cabeza).addScaledVector(f, this.distancia); meta.y += this.bajo;
    if (primeraVez) this.malla.position.copy(meta);
    else this.malla.position.lerp(meta, Math.min(1, dt * this.retraso));
    this.malla.lookAt(cabeza);
  }
}

export class UI {
  constructor(escena) {
    this.escena = escena;
    this.cartelaP = new Flotante(1024, 220, 0.62, { bajo: 0.16, retraso: 1.6 });
    this.instrP = new Flotante(1024, 150, 0.5, { bajo: -0.26, retraso: 2.4 });
    escena.add(this.cartelaP.malla, this.instrP.malla);
    this.tarjetas = []; this.alElegir = null;
    // medidor de la calada
    this.medidor = lienzo(512, 512);
    this.medidorM = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12),
      new THREE.MeshBasicMaterial({ map: this.medidor.t, transparent: true, depthTest: false, depthWrite: false }));
    this.medidorM.renderOrder = 60; this.medidorM.visible = false; escena.add(this.medidorM);
    // muñeca
    this.muneca = lienzo(256, 96);
    this.munecaM = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.03),
      new THREE.MeshBasicMaterial({ map: this.muneca.t, transparent: true }));
    this.munecaM.position.set(0, 0.035, 0.05); this.munecaM.rotation.x = -Math.PI / 2.4;
    this.ultimoColocon = -1;
  }

  // ---------- cartela del narrador ----------
  cartela(texto, dur = null) {
    const p = this.cartelaP, { ctx, c } = p;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '44px Caprasimo, serif';
    const lineas = envolver(ctx, texto, c.width - 120).slice(0, 3);
    const alto = lineas.length * 52 + 48;
    ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#140c1c'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.roundRect(16, (c.height - alto) / 2, c.width - 32, alto, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#140c1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lineas.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height / 2 + (i - (lineas.length - 1) / 2) * 52));
    p.t.needsUpdate = true; p.malla.visible = true; p.vida = dur ?? Math.min(7, 2.2 + texto.length * 0.06); p.nueva = true;
  }

  // ---------- instrucción (hasta que se cumple) ----------
  instruccion(texto) {
    const p = this.instrP, { ctx, c } = p;
    if (!texto) { p.malla.visible = false; this._instr = null; return; }
    if (this._instr === texto) return;
    this._instr = texto;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = '50px Caprasimo, serif';
    const w = Math.min(c.width - 20, ctx.measureText(texto).width + 90);
    ctx.fillStyle = 'rgba(20,12,28,.82)'; ctx.beginPath(); ctx.roundRect((c.width - w) / 2, 22, w, 104, 52); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, c.width / 2, 76);
    p.t.needsUpdate = true; p.malla.visible = true; p.vida = Infinity; p.nueva = true;
  }

  // ---------- tarjetas para elegir tocando ----------
  // opciones: textos; centro y normal: dónde se ponen (en fila, de cara a ti)
  tarjetasEn(opciones, centro, haciaMi, alElegir, { anadir = false } = {}) {
    if (!anadir) this.quitarTarjetas();
    const lateral = new THREE.Vector3(-haciaMi.z, 0, haciaMi.x).normalize();
    opciones.forEach((texto, i) => {
      const { c, ctx, t } = lienzo(512, 200);
      ctx.font = '62px Caprasimo, serif';
      ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#140c1c'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.roundRect(8, 8, 496, 184, 30); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#140c1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let tam = 62; while (ctx.measureText(texto).width > 450 && tam > 30) { tam -= 4; ctx.font = `${tam}px Caprasimo, serif`; }
      ctx.fillText(texto, 256, 104);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.078), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
      const off = (i - (opciones.length - 1) / 2) * 0.24;
      m.position.copy(centro).addScaledVector(lateral, off);
      m.position.y += Math.sin(i * 1.7) * 0.03;
      m.lookAt(m.position.clone().add(haciaMi));
      m.userData = { texto, i, base: m.position.clone(), t: Math.random() * 6 };
      this.escena.add(m); this.tarjetas.push(m);
    });
    this.alElegir = alElegir;
  }
  quitarTarjetas() { for (const m of this.tarjetas) { this.escena.remove(m); m.material.map.dispose(); m.material.dispose(); } this.tarjetas = []; this.alElegir = null; }

  // ---------- medidor de calada (valor 0-100, franjas de fumar.js) ----------
  medir(valor, niveles, centro, cabeza, cabezaQ) {
    if (valor == null) { this.medidorM.visible = false; return; }
    const { ctx, c, t } = this.medidor, R = 200, cx = 256, cy = 256;
    ctx.clearRect(0, 0, c.width, c.height);
    const ang = v => Math.PI * 0.75 + (v / 100) * Math.PI * 1.5;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 46; ctx.strokeStyle = 'rgba(20,12,28,.75)';
    ctx.beginPath(); ctx.arc(cx, cy, R, ang(0), ang(100)); ctx.stroke();
    for (const n of niveles) {
      ctx.lineWidth = 34; ctx.strokeStyle = '#' + n.color.toString(16).padStart(6, '0');
      ctx.beginPath(); ctx.arc(cx, cy, R, ang(centro - n.mitad), ang(centro + n.mitad)); ctx.stroke();
    }
    ctx.lineWidth = 16; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang(valor)) * (R - 50), cy + Math.sin(ang(valor)) * (R - 50));
    ctx.lineTo(cx + Math.cos(ang(valor)) * (R + 30), cy + Math.sin(ang(valor)) * (R + 30)); ctx.stroke();
    t.needsUpdate = true;
    const f = _f.set(0.07, -0.09, -0.32).applyQuaternion(cabezaQ);
    this.medidorM.position.copy(cabeza).add(f); this.medidorM.quaternion.copy(cabezaQ);
    this.medidorM.visible = true;
  }

  colocon(valor, manoIzq) {
    if (this.munecaM.parent !== manoIzq.grupo) manoIzq.grupo.add(this.munecaM);
    const v = Math.round(valor);
    if (v === this.ultimoColocon) return;
    this.ultimoColocon = v;
    const { ctx, c, t } = this.muneca;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(20,12,28,.8)'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 96, 20); ctx.fill();
    ctx.fillStyle = '#3a2d4f'; ctx.fillRect(16, 58, 224, 22);
    ctx.fillStyle = v >= 30 ? '#ff5fa2' : '#c9b6ff'; ctx.fillRect(16, 58, 224 * Math.min(1, v / 100), 22);
    ctx.fillStyle = '#fff'; ctx.fillRect(16 + 224 * 0.3 - 2, 52, 4, 34);
    ctx.font = '34px Caprasimo, serif'; ctx.fillStyle = '#fff3e6'; ctx.textBaseline = 'top';
    ctx.fillText('colocón ' + v, 18, 10);
    ctx.font = '20px Caprasimo, serif'; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'right'; ctx.fillText('toca: jugar', 240, 16); ctx.textAlign = 'left';
    t.needsUpdate = true;
  }

  actualizar(dt, cabeza, cabezaQ, manos) {
    for (const p of [this.cartelaP, this.instrP]) {
      if (!p.malla.visible) continue;
      p.vida -= dt;
      if (p.vida <= 0) { p.malla.visible = false; if (p === this.instrP) this._instr = null; continue; }
      p.seguir(dt, cabeza, cabezaQ, p.nueva); p.nueva = false;
    }
    // tarjetas: flotan un poco y se eligen tocándolas
    if (this.tarjetas.length) {
      for (const m of this.tarjetas) {
        m.userData.t += dt; m.position.copy(m.userData.base); m.position.y += Math.sin(m.userData.t * 1.6) * 0.008;
        for (const mano of manos) {
          if (!mano.activa) continue;
          const l = m.worldToLocal(_m.copy(mano.punta));
          if (Math.abs(l.x) < 0.11 && Math.abs(l.y) < 0.05 && Math.abs(l.z) < 0.05) {
            const cb = this.alElegir, texto = m.userData.texto, i = m.userData.i;
            mano.vibrar(0.6, 40);
            this.quitarTarjetas();
            cb?.(texto, i);
            return;
          }
        }
      }
    }
  }
}
const _f = new THREE.Vector3(), _m = new THREE.Vector3();
