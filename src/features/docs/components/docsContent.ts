/**
 * Docs structure — icons, routes, gating, and stable section IDs live here.
 * Display copy is resolved through i18n so the guide follows the active app
 * language without changing anchors or navigation behavior.
 */

import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import {
    AudioLines,
    BookOpen,
    BookOpenText,
    Bot,
    Code2,
    Compass,
    Copy,
    FilePlus2,
    FileText,
    Gauge,
    Gem,
    Globe,
    History,
    Images,
    Info,
    Link2,
    ListChecks,
    ListMusic,
    LogIn,
    MessageCircle,
    Mic,
    MicOff,
    MoreHorizontal,
    Music2,
    Pencil,
    Phone,
    PhoneOff,
    Play,
    Radio,
    Route,
    Save,
    ScanSearch,
    Search,
    Server,
    ShieldCheck,
    Sparkles,
    Swords,
    Tags,
    UserCircle,
    Users,
    Volume2,
    Wand2,
    Waves,
} from 'lucide-react'
import { docsArt } from '@/assets/marketing'
import type { PageType } from '@/shared'
import { isFeatureEnabled, type FrontendFeatureFlag } from '@/shared/featureFlags'
import { getRoadmapContent, initiativeSearchText, roadmapDoneSearchText, roadmapItemSearchText, type DocsRoadmap } from './roadmapContent'

export type { DocsRoadmap, DocsRoadmapItem, RoadmapDoneEntry, RoadmapInitiative, RoadmapPhase, RoadmapStage, PhaseStatus } from './roadmapContent'

export type DocsTone = 'ember' | 'arcane'

export interface NavSection {
    id: string
    label: string
    eyebrow: string
    title: string
    intro: string
    /** WIP explanation when a feature this section documents is off in this version. */
    note?: string
    icon: LucideIcon
    /** Ember is the default voice; writing/lore/media sections speak arcane. */
    tone: DocsTone
    /** Candlelit banner illustration for the section header (omitted for 'start'). */
    art?: string
}

export interface ActionTarget {
    label: string
    page: PageType
    icon: LucideIcon
    gated?: boolean
}

/** One card in a guide grid. Ember is the default voice; arcane marks AI/magic. */
export interface GuideItem {
    title: string
    body: string
    /** WIP explanation, rendered apart from the instructions it qualifies. */
    note?: string
    icon: LucideIcon
    tone?: DocsTone
    badge?: string
}

/** One App-map panel. `page` makes it navigable through the same gated handler as the header actions. */
export interface MapItem {
    title: string
    body: string
    note?: string
    icon: LucideIcon
    tone?: DocsTone
    page: PageType
    gated?: boolean
    tag?: string
}

export interface UtilityItem {
    title: string
    body: string
    icon: LucideIcon
    tone?: 'live' | 'arcane' | 'neutral'
    tag?: string
}

export interface DocsContent {
    page: {
        eyebrow: string
        title: string
        subtitle: string
    }
    navAriaLabel: string
    mapHeadings: {
        primaryWorkspaces: string
        utilityRail: string
    }
    sections: NavSection[]
    roadmap: DocsRoadmap
    primaryActions: ActionTarget[]
    quickStart: GuideItem[]
    mapItems: MapItem[]
    utilityItems: UtilityItem[]
    libraryGuide: GuideItem[]
    cardGuide: GuideItem[]
    playGuide: GuideItem[]
    voicePresetGuide: GuideItem[]
    voiceGuide: GuideItem[]
    writingGuide: GuideItem[]
    resourcesGuide: GuideItem[]
    mediaGuide: GuideItem[]
    bestPractices: string[]
    search: {
        label: string
        placeholder: string
        placeholderRoadmap: string
        clear: string
        shortcutHint: string
        empty: { title: string; body: string }
    }
    views: {
        label: string
        guide: string
        roadmap: string
    }
    nav: {
        onThisPage: string
        backToTop: string
    }
    teaser: {
        open: string
        stagesLabel: string
        showMatches: string
    }
    callout: {
        tipLabel: string
        bestPracticesLabel: string
    }
}

type SectionId =
    | 'start'
    | 'roadmap'
    | 'map'
    | 'library'
    | 'cards'
    | 'play'
    | 'voicePresets'
    | 'voice'
    | 'writing'
    | 'resources'
    | 'media'
    | 'bestPractices'

