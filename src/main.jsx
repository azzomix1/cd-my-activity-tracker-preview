import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthSessionProvider } from './auth/sessionContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthSessionProvider>
      <App />
    </AuthSessionProvider>
  </StrictMode>,
)
