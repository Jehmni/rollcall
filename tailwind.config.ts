import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Switchable tokens: CSS variables with space-separated RGB so that
        // Tailwind opacity modifiers (bg-primary/10, border-primary/30) still work.
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          light:   'rgb(var(--color-primary-light) / <alpha-value>)',
          dark:    'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          low:     'rgb(var(--color-surface-low) / <alpha-value>)',
          high:    'rgb(var(--color-surface-high) / <alpha-value>)',
          highest: 'rgb(var(--color-surface-highest) / <alpha-value>)',
        },
        // Legacy aliases — same CSS variables, no component renames needed
        'background-light': 'rgb(var(--color-bg) / <alpha-value>)',
        'background-dark':  'rgb(var(--color-bg) / <alpha-value>)',
        'surface-dark':     'rgb(var(--color-surface-low) / <alpha-value>)',
        'border-dark':      'rgb(var(--color-border) / <alpha-value>)',
        brand: {
          charcoal:  '#131313',
          grey:      '#757575',
          offwhite:  '#F5F5F5',
          amber:     '#F0A500',
          teal:      '#00C9A7',
          red:       '#EF5350',
          border:    '#2E2E2E',
        },
        // ── Brand accent overrides ────────────────────────────────────────────
        // Replaces Tailwind's default amber/emerald/green shades with the
        // brand palette. Opacity modifiers (bg-amber-500/30) still work because
        // Tailwind converts hex → RGB internally.
        amber: {
          100: '#FEF3CF',  // very light tint
          300: '#FACF6E',  // light
          400: '#F5BA38',  // medium
          500: '#F0A500',  // ← brand yellow
          600: '#CC8C00',  // pressed / hover
        },
        emerald: {
          300: '#4DE0CC',  // light tint
          400: '#26D4BA',  // medium
          500: '#00C9A7',  // ← brand green
          600: '#00A589',  // pressed / hover
        },
        green: {
          50:  '#E6FAF7',  // very light background tint
          400: '#26D4BA',  // medium
          500: '#00C9A7',  // ← brand green
          700: '#007D68',  // dark
        },
      },
      fontFamily: {
        // Body & UI: Inter
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Display & Headlines: Manrope — Editorial Voice
        display: ['Newsreader', 'Manrope', 'system-ui', 'sans-serif'],
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
