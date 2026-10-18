import { beforeEach, expect, it, vi } from 'vitest'
import { isRecord, listNovelMutations, novelMutationKey, readNovelMutation, retireNovelMutation, writeNovelMutation } from './novelMutationJournal'
import { identifyDocument,isStoryDocument } from './storyDocument'

const scope={userHash:'author-one',workspaceId:'work-one',storyId:'novel-one'}
const accepts=(value:unknown):value is {storyId:string;value:string}=>isRecord(value)&&typeof value.storyId==='string'&&typeof value.value==='string'
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks()})

it('offers only valid records in the exact origin, author, workspace, novel and target scope',()=>{
    const own=novelMutationKey('details',scope,'scene:one','current')!
    const other=novelMutationKey('details',scope,'scene:one','old')!
    const write={storyId:scope.storyId,value:'Recover my words'}
    writeNovelMutation(other,write)
    for(const altered of [{...scope,userHash:'author-two'},{...scope,workspaceId:'work-two'},{...scope,storyId:'novel-two'}])writeNovelMutation(novelMutationKey('details',altered,'scene:one'),{...write,value:'Private elsewhere'})
    writeNovelMutation(novelMutationKey('details',scope,'scene:two'),{...write,value:'Other scene'})
    localStorage.setItem(own,'invalid JSON')
    expect(readNovelMutation(own,accepts)?.write).toEqual(write)
    expect(readNovelMutation(novelMutationKey('details',scope,'absent'),accepts)).toBeNull()
    const listed=listNovelMutations('details',scope,accepts,(item)=>({storyId:item.storyId,target:'scene:one'}))
    expect(listed.map((item)=>item.write)).toEqual([write])
})

it('prefers this writer and never retires newer local or recovered input',()=>{
    const own=novelMutationKey('structure',scope,undefined,'current')!
    const other=novelMutationKey('structure',scope,undefined,'old')!
    const first={storyId:scope.storyId,value:'first'}
    vi.spyOn(Date,'now').mockReturnValueOnce(10).mockReturnValueOnce(20)
    writeNovelMutation(own,first)
    writeNovelMutation(other,{...first,value:'second'})
    const receipt=readNovelMutation(own,accepts)!
    expect(receipt.write).toEqual(first)
    writeNovelMutation(own,{...first,value:'new keystrokes'})
    retireNovelMutation(receipt,other)
    expect(readNovelMutation(own,accepts)?.write.value).toBe('new keystrokes')
    expect(localStorage.getItem(other)).not.toBeNull()
    retireNovelMutation(readNovelMutation(other,accepts),null)
    expect(localStorage.getItem(other)).toBeNull()
})

it('reports quota failure without deleting any recoverable record',()=>{
    const key=novelMutationKey('details',scope)!
    writeNovelMutation(key,{storyId:scope.storyId,value:'saved input'})
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Quota','QuotaExceededError')})
    expect(writeNovelMutation(key,{storyId:scope.storyId,value:'new input'})).toBe(false)
    expect(readNovelMutation(key,accepts)?.write.value).toBe('saved input')
})

it('opens recovery and assigns document identities on LAN HTTP without crypto.randomUUID',async()=>{
    vi.stubGlobal('crypto',{})
    try{
        vi.resetModules()
        const journal=await import('./novelMutationJournal')
        const key=journal.novelMutationKey('details',scope)!
        expect(journal.writeNovelMutation(key,{storyId:scope.storyId,value:'LAN input'})).toBe(true)
        expect(journal.readNovelMutation(key,accepts)?.write.value).toBe('LAN input')
        expect(isStoryDocument(identifyDocument({type:'doc',content:[{type:'paragraph'}]}))).toBe(true)
    }finally{vi.unstubAllGlobals()}
})
