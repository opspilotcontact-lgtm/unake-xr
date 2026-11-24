// Decoración 3D hecha con código para las salas del barrio y el bar del humo: objetos de verdad en primer plano
// y plano medio (paralaje y volumen), sombras de contacto, haces de luz, neones, polvo y humo.
// Todo sale en ≈ 6 llamadas de dibujo por sala (ver js/barrio/deco/kit.js) y se anima en el shader.
//
//   const deco = await decorar(salaId, mundo, sala, { THREE });   // salaId: 'cuarto'…'techo' o 'bar'
//   sala.grupo.add(deco.grupo);                                     // coordenadas LOCALES de la sala
//   en el bucle: deco.actualizar(dt, t, cabeza);  al salir: deco.quitar();
//
// `sala` = lo que devuelve construirSala (barrio) o montarUnake (bar). `mundo` = 'humo' (noche) o 'normal' (día).
// deco.avisos: lo que pisa una puerta, a la gente o tu sitio (para las pruebas; vacío = bien).
import { crearKit, forma, PALETA as P } from './deco/kit.js';
import * as Z from './deco/piezas.js';
import { medir } from './proyeccion.js';
import { conexiones } from './portales.js';
import { SALA_DENTRO } from '../decorado.js';

export async function decorar(salaId, mundo, sala, _opc = {}) {
  const noche = mundo !== 'normal' || salaId === 'techo' || salaId === 'bar';
  const k = crearKit({ noche });
  const def = sala.def || SALA_DENTRO;
  const m = sala.medida || medir(def);
  const M = sala.medidas;
  const suelo = (px, py) => { const z = m.prof(py); return [m.X(px, z), -z]; };
  const ctx = { k, n: noche, M, m, def, sala, suelo, mundo };
  // sombras de contacto bajo los cartones de la sala (muebles de la serie): que no floten
  for (const p of sala.piezas || []) {
    const w = p.userData?.ancho || 0.6;
    k.sombra(p.position.x, p.position.z + 0.02, w * 0.5, Math.min(0.35, w * 0.22), 0.5);
  }
  (SALAS3D[salaId] || (() => { }))(ctx);
  const opciones = (CONSTRUIR[salaId] || (c => c))({ });
  const hecho = k.construir(opciones);
  let tiempo = 0;
  return {
    grupo: hecho.grupo,
    avisos: comprobar(salaId, ctx),
    llamadas: hecho.mallas.length,
    actualizar(dt = 0, t, _cabeza) { tiempo = t ?? tiempo + dt; hecho.tiempo(tiempo); },
    quitar() { hecho.quitar(); },
  };
}

// ajustes del material por sala (cuánto brilla, cuánto humo)
const CONSTRUIR = {
  bano: o => ({ ...o, fuerzaHumo: 0.25 }),
  techo: o => ({ ...o, fuerzaHumo: 0.55 }),
};

