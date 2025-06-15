export type Character = {
  id: string
  name: string
  race: string
  stats: Record<string, string>
}

export type World = {
  id: string
  name: string
  type: string
  details: Record<string, string>
}

export type Adventure = {
  id: string
  scenario: string
  characters: Character[]
  worlds: World[]
}