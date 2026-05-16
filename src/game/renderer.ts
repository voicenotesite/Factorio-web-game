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
  isPlayerMoving = false;
  ghostBuilding: string | null = null;
  ghostTile: { x: number; y: number } | null = null;
  ghostDirection = 'right';
  ghostCanAfford = true;
  private enemyHitFlash = new Map<string, number>(); // enemyId -> flashFrames remaining
  private damageNumbers: { x: number; y: number; value: number; life: number; color: string }[] = [];
  private prevEnemyHealth = new Map<string, number>();
  private sunShadowDX = 4;
  private sunShadowDY = 4;
  private sunShadowAlpha = 0.25;

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

    // Directional sun shadow based on time of day
    {
      // dayPhase: 0.25 = noon (dayFactor=1), 0.75 = midnight (dayFactor=0.25)
      const dayAngle = (dayPhase - 0.25) * Math.PI * 2;
      const shadowLength = isNight ? 0 : Math.max(1.5, (1.0 - dayFactor) * 14 + 1.5);
      // Shadow opposite to sun: dawn (sun east) → shadow west (negative X), dusk → east (positive X)
      this.sunShadowDX = -Math.sin(dayAngle) * shadowLength * 0.65;
      this.sunShadowDY = Math.max(1.5, Math.abs(Math.cos(dayAngle)) * shadowLength * 0.35 + (isNight ? 0 : 1.8));
      this.sunShadowAlpha = isNight ? 0 : Math.max(0, Math.min(0.38, (dayFactor - 0.33) * 0.55));
    }

    // Sky — atmospheric industrial backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    const isDawnDusk = dayFactor > 0.38 && dayFactor < 0.62;
    if (isDawnDusk) {
      // Dawn / dusk: warm amber horizon glow
      const t = 1 - Math.abs(dayFactor - 0.5) / 0.12;
      skyGrad.addColorStop(0, `rgb(${Math.floor(8 + dayFactor * 12)},${Math.floor(8 + dayFactor * 12)},${Math.floor(18 + dayFactor * 20)})`);
      skyGrad.addColorStop(0.6, `rgb(${Math.floor(30 + t * 80)},${Math.floor(15 + t * 35)},${Math.floor(5 + t * 10)})`);
      skyGrad.addColorStop(1, `rgb(${Math.floor(20 + t * 60)},${Math.floor(10 + t * 25)},${Math.floor(3 + t * 8)})`);
    } else if (dayFactor < 0.4) {
      // Night
      skyGrad.addColorStop(0, 'rgb(3,4,10)');
      skyGrad.addColorStop(1, 'rgb(6,6,14)');
    } else {
      // Day
      skyGrad.addColorStop(0, `rgb(${Math.floor(8 + dayFactor * 14)},${Math.floor(10 + dayFactor * 18)},${Math.floor(18 + dayFactor * 22)})`);
      skyGrad.addColorStop(1, `rgb(${Math.floor(12 + dayFactor * 18)},${Math.floor(14 + dayFactor * 22)},${Math.floor(24 + dayFactor * 28)})`);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars at night
    if (dayFactor < 0.45) {
      const starAlpha = Math.max(0, (0.45 - dayFactor) / 0.2);
      ctx.fillStyle = `rgba(255,255,255,${starAlpha * 0.7})`;
      for (let i = 0; i < 120; i++) {
        const sx = ((i * 7919 + 13) % canvas.width);
        const sy = ((i * 3571 + 29) % (canvas.height * 0.65));
        const twinkle = Math.sin(this.frameCount * 0.02 + i) * 0.3 + 0.7;
        ctx.globalAlpha = starAlpha * twinkle * 0.6;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }

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

    // Ghost building preview
    if (this.ghostBuilding && this.ghostTile) {
      this.renderGhostBuilding(ctx, state);
    }

    // Render particles
    this.renderParticles(ctx, state, viewLeft, viewTop, viewRight, viewBottom);

    // Render floating damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      const alpha = dn.life / 40;
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${10 + (1 - alpha) * 4}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = dn.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeText(`-${dn.value}`, dn.x, dn.y);
      ctx.fillText(`-${dn.value}`, dn.x, dn.y);
      dn.y -= 0.35;
      dn.life--;
      if (dn.life <= 0) this.damageNumbers.splice(i, 1);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

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

    // Water handled by renderResource
    if (tile.resource !== 'water') {
      // Biome base RGB
      const biomeRGB: Record<string, [number, number, number]> = {
        grass:    [54,  88, 46],
        forest:   [28,  60, 16],
        desert:   [158, 128, 84],
        snow:     [176, 180, 184],
        swamp:    [30,  52, 32],
        volcanic: [50,  18,  8],
      };
      const base = biomeRGB[tile.biome] || biomeRGB.grass;

      // Multi-scale terrain variation — gives big visible patches + micro noise
      const px = tile.x >> 3; // 8-tile macro patches
      const py = tile.y >> 3;
      const macroH = ((px * 374761393 + py * 1013904223) & 0x7FFFF) / 524287.0;

      const mx = tile.x >> 2; // 4-tile medium patches
      const my = tile.y >> 2;
      const midH = ((mx * 2654435761 + my * 2246822519) & 0x7FFFF) / 524287.0;

      const microH = ((tile.x * 7919 + tile.y * 104729) & 0xFFFF) / 65535.0;

      const variation = 1.0
        + (macroH - 0.5) * 0.44   // ±22% — large visible patches
        + (midH   - 0.5) * 0.18   // ±9%  — medium variation
        + (microH - 0.5) * 0.08;  // ±4%  — per-tile noise

      const dayF = 0.45 + dayFactor * 0.55;
      const f = Math.max(0.05, Math.min(1.6, dayF * variation));

      ctx.fillStyle = `rgb(${Math.min(255, base[0] * f | 0)},${Math.min(255, base[1] * f | 0)},${Math.min(255, base[2] * f | 0)})`;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      const hash  = microH;
      const hash2 = ((tile.x * 104729 + tile.y * 7919) & 0xFFFF) / 65535.0;

      // Biome-specific detail layer
      switch (tile.biome) {
        case 'volcanic': {
          if (hash > 0.6) {
            ctx.strokeStyle = `rgba(200,80,0,${(hash - 0.6) * 0.7})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            const crackX = x + hash2 * TILE_SIZE;
            ctx.moveTo(crackX, y);
            ctx.lineTo(crackX + (hash - 0.5) * 12, y + TILE_SIZE);
            ctx.stroke();
          }
          if (hash < 0.2) {
            ctx.fillStyle = `rgba(255,60,0,${(0.2 - hash) * 0.22})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * TILE_SIZE, y + hash * TILE_SIZE + 8, 5, 3, hash * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'desert': {
          // Wind ripple arcs
          if (hash > 0.52) {
            ctx.strokeStyle = `rgba(210,185,125,${(hash - 0.52) * 0.18})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.arc(x + hash2 * TILE_SIZE, y + TILE_SIZE * 1.1, (hash - 0.45) * 24, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
          }
          // Second ripple (offset)
          if (hash > 0.68) {
            ctx.strokeStyle = `rgba(195,168,108,${(hash - 0.68) * 0.14})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(x + (1 - hash2) * TILE_SIZE, y + TILE_SIZE * 0.6, (hash - 0.6) * 18, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
          }
          // Small pebble clusters
          if (hash > 0.8) {
            const pAlpha = (hash - 0.8) * 1.2;
            ctx.fillStyle = `rgba(115,95,65,${pAlpha})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 26 + 3, y + hash * 26 + 3, 2.2, 1.3, hash * 4, 0, Math.PI * 2);
            ctx.fill();
            if (hash > 0.9) {
              ctx.fillStyle = `rgba(90,72,50,${pAlpha * 0.7})`;
              ctx.beginPath();
              ctx.ellipse(x + hash2 * 26 + 7, y + hash * 26 + 6, 1.5, 1, hash * 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
        case 'snow': {
          if (hash > 0.72) {
            ctx.fillStyle = `rgba(255,255,255,${(hash - 0.72) * 0.65 * dayFactor})`;
            ctx.beginPath();
            ctx.arc(x + hash2 * (TILE_SIZE - 4) + 2, y + hash * (TILE_SIZE - 4) + 2, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          // Subtle shadow patches (footprint-like depressions)
          if (hash < 0.12) {
            ctx.fillStyle = `rgba(140,160,180,${(0.12 - hash) * 0.3})`;
            ctx.fillRect(x + hash2 * 20 + 4, y + hash2 * 20 + 4, 8, 5);
          }
          break;
        }
        case 'swamp': {
          if (hash > 0.68 && (this.frameCount % 80 < 6)) {
            ctx.fillStyle = `rgba(0,0,0,0.18)`;
            ctx.beginPath();
            ctx.arc(x + hash2 * 22 + 5, y + hash * 22 + 5, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          // Murky water puddles
          if (hash < 0.14) {
            ctx.fillStyle = `rgba(10,30,15,0.25)`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 20 + 6, y + hash * 20 + 6, 6, 3.5, hash * 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'grass': {
          // Small dirt patches (natural ground variation)
          if (hash < 0.1) {
            ctx.fillStyle = `rgba(55,35,15,${(0.1 - hash) * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 24 + 4, y + (1 - hash2) * 24 + 4, 5, 3.5, hash * 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Grass tufts - tiny blade-like strokes
          if (hash > 0.7) {
            const tuftAlpha = (hash - 0.7) * 0.5;
            const gx = x + hash2 * 26 + 3;
            const gy = y + hash * 26 + 3;
            ctx.strokeStyle = `rgba(28,55,12,${tuftAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(gx, gy + 3);
            ctx.lineTo(gx - 2 + hash2 * 2, gy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gx + 2, gy + 3);
            ctx.lineTo(gx + 3 + hash2, gy + 0.5);
            ctx.stroke();
            ctx.lineCap = 'butt';
          }
          // Occasional small rock
          if (hash > 0.88) {
            const rockAlpha = (hash - 0.88) * 1.5;
            ctx.fillStyle = `rgba(95,85,68,${rockAlpha})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 24 + 4, y + hash * 24 + 4, 2.8, 1.8, hash2 * 3, 0, Math.PI * 2);
            ctx.fill();
            // Rock highlight
            ctx.fillStyle = `rgba(130,120,100,${rockAlpha * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 24 + 3, y + hash * 24 + 3, 1.2, 0.8, hash2 * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'forest': {
          // Leaf litter on ground
          if (hash > 0.78) {
            ctx.fillStyle = `rgba(15,35,10,${(hash - 0.78) * 0.5})`;
            ctx.beginPath();
            ctx.ellipse(x + hash2 * 24 + 4, y + hash * 24 + 4, 3, 1.8, hash * 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }

      // Grid lines only when very zoomed in
      if (state.camera.zoom > 2.5) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }

    // Trees
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
    const treeBase = y + TILE_SIZE / 2 + 4;
    const h = ((Math.floor(x / TILE_SIZE) * 7919 + Math.floor(y / TILE_SIZE) * 104729) & 0xFFFF) / 65535;
    const scale = 0.82 + h * 0.36; // size variation

    // Directional tree shadow
    const sShadowDX = this.sunShadowDX * 0.5 + 2;
    const sShadowDY = this.sunShadowDY * 0.4 + 3;
    const shadowW = (9 + Math.abs(this.sunShadowDX) * 0.4) * scale;
    const shadowH = (3.5 + Math.abs(this.sunShadowDY) * 0.15) * scale;
    ctx.fillStyle = `rgba(0,0,0,${0.12 + this.sunShadowAlpha * 0.8})`;
    ctx.beginPath();
    ctx.ellipse(cx + sShadowDX, treeBase + sShadowDY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    const trunkH = 10 * scale;
    ctx.fillStyle = biome === 'forest' ? '#1e1008' : '#2e1c08';
    ctx.fillRect(cx - 2, treeBase - trunkH, 4, trunkH + 2);
    // Trunk highlight
    ctx.fillStyle = 'rgba(255,200,120,0.08)';
    ctx.fillRect(cx - 1, treeBase - trunkH, 1, trunkH);

    // Sway animation
    const sway = Math.sin(this.frameCount * 0.018 + x * 0.07 + y * 0.05) * 1.8 * scale;

    // Canopy dark base (shadow layer)
    const dark = biome === 'forest' ? '#0a2808' : '#112a08';
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(cx + sway * 0.3, treeBase - trunkH - 4 * scale, 11 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mid canopy
    const mid = biome === 'forest' ? '#163d0c' : '#1e5010';
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.ellipse(cx + sway * 0.7, treeBase - trunkH - 6 * scale, 9 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Light canopy top
    const light = biome === 'forest' ? '#1f5212' : '#2a6a18';
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(cx + sway, treeBase - trunkH - 9 * scale, 6.5 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sunlit highlight
    ctx.fillStyle = `rgba(160,220,80,${0.12 * dayFactor})`;
    ctx.beginPath();
    ctx.ellipse(cx + sway - 2 * scale, treeBase - trunkH - 11 * scale, 3.5 * scale, 2.5 * scale, -0.4, 0, Math.PI * 2);
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
      const sheen = Math.sin(this.frameCount * 0.03 + tile.x) * 0.1;
      ctx.fillStyle = `rgba(80,40,120,${0.15 + sheen})`;
      ctx.beginPath();
      ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Parse ore color components
    const rC = parseInt(color.slice(1, 3), 16);
    const gC = parseInt(color.slice(3, 5), 16);
    const bC = parseInt(color.slice(5, 7), 16);

    // Tile-wide ore ground tint — makes the patch clearly visible even when zoomed out
    ctx.fillStyle = `rgba(${Math.floor(rC * 0.35)},${Math.floor(gC * 0.35)},${Math.floor(bC * 0.35)},0.6)`;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Deterministic hash for rock positions
    const h1 = ((tile.x * 7919 + tile.y * 104729) & 0xFFFF) / 65535;
    const h2 = ((tile.x * 104729 + tile.y * 7919) & 0xFFFF) / 65535;
    const h3 = ((tile.x * 49999 + tile.y * 86413) & 0xFFFF) / 65535;

    // Draw 3–5 ore rock chunks per tile
    const rockCount = 3 + Math.floor(h3 * 3);
    for (let i = 0; i < rockCount; i++) {
      const t = i / rockCount;
      const rx = x + ((h1 + t * 0.37) % 1) * (TILE_SIZE - 10) + 5;
      const ry = y + ((h2 + t * 0.53) % 1) * (TILE_SIZE - 10) + 5;
      const rs = 3.5 + ((h1 + h2 + t) % 1) * 2.5;
      const angle = (h3 + t) * Math.PI;

      // Rock shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(rx + 1.5, ry + 2, rs * 0.9, rs * 0.55, angle, 0, Math.PI * 2);
      ctx.fill();

      // Rock body — angular polygon
      const pts = 5 + Math.floor((h1 + i) % 1 * 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let p = 0; p < pts; p++) {
        const a = (p / pts) * Math.PI * 2 + angle;
        const jitter = 0.7 + ((h2 + p * 0.17) % 1) * 0.6;
        const px2 = rx + Math.cos(a) * rs * jitter;
        const py2 = ry + Math.sin(a) * rs * 0.65 * jitter;
        p === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.fill();

      // Rock outline (darker edge)
      ctx.strokeStyle = `rgba(${Math.floor(rC * 0.5)},${Math.floor(gC * 0.5)},${Math.floor(bC * 0.5)},0.8)`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Highlight facet
      ctx.fillStyle = `rgba(255,255,255,0.22)`;
      ctx.beginPath();
      ctx.ellipse(rx - rs * 0.3, ry - rs * 0.35, rs * 0.3, rs * 0.2, angle - 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Metallic specular sparkle (animated)
      const sparkPhase = Math.sin(this.frameCount * 0.04 + i * 1.5 + tile.x * 0.3) * 0.5 + 0.5;
      if (sparkPhase > 0.85) {
        ctx.fillStyle = `rgba(255,255,255,${(sparkPhase - 0.85) * 2.5})`;
        ctx.beginPath();
        ctx.arc(rx - rs * 0.25, ry - rs * 0.3, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Yield quality indicator — small corner gem
    if (tile.resourceYield !== 'normal') {
      const yieldColor = getYieldColor(tile.resourceYield);
      ctx.fillStyle = yieldColor;
      ctx.beginPath();
      ctx.arc(x + TILE_SIZE - 5, y + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (tile.resourceYield === 'rich' || tile.resourceYield === 'very_rich') {
        ctx.globalAlpha = 0.25;
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

    // Directional sun shadow + ambient contact shadow
    if (this.sunShadowAlpha > 0.02) {
      // Hard shadow (direction from sun)
      ctx.fillStyle = `rgba(0,0,0,${this.sunShadowAlpha})`;
      ctx.beginPath();
      ctx.roundRect(x + this.sunShadowDX, y + this.sunShadowDY, w, h, 2);
      ctx.fill();
    }
    // Soft ambient occlusion contact shadow (always present)
    {
      const aoGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.85, 0, x + w * 0.5, y + h * 0.85, Math.max(w, h) * 0.8);
      aoGrad.addColorStop(0, 'rgba(0,0,0,0.22)');
      aoGrad.addColorStop(0.45, 'rgba(0,0,0,0.09)');
      aoGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aoGrad;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, y + h, w * 0.7, h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Building body with gradient (dark industrial look, lit from above-left)
    const grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    grad.addColorStop(0, lightenColor(color, 28));
    grad.addColorStop(0.4, lightenColor(color, 8));
    grad.addColorStop(1, darkenColor(color, 20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.fill();

    // Top edge highlight (metal sheen)
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 2, y + 1, w - 4, 2);
    // Left edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 1, y + 2, 2, h - 4);

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
    ctx.stroke();

    // Outer rim highlight (metal edge)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 1.5);
    ctx.stroke();

    // Industrial panel dividers
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.5;
    if (h >= TILE_SIZE * 2) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h / 2);
      ctx.lineTo(x + w - 3, y + h / 2);
      ctx.stroke();
    }
    if (w >= TILE_SIZE * 3) {
      ctx.beginPath();
      ctx.moveTo(x + w / 3, y + 3);
      ctx.lineTo(x + w / 3, y + h - 3);
      ctx.moveTo(x + w * 2 / 3, y + 3);
      ctx.lineTo(x + w * 2 / 3, y + h - 3);
      ctx.stroke();
    }

    // Corner rivets
    const rivetInset = 4;
    const rivetPositions = [
      [x + rivetInset, y + rivetInset], [x + w - rivetInset, y + rivetInset],
      [x + rivetInset, y + h - rivetInset], [x + w - rivetInset, y + h - rivetInset],
    ];
    for (const [rx, ry] of rivetPositions) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(rx - 0.5, ry - 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
    }

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
          const flicker = Math.sin(this.frameCount * 0.15) * 5 + 18;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, flicker);
          glow.addColorStop(0, 'rgba(255,100,10,0.4)');
          glow.addColorStop(0.5, 'rgba(255,50,0,0.15)');
          glow.addColorStop(1, 'rgba(200,30,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 15, y - 15, w + 30, h + 30);
        }
        break;
      }
      case 'lab': {
        if (building.isActive) {
          const pulse = Math.sin(this.frameCount * 0.05) * 0.1 + 0.18;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 24);
          glow.addColorStop(0, `rgba(0,180,255,${pulse})`);
          glow.addColorStop(1, 'rgba(0,80,200,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
        }
        break;
      }
      case 'boiler': {
        if (building.isActive) {
          const flicker2 = Math.sin(this.frameCount * 0.1) * 4 + 14;
          const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.3, 0, x + w / 2, y + h * 0.3, flicker2);
          glow.addColorStop(0, 'rgba(255,80,0,0.2)');
          glow.addColorStop(1, 'rgba(200,50,0,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 8, y - 12, w + 16, h + 16);
        }
        break;
      }
      case 'steam_engine': {
        if (building.isActive) {
          const pulse2 = Math.sin(this.frameCount * 0.08) * 0.08 + 0.1;
          const glow = ctx.createRadialGradient(x + w * 0.72, y + h * 0.5, 0, x + w * 0.72, y + h * 0.5, 22);
          glow.addColorStop(0, `rgba(180,220,255,${pulse2})`);
          glow.addColorStop(1, 'rgba(100,160,220,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
        }
        break;
      }
      case 'assembler': {
        if (building.isActive) {
          const p = Math.sin(this.frameCount * 0.06) * 0.05 + 0.08;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 18);
          glow.addColorStop(0, `rgba(74,176,255,${p})`);
          glow.addColorStop(1, 'rgba(20,100,200,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
        }
        break;
      }
      case 'radar': {
        if (building.isActive) {
          const pulse3 = Math.sin(this.frameCount * 0.05) * 0.08 + 0.12;
          const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 20);
          glow.addColorStop(0, `rgba(0,200,80,${pulse3})`);
          glow.addColorStop(1, 'rgba(0,100,40,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
        }
        break;
      }
    }
  }

  private renderBuildingDetails(ctx: CanvasRenderingContext2D, building: Building, x: number, y: number, w: number, h: number) {
    switch (building.type) {
      case 'miner': {
        // Drill derrick A-frame
        const dcx = x + w / 2;
        const dtip = y + 4;
        ctx.strokeStyle = '#4a4a42';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dcx, dtip);
        ctx.lineTo(x + 5, y + h - 4);
        ctx.moveTo(dcx, dtip);
        ctx.lineTo(x + w - 5, y + h - 4);
        ctx.stroke();
        // Cross brace
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + h * 0.55);
        ctx.lineTo(x + w - 8, y + h * 0.55);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Rotating drill bit head
        const angle = (building.isActive ? this.frameCount * 0.18 : 0);
        ctx.save();
        ctx.translate(dcx, y + h / 2 + 2);
        ctx.rotate(angle);
        ctx.fillStyle = '#6a6a60';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillRect(-2, -8, 4, 16);
        ctx.fillStyle = '#888880';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Dust cloud when active
        if (building.isActive && this.frameCount % 8 === 0) {
          ctx.fillStyle = 'rgba(140,120,90,0.25)';
          for (let i = 0; i < 3; i++) {
            const ddx = (Math.random() - 0.5) * w;
            const ddy = -Math.random() * 10;
            ctx.beginPath();
            ctx.arc(dcx + ddx, y + h * 0.6 + ddy, 2 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'furnace': {
        // Brick chimney stack above
        ctx.fillStyle = '#1a0a04';
        ctx.fillRect(x + w / 2 - 3, y - 12, 6, 14);
        ctx.fillStyle = '#2a1208';
        ctx.fillRect(x + w / 2 - 4, y - 13, 8, 3);
        // Chimney bricks
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 3, y - 7);
        ctx.lineTo(x + w / 2 + 3, y - 7);
        ctx.stroke();
        // Smoke from chimney
        if (building.isActive) {
          const smokeT = (this.frameCount * 0.4) % 40;
          const smokeAlpha = Math.max(0, 0.4 - smokeT * 0.01);
          ctx.fillStyle = `rgba(80,70,60,${smokeAlpha})`;
          ctx.beginPath();
          ctx.arc(x + w / 2 + Math.sin(this.frameCount * 0.05) * 2, y - 14 - smokeT * 0.3, 3 + smokeT * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        // Fire core with flicker
        const flicker = Math.sin(this.frameCount * 0.2) * 2;
        ctx.fillStyle = `rgba(255,${100 + flicker * 12},10,0.9)`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, 5 + flicker, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,${190 + flicker * 10},70,0.6)`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2 - 2, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fire aperture (dark surround)
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'assembler': {
        const speed = building.isActive ? 0.05 : 0.008;
        const angle = this.frameCount * speed;
        const cx2 = x + w / 2;
        const cy2 = y + h / 2;
        // Central hub
        ctx.fillStyle = '#1a2a3a';
        ctx.beginPath();
        ctx.arc(cx2, cy2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a5a7a';
        ctx.lineWidth = 2;
        ctx.stroke();
        // 3 robotic arms
        for (let i = 0; i < 3; i++) {
          const a = angle + (i / 3) * Math.PI * 2;
          const armEndX = cx2 + Math.cos(a) * 12;
          const armEndY = cy2 + Math.sin(a) * 12;
          ctx.strokeStyle = '#5a7a9a';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx2, cy2);
          ctx.lineTo(armEndX, armEndY);
          ctx.stroke();
          // Claw tip
          ctx.fillStyle = '#8aaac0';
          ctx.beginPath();
          ctx.arc(armEndX, armEndY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.lineCap = 'butt';
        // Center core
        ctx.fillStyle = building.isActive ? '#4ab0ff' : '#2a4a6a';
        ctx.beginPath();
        ctx.arc(cx2, cy2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Activity ring
        if (building.recipe && building.progress > 0) {
          const prog = building.progress / building.recipe.craftTime;
          ctx.strokeStyle = 'rgba(74,176,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx2, cy2, 14, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.stroke();
        }
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
      case 'pumpjack': {
        // Base platform
        ctx.fillStyle = '#141008';
        ctx.fillRect(x + 3, y + h - 7, w - 6, 7);
        // A-frame derrick
        const pcx = x + w / 2;
        const ptip = y + 5;
        ctx.strokeStyle = '#3a3428';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pcx, ptip);
        ctx.lineTo(x + 6, y + h - 7);
        ctx.moveTo(pcx, ptip);
        ctx.lineTo(x + w - 6, y + h - 7);
        ctx.stroke();
        // Cross brace
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 9, y + h * 0.55);
        ctx.lineTo(x + w - 9, y + h * 0.55);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Walking beam (rocking animation)
        const beamRock = Math.sin(this.frameCount * (building.isActive ? 0.07 : 0.01)) * 0.4;
        const beamLen = w * 0.45;
        const frontX = pcx + Math.cos(beamRock) * beamLen * 0.55;
        const frontY = ptip + Math.sin(beamRock) * beamLen * 0.55;
        const backX = pcx - Math.cos(beamRock) * beamLen * 0.4;
        const backY = ptip - Math.sin(beamRock) * beamLen * 0.4;
        ctx.strokeStyle = '#6a6050';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(frontX, frontY);
        ctx.lineTo(backX, backY);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Horsehead
        ctx.fillStyle = '#4a4038';
        ctx.fillRect(frontX - 4, frontY - 3, 8, 6);
        // Pump rod
        ctx.strokeStyle = '#8a8070';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(frontX, frontY + 3);
        ctx.lineTo(frontX, y + h - 7);
        ctx.stroke();
        // Counterweight
        ctx.fillStyle = '#2a2820';
        ctx.beginPath();
        ctx.arc(backX, backY, 5, 0, Math.PI * 2);
        ctx.fill();
        // Oil drip when active
        if (building.isActive) {
          const dripY = y + h - 7 + ((this.frameCount * 0.5) % 10);
          ctx.fillStyle = 'rgba(15,10,5,0.7)';
          ctx.beginPath();
          ctx.arc(frontX, dripY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'steam_engine': {
        const seSpeed = building.isActive ? 0.09 : 0.006;
        const crankAngle = this.frameCount * seSpeed;
        const swCx = x + w * 0.72;
        const swCy = y + h * 0.5;
        const wheelR = Math.min(w, h) * 0.28;
        // Engine cylinder block
        ctx.fillStyle = '#101820';
        ctx.fillRect(x + 3, y + 4, w * 0.48, h - 8);
        ctx.fillStyle = '#1a2838';
        ctx.fillRect(x + w * 0.38, y + h * 0.3, w * 0.22, h * 0.4);
        // Flywheel outer ring
        ctx.strokeStyle = '#3a5060';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(swCx, swCy, wheelR, 0, Math.PI * 2);
        ctx.stroke();
        // Spokes
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2a3a48';
        for (let i = 0; i < 4; i++) {
          const a = crankAngle + i * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(swCx, swCy);
          ctx.lineTo(swCx + Math.cos(a) * wheelR, swCy + Math.sin(a) * wheelR);
          ctx.stroke();
        }
        // Crank pin
        const crankPinX = swCx + Math.cos(crankAngle) * wheelR * 0.65;
        const crankPinY = swCy + Math.sin(crankAngle) * wheelR * 0.65;
        // Connecting rod to piston
        ctx.strokeStyle = '#6a8090';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(crankPinX, crankPinY);
        ctx.lineTo(x + w * 0.42, swCy);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Flywheel hub
        ctx.fillStyle = '#4a6070';
        ctx.beginPath();
        ctx.arc(swCx, swCy, 4, 0, Math.PI * 2);
        ctx.fill();
        // Steam vent (top)
        if (building.isActive) {
          const steamY = y + 2 - ((this.frameCount * 0.4) % 14);
          ctx.fillStyle = `rgba(180,180,180,${Math.max(0, 0.4 - ((this.frameCount * 0.4) % 14) * 0.03)})`;
          ctx.beginPath();
          ctx.arc(x + w * 0.25, steamY, 3 + ((this.frameCount * 0.4) % 14) * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
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
      case 'inserter': {
        // Mechanical arm — base plate, rotating arm, claw
        const dir = DIR_OFFSETS[building.direction] || DIR_OFFSETS.right;
        const cx2 = x + TILE_SIZE / 2;
        const cy2 = y + TILE_SIZE / 2;

        // Arm swing animation
        const swingMax = 0.65;
        const swingSpeed = building.isActive ? 0.08 : 0.015;
        const swing = Math.sin(this.frameCount * swingSpeed) * swingMax;

        // Base plate
        ctx.fillStyle = '#3a3a30';
        ctx.beginPath();
        ctx.arc(cx2, cy2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a5a48';
        ctx.beginPath();
        ctx.arc(cx2, cy2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Arm direction angle
        const baseAngle = Math.atan2(dir.dy, dir.dx) - Math.PI / 2; // -90 rotated to point in dir
        const armAngle = baseAngle + swing;

        // Upper arm
        const armLength = 9;
        const elbowX = cx2 + Math.cos(armAngle) * armLength;
        const elbowY = cy2 + Math.sin(armAngle) * armLength;
        ctx.strokeStyle = '#6a6a58';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(elbowX, elbowY);
        ctx.stroke();

        // Forearm (slightly offset angle)
        const foreAngle = armAngle + 0.3;
        const clawX = elbowX + Math.cos(foreAngle) * 6;
        const clawY = elbowY + Math.sin(foreAngle) * 6;
        ctx.strokeStyle = '#8a8a72';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(elbowX, elbowY);
        ctx.lineTo(clawX, clawY);
        ctx.stroke();

        // Claw / grip at tip
        ctx.fillStyle = building.isActive ? '#ffcc44' : '#888870';
        ctx.beginPath();
        ctx.arc(clawX, clawY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.lineCap = 'butt';
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
      const isVertical = dy !== 0;

      // ── Belt rubber surface ──
      ctx.fillStyle = '#211f1a';
      ctx.beginPath();
      ctx.roundRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4, 1.5);
      ctx.fill();

      // ── Center track strip (slightly lighter rubber) ──
      ctx.fillStyle = '#2c2924';
      if (isVertical) {
        ctx.fillRect(sx + 6, sy + 2, TILE_SIZE - 12, TILE_SIZE - 4);
      } else {
        ctx.fillRect(sx + 2, sy + 6, TILE_SIZE - 4, TILE_SIZE - 12);
      }

      // ── Metal side rails ──
      const railGrad = isVertical
        ? ctx.createLinearGradient(sx + 2, 0, sx + 6, 0)
        : ctx.createLinearGradient(0, sy + 2, 0, sy + 6);
      railGrad.addColorStop(0, '#5a5648');
      railGrad.addColorStop(1, '#3a3830');
      ctx.fillStyle = railGrad;
      if (isVertical) {
        ctx.fillRect(sx + 2, sy + 2, 4, TILE_SIZE - 4);
        ctx.fillRect(sx + TILE_SIZE - 6, sy + 2, 4, TILE_SIZE - 4);
      } else {
        ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, 4);
        ctx.fillRect(sx + 2, sy + TILE_SIZE - 6, TILE_SIZE - 4, 4);
      }
      // Rail highlight edge
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      if (isVertical) {
        ctx.fillRect(sx + 2, sy + 2, 1, TILE_SIZE - 4);
        ctx.fillRect(sx + TILE_SIZE - 6, sy + 2, 1, TILE_SIZE - 4);
      } else {
        ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, 1);
        ctx.fillRect(sx + 2, sy + TILE_SIZE - 6, TILE_SIZE - 4, 1);
      }
      // Rail shadow edge
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (isVertical) {
        ctx.fillRect(sx + 5, sy + 2, 1, TILE_SIZE - 4);
        ctx.fillRect(sx + TILE_SIZE - 7, sy + 2, 1, TILE_SIZE - 4);
      } else {
        ctx.fillRect(sx + 2, sy + 5, TILE_SIZE - 4, 1);
        ctx.fillRect(sx + 2, sy + TILE_SIZE - 7, TILE_SIZE - 4, 1);
      }

      // ── Animated belt cleats (perpendicular ridges) ──
      const speed = 1.8;
      const cleatSpacing = TILE_SIZE / 3;
      const animOff = ((this.frameCount * speed) % cleatSpacing + cleatSpacing) % cleatSpacing;
      ctx.strokeStyle = 'rgba(50,46,38,0.75)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 3; i++) {
        if (isVertical) {
          const cy = sy + ((i * cleatSpacing + animOff * (dy > 0 ? 1 : -1) + TILE_SIZE * 2) % TILE_SIZE + TILE_SIZE) % TILE_SIZE;
          if (cy < sy + 2 || cy > sy + TILE_SIZE - 2) continue;
          ctx.beginPath();
          ctx.moveTo(sx + 6, cy);
          ctx.lineTo(sx + TILE_SIZE - 6, cy);
          ctx.stroke();
        } else {
          const cx2 = sx + ((i * cleatSpacing + animOff * (dx > 0 ? 1 : -1) + TILE_SIZE * 2) % TILE_SIZE + TILE_SIZE) % TILE_SIZE;
          if (cx2 < sx + 2 || cx2 > sx + TILE_SIZE - 2) continue;
          ctx.beginPath();
          ctx.moveTo(cx2, sy + 6);
          ctx.lineTo(cx2, sy + TILE_SIZE - 6);
          ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';

      // ── Direction arrow painted on belt ──
      const acx = sx + TILE_SIZE / 2;
      const acy = sy + TILE_SIZE / 2;
      ctx.save();
      ctx.translate(acx, acy);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = 'rgba(255,215,80,0.28)';
      ctx.beginPath();
      ctx.moveTo(-5, -3.5);
      ctx.lineTo(4, 0);
      ctx.lineTo(-5, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ── Items on belt (3D box style) ──
      for (const seg of segments) {
        if (!seg.itemId) continue;
        const progress = seg.progress;
        const ix = sx + TILE_SIZE / 2 + dx * (progress - 0.5) * TILE_SIZE;
        const iy = sy + TILE_SIZE / 2 + dy * (progress - 0.5) * TILE_SIZE;
        const itemColor = RESOURCE_COLORS[seg.itemId] || '#aaa888';

        // Parse color components
        const rI = parseInt(itemColor.slice(1, 3), 16);
        const gI = parseInt(itemColor.slice(3, 5), 16);
        const bI = parseInt(itemColor.slice(5, 7), 16);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(ix + 1.5, iy + 3, 5.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Box top face (lighter)
        ctx.fillStyle = `rgb(${Math.min(255, rI + 35)},${Math.min(255, gI + 35)},${Math.min(255, bI + 35)})`;
        ctx.fillRect(ix - 4.5, iy - 6, 9, 7);

        // Box front face (darker, slight 3D illusion)
        ctx.fillStyle = `rgb(${Math.max(0, rI - 35)},${Math.max(0, gI - 35)},${Math.max(0, bI - 35)})`;
        ctx.fillRect(ix - 4.5, iy + 1, 9, 2.5);

        // Box right face (mid tone)
        ctx.fillStyle = `rgb(${Math.max(0, rI - 15)},${Math.max(0, gI - 15)},${Math.max(0, bI - 15)})`;
        ctx.fillRect(ix + 4.5, iy - 4, 2, 5);

        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(ix - 3.5, iy - 5, 4, 1.5);

        // Item border
        ctx.strokeStyle = `rgba(${Math.max(0, rI - 50)},${Math.max(0, gI - 50)},${Math.max(0, bI - 50)},0.7)`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(ix - 4.5, iy - 6, 9, 7);
      }
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, _state: GameState) {
    const x = enemy.x * TILE_SIZE;
    const y = enemy.y * TILE_SIZE;
    const size = enemy.type === 'behemoth' ? 14 : enemy.type === 'worm' ? 12 : 8;
    const evolution = enemy.evolution;

    // Track hit flash
    const flashFrames = this.enemyHitFlash.get(enemy.id) || 0;
    if (flashFrames > 0) this.enemyHitFlash.set(enemy.id, flashFrames - 1);
    const isFlashing = flashFrames > 0;

    // Detect damage taken this frame
    const prevHp = this.prevEnemyHealth.get(enemy.id);
    if (prevHp !== undefined && enemy.health < prevHp) {
      const dmg = Math.ceil(prevHp - enemy.health);
      this.enemyHitFlash.set(enemy.id, 6);
      this.damageNumbers.push({ x, y: y - size - 5, value: dmg, life: 40, color: '#ff4444' });
    }
    this.prevEnemyHealth.set(enemy.id, enemy.health);

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

    // White hit flash
    if (isFlashing) {
      ctx.fillStyle = `rgba(255,255,255,${(flashFrames / 6) * 0.65})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size + 2, size * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderNPC(ctx: CanvasRenderingContext2D, npc: NPC, state: GameState) {
    const x = npc.x * TILE_SIZE;
    const y = npc.y * TILE_SIZE;
    const bob = Math.sin(this.frameCount * 0.07 + npc.id.charCodeAt(0)) * 1;

    // Clothing colors by type
    const jacketColors: Record<string, string> = {
      worker: '#2a3c2a', scout: '#1e3028', trader: '#3a2810', guard: '#2a1a1a', settler: '#2c2a3a',
    };
    const accentColors: Record<string, string> = {
      worker: '#c87020', scout: '#20a840', trader: '#d4a017', guard: '#cc2020', settler: '#7a60cc',
    };
    const jacket = jacketColors[npc.type] || '#2a3a2a';
    const accent = accentColors[npc.type] || '#c87020';

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 11, 6.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#181c14';
    ctx.fillRect(x - 4, y + 4 + bob, 3.5, 6);
    ctx.fillRect(x + 0.5, y + 4 + bob, 3.5, 6);

    // Body
    const bGrad = ctx.createLinearGradient(x - 6, y - 3, x + 6, y + 5);
    bGrad.addColorStop(0, lightenColorUtil(jacket, 18));
    bGrad.addColorStop(1, jacket);
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 3 + bob, 12, 9, 2);
    ctx.fill();

    // Accent stripe
    ctx.fillStyle = accent + 'aa';
    ctx.fillRect(x - 6, y - 0.5 + bob, 12, 2);

    // Head
    ctx.fillStyle = '#daa870';
    ctx.beginPath();
    ctx.arc(x, y - 10 + bob, 5, 0, Math.PI * 2);
    ctx.fill();

    // Hat / helmet based on type
    if (npc.type === 'worker' || npc.type === 'guard') {
      ctx.fillStyle = npc.type === 'guard' ? '#880010' : '#cc8010';
      ctx.beginPath();
      ctx.ellipse(x, y - 13.5 + bob, 6.5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = npc.type === 'guard' ? '#aa0020' : '#ee9020';
      ctx.beginPath();
      ctx.ellipse(x, y - 14.5 + bob, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (npc.type === 'scout') {
      ctx.fillStyle = '#1a3818';
      ctx.beginPath();
      ctx.ellipse(x, y - 13 + bob, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (npc.type === 'trader') {
      ctx.fillStyle = '#6a4010';
      ctx.fillRect(x - 3.5, y - 16 + bob, 7, 6);
      ctx.fillRect(x - 5, y - 11 + bob, 10, 1.5);
    }

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x - 1.8, y - 10.5 + bob, 1.1, 0, Math.PI * 2);
    ctx.arc(x + 1.8, y - 10.5 + bob, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Name tag
    if (state.camera.zoom > 1) {
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const nameWidth = ctx.measureText(npc.name).width + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath();
      ctx.roundRect(x - nameWidth / 2, y - 24 + bob, nameWidth, 10, 3);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.fillText(npc.name, x, y - 17 + bob);
    }

    // HP bar if damaged
    if (npc.health < npc.maxHealth) {
      const hp = npc.health / npc.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(x - 12, y - 28 + bob, 24, 3.5, 1.5);
      ctx.fill();
      ctx.fillStyle = hp > 0.5 ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x - 11.5, y - 27.5 + bob, 23 * hp, 2.5, 1);
      ctx.fill();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
    const { player } = state;
    const x = player.x * TILE_SIZE;
    const y = player.y * TILE_SIZE;
    const bob = Math.sin(this.frameCount * 0.12) * 1.2;
    const isMoving = this.isPlayerMoving;

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const bY = isMoving ? bob : 0;

    // Legs (dark cargo pants)
    ctx.fillStyle = '#1e2818';
    ctx.fillRect(x - 5, y + 4 + bY, 4, 7);
    ctx.fillRect(x + 1, y + 4 + bY, 4, 7);
    // Boot tips
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 5, y + 10 + bY, 5, 2);
    ctx.fillRect(x + 1, y + 10 + bY, 5, 2);

    // Body — dark grey work jacket
    const bodyGrad = ctx.createLinearGradient(x - 7, y - 4, x + 7, y + 6);
    bodyGrad.addColorStop(0, '#3a3c38');
    bodyGrad.addColorStop(1, '#222420');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(x - 7, y - 4 + bY, 14, 10, 2);
    ctx.fill();

    // Hi-vis orange vest stripe
    ctx.fillStyle = 'rgba(200,100,20,0.75)';
    ctx.fillRect(x - 7, y - 1 + bY, 14, 2);
    ctx.fillRect(x - 1, y - 4 + bY, 2, 10); // vertical stripe

    // Belt
    ctx.fillStyle = '#3a2808';
    ctx.fillRect(x - 7, y + 4 + bY, 14, 2);
    ctx.fillStyle = '#c89040';
    ctx.fillRect(x - 1.5, y + 4 + bY, 3, 2); // buckle

    // Head
    ctx.fillStyle = '#e0b890';
    ctx.beginPath();
    ctx.arc(x, y - 12 + bY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hard hat
    const dir = DIR_OFFSETS[player.direction];
    ctx.fillStyle = '#d88010';
    ctx.beginPath();
    ctx.ellipse(x, y - 15.5 + bY, 7.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0a020';
    ctx.beginPath();
    ctx.ellipse(x, y - 17 + bY, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hat brim
    ctx.fillStyle = '#c07010';
    ctx.beginPath();
    ctx.ellipse(x, y - 14 + bY, 8.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face / eyes
    const eyeOffX = dir ? dir.dx * 1.8 : 0;
    const eyeOffY = dir ? dir.dy * 1.2 : 0;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x - 2.2 + eyeOffX, y - 12.5 + bY + eyeOffY, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 2.2 + eyeOffX, y - 12.5 + bY + eyeOffY, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Arm + tool
    if (dir) {
      ctx.fillStyle = '#3a3c38';
      ctx.save();
      ctx.translate(x + dir.dx * 10, y - 2 + dir.dy * 10 + bY);
      ctx.rotate(Math.atan2(dir.dy, dir.dx));
      // Arm
      ctx.fillRect(-8, -2, 8, 3);
      // Tool head (pickaxe/wrench)
      ctx.fillStyle = '#999';
      ctx.fillRect(1, -3.5, 6, 5);
      ctx.fillStyle = '#c89040';
      ctx.fillRect(1, -2, 6, 2);
      ctx.restore();
    }

    // Health bar
    const hp = player.health / player.maxHealth;
    const barW = 28;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(x - barW / 2, y - 23 + bY, barW, 4, 1.5);
    ctx.fill();
    const hpColor = hp > 0.5 ? '#22c55e' : hp > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(x - barW / 2 + 0.5, y - 22.5 + bY, (barW - 1) * hp, 3, 1);
    ctx.fill();

    // Reach circle
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(x, y, player.reach * TILE_SIZE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private keysPressed(state: GameState): boolean {
    return state.player.x !== state.player.x || state.player.y !== state.player.y;
  }

  private renderGhostBuilding(ctx: CanvasRenderingContext2D, state: GameState) {
    if (!this.ghostBuilding || !this.ghostTile) return;
    const { x, y } = this.ghostTile;
    const bsize = BUILDING_SIZES[this.ghostBuilding] || { w: 1, h: 1 };
    const sx = x * TILE_SIZE;
    const sy = y * TILE_SIZE;
    const sw = bsize.w * TILE_SIZE;
    const sh = bsize.h * TILE_SIZE;

    // Check if placement is valid (no building in the way)
    let canPlace = true;
    for (let dy = 0; dy < bsize.h && canPlace; dy++) {
      for (let dx = 0; dx < bsize.w && canPlace; dx++) {
        const tile = state.chunks.size > 0 ? (() => {
          const tx = x + dx, ty = y + dy;
          const cx = Math.floor(tx / 32), cy2 = Math.floor(ty / 32);
          const chunk = state.chunks.get(`${cx},${cy2}`);
          if (!chunk) return null;
          const lx = ((tx % 32) + 32) % 32, ly = ((ty % 32) + 32) % 32;
          return chunk[ly][lx];
        })() : null;
        if (tile?.building) canPlace = false;
      }
    }
    canPlace = canPlace && this.ghostCanAfford;

    ctx.save();
    ctx.globalAlpha = 0.52;
    if (canPlace) {
      // Valid placement: blue-green tint
      ctx.fillStyle = 'rgba(80,220,130,0.35)';
    } else {
      // Invalid: red tint
      ctx.fillStyle = 'rgba(255,60,60,0.35)';
    }
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = canPlace ? 'rgba(80,220,130,0.85)' : 'rgba(255,80,80,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx + 0.75, sy + 0.75, sw - 1.5, sh - 1.5, 2);
    ctx.stroke();

    // Show direction arrow
    const dir = DIR_OFFSETS[this.ghostDirection];
    if (dir) {
      const acx = sx + sw / 2;
      const acy = sy + sh / 2;
      ctx.fillStyle = canPlace ? 'rgba(255,255,255,0.7)' : 'rgba(255,150,150,0.7)';
      ctx.save();
      ctx.translate(acx, acy);
      ctx.rotate(Math.atan2(dir.dy, dir.dx));
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(6, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D, state: GameState, vl: number, vt: number, vr: number, vb: number) {
    for (const p of state.particles) {
      if (p.x < vl - 20 || p.x > vr + 20 || p.y < vt - 20 || p.y > vb + 20) continue;

      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      switch (p.type) {
        case 'smoke': {
          // Volumetric multi-puff smoke (3 offset circles for depth)
          const radius = p.size * (1 + (1 - alpha) * 3);
          const swirl = this.frameCount * 0.012 + p.x * 0.01;
          ctx.globalAlpha = alpha * 0.35;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(swirl) * radius * 0.25, p.y + Math.sin(swirl) * radius * 0.15, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.45;
          ctx.beginPath();
          ctx.arc(p.x - Math.sin(swirl * 1.3) * radius * 0.2, p.y - radius * 0.1, radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(swirl * 0.7 + 1) * radius * 0.3, p.y + Math.sin(swirl * 0.7 + 1) * radius * 0.2, radius * 0.6, 0, Math.PI * 2);
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

    // Dark overlay — warm dark (not cold blue)
    const darkness = (1 - dayFactor) * 0.72;
    lightCtx.fillStyle = `rgba(8,5,2,${darkness})`;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Cut out light sources
    lightCtx.globalCompositeOperation = 'destination-out';

    // Player torch light (warm, personal radius)
    const px = canvas.width / 2;
    const py = canvas.height / 2;
    const playerLight = lightCtx.createRadialGradient(px, py, 0, px, py, 130 * state.camera.zoom);
    playerLight.addColorStop(0, 'rgba(0,0,0,0.95)');
    playerLight.addColorStop(0.4, 'rgba(0,0,0,0.7)');
    playerLight.addColorStop(0.8, 'rgba(0,0,0,0.2)');
    playerLight.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = playerLight;
    lightCtx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    // Building lights — more sources, larger radius
    for (const [, building] of state.buildings) {
      const litTypes = ['furnace', 'boiler', 'lab', 'radar', 'steam_engine', 'assembler', 'refinery', 'chemical_plant'];
      if (!litTypes.includes(building.type)) continue;
      if (!building.isActive) continue;
      const bx = (building.x * TILE_SIZE - state.camera.x) * state.camera.zoom + canvas.width / 2;
      const by = (building.y * TILE_SIZE - state.camera.y) * state.camera.zoom + canvas.height / 2;
      if (bx < -150 || bx > canvas.width + 150 || by < -150 || by > canvas.height + 150) continue;
      const radius = (building.type === 'furnace' ? 100 : building.type === 'steam_engine' ? 90 : 65) * state.camera.zoom;
      const light = lightCtx.createRadialGradient(bx, by, 0, bx, by, radius);
      const alpha = building.type === 'furnace' ? '0.75' : building.type === 'lab' ? '0.6' : '0.55';
      light.addColorStop(0, `rgba(0,0,0,${alpha})`);
      light.addColorStop(0.5, `rgba(0,0,0,${parseFloat(alpha) * 0.4})`);
      light.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = light;
      lightCtx.fillRect(bx - radius, by - radius, radius * 2, radius * 2);
    }

    lightCtx.globalCompositeOperation = 'source-over';

    // Amber tint for illuminated areas
    lightCtx.globalCompositeOperation = 'source-atop';
    lightCtx.fillStyle = 'rgba(255,140,30,0.07)';
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
    // Corner-focused vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Subtle amber pollution haze at bottom
    const hazeGrad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    hazeGrad.addColorStop(1, 'rgba(30,15,0,0.12)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

function lightenColorUtil(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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
