import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const withAlpha = (variable: string) =>
  `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // The tokens are hex CSS variables, which Tailwind can't split into
      // channels, so a modifier like bg-surface/95 used to compile to nothing.
      // color-mix() with <alpha-value> makes every opacity modifier work.
      colors: {
        background: withAlpha("--color-background"),
        foreground: withAlpha("--color-foreground"),
        muted: withAlpha("--color-muted"),
        accent: withAlpha("--color-accent"),
        surface: withAlpha("--color-surface"),
        border: withAlpha("--color-border"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      typography: () => ({
        DEFAULT: {
          css: {
            maxWidth: "none",
          },
        },
      }),
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // The track holds two identical copies, so -50% lands exactly where it started.
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
        ticker: "ticker 70s linear infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
