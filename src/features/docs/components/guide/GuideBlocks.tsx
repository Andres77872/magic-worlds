/**
 * Content blocks for Guide sections. Every text node goes through
 * HighlightText so search matches are marked in place; WIP availability notes
 * render apart from the instructions they qualify instead of prefixing them.
 */
import type { KeyboardEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, CirclePause, ShieldCheck } from 'lucide-react'
import { Badge, Card, Icon, IconTile, Tag, cx } from '@/ui/primitives'
import { HighlightText } from '../HighlightText'
import type { DocsTone, GuideItem } from '../docsContent'

export function AvailabilityNote({ note, className }: { note: string; className?: string }) {
    return (
        <p
            data-availability-note
            className={cx(
                'm-0 flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/[.07] px-3 py-2 font-ui text-caption leading-relaxed text-amber-500',
                className,
            )}
        >
            <Icon icon={CirclePause} size={14} className="mt-px shrink-0" />
            <span className="min-w-0">
                <HighlightText text={note} />
            </span>
        </p>
    )
}

/** Numbered first-path steps; the list carries the order, not the titles. */
export function StepList({ items }: { items: GuideItem[] }) {
    return (
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {items.map((item, index) => (
                <li key={item.title} className="flex min-w-0 gap-4 rounded-xl border border-line-faint bg-surface-raised p-5">
                    <span
                        aria-hidden
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-500/15 font-mono text-label font-semibold text-ember-300 ring-1 ring-inset ring-ember-500/30"
                    >
                        {index + 1}
                    </span>
                    <div className="min-w-0">
                        <h3 className="m-0 flex items-center gap-2 font-display text-xl font-semibold leading-snug text-fg">
                            <HighlightText text={item.title} />
                        </h3>
                        {item.note && <AvailabilityNote note={item.note} className="mt-2" />}
                        <p className="m-0 mt-1.5 font-ui text-body text-fg-muted">
                            <HighlightText text={item.body} />
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    )
}

export function FeatureGrid({ items, tone, wide }: { items: GuideItem[]; tone: DocsTone; wide?: boolean }) {
    return (
        <div className={cx('grid gap-x-8', wide ? 'lg:grid-cols-2' : 'md:grid-cols-2')}>
            {items.map((item) => (
                <FeatureCard key={item.title} item={item} tone={item.tone ?? tone} />
            ))}
        </div>
    )
}

function FeatureCard({ item, tone }: { item: GuideItem; tone: DocsTone }) {
    return (
        <article className="flex min-w-0 gap-4 border-t border-line-faint py-5">
            <IconTile icon={item.icon} tone={tone} size="sm" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <h3 className="m-0 font-display text-xl font-semibold leading-snug text-fg">
                        <HighlightText text={item.title} />
                    </h3>
                    {item.badge && <Badge tone={tone}>{item.badge}</Badge>}
                </div>
                {item.note && <AvailabilityNote note={item.note} className="mt-2" />}
                <p className="m-0 mt-1.5 max-w-[68ch] font-ui text-body text-fg-muted">
                    <HighlightText text={item.body} />
                </p>
            </div>
        </article>
    )
}

function activateOnKey(handler: () => void) {
    return (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }
}

export function MapPanel({
    icon,
    title,
    tone = 'ember',
    tag,
    onOpen,
    children,
}: {
    icon: LucideIcon
    title: string
    tone?: DocsTone
    tag?: string
    onOpen: () => void
    children: string
}) {
    return (
        <Card
            interactive
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onOpen}
            onKeyDown={activateOnKey(onOpen)}
            className="group flex flex-col p-4"
        >
            <div className="mb-2 flex items-center gap-2.5">
                <IconTile icon={icon} tone={tone} size="sm" glow />
                <h3 className="m-0 min-w-0 flex-1 font-ui text-sm font-semibold text-parchment-50">
                    <HighlightText text={title} />
                </h3>
                {tag && <Tag>{tag}</Tag>}
                <Icon
                    icon={ArrowUpRight}
                    size={16}
                    className="shrink-0 text-fg-subtle transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-ember-300"
                />
            </div>
            <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">
                <HighlightText text={children} />
            </p>
        </Card>
    )
}

export function UtilityRow({
    icon,
    title,
    tone = 'neutral',
    tag,
    children,
}: {
    icon: LucideIcon
    title: string
    tone?: 'live' | 'arcane' | 'neutral'
    tag?: string
    children: string
}) {
    const toneClass =
        tone === 'live'
            ? 'bg-verdant-500/12 text-verdant-500'
            : tone === 'arcane'
              ? 'bg-arcane-500/15 text-arcane-300'
              : 'bg-parchment-50/[.06] text-parchment-200'

    return (
        <div className="flex min-w-0 gap-3 border-t border-line-faint py-4">
            <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneClass)}>
                <Icon icon={icon} size={16} />
            </span>
            <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                    <h3 className="m-0 font-ui text-sm font-semibold text-parchment-50">
                        <HighlightText text={title} />
                    </h3>
                    {tag && <Tag>{tag}</Tag>}
                </div>
                <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">
                    <HighlightText text={children} />
                </p>
            </div>
        </div>
    )
}

export function PracticeList({ label, practices }: { label: string; practices: string[] }) {
    return (
        <LabeledCallout label={label} icon={ShieldCheck}>
            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 md:gap-x-8">
                {practices.map((practice) => (
                    <li key={practice} className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-500/15 text-ember-300">
                            <Icon icon={ShieldCheck} size={12} />
                        </span>
                        <span className="font-ui text-sm leading-relaxed text-parchment-200">
                            <HighlightText text={practice} />
                        </span>
                    </li>
                ))}
            </ul>
        </LabeledCallout>
    )
}

function LabeledCallout({ label, icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
    return (
        <div className="rounded-xl border border-ember-500/25 bg-ember-500/[.06] p-5">
            <div className="mb-4 inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-ember-500/20 text-ember-300">
                    <Icon icon={icon} size={13} />
                </span>
                <span className="font-ui text-eyebrow font-semibold uppercase text-ember-300">{label}</span>
            </div>
            {children}
        </div>
    )
}
