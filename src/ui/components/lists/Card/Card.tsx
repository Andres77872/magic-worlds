import React, {useCallback, useId} from 'react'
import {useTranslation} from 'react-i18next'
import {type CardOption, CardOptions} from './CardOptions'
import {Card as Surface, cx, Portrait, ThemeSongButton} from '@/ui/primitives'

interface CardProps {
    title: React.ReactNode
    subtitle?: React.ReactNode
    children?: React.ReactNode
    options?: CardOption[]
    className?: string
    onClick?: () => void
    isLoading?: boolean
    disabled?: boolean
    highlight?: boolean
    /** Optional portrait image; falls back to the name-seeded gradient when absent. */
    imageUrl?: string
    /** Optional theme-song URL; shows a play/pause button on the portrait when present. */
    themeSongUrl?: string
    'data-testid'?: string
}

/**
 * Domain card composed from the Reverie `Card` surface + `Portrait` header.
 * The title seeds the portrait initial/gradient and is overlaid in the
 * display face; the subtitle reads as narrative parchment text. All props
 * (highlight / disabled / onClick / loading / options) and a11y are preserved.
 */
export function Card({
                         title,
                         subtitle,
                         children,
                         options,
                         className = '',
                         onClick,
                         isLoading = false,
                         disabled = false,
                         highlight = false,
                         imageUrl,
                     themeSongUrl,
                     'data-testid': testId = 'card',
                 }: CardProps) {
    const { t } = useTranslation()
    const cardOptions = options

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }, [onClick, disabled])

    const handleClick = useCallback(() => {
        if (!disabled && onClick) {
            onClick()
        }
    }, [onClick, disabled])

    const isInteractive = Boolean(onClick) && !disabled

    const titleId = useId()
    const generatedDescriptionId = useId()
    const descriptionId = subtitle ? generatedDescriptionId : undefined

    // Seed the portrait gradient/initial from the title text when available.
    const portraitName = typeof title === 'string' ? title : ''

    return (
        <Surface
            interactive={isInteractive}
            className={cx(
                'group relative flex h-full flex-col',
                highlight && 'border-ember-500/45 ring-1 ring-ember-500/45',
                disabled && 'pointer-events-none cursor-not-allowed opacity-50',
                className,
            )}
            onClick={isInteractive ? handleClick : undefined}
            onKeyDown={isInteractive ? handleKeyDown : undefined}
            data-testid={testId}
            role={isInteractive ? 'button' : 'article'}
            tabIndex={isInteractive ? 0 : undefined}
            aria-disabled={disabled || undefined}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={isLoading || undefined}
        >
            {isLoading && (
                <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink-900/60"
                    role="alert"
                    aria-live="polite"
                    aria-label={t('card.loadingContent')}
                >
                    <div
                        className="h-8 w-8 animate-spin rounded-full border-2 border-parchment-50/20 border-t-ember-500"
                        aria-hidden="true"
                    />
                    <span className="sr-only">{t('card.loading')}</span>
                </div>
            )}

            <Portrait name={portraitName} src={imageUrl} height={120}>
                {(themeSongUrl || (cardOptions && cardOptions.length > 0)) && (
                    <div className="absolute right-2 top-2 z-[2] flex items-center gap-1.5">
                        {themeSongUrl && (
                            <ThemeSongButton
                                src={themeSongUrl}
                                cardName={portraitName || undefined}
                                artworkUrl={imageUrl}
                            />
                        )}
                        {cardOptions && cardOptions.length > 0 && (
                            <CardOptions
                                options={cardOptions}
                                disabled={disabled}
                                aria-label={t('card.actions')}
                            />
                        )}
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3
                        id={titleId}
                        className="m-0 font-display text-lg font-semibold leading-tight text-parchment-50"
                    >
                        {typeof title === 'string' ? (
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={title}>
                                {title}
                            </span>
                        ) : (
                            title
                        )}
                    </h3>
                    {subtitle && (
                        <div
                            id={descriptionId}
                            className="m-0 mt-1 font-narrative text-sm leading-normal text-parchment-400"
                        >
                            {subtitle}
                        </div>
                    )}
                </div>
            </Portrait>

            {children && (
                <div className="flex flex-1 flex-col p-4" role="region" aria-label={t('card.content')}>
                    {children}
                </div>
            )}
        </Surface>
    )
}
