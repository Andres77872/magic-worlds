import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
    BookOpen,
    BookOpenText,
    Code2,
    Compass,
    Gem,
    Globe,
    Images,
    Info,
    ListChecks,
    MessageCircle,
    Music2,
    Save,
    Search,
    Server,
    ShieldCheck,
    Sparkles,
    Swords,
    Tags,
    UserCircle,
    Users,
    Wand2,
} from 'lucide-react'
import { useAuth, useNavigation } from '@/app/hooks'
import type { PageType } from '@/shared'
import { Badge, Button, Card, Icon, PageHeader, SectionHeader, Tag, cx } from '@/ui/primitives'

interface NavSection {
    id: string
    label: string
    icon: LucideIcon
}

interface ActionTarget {
    label: string
    page: PageType
    icon: LucideIcon
    gated?: boolean
}

const SECTIONS: NavSection[] = [
    { id: 'start', label: 'Start here', icon: Compass },
    { id: 'map', label: 'App map', icon: Info },
    { id: 'cards', label: 'Cards', icon: Users },
    { id: 'play', label: 'Play modes', icon: Swords },
    { id: 'writing', label: 'Writing', icon: BookOpenText },
    { id: 'media', label: 'Media and tasks', icon: Images },
    { id: 'best-practices', label: 'Best practices', icon: ShieldCheck },
]

const QUICK_START: Array<{ title: string; body: string; icon: LucideIcon }> = [
    {
        title: 'Begin at Explore',
        body: 'Explore is the front door. New users see a guided entry point; returning users see their dashboard, latest adventures, chats, novels, cast, worlds, and quick create actions.',
        icon: Compass,
    },
    {
        title: 'Make a small cast',
        body: 'Create one character and one world before building a larger adventure. The adventure creator can work without them, but cards give sessions stronger continuity.',
        icon: Users,
    },
    {
        title: 'Turn cards into play',
        body: 'Create an adventure template, choose a cast, optionally choose your persona and world, then begin the adventure from Explore or the Adventures library.',
        icon: Swords,
    },
    {
        title: 'Use tasks for long work',
        body: 'Theme songs compose in the background. The Tasks drawer tracks active, completed, and failed jobs so you can keep using the app while they finish.',
        icon: ListChecks,
    },
]

const PRIMARY_ACTIONS: ActionTarget[] = [
    { label: 'Create character', page: 'character', icon: Users, gated: true },
    { label: 'Create world', page: 'world', icon: Globe, gated: true },
    { label: 'Create item', page: 'item', icon: Gem, gated: true },
    { label: 'Create adventure', page: 'adventure', icon: Swords, gated: true },
]

const LIBRARY_ITEMS: Array<{ title: string; body: string; icon: LucideIcon; tone?: 'ember' | 'arcane' }> = [
    {
        title: 'Explore',
        body: 'Home, onboarding, search, recommendations, in-progress adventures, recent chats, novels, and quick creation.',
        icon: Compass,
        tone: 'ember',
    },
    {
        title: 'Characters',
        body: 'Build cast members with identity, persona, stats, greeting, roleplay direction, triggers, portraits, and theme songs.',
        icon: Users,
    },
    {
        title: 'Worlds',
        body: 'Define settings with a name, type, overview, custom detail groups, triggers, art, and theme songs.',
        icon: Globe,
    },
    {
        title: 'Items',
        body: 'Create relics, tools, keys, treasures, and other story objects with effects, requirements, limits, triggers, art, and theme songs.',
        icon: Gem,
    },
    {
        title: 'Adventures',
        body: 'Create reusable session templates from a scenario, cast, persona, world, objectives, triggers, cover image, and theme.',
        icon: Swords,
        tone: 'ember',
    },
    {
        title: 'Lorebooks',
        body: 'Manage reusable context with activation keys, entries, tags, budgets, attachments, validation, and activation preview.',
        icon: BookOpen,
    },
    {
        title: 'Novels',
        body: 'Draft chaptered prose from a blank project or from selected cards, then use card context and generation tools while writing.',
        icon: BookOpenText,
    },
    {
        title: 'Media',
        body: 'Browse generated images and theme songs across all cards. Filter by media type, card type, or a specific card.',
        icon: Images,
    },
]

const UTILITY_ITEMS: Array<{ title: string; body: string; icon: LucideIcon; tone?: 'live' | 'arcane' | 'neutral' }> = [
    {
        title: 'Status',
        body: 'The server icon shows whether the backend is checking, online, or offline. If it is offline, save-sensitive actions may fail until service returns.',
        icon: Server,
        tone: 'live',
    },
    {
        title: 'Docs',
        body: 'The guide icon opens this page. It is available whether you are signed in or browsing as a guest.',
        icon: Info,
        tone: 'arcane',
    },
    {
        title: 'Tasks',
        body: 'Signed-in users get a task drawer for theme-song jobs. The badge counts active work and the drawer keeps completed and failed jobs visible.',
        icon: ListChecks,
        tone: 'arcane',
    },
    {
        title: 'GitHub',
        body: 'The source icon opens the project repository. It is useful for following development, but not required for normal app use.',
        icon: Code2,
    },
    {
        title: 'Profile',
        body: 'Your avatar opens profile, membership, daily usage, account details, logout, and the delete-all-data action.',
        icon: UserCircle,
    },
]

