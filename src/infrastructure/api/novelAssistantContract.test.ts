import { describe,expect,it } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import { assistantTurnFixture } from '@/test/assistantFixtures'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import { verifyAssistantTurn } from './assistantContract'
import { verifyNovelAssistantPreview,verifyNovelAssistantRecord } from './novelAssistantContract'
import { verifyAssistantContext,verifyFrozenAssistantContext } from './storyAssistantContextContract'
import { canonicalJson } from '@/utils/json'

const index=wire.index as unknown as StoryStudioIndex
const request=wire.preview.context.request as StoryAssistantContextRequest
const executionId='11111111-1111-4111-8111-111111111111'
function final(){
    const record=structuredClone(wire.records.suggest)
    const turn=assistantTurnFixture('novel','novel-contract-1',{conversation:{conversation_id:7,kind:'novel',story_id:index.id,conversation_version:1}})
    turn.user_message.content=record.context.request.message
    turn.assistant_message.content=record.result.answer
    turn.assistant_message.metadata={request_id:'novel-contract-1',usage:null,novel:record}
    turn.messages=[turn.user_message,turn.assistant_message]
    return turn
}

describe('novel assistant evidence and staged proposal boundary',()=>{
    it.each(['A','🌙'])('accepts the declared answer/proposal limits as Unicode code points (%s)',char=>{
        const turn=final(),record=structuredClone(wire.records.suggest)
        record.result.answer=char.repeat(20_000)
        record.result.proposal!.markdown=char.repeat(120_000)
        turn.assistant_message.metadata={...turn.assistant_message.metadata,novel:record}
        turn.assistant_message.content=record.result.answer
        // Retain the actual wire duplication in terminal messages.
        turn.messages=[turn.user_message,turn.assistant_message]
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(true)
        expect(verifyAssistantTurn(JSON.parse(JSON.stringify(turn)),'novel',7,'novel-contract-1')).toBe(true)
    })
    it.each(['answer','proposal'] as const)('rejects one extra Unicode code point in %s',field=>{
        const record=structuredClone(wire.records.suggest)
        if(field==='answer')record.result.answer='🌙'.repeat(20_001)
        else record.result.proposal!.markdown='🌙'.repeat(120_001)
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(false)
    })
    it('accepts the Python compiler/handler packet and full published-profile preview',()=>{
        expect(verifyFrozenAssistantContext(wire.records.ask.context,index.id)).toBe(true)
        expect(verifyNovelAssistantRecord(wire.records.ask,index.id,executionId)).toBe(true)
        expect(verifyNovelAssistantRecord(wire.records.suggest,index.id,executionId)).toBe(true)
        expect(verifyNovelAssistantPreview(wire.preview,7,index,request)).toBe(true)
        expect(verifyAssistantTurn(final(),'novel',7,'novel-contract-1')).toBe(true)
    })
    it('keeps historical evidence readable after current prose or headings change',()=>{
        const changed=structuredClone(index);changed.sourceVersion='0'.repeat(64);changed.metadataRevision++
        expect(verifyAssistantContext(wire.records.ask.context,changed,wire.records.ask.context.request as StoryAssistantContextRequest)).toBe(false)
        expect(verifyFrozenAssistantContext(wire.records.ask.context,index.id)).toBe(true)
    })
    it('rejects adopted status, foreign targets, expanded selections and forged evidence',()=>{
        for(const mutation of [
            (v:typeof wire.records.suggest)=>{v.result.proposal!.status='accepted'},
            (v:typeof wire.records.suggest)=>{v.result.proposal!.sceneId='foreign-scene'},
            (v:typeof wire.records.suggest)=>{v.result.proposal!.baseRevision++},
            (v:typeof wire.records.suggest)=>{v.result.citations[0].quote='Invented evidence'},
            (v:typeof wire.records.suggest)=>{v.result.citations.push(structuredClone(v.result.citations[0]))},
            (v:typeof wire.records.suggest)=>{v.context.packet.task='ask'},
        ]){const value=structuredClone(wire.records.suggest);mutation(value);expect(verifyNovelAssistantRecord(value,index.id,executionId)).toBe(false)}
        expect(verifyNovelAssistantRecord(wire.records.suggest,'another-novel',executionId)).toBe(false)
        expect(verifyNovelAssistantRecord(wire.records.suggest,index.id,'22222222-2222-4222-8222-222222222222')).toBe(false)
    })
    it('rejects incomplete profile limits, different question and already-applied tool results',()=>{
        const changed=structuredClone(wire.preview);changed.profile.roles.primary.settings.max_output_tokens=request.limits.outputTokens+1
        expect(verifyNovelAssistantPreview(changed,7,index,request)).toBe(false)
        const turn=final();turn.user_message.content='A different question'
        expect(verifyAssistantTurn(turn,'novel',7,'novel-contract-1')).toBe(false)
        expect(verifyAssistantTurn({...final(),tool_message:final().assistant_message,applied_actions:[]},'novel',7,'novel-contract-1')).toBe(false)
    })
})

