/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // design.md §1 — color palette
      colors: {
        ink: '#111827',
        brand: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
        },
        status: {
          filled: '#16A34A',
          'filled-bg': '#F0FDF4',
          unmatched: '#D97706',
          'unmatched-bg': '#FFFBEB',
          error: '#DC2626',
        },
      },
      // design.md §2 — typography
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      // design.md §3 — spacing
      borderRadius: {
        DEFAULT: '8px',
      },
      width: {
        popup: '380px',
      },
    },
  },
  plugins: [],
}
