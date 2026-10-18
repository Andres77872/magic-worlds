/**
 * A complete novel backup — a project package (.mwnovel) — and its reviewed restore (N14/X08).
 *
 * A package holds the whole novel: every part, chapter and scene (archived and trashed ones too), its settings and
 * Codex references, and by choice its comments and bookmarks, planning items and saved scene revisions. A restore
 * always makes a new novel with new identities.
 */

/** What a package holds beyond the novel itself. */
export interface StoryPackageOptions {
    /** Comments and bookmarks on the prose. */
    notes: boolean
    /** Revision tasks, story facts and the cut/take stash. */
    planning: boolean
    /** Every saved revision of every scene, not only the current text. */
    history: boolean
}

export interface StoryPackageCounts {
    parts: number; chapters: number; scenes: number
    /** Words in the package's scenes, or null when the server cannot count them. */
    words: number | null
    references: number; comments: number; bookmarks: number; tasks: number; facts: number; stash: number; revisions: number
}

/** An image the novel refers to. Images are referred to, not embedded. */
export interface StoryPackageMedia { role: 'cover'; assetId: string; alt: string | null; included: false }

/** A Codex card the novel refers to, under the name it had when it was added. */
export interface StoryPackageReference { id: string; kind: string; cardId: string; name: string | null; removed: boolean }

/** The package a novel's choices make: what it holds, its size and SHA-256. The download must match it. */
export interface StoryPackageManifest {
    schemaVersion: 1
    projection: 'novel_package'
    storyId: string
    title: string
    /** Names the novel's saved state with these choices; a download made after a change is refused. */
    sourceVersion: string
    options: StoryPackageOptions
    filename: string
    contentType: 'application/vnd.magic-worlds.novel+zip'
    bytes: number
    sha256: string
    counts: StoryPackageCounts
    media: StoryPackageMedia[]
}

/** What restoring a package file would create. Nothing is saved. */
export interface StoryPackagePreview {
    schemaVersion: 1
    projection: 'novel_package'
    filename: string
    bytes: number
    packageHash: string
    formatVersion: 1
    source: { storyId: string; title: string; sourceVersion: string }
    title: string
    /** What the package holds; a restore can leave any of it out. */
    includes: StoryPackageOptions
    counts: StoryPackageCounts
    references: StoryPackageReference[]
    /** Each image, and whether the same image is in this workspace (a cover is kept only then). */
    media: (StoryPackageMedia & { available: boolean })[]
}

export interface StoryPackageWrite { requestId: string; title: string; packageHash: string; options: StoryPackageOptions }

export interface StoryPackageAcknowledgement { kind: 'novel_package_import'; requestId: string; storyId: string; write: StoryPackageWrite }
