import {StrictMode, useState, useEffect, useRef} from 'react'
import {createRoot} from 'react-dom/client'
import './ui/styles/index.css'
import App from './app/App.tsx'
import { tokenService } from './infrastructure'
import { DisclaimerModal } from './ui/components'

const initializeTheme = () => {
    const stored = localStorage.getItem('magic_worlds:theme')
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
}

initializeTheme()

// App wrapper component to handle disclaimer modal
function AppWrapper() {
    const [showDisclaimer, setShowDisclaimer] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const initStarted = useRef(false)

    useEffect(() => {
        // Guard against StrictMode double-render
        if (initStarted.current) {
            return
        }
        initStarted.current = true
        
        const initializeApp = async () => {
            const shouldShowDisclaimer = tokenService.shouldShowDisclaimer()
            
            if (shouldShowDisclaimer) {
                setShowDisclaimer(true)
                setIsInitialized(true)
            } else {
                try {
                    await initializeProvisionalToken()
                } catch (error) {
                    console.error('Failed to initialize provisional token:', error)
                }
                setIsInitialized(true)
            }
        }
        
        initializeApp()
    }, [])

    const initializeProvisionalToken = async () => {
        try {
            await tokenService.ensureProvisionalToken()
        } catch (error) {
            console.error('Failed to initialize provisional token:', error)
            // Continue with app initialization even if token fetch fails
            // The app should still be functional for basic operations
        }
    }

    const handleDisclaimerAccept = async () => {
        tokenService.setDisclaimerAccepted()
        setShowDisclaimer(false)
        await initializeProvisionalToken()
    }

    const handleDisclaimerReject = () => {
        // DisclaimerModal handles the redirect internally
    }

    if (!isInitialized) {
        return null // or a loading spinner
    }

    return (
        <>
            {!showDisclaimer && <App />}
            <DisclaimerModal 
                isOpen={showDisclaimer}
                onAccept={handleDisclaimerAccept}
                onReject={handleDisclaimerReject}
            />
        </>
    )
}

// Initialize and render the app
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AppWrapper />
    </StrictMode>,
)
