/**
 * StudioSectionNav — sticky in-page nav for the Creator Studio's editor column.
 *
 * Renders one Chip per section; clicking scrolls to that section's anchor and an
 * IntersectionObserver highlights the section currently in view. Click-to-scroll
 * works even if the observer never fires, so it degrades gracefully.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { Chip, Icon } from '@/ui/primitives'

export interface StudioNavItem {
    id: string
    label: string
    icon?: LucideIcon
}

export interface StudioSectionNavProps {
    items: StudioNavItem[]
}

export function StudioSectionNav({ items }: StudioSectionNavProps) {
    const { t } = useTranslation()
    const [active, setActive] = useState<string | undefined>(items[0]?.id)
    const visible = useRef<Set<string>>(new Set())

    useEffect(() => {
        visible.current = new Set()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.current.add(entry.target.id)
                    else visible.current.delete(entry.target.id)
                }
                // Highlight the first (topmost in document order) visible section.
                const topmost = items.find((it) => visible.current.has(it.id))
                if (topmost) setActive(topmost.id)
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
        )
        items.forEach((it) => {
            const el = document.getElementById(it.id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [items])

    const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    return (
        <nav aria-label={t('creation.common.studio.sectionsNav')} className="flex flex-wrap gap-2">
            {items.map((it) => (
                <Chip
                    key={it.id}
                    active={active === it.id}
                    onClick={() => go(it.id)}
                    icon={it.icon ? <Icon icon={it.icon} size={13} /> : undefined}
                >
                    {it.label}
                </Chip>
            ))}
        </nav>
    )
}
