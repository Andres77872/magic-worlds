/**
 * Toolbar for the unified Credit Tokens console: the Codes / Email type switch,
 * a debounced search box, the status filter chips, the sort selector, and the
 * Create / Export actions. All filtering is resolved server-side; this is the
 * single control surface that drives {@link useCreditCodesStudio}.
 */
import { useTranslation } from 'react-i18next'
import { Download, KeyRound, Loader2, Mail, Plus, Search, X } from 'lucide-react'
import type { CreditGrantKind, CreditGrantListSort } from '@/shared'
import { Button, Chip, Icon, IconButton, Select, controlClass, cx, type SelectOption } from '@/ui/primitives'
import type { StatusFilter } from '../hooks/useCreditCodesStudio'

interface CreditTokensToolbarProps {
    activeType: CreditGrantKind
    onTypeChange: (type: CreditGrantKind) => void
    status: StatusFilter
    onStatusChange: (status: StatusFilter) => void
    search: string
    onSearchChange: (value: string) => void
    searching: boolean
    sort: CreditGrantListSort
    onSortChange: (sort: CreditGrantListSort) => void
    total: number | null
    onCreate: () => void
    createActive: boolean
    onExport: () => void
    exporting: boolean
    exportDisabled: boolean
}

const STATUS_ORDER: StatusFilter[] = ['active', 'claimed', 'expired', 'disabled', 'all']

export function CreditTokensToolbar({
    activeType,
    onTypeChange,
    status,
    onStatusChange,
    search,
    onSearchChange,
    searching,
    sort,
    onSortChange,
    total,
    onCreate,
    createActive,
    onExport,
    exporting,
    exportDisabled,
}: CreditTokensToolbarProps) {
    const { t } = useTranslation()
    const hasQuery = search.length > 0

    const sortOptions: SelectOption[] = [
        { value: 'recent', label: t('admin.creditCodes.sort.recent') },
        { value: 'credits', label: t('admin.creditCodes.sort.credits') },
        { value: 'expiry', label: t('admin.creditCodes.sort.expiry') },
    ]

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Inventory type switch */}
                <div className="flex gap-2" role="group" aria-label={t('admin.creditCodes.toolbar.typeLabel')}>
                    <Chip
                        active={activeType === 'code'}
                        icon={<Icon icon={KeyRound} size={13} />}
                        onClick={() => onTypeChange('code')}
                        aria-pressed={activeType === 'code'}
                    >
                        {t('admin.creditCodes.toolbar.typeCodes')}
                    </Chip>
                    <Chip
                        active={activeType === 'email'}
                        icon={<Icon icon={Mail} size={13} />}
                        onClick={() => onTypeChange('email')}
                        aria-pressed={activeType === 'email'}
                    >
                        {t('admin.creditCodes.toolbar.typeEmail')}
                    </Chip>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* Search */}
                    <div className="relative flex items-center sm:w-[260px]">
                        <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                            <Icon icon={Search} size={15} />
                        </span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') onSearchChange('')
                            }}
                            placeholder={t('admin.creditCodes.toolbar.searchPlaceholder')}
                            aria-label={t('admin.creditCodes.toolbar.searchPlaceholder')}
                            className={cx(controlClass, 'rounded-full py-2 pl-9', hasQuery ? 'pr-9' : 'pr-3')}
                        />
                        {searching && (
                            <Loader2 className="absolute right-9 animate-spin text-ember-500" size={15} aria-hidden />
                        )}
                        {hasQuery && (
                            <IconButton
                                size="sm"
                                onClick={() => onSearchChange('')}
                                label={t('admin.creditCodes.toolbar.clearSearch')}
                                className="absolute right-1"
                            >
                                <Icon icon={X} size={15} />
                            </IconButton>
                        )}
                    </div>

                    {/* Sort */}
                    <div className="sm:w-[170px]">
                        <Select
                            size="sm"
                            options={sortOptions}
                            value={sort}
                            onChange={(value) => onSortChange(value as CreditGrantListSort)}
                            aria-label={t('admin.creditCodes.sort.label')}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Icon icon={exporting ? Loader2 : Download} size={15} className={exporting ? 'animate-spin' : undefined} />}
                            onClick={onExport}
                            disabled={exporting || exportDisabled}
                        >
                            {t('admin.creditCodes.toolbar.export')}
                        </Button>
                        <Button
                            variant={createActive ? 'secondary' : 'primary'}
                            size="sm"
                            iconLeft={<Icon icon={Plus} size={15} />}
                            onClick={onCreate}
                            aria-expanded={createActive}
                        >
                            {t('admin.creditCodes.toolbar.create')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Status filter row */}
            <div className="flex flex-wrap items-center gap-2">
                {STATUS_ORDER.map((value) => (
                    <Chip key={value} active={status === value} onClick={() => onStatusChange(value)}>
                        {t(`admin.creditCodes.filter.${value}`)}
                    </Chip>
                ))}
                {total != null && (
                    <span className="ml-auto font-ui text-[12px] text-parchment-400">
                        {t('admin.creditCodes.toolbar.count', { count: total })}
                    </span>
                )}
            </div>
        </div>
    )
}
