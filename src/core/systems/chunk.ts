import { GameState } from '../../game/types'
import { CHUNK_SIZE, BUILDING_SIZES } from '../../game/constants'
import { getChunkKey, generateChunk } from '../../game/world'

let nextId = 1
export function genId(): string { return `${nextId++}` }

export function getChunkAt(state: GameState, tx: number, ty: number) {
  const cx = Math.floor(tx / CHUNK_SIZE)
  const cy = Math.floor(ty / CHUNK_SIZE)
  const key = getChunkKey(cx, cy)
  let chunk = state.chunks.get(key)
  if (!chunk) {
    chunk = generateChunk(cx, cy)
    state.chunks.set(key, chunk)
    for (const [, building] of state.buildings) {
      const b = building
      const size = BUILDING_SIZES[b.type] || { w: 1, h: 1 }
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          const bx = b.x + dx, by = b.y + dy
          if (Math.floor(bx / CHUNK_SIZE) === cx && Math.floor(by / CHUNK_SIZE) === cy) {
            const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const ly = ((by % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            chunk[ly][lx].building = b
          }
        }
      }
    }
  }
  return chunk
}

export function getTileAt(state: GameState, tx: number, ty: number) {
  const chunk = getChunkAt(state, tx, ty)
  const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return chunk[ly][lx]
}
