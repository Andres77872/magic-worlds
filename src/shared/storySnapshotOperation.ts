import type { StoryCopyCounts,StorySnapshotCreateOperation,StorySnapshotRestoreOptions,StorySnapshotRestoreOperation } from '@/shared/types/story.types'
import { isRecord,isNovelRevision } from './novelMutationJournal'
export const isSnapshotHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
export function isSnapshotCounts(value:unknown):value is StoryCopyCounts {
    return isRecord(value)&&Object.keys(value).length===4&&['parts','chapters','scenes','references'].every((key)=>Number.isSafeInteger(value[key])&&Number(value[key])>=0)
}
export function isSnapshotCreateOperation(value:unknown):value is StorySnapshotCreateOperation {
    return isRecord(value)&&Object.keys(value).length===('sourceAnnotationRevision' in value?6:5)&&(!('sourceAnnotationRevision' in value)||isNovelRevision(value.sourceAnnotationRevision))&&value.op==='create_snapshot'&&typeof value.title==='string'
        &&value.title===value.title.trim()&&value.title.length>0&&Array.from(value.title).length<=255&&!value.title.includes('\n')
        &&(value.note===null||typeof value.note==='string'&&Array.from(value.note).length<=2000)
        &&isSnapshotHash(value.expectedSourceVersion)&&isNovelRevision(value.sourceStructureRevision)
}
export function isSnapshotRestoreOptions(value:unknown):value is StorySnapshotRestoreOptions {
    return isRecord(value)&&Object.keys(value).length===5&&['text','details','organization','context'].every((key)=>typeof value[key]==='boolean')
        &&['keep','trash'].includes(String(value.laterUnits))&&(['text','details','organization','context'].some((key)=>value[key])||value.laterUnits==='trash')
}
export function isSnapshotRestoreOperation(value:unknown):value is StorySnapshotRestoreOperation {
    return isRecord(value)&&Object.keys(value).length===6&&value.op==='restore_snapshot'&&isNovelRevision(value.snapshotId)
        &&isSnapshotHash(value.manifestHash)&&isSnapshotHash(value.expectedSourceVersion)&&isNovelRevision(value.sourceStructureRevision)
        &&value.snapshotId<=value.sourceStructureRevision&&isSnapshotRestoreOptions(value.options)
}
