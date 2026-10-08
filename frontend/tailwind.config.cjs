/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Semantic palette — the single source of truth is the CSS variables in
      // src/index.css. Retheming the app means editing those values only.
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        well: 'rgb(var(--color-well) / <alpha-value>)',
        closed: 'rgb(var(--color-closed) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'primary-tint': 'rgb(var(--color-primary-tint) / <alpha-value>)',
        'primary-deep': 'rgb(var(--color-primary-deep) / <alpha-value>)',
        'secondary-tint': 'rgb(var(--color-secondary-tint) / <alpha-value>)',
        'secondary-deep': 'rgb(var(--color-secondary-deep) / <alpha-value>)',
        'warning-tint': 'rgb(var(--color-warning-tint) / <alpha-value>)',
        'danger-deep': 'rgb(var(--color-danger-deep) / <alpha-value>)',
        'page-admin': 'rgb(var(--color-page-admin) / <alpha-value>)',
        'rail-admin': 'rgb(var(--color-rail-admin) / <alpha-value>)',
        'rail-member': 'rgb(var(--color-rail-member) / <alpha-value>)',
        'success-deep': 'rgb(var(--color-success-deep) / <alpha-value>)',
        'danger-tint': 'rgb(var(--color-danger-tint) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Hard offset shadows, tied to --color-ink so the softened "near-black"
      // refresh tone (see src/index.css) carries through automatically.
      boxShadow: {
        'brutal-xs': '1px 1px 0 0 rgb(var(--color-ink))',
        'brutal-sm': '2px 2px 0 0 rgb(var(--color-ink))',
        'brutal-md': '3px 3px 0 0 rgb(var(--color-ink))',
        brutal: '4px 4px 0 0 rgb(var(--color-ink))',
        'brutal-lg': '6px 6px 0 0 rgb(var(--color-ink))',
        'brutal-xl': '8px 8px 0 0 rgb(var(--color-ink))',
      },
      borderRadius: {
        'brutal-sm': '10px',
        brutal: '12px',
        'brutal-lg': '16px',
      },
      // The type scale the app actually uses, named by the role each size
      // plays. Dense tables and rows sit at `row`; `label` is the mono
      // uppercase caption that labels a field or a column.
      fontSize: {
        micro: '9px',
        label: '10px',
        meta: '11px',
        row: '13px',
        emphasis: '15px',
        title: '18px',
        heading: '22px',
        headline: '26px',
        'display-sm': '30px',
        display: '44px',
      },
      // `caps*` widen mono uppercase captions; `snug*` tighten display text.
      // 0.1em is Tailwind's own `widest`, so it is not repeated here.
      letterSpacing: {
        snug: '-0.01em',
        snugger: '-0.02em',
        caps: '0.06em',
        'caps-md': '0.08em',
        'caps-lg': '0.12em',
      },
    },
  },
  plugins: [],
};
