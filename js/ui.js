// Interfaz dentro del mundo, con la letra de la serie (Caprasimo):
// - cartela: el narrador, en una tira de papel que te sigue la mirada con calma (no pegada a la cara);
// - instrucción: lo que toca hacer ahora, pequeña y abajo, hasta que se cumple (guiar sin agobiar);
// - tarjetas: opciones que se eligen TOCÁNDOLAS con el dedo (o la punta del mando), o señalándolas con el rayo
//   del mando / de la mano y gatillo / pellizco (para las que quedan lejos: sentado, dentro de la furgo…);
// - medidor de calada: el arco con las franjas anidadas de fumar.js, solo mientras das la calada;
// - muñeca: el colocón en tu muñeca izquierda.
//
// «Responsive» en VR: las tarjetas nunca quedan a menos de 35 cm de tus ojos, ni por encima de ellos ni más de
// 50 cm por debajo; si son muchas, van en arco a tu alrededor (y en dos filas); de lejos crecen para que la letra
// no baje de ~1°. Los textos escalan con el ajuste «texto grande» (xr.ajustes.texto).
import * as THREE from 'three';
import { AJUSTES } from './xr.js';

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), t };
}
function envolver(ctx, texto, ancho) {
  const out = [];
  for (const parrafo of String(texto).split('\n')) {
    let l = '';
    for (const p of parrafo.split(' ')) { const s = l ? l + ' ' + p : p; if (ctx.measureText(s).width > ancho && l) { out.push(l); l = p; } else l = s; }
    out.push(l);
  }
  return out;
}
const escalaTexto = () => THREE.MathUtils.clamp(AJUSTES.texto || 1, 0.8, 1.6);

// un panel que flota delante de ti, sigue la mirada con retraso y siempre te mira
class Flotante {
  constructor(w, h, metrosAncho, { distancia = 1.1, bajo = -0.18, retraso = 2.2 } = {}) {
    Object.assign(this, lienzo(w, h));
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(metrosAncho, metrosAncho * h / w),
      new THREE.MeshBasicMaterial({ map: this.t, transparent: true, depthTest: false, depthWrite: false }));
    // depthTest:false + renderOrder alto: nada cercano (un mueble, la cabina) la tapa
    this.malla.renderOrder = 50; this.malla.visible = false;
    this.distancia = distancia; this.bajo = bajo; this.retraso = retraso; this.vida = 0; this.alfa = 0;
  }
  seguir(dt, cabeza, cabezaQ, primeraVez, { distancia = this.distancia, escala = 1 } = {}) {
    const f = _f.set(0, 0, -1).applyQuaternion(cabezaQ); f.y = THREE.MathUtils.clamp(f.y, -0.5, 0.3); f.normalize();
    // la altura relativa a tus ojos crece con la distancia: el ángulo se mantiene
    const k = distancia / this.distancia;
    const meta = _m.copy(cabeza).addScaledVector(f, distancia); meta.y += this.bajo * k;
    if (primeraVez) this.malla.position.copy(meta);
    else this.malla.position.lerp(meta, Math.min(1, dt * this.retraso));
    this.malla.scale.setScalar(k * escala);
    this.malla.lookAt(cabeza);
  }
}

