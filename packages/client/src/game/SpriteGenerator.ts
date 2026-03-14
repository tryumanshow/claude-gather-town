import Phaser from 'phaser';

interface CharacterConfig {
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  hairStyle: 'short' | 'long' | 'spiky' | 'bald';
}

// Preset configs for each agent type
const AGENT_CONFIGS: Record<string, CharacterConfig> = {
  orchestrator: { skinColor: '#FFDBB4', hairColor: '#FFD700', shirtColor: '#FFD700', pantsColor: '#2C3E50', hairStyle: 'short' },
  executor:     { skinColor: '#FFDBB4', hairColor: '#4A3728', shirtColor: '#4A90D9', pantsColor: '#2C3E50', hairStyle: 'short' },
  explorer:     { skinColor: '#E8B88A', hairColor: '#2ECC71', shirtColor: '#2ECC71', pantsColor: '#34495E', hairStyle: 'spiky' },
  planner:      { skinColor: '#FFDBB4', hairColor: '#9B59B6', shirtColor: '#9B59B6', pantsColor: '#2C3E50', hairStyle: 'long' },
  architect:    { skinColor: '#D4A574', hairColor: '#1A1A2E', shirtColor: '#2C3E50', pantsColor: '#1A1A2E', hairStyle: 'short' },
  reviewer:     { skinColor: '#FFDBB4', hairColor: '#E67E22', shirtColor: '#E67E22', pantsColor: '#2C3E50', hairStyle: 'short' },
  debugger:     { skinColor: '#E8B88A', hairColor: '#E74C3C', shirtColor: '#E74C3C', pantsColor: '#34495E', hairStyle: 'spiky' },
  writer:       { skinColor: '#FFDBB4', hairColor: '#00BCD4', shirtColor: '#00BCD4', pantsColor: '#2C3E50', hairStyle: 'long' },
  single:       { skinColor: '#FFDBB4', hairColor: '#BDC3C7', shirtColor: '#95A5A6', pantsColor: '#2C3E50', hairStyle: 'short' },
  'build-fixer': { skinColor: '#D4A574', hairColor: '#F39C12', shirtColor: '#F39C12', pantsColor: '#2C3E50', hairStyle: 'short' },
  'test-engineer': { skinColor: '#FFDBB4', hairColor: '#1ABC9C', shirtColor: '#1ABC9C', pantsColor: '#34495E', hairStyle: 'spiky' },
  designer:     { skinColor: '#E8B88A', hairColor: '#E91E63', shirtColor: '#E91E63', pantsColor: '#2C3E50', hairStyle: 'long' },
  'security-reviewer': { skinColor: '#D4A574', hairColor: '#FF5722', shirtColor: '#FF5722', pantsColor: '#1A1A2E', hairStyle: 'short' },
  scientist:    { skinColor: '#FFDBB4', hairColor: '#673AB7', shirtColor: '#673AB7', pantsColor: '#2C3E50', hairStyle: 'long' },
  'document-specialist': { skinColor: '#E8B88A', hairColor: '#795548', shirtColor: '#795548', pantsColor: '#34495E', hairStyle: 'short' },
  'code-reviewer':     { skinColor: '#FFDBB4', hairColor: '#D35400', shirtColor: '#D35400', pantsColor: '#2C3E50', hairStyle: 'short' },
  'quality-reviewer':  { skinColor: '#D4A574', hairColor: '#16A085', shirtColor: '#16A085', pantsColor: '#1A1A2E', hairStyle: 'short' },
  'qa-tester':         { skinColor: '#E8B88A', hairColor: '#27AE60', shirtColor: '#27AE60', pantsColor: '#34495E', hairStyle: 'spiky' },
  'git-master':        { skinColor: '#FFDBB4', hairColor: '#8E44AD', shirtColor: '#8E44AD', pantsColor: '#2C3E50', hairStyle: 'short' },
  'code-simplifier':   { skinColor: '#D4A574', hairColor: '#2980B9', shirtColor: '#2980B9', pantsColor: '#1A1A2E', hairStyle: 'long' },
  critic:              { skinColor: '#FFDBB4', hairColor: '#C0392B', shirtColor: '#C0392B', pantsColor: '#2C3E50', hairStyle: 'short' },
  analyst:             { skinColor: '#E8B88A', hairColor: '#2C3E50', shirtColor: '#34495E', pantsColor: '#1A1A2E', hairStyle: 'long' },
  verifier:            { skinColor: '#FFDBB4', hairColor: '#0097A7', shirtColor: '#0097A7', pantsColor: '#2C3E50', hairStyle: 'spiky' },
  'deep-executor':     { skinColor: '#D4A574', hairColor: '#1565C0', shirtColor: '#1565C0', pantsColor: '#1A1A2E', hairStyle: 'short' },
};

