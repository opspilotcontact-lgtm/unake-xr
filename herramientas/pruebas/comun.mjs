// Utilidades de las pruebas del puente (Playwright headless con el Chrome del sistema).
// Servidor: python servir_lan.py --local 18771 (desde la raíz del repo).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/NIBI/Documents/GitHub/presupuesya-maqueta/node_modules/playwright-core');

export const URL_BASE = process.env.PUENTE_URL || 'http://127.0.0.1:18771';
export const FOTOS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fotos');
mkdirSync(FOTOS, { recursive: true });

export async function abrir(ruta = '/puente.html', { centinela = true } = {}) {
  const navegador = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'],
  });
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  const avisos = [];
  pagina.on('console', m => {
    if (m.type() === 'error') errores.push(m.text());
    if (m.type() === 'warning') avisos.push(m.text());
  });
  pagina.on('pageerror', e => errores.push(`pageerror: ${e.message}`));
  // Una partida «real» del juego web en el mismo origen: el puente no debe leerla ni pisarla.
  if (centinela) await pagina.addInitScript(() => { if (!localStorage.getItem('unake-partida')) localStorage.setItem('unake-partida', '{"centinela":1,"monchis":777}'); });
  await pagina.goto(URL_BASE + ruta);
  try {
    await pagina.waitForFunction(() => window.__prueba && window.__prueba.listo, null, { timeout: 60000 });
  } catch (e) {
    console.error('No arranca:', errores, avisos);
    await navegador.close();
    throw e;
  }
  return { navegador, pagina, errores, avisos };
}

export const foto = (pagina, nombre) => pagina.screenshot({ path: path.join(FOTOS, `${nombre}.png`) });
export const espera = ms => new Promise(r => setTimeout(r, ms));
