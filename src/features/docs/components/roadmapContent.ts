/**
 * Roadmap structure for the Docs "Roadmap" view: one summary per product area,
 * the featured initiatives whose phases mirror the planning dossiers
 * (`docs/novel_refactor/14_status_and_roadmap.md`, D1–D6;
 * `docs/chara_studio/08_roadmap_and_gaps.md`, CHARA-1–9;
 * `docs/assistant_improvement/11_implementation_plan.md`, P0–P5; and
 * `docs/moderation/10_rollout_risks_and_decisions.md`, MOD-01–06), and a short
 * list of recently completed work. Ids, build state, gates and phase order live here;
 * user-facing copy resolves through i18n.
 *
 * Keep this public summary aligned with docs/FEATURE_STATUS.md and
 * docs/ROADMAP.md. Phases express dependency order, never dates.
 */

import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import { BookOpenText, Bot, Palette, ShieldCheck } from 'lucide-react'
import { docsArt } from '@/assets/marketing'
import { isFeatureEnabled, type FrontendFeatureFlag } from '@/shared/featureFlags'

/** Implementation scope, independent of whether this build turns it on. */
export type RoadmapState = 'implemented' | 'partial' | 'planned'

/** The single user-facing status an area shows: build state combined with this version's gate. */
export type RoadmapStage = 'available' | 'progress' | 'off' | 'planned'

export const ROADMAP_STAGES: readonly RoadmapStage[] = ['available', 'progress', 'off', 'planned']

export type PhaseStatus = 'done' | 'current' | 'planned' | 'considering'

export type RoadmapInitiativeId = 'novels' | 'charaStudio' | 'appAssistant' | 'contentSafety'

export interface DocsRoadmapItem {
    id: string
    title: string
    /** Build-state label (implemented / partial / planned). */
    status: string
    /** Availability label for this version (enabled / disabled / core / not yet). */
    availability: string
    current: string
    next: string
    decision: string
    state: RoadmapState
    enabled: boolean | null
    stage: RoadmapStage
    /** Set when a featured initiative panel details this area's phases. */
    initiative?: RoadmapInitiativeId
}

export interface RoadmapPhase {
    id: string
    /** 1-based position in dependency order. */
    number: number
    status: PhaseStatus
    statusLabel: string
    title: string
    body: string
    /** Earlier phase numbers this one builds on. */
    dependsOn: number[]
    /** "Builds on phase 1 and 2" — empty when the phase has no prerequisite. */
    dependsLabel: string
}

export interface RoadmapInitiative {
    id: RoadmapInitiativeId
    icon: LucideIcon
    art?: string
    title: string
    tagline: string
    stage: RoadmapStage
    /** What already exists, shown apart from what is coming. */
    today: string[]
    phases: RoadmapPhase[]
    /** Explicit scope boundary (what is not planned), so expectations stay honest. */
    scope: string
    /** "Phase 1 of 6 in progress" or "5 phases planned — not started". */
    progress: string
}

/** A bounded piece of finished work, shown apart from what is still open. */
export interface RoadmapDoneEntry {
    id: string
    /** Roadmap area key this work belongs to. */
    area: string
    areaTitle: string
    title: string
    body: string
}

export interface DocsRoadmap {
    title: string
    intro: string
    reviewed: string
    /** ISO date for `<time dateTime>`; keep in step with `docs.roadmap.reviewed`. */
    reviewedDate: string
    note: string
    labels: {
        current: string
        next: string
        decision: string
        build: string
        today: string
        coming: string
        scope: string
        viewPhases: string
        nextUp: string
        jump: string
        areas: string
        areasIntro: string
        filter: string
        all: string
        allDescription: string
        emptyTitle: string
        emptyBody: string
        noAreas: string
        showAll: string
        builtSoFar: string
        done: string
        doneIntro: string
        doneArea: string
    }
    stages: Record<RoadmapStage, { label: string; description: string }>
    items: DocsRoadmapItem[]
    initiatives: RoadmapInitiative[]
    done: RoadmapDoneEntry[]
}