describe('book copy',()=>{
    it('keeps a copy field only on a copy-action reply',()=>{
        // The copy field belongs to the copy action (A26); a reply to any other question cannot carry one.
        const record=structuredClone(wire.records.ask) as unknown as {result:Record<string,unknown>}
        record.result.copy='A keeper and a letter.'
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(false)
    })
})

describe('proposed story facts',()=>{
    function withFacts(patch:Record<string,unknown>={}){
        const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0],passage=source.passages[0]
        const words=passage.quote.trim().split(/\s+/).slice(0,3).join(' ')
        const fact={subject:'Mara',kind:'location',statement:'Keeps the lamp',object:null,passage:passage.id,sceneId:source.sceneId,revision:source.revision,
            excerpt:passage.quote.includes(words)?words:null,...patch}
        return {...record,result:{...record.result,facts:[fact]}}
    }
    it('accepts facts that name a retained passage with a verbatim excerpt and rejects any other shape',()=>{
        expect(verifyNovelAssistantRecord(withFacts(),index.id,executionId)).toBe(true)
        expect(verifyNovelAssistantRecord(withFacts({excerpt:null,object:'Gull Point'}),index.id,executionId)).toBe(true)
        for(const patch of [{passage:'0'.repeat(64)},{sceneId:'another-scene'},{revision:999},{kind:'mood'},{subject:' Mara'},{excerpt:'words never written'},{approved:true}])
            expect(verifyNovelAssistantRecord(withFacts(patch),index.id,executionId)).toBe(false)
        const empty=withFacts();empty.result.facts=[]
        expect(verifyNovelAssistantRecord(empty,index.id,executionId)).toBe(false)
    })
})

describe('continuity issues',()=>{
    it('accepts issues whose evidence names retained passages and rejects forged evidence',()=>{
        const make=(patch:Record<string,unknown>={},row:Record<string,unknown>={})=>{
            const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0],passage=source.passages[0]
            const issue={title:'Winters disagree',detail:'Eleven or twelve.',certainty:'likely',evidence:[{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null,...row}],...patch}
            return {...record,result:{...record.result,issues:[issue]}}
        }
        expect(verifyNovelAssistantRecord(make(),index.id,executionId)).toBe(true)
        for(const patch of [{certainty:'sure'},{title:''},{evidence:[]},{resolved:true}])expect(verifyNovelAssistantRecord(make(patch),index.id,executionId)).toBe(false)
        for(const row of [{passage:'f'.repeat(64)},{revision:0},{excerpt:'never written anywhere'}])expect(verifyNovelAssistantRecord(make({},row),index.id,executionId)).toBe(false)
    })
})

