import Phaser from 'phaser';

/**
 * Generates high-quality multi-tile furniture sprites with 3/4 perspective,
 * rich shading, and Gather Town-level detail.
 *
 * Each furniture piece is its own texture (not crammed into a 32x32 tile).
 */
export class FurnitureGenerator {

  static readonly FURNITURE_KEYS = [
    'furn_desk', 'furn_chair', 'furn_bookshelf', 'furn_plant',
    'furn_whiteboard', 'furn_taskboard', 'furn_server', 'furn_coffee',
    'furn_sofa', 'furn_mug', 'furn_lamp',
    'furn_clock', 'furn_poster', 'furn_frame',
  ];

  static generateAll(scene: Phaser.Scene): void {
    this.genDesk(scene);
    this.genChair(scene);
    this.genBookshelf(scene);
    this.genPlant(scene);
    this.genWhiteboard(scene);
    this.genTaskBoard(scene);
    this.genServerRack(scene);
    this.genCoffeeMachine(scene);
    this.genSofa(scene);
    this.genMug(scene);
    this.genLamp(scene);
    this.genClock(scene);
    this.genPoster(scene);
    this.genFrame(scene);
  }

  // Helper: fill rect shorthand
  private static r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Helper: single pixel
  private static px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  // === DESK WITH MONITOR (64x48) ===
  private static genDesk(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_desk')) return;
    const W = 64, H = 48;
    const t = scene.textures.createCanvas('furn_desk', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow on floor
    this.r(c, 4, 42, 58, 4, 'rgba(0,0,0,0.08)');

    // Desk legs
    this.r(c, 4, 36, 3, 8, '#9A7848');
    this.r(c, 57, 36, 3, 8, '#9A7848');
    this.r(c, 30, 36, 3, 8, '#9A7848');

    // Desk surface — 3/4 view: top face + front face
    // Front face (darker)
    this.r(c, 2, 30, 60, 8, '#C09050');
    this.r(c, 2, 37, 60, 1, '#A07840');
    // Top face (lighter)
    this.r(c, 2, 24, 60, 7, '#D8B070');
    // Top highlight
    this.r(c, 2, 24, 60, 1, '#E0C080');
    // Edge
    this.r(c, 2, 30, 60, 1, '#B08848');

    // Left monitor frame
    this.r(c, 6, 4, 22, 18, '#333340');
    // Left screen
    this.r(c, 8, 6, 18, 14, '#4488CC');
    // Screen content — code editor
    this.r(c, 9, 7, 2, 10, '#3A3A4A');  // sidebar
    this.r(c, 12, 7, 12, 1, '#88CC88');  // green line
    this.r(c, 12, 9, 8, 1, '#CCCCCC');   // white line
    this.r(c, 12, 11, 10, 1, '#88AADD'); // blue line
    this.r(c, 12, 13, 6, 1, '#CCCCCC');
    this.r(c, 12, 15, 9, 1, '#DDAA77');  // orange line
    this.r(c, 12, 17, 7, 1, '#88CC88');
    // Screen glow
    this.r(c, 8, 6, 18, 1, '#66AADD');
    // Monitor stand
    this.r(c, 14, 22, 6, 3, '#444450');
    this.r(c, 12, 24, 10, 1, '#444450');

    // Right monitor frame
    this.r(c, 36, 4, 22, 18, '#333340');
    // Right screen
    this.r(c, 38, 6, 18, 14, '#3A6090');
    // Screen content — browser/app
    this.r(c, 38, 6, 18, 2, '#556070');   // toolbar
    this.r(c, 39, 7, 4, 1, '#88AACC');    // tab
    this.r(c, 39, 9, 16, 1, '#CCCCCC');
    this.r(c, 39, 11, 12, 1, '#CCCCCC');
    this.r(c, 39, 13, 8, 6, '#5588AA');   // image area
    this.r(c, 49, 13, 6, 3, '#DD8855');   // sidebar
    this.r(c, 49, 17, 6, 2, '#88BB88');
    // Monitor stand
    this.r(c, 44, 22, 6, 3, '#444450');
    this.r(c, 42, 24, 10, 1, '#444450');

    // Keyboard
    this.r(c, 18, 27, 18, 4, '#E8E4E0');
    this.r(c, 18, 27, 18, 1, '#F0ECE8'); // top highlight
    // Key rows
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        this.px(c, 19 + col * 2, 28 + row, '#D0CCC8');
      }
    }

