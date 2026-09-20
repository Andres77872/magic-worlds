/**
 * StudioSectionNav — sticky in-page nav for the Creator Studio's editor column.
 *
 * Renders quiet section links; clicking scrolls to that section's anchor and an
 * IntersectionObserver highlights the section currently in view. Click-to-scroll
 * works even if the observer never fires, so it degrades gracefully.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'

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
            // Matches the desktop anchor clearance, including a wrapped nav.
            // The previous section must leave this band before it can remain active.
            { rootMargin: '-144px 0px -50% 0px', threshold: 0 },
        )
        items.forEach((it) => {
            const el = document.getElementById(it.id)
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
    }, [items])

    const go = (id: string) => {
        const section = document.getElementById(id)
        if (!section) return
        setActive(id)
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }

    return (
        <nav aria-label={t('creation.common.studio.sectionsNav')} className="flex gap-1 overflow-x-auto py-1 lg:flex-wrap">
            {items.map((it) => (
                <Button
                    key={it.id}
                    variant="ghost"
                    size="sm"
                    aria-current={active === it.id ? 'location' : undefined}
                    className="relative min-h-11 shrink-0 after:absolute after:inset-x-3.5 after:bottom-0 after:h-0.5 aria-[current=location]:text-ember-300 aria-[current=location]:after:bg-ember-500"
                    onClick={() => go(it.id)}
                    iconLeft={it.icon ? <Icon icon={it.icon} size={14} /> : undefined}
                >
                    {it.label}
                </Button>
            ))}
        </nav>
    )
}
