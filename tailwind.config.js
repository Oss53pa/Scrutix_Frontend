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
        // Primary palette — Ink Navy with subtle warmth (premium banking)
        primary: {
          50: '#f8f7f4',
          100: '#eeece4',
          200: '#dad6c8',
          300: '#b8b1a0',
          400: '#8e8675',
          500: '#6b6453',
          600: '#4f4a3d',
          700: '#373328',
          800: '#1f1d17',
          900: '#0f0e0a',
          950: '#070605',
        },
        // Accent — Champagne Gold (subtle premium highlights)
        accent: {
          50: '#fbf8f0',
          100: '#f4ecd4',
          200: '#ead8a5',
          300: '#dec078',
          400: '#d4a85a',
          500: '#c9954a',
          600: '#b07c3c',
          700: '#8a5e30',
          800: '#5e3f21',
          900: '#382613',
        },
        // Ink — sophisticated deep navy-slate for text & brand
        ink: {
          50: '#f5f6f8',
          100: '#e6e8ee',
          200: '#c8ccd6',
          300: '#9ba3b4',
          400: '#6a7388',
          500: '#475066',
          600: '#2f3852',
          700: '#1e2640',
          800: '#101830',
          900: '#070b1f',
          950: '#03050f',
        },
        // Canvas — warm ivory backgrounds
        canvas: {
          50: '#fefdfa',
          100: '#fbf9f3',
          200: '#f5f2e8',
          300: '#ece7d6',
          400: '#ddd5bc',
        },
        // Semantic colors for anomaly severity
        severity: {
          low: '#6b7280',
          medium: '#d97706',
          high: '#dc2626',
          critical: '#7f1d1d',
        },
        // Status colors — refined
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        sans: ['Dosis', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Grand Hotel', 'cursive'],
        serif: ['Cormorant Garamond', 'Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        'data': ['0.8125rem', { lineHeight: '1.25rem' }],
        'display-xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        'display-lg': ['3.75rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'display-md': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.02em',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        // Multi-layer premium shadows
        'card': '0 1px 2px 0 rgb(15 14 10 / 0.04), 0 1px 3px 0 rgb(15 14 10 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(15 14 10 / 0.08), 0 2px 6px -2px rgb(15 14 10 / 0.04)',
        'elevated': '0 12px 32px -8px rgb(15 14 10 / 0.12), 0 4px 12px -4px rgb(15 14 10 / 0.06), 0 0 0 1px rgb(15 14 10 / 0.04)',
        'dropdown': '0 16px 40px -8px rgb(15 14 10 / 0.18), 0 8px 16px -8px rgb(15 14 10 / 0.10), 0 0 0 1px rgb(15 14 10 / 0.05)',
        'glow': '0 0 0 1px rgb(201 149 74 / 0.3), 0 4px 16px -2px rgb(201 149 74 / 0.20)',
        'glow-ink': '0 0 0 1px rgb(15 14 10 / 0.85), 0 4px 16px -4px rgb(15 14 10 / 0.30)',
        'inset-soft': 'inset 0 1px 2px rgb(15 14 10 / 0.04)',
      },
      borderRadius: {
        'card': '0.75rem',
        'xl-2': '1rem',
        'pill': '9999px',
      },
      backgroundImage: {
        'mesh-light': 'radial-gradient(at 0% 0%, rgb(244 236 212 / 0.4) 0%, transparent 50%), radial-gradient(at 100% 0%, rgb(220 192 120 / 0.15) 0%, transparent 40%), radial-gradient(at 100% 100%, rgb(7 11 31 / 0.04) 0%, transparent 50%)',
        'mesh-dark': 'radial-gradient(at 0% 0%, rgb(48 38 19 / 0.5) 0%, transparent 50%), radial-gradient(at 100% 100%, rgb(7 11 31 / 0.6) 0%, transparent 50%)',
        'gradient-ink': 'linear-gradient(135deg, #1e2640 0%, #070b1f 100%)',
        'gradient-gold': 'linear-gradient(135deg, #d4a85a 0%, #b07c3c 100%)',
        'gradient-canvas': 'linear-gradient(180deg, #fefdfa 0%, #fbf9f3 100%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2.4s linear infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.04)' },
        },
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
