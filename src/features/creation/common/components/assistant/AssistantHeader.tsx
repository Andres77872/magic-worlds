import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Avatar, IconButton } from '@/ui/primitives'

interface AssistantHeaderProps {
    /** Card title shown under the panel name. */
    cardTitle: string
    streaming: boolean
    /** The conversation menu, rendered to keep its popover anchored in the header. */
    menu: ReactNode
    onClose: () => void
}

export function AssistantHeader({ cardTitle, streaming, menu, onClose }: AssistantHeaderProps) {
    return (
        <header className="flex items-center justify-between gap-2 border-b border-parchment-50/[.08] bg-ink-700 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name="Assistant" size={36} ring="arcane" status={streaming ? 'think' : 'none'} />
                <div className="min-w-0">
                    <h2 className="truncate font-display text-[17px] font-semibold leading-tight text-parchment-50">Card Assistant</h2>
                    <p className="truncate font-ui text-[11px] text-parchment-300">{cardTitle}</p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {menu}
                <IconButton label="Close card assistant" size="sm" onClick={onClose}>
                    <X size={16} />
                </IconButton>
            </div>
        </header>
    )
}
