// El cine: escenas de la serie entre misiones. Son cortes del piloto «¿Una qué?» (v3), hechos con
// `herramientas/preparar_cine.py`, que se ven a pantalla completa por encima del juego.
// Algunos cortes se paran en un punto y te dejan la mano: una sola acción, sencilla, que hace Vuper
// (preguntar, leer rápido, quedarse quieto, dar la calada). Si fallas no pasa nada: la escena sigue,
// porque en el piloto a Vuper tampoco le sale.
//
// Uso:  Cine.ver(scene, ['puerta', 'palicaso'], () => { ...al acabar... })
// Si el vídeo no se puede ver (bots de prueba, opción apagada, archivo que falta), se salta y sigue.

// Pausas: `t` en segundos desde el inicio del corte.
//   pulsa   · un botón con la frase de Vuper
//   machaca · pulsar `n` veces antes de `ms`
//   quieto  · no tocar nada durante `ms`
//   manten  · mantener pulsado durante `ms`
// REGLA DEL USUARIO (16/11/2026): nunca más de 2 minutos de vídeo seguidos y solo hechos importantes.
const CINE = {
  // Entrada en frío (1:58 en total, con cuatro pausas).
  puerta: { titulo: 'La puerta', pausas: [{ t: 20.2, tipo: 'pulsa', texto: '«¿Una… aso?»', pista: 'Léelo de la mano' }] },
  palotes: { pausas: [{ t: 0.7, tipo: 'pulsa', texto: '«¿De quién es la aso?»' }] },
  puky: {
    pausas: [
      { t: 7.1, tipo: 'pulsa', texto: '«…¿de quién es la aso?»', flojo: 0.7 },
      { t: 15.1, tipo: 'machaca', texto: '¡HUYE!', pista: 'Pulsa rápido', n: 40, ms: 2200, bien: 'Casi.', mal: 'Siempre llega.', imposible: true },
    ],
  },
  despertar: {},
  // «Esto ya lo has vivido»: la primera vez que hablas con cada uno dentro de Unaké (Vuper ha estado aquí cientos de noches).
  palicaso: { titulo: 'Esto ya lo has vivido', pausas: [{ t: 5.2, tipo: 'pulsa', texto: '«¿De quién?»' }] },
  lasslow: { titulo: 'Esto ya lo has vivido' },
  cotine: { titulo: 'Esto ya lo has vivido', pausas: [{ t: 5.2, tipo: 'machaca', texto: '¡LEE!', pista: 'Lee la tarta antes de que se la coma: pulsa rápido', n: 12, ms: 3200, bien: '«De… los…»', mal: '«De…»' }] },
  pompa: { titulo: 'Esto ya lo has vivido', pausas: [{ t: 2.5, tipo: 'quieto', texto: 'No toques nada', pista: 'Aquí se está bien. Quédate quieto.', ms: 3200, bien: 'Qué paz.', mal: 'La has movido.' }] },
  // El día, entre misiones.
  rider: { titulo: 'El día de un rider' },
  tienda: { titulo: 'En la cola de la tienda' },
  plaza: { titulo: 'El último pedido', pausas: [{ t: 19.4, tipo: 'manten', texto: 'MANTÉN PULSADO', pista: 'Dale una calada', ms: 2200 }] },
  puerta2: {},
  poscreditos: { titulo: 'Esa misma noche, en la puerta' },
};
const CINE_FRIO = ['puerta', 'palotes', 'puky', 'despertar'];
// Quién tiene recuerdo: se ve una sola vez, al hablarle por primera vez de noche y ya dentro de la aso.
const CINE_RECUERDO = { palicaso: 'palicaso', lasslow: 'lasslow', cotine: 'cotine', pompa: 'pompa' };

