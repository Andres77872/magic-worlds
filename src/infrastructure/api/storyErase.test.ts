import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { storyEraseCountKeys } from './storyEraseContract'

const write={requestId:'erase-one',expectedSourceVersion:'a'.repeat(64),confirmedTitle:'The closed door'}
const preview={schema:1,kind:'novel_erase_preview',storyId:'novel-one',title:write.confirmedTitle,sourceVersion:write.expectedSourceVersion,
    trashedAt:'2026-10-17T00:00:00',policy:'explicit-novel-erase-v1',activeExecutions:0,counts:Object.fromEntries(storyEraseCountKeys.map((key)=>[key,2]))}
const ack={schema:1,kind:'novel_erase',storyId:'novel-one',requestId:write.requestId,sourceVersion:write.expectedSourceVersion,intentHash:'b'.repeat(64),erasedAt:'2026-10-17T00:00:00'}
const transport=()=>vi.spyOn(apiService as unknown as {authenticatedRequest:(...args:unknown[])=>Promise<unknown>},'authenticatedRequest')

beforeEach(()=>setTestFeatureFlags({ novels: true }))
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()})

describe('novel erasure API',()=>{
    it('reads one exact preview and sends the confirmed immutable write to its own route',async()=>{
        const send=transport().mockResolvedValueOnce(preview).mockResolvedValueOnce(ack)
        expect(await apiService.previewStoryErase('novel-one')).toEqual(preview)
        expect(await apiService.permanentlyEraseStory('novel-one',write)).toEqual(ack)
        expect(send.mock.calls[0][0]).toBe('/stories/novel-one/erase-preview')
        expect(send.mock.calls[1][0]).toBe('/stories/novel-one/erase')
        expect(send.mock.calls[1][2]).toMatchObject({method:'POST',body:write})
    })
    it('recovers an absent or exact receipt without another mutation',async()=>{
        const send=transport().mockResolvedValueOnce(null).mockResolvedValueOnce(ack)
        expect(await apiService.getStoryEraseResult('novel-one',write)).toBeNull()
        expect(await apiService.getStoryEraseResult('novel-one',write)).toEqual(ack)
        expect(send.mock.calls.every((call)=>call[0]==='/stories/novel-one/erase-requests/erase-one'&&call[2]===undefined)).toBe(true)
    })
    it('rejects a mismatched preview or acknowledgement for retained recovery',async()=>{
        transport().mockResolvedValueOnce({...preview,storyId:'other-novel'}).mockResolvedValueOnce({...ack,requestId:'other-request'})
        await expect(apiService.previewStoryErase('novel-one')).rejects.toMatchObject({status:502,code:'story_contract'})
        await expect(apiService.permanentlyEraseStory('novel-one',write)).rejects.toMatchObject({status:502,code:'story_contract'})
    })
    it('keeps all erasure routes behind the existing novels feature gate',async()=>{
        setTestFeatureFlags({ novels: false })
        const send=transport()
        for(const action of [()=>apiService.previewStoryErase('novel-one'),()=>apiService.permanentlyEraseStory('novel-one',write),()=>apiService.getStoryEraseResult('novel-one',write)])await expect(action()).rejects.toThrow('Novels are disabled')
        expect(send).not.toHaveBeenCalled()
    })
})
