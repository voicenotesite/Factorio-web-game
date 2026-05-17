import { GameState, Building } from './types';
import { CHUNK_SIZE, TILE_SIZE, RESEARCH_TREE, DAY_LENGTH, RECIPES, MAX_PARTICLES, BUILDING_SIZES } from './constants';
import { generateChunk, getChunkKey, initWorldSeed } from './world';
import { GameRenderer } from './renderer';
import {
  placeBuilding, removeBuilding, updateProduction, updateConveyors,
  spawnNPCs, updateNPCs, spawnEnemies, updateEnemies,
  updatePollution, updateParticles, updateWorldEvents, updateWeather,
  updateVisibility, playerMine, addItemToPlayer, spawnParticle,
  canAffordBuilding, payBuildingCost, getBuildingCost, grantXPToPlayer, getTileAt, checkAchievements,
} from './systems';

export class GameEngine {
  state: GameState;
  renderer: GameRenderer;
  keys: Set<string> = new Set();
  mouse: { x: number; y: number; worldX: number; worldY: number; down: boolean; rightDown: boolean } = {
    x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false,
  };
  selectedBuilding: string | null = null;
  selectedDirection: string = 'right';
  selectedRecipe: string | null = null;
  running = false;
  lastTime = 0;
  tickAccumulator = 0;
  onStateChange?: (state: GameState) => void;
  hoveredTile: { x: number; y: number } | null = null;
  notifications: { text: string; timer: number; type?: string }[] = [];
  isPlayerMoving = false;
  private targetZoom = 1.5;
  private miningCooldown = 0;
  private lastMinedTile = '';

  constructor(canvas: HTMLCanvasElement) {
    this.state = this.createInitialState();
    this.renderer = new GameRenderer(canvas);
    this.setupInput(canvas);
  }

  private createInitialState(): GameState {
    const research = new Map<string, GameState['research'] extends Map<string, infer V> ? V : never>();
    for (const [key, val] of Object.entries(RESEARCH_TREE)) {
      research.set(key, { ...val, unlocked: false, progress: 0 });
    }

    return {
      player: {
        x: 0, y: 0,
        health: 100, maxHealth: 100,
        inventory: [
          { itemId: 'iron', count: 200 },
          { itemId: 'copper', count: 150 },
          { itemId: 'coal', count: 150 },
          { itemId: 'stone', count: 200 },
          { itemId: 'wood', count: 50 },
          { itemId: 'iron_plate', count: 80 },
          { itemId: 'copper_plate', count: 40 },
          { itemId: 'gear', count: 30 },
          { itemId: 'circuit', count: 10 },
        ],
        selectedSlot: 0,
        direction: 'right',
        speed: 0.13,
        reach: 6,
        miningSpeed: 1,
        craftingSpeed: 1,
        xp: 0,
        level: 1,
        premiumCurrency: 0,
        gems: 0,
        premiumBalance: 0,
        premiumTier: 'free' as const,
        cosmetics: { skinColor: '#3388ee', hatType: 'none', trailEffect: 'none' },
        achievements: [],
        totalPlayTime: 0,
      },
      camera: { x: 0, y: 0, zoom: 1.5 },
      chunks: new Map(),
      buildings: new Map(),
      npcs: new Map(),
      enemies: new Map(),
      spawners: new Map(),
      conveyors: new Map(),
      particles: [],
      events: [],
      research,
      tick: 0,
      pollution: 0,
      evolution: 0,
      powerGrid: new Map(),
      dayTime: DAY_LENGTH * 0.25,
      dayLength: DAY_LENGTH,
      weather: 'clear',
      weatherTimer: 3000,
      statistics: {
        itemsProduced: {},
        itemsConsumed: {},
        enemiesKilled: 0,
        buildingsPlaced: 0,
        timePlayed: 0,
      },
      notifications: [],
      buildQueue: [],
      worldSeed: Math.floor(Math.random() * 900000) + 100000,
      coopVisitors: new Map(),
    };
  }

