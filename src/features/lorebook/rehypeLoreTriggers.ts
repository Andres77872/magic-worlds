/**
 * rehype plugin that marks lorebook triggers inside rendered chat markdown.
 *
 * react-markdown v10 renders raw text nodes as plain strings (its `components.text`
 * hook is a no-op), so inline marking has to happen on the hast tree: we split each
 * text node on trigger hits and replace the matched ranges with `<loretrigger>`
 * element nodes carrying the full `TriggerMatch`. `ChatMessage` maps that tag to
 * `LoreTriggerMark`, reading the match off the node (react-markdown passes the hast
 * node to component overrides). Text inside code/links is left untouched.
 */
import { scanText, segmentText, type TriggerMatch, type TriggerMatcher } from './loreTriggers'

const SKIP_TAGS = new Set(['code', 'pre', 'a'])

export const LORE_TRIGGER_TAG = 'loretrigger'

/** A `<loretrigger>` element node carrying the resolved match for the renderer. */
export interface LoreTriggerElement {
    type: 'element'
    tagName: typeof LORE_TRIGGER_TAG
    properties: Record<string, unknown>
    children: { type: 'text'; value: string }[]
    loreMatch: TriggerMatch
}

// hast nodes are traversed loosely — typed `any` like the markdown component
// overrides in ChatMessage — to stay clear of the hast/unified type plumbing.
/* eslint-disable @typescript-eslint/no-explicit-any */
function transform(node: any, matcher: TriggerMatcher): void {
    const children: any[] | undefined = node?.children
    if (!children) return
    // Never mark inside code spans/blocks or link text.
    if (node.type === 'element' && SKIP_TAGS.has(node.tagName)) return

    const next: any[] = []
    for (const child of children) {
        if (child.type === 'text') {
            const value: string = child.value
            const matches = scanText(value, matcher)
            if (matches.length === 0) {
                next.push(child)
                continue
            }
            for (const segment of segmentText(value, matches)) {
                if (segment.match) {
                    next.push({
                        type: 'element',
                        tagName: LORE_TRIGGER_TAG,
                        properties: {},
                        children: [{ type: 'text', value: segment.text }],
                        loreMatch: segment.match,
                    })
                } else {
                    next.push({ type: 'text', value: segment.text })
                }
            }
        } else {
            transform(child, matcher)
            next.push(child)
        }
    }
    node.children = next
}

export function rehypeLoreTriggers(options: { matcher: TriggerMatcher | null }) {
    const { matcher } = options
    return (tree: any): void => {
        if (!matcher) return
        transform(tree, matcher)
    }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
