# Rejilla para medir fondos (punto de fuga, pared del fondo, línea del suelo) a ojo.
#   python herramientas/rejilla.py base/assets/img/bg-plaza.jpg [...]
# Sale en herramientas/pruebas/fotos/grid-<nombre>.jpg: líneas cada 50 px, número cada 100.
# Con --fuga x,y --pared x0,x1,y0,suelo dibuja además las medidas para comprobarlas.
import pathlib, sys
from PIL import Image, ImageDraw

SALIDA = pathlib.Path(__file__).resolve().parent / 'pruebas' / 'fotos'


def rejilla(ruta, fuga=None, pared=None):
    im = Image.open(ruta).convert('RGB')
    d = ImageDraw.Draw(im)
    W, H = im.size
    for x in range(0, W, 50):
        d.line([(x, 0), (x, H)], fill=(0, 255, 255) if x % 100 == 0 else (0, 120, 140), width=1)
        if x % 100 == 0: d.text((x + 2, 2), str(x), fill=(0, 255, 255))
    for y in range(0, H, 50):
        d.line([(0, y), (W, y)], fill=(255, 255, 0) if y % 100 == 0 else (140, 140, 0), width=1)
        if y % 100 == 0: d.text((2, y + 2), str(y), fill=(255, 255, 0))
    if fuga:
        vx, vy = fuga
        d.ellipse([vx - 6, vy - 6, vx + 6, vy + 6], outline=(255, 0, 0), width=3)
        if pared:
            x0, x1, y0, s = pared
            d.rectangle([x0, y0, x1, s], outline=(255, 0, 80), width=3)
            for (px, py) in [(x0, y0), (x1, y0), (x0, s), (x1, s)]:
                # rayo desde la fuga por la esquina hasta el borde de la imagen
                dx, dy = px - vx, py - vy
                k = max(W, H) * 3 / max(1e-3, (dx * dx + dy * dy) ** 0.5)
                d.line([(vx, vy), (vx + dx * k, vy + dy * k)], fill=(255, 60, 60), width=2)
    nombre = pathlib.Path(ruta).stem
    SALIDA.mkdir(parents=True, exist_ok=True)
    im.save(SALIDA / f'grid-{nombre}.jpg', quality=82)
    print(SALIDA / f'grid-{nombre}.jpg', im.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    fuga = pared = None
    if '--fuga' in a:
        i = a.index('--fuga'); fuga = tuple(map(float, a[i + 1].split(','))); del a[i:i + 2]
    if '--pared' in a:
        i = a.index('--pared'); pared = tuple(map(float, a[i + 1].split(','))); del a[i:i + 2]
    for r in a: rejilla(r, fuga, pared)
