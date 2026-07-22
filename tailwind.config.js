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
        // nocturne system, drawn from the painting: cool indigo ink on moonstone
        ink: {
          950: "#10162e",
          900: "#1a2142",
          800: "#2a3157",
          700: "#4a5178",
          600: "#656d96",
          500: "#8b91b3",
        },
        paper: "#eef0f6",
        // starlight gold: the accent for actions and marks
        accent: {
          DEFAULT: "#c39422",
          bright: "#e0b64a",
          soft: "#f3ead0",
        },
        // cypress viridian: links and secondary accents on light ground
        verd: {
          DEFAULT: "#256b52",
          soft: "#dfeae4",
        },
        pass: "#2b7d55",
        fail: "#c13a2e",
      },
    },
  },
  plugins: [],
};
