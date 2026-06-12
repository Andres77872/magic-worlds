/**
 * useGuidedCard — state engine for the guided card creators. Generalizes
 * `useAttributeCategories`: guided fields are bindings into the same API
 * `category` payload, free-form custom groups keep the AttributeManager flow,
 * and `toCategoryPayload()` merges both into one contract-identical array.
 *
 * Round-trip guarantees:
 * - save → reopen: rows matching a `(group, key)` binding re-bind to their
 *   guided field; every leftover row stays editable as a default/custom row.
 * - AI assistant apply (`hydrateFrom(card, { preserveActive: true })`): the
 *   card's values replace guided values wholesale, but the active field set
 *   and template ghost hints survive, so scaffolding never collapses.
 * - Role switches never drop data: a role-hidden field with a value stays
 *   visible (muted) and keeps serializing until the user removes it.
 *
 * Plain closures throughout — the React Compiler handles memoization.
 */
import { useState } from 'react'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import {
    hydrate as hydrateLegacy,
    makeCategory,
    rowsFromApi,
    toCategoryPayload as legacyToCategoryPayload,
    type ApiCategory,
    type AttrMap,
    type AttrRow,
    type EntityWithCategory,
} from './categorySerialization'
import type { CardFieldDefinition, CardTemplate, GuidedMirror } from './types'

interface UseGuidedCardOptions {
    /** Full guided-field registry for this card type (definition order = payload order). */
    fields: CardFieldDefinition[]
    /** Always-present quick-add categories (Stats / Details / Objectives / Traits). */
    defaults: AttributeCategory[]
    /** The entity being edited, if any — hydrated once at mount. */
    entity?: EntityWithCategory | null
    /** Current role for `roles`/`defaultActive` filtering (character creator). */
    role?: string
    /** First-class values dual-written into category groups (world place_type). */
    mirrors?: GuidedMirror[]
}

export interface GuidedCardApi {
    activeFields: CardFieldDefinition[]
    paletteFields: CardFieldDefinition[]
    values: Record<string, string>
    hints: Record<string, string>
    setValue: (fieldId: string, value: string) => void
    activateField: (fieldId: string) => void
    removeField: (fieldId: string) => void
    useExample: (fieldId: string) => void
    applyTemplate: (template: CardTemplate | null) => void
    /** Surface a role's default fields — call from the creator's role toggle. */
    activateDefaultsForRole: (role: string) => void
    /** True when the field is shown despite not matching the current role. */
    isOffRole: (field: CardFieldDefinition) => boolean
    // — custom groups: AttributeManager-compatible, mirrors AttributeCategoriesApi —
    categories: AttributeCategory[]
    customCategories: AttributeCategory[]
    attributes: AttrMap
    addCategory: (name: string, description: string) => string
    deleteCategory: (categoryId: string) => void
    addAttribute: (categoryId: string) => void
    addAttributeWith: (categoryId: string, row: Partial<AttrRow>) => void
    updateAttribute: (categoryId: string, index: number, field: 'key' | 'value', value: string) => void
    removeAttribute: (categoryId: string, index: number) => void
    // — serialization / hydration —
    toCategoryPayload: () => ApiCategory[]
    hydrateFrom: (entity?: EntityWithCategory | null, opts?: { preserveActive?: boolean }) => void
    // — preview projection: render guided + custom groups in existing preview cards —
    previewCategories: AttributeCategory[]
    previewAttributes: AttrMap
}

const bindingKey = (group: string, key: string) => `${group.toLowerCase()}\0${key.toLowerCase()}`

/** Read one category attribute off an entity (e.g. the place_type mirror fallback). */
export function readCategoryAttribute(
    entity: EntityWithCategory | null | undefined,
    group: string,
    key: string,
): string | undefined {
    for (const apiCat of entity?.category ?? []) {
        if ((apiCat.name || '').toLowerCase() !== group.toLowerCase()) continue
        for (const row of rowsFromApi(apiCat.attributes)) {
            if (row.key.toLowerCase() === key.toLowerCase() && row.value) return row.value
        }
    }
    return undefined
}

function baseHints(fields: CardFieldDefinition[]): Record<string, string> {
    const hints: Record<string, string> = {}
    for (const field of fields) {
        if (field.exampleHint) hints[field.id] = field.exampleHint
    }
    return hints
}

function defaultActiveIds(fields: CardFieldDefinition[], role?: string): Set<string> {
    const ids = new Set<string>()
    for (const field of fields) {
        if (field.removable === false) {
            ids.add(field.id)
            continue
        }
        const flag = field.defaultActive
        if (flag === true) ids.add(field.id)
        else if (Array.isArray(flag) && role && flag.includes(role)) ids.add(field.id)
    }
    return ids
}

/**
 * Split an entity's `category` array into guided values, mirror hits, and
 * leftover rows (which keep the legacy default/custom-category behavior).
 */
