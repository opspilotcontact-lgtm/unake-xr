// La caja no cuadra (Blancaso) · VR nativo, escala «mesa». Reglas de base/js/escenas/cuentas.js.
//
// Sobre tu mesa real (ctx.mesa()) o, si no hay, sobre un mostrador a la altura de tu cintura (de pie o sentado):
//   · al fondo, una cinta de caja que sale de la registradora y trae monedas, billetes y facturas;
//   · delante de ti, tres bandejas: monedas (izquierda), facturas (centro) y billetes (derecha), como el ← ↓ → del 2D;
//   · detrás de la cinta, Blancaso de juguete apuntándolo todo en su agenda; a su lado, la libreta con el marcador.
// Cada cosa a su bandeja:
//   COGER Y DEJAR   pellizco/gatillo o puño sobre la cosa; se suelta encima de la bandeja (o se lanza hacia ella).
//   MANOTAZO        un barrido rápido de la mano, a ras de la cinta, hacia la bandeja: más rápido y más divertido.
// Lanzamientos y manotazos llevan una ayuda de puntería suave: si van más o menos hacia una bandeja, caen dentro.
// Lo que llega al final de la cinta se escapa; lo que va a la bandeja mala o se queda tirado en la mesa (hay un
// segundo y medio para rescatarlo) sube el bajón de Blancaso. Con tres se derrite («Otra vez no…»); con cinco, se acabó.
// Cada vez va más rápido. Lo que se salva va a la hucha de la aso (ctx.hucha?.(n), si el juego lo pasa).
// Puntos como el 2D: 50 por moneda o billete, 75 por factura, +50 % cada 5 seguidos; la hucha (nivel 3+) vale el triple.

const DURACION = 45, BAJON_MAX = 5;
const TINTA = '#140c1c', PAPEL = '#fffaf0';
// medidas en metros, en el espacio de la mesa: x a tu derecha, y hacia arriba, z hacia ti (0 = punto de juego)
const CINTA = { x0: -0.44, x1: 0.44, z: -0.17, ancho: 0.15, alto: 0.041 };
const BANDEJAS = [
  { x: -0.27, nombre: 'Monedas', color: '#f5c542', fondo: '#c99a1e' },
  { x: 0.27, nombre: 'Billetes', color: '#7ccf8a', fondo: '#4e9a5c' },
  { x: 0, nombre: 'Facturas', color: '#fff6e8', fondo: '#d8cfb8' },
];
const B_Z = 0.075, B_MX = 0.1, B_MZ = 0.075, B_ALTO = 0.035;
const TAPETE = { x: 0.64, z0: -0.43, z1: 0.26 };
const TIPOS = {
  moneda: { nombre: 'moneda', una: 'una moneda', destino: 0, valor: 10, salva: 1, radio: 0.029, apoyo: 0.004, gravedad: 1 },
  billete: { nombre: 'billete', una: 'un billete', destino: 1, valor: 10, salva: 3, radio: 0.034, apoyo: 0.002, gravedad: 0.55 },
  factura: { nombre: 'factura', una: 'una factura', destino: 2, valor: 15, salva: 0, radio: 0.034, apoyo: 0.0015, gravedad: 0.6 },
  hucha: { nombre: 'hucha', una: 'una hucha', destino: 0, valor: 10, salva: 10, radio: 0.034, apoyo: 0.036, gravedad: 1, hucha: true },
};

function baraja(lista) {
  let mazo = [];
  return () => { if (!mazo.length) mazo = lista.slice().sort(() => Math.random() - 0.5); return mazo.pop(); };
}

