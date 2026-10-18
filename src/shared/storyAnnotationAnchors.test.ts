import { expect,it } from 'vitest'
import { manuscript,storyScene } from '@/test/fixtures/story'
import { noteAnchor } from '@/test/fixtures/storyAnnotations'
import { identifyDocument,documentText } from './storyDocument'
import { annotationContext,resolveAnnotationRange } from './storyAnnotationAnchors'

it('resolves the identified occurrence rather than searching for a repeated quote',()=>{
    const document=identifyDocument({type:'doc',content:[{type:'paragraph',attrs:{nodeId:'first'},content:[{type:'text',text:'Echo.'}]},{type:'paragraph',attrs:{nodeId:'second'},content:[{type:'text',text:'Echo.'}]}]})
    const scene=storyScene({revision:3,contentHash:'c'.repeat(64),document}),anchor=noteAnchor({start:{nodeId:'second',offset:0},end:{nodeId:'second',offset:4},quote:'Echo'})
    expect(resolveAnnotationRange(scene,anchor)).toEqual({startOffset:7,endOffset:11,text:'Echo'})
    expect(resolveAnnotationRange(scene,{...anchor,start:{nodeId:'missing',offset:0}})).toBeNull()
    expect(resolveAnnotationRange({...scene,revision:4},anchor)).toBeNull()
    expect(resolveAnnotationRange({...scene,contentHash:'d'.repeat(64)},anchor)).toBeNull()
})
it('uses exact nested-list separators and refuses offsets inside mentions and surrogate pairs',()=>{
    const document=identifyDocument({type:'doc',content:[{type:'blockquote',content:[{type:'bulletList',content:[
        {type:'listItem',content:[{type:'paragraph',attrs:{nodeId:'one'},content:[{type:'text',text:'A🌒B'}]}]},
        {type:'listItem',content:[{type:'paragraph',attrs:{nodeId:'two'},content:[{type:'codexMention',attrs:{id:'mira',label:'Mira'}},{type:'text',text:' waits.'}]}]},
    ]}]}]})
    const scene=storyScene({revision:3,contentHash:'c'.repeat(64),document})
    const anchor=noteAnchor({start:{nodeId:'one',offset:1},end:{nodeId:'two',offset:5},quote:'🌒B\n@Mira'})
    expect(documentText(document)).toBe('A🌒B\n@Mira waits.')
    expect(resolveAnnotationRange(scene,anchor)).toEqual({startOffset:1,endOffset:10,text:anchor.quote})
    expect(resolveAnnotationRange(scene,{...anchor,start:{nodeId:'one',offset:2},quote:'\udf12B\n@Mira'})).toBeNull()
    expect(resolveAnnotationRange(scene,{...anchor,end:{nodeId:'two',offset:2},quote:'🌒B\n@M'})).toBeNull()
})
it('rejects a mismatched quote and expands context boundaries to whole Unicode characters',()=>{
    const scene=storyScene({revision:3,contentHash:'c'.repeat(64),document:manuscript('Echo.','one')})
    expect(resolveAnnotationRange(scene,noteAnchor({start:{nodeId:'one',offset:0},end:{nodeId:'one',offset:4},quote:'Other'}))).toBeNull()
    const text='🌒'+'x'.repeat(239)+'Q'+'y'.repeat(239)+'🌒'
    expect(annotationContext(text,{startOffset:241,endOffset:242,text:'Q'})).toEqual({before:'🌒'+'x'.repeat(239),quote:'Q',after:'y'.repeat(239)+'🌒',beforeCut:false,afterCut:false})
})

it('resolves exact bookmark points in empty prose and Unicode text while rejecting invented equal-text locations',()=>{
    for(const [text,offset] of [['',0],['🌒 Echo.',2],['Echo.',5]] as const){
        const scene=storyScene({revision:3,contentHash:'c'.repeat(64),document:manuscript(text,'one')})
        const point=noteAnchor({quote:'',start:{nodeId:'one',offset},end:{nodeId:'one',offset}})
        expect(resolveAnnotationRange(scene,point)).toEqual({startOffset:offset,endOffset:offset,text:''})
        expect(resolveAnnotationRange(scene,{...point,start:{nodeId:'missing',offset}})).toBeNull()
        if(text.startsWith('🌒'))expect(resolveAnnotationRange(scene,{...point,start:{nodeId:'one',offset:1},end:{nodeId:'one',offset:1}})).toBeNull()
    }
})
