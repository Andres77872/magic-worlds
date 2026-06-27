import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Hash, Loader2, RefreshCw, RotateCcw, UserRound, Users } from 'lucide-react'
import type { Membership, QuotaResetPeriod, QuotaResetRequest, QuotaResetResponse, QuotaResetTarget } from '@/shared'
import {
    Button,
    Card,
    Field,
    Icon,
    Input,
    SectionHeader,
    SegmentedControl,
    SwitchRow,
    Textarea,
} from '@/ui/primitives'
import { ConfirmDialog } from '@/ui/components/ConfirmDialog'

type IdentifierMode = 'user_hash' | 'user_id'

interface QuotaResetPanelProps {
    resetting: boolean
    lastReset: QuotaResetResponse | null
    onReset: (request: QuotaResetRequest) => Promise<QuotaResetResponse | null>
}

const targetOptions = (t: (key: string) => string) => [
    { value: 'all' as const, label: t('admin.creditCodes.quotaReset.targetAll'), icon: <Icon icon={Users} size={16} /> },
    { value: 'user' as const, label: t('admin.creditCodes.quotaReset.targetUser'), icon: <Icon icon={UserRound} size={16} /> },
]

const identifierOptions = (t: (key: string) => string) => [
    { value: 'user_hash' as const, label: t('admin.creditCodes.quotaReset.identifierHash'), icon: <Icon icon={Hash} size={16} /> },
    { value: 'user_id' as const, label: t('admin.creditCodes.quotaReset.identifierId'), icon: <span className="font-ui text-xs font-bold">#</span> },
]

export function QuotaResetPanel({ resetting, lastReset, onReset }: QuotaResetPanelProps) {
    const { t } = useTranslation()
    const [target, setTarget] = useState<QuotaResetTarget>('all')
    const [identifierMode, setIdentifierMode] = useState<IdentifierMode>('user_hash')
    const [userHash, setUserHash] = useState('')
    const [userId, setUserId] = useState('')
    const [daily, setDaily] = useState(true)
    const [monthly, setMonthly] = useState(false)
    const [reason, setReason] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)

    const periods = useMemo<QuotaResetPeriod[]>(() => {
        const selected: QuotaResetPeriod[] = []
        if (daily) selected.push('daily')
        if (monthly) selected.push('monthly')
        return selected
    }, [daily, monthly])

    const parsedUserId = Number(userId)
    const userIdValid = Number.isInteger(parsedUserId) && parsedUserId > 0
    const userHashValid = userHash.trim().length > 0
    const userTargetValid = target === 'all' || (identifierMode === 'user_hash' ? userHashValid : userIdValid)
    const periodsValid = periods.length > 0
    const canSubmit = periodsValid && userTargetValid && !resetting
    const validationMessage = !periodsValid
        ? t('admin.creditCodes.quotaReset.validation.period')
        : !userTargetValid
          ? t('admin.creditCodes.quotaReset.validation.target')
          : null

    const periodLabel = periods.map((period) => t(`admin.creditCodes.quotaReset.periods.${period}`)).join(', ')
    const targetLabel =
        target === 'all'
            ? t('admin.creditCodes.quotaReset.targetAll')
            : identifierMode === 'user_hash'
              ? userHash.trim()
              : `#${Math.trunc(parsedUserId)}`

    const buildPayload = (): QuotaResetRequest => {
        const payload: QuotaResetRequest = {
            target,
            periods,
            reason: reason.trim() || null,
        }
        if (target === 'user') {
            if (identifierMode === 'user_hash') payload.user_hash = userHash.trim()
            else payload.user_id = Math.trunc(parsedUserId)
        }
        return payload
    }

    const handleConfirm = async () => {
        await onReset(buildPayload())
        setConfirmOpen(false)
    }

    return (
        <Card>
            <div className="flex flex-col gap-5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <SectionHeader icon={RotateCcw} title={t('admin.creditCodes.quotaReset.title')} tone="arcane" />
                        <p className="mt-1 max-w-[62ch] font-ui text-[13px] leading-relaxed text-parchment-300">
                            {t('admin.creditCodes.quotaReset.description')}
                        </p>
                    </div>
                    <Button
                        variant="danger"
                        size="sm"
                        iconLeft={<Icon icon={resetting ? Loader2 : RefreshCw} size={15} className={resetting ? 'animate-spin' : undefined} />}
                        disabled={!canSubmit}
                        onClick={() => setConfirmOpen(true)}
                    >
                        {resetting ? t('admin.creditCodes.quotaReset.resetting') : t('admin.creditCodes.quotaReset.reset')}
                    </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t('admin.creditCodes.quotaReset.targetLabel')}>
                                <SegmentedControl
                                    aria-label={t('admin.creditCodes.quotaReset.targetLabel')}
                                    options={targetOptions(t)}
                                    value={target}
                                    onChange={setTarget}
                                />
                            </Field>
                            <Field label={t('admin.creditCodes.quotaReset.periodsLabel')} error={!periodsValid ? validationMessage : undefined}>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <SwitchRow
                                        label={t('admin.creditCodes.quotaReset.periods.daily')}
                                        description={t('admin.creditCodes.quotaReset.dailyDescription')}
                                        checked={daily}
                                        onChange={setDaily}
                                        disabled={resetting}
                                    />
                                    <SwitchRow
                                        label={t('admin.creditCodes.quotaReset.periods.monthly')}
                                        description={t('admin.creditCodes.quotaReset.monthlyDescription')}
                                        checked={monthly}
                                        onChange={setMonthly}
                                        disabled={resetting}
                                    />
                                </div>
                            </Field>
                        </div>

                        {target === 'user' && (
                            <div className="grid gap-4 rounded-lg border border-parchment-50/[.08] bg-ink-700/55 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                                <Field label={t('admin.creditCodes.quotaReset.identifierLabel')}>
                                    <SegmentedControl
                                        aria-label={t('admin.creditCodes.quotaReset.identifierLabel')}
                                        options={identifierOptions(t)}
                                        value={identifierMode}
                                        onChange={setIdentifierMode}
                                    />
                                </Field>
                                {identifierMode === 'user_hash' ? (
                                    <Field
                                        label={t('admin.creditCodes.quotaReset.userHashLabel')}
                                        error={!userHashValid ? validationMessage ?? undefined : undefined}
                                    >
                                        <Input
                                            value={userHash}
                                            onChange={(event) => setUserHash(event.target.value)}
                                            placeholder={t('admin.creditCodes.quotaReset.userHashPlaceholder')}
                                            disabled={resetting}
                                        />
                                    </Field>
                                ) : (
                                    <Field
                                        label={t('admin.creditCodes.quotaReset.userIdLabel')}
                                        error={!userIdValid ? validationMessage ?? undefined : undefined}
                                    >
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            step={1}
                                            value={userId}
                                            onChange={(event) => setUserId(event.target.value)}
                                            placeholder="123"
                                            disabled={resetting}
                                        />
                                    </Field>
                                )}
                            </div>
                        )}

                        <Field label={t('admin.creditCodes.quotaReset.reasonLabel')} helper={t('admin.creditCodes.quotaReset.reasonHelper')}>
                            <Textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder={t('admin.creditCodes.quotaReset.reasonPlaceholder')}
                                maxLength={500}
                                disabled={resetting}
                                className="min-h-[84px]"
                            />
                        </Field>
                    </div>

                    <QuotaResetResult result={lastReset} />
                </div>
            </div>

            <ConfirmDialog
                visible={confirmOpen}
                title={t('admin.creditCodes.quotaReset.confirmTitle')}
                message={
                    <span className="space-y-3">
                        <span className="block">
                            {target === 'all'
                                ? t('admin.creditCodes.quotaReset.confirmAll', { periods: periodLabel })
                                : t('admin.creditCodes.quotaReset.confirmUser', { periods: periodLabel, target: targetLabel })}
                        </span>
                        <span className="block text-parchment-300">{t('admin.creditCodes.quotaReset.confirmPayg')}</span>
                    </span>
                }
                confirmLabel={t('admin.creditCodes.quotaReset.reset')}
                cancelLabel={t('admin.common.cancel')}
                variant="danger"
                isProcessing={resetting}
                processingLabel={t('admin.creditCodes.quotaReset.resetting')}
                icon={<Icon icon={CalendarDays} size={20} />}
                onConfirm={() => void handleConfirm()}
                onCancel={() => setConfirmOpen(false)}
            />
        </Card>
    )
}

