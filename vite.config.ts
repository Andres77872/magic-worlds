import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
