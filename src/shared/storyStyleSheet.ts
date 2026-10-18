/**
 * The novel's style sheet (conventions, preferred examples and character voices), kept in the novel's details.
 * The rules match the BFF: a bounded, exact shape that the details save, compare and recover like any other field.
 */
import type { StoryStyleConventionKind, StoryStyleSheet } from './types/story.types'
import type { StoryAssistantCard, StoryAssistantStyle } from './types/storyAssistant.types'
import { isRecord } from './novelMutationJournal'

export const STYLE_CONVENTION_KINDS: StoryStyleConventionKind[] = ['spelling', 'name', 'capitalization', 'hyphenation', 'numbers', 'punctuation', 'usage', 'other']
export const STYLE_LIMITS = { conventions: 150, examples: 5, voices: 30, lines: 3 } as const
export const STYLE_TEXT = { term: 120, rule: 300, label: 120, example: 2000, traits: 1000, line: 300 } as const
export const EMPTY_STYLE_SHEET: StoryStyleSheet = { conventions: [], examples: [], voices: [] }

const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((key) => key in v)
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0)
const refId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64 && v === v.trim() && !v.includes('\n')

/** Python counts code points; the editor keeps every text within the same limit in UTF-16 units, which is never more. */
export function isStoryStyleSheet(v: unknown): v is StoryStyleSheet {
    if (!isRecord(v) || !exact(v, ['conventions', 'examples', 'voices']) || !Array.isArray(v.conventions) || !Array.isArray(v.examples) || !Array.isArray(v.voices)) return false
    if (v.conventions.length > STYLE_LIMITS.conventions || v.examples.length > STYLE_LIMITS.examples || v.voices.length > STYLE_LIMITS.voices) return false
    const terms = new Set<string>()
    for (const entry of v.conventions) {
        if (!isRecord(entry) || !exact(entry, ['term', 'rule', 'kind']) || !STYLE_CONVENTION_KINDS.includes(entry.kind as StoryStyleConventionKind)
            || !text(entry.term, STYLE_TEXT.term, true) || entry.term !== entry.term.trim() || !text(entry.rule, STYLE_TEXT.rule)) return false
        // Close to Python's casefold, which the BFF uses for repeats.
        const key = entry.term.toLocaleLowerCase('und').replace(/ß/g, 'ss') + '\u0000' + entry.kind
        if (terms.has(key)) return false
        terms.add(key)
    }
    if (!v.examples.every((entry) => isRecord(entry) && exact(entry, ['label', 'text']) && text(entry.label, STYLE_TEXT.label) && text(entry.text, STYLE_TEXT.example, true))) return false
    const refs = new Set<string>()
    for (const entry of v.voices) {
        if (!isRecord(entry) || !exact(entry, ['refId', 'traits', 'lines']) || !refId(entry.refId) || refs.has(entry.refId) || !text(entry.traits, STYLE_TEXT.traits)
            || !Array.isArray(entry.lines) || entry.lines.length > STYLE_LIMITS.lines || !entry.lines.every((line) => text(line, STYLE_TEXT.line, true))
            || !entry.traits.trim() && !entry.lines.length) return false
        refs.add(entry.refId)
    }
    return true
}

/** What the assistant packet must hold: conventions, examples (unless left out for room) and the voices of its character cards. */
export function packetStyle(sheet: StoryStyleSheet | null | undefined, cards: StoryAssistantCard[], examples = true): StoryAssistantStyle | null {
    if (!sheet) return null
    const titles = new Map(cards.filter((card) => card.kind === 'character').map((card) => [card.referenceId, card.title]))
    const value: StoryAssistantStyle = { conventions: sheet.conventions.map((entry) => ({ ...entry })), examples: examples ? sheet.examples.map((entry) => ({ ...entry })) : [],
        voices: sheet.voices.filter((voice) => titles.has(voice.refId)).map((voice) => ({ referenceId: voice.refId, name: titles.get(voice.refId)!, traits: voice.traits, lines: [...voice.lines] })) }
    return value.conventions.length || value.examples.length || value.voices.length ? value : null
}

/** A stored packet's style part: well formed, nonempty, and voices only for character cards in the same packet. */
export function isPacketStyle(v: unknown, cards: StoryAssistantCard[]): v is StoryAssistantStyle {
    if (!isRecord(v) || !exact(v, ['conventions', 'examples', 'voices']) || !Array.isArray(v.voices) || v.voices.length > STYLE_LIMITS.voices
        || !isStoryStyleSheet({ conventions: v.conventions, examples: v.examples, voices: [] })) return false
    const titles = new Map(cards.filter((card) => card.kind === 'character').map((card) => [card.referenceId, card.title])), seen = new Set<string>()
    for (const voice of v.voices) {
        if (!isRecord(voice) || !exact(voice, ['referenceId', 'name', 'traits', 'lines']) || typeof voice.referenceId !== 'string' || seen.has(voice.referenceId)
            || titles.get(voice.referenceId) !== voice.name || !isStoryStyleSheet({ conventions: [], examples: [], voices: [{ refId: voice.referenceId, traits: voice.traits, lines: voice.lines }] })) return false
        seen.add(voice.referenceId)
    }
    return (v.conventions as unknown[]).length + (v.examples as unknown[]).length + v.voices.length > 0
}
