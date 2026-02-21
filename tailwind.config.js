/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aldi: {
          orange: '#FF6600',
          blue: '#00559F',
        },
        publix: {
          green: '#008C00',
        },
        walmart: {
          blue: '#0071CE',
        },
        costco: {
          red: '#E31837',
          blue: '#005DAA',
        },
      },
      animation: {
        'pulse-slow': 'pulse-scale 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