export class SpriteGenerator {
  // Character is 16x24 pixels, rendered at SCALE (2x = 32x48 on screen)
  static readonly CHAR_W = 16;
  static readonly CHAR_H = 24;
  static readonly SCALE = 2;
  static readonly FRAME_W = 16;
  static readonly FRAME_H = 24;
  // Spritesheet: 3 frames per direction, 4 directions = 12 frames
  // Layout: row 0=down, row 1=left, row 2=right, row 3=up
  static readonly FRAMES_PER_DIR = 3;
  static readonly DIRECTIONS = 4;

  static generateAllSprites(scene: Phaser.Scene): void {
    for (const [agentType, config] of Object.entries(AGENT_CONFIGS)) {
      const key = `char_${agentType}`;
      if (scene.textures.exists(key)) continue;

      const sheetW = this.FRAME_W * this.FRAMES_PER_DIR;
      const sheetH = this.FRAME_H * this.DIRECTIONS;

      // Use Phaser's native createCanvas — synchronous, no async image loading!
      const canvasTex = scene.textures.createCanvas(key, sheetW, sheetH)!;
      const ctx = canvasTex.context;
      ctx.imageSmoothingEnabled = false;

      // Draw 4 directions x 3 frames
      const dirs = ['down', 'left', 'right', 'up'] as const;
      for (let dirIdx = 0; dirIdx < dirs.length; dirIdx++) {
        for (let frame = 0; frame < this.FRAMES_PER_DIR; frame++) {
          const x = frame * this.FRAME_W;
          const y = dirIdx * this.FRAME_H;
          this.drawCharacter(ctx, x, y, config, dirs[dirIdx], frame);
        }
      }

      // Sync canvas to GPU texture
      canvasTex.refresh();
      // Keep crispy pixel art on sprites (text gets LINEAR by default now)
      canvasTex.setFilter(Phaser.Textures.FilterMode.NEAREST);

      // Add frame data for spritesheet usage
      for (let dirIdx = 0; dirIdx < this.DIRECTIONS; dirIdx++) {
        for (let frame = 0; frame < this.FRAMES_PER_DIR; frame++) {
          const frameIndex = dirIdx * this.FRAMES_PER_DIR + frame;
          canvasTex.add(
            frameIndex, 0,
            frame * this.FRAME_W,
            dirIdx * this.FRAME_H,
            this.FRAME_W,
            this.FRAME_H
          );
        }
      }
    }
  }

