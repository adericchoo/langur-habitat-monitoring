/** @type {import('tailwindcss').Config} */
// Minimal config for C1. The AIFG design tokens in web/tokens/ are wired into
// `theme.extend` in C2 (see BUILD_CHECKLIST.md) — do not hardcode colours here.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