export default {
  clave: 'Cuentas', titulo: 'La caja no cuadra', escala: 'mesa', umbrales: [1200, 3000, 5000],

  async crear(ctx) {
    const { THREE, fisica, agarre, humo, ui, sonido, xr } = ctx;
    const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
    const grupo = new THREE.Group(); grupo.name = 'minijuego-cuentas';
    const nivel = ctx.nivel ?? 1;
    const texturas = [];

    // ---------- estado de la partida (todo se reinicia aquí) ----------
    const E = { fase: 'intro', puntos: 0, bajon: 0, combo: 0, salvado: 0, aciertos: 0, manotazos: 0, restante: DURACION, resultados: [] };
    let reloj = 0, acabado = false, proximo = 0.3, vozLibre = 0, sucio = true, tPintar = 0, vCinta = 0;
    const tareas = [];
    const luego = (s, fn) => tareas.push({ t: reloj + s, fn });
    const items = [];

    // ---------- dónde: tu mesa, o un mostrador a la cintura ----------
    const mesa = ctx.mesa();
    const cab = xr.cabeza.clone().setY(0);
    let fw = mesa ? mesa.punto.clone().setY(0).sub(cab) : xr.adelante.clone().setY(0);
    const dMesa = mesa ? fw.length() : 0;
    if (fw.lengthSq() < 1e-4) fw = xr.adelante.clone().setY(0);
    if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1);
    fw.normalize();
    const alturaMesa = mesa ? mesa.punto.y : THREE.MathUtils.clamp(xr.cabeza.y - 0.62, 0.6, 1.05);
    const dist = mesa ? THREE.MathUtils.clamp(dMesa - 0.22, 0.38, 0.55) : 0.42;
    const base = new THREE.Group(); base.name = 'mesa-cuentas';
    base.position.copy(cab).addScaledVector(fw, dist).setY(alturaMesa);
    base.rotation.y = Math.atan2(-fw.x, -fw.z);
    grupo.add(base); base.updateMatrixWorld(true);
    const inv = base.matrixWorld.clone().invert();
    const W = (x, y, z, out = V()) => out.set(x, y, z).applyMatrix4(base.matrixWorld);
    const L = (v, out = V()) => out.copy(v).applyMatrix4(inv);
    const qBase = base.quaternion.clone();

    // ---------- ayudantes de dibujo ----------
    const mb = (o) => new THREE.MeshBasicMaterial(o);
    const MAT_TINTA = mb({ color: TINTA, side: THREE.BackSide });
    function tinta(malla, e = 0.004) {
      malla.geometry.computeBoundingBox();
      const s = malla.geometry.boundingBox.getSize(V());
      const t = new THREE.Mesh(malla.geometry, MAT_TINTA);
      t.scale.set(1 + 2 * e / Math.max(s.x, 1e-3), 1 + 2 * e / Math.max(s.y, 1e-3), 1 + 2 * e / Math.max(s.z, 1e-3));
      malla.add(t);
      return malla;
    }
    const lienzo = (w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texturas.push(t);
      return { c, g: c.getContext('2d'), t };
    };
    const caja = (w, h, d, color, e = 0.004) => tinta(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mb({ color })), e);

    // ---------- el mostrador / tapete ----------
    if (!mesa) {
      const m = caja(TAPETE.x * 2 + 0.04, alturaMesa, TAPETE.z1 - TAPETE.z0 + 0.04, '#a98b6a', 0.006);
      m.position.set(0, -alturaMesa / 2 - 0.001, (TAPETE.z0 + TAPETE.z1) / 2); base.add(m);
    }
    const tapete = (() => {
      const { g, t } = lienzo(512, 280);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(0, 0, 512, 280, 34); g.fill();
      g.fillStyle = '#3a2d4f'; g.beginPath(); g.roundRect(8, 8, 496, 264, 28); g.fill();
      g.strokeStyle = 'rgba(255,250,240,.12)'; g.lineWidth = 3; g.setLineDash([10, 10]);
      g.beginPath(); g.roundRect(24, 24, 464, 232, 20); g.stroke();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(TAPETE.x * 2, TAPETE.z1 - TAPETE.z0), mb({ map: t }));
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.002, (TAPETE.z0 + TAPETE.z1) / 2);
      return m;
    })();
    base.add(tapete);

    // ---------- texturas de las cosas (las del 2D, pintadas a mano) ----------
    const texMoneda = (() => {
      const { g, t } = lienzo(128, 128);
      g.fillStyle = TINTA; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
      g.fillStyle = '#f5c542'; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.fill();
      g.strokeStyle = '#c99a1e'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 37, 0, 7); g.stroke();
      g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(50, 50, 16, 0, 7); g.fill();
      g.fillStyle = '#c99a1e'; g.font = '52px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 66, 70);
      return t;
    })();
    const texBillete = (() => {
      const { g, t } = lienzo(256, 140);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(0, 0, 256, 140, 12); g.fill();
      g.fillStyle = '#7ccf8a'; g.beginPath(); g.roundRect(9, 9, 238, 122, 8); g.fill();
      g.fillStyle = '#a8e6b2'; g.fillRect(24, 24, 34, 92); g.fillRect(198, 24, 34, 92);
      g.fillStyle = '#4e9a5c'; g.beginPath(); g.arc(128, 70, 34, 0, 7); g.fill();
      g.fillStyle = '#a8e6b2'; g.font = '44px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('20', 128, 74);
      return t;
    })();
    const texFactura = (() => {
      const { g, t } = lienzo(168, 208);
      g.fillStyle = TINTA; g.beginPath(); g.roundRect(0, 0, 168, 208, 10); g.fill();
      g.fillStyle = '#fffdf6'; g.beginPath(); g.roundRect(9, 9, 150, 190, 6); g.fill();
      g.fillStyle = '#e8233f'; g.fillRect(26, 24, 84, 12);
      g.fillStyle = '#d8cfb8'; for (const y of [52, 74, 96, 118]) g.fillRect(26, y, 116, 8);
      g.strokeStyle = '#e8233f'; g.lineWidth = 8; g.beginPath(); g.arc(112, 162, 24, 0, 7); g.stroke();
      g.fillStyle = '#e8233f'; g.font = '28px Caprasimo, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 112, 164);
      return t;
    })();
    const geoMoneda = new THREE.CylinderGeometry(0.029, 0.029, 0.008, 28);
    const matsMoneda = [mb({ color: '#c99a1e' }), mb({ map: texMoneda }), mb({ map: texMoneda })];
    const geoBillete = new THREE.BoxGeometry(0.11, 0.004, 0.06);
    const lado = mb({ color: '#4e9a5c' }), ladoF = mb({ color: '#d8cfb8' });
    const matsBillete = [lado, lado, mb({ map: texBillete }), mb({ map: texBillete }), lado, lado];
    const geoFactura = new THREE.BoxGeometry(0.074, 0.003, 0.096);
    const matsFactura = [ladoF, ladoF, mb({ map: texFactura }), mb({ map: texFactura }), ladoF, ladoF];
    const texHucha = await ctx.img('obj-hucha.png').catch(() => null);
    const matHucha = texHucha ? mb({ map: texHucha, alphaTest: 0.5, side: THREE.DoubleSide }) : mb({ color: '#ff9ec4' });

    function hacerCosa(clave) {
      const g = new THREE.Group();
      let m;
      if (clave === 'moneda') m = tinta(new THREE.Mesh(geoMoneda, matsMoneda), 0.003);
      else if (clave === 'billete') m = tinta(new THREE.Mesh(geoBillete, matsBillete), 0.003);
      else if (clave === 'factura') m = tinta(new THREE.Mesh(geoFactura, matsFactura), 0.003);
      else { m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.073), matHucha); }
      g.add(m); g.userData.malla = m;
      return g;
    }

    // ---------- la cinta y la registradora ----------
    const largo = CINTA.x1 - CINTA.x0;
    const bastidor = caja(largo + 0.03, CINTA.alto - 0.004, CINTA.ancho + 0.02, '#2a2238');
    bastidor.position.set(0, (CINTA.alto - 0.004) / 2, CINTA.z); base.add(bastidor);
    const texCinta = (() => {
      const { g, t } = lienzo(128, 64);
      g.fillStyle = '#4a3d63'; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#3d3350'; g.fillRect(0, 0, 18, 64);
      t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); return t;
    })();
    const banda = new THREE.Mesh(new THREE.PlaneGeometry(largo, CINTA.ancho), mb({ map: texCinta }));
    banda.rotation.x = -Math.PI / 2; banda.position.set(0, CINTA.alto + 0.0005, CINTA.z); base.add(banda);
    for (const s of [-1, 1]) {
      const borde = caja(largo + 0.03, 0.012, 0.008, '#8a7aa8', 0.002); borde.position.set(0, CINTA.alto + 0.006, CINTA.z + s * (CINTA.ancho / 2 + 0.006)); base.add(borde);
    }
    // la boca del final: por ahí se escapa lo que no clasificas
    const boca = caja(0.03, 0.05, CINTA.ancho + 0.03, '#e8364f', 0.003); boca.position.set(CINTA.x1 + 0.025, 0.025, CINTA.z); base.add(boca);
    // registradora (de ahí sale todo)
    const regis = new THREE.Group(); regis.position.set(CINTA.x0 - 0.1, 0, CINTA.z); base.add(regis);
    const cuerpoR = caja(0.15, 0.08, 0.18, '#c94f6d'); cuerpoR.position.y = 0.04; regis.add(cuerpoR);
    const cajon = caja(0.13, 0.025, 0.05, '#ffe066', 0.003); cajon.position.set(0.02, 0.06, 0.09); regis.add(cajon);
    const tecl = caja(0.12, 0.03, 0.1, '#8a2f4a'); tecl.position.set(0, 0.095, 0.02); tecl.rotation.x = 0.35; regis.add(tecl);
    for (let i = 0; i < 9; i++) { const k = caja(0.022, 0.008, 0.02, PAPEL, 0.002); k.position.set(-0.035 + (i % 3) * 0.035, 0.016, -0.03 + Math.floor(i / 3) * 0.03); tecl.add(k); }
    const pantalla = lienzo(256, 96);
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), mb({ map: pantalla.t }));
    const poste = caja(0.02, 0.06, 0.02, '#8a2f4a', 0.003); poste.position.set(0, 0.14, -0.06); regis.add(poste);
    visor.position.set(0, 0.185, -0.055); visor.rotation.x = -0.25; regis.add(visor);
    const visorTinta = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.055), mb({ color: TINTA })); visorTinta.position.set(0, 0.185, -0.057); visorTinta.rotation.x = -0.25; regis.add(visorTinta);
    let botaCajon = 0;

    // ---------- las tres bandejas ----------
    const bandejas = BANDEJAS.map((b, i) => {
      const g = new THREE.Group(); g.position.set(b.x, 0, B_Z); base.add(g);
      const cuerpo = new THREE.Group(); g.add(cuerpo);
      const fondo = caja(B_MX * 2, 0.008, B_MZ * 2, b.fondo, 0.003); fondo.position.y = 0.004; cuerpo.add(fondo);
      for (const [w, d, x, z] of [[B_MX * 2 + 0.012, 0.012, 0, -B_MZ], [B_MX * 2 + 0.012, 0.012, 0, B_MZ], [0.012, B_MZ * 2, -B_MX, 0], [0.012, B_MZ * 2, B_MX, 0]]) {
        const p = caja(w, B_ALTO, d, b.color, 0.003); p.position.set(x, B_ALTO / 2, z); cuerpo.add(p);
      }
      // la etiqueta, en el canto que te mira, con su dibujo
      const { g: c, t } = lienzo(512, 128);
      c.fillStyle = TINTA; c.beginPath(); c.roundRect(0, 0, 512, 128, 26); c.fill();
      c.fillStyle = b.color; c.beginPath(); c.roundRect(8, 8, 496, 112, 20); c.fill();
      c.drawImage([texMoneda, texBillete, texFactura][i].image, 22, 18, i === 1 ? 140 : i === 0 ? 92 : 74, 92);
      c.fillStyle = TINTA; c.font = '64px Caprasimo, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.nombre, 300, 70);
      const etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.0425), mb({ map: t }));
      etiqueta.position.set(0, 0.02, B_MZ + 0.035); etiqueta.rotation.x = -1.0; g.add(etiqueta);
      return { ...b, i, g, cuerpo, monton: [], squash: 0, vSquash: 0, brillo: 0 };
    });
    const centroBandeja = (i, out = V()) => W(bandejas[i].x, 0.03, B_Z, out);

    // ---------- Blancaso, de juguete, al otro lado de la mesa ----------
    const blancaso = await ctx.Recortable.crear('blancaso', 'humo');
    blancaso.grupo.scale.setScalar(0.5);
    blancaso.grupo.position.copy(W(0.2, 0, -0.4));
    blancaso.grupo.quaternion.copy(qBase);
    grupo.add(blancaso.grupo);
    blancaso.pose('agenda', { rebote: 0 });
    let poseFija = 'agenda', volverPose = 0;
    const posar = (p, s = 1.1) => { blancaso.pose(p); volverPose = s; };
    const decir = (t, prob = 1) => { if (Math.random() > prob || reloj < vozLibre) return; vozLibre = reloj + 2; blancaso.decir(t); };

    // ---------- la libreta: el marcador (Blancaso lo apunta todo) ----------
    const libreta = new THREE.Group(); libreta.position.copy(W(-0.27, 0.115, -0.38)); grupo.add(libreta);
    libreta.lookAt(xr.cabeza.clone().setY(Math.max(xr.cabeza.y, alturaMesa + 0.3)));
    const tapa = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.012), mb({ color: '#4a3826' })); tapa.position.z = -0.008; tinta(tapa, 0.004); libreta.add(tapa);
    const hoja = lienzo(512, 352);
    const pagina = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.206), mb({ map: hoja.t })); libreta.add(pagina);
    const patas = caja(0.012, 0.115, 0.012, '#4a3826', 0.002); patas.position.set(0, -0.06, -0.06); patas.rotation.x = 0.5; libreta.add(patas);
    for (const [x, y, col] of [[0.13, 0.1, '#ff6fb5'], [-0.05, 0.11, '#ffe066'], [0.155, -0.04, '#5fb8ff']]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.025), mb({ color: col })); p.position.set(x, y, -0.0005); p.rotation.z = (Math.random() - 0.5) * 0.4; libreta.add(p);
    }
    function pintarLibreta() {
      const { g, c, t } = hoja;
      g.fillStyle = '#fff8e4'; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#c9d8f0'; g.lineWidth = 3; for (let y = 70; y < 352; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
      g.strokeStyle = '#f0a0a0'; g.beginPath(); g.moveTo(54, 0); g.lineTo(54, 352); g.stroke();
      g.strokeStyle = '#4a3826'; g.lineWidth = 10; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 352); g.stroke();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#3a2d4f'; g.font = '38px Caprasimo, serif'; g.fillText('Caja', 66, 40);
      g.fillStyle = TINTA; g.font = `${E.puntos >= 1000 ? 58 : 74}px Caprasimo, serif`; g.fillText(String(E.puntos), 66, 128);
      g.fillStyle = '#3d8d40'; g.font = '34px Caprasimo, serif'; g.fillText(`hucha ${E.salvado}`, 66, 210);
      const mult = 1 + Math.floor(E.combo / 5) * 0.5;
      g.fillStyle = mult > 1 ? '#e8364f' : '#8a7aa8'; g.fillText(mult > 1 ? `x${String(mult).replace('.', ',')}` : `${E.combo} seguidas`, 66, 290);
      // página derecha: tiempo y bajón
      g.fillStyle = '#3a2d4f'; g.font = '38px Caprasimo, serif'; g.fillText('Quedan', 280, 40);
      const s = Math.ceil(Math.max(0, E.restante));
      g.fillStyle = s <= 10 && E.fase === 'juego' ? '#e8364f' : TINTA; g.font = '74px Caprasimo, serif'; g.fillText(`${s} s`, 280, 128);
      g.fillStyle = '#3a2d4f'; g.font = '30px Caprasimo, serif'; g.fillText('bajón', 280, 210);
      for (let i = 0; i < BAJON_MAX; i++) {
        const x = 296 + i * 44, y = 282;
        g.fillStyle = i < E.bajon ? '#e8364f' : '#7ee081'; g.strokeStyle = TINTA; g.lineWidth = 6;
        g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.stroke();
      }
      t.needsUpdate = true;
      // y el visor de la registradora
      const p = pantalla; p.g.fillStyle = '#16301c'; p.g.fillRect(0, 0, 256, 96);
      p.g.fillStyle = '#7ee081'; p.g.font = '58px Caprasimo, serif'; p.g.textAlign = 'right'; p.g.textBaseline = 'middle';
      p.g.fillText(String(E.puntos).padStart(5, ' '), 240, 52); p.t.needsUpdate = true;
      sucio = false;
    }

    // ---------- textos que saltan (+50, ¡Racha!) ----------
    const saltos = [];
    function saltaTexto(texto, color, pos, tam = 0.16) {
      const ancho = texto.length > 12 ? 1024 : 512, { g, t } = lienzo(ancho, 160);
      let px = 84; g.font = `${px}px Caprasimo, serif`;
      while (g.measureText(texto).width > ancho - 40 && px > 40) { px -= 4; g.font = `${px}px Caprasimo, serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 18; g.strokeStyle = TINTA; g.strokeText(texto, ancho / 2, 84); g.fillStyle = color; g.fillText(texto, ancho / 2, 84);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(tam * ancho / 512, tam * 160 / 512), mb({ map: t, transparent: true, depthTest: false }));
      m.renderOrder = 40; m.position.copy(pos); grupo.add(m);
      saltos.push({ m, t: 0 });
    }

    // ---------- las cosas ----------
    const sacarTipo = baraja(['moneda', 'moneda', 'billete', 'billete', 'factura', 'factura']);
    let forzada = null;   // solo para pruebas: la próxima cosa que salga
    function nueva() {
      const clave = forzada || (nivel >= 3 && Math.random() < 0.12 ? 'hucha' : sacarTipo());
      forzada = null;
      const tipo = TIPOS[clave];
      const m = hacerCosa(clave); grupo.add(m);
      const it = { tipo, clave, m, estado: 'cinta', x: CINTA.x0 + 0.02, yaw: clave === 'hucha' ? 0 : (Math.random() - 0.5) * 0.8, t: 0, tMesa: 0, mano: null, como: null };
      it.c = fisica.anadir(m, { radio: tipo.radio, rebote: 0.25, roce: 0.9, masa: 0.3, gravedad: tipo.gravedad, datos: { cuentas: it } });
      ponerEnCinta(it);
      it.c.dormido = true;
      items.push(it);
      botaCajon = 1;
      return it;
    }
    const _q = new THREE.Quaternion(), _y = V(0, 1, 0);
    function ponerEnCinta(it) {
      W(it.x, CINTA.alto + it.tipo.apoyo + 0.001, CINTA.z + (it.clave === 'hucha' ? 0 : Math.sin(it.yaw * 7) * 0.015), it.m.position);
      it.m.quaternion.copy(qBase).multiply(_q.setFromAxisAngle(_y, it.yaw));
    }
    function quitarCosa(it, humoColor = true) {
      it.estado = 'fin';
      for (const m of [xr.manos.derecha, xr.manos.izquierda]) if (agarre.lleva(m) === it.c) agarre.soltar(m, false);
      fisica.quitar(it.c);
      if (humoColor) for (let i = 0; i < 6; i++) humo.soltar({ pos: it.m.position.clone(), vel: V((Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.15, (Math.random() - 0.5) * 0.25), tam: 0.025, vida: 0.9, crece: 0.05, sube: 0.05, frena: 2, brillo: 0.6, alfa: 0.7 });
      grupo.remove(it.m);
      const k = items.indexOf(it); if (k >= 0) items.splice(k, 1);
    }

    // ---------- ayuda de puntería: si va más o menos hacia una bandeja, cae dentro ----------
    const _a = V(), _b = V();
    function asistir(it, vel, conoGrados) {
      const h = Math.hypot(vel.x, vel.z); if (h < 0.3) return null;
      const p = it.m.position;
      let mejor = null, mejorAng = conoGrados * Math.PI / 180;
      for (const b of bandejas) {
        const c = centroBandeja(b.i, _a);
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.02) { mejor = b; mejorAng = 0; continue; }
        const ang = Math.acos(THREE.MathUtils.clamp((dx * vel.x + dz * vel.z) / (d * h), -1, 1));
        if (ang < mejorAng) { mejorAng = ang; mejor = b; }
      }
      if (!mejor) return null;
      const meta = centroBandeja(mejor.i, _b);
      const dx = meta.x - p.x, dz = meta.z - p.z, D = Math.hypot(dx, dz);
      const T = THREE.MathUtils.clamp(0.22 + D * 0.8, 0.26, 0.55), g = 9.8 * it.tipo.gravedad;
      const vy = (meta.y - p.y + 0.5 * g * T * T) / T;
      return V(dx / T, vy, dz / T).multiplyScalar(1.02);
    }

    // ---------- coger, soltar, lanzar ----------
    const alCogerAntes = agarre.alCoger, alSoltarAntes = agarre.alSoltar;
    agarre.alCoger = (c, mano) => {
      alCogerAntes?.(c, mano);
      const it = c.datos?.cuentas; if (!it || it.estado === 'fin') return;
      it.estado = 'suelto'; it.t = 0; it.mano = mano; it.como = 'mano';
      sonido(it.clave === 'moneda' || it.clave === 'hucha' ? 'lata' : 'papel', { volumen: 0.2, tono: it.clave === 'moneda' ? 2.4 : 1.5 });
      if (E.aciertos < 3 && E.fase === 'juego') ui.instruccion('Suéltala encima de su bandeja… o lánzala');
    };
    agarre.alSoltar = (c, mano) => {
      alSoltarAntes?.(c, mano);
      const it = c.datos?.cuentas; if (!it || it.estado === 'fin') return;
      it.estado = 'suelto'; it.t = 0; it.mano = mano;
      if (c.vel.length() > 0.8) {
        const v = asistir(it, c.vel, 35);
        if (v) { c.vel.copy(v); it.como = 'lanzada'; sonido('fiu', { volumen: 0.25, tono: 1.4 + Math.random() * 0.3 }); }
      }
    };

    // ---------- manotazo: barrido rápido a ras de la cinta ----------
    const _l = V();
    function manotazos() {
      for (const mano of [xr.manos.derecha, xr.manos.izquierda]) {
        if (!mano.activa || agarre.lleva(mano) || mano.pinza) continue;
        const v = mano.vel, h = Math.hypot(v.x, v.z);
        if (h < 1.3 || h < Math.abs(v.y)) continue;
        for (const it of items.slice()) {
          if (it.estado !== 'cinta' && it.estado !== 'mesa') continue;
          if (it.m.position.distanceTo(mano.punta) > 0.075 + it.tipo.radio) continue;
          const vel = asistir(it, v, 50) || v.clone().multiplyScalar(0.9).add(V(0, 0.9, 0));
          it.estado = 'suelto'; it.t = 0; it.mano = mano; it.como = 'manotazo';
          fisica.lanzar(it.c, vel, V((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 18));
          E.manotazos++;
          mano.vibrar(0.5, 30);
          sonido('zas', { volumen: 0.3, tono: 1.1 + Math.random() * 0.3 });
          if (E.manotazos === 1) luego(0.5, () => decir('Eso… también vale. Lo apunto.', 0.8));
        }
      }
    }

    // ---------- aciertos y fallos ----------
    const frasesAcierto = baraja(['Apuntado.', 'Columna buena. Lo apunto.', 'Esto cuadra. De momento.', 'Diversión: apuntada.', 'Lo subrayo. Dos veces.']);
    const frasesFallo = baraja(['Eso no va ahí…', 'Lo tengo que tachar.', 'Uy. Uy, uy.', 'No cuadra. No cuadra.', 'Lo apunto en rojo.']);

    function entrar(it, b) {
      const bien = it.tipo.destino === b.i;
      const pos = it.m.position.clone();
      fisica.quitar(it.c); it.estado = 'fin';
      const k = items.indexOf(it); if (k >= 0) items.splice(k, 1);
      b.vSquash -= 1.6;
      E.resultados.push({ clave: it.clave, bien, bandeja: b.i, como: it.como || 'mano' });
      if (!bien) {
        grupo.remove(it.m);
        for (let i = 0; i < 5; i++) humo.soltar({ pos, vel: V((Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3), tam: 0.025, vida: 0.8, crece: 0.05, sube: 0.05, frena: 2, brillo: 0.4, alfa: 0.7 });
        it.mano?.vibrar(0.9, 90);
        fallo(`¡Eso no va ahí! Era ${it.tipo.una}`, 'horror');
        return;
      }
      // al monton de su bandeja
      b.g.add(it.m);
      const n = b.monton.length;
      it.m.position.set((Math.random() - 0.5) * 0.09, 0.009 + it.tipo.apoyo + Math.min(0.03, n * 0.0035), (Math.random() - 0.5) * 0.06);
      it.m.quaternion.setFromAxisAngle(_y, Math.random() * Math.PI * 2);
      if (it.clave === 'hucha') it.m.quaternion.identity();
      b.monton.push(it.m);
      while (b.monton.length > 14) b.g.remove(b.monton.shift());
      E.combo++; E.aciertos++;
      const pts = Math.round(it.tipo.valor * 5 * (1 + Math.floor(E.combo / 5) * 0.5)) * (it.tipo.hucha ? 3 : 1);
      E.puntos += pts; E.salvado += it.tipo.salva;
      sucio = true;
      it.mano?.vibrar(it.como === 'manotazo' ? 0.7 : 0.5, 45);
      if (it.clave === 'moneda' || it.clave === 'hucha') { sonido('campanita', { volumen: 0.35, tono: 1.35 + Math.random() * 0.3 }); sonido('lata', { volumen: 0.18, tono: 2.3 + Math.random() * 0.4 }); }
      else sonido('papel', { volumen: 0.4, tono: 0.9 + Math.random() * 0.3 });
      const arriba = W(b.x, 0.11, B_Z);
      if (it.tipo.hucha) {
        saltaTexto(`¡Una hucha! +${pts}`, '#ffe066', arriba.clone().add(V(0, 0.06, 0)), 0.17);
        sonido('tiroriro', { volumen: 0.45 }); decir('¡Una hucha! Eso va aparte.');
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; humo.soltar({ pos: arriba, vel: V(Math.cos(a) * 0.3, 0.35, Math.sin(a) * 0.3), tam: 0.03, vida: 1, crece: 0.06, sube: 0.08, frena: 2, brillo: 0.9, alfa: 0.8 }); }
      } else saltaTexto(`+${pts}`, it.como === 'manotazo' ? '#ffe066' : '#7ee08a', arriba, it.como === 'manotazo' ? 0.13 : 0.1);
      if (E.combo % 5 === 0) {
        luego(0.25, () => { saltaTexto(`¡${E.combo} seguidas!`, '#ff9ec4', W(0, 0.22, -0.05), 0.17); sonido('oooh', { volumen: 0.4 }); });
        if (E.bajon < 3) posar('esperanza', 1.3);
        if (E.combo === 5 || E.combo % 10 === 0) luego(0.6, () => decir(frasesAcierto()));
      } else if (E.bajon < 3 && Math.random() < 0.25) blancaso.empujon(0.08);
      if (E.aciertos === 3) ui.instruccion(null);
    }

    function fallo(texto, pose = 'mareado') {
      if (E.fase !== 'juego') return;
      E.combo = 0; E.bajon++; sucio = true;
      sonido('bonk', { volumen: 0.55 });
      saltaTexto(texto, '#ff7aa8', W(0, 0.2, -0.02), 0.2);
      if (E.bajon === 3) {
        poseFija = 'derritiendose'; blancaso.pose('derritiendose', { rebote: 0.25 }); volverPose = 0;
        vozLibre = 0; decir('Otra vez no…'); sonido('suspiro', { volumen: 0.45 });
      } else if (E.bajon < BAJON_MAX) {
        if (E.bajon < 3) posar(pose, 1.2); else blancaso.empujon(0.2);
        luego(0.5, () => decir(frasesFallo(), 0.5));
      }
      if (E.bajon >= BAJON_MAX) final(false);
    }

    function final(acabo) {
      if (acabado) return;
      acabado = true; E.fase = 'fin'; sucio = true;
      ui.instruccion(null);
      for (const it of items.slice()) quitarCosa(it);
      const aHucha = acabo ? E.salvado : Math.floor(E.salvado / 2);
      E.aHucha = aHucha;
      vozLibre = 0;
      if (acabo) {
        poseFija = 'esperanza'; blancaso.pose('esperanza', { rebote: 0.3 }); sonido('aaah', { volumen: 0.5 });
        decir('¡Cuadra! Lo apunto en grande.');
      } else {
        poseFija = 'suspiro'; blancaso.pose('suspiro', { rebote: 0.2 }); sonido('suspiro', { volumen: 0.6 });
        decir('Lo apunto: «hoy, no».');
      }
      try { ctx.hucha?.(aHucha); } catch (e) { console.error(e); }
      luego(1.4, () => ctx.terminar({
        puntos: E.puntos, gana: acabo,
        linea: `${acabo ? '¡La caja cuadra!' : 'A Blancaso le da el bajón.'} ${aHucha} monchis a la hucha de la aso.`,
      }));
    }

    // ---------- cada cosa, cada fotograma ----------
    function moverCosas(dt) {
      for (const it of items.slice()) {
        const c = it.c;
        it.t += dt;
        if (it.estado === 'cinta') {
          if (c.cogido) { it.estado = 'suelto'; continue; }
          if (!c.dormido && c.vel.lengthSq() > 0.02) { it.estado = 'suelto'; it.t = 0; it.como = 'manotazo'; continue; } // le han dado un golpe
          it.x += vCinta * dt;
          ponerEnCinta(it);
          const pulso = it.x > CINTA.x1 - 0.14 ? 1 + 0.12 * Math.max(0, Math.sin(reloj * 18)) : Math.min(1, 0.3 + it.t * 5);
          it.m.scale.setScalar(pulso);
          c.vel.set(0, 0, 0); c.dormido = true;
          if (it.x > CINTA.x1) {
            // se escapa por el final de la cinta
            it.estado = 'cae'; it.t = 0; it.m.scale.setScalar(1);
            fisica.lanzar(c, W(1, 0.6, 0).sub(base.position).multiplyScalar(0.6), V(0, 0, -6));
            c.cogible = false;
            sonido('fiuuu', { volumen: 0.3, tono: 1.3 });
            fallo(`¡Se escapa ${it.tipo.una}!`);
          }
          continue;
        }
        if (it.estado === 'cae') { if (it.t > 0.9) quitarCosa(it); continue; }
        if (it.estado === 'mesa') {
          if (c.cogido) { it.estado = 'suelto'; it.t = 0; it.m.visible = true; continue; }
          it.tMesa += dt;
          it.m.visible = it.tMesa < 0.6 || Math.sin(it.tMesa * 22) > -0.3;
          if (it.tMesa > 1.6) { quitarCosa(it); fallo(`¡Se cae ${it.tipo.una}!`); }
          continue;
        }
        if (it.estado !== 'suelto' || c.cogido) continue;
        const l = L(c.obj.position, _l);
        // ¿en una bandeja?
        let dentro = null;
        if (l.y < 0.075 && c.vel.y <= 0.05) for (const b of bandejas) if (Math.abs(l.x - b.x) < B_MX && Math.abs(l.z - B_Z) < B_MZ) dentro = b;
        if (dentro) { entrar(it, dentro); continue; }
        // ¿de vuelta en la cinta?
        if (Math.abs(l.x) < CINTA.x1 - 0.01 && Math.abs(l.z - CINTA.z) < CINTA.ancho / 2 && l.y < CINTA.alto + it.tipo.radio && c.vel.y <= 0.01) {
          it.estado = 'cinta'; it.x = l.x; it.t = 1; c.dormido = true; c.vel.set(0, 0, 0); continue;
        }
        // ¿tirada en la mesa? hay un momento para rescatarla
        if (Math.abs(l.x) < TAPETE.x && l.z > TAPETE.z0 && l.z < TAPETE.z1 && l.y < it.tipo.radio && c.vel.y <= 0.01) {
          it.estado = 'mesa'; it.tMesa = 0; c.dormido = true; c.vel.set(0, 0, 0);
          l.y = it.tipo.apoyo + 0.003; W(l.x, l.y, l.z, it.m.position);
          it.m.quaternion.copy(qBase).multiply(_q.setFromAxisAngle(_y, Math.random() * 6));
          sonido(it.clave === 'moneda' ? 'lata' : 'papel', { volumen: 0.25, tono: 1.8 });
          continue;
        }
        if (l.y < -0.25 || Math.hypot(l.x, l.z) > 1.6 || it.t > 4) { quitarCosa(it); fallo(`¡Se cae ${it.tipo.una}!`); }
      }
    }

    // ---------- arranque ----------
    pintarLibreta();
    ctx.musica?.('minijuego');
    luego(0.5, () => { blancaso.pose('base'); blancaso.decir('Hoy la caja cuadra. Lo tengo apuntado.'); sonido('campanita', { en: regis, volumen: 0.5 }); });
    luego(1.2, () => ui.instruccion('Cada cosa a su bandeja: cógela… o dale un manotazo'));
    luego(3.2, () => { E.fase = 'juego'; blancaso.pose('agenda'); sucio = true; });

    const api = {
      E, items, bandejas, get fase() { return E.fase; },
      forzar: clave => { forzada = clave; }, centroBandeja: i => centroBandeja(i), mundo: (x, y, z) => W(x, y, z), local: v => L(v), cinta: CINTA,
    };
    grupo.userData.api = api;

    return {
      grupo,
      actualizar(dt) {
        reloj += dt;
        for (let i = tareas.length - 1; i >= 0; i--) if (tareas[i].t <= reloj) { const t = tareas.splice(i, 1)[0]; t.fn(); }
        blancaso.actualizar(dt, xr.cabeza);
        if (volverPose > 0 && (volverPose -= dt) <= 0) blancaso.pose(poseFija);
        if (E.fase === 'juego') {
          E.restante -= dt;
          const k = THREE.MathUtils.clamp((DURACION - E.restante) / DURACION, 0, 1);
          vCinta = (0.14 + k * 0.2) * (nivel >= 5 ? 1.15 : 1);
          proximo -= dt;
          if (proximo <= 0) { nueva(); proximo = Math.max(0.75, 1.5 - k * 0.75); }
          texCinta.offset.x -= vCinta * dt / (largo / texCinta.repeat.x);
          manotazos();
          moverCosas(dt);
          tPintar -= dt; if (tPintar <= 0) { tPintar = 0.25; sucio = true; }
          if (E.restante <= 0 && !acabado) final(true);
        } else if (E.fase === 'intro') texCinta.offset.x -= 0.05 * dt;
        if (sucio) pintarLibreta();
        // juice: bandejas que se aplastan y el cajón de la registradora
        for (const b of bandejas) {
          b.vSquash += (-b.squash * 160 - b.vSquash * 10) * dt; b.squash += b.vSquash * dt;
          b.cuerpo.scale.set(1 - b.squash * 0.5, 1 + b.squash, 1 - b.squash * 0.5);
        }
        botaCajon = Math.max(0, botaCajon - dt * 5);
        cajon.position.z = 0.09 + Math.sin(botaCajon * Math.PI) * 0.03;
        for (let i = saltos.length - 1; i >= 0; i--) {
          const s = saltos[i]; s.t += dt;
          s.m.position.y += dt * 0.12; s.m.lookAt(xr.cabeza);
          s.m.material.opacity = Math.min(1, 3 * (1.1 - s.t));
          if (s.t > 1.1) { grupo.remove(s.m); s.m.material.map.dispose(); s.m.material.dispose(); s.m.geometry.dispose(); saltos.splice(i, 1); }
        }
      },
      destruir() {
        acabado = true; tareas.length = 0;
        agarre.alCoger = alCogerAntes; agarre.alSoltar = alSoltarAntes;
        for (const it of items.slice()) quitarCosa(it, false);
        ui.instruccion(null);
        blancaso.callar();
        for (const t of texturas) t.dispose();
      },
    };
  },
};
