# Prepara los decorados del XR a partir de las capas de la serie (VOPPE SERIE/02_escenarios), en SOLO LECTURA.
#   python herramientas/preparar_escenarios.py
# Sale en assets/escenarios/:
#   fachada.webp  trozo de la fachada de Unaké (el hueco de la puerta con el interior morado), con borde roto
#   neon.webp     el neón «UNAKÉ» con su placa, de bordes suaves
#   puerta.webp   la hoja de la puerta (capa ya recortada de la serie)
#   dentro.webp   el interior de Unaké (sala en perspectiva de un punto: se proyecta en 3D, ver js/decorado.js)
#   sofa-pared.webp  la pared del rincón del sofá (va detrás de ti)
#   sofa.webp     el sofá de Unaké
import pathlib, random, sys
from PIL import Image, ImageDraw, ImageFilter

SERIE = pathlib.Path(__file__).resolve().parents[2] / 'VOPPE SERIE' / '02_escenarios'
SALIDA = pathlib.Path(__file__).resolve().parents[1] / 'assets' / 'escenarios'
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def borde_roto(w, h, margen=18, semilla=7, suave=2.2):
    """máscara con el contorno mordido, como un trozo de pared arrancado"""
    rnd = random.Random(semilla)
    pts = []
    paso = 22
    for x in range(0, w + 1, paso): pts.append((x, rnd.uniform(0, margen)))
    for y in range(0, h + 1, paso): pts.append((w - rnd.uniform(0, margen), y))
    for x in range(w, -1, -paso): pts.append((x, h - rnd.uniform(0, margen * 0.3)))  # abajo casi recto: toca el suelo
    for y in range(h, -1, -paso): pts.append((rnd.uniform(0, margen), y))
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.filter(ImageFilter.GaussianBlur(suave))


def bordes_suaves(w, h, r=26):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((r // 2, r // 2, w - r // 2, h - r // 2), radius=r, fill=255)
    return m.filter(ImageFilter.GaussianBlur(r / 3))


def guardar(im, nombre, calidad=86):
    SALIDA.mkdir(parents=True, exist_ok=True)
    im.save(SALIDA / nombre, 'WEBP', quality=calidad, method=4)
    print(f'  {nombre}: {im.size}')


def main():
    fuera = Image.open(SERIE / 'unake-fuera' / 'capas' / 'fondo.png').convert('RGBA')
    # fachada: hueco de la puerta (x 607-767, y 300-706 en el fondo de 1024) con marco y ladrillos
    fx0, fy0, fx1, fy1 = 556, 262, 818, 716
    fach = fuera.crop((fx0, fy0, fx1, fy1))
    fach.putalpha(borde_roto(*fach.size))
    guardar(fach, 'fachada.webp')
    neon = fuera.crop((528, 42, 918, 252))
    neon.putalpha(bordes_suaves(*neon.size))
    guardar(neon, 'neon.webp')
    guardar(Image.open(SERIE / 'unake-fuera' / 'capas' / 'puerta.png').convert('RGBA'), 'puerta.webp')

    dentro = Image.open(SERIE / 'unake-dentro' / 'capas' / 'fondo.png').convert('RGB')
    guardar(dentro, 'dentro.webp', 88)

    sofa_fondo = Image.open(SERIE / 'unake-sofa' / 'capas' / 'fondo.png').convert('RGB')
    guardar(sofa_fondo.crop((220, 0, 1157, 545)), 'sofa-pared.webp', 86)
    guardar(Image.open(SERIE / 'unake-sofa' / 'capas' / 'sofa.png').convert('RGBA'), 'sofa.webp')
    # posiciones de la fachada, para el código
    print(f'  (fachada: recorte {fx0},{fy0}-{fx1},{fy1}; hueco de la puerta x 607-767, y 300-706 en el fondo)')


if __name__ == '__main__':
    main()
