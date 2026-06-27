import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/app/i18n'
import { AppProvider } from '@/app/providers/AppProvider'

/**
 * Global preview wrapper for the design-sync bundle — the cfg.provider component.
 * Wraps every preview in i18n + the app's full context chain (AppProvider:
 * ApiStatus / Auth / Language / Navigation / CookieConsent / Data /
 * BackgroundTasks / AudioPlaylist / FloatingWindows) so context-coupled src/ui
 * components (Sidebar, LoginModal, LanguageMenu, banners, audio) render instead
 * of throwing "use<X> must be used within <Provider>". The api boundary is
 * stubbed (see .design-sync/stubs), so these providers settle into a logged-out /
 * empty state — a valid preview baseline. Lives in the DS bundle so provider and
 * consumer share one set of React context instances.
 */
export function ReveriePreviewProvider({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppProvider>{children}</AppProvider>
    </I18nextProvider>
  )
}
