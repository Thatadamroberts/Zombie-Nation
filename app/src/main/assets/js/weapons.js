// Zombie Nation - weapon behaviours (fire logic + persistent visuals)
'use strict';
(function (ZN) {
  var U = ZN.util, TAU = U.TAU, rand = U.rand;

  function ready(g, w, cd, dt) {
    w.t -= dt;
    if (w.t > 0) return false;
    w.t = cd * g.stat.cooldown;
    return true;
  }

  function facing(g) { return Math.atan2(g.player.fy, g.player.fx); }

  function shoot(g, ang, o) {
    g.projectiles.push({ x: g.player.x, y: g.player.y, vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed,
      r: o.r, dmg: o.dmg, pierce: o.pierce, life: o.life, hit: {}, kind: o.kind, color: o.color, kb: o.kb || 0,
      burn: o.burn, slow: o.slow, silent: o.silent, grow: o.grow, drag: o.drag, maxLife: o.life });
  }

  // Melee arc. Returns enemies hit.
  function slash(g, ang, radius, arc, dmg, opts, color) {
    var p = g.player, hits = [];
    g.queryEnemies(p.x, p.y, radius, function (e) {
      var d = Math.sqrt((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y)) || 1;
      var da = Math.abs(U.angDiff(Math.atan2(e.y - p.y, e.x - p.x), ang));
      if (da <= arc / 2 + Math.atan(e.r / d)) hits.push(e);
    });
    hits.forEach(function (e) { g.damage(e, dmg, opts); });
    g.effects.push({ kind: 'slash', ang: ang, arc: arc, r: radius, t: 0, T: 0.18, color: color });
    return hits;
  }

  // Lightning hops from enemy to enemy
  function chain(g, from, count, dmg, range, color) {
    var hit = {}; hit[from.id] = 1;
    var cur = from;
    for (var i = 0; i < count; i++) {
      var nx = g.nearestEnemy(cur.x, cur.y, range, hit);
      if (!nx) break;
      hit[nx.id] = 1;
      g.effects.push({ kind: 'zap', x1: cur.x, y1: cur.y, x2: nx.x, y2: nx.y, t: 0, T: 0.18, color: color });
      g.damage(nx, dmg, { color: '#fff799', silent: true });
      cur = nx;
    }
  }

  // Hits enemies within w of the segment (x1,y1)-(x2,y2)
  function beam(g, x1, y1, x2, y2, width, fn) {
    var dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e.dead) continue;
      var t = U.clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1);
      var px = x1 + dx * t - e.x, py = y1 + dy * t - e.y, rr = width + e.r;
      if (px * px + py * py <= rr * rr) fn(e);
    }
  }

  function orbit(g, w, s, dt, color, drawKind) {
    var p = g.player, area = g.stat.area, R = s.radius * area;
    w.cyc = (w.cyc || 0) + dt;
    var on = s.on * g.stat.duration, cycle = Math.max(s.cycle * g.stat.cooldown, on + 0.5);
    if (s.on < 999 && w.cyc > cycle) w.cyc = 0;
    w.active = s.on >= 999 || w.cyc < on;
    if (!w.active) return;
    w.ang = (w.ang || 0) + s.spin * dt;
    var n = s.amount + g.stat.amount;
    w.n = n; w.R = R;
    for (var i = 0; i < n; i++) {
      var a = w.ang + i * TAU / n, bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
      g.queryEnemies(bx, by, 14 * area, function (e) {
        if ((e.hc[w.id] || 0) > g.time) return;
        e.hc[w.id] = g.time + 0.45;
        g.damage(e, s.dmg, { kb: s.kb || 60, kx: e.x - p.x, ky: e.y - p.y });
      });
    }
  }

  function aura(g, w, s, dt) {
    var p = g.player, R = s.radius * g.stat.area;
    w.R = R;
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.tick;
    var hits = 0;
    g.queryEnemies(p.x, p.y, R, function (e) {
      hits++;
      g.damage(e, s.dmg, { kb: s.kb ? 70 : 8, silent: true, color: '#e8f07a' });
    });
    if (s.heal && hits) p.hp = Math.min(g.stat.maxHp, p.hp + s.heal);
  }

  function throwBottles(g, s, count, color) {
    var p = g.player, R = s.radius * g.stat.area, life = s.life * g.stat.duration;
    for (var i = 0; i < count; i++) {
      var target = g.randomEnemyOnScreen(), tx, ty;
      if (target && Math.abs(target.x - p.x) < 280 && Math.abs(target.y - p.y) < 280) { tx = target.x; ty = target.y; }
      else { var a = Math.random() * TAU, d = rand(60, 180); tx = p.x + Math.cos(a) * d; ty = p.y + Math.sin(a) * d; }
      var T = 0.45;
      g.effects.push({ kind: 'bottle', sx: p.x, sy: p.y, tx: tx, ty: ty, t: 0, T: T });
      (function (tx, ty, delay) {
        setTimeoutGame(g, delay, function () {
          g.pools.push({ x: tx, y: ty, r: R, life: life, tick: 0.35, tickT: 0, dmg: s.dmg, burn: s.burn || 0, color: color });
          ZN.Audio.play('boom', 120);
        });
      })(tx, ty, T);
    }
  }

  // Delayed actions that respect pause (driven by game time)
  function setTimeoutGame(g, delay, fn) {
    g.timers = g.timers || [];
    g.timers.push({ at: g.time + delay, fn: fn });
  }
  ZN.runGameTimers = function (g) {
    if (!g.timers || !g.timers.length) return;
    var keep = [];
    for (var i = 0; i < g.timers.length; i++) { if (g.timers[i].at <= g.time) g.timers[i].fn(); else keep.push(g.timers[i]); }
    g.timers = keep;
  };

  function flames(g, w, s, dt, big) {
    w.t -= dt;
    if (w.t > 0) return;
    w.t = s.cd;
    var p = g.player, range = 110 * s.range * g.stat.area;
    var tgt = g.nearestEnemy(p.x, p.y, range + 40);
    var base = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : facing(g);
    var n = big ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var speed = 260, life = range / speed;
      shoot(g, base + rand(-s.spread, s.spread) / 2, { speed: speed, r: big ? 9 : 6, dmg: s.dmg, pierce: 4, life: life,
        kind: 'flame', burn: s.burn, silent: true, grow: big ? 40 : 26, drag: 0.5 });
    }
  }

  function lightning(g, s, count, chains) {
    var area = g.stat.area, R = s.radius * area;
    for (var i = 0; i < count; i++) {
      var e = g.randomEnemyOnScreen();
      if (!e) return;
      var x = e.x, y = e.y;
      g.effects.push({ kind: 'strike', x: x, y: y, r: R, t: 0, T: 0.25 });
      g.queryEnemies(x, y, R, function (o) { g.damage(o, s.dmg, { color: '#cfe0ff', silent: true }); });
      if (chains && !e.dead) chain(g, e, chains, s.dmg * 0.5, 140, '#cfe0ff');
    }
    ZN.Audio.play('zap', 120);
  }

  ZN.WEAPON_LOGIC = {
    pistol: function (g, w, s, dt) {
      if (w.t > 0) { w.t -= dt; return; }
      var p = g.player, tgt = g.nearestEnemy(p.x, p.y, 420);
      if (!tgt) return;
      w.t = s.cd * g.stat.cooldown;
      var n = s.amount + g.stat.amount, base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      for (var i = 0; i < n; i++) shoot(g, base + (i - (n - 1) / 2) * 0.12, { speed: 480, r: 4, dmg: s.dmg, pierce: s.pierce, life: 1.1, kind: 'bullet', color: '#ffe08a', kb: 20 });
      ZN.Audio.play('shoot', 90);
    },
    minigun: function (g, w, s, dt) {
      if (w.t > 0) { w.t -= dt; return; }
      var p = g.player, tgt = g.nearestEnemy(p.x, p.y, 460);
      if (!tgt) return;
      w.t = s.cd * g.stat.cooldown;
      var n = s.amount + g.stat.amount, base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      for (var i = 0; i < n; i++) shoot(g, base + rand(-0.18, 0.18), { speed: 560, r: 4, dmg: s.dmg, pierce: s.pierce, life: 1, kind: 'bullet', color: '#ffd166', kb: 25, silent: true });
      ZN.Audio.play('shoot', 120);
    },
    iceSword: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      var base = facing(g), n = s.dirs + g.stat.amount;
      for (var i = 0; i < n; i++) {
        slash(g, base + i * TAU / n, s.radius * g.stat.area, 2.2, s.dmg,
          { kb: 30, slow: 1.6, freeze: s.freeze ? 1.0 : 0, color: '#bfe9ff' }, 'rgba(127,212,255,0.55)');
      }
      ZN.Audio.play('slash', 100);
    },
    fireSword: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      w.spin = (w.spin || 0) + 2.4;
      var base = facing(g) + w.spin, n = s.dirs + g.stat.amount;
      for (var i = 0; i < n; i++) {
        slash(g, base + i * TAU / n, s.radius * g.stat.area, 2.0, s.dmg, { kb: 25, burn: s.burn, color: '#ffb38a' }, 'rgba(255,122,61,0.6)');
      }
      ZN.Audio.play('slash', 100);
    },
    elecSword: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      var base = facing(g), n = s.dirs + g.stat.amount;
      for (var i = 0; i < n; i++) {
        var hits = slash(g, base + i * TAU / n, s.radius * g.stat.area, 2.1, s.dmg, { kb: 20, color: '#fff799' }, 'rgba(247,230,74,0.55)');
        for (var k = 0; k < Math.min(2, hits.length); k++) chain(g, hits[k], s.chains, s.dmg * 0.6, 130);
      }
      ZN.Audio.play('zap', 100);
    },
    swordOfLight: function (g, w, s, dt) {
      var p = g.player, area = g.stat.area, R = s.radius * area;
      w.ang = (w.ang || 0) + 3.2 * dt;
      var n = s.blades + g.stat.amount;
      for (var i = 0; i < n; i++) {
        var a = w.ang + i * TAU / n;
        for (var seg = 0.35; seg <= 1.0; seg += 0.325) {
          g.queryEnemies(p.x + Math.cos(a) * R * seg, p.y + Math.sin(a) * R * seg, 12 * area, function (e) {
            if ((e.hc.sol || 0) > g.time) return;
            e.hc.sol = g.time + 0.35;
            g.damage(e, s.dmg, { kb: 50, slow: 1.5, burn: 6, color: '#fffbe0' });
          });
        }
      }
      if (!ready(g, w, s.cd, dt)) return;
      var L = s.beamLen * area, off = Math.random() * TAU, zapped = 0;
      for (var b = 0; b < s.beams; b++) {
        var ang = off + b * TAU / s.beams, x2 = p.x + Math.cos(ang) * L, y2 = p.y + Math.sin(ang) * L;
        g.effects.push({ kind: 'beam', x1: p.x, y1: p.y, x2: x2, y2: y2, w: 12, t: 0, T: 0.35, color: 'rgba(255,240,170,0.9)' });
        beam(g, p.x, p.y, x2, y2, 12 * area, function (e) {
          g.damage(e, s.burstDmg, { kb: 80, kx: Math.cos(ang), ky: Math.sin(ang), freeze: 0.6, burn: 10, silent: true, color: '#fffbe0' });
          if (zapped < 4 && !e.dead) { zapped++; chain(g, e, 3, s.burstDmg * 0.4, 140, '#fff799'); }
        });
      }
      g.effects.push({ kind: 'ring', x: p.x, y: p.y, r: 10, maxR: L * 0.6, t: 0, T: 0.35, color: '#fffbe0' });
      ZN.Audio.play('zap', 100);
    },
    crossbow: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      var base = facing(g), n = s.amount + g.stat.amount;
      for (var i = 0; i < n; i++) shoot(g, base + (i - (n - 1) / 2) * 0.18, { speed: 620, r: 5, dmg: s.dmg, pierce: s.pierce, life: 1.0, kind: 'bolt', color: '#d8d8d8', kb: 40 });
      ZN.Audio.play('shoot', 90);
    },
    ballista: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      var base = facing(g), n = s.amount + g.stat.amount;
      for (var i = 0; i < n; i++) shoot(g, base + (i - (n - 1) / 2) * 0.22, { speed: 700, r: 9, dmg: s.dmg, pierce: s.pierce, life: 1.1, kind: 'bolt', color: '#ffb347', kb: 120 });
      ZN.Audio.play('shoot', 90);
    },
    molotov: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      throwBottles(g, s, s.amount + g.stat.amount, '#ff6a00');
    },
    napalm: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      throwBottles(g, { dmg: s.dmg, radius: s.radius, life: s.life, burn: 6 }, s.amount + g.stat.amount, '#ff2a00');
    },
    cheese: function (g, w, s, dt) { aura(g, w, s, dt); },
    stilton: function (g, w, s, dt) { aura(g, w, s, dt); },
    hubcaps: function (g, w, s, dt) { orbit(g, w, s, dt); },
    buzzsaw: function (g, w, s, dt) { orbit(g, w, { dmg: s.dmg, amount: s.amount, radius: s.radius, spin: s.spin, on: 999, cycle: 999, kb: 90 }, dt); },
    lightning: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      lightning(g, s, s.amount + g.stat.amount, 0);
    },
    thunderstorm: function (g, w, s, dt) {
      if (!ready(g, w, s.cd, dt)) return;
      lightning(g, s, s.amount + g.stat.amount, s.chains);
    },
    flamethrower: function (g, w, s, dt) { flames(g, w, s, dt, false); },
    dragonsBreath: function (g, w, s, dt) { flames(g, w, s, dt, true); }
  };

  // Persistent visuals for auras and orbiting weapons (drawn every frame)
  function drawAura(g, ctx, w, fill, stroke) {
    if (!w.R) return;
    var p = g.player, pulse = 1 + Math.sin(g.time * 4) * 0.03;
    ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(p.x, p.y, w.R * pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]); ctx.lineDashOffset = -g.time * 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, w.R * pulse, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = stroke;
    for (var i = 0; i < 6; i++) {
      var a = g.time * 0.8 + i * 1.05, r = w.R * (0.4 + 0.5 * ((g.time * 0.3 + i * 0.17) % 1));
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 2.5, 0, TAU); ctx.fill();
    }
  }

  function drawOrbit(g, ctx, w, saw) {
    if (!w.active || !w.n) return;
    var p = g.player;
    for (var i = 0; i < w.n; i++) {
      var a = w.ang + i * TAU / w.n, x = p.x + Math.cos(a) * w.R, y = p.y + Math.sin(a) * w.R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(g.time * (saw ? 20 : 10));
      ctx.fillStyle = saw ? '#c7ced6' : '#aab3bd'; ctx.beginPath();
      if (saw) {
        for (var k = 0; k < 16; k++) { var r = k % 2 ? 10 : 15, aa = k * TAU / 16; ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); }
        ctx.closePath();
      } else ctx.arc(0, 0, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5b636c'; ctx.beginPath(); ctx.arc(0, 0, saw ? 5 : 6, 0, TAU); ctx.fill();
      if (!saw) { ctx.fillStyle = '#dfe5ea'; for (var j = 0; j < 5; j++) { ctx.beginPath(); ctx.arc(Math.cos(j * 1.256) * 8, Math.sin(j * 1.256) * 8, 1.5, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
  }

  ZN.WEAPON_DRAW = {
    cheese: function (g, ctx, w) { drawAura(g, ctx, w, 'rgba(232,210,106,0.13)', 'rgba(232,210,106,0.55)'); },
    stilton: function (g, ctx, w) { drawAura(g, ctx, w, 'rgba(150,220,90,0.16)', 'rgba(182,227,106,0.7)'); },
    hubcaps: function (g, ctx, w) { drawOrbit(g, ctx, w, false); },
    buzzsaw: function (g, ctx, w) { drawOrbit(g, ctx, w, true); },
    swordOfLight: function (g, ctx, w) {
      var p = g.player, R = ZN.WEAPONS.swordOfLight.stats().radius * g.stat.area, n = 3 + g.stat.amount;
      for (var i = 0; i < n; i++) {
        var a = (w.ang || 0) + i * TAU / n;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        var gr = ctx.createLinearGradient(R * 0.25, 0, R, 0);
        gr.addColorStop(0, 'rgba(127,212,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,170,90,0.9)'); gr.addColorStop(1, 'rgba(255,250,200,1)');
        ctx.fillStyle = gr; ctx.shadowColor = '#fff6c0'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(R * 0.25, -4); ctx.lineTo(R * 0.92, -5); ctx.lineTo(R * 1.05, 0); ctx.lineTo(R * 0.92, 5); ctx.lineTo(R * 0.25, 4); ctx.fill();
        ctx.fillStyle = '#ffd700'; ctx.fillRect(R * 0.2, -9, 5, 18);
        ctx.restore();
      }
    }
  };
})(window.ZN);
