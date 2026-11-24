// Las piezas de la decoración 3D: cada función apunta una cosa en el kit (js/barrio/deco/kit.js).
// Medidas en metros, coordenadas locales de la sala (y = 0 es el suelo). `n` = de noche (el humo).
// Cada pieza deja su huella (x, z, radio, altura) en k.huellas para comprobar que no tapa puertas ni gente.
import { forma, colgar, PALETA } from './kit.js';

const P = PALETA;
const huella = (k, nombre, x, z, r, alto) => { (k.huellas ||= []).push({ nombre, x, z, r, alto }); };

// lámpara colgante: cable, pantalla, bombilla con halo, haz de luz con polvo y charco de luz en el suelo
export function lampara(k, { x, z, techo, largo = 0.8, pantalla = P.morado, luz = '#ffd98a', fase = 0, suelo = 0, haz = true, fuerza = 1 }) {
  const n = k.noche, yb = techo - largo, an = [techo, 0.05, fase, n ? 1 : 0];
  k.solido(forma.cil(0.006, 0.006, largo, 5), P.tinta, { p: [x, techo - largo / 2, z], anim: an, linea: false });
  k.solido(forma.cil(0.045, 0.19, 0.17, 16), pantalla, { p: [x, yb + 0.02, z], anim: an });
  k.solido(forma.esf(0.05, 10, 6), '#fff1b8', { p: [x, yb - 0.07, z], anim: an, emis: n ? 1 : 0.6, linea: false });
  k.halo([x, yb - 0.08, z], luz, n ? 0.32 * fuerza : 0.14, an);
  if (haz) {
    const h = yb - 0.1 - suelo;
    k.brillo(CylinderAbierto(0.16, 0.85, h), luz, { modo: 'cono', fuerza: (n ? 0.26 : 0.1) * fuerza, p: [x, suelo + h / 2, z], anim: an });
    k.charco(x, z, 0.8, 0.8, luz, (n ? 0.22 : 0.08) * fuerza, suelo + 0.006);
    k.particulas({ tipo: 'polvo', n: n ? 14 : 8, centro: [x, suelo + h * 0.45, z], caja: [0.3, h * 0.38, 0.3], mueve: [0.08, 0.1, 0.08], color: luz, tam: 0.008, azar: x * 7 + z * 3 + 11 });
  }
  k.luz([x, yb - 0.25, z], luz, 2.0, n ? 0.9 * fuerza : 0.35);
  huella(k, 'lampara', x, z, 0.2, -yb); // alto negativo = cuelga desde yb (no estorba abajo)
}
// el cono abierto (sin tapas) para los haces de luz
function CylinderAbierto(rt, rb, h, seg = 20) { const g = forma.cil(rt, rb, h, seg); return quitarTapas(g, seg); }
function quitarTapas(g, seg) {
  // CylinderGeometry: primero el lateral (grupos[0]); las tapas van después en el índice
  const lateral = g.groups[0]; g.setIndex(Array.from(g.index.array.slice(lateral.start, lateral.start + lateral.count))); g.clearGroups();
  return g;
}

// tubo de neón: alma encendida + brillo aditivo alrededor
export function neon(k, puntos, color, { r = 0.012, parpadeo = 2, fase = 0, curva = true, fuerza = 1 } = {}) {
  const n = k.noche, an = [0, 0, fase, n ? parpadeo : 0];
  k.solido(forma.tubo(puntos, r, { curva }), n ? color : '#d8d0e0', { emis: n ? 1 : 0, anim: an, linea: !n });
  if (n) k.brillo(forma.tubo(puntos, r * 5, { curva, radial: 8 }), color, { fuerza: 1.1 * fuerza, anim: an });
}

