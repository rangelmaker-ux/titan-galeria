import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0c0f",
        paper: "#fafaf9",
      },
    },
  },
  plugins: [],
};

export default config;
