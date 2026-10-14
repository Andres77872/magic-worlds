import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeader } from '@/ui/primitives'

interface ConsoleSectionProps {
    icon?: LucideIcon
    title: string
    description?: string
    right?: ReactNode
    children: ReactNode
}

/** A console module frame: heading, one-line description, body. */
export function ConsoleSection({ icon, title, description, right, children }: ConsoleSectionProps) {
    return (
        <section className="flex flex-col gap-4" aria-label={title}>
            <div className="flex flex-col gap-1.5">
                <SectionHeader icon={icon} title={title} right={right} />
                {description && <p className="max-w-[80ch] font-ui text-[13px] leading-relaxed text-parchment-300">{description}</p>}
            </div>
            {children}
        </section>
    )
}
