import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--vic-black)',
        foreground: 'var(--vic-text)',
        vic: {
          black: 'var(--vic-black)',
          dark: 'var(--vic-dark)',
          surface: 'var(--vic-surface)',
          border: 'var(--vic-border)',
          accent: 'var(--vic-accent)',
          purple: 'var(--vic-purple)',
          green: 'var(--vic-green)',
          red: 'var(--vic-red)',
          gold: 'var(--vic-gold)',
          text: 'var(--vic-text)',
          muted: 'var(--vic-muted)',
        },
        hud: {
          dark: '#0d1117',
          border: '#1f293d',
          accent: '#38bdf8',
          amber: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
