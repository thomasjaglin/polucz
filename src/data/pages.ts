import type { PageConfig, PageId } from './types'

// Light gradients multiply a white→tinted ramp where the dark ones screen a
// dark→white one. Screen only washes toward white on a light page, so without
// these every page reads as flat off-white and loses its colour identity.
export const pages: Record<PageId, PageConfig> = {
  folder: {
    title: 'Vocabulary List',
    icon: 'folder',
    desc: 'Browse and manage your vocabulary.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#4A0101"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B0909"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C82A2A"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#F57D7D"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
    // Light counterpart. The dark stack screen-blends a dark→white ramp to make
    // a bright core; on a light page screen only washes toward white, so this
    // multiplies tinted ellipses instead.
    //
    // Deliberately wider and more varied than the dark one. Frosted glass is
    // only legible when there is something behind it to be blurred — over a
    // near-uniform wash a blur produces the same uniform wash, and the panes
    // read as flat white however transparent they actually are. Several hues
    // spread across the page give every card a different backdrop, so the
    // transparency shows.
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#FFC4B8"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#FFE2BC"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#E4D6FF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#C6E6FF"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#FFD2E6"/></svg>`,
  },
  translate: {
    title: 'Translate',
    icon: 'translate',
    desc: 'Translate a Polish word or phrase.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#4A0101"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B0909"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C82A2A"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#F57D7D"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
  },
  dynamic_feed: {
    title: 'Flashcard Game',
    icon: 'dynamic_feed',
    desc: 'Memorize terms using spaced repetition.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#014A2D"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#098B42"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#2AC87C"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#B3F57D"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#C6EFD4"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#E4F6C6"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#D4EEFF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#FFE9CC"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#E2E8FF"/></svg>`,
    // Hard mode (English→Polish recall) swaps the green for crimson, so the
    // mode is obvious from the background alone on both the group selector and
    // the game. Deliberately a rose-leaning red rather than the vocab list's
    // fire red — the two pages should not read as the same place. Mirrors
    // DYNAMIC_FEED_HARD in webgl/backgroundData.ts; change both together.
    gradientHard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#4A0120"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B0930"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C82A50"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#F57D9A"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
    gradientHardLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#FFB8B8"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#FFD2C0"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#FFC2D4"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#F0C0CC"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#FFDCD2"/></svg>`,
  },
  question_mark: {
    title: 'Quiz Game',
    icon: 'question_mark',
    desc: 'Test your knowledge.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#484A01"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B8009"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C8AB2A"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#FFDEB3"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#FFF0C2"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#FFE4BA"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#E9F0CA"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#FFDAE2"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#DAE9FF"/></svg>`,
  },
  spatial_audio: {
    title: 'Audio Playback',
    icon: 'spatial_audio',
    desc: 'Listen to pronunciation guides.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#14014A"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#16098B"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#2A59C8"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#7DD1F5"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#C8DCFF"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#DAE8FF"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#E2DAFF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#CAF0EC"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#FFE2EE"/></svg>`,
  },
  add_page: {
    title: 'Add Vocabulary',
    icon: 'add_box',
    desc: 'Ingest new terms into your list.',
    gradient: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 401 463" fill="none" class="absolute -top-[5%] -left-[20%] w-[509px] max-w-none opacity-[0.28] blur-[46px] mix-blend-screen transition-all">
        <ellipse cx="-11.3347" cy="72.7827" rx="254.534" ry="325.96" transform="rotate(-57.5101 -11.3347 72.7827)" fill="#014A2D"/>
        <ellipse cx="-44.6114" cy="51.5914" rx="254.534" ry="286.508" transform="rotate(-57.5101 -44.6114 51.5914)" fill="#094A8B"/>
        <ellipse cx="-84.4344" cy="26.2312" rx="254.534" ry="239.296" transform="rotate(-57.5101 -84.4344 26.2312)" fill="#2A5FC8"/>
        <ellipse cx="-128.622" cy="-1.90822" rx="254.534" ry="186.909" transform="rotate(-57.5101 -128.622 -1.90822)" fill="#A97DF5"/>
        <ellipse cx="-165.171" cy="-25.184" rx="254.534" ry="143.577" transform="rotate(-57.5101 -165.171 -25.184)" fill="white"/>
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 535" fill="none" class="absolute top-[35%] -right-[40%] w-[779px] max-w-none opacity-[0.31] blur-[46px] mix-blend-screen transition-all">
        <ellipse cx="420.864" cy="636.619" rx="389.525" ry="509.094" transform="rotate(149.296 420.864 636.619)" fill="#014A2D"/>
        <ellipse cx="452.325" cy="689.598" rx="389.525" ry="447.477" transform="rotate(149.296 452.325 689.598)" fill="#094A8B"/>
        <ellipse cx="489.975" cy="753" rx="389.525" ry="373.739" transform="rotate(149.296 489.975 753)" fill="#2A5FC8"/>
        <ellipse cx="531.751" cy="823.349" rx="389.525" ry="291.921" transform="rotate(149.296 531.751 823.349)" fill="#A97DF5"/>
        <ellipse cx="566.307" cy="881.539" rx="389.525" ry="224.244" transform="rotate(149.296 566.307 881.539)" fill="white"/>
      </svg>
    `,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#D0E3FF"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#D4F0E2"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#E9DEFF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#FFE8D4"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#DEF0FF"/></svg>`,
  },
  api_config: {
    title: 'App Settings',
    icon: 'settings',
    desc: 'Configure the app and your LLM provider.',
    gradient: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 401 463" fill="none" class="absolute -top-[5%] -left-[20%] w-[509px] max-w-none opacity-[0.28] blur-[46px] mix-blend-screen transition-all">
        <ellipse cx="-11.3347" cy="72.7827" rx="254.534" ry="325.96" transform="rotate(-57.5101 -11.3347 72.7827)" fill="#4A014A"/>
        <ellipse cx="-44.6114" cy="51.5914" rx="254.534" ry="286.508" transform="rotate(-57.5101 -44.6114 51.5914)" fill="#8B098B"/>
        <ellipse cx="-84.4344" cy="26.2312" rx="254.534" ry="239.296" transform="rotate(-57.5101 -84.4344 26.2312)" fill="#C82AC8"/>
        <ellipse cx="-128.622" cy="-1.90822" rx="254.534" ry="186.909" transform="rotate(-57.5101 -128.622 -1.90822)" fill="#F57DF5"/>
        <ellipse cx="-165.171" cy="-25.184" rx="254.534" ry="143.577" transform="rotate(-57.5101 -165.171 -25.184)" fill="white"/>
      </svg>
    `,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#E9D4FF"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#F0DAF0"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#DADEFF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#FFDAEE"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#DEE9FF"/></svg>`,
  },
  help: {
    title: 'Help',
    icon: 'help',
    desc: 'Guided walkthroughs of each part of the app.',
    gradient: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 401 463" fill="none" class="absolute -top-[5%] -left-[20%] w-[509px] max-w-none opacity-[0.28] blur-[46px] mix-blend-screen transition-all">
        <ellipse cx="-11.3347" cy="72.7827" rx="254.534" ry="325.96" transform="rotate(-57.5101 -11.3347 72.7827)" fill="#4A014A"/>
        <ellipse cx="-44.6114" cy="51.5914" rx="254.534" ry="286.508" transform="rotate(-57.5101 -44.6114 51.5914)" fill="#8B098B"/>
        <ellipse cx="-84.4344" cy="26.2312" rx="254.534" ry="239.296" transform="rotate(-57.5101 -84.4344 26.2312)" fill="#C82AC8"/>
        <ellipse cx="-128.622" cy="-1.90822" rx="254.534" ry="186.909" transform="rotate(-57.5101 -128.622 -1.90822)" fill="#F57DF5"/>
        <ellipse cx="-165.171" cy="-25.184" rx="254.534" ry="143.577" transform="rotate(-57.5101 -165.171 -25.184)" fill="white"/>
      </svg>
    `,
    gradientLight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[12%] w-[880px] max-w-none opacity-[0.7] blur-[52px] mix-blend-multiply transition-all"><ellipse cx="110" cy="70" rx="205" ry="185" fill="#E9D4FF"/><ellipse cx="340" cy="160" rx="195" ry="175" fill="#F0DAF0"/><ellipse cx="205" cy="330" rx="235" ry="205" fill="#DADEFF"/><ellipse cx="70" cy="470" rx="205" ry="185" fill="#FFDAEE"/><ellipse cx="350" cy="520" rx="185" ry="175" fill="#DEE9FF"/></svg>`,
  },
}

export const pageOrder: PageId[] = ['folder', 'translate', 'dynamic_feed', 'question_mark', 'spatial_audio']
