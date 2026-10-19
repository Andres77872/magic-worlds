/**
 * Advanced settings of one model role: endpoint, limits, context truncation and
 * the sampling parameters the model supports. Each field carries a one-line
 * helper so the numbers explain themselves.
 */
import { useTranslation } from 'react-i18next'
import type { LlmCatalogModel, LlmProfileRole } from '@/shared/types/llmProfile.types'
import { Field, Input, Select } from '@/ui/primitives'

const LIMITS = ['max_input_tokens', 'max_output_tokens', 'max_messages', 'timeout_seconds'] as const
const EFFORTS = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const

interface RoleSettingsFieldsProps {
    value: LlmProfileRole
    model: LlmCatalogModel | undefined
    disabled?: boolean
    custom?: boolean
    onChange: (value: LlmProfileRole) => void
}

export function RoleSettingsFields({ value, model, disabled = false, custom = false, onChange }: RoleSettingsFieldsProps) {
    const { t } = useTranslation()
    const settings = value.settings
    const set = (patch: Partial<LlmProfileRole['settings']>) => onChange({ ...value, settings: { ...settings, ...patch } })
    return <div className="grid gap-4 sm:grid-cols-2">
        {LIMITS.map(setting => <Field key={setting} label={t(`llmProfiles.settings.${setting}`)} helper={t(`llmProfiles.settingHints.${setting}`)}>
            <Input type="number" min={1} inputMode="numeric" value={settings[setting]} disabled={disabled}
                onChange={event => set({ [setting]: Number(event.target.value) })} />
        </Field>)}
        <Field label={t('llmProfiles.settings.truncation_strategy')} helper={t('llmProfiles.settingHints.truncation_strategy')}>
            <Select value={settings.truncation_strategy} disabled={disabled}
                options={[{ value: 'token_budget', label: t('llmProfiles.tokenBudget') }, { value: 'tail', label: t('llmProfiles.tail') }]}
                onChange={strategy => set({ truncation_strategy: strategy as LlmProfileRole['settings']['truncation_strategy'] })} />
        </Field>
        {!custom && <Field label={t('llmProfiles.endpoint')} helper={t('llmProfiles.settingHints.endpoint')}>
            <Select value={value.endpoint} disabled={disabled}
                options={(model?.compatible_endpoints ?? [value.endpoint]).map(endpoint => ({ value: endpoint, label: endpoint }))}
                onChange={endpoint => onChange({ ...value, endpoint: endpoint as LlmProfileRole['endpoint'] })} />
        </Field>}
        {(['temperature', 'top_p'] as const).filter(setting => custom || model?.supported_parameters.includes(setting)).map(setting =>
            <Field key={setting} label={t(`llmProfiles.settings.${setting}`)} helper={t(`llmProfiles.settingHints.${setting}`)}>
                <Input type="number" step="0.1" min={0} max={setting === 'temperature' ? 2 : 1} inputMode="decimal"
                    value={settings[setting] ?? ''} placeholder={t('llmProfiles.modelDefault')} disabled={disabled}
                    onChange={event => set({ [setting]: event.target.value === '' ? null : Number(event.target.value) })} />
            </Field>)}
        {(custom || model?.supported_parameters.includes('reasoning_effort')) &&
            <Field label={t('llmProfiles.settings.reasoning_effort')} helper={t('llmProfiles.settingHints.reasoning_effort')}>
                <Select value={settings.reasoning_effort ?? ''} disabled={disabled}
                    options={EFFORTS.map(effort => ({ value: effort, label: effort || t('llmProfiles.modelDefault') }))}
                    onChange={effort => set({ reasoning_effort: (effort || null) as LlmProfileRole['settings']['reasoning_effort'] })} />
            </Field>}
    </div>
}
