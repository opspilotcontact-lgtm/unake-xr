// Física de juguete, propia y barata (sin motor externo): esferas con gravedad que rebotan contra el suelo,
// tu mesa y tus paredes reales (planos de las gafas) o contra la caja de la sala del humo; se cogen con
// pellizco o puño y se LANZAN con la velocidad real de la mano. Pensada para decenas de objetos, no miles.
//
//   const f = new Fisica();             f.actualizar(dt) cada fotograma
//   const c = f.anadir(malla, { radio: 0.03, rebote: 0.4, alGolpear: (c, info) => … })
//   f.planosDesdeXR(xr.planos)          o   f.ponerCaja({ min, max })  (sala VR)
//   const a = new Agarre(f);            a.actualizar(dt, manos) cada fotograma (después de xr.paso)
//
// Cada cuerpo: { obj, vel, giro, radio, rebote, roce, cogido (Mano|null), dormido, datos }.
// Golpes: alGolpear(c, { contra: 'suelo'|'plano'|'caja'|'cuerpo', fuerza, otro }) y f.objetivos (zonas
// que avisan cuando entra algo, para papeleras, dianas…).
import * as THREE from 'three';

const G = -9.8;

export class Fisica {
  constructor() {
    this.cuerpos = []; this.planos = []; this.caja = null; this.objetivos = [];
    this.sueloY = 0; this.gravedad = G;
  }

  anadir(obj, { radio = 0.03, rebote = 0.35, roce = 0.5, masa = 1, alGolpear = null, cogible = true, datos = {}, gravedad = 1 } = {}) {
    const c = { obj, radio, rebote, roce, masa, alGolpear, cogible, datos, gravedad, vel: new THREE.Vector3(), giro: new THREE.Vector3(), cogido: null, dormido: false, quieto: 0 };
    this.cuerpos.push(c);
    return c;
  }
  quitar(c) { this.cuerpos = this.cuerpos.filter(x => x !== c); }
  lanzar(c, vel, giro) { c.vel.copy(vel); if (giro) c.giro.copy(giro); c.dormido = false; c.quieto = 0; }

  // planos detectados por las gafas → rectángulos con colisión (mesas y paredes)
  planosDesdeXR(planos) {
    this.planos = planos.map(p => {
      const inv = p.matriz.clone().invert();
      return { orientacion: p.orientacion, matriz: p.matriz, inv, medio: [p.ancho / 2, p.largo / 2], centroY: p.centro.y };
    });
  }
  ponerCaja(min, max) { this.caja = { min: min.clone(), max: max.clone() }; }
  quitarCaja() { this.caja = null; }

  // zona que avisa: { centro (Vector3 o función), radio, alto?, alEntrar(c) }
  objetivo(o) { this.objetivos.push(o); return o; }
  quitarObjetivo(o) { this.objetivos = this.objetivos.filter(x => x !== o); }

  _golpe(c, contra, fuerza, otro) {
    if (fuerza > 0.25 && c.alGolpear) { try { c.alGolpear(c, { contra, fuerza, otro }); } catch (e) { console.error(e); } }
  }

  actualizar(dt) {
    const pasos = dt > 0.022 ? 2 : 1, h = dt / pasos;
    for (let s = 0; s < pasos; s++) this._paso(h);
  }

