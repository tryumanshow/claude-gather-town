import Phaser from 'phaser';

export class TileGenerator {
  static readonly TILE = 32;

  static generateTileset(scene: Phaser.Scene): void {
    if (scene.textures.exists('tiles_sheet')) return;

    const cols = 8;
    const rows = 8;
    const width = cols * this.TILE;
    const height = rows * this.TILE;

    const canvasTex = scene.textures.createCanvas('tiles_sheet', width, height)!;
    const ctx = canvasTex.context;
    ctx.imageSmoothingEnabled = false;

    // Tile indices:
    // 0 = lobby floor (warm cream)
    // 1 = wood floor (planning)
    // 2 = carpet blue (code workshop)
    // 3 = carpet green (research lab)
    // 4 = carpet tan (review room)
    // 5 = tile floor (spawn area)
    // 6 = wall (light painted)
    // 7 = wall bottom (with baseboard)
    // 8 = desk with monitor
    // 9 = chair
    // 10 = bookshelf
    // 11 = plant
    // 12 = whiteboard
    // 13 = task board
    // 14 = server rack
    // 15 = coffee machine
    // 16 = carpet purple (planning)
    // 17 = wall top shadow
    // 18 = door
    // 19 = rug center

    // Row 0: Floor tiles — bright, warm Gather Town palette
    this.drawLobbyFloor(ctx, 0, 0);
    this.drawWoodFloor(ctx, 1, 0);
    this.drawCarpet(ctx, 2, 0, '#8BABC4', '#9AB5CC', '#7E9DB8');  // soft blue
    this.drawCarpet(ctx, 3, 0, '#8BBF9A', '#98C9A6', '#7EB48E');  // soft sage
    this.drawCarpet(ctx, 4, 0, '#C8AD8A', '#D0B896', '#BDA27E');  // soft tan
    this.drawTileFloor(ctx, 5, 0);
    this.drawWall(ctx, 6, 0);
    this.drawWallBottom(ctx, 7, 0);

    // Row 1: Furniture
    this.drawDesk(ctx, 0, 1);
    this.drawChair(ctx, 1, 1);
    this.drawBookshelf(ctx, 2, 1);
    this.drawPlant(ctx, 3, 1);
    this.drawWhiteboard(ctx, 4, 1);
    this.drawTaskBoard(ctx, 5, 1);
    this.drawServerRack(ctx, 6, 1);
    this.drawCoffee(ctx, 7, 1);

    // Row 2: More tiles
    this.drawCarpet(ctx, 0, 2, '#B8A0CC', '#C2AADA', '#AD96C0'); // soft purple
    this.drawWallTopShadow(ctx, 1, 2);
    this.drawDoor(ctx, 2, 2);
    this.drawRugCenter(ctx, 3, 2);

    canvasTex.refresh();
    canvasTex.setFilter(Phaser.Textures.FilterMode.NEAREST);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frameIndex = row * cols + col;
        canvasTex.add(frameIndex, 0, col * this.TILE, row * this.TILE, this.TILE, this.TILE);
      }
    }
  }

  // === FLOORS ===

  private static drawLobbyFloor(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Warm cream base
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Subtle tile grid
    ctx.fillStyle = '#DDD5C3';
    ctx.fillRect(x + 15, y, 1, this.TILE);
    ctx.fillRect(x, y + 15, this.TILE, 1);
    // Highlight
    ctx.fillStyle = '#F0E8D8';
    ctx.fillRect(x, y, this.TILE, 1);
    ctx.fillRect(x, y, 1, this.TILE);
  }

  private static drawWoodFloor(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Warm oak base
    ctx.fillStyle = '#C8A878';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Wood plank lines
    ctx.fillStyle = '#BA9A6C';
    ctx.fillRect(x, y + 7, this.TILE, 1);
    ctx.fillRect(x, y + 15, this.TILE, 1);
    ctx.fillRect(x, y + 23, this.TILE, 1);
    ctx.fillRect(x, y + 31, this.TILE, 1);
    // Plank divider (vertical)
    ctx.fillRect(x + 15, y, 1, 8);
    ctx.fillRect(x + 23, y + 8, 1, 8);
    ctx.fillRect(x + 8, y + 16, 1, 8);
    ctx.fillRect(x + 28, y + 24, 1, 8);
    // Wood grain highlights
    ctx.fillStyle = '#D4B488';
    ctx.fillRect(x + 2, y + 3, 10, 1);
    ctx.fillRect(x + 18, y + 11, 8, 1);
    ctx.fillRect(x + 5, y + 19, 12, 1);
    ctx.fillRect(x + 14, y + 27, 10, 1);
    // Subtle shadow on plank edges
    ctx.fillStyle = '#B89060';
    ctx.fillRect(x, y + 8, this.TILE, 1);
    ctx.fillRect(x, y + 16, this.TILE, 1);
    ctx.fillRect(x, y + 24, this.TILE, 1);
  }

  private static drawCarpet(ctx: CanvasRenderingContext2D, col: number, row: number, base: string, light: string, dark: string) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    ctx.fillStyle = base;
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Soft woven texture pattern
    ctx.fillStyle = light;
    for (let py = 0; py < this.TILE; py += 4) {
      for (let px = 0; px < this.TILE; px += 4) {
        if ((px + py) % 8 === 0) {
          ctx.fillRect(x + px, y + py, 2, 2);
        }
      }
    }
    ctx.fillStyle = dark;
    for (let py = 2; py < this.TILE; py += 4) {
      for (let px = 2; px < this.TILE; px += 4) {
        if ((px + py) % 8 === 0) {
          ctx.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  }

  private static drawTileFloor(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Clean light tile
    ctx.fillStyle = '#F0EBE0';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Tile grid
    ctx.fillStyle = '#E0DAD0';
    ctx.fillRect(x + 15, y, 2, this.TILE);
    ctx.fillRect(x, y + 15, this.TILE, 2);
    // Inner highlight on each tile quad
    ctx.fillStyle = '#F5F0E5';
    ctx.fillRect(x + 1, y + 1, 13, 1);
    ctx.fillRect(x + 1, y + 1, 1, 13);
    ctx.fillRect(x + 17, y + 1, 14, 1);
    ctx.fillRect(x + 17, y + 1, 1, 13);
    ctx.fillRect(x + 1, y + 17, 13, 1);
    ctx.fillRect(x + 1, y + 17, 1, 14);
    ctx.fillRect(x + 17, y + 17, 14, 1);
    ctx.fillRect(x + 17, y + 17, 1, 14);
  }

  // === WALLS (bright painted, Gather Town style) ===

  private static drawWall(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Clean painted wall — light warm gray
    ctx.fillStyle = '#D8D4CC';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Upper highlight
    ctx.fillStyle = '#E0DCD4';
    ctx.fillRect(x, y, this.TILE, 8);
    // Very subtle horizontal stripe (wainscoting hint)
    ctx.fillStyle = '#CCC8C0';
    ctx.fillRect(x, y + 20, this.TILE, 1);
    // Bottom baseboard
    ctx.fillStyle = '#B8B0A4';
    ctx.fillRect(x, y + 28, this.TILE, 4);
    ctx.fillStyle = '#C4BEB4';
    ctx.fillRect(x, y + 28, this.TILE, 1);
  }

  private static drawWallBottom(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Wall face — same as drawWall but with floor shadow at bottom
    ctx.fillStyle = '#D8D4CC';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    ctx.fillStyle = '#E0DCD4';
    ctx.fillRect(x, y, this.TILE, 8);
    ctx.fillStyle = '#CCC8C0';
    ctx.fillRect(x, y + 20, this.TILE, 1);
    // Baseboard
    ctx.fillStyle = '#B8B0A4';
    ctx.fillRect(x, y + 26, this.TILE, 4);
    ctx.fillStyle = '#C4BEB4';
    ctx.fillRect(x, y + 26, this.TILE, 1);
    // Floor shadow (soft gradient)
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y + 30, this.TILE, 2);
  }

  private static drawWallTopShadow(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Wall cap with shadow below
    ctx.fillStyle = '#C8C4BC';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    ctx.fillStyle = '#D0CCC4';
    ctx.fillRect(x, y, this.TILE, 12);
    // Crown molding
    ctx.fillStyle = '#BAB6AE';
    ctx.fillRect(x, y + this.TILE - 4, this.TILE, 2);
    // Shadow cast onto floor below
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y + this.TILE - 2, this.TILE, 2);
  }

  private static drawDoor(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Wall around door
    ctx.fillStyle = '#D8D4CC';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Door frame
    ctx.fillStyle = '#A09080';
    ctx.fillRect(x + 4, y, 24, this.TILE);
    // Door panel
    ctx.fillStyle = '#C4A878';
    ctx.fillRect(x + 6, y + 1, 20, this.TILE - 1);
    // Panel detail
    ctx.fillStyle = '#BA9E70';
    ctx.fillRect(x + 8, y + 4, 16, 10);
    ctx.fillStyle = '#CEB888';
    ctx.fillRect(x + 9, y + 5, 14, 8);
    ctx.fillRect(x + 8, y + 18, 16, 8);
    ctx.fillStyle = '#CEB888';
    ctx.fillRect(x + 9, y + 19, 14, 6);
    // Handle
    ctx.fillStyle = '#D4A830';
    ctx.fillRect(x + 22, y + 15, 2, 3);
    ctx.fillStyle = '#E8C050';
    ctx.fillRect(x + 22, y + 15, 2, 1);
  }

  private static drawRugCenter(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Lobby floor underneath
    ctx.fillStyle = '#E8E0D0';
    ctx.fillRect(x, y, this.TILE, this.TILE);
    // Rug
    ctx.fillStyle = '#B85C5C';
    ctx.fillRect(x + 2, y + 2, 28, 28);
    ctx.fillStyle = '#C86868';
    ctx.fillRect(x + 4, y + 4, 24, 24);
    // Rug pattern
    ctx.fillStyle = '#D4A050';
    ctx.fillRect(x + 6, y + 6, 20, 1);
    ctx.fillRect(x + 6, y + 25, 20, 1);
    ctx.fillRect(x + 6, y + 6, 1, 20);
    ctx.fillRect(x + 25, y + 6, 1, 20);
  }

  // === FURNITURE (warmer tones, proper outlines, shadows) ===

  private static drawDesk(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + 3, y + 25, 28, 3);
    // Desk legs
    ctx.fillStyle = '#A08058';
    ctx.fillRect(x + 4, y + 22, 2, 6);
    ctx.fillRect(x + 26, y + 22, 2, 6);
    // Desk surface (warm oak)
    ctx.fillStyle = '#D4A860';
    ctx.fillRect(x + 2, y + 10, 28, 13);
    // Surface highlight
    ctx.fillStyle = '#DCB470';
    ctx.fillRect(x + 2, y + 10, 28, 2);
    // Surface front edge
    ctx.fillStyle = '#C49850';
    ctx.fillRect(x + 2, y + 22, 28, 1);
    // Monitor frame
    ctx.fillStyle = '#333340';
    ctx.fillRect(x + 8, y + 1, 16, 11);
    // Screen
    ctx.fillStyle = '#5B9BD5';
    ctx.fillRect(x + 9, y + 2, 14, 9);
    // Screen content
    ctx.fillStyle = '#8BC4F0';
    ctx.fillRect(x + 10, y + 3, 8, 1);
    ctx.fillStyle = '#A0D8A0';
    ctx.fillRect(x + 10, y + 5, 10, 1);
    ctx.fillStyle = '#F0D080';
    ctx.fillRect(x + 10, y + 7, 6, 1);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(x + 10, y + 9, 11, 1);
    // Monitor stand
    ctx.fillStyle = '#444450';
    ctx.fillRect(x + 14, y + 12, 4, 2);
    ctx.fillRect(x + 12, y + 13, 8, 1);
    // Keyboard
    ctx.fillStyle = '#E8E4E0';
    ctx.fillRect(x + 9, y + 16, 14, 4);
    ctx.fillStyle = '#D8D4D0';
    for (let kx = 0; kx < 12; kx += 2) {
      ctx.fillRect(x + 10 + kx, y + 17, 1, 2);
    }
    // Mouse
    ctx.fillStyle = '#E8E4E0';
    ctx.fillRect(x + 25, y + 17, 3, 3);
  }

  private static drawChair(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 7, y + 27, 18, 3);
    // Wheels/base
    ctx.fillStyle = '#555560';
    ctx.fillRect(x + 8, y + 26, 16, 3);
    ctx.fillStyle = '#444450';
    ctx.fillRect(x + 7, y + 28, 3, 2);
    ctx.fillRect(x + 22, y + 28, 3, 2);
    ctx.fillRect(x + 14, y + 29, 4, 2);
    // Stem
    ctx.fillStyle = '#666670';
    ctx.fillRect(x + 14, y + 23, 4, 4);
    // Seat
    ctx.fillStyle = '#4A6880';
    ctx.fillRect(x + 6, y + 16, 20, 8);
    ctx.fillStyle = '#547490';
    ctx.fillRect(x + 6, y + 16, 20, 2);
    // Back
    ctx.fillStyle = '#3D5A70';
    ctx.fillRect(x + 8, y + 4, 16, 13);
    ctx.fillStyle = '#4A6880';
    ctx.fillRect(x + 9, y + 5, 14, 11);
    // Cushion detail
    ctx.fillStyle = '#547490';
    ctx.fillRect(x + 10, y + 6, 5, 9);
    ctx.fillRect(x + 17, y + 6, 5, 9);
    // Armrests
    ctx.fillStyle = '#3D5A70';
    ctx.fillRect(x + 4, y + 13, 3, 5);
    ctx.fillRect(x + 25, y + 13, 3, 5);
  }

  private static drawBookshelf(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + 3, y + 28, 28, 3);
    // Frame (warm dark wood)
    ctx.fillStyle = '#7A6048';
    ctx.fillRect(x + 2, y + 0, 28, this.TILE);
    // Inner shelves
    ctx.fillStyle = '#C4A878';
    ctx.fillRect(x + 4, y + 1, 24, 9);
    ctx.fillRect(x + 4, y + 11, 24, 9);
    ctx.fillRect(x + 4, y + 21, 24, 9);
    // Shelf dividers
    ctx.fillStyle = '#8B7050';
    ctx.fillRect(x + 3, y + 10, 26, 1);
    ctx.fillRect(x + 3, y + 20, 26, 1);
    ctx.fillRect(x + 3, y + 30, 26, 1);
    // Books — carefully placed with consistent style
    const books = [
      { c: '#D45B5B', x: 5, w: 3 }, { c: '#5B8BD4', x: 9, w: 4 },
      { c: '#5BBD6B', x: 14, w: 3 }, { c: '#D4A85B', x: 18, w: 3 },
      { c: '#9B6BD4', x: 22, w: 4 },
    ];
    for (let shelf = 0; shelf < 3; shelf++) {
      for (const book of books) {
        ctx.fillStyle = book.c;
        ctx.fillRect(x + book.x, y + shelf * 10 + 2, book.w, 7);
        // Book spine highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + book.x, y + shelf * 10 + 2, 1, 7);
      }
    }
  }

  private static drawPlant(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 9, y + 28, 14, 3);
    // Pot
    ctx.fillStyle = '#D4845A';
    ctx.fillRect(x + 10, y + 21, 12, 9);
    ctx.fillStyle = '#E0926A';
    ctx.fillRect(x + 9, y + 19, 14, 3);
    // Pot rim highlight
    ctx.fillStyle = '#E8A078';
    ctx.fillRect(x + 9, y + 19, 14, 1);
    // Dirt
    ctx.fillStyle = '#6B5040';
    ctx.fillRect(x + 11, y + 20, 10, 2);
    // Stem
    ctx.fillStyle = '#588040';
    ctx.fillRect(x + 15, y + 12, 2, 8);
    // Leaves (lush, round shapes)
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(x + 11, y + 6, 10, 8);
    ctx.fillRect(x + 8, y + 3, 7, 7);
    ctx.fillRect(x + 17, y + 4, 7, 7);
    ctx.fillRect(x + 12, y + 0, 6, 5);
    // Leaf highlights
    ctx.fillStyle = '#66C46A';
    ctx.fillRect(x + 9, y + 3, 3, 3);
    ctx.fillRect(x + 18, y + 5, 3, 3);
    ctx.fillRect(x + 13, y + 1, 3, 2);
    ctx.fillRect(x + 12, y + 7, 4, 3);
    // Leaf shadows
    ctx.fillStyle = '#3D9640';
    ctx.fillRect(x + 14, y + 11, 5, 2);
    ctx.fillRect(x + 10, y + 9, 3, 2);
  }

  private static drawWhiteboard(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Legs
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(x + 6, y + 24, 2, 8);
    ctx.fillRect(x + 24, y + 24, 2, 8);
    // Board frame (silver)
    ctx.fillStyle = '#C0C4C8';
    ctx.fillRect(x + 2, y + 2, 28, 22);
    // White surface
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(x + 3, y + 3, 26, 18);
    // Content — neat diagram + text
    ctx.fillStyle = '#4A80C0';
    ctx.fillRect(x + 5, y + 5, 10, 1);
    ctx.fillRect(x + 5, y + 7, 8, 1);
    ctx.fillRect(x + 5, y + 9, 12, 1);
    ctx.fillStyle = '#D05050';
    ctx.fillRect(x + 5, y + 12, 6, 1);
    ctx.fillRect(x + 5, y + 14, 9, 1);
    // Diagram box
    ctx.fillStyle = '#50A060';
    ctx.fillRect(x + 18, y + 5, 8, 6);
    ctx.fillStyle = '#60B870';
    ctx.fillRect(x + 19, y + 6, 6, 4);
    // Arrow
    ctx.fillStyle = '#D05050';
    ctx.fillRect(x + 14, y + 7, 3, 1);
    // Tray
    ctx.fillStyle = '#B0B4B8';
    ctx.fillRect(x + 3, y + 21, 26, 3);
    // Markers
    ctx.fillStyle = '#D05050';
    ctx.fillRect(x + 5, y + 22, 3, 2);
    ctx.fillStyle = '#4A80C0';
    ctx.fillRect(x + 9, y + 22, 3, 2);
    ctx.fillStyle = '#50A060';
    ctx.fillRect(x + 13, y + 22, 3, 2);
  }

  private static drawTaskBoard(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Legs
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(x + 6, y + 26, 2, 6);
    ctx.fillRect(x + 24, y + 26, 2, 6);
    // Board (cork)
    ctx.fillStyle = '#D4B888';
    ctx.fillRect(x + 1, y + 1, 30, 25);
    // Frame
    ctx.fillStyle = '#A08060';
    ctx.fillRect(x + 1, y + 1, 30, 1);
    ctx.fillRect(x + 1, y + 25, 30, 1);
    ctx.fillRect(x + 1, y + 1, 1, 25);
    ctx.fillRect(x + 30, y + 1, 1, 25);
    // Column dividers
    ctx.fillStyle = '#C0A070';
    ctx.fillRect(x + 11, y + 3, 1, 22);
    ctx.fillRect(x + 21, y + 3, 1, 22);
    // Column headers
    ctx.fillStyle = '#E06060';
    ctx.fillRect(x + 3, y + 3, 7, 2);
    ctx.fillStyle = '#E0A040';
    ctx.fillRect(x + 13, y + 3, 7, 2);
    ctx.fillStyle = '#50B060';
    ctx.fillRect(x + 23, y + 3, 6, 2);
    // Post-its (detailed)
    ctx.fillStyle = '#FFF3B0';
    ctx.fillRect(x + 3, y + 7, 7, 6);
    ctx.fillRect(x + 3, y + 15, 7, 6);
    ctx.fillStyle = '#FFE0A0';
    ctx.fillRect(x + 13, y + 7, 7, 6);
    ctx.fillStyle = '#B0F0C0';
    ctx.fillRect(x + 23, y + 7, 6, 6);
    // Post-it text lines
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 4, y + 9, 5, 1);
    ctx.fillRect(x + 4, y + 11, 3, 1);
    ctx.fillRect(x + 4, y + 17, 5, 1);
    ctx.fillRect(x + 14, y + 9, 5, 1);
    ctx.fillRect(x + 24, y + 9, 4, 1);
    // Pins
    ctx.fillStyle = '#E06060';
    ctx.fillRect(x + 6, y + 7, 2, 1);
    ctx.fillRect(x + 6, y + 15, 2, 1);
    ctx.fillStyle = '#E0A040';
    ctx.fillRect(x + 16, y + 7, 2, 1);
    ctx.fillStyle = '#50B060';
    ctx.fillRect(x + 25, y + 7, 2, 1);
  }

  private static drawServerRack(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(x + 5, y + 28, 24, 3);
    // Rack body (dark metal)
    ctx.fillStyle = '#404854';
    ctx.fillRect(x + 4, y + 1, 24, 29);
    // Rack front panel
    ctx.fillStyle = '#4A5460';
    ctx.fillRect(x + 5, y + 2, 22, 27);
    // Server units
    for (let s = 0; s < 4; s++) {
      const sy = y + 3 + s * 7;
      ctx.fillStyle = '#556070';
      ctx.fillRect(x + 6, sy, 20, 5);
      // Server face
      ctx.fillStyle = '#606C78';
      ctx.fillRect(x + 7, sy + 1, 18, 3);
      // LED lights
      ctx.fillStyle = '#40D060';
      ctx.fillRect(x + 8, sy + 2, 2, 1);
      ctx.fillStyle = s === 2 ? '#E05050' : '#40A0E0';
      ctx.fillRect(x + 11, sy + 2, 2, 1);
      // Vents
      ctx.fillStyle = '#505C68';
      for (let v = 0; v < 5; v++) {
        ctx.fillRect(x + 17 + v * 2, sy + 1, 1, 3);
      }
    }
    // Power indicator
    ctx.fillStyle = '#40D060';
    ctx.fillRect(x + 26, y + 26, 1, 1);
  }

  private static drawCoffee(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = col * this.TILE;
    const y = row * this.TILE;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 5, y + 26, 24, 3);
    // Counter/table (warm wood)
    ctx.fillStyle = '#D4A860';
    ctx.fillRect(x + 3, y + 16, 26, 8);
    ctx.fillStyle = '#C49850';
    ctx.fillRect(x + 3, y + 23, 26, 1);
    // Table legs
    ctx.fillStyle = '#A08050';
    ctx.fillRect(x + 5, y + 24, 3, 6);
    ctx.fillRect(x + 24, y + 24, 3, 6);
    // Coffee machine body
    ctx.fillStyle = '#384048';
    ctx.fillRect(x + 7, y + 3, 18, 13);
    // Machine front
    ctx.fillStyle = '#444C54';
    ctx.fillRect(x + 8, y + 4, 16, 11);
    // Display
    ctx.fillStyle = '#60B8E0';
    ctx.fillRect(x + 10, y + 5, 8, 5);
    // Display text
    ctx.fillStyle = '#A0E0F0';
    ctx.fillRect(x + 11, y + 6, 4, 1);
    ctx.fillRect(x + 11, y + 8, 6, 1);
    // Buttons
    ctx.fillStyle = '#E06060';
    ctx.fillRect(x + 20, y + 6, 2, 2);
    ctx.fillStyle = '#60C060';
    ctx.fillRect(x + 20, y + 9, 2, 2);
    // Nozzle area
    ctx.fillStyle = '#2C3038';
    ctx.fillRect(x + 12, y + 11, 8, 4);
    // Cup
    ctx.fillStyle = '#F0ECE8';
    ctx.fillRect(x + 13, y + 13, 6, 4);
    ctx.fillStyle = '#E0DCD8';
    ctx.fillRect(x + 13, y + 16, 6, 1);
    // Coffee inside
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(x + 14, y + 14, 4, 2);
    // Steam
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 14, y + 11, 1, 2);
    ctx.fillRect(x + 16, y + 10, 1, 3);
    ctx.fillRect(x + 18, y + 11, 1, 2);
  }
}
