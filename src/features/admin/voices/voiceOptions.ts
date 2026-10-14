import type { TFunction } from 'i18next'
import type { AdminCatalogVoice } from '@/shared'
import type { SelectOption } from '@/ui/primitives'

/** Catalog voices as Select options: "Name · Status". */
export function voiceSelectOptions(voices: readonly AdminCatalogVoice[], t: TFunction): SelectOption[] {
    return voices.map((voice) => ({
        value: voice.voice_key,
        label: t('admin.voices.common.voiceOption', { name: voice.display_name, status: t(`admin.voices.status.${voice.status}`) }),
    }))
}

/** A voice's name, or a neutral placeholder when the key is not in the index. */
export function voiceName(voice: AdminCatalogVoice | undefined, key: string, t: TFunction): string {
    return voice?.display_name ?? t('admin.voices.common.unknownVoice', { key })
}

/** Apply new showcase samples to a catalog row (sample URLs per language). */
export function withSamples(voice: AdminCatalogVoice, samples: readonly { language: string; url: string; kind: string }[]): AdminCatalogVoice {
    const showcase = samples.filter((sample) => sample.kind === 'showcase')
    if (showcase.length === 0) return voice
    const languages = [...voice.languages]
    for (const sample of showcase) {
        const index = languages.findIndex((entry) => entry.language === sample.language)
        if (index >= 0) languages[index] = { ...languages[index], sample_url: sample.url }
        else languages.push({ language: sample.language, locale: null, accent: null, model_ids: [], sample_url: sample.url })
    }
    return { ...voice, languages }
}
