import { expect,it } from 'vitest'
import { verifyPlanAck,verifyPlanItem,verifyPlanPage } from './storyPlanningContract'

const task={id:'t1',storyId:'s',kind:'task',state:'open',sceneId:'a',revision:1,data:{title:'Fix',origin:'author',sceneId:'a',quote:'q'},createdAt:'2026-10-17T10:00:00',updatedAt:'2026-10-17T10:00:00'}

it('accepts exact planning items and rejects foreign stories, kinds, states and fields',()=>{
    expect(verifyPlanItem(task,'s','task')).toBe(true)
    expect(verifyPlanItem(task,'other','task')).toBe(false)
    expect(verifyPlanItem(task,'s','fact')).toBe(false)
    expect(verifyPlanItem({...task,state:'approved'},'s','task')).toBe(false)
    expect(verifyPlanItem({...task,data:{...task.data,extra:1}},'s','task')).toBe(false)
    expect(verifyPlanItem({...task,data:{title:'Fix',origin:'author',quote:'orphan'}},'s','task')).toBe(false)
    expect(verifyPlanItem({...task,kind:'stash',state:'kept',data:{kind:'cut',title:'Cut',text:'Mara'}},'s','stash')).toBe(true)
    expect(verifyPlanItem({...task,kind:'fact',state:'proposed',data:{subject:'Mara',kind:'mood',statement:'x',origin:'author'}},'s','fact')).toBe(false)
})

it('matches an acknowledgement to its exact write and revision',()=>{
    const create={requestId:'r1',operation:{op:'create' as const,id:'t1',kind:'task' as const,data:{title:'Fix',origin:'author' as const}}}
    expect(verifyPlanAck({kind:'plan_item',storyId:'s',requestId:'r1',item:task},'s',create)).toBe(true)
    expect(verifyPlanAck({kind:'plan_item',storyId:'s',requestId:'r2',item:task},'s',create)).toBe(false)
    const update={requestId:'r3',operation:{op:'update' as const,id:'t1',kind:'task' as const,expectedRevision:1,state:'done' as const}}
    expect(verifyPlanAck({kind:'plan_item',storyId:'s',requestId:'r3',item:{...task,revision:2,state:'done'}},'s',update)).toBe(true)
    expect(verifyPlanAck({kind:'plan_item',storyId:'s',requestId:'r3',item:{...task,revision:2,state:'open'}},'s',update)).toBe(false)
    expect(verifyPlanPage({storyId:'s',kind:'task',items:[task,task],truncated:false},'s','task')).toBe(false)
    expect(verifyPlanPage({storyId:'s',kind:'task',items:[task],truncated:false},'s','task')).toBe(true)
})

it('accepts Codex provenance on a fact only as an entry and revision pair',()=>{
    const fact=(data:Record<string,unknown>)=>({...task,kind:'fact',state:'approved',data:{subject:'Mara',kind:'trait',statement:'Keeps the lamp',origin:'author',...data}})
    expect(verifyPlanItem(fact({codexRefId:'ref-1',codexRevision:9}),'s','fact')).toBe(true)
    for(const data of [{codexRefId:'ref-1'},{codexRevision:9},{codexRefId:'ref-1',codexRevision:0},{codexRefId:' ',codexRevision:9}])expect(verifyPlanItem(fact(data),'s','fact')).toBe(false)
})