export class UI {
  constructor(escena) {
    this.escena = escena;
    this.cartelaP = new Flotante(1024, 220, 0.7, { bajo: 0.18, retraso: 1.6 });
    this.instrP = new Flotante(1024, 150, 0.6, { bajo: -0.28, retraso: 2.4 });
    escena.add(this.cartelaP.malla, this.instrP.malla);
    // a qué distancia flotan la cartela y la instrucción (m). Un minijuego con cosas muy cerca (la cabina) puede
    // acercarlas: ui.distanciaTextos = 0.7 (y devolverla a null al acabar). Igual se ven siempre (no se tapan).
    this.distanciaTextos = null;
    this.tarjetas = []; this.alElegir = null;
    this._cab = new THREE.Vector3(0, 1.6, 0); this._cabQ = new THREE.Quaternion(); this._hayCabeza = false;
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
    this._rayo = new THREE.Raycaster();
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
    let tam = 50; ctx.font = `${tam}px Caprasimo, serif`;
    // que quepa entera (antes se cortaba por los lados si era larga)
    while (ctx.measureText(texto).width > c.width - 110 && tam > 30) { tam -= 2; ctx.font = `${tam}px Caprasimo, serif`; }
    const w = Math.min(c.width - 20, ctx.measureText(texto).width + 90);
    ctx.fillStyle = 'rgba(20,12,28,.88)'; ctx.beginPath(); ctx.roundRect((c.width - w) / 2, 22, w, 104, 52); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, c.width / 2, 76, c.width - 60);
    p.t.needsUpdate = true; p.malla.visible = true; p.vida = Infinity; p.nueva = true;
  }

  // ---------- dónde poner algo para tocarlo cómodamente ----------
  // Delante de ti, a `d` m en horizontal y `bajo` m por debajo de los ojos (de pie o sentado: va con tu cabeza).
  // Devuelve { centro, haciaMi } listo para tarjetasEn.
  sitioComodo({ d = 0.45, bajo = 0.22, cabeza = this._cab, cabezaQ = this._cabQ } = {}) {
    const f = _f.set(0, 0, -1).applyQuaternion(cabezaQ).setY(0);
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
    f.normalize();
    const centro = cabeza.clone().addScaledVector(f, d); centro.y = Math.max(0.45, cabeza.y - bajo);
    return { centro, haciaMi: f.clone().negate() };
  }

  // ---------- tarjetas para elegir tocando ----------
  // opciones: textos (con '\n' o largos: hasta `lineas` líneas). centro y haciaMi: dónde se ponen, de cara a ti.
  // Opciones: anadir (no quitar las que hay) · tam (1 = 20 cm de ancho) · lineas (máx. por tarjeta, 3)
  //           · encima (se ven a través de todo: para dentro de cabinas o muebles) · fijo (sin corregir el sitio)
  tarjetasEn(opciones, centro, haciaMi, alElegir, { anadir = false, tam = 1, lineas = 3, encima = false, fijo = false } = {}) {
    if (!anadir) this.quitarTarjetas();
    centro = centro.clone(); haciaMi = haciaMi.clone().setY(0);
    if (haciaMi.lengthSq() < 1e-6) haciaMi.set(0, 0, 1);
    haciaMi.normalize();
    const cab = this._cab;
    // ---- corregir el sitio respecto a tu cabeza (si sabemos dónde está) ----
    let distH = Infinity;
    if (this._hayCabeza && !fijo) {
      const h = _m.copy(centro).sub(cab).setY(0); distH = h.length();
      if (distH < 1.2) {
        // ni pegadas a la cara, ni por encima de los ojos, ni demasiado abajo (sentado se alcanza peor)
        if (distH < 0.35) { const dir = distH > 0.05 ? h.multiplyScalar(1 / distH) : haciaMi.clone().negate(); centro.x = cab.x + dir.x * 0.38; centro.z = cab.z + dir.z * 0.38; distH = 0.38; }
        centro.y = THREE.MathUtils.clamp(centro.y, Math.max(0.4, cab.y - 0.5), cab.y - 0.05);
      }
    }
    // ---- tamaño: 20 cm × tam; de lejos, que la letra no baje de ~1° ----
    const dist = this._hayCabeza ? centro.distanceTo(cab) : 0.6;
    const ancho = Math.max(0.2 * tam, dist * 0.28) * escalaTexto();
    const sep = ancho * 1.18;
    // ---- disposición: en fila; si son muchas y están cerca, en arco a tu alrededor (hasta 4 por fila) ----
    const n = opciones.length;
    const enArco = this._hayCabeza && !fijo && distH < 1.2 && n > 2;
    const porFila = enArco ? (n > 4 ? Math.ceil(n / 2) : n) : n;
    const filas = Math.ceil(n / porFila);
    const lateral = new THREE.Vector3(-haciaMi.z, 0, haciaMi.x);
    opciones.forEach((texto, i) => {
      const fila = Math.floor(i / porFila), enFila = fila === filas - 1 ? n - fila * porFila : porFila, col = i - fila * porFila;
      const { c, t, altoRel } = pintarTarjeta(texto, lineas);
      const alto = ancho * altoRel;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: !encima, depthWrite: !encima }));
      if (encima) m.renderOrder = 45;
      const off = (col - (enFila - 1) / 2) * sep;
      const dy = (filas - 1) / 2 * alto * 1.3 - fila * alto * 1.3;
      if (enArco) {
        // ángulo alrededor de tu cabeza, a la misma distancia horizontal
        const r = Math.max(0.38, distH), ang = off / r;
        const dirC = _m.copy(centro).sub(cab).setY(0).normalize();
        const dir = dirC.applyAxisAngle(_y, -ang);
        m.position.set(cab.x + dir.x * r, centro.y + dy, cab.z + dir.z * r);
        m.lookAt(cab.x, m.position.y, cab.z);
      } else {
        m.position.copy(centro).addScaledVector(lateral, off); m.position.y += dy;
        m.lookAt(m.position.clone().add(haciaMi));
      }
      m.position.y += Math.sin(i * 1.7) * 0.012;
      m.userData = { texto, i, base: m.position.clone(), t: Math.random() * 6, ancho, alto, c, foco: 0 };
      this.escena.add(m); this.tarjetas.push(m);
    });
    this.alElegir = alElegir;
  }
  // ---------- ajustes de confort (desde el menú de la muñeca) ----------
  // Cada toque cambia un ajuste y vuelve a enseñar el menú con el valor nuevo. «Volver» llama a alVolver().
  menuAjustes(xr, { alVolver = null, sonido = null } = {}) {
    const A = xr.ajustes || AJUSTES;
    const POSTURA = { auto: 'Postura: la mido yo', pie: 'Postura: de pie', sentado: 'Postura: sentado' };
    const opciones = [
      POSTURA[A.postura] || POSTURA.auto,
      A.giro === 'suave' ? 'Giro: suave' : 'Giro: a saltos',
      (A.texto || 1) > 1.1 ? 'Texto: grande' : 'Texto: normal',
      'Recentrar',
      'Volver',
    ];
    const { centro, haciaMi } = this.sitioComodo({ d: 0.42, bajo: 0.2 });
    this.tarjetasEn(opciones, centro, haciaMi, (texto, i) => {
      sonido?.('pop', { volumen: 0.4 });
      if (i === 0) xr.ajustar({ postura: { auto: 'pie', pie: 'sentado', sentado: 'auto' }[A.postura] || 'pie' });
      else if (i === 1) xr.ajustar({ giro: A.giro === 'suave' ? 'saltos' : 'suave' });
      else if (i === 2) xr.ajustar({ texto: (A.texto || 1) > 1.1 ? 1 : 1.3 });
      else if (i === 3) { xr.recentrar?.(); this.cartela('Recentrado. Si no te cuadra, mantén pulsado el botón Meta.', 3); }
      if (i === 4) { alVolver?.(); return; }
      if (i === 0) this.cartela(xr.ajustes.postura === 'sentado' ? 'Sentado: en el humo el mundo sube a tu altura de pie.' : xr.ajustes.postura === 'pie' ? 'De pie: todo a tu altura real.' : 'Lo mido yo: si estás sentado al entrar en el humo, te subo.', 3.5);
      this.menuAjustes(xr, { alVolver, sonido });
    }, { tam: 0.95 });
  }
  quitarTarjetas() { for (const m of this.tarjetas) { this.escena.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); } this.tarjetas = []; this.alElegir = null; }
  _elegir(m, mano) {
    const cb = this.alElegir, texto = m.userData.texto, i = m.userData.i;
    mano?.vibrar?.(0.6, 40);
    this.quitarTarjetas();
    cb?.(texto, i);
  }

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
    const { ctx, t } = this.muneca;
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = 'rgba(20,12,28,.8)'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 96, 20); ctx.fill();
    ctx.fillStyle = '#3a2d4f'; ctx.fillRect(16, 58, 224, 22);
    ctx.fillStyle = v >= 30 ? '#ff5fa2' : '#c9b6ff'; ctx.fillRect(16, 58, 224 * Math.min(1, v / 100), 22);
    ctx.fillStyle = '#fff'; ctx.fillRect(16 + 224 * 0.3 - 2, 52, 4, 34);
    ctx.font = '34px Caprasimo, serif'; ctx.fillStyle = '#fff3e6'; ctx.textBaseline = 'top';
    ctx.fillText('colocón ' + v, 18, 10);
    ctx.font = '16px Caprasimo, serif'; ctx.fillStyle = '#ffe066'; ctx.textAlign = 'right'; ctx.fillText('toca: jugar', 244, 84); ctx.textAlign = 'left';
    t.needsUpdate = true;
  }

  actualizar(dt, cabeza, cabezaQ, manos) {
    this._cab.copy(cabeza); this._cabQ.copy(cabezaQ); this._hayCabeza = true;
    const esc = escalaTexto();
    for (const p of [this.cartelaP, this.instrP]) {
      if (!p.malla.visible) continue;
      p.vida -= dt;
      if (p.vida <= 0) { p.malla.visible = false; if (p === this.instrP) this._instr = null; continue; }
      p.seguir(dt, cabeza, cabezaQ, p.nueva, { distancia: this.distanciaTextos ?? p.distancia, escala: esc }); p.nueva = false;
    }
    // tarjetas: flotan un poco y se eligen tocándolas (o con el rayo y gatillo / pellizco)
    if (!this.tarjetas.length) return;
    const lista = this.tarjetas;
    let apuntada = null, quien = null;
    for (const mano of manos) {
      if (!mano.activa || !mano.tieneRayo) continue;
      // el rayo solo cuenta si la punta no está ya tocando la fila de tarjetas (tocar manda)
      this._rayo.set(mano.rayoOrigen, mano.rayoDir); this._rayo.far = 4;
      const hit = this._rayo.intersectObjects(lista, false)[0];
      if (hit && hit.distance > 0.12) { apuntada = hit.object; quien = mano; break; }
    }
    for (const m of lista) {
      const u = m.userData;
      u.t += dt; m.position.copy(u.base); m.position.y += Math.sin(u.t * 1.6) * 0.006;
      // tocar: caja de la tarjeta + margen (con la mano real, algo más: el seguimiento tiembla)
      let cerca = 0;
      for (const mano of manos) {
        if (!mano.activa) continue;
        const l = m.worldToLocal(_m.copy(mano.punta));
        const mx = u.ancho / 2 + (mano.esMano ? 0.015 : 0.008) / m.scale.x, my = u.alto / 2 + (mano.esMano ? 0.015 : 0.008) / m.scale.x;
        const dentro = Math.abs(l.x) < mx && Math.abs(l.y) < my;
        if (dentro && Math.abs(l.z) < (mano.esMano ? 0.06 : 0.05)) { this._elegir(m, mano); return; }
        if (dentro && l.z > 0 && l.z < 0.15) cerca = Math.max(cerca, 1 - l.z / 0.15);
      }
      // realce: se acerca un poco cuando tu dedo viene o el rayo la apunta
      const foco = Math.max(cerca, m === apuntada ? 1 : 0);
      u.foco += (foco - u.foco) * Math.min(1, dt * 12);
      m.scale.setScalar(1 + 0.08 * u.foco);
    }
    if (apuntada && quien.empiezaPinza) this._elegir(apuntada, quien);
  }
}

