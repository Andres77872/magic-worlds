/**
 * useAttributeCategories — shared state for the optional, user-extensible
 * attribute system used by every creator (character / world / adventure).
 *
 * Forms start MINIMAL: just the provided `defaults` (typically a single props
 * category). Users add more key/value props to any category, or add whole new
 * categories. On edit, categories + values are rehydrated from the entity's API
 * `category` array; on save, `toCategoryPayload` produces that same shape.
 */
import { useCallback, useMemo, useState } from 'react'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { generateUUID } from '@/utils/uuid'

export interface AttrRow {
    key: string
    value: string
}
export type AttrMap = Record<string, AttrRow[]>

/** The API category shape shared by characters / worlds / adventure templates. */
export interface ApiCategory {
    name: string
    description?: string
    attributes?: Array<Record<string, string>>
}

interface EntityWithCategory {
    category?: ApiCategory[] | null
}

interface Options {
    /** Always-present categories (kept minimal — usually one). Not deletable. */
    defaults: AttributeCategory[]
    /** The entity being edited, if any — its `category` array is loaded. */
    entity?: EntityWithCategory | null
}

export interface AttributeCategoriesApi {
    categories: AttributeCategory[]
    customCategories: AttributeCategory[]
    attributes: AttrMap
    addCategory: (name: string, description: string) => string
    deleteCategory: (categoryId: string) => void
    addAttribute: (categoryId: string) => void
    updateAttribute: (categoryId: string, index: number, field: 'key' | 'value', value: string) => void
    removeAttribute: (categoryId: string, index: number) => void
}

function makeCategory(name: string, description: string): AttributeCategory {
    return { id: `custom_${generateUUID().slice(0, 8)}`, name, description: description || '', type: 'custom' }
}

function rowsFromApi(attributes?: Array<Record<string, string>>): AttrRow[] {
    return (attributes || []).map((obj) => {
        const [key, value] = Object.entries(obj)[0] ?? ['', '']
        return { key: String(key), value: value == null ? '' : String(value) }
    })
}

/** Build form state from an entity's API `category` array, matching defaults by name. */
function hydrate(defaults: AttributeCategory[], entity?: EntityWithCategory | null) {
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

export function useAttributeCategories({ defaults, entity }: Options): AttributeCategoriesApi {
    // Hydrate once from the entity being edited (editing target is stable at mount).
    const [hydrated] = useState(() => hydrate(defaults, entity))
    const [customCategories, setCustomCategories] = useState<AttributeCategory[]>(hydrated.customs)
    const [attributes, setAttributes] = useState<AttrMap>(hydrated.attributes)

    const categories = useMemo(() => [...defaults, ...customCategories], [defaults, customCategories])

    const addCategory = useCallback((name: string, description: string) => {
        const category = makeCategory(name, description)
        setCustomCategories((prev) => [...prev, category])
        setAttributes((prev) => ({ ...prev, [category.id]: [] }))
        return category.id
    }, [])

    const deleteCategory = useCallback(
        (categoryId: string) => {
            if (defaults.some((c) => c.id === categoryId)) return // defaults are permanent
            setCustomCategories((prev) => prev.filter((c) => c.id !== categoryId))
            setAttributes((prev) => {
                const next = { ...prev }
                delete next[categoryId]
                return next
            })
        },
        [defaults],
    )

    const addAttribute = useCallback((categoryId: string) => {
        setAttributes((prev) => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), { key: '', value: '' }] }))
    }, [])

    const updateAttribute = useCallback(
        (categoryId: string, index: number, field: 'key' | 'value', value: string) => {
            setAttributes((prev) => {
                const rows = [...(prev[categoryId] || [])]
                rows[index] = { ...rows[index], [field]: value }
                return { ...prev, [categoryId]: rows }
            })
        },
        [],
    )

    const removeAttribute = useCallback((categoryId: string, index: number) => {
        setAttributes((prev) => ({ ...prev, [categoryId]: (prev[categoryId] || []).filter((_, i) => i !== index) }))
    }, [])

    return {
        categories,
        customCategories,
        attributes,
        addCategory,
        deleteCategory,
        addAttribute,
        updateAttribute,
        removeAttribute,
    }
}
