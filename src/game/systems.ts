import {
  GameState, Building, NPC, Enemy, EnemySpawner, Particle,
  ResourceType, WorldEvent, Direction,
} from './types';
import {
  TILE_SIZE, CHUNK_SIZE, RECIPES, BUILDING_HEALTH,
  BUILDING_SIZES, NPC_MAX, ENEMY_MAX, SPAWNER_MAX, MAX_PARTICLES,
  NPC_NAMES, NPC_DIALOGUES, ENEMY_STATS,
  RESOURCE_COLORS,
} from './constants';
import { getChunkKey, generateChunk } from './world';

/**
 * Systemy gry — logika budowania, produkcji, NPC, wrogów, zanieczyszczeń, badań, achievementów.
 * Każda sekcja to niezależny moduł operujący na GameState.
 */

let nextId = 1;
/** Generuje unikalne ID numeryczne dla encji (Building, NPC, Enemy itp.). */
function genId(): string { return `${nextId++}`; }

/** Offsete kierunków (up/down/left/right) w układzie współrzędnych kafelkowych. */
const DIR_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

// ============ BUILDING COSTS ============

const BUILDING_COSTS: Record<string, { itemId: string; count: number }[]> = {
  conveyor:          [{ itemId: 'iron_plate', count: 4 }, { itemId: 'gear', count: 4 }],
  inserter:          [{ itemId: 'iron_plate', count: 5 }, { itemId: 'gear', count: 5 }, { itemId: 'circuit', count: 3 }],
  splitter:          [{ itemId: 'iron_plate', count: 10 }, { itemId: 'gear', count: 8 }],
  underground_belt:  [{ itemId: 'iron_plate', count: 10 }, { itemId: 'gear', count: 8 }],
  miner:             [{ itemId: 'iron_plate', count: 15 }, { itemId: 'gear', count: 12 }, { itemId: 'circuit', count: 5 }],
  furnace:           [{ itemId: 'stone', count: 20 }, { itemId: 'iron_plate', count: 10 }],
  assembler:         [{ itemId: 'iron_plate', count: 15 }, { itemId: 'gear', count: 12 }, { itemId: 'circuit', count: 8 }],
  storage:           [{ itemId: 'iron_plate', count: 12 }, { itemId: 'gear', count: 8 }],
  power_pole:        [{ itemId: 'iron_plate', count: 2 }, { itemId: 'copper_plate', count: 2 }],
  steam_engine:      [{ itemId: 'iron_plate', count: 30 }, { itemId: 'gear', count: 20 }, { itemId: 'copper_plate', count: 10 }],
  boiler:            [{ itemId: 'stone', count: 20 }, { itemId: 'iron_plate', count: 15 }, { itemId: 'copper_plate', count: 8 }],
  lab:               [{ itemId: 'iron_plate', count: 20 }, { itemId: 'gear', count: 15 }, { itemId: 'circuit', count: 12 }],
  radar:             [{ itemId: 'iron_plate', count: 15 }, { itemId: 'gear', count: 10 }, { itemId: 'circuit', count: 8 }],
  turret:            [{ itemId: 'iron_plate', count: 25 }, { itemId: 'gear', count: 20 }, { itemId: 'copper_plate', count: 15 }],
  wall:              [{ itemId: 'stone', count: 8 }],
  belt_junction:     [{ itemId: 'iron_plate', count: 5 }, { itemId: 'gear', count: 5 }],
  pumpjack:          [{ itemId: 'iron_plate', count: 25 }, { itemId: 'gear', count: 20 }, { itemId: 'circuit', count: 10 }],
  refinery:          [{ itemId: 'iron_plate', count: 40 }, { itemId: 'gear', count: 30 }, { itemId: 'circuit', count: 20 }, { itemId: 'steel_plate', count: 10 }],
  chemical_plant:    [{ itemId: 'iron_plate', count: 30 }, { itemId: 'gear', count: 20 }, { itemId: 'circuit', count: 15 }, { itemId: 'steel_plate', count: 8 }],
  pipe:              [{ itemId: 'iron_plate', count: 2 }],
};

/** Zwraca koszt budowli w surowcach (pusta tablica = darmowa). */
export function getBuildingCost(type: string): { itemId: string; count: number }[] {
  return BUILDING_COSTS[type] || [];
}

/** Sprawdza czy gracza stać na postawienie danej budowli. */
export function canAffordBuilding(state: GameState, type: string): boolean {
  const cost = BUILDING_COSTS[type];
  if (!cost) return true;
  return cost.every(c => {
    const slot = state.player.inventory.find(s => s.itemId === c.itemId);
    return slot && slot.count >= c.count;
  });
}

/** Odejmuje koszt budowli z ekwipunku gracza (zwraca false jeśli nie stać). */
export function payBuildingCost(state: GameState, type: string): boolean {
  const cost = BUILDING_COSTS[type];
  if (!cost) return true;
  if (!canAffordBuilding(state, type)) return false;
  for (const c of cost) {
    removeItemFromPlayer(state, c.itemId, c.count);
  }
  return true;
}

// ============ BUILDING SYSTEM ============

/** Tworzy obiekt Building z domyślnymi wartościami (health, recipe=null, level=1). */
export function createBuilding(type: string, x: number, y: number, direction: string): Building {
  const health = BUILDING_HEALTH[type] || 100;
  return {
    id: genId(), type: type as Building['type'], x, y,
    direction: direction as Direction, health, maxHealth: health,
    recipe: null, progress: 0, energy: 0,
    maxEnergy: type === 'steam_engine' ? 100 : type === 'boiler' ? 50 : 0,
    inventory: [], outputInventory: [], isActive: false, level: 1,
  };
}

/**
 * Stawia budowlę na mapie: sprawdza czy area jest wolny, płaci koszt (chyba że skipPayment),
 * rejestruje w state.buildings i state.conveyors (dla przenośników).
 */
export function placeBuilding(state: GameState, type: string, x: number, y: number, direction: string, skipPayment = false): boolean {
  const size = BUILDING_SIZES[type] || { w: 1, h: 1 };

  // Check if area is clear
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      const tx = x + dx, ty = y + dy;
      const chunk = getChunkAt(state, tx, ty);
      if (!chunk) return false;
      const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      if (chunk[ly][lx].building) return false;
    }
  }

  // Pay cost
  if (!skipPayment && !payBuildingCost(state, type)) return false;

  const building = createBuilding(type, x, y, direction);
  state.buildings.set(`${x},${y}`, building);

  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      const tx = x + dx, ty = y + dy;
      const chunk = getChunkAt(state, tx, ty);
      if (chunk) {
        const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk[ly][lx].building = building;
      }
    }
  }

  if (type === 'conveyor') {
    state.conveyors.set(`${x},${y}`, [
      { itemId: null, progress: 0, direction: direction as Direction },
      { itemId: null, progress: 0.5, direction: direction as Direction },
    ]);
  }

  // Pipes don't have conveyor segments, they just exist as connections
  if (type === 'pipe') {
    // Pipe placed - no additional state needed beyond the building itself
  }

  state.statistics.buildingsPlaced++;
  grantXPToPlayer(state, 3);
  return true;
}

/** Usuwa budowlę z mapy i zwraca pełny koszt (refund). */
export function removeBuilding(state: GameState, x: number, y: number): boolean {
  const key = `${x},${y}`;
  const building = state.buildings.get(key);
  if (!building) return false;

  const size = BUILDING_SIZES[building.type] || { w: 1, h: 1 };
  for (let dy = 0; dy < size.h; dy++) {
    for (let dx = 0; dx < size.w; dx++) {
      const tx = x + dx, ty = y + dy;
      const chunk = getChunkAt(state, tx, ty);
      if (chunk) {
        const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk[ly][lx].building = null;
      }
    }
  }

  // Refund full build cost
  const cost = BUILDING_COSTS[building.type];
  if (cost) {
    for (const c of cost) {
      addItemToPlayer(state, c.itemId, c.count);
    }
  }

  state.buildings.delete(key);
  state.conveyors.delete(key);
  return true;
}

// ============ CHUNK HELPER ============

/** Pobiera chunk dla podanych współrzędnych tile'a, generując go jeśli nie istnieje. Restampuje budynki na nowych chunkach. */
function getChunkAt(state: GameState, tx: number, ty: number) {
  const cx = Math.floor(tx / CHUNK_SIZE);
  const cy = Math.floor(ty / CHUNK_SIZE);
  const key = getChunkKey(cx, cy);
  let chunk = state.chunks.get(key);
  if (!chunk) {
    chunk = generateChunk(cx, cy);
    state.chunks.set(key, chunk);
    // Re-stamp any buildings that belong to this newly generated chunk
    for (const [, building] of state.buildings) {
      const b = building as import('./types').Building;
      const size = BUILDING_SIZES[b.type as string] || { w: 1, h: 1 };
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          const bx = b.x + dx, by = b.y + dy;
          if (Math.floor(bx / CHUNK_SIZE) === cx && Math.floor(by / CHUNK_SIZE) === cy) {
            const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ly = ((by % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk[ly][lx].building = b;
          }
        }
      }
    }
  }
  return chunk;
}

