import { GameState, Particle, Enemy, NPC, WorldEvent, ResourceType } from '../../game/types'
import { TILE_SIZE, CHUNK_SIZE, MAX_PARTICLES, ENEMY_STATS, NPC_NAMES, NPC_DIALOGUES } from '../../game/constants'
import { genId, getTileAt } from './chunk'

export function spawnParticle(state: GameState, x: number, y: number, type: Particle['type'], color: string) {
  if (state.particles.length >= MAX_PARTICLES) {
    // swap-pop zamiast shift — O(1)
    state.particles[0] = state.particles[state.particles.length - 1]
    state.particles.pop()
  }
  const angle = Math.random() * Math.PI * 2
  const speed = type === 'explosion' ? 3 : type === 'spark' ? 2 : 0.5
  state.particles.push({
    x, y,
    vx: Math.cos(angle) * speed * (0.5 + Math.random()),
    vy: Math.sin(angle) * speed * (0.5 + Math.random()) - (type === 'smoke' ? 1 : 0),
    life: 30 + Math.random() * 30, maxLife: 60, color,
    size: type === 'explosion' ? 4 : type === 'smoke' ? 6 : 2, type,
  })
}

export function updateParticles(state: GameState) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]
    p.x += p.vx; p.y += p.vy
    p.vy += 0.02
    if (p.type === 'smoke') p.vy -= 0.05
    p.life--
    if (p.life <= 0) {
      // swap-pop zamiast splice — O(1) zamiast O(n)
      state.particles[i] = state.particles[state.particles.length - 1]
      state.particles.pop()
    }
  }
}

export function updatePollution(state: GameState) {
  let totalPollution = 0
  for (const [, building] of state.buildings) {
    if (building.type === 'miner' || building.type === 'furnace' || building.type === 'boiler') {
      if (!building.isActive) continue
      const tile = getTileAt(state, building.x, building.y)
      tile.pollution += 0.05
      state.totalPollutionGenerated += 0.05
      totalPollution += tile.pollution
    }
  }

  // Tylko co 5 ticków: decay pollution na wszystkich tile'ach (oszczędza 80% CPU)
  if (state.tick % 5 === 0) {
    for (const [, chunk] of state.chunks) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          chunk[y][x].pollution *= 0.998
        }
      }
    }
  }

  state.pollution = totalPollution
  state.evolution = Math.min(1, state.totalPollutionGenerated * 0.00008)
}

export function updateWeather(state: GameState) {
  state.weatherTimer--
  if (state.weatherTimer <= 0) {
    const weathers: GameState['weather'][] = ['clear', 'clear', 'clear', 'rain', 'storm', 'fog']
    state.weather = weathers[Math.floor(Math.random() * weathers.length)]
    state.weatherTimer = 3000 + Math.random() * 3000
  }
}

export function updateWorldEvents(state: GameState) {
  if (state.tick % 1800 === 0 && Math.random() < 0.3) {
    const types: WorldEvent['type'][] = ['meteor', 'raid', 'trade_caravan', 'resource_vein']
    const type = types[Math.floor(Math.random() * types.length)]
    const angle = Math.random() * Math.PI * 2
    const dist = 20 + Math.random() * 30
    state.events.push({
      id: genId(), type,
      x: Math.floor(state.player.x + Math.cos(angle) * dist),
      y: Math.floor(state.player.y + Math.sin(angle) * dist),
      timer: 600, data: {},
    })
  }

  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i]
    event.timer--

    if (event.type === 'raid' && event.timer === 500) {
      const count = Math.floor(5 + state.evolution * 10)
      for (let j = 0; j < count; j++) {
        const a = Math.random() * Math.PI * 2
        const d = 25 + Math.random() * 10
        const stats = ENEMY_STATS.biter
        const enemy: Enemy = {
          id: genId(), type: 'biter',
          x: event.x + Math.cos(a) * d, y: event.y + Math.sin(a) * d,
          health: stats.health * (1 + state.evolution), maxHealth: stats.health * (1 + state.evolution),
          attack: stats.attack * (1 + state.evolution * 0.5), speed: stats.speed,
          range: stats.range, target: null, evolution: state.evolution,
          state: 'moving', attackCooldown: 0, spawnerId: null,
        }
        state.enemies.set(enemy.id, enemy)
      }
    }

    if (event.type === 'trade_caravan' && event.timer === 400) {
      const npc: NPC = {
        id: genId(), type: 'trader', x: event.x, y: event.y,
        targetX: state.player.x, targetY: state.player.y,
        health: 100, maxHealth: 100, speed: 0.04, state: 'trading',
        inventory: [{ itemId: 'circuit', count: 10 }, { itemId: 'gear', count: 20 }],
        homeX: event.x, homeY: event.y,
        name: 'Merchant ' + NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
        faction: 'traders', dialogue: NPC_DIALOGUES.trader,
        taskTimer: 600, path: [], pathIndex: 0,
      }
      state.npcs.set(npc.id, npc)
    }

    if (event.type === 'resource_vein' && event.timer === 500) {
      const resources: ResourceType[] = ['iron', 'copper', 'coal', 'stone']
      const resource = resources[Math.floor(Math.random() * resources.length)]
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tile = getTileAt(state, event.x + dx, event.y + dy)
          if (!tile.building) {
            tile.resource = resource
            tile.resourceAmount = 500 + Math.random() * 500
          }
        }
      }
    }

    if (event.type === 'meteor' && event.timer === 300) {
      spawnParticle(state, event.x * TILE_SIZE, event.y * TILE_SIZE, 'explosion', '#ff4400')
      const tile = getTileAt(state, event.x, event.y)
      if (!tile.building) {
        tile.resource = 'uranium'
        tile.resourceAmount = 200
      }
    }

    if (event.timer <= 0) state.events.splice(i, 1)
  }
}

export function updateVisibility(state: GameState) {
  const radius = 8
  const px = Math.floor(state.player.x)
  const py = Math.floor(state.player.y)
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const tile = getTileAt(state, px + dx, py + dy)
      tile.visibility = 1
    }
  }
}
