/**
 * Tiny i18next backend that lazy-loads non-default locales as separate chunks.
 * `en` ships eagerly (see ./resources.ts); every other supported locale is a
 * dynamic import() here, so its ~240 KB of strings only load when that language
 * is actually selected. No new dependency.
 *
 * The loader map is explicit (not a template-literal import) so the bundler can
 * statically split each locale into its own chunk.
 */
import type { BackendModule, ReadCallback } from 'i18next'

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
    es: () => import('./locales/es'),
}

export const lazyLocaleBackend: BackendModule = {
    type: 'backend',
    init() {},
    read(language: string, _namespace: string, callback: ReadCallback) {
        const load = loaders[language]
        if (!load) {
            // `en` is bundled; an unknown language resolves empty so fallbackLng covers it.
            callback(null, {})
            return
        }
        load()
            .then((module) => callback(null, module.default as Record<string, unknown>))
            .catch((error) => callback(error as Error, null))
    },
}