/** Pobiera pojedynczy tile z chunka (generuje chunk jeśli potrzeba). */
export function getTileAt(state: GameState, tx: number, ty: number) {
  const chunk = getChunkAt(state, tx, ty);
  const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  return chunk[ly][lx];
}

// ============ PRODUCTION SYSTEM ============

/** Główna pętla produkcji — aktualizuje power grid, wszystkie budynki produkcyjne i auto-output co 60 ticków. */
export function updateProduction(state: GameState) {
  // First: update power (boilers -> steam engines)
  updatePowerGrid(state);

  for (const [, building] of state.buildings) {
    switch (building.type) {
      case 'miner': updateMiner(state, building); break;
      case 'furnace': updateFurnace(state, building); break;
      case 'assembler': updateAssembler(state, building); break;
      case 'lab': updateLab(state, building); break;
      case 'radar': updateRadar(state, building); break;
      case 'turret': updateTurret(state, building); break;
      case 'pumpjack': updatePumpjack(state, building); break;
      case 'refinery': updateRefinery(state, building); break;
      case 'chemical_plant': updateChemicalPlant(state, building); break;
    }
  }

  // Primitive auto-output: every 60 ticks, buildings with output items push 1 item
  // to an adjacent building that accepts it (slow manual-free option for new players)
  if (state.tick % 60 !== 0) return;
  for (const [, building] of state.buildings) {
    if (building.outputInventory.length === 0) continue;
    const item = building.outputInventory[0];
    if (!item || item.count <= 0) continue;

    // Check 4 adjacent tiles for accepting buildings
    const neighbors = [
      { x: building.x - 1, y: building.y },
      { x: building.x + 1, y: building.y },
      { x: building.x, y: building.y - 1 },
      { x: building.x, y: building.y + 1 },
      // also check offset by building size
      { x: building.x + (BUILDING_SIZES[building.type]?.w || 1), y: building.y },
      { x: building.x, y: building.y + (BUILDING_SIZES[building.type]?.h || 1) },
    ];

    for (const nb of neighbors) {
      const tile = getTileAt(state, nb.x, nb.y);
      const nbBuilding = tile?.building;
      if (!nbBuilding || nbBuilding === building) continue;
      const accepted = getAcceptedItemTypes(nbBuilding.type);
      if (accepted === 'any' || (Array.isArray(accepted) && accepted.includes(item.itemId))) {
        // Check input isn't full
        const existingSlot = nbBuilding.inventory.find(s => s.itemId === item.itemId);
        const totalCount = existingSlot?.count ?? 0;
        if (totalCount < 50) {
          removeItemFromBuildingOutput(building, item.itemId, 1);
          addItemToBuilding(nbBuilding, item.itemId, 1);
          break;
        }
      }
    }
  }
}

/** Aktualizuje górnika — wydobywa surowiec spod 2×2 area i dodaje do outputInventory. */
function updateMiner(state: GameState, building: Building) {
  // Check all tiles under the miner (2x2)
  let foundResource = false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tile = getTileAt(state, building.x + dx, building.y + dy);
      if (tile.resource && tile.resourceAmount > 0 && tile.resource !== 'water' && tile.resource !== 'oil') {
        foundResource = true;
        building.progress += state.player.miningSpeed;
        if (building.progress >= 80) {
          building.progress = 0;
          const minedResource = tile.resource!;
          tile.resourceAmount -= 1;
          if (tile.resourceAmount <= 0) tile.resource = null;
          // Output to outputInventory (for inserters to pick up)
          addItemToBuildingOutput(building, minedResource, 1);
          state.statistics.itemsProduced[minedResource] = (state.statistics.itemsProduced[minedResource] || 0) + 1;
          spawnParticle(state, building.x * TILE_SIZE + 16, building.y * TILE_SIZE + 16, 'resource', RESOURCE_COLORS[minedResource] || '#fff');
        }
        building.isActive = true;
        return;
      }
    }
  }
  // Also check for oil
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tile = getTileAt(state, building.x + dx, building.y + dy);
      if (tile.resource === 'oil' && tile.resourceAmount > 0) {
        foundResource = true;
        building.progress += state.player.miningSpeed;
        if (building.progress >= 60) {
          building.progress = 0;
          tile.resourceAmount -= 1;
          addItemToBuildingOutput(building, 'oil', 1);
          state.statistics.itemsProduced['oil'] = (state.statistics.itemsProduced['oil'] || 0) + 1;
        }
        building.isActive = true;
        return;
      }
    }
  }
  building.isActive = foundResource;
}

/** Aktualizuje piec — auto-detekcja przepisu z inputu, przetapianie rudy w sztabki. */
function updateFurnace(state: GameState, building: Building) {
  // Auto-detect recipe from input
  if (!building.recipe) {
    const ironSlot = building.inventory.find(s => s.itemId === 'iron');
    const copperSlot = building.inventory.find(s => s.itemId === 'copper');
    const stoneSlot = building.inventory.find(s => s.itemId === 'stone');
    const steelSlot = building.inventory.find(s => s.itemId === 'iron_plate');
    if (ironSlot) {
      building.recipe = { ...RECIPES.iron_plate } as any;
    } else if (copperSlot) {
      building.recipe = { ...RECIPES.copper_plate } as any;
    } else if (steelSlot && state.research.get('steel_processing')?.unlocked) {
      building.recipe = { ...RECIPES.steel_plate } as any;
    } else if (stoneSlot) {
      building.recipe = {
        id: 'stone_brick', name: 'Stone Brick',
        inputs: [{ itemId: 'stone', count: 2 }],
        outputs: [{ itemId: 'stone_brick', count: 1 }],
        craftTime: 30, energyCost: 1, category: 'smelting',
      } as any;
    }
  }

  if (!building.recipe) { building.isActive = false; return; }

  // If recipe set but input items are gone, clear recipe so it can re-detect
  if (building.recipe) {
    const hasInput = building.recipe.inputs.every(inp => {
      const slot = building.inventory.find(s => s.itemId === inp.itemId);
      return slot && slot.count >= inp.count;
    });
    if (!hasInput) {
      building.recipe = null;
      building.isActive = false;
      return;
    }
  }

  // Check if output is full (max 50 items per output type)
  for (const output of building.recipe.outputs) {
    const outSlot = building.outputInventory.find(s => s.itemId === output.itemId);
    if (outSlot && outSlot.count >= 50) { building.isActive = false; return; }
  }

  building.progress += state.player.craftingSpeed;
  if (building.progress >= building.recipe.craftTime) {
    building.progress = 0;
    for (const input of building.recipe.inputs) {
      removeItemFromBuilding(building, input.itemId, input.count);
      state.statistics.itemsConsumed[input.itemId] = (state.statistics.itemsConsumed[input.itemId] || 0) + input.count;
    }
    for (const output of building.recipe.outputs) {
      addItemToBuildingOutput(building, output.itemId, output.count);
      state.statistics.itemsProduced[output.itemId] = (state.statistics.itemsProduced[output.itemId] || 0) + output.count;
    }
    spawnParticle(state, building.x * TILE_SIZE + 16, building.y * TILE_SIZE + 8, 'fire', '#ff6600');
  }
  building.isActive = true;
}

/** Aktualizuje assembler — wykonuje ustawiony przepis (np. gear, circuit). */
function updateAssembler(state: GameState, building: Building) {
  if (!building.recipe) { building.isActive = false; return; }

  // Check inputs
  for (const input of building.recipe.inputs) {
    const slot = building.inventory.find(s => s.itemId === input.itemId);
    if (!slot || slot.count < input.count) { building.isActive = false; return; }
  }

  // Check output not full
  for (const output of building.recipe.outputs) {
    const outSlot = building.outputInventory.find(s => s.itemId === output.itemId);
    if (outSlot && outSlot.count >= 50) { building.isActive = false; return; }
  }

  building.progress += state.player.craftingSpeed;
  if (building.progress >= building.recipe.craftTime) {
    building.progress = 0;
    for (const input of building.recipe.inputs) {
      removeItemFromBuilding(building, input.itemId, input.count);
      state.statistics.itemsConsumed[input.itemId] = (state.statistics.itemsConsumed[input.itemId] || 0) + input.count;
    }
    for (const output of building.recipe.outputs) {
      addItemToBuildingOutput(building, output.itemId, output.count);
      state.statistics.itemsProduced[output.itemId] = (state.statistics.itemsProduced[output.itemId] || 0) + output.count;
    }
    spawnParticle(state, building.x * TILE_SIZE + 24, building.y * TILE_SIZE + 24, 'spark', '#3366ff');
  }
  building.isActive = true;
}