  private setupInput(canvas: HTMLCanvasElement) {
    this.keyDownHandler = (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'b' || e.key === 'B') this.onStateChange && null; // handled in React
      if (e.key === 'q' || e.key === 'Q') {
        const dirs = ['up', 'right', 'down', 'left'];
        const idx = dirs.indexOf(this.selectedDirection);
        this.selectedDirection = dirs[(idx + 1) % 4];
      }
      // E: pick building type from hovered tile
      if ((e.key === 'e' || e.key === 'E') && this.hoveredTile) {
        const building = getTileAt(this.state, this.hoveredTile.x, this.hoveredTile.y)?.building;
        if (building) {
          this.selectedBuilding = building.type;
          this.selectedDirection = building.direction;
        }
      }
      // F: mine/interact at hovered tile
      if (e.key === 'f' || e.key === 'F') {
        if (this.hoveredTile) {
          const dist = Math.sqrt((this.hoveredTile.x - this.state.player.x) ** 2 + (this.hoveredTile.y - this.state.player.y) ** 2);
          if (dist <= this.state.player.reach) {
            playerMine(this.state, this.hoveredTile.x, this.hoveredTile.y);
          }
        }
      }
      // Escape: deselect building
      if (e.key === 'Escape') {
        this.selectedBuilding = null;
      }
    };
    window.addEventListener('keydown', this.keyDownHandler);

