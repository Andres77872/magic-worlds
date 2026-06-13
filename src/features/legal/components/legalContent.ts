import type { LucideIcon } from 'lucide-react'
import {
    Ban,
    BookOpenText,
    Database,
    FileWarning,
    HeartHandshake,
    Mail,
    Scale,
    Server,
    ShieldCheck,
    Sparkles,
    TriangleAlert,
    UserRound,
} from 'lucide-react'
import type { PageType } from '@/shared'

export type LegalPageId = Extract<PageType, 'about' | 'contact' | 'privacy' | 'disclaimer'>

export interface LegalPageLink {
    page: LegalPageId
    label: string
}

export interface LegalHighlight {
    title: string
    body: string
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
}

export interface LegalSection {
    title: string
    body: string[]
    icon: LucideIcon
    tone?: 'ember' | 'arcane'
}

export interface LegalPageContent {
    page: LegalPageId
    eyebrow: string
    title: string
    subtitle: string
    icon: LucideIcon
    updated: string
    highlights: LegalHighlight[]
    sections: LegalSection[]
}

export const CONTACT_EMAIL = 'andres@arz.ai'

export const LEGAL_PAGE_LINKS: LegalPageLink[] = [
    { page: 'about', label: 'About' },
    { page: 'contact', label: 'Contact' },
    { page: 'privacy', label: 'Privacy Policy' },
    { page: 'disclaimer', label: 'Disclaimer' },
]

