// src/main.jsx (APÓS MOVER ARQUIVOS)

import React from 'react'
import ReactDOM from 'react-dom/client'
// 🛑 IMPORTAÇÃO CORRETA: O arquivo agora está na mesma pasta.
import App from './PartsViewer3D.jsx' 
import './index.css' // O CSS também está na mesma pasta.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)