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

/**
 * Główny silnik gry – zarządza pętlą gry, stanem, wejściem i renderowaniem.
 * Łączy w sobie logikę aktualizacji systemów (ECS) z obsługą zdarzeń klawiatury/myszy/dotyku.
 */
export class GameEngine {
  /** Aktualny stan gry – gracz, chunk, budynki, NPC, wrogowie itd. */
  state: GameState;
  /** Renderer odpowiedzialny za wyświetlanie gry na canvasie. */
  renderer: GameRenderer;
  /** Zbiór aktualnie wciśniętych klawiszy (lowercase). */
  keys: Set<string> = new Set();
  /** Stan myszy (współrzędne ekranowe, światowe, przyciski). */
  mouse: { x: number; y: number; worldX: number; worldY: number; down: boolean; rightDown: boolean } = {
    x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false,
  };
  /** Aktualnie wybrany typ budynku do postawienia (null = brak). */
  selectedBuilding: string | null = null;
  /** Kierunek stawianego budynku. */
  selectedDirection: string = 'right';
  /** Wybrany przepis (receptura) dla maszyn. */
  selectedRecipe: string | null = null;
  /** Czy pętla gry jest aktywna. */
  running = false;
  /** Znacznik czasu poprzedniej klatki (do liczenia delty). */
  lastTime = 0;
  /** Akumulator czasu do stałego tickowania (16.67 ms na tick). */
  tickAccumulator = 0;
  /** Callback wywoływany po każdej zmianie stanu (np. do synchronizacji z Reactem). */
  onStateChange?: (state: GameState) => void;
  /** Callback wywoływany przy stawianiu/usuwaniu budynków przez gracza. */
  onBuildingAction?: (action: 'place' | 'remove', type: string, x: number, y: number, dir: string) => void;
  /** Kafelek nad którym aktualnie znajduje się kursor myszy. */
  hoveredTile: { x: number; y: number } | null = null;
  /** Lista powiadomień wyświetlanych graczowi. */
  notifications: { text: string; timer: number; type?: string }[] = [];
  /** Czy gracz aktualnie się porusza. */
  isPlayerMoving = false;
  /** Docelowy zoom kamery (płynnie animowany). */
  private targetZoom = 1.5;
  /** Opóźnienie między kolejnymi kopaniami (cooldown w tickach). */
  private miningCooldown = 0;
  /** Ostatni skopany kafelek (do uniknięcia wielokrotnego kopania w tym samym miejscu). */
  private lastMinedTile = '';

  /**
   * Tworzy nowy silnik gry i podpina go pod element canvas.
   * @param canvas - Element canvas, na którym będzie renderowana gra.
   */
  constructor(canvas: HTMLCanvasElement) {
    this.state = this.createInitialState();
    this.renderer = new GameRenderer(canvas);
    this.setupInput(canvas);
  }

  /**
   * Tworzy początkowy stan gry z domyślnymi wartościami dla gracza, ekwipunku,
   * kamery, drzewa badań oraz pustych kolekcji (chunki, budynki, NPC itp.).
   */
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

  /**
   * Ustawia nasłuchiwanie zdarzeń wejścia (klawiatura, mysz, dotyk, scroll).
   * Rejestruje handler dla keydown, keyup, mousemove, mousedown, mouseup,
   * contextmenu, touchstart, touchmove, touchend oraz wheel.
   */
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

  /**
   * Kopanie kafelka przed graczem (w kierunku, w którym patrzy).
   * Używane głównie na urządzeniach mobilnych jako zamiennik kliknięcia.
   */
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

