export type Character = {
  name: string
  race: string
  stats: Record<string, string>
}

export type World = {
  name: string
  type: string
  details: Record<string, string>
}

export type Adventure = {
  scenario: string
  characters: Character[]
  worlds: World[]
}