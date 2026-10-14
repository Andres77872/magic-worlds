/**
 * Defaults (D31, 03 §5.11, 05 §8.5, AC-R4): narrator and fallback pool per
 * language. Saving is blocked while a chosen voice fails a readiness check,
 * and the failing item is named. Required rows show "Missing" until set.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Mic2, X } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogVoice, VoiceDefaultRole, VoiceDefaultsResponse } from '@/shared'
import { Badge, Button, Callout, Field, Icon, IconButton, Select } from '@/ui/primitives'
import { FALLBACK_POOL_MIN } from '../../constants'
import {
    DEFAULTS_REQUIREMENTS,
    defaultKeys,
    fallbackShortfall,
    firstFailure,
    hasMixedGender,
    readinessChecks,
    type DefaultsRequirement,
    type RuleCheck,
} from '../../consoleRules'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { voiceName, voiceSelectOptions } from '../../voiceOptions'
import { ConsoleSection } from '../shell/ConsoleSection'
import { RuleChecklist } from '../shell/RuleChecklist'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'

const loadDefaults = (signal: AbortSignal) => apiService.getVoiceDefaults(signal)

export function DefaultsModule() {
    const { t } = useTranslation()
    const defaults = useAbortableLoad<VoiceDefaultsResponse>(loadDefaults, 'defaults')
    const errorMessage = useLoadErrorMessage(defaults.error)

    const replaceCell = (role: VoiceDefaultRole, language: string, rows: VoiceDefaultsResponse['items']) => {
        defaults.setData((previous) =>
            previous
                ? { ...previous, items: [...previous.items.filter((row) => !(row.role === role && row.language === language)), ...rows] }
                : previous,
        )
    }

    return (
        <ConsoleSection icon={Mic2} title={t('admin.voices.defaults.title')} description={t('admin.voices.defaults.description')}>
            {errorMessage && (
                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={defaults.reload}>{t('admin.voices.common.retry')}</Button>}>
                    {errorMessage}
                </Callout>
            )}
            {defaults.loading && !defaults.data && <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.common.loading')}</p>}
            {defaults.data && (
                <>
                    <div className="flex flex-col gap-1 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                        <span className="font-ui text-label font-semibold text-fg">{t('admin.voices.defaults.lastResort')}</span>
                        <code className="font-mono text-sm text-parchment-100">{defaults.data.last_resort_voice_key ?? t('admin.voices.common.notSet')}</code>
                        <span className="font-ui text-caption text-fg-muted">{t('admin.voices.defaults.lastResortHelp')}</span>
                        <span className="font-ui text-caption text-fg-muted">{t('admin.voices.defaults.voicelessNote')}</span>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        {DEFAULTS_REQUIREMENTS.map((requirement) => (
                            <LanguageDefaults
                                key={`${requirement.language}-${JSON.stringify(defaults.data?.items.filter((row) => row.language === requirement.language))}`}
                                requirement={requirement}
                                narratorKeys={defaultKeys(defaults.data!.items, 'narrator', requirement.language)}
                                fallbackKeys={defaultKeys(defaults.data!.items, 'character_fallback', requirement.language)}
                                onSaved={replaceCell}
                            />
                        ))}
                    </div>
                </>
            )}
        </ConsoleSection>
    )
}

interface LanguageDefaultsProps {
    requirement: DefaultsRequirement
    narratorKeys: string[]
    fallbackKeys: string[]
    onSaved: (role: VoiceDefaultRole, language: string, rows: VoiceDefaultsResponse['items']) => void
}

function LanguageDefaults({ requirement, narratorKeys, fallbackKeys, onSaved }: LanguageDefaultsProps) {
    const { t } = useTranslation()
    const { catalog, languageName, notify, reportError } = useVoiceConsole()
    const headingId = useId()
    const { language } = requirement
    const name = languageName(language)
    const [narrator, setNarrator] = useState(narratorKeys[0] ?? '')
    const [pool, setPool] = useState<string[]>(fallbackKeys)
    const [adding, setAdding] = useState('')
    const [saving, setSaving] = useState<VoiceDefaultRole | null>(null)
    const [blocked, setBlocked] = useState<Partial<Record<VoiceDefaultRole, string>>>({})

    const checksFor = (voice: AdminCatalogVoice | undefined): RuleCheck[] => (voice ? readinessChecks(voice, language, name) : [])
    const narratorVoice = narrator ? catalog.byKey.get(narrator) : undefined
    const poolVoices = pool.map((key) => catalog.byKey.get(key))
    const options = voiceSelectOptions(catalog.voices.filter((voice) => voice.status !== 'removed'), t)
    const shortfall = fallbackShortfall(pool.length)

    const save = async (role: VoiceDefaultRole, keys: string[]) => {
        for (const key of keys) {
            const voice = catalog.byKey.get(key)
            const failure = voice ? firstFailure(checksFor(voice)) : null
            if (!voice || failure) {
                const check = failure ? t(failure.labelKey, failure.labelValues) : t('admin.voices.common.unknown')
                setBlocked((previous) => ({ ...previous, [role]: t('admin.voices.defaults.blocked', { name: voiceName(voice, key, t), check }) }))
                return
            }
        }
        setBlocked((previous) => ({ ...previous, [role]: undefined }))
        setSaving(role)
        try {
            const response = await apiService.putVoiceDefaults(role, language, keys)
            onSaved(role, language, response.items)
            notify(t('admin.voices.toasts.defaultsSaved'))
        } catch (error) {
            setBlocked((previous) => ({ ...previous, [role]: reportError(error) }))
        } finally {
            setSaving(null)
        }
    }

    const move = (index: number, delta: number) => {
        setPool((previous) => {
            const next = [...previous]
            const target = index + delta
            if (target < 0 || target >= next.length) return previous
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })
    }

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border border-line-faint bg-ink-800/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={headingId} className="font-display text-base font-semibold text-fg">
                    {t('admin.voices.defaults.language', { language: name, code: language })}
                </h3>
                <Badge tone={requirement.required ? 'ember' : 'neutral'}>
                    {requirement.required ? t('admin.voices.defaults.required') : t('admin.voices.defaults.optional')}
                </Badge>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <h4 className="font-ui text-label font-semibold text-fg">{t('admin.voices.defaults.narrator')}</h4>
                    {narratorKeys.length === 0 && requirement.required && <Badge tone="danger">{t('admin.voices.defaults.missing')}</Badge>}
                </div>
                {narratorKeys.length === 0 && requirement.required && (
                    <p className="font-ui text-sm text-blood-300">{t('admin.voices.defaults.missingNarrator')}</p>
                )}
                <Field label={t('admin.voices.defaults.narrator')}>
                    <Select options={options} value={narrator} onChange={setNarrator} placeholder={t('admin.voices.defaults.pickVoice')} />
                </Field>
                {narratorVoice && <RuleChecklist title={t('admin.voices.defaults.readiness.title')} checks={checksFor(narratorVoice)} />}
                {blocked.narrator && (
                    <p role="alert" className="font-ui text-sm text-blood-300">
                        {blocked.narrator}
                    </p>
                )}
                <div>
                    <Button variant="primary" size="sm" onClick={() => void save('narrator', [narrator])} disabled={!narrator || saving === 'narrator'}>
                        {saving === 'narrator' ? t('admin.voices.common.saving') : t('admin.voices.defaults.save', { role: t('admin.voices.defaults.narrator') })}
                    </Button>
                </div>
            </div>

            {requirement.needsFallbackPool && (
                <div className="flex flex-col gap-3 border-t border-line-faint pt-4">
                    <div className="flex items-center gap-2">
                        <h4 className="font-ui text-label font-semibold text-fg">{t('admin.voices.defaults.fallback')}</h4>
                        {fallbackKeys.length < FALLBACK_POOL_MIN && <Badge tone="danger">{t('admin.voices.defaults.missing')}</Badge>}
                    </div>
                    <p className="font-ui text-caption text-fg-muted">{t('admin.voices.defaults.fallbackHelp')}</p>
                    <ol className="flex flex-col gap-2">
                        {pool.map((key, index) => {
                            const voice = poolVoices[index]
                            const display = voiceName(voice, key, t)
                            const failure = voice ? firstFailure(checksFor(voice)) : null
                            return (
                                <li key={key} className="flex flex-wrap items-center gap-2 rounded-md border border-line-faint bg-ink-900 px-3 py-2">
                                    <span className="font-mono text-xs text-fg-muted">{index + 1}</span>
                                    <span className="min-w-0 flex-1 font-ui text-sm text-parchment-100">
                                        {display}
                                        {voice?.gender && <span className="ml-2 text-caption text-fg-muted">{t(`admin.voices.gender.${voice.gender}`)}</span>}
                                        {failure && <span className="block text-caption text-blood-300">{t(failure.labelKey, failure.labelValues)}</span>}
                                    </span>
                                    <IconButton label={t('admin.voices.common.moveUp', { name: display })} size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                                        <Icon icon={ArrowUp} size={14} />
                                    </IconButton>
                                    <IconButton label={t('admin.voices.common.moveDown', { name: display })} size="sm" onClick={() => move(index, 1)} disabled={index === pool.length - 1}>
                                        <Icon icon={ArrowDown} size={14} />
                                    </IconButton>
                                    <IconButton label={t('admin.voices.common.removeItem', { name: display })} size="sm" onClick={() => setPool((previous) => previous.filter((item) => item !== key))}>
                                        <Icon icon={X} size={14} />
                                    </IconButton>
                                </li>
                            )
                        })}
                    </ol>
                    {shortfall > 0 && <p className="font-ui text-sm text-blood-300">{t('admin.voices.defaults.missingFallback', { count: FALLBACK_POOL_MIN })}</p>}
                    {pool.length >= 2 && !hasMixedGender(poolVoices) && <p className="font-ui text-sm text-amber-500">{t('admin.voices.defaults.mixedGender')}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Field label={t('admin.voices.defaults.addFallback')} className="flex-1">
                            <Select
                                options={options.filter((option) => !pool.includes(option.value))}
                                value={adding}
                                onChange={setAdding}
                                placeholder={t('admin.voices.defaults.pickVoice')}
                            />
                        </Field>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (adding) setPool((previous) => [...previous, adding])
                                setAdding('')
                            }}
                            disabled={!adding}
                        >
                            {t('admin.voices.common.add')}
                        </Button>
                    </div>
                    {blocked.character_fallback && (
                        <p role="alert" className="font-ui text-sm text-blood-300">
                            {blocked.character_fallback}
                        </p>
                    )}
                    <div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void save('character_fallback', pool)}
                            disabled={pool.length === 0 || saving === 'character_fallback'}
                        >
                            {saving === 'character_fallback'
                                ? t('admin.voices.common.saving')
                                : t('admin.voices.defaults.save', { role: t('admin.voices.defaults.fallback') })}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    )
}
