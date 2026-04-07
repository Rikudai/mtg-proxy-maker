/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				serif: ["MPlantin", "Merriweather", "serif"],
				sans: ["Inter", "system-ui", "sans-serif"],
				beleren: ["Beleren", "serif"],
			},
			colors: {
				mtg: {
					white: "#f9faf4",
					blue: "#0e68ab",
					black: "#150b00",
					red: "#d3202a",
					green: "#00733e",
					gold: "#D97706",
					stone: {
						50: "#fafaf9",
						100: "#f5f5f4",
						200: "#e7e5e4",
						300: "#d6d3d1",
						400: "#a8a29e",
						500: "#78716c",
						600: "#57534e",
						700: "#44403c",
						800: "#292524",
						900: "#1c1917",
						950: "#0c0a09",
					}
				}
			},
			boxShadow: {
				'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
				'glow-blue': '0 0 15px rgba(14, 104, 171, 0.5)',
				'glow-gold': '0 0 15px rgba(217, 119, 6, 0.5)',
			},
			backdropBlur: {
				xs: '2px',
			}
		},
	},
	daisyui: {
		themes: [
			{
				mtg: {
					primary: "#0e68ab", // Default to Blue for primary
					secondary: "#78716c",
					accent: "#D97706",
					neutral: "#1c1917",
					"base-100": "#0c0a09", // Deep dark base
					"info": "#0e68ab",
					"success": "#00733e",
					"warning": "#D97706",
					"error": "#d3202a",
				},
			},
		],
	},
	plugins: [require("@tailwindcss/container-queries"), require("daisyui")],
};