interface SectionSource {
    id: string
    key: SectionId
    icon: LucideIcon
    tone?: DocsTone
}

interface ActionSource {
    key: string
    page: PageType
    icon: LucideIcon
    gated?: boolean
}

interface GuideItemSource {
    key: string
    icon: LucideIcon
    tone?: GuideItem['tone']
    badge?: boolean
}

interface MapItemSource {
    key: string
    icon: LucideIcon
    tone?: MapItem['tone']
    page: PageType
    gated?: boolean
    tag?: boolean
}

interface UtilityItemSource {
    key: string
    icon: LucideIcon
    tone?: UtilityItem['tone']
    tag?: boolean
}

const SECTION_SOURCES: readonly SectionSource[] = [
    { id: 'start', key: 'start', icon: Compass },
    { id: 'roadmap', key: 'roadmap', icon: Route },
    { id: 'map', key: 'map', icon: Info },
    { id: 'library', key: 'library', icon: Search },
    { id: 'cards', key: 'cards', icon: Users },
    { id: 'play', key: 'play', icon: Swords },
    { id: 'voice-presets', key: 'voicePresets', icon: AudioLines },
    { id: 'voice', key: 'voice', icon: Mic },
    { id: 'writing', key: 'writing', icon: BookOpenText, tone: 'arcane' },
    { id: 'resources', key: 'resources', icon: FileText, tone: 'arcane' },
    { id: 'media', key: 'media', icon: Images, tone: 'arcane' },
    { id: 'best-practices', key: 'bestPractices', icon: ShieldCheck },
]

export const DOC_SECTION_IDS = SECTION_SOURCES.map((section) => section.id)

/** Per-section header illustration (dedicated docs art, by section id). 'start'
 * sits under the page hero art and 'roadmap' links to its own view, so neither
 * gets a banner. Ring tone follows the section's tone (writing/media are arcane). */
const SECTION_ART: Record<string, string> = docsArt

const PRIMARY_ACTION_SOURCES: readonly ActionSource[] = [
    { key: 'createCharacter', page: 'character', icon: Users, gated: true },
    { key: 'createWorld', page: 'world', icon: Globe, gated: true },
    { key: 'createItem', page: 'item', icon: Gem, gated: true },
    { key: 'createAdventure', page: 'adventure', icon: Swords, gated: true },
]

const QUICK_START_SOURCES: readonly GuideItemSource[] = [
    { key: 'beginExplore', icon: Compass },
    { key: 'smallCast', icon: Users },
    { key: 'cardsIntoPlay', icon: Swords },
    { key: 'backgroundWork', icon: ListChecks },
]

const MAP_ITEM_SOURCES: readonly MapItemSource[] = [
    { key: 'explore', icon: Compass, tone: 'ember', page: 'landing' },
    { key: 'characters', icon: Users, page: 'gallery-characters' },
    { key: 'worlds', icon: Globe, page: 'gallery-worlds' },
    { key: 'items', icon: Gem, page: 'gallery-items' },
    { key: 'adventures', icon: Swords, tone: 'ember', page: 'gallery-adventures' },
    { key: 'lorebooks', icon: BookOpen, page: 'gallery-lorebooks' },
    { key: 'resources', icon: FileText, tone: 'arcane', page: 'gallery-resources' },
    { key: 'novels', icon: BookOpenText, page: 'gallery-stories' },
    { key: 'media', icon: Images, page: 'gallery-media' },
    { key: 'voiceStudio', icon: AudioLines, page: 'voice-studio' },
    { key: 'personas', icon: UserCircle, tone: 'arcane', page: 'gallery-personas', tag: true },
]

const UTILITY_ITEM_SOURCES: readonly UtilityItemSource[] = [
    { key: 'status', icon: Server, tone: 'live' },
    { key: 'docs', icon: Info, tone: 'arcane' },
    { key: 'tasks', icon: ListChecks, tone: 'arcane', tag: true },
    { key: 'source', icon: Code2 },
    { key: 'profile', icon: UserCircle },
    { key: 'auth', icon: LogIn },
]

const LIBRARY_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'searchable', icon: Search },
    { key: 'actionMenu', icon: MoreHorizontal },
    { key: 'links', icon: Link2 },
    { key: 'dashboardSearch', icon: ScanSearch },
]

