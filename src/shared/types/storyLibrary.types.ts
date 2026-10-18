export interface StoryLibraryFilters {
    searchIn?:'all'|'title'|'manuscript'|'metadata'
    sort?:'updated_desc'|'updated_asc'|'created_desc'|'created_asc'|'title_asc'|'title_desc'|'words_asc'|'words_desc'
    status?:'draft'|'revising'|'complete'|'archived'
    genre?:string
    language?:string
    audience?:string
    tag?:string
    updatedFrom?:string
    updatedThrough?:string
    includeArchivedSections?:boolean
    minWords?:number
    maxWords?:number
}
