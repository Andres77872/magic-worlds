/**
 * Main application component - simplified and focused
 */

import { AppProvider } from './providers'
import { AppRouter } from './router/AppRouter'

export default function App() {
    return (
        <AppProvider>
            <AppRouter />
        </AppProvider>
    )
}
