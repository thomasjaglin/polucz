#!/usr/bin/env python3
"""
Bundles the app's two typefaces so it stops fetching them from Google at launch.

Loading them remotely cost three things at once: Google saw every user's IP on
every cold start, before they had configured anything; the typeface fell back
offline; and Material Symbols is a LIGATURE font, so without it every icon
rendered as its own name -- a literal "delete" where the bin should be.

Instrument Sans is small enough to ship whole (41KB for latin + latin-ext, and
latin-ext is not optional here: it carries ą ć ę ł ń ó ś ź ż).

Material Symbols Rounded is 5.35MB, which is not shippable, so it is cut down
twice. First the variable axes are pinned -- nothing in the app varies opsz,
wght, FILL or GRAD, so they become fixed at the values the old stylesheet
requested. Then it is subset to only the icons the app actually names.

That subset is the risky part: an icon missed here renders as a word rather than
disappearing, which is worse than a blank. So the names are scraped from the
source rather than maintained by hand, and every one is verified present in the
output before the file is written.

Run:  npm run fonts
"""
import re, subprocess, sys, shutil
from pathlib import Path

SRC = Path('src')
OUT = Path('public/fonts')
SYMBOLS = Path('node_modules/material-symbols/material-symbols-rounded.woff2')
SANS = Path('node_modules/@fontsource-variable/instrument-sans/files')

# The stylesheet the app used to load asked for opsz 24, wght 400, FILL 0, GRAD 0.
AXES = {'opsz': 24, 'wght': 400, 'FILL': 0, 'GRAD': 0}

# Deliberately over-broad: every lowercase_snake token in the source, quoted or
# as bare JSX text. Matching on structure was tried and failed — icons are often
# an expression on the line AFTER the className, as in
#
#     <span className="material-symbols-rounded ...">
#       {searchOpen ? 'close' : 'search'}
#
# which no line-anchored pattern sees. That shipped a build where the search
# icon rendered as the word SEARCH, caught only by looking at the app offline.
#
# The font's own ligature list does the filtering instead, so a word that is not
# an icon costs nothing and an icon can only be missed if it is spelled at
# runtime, which nothing here does.
TOKEN = re.compile(r"['\"><}\s]([a-z][a-z_]{2,})['\"<{\s]")


def icon_names() -> set[str]:
    names: set[str] = set()
    for f in SRC.rglob('*.ts*'):
        if f.name.endswith('.test.ts'):
            continue
        names.update(TOKEN.findall(f.read_text(encoding='utf8')))
    return names


def ligature_map(path: Path) -> dict[str, tuple[str, list[str]]]:
    """Ligature text -> (its glyph, the component glyphs it is built from)."""
    from fontTools.ttLib import TTFont
    font = TTFont(path)
    cmap = font.getBestCmap() or {}
    rev = {g: c for c, g in cmap.items()}
    out: dict[str, tuple[str, list[str]]] = {}
    gsub = font.get('GSUB')
    if gsub is None:
        return out
    for lookup in gsub.table.LookupList.Lookup:
        for sub in lookup.SubTable:
            # Material Symbols wraps its ligature lookup in an extension
            # subtable (LookupType 7), so the real one is a level down.
            sub = getattr(sub, 'ExtSubTable', sub)
            for first, ligs in getattr(sub, 'ligatures', {}).items():
                for lig in ligs:
                    seq = [first] + list(lig.Component)
                    try:
                        out[''.join(chr(rev[g]) for g in seq)] = (lig.LigGlyph, seq)
                    except KeyError:
                        pass
    return out


def main():
    if not SYMBOLS.exists() or not SANS.exists():
        sys.exit('Fonts are not installed. Run npm install first.')
    OUT.mkdir(parents=True, exist_ok=True)

    wanted = icon_names()
    available = ligature_map(SYMBOLS)
    # Names scraped from source that the font has never heard of are almost
    # always a false positive from the `icon:` pattern, not a missing glyph.
    real = sorted(wanted & available.keys())
    ignored = sorted(wanted - available.keys())
    # Most of `wanted` is ordinary English from comments and identifiers; the
    # font's ligature list is what separates icons from prose, so the rejects
    # are counted rather than listed.
    print(f'tokens scanned : {len(wanted)}')
    print(f'  icons kept   : {len(real)}  (the rest, {len(ignored)}, are not symbol names)')

    tmp = OUT / '_pinned.woff2'
    subprocess.run([sys.executable, '-m', 'fontTools.varLib.instancer',
                    str(SYMBOLS), *[f'{k}={v}' for k, v in AXES.items()],
                    '-o', str(tmp)], check=True, capture_output=True)

    # Subsetting by TEXT keeps 3555 glyphs, not 44: the layout closure follows
    # every ligature reachable from the letters in those names, which is nearly
    # the whole icon set. Naming the glyphs and switching the closure off is what
    # actually cuts it down.
    keep: set[str] = set()
    for name in real:
        lig_glyph, components = available[name]
        keep.add(lig_glyph)
        keep.update(components)

    dest = OUT / 'material-symbols-rounded-subset.woff2'
    subprocess.run([sys.executable, '-m', 'fontTools.subset', str(tmp),
                    f'--glyphs={" ".join(sorted(keep))}',
                    '--layout-features+=liga',
                    '--no-layout-closure',
                    '--flavor=woff2', f'--output-file={dest}'], check=True, capture_output=True)
    tmp.unlink()

    # An icon that silently vanished here would ship as a word on screen.
    survived = ligature_map(dest)
    missing = [n for n in real if n not in survived]
    if missing:
        dest.unlink()
        sys.exit(f'Subset dropped {len(missing)} icons: {", ".join(missing)}')

    manifest = Path('src/data/bundledIcons.ts')
    manifest.write_text(
        '// Generated by scripts/build-fonts.py (npm run fonts). Do not edit.\n'
        '// The icons present in the subset font. iconFont.test.ts fails if the\n'
        '// source names one that is not here, which means the font needs rebuilding.\n'
        'export const BUNDLED_ICONS = new Set([\n'
        + ''.join(f"  '{n}',\n" for n in real)
        + '])\n', encoding='utf8')

    for name in ('instrument-sans-latin-wght-normal.woff2',
                 'instrument-sans-latin-ext-wght-normal.woff2'):
        shutil.copy(SANS / name, OUT / name)

    print()
    for f in sorted(OUT.glob('*.woff2')):
        print(f'  {f}  {f.stat().st_size / 1024:.0f}KB')
    print(f'\nicon font: {SYMBOLS.stat().st_size / 1024 / 1024:.2f}MB -> '
          f'{dest.stat().st_size / 1024:.0f}KB, all {len(real)} icons verified present')


if __name__ == '__main__':
    main()
