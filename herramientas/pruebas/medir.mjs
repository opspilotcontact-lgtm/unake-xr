// Coste del puente: fps y CPU por fotograma del bucle three sin puente, con el puente en espera y con
// Pipas en marcha (WebGL y canvas 2D); tiempo de arranque, descarga y memoria aproximada.
// Uso: node herramientas/pruebas/medir.mjs
import { abrir, espera } from './comun.mjs';

async function medir(ruta, conJuego) {
  const { navegador, pagina, errores } = await abrir(ruta);
  await espera(3000);
  const muestra = () => pagina.evaluate(() => ({ fps: __prueba.fps(), cpuMs: +(__prueba.cpu || 0).toFixed(2), pasoMs: __prueba.puente ? __prueba.puente.metricas.pasoMs : null }));
  const reposo = await muestra();
  let juego = null;
  let extra = {};
  if (conJuego) {
    await pagina.evaluate(() => { __prueba.lanzar('Pipas'); });
    await espera(8000);
    juego = await muestra();
    extra = await pagina.evaluate(() => {
      const p = __prueba.puente;
      return { arranqueMs: p.metricas.arranqueMs, cargaPipas: p.metricas.cargas.Pipas, descargadoMB: p.descargadoMB(), mem: p.memoria(), gl: navigator.userAgent.includes('Headless') ? 'headless' : 'normal' };
    });
    extra.renderer = await pagina.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'desconocido';
    });
  }
  const heap = await pagina.evaluate(() => performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null);
  await navegador.close();
  return { ruta, reposo, juego, heapMB: heap, errores: errores.length, ...extra };
}

for (const [ruta, conJuego] of [['/puente.html?sin', false], ['/puente.html', true], ['/puente.html?r=canvas', true]]) {
  console.log(JSON.stringify(await medir(ruta, conJuego)));
}
