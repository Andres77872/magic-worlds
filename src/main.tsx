import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './app/i18n'
import './ui/styles/theme.css'
import App from './app/App.tsx'
import { consumeAuthDeepLink } from './app/bootstrap/authDeepLink'

// Turn a provider email link (/auth/password/reset?token=… or
// /auth/email/verify?token=…) into the internal hash route + a stashed token
// BEFORE the navigation provider reads window.location.hash for its first page.
consumeAuthDeepLink()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
