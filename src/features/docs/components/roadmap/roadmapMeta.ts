/**
 * Visual vocabulary for roadmap statuses. Every status pairs a distinct icon
 * shape with its text label, so status never relies on color alone (WCAG 1.4.1).
 */
import type { LucideIcon } from 'lucide-react'
import { CircleCheck, CircleDashed, CircleDot, CirclePause, Circle } from 'lucide-react'
import type { BadgeTone } from '@/ui/primitives'
import type { PhaseStatus, RoadmapInitiativeId, RoadmapStage } from '../roadmapContent'

export const STAGE_META: Record<RoadmapStage, { icon: LucideIcon; tone: BadgeTone; text: string }> = {
    available: { icon: CircleCheck, tone: 'live', text: 'text-verdant-500' },
    progress: { icon: CircleDot, tone: 'ember', text: 'text-ember-300' },
    off: { icon: CirclePause, tone: 'warning', text: 'text-amber-500' },
    planned: { icon: CircleDashed, tone: 'neutral', text: 'text-parchment-200' },
}

export const PHASE_META: Record<PhaseStatus, { icon: LucideIcon; tone: BadgeTone; marker: string }> = {
    done: { icon: CircleCheck, tone: 'live', marker: 'bg-verdant-500/15 text-verdant-500 ring-1 ring-inset ring-verdant-500/40' },
    current: { icon: CircleDot, tone: 'ember', marker: 'bg-ember-500/20 text-ember-200 ring-2 ring-ember-500 shadow-glow-ember-soft' },
    planned: { icon: Circle, tone: 'neutral', marker: 'bg-ink-700 text-parchment-200 ring-1 ring-inset ring-line-strong' },
    considering: { icon: CircleDashed, tone: 'neutral', marker: 'bg-ink-800 text-parchment-300 border border-dashed border-line-strong' },
}

/** Stable in-page anchors for the initiative panels (`#/docs?view=roadmap&section=…`). */
export const INITIATIVE_ANCHORS: Record<RoadmapInitiativeId, string> = {
    novels: 'novel-studio',
    charaStudio: 'chara-studio',
    appAssistant: 'assistant-tools',
    contentSafety: 'content-safety',
}

export const ROADMAP_AREAS_ANCHOR = 'roadmap-areas'

export const ROADMAP_DONE_ANCHOR = 'roadmap-done'
