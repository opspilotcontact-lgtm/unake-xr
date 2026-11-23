// Bot del ejemplo: tres tiros con la bola (cuerpo de generador; ver herramientas/pruebas/minijuego.mjs)
M.mirar(0, 1.6, 0.4, 0, -0.35);
poner(der(), new T.Vector3(0.2, 1.1, -0.3), false);
yield* quieto(der(), 0.5);
for (let i = 0; i < 3; i++) {
  const bola = M.fisica.cuerpos[0];
  yield* hasta(() => !bola.cogido && !bola.vel.lengthSq() || bola.dormido, 6);
  yield* mover(der(), () => bola.obj.position.clone(), 0.4, false);
  yield* quieto(der(), 0.1, true);
  log('cogida: ' + !!bola.cogido);
  // lanzamiento hacia el cubo (1,8 m delante): un arco
  yield* mover(der(), new T.Vector3(0, 1.2, -0.5), 0.25, true);
  yield* mover(der(), new T.Vector3(0, 1.45, -0.95), 0.12, true);
  yield* quieto(der(), 0.02, false);
  if (i === 0) foto('lanzada');
  yield* hasta(() => bola.dormido || M.resultado, 6);
  log('tiro ' + (i + 1) + ': bola en ' + bola.obj.position.toArray().map(v => v.toFixed(2)));
}
yield* hasta(() => M.resultado, 5);
foto('final');
log('resultado ' + JSON.stringify(M.resultado));
