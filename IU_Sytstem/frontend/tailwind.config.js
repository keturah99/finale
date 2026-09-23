/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d9e4f4',
          500: '#1a3a6c',
          600: '#15305a',
          700: '#0f2548',
        },
      },
    },
  },
  plugins: [],
}