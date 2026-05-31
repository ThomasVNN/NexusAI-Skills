/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // new-api dark theme colors
        'bg-primary': '#0A0A0B',
        'bg-secondary': '#111113',
        'bg-elevated': '#1F1F23',
        'bg-card': '#18181B',
        // Accent
        'accent-primary': '#8B5CF6',
        'accent-secondary': '#A78BFA',
        'accent-muted': '#7C3AED',
        // Text
        'text-primary': '#FAFAFA',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        // Borders
        'border-subtle': '#27272A',
        'border-default': '#3F3F46',
        // Status
        'success': '#34D399',
        'success-muted': '#059669',
        'warning': '#FBBF24',
        'warning-muted': '#D97706',
        'error': '#F87171',
        'error-muted': '#DC2626',
        'info': '#60A5FA',
        'info-muted': '#2563EB',
        // Categories
        'cat-data': '#3B82F6',
        'cat-legal': '#10B981',
        'cat-code': '#8B5CF6',
        'cat-general': '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
