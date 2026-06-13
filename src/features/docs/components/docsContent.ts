/**
 * Docs copy and structure — kept out of the JSX so DocsPage stays legible
 * (mirrors how `landingContent.ts` centralizes the landing copy). Everything
 * here documents app usage only: where to start, what each workspace does,
 * and the habits that keep a library healthy. No backend or API details.
 *
 * The "App map" must mirror the real Sidebar rail (`src/ui/components/Sidebar.tsx`):
 * Explore + seven gallery items on top, the status/docs/tasks/source/account
 * cluster at the bottom. Personas deliberately has no rail item — say so.
 */

import type { LucideIcon } from 'lucide-react'
import {
    BookOpen,
    BookOpenText,
    Bot,
    Code2,
    Compass,
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
    MoreHorizontal,
    Music2,
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
    Wand2,
} from 'lucide-react'
import type { PageType } from '@/shared'

export interface NavSection {
    id: string
    label: string
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

export const SECTIONS: NavSection[] = [
    { id: 'start', label: 'Start here', icon: Compass },
    { id: 'map', label: 'App map', icon: Info },
    { id: 'library', label: 'Find your work', icon: Search },
    { id: 'cards', label: 'Cards', icon: Users },
    { id: 'play', label: 'Play modes', icon: Swords },
    { id: 'writing', label: 'Writing', icon: BookOpenText },
    { id: 'media', label: 'Media and tasks', icon: Images },
    { id: 'best-practices', label: 'Best practices', icon: ShieldCheck },
]

export const PRIMARY_ACTIONS: ActionTarget[] = [
    { label: 'Create character', page: 'character', icon: Users, gated: true },
    { label: 'Create world', page: 'world', icon: Globe, gated: true },
    { label: 'Create item', page: 'item', icon: Gem, gated: true },
    { label: 'Create adventure', page: 'adventure', icon: Swords, gated: true },
]

export const QUICK_START: GuideItem[] = [
    {
        title: 'Begin at Explore',
        body: 'Explore is the front door. Guests get a guided tour with sample worlds and create actions. Signed in, it becomes your dashboard: a greeting with global search, a hero that continues your latest session, recent sessions to resume, featured adventures with genre filters, a cast rail for one-on-one chat, and your library shelves.',
        icon: Compass,
    },
    {
        title: 'Make a small cast — and a persona',
        body: 'Create one AI character to meet and one persona to play as; personas are the characters that represent you in a session. Add a world if the story needs a place. A small, solid foundation beats a large empty library.',
        icon: Users,
    },
    {
        title: 'Turn cards into play',
        body: 'Create an adventure template from a scenario and cast, then press Begin from Explore or the Adventures gallery. The persona picker asks who you will play, and the session starts with its own copy of your cards.',
        icon: Swords,
    },
    {
        title: 'Let long work run in the background',
        body: 'Theme songs compose as background jobs. The Tasks drawer tracks active, completed, and failed work, and finished themes are ready in the music dock — keep building while they run.',
        icon: ListChecks,
    },
]

export const MAP_ITEMS: MapItem[] = [
    {
        title: 'Explore',
        body: 'Home for guests and your dashboard once signed in: global search, continue your latest session, resume recent play, featured adventures, one-on-one chat, and library shelves.',
        icon: Compass,
        tone: 'ember',
        page: 'landing',
    },
    {
        title: 'Characters',
        body: 'Your searchable character library. Browse, filter by name or trigger, start a one-on-one chat, or build a new cast member from New character.',
        icon: Users,
        page: 'gallery-characters',
        gated: true,
    },
    {
        title: 'Worlds',
        body: 'Settings with an overview, custom detail groups, triggers, art, and theme songs. Create from New world.',
        icon: Globe,
        page: 'gallery-worlds',
        gated: true,
    },
    {
        title: 'Items',
        body: 'Relics, tools, keys, treasures, and other story objects with effects, requirements, limits, and triggers. Create from New item.',
        icon: Gem,
        page: 'gallery-items',
        gated: true,
    },
    {
        title: 'Adventures',
        body: 'Reusable session templates. Begin one to start playing, or build a new template from a scenario, cast, persona, world, and objectives.',
        icon: Swords,
        tone: 'ember',
        page: 'gallery-adventures',
        gated: true,
    },
    {
        title: 'Lorebooks',
        body: 'Reusable context books with activation keys, entries, tags, budgets, validation, and an activation preview. Attach them where the facts belong.',
        icon: BookOpen,
        page: 'gallery-lorebooks',
        gated: true,
    },
    {
        title: 'Novels',
        body: 'Chaptered prose projects. Start blank or from cards, then write with card context and candidate-based generation tools.',
        icon: BookOpenText,
        page: 'gallery-stories',
        gated: true,
    },
    {
        title: 'Media',
        body: 'Every generated image and theme song in one archive. Filter by media type, card type, or a specific card.',
        icon: Images,
        page: 'gallery-media',
        gated: true,
    },
    {
        title: 'Personas',
        body: 'Personas are the characters you play as. Their gallery has no rail item — reach it from the dashboard Library shelf, global search, the persona picker, or right here.',
        icon: UserCircle,
        tone: 'arcane',
        page: 'gallery-personas',
        gated: true,
        tag: 'Not on the rail',
    },
]

export const UTILITY_ITEMS: UtilityItem[] = [
    {
        title: 'Status',
        body: 'The status light shows whether the service is checking, online, or offline. Click it to see each dependency and when it was last checked. While offline, saving may fail until service returns.',
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
        body: 'The badge counts active background jobs. The drawer keeps active, completed, and failed work visible, so long jobs never block you.',
        icon: ListChecks,
        tone: 'arcane',
        tag: 'Signed in',
    },
    {
        title: 'View source',
        body: 'Opens the project repository on GitHub. Useful for following development; never required for normal use.',
        icon: Code2,
    },
    {
        title: 'Profile',
        body: 'Your avatar opens the profile page: membership, daily usage, account details, and the delete-all-data control.',
        icon: UserCircle,
    },
    {
        title: 'Log in / Log out',
        body: 'Guests see Log in — creating and saving needs an account. Signed in, the log out button sits beneath your avatar and asks for confirmation first.',
        icon: LogIn,
    },
]

export const LIBRARY_GUIDE: GuideItem[] = [
    {
        title: 'Galleries are searchable libraries',
        body: 'Every rail item opens a gallery. Type in the search field to filter by name or trigger keywords; more results load as you scroll, so large libraries stay fast.',
        icon: Search,
    },
    {
        title: 'Every card has an action menu',
        body: 'Each card’s menu covers its whole life: edit, begin an adventure or start a chat, export the card as JSON, copy a shareable link, or delete with confirmation.',
        icon: MoreHorizontal,
    },
    {
        title: 'Links and previews',
        body: 'A copied card link reopens its gallery scrolled to that card. Elsewhere — like the music dock — opening a card shows an inline preview without leaving the page.',
        icon: Link2,
    },
    {
        title: 'Dashboard search sweeps everything',
        body: 'The search field on Explore looks across sessions, adventures, cast, personas, worlds, items, and novels at once, grouped by type. Use it when you remember the name but not the shelf.',
        icon: ScanSearch,
    },
]

export const CARD_GUIDE: GuideItem[] = [
    {
        title: 'Identity fields are anchors',
        body: 'Names, race or species, and world type make cards easy to recognize in galleries, selectors, adventures, stories, and media filters.',
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
        body: 'Triggers are keywords. Short names, places, factions, and phrases pull a card into scenes and writing context — and they double as search terms in every gallery.',
        icon: Tags,
    },
    {
        title: 'Ask the card assistant',
        body: 'Every creator has a floating assistant. Chat about the card you are building, ask for suggestions, and apply a generated draft straight to the form — nothing changes until you accept it.',
        icon: Bot,
        tone: 'arcane',
        badge: 'AI copilot',
    },
    {
        title: 'Save before leaving',
        body: 'The live preview updates while you edit, but the card is only finalized when you create or update it. Generated media can persist early, but saving keeps the library clean.',
        icon: Save,
    },
]

export const PLAY_GUIDE: GuideItem[] = [
    {
        title: 'Choose your persona first',
        body: 'Beginning an adventure or chat opens the persona picker. Choose who you will play, mark a favorite as your default, or create a new persona on the spot.',
        icon: UserCircle,
        badge: 'Persona',
    },
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
        body: 'Use Narrate on any Game Master turn to request audio, or switch on auto-narrate to request it for new turns. Playback still follows your browser’s audio rules, so the first sound may need a click.',
        icon: Music2,
    },
    {
        title: 'One-on-one chat uses the same engine',
        body: 'Start a chat from a character card. The sidebar shows the character, greeting, and edit shortcut; the center panel handles the conversation.',
        icon: MessageCircle,
        tone: 'arcane',
        badge: 'Character chat',
    },
]