describe('approved facts in the source packet',()=>{
    const fact=(id:string,patch:Record<string,unknown>={})=>({id,revision:1,subject:'Aria',kind:'trait',statement:'Is sixteen',object:null,fromSceneId:null,untilSceneId:null,...patch})
    function withFacts(facts:unknown[],trace:Record<string,unknown>={}){
        const context=structuredClone(wire.preview.context) as unknown as {packet:Record<string,unknown>;trace:Record<string,unknown>;messages:Array<{content:string}>}
        context.packet.facts=facts;Object.assign(context.trace,trace)
        context.messages[1].content=canonicalJson(context.packet)
        context.trace.inputEstimate=new TextEncoder().encode(canonicalJson(context.messages)).length+64
        return context
    }
    it('accepts exactly the facts the compiler may include, live and frozen',()=>{
        const ok=withFacts([fact('a'),fact('b',{fromSceneId:'scene-1'}),fact('c',{fromSceneId:'scene-1',untilSceneId:'scene-2'})])
        expect(verifyAssistantContext(ok,index,request)).toBe(true)
        expect(verifyFrozenAssistantContext(ok,index.id)).toBe(true)
        expect(verifyAssistantContext(withFacts([fact('a')],{factExclusions:[{factId:'z',reason:'budget'}]}),index,request)).toBe(true)
    })
    it.each([
        ['a later fact through the anchor',[fact('a',{fromSceneId:'scene-3'})]],
        ['a fact that ended before every source',[fact('a',{untilSceneId:'scene-0'})]],
        ['an unknown scene',[fact('a',{fromSceneId:'deleted'})]],
        ['reading order',[fact('b',{fromSceneId:'scene-1'}),fact('a')]],
        ['a duplicate id',[fact('a'),fact('a')]],
        ['an unknown kind',[fact('a',{kind:'mood'})]],
        ['an extra field',[{...fact('a'),state:'proposed'}]],
        ['an empty list',[]],
    ])('rejects %s',(_,facts)=>{
        expect(verifyAssistantContext(withFacts(facts),index,request)).toBe(false)
    })
    it('rejects malformed exclusions in both verifiers',()=>{
        for(const trace of [{factExclusions:[]},{factExclusions:[{factId:'z',reason:'other'}]}]){
            expect(verifyAssistantContext(withFacts([fact('a')],trace),index,request)).toBe(false)
            expect(verifyFrozenAssistantContext(withFacts([fact('a')],trace),index.id)).toBe(false)
        }
    })
    it('lets an issue name only facts from its own packet',()=>{
        const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0],passage=source.passages[0],packet:Record<string,unknown>=record.context.packet
        packet.facts=[fact('age')]
        record.context.messages[1].content=canonicalJson(record.context.packet)
        record.context.trace.inputEstimate=new TextEncoder().encode(canonicalJson(record.context.messages)).length+64
        const issue=(facts:string[])=>({title:'Age contradicts the plan',detail:'Prose says seventeen.',certainty:'certain',evidence:[{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null}],facts})
        const result:Record<string,unknown>=record.result
        result.issues=[issue(['age'])]
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(true)
        result.issues=[issue(['other'])]
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(false)
        result.issues=[issue([])]
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(false)
    })
})

describe('critique notes and plans',()=>{
    it('accepts notes with cited evidence and options, and rejects grades or forged evidence',()=>{
        const make=(patch:Record<string,unknown>={},row:Record<string,unknown>={})=>{
            const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0],passage=source.passages[0]
            const note={aspect:'pacing',title:'Letter arrives early',observation:'The reveal lands before any doubt.',options:['Delay it a scene.','Keep it and add doubt.'],
                evidence:[{passage:passage.id,sceneId:source.sceneId,revision:source.revision,excerpt:null,...row}],...patch}
            return {...record,result:{...record.result,notes:[note]}}
        }
        expect(verifyNovelAssistantRecord(make(),index.id,executionId)).toBe(true)
        for(const patch of [{aspect:'grade'},{score:3},{options:[]},{options:['a','b','c','d']},{options:[' padded ']},{evidence:[]}])expect(verifyNovelAssistantRecord(make(patch),index.id,executionId)).toBe(false)
        for(const row of [{passage:'f'.repeat(64)},{sceneId:'other'},{excerpt:'never written anywhere'}])expect(verifyNovelAssistantRecord(make({},row),index.id,executionId)).toBe(false)
    })
    it('accepts plans whose steps name packet scenes at their saved revisions',()=>{
        const make=(step:Record<string,unknown>={},plan:Record<string,unknown>={})=>{
            const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0]
            return {...record,result:{...record.result,plan:{title:'Foreshadow the letter',steps:[{sceneId:source.sceneId,revision:source.revision,instruction:'Hint at the letter.',...step}],...plan}}}
        }
        expect(verifyNovelAssistantRecord(make(),index.id,executionId)).toBe(true)
        for(const step of [{sceneId:'outside-the-packet'},{revision:0},{instruction:''},{done:true}])expect(verifyNovelAssistantRecord(make(step),index.id,executionId)).toBe(false)
        for(const plan of [{steps:[]},{title:' '},{applied:true}])expect(verifyNovelAssistantRecord(make({},plan),index.id,executionId)).toBe(false)
    })
})