  _paso(dt) {
    for (const c of this.cuerpos) {
      if (c.cogido || c.dormido) continue;
      const p = c.obj.position;
      c.vel.y += this.gravedad * c.gravedad * dt;
      c.vel.multiplyScalar(1 - 0.08 * dt); // aire
      p.addScaledVector(c.vel, dt);
      if (c.giro.lengthSq() > 1e-6) { _q.setFromEuler(_e.set(c.giro.x * dt, c.giro.y * dt, c.giro.z * dt)); c.obj.quaternion.premultiply(_q); c.giro.multiplyScalar(1 - 0.6 * dt); }
      // suelo
      if (p.y - c.radio < this.sueloY) {
        p.y = this.sueloY + c.radio;
        if (c.vel.y < 0) { const f = -c.vel.y; c.vel.y = f > 0.4 ? f * c.rebote : 0; this._rozar(c, dt); this._golpe(c, 'suelo', f); }
      }
      // planos reales (mesa: solo por arriba; pared: por delante)
      for (const pl of this.planos) {
        _l.copy(p).applyMatrix4(pl.inv); // en el espacio del plano: y = normal
        if (Math.abs(_l.x) > pl.medio[0] + c.radio * 0.5 || Math.abs(_l.z) > pl.medio[1] + c.radio * 0.5) continue;
        if (pl.orientacion === 'horizontal') {
          if (_l.y < c.radio && _l.y > -0.06 && c.vel.y <= 0.01) {
            _l.y = c.radio; p.copy(_l.applyMatrix4(pl.matriz));
            const f = -c.vel.y; c.vel.y = f > 0.4 ? f * c.rebote : 0; this._rozar(c, dt); this._golpe(c, 'plano', f, pl);
          }
        } else if (Math.abs(_l.y) < c.radio) {
          _n.set(0, 1, 0).transformDirection(pl.matriz);
          const lado = Math.sign(_l.y) || 1;
          _l.y = lado * c.radio; p.copy(_l.applyMatrix4(pl.matriz));
          const vn = c.vel.dot(_n) * lado;
          if (vn < 0) { c.vel.addScaledVector(_n, -vn * lado * (1 + c.rebote)); this._golpe(c, 'plano', -vn, pl); }
        }
      }
      // la caja de la sala (VR)
      if (this.caja) {
        for (const eje of ['x', 'y', 'z']) {
          const lo = this.caja.min[eje] + c.radio, hi = this.caja.max[eje] - c.radio;
          if (p[eje] < lo) { p[eje] = lo; if (c.vel[eje] < 0) { const f = -c.vel[eje]; c.vel[eje] = f * c.rebote; this._golpe(c, 'caja', f); } }
          else if (p[eje] > hi) { p[eje] = hi; if (c.vel[eje] > 0) { const f = c.vel[eje]; c.vel[eje] = -f * c.rebote; this._golpe(c, 'caja', f); } }
        }
      }
      // dormir cuando se queda quieto (ahorra y no tiembla)
      c.quieto = c.vel.lengthSq() < 0.0025 ? c.quieto + dt : 0;
      if (c.quieto > 0.6) { c.dormido = true; c.vel.set(0, 0, 0); c.giro.set(0, 0, 0); }
    }
    // entre cuerpos (esferas, n² pequeño)
    const cs = this.cuerpos;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if ((a.dormido || a.cogido) && (b.dormido || b.cogido)) continue;
      _d.subVectors(b.obj.position, a.obj.position);
      const r = a.radio + b.radio, d2 = _d.lengthSq();
      if (d2 >= r * r || d2 < 1e-10) continue;
      const d = Math.sqrt(d2); _d.divideScalar(d);
      const ma = a.cogido ? 1e6 : a.masa, mb = b.cogido ? 1e6 : b.masa, tot = ma + mb;
      const solape = r - d;
      a.obj.position.addScaledVector(_d, -solape * mb / tot); b.obj.position.addScaledVector(_d, solape * ma / tot);
      const vr = _v.subVectors(b.vel, a.vel).dot(_d);
      if (vr < 0) {
        const j2 = -(1 + Math.min(a.rebote, b.rebote)) * vr / (1 / ma + 1 / mb);
        if (!a.cogido) a.vel.addScaledVector(_d, -j2 / ma);
        if (!b.cogido) b.vel.addScaledVector(_d, j2 / mb);
        a.dormido = b.dormido = false;
        this._golpe(a, 'cuerpo', -vr, b); this._golpe(b, 'cuerpo', -vr, a);
      }
    }
    // objetivos
    for (const o of this.objetivos) {
      const centro = typeof o.centro === 'function' ? o.centro() : o.centro;
      for (const c of cs) {
        if (c.cogido || o._dentro?.has(c)) continue;
        _d.subVectors(c.obj.position, centro);
        const alto = o.alto ?? o.radio;
        if (_d.x * _d.x + _d.z * _d.z < o.radio * o.radio && Math.abs(_d.y) < alto) {
          (o._dentro ??= new Set()).add(c);
          try { o.alEntrar?.(c); } catch (e) { console.error(e); }
        }
      }
    }
  }
  _rozar(c, dt) { const k = Math.max(0, 1 - c.roce * 12 * dt); c.vel.x *= k; c.vel.z *= k; c.giro.multiplyScalar(k); }
}

