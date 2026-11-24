// Momentos de colocón: de vez en cuando, en el humo y con el colocón alto, la sala hace algo raro durante unos
// segundos y vuelve a su sitio. Para meterte en el papel sin cortar nada (pedido del fundador, 23/11):
//   · nunca se mueve tu cámara ni el suelo de verdad, nada te tapa la vista, todo se puede ignorar;
//   · uno cada vez, en baraja sin repetir (criterio §4) y nunca durante una calada o un pase.
// 24/11 («peak para jugar fumado»): escalan con el colocón (más seguidos y más intensos) y una calada fuerte
// adelanta el siguiente. Nuevos: el suelo líquido, la criatura del humo que cruza y el latido de la sala.
// En el barrio se usan la sala y la gente de donde estés (enSala); los que piden el tinte de Unaké, solo allí.
import * as THREE from 'three';

const FIGURAS = {
  // puntos (x, y) de -1 a 1 que el humo dibuja delante de ti
  corazon: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]; }),
  estrella: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2, r = (Math.floor(i / (n / 10)) % 2) ? 0.45 : 1; return [Math.sin(t) * r, Math.cos(t) * r]; }),
  infinito: n => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [Math.cos(t) / (1 + Math.sin(t) ** 2), Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) ** 2) * 1.4]; }),
  eme: n => { const v = [[-1, -1], [-1, 1], [0, 0], [1, 1], [1, -1]], out = []; for (let i = 0; i < n; i++) { const k = i / (n - 1) * 4, a = Math.floor(Math.min(3, k)), f = k - a; out.push([v[a][0] + (v[a + 1][0] - v[a][0]) * f, v[a][1] + (v[a + 1][1] - v[a][1]) * f]); } return out; },
  espiral: n => Array.from({ length: n }, (_, i) => { const k = i / n, t = k * Math.PI * 5; return [Math.cos(t) * k, Math.sin(t) * k]; }),
  // una cara sonriente: contorno, dos ojos y la sonrisa
  cara: n => {
    const out = [], c = Math.round(n * 0.55), s = Math.round(n * 0.3);
    for (let i = 0; i < c; i++) { const t = i / c * Math.PI * 2; out.push([Math.cos(t), Math.sin(t)]); }
    for (let i = 0; i < s; i++) { const t = Math.PI * (1.15 + 0.7 * i / (s - 1)); out.push([Math.cos(t) * 0.55, Math.sin(t) * 0.55 - 0.05]); }
    out.push([-0.35, 0.35], [-0.35, 0.28], [0.35, 0.35], [0.35, 0.28]);
    return out;
  },
};

// el suelo líquido: un disco a ras de suelo con ondas y cáusticas (aditivo, muy suave)
const SUELO_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SUELO_FRAG = /* glsl */`
  uniform float uT, uK;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float onda = pow(0.5 + 0.5 * sin(d * 7.0 - uT * 2.6), 6.0);
    float caus = pow(abs(sin(vP.x * 3.1 + uT * 0.7 + sin(vP.y * 2.3 - uT)) * sin(vP.y * 3.4 - uT * 0.9 + sin(vP.x * 1.9 + uT * 0.6))), 3.0);
    vec3 col = mix(vec3(0.35, 0.15, 0.9), vec3(0.2, 0.95, 0.9), 0.5 + 0.5 * sin(d * 1.3 - uT * 0.8));
    float a = uK * (onda * 0.5 + caus * 0.45) * (1.0 - smoothstep(2.2, 4.4, d)) * smoothstep(0.1, 0.5, d) * 1.6;
    gl_FragColor = vec4(col * a, 1.0);
  }`;

