import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

if (!globalThis.IntersectionObserver) {
    vi.stubGlobal('IntersectionObserver', class IntersectionObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    })
}

afterEach(() => cleanup())
