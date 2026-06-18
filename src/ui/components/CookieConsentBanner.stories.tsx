import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { CookieConsentProvider } from '@/app/providers/CookieConsentProvider'
import { COOKIE_CONSENT_KEY } from '@/app/providers/cookieConsent'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { CookieConsentBanner } from './CookieConsentBanner'

type NavValue = NonNullable<ComponentProps<typeof NavigationContext.Provider>['value']>

const navStub: NavValue = {
    currentPage: 'landing',
    previousPage: undefined,
    setPage: () => {},
    goBack: () => {},
    cardEdit: null,
    resourceEdit: null,
    replaceHash: () => {},
}

// Forget any prior choice on each render so the banner is always visible in the
// canvas (the provider hides it once a decision is stored).
const withConsent: Decorator = (Story) => {
    try {
        localStorage.removeItem(COOKIE_CONSENT_KEY)
    } catch {
        /* ignore */
    }
    return (
        <NavigationContext.Provider value={navStub}>
            <CookieConsentProvider>
                <div className="relative min-h-[22rem]">
                    <Story />
                </div>
            </CookieConsentProvider>
        </NavigationContext.Provider>
    )
}

const meta = {
    title: 'Components/CookieConsentBanner',
    component: CookieConsentBanner,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Bottom-fixed cookie-consent banner with an accept-all / essential-only / customize choice, persisted to localStorage. Magic Worlds uses only first-party storage and one strictly-necessary auth cookie — no third-party or tracking cookies — so declining never disables a current feature; the optional analytics category is reserved for the future. Use “Customize” to open the granular preferences dialog.',
            },
        },
    },
    decorators: [withConsent],
} satisfies Meta<typeof CookieConsentBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
