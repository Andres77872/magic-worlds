/// <reference types="vite/client" />

type MagicWorldsBuildSource = 'cloudflare-pages' | 'local'

interface MagicWorldsBuildInfo {
    buildId: string
    commit: string | null
    branch: string | null
    builtAt: string
    source: MagicWorldsBuildSource
}

declare const __MW_BUILD_INFO__: MagicWorldsBuildInfo

interface ImportMetaEnv {
    /** Build-time maintenance screen; only the exact string `true` enables it. */
    readonly VITE_MAINTENANCE_MODE?: string
}