/** Aktualizuje lab — konsumuje science packi i robi postęp w aktywnym badaniu. */
function updateLab(state: GameState, building: Building) {
  // Find the first research that needs work
  for (const [, research] of state.research) {
    if (research.unlocked) continue;
    // Skip if prerequisites not met
    if (!research.prerequisites.every(p => state.research.get(p)?.unlocked)) continue;

    // Check if we have science packs
    let hasPacks = true;
    for (const cost of research.cost) {
      const slot = building.inventory.find(s => s.itemId === cost.itemId);
      if (!slot || slot.count < 1) { hasPacks = false; break; }
    }
    if (!hasPacks) { building.isActive = false; return; }

    // Consume packs and progress — consume 1 pack per 30 ticks, advance by 1
    if (state.tick % 30 === 0) {
      for (const cost of research.cost) {
        removeItemFromBuilding(building, cost.itemId, 1);
        state.statistics.itemsConsumed[cost.itemId] = (state.statistics.itemsConsumed[cost.itemId] || 0) + 1;
      }
      research.progress += 1;
      if (research.progress >= research.time) {
        research.unlocked = true;
        applyResearchEffects(state, research.id);
        grantXPToPlayer(state, 20);
        spawnParticle(state, building.x * TILE_SIZE + 24, building.y * TILE_SIZE + 24, 'spark', '#00ccff');
      }
    }
    building.isActive = true;
    return;
  }
  building.isActive = false;
}

/** Aktualizuje radar — odsłania obszar w promieniu 12 tile'i. */
function updateRadar(state: GameState, building: Building) {
  const radius = 12;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const tile = getTileAt(state, building.x + dx, building.y + dy);
      tile.visibility = 1;
    }
  }
  building.isActive = true;
}

/** Aktualizuje wieżyczkę — szuka najbliższego wroga, obraca się i strzela amunicją co 20 ticków. */
function updateTurret(state: GameState, building: Building) {
  const range = 12;
  let nearestEnemy: Enemy | null = null;
  let nearestDist = Infinity;

  for (const [, enemy] of state.enemies) {
    const dx = enemy.x - building.x;
    const dy = enemy.y - building.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < range && dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }

  if (nearestEnemy) {
    const dx = nearestEnemy.x - building.x;
    const dy = nearestEnemy.y - building.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      building.direction = dx > 0 ? 'right' : 'left';
    } else {
      building.direction = dy > 0 ? 'down' : 'up';
    }

    const ammoSlot = building.inventory.find(s => s.itemId === 'ammo');
    if (ammoSlot && ammoSlot.count > 0 && state.tick % 20 === 0) {
      const damage = 15 * (state.research.get('military')?.unlocked ? (state.research.get('military')!.effects.turretDamage || 1) : 1);
      nearestEnemy.health -= damage;
      removeItemFromBuilding(building, 'ammo', 1);
      spawnParticle(state, nearestEnemy.x * TILE_SIZE, nearestEnemy.y * TILE_SIZE, 'spark', '#ff3333');

      if (nearestEnemy.health <= 0) {
        state.enemies.delete(nearestEnemy.id);
        state.statistics.enemiesKilled++;
        grantXPToPlayer(state, 8);
        spawnParticle(state, nearestEnemy.x * TILE_SIZE, nearestEnemy.y * TILE_SIZE, 'explosion', '#ff6600');
      }
    }
    building.isActive = true;
  } else {
    building.isActive = false;
  }
}

/** Aktualizuje pumpjack — wydobywa ropę spod 2×2 area. */
function updatePumpjack(state: GameState, building: Building) {
  // Check for oil under the 2x2 area
  let foundOil = false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const tile = getTileAt(state, building.x + dx, building.y + dy);
      if (tile.resource === 'oil' && tile.resourceAmount > 0) {
        foundOil = true;
        building.progress += state.player.miningSpeed;
        if (building.progress >= 80) {
          building.progress = 0;
          tile.resourceAmount -= 1;
          if (tile.resourceAmount <= 0) tile.resource = null;
          addItemToBuildingOutput(building, 'oil', 1);
          state.statistics.itemsProduced['oil'] = (state.statistics.itemsProduced['oil'] || 0) + 1;
          spawnParticle(state, building.x * TILE_SIZE + 16, building.y * TILE_SIZE + 16, 'resource', RESOURCE_COLORS['oil'] || '#1a1a2e');
        }
        building.isActive = true;
        return;
      }
    }
  }
  building.isActive = foundOil;
}

/** Aktualizuje rafinerię — auto-detekcja przepisu (oil refining / cracking) z inputu. */
function updateRefinery(state: GameState, building: Building) {
  // Auto-detect recipe from input
  if (!building.recipe) {
    const oilSlot = building.inventory.find(s => s.itemId === 'oil');
    const lightOilSlot = building.inventory.find(s => s.itemId === 'light_oil');
    const heavyOilSlot = building.inventory.find(s => s.itemId === 'heavy_oil');

    if (oilSlot && oilSlot.count >= 5) {
      building.recipe = {
        id: 'oil_refining', name: 'Oil Refining',
        inputs: [{ itemId: 'oil', count: 5 }],
        outputs: [{ itemId: 'petroleum_gas', count: 3 }, { itemId: 'light_oil', count: 1 }, { itemId: 'heavy_oil', count: 1 }],
        craftTime: 120, energyCost: 2, category: 'oil_processing',
      } as any;
    } else if (lightOilSlot && lightOilSlot.count >= 1) {
      building.recipe = {
        id: 'light_oil_cracking', name: 'Light Oil Cracking',
        inputs: [{ itemId: 'light_oil', count: 1 }],
        outputs: [{ itemId: 'petroleum_gas', count: 2 }],
        craftTime: 60, energyCost: 1, category: 'oil_processing',
      } as any;
    } else if (heavyOilSlot && heavyOilSlot.count >= 1) {
      building.recipe = {
        id: 'heavy_oil_cracking', name: 'Heavy Oil Cracking',
        inputs: [{ itemId: 'heavy_oil', count: 1 }],
        outputs: [{ itemId: 'light_oil', count: 1 }, { itemId: 'petroleum_gas', count: 1 }],
        craftTime: 80, energyCost: 1, category: 'oil_processing',
      } as any;
    }
  }

  if (!building.recipe) { building.isActive = false; return; }

  // Check if we have the input items
  for (const input of building.recipe.inputs) {
    const slot = building.inventory.find(s => s.itemId === input.itemId);
    if (!slot || slot.count < input.count) {
      // Can't continue with this recipe, clear it to try detecting another
      building.recipe = null;
      building.isActive = false;
      return;
    }
  }

  // Check if output is full (max 50 items per output type)
  for (const output of building.recipe.outputs) {
    const outSlot = building.outputInventory.find(s => s.itemId === output.itemId);
    if (outSlot && outSlot.count >= 50) { building.isActive = false; return; }
  }

  building.progress += state.player.craftingSpeed;
  if (building.progress >= building.recipe.craftTime) {
    building.progress = 0;
    for (const input of building.recipe.inputs) {
      removeItemFromBuilding(building, input.itemId, input.count);
      state.statistics.itemsConsumed[input.itemId] = (state.statistics.itemsConsumed[input.itemId] || 0) + input.count;
    }
    for (const output of building.recipe.outputs) {
      addItemToBuildingOutput(building, output.itemId, output.count);
      state.statistics.itemsProduced[output.itemId] = (state.statistics.itemsProduced[output.itemId] || 0) + output.count;
    }
    spawnParticle(state, building.x * TILE_SIZE + 24, building.y * TILE_SIZE + 24, 'smoke', '#4a6a8a');
    // Clear recipe so it can re-detect next cycle
    building.recipe = null;
  }
  building.isActive = true;
}

/** Aktualizuje plantę chemiczną — auto-detekcja przepisu chemistry z RECIPES. */
function updateChemicalPlant(state: GameState, building: Building) {
  // Works like assembler but for chemistry category recipes
  // Auto-detects recipe from input items
  if (!building.recipe) {
    // Find matching chemistry recipes from RECIPES
    for (const [, recipe] of Object.entries(RECIPES)) {
      if (recipe.category !== 'chemistry') continue;
      const hasAllInputs = recipe.inputs.every(input => {
        const slot = building.inventory.find(s => s.itemId === input.itemId);
        return slot && slot.count >= input.count;
      });
      if (hasAllInputs) {
        building.recipe = { ...recipe } as any;
        break;
      }
    }
  }

  if (!building.recipe) { building.isActive = false; return; }

  // Check if we still have the input items
  let hasInputs = true;
  for (const input of building.recipe.inputs) {
    const slot = building.inventory.find(s => s.itemId === input.itemId);
    if (!slot || slot.count < input.count) { hasInputs = false; break; }
  }

  if (!hasInputs) {
    // Recipe no longer valid, clear to re-detect
    building.recipe = null;
    building.isActive = false;
    return;
  }

  // Check if output is full (max 50 items per output type)
  for (const output of building.recipe.outputs) {
    const outSlot = building.outputInventory.find(s => s.itemId === output.itemId);
    if (outSlot && outSlot.count >= 50) { building.isActive = false; return; }
  }

  building.progress += state.player.craftingSpeed;
  if (building.progress >= building.recipe.craftTime) {
    building.progress = 0;
    for (const input of building.recipe.inputs) {
      removeItemFromBuilding(building, input.itemId, input.count);
      state.statistics.itemsConsumed[input.itemId] = (state.statistics.itemsConsumed[input.itemId] || 0) + input.count;
    }
    for (const output of building.recipe.outputs) {
      addItemToBuildingOutput(building, output.itemId, output.count);
      state.statistics.itemsProduced[output.itemId] = (state.statistics.itemsProduced[output.itemId] || 0) + output.count;
    }
    spawnParticle(state, building.x * TILE_SIZE + 16, building.y * TILE_SIZE + 16, 'smoke', '#6a4a8a');
    // Clear recipe so it can re-detect from available inputs
    building.recipe = null;
  }
  building.isActive = true;
}

