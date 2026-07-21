/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: { 950: "#0c0d11", 900: "#14161c", 800: "#1d2028", 700: "#3a3f4b" },
        paper: "#fbfbfa",
      },
    },
  },
  plugins: [],
};