// fluorescente de techo (a lo largo de x, o girado con rotY) con su haz rectangular
export function fluorescente(k, { x, y, z, largo = 1.2, rotY = 0, color = '#d8fbff', parpadeo = 0, fase = 0, haz = true, suelo = 0 }) {
  const n = k.noche, an = [0, 0, fase, parpadeo];
  k.solido(forma.caja(largo + 0.08, 0.05, 0.16), '#8e8aa0', { p: [x, y + 0.03, z], r: [0, rotY, 0] });
  k.solido(forma.cil(0.022, 0.022, largo, 8), color, { p: [x, y - 0.02, z], r: [0, rotY, Math.PI / 2], emis: 1, anim: an, linea: false });
  k.brillo(forma.cil(0.08, 0.08, largo + 0.1, 10, 1), color, { fuerza: n ? 0.6 : 0.3, p: [x, y - 0.02, z], r: [0, rotY, Math.PI / 2], anim: an });
  if (haz) {
    const h = y - 0.05 - suelo;
    // un cono aplastado: estrecho a lo ancho del tubo arriba y ovalado abajo
    k.brillo(CylinderAbierto(0.1, 0.24, h, 18), color, { modo: 'cono', fuerza: n ? 0.24 : 0.1, p: [x, suelo + h / 2, z], r: [0, rotY, 0], s: [largo / 0.2, 1, 3.2], anim: an });
    k.particulas({ tipo: 'polvo', n: 10, centro: [x, suelo + h * 0.5, z], caja: [largo * 0.45, h * 0.35, 0.35], mueve: [0.08, 0.08, 0.08], color, tam: 0.007, azar: z * 13 + 5 });
  }
  k.luz([x, y - 0.4, z], color, 2.4, n ? 0.7 : 0.25);
}

export function taburete(k, x, z, { asiento = P.rosa, alto = 0.72 } = {}) {
  k.solido(forma.cil(0.19, 0.19, 0.07, 16), asiento, { p: [x, alto, z] });
  k.solido(forma.cil(0.03, 0.03, alto - 0.04, 8), '#b8b4c8', { p: [x, alto / 2, z], linea: false });
  k.solido(forma.toro(0.15, 0.012, 5, 16), '#b8b4c8', { p: [x, alto * 0.35, z], r: [Math.PI / 2, 0, 0], linea: false });
  k.solido(forma.cil(0.2, 0.22, 0.03, 16), '#5a5470', { p: [x, 0.015, z] });
  k.sombra(x, z, 0.3, 0.3, 0.5); huella(k, 'taburete', x, z, 0.22, alto);
}

const VIDRIOS = ['#3fbf6a', '#c9772f', '#5fd0ff', '#ff5fa2', '#e8e0b0', '#8a3a3a'];
export function botella(k, x, y, z, i = 0, alto = 0.3) {
  const c = VIDRIOS[i % VIDRIOS.length], n = k.noche;
  k.solido(forma.cil(0.036, 0.038, alto * 0.6, 10), c, { p: [x, y + alto * 0.3, z], emis: n ? 0.35 : 0 });
  k.solido(forma.cil(0.014, 0.036, alto * 0.14, 10), c, { p: [x, y + alto * 0.67, z], emis: n ? 0.35 : 0, linea: false });
  k.solido(forma.cil(0.013, 0.013, alto * 0.22, 6), c, { p: [x, y + alto * 0.85, z], emis: n ? 0.35 : 0 });
  k.solido(forma.cil(0.016, 0.016, 0.025, 6), i % 2 ? P.amarillo : '#d03050', { p: [x, y + alto * 0.97, z], linea: false });
  k.solido(forma.caja(0.008, alto * 0.42, 0.004), '#ffffff', { p: [x - 0.018, y + alto * 0.33, z + 0.035], emis: 0.9, linea: false });
  k.solido(forma.caja(0.05, alto * 0.18, 0.004), i % 3 ? P.crema : P.amarillo, { p: [x, y + alto * 0.25, z + 0.037], linea: false });
}
export function vaso(k, x, y, z, { color = '#bfe8ff', alto = 0.1, liquido = '#ffb02e' } = {}) {
  k.solido(forma.cil(0.035, 0.028, alto, 10), color, { p: [x, y + alto / 2, z], emis: k.noche ? 0.3 : 0 });
  k.solido(forma.cil(0.03, 0.026, alto * 0.55, 10), liquido, { p: [x, y + alto * 0.3, z + 0.004], emis: k.noche ? 0.5 : 0.1, linea: false });
}

