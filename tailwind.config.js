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
          dark:   '#1c1c24',
          card:   '#22222e',
          tile:   '#1a1a26',
          accent: '#00ffc8',
          green:  '#27ae60',
        },
      },
    },
  },
  plugins: [],
};
