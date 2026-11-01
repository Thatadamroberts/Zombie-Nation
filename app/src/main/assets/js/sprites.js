// Zombie Nation - pixel-art sprites (authored as pixel grids, cached to offscreen canvases)
'use strict';
(function (ZN) {
  // Grids face right. Upper body rows are shared; legs alternate between two frames.
  var BODIES = {
    shambler: [
      '....kkkkk.......',
      '...kSSSSSk......',
      '...kSSSSeSk.....',
      '...kSSSSSSk.....',
      '...kSSSmmSk.....',
      '....kkSSkk......',
      '...kBBBBBkkkkkk.',
      '..kBBBBBBSSSSSSk',
      '..kBBbBBBkkkkkk.',
      '..kBBBBBkSSSSSk.',
      '..kBBBBBBkkkkk..',
      '...kDDDDDk......'
    ],
    runner: [
      '.....kkkkk......',
      '....kSSSSSk.....',
      '....kSSSSeSk....',
      '....kSSSSmmk....',
      '.....kkSSkk.....',
      '....kBBBBk......',
      '...kBBBBBBk.....',
      '..kSkBBbBBBk....',
      '.kSk.kBBBBk.....',
      '..k..kBBBk......',
      '.....kDDDk......',
      '.....kDDDDk.....'
    ],
    crawler: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..........kkkk..',
      '.kkk.....kSSSSk.',
      'kBBBkkkkkSSSeSSk',
      'kBBbBBBBBkSmmSk.'
    ],
    brute: [
      '................',
      '....kkkkk.......',
      '...kSSSSSk......',
      '...kSSSeSek.....',
      '...kSSmmmSk.....',
      '..kkkSSSkkkk....',
      '.kBBBBBBBBBBk...',
      'kSBBBBBBBBBBSk..',
      'kSkBBBbBBBBkSk..',
      'kSkBBBBBBBBkSSk.',
      'kSSkBBBBBBkkSSk.',
      '.kkkDDDDDDk.kk..'
    ],
    spitter: [
      '................',
      '................',
      '......kkkkk.....',
      '.....kSSSSSk....',
      '....kSSSSeSSk...',
      '....kSSSmmmgk...',
      '...kBBkkSSkg....',
      '..kBBBBBBBk.g...',
      '..kBBBBBBBBk....',
      '..kBBbBBBkSk....',
      '...kBBBBBkSSk...',
      '...kDDDDDk......'
    ],
    bloater: [
      '......kkkk......',
      '.....kSSSSk.....',
      '.....kSSeSek....',
      '....kkSmmSkk....',
      '...kBBBBBBBBk...',
      '..kBBBBGGBBBBk..',
      '.kBBBGGGGGGBBBk.',
      '.kSBBGGbGGGBBSk.',
      '.kSBBGGGGGGBBSk.',
      '.kBBBBGGGGBBBBk.',
      '..kBBBBBBBBBBk..',
      '...kkBBBBBBkk...'
    ],
    player: [
      '................',
      '................',
      '................',
      '......kkkkk.....',
      '.....kSSSSSk....',
      '.....kSSSSeSk...',
      '.....kSSSSSSk...',
      '......kkSSkk....',
      '.....kCCCCCCk...',
      '....kCCrrrrCCk..',
      '....kSkCCCCkSk..',
      '.....kkCCCCkk...'
    ]
  };
  var LEGS = {
    walk: [
      ['...kPPkPPk......', '...kPPkkPPk.....', '..kPPk..kPPk....', '..kkk....kkk....'],
      ['...kPPPPPk......', '....kPPPk.......', '....kPPPk.......', '....kkkkk.......']
    ],
    run: [
      ['....kPPkPPk.....', '...kPPk..kPPk...', '..kPPk....kPk...', '..kkk.....kkk...'],
      ['.....kPPPk......', '.....kPPk.......', '....kPPPk.......', '....kkkk........']
    ],
    crawl: [
      ['.kBBBBBBBBkkkk..', '..kPPk.kSk.kSk..', '.kPk...kSk..kSk.', '.kk.....k....k..'],
      ['.kBBBBBBBBkkkk..', '..kPPk..kSk.kSk.', '..kPk..kSk.kSk..', '..kk...k...k....']
    ],
    brute: [
      ['...kPPPkPPPk....', '...kPPPkPPPk....', '..kPPPk.kPPPk...', '..kkkk...kkkk...'],
      ['...kPPPPPPPk....', '....kPPPPPk.....', '....kPPkPPk.....', '....kkk.kkk.....']
    ],
    stubby: [
      ['.....kPkkPk.....', '....kPPk.kPk....', '....kkk..kkk....', '................'],
      ['.....kPPPPk.....', '.....kPkkPk.....', '.....kkk.kkk....', '................']
    ],
    player: [
      ['......kPPkPPk...', '.....kPPk.kPPk..', '.....kkk...kkk..', '................'],
      ['......kPPPPk....', '......kPPPk.....', '......kkkkk.....', '................']
    ]
  };
  var SHAPE = { shambler: ['shambler', 'walk'], runner: ['runner', 'run'], crawler: ['crawler', 'crawl'], brute: ['brute', 'brute'],
    elite: ['brute', 'brute'], spitter: ['spitter', 'walk'], bloater: ['bloater', 'stubby'] };

  // Hat overlays for the player sprite: row -> pattern ('.' keeps the base pixel)
  var HATS = {
    flat:      { 3: '.....kkkkkk.....', 4: '....kHHHHHHHkk..' },
    bonnet:    { 2: '....kkkkkkkk....', 3: '...kHHHHHHHHk...', 4: '....kkrrrrkk....' },
    beanie:    { 1: '.......kk.......', 2: '......kwwk......', 3: '.....kHHHHHk....', 4: '....kHHHHHHHk...' },
    bald:      { 4: '.....kSwSSSk....' },
    souwester: { 2: '......kkkkk.....', 3: '.....kHHHHHk....', 4: '...kHHHHHHHHk...', 5: '...kk.......k...' },
    tam:       { 1: '......kk........', 2: '.....krrk.......', 3: '...kkHHHHHkk....', 4: '..kHHHHHHHHHk...' },
    headscarf: { 3: '.....kkkkkk.....', 4: '....kHHHHHHk....', 5: '....kHk.........', 6: '....kHk.........' }
  };

  var PETS = {
    corgi: [
      ['..........kk.k..', '.........kOOkOk.', '.........kOOOOk.', '..........kOOeOk', '.k.......kOOOOwk', 'kOk.kkkkkOOOOkk.',
       'kOOkOOOOOOOwk...', '.kOOOOOOOOOwk...', '..kwwwwwwwwwk...', '..kOkk...kOk....', '..kwk....kwk....', '..kk.....kk.....'],
      ['..........kk.k..', '.........kOOkOk.', '.........kOOOOk.', '..........kOOeOk', '.k.......kOOOOwk', 'kOk.kkkkkOOOOkk.',
       'kOOkOOOOOOOwk...', '.kOOOOOOOOOwk...', '..kwwwwwwwwwk...', '..kkOk..kOkk....', '...kwk..kwk.....', '...kk...kk......']
    ],
    cow: [
      ['..........w...w.', '...........w.w..', '..........kkkkk.', '..........kOOOOk', '.kk.kkkkkkOOOOOk', 'kOOkOOOOOOOOdOOk',
       'kOOOOOOOOOOOOOk.', 'kOOOOOOOOOOOOk..', '.kOOOOOOOOOOOk..', '.kOOkkkkkkOOk...', '.kdk......kdk...', '.kk.......kk....'],
      ['..........w...w.', '...........w.w..', '..........kkkkk.', '..........kOOOOk', '.kk.kkkkkkOOOOOk', 'kOOkOOOOOOOOdOOk',
       'kOOOOOOOOOOOOOk.', 'kOOOOOOOOOOOOk..', '.kOOOOOOOOOOOk..', '..kOkkkkkkOk....', '..kdk....kdk....', '..kk.....kk.....']
    ],
    dragon: [
      ['..kk............', '.kRRk...........', 'kRRRRk......kkk.', 'kRRRRRk....kRRRk', '.kRRRRRkkkkRReRk', '..kRRRRRRRRRRRRy',
       '...kRRRRRRRRkkk.', '..kRRkRRRRRk....', '.kRk.kRRRRk.....', 'kRk...kkRRk.....', 'kk......kRk.....', '.........kk.....'],
      ['................', '................', '............kkk.', '...........kRRRk', 'kkkkkkkkkkkRReRk', 'kRRRRRRRRRRRRRRy',
       '.kRRRRRRRRRRkkk.', '..kRRRRRRRRk....', '...kRRkRRRRk....', '....kk.kRRk.....', '........kRk.....', '.........kk.....']
    ]
  };
  var PET_PAL = {
    corgi: { k: '#2a1a10', O: '#d88a3a', w: '#f4efe6', e: '#111111' },
    cow: { k: '#3a1e0e', O: '#c2662e', d: '#5a2e14', w: '#f0e6c8' },
    dragon: { k: '#3a0a0a', R: '#c8102e', e: '#ffd23a', y: '#ffb02e' }
  };

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }
  function lighten(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r + (255 - r) * f) + ',' + Math.round(g + (255 - g) * f) + ',' + Math.round(b + (255 - b) * f) + ')';
  }

  var cache = {};
  function bake(key, rows, pal, flash) {
    var c = cache[key];
    if (c) return c;
    var w = 16, h = rows.length;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var i = 0; i < w; i++) {
        var ch = row.charAt(i);
        if (!ch || ch === '.') continue;
        var col = flash ? (ch === 'k' ? '#ffffff' : '#ffffff') : pal[ch];
        if (!col) continue;
        x.fillStyle = col; x.fillRect(i, y, 1, 1);
      }
    }
    cache[key] = c;
    return c;
  }

  function enemyPalette(def) {
    return { k: '#141414', S: def.skin, B: def.color, D: shade(def.color, 0.65), e: def.elite ? '#ffea00' : '#ff2a2a',
      m: '#4a0a0a', P: '#33333f', b: '#7a1414', G: lighten(def.skin, 0.35), g: '#9be03a' };
  }

  function overlay(rows, hat) {
    var out = rows.slice();
    for (var r in hat) {
      var pat = hat[r], base = out[r] || '................', s = '';
      for (var i = 0; i < 16; i++) { var ch = pat.charAt(i); s += (ch && ch !== '.') ? ch : base.charAt(i); }
      out[r] = s;
    }
    return out;
  }

  function draw(ctx, img, x, y, h, flip) {
    var w = h * img.width / img.height;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  ZN.Sprites = {
    has: function (type) { return !!SHAPE[type]; },
    // Draws an enemy with its feet at (e.x, e.y + r*0.9)
    enemy: function (ctx, e, time) {
      var sh = SHAPE[e.type], frame = (Math.floor(e.anim / 1.6) % 2 + 2) % 2;
      var key = e.type + '|' + e.def.color + '|' + frame;
      var rows = BODIES[sh[0]].concat(LEGS[sh[1]][frame]);
      var img = bake(key, rows, enemyPalette(e.def));
      var flip = Math.cos(e.dir || 0) < 0, H = e.r * 2.9, fy = e.y + e.r * 0.95;
      var bob = Math.abs(Math.sin(e.anim)) * e.r * 0.06;
      draw(ctx, img, e.x, fy - bob, H, flip);
      if (e.flash > 0) {
        ctx.globalAlpha = 0.75; draw(ctx, bake(key + '|f', rows, null, true), e.x, fy - bob, H, flip); ctx.globalAlpha = 1;
      }
    },
    player: function (ctx, ch, p, x, y, time) {
      var frame = p.moving ? (Math.floor(p.walk / 2.2) % 2) : 1;
      var key = 'player|' + ch.id + '|' + frame;
      var img = cache[key];
      if (!img) {
        var rows = overlay(BODIES.player.concat(LEGS.player[frame]), HATS[ch.hat] || HATS.flat);
        img = bake(key, rows, { k: '#141414', S: '#f1c9a0', e: '#1a1a1a', C: ch.coat, r: ch.id === 'beefeater' ? '#ffd23a' : '#c8102e',
          P: '#2b2f3a', H: ch.hatColor, w: '#ffffff' });
      }
      draw(ctx, img, x, y + 13, 42, p.fx < -0.05);
    },
    pet: function (ctx, pet) {
      var frame = pet.moving || pet.type === 'dragon' ? (Math.floor(pet.anim / (pet.type === 'dragon' ? 2.5 : 1.5)) % 2) : 0;
      var key = 'pet|' + pet.type + '|' + frame;
      var img = bake(key, PETS[pet.type][frame], PET_PAL[pet.type]);
      var h = pet.type === 'cow' ? 30 : pet.type === 'dragon' ? 30 : 22;
      draw(ctx, img, pet.x, pet.y + h * 0.45, h, pet.dir < 0);
    },
    // for preview/testing
    _grids: { BODIES: BODIES, LEGS: LEGS, HATS: HATS, PETS: PETS }
  };

  ZN.drawPet = function (g, ctx, pet) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    var sy = pet.type === 'dragon' ? pet.y + 30 : pet.y + 12;
    ctx.beginPath(); ctx.ellipse(pet.x, sy, pet.type === 'cow' ? 14 : 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ZN.Sprites.pet(ctx, pet);
    if (pet.mode === 'charge') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pet.x - pet.cx * 20, pet.y - pet.cy * 20); ctx.lineTo(pet.x - pet.cx * 45, pet.y - pet.cy * 45); ctx.stroke();
    }
  };
})(window.ZN);
