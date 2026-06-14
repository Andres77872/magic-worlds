import { useTranslation } from 'react-i18next'
import { Field, Select } from '@/ui/primitives'
import { DEFAULT_PITCH, DEFAULT_SPEED, DEFAULT_VOL, EMOTION_OPTIONS, LANGUAGE_BOOST_OPTIONS } from '@/features/admin/voices/constants'
import { ControlSlider } from '@/features/admin/voices/components/ControlSlider'
import type { PresetRecipe } from '../recipe'

interface PresetRecipeControlsProps {
    recipe: PresetRecipe
    onChange: (patch: Partial<PresetRecipe>) => void
}

/** Speed / volume / pitch sliders + emotion & language selects — the tunable
 * part of a voice preset (no model/format/sample-rate; narration fixes those). */
export function PresetRecipeControls({ recipe, onChange }: PresetRecipeControlsProps) {
    const { t } = useTranslation()
    const emotionOptions = EMOTION_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))
    const languageBoostOptions = LANGUAGE_BOOST_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))
    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
                <ControlSlider
                    label={t('voices.recipe.speed')}
                    value={recipe.speed}
                    min={0.5}
                    max={2}
                    step={0.1}
                    defaultValue={DEFAULT_SPEED}
                    onChange={(speed) => onChange({ speed })}
                    format={(value) => value.toFixed(1)}
                />
                <ControlSlider
                    label={t('voices.recipe.volume')}
                    value={recipe.volume}
                    min={0.1}
                    max={10}
                    step={0.1}
                    defaultValue={DEFAULT_VOL}
                    onChange={(volume) => onChange({ volume })}
                    format={(value) => value.toFixed(1)}
                />
                <ControlSlider
                    label={t('voices.recipe.pitch')}
                    value={recipe.pitch}
                    min={-12}
                    max={12}
                    step={1}
                    defaultValue={DEFAULT_PITCH}
                    onChange={(pitch) => onChange({ pitch })}
                />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('voices.recipe.emotion')}>
                    <Select options={emotionOptions} value={recipe.emotion} onChange={(emotion) => onChange({ emotion })} size="sm" />
                </Field>
                <Field label={t('voices.recipe.languageBoost')}>
                    <Select
                        options={languageBoostOptions}
                        value={recipe.language_boost}
                        onChange={(language_boost) => onChange({ language_boost })}
                        size="sm"
                    />
                </Field>
            </div>
        </div>
    )
}
