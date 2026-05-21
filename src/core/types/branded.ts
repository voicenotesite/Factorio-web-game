declare const BRAND_CHUNK_KEY: unique symbol
declare const BRAND_GAME_TICK: unique symbol
declare const BRAND_BUILDING_ID: unique symbol
declare const BRAND_ENTITY_ID: unique symbol

export type ChunkKey = string & { readonly [BRAND_CHUNK_KEY]: true }
export type GameTick = number & { readonly [BRAND_GAME_TICK]: true }
export type BuildingId = string & { readonly [BRAND_BUILDING_ID]: true }
export type EntityId = string & { readonly [BRAND_ENTITY_ID]: true }

export function toChunkKey(cx: number, cy: number): ChunkKey {
  return `${cx},${cy}` as ChunkKey
}

export function parseChunkKey(key: ChunkKey): { cx: number; cy: number } {
  const parts = key.split(',')
  return { cx: parseInt(parts[0], 10), cy: parseInt(parts[1], 10) }
}

export function isChunkKey(value: string): value is ChunkKey {
  return /^-?\d+,-?\d+$/.test(value)
}
