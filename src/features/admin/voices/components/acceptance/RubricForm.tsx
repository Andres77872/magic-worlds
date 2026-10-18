/**
 * Acceptance rubric for one (voice, model, language) (05 §8.4 steps 4–6,
 * AC-R3): six 1–5 radio groups, an explicit pass or fail, integrated loudness
 * from an offline meter with the derived attenuation-only gain (I-15), and the
 * call-eligibility preview. A pass without loudness, or one that needs more
 * than −6 dB, is blocked here with the reason the BFF would give, shown on the
 * loudness field (which then gets focus).
 */
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, PhoneCall, PhoneOff } from 'lucide-react'
import type { AcceptanceScoreKey, AcceptanceScores, AcceptanceVerdict, AdminCatalogAcceptance, AcceptanceVerdictRequest } from '@/shared'
import { Badge, Button, Callout, Field, Icon, Input, cx } from '@/ui/primitives'
import { STANDARD_MODEL_ID, LOW_SCORE_WARNING, MAX_ATTENUATION_DB, SCORE_KEYS, SCORE_VALUES, TARGET_LUFS } from '../../constants'
import { MAX_PASS_LUFS, callEligibleFrom, loudnessFlags, verdictBlocker } from '../../consoleRules'
import { formatDate, formatDb } from '../../format'

export interface RubricFormProps {
    modelId: string
    modelLabel: string
    /** The stored row for this model and language, used as the starting point. */
    stored: AdminCatalogAcceptance | null
    /** Server-measured loudness of the latest renders, when known. */
    measuredLufs: number | null
    locale: string
    saving: boolean
    error: string | null
    onSubmit: (body: AcceptanceVerdictRequest) => void
}

type DraftScores = Partial<Record<AcceptanceScoreKey, number>>

