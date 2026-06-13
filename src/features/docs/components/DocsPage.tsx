/**
 * In-app product guide (#/docs) — a single scrolling page with a sticky section
 * nav. All copy lives in `docsContent.ts`; this file only lays it out with the
 * shared Reverie primitives (PageHeader / IconTile / Card).
 * App-map panels navigate to their workspace through the same gated handler as
 * the header create buttons, so guests get the login modal instead of a dead end.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
    BookOpenText,
    Compass,
    Images,
    Info,
    Search,
    Server,
    ShieldCheck,
    Swords,
    Users,
} from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import type { PageType } from '@/shared'
import {
    Badge,
    Button,
    Card,
    Icon,
    IconTile,
    PageHeader,
    SectionHeader,
    Tag,
    cx,
} from '@/ui/primitives'
import {
    BEST_PRACTICES,
    CARD_GUIDE,
    LIBRARY_GUIDE,
    MAP_ITEMS,
    MEDIA_GUIDE,
    PLAY_GUIDE,
    PRIMARY_ACTIONS,
    QUICK_START,
    SECTIONS,
    UTILITY_ITEMS,
    WRITING_GUIDE,
    type GuideItem,
} from './docsContent'

function activateOnKey(handler: () => void) {
    return (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }
}

export function DocsPage() {
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
    const visibleSections = useRef<Set<string>>(new Set())
    const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return

        visibleSections.current = new Set()
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visibleSections.current.add(entry.target.id)
                    else visibleSections.current.delete(entry.target.id)
                }

                const topmostVisible = SECTIONS.find((section) => visibleSections.current.has(section.id))
                if (topmostVisible) setActiveSection(topmostVisible.id)
            },
            { rootMargin: '-96px 0px -58% 0px', threshold: 0 },
        )

        for (const section of SECTIONS) {
            const element = document.getElementById(section.id)
            if (element) observer.observe(element)
        }

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        navButtonRefs.current[activeSection]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }, [activeSection])

    const goToSection = (id: string) => {
        setActiveSection(id)
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const goToPage = (page: PageType, gated?: boolean) => {
        if (gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(page)
    }

    return (
        <div className="relative w-full">
            <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
                <PageHeader
                    eyebrow="Product guide"
                    title="Magic Worlds Docs"
                    subtitle="Learn the app from the inside: where to start, what each workspace is for, and how to turn cards into adventures, chats, stories, lore, media, and reusable worlds."
                    size="lg"
                    icon={<IconTile icon={Info} tone="arcane" size="md" />}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            {PRIMARY_ACTIONS.map((action) => (
                                <Button
                                    key={action.page}
                                    kind={action.page === 'adventure' ? 'primary' : 'secondary'}
                                    size="sm"
                                    iconLeft={<Icon icon={action.icon} size={15} />}
                                    onClick={() => goToPage(action.page, action.gated)}
                                >
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    }
                />

                <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <nav
                            aria-label="Docs sections"
                            className="flex gap-2 overflow-x-auto rounded-xl border border-parchment-50/10 bg-ink-900/55 p-2 lg:flex-col lg:overflow-visible"
                        >
                            {SECTIONS.map((section) => {
                                const active = activeSection === section.id
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => goToSection(section.id)}
                                        ref={(element) => {
                                            navButtonRefs.current[section.id] = element
                                        }}
                                        aria-current={active ? 'location' : undefined}
                                        className={cx(
                                            'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left font-ui text-[13px] font-semibold transition-all',
                                            active
                                                ? 'bg-ember-500/20 text-ember-200 shadow-[inset_3px_0_0_var(--color-ember-400)]'
                                                : 'text-parchment-300 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                                        )}
                                    >
                                        <Icon icon={section.icon} size={15} />
                                        <span>{section.label}</span>
                                    </button>
                                )
                            })}
                        </nav>
                    </aside>

                    <main className="flex min-w-0 flex-col gap-8">
                        <GuideSection
                            id="start"
                            icon={Compass}
                            eyebrow="Where to start"
                            title="A practical first path"
                            intro="Magic Worlds works best when you build a small, useful foundation and then expand from actual play."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {QUICK_START.map((item, index) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={`${index + 1}. ${item.title}`}>
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="map"
                            icon={Info}
                            eyebrow="Navigation"
                            title="What every rail item is for"
                            intro="The left rail separates libraries from utilities, and it collapses when you want more room. Library items open searchable galleries — creators open from each gallery's New button or the dashboard. The lower cluster is for status, docs, tasks, source, and account."
                        >
                            <SectionHeader icon={Compass} title="Primary workspaces" />
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {MAP_ITEMS.map((item) => (
                                    <MapPanel
                                        key={item.title}
                                        icon={item.icon}
                                        title={item.title}
                                        tone={item.tone}
                                        tag={item.tag}
                                        onOpen={() => goToPage(item.page, item.gated)}
                                    >
                                        {item.body}
                                    </MapPanel>
                                ))}
                            </div>

                            <SectionHeader icon={Server} title="Utility rail" />
                            <div className="grid gap-3 sm:grid-cols-2">
                                {UTILITY_ITEMS.map((item) => (
                                    <UtilityRow key={item.title} icon={item.icon} title={item.title} tone={item.tone} tag={item.tag}>
                                        {item.body}
                                    </UtilityRow>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="library"
                            icon={Search}
                            eyebrow="Libraries"
                            title="Find your work"
                            intro="Everything you make lands in a gallery. Search, deep links, and the dashboard sweep keep even a large library one step away."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {LIBRARY_GUIDE.map((item) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={item.title}>
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="cards"
                            icon={Users}
                            eyebrow="Card creation"
                            title="Build cards that the rest of the app can reuse"
                            intro="Characters, worlds, items, and adventures share the same creation rhythm: edit on the left, review a live preview on the right, ask the assistant for help, add media, then save."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {CARD_GUIDE.map((item) => (
                                    <FeatureCard
                                        key={item.title}
                                        icon={item.icon}
                                        title={item.title}
                                        badge={item.badge}
                                        tone={item.tone}
                                    >
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="play"
                            icon={Swords}
                            eyebrow="Adventures and chat"
                            title="Use the right mode for the scene"
                            intro="Adventure mode is for Game Master-led sessions. Character chat is for direct one-on-one conversations. Both use the same conversation surface, but they carry different context."
                        >
                            <div className="grid gap-4 lg:grid-cols-2">
                                {PLAY_GUIDE.map((item) => (
                                    <FeatureCard
                                        key={item.title}
                                        icon={item.icon}
                                        title={item.title}
                                        badge={item.badge}
                                        tone={item.tone}
                                    >
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="writing"
                            icon={BookOpenText}
                            eyebrow="Lore and prose"
                            tone="arcane"
                            title="Move from interactive play to reusable writing"
                            intro="Lorebooks help the assistant retrieve durable facts. Novels turn cards into authored prose with chapters, context controls, and candidate-based generation."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {WRITING_GUIDE.map((item) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={item.title} tone="arcane">
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="media"
                            icon={Images}
                            eyebrow="Assets"
                            tone="arcane"
                            title="Generate, track, and reuse media"
                            intro="Portraits, covers, and theme songs are attached to cards and collected in the media library. Longer audio jobs continue in the background, and the music dock plays the results anywhere in the app."
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {MEDIA_GUIDE.map((item) => (
                                    <FeatureCard
                                        key={item.title}
                                        icon={item.icon}
                                        title={item.title}
                                        badge={item.badge}
                                        tone="arcane"
                                    >
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="best-practices"
                            icon={ShieldCheck}
                            eyebrow="Recommendations"
                            title="Best practices"
                            intro="These habits keep the library searchable, sessions coherent, and generated work easier to reuse."
                        >
                            <Card className="p-5">
                                <ul className="m-0 grid list-none gap-3 p-0">
                                    {BEST_PRACTICES.map((practice) => (
                                        <li key={practice} className="flex gap-3">
                                            <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-500/15 text-ember-300">
                                                <Icon icon={ShieldCheck} size={12} />
                                            </span>
                                            <span className="font-ui text-sm leading-relaxed text-parchment-200">
                                                {practice}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </GuideSection>
                    </main>
                </div>
            </div>
        </div>
    )
}

function GuideSection({
    id,
    icon,
    eyebrow,
    tone = 'ember',
    title,
    intro,
    children,
}: {
    id: string
    icon: LucideIcon
    eyebrow: string
    tone?: 'ember' | 'arcane'
    title: string
    intro: string
    children: ReactNode
}) {
    return (
        <section id={id} className="scroll-mt-8">
            <div className="mb-4">
                <PageHeader
                    as="h2"
                    size="md"
                    eyebrow={eyebrow}
                    eyebrowTone={tone}
                    title={title}
                    subtitle={intro}
                    icon={<IconTile icon={icon} tone={tone} size="sm" />}
                />
            </div>
            <div className="flex flex-col gap-5">{children}</div>
        </section>
    )
}

function FeatureCard({
    icon,
    title,
    badge,
    tone = 'ember',
    children,
}: Pick<GuideItem, 'icon' | 'title' | 'badge' | 'tone'> & { children: ReactNode }) {
    return (
        <Card className="group p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <IconTile icon={icon} tone={tone} size="sm" glow />
                {badge && <Badge tone={tone}>{badge}</Badge>}
            </div>
            <h3 className="m-0 font-display text-xl font-semibold text-parchment-50">{title}</h3>
            <p className="mt-2 font-ui text-sm leading-relaxed text-parchment-300">{children}</p>
        </Card>
    )
}

function MapPanel({
    icon,
    title,
    tone = 'ember',
    tag,
    onOpen,
    children,
}: {
    icon: LucideIcon
    title: string
    tone?: 'ember' | 'arcane'
    tag?: string
    onOpen: () => void
    children: ReactNode
}) {
    return (
        <Card
            interactive
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onOpen}
            onKeyDown={activateOnKey(onOpen)}
            className="group p-4"
        >
            <div className="mb-2 flex items-center gap-2.5">
                <IconTile icon={icon} tone={tone} size="sm" glow />
                <h3 className="m-0 font-ui text-sm font-semibold text-parchment-50">{title}</h3>
                {tag && <Tag>{tag}</Tag>}
            </div>
            <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">{children}</p>
        </Card>
    )
}

function UtilityRow({
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
    children: ReactNode
}) {
    const toneClass =
        tone === 'live'
            ? 'bg-verdant-500/12 text-verdant-500'
            : tone === 'arcane'
              ? 'bg-arcane-500/15 text-arcane-300'
              : 'bg-parchment-50/[.06] text-parchment-200'

    return (
        <div className="flex gap-3 rounded-lg border border-parchment-50/10 bg-ink-900/45 p-4">
            <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneClass)}>
                <Icon icon={icon} size={16} />
            </span>
            <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                    <h3 className="m-0 font-ui text-sm font-semibold text-parchment-50">{title}</h3>
                    {tag && <Tag>{tag}</Tag>}
                </div>
                <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">{children}</p>
            </div>
        </div>
    )
}
