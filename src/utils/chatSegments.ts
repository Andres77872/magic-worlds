import type { TFunction } from 'i18next'
import type { ChatResponseSegment, ChatResponseSegmentKind, ChatSpeakerRosterEntry } from '@/shared'

/** Consume the BFF's clean JSON prefix; no raw-text or XML fallback. */
export class ChatJsonPreview {
    private state = 'root'
    private inString = false
    private tokenRole = ''
    private token = ''
    private escaped = false
    private unicode: string | null = null
    private highSurrogate: number | null = null
    private field = ''
    private entry: Record<string, string> = {}
    private keys = new Set<string>()
    private bodyStarted = false
    private rawChars = 0
    private settled: ChatResponseSegment[] = []
    private active: ChatResponseSegment | undefined

    private readonly roster: ReadonlyMap<string, ChatSpeakerRosterEntry>

    constructor(roster: ReadonlyMap<string, ChatSpeakerRosterEntry>) { this.roster = roster }

    private fail(): never { throw new Error('Invalid roleplay JSON preview') }

    private beginString(role: string) {
        this.inString = true
        this.tokenRole = role
        this.token = ''
        this.escaped = false
        this.unicode = null
        this.highSurrogate = null
        if (role === 'value' && this.field === 'content') {
            this.bodyStarted = true
            this.entry.content = ''
        }
    }

    private decoded(character: string) {
        const code = character.charCodeAt(0)
        if (this.highSurrogate !== null) {
            if (code < 0xdc00 || code > 0xdfff) this.fail()
            character = String.fromCodePoint(0x10000 + ((this.highSurrogate - 0xd800) << 10) + code - 0xdc00)
            this.highSurrogate = null
        } else if (code >= 0xd800 && code <= 0xdbff) {
            this.highSurrogate = code
            return
        } else if (code >= 0xdc00 && code <= 0xdfff) this.fail()
        if (this.tokenRole === 'value' && this.field === 'content') this.entry.content += character
        else {
            this.token += character
            if (this.token.length > 160) this.fail()
        }
    }

