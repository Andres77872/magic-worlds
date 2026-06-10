/**
 * The two play modes and their single-source vocabulary. Every surface that names,
 * badges, or explains a mode (buttons, shelves, badges, onboarding) reads from
 * MODE_META so the wording and color language stay consistent app-wide:
 * ember = Adventure (GM-led role-play), arcane = Chat (1:1 conversation).
 */
import type { LucideIcon } from 'lucide-react'
import { MessageCircle, Swords } from 'lucide-react'

export type PlayMode = 'adventure' | 'chat'

export interface PlayModeMeta {
    label: string
    icon: LucideIcon
    tone: 'ember' | 'arcane'
    /** One-line "what is this mode" descriptor for shelf subtitles and badges. */
    tagline: string
    beginLabel: string
    resumeLabel: string
}

export const MODE_META: Record<PlayMode, PlayModeMeta> = {
    adventure: {
        label: 'Adventure',
        icon: Swords,
        tone: 'ember',
        tagline: 'Game Master–led sessions',
        beginLabel: 'Begin adventure',
        resumeLabel: 'Continue',
    },
    chat: {
        label: 'Chat',
        icon: MessageCircle,
        tone: 'arcane',
        tagline: 'One-on-one conversations',
        beginLabel: 'Chat',
        resumeLabel: 'Resume chat',
    },
}
