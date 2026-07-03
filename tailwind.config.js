/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Arete Care brand — teal (primary) + purple (accent).
        // Source: Arete Signature css/style.css (--teal #3a9ca3 / --purple #7a5c8e).
        brand: {
          50: '#e6f4f3',
          100: '#cfe9e9',
          200: '#a6d6d8',
          300: '#74bcc0',
          400: '#4fa8ad',
          500: '#3a9ca3',
          600: '#2c7d83',
          700: '#246469',
          800: '#1e5155',
          900: '#193f43',
        },
        accent: {
          50: '#f0eaf5',
          100: '#e0d3ea',
          200: '#c6afd6',
          300: '#a888bf',
          400: '#916ea8',
          500: '#7a5c8e',
          600: '#5f4671',
          700: '#4d3a5c',
          800: '#3f3049',
          900: '#342839',
        },
        ink: '#2c2740',
        muted: '#7b7689',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 34px rgba(58,46,80,.10)',
        soft: '0 4px 14px rgba(58,46,80,.08)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