const CARD_GUIDE: Array<{ title: string; body: string; icon: LucideIcon }> = [
    {
        title: 'Identity fields are anchors',
        body: 'Names, race or species, and world type make cards easy to recognize in libraries, selectors, adventures, stories, and media filters.',
        icon: UserCircle,
    },
    {
        title: 'Long prose shapes behavior',
        body: 'Descriptions, greetings, roleplay direction, world overview, and scenario premise give the assistant and chat engine the material they need.',
        icon: BookOpenText,
    },
    {
        title: 'Attributes stay flexible',
        body: 'Use quick presets when they fit, then add custom groups for stats, details, objectives, factions, locations, rules, or other facts.',
        icon: Wand2,
    },
    {
        title: 'Triggers connect cards to context',
        body: 'Triggers are keywords. Add short names, places, factions, objects, titles, or phrases that should pull a card into a scene or writing context.',
        icon: Tags,
    },
    {
        title: 'Save before leaving',
        body: 'The live preview updates while you edit, but the card is only finalized when you create or update it. Generated media can persist early, but saving keeps the library clean.',
        icon: Save,
    },
]

const PLAY_GUIDE: Array<{ title: string; body: string; icon: LucideIcon; badge?: string }> = [
    {
        title: 'Adventure templates are reusable',
        body: 'An adventure template defines the premise and default context. Starting it creates an in-progress adventure session.',
        icon: Swords,
        badge: 'Adventure',
    },
    {
        title: 'Sessions keep their own copy',
        body: 'Inside a running adventure, edits to the scenario, cast, persona, and world affect that session snapshot instead of changing the original library cards.',
        icon: ShieldCheck,
    },
    {
        title: 'The center panel is the conversation',
        body: 'Send your action or dialogue, wait for the Game Master response, use forward options when shown, regenerate a response when needed, and reset only when you want a clean session.',
        icon: MessageCircle,
        badge: 'Chat engine',
    },
    {
        title: 'Narration is optional',
        body: 'Use Narrate to request audio for Game Master turns. Auto-narrate asks for new narration automatically, but playback still follows browser audio rules.',
        icon: Music2,
    },
    {
        title: 'One-on-one chat uses the same engine',
        body: 'Start a chat from a character card. The sidebar shows the character, greeting, and edit shortcut; the center panel handles the conversation.',
        icon: MessageCircle,
        badge: 'Character chat',
    },
]

const WRITING_GUIDE: Array<{ title: string; body: string; icon: LucideIcon }> = [
    {
        title: 'Lorebooks are reusable memory',
        body: 'Create entries with activation keys, tune matching settings, attach the book where it belongs, and use validation plus activation preview before relying on it in play.',
        icon: BookOpen,
    },
    {
        title: 'Novels are chapter projects',
        body: 'Start from a blank novel or create from cards. Add chapters, draft prose, save often, copy Markdown, and use focus mode when you only want the writing surface.',
        icon: BookOpenText,
    },
    {
        title: 'The Card Codex controls story context',
        body: 'In the novel writer, add characters, worlds, or adventures to the active context. Mention detection helps surface card names and triggers found in the chapter body.',
        icon: Search,
    },
    {
        title: 'Generation is candidate-based',
        body: 'Continue, rewrite, expand, condense, or critique. Generated text appears as a candidate that you can accept, stash, or discard.',
        icon: Sparkles,
    },
]

const MEDIA_GUIDE: Array<{ title: string; body: string; icon: LucideIcon }> = [
    {
        title: 'Images can be generated or uploaded',
        body: 'Use optional art direction to steer a portrait or cover. You can view, replace, remove, or choose an existing image from your gallery.',
        icon: Images,
    },
    {
        title: 'Theme songs run as jobs',
        body: 'A theme needs a saved card target. New cards may auto-save enough to start the job, and the Tasks drawer follows the job while it composes.',
        icon: Music2,
    },
    {
        title: 'Media gallery is the archive',
        body: 'Open Media to find generated images and themes by type or source card. Use it when you want to reuse an asset instead of generating again.',
        icon: Search,
    },
    {
        title: 'Usage lives in Profile',
        body: 'Profile shows credits, membership, per-operation usage, account identity, logout, and the data deletion control.',
        icon: UserCircle,
    },
]

const BEST_PRACTICES: string[] = [
    'Start with one strong character, one clear world, and one short adventure premise before building a large library.',
    'Use specific trigger phrases. "black gate" is more useful than "gate" when you only want one location to activate.',
    'Keep descriptions factual and reusable. Put temporary scene changes in the running adventure session instead of rewriting the original card.',
    'Treat lorebook entries as compact facts. Split large setting documents into smaller entries with precise activation keys.',
    'Save after major edits, before navigating away, and before using generated output as important source material.',
    'Use generated images and themes as iteration tools. Regenerate when the direction is wrong; browse history when the right asset already exists.',
    'Use novels for authored prose and adventures for interactive play. They share cards, but they serve different workflows.',
]

