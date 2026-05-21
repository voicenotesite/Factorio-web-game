import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthService } from './services/auth/AuthService';
import { AuthGuard } from './services/auth/AuthGuard';

AuthService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGuard>
      {() => <App />}
    </AuthGuard>
  </StrictMode>
);
