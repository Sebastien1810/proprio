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
          dark:   '#07080f',
          card:   '#0d0e1a',
          tile:   '#0f1020',
          accent: '#00ffc8',
          green:  '#27ae60',
        },
      },
    },
  },
  plugins: [],
};
