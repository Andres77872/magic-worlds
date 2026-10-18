import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { StoryManuscriptDocument } from '@/shared'
import { documentSignature } from '@/shared/storyDocument'

/** A small content binding for saved selections; preferences never store prose. */
export async function positionDocumentFingerprint(document: StoryManuscriptDocument): Promise<string | null> {
    try {
        if (!globalThis.crypto?.subtle) return null
        const bytes = new TextEncoder().encode(documentSignature(document))
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    } catch { return null }
}
const fingerprints = new WeakMap<ProseMirrorNode, Promise<string | null>>()
/** Only requested for non-collapsed ranges, once per immutable document. */
export function editorPositionFingerprint(document: ProseMirrorNode) {
    let result = fingerprints.get(document)
    if (!result) {
        result = positionDocumentFingerprint({ schemaVersion: 1, content: document.toJSON() })
        fingerprints.set(document, result)
    }
    return result
}
