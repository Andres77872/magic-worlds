/**
 * The Voice studio deep link to one preset (`#/voices?preset=<id>`, R1-FE-02):
 * the review-flag "Adjust" target for presets. `pageFromHash` ignores the
 * query, so the page stays the studio; the V2 studio opens that preset's editor.
 */
import { pageHash } from '@/features/gallery/galleryLinks'

const PARAM = 'preset'

export function buildPresetEditHash(presetId: string): string {
    return `${pageHash('voice-studio')}?${new URLSearchParams({ [PARAM]: presetId }).toString()}`
}

export function parsePresetEditHash(hash: string = typeof window === 'undefined' ? '' : window.location.hash): string | null {
    const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
    const [path, query = ''] = withoutHash.split('?')
    if (`#${path}` !== pageHash('voice-studio')) return null
    return new URLSearchParams(query).get(PARAM) || null
}
