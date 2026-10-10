/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0E0B08',
        surface: '#1A1612',
        card: '#231C16',
        border: '#3A2E22',
        cream: '#F3E9D6',
        accent: '#C68A4B',
        accentMuted: '#8C5A2F',
        muted: '#8A7A66',
      },
    },
  },
  plugins: [],
};