export function RubricForm({ modelId, modelLabel, stored, measuredLufs, locale, saving, error, onSubmit }: RubricFormProps) {
    const { t } = useTranslation()
    const idBase = useId()
    const [scores, setScores] = useState<DraftScores>(() => ({ ...(stored?.scores ?? {}) }))
    const [verdict, setVerdict] = useState<AcceptanceVerdict | null>(stored?.verdict ?? null)
    const initialLufs = [stored?.integrated_lufs, measuredLufs].find((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const [lufs, setLufs] = useState(initialLufs === undefined ? '' : String(initialLufs))
    const [attempted, setAttempted] = useState(false)
    const lufsInput = useRef<HTMLInputElement>(null)

    const parsed = lufs.trim() === '' ? null : Number(lufs)
    const parsedLufs = parsed !== null && Number.isFinite(parsed) ? parsed : null
    const loudness = loudnessFlags(parsedLufs)
    const complete = SCORE_KEYS.every((key) => typeof scores[key] === 'number') && verdict !== null
    const blocker = verdictBlocker(verdict, parsedLufs)
    const lowScore = SCORE_KEYS.some((key) => typeof scores[key] === 'number' && (scores[key] as number) < LOW_SCORE_WARNING)
    const isStandard = modelId === STANDARD_MODEL_ID
    const callEligible = callEligibleFrom(modelId, verdict, scores)
    const passRefused = verdict === 'pass' && loudness.tooLoud
    const blockerText =
        blocker === 'gain_out_of_range'
            ? t('admin.voices.acceptance.loudness.passBlocked', { maxLufs: formatDb(MAX_PASS_LUFS, locale), limit: formatDb(MAX_ATTENUATION_DB, locale) })
            : blocker === 'lufs_required'
              ? t('admin.voices.acceptance.loudness.lufsRequired')
              : null

    const submit = (event: FormEvent) => {
        event.preventDefault()
        setAttempted(true)
        if (complete && blocker !== null) lufsInput.current?.focus()
        if (!complete || verdict === null || blocker !== null) return
        onSubmit({
            verdict,
            scores: scores as AcceptanceScores,
            ...(parsedLufs !== null ? { integrated_lufs: parsedLufs } : {}),
        })
    }

    return (
        <form
            onSubmit={submit}
            noValidate
            aria-label={t('admin.voices.acceptance.rubric.title', { model: modelLabel })}
            className="flex flex-col gap-4 rounded-lg border border-line-faint bg-ink-800/70 p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-semibold text-fg">{t('admin.voices.acceptance.rubric.title', { model: modelLabel })}</h4>
                {stored && (
                    <Badge tone={stored.verdict === 'pass' ? 'live' : 'danger'}>
                        {t('admin.voices.acceptance.rubric.stored', {
                            verdict: t(`admin.voices.acceptance.verdict.${stored.verdict}`),
                            date: formatDate(stored.reviewed_at, locale),
                        })}
                    </Badge>
                )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {SCORE_KEYS.map((key) => (
                    <fieldset key={key} className="flex flex-col gap-1.5">
                        <legend className="mb-1 font-ui text-label font-semibold text-fg">
                            {t('admin.voices.acceptance.rubric.scoreLegend', { label: t(['drama-3', 's2.1-pro'].includes(modelId) && key === 'consistency_vs_v4'
                                ? 'admin.voices.fish.reviewConsistency' : ['drama-3', 's2.1-pro'].includes(modelId) && key === 'emotion_tags'
                                  ? 'admin.voices.fish.reviewEmotion' : `admin.voices.acceptance.rubric.${key}`) })}
                        </legend>
                        <div className="flex gap-1.5">
                            {SCORE_VALUES.map((value) => {
                                const inputId = `${idBase}-${key}-${value}`
                                const checked = scores[key] === value
                                return (
                                    <label
                                        key={value}
                                        htmlFor={inputId}
                                        className={cx(
                                            'flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border px-2 font-mono text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember-500',
                                            checked ? 'border-ember-500 bg-ember-500/15 text-ember-300' : 'border-line-faint bg-ink-900 text-parchment-200 hover:border-line-strong',
                                        )}
                                    >
                                        <input
                                            id={inputId}
                                            type="radio"
                                            name={`${idBase}-${key}`}
                                            value={value}
                                            checked={checked}
                                            onChange={() => setScores((previous) => ({ ...previous, [key]: value }))}
                                            className="sr-only"
                                        />
                                        {t('admin.voices.acceptance.rubric.scoreValue', { value })}
                                    </label>
                                )
                            })}
                        </div>
                    </fieldset>
                ))}
            </div>

            {lowScore && (
                <p className="flex items-center gap-2 font-ui text-sm text-amber-500">
                    <Icon icon={AlertTriangle} size={14} />
                    {t('admin.voices.acceptance.rubric.lowScoreWarning')}
                </p>
            )}

            <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 font-ui text-label font-semibold text-fg">{t('admin.voices.acceptance.verdict.legend')}</legend>
                <div className="flex gap-2">
                    {(['pass', 'fail'] as const).map((value) => {
                        const inputId = `${idBase}-verdict-${value}`
                        const checked = verdict === value
                        return (
                            <label
                                key={value}
                                htmlFor={inputId}
                                className={cx(
                                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-ui text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember-500',
                                    checked
                                        ? value === 'pass'
                                            ? 'border-verdant-500 bg-verdant-500/10 text-verdant-500'
                                            : 'border-blood-500 bg-blood-500/10 text-blood-300'
                                        : 'border-line-faint bg-ink-900 text-parchment-200 hover:border-line-strong',
                                )}
                            >
                                <input
                                    id={inputId}
                                    type="radio"
                                    name={`${idBase}-verdict`}
                                    value={value}
                                    checked={checked}
                                    onChange={() => setVerdict(value)}
                                    className="sr-only"
                                />
                                {t(`admin.voices.acceptance.verdict.${value}`)}
                            </label>
                        )
                    })}
                </div>
            </fieldset>

            <div className="flex flex-col gap-2">
                <Field
                    label={t('admin.voices.acceptance.loudness.lufs')}
                    helper={t('admin.voices.acceptance.loudness.lufsHelp')}
                    error={attempted && blockerText ? blockerText : undefined}
                >
                    <Input
                        ref={lufsInput}
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={lufs}
                        onChange={(event) => setLufs(event.target.value)}
                        className="max-w-[160px]"
                    />
                </Field>
                <p className="font-mono text-sm text-parchment-100" aria-live="polite">
                    {loudness.gainDb === null
                        ? t('admin.voices.acceptance.loudness.gainPending')
                        : t('admin.voices.acceptance.loudness.gainDb', { gain: formatDb(loudness.gainDb, locale) })}
                    <span className="ml-2 font-ui text-caption text-fg-muted">
                        {t('admin.voices.acceptance.loudness.target', { target: formatDb(TARGET_LUFS, locale) })}
                    </span>
                </p>
                {loudness.tooLoud && (
                    <Callout tone={passRefused ? 'danger' : 'warning'} role="status" icon={<Icon icon={AlertTriangle} size={16} />}>
                        {t('admin.voices.acceptance.loudness.tooLoud', { limit: formatDb(MAX_ATTENUATION_DB, locale) })}
                    </Callout>
                )}
                {loudness.tooQuiet && <p className="font-ui text-caption text-fg-muted">{t('admin.voices.acceptance.loudness.tooQuiet')}</p>}
            </div>

            <p className={cx('flex items-center gap-2 font-ui text-sm', isStandard ? (callEligible ? 'text-verdant-500' : 'text-parchment-300') : 'text-fg-muted')}>
                <Icon icon={isStandard && callEligible ? PhoneCall : PhoneOff} size={14} />
                {isStandard
                    ? callEligible
                        ? t('admin.voices.acceptance.callEligible.yes')
                        : t('admin.voices.acceptance.callEligible.no')
                    : t(['drama-3', 's2.1-pro'].includes(modelId) ? 'admin.voices.fish.narrationOnly' : 'admin.voices.acceptance.callEligible.notApplicable')}
            </p>

            {attempted && !complete && (
                <p role="alert" className="font-ui text-sm text-blood-300">
                    {t('admin.voices.acceptance.rubric.incomplete')}
                </p>
            )}
            {error && (
                <p role="alert" className="font-ui text-sm text-blood-300">
                    {error}
                </p>
            )}

            <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm" disabled={saving}>
                    {saving ? t('admin.voices.common.saving') : t('admin.voices.acceptance.rubric.save')}
                </Button>
            </div>
        </form>
    )
}
