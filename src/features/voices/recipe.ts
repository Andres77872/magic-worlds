import { DEFAULT_PITCH, DEFAULT_SPEED, DEFAULT_VOL } from '@/features/admin/voices/constants'

/** The tunable part of a voice preset (preset uses `volume`; preview/character use `vol`). */
export interface PresetRecipe {
    speed: number
    volume: number
    pitch: number
    emotion: string // '' = none/Auto
    language_boost: string // 'auto' | language name
}

export const DEFAULT_RECIPE: PresetRecipe = {
    speed: DEFAULT_SPEED,
    volume: DEFAULT_VOL,
    pitch: DEFAULT_PITCH,
    emotion: '',
    language_boost: 'auto',
}
