import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import '@/app/i18n'
import { installMockBrowserMedia, resetMockBrowserMedia } from '../test-utils/mockMediaStream'

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
