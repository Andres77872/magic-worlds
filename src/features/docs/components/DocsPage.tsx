/**
 * In-app product guide (#/docs) — a single scrolling page with a sticky section
 * nav. All copy lives in `docsContent.ts`; this file only lays it out with the
 * shared Reverie primitives (PageHeader / IconTile / Card).
 * App-map panels navigate to their workspace through the same gated handler as
 * the header create buttons, so guests get the login modal instead of a dead end.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
    AudioLines,
    BookOpenText,
    Compass,
    Images,
    Info,
    Mic,
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
    DOC_SECTION_IDS,
    getDocsContent,
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

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function scrollDocsSectionIntoView(id: string) {
    const target = document.getElementById(id)
    if (!target) return

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    const scroller = document.querySelector<HTMLElement>('[data-app-main]')
    if (!scroller) {
        target.scrollIntoView({ behavior, block: 'start' })
        return
    }

    const scrollerRect = scroller.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0
    const top = scroller.scrollTop + targetRect.top - scrollerRect.top - scrollMarginTop

    scroller.scrollTo({ top: Math.max(0, top), left: 0, behavior })
}

function scrollNavButtonInlineIntoView(nav: HTMLElement | null, button: HTMLButtonElement | null) {
    if (!nav || !button || nav.scrollWidth <= nav.clientWidth) return

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'
    const navRect = nav.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const overflowLeft = buttonRect.left - navRect.left
    const overflowRight = buttonRect.right - navRect.right

    if (overflowLeft < 0) {
        nav.scrollTo({ left: nav.scrollLeft + overflowLeft, behavior })
    } else if (overflowRight > 0) {
        nav.scrollTo({ left: nav.scrollLeft + overflowRight, behavior })
    }
}

export function DocsPage() {
    const { t } = useTranslation()
    const docs = useMemo(() => getDocsContent(t), [t])
    const sectionById = useMemo(() => new Map(docs.sections.map((section) => [section.id, section])), [docs.sections])
    const getSection = (id: string) => sectionById.get(id) ?? docs.sections[0]
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const [activeSection, setActiveSection] = useState(DOC_SECTION_IDS[0])
    const visibleSections = useRef<Set<string>>(new Set())
    const navRef = useRef<HTMLElement | null>(null)
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

                const topmostVisible = DOC_SECTION_IDS.find((id) => visibleSections.current.has(id))
                if (topmostVisible) setActiveSection(topmostVisible)
            },
            { rootMargin: '-96px 0px -58% 0px', threshold: 0 },
        )

        for (const id of DOC_SECTION_IDS) {
            const element = document.getElementById(id)
            if (element) observer.observe(element)
        }

        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        scrollNavButtonInlineIntoView(navRef.current, navButtonRefs.current[activeSection])
    }, [activeSection])

    const goToSection = (id: string) => {
        setActiveSection(id)
        scrollDocsSectionIntoView(id)
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
                    eyebrow={docs.page.eyebrow}
                    title={docs.page.title}
                    subtitle={docs.page.subtitle}
                    size="lg"
                    icon={<IconTile icon={Info} tone="arcane" size="md" />}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            {docs.primaryActions.map((action) => (
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
                            ref={navRef}
                            aria-label={docs.navAriaLabel}
                            className="flex gap-2 overflow-x-auto rounded-xl border border-parchment-50/10 bg-ink-900/55 p-2 lg:flex-col lg:overflow-visible"
                        >
                            {docs.sections.map((section) => {
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
                            eyebrow={getSection('start').eyebrow}
                            title={getSection('start').title}
                            intro={getSection('start').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.quickStart.map((item, index) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={`${index + 1}. ${item.title}`}>
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="map"
                            icon={Info}
                            eyebrow={getSection('map').eyebrow}
                            title={getSection('map').title}
                            intro={getSection('map').intro}
                        >
                            <SectionHeader icon={Compass} title={docs.mapHeadings.primaryWorkspaces} />
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {docs.mapItems.map((item) => (
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

                            <SectionHeader icon={Server} title={docs.mapHeadings.utilityRail} />
                            <div className="grid gap-3 sm:grid-cols-2">
                                {docs.utilityItems.map((item) => (
                                    <UtilityRow key={item.title} icon={item.icon} title={item.title} tone={item.tone} tag={item.tag}>
                                        {item.body}
                                    </UtilityRow>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="library"
                            icon={Search}
                            eyebrow={getSection('library').eyebrow}
                            title={getSection('library').title}
                            intro={getSection('library').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.libraryGuide.map((item) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={item.title}>
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="cards"
                            icon={Users}
                            eyebrow={getSection('cards').eyebrow}
                            title={getSection('cards').title}
                            intro={getSection('cards').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.cardGuide.map((item) => (
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
                            eyebrow={getSection('play').eyebrow}
                            title={getSection('play').title}
                            intro={getSection('play').intro}
                        >
                            <div className="grid gap-4 lg:grid-cols-2">
                                {docs.playGuide.map((item) => (
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
                            id="voice-presets"
                            icon={AudioLines}
                            eyebrow={getSection('voice-presets').eyebrow}
                            title={getSection('voice-presets').title}
                            intro={getSection('voice-presets').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.voicePresetGuide.map((item) => (
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
                            id="voice"
                            icon={Mic}
                            eyebrow={getSection('voice').eyebrow}
                            title={getSection('voice').title}
                            intro={getSection('voice').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.voiceGuide.map((item) => (
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
                            eyebrow={getSection('writing').eyebrow}
                            tone="arcane"
                            title={getSection('writing').title}
                            intro={getSection('writing').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.writingGuide.map((item) => (
                                    <FeatureCard key={item.title} icon={item.icon} title={item.title} tone="arcane">
                                        {item.body}
                                    </FeatureCard>
                                ))}
                            </div>
                        </GuideSection>

                        <GuideSection
                            id="media"
                            icon={Images}
                            eyebrow={getSection('media').eyebrow}
                            tone="arcane"
                            title={getSection('media').title}
                            intro={getSection('media').intro}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                {docs.mediaGuide.map((item) => (
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
                            eyebrow={getSection('best-practices').eyebrow}
                            title={getSection('best-practices').title}
                            intro={getSection('best-practices').intro}
                        >
                            <Card className="p-5">
                                <ul className="m-0 grid list-none gap-3 p-0">
                                    {docs.bestPractices.map((practice) => (
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
