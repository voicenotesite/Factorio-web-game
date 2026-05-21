import { PicoAPI } from './api';

interface Bullet {
  x: number; y: number; active: boolean;
}
interface Enemy {
  x: number; y: number; hp: number; active: boolean;
}
interface Particle {
  x: number; y: number; dx: number; dy: number; life: number; col: number;
}

export class InwazjaCart {
  private p: PicoAPI;
  private playerX = 64;
  private playerY = 110;
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private score = 0;
  private wave = 1;
  private spawnTimer = 0;
  private gameOver = false;
  private started = false;
  private freezeTimer = 0;

  constructor(p: PicoAPI) {
    this.p = p;
  }

  reset() {
    this.playerX = 64;
    this.playerY = 110;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.score = 0;
    this.wave = 1;
    this.spawnTimer = 0;
    this.gameOver = false;
    this.started = false;
    this.freezeTimer = 0;
  }

  update() {
    if (!this.started) {
      if (this.p.btnp(4) || this.p.btnp(5)) {
        this.started = true;
        this.p.sfx(3);
      }
      return;
    }
    if (this.gameOver) {
      if (this.p.btnp(4)) this.reset();
      this.freezeTimer--;
      return;
    }

    // Player movement
    if (this.p.btn(0)) this.playerX = Math.max(4, this.playerX - 1.5);
    if (this.p.btn(1)) this.playerX = Math.min(123, this.playerX + 1.5);
    if (this.p.btn(2)) this.playerY = Math.max(4, this.playerY - 1.5);
    if (this.p.btn(3)) this.playerY = Math.min(123, this.playerY + 1.5);

    // Shoot
    if (this.p.btnp(4)) {
      this.bullets.push({ x: this.playerX, y: this.playerY - 6, active: true });
      this.p.sfx(1);
    }

    // Update bullets
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.y -= 3;
      if (b.y < 0) b.active = false;
    }

    // Spawn enemies
    this.spawnTimer++;
    const spawnRate = Math.max(10, 40 - this.wave * 2);
    if (this.spawnTimer >= spawnRate) {
      this.spawnTimer = 0;
      const count = Math.min(1 + Math.floor(this.wave / 3), 4);
      for (let i = 0; i < count; i++) {
        this.enemies.push({
          x: Math.random() * 120 + 4,
          y: -10 - Math.random() * 20,
          hp: 1 + Math.floor(this.wave / 4),
          active: true,
        });
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.y += 0.4 + this.wave * 0.05;

      // Bullet collision
      for (const b of this.bullets) {
        if (!b.active) continue;
        if (Math.abs(b.x - e.x) < 6 && Math.abs(b.y - e.y) < 6) {
          e.hp--;
          b.active = false;
          for (let k = 0; k < 4; k++) {
            this.particles.push({
              x: e.x, y: e.y,
              dx: (Math.random() - 0.5) * 3,
              dy: (Math.random() - 0.5) * 3,
              life: 12, col: 8 + Math.floor(Math.random() * 4),
            });
          }
          if (e.hp <= 0) {
            e.active = false;
            this.score += 10;
            this.p.sfx(5);
          }
        }
      }

      // Player collision
      if (Math.abs(e.x - this.playerX) < 6 && Math.abs(e.y - this.playerY) < 6) {
        this.gameOver = true;
        this.freezeTimer = 120;
        this.p.sfx(8);
      }

      if (e.y > 130) {
        e.active = false;
        this.score = Math.max(0, this.score - 5);
      }
    }

    // Wave progression
    if (this.score > this.wave * 50) {
      this.wave++;
      this.p.sfx(7);
    }

    // Update particles
    for (const pt of this.particles) {
      pt.x += pt.dx;
      pt.y += pt.dy;
      pt.life--;
    }
    this.particles = this.particles.filter(pt => pt.life > 0);

    // Cleanup
    this.bullets = this.bullets.filter(b => b.active);
    this.enemies = this.enemies.filter(e => e.active);

    this.p.endFrame();
  }

  draw() {
    this.p.cls(0);

    // Starfield
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137 + 13) % 128;
      const sy = (i * 89 + 41) % 128;
      this.p.pset(sx, sy, 1 + (i % 3));
    }

    if (!this.started) {
      // Title screen
      this.p.print('INWAZJA', 28, 30, 12);
      this.p.print('PICO-8 EDITION', 10, 48, 9);
      this.p.print('PRESS Z', 36, 70, 7);
      this.p.print('arrow keys to move', 10, 88, 5);
      this.p.flip();
      return;
    }

    // Bullets
    for (const b of this.bullets) {
      if (!b.active) continue;
      this.p.rectfill(b.x - 1, b.y - 3, b.x + 1, b.y, 10);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      this.p.circfill(e.x, e.y, 4, 8 + (e.hp % 4));
      this.p.rectfill(e.x - 2, e.y + 3, e.x + 2, e.y + 5, 2);
      if (e.hp > 1) {
        this.p.rectfill(e.x - 3, e.y - 6, e.x + 3, e.y - 5, 13);
        this.p.rectfill(e.x - 3, e.y - 6, e.x - 3 + Math.floor(6 * e.hp / 5), e.y - 5, 8);
      }
    }

    // Player (triangle ship)
    this.p.rectfill(this.playerX - 4, this.playerY + 3, this.playerX + 4, this.playerY + 6, 9);
    this.p.rectfill(this.playerX - 1, this.playerY + 1, this.playerX + 1, this.playerY + 5, 7);
    this.p.pset(this.playerX, this.playerY - 4, 10);
    this.p.rectfill(this.playerX - 3, this.playerY + 6, this.playerX + 3, this.playerY + 9, 2);

    // Particles
    for (const pt of this.particles) {
      this.p.pset(Math.floor(pt.x), Math.floor(pt.y), pt.col);
    }

    // HUD
    this.p.print('SCORE', 2, 2, 6);
    this.p.print(String(this.score), 2, 10, 7);
    this.p.print('WAVE', 96, 2, 6);
    this.p.print(String(this.wave), 100, 10, 7);

    // Game over
    if (this.gameOver) {
      this.p.rectfill(20, 40, 108, 80, 0);
      this.p.print('GAME OVER', 28, 48, 8);
      this.p.print('SCORE: ' + this.score, 28, 58, 7);
      if (this.freezeTimer <= 0) {
        this.p.print('PRESS Z', 40, 70, 12);
      }
    }

    this.p.flip();
  }
}
