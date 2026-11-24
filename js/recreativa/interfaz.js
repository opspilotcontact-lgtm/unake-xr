// La mini interfaz de la pantalla de la recreativa (un lienzo propio, no Phaser): apagada, arranque CRT,
// modo atracción, lista de juegos, «cómo se juega», cargando y resultado. Estilo arcade: letra gorda,
// colores del juego, rayas de barrido suaves y viñeta.
import * as THREE from 'three';
import { COL } from './mueble.js';

const W = 1024, H = 576;
const MONO = '"Courier New", ui-monospace, monospace';
export const COLOR_BOTON = { b1: COL.amarillo, b2: COL.rosa, b3: COL.cian, b4: COL.verde };
const PALANCA_TXT = { lr: '◀ ▶', ud: '▲ ▼', 4: '✚', 8: '✳' };

export class Interfaz {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas); this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.anisotropy = 4;
    // capa de barrido y viñeta, hechas una vez
    this.capa = document.createElement('canvas'); this.capa.width = W; this.capa.height = H;
    const c = this.capa.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // e: { modo, t (s en el modo), reloj, lista:[{clave,titulo,ctrl,mision,estrellas}], sel, mision, juego, resultado }
  dibujar(e) {
    const g = this.g;
    g.save();
    g.fillStyle = '#0d0918'; g.fillRect(0, 0, W, H);
    const f = this['_' + e.modo]; if (f) f.call(this, g, e);
    g.restore();
    if (e.modo !== 'apagada') g.drawImage(this.capa, 0, 0);
    this.textura.needsUpdate = true;
  }

  _apagada(g) { g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H); }
  _encendiendo(g, e) {
    // línea blanca que se abre en vertical y destella (≤ 0,9 s)
    const k = Math.min(1, e.t / 0.55);
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    const h = Math.max(3, H * k * k), a = e.t < 0.55 ? 1 : Math.max(0, 1 - (e.t - 0.55) / 0.35);
    g.fillStyle = `rgba(255,243,230,${a})`; g.fillRect(0, H / 2 - h / 2, W * Math.min(1, 0.2 + k * 1.6), h);
    if (e.t > 0.4) { g.globalAlpha = Math.min(1, (e.t - 0.4) / 0.4); this._logo(g, e); g.globalAlpha = 1; }
  }
  _apagando(g, e) {
    const k = Math.min(1, e.t / 0.35);
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    const h = Math.max(3, H * (1 - k)), w = W * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3 * 0.98);
    g.fillStyle = '#fff3e6'; g.fillRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
  }
  _logo(g, e) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '120px Caprasimo, serif'; g.lineWidth = 16; g.strokeStyle = COL.tinta;
    const y = 190 + Math.sin(e.reloj * 2) * 6;
    g.strokeText('UNAKÉ', W / 2, y); g.fillStyle = COL.rosa; g.fillText('UNAKÉ', W / 2, y);
    g.font = '44px Caprasimo, serif'; g.lineWidth = 10; g.strokeText('RECREATIVA', W / 2, y + 92); g.fillStyle = COL.amarillo; g.fillText('RECREATIVA', W / 2, y + 92);
  }
  _atraccion(g, e) {
    // fondo de estrellas que bajan
    for (let i = 0; i < 40; i++) {
      const x = (i * 197) % W, y = ((i * 89 + e.reloj * (30 + (i % 5) * 18)) % H);
      g.fillStyle = i % 3 ? 'rgba(255,214,40,0.5)' : 'rgba(255,95,162,0.6)'; g.fillRect(x, y, 4, 4);
    }
    this._logo(g, e);
    g.font = `bold 30px ${MONO}`; g.textAlign = 'center';
    if (e.mision) {
      g.fillStyle = COL.amarillo; g.fillRect(W / 2 - 330, 384, 660, 56); g.fillStyle = COL.tinta; g.fillRect(W / 2 - 326, 388, 652, 48);
      g.fillStyle = COL.amarillo; g.fillText(this._cabe(g, `★ MISIÓN: ${e.mision.titulo.toUpperCase()}`, 620), W / 2, 413);
    } else {
      const j = e.lista[Math.floor(e.reloj / 1.6) % e.lista.length];
      g.fillStyle = COL.crema; g.fillText(this._cabe(g, `HOY: ${j.titulo.toUpperCase()}`, 700), W / 2, 413);
    }
    if (Math.floor(e.reloj * 2) % 2 === 0) { g.font = `bold 38px ${MONO}`; g.fillStyle = COL.crema; g.fillText('PULSA START', W / 2, 496); }
    g.font = `bold 18px ${MONO}`; g.fillStyle = '#8f80a8'; g.fillText('1 MONCHI = 1 PARTIDA   ·   © LA ASO', W / 2, 552);
  }
  _menu(g, e) {
    g.textBaseline = 'middle';
    g.fillStyle = COL.rosa; g.fillRect(0, 0, W, 58);
    g.font = '34px Caprasimo, serif'; g.textAlign = 'left'; g.fillStyle = COL.tinta; g.fillText('ELIGE JUEGO', 28, 31);
    g.font = `bold 22px ${MONO}`; g.textAlign = 'right'; g.fillText(`${e.sel + 1} / ${e.lista.length}`, W - 28, 31);
    // la lista: 7 filas alrededor del elegido
    const filas = 7, alto = 62, y0 = 74;
    const ini = Math.max(0, Math.min(e.lista.length - filas, e.sel - 3));
    for (let i = 0; i < filas && ini + i < e.lista.length; i++) {
      const n = ini + i, j = e.lista[n], y = y0 + i * alto, sel = n === e.sel;
      if (sel) { g.fillStyle = j.mision ? COL.amarillo : COL.crema; g.fillRect(16, y, 476, alto - 8); }
      g.textAlign = 'left'; g.font = `bold 24px ${MONO}`; g.fillStyle = sel ? COL.tinta : j.mision ? COL.amarillo : COL.crema;
      const pre = sel ? (Math.floor(e.reloj * 3) % 2 ? '▶ ' : '  ') : '  ';
      g.fillText(pre + this._cabe(g, (j.mision ? '★ ' : '') + j.titulo.toUpperCase(), j.mision ? 330 : 380), 22, y + (alto - 8) / 2);
      if (j.mision) {
        g.fillStyle = COL.tinta; g.fillRect(384, y + 9, 102, 36); g.fillStyle = COL.rosa; g.fillRect(387, y + 12, 96, 30);
        g.font = `bold 20px ${MONO}`; g.textAlign = 'center'; g.fillStyle = COL.tinta; g.fillText('MISIÓN', 435, y + 28);
      } else if (j.estrellas != null) { g.textAlign = 'right'; g.font = `bold 20px ${MONO}`; g.fillStyle = sel ? COL.tinta : COL.amarillo; g.fillText('★'.repeat(j.estrellas) + '☆'.repeat(3 - j.estrellas), 484, y + (alto - 8) / 2); }
    }
    // barra de desplazamiento
    g.fillStyle = '#2b2140'; g.fillRect(500, y0, 6, filas * alto - 8);
    g.fillStyle = COL.rosa; g.fillRect(500, y0 + (filas * alto - 8) * ini / e.lista.length, 6, (filas * alto - 8) * filas / e.lista.length);
    // la ficha
    const j = e.lista[e.sel];
    g.fillStyle = '#1c1430'; g.fillRect(522, 74, 486, 426); g.strokeStyle = j.mision ? COL.amarillo : COL.lila; g.lineWidth = 4; g.strokeRect(522, 74, 486, 426);
    g.textAlign = 'center'; g.font = '32px Caprasimo, serif'; g.fillStyle = COL.amarillo;
    this._parrafo(g, j.titulo, 765, 112, 450, 36, 2);
    const fin = this.controles(g, j.ctrl, 540, 166, 450, e.reloj);
    if (j.ayuda && fin < 440) { g.font = 'bold 19px system-ui, sans-serif'; g.fillStyle = '#c9bbe0'; this._bloque(g, j.ayuda, 548, fin + 18, 446, 22, Math.floor((490 - fin - 8) / 22)); }
    // pie
    g.fillStyle = '#1c1430'; g.fillRect(0, 512, W, 64);
    g.font = `bold 22px ${MONO}`; g.textAlign = 'center'; g.fillStyle = COL.crema;
    g.fillText('PALANCA ▲▼ o ELEGIR: cambiar   ·   START: jugar', W / 2, 536);
    g.font = `bold 16px ${MONO}`; g.fillStyle = '#9d8fb5'; g.fillText('SALIR: apagar', W / 2, 563);
  }
  _como(g, e) {
    const j = e.juego;
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = COL.amarillo; g.fillRect(0, 0, W, 64);
    g.font = '36px Caprasimo, serif'; g.fillStyle = COL.tinta; g.fillText(this._cabe(g, j.titulo, W - 60), W / 2, 34);
    g.font = `bold 26px ${MONO}`; g.fillStyle = COL.crema; g.fillText('CÓMO SE JUEGA', W / 2, 98);
    const fin = this.controles(g, j.ctrl, 150, 116, 724, e.reloj, true);
    if (j.ayuda && fin < 440) { g.font = 'bold 22px system-ui, sans-serif'; g.fillStyle = '#c9bbe0'; this._bloque(g, j.ayuda, 160, fin + 16, 704, 26, Math.min(3, Math.floor((500 - fin - 10) / 26))); }
    const k = Math.min(1, e.t / e.dur);
    g.fillStyle = '#2b2140'; g.fillRect(150, 520, 724, 14); g.fillStyle = COL.rosa; g.fillRect(150, 520, 724 * k, 14);
    g.font = `bold 18px ${MONO}`; g.fillStyle = '#9d8fb5'; g.fillText(e.cargando ? 'CARGANDO…' : 'START: empezar ya', W / 2, 556);
  }
  _jugando(g) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  _resultado(g, e) {
    const r = e.resultado || {}, n = r.estrellas ?? 0;
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = '64px Caprasimo, serif'; g.lineWidth = 12; g.strokeStyle = COL.tinta;
    const tit = r.gana === false ? '¡CASI!' : '¡FIN!';
    g.strokeText(tit, W / 2, 110); g.fillStyle = r.gana === false ? COL.rosa : COL.amarillo; g.fillText(tit, W / 2, 110);
    g.font = `bold 30px ${MONO}`; g.fillStyle = COL.crema; g.fillText(this._cabe(g, (e.juego?.titulo || '').toUpperCase(), 900), W / 2, 190);
    g.font = '88px Caprasimo, serif'; g.fillStyle = COL.crema; g.fillText(`${r.puntos ?? 0}`, W / 2, 290);
    g.font = `bold 22px ${MONO}`; g.fillStyle = '#9d8fb5'; g.fillText('PUNTOS', W / 2, 350);
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 96, sale = e.t > 0.3 + i * 0.35;
      g.font = `${sale && i < n ? 80 : 64}px ${MONO}`; g.fillStyle = sale && i < n ? COL.amarillo : '#3d3152';
      g.fillText(i < n && sale ? '★' : '☆', x, 425);
    }
    g.font = `bold 22px ${MONO}`; g.fillStyle = COL.crema;
    if (Math.floor(e.reloj * 2) % 2 === 0) g.fillText('START: otra vez   ·   ELEGIR: otro juego', W / 2, 520);
  }
  _cargando(g, e) {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 34px ${MONO}`; g.fillStyle = COL.crema;
    g.fillText('CARGANDO' + '.'.repeat(1 + Math.floor(e.reloj * 3) % 3), W / 2, H / 2);
  }

  // los mandos de un juego dibujados: la palanca con sus flechas y los botones con su color
  controles(g, c, x, y, w, reloj, grande = false) {
    const esc = grande ? 1.15 : 1, fila = 56 * esc;
    let yy = y + 10;
    const parpadeo = Math.floor(reloj * 2.5) % 2 === 0;
    g.textBaseline = 'middle';
    if (c.palanca) {
      const cx = x + 40 * esc, cy = yy + 30 * esc;
      g.fillStyle = COL.tinta; g.beginPath(); g.arc(cx, cy + 18 * esc, 30 * esc, 0, 7); g.fill();
      g.fillStyle = '#3d3152'; g.fillRect(cx - 4 * esc, cy - 10 * esc, 8 * esc, 30 * esc);
      g.fillStyle = COL.rosa; g.beginPath(); g.arc(cx, cy - 14 * esc, 18 * esc, 0, 7); g.fill();
      g.strokeStyle = COL.tinta; g.lineWidth = 3; g.stroke();
      g.textAlign = 'left'; g.font = `bold ${26 * esc}px ${MONO}`; g.fillStyle = COL.rosa;
      g.fillText(`PALANCA ${PALANCA_TXT[c.palanca] || ''}`, x + 92 * esc, cy - 10 * esc);
      g.font = `bold ${20 * esc}px ${MONO}`; g.fillStyle = COL.crema;
      const n = this._bloque(g, c.textoPalanca || 'Moverte', x + 92 * esc, cy + 20 * esc, w - 100 * esc, 24 * esc, 2);
      yy += fila + (n > 1 ? 34 : 14) * esc;
    }
    c.botones.forEach((b, i) => {
      const k = 'b' + (i + 1), cx = x + 40 * esc, cy = yy + 22 * esc, r = (i < 3 ? 22 : 17) * esc;
      g.fillStyle = COL.tinta; g.beginPath(); g.arc(cx, cy + 4, r + 5, 0, 7); g.fill();
      g.fillStyle = (grande && !parpadeo) ? '#fff3e6' : COLOR_BOTON[k]; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = COL.tinta; g.font = `bold ${18 * esc}px ${MONO}`; g.textAlign = 'center'; g.fillText(String(i + 1), cx, cy + 1);
      g.textAlign = 'left'; g.font = `bold ${24 * esc}px ${MONO}`; g.fillStyle = COLOR_BOTON[k];
      g.fillText(this._cabe(g, b.texto, w - 100 * esc), x + 92 * esc, cy);
      yy += 48 * esc;
    });
    if (c.puntero) {
      const cx = x + 40 * esc, cy = yy + 24 * esc;
      g.strokeStyle = COL.amarillo; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 16 * esc, 0, 7); g.stroke();
      g.fillStyle = COL.rosa; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill();
      g.textAlign = 'left'; g.font = `bold ${20 * esc}px ${MONO}`; g.fillStyle = COL.amarillo;
      this._parrafo(g, 'Apunta a la pantalla y pellizca (o gatillo)', x + 92 * esc, cy, w - 100 * esc, 24 * esc, 2, 'left');
      yy += fila;
    }
    if (!c.palanca && !c.botones.length && !c.puntero) { g.font = `bold 22px ${MONO}`; g.fillStyle = COL.crema; g.fillText('—', x, yy); }
    return yy;
  }
  _cabe(g, s, max) {
    if (g.measureText(s).width <= max) return s;
    while (s.length > 3 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }
  // texto partido en líneas, alineado a la izquierda y desde arriba; devuelve cuántas líneas ha usado
  _bloque(g, s, x, y, max, alto, lineas = 2) {
    if (lineas < 1) return 0;
    const out = []; let l = '';
    for (const p of s.split(' ')) { const t = l ? l + ' ' + p : p; if (g.measureText(t).width > max && l) { out.push(l); l = p; } else l = t; }
    out.push(l);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const n = Math.min(lineas, out.length);
    for (let i = 0; i < n; i++) g.fillText(i === n - 1 && out.length > n ? this._cabe(g, out[i] + '…', max) : out[i], x, y + i * alto);
    return n;
  }
  _parrafo(g, s, x, y, max, alto, lineas = 2, alinear = 'center') {
    const pal = s.split(' '); const out = []; let l = '';
    for (const p of pal) { const t = l ? l + ' ' + p : p; if (g.measureText(t).width > max && l) { out.push(l); l = p; } else l = t; }
    out.push(l);
    g.textAlign = alinear;
    out.slice(0, lineas).forEach((t, i) => g.fillText(i === lineas - 1 && out.length > lineas ? this._cabe(g, t, max) : t, x, y + i * alto - (Math.min(out.length, lineas) - 1) * alto / 2));
  }
}
