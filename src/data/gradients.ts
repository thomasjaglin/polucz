import type { WordType } from './types'

export const tagGradients: Record<WordType | 'mastered', string> = {
  noun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20" class="absolute inset-0 h-full w-full opacity-90 blur-[4px]" preserveAspectRatio="none"><ellipse cx="19.114" cy="11.3499" rx="19.114" ry="11.3499" transform="matrix(0.891202 -0.453606 0.39995 0.916537 -11.1111 -5.65967)" fill="#FFE79E"/><ellipse cx="25.0001" cy="20" rx="24.0741" ry="14" fill="#FF5D00" fill-opacity="0.74"/><ellipse cx="47.2221" cy="7.99805" rx="9.25926" ry="11" fill="#FDCF2D" fill-opacity="0.49"/></svg>`,
  verb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 47 20" class="absolute inset-0 h-full w-full opacity-90 blur-[4px]" preserveAspectRatio="none"><ellipse cx="19.0426" cy="11.3414" rx="19.0426" ry="11.3414" transform="matrix(0.890334 -0.455307 0.398367 0.917226 -11.0588 -5.65967)" fill="#CB9EFF"/><ellipse cx="23.9608" cy="20" rx="23.9608" ry="14" fill="#0099FF" fill-opacity="0.74"/><ellipse cx="47.0001" cy="7.99805" rx="9.21569" ry="11" fill="#2DFD8E" fill-opacity="0.49"/></svg>`,
  adjective: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 20" class="absolute inset-0 h-full w-full opacity-90 blur-[4px]" preserveAspectRatio="none"><ellipse cx="19.2056" cy="12.795" rx="19.2056" ry="12.795" transform="matrix(0.8923 -0.451444 0.401972 0.915652 -11.178 -5.65967)" fill="#9BBD21"/><ellipse cx="32.1369" cy="20" rx="29.3425" ry="14" fill="#6AFF00" fill-opacity="0.74"/><ellipse cx="62.411" cy="7" rx="9.31507" ry="11" fill="#055015" fill-opacity="0.97"/></svg>`,
  unknown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 20" class="absolute inset-0 h-full w-full opacity-90 blur-[4px]" preserveAspectRatio="none"><ellipse cx="11.9186" cy="-2.61409" rx="20.3379" ry="12.9517" transform="rotate(-25.2336 11.9186 -2.61409)" fill="#4821BD"/><ellipse cx="33" cy="20" rx="30" ry="14" fill="#BF00FF" fill-opacity="0.74"/><ellipse cx="67" cy="7" rx="10" ry="11" fill="#50052B" fill-opacity="0.97"/></svg>`,
  mastered: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20" class="absolute inset-0 h-full w-full opacity-90 blur-[4px]" preserveAspectRatio="none"><ellipse cx="19" cy="11" rx="19" ry="11" transform="matrix(0.891 -0.454 0.4 0.917 -11 -5.66)" fill="#FFD700"/><ellipse cx="30" cy="20" rx="28" ry="14" fill="#9B6FFF" fill-opacity="0.80"/><ellipse cx="56" cy="7" rx="10" ry="11" fill="#FFB800" fill-opacity="0.55"/></svg>`,
}

export const activeSvgMask = `
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" fill="none" style="transform: rotate(165deg) scale(1.2);">
    <g filter="url(#filter0_fn_13_8836_active)">
      <ellipse cx="13.2037" cy="40.9201" rx="23.6306" ry="24.644" transform="rotate(165 13.2037 40.9201)" fill="#4A0101"/>
      <ellipse cx="13.9757" cy="43.8012" rx="23.6306" ry="21.6613" transform="rotate(165 13.9757 43.8012)" fill="#8B0909"/>
      <ellipse cx="14.8996" cy="47.2491" rx="23.6306" ry="18.0919" transform="rotate(165 14.8996 47.2491)" fill="#C82A2A"/>
      <ellipse cx="15.9246" cy="51.0747" rx="23.6306" ry="14.1312" transform="rotate(165 15.9246 51.0747)" fill="#F57D7D"/>
      <ellipse cx="16.7726" cy="54.2392" rx="23.6306" ry="10.8551" transform="rotate(165 16.7726 54.2392)" fill="white"/>
    </g>
    <defs>
      <filter id="filter0_fn_13_8836_active" x="-44.0021" y="-17.1631" width="117.275" height="117.043" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="10.35" result="effect1_foregroundBlur_13_8836"/>
      </filter>
    </defs>
  </svg>
`

// Per-type solid gradient used as the coloured background/"illustration" behind
// the cosmos holo on mastered cards (vocab list + word modal).
export const masteredBase: Record<string, string> = {
  verb: 'linear-gradient(135deg, #9B4FB0, #3A3AB5 55%, #1FB4CC)',
  noun: 'linear-gradient(135deg, #8A2E2E, #D07A2A 55%, #A0A830)',
  adjective: 'linear-gradient(135deg, #1A5A30, #2AA840 55%, #145A3A)',
  unknown: 'linear-gradient(135deg, #3A3A44, #5A5A66)',
}

// Per-type colour-fill images used for the type tag (and buttons) on mastered cards.
export const tagImages: Record<string, string> = {
  verb: '/tags/Verb.png',
  noun: '/tags/Noun.png',
  adjective: '/tags/Adj.png',
  unknown: '/tags/Other.png',
}

// Blob wash behind the committing action on a screen — the "solid pill" button.
// Same recipe as the tags (overlapping blurred ellipses) but a single colourway:
// buttons have no taxonomy to encode, so one wash reads as a system where five
// would read as five arbitrary choices.
//
// Traced from the design system file, node 20:64. The ellipses live in a padded
// 573×263 field so the blur never meets an edge; the button's own rounded
// overflow does the masking, which is what the Figma mask group does there.
// Sixty units of that padding are pure margin — the button occupies x 112–488,
// y 118–168 of the field.
//
// Figma layers three blurs (group 38.1, ellipses 17.4/4/17.4). Gaussians compose
// as sqrt(a²+b²), which puts all three between 19.2 and 20.9, so one pass at 20
// is indistinguishable and avoids SVG filter-region clipping. Figma's per-ellipse
// NOISE at 25% is dropped: it sits under a 20px blur and cannot survive it.
//
// Unlike the tag gradients this blends normally rather than screening, so it
// holds its colour on the light page instead of washing out to white.
export const buttonGradient = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 573 263" preserveAspectRatio="none" class="h-full w-full"><defs><filter id="polucz-btn-wash" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="20"/></filter></defs><g filter="url(#polucz-btn-wash)"><g transform="matrix(0.9748,-0.223,0.6966,0.7174,60,103.351)"><ellipse cx="97.205" cy="54.575" rx="97.205" ry="54.575" fill="#4AE2F3"/></g><ellipse cx="289.7" cy="168" rx="162.245" ry="35" fill="#DC6EF5" fill-opacity="0.74"/><ellipse cx="449.5" cy="125.5" rx="63.5" ry="27.5" fill="#223EB8" fill-opacity="0.97"/></g></svg>`
