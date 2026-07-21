/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', "Palatino", "Georgia", "Cambria", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        // warm neutral ink scale
        ink: {
          950: "#17150f",
          900: "#211e17",
          800: "#33302a",
          700: "#5b564c",
          600: "#847d6f",
          500: "#a49c8d",
        },
        paper: "#faf9f6",
        // one restrained accent, used sparingly
        accent: {
          DEFAULT: "#b45309",
          soft: "#f4ead9",
        },
        pass: "#2f7d55",
        fail: "#c0392b",
      },
    },
  },
  plugins: [],
};
