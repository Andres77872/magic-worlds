import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { i18n } from '@/app/i18n'
import { installMockBrowserMedia, resetMockBrowserMedia } from '../test-utils/mockMediaStream'

// In production non-default locales are lazy-loaded as separate chunks; tests
// that render Spanish (via i18n.cloneInstance({ lng: 'es' })) need the resources
// present in the shared store synchronously, so preload them once here.
await i18n.loadLanguages(['en', 'es'])

// jsdom ships neither observer, and components that watch their own box
// (CardGrid, PlaylistDock) construct one on mount. Assign them directly rather
// than via vi.stubGlobal: a suite calling vi.unstubAllGlobals() in its own
// afterEach would otherwise strip the setup-level stub and break every test
// after the first.
class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
}

globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver

beforeEach(() => {
    installMockBrowserMedia()
})

afterEach(() => {
    cleanup()
    resetMockBrowserMedia()
})