export const WRITING_GUIDE: GuideItem[] = [
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

export const MEDIA_GUIDE: GuideItem[] = [
    {
        title: 'Images: generate, upload, reuse',
        body: 'Use optional art direction to steer a portrait or cover, or upload your own. View, replace, remove, or pick an existing image from your gallery.',
        icon: Images,
    },
    {
        title: 'Theme songs run as jobs',
        body: 'A theme needs a saved card target; new cards may auto-save just enough to start the job. The Tasks drawer follows the work while it composes, and the finished theme plays anywhere the card appears.',
        icon: Music2,
    },
    {
        title: 'The music dock',
        body: 'Playing any theme opens the floating dock in the corner: a queue to jump through or trim, play and pause, waveform seek, and per-track download. Drag it anywhere — it remembers the spot, keeps playing while you navigate, and the track opens the card’s preview.',
        icon: ListMusic,
        badge: 'Playlist',
    },
    {
        title: 'Per-card media history',
        body: 'Inside a creator, the history drawer collects what you have generated: an Images tab with your whole gallery and a Themes tab scoped to the card. Set a new default, preview, download, or delete — themes unlock once the card is saved.',
        icon: History,
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

export const BEST_PRACTICES: string[] = [
    'Start with one strong character, one clear world, and one short adventure premise before building a large library.',
    'Use specific trigger phrases. "black gate" is more useful than "gate" when you only want one location to activate — and triggers double as gallery search terms.',
    'Keep one or two reusable personas and mark a default. The persona picker remembers it, so starting a session stays one click.',
    'Keep descriptions factual and reusable. Put temporary scene changes in the running adventure session instead of rewriting the original card.',
    'Treat lorebook entries as compact facts. Split large setting documents into smaller entries with precise activation keys.',
    'Save after major edits, before navigating away, and before using generated output as important source material.',
    'Export important cards as JSON from the gallery menu before large rewrites. The file doubles as a backup you can keep or share.',
    'Use generated images and themes as iteration tools. Regenerate when the direction is wrong; browse history when the right asset already exists.',
    'Use novels for authored prose and adventures for interactive play. They share cards, but they serve different workflows.',
]