// Coger y lanzar con las manos. Se coge con pellizco (o gatillo) o con puño (o botón lateral) cerca del objeto;
// al soltar sale con la velocidad media de la mano en los últimos ~80 ms (más un pelín: lanzar en VR se queda corto).
export class Agarre {
  constructor(fisica, { alcance = 0.07, impulso = 1.25 } = {}) {
    this.f = fisica; this.alcance = alcance; this.impulso = impulso;
    this.llevando = new Map(); // Mano → { c, off, offQ }
    this.historial = new Map(); // Mano → [{ p, t }]
    this.t = 0; this.alCoger = null; this.alSoltar = null;
  }
  lleva(mano) { return this.llevando.get(mano)?.c || null; }
  // forzar: poner un cuerpo en la mano (p. ej. el corcho al recargar)
  poner(mano, c) {
    c.cogido = mano; c.dormido = false;
    this.llevando.set(mano, { c, off: new THREE.Vector3(), offQ: new THREE.Quaternion() });
  }
  soltar(mano, lanzar = true) {
    const l = this.llevando.get(mano); if (!l) return null;
    this.llevando.delete(mano); l.c.cogido = null;
    if (lanzar) {
      const h = this.historial.get(mano) || [];
      if (h.length >= 2) {
        const a = h[0], b = h[h.length - 1], dt = Math.max(0.016, b.t - a.t);
        l.c.vel.copy(b.p).sub(a.p).divideScalar(dt).multiplyScalar(this.impulso);
        l.c.giro.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      }
    } else l.c.vel.set(0, 0, 0);
    l.c.dormido = false; l.c.quieto = 0;
    this.alSoltar?.(l.c, mano);
    return l.c;
  }
  actualizar(dt, manos) {
    this.t += dt;
    for (const m of manos) {
      if (!m.activa) { if (this.llevando.has(m)) this.soltar(m, false); continue; }
      const h = this.historial.get(m) || []; h.push({ p: m.punta.clone(), t: this.t });
      while (h.length > 2 && this.t - h[0].t > 0.08) h.shift();
      this.historial.set(m, h);
      const sujeta = m.pinza || m.agarre;
      const l = this.llevando.get(m);
      if (l) {
        if (!sujeta) { this.soltar(m, true); continue; }
        l.c.obj.position.copy(m.punta).add(_v.copy(l.off).applyQuaternion(m.quat));
        l.c.obj.quaternion.copy(m.quat).multiply(l.offQ);
        continue;
      }
      if (m.empiezaPinza || m.empiezaAgarre) {
        let mejor = null, md = Infinity;
        for (const c of this.f.cuerpos) {
          if (!c.cogible || c.cogido) continue;
          const d = c.obj.position.distanceTo(m.punta) - c.radio;
          if (d < this.alcance && d < md) { md = d; mejor = c; }
        }
        if (mejor) {
          mejor.cogido = m; mejor.dormido = false;
          const invQ = m.quat.clone().invert();
          this.llevando.set(m, { c: mejor, off: mejor.obj.position.clone().sub(m.punta).applyQuaternion(invQ), offQ: invQ.multiply(mejor.obj.quaternion) });
          m.vibrar(0.35, 25);
          this.alCoger?.(mejor, m);
        }
      }
    }
  }
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _l = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3();
