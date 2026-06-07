/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        bebas: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        proprio: {
          dark: '#1a1a2e',
          card: '#16213e',
          accent: '#e94560',
          gold: '#f5a623',
          green: '#27ae60',
        },
      },
    },
  },
  plugins: [],
};
