import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2c2117",
        sand: "#e6d1af",
        clay: "#aa7543",
        moss: "#7d8d63",
        mist: "#d9c4a2",
        gold: "#b8864d",
        night: "#8d6a43",
        navy: "#b49369",
        paper: "#fff6ea",
        ember: "#ca8d4c",
        line: "#9a7650"
      },
      boxShadow: {
        soft: "0 26px 80px rgba(126, 88, 45, 0.16)",
        glow: "0 0 0 1px rgba(190, 140, 83, 0.16), 0 18px 48px rgba(190, 140, 83, 0.2)"
      },
      fontFamily: {
        display: ["Baskerville", "Iowan Old Style", "Times New Roman", "Songti SC", "serif"],
        body: ["Charter", "Georgia", "PingFang SC", "Hiragino Sans GB", "serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
