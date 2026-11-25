import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useUI } from './state'

const applyTheme = () => document.documentElement.setAttribute('data-theme', useUI.getState().theme)
applyTheme()
useUI.subscribe(applyTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
