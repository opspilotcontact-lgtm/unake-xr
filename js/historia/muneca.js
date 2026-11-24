// Los objetivos del capítulo en tu muñeca izquierda (criterio §3: guiar sin agobiar).
//   · Arriba, el de la historia, en DORADO, con su botón (jugar en la recreativa, ir al barrio, aportar…).
//   · Debajo, como mucho 2 más, pequeños y apagados (el resto de la historia que falta y lo opcional).
//   · Se pliega: plegada solo queda la línea dorada. Al cambiar el objetivo se despliega sola unos segundos.
//
// Dónde (sin romper el panel del colocón de js/ui.js, que va en el dorso de la mano a 5 cm hacia el codo, en
// (0, 0.035, 0.05) del grupo de la mano y se toca para abrir el menú): esto va en la MISMA cara, más arriba del
// antebrazo (el grupo a z = 0.13; la banda dorada empieza a 3 cm del colocón), como la correa de un reloj. Mirar el
// reloj enseña las dos cosas; la banda queda a ~6 cm del colocón, así que tocarla no abre el menú (el colocón
// reacciona a menos de 4,5 cm).
//
//   const m = new MunecaHistoria({ motor, alPulsar: obj => … });   // alPulsar: el botón del objetivo dorado
//   en el bucle: m.actualizar(dt, xr.manos.izquierda, xr.manos.derecha);
import * as THREE from 'three';
import { mundoQuiere } from './guia.js';

const ORO = '#ffd23f', TINTA = '#140c1c', APAGADO = 'rgba(214,200,232,.72)';
const W = 640, H_BANDA = 176, H_RESTO = 168;
const ANCHO_M = 0.12;                              // 12 cm de ancho
const M_PX = ANCHO_M / W;
export const POS_MUNECA = new THREE.Vector3(0, 0.035, 0.13);

