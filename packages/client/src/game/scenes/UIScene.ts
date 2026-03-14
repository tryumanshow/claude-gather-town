import Phaser from 'phaser';
import { EventBus } from '../../EventBus.ts';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, ZONES } from '@theater/shared';

/**
 * UIScene: runs in parallel on top of WorldScene.
 * Provides a minimap and zone transition indicator.
 */
export class UIScene extends Phaser.Scene {
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private minimap!: Phaser.GameObjects.Graphics;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private playerDot!: Phaser.GameObjects.Graphics;
  private agentDots: Map<string, Phaser.GameObjects.Arc> = new Map();
  private trailDots: Phaser.GameObjects.Arc[] = [];
  private trailTimer = 0;
  private zoneLabel!: Phaser.GameObjects.Text;
  private zoneLabelBg!: Phaser.GameObjects.Graphics;
  private zoneFadeTimer: Phaser.Time.TimerEvent | null = null;
  private currentZoneName = '';
  // Guard flag: prevents handlers from firing after scene is destroyed
  private alive = false;
  private hasBg = false;
  // EventBus handler refs for cleanup
  private _onPlayerPos!: (pos: { x: number; y: number }) => void;
  private _onAgentSpawn!: (p: { agentId: string; x: number; y: number; color: string }) => void;
  private _onAgentMove!: (p: { agentId: string; targetX: number; targetY: number }) => void;
  private _onAgentDespawn!: (p: { agentId: string }) => void;
  private _onSnapshot!: () => void;

  // Minimap config
  private readonly MM_W = 160;
  private readonly MM_H = 120;
  private readonly MM_X = 10;
  private readonly MM_Y = 10;
  private readonly MM_SCALE_X = 160 / (MAP_WIDTH * TILE_SIZE);
  private readonly MM_SCALE_Y = 120 / (MAP_HEIGHT * TILE_SIZE);

  constructor() {
    super({ key: 'UIScene', active: true });
  }

  create() {
    this.alive = true;

    // === MINIMAP (disabled — obscures agents in planning zone) ===
    this.minimapBg = this.add.graphics();
    this.minimap = this.add.graphics();
    this.playerDot = this.add.graphics();

    // === ZONE TRANSITION LABEL ===
    this.zoneLabelBg = this.add.graphics();
    this.zoneLabelBg.setAlpha(0);

    this.zoneLabel = this.add.text(
      this.cameras.main.width / 2,
      60,
      '',
      {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        padding: { x: 12, y: 6 },
      }
    );
    this.zoneLabel.setOrigin(0.5);
    this.zoneLabel.setAlpha(0);

    // === AMBIENT COLOR CYCLE ===
    this.ambientOverlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0xffa040, 0  // warm orange, starts invisible
    );
    this.ambientOverlay.setDepth(50);

