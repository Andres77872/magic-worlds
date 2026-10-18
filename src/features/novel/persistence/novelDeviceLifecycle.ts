import type { StoryOutline, StoryStudioSource, StoryUnitMetadata } from '@/shared'
import { verifyStoryStudioSource } from '@/infrastructure/api/storyStudioContract'
import { verifyStory } from '@/infrastructure/api/storyContract'
import { canonicalJson } from '@/utils/json'

export interface LifecycleHead { revision: number; readOnly: boolean }
export interface LifecycleStructure { revision: number; parents: Record<string, string | null>; scenes: string[] }
export interface NovelDeviceLifecycle {
    root: LifecycleHead | null
    units: Record<string, LifecycleHead>
    structure: LifecycleStructure | null
    ambiguousStructure: number | null
    erased: boolean
}
export const emptyNovelLifecycle = (): NovelDeviceLifecycle => ({ root: null, units: {}, structure: null, ambiguousStructure: null, erased: false })
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const owns = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key)
const head = (value: unknown): value is LifecycleHead => record(value) && Object.keys(value).length === 2 && positive(value.revision) && typeof value.readOnly === 'boolean'
export function validNovelLifecycle(value: unknown): value is NovelDeviceLifecycle {
    if (!record(value) || Object.keys(value).length !== 5 || !(value.root === null || head(value.root)) || !record(value.units)
        || !Object.entries(value.units).every(([id, value]) => id.length > 0 && head(value)) || typeof value.erased !== 'boolean'
        || !(value.ambiguousStructure === null || positive(value.ambiguousStructure))) return false
    if (value.structure === null) return value.ambiguousStructure === null
    const structure = value.structure
    if (!record(structure) || Object.keys(structure).length !== 3 || !positive(structure.revision) || !record(structure.parents)
        || !Array.isArray(structure.scenes) || !structure.scenes.every((id) => typeof id === 'string' && id.length > 0 && owns(structure.parents as object, id))
        || new Set(structure.scenes).size !== structure.scenes.length || !(value.ambiguousStructure === null || value.ambiguousStructure === structure.revision)) return false
    for (const [id, parent] of Object.entries(structure.parents)) {
        if (!id || !owns(value.units, id) || !(parent === null || typeof parent === 'string' && owns(structure.parents, parent))) return false
        const seen = new Set([id]); let next: unknown = parent
        while (typeof next === 'string') { if (seen.has(next) || seen.size >= 3) return false; seen.add(next); next = structure.parents[next] }
        if (next !== null) return false
    }
    return true
}
function newestHead(previous: LifecycleHead | null | undefined, incoming: LifecycleHead): LifecycleHead {
    if (!previous || incoming.revision > previous.revision) return incoming
    if (incoming.revision < previous.revision) return previous
    return previous.readOnly || !incoming.readOnly ? previous : incoming
}
/** Independent metadata revisions and placement revisions keep their own order. */
export function mergeNovelLifecycle(previous: NovelDeviceLifecycle | null, incoming: NovelDeviceLifecycle): NovelDeviceLifecycle {
    if (previous?.erased) return structuredClone(previous)
    const result = structuredClone(previous ?? emptyNovelLifecycle())
    if (incoming.root) result.root = newestHead(result.root, incoming.root)
    for (const [id, value] of Object.entries(incoming.units)) Object.defineProperty(result.units, id, { value: newestHead(owns(result.units, id) ? result.units[id] : null, value), enumerable: true, writable: true, configurable: true })
    if (incoming.structure && (!result.structure || incoming.structure.revision > result.structure.revision)) {
        result.structure = incoming.structure; result.ambiguousStructure = incoming.ambiguousStructure
    } else if (incoming.structure && result.structure?.revision === incoming.structure.revision
        && (incoming.ambiguousStructure !== null || canonicalJson(result.structure) !== canonicalJson(incoming.structure))) result.ambiguousStructure = incoming.structure.revision
    result.erased ||= incoming.erased
    return structuredClone(result)
}
const unitHead = (unit: StoryUnitMetadata): LifecycleHead => ({ revision: unit.metadataRevision, readOnly: unit.status === 'archived' || Boolean(unit.trashedAt || unit.mergedInto) })
/** No prose, titles, summaries or inherited workspace/root flags enter this projection. */
export function novelLifecycleObservation(source: StoryOutline | StoryStudioSource, workspaceId: string): NovelDeviceLifecycle | null {
    if (source.organization?.workspace_id !== workspaceId) return null
    const indexed = verifyStoryStudioSource(source)
    if (!indexed && !verifyStory(source, source.id, true)) return null
    const result = emptyNovelLifecycle()
    result.root = { revision: source.metadataRevision, readOnly: source.status === 'archived' || Boolean(source.trashedAt) }
    if (!indexed && 'summary' in source && source.summary) return result
    const parents: Record<string, string | null> = {}, scenes: string[] = []
    for (const part of source.parts) { Object.defineProperty(parents, part.id, { value: null, enumerable: true }); Object.defineProperty(result.units, part.id, { value: unitHead(part), enumerable: true }) }
    for (const chapter of source.chapters) {
        Object.defineProperty(parents, chapter.id, { value: chapter.partId, enumerable: true }); Object.defineProperty(result.units, chapter.id, { value: unitHead(chapter), enumerable: true })
        for (const scene of chapter.scenes) {
            Object.defineProperty(parents, scene.id, { value: chapter.id, enumerable: true }); Object.defineProperty(result.units, scene.id, { value: unitHead(scene), enumerable: true }); scenes.push(scene.id)
        }
    }
    result.structure = { revision: source.structureRevision, parents, scenes: scenes.sort() }
    return validNovelLifecycle(result) ? result : null
}
/** Missing/removed structure remains readable as a copy, without permitting new edits. */
export function deviceSceneReadOnly(state: NovelDeviceLifecycle | null, sceneId: string): boolean | null {
    if (!state) return null
    if (state.erased || state.root?.readOnly || state.ambiguousStructure !== null) return true
    if (!state.root || !state.structure) return null
    if (!state.structure.scenes.includes(sceneId)) return true
    let id: string | null = sceneId
    const seen = new Set<string>()
    while (id !== null) {
        if (seen.has(id) || !owns(state.units, id) || !owns(state.structure.parents, id)) return true
        seen.add(id)
        if (state.units[id].readOnly) return true
        id = state.structure.parents[id]
    }
    return false
}