    this.keyUpHandler = (e) => {
      this.keys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keyup', this.keyUpHandler);

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.worldX = (this.mouse.x - canvas.width / 2) / this.state.camera.zoom + this.state.camera.x;
      this.mouse.worldY = (this.mouse.y - canvas.height / 2) / this.state.camera.zoom + this.state.camera.y;
      this.hoveredTile = {
        x: Math.floor(this.mouse.worldX / TILE_SIZE),
        y: Math.floor(this.mouse.worldY / TILE_SIZE),
      };
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rightDown = true;
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support for mobile: map touch events → mouse state so
    // handleMouseActions() works identically on mobile and desktop.
    const touchToTile = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      const sx = touch.clientX - rect.left;
      const sy = touch.clientY - rect.top;
      // Canvas internal size may differ from CSS size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = sx * scaleX;
      const cy = sy * scaleY;
      this.mouse.x = cx;
      this.mouse.y = cy;
      this.mouse.worldX = (cx - canvas.width / 2) / this.state.camera.zoom + this.state.camera.x;
      this.mouse.worldY = (cy - canvas.height / 2) / this.state.camera.zoom + this.state.camera.y;
      this.hoveredTile = {
        x: Math.floor(this.mouse.worldX / TILE_SIZE),
        y: Math.floor(this.mouse.worldY / TILE_SIZE),
      };
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        touchToTile(e.touches[0]);
        this.mouse.down = true;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        touchToTile(e.touches[0]);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    }, { passive: false });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
      this.targetZoom = Math.max(0.4, Math.min(5, this.targetZoom * zoomFactor));
    }, { passive: false });
  }

  /** Mobile: mine tile directly in front of / under the player */
  mineInFront() {
    const { player } = this.state;
    const offsets: Record<string, [number, number]> = {
      up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
    };
    const [dx, dy] = offsets[player.direction] || [0, 1];
    for (let r = 0; r <= Math.ceil(player.reach); r++) {
      const tx = Math.floor(player.x + dx * r);
      const ty = Math.floor(player.y + dy * r);
      if (playerMine(this.state, tx, ty)) return;
    }
  }

  start() {
    this.running = true;
    // Apply per-player world seed before generating any chunks
    initWorldSeed(this.state.worldSeed);
    for (let cy = -3; cy <= 3; cy++) {
      for (let cx = -3; cx <= 3; cx++) {
        const key = getChunkKey(cx, cy);
        if (!this.state.chunks.get(key)) {
          this.state.chunks.set(key, generateChunk(cx, cy));
        }
      }
    }
    this.lastTime = performance.now();
    // Pre-spawn a couple NPCs to make world feel alive from start
    for (let i = 0; i < 2; i++) spawnNPCs(this.state);
    this.loop();
  }

  /** Call before start() to tie the world seed to the logged-in username */
  setSeedFromUsername(username: string) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash |= 0;
    }
    this.state.worldSeed = Math.abs(hash) % 900000 + 100000;
  }

  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  stop() {
    this.running = false;
    if (this.keyDownHandler) { window.removeEventListener('keydown', this.keyDownHandler); this.keyDownHandler = null; }
    if (this.keyUpHandler) { window.removeEventListener('keyup', this.keyUpHandler); this.keyUpHandler = null; }
  }

  private loop = () => {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;

    this.tickAccumulator += dt;
    while (this.tickAccumulator >= 16.67) {
      this.update();
      this.tickAccumulator -= 16.67;
    }

    this.renderer.ghostBuilding = this.selectedBuilding;
    this.renderer.ghostTile = this.hoveredTile;
    this.renderer.ghostDirection = this.selectedDirection;
    this.renderer.ghostCanAfford = this.selectedBuilding ? canAffordBuilding(this.state, this.selectedBuilding) : false;
    this.renderer.render(this.state);
    requestAnimationFrame(this.loop);
  };

  private update() {
    const state = this.state;
    state.tick++;
    state.statistics.timePlayed++;
    state.player.totalPlayTime++;

    state.dayTime = (state.dayTime + 1) % state.dayLength;

    this.updatePlayerMovement();
    this.updateCamera();
    this.generateChunksAroundPlayer();
    this.handleMouseActions();
    if (this.miningCooldown > 0) this.miningCooldown--;
    this.spawnAmbientParticles();

    updateProduction(state);
    updateConveyors(state);
    updateNPCs(state);
    updateEnemies(state);
    updatePollution(state);
    updateParticles(state);
    updateWeather(state);
    updateVisibility(state);

    if (state.tick % 900 === 0) spawnNPCs(state);
    if (state.tick % 60 === 0) spawnEnemies(state);
    if (state.tick % 1800 === 0) updateWorldEvents(state);
    if (state.tick % 120 === 0) checkAchievements(state);

    if (state.tick % 120 === 0 && state.player.health < state.player.maxHealth) {
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 1);
    }

    // Clamp player health
    if (state.player.health <= 0) {
      state.player.health = state.player.maxHealth * 0.5;
      this.addNotification('You were knocked out! Recovering...');
    }

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].timer--;
      if (this.notifications[i].timer <= 0) this.notifications.splice(i, 1);
    }

    // Drain state notifications (e.g., from level-up) into engine notifications
    while (state.notifications.length > 0) {
      const n = state.notifications.shift()!;
      this.notifications.push(n);
    }

    this.onStateChange?.(state);
  }

  private updatePlayerMovement() {
    const { player } = this.state;
    let dx = 0, dy = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    this.isPlayerMoving = dx !== 0 || dy !== 0;
    this.renderer.isPlayerMoving = this.isPlayerMoving;

    if (this.isPlayerMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      const sprintMult = this.keys.has('shift') ? 1.9 : 1;
      player.x += dx * player.speed * sprintMult;
      player.y += dy * player.speed * sprintMult;

      if (Math.abs(dx) > Math.abs(dy)) {
        player.direction = dx > 0 ? 'right' : 'left';
      } else {
        player.direction = dy > 0 ? 'down' : 'up';
      }
    }
  }

  private updateCamera() {
    const state = this.state;
    const targetCamX = state.player.x * TILE_SIZE;
    const targetCamY = state.player.y * TILE_SIZE;
    const lerpSpeed = 0.15;
    state.camera.x += (targetCamX - state.camera.x) * lerpSpeed;
    state.camera.y += (targetCamY - state.camera.y) * lerpSpeed;
    state.camera.zoom += (this.targetZoom - state.camera.zoom) * 0.12;
  }

  private generateChunksAroundPlayer() {
    const px = Math.floor(this.state.player.x / CHUNK_SIZE);
    const py = Math.floor(this.state.player.y / CHUNK_SIZE);
    const dist = 5;

    for (let cy = py - dist; cy <= py + dist; cy++) {
      for (let cx = px - dist; cx <= px + dist; cx++) {
        const key = getChunkKey(cx, cy);
        if (!this.state.chunks.get(key)) {
          this.state.chunks.set(key, generateChunk(cx, cy));
        }
      }
    }

    for (const [key] of this.state.chunks) {
      const [cxStr, cyStr] = key.split(',');
      const cx = parseInt(cxStr);
      const cy = parseInt(cyStr);
      if (Math.abs(cx - px) > dist + 2 || Math.abs(cy - py) > dist + 2) {
        this.state.chunks.delete(key);
      }
    }
  }

  private handleMouseActions() {
    if (!this.hoveredTile) return;
    const { x, y } = this.hoveredTile;

    if (this.mouse.down) {
      if (this.selectedBuilding) {
        if (!canAffordBuilding(this.state, this.selectedBuilding)) {
          this.addNotification('Not enough resources!', 'error');
          // Don't clear selection so player can see what they need
        } else if (placeBuilding(this.state, this.selectedBuilding, x, y, this.selectedDirection)) {
          this.addNotification(`Placed ${this.selectedBuilding.replace(/_/g, ' ')}`, 'success');
          // Keep selected to allow placing multiple (Shift+click or just click again)
        }
      } else {
        const dist = Math.sqrt((x - this.state.player.x) ** 2 + (y - this.state.player.y) ** 2);
        const tileKey = `${x},${y}`;
        if (dist <= this.state.player.reach) {
          if (this.miningCooldown <= 0 || this.lastMinedTile !== tileKey) {
            if (playerMine(this.state, x, y)) {
              this.miningCooldown = 8;
              this.lastMinedTile = tileKey;
            }
          }
        }
      }
    }

    if (this.mouse.rightDown) {
      const tile = getTileAt(this.state, x, y);
      const building = tile?.building;
      if (building) {
        // Right-click existing building = remove and refund
        for (const item of [...building.inventory, ...building.outputInventory]) {
          addItemToPlayer(this.state, item.itemId, item.count);
        }
        if (removeBuilding(this.state, building.x, building.y)) {
          this.addNotification('Removed ' + building.type.replace(/_/g, ' '));
          // Also cancel any queued build at this position
          this.state.buildQueue = this.state.buildQueue.filter(q => !(q.x === x && q.y === y));
        }
      } else if (!this.selectedBuilding) {
        // Right-click on empty tile with no building selected = cancel queued build
        const queueIdx = this.state.buildQueue.findIndex(q => q.x === x && q.y === y);
        if (queueIdx !== -1) {
          const task = this.state.buildQueue[queueIdx];
          // Refund materials to player
          for (const c of getBuildingCost(task.type)) {
            addItemToPlayer(this.state, c.itemId, c.count);
          }
          this.state.buildQueue.splice(queueIdx, 1);
          this.addNotification(`Cancelled ${task.type.replace(/_/g, ' ')}`, 'info');
        }
      } else if (this.selectedBuilding) {
        // Right-click empty tile with building selected = queue for worker to build
        const dist = Math.sqrt((x - this.state.player.x) ** 2 + (y - this.state.player.y) ** 2);
        if (dist <= this.state.player.reach + 4) {
          // Check not already queued
          const alreadyQueued = this.state.buildQueue.some(q => q.x === x && q.y === y);
          if (!alreadyQueued && canAffordBuilding(this.state, this.selectedBuilding)) {
            const queueItem: import('./types').BuildQueueItem = {
              id: `bq_${Date.now()}_${Math.random()}`,
              type: this.selectedBuilding,
              x, y,
              direction: this.selectedDirection as import('./types').Direction,
              constructionProgress: 0,
            };
            this.state.buildQueue.push(queueItem);
            // Reserve the materials from player inventory immediately
            payBuildingCost(this.state, this.selectedBuilding);
            this.addNotification(`Queued ${this.selectedBuilding.replace(/_/g, ' ')} for worker`, 'build');
          } else if (!canAffordBuilding(this.state, this.selectedBuilding)) {
            this.addNotification('Not enough resources to queue build!', 'error');
          }
        }
      }
    }
  }

  private spawnAmbientParticles() {
    const state = this.state;
    // Ambient fireflies at night
    const dayPhase = state.dayTime / state.dayLength;
    const dayFactor = Math.max(0.25, Math.sin(dayPhase * Math.PI * 2) * 0.5 + 0.5);
    if (dayFactor < 0.4 && state.particles.length < MAX_PARTICLES && state.tick % 20 === 0) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 200;
      spawnParticle(state, state.player.x * TILE_SIZE + Math.cos(angle) * dist, state.player.y * TILE_SIZE + Math.sin(angle) * dist, 'ambient', '#aaff44');
    }
    // Dust near active miners
    if (state.tick % 30 === 0) {
      for (const [, b] of state.buildings) {
        if (b.type === 'miner' && b.isActive) {
          spawnParticle(state, b.x * TILE_SIZE + 16, b.y * TILE_SIZE, 'smoke', '#8a7a6a');
        }
      }
    }
  }

  getHoveredTile() { return this.hoveredTile; }
  getSelectedBuilding() { return this.selectedBuilding; }
  getSelectedDirection() { return this.selectedDirection; }
  canAffordSelected() { return this.selectedBuilding ? canAffordBuilding(this.state, this.selectedBuilding) : false; }

  addNotification(text: string, type: 'info' | 'error' | 'success' | 'build' = 'info') {
    this.notifications.push({ text, timer: 180, type });
  }

  grantXP(amount: number) {
    grantXPToPlayer(this.state, amount, (msg) => this.addNotification(msg));
  }

  setRecipeForBuilding(x: number, y: number, recipeId: string) {
    const key = `${x},${y}`;
    const building = this.state.buildings.get(key);
    if (building && (building.type === 'assembler' || building.type === 'furnace')) {
      const recipe = RECIPES[recipeId];
      if (recipe) {
        building.recipe = { ...recipe } as any;
        this.addNotification(`Recipe set: ${recipe.name}`);
      }
    }
  }

  startResearch(researchId: string) {
    const research = this.state.research.get(researchId);
    if (!research || research.unlocked) return;
    if (!research.prerequisites.every(p => this.state.research.get(p)?.unlocked)) return;
    for (const [, building] of this.state.buildings) {
      if (building.type === 'lab') {
        building.isActive = true;
        this.addNotification(`Research started: ${research.name}`);
        return;
      }
    }
    this.addNotification('Build a Lab first!');
  }

  getSerializableState() {
    const state = this.state;
    return {
      tick: state.tick,
      player: state.player,
      pollution: state.pollution,
      evolution: state.evolution,
      dayTime: state.dayTime,
      weather: state.weather,
      statistics: state.statistics,
      buildings: Array.from(state.buildings.entries()),
      research: Array.from(state.research.entries()).map(([k, v]) => [k, { ...v }]),
    };
  }

  loadFromSave(save: import('../lib/saveSystem').SaveData): void {
    this.state.tick = save.tick ?? 0;
    this.state.pollution = save.pollution ?? 0;
    this.state.evolution = save.evolution ?? 0;
    this.state.dayTime = save.dayTime ?? this.state.dayTime;
    this.state.weather = (save.weather as GameState['weather']) ?? 'clear';
    this.state.statistics = {
      itemsProduced: {},
      itemsConsumed: {},
      enemiesKilled: 0,
      buildingsPlaced: 0,
      timePlayed: 0,
      ...save.statistics,
    };
    this.state.buildQueue = [];  // always start with fresh build queue on load
    this.state.worldSeed = (save as any).worldSeed || this.state.worldSeed;
    initWorldSeed(this.state.worldSeed);
    Object.assign(this.state.player, save.player);
    this.state.player.gems = this.state.player.gems ?? 0;
    this.state.player.premiumCurrency = this.state.player.premiumCurrency ?? 0;
    this.state.player.premiumBalance = this.state.player.premiumBalance ?? 0;
    this.state.player.premiumTier = this.state.player.premiumTier ?? 'free';
    this.state.player.achievements = this.state.player.achievements ?? [];
    this.state.player.cosmetics = this.state.player.cosmetics ?? { skinColor: '#3388ee', hatType: 'none', trailEffect: 'none' };
    this.state.player.totalPlayTime = this.state.player.totalPlayTime ?? 0;
    this.state.player.health = this.state.player.health ?? this.state.player.maxHealth;
    this.state.player.maxHealth = this.state.player.maxHealth ?? 100;

    this.state.buildings.clear();
    for (const [key, b] of (save.buildings || [])) {
      this.state.buildings.set(key as string, b as any);
    }

    this.state.conveyors.clear();
    for (const [key, c] of (save.conveyors || [])) {
      this.state.conveyors.set(key as string, c as any);
    }

    for (const [key, val] of (save.research || [])) {
      const r = this.state.research.get(key as string);
      if (r) Object.assign(r, val as any);
    }

    this.state.npcs.clear();
    for (const [key, n] of (save.npcs || [])) {
      this.state.npcs.set(key as string, n as any);
    }

    // Clear building refs from tiles, then re-stamp
    for (const [, chunk] of this.state.chunks) {
      for (const row of chunk) {
        for (const tile of row) {
          tile.building = null;
        }
      }
    }
    for (const [, building] of this.state.buildings) {
      const size = BUILDING_SIZES[(building as Building).type as string] || { w: 1, h: 1 };
      for (let dy = 0; dy < size.h; dy++) {
        for (let dx = 0; dx < size.w; dx++) {
          const tx = (building as any).x + dx;
          const ty = (building as any).y + dy;
          const cx = Math.floor(tx / CHUNK_SIZE);
          const cy = Math.floor(ty / CHUNK_SIZE);
          const chunk = this.state.chunks.get(`${cx},${cy}`);
          if (chunk) {
            const lx = ((tx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ly = ((ty % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            chunk[ly][lx].building = building as any;
          }
        }
      }
    }

    this.addNotification('Game loaded!', 'success');
  }

  updateCoopVisitor(id: string, username: string, x: number, y: number, color: string) {
    if (!this.state.coopVisitors) this.state.coopVisitors = new Map();
    this.state.coopVisitors.set(id, { username, x, y, color });
  }

  removeCoopVisitor(id: string) {
    this.state.coopVisitors?.delete(id);
  }

  loadWorldData(worldData: { buildings: [string, unknown][]; seed: number }) {
    this.state.buildings.clear();
    this.state.conveyors.clear();

    for (const [key, b] of (worldData.buildings || [])) {
      this.state.buildings.set(key as string, b as any);
    }

    if (worldData.seed) {
      this.state.worldSeed = worldData.seed;
      initWorldSeed(worldData.seed);
    }
  }
}
