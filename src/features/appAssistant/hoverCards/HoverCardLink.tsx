/**
 * HoverCardLink — a link to a library record that previews it on hover.
 *
 * Used as the assistant's markdown link renderer and for the nested links
 * inside a card. Any other href (or no `HoverCardsProvider`) renders a plain
 * link. Detection is string parsing only: nothing loads until the card opens.
 * Touch pointers are ignored (a tap keeps opening the full preview); keyboard
 * focus opens the card like a hover does.
 */
import { useContext, useMemo, type MouseEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarkdownLinkProps } from '@/ui/components'
import { Icon, cx } from '@/ui/primitives'
import { FOCUS_ICONS } from '../components/knowledgeIcons'
import { parseHoverCardHref, type HoverCardRef } from './hoverCardModel'
import { HoverCardsContext } from './hoverCardsContext'
import { isAssistantLinkFeatureEnabled } from '../replyLinks'

export interface HoverCardLinkProps extends MarkdownLinkProps {
    /**
     * Opens the record on a plain click. Links inside a card need it; links in
     * the thread leave it unset because the thread routes its own clicks.
     */
    onActivate?: (ref: HoverCardRef) => void
    /** The leading kind glyph (on by default; nested links inside a card drop it). */
    showIcon?: boolean
}

function fromPointer(event: PointerEvent): boolean {
    return event.pointerType === 'mouse' || event.pointerType === 'pen'
}

/** Keyboard focus previews; a focus that came from a tap or click does not. */
function isKeyboardFocus(element: Element): boolean {
    try {
        return element.matches(':focus-visible')
    } catch {
        return true
    }
}

function isPlainClick(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function HoverCardLink({ href, className, children, onActivate, showIcon = true, onClick, ...rest }: HoverCardLinkProps) {
    const { t } = useTranslation()
    const context = useContext(HoverCardsContext)
    const ref = useMemo(() => parseHoverCardHref(href), [href])

    if (!isAssistantLinkFeatureEnabled(href)) return <>{children}</>

    if (!context || !ref) {
        return <a href={href} className={className} onClick={onClick} {...rest}>{children}</a>
    }

    const { controller } = context
    const inFocus = context.isInFocus(ref)
    return (
        <a
            {...rest}
            href={href}
            data-hover-link={ref.kind}
            className={cx(
                className,
                'rounded-xs transition-colors data-[hover-active]:bg-ember-500/[.12] data-[hover-active]:text-ember-200',
                inFocus && "after:ml-1 after:inline-block after:size-1.5 after:rounded-full after:bg-arcane-400 after:align-[2px] after:content-['']",
            )}
            onPointerEnter={(event) => {
                if (fromPointer(event)) controller.intent(event.currentTarget, ref, { instant: event.ctrlKey || event.metaKey })
            }}
            onPointerLeave={(event) => {
                if (fromPointer(event)) controller.leave(event.currentTarget)
            }}
            onFocus={(event) => {
                if (isKeyboardFocus(event.currentTarget)) controller.intent(event.currentTarget, ref)
            }}
            onBlur={(event) => controller.leave(event.currentTarget)}
            onClick={(event) => {
                onClick?.(event)
                controller.dismissTransient()
                if (!onActivate || event.defaultPrevented || !isPlainClick(event)) return
                event.preventDefault()
                onActivate(ref)
            }}
        >
            {showIcon && (
                <span className="mr-0.5 inline-block align-[-2px] text-ember-600">
                    <Icon icon={FOCUS_ICONS[ref.kind]} size={13} />
                </span>
            )}
            {children}
            {inFocus && <span className="sr-only"> ({t('appAssistant.hoverCard.inFocus')})</span>}
        </a>
    )
}
