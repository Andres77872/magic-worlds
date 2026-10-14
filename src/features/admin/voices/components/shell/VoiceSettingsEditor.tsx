import { useTranslation } from 'react-i18next'
import type { VoiceSettingsV2 } from '@/shared'
import { SwitchRow } from '@/ui/primitives'
import { SETTING_RANGES, type LabSettingKey } from '../../constants'
import { ControlSlider } from '@/features/voices/components/ControlSlider'

interface VoiceSettingsEditorProps {
    /** Only these controls are shown (per-model allow-list, 03 §5.6). */
    keys: readonly LabSettingKey[]
    value: VoiceSettingsV2
    onChange: (next: VoiceSettingsV2) => void
    locale: string
}

/** Provider-neutral voice settings: sliders with spoken values plus the speaker-boost switch. */
export function VoiceSettingsEditor({ keys, value, onChange, locale }: VoiceSettingsEditorProps) {
    const { t } = useTranslation()
    const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return (
        <div className="flex flex-col gap-3">
            {keys.map((key) => {
                if (key === 'use_speaker_boost') {
                    return (
                        <SwitchRow
                            key={key}
                            label={t('admin.voices.settings.use_speaker_boost')}
                            checked={Boolean(value.use_speaker_boost)}
                            onChange={(checked) => onChange({ ...value, use_speaker_boost: checked })}
                            variant="plain"
                        />
                    )
                }
                const range = SETTING_RANGES[key]
                const label = t(`admin.voices.settings.${key}`)
                const current = value[key] ?? range.defaultValue
                return (
                    <ControlSlider
                        key={key}
                        label={label}
                        value={current}
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        defaultValue={range.defaultValue}
                        format={(next) => number.format(next)}
                        valueText={(next) =>
                            key === 'speed'
                                ? t('admin.voices.settings.speedValueText', { value: number.format(next) })
                                : t('admin.voices.settings.valueText', { label, value: number.format(next) })
                        }
                        onChange={(next) => onChange({ ...value, [key]: next })}
                    />
                )
            })}
        </div>
    )
}
