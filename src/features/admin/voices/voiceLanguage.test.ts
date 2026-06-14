import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { AdminVoiceEntry } from '@/shared'
import { OTHER_LANGUAGE, buildLanguageOptions, deriveVoiceLanguage } from './voiceLanguage'

// Reproduces the English label copy so option assertions stay meaningful.
const t = ((key: string, vars?: { count?: number }) => {
    if (key === 'admin.voices.language.all') return `All languages (${vars?.count})`
    if (key === 'admin.voices.language.other') return `Other (${vars?.count})`
    return key
}) as unknown as TFunction

const entry = (voice_id: string): AdminVoiceEntry => ({
    voice_id,
    voice_type: 'system',
    description: [],
    deletable: false,
})

describe('deriveVoiceLanguage', () => {
    it.each([
        ['English_expressive_narrator', 'English'],
        ['Chinese (Mandarin)_Reliable_Executive', 'Chinese'],
        ['Japanese_calm_woman', 'Japanese'],
        ['Korean_DecisiveQueen', 'Korean'],
        ['Wise_Woman', OTHER_LANGUAGE], // leading token is not a language
        ['presenter_male', OTHER_LANGUAGE],
        ['audiobook_male_1', OTHER_LANGUAGE],
        ['male-qn-qingse', OTHER_LANGUAGE], // no underscore at all
    ])('maps %s -> %s', (id, expected) => {
        expect(deriveVoiceLanguage(entry(id))).toBe(expected)
    })
})

describe('buildLanguageOptions', () => {
    it('counts languages, lists "All" first and "Other" last, by frequency', () => {
        const voices = [
            entry('English_a'),
            entry('English_b'),
            entry('English_c'),
            entry('Japanese_a'),
            entry('male-qn-x'), // Other
        ]

        const options = buildLanguageOptions(voices, t)

        expect(options[0]).toEqual({ value: '', label: 'All languages (5)' })
        expect(options[1]).toEqual({ value: 'English', label: 'English (3)' })
        expect(options[options.length - 1]).toEqual({ value: OTHER_LANGUAGE, label: 'Other (1)' })
        expect(options).toHaveLength(4) // All + English + Japanese + Other
    })
})
