import type { LucideIcon } from 'lucide-react'
import type { TFunction } from 'i18next'
import {
    Ban,
    BookOpenText,
    Database,
    FileWarning,
    HeartHandshake,
    Mail,
    Mic,
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
            {
                title: 'Voice calls',
                body: 'Voice mode processes microphone segments for STT/TTS, but raw microphone audio is not stored by default.',
                icon: Mic,
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
                title: 'Voice calls and transcripts',
                icon: Mic,
                tone: 'arcane',
                body: [
                    'If voice mode is enabled and you explicitly start a call, the app requests microphone access and sends short speech segments to the backend for Groq speech-to-text processing. Character replies may be synthesized with MiniMax text-to-speech.',
                    'Magic Worlds stores final transcript text and call metadata with the chat so the conversation can continue. Raw microphone audio, full call recordings, provider keys, provider URLs, and raw provider trace details are not stored by default.',
                    'Ending the call stops microphone capture and voice playback. Browser microphone permission can also be revoked through your browser settings.',
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
                title: 'Voice preview',
                icon: Mic,
                body: [
                    'Voice calls are an optional preview feature. AI voice replies, speech-to-text transcripts, and generated speech can be delayed, incorrect, interrupted, or unavailable when providers are degraded.',
                    'Do not treat a character voice as a human, emergency, medical, legal, or professional communication channel. End the call if the output is unwanted or unsafe.',
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

export function getLegalPageLinks(t: TFunction): LegalPageLink[] {
    return [
        { page: 'about', label: t('legal.links.about') },
        { page: 'contact', label: t('legal.links.contact') },
        { page: 'privacy', label: t('legal.links.privacy') },
        { page: 'disclaimer', label: t('legal.links.disclaimer') },
    ]
}

export function getLegalPages(t: TFunction): Record<LegalPageId, LegalPageContent> {
    return {
        about: {
            page: 'about',
            eyebrow: t('legal.pages.about.eyebrow'),
            title: t('legal.pages.about.title'),
            subtitle: t('legal.pages.about.subtitle'),
            icon: Sparkles,
            updated: t('legal.pages.about.updated'),
            highlights: [
                {
                    title: t('legal.pages.about.highlights.preview.title'),
                    body: t('legal.pages.about.highlights.preview.body'),
                    icon: HeartHandshake,
                },
                {
                    title: t('legal.pages.about.highlights.backend.title'),
                    body: t('legal.pages.about.highlights.backend.body'),
                    icon: Server,
                },
                {
                    title: t('legal.pages.about.highlights.story.title'),
                    body: t('legal.pages.about.highlights.story.body'),
                    icon: BookOpenText,
                    tone: 'arcane',
                },
            ],
            sections: [
                {
                    title: t('legal.pages.about.sections.service.title'),
                    icon: Sparkles,
                    body: [t('legal.pages.about.sections.service.body1'), t('legal.pages.about.sections.service.body2')],
                },
                {
                    title: t('legal.pages.about.sections.operation.title'),
                    icon: Server,
                    body: [t('legal.pages.about.sections.operation.body1'), t('legal.pages.about.sections.operation.body2')],
                },
                {
                    title: t('legal.pages.about.sections.boundaries.title'),
                    icon: Ban,
                    tone: 'arcane',
                    body: [t('legal.pages.about.sections.boundaries.body1'), t('legal.pages.about.sections.boundaries.body2')],
                },
            ],
        },
        contact: {
            page: 'contact',
            eyebrow: t('legal.pages.contact.eyebrow'),
            title: t('legal.pages.contact.title'),
            subtitle: t('legal.pages.contact.subtitle'),
            icon: Mail,
            updated: t('legal.pages.contact.updated'),
            highlights: [
                {
                    title: t('legal.pages.contact.highlights.email.title'),
                    body: CONTACT_EMAIL,
                    icon: Mail,
                },
                {
                    title: t('legal.pages.contact.highlights.content.title'),
                    body: t('legal.pages.contact.highlights.content.body'),
                    icon: TriangleAlert,
                    tone: 'arcane',
                },
                {
                    title: t('legal.pages.contact.highlights.account.title'),
                    body: t('legal.pages.contact.highlights.account.body'),
                    icon: UserRound,
                },
            ],
            sections: [
                {
                    title: t('legal.pages.contact.sections.email.title'),
                    icon: Mail,
                    body: [
                        t('legal.pages.contact.sections.email.body1', { email: CONTACT_EMAIL }),
                        t('legal.pages.contact.sections.email.body2'),
                    ],
                },
                {
                    title: t('legal.pages.contact.sections.report.title'),
                    icon: TriangleAlert,
                    tone: 'arcane',
                    body: [t('legal.pages.contact.sections.report.body1'), t('legal.pages.contact.sections.report.body2')],
                },
            ],
        },
        privacy: {
            page: 'privacy',
            eyebrow: t('legal.pages.privacy.eyebrow'),
            title: t('legal.pages.privacy.title'),
            subtitle: t('legal.pages.privacy.subtitle'),
            icon: ShieldCheck,
            updated: t('legal.pages.privacy.updated'),
            highlights: [
                {
                    title: t('legal.pages.privacy.highlights.storage.title'),
                    body: t('legal.pages.privacy.highlights.storage.body'),
                    icon: Database,
                },
                {
                    title: t('legal.pages.privacy.highlights.retention.title'),
                    body: t('legal.pages.privacy.highlights.retention.body'),
                    icon: Server,
                },
                {
                    title: t('legal.pages.privacy.highlights.delete.title'),
                    body: t('legal.pages.privacy.highlights.delete.body'),
                    icon: ShieldCheck,
                    tone: 'arcane',
                },
                {
                    title: t('legal.pages.privacy.highlights.voice.title'),
                    body: t('legal.pages.privacy.highlights.voice.body'),
                    icon: Mic,
                },
            ],
            sections: [
                {
                    title: t('legal.pages.privacy.sections.provided.title'),
                    icon: UserRound,
                    body: [t('legal.pages.privacy.sections.provided.body1'), t('legal.pages.privacy.sections.provided.body2')],
                },
                {
                    title: t('legal.pages.privacy.sections.use.title'),
                    icon: Server,
                    body: [t('legal.pages.privacy.sections.use.body1'), t('legal.pages.privacy.sections.use.body2')],
                },
                {
                    title: t('legal.pages.privacy.sections.browser.title'),
                    icon: Database,
                    tone: 'arcane',
                    body: [t('legal.pages.privacy.sections.browser.body1'), t('legal.pages.privacy.sections.browser.body2')],
                },
                {
                    title: t('legal.pages.privacy.sections.voice.title'),
                    icon: Mic,
                    tone: 'arcane',
                    body: [
                        t('legal.pages.privacy.sections.voice.body1'),
                        t('legal.pages.privacy.sections.voice.body2'),
                        t('legal.pages.privacy.sections.voice.body3'),
                    ],
                },
                {
                    title: t('legal.pages.privacy.sections.controls.title'),
                    icon: ShieldCheck,
                    body: [
                        t('legal.pages.privacy.sections.controls.body1'),
                        t('legal.pages.privacy.sections.controls.body2', { email: CONTACT_EMAIL }),
                    ],
                },
                {
                    title: t('legal.pages.privacy.sections.preview.title'),
                    icon: TriangleAlert,
                    tone: 'arcane',
                    body: [t('legal.pages.privacy.sections.preview.body1'), t('legal.pages.privacy.sections.preview.body2')],
                },
            ],
        },
        disclaimer: {
            page: 'disclaimer',
            eyebrow: t('legal.pages.disclaimer.eyebrow'),
            title: t('legal.pages.disclaimer.title'),
            subtitle: t('legal.pages.disclaimer.subtitle'),
            icon: FileWarning,
            updated: t('legal.pages.disclaimer.updated'),
            highlights: [
                {
                    title: t('legal.pages.disclaimer.highlights.free.title'),
                    body: t('legal.pages.disclaimer.highlights.free.body'),
                    icon: HeartHandshake,
                },
                {
                    title: t('legal.pages.disclaimer.highlights.guarantees.title'),
                    body: t('legal.pages.disclaimer.highlights.guarantees.body'),
                    icon: TriangleAlert,
                    tone: 'arcane',
                },
                {
                    title: t('legal.pages.disclaimer.highlights.responsibility.title'),
                    body: t('legal.pages.disclaimer.highlights.responsibility.body'),
                    icon: Scale,
                },
            ],
            sections: [
                {
                    title: t('legal.pages.disclaimer.sections.availability.title'),
                    icon: Server,
                    body: [
                        t('legal.pages.disclaimer.sections.availability.body1'),
                        t('legal.pages.disclaimer.sections.availability.body2'),
                    ],
                },
                {
                    title: t('legal.pages.disclaimer.sections.output.title'),
                    icon: Sparkles,
                    tone: 'arcane',
                    body: [t('legal.pages.disclaimer.sections.output.body1'), t('legal.pages.disclaimer.sections.output.body2')],
                },
                {
                    title: t('legal.pages.disclaimer.sections.voice.title'),
                    icon: Mic,
                    body: [t('legal.pages.disclaimer.sections.voice.body1'), t('legal.pages.disclaimer.sections.voice.body2')],
                },
                {
                    title: t('legal.pages.disclaimer.sections.rules.title'),
                    icon: Ban,
                    body: [t('legal.pages.disclaimer.sections.rules.body1'), t('legal.pages.disclaimer.sections.rules.body2')],
                },
                {
                    title: t('legal.pages.disclaimer.sections.risk.title'),
                    icon: Database,
                    tone: 'arcane',
                    body: [t('legal.pages.disclaimer.sections.risk.body1'), t('legal.pages.disclaimer.sections.risk.body2')],
                },
            ],
        },
    }
}
