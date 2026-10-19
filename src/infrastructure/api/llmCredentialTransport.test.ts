import { expect, it } from 'vitest'
import { isLlmCredentialTransportAllowed } from './llmCredentialTransport'

it.each([
    ['http://localhost:8010', 'http://localhost:5173/'],
    ['http://127.0.0.1:8010/v1', 'http://localhost:5173/chat?view=active'],
    ['http://[::1]:8010', 'http://[::1]:5173/'],
])('allows local development from %s with a loopback page', (api, page) => {
    expect(isLlmCredentialTransportAllowed(api, page, true)).toBe(true)
    expect(isLlmCredentialTransportAllowed(api, page, false)).toBe(false)
})

it.each([
    'http://api.example.com', 'http://192.168.1.20:8010', 'http://0.0.0.0:8010',
    'http://localhost.example.com:8010', 'http://app.localhost:8010', 'http://localhost.:8010',
    'http://127.1:8010', 'http://2130706433:8010', 'http://[::ffff:127.0.0.1]:8010',
    'http://user@localhost:8010', 'http://localhost:8010?token=private', 'http://localhost:8010#private',
    'http://localhost:8010\\@example.com', 'http://local\nhost:8010', '//localhost:8010', 'not a URL',
])('rejects insecure or disguised API URL %s even during local development', api => {
    expect(isLlmCredentialTransportAllowed(api, 'http://localhost:5173/', true)).toBe(false)
})

it.each([undefined, 'https://localhost:5173/', 'http://example.com/', 'http://192.168.1.20:5173/', 'http://localhost.example.com/', 'http://127.1:5173/'])('rejects loopback HTTP from page %s', page => {
    expect(isLlmCredentialTransportAllowed('http://localhost:8010', page, true)).toBe(false)
})

it('allows valid HTTPS APIs in production and rejects credentials or fragments in their URL', () => {
    expect(isLlmCredentialTransportAllowed('https://api.example.com/v1', 'https://app.example.com/', false)).toBe(true)
    for (const api of ['https://user:password@api.example.com', 'https://api.example.com?secret=private', 'https://api.example.com#private']) {
        expect(isLlmCredentialTransportAllowed(api, 'https://app.example.com/', false)).toBe(false)
    }
})