  static createAnimations(scene: Phaser.Scene): void {
    const dirs = ['down', 'left', 'right', 'up'];

    for (const agentType of Object.keys(AGENT_CONFIGS)) {
      const key = `char_${agentType}`;

      for (let dirIdx = 0; dirIdx < dirs.length; dirIdx++) {
        const animKey = `${agentType}_walk_${dirs[dirIdx]}`;
        if (scene.anims.exists(animKey)) continue;

        scene.anims.create({
          key: animKey,
          frames: scene.anims.generateFrameNumbers(key, {
            start: dirIdx * this.FRAMES_PER_DIR,
            end: dirIdx * this.FRAMES_PER_DIR + this.FRAMES_PER_DIR - 1,
          }),
          frameRate: 6,
          repeat: -1,
        });
      }

      // Idle animation (just frame 1 of down direction - standing)
      const idleKey = `${agentType}_idle`;
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: [{ key, frame: 1 }], // center frame of "down" row
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }

  private static drawCharacter(
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number,
    config: CharacterConfig,
    direction: 'down' | 'left' | 'right' | 'up',
    frame: number
  ): void {
    const { skinColor, hairColor, shirtColor, pantsColor, hairStyle } = config;

    // Walking bob offset
    const bobY = frame === 1 ? 0 : -1;
    // Leg animation
    const legFrame = frame; // 0=left forward, 1=standing, 2=right forward

    // Shadow (ellipse under feet)
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(ox + 8, oy + 23, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // === LEGS ===
    ctx.fillStyle = pantsColor;
    if (legFrame === 0) {
      // Left leg forward
      ctx.fillRect(ox + 5, oy + 18 + bobY, 3, 5);
      ctx.fillRect(ox + 9, oy + 17 + bobY, 3, 5);
    } else if (legFrame === 1) {
      // Standing
      ctx.fillRect(ox + 5, oy + 17 + bobY, 3, 5);
      ctx.fillRect(ox + 9, oy + 17 + bobY, 3, 5);
    } else {
      // Right leg forward
      ctx.fillRect(ox + 5, oy + 17 + bobY, 3, 5);
      ctx.fillRect(ox + 9, oy + 18 + bobY, 3, 5);
    }

    // Shoes
    ctx.fillStyle = '#2C2C2C';
    if (legFrame === 0) {
      ctx.fillRect(ox + 5, oy + 22 + bobY, 3, 1);
      ctx.fillRect(ox + 9, oy + 21 + bobY, 3, 1);
    } else if (legFrame === 1) {
      ctx.fillRect(ox + 5, oy + 21 + bobY, 3, 1);
      ctx.fillRect(ox + 9, oy + 21 + bobY, 3, 1);
    } else {
      ctx.fillRect(ox + 5, oy + 21 + bobY, 3, 1);
      ctx.fillRect(ox + 9, oy + 22 + bobY, 3, 1);
    }

    // === BODY (shirt) ===
    ctx.fillStyle = shirtColor;
    ctx.fillRect(ox + 4, oy + 10 + bobY, 9, 8);

    // Arms - slight animation with walking
    if (direction === 'left') {
      // Left-facing: body shifted, one arm visible
      ctx.fillRect(ox + 3, oy + 11 + bobY, 2, 5);
    } else if (direction === 'right') {
      ctx.fillRect(ox + 12, oy + 11 + bobY, 2, 5);
    } else {
      // Front/back: both arms
      ctx.fillRect(ox + 2, oy + 11 + bobY, 2, 5);
      ctx.fillRect(ox + 13, oy + 11 + bobY, 2, 5);
    }

    // Skin for arms (hands)
    ctx.fillStyle = skinColor;
    if (direction === 'left') {
      ctx.fillRect(ox + 3, oy + 15 + bobY, 2, 2);
    } else if (direction === 'right') {
      ctx.fillRect(ox + 12, oy + 15 + bobY, 2, 2);
    } else {
      ctx.fillRect(ox + 2, oy + 15 + bobY, 2, 2);
      ctx.fillRect(ox + 13, oy + 15 + bobY, 2, 2);
    }

    // === HEAD ===
    ctx.fillStyle = skinColor;
    ctx.fillRect(ox + 4, oy + 3 + bobY, 9, 8);

    // === FACE ===
    if (direction === 'down' || direction === 'left' || direction === 'right') {
      // Eyes
      ctx.fillStyle = '#1A1A2E';
      if (direction === 'down') {
        ctx.fillRect(ox + 6, oy + 6 + bobY, 2, 2);
        ctx.fillRect(ox + 10, oy + 6 + bobY, 2, 2);
        // Eye whites
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ox + 6, oy + 6 + bobY, 1, 1);
        ctx.fillRect(ox + 10, oy + 6 + bobY, 1, 1);
      } else if (direction === 'left') {
        ctx.fillRect(ox + 5, oy + 6 + bobY, 2, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ox + 5, oy + 6 + bobY, 1, 1);
      } else {
        ctx.fillRect(ox + 10, oy + 6 + bobY, 2, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ox + 11, oy + 6 + bobY, 1, 1);
      }
    }

    // === HAIR ===
    ctx.fillStyle = hairColor;
    switch (hairStyle) {
      case 'short':
        ctx.fillRect(ox + 3, oy + 2 + bobY, 11, 3);
        ctx.fillRect(ox + 4, oy + 1 + bobY, 9, 2);
        if (direction === 'left' || direction === 'up') {
          ctx.fillRect(ox + 3, oy + 3 + bobY, 2, 5);
        }
        if (direction === 'right' || direction === 'up') {
          ctx.fillRect(ox + 12, oy + 3 + bobY, 2, 5);
        }
        break;
      case 'long':
        ctx.fillRect(ox + 3, oy + 1 + bobY, 11, 4);
        ctx.fillRect(ox + 3, oy + 5 + bobY, 2, 8);
        ctx.fillRect(ox + 12, oy + 5 + bobY, 2, 8);
        if (direction === 'up') {
          ctx.fillRect(ox + 3, oy + 3 + bobY, 11, 8);
        }
        break;
      case 'spiky':
        ctx.fillRect(ox + 3, oy + 2 + bobY, 11, 3);
        ctx.fillRect(ox + 5, oy + 0 + bobY, 2, 2);
        ctx.fillRect(ox + 8, oy + 0 + bobY, 2, 1);
        ctx.fillRect(ox + 11, oy + 0 + bobY, 2, 2);
        break;
      case 'bald':
        ctx.fillRect(ox + 4, oy + 2 + bobY, 9, 2);
        break;
    }
  }

  static getConfig(agentType: string): CharacterConfig {
    return AGENT_CONFIGS[agentType] || AGENT_CONFIGS['single'];
  }
}