    private stringCharacter(character: string) {
        if (this.unicode !== null) {
            if (!/^[0-9a-f]$/i.test(character)) this.fail()
            this.unicode += character
            if (this.unicode.length === 4) {
                this.decoded(String.fromCharCode(parseInt(this.unicode, 16)))
                this.unicode = null
            }
        } else if (this.escaped) {
            this.escaped = false
            if (character === 'u') this.unicode = ''
            else if ('"\\/bfnrt'.includes(character)) {
                this.decoded(({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' } as Record<string, string>)[character] ?? character)
            } else this.fail()
        } else if (character === '\\') this.escaped = true
        else if (character === '"') {
            if (this.highSurrogate !== null) this.fail()
            this.inString = false
            this.endString()
        } else if (character.charCodeAt(0) < 32) this.fail()
        else this.decoded(character)
    }

    private endString() {
        if (this.tokenRole === 'rootKey') {
            if (this.token !== 'segments') this.fail()
            this.state = 'rootColon'
        } else if (this.tokenRole === 'key') {
            if (!['kind', 'speaker_id', 'content'].includes(this.token) || this.keys.has(this.token)) this.fail()
            this.keys.add(this.token)
            this.field = this.token
            this.state = 'colon'
        } else {
            if (this.field !== 'content') this.entry[this.field] = this.token
            this.identityReady()
            this.state = 'afterValue'
        }
    }

    private identityReady() {
        const { kind, speaker_id: id } = this.entry
        if (kind !== undefined && !['narrator', 'speech', 'thought'].includes(kind)) this.fail()
        if (id !== undefined && !this.roster.has(id)) this.fail()
        if (kind === 'narrator' && id !== undefined) this.fail()
        return kind !== undefined && (kind === 'narrator' || id !== undefined)
    }

    private segment(streaming: boolean): ChatResponseSegment {
        const { kind, content, speaker_id: id } = this.entry
        const body = (content ?? '').trim()
        if (Array.from(body).length > 4_000) this.fail()
        const candidate: ChatResponseSegment = kind === 'narrator'
            ? { kind, content: body, ...(streaming ? { streaming: true } : {}) }
            : { kind: kind as ChatResponseSegmentKind, speaker_id: id, speaker_name: this.roster.get(id)?.name,
                image_url: this.roster.get(id)?.image_url ?? null, content: body, ...(streaming ? { streaming: true } : {}) }
        if (this.active && this.active.kind === candidate.kind && this.active.content === body
            && this.active.speaker_id === candidate.speaker_id && Boolean(this.active.streaming) === streaming) return this.active
        return candidate
    }

    private character(character: string) {
        if (this.inString) { this.stringCharacter(character); return }
        if (' \t\r\n'.includes(character)) return
        const state = this.state
        if (state === 'root' && character === '{') this.state = 'rootKey'
        else if (state === 'rootKey' && character === '"') this.beginString('rootKey')
        else if (state === 'rootColon' && character === ':') this.state = 'array'
        else if (state === 'array' && character === '[') this.state = 'entry'
        else if (state === 'entry' && character === '{') {
            if (this.settled.length >= 32) this.fail()
            this.entry = {}; this.keys = new Set(); this.bodyStarted = false; this.active = undefined
            this.state = 'key'
        } else if (state === 'key' && character === '"') this.beginString('key')
        else if (state === 'colon' && character === ':') this.state = 'value'
        else if (state === 'value' && character === '"') this.beginString('value')
        else if (state === 'afterValue' && character === ',') this.state = 'key'
        else if (state === 'afterValue' && character === '}') {
            if (!this.identityReady() || !this.entry.content?.trim()
                || this.keys.size !== (this.entry.kind === 'narrator' ? 2 : 3)) this.fail()
            this.settled.push(this.segment(false))
            this.active = undefined
            this.bodyStarted = false
            this.state = 'afterEntry'
        } else if (state === 'afterEntry' && character === ',') this.state = 'entry'
        else if (state === 'afterEntry' && character === ']') this.state = 'afterArray'
        else if (state === 'afterArray' && character === '}') this.state = 'done'
        else this.fail()
    }

    feed(chunk: string): ChatResponseSegment[] {
        this.rawChars += chunk.length
        if (this.rawChars > 128_000) this.fail()
        // Iterate code units so a literal surrogate pair split between frames is held too.
        for (let index = 0; index < chunk.length; index++) this.character(chunk[index])
        if (!['afterEntry', 'afterArray', 'done'].includes(this.state) && this.bodyStarted && this.identityReady()) {
            this.active = this.segment(this.inString && this.field === 'content')
        }
        const segments = this.active ? [...this.settled, this.active] : [...this.settled]
        if (Array.from(segmentsToPlainText(segments)).length > 20_000) this.fail()
        return segments
    }
}

/** Preserve settled identities; only enrich records whose roster fields changed. */
export function resolveSegmentIdentity(segments: ChatResponseSegment[], roster: Map<string, ChatSpeakerRosterEntry>): ChatResponseSegment[] {
    return segments.map((segment) => {
        if (segment.kind === 'narrator') return segment
        const entry = segment.speaker_id ? roster.get(segment.speaker_id) : undefined
        const name = segment.speaker_name || entry?.name || segment.speaker_id
        const portrait = segment.image_url ?? entry?.image_url ?? null
        return segment.speaker_name === name && segment.image_url === portrait ? segment
            : { ...segment, speaker_name: name, image_url: portrait }
    })
}

export function segmentsToPlainText(segments: ChatResponseSegment[] | undefined, t?: TFunction): string {
    if (!segments?.length) return ''
    return segments.map((segment) => {
        if (segment.kind === 'narrator') return segment.content
        const speaker = segment.speaker_name || segment.speaker_id || t?.('interaction.chat.fallbackCharacter') || 'Character'
        return segment.kind === 'thought'
            ? `${t ? t('interaction.chat.speakerThinks', { name: speaker }) : `${speaker} thinks`}: ${segment.content}`
            : `${speaker}: ${segment.content}`
    }).filter(Boolean).join('\n\n')
}

export function finalizeResponseSegments(segments: ChatResponseSegment[] | undefined): ChatResponseSegment[] | undefined {
    if (!segments?.length) return undefined
    return segments.map((segment) => segment.streaming ? (({ streaming: _streaming, ...settled }) => settled)(segment) : segment)
}

export function safeResponseSegments(value: unknown): ChatResponseSegment[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((segment): ChatResponseSegment[] => {
        if (!segment || typeof segment !== 'object') return []
        const source = segment as Record<string, unknown>
        const kind = source.kind
        const content = safeText(source.content, 4_000)
        if (!['narrator', 'speech', 'thought'].includes(String(kind)) || !content) return []
        if (kind === 'narrator') return [{ kind, content }]
        const id = safeText(source.speaker_id, 160)
        return id ? [{ kind: kind as ChatResponseSegmentKind, content, speaker_id: id, speaker_name: safeText(source.speaker_name, 160) || id }] : []
    }).slice(0, 32)
}

function safeText(value: unknown, max: number): string {
    return typeof value === 'string' ? Array.from(value.trim()).slice(0, max).join('') : ''
}