    // Slow warm/cool color cycle
    let ambientPhase = 0;
    this.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.alive) return;
        ambientPhase += 0.005;
        const t = (Math.sin(ambientPhase) + 1) / 2; // 0..1
        // Interpolate between warm orange (0xffa040) and cool blue (0x4060ff)
        const r = Math.round(0xff * (1 - t) + 0x40 * t);
        const g = Math.round(0xa0 * (1 - t) + 0x60 * t);
        const b = Math.round(0x40 * (1 - t) + 0xff * t);
        const color = (r << 16) | (g << 8) | b;
        this.ambientOverlay.setFillStyle(color, 0.015); // Very subtle!
      },
      loop: true,
    });

    // === VIGNETTE (cinematic edge darkening) ===
    this.addVignette();

    // Named handlers with alive guard (prevents access to destroyed game objects)
    this._onPlayerPos = (pos: { x: number; y: number }) => {
      if (!this.alive) return;
      // Minimap disabled — only check zone transitions
      this.checkZoneTransition(pos.x, pos.y);
    };
    this._onAgentSpawn = (_p: { agentId: string; x: number; y: number; color: string }) => {};
    this._onAgentMove = (_p: { agentId: string; targetX: number; targetY: number }) => {};
    this._onAgentDespawn = (_p: { agentId: string }) => {};
    this._onSnapshot = () => {};

    EventBus.on('player:position', this._onPlayerPos);
    EventBus.on('ws:agent:spawn', this._onAgentSpawn);
    EventBus.on('ws:agent:move', this._onAgentMove);
    EventBus.on('ws:agent:despawn', this._onAgentDespawn);
    EventBus.on('ws:world:snapshot', this._onSnapshot);

    // Minimap disabled — no bg:set/clear handlers needed

    // Reposition on resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.zoneLabel.setX(gameSize.width / 2);
      this.ambientOverlay.setPosition(gameSize.width / 2, gameSize.height / 2);
      this.ambientOverlay.setSize(gameSize.width, gameSize.height);
    });

    // Clean up EventBus listeners when scene is destroyed (React StrictMode double-mount)
    this.events.on('shutdown', () => {
      this.alive = false; // Immediately prevent handlers from accessing destroyed objects
      EventBus.off('player:position', this._onPlayerPos);
      EventBus.off('ws:agent:spawn', this._onAgentSpawn);
      EventBus.off('ws:agent:move', this._onAgentMove);
      EventBus.off('ws:agent:despawn', this._onAgentDespawn);
      EventBus.off('ws:world:snapshot', this._onSnapshot);
      for (const d of this.trailDots) d.destroy();
      this.trailDots = [];
    });
  }

  private addVignette() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Create a canvas texture with radial gradient for smooth vignette
    const key = '_vignette_tex';
    if (!this.textures.exists(key)) {
      const canvasTex = this.textures.createCanvas(key, w, h)!;
      const ctx = canvasTex.context;

      // Radial gradient: transparent center → dark edges
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.max(w, h) * 0.7;
      const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.35)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      canvasTex.refresh();
    }

    const vignette = this.add.image(w / 2, h / 2, key);
    vignette.setScrollFactor(0);
    vignette.setDepth(100);

    // Rebuild vignette on resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      if (!this.alive) return;
      const nw = gameSize.width;
      const nh = gameSize.height;

      // Recreate texture
      if (this.textures.exists(key)) this.textures.remove(key);
      const canvasTex = this.textures.createCanvas(key, nw, nh)!;
      const ctx = canvasTex.context;
      const cx2 = nw / 2;
      const cy2 = nh / 2;
      const r2 = Math.max(nw, nh) * 0.7;
      const g2 = ctx.createRadialGradient(cx2, cy2, r2 * 0.4, cx2, cy2, r2);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      g2.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, nw, nh);
      canvasTex.refresh();

      vignette.setTexture(key);
      vignette.setPosition(nw / 2, nh / 2);
    });
  }

  private drawMinimapZones() {
    const ox = this.MM_X;
    const oy = this.MM_Y;

    // Background fill
    this.minimap.fillStyle(0x1a1a2e, 1);
    this.minimap.fillRect(ox, oy, this.MM_W, this.MM_H);

    if (this.hasBg) {
      // Background image active: show neutral grid (no zone colors — they don't match the bg image)
      this.minimap.lineStyle(1, 0x333355, 0.6);
      this.minimap.strokeRect(ox, oy, this.MM_W, this.MM_H);
      // Subtle grid lines
      const gridCols = 8;
      const gridRows = 6;
      this.minimap.lineStyle(1, 0x222244, 0.4);
      for (let i = 1; i < gridCols; i++) {
        const gx = ox + (this.MM_W / gridCols) * i;
        this.minimap.lineBetween(gx, oy, gx, oy + this.MM_H);
      }
      for (let i = 1; i < gridRows; i++) {
        const gy = oy + (this.MM_H / gridRows) * i;
        this.minimap.lineBetween(ox, gy, ox + this.MM_W, gy);
      }
      return;
    }

    // Draw each zone
    const zoneColors: Record<string, number> = {
      'planning': 0x9B59B6,
      'code-workshop': 0x4A90D9,
      'review-room': 0xE67E22,
      'spawn': 0x2ECC71,
      'task-board': 0xF39C12,
      'message-center': 0xE91E63,
      'research-lab': 0x1ABC9C,
      'tool-forge': 0xE74C3C,
    };

    for (const zone of ZONES) {
      const color = zoneColors[zone.name] ?? 0x444444;
      const zx = ox + (zone.x * TILE_SIZE) * this.MM_SCALE_X;
      const zy = oy + (zone.y * TILE_SIZE) * this.MM_SCALE_Y;
      const zw = (zone.width * TILE_SIZE) * this.MM_SCALE_X;
      const zh = (zone.height * TILE_SIZE) * this.MM_SCALE_Y;

      this.minimap.fillStyle(color, 0.3);
      this.minimap.fillRect(zx, zy, zw, zh);
      this.minimap.lineStyle(1, color, 0.5);
      this.minimap.strokeRect(zx, zy, zw, zh);
    }

    // Walls (thin lines)
    this.minimap.lineStyle(1, 0x888888, 0.4);
    // Outer boundary
    this.minimap.strokeRect(ox, oy, this.MM_W, this.MM_H);
    // Horizontal walls
    const wallYs = [7, 16, 23];
    for (const wy of wallYs) {
      const y = oy + (wy * TILE_SIZE) * this.MM_SCALE_Y;
      this.minimap.lineBetween(ox, y, ox + this.MM_W, y);
    }
    // Vertical wall (code-workshop | review-room)
    const vx = ox + (19 * TILE_SIZE) * this.MM_SCALE_X;
    const vy1 = oy + (8 * TILE_SIZE) * this.MM_SCALE_Y;
    const vy2 = oy + (16 * TILE_SIZE) * this.MM_SCALE_Y;
    this.minimap.lineBetween(vx, vy1, vx, vy2);
  }

  private updatePlayerDot(px: number, py: number) {
    this.playerDot.clear();
    const dx = this.MM_X + px * this.MM_SCALE_X;
    const dy = this.MM_Y + py * this.MM_SCALE_Y;
    // Yellow dot for player
    this.playerDot.fillStyle(0xFFD700, 1);
    this.playerDot.fillCircle(dx, dy, 3);
    // Pulse ring
    this.playerDot.lineStyle(1, 0xFFD700, 0.5);
    this.playerDot.strokeCircle(dx, dy, 5);

    // Trail dot (every few updates)
    this.trailTimer++;
    if (this.trailTimer % 10 === 0) { // Every 10th position update
      const trailDot = this.add.circle(dx, dy, 1.5, 0xFFD700, 0.4);
      this.trailDots.push(trailDot);

      // Fade out trail dot
      this.tweens.add({
        targets: trailDot,
        alpha: 0,
        duration: 5000,
        onComplete: () => {
          trailDot.destroy();
          this.trailDots = this.trailDots.filter(d => d !== trailDot);
        },
      });

      // Limit trail length
      if (this.trailDots.length > 30) {
        const old = this.trailDots.shift();
        if (old) {
          this.tweens.killTweensOf(old);
          old.destroy();
        }
      }
    }
  }

  private addAgentDot(id: string, x: number, y: number, color: string) {
    if (this.agentDots.has(id)) return;
    const dx = this.MM_X + x * this.MM_SCALE_X;
    const dy = this.MM_Y + y * this.MM_SCALE_Y;
    const colorNum = parseInt(color.replace('#', '0x'));
    const dot = this.add.circle(dx, dy, 2, isNaN(colorNum) ? 0x4A90D9 : colorNum, 0.9);
    this.agentDots.set(id, dot);
  }

  private moveAgentDot(id: string, x: number, y: number) {
    const dot = this.agentDots.get(id);
    if (!dot) return;
    const dx = this.MM_X + x * this.MM_SCALE_X;
    const dy = this.MM_Y + y * this.MM_SCALE_Y;
    this.tweens.add({
      targets: dot,
      x: dx, y: dy,
      duration: 300,
      ease: 'Power1',
    });
  }

  private removeAgentDot(id: string) {
    const dot = this.agentDots.get(id);
    if (dot) {
      dot.destroy();
      this.agentDots.delete(id);
    }
  }

  private checkZoneTransition(px: number, py: number) {
    const T = TILE_SIZE;
    const tileX = Math.floor(px / T);
    const tileY = Math.floor(py / T);

    // Find which zone the player is in
    let newZone = '';
    let newZoneColor = '#2ECC71';
    for (const zone of ZONES) {
      if (tileX >= zone.x && tileX < zone.x + zone.width &&
          tileY >= zone.y && tileY < zone.y + zone.height) {
        newZone = zone.label;
        newZoneColor = zone.color;
        break;
      }
    }

    if (newZone && newZone !== this.currentZoneName) {
      this.currentZoneName = newZone;
      this.showZoneTransition(newZone, newZoneColor);
    }
  }

  private showZoneTransition(name: string, color: string) {
    // Cancel previous fade
    if (this.zoneFadeTimer) {
      this.zoneFadeTimer.destroy();
      this.zoneFadeTimer = null;
    }

    this.zoneLabel.setText(name);
    this.zoneLabel.setStyle({
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      backgroundColor: color + 'CC',
      padding: { x: 16, y: 8 },
    });

    // Fade in
    this.tweens.add({
      targets: this.zoneLabel,
      alpha: 1,
      y: 50,
      duration: 300,
      ease: 'Power2',
    });

    // Fade out after delay
    this.zoneFadeTimer = this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: this.zoneLabel,
        alpha: 0,
        y: 40,
        duration: 500,
        ease: 'Power2',
      });
    });
  }
}
