/**
 * Render-phase safety net. React unmounts the whole tree on an uncaught render
 * exception (a `.map` over a malformed-but-200 payload, a null-deref in a
 * transform) → blank screen. This boundary catches that and shows a recoverable
 * Reverie fallback instead.
 *
 * Two usages:
 *  - Root (in App.tsx) wraps the entire router; last-resort, offers Reload.
 *  - Per-page (in AppRouter, keyed on the current page) so one page's crash
 *    keeps the sidebar/nav/modals alive and resets on navigation.
 *
 * Copy is intentionally hardcoded English (no `t()`): a crash may originate in
 * the i18n layer itself, and the fallback must render regardless.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/ui/primitives'

interface ErrorBoundaryProps {
    children: ReactNode
    /** Identifies which boundary tripped, in the console log. */
    scope?: string
    /** Inline (page-level) fallback instead of the full-screen root fallback. */
    inline?: boolean
}

interface ErrorBoundaryState {
    error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        const tag = this.props.scope ? `[ErrorBoundary:${this.props.scope}]` : '[ErrorBoundary]'
        console.error(tag, error, info.componentStack)
    }

    private handleReload = () => {
        window.location.reload()
    }

    private handleReset = () => {
        this.setState({ error: null })
    }

    render() {
        const { error } = this.state
        if (!error) return this.props.children

        const body = (
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <h1 className="font-display text-[28px] font-semibold text-parchment-50">
                    Something went wrong
                </h1>
                <p className="font-narrative text-[16px] leading-relaxed text-parchment-300">
                    {this.props.inline
                        ? 'This page hit an unexpected error. You can retry it, or reload the app.'
                        : 'The app hit an unexpected error. Reloading usually fixes it.'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    {this.props.inline && (
                        <Button variant="secondary" onClick={this.handleReset}>
                            Try again
                        </Button>
                    )}
                    <Button variant="primary" onClick={this.handleReload}>
                        Reload
                    </Button>
                </div>
            </div>
        )

        if (this.props.inline) {
            return (
                <div className="flex min-h-full flex-1 items-center justify-center p-8">
                    {body}
                </div>
            )
        }

        return (
            <div className="flex min-h-screen items-center justify-center bg-ink-900 p-8 text-parchment-50">
                {body}
            </div>
        )
    }
}