const CARD_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'identity', icon: UserCircle },
    { key: 'prose', icon: BookOpenText },
    { key: 'attributes', icon: Wand2 },
    { key: 'triggers', icon: Tags },
    { key: 'assistant', icon: Bot, tone: 'arcane', badge: true },
    { key: 'save', icon: Save },
]

const PLAY_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'persona', icon: UserCircle, badge: true },
    { key: 'templates', icon: Swords, badge: true },
    { key: 'sessionCopy', icon: ShieldCheck },
    { key: 'centerPanel', icon: MessageCircle, badge: true },
    { key: 'narration', icon: Music2 },
    { key: 'oneOnOne', icon: MessageCircle, tone: 'arcane', badge: true },
]

const VOICE_PRESET_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'reusable', icon: AudioLines, badge: true },
    { key: 'studio', icon: Wand2 },
    { key: 'baseVoice', icon: Search },
    { key: 'tune', icon: Gauge },
    { key: 'preview', icon: Play, badge: true },
    { key: 'manage', icon: Copy },
    { key: 'assign', icon: Pencil, tone: 'arcane' },
    { key: 'separate', icon: Phone, tone: 'arcane' },
]

const VOICE_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'start', icon: Phone, badge: true },
    { key: 'consent', icon: ShieldCheck },
    { key: 'speak', icon: Mic },
    { key: 'controls', icon: MicOff, badge: true },
    { key: 'record', icon: Volume2, tone: 'arcane' },
    { key: 'recover', icon: Radio },
    { key: 'text', icon: PhoneOff },
    { key: 'interrupt', icon: Waves, tone: 'arcane' },
]

const WRITING_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'lorebooks', icon: BookOpen },
    { key: 'novels', icon: BookOpenText },
    { key: 'codex', icon: Search },
    { key: 'generation', icon: Sparkles },
]

const RESOURCES_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'formats', icon: FileText, badge: true },
    { key: 'createUpload', icon: FilePlus2 },
    { key: 'urlImport', icon: Link2, tone: 'arcane', badge: true },
    { key: 'previewSearch', icon: Search },
    { key: 'attach', icon: BookOpen, tone: 'arcane' },
    { key: 'metadata', icon: Sparkles },
]

const MEDIA_GUIDE_SOURCES: readonly GuideItemSource[] = [
    { key: 'images', icon: Images },
    { key: 'themeJobs', icon: Music2 },
    { key: 'dock', icon: ListMusic, badge: true },
    { key: 'history', icon: History },
    { key: 'gallery', icon: Search },
    { key: 'profile', icon: UserCircle },
]

const BEST_PRACTICE_KEYS = [
    'strongFoundation',
    'specificTriggers',
    'reusablePersonas',
    'reusableFacts',
    'compactLorebooks',
    'saveOften',
    'exportCards',
    'iterateMedia',
    'separateWorkflows',
] as const

/** Availability wording is shared by the Docs page and assistant guide context.
 * These notes describe frontend rollout availability, not backend readiness. */
const SECTION_FEATURES: Partial<Record<string, readonly FrontendFeatureFlag[]>> = {
    play: ['adventures'],
    'voice-presets': ['voices'],
    voice: ['calls'],
    writing: ['lorebooks', 'novels'],
    resources: ['lorebookResources'],
}

const GUIDE_FEATURES: Partial<Record<string, readonly FrontendFeatureFlag[]>> = {
    'docs.quickStart.beginExplore': ['adventures'],
    'docs.quickStart.cardsIntoPlay': ['adventures'],
    'docs.guides.library.actionMenu': ['adventures', 'communityCards'],
    'docs.guides.library.dashboardSearch': ['adventures', 'novels'],
    'docs.guides.play.persona': ['adventures'],
    'docs.guides.play.templates': ['adventures'],
    'docs.guides.play.sessionCopy': ['adventures'],
    'docs.guides.play.centerPanel': ['adventures'],
    'docs.guides.play.narration': ['adventures'],
    'docs.guides.voicePresets.separate': ['voices', 'calls'],
    'docs.guides.writing.lorebooks': ['lorebooks'],
    'docs.guides.writing.novels': ['novels'],
    'docs.guides.writing.codex': ['novels'],
    'docs.guides.writing.generation': ['novels'],
}

const GUIDE_GROUP_FEATURES: Partial<Record<string, readonly FrontendFeatureFlag[]>> = {
    'docs.guides.voicePresets': ['voices'],
    'docs.guides.voice': ['calls'],
    // isFeatureEnabled('lorebookResources') requires both owning flags.
    'docs.guides.resources': ['lorebookResources'],
}

