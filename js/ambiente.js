// Sonido ambiente de cada sala, en el espacio (24/11): el murmullo del bar sale del fondo, la nevera de la tienda
// zumba en su rincón, la gotera del baño gotea en su esquina, los grillos del techo vienen de los lados y la calle
// suena lejos y apagada. Bucles con THREE.PositionalAudio (unos 2-4 por sala) más golpes sueltos de vez en cuando
// (vasos, risas, una bocina lejana) con el sonido() de recursos.js. Todo bajito, con fundidos de 1-2 s.
// La música sigue la regla del 2D (base/js/musica.js → Musica.hueco): de día «dia»; en el humo, «unake» dentro
// del bar (dentro, reservado, cocina, baño, techo) y «noche» en la calle.
//
//   const ambiente = new Ambiente({ oyente, sonido, musica });
//   ambiente.entrar('tienda', 'humo', sala)         sala = { grupo, medidas } (la del barrio o unake)
//   ambiente.entrar('dentro', 'humo', unake, { musica: false })   el bar del humo sin tocar la música
//   ambiente.salir()                                al volver a tu casa
//   ambiente.actualizar(dt)                         cada fotograma (los golpes sueltos)
import * as THREE from 'three';

const DENTRO_BAR = ['dentro', 'reservado', 'cocina', 'bano', 'techo'];

// bucles: [sonido, x, y, z, volumen, { filtro (Hz, paso bajo), tono, soloHumo, soloDia }]
// golpes: [sonido, cada (s mín), cada (s máx), volumen, { tono, soloHumo }]
// Posiciones en el sistema de la sala: x de xl a xr, y hacia arriba, z = −D es la pared del fondo.
const SALAS = {
  dentro: {
    bucles: [['ambiente-bar', 0, 1.2, 'fondo', 0.22], ['neon', 'der', 'alto', 'medio', 0.05, { soloHumo: true }]],
    golpes: [['cristal', 9, 22, 0.1, { tono: 1.3 }], ['risa-fondo', 18, 40, 0.14], ['sorbo', 25, 50, 0.12]],
  },
  reservado: {
    bucles: [['ambiente-bar', 'izq', 1.2, 'medio', 0.12, { filtro: 700 }], ['neon', 'der', 'alto', 'fondo', 0.05]],
    golpes: [['risa-fondo', 22, 45, 0.1], ['cristal', 15, 30, 0.07, { tono: 1.2 }]],
  },
  cocina: {
    bucles: [['#nevera', 'der', 0.7, 'fondo', 0.09], ['ambiente-bar', 'izq', 1.2, 'cerca', 0.08, { filtro: 500 }]],
    golpes: [['goteo', 4, 9, 0.22, { tono: 0.9 }], ['lata', 30, 60, 0.08, { tono: 0.8 }]],
  },
  bano: {
    bucles: [['#nevera', 0, 'alto', 'medio', 0.03, { tono: 2 }], ['ambiente-bar', 0, 1.2, 'cerca', 0.06, { filtro: 380 }]],
    golpes: [['goteo', 1.6, 3.4, 0.3], ['goteo', 5, 9, 0.18, { tono: 1.25 }]],
  },
  techo: {
    bucles: [['grillos', 'izq', 0.4, 'medio', 0.18], ['grillos', 'der', 0.4, 'fondo', 0.14, { tono: 0.92 }], ['#calle', 0, 0, 'fondo', 0.1, { filtro: 380 }]],
    golpes: [['bocina', 30, 70, 0.05, { tono: 0.85 }]],
  },
  cuarto: {
    bucles: [['#calle', 'der', 1.4, 'fondo', 0.06, { filtro: 420 }], ['#nevera', 'izq', 0.5, 'fondo', 0.025, { tono: 1.5 }]],
    golpes: [['bocina', 40, 90, 0.04, { tono: 0.9 }]],
  },
  plaza: {
    bucles: [['#calle', 'izq', 0.5, 'fondo', 0.14, { filtro: 520 }], ['grillos', 'der', 0.3, 'medio', 0.1, { soloHumo: true }]],
    golpes: [['bocina', 20, 45, 0.08, { tono: 0.9 }], ['risas', 35, 70, 0.07, { tono: 0.9 }]],
  },
  fuera: {
    bucles: [['#calle', 'der', 0.5, 'fondo', 0.15, { filtro: 560 }], ['zumbido-m', 'izq', 'alto', 'medio', 0.07, { soloHumo: true, tono: 0.7 }], ['ambiente-bar', 0, 1.2, 'fondo', 0.09, { filtro: 450, soloHumo: true }]],
    golpes: [['bocina', 18, 40, 0.09, { tono: 0.95 }], ['risa-fondo', 30, 60, 0.07]],
  },
  tienda: {
    bucles: [['#nevera', 'izq', 0.9, 'fondo', 0.12], ['neon', 0, 'alto', 'medio', 0.04, { tono: 0.8 }], ['#calle', 0, 0.6, 'cerca', 0.05, { filtro: 400 }]],
    golpes: [['papel', 25, 50, 0.08], ['lata', 30, 60, 0.07]],
  },
  feria: {
    bucles: [['#calle', 0, 0.5, 'fondo', 0.08, { filtro: 300 }], ['risa-fondo', 'izq', 1.4, 'fondo', 0.1, { filtro: 1800 }]],
    golpes: [['risas', 6, 14, 0.12], ['tiroriro', 18, 35, 0.1, { tono: 0.9 }], ['campanita', 12, 26, 0.08, { tono: 0.8 }], ['platillo', 25, 50, 0.06]],
  },
};

