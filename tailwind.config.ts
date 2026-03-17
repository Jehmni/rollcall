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
        // Body & UI: Plus Jakarta Sans — refined geometric sans used by premium global brands
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        // Display & headings: Cormorant Garamond — prestige serif used by FT, The Economist,
        // luxury event programmes, and global cultural institutions.
        // The italic variant is exceptional — built for formal event typography.
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
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