  /**
   * Atakuje najbliższego wroga w zasięgu gracza (5 kratek).
   * Uwzględnia bonus z badań militarnych.
   * @returns true jeżeli znaleziono i zaatakowano wroga.
   */
  attackNearestEnemy(): boolean {
    const { player } = this.state;
    const range = 5;
    let nearest: { id: string; health: number; x: number; y: number } | null = null;
    let nearestDist = Infinity;
    for (const [, enemy] of this.state.enemies) {
      const d = Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2);
      if (d < range && d < nearestDist) { nearestDist = d; nearest = enemy as any; }
    }
    if (!nearest) return false;
    const milBonus = this.state.research.get('military')?.unlocked
      ? (this.state.research.get('military')!.effects.turretDamage || 1) : 1;
    const damage = 25 * milBonus;
    (nearest as any).health -= damage;
    spawnParticle(this.state, nearest.x * TILE_SIZE, nearest.y * TILE_SIZE, 'spark', '#ffaa00');
    if ((nearest as any).health <= 0) {
      this.state.enemies.delete((nearest as any).id);
      this.state.statistics.enemiesKilled++;
      grantXPToPlayer(this.state, 8);
      spawnParticle(this.state, nearest.x * TILE_SIZE, nearest.y * TILE_SIZE, 'explosion', '#ff6600');
    }
    return true;
  }

  /** Odznacza wybrany budynek (anuluje tryb stawiania). */
  cancelBuilding() {
    this.selectedBuilding = null;
  }

  /**
   * Usuwa najbliższy budynek w zasięgu gracza.
   * @returns true jeżeli usunięto budynek.
   */
  removeNearestBuilding(): boolean {
    const { player } = this.state;
    let nearest: { key: string; building: { x: number; y: number; type: string } } | null = null;
    let nearestDist = Infinity;
    for (const [key, building] of this.state.buildings) {
      const d = Math.sqrt((building.x - player.x) ** 2 + (building.y - player.y) ** 2);
      if (d < player.reach + 1 && d < nearestDist) {
        nearestDist = d;
        nearest = { key, building: building as any };
      }
    }
    if (!nearest) return false;
    if (removeBuilding(this.state, nearest.building.x, nearest.building.y)) {
      this.addNotification(`Removed ${nearest.building.type.replace(/_/g, ' ')}`, 'info');
      this.state.buildQueue = this.state.buildQueue.filter(
        q => !(q.x === nearest!.building.x && q.y === nearest!.building.y)
      );
      return true;
    }
    return false;
  }

  /**
   * Uruchamia główną pętlę gry: inicjalizuje ziarno świata, generuje początkowe
   * chunki, spawnuje pierwszych NPC i wywołuje pętlę renderowania.
   */
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

  /**
   * Ustawia ziarno świata na podstawie nazwy użytkownika.
   * Wywołać przed start(), aby świat był unikalny dla gracza.
   * @param username - Nazwa użytkownika, z której generowany jest hash.
   */
  setSeedFromUsername(username: string) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = ((hash << 5) - hash) + username.charCodeAt(i);
      hash |= 0;
    }
    this.state.worldSeed = Math.abs(hash) % 900000 + 100000;
  }

  /** Handler zdarzenia keydown – przechowuje referencję do usunięcia nasłuchiwania. */
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  /** Handler zdarzenia keyup – przechowuje referencję do usunięcia nasłuchiwania. */
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Zatrzymuje pętlę gry i usuwa nasłuchiwacze zdarzeń klawiatury. */
  stop() {
    this.running = false;
    if (this.keyDownHandler) { window.removeEventListener('keydown', this.keyDownHandler); this.keyDownHandler = null; }
    if (this.keyUpHandler) { window.removeEventListener('keyup', this.keyUpHandler); this.keyUpHandler = null; }
  }

  /**
   * Główna pętla gry – wywoływana przez requestAnimationFrame.
   * Oblicza deltę czasu, akumuluje ticki i aktualizuje stan, a następnie renderuje.
   */
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

  /**
   * Pojedynczy tick gry – aktualizuje pozycję gracza, kamerę, generuje chunki,
   * obsługuje akcje myszy i wszystkie systemy (produkcja, NPC, wrogowie itd.).
   */
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

  /** Aktualizuje pozycję gracza na podstawie wciśniętych klawiszy (WASD/strzałki). */
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

  /** Płynnie przesuwa kamerę za graczem i aktualizuje zoom (lerp). */
  private updateCamera() {
    const state = this.state;
    const targetCamX = state.player.x * TILE_SIZE;
    const targetCamY = state.player.y * TILE_SIZE;
    const lerpSpeed = 0.15;
    state.camera.x += (targetCamX - state.camera.x) * lerpSpeed;
    state.camera.y += (targetCamY - state.camera.y) * lerpSpeed;
    state.camera.zoom += (this.targetZoom - state.camera.zoom) * 0.12;
  }

  /** Generuje chunki wokół gracza i usuwa te zbyt odległe (LOD). */
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

  /**
   * Obsługuje akcje myszy/dotyku: stawianie budynków (LPM), kopanie (LPM bez
   * wybranego budynku), usuwanie / zwrot kosztów (PPM), kolejkowanie budowy (PPM
   * z wybranym budynkiem).
   */
  private handleMouseActions() {
    if (!this.hoveredTile) return;
    const { x, y } = this.hoveredTile;

    if (this.mouse.down) {
      if (this.selectedBuilding) {
        if (!canAffordBuilding(this.state, this.selectedBuilding)) {
          this.addNotification('Not enough resources!', 'error');
        } else if (placeBuilding(this.state, this.selectedBuilding, x, y, this.selectedDirection)) {
          this.addNotification(`Placed ${this.selectedBuilding.replace(/_/g, ' ')}`, 'success');
          this.onBuildingAction?.('place', this.selectedBuilding, x, y, this.selectedDirection);
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
      // Look up building from state.buildings directly (authoritative) — tile.building
      // can be null on freshly-generated chunks that haven't been re-stamped yet.
      let building = tile?.building ?? this.state.buildings.get(`${x},${y}`) ?? null;
      // For multi-tile buildings, the mouse might be on a non-anchor tile — scan nearby
      if (!building) {
        for (const [, b] of this.state.buildings) {
          const size = BUILDING_SIZES[(b as Building).type as string] || { w: 1, h: 1 };
          const bx = (b as Building).x, by = (b as Building).y;
          if (x >= bx && x < bx + size.w && y >= by && y < by + size.h) {
            building = b as Building;
            break;
          }
        }
      }
      if (building) {
        // Right-click existing building = remove and refund
        for (const item of [...building.inventory, ...building.outputInventory]) {
          addItemToPlayer(this.state, item.itemId, item.count);
        }
        const removedType = building.type;
        if (removeBuilding(this.state, building.x, building.y)) {
          this.addNotification('Removed ' + removedType.replace(/_/g, ' '));
          this.onBuildingAction?.('remove', removedType, building.x, building.y, building.direction);
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

  /** Generuje ambientowe cząsteczki (świetliki w nocy, kurz przy górnikach). */
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

  /** Zwraca aktualnie najechany kafelek. */
  getHoveredTile() { return this.hoveredTile; }
  /** Zwraca aktualnie wybrany typ budynku. */
  getSelectedBuilding() { return this.selectedBuilding; }
  /** Zwraca aktualnie wybrany kierunek stawiania. */
  getSelectedDirection() { return this.selectedDirection; }
  /** Sprawdza czy gracza stać na wybrany budynek. */
  canAffordSelected() { return this.selectedBuilding ? canAffordBuilding(this.state, this.selectedBuilding) : false; }

  /**
   * Dodaje powiadomienie do kolejki wyświetlania.
   * @param text - Treść powiadomienia.
   * @param type - Typ (info, error, success, build).
   */
  addNotification(text: string, type: 'info' | 'error' | 'success' | 'build' = 'info') {
    this.notifications.push({ text, timer: 180, type });
  }

  /**
   * Przyznaje graczowi punkty doświadczenia (z powiadomieniem).
   * @param amount - Liczba punktów PD.
   */
  grantXP(amount: number) {
    grantXPToPlayer(this.state, amount, (msg) => this.addNotification(msg));
  }

  /**
   * Ustawia przepis (recepturę) dla budynku (assembler / furnace).
   * @param x - Współrzędna X budynku.
   * @param y - Współrzędna Y budynku.
   * @param recipeId - Identyfikator przepisu.
   */
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

  /**
   * Rozpoczyna badanie technologii – wymaga laboratorium i spełnienia
   * prerequisite'ów.
   * @param researchId - Identyfikator technologii do zbadania.
   */
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

  /** Zwraca uproszczony, możliwy do serializacji stan gry (do zapisu / wysyłki). */
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

  /**
   * Wczytuje stan gry z obiektu zapisu (SaveData).
   * Przywraca ticki, gracza, budynki, badania, NPC i odświeża referencje budynków w chunkach.
   * @param save - Dane zapisu.
   */
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

  /**
   * Aktualizuje pozycję odwiedzającego w trybie kooperacji.
   * @param id - Identyfikator odwiedzającego.
   * @param username - Nazwa gracza.
   * @param x - Współrzędna X.
   * @param y - Współrzędna Y.
   * @param color - Kolor gracza.
   */
  updateCoopVisitor(id: string, username: string, x: number, y: number, color: string) {
    if (!this.state.coopVisitors) this.state.coopVisitors = new Map();
    this.state.coopVisitors.set(id, { username, x, y, color });
  }

  /** Usuwa odwiedzającego z listy kooperacji. */
  removeCoopVisitor(id: string) {
    this.state.coopVisitors?.delete(id);
  }

  /**
   * Stawia budynek w imieniu zdalnego gracza (kooperacja).
   * @param type - Typ budynku.
   * @param x - Współrzędna X.
   * @param y - Współrzędna Y.
   * @param dir - Kierunek.
   */
  placeBuildingFromCoop(type: string, x: number, y: number, dir: string) {
    const success = placeBuilding(this.state, type, x, y, dir, true);
    if (success) {
      this.addNotification(`Co-op: ${type.replace(/_/g, ' ')} placed`, 'success');
    }
  }

  removeBuildingFromCoop(x: number, y: number) {
    const building = this.state.buildings.get(`${x},${y}`);
    if (building) {
      removeBuilding(this.state, x, y);
      this.addNotification(`Co-op: ${building.type.replace(/_/g, ' ')} removed`, 'info');
    }
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
