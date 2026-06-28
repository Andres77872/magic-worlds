// Synthetic bundle entry for design-sync (claude.ai/design).
// magic-worlds is an app, not a published library, so there is no dist entry.
// esbuild bundles this barrel from source (the `@/` alias resolves via
// cfg.tsconfig = ../tsconfig.paths.json, which also redirects the api boundary
// to inert stubs) into window.Reverie — the importable `_ds_bundle.js` the
// design agent builds with. Scope: the Reverie design system in src/ui.
// Re-export names must match the names stories import, so story imports redirect
// cleanly to window.Reverie.*.
export * from '../src/ui/primitives'
export * from '../src/ui/components'

// Storied src/ui components that the public barrels above omit. Exported here so
// they become window.Reverie members and pair with their storybook titles.
export { AppWarningModal } from '../src/ui/components/AppWarningModal'
export { CookieConsentBanner } from '../src/ui/components/CookieConsentBanner'
export { MobileTopBar } from '../src/ui/components/MobileTopBar'
export { ServicesDownBanner } from '../src/ui/components/ServicesDownBanner'
export { SidebarAccountMenu } from '../src/ui/components/SidebarAccountMenu'
export { SidebarNavDrawer } from '../src/ui/components/SidebarNavDrawer'
export { AttributeList } from '../src/ui/components/common/AttributeList'

// The primitive Card and the lists Card (src/ui/components/lists/Card/Card) both
// export the name `Card`, so the two `export *` above leave it ambiguous (ESM
// drops it to undefined). Force the design-system primitive to win the global.
export { Card } from '../src/ui/primitives/Card'

// Global preview context (cfg.provider). Mirrors .storybook/preview so previews
// render inside the same i18n + audio-playlist context the stories assume. It
// must live in THIS bundle so provider and consumer components share one set of
// React context instances (a separately-bundled decorator would not).
export { ReveriePreviewProvider } from './preview-provider'
