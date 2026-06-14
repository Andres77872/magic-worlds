import type { ChatResponseSegment, ChatResponseSegmentKind, ChatSpeakerRosterEntry } from '@/shared'

const PRIVATE_THINK_BLOCK_RE = /<think>\s*[\s\S]*?<\/think>/gi
const PRIVATE_THINK_TAIL_RE = /<think>\s*[\s\S]*$/i
const CLOSE_VISIBLE_TAG_RE = /<\/(?:response|narrator|say|think)>/gi
const OPEN_VISIBLE_TAG_RE = /<(?:response|narrator|say|think)(?:\s+[^>]*)?>/gi
const PARTIAL_TAG_RE = /<[^>]*$/g
const TAG_RE = /<[^>]+>/g
/** Matches a visible-segment open tag (with optional attrs) OR its close tag. */
const CHILD_TAG_RE = /<(narrator|say|think)((?:\s+[^>]*?)?)>|<\/(narrator|say|think)\s*>/gi
const SPEAKER_ID_ATTR_RE = /speaker_id\s*=\s*"([^"]*)"/i

export function stripPrivateThink(value: string): string {
    return value.replace(PRIVATE_THINK_BLOCK_RE, '').replace(PRIVATE_THINK_TAIL_RE, '')
}

export function streamingXmlToPlainText(value: string): string {
    const flattened = stripPrivateThink(value)
        .replace(CLOSE_VISIBLE_TAG_RE, '\n')
        .replace(OPEN_VISIBLE_TAG_RE, '')
        .replace(PARTIAL_TAG_RE, '')
        .replace(TAG_RE, '')

    return decodeXmlEntities(flattened)
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
}

/**
 * Incrementally parse the partial XML voice stream into ordered display segments.
 *
 * Unlike the backend's `ET.fromstring` (which needs complete, well-formed XML),
 * this tolerates a mid-stream buffer: the last unclosed tag becomes a
 * `streaming: true` segment so the UI can paint who is currently speaking /
 * thinking / narrating. The authoritative `segments` frame (sent after the turn
 * finishes) is the source of truth and *replaces* these. When no structured
 * segments are present yet (plain prose / malformed markup), `fallbackText` is
 * set to today's flattened plain text so the caller never regresses.
 *
 * Edge cases handled by construction:
 *  - An attribute split across chunks (`<say speaker_id="ly`) has no closing `>`,
 *    so the open-tag regex doesn't match and no spurious segment opens.
 *  - Private `<think>…</think>` (no attribute) is stripped; visible
 *    `<think speaker_id="…">` is kept.
 */
export function streamingXmlToSegments(value: string): {
    segments: ChatResponseSegment[]
    fallbackText?: string
} {
    const cleaned = stripPrivateThink(value)
    const segments: ChatResponseSegment[] = []
    let open: { kind: ChatResponseSegmentKind; speakerId?: string; start: number } | null = null

    CHILD_TAG_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = CHILD_TAG_RE.exec(cleaned)) !== null) {
        const openTag = match[1]
        if (openTag !== undefined) {
            // A new tag opened — defensively close any dangling open segment first
            // (a missing close tag from earlier in the stream).
            if (open) {
                const content = cleanSegmentContent(cleaned.slice(open.start, match.index))
                if (content) segments.push(buildStreamingSegment(open, content, false))
            }
            const speakerId = (SPEAKER_ID_ATTR_RE.exec(match[2] || '')?.[1] || '').trim() || undefined
            open = { kind: kindForTag(openTag), speakerId, start: match.index + match[0].length }
        } else {
            // A close tag.
            if (open) {
                const content = cleanSegmentContent(cleaned.slice(open.start, match.index))
                if (content) segments.push(buildStreamingSegment(open, content, false))
                open = null
            }
        }
    }

    if (open) {
        // The final tag is still open → the live, streaming segment. Trim a
        // trailing partial tag (`… <sa`) so half-arrived markup isn't shown.
        const content = cleanSegmentContent(cleaned.slice(open.start).replace(PARTIAL_TAG_RE, ''))
        segments.push(buildStreamingSegment(open, content, true))
    }

    if (!segments.length) {
        const fallbackText = streamingXmlToPlainText(value)
        return fallbackText ? { segments, fallbackText } : { segments }
    }
    return { segments }
}

