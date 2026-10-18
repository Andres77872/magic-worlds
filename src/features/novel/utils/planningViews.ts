/** Pure derivations behind the planning views; they never copy scene content. */

import type { StoryChapterStatus, StoryOutline } from '@/shared'
import { chaptersFor } from './novelUtils'

export type PlanningView = 'board' | 'timeline' | 'matrix' | 'facts' | 'summaries'

export interface PlanningScene {
    id: string
    title: string
    chapterId: string
    chapterTitle: string
    partId: string | null
    /** 1-based position in reading order. */
    reading: number
    status: StoryChapterStatus | null
    povCardId: string | null
    castIds: string[]
    plotThreads: string[]
    storyTimeOrder: number | null
    narrativeTime: string | null
    synopsis: string | null
    words: number | null
}

/** Visible scenes in reading order with their effective metadata. */
export function planningScenes(story: StoryOutline): PlanningScene[] {
    const rows: PlanningScene[] = []
    for (const chapter of chaptersFor(story)) {
        for (const scene of [...chapter.scenes].filter((item) => !item.trashedAt).sort((a, b) => a.order - b.order)) {
            const details = scene.details ?? {}
            const order = details.storyTimeOrder
            rows.push({
                id: scene.id, title: scene.title, chapterId: chapter.id, chapterTitle: chapter.title, partId: chapter.partId,
                reading: rows.length + 1,
                status: scene.status ?? scene.inheritance?.values.status ?? null,
                povCardId: scene.povCardId ?? scene.inheritance?.values.povCardId ?? null,
                castIds: Array.isArray(details.castIds) ? details.castIds : [],
                plotThreads: Array.isArray(details.plotThreads) ? details.plotThreads : [],
                storyTimeOrder: typeof order === 'number' && Number.isFinite(order) ? order : null,
                narrativeTime: details.narrativeTime || null,
                synopsis: details.synopsis || null,
                words: scene.statistics?.wordCount ?? null,
            })
        }
    }
    return rows
}

/**
 * Story chronology, separate from reading order. A timed scene is a flashback
 * when it is read after a scene that happens later; unknown times stay apart.
 */
export function storyTimeline(scenes: PlanningScene[]) {
    const flashbacks = new Set<string>()
    let latest = -Infinity
    for (const scene of scenes) {
        if (scene.storyTimeOrder === null) continue
        if (scene.storyTimeOrder < latest) flashbacks.add(scene.id)
        latest = Math.max(latest, scene.storyTimeOrder)
    }
    const timed = scenes.filter((scene) => scene.storyTimeOrder !== null)
        .sort((a, b) => (a.storyTimeOrder as number) - (b.storyTimeOrder as number) || a.reading - b.reading)
    return { timed, unknown: scenes.filter((scene) => scene.storyTimeOrder === null), flashbacks }
}

/** Matrix rows in order of first appearance: characters (cast or POV) and plot threads. */
export function sceneMatrix(scenes: PlanningScene[]) {
    const characters: string[] = [], threads: string[] = []
    for (const scene of scenes) {
        for (const id of [scene.povCardId, ...scene.castIds]) if (id && !characters.includes(id)) characters.push(id)
        for (const thread of scene.plotThreads) if (thread && !threads.includes(thread)) threads.push(thread)
    }
    return { characters, threads }
}

export interface FactPlacement<T> {
    /** Facts holding at the chosen scene (reading order). */
    holding: T[]
    /** Facts whose start or end scene is no longer in the visible outline. */
    unplaced: T[]
}

type ScopedFact = { id: string; state: string; data: { subject: string; kind: string; statement: string; object?: string; fromSceneId?: string; untilSceneId?: string } }

/**
 * A fact holds from its start scene up to, but not including, its end scene.
 * Without a start it holds from the beginning; without an end, to the last scene.
 */
export function factsAt<T extends ScopedFact>(facts: T[], scenes: PlanningScene[], sceneId: string | null): FactPlacement<T> {
    const position = new Map(scenes.map((scene) => [scene.id, scene.reading]))
    const at = sceneId === null ? Infinity : position.get(sceneId) ?? Infinity
    const holding: T[] = [], unplaced: T[] = []
    for (const fact of facts) {
        if (fact.state === 'trashed' || fact.state === 'rejected') continue
        const from = fact.data.fromSceneId === undefined ? -Infinity : position.get(fact.data.fromSceneId)
        const until = fact.data.untilSceneId === undefined ? Infinity : position.get(fact.data.untilSceneId)
        if (from === undefined || until === undefined) { unplaced.push(fact); continue }
        if (from <= at && at < until) holding.push(fact)
    }
    return { holding, unplaced }
}

const SINGLE_VALUED = new Set(['location', 'state'])
const normalized = (value: string | undefined) => (value ?? '').trim().toLocaleLowerCase()

/**
 * Approved facts that cannot both be true at once: one subject in two locations
 * or states, or two different statements about the same relationship/possession
 * object. The author resolves them; nothing is changed automatically.
 */
/** Two single-valued facts agree when they name the same place or state: both objects match, or one names what the other's statement mentions. */
function samePlace(a: ScopedFact['data'], b: ScopedFact['data']) {
    if (a.object && b.object) return normalized(a.object) === normalized(b.object)
    const named = a.object ?? b.object, other = a.object ? b : a
    return Boolean(named && normalized(named) && normalized(other.statement).includes(normalized(named)))
}

export function factConflicts<T extends ScopedFact>(holding: T[]): Array<[T, T]> {
    const approved = holding.filter((fact) => fact.state === 'approved')
    const pairs: Array<[T, T]> = []
    for (let i = 0; i < approved.length; i++) for (let j = i + 1; j < approved.length; j++) {
        const a = approved[i].data, b = approved[j].data
        if (normalized(a.subject) !== normalized(b.subject) || a.kind !== b.kind || normalized(a.statement) === normalized(b.statement)) continue
        if (SINGLE_VALUED.has(a.kind) ? !samePlace(a, b) : (a.kind === 'relationship' || a.kind === 'possession') && a.object && normalized(a.object) === normalized(b.object)) pairs.push([approved[i], approved[j]])
    }
    return pairs
}
