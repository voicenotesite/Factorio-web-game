import { GameState, Tile, Building, NPC, Enemy } from './types';
import { CHUNK_SIZE, TILE_SIZE, BUILDING_SIZES, BUILDING_COLORS, RESOURCE_COLORS } from './constants';
import { getTileColor, hasTreeAt, getYieldColor } from './world';

const DIR_OFFSETS: Record<string, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const NPC_COLORS: Record<string, { body: string; accent: string }> = {
  worker: { body: '#3b7ddd', accent: '#5a9bff' },
  scout: { body: '#2ea043', accent: '#56d364' },
  trader: { body: '#d4a017', accent: '#f0c040' },
  guard: { body: '#c43b3b', accent: '#e85555' },
  settler: { body: '#8b6bb5', accent: '#a88bd4' },
};

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameCount = 0;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;
  }

  render(state: GameState) {
    this.frameCount++;
    const { ctx, canvas } = this;
    const { camera } = state;
    const dayPhase = state.dayTime / state.dayLength;
    const dayFactor = Math.max(0.25, Math.sin(dayPhase * Math.PI * 2) * 0.5 + 0.5);
    const isNight = dayFactor < 0.5;

    // Sky gradient based on time
    const skyR = Math.floor(10 + dayFactor * 15);
    const skyG = Math.floor(10 + dayFactor * 20);
    const skyB = Math.floor(25 + dayFactor * 30);
    ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    const viewLeft = camera.x - canvas.width / 2 / camera.zoom;
    const viewTop = camera.y - canvas.height / 2 / camera.zoom;
    const viewRight = camera.x + canvas.width / 2 / camera.zoom;
    const viewBottom = camera.y + canvas.height / 2 / camera.zoom;

    const startCX = Math.floor(viewLeft / TILE_SIZE / CHUNK_SIZE) - 1;
    const startCY = Math.floor(viewTop / TILE_SIZE / CHUNK_SIZE) - 1;
    const endCX = Math.floor(viewRight / TILE_SIZE / CHUNK_SIZE) + 1;
    const endCY = Math.floor(viewBottom / TILE_SIZE / CHUNK_SIZE) + 1;

    // Render ground layer
    for (let cy = startCY; cy <= endCY; cy++) {
      for (let cx = startCX; cx <= endCX; cx++) {
        const key = `${cx},${cy}`;
        const chunk = state.chunks.get(key);
        if (!chunk) continue;
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const tile = chunk[ly][lx];
            const sx = tile.x * TILE_SIZE;
            const sy = tile.y * TILE_SIZE;
            if (sx + TILE_SIZE < viewLeft || sx > viewRight || sy + TILE_SIZE < viewTop || sy > viewBottom) continue;
            this.renderTile(ctx, tile, dayFactor, state);
          }
        }
      }
    }

    // Render conveyors (below buildings)
    this.renderConveyors(ctx, state, viewLeft, viewTop, viewRight, viewBottom);

    // Render buildings with shadows
    const sortedBuildings = Array.from(state.buildings.values())
      .filter(b => {
        const sx = b.x * TILE_SIZE;
        const sy = b.y * TILE_SIZE;
        return sx >= viewLeft - 100 && sx <= viewRight + 100 && sy >= viewTop - 100 && sy <= viewBottom + 100;
      })
      .sort((a, b) => a.y - b.y);

    for (const building of sortedBuildings) {
      this.renderBuilding(ctx, building, state);
    }

    // Render entities sorted by Y for depth
    const entities: { y: number; render: () => void }[] = [];

    for (const [, enemy] of state.enemies) {
      const ex = enemy.x * TILE_SIZE;
      const ey = enemy.y * TILE_SIZE;
      if (ex < viewLeft - 50 || ex > viewRight + 50 || ey < viewTop - 50 || ey > viewBottom + 50) continue;
      entities.push({ y: ey, render: () => this.renderEnemy(ctx, enemy, state) });
    }

    for (const [, npc] of state.npcs) {
      const nx = npc.x * TILE_SIZE;
      const ny = npc.y * TILE_SIZE;
      if (nx < viewLeft - 50 || nx > viewRight + 50 || ny < viewTop - 50 || ny > viewBottom + 50) continue;
      entities.push({ y: ny, render: () => this.renderNPC(ctx, npc, state) });
    }

    // Player
    const py = state.player.y * TILE_SIZE;
    entities.push({ y: py, render: () => this.renderPlayer(ctx, state) });

    entities.sort((a, b) => a.y - b.y);
    for (const e of entities) e.render();

    // Render particles
    this.renderParticles(ctx, state, viewLeft, viewTop, viewRight, viewBottom);

    // Render building glow effects (emissive)
    for (const building of sortedBuildings) {
      this.renderBuildingGlow(ctx, building);
    }

    ctx.restore();

    // Night lighting overlay
    if (isNight) {
      this.renderNightLighting(state, dayFactor);
    }

    // Weather overlay
    this.renderWeather(ctx, state);

    // Vignette
    this.renderVignette(ctx);

    // Damage flash
    if (state.player.health < state.player.maxHealth * 0.3) {
      const pulse = Math.sin(this.frameCount * 0.1) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(200,0,0,${pulse * 0.08})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  private renderTile(ctx: CanvasRenderingContext2D, tile: Tile, dayFactor: number, state: GameState) {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;

    // Base terrain with subtle variation
    const baseColor = getTileColor(tile, dayFactor);
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Terrain texture variation
    const hash = ((tile.x * 7919 + tile.y * 104729) & 0xFFFF) / 65535;
    if (hash > 0.85) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + hash * 0.02})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    } else if (hash < 0.15) {
      ctx.fillStyle = `rgba(0,0,0,0.03)`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }

    // Grid lines (very subtle at high zoom)
    if (state.camera.zoom > 2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }

    // Trees with depth
    if (hasTreeAt(tile.x, tile.y, tile.biome) && !tile.building) {
      this.renderTree(ctx, x, y, tile.biome, dayFactor);
    }

    // Resources
    if (tile.resource && tile.resourceAmount > 0 && !tile.building) {
      this.renderResource(ctx, tile);
    }

    // Pollution overlay
    if (tile.pollution > 0) {
      const pAlpha = Math.min(0.35, tile.pollution * 0.012);
      ctx.fillStyle = `rgba(120,90,50,${pAlpha})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private renderTree(ctx: CanvasRenderingContext2D, x: number, y: number, biome: string, dayFactor: number) {
    const cx = x + TILE_SIZE / 2;
    const treeBase = y + TILE_SIZE / 2 + 2;

    // Trunk
    ctx.fillStyle = biome === 'forest' ? '#2a1a0a' : '#3a2510';
    ctx.fillRect(cx - 2, treeBase, 4, 8);

    // Canopy layers
    const sway = Math.sin(this.frameCount * 0.02 + x * 0.1) * 1.5;
    const darkGreen = biome === 'forest' ? '#0f3a0a' : '#1a5a12';
    const lightGreen = biome === 'forest' ? '#1a5a12' : '#2d7a1e';

    // Shadow canopy
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(cx + sway, treeBase - 6, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Light canopy
    ctx.fillStyle = lightGreen;
    ctx.beginPath();
    ctx.ellipse(cx + sway * 0.7, treeBase - 8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = `rgba(255,255,200,${0.05 * dayFactor})`;
    ctx.beginPath();
    ctx.ellipse(cx + sway * 0.5 - 2, treeBase - 10, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderResource(ctx: CanvasRenderingContext2D, tile: Tile) {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;
    const color = RESOURCE_COLORS[tile.resource!] || '#ffffff';

    if (tile.resource === 'water') {
      // Deep water
      ctx.fillStyle = '#1a4a8a';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      // Water surface with animated waves
      const wave1 = Math.sin(this.frameCount * 0.04 + tile.x * 0.7 + tile.y * 0.3) * 0.12;
      const wave2 = Math.sin(this.frameCount * 0.06 + tile.x * 0.3 - tile.y * 0.5) * 0.08;
      ctx.fillStyle = `rgba(60,140,220,${0.25 + wave1 + wave2})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      // Specular highlight
      const specX = x + 8 + Math.sin(this.frameCount * 0.03 + tile.x) * 4;
      const specY = y + 8 + Math.cos(this.frameCount * 0.04 + tile.y) * 3;
      ctx.fillStyle = 'rgba(180,220,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(specX, specY, 4, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (tile.resource === 'oil') {
      ctx.fillStyle = '#0a0a1a';
      ctx.beginPath();
      ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Oil sheen
      const sheen = Math.sin(this.frameCount * 0.03 + tile.x) * 0.1;
      ctx.fillStyle = `rgba(80,40,120,${0.15 + sheen})`;
      ctx.beginPath();
      ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Resource deposit with 3D effect
    const count = Math.min(6, Math.ceil(tile.resourceAmount / 80));
    for (let i = 0; i < count; i++) {
      const dx = ((i * 7 + tile.x * 3) % 22) + 5;
      const dy = ((i * 11 + tile.y * 5) % 22) + 5;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + dx + 1, y + dy + 2, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Crystal/deposit
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 3, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(x + dx - 1, y + dy - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Yield quality indicator
    if (tile.resourceYield !== 'normal') {
      const yieldColor = getYieldColor(tile.resourceYield);
      ctx.fillStyle = yieldColor;
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE - 5, y + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (tile.resourceYield === 'rich' || tile.resourceYield === 'very_rich') {
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE - 5, y + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  private renderBuilding(ctx: CanvasRenderingContext2D, building: Building, _state: GameState) {
    const x = building.x * TILE_SIZE;
    const y = building.y * TILE_SIZE;
    const size = BUILDING_SIZES[building.type] || { w: 1, h: 1 };
    const w = size.w * TILE_SIZE;
    const h = size.h * TILE_SIZE;
    const color = BUILDING_COLORS[building.type] || '#888';

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const shadowOff = 4;
    ctx.beginPath();
    ctx.roundRect(x + shadowOff, y + shadowOff, w, h, 2);
    ctx.fill();

    // Building body with gradient
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, lightenColor(color, 20));
    grad.addColorStop(1, darkenColor(color, 15));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.fill();

    // Top edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 1, y + 1, w - 2, 2);

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.stroke();

    // Direction arrow
    const dir = DIR_OFFSETS[building.direction];
    if (dir) {
      const arrowX = x + w / 2 + dir.dx * w / 3;
      const arrowY = y + h / 2 + dir.dy * h / 3;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Progress bar
    if (building.recipe && building.progress > 0) {
      const progress = building.progress / building.recipe.craftTime;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(x, y - 8, w, 5, 2);
      ctx.fill();
      const barGrad = ctx.createLinearGradient(x, 0, x + w * progress, 0);
      barGrad.addColorStop(0, '#00cc66');
      barGrad.addColorStop(1, '#00ff88');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y - 7.5, (w - 1) * progress, 4, 1.5);
      ctx.fill();
    }

    // Health bar
    if (building.health < building.maxHealth) {
      const hp = building.health / building.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(x, y + h + 3, w, 4, 2);
      ctx.fill();
      const hpColor = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 3.5, (w - 1) * hp, 3, 1.5);
      ctx.fill();
    }

    // Active pulse
    if (building.isActive) {
      const pulse = Math.sin(this.frameCount * 0.08) * 0.15 + 0.15;
      ctx.fillStyle = `rgba(0,255,136,${pulse})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 2);
      ctx.fill();
    }

    // Type-specific details
    this.renderBuildingDetails(ctx, building, x, y, w, h);
  }

  private renderBuildingGlow(ctx: CanvasRenderingContext2D, building: Building) {
    const x = building.x * TILE_SIZE;
    const y = building.y * TILE_SIZE;
    const size = BUILDING_SIZES[building.type] || { w: 1, h: 1 };
    const w = size.w * TILE_SIZE;
    const h = size.h * TILE_SIZE;

    switch (building.type) {
      case 'furnace': {
        if (building.isActive) {
          const flicker = Math.sin(this.frameCount * 0.15) * 4 + 12;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, flicker);
          glow.addColorStop(0, 'rgba(255,120,20,0.3)');
          glow.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
        }
        break;
      }
      case 'lab': {
        if (building.isActive) {
          const pulse = Math.sin(this.frameCount * 0.05) * 0.1 + 0.15;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 20);
          glow.addColorStop(0, `rgba(0,200,255,${pulse})`);
          glow.addColorStop(1, 'rgba(0,100,255,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
        }
        break;
      }
      case 'boiler': {
        if (building.isActive) {
          const glow = ctx.createRadialGradient(x + w / 2, y, 0, x + w / 2, y, 15);
          glow.addColorStop(0, 'rgba(200,200,200,0.1)');
          glow.addColorStop(1, 'rgba(150,150,150,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 5, y - 15, w + 10, h + 10);
        }
        break;
      }
    }
  }

  private renderBuildingDetails(ctx: CanvasRenderingContext2D, building: Building, x: number, y: number, w: number, h: number) {
    switch (building.type) {
      case 'miner': {
        const angle = this.frameCount * 0.12;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(angle);
        ctx.fillStyle = '#555';
        ctx.fillRect(-10, -2.5, 20, 5);
        ctx.fillRect(-2.5, -10, 5, 20);
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Dust particles when active
        if (building.isActive && this.frameCount % 8 === 0) {
          ctx.fillStyle = 'rgba(150,130,100,0.3)';
          for (let i = 0; i < 3; i++) {
            const dx = (Math.random() - 0.5) * w;
            const dy = -Math.random() * 8;
            ctx.beginPath();
            ctx.arc(x + w / 2 + dx, y + dy, 2 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'furnace': {
        const flicker = Math.sin(this.frameCount * 0.2) * 2;
        // Fire core
        ctx.fillStyle = `rgba(255,${120 + flicker * 15},20,0.8)`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, 5 + flicker, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner flame
        ctx.fillStyle = `rgba(255,${200 + flicker * 10},80,0.6)`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2 - 2, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'assembler': {
        const angle = this.frameCount * 0.04;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        // Outer gear
        ctx.rotate(angle);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.fillStyle = '#999';
          ctx.fillRect(Math.cos(a) * 10 - 2.5, Math.sin(a) * 10 - 2.5, 5, 5);
        }
        // Inner gear (counter-rotate)
        ctx.rotate(-angle * 2);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.fillStyle = '#aaa';
          ctx.fillRect(Math.cos(a) * 5 - 1.5, Math.sin(a) * 5 - 1.5, 3, 3);
        }
        ctx.restore();
        break;
      }
      case 'lab': {
        // Flask with bubbling liquid
        const bubbleY = Math.sin(this.frameCount * 0.06) * 2;
        ctx.fillStyle = '#0088cc';
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 5, y + h / 2 + 4);
        ctx.lineTo(x + w / 2 + 5, y + h / 2 + 4);
        ctx.lineTo(x + w / 2 + 3, y + h / 2 - 4 + bubbleY);
        ctx.lineTo(x + w / 2 - 3, y + h / 2 - 4 + bubbleY);
        ctx.fill();
        // Flask neck
        ctx.fillStyle = '#aaa';
        ctx.fillRect(x + w / 2 - 2, y + h / 2 - 8, 4, 6);
        // Bubbles
        if (building.isActive) {
          ctx.fillStyle = 'rgba(0,200,255,0.5)';
          const by = y + h / 2 + 2 - (this.frameCount % 20) * 0.3;
          ctx.beginPath();
          ctx.arc(x + w / 2 + Math.sin(this.frameCount * 0.1) * 2, by, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'turret': {
        // Base
        ctx.fillStyle = '#880000';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        // Barrel
        const dir = DIR_OFFSETS[building.direction];
        if (dir) {
          ctx.strokeStyle = '#cc0000';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y + h / 2);
          ctx.lineTo(x + w / 2 + dir.dx * 14, y + h / 2 + dir.dy * 14);
          ctx.stroke();
          ctx.lineCap = 'butt';
          // Muzzle flash when attacking
          if (building.isActive && this.frameCount % 15 < 3) {
            ctx.fillStyle = 'rgba(255,200,50,0.7)';
            ctx.beginPath();
            ctx.arc(x + w / 2 + dir.dx * 16, y + h / 2 + dir.dy * 16, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'power_pole': {
        // Pole
        ctx.fillStyle = '#555';
        ctx.fillRect(x + TILE_SIZE / 2 - 1.5, y + 4, 3, TILE_SIZE - 8);
        // Cross arm
        ctx.fillRect(x + 4, y + 6, TILE_SIZE - 8, 2);
        // Insulators
        ctx.fillStyle = '#8af';
        ctx.beginPath();
        ctx.arc(x + 6, y + 6, 2, 0, Math.PI * 2);
        ctx.arc(x + TILE_SIZE - 6, y + 6, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'radar': {
        const angle = this.frameCount * 0.025;
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        // Dish
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(0,255,100,0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 14, -0.3, 0.3);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,255,100,0.4)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 14, -0.15, 0.15);
        ctx.fill();
        // Center dot
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'storage': {
        // Chest lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + h / 2);
        ctx.lineTo(x + w - 4, y + h / 2);
        ctx.stroke();
        // Lock
        ctx.fillStyle = '#daa520';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wall': {
        // Brick pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        for (let row = 0; row < 3; row++) {
          const ry = y + 4 + row * 9;
          ctx.beginPath();
          ctx.moveTo(x + 2, ry);
          ctx.lineTo(x + TILE_SIZE - 2, ry);
          ctx.stroke();
          const offset = row % 2 === 0 ? TILE_SIZE / 2 : 0;
          ctx.beginPath();
          ctx.moveTo(x + offset, ry);
          ctx.lineTo(x + offset, ry + 9);
          ctx.stroke();
        }
        break;
      }
    }
  }

  private renderConveyors(ctx: CanvasRenderingContext2D, state: GameState, vl: number, vt: number, vr: number, vb: number) {
    for (const [key, segments] of state.conveyors) {
      const [xStr, yStr] = key.split(',');
      const bx = parseInt(xStr);
      const by = parseInt(yStr);
      const sx = bx * TILE_SIZE;
      const sy = by * TILE_SIZE;

      if (sx < vl - TILE_SIZE || sx > vr + TILE_SIZE || sy < vt - TILE_SIZE || sy > vb + TILE_SIZE) continue;

      const building = state.buildings.get(key);
      if (!building) continue;

      const dir = DIR_OFFSETS[building.direction];
      const dx = dir ? dir.dx : 1;
      const dy = dir ? dir.dy : 0;

      // Belt surface
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      // Animated belt lines
      const animOffset = (this.frameCount * 1.5) % (TILE_SIZE / 3);
      ctx.strokeStyle = 'rgba(100,100,100,0.5)';
      ctx.lineWidth = 1;
      for (let i = -1; i < 4; i++) {
        const offset = (i * TILE_SIZE / 3 + animOffset) % TILE_SIZE;
        if (dx !== 0) {
          const lx = sx + offset;
          ctx.beginPath();
          ctx.moveTo(lx, sy + 3);
          ctx.lineTo(lx + dx * 4, sy + 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(lx, sy + TILE_SIZE - 3);
          ctx.lineTo(lx + dx * 4, sy + TILE_SIZE - 3);
          ctx.stroke();
        } else {
          const ly = sy + offset;
          ctx.beginPath();
          ctx.moveTo(sx + 3, ly);
          ctx.lineTo(sx + 3, ly + dy * 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sx + TILE_SIZE - 3, ly);
          ctx.lineTo(sx + TILE_SIZE - 3, ly + dy * 4);
          ctx.stroke();
        }
      }

      // Items on belt with 3D effect
      for (const seg of segments) {
        if (seg.itemId) {
          const progress = seg.progress;
          const ix = sx + TILE_SIZE / 2 + dx * (progress - 0.5) * TILE_SIZE;
          const iy = sy + TILE_SIZE / 2 + dy * (progress - 0.5) * TILE_SIZE;
          // Item shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(ix + 1, iy + 2, 4, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Item
          ctx.fillStyle = RESOURCE_COLORS[seg.itemId] || '#fff';
          ctx.beginPath();
          ctx.roundRect(ix - 4, iy - 4, 8, 8, 1.5);
          ctx.fill();
          // Item highlight
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(ix - 3, iy - 3, 3, 2);
        }
      }
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, _state: GameState) {
    const x = enemy.x * TILE_SIZE;
    const y = enemy.y * TILE_SIZE;
    const size = enemy.type === 'behemoth' ? 14 : enemy.type === 'worm' ? 12 : 8;
    const evolution = enemy.evolution;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + size + 2, size * 0.7, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body color with evolution gradient
    const r = Math.floor(60 + evolution * 120);
    const g = Math.floor(15 + evolution * 25);
    const b = Math.floor(15 + evolution * 15);
    const bodyColor = `rgb(${r},${g},${b})`;
    const darkColor = `rgb(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)})`;

    if (enemy.type === 'spitter') {
      // Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly
      ctx.fillStyle = `rgb(${r + 40},${g + 20},${b})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, size * 0.6, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      ctx.fillStyle = '#ff4400';
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.3, size * 0.35, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.ellipse(x - 3, y - 3, 2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.ellipse(x + 3, y - 3, 2, 1.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'worm') {
      // Body segments
      for (let i = 3; i >= 0; i--) {
        const segSize = size * (1 - i * 0.15);
        const wobble = Math.sin(this.frameCount * 0.04 + i * 0.8) * 2;
        ctx.fillStyle = i === 0 ? bodyColor : darkColor;
        ctx.beginPath();
        ctx.ellipse(x + wobble, y - i * 4, segSize, segSize * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tentacles
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + this.frameCount * 0.015;
        const len = size * 1.2 + Math.sin(this.frameCount * 0.05 + i) * 3;
        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        const midX = x + Math.cos(a) * len * 0.5;
        const midY = y + Math.sin(a) * len * 0.5;
        const endX = x + Math.cos(a + 0.3) * len;
        const endY = y + Math.sin(a + 0.3) * len;
        ctx.quadraticCurveTo(midX, midY, endX, endY);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    } else {
      // Biter/behemoth
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shell ridges
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 2, size * 0.6, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      // Legs with animation
      const legAnim = Math.sin(this.frameCount * 0.12 + enemy.id.charCodeAt(0)) * 3;
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i += 2) {
        const legOffset = i * legAnim * 0.3;
        ctx.beginPath();
        ctx.moveTo(x + i * size * 0.5, y + size * 0.2);
        ctx.lineTo(x + i * size * 0.9 + legOffset, y + size + 2);
        ctx.stroke();
        // Mid leg
        ctx.beginPath();
        ctx.moveTo(x + i * size * 0.3, y + size * 0.3);
        ctx.lineTo(x + i * size * 0.7 - legOffset, y + size + 1);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      // Mandibles
      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = 2;
      const mandibleOpen = enemy.state === 'attacking' ? 4 : 1;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + size * 0.3);
      ctx.lineTo(x - 5, y + size * 0.3 + mandibleOpen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 3, y + size * 0.3);
      ctx.lineTo(x + 5, y + size * 0.3 + mandibleOpen);
      ctx.stroke();
      // Eyes with glow
      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.arc(x - 3, y - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(x - 3, y - 2, 1, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 2, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health bar
    if (enemy.health < enemy.maxHealth) {
      const hp = enemy.health / enemy.maxHealth;
      const barW = size * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(x - barW / 2, y - size - 10, barW, 5, 2);
      ctx.fill();
      ctx.fillStyle = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x - barW / 2 + 0.5, y - size - 9.5, (barW - 1) * hp, 4, 1.5);
      ctx.fill();
    }

    // Attack flash
    if (enemy.state === 'attacking') {
      ctx.fillStyle = 'rgba(255,50,0,0.2)';
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderNPC(ctx: CanvasRenderingContext2D, npc: NPC, state: GameState) {
    const x = npc.x * TILE_SIZE;
    const y = npc.y * TILE_SIZE;
    const colors = NPC_COLORS[npc.type] || { body: '#888', accent: '#aaa' };
    const bob = Math.sin(this.frameCount * 0.06 + npc.id.charCodeAt(0)) * 1.5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createLinearGradient(x - 7, y - 4, x + 7, y + 8);
    bodyGrad.addColorStop(0, colors.accent);
    bodyGrad.addColorStop(1, colors.body);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x, y - 1 + bob, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f0c878';
    ctx.beginPath();
    ctx.arc(x, y - 10 + bob, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = npc.type === 'guard' ? '#2a1a0a' : npc.type === 'trader' ? '#5a3a1a' : '#4a3a2a';
    ctx.beginPath();
    ctx.arc(x, y - 12 + bob, 5.5, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 2.5, y - 11 + bob, 1.5, 1.5);
    ctx.fillRect(x + 1, y - 11 + bob, 1.5, 1.5);

    // Name tag
    if (state.camera.zoom > 1) {
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      // Background
      const nameWidth = ctx.measureText(npc.name).width + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(x - nameWidth / 2, y - 22 + bob, nameWidth, 11, 3);
      ctx.fill();
      // Text
      ctx.fillStyle = '#fff';
      ctx.fillText(npc.name, x, y - 14 + bob);
    }

    // State indicator
    const stateIcons: Record<string, string> = {
      idle: '...', moving: '>>', working: 'W', fleeing: '!!', trading: '$', patrolling: 'P', gathering: '+',
    };
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(stateIcons[npc.state] || '', x, y + 18);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
    const { player } = state;
    const x = player.x * TILE_SIZE;
    const y = player.y * TILE_SIZE;
    const bob = Math.sin(this.frameCount * 0.08) * 1;
    const isMoving = this.keysPressed(state);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createLinearGradient(x - 9, y - 4, x + 9, y + 8);
    bodyGrad.addColorStop(0, '#3388ee');
    bodyGrad.addColorStop(1, '#1a55aa');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x, y - 1 + (isMoving ? bob : 0), 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belt
    ctx.fillStyle = '#daa520';
    ctx.fillRect(x - 8, y + 2 + (isMoving ? bob : 0), 16, 2);

    // Head
    ctx.fillStyle = '#f0c878';
    ctx.beginPath();
    ctx.arc(x, y - 12 + (isMoving ? bob : 0), 6.5, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(x, y - 14 + (isMoving ? bob : 0), 6.5, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // Eyes
    const dir = DIR_OFFSETS[player.direction];
    const eyeOffX = dir ? dir.dx * 1.5 : 0;
    const eyeOffY = dir ? dir.dy * 1 : 0;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x - 2.5 + eyeOffX, y - 12 + (isMoving ? bob : 0) + eyeOffY, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 2.5 + eyeOffX, y - 12 + (isMoving ? bob : 0) + eyeOffY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator (weapon/tool)
    if (dir) {
      ctx.fillStyle = '#ccc';
      ctx.save();
      ctx.translate(x + dir.dx * 12, y - 2 + dir.dy * 12 + (isMoving ? bob : 0));
      ctx.rotate(Math.atan2(dir.dy, dir.dx));
      ctx.fillRect(-6, -1.5, 12, 3);
      ctx.restore();
    }

    // Health bar
    const hp = player.health / player.maxHealth;
    const barW = 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x - barW / 2, y - 22 + (isMoving ? bob : 0), barW, 5, 2);
    ctx.fill();
    const hpColor = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(x - barW / 2 + 0.5, y - 21.5 + (isMoving ? bob : 0), (barW - 1) * hp, 4, 1.5);
    ctx.fill();

    // Reach circle
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, player.reach * TILE_SIZE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private keysPressed(state: GameState): boolean {
    return state.player.x !== state.player.x || state.player.y !== state.player.y;
  }

  private renderParticles(ctx: CanvasRenderingContext2D, state: GameState, vl: number, vt: number, vr: number, vb: number) {
    for (const p of state.particles) {
      if (p.x < vl - 20 || p.x > vr + 20 || p.y < vt - 20 || p.y > vb + 20) continue;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      switch (p.type) {
        case 'smoke': {
          const radius = p.size * (1 + (1 - alpha) * 2.5);
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'spark': {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#fff';
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
          break;
        }
        case 'fire': {
          const radius = p.size * alpha;
          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          // Core
          ctx.fillStyle = '#ff8';
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'explosion': {
          const radius = p.size * (1 + (1 - alpha) * 4);
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'resource': {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.roundRect(p.x - 3, p.y - 3, 6, 6, 1);
          ctx.fill();
          break;
        }
        case 'ambient': {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderNightLighting(state: GameState, dayFactor: number) {
    const { canvas, lightCanvas, lightCtx } = this;
    lightCanvas.width = canvas.width;
    lightCanvas.height = canvas.height;

    // Dark overlay
    const darkness = (1 - dayFactor) * 0.7;
    lightCtx.fillStyle = `rgba(5,5,20,${darkness})`;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Cut out light sources
    lightCtx.globalCompositeOperation = 'destination-out';

    // Player light
    const px = canvas.width / 2;
    const py = canvas.height / 2;
    const playerLight = lightCtx.createRadialGradient(px, py, 0, px, py, 120 * state.camera.zoom);
    playerLight.addColorStop(0, 'rgba(0,0,0,0.9)');
    playerLight.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    playerLight.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = playerLight;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Building lights
    for (const [, building] of state.buildings) {
      if (building.type === 'furnace' || building.type === 'boiler' || building.type === 'lab' || building.type === 'radar') {
        if (!building.isActive) continue;
        const bx = (building.x * TILE_SIZE - state.camera.x) * state.camera.zoom + canvas.width / 2;
        const by = (building.y * TILE_SIZE - state.camera.y) * state.camera.zoom + canvas.height / 2;
        if (bx < -100 || bx > canvas.width + 100 || by < -100 || by > canvas.height + 100) continue;
        const radius = (building.type === 'furnace' ? 80 : 60) * state.camera.zoom;
        const light = lightCtx.createRadialGradient(bx, by, 0, bx, by, radius);
        const color = building.type === 'furnace' ? 'rgba(0,0,0,0.7)' : building.type === 'lab' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.4)';
        light.addColorStop(0, color);
        light.addColorStop(1, 'rgba(0,0,0,0)');
        lightCtx.fillStyle = light;
        lightCtx.fillRect(bx - radius, by - radius, radius * 2, radius * 2);
      }
    }

    lightCtx.globalCompositeOperation = 'source-over';

    // Warm tint for light areas
    lightCtx.globalCompositeOperation = 'source-atop';
    lightCtx.fillStyle = 'rgba(255,200,100,0.05)';
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
    lightCtx.globalCompositeOperation = 'source-over';

    this.ctx.drawImage(lightCanvas, 0, 0);
  }

  private renderWeather(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.weather === 'rain' || state.weather === 'storm') {
      const intensity = state.weather === 'storm' ? 0.25 : 0.12;
      ctx.fillStyle = `rgba(80,120,180,${intensity})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Rain drops
      const dropCount = state.weather === 'storm' ? 150 : 60;
      ctx.strokeStyle = 'rgba(180,210,255,0.25)';
      ctx.lineWidth = 1;
      const windOffset = state.weather === 'storm' ? 4 : 1;
      for (let i = 0; i < dropCount; i++) {
        const rx = (this.frameCount * 7.3 + i * 137.7) % this.canvas.width;
        const ry = (this.frameCount * 13.1 + i * 251.3) % this.canvas.height;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - windOffset, ry + 12);
        ctx.stroke();
      }

      // Lightning flash for storms
      if (state.weather === 'storm' && this.frameCount % 300 < 3) {
        ctx.fillStyle = 'rgba(200,220,255,0.15)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else if (state.weather === 'fog') {
      // Layered fog
      ctx.fillStyle = 'rgba(180,190,200,0.15)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Moving fog patches
      for (let i = 0; i < 5; i++) {
        const fx = ((this.frameCount * 0.3 + i * 300) % (this.canvas.width + 400)) - 200;
        const fy = this.canvas.height * 0.3 + Math.sin(i * 2.3) * this.canvas.height * 0.2;
        ctx.fillStyle = `rgba(200,210,220,${0.05 + Math.sin(this.frameCount * 0.01 + i) * 0.02})`;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 200, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderVignette(ctx: CanvasRenderingContext2D) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}