// ============ POWER GRID ============

/** Aktualizuje sieć energetyczną: boilery spalają węgiel → para, steam enginy zbierają parę. */
function updatePowerGrid(state: GameState) {
  // Boilers consume coal and produce steam
  for (const [, building] of state.buildings) {
    if (building.type !== 'boiler') continue;
    const coalSlot = building.inventory.find(s => s.itemId === 'coal');
    if (coalSlot && coalSlot.count > 0) {
      building.energy = Math.min(building.maxEnergy, building.energy + 1.2);
      if (state.tick % 90 === 0) {
        removeItemFromBuilding(building, 'coal', 1);
        state.statistics.itemsConsumed['coal'] = (state.statistics.itemsConsumed['coal'] || 0) + 1;
        spawnParticle(state, building.x * TILE_SIZE + 16, building.y * TILE_SIZE, 'smoke', '#555');
      }
      building.isActive = true;
    } else {
      building.isActive = false;
    }
  }

  // Steam engines near boilers get power
  for (const [, building] of state.buildings) {
    if (building.type !== 'steam_engine') continue;
    let hasPower = false;
    for (const [, other] of state.buildings) {
      if (other.type === 'boiler' && other.energy > 0 && Math.abs(other.x - building.x) <= 10 && Math.abs(other.y - building.y) <= 10) {
        other.energy -= 0.2;
        building.energy = Math.min(building.maxEnergy, building.energy + 0.3);
        hasPower = true;
      }
    }
    building.isActive = hasPower;
  }
}

// ============ CONVEYOR & INSERTER SYSTEM ============

/** Aktualizuje insertery (przenoszą itemy między buildingami) i przenośniki (przesuwają itemy). Obsługuje też underground belt i splittery. */
export function updateConveyors(state: GameState) {
  // Update inserters FIRST (they move items between buildings)
  for (const [, inserter] of state.buildings) {
    if (inserter.type !== 'inserter') continue;
    // Per-building tick counter: use building.progress as tick counter (reuse field)
    // inserter.progress counts up; when it hits 20, fire and reset
    inserter.progress = (inserter.progress || 0) + 1;
    if (inserter.progress < 20) continue;
    inserter.progress = 0;

    const dir = DIR_OFFSETS[inserter.direction] || DIR_OFFSETS.right;
    // Source is BEHIND inserter, destination is IN FRONT
    const srcX = inserter.x - dir.dx;
    const srcY = inserter.y - dir.dy;
    const dstX = inserter.x + dir.dx;
    const dstY = inserter.y + dir.dy;

    const srcBuilding = getTileAt(state, srcX, srcY).building || null;
    const dstBuilding = getTileAt(state, dstX, dstY).building || null;
    const dstConveyor = state.conveyors.get(`${dstX},${dstY}`);

    // Try to pick from source output inventory
    let pickedItem: string | null = null;

    if (srcBuilding) {
      // Pick from output first, then input
      if (srcBuilding.outputInventory.length > 0) {
        const item = srcBuilding.outputInventory[0];
        if (item && item.count > 0) {
          pickedItem = item.itemId;
          removeItemFromBuildingOutput(srcBuilding, item.itemId, 1);
        }
      } else if (srcBuilding.inventory.length > 0 && srcBuilding.type === 'storage') {
        const item = srcBuilding.inventory[0];
        if (item && item.count > 0) {
          pickedItem = item.itemId;
          removeItemFromBuilding(srcBuilding, item.itemId, 1);
        }
      }
    }

    if (!pickedItem) continue;

    // Place at destination
    if (dstConveyor) {
      for (const seg of dstConveyor) {
        if (!seg.itemId) {
          seg.itemId = pickedItem;
          seg.progress = 0;
          pickedItem = null;
          break;
        }
      }
    }
    if (pickedItem && dstBuilding) {
      addItemToBuilding(dstBuilding, pickedItem, 1);
      pickedItem = null;
    }
  }

  // Then update conveyor belts
  for (const [key, segments] of state.conveyors) {
    const building = state.buildings.get(key);
    if (!building) continue;

    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.itemId) continue;

      seg.progress += 0.025;

      if (seg.progress >= 1) {
        const nx = building.x + dir.dx;
        const ny = building.y + dir.dy;
        const nextKey = `${nx},${ny}`;
        const nextConveyor = state.conveyors.get(nextKey);
        const nextBuilding = state.buildings.get(nextKey) || getTileAt(state, nx, ny).building || null;

        let transferred = false;

        // Try next conveyor
        if (nextConveyor) {
          for (const nextSeg of nextConveyor) {
            if (!nextSeg.itemId) {
              nextSeg.itemId = seg.itemId;
              nextSeg.progress = 0;
              seg.itemId = null;
              seg.progress = i === 0 ? 0 : 0.5;
              transferred = true;
              break;
            }
          }
        }

        // Try to insert into building input
        if (!transferred && nextBuilding) {
          const acceptedTypes = getAcceptedItemTypes(nextBuilding.type);
          if (acceptedTypes === 'any' || acceptedTypes.includes(seg.itemId!)) {
            addItemToBuilding(nextBuilding, seg.itemId!, 1);
            seg.itemId = null;
            seg.progress = i === 0 ? 0 : 0.5;
            transferred = true;
          }
        }

        if (!transferred) {
          seg.progress = 1; // blocked, item stays at end
        }
      }
    }
  }

  // Underground belts: teleport items across gaps
  for (const [key, building] of state.buildings) {
    if (building.type !== 'underground_belt') continue;
    const segments = state.conveyors.get(key);
    if (!segments) continue;
    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right;
    // Look for an exit underground belt up to 4 tiles away in direction
    for (let dist = 2; dist <= 5; dist++) {
      const exitX = building.x + dir.dx * dist;
      const exitY = building.y + dir.dy * dist;
      const exitKey = `${exitX},${exitY}`;
      const exitBuilding = state.buildings.get(exitKey);
      if (!exitBuilding || exitBuilding.type !== 'underground_belt') continue;
      if (exitBuilding.direction !== building.direction) continue;
      // Transfer items from entrance output to exit input
      const exitSegments = state.conveyors.get(exitKey);
      if (!exitSegments) continue;
      for (const seg of segments) {
        if (seg.itemId && seg.progress >= 1) {
          // Try to place in exit segment
          for (const exitSeg of exitSegments) {
            if (!exitSeg.itemId) {
              exitSeg.itemId = seg.itemId;
              exitSeg.progress = 0;
              seg.itemId = null;
              seg.progress = 0;
              break;
            }
          }
        }
      }
      break; // found exit, stop searching
    }
  }

  // Splitters: alternately route items left and right
  for (const [key, building] of state.buildings) {
    if (building.type !== 'splitter') continue;
    const segments = state.conveyors.get(key);
    if (!segments) continue;
    const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right;
    for (const seg of segments) {
      if (!seg.itemId || seg.progress < 1) continue;
      // Two output positions: one to left, one to right of direction
      const leftDx = -dir.dy, leftDy = dir.dx;
      const rightDx = dir.dy, rightDy = -dir.dx;
      const outputs = [
        { x: building.x + dir.dx + leftDx, y: building.y + dir.dy + leftDy },
        { x: building.x + dir.dx + rightDx, y: building.y + dir.dy + rightDy },
        { x: building.x + dir.dx, y: building.y + dir.dy }, // straight through
      ];
      let transferred = false;
      for (const out of outputs) {
        const outKey = `${out.x},${out.y}`;
        const outConveyor = state.conveyors.get(outKey);
        if (outConveyor) {
          for (const outSeg of outConveyor) {
            if (!outSeg.itemId) {
              outSeg.itemId = seg.itemId;
              outSeg.progress = 0;
              seg.itemId = null;
              seg.progress = 0;
              transferred = true;
              break;
            }
          }
        }
        if (transferred) break;
      }
      if (!transferred) seg.progress = 1;
    }
  }
}

/** Zwraca liste typów itemów akceptowanych przez dany typ budynku (lub 'any' = wszystkie). */
function getAcceptedItemTypes(buildingType: string): string[] | 'any' {
  switch (buildingType) {
    case 'furnace': return ['iron', 'copper', 'stone', 'iron_plate']; // raw ores + iron_plate for steel
    case 'assembler': return 'any'; // depends on recipe
    case 'storage': return 'any';
    case 'lab': return ['science_red', 'science_green', 'science_blue'];
    case 'boiler': return ['coal'];
    case 'turret': return ['ammo'];
    case 'pumpjack': return [];
    case 'refinery': return ['oil', 'light_oil', 'heavy_oil'];
    case 'chemical_plant': return 'any';
    default: return [];
  }
}

