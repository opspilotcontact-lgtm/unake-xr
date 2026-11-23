// Barrido: arranca cada escena registrada en el puente durante unos segundos (sin jugar) y apunta
// errores de consola, texturas del catálogo pedidas sin cargar y si la escena sigue viva.
// Uso: node herramientas/pruebas/barrido.mjs [segundos=7]
import { abrir, foto, espera } from './comun.mjs';

const segundos = Number(process.argv[2] || 7);
const { navegador, pagina, errores } = await abrir();
const escenas = await pagina.evaluate(() => [...__prueba.puente.escenas]);
const filas = [];
for (const clave of escenas) {
  const e0 = errores.length;
  await pagina.evaluate(k => { window.__f0 = __prueba.puente.metricas.faltan.length; __prueba.lanzar(k).catch(e => console.error(String(e))); }, clave);
  await espera(segundos * 1000);
  const info = await pagina.evaluate(k => {
    const p = __prueba.puente;
    const s = p.game.scene.getScene(k);
    const activas = p.game.scene.getScenes(true).map(x => x.scene.key).filter(x => x !== 'PuenteEspera');
    return { activa: !!(s && s.sys.isActive()), activas, faltan: p.metricas.faltan.slice(__f0).map(f => f.clave), carga: p.metricas.cargas[k], salidas: __prueba.salidas.slice(-1)[0] };
  }, clave);
  await foto(pagina, `barrido-${clave}`);
  const errs = errores.slice(e0);
  filas.push({ clave, ...info, errores: errs });
  console.log(`${clave.padEnd(12)} activa=${info.activa} ${info.activas.join(',')} carga=${info.carga ? `${info.carga.ms}ms/${info.carga.archivos}` : '-'} faltan=[${info.faltan.join(' ')}] errores=${errs.length ? errs.join(' || ').slice(0, 300) : 0}`);
  await pagina.evaluate(() => __prueba.puente.cerrar());
  await espera(300);
}
await navegador.close();
