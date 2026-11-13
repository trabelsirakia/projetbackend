import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4500,
            style: {
              borderRadius: '10px', border: '1px solid var(--color-tw-line)', background: 'var(--color-tw-surface)', color: 'var(--color-tw-ink)',
              fontFamily: '"IBM Plex Sans", sans-serif', fontSize: '14px', boxShadow: 'var(--shadow-lift)',
            },
            success: { iconTheme: { primary: 'var(--color-tw-success)', secondary: 'var(--color-tw-surface)' } },
            error: { iconTheme: { primary: 'var(--color-tw-danger)', secondary: 'var(--color-tw-surface)' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