// ============ NPC SYSTEM ============

/** Spawnuje NPC (worker/guard/scout/trader/settler) z dynamicznym capem: 4 + 1 per 20 budynków. */
export function spawnNPCs(state: GameState) {
  // Dynamic NPC cap: 4 at start, +1 per 20 buildings placed, max NPC_MAX
  const effectiveMax = Math.min(NPC_MAX, 4 + Math.floor(state.statistics.buildingsPlaced / 20));
  if (state.npcs.size >= effectiveMax) return;
  const buildings = Array.from(state.buildings.values());
  // Allow spawning even without buildings — NPCs wander the world

  const typeRoll = Math.random();
  const type: NPC['type'] = typeRoll < 0.4 ? 'worker' : typeRoll < 0.55 ? 'guard' : typeRoll < 0.7 ? 'scout' : typeRoll < 0.85 ? 'trader' : 'settler';
  const home = buildings.length > 0 ? buildings[Math.floor(Math.random() * buildings.length)] : { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };

  const npc: NPC = {
    id: genId(), type,
    x: (buildings.length > 0 ? home.x : 0) + (Math.random() - 0.5) * 12,
    y: (buildings.length > 0 ? home.y : 0) + (Math.random() - 0.5) * 12,
    targetX: buildings.length > 0 ? home.x : (Math.random() - 0.5) * 20,
    targetY: buildings.length > 0 ? home.y : (Math.random() - 0.5) * 20,
    health: 100, maxHealth: 100,
    speed: 0.09 + Math.random() * 0.04,
    state: 'idle', inventory: [],
    homeX: home.x, homeY: home.y,
    name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
    faction: 'colony',
    dialogue: NPC_DIALOGUES[type] || ['...'],
    taskTimer: Math.random() * 200, path: [], pathIndex: 0,
  };
  state.npcs.set(npc.id, npc);
}

/** Zadanie zaopatrzenia dla NPC: źródło → destination z ilością. */
interface SupplyJob {
  srcId: string; srcX: number; srcY: number;
  dstId: string; dstX: number; dstY: number;
  itemId: string; amount: number;
}

/** Szuka najbardziej pilnego zadania zaopatrzenia (boiler bez węgla, piec bez rudy, itp.). */
function findSupplyJob(state: GameState, buildingList: Building[]): SupplyJob | null {
  type Need = { building: Building; itemId: string; urgency: number };
  const needs: Need[] = [];

  for (const b of buildingList) {
    switch (b.type) {
      case 'boiler': {
        const count = b.inventory.find(s => s.itemId === 'coal')?.count ?? 0;
        if (count < 20) needs.push({ building: b, itemId: 'coal', urgency: 100 - count * 3 });
        break;
      }
      case 'furnace': {
        for (const ore of ['iron', 'copper', 'stone']) {
          const count = b.inventory.find(s => s.itemId === ore)?.count ?? 0;
          if (count < 15) needs.push({ building: b, itemId: ore, urgency: 60 - count * 2 });
        }
        const ipCount = b.inventory.find(s => s.itemId === 'iron_plate')?.count ?? 0;
        if (ipCount < 10) needs.push({ building: b, itemId: 'iron_plate', urgency: 40 - ipCount * 2 });
        break;
      }
      case 'assembler': {
        if (b.recipe) {
          for (const input of b.recipe.inputs) {
            const count = b.inventory.find(s => s.itemId === input.itemId)?.count ?? 0;
            if (count < 10) needs.push({ building: b, itemId: input.itemId, urgency: 35 - count * 2 });
          }
        }
        break;
      }
      case 'lab': {
        for (const sp of ['science_red', 'science_green', 'science_blue']) {
          const count = b.inventory.find(s => s.itemId === sp)?.count ?? 0;
          if (count < 5) needs.push({ building: b, itemId: sp, urgency: 25 - count * 3 });
        }
        break;
      }
      case 'turret': {
        const ammo = b.inventory.find(s => s.itemId === 'ammo')?.count ?? 0;
        if (ammo < 10) needs.push({ building: b, itemId: 'ammo', urgency: 50 - ammo * 3 });
        break;
      }
    }
  }

  needs.sort((a, b) => b.urgency - a.urgency);

  const sz = (type: string) => BUILDING_SIZES[type] || { w: 1, h: 1 };

  for (const need of needs) {
    let bestSrc: Building | null = null;
    let bestCount = 0;

    for (const src of buildingList) {
      if (src.id === need.building.id) continue;
      const outSlot = src.outputInventory.find(s => s.itemId === need.itemId);
      if (outSlot && outSlot.count > bestCount) {
        bestSrc = src;
        bestCount = outSlot.count;
      }
      if (src.type === 'storage') {
        const inSlot = src.inventory.find(s => s.itemId === need.itemId);
        if (inSlot && inSlot.count > bestCount) {
          bestSrc = src;
          bestCount = inSlot.count;
        }
      }
    }

    if (bestSrc && bestCount > 0) {
      const srcSize = sz(bestSrc.type);
      const dstSize = sz(need.building.type);
      return {
        srcId: bestSrc.id,
        srcX: bestSrc.x + srcSize.w / 2,
        srcY: bestSrc.y + srcSize.h / 2,
        dstId: need.building.id,
        dstX: need.building.x + dstSize.w / 2,
        dstY: need.building.y + dstSize.h / 2,
        itemId: need.itemId,
        amount: Math.min(bestCount, 8),
      };
    }
  }
  return null;
}

