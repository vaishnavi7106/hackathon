import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/pushNotifications'

// Register SW for push notifications (non-blocking, safe to ignore failures)
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
