import type { PageConfig, PageId } from './types'

export const pages: Record<PageId, PageConfig> = {
  folder: {
    title: 'Vocabulary List',
    icon: 'folder',
    desc: 'Browse and manage your vocabulary.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#4A0101"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B0909"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C82A2A"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#F57D7D"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
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
  },
  question_mark: {
    title: 'Quiz Game',
    icon: 'question_mark',
    desc: 'Test your knowledge.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#484A01"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#8B8009"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#C8AB2A"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#FFDEB3"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
  },
  spatial_audio: {
    title: 'Audio Playback',
    icon: 'spatial_audio',
    desc: 'Listen to pronunciation guides.',
    gradient: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 598" fill="none" class="absolute -top-[10%] w-[504px] max-w-none opacity-50 blur-[36px] mix-blend-screen transition-all"><ellipse cx="205" cy="95.5" rx="252" ry="430.5" fill="#14014A"/><ellipse cx="205" cy="43.3958" rx="252" ry="378.396" fill="#16098B"/><ellipse cx="205" cy="-18.9583" rx="252" ry="316.042" fill="#2A59C8"/><ellipse cx="205" cy="-88.1458" rx="252" ry="246.854" fill="#7DD1F5"/><ellipse cx="205" cy="-145.375" rx="252" ry="189.625" fill="white"/></svg>`,
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
  },
}

export const pageOrder: PageId[] = ['folder', 'translate', 'dynamic_feed', 'question_mark', 'spatial_audio']
