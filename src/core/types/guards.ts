import type { Building, NPC, Enemy, EnemySpawner, Particle } from './entities'
import type { InventorySlot } from './primitives'
import type { GameState } from './game'

export function isBuilding(value: unknown): value is Building {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  return typeof b.id === 'string'
    && typeof b.type === 'string'
    && typeof b.x === 'number'
    && typeof b.y === 'number'
    && typeof b.health === 'number'
}

export function isNPC(value: unknown): value is NPC {
  if (!value || typeof value !== 'object') return false
  const n = value as Record<string, unknown>
  return typeof n.id === 'string'
    && typeof n.type === 'string'
    && typeof n.x === 'number'
    && typeof n.y === 'number'
    && typeof n.health === 'number'
}

export function isEnemy(value: unknown): value is Enemy {
  if (!value || typeof value !== 'object') return false
  const e = value as Record<string, unknown>
  return typeof e.id === 'string'
    && typeof e.type === 'string'
    && typeof e.x === 'number'
    && typeof e.y === 'number'
    && typeof e.health === 'number'
    && typeof e.attack === 'number'
}

export function isEnemySpawner(value: unknown): value is EnemySpawner {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.id === 'string'
    && typeof s.x === 'number'
    && typeof s.y === 'number'
    && typeof s.health === 'number'
    && typeof s.spawnTimer === 'number'
}

export function isParticle(value: unknown): value is Particle {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return typeof p.x === 'number' && typeof p.y === 'number'
    && typeof p.vx === 'number' && typeof p.vy === 'number'
    && typeof p.life === 'number' && typeof p.maxLife === 'number'
}

export function isInventorySlot(value: unknown): value is InventorySlot {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.itemId === 'string' && typeof s.count === 'number'
}

export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  return typeof g.tick === 'number'
    && typeof g.pollution === 'number'
    && typeof g.totalPollutionGenerated === 'number'
    && g.chunks instanceof Map
    && g.buildings instanceof Map
    && g.player !== undefined
}
