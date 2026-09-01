#!/usr/bin/env python3
"""
Assembles the icon and splash set @capacitor/assets expects, from the plates
exported out of Figma.

Android app icons do not follow the system theme, so exactly one adaptive icon
ships: the dark plate, whose deep red reads on any wallpaper. The light plate is
not wasted -- it becomes the light splash.

Sizing is the part worth knowing. An adaptive icon is a 108dp canvas but only
the central 72dp survives the launcher's mask; the outer 18dp per side is for
masking and parallax. On a 1024px plate that is a circle of radius 341px. The
mark reaches its own bounding-box corners, so the square has to fit inside that
circle: the exported foregrounds use a 454px bbox (285px padding), which reaches
318px and loses nothing. The original full-bleed square reached 482px and lost
30.6% of the mark on a circular launcher.

Run:  python3 scripts/build-app-assets.py && npx capacitor-assets generate --android
"""
from PIL import Image
import numpy as np
import math

N, S = 1024, 2732
SAFE_R = N * 72 / 108 / 2

# Plates exported from Figma. Foregrounds are the mark on transparency at the
# padding computed above; backgrounds are the same ground with the mark hidden.
FG_DARK  = 'assets/icon-foreground-dark.png'
FG_LIGHT = 'assets/icon-foreground-light.png'
BG_DARK  = 'assets/icon-background-dark.png'
BG_LIGHT = 'assets/icon-background-light.png'
ONLY_DARK = 'assets/icon-only-dark.png'


def check_fits(path):
    a = np.asarray(Image.open(path).convert('RGBA'), dtype=np.float32)
    ys, xs = np.nonzero(a[..., 3] > 128)
    reach = np.hypot(xs - N / 2, ys - N / 2).max()
    if reach > SAFE_R:
        raise SystemExit(
            f'{path}: mark reaches {reach:.0f}px, past the {SAFE_R:.0f}px adaptive '
            f'safe radius — it would be clipped on a circular launcher.')
    return reach


def splash(fg_path, bg_rgb, out, mark_px=620):
    """Mark centred small on a flat ground. Capacitor scales this per density."""
    fg = Image.open(fg_path).convert('RGBA')
    # Crop to the mark itself so the splash controls its own size, independent of
    # the padding the icon foreground needs.
    fg = fg.crop(fg.getbbox()).resize((mark_px, mark_px), Image.LANCZOS)
    canvas = Image.new('RGB', (S, S), bg_rgb)
    canvas.paste(fg, ((S - mark_px) // 2, (S - mark_px) // 2), fg)
    canvas.save(out)


def splash_icon(out, plate=1152):
    """The Android 12+ splash icon: the app's own badge, not a bare glyph.

    The icon layer may be full colour -- only windowSplashScreenBackground is
    restricted to a single flat colour, which is the one real limitation here.
    So this draws the launcher icon's gradient full-bleed and lets the system's
    circular mask cut it into the same badge that sits on the home screen. The
    app then appears to open out of its own icon.

    Two geometries to respect, and they are different:

      - The system masks to a CIRCLE of the inner 192dp of a 288dp canvas, so
        192/288 is a diameter, not the width a square mark may occupy. A mark
        sized by width has corners at 136dp against a 96dp radius and loses
        them; sizing by the diagonal keeps the whole mark inside.
      - The gradient is deliberately NOT inset: it fills the plate so the mask
        crops it rather than revealing an edge inside the circle.

    Resolution: at 450dpi that canvas is 810px, so the 192px launcher plate was
    being upscaled 4.2x. 1152px covers every density to 640dpi.
    """
    ground = Image.open(BG_DARK).convert('RGBA').resize((plate, plate), Image.LANCZOS)
    fg = Image.open(FG_DARK).convert('RGBA')
    mark = fg.crop(fg.getbbox())
    # 0.95 keeps the strokes off the mask edge rather than tangent to it.
    side = int(plate * (192 / 288) / math.sqrt(2) * 0.95)
    mark = mark.resize((side, side), Image.LANCZOS)
    ground.paste(mark, ((plate - side) // 2, (plate - side) // 2), mark)
    ground.save(out)
    return plate, side


def main():
    for p in (FG_DARK, FG_LIGHT):
        print(f'  {p}: mark reaches {check_fits(p):.0f}px of {SAFE_R:.0f}px safe — fits')

    # The adaptive pair, and the flat square for legacy launchers and Play.
    Image.open(FG_DARK).convert('RGBA').save('assets/icon-foreground.png')
    Image.open(BG_DARK).convert('RGB').save('assets/icon-background.png')
    Image.open(ONLY_DARK).convert('RGB').save('assets/icon-only.png')

    # Android 13 themed icons: the system tints the shape, so ship white-on-clear.
    Image.open(FG_DARK).convert('RGBA').save('assets/icon-foreground-monochrome.png')

    # The splash icon is drawn straight into res/ rather than through
    # capacitor-assets, which only knows about launcher densities.
    # The splash icon itself is a vector now, built by build-splash-vector.py
    # from the SVG so it can animate. This raster plate is kept only as a
    # reference render of the same geometry.
    plate, side = splash_icon('assets/splash-icon-reference.png')
    print(f'  splash-icon-reference.png  {plate}x{plate}, mark {side}px '
          f'({100*side/plate:.0f}% of the canvas)')

    # Splashes match the app's own page colours, not the icon's gradient, so the
    # launch does not flash a colour the first screen never uses.
    splash(FG_LIGHT, (247, 244, 241), 'assets/splash.png')
    splash(FG_DARK,  (18, 18, 18),    'assets/splash-dark.png')

    for f in ('icon-only', 'icon-foreground', 'icon-background',
              'icon-foreground-monochrome', 'splash', 'splash-dark'):
        im = Image.open(f'assets/{f}.png')
        print(f'  assets/{f}.png  {im.size[0]}x{im.size[1]}  {im.mode}')


if __name__ == '__main__':
    main()