export function DocsPage() {
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const [activeSection, setActiveSection] = useState(SECTIONS[0].id)

    const goToSection = (id: string) => {
        setActiveSection(id)
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const goToPage = (target: ActionTarget) => {
        if (target.gated && !isAuthenticated) {
            openLoginModal()
            return
        }
        setPage(target.page)
    }

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
            <PageHeader
                eyebrow="Product guide"
                title="Magic Worlds Docs"
                subtitle="Learn the app from the inside: where to start, what each workspace is for, and how to turn cards into adventures, chats, stories, lore, media, and reusable worlds."
                size="lg"
                icon={<span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-arcane-500/15 text-arcane-300"><Icon icon={Info} size={22} /></span>}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {PRIMARY_ACTIONS.map((action) => (
                            <Button
                                key={action.page}
                                kind={action.page === 'adventure' ? 'primary' : 'secondary'}
                                size="sm"
                                iconLeft={<Icon icon={action.icon} size={15} />}
                                onClick={() => goToPage(action)}
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
                                    aria-current={active ? 'true' : undefined}
                                    className={cx(
                                        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left font-ui text-[13px] font-semibold transition-colors',
                                        active
                                            ? 'bg-ember-500/15 text-ember-300'
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
                        intro="The left rail separates core libraries from utilities. The top and middle are for creation and content; the lower cluster is for status, docs, tasks, source, and account."
                    >
                        <SectionHeader icon={Compass} title="Primary workspaces" />
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {LIBRARY_ITEMS.map((item) => (
                                <MiniPanel key={item.title} icon={item.icon} title={item.title} tone={item.tone}>
                                    {item.body}
                                </MiniPanel>
                            ))}
                        </div>

                        <SectionHeader icon={Server} title="Utility rail" />
                        <div className="grid gap-3 sm:grid-cols-2">
                            {UTILITY_ITEMS.map((item) => (
                                <UtilityRow key={item.title} icon={item.icon} title={item.title} tone={item.tone}>
                                    {item.body}
                                </UtilityRow>
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
                                <FeatureCard key={item.title} icon={item.icon} title={item.title}>
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
                                    tone={item.badge === 'Character chat' ? 'arcane' : 'ember'}
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
                        title="Generate, track, and reuse media"
                        intro="Portraits, covers, and theme songs are attached to cards and collected in the media library. Longer audio jobs continue in the background."
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            {MEDIA_GUIDE.map((item) => (
                                <FeatureCard key={item.title} icon={item.icon} title={item.title} tone="arcane">
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
                                        <span className="font-ui text-sm leading-relaxed text-parchment-200">{practice}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    </GuideSection>
                </main>
            </div>
        </div>
    )
}

function GuideSection({
    id,
    icon,
    eyebrow,
    title,
    intro,
    children,
}: {
    id: string
    icon: LucideIcon
    eyebrow: string
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
                    eyebrowTone={id === 'writing' || id === 'media' ? 'arcane' : 'ember'}
                    title={title}
                    subtitle={intro}
                    icon={<span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700 text-ember-400"><Icon icon={icon} size={20} /></span>}
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
}: {
    icon: LucideIcon
    title: string
    badge?: string
    tone?: 'ember' | 'arcane'
    children: ReactNode
}) {
    return (
        <Card className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <span
                    className={cx(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        tone === 'arcane' ? 'bg-arcane-500/15 text-arcane-300' : 'bg-ember-500/15 text-ember-400',
                    )}
                >
                    <Icon icon={icon} size={19} />
                </span>
                {badge && <Badge tone={tone}>{badge}</Badge>}
            </div>
            <h3 className="m-0 font-display text-xl font-semibold text-parchment-50">{title}</h3>
            <p className="mt-2 font-ui text-sm leading-relaxed text-parchment-300">{children}</p>
        </Card>
    )
}

function MiniPanel({
    icon,
    title,
    tone = 'ember',
    children,
}: {
    icon: LucideIcon
    title: string
    tone?: 'ember' | 'arcane'
    children: ReactNode
}) {
    return (
        <div className="rounded-lg border border-parchment-50/10 bg-ink-900/45 p-4">
            <div className="mb-2 flex items-center gap-2">
                <span className={tone === 'arcane' ? 'text-arcane-300' : 'text-ember-400'}>
                    <Icon icon={icon} size={16} />
                </span>
                <h3 className="m-0 font-ui text-sm font-semibold text-parchment-50">{title}</h3>
            </div>
            <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">{children}</p>
        </div>
    )
}

function UtilityRow({
    icon,
    title,
    tone = 'neutral',
    children,
}: {
    icon: LucideIcon
    title: string
    tone?: 'live' | 'arcane' | 'neutral'
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
                    {title === 'Tasks' && <Tag>Signed in</Tag>}
                </div>
                <p className="m-0 font-ui text-[13px] leading-relaxed text-parchment-300">{children}</p>
            </div>
        </div>
    )
}
