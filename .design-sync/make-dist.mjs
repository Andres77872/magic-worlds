// Regenerates .design-sync/dist — the stand-in "published package" the
// design-sync storybook converter reads. magic-worlds is an unbuilt app, so this
// supplies the dist + .d.ts tree the converter expects (component export list +
// per-component prop contracts). Run from the repo root before the converter:
//   node .design-sync/make-dist.mjs
// dist/ is gitignored (regenerated); this script + ds-entry.ts + tsconfig.dts.json
// are the committed source of truth.
import { execSync } from 'node:child_process'
import { writeFileSync, rmSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'

rmSync('.design-sync/dist', { recursive: true, force: true })
try {
  execSync('node_modules/.bin/tsc -p .design-sync/tsconfig.dts.json', { stdio: 'inherit' })
} catch {
  // tsc exits non-zero on type errors but still emits the .d.ts tree
  // (noEmitOnError is false in tsconfig.dts.json). Continue regardless.
}
mkdirSync('.design-sync/dist', { recursive: true })
writeFileSync(
  '.design-sync/dist/package.json',
  JSON.stringify(
    { name: 'reverie-ds', version: '0.0.0', types: 'index.d.ts', module: 'index.js', main: 'index.js' },
    null,
    2,
  ) + '\n',
)
// Types entry: re-export the tsc-emitted barrels (resolves the component export
// list for the converter). Bundle entry: re-export ds-entry.ts from source so
// esbuild bundles the real components (with @/ aliases + api stubs applied).
writeFileSync(
  '.design-sync/dist/index.d.ts',
  "export * from './ui/primitives';\n" +
    "export * from './ui/components';\n" +
    // Storied src/ui components the public barrels omit — keep in sync with ds-entry.ts.
    "export { AppWarningModal } from './ui/components/AppWarningModal';\n" +
    "export { CookieConsentBanner } from './ui/components/CookieConsentBanner';\n" +
    "export { MobileTopBar } from './ui/components/MobileTopBar';\n" +
    "export { ServicesDownBanner } from './ui/components/ServicesDownBanner';\n" +
    "export { SidebarAccountMenu } from './ui/components/SidebarAccountMenu';\n" +
    "export { SidebarNavDrawer } from './ui/components/SidebarNavDrawer';\n" +
    "export { AttributeList } from './ui/components/common/AttributeList';\n" +
    // Primitive Card wins the name collision with lists/Card/Card (see ds-entry.ts).
    "export { Card } from './ui/primitives/Card';\n",
)
writeFileSync('.design-sync/dist/index.js', "export * from '../ds-entry';\n")
// cfg.cssEntry must live inside PKG_DIR (.design-sync/dist). reverie-compiled.css
// is the app's vite-built Tailwind CSS (the storybook static build ships utilities
// un-compiled). Regenerate it with `node .design-sync/make-css.mjs` when styling
// changes; this just copies the latest into the freshly-wiped dist.
if (existsSync('.design-sync/reverie-compiled.css')) {
  copyFileSync('.design-sync/reverie-compiled.css', '.design-sync/dist/reverie-compiled.css')
} else {
  console.warn('! .design-sync/reverie-compiled.css missing — run: node .design-sync/make-css.mjs')
}
console.log('✓ .design-sync/dist regenerated')
