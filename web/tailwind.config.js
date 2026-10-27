/** @type {import('tailwindcss').Config} */
// Design tokens are defined as CSS variables in src/styles/design-tokens.css
// (the single source of truth). This config maps them to Tailwind utilities so
// components use e.g. bg-navy / text-teal / border-brd / font-sans, and for the
// map: text-map-loss / bg-map-habitat. Never hardcode hex here.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- AI for Good brand (UI only) ---
        navy: 'var(--color-navy)',
        teal: 'var(--color-teal)',
        magenta: 'var(--color-magenta)',
        ink: 'var(--color-ink)',
        secondary: 'var(--color-secondary)',
        offwhite: 'var(--color-bg-offwhite)',
        card: 'var(--color-card-white)',
        brd: 'var(--color-border)',
        'teal-tint': 'var(--color-teal-tint)',
        'navy-tint': 'var(--color-navy-tint)',

        // --- Map highlights ONLY (earth tones) ---
        map: {
          habitat: 'var(--map-habitat)',
          loss: 'var(--map-loss)',
          partial: 'var(--map-partial)',
          threat: 'var(--map-threat)',
          boundary: 'var(--map-boundary)',
        },
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        pill: 'var(--radius-pill)',
      },
    },
  },
  plugins: [],
}
