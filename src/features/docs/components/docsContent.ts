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
import type { PageType } from '@/shared'

export interface NavSection {
    id: string
    label: string
    eyebrow: string
    title: string
    intro: string
    icon: LucideIcon
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
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
    badge?: string
}

/** One App-map panel. `page` makes it navigable through the same gated handler as the header actions. */
export interface MapItem {
    title: string
    body: string
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
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
    mediaGuide: GuideItem[]
    bestPractices: string[]
}

type SectionId =
    | 'start'
    | 'map'
    | 'library'
    | 'cards'
    | 'play'
    | 'voicePresets'
    | 'voice'
    | 'writing'
    | 'media'
    | 'bestPractices'

interface SectionSource {
    id: string
    key: SectionId
    icon: LucideIcon
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
    { id: 'map', key: 'map', icon: Info },
    { id: 'library', key: 'library', icon: Search },
    { id: 'cards', key: 'cards', icon: Users },
    { id: 'play', key: 'play', icon: Swords },
    { id: 'voice-presets', key: 'voicePresets', icon: AudioLines },
    { id: 'voice', key: 'voice', icon: Mic },
    { id: 'writing', key: 'writing', icon: BookOpenText },
    { id: 'media', key: 'media', icon: Images },
    { id: 'best-practices', key: 'bestPractices', icon: ShieldCheck },
]

export const DOC_SECTION_IDS = SECTION_SOURCES.map((section) => section.id)

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
    { key: 'characters', icon: Users, page: 'gallery-characters', gated: true },
    { key: 'worlds', icon: Globe, page: 'gallery-worlds', gated: true },
    { key: 'items', icon: Gem, page: 'gallery-items', gated: true },
    { key: 'adventures', icon: Swords, tone: 'ember', page: 'gallery-adventures', gated: true },
    { key: 'lorebooks', icon: BookOpen, page: 'gallery-lorebooks', gated: true },
    { key: 'novels', icon: BookOpenText, page: 'gallery-stories', gated: true },
    { key: 'media', icon: Images, page: 'gallery-media', gated: true },
    { key: 'voiceStudio', icon: AudioLines, page: 'voice-studio', gated: true },
    { key: 'personas', icon: UserCircle, tone: 'arcane', page: 'gallery-personas', gated: true, tag: true },
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

function guideItems(t: TFunction, prefix: string, sources: readonly GuideItemSource[]): GuideItem[] {
    return sources.map((source) => ({
        icon: source.icon,
        tone: source.tone,
        title: t(`${prefix}.${source.key}.title`),
        body: t(`${prefix}.${source.key}.body`),
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
            label: t(`docs.sections.${section.key}.label`),
            eyebrow: t(`docs.sections.${section.key}.eyebrow`),
            title: t(`docs.sections.${section.key}.title`),
            intro: t(`docs.sections.${section.key}.intro`),
        })),
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
        mediaGuide: guideItems(t, 'docs.guides.media', MEDIA_GUIDE_SOURCES),
        bestPractices: BEST_PRACTICE_KEYS.map((key) => t(`docs.bestPractices.${key}`)),
    }
}