/**
 * Enrich segments with `speaker_name` + portrait `image_url` from the `speakers`
 * roster. Works for both live (no speaker_name yet) and authoritative segments
 * (already have speaker_name — kept, only image_url is added). Narrator segments
 * pass through untouched.
 */
export function resolveSegmentIdentity(
    segments: ChatResponseSegment[],
    roster: Map<string, ChatSpeakerRosterEntry>,
): ChatResponseSegment[] {
    return segments.map((segment) => {
        if (segment.kind === 'narrator') return segment
        const entry = segment.speaker_id ? roster.get(segment.speaker_id) : undefined
        return {
            ...segment,
            speaker_name: segment.speaker_name || entry?.name || segment.speaker_id,
            image_url: segment.image_url ?? entry?.image_url ?? null,
        }
    })
}

function kindForTag(tag: string): ChatResponseSegmentKind {
    const lowered = tag.toLowerCase()
    if (lowered === 'say') return 'speech'
    if (lowered === 'think') return 'thought'
    return 'narrator'
}

function cleanSegmentContent(value: string): string {
    return decodeXmlEntities(value)
        .split('\n')
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
}

function buildStreamingSegment(
    open: { kind: ChatResponseSegmentKind; speakerId?: string },
    content: string,
    streaming: boolean,
): ChatResponseSegment {
    if (open.kind === 'narrator') {
        return streaming ? { kind: 'narrator', content, streaming } : { kind: 'narrator', content }
    }
    return {
        kind: open.kind,
        content,
        speaker_id: open.speakerId,
        ...(streaming ? { streaming } : {}),
    }
}

export function segmentsToPlainText(segments: ChatResponseSegment[] | undefined): string {
    if (!segments?.length) return ''
    return segments
        .map((segment) => {
            if (segment.kind === 'narrator') return segment.content
            const speaker = segment.speaker_name || segment.speaker_id || 'Character'
            return segment.kind === 'thought'
                ? `${speaker} thinks: ${segment.content}`
                : `${speaker}: ${segment.content}`
        })
        .filter(Boolean)
        .join('\n')
}

export function safeResponseSegments(value: unknown): ChatResponseSegment[] {
    if (!Array.isArray(value)) return []
    return value
        .map((segment): ChatResponseSegment | null => {
            if (!segment || typeof segment !== 'object') return null
            const source = segment as Record<string, unknown>
            const kind = source.kind
            const content = safeText(source.content, 4_000)
            if ((kind !== 'narrator' && kind !== 'speech' && kind !== 'thought') || !content) return null
            if (kind === 'narrator') return { kind, content }
            const speakerId = safeText(source.speaker_id, 160)
            if (!speakerId) return null
            const speakerName = safeText(source.speaker_name, 160)
            return {
                kind,
                content,
                speaker_id: speakerId,
                speaker_name: speakerName || speakerId,
            }
        })
        .filter((segment): segment is ChatResponseSegment => segment !== null)
        .slice(0, 32)
}

function safeText(value: unknown, max: number): string {
    if (typeof value !== 'string') return ''
    const text = value.trim()
    const lowered = text.toLowerCase()
    if (
        !text ||
        lowered.includes('http://') ||
        lowered.includes('https://') ||
        lowered.includes('/var/') ||
        lowered.includes('/tmp/') ||
        lowered.includes('bearer ') ||
        lowered.includes('authorization') ||
        lowered.includes('api_key') ||
        lowered.includes('secret')
    ) {
        return ''
    }
    return text.slice(0, max)
}

function decodeXmlEntities(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
}
