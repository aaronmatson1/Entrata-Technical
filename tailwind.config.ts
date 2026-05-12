import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b1b8c8',
          400: '#8590a8',
          500: '#67738d',
          600: '#525c75',
          700: '#434b60',
          800: '#3a4051',
          900: '#252937',
          950: '#181b25',
        },
        accent: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd3ff',
          300: '#8fb6ff',
          400: '#5a8eff',
          500: '#3568fc',
          600: '#1f47f1',
          700: '#1936dc',
          800: '#1b30b2',
          900: '#1d308c',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