    // Mouse
    this.r(c, 40, 28, 4, 3, '#E8E4E0');
    this.r(c, 40, 28, 4, 1, '#F0ECE8');
    this.px(c, 41, 29, '#D0CCC8');

    // Coffee mug on desk
    this.r(c, 52, 26, 4, 4, '#F0ECE8');
    this.r(c, 53, 27, 2, 2, '#8B5A2B');
    this.r(c, 56, 27, 1, 2, '#E0DCD8'); // handle

    // Pen holder
    this.r(c, 8, 26, 3, 4, '#6A6A7A');
    this.r(c, 8, 25, 1, 1, '#DD5555');  // red pen
    this.r(c, 9, 24, 1, 2, '#5588DD');  // blue pen
    this.r(c, 10, 25, 1, 1, '#55AA55'); // green pen

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === OFFICE CHAIR (28x36) ===
  private static genChair(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_chair')) return;
    const W = 28, H = 36;
    const t = scene.textures.createCanvas('furn_chair', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 4, 32, 20, 3, 'rgba(0,0,0,0.06)');

    // Wheels
    this.r(c, 5, 32, 3, 2, '#444450');
    this.r(c, 20, 32, 3, 2, '#444450');
    this.r(c, 12, 33, 4, 2, '#444450');

    // Base stem
    this.r(c, 12, 28, 4, 5, '#555560');

    // Seat (3/4 view — see top + front)
    this.r(c, 3, 22, 22, 4, '#3D5A70');   // front face
    this.r(c, 3, 18, 22, 5, '#4A6880');    // top face
    this.r(c, 3, 18, 22, 1, '#547490');    // highlight

    // Backrest
    this.r(c, 5, 3, 18, 16, '#3D5A70');
    this.r(c, 6, 4, 16, 14, '#4A6880');
    // Cushion segments
    this.r(c, 7, 5, 6, 12, '#547490');
    this.r(c, 15, 5, 6, 12, '#547490');
    // Top curve
    this.r(c, 7, 3, 14, 1, '#3D5A70');
    this.r(c, 6, 2, 16, 1, '#4A6880');

    // Armrests (3/4 perspective)
    this.r(c, 1, 15, 3, 7, '#3D5A70');
    this.r(c, 1, 15, 3, 1, '#547490');
    this.r(c, 24, 15, 3, 7, '#3D5A70');
    this.r(c, 24, 15, 3, 1, '#547490');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === BOOKSHELF (32x56) ===
  private static genBookshelf(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_bookshelf')) return;
    const W = 32, H = 56;
    const t = scene.textures.createCanvas('furn_bookshelf', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 3, 52, 28, 3, 'rgba(0,0,0,0.08)');

    // Outer frame (dark wood)
    this.r(c, 1, 0, 30, 54, '#6B5040');
    // Inner back
    this.r(c, 3, 2, 26, 50, '#C4A878');

    // Shelf dividers
    for (let i = 0; i < 4; i++) {
      this.r(c, 2, 13 * i + 12, 28, 2, '#7A6050');
      this.r(c, 2, 13 * i + 12, 28, 1, '#8B7060'); // highlight
    }

    // Books on each shelf (carefully colored, different sizes)
    const shelves = [
      [
        { x: 4, w: 3, h: 10, c: '#D45B5B', h2: '#E06B6B' },
        { x: 8, w: 4, h: 10, c: '#5B8BD4', h2: '#6B9BE0' },
        { x: 13, w: 3, h: 9, c: '#5BBD6B', h2: '#6BCD7B' },
        { x: 17, w: 3, h: 10, c: '#D4A85B', h2: '#E0B86B' },
        { x: 21, w: 4, h: 10, c: '#9B6BD4', h2: '#AB7BE0' },
        { x: 26, w: 2, h: 8, c: '#D46BAA', h2: '#E07BBA' },
      ],
      [
        { x: 4, w: 4, h: 10, c: '#5BAAD4', h2: '#6BBAE0' },
        { x: 9, w: 3, h: 9, c: '#D4725B', h2: '#E0826B' },
        { x: 13, w: 2, h: 10, c: '#6BD47B', h2: '#7BE08B' },
        { x: 16, w: 5, h: 10, c: '#AA5BD4', h2: '#BA6BE0' },
        { x: 22, w: 3, h: 10, c: '#D4D45B', h2: '#E0E06B' },
        { x: 26, w: 2, h: 8, c: '#5BD4C4', h2: '#6BE0D4' },
      ],
      [
        { x: 4, w: 3, h: 10, c: '#D45B8B', h2: '#E06B9B' },
        { x: 8, w: 3, h: 10, c: '#8BD45B', h2: '#9BE06B' },
        { x: 12, w: 4, h: 9, c: '#5B5BD4', h2: '#6B6BE0' },
        { x: 17, w: 3, h: 10, c: '#D4885B', h2: '#E0986B' },
        { x: 21, w: 5, h: 10, c: '#5BD48B', h2: '#6BE09B' },
        { x: 27, w: 1, h: 6, c: '#AAAACC', h2: '#BBBBDD' },
      ],
      [
        { x: 4, w: 4, h: 10, c: '#D45BD4', h2: '#E06BE0' },
        { x: 9, w: 3, h: 10, c: '#5BD45B', h2: '#6BE06B' },
        { x: 13, w: 3, h: 9, c: '#D4D45B', h2: '#E0E06B' },
        { x: 17, w: 4, h: 10, c: '#5B8BD4', h2: '#6B9BE0' },
        { x: 22, w: 3, h: 10, c: '#D45B5B', h2: '#E06B6B' },
      ],
    ];

    for (let s = 0; s < shelves.length; s++) {
      const shelfY = s * 13 + 2;
      for (const book of shelves[s]) {
        this.r(c, book.x, shelfY + (10 - book.h), book.w, book.h, book.c);
        // Spine highlight
        this.r(c, book.x, shelfY + (10 - book.h), 1, book.h, book.h2);
        // Top edge
        this.r(c, book.x, shelfY + (10 - book.h), book.w, 1, book.h2);
      }
    }

    // Side frame highlight
    this.r(c, 1, 0, 1, 54, '#7B6050');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === PLANT (24x44) ===
  private static genPlant(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_plant')) return;
    const W = 24, H = 44;
    const t = scene.textures.createCanvas('furn_plant', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 5, 40, 14, 3, 'rgba(0,0,0,0.06)');

    // Pot (terracotta, 3/4 view)
    this.r(c, 6, 32, 12, 10, '#CC7744');
    this.r(c, 5, 30, 14, 3, '#DD8855');
    this.r(c, 5, 30, 14, 1, '#EE9966'); // rim highlight
    this.r(c, 6, 42, 12, 1, '#BB6633'); // bottom edge
    // Pot front highlight
    this.r(c, 8, 34, 4, 6, '#DD8855');

    // Dirt
    this.r(c, 7, 31, 10, 2, '#5A4030');
    this.r(c, 8, 31, 4, 1, '#6B5040');

    // Stem
    this.r(c, 11, 18, 2, 13, '#4A7A3A');
    this.r(c, 11, 18, 1, 13, '#5A8A4A');

    // Leaves — layered, multiple shades for depth
    // Back leaves (darker)
    this.r(c, 4, 8, 8, 8, '#3A8A3A');
    this.r(c, 12, 6, 8, 8, '#3A8A3A');
    this.r(c, 7, 2, 10, 8, '#3A8A3A');

    // Mid leaves
    this.r(c, 2, 10, 7, 6, '#4AAA4A');
    this.r(c, 14, 8, 7, 7, '#4AAA4A');
    this.r(c, 6, 4, 6, 6, '#4AAA4A');
    this.r(c, 10, 0, 6, 5, '#4AAA4A');

    // Front leaves (lighter)
    this.r(c, 3, 12, 5, 4, '#5CC05C');
    this.r(c, 15, 10, 5, 4, '#5CC05C');
    this.r(c, 8, 2, 4, 4, '#5CC05C');
    this.r(c, 12, 1, 4, 3, '#5CC05C');

    // Leaf highlights (bright spots)
    this.r(c, 4, 11, 2, 2, '#70D870');
    this.r(c, 16, 9, 2, 2, '#70D870');
    this.r(c, 9, 3, 2, 2, '#70D870');
    this.r(c, 7, 6, 2, 1, '#70D870');
    this.r(c, 13, 2, 2, 1, '#70D870');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === WHITEBOARD (56x44) ===
  private static genWhiteboard(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_whiteboard')) return;
    const W = 56, H = 44;
    const t = scene.textures.createCanvas('furn_whiteboard', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Legs
    this.r(c, 8, 36, 2, 8, '#A0A0A8');
    this.r(c, 46, 36, 2, 8, '#A0A0A8');
    // Leg feet
    this.r(c, 6, 42, 6, 2, '#A0A0A8');
    this.r(c, 44, 42, 6, 2, '#A0A0A8');

    // Board frame (silver)
    this.r(c, 2, 2, 52, 34, '#C4C8CC');
    // White surface
    this.r(c, 4, 4, 48, 28, '#F8F8FA');
    // Subtle inner shadow
    this.r(c, 4, 4, 48, 1, '#F0F0F2');
    this.r(c, 4, 4, 1, 28, '#F0F0F2');

    // Content — architecture diagram
    // Title
    this.r(c, 6, 6, 20, 1, '#4070B0');
    this.r(c, 6, 8, 14, 1, '#4070B0');
    // Boxes
    this.r(c, 6, 11, 10, 6, '#DD7755');
    this.r(c, 7, 12, 8, 4, '#EE9977');
    this.r(c, 20, 11, 10, 6, '#5588CC');
    this.r(c, 21, 12, 8, 4, '#77AADD');
    this.r(c, 34, 11, 10, 6, '#55AA66');
    this.r(c, 35, 12, 8, 4, '#77CC88');
    // Arrows between boxes
    this.r(c, 16, 14, 4, 1, '#666680');
    this.r(c, 30, 14, 4, 1, '#666680');
    // Arrow heads
    this.px(c, 19, 13, '#666680');
    this.px(c, 19, 15, '#666680');
    this.px(c, 33, 13, '#666680');
    this.px(c, 33, 15, '#666680');
    // Notes below
    this.r(c, 6, 20, 16, 1, '#888890');
    this.r(c, 6, 22, 12, 1, '#888890');
    this.r(c, 6, 24, 18, 1, '#DD5555');
    this.r(c, 6, 26, 10, 1, '#888890');
    // Checkboxes
    this.r(c, 34, 20, 3, 3, '#55AA66');
    this.r(c, 34, 25, 3, 3, '#CCCCCC');
    this.r(c, 38, 21, 10, 1, '#888890');
    this.r(c, 38, 26, 8, 1, '#888890');

    // Marker tray
    this.r(c, 4, 32, 48, 4, '#B0B4B8');
    this.r(c, 4, 32, 48, 1, '#C0C4C8');
    // Markers
    this.r(c, 8, 33, 6, 2, '#DD5555');
    this.r(c, 16, 33, 6, 2, '#4488CC');
    this.r(c, 24, 33, 6, 2, '#55AA66');
    this.r(c, 32, 33, 4, 2, '#333340'); // eraser

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === TASK BOARD (56x44) ===
  private static genTaskBoard(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_taskboard')) return;
    const W = 56, H = 44;
    const t = scene.textures.createCanvas('furn_taskboard', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Legs
    this.r(c, 8, 36, 2, 8, '#A0A0A8');
    this.r(c, 46, 36, 2, 8, '#A0A0A8');

    // Cork board
    this.r(c, 1, 1, 54, 35, '#C4A070');
    // Frame
    this.r(c, 0, 0, 56, 1, '#8A7050');
    this.r(c, 0, 36, 56, 1, '#8A7050');
    this.r(c, 0, 0, 1, 37, '#8A7050');
    this.r(c, 55, 0, 1, 37, '#8A7050');
    // Frame highlight
    this.r(c, 1, 1, 54, 1, '#9A8060');

    // Column dividers
    this.r(c, 18, 3, 1, 32, '#B0904A');
    this.r(c, 37, 3, 1, 32, '#B0904A');

    // Column headers
    this.r(c, 3, 3, 14, 3, '#E06060'); // To Do
    this.r(c, 20, 3, 16, 3, '#E0A040'); // In Progress
    this.r(c, 39, 3, 15, 3, '#50B060'); // Done

    // Post-its with proper detail
    // To Do column
    this.r(c, 3, 8, 13, 8, '#FFF3B0');
    this.r(c, 4, 10, 10, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 4, 12, 7, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 3, 18, 13, 8, '#FFDDAA');
    this.r(c, 4, 20, 10, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 4, 22, 8, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 3, 28, 13, 6, '#FFB0B0');
    this.r(c, 4, 30, 9, 1, 'rgba(0,0,0,0.12)');

    // In Progress column
    this.r(c, 20, 8, 15, 8, '#B0E0FF');
    this.r(c, 21, 10, 12, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 21, 12, 8, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 20, 18, 15, 8, '#FFE0B0');
    this.r(c, 21, 20, 10, 1, 'rgba(0,0,0,0.12)');

    // Done column
    this.r(c, 39, 8, 14, 8, '#B0FFB0');
    this.r(c, 40, 10, 10, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 39, 18, 14, 8, '#B0FFB0');
    this.r(c, 40, 20, 10, 1, 'rgba(0,0,0,0.12)');
    this.r(c, 39, 28, 14, 6, '#B0FFB0');

    // Checkmarks on done items
    this.px(c, 50, 10, '#40A050');
    this.px(c, 51, 11, '#40A050');
    this.px(c, 52, 10, '#40A050');
    this.px(c, 50, 20, '#40A050');
    this.px(c, 51, 21, '#40A050');
    this.px(c, 52, 20, '#40A050');

    // Pins
    this.r(c, 8, 8, 2, 2, '#E04040');
    this.r(c, 8, 18, 2, 2, '#E0A040');
    this.r(c, 8, 28, 2, 2, '#E04040');
    this.r(c, 26, 8, 2, 2, '#4070E0');
    this.r(c, 26, 18, 2, 2, '#E0A040');
    this.r(c, 44, 8, 2, 2, '#40B050');
    this.r(c, 44, 18, 2, 2, '#40B050');
    this.r(c, 44, 28, 2, 2, '#40B050');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === SERVER RACK (28x56) ===
  private static genServerRack(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_server')) return;
    const W = 28, H = 56;
    const t = scene.textures.createCanvas('furn_server', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 3, 52, 24, 3, 'rgba(0,0,0,0.08)');

    // Rack body
    this.r(c, 2, 0, 24, 54, '#384048');
    // Front panel
    this.r(c, 3, 1, 22, 52, '#404850');
    // Top highlight
    this.r(c, 3, 1, 22, 1, '#505860');

    // 5 server units
    for (let i = 0; i < 5; i++) {
      const sy = 3 + i * 10;
      // Server unit body
      this.r(c, 4, sy, 20, 8, '#4A5460');
      this.r(c, 5, sy + 1, 18, 6, '#556070');
      // Top highlight
      this.r(c, 5, sy + 1, 18, 1, '#606C78');
      // LEDs
      this.r(c, 6, sy + 3, 2, 2, i === 3 ? '#E05050' : '#40D060');
      this.r(c, 9, sy + 3, 2, 2, '#40A0E0');
      // Vents
      for (let v = 0; v < 6; v++) {
        this.r(c, 14 + v * 2, sy + 2, 1, 4, '#4A5460');
      }
    }

    // Bottom power indicator
    this.r(c, 22, 50, 2, 2, '#40D060');
    // Handle
    this.r(c, 12, 51, 4, 2, '#606C78');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === COFFEE MACHINE (32x40) ===
  private static genCoffeeMachine(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_coffee')) return;
    const W = 32, H = 40;
    const t = scene.textures.createCanvas('furn_coffee', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 3, 36, 28, 3, 'rgba(0,0,0,0.06)');

    // Counter (3/4 view)
    this.r(c, 1, 22, 30, 6, '#C49850');
    this.r(c, 1, 20, 30, 3, '#D8B070');
    this.r(c, 1, 20, 30, 1, '#E0C080');
    // Counter legs
    this.r(c, 3, 28, 3, 10, '#A08050');
    this.r(c, 26, 28, 3, 10, '#A08050');

    // Machine body
    this.r(c, 6, 2, 20, 18, '#384048');
    this.r(c, 7, 3, 18, 16, '#444C54');

    // Display
    this.r(c, 9, 4, 10, 6, '#60B8E0');
    this.r(c, 10, 5, 6, 1, '#A0E0F0');
    this.r(c, 10, 7, 8, 1, '#A0E0F0');

    // Buttons
    this.r(c, 20, 5, 3, 3, '#E06060');
    this.r(c, 20, 5, 3, 1, '#F07070');
    this.r(c, 20, 9, 3, 3, '#60C060');
    this.r(c, 20, 9, 3, 1, '#70D070');

    // Nozzle area
    this.r(c, 11, 12, 10, 6, '#2C3038');
    // Drip tray
    this.r(c, 10, 17, 12, 2, '#555560');

    // Cup
    this.r(c, 13, 14, 6, 5, '#F0ECE8');
    this.r(c, 13, 18, 6, 1, '#E0DCD8');
    this.r(c, 14, 15, 4, 3, '#8B5A2B');

    // Steam
    this.r(c, 14, 12, 1, 2, 'rgba(255,255,255,0.2)');
    this.r(c, 16, 11, 1, 3, 'rgba(255,255,255,0.2)');
    this.r(c, 18, 12, 1, 2, 'rgba(255,255,255,0.2)');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === SOFA (48x28) ===
  private static genSofa(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_sofa')) return;
    const W = 48, H = 28;
    const t = scene.textures.createCanvas('furn_sofa', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Shadow
    this.r(c, 3, 24, 44, 3, 'rgba(0,0,0,0.06)');

    // Legs
    this.r(c, 4, 22, 3, 4, '#6B5040');
    this.r(c, 41, 22, 3, 4, '#6B5040');

    // Back (3/4 view top)
    this.r(c, 2, 0, 44, 10, '#CC7744');
    this.r(c, 3, 1, 42, 8, '#DD8855');
    this.r(c, 3, 1, 42, 2, '#EE9966');

    // Seat (front face)
    this.r(c, 2, 10, 44, 8, '#DD8855');
    // Cushion seams
    this.r(c, 2, 10, 44, 1, '#CC7744');
    this.r(c, 16, 10, 1, 8, '#CC7744');
    this.r(c, 31, 10, 1, 8, '#CC7744');
    // Seat top highlight
    this.r(c, 3, 11, 12, 2, '#EE9966');
    this.r(c, 18, 11, 12, 2, '#EE9966');
    this.r(c, 33, 11, 12, 2, '#EE9966');

    // Seat front face (darker)
    this.r(c, 2, 18, 44, 5, '#CC7744');
    this.r(c, 2, 18, 44, 1, '#DD8855');

    // Armrests
    this.r(c, 0, 2, 4, 18, '#BB6633');
    this.r(c, 0, 2, 4, 2, '#CC7744');
    this.r(c, 44, 2, 4, 18, '#BB6633');
    this.r(c, 44, 2, 4, 2, '#CC7744');

    // Decorative pillow
    this.r(c, 6, 4, 8, 6, '#CC4466');
    this.r(c, 7, 5, 6, 4, '#DD5577');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === MUG (small decorative, 8x8) ===
  private static genMug(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_mug')) return;
    const W = 8, H = 8;
    const t = scene.textures.createCanvas('furn_mug', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    this.r(c, 1, 1, 5, 6, '#F0ECE8');
    this.r(c, 2, 2, 3, 4, '#8B5A2B');
    this.r(c, 6, 3, 1, 3, '#E0DCD8'); // handle
    this.r(c, 2, 0, 1, 1, 'rgba(255,255,255,0.3)'); // steam

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === WALL CLOCK (16x16) ===
  private static genClock(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_clock')) return;
    const W = 16, H = 16;
    const t = scene.textures.createCanvas('furn_clock', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Clock face (circle approximated with pixels)
    this.r(c, 3, 1, 10, 14, '#E8E4E0');
    this.r(c, 1, 3, 14, 10, '#E8E4E0');
    this.r(c, 2, 2, 12, 12, '#F0ECE8');
    // Frame
    this.r(c, 3, 1, 10, 1, '#888890');
    this.r(c, 3, 14, 10, 1, '#888890');
    this.r(c, 1, 3, 1, 10, '#888890');
    this.r(c, 14, 3, 1, 10, '#888890');
    this.r(c, 2, 2, 1, 1, '#888890');
    this.r(c, 13, 2, 1, 1, '#888890');
    this.r(c, 2, 13, 1, 1, '#888890');
    this.r(c, 13, 13, 1, 1, '#888890');
    // Hour markers
    this.px(c, 8, 3, '#444450'); // 12
    this.px(c, 8, 12, '#444450'); // 6
    this.px(c, 3, 7, '#444450'); // 9
    this.px(c, 12, 7, '#444450'); // 3
    // Hour hand
    this.r(c, 8, 5, 1, 3, '#333340');
    // Minute hand
    this.r(c, 8, 7, 3, 1, '#333340');
    // Center dot
    this.px(c, 8, 7, '#E05050');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === POSTER (20x28) ===
  private static genPoster(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_poster')) return;
    const W = 20, H = 28;
    const t = scene.textures.createCanvas('furn_poster', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Paper
    this.r(c, 1, 1, 18, 26, '#F8F4F0');
    // Border
    this.r(c, 0, 0, 20, 1, '#AAAAAA');
    this.r(c, 0, 27, 20, 1, '#AAAAAA');
    this.r(c, 0, 0, 1, 28, '#AAAAAA');
    this.r(c, 19, 0, 1, 28, '#AAAAAA');
    // Chart/graph content
    this.r(c, 3, 3, 14, 1, '#4488CC'); // title
    this.r(c, 3, 5, 10, 1, '#888888'); // subtitle
    // Bar chart
    this.r(c, 4, 20, 2, 4, '#4488CC');
    this.r(c, 7, 16, 2, 8, '#55AA66');
    this.r(c, 10, 18, 2, 6, '#DD8855');
    this.r(c, 13, 14, 2, 10, '#CC5555');
    this.r(c, 16, 17, 2, 7, '#9966CC');
    // Axis
    this.r(c, 3, 24, 15, 1, '#666666');
    this.r(c, 3, 8, 1, 17, '#666666');
    // Legend dots
    this.r(c, 4, 9, 2, 1, '#4488CC');
    this.r(c, 7, 9, 4, 1, '#888888');
    this.r(c, 4, 11, 2, 1, '#55AA66');
    this.r(c, 7, 11, 5, 1, '#888888');
    // Pin
    this.r(c, 9, 0, 2, 2, '#E04040');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === FRAMED PICTURE (16x20) ===
  private static genFrame(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_frame')) return;
    const W = 16, H = 20;
    const t = scene.textures.createCanvas('furn_frame', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Frame (dark wood)
    this.r(c, 0, 0, 16, 20, '#6B5040');
    this.r(c, 1, 0, 14, 20, '#7B6050');
    // Inner mat
    this.r(c, 2, 2, 12, 16, '#E8E4E0');
    // Picture (landscape scene)
    this.r(c, 3, 3, 10, 14, '#88BBDD'); // sky
    this.r(c, 3, 11, 10, 6, '#66AA66'); // ground
    this.r(c, 3, 9, 10, 3, '#77BB77');  // hills
    // Sun
    this.r(c, 10, 4, 2, 2, '#FFDD44');
    // Tree
    this.r(c, 5, 8, 1, 4, '#6B5040');
    this.r(c, 4, 6, 3, 3, '#44884A');
    // Cloud
    this.r(c, 6, 4, 4, 2, '#CCDDEE');
    // Frame highlight
    this.r(c, 0, 0, 16, 1, '#8B7060');
    this.r(c, 0, 0, 1, 20, '#8B7060');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // === DESK LAMP (12x20) ===
  private static genLamp(scene: Phaser.Scene) {
    if (scene.textures.exists('furn_lamp')) return;
    const W = 12, H = 20;
    const t = scene.textures.createCanvas('furn_lamp', W, H)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;

    // Base
    this.r(c, 3, 17, 6, 2, '#555560');
    this.r(c, 3, 17, 6, 1, '#666670');
    // Stem
    this.r(c, 5, 8, 2, 10, '#555560');
    // Shade
    this.r(c, 1, 2, 10, 7, '#E8C840');
    this.r(c, 2, 3, 8, 5, '#F0D850');
    this.r(c, 3, 1, 6, 2, '#E8C840');
    // Light glow
    this.r(c, 3, 6, 6, 3, '#FFF0A0');

    t.refresh();
    t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
