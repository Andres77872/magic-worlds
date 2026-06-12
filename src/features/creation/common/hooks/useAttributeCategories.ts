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
import {
    hydrate,
    makeCategory,
    toCategoryPayload,
    type ApiCategory,
    type AttrMap,
    type AttrRow,
    type EntityWithCategory,
} from '../engine/categorySerialization'

export { toCategoryPayload, type ApiCategory, type AttrMap, type AttrRow }

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
    /** Append a row with a prefilled key/value in one call (used by preset chips). */
    addAttributeWith: (categoryId: string, row: Partial<AttrRow>) => void
    updateAttribute: (categoryId: string, index: number, field: 'key' | 'value', value: string) => void
    removeAttribute: (categoryId: string, index: number) => void
    /**
     * Replace all categories + values from an entity's API `category` array.
     * Used after AI generation, when the entity arrives AFTER mount and the
     * one-time hydration has already run. Defaults are preserved (matched by name).
     */
    hydrateFrom: (entity?: EntityWithCategory | null) => void
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

    const addAttributeWith = useCallback((categoryId: string, row: Partial<AttrRow>) => {
        setAttributes((prev) => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), { key: '', value: '', ...row }],
        }))
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

    const hydrateFrom = useCallback(
        (entity?: EntityWithCategory | null) => {
            const next = hydrate(defaults, entity)
            setCustomCategories(next.customs)
            setAttributes(next.attributes)
        },
        [defaults],
    )

    return {
        categories,
        customCategories,
        attributes,
        addCategory,
        deleteCategory,
        addAttribute,
        addAttributeWith,
        updateAttribute,
        removeAttribute,
        hydrateFrom,
    }
}
