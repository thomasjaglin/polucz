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


def splash_icon(fg_path, out, plate=1152):
    """The Android 12+ splash icon, which is a different job from the launcher.

    That icon is drawn on a 288dp canvas and the system masks it to a CIRCLE of
    the inner 192dp. 192/288 is therefore the circle's diameter, not the width a
    square mark may occupy: a 192dp-wide square has corners at 136dp from centre
    against a 96dp radius, and they get cut. Sizing the mark by its diagonal
    instead puts the whole thing inside the circle.

    Resolution is the other half. At 450dpi the canvas is 810px, so feeding it
    the 192px launcher plate meant a 4.2x upscale. A density-independent 1152px
    plate covers every density up to 640dpi without upscaling.
    """
    fg = Image.open(fg_path).convert('RGBA')
    mark = fg.crop(fg.getbbox())
    # 0.95 keeps the strokes off the mask edge rather than tangent to it.
    side = int(plate * (192 / 288) / math.sqrt(2) * 0.95)
    mark = mark.resize((side, side), Image.LANCZOS)
    canvas = Image.new('RGBA', (plate, plate), (0, 0, 0, 0))
    canvas.paste(mark, ((plate - side) // 2, (plate - side) // 2), mark)
    canvas.save(out)
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
    # One per theme, and the pairing inverts: the light splash has a light
    # ground and therefore needs the DARK mark, and vice versa.
    import os
    for src, d in ((FG_LIGHT, 'drawable-nodpi'), (FG_DARK, 'drawable-night-nodpi')):
        os.makedirs(f'android/app/src/main/res/{d}', exist_ok=True)
        plate, side = splash_icon(src, f'android/app/src/main/res/{d}/splash_icon.png')
        print(f'  {d}/splash_icon.png  {plate}x{plate}, mark {side}px '
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
