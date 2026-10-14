/**
 * The cast menu of one adventure cast member (R1-FE-04; 09 §4.4, D36):
 * "Voice options for {name}" opens, in place, what the member plays now
 * against what its card plays, and "Use the card's current voice", which
 * refreshes only this member (`useCastVoiceRefresh`). Shown only for a member
 * the refresh would change; the status line lives in `CastVoiceRefreshPanel`.
 *
 * In place rather than a floating popover: the side panel scrolls and is
 * narrow, so a popover could be clipped.
 *
 * Focus: choosing the action closes the menu, so focus goes back to the ⋯
 * trigger and then, once the refresh starts, to the cast status line (`run`),
 * because a successful refresh removes this member's menu altogether.
 */
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { Button, Icon, IconButton } from '@/ui/primitives'
import type { CastVoiceDrift } from './sessionVoiceDrift'
import type { CastVoiceRefresh } from './useCastVoiceRefresh'

export function CastVoiceMenu({ drift, cast }: { drift: CastVoiceDrift; cast: CastVoiceRefresh }) {
    const { t } = useTranslation()
    const menuId = useId()
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const fallback = t('voices.display.fallbackName')
    const label = t('voices.refresh.castMenu', { name: drift.name || t('interaction.leftPanel.untitled') })
    return (
        <>
            <IconButton
                ref={triggerRef}
                label={label}
                size="sm"
                tone={open ? 'active' : 'default'}
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((value) => !value)}
            >
                <Ellipsis size={16} strokeWidth={1.75} />
            </IconButton>
            {open && (
                <div id={menuId} className="flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-parchment-50/10 bg-ink-700 p-2" data-testid="cast-voice-menu">
                    <p className="break-words font-ui text-caption text-parchment-300">
                        {t('voices.refresh.castMember', { current: drift.sessionName ?? fallback, card: drift.cardName ?? fallback })}
                    </p>
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={14} />}
                        className="self-start"
                        disabled={cast.refresh.status === 'busy'}
                        onClick={() => {
                            setOpen(false)
                            triggerRef.current?.focus()
                            cast.run([drift.cardId])
                        }}
                    >
                        {t('voices.refresh.action')}
                    </Button>
                </div>
            )}
        </>
    )
}
