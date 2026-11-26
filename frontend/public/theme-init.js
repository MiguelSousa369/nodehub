// Applies the saved theme before the first paint, so there is no flash of the wrong theme.
// A separate file (not inline in index.html) because the backend's Content-Security-Policy only
// allows scripts from the same origin. Kept in sync by src/context/ThemeContext.tsx.
try {
  var theme = localStorage.getItem('theme')
  if (theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch (e) { /* storage blocked: follow the light default until React starts */ }
