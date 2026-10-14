/**
 * App speech markup v1 (D27) as stored in reply text: pauses `<#0.4#>` and the
 * interjections `(laughs)`, `(sighs)`, `(gasps)`, `(inhale)`, `(exhale)`,
 * `(humming)`. The speech pipeline turns them into each model's own syntax;
 * on screen they are noise, so call text surfaces strip them (D23).
 *
 * `SPEECH_MARKUP_V1` mirrors the BFF `_MARKUP_V1` (text_pipeline.py) exactly:
 * case-sensitive, a decimal number pause, and an interjection that is not
 * wrapped in double parentheses (`((laughs))` is out-of-character text).
 */

const INTERJECTIONS = ['laughs', 'sighs', 'gasps', 'inhale', 'exhale', 'humming'] as const

export const SPEECH_MARKUP_V1 = /<#([0-9]+(?:\.[0-9]+)?)#>|(?<!\()\((laughs|sighs|gasps|inhale|exhale|humming)\)(?!\))/g

/** A removed token's place holder while the surrounding spacing is repaired (a private-use character). */
const MARK = '\uE000'
const MARK_RUN = /[ \t]*(?:\uE000[ \t]*)+/g
const PUNCTUATION_AFTER = /[,.!?;:]/

/** Every proper prefix of an interjection name, longest first (so the regex prefers the longest tail). */
const INTERJECTION_PREFIXES = [...new Set(INTERJECTIONS.flatMap((name) => Array.from({ length: name.length + 1 }, (_, size) => name.slice(0, size))))]
    .sort((a, b) => b.length - a.length)
/**
 * A streaming delta can end inside a token: an unterminated pause (`<#0.`) or
 * an opening parenthesis plus the start of an interjection name (`(lau`).
 */
const PARTIAL_TAIL = new RegExp(`[ \\t]*(?:<#[0-9.]*#?|(?<!\\()\\((?:${INTERJECTION_PREFIXES.join('|')}))$`)

export interface StripSpeechMarkupOptions {
    /** The text is a live delta that may end mid-token: hide such a tail too. */
    partial?: boolean
}

/**
 * Removes speech markup v1 tokens. The spacing a token leaves behind is
 * repaired where the token was: a run of spaces or tabs becomes one space, and
 * no space is left at a line start, a line end, or before `, . ! ? ; :`.
 * Text without markup (markdown included) is returned unchanged, and the
 * result is idempotent.
 */
export function stripSpeechMarkupV1(text: string, options: StripSpeechMarkupOptions = {}): string {
    if (!text) return text
    let out = text.replace(SPEECH_MARKUP_V1, MARK)
    if (out.includes(MARK)) {
        out = out.replace(MARK_RUN, (run: string, offset: number, whole: string) => {
            const before = whole[offset - 1]
            const after = whole[offset + run.length]
            if (before === undefined || before === '\n' || after === undefined || after === '\n') return ''
            if (PUNCTUATION_AFTER.test(after)) return ''
            // A token written between two words without spaces leaves them joined, as written.
            return run.length > 1 ? ' ' : ''
        })
    }
    if (options.partial) out = out.replace(PARTIAL_TAIL, '')
    return out
}