// planta en maceta: hojas alargadas que salen del centro
export function planta(k, x, z, { s = 1, maceta = '#c0643a', hoja = '#3f9a5a', y = 0, hojas = 9 } = {}) {
  k.solido(forma.cil(0.15 * s, 0.11 * s, 0.28 * s, 12), maceta, { p: [x, y + 0.14 * s, z] });
  k.solido(forma.cil(0.165 * s, 0.165 * s, 0.05 * s, 12), maceta, { p: [x, y + 0.26 * s, z], linea: false });
  k.solido(forma.cil(0.13 * s, 0.13 * s, 0.01, 10), '#4a3226', { p: [x, y + 0.285 * s, z], linea: false });
  for (let i = 0; i < hojas; i++) {
    const a = i * 2.4, inc = 0.5 + (i % 3) * 0.28, l = (0.32 + (i % 4) * 0.08) * s;
    const dx = Math.sin(a) * Math.sin(inc) * l * 0.5, dz = Math.cos(a) * Math.sin(inc) * l * 0.5, dy = Math.cos(inc) * l * 0.5;
    k.solido(forma.esf(1, 8, 5), i % 2 ? hoja : '#5bb86a', { p: [x + dx, y + 0.29 * s + dy, z + dz], r: [inc, a, 0], s: [0.06 * s, l / 2, 0.022 * s] });
  }
  k.sombra(x, z, 0.3 * s, 0.3 * s, 0.55); huella(k, 'planta', x, z, 0.3 * s, 0.9 * s);
}

export function caja(k, x, z, { w = 0.45, h = 0.35, d = 0.4, rot = 0, color = '#c49a62', y = 0 } = {}) {
  k.solido(forma.caja(w, h, d), color, { p: [x, y + h / 2, z], r: [0, rot, 0] });
  k.solido(forma.caja(w + 0.004, 0.004, 0.07), '#e8d6a8', { p: [x, y + h + 0.002, z], r: [0, rot, 0], linea: false });
  if (y === 0) k.sombra(x, z, w * 0.75, d * 0.75, 0.6);
  huella(k, 'caja', x, z, Math.hypot(w, d) / 2, y + h);
}

// guirnalda entre a y b: de noche bombillas que titilan; de día banderines
export function guirnalda(k, a, b, { caida = 0.45, bombillas = 12, colores = [P.amarillo, P.rosa, P.neon, P.crema], fase = 0 } = {}) {
  const n = k.noche, pts = colgar(a, b, caida, 16);
  k.solido(forma.tubo(pts, 0.006, { radial: 4 }), P.tinta, { linea: false });
  const cat = colgar(a, b, caida, bombillas + 1);
  for (let i = 1; i <= bombillas; i++) {
    const [x, y, z] = cat[i], c = colores[i % colores.length];
    if (n) {
      const an = [0, 0, fase + i * 1.7, 3];
      k.solido(forma.esf(0.035, 8, 6), c, { p: [x, y - 0.05, z], emis: 1, anim: an });
      k.halo([x, y - 0.05, z], c, 0.16, an);
    } else {
      const ang = Math.atan2(b[2] - a[2], b[0] - a[0]);
      k.solido(forma.extruir([[-0.09, 0], [0.09, 0], [0, -0.2]], 0.008), c, { p: [x, y - 0.01, z], r: [0, -ang, 0] });
    }
  }
}
export function poste(k, x, z, alto, color = '#6a4a34') {
  k.solido(forma.cil(0.05, 0.065, alto, 8), color, { p: [x, alto / 2, z] });
  k.solido(forma.cil(0.16, 0.18, 0.1, 8), '#5a5470', { p: [x, 0.05, z] });
  k.sombra(x, z, 0.28, 0.28, 0.6); huella(k, 'poste', x, z, 0.12, alto);
}

