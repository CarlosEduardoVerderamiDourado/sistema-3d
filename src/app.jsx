import React from "react";
import PartsViewer3D from "./PartsViewer3D.jsx"; // O componente principal

function App() {
  return (
    <div className="w-full h-screen bg-gray-900 text-white">
      {/* Ocupa 100% da tela e renderiza o visualizador 3D */}
      <PartsViewer3D />
    </div>
  );
}

export default App;