// ---------- las salas ----------
const SALAS3D = {
  // El cuarto de Vuper: neones rojos en las esquinas del techo, bombilla colgante, lámpara de lava, cajas y monopatín
  cuarto({ k, n, M }) {
    const zf = -(M.D - 0.35);
    if (n) {
      Z.neon(k, [[M.xl + 0.06, M.alto - 0.09, -0.3], [M.xl + 0.06, M.alto - 0.09, zf]], '#ff3355', { parpadeo: 1, curva: false, r: 0.014 });
      Z.neon(k, [[M.xr - 0.06, M.alto - 0.09, -0.3], [M.xr - 0.06, M.alto - 0.09, zf]], '#ff3355', { parpadeo: 1, fase: 2, curva: false, r: 0.014 });
      k.luz([M.xl + 0.3, M.alto - 0.4, -1.6], '#ff3355', 1.6, 0.8);
    }
    Z.lampara(k, { x: -0.45, z: -1.7, techo: M.alto, largo: 0.5, pantalla: n ? P.morado : '#e8e0d0', luz: n ? '#ffb070' : '#fff2d0', fase: 0.4 });
    Z.caja(k, -1.45, -1.15, { w: 0.42, h: 0.32, d: 0.4, rot: 0.3 });
    if (n) Z.lamparaLava(k, -1.45, 0.32, -1.15);
    else Z.planta(k, -1.45, -1.15, { s: 0.7, y: 0.32 });
    Z.caja(k, 1.15, -0.95, { w: 0.5, h: 0.38, d: 0.42, rot: -0.2 });
    Z.caja(k, 1.12, -0.97, { w: 0.36, h: 0.26, d: 0.32, rot: 0.25, y: 0.38, color: '#b88a58' });
    Z.monopatin(k, -0.72, -1.45, 0.6);
    k.particulas({ tipo: 'polvo', n: n ? 30 : 22, centro: [0, 1.4, -2.2], caja: [M.ancho * 0.4, 0.9, 1.4], mueve: [0.2, 0.15, 0.2], color: n ? '#ff9ad0' : '#fff4d8', tam: 0.008, azar: 2 });
  },

  // La plaza: la farola de cartón con su haz y polillas, bolardos, palomas; de día un arbolito con hojas que caen
  plaza({ k, n, m, def }) {
    if (n) {
      const p = def.piezas?.[1];
      if (p) { const z = m.prof(p.y), x = m.X(p.x, z), h = p.alto * z / m.F; Z.farolaLuz(k, [x - 0.05, h * 0.9, -z], { radio: 1.4 }); }
      k.particulas({ tipo: 'polvo', humo: true, n: 14, centro: [0, 0.35, -4.5], caja: [4, 0.2, 2.2], mueve: [0.6, 0.08, 0.3], color: '#6a5a8a', tam: 0.7, vel: 0.6, azar: 5 });
    } else Z.arbolito(k, -2.25, -3.9, { s: 0.9 });
    Z.bolardo(k, -1.45, -1.75); Z.bolardo(k, -0.7, -1.85); Z.bolardo(k, 0.85, -1.85);
    Z.paloma(k, -0.25, -2.4, { rot: 0.6, fase: 0 }); Z.paloma(k, -0.6, -2.7, { rot: -0.9, fase: 2 });
    k.solido(forma.cil(0.033, 0.033, 0.12, 10), '#d03050', { p: [0.35, 0.033, -1.5], r: [Math.PI / 2, 0.8, 0] });
    k.sombra(0.35, -1.5, 0.09, 0.07, 0.5);
    k.particulas({ tipo: 'polvo', n: 16, centro: [0, 1.3, -3], caja: [2.5, 1, 1.5], mueve: [0.3, 0.2, 0.3], color: n ? '#c8b0ff' : '#fffbe8', tam: 0.008, azar: 6 });
  },

  // La puerta de Unaké: el haz de la farola pintada, cable con bombillas cruzando la calle, cubos, charco de neón, humo bajo
  fuera({ k, n, m, mundo }) {
    const [x, y, z] = mundo === 'normal' ? [-2.45, 3.4, -3.95] : [-2.45, 3.6, -4.55];
    Z.farolaLuz(k, [x, y, z], { radio: 1.5 });
    if (n) {
      Z.guirnalda(k, [-2.4, 3.1, -3.2], [2.4, 3.0, -2.5], { caida: 0.5, bombillas: 7, colores: ['#ffd98a', '#ffcf6a'] });
      k.charco(0.55, -2.05, 0.45, 0.3, P.neon, 0.4); // (el rosa se veía como un aro: parecía algo que tocar)
      k.particulas({ tipo: 'polvo', humo: true, n: 16, centro: [0.5, 0.3, -2.9], caja: [2.6, 0.2, 0.6], mueve: [0.5, 0.08, 0.2], color: '#6a7ab0', tam: 0.6, vel: 0.6, azar: 7 });
    }
    Z.papelera(k, -1.3, -1.65, { color: n ? '#3c6a5a' : '#6a8a7a', alto: 0.75 });
    Z.papelera(k, -0.8, -1.9, { color: n ? '#5a5470' : '#8a8a92', alto: 0.7 });
    Z.caja(k, -1.05, -1.2, { w: 0.4, h: 0.22, d: 0.35, rot: 0.5, color: '#b08048' });
    k.particulas({ tipo: 'polvo', n: 14, centro: [0, 1.4, -2.6], caja: [2.2, 1, 0.8], mueve: [0.3, 0.2, 0.3], color: n ? '#a8c0ff' : '#fffbe8', tam: 0.008, azar: 8 });
  },

  // La tienda: tres fluorescentes con su haz (uno falla de noche), cestas, señal de suelo mojado, cajas y un cartel colgante.
  // Libres: el mostrador (centro-fondo) y la pared izquierda (tablón de encargos).
  tienda({ k, n, M }) {
    const y = M.alto - 0.14, c = n ? '#c8fbff' : '#fffdf0';
    Z.fluorescente(k, { x: 0, y, z: -1.5, largo: 1.2, color: c, haz: false });
    Z.fluorescente(k, { x: 0, y, z: -3.3, largo: 1.2, color: c, parpadeo: n ? 2 : 0, fase: 1.3 });
    Z.fluorescente(k, { x: 0, y, z: -5.2, largo: 1.2, color: c });
    Z.cestas(k, 1.4, -1.0);
    Z.senalMojado(k, -0.75, -1.3, 0.5);
    Z.caja(k, 1.75, -3.6, { w: 0.5, h: 0.4, d: 0.45, rot: 0.2 });
    Z.caja(k, 1.7, -3.65, { w: 0.4, h: 0.3, d: 0.35, rot: -0.15, y: 0.4, color: '#d8b070' });
    const an = [M.alto, 0.08, 0.7, 0];
    k.solido(forma.cil(0.004, 0.004, 0.45, 4), P.tinta, { p: [0.75, M.alto - 0.225, -2.3], anim: an, linea: false });
    k.solido(forma.estrella(0.22, 0.02, 8, 0.7), P.amarillo, { p: [0.75, M.alto - 0.65, -2.3], anim: an, emis: n ? 0.4 : 0 });
    k.solido(forma.estrella(0.15, 0.024, 8, 0.7), '#ff3a5a', { p: [0.75, M.alto - 0.65, -2.3], anim: an, linea: false });
  },

  // La feria: postes con guirnalda de bombillas (banderines de día), carro de algodón de azúcar con globos, basura,
  // luciérnagas y humo
  feria({ k, n }) {
    Z.poste(k, -2.0, -4.3, 3.0); Z.poste(k, 2.3, -3.5, 3.0);
    Z.guirnalda(k, [-2.0, 2.95, -4.3], [2.3, 2.95, -3.5], { caida: 0.55, bombillas: 13 });
    Z.guirnalda(k, [2.3, 2.95, -3.5], [0.4, 3.4, -8.5], { caida: 0.4, bombillas: 11, fase: 3 });
    Z.guirnalda(k, [-2.0, 2.95, -4.3], [-1.2, 3.3, -9], { caida: 0.35, bombillas: 9, fase: 5 });
    Z.carroAlgodon(k, 1.75, -2.85, -0.45);
    Z.globo(k, 2.2, -2.6, { y0: 0.95, alto: 2.05, color: P.rosa, fase: 0 });
    Z.globo(k, 2.28, -2.75, { y0: 0.95, alto: 2.25, color: P.amarillo, fase: 1.4 });
    Z.globo(k, 2.13, -2.9, { y0: 0.95, alto: 2.15, color: P.neon, fase: 2.6 });
    if (n) k.luz([0, 2.6, -3.9], '#ffd060', 2.6, 0.8);
    // palomitas tiradas y tickets
    k.solido(forma.cil(0.07, 0.05, 0.14, 8), '#e83a3a', { p: [-0.65, 0.05, -1.7], r: [1.3, 0.4, 0] });
    for (let i = 0; i < 5; i++) k.solido(forma.esf(0.022, 5, 4), '#fff6d0', { p: [-0.55 + i * 0.05, 0.02, -1.62 + (i % 2) * 0.05] }, {});
    for (let i = 0; i < 3; i++) k.solido(forma.caja(0.09, 0.004, 0.05), P.amarillo, { p: [0.2 + i * 0.16, 0.003, -1.9 - i * 0.12], r: [0, i, 0], linea: false });
    k.sombra(-0.62, -1.68, 0.14, 0.1, 0.5);
    if (n) {
      k.particulas({ tipo: 'luciernaga', n: 26, centro: [0, 1.2, -4], caja: [3, 0.9, 2.2], mueve: [0.35, 0.25, 0.35], color: ['#fff07a', '#b8ff7a'], tam: 0.018, vel: 1, azar: 9 });
      k.particulas({ tipo: 'polvo', humo: true, n: 14, centro: [0, 0.4, -5.5], caja: [4, 0.3, 2.5], mueve: [0.7, 0.1, 0.3], color: '#7a6a9a', tam: 0.8, vel: 0.5, azar: 10 });
    } else k.particulas({ tipo: 'polvo', n: 22, centro: [0, 1, -3.5], caja: [3, 0.8, 2], mueve: [0.5, 0.2, 0.3], color: '#f8e8c0', tam: 0.01, azar: 11 });
  },

  // Unaké: tres lámparas colgantes sobre la barra, botellas y vasos en la barra, plantas, humo de ambiente
  dentro({ k, n, M, m, def }) {
    const barra = barraDe(def, m);
    lamparasBarra(k, n, M, barra);
    if (barra) botellasBarra(k, barra);
    Z.planta(k, -2.05, -1.05, { s: 1.15 });
    Z.planta(k, 2.05, -0.95, { s: 1.0, maceta: '#7a4a8a' });
    ambiente(k, n, M);
  },

  // La cocina de Cotine: bombilla colgante, olla humeante en la encimera, cajón de verdura, vapor
  cocina({ k, n, M, m, def }) {
    Z.lampara(k, { x: 0.2, z: -1.9, techo: M.alto, largo: 0.75, pantalla: n ? '#5a8a8a' : '#d8d0c8', luz: n ? '#ffcf80' : '#fff2d0', fase: 1 });
    const enc = encimeraDe(def, m);
    if (enc) {
      Z.olla(k, enc.x + 0.45, enc.alto, enc.z - 0.16);
      Z.vaso(k, enc.x - 0.1, enc.alto, enc.z - 0.1, { liquido: '#ff8ab8', color: '#e8f4ff' });
      k.particulas({ tipo: 'polvo', n: 10, centro: [enc.x, enc.alto + 0.4, enc.z], caja: [0.6, 0.3, 0.2], mueve: [0.1, 0.1, 0.1], color: '#fff0d0', tam: 0.008, azar: 12 });
    }
    Z.cajonVerdura(k, -1.35, -1.1, 0.35);
    Z.caja(k, -1.0, -0.85, { w: 0.3, h: 0.42, d: 0.22, rot: -0.3, color: '#f0e8d8' }); // saco de harina
    ambiente(k, n, M, 0.6);
  },

  // El reservado: mesa baja con cenicero humeante y vasos, dos lámparas colgantes, planta
  reservado({ k, n, M, m, def }) {
    const s = sofaDe(def, m);
    Z.mesaBaja(k, 0, -1.75, { w: 0.95, d: 0.5, h: 0.4, color: n ? '#5a3a6a' : '#8a6a5a' });
    Z.cenicero(k, -0.2, 0.4, -1.75);
    Z.vaso(k, 0.15, 0.4, -1.8); Z.vaso(k, 0.3, 0.4, -1.68, { liquido: '#5fd0ff' });
    const zl = s ? s.z + 0.6 : -2.1;
    Z.lampara(k, { x: -0.95, z: zl, techo: M.alto, largo: 1.05, pantalla: n ? P.rosa : '#e8e0d0', luz: n ? '#ffb0d8' : '#fff2d0', fase: 0 });
    Z.lampara(k, { x: 0.95, z: zl, techo: M.alto, largo: 1.05, pantalla: n ? P.rosa : '#e8e0d0', luz: n ? '#ffb0d8' : '#fff2d0', fase: 2.1 });
    Z.planta(k, -1.75, -1.15, { s: 1.2, maceta: '#5a4a7a' });
    ambiente(k, n, M, 1.2);
  },

  // Los baños: fluorescente que falla, bombilla colgante con moscas, cubo y fregona, goteras con charco, rollo;
  // de día un rayo de sol de la ventana del fondo
  bano({ k, n, M }) {
    Z.fluorescente(k, { x: 0.55, y: 2.9, z: -2.3, largo: 1.1, rotY: Math.PI / 2, color: n ? '#b8fff0' : '#f4fffc', parpadeo: n ? 2 : 0, fase: 0.5 });
    for (const dz of [-0.45, 0.45]) k.solido(forma.cil(0.004, 0.004, M.alto - 2.93, 4), '#8a86a0', { p: [0.55, (M.alto + 2.93) / 2, -2.3 + dz], linea: false });
    Z.lampara(k, { x: -0.55, z: -3.5, techo: M.alto, largo: 1.6, pantalla: '#4a6a6a', luz: n ? '#ffe08a' : '#fff4d8', fase: 0.8, haz: n, fuerza: 0.8 });
    if (n) k.particulas({ tipo: 'polilla', n: 5, centro: [-0.55, M.alto - 1.7, -3.5], caja: [0.1, 0.1, 0.1], mueve: [0.25, 0.12, 0.25], color: '#d8ff9a', tam: 0.01, vel: 1.4, azar: 13 });
    Z.cubo(k, 1.2, -1.15);
    Z.rollo(k, 0.45, -1.35);
    k.charco(0.15, -2.75, 0.4, 0.3, n ? '#5fd0ff' : '#a8e0f0', n ? 0.35 : 0.2);
    k.particulas({ tipo: 'cae', n: 4, centro: [0.15, M.alto - 0.6, -2.75], caja: [0.03, 0, 0.03], mueve: [0, M.alto - 0.6, 0], color: '#9ae8ff', tam: 0.012, vel: 0.9, azar: 14 });
    if (!n) {
      const a = [0, 3.4, -(M.D - 0.1)], b = [0, 0, -(M.D - 1.9)];
      const h = Math.hypot(a[1] - b[1], a[2] - b[2]), ang = Math.atan2(a[2] - b[2], a[1] - b[1]);
      const g = forma.cil(0.3, 0.75, h, 16); quitar(g);
      k.brillo(g, '#fff4d0', { modo: 'cono', fuerza: 0.3, p: [0, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [ang, 0, 0] });
      k.charco(0, b[2], 0.9, 0.6, '#fff4d0', 0.2);
      k.particulas({ tipo: 'polvo', n: 20, centro: [0, 1.7, (a[2] + b[2]) / 2], caja: [0.35, 1.2, 0.6], mueve: [0.08, 0.15, 0.08], color: '#fff8e0', tam: 0.008, azar: 15 });
    } else ambiente(k, n, M, 0.5);
  },

  // El techo de la Pompa: antena con piloto rojo, parabólica, chimenea humeante, estrellas que flotan y titilan
  techo({ k, n }) {
    Z.antena(k, 1.75, -1.9, 2.5);
    Z.parabolica(k, -1.85, -1.5, -0.6);
    Z.chimenea(k, -1.1, -2.6);
    Z.guirnalda(k, [1.75, 2.3, -1.9], [-1.1, 1.4, -2.6], { caida: 0.35, bombillas: 8 });
    [[-1.4, 2.9, -2.4, 0.18], [0.3, 3.2, -2.6, 0.22], [1.6, 2.7, -2.0, 0.15], [-2.4, 2.4, -0.6, 0.14], [2.4, 2.6, -0.4, 0.16]].forEach(([x, y, z, r], i) =>
      Z.estrella(k, x, y, z, { r, fase: i * 1.3, rot: x * 0.2 }));
    const est = [];
    for (let i = 0; i < 40; i++) { const a = i * 2.39996, e = 0.35 + (i % 7) * 0.13; est.push([Math.sin(a) * Math.cos(e) * 3.2, 1.2 + Math.sin(e) * 2.4, -Math.abs(Math.cos(a)) * Math.cos(e) * 3.2]); }
    est.forEach((p, i) => k.halo(p, i % 3 ? '#fff6d0' : P.neon, 0.05 + (i % 4) * 0.02, [0, 0, i * 0.7, 3]));
    k.particulas({ tipo: 'luciernaga', n: 16, centro: [0, 1.4, -1.8], caja: [2.2, 0.8, 1.2], mueve: [0.3, 0.2, 0.3], color: ['#fff07a', P.rosa], tam: 0.016, azar: 16 });
  },

  // El bar del humo (montarUnake): lámparas sobre la barra pintada, neones en las paredes, planta, sombras del sofá y de la
  // recreativa, humo de ambiente
  bar({ k, n, M, m, sala }) {
    const zb = m.prof(572), barra = { x: m.X(689, zb), z: -zb, alto: 142 * zb / m.F, ancho: 4 };
    lamparasBarra(k, n, M, barra);
    k.sombra(sala.sofa?.position.x ?? 0, (sala.sofa?.position.z ?? -1.75) + 0.05, 0.95, 0.3, 0.55);
    k.sombra(-1.9, -0.9, 0.5, 0.42, 0.55);
    Z.neon(k, [[M.xr - 0.03, 2.1, -0.5], [M.xr - 0.03, 2.3, -0.75], [M.xr - 0.03, 2.1, -1.0], [M.xr - 0.03, 2.3, -1.25], [M.xr - 0.03, 2.1, -1.5]], P.rosa, { fase: 1 });
    Z.neon(k, starPts(M.xl + 0.03, 2.45, -0.55, 0.28), P.neon, { curva: false, fase: 3, parpadeo: 1 });
    k.luz([M.xr - 0.3, 2.1, -1.0], P.rosa, 1.5, 0.8);
    Z.planta(k, 2.1, -0.65, { s: 1.15, maceta: '#7a4a8a' });
    ambiente(k, n, M);
  },
};

// ---------- ayudas de las salas de Unaké ----------
function quitar(g) { const l = g.groups[0]; g.setIndex(Array.from(g.index.array.slice(l.start, l.start + l.count))); g.clearGroups(); return g; }
function starPts(x, y, z, r) { const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([x, y + Math.sin(a) * rr, z + Math.cos(a) * rr]); } return pts; }