const MAP_FEATURES: Partial<Record<string, readonly FrontendFeatureFlag[]>> = {
    adventures: ['adventures'],
    lorebooks: ['lorebooks'],
    resources: ['lorebookResources'],
    novels: ['novels'],
    voiceStudio: ['voices'],
}

const BEST_PRACTICE_FEATURES: Partial<Record<(typeof BEST_PRACTICE_KEYS)[number], readonly FrontendFeatureFlag[]>> = {
    reusableFacts: ['adventures'],
    compactLorebooks: ['lorebooks'],
    separateWorkflows: ['novels', 'adventures'],
}

/** The localized WIP note for any disabled feature in `features`, else undefined. */
function availabilityNote(t: TFunction, features: readonly FrontendFeatureFlag[] = []): string | undefined {
    const disabled = features.filter((feature) => !isFeatureEnabled(feature))
    if (!disabled.length) return undefined
    const names = disabled.map((feature) => t(`docs.availability.features.${feature}`)).join(', ')
    return t('docs.availability.disabled', { features: names })
}

function withAvailability(t: TFunction, copy: string, features: readonly FrontendFeatureFlag[] = []): string {
    const note = availabilityNote(t, features)
    return note ? `${note} ${copy}` : copy
}

/** Copy with its WIP note prepended — the plain-text form for search and the assistant. */
export function withNote(entry: { body: string; note?: string }): string {
    return entry.note ? `${entry.note} ${entry.body}` : entry.body
}

function guideItems(t: TFunction, prefix: string, sources: readonly GuideItemSource[]): GuideItem[] {
    return sources.map((source) => ({
        icon: source.icon,
        tone: source.tone,
        title: t(`${prefix}.${source.key}.title`),
        body: t(`${prefix}.${source.key}.body`),
        note: availabilityNote(t, GUIDE_FEATURES[`${prefix}.${source.key}`] ?? GUIDE_GROUP_FEATURES[prefix]),
        badge: source.badge ? t(`${prefix}.${source.key}.badge`) : undefined,
    }))
}

export function getDocsContent(t: TFunction): DocsContent {
    return {
        page: {
            eyebrow: t('docs.page.eyebrow'),
            title: t('docs.page.title'),
            subtitle: t('docs.page.subtitle'),
        },
        navAriaLabel: t('docs.nav.ariaLabel'),
        mapHeadings: {
            primaryWorkspaces: t('docs.map.primaryWorkspaces'),
            utilityRail: t('docs.map.utilityRail'),
        },
        sections: SECTION_SOURCES.map((section) => ({
            id: section.id,
            icon: section.icon,
            tone: section.tone ?? 'ember',
            art: SECTION_ART[section.id],
            label: t(`docs.sections.${section.key}.label`),
            eyebrow: t(`docs.sections.${section.key}.eyebrow`),
            title: t(`docs.sections.${section.key}.title`),
            intro: t(`docs.sections.${section.key}.intro`),
            note: availabilityNote(t, SECTION_FEATURES[section.id]),
        })),
        roadmap: getRoadmapContent(t),
        primaryActions: PRIMARY_ACTION_SOURCES.map((action) => ({
            icon: action.icon,
            page: action.page,
            gated: action.gated,
            label: t(`docs.actions.${action.key}`),
        })),
        quickStart: guideItems(t, 'docs.quickStart', QUICK_START_SOURCES),
        mapItems: MAP_ITEM_SOURCES.map((item) => ({
            icon: item.icon,
            tone: item.tone,
            page: item.page,
            gated: item.gated,
            title: t(`docs.map.items.${item.key}.title`),
            body: t(`docs.map.items.${item.key}.body`),
            note: availabilityNote(t, MAP_FEATURES[item.key]),
            tag: item.tag ? t(`docs.map.items.${item.key}.tag`) : undefined,
        })),
        utilityItems: UTILITY_ITEM_SOURCES.map((item) => ({
            icon: item.icon,
            tone: item.tone,
            title: t(`docs.map.utility.${item.key}.title`),
            body: t(`docs.map.utility.${item.key}.body`),
            tag: item.tag ? t(`docs.map.utility.${item.key}.tag`) : undefined,
        })),
        libraryGuide: guideItems(t, 'docs.guides.library', LIBRARY_GUIDE_SOURCES),
        cardGuide: guideItems(t, 'docs.guides.cards', CARD_GUIDE_SOURCES),
        playGuide: guideItems(t, 'docs.guides.play', PLAY_GUIDE_SOURCES),
        voicePresetGuide: guideItems(t, 'docs.guides.voicePresets', VOICE_PRESET_GUIDE_SOURCES),
        voiceGuide: guideItems(t, 'docs.guides.voice', VOICE_GUIDE_SOURCES),
        writingGuide: guideItems(t, 'docs.guides.writing', WRITING_GUIDE_SOURCES),
        resourcesGuide: guideItems(t, 'docs.guides.resources', RESOURCES_GUIDE_SOURCES),
        mediaGuide: guideItems(t, 'docs.guides.media', MEDIA_GUIDE_SOURCES),
        bestPractices: BEST_PRACTICE_KEYS.map((key) => withAvailability(t, t(`docs.bestPractices.${key}`), BEST_PRACTICE_FEATURES[key])),
        search: {
            label: t('docs.search.label'),
            placeholder: t('docs.search.placeholder'),
            placeholderRoadmap: t('docs.search.placeholderRoadmap'),
            clear: t('docs.search.clear'),
            shortcutHint: t('docs.search.shortcutHint'),
            empty: { title: t('docs.search.empty.title'), body: t('docs.search.empty.body') },
        },
        views: {
            label: t('docs.views.label'),
            guide: t('docs.views.guide'),
            roadmap: t('docs.views.roadmap'),
        },
        nav: {
            onThisPage: t('docs.nav.onThisPage'),
            backToTop: t('docs.nav.backToTop'),
        },
        teaser: {
            open: t('docs.roadmap.teaser.open'),
            stagesLabel: t('docs.roadmap.teaser.stagesLabel'),
            showMatches: t('docs.roadmap.teaser.showMatches'),
        },
        callout: {
            tipLabel: t('docs.callout.tipLabel'),
            bestPracticesLabel: t('docs.callout.bestPracticesLabel'),
        },
    }
}