function hydrateGuided(
    fields: CardFieldDefinition[],
    defaults: AttributeCategory[],
    mirrors: GuidedMirror[],
    entity?: EntityWithCategory | null,
) {
    const fieldIndex = new Map<string, CardFieldDefinition>()
    for (const field of fields) {
        const key = bindingKey(field.binding.group, field.binding.key)
        if (!fieldIndex.has(key)) fieldIndex.set(key, field)
    }
    const mirrorIndex = new Map<string, GuidedMirror>()
    for (const mirror of mirrors) mirrorIndex.set(bindingKey(mirror.group, mirror.key), mirror)

    const guidedValues: Record<string, string> = {}
    const mirrorValues = new Map<GuidedMirror, string>()
    const leftovers: ApiCategory[] = []

    for (const apiCat of entity?.category ?? []) {
        const groupName = apiCat.name || ''
        const leftoverRows: AttrRow[] = []
        for (const row of rowsFromApi(apiCat.attributes)) {
            const key = bindingKey(groupName, row.key)
            const field = fieldIndex.get(key)
            if (field && guidedValues[field.id] === undefined) {
                guidedValues[field.id] = row.value
                continue
            }
            const mirror = mirrorIndex.get(key)
            if (mirror && !mirrorValues.has(mirror)) {
                mirrorValues.set(mirror, row.value)
                continue
            }
            leftoverRows.push(row)
        }
        if (leftoverRows.length > 0) {
            leftovers.push({
                name: groupName,
                description: apiCat.description,
                attributes: leftoverRows.map((row) => ({ [row.key]: row.value })),
            })
        }
    }

    const legacy = hydrateLegacy(defaults, { category: leftovers })
    return { guidedValues, mirrorValues, customs: legacy.customs, attributes: legacy.attributes }
}

/**
 * Merge guided values + mirrors + default/custom rows into ONE `category`
 * array — guided attributes first (definition order), then mirror entries,
 * then free-form rows, merged by case-insensitive group name so a guided
 * "Personality" and a user-made "personality" emit a single group.
 */
function serializeCategories(
    fields: CardFieldDefinition[],
    mirrors: GuidedMirror[],
    values: Record<string, string>,
    categories: AttributeCategory[],
    attributes: AttrMap,
): ApiCategory[] {
    interface Bucket {
        name: string
        description?: string
        attributes: Array<Record<string, string>>
    }
    const buckets = new Map<string, Bucket>()
    const ensureBucket = (name: string, description?: string): Bucket => {
        const key = name.toLowerCase()
        let bucket = buckets.get(key)
        if (!bucket) {
            bucket = { name, description, attributes: [] }
            buckets.set(key, bucket)
        }
        return bucket
    }
    // Guided fields in definition order; any non-empty value serializes, even
    // off-role — removal is the only way to drop data.
    for (const field of fields) {
        const value = values[field.id]?.trim()
        if (!value) continue
        ensureBucket(field.binding.group, field.binding.groupDescription).attributes.push({
            [field.binding.key]: value,
        })
    }
    for (const mirror of mirrors) {
        const value = mirror.value.trim()
        if (!value) continue
        ensureBucket(mirror.group, mirror.groupDescription).attributes.push({ [mirror.key]: value })
    }
    for (const cat of legacyToCategoryPayload(categories, attributes)) {
        const existing = buckets.get(cat.name.toLowerCase())
        if (existing) {
            existing.attributes.push(...(cat.attributes ?? []))
            if (!existing.description && cat.description) existing.description = cat.description
        } else {
            buckets.set(cat.name.toLowerCase(), {
                name: cat.name,
                description: cat.description,
                attributes: [...(cat.attributes ?? [])],
            })
        }
    }
    return [...buckets.values()]
        .filter((bucket) => bucket.attributes.length > 0)
        .map((bucket) => ({
            name: bucket.name,
            description: bucket.description ?? '',
            attributes: bucket.attributes,
        }))
}

