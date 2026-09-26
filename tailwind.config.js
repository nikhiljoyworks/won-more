/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          dark: '#0B3B48',
          brand: '#0F4C5C',
          light: '#1B6A7F',
          muted: '#25829B',
        },
        coral: {
          brand: '#F26419',
          hover: '#DB5411',
          light: '#FFF1EB',
          accent: '#FF6F61',
        },
        surface: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        card: '0 4px 20px -2px rgba(15, 76, 92, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        highlight: '0 8px 30px rgba(242, 100, 25, 0.18)',
      },
    },
  },
  plugins: [],
}
