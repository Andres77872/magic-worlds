import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Avatar, IconButton } from '@/ui/primitives'

interface AssistantHeaderProps {
    title?: string
    /** Current document title shown under the panel name. */
    cardTitle: string
    streaming: boolean
    /** The conversation menu, rendered to keep its popover anchored in the header. */
    menu: ReactNode
    onClose: () => void
    closeLabel?: string
}

export function AssistantHeader({ title = 'Card Assistant', cardTitle, streaming, menu, onClose, closeLabel = 'Close card assistant' }: AssistantHeaderProps) {
    return (
        <header className="flex items-center justify-between gap-2 border-b border-parchment-50/[.08] bg-ink-700 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name="Assistant" size={36} ring="arcane" status={streaming ? 'think' : 'none'} />
                <div className="min-w-0">
                    <h2 className="truncate font-display text-[17px] font-semibold leading-tight text-parchment-50">{title}</h2>
                    <p className="truncate font-ui text-[11px] text-parchment-300">{cardTitle}</p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {menu}
                <IconButton label={closeLabel} size="sm" onClick={onClose}>
                    <X size={16} />
                </IconButton>
            </div>
        </header>
    )
}