export function useGuidedCard({ fields, defaults, entity, role, mirrors }: UseGuidedCardOptions): GuidedCardApi {
    const mirrorList = mirrors ?? []

    // One-time hydration from the entity being edited (stable at mount).
    const [hydrated] = useState(() => hydrateGuided(fields, defaults, mirrorList, entity))
    const [values, setValues] = useState<Record<string, string>>(hydrated.guidedValues)
    const [hints, setHints] = useState<Record<string, string>>(() => baseHints(fields))
    const [activeIds, setActiveIds] = useState<Set<string>>(() => {
        const ids = defaultActiveIds(fields, role)
        for (const id of Object.keys(hydrated.guidedValues)) ids.add(id)
        return ids
    })
    const [customCategories, setCustomCategories] = useState<AttributeCategory[]>(hydrated.customs)
    const [attributes, setAttributes] = useState<AttrMap>(hydrated.attributes)

    const hasValue = (id: string) => Boolean(values[id]?.trim())
    const roleMatches = (field: CardFieldDefinition) =>
        !field.roles || (role !== undefined && field.roles.includes(role))

    const activeFields = fields.filter((f) => activeIds.has(f.id) && (roleMatches(f) || hasValue(f.id)))
    const paletteFields = fields.filter((f) => f.removable !== false && !activeIds.has(f.id) && roleMatches(f))
    const isOffRole = (field: CardFieldDefinition) => !roleMatches(field) && hasValue(field.id)

    const setValue = (fieldId: string, value: string) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }))
        setActiveIds((prev) => (prev.has(fieldId) ? prev : new Set(prev).add(fieldId)))
    }

    const activateField = (fieldId: string) => {
        setActiveIds((prev) => new Set(prev).add(fieldId))
    }

    const removeField = (fieldId: string) => {
        const field = fields.find((f) => f.id === fieldId)
        if (!field || field.removable === false) return
        setValues((prev) => ({ ...prev, [fieldId]: '' }))
        setActiveIds((prev) => {
            const next = new Set(prev)
            next.delete(fieldId)
            return next
        })
    }

    const useExample = (fieldId: string) => {
        const hint = hints[fieldId]
        if (hint) setValue(fieldId, hint)
    }

    const applyTemplate = (template: CardTemplate | null) => {
        setHints({ ...baseHints(fields), ...(template?.examples ?? {}) })
        const next = new Set<string>(template?.fieldIds ?? [])
        for (const field of fields) {
            if (field.removable === false) next.add(field.id)
        }
        // Typed values always survive a (re-)pick.
        for (const [id, value] of Object.entries(values)) {
            if (value.trim()) next.add(id)
        }
        setActiveIds(next)
    }

    /**
     * Surface a role's default fields (never removes any). Called explicitly by
     * the creator's role toggle — template picks curate their own active set,
     * so this must not run implicitly on every role change.
     */
    const activateDefaultsForRole = (nextRole: string) => {
        setActiveIds((prev) => {
            const next = new Set(prev)
            for (const id of defaultActiveIds(fields, nextRole)) next.add(id)
            return next
        })
    }

    // ----- custom groups (AttributeManager-compatible, same as useAttributeCategories) -----

    const categories = [...defaults, ...customCategories]

    const addCategory = (name: string, description: string) => {
        const category = makeCategory(name, description)
        setCustomCategories((prev) => [...prev, category])
        setAttributes((prev) => ({ ...prev, [category.id]: [] }))
        return category.id
    }

    const deleteCategory = (categoryId: string) => {
        if (defaults.some((c) => c.id === categoryId)) return // defaults are permanent
        setCustomCategories((prev) => prev.filter((c) => c.id !== categoryId))
        setAttributes((prev) => {
            const next = { ...prev }
            delete next[categoryId]
            return next
        })
    }

    const addAttribute = (categoryId: string) => {
        setAttributes((prev) => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), { key: '', value: '' }] }))
    }

    const addAttributeWith = (categoryId: string, row: Partial<AttrRow>) => {
        setAttributes((prev) => ({
            ...prev,
            [categoryId]: [...(prev[categoryId] || []), { key: '', value: '', ...row }],
        }))
    }

    const updateAttribute = (categoryId: string, index: number, field: 'key' | 'value', value: string) => {
        setAttributes((prev) => {
            const rows = [...(prev[categoryId] || [])]
            rows[index] = { ...rows[index], [field]: value }
            return { ...prev, [categoryId]: rows }
        })
    }

    const removeAttribute = (categoryId: string, index: number) => {
        setAttributes((prev) => ({ ...prev, [categoryId]: (prev[categoryId] || []).filter((_, i) => i !== index) }))
    }

    // ----- serialization / hydration -----

    const toCategoryPayload = () => serializeCategories(fields, mirrorList, values, categories, attributes)

    const hydrateFrom = (nextEntity?: EntityWithCategory | null, opts?: { preserveActive?: boolean }) => {
        const next = hydrateGuided(fields, defaults, mirrorList, nextEntity)
        setValues(next.guidedValues)
        setCustomCategories(next.customs)
        setAttributes(next.attributes)
        for (const [mirror, value] of next.mirrorValues) mirror.onHydrate?.(value)
        if (!opts?.preserveActive) setHints(baseHints(fields))
        setActiveIds((prev) => {
            const ids = opts?.preserveActive ? new Set(prev) : defaultActiveIds(fields, role)
            for (const id of Object.keys(next.guidedValues)) ids.add(id)
            return ids
        })
    }

    // ----- preview projection (derives from the payload path, so the preview
    // always shows exactly what will be saved) -----

    const previewPayload = serializeCategories(fields, mirrorList, values, categories, attributes)
    const previewCategories: AttributeCategory[] = previewPayload.map((cat, index) => ({
        id: `preview_${index}_${cat.name.toLowerCase()}`,
        name: cat.name,
        description: cat.description || '',
        type: 'custom' as const,
    }))
    const previewAttributes: AttrMap = Object.fromEntries(
        previewPayload.map((cat, index) => [`preview_${index}_${cat.name.toLowerCase()}`, rowsFromApi(cat.attributes)]),
    )

    return {
        activeFields,
        paletteFields,
        values,
        hints,
        setValue,
        activateField,
        removeField,
        useExample,
        applyTemplate,
        activateDefaultsForRole,
        isOffRole,
        categories,
        customCategories,
        attributes,
        addCategory,
        deleteCategory,
        addAttribute,
        addAttributeWith,
        updateAttribute,
        removeAttribute,
        toCategoryPayload,
        hydrateFrom,
        previewCategories,
        previewAttributes,
    }
}
