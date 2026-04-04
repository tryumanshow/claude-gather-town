import Phaser from 'phaser';
import { EventBus } from '../../EventBus.ts';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, ZONES, AGENT_ROSTER, fromRosterId } from '@theater/shared';
import type {
  AgentSpawnPayload, AgentMovePayload, AgentStatePayload,
  AgentDespawnPayload, ToolUsePayload, AgentChatPayload,
  WorldSnapshotPayload, MessageSendPayload, RosterInitPayload,
  MeetingPhasePayload
} from '@theater/shared';
import { SpriteGenerator } from '../SpriteGenerator.ts';
import { TileGenerator } from '../TileGenerator.ts';
import { FurnitureGenerator } from '../FurnitureGenerator.ts';

interface AgentGameObject {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameBg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  stateIcon: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Ellipse;
  chatBubble: Phaser.GameObjects.Container | null;
  chatTimer: Phaser.Time.TimerEvent | null;
  moveTween: Phaser.Tweens.Tween | null;
  data: AgentSpawnPayload;
}

export class WorldScene extends Phaser.Scene {
  private agents: Map<string, AgentGameObject> = new Map();

  // Player character
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerDir = 'down';
  private playerMoving = false;
  private readonly PLAYER_SPEED = 120;
  private readonly PLAYER_TYPE = 'designer';
  // Native DOM key tracking (bypasses Phaser's defaultPrevented check)
  private keysDown: Set<string> = new Set();
  // Guard flag: prevents handlers from firing after scene is destroyed
  private alive = false;
  // Walking dust particle cooldown (ms)
  private dustCooldown = 0;
  private ambientParticleTimer: Phaser.Time.TimerEvent | null = null;

