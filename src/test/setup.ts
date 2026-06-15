import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { i18n } from '@/app/i18n'
import { installMockBrowserMedia, resetMockBrowserMedia } from '../test-utils/mockMediaStream'

// In production non-default locales are lazy-loaded as separate chunks; tests
// that render Spanish (via i18n.cloneInstance({ lng: 'es' })) need the resources
// present in the shared store synchronously, so preload them once here.
await i18n.loadLanguages(['en', 'es'])

if (!globalThis.IntersectionObserver) {
    vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    })
}

beforeEach(() => {
    installMockBrowserMedia()
})

afterEach(() => {
    cleanup()
    resetMockBrowserMedia()
})
