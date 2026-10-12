import type { LorebookResource } from '@/shared'

export function resourceStatusKey(resource: LorebookResource): string {
    const status = resource.metadataOutdated ? 'outdated' : resource.extractionStatus ?? 'pending'
    return `lorebookResourcesGallery.status.${status}`
}

/** Unsynced metadata is idle; the active task supplies its own arcane state. */
export function statusTone(resource: LorebookResource): 'live' | 'danger' | 'neutral' {
    if (resource.extractionStatus === 'completed') return 'live'
    if (resource.extractionStatus === 'failed') return 'danger'
    return 'neutral'
}