// el haz de una farola pintada (o de verdad) con polillas
export function farolaLuz(k, [x, y, z], { luz = '#ffd66a', radio = 1.3 } = {}) {
  const n = k.noche;
  if (!n) return;
  k.halo([x, y, z], luz, 0.9, [0, 0, 0, 1]);
  k.brillo(CylinderAbierto(0.14, radio, y - 0.15, 20), luz, { modo: 'cono', fuerza: 0.3, p: [x, (y - 0.15) / 2, z] });
  k.charco(x, z, radio * 1.1, radio * 1.1, luz, 0.3);
  k.particulas({ tipo: 'polilla', n: 7, centro: [x, y - 0.15, z], caja: [0.12, 0.12, 0.12], mueve: [0.28, 0.14, 0.28], color: '#fff0c0', tam: 0.014, vel: 1.1, azar: 3 });
  k.particulas({ tipo: 'polvo', n: 18, centro: [x, y * 0.45, z], caja: [radio * 0.4, y * 0.35, radio * 0.4], mueve: [0.1, 0.15, 0.1], color: luz, tam: 0.009, azar: 4 });
}

export function paloma(k, x, z, { rot = 0, fase = 0 } = {}) {
  const an = [-200, 0.012, fase, 0], c = Math.cos(rot), s = Math.sin(rot);
  const f = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  k.solido(forma.esf(1, 10, 7), '#8c8aa0', { p: [x, 0.11, z], s: [0.08, 0.075, 0.13], r: [0, rot, 0], anim: an });
  const [hx, hz] = f(0, -0.12);
  k.solido(forma.esf(0.045, 8, 6), '#7a8a9a', { p: [hx, 0.2, hz], anim: an });
  const [bx, bz] = f(0, -0.17);
  k.solido(forma.cono(0.012, 0.04, 5), '#e8a040', { p: [bx, 0.195, bz], r: [-Math.PI / 2, rot, 0], anim: an, linea: false });
  const [cx, cz] = f(0, 0.15);
  k.solido(forma.caja(0.09, 0.015, 0.08), '#6a687e', { p: [cx, 0.13, cz], r: [0.3, rot, 0], anim: an });
  k.sombra(x, z, 0.12, 0.14, 0.5); huella(k, 'paloma', x, z, 0.15, 0.25);
}

export function globo(k, x, z, { y0 = 0.9, alto = 1.9, color = P.rosa, fase = 0 } = {}) {
  const an = [y0, 0.07, fase, 0];
  k.solido(forma.tubo([[x, y0, z], [x + 0.02, (y0 + alto) / 2, z], [x, alto - 0.2, z]], 0.003, { radial: 3 }), '#e8e0ff', { anim: an, linea: false });
  k.solido(forma.esf(1, 14, 10), color, { p: [x, alto, z], s: [0.17, 0.21, 0.17], anim: an, emis: k.noche ? 0.25 : 0 });
  k.solido(forma.cono(0.03, 0.04, 6), color, { p: [x, alto - 0.22, z], r: [Math.PI, 0, 0], anim: an, linea: false });
  k.solido(forma.esf(0.03, 6, 4), '#ffffff', { p: [x - 0.07, alto + 0.08, z + 0.12], anim: an, emis: 0.9, linea: false });
}