// los ojos de la criatura: un solo sprite con los dos dibujados
let OJOS = null;
function texOjos() {
  if (OJOS) return OJOS;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (const x of [36, 92]) {
    g.fillStyle = '#fffaf0'; g.strokeStyle = '#140c1c'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(x, 32, 22, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#140c1c'; g.beginPath(); g.arc(x + 5, 36, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 9, 31, 3.5, 0, Math.PI * 2); g.fill();
  }
  OJOS = new THREE.CanvasTexture(c); OJOS.colorSpace = THREE.SRGBColorSpace;
  return OJOS;
}

const TODOS = ['neon', 'monchis', 'figura', 'miradas', 'estrellas', 'respira', 'liquido', 'criatura', 'latido'];
const SOLO_UNAKE = ['neon', 'respira']; // piden el tinte del shader de Unaké (decorado.js)

export class Viaje {
  constructor({ escena, humo, sala, personajes, fisica, sonido, xr, img }) {
    Object.assign(this, { escena, humo, sala, personajes, fisica, sonido, xr, img });
    this.activo = null; this.espera = 40; this.t = 0; this.baraja = []; this.colocon = 0; this._antes = 0;
    this.salaBarrio = null; this.genteBarrio = null;
    this.grupo = new THREE.Group(); this.grupo.name = 'viaje'; escena.add(this.grupo);
  }

  // en el barrio: los momentos usan la sala y la gente de donde estás (null al salir)
  enSala(sala, gente = null) { this.salaBarrio = sala || null; this.genteBarrio = gente; }
  get S() { return this.salaBarrio || this.sala; }
  get gente() { return (this.salaBarrio ? this.genteBarrio : this.personajes)?.filter(p => p?.grupo?.visible) || []; }
  // 0,75 con el colocón justo; 1,3 a tope
  get intensidad() { return 0.75 + THREE.MathUtils.clamp((this.colocon - 40) / 60, 0, 1) * 0.55; }

  _siguiente() {
    if (!this.baraja.length) this.baraja = [...TODOS].sort(() => Math.random() - 0.5);
    for (let i = this.baraja.length - 1; i >= 0; i--) {
      const t = this.baraja[i];
      if (this.salaBarrio && SOLO_UNAKE.includes(t)) continue;
      if (t === 'miradas' && this.gente.length < 1) continue;
      this.baraja.splice(i, 1); return t;
    }
    return 'figura';
  }

  // llamar cada fotograma; `puede` = estás en el humo, colocón alto y nada importante pasando
  actualizar(dt, { puede, colocon }) {
    this.t += dt;
    // una calada fuerte (el colocón pega un salto) adelanta el siguiente momento
    const salto = colocon - this._antes; this._antes = colocon; this.colocon = colocon;
    if (salto >= 6 && colocon >= 35 && !this.activo) this.espera = Math.min(this.espera, 3 + Math.random() * 4);
    if (this.activo) {
      const a = this.activo; a.t += dt;
      const k = Math.min(1, a.t / 1.5) * Math.min(1, (a.dur - a.t) / 2); // entra y sale suave
      try { a.paso?.(dt, Math.max(0, k) * this.intensidad, a.t); } catch (e) { console.error('[viaje]', e); a.t = a.dur; }
      if (a.t >= a.dur) {
        try { a.fin?.(); } catch (e) { console.error(e); }
        this.activo = null; this.espera = (60 + Math.random() * 60) * (colocon > 75 ? 0.6 : 1);
      }
      return;
    }
    if (!puede || colocon < 40) return;
    this.espera -= dt * (1 + THREE.MathUtils.clamp((colocon - 40) / 40, 0, 1));
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
      return { dur: 15, paso: (dt, k, t) => this.S.efectos?.({ tono: k * (1.4 + Math.sin(t * 0.6) * 0.9), onda: k * 0.6, t }), fin: () => this.S.efectos?.({}) };
    },
    // una onda de luz que respira desde donde estás
    respira() {
      return { dur: 12, paso: (dt, k, t) => this.S.efectos?.({ onda: Math.min(1.2, k), t }), fin: () => this.S.efectos?.({}) };
    },
    // llueven chuches del techo, despacio: se pueden coger (y comer: a la boca)
    monchis() {
      const nombres = ['caramelo.png', 'patatas.png', 'obj-donut.png', 'obj-caramelo.png', 'obj-pizza.png'];
      const cuerpos = [];
      let cada = 0, n = 0;
      const tope = Math.round(12 + this.intensidad * 8);
      this.sonido('tiroriro', { volumen: 0.4 });
      const caer = async () => {
        const tex = await this.img(nombres[Math.floor(Math.random() * nombres.length)]);
        const asp = tex.image.width / tex.image.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11 * asp, 0.11), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
        const cab = this.xr.cabeza, f = this.xr.adelante.clone().setY(0).normalize(), lado = new THREE.Vector3(-f.z, 0, f.x);
        const r = 0.35 + Math.random() * 1.0, x = (Math.random() - 0.5) * 1.6;
        m.position.copy(cab).addScaledVector(f, r).addScaledVector(lado, x); m.position.y = Math.min(2.6, cab.y + 0.9);
        this.grupo.add(m);
        const c = this.fisica.anadir(m, { radio: 0.05, rebote: 0.3, datos: { chuche: true }, gravedad: 0.045 });
        c.giro.set(Math.random() * 2, Math.random() * 2, 0);
        cuerpos.push(c);
      };
      return {
        dur: 16,
        paso: (dt, k, t) => {
          cada -= dt;
          if (t < 10 && cada <= 0 && n < tope) { cada = 0.5; n++; caer(); }
          // comerse una: llevarla a la boca
          const boca = this.xr.boca();
          for (const c of cuerpos) {
            if (c.comida) continue;
            if (c.obj.position.distanceTo(boca) < 0.12) { c.comida = true; c.cogido?.vibrar(0.5, 50); this.sonido('nam', { volumen: 0.6 }); c.obj.visible = false; this.fisica.quitar(c); }
          }
        },
        // lo que no te has comido se queda en el suelo un rato y se va
        fin: () => setTimeout(() => { for (const c of cuerpos) { this.fisica.quitar(c); this.grupo.remove(c.obj); c.obj.geometry.dispose(); c.obj.material.dispose(); } }, 20000),
      };
    },
    // el humo dibuja una figura delante de ti (más grande y más densa cuanto más colocón)
    figura(cab, f) {
      const nombres = Object.keys(FIGURAS), nombre = nombres[Math.floor(Math.random() * nombres.length)];
      const n = Math.round(30 + this.intensidad * 14), esc = 0.34 + this.intensidad * 0.1;
      const pts = FIGURAS[nombre](n), lado = new THREE.Vector3(-f.z, 0, f.x);
      const centro = cab.clone().addScaledVector(f, 1.3); centro.y = cab.y + 0.1;
      pts.forEach(([x, y], i) => setTimeout(() => {
        this.humo.soltar({ pos: centro.clone().addScaledVector(lado, x * esc).add(new THREE.Vector3(0, y * esc, 0)), vel: new THREE.Vector3(0, 0.01, 0), tam: 0.06, vida: 7, crece: 0.012, sube: 0.004, frena: 2, brillo: 0.7, alfa: 0.95, tuyo: false });
      }, i * 40));
      this.sonido('oooh', { volumen: 0.35 });
      return { dur: 8 };
    },
    // todos se quedan mirándote en silencio… y alguien explota de risa
    miradas() {
      const gente = this.gente, [a] = gente, b = gente[1] || a;
      const antes = gente.map(p => p.giroMax);
      gente.forEach(p => { p.giroMax = 1.5; p.pose('fumado', { rebote: 0.1 }); });
      let reido = false;
      return {
        dur: 9,
        paso: (dt, k, t) => {
          if (!reido && t > 4.2 && a) { reido = true; a.pose('risa-floja', { rebote: 0.3 }); this.sonido(a.id === 'lasslow' ? 'risa-lasslow' : 'risas', { en: a.grupo, volumen: 0.7 }); setTimeout(() => b.decir('…¿Qué?'), 900); }
        },
        fin: () => gente.forEach((p, i) => { p.giroMax = antes[i]; p.pose('base', { rebote: 0.1 }); }),
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
        paso: (dt, k, t) => { mat.opacity = Math.min(1, k * (0.75 + Math.sin(t * 5) * 0.2)); pts.rotation.y += dt * 0.03; this.S.efectos?.({ tono: 0, onda: 0, t }); this.S.luz?.(1 - Math.min(1, k) * 0.35); },
        fin: () => { this.grupo.remove(pts); geo.dispose(); mat.dispose(); this.S.luz?.(1); },
      };
    },
    // el suelo se vuelve líquido: ondas de colores salen de tus pies y las cáusticas bailan (el suelo no se mueve)
    liquido(cab) {
      const geo = new THREE.CircleGeometry(4.5, 64);
      const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 0 } }, vertexShader: SUELO_VERT, fragmentShader: SUELO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(cab.x, (this.fisica.sueloY ?? 0) + 0.012, cab.z); m.renderOrder = 3;
      this.grupo.add(m);
      this.sonido('chapoteo', { volumen: 0.3, tono: 0.7 });
      let gota = 2;
      return {
        dur: 12,
        paso: (dt, k, t) => {
          mat.uniforms.uT.value = t; mat.uniforms.uK.value = Math.min(1.1, k * 0.85);
          // los pies: el centro te sigue despacio
          m.position.x += (this.xr.cabeza.x - m.position.x) * Math.min(1, dt * 0.8); m.position.z += (this.xr.cabeza.z - m.position.z) * Math.min(1, dt * 0.8);
          if ((gota -= dt) <= 0) { gota = 2.5 + Math.random() * 2; this.sonido('goteo', { volumen: 0.25, tono: 0.6 + Math.random() * 0.4 }); }
        },
        fin: () => { this.grupo.remove(m); geo.dispose(); mat.dispose(); },
      };
    },
    // una criatura de humo cruza la sala por delante de ti, te mira al pasar y se deshace en volutas
    criatura(cab, f) {
      const lado = new THREE.Vector3(-f.z, 0, f.x), dist = 1.6 + Math.random() * 0.4, sentido = Math.random() < 0.5 ? 1 : -1;
      const N = 12, SEP = 8, cuerpo = [], hist = [];
      const sitio = (t, dest) => { // de un lado a otro, ondulando
        const x = sentido * (-2.6 + t * 0.42);
        return dest.copy(cab).addScaledVector(f, dist + Math.sin(t * 0.7) * 0.3).addScaledVector(lado, x).setY(cab.y + 0.1 + Math.sin(t * 1.6) * 0.15);
      };
      for (let i = 0; i < N; i++) {
        const tam = 0.34 * (1 - i / N * 0.7);
        cuerpo.push(this.humo.soltar({ pos: sitio(0, new THREE.Vector3()), tam, vida: 99, crece: 0, sube: 0, frena: 0, brillo: 0.55 + (i === 0 ? 0.2 : 0), alfa: 0.9, tamMax: tam, tuyo: false }));
      }
      const ojos = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOjos(), transparent: true, depthWrite: false }));
      ojos.scale.set(0.24, 0.12, 1); ojos.renderOrder = 11; this.grupo.add(ojos);
      this.sonido('suspiro', { volumen: 0.35, tono: 0.8 });
      let estela = 0, mira = false, parpadeo = 3;
      const p = new THREE.Vector3();
      return {
        dur: 13,
        paso: (dt, k, t) => {
          sitio(t, p); hist.unshift(p.clone()); if (hist.length > N * SEP) hist.pop();
          cuerpo.forEach((b, i) => { const h = hist[Math.min(hist.length - 1, i * SEP)]; b.pos.copy(h); b.pos.y += Math.sin(t * 3 + i * 0.7) * 0.02; b.alfa = 0.9 * Math.min(1, k * 1.3); });
          // los ojos en la cabeza, girados hacia ti; al pasar por delante, te mira y parpadea
          ojos.position.copy(hist[0]).addScaledVector(this.xr.cabeza.clone().sub(hist[0]).normalize(), 0.16);
          ojos.material.opacity = Math.min(1, k * 1.3);
          parpadeo -= dt; ojos.scale.y = parpadeo < 0.12 && parpadeo > 0 ? 0.018 : 0.12; if (parpadeo < 0) parpadeo = 2 + Math.random() * 2.5;
          if (!mira && Math.abs(t * 0.42 - 2.6) < 0.25) { mira = true; this.sonido('blurp', { en: ojos, volumen: 0.5, tono: 0.7 }); }
          if ((estela -= dt) <= 0) { estela = 0.12; const c = hist[hist.length - 1]; this.humo.soltar({ pos: c, vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1), tam: 0.05, vida: 1.8, crece: 0.08, sube: 0.03, frena: 1, brillo: 0.4, alfa: 0.5 * Math.min(1, k), tuyo: false }); }
        },
        fin: () => { for (const b of cuerpo) { b.vida = b.edad + 0.9; b.vel.set((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3); b.crece = 0.2; b.tamMax = 0.6; } this.grupo.remove(ojos); ojos.material.dispose(); },
      };
    },
    // la sala late: un corazón que suena, la luz que palpita con él y la gente que rebota a cada golpe
    latido() {
      const bpm = 64 + Math.round(this.intensidad * 14), periodo = 60 / bpm;
      let fase = 0, n = 0;
      return {
        dur: 11,
        paso: (dt, k, t) => {
          fase += dt;
          if (fase >= periodo) {
            fase -= periodo; n++;
            this.sonido('latido', { volumen: Math.min(0.55, 0.15 + k * 0.35) });
            if (n % 2) for (const p of this.gente) p.empujon(0.035 * Math.min(1.3, k));
          }
          const pulso = Math.exp(-fase * 7) + 0.6 * Math.exp(-Math.max(0, fase - 0.22) * 9) * (fase > 0.22 ? 1 : 0);
          this.S.luz?.(1 - Math.min(1, k) * 0.28 + pulso * Math.min(1, k) * 0.3);
          this.S.efectos?.({ onda: pulso * Math.min(1, k) * 0.5, t });
        },
        fin: () => { this.S.luz?.(1); this.S.efectos?.({}); },
      };
    },
  };
}
