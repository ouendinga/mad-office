import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Fuentes servidas desde aquí (nada de Google Fonts: no se avisa a terceros de cada visita).
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/press-start-2p/latin-400.css';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
