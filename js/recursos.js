// Carga y caché de texturas, personajes horneados y sonidos.
// Los dibujos de la serie se ven sin luz (MeshBasic): el color es el del dibujo, como en el 2D.
import * as THREE from 'three';

const cargador = new THREE.TextureLoader();
const texturas = new Map();
let anisotropia = 4;
export function fijarAnisotropia(n) { anisotropia = Math.min(8, n || 4); }

export function textura(url) {
  if (texturas.has(url)) return texturas.get(url);
  const p = new Promise((ok, mal) => cargador.load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropia;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    ok(t);
  }, undefined, () => mal(new Error('No carga ' + url))));
  texturas.set(url, p);
  return p;
}

// ---------- personajes (salen de herramientas/hornear_personajes.py) ----------
const indices = new Map();
export async function personaje(id, mundo) {
  const k = id + '/' + mundo;
  if (!indices.has(k)) {
    indices.set(k, fetch(`assets/personajes/${id}/${mundo}/indice.json`).then(r => {
      if (!r.ok) throw new Error(`Falta el personaje ${k}: ejecutá herramientas/hornear_personajes.py`);
      return r.json();
    }));
  }
  return indices.get(k);
}
export const fotoPersonaje = (id, mundo, nombre) => textura(`assets/personajes/${id}/${mundo}/${nombre}.webp`);
export const img = nombre => textura(`base/assets/img/${nombre}`);

// ---------- sonido ----------
let ctx = null, oyente = null;
const buffers = new Map();
export function audio() { return ctx; }
export function prepararAudio(listener) {
  oyente = listener; ctx = listener.context;
  if (ctx.state === 'suspended') ctx.resume().catch(() => { });
}
function buffer(nombre) {
  if (!ctx) return Promise.reject(new Error('sin audio'));
  if (!buffers.has(nombre)) {
    buffers.set(nombre, fetch(`base/assets/snd/${nombre}.mp3`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)));
  }
  return buffers.get(nombre);
}
export function precargarSonidos(lista) { for (const n of lista) buffer(n).catch(() => { }); }

// sonido(nombre) suena «en la cabeza»; con { en: objeto3D } suena desde ese sitio
export function sonido(nombre, { en = null, volumen = 0.8, tono = 1 } = {}) {
  if (!ctx) return;
  buffer(nombre).then(b => {
    let fuente;
    if (en && oyente) {
      fuente = new THREE.PositionalAudio(oyente);
      fuente.setRefDistance(0.8); fuente.setRolloffFactor(1.2);
      fuente.setBuffer(b); fuente.setVolume(volumen); fuente.setPlaybackRate(tono);
      en.add(fuente); fuente.play();
      fuente.source.onended = () => { en.remove(fuente); fuente.disconnect(); };
    } else {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b; s.playbackRate.value = tono; g.gain.value = volumen;
      s.connect(g).connect(ctx.destination); s.start();
    }
  }).catch(() => { });
}

// una sola música a la vez, con fundido (regla del 2D: nunca dos músicas)
let musicaActual = null;
export function musica(nombre, volumen = 0.35) {
  if (!ctx) return;
  if (musicaActual?.nombre === nombre) return;
  const anterior = musicaActual;
  if (anterior) { anterior.g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => { try { anterior.s.stop(); } catch { } }, 3000); }
  if (!nombre) { musicaActual = null; return; }
  const yo = { nombre, s: null, g: ctx.createGain() };
  musicaActual = yo;
  fetch(`base/assets/musica/${nombre}.mp3`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => {
    if (musicaActual !== yo) return; // llegó tarde: ya se quiere otra
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    yo.g.gain.value = 0; yo.g.gain.setTargetAtTime(volumen, ctx.currentTime, 0.8);
    s.connect(yo.g).connect(ctx.destination); s.start(); yo.s = s;
  }).catch(() => { });
}

// ---------- letra ----------
export async function letraLista() {
  try { await document.fonts.load('48px Caprasimo'); } catch { /* sin letra: cae a serif */ }
}
