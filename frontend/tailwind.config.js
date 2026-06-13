/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        desk: {
          free: '#22c55e',
          occupied: '#ef4444',
          away: '#eab308',
          abandoned: '#6b7280',
          maintenance: '#9ca3af',
        },
      },
    },
  },
  plugins: [],
};
