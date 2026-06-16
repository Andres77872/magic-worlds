import type { LucideIcon } from 'lucide-react'
import type { TFunction } from 'i18next'
import {
    Ban,
    BookOpenText,
    Cookie,
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
                    title: t('legal.pages.privacy.sections.cookies.title'),
                    icon: Cookie,
                    tone: 'arcane',
                    body: [
                        t('legal.pages.privacy.sections.cookies.body1'),
                        t('legal.pages.privacy.sections.cookies.body2'),
                        t('legal.pages.privacy.sections.cookies.body3'),
                        t('legal.pages.privacy.sections.cookies.body4'),
                    ],
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
