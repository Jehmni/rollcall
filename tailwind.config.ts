import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1F3A8A',    // Deep Royal Blue
          secondary: '#F8FAFC',  // Cool Grey background
          slate: '#94A3B8',      // Inactive/Neutral Grey
          gold: '#EAB308',       // Celebration Gold
          accent: '#0EA5E9',     // Tally Slash Cyan
          text: '#1E293B',       // Deep Slate Text
          border: '#E2E8F0',     // Subtle Border
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
