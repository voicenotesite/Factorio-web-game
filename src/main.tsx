import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './debug-build';

AuthService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGuard>
      {() => <App />}
    </AuthGuard>
  </StrictMode>
);
import './debug-build';
