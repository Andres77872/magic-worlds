import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CookieConsentProvider } from '@/app/providers/CookieConsentProvider'
import { COOKIE_CONSENT_KEY, readConsent } from '@/app/providers/cookieConsent'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { CookieConsentBanner } from './CookieConsentBanner'

type NavValue = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>

const setPage = vi.fn()
const navStub: NavValue = { currentPage: 'landing', previousPage: undefined, setPage, goBack: vi.fn(), cardEdit: null, resourceEdit: null, replaceHash: vi.fn() }

function renderBanner(children: ReactNode = <CookieConsentBanner />) {
    return render(
        <NavigationContext.Provider value={navStub}>
            <CookieConsentProvider>{children}</CookieConsentProvider>
        </NavigationContext.Provider>,
    )
}

describe('CookieConsentBanner', () => {
    beforeEach(() => {
        localStorage.clear()
        setPage.mockClear()
    })
    afterEach(() => {
        cleanup()
        localStorage.clear()
    })

    it('shows the banner when no decision is stored', () => {
        renderBanner()
        expect(screen.getByRole('region', { name: /cookie/i })).toBeInTheDocument()
    })

    it('persists "all" and hides the banner when accepting every category', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /accept all/i }))

        const stored = readConsent()
        expect(stored?.decision).toBe('all')
        expect(stored?.categories.analytics).toBe(true)
        expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull()
    })

    it('persists "essential" when declining optional storage', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /essential only/i }))

        const stored = readConsent()
        expect(stored?.decision).toBe('essential')
        expect(stored?.categories.analytics).toBe(false)
    })

    it('opens the preferences dialog from Customize', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /customize/i }))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('routes to the privacy policy from the banner link', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /policy/i }))
        expect(setPage).toHaveBeenCalledWith('privacy')
    })

    it('does not render when a decision already exists', () => {
        localStorage.setItem(
            COOKIE_CONSENT_KEY,
            JSON.stringify({
                version: 1,
                decision: 'all',
                categories: { essential: true, analytics: true },
                decidedAt: '2026-06-15T00:00:00.000Z',
            }),
        )
        renderBanner()
        expect(screen.queryByRole('region', { name: /cookie/i })).toBeNull()
    })
})
