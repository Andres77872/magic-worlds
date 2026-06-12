import { LoaderCircle } from 'lucide-react'

export function LandingLoading() {
    return (
        <div
            className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-800"
            role="status"
            aria-live="polite"
        >
            <LoaderCircle
                size={64}
                strokeWidth={1.75}
                className="animate-spin text-ember-500"
                aria-hidden="true"
            />
            <p className="text-center text-narrative font-medium text-parchment-200">
                Summoning your magical worlds...
            </p>
        </div>
    )
}
