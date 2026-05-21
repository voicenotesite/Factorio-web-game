export type Direction = 'up' | 'down' | 'left' | 'right'
export type ResourceType = 'iron' | 'copper' | 'coal' | 'stone' | 'wood' | 'oil' | 'water' | 'uranium'
export type BiomeType = 'grass' | 'desert' | 'snow' | 'forest' | 'swamp' | 'volcanic'
export type BuildingType = 'miner' | 'furnace' | 'assembler' | 'conveyor' | 'inserter' | 'storage' | 'power_pole' | 'steam_engine' | 'boiler' | 'lab' | 'radar' | 'turret' | 'wall' | 'belt_junction' | 'splitter' | 'underground_belt' | 'pumpjack' | 'refinery' | 'chemical_plant' | 'pipe'
export type NPCType = 'worker' | 'scout' | 'trader' | 'guard' | 'settler'
export type EnemyType = 'biter' | 'spitter' | 'worm' | 'behemoth' | 'spawner'
export type WeatherType = 'clear' | 'rain' | 'storm' | 'fog'

export interface Position {
  x: number
  y: number
}

export interface ChunkCoord {
  cx: number
  cy: number
}

export interface InventorySlot {
  itemId: string
  count: number
}

export interface Recipe {
  id: string
  name: string
  inputs: InventorySlot[]
  outputs: InventorySlot[]
  craftTime: number
  energyCost: number
  category: string
}

export interface Tile {
  x: number
  y: number
  biome: BiomeType
  resource: ResourceType | null
  resourceAmount: number
  resourceYield: 'depleted' | 'normal' | 'rich' | 'very_rich'
  building: import('./entities').Building | null
  pollution: number
  visibility: number
}

export interface PlayerState {
  x: number
  y: number
  health: number
  maxHealth: number
  inventory: InventorySlot[]
  selectedSlot: number
  direction: Direction
  speed: number
  reach: number
  miningSpeed: number
  craftingSpeed: number
  xp: number
  level: number
  premiumCurrency: number
  gems: number
  premiumBalance: number
  premiumTier: 'free' | 'starter' | 'premium'
  cosmetics: { skinColor: string; hatType: string; trailEffect: string }
  achievements: string[]
  totalPlayTime: number
}

export interface Research {
  id: string
  name: string
  description: string
  cost: InventorySlot[]
  time: number
  prerequisites: string[]
  unlocked: boolean
  progress: number
  effects: Record<string, number>
}

export interface BuildQueueItem {
  id: string
  type: string
  x: number
  y: number
  direction: Direction
  assignedNpcId?: string
  constructionProgress: number
}
