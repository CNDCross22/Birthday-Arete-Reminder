import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { AccessGate } from './auth/AccessGate.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AccessGate>
        <App />
      </AccessGate>
    </ToastProvider>
  </React.StrictMode>,
)