export const ROADMAP_REVIEWED_DATE = '2026-10-15'

const ROADMAP_SOURCES: readonly {
    key: string
    state: RoadmapState
    feature?: FrontendFeatureFlag
    initiative?: RoadmapInitiativeId
}[] = [
    { key: 'core', state: 'implemented' },
    { key: 'models', state: 'partial' },
    { key: 'novels', state: 'partial', feature: 'novels', initiative: 'novels' },
    { key: 'charaStudio', state: 'planned', initiative: 'charaStudio' },
    { key: 'lorebooks', state: 'implemented', feature: 'lorebooks' },
    { key: 'resources', state: 'implemented', feature: 'lorebookResources' },
    { key: 'workspaces', state: 'implemented',  },
    { key: 'adventures', state: 'implemented', feature: 'adventures' },
    { key: 'groupChats', state: 'implemented', feature: 'groupChats' },
    { key: 'community', state: 'implemented', feature: 'communityCards' },
    { key: 'voices', state: 'partial', feature: 'voices' },
    { key: 'calls', state: 'partial', feature: 'calls' },
    // Calls are 1:1 today (the BFF refuses group callbots); multi-character calls are planned.
    { key: 'groupCalls', state: 'planned' },
    { key: 'appAssistant', state: 'implemented', feature: 'appAssistant', initiative: 'appAssistant' },
    { key: 'contentSafety', state: 'partial', initiative: 'contentSafety' },
    { key: 'billing', state: 'implemented',  },
    { key: 'patreon', state: 'planned' },
]

/** Finished, bounded work confirmed against source in the latest review (newest first). */
const DONE_SOURCES: readonly { id: string; area: string }[] = [
    { id: 'callChatReplay', area: 'calls' },
    { id: 'chatStream', area: 'core' },
    { id: 'savedHistory', area: 'adventures' },
    { id: 'voiceCatalog', area: 'voices' },
    { id: 'planVoiceLimits', area: 'billing' },
    { id: 'assistantPreviews', area: 'appAssistant' },
]

/** Phase order and prerequisites from the Novel refactor dossier (D1–D6). */
const NOVEL_PHASES: readonly { id: string; status: PhaseStatus; dependsOn: number[] }[] = [
    { id: 'reliable', status: 'current', dependsOn: [] },
    { id: 'structure', status: 'planned', dependsOn: [1] },
    { id: 'assistant', status: 'planned', dependsOn: [1, 2] },
    { id: 'planning', status: 'planned', dependsOn: [2, 3] },
    { id: 'delivery', status: 'planned', dependsOn: [1, 2] },
    { id: 'series', status: 'planned', dependsOn: [2, 3, 4, 5] },
]

/** Chara Studio backlog grouped into user-visible phases (CHARA-1/4, 2/3/5, 6/7, 8, 9). */
const CHARA_PHASES: readonly { id: string; status: PhaseStatus; dependsOn: number[] }[] = [
    { id: 'references', status: 'planned', dependsOn: [] },
    { id: 'edit', status: 'planned', dependsOn: [1] },
    { id: 'scenes', status: 'planned', dependsOn: [1, 2] },
    { id: 'rollout', status: 'planned', dependsOn: [2, 3] },
    { id: 'masks', status: 'considering', dependsOn: [2] },
]

/** Main assistant improvement grouped into user-visible phases (P0/P1, P2, P3, P4, P5). */
const ASSISTANT_PHASES: readonly { id: string; status: PhaseStatus; dependsOn: number[] }[] = [
    { id: 'shared', status: 'planned', dependsOn: [] },
    { id: 'edit', status: 'planned', dependsOn: [1] },
    { id: 'search', status: 'planned', dependsOn: [1, 2] },
    { id: 'rollout', status: 'planned', dependsOn: [2, 3] },
    { id: 'extensions', status: 'considering', dependsOn: [3] },
]