/** Aktualizuje wszystkich NPC — FSM stanów (idle/moving/working/trading/fleeing). Workerzy budują i zaopatrują, guardzi walczą, reszta unika wrogów. */
export function updateNPCs(state: GameState) {
  const buildingList = Array.from(state.buildings.values());

  // Watchdog: release build tasks whose assigned NPC no longer exists
  for (const task of state.buildQueue) {
    if (task.assignedNpcId && !state.npcs.has(task.assignedNpcId)) {
      task.assignedNpcId = undefined;
    }
  }

  for (const [, npc] of state.npcs) {
    npc.taskTimer--;

    // Guards attack nearby enemies instead of fleeing
    if (npc.type === 'guard') {
      let nearestEnemy: Enemy | null = null;
      let nearestDist = Infinity;
      for (const [, enemy] of state.enemies) {
        const d = Math.sqrt((enemy.x - npc.x) ** 2 + (enemy.y - npc.y) ** 2);
        if (d < nearestDist) { nearestDist = d; nearestEnemy = enemy; }
      }
      if (nearestEnemy && nearestDist < 14) {
        const dx = nearestEnemy.x - npc.x;
        const dy = nearestEnemy.y - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1.5) {
          npc.x += (dx / dist) * npc.speed * 1.3;
          npc.y += (dy / dist) * npc.speed * 1.3;
        } else if (state.tick % 30 === 0) {
          nearestEnemy.health -= 5;
          spawnParticle(state, nearestEnemy.x * TILE_SIZE, nearestEnemy.y * TILE_SIZE, 'spark', '#ff4444');
          if (nearestEnemy.health <= 0) {
            state.enemies.delete(nearestEnemy.id);
            state.statistics.enemiesKilled++;
            grantXPToPlayer(state, 5);
            spawnParticle(state, nearestEnemy.x * TILE_SIZE, nearestEnemy.y * TILE_SIZE, 'explosion', '#ff6600');
          }
        }
        continue;
      }
    }

    // Non-guards flee from nearby enemies
    if (npc.type !== 'guard') {
      let nearEnemy = false;
      for (const [, enemy] of state.enemies) {
        const d = Math.sqrt((enemy.x - npc.x) ** 2 + (enemy.y - npc.y) ** 2);
        if (d < 10) { nearEnemy = true; break; }
      }
      if (nearEnemy) {
        npc.state = 'fleeing';
        npc.taskTimer = 300;
      }
    }

    switch (npc.state) {
      case 'idle': {
        if (npc.taskTimer > 0) break;

        if (npc.type === 'worker') {
          // Priority 1: pick up an unassigned build task
          const freeTask = state.buildQueue.find(q => !q.assignedNpcId);
          if (freeTask) {
            freeTask.assignedNpcId = npc.id;
            npc.state = 'working';
            npc.taskTimer = 1800;
            break;
          }
          // Priority 2: supply chain job
          const sJob = findSupplyJob(state, buildingList);
          if (sJob) {
            (npc as any)._supplyJob = sJob;
            (npc as any)._supplyPhase = 'toSource';
            npc.targetX = sJob.srcX;
            npc.targetY = sJob.srcY;
            npc.state = 'working';
            npc.taskTimer = 700;
            break;
          }
          // No work: wander near home
          npc.targetX = npc.homeX + (Math.random() - 0.5) * 16;
          npc.targetY = npc.homeY + (Math.random() - 0.5) * 16;
          npc.state = 'moving';
          npc.taskTimer = 150 + Math.random() * 200;
        } else if (npc.type === 'guard') {
          npc.state = 'patrolling';
          const anchor = buildingList.length > 0
            ? buildingList[Math.floor(Math.random() * Math.min(buildingList.length, 5))]
            : { x: npc.homeX, y: npc.homeY };
          npc.targetX = anchor.x + (Math.random() - 0.5) * 14;
          npc.targetY = anchor.y + (Math.random() - 0.5) * 14;
          npc.taskTimer = 200 + Math.random() * 300;
        } else if (npc.type === 'scout') {
          npc.state = 'moving';
          npc.targetX = npc.x + (Math.random() - 0.5) * 40;
          npc.targetY = npc.y + (Math.random() - 0.5) * 40;
          npc.taskTimer = 200 + Math.random() * 300;
        } else if (npc.type === 'trader') {
          npc.state = 'trading';
          npc.targetX = state.player.x + (Math.random() - 0.5) * 4;
          npc.targetY = state.player.y + (Math.random() - 0.5) * 4;
          npc.taskTimer = 200 + Math.random() * 300;
        } else {
          npc.state = 'gathering';
          npc.targetX = npc.homeX + (Math.random() - 0.5) * 20;
          npc.targetY = npc.homeY + (Math.random() - 0.5) * 20;
          npc.taskTimer = 200 + Math.random() * 300;
        }
        break;
      }

      case 'moving':
      case 'patrolling':
      case 'gathering': {
        const dx = npc.targetX - npc.x;
        const dy = npc.targetY - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) {
          const step = Math.min(npc.speed, dist);
          npc.x += (dx / dist) * step;
          npc.y += (dy / dist) * step;
        } else {
          npc.x = Math.round(npc.x);
          npc.y = Math.round(npc.y);
          npc.state = 'idle';
          npc.taskTimer = 40 + Math.random() * 80;
        }
        break;
      }

      case 'working': {
        // Priority 1: build task
        const myTask = state.buildQueue.find(q => q.assignedNpcId === npc.id);
        const freeTask2 = !myTask ? state.buildQueue.find(q => !q.assignedNpcId) : null;
        const buildTask = myTask || freeTask2;
        if (buildTask) {
          if (!myTask) buildTask.assignedNpcId = npc.id;
          const dx = buildTask.x - npc.x;
          const dy = buildTask.y - npc.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1.5) {
            npc.x += (dx / dist) * npc.speed;
            npc.y += (dy / dist) * npc.speed;
          } else {
            buildTask.constructionProgress += 1.2;
            if (buildTask.constructionProgress >= 100) {
              const placed = placeBuilding(state, buildTask.type, buildTask.x, buildTask.y, buildTask.direction, true);
              if (placed) {
                state.buildQueue = state.buildQueue.filter(q => q.id !== buildTask.id);
                spawnParticle(state, buildTask.x * TILE_SIZE + 16, buildTask.y * TILE_SIZE + 16, 'spark', '#88ffcc');
                npc.state = 'idle';
                npc.taskTimer = 30;
              } else {
                buildTask.constructionProgress = 80;
                npc.taskTimer = 60;
              }
            }
          }
          if (npc.taskTimer <= 0) {
            if (buildTask.assignedNpcId === npc.id) buildTask.assignedNpcId = undefined;
            npc.state = 'idle';
            npc.taskTimer = 60;
          }
          break;
        }

        // Priority 2: supply chain job
        const sJob = (npc as any)._supplyJob as SupplyJob | undefined;
        if (sJob) {
          const phase = (npc as any)._supplyPhase as string;
          if (phase === 'toSource') {
            const dx = sJob.srcX - npc.x;
            const dy = sJob.srcY - npc.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1.5) {
              npc.x += (dx / dist) * npc.speed;
              npc.y += (dy / dist) * npc.speed;
            } else {
              const src = buildingList.find(b => b.id === sJob.srcId);
              if (src) {
                let picked = 0;
                const outSlot = src.outputInventory.find(s => s.itemId === sJob.itemId);
                if (outSlot && outSlot.count > 0) {
                  const take = Math.min(sJob.amount, outSlot.count);
                  removeItemFromBuildingOutput(src, sJob.itemId, take);
                  picked = take;
                } else if (src.type === 'storage') {
                  const inSlot = src.inventory.find(s => s.itemId === sJob.itemId);
                  if (inSlot && inSlot.count > 0) {
                    const take = Math.min(sJob.amount, inSlot.count);
                    removeItemFromBuilding(src, sJob.itemId, take);
                    picked = take;
                  }
                }
                if (picked > 0) {
                  const existNpc = npc.inventory.find(s => s.itemId === sJob.itemId);
                  if (existNpc) existNpc.count += picked;
                  else npc.inventory.push({ itemId: sJob.itemId, count: picked });
                  (npc as any)._supplyPhase = 'toTarget';
                  npc.targetX = sJob.dstX;
                  npc.targetY = sJob.dstY;
                } else {
                  (npc as any)._supplyJob = null;
                  npc.state = 'idle';
                  npc.taskTimer = 30;
                }
              } else {
                (npc as any)._supplyJob = null;
                npc.state = 'idle';
                npc.taskTimer = 30;
              }
            }
          } else if (phase === 'toTarget') {
            const dx = sJob.dstX - npc.x;
            const dy = sJob.dstY - npc.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1.5) {
              npc.x += (dx / dist) * npc.speed;
              npc.y += (dy / dist) * npc.speed;
            } else {
              const dst = buildingList.find(b => b.id === sJob.dstId);
              if (dst) {
                for (const inv of npc.inventory) {
                  addItemToBuilding(dst, inv.itemId, inv.count);
                }
              }
              npc.inventory = [];
              (npc as any)._supplyJob = null;
              npc.state = 'idle';
              npc.taskTimer = 30;
            }
          }
          if (npc.taskTimer <= 0) {
            npc.inventory = [];
            (npc as any)._supplyJob = null;
            npc.state = 'idle';
            npc.taskTimer = 60;
          }
          break;
        }

        // Nothing to do
        npc.state = 'idle';
        npc.taskTimer = 30;
        break;
      }

      case 'trading': {
        const dx = state.player.x - npc.x;
        const dy = state.player.y - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 4) {
          npc.x += (dx / dist) * npc.speed;
          npc.y += (dy / dist) * npc.speed;
        }
        if (npc.taskTimer <= 0) {
          npc.state = 'idle';
          npc.taskTimer = 60;
        }
        break;
      }

      case 'fleeing': {
        let fleeDx = 0, fleeDy = 0;
        let enemyCount = 0;
        for (const [, enemy] of state.enemies) {
          const d = Math.sqrt((enemy.x - npc.x) ** 2 + (enemy.y - npc.y) ** 2);
          if (d < 15) {
            fleeDx -= (enemy.x - npc.x) / (d + 0.001);
            fleeDy -= (enemy.y - npc.y) / (d + 0.001);
            enemyCount++;
          }
        }
        if (enemyCount === 0 || npc.taskTimer <= 0) {
          // Release any build task so another worker (or this one after idle) can pick it up
          for (const task of state.buildQueue) {
            if (task.assignedNpcId === npc.id) {
              task.assignedNpcId = undefined;
              task.constructionProgress = Math.max(0, task.constructionProgress - 20);
            }
          }
          npc.state = 'idle';
          npc.taskTimer = 60;
        } else {
          const len = Math.sqrt(fleeDx * fleeDx + fleeDy * fleeDy) || 1;
          npc.x += (fleeDx / len) * npc.speed * 1.4;
          npc.y += (fleeDy / len) * npc.speed * 1.4;
          npc.taskTimer--;
        }
        break;
      }
    }
  }
}

// ============ ENEMY SYSTEM ============

/** Spawnuje wrogów ze spawnerów + tworzy nowe spawnery z dala od gracza co 600 ticków. */
export function spawnEnemies(state: GameState) {
  if (state.enemies.size >= ENEMY_MAX) return;

  for (const [, spawner] of state.spawners) {
    spawner.spawnTimer--;
    if (spawner.spawnTimer <= 0) {
      spawner.spawnTimer = Math.max(60, spawner.spawnRate) * (state.evolution < 0.1 ? 2.5 : 1);
      const types: Enemy['type'][] = ['biter', 'spitter'];
      const type = types[Math.floor(Math.random() * types.length)];
      const stats = ENEMY_STATS[type];
      const evo = state.evolution;

      const enemy: Enemy = {
        id: genId(), type,
        x: spawner.x + (Math.random() - 0.5) * 4,
        y: spawner.y + (Math.random() - 0.5) * 4,
        health: stats.health * (1 + evo), maxHealth: stats.health * (1 + evo),
        attack: stats.attack * (1 + evo * 0.5), speed: stats.speed * (1 + evo * 0.2),
        range: stats.range, target: null, evolution: evo,
        state: 'moving', attackCooldown: 0, spawnerId: spawner.id,
      };
      state.enemies.set(enemy.id, enemy);
      spawner.enemies.push(enemy.id);
    }
  }

  // Spawn spawners away from player
  if (state.spawners.size < SPAWNER_MAX && (state.tick % 600 === 0 || (state.tick === 1200 && state.spawners.size === 0))) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 40;
    const sx = Math.floor(state.player.x + Math.cos(angle) * dist);
    const sy = Math.floor(state.player.y + Math.sin(angle) * dist);

    const spawner: EnemySpawner = {
      id: genId(), x: sx, y: sy,
      health: 300 * (1 + state.evolution), maxHealth: 300 * (1 + state.evolution),
      spawnTimer: 300, spawnRate: Math.max(60, 300 - state.evolution * 100),
      evolution: state.evolution, enemies: [],
    };
    state.spawners.set(spawner.id, spawner);
    getChunkAt(state, sx, sy); // ensure chunk exists
  }
}

