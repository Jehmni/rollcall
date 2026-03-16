import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5247e6',
          dark: '#121121',
          light: '#f6f6f8',
        },
        brand: {
          primary: '#1F3A8A',    // Deep Royal Blue
          secondary: '#F8FAFC',  // Cool Grey background
          slate: '#94A3B8',      // Inactive/Neutral Grey
          gold: '#EAB308',       // Celebration Gold
          text: '#1E293B',       // Deep Slate Text
          border: '#E2E8F0',     // Subtle Border
        },
        'background-light': '#f6f6f8',
        'background-dark': '#121121',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
