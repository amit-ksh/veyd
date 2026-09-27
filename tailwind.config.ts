import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7fb",
          100: "#e6edf7",
          200: "#c9d9ec",
          500: "#3f5f8a",
          600: "#324c6e",
          700: "#26394f",
        },
        status: {
          pass: "#1d9a6c",
          fail: "#d1453b",
          review: "#c98a1b",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
