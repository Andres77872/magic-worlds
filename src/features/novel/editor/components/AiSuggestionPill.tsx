/**
 * AiSuggestionPill — floating Keep/Discard control tracking the end of the
 * live suggestion. Mousedown is swallowed so the editor never blurs; editing
 * anywhere instead of clicking is the implicit accept.
 */

import { Check, X } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'

interface AiSuggestionPillProps {
    anchor: { left: number; top: number }
    onAccept: () => void
    onReject: () => void
}

export function AiSuggestionPill({ anchor, onAccept, onReject }: AiSuggestionPillProps) {
    return (
        <div
            className="absolute z-30 flex items-center gap-1 rounded-full border border-arcane-500/35 bg-ink-700/95 p-1 shadow-lg"
            style={{ left: anchor.left, top: anchor.top }}
            role="toolbar"
            aria-label="Review AI suggestion"
            data-testid="ai-suggestion-pill"
        >
            <PillButton
                className="bg-ember-500 text-on-ember hover:bg-ember-400"
                onClick={onAccept}
                testId="ai-suggestion-accept"
            >
                <Icon icon={Check} size={13} />
                Keep
                <kbd className="font-mono text-[10px] opacity-70">Tab</kbd>
            </PillButton>
            <PillButton
                className="text-parchment-300 hover:bg-parchment-50/[.08] hover:text-parchment-100"
                onClick={onReject}
                testId="ai-suggestion-reject"
            >
                <Icon icon={X} size={13} />
                Discard
                <kbd className="font-mono text-[10px] opacity-70">Esc</kbd>
            </PillButton>
        </div>
    )
}

function PillButton({
    className,
    onClick,
    testId,
    children,
}: {
    className: string
    onClick: () => void
    testId: string
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={cx(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 font-ui text-xs font-semibold transition-colors',
                className,
            )}
            data-testid={testId}
        >
            {children}
        </button>
    )
}