function QuotaResetResult({ result }: { result: QuotaResetResponse | null }) {
    const { t } = useTranslation()
    if (!result) {
        return (
            <div className="rounded-lg border border-parchment-50/[.08] bg-ink-700/45 p-4 font-ui text-sm text-parchment-300">
                {t('admin.creditCodes.quotaReset.noResult')}
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-arcane-500/25 bg-arcane-500/[.06] p-4">
            <div className="font-ui text-sm font-semibold text-parchment-50">{t('admin.creditCodes.quotaReset.resultTitle')}</div>
            <dl className="mt-3 space-y-2 font-ui text-sm text-parchment-200">
                <ResultLine label={t('admin.creditCodes.quotaReset.resultTarget')}>
                    {result.target === 'all'
                        ? t('admin.creditCodes.quotaReset.targetAll')
                        : result.target_user_hash ?? (result.target_user_id != null ? `#${result.target_user_id}` : t('admin.creditCodes.quotaReset.targetUser'))}
                </ResultLine>
                {result.reset_at && <ResultLine label={t('admin.creditCodes.quotaReset.resultTime')}>{formatDateTime(result.reset_at)}</ResultLine>}
                {result.daily && (
                    <ResultLine label={t('admin.creditCodes.quotaReset.periods.daily')}>
                        {t('admin.creditCodes.quotaReset.dailyCounts', {
                            usage: result.daily.membership_usage_days,
                            operations: result.daily.membership_operation_usage_days,
                            aiCards: result.daily.ai_card_quota_days,
                        })}
                        <span className="mt-1 block text-parchment-300">
                            {t('admin.creditCodes.quotaReset.seeded', { count: result.daily.seeded_user_memberships })}
                        </span>
                    </ResultLine>
                )}
                {result.monthly && (
                    <ResultLine label={t('admin.creditCodes.quotaReset.periods.monthly')}>
                        {t('admin.creditCodes.quotaReset.monthlyResult', {
                            id: result.monthly.reset_id,
                            month: result.monthly.effective_month,
                        })}
                    </ResultLine>
                )}
                {result.membership && <MembershipResult membership={result.membership} />}
            </dl>
        </div>
    )
}

function MembershipResult({ membership }: { membership: Membership }) {
    const { t } = useTranslation()
    const remaining = membership.credits?.remaining
    const max = membership.credits?.max
    if (remaining == null || max == null) return null
    return (
        <ResultLine label={t('admin.creditCodes.quotaReset.membershipLabel')}>
            {t('admin.creditCodes.quotaReset.membershipResult', { remaining, max })}
        </ResultLine>
    )
}

function ResultLine({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-parchment-400">{label}</dt>
            <dd className="mt-0.5">{children}</dd>
        </div>
    )
}

function formatDateTime(value: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString()
}
