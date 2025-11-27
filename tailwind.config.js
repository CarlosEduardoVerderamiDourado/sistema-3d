// tailwind.config.js
export default {
  content: [
    "./index.html",
    // Esta linha agora cobre todos os seus arquivos dentro de src/, incluindo PartsViewer3D.jsx e index.css
    "./src/**/*.{js,ts,jsx,tsx,css}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}