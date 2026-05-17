import type { Config } from 'tailwindcss';

export default {
  content: [
    'entrypoints/**/*.{ts,tsx,html}',
    'components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        roboto: ['Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