/** Aktualizuje wrogów — ruch w stronę celu (budynek lub gracz), atak, śmierć. */
export function updateEnemies(state: GameState) {
  for (const [, enemy] of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - 1);

    // Find closest target: polluted buildings first, then player
    let targetX = state.player.x;
    let targetY = state.player.y;
    let targetDist = Math.sqrt((enemy.x - state.player.x) ** 2 + (enemy.y - state.player.y) ** 2);

    // Prefer nearby buildings (attracted by pollution)
    for (const [, building] of state.buildings) {
      const d = Math.sqrt((enemy.x - building.x) ** 2 + (enemy.y - building.y) ** 2);
      if (d < targetDist && d < 25) {
        targetDist = d;
        targetX = building.x;
        targetY = building.y;
      }
    }

    // Move toward target
    if (targetDist > enemy.range * 0.8) {
      const dx = targetX - enemy.x;
      const dy = targetY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.1) {
        const moveSpeed = enemy.speed * 0.04;
        enemy.x += (dx / dist) * moveSpeed;
        enemy.y += (dy / dist) * moveSpeed;
        enemy.state = 'moving';
      }
    } else {
      enemy.state = 'attacking';
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 55;

        // Attack player if in range
        const playerDist = Math.sqrt((enemy.x - state.player.x) ** 2 + (enemy.y - state.player.y) ** 2);
        if (playerDist <= enemy.range) {
          state.player.health -= enemy.attack;
          spawnParticle(state, state.player.x * TILE_SIZE, state.player.y * TILE_SIZE, 'spark', '#ff0000');
        }

        // Attack nearest building in range
        for (const [key, building] of state.buildings) {
          const d = Math.sqrt((enemy.x - building.x) ** 2 + (enemy.y - building.y) ** 2);
          if (d <= enemy.range + 0.5) {
            building.health -= enemy.attack;
            spawnParticle(state, building.x * TILE_SIZE, building.y * TILE_SIZE, 'spark', '#ff6600');
            if (building.health <= 0) {
              const [bx, by] = key.split(',').map(Number);
              removeBuilding(state, bx, by);
              spawnParticle(state, building.x * TILE_SIZE, building.y * TILE_SIZE, 'explosion', '#ff6600');
            }
            break;
          }
        }
      }
    }

    if (enemy.health <= 0) {
      state.enemies.delete(enemy.id);
      state.statistics.enemiesKilled++;
      grantXPToPlayer(state, 8);
      spawnParticle(state, enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, 'explosion', '#ff6600');
    }
  }
}

// ============ POLLUTION & EVOLUTION ============

/** Aktualizuje zanieczyszczenie generowane przez kopalnie/piece/boilery i ewolucję wrogów (pollution * 0.00008). */
export function updatePollution(state: GameState) {
  let totalPollution = 0;
  for (const [, building] of state.buildings) {
    if (building.type === 'miner' || building.type === 'furnace' || building.type === 'boiler') {
      if (!building.isActive) continue;
      const tile = getTileAt(state, building.x, building.y);
      tile.pollution += 0.05;
      totalPollution += tile.pollution;
    }
  }

  for (const [, chunk] of state.chunks) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        chunk[y][x].pollution *= 0.998;
      }
    }
  }

  state.pollution = totalPollution;
  // Evolution driven purely by pollution — idle players won't see it rise
  state.evolution = Math.min(1, state.pollution * 0.00008);
}

// ============ PARTICLE SYSTEM ============

/** Tworzy cząsteczkę (resource/fire/spark/explosion/smoke) z losową prędkością i lifetime. */
export function spawnParticle(state: GameState, x: number, y: number, type: Particle['type'], color: string) {
  if (state.particles.length >= MAX_PARTICLES) state.particles.shift();
  const angle = Math.random() * Math.PI * 2;
  const speed = type === 'explosion' ? 3 : type === 'spark' ? 2 : 0.5;
  state.particles.push({
    x, y,
    vx: Math.cos(angle) * speed * (0.5 + Math.random()),
    vy: Math.sin(angle) * speed * (0.5 + Math.random()) - (type === 'smoke' ? 1 : 0),
    life: 30 + Math.random() * 30, maxLife: 60, color,
    size: type === 'explosion' ? 4 : type === 'smoke' ? 6 : 2, type,
  });
}

/** Aktualizuje pozycje i lifetime wszystkich cząsteczek. */
export function updateParticles(state: GameState) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.02;
    if (p.type === 'smoke') p.vy -= 0.05;
    p.life--;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

// ============ WORLD EVENTS ============

/** Generuje i aktualizuje zdarzenia świata (meteor, raid, trade caravan, resource vein). */
export function updateWorldEvents(state: GameState) {
  if (state.tick % 1800 === 0 && Math.random() < 0.3) {
    const types: WorldEvent['type'][] = ['meteor', 'raid', 'trade_caravan', 'resource_vein'];
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 30;
    state.events.push({
      id: genId(), type,
      x: Math.floor(state.player.x + Math.cos(angle) * dist),
      y: Math.floor(state.player.y + Math.sin(angle) * dist),
      timer: 600, data: {},
    });
  }

  for (let i = state.events.length - 1; i >= 0; i--) {
    const event = state.events[i];
    event.timer--;

    if (event.type === 'raid' && event.timer === 500) {
      const count = Math.floor(5 + state.evolution * 10);
      for (let j = 0; j < count; j++) {
        const a = Math.random() * Math.PI * 2;
        const d = 25 + Math.random() * 10;
        const stats = ENEMY_STATS.biter;
        const enemy: Enemy = {
          id: genId(), type: 'biter',
          x: event.x + Math.cos(a) * d, y: event.y + Math.sin(a) * d,
          health: stats.health * (1 + state.evolution), maxHealth: stats.health * (1 + state.evolution),
          attack: stats.attack * (1 + state.evolution * 0.5), speed: stats.speed,
          range: stats.range, target: null, evolution: state.evolution,
          state: 'moving', attackCooldown: 0, spawnerId: null,
        };
        state.enemies.set(enemy.id, enemy);
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
      };
      state.npcs.set(npc.id, npc);
    }

    if (event.type === 'resource_vein' && event.timer === 500) {
      const resources: ResourceType[] = ['iron', 'copper', 'coal', 'stone'];
      const resource = resources[Math.floor(Math.random() * resources.length)];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tile = getTileAt(state, event.x + dx, event.y + dy);
          if (!tile.building) {
            tile.resource = resource;
            tile.resourceAmount = 500 + Math.random() * 500;
          }
        }
      }
    }

    if (event.type === 'meteor' && event.timer === 300) {
      spawnParticle(state, event.x * TILE_SIZE, event.y * TILE_SIZE, 'explosion', '#ff4400');
      const tile = getTileAt(state, event.x, event.y);
      if (!tile.building) {
        tile.resource = 'uranium';
        tile.resourceAmount = 200;
      }
    }

    if (event.timer <= 0) state.events.splice(i, 1);
  }
}

// ============ WEATHER ============

/** Zmienia pogodę (clear/rain/storm/fog) losowo co 3000-6000 ticków. */
export function updateWeather(state: GameState) {
  state.weatherTimer--;
  if (state.weatherTimer <= 0) {
    const weathers: GameState['weather'][] = ['clear', 'clear', 'clear', 'rain', 'storm', 'fog'];
    state.weather = weathers[Math.floor(Math.random() * weathers.length)];
    state.weatherTimer = 3000 + Math.random() * 3000;
  }
}

// ============ RESEARCH ============

/** Aplikuje efekty odblokowanego badania (miningSpeed, craftingSpeed, playerSpeed, playerHealth). */
function applyResearchEffects(state: GameState, researchId: string) {
  const research = state.research.get(researchId);
  if (!research) return;
  for (const [key, value] of Object.entries(research.effects)) {
    switch (key) {
      case 'miningSpeed': state.player.miningSpeed *= value; break;
      case 'craftingSpeed': state.player.craftingSpeed *= value; break;
      case 'playerSpeed': state.player.speed *= value; break;
      case 'playerHealth': state.player.maxHealth *= value; state.player.health = state.player.maxHealth; break;
    }
  }
}

// ============ INVENTORY HELPERS ============

/** Dodaje item do input inventory budynku (stackowanie lub push). */
function addItemToBuilding(building: Building, itemId: string, count: number) {
  const slot = building.inventory.find(s => s.itemId === itemId);
  if (slot) slot.count += count;
  else building.inventory.push({ itemId, count });
}

