/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#07080c',
          raised: '#0d0f16',
          card: '#11151e',
          modal: '#151a26',
          elevated: '#1c2233',
        },
        accent: {
          cyan: '#22d3ee',
          violet: '#8b5cf6',
          amber: '#fbbf24',
          emerald: '#34d399',
          rose: '#fb7185',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

