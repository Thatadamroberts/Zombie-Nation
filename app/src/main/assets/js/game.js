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
    this.char = ZN.characterById(opts.character);
    this.bossKey = ZN.bossFor(opts.county);
    this.regional = ZN.REGIONAL[opts.county.region] || null;
    this.ng = opts.daily ? 0 : (opts.ng || 0);
    this.season = ZN.currentSeason();
    this.runTokens = 0; this.eventsDone = 0; this.wevent = null; this.eventWave = -1;
    // During a seasonal event the seasonal boss leads the horde in daily challenges and ~40% of missions
    if (this.season && (opts.daily || Math.random() < 0.4)) this.bossKey = this.season.boss;
    this.landmark = ZN.landmarkFor(opts.county);
    this.shake = 0; this.slowT = 0; this.timers = [];
    this.mods = {}; var g0 = this;
    (opts.mods || []).forEach(function (m) { g0.mods[m] = true; });
    this.damageTaken = 0; this.evolvedIds = [];
    this.buffs = {}; this.particles = []; this.buffCd = 8; this.dustT = 0;
    this.trait = opts.trait || ZN.traitFor(opts.county); this.traitT = 12; this.hazards = []; this.miniIdx = 0; this.midMini = false;
    // Escalating wave threats in a fixed order per county
    var modKeys = Object.keys(ZN.WAVE_MODS), ms = this.seed;
    for (var mi = modKeys.length - 1; mi > 0; mi--) { ms = (ms * 1103515245 + 12345) >>> 0; var mj = ms % (mi + 1), mt = modKeys[mi]; modKeys[mi] = modKeys[mj]; modKeys[mj] = mt; }
    this.modOrder = modKeys; this.waveMods = {}; this.waveModList = [];
    this.petDef = opts.pet ? ZN.PETS[opts.pet] : null;
    this.petMul = opts.pet ? ZN.petMult((ZN.Save.data.petLevels || {})[opts.pet] || 0) : 1;
    // Level-up tools bought in the shop
    var shp = ZN.Save.data.shop;
    this.rerolls = shp.reroll || 0; this.skips = shp.skip || 0; this.banishes = shp.banish || 0; this.banished = {};
    this.computeStats();
    this.player.hp = this.stat.maxHp;
    this.revivals = this.stat.revival;
    this.addWeapon(this.mods.pistolOnly ? 'pistol' : this.char.start);
    this.pet = opts.pet ? { type: opts.pet, x: -30, y: 20, t: 1.5, mode: 'follow', vx: 0, vy: 0, dir: 1, anim: 0, hit: {} } : null;

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
      area: 1, duration: 1, luck: 1, growth: 1, greed: 1, crit: 0.03, revival: 0, block: 0, lifesteal: 0, thorns: 0, keg: 0, healOnKill: 0 };
    s.might += 0.05 * r('might'); s.maxHp *= 1 + 0.1 * r('maxHp'); s.armor += r('armor');
    s.regen += 0.1 * r('regen'); s.speed *= 1 + 0.05 * r('speed'); s.cooldown *= 1 - 0.03 * r('cooldown');
    s.area *= 1 + 0.05 * r('area'); s.duration *= 1 + 0.1 * r('duration'); s.amount += r('amount');
    s.magnet *= 1 + 0.25 * r('magnet'); s.luck += 0.1 * r('luck'); s.growth += 0.05 * r('growth');
    s.greed += 0.1 * r('greed'); s.revival = r('revival');
    if (this.char) {
      this.char.apply(s);
      var tree = ZN.SKILLS[this.char.id], ranks = (ZN.Save.data.skills || {})[this.char.id] || {};
      if (tree) tree.forEach(function (pk) { if (ranks[pk.id]) pk.apply(s, ranks[pk.id]); });
    }
    if (this.petDef) this.petDef.apply(s);
    (ZN.Save.data.relicEquip || []).forEach(function (id) { if (ZN.RELICS[id]) ZN.RELICS[id].apply(s); });
    if (this.buffs && this.buffs.doubleWeapons > 0) s.cooldown *= 0.5;
    if (this.buffs && this.buffs.doubleSpeed > 0) s.speed *= 2;
    if (this.mods && this.mods.glass) { s.maxHp *= 0.5; s.might *= 1.5; }
    this.passives.forEach(function (p) { ZN.PASSIVES[p.id].apply(s, p.level); });
    if (this.mods && this.mods.noHeal) s.regen = 0;
    s.block = Math.min(s.block, 0.5);
    var old = this.stat;
    this.stat = s;
    if (old && s.maxHp > old.maxHp) this.player.hp += s.maxHp - old.maxHp;
    this.player.hp = Math.min(this.player.hp, s.maxHp);
  };

  // ------------------------------------------------------------ inventory
  G.findWeapon = function (id) { for (var i = 0; i < this.weapons.length; i++) if (this.weapons[i].id === id) return this.weapons[i]; return null; };
  G.findPassive = function (id) { for (var i = 0; i < this.passives.length; i++) if (this.passives[i].id === id) return this.passives[i]; return null; };
  G.addWeapon = function (id) {
    var d = ZN.WEAPONS[id], lvl = this.masteryRank(id) >= ZN.MASTERY_MAX && d.max > 1 ? 2 : 1;
    var w = { id: id, level: lvl, t: 0.3, s: {} }; this.weapons.push(w); return w;
  };
  // Weapon mastery bought in the Armoury; evolved weapons use their best ingredient's rank
  G.masteryRank = function (id) {
    var m = ZN.Save.data.mastery || {};
    if (!ZN.WEAPONS[id].evolved) return m[id] || 0;
    var ev = ZN.EVOLUTIONS.filter(function (e) { return e.into === id; })[0];
    return ev ? Math.max.apply(null, ev.from.map(function (f) { return m[f] || 0; })) : 0;
  };
  G.masteryMult = function (id) { return ZN.masteryMult(this.masteryRank(id)); };
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
    this.evolvedIds.push(ev.into);
    this.juice(10, [60, 40, 120]); this.slowT = 1.0;
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
      if (w.level < d.max && !g.banished[w.id]) pool.push({ kind: 'upWeapon', id: w.id, icon: d.icon, color: d.color, title: d.name, tag: 'Level ' + (w.level + 1), desc: d.levels[w.level], wt: 10 });
    });
    if (this.weapons.length < ZN.MAX_WEAPON_SLOTS && !this.mods.pistolOnly) Object.keys(ZN.WEAPONS).forEach(function (id) {
      var d = ZN.WEAPONS[id];
      if (d.evolved || !unlocked[id] || consumed[id] || g.findWeapon(id) || g.banished[id]) return;
      pool.push({ kind: 'newWeapon', id: id, icon: d.icon, color: d.color, title: d.name, tag: 'NEW · ' + d.kind, desc: d.levels[0], wt: 8 });
    });
    this.passives.forEach(function (p) {
      var d = ZN.PASSIVES[p.id];
      if (p.level < ZN.PASSIVE_MAX && !g.banished[p.id]) pool.push({ kind: 'upPassive', id: p.id, icon: d.icon, color: '#8fd18f', title: d.name, tag: 'Level ' + (p.level + 1), desc: d.desc, wt: 8 });
    });
    if (this.passives.length < ZN.MAX_PASSIVE_SLOTS) Object.keys(ZN.PASSIVES).forEach(function (id) {
      var d = ZN.PASSIVES[id];
      if (!unlocked[id] || g.findPassive(id) || g.banished[id]) return;
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
    var evs = ZN.EVOLUTIONS.filter(function (e) { return e.passive === pid; });
    return evs.length ? ' (evolves ' + evs.map(function (ev) { return ZN.WEAPONS[ev.from[0]].name; }).join(', ') + ')' : '';
  }

  G.applyOption = function (o) {
    if (o.kind === 'evolve') this.evolve(o.ev);
    else if (o.kind === 'newWeapon') this.addWeapon(o.id);
    else if (o.kind === 'upWeapon') this.findWeapon(o.id).level++;
    else if (o.kind === 'newPassive') this.addPassive(o.id);
    else if (o.kind === 'upPassive') { this.findPassive(o.id).level++; this.computeStats(); }
    else if (o.kind === 'gold') this.runCoins += 25;
    else if (o.kind === 'skip') this.player.xp += this.player.xpNext * 0.25;
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
      var count = (Math.random() < 0.15 * this.stat.luck ? 3 : 1) + (this.stat.treasureDiver ? 1 : 0);
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
    var tr = ZN.TRAITS[this.trait];
    this.banner(this.county.name.toUpperCase(), tr.icon + ' ' + tr.name + ': ' + tr.desc);
    ZN.Audio.play('wave');
    function frame(t) {
      if (g.ended) return;
      var dt = Math.max(0, Math.min((t - g.last) / 1000, 0.05)); g.last = Math.max(t, g.last);
      if (!g.paused && !g.modal) {
        var sdt = dt;
        if (g.slowT > 0) { g.slowT -= dt; sdt = dt * (g.slowT > 0.3 ? 0.25 : 0.25 + (0.3 - g.slowT) * 2.5); }
        g.update(sdt);
        g.shake = Math.max(0, g.shake - dt * 30);
      }
      g.render();
      g.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };

  G.banner = function (title, sub) { if (this.opts.onBanner) this.opts.onBanner(title, sub); };
  // Screen shake + vibration
  G.juice = function (shake, vib) {
    this.shake = Math.max(this.shake, shake);
    if (vib) ZN.haptic(vib);
  };
  // Telegraphed area hit used by boss slams and dives
  G.impact = function (x, y, r, dmg, color) {
    this.effects.push({ kind: 'boom', x: x, y: y, r: r, t: 0, T: 0.45, color: color || '#ffaa33' });
    this.effects.push({ kind: 'ring', x: x, y: y, r: r * 0.3, maxR: r * 1.1, t: 0, T: 0.4, color: '#ffffff' });
    var p = this.player, dx = p.x - x, dy = p.y - y;
    if (dx * dx + dy * dy < (r + p.r) * (r + p.r)) this.hurtPlayer(dmg);
    this.juice(9, 45);
    ZN.Audio.play('boom', 80);
  };

  // ----------------------------------------------------------- difficulty
  G.effLevel = function () { return this.waveIdx + Math.floor(this.tier / 4); };
  G.progress = function () { return this.bossPhase ? 1 : clamp(this.waveTime / this.waveDur, 0, 1); };
  G.hpMult = function () { return (1 + 0.04 * this.tier) * (1 + 0.35 * this.waveIdx) * (1 + 0.3 * this.progress()) * (1 + ZN.NG.hp * this.ng); };
  G.dmgMult = function () { return (1 + 0.03 * this.tier + 0.06 * this.waveIdx) * (1 + ZN.NG.dmg * this.ng); };

  G.pickType = function () {
    var E = this.effLevel(), table = [['shambler', 10]], tr = this.trait;
    if (this.regional) table.push([this.regional, (E === 0 ? 1.2 : 2.5) * (this.regional === 'seagull' ? 0.3 : 1)]);
    if (E >= 1) table.push(['runner', 4]);
    if (E >= 2 || tr === 'brutes') table.push(['brute', tr === 'brutes' ? 3 + E * 0.2 : 1.5 + E * 0.1]);
    if (E >= 3 || tr === 'spitters') table.push(['spitter', tr === 'spitters' ? 2 : 1.2]);
    if (E >= 4 || tr === 'bloaters') table.push(['bloater', tr === 'bloaters' ? 3.5 : 2]);
    var tot = table.reduce(function (a, t) { return a + t[1]; }, 0), r = Math.random() * tot;
    for (var i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) return table[i][0]; }
    return 'shambler';
  };

  G.spawnEnemy = function (type, x, y, hpScale, defOverride) {
    if (type === 'seagull' && !this.flocking && x === undefined) {
      this.flocking = true;
      var fa = Math.random() * TAU, fx = this.player.x + Math.cos(fa) * this.spawnR, fy = this.player.y + Math.sin(fa) * this.spawnR, lead;
      for (var fi = 0; fi < 5; fi++) { var gl = this.spawnEnemy('seagull', fx + rand(-30, 30), fy + rand(-30, 30)); if (!fi) lead = gl; }
      this.flocking = false;
      return lead;
    }
    var def = defOverride || ZN.ENEMIES[type];
    if (x === undefined) {
      var a = Math.random() * TAU;
      x = this.player.x + Math.cos(a) * this.spawnR; y = this.player.y + Math.sin(a) * this.spawnR;
    }
    var hp = def.hp * this.hpMult() * (hpScale || 1);
    var e = { id: nextId++, type: type, def: def, x: x, y: y, hp: hp, maxHp: hp, r: def.r,
      spd: def.speed * rand(0.88, 1.12) * (1 + Math.min(this.tier, 20) * 0.01), atkT: 0, slowT: 0, freezeT: 0,
      burnT: 0, burnDps: 0, burnTick: 0, kbx: 0, kby: 0, flash: 0, hc: {}, shootT: rand(1.5, 3), anim: Math.random() * TAU,
      dmg: def.dmg * this.dmgMult(), chargeT: 0, windT: 0, specT: 4, cdx: 0, cdy: 0, dead: false, xpMul: 1,
      spawnT: def.boss || def.flyer ? 0 : 0.45, lungeT: 0 };
    if (this.mods.fast) e.spd *= 1.5;
    if (!def.boss) {
      var wmods = this.waveMods;
      if (wmods.armoured) { e.hp *= 1.35; e.maxHp *= 1.35; }
      if (wmods.sprinters) e.spd *= 1.18;
      if (wmods.bloodthirsty) e.dmg *= 1.25;
    }
    if (this.mods.giants && !def.boss) { e.r *= 1.35; e.hp *= 1.5; e.maxHp *= 1.5; e.xpMul = 2; }
    this.enemies.push(e);
    return e;
  };

  G.spawnTick = function (dt) {
    var w = this.waveIdx, prog = this.progress();
    var rate = (2.2 + 0.5 * w + 0.05 * this.tier) * (1 + 0.7 * prog);
    if (this.bossPhase) rate *= 0.35;
    if (this.mods.horde) rate *= 1.6;
    if (this.waveMods.surge) rate *= 1.3;
    var cap = Math.min(110 + 18 * w + 4 * this.tier, 320);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length < cap) this.spawnEnemy(this.pickType());
    }
    this.swarmT -= dt;
    if ((this.effLevel() >= 2 || this.trait === 'rats') && this.swarmT <= 0) {
      this.swarmT = this.trait === 'rats' ? rand(7, 11) : rand(14, 22);
      var a = Math.random() * TAU, n = 8 + Math.min(w * 2, 24);
      var cx = this.player.x + Math.cos(a) * this.spawnR, cy = this.player.y + Math.sin(a) * this.spawnR;
      for (var i = 0; i < n; i++) this.spawnEnemy('crawler', cx + rand(-40, 40), cy + rand(-40, 40));
      this.banner('', 'A swarm of crawlers approaches!');
    }
  };

  G.waveTick = function (dt) {
    if (this.bossPhase) return;
    this.waveTime += dt;
    // Final wave: a lieutenant shows up half way through
    if (this.waveIdx === this.waves - 1 && !this.midMini && this.waveTime >= this.waveDur * 0.5) { this.midMini = true; this.spawnMini(); }
    if (this.eventWave !== this.waveIdx && !this.wevent && this.waveTime >= this.waveDur * (this.waves === 1 ? 0.2 : 0.3)) { this.eventWave = this.waveIdx; this.startWaveEvent(); }
    if (this.waveTime < this.waveDur) return;
    if (this.waveIdx < this.waves - 1) {
      this.waveIdx++; this.waveTime = 0; this.waveDur = ZN.WAVE_DURATION;
      ZN.Audio.play('wave');
      var newMod = this.updateWaveMods();
      this.spawnMini('WAVE ' + (this.waveIdx + 1) + ' / ' + this.waves);
      if (newMod) {
        var wm = ZN.WAVE_MODS[newMod], g2 = this;
        this.timers.push({ at: this.time + 2.8, fn: function () { g2.banner('NEW THREAT', wm.icon + ' ' + wm.name + ': ' + wm.desc); ZN.Audio.play('boss', 300); } });
      }
    } else {
      this.bossPhase = true;
      var bossScale = ((this.waves === 1 ? 0.8 : 1) + 0.15 * this.waves) * (this.mods.bigBoss ? 2 : 1) * (1 + Math.min(this.tier, 25) * 0.045);
      var bd = ZN.BOSSES[this.bossKey], base = ZN.ENEMIES.boss;
      var def = { name: bd.name, hp: base.hp * bd.hpMul, speed: bd.speed, dmg: Math.min(45, 16 + this.tier * 1.3), r: bd.r, xp: base.xp, color: bd.color, skin: bd.skin,
        boss: true, shape: bd.shape, abilities: bd.abilities, minion: bd.minion, shot: bd.shot, flyer: bd.flyer };
      this.boss = this.spawnEnemy('boss', undefined, undefined, bossScale, def);
      // Escort squad
      var esc = this.tier < 2 ? 0 : 3 + Math.min(Math.floor(this.tier / 2), 7);
      for (var ei = 0; ei < esc; ei++) {
        var ea = ei / esc * TAU;
        this.spawnEnemy(this.tier >= 6 ? 'brute' : 'runner', this.boss.x + Math.cos(ea) * 70, this.boss.y + Math.sin(ea) * 70, 1.5);
      }
      this.banner(bd.name.toUpperCase(), 'Slay the horde boss to liberate ' + this.county.name);
      this.juice(12, 160);
      ZN.Audio.play('boss');
      ZN.Music.play('boss');
    }
  };

  // Active county traits: graveyard eruptions and lightning storms
  G.traitTick = function (dt) {
    var p = this.player, g = this;
    this.traitT -= dt;
    if (this.traitT > 0) return;
    if (this.trait === 'graveyard') {
      this.traitT = rand(16, 22);
      var n = 6 + Math.min(this.waveIdx * 2, 10);
      for (var i = 0; i < n; i++) {
        var a = i / n * TAU + rand(-0.2, 0.2), d = rand(110, 150);
        var e = this.spawnEnemy(Math.random() < 0.25 ? 'runner' : 'shambler', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        e.spawnT = 0.9;
        this.emit(e.x, e.y + 8, 4, '#4a3a2a', 60, 0.6, 3);
      }
      this.banner('', '⚰️ The dead rise around you!');
      ZN.Audio.play('boss', 400);
    } else if (this.trait === 'storm') {
      this.traitT = rand(6, 9);
      for (var k = 0; k < 3; k++) {
        var sa = Math.random() * TAU, sd = k === 0 ? rand(40, 90) : rand(90, 260);
        (function (x, y) {
          g.effects.push({ kind: 'warn', x: x, y: y, r: 55, t: 0, T: 1.1 });
          g.timers.push({ at: g.time + 1.1, fn: function () {
            g.effects.push({ kind: 'strike', x: x, y: y, r: 55, t: 0, T: 0.3 });
            g.queryEnemies(x, y, 55, function (o) { g.damage(o, 60, { silent: true, color: '#cfe0ff' }); });
            var dx = g.player.x - x, dy = g.player.y - y;
            if (dx * dx + dy * dy < 55 * 55) g.hurtPlayer(8 + g.tier * 0.6);
            g.shake = Math.max(g.shake, 4); ZN.Audio.play('zap', 100);
          } });
        })(p.x + Math.cos(sa) * sd, p.y + Math.sin(sa) * sd);
      }
    } else this.traitT = 999;
  };

  // Damaging ground clouds left by mini bosses (they only hurt you)
  G.updateHazards = function (dt) {
    var p = this.player, keep = [];
    for (var i = 0; i < this.hazards.length; i++) {
      var hz = this.hazards[i];
      if (hz.delay > 0) { hz.delay -= dt; keep.push(hz); continue; }
      hz.life -= dt; hz.tick -= dt;
      if (hz.tick <= 0) {
        var dx = p.x - hz.x, dy = p.y - hz.y;
        if (dx * dx + dy * dy < hz.r * hz.r) { hz.tick = 0.5; this.hurtPlayer(hz.dmg); }
      }
      if (hz.life > 0) keep.push(hz);
    }
    this.hazards = keep;
  };

  // How many wave threats are active for the current wave; returns the newly added one
  G.updateWaveMods = function () {
    var start = Math.max(0, (this.tier >= 8 ? 1 : 2) - this.ng), w = this.waveIdx;
    var want = w < start ? 0 : Math.min(ZN.WAVE_MODS_MAX, Math.floor((w - start) / 2) + 1), added = null;
    while (this.waveModList.length < want) {
      added = this.modOrder[this.waveModList.length];
      this.waveModList.push(added); this.waveMods[added] = true;
    }
    if (added && this.opts.onBuff) this.opts.onBuff(this);
    return added;
  };

  // Market Trader: lobs fruit at where the player is heading
  G.lobFruit = function (e) {
    var p = this.player, g = this, tx = p.x + this.input.x * 40, ty = p.y + this.input.y * 40;
    var fruit = ['🍅', '🍎', '🥔', '🥬'][(Math.random() * 4) | 0];
    this.fruitInAir = (this.fruitInAir || 0) + 1;
    this.effects.push({ kind: 'lob', sx: e.x, sy: e.y, tx: tx, ty: ty, t: 0, T: 0.9, icon: fruit });
    this.effects.push({ kind: 'warn', x: tx, y: ty, r: 30, t: 0, T: 0.9 });
    this.timers.push({ at: this.time + 0.9, fn: function () {
      g.fruitInAir--;
      var dx = g.player.x - tx, dy = g.player.y - ty;
      if (dx * dx + dy * dy < 30 * 30) g.hurtPlayer(e.dmg * (g.tier < 2 ? 0.35 : 0.7));
      g.emit(tx, ty, 6, '#c83a2a', 80, 0.4, 3);
    } });
  };

  // ------------------------------------------------------------ wave events
  G.startWaveEvent = function () {
    var keys = Object.keys(ZN.WAVE_EVENTS), type = keys[(Math.random() * keys.length) | 0], p = this.player;
    var a = Math.random() * TAU, ev = { type: type, t: 0 };
    if (type === 'convoy') {
      ev.van = { x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 60, hp: 100, maxHp: 100, dir: a + Math.PI / 2, hitT: 0 };
      var len = 520; ev.dest = { x: ev.van.x + Math.cos(ev.van.dir) * len, y: ev.van.y + Math.sin(ev.van.dir) * len };
      ev.limit = 50;
    } else if (type === 'crates') {
      ev.crates = []; ev.limit = 25;
      for (var i = 0; i < 3; i++) {
        var ca = a + i * TAU / 3, cd = rand(180, 280), c = { x: p.x + Math.cos(ca) * cd, y: p.y + Math.sin(ca) * cd, taken: false, drop: 1 };
        ev.crates.push(c);
        for (var k = 0; k < 4; k++) { var l = this.spawnEnemy('runner', c.x + Math.cos(ca) * 220 + rand(-30, 30), c.y + Math.sin(ca) * 220 + rand(-30, 30)); l.looter = c; }
      }
    } else if (type === 'hold') {
      ev.zone = { x: p.x + Math.cos(a) * 230, y: p.y + Math.sin(a) * 230, r: 85 }; ev.prog = 0; ev.need = 12; ev.limit = 40;
    } else {
      var def = { name: 'Wanted Zombie', hp: 70, speed: 70, dmg: 6, r: 13, xp: 15, color: '#c8a020', skin: '#ffd860', elite: true, bounty: true };
      ev.target = this.spawnEnemy('runner', p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 200, 4, def);
      ev.target.spawnT = 0; ev.limit = 25;
    }
    this.wevent = ev;
    var info = ZN.WAVE_EVENTS[type];
    this.banner(info.icon + ' ' + info.name.toUpperCase(), info.desc);
    ZN.Audio.play('wave');
  };

  G.updateWaveEvent = function (dt) {
    var ev = this.wevent, p = this.player, g = this;
    if (!ev) return;
    ev.t += dt;
    if (ev.type === 'convoy') {
      var v = ev.van, dx = ev.dest.x - v.x, dy = ev.dest.y - v.y, dd = Math.sqrt(dx * dx + dy * dy);
      var near = (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y) < 170 * 170;
      v.moving = near && dd > 6;
      if (v.moving) { v.x += dx / dd * 34 * dt; v.y += dy / dd * 34 * dt; v.dir = Math.atan2(dy, dx); }
      v.hitT -= dt;
      if (v.hitT <= 0) {
        var bites = 0;
        this.queryEnemies(v.x, v.y, 24, function (e) { if (!e.def.boss) bites += e.def.mini ? 3 : 1; });
        if (bites) { v.hp -= Math.min(bites, 8) * 1.6; v.hitT = 0.5; v.flash = 0.1; }
      }
      if (v.flash > 0) v.flash -= dt;
      if (dd <= 6) return this.endWaveEvent(true, 'The ambulance got through!');
      if (v.hp <= 0) return this.endWaveEvent(false, 'The ambulance was overrun...');
    } else if (ev.type === 'crates') {
      var left = 0;
      ev.crates.forEach(function (c) {
        if (c.taken) return;
        var cx = p.x - c.x, cy = p.y - c.y;
        if (cx * cx + cy * cy < 26 * 26) { c.taken = true; g.crateReward(c); return; }
        var looted = false;
        g.queryEnemies(c.x, c.y, 12, function (e) { if (e.looter === c) looted = true; });
        if (looted) { c.taken = true; c.lost = true; g.emit(c.x, c.y, 8, '#8a6a3a', 120, 0.5, 3); return; }
        left++;
      });
      if (!left) {
        var got = ev.crates.filter(function (c) { return !c.lost; }).length;
        return this.endWaveEvent(got > 0, got + ' / 3 crates secured');
      }
    } else if (ev.type === 'hold') {
      var z = ev.zone, zx = p.x - z.x, zy = p.y - z.y;
      ev.inside = zx * zx + zy * zy < z.r * z.r;
      if (ev.inside) { ev.prog += dt; this.spawnAcc += dt * 1.5; }
      if (ev.prog >= ev.need) return this.endWaveEvent(true, 'The line held!');
    } else if (ev.type === 'bounty') {
      if (ev.target.dead) return;
    }
    if (ev.t >= ev.limit) {
      if (ev.type === 'bounty' && ev.target && !ev.target.dead) { ev.target.dead = true; this.effects.push({ kind: 'ring', x: ev.target.x, y: ev.target.y, r: 5, maxR: 40, t: 0, T: 0.4, color: '#ffd23a' }); }
      this.endWaveEvent(false, ev.type === 'bounty' ? 'The Wanted zombie escaped!' : 'Out of time!');
    }
  };

  G.endWaveEvent = function (ok, msg) {
    var ev = this.wevent, p = this.player;
    this.wevent = null;
    if (ok) {
      this.eventsDone++;
      var at = ev.type === 'convoy' ? ev.van : ev.type === 'hold' ? ev.zone : p;
      if (ev.type !== 'crates' && ev.type !== 'bounty') {
        this.pickups.push({ type: 'chest', x: at.x, y: at.y });
        for (var i = 0; i < 12; i++) this.dropGem(at.x + rand(-40, 40), at.y + rand(-40, 40), 3 + this.waveIdx);
        if (ev.type === 'convoy') p.hp = Math.min(this.stat.maxHp, p.hp + this.stat.maxHp * 0.3);
      }
      this.banner('✅ EVENT COMPLETE', msg);
      ZN.Audio.play('levelup'); this.juice(5, [40, 30, 60]);
    } else {
      this.banner('❌ EVENT FAILED', msg);
      ZN.Audio.play('lose', 500);
    }
  };

  G.crateReward = function (c) {
    var r = Math.random();
    this.emit(c.x, c.y, 10, '#c8a060', 140, 0.5, 3);
    if (r < 0.4) { var ids = Object.keys(ZN.BUFFS); this.activateBuff(ids[(Math.random() * ids.length) | 0]); }
    else if (r < 0.75) { var coins = Math.round(rand(30, 60) * this.stat.greed); this.runCoins += coins; this.texts.push({ x: c.x, y: c.y - 20, t: 0, v: '+' + coins + ' 💰', color: '#ffd23a' }); ZN.Audio.play('coin'); }
    else this.pickups.push({ type: 'chest', x: c.x, y: c.y });
  };

  G.bountyKilled = function (e) {
    var coins = Math.round(rand(60, 100) * this.stat.greed * (1 + this.tier * 0.05));
    this.runCoins += coins;
    this.texts.push({ x: e.x, y: e.y - 20, t: 0, v: '+' + coins + ' 💰', crit: true, color: '#ffd23a' });
    for (var i = 0; i < 8; i++) this.pickups.push({ type: 'coin', x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), v: 3 });
    if (this.wevent && this.wevent.type === 'bounty') this.endWaveEvent(true, 'Bounty claimed: ' + coins + ' coins!');
  };

  G.drawWaveEvent = function (ctx) {
    var ev = this.wevent, t = this.time;
    if (ev.type === 'convoy') {
      var v = ev.van, d = ev.dest;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(v.x, v.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(90,255,138,0.25)'; ctx.beginPath(); ctx.arc(d.x, d.y, 26, 0, TAU); ctx.fill();
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🏥', d.x, d.y + 6);
      ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.dir);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-20, -9, 42, 22);
      ctx.fillStyle = v.flash > 0 ? '#ffb0b0' : '#f4f4f0'; ctx.fillRect(-22, -12, 44, 24);
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(12, -10, 8, 20);
      ctx.fillStyle = '#c8202e'; ctx.fillRect(-10, -3, 12, 6); ctx.fillRect(-7, -8, 6, 16);
      var on = Math.floor(t * 6) % 2;
      ctx.fillStyle = on ? '#3a7aff' : '#ff3a3a'; ctx.fillRect(4, -12, 5, 4); ctx.fillStyle = on ? '#ff3a3a' : '#3a7aff'; ctx.fillRect(4, 8, 5, 4);
      ctx.restore();
      ctx.fillStyle = '#300'; ctx.fillRect(v.x - 22, v.y - 24, 44, 5);
      ctx.fillStyle = '#5aff8a'; ctx.fillRect(v.x - 22, v.y - 24, 44 * clamp(v.hp / v.maxHp, 0, 1), 5);
      if (!v.moving) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('STAY CLOSE', v.x, v.y - 30); }
    } else if (ev.type === 'crates') {
      ev.crates.forEach(function (c) {
        if (c.taken) return;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c.x - 10, c.y - 8); ctx.lineTo(c.x - 16, c.y - 34); ctx.moveTo(c.x + 10, c.y - 8); ctx.lineTo(c.x + 16, c.y - 34); ctx.stroke();
        ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc(c.x, c.y - 34, 18, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c8202e'; ctx.beginPath(); ctx.arc(c.x, c.y - 34, 18, Math.PI * 1.33, Math.PI * 1.66); ctx.lineTo(c.x, c.y - 34); ctx.fill();
        ctx.fillStyle = '#8a6a3a'; ctx.fillRect(c.x - 11, c.y - 9, 22, 18);
        ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 11, c.y - 9, 22, 18);
        ctx.beginPath(); ctx.moveTo(c.x - 11, c.y - 9); ctx.lineTo(c.x + 11, c.y + 9); ctx.stroke();
      });
    } else if (ev.type === 'hold') {
      var z = ev.zone, prog = ev.prog / ev.need;
      ctx.fillStyle = ev.inside ? 'rgba(90,255,138,0.18)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#5aff8a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r - 4, -Math.PI / 2, -Math.PI / 2 + prog * TAU); ctx.stroke();
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(z.x - 1.5, z.y - 30, 3, 32);
      ctx.fillStyle = '#c8202e'; ctx.beginPath(); ctx.moveTo(z.x + 1.5, z.y - 30); ctx.lineTo(z.x + 22 + Math.sin(t * 6) * 2, z.y - 24); ctx.lineTo(z.x + 1.5, z.y - 18); ctx.fill();
    }
  };

  // Exploding projectile (fireworks): colourful burst
  G.projBurst = function (pr) {
    var g = this, R = pr.explode.r * this.stat.area;
    this.queryEnemies(pr.x, pr.y, R, function (e) { g.damage(e, pr.explode.dmg, { kb: 60, kx: e.x - pr.x, ky: e.y - pr.y, silent: true, burn: pr.explode.burn }); });
    var cols = ['#ff5ad1', '#5ad1ff', '#ffd23a', '#7dff8a', '#ff6b6b'];
    this.effects.push({ kind: 'ring', x: pr.x, y: pr.y, r: 4, maxR: R, t: 0, T: 0.35, color: cols[(Math.random() * cols.length) | 0] });
    this.emit(pr.x, pr.y, 14, cols[(Math.random() * cols.length) | 0], 220, 0.6, 3, 140);
    ZN.Audio.play('boom', 90);
  };

  // Lieutenant mini boss, picked per county and wave
  G.spawnMini = function (title) {
    if (this.mini && !this.mini.dead) { if (title) this.banner(title, this.mini.def.name + ' still leads the horde!'); return this.mini; }
    var keys = Object.keys(ZN.MINIBOSSES), h = (this.seed + this.miniIdx * 2654435761) >>> 0;
    var key = keys[h % keys.length], md = ZN.MINIBOSSES[key], base = ZN.ENEMIES.boss;
    this.miniIdx++;
    var def = { name: md.name, hp: base.hp * 0.32, speed: md.speed || 44, dmg: Math.min(28, 10 + this.tier * 0.8), r: 24, xp: 25, color: md.color, skin: md.skin,
      mini: true, elite: true, accessory: md.accessory, abilities: md.abilities, minion: md.minion, shot: md.shot };
    var e = this.spawnEnemy('mini', undefined, undefined, 1 + 0.12 * this.waves + Math.min(this.tier, 25) * 0.03, def);
    e.specT = 2.5;
    this.mini = e;
    this.banner(title || md.name.toUpperCase(), title ? md.name + ' leads the horde!' : 'A horde lieutenant has arrived!');
    this.juice(6, 80);
    return e;
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
        if (e.dead || e.submerged) continue;
        var dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy <= rr * rr) fn(e);
      }
    }
  };

  G.nearestEnemy = function (x, y, maxR, exclude) {
    var best = null, bd = maxR * maxR;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || e.submerged || (exclude && exclude[e.id])) continue;
      var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };

  G.randomEnemyOnScreen = function () {
    var p = this.player, hw = this.viewW / 2, hh = this.viewH / 2, list = [];
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.dead && !e.submerged && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh) list.push(e);
    }
    return list.length ? list[(Math.random() * list.length) | 0] : null;
  };

  // --------------------------------------------------------------- damage
  // opts: kb (knockback px), kx/ky (direction), slow, freeze, burn (dps), color, silent
  G.damage = function (e, base, opts) {
    if (e.dead) return;
    if (e.shieldT > 0) {
      if ((e.immuneTxt || 0) < this.time && this.texts.length < 70) { e.immuneTxt = this.time + 0.4; this.texts.push({ x: e.x, y: e.y - e.r - 8, t: 0, v: 'IMMUNE', color: '#7dff8a' }); }
      return;
    }
    opts = opts || {};
    var dmg = base * this.stat.might, crit = Math.random() < this.stat.crit + (opts.crit || 0);
    if (crit) dmg *= opts.critMul || 2;
    if (this.waveMods.shielded && (e.type === 'brute' || e.def.mini || e.def.elite)) dmg *= 0.75;
    if (this.stat.lastStand && this.player.hp < this.stat.maxHp * 0.3) dmg *= 1.5;
    if (e.def.armorPct) dmg *= 1 - e.def.armorPct;
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
    if (e.def.regional) { this.regionalKills = this.regionalKills || {}; this.regionalKills[e.type] = true; }
    var def = e.def;
    this.dropGem(e.x, e.y, def.xp * (1 + this.waveIdx * 0.08) * e.xpMul * (this.trait === 'night' ? 1.15 : 1) * (this.trait === 'brutes' && e.type === 'brute' ? 1.6 : 1));
    if (Math.random() < (this.trait === 'treasure' ? 0.09 : 0.035) * this.stat.luck || def.elite) this.pickups.push({ type: 'coin', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), v: def.elite ? 10 : (1 + (Math.random() * 3 | 0)) });
    if (!this.mods.noHeal && Math.random() < 0.004 * this.stat.luck) this.pickups.push({ type: 'heal', x: e.x, y: e.y });
    if (Math.random() < 0.0015 * this.stat.luck) this.pickups.push({ type: 'magnet', x: e.x, y: e.y });
    if (def.elite && !def.bounty) this.pickups.push({ type: 'chest', x: e.x, y: e.y });
    if (def.bounty) this.bountyKilled(e);
    if (this.stat.healOnKill && !this.victory) this.player.hp = Math.min(this.stat.maxHp, this.player.hp + this.stat.healOnKill);
    if (this.stat.keg && !this.victory && !def.boss && Math.random() < this.stat.keg) {
      var gk2 = this, kx = e.x, ky = e.y;
      this.queryEnemies(kx, ky, 55, function (o) { if (o !== e) gk2.damage(o, 30, { kb: 80, kx: o.x - kx, ky: o.y - ky, silent: true, color: '#ffb03a' }); });
      this.effects.push({ kind: 'boom', x: kx, y: ky, r: 55, t: 0, T: 0.35, color: '#ff9b30' });
      ZN.Audio.play('boom', 150);
    }
    if (this.season && !this.victory) {
      var tk = def.boss ? 6 : def.mini ? 2 : def.elite ? 1 : (Math.random() < 0.004 * this.stat.luck ? 1 : 0);
      for (var ti = 0; ti < tk; ti++) this.pickups.push({ type: 'token', x: e.x + rand(-14, 14), y: e.y + rand(-14, 14) });
    }
    if (!this.victory && (def.elite || (this.buffCd <= 0 && Math.random() < (this.trait === 'supply' ? 0.036 : 0.012) * this.stat.luck))) {
      var ids = Object.keys(ZN.BUFFS);
      this.pickups.push({ type: 'buff', id: ids[(Math.random() * ids.length) | 0], x: e.x + (def.elite ? 30 : 0), y: e.y, life: 20 });
      this.buffCd = this.trait === 'supply' ? 5 : 10;
    }
    if (ZN.Sprites.has(e.type) && !def.boss) this.effects.push({ kind: 'corpse', e: e, x: e.x, y: e.y, t: 0, T: 0.7, side: Math.cos(e.dir || 0) < 0 ? -1 : 1 });
    this.emit(e.x, e.y - e.r * 0.3, def.boss ? 30 : 6, def.ranged || def.explodes ? '#9be03a' : '#7a1414', 120, 0.5, def.boss ? 5 : 3);
    if (!this.victory && !def.boss && !def.mini) {
      if (this.waveMods.splitters && (e.type === 'shambler' || e.type === 'brute')) {
        for (var si = 0; si < (e.type === 'brute' ? 3 : 2); si++) { var sc = this.spawnEnemy('crawler', e.x + rand(-10, 10), e.y + rand(-10, 10)); sc.spawnT = 0; sc.xpMul = 0.25; }
      }
      if (this.waveMods.volatile && !def.explodes && Math.random() < 0.15) {
        this.effects.push({ kind: 'boom', x: e.x, y: e.y, r: 48, t: 0, T: 0.35, color: '#ff7a2a' });
        var vx = this.player.x - e.x, vy = this.player.y - e.y;
        if (vx * vx + vy * vy < 48 * 48) this.hurtPlayer(e.dmg);
        ZN.Audio.play('boom', 150);
      }
    }
    if (def.explodes) {
      var br = this.trait === 'bloaters' ? 85 : 64;
      this.effects.push({ kind: 'boom', x: e.x, y: e.y, r: br, t: 0, T: 0.4, color: '#c8d84a' });
      var p = this.player, dx = p.x - e.x, dy = p.y - e.y;
      if (dx * dx + dy * dy < br * br) this.hurtPlayer(e.dmg * (this.trait === 'bloaters' ? 1.4 : 2));
      if (dx * dx + dy * dy < 250 * 250) this.juice(5, 25);
      ZN.Audio.play('boom', 120);
    }
    this.effects.push({ kind: 'splat', x: e.x, y: e.y, r: e.r, t: 0, T: 0.5, color: def.color });
    if (def.boss) { this.slowT = 1.4; this.juice(16, [100, 50, 200]); this.winMission(); }
  };

  G.dropGem = function (x, y, v) {
    var gems = 0, target = null;
    for (var i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].type === 'gem') { gems++; if (!target) target = this.pickups[i]; }
    if (gems > 300 && target) { target.v += v; return; }
    this.pickups.push({ type: 'gem', x: x, y: y, v: v });
  };

  G.hurtPlayer = function (dmg) {
    var p = this.player;
    if (p.iframes > 0 || this.victory || this.buffs.invincible > 0) return;
    if (this.stat.block > 0 && Math.random() < this.stat.block) {
      if (this.texts.length < 70) this.texts.push({ x: p.x, y: p.y - 24, t: 0, v: 'BLOCK', color: '#ffd23a' });
      return;
    }
    dmg = Math.max(1, dmg - this.stat.armor);
    this.damageTaken += dmg;
    p.hp -= dmg; p.hurtT = 0.2;
    if (this.stat.shockwave && Math.random() < 0.25 && p.hp > 0) {
      var gs = this;
      this.queryEnemies(p.x, p.y, 130, function (e) { gs.damage(e, 40, { kb: 220, kx: e.x - p.x, ky: e.y - p.y, silent: true }); });
      this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 130, t: 0, T: 0.35, color: '#ffd23a' });
      this.shake = Math.max(this.shake, 6);
    }
    this.juice(3.5, 22);
    ZN.Audio.play('hurt', 150);
    if (p.hp <= 0) {
      if (this.revivals > 0) {
        this.revivals--; p.hp = this.stat.maxHp * 0.5; p.iframes = 2.5;
        if (this.stat.keepCalm) { this.buffs.invincible = 5; this.computeStats(); this.banner('', '☕ Keep Calm and Carry On!'); }
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
      level: this.player.level, time: this.time, wavesDone: this.victory ? this.waves : this.waveIdx,
      damageTaken: this.damageTaken, evolved: this.evolvedIds.slice(), bossKey: this.bossKey, buffs: this.buffsCollected || 0,
      tokens: this.runTokens, eventsDone: this.eventsDone, season: this.season ? this.season.id : null, regional: this.regionalKills || {} });
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
      var bogF = (this.inBog(p.x, p.y) ? 0.55 : 1) * (st.lastStand && p.hp < st.maxHp * 0.3 ? 1.3 : 1) * (p.slowT > 0 ? 0.6 : 1);
      p.x += this.input.x * st.speed * bogF * dt; p.y += this.input.y * st.speed * bogF * dt;
      this.pushOut(p, p.r - 2);
      p.fx = this.input.x / il; p.fy = this.input.y / il; p.walk += dt * 10;
    }
    p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);
    this.buffCd -= dt;
    if (st.fireRing && !this.victory) {
      this.fireRingT = (this.fireRingT === undefined ? 4 : this.fireRingT) - dt;
      if (this.fireRingT <= 0) {
        this.fireRingT = 9 * st.cooldown;
        for (var fr = 0; fr < 8; fr++) {
          var fa = fr / 8 * TAU;
          this.pools.push({ x: p.x + Math.cos(fa) * 70, y: p.y + Math.sin(fa) * 70, r: 38 * st.area, life: 3 * st.duration, tick: 0.35, tickT: 0, dmg: 10, burn: 5, color: '#ff6a00' });
        }
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 90, t: 0, T: 0.4, color: '#ff6a00' });
        ZN.Audio.play('boom', 200);
      }
    }
    if (st.lament && !this.victory) {
      this.lamentT = (this.lamentT === undefined ? 6 : this.lamentT) - dt;
      if (this.lamentT <= 0) {
        this.lamentT = 12;
        var hw = this.viewW / 2, hh = this.viewH / 2;
        this.enemies.forEach(function (e) { if (!e.def.boss && Math.abs(e.x - p.x) < hw && Math.abs(e.y - p.y) < hh) e.freezeT = Math.max(e.freezeT, 1.5); });
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 260, t: 0, T: 0.6, color: '#d8b8ff' });
        this.banner('', '😱 Battle Lament!');
        ZN.Audio.play('zap', 200);
      }
    }
    var changed = false;
    for (var bk in this.buffs) {
      if (this.buffs[bk] <= 0) continue;
      this.buffs[bk] -= dt;
      if (this.buffs[bk] <= 0) { changed = true; if (this.opts.onBuff) this.opts.onBuff(this); }
    }
    if (changed) this.computeStats();
    if (p.moving) {
      this.dustT -= dt;
      if (this.dustT <= 0) { this.dustT = this.buffs.doubleSpeed > 0 ? 0.06 : 0.16; this.emit(p.x - p.fx * 6, p.y + 12, 2, 'rgba(200,190,160,0.6)', 25, 0.4, 2.5, -10); }
    }
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.slowT > 0) p.slowT -= dt;
    if (p.iframes > 0) p.iframes -= dt;

    if (!this.victory) { this.waveTick(dt); this.spawnTick(dt); this.traitTick(dt); this.updateWaveEvent(dt); }
    this.updateHazards(dt);
    this.rebuildGrid();
    this.updateEnemies(dt);
    this.rebuildGrid();

    if (!this.victory) {
      for (var i = 0; i < this.weapons.length; i++) {
        var w = this.weapons[i], logic = ZN.WEAPON_LOGIC[w.id];
        if (logic) {
          var wst = ZN.WEAPONS[w.id].stats(w.level), mm = this.masteryMult(w.id);
          if (mm !== 1) { if (wst.dmg) wst.dmg *= mm; if (wst.burstDmg) wst.burstDmg *= mm; }
          logic(this, w, wst, dt);
        }
      }
    }
    ZN.runGameTimers(this);
    if (this.pet && !this.victory) this.updatePet(dt);
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
      ZN.haptic(35);
      this.opts.onLevelUp(this.rollOptions(), function (o) {
        g.applyOption(o); g.pendingLevels--; g.modal = false; g.last = performance.now();
      });
    }

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; if (this.opts.onHud) this.opts.onHud(this); }
  };

  G.updateEnemies = function (dt) {
    var p = this.player, g = this, frozenAll = this.buffs.freeze > 0, invinc = this.buffs.invincible > 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      if (e.lungeT > 0) e.lungeT -= dt;
      if (e.spawnT > 0) { e.spawnT -= dt; e.anim += dt * 2; continue; }
      if (frozenAll && !e.def.boss) { e.flash = Math.max(0, e.flash - dt); continue; }
      e.anim += dt * 6;
      if (e.flash > 0) e.flash -= dt;
      if (e.atkT > 0) e.atkT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (this.waveMods.regenerating && !e.def.boss && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.025 * dt);
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
      if (e.def.bounty) { if (d < 260) { mx = -ux; my = -uy; } else { mx = Math.cos(e.anim * 0.2); my = Math.sin(e.anim * 0.23); } }
      else if (e.looter && !e.looter.taken) { var lx = e.looter.x - e.x, ly = e.looter.y - e.y, ll = Math.sqrt(lx * lx + ly * ly) || 1; mx = lx / ll; my = ly / ll; }
      var bh = e.def.behavior;
      if (bh && e.freezeT <= 0) {
        if (bh === 'lobber') {
          if (d < 170) { mx = -ux; my = -uy; sp *= 0.7; } else if (d < 240) sp *= 0.1;
          e.shootT -= dt;
          if (e.shootT <= 0 && d < 300 && (this.fruitInAir || 0) < (this.tier < 2 ? 2 : 4)) { e.shootT = rand(5, 7); this.lobFruit(e); }
        } else if (bh === 'berserk') {
          if (!e.berserk && e.hp < e.maxHp * 0.5) { e.berserk = true; e.dmg *= 1.3; this.texts.length < 70 && this.texts.push({ x: e.x, y: e.y - e.r - 6, t: 0, v: 'RAAAH!', color: '#ff4a4a' }); }
          if (e.berserk) sp *= 1.8;
        } else if (bh === 'burrow') {
          e.burrowT = (e.burrowT || 0) - dt;
          if (!e.submerged && d > 170 && e.burrowT <= 0) { e.submerged = true; this.emit(e.x, e.y + 8, 4, '#5a4a3a', 60, 0.5, 3); }
          if (e.submerged) {
            sp *= 1.7;
            if (d < 55) { e.submerged = false; e.burrowT = 4; this.emit(e.x, e.y + 8, 8, '#5a4a3a', 120, 0.5, 3); this.shake = Math.max(this.shake, 2); }
          }
        } else if (bh === 'ram') {
          e.ramT = (e.ramT === undefined ? rand(1, 3) : e.ramT) - dt;
          if (e.windT > 0) { e.windT -= dt; sp = 0; if (e.windT <= 0) e.chargeT = 0.6; }
          else if (e.chargeT > 0) { e.chargeT -= dt; sp *= 4.5; mx = e.cdx; my = e.cdy; }
          else if (e.ramT <= 0 && d < 240) { e.ramT = rand(3, 5); e.windT = 0.5; e.cdx = ux; e.cdy = uy; }
        } else if (bh === 'swoop') {
          var wa = Math.sin(e.anim * 0.7 + e.id) * 0.9, wc = Math.cos(wa), wsn = Math.sin(wa), wnx = mx * wc - my * wsn;
          my = mx * wsn + my * wc; mx = wnx;
        } else if (bh === 'orbit') {
          e.life = (e.life || 0) + dt;
          if (e.life < 5 && d > 60) { var ox = -uy * 0.85 + ux * 0.35, oy = ux * 0.85 + uy * 0.35, ol = Math.sqrt(ox * ox + oy * oy); mx = ox / ol; my = oy / ol; }
        } else if (bh === 'wail') {
          e.wailT = (e.wailT === undefined ? rand(2, 4) : e.wailT) - dt;
          if (e.wailT <= 0 && d < 200 && !e.wailing) { e.wailT = rand(5, 7); e.wailing = 0.8; this.effects.push({ kind: 'warn', x: e.x, y: e.y, r: 150, t: 0, T: 0.8, follow: e }); }
          if (e.wailing > 0) {
            e.wailing -= dt; sp = 0;
            if (e.wailing <= 0) {
              e.wailing = 0;
              this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 150, t: 0, T: 0.4, color: '#c8d8e8' });
              if (d < 150) { this.hurtPlayer(e.dmg * 0.8); p.slowT = 2; }
              ZN.Audio.play('zap', 300);
            }
          }
        }
      }
      if (e.def.ranged) {
        if (d < 150) { mx = -ux; my = -uy; sp *= 0.6; } else if (d < 220) { sp *= 0.15; }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 280 && e.freezeT <= 0 && this.enemyShots.length < 25) {
          e.shootT = rand(3.5, 5);
          this.enemyShots.push({ x: e.x, y: e.y, vx: ux * 125, vy: uy * 125, r: 6, dmg: e.dmg, life: 3, color: '#9be03a' });
        }
      }
      if (e.def.boss) {
        sp = Math.max(sp, this.stat.speed * (this.waves === 1 ? 0.6 : 0.72) * (e.slowT > 0 ? 0.5 : 1));
        if (e.enraged) sp *= 1.25;
        if (d > 260) sp *= 1.8;
        sp = this.bossAI(e, dt, ux, uy, d, sp);
      } else if (e.def.mini) {
        sp = Math.max(sp, this.stat.speed * 0.55 * (e.slowT > 0 ? 0.5 : 1));
        if (d > 300) sp *= 1.5;
        sp = this.bossAI(e, dt, ux, uy, d, sp);
      }
      if (e.frenzyT > 0) { e.frenzyT -= dt; sp *= 1.35; }
      if (e.chargeT > 0) { mx = e.cdx; my = e.cdy; }
      if (this.trait === 'bog' && !e.def.boss && !e.def.flyer && this.inBog(e.x, e.y)) sp *= 0.55;
      e.x += (mx * sp + e.kbx) * dt; e.y += (my * sp + e.kby) * dt;
      if (!e.def.boss && !e.def.flyer && d < this.spawnR) this.pushOut(e, e.r * 0.8);
      e.kbx *= Math.pow(0.02, dt); e.kby *= Math.pow(0.02, dt);
      e.dir = Math.atan2(my, mx);

      // separation from neighbours
      if (!e.submerged) this.queryEnemies(e.x, e.y, e.r, function (o) {
        if (o === e || o.id < e.id) return;
        var sx = o.x - e.x, sy = o.y - e.y, sd = Math.sqrt(sx * sx + sy * sy) || 0.01, overlap = e.r + o.r - sd;
        if (overlap > 0) {
          var wE = o.def.boss ? 1 : e.def.boss ? 0 : 0.5, push = overlap * 0.5;
          e.x -= sx / sd * push * (wE * 2); e.y -= sy / sd * push * (wE * 2);
          o.x += sx / sd * push * ((1 - wE) * 2); o.y += sy / sd * push * ((1 - wE) * 2);
        }
      });

      if (d < e.r + p.r && e.atkT <= 0 && e.freezeT <= 0 && !e.submerged && !e.leap) {
        e.atkT = e.def.boss || e.def.mini ? 1 : 0.7; e.lungeT = 0.22;
        if (invinc) { e.atkT = 0.35; g.damage(e, 30, { kb: 180, kx: -ux, ky: -uy, color: '#ffd23a' }); continue; }
        g.hurtPlayer(e.dmg);
        if (e.def.behavior === 'mud') p.slowT = 1.5;
        if (g.stat.thorns > 0) g.damage(e, g.stat.thorns, { kb: 60, kx: -ux, ky: -uy, color: '#c8a070', silent: true });
      }
    }
  };

  // ---------------------------------------------------------------- pets
  G.updatePet = function (dt) {
    var pet = this.pet, p = this.player, g = this;
    pet.anim += dt * 8; pet.t -= dt;
    var tx = p.x - p.fx * 34, ty = p.y - p.fy * 34 + 10, sp = this.stat.speed * 1.25;
    if (pet.type === 'dragon') {
      tx = p.x + Math.cos(this.time * 1.4) * 46; ty = p.y - 36 + Math.sin(this.time * 2.8) * 10;
      if (pet.t <= 0) {
        var tgt = this.nearestEnemy(pet.x, pet.y, 230);
        if (tgt) {
          pet.t = 2.2 * this.stat.cooldown;
          var base = Math.atan2(tgt.y - pet.y, tgt.x - pet.x);
          for (var i = 0; i < 9; i++) {
            var a = base + (Math.random() - 0.5) * 0.6, v = 250;
            this.projectiles.push({ x: pet.x, y: pet.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 8, dmg: 9 * this.petMul, pierce: 5, life: 0.75, maxLife: 0.75,
              hit: {}, kind: 'flame', burn: 6, silent: true, grow: 34, drag: 0.5 });
          }
          ZN.Audio.play('boom', 200);
        }
      }
    } else if (pet.type === 'corgi') {
      if (pet.mode === 'fetch' && (!pet.gem || pet.gem.mag || this.pickups.indexOf(pet.gem) < 0)) pet.mode = 'follow';
      if (pet.mode === 'follow' && pet.t <= 0) {
        pet.t = 0.4;
        var best = null, bd = 260 * 260;
        for (var k = 0; k < this.pickups.length; k++) {
          var gm = this.pickups[k];
          if (gm.type !== 'gem' || gm.mag) continue;
          var dd = (gm.x - p.x) * (gm.x - p.x) + (gm.y - p.y) * (gm.y - p.y);
          if (dd < bd) { bd = dd; best = gm; }
        }
        if (best) { pet.mode = 'fetch'; pet.gem = best; }
      }
      if (pet.mode === 'fetch') {
        tx = pet.gem.x; ty = pet.gem.y; sp = this.stat.speed * 2;
        if (Math.abs(tx - pet.x) < 12 && Math.abs(ty - pet.y) < 12) { pet.gem.mag = true; pet.mode = 'follow'; }
      }
      if (pet.biteT === undefined || pet.biteT <= 0) {
        pet.biteT = 0.6;
        this.queryEnemies(pet.x, pet.y, 16, function (e) { g.damage(e, 12 * g.petMul, { kb: 40, kx: e.x - pet.x, ky: e.y - pet.y, silent: true }); });
      } else pet.biteT -= dt;
    } else if (pet.type === 'cow') {
      if (pet.mode === 'charge') {
        pet.chargeT -= dt;
        tx = pet.x + pet.cx * 100; ty = pet.y + pet.cy * 100; sp = 520;
        this.queryEnemies(pet.x, pet.y, 18, function (e) {
          if (pet.hit[e.id]) return;
          pet.hit[e.id] = 1;
          g.damage(e, 32 * g.petMul, { kb: 240, kx: pet.cx, ky: pet.cy, silent: true });
        });
        if (pet.chargeT <= 0) { pet.mode = 'follow'; pet.t = 3.8 * this.stat.cooldown; }
      } else if (pet.t <= 0) {
        var tg = this.nearestEnemy(p.x, p.y, 260);
        if (tg) {
          var cx = tg.x - pet.x, cy = tg.y - pet.y, cl = Math.sqrt(cx * cx + cy * cy) || 1;
          pet.mode = 'charge'; pet.chargeT = 0.75; pet.cx = cx / cl; pet.cy = cy / cl; pet.hit = {};
          ZN.Audio.play('hurt', 300);
        } else pet.t = 0.5;
      }
    } else if (pet.type === 'bat') {
      // Vampire bat: dives at zombies, every bite heals you
      if (!pet.target || pet.target.dead || pet.target.submerged || pet.t <= -4) {
        pet.target = this.nearestEnemy(p.x, p.y, 220); pet.t = 0;
      }
      if (pet.target) {
        tx = pet.target.x + Math.cos(this.time * 9) * 8; ty = pet.target.y - pet.target.r * 0.6; sp = 340;
        var bx = pet.target.x - pet.x, by = pet.target.y - pet.y;
        if (bx * bx + by * by < (pet.target.r + 12) * (pet.target.r + 12) && (pet.biteT || 0) <= 0) {
          pet.biteT = 0.45;
          this.damage(pet.target, 10 * this.petMul, { silent: true, color: '#ff6b8a' });
          this.lifesteal(pet.x, pet.y);
        }
      } else { tx = p.x + Math.cos(this.time * 3) * 40; ty = p.y - 26 + Math.sin(this.time * 6) * 8; }
      pet.biteT = (pet.biteT || 0) - dt;
    } else if (pet.type === 'owl') {
      if (pet.mode === 'swoop' && pet.target && !pet.target.dead) {
        tx = pet.target.x; ty = pet.target.y; sp = 430;
        if (Math.abs(tx - pet.x) < 12 && Math.abs(ty - pet.y) < 12) {
          this.queryEnemies(pet.x, pet.y, 34, function (e) { g.damage(e, 28 * g.petMul, { kb: 80, kx: e.x - pet.x, ky: e.y - pet.y, silent: true }); });
          this.effects.push({ kind: 'ring', x: pet.x, y: pet.y, r: 6, maxR: 36, t: 0, T: 0.25, color: '#e0c890' });
          pet.mode = 'follow'; pet.t = 2.6 * this.stat.cooldown;
        }
      } else {
        pet.mode = 'follow';
        tx = p.x + Math.sin(this.time * 1.3) * 30; ty = p.y - 52 + Math.sin(this.time * 2.6) * 6;
        if (pet.t <= 0) { var ot = this.nearestEnemy(p.x, p.y, 240); if (ot) { pet.mode = 'swoop'; pet.target = ot; } else pet.t = 0.5; }
      }
    } else if (pet.type === 'cat') {
      var ct = this.nearestEnemy(p.x, p.y, 95);
      if (ct) { tx = ct.x - (ct.x > pet.x ? 12 : -12); ty = ct.y; sp = this.stat.speed * 1.6; }
      if ((pet.biteT || 0) <= 0) {
        pet.biteT = 0.45;
        var hitAny = false;
        this.queryEnemies(pet.x, pet.y, 20, function (e) { hitAny = true; g.damage(e, 9 * g.petMul, { kb: 30, kx: e.x - pet.x, ky: e.y - pet.y, silent: true }); });
        if (hitAny) this.effects.push({ kind: 'scratch', x: pet.x + pet.dir * 10, y: pet.y - 4, t: 0, T: 0.2 });
      } else pet.biteT -= dt;
    } else if (pet.type === 'hedgehog') {
      pet.ang = (pet.ang || 0) + dt * 3.2;
      tx = p.x + Math.cos(pet.ang) * 48; ty = p.y + 6 + Math.sin(pet.ang) * 30; sp = 600;
      this.queryEnemies(pet.x, pet.y, 13, function (e) {
        if ((e.hc.hog || 0) > g.time) return;
        e.hc.hog = g.time + 0.5;
        g.damage(e, 14 * g.petMul, { kb: 90, kx: e.x - pet.x, ky: e.y - pet.y, silent: true, color: '#c8a070' });
      });
    }
    var dx = tx - pet.x, dy = ty - pet.y, dl = Math.sqrt(dx * dx + dy * dy);
    if (dl > 600) { pet.x = p.x; pet.y = p.y; return; }
    var mv = Math.min(dl, sp * dt * (pet.mode === 'follow' ? Math.min(1, dl / 40 + 0.2) : 1));
    if (dl > 0.5) { pet.x += dx / dl * mv; pet.y += dy / dl * mv; if (Math.abs(dx) > 1) pet.dir = dx > 0 ? 1 : -1; }
    pet.moving = mv > 0.3;
  };

  // Vampire bat bites heal the player
  G.lifesteal = function (x, y) {
    var p = this.player, h = this.stat.lifesteal * this.petMul;
    if (!h || p.hp >= this.stat.maxHp) return;
    p.hp = Math.min(this.stat.maxHp, p.hp + h);
    if (this.texts.length < 70 && Math.random() < 0.5) this.texts.push({ x: p.x + rand(-8, 8), y: p.y - 26, t: 0, v: '+' + h.toFixed(1), color: '#7dff8a' });
    this.particles.length < 250 && this.particles.push({ x: x, y: y, vx: (p.x - x) * 2, vy: (p.y - y) * 2, life: 0.45, max: 0.45, color: '#ff4a6a', size: 3, grav: 0 });
  };

  G.bossAI = function (e, dt, ux, uy, d, sp) {
    var bd = e.def, p = this.player;
    if (bd.boss && !e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; e.specT = Math.min(e.specT, 0.6);
      this.banner('', bd.name + ' is ENRAGED!');
      this.juice(10, [80, 40, 120]);
      ZN.Audio.play('boss');
      for (var ri = 0; ri < 6; ri++) { var ra = ri / 6 * TAU; this.spawnEnemy(bd.minion || 'runner', e.x + Math.cos(ra) * 60, e.y + Math.sin(ra) * 60); }
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 160, t: 0, T: 0.6, color: '#ff3b3b' });
    }
    if (e.submerged) {
      e.subT -= dt;
      if (e.subT > 0.9) return sp * 2.4;            // swimming towards you underground / underwater
      if (!e.marked) {
        e.marked = true; e.tx = p.x; e.ty = p.y;
        this.effects.push({ kind: 'warn', x: e.tx, y: e.ty, r: 95, t: 0, T: 0.9 });
      }
      if (e.subT <= 0) {
        e.submerged = false; e.marked = false; e.x = e.tx; e.y = e.ty;
        this.impact(e.x, e.y, 95, e.dmg * 1.2, bd.shot || '#6fd0c0');
      }
      return 0;
    }
    if (e.leap) {
      var L = e.leap; L.t += dt;
      var f = Math.min(1, L.t / L.T);
      e.x = L.sx + (L.tx - L.sx) * f; e.y = L.sy + (L.ty - L.sy) * f; e.leapZ = Math.sin(f * Math.PI) * 110;
      if (f >= 1) { e.leap = null; e.leapZ = 0; this.impact(e.x, e.y, 95, e.dmg * (this.tier < 3 ? 0.8 : 1.1), '#5ad1ff'); }
      return 0;
    }
    if (e.shieldT > 0) { e.shieldT -= dt; return sp * 1.3; }
    if (e.slamT > 0) {
      e.slamT -= dt;
      if (e.slamT <= 0) this.impact(e.x, e.y, bd.mini ? 100 : 150, e.dmg, '#a8a090');
      return 0;
    }
    if (e.windT > 0) {
      e.windT -= dt;
      if (e.windT <= 0) { e.chargeT = e.chargeDur || 0.7; }
      return 0;
    }
    if (e.chargeT > 0) {
      e.chargeT -= dt;
      if (e.chargeT <= 0 && e.pounces > 0) { e.pounces--; e.windT = 0.3; e.chargeDur = 0.3; e.cdx = ux; e.cdy = uy; }
      return sp * (e.chargeDur === 0.3 ? 7 : 5);
    }
    e.specT -= dt;
    if (e.specT > 0) return sp;
    e.specT = (bd.mini ? rand(3.5, 5) : rand(3, 4.6)) * (e.enraged ? 0.6 : 1);
    var abs = bd.abilities || ['charge', 'summon'], ab = abs[(Math.random() * abs.length) | 0];
    if (ab === 'charge' && d > 420) ab = 'summon';
    if (ab === 'charge') { e.windT = 0.7; e.chargeDur = 0.7; e.cdx = ux; e.cdy = uy; }
    else if (ab === 'pounce') { e.pounces = 2; e.windT = 0.45; e.chargeDur = 0.3; e.cdx = ux; e.cdy = uy; ZN.Audio.play('boss', 400); }
    else if (ab === 'leap') {
      e.leap = { sx: e.x, sy: e.y, tx: p.x, ty: p.y, t: 0, T: 0.95 };
      this.effects.push({ kind: 'warn', x: p.x, y: p.y, r: 95, t: 0, T: 0.95 });
    } else if (ab === 'shield') {
      e.shieldT = 2.6;
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: e.r * 1.8, t: 0, T: 0.4, color: '#7dff8a' });
    } else if (ab === 'homing') {
      var hn = 3 + Math.min(Math.floor(this.tier / 3), 5);
      for (var h = 0; h < hn; h++) {
        var ha = h / hn * TAU;
        this.enemyShots.push({ x: e.x, y: e.y, vx: Math.cos(ha) * 115, vy: Math.sin(ha) * 115, r: 8, dmg: e.dmg * (this.tier < 3 ? 0.4 : 0.6), life: 5, color: bd.shot || '#9a6ad8', homing: true });
      }
      ZN.Audio.play('zap', 100);
    } else if (ab === 'poison') {
      for (var pz = 0; pz < 3; pz++) {
        var pa = Math.random() * TAU, pd = pz === 0 ? 0 : 60 + Math.random() * 80;
        this.hazards.push({ x: p.x + Math.cos(pa) * pd, y: p.y + Math.sin(pa) * pd, r: 44, life: 4.5, delay: 0.8, tick: 0, dmg: e.dmg * 0.25, color: bd.shot || '#8ad04a' });
      }
      ZN.Audio.play('boom', 200);
    } else if (ab === 'heal') {
      var gH = this;
      this.queryEnemies(e.x, e.y, 220, function (o) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.3); });
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.08);
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 220, t: 0, T: 0.6, color: '#7dff8a' });
      gH.texts.push({ x: e.x, y: e.y - e.r - 10, t: 0, v: 'HEAL', color: '#7dff8a' });
    } else if (ab === 'frenzy') {
      this.queryEnemies(e.x, e.y, 180, function (o) { o.frenzyT = 3.5; });
      e.frenzyT = 4;
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 240, t: 0, T: 0.6, color: '#ff6a2a' });
      this.texts.push({ x: e.x, y: e.y - e.r - 10, t: 0, v: 'FRENZY!', color: '#ff6a2a' });
    } else if (ab === 'kegs') {
      var kn = 4 + Math.min(Math.floor(this.tier / 4), 4), gk = this;
      for (var kq = 0; kq < kn; kq++) {
        var ka = Math.random() * TAU, kd = kq === 0 ? 30 : 60 + Math.random() * 140;
        (function (x, y) {
          gk.effects.push({ kind: 'keg', x: x, y: y, t: 0, T: 1.3 });
          gk.effects.push({ kind: 'warn', x: x, y: y, r: 55, t: 0, T: 1.3 });
          gk.timers.push({ at: gk.time + 1.3, fn: function () {
            gk.impact(x, y, 55, e.dmg * 0.8, '#ff9b30');
            gk.emit(x, y, 10, ['#ff5ad1', '#5ad1ff', '#ffd23a'][Math.random() * 3 | 0], 200, 0.6, 3, 120);
          } });
        })(p.x + Math.cos(ka) * kd, p.y + Math.sin(ka) * kd);
      }
      ZN.Audio.play('boom', 200);
    } else if (ab === 'tentacles') {
      var tn = 4 + Math.min(Math.floor(this.tier / 4), 4), g = this;
      for (var q = 0; q < tn; q++) {
        var qa = Math.random() * TAU, qd = q === 0 ? 0 : 50 + Math.random() * 110;
        (function (x, y) {
          g.effects.push({ kind: 'warn', x: x, y: y, r: 42, t: 0, T: 1.0 });
          g.timers.push({ at: g.time + 1.0, fn: function () {
            g.effects.push({ kind: 'tentacle', x: x, y: y, t: 0, T: 0.6, color: bd.skin });
            var dx = g.player.x - x, dy = g.player.y - y;
            if (dx * dx + dy * dy < 44 * 44) g.hurtPlayer(e.dmg * 0.9);
            g.shake = Math.max(g.shake, 4);
          } });
        })(p.x + Math.cos(qa) * qd, p.y + Math.sin(qa) * qd);
      }
    }
    else if (ab === 'volley') {
      var n = 12 + Math.min(this.tier, 12), off = Math.random() * TAU;
      for (var k = 0; k < n; k++) {
        var aa = off + k / n * TAU;
        this.enemyShots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 135, vy: Math.sin(aa) * 135, r: 7, dmg: e.dmg * 0.6, life: 4, color: bd.shot || '#ff6b6b' });
      }
      ZN.Audio.play('zap', 100);
    } else if (ab === 'dive') {
      e.submerged = true; e.subT = 2.8; e.marked = false;
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 70, t: 0, T: 0.5, color: bd.shot || '#6fd0c0' });
    } else if (ab === 'slam') {
      e.slamT = 0.95;
      this.effects.push({ kind: 'warn', x: e.x, y: e.y, r: bd.mini ? 100 : 150, t: 0, T: 0.95, follow: e });
    } else {
      var m = bd.mini ? 3 + Math.min(Math.floor(this.tier / 4), 3) : 4 + Math.min(Math.floor(this.tier / 2), 8);
      for (var i = 0; i < m; i++) {
        var a = i / m * TAU;
        this.spawnEnemy(bd.minion || (Math.random() < 0.5 ? 'runner' : 'shambler'), e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
      }
      this.effects.push({ kind: 'ring', x: e.x, y: e.y, r: 10, maxR: 90, t: 0, T: 0.5, color: bd.color });
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
      if (pr.boomerang && pr.life < pr.maxLife * 0.5) {
        if (!pr.returning) { pr.returning = true; pr.hit = {}; }
        var bx = this.player.x - pr.x, by = this.player.y - pr.y, bl = Math.sqrt(bx * bx + by * by) || 1;
        pr.vx = bx / bl * pr.speed; pr.vy = by / bl * pr.speed;
        if (bl < 20) continue;
      }
      if (pr.life <= 0) { if (pr.explode) this.projBurst(pr); continue; }
      if (pr.homing) {
        pr.retT = (pr.retT || 0) - dt;
        if (pr.retT <= 0 || !pr.tgt || pr.tgt.dead) { pr.retT = 0.15; pr.tgt = this.nearestEnemy(pr.x, pr.y, 330, pr.hit); }
        if (pr.tgt) {
          var cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(pr.tgt.y - pr.y, pr.tgt.x - pr.x);
          cur += clamp(ZN.util.angDiff(want, cur), -7 * dt, 7 * dt);
          pr.vx = Math.cos(cur) * pr.speed; pr.vy = Math.sin(cur) * pr.speed;
        }
      }
      pr.bounced = false;
      this.queryEnemies(pr.x, pr.y, pr.r, function (e) {
        if (pr.pierce <= 0 || pr.hit[e.id] || pr.bounced) return;
        pr.hit[e.id] = 1; pr.pierce--;
        if (pr.bounce && pr.pierce > 0) {
          var nx = g.nearestEnemy(e.x, e.y, 240, pr.hit);
          if (nx) {
            var ba = Math.atan2(nx.y - e.y, nx.x - e.x);
            pr.vx = Math.cos(ba) * pr.speed; pr.vy = Math.sin(ba) * pr.speed; pr.x = e.x; pr.y = e.y; pr.bounced = true;
            pr.life = Math.max(pr.life, 0.7);
          } else pr.pierce = 0;
        }
        g.damage(e, pr.dmg, { kb: pr.kb || 0, kx: pr.vx, ky: pr.vy, burn: pr.burn, slow: pr.slow, freeze: pr.freeze, silent: pr.silent, crit: pr.crit, critMul: pr.critMul });
        if (pr.chain && !e.dead && pr.chained < 3) { pr.chained = (pr.chained || 0) + 1; ZN.chainLightning(g, e, pr.chain, pr.dmg * 0.5, 140, '#9ff3ff'); }
      });
      if (pr.pierce > 0) out.push(pr); else if (pr.explode) this.projBurst(pr);
    }
    this.projectiles = out;

    var p = this.player, shots = [];
    for (var j = 0; j < this.enemyShots.length; j++) {
      var s = this.enemyShots[j];
      s.life -= dt;
      if (s.homing) {
        var sc = Math.atan2(s.vy, s.vx), sw = Math.atan2(p.y - s.y, p.x - s.x), sv = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        sc += clamp(ZN.util.angDiff(sw, sc), -2.2 * dt, 2.2 * dt);
        s.vx = Math.cos(sc) * sv; s.vy = Math.sin(sc) * sv;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
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
        this.queryEnemies(pl.x, pl.y, pl.r, function (e) { g.damage(e, pl.dmg, { burn: pl.burn, slow: pl.slow, freeze: pl.freeze, silent: true }); });
      }
      if (pl.life > 0) out.push(pl);
    }
    this.pools = out;
  };

  G.updatePickups = function (dt) {
    var p = this.player, mag = this.stat.magnet, out = [];
    for (var i = 0; i < this.pickups.length; i++) {
      var k = this.pickups[i], dx = p.x - k.x, dy = p.y - k.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (k.type === 'buff') { k.life -= dt; if (k.life <= 0) continue; }
      if (k.type !== 'chest' && k.type !== 'buff' && d < mag) k.mag = true;
      if (k.mag) { k.sp = Math.min((k.sp || 120) + 900 * dt, 900); k.x += dx / d * k.sp * dt; k.y += dy / d * k.sp * dt; }
      if (d < p.r + (k.type === 'buff' ? 18 : 10)) { this.collect(k); continue; }
      out.push(k);
    }
    this.pickups = out;
  };

  G.collect = function (k) {
    var p = this.player;
    if (k.type === 'gem') {
      var xpv = k.v * (this.buffs.doubleXp > 0 ? 2 : 1);
      this.runXp += xpv;
      p.xp += xpv * this.stat.growth;
      while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext; p.level++; this.pendingLevels++;
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 70, t: 0, T: 0.5, color: '#5cc8ff' });
        this.emit(p.x, p.y - 10, 14, '#ffd23a', 160, 0.7, 3, 200);
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
    } else if (k.type === 'token') {
      this.runTokens++; ZN.Audio.play('coin', 60);
      if (this.texts.length < 70) this.texts.push({ x: p.x, y: p.y - 24, t: 0, v: this.season.token, color: '#ffffff' });
    } else if (k.type === 'buff') {
      this.activateBuff(k.id);
    } else if (k.type === 'chest') {
      if (this.victory) return;
      var g = this;
      this.modal = true;
      var rewards = this.openChest();
      this.opts.onChest(rewards, function () { g.modal = false; g.last = performance.now(); });
    }
  };

  // Simple particles: x, y, vx, vy, life, gravity
  G.emit = function (x, y, n, color, speed, life, size, grav) {
    if (this.particles.length > 260) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life: life * (0.6 + Math.random() * 0.4), max: life,
        color: color, size: size || 3, grav: grav === undefined ? 320 : grav });
    }
  };

  G.activateBuff = function (id) {
    var b = ZN.BUFFS[id], p = this.player;
    this.buffsCollected = (this.buffsCollected || 0) + 1;
    this.buffs[id] = b.time * (id === 'freeze' ? this.stat.duration : 1);
    if (id === 'freeze') this.enemies.forEach(function (e) { if (e.def.boss) e.slowT = Math.max(e.slowT, b.time); });
    this.computeStats();
    this.banner('', b.icon + ' ' + b.name.toUpperCase() + '!');
    this.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: 220, t: 0, T: 0.6, color: b.color });
    this.emit(p.x, p.y - 10, 20, b.color, 200, 0.8, 3.5, 100);
    this.juice(6, [40, 30, 60]);
    ZN.Audio.play('levelup');
    if (this.opts.onBuff) this.opts.onBuff(this);
  };

  G.updateEffects = function (dt) {
    var out = [], i;
    var ps = [];
    for (i = 0; i < this.particles.length; i++) {
      var q = this.particles[i]; q.life -= dt;
      if (q.life <= 0) continue;
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.96;
      ps.push(q);
    }
    this.particles = ps;
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
    if (this.shake > 0.2 && ZN.Save.data.shake !== false) { camX += rand(-1, 1) * this.shake; camY += rand(-1, 1) * this.shake; }
    ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);

    this.drawGround(camX, camY);
    var i;
    for (i = 0; i < this.pools.length; i++) this.drawPool(this.pools[i]);
    if (this.wevent) this.drawWaveEvent(ctx);
    for (i = 0; i < this.hazards.length; i++) {
      var hz = this.hazards[i];
      if (hz.delay > 0) {
        ctx.strokeStyle = 'rgba(140,220,80,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(hz.x, hz.y, hz.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      ctx.globalAlpha = Math.min(1, hz.life) * 0.45; ctx.fillStyle = hz.color;
      for (var hc = 0; hc < 5; hc++) {
        var ha = this.time * 0.8 + hc * 1.26;
        ctx.beginPath(); ctx.arc(hz.x + Math.cos(ha) * hz.r * 0.4, hz.y + Math.sin(ha) * hz.r * 0.3, hz.r * 0.55, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < this.effects.length; i++) { var ek = this.effects[i].kind; if (ek === 'splat' || ek === 'corpse') this.drawEffect(this.effects[i]); }
    for (i = 0; i < this.pickups.length; i++) this.drawPickup(this.pickups[i]);
    var vx0 = camX - 60, vx1 = camX + this.viewW + 60, vy0 = camY - 60, vy1 = camY + this.viewH + 60;
    for (i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.x > vx0 && e.x < vx1 && e.y > vy0 && e.y < vy1) this.drawEnemy(e);
    }
    if (this.pet && this.pet.y <= p.y) ZN.drawPet(this, ctx, this.pet);
    this.drawPlayer();
    if (this.pet && this.pet.y > p.y) ZN.drawPet(this, ctx, this.pet);
    for (i = 0; i < this.projectiles.length; i++) this.drawProjectile(this.projectiles[i]);
    ctx.fillStyle = '#9be03a';
    for (i = 0; i < this.enemyShots.length; i++) { var s = this.enemyShots[i]; ctx.fillStyle = s.color || '#9be03a'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    for (i = 0; i < this.weapons.length; i++) if (ZN.WEAPON_DRAW[this.weapons[i].id]) ZN.WEAPON_DRAW[this.weapons[i].id](this, ctx, this.weapons[i]);
    for (i = 0; i < this.effects.length; i++) { var ek2 = this.effects[i].kind; if (ek2 !== 'splat' && ek2 !== 'corpse') this.drawEffect(this.effects[i]); }
    for (i = 0; i < this.particles.length; i++) {
      var q = this.particles[i];
      ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    this.drawTexts();

    // screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mods.fog || this.trait === 'fog' || this.trait === 'night') {
      var cxs = this.cssW / 2, cys = this.cssH / 2, night = this.trait === 'night' && !this.mods.fog;
      var fr = (this.mods.fog ? 175 : night ? 210 : 250) * this.scale;
      var fg = ctx.createRadialGradient(cxs, cys, fr * (night ? 0.5 : 0.4), cxs, cys, fr);
      var col = night ? '8,10,22' : '150,150,140', alpha = this.mods.fog ? 0.96 : night ? 0.88 : 0.8;
      fg.addColorStop(0, 'rgba(' + col + ',0)'); fg.addColorStop(1, 'rgba(' + col + ',' + alpha + ')');
      ctx.fillStyle = fg; ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (this.trait === 'storm') {
      ctx.strokeStyle = 'rgba(180,200,230,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var rn = 0; rn < 60; rn++) {
        var rx = (rn * 97 + this.time * 380) % (this.cssW + 60) - 30, ry = (rn * 53 + this.time * 900 + rn * rn) % (this.cssH + 40) - 20;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 14);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,30,50,0.18)'; ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (this.season) ZN.drawSeasonOverlay(this, ctx, this.season);
    this.drawMarkers();
    if (!this.mods.fog && this.trait !== 'fog') this.drawMinimap();
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

  // ---------------------------------------------------------- terrain
  var SOLID = { tree: 13, stone: 12, hay: 13, car: 17, tractor: 15, bin: 10, barrel: 10, grave: 8, wall: 0 };
  // Decor in a 120px tile (shared by drawing and collision). Spawn area and landmark stay clear.
  G.decorAt = function (tx, ty) {
    if (Math.abs(tx) <= 2 && ty >= -4 && ty <= 1) return null;
    var h = hash(tx, ty, this.seed);
    if (h % 100 >= 30) return null;
    var type = this.style.decor[(h >> 5) % this.style.decor.length];
    return { type: type, x: tx * 120 + 20 + (h >> 11) % 80, y: ty * 120 + 20 + (h >> 17) % 80, r: SOLID[type] || 0, h: h };
  };
  G.bogAt = function (tx, ty) {
    if (this.trait !== 'bog' || (Math.abs(tx) <= 1 && Math.abs(ty) <= 1)) return null;
    var h = hash(tx * 3 + 11, ty * 5 + 7, this.seed + 99);
    if (h % 100 >= 22) return null;
    return { x: tx * 120 + 60 + ((h >> 8) % 30) - 15, y: ty * 120 + 60 + ((h >> 14) % 30) - 15, rx: 46 + h % 14, ry: 30 + (h >> 4) % 10 };
  };
  G.inBog = function (x, y) {
    if (this.trait !== 'bog') return false;
    var tx = Math.floor(x / 120), ty = Math.floor(y / 120);
    for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
      var b = this.bogAt(tx + i, ty + j);
      if (!b) continue;
      var dx = (x - b.x) / b.rx, dy = (y - b.y) / b.ry;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  };
  // Push a body out of solid scenery
  G.pushOut = function (o, r) {
    var tx = Math.floor(o.x / 120), ty = Math.floor(o.y / 120);
    for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
      var dcr = this.decorAt(tx + i, ty + j);
      if (!dcr || !dcr.r) continue;
      var dx = o.x - dcr.x, dy = o.y - (dcr.y + 2), dd = Math.sqrt(dx * dx + dy * dy) || 0.01, min = r + dcr.r;
      if (dd < min) { o.x = dcr.x + dx / dd * min; o.y = dcr.y + 2 + dy / dd * min; }
    }
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
      var bg = this.bogAt(tx, ty);
      if (bg) {
        ctx.fillStyle = '#3a2e1a'; ctx.beginPath(); ctx.ellipse(bg.x, bg.y, bg.rx, bg.ry, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4a3c22'; ctx.beginPath(); ctx.ellipse(bg.x - 6, bg.y - 4, bg.rx * 0.7, bg.ry * 0.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(120,140,80,0.5)'; ctx.beginPath(); ctx.arc(bg.x + 10, bg.y + Math.sin(this.time * 2 + tx) * 3, 3, 0, TAU); ctx.fill();
      }
    }
    for (tx = tx0; tx <= tx1; tx++) for (ty = ty0; ty <= ty1; ty++) {
      var dc = this.decorAt(tx, ty);
      if (dc) this.drawDecor(dc.type, dc.x, dc.y, dc.h);
    }
    if (camX < 280 && camX + this.viewW > -280 && camY < 0 && camY + this.viewH > -520) ZN.drawLandmark(this, ctx, this.landmark, 0, -250);
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
    gr.addColorStop(0, pl.slow ? '#ffffff' : '#ffd23a'); gr.addColorStop(0.5, pl.color || '#ff6a00'); gr.addColorStop(1, 'rgba(255,40,0,0)');
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
    } else if (k.type === 'token') {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.sin(this.time * 6 + k.x) * 0.1) + ')';
      ctx.beginPath(); ctx.arc(k.x, k.y + bob, 10, 0, TAU); ctx.fill();
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.season ? this.season.token : '⭐', k.x, k.y + bob + 1); ctx.textBaseline = 'alphabetic';
    } else if (k.type === 'buff') {
      var bd = ZN.BUFFS[k.id];
      if (k.life < 5 && Math.floor(this.time * 8) % 2) return;
      var pulse = 1 + Math.sin(this.time * 6) * 0.12;
      var gr = ctx.createRadialGradient(k.x, k.y + bob, 2, k.x, k.y + bob, 22 * pulse);
      gr.addColorStop(0, bd.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 22 * pulse, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 12, this.time * 4, this.time * 4 + 4.5); ctx.stroke();
      ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(bd.icon, k.x, k.y + bob + 1); ctx.textBaseline = 'alphabetic';
    } else if (k.type === 'chest') {
      var glow = 0.4 + Math.sin(this.time * 6) * 0.2;
      ctx.fillStyle = 'rgba(255,215,0,' + glow + ')'; ctx.beginPath(); ctx.arc(k.x, k.y, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a4a1f'; ctx.fillRect(k.x - 13, k.y - 9 + bob, 26, 18);
      ctx.fillStyle = '#e0b030'; ctx.fillRect(k.x - 13, k.y - 2 + bob, 26, 3); ctx.fillRect(k.x - 2, k.y - 4 + bob, 4, 7);
    }
  };

  G.drawEnemy = function (e) {
    var ctx = this.ctx, def = e.def, r = e.r, dir = e.dir || 0;
    if (e.enraged) ZN.drawEnrage(this, ctx, e);
    if (e.frenzyT > 0 && Math.floor(this.time * 10) % 2) { ctx.fillStyle = 'rgba(255,106,42,0.25)'; ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, TAU); ctx.fill(); }
    if (e.submerged) {
      ctx.strokeStyle = 'rgba(160,220,210,0.7)'; ctx.lineWidth = 3;
      for (var q = 0; q < 3; q++) { var rr = r * (0.5 + ((this.time * 1.5 + q / 3) % 1) * 0.9); ctx.globalAlpha = 1 - ((this.time * 1.5 + q / 3) % 1); ctx.beginPath(); ctx.ellipse(e.x, e.y, rr, rr * 0.5, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (def.shape === 'nessie') { ctx.fillStyle = def.color; ctx.beginPath(); ctx.ellipse(e.x, e.y, r * 0.5, r * 0.2, 0, Math.PI, TAU); ctx.fill(); }
      return;
    }
    if (def.flyer || (def.shape && def.shape !== 'zombie')) { ZN.drawSpecial(this, ctx, e); this.drawHpBar(e); return; }
    if (!def.boss && ZN.Sprites.has(e.type)) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.9, r * 0.9, r * 0.35, 0, 0, TAU); ctx.fill();
      if (e.windT > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.cdx * 260, e.y + e.cdy * 260); ctx.stroke(); }
      ZN.Sprites.enemy(ctx, e, this.time);
      if (def.accessory) ZN.drawAccessory(this, ctx, e);
      else if (def.regional) ZN.drawRegionalFlair(this, ctx, e);
      else if (this.season && !def.elite && e.spawnT <= 0) ZN.drawSeasonHat(this, ctx, e, this.season);
      if (e.freezeT > 0 || this.buffs.freeze > 0) { ctx.fillStyle = 'rgba(160,220,255,0.45)'; ctx.beginPath(); ctx.arc(e.x, e.y, r + 3, 0, TAU); ctx.fill(); }
      else if (e.slowT > 0) { ctx.strokeStyle = 'rgba(140,210,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.9, r, r * 0.4, 0, 0, TAU); ctx.stroke(); }
      if (e.burnT > 0) { ctx.fillStyle = 'rgba(255,' + (100 + (Math.random() * 80 | 0)) + ',0,0.75)'; ctx.beginPath(); ctx.arc(e.x + rand(-r, r) * 0.5, e.y - r * 0.4, r * 0.3, 0, TAU); ctx.fill(); }
      this.drawHpBar(e);
      return;
    }
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
    this.drawHpBar(e);
  };

  G.drawHpBar = function (e) {
    var ctx = this.ctx, def = e.def, r = e.r;
    if (def.elite || def.boss || (e.hp < e.maxHp && e.maxHp > 40)) {
      var bw = r * 2;
      ctx.fillStyle = '#300'; ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw, 4);
      ctx.fillStyle = def.boss ? '#ff3b3b' : def.elite ? '#d07aff' : '#f0c040'; ctx.fillRect(e.x - bw / 2, e.y - r - 10, bw * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
  };

  G.drawPlayer = function () {
    var ctx = this.ctx, p = this.player, x = p.x, y = p.y;
    if (p.iframes > 0 && Math.floor(this.time * 20) % 2) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 11, 4.5, 0, 0, TAU); ctx.fill();
    var b = this.buffs, o = { rot: this.input.x * 0.12 };
    if (this.dying) { var fp = clamp(1 - this.endT / 1.6, 0, 1) * 1.6; o.rot = -Math.min(1, fp * 2) * Math.PI / 2 * (p.fx < 0 ? -1 : 1); }
    if (b.doubleWeapons > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (0.18 + Math.sin(this.time * 10) * 0.08) + ')';
      ctx.beginPath(); ctx.arc(x, y - 4, 24, 0, TAU); ctx.fill();
    }
    if (b.invincible > 0) {
      var gl = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 34);
      gl.addColorStop(0, 'rgba(255,230,120,0.6)'); gl.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - 6, 34, 0, TAU); ctx.fill();
      o.tint = 'hsl(' + ((this.time * 400) % 360 | 0) + ',100%,60%)'; o.tintA = 0.45;
      if (Math.random() < 0.3) this.emit(x + rand(-12, 12), y - 10 + rand(-14, 6), 1, '#ffe27a', 30, 0.5, 2.5, -40);
    } else if (p.hurtT > 0) { o.tint = '#ff2020'; o.tintA = 0.7; o.sx = 1.12; o.sy = 0.9; }
    if (b.doubleSpeed > 0 && p.moving) {
      ctx.globalAlpha = 0.25; ZN.Sprites.player(ctx, this.char, p, x - p.fx * 16, y - p.fy * 16, this.time, { rot: o.rot, tint: '#5ad1ff', tintA: 1 });
      ctx.globalAlpha = 0.12; ZN.Sprites.player(ctx, this.char, p, x - p.fx * 30, y - p.fy * 30, this.time, { rot: o.rot, tint: '#5ad1ff', tintA: 1 });
      ctx.globalAlpha = 1;
    }
    ZN.Sprites.player(ctx, this.char, p, x, y, this.time, o);
    if (this.dying) return;
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
    if (pr.kind === 'rocket') {
      ctx.fillStyle = pr.color; ctx.fillRect(-6, -2.5, 12, 5);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(10, 0); ctx.lineTo(6, 2.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,80,' + (0.5 + Math.random() * 0.5) + ')'; ctx.beginPath(); ctx.arc(-8, 0, 3 + Math.random() * 2, 0, TAU); ctx.fill();
      if (Math.random() < 0.5) this.particles.length < 250 && this.particles.push({ x: pr.x, y: pr.y, vx: -pr.vx * 0.1, vy: -pr.vy * 0.1, life: 0.3, max: 0.3, color: '#ffd23a', size: 2, grav: 0 });
    } else if (pr.kind === 'snowball') {
      ctx.fillStyle = '#f4faff'; ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c8e0f0'; ctx.beginPath(); ctx.arc(1.5, 1.5, pr.r * 0.5, 0, TAU); ctx.fill();
    } else if (pr.kind === 'shard') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -2.5); ctx.lineTo(-3, 2.5); ctx.fill();
    } else if (pr.kind === 'pellet') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,0.35)'; ctx.fillRect(-pr.r * 3, -pr.r * 0.5, pr.r * 3, pr.r);
    } else if (pr.kind === 'dart') {
      ctx.fillStyle = '#d0d4da'; ctx.fillRect(2, -1, 7, 2);
      ctx.fillStyle = '#222'; ctx.fillRect(-4, -1.5, 7, 3);
      ctx.fillStyle = pr.critMul >= 3 ? '#ffd23a' : '#e05050';
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-10, -4); ctx.lineTo(-8, 0); ctx.lineTo(-10, 4); ctx.fill();
    } else if (pr.kind === 'pigeon') {
      var flap = Math.sin(this.time * 30 + pr.x) * 4;
      ctx.fillStyle = '#c8ccd8'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#a0a8b8'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-6, -6 - flap); ctx.lineTo(3, -1); ctx.moveTo(-2, 0); ctx.lineTo(-6, 6 + flap); ctx.lineTo(3, 1); ctx.fill();
      ctx.fillStyle = '#5a7a6a'; ctx.beginPath(); ctx.arc(6, 0, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffb030'; ctx.fillRect(8, -0.8, 3, 1.6);
    } else if (pr.kind === 'ball') {
      ctx.rotate(this.time * 20);
      ctx.fillStyle = '#b81c28'; ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#f0e0c0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.65, -0.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.65, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
    } else if (pr.kind === 'bat') {
      ctx.rotate(this.time * 18);
      ctx.fillStyle = '#d9b77a'; ctx.fillRect(-14, -4, 22, 8); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(8, -2, 9, 4);
    } else if (pr.kind === 'harpoon') {
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-18, -1.5, 22, 3);
      ctx.fillStyle = pr.color || '#cfd6de'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(2, -5); ctx.lineTo(4, 0); ctx.lineTo(2, 5); ctx.fill();
    } else if (pr.kind === 'bolt') {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-pr.r * 3, -pr.r * 0.25, pr.r * 5, pr.r * 0.5);
      ctx.fillStyle = pr.color || '#ccc'; ctx.beginPath(); ctx.moveTo(pr.r * 3, 0); ctx.lineTo(pr.r * 1.6, -pr.r * 0.8); ctx.lineTo(pr.r * 1.6, pr.r * 0.8); ctx.fill();
    } else {
      ctx.fillStyle = pr.color || '#ffe08a';
      ctx.fillRect(-pr.r * 2, -pr.r * 0.6, pr.r * 3, pr.r * 1.2);
    }
    ctx.restore();
  };

  G.drawEffect = function (f) {
    if (f.t < 0) return;
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
      case 'lash': {
        var lw = f.w * (0.6 + a * 0.4), n = Math.max(6, Math.abs(f.x2 - f.x1) / 9 | 0);
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x1, f.y); ctx.lineTo(f.x2, f.y); ctx.stroke();
        ctx.strokeStyle = f.color; ctx.lineWidth = 2.5;
        for (i = 0; i <= n; i++) {
          var lx = f.x1 + (f.x2 - f.x1) * i / n, ly = f.y + Math.sin(i * 0.9 + f.t * 30) * lw * 0.25;
          ctx.beginPath(); ctx.ellipse(lx, ly, 4, 2.5, 0, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'tentacle': {
        var th = Math.sin(Math.min(1, f.t / f.T) * Math.PI) * 60;
        ctx.globalAlpha = 1; ctx.fillStyle = f.color || '#a04a8a';
        ctx.beginPath(); ctx.moveTo(f.x - 10, f.y); ctx.quadraticCurveTo(f.x - 14, f.y - th * 0.6, f.x + Math.sin(f.t * 12) * 8, f.y - th);
        ctx.quadraticCurveTo(f.x + 12, f.y - th * 0.5, f.x + 10, f.y); ctx.fill();
        ctx.fillStyle = '#f0c0e0';
        for (i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(f.x + 2, f.y - th * i / 4.5, 2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'keg': {
        var fl = Math.sin(this.time * 30) > 0;
        ctx.globalAlpha = 1; ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, 9, 11, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x - 9, f.y - 10); ctx.lineTo(f.x + 9, f.y - 10); ctx.moveTo(f.x - 9, f.y - 2); ctx.lineTo(f.x + 9, f.y - 2); ctx.stroke();
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(f.x, f.y - 17); ctx.lineTo(f.x + 4, f.y - 23); ctx.stroke();
        if (fl) { ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(f.x + 4, f.y - 24, 2.5, 0, TAU); ctx.fill(); }
        break;
      }
      case 'lob': {
        var lt = f.t / f.T, lx = f.sx + (f.tx - f.sx) * lt, ly = f.sy + (f.ty - f.sy) * lt - Math.sin(lt * Math.PI) * 60;
        ctx.globalAlpha = 1; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(lt * 10); ctx.fillText(f.icon, 0, 0); ctx.restore(); ctx.textBaseline = 'alphabetic';
        break;
      }
      case 'corpse':
        ZN.Sprites.corpse(ctx, f.e, f.t, f.T, f.side); break;
      case 'scratch':
        ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        for (i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(f.x - 6, f.y + i * 4 - 5); ctx.lineTo(f.x + 6, f.y + i * 4 + 5); ctx.stroke(); }
        break;
      case 'warn': {
        var wx = f.follow ? f.follow.x : f.x, wy = f.follow ? f.follow.y : f.y, prog = f.t / f.T;
        ctx.globalAlpha = 0.25 + prog * 0.35; ctx.fillStyle = '#ff2a2a';
        ctx.beginPath(); ctx.arc(wx, wy, f.r * prog, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff5050'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(wx, wy, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        break;
      }
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

  // Off-screen markers for the boss, elites and treasure chests
  G.drawMarkers = function () {
    var g = this, p = this.player, list = [];
    if (this.boss && !this.boss.dead && !this.boss.submerged) list.push([this.boss, '#ff3b3b', 15]);
    for (var i = 0; i < this.enemies.length; i++) { var e = this.enemies[i]; if (e.def.elite && !e.dead) list.push([e, '#d07aff', 11]); }
    for (var j = 0; j < this.pickups.length; j++) if (this.pickups[j].type === 'chest') list.push([this.pickups[j], '#ffd23a', 11]);
    var we = this.wevent;
    if (we) {
      if (we.type === 'convoy') list.push([we.van, '#ffffff', 13]);
      if (we.type === 'hold') list.push([we.zone, '#5aff8a', 13]);
      if (we.type === 'crates') we.crates.forEach(function (c) { if (!c.taken) list.push([c, '#c8a060', 11]); });
      if (we.type === 'bounty' && we.target && !we.target.dead) list.push([we.target, '#ffd23a', 13]);
    }
    var ctx = this.ctx, cx = this.cssW / 2, cy = this.cssH / 2, top = 120, bottom = 30;
    list.forEach(function (it) {
      var t = it[0], dx = t.x - p.x, dy = t.y - p.y;
      if (Math.abs(dx) < g.viewW / 2 - 16 && Math.abs(dy) < g.viewH / 2 - 16) return;
      var a = Math.atan2(dy, dx), rx = cx - 24, ryTop = cy - top, ryBot = cy - bottom;
      var ry = Math.sin(a) < 0 ? ryTop : ryBot;
      var k = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
      var mx = cx + Math.cos(a) * k, my = cy + Math.sin(a) * k, s = it[2];
      ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(s + 2, 0); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(-s * 0.6, s * 0.8); ctx.fill();
      ctx.fillStyle = it[1]; ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.5, -s * 0.65); ctx.lineTo(-s * 0.5, s * 0.65); ctx.fill();
      ctx.restore();
    });
  };

  G.drawMinimap = function () {
    var ctx = this.ctx, R = 44, cx = this.cssW - R - 12, cy = this.cssH - R - 14, range = 650, k = R / range, p = this.player;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(10,14,18,0.7)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.strokeRect(cx - this.viewW / 2 * k, cy - this.viewH / 2 * k, this.viewW * k, this.viewH * k);
    var lx = cx + (0 - p.x) * k, ly = cy + (-250 - p.y) * k;
    ctx.fillStyle = '#8ab4d8'; ctx.fillRect(lx - 3, ly - 3, 6, 6);
    ctx.fillStyle = '#e04848';
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.def.boss || e.def.elite || e.submerged) continue;
      var ex = (e.x - p.x) * k, ey = (e.y - p.y) * k;
      if (ex * ex + ey * ey < R * R) ctx.fillRect(cx + ex - 1, cy + ey - 1, 2, 2);
    }
    for (var j = 0; j < this.pickups.length; j++) if (this.pickups[j].type === 'chest') {
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(cx + (this.pickups[j].x - p.x) * k, cy + (this.pickups[j].y - p.y) * k, 3.5, 0, TAU); ctx.fill();
    }
    for (var m = 0; m < this.enemies.length; m++) {
      var b = this.enemies[m];
      if (!(b.def.boss || b.def.elite) || b.submerged) continue;
      ctx.fillStyle = b.def.boss ? '#ff3b3b' : '#d07aff';
      ctx.beginPath(); ctx.arc(cx + (b.x - p.x) * k, cy + (b.y - p.y) * k, b.def.boss ? 5 : 3.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
  };
})(window.ZN);
