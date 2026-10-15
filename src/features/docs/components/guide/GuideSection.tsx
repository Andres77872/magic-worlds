/**
 * One Guide section. Search hides non-matching sections with the HTML `hidden`
 * attribute (they stay mounted) so scroll-spy observers and anchor scrolling
 * keep working. The title takes `tabIndex={-1}` so a jump can move focus to it.
 */
import type { ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { Icon, IconTile, Illustration, PageHeader } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import type { NavSection } from '../docsContent'
import { AvailabilityNote } from './GuideBlocks'

interface GuideSectionProps {
    section: NavSection
    hidden?: boolean
    /** Narrow layouts only: the TOC is not sticky there, so offer the way back. */
    backToTop?: { label: string; onClick: () => void }
    children: ReactNode
}

export function GuideSection({ section, hidden, backToTop, children }: GuideSectionProps) {
    return (
        <section
            id={section.id}
            hidden={hidden}
            aria-labelledby={`${section.id}-title`}
            className="scroll-mt-8 border-t border-line-faint pt-8 first:border-t-0 first:pt-0"
        >
            {section.art && (
                <Illustration src={section.art} alt="" aspect="aspect-[16/5]" ring={section.tone} vignette className="mb-5" />
            )}
            <div className="mb-4 flex flex-col gap-3">
                <PageHeader
                    as="h2"
                    size="md"
                    eyebrow={section.eyebrow}
                    eyebrowTone={section.tone}
                    title={
                        <span id={`${section.id}-title`} tabIndex={-1}>
                            <HighlightText text={section.title} />
                        </span>
                    }
                    subtitle={<HighlightText text={section.intro} />}
                    icon={<IconTile icon={section.icon} tone={section.tone} size="sm" />}
                />
                {section.note && <AvailabilityNote note={section.note} className="max-w-prose" />}
            </div>
            <div className="flex flex-col gap-5">{children}</div>
            {backToTop && (
                <button
                    type="button"
                    onClick={backToTop.onClick}
                    className="mt-6 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 font-ui text-label font-semibold text-fg-subtle transition-colors hover:bg-parchment-50/[.05] hover:text-fg"
                >
                    <Icon icon={ArrowUp} size={14} />
                    {backToTop.label}
                </button>
            )}
        </section>
    )
}
