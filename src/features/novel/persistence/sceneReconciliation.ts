import type { StoryDocumentNode, StoryManuscriptDocument } from '@/shared'
import { isStoryDocument } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'

export type ReconciliationSide = 'device' | 'account'
export interface SceneBlockConflict {
    id: string
    device: StoryDocumentNode | null
    account: StoryDocumentNode | null
}
interface BlockResolution extends SceneBlockConflict {
    resolved: StoryDocumentNode | null
    conflict: boolean
}
export interface SceneReconciliation {
    baseAvailable: boolean
    device: StoryManuscriptDocument
    account: StoryManuscriptDocument
    conflicts: readonly SceneBlockConflict[]
    orderConflict: boolean
    preferredOrder: ReconciliationSide
    automaticBlocks: number
    blocks: readonly BlockResolution[]
}

const same = (a: StoryDocumentNode | null, b: StoryDocumentNode | null) => canonicalJson(a) === canonicalJson(b)
const ids = (document: StoryManuscriptDocument) => document.content.content!.map((node) => String(node.attrs!.nodeId))
const blocks = (document: StoryManuscriptDocument) => new Map(document.content.content!.map((node) => [String(node.attrs!.nodeId), node]))

/**
 * Whole canonical blocks are the automatic merge boundary. Concurrent edits to
 * one block (including nested lists/marks/references) need an explicit choice.
 * This never guesses a text diff, normalizes rich content, or applies a write.
 */
export function reviewSceneReconciliation(
    base: StoryManuscriptDocument | null,
    device: StoryManuscriptDocument,
    account: StoryManuscriptDocument,
): SceneReconciliation | null {
    if (!isStoryDocument(device) || !isStoryDocument(account) || base !== null && !isStoryDocument(base)) return null
    const local = structuredClone(device), remote = structuredClone(account)
    const original = base ? blocks(base) : new Map<string, StoryDocumentNode>()
    const a = blocks(local), b = blocks(remote)
    const union = [...new Set([...original.keys(), ...a.keys(), ...b.keys()])]
    const resolutions: BlockResolution[] = union.map((id) => {
        const before = original.get(id) ?? null, deviceNode = a.get(id) ?? null, accountNode = b.get(id) ?? null
        const common = { id, device: deviceNode, account: accountNode }
        if (same(deviceNode, accountNode)) return { ...common, resolved: deviceNode, conflict: false }
        if (base && same(deviceNode, before)) return { ...common, resolved: accountNode, conflict: false }
        if (base && same(accountNode, before)) return { ...common, resolved: deviceNode, conflict: false }
        return { ...common, resolved: null, conflict: true }
    })
    const shared = new Set([...a.keys()].filter((id) => b.has(id) && (!base || original.has(id))))
    const sequence = (document: StoryManuscriptDocument) => ids(document).filter((id) => shared.has(id))
    const deviceOrder = canonicalJson(sequence(local)), accountOrder = canonicalJson(sequence(remote))
    const baseOrder = base ? canonicalJson(sequence(base)) : null
    const deviceMoved = baseOrder !== null && deviceOrder !== baseOrder
    const accountMoved = baseOrder !== null && accountOrder !== baseOrder
    return {
        baseAvailable: base !== null, device: local, account: remote,
        conflicts: resolutions.filter((item) => item.conflict).map(({ id, device, account }) => ({ id, device, account })),
        orderConflict: deviceOrder !== accountOrder && (baseOrder === null || deviceMoved && accountMoved),
        preferredOrder: deviceMoved && !accountMoved ? 'device' : 'account',
        automaticBlocks: resolutions.filter((item) => !item.conflict).length,
        blocks: resolutions,
    }
}

/** Preserve the chosen side's common-block order and anchor other additions. */
function weave(primary: string[], secondary: string[]): string[] {
    const next = new Map<string, string | null>(), previous = new Map<string, string | null>()
    let first: string | null = primary[0] ?? null, last: string | null = primary[primary.length - 1] ?? null
    primary.forEach((id, index) => {
        next.set(id, primary[index + 1] ?? null)
        previous.set(id, primary[index - 1] ?? null)
    })
    const following: (string | null)[] = []
    let nearest: string | null = null
    for (let index = secondary.length - 1; index >= 0; index -= 1) {
        following[index] = nearest
        if (next.has(secondary[index])) nearest = secondary[index]
    }
    let prior: string | null = null
    secondary.forEach((id, index) => {
        if (!next.has(id)) {
            const before: string | null = prior ?? (following[index] ? previous.get(following[index]!) ?? null : last)
            const after: string | null = before ? next.get(before) ?? null : first
            next.set(id, after); previous.set(id, before)
            if (before) next.set(before, id)
            else first = id
            if (after) previous.set(after, id)
            else last = id
        }
        prior = id
    })
    const result: string[] = []
    for (let id: string | null = first; id !== null; id = next.get(id) ?? null) result.push(id)
    return result
}

/** Return a review candidate only after every ambiguity has a deliberate choice. */
export function resolveSceneReconciliation(
    review: SceneReconciliation,
    choices: Readonly<Record<string, ReconciliationSide>>,
    order?: ReconciliationSide,
): StoryManuscriptDocument | null {
    if (review.orderConflict && order !== 'device' && order !== 'account') return null
    const selected = new Map<string, StoryDocumentNode | null>()
    for (const item of review.blocks) {
        if (item.conflict) {
            if (choices[item.id] !== 'device' && choices[item.id] !== 'account') return null
            selected.set(item.id, item[choices[item.id]])
        } else selected.set(item.id, item.resolved)
    }
    const side = order ?? review.preferredOrder
    const sequence = weave(ids(review[side]), ids(review[side === 'device' ? 'account' : 'device']))
    const content = sequence.flatMap((id) => selected.get(id) ? [structuredClone(selected.get(id)!)] : [])
    const candidate: StoryManuscriptDocument = { schemaVersion: 1, content: { ...structuredClone(review[side].content), content } }
    // Reparenting across blocks can create duplicate nested identities. An empty
    // or invalid candidate needs another explicit choice; never silently repair.
    return isStoryDocument(candidate) ? candidate : null
}
