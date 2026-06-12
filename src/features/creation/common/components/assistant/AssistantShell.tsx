/**
 * Shared shell for floating assistant copilots: the closed-state FAB and the
 * open-state fixed dialog panel. Owns the positioning/z-index/sizing so the
 * card creators and the lorebook studio can never drift apart.
 */
import type { ReactNode } from 'react'
import { MessageCircle } from 'lucide-react'

interface AssistantShellProps {
    open: boolean
    onOpen: () => void
    /** Accessible label for the closed-state FAB, e.g. "Open card assistant". */
    fabLabel: string
    /** Accessible label for the open dialog, e.g. "Card assistant". */
    dialogLabel: string
    children: ReactNode
}

export function AssistantShell({ open, onOpen, fabLabel, dialogLabel, children }: AssistantShellProps) {
    if (!open) {
        return (
            <button
                type="button"
                onClick={onOpen}
                title={dialogLabel}
                aria-label={fabLabel}
                className="fixed bottom-5 right-5 z-50 grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-ember-500 text-on-ember shadow-lg transition-all hover:bg-ember-400 hover:shadow-glow-ember active:scale-[.98]"
            >
                <MessageCircle size={24} />
            </button>
        )
    }

    return (
        <section
            role="dialog"
            aria-label={dialogLabel}
            className="fixed bottom-5 right-5 z-50 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 shadow-xl"
        >
            {children}
        </section>
    )
}
