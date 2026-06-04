import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './ui/styles/index.css'
import App from './app/App.tsx'

const initializeTheme = () => {
    const stored = localStorage.getItem('magic_worlds:theme')
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
}

initializeTheme()

// Stale key cleanup: remove old auth system keys
const staleKeys = [
    'magic_worlds:access_token',
    'magic_worlds:disclaimer_accepted',
]
for (const key of staleKeys) {
    localStorage.removeItem(key)
}

// If user data exists but no token, it's orphaned — clear it
if (localStorage.getItem('magic_worlds:user') && !localStorage.getItem('magic_worlds:token')) {
    localStorage.removeItem('magic_worlds:user')
}

// Initialize and render the app — no gating, no disclaimer, no token pre-fetching
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
