import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#1a1a1a",
        },
        stone: {
          DEFAULT: "#6b6b6b",
          light: "#f7f7f6",
          border: "#e5e5e5",
          muted: "#a3a3a3",
        },
        background: "#ffffff",
        foreground: "#0a0a0a",
        border: "#e5e5e5",
        muted: {
          DEFAULT: "#f7f7f6",
          foreground: "#6b6b6b",
        },
      },
      letterSpacing: {
        tightest: "-0.06em",
        tighter: "-0.04em",
        tight: "-0.025em",
        editorial: "-0.03em",
      },
      maxWidth: {
        site: "1200px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease both",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