export function algodon(k, x, y, z, color = '#ffb0d8') {
  k.solido(forma.cil(0.006, 0.006, 0.3, 4), P.crema, { p: [x, y + 0.15, z], linea: false });
  for (let i = 0; i < 5; i++) k.solido(forma.esf(0.06 + (i % 2) * 0.02, 8, 6), color, { p: [x + Math.sin(i * 2.3) * 0.05, y + 0.36 + Math.cos(i * 1.7) * 0.05, z + Math.cos(i * 2.3) * 0.05], emis: k.noche ? 0.3 : 0 });
}

export function carroAlgodon(k, x, z, rot = 0) {
  const n = k.noche;
  k.solido(forma.caja(0.95, 0.75, 0.55), P.rosa, { p: [x, 0.5, z], r: [0, rot, 0] });
  k.solido(forma.caja(1.0, 0.06, 0.6), P.crema, { p: [x, 0.9, z], r: [0, rot, 0] });
  k.solido(forma.caja(0.97, 0.12, 0.57), P.crema, { p: [x, 0.3, z], r: [0, rot, 0], linea: false });
  const c = Math.cos(rot), s = Math.sin(rot), f = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const dx of [-0.32, 0.32]) {
    const [wx, wz] = f(dx, 0.29);
    k.solido(forma.toro(0.12, 0.03, 6, 14), '#3a3448', { p: [wx, 0.13, wz], r: [0, rot, 0] });
  }
  // palos del toldo y el toldo de rayas
  for (const dx of [-0.42, 0.42]) { const [px, pz] = f(dx, -0.2); k.solido(forma.cil(0.015, 0.015, 0.9, 5), '#d8d0e0', { p: [px, 1.35, pz] }); }
  const [tx, tz] = f(0, -0.05);
  k.solido(forma.cono(0.75, 0.35, 10), P.amarillo, { p: [tx, 1.95, tz], r: [0, rot, 0] });
  for (let i = 0; i < 3; i++) { const [ax, az] = f(-0.25 + i * 0.25, 0); algodon(k, ax, 0.93, az, ['#ffb0d8', '#b8f0ff', '#fff1a0'][i]); }
  if (n) k.luz([tx, 1.5, tz], '#ff8ac4', 1.8, 0.9);
  k.sombra(x, z, 0.75, 0.5, 0.6); huella(k, 'carro', x, z, 0.6, 2.1);
}

