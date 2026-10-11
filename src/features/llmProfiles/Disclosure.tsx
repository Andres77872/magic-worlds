/**
 * Collapsible section used by the LLM profile screens: a full-width header
 * button (title, one-line hint, optional trailing badge) that expands a body.
 * The body stays mounted but `hidden` while collapsed, so unsaved input
 * inside it (and its validity) survives collapsing.
 */
import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'

interface DisclosureProps {
    title: ReactNode
    hint?: ReactNode
    /** Trailing node in the header, e.g. a count badge. */
    trailing?: ReactNode
    defaultOpen?: boolean
    /** Heading level for the title, to match the surrounding outline. */
    as?: 'h2' | 'h3' | 'h4'
    tone?: 'default' | 'danger'
    className?: string
    children: ReactNode
}

export function Disclosure({ title, hint, trailing, defaultOpen = false, as: Heading = 'h3', tone = 'default', className, children }: DisclosureProps) {
    const [open, setOpen] = useState(defaultOpen)
    const bodyId = useId()
    return <section className={cx('rounded-lg border bg-surface-raised/40',
        tone === 'danger' ? 'border-blood-500/30' : 'border-line-faint', className)}>
        <Heading className="m-0">
            <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}
                className="flex w-full min-w-0 items-start justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-parchment-50/[.03]">
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cx('font-ui text-sm font-semibold', tone === 'danger' ? 'text-blood-300' : 'text-parchment-50')}>{title}</span>
                    {hint && <span className="font-ui text-caption font-normal text-parchment-300">{hint}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                    {trailing}
                    <Icon icon={ChevronDown} size={16} className={cx('text-parchment-400 transition-transform', open && 'rotate-180')} />
                </span>
            </button>
        </Heading>
        <div id={bodyId} hidden={!open} className="flex flex-col gap-4 border-t border-line-faint px-4 py-4">{children}</div>
    </section>
}
