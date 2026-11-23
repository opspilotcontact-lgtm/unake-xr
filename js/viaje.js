// Momentos de colocón: de vez en cuando, en el humo y con el colocón alto, la sala hace algo raro durante unos
// segundos y vuelve a su sitio. Para meterte en el papel sin cortar nada (pedido del fundador, 23/11):
//   · nunca se mueve tu cámara ni el suelo, nada te tapa la vista, todo se puede ignorar;
//   · uno cada vez, cada 70-140 s, en baraja sin repetir (criterio §4) y nunca durante una calada o un pase.
import * as THREE from 'three';

const FIGURAS = {
  // puntos (x, y) de -1 a 1 que el humo dibuja delante de ti
  corazon: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; }),
  estrella: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, r = (Math.floor(i / (n / 10)) % 2) ? 0.45 : 1; return [Math.sin(t) * r, Math.cos(t) * r]; }),
  infinito: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [Math.cos(t) / (1 + Math.sin(t) ** 2), Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) ** 2) * 1.4]; }),
  eme: n => { const v = [[-1, -1], [-1, 1], [0, 0], [1, 1], [1, -1]], out = []; for (let i = 0; i < n; i++) { const k = i / (n - 1) * 4, a = Math.floor(Math.min(3, k)), f = k - a; out.push([v[a][0] + (v[a + 1][0] - v[a][0]) * f, v[a][1] + (v[a + 1][1] - v[a][1]) * f]); } return out; },
};

export class Viaje {
  constructor({ escena, humo, sala, personajes, fisica, sonido, xr, img }) {
    Object.assign(this, { escena, humo, sala, personajes, fisica, sonido, xr, img });
    this.activo = null; this.espera = 40; this.t = 0; this.baraja = [];
    this.grupo = new THREE.Group(); this.grupo.name = 'viaje'; escena.add(this.grupo);
  }

  _siguiente() {
    if (!this.baraja.length) this.baraja = ['neon', 'monchis', 'figura', 'miradas', 'estrellas', 'respira'].sort(() => Math.random() - 0.5);
    return this.baraja.pop();
  }

  // llamar cada fotograma; `puede` = estás en el humo, colocón alto y nada importante pasando
  actualizar(dt, { puede, colocon }) {
    this.t += dt;
    if (this.activo) {
      const a = this.activo; a.t += dt;
      const k = Math.min(1, a.t / 1.5) * Math.min(1, (a.dur - a.t) / 2); // entra y sale suave
      try { a.paso?.(dt, Math.max(0, k), a.t); } catch (e) { console.error('[viaje]', e); a.t = a.dur; }
      if (a.t >= a.dur) { try { a.fin?.(); } catch (e) { console.error(e); } this.activo = null; this.espera = 70 + Math.random() * 70; }
      return;
    }
    if (!puede || colocon < 40) return;
    this.espera -= dt * (colocon > 70 ? 1.5 : 1);
    if (this.espera <= 0) this.lanzar(this._siguiente());
  }
  cortar() { if (this.activo) { try { this.activo.fin?.(); } catch { } this.activo = null; } this.espera = Math.max(this.espera, 30); }

  lanzar(tipo) {
    const cab = this.xr.cabeza.clone(), f = this.xr.adelante.clone().setY(0).normalize();
    const M = this.momentos[tipo]; if (!M) return;
    this.activo = { tipo, t: 0, dur: 14, ...M.call(this, cab, f) };
  }

