# Hornea los personajes de la serie en fotogramas para los recortables del XR.
# Usa el motor de la serie (VOPPE SERIE/motor/v1/rig.py) en SOLO LECTURA: no toca ningún original.
#
#   python herramientas/hornear_personajes.py                 -> todos
#   python herramientas/hornear_personajes.py lasslow perico  -> solo esos
#
# Por personaje y mundo (humo = criatura; normal = persona de día) sale:
#   assets/personajes/<id>/<mundo>/<fotograma>.webp  y  .../indice.json
# Fotogramas: cada cuerpo (pose) tal cual, y sobre la base: parpadeo y bocas de hablar.
# El índice guarda, en píxeles del fotograma, dónde cae el «asiento» (los pies / el apoyo),
# para que al cambiar de fotograma el recortable no salte.
import json, sys, pathlib

SERIE = pathlib.Path(__file__).resolve().parents[2] / 'VOPPE SERIE'
SALIDA = pathlib.Path(__file__).resolve().parents[1] / 'assets' / 'personajes'
sys.path.insert(0, str(SERIE / 'motor' / 'v1'))
sys.path.insert(0, str(SERIE))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from rig import Rig  # noqa: E402

TODOS = ['lasslow', 'blancaso', 'perico', 'la-pompa', 'palicaso', 'puky', 'vuper', 'cotine']
ALTO = 900  # píxeles de alto de la base: de cerca en las gafas sigue nítido
SOLO_INDICE = '--indices' in sys.argv  # rehace solo los indice.json (rápido)


def estado(r, body='base', **cambios):
    st = {'body': body, 'eyes_red': 0.0}
    for n, s in r.slots.items():
        st.update({n: s.default, n + '_dx': 0.0, n + '_dy': 0.0, n + '_rot': float(s.rot), n + '_scale': 1.0})
    st.update(cambios)
    return st


def hornear(carpeta, destino):
    r = Rig(carpeta, res=None)
    k = min(1.0, ALTO / r.h)
    r = Rig(carpeta, res=ALTO) if k < 1.0 else r
    destino.mkdir(parents=True, exist_ok=True)
    asiento = r.anchors['seat']
    fotos = {}

    def guardar(nombre, st):
        im, (x0, y0) = r.compose(st)
        if not SOLO_INDICE:
            im.save(destino / f'{nombre}.webp', 'WEBP', quality=88, method=4)
        fotos[nombre] = {'w': im.width, 'h': im.height, 'ax': round(asiento[0] - x0, 1), 'ay': round(asiento[1] - y0, 1)}

    guardar('base', estado(r))
    if r.blink:
        guardar('base-parpadeo', estado(r, eyes=r.blink))
    for clave, pieza in r.talk.items():
        guardar(f'base-boca-{clave}', estado(r, mouth=pieza))
    for body in r.bodies:
        if body != 'base':
            guardar(body, estado(r, body))
    boca = r.anchors.get('mouth')
    ojos = r.anchors.get('eyes')
    rel = lambda a: [round(a[0] - asiento[0], 1), round(a[1] - asiento[1], 1)] if a else None
    indice = {
        'nombre': r.name, 'alto_cuerpo_px': r.bh, 'altura_serie': r.height,
        'boca': rel(boca), 'ojos': rel(ojos),
        'habla': sorted(r.talk), 'parpadea': bool(r.blink), 'fotos': fotos,
    }
    (destino / 'indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=1), 'utf-8')
    return len(fotos)


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or TODOS
    for pid in ids:
        base = SERIE / '01_personajes' / pid
        for mundo, carpeta in (('humo', base), ('normal', base / 'normal')):
            if not (carpeta / 'rig.json').exists():
                print(f'  {pid}/{mundo}: sin rig.json, se salta')
                continue
            try:
                n = hornear(carpeta, SALIDA / pid / mundo)
                print(f'  {pid}/{mundo}: {n} fotogramas')
            except Exception as e:  # un personaje roto no para a los demás
                print(f'  {pid}/{mundo}: ERROR {e!r}')


if __name__ == '__main__':
    main()
