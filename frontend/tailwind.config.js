/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',   // `dark` on <html>, set by index.html and useTheme (System / Light / Dark)
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2f6fed', dark: '#5b8ef5' },
        online : { DEFAULT: '#17803f', dark: '#3ccf7e' },   // light shades pass WCAG AA (4.5:1) on white
        warn   : { DEFAULT: '#a5660a', dark: '#e0a33a' },
        danger : { DEFAULT: '#d13d3d', dark: '#f06a6a' },
        surface: { DEFAULT: '#f5f6f8', card: '#ffffff', dark: '#12161c', 'card-dark': '#1a2029' },
      },
      keyframes: {
        // toasts
        'fade-in-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        // dropdown menus
        pop: { from: { opacity: '0', transform: 'translateY(-4px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in-up': 'fade-in-up .2s ease-out',
        pop      : 'pop .12s ease-out',
      },
    },
  },
  plugins: [],
}