/** The guide cards a section renders, by section id (empty for map/roadmap/practices). */
export function guideItemsFor(docs: DocsContent, sectionId: string): GuideItem[] {
    switch (sectionId) {
        case 'start':
            return docs.quickStart
        case 'library':
            return docs.libraryGuide
        case 'cards':
            return docs.cardGuide
        case 'play':
            return docs.playGuide
        case 'voice-presets':
            return docs.voicePresetGuide
        case 'voice':
            return docs.voiceGuide
        case 'writing':
            return docs.writingGuide
        case 'resources':
            return docs.resourcesGuide
        case 'media':
            return docs.mediaGuide
        default:
            return []
    }
}

/**
 * Flatten a section's i18n copy (label + headings + every guide title/body) into
 * one lowercased haystack for the in-page search. Derived from the existing
 * content so search needs no extra keys; called once per section, memoized in
 * the view. The roadmap section indexes the whole roadmap, so a roadmap term
 * found from the Guide surfaces its summary and the link into the Roadmap view.
 */
export function sectionSearchText(docs: DocsContent, sectionId: string): string {
    const section = docs.sections.find((entry) => entry.id === sectionId)
    const parts: string[] = section ? [section.label, section.eyebrow, section.title, section.intro, section.note ?? ''] : []
    const pushItems = (items: { title: string; body: string; note?: string }[]) => {
        for (const item of items) parts.push(item.title, withNote(item))
    }
    switch (sectionId) {
        case 'roadmap':
            parts.push(docs.roadmap.title, docs.roadmap.intro, docs.roadmap.reviewed, docs.roadmap.note)
            for (const item of docs.roadmap.items) parts.push(roadmapItemSearchText(item))
            for (const initiative of docs.roadmap.initiatives) parts.push(initiativeSearchText(initiative))
            for (const entry of docs.roadmap.done) parts.push(roadmapDoneSearchText(entry))
            break
        case 'map':
            pushItems(docs.mapItems)
            pushItems(docs.utilityItems)
            parts.push(docs.mapHeadings.primaryWorkspaces, docs.mapHeadings.utilityRail)
            break
        case 'best-practices':
            parts.push(...docs.bestPractices)
            break
        default:
            pushItems(guideItemsFor(docs, sectionId))
    }
    return parts.join(' ').toLowerCase()
}