/** Native moderation work packages as user-visible phases (MOD-01, 02/03, 04, 05, 06). */
const SAFETY_PHASES: readonly { id: string; status: PhaseStatus; dependsOn: number[] }[] = [
    { id: 'checker', status: 'planned', dependsOn: [] },
    { id: 'profiles', status: 'planned', dependsOn: [1] },
    { id: 'guards', status: 'planned', dependsOn: [1, 2] },
    { id: 'media', status: 'planned', dependsOn: [1, 3] },
    { id: 'rollout', status: 'planned', dependsOn: [3, 4] },
]

const INITIATIVE_SOURCES: readonly {
    id: RoadmapInitiativeId
    icon: LucideIcon
    art?: string
    today: readonly string[]
    phases: typeof NOVEL_PHASES
}[] = [
    {
        id: 'novels',
        icon: BookOpenText,
        art: docsArt.writing,
        today: ['gallery', 'editor', 'codex', 'inline', 'history'],
        phases: NOVEL_PHASES,
    },
    {
        id: 'charaStudio',
        icon: Palette,
        art: docsArt.media,
        today: ['portraits', 'uploads', 'history', 'library'],
        phases: CHARA_PHASES,
    },
    {
        id: 'appAssistant',
        icon: Bot,
        art: docsArt.library,
        today: ['answers', 'sources', 'editors', 'controls'],
        phases: ASSISTANT_PHASES,
    },
    {
        id: 'contentSafety',
        icon: ShieldCheck,
        art: docsArt['best-practices'],
        today: ['speech', 'charges', 'providers'],
        phases: SAFETY_PHASES,
    },
]

export function roadmapStage(state: RoadmapState, enabled: boolean | null): RoadmapStage {
    if (state === 'planned') return 'planned'
    if (enabled === false) return 'off'
    return state === 'partial' ? 'progress' : 'available'
}

function featureEnabled(feature: FrontendFeatureFlag | undefined): boolean | null {
    return feature ? isFeatureEnabled(feature) : null
}

function roadmapItems(t: TFunction): DocsRoadmapItem[] {
    return ROADMAP_SOURCES.map(({ key, state, feature, initiative }) => {
        const enabled = featureEnabled(feature)
        const availability = state === 'planned' ? 'planned' : enabled === null ? 'ungated' : enabled ? 'enabled' : 'disabled'
        return {
            id: key,
            state,
            enabled,
            stage: roadmapStage(state, enabled),
            initiative,
            title: t(`docs.roadmap.items.${key}.title`),
            status: t(`docs.roadmap.statuses.${state}`),
            availability: t(`docs.roadmap.availability.${availability}`),
            current: t(`docs.roadmap.items.${key}.current`),
            next: t(`docs.roadmap.items.${key}.next`),
            decision: t(`docs.roadmap.items.${key}.decision`),
        }
    })
}

function initiativeProgress(t: TFunction, phases: readonly RoadmapPhase[]): string {
    const current = phases.find((phase) => phase.status === 'current')
    if (current) return t('docs.roadmap.progress.current', { current: current.number, total: phases.length })
    const done = phases.filter((phase) => phase.status === 'done').length
    if (done) return t('docs.roadmap.progress.done', { done, total: phases.length })
    return t('docs.roadmap.progress.notStarted', { count: phases.length })
}

function roadmapInitiatives(t: TFunction, items: readonly DocsRoadmapItem[]): RoadmapInitiative[] {
    return INITIATIVE_SOURCES.map((source) => {
        const prefix = `docs.roadmap.initiatives.${source.id}`
        const phases: RoadmapPhase[] = source.phases.map((phase, index) => ({
            id: phase.id,
            number: index + 1,
            status: phase.status,
            statusLabel: t(`docs.roadmap.phaseStatus.${phase.status}`),
            title: t(`${prefix}.phases.${phase.id}.title`),
            body: t(`${prefix}.phases.${phase.id}.body`),
            dependsOn: phase.dependsOn,
            dependsLabel: phase.dependsOn.length
                ? t('docs.roadmap.dependsOn', { count: phase.dependsOn.length, phases: formatList(t, phase.dependsOn.map(String)) })
                : '',
        }))
        return {
            id: source.id,
            icon: source.icon,
            art: source.art,
            title: t(`${prefix}.title`),
            tagline: t(`${prefix}.tagline`),
            scope: t(`${prefix}.scope`),
            stage: items.find((item) => item.initiative === source.id)?.stage ?? 'planned',
            today: source.today.map((key) => t(`${prefix}.today.${key}`)),
            phases,
            progress: initiativeProgress(t, phases),
        }
    })
}

