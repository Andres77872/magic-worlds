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

export function readWorldPlaceType(card?: { place_type?: unknown; placeType?: unknown } | null): string {
    const value = typeof card?.place_type === 'string'
        ? card.place_type
        : typeof card?.placeType === 'string'
          ? card.placeType
          : DEFAULT_WORLD_PLACE_TYPE
    return value.trim() || DEFAULT_WORLD_PLACE_TYPE
}

export function worldPlaceTypeOptionValue(placeType: string): string {
    const normalized = placeType.trim().toLowerCase()
    return WORLD_PLACE_TYPE_OPTIONS.some((option) => option.value === normalized) ? normalized : CUSTOM_WORLD_PLACE_TYPE
}

export function worldPlaceTypeLabel(placeType: string): string {
    const normalized = placeType.trim().toLowerCase()
    return WORLD_PLACE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? placeType.trim()
}
