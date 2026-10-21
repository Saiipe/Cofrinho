import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { registerServiceWorker } from './pwa';
import { App } from './ui/App';
import { QUICK_MODE } from './ui/quickMode';

if (QUICK_MODE) document.documentElement.classList.add('quick-mode');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
