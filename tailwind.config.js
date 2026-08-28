/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Foreground colour, as raw channels so Tailwind's opacity modifiers
        // still work (text-ink/70, border-ink/20, bg-ink/[0.02]). The channels
        // flip with the theme; every alpha in the UI keeps its meaning.
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