// la barra: el cartón de la serie (humo) o el bastidor (día)
function barraDe(def, m) {
  const p = def.piezas?.find(q => q.url.includes('barra'));
  if (p) { const z = m.prof(p.y), w = 900 * z / m.F; return { x: m.X(p.x, z), z: -z, alto: p.alto * z / m.F, ancho: Math.min(w, 3) }; }
  const b = def.bastidores?.[0];
  if (b) { const z = m.prof(b.suelo); return { x: (m.X(b.x0, z) + m.X(b.x1, z)) / 2, z: -z, alto: m.Y(b.y0, z), ancho: Math.min(m.X(b.x1, z) - m.X(b.x0, z), 3) }; }
  return null;
}
function encimeraDe(def, m) {
  const p = def.piezas?.find(q => q.url.includes('encimera'));
  if (p) { const z = m.prof(p.y); return { x: m.X(p.x, z), z: -z, alto: p.alto * z / m.F * 0.74 }; }
  const b = def.bastidores?.[0];
  if (b) { const z = m.prof(b.suelo); return { x: m.X((b.x0 + b.x1) / 2, z), z: -z, alto: m.Y(b.y0, z) }; }
  return null;
}
function sofaDe(def, m) {
  const p = def.piezas?.find(q => q.url.includes('sofa'));
  if (p) { const z = m.prof(p.y); return { x: m.X(p.x, z), z: -z, alto: p.alto * z / m.F }; }
  const b = def.bastidores?.[0];
  if (b) { const z = m.prof(b.suelo); return { x: m.X((b.x0 + b.x1) / 2, z), z: -z, alto: m.Y(b.y0, z) }; }
  return null;
}
function lamparasBarra(k, n, M, barra) {
  const x0 = barra ? barra.x : 0, z = barra ? barra.z + 0.25 : -3;
  [-1.15, 0, 1.15].forEach((dx, i) => Z.lampara(k, {
    x: x0 + dx, z, techo: M.alto, largo: Math.max(0.6, M.alto - 2.25), fase: i * 1.9,
    pantalla: n ? [P.rosa, P.amarillo, P.neon][i] : '#c89a50', luz: n ? ['#ffb0d8', '#ffd98a', '#a8f6ff'][i] : '#fff0c8',
    fuerza: n ? 0.8 : 1, haz: i !== 1 || !barra,
  }));
}
function botellasBarra(k, b) {
  const y = b.alto * 0.9, z = b.z - 0.12;
  [-1.25, -1.12, -0.98, 0.95, 1.08].forEach((dx, i) => Z.botella(k, b.x + dx, y, z, i, 0.26 + (i % 2) * 0.05));
  Z.vaso(k, b.x - 0.7, y, z + 0.02); Z.vaso(k, b.x + 0.72, y, z + 0.02, { liquido: '#ff5fa2' });
}
// humo de ambiente (noche) o polvo en el aire (día)
function ambiente(k, n, M, fuerza = 1) {
  if (n) {
    k.particulas({ tipo: 'polvo', humo: true, n: Math.round(14 * fuerza), centro: [0, M.alto * 0.72, -M.D * 0.55], caja: [M.ancho * 0.4, 0.35, M.D * 0.35], mueve: [0.5, 0.12, 0.3], color: '#8a7aa8', tam: 0.55, vel: 0.5, azar: 18 });
    k.particulas({ tipo: 'polvo', n: 22, centro: [0, 1.3, -M.D * 0.5], caja: [M.ancho * 0.4, 0.9, M.D * 0.35], mueve: [0.2, 0.2, 0.2], color: '#d8b0ff', tam: 0.008, azar: 19 });
  } else k.particulas({ tipo: 'polvo', n: 22, centro: [0, 1.3, -M.D * 0.5], caja: [M.ancho * 0.4, 0.9, M.D * 0.35], mueve: [0.2, 0.2, 0.2], color: '#fff6d8', tam: 0.008, azar: 20 });
}

