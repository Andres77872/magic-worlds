/**
 * Test and story helper: registers the `voiceSafety.*` and `minorReports.*`
 * locale modules on the shared i18n store when the app bundles do not carry
 * them yet (G spreads them into en.ts / es.ts). Deep-merges without
 * overwriting, so the keys the bundles already carry win. Never imported by
 * application code.
 *
 * `es` is lazy-loaded (src/app/i18n/backend.ts). Creating its bundle before
 * that load would make i18next treat `es` as loaded and never fetch the real
 * file, so the Spanish keys merge only into a bundle that already exists
 * (tests preload it in src/test/setup.ts), or once `es` has loaded (Storybook).
 */
import { i18n } from '@/app/i18n'
import { minorReportsEn, minorReportsEs } from '@/app/i18n/locales/minorReports'
import { voiceSafetyEn, voiceSafetyEs } from '@/app/i18n/locales/voiceSafety'

function mergeSpanish(): void {
    i18n.addResourceBundle('es', 'translation', { voiceSafety: voiceSafetyEs, minorReports: minorReportsEs }, true, false)
}

export function ensureSafetyLocales(): void {
    i18n.addResourceBundle('en', 'translation', { voiceSafety: voiceSafetyEn, minorReports: minorReportsEn }, true, false)
    if (i18n.hasResourceBundle('es', 'translation')) {
        mergeSpanish()
        return
    }
    void i18n.loadLanguages('es').then(() => {
        // A failed load leaves no bundle: never create one that blocks a retry.
        if (i18n.hasResourceBundle('es', 'translation')) mergeSpanish()
    })
}
