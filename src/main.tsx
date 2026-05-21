import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthGuard } from './services/auth/AuthGuard';
import { AuthService } from './services/auth/AuthService';
import './index.css';

AuthService.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGuard>
      {() => <App />}
    </AuthGuard>
  </StrictMode>
);