const Cine = {
  activo: false,

  disponible() {
    if (window.CINE_FORZAR) return true;
    if (navigator.webdriver) return false; // los bots de prueba no ven vídeo
    const o = (typeof ESTADO !== 'undefined' && ESTADO.opciones) || {};
    return o.cine !== false && !!document.createElement('video').canPlayType;
  },

  visto(id) { return !!(ESTADO.cineVisto && ESTADO.cineVisto[id]); },

  // El recuerdo de un personaje, si toca. Devuelve true si lo ha puesto (y llama a `despues` al acabar).
  recuerdo(scene, quien, despues) {
    const id = CINE_RECUERDO[quien];
    if (!id || this.visto(id) || !ESTADO.dentro || scene.mundo !== 'humo' || !this.disponible() || this.activo) return false;
    this.ver(scene, id, despues);
    return true;
  },

  estilos() {
    if (document.getElementById('cine-css')) return;
    const css = document.createElement('style');
    css.id = 'cine-css';
    css.textContent = `
      #cine { position: fixed; inset: 0; z-index: 20; background: #000; display: flex; align-items: center; justify-content: center;
        font-family: 'Caprasimo', serif; -webkit-user-select: none; user-select: none; touch-action: none; }
      #cine video { width: 100%; height: 100%; object-fit: contain; background: #000; }
      #cine .saltar { position: absolute; top: max(14px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right)); padding: 8px 18px;
        font: inherit; font-size: clamp(14px, 2.2vh, 20px); color: #fff6e8; background: rgba(27,16,40,.72); border: 3px solid #fff6e8; border-radius: 16px; cursor: pointer; opacity: .75; }
      #cine .saltar:hover { opacity: 1; }
      #cine .titulo { position: absolute; left: 0; right: 0; bottom: 9%; text-align: center; color: #fff6e8; font-size: clamp(20px, 4.4vh, 40px);
        text-shadow: 0 3px 0 #1b1028, 0 0 18px #1b1028; pointer-events: none; opacity: 0; transition: opacity .5s; }
      #cine .titulo.ver { opacity: 1; }
      #cine .mano { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: flex-end; gap: 1.6vh;
        padding-bottom: 7vh; background: radial-gradient(ellipse at 50% 120%, rgba(27,16,40,.82), rgba(27,16,40,0) 62%); }
      #cine .mano.ver { display: flex; }
      #cine .pista { color: #fff6e8; font-size: clamp(15px, 2.8vh, 24px); text-shadow: 0 2px 0 #1b1028; }
      #cine .accion { font: inherit; font-size: clamp(20px, 4.6vh, 40px); color: #1b1028; background: #ffd23f; border: 5px solid #1b1028; border-radius: 22px;
        padding: 1.6vh 4vh; box-shadow: 0 7px 0 #1b1028; cursor: pointer; animation: cine-late .7s ease-in-out infinite alternate; max-width: 86vw; }
      #cine .accion:active { transform: translateY(5px); box-shadow: 0 2px 0 #1b1028; }
      #cine .barra { width: min(52vw, 520px); height: 2.4vh; border: 4px solid #fff6e8; border-radius: 14px; background: #1b1028; overflow: hidden; }
      #cine .barra i { display: block; height: 100%; width: 0; background: #ff7a2f; }
      #cine .remate { position: absolute; left: 0; right: 0; top: 38%; text-align: center; color: #ffd23f; font-size: clamp(28px, 7vh, 64px);
        text-shadow: 0 4px 0 #1b1028; pointer-events: none; opacity: 0; transform: scale(.6) rotate(-4deg); transition: opacity .15s, transform .25s; }
      #cine .remate.ver { opacity: 1; transform: scale(1) rotate(-3deg); }
      #cine .tocar { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.6); }
      #cine .tocar.ver { display: flex; }
      @keyframes cine-late { from { transform: scale(1); } to { transform: scale(1.05); } }
    `;
    document.head.appendChild(css);
  },

  // Ve una lista de cortes seguidos y avisa al acabar. `opc.sinSaltar`: no enseña el botón (no se usa de momento).
  ver(scene, ids, alAcabar, opc = {}) {
    ids = (Array.isArray(ids) ? ids : [ids]).filter(id => CINE[id]);
    const acabar = () => { if (alAcabar) alAcabar(); };
    if (!ids.length || !this.disponible() || this.activo) {
      ESTADO.cineVisto = ESTADO.cineVisto || {};
      ids.forEach(id => { ESTADO.cineVisto[id] = true; });
      return acabar();
    }
    this.activo = true;
    this.estilos();
    if (typeof Musica !== 'undefined') Musica.silencio();
    const pausada = scene && scene.sys && scene.sys.isActive() && !opc.sinPausar;
    if (pausada) scene.scene.pause();
    const tecladoAntes = scene && scene.input && scene.input.keyboard ? scene.input.keyboard.enabled : null;
    if (tecladoAntes !== null) scene.input.keyboard.enabled = false;

    const caja = document.createElement('div');
    caja.id = 'cine';
    caja.innerHTML = `<video playsinline preload="auto"></video>
      <div class="titulo"></div>
      <div class="mano"><div class="pista"></div><button class="accion"></button><div class="barra"><i></i></div></div>
      <div class="remate"></div>
      <div class="tocar"><button class="accion">Toca para ver</button></div>
      <button class="saltar">Saltar</button>`;
    document.body.appendChild(caja);
    const v = caja.querySelector('video');
    const q = sel => caja.querySelector(sel);
    const mano = q('.mano'), pista = q('.pista'), accion = q('.mano .accion'), barra = q('.barra'), relleno = q('.barra i');
    const remate = q('.remate'), titulo = q('.titulo'), tocar = q('.tocar');
    v.volume = Math.min(1, (typeof volumenMusica === 'function' ? volumenMusica() : 0.6) + 0.3);

    let i = -1, pausas = [], enMano = null, cuadro = 0, cerrado = false, relojes = [];
    const tras = (ms, fn) => { const r = setTimeout(fn, ms); relojes.push(r); return r; };
    const limpiarMano = () => { if (enMano && enMano.fin) enMano.fin(); enMano = null; mano.classList.remove('ver'); };

    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      cancelAnimationFrame(cuadro);
      relojes.forEach(clearTimeout);
      limpiarMano();
      window.removeEventListener('keydown', tecla, true);
      window.removeEventListener('keyup', teclaArriba, true);
      v.pause();
      v.removeAttribute('src');
      v.load();
      caja.remove();
      this.activo = false;
      if (tecladoAntes !== null && scene.input && scene.input.keyboard) scene.input.keyboard.enabled = tecladoAntes;
      if (pausada && scene.sys && scene.sys.isPaused()) scene.scene.resume();
      guardarPartida();
      acabar();
    };

    const siguiente = () => {
      limpiarMano();
      if (i >= 0) { ESTADO.cineVisto = ESTADO.cineVisto || {}; ESTADO.cineVisto[ids[i]] = true; }
      i += 1;
      if (i >= ids.length) return cerrar();
      const c = CINE[ids[i]];
      pausas = (c.pausas || []).map(p => ({ ...p }));
      v.src = `assets/cine/${ids[i]}.mp4`;
      titulo.textContent = c.titulo || '';
      titulo.classList.toggle('ver', !!c.titulo);
      if (c.titulo) tras(2600, () => titulo.classList.remove('ver'));
      const p = v.play();
      if (p && p.catch) p.catch(() => { tocar.classList.add('ver'); });
    };

    const premio = (n, frase) => {
      if (n) { ESTADO.monchis = (ESTADO.monchis || 0) + n; }
      remate.textContent = frase ? (n ? `${frase}  +${n}` : frase) : (n ? `+${n} monchis` : '');
      if (!remate.textContent) return;
      remate.classList.add('ver');
      tras(1100, () => remate.classList.remove('ver'));
    };

    // Deja la mano al jugador en una pausa. Al resolverla, el vídeo sigue.
    const abrirMano = p => {
      v.pause();
      const seguir = (bien) => {
        limpiarMano();
        if (p.tipo !== 'pulsa') premio(bien ? 5 : 0, bien ? p.bien : p.mal);
        const r = v.play();
        if (r && r.catch) r.catch(() => {});
      };
      pista.textContent = p.pista || '';
      pista.style.display = p.pista ? '' : 'none';
      accion.textContent = p.texto;
      accion.style.transform = '';
      accion.style.fontSize = p.flojo ? `calc(clamp(20px, 4.6vh, 40px) * ${p.flojo})` : '';
      accion.style.opacity = p.flojo ? String(0.55 + p.flojo * 0.45) : '';
      barra.style.display = p.tipo === 'pulsa' ? 'none' : '';
      relleno.style.width = '0';
      mano.classList.add('ver');
      const ini = performance.now();
      if (p.tipo === 'pulsa') {
        enMano = { pulsa: () => seguir(true) };
      } else if (p.tipo === 'machaca') {
        let n = 0;
        const reloj = setInterval(() => {
          const queda = 1 - (performance.now() - ini) / p.ms;
          barra.style.opacity = String(Math.max(0.25, queda));
          if (queda <= 0) seguir(false);
        }, 60);
        enMano = {
          pulsa: () => {
            n += 1;
            relleno.style.width = `${Math.min(100, n / p.n * 100)}%`;
            if (n >= p.n && !p.imposible) seguir(true);
          },
          fin: () => clearInterval(reloj),
        };
      } else if (p.tipo === 'quieto') {
        let movida = false;
        accion.style.animation = 'none';
        const reloj = setInterval(() => {
          const k = (performance.now() - ini) / p.ms;
          relleno.style.width = `${Math.min(100, k * 100)}%`;
          if (k >= 1) seguir(!movida);
        }, 60);
        enMano = {
          pulsa: () => { movida = true; relleno.style.background = '#ff5d8f'; accion.textContent = '…'; },
          fin: () => { clearInterval(reloj); accion.style.animation = ''; relleno.style.background = ''; },
        };
      } else if (p.tipo === 'manten') {
        let carga = 0, pulsando = false, antes = performance.now();
        const reloj = setInterval(() => {
          const ahora = performance.now(), dt = ahora - antes;
          antes = ahora;
          carga = Math.max(0, Math.min(p.ms, carga + (pulsando ? dt : -dt * 1.5)));
          relleno.style.width = `${carga / p.ms * 100}%`;
          if (carga >= p.ms) seguir(true);
        }, 40);
        enMano = { abajo: () => { pulsando = true; }, arriba: () => { pulsando = false; }, fin: () => clearInterval(reloj) };
      }
    };

    const vigilar = () => {
      if (cerrado) return;
      if (!enMano && pausas.length && !v.paused && v.currentTime >= pausas[0].t) abrirMano(pausas.shift());
      cuadro = requestAnimationFrame(vigilar);
    };

    const abajo = () => { if (!enMano) return; if (enMano.abajo) enMano.abajo(); else if (enMano.pulsa) enMano.pulsa(); };
    const arriba = () => { if (enMano && enMano.arriba) enMano.arriba(); };
    const esAccion = e => e.code === 'Space' || e.code === 'Enter';
    const tecla = e => {
      if (esAccion(e)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) abajo(); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); siguiente(); }
    };
    const teclaArriba = e => { if (esAccion(e)) { e.preventDefault(); e.stopPropagation(); arriba(); } };
    window.addEventListener('keydown', tecla, true);
    window.addEventListener('keyup', teclaArriba, true);
    // En «quieto» cuenta cualquier toque en la pantalla; en lo demás, el botón (o la pantalla entera al mantener).
    caja.addEventListener('pointerdown', e => {
      if (e.target.closest('.saltar') || e.target.closest('.tocar')) return;
      if (!enMano) return;
      if (enMano.abajo || e.target === accion || accion.textContent === '…' || (enMano.pulsa && barra.style.display !== 'none')) abajo();
    });
    caja.addEventListener('pointerup', arriba);
    caja.addEventListener('pointercancel', arriba);
    q('.saltar').addEventListener('click', e => { e.stopPropagation(); siguiente(); });
    q('.tocar .accion').addEventListener('click', () => { tocar.classList.remove('ver'); const r = v.play(); if (r && r.catch) r.catch(() => siguiente()); });
    v.addEventListener('ended', siguiente);
    v.addEventListener('error', () => { if (!cerrado) siguiente(); });

    siguiente();
    cuadro = requestAnimationFrame(vigilar);
  },
};
