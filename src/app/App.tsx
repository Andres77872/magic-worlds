/**
 * Main application component - simplified and focused
 */

import { AppProvider } from './providers'
import { AppRouter } from './router/AppRouter'
import { ErrorBoundary } from './ErrorBoundary'

export default function App() {
    return (
        <ErrorBoundary scope="root">
            <AppProvider>
                <AppRouter />
            </AppProvider>
        </ErrorBoundary>
    )
}
