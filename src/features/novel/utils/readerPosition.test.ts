import { beforeEach,expect,it,vi } from 'vitest'
import { readingItem,readingWindow } from '@/test/fixtures/storyReading'
import { captureReaderPosition,isReaderPosition,readReaderPosition,restoreReaderPosition,type ReaderPosition } from './readerPosition'
const scope={scope:'novel' as const,unitId:null,includeArchived:false}
const saved=(patch:Partial<ReaderPosition>={}):ReaderPosition=>({schemaVersion:1,scope,sceneId:'scene-1',contentHash:'a'.repeat(64),nodeId:'scene-1-p',blockOffset:170,blockHeight:600,width:600,appearance:'standard',...patch})
function rectangle(top:number,height:number,width=600){return {top,bottom:top+height,left:0,right:width,width,height,x:0,y:top,toJSON:()=>({})} as DOMRect}
function room(){
    const root=document.createElement('div'),contents=document.createElement('div'),scene=document.createElement('section'),block=document.createElement('p')
    scene.dataset.readerSceneId='scene-1';block.dataset.manuscriptNodeId='scene-1-p';block.textContent='A saved passage.'
    scene.append(block);contents.append(scene);root.append(contents);document.body.append(root)
    const layout={base:180,height:600,width:600}
    root.getBoundingClientRect=()=>rectangle(100,400,layout.width)
    scene.getBoundingClientRect=()=>rectangle(layout.base-root.scrollTop-40,layout.height+80,layout.width)
    block.getBoundingClientRect=()=>rectangle(layout.base-root.scrollTop,layout.height,layout.width)
    return {root,contents,scene,block,layout,pages:[readingWindow()]}
}
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks()})
it('captures a scoped canonical block without storing prose, then preserves the view after preceding content is removed',()=>{
    const {root,contents,layout,pages}=room();root.scrollTop=250
    const position=captureReaderPosition(root,contents,pages,scope,'standard')!
    expect(position).toEqual(saved());expect(JSON.stringify(position)).not.toContain('saved passage')
    layout.base+=700
    expect(restoreReaderPosition(root,contents,pages,position,'standard')).toBe('restored')
    expect(root.scrollTop).toBe(950)
    layout.base-=700
    expect(restoreReaderPosition(root,contents,pages,position,'standard')).toBe('restored');expect(root.scrollTop).toBe(250)
})
it('adapts the bound paragraph fraction after width, appearance or font metrics change',()=>{
    const {root,contents,layout,pages}=room();root.scrollTop=250
    layout.height=1200
    expect(restoreReaderPosition(root,contents,pages,saved(),'standard')).toBe('restored')
    expect(root.scrollTop).toBe(420)
    layout.width=400;layout.height=600
    expect(restoreReaderPosition(root,contents,pages,saved(),'large')).toBe('restored');expect(root.scrollTop).toBe(250)
})
it('never substitutes an equal-looking passage after a different document hash, scene or block identity',()=>{
    const {root,contents,pages}=room();root.scrollTop=250
    for(const position of [saved({contentHash:'b'.repeat(64)}),saved({sceneId:'other'}),saved({nodeId:'other-node'})]){
        expect(restoreReaderPosition(root,contents,pages,position,'standard')).toBe('changed');expect(root.scrollTop).toBe(250)
    }
})
it('supports scene-level positions when the visible scene has no rendered text block',()=>{
    const {root,contents,block,pages}=room();block.remove();root.scrollTop=50
    const position=captureReaderPosition(root,contents,pages,scope,'standard')!
    expect(position.nodeId).toBeNull();expect(position.blockOffset).toBe(0)
    expect(restoreReaderPosition(root,contents,pages,position,'standard')).toBe('restored')
})
it('retains only a valid bounded record for the matching reading scope and leaves malformed records untouched',()=>{
    expect(isReaderPosition(saved())).toBe(true)
    for(const value of [saved({blockOffset:-1}),saved({blockOffset:900}),saved({blockHeight:0}),saved({width:Infinity}),saved({nodeId:''}),{...saved(),prose:'private'}])expect(isReaderPosition(value)).toBe(false)
    const key='owned-reader-position',raw=JSON.stringify({...saved(),scope:{includeArchived:false,unitId:null,scope:'novel'}})
    localStorage.setItem(key,raw);expect(readReaderPosition(key,scope).position).toEqual(saved())
    expect(readReaderPosition(key,{...scope,includeArchived:true}).position).toBeNull();expect(localStorage.getItem(key)).toBe(raw)
    localStorage.setItem(key,'x'.repeat(2049));expect(readReaderPosition(key,scope).position).toBeNull();expect(localStorage.getItem(key)).toHaveLength(2049)
})
it('reports unavailable device storage and ignores unrelated scene projections',()=>{
    const {root,contents}=room();root.scrollTop=250
    expect(captureReaderPosition(root,contents,[readingWindow({items:[readingItem('other')]})],scope,'standard')).toBeNull()
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Blocked')})
    expect(readReaderPosition('owned-reader-position',scope)).toEqual({position:null,unavailable:true})
})
