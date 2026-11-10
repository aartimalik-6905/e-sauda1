/** @type {import('tailwindcss').Config} */
export default {
  // Kept 'class' (not 'media') even though there's only one theme now -- some
  // older components may still reference dark:* utilities, and this keeps
  // those harmless no-ops instead of forcing a find-and-replace pass.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every one of these reads from a CSS variable (defined in index.css)
        // instead of a fixed hex value, so retheming stays a one-file change.
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        'cream-dark': 'rgb(var(--color-cream-dark) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        forest: {
          DEFAULT: 'rgb(var(--color-forest) / <alpha-value>)',
          light: 'rgb(var(--color-forest-light) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--color-clay) / <alpha-value>)',
          light: 'rgb(var(--color-clay-light) / <alpha-value>)',
        },
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}