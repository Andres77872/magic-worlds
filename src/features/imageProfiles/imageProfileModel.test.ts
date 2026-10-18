import { describe, expect, it } from 'vitest'
import type { ImageCatalogModel } from '@/shared/types/imageProfile.types'
import { archivedProfile, geminiProfile, gptProfile, imageCatalog, kreaProfile, personalDraft, personalProfile, rootList, userList } from './imageProfileFixtures'
import { chatDefaultProfileId, chatPickableProfiles, imageOptionsParser, nameIssue, settingIssue, trimmedDraft, withModel } from './imageProfileModel'

const model = (modelId: string) => imageCatalog.models.find(item => item.model_id === modelId)!
const krea = model('fal-ai/krea-2/turbo')
const gpt = model('openai/gpt-image-2.5/flare/text-to-image')
const sdxl = model('fal-ai/fast-lightning-sdxl')
const sana = model('fal-ai/sana')

describe('imageOptionsParser', () => {
    it('reserves the provider field a setting is sent as', () => {
        // SDXL Lightning sends output_format as "format", as the server checks it.
        expect(imageOptionsParser(sdxl)('{"format": "png"}').ok).toBe(false)
        expect(imageOptionsParser(sdxl)('{"output_format": "png"}').ok).toBe(false)
        expect(imageOptionsParser(sana)('{"format": "png"}').ok).toBe(true)
    })
})

describe('settingIssue', () => {
    it('mirrors the server checks for every kind', () => {
        expect(settingIssue(gpt, 'quality', 'medium')).toBeNull()
        expect(settingIssue(gpt, 'quality', 'ultra')).toBe('choice')
        expect(settingIssue(krea, 'enable_safety_checker', 'true')).toBe('choice')
        expect(settingIssue(sdxl, 'num_inference_steps', 3)).toBe('choice')
        expect(settingIssue(sdxl, 'num_inference_steps', '4')).toBe('choice')
        expect(settingIssue(sana, 'num_inference_steps', 51)).toBe('range')
        expect(settingIssue(sana, 'num_inference_steps', 2.5)).toBe('range')
        expect(settingIssue(sana, 'guidance_scale', 4.5)).toBeNull()
        expect(settingIssue(sana, 'guidance_scale', undefined)).toBeNull()
    })
})

describe('withModel', () => {
    it('keeps a carried-over setting only when the new model accepts its value', () => {
        // Sana's 24 steps is no SDXL Lightning choice (1, 2, 4, 8); 4 is.
        expect(withModel(personalDraft, sdxl).settings).toEqual({})
        expect(withModel({ ...personalDraft, settings: { num_inference_steps: 4, guidance_scale: 6 } }, sdxl).settings)
            .toEqual({ num_inference_steps: 4 })
        const webp: ImageCatalogModel = { ...sdxl, model_id: 'fal-ai/webp-model',
            settings: { output_format: { ...sdxl.settings.output_format, choices: ['jpeg', 'png', 'webp'] } } }
        expect(withModel({ ...personalDraft, model_id: webp.model_id, settings: { output_format: 'webp' } }, sdxl).settings).toEqual({})
        expect(withModel({ ...personalDraft, model_id: webp.model_id, settings: { output_format: 'png' } }, sdxl).settings)
            .toEqual({ output_format: 'png' })
    })
})

describe('profile text', () => {
    it('flags a name the server would refuse', () => {
        expect(nameIssue('My Flux ')).toBeNull()
        expect(nameIssue('   ')).toBe('required')
        expect(nameIssue('Krea\u00A0Turbo')).toBe('text')
        expect(nameIssue('Krea\tTurbo')).toBe('text')
        expect(nameIssue('Line one\nLine two')).toBe('text')
        expect(nameIssue('Zero\u200Bwidth')).toBe('text')
    })

    it('trims the name and description it sends, keeping the description’s line breaks', () => {
        expect(trimmedDraft({ ...personalDraft, name: ' My Flux ', description: '\nLine one\nLine two \n' }))
            .toMatchObject({ name: 'My Flux', description: 'Line one\nLine two' })
    })
})

describe('chat image profiles', () => {
    it('offers active, available fal profiles with app profiles before personal ones', () => {
        const picked = chatPickableProfiles([personalProfile, geminiProfile, archivedProfile, gptProfile, kreaProfile])
        expect(picked.map(profile => profile.name)).toEqual(['GPT Image 2.5 Flare', 'Krea 2 Turbo', 'My Sana'])
    })

    it('names the default the server runs a chat image on', () => {
        expect(chatDefaultProfileId(rootList)).toBe(kreaProfile.profile_id)
        // A personal default needs a key no turn carries by default: the app default runs instead.
        expect(chatDefaultProfileId(userList)).toBe(kreaProfile.profile_id)
        expect(chatDefaultProfileId({ ...rootList, user_default_profile_id: gptProfile.profile_id })).toBe(gptProfile.profile_id)
        // An OpenRouter default cannot make chat images.
        expect(chatDefaultProfileId({ ...rootList, user_default_profile_id: null, system_default_profile_id: geminiProfile.profile_id })).toBeNull()
        expect(chatDefaultProfileId(null)).toBeNull()
    })
})