  momentos = {
    // la sala cambia de color, despacito, y vuelve
    neon() {
      this.sonido('zumbido-m', { volumen: 0.25 });
      return { dur: 15, paso: (dt, k, t) => this.sala.efectos({ tono: k * (1.4 + Math.sin(t * 0.6) * 0.9), onda: k * 0.6, t }), fin: () => this.sala.efectos({}) };
    },
    // una onda de luz que respira desde donde estás
    respira() {
      return { dur: 12, paso: (dt, k, t) => this.sala.efectos({ onda: k, t }), fin: () => this.sala.efectos({}) };
    },
    // llueven chuches del techo, despacio: se pueden coger (y comer: a la boca)
    monchis() {
      const nombres = ['caramelo.png', 'patatas.png', 'obj-donut.png', 'obj-caramelo.png', 'obj-pizza.png'];
      const cuerpos = [];
      let cada = 0, n = 0;
      this.sonido('tiroriro', { volumen: 0.4 });
      const caer = async () => {
        const tex = await this.img(nombres[Math.floor(Math.random() * nombres.length)]);
        const asp = tex.image.width / tex.image.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11 * asp, 0.11), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
        const cab = this.xr.cabeza, f = this.xr.adelante.clone().setY(0).normalize(), lado = new THREE.Vector3(-f.z, 0, f.x);
        const r = 0.35 + Math.random() * 1.0, x = (Math.random() - 0.5) * 1.6;
        m.position.copy(cab).addScaledVector(f, r).addScaledVector(lado, x); m.position.y = Math.min(2.6, cab.y + 0.9);
        this.grupo.add(m);
        const c = this.fisica.anadir(m, { radio: 0.05, rebote: 0.3, gravedad: 0.12, datos: { chuche: true }, gravedad: 0.045 });
        c.giro.set(Math.random() * 2, Math.random() * 2, 0);
        cuerpos.push(c);
      };
      return {
        dur: 16,
        paso: (dt, k, t) => {
          cada -= dt;
          if (t < 10 && cada <= 0 && n < 18) { cada = 0.5; n++; caer(); }
          // comerse una: llevarla a la boca
          const boca = this.xr.boca();
          for (const c of cuerpos) {
            if (c.comida) continue;
            if (c.obj.position.distanceTo(boca) < 0.12) { c.comida = true; c.cogido?.vibrar(0.5, 50); this.sonido('nam', { volumen: 0.6 }); c.obj.visible = false; this.fisica.quitar(c); }
          }
        },
        // lo que no te has comido se queda en el suelo un rato y se va
        fin: () => setTimeout(() => { for (const c of cuerpos) { this.fisica.quitar(c); this.grupo.remove(c.obj); c.obj.geometry.dispose(); } }, 20000),
      };
    },
    // el humo dibuja una figura delante de ti
    figura(cab, f) {
      const nombres = Object.keys(FIGURAS), nombre = nombres[Math.floor(Math.random() * nombres.length)];
      const pts = FIGURAS[nombre](34), lado = new THREE.Vector3(-f.z, 0, f.x);
      const centro = cab.clone().addScaledVector(f, 1.3); centro.y = cab.y + 0.1;
      pts.forEach(([x, y], i) => setTimeout(() => {
        this.humo.soltar({ pos: centro.clone().addScaledVector(lado, x * 0.4).add(new THREE.Vector3(0, y * 0.4, 0)), vel: new THREE.Vector3(0, 0.01, 0), tam: 0.06, vida: 7, crece: 0.012, sube: 0.004, frena: 2, brillo: 0.7, alfa: 0.95 });
      }, i * 45));
      this.sonido('oooh', { volumen: 0.35 });
      return { dur: 8 };
    },
    // todos se quedan mirándote en silencio… y alguien explota de risa
    miradas() {
      const [a, b] = this.personajes;
      const antes = this.personajes.map(p => p.giroMax);
      this.personajes.forEach(p => { p.giroMax = 1.5; p.pose('fumado', { rebote: 0.1 }); });
      let reido = false;
      return {
        dur: 9,
        paso: (dt, k, t) => {
          if (!reido && t > 4.2) { reido = true; a.pose('risa-floja', { rebote: 0.3 }); this.sonido('risa-lasslow', { en: a.grupo, volumen: 0.7 }); setTimeout(() => b.decir('…¿Qué?'), 900); }
        },
        fin: () => this.personajes.forEach((p, i) => { p.giroMax = antes[i]; p.pose('base', { rebote: 0.1 }); }),
      };
    },
    // el techo se abre en estrellas
    estrellas(cab) {
      const n = 160, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 3.2; pos.set([cab.x + Math.cos(a) * r, 2.5 + Math.random() * 0.6, cab.z + Math.sin(a) * r], i * 3); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: '#fff6c8', size: 0.07, transparent: true, opacity: 0, depthWrite: false });
      const pts = new THREE.Points(geo, mat); this.grupo.add(pts);
      this.sonido('campanita', { volumen: 0.3, tono: 0.7 });
      return {
        dur: 14,
        paso: (dt, k, t) => { mat.opacity = k * (0.75 + Math.sin(t * 5) * 0.2); pts.rotation.y += dt * 0.03; this.sala.efectos({ tono: 0, onda: 0, t }); this.sala.luz(1 - k * 0.35); },
        fin: () => { this.grupo.remove(pts); geo.dispose(); mat.dispose(); this.sala.luz(1); },
      };
    },
  };
}
