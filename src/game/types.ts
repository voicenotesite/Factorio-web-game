export type ResourceType = 'iron' | 'copper' | 'coal' | 'stone' | 'wood' | 'oil' | 'water' | 'uranium';
export type BuildingType = 'miner' | 'furnace' | 'assembler' | 'conveyor' | 'inserter' | 'storage' | 'power_pole' | 'steam_engine' | 'boiler' | 'lab' | 'radar' | 'turret' | 'wall' | 'belt_junction' | 'splitter' | 'underground_belt' | 'pumpjack' | 'refinery' | 'chemical_plant' | 'pipe';
export type NPCType = 'worker' | 'scout' | 'trader' | 'guard' | 'settler';
export type EnemyType = 'biter' | 'spitter' | 'worm' | 'behemoth' | 'spawner';
export type BiomeType = 'grass' | 'desert' | 'snow' | 'forest' | 'swamp' | 'volcanic';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type ItemId = string;

export interface Position {
  x: number;
  y: number;
}

export interface ChunkCoord {
  cx: number;
  cy: number;
}

export interface Tile {
  x: number;
  y: number;
  biome: BiomeType;
  resource: ResourceType | null;
  resourceAmount: number;
  resourceYield: 'depleted' | 'normal' | 'rich' | 'very_rich';
  building: Building | null;
  pollution: number;
  visibility: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  direction: Direction;
  health: number;
  maxHealth: number;
  recipe: Recipe | null;
  progress: number;
  energy: number;
  maxEnergy: number;
  inventory: InventorySlot[];
  outputInventory: InventorySlot[];
  isActive: boolean;
  level: number;
}

export interface InventorySlot {
  itemId: ItemId;
  count: number;
}

export interface Recipe {
  id: string;
  name: string;
  inputs: InventorySlot[];
  outputs: InventorySlot[];
  craftTime: number;
  energyCost: number;
  category: string;
}

export interface ConveyorState {
  itemId: ItemId | null;
  progress: number;
  direction: Direction;
}

export interface NPC {
  id: string;
  type: NPCType;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  health: number;
  maxHealth: number;
  speed: number;
  state: 'idle' | 'moving' | 'working' | 'building' | 'fleeing' | 'trading' | 'patrolling' | 'gathering';
  inventory: InventorySlot[];
  homeX: number;
  homeY: number;
  name: string;
  faction: string;
  dialogue: string[];
  taskTimer: number;
  path: Position[];
  pathIndex: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  attack: number;
  speed: number;
  range: number;
  target: Position | null;
  evolution: number;
  state: 'idle' | 'moving' | 'attacking' | 'dying';
  attackCooldown: number;
  spawnerId: string | null;
}

export interface EnemySpawner {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  spawnTimer: number;
  spawnRate: number;
  evolution: number;
  enemies: string[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'smoke' | 'spark' | 'fire' | 'resource' | 'explosion' | 'ambient';
}

export interface WorldEvent {
  id: string;
  type: 'meteor' | 'raid' | 'migration' | 'discovery' | 'trade_caravan' | 'earthquake' | 'resource_vein';
  x: number;
  y: number;
  timer: number;
  data: Record<string, unknown>;
}

export interface Research {
  id: string;
  name: string;
  description: string;
  cost: InventorySlot[];
  time: number;
  prerequisites: string[];
  unlocked: boolean;
  progress: number;
  effects: Record<string, number>;
}

export interface PlayerState {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  inventory: InventorySlot[];
  selectedSlot: number;
  direction: Direction;
  speed: number;
  reach: number;
  miningSpeed: number;
  craftingSpeed: number;
  xp: number;
  level: number;
  premiumCurrency: number;
  gems: number;
  premiumBalance: number;
  premiumTier: 'free' | 'starter' | 'premium';
  cosmetics: { skinColor: string; hatType: string; trailEffect: string };
  achievements: string[];
  totalPlayTime: number;
}

export interface BuildQueueItem {
  id: string;
  type: string;
  x: number;
  y: number;
  direction: Direction;
  assignedNpcId?: string;
  constructionProgress: number; // 0..100
}

export interface GameState {
  player: PlayerState;
  camera: { x: number; y: number; zoom: number };
  chunks: Map<string, Tile[][]>;
  buildings: Map<string, Building>;
  npcs: Map<string, NPC>;
  enemies: Map<string, Enemy>;
  spawners: Map<string, EnemySpawner>;
  conveyors: Map<string, ConveyorState[]>;
  particles: Particle[];
  events: WorldEvent[];
  research: Map<string, Research>;
  tick: number;
  pollution: number;
  evolution: number;
  powerGrid: Map<string, { production: number; consumption: number; stored: number }>;
  dayTime: number;
  dayLength: number;
  weather: 'clear' | 'rain' | 'storm' | 'fog';
  weatherTimer: number;
  statistics: {
    itemsProduced: Record<string, number>;
    itemsConsumed: Record<string, number>;
    enemiesKilled: number;
    buildingsPlaced: number;
    timePlayed: number;
  };
  notifications: { text: string; timer: number; type?: 'info' | 'error' | 'success' | 'build' }[];
  buildQueue: BuildQueueItem[];
  worldSeed: number;
}
