import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { AuthProvider } from './services/AuthContext';
import { SpacedRepetitionProvider } from './services/SpacedRepetitionContext';

// Make sure the element with id 'root' exists in your HTML template
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SpacedRepetitionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SpacedRepetitionProvider>
    </AuthProvider>
  </React.StrictMode>
); 