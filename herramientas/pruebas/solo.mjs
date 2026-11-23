// Arranca una escena suelta unos segundos: node solo.mjs Fumar [segundos]
import { abrir, foto, espera } from './comun.mjs';
const clave = process.argv[2] || 'Fumar';
const { navegador, pagina, errores } = await abrir();
await pagina.evaluate(k => { __prueba.lanzar(k); }, clave);
await espera(Number(process.argv[3] || 6) * 1000);
console.log(clave, await pagina.evaluate(k => ({ carga: __prueba.puente.metricas.cargas[k], cargas: Object.keys(__prueba.puente.metricas.cargas), actual: __prueba.puente.actual && __prueba.puente.actual.clave, faltan: __prueba.puente.metricas.faltan }), clave), 'errores', errores);
await foto(pagina, `solo-${clave}`);
await navegador.close();
