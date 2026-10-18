import type { CardIdentity, CardSourceStatusList } from '@/shared/types/workspace.types'

export function isCardSourceStatusList(value: unknown, requested: readonly CardIdentity[]): value is CardSourceStatusList {
    if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) return false
    const keys = new Set(requested.map((card) => `${card.card_type}:${card.card_id}`))
    if (value.items.length !== keys.size) return false
    for (const item of value.items) {
        if (!item || typeof item !== 'object' || !keys.delete(`${item.card_type}:${item.card_id}`)) return false
        if (typeof item.available !== 'boolean') return false
        if (!item.available) {
            if (item.latest_version_id !== null || item.latest_version_number !== null || item.has_draft !== null) return false
        } else {
            const number = item.latest_version_number
            if (!Number.isSafeInteger(number) || number < 0 || typeof item.has_draft !== 'boolean') return false
            if (number === 0 ? item.latest_version_id !== null : typeof item.latest_version_id !== 'string' || !item.latest_version_id.trim()) return false
        }
    }
    return keys.size === 0
}
