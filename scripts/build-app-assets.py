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


def main():
    for p in (FG_DARK, FG_LIGHT):
        print(f'  {p}: mark reaches {check_fits(p):.0f}px of {SAFE_R:.0f}px safe — fits')

    # The adaptive pair, and the flat square for legacy launchers and Play.
    Image.open(FG_DARK).convert('RGBA').save('assets/icon-foreground.png')
    Image.open(BG_DARK).convert('RGB').save('assets/icon-background.png')
    Image.open(ONLY_DARK).convert('RGB').save('assets/icon-only.png')

    # Android 13 themed icons: the system tints the shape, so ship white-on-clear.
    Image.open(FG_DARK).convert('RGBA').save('assets/icon-foreground-monochrome.png')

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