function lienzo(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx: c.getContext('2d'), t };
}
function envolver(ctx, texto, ancho, max) {
  const out = []; let l = '';
  for (const p of String(texto).split(' ')) { const s = l ? l + ' ' + p : p; if (ctx.measureText(s).width > ancho && l) { out.push(l); l = p; } else l = s; }
  if (l) out.push(l);
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

export class MunecaHistoria {
  constructor({ motor, alPulsar = () => { } }) {
    this.motor = motor; this.alPulsar = alPulsar;
    this.grupo = new THREE.Group(); this.grupo.name = 'muneca-historia';
    this.grupo.position.copy(POS_MUNECA); this.grupo.rotation.x = -Math.PI / 2.4; // como el colocón
    this.banda = lienzo(W, H_BANDA); this.resto = lienzo(W, H_RESTO);
    this.mBanda = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO_M, H_BANDA * M_PX), new THREE.MeshBasicMaterial({ map: this.banda.t, transparent: true }));
    this.mResto = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO_M, H_RESTO * M_PX), new THREE.MeshBasicMaterial({ map: this.resto.t, transparent: true }));
    // con el giro del colocón, +y local apunta hacia los dedos: de los dedos al codo quedan colocón → banda dorada
    // → el resto (se lee de arriba abajo, igual que el colocón)
    this.mBanda.position.y = (H_RESTO * M_PX) / 2 + 0.002;
    this.mResto.position.y = -(H_BANDA * M_PX) / 2;
    this.grupo.add(this.mBanda, this.mResto);
    this.plegada = false; this.abiertaHasta = 0; this.t = 0; this.espera = 0; this.firma = ''; this.pulso = 0;
    motor.on('alCambiar', () => this.pintar());
    motor.on('alCumplirObjetivo', () => { this.desplegar(5); });
    motor.on('alEmpezarCapitulo', () => { this.desplegar(6); });
    this.pintar();
  }

  // «Mírame»: la banda late y brilla unos segundos y la mano izquierda vibra (al cambiar el objetivo o con una pista).
  llamar(seg = 2.6) { this.pulso = seg; this.vibrarPendiente = true; if (this.plegada) this.desplegar(5); }
  plegar() { this.plegada = true; this.abiertaHasta = 0; this._visibilidad(); }
  desplegar(seg = 0) { this.plegada = false; this.abiertaHasta = seg ? this.t + seg : 0; this._visibilidad(); this.pintar(); }
  _visibilidad() { this.mResto.visible = !this.plegada; }

  pintar() {
    const o = this.motor.objetivos();
    this.o = o;
    const h = o.historia;
    const firma = h ? h.id + '|' + h.progreso + '|' + (h.accion && h.accion.texto) : 'nada';
    const cambia = firma !== this.firma && this.firma && h;
    this.firma = firma;
    if (cambia) { this.plegada = false; this.abiertaHasta = this.t + 5; this._visibilidad(); this.pulso = 2.6; this.vibrarPendiente = true; }
    // ---- banda dorada ----
    {
      const { ctx, c, t } = this.banda;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(20,12,28,.88)'; ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H_BANDA - 8, 22); ctx.fill();
      ctx.strokeStyle = ORO; ctx.lineWidth = 5; ctx.stroke();
      ctx.textBaseline = 'top';
      if (!h) {
        ctx.fillStyle = ORO; ctx.font = '40px Caprasimo, serif';
        ctx.fillText(o.cap.id === 'libre' ? '¡Unaké se queda! Modo libre' : o.enIntro ? 'Escena del capítulo…' : 'Capítulo completado', 26, 30);
      } else {
        ctx.font = '40px Caprasimo, serif'; ctx.fillStyle = ORO;
        ctx.fillText('★', 22, 20);
        const lineas = envolver(ctx, h.corto, W - 96 - (h.progreso ? 110 : 0), 2);
        lineas.forEach((l, i) => ctx.fillText(l, 70, 20 + i * 46));
        if (h.progreso) { ctx.textAlign = 'right'; ctx.fillStyle = '#fff3e6'; ctx.fillText(h.progreso, W - 24, 20); ctx.textAlign = 'left'; }
        // el botón: qué pasa si la tocas
        const a = h.accion;
        if (a && a.texto) {
          ctx.font = '28px Caprasimo, serif';
          const quiere = mundoQuiere(h), otro = quiere && quiere !== (this.motor.E.mundoXR || 'normal');
          const txt = 'toca: ' + (otro ? (quiere === 'humo' ? 'Ir al humo' : 'Volver a casa') : a.texto) +(h.como === 'pendiente' ? ' · aún no está en el XR' : '');
          const w = Math.min(W - 60, ctx.measureText(txt).width + 34);
          ctx.fillStyle = a.puede === false ? '#5a4a6e' : ORO;
          ctx.beginPath(); ctx.roundRect(66, 118, w, 44, 14); ctx.fill();
          ctx.fillStyle = TINTA; ctx.fillText(txt, 82, 124);
        }
      }
      t.needsUpdate = true;
    }
    // ---- resto: como mucho 2 más, apagados, y el capítulo ----
    {
      const { ctx, c, t } = this.resto;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(20,12,28,.72)'; ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H_RESTO - 8, 18); ctx.fill();
      ctx.textBaseline = 'top'; ctx.font = '30px Caprasimo, serif'; ctx.fillStyle = APAGADO;
      const mas = [...o.otros, ...o.opcionales].slice(0, 2);
      mas.forEach((x, i) => { const l = envolver(ctx, '· ' + x.corto + (x.progreso ? ` (${x.progreso})` : ''), W - 50, 1)[0]; ctx.fillText(l, 24, 16 + i * 42); });
      const quedan = o.otros.length + o.opcionales.length - mas.length;
      ctx.font = '24px Caprasimo, serif'; ctx.fillStyle = 'rgba(214,200,232,.55)';
      const pie = `Cap. ${o.cap.etiqueta || '–'} · ${o.cap.titulo}${quedan > 0 ? ` · y ${quedan} más` : ''}`;
      const bolsa = `${this.motor.monchis} monchis`;
      ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,224,102,.8)'; ctx.fillText(bolsa, W - 24, H_RESTO - 50);
      const anchoBolsa = ctx.measureText(bolsa).width + 20;
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(214,200,232,.55)';
      ctx.fillText(envolver(ctx, pie, W - 50 - anchoBolsa, 1)[0], 24, H_RESTO - 50);
      t.needsUpdate = true;
    }
  }

  // Tocar: plegada → se despliega; desplegada, la banda dorada → su botón; el resto → se pliega.
  actualizar(dt, manoIzq, manoDer) {
    this.t += dt; this.espera = Math.max(0, this.espera - dt);
    if (this.abiertaHasta && this.t > this.abiertaHasta) { this.abiertaHasta = 0; this.plegada = true; this._visibilidad(); }
    if (manoIzq && manoIzq.grupo && this.grupo.parent !== manoIzq.grupo) manoIzq.grupo.add(this.grupo);
    // el latido de «mírame»
    if (this.pulso > 0) {
      this.pulso = Math.max(0, this.pulso - dt);
      const k = this.pulso > 0 ? 1 + 0.12 * Math.abs(Math.sin(this.t * 7)) : 1;
      this.mBanda.scale.setScalar(k);
      this.mBanda.material.color.setScalar(this.pulso > 0 ? 1 + 0.6 * Math.abs(Math.sin(this.t * 7)) : 1);
      if (this.vibrarPendiente && manoIzq && manoIzq.activa) { this.vibrarPendiente = false; manoIzq.vibrar?.(0.5, 70); setTimeout(() => manoIzq.vibrar?.(0.35, 60), 220); }
    }
    if (!manoIzq || !manoIzq.activa || !manoDer || !manoDer.activa || this.espera > 0) return;
    const toca = malla => { if (!malla.visible) return false; const l = malla.worldToLocal(_v.copy(manoDer.punta)); const g = malla.geometry.parameters; return Math.abs(l.x) < g.width / 2 && Math.abs(l.y) < g.height / 2 && Math.abs(l.z) < 0.02; };
    if (toca(this.mBanda)) {
      this.espera = 0.8; manoDer.vibrar?.(0.4, 30);
      if (this.plegada) return this.desplegar();
      if (this.o && this.o.historia) this.alPulsar(this.o.historia);
    } else if (toca(this.mResto)) { this.espera = 0.8; manoDer.vibrar?.(0.3, 20); this.plegar(); }
  }
}
const _v = new THREE.Vector3();