// tarjeta de papel: 512 px de ancho; alto según las líneas. Devuelve el lienzo y alto/ancho.
function pintarTarjeta(texto, maxLineas) {
  const W = 512, med = document.createElement('canvas').getContext('2d');
  let tam = 62, lineas;
  const fuente = s => `${s}px Caprasimo, serif`;
  // primero, una línea (como antes); si no cabe a ≥ 46 px, se parte en varias
  med.font = fuente(tam);
  const una = !String(texto).includes('\n') ? (() => { let s = tam; med.font = fuente(s); while (med.measureText(texto).width > 450 && s > 46) { s -= 2; med.font = fuente(s); } return med.measureText(texto).width <= 450 ? s : 0; })() : 0;
  if (una) { tam = una; lineas = [String(texto)]; }
  else {
    tam = 52; med.font = fuente(tam); lineas = envolver(med, texto, 450);
    while ((lineas.length > maxLineas || Math.max(...lineas.map(l => med.measureText(l).width)) > 470) && tam > 30) { tam -= 3; med.font = fuente(tam); lineas = envolver(med, texto, 450); }
    lineas = lineas.slice(0, maxLineas);
  }
  const H = Math.max(200, Math.round(lineas.length * tam * 1.15 + 90));
  const { c, ctx, t } = lienzo(W, H);
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#140c1c'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.roundRect(8, 8, W - 16, H - 16, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#140c1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fuente(tam);
  lineas.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 4 + (i - (lineas.length - 1) / 2) * tam * 1.15, 470));
  t.needsUpdate = true;
  return { c, t, altoRel: H / W };
}
const _f = new THREE.Vector3(), _m = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
