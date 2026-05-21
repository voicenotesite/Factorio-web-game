import { SimplexNoise } from './noise';
import { Tile, BiomeType, ResourceType } from './types';
import { BIOME_COLORS, CHUNK_SIZE } from './constants';

/** Instancje SimplexNoise dla różnych warstw generacji świata (biom, surowce, wilgotność, wysokość, żyły, drzewa, wydajność). */
let biomeNoise = new SimplexNoise(42);
let resourceNoise = new SimplexNoise(43);
let moistureNoise = new SimplexNoise(44);
let heightNoise = new SimplexNoise(45);
let veinNoise = new SimplexNoise(46);
let treeNoise = new SimplexNoise(47);
let yieldNoise = new SimplexNoise(48);

/**
 * Inicjalizuje seed świata — tworzy wszystkie instancje SimplexNoise z seedem.
 * Wywoływane przed startem gry i przy ładowaniu zapisu.
 */
export function initWorldSeed(seed: number) {
  biomeNoise = new SimplexNoise(seed);
  resourceNoise = new SimplexNoise(seed + 1);
  moistureNoise = new SimplexNoise(seed + 2);
  heightNoise = new SimplexNoise(seed + 3);
  veinNoise = new SimplexNoise(seed + 4);
  treeNoise = new SimplexNoise(seed + 5);
  yieldNoise = new SimplexNoise(seed + 6);
}

function getBiome(x: number, y: number): BiomeType {
  const moisture = moistureNoise.octave2D(x * 0.005, y * 0.005, 4, 0.5);
  const height = heightNoise.octave2D(x * 0.003, y * 0.003, 3, 0.5);
  const temp = biomeNoise.octave2D(x * 0.004, y * 0.004, 3, 0.5);

  if (height < -0.3) return 'swamp';
  if (temp > 0.4 && moisture < -0.2) return 'desert';
  if (temp < -0.4) return 'snow';
  if (height > 0.5) return 'volcanic';
  if (moisture > 0.3) return 'forest';
  return 'grass';
}

function getYield(x: number, y: number): Tile['resourceYield'] {
  const v = yieldNoise.noise2D(x * 0.015, y * 0.015);
  if (v > 0.55) return 'very_rich';
  if (v > 0.25) return 'rich';
  if (v > -0.3) return 'normal';
  return 'depleted';
}

function getYieldMultiplier(y: Tile['resourceYield']): number {
  switch (y) {
    case 'very_rich': return 3.0;
    case 'rich': return 2.0;
    case 'normal': return 1.0;
    case 'depleted': return 0.4;
  }
}

function getResource(x: number, y: number, biome: BiomeType): { resource: ResourceType | null; amount: number; yield: Tile['resourceYield'] } {
  const v1 = resourceNoise.octave2D(x * 0.02, y * 0.02, 3, 0.5);
  const v2 = veinNoise.noise2D(x * 0.05, y * 0.05);
  const v3 = resourceNoise.noise2D(x * 0.1, y * 0.1);
  const yieldTier = getYield(x, y);
  const yieldMult = getYieldMultiplier(yieldTier);

  // Biome-specific deposits — rare, tight clusters
  if (v1 > 0.65 && v2 > 0.55) {
    const baseAmount = Math.floor(300 + v3 * 400);
    const amount = Math.floor(baseAmount * yieldMult);
    switch (biome) {
      case 'desert': return { resource: 'stone', amount, yield: yieldTier };
      case 'volcanic': return { resource: 'uranium', amount: Math.floor(amount * 0.3), yield: yieldTier };
      case 'forest': return { resource: 'wood', amount: amount * 2, yield: yieldTier };
      case 'swamp': return { resource: 'oil', amount: Math.floor(amount * 0.5), yield: yieldTier };
      default: break;
    }
  }

  // Iron deposits — most common, but only in clear patches
  if (v1 > 0.55 && v2 > 0.45) {
    return { resource: 'iron', amount: Math.floor((300 + v1 * 500) * yieldMult), yield: yieldTier };
  }

  // Copper deposits — more common than iron
  if (v1 > 0.40 && v2 < -0.30) {
    return { resource: 'copper', amount: Math.floor((300 + v1 * 500) * yieldMult), yield: yieldTier };
  }

  // Coal deposits
  if (v1 < -0.52 && v2 > 0.48) {
    return { resource: 'coal', amount: Math.floor((200 + Math.abs(v1) * 350) * yieldMult), yield: yieldTier };
  }

  // Stone patches
  if (v1 < -0.58 && v2 < -0.52) {
    return { resource: 'stone', amount: Math.floor((400 + Math.abs(v1) * 300) * yieldMult), yield: yieldTier };
  }

  // Water in low areas
  if (heightNoise.octave2D(x * 0.008, y * 0.008, 2, 0.5) < -0.5) {
    return { resource: 'water', amount: 9999, yield: 'normal' };
  }

  return { resource: null, amount: 0, yield: 'normal' };
}

/** Generuje chunk (16×16 tile'i) na podstawie pozycji chunka i seedu świata. Uwzględnia biom, surowce, drzewa i wydajność. */
export function generateChunk(cx: number, cy: number): Tile[][] {
  const tiles: Tile[][] = [];
  const startX = cx * CHUNK_SIZE;
  const startY = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    tiles[ly] = [];
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = startX + lx;
      const wy = startY + ly;
      const biome = getBiome(wx, wy);
      const { resource, amount, yield: resourceYield } = getResource(wx, wy, biome);

      tiles[ly][lx] = {
        x: wx,
        y: wy,
        biome,
        resource,
        resourceAmount: amount,
        resourceYield,
        building: null,
        pollution: 0,
        visibility: 0,
      };
    }
  }

  return tiles;
}

/** Zwraca klucz string dla pary współrzędnych chunka (używany w Map). */
export function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Zwraca kolor kafelka w zależności od biomu, surowca i pory dnia (dayFactor). */
export function getTileColor(tile: Tile, dayFactor: number): string {
  const base = BIOME_COLORS[tile.biome] || '#4a7c3f';
  if (tile.resource === 'water') return '#2855a0';

  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);

  const factor = 0.4 + dayFactor * 0.6;
  const nr = Math.floor(r * factor);
  const ng = Math.floor(g * factor);
  const nb = Math.floor(b * factor);

  return `rgb(${nr},${ng},${nb})`;
}

/** Sprawdza czy na podanej pozycji rośnie drzewo (zależne od biomu i noise drzew). */
export function hasTreeAt(x: number, y: number, biome: BiomeType): boolean {
  if (biome !== 'forest' && biome !== 'grass') return false;
  const v = treeNoise.noise2D(x * 0.3, y * 0.3);
  return v > 0.6;
}

/** Zwraca szansę spawnu wroga w chunku — zależna od pollution, evolution i odległości od spawn point. */
export function getEnemySpawnChance(cx: number, cy: number, pollution: number, evolution: number): number {
  const dist = Math.sqrt(cx * cx + cy * cy);
  const baseChance = 0.001 * (1 + dist * 0.01);
  return baseChance * (1 + pollution * 0.01) * (1 + evolution);
}

/** Zwraca kolor paska wydajności surowca (zielony = wysoka, czerwony = niska). */
export function getYieldColor(yieldLevel: Tile['resourceYield']): string {
  switch (yieldLevel) {
    case 'very_rich': return '#ff4444';
    case 'rich': return '#ffaa00';
    case 'normal': return '#ffffff';
    case 'depleted': return '#666666';
  }
}
