// Regenerates .design-sync/reverie-compiled.css — the fully-compiled Tailwind CSS
// used by BOTH the preview (cfg.cssEntry) and the Storybook oracle. The Storybook
// STATIC build ships `@tailwind utilities;` UN-compiled (its content-detection base
// isn't the repo root), so the app's own `vite build` is the reliable source of the
// compiled utilities. Run AFTER building .design-sync/sb-reference and BEFORE
// make-dist.mjs:  node .design-sync/make-css.mjs
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from 'node:fs'

// 1. Build the app so vite+@tailwindcss/vite compiles the full utility CSS.
execSync('npx vite build --outDir .design-sync/app-dist --emptyOutDir', { stdio: 'inherit' })

// 2. Find the compiled stylesheet and prepend the Google Fonts @import (the brand
//    fonts load at runtime; the app serves them via index.html <link>, not CSS).
const assets = '.design-sync/app-dist/assets'
const cssFile = readdirSync(assets).find((f) => f.endsWith('.css'))
if (!cssFile) throw new Error('no compiled .css in ' + assets)
const fonts =
  '@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap");\n'
writeFileSync('.design-sync/reverie-compiled.css', fonts + readFileSync(assets + '/' + cssFile, 'utf8'))
console.log('✓ .design-sync/reverie-compiled.css regenerated')

// 3. Inject the compiled CSS into the Storybook oracle so the reference renders
//    styled (its own scraped CSS lacks the utilities). Safe to re-run.
const iframe = '.design-sync/sb-reference/iframe.html'
if (existsSync(iframe)) {
  copyFileSync('.design-sync/reverie-compiled.css', '.design-sync/sb-reference/reverie-compiled.css')
  let h = readFileSync(iframe, 'utf8')
  if (!h.includes('reverie-compiled.css')) {
    h = h.replace('</head>', '  <link rel="stylesheet" href="./reverie-compiled.css">\n</head>')
    writeFileSync(iframe, h)
    console.log('✓ injected compiled CSS into the Storybook oracle')
  }
} else {
  console.warn('! .design-sync/sb-reference not built yet — build it, then re-run to inject the oracle CSS')
}
