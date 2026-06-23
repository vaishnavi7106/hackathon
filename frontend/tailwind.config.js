/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forest — primary brand (#0A5C47 from design doc)
        primary: {
          50:  '#E8F5F1',
          100: '#C5E8DC',
          200: '#8FD1BE',
          300: '#59BAA0',
          400: '#2DA383',
          500: '#12A07A',
          600: '#0A5C47',
          700: '#084D3C',
          800: '#063D30',
          900: '#042E24',
        },
        // Harvest amber — warnings, pending actions
        harvest: {
          DEFAULT: '#F59E0B',
          light:   '#FEF3C7',
          dark:    '#92400E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Tamil', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
