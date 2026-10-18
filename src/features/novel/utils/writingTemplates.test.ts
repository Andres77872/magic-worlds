import { expect,it } from 'vitest'
import { novelTemplates } from '@/app/i18n/locales/novelTemplates'
import { isStoryWritingTemplate } from '@/shared/storyWritingTemplate'
import { editTemplateUnit,moveTemplateUnit,removeTemplateUnit,templateCounts,templateRows,writingTemplate } from './writingTemplates'
const copy=(key:string)=>novelTemplates.en[key as keyof typeof novelTemplates.en]
it('provides editable plans with no prose, scene identities or copied parent goals',()=>{
    for(const preset of ['short_story','three_acts','custom'] as const){
        const value=writingTemplate(preset,copy)
        expect(isStoryWritingTemplate(value)).toBe(true)
        expect(value.chapters.every((chapter)=>chapter.scenes.every((scene)=>!('document' in scene)&&!('id' in scene)))).toBe(true)
    }
    const original=writingTemplate('three_acts',copy),edited=editTemplateUnit(original,{kind:'part',index:0},{wordGoal:5000})
    expect(original.parts?.[0].wordGoal).toBeUndefined();expect(edited.chapters[0].wordGoal).toBeUndefined();expect(edited.chapters[0].scenes[0].wordGoal).toBeUndefined()
    expect(templateCounts(edited)).toEqual({parts:3,chapters:3,scenes:4})
})
it('reorders parts while preserving chapter ownership and keeps chapter movement within its part',()=>{
    const value=writingTemplate('three_acts',copy),first=value.chapters[0].title
    const moved=moveTemplateUnit(value,{kind:'part',index:0},1)
    expect(moved.value.chapters[0].partIndex).toBe(1)
    expect(moved.value.parts?.[1].title).toBe(value.parts?.[0].title)
    expect(moveTemplateUnit(moved.value,{kind:'chapter',index:0},1).value).toBe(moved.value)
    const rows=templateRows(moved.value)
    expect(rows.findIndex((row)=>row.title===first)).toBeGreaterThan(rows.findIndex((row)=>row.title===value.chapters[1].title))
})
it('removes a part without losing its chapters and repairs every shifted part index',()=>{
    const value=writingTemplate('three_acts',copy),removed=removeTemplateUnit(value,{kind:'part',index:0}).value
    expect(removed.chapters.map((chapter)=>chapter.partIndex)).toEqual([null,0,1])
    expect(removed.chapters).toHaveLength(3);expect(isStoryWritingTemplate(removed)).toBe(true)
    expect(templateRows(removed)[0].title).toBe(value.chapters[0].title)
})
it('preserves at least one chapter and one scene, and follows moved scenes',()=>{
    const value=writingTemplate('short_story',copy)
    expect(removeTemplateUnit(value,{kind:'chapter',index:0}).value).toBe(value)
    const moved=moveTemplateUnit(value,{kind:'scene',chapterIndex:0,index:0},1)
    expect(moved.value.chapters[0].scenes[1]).toEqual(value.chapters[0].scenes[0]);expect(moved.selection.index).toBe(1)
    const single=writingTemplate('custom',copy)
    expect(removeTemplateUnit(single,{kind:'scene',chapterIndex:0,index:0}).value).toBe(single)
})
