import type { LorebookResource } from '@/shared'

/** Badge tone for a resource's extraction status: completed → live, failed → danger, else arcane. */
export function statusTone(resource: LorebookResource): 'live' | 'danger' | 'arcane' {
    if (resource.extractionStatus === 'completed') return 'live'
    if (resource.extractionStatus === 'failed') return 'danger'
    return 'arcane'
}
