import { describe, expect, it } from 'vitest'
import { packageManifest, packagePreview } from '@/test/fixtures/storyPackage'
import { isStoryPackageFile, isStoryPackageOptions, isStoryPackageWrite, storyPackageQuery, verifyStoryPackageAcknowledgement, verifyStoryPackageManifest,
    verifyStoryPackagePreview } from './storyPackageContract'

const ALL = { notes: true, planning: true, history: true }
const FILE = { size: 48_000, sha256: 'e'.repeat(64) }

describe('project package contract', () => {
    it('accepts a backup summary only for this novel and these very choices', () => {
        const lean = { notes: false, planning: true, history: false }
        expect(verifyStoryPackageManifest(packageManifest(lean), 'story-1', lean)).toBe(true)
        expect(verifyStoryPackageManifest(packageManifest(lean), 'story-2', lean)).toBe(false)
        expect(verifyStoryPackageManifest(packageManifest(lean), 'story-1', ALL)).toBe(false)
        // A summary that counts what was left out does not describe these choices.
        expect(verifyStoryPackageManifest(packageManifest(lean, { counts: { ...packageManifest(ALL).counts } }), 'story-1', lean)).toBe(false)
        expect(verifyStoryPackageManifest(packageManifest(ALL, { filename: 'Gull-Point.zip' }), 'story-1', ALL)).toBe(false)
        expect(verifyStoryPackageManifest(packageManifest(ALL, { bytes: 65 * 1024 * 1024 }), 'story-1', ALL)).toBe(false)
        expect(verifyStoryPackageManifest({ ...packageManifest(ALL), extra: true }, 'story-1', ALL)).toBe(false)
        expect(storyPackageQuery(packageManifest(lean))).toBe('sourceVersion=' + 'b'.repeat(64) + '&notes=false&planning=true&history=false')
    })

    it('accepts a restore preview only of this very file', () => {
        expect(verifyStoryPackagePreview(packagePreview(FILE), FILE)).toBe(true)
        expect(verifyStoryPackagePreview(packagePreview(FILE), { ...FILE, sha256: 'f'.repeat(64) })).toBe(false)
        expect(verifyStoryPackagePreview(packagePreview(FILE), { ...FILE, size: 1 })).toBe(false)
        expect(verifyStoryPackagePreview(packagePreview(FILE, { references: [] }), FILE)).toBe(false)
        expect(verifyStoryPackagePreview(packagePreview(FILE, { media: [{ role: 'cover', assetId: 'image-one', alt: null, included: false } as never] }), FILE)).toBe(false)
        expect(verifyStoryPackagePreview(packagePreview(FILE, { formatVersion: 2 as never }), FILE)).toBe(false)
    })

    it('checks writes, receipts, options and the file name', () => {
        const write = { requestId: 'novel-restore-1', title: 'Gull Point', packageHash: 'e'.repeat(64), options: ALL }
        expect(isStoryPackageWrite(write)).toBe(true)
        expect(isStoryPackageWrite({ ...write, title: ' Gull Point' })).toBe(false)
        expect(isStoryPackageWrite({ ...write, options: { notes: true } })).toBe(false)
        const storyId = '0a1b2c3d-0000-5000-8000-000000000001'
        expect(verifyStoryPackageAcknowledgement({ kind: 'novel_package_import', requestId: write.requestId, storyId, write }, write)).toBe(true)
        expect(verifyStoryPackageAcknowledgement({ kind: 'novel_import', requestId: write.requestId, storyId, write }, write)).toBe(false)
        expect(verifyStoryPackageAcknowledgement({ kind: 'novel_package_import', requestId: write.requestId, storyId, write: { ...write, title: 'Other' } }, write)).toBe(false)
        expect(isStoryPackageOptions(ALL)).toBe(true)
        expect(isStoryPackageOptions({ ...ALL, history: 'yes' })).toBe(false)
        expect(isStoryPackageFile('Backup.MWNOVEL')).toBe(true)
        expect(isStoryPackageFile('backup.zip')).toBe(false)
    })
})
