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
import { dateFromApiTimestamp } from '@/utils/time'

type IdentifierMode = 'user_hash' | 'user_id'

interface QuotaResetPanelProps {
    resetting: boolean
    lastReset: QuotaResetResponse | null
    onReset: (request: QuotaResetRequest) => Promise<QuotaResetResponse | null>
}

const targetOptions = (t: (key: string) => string) => [
    { value: 'all' as const, label: t('admin.membership.quotaReset.targetAll'), icon: <Icon icon={Users} size={16} /> },
    { value: 'user' as const, label: t('admin.membership.quotaReset.targetUser'), icon: <Icon icon={UserRound} size={16} /> },
]

const identifierOptions = (t: (key: string) => string) => [
    { value: 'user_hash' as const, label: t('admin.membership.quotaReset.identifierHash'), icon: <Icon icon={Hash} size={16} /> },
    { value: 'user_id' as const, label: t('admin.membership.quotaReset.identifierId'), icon: <span className="font-ui text-xs font-bold">#</span> },
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
        ? t('admin.membership.quotaReset.validation.period')
        : !userTargetValid
          ? t('admin.membership.quotaReset.validation.target')
          : null

    const periodLabel = periods.map((period) => t(`admin.membership.quotaReset.periods.${period}`)).join(', ')
    const targetLabel =
        target === 'all'
            ? t('admin.membership.quotaReset.targetAll')
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
                        <SectionHeader icon={RotateCcw} title={t('admin.membership.quotaReset.title')} tone="arcane" />
                        <p className="mt-1 max-w-[62ch] font-ui text-[13px] leading-relaxed text-parchment-300">
                            {t('admin.membership.quotaReset.description')}
                        </p>
                    </div>
                    <Button
                        variant="danger"
                        size="sm"
                        iconLeft={<Icon icon={resetting ? Loader2 : RefreshCw} size={15} className={resetting ? 'animate-spin' : undefined} />}
                        disabled={!canSubmit}
                        onClick={() => setConfirmOpen(true)}
                    >
                        {resetting ? t('admin.membership.quotaReset.resetting') : t('admin.membership.quotaReset.reset')}
                    </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
                            <Field label={t('admin.membership.quotaReset.targetLabel')}>
                                <SegmentedControl
                                    showLabels
                                    aria-label={t('admin.membership.quotaReset.targetLabel')}
                                    options={targetOptions(t)}
                                    value={target}
                                    onChange={setTarget}
                                />
                            </Field>
                            <Field label={t('admin.membership.quotaReset.periodsLabel')} error={!periodsValid ? validationMessage : undefined}>
                                <div className="flex flex-col gap-2">
                                    <SwitchRow
                                        variant="plain"
                                        label={t('admin.membership.quotaReset.periods.daily')}
                                        description={t('admin.membership.quotaReset.dailyDescription')}
                                        checked={daily}
                                        onChange={setDaily}
                                        disabled={resetting}
                                    />
                                    <SwitchRow
                                        variant="plain"
                                        label={t('admin.membership.quotaReset.periods.monthly')}
                                        description={t('admin.membership.quotaReset.monthlyDescription')}
                                        checked={monthly}
                                        onChange={setMonthly}
                                        disabled={resetting}
                                    />
                                </div>
                            </Field>
                        </div>

                        {target === 'user' && (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 border-t border-line-faint pt-4">
                                <Field label={t('admin.membership.quotaReset.identifierLabel')}>
                                    <SegmentedControl
                                        showLabels
                                        aria-label={t('admin.membership.quotaReset.identifierLabel')}
                                        options={identifierOptions(t)}
                                        value={identifierMode}
                                        onChange={setIdentifierMode}
                                    />
                                </Field>
                                {identifierMode === 'user_hash' ? (
                                    <Field
                                        label={t('admin.membership.quotaReset.userHashLabel')}
                                        error={!userHashValid ? validationMessage ?? undefined : undefined}
                                    >
                                        <Input
                                            value={userHash}
                                            onChange={(event) => setUserHash(event.target.value)}
                                            placeholder={t('admin.membership.quotaReset.userHashPlaceholder')}
                                            disabled={resetting}
                                        />
                                    </Field>
                                ) : (
                                    <Field
                                        label={t('admin.membership.quotaReset.userIdLabel')}
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

                        <Field label={t('admin.membership.quotaReset.reasonLabel')} helper={t('admin.membership.quotaReset.reasonHelper')}>
                            <Textarea
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder={t('admin.membership.quotaReset.reasonPlaceholder')}
                                maxLength={255}
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
                title={t('admin.membership.quotaReset.confirmTitle')}
                message={
                    <span className="space-y-3">
                        <span className="block">
                            {target === 'all'
                                ? t('admin.membership.quotaReset.confirmAll', { periods: periodLabel })
                                : t('admin.membership.quotaReset.confirmUser', { periods: periodLabel, target: targetLabel })}
                        </span>
                        <span className="block text-parchment-300">{t('admin.membership.quotaReset.confirmPayg')}</span>
                    </span>
                }
                confirmLabel={t('admin.membership.quotaReset.reset')}
                cancelLabel={t('admin.common.cancel')}
                variant="danger"
                isProcessing={resetting}
                processingLabel={t('admin.membership.quotaReset.resetting')}
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
            <div className="py-3 font-ui text-sm text-parchment-300">
                {t('admin.membership.quotaReset.noResult')}
            </div>
        )
    }

    return (
        <div className="border-l-2 border-verdant-500/40 pl-4">
            <div className="font-ui text-sm font-semibold text-parchment-50">{t('admin.membership.quotaReset.resultTitle')}</div>
            <dl className="mt-3 space-y-2 font-ui text-sm text-parchment-200">
                <ResultLine label={t('admin.membership.quotaReset.resultTarget')}>
                    {result.target === 'all'
                        ? t('admin.membership.quotaReset.targetAll')
                        : result.target_user_hash ?? (result.target_user_id != null ? `#${result.target_user_id}` : t('admin.membership.quotaReset.targetUser'))}
                </ResultLine>
                {result.reset_at && <ResultLine label={t('admin.membership.quotaReset.resultTime')}>{formatDateTime(result.reset_at)}</ResultLine>}
                {result.daily && (
                    <ResultLine label={t('admin.membership.quotaReset.periods.daily')}>
                        {t('admin.membership.quotaReset.dailyCounts', {
                            usage: result.daily.membership_usage_days,
                            operations: result.daily.membership_operation_usage_days,
                            aiCards: result.daily.ai_card_quota_days,
                        })}
                    </ResultLine>
                )}
                {result.monthly && (
                    <ResultLine label={t('admin.membership.quotaReset.periods.monthly')}>
                        {t('admin.membership.quotaReset.monthlyResult', {
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
        <ResultLine label={t('admin.membership.quotaReset.membershipLabel')}>
            {t('admin.membership.quotaReset.membershipResult', { remaining, max })}
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

/** Offset-less API stamps are UTC; parse them as such before localising. */
function formatDateTime(value: string): string {
    const parsed = dateFromApiTimestamp(value)
    if (!parsed) return value
    return parsed.toLocaleString()
}
