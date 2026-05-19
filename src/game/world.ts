import { SimplexNoise } from './noise';
import { Tile, BiomeType, ResourceType } from './types';
import { BIOME_COLORS, CHUNK_SIZE } from './constants';

/** Generator szumu dla biomów (temperatura). */
let biomeNoise = new SimplexNoise(42);
/** Generator szumu dla zasobów (ruda). */
let resourceNoise = new SimplexNoise(43);
/** Generator szumu dla wilgotności. */
let moistureNoise = new SimplexNoise(44);
/** Generator szumu dla wysokości terenu. */
let heightNoise = new SimplexNoise(45);
/** Generator szumu dla żył surowcowych. */
let veinNoise = new SimplexNoise(46);
/** Generator szumu dla drzew. */
let treeNoise = new SimplexNoise(47);
/** Generator szumu dla wydajności złóż. */
let yieldNoise = new SimplexNoise(48);

/**
 * Inicjalizuje wszystkie generatory szumu nowym seedem.
 * Każdy generator ma przesunięty seed o +1, +2, ... +6 dla różnorodności.
 * @param seed Bazowy seed świata.
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

/**
 * Określa biom kafelka na podstawie wilgotności, wysokości i temperatury.
 * Kolejność warunków: swamp (nisko), desert (sucho + ciepło), snow (zimno),
 * volcanic (wysoko), forest (wilgotno), grass (domyślny).
 * @param x Współrzędna X kafelka.
 * @param y Współrzędna Y kafelka.
 * @returns Typ biomu.
 */
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

/**
 * Określa poziom wydajności złoża na podstawie szumu.
 * @param x Współrzędna X.
 * @param y Współrzędna Y.
 * @returns Poziom wydajności (very_rich, rich, normal, depleted).
 */
function getYield(x: number, y: number): Tile['resourceYield'] {
  const v = yieldNoise.noise2D(x * 0.015, y * 0.015);
  if (v > 0.55) return 'very_rich';
  if (v > 0.25) return 'rich';
  if (v > -0.3) return 'normal';
  return 'depleted';
}

/**
 * Zwraca mnożnik ilości surowca dla danego poziomu wydajności.
 * @param y Poziom wydajności.
 * @returns Mnożnik (3.0 dla very_rich, 2.0 dla rich, 1.0 normal, 0.4 depleted).
 */
function getYieldMultiplier(y: Tile['resourceYield']): number {
  switch (y) {
    case 'very_rich': return 3.0;
    case 'rich': return 2.0;
    case 'normal': return 1.0;
    case 'depleted': return 0.4;
  }
}

/**
 * Generuje surowiec na pozycji (x,y) dla danego biomu.
 * Używa trzech pasm szumu (resourceNoise, veinNoise) do tworzenia skupisk.
 * Kolejność priorytetów: biomy specjalne → żelazo → miedź → węgiel → kamień → woda.
 * @param x Współrzędna X.
 * @param y Współrzędna Y.
 * @param biome Biom kafelka.
 * @returns Obiekt z typem surowca (lub null), ilością i wydajnością.
 */
function getResource(x: number, y: number, biome: BiomeType): { resource: ResourceType | null; amount: number; yield: Tile['resourceYield'] } {
  const v1 = resourceNoise.octave2D(x * 0.02, y * 0.02, 3, 0.5);
  const v2 = veinNoise.noise2D(x * 0.05, y * 0.05);
  const v3 = resourceNoise.noise2D(x * 0.1, y * 0.1);
  const yieldTier = getYield(x, y);
  const yieldMult = getYieldMultiplier(yieldTier);

  // Złoża specyficzne dla biomów – rzadkie, skupione
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

  // Żelazo – najczęstsze
  if (v1 > 0.55 && v2 > 0.45) {
    return { resource: 'iron', amount: Math.floor((300 + v1 * 500) * yieldMult), yield: yieldTier };
  }

  // Miedź – częstsza niż żelazo
  if (v1 > 0.40 && v2 < -0.30) {
    return { resource: 'copper', amount: Math.floor((300 + v1 * 500) * yieldMult), yield: yieldTier };
  }

  // Węgiel
  if (v1 < -0.52 && v2 > 0.48) {
    return { resource: 'coal', amount: Math.floor((200 + Math.abs(v1) * 350) * yieldMult), yield: yieldTier };
  }

  // Kamień
  if (v1 < -0.58 && v2 < -0.52) {
    return { resource: 'stone', amount: Math.floor((400 + Math.abs(v1) * 300) * yieldMult), yield: yieldTier };
  }

  // Woda w nisko położonych obszarach
  if (heightNoise.octave2D(x * 0.008, y * 0.008, 2, 0.5) < -0.5) {
    return { resource: 'water', amount: 9999, yield: 'normal' };
  }

  return { resource: null, amount: 0, yield: 'normal' };
}

/**
 * Generuje dwuwymiarową tablicę kafelków dla chunka (cx, cy).
 * Każdy kafelek ma biome, surowiec (z wydajnością), brak budynku i zero
 * zanieczyszczenia.
 * @param cx Współrzędna X chunka.
 * @param cy Współrzędna Y chunka.
 * @returns Tablica CHUNK_SIZE x CHUNK_SIZE kafelków.
 */
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

/**
 * Zwraca klucz stringowy dla chunka w formacie "cx,cy".
 * @param cx Współrzędna X chunka.
 * @param cy Współrzędna Y chunka.
 * @returns Klucz w formacie `${cx},${cy}`.
 */
export function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/**
 * Zwraca kolor kafelka na podstawie biomu i pory dnia.
 * Dla wody zwraca niebieski niezależnie od dnia.
 * @param tile Kafelek.
 * @param dayFactor Współczynnik dnia (0.25–1.0).
 * @returns Kolor w formacie rgb(r,g,b).
 */
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

/**
 * Sprawdza, czy na pozycji (x,y) w danym biomie rośnie drzewo.
 * Drzewa występują tylko w forest i grass.
 * @param x Współrzędna X kafelka.
 * @param y Współrzędna Y kafelka.
 * @param biome Typ biomu.
 * @returns True jeśli jest drzewo.
 */
export function hasTreeAt(x: number, y: number, biome: BiomeType): boolean {
  if (biome !== 'forest' && biome !== 'grass') return false;
  const v = treeNoise.noise2D(x * 0.3, y * 0.3);
  return v > 0.6;
}

/**
 * Oblicza szansę spawnu wroga w chunku na podstawie odległości od centrum,
 * zanieczyszczenia i ewolucji.
 * @param cx Współrzędna X chunka.
 * @param cy Współrzędna Y chunka.
 * @param pollution Poziom zanieczyszczenia w chunku.
 * @param evolution Poziom ewolucji (0–1).
 * @returns Prawdopodobieństwo spawnu (0–1).
 */
export function getEnemySpawnChance(cx: number, cy: number, pollution: number, evolution: number): number {
  const dist = Math.sqrt(cx * cx + cy * cy);
  const baseChance = 0.001 * (1 + dist * 0.01);
  return baseChance * (1 + pollution * 0.01) * (1 + evolution);
}

/**
 * Zwraca kolor wskaźnika wydajności złoża.
 * @param yieldLevel Poziom wydajności.
 * @returns Kolor hex (np. #ff4444 dla very_rich).
 */
export function getYieldColor(yieldLevel: Tile['resourceYield']): string {
  switch (yieldLevel) {
    case 'very_rich': return '#ff4444';
    case 'rich': return '#ffaa00';
    case 'normal': return '#ffffff';
    case 'depleted': return '#666666';
  }
}
