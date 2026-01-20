import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "speak-cream": "#fff7e8",
        "speak-blue": "#2f6bff",
        "speak-blue-dark": "#1f46b8",
        "speak-green": "#20c997",
        "speak-yellow": "#ffd166",
        "speak-orange": "#ff8a5b",
        "speak-ink": "#0f172a"
      },
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"]
      },
      boxShadow: {
        card: "0 20px 40px rgba(15, 23, 42, 0.12)",
        glow: "0 12px 28px rgba(47, 107, 255, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
