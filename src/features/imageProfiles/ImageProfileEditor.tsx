/**
 * The image profile drawer: name, provider and catalog model, the model's own
 * settings (left on their defaults unless changed), the price (app profiles
 * only) and custom provider fields. Purely presentational: the page owns the
 * draft, the API calls and the busy flag.
 */
import { useTranslation } from 'react-i18next'
import { Archive, ImageIcon, KeyRound, Save } from 'lucide-react'
import type { ImageCatalog, ImageCatalogModel, ImageCatalogSetting, ImageProfileMutation, ImageProvider } from '@/shared/types/imageProfile.types'
import { Button, Callout, Drawer, Field, Icon, Input, Select, Textarea } from '@/ui/primitives'
import { ProviderPropsField } from '@/features/llmProfiles/ProviderPropsField'
import { IMAGE_PROVIDERS, PLATFORM_KEY_ENV, catalogModel, imageOptionsParser, nameIssue, settingIssue, settingLabel, settingValue } from './imageProfileModel'

export interface ImageProfileEditorProps {
    open: boolean
    mode: 'create' | 'edit'
    systemAdmin: boolean
    catalog: ImageCatalog | null
    draft: ImageProfileMutation
    propsKey: number
    propsValid: boolean
    busy: boolean
    error: string | null
    onChange: (patch: Partial<ImageProfileMutation>) => void
    onChooseModel: (model: ImageCatalogModel) => void
    onPropsValidity: (valid: boolean) => void
    onSave: () => void
    onArchive?: () => void
    onClose: () => void
}