describe('proposed outline changes',()=>{
    const make=(...changes:Record<string,unknown>[])=>{
        const record=structuredClone(wire.records.suggest)
        return {...record,result:{...record.result,structure:changes}}
    }
    const scenes=wire.records.suggest.context.packet.sources
    it('accepts moves and merges that name writable packet scenes at their saved revisions',()=>{
        const move={kind:'move_scene',sceneId:scenes[2].sceneId,revision:scenes[2].revision,chapterId:'chapter-1',beforeSceneId:scenes[0].sceneId,reason:'Open on the letter.'}
        const merge={kind:'merge_scenes',sceneId:scenes[1].sceneId,revision:scenes[1].revision,otherSceneId:scenes[0].sceneId,otherRevision:scenes[0].revision,reason:'One beat.'}
        expect(verifyNovelAssistantRecord(make(move,merge,{...move,beforeSceneId:null}),index.id,executionId)).toBe(true)
        for(const patch of [{chapterId:'chapter-9'},{beforeSceneId:scenes[2].sceneId},{beforeSceneId:'outside'},{revision:7},{reason:' padded '},{applied:true},{kind:'reorder'}])
            expect(verifyNovelAssistantRecord(make({...move,...patch}),index.id,executionId)).toBe(false)
        for(const patch of [{otherSceneId:scenes[1].sceneId,otherRevision:scenes[1].revision},{otherRevision:9},{otherSceneId:'outside'},{excerpt:'x'}])
            expect(verifyNovelAssistantRecord(make({...merge,...patch}),index.id,executionId)).toBe(false)
        expect(verifyNovelAssistantRecord({...make(move),result:{...make(move).result,structure:[]}},index.id,executionId)).toBe(false)
        expect(verifyNovelAssistantRecord(make(...Array.from({length:7},()=>move)),index.id,executionId)).toBe(false)
    })
    it('accepts a split only where its excerpt begins a later paragraph of a retained passage',()=>{
        const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[0],passage=source.passages[0]
        const at=passage.quote.indexOf(' ')+1
        const split=(patch:Record<string,unknown>={})=>({...record,result:{...record.result,structure:[{kind:'split_scene',sceneId:source.sceneId,revision:source.revision,
            offset:passage.startOffset+at,excerpt:passage.quote.slice(at,at+5),title:'Later',reason:'Two beats.',...patch}]}})
        // The fixture passage is one paragraph, so a mid-paragraph point is refused, as is its start.
        expect(verifyNovelAssistantRecord(split(),index.id,executionId)).toBe(false)
        expect(verifyNovelAssistantRecord(split({offset:passage.startOffset,excerpt:passage.quote.slice(0,5)}),index.id,executionId)).toBe(passage.startOffset>0)
        expect(verifyNovelAssistantRecord(split({offset:0,excerpt:passage.quote.slice(0,5)}),index.id,executionId)).toBe(false)
    })
    it('accepts a split at the start of a later paragraph in a multi-paragraph passage',()=>{
        const record=structuredClone(wire.records.suggest),source=record.context.packet.sources[1],passage=source.passages[0]
        expect(record.result.citations.some(citation=>citation.type==='passage'&&citation.id===passage.id)).toBe(false)
        const first=passage.quote
        Object.assign(passage,{quote:first+'\n\nShe waited.',endOffset:passage.startOffset+first.length+13,anchor:null})
        // Re-freeze the edited packet the way the server froze the original: exact user message and byte estimate.
        record.context.messages[1].content=canonicalJson(record.context.packet)
        record.context.trace.inputEstimate=new TextEncoder().encode(canonicalJson(record.context.messages)).length+64
        expect(verifyNovelAssistantRecord(record,index.id,executionId)).toBe(true)
        const split=(patch:Record<string,unknown>={})=>({...record,result:{...record.result,structure:[{kind:'split_scene',sceneId:source.sceneId,revision:source.revision,
            offset:passage.startOffset+first.length+2,excerpt:'She waited',title:'Waiting',reason:'Two beats.',...patch}]}})
        expect(verifyNovelAssistantRecord(split(),index.id,executionId)).toBe(true)
        for(const patch of [{excerpt:'She left'},{offset:passage.startOffset+first.length+3},{title:' '},{revision:5},{offset:1.5}])
            expect(verifyNovelAssistantRecord(split(patch),index.id,executionId)).toBe(false)
    })
    it('accepts chapter changes that name the chapters of writable packet scenes, within one part',()=>{
        const record=structuredClone(wire.records.suggest)
        // The reply read a second chapter too (its proposal stays on the first source): re-freeze the edited packet the way the server froze it.
        record.context.packet.sources[2].chapterId='chapter-2'
        record.context.messages[1].content=canonicalJson(record.context.packet)
        record.context.trace.inputEstimate=new TextEncoder().encode(canonicalJson(record.context.messages)).length+64
        const make=(...changes:Record<string,unknown>[])=>({...record,result:{...record.result,structure:changes}})
        const ok=(...changes:Record<string,unknown>[])=>verifyNovelAssistantRecord(make(...changes),index.id,executionId)
        const merge={kind:'merge_chapters',chapterId:'chapter-1',otherChapterId:'chapter-2',reason:'One movement.'}
        const move={kind:'move_chapter',chapterId:'chapter-2',partId:null,beforeChapterId:'chapter-1',reason:'Open on the letter.'}
        const fresh={kind:'new_chapter',chapterId:'chapter-1',partId:null,title:'The Storm',sceneIds:['scene-1','scene-0'],reason:'A turn.'}
        const split={kind:'split_chapter',chapterId:'chapter-1',sceneId:'scene-1',revision:1,title:'After',reason:'Two halves.'}
        expect(ok(merge,move,fresh,split,{...move,beforeChapterId:null})).toBe(true)
        for(const patch of [{otherChapterId:'chapter-1'},{otherChapterId:'chapter-9'},{chapterId:'chapter-9'},{sceneId:'scene-0'}])expect(ok({...merge,...patch})).toBe(false)
        for(const patch of [{partId:'part-1'},{beforeChapterId:'chapter-2'},{beforeChapterId:'chapter-9'},{beforeChapterId:null,partId:'part-1'}])expect(ok({...move,...patch})).toBe(false)
        for(const patch of [{sceneIds:[]},{sceneIds:['scene-1','scene-1']},{sceneIds:['outside']},{title:' '},{partId:'part-1'},{chapterId:'chapter-9'},{sceneIds:Array.from({length:21},(_,i)=>'scene-'+i)}])
            expect(ok({...fresh,...patch})).toBe(false)
        // The scene must be in the chapter it splits, at its saved revision.
        for(const patch of [{sceneId:'scene-0'},{revision:4},{title:''},{beforeSceneId:'scene-1'}])expect(ok({...split,...patch})).toBe(false)
        // A new part names a packet chapter, the part that chapter is in, and a title.
        const part={kind:'new_part',chapterId:'chapter-2',partId:null,title:'Book Two',reason:'A new movement.'}
        expect(ok(part,{...part,chapterId:'chapter-1',title:'Book One'})).toBe(true)
        for(const patch of [{partId:'part-1'},{chapterId:'chapter-9'},{title:' '},{title:'x'.repeat(256)},{sceneIds:['scene-1']}])expect(ok({...part,...patch})).toBe(false)
    })

    it('accepts a count of proposed outline changes left out, with or without kept ones, within what one reply holds',()=>{
        const record=structuredClone(wire.records.suggest)
        const move={kind:'move_scene',sceneId:'scene-1',revision:1,chapterId:'chapter-1',beforeSceneId:null,reason:'Later.'}
        const ok=(result:Record<string,unknown>)=>verifyNovelAssistantRecord({...record,result:{...record.result,...result}},index.id,executionId)
        expect(ok({structureOmitted:1})).toBe(true)
        expect(ok({structure:[move],structureOmitted:5})).toBe(true)
        for(const structureOmitted of [0,-1,1.5,'1',null,7])expect(ok({structureOmitted})).toBe(false)
        expect(ok({structure:[move],structureOmitted:6})).toBe(false)
    })
})
