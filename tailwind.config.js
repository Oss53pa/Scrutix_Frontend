/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface colors (theme-aware via CSS variables)
        surface: {
          app: 'rgb(var(--bg-app) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          sidebar: 'rgb(var(--bg-sidebar) / <alpha-value>)',
          header: 'rgb(var(--bg-header) / <alpha-value>)',
          input: 'rgb(var(--bg-input) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover) / <alpha-value>)',
          muted: 'rgb(var(--bg-muted) / <alpha-value>)',
        },
        on: {
          surface: 'rgb(var(--text-primary) / <alpha-value>)',
          'surface-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
          'surface-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        },
        'border-theme': 'rgb(var(--border-default) / <alpha-value>)',
        // Primary grayscale palette - Professional banking theme
        primary: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Semantic colors for anomaly severity
        severity: {
          low: '#6b7280',
          medium: '#f59e0b',
          high: '#ef4444',
          critical: '#7f1d1d',
        },
        // Status colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Exo 2', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Grand Hotel', 'cursive'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        'data': ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'card': '0.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
