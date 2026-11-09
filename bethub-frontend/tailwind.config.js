/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#040906",
          900: "#07110c",
          850: "#0a1711",
          800: "#0e2017",
          700: "#143024",
          600: "#1c4130",
        },
        lime: {
          DEFAULT: "#c8ff3d",
          soft: "#dcff86",
          deep: "#a8e817",
        },
        mint: "#00e28a",
        coral: "#ff6b6b",
        sky: "#5cc8ff",
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(200,255,61,.18), 0 18px 60px -20px rgba(200,255,61,.35)",
        card: "0 24px 70px -40px rgba(0,0,0,.9)",
      },
      keyframes: {
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        floatUp: {
          "0%": { transform: "translateY(20px) scale(.8)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(-180px) scale(1.25)", opacity: "0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".35", transform: "scale(.75)" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ticker: "ticker 42s linear infinite",
        floatUp: "floatUp 2.6s ease-out forwards",
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
        riseIn: "riseIn .35s ease-out both",
      },
    },
  },
  plugins: [],
};
