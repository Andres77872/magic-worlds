/// <reference lib="es2022.intl" />
/** Translate textarea UTF-16 offsets to whole-grapheme Unicode code points. */
export function performanceSelection(text: string, start: number, end: number): { start: number; end: number } | null {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || end > text.length) return null
    if (typeof Intl.Segmenter !== 'function') return null
    const boundaries = new Set([0, text.length])
    for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) boundaries.add(part.index)
    if (!boundaries.has(start) || !boundaries.has(end)) return null
    return { start: Array.from(text.slice(0, start)).length, end: Array.from(text.slice(0, end)).length }
}

export function selectedWords(text: string, start: number, end: number): string {
    return Array.from(text).slice(start, end).join('')
}
