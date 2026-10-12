/**
 * AssistantReplyLink — a link in an app assistant reply. Records preview on
 * hover and in place on click (`HoverCardLink`); every other link opens in a
 * new tab (see `replyLinkOpensInNewTab`), and the thread leaves those clicks
 * to the browser.
 */
import type { MarkdownLinkProps } from '@/ui/components'
import { HoverCardLink } from '../hoverCards'
import { replyLinkOpensInNewTab } from '../replyLinks'

export function AssistantReplyLink(props: MarkdownLinkProps) {
    if (!replyLinkOpensInNewTab(props.href)) return <HoverCardLink {...props} />
    return <HoverCardLink {...props} target="_blank" rel="noopener noreferrer" />
}
