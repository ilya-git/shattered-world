import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Scale the fixed 1040×700 frame to fit the window (from the design handoff).
function fit(): void {
  const s = Math.min(window.innerWidth / 1040, window.innerHeight / 700) * 0.96;
  const frame = document.getElementById('frame');
  if (frame) frame.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();
setTimeout(fit, 300);