export const LEGAL_PAGES: Record<LegalPageId, LegalPageContent> = {
    about: {
        page: 'about',
        eyebrow: 'About Magic Worlds',
        title: 'A free preview for living stories',
        subtitle:
            'Magic Worlds helps you create characters, worlds, items, adventures, lorebooks, stories, images, and theme songs for AI-assisted roleplay.',
        icon: Sparkles,
        updated: 'June 12, 2026',
        highlights: [
            {
                title: 'Free during preview',
                body: 'The service is free for now while operating costs remain affordable.',
                icon: HeartHandshake,
            },
            {
                title: 'Backend-backed',
                body: 'Your saved content lives on the server so the app can load it across sessions.',
                icon: Server,
            },
            {
                title: 'Story-first tools',
                body: 'Cards, chats, adventures, media, lore, and prose are built to work together.',
                icon: BookOpenText,
                tone: 'arcane',
            },
        ],
        sections: [
            {
                title: 'What this service is',
                icon: Sparkles,
                body: [
                    'Magic Worlds is an AI roleplay and story creation workspace. It lets you create reusable cards, start adventures, chat with characters, write stories, build lorebooks, and generate supporting media.',
                    'The project is under active development, so the product can change quickly. The goal is to make a practical creative tool, not a locked-down publishing platform.',
                ],
            },
            {
                title: 'How it is operated today',
                icon: Server,
                body: [
                    'The app saves content on a backend service so your library, sessions, generated media, and profile usage can be served when you return.',
                    'Because this is a free preview, availability, limits, retention, and features may change as costs and infrastructure needs change.',
                ],
            },
            {
                title: 'Content boundaries',
                icon: Ban,
                tone: 'arcane',
                body: [
                    'Do not use Magic Worlds for illegal content or activity.',
                    'NSFW content is not allowed while the service is free. Content that violates these boundaries may be removed or blocked.',
                ],
            },
        ],
    },
    contact: {
        page: 'contact',
        eyebrow: 'Contact',
        title: 'Reach Magic Worlds',
        subtitle:
            'Use this contact point for service questions, content concerns, data requests, bug reports, and policy feedback.',
        icon: Mail,
        updated: 'June 12, 2026',
        highlights: [
            {
                title: 'Email',
                body: CONTACT_EMAIL,
                icon: Mail,
            },
            {
                title: 'Content concerns',
                body: 'Report illegal, abusive, or NSFW content concerns so they can be reviewed.',
                icon: TriangleAlert,
                tone: 'arcane',
            },
            {
                title: 'Account and data',
                body: 'Ask about account access, saved content, deletion, or privacy questions.',
                icon: UserRound,
            },
        ],
        sections: [
            {
                title: 'Email contact',
                icon: Mail,
                body: [
                    `For support, privacy, content, or service questions, email ${CONTACT_EMAIL}.`,
                    'Include enough context to understand the issue, such as your username, the page you were using, and any relevant error text. Do not send passwords or secrets.',
                ],
            },
            {
                title: 'What to report',
                icon: TriangleAlert,
                tone: 'arcane',
                body: [
                    'Please report illegal content, attempts to misuse the service, NSFW content during the free preview, account problems, data deletion questions, and bugs that affect saving or playback.',
                    'Magic Worlds is a preview service, so response times are not guaranteed, but serious content and account concerns should use this email address.',
                ],
            },
        ],
    },
    privacy: {
        page: 'privacy',
        eyebrow: 'Privacy Policy',
        title: 'How Magic Worlds handles data',
        subtitle:
            'This plain-language policy explains what the app saves, why it is saved, and what controls are currently available.',
        icon: ShieldCheck,
        updated: 'June 12, 2026',
        highlights: [
            {
                title: 'Server storage',
                body: 'Created content is saved on the backend so the service can work.',
                icon: Database,
            },
            {
                title: 'No zero-retention mode',
                body: 'Local-only storage and zero-retention mode are not supported right now.',
                icon: Server,
            },
            {
                title: 'Delete content',
                body: 'The profile page includes a delete-all-data action for user-created content.',
                icon: ShieldCheck,
                tone: 'arcane',
            },
        ],
        sections: [
            {
                title: 'Information you provide',
                icon: UserRound,
                body: [
                    'Magic Worlds may process your username, login state, optional email if supplied, profile details returned by the auth service, and the content you create in the app.',
                    'Created content can include characters, personas, worlds, items, adventure templates, adventure sessions, chats, stories, lorebooks, uploaded images, generated images, theme songs, and assistant conversations.',
                ],
            },
            {
                title: 'How the app uses data',
                icon: Server,
                body: [
                    'The service uses saved data to authenticate you, load your library, continue sessions, generate or replay media, track background tasks, show profile usage, and keep related cards and stories connected.',
                    'AI and media features may send prompts, card context, story context, or media requests to backend services and configured providers so the requested generation can run.',
                ],
            },
            {
                title: 'Browser storage',
                icon: Database,
                tone: 'arcane',
                body: [
                    'The browser stores an access token and user cache in localStorage so the app can keep you signed in. The backend also uses an auth refresh flow for session continuity.',
                    'The browser may also store small UI preferences, such as whether you accepted the preview warning or collapsed the sidebar.',
                ],
            },
            {
                title: 'Data controls',
                icon: ShieldCheck,
                body: [
                    'Signed-in users can delete individual content from galleries and can use the profile page to delete all user-created content. That action keeps the account active but removes cards, adventures, chats, and generated media exposed through the app.',
                    `For privacy questions or data requests that are not covered by the app controls, contact ${CONTACT_EMAIL}.`,
                ],
            },
            {
                title: 'Preview limits',
                icon: TriangleAlert,
                tone: 'arcane',
                body: [
                    'Magic Worlds is under active development. Backend content and database records may be changed, migrated, or wiped without notice during the preview.',
                    'Do not enter secrets, passwords, private keys, or information you cannot risk losing.',
                ],
            },
        ],
    },
    disclaimer: {
        page: 'disclaimer',
        eyebrow: 'Disclaimer',
        title: 'Preview service limits',
        subtitle:
            'Magic Worlds is free for now and actively evolving. These notes set expectations for availability, content, and AI output.',
        icon: FileWarning,
        updated: 'June 12, 2026',
        highlights: [
            {
                title: 'Free for now',
                body: 'Access is free during this preview while operating expenses can be covered.',
                icon: HeartHandshake,
            },
            {
                title: 'No guarantees',
                body: 'Features, limits, availability, data retention, and credits may change.',
                icon: TriangleAlert,
                tone: 'arcane',
            },
            {
                title: 'User responsibility',
                body: 'You are responsible for the content you create and request.',
                icon: Scale,
            },
        ],
        sections: [
            {
                title: 'Service availability',
                icon: Server,
                body: [
                    'Magic Worlds is provided as a free preview. It may be interrupted, changed, limited, or discontinued as infrastructure, provider, and operating costs change.',
                    'Credits and usage values shown in the app are informational reference values for now and should not be treated as a paid entitlement.',
                ],
            },
            {
                title: 'AI output',
                icon: Sparkles,
                tone: 'arcane',
                body: [
                    'AI-generated text, images, and audio can be incomplete, inaccurate, unexpected, or unsuitable for your intended use.',
                    'Review and edit generated content before relying on it, publishing it, or sharing it outside the app.',
                ],
            },
            {
                title: 'Content rules',
                icon: Ban,
                body: [
                    'Illegal content and illegal activity are not allowed on Magic Worlds.',
                    'NSFW content is not allowed while the service is free. Content that appears to violate these rules may be blocked, removed, or reviewed.',
                ],
            },
            {
                title: 'Data and development risk',
                icon: Database,
                tone: 'arcane',
                body: [
                    'The service stores content on the backend so it can function, but this preview does not guarantee permanent storage, uninterrupted access, or recovery of deleted or lost data.',
                    'Keep your own copy of anything important before depending on it outside Magic Worlds.',
                ],
            },
        ],
    },
}
