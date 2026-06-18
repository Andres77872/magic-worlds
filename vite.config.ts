import { defineConfig, type PluginOption } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type BuildSource = 'cloudflare-pages' | 'local'

interface BuildInfo {
  buildId: string
  commit: string | null
  branch: string | null
  builtAt: string
  source: BuildSource
}

function createBuildInfo(): BuildInfo {
  const builtAt = new Date().toISOString()
  const commit = process.env.CF_PAGES_COMMIT_SHA || null
  const branch = process.env.CF_PAGES_BRANCH || null
  const source: BuildSource = process.env.CF_PAGES === '1' || commit || branch ? 'cloudflare-pages' : 'local'
  const version = commit || 'local'

  return {
    buildId: `${version}-${builtAt}`,
    commit,
    branch,
    builtAt,
    source,
  }
}

const buildInfo = createBuildInfo()

function appVersionPlugin(): PluginOption {
  return {
    name: 'magic-worlds-app-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __MW_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [react(), tailwindcss(), appVersionPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Route components are React.lazy()-split per page automatically; these groups
    // pin shared vendor libs into stable, cacheable chunks (higher priority wins).
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-i18next|i18next)[\\/]/, priority: 3 },
            { name: 'tiptap', test: /node_modules[\\/](@tiptap|prosemirror)/, priority: 2 },
            { name: 'markdown', test: /node_modules[\\/](react-markdown|remark-|micromark|mdast|hast|unist|decode-named|character-entities|property-information|space-separated|comma-separated|hastscript|vfile|trim-lines|html-url-attributes)/, priority: 1 },
            { name: 'vendor', test: /node_modules/, priority: 0 },
          ],
        },
      },
    },
  },
})