// ---------- comprobar que nada tapa puertas, gente ni tu sitio ----------
function comprobar(salaId, { k, M, def, suelo }) {
  const avisos = [], zonas = [];
  if (salaId !== 'bar') {
    const { xl = -3, xr = 3, D = 3 } = M || {};
    const zLado = -Math.min(Math.max(D * 0.5, 1.3), 2.4), zFondo = -Math.min(Math.max(D - 0.3, 1.6), 3.2);
    for (const { tipo, dest } of conexiones(salaId)) {
      if (tipo === 'izq') { const x = Math.max(xl + 0.3, -2.6); zonas.push(['puerta ' + dest, x - 0.1, x + 0.9, zLado - 0.6, zLado + 0.6]); }
      else if (tipo === 'der') { const x = Math.min(xr - 0.3, 2.6); zonas.push(['puerta ' + dest, x - 0.9, x + 0.1, zLado - 0.6, zLado + 0.6]); }
      else if (tipo === 'puerta') zonas.push(['puerta ' + dest, 0.3, 1.5, zFondo - 0.1, zFondo + 0.9]);
      else if (tipo === 'sube') zonas.push(['puerta ' + dest, -1.5, -0.3, zFondo - 0.1, zFondo + 0.9]);
      else zonas.push(['puerta ' + dest, -0.6, 0.6, 0.7, 1.7]);
    }
    for (const [quien, s] of Object.entries(def.sitios || {})) { const [x, z] = suelo(s[0], s[1]); zonas.push([quien, x - 0.4, x + 0.4, z - 0.4, z + 0.4]); }
  } else {
    zonas.push(['recreativa', -2.4, -1.4, -1.35, -0.45], ['sofa', -0.9, 0.9, -2.0, -1.4], ['puerta', -0.6, 0.6, -2.6, -2.0]);
  }
  for (const h of k.huellas || []) {
    if (h.alto < 0 && -h.alto > 2.15) continue; // cuelga por encima de las puertas y las cabezas
    for (const [nombre, x0, x1, z0, z1] of zonas) {
      if (h.x + h.r > x0 && h.x - h.r < x1 && h.z + h.r > z0 && h.z - h.r < z1) avisos.push(`${h.nombre} (${h.x.toFixed(2)}, ${h.z.toFixed(2)}) pisa ${nombre}`);
    }
    const d = Math.hypot(h.x, h.z);
    if (d - h.r < 1.0 && h.alto > 0) avisos.push(`${h.nombre} a ${d.toFixed(2)} m de ti`);
  }
  return avisos;
}
