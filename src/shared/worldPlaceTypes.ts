export const DEFAULT_WORLD_PLACE_TYPE = 'world'
export const CUSTOM_WORLD_PLACE_TYPE = '__custom__'

export const WORLD_PLACE_TYPE_OPTIONS = [
    { value: 'world', label: 'World' },
    { value: 'place', label: 'Place' },
    { value: 'continent', label: 'Continent' },
    { value: 'country', label: 'Country' },
    { value: 'region', label: 'Region' },
    { value: 'city', label: 'City' },
    { value: 'settlement', label: 'Settlement' },
    { value: 'landmark', label: 'Landmark' },
    { value: 'plane', label: 'Plane' },
] as const

export interface WorldCategory {
    name: string
    description?: string
    attributes?: Array<Record<string, string>>
}

interface WorldPlaceTypeSource {
    category?: WorldCategory[] | null
}

/** Read the stored Setting / Place type category attribute. */
export function readWorldPlaceType(card?: WorldPlaceTypeSource | null): string {
    const setting = card?.category?.find((group) => group.name?.trim().toLowerCase() === 'setting')
    for (const attributes of setting?.attributes ?? []) {
        const match = Object.entries(attributes).find(([key]) => key.trim().toLowerCase() === 'place type')
        if (typeof match?.[1] === 'string' && match[1].trim()) return match[1].trim()
    }
    return DEFAULT_WORLD_PLACE_TYPE
}

/** Persist place scale in the stored Setting / Place type category field. */
export function withWorldPlaceType(
    category: WorldCategory[] | undefined,
    placeType: string,
    description = 'The kind of place this setting describes.',
): WorldCategory[] {
    const value = placeType.trim() || DEFAULT_WORLD_PLACE_TYPE
    const groups = (category ?? []).map((group) => ({
        ...group,
        attributes: group.attributes?.map((attributes) => ({ ...attributes })),
    }))
    const index = groups.findIndex((group) => group.name?.trim().toLowerCase() === 'setting')
    const setting = index >= 0 ? groups[index] : { name: 'Setting', description, attributes: [] }
    const attributes = setting.attributes ?? []
    let replaced = false
    const nextAttributes = attributes.map((row) => {
        const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === 'place type')
        if (!key) return row
        replaced = true
        return { ...row, [key]: value }
    })
    if (!replaced) nextAttributes.unshift({ 'Place type': value })
    const nextSetting = { ...setting, description: setting.description || description, attributes: nextAttributes }
    if (index >= 0) groups[index] = nextSetting
    else groups.unshift(nextSetting)
    return groups
}

export function worldPlaceTypeOptionValue(placeType: string): string {
    const normalized = placeType.trim().toLowerCase()
    return WORLD_PLACE_TYPE_OPTIONS.some((option) => option.value === normalized) ? normalized : CUSTOM_WORLD_PLACE_TYPE
}

export function worldPlaceTypeLabel(placeType: string): string {
    const normalized = placeType.trim().toLowerCase()
    return WORLD_PLACE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? placeType.trim()
}
