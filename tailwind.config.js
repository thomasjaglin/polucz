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
        // The purple accent. Same reason as ink: a colour picked to sit on a
        // dark surface is not the same colour on a light one.
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