/** Dodaje item do output inventory budynku. */
function addItemToBuildingOutput(building: Building, itemId: string, count: number) {
  const slot = building.outputInventory.find(s => s.itemId === itemId);
  if (slot) slot.count += count;
  else building.outputInventory.push({ itemId, count });
}

/** Usuwa item z input inventory budynku (usuwa slot jeśli count <= 0). */
function removeItemFromBuilding(building: Building, itemId: string, count: number) {
  const slot = building.inventory.find(s => s.itemId === itemId);
  if (slot) {
    slot.count -= count;
    if (slot.count <= 0) building.inventory = building.inventory.filter(s => s.count > 0);
  }
}

/** Usuwa item z output inventory budynku. */
function removeItemFromBuildingOutput(building: Building, itemId: string, count: number) {
  const slot = building.outputInventory.find(s => s.itemId === itemId);
  if (slot) {
    slot.count -= count;
    if (slot.count <= 0) building.outputInventory = building.outputInventory.filter(s => s.count > 0);
  }
}

/** Dodaje item do ekwipunku gracza (stackowanie lub push). */
export function addItemToPlayer(state: GameState, itemId: string, count: number) {
  const slot = state.player.inventory.find(s => s.itemId === itemId);
  if (slot) slot.count += count;
  else state.player.inventory.push({ itemId, count });
}

/** Usuwa item z ekwipunku gracza (zwraca false jeśli brakuje). */
export function removeItemFromPlayer(state: GameState, itemId: string, count: number): boolean {
  const slot = state.player.inventory.find(s => s.itemId === itemId);
  if (!slot || slot.count < count) return false;
  slot.count -= count;
  if (slot.count <= 0) state.player.inventory = state.player.inventory.filter(s => s.count > 0);
  return true;
}

// ============ BUILDING UPGRADE ============

/** Koszty ulepszeń dla poziomów 2→3. */

const UPGRADE_COSTS: Record<number, { itemId: string; count: number }[]> = {
  2: [{ itemId: 'iron_plate', count: 10 }, { itemId: 'circuit', count: 5 }],
  3: [{ itemId: 'steel_plate', count: 10 }, { itemId: 'advanced_circuit', count: 5 }],
};

/** Zwraca koszt ulepszenia budynku z poziomu `level` do `level+1`. */
export function getUpgradeCost(level: number): { itemId: string; count: number }[] {
  return UPGRADE_COSTS[level + 1] || [];
}

/** Sprawdza czy gracza stać na ulepszenie budynku z danego poziomu. */
export function canAffordUpgrade(state: GameState, level: number): boolean {
  const cost = UPGRADE_COSTS[level + 1];
  if (!cost) return false;
  return cost.every(c => {
    const slot = state.player.inventory.find(s => s.itemId === c.itemId);
    return slot && slot.count >= c.count;
  });
}

/** Ulepsza budynek (max level 3): zwiększa level, health×1.5, zdejmuje koszt. */
export function upgradeBuilding(state: GameState, x: number, y: number): boolean {
  const key = `${x},${y}`;
  const building = state.buildings.get(key);
  if (!building || building.level >= 3) return false;

  const cost = UPGRADE_COSTS[building.level + 1];
  if (!cost) return false;
  if (!cost.every(c => {
    const slot = state.player.inventory.find(s => s.itemId === c.itemId);
    return slot && slot.count >= c.count;
  })) return false;

  for (const c of cost) {
    removeItemFromPlayer(state, c.itemId, c.count);
  }

  building.level++;
  building.maxHealth = Math.floor(building.maxHealth * 1.5);
  building.health = building.maxHealth;
  grantXPToPlayer(state, 10);
  return true;
}

// ============ PLAYER MINING ============

/** Ręczne kopanie surowca przez gracza — 1 jednostka na interakcję. */
export function playerMine(state: GameState, tx: number, ty: number) {
  const tile = getTileAt(state, tx, ty);
  if (tile.resource && tile.resourceAmount > 0 && tile.resource !== 'water') {
    const minedResource = tile.resource;
    tile.resourceAmount -= 1;
    if (tile.resourceAmount <= 0) tile.resource = null;
    addItemToPlayer(state, minedResource, 1);
    spawnParticle(state, tx * TILE_SIZE + 16, ty * TILE_SIZE + 16, 'resource', RESOURCE_COLORS[minedResource] || '#fff');
    grantXPToPlayer(state, 1);
    return true;
  }
  return false;
}

// ============ XP & LEVEL SYSTEM ============

/** Dodaje XP graczowi, sprawdza level-up (wymagane level*500 XP na level), daje gem i powiadomienie. */
export function grantXPToPlayer(state: GameState, amount: number, notify?: (msg: string) => void) {
  state.player.xp += amount;
  // Require level * 500 XP per level (5× slower progression)
  let requiredXP = state.player.level * 500;
  while (state.player.xp >= requiredXP) {
    state.player.xp -= requiredXP;
    state.player.level++;
    state.player.premiumCurrency += 3;
    state.player.gems += 1;
    const msg = `Level Up! Now level ${state.player.level}! +1 gem`;
    if (notify) {
      notify(msg);
    }
    state.notifications.push({ text: msg, timer: 180 });
    requiredXP = state.player.level * 500;
  }
}

// ============ ACHIEVEMENT SYSTEM ============

/** Definicja achievementu z funkcją check(state). */

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  check: (state: GameState) => boolean;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_mine',        name: 'First Strike',       description: 'Mine your first resource.',                  check: s => Object.values(s.statistics.itemsProduced).some(v => v > 0) || s.statistics.buildingsPlaced > 0 || (s.player.inventory.find(i => i.itemId === 'iron')?.count ?? 50) < 50 },
  { id: 'builder',           name: 'Builder',             description: 'Place 10 buildings.',                        check: s => s.statistics.buildingsPlaced >= 10 },
  { id: 'architect',         name: 'Architect',           description: 'Place 50 buildings.',                        check: s => s.statistics.buildingsPlaced >= 50 },
  { id: 'first_plate',       name: 'Ironworker',          description: 'Produce your first iron plate.',             check: s => (s.statistics.itemsProduced['iron_plate'] || 0) >= 1 },
  { id: 'automation',        name: 'Automation Begins',   description: 'Produce 100 iron plates automatically.',     check: s => (s.statistics.itemsProduced['iron_plate'] || 0) >= 100 },
  { id: 'first_enemy',       name: 'First Blood',         description: 'Kill your first enemy.',                     check: s => s.statistics.enemiesKilled >= 1 },
  { id: 'exterminator',      name: 'Exterminator',        description: 'Kill 25 enemies.',                           check: s => s.statistics.enemiesKilled >= 25 },
  { id: 'level5',            name: 'Seasoned',            description: 'Reach player level 5.',                      check: s => s.player.level >= 5 },
  { id: 'level10',           name: 'Veteran',             description: 'Reach player level 10.',                     check: s => s.player.level >= 10 },
  { id: 'first_research',    name: 'Scientist',           description: 'Unlock your first technology.',              check: s => [...s.research.values()].some(r => r.unlocked) },
  { id: 'power_grid',        name: 'Electrified',         description: 'Build a boiler and a steam engine.',         check: s => [...s.buildings.values()].some(b => b.type === 'boiler') && [...s.buildings.values()].some(b => b.type === 'steam_engine') },
  { id: 'rich',              name: 'Gem Collector',       description: 'Earn 50 gems.',                              check: s => s.player.premiumCurrency >= 50 },
  { id: 'circuit_prod',      name: 'Circuitry',           description: 'Produce your first circuit.',                check: s => (s.statistics.itemsProduced['circuit'] || 0) >= 1 },
  { id: 'polluter',          name: 'Industrial Smog',     description: 'Reach 500 pollution.',                       check: s => s.pollution >= 500 },
  { id: 'survivor',          name: 'Survivor',            description: 'Play for 30 minutes.',                       check: s => s.statistics.timePlayed >= 60 * 30 * 60 },
];

/** Sprawdza wszystkie achievementy i odblokowuje nowe (z nagrodą gems). */
export function checkAchievements(state: GameState) {
  for (const def of ACHIEVEMENT_DEFS) {
    if (state.player.achievements.includes(def.id)) continue;
    if (def.check(state)) {
      state.player.achievements.push(def.id);
      state.notifications.push({ text: `🏆 Achievement: ${def.name} — ${def.description}`, timer: 300 });
      state.player.premiumCurrency += 2; // small gem bonus (legacy)
      state.player.gems += 1;
    }
  }
}

/** Katalog osiągnięć do wyświetlenia w UI (bez funkcji check). */
export const ACHIEVEMENT_CATALOG = ACHIEVEMENT_DEFS.map(({ id, name, description }) => ({ id, name, description }));

/** Odsłania obszar w promieniu 8 tile'i wokół gracza (visibility = 1). */
export function updateVisibility(state: GameState) {
  const radius = 8;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const tile = getTileAt(state, px + dx, py + dy);
      tile.visibility = 1;
    }
  }
}
