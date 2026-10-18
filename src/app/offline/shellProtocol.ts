export interface ShellAsset { path: string; bytes: number; sha256: string }
export interface ShellManifest {
    schema: 1
    id: string
    buildId: string
    basePath: string
    bytes: number
    assets: ShellAsset[]
}
export type ShellFailure = 'network' | 'integrity' | 'storage' | 'limit'
export interface ShellStatus {
    protocol: 'novel-offline-shell-v1'
    state: 'ready' | 'empty' | 'failed'
    buildId: string
    bytes: number
    reason?: ShellFailure
}
