// Zombie Nation - mission engine: player, zombies, waves, pickups, rendering
'use strict';
(function (ZN) {
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  ZN.util = { rand: rand, clamp: clamp, TAU: TAU,
    angDiff: function (a, b) { var d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; } };

  var GRID = 64;
  var nextId = 1;

  function Game(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.county = opts.county;
    this.waves = opts.waves;
    this.tier = opts.tier;
    this.style = ZN.REGION_STYLE[opts.county.region] || ZN.REGION_STYLE.se;
    this.seed = (opts.county.id.split('').reduce(function (a, c) { return a * 31 + c.charCodeAt(0); }, 7)) >>> 0;

    this.time = 0; this.waveIdx = 0; this.waveTime = 0;
    this.waveDur = this.waves === 1 ? ZN.FIRST_WAVE_DURATION : ZN.WAVE_DURATION;
    this.bossPhase = false; this.boss = null; this.victory = false; this.ended = false; this.endT = 0;
    this.spawnAcc = 0; this.swarmT = 18;
    this.paused = false; this.modal = false; this.pendingLevels = 0;
    this.kills = 0; this.runCoins = 0; this.runXp = 0;

    this.enemies = []; this.projectiles = []; this.enemyShots = []; this.pools = [];
    this.pickups = []; this.effects = []; this.texts = []; this.grid = new Map();
    this.weapons = []; this.passives = [];

    this.player = { x: 0, y: 0, r: 13, hp: 100, fx: 1, fy: 0, level: 1, xp: 0, xpNext: 5, hurtT: 0, iframes: 0, walk: 0, moving: false };
    this.input = { x: 0, y: 0 }; this.keys = {}; this.joy = null;
    this.computeStats();
    this.player.hp = this.stat.maxHp;
    this.revivals = this.stat.revival;
    this.addWeapon('pistol');

    this.hudT = 0;
    this.resize();
    this.bindInput();
  }
  ZN.Game = Game;
  var G = Game.prototype;

  // ------------------------------------------------------------------ stats
  G.computeStats = function () {
    var sh = ZN.Save.data.shop, r = function (k) { return sh[k] || 0; };
    var s = { maxHp: 100, regen: 0, speed: 130, might: 1, armor: 0, magnet: 65, amount: 0, cooldown: 1,
      area: 1, duration: 1, luck: 1, growth: 1, greed: 1, crit: 0.03, revival: 0 };
    s.might += 0.05 * r('might'); s.maxHp *= 1 + 0.1 * r('maxHp'); s.armor += r('armor');
    s.regen += 0.1 * r('regen'); s.speed *= 1 + 0.05 * r('speed'); s.cooldown *= 1 - 0.03 * r('cooldown');
    s.area *= 1 + 0.05 * r('area'); s.duration *= 1 + 0.1 * r('duration'); s.amount += r('amount');
    s.magnet *= 1 + 0.25 * r('magnet'); s.luck += 0.1 * r('luck'); s.growth += 0.05 * r('growth');
    s.greed += 0.1 * r('greed'); s.revival = r('revival');
    this.passives.forEach(function (p) { ZN.PASSIVES[p.id].apply(s, p.level); });
    var old = this.stat;
    this.stat = s;
    if (old && s.maxHp > old.maxHp) this.player.hp += s.maxHp - old.maxHp;
    this.player.hp = Math.min(this.player.hp, s.maxHp);
  };

  // ------------------------------------------------------------ inventory
  G.findWeapon = function (id) { for (var i = 0; i < this.weapons.length; i++) if (this.weapons[i].id === id) return this.weapons[i]; return null; };
  G.findPassive = function (id) { for (var i = 0; i < this.passives.length; i++) if (this.passives[i].id === id) return this.passives[i]; return null; };
  G.addWeapon = function (id) { var w = { id: id, level: 1, t: 0.3, s: {} }; this.weapons.push(w); return w; };
  G.addPassive = function (id) { this.passives.push({ id: id, level: 1 }); this.computeStats(); };

  G.eligibleEvolutions = function () {
    var g = this;
    return ZN.EVOLUTIONS.filter(function (ev) {
      if (g.findWeapon(ev.into)) return false;
      var okW = ev.from.every(function (id) { var w = g.findWeapon(id); return w && w.level >= ZN.WEAPONS[id].max; });
      return okW && (!ev.passive || g.findPassive(ev.passive));
    });
  };

  G.evolve = function (ev) {
    var idx = this.weapons.length, g = this;
    ev.from.forEach(function (id) {
      var i = g.weapons.indexOf(g.findWeapon(id));
      if (i >= 0) { idx = Math.min(idx, i); g.weapons.splice(i, 1); }
    });
    this.weapons.splice(idx, 0, { id: ev.into, level: 1, t: 0.2, s: {} });
    this.effects.push({ kind: 'ring', x: this.player.x, y: this.player.y, r: 10, maxR: 260, t: 0, T: 0.8, color: ZN.WEAPONS[ev.into].color });
    ZN.Audio.play('evolve');
    this.banner(ZN.WEAPONS[ev.into].name.toUpperCase(), 'Weapon evolved!');
  };

  // Items that can no longer appear because they were consumed by an owned evolution
  G.consumedSet = function () {
    var g = this, set = {};
    ZN.EVOLUTIONS.forEach(function (ev) { if (g.findWeapon(ev.into)) ev.from.forEach(function (id) { set[id] = true; }); });
    return set;
  };

  G.rollOptions = function () {
    var g = this, unlocked = ZN.Save.unlockedSet(), consumed = this.consumedSet(), pool = [];
    var evos = this.eligibleEvolutions().map(function (ev) {
      var d = ZN.WEAPONS[ev.into];
      return { kind: 'evolve', ev: ev, id: ev.into, icon: d.icon, color: d.color, title: d.name, tag: 'EVOLUTION', desc: d.levels[0] };
    });
    this.weapons.forEach(function (w) {
      var d = ZN.WEAPONS[w.id];
      if (w.level < d.max) pool.push({ kind: 'upWeapon', id: w.id, icon: d.icon, color: d.color, title: d.name, tag: 'Level ' + (w.level + 1), desc: d.levels[w.level], wt: 10 });
    });
    if (this.weapons.length < ZN.MAX_WEAPON_SLOTS) Object.keys(ZN.WEAPONS).forEach(function (id) {
      var d = ZN.WEAPONS[id];
      if (d.evolved || !unlocked[id] || consumed[id] || g.findWeapon(id)) return;
      pool.push({ kind: 'newWeapon', id: id, icon: d.icon, color: d.color, title: d.name, tag: 'NEW · ' + d.kind, desc: d.levels[0], wt: 8 });
    });
    this.passives.forEach(function (p) {
      var d = ZN.PASSIVES[p.id];
      if (p.level < ZN.PASSIVE_MAX) pool.push({ kind: 'upPassive', id: p.id, icon: d.icon, color: '#8fd18f', title: d.name, tag: 'Level ' + (p.level + 1), desc: d.desc, wt: 8 });
    });
    if (this.passives.length < ZN.MAX_PASSIVE_SLOTS) Object.keys(ZN.PASSIVES).forEach(function (id) {
      var d = ZN.PASSIVES[id];
      if (!unlocked[id] || g.findPassive(id)) return;
      pool.push({ kind: 'newPassive', id: id, icon: d.icon, color: '#8fd18f', title: d.name, tag: 'NEW · Passive', desc: d.desc + evoHint(id), wt: 6 });
    });
    var n = Math.random() < 0.08 + (this.stat.luck - 1) * 0.6 ? 4 : 3;
    var out = evos.slice(0, n);
    while (out.length < n && pool.length) {
      var tot = pool.reduce(function (a, o) { return a + o.wt; }, 0), r = Math.random() * tot, i = 0;
      for (; i < pool.length; i++) { r -= pool[i].wt; if (r <= 0) break; }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    if (!out.length) {
      out.push({ kind: 'gold', icon: '💰', color: '#ffd166', title: 'Bag of Coins', tag: 'BONUS', desc: '+25 coins' });
      out.push({ kind: 'heal', icon: '🥧', color: '#ff8a80', title: 'Cornish Pasty', tag: 'BONUS', desc: 'Restore 50% HP' });
    }
    return out;
  };

  function evoHint(pid) {
    var ev = ZN.EVOLUTIONS.filter(function (e) { return e.passive === pid; })[0];
    return ev ? ' (evolves ' + ZN.WEAPONS[ev.from[0]].name + ')' : '';
  }

  G.applyOption = function (o) {
    if (o.kind === 'evolve') this.evolve(o.ev);
    else if (o.kind === 'newWeapon') this.addWeapon(o.id);
    else if (o.kind === 'upWeapon') this.findWeapon(o.id).level++;
    else if (o.kind === 'newPassive') this.addPassive(o.id);
    else if (o.kind === 'upPassive') { this.findPassive(o.id).level++; this.computeStats(); }
    else if (o.kind === 'gold') this.runCoins += 25;
    else if (o.kind === 'heal') this.player.hp = Math.min(this.stat.maxHp, this.player.hp + this.stat.maxHp * 0.5);
  };

  // Random upgrades for a treasure chest; returns list of reward descriptions
  G.openChest = function () {
    var evs = this.eligibleEvolutions(), rewards = [];
    if (evs.length) {
      var ev = evs[0];
      this.evolve(ev);
      var d = ZN.WEAPONS[ev.into];
      rewards.push({ icon: d.icon, color: d.color, title: d.name, desc: 'EVOLVED! ' + d.levels[0] });
    } else {
      var count = Math.random() < 0.15 * this.stat.luck ? 3 : 1;
      for (var i = 0; i < count; i++) {
        var opts = this.rollOptions().filter(function (o) { return o.kind === 'upWeapon' || o.kind === 'upPassive'; });
        if (!opts.length) break;
        var o = opts[0];
        this.applyOption(o);
        rewards.push({ icon: o.icon, color: o.color, title: o.title, desc: o.tag + ': ' + o.desc });
      }
    }
    var coins = Math.round(rand(15, 35) * this.stat.greed);
    this.runCoins += coins;
    rewards.push({ icon: '💰', color: '#ffd166', title: coins + ' coins', desc: 'Loot from the horde' });
    return rewards;
  };

  // ------------------------------------------------------------- canvas
  G.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    this.scale = Math.min(w, h) / 430;
    this.viewW = w / this.scale; this.viewH = h / this.scale;
    this.spawnR = Math.sqrt(this.viewW * this.viewW + this.viewH * this.viewH) / 2 + 40;
  };

  G.bindInput = function () {
    var g = this, c = this.canvas;
    this._h = {
      down: function (e) {
        if (g.joy) return;
        g.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
      },
      move: function (e) { if (g.joy && e.pointerId === g.joy.id) { g.joy.x = e.clientX; g.joy.y = e.clientY; e.preventDefault(); } },
      up: function (e) { if (g.joy && e.pointerId === g.joy.id) g.joy = null; },
      kd: function (e) { g.keys[e.key.toLowerCase()] = true; },
      ku: function (e) { g.keys[e.key.toLowerCase()] = false; },
      rs: function () { g.resize(); }
    };
    c.addEventListener('pointerdown', this._h.down);
    c.addEventListener('pointermove', this._h.move);
    c.addEventListener('pointerup', this._h.up);
    c.addEventListener('pointercancel', this._h.up);
    window.addEventListener('keydown', this._h.kd);
    window.addEventListener('keyup', this._h.ku);
    window.addEventListener('resize', this._h.rs);
  };

  G.destroy = function () {
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    var c = this.canvas;
    c.removeEventListener('pointerdown', this._h.down);
    c.removeEventListener('pointermove', this._h.move);
    c.removeEventListener('pointerup', this._h.up);
    c.removeEventListener('pointercancel', this._h.up);
    window.removeEventListener('keydown', this._h.kd);
    window.removeEventListener('keyup', this._h.ku);
    window.removeEventListener('resize', this._h.rs);
  };

  G.start = function () {
    var g = this; this.last = performance.now();
    this.banner(this.county.name.toUpperCase(), this.waves === 1 ? 'Survive the wave and slay the horde boss' : 'Survive ' + this.waves + ' waves, then slay the horde boss');
    ZN.Audio.play('wave');
    function frame(t) {
      if (g.ended) return;
      var dt = Math.min((t - g.last) / 1000, 0.05); g.last = t;
      if (!g.paused && !g.modal) g.update(dt);
      g.render();
      g.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };

  G.banner = function (title, sub) { if (this.opts.onBanner) this.opts.onBanner(title, sub); };

  // ----------------------------------------------------------- difficulty
  G.effLevel = function () { return this.waveIdx + Math.floor(this.tier / 4); };
  G.progress = function () { return this.bossPhase ? 1 : clamp(this.waveTime / this.waveDur, 0, 1); };
  G.hpMult = function () { return (1 + 0.04 * this.tier) * (1 + 0.35 * this.waveIdx) * (1 + 0.3 * this.progress()); };
  G.dmgMult = function () { return 1 + 0.03 * this.tier + 0.06 * this.waveIdx; };

  G.pickType = function () {
    var E = this.effLevel(), table = [['shambler', 10]];
    if (E >= 1) table.push(['runner', 4]);
    if (E >= 2) table.push(['brute', 1.5 + E * 0.1]);
    if (E >= 3) table.push(['spitter', 1.2]);
    if (E >= 4) table.push(['bloater', 2]);
    var tot = table.reduce(function (a, t) { return a + t[1]; }, 0), r = Math.random() * tot;
    for (var i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) return table[i][0]; }
    return 'shambler';
  };

  G.spawnEnemy = function (type, x, y, hpScale) {
    var def = ZN.ENEMIES[type];
    if (x === undefined) {
      var a = Math.random() * TAU;
      x = this.player.x + Math.cos(a) * this.spawnR; y = this.player.y + Math.sin(a) * this.spawnR;
    }
    var hp = def.hp * this.hpMult() * (hpScale || 1);
    var e = { id: nextId++, type: type, def: def, x: x, y: y, hp: hp, maxHp: hp, r: def.r,
      spd: def.speed * rand(0.88, 1.12) * (1 + Math.min(this.tier, 20) * 0.01), atkT: 0, slowT: 0, freezeT: 0,
      burnT: 0, burnDps: 0, burnTick: 0, kbx: 0, kby: 0, flash: 0, hc: {}, shootT: rand(1.5, 3), anim: Math.random() * TAU,
      dmg: def.dmg * this.dmgMult(), chargeT: 0, windT: 0, specT: 4, cdx: 0, cdy: 0, dead: false };
    this.enemies.push(e);
    return e;
  };

  G.spawnTick = function (dt) {
    var w = this.waveIdx, prog = this.progress();
    var rate = (2.2 + 0.5 * w + 0.05 * this.tier) * (1 + 0.7 * prog);
    if (this.bossPhase) rate *= 0.5;
    var cap = Math.min(110 + 18 * w + 4 * this.tier, 320);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < cap) this.spawnEnemy(this.pickType());
    }
    this.swarmT -= dt;
    if (this.effLevel() >= 2 && this.swarmT <= 0) {
      this.swarmT = rand(14, 22);
      var a = Math.random() * TAU, n = 8 + Math.min(w * 2, 24);
      var cx = this.player.x + Math.cos(a) * this.spawnR, cy = this.player.y + Math.sin(a) * this.spawnR;
      for (var i = 0; i < n; i++) this.spawnEnemy('crawler', cx + rand(-40, 40), cy + rand(-40, 40));
      this.banner('', 'A swarm of crawlers approaches!');
    }
  };

  G.waveTick = function (dt) {
    if (this.bossPhase) return;
    this.waveTime += dt;
    if (this.waveTime < this.waveDur) return;
    if (this.waveIdx < this.waves - 1) {
      this.waveIdx++; this.waveTime = 0; this.waveDur = ZN.WAVE_DURATION;
      var e = this.spawnEnemy('elite', undefined, undefined, 10);
      e.spd *= 1.1;
      this.banner('WAVE ' + (this.waveIdx + 1) + ' / ' + this.waves, 'An elite zombie carries treasure!');
      ZN.Audio.play('wave');
    } else {
      this.bossPhase = true;
      var bossScale = 1 + 0.12 * this.waves;
      this.boss = this.spawnEnemy('boss', undefined, undefined, bossScale);
      this.banner('HORDE BOSS', 'Slay ' + ZN.ENEMIES.boss.name + ' to liberate ' + this.county.name);
      ZN.Audio.play('boss');
    }
  };

  // ---------------------------------------------------------- spatial grid
  G.rebuildGrid = function () {
    var grid = this.grid; grid.clear();
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      var key = ((Math.floor(e.x / GRID) & 0xffff) << 16) | (Math.floor(e.y / GRID) & 0xffff);
      var cell = grid.get(key);
      if (!cell) grid.set(key, [e]); else cell.push(e);
    }
  };

  // Calls fn(e) for every live enemy whose body overlaps circle (x,y,r)
  G.queryEnemies = function (x, y, r, fn) {
    var x0 = Math.floor((x - r - 40) / GRID), x1 = Math.floor((x + r + 40) / GRID);
    var y0 = Math.floor((y - r - 40) / GRID), y1 = Math.floor((y + r + 40) / GRID);
    for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) {
      var cell = this.grid.get(((cx & 0xffff) << 16) | (cy & 0xffff));
      if (!cell) continue;
      for (var i = 0; i < cell.length; i++) {
        var e = cell[i];
        if (e.dead) continue;
        var dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) fn(e);
      }
    }
  };

  G.nearestEnemy = function (x, y, maxR, exclude) {
    var best = null, bd = maxR * maxR;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || (exclude && exclude[e.id])) continue;
      var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  G.randomEnemyOnScreen = function () {
    var p = this.player, hw = this.viewW / 2, hh = this.viewH / 2, list = [];
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.dead && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh) list.push(e);
    }
    return list.length ? list[(Math.random() * list.length) | 0] : null;
  };

  // --------------------------------------------------------------- damage
  // opts: kb (knockback px), kx/ky (direction), slow, freeze, burn (dps), color, silent
  G.damage = function (e, base, opts) {
    if (e.dead) return;
    opts = opts || {};
    var dmg = base * this.stat.might, crit = Math.random() < this.stat.crit;
    if (crit) dmg *= 2;
    e.hp -= dmg; e.flash = 0.08;
    if (opts.kb) {
      var kx = opts.kx, ky = opts.ky;
      if (kx === undefined) { kx = e.x - this.player.x; ky = e.y - this.player.y; }
      var l = Math.sqrt(kx * kx + ky * ky) || 1, k = opts.kb / (e.def.boss ? 6 : e.def.elite ? 3 : 1);
      e.kbx += kx / l * k; e.kby += ky / l * k;
    }
    if (opts.slow) e.slowT = Math.max(e.slowT, opts.slow * this.stat.duration);
    if (opts.freeze && !e.def.boss) e.freezeT = Math.max(e.freezeT, opts.freeze * this.stat.duration);
    if (opts.burn) { e.burnT = 3 * this.stat.duration; e.burnDps = Math.max(e.burnDps, opts.burn * this.stat.might); }
    if (this.texts.length < 70) this.texts.push({ x: e.x + rand(-6, 6), y: e.y - e.r, t: 0, v: Math.round(dmg), crit: crit, color: opts.color });
    if (!opts.silent) ZN.Audio.play('hit', 70);
    if (e.hp <= 0) this.kill(e);
  };

  G.kill = function (e) {
    if (e.dead) return;
    e.dead = true; this.kills++;
    var def = e.def;
    this.dropGem(e.x, e.y, def.xp * (1 + this.waveIdx * 0.08));
    if (Math.random() < 0.035 * this.stat.luck || def.elite) this.pickups.push({ type: 'coin', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), v: def.elite ? 10 : (1 + (Math.random() * 3 | 0)) });
    if (Math.random() < 0.004 * this.stat.luck) this.pickups.push({ type: 'heal', x: e.x, y: e.y });
    if (Math.random() < 0.0015 * this.stat.luck) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (def.elite) this.pickups.push({ type: 'chest', x: e.x, y: e.y });
    if (def.explodes) {
      this.effects.push({ kind: 'boom', x: e.x, y: e.y, r: 64, t: 0, T: 0.4, color: '#c8d84a' });
      var p = this.player, dx = p.x - e.x, dy = p.y - e.y;
      if (dx * dx + dy * dy < 64 * 64) this.hurtPlayer(e.dmg * 2);
      ZN.Audio.play('boom', 120);
    }
    this.effects.push({ kind: 'splat', x: e.x, y: e.y, r: e.r, t: 0, T: 0.5, color: def.color });
    if (def.boss) this.winMission();
  };

  G.dropGem = function (x, y, v) {
    var gems = 0, target = null;
    for (var i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].type === 'gem') { gems++; if (!target) target = this.pickups[i]; }
    if (gems > 300 && target) { target.v += v; return; }
    this.pickups.push({ type: 'gem', x: x, y: y, v: v });
  };

  G.hurtPlayer = function (dmg) {
    var p = this.player;
    if (p.iframes > 0 || this.victory) return;
    dmg = Math.max(1, dmg - this.stat.armor);
    p.hp -= dmg; p.hurtT = 0.2;
    ZN.Audio.play('hurt', 150);
    if (p.hp <= 0) {
      if (this.revivals > 0) {
        this.revivals--; p.hp = this.stat.maxHp * 0.5; p.iframes = 2.5;
        var g = this;
        this.queryEnemies(p.x, p.y, 220, function (e) { g.damage(e, 40, { kb: 140, silent: true }); });
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 240, t: 0, T: 0.7, color: '#ffffff' });
        this.banner('SECOND WIND', 'You refuse to die!');
      } else {
        p.hp = 0; this.loseMission();
      }
    }
  };

  G.winMission = function () {
    if (this.victory) return;
    this.victory = true; this.endT = 3;
    var g = this;
    this.enemies.forEach(function (e) { if (!e.dead) { e.dead = true; g.effects.push({ kind: 'splat', x: e.x, y: e.y, r: e.r, t: 0, T: 0.5, color: e.def.color }); } });
    this.pickups.forEach(function (pk) { if (pk.type === 'gem' || pk.type === 'coin') pk.mag = true; });
    this.banner(this.county.name.toUpperCase() + ' LIBERATED', 'The horde is broken!');
    ZN.Audio.play('win');
  };

  G.loseMission = function () {
    if (this.endT > 0 || this.victory) return;
    this.dying = true; this.endT = 1.6;
    this.banner('YOU HAVE FALLEN', this.county.name + ' remains overrun');
    ZN.Audio.play('lose');
  };

  G.finish = function () {
    this.ended = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.opts.onEnd({ win: this.victory, kills: this.kills, coins: this.runCoins, xp: Math.round(this.runXp),
      level: this.player.level, time: this.time, wavesDone: this.victory ? this.waves : this.waveIdx });
  };

  // ----------------------------------------------------------------- update
  G.readInput = function () {
    var ix = 0, iy = 0, k = this.keys;
    if (this.joy) {
      var dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, l = Math.sqrt(dx * dx + dy * dy), max = 46;
      if (l > 4) { var m = Math.min(l, max) / max; ix = dx / l * m; iy = dy / l * m; }
      if (l > max * 1.6) { this.joy.ox = this.joy.x - dx / l * max * 1.6; this.joy.oy = this.joy.y - dy / l * max * 1.6; }
    } else {
      if (k.a || k.arrowleft) ix -= 1; if (k.d || k.arrowright) ix += 1;
      if (k.w || k.arrowup) iy -= 1; if (k.s || k.arrowdown) iy += 1;
      var kl = Math.sqrt(ix * ix + iy * iy); if (kl > 0) { ix /= kl; iy /= kl; }
    }
    this.input.x = ix; this.input.y = iy;
  };

  G.update = function (dt) {
    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) { this.finish(); return; }
      if (this.dying) { this.updateEffects(dt); return; }
    }
    this.time += dt;
    var p = this.player, st = this.stat;
    this.readInput();
    var il = Math.sqrt(this.input.x * this.input.x + this.input.y * this.input.y);
    p.moving = il > 0.05;
    if (p.moving) {
      p.x += this.input.x * st.speed * dt; p.y += this.input.y * st.speed * dt;
      p.fx = this.input.x / il; p.fy = this.input.y / il; p.walk += dt * 10;
    }
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.iframes > 0) p.iframes -= dt;

    if (!this.victory) { this.waveTick(dt); this.spawnTick(dt); }
    this.rebuildGrid();
    this.updateEnemies(dt);
    this.rebuildGrid();

    if (!this.victory) {
      for (var i = 0; i < this.weapons.length; i++) {
        var w = this.weapons[i], logic = ZN.WEAPON_LOGIC[w.id];
        if (logic) logic(this, w, ZN.WEAPONS[w.id].stats(w.level), dt);
      }
    }
    ZN.runGameTimers(this);
    this.updateProjectiles(dt);
    this.updatePools(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);

    var alive = [];
    for (var j = 0; j < this.enemies.length; j++) if (!this.enemies[j].dead) alive.push(this.enemies[j]);
    this.enemies = alive;

    if (this.pendingLevels > 0 && !this.modal && !this.victory && !this.dying) {
      this.modal = true;
      var g = this;
      ZN.Audio.play('levelup');
      this.opts.onLevelUp(this.rollOptions(), function (o) {
        g.applyOption(o); g.pendingLevels--; g.modal = false; g.last = performance.now();
      });
    }

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; if (this.opts.onHud) this.opts.onHud(this); }
  };

  G.updateEnemies = function (dt) {
    var p = this.player, g = this;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      e.anim += dt * 6;
      if (e.flash > 0) e.flash -= dt;
      if (e.atkT > 0) e.atkT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt; e.burnTick -= dt;
        if (e.burnTick <= 0) { e.burnTick = 0.5; e.hp -= e.burnDps * 0.5; e.flash = 0.05; if (e.hp <= 0) { this.kill(e); continue; } }
      } else e.burnDps = 0;

      var dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / d, uy = dy / d;
      // despawn & respawn enemies that drift too far behind
      if (d > this.spawnR * 1.6 && !e.def.boss && !e.def.elite) {
        var a = Math.atan2(this.input.y || rand(-1, 1), this.input.x || rand(-1, 1)) + rand(-0.8, 0.8);
        e.x = p.x + Math.cos(a) * this.spawnR; e.y = p.y + Math.sin(a) * this.spawnR; continue;
      }
      var sp = e.spd * (e.slowT > 0 ? 0.5 : 1);
      if (e.freezeT > 0) { e.freezeT -= dt; sp = 0; }
      var mx = ux, my = uy;
      if (e.def.ranged) {
        if (d < 150) { mx = -ux; my = -uy; sp *= 0.6; } else if (d < 220) { sp *= 0.15; }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 280 && e.freezeT <= 0 && this.enemyShots.length < 25) {
          e.shootT = rand(3.5, 5);
          this.enemyShots.push({ x: e.x, y: e.y, vx: ux * 125, vy: uy * 125, r: 6, dmg: e.dmg, life: 3 });
        }
      }
      if (e.def.boss) sp = this.bossAI(e, dt, ux, uy, d, sp);
      if (e.chargeT > 0) { mx = e.cdx; my = e.cdy; }
      e.x += (mx * sp + e.kbx) * dt; e.y += (my * sp + e.kby) * dt;
      e.kbx *= Math.pow(0.02, dt); e.kby *= Math.pow(0.02, dt);
      e.dir = Math.atan2(my, mx);

      // separation from neighbours
      this.queryEnemies(e.x, e.y, e.r, function (o) {
        if (o === e || o.id < e.id) return;
        var sx = o.x - e.x, sy = o.y - e.y, sd = Math.sqrt(sx * sx + sy * sy) || 0.01, overlap = e.r + o.r - sd;
        if (overlap > 0) {
          var wE = o.def.boss ? 1 : e.def.boss ? 0 : 0.5, push = overlap * 0.5;
          e.x -= sx / sd * push * (wE * 2); e.y -= sy / sd * push * (wE * 2);
          o.x += sx / sd * push * ((1 - wE) * 2); o.y += sy / sd * push * ((1 - wE) * 2);
        }
      });

      if (d < e.r + p.r && e.atkT <= 0 && e.freezeT <= 0) { e.atkT = 0.7; g.hurtPlayer(e.dmg); }
    }
  };

  G.bossAI = function (e, dt, ux, uy, d, sp) {
    if (e.windT > 0) {
      e.windT -= dt;
      if (e.windT <= 0) { e.chargeT = 0.7; }
      return 0;
    }
    if (e.chargeT > 0) { e.chargeT -= dt; return sp * 5; }
    e.specT -= dt;
    if (e.specT <= 0) {
      e.specT = rand(4, 6);
      if (Math.random() < 0.6 && d < 420) { e.windT = 0.7; e.cdx = ux; e.cdy = uy; }
      else {
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * TAU;
          this.spawnEnemy(Math.random() < 0.5 ? 'runner' : 'shambler', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
        }
        this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 90, t: 0, T: 0.5, color: '#c45a4a' });
      }
    }
    return sp;
  };

  G.updateProjectiles = function (dt) {
    var g = this, out = [];
    for (var i = 0; i < this.projectiles.length; i++) {
      var pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.grow) pr.r += pr.grow * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.drag) { var f = Math.pow(pr.drag, dt); pr.vx *= f; pr.vy *= f; }
      if (pr.life <= 0) continue;
      this.queryEnemies(pr.x, pr.y, pr.r, function (e) {
        if (pr.pierce <= 0 || pr.hit[e.id]) return;
        pr.hit[e.id] = 1; pr.pierce--;
        g.damage(e, pr.dmg, { kb: pr.kb || 0, kx: pr.vx, ky: pr.vy, burn: pr.burn, slow: pr.slow, silent: pr.silent });
      });
      if (pr.pierce > 0) out.push(pr);
    }
    this.projectiles = out;

    var p = this.player, shots = [];
    for (var j = 0; j < this.enemyShots.length; j++) {
      var s = this.enemyShots[j];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      var dx = s.x - p.x, dy = s.y - p.y;
      if (dx * dx + dy * dy < (s.r + p.r) * (s.r + p.r)) { this.hurtPlayer(s.dmg); continue; }
      if (s.life > 0) shots.push(s);
    }
    this.enemyShots = shots;
  };

  G.updatePools = function (dt) {
    var g = this, out = [];
    for (var i = 0; i < this.pools.length; i++) {
      var pl = this.pools[i];
      pl.life -= dt; pl.tickT -= dt;
      if (pl.tickT <= 0) {
        pl.tickT = pl.tick;
        this.queryEnemies(pl.x, pl.y, pl.r, function (e) { g.damage(e, pl.dmg, { burn: pl.burn, silent: true }); });
      }
      if (pl.life > 0) out.push(pl);
    }
    this.pools = out;
  };

  G.updatePickups = function (dt) {
    var p = this.player, mag = this.stat.magnet, out = [];
    for (var i = 0; i < this.pickups.length; i++) {
      var k = this.pickups[i], dx = p.x - k.x, dy = p.y - k.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (k.type !== 'chest' && d < mag) k.mag = true;
      if (k.mag) { k.sp = Math.min((k.sp || 120) + 900 * dt, 900); k.x += dx / d * k.sp * dt; k.y += dy / d * k.sp * dt; }
      if (d < p.r + 10) { this.collect(k); continue; }
      out.push(k);
    }
    this.pickups = out;
  };

  G.collect = function (k) {
    var p = this.player;
    if (k.type === 'gem') {
      this.runXp += k.v;
      p.xp += k.v * this.stat.growth;
      while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext; p.level++; this.pendingLevels++;
        p.xpNext = Math.round(5 + (p.level - 1) * 6 + Math.max(0, p.level - 20) * 6);
      }
      ZN.Audio.play('gem', 50);
    } else if (k.type === 'coin') {
      this.runCoins += k.v * this.stat.greed; ZN.Audio.play('coin', 60);
    } else if (k.type === 'heal') {
      p.hp = Math.min(this.stat.maxHp, p.hp + 30);
      this.texts.push({ x: p.x, y: p.y - 20, t: 0, v: '+30', color: '#7dff8a' });
    } else if (k.type === 'magnet') {
      this.pickups.forEach(function (o) { if (o.type === 'gem') o.mag = true; });
    } else if (k.type === 'chest') {
      if (this.victory) return;
      var g = this;
      this.modal = true;
      var rewards = this.openChest();
      this.opts.onChest(rewards, function () { g.modal = false; g.last = performance.now(); });
    }
  };

  G.updateEffects = function (dt) {
    var out = [], i;
    for (i = 0; i < this.effects.length; i++) { var f = this.effects[i]; f.t += dt; if (f.t < f.T) out.push(f); }
    this.effects = out;
    var tx = [];
    for (i = 0; i < this.texts.length; i++) { var t = this.texts[i]; t.t += dt; t.y -= 30 * dt; if (t.t < 0.6) tx.push(t); }
    this.texts = tx;
  };

  // ----------------------------------------------------------------- render
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  G.render = function () {
    var ctx = this.ctx, p = this.player, k = this.scale * this.dpr;
    var W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.style.ground; ctx.fillRect(0, 0, W, H);
    var camX = p.x - this.viewW / 2, camY = p.y - this.viewH / 2;
    ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);

    this.drawGround(camX, camY);
    var i;
    for (i = 0; i < this.pools.length; i++) this.drawPool(this.pools[i]);
    for (i = 0; i < this.effects.length; i++) if (this.effects[i].kind === 'splat') this.drawEffect(this.effects[i]);
    for (i = 0; i < this.pickups.length; i++) this.drawPickup(this.pickups[i]);
    var vx0 = camX - 60, vx1 = camX + this.viewW + 60, vy0 = camY - 60, vy1 = camY + this.viewH + 60;
    for (i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.x > vx0 && e.x < vx1 && e.y > vy0 && e.y < vy1) this.drawEnemy(e);
    }
    this.drawPlayer();
    for (i = 0; i < this.projectiles.length; i++) this.drawProjectile(this.projectiles[i]);
    ctx.fillStyle = '#9be03a';
    for (i = 0; i < this.enemyShots.length; i++) { var s = this.enemyShots[i]; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    for (i = 0; i < this.weapons.length; i++) if (ZN.WEAPON_DRAW[this.weapons[i].id]) ZN.WEAPON_DRAW[this.weapons[i].id](this, ctx, this.weapons[i]);
    for (i = 0; i < this.effects.length; i++) if (this.effects[i].kind !== 'splat') this.drawEffect(this.effects[i]);
    this.drawTexts();

    // screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.boss && !this.boss.dead) this.drawBossArrow();
    if (this.joy) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(this.joy.ox, this.joy.oy, 46, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.7;
      var jx = this.joy.ox + this.input.x * 46, jy = this.joy.oy + this.input.y * 46;
      ctx.beginPath(); ctx.arc(jx, jy, 20, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (p.hurtT > 0) { ctx.fillStyle = 'rgba(200,0,0,' + (p.hurtT * 0.9) + ')'; ctx.fillRect(0, 0, this.cssW, this.cssH); }
    if (this.dying) { ctx.fillStyle = 'rgba(60,0,0,' + clamp(1 - this.endT / 1.6, 0, 0.7) + ')'; ctx.fillRect(0, 0, this.cssW, this.cssH); }
  };

  G.drawGround = function (camX, camY) {
    var ctx = this.ctx, T = 120, st = this.style;
    var tx0 = Math.floor(camX / T) - 1, tx1 = Math.floor((camX + this.viewW) / T) + 1;
    var ty0 = Math.floor(camY / T) - 1, ty1 = Math.floor((camY + this.viewH) / T) + 1;
    for (var tx = tx0; tx <= tx1; tx++) for (var ty = ty0; ty <= ty1; ty++) {
      var h = hash(tx, ty, this.seed), x = tx * T, y = ty * T;
      if (h % 3 === 0) {
        ctx.fillStyle = st.alt;
        ctx.beginPath(); ctx.ellipse(x + (h >> 4) % T, y + (h >> 9) % T, 40 + h % 30, 26 + (h >> 3) % 20, 0, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (var t = 0; t < 3; t++) { var hh = hash(tx * 7 + t, ty * 13, this.seed); ctx.fillRect(x + hh % T, y + (hh >> 8) % T, 2, 5); }
      if (h % 100 < 30) this.drawDecor(st.decor[(h >> 5) % st.decor.length], x + 20 + (h >> 11) % 80, y + 20 + (h >> 17) % 80, h);
    }
  };

  G.drawDecor = function (type, x, y, h) {
    var ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 8, 16, 6, 0, 0, TAU); ctx.fill();
    switch (type) {
      case 'tree':
        ctx.fillStyle = '#5a3d22'; ctx.fillRect(x - 3, y - 2, 6, 12);
        ctx.fillStyle = '#2d4a24'; ctx.beginPath(); ctx.arc(x, y - 10, 17, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3b5f2f'; ctx.beginPath(); ctx.arc(x - 5, y - 14, 9, 0, TAU); ctx.fill(); break;
      case 'grave':
        ctx.fillStyle = '#8c8f93'; ctx.beginPath(); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x - 9, y - 8); ctx.arc(x, y - 8, 9, Math.PI, 0); ctx.lineTo(x + 9, y + 8); ctx.fill();
        ctx.fillStyle = '#5f6266'; ctx.fillRect(x - 1, y - 10, 2, 10); ctx.fillRect(x - 4, y - 7, 8, 2); break;
      case 'car':
        ctx.fillStyle = ['#7a2b2b', '#2b4a7a', '#5e5e5e', '#7a6a2b'][h % 4]; ctx.fillRect(x - 22, y - 10, 44, 20);
        ctx.fillStyle = '#26323a'; ctx.fillRect(x - 10, y - 8, 18, 16);
        ctx.fillStyle = '#111'; ctx.fillRect(x - 18, y - 13, 8, 3); ctx.fillRect(x + 10, y - 13, 8, 3); ctx.fillRect(x - 18, y + 10, 8, 3); ctx.fillRect(x + 10, y + 10, 8, 3); break;
      case 'stone':
        ctx.fillStyle = '#7d7f7a'; ctx.beginPath(); ctx.ellipse(x, y, 14, 9, 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#90928c'; ctx.beginPath(); ctx.ellipse(x - 3, y - 3, 7, 4, 0.3, 0, TAU); ctx.fill(); break;
      case 'hay':
        ctx.fillStyle = '#c9a646'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a78630'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, 5); ctx.stroke(); break;
      case 'bush':
        ctx.fillStyle = '#35552b'; ctx.beginPath(); ctx.arc(x - 6, y, 9, 0, TAU); ctx.arc(x + 6, y, 9, 0, TAU); ctx.arc(x, y - 6, 9, 0, TAU); ctx.fill(); break;
      case 'barrel':
        ctx.fillStyle = '#4f6e3a'; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#d4c94a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); break;
      case 'bin':
        ctx.fillStyle = '#2f3338'; ctx.fillRect(x - 9, y - 12, 18, 22); ctx.fillStyle = '#44494f'; ctx.fillRect(x - 10, y - 14, 20, 4); break;
      case 'cone':
        ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x - 7, y + 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 3, 8, 3); break;
      case 'sheep':
        ctx.fillStyle = '#e6e2d6'; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.arc(x + 6, y - 3, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 13, y - 2, 4, 0, TAU); ctx.fill(); break;
      case 'wall':
        ctx.fillStyle = '#76776f';
        for (var i = 0; i < 4; i++) ctx.fillRect(x - 26 + i * 13, y - 4 + (i % 2) * 2, 12, 8); break;
      case 'heather':
        ctx.fillStyle = '#8a5a9a';
        for (var j = 0; j < 7; j++) { var a = j * 0.9 + h % 5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 10, y + Math.sin(a) * 6, 4, 0, TAU); ctx.fill(); } break;
      case 'tractor':
        ctx.fillStyle = '#8a2a1f'; ctx.fillRect(x - 14, y - 10, 26, 16);
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 9, y + 7, 7, 0, TAU); ctx.arc(x + 10, y + 8, 5, 0, TAU); ctx.fill(); break;
    }
  };

  G.drawPool = function (pl) {
    var ctx = this.ctx, a = clamp(pl.life / 0.5, 0, 1);
    ctx.globalAlpha = 0.45 * a;
    var gr = ctx.createRadialGradient(pl.x, pl.y, 2, pl.x, pl.y, pl.r);
    gr.addColorStop(0, '#ffd23a'); gr.addColorStop(0.5, pl.color || '#ff6a00'); gr.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#ffb02e';
    for (var i = 0; i < 4; i++) {
      var ang = this.time * 2 + i * 1.6 + pl.x, rr = pl.r * 0.55;
      var fx = pl.x + Math.cos(ang) * rr, fy = pl.y + Math.sin(ang * 1.3) * rr * 0.6;
      ctx.beginPath(); ctx.moveTo(fx - 4, fy); ctx.quadraticCurveTo(fx, fy - 14 - Math.sin(this.time * 9 + i) * 4, fx + 4, fy); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  G.drawPickup = function (k) {
    var ctx = this.ctx, bob = Math.sin(this.time * 5 + k.x) * 2;
    if (k.type === 'gem') {
      var big = k.v >= 10, mid = k.v >= 3;
      ctx.fillStyle = big ? '#ff4f9a' : mid ? '#4fc3ff' : '#5cff8a';
      var s = big ? 7 : mid ? 5.5 : 4.5;
      ctx.beginPath(); ctx.moveTo(k.x, k.y - s + bob); ctx.lineTo(k.x + s * 0.7, k.y + bob); ctx.lineTo(k.x, k.y + s + bob); ctx.lineTo(k.x - s * 0.7, k.y + bob); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(k.x - 1, k.y - s * 0.5 + bob, 2, 2);
    } else if (k.type === 'coin') {
      ctx.fillStyle = '#e0a800'; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 4.5, 0, TAU); ctx.fill();
    } else if (k.type === 'heal') {
      ctx.fillStyle = '#d9a35a'; ctx.beginPath(); ctx.ellipse(k.x, k.y + bob, 11, 7, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(k.x - 11, k.y + bob - 1, 22, 3);
      ctx.strokeStyle = '#a0702e'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (var i = -2; i <= 2; i++) { ctx.moveTo(k.x + i * 4, k.y + bob - 6 + Math.abs(i)); ctx.lineTo(k.x + i * 4 + 2, k.y + bob - 3 + Math.abs(i)); }
      ctx.stroke();
    } else if (k.type === 'magnet') {
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 8, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ddd'; ctx.fillRect(k.x - 10.5, k.y + bob, 5, 5); ctx.fillRect(k.x + 5.5, k.y + bob, 5, 5);
    } else if (k.type === 'chest') {
      var glow = 0.4 + Math.sin(this.time * 6) * 0.2;
      ctx.fillStyle = 'rgba(255,215,0,' + glow + ')'; ctx.beginPath(); ctx.arc(k.x, k.y, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a4a1f'; ctx.fillRect(k.x - 13, k.y - 9 + bob, 26, 18);
      ctx.fillStyle = '#e0b030'; ctx.fillRect(k.x - 13, k.y - 2 + bob, 26, 3); ctx.fillRect(k.x - 2, k.y - 4 + bob, 4, 7);
    }
  };

  G.drawEnemy = function (e) {
    var ctx = this.ctx, def = e.def, r = e.r, dir = e.dir || 0;
    var cos = Math.cos(dir), sin = Math.sin(dir), wob = Math.sin(e.anim) * 0.15;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r, r * 0.4, 0, 0, TAU); ctx.fill();
    if (e.windT > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.cdx * 300, e.y + e.cdy * 300); ctx.stroke(); }
    // arms reaching forward
    ctx.strokeStyle = def.skin; ctx.lineWidth = Math.max(3, r * 0.32); ctx.lineCap = 'round';
    ctx.beginPath();
    var px = -sin, py = cos, al = r * 1.35;
    ctx.moveTo(e.x + px * r * 0.6, e.y + py * r * 0.6); ctx.lineTo(e.x + px * r * 0.5 + Math.cos(dir + wob) * al, e.y + py * r * 0.5 + Math.sin(dir + wob) * al);
    ctx.moveTo(e.x - px * r * 0.6, e.y - py * r * 0.6); ctx.lineTo(e.x - px * r * 0.5 + Math.cos(dir - wob) * al, e.y - py * r * 0.5 + Math.sin(dir - wob) * al);
    ctx.stroke();
    // body
    ctx.fillStyle = def.color; ctx.beginPath();
    if (def.explodes) ctx.arc(e.x, e.y, r * (1 + Math.sin(e.anim * 2) * 0.06), 0, TAU); else ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();
    // head
    var hx = e.x + cos * r * 0.35, hy = e.y + sin * r * 0.35 - r * 0.2;
    ctx.fillStyle = def.skin; ctx.beginPath(); ctx.arc(hx, hy, r * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = def.boss || def.elite ? '#ffea00' : '#ff2a2a';
    ctx.beginPath(); ctx.arc(hx + cos * r * 0.3 + px * r * 0.22, hy + sin * r * 0.3 + py * r * 0.22, Math.max(1.6, r * 0.12), 0, TAU);
    ctx.arc(hx + cos * r * 0.3 - px * r * 0.22, hy + sin * r * 0.3 - py * r * 0.22, Math.max(1.6, r * 0.12), 0, TAU); ctx.fill();
    if (def.boss) {
      ctx.fillStyle = '#ddd'; for (var s = -1; s <= 1; s++) { ctx.beginPath(); ctx.moveTo(hx + s * 8 - 3, hy - r * 0.5); ctx.lineTo(hx + s * 8, hy - r * 0.95); ctx.lineTo(hx + s * 8 + 3, hy - r * 0.5); ctx.fill(); }
    }
    if (e.freezeT > 0) { ctx.fillStyle = 'rgba(160,220,255,0.6)'; ctx.beginPath(); ctx.arc(e.x, e.y, r + 3, 0, TAU); ctx.fill(); }
    else if (e.slowT > 0) { ctx.strokeStyle = 'rgba(140,210,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, r + 2, 0, TAU); ctx.stroke(); }
    if (e.burnT > 0) { ctx.fillStyle = 'rgba(255,' + (100 + (Math.random() * 80 | 0)) + ',0,0.7)'; ctx.beginPath(); ctx.arc(e.x + rand(-r, r) * 0.5, e.y - r * 0.6, r * 0.35, 0, TAU); ctx.fill(); }
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); }
    if ((def.elite || def.boss) || e.hp < e.maxHp) {
      if (def.elite || def.boss || e.maxHp > 40) {
        var bw = r * 2;
        ctx.fillStyle = '#300'; ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw, 4);
        ctx.fillStyle = def.boss ? '#ff3b3b' : def.elite ? '#d07aff' : '#f0c040'; ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
      }
    }
  };

  G.drawPlayer = function () {
    var ctx = this.ctx, p = this.player, x = p.x, y = p.y;
    if (p.iframes > 0 && Math.floor(this.time * 20) % 2) return;
    var bob = p.moving ? Math.sin(p.walk) * 1.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 12, 5, 0, 0, TAU); ctx.fill();
    // legs
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(x - 6, y + 4 + (p.moving ? Math.sin(p.walk) * 3 : 0), 5, 9);
    ctx.fillRect(x + 1, y + 4 - (p.moving ? Math.sin(p.walk) * 3 : 0), 5, 9);
    // coat
    ctx.fillStyle = '#26466e'; ctx.beginPath(); ctx.ellipse(x, y + bob, 10, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8102e'; ctx.fillRect(x - 10, y - 2 + bob, 20, 3);
    // head
    ctx.fillStyle = '#f1c9a0'; ctx.beginPath(); ctx.arc(x + p.fx * 2, y - 12 + bob, 7, 0, TAU); ctx.fill();
    // flat cap
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.ellipse(x + p.fx * 3, y - 16 + bob, 8, 4, 0, Math.PI, TAU); ctx.fill();
    ctx.fillRect(x - 8 + p.fx * 3, y - 16 + bob, 16 + Math.abs(p.fx) * 3, 2);
    // facing marker
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(x + p.fx * 22, y + p.fy * 22, 2.5, 0, TAU); ctx.fill();
    // hp bar
    ctx.fillStyle = '#400'; ctx.fillRect(x - 14, y + 17, 28, 4);
    ctx.fillStyle = '#e53935'; ctx.fillRect(x - 14, y + 17, 28 * clamp(p.hp / this.stat.maxHp, 0, 1), 4);
  };

  G.drawProjectile = function (pr) {
    var ctx = this.ctx;
    if (pr.kind === 'flame') {
      var a = clamp(pr.life / pr.maxLife, 0, 1);
      ctx.fillStyle = 'rgba(255,' + (80 + a * 150 | 0) + ',20,' + (0.25 + a * 0.5) + ')';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill();
      return;
    }
    var ang = Math.atan2(pr.vy, pr.vx);
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(ang);
    if (pr.kind === 'bolt') {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-pr.r * 3, -pr.r * 0.25, pr.r * 5, pr.r * 0.5);
      ctx.fillStyle = pr.color || '#ccc'; ctx.beginPath(); ctx.moveTo(pr.r * 3, 0); ctx.lineTo(pr.r * 1.6, -pr.r * 0.8); ctx.lineTo(pr.r * 1.6, pr.r * 0.8); ctx.fill();
    } else {
      ctx.fillStyle = pr.color || '#ffe08a';
      ctx.fillRect(-pr.r * 2, -pr.r * 0.6, pr.r * 3, pr.r * 1.2);
    }
    ctx.restore();
  };

  G.drawEffect = function (f) {
    var ctx = this.ctx, a = 1 - f.t / f.T, i;
    switch (f.kind) {
      case 'splat':
        ctx.globalAlpha = a * 0.6; ctx.fillStyle = '#3d2a1a';
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, f.r * 1.2, f.r * 0.6, 0, 0, TAU); ctx.fill(); break;
      case 'slash': {
        var p = this.player;
        ctx.globalAlpha = a; ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, f.r, f.ang - f.arc / 2, f.ang + f.arc / 2);
        ctx.arc(p.x, p.y, f.r * 0.55, f.ang + f.arc / 2, f.ang - f.arc / 2, true); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, f.r, f.ang - f.arc / 2, f.ang + f.arc / 2); ctx.stroke();
        break;
      }
      case 'zap':
        ctx.globalAlpha = a; ctx.strokeStyle = f.color || '#fff799'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
        for (i = 1; i < 6; i++) { var tt = i / 6; ctx.lineTo(f.x1 + (f.x2 - f.x1) * tt + rand(-7, 7), f.y1 + (f.y2 - f.y1) * tt + rand(-7, 7)); }
        ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
      case 'strike':
        ctx.globalAlpha = a; ctx.strokeStyle = f.color || '#e6f0ff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(f.x + rand(-20, 20), f.y - 300);
        for (i = 1; i < 7; i++) ctx.lineTo(f.x + rand(-14, 14), f.y - 300 + i * 50);
        ctx.lineTo(f.x, f.y); ctx.stroke();
        ctx.fillStyle = 'rgba(200,220,255,' + (a * 0.5) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); break;
      case 'boom':
        ctx.globalAlpha = a * 0.7; ctx.fillStyle = f.color || '#ffaa33';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * (1 - a)), 0, TAU); ctx.fill(); break;
      case 'ring':
        ctx.globalAlpha = a; ctx.strokeStyle = f.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + (f.maxR - f.r) * (f.t / f.T), 0, TAU); ctx.stroke(); break;
      case 'beam':
        ctx.globalAlpha = a; ctx.strokeStyle = f.color; ctx.lineWidth = f.w * a + 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (f.w * a + 2) * 0.35;
        ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); break;
      case 'bottle': {
        var t = f.t / f.T, bx = f.sx + (f.tx - f.sx) * t, by = f.sy + (f.ty - f.sy) * t - Math.sin(t * Math.PI) * 50;
        ctx.globalAlpha = 1; ctx.fillStyle = '#3a7a3a'; ctx.save(); ctx.translate(bx, by); ctx.rotate(t * 12);
        ctx.fillRect(-3, -6, 6, 12); ctx.fillStyle = '#ff9b30'; ctx.fillRect(-1.5, -10, 3, 5); ctx.restore(); break;
      }
    }
    ctx.globalAlpha = 1;
  };

  G.drawTexts = function () {
    var ctx = this.ctx;
    ctx.textAlign = 'center';
    for (var i = 0; i < this.texts.length; i++) {
      var t = this.texts[i];
      ctx.globalAlpha = clamp(1 - t.t / 0.6, 0, 1);
      ctx.font = (t.crit ? 'bold 15px' : 'bold 11px') + ' sans-serif';
      ctx.fillStyle = '#000'; ctx.fillText(t.v, t.x + 1, t.y + 1);
      ctx.fillStyle = t.crit ? '#ffd23a' : (t.color || '#ffffff'); ctx.fillText(t.v, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  };

  G.drawBossArrow = function () {
    var b = this.boss, p = this.player, dx = b.x - p.x, dy = b.y - p.y;
    if (Math.abs(dx) < this.viewW / 2 - 20 && Math.abs(dy) < this.viewH / 2 - 20) return;
    var ctx = this.ctx, a = Math.atan2(dy, dx), cx = this.cssW / 2, cy = this.cssH / 2;
    var rx = cx - 30, ry = cy - 90, t = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
    ctx.save(); ctx.translate(cx + Math.cos(a) * t, cy + Math.sin(a) * t); ctx.rotate(a);
    ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.fill();
    ctx.restore();
  };
})(window.ZN);
