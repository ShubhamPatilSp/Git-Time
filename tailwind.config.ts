import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      },
      colors: {
        surface: {
          0: '#0a0a0f',
          1: '#0f0f17',
          2: '#14141f',
          3: '#1a1a28',
          4: '#20203a',
        },
        brand: {
          green: '#00ff87',
          cyan: '#00d4ff',
          amber: '#ffb347',
          red: '#ff4757',
        },
        muted: '#4a4a6a',
        subtle: '#2a2a44',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'blink': 'blink 1s step-end infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bar-fill': 'barFill 0.6s ease-out forwards',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        barFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--fill-width)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
