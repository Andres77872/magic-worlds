import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { Button, Callout, Drawer, Field, Icon, Select } from '@/ui/primitives'
import { DEFAULT_READING, readingOptions, readingPreset, readingPresets, type ReadingPreferences } from '../utils/readingPreferences'

export interface NovelReadingPreferencesProps {
    open: boolean
    onClose: () => void
    value: ReadingPreferences
    onChange: (value: ReadingPreferences) => void
    storageUnavailable: boolean
}

export function NovelReadingPreferences({ open, onClose, value, onChange, storageUnavailable }: NovelReadingPreferencesProps) {
    const { t } = useTranslation()
    const copy = (key: string) => t('novelEditor.reading.' + key)
    return <Drawer open={open} onClose={onClose} title={copy('title')} icon={<Icon icon={BookOpen} />} size="lg" footer={<>
        <Button variant="ghost" onClick={() => onChange(DEFAULT_READING)}>{copy('reset')}</Button>
        <Button onClick={onClose}>{copy('done')}</Button>
    </>}>
        <div className="space-y-4">
            <p className="text-body text-parchment-200">{copy('help')}</p>
            {storageUnavailable && <Callout tone="warning" role="status">{copy('unavailable')}</Callout>}
            <Field label={copy('preset')}>
                <Select value={readingPreset(value)} onChange={(preset) => {
                    if (Object.prototype.hasOwnProperty.call(readingPresets, preset)) onChange(readingPresets[preset as keyof typeof readingPresets])
                }} options={[...Object.keys(readingPresets), 'custom'].map((preset) => ({ value: preset, label: copy('presets.' + preset), disabled: preset === 'custom' }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                {(Object.keys(readingOptions) as (keyof ReadingPreferences)[]).map((field) => <Field key={field} label={copy(field)}>
                    <Select value={value[field]} options={readingOptions[field].map((choice) => ({ value: choice, label: copy('choices.' + field + '.' + choice) }))}
                        onChange={(choice) => onChange({ ...value, [field]: choice })} />
                </Field>)}
            </div>
            <p className="text-caption text-parchment-300">{copy('fontHelp')}</p>
        </div>
    </Drawer>
}
