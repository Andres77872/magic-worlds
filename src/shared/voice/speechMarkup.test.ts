import { describe, expect, it } from 'vitest'
import { SPEECH_MARKUP_V1, stripSpeechMarkupV1 } from './speechMarkup'

describe('SPEECH_MARKUP_V1 (mirrors the BFF _MARKUP_V1)', () => {
    const matches = (text: string) => [...text.matchAll(SPEECH_MARKUP_V1)].map((match) => match[0])

    it.each(['<#0.5#>', '<#2#>', '<#1.25#>'])('matches the pause %s', (token) => {
        expect(matches(`a ${token} b`)).toEqual([token])
    })

    it.each(['<#.5#>', '<#abc#>', '<# 1 #>', '<#1.#>'])('keeps the non-pause %s', (token) => {
        expect(matches(`a ${token} b`)).toEqual([])
    })

    it.each(['laughs', 'sighs', 'gasps', 'inhale', 'exhale', 'humming'])('matches the interjection (%s)', (name) => {
        expect(matches(`a (${name}) b`)).toEqual([`(${name})`])
    })

    it.each(['((laughs))', '(Laughs)', '(laughing)', '(coughs)', '( sighs )'])('keeps %s', (token) => {
        expect(matches(`a ${token} b`)).toEqual([])
    })
})

describe('stripSpeechMarkupV1', () => {
    it.each([
        ['Well <#0.5#> fine', 'Well fine'],
        ['(sighs) Okay.', 'Okay.'],
        ['Hi (laughs).', 'Hi.'],
        ['Wait <#1#> (gasps) what?', 'Wait what?'],
        ['Fine (sighs)\nNext line', 'Fine\nNext line'],
        ['Line one\n(laughs) line two', 'Line one\nline two'],
        ['So<#0.4#>, then', 'So, then'],
        ['Tab\t<#2#>\tthen', 'Tab then'],
    ])('strips %j', (input, expected) => {
        expect(stripSpeechMarkupV1(input)).toBe(expected)
    })

    it('keeps the tokens the pipeline keeps', () => {
        const text = 'Keep <#.5#> and ((laughs)) and (Laughs) and (coughs).'
        expect(stripSpeechMarkupV1(text)).toBe(text)
    })

    it('is idempotent', () => {
        for (const text of ['Well <#0.5#> fine', '(sighs) Okay.', 'Hi (laughs).', 'a  b (gasps)  c']) {
            const once = stripSpeechMarkupV1(text)
            expect(stripSpeechMarkupV1(once)).toBe(once)
        }
    })

    it('handles empty input and leaves markdown and spacing without markup untouched', () => {
        expect(stripSpeechMarkupV1('')).toBe('')
        const markdown = '**Bold**  text with two spaces  \n- item ! (note)\n`code <#x#>`'
        expect(stripSpeechMarkupV1(markdown)).toBe(markdown)
    })

    it('partial mode hides an unterminated token at the end of a streaming delta', () => {
        expect(stripSpeechMarkupV1('Hello <#0.', { partial: true })).toBe('Hello')
        expect(stripSpeechMarkupV1('Hello <#0.5#', { partial: true })).toBe('Hello')
        expect(stripSpeechMarkupV1('Wait (lau', { partial: true })).toBe('Wait')
        expect(stripSpeechMarkupV1('Wait (', { partial: true })).toBe('Wait')
        expect(stripSpeechMarkupV1('Wait (laughs', { partial: true })).toBe('Wait')
        expect(stripSpeechMarkupV1('Well <#0.5#> fine (si', { partial: true })).toBe('Well fine')
    })

    it('partial mode keeps tails that cannot become markup', () => {
        expect(stripSpeechMarkupV1('Wait (coug', { partial: true })).toBe('Wait (coug')
        expect(stripSpeechMarkupV1('Wait ((lau', { partial: true })).toBe('Wait ((lau')
        expect(stripSpeechMarkupV1('Five < ten', { partial: true })).toBe('Five < ten')
    })

    it('non-partial mode keeps an unterminated tail', () => {
        expect(stripSpeechMarkupV1('Hello <#0.')).toBe('Hello <#0.')
        expect(stripSpeechMarkupV1('Wait (lau')).toBe('Wait (lau')
    })
})
