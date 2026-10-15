import type { LucideIcon } from 'lucide-react'
import { BookOpen, Compass, FileText, Library, Mic, Swords } from 'lucide-react'
import type { KnowledgeSourceKey } from './appKnowledge'
import { isFeatureEnabled, type FrontendFeatureFlag } from '@/shared/featureFlags'

/**
 * Starter questions on the empty thread. Unlike the card assistant's starters,
 * these are the user's own question in their language, so both the chip copy
 * and the sent prompt are localized (`appAssistant.suggestions.<key>.*`).
 */
export interface AppAssistantSuggestion {
    key: string
    icon: LucideIcon
    tone: 'ember' | 'arcane'
    /** Hidden when this source is unavailable in the build. */
    requires?: KnowledgeSourceKey
    feature?: FrontendFeatureFlag
}

export const APP_ASSISTANT_SUGGESTIONS: readonly AppAssistantSuggestion[] = [
    { key: 'tour', icon: Compass, tone: 'ember', requires: 'guide' },
    { key: 'library', icon: Library, tone: 'arcane', requires: 'library' },
    { key: 'adventure', icon: Swords, tone: 'ember', requires: 'library', feature: 'adventures' },
    { key: 'lorebooks', icon: BookOpen, tone: 'arcane', requires: 'lorebooks', feature: 'lorebooks' },
    { key: 'resources', icon: FileText, tone: 'arcane', requires: 'resources', feature: 'lorebookResources' },
    { key: 'voices', icon: Mic, tone: 'ember', requires: 'guide', feature: 'voices' },
]

export function availableAssistantSuggestions(sources: readonly KnowledgeSourceKey[]): AppAssistantSuggestion[] {
    return APP_ASSISTANT_SUGGESTIONS.filter((suggestion) => (!suggestion.feature || isFeatureEnabled(suggestion.feature))
        && (!suggestion.requires || sources.includes(suggestion.requires)))
}
