import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5247e6',   // primary-container — solid fills, buttons
          light: '#c3c0ff',    // true primary accent — text on dark surfaces
          dark: '#1f00a4',     // on-primary — text on filled primary buttons
        },
        secondary: '#ddb7ff',  // categorical labels, secondary metadata
        surface: {
          DEFAULT: '#0c1324',  // base surface layer
          low: '#151b2d',      // surface-container-low — card/section recess
          high: '#252e45',     // surface-container-high — elevated cards
          highest: '#2e3447',  // surface-container-highest — interactive cards
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
        'background-dark': '#0c1324',   // surface base (was #121121)
        'surface-dark': '#151b2d',      // surface-container-low (was #1e1b38)
        'border-dark': '#2e3447',       // surface-container-highest (was #2d2a52)
      },
      fontFamily: {
        // Body & UI: Inter
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Display & Headlines: Manrope — Editorial Voice
        display: ['Manrope', 'system-ui', 'sans-serif'],
        // Prestige accent: Cormorant Garamond — use sparingly for elite words
        accent: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      fontSize: {
        // Micro label — replaces all arbitrary text-[9px] / text-[10px] usage
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        // Replaces arbitrary tracking-[0.15em] — tight uppercase labels
        'label':  '0.15em',
        // Replaces arbitrary tracking-[0.2em] — standard small-caps labels & micro text
        'spaced': '0.2em',
        // Replaces arbitrary tracking-[0.3em] — button text & badge text
        'spread': '0.3em',
        // Replaces arbitrary tracking-[0.4em] — ultra-spaced section overlines
        'super':  '0.4em',
      },
    },
  },
  plugins: [],
} satisfies Config
