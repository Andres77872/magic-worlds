import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { loadApplication } from './bootstrap/loadApplication'

const Application = lazy(loadApplication)

export function AppEntry() {
    return (
        <ErrorBoundary scope="bootstrap">
            <Suspense fallback={null}>
                <Application />
            </Suspense>
        </ErrorBoundary>
    )
}
