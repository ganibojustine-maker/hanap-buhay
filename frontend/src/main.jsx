import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { LanguageProvider } from './i18n.jsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import './styles/base.css'
import './styles/landing.css'
import './styles/auth.css'
import './styles/dash.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </BrowserRouter>
)
