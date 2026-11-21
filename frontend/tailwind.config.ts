import type { Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      animation: {
        "chat-panel-in": "chat-panel-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        "chat-panel-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
