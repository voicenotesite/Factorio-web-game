import type {
  PlayerState, Research, BuildQueueItem, Tile,
} from './primitives'
import type { Building, ConveyorState, NPC, Enemy, EnemySpawner, Particle, WorldEvent } from './entities'
import type { ChunkKey } from './branded'

export interface GameState {
  player: PlayerState
  camera: { x: number; y: number; zoom: number }
  chunks: Map<ChunkKey, Tile[][]>
  buildings: Map<string, Building>
  npcs: Map<string, NPC>
  enemies: Map<string, Enemy>
  spawners: Map<string, EnemySpawner>
  conveyors: Map<string, ConveyorState[]>
  particles: Particle[]
  events: WorldEvent[]
  research: Map<string, Research>
  tick: number
  pollution: number
  totalPollutionGenerated: number
  evolution: number
  powerGrid: Map<string, { production: number; consumption: number; stored: number }>
  dayTime: number
  dayLength: number
  weather: 'clear' | 'rain' | 'storm' | 'fog'
  weatherTimer: number
  statistics: {
    itemsProduced: Record<string, number>
    itemsConsumed: Record<string, number>
    enemiesKilled: number
    buildingsPlaced: number
    timePlayed: number
  }
  notifications: { text: string; timer: number; type?: 'info' | 'error' | 'success' | 'build' }[]
  buildQueue: BuildQueueItem[]
  worldSeed: number
  coopVisitors?: Map<string, { username: string; x: number; y: number; color: string }>
}

export function createInitialGameState(): GameState {
  return {
    player: {
      x: 0, y: 0, health: 100, maxHealth: 100,
      inventory: [], selectedSlot: 0, direction: 'down',
      speed: 3, reach: 4, miningSpeed: 1, craftingSpeed: 1,
      xp: 0, level: 1, premiumCurrency: 0, gems: 0, premiumBalance: 0,
      premiumTier: 'free',
      cosmetics: { skinColor: '#4a90d9', hatType: 'none', trailEffect: 'none' },
      achievements: [], totalPlayTime: 0,
    },
    camera: { x: 0, y: 0, zoom: 1 },
    chunks: new Map(),
    buildings: new Map(),
    npcs: new Map(),
    enemies: new Map(),
    spawners: new Map(),
    conveyors: new Map(),
    particles: [],
    events: [],
    research: new Map(),
    tick: 0,
    pollution: 0,
    totalPollutionGenerated: 0,
    evolution: 0,
    powerGrid: new Map(),
    dayTime: 0,
    dayLength: 2400,
    weather: 'clear',
    weatherTimer: 0,
    statistics: { itemsProduced: {}, itemsConsumed: {}, enemiesKilled: 0, buildingsPlaced: 0, timePlayed: 0 },
    notifications: [],
    buildQueue: [],
    worldSeed: 0,
  }
}
