/**
 * categorySerialization — the pure serialization core shared by the attribute
 * system and the guided-field engine. Cards persist enrichment as a flexible
 * `category` array (`[{ name, description?, attributes: [{ Key: "value" }] }]`);
 * these helpers convert between that API shape and the creators' form state.
 *
 * Extracted from `useAttributeCategories` so `useGuidedCard` can reuse the
 * exact same round-trip semantics. No behavior changes.
 */
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { generateUUID } from '@/utils/uuid'

export interface AttrRow {
    key: string
    value: string
}
export type AttrMap = Record<string, AttrRow[]>

/** The API category shape shared by characters / worlds / adventure templates / items. */
export interface ApiCategory {
    name: string
    description?: string
    attributes?: Array<Record<string, string>>
}

export interface EntityWithCategory {
    category?: ApiCategory[] | null
}

export function makeCategory(name: string, description: string): AttributeCategory {
    return { id: `custom_${generateUUID().slice(0, 8)}`, name, description: description || '', type: 'custom' }
}

export function rowsFromApi(attributes?: Array<Record<string, string>>): AttrRow[] {
    // Each attribute object may carry MORE than one key/value pair (AI-generated
    // cards return e.g. `{ "element": "arcane", "focus": "evocation" }`). Expand
    // every entry into its own row so nothing is silently dropped — `toCategoryPayload`
    // writes single-key objects, but reads must tolerate multi-key ones.
    return (attributes || []).flatMap((obj) =>
        Object.entries(obj).map(([key, value]) => ({
            key: String(key),
            value: value == null ? '' : String(value),
        })),
    )
}

/** Build form state from an entity's API `category` array, matching defaults by name. */
export function hydrate(defaults: AttributeCategory[], entity?: EntityWithCategory | null) {
    const attributes: AttrMap = Object.fromEntries(defaults.map((c) => [c.id, [] as AttrRow[]]))
    const customs: AttributeCategory[] = []
    for (const apiCat of entity?.category ?? []) {
        const rows = rowsFromApi(apiCat.attributes)
        const def = defaults.find((d) => d.name.toLowerCase() === (apiCat.name || '').toLowerCase())
        if (def) {
            attributes[def.id] = rows
        } else {
            const cat = makeCategory(apiCat.name || 'Category', apiCat.description || '')
            customs.push(cat)
            attributes[cat.id] = rows
        }
    }
    return { customs, attributes }
}

/** Convert form categories + attributes into the API `category` payload (drops empties). */
export function toCategoryPayload(categories: AttributeCategory[], attributes: AttrMap): ApiCategory[] {
    return categories
        .map((category) => ({
            name: category.name,
            description: category.description,
            attributes: (attributes[category.id] || [])
                .filter((attr) => attr.key && attr.value)
                .map((attr) => ({ [attr.key]: attr.value })),
        }))
        .filter((category) => category.attributes.length > 0)
}