export class Ambiente {
  constructor({ oyente, sonido, musica }) {
    this.oyente = oyente; this.sonidoSuelto = sonido; this.musica = musica;
    this.buffers = new Map(); this.activos = []; this.golpes = []; this.anclas = []; this.sala = null; this.id = null;
    this._turno = 0;
  }
  get ctx() { return this.oyente.context; }

  _buffer(nombre) {
    if (!this.buffers.has(nombre)) {
      const p = nombre.startsWith('#') ? Promise.resolve(this._sintetico(nombre))
        : fetch(`base/assets/snd/${nombre}.mp3`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b));
      this.buffers.set(nombre, p);
      p.catch(() => this.buffers.delete(nombre));
    }
    return this.buffers.get(nombre);
  }
  // los que no hay en el 2D, hechos aquí (mono, 22 kHz, 2-3 s en bucle sin costura: ~250 KB cada uno)
  _sintetico(nombre) {
    const sr = 22050, seg = nombre === '#calle' ? 3 : 2, n = sr * seg, b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    if (nombre === '#nevera') {
      // zumbido eléctrico: 50 Hz con armónicos y un temblor lento (frecuencias enteras → el bucle casa)
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 50 * t) * 0.5 + Math.sin(2 * Math.PI * 100 * t) * 0.35 + Math.sin(2 * Math.PI * 150 * t) * 0.12 + Math.sin(2 * Math.PI * 250 * t) * 0.05) * (0.8 + 0.2 * Math.sin(2 * Math.PI * t)) * 0.6; }
    } else {
      // la calle lejos: ruido marrón (rumor de tráfico) con oleadas lentas de coches que pasan
      let ult = 0;
      for (let i = 0; i < n; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3.5; }
      for (let i = 0; i < n; i++) { const t = i / sr; d[i] *= 0.65 + 0.35 * Math.sin(2 * Math.PI * t / seg) ** 2; }
      const f = 2000; for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; } // costura
    }
    return b;
  }

  _donde(v, m, eje) {
    if (typeof v === 'number') return v;
    const D = m?.D ?? 3, xl = m?.xl ?? -2, xr = m?.xr ?? 2, alto = m?.alto ?? 2.6;
    return { izq: xl + 0.4, der: xr - 0.4, alto: Math.max(1.6, alto - 0.3), fondo: -D + 0.3, medio: -D * 0.5, cerca: Math.min(0.8, m?.zCerca ?? 0.5) }[v] ?? 0;
  }

  // entrar en una sala: funde lo anterior y arranca lo suyo
  entrar(id, mundo, sala, { musica = true } = {}) {
    if (musica && this.musica) this.musica(mundo !== 'humo' ? 'dia' : DENTRO_BAR.includes(id) ? 'unake' : 'noche', mundo !== 'humo' ? 0.25 : 0.3);
    if (this.id === id && this.sala === sala && this.mundo === mundo) return;
    this.salir();
    const def = SALAS[id]; if (!def || !sala?.grupo || !this.oyente?.context) return;
    this.id = id; this.sala = sala; this.mundo = mundo;
    const turno = ++this._turno, humo = mundo === 'humo', m = sala.medidas, dia = humo ? 1 : 0.75;
    for (const [nombre, x, y, z, vol, o = {}] of def.bucles) {
      if ((o.soloHumo && !humo) || (o.soloDia && humo)) continue;
      const ancla = new THREE.Object3D(); ancla.position.set(this._donde(x, m), this._donde(y, m), this._donde(z, m));
      sala.grupo.add(ancla); this.anclas.push(ancla);
      this._buffer(nombre).then(b => {
        if (turno !== this._turno) return;
        const f = new THREE.PositionalAudio(this.oyente);
        f.setRefDistance(1.2); f.setRolloffFactor(0.8); f.setDistanceModel('inverse');
        f.setBuffer(b); f.setLoop(true); f.setPlaybackRate(o.tono ?? 1);
        if (o.filtro) { const bq = this.ctx.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = o.filtro; f.setFilter(bq); }
        f.gain.gain.value = 0; ancla.add(f);
        // cada bucle empieza en un punto al azar: dos salas con el mismo sonido no suenan clonadas
        f.offset = Math.random() * b.duration * 0.9; f.play();
        f.gain.gain.setTargetAtTime(vol * dia, this.ctx.currentTime, 0.6);
        this.activos.push(f);
      }).catch(() => { });
    }
    for (const [nombre, min, max, vol, o = {}] of def.golpes) {
      if (o.soloHumo && !humo) continue;
      this.golpes.push({ nombre, min, max, vol: vol * dia, tono: o.tono ?? 1, t: min * (0.3 + Math.random() * 0.7) });
    }
  }

  salir() {
    this._turno++;
    const ctx = this.oyente?.context;
    for (const f of this.activos) {
      try { f.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.35); } catch { }
      setTimeout(() => { try { f.stop(); } catch { } f.parent?.remove(f); try { f.disconnect(); } catch { } }, 1800);
    }
    const anclas = this.anclas; setTimeout(() => { for (const a of anclas) a.parent?.remove(a); }, 1900);
    this.activos = []; this.golpes = []; this.anclas = []; this.sala = null; this.id = null; this.mundo = null;
  }

  // los golpes sueltos: suenan en un punto al azar de la sala (de fondo, nunca encima de ti)
  actualizar(dt) {
    if (!this.sala) return;
    const m = this.sala.medidas;
    for (const g of this.golpes) {
      g.t -= dt; if (g.t > 0) continue;
      g.t = g.min + Math.random() * (g.max - g.min);
      const D = m?.D ?? 3, xl = m?.xl ?? -2, xr = m?.xr ?? 2;
      // un ancla por golpe (el sonido se queda en su sitio mientras suena) y se quita a los 10 s
      const ancla = new THREE.Object3D(); ancla.position.set(xl + Math.random() * (xr - xl), 0.6 + Math.random() * 1.2, -D * (0.4 + Math.random() * 0.6));
      this.sala.grupo.add(ancla);
      this.sonidoSuelto(g.nombre, { en: ancla, volumen: g.vol, tono: g.tono * (0.93 + Math.random() * 0.14) });
      setTimeout(() => ancla.parent?.remove(ancla), 10000);
    }
  }
}
