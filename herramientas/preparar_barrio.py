# Prepara el arte del barrio en XR (js/barrio/): fondos de las salas, piezas recortadas y miniaturas de la maqueta.
#   python herramientas/preparar_barrio.py
# Lee en SOLO LECTURA:
#   base/assets/img/bg-*.jpg (humo) y bgn-*.jpg (día)   → assets/escenarios/barrio/fondos/<nombre>.webp
#   VOPPE SERIE/02_escenarios/<escenario>/capas/          → assets/escenarios/barrio/capas/<escenario>-<pieza>.webp
# y saca las miniaturas de la maqueta (512 px de ancho) en assets/escenarios/barrio/mini/<nombre>.webp.
# Las medidas de cada sala (punto de fuga, pared del fondo…) viven en js/barrio/salas.js; se sacaron con
# herramientas/rejilla.py.
import pathlib, sys
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SERIE = RAIZ.parent / 'VOPPE SERIE' / '02_escenarios'
IMG = RAIZ / 'base' / 'assets' / 'img'
SALIDA = RAIZ / 'assets' / 'escenarios' / 'barrio'
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

FONDOS = ['bg-cuarto', 'bgn-cuarto', 'bg-plaza', 'bgn-plaza', 'bg-fuera', 'bgn-fuera', 'bg-tienda', 'bgn-tienda',
          'bg-dentro', 'bgn-dentro', 'bg-cocina', 'bgn-cocina', 'bg-sofa', 'bgn-sofa', 'bg-bano', 'bgn-bano',
          'bg-techo', 'bg-feria', 'bgn-feria']
# fondos limpios (sin muebles) de la serie: los muebles van aparte, de cartón
CAPAS = {
    'plaza-banco': ['fondo', 'banco', 'farola', 'contenedor'],
    'unake-cocina': ['fondo', 'encimera', 'sofa-izq', 'sofa-der', 'taburete'],
    'unake-dentro': ['barra', 'taburete-1', 'taburete-2', 'taburete-3', 'taburete-4', 'taburete-5', 'taburete-6',
                     'taburete-7', 'mesa', 'mesa-2', 'sofa', 'sofa-2'],
    'unake-sofa': ['fondo'],
}


def guardar(im, ruta, calidad):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    im.save(ruta, 'WEBP', quality=calidad, method=5)
    print(f'  {ruta.relative_to(RAIZ)}: {im.size} {ruta.stat().st_size // 1024} KB')


def main():
    for n in FONDOS:
        im = Image.open(IMG / f'{n}.jpg').convert('RGB')
        guardar(im, SALIDA / 'fondos' / f'{n}.webp', 84)
        mini = im.resize((512, round(512 * im.height / im.width)), Image.LANCZOS)
        guardar(mini, SALIDA / 'mini' / f'{n}.webp', 80)
    for esc, piezas in CAPAS.items():
        for p in piezas:
            im = Image.open(SERIE / esc / 'capas' / f'{p}.png')
            if p == 'fondo':
                im = im.convert('RGB')
                guardar(im, SALIDA / 'capas' / f'{esc}-fondo.webp', 86)
                mini = im.resize((512, round(512 * im.height / im.width)), Image.LANCZOS)
                guardar(mini, SALIDA / 'mini' / f'{esc}-fondo.webp', 80)
            else:
                im = im.convert('RGBA')
                caja = im.getbbox()  # quita el aire transparente (las medidas de capas.json son del dibujo entero)
                if caja and caja != (0, 0, *im.size):
                    print(f'    ({esc}/{p}: el dibujo ocupa {caja} de {im.size}; se deja entero para no mover el ancla)')
                guardar(im, SALIDA / 'capas' / f'{esc}-{p}.webp', 88)


if __name__ == '__main__':
    main()
