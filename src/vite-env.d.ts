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
    /** Workspace R1 product surfaces; only the exact string `true` enables them. */
    readonly VITE_FEATURE_WORKSPACES_ENABLED?: string
}
