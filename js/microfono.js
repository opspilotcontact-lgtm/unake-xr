// El micro, solo como VOLUMEN (soplar, gritar): el reconocimiento de voz no es fiable en el navegador de la Quest.
// Es opcional: todo lo que usa el micro tiene otra forma de hacerse.
let analizador = null, datos = null, nivel = 0, soplando = 0;

export async function activarMicro(ctx) {
  if (analizador) return true;
  try {
    const flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    const fuente = ctx.createMediaStreamSource(flujo);
    analizador = ctx.createAnalyser(); analizador.fftSize = 1024;
    datos = new Float32Array(analizador.fftSize);
    fuente.connect(analizador);
    return true;
  } catch (e) {
    console.warn('Micro no disponible', e);
    return false;
  }
}
export const hayMicro = () => !!analizador;

// por fotograma: nivel suavizado 0-1 y si se está soplando (más de ~0,12 s por encima del umbral)
export function leerMicro(dt) {
  if (!analizador) return { nivel: 0, sopla: false };
  analizador.getFloatTimeDomainData(datos);
  let s = 0; for (let i = 0; i < datos.length; i++) s += datos[i] * datos[i];
  const rms = Math.sqrt(s / datos.length);
  nivel += (Math.min(1, Math.max(0, (rms - 0.02) / 0.18)) - nivel) * Math.min(1, dt * 12);
  soplando = nivel > 0.22 ? soplando + dt : 0;
  return { nivel, sopla: soplando > 0.12 };
}