export function ImageProfileEditor({ open, mode, systemAdmin, catalog, draft, propsKey, propsValid, busy, error,
    onChange, onChooseModel, onPropsValidity, onSave, onArchive, onClose }: ImageProfileEditorProps) {
    const { t } = useTranslation()
    const model = catalogModel(catalog, draft.provider, draft.model_id)
    const providerName = t(`imageProfiles.providers.${draft.provider}`)
    const platformAvailable = catalog?.providers.find(item => item.provider === draft.provider)?.platform_available ?? false
    const models = catalog?.models.filter(item => item.provider === draft.provider) ?? []
    const settingIssues = model ? Object.keys(model.settings).filter(key => settingIssue(model, key, draft.settings[key])) : []
    const nameProblem = nameIssue(draft.name)
    const cost = draft.credit_cost ?? 0
    const costInvalid = systemAdmin && (!Number.isInteger(cost) || cost < 0 || cost > 1000)
    const canSave = !busy && !!model && nameProblem === null && propsValid && settingIssues.length === 0 && !costInvalid

    const chooseProvider = (provider: string) => {
        const first = catalog?.models.find(item => item.provider === provider)
        if (first) onChooseModel(first)
    }
    const chooseModel = (modelId: string) => {
        const next = models.find(item => item.model_id === modelId)
        if (next) onChooseModel(next)
    }
    const setSetting = (key: string, value: ImageProfileMutation['settings'][string] | undefined) => {
        const settings = { ...draft.settings }
        if (value === undefined) delete settings[key]
        else settings[key] = value
        onChange({ settings })
    }
    const defaultLabel = (setting: ImageCatalogSetting) => setting.default === null ? t('imageProfiles.editor.providerDefault')
        : t('imageProfiles.editor.useDefault', {
            value: typeof setting.default === 'boolean' ? t(setting.default ? 'imageProfiles.editor.on' : 'imageProfiles.editor.off') : String(setting.default),
        })

    const settingField = (key: string, setting: ImageCatalogSetting) => {
        const current = draft.settings[key]
        if (setting.kind === 'bool' || setting.kind === 'enum') {
            const options = [
                { value: '', label: defaultLabel(setting) },
                ...(setting.kind === 'bool'
                    ? [{ value: 'true', label: t('imageProfiles.editor.on') }, { value: 'false', label: t('imageProfiles.editor.off') }]
                    : setting.choices.map(choice => ({ value: String(choice), label: String(choice) }))),
            ]
            // A stored value the model does not accept shows no option, so say so.
            return <Field key={key} label={settingLabel(key)} error={settingIssues.includes(key) ? t('imageProfiles.editor.invalidSetting') : undefined}>
                <Select size="sm" value={current === undefined ? '' : String(current)} options={options} disabled={busy}
                    onChange={raw => setSetting(key, settingValue(setting.kind, raw, setting.choices))} />
            </Field>
        }
        const range = setting.minimum !== null && setting.maximum !== null
            ? t('imageProfiles.editor.range', { min: setting.minimum, max: setting.maximum }) : undefined
        return <Field key={key} label={settingLabel(key)} helper={range}
            error={settingIssues.includes(key) ? range ?? t('imageProfiles.editor.invalidSetting') : undefined}>
            <Input type="number" inputMode={setting.kind === 'int' ? 'numeric' : 'decimal'} step={setting.kind === 'int' ? 1 : 'any'}
                min={setting.minimum ?? undefined} max={setting.maximum ?? undefined} disabled={busy}
                placeholder={defaultLabel(setting)} value={current === undefined ? '' : String(current)}
                onChange={event => setSetting(key, settingValue(setting.kind, event.target.value))} />
        </Field>
    }

    return <Drawer open={open} onClose={onClose} size="xl"
        eyebrow={t(systemAdmin ? 'imageProfiles.editor.eyebrowSystem' : 'imageProfiles.editor.eyebrowUser')}
        title={t(mode === 'create' ? 'imageProfiles.editor.createTitle' : 'imageProfiles.editor.editTitle')}
        icon={<Icon icon={systemAdmin ? ImageIcon : KeyRound} size={18} />}
        footer={<div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div>{mode === 'edit' && onArchive && <Button variant="danger-ghost" size="sm" disabled={busy} onClick={onArchive}
                iconLeft={<Icon icon={Archive} size={14} />}>{t('imageProfiles.archive')}</Button>}</div>
            <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose}>{t('imageProfiles.cancel')}</Button>
                <Button disabled={!canSave} onClick={onSave} iconLeft={<Icon icon={Save} size={15} />}>{t('imageProfiles.save')}</Button>
            </div>
        </div>}>
        <div className="flex flex-col gap-5">
            {error && <Callout tone="danger" role="alert">{error}</Callout>}
            <Field label={t('imageProfiles.editor.name')} error={nameProblem === 'text' ? t('imageProfiles.editor.nameInvalid') : undefined}>
                <Input value={draft.name} maxLength={160} disabled={busy} onChange={event => onChange({ name: event.target.value })} />
            </Field>
            <Field label={t('imageProfiles.editor.description')}>
                <Textarea value={draft.description} rows={2} maxLength={2000} disabled={busy}
                    onChange={event => onChange({ description: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Field label={t('imageProfiles.editor.provider')}>
                    <Select value={draft.provider} disabled={busy}
                        options={IMAGE_PROVIDERS.map((provider: ImageProvider) => ({ value: provider, label: t(`imageProfiles.providers.${provider}`) }))}
                        onChange={chooseProvider} />
                </Field>
                <Field label={t('imageProfiles.editor.model')}>
                    <Select value={draft.model_id} disabled={busy} onChange={chooseModel}
                        options={models.map(item => ({ value: item.model_id, label: item.display_name, description: `${item.vendor} · ${item.summary}` }))} />
                </Field>
            </div>
            {model && <p className="font-ui text-label text-parchment-300">
                {model.summary} · {t(model.supports_negative_prompt ? 'imageProfiles.editor.negativePrompt' : 'imageProfiles.editor.noNegativePrompt')}
            </p>}
            {systemAdmin ? !platformAvailable && <Callout tone="warning" role="note">{t('imageProfiles.editor.platformMissing', { provider: providerName, env: PLATFORM_KEY_ENV[draft.provider] })}</Callout>
                : <Callout tone="info" role="note">{t('imageProfiles.editor.byokNote', { provider: providerName })}</Callout>}
            {systemAdmin && <Field label={t('imageProfiles.editor.creditCost')} helper={t('imageProfiles.editor.creditCostHint')}
                error={costInvalid ? t('imageProfiles.editor.range', { min: 0, max: 1000 }) : undefined}>
                <Input type="number" inputMode="numeric" min={0} max={1000} step={1} disabled={busy} value={String(cost)}
                    onChange={event => onChange({ credit_cost: event.target.value === '' ? 0 : Number(event.target.value) })} />
            </Field>}
            {model && Object.keys(model.settings).length > 0 && <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <h3 className="font-ui text-sm font-semibold text-parchment-50">{t('imageProfiles.editor.settings')}</h3>
                    <p className="font-ui text-caption text-parchment-300">{t('imageProfiles.editor.settingsHint')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(model.settings).map(([key, setting]) => settingField(key, setting))}
                </div>
            </section>}
            <section className="flex flex-col gap-2">
                <h3 className="font-ui text-sm font-semibold text-parchment-50">{t('imageProfiles.editor.customFields')}</h3>
                <ProviderPropsField key={propsKey} value={draft.provider_options} disabled={busy}
                    parse={imageOptionsParser(model)} hint={t('imageProfiles.editor.customFieldsHint')}
                    onChange={provider_options => onChange({ provider_options })} onValidityChange={onPropsValidity} />
            </section>
        </div>
    </Drawer>
}
