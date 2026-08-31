# Polucz design system — for Figma Make

Everything here is lifted from the shipping app (`src/index.css`, `tailwind.config.js`,
`src/data/gradients.ts`). Values are exact, not approximations.

There is also a Figma library file with these as real variables and styles:
**Polucz — Design System** (`POkhybmyKyGBybXon2R5FM`) — Cover + Foundations pages.
Use that when working in Figma proper; use this document when prompting Figma Make,
which wants text.

---

## 1. The one idea

**Ink over a soft gradient, behind frosted glass.** Nothing in the app is a solid
panel on a flat background. Every surface is the theme's ink at 2–5% opacity with a
blur behind it, floating over a blurred multi-colour gradient. Get this wrong and it
stops looking like Polucz — a white card on a white page is the failure mode.

Three rules that carry the look:

1. **Surfaces are barely there.** 2–5% ink, not white, not grey.
2. **Corners are generous.** 36px on cards, fully round on controls. Nothing at 8px.
3. **Depth is a shadow *plus* a 1px inner ring.** The ring is what makes it read as glass.

---

## 2. Colour

Ink and accent are stored as raw RGB channels so opacity modifiers work through them.

### Light theme
```css
--page-bg:    #F7F4F1;   /* warm off-white; pure white reads clinical under glass */
--ink-rgb:    15 23 42;  /* slate-900 */
--accent-rgb: 76 43 184; /* deep violet — the light-theme accent must go deep */
--surface-rgb: 255 255 255;
--ok:  #15803D;   --err: #B91C1C;   --aspect: #A21CAF;
--veil-header: rgba(255,255,255,0.50);
--veil-modal:  rgba(247,244,241,0.65);
```

### Dark theme
```css
--page-bg:    #121212;
--ink-rgb:    248 250 252;  /* slate-50 */
--accent-rgb: 180 160 255;  /* #B4A0FF lavender */
--surface-rgb: 26 26 26;
--ok:  #86EFAC;   --err: #F87171;   --aspect: #E879F9;
--veil-header: rgba(0,0,0,0.25);
--veil-modal:  rgba(0,0,0,0.40);
```

### Text tone — the part that is easy to get wrong

The light theme reaches WCAG AA (4.5:1) at **55% ink and no lower**. Not even pure
black would; it tops out at 3.9:1 at 50%. So the two themes use *different alphas for
the same tier*:

| Tier | Light | Dark | Use for |
|---|---|---|---|
| Primary | `ink / 100%` | `ink / 100%` | Headlines, the Polish word |
| Secondary | `ink / 70%` | `ink / 70%` | Body, supporting copy |
| Tertiary | `ink / 62%` | `ink / 55%` | Captions, counts, attribution |
| Glyph *(non-text only)* | `ink / 50%` | `ink / 35%` | Separators, rules, decorative icons |

Never put words below the tertiary tier.

---

## 3. Type

**Instrument Sans** throughout. Weights: Regular 400, Medium 500, SemiBold 600.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Display L | 24 | SemiBold | 1.15 | −0.4% |
| Display M | 22 | SemiBold | 1.2 | −0.3% |
| Title L | 20 | Medium | 1.25 | −0.2% |
| Title M | 18 | Medium | 1.3 | −0.1% |
| Body L | 16 | Regular | 1.5 | 0 |
| Body M | 15 | Regular | 1.5 | 0 |
| Body S | 14 | Regular | 1.5 | 0 |
| Label M | 14 | Medium | 1.2 | 0 |
| Label S | 13 | Medium | 1.2 | 0 |
| Caption | 12 | Regular | 1.4 | 0 |
| Caption S | 11 | Regular | 1.4 | 0 |
| Overline | 10 | Medium | 1.2 | +0.8%, uppercase |

The app is a phone, so its display sizes are small. **A landing page should scale the
display tiers up (48–72px hero) while keeping body at 16–18px** — keep the family,
the weights and the tight negative tracking on headlines; do not keep 24px as a hero.

---

## 4. Space, shape, depth

**Spacing** (4px base): 4, 8, 12, 16, 20, 24, 32, 48.

**Radius**: 16, 20, 24, **36 (the card corner)**, full/pill.
Real usage is lopsided — pills dominate, then 36px cards. Everything else nests inside those.

**Elevation** — always a pair, shadow plus inner ring:

