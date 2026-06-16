/**
 * In-app product guide (#/docs) — a candlelit landing hero, an in-page search
 * that filters sections, illustrated section banners, and a sticky section nav.
 * All copy lives in `docsContent.ts`; this file lays it out with the shared
 * Reverie primitives (PageHeader / IconTile / Card / Illustration).
 * App-map panels navigate to their workspace through the same gated handler as
 * the header create buttons, so guests get the login modal instead of a dead end.
 *
 * Search filters by HIDING non-matching sections with the HTML `hidden`
 * attribute (they stay mounted), so the IntersectionObserver active-section
 * tracking and `getElementById` anchor scroll keep working untouched.
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
    X,
} from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import { docsHeroArt } from '@/assets/marketing'
import type { PageType } from '@/shared'
import {
    Badge,
    Button,
    Card,
    GlowBackdrop,
    Icon,
    IconTile,
    Illustration,
    PageHeader,
    SectionHeader,
    Tag,
    cx,
} from '@/ui/primitives'
import {
    DOC_SECTION_IDS,
    getDocsContent,
    sectionSearchText,
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
    const [query, setQuery] = useState('')
    const visibleSections = useRef<Set<string>>(new Set())
    const navRef = useRef<HTMLElement | null>(null)
    const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const searchRef = useRef<HTMLInputElement | null>(null)

    // Per-section search haystack, rebuilt only when the language (docs) changes.
    const searchIndex = useMemo(
        () => docs.sections.map((section) => [section.id, sectionSearchText(docs, section.id)] as const),
        [docs],
    )
    const q = query.trim().toLowerCase()
    const filtering = q.length > 0
    const matchedIds = useMemo(
        () =>
            filtering
                ? new Set(searchIndex.filter(([, text]) => text.includes(q)).map(([id]) => id))
                : new Set(DOC_SECTION_IDS),
        [searchIndex, q, filtering],
    )
    const noMatches = filtering && matchedIds.size === 0
    const isHidden = (id: string) => !matchedIds.has(id)

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

    // `/` or Cmd/Ctrl+K focuses search (unless already typing); Esc clears it.
    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            const el = document.activeElement
            const typing =
                el instanceof HTMLInputElement ||
                el instanceof HTMLTextAreaElement ||
                (el instanceof HTMLElement && el.isContentEditable)
            if (event.key === '/' && !typing) {
                event.preventDefault()
                searchRef.current?.focus()
            } else if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                searchRef.current?.focus()
            } else if (event.key === 'Escape' && el === searchRef.current) {
                setQuery('')
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const goToSection = (id: string) => {
        setActiveSection(id)
        // Jumping to a filtered-out section clears the filter first so the target
        // is laid out before we measure/scroll to it.
        if (isHidden(id)) {
            setQuery('')
            requestAnimationFrame(() => scrollDocsSectionIntoView(id))
        } else {
            scrollDocsSectionIntoView(id)
        }
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
                <section className="relative overflow-hidden rounded-2xl border border-parchment-50/10">
                    <img
                        src={docsHeroArt}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full object-cover opacity-[.22]"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/85 to-ink-900/60"
                    />
                    <GlowBackdrop variant="hero" />
                    <div className="relative p-6 sm:p-8">
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
                                            variant={action.page === 'adventure' ? 'primary' : 'secondary'}
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
                        <div className="mt-5 max-w-[460px]">
                            <div className="relative">
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-parchment-400"
                                >
                                    <Icon icon={Search} size={16} />
                                </span>
                                <input
                                    ref={searchRef}
                                    type="search"
                                    aria-label={docs.search.label}
                                    placeholder={docs.search.placeholder}
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    className="h-11 w-full rounded-md border border-parchment-50/[.12] bg-ink-900/70 pl-9 pr-9 font-ui text-sm text-parchment-50 transition-colors placeholder:text-parchment-400 focus:border-ember-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
                                />
                                {query && (
                                    <button
                                        type="button"
                                        aria-label={docs.search.clear}
                                        onClick={() => setQuery('')}
                                        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-parchment-400 transition-colors hover:bg-parchment-50/[.06] hover:text-parchment-50"
                                    >
                                        <Icon icon={X} size={15} />
                                    </button>
                                )}
                            </div>
                            <p className="mt-1.5 font-ui text-[12px] text-parchment-500">{docs.search.shortcutHint}</p>
                        </div>
                    </div>
                </section>

                <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <nav
                            ref={navRef}
                            aria-label={docs.navAriaLabel}
                            className="flex gap-2 overflow-x-auto rounded-xl border border-parchment-50/10 bg-ink-900/55 p-2 lg:flex-col lg:overflow-visible"
                        >
                            {docs.sections.map((section) => {
                                const active = activeSection === section.id
                                const dim = filtering && isHidden(section.id)
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
                                            dim && 'opacity-40',
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
                        {noMatches && (
                            <Card className="p-8 text-center">
                                <h2 className="m-0 font-display text-xl font-semibold text-parchment-50">
                                    {docs.search.empty.title}
                                </h2>
                                <p className="mt-2 font-ui text-sm leading-relaxed text-parchment-300">
                                    {docs.search.empty.body}
                                </p>
                            </Card>
                        )}

                        <GuideSection
                            id="start"
                            icon={Compass}
                            eyebrow={getSection('start').eyebrow}
                            title={getSection('start').title}
                            intro={getSection('start').intro}
                            hidden={isHidden('start')}
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
                            art={getSection('map').art}
                            hidden={isHidden('map')}
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
                            art={getSection('library').art}
                            hidden={isHidden('library')}
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
                            art={getSection('cards').art}
                            hidden={isHidden('cards')}
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
                            art={getSection('play').art}
                            hidden={isHidden('play')}
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
                            art={getSection('voice-presets').art}
                            hidden={isHidden('voice-presets')}
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
                            art={getSection('voice').art}
                            hidden={isHidden('voice')}
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
                            art={getSection('writing').art}
                            hidden={isHidden('writing')}
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
                            art={getSection('media').art}
                            hidden={isHidden('media')}
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
                            art={getSection('best-practices').art}
                            hidden={isHidden('best-practices')}
                        >
                            <Callout label={docs.callout.bestPracticesLabel} icon={ShieldCheck}>
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
                            </Callout>
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
    art,
    hidden,
    children,
}: {
    id: string
    icon: LucideIcon
    eyebrow: string
    tone?: 'ember' | 'arcane'
    title: string
    intro: string
    art?: string
    hidden?: boolean
    children: ReactNode
}) {
    return (
        <section id={id} hidden={hidden} className="scroll-mt-8">
            {art && (
                <Illustration
                    src={art}
                    alt={title}
                    aspect="aspect-[16/5]"
                    ring={tone}
                    vignette
                    className="mb-5"
                />
            )}
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

function Callout({
    label,
    icon,
    tone = 'ember',
    children,
}: {
    label: string
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
    children: ReactNode
}) {
    const arcane = tone === 'arcane'
    return (
        <div
            className={cx(
                'rounded-xl border p-5',
                arcane ? 'border-arcane-500/25 bg-arcane-500/[.06]' : 'border-ember-500/25 bg-ember-500/[.06]',
            )}
        >
            <div className="mb-3 inline-flex items-center gap-2">
                <span
                    className={cx(
                        'inline-flex h-6 w-6 items-center justify-center rounded-md',
                        arcane ? 'bg-arcane-500/20 text-arcane-300' : 'bg-ember-500/20 text-ember-300',
                    )}
                >
                    <Icon icon={icon} size={13} />
                </span>
                <span
                    className={cx(
                        'font-ui text-[12px] font-semibold uppercase tracking-[0.16em]',
                        arcane ? 'text-arcane-300' : 'text-ember-300',
                    )}
                >
                    {label}
                </span>
            </div>
            {children}
        </div>
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
