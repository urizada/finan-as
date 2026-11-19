import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

if (import.meta.env.MODE !== 'teste') import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