/** "1, 2 and 3" in the active language. */
function formatList(t: TFunction, values: string[]): string {
    if (values.length < 2) return values.join('')
    return `${values.slice(0, -1).join(', ')} ${t('docs.roadmap.and')} ${values[values.length - 1]}`
}

export function getRoadmapContent(t: TFunction): DocsRoadmap {
    const items = roadmapItems(t)
    return {
        title: t('docs.roadmap.title'),
        intro: t('docs.roadmap.intro'),
        reviewed: t('docs.roadmap.reviewed'),
        reviewedDate: ROADMAP_REVIEWED_DATE,
        note: t('docs.roadmap.note'),
        labels: {
            current: t('docs.roadmap.labels.current'),
            next: t('docs.roadmap.labels.next'),
            decision: t('docs.roadmap.labels.decision'),
            build: t('docs.roadmap.labels.build'),
            today: t('docs.roadmap.labels.today'),
            coming: t('docs.roadmap.labels.coming'),
            scope: t('docs.roadmap.labels.scope'),
            viewPhases: t('docs.roadmap.labels.viewPhases'),
            nextUp: t('docs.roadmap.labels.nextUp'),
            jump: t('docs.roadmap.labels.jump'),
            areas: t('docs.roadmap.labels.areas'),
            areasIntro: t('docs.roadmap.labels.areasIntro'),
            filter: t('docs.roadmap.labels.filter'),
            all: t('docs.roadmap.labels.all'),
            allDescription: t('docs.roadmap.labels.allDescription'),
            emptyTitle: t('docs.roadmap.labels.emptyTitle'),
            emptyBody: t('docs.roadmap.labels.emptyBody'),
            noAreas: t('docs.roadmap.labels.noAreas'),
            showAll: t('docs.roadmap.labels.showAll'),
            builtSoFar: t('docs.roadmap.labels.builtSoFar'),
            done: t('docs.roadmap.labels.done'),
            doneIntro: t('docs.roadmap.labels.doneIntro'),
            doneArea: t('docs.roadmap.labels.doneArea'),
        },
        stages: Object.fromEntries(
            ROADMAP_STAGES.map((stage) => [
                stage,
                { label: t(`docs.roadmap.stages.${stage}.label`), description: t(`docs.roadmap.stages.${stage}.description`) },
            ]),
        ) as DocsRoadmap['stages'],
        items,
        initiatives: roadmapInitiatives(t, items),
        done: DONE_SOURCES.map(({ id, area }) => ({
            id,
            area,
            areaTitle: items.find((item) => item.id === area)?.title ?? '',
            title: t(`docs.roadmap.done.${id}.title`),
            body: t(`docs.roadmap.done.${id}.body`),
        })),
    }
}

/** Lowercased haystack for one area card (search + filter). */
export function roadmapItemSearchText(item: DocsRoadmapItem): string {
    return [item.title, item.status, item.availability, item.current, item.next, item.decision].join(' ').toLowerCase()
}

/** Lowercased haystack for one recently completed entry. */
export function roadmapDoneSearchText(entry: RoadmapDoneEntry): string {
    return [entry.areaTitle, entry.title, entry.body].join(' ').toLowerCase()
}

/** Lowercased haystack for one initiative panel. */
export function initiativeSearchText(initiative: RoadmapInitiative): string {
    return [
        initiative.title,
        initiative.tagline,
        initiative.scope,
        initiative.progress,
        ...initiative.today,
        ...initiative.phases.flatMap((phase) => [phase.title, phase.body, phase.statusLabel]),
    ]
        .join(' ')
        .toLowerCase()
}
