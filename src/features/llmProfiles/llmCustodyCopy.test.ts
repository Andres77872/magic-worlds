import { expect, it } from 'vitest'
import { llmProfilesEn, llmProfilesEs } from '@/app/i18n/locales/llmProfiles'

it('limits EN/ES BYOK assurances to the verified local-memory boundary', () => {
    for (const locale of [llmProfilesEn, llmProfilesEs]) {
        const text = [locale.key.explanation, locale.key.explanationLocal, locale.byok.body].join('\n')
        // F04 is still open: UI copy cannot infer downstream non-persistence
        // from the credential vault's independently tested browser behavior.
        expect(text).not.toMatch(/our servers|nuestros servidores|tab only|solo.*pestaña/i)
        expect(text).toMatch(/memory|memoria/i)
        expect(text).toMatch(/browser storage|almacenamiento del navegador/i)
        expect(text).toMatch(/reload|recargar/i)
        expect(locale.key.explanation).toContain('HTTPS')
    }
})
