/** Editable planning metadata. A template contains no manuscript or stored identities. */
export interface StoryTemplateDefaults {
    language?:string|null
    genre?:string|null
    audience?:string|null
    narrator?:string|null
    tense?:string|null
    styleGuide?:string|null
}
export interface StoryTemplateUnitDetails {
    synopsis?:string|null
    narrator?:string|null
    tense?:string|null
    narrativeTime?:string|null
    plotThreads?:string[]|null
    tags?: string[] | null
    plannedBeats?: string[] | null
    notes?:string|null
    includeInAI?:boolean|null
    includeInExport?:boolean|null
}
export interface StoryTemplateUnit {
    title:string
    status?:'draft'|'revising'|'complete'|null
    wordGoal?:number|null
    details?:StoryTemplateUnitDetails
}
export interface StoryTemplateChapter extends StoryTemplateUnit {
    partIndex?:number|null
    scenes:StoryTemplateUnit[]
}
export interface StoryWritingTemplate {
    schemaVersion:1
    key:string
    version:number
    name:string
    defaults?:StoryTemplateDefaults
    parts?:StoryTemplateUnit[]
    chapters:StoryTemplateChapter[]
}
