import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './fonts.css';
import './styles.css';

// Отметка для сторожа в index.html: код дошёл до запуска, чёрного экрана не будет.
window.__radiBooted = true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
