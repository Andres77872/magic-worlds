import { generateUUID } from '@/utils/uuid'
import { API_BASE_URL } from '@/infrastructure/api/baseUrl'
import { canonicalJson } from '@/utils/json'
import { apiStorageOrigin, workspaceStorageKey } from './workspaceStorage'

const writerId = generateUUID()
const MAX_RECORD_LENGTH = 2_100_000
export interface NovelJournalScope {
    userHash: string | null | undefined
    workspaceId: string | null | undefined
    storyId: string | null
}
export interface NovelJournalRecord<T> {
    schema: 1
    write: T
    storageKey?: string
    writtenAt?: number
}
export function novelMutationKey(domain: string, scope: NovelJournalScope, target?: string, writer: string = writerId): string | null {
    return scopedNovelMutationKey(domain, { ...scope, apiOrigin: apiStorageOrigin(API_BASE_URL) }, target, writer)
}
/** Device recovery retains the recorded API origin instead of today's configured origin. */
export function scopedNovelMutationKey(domain: string, scope: NovelJournalScope & { apiOrigin: string }, target?: string, writer: string = writerId): string | null {
    if (!scope.userHash || !scope.workspaceId || !scope.storyId) return null
    const identity = [scope.storyId, ...(target ? [target] : [])].map(encodeURIComponent).join(':')
    return workspaceStorageKey(`magic-worlds:novel-${domain}:v1:${identity}`, {
        apiOrigin: scope.apiOrigin, userHash: scope.userHash, workspaceId: scope.workspaceId,
    }) + `::writer:${encodeURIComponent(writer)}`
}
/** Prefer this writer; otherwise offer the newest valid scoped record for explicit recovery. */
export function readNovelMutation<T>(key: string | null, accepts: (value: unknown) => value is T, maxRecordLength = MAX_RECORD_LENGTH): NovelJournalRecord<T> | null {
    if (!key) return null
    try {
        const prefix = key.slice(0, key.lastIndexOf('::writer:')) + '::writer:'
        let newest: NovelJournalRecord<T> | null = null
        for (let index = 0; index < localStorage.length; index++) {
            const candidate = localStorage.key(index)
            if (!candidate?.startsWith(prefix)) continue
            try {
                const raw = localStorage.getItem(candidate)
                if (!raw || raw.length > maxRecordLength) continue
                const value = JSON.parse(raw)
                if (value?.schema !== 1 || !accepts(value.write) || typeof value.writtenAt !== 'number' || !Number.isFinite(value.writtenAt)) continue
                const record = { ...value, storageKey: candidate } as NovelJournalRecord<T>
                if (candidate === key) return record
                if (!newest || value.writtenAt > (newest.writtenAt ?? 0)) newest = record
            } catch { /* One malformed writer does not hide another recoverable request. */ }
        }
        return newest
    } catch { return null }
}
export function writeNovelMutation<T>(key: string | null, write: T, maxRecordLength = MAX_RECORD_LENGTH): boolean {
    if (!key) return false
    try {
        const raw = JSON.stringify({ schema: 1, write, writtenAt: Date.now() })
        if (raw.length > maxRecordLength) return false
        localStorage.setItem(key, raw)
        return localStorage.getItem(key) === raw
    } catch { return false }
}
/** Transfer explicit recovery to this writer before retiring its previous durable copy. */
export function adoptNovelMutation<T>(key:string|null,record:NovelJournalRecord<T>):boolean {
    const stored=writeNovelMutation(key,record.write)
    if(stored&&record.storageKey&&record.storageKey!==key)retireNovelMutation(record,null)
    return stored
}
/** Never erase another writer's newer input or a newer operation at this key. */
export function retireNovelMutation<T>(record: NovelJournalRecord<T> | null, key: string | null): void {
    if (!record) return
    for (const candidate of new Set([key, record.storageKey])) {
        if (!candidate) continue
        try {
            const current = JSON.parse(localStorage.getItem(candidate) ?? 'null')
            if (current?.schema === 1 && canonicalJson(current.write) === canonicalJson(record.write)) localStorage.removeItem(candidate)
        } catch { /* Exact receipts keep an acknowledged request safe to recover later. */ }
    }
}
export const isNovelRequestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
export const isNovelRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export function listNovelMutations<T>(domain:string,scope:Omit<NovelJournalScope,'storyId'>,
    accepts:(value:unknown)=>value is T,identity:(value:T)=>{storyId:string;target?:string},maxRecordLength=MAX_RECORD_LENGTH):NovelJournalRecord<T>[] {
    if(!scope.userHash||!scope.workspaceId)return []
    try{
        const suffix=workspaceStorageKey('',{apiOrigin:apiStorageOrigin(API_BASE_URL),userHash:scope.userHash,workspaceId:scope.workspaceId})
        const records:NovelJournalRecord<T>[]=[]
        for(let index=0;index<localStorage.length;index++){
            const key=localStorage.key(index)
            if(!key?.startsWith(`magic-worlds:novel-${domain}:v1:`)||!key.split('::writer:')[0].endsWith(suffix))continue
            try{
                const raw=localStorage.getItem(key)
                if(!raw||raw.length>maxRecordLength)continue
                const record=JSON.parse(raw)
                if(record?.schema!==1||typeof record.writtenAt!=='number'||!Number.isFinite(record.writtenAt)||!accepts(record.write))continue
                const item=identity(record.write)
                const expected=novelMutationKey(domain,{...scope,storyId:item.storyId},item.target)
                if(expected?.split('::writer:')[0]!==key.split('::writer:')[0])continue
                records.push({...record,storageKey:key})
            }catch{/* Ignore only the malformed record. */}
        }
        return records.sort((a,b)=>(b.writtenAt??0)-(a.writtenAt??0))
    }catch{return []}
}
