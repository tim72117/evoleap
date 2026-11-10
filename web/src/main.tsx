import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { KidsModeProvider } from './kidsMode/KidsModeContext'
import { ScrollToTop } from './site/ScrollToTop'
import './site/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <KidsModeProvider>
          <App />
        </KidsModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
