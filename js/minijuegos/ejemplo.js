// EJEMPLO del contrato (docs/minijuegos.md): coger una bola de la mesa y encestarla en un cubo del suelo.
// No es del juego: sirve de plantilla y de prueba del marco y de la física.
export default {
  clave: 'Ejemplo', titulo: 'Ejemplo: encesta', escala: 'sala', umbrales: [100, 200, 300],
  async crear(ctx) {
    const { THREE, fisica, sonido } = ctx;
    const grupo = new THREE.Group();
    const mesa = ctx.mesa();
    const sobre = mesa ? mesa.punto.clone() : ctx.delante(0.45, ctx.xr.cabeza.y - 0.5);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff5fa2' }));
    bola.position.copy(sobre).add(new THREE.Vector3(0, 0.05, 0));
    grupo.add(bola);
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#4d8bff', side: THREE.DoubleSide }));
    cubo.position.copy(ctx.delante(1.8, 0.15)); grupo.add(cubo);
    let puntos = 0, tiros = 0, acabado = false;
    const salida = bola.position.clone();
    const c = fisica.anadir(bola, { radio: 0.035, rebote: 0.5, alGolpear: (_, i) => sonido('boing', { volumen: Math.min(0.6, i.fuerza / 4) }) });
    const obj = fisica.objetivo({ centro: () => cubo.position.clone().setY(0.2), radio: 0.13, alto: 0.12, alEntrar: () => { puntos += 100; sonido('campanita'); } });
    let enMano = false;
    fisica.alCogerEjemplo = null;
    return {
      grupo,
      actualizar(dt) {
        if (acabado) return;
        if (c.cogido) enMano = true;
        // al quedarse quieta tras un tiro: vuelve a la mesa
        if (enMano && !c.cogido && c.dormido) {
          enMano = false; tiros++; obj._dentro?.clear();
          if (tiros >= 3) { acabado = true; ctx.terminar({ puntos, gana: puntos > 0 }); return; }
          bola.position.copy(salida); c.vel.set(0, 0, 0); c.dormido = false;
        }
      },
      destruir() { fisica.quitar(c); fisica.quitarObjetivo(obj); },
    };
  },
};
