/** @type {import('tailwindcss').Config} */

// Design tokens are declared as RGB triplets in main.css and consumed here through
// `rgb(var(--x) / <alpha-value>)`, so every utility keeps working with Tailwind's
// opacity modifiers (e.g. `bg-surface/80`, `ring-line/10`) while light/dark themes
// swap a single set of variables instead of duplicating class lists everywhere.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Elevation surfaces, from most recessed to most raised
        canvas:  token('--c-canvas'),
        surface: token('--c-surface'),
        raised:  token('--c-raised'),
        sunken:  token('--c-sunken'),

        // Hairlines / dividers. Always use with an alpha modifier: `border-line/10`.
        line: token('--c-line'),

        // Text hierarchy. `ink` 16:1, `muted` 7.5:1, `soft` 4.8:1 (all AA on surface),
        // `faint` is decorative only and never carries meaning on its own.
        ink: {
          DEFAULT: token('--c-ink'),
          muted:   token('--c-ink-muted'),
          soft:    token('--c-ink-soft'),
          faint:   token('--c-ink-faint'),
        },

        accent: {
          DEFAULT: token('--c-accent'),
          hover:   token('--c-accent-hover'),
          ring:    token('--c-accent-ring'),
          fg:      token('--c-on-accent'),
        },
        danger: token('--c-danger'),
        warn:   token('--c-warn'),
      },

      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"',
          '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans SC"',
          'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
        mono: [
          '"SF Mono"', 'ui-monospace', 'SFMono-Regular', '"JetBrains Mono"',
          'Menlo', 'Consolas', '"Liberation Mono"', 'monospace',
        ],
      },

      fontSize: {
        // 11px floor for metadata — replaces the old text-[10px], which sat below
        // the readable minimum especially for CJK glyphs.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },

      letterSpacing: {
        tightest: '-0.022em',
      },

      // Two-part shadows (contact + ambient) so elevation reads as real depth.
      // Dark mode swaps in deeper values plus a top inner highlight.
      boxShadow: {
        xs:        'var(--sh-xs)',
        sm:        'var(--sh-sm)',
        DEFAULT:   'var(--sh-sm)',
        md:        'var(--sh-md)',
        lg:        'var(--sh-lg)',
        xl:        'var(--sh-xl)',
        '2xl':     'var(--sh-xl)',
        highlight: 'var(--sh-highlight)',
        none:      'none',
      },

      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up':  {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'fade-up': 'fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in':  'pop-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
}
