import { describe, expect, it } from 'vitest'

import { resolveApiBaseUrl } from './baseUrl'

describe('resolveApiBaseUrl', () => {
    it('falls back to the backend default when unset', () => {
        expect(resolveApiBaseUrl(undefined, 'localhost')).toBe('http://localhost:8000')
        expect(resolveApiBaseUrl('', 'localhost')).toBe('http://localhost:8000')
    })

    it('returns an explicit URL verbatim (minus trailing slashes)', () => {
        expect(resolveApiBaseUrl('https://api.example.com', 'localhost')).toBe('https://api.example.com')
        expect(resolveApiBaseUrl('https://api.example.com/', 'localhost')).toBe('https://api.example.com')
    })

    it('substitutes {hostname} with the page hostname so the API stays same-site', () => {
        expect(resolveApiBaseUrl('http://{hostname}:8010', 'localhost')).toBe('http://localhost:8010')
        expect(resolveApiBaseUrl('http://{hostname}:8010', '192.168.1.13')).toBe('http://192.168.1.13:8010')
    })

    it('substitutes localhost when no page hostname is available', () => {
        expect(resolveApiBaseUrl('http://{hostname}:8010', undefined)).toBe('http://localhost:8010')
    })
})