```css
/* dark */
.glass-raise    { box-shadow: 0 8px 32px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.12); }
.glass-raise-sm { box-shadow: 0 4px 16px rgba(0,0,0,.30), inset 0 0 0 1px rgba(255,255,255,.12); }
/* light */
.glass-raise    { box-shadow: 0 8px 28px rgba(15,23,42,.10), inset 0 0 0 1px rgba(15,23,42,.08); }
.glass-raise-sm { box-shadow: 0 4px 14px rgba(15,23,42,.10), inset 0 0 0 1px rgba(15,23,42,.08); }
```

---

## 5. The backdrop

The app's signature: five big blurred ellipses over the page colour. Light multiplies
a pastel set; dark screens a saturated one. This is what the glass samples, and a
landing page needs its own version of it.

**Light** — `opacity .7, blur 52px, mix-blend-multiply` over `#F7F4F1`:
`#FFC4B8` `#FFE2BC` `#E4D6FF` `#C6E6FF` `#FFD2E6`

**Dark** — `opacity .5, blur 36px, mix-blend-screen` over `#121212`:
`#14014A` `#16098B` `#2A59C8` `#7DD1F5` `#FFFFFF`

Web equivalent:

```css
body {
  background:
    radial-gradient(60% 45% at 18% 12%,  #FFC4B8 0%, transparent 70%),
    radial-gradient(55% 40% at 82% 26%,  #FFE2BC 0%, transparent 70%),
    radial-gradient(70% 50% at 50% 55%,  #E4D6FF 0%, transparent 72%),
    radial-gradient(55% 42% at 12% 78%,  #C6E6FF 0%, transparent 70%),
    radial-gradient(50% 40% at 88% 88%,  #FFD2E6 0%, transparent 70%),
    #F7F4F1;
}
```

Keep it **soft and low-contrast**. It sits behind everything and must never compete
with the text on top.

---

## 6. Component recipes

**Card** — `radius 36`, `background: rgb(ink / 2%)`, `backdrop-filter: blur(20px)`,
`glass-raise`. Padding 20–24. Title in Display, translation below in accent.

**Pill / tag** — fully round, `padding 6 14`, Label S, with a blurred multi-colour
gradient behind it. The word-type colours: noun **amber/orange**, verb
**blue/violet**, adjective **green/lime**, other **magenta/purple**, mastered
**gold + violet**.

**Button (primary)** — pill, `padding 12 24`, Label M SemiBold, glass fill,
`glass-raise-sm`, `inset 0 1px 1px rgba(255,255,255,.3)` highlight on top.

**Button (secondary)** — pill, `1px solid rgb(ink / 20%)`, glass fill, no highlight.

**Input** — pill or 24px radius, `background rgb(ink / 10%)`, no hard border,
placeholder at the tertiary tier.

---

## 7. Paste-ready Figma Make prompt

> Build a landing page for **Polucz**, a Polish vocabulary trainer for Android.
>
> **Visual system.** Warm off-white background `#F7F4F1` with five large blurred
> pastel ellipses behind everything (`#FFC4B8`, `#FFE2BC`, `#E4D6FF`, `#C6E6FF`,
> `#FFD2E6`, blurred ~52px, multiply, opacity .7) — soft, never competing with text.
> All surfaces are frosted glass: ink `#0F172A` at 2–5% opacity with a 20px backdrop
> blur, 36px corner radius, and a shadow of `0 8px 28px rgba(15,23,42,.10)` plus an
> inset `0 0 0 1px rgba(15,23,42,.08)` ring. Controls are fully rounded pills.
>
> **Type.** Instrument Sans. Hero 60px SemiBold with −1% letter-spacing, section
> headings 32px SemiBold, body 17px Regular at 1.5, captions 13px. Text colours:
> `#0F172A` at 100% for headings, 70% for body, 62% for captions — never lighter.
> Accent `#4C2BB8` for links and the translation text under a Polish word.
>
> **Dark mode** must be supported: background `#121212`, ink `#F8FAFC`, accent
> `#B4A0FF`, and the ellipses swapped to `#14014A` `#16098B` `#2A59C8` `#7DD1F5`
> screened at opacity .5.
>
> Keep the layout calm and generous: a 1120px max content width, 96–128px between
> sections, and plenty of air around the phone screenshots.
