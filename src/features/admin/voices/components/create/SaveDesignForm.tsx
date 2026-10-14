import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { VoiceAgeBucket, VoiceDesignLabels, VoiceGender } from '@/shared'
import { Button, Field, Input, Select } from '@/ui/primitives'
import { AGE_BUCKETS, CONSOLE_LANGUAGES, GENDERS } from '../../constants'
import { useVoiceConsole } from '../shell/VoiceConsoleContext'
import { knownCount } from '../shell/limitsMath'

export interface SaveDesignValues {
    voiceName: string
    labels: VoiceDesignLabels
}

interface SaveDesignFormProps {
    defaultLanguage: string | null
    saving: boolean
    error: string | null
    onSave: (values: SaveDesignValues) => void
}

/** Name and labels for the chosen preview; shows the slot cost before saving (05 §8.8). */
export function SaveDesignForm({ defaultLanguage, saving, error, onSave }: SaveDesignFormProps) {
    const { t } = useTranslation()
    const { languageName, limits } = useVoiceConsole()
    const [name, setName] = useState('')
    const [language, setLanguage] = useState(defaultLanguage && CONSOLE_LANGUAGES.includes(defaultLanguage) ? defaultLanguage : 'en')
    const [accent, setAccent] = useState('')
    const [gender, setGender] = useState('')
    const [age, setAge] = useState('')
    // The BFF sends null for a count the provider did not report: no number is shown then.
    const slotsUsed = knownCount(limits.data?.subscription?.voice_slots_used)
    const slotLimit = knownCount(limits.data?.subscription?.voice_limit)

    const submit = (event: FormEvent) => {
        event.preventDefault()
        if (!name.trim()) return
        onSave({
            voiceName: name.trim(),
            labels: {
                language,
                accent: accent.trim() || null,
                gender: (gender || null) as VoiceGender | null,
                age: (age || null) as VoiceAgeBucket | null,
            },
        })
    }

    const notSet = { value: '', label: t('admin.voices.common.notSet') }

    return (
        <form onSubmit={submit} noValidate aria-label={t('admin.voices.design.save.title')} className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
            <h4 className="font-display text-base font-semibold text-fg">{t('admin.voices.design.save.title')}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('admin.voices.design.save.name')}>
                    <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
                </Field>
                <Field label={t('admin.voices.design.save.language')}>
                    <Select options={CONSOLE_LANGUAGES.map((code) => ({ value: code, label: languageName(code) }))} value={language} onChange={setLanguage} />
                </Field>
                <Field label={t('admin.voices.design.save.accent')}>
                    <Input value={accent} onChange={(event) => setAccent(event.target.value)} />
                </Field>
                <Field label={t('admin.voices.design.save.gender')}>
                    <Select options={[notSet, ...GENDERS.map((value) => ({ value, label: t(`admin.voices.gender.${value}`) }))]} value={gender} onChange={setGender} />
                </Field>
                <Field label={t('admin.voices.design.save.age')}>
                    <Select options={[notSet, ...AGE_BUCKETS.map((value) => ({ value, label: t(`admin.voices.age.${value}`) }))]} value={age} onChange={setAge} />
                </Field>
            </div>
            <p className="font-ui text-caption text-fg-muted">
                {slotsUsed !== null && slotLimit !== null
                    ? t('admin.voices.design.save.slotCost', { used: slotsUsed, limit: slotLimit })
                    : t('admin.voices.design.save.slotCostUnknown')}
            </p>
            {error && (
                <p role="alert" className="font-ui text-sm text-blood-300">
                    {error}
                </p>
            )}
            <div>
                <Button type="submit" variant="primary" disabled={saving || !name.trim()}>
                    {saving ? t('admin.voices.common.saving') : t('admin.voices.design.save.submit')}
                </Button>
            </div>
        </form>
    )
}
