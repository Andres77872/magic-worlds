import type { StoryPackageManifest, StoryPackageOptions, StoryPackagePreview } from '@/shared/types/storyPackage.types'

const COUNTS = { parts: 1, chapters: 2, scenes: 3, words: 1200, references: 2, comments: 3, bookmarks: 1, tasks: 2, facts: 1, stash: 1, revisions: 9 }

/** A backup summary of the fixture novel for these choices; left-out kinds count zero. */
export function packageManifest(options: StoryPackageOptions, patch: Partial<StoryPackageManifest> = {}): StoryPackageManifest {
    return { schemaVersion: 1, projection: 'novel_package', storyId: 'story-1', title: 'Gull Point', sourceVersion: 'b'.repeat(64), options: { ...options },
        filename: 'Gull-Point.mwnovel', contentType: 'application/vnd.magic-worlds.novel+zip', bytes: 48_000, sha256: 'd'.repeat(64),
        counts: { ...COUNTS, ...(options.notes ? {} : { comments: 0, bookmarks: 0 }), ...(options.planning ? {} : { tasks: 0, facts: 0, stash: 0 }), ...(options.history ? {} : { revisions: 0 }) },
        media: [{ role: 'cover', assetId: 'image-one', alt: 'A lighthouse.', included: false }], ...patch }
}

/** The restore preview of a package file holding everything, with its cover in this workspace. */
export function packagePreview(file: { size: number; sha256: string }, patch: Partial<StoryPackagePreview> = {}): StoryPackagePreview {
    return { schemaVersion: 1, projection: 'novel_package', filename: 'Gull-Point.mwnovel', bytes: file.size, packageHash: file.sha256, formatVersion: 1,
        source: { storyId: 'story-1', title: 'Gull Point', sourceVersion: 'b'.repeat(64) }, title: 'Gull Point', includes: { notes: true, planning: true, history: true },
        counts: { ...COUNTS }, references: [{ id: 'ref-1', kind: 'character', cardId: 'card-1', name: 'Mara', removed: false },
            { id: 'ref-2', kind: 'world', cardId: 'card-2', name: 'Gull Point', removed: false }],
        media: [{ role: 'cover', assetId: 'image-one', alt: 'A lighthouse.', included: false, available: true }], ...patch }
}
