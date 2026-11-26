/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2f6fed', dark: '#5b8ef5' },
        online : { DEFAULT: '#1f9d55', dark: '#3ccf7e' },
        warn   : { DEFAULT: '#c27c0e', dark: '#e0a33a' },
        danger : { DEFAULT: '#d13d3d', dark: '#f06a6a' },
        surface: { DEFAULT: '#f5f6f8', card: '#ffffff', dark: '#12161c', 'card-dark': '#1a2029' },
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translate(-50%, 6px)' }, to: { opacity: '1', transform: 'translate(-50%, 0)' } },
        // dropdown menus
        pop: { from: { opacity: '0', transform: 'translateY(-4px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        pop      : 'pop .12s ease-out',
      },
    },
  },
  plugins: [],
}
