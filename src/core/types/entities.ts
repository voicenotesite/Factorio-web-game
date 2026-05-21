import type { Direction, Position, InventorySlot, NPCType, EnemyType, Recipe } from './primitives'

export interface Building {
  id: string
  type: string
  x: number
  y: number
  direction: Direction
  health: number
  maxHealth: number
  recipe: Recipe | null
  progress: number
  energy: number
  maxEnergy: number
  inventory: InventorySlot[]
  outputInventory: InventorySlot[]
  isActive: boolean
  level: number
}

export interface ConveyorState {
  itemId: string | null
  progress: number
  direction: Direction
}

export interface NPC {
  id: string
  type: NPCType
  x: number
  y: number
  targetX: number
  targetY: number
  health: number
  maxHealth: number
  speed: number
  state: 'idle' | 'moving' | 'working' | 'building' | 'fleeing' | 'trading' | 'patrolling' | 'gathering'
  inventory: InventorySlot[]
  homeX: number
  homeY: number
  name: string
  faction: string
  dialogue: string[]
  taskTimer: number
  path: Position[]
  pathIndex: number
}

export interface Enemy {
  id: string
  type: EnemyType
  x: number
  y: number
  health: number
  maxHealth: number
  attack: number
  speed: number
  range: number
  target: Position | null
  evolution: number
  state: 'idle' | 'moving' | 'attacking' | 'dying'
  attackCooldown: number
  spawnerId: string | null
}

export interface EnemySpawner {
  id: string
  x: number
  y: number
  health: number
  maxHealth: number
  spawnTimer: number
  spawnRate: number
  evolution: number
  enemies: string[]
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  type: 'smoke' | 'spark' | 'fire' | 'resource' | 'explosion' | 'ambient'
}

export interface WorldEvent {
  id: string
  type: 'meteor' | 'raid' | 'migration' | 'discovery' | 'trade_caravan' | 'earthquake' | 'resource_vein'
  x: number
  y: number
  timer: number
  data: Record<string, unknown>
}
