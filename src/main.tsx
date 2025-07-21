import {StrictMode, useState, useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import './ui/styles/index.css'
import App from './app/App.tsx'
import { tokenService } from './infrastructure'
import { DisclaimerModal } from './ui/components'

// App wrapper component to handle disclaimer modal
function AppWrapper() {
    const [showDisclaimer, setShowDisclaimer] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)

    useEffect(() => {
        // Check if disclaimer should be shown
        if (tokenService.shouldShowDisclaimer()) {
            setShowDisclaimer(true)
        } else {
            initializeProvisionalToken()
        }
        setIsInitialized(true)
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
            <App />
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