export function cubo(k, x, z) {
  k.solido(forma.cil(0.17, 0.14, 0.28, 12), '#f0c030', { p: [x, 0.14, z] });
  k.solido(forma.cil(0.14, 0.14, 0.01, 10), '#7ab0b8', { p: [x, 0.25, z], linea: false, emis: k.noche ? 0.25 : 0 });
  k.solido(forma.cil(0.012, 0.012, 1.05, 5), '#b06a3a', { p: [x + 0.1, 0.52, z - 0.05], r: [0.1, 0, -0.18] });
  for (let i = 0; i < 6; i++) k.solido(forma.esf(0.05, 6, 4), '#d8d4c8', { p: [x + 0.03 + Math.sin(i) * 0.05, 0.08, z - 0.02 + Math.cos(i) * 0.05], s: [1, 1.6, 1] });
  k.sombra(x, z, 0.28, 0.28, 0.6); huella(k, 'cubo', x, z, 0.25, 1.2);
}
export function senalMojado(k, x, z, rot = 0) {
  for (const s of [1, -1]) k.solido(forma.caja(0.32, 0.62, 0.012), P.amarillo, { p: [x + Math.sin(rot) * s * 0.07, 0.3, z + Math.cos(rot) * s * 0.07], r: [s * 0.22, rot, 0] });
  k.solido(forma.caja(0.2, 0.2, 0.014), P.tinta, { p: [x + Math.sin(rot) * 0.075, 0.38, z + Math.cos(rot) * 0.075], r: [0.22, rot, Math.PI / 4], linea: false });
  k.sombra(x, z, 0.25, 0.2, 0.5); huella(k, 'senal', x, z, 0.2, 0.65);
}
export function cestas(k, x, z, color = '#e83a5a') {
  for (let i = 0; i < 4; i++) {
    k.solido(forma.caja(0.44, 0.07, 0.3), color, { p: [x, 0.04 + i * 0.075, z], r: [0, i * 0.06, 0] });
  }
  k.solido(forma.toro(0.1, 0.012, 4, 10, Math.PI), '#3a3448', { p: [x, 0.34, z], r: [0, 0.18, 0], linea: false });
  k.sombra(x, z, 0.35, 0.28, 0.6); huella(k, 'cestas', x, z, 0.3, 0.35);
}
export function papelera(k, x, z, { color = '#3c6a5a', alto = 0.9 } = {}) {
  k.solido(forma.cil(0.24, 0.21, alto, 14), color, { p: [x, alto / 2, z] });
  k.solido(forma.cil(0.26, 0.26, 0.06, 14), color, { p: [x, alto + 0.03, z] });
  k.solido(forma.caja(0.14, 0.04, 0.04), P.tinta, { p: [x, alto + 0.08, z], linea: false });
  k.sombra(x, z, 0.36, 0.36, 0.65); huella(k, 'papelera', x, z, 0.26, alto);
}
export function bolardo(k, x, z, color = '#5a5470') {
  k.solido(forma.cil(0.06, 0.07, 0.75, 10), color, { p: [x, 0.375, z] });
  k.solido(forma.esf(0.062, 10, 6), color, { p: [x, 0.75, z] });
  k.solido(forma.cil(0.071, 0.071, 0.05, 10), P.amarillo, { p: [x, 0.6, z], linea: false });
  k.sombra(x, z, 0.14, 0.14, 0.6); huella(k, 'bolardo', x, z, 0.08, 0.8);
}
export function mesaBaja(k, x, z, { w = 0.9, d = 0.5, h = 0.4, color = '#6a4a6a' } = {}) {
  k.solido(forma.caja(w, 0.05, d), color, { p: [x, h - 0.025, z] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.solido(forma.cil(0.022, 0.018, h - 0.05, 6), P.tinta, { p: [x + sx * (w / 2 - 0.06), (h - 0.05) / 2, z + sz * (d / 2 - 0.06)], linea: false });
  k.sombra(x, z, w * 0.65, d * 0.7, 0.6); huella(k, 'mesa', x, z, Math.hypot(w, d) / 2, h);
}
export function cojin(k, x, y, z, { color = P.rosa, rot = [0, 0, 0] } = {}) {
  k.solido(forma.esf(1, 12, 8), color, { p: [x, y, z], r: rot, s: [0.15, 0.13, 0.08] });
}
export function antena(k, x, z, alto = 2.4) {
  k.solido(forma.cil(0.022, 0.03, alto, 6), '#a8a4b8', { p: [x, alto / 2, z] });
  [0.62, 0.78, 0.92].forEach((t, i) => k.solido(forma.cil(0.01, 0.01, 0.9 - i * 0.22, 4), '#a8a4b8', { p: [x, alto * t, z], r: [0, 0.4, Math.PI / 2] }));
  k.solido(forma.esf(0.04, 8, 6), '#ff3050', { p: [x, alto + 0.03, z], emis: 1, anim: [0, 0, 0, 1], linea: false });
  k.halo([x, alto + 0.03, z], '#ff3050', k.noche ? 0.3 : 0.12, [0, 0, 0, 1]);
  k.solido(forma.caja(0.4, 0.06, 0.4), '#4a4460', { p: [x, 0.03, z] });
  k.sombra(x, z, 0.35, 0.35, 0.6); huella(k, 'antena', x, z, 0.2, alto);
}
export function parabolica(k, x, z, rot = 0) {
  const g = forma.esf(0.42, 14, 6); const casquete = new g.constructor(0.42, 14, 6, 0, Math.PI * 2, 0, 0.9); g.dispose();
  casquete.scale(1, 0.45, 1); casquete.rotateX(Math.PI); casquete.translate(0, 0.17, 0); // un cuenco abierto hacia arriba
  k.solido(casquete, '#e0dcea', { p: [x, 0.95, z], r: [0.75, rot, 0] });
  k.solido(forma.cil(0.03, 0.03, 0.9, 6), '#8a86a0', { p: [x, 0.45, z] });
  k.solido(forma.cil(0.008, 0.008, 0.5, 4), '#8a86a0', { p: [x - Math.sin(rot) * 0.15, 1.15, z - Math.cos(rot) * 0.15], r: [0.9, rot, 0], linea: false });
  k.solido(forma.caja(0.3, 0.05, 0.3), '#4a4460', { p: [x, 0.025, z] });
  k.sombra(x, z, 0.4, 0.4, 0.55); huella(k, 'parabolica', x, z, 0.45, 1.4);
}
export function estrella(k, x, y, z, { r = 0.16, color = P.amarillo, fase = 0, rot = 0 } = {}) {
  const an = [-200, 0.06, fase, k.noche ? 1 : 0];
  k.solido(forma.estrella(r, r * 0.35), color, { p: [x, y, z], r: [0, rot, 0.2 * Math.sin(fase)], anim: an, emis: k.noche ? 0.7 : 0 });
  if (k.noche) k.halo([x, y, z], color, r * 2.6, an);
}
export function chimenea(k, x, z) {
  k.solido(forma.caja(0.5, 1.1, 0.5), '#b0583e', { p: [x, 0.55, z] });
  for (const y of [0.3, 0.62, 0.9]) k.solido(forma.caja(0.505, 0.03, 0.505), '#7a3a2a', { p: [x, y, z], linea: false });
  k.solido(forma.caja(0.6, 0.1, 0.6), '#5a5470', { p: [x, 1.12, z] });
  k.solido(forma.cil(0.12, 0.12, 0.2, 10), '#4a4460', { p: [x, 1.27, z] });
  k.sombra(x, z, 0.45, 0.45, 0.6); huella(k, 'chimenea', x, z, 0.36, 1.2);
  k.particulas({ tipo: 'sube', humo: true, n: 10, centro: [x, 1.38, z], caja: [0.1, 0.02, 0.1], mueve: [0.25, 1.6, 0.15], color: k.noche ? '#8a80a8' : '#d8d4dc', tam: 0.22, vel: 0.9, azar: 21 });
}
export function lamparaLava(k, x, y, z, color = P.rosa) {
  const n = k.noche;
  k.solido(forma.cil(0.05, 0.08, 0.1, 10), '#8a86a0', { p: [x, y + 0.05, z] });
  k.solido(forma.cil(0.035, 0.055, 0.24, 12), color, { p: [x, y + 0.22, z], emis: n ? 0.8 : 0.2 });
  k.solido(forma.cil(0.03, 0.035, 0.05, 10), '#8a86a0', { p: [x, y + 0.36, z] });
  if (n) { k.halo([x, y + 0.22, z], color, 0.35, [0, 0, 0, 1]); k.luz([x, y + 0.3, z], color, 1.3, 0.9); }
  k.particulas({ tipo: 'sube', n: 5, centro: [x, y + 0.13, z], caja: [0.01, 0.01, 0.01], mueve: [0.015, 0.16, 0.01], color: '#fff0a0', tam: 0.02, vel: 0.5, azar: 8 });
}
export function monopatin(k, x, z, rot = 0) {
  k.solido(forma.caja(0.2, 0.02, 0.78), P.rosa, { p: [x, 0.08, z], r: [0, rot, 0] });
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const d of [-0.27, 0.27]) for (const w of [-0.08, 0.08]) k.solido(forma.cil(0.03, 0.03, 0.03, 8), P.crema, { p: [x + w * c + d * s, 0.035, z - w * s + d * c], r: [0, rot, Math.PI / 2] });
  k.sombra(x, z, 0.18, 0.42, 0.55); huella(k, 'monopatin', x, z, 0.4, 0.1);
}
export function arbolito(k, x, z, { s = 1 } = {}) {
  k.solido(forma.caja(0.7 * s, 0.4 * s, 0.7 * s), '#9a8c7a', { p: [x, 0.2 * s, z] });
  k.solido(forma.cil(0.05 * s, 0.07 * s, 1.4 * s, 7), '#6a4a34', { p: [x, 1.1 * s, z] });
  [[0, 1.95, 0, 0.5], [0.25, 1.75, 0.1, 0.35], [-0.22, 1.8, -0.1, 0.38], [0.05, 2.25, -0.05, 0.32]].forEach(([dx, y, dz, r]) =>
    k.solido(forma.esf(r * s, 10, 7), '#4a9a52', { p: [x + dx * s, y * s, z + dz * s] }));
  k.sombra(x, z, 0.8 * s, 0.8 * s, 0.5); huella(k, 'arbolito', x, z, 0.4 * s, 2.5 * s);
  k.particulas({ tipo: 'cae', n: 6, centro: [x, 1.9 * s, z], caja: [0.4, 0.1, 0.4], mueve: [0.3, 1.8 * s, 0.3], color: ['#7ab04a', '#d8b040'], tam: 0.03, vel: 0.5, azar: 31 });
}
export function olla(k, x, y, z) {
  k.solido(forma.cil(0.13, 0.12, 0.16, 14), '#b8b8c8', { p: [x, y + 0.08, z] });
  k.solido(forma.cil(0.135, 0.135, 0.02, 14), '#8a8a9a', { p: [x, y + 0.165, z], linea: false });
  k.solido(forma.esf(0.025, 6, 4), P.tinta, { p: [x, y + 0.19, z], linea: false });
  k.particulas({ tipo: 'sube', humo: true, n: 8, centro: [x, y + 0.2, z], caja: [0.04, 0.01, 0.04], mueve: [0.12, 0.7, 0.08], color: '#f0ecf8', tam: 0.09, vel: 1.2, azar: 17 });
}
export function cajonVerdura(k, x, z, rot = 0) {
  caja(k, x, z, { w: 0.5, h: 0.24, d: 0.36, rot, color: '#b08048' });
  const cols = ['#e83a2a', '#e83a2a', '#5bb86a', '#f0a020', '#e83a2a', '#5bb86a'];
  cols.forEach((c, i) => k.solido(forma.esf(0.065, 8, 6), c, { p: [x - 0.15 + (i % 3) * 0.15, 0.26, z - 0.07 + Math.floor(i / 3) * 0.14] }));
}
export function cenicero(k, x, y, z) {
  k.solido(forma.cil(0.07, 0.06, 0.035, 12), '#5a5470', { p: [x, y + 0.018, z] });
  k.solido(forma.cil(0.006, 0.006, 0.08, 4), P.crema, { p: [x + 0.03, y + 0.04, z], r: [0, 0, 1.3], linea: false });
  k.solido(forma.esf(0.008, 4, 3), '#ff6030', { p: [x + 0.07, y + 0.05, z], emis: 1, anim: [0, 0, 0, 1], linea: false });
  k.particulas({ tipo: 'sube', humo: true, n: 7, centro: [x + 0.07, y + 0.06, z], caja: [0.005, 0.005, 0.005], mueve: [0.1, 0.8, 0.08], color: '#c8c0e0', tam: 0.05, vel: 0.8, azar: 41 });
}
export function rollo(k, x, z) {
  k.solido(forma.cil(0.055, 0.055, 0.1, 12), '#f4f0e8', { p: [x, 0.055, z], r: [Math.PI / 2, 0.6, 0] });
  k.sombra(x, z, 0.1, 0.08, 0.5);
}
