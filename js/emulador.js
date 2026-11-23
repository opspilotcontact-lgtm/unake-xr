// Emulador de gafas para probar RV/RM en el PC (solo con ?emular en la URL).
// Usa el Immersive Web Emulation Runtime de Meta (IWER), su panel de control (DevUI)
// y el módulo de entornos sintéticos (SEM), que aporta planos detectados (paredes, suelo, mesas)
// para probar que el planeta se apoya en una mesa.
// Versiones fijadas en el importmap de index.html (iwer, @iwer/devui y @iwer/sem 2.8.0).
//
// Teclas por defecto del DevUI (mando derecho): ratón izq. = gatillo, ratón dcho. = agarre,
// flechas = stick, Intro = A, Mayús dcha. = B. Mando izquierdo: Q = gatillo, E = agarre,
// WASD = stick, X/Z = botones X/Y. Para mover un mando, arrastra su icono en el DevUI.
// Desde la consola: window.__xrEmulado (XRDevice) permite colocar mandos y pulsar botones,
// p. ej. __xrEmulado.controllers.left.updateButtonValue('squeeze', 1).
import { XRDevice, metaQuest3 } from 'iwer';

// Entornos: capturas reales en JSON (living_room, meeting_room, music_room, office_large, office_small).
// Las «rooms» nuevas de SEM (kitchen, bedroom…) piden además el paquete @drawcall/glts, que no
// está en el importmap: no se usan. living_room trae paredes, ventanas y varias mesas.
// Otro entorno: ?emular&entorno=office_small
const ENTORNO = new URLSearchParams(location.search).get('entorno') || 'living_room';

const dispositivo = new XRDevice(metaQuest3);
// Chrome de escritorio ya trae un navigator.xr nativo (sin gafas): hay que forzar la sustitución.
dispositivo.installRuntime({ forceInstall: true });
window.__xrEmulado = dispositivo;

// DevUI y SEM son pesados (React, three propio); si fallan, el runtime sigue sirviendo.
try {
  const { DevUI } = await import('@iwer/devui');
  dispositivo.installDevUI(DevUI);
} catch (err) { console.warn('Emulador: no se pudo cargar el panel DevUI', err); }

try {
  const { SyntheticEnvironmentModule } = await import('@iwer/sem');
  dispositivo.installSEM(SyntheticEnvironmentModule);
  // el entorno se descarga del propio paquete en el CDN; no bloquea el arranque
  dispositivo.sem?.loadDefaultEnvironment(ENTORNO).catch(err => console.warn('Emulador: entorno sintético no disponible', err));
} catch (err) { console.warn('Emulador: sin planos emulados (SEM no cargó)', err); }

console.info(`Emulador WebXR activo (Meta Quest 3, entorno «${ENTORNO}»). La Quest 3S usa el mismo navegador y mandos.`);