  // Position emission throttle
  private lastEmittedX = 0;
  private lastEmittedY = 0;
  // Custom background image overlay
  private customBg: Phaser.GameObjects.Image | null = null;
  private customBgFill: Phaser.GameObjects.Rectangle | null = null;
  // Roster agent IDs — protected from despawn
  private rosterAgentIds: Set<string> = new Set();
  // Meeting overlay
  private meetingOverlay: Phaser.GameObjects.Rectangle | null = null;
  private meetingLabel: Phaser.GameObjects.Text | null = null;
  private meetingTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create() {
    // Generate assets
    TileGenerator.generateTileset(this);
    FurnitureGenerator.generateAll(this);
    SpriteGenerator.generateAllSprites(this);
    SpriteGenerator.createAnimations(this);

    this.alive = true;

    // Build the world
    this.buildWorld();
    this.addAmbientLighting();
    this.spawnPlayer();
    this.setupCamera();
    this.setupEventListeners();
    this.startAmbientParticles();

    // Native DOM key listeners — bypass Phaser's defaultPrevented check
    // so arrow keys work even when CommandInput calls preventDefault
    const onKeyDown = (e: KeyboardEvent) => {
      const inputFocused = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement;
      // Don't register movement keys while typing in an input field
      if (!inputFocused) {
        this.keysDown.add(e.code);
      }
      // Press '/' or Enter to focus the command input
      if (e.key === '/' || e.key === 'Enter') {
        const input = document.querySelector<HTMLInputElement>('input[placeholder]');
        if (input && document.activeElement !== input) {
          input.focus();
        }
      }
      // Press Escape to blur input and return to game
      if (e.key === 'Escape') {
        (document.activeElement as HTMLElement)?.blur();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    };
    // Clear all keys when focus enters an input (prevents stuck keys)
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        this.keysDown.clear();
      }
    };
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      this.alive = false; // Immediately prevent handlers from accessing destroyed objects
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('focusin', onFocusIn);
      this.ambientParticleTimer?.destroy();
    });

    EventBus.emit('scene-ready', this);

    // Restore background image from IndexedDB
    import('../../bg-db.ts').then(({ loadBgImage }) => {
      loadBgImage().then(dataUrl => {
        if (dataUrl && this.alive) this.applyBackground(dataUrl);
      }).catch(() => {});
    });

    // Listen for background image events from React
    const onBgSet = (dataUrl: string) => { if (this.alive) this.applyBackground(dataUrl); };
    const onBgClear = () => { if (this.alive) this.clearBackground(); };
    EventBus.on('bg:set', onBgSet);
    EventBus.on('bg:clear', onBgClear);
    this.events.on('shutdown', () => {
      EventBus.off('bg:set', onBgSet);
      EventBus.off('bg:clear', onBgClear);
      this.clearBackground();
    });
  }

  // ==================== Background image (drag-and-drop) ====================

  private applyBackground(dataUrl: string) {
    this.clearBackground();
    const key = 'custom-bg-' + Date.now();
    this.textures.addBase64(key, dataUrl);
    this.textures.once('addtexture-' + key, () => {
      if (!this.alive) return;
      const worldWidth = MAP_WIDTH * TILE_SIZE;
      const worldHeight = MAP_HEIGHT * TILE_SIZE;

      // Dark fill covers ALL procedural elements (oversized to handle edge cases)
      this.customBgFill = this.add.rectangle(
        worldWidth / 2, worldHeight / 2, worldWidth + 200, worldHeight + 200, 0x0a0a1a,
      ).setDepth(4.4);

      // Fill mode: stretch to exact world dimensions (no clipping, no black bars)
      this.customBg = this.add.image(0, 0, key)
        .setOrigin(0, 0)
        .setDisplaySize(worldWidth, worldHeight)
        .setDepth(4.5); // Above all procedural (max depth 4), below characters (5+)

      // Use LINEAR filter so the background renders smoothly (not pixelated by antialias:false)
      this.customBg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

      // Zoom out camera to show entire background (no clipping)
      this.fitCameraToWorld();
    });
  }

  /** Zoom camera so entire world is visible in viewport (contain mode) */
  private fitCameraToWorld() {
    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const vh = this.scale.height;

    // Contain: entire world visible, dark bars fill extra space
    const zoom = Math.min(vw / worldWidth, vh / worldHeight);
    cam.stopFollow();
    cam.removeBounds();
    cam.setZoom(zoom);
    cam.setBackgroundColor(0x0a0a1a); // Dark fill for areas outside world
    cam.centerOn(worldWidth / 2, worldHeight / 2);
  }

  /** Re-fit background on viewport resize */
  private fitBackgroundToCamera() {
    if (!this.customBg) return;
    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;

    this.customBg.setPosition(0, 0);
    this.customBg.setDisplaySize(worldWidth, worldHeight);

    if (this.customBgFill) {
      this.customBgFill.setPosition(worldWidth / 2, worldHeight / 2);
      this.customBgFill.setSize(worldWidth, worldHeight);
    }

    // Re-fit camera zoom on resize
    this.fitCameraToWorld();
  }

  private clearBackground() {
    if (this.customBg) {
      const texKey = this.customBg.texture.key;
      this.customBg.destroy();
      this.customBg = null;
      if (this.textures.exists(texKey)) {
        this.textures.remove(texKey);
      }
    }
    if (this.customBgFill) {
      this.customBgFill.destroy();
      this.customBgFill = null;
    }
    // Restore default camera: zoom 2x + follow player
    if (this.player) {
      const worldWidth = MAP_WIDTH * TILE_SIZE;
      const worldHeight = MAP_HEIGHT * TILE_SIZE;
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setZoom(2);
      this.cameras.main.setBackgroundColor(0x000000);
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setDeadzone(40, 30);
    }
  }

  private buildWorld() {
    const T = TILE_SIZE;

    // === Floor layer ===
    const floorMap: Record<string, number> = {
      'planning': 16,      // soft purple carpet
      'code-workshop': 2,  // soft blue carpet
      'review-room': 4,    // soft tan carpet
      'spawn': 5,          // clean tile floor
      'task-board': 5,     // clean tile floor
      'message-center': 5, // clean tile floor
      'research-lab': 3,   // soft sage carpet
      'tool-forge': 5,     // clean tile floor
    };

    // Fill entire map with warm lobby floor
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.add.image(x * T + T / 2, y * T + T / 2, 'tiles_sheet', 0).setDepth(0);
      }
    }

    // Fill zones with their floor type
    for (const zone of ZONES) {
      const tileIdx = floorMap[zone.name] ?? 0;
      for (let y = zone.y; y < zone.y + zone.height; y++) {
        for (let x = zone.x; x < zone.x + zone.width; x++) {
          this.add.image(x * T + T / 2, y * T + T / 2, 'tiles_sheet', tileIdx).setDepth(0);
        }
      }
    }

    // === Walls — only outer perimeter + major room dividers ===
    // Outer walls (perimeter)
    for (let x = 0; x < MAP_WIDTH; x++) {
      this.add.image(x * T + T / 2, T / 2, 'tiles_sheet', 6).setDepth(1);
      this.add.image(x * T + T / 2, (MAP_HEIGHT - 1) * T + T / 2, 'tiles_sheet', 6).setDepth(1);
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.add.image(T / 2, y * T + T / 2, 'tiles_sheet', 6).setDepth(1);
      this.add.image((MAP_WIDTH - 1) * T + T / 2, y * T + T / 2, 'tiles_sheet', 6).setDepth(1);
    }

    // Room dividers — only between major zones, with doorway gaps
    const plan = ZONES.find(z => z.name === 'planning')!;
    const code = ZONES.find(z => z.name === 'code-workshop')!;
    const review = ZONES.find(z => z.name === 'review-room')!;
    const lobby = ZONES.find(z => z.name === 'spawn')!;
    const research = ZONES.find(z => z.name === 'research-lab')!;

    // Wall between planning room and code/review (horizontal)
    const wallY1 = plan.y + plan.height;
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      // Leave doorway gaps
      if ((x >= 8 && x <= 10) || (x >= 28 && x <= 30)) {
        this.add.image(x * T + T / 2, wallY1 * T + T / 2, 'tiles_sheet', 18).setDepth(1); // door
        continue;
      }
      this.add.image(x * T + T / 2, wallY1 * T + T / 2, 'tiles_sheet', 7).setDepth(1);
    }

    // Wall between code+review and central lobby (horizontal)
    const wallY2 = code.y + code.height;
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if ((x >= 8 && x <= 10) || (x >= 18 && x <= 20) || (x >= 28 && x <= 30)) continue; // doorways (just skip)
      this.add.image(x * T + T / 2, wallY2 * T + T / 2, 'tiles_sheet', 7).setDepth(1);
    }

    // Vertical wall between code workshop and review room
    const wallX = code.x + code.width;
    for (let y = code.y; y < code.y + code.height; y++) {
      if (y >= code.y + 3 && y <= code.y + 5) continue; // doorway
      this.add.image(wallX * T + T / 2, y * T + T / 2, 'tiles_sheet', 6).setDepth(1);
    }

    // Wall between central lobby and research lab (horizontal)
    const wallY3 = lobby.y + lobby.height;
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      if ((x >= 14 && x <= 16) || (x >= 24 && x <= 26)) continue; // doorways
      this.add.image(x * T + T / 2, wallY3 * T + T / 2, 'tiles_sheet', 7).setDepth(1);
    }

    // === Floor detail variation (breaks monotony, adds life) ===
    for (const zone of ZONES) {
      for (let y = zone.y; y < zone.y + zone.height; y++) {
        for (let x = zone.x; x < zone.x + zone.width; x++) {
          // ~15% chance of a subtle floor detail
          if (Math.random() > 0.15) continue;
          const fx = x * T + Phaser.Math.Between(4, T - 4);
          const fy = y * T + Phaser.Math.Between(4, T - 4);
          const detail = this.add.circle(fx, fy,
            Phaser.Math.FloatBetween(0.5, 1.2),
            0x000000,
            Phaser.Math.FloatBetween(0.02, 0.06)
          );
          detail.setDepth(0.5);
        }
      }
    }

    // === Lobby rug (decorative center piece) ===
    const lobbyForRug = ZONES.find(z => z.name === 'spawn')!;
    const rugCX = lobbyForRug.x + Math.floor(lobbyForRug.width / 2);
    const rugCY = lobbyForRug.y + Math.floor(lobbyForRug.height / 2);
    for (let ry = -1; ry <= 1; ry++) {
      for (let rx = -1; rx <= 1; rx++) {
        this.add.image((rugCX + rx) * T + T / 2, (rugCY + ry) * T + T / 2, 'tiles_sheet', 19).setDepth(1);
      }
    }

    // === Ambient zone lighting (subtle gradient overlay per zone) ===
    for (const zone of ZONES) {
      if (zone.name === 'task-board' || zone.name === 'message-center' || zone.name === 'tool-forge') continue;

      const zx = zone.x * T;
      const zy = zone.y * T;
      const zw = zone.width * T;
      const zh = zone.height * T;
      const colorNum = parseInt(zone.color.replace('#', '0x'));

      // Corner glow (subtle radial feel via 4 corner rects)
      const glow = this.add.graphics();
      glow.fillStyle(isNaN(colorNum) ? 0x4a90d9 : colorNum, 0.04);
      glow.fillRect(zx, zy, zw, zh);
      glow.setDepth(1);

      // Edge highlight along top
      const edge = this.add.graphics();
      edge.fillStyle(isNaN(colorNum) ? 0x4a90d9 : colorNum, 0.08);
      edge.fillRect(zx, zy, zw, 2);
      edge.setDepth(1);
    }

    // === Wall depth shadows (3D feel) ===
    const wallShadow = this.add.graphics();
    wallShadow.setDepth(1);
    // Horizontal wall shadows (below walls)
    for (const wy of [7, 16, 23]) {
      for (let sx = 1; sx < MAP_WIDTH - 1; sx++) {
        wallShadow.fillStyle(0x000000, 0.12);
        wallShadow.fillRect(sx * T, (wy + 1) * T, T, 3);
        wallShadow.fillStyle(0x000000, 0.06);
        wallShadow.fillRect(sx * T, (wy + 1) * T + 3, T, 3);
      }
    }
    // Vertical wall shadow (right side of x=19 wall, y=8..15)
    for (let sy = 8; sy <= 15; sy++) {
      wallShadow.fillStyle(0x000000, 0.12);
      wallShadow.fillRect(20 * T, sy * T, 3, T);
      wallShadow.fillStyle(0x000000, 0.06);
      wallShadow.fillRect(20 * T + 3, sy * T, 3, T);
    }

    // === Zone labels (clean, small, positioned near top of each zone) ===
    for (const zone of ZONES) {
      // Skip sub-zones to reduce clutter
      if (zone.name === 'task-board' || zone.name === 'message-center' || zone.name === 'tool-forge') continue;

      const labelX = (zone.x + zone.width / 2) * T;
      const labelY = (zone.y + 1) * T;

      // Label with rounded background
      const label = this.add.text(labelX, labelY, zone.label, {
        fontSize: '13px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        backgroundColor: zone.color + 'BB',
        padding: { x: 8, y: 4 },
      });
      label.setOrigin(0.5);
      label.setDepth(2);
    }

    // === Furniture placement ===
    this.placeFurniture();
  }

  private placeFurniture() {
    const T = TILE_SIZE;

    // Place a multi-tile furniture texture at tile coordinates.
    // originY defaults to 1 (bottom-aligned) so tall items sit on the floor correctly.
    const place = (key: string, tx: number, ty: number, originY = 1) => {
      this.add.image(tx * T + T / 2, ty * T + T, key).setOrigin(0.5, originY).setDepth(3);
    };

    // Planning Room: desks with monitors, chairs, whiteboard, plant
    const plan = ZONES.find(z => z.name === 'planning')!;
    place('furn_desk', plan.x + 4, plan.y + 3);
    place('furn_desk', plan.x + 10, plan.y + 3);
    place('furn_desk', plan.x + 16, plan.y + 3);
    place('furn_chair', plan.x + 4, plan.y + 5);
    place('furn_chair', plan.x + 10, plan.y + 5);
    place('furn_chair', plan.x + 16, plan.y + 5);
    place('furn_whiteboard', plan.x + 24, plan.y + 3);
    place('furn_whiteboard', plan.x + 32, plan.y + 3);
    place('furn_plant', plan.x + 37, plan.y + 3);
    place('furn_lamp', plan.x + 2, plan.y + 3);
    // Wall decorations
    place('furn_clock', plan.x + 20, plan.y + 1, 0.5);
    place('furn_poster', plan.x + 28, plan.y + 1, 0.5);

    // Code Workshop: desks, chairs, server racks
    const code = ZONES.find(z => z.name === 'code-workshop')!;
    place('furn_desk', code.x + 3, code.y + 2);
    place('furn_desk', code.x + 8, code.y + 2);
    place('furn_desk', code.x + 13, code.y + 2);
    place('furn_chair', code.x + 3, code.y + 4);
    place('furn_chair', code.x + 8, code.y + 4);
    place('furn_chair', code.x + 13, code.y + 4);
    place('furn_desk', code.x + 3, code.y + 5);
    place('furn_desk', code.x + 8, code.y + 5);
    place('furn_chair', code.x + 3, code.y + 6);  // Taeho seat (4,14)
    place('furn_server', code.x + 16, code.y + 3);
    place('furn_server', code.x + 17, code.y + 6);
    place('furn_lamp', code.x + 6, code.y + 2);
    place('furn_lamp', code.x + 11, code.y + 2);
    // Wall decorations
    place('furn_poster', code.x + 1, code.y + 1, 0.5);
    place('furn_frame', code.x + 15, code.y + 1, 0.5);

    // Review Room: desks, chairs, bookshelves, plant
    const review = ZONES.find(z => z.name === 'review-room')!;
    place('furn_desk', review.x + 4, review.y + 3);
    place('furn_desk', review.x + 10, review.y + 3);
    place('furn_chair', review.x + 4, review.y + 5);
    place('furn_chair', review.x + 10, review.y + 5);
    place('furn_bookshelf', review.x + 15, review.y + 3);
    place('furn_bookshelf', review.x + 17, review.y + 3);
    place('furn_plant', review.x + 2, review.y + 3);
    place('furn_sofa', review.x + 8, review.y + 7);
    // Wall decorations
    place('furn_frame', review.x + 7, review.y + 1, 0.5);
    place('furn_clock', review.x + 13, review.y + 1, 0.5);

    // Central Lobby: task board, coffee machine, sofa, plants
    const lobby = ZONES.find(z => z.name === 'spawn')!;
    place('furn_taskboard', lobby.x + 16, lobby.y + 2);
    place('furn_taskboard', lobby.x + 20, lobby.y + 2);
    place('furn_coffee', lobby.x + 32, lobby.y + 3);
    place('furn_plant', lobby.x + 2, lobby.y + 2);
    place('furn_plant', lobby.x + 36, lobby.y + 2);
    place('furn_sofa', lobby.x + 6, lobby.y + 5);
    place('furn_sofa', lobby.x + 26, lobby.y + 5);
    place('furn_mug', lobby.x + 33, lobby.y + 2);
    place('furn_lamp', lobby.x + 35, lobby.y + 3);
    // Wall decorations
    place('furn_poster', lobby.x + 10, lobby.y + 1, 0.5);
    place('furn_frame', lobby.x + 28, lobby.y + 1, 0.5);
    place('furn_clock', lobby.x + 14, lobby.y + 1, 0.5);

    // Research Lab: desks, chairs, bookshelves, server rack, plant
    const research = ZONES.find(z => z.name === 'research-lab')!;
    place('furn_desk', research.x + 4, research.y + 2);
    place('furn_desk', research.x + 10, research.y + 2);
    place('furn_desk', research.x + 16, research.y + 2);
    place('furn_chair', research.x + 4, research.y + 4);
    place('furn_chair', research.x + 10, research.y + 4);
    place('furn_chair', research.x + 16, research.y + 4);
    place('furn_bookshelf', research.x + 22, research.y + 3);
    place('furn_bookshelf', research.x + 24, research.y + 3);
    place('furn_bookshelf', research.x + 26, research.y + 3);
    place('furn_server', research.x + 33, research.y + 3);
    place('furn_plant', research.x + 36, research.y + 2);
    place('furn_lamp', research.x + 2, research.y + 2);
    // Wall decorations
    place('furn_poster', research.x + 8, research.y + 1, 0.5);
    place('furn_frame', research.x + 30, research.y + 1, 0.5);

    // Tool Forge: desks + chairs for Sam & Minjun
    const forge = ZONES.find(z => z.name === 'tool-forge')!;
    place('furn_desk', forge.x + 2, forge.y + 0);   // Sam desk
    place('furn_desk', forge.x + 6, forge.y + 0);   // Minjun desk
    place('furn_chair', forge.x + 2, forge.y + 1);   // Sam seat (28,22)
    place('furn_chair', forge.x + 6, forge.y + 1);   // Minjun seat (32,22)
    place('furn_server', forge.x + 4, forge.y + 0);

    // Message Center: desk + chair for Nari
    const msg = ZONES.find(z => z.name === 'message-center')!;
    place('furn_desk', msg.x + 4, msg.y + 0);       // Nari desk
    place('furn_chair', msg.x + 4, msg.y + 1);       // Nari seat (20,22)
    place('furn_lamp', msg.x + 2, msg.y + 0);
  }

  /** Add warm ambient lighting: lamp glows, monitor screen glow, server LEDs */
  private addAmbientLighting() {
    const T = TILE_SIZE;
    const plan = ZONES.find(z => z.name === 'planning')!;
    const code = ZONES.find(z => z.name === 'code-workshop')!;
    const review = ZONES.find(z => z.name === 'review-room')!;
    const lobby = ZONES.find(z => z.name === 'spawn')!;
    const research = ZONES.find(z => z.name === 'research-lab')!;

    // === Warm lamp glows ===
    const lampPositions = [
      { x: plan.x + 2, y: plan.y + 3 },
      { x: code.x + 6, y: code.y + 2 },
      { x: code.x + 11, y: code.y + 2 },
      { x: lobby.x + 35, y: lobby.y + 3 },
      { x: research.x + 2, y: research.y + 2 },
    ];

    for (const pos of lampPositions) {
      const gx = pos.x * T + T / 2;
      const gy = pos.y * T + T / 2;

      // Outer soft glow
      const outerGlow = this.add.circle(gx, gy, 56, 0xFFF8E0, 0.045);
      outerGlow.setDepth(2);

      // Inner warm core
      const innerGlow = this.add.circle(gx, gy, 28, 0xFFE8A0, 0.07);
      innerGlow.setDepth(2);

      // Subtle pulse
      this.tweens.add({
        targets: [outerGlow, innerGlow],
        alpha: { from: outerGlow.alpha, to: outerGlow.alpha * 0.6 },
        duration: 2500 + Math.random() * 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // === Monitor screen glow (cool blue) ===
    const deskPositions = [
      { x: plan.x + 4, y: plan.y + 3 },
      { x: plan.x + 10, y: plan.y + 3 },
      { x: plan.x + 16, y: plan.y + 3 },
      { x: code.x + 3, y: code.y + 2 },
      { x: code.x + 8, y: code.y + 2 },
      { x: code.x + 13, y: code.y + 2 },
      { x: code.x + 3, y: code.y + 5 },
      { x: code.x + 8, y: code.y + 5 },
      { x: review.x + 4, y: review.y + 3 },
      { x: review.x + 10, y: review.y + 3 },
      { x: research.x + 4, y: research.y + 2 },
      { x: research.x + 10, y: research.y + 2 },
      { x: research.x + 16, y: research.y + 2 },
    ];

    for (const pos of deskPositions) {
      const gx = pos.x * T + T / 2 + 8; // offset toward monitor area
      const gy = pos.y * T + T / 2 - 4;

      const screenGlow = this.add.circle(gx, gy, 20, 0x4488CC, 0.04);
      screenGlow.setDepth(2);

      // Subtle flicker
      this.tweens.add({
        targets: screenGlow,
        alpha: { from: 0.04, to: 0.02 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
      });
    }

    // === Server rack LED glow (green/red) ===
    const serverPositions = [
      { x: code.x + 16, y: code.y + 3 },
      { x: code.x + 17, y: code.y + 6 },
      { x: research.x + 33, y: research.y + 3 },
    ];

    for (const pos of serverPositions) {
      const gx = pos.x * T + T / 2;
      const gy = pos.y * T + T / 2;

      const ledGlow = this.add.circle(gx, gy, 16, 0x40D060, 0.05);
      ledGlow.setDepth(2);

      // Blinking LED effect
      this.tweens.add({
        targets: ledGlow,
        alpha: { from: 0.05, to: 0.01 },
        duration: 1200 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      });
    }

    // === Doorway glow lights (navigation cues) ===
    const doorways = [
      // Horizontal wall y=7 doors
      { x: 9, y: 7 }, { x: 29, y: 7 },
      // Horizontal wall y=16 doors
      { x: 9, y: 16 }, { x: 19, y: 16 }, { x: 29, y: 16 },
      // Vertical wall x=19 door
      { x: 19, y: 12 },
      // Horizontal wall y=23 doors
      { x: 15, y: 23 }, { x: 25, y: 23 },
    ];

    for (const door of doorways) {
      const dx = door.x * T + T / 2;
      const dy = door.y * T + T / 2;

      // Warm doorway glow
      const doorGlow = this.add.circle(dx, dy, 24, 0xFFE8B0, 0.04);
      doorGlow.setDepth(2);

      // Subtle breathing
      this.tweens.add({
        targets: doorGlow,
        alpha: { from: 0.04, to: 0.02 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // === Coffee machine steam ambient ===
    const coffeeX = lobby.x + 32;
    const coffeeY = lobby.y + 3;
    const steamGlow = this.add.circle(
      coffeeX * T + T / 2, coffeeY * T + T / 2 - 8,
      12, 0xFFFFFF, 0.03
    );
    steamGlow.setDepth(2);
    this.tweens.add({
      targets: steamGlow,
      alpha: { from: 0.03, to: 0.0 },
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.5 },
      y: steamGlow.y - 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Start ambient floating dust/light particles for atmosphere */
  private startAmbientParticles() {
    this.ambientParticleTimer = this.time.addEvent({
      delay: 300,
      callback: () => {
        if (!this.alive) return;

        const cam = this.cameras.main;
        // Spawn within visible viewport
        const x = cam.scrollX + Phaser.Math.Between(0, Math.floor(cam.width / cam.zoom));
        const y = cam.scrollY + Phaser.Math.Between(0, Math.floor(cam.height / cam.zoom));

        const mote = this.add.circle(
          x, y,
          Phaser.Math.FloatBetween(0.5, 1.5),
          0xffffff,
          Phaser.Math.FloatBetween(0.08, 0.18)
        );
        mote.setDepth(2);

        this.tweens.add({
          targets: mote,
          x: x + Phaser.Math.Between(-30, 30),
          y: y - Phaser.Math.Between(20, 50),
          alpha: 0,
          duration: Phaser.Math.Between(3000, 6000),
          ease: 'Sine.easeInOut',
          onComplete: () => mote.destroy(),
        });
      },
      loop: true,
    });
  }

  /** Spawn the player-controlled character in the lobby */
  private spawnPlayer() {
    const T = TILE_SIZE;
    const lobby = ZONES.find(z => z.name === 'spawn')!;
    const px = (lobby.x + lobby.width / 2) * T;
    const py = (lobby.y + lobby.height / 2) * T;

    const textureKey = `char_${this.PLAYER_TYPE}`;

    // Highlight ring (distinguishes player from NPCs)
    const ring = this.add.graphics();
    ring.lineStyle(2, 0xffd700, 0.8);
    ring.strokeCircle(0, 14, 12);

    // Shadow
    const shadow = this.add.ellipse(0, 14, 22, 7, 0x000000, 0.3);

    // Character sprite — shifted up to look like sitting back in chair
    const sprite = this.add.sprite(0, -20, textureKey, 1);
    sprite.setScale(SpriteGenerator.SCALE);
    sprite.setOrigin(0.5, 0.5);
    this.playerSprite = sprite;

    // Name tag with "You" label
    const nameText = this.add.text(0, 10, 'You', {
      fontSize: '15px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5);

    const nameBg = this.add.graphics();
    const nw = nameText.width + 12;
    const nh = nameText.height + 4;
    nameBg.fillStyle(0x1a1a2e, 0.9);
    nameBg.fillRoundedRect(-nw / 2, 10 - nh / 2, nw, nh, 5);

    // Arrow indicator above head
    const arrow = this.add.text(0, -30, '▼', {
      fontSize: '10px',
      color: '#FFD700',
    });
    arrow.setOrigin(0.5);

    // Floating arrow animation
    this.tweens.add({
      targets: arrow,
      y: -26,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Container
    this.player = this.add.container(px, py, [ring, shadow, sprite, nameBg, nameText, arrow]);
    this.player.setDepth(15); // above NPCs (5) and simulation agents (10)

    // Spawn effect
    this.player.setScale(0);
    this.player.setAlpha(0);
    this.tweens.add({
      targets: this.player,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
    });
    this.createSparkles(px, py, 0xffd700);

    // Idle breathing animation (matches NPC idle)
    this.tweens.add({
      targets: sprite,
      y: -21,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setupCamera() {
    const worldWidth = MAP_WIDTH * TILE_SIZE;
    const worldHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(2);

    // Camera follows the player character smoothly with deadzone to prevent jitter
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(40, 30);

    // Mouse wheel zoom functionality removed to prevent zoom-in/out via scroll

    // Refit background on resize
    this.scale.on('resize', () => {
      if (this.alive) this.fitBackgroundToCamera();
    });
  }

  // Player chat bubble (reused for cleanup)
  private playerChatBubble: Phaser.GameObjects.Container | null = null;
  private playerChatTimer: Phaser.Time.TimerEvent | null = null;

  private setupEventListeners() {
    // Named handlers with alive guard (prevents access to destroyed game objects)
    const guard = () => this.alive;
    const handlers = {
      chat: (text: string) => { if (guard()) this.showPlayerChat(text); },
      spawn: (p: AgentSpawnPayload) => { if (guard()) this.spawnAgent(p); },
      move: (p: AgentMovePayload) => { if (guard()) this.moveAgent(p); },
      state: (p: AgentStatePayload) => { if (guard()) this.updateAgentState(p); },
      tool: (p: ToolUsePayload) => { if (guard()) this.showToolUse(p); },
      agentChat: (p: AgentChatPayload) => { if (guard()) this.showChat(p); },
      despawn: (p: AgentDespawnPayload) => { if (guard()) this.despawnAgent(p); },
      message: (p: MessageSendPayload) => { if (guard()) this.showMessageEnvelope(p); },
      meeting: (p: MeetingPhasePayload) => { if (guard()) this.handleMeetingPhase(p); },
      snapshot: (p: WorldSnapshotPayload) => {
        if (!guard()) return;
        for (const [, agent] of this.agents) {
          if (agent.chatBubble) agent.chatBubble.destroy();
          agent.container.destroy();
        }
        this.agents.clear();
        for (const a of p.agents) {
          this.spawnAgent({
            agentId: a.id, agentType: a.type, role: a.role,
            displayName: a.displayName, color: a.color,
            x: a.x, y: a.y, parentId: a.parentId, teamId: a.teamId,
          });
        }
      },
    };

    // Roster init handler — spawn persistent agents at home zones
    const rosterInit = (p: RosterInitPayload) => {
      if (!guard()) return;
      // Build lookup map: rosterId -> { seatX, seatY }
      const seatMap = new Map<string, { seatX: number; seatY: number }>();
      for (const ra of AGENT_ROSTER) {
        seatMap.set(ra.id, { seatX: ra.seatX, seatY: ra.seatY });
      }

      for (const ra of p.agents) {
        this.rosterAgentIds.add(ra.id);
        if (!this.agents.has(ra.id)) {
          // Use seat coordinates from AGENT_ROSTER for precise chair placement
          const rosterIdClean = fromRosterId(ra.id);
          const seat = seatMap.get(rosterIdClean);
          const x = seat ? seat.seatX * TILE_SIZE + TILE_SIZE / 2 : 500;
          const y = seat ? seat.seatY * TILE_SIZE + TILE_SIZE / 2 : 400;
          this.spawnAgent({
            agentId: ra.id,
            agentType: ra.agentType,
            role: ra.role,
            displayName: `${ra.name}\n${ra.role}`,
            color: ra.color,
            x, y,
          });
          // Roster agents always fully visible
          const agent = this.agents.get(ra.id);
          if (agent) {
            agent.container.setAlpha(1.0);
          }
        }
      }
    };

    EventBus.on('player:chat', handlers.chat);
    EventBus.on('ws:agent:spawn', handlers.spawn);
    EventBus.on('ws:agent:move', handlers.move);
    EventBus.on('ws:agent:state', handlers.state);
    EventBus.on('ws:agent:tool', handlers.tool);
    EventBus.on('ws:agent:chat', handlers.agentChat);
    EventBus.on('ws:agent:despawn', handlers.despawn);
    EventBus.on('ws:message:send', handlers.message);
    EventBus.on('ws:world:snapshot', handlers.snapshot);
    EventBus.on('ws:meeting:phase', handlers.meeting);
    EventBus.on('ws:roster:init', rosterInit);

    // Clean up EventBus listeners on scene shutdown (React StrictMode double-mount)
    this.events.on('shutdown', () => {
      EventBus.off('player:chat', handlers.chat);
      EventBus.off('ws:agent:spawn', handlers.spawn);
      EventBus.off('ws:agent:move', handlers.move);
      EventBus.off('ws:agent:state', handlers.state);
      EventBus.off('ws:agent:tool', handlers.tool);
      EventBus.off('ws:agent:chat', handlers.agentChat);
      EventBus.off('ws:agent:despawn', handlers.despawn);
      EventBus.off('ws:message:send', handlers.message);
      EventBus.off('ws:world:snapshot', handlers.snapshot);
      EventBus.off('ws:meeting:phase', handlers.meeting);
      EventBus.off('ws:roster:init', rosterInit);
    });
  }

  private spawnAgent(payload: AgentSpawnPayload) {
    if (this.agents.has(payload.agentId)) return;

    const textureKey = `char_${payload.agentType}`;
    const hasTexture = this.textures.exists(textureKey);

    // Colored glow ring (agent identity)
    const agentColorNum = parseInt((payload.color || '#4A90D9').replace('#', '0x'));
    const ringColor = isNaN(agentColorNum) ? 0x4A90D9 : agentColorNum;
    const ring = this.add.graphics();
    ring.lineStyle(1.5, ringColor, 0.6);
    ring.strokeCircle(0, 14, 11);

    // Shadow
    const shadow = this.add.ellipse(0, 14, 20, 6, 0x000000, 0.25);

    // Character sprite — shifted up to look like sitting back in chair
    const sprite = hasTexture
      ? this.add.sprite(0, -20, textureKey, 1)
      : this.add.sprite(0, -20, `char_single`, 1);
    sprite.setScale(SpriteGenerator.SCALE);
    sprite.setOrigin(0.5, 0.5);

    // Play idle animation
    const idleAnim = `${payload.agentType}_idle`;
    if (this.anims.exists(idleAnim)) {
      sprite.play(idleAnim);
    }

    // Name tag (Gather Town style: dark rounded badge)
    const nameText = this.add.text(0, 8, payload.displayName, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      padding: { x: 0, y: 0 },
    });
    nameText.setOrigin(0.5);

    const nameBg = this.add.graphics();
    const nw = nameText.width + 12;
    const nh = nameText.height + 4;
    nameBg.fillStyle(0x1a1a2e, 0.85);
    nameBg.fillRoundedRect(-nw / 2, 8 - nh / 2, nw, nh, 5);

    // Status icon (shown above head during states)
    const stateIcon = this.add.text(0, -28, '', {
      fontSize: '16px',
      color: '#ffffff',
    });
    stateIcon.setOrigin(0.5);

    // Container
    const container = this.add.container(payload.x, payload.y, [
      ring, shadow, sprite, nameBg, nameText, stateIcon
    ]);
    container.setDepth(10);

    // Spawn animation
    container.setScale(0);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
    this.createSparkles(payload.x, payload.y, ringColor);
    this.createSpawnRing(payload.x, payload.y, ringColor);

    // Idle breathing animation
    this.tweens.add({
      targets: sprite,
      y: -21,
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const agentObj: AgentGameObject = {
      container, sprite, nameBg, nameText, stateIcon, shadow,
      chatBubble: null, chatTimer: null, moveTween: null,
      data: payload,
    };

    this.agents.set(payload.agentId, agentObj);
  }

  private moveAgent(payload: AgentMovePayload) {
    const agent = this.agents.get(payload.agentId);
    if (!agent) return;

    // Determine direction for animation
    const dx = payload.targetX - agent.container.x;
    const dy = payload.targetY - agent.container.y;
    let dir = 'down';
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    // Play walking animation
    const walkAnim = `${agent.data.agentType}_walk_${dir}`;
    if (this.anims.exists(walkAnim)) {
      agent.sprite.play(walkAnim, true);
    }

    // Stop previous move tween
    if (agent.moveTween) agent.moveTween.stop();

    const distance = Phaser.Math.Distance.Between(
      agent.container.x, agent.container.y,
      payload.targetX, payload.targetY
    );
    const duration = Math.max(300, distance * 2);

    agent.moveTween = this.tweens.add({
      targets: agent.container,
      x: payload.targetX,
      y: payload.targetY,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Return to idle
        const idleAnim = `${agent.data.agentType}_idle`;
        if (this.anims.exists(idleAnim)) {
          agent.sprite.play(idleAnim);
        }
        agent.moveTween = null;
      },
    });
  }

  private updateAgentState(payload: AgentStatePayload) {
    const agent = this.agents.get(payload.agentId);
    if (!agent) return;

    // Roster agent alpha: always full regardless of state
    if (this.rosterAgentIds.has(payload.agentId)) {
      const targetAlpha = 1.0;
      this.tweens.add({
        targets: agent.container,
        alpha: targetAlpha,
        duration: 300,
        ease: 'Sine.easeOut',
      });
    }

    // State-change visual ring pulse
    const stateColors: Record<string, number> = {
      thinking: 0x9B59B6,   // purple
      acting: 0x3498DB,     // blue
      completed: 0x2ECC71,  // green
      failed: 0xE74C3C,     // red
    };
    const ringColor = stateColors[payload.state];
    if (ringColor) {
      this.createSpawnRing(agent.container.x, agent.container.y, ringColor);
    }

    switch (payload.state) {
      case 'thinking':
        agent.stateIcon.setText('💭');
        this.tweens.add({
          targets: agent.stateIcon,
          y: -32, alpha: 1,
          duration: 300,
          yoyo: true,
          repeat: 2,
          hold: 300,
        });
        break;
      case 'acting':
        agent.stateIcon.setText('⚡');
        // Glow effect
        this.tweens.add({
          targets: agent.sprite,
          alpha: 0.7,
          duration: 200,
          yoyo: true,
          repeat: 3,
        });
        break;
      case 'communicating':
        agent.stateIcon.setText('💬');
        break;
      case 'completed':
        agent.stateIcon.setText('✅');
        this.createSparkles(agent.container.x, agent.container.y, 0x2ecc71);
        this.cameras.main.flash(200, 46, 204, 113, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) { /* flash complete */ }
        });
        break;
      case 'idle': {
        agent.stateIcon.setText('');
        // Play idle anim
        const idleAnim = `${agent.data.agentType}_idle`;
        if (this.anims.exists(idleAnim)) {
          agent.sprite.play(idleAnim);
        }
        break;
      }
      case 'failed':
        agent.stateIcon.setText('❌');
        break;
      case 'gathering':
        agent.stateIcon.setText('📍');
        this.createSpawnRing(agent.container.x, agent.container.y, 0x9B59B6);
        break;
      case 'discussing':
        agent.stateIcon.setText('💬');
        this.tweens.add({
          targets: agent.stateIcon,
          y: -32, alpha: 1,
          duration: 400,
          yoyo: true,
          repeat: 1,
          hold: 500,
        });
        break;
    }
  }

  private handleMeetingPhase(payload: MeetingPhasePayload) {
    const zone = ZONES.find(z => z.name === payload.zone);
    if (!zone) return;

    const x = zone.x * TILE_SIZE;
    const y = zone.y * TILE_SIZE;
    const w = zone.width * TILE_SIZE;
    const h = zone.height * TILE_SIZE;

    switch (payload.phase) {
      case 'gather': {
        // Create purple overlay on planning zone
        if (this.meetingOverlay) this.meetingOverlay.destroy();
        if (this.meetingLabel) this.meetingLabel.destroy();
        if (this.meetingTween) this.meetingTween.destroy();

        this.meetingOverlay = this.add.rectangle(
          x + w / 2, y + h / 2, w, h, 0x9B59B6, 0.15
        ).setDepth(5);

        this.meetingTween = this.tweens.add({
          targets: this.meetingOverlay,
          alpha: { from: 0.1, to: 0.25 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      }
      case 'discuss': {
        // Strengthen glow, add label
        if (this.meetingOverlay) {
          this.meetingOverlay.setFillStyle(0x9B59B6, 0.25);
        }
        this.meetingLabel = this.add.text(
          x + w / 2, y - 10,
          '💬 Meeting',
          { fontSize: '14px', color: '#E91E63', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(10);

        this.tweens.add({
          targets: this.meetingLabel,
          y: y - 14,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      }
      case 'disperse': {
        // Fade out overlay and label
        if (this.meetingOverlay) {
          this.tweens.add({
            targets: this.meetingOverlay,
            alpha: 0,
            duration: 500,
            onComplete: () => {
              this.meetingOverlay?.destroy();
              this.meetingOverlay = null;
            },
          });
        }
        if (this.meetingTween) {
          this.meetingTween.destroy();
          this.meetingTween = null;
        }
        if (this.meetingLabel) {
          this.tweens.add({
            targets: this.meetingLabel,
            alpha: 0,
            duration: 400,
            onComplete: () => {
              this.meetingLabel?.destroy();
              this.meetingLabel = null;
            },
          });
        }
        break;
      }
    }
  }

  private showToolUse(payload: ToolUsePayload) {
    const agent = this.agents.get(payload.agentId);
    if (!agent) return;

    const toolIcons: Record<string, string> = {
      Read: '📖', Edit: '✏️', Write: '📝', Bash: '💻',
      Grep: '🔍', Glob: '📂', WebSearch: '🌐', WebFetch: '📡',
      Task: '✨', SendMessage: '📨',
      TaskCreate: '📋', TaskUpdate: '✅', TeamCreate: '👥',
    };

    const icon = toolIcons[payload.tool] || '🔧';
    const toolText = this.add.text(
      agent.container.x,
      agent.container.y - 40,
      `${icon} ${payload.tool}`,
      {
        fontSize: '11px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        backgroundColor: '#1a1a2eDD',
        padding: { x: 6, y: 3 },
      }
    );
    toolText.setOrigin(0.5);
    toolText.setDepth(25);

    // Pop-in scale pulse then float up and fade
    toolText.setScale(1.4);
    this.tweens.add({
      targets: toolText,
      scaleX: 1, scaleY: 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: toolText,
          y: toolText.y - 25,
          alpha: 0,
          duration: payload.duration || 1500,
          ease: 'Power2',
          onComplete: () => toolText.destroy(),
        });
      },
    });
  }

  private showPlayerChat(text: string) {
    // Clean up previous bubble
    if (this.playerChatBubble) {
      this.playerChatBubble.destroy();
      this.playerChatBubble = null;
    }
    if (this.playerChatTimer) {
      this.playerChatTimer.destroy();
      this.playerChatTimer = null;
    }

    const dom = this.createDomBubble(text, '#f9a825');
    // Override style for player (yellow tint)
    (dom.node as HTMLElement).style.background = 'rgba(255,249,196,0.97)';
    dom.setPosition(this.player.x, this.player.y - 55);
    dom.setDepth(35);
    dom.setAlpha(0);

    const bubble = this.add.container(0, 0, [dom]);
    bubble.setDepth(35);

    this.tweens.add({
      targets: dom,
      alpha: 1,
      y: dom.y - 5,
      duration: 150,
    });

    this.playerChatBubble = bubble;

    this.playerChatTimer = this.time.delayedCall(3000, () => {
      if (this.playerChatBubble && this.playerChatBubble.list.length > 0) {
        const fadeDom = this.playerChatBubble.list[0] as Phaser.GameObjects.DOMElement;
        this.tweens.add({
          targets: fadeDom,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.playerChatBubble?.destroy();
            this.playerChatBubble = null;
          },
        });
      }
    });
  }

  /** Clamp bubble X so it doesn't go off-screen left/right */
  private clampBubbleX(worldX: number): number {
    const cam = this.cameras.main;
    const bubbleHalfWidth = 150; // ~half of max bubble width (280/2 + margin)
    const leftEdge = cam.scrollX + bubbleHalfWidth / cam.zoom;
    const rightEdge = cam.scrollX + cam.width / cam.zoom - bubbleHalfWidth / cam.zoom;
    return Phaser.Math.Clamp(worldX, leftEdge, rightEdge);
  }

  /** Create an HTML DOM chat bubble — renders with native browser text quality */
  private createDomBubble(text: string, borderColor: string): Phaser.GameObjects.DOMElement {
    const el = document.createElement('div');
    el.style.cssText = `
      max-width: 280px;
      padding: 10px 14px;
      background: rgba(255,255,255,0.97);
      border: 2px solid ${borderColor};
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      letter-spacing: 0.2px;
      color: #1a1a1a;
      word-break: keep-all;
      pointer-events: none;
      transform-origin: center bottom;
    `;
    el.textContent = text;
    const dom = this.add.dom(0, 0, el);
    dom.setOrigin(0.5, 1);
    return dom;
  }

  private showChat(payload: AgentChatPayload) {
    const agent = this.agents.get(payload.agentId);
    if (!agent) return;

    if (agent.chatBubble) {
      agent.chatBubble.destroy();
      agent.chatBubble = null;
    }
    if (agent.chatTimer) {
      agent.chatTimer.destroy();
      agent.chatTimer = null;
    }

    const agentColor = agent.data.color || '#4A90D9';
    const dom = this.createDomBubble(payload.text, agentColor);
    const bubbleX = this.clampBubbleX(agent.container.x);
    dom.setPosition(bubbleX, agent.container.y - 50);
    dom.setDepth(30);
    dom.setAlpha(0);

    // Wrap in container for consistent lifecycle management
    const bubble = this.add.container(0, 0, [dom]);
    bubble.setDepth(30);

    this.tweens.add({
      targets: dom,
      alpha: 1,
      y: dom.y - 5,
      duration: 150,
    });

    agent.chatBubble = bubble;

    // Minimum 3s, scale with text length (~80ms per char), respect server-sent duration
    const textLen = payload.text?.length || 0;
    const autoDuration = Math.max(3000, Math.min(12000, textLen * 80));
    const finalDuration = Math.max(payload.duration || autoDuration, autoDuration);

    agent.chatTimer = this.time.delayedCall(finalDuration, () => {
      if (agent.chatBubble) {
        this.tweens.add({
          targets: dom,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            agent.chatBubble?.destroy();
            agent.chatBubble = null;
          },
        });
      }
    });
  }

  private despawnAgent(payload: AgentDespawnPayload) {
    const agent = this.agents.get(payload.agentId);
    if (!agent) return;

    // Roster agents never despawn — stay fully visible
    if (this.rosterAgentIds.has(payload.agentId)) {
      if (agent.chatTimer) {
        agent.chatTimer.destroy();
        agent.chatTimer = null;
      }
      if (agent.chatBubble) {
        agent.chatBubble.destroy();
        agent.chatBubble = null;
      }
      agent.container.setAlpha(1.0);
      return;
    }

    // Cancel any active chat timer to prevent dangling callbacks
    if (agent.chatTimer) {
      agent.chatTimer.destroy();
      agent.chatTimer = null;
    }

    // Flash bright before disappearing
    this.tweens.add({
      targets: agent.sprite,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 2,
    });

    // Delayed shrink + sparkle burst
    this.time.delayedCall(300, () => {
      if (!this.agents.has(payload.agentId)) return; // already removed
      const colorNum = parseInt((agent.data.color || '#ffffff').replace('#', '0x'));
      this.createSparkles(agent.container.x, agent.container.y, isNaN(colorNum) ? 0xffffff : colorNum);

      this.tweens.add({
        targets: agent.container,
        scaleX: 0, scaleY: 0, alpha: 0,
        y: agent.container.y - 15,
        duration: 350,
        ease: 'Back.easeIn',
        onComplete: () => {
          if (agent.chatBubble) agent.chatBubble.destroy();
          agent.container.destroy();
          this.agents.delete(payload.agentId);
        },
      });
    });
  }

  private showMessageEnvelope(payload: MessageSendPayload) {
    const from = this.agents.get(payload.fromId);
    const to = this.agents.get(payload.toId);
    if (!from || !to) return;

    const envelope = this.add.text(
      from.container.x, from.container.y - 20,
      '📧', { fontSize: '18px' }
    );
    envelope.setOrigin(0.5);
    envelope.setDepth(25);

    this.tweens.add({
      targets: envelope,
      x: to.container.x,
      y: to.container.y - 20,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: envelope,
          alpha: 0, scaleX: 1.5, scaleY: 1.5,
          duration: 200,
          onComplete: () => envelope.destroy(),
        });
      },
    });
  }

  private createSparkles(x: number, y: number, color = 0xffd700) {
    for (let i = 0; i < 8; i++) {
      const px = x + Phaser.Math.Between(-15, 15);
      const py = y + Phaser.Math.Between(-15, 5);
      const size = Phaser.Math.Between(2, 4);
      const particle = this.add.circle(px, py, size, color, 0.8);
      particle.setDepth(20);

      this.tweens.add({
        targets: particle,
        x: px + Phaser.Math.Between(-25, 25),
        y: py + Phaser.Math.Between(-35, -10),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(400, 700),
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private createSpawnRing(x: number, y: number, color: number) {
    const ring = this.add.graphics();
    ring.lineStyle(2, color, 0.8);
    ring.strokeCircle(0, 0, 5);
    ring.setPosition(x, y);
    ring.setDepth(9);

    this.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  private createDustParticle(x: number, y: number) {
    const count = Phaser.Math.Between(1, 3);
    for (let i = 0; i < count; i++) {
      const px = x + Phaser.Math.Between(-6, 6);
      const py = y + Phaser.Math.Between(-2, 2);
      const size = Phaser.Math.Between(1, 2);
      const dust = this.add.circle(px, py, size, 0xccbbaa, 0.4);
      dust.setDepth(4);

      this.tweens.add({
        targets: dust,
        x: px + Phaser.Math.Between(-8, 8),
        y: py + Phaser.Math.Between(-10, -3),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(250, 450),
        ease: 'Power1',
        onComplete: () => dust.destroy(),
      });
    }
  }

  update(_time: number, delta: number) {
    if (!this.alive) return;

    // === Player movement (arrow keys + WASD) ===
    const dt = delta / 1000;
    let vx = 0;
    let vy = 0;

    // Skip movement if user is typing in an input field (for WASD only)
    const inputFocused = document.activeElement instanceof HTMLInputElement
      || document.activeElement instanceof HTMLTextAreaElement;

    // Arrow keys always work; WASD only when not typing
    const left = this.keysDown.has('ArrowLeft') || (!inputFocused && this.keysDown.has('KeyA'));
    const right = this.keysDown.has('ArrowRight') || (!inputFocused && this.keysDown.has('KeyD'));
    const up = this.keysDown.has('ArrowUp') || (!inputFocused && this.keysDown.has('KeyW'));
    const down = this.keysDown.has('ArrowDown') || (!inputFocused && this.keysDown.has('KeyS'));

    if (left) vx = -this.PLAYER_SPEED;
    else if (right) vx = this.PLAYER_SPEED;
    if (up) vy = -this.PLAYER_SPEED;
    else if (down) vy = this.PLAYER_SPEED;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }

    if (vx !== 0 || vy !== 0) {
      // Free movement (no collision) — clamp to world bounds
      const worldW = MAP_WIDTH * TILE_SIZE;
      const worldH = MAP_HEIGHT * TILE_SIZE;
      const margin = 16;
      this.player.x = Phaser.Math.Clamp(this.player.x + vx * dt, margin, worldW - margin);
      this.player.y = Phaser.Math.Clamp(this.player.y + vy * dt, margin, worldH - margin);

      // Determine animation direction
      let dir: string;
      if (Math.abs(vx) > Math.abs(vy)) {
        dir = vx > 0 ? 'right' : 'left';
      } else {
        dir = vy > 0 ? 'down' : 'up';
      }

      // Play walking animation if direction changed or just started moving
      if (dir !== this.playerDir || !this.playerMoving) {
        this.playerDir = dir;
        this.playerMoving = true;
        const animKey = `${this.PLAYER_TYPE}_walk_${dir}`;
        if (this.anims.exists(animKey)) {
          this.playerSprite.play(animKey, true);
        }
      }
      // Walking dust particles
      this.dustCooldown -= delta;
      if (this.dustCooldown <= 0) {
        this.dustCooldown = 180; // emit every 180ms
        this.createDustParticle(this.player.x, this.player.y + 16);
      }
    } else if (this.playerMoving) {
      // Stopped moving — show idle frame for last direction
      this.playerMoving = false;
      this.dustCooldown = 0;
      const dirFrameMap: Record<string, number> = { down: 1, left: 4, right: 7, up: 10 };
      this.playerSprite.stop();
      this.playerSprite.setFrame(dirFrameMap[this.playerDir] ?? 1);
    }

    // === Emit player position (only when changed, avoids 60fps overhead) ===
    if (this.player.x !== this.lastEmittedX || this.player.y !== this.lastEmittedY) {
      this.lastEmittedX = this.player.x;
      this.lastEmittedY = this.player.y;
      EventBus.emit('player:position', { x: this.player.x, y: this.player.y });
    }

    // === Update player chat bubble position ===
    if (this.playerChatBubble && this.playerChatBubble.list.length > 0) {
      const dom = this.playerChatBubble.list[0] as Phaser.GameObjects.DOMElement;
      dom.setPosition(this.player.x, this.player.y - 55);
    }

    // === Player depth (only update when Y changes) ===
    const playerDepth = 15 + this.player.y * 0.001;
    if (this.player.depth !== playerDepth) this.player.setDepth(playerDepth);

    // === Agent updates: depth sorting + proximity highlight + chat bubble position ===
    const PROXIMITY_DIST = 80;
    for (const [, agent] of this.agents) {
      // Y-depth sorting (only when depth changes)
      const newDepth = 10 + agent.container.y * 0.001;
      if (agent.container.depth !== newDepth) agent.container.setDepth(newDepth);

      // Proximity highlight
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        agent.container.x, agent.container.y
      );
      if (dist < PROXIMITY_DIST) {
        const t = 1 - (dist / PROXIMITY_DIST);
        agent.nameText.setAlpha(0.7 + t * 0.3);
        agent.nameBg.setAlpha(0.7 + t * 0.3);
      } else {
        agent.nameText.setAlpha(0.7);
        agent.nameBg.setAlpha(0.7);
      }

      // Chat bubble position — update DOM element directly, clamped to viewport
      if (agent.chatBubble && agent.chatBubble.list.length > 0) {
        const dom = agent.chatBubble.list[0] as Phaser.GameObjects.DOMElement;
        dom.setPosition(this.clampBubbleX(agent.container.x), agent.container.y - 50);
      }
    }
  }
}
