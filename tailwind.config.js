/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5FC', 100: '#D9E8F8', 200: '#B3D0F0', 300: '#7FB0E4', 400: '#4A8CD5',
          500: '#2670C0', 600: '#1B5A9E', 700: '#164A82', 800: '#123B67', 900: '#0E2E50', 950: '#081B31',
        },
        accent: {
          50: '#FFF6EC', 100: '#FFE8CF', 200: '#FFD0A0', 300: '#FFB26B', 400: '#FF9440',
          500: '#F2761A', 600: '#D65F0B', 700: '#B04B06', 800: '#8A3B08', 900: '#6E3009',
        },
        ink: {
          50: '#F7F8FA', 100: '#EEF1F5', 200: '#DDE2EA', 300: '#C3CBD6', 400: '#97A3B3',
          500: '#6B7A8C', 600: '#4F5D6E', 700: '#3B4756', 800: '#27313D', 900: '#171E27', 950: '#0C1116',
        },
        success: { 50: '#ECFDF3', 100: '#D1FADF', 500: '#12B76A', 600: '#039855', 700: '#027A48' },
        warning: { 50: '#FFFAEB', 100: '#FEF0C7', 500: '#F79009', 600: '#DC6803', 700: '#B54708' },
        danger: { 50: '#FEF3F2', 100: '#FEE4E2', 500: '#F04438', 600: '#D92D20', 700: '#B42318' },
        info: { 50: '#EFF8FF', 100: '#D1E9FF', 500: '#2E90FA', 600: '#1570EF', 700: '#175CD3' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-lg': ['2.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-md': ['2.125rem', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-sm': ['1.625rem', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,17,22,0.04), 0 1px 3px rgba(12,17,22,0.06)',
        raised: '0 4px 12px -2px rgba(12,17,22,0.08), 0 2px 4px rgba(12,17,22,0.04)',
        overlay: '0 24px 48px -12px rgba(12,17,22,0.25)',
        focus: '0 0 0 3px rgba(38,112,192,0.35)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      maxWidth: { content: '72rem', prose: '42rem' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 220ms ease-out',
        'slide-in-right': 'slide-in-right 220ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
