import type { LucideIcon } from 'lucide-react'
import { BookOpen, BookOpenText, Compass, FileText, Gem, Globe, Library, Swords, UserCircle, Users } from 'lucide-react'
import type { FocusKind, FocusRef, KnowledgeSourceKey } from '../appKnowledge'

export const SOURCE_ICONS: Record<KnowledgeSourceKey, LucideIcon> = {
    guide: Compass,
    library: Library,
    lorebooks: BookOpen,
    resources: FileText,
    novels: BookOpenText,
}

export const FOCUS_ICONS: Record<FocusKind, LucideIcon> = {
    character: Users,
    persona: UserCircle,
    world: Globe,
    item: Gem,
    adventure: Swords,
    lorebook: BookOpen,
    resource: FileText,
    novel: BookOpenText,
}

/** A focused record with its display name, as the panel and picker show it. */
export interface FocusChip extends FocusRef {
    name: string
}
