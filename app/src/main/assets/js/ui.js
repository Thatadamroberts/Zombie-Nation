// Zombie Nation - screens, menus, campaign map and mission flow
'use strict';
(function (ZN) {
  var $ = function (id) { return document.getElementById(id); };
  var Save = ZN.Save, game = null, selected = null, current = 'title', prevScreen = 'title', bannerTimer = null;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function fmt(n) { return Math.floor(n).toLocaleString('en-GB'); }

  function show(name) {
    if (name === 'back') name = prevScreen;
    if (name !== current && current !== 'game') prevScreen = current;
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    current = name;
    if (name === 'map') renderMap();
    if (name === 'shop') renderShop();
    if (name === 'armoury') renderArmoury();
    if (name === 'title') updateSoundButtons();
  }
  ZN.show = show;

  function overlay(id, on) { $(id).classList.toggle('hidden', !on); }

  function confirmBox(title, text, onYes) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    overlay('ov-confirm', true);
    $('confirm-yes').onclick = function () { overlay('ov-confirm', false); onYes(); };
    $('confirm-no').onclick = function () { overlay('ov-confirm', false); };
  }

  function updateSoundButtons() {
    var t = 'Sound: ' + (Save.data.sound ? 'On' : 'Off');
    $('btn-sound').textContent = t; $('pause-sound').textContent = t;
  }

  // -------------------------------------------------------------- map
  var mapBuilt = false, paths = {}, labels = {};

  function buildMapSvg() {
    var M = ZN.buildMap();
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + M.width + ' ' + M.height);
    var bg = document.createElementNS(SVGNS, 'rect');
    bg.setAttribute('class', 'sea'); bg.setAttribute('width', M.width); bg.setAttribute('height', M.height);
    svg.appendChild(bg);
    for (var k in M.outlines) {
      var o = document.createElementNS(SVGNS, 'path');
      o.setAttribute('class', 'land-outline');
      o.setAttribute('d', 'M' + M.outlines[k].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z');
      svg.appendChild(o);
    }
    ZN.FERRIES.forEach(function (f) {
      var a = M.byId[f[0]].center, b = M.byId[f[1]].center, l = document.createElementNS(SVGNS, 'path');
      l.setAttribute('class', 'ferry');
      l.setAttribute('d', 'M' + a[0] + ',' + a[1] + 'Q' + ((a[0] + b[0]) / 2) + ',' + ((a[1] + b[1]) / 2 - 20) + ' ' + b[0] + ',' + b[1]);
      svg.appendChild(l);
    });
    M.counties.forEach(function (c) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', 'M' + c.poly.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L') + 'Z');
      p.setAttribute('class', 'county');
      p.addEventListener('click', function () { selectCounty(c.id); });
      svg.appendChild(p);
      paths[c.id] = p;
    });
    M.counties.forEach(function (c) {
      var t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', c.center[0].toFixed(1)); t.setAttribute('y', (c.center[1] + 3).toFixed(1));
      t.setAttribute('class', 'county-label');
      t.textContent = c.short;
      svg.appendChild(t);
      labels[c.id] = t;
    });
    $('map-holder').appendChild(svg);
    ZN.mapSvg = svg;
    mapBuilt = true;
  }

  function sizeMap() {
    var M = ZN.MAP, holder = $('map-scroll');
    var w = Math.max(holder.clientWidth, Math.min(900, holder.clientWidth * 2.1));
    ZN.mapSvg.setAttribute('width', Math.round(w));
    ZN.mapSvg.setAttribute('height', Math.round(w * M.height / M.width));
    return w / M.width;
  }

  function scrollToCounty(id) {
    var k = sizeMap(), c = ZN.MAP.byId[id], holder = $('map-scroll');
    holder.scrollLeft = c.center[0] * k - holder.clientWidth / 2;
    holder.scrollTop = c.center[1] * k - holder.clientHeight / 2;
  }

  function renderMap() {
    if (!mapBuilt) buildMapSvg();
    var M = ZN.MAP, d = Save.data;
    M.counties.forEach(function (c) {
      var st = Save.isCleared(c.id) ? 'cleared' : Save.isAvailable(c.id) ? 'available' : 'locked';
      paths[c.id].setAttribute('class', 'county ' + st + (selected === c.id ? ' selected' : ''));
      labels[c.id].setAttribute('class', 'county-label ' + st);
    });
    $('map-coins').textContent = fmt(d.coins);
    $('map-level').textContent = 'Survivor Level ' + d.accLevel;
    $('map-progress').textContent = Save.clearedCount() + ' / ' + M.counties.length + ' liberated';
    $('map-xpbar').style.width = Math.min(100, d.accXp / ZN.accountXpFor(d.accLevel) * 100) + '%';
    var focus = selected || d.lastCounty;
    if (!focus) {
      var avail = M.counties.filter(function (c) { return Save.isAvailable(c.id) && !Save.isCleared(c.id); });
      focus = Save.clearedCount() ? (avail[0] && avail[0].id) : 'london';
    }
    if (!renderMap.scrolled) { requestAnimationFrame(function () { scrollToCounty(focus || 'london'); }); renderMap.scrolled = true; }
    else sizeMap();
    if (selected) selectCounty(selected, true); else $('county-panel').classList.add('hidden');
  }

  function selectCounty(id, quiet) {
    var c = ZN.MAP.byId[id];
    if (selected && paths[selected]) paths[selected].classList.remove('selected');
    selected = id;
    paths[id].classList.add('selected');
    if (!quiet) ZN.Audio.play('click');
    var cleared = Save.isCleared(id), avail = Save.isAvailable(id), waves = Save.wavesFor(id);
    var st = cleared ? 'cleared' : avail ? 'available' : 'locked';
    $('cp-name').textContent = c.name;
    var tag = $('cp-status');
    tag.className = 'tag ' + st;
    tag.textContent = cleared ? 'LIBERATED' : avail ? 'ATTACKABLE' : 'OVERRUN';
    var tier = cleared ? waves - 1 : Save.clearedCount();
    var threat = ['Low', 'Moderate', 'High', 'Severe', 'Extreme', 'Apocalyptic'][Math.min(5, Math.floor(tier / 4))];
    var neighbours = c.adj.map(function (n) { return ZN.MAP.byId[n].short; }).join(', ');
    var info = '<b>' + waves + '</b> wave' + (waves > 1 ? 's' : '') + ' + horde boss · Threat: <b>' + threat + '</b><br>Borders: ' + neighbours;
    if (!avail) info += '<br><span style="color:#f99">Liberate a neighbouring county first.</span>';
    if (cleared) info += '<br>Replay to farm coins and XP.';
    if (!Save.clearedCount()) info += '<br>Choose any county to begin your campaign.';
    $('cp-info').innerHTML = info;
    var go = $('cp-go');
    go.disabled = !avail;
    go.textContent = cleared ? 'Replay Mission' : avail ? 'Liberate ' + c.short : 'Locked';
    $('county-panel').classList.remove('hidden');
  }

  // ------------------------------------------------------------- shop
  function renderShop() {
    var list = $('shop-list'), d = Save.data;
    list.innerHTML = '';
    $('shop-coins').textContent = fmt(d.coins);
    list.appendChild(el('div', 'section-h', 'Spend coins from missions'));
    ZN.SHOP.forEach(function (item) {
      var rank = d.shop[item.id] || 0, maxed = rank >= item.max, cost = ZN.shopCost(item, rank);
      var row = el('div', 'item');
      row.appendChild(el('div', 'ico', item.icon));
      var body = el('div', 'body');
      body.appendChild(el('div', 'name', item.name));
      body.appendChild(el('div', 'desc', item.desc + ' per rank'));
      var pips = el('div', 'pips');
      for (var i = 0; i < item.max; i++) pips.appendChild(el('div', 'pip' + (i < rank ? ' on' : '')));
      body.appendChild(pips);
      row.appendChild(body);
      var b = el('button', 'btn buy' + (maxed ? '' : ' primary'), maxed ? 'MAX' : '💰 ' + fmt(cost));
      b.disabled = maxed || d.coins < cost;
      b.onclick = function () {
        if (d.coins < cost || maxed) return;
        d.coins -= cost; d.shop[item.id] = rank + 1; Save.save();
        ZN.Audio.play('coin'); renderShop();
      };
      row.appendChild(b);
      list.appendChild(row);
    });
  }

  // ---------------------------------------------------------- armoury
  function renderArmoury() {
    var list = $('armoury-list'), unlocked = Save.unlockedSet(), lvl = Save.data.accLevel;
    list.innerHTML = '';
    $('arm-level').textContent = 'Lv ' + lvl;
    var nextLvl = null;
    for (var l in ZN.UNLOCKS) if (+l > lvl) { nextLvl = +l; break; }
    if (nextLvl) list.appendChild(el('div', 'item', '<div class="body"><div class="name">Next unlock at Survivor Level ' + nextLvl + '</div><div class="desc">' +
      ZN.UNLOCKS[nextLvl].map(name).join(', ') + '. Earn account XP by collecting gems and clearing waves.</div></div>'));

    list.appendChild(el('div', 'section-h', 'Weapons'));
    Object.keys(ZN.WEAPONS).forEach(function (id) {
      var d = ZN.WEAPONS[id];
      if (d.evolved) return;
      list.appendChild(entry(d.icon, d.color, d.name, d.kind + ' · ' + d.levels[0], unlocked[id], id));
    });
    list.appendChild(el('div', 'section-h', 'Passive items'));
    Object.keys(ZN.PASSIVES).forEach(function (id) {
      var d = ZN.PASSIVES[id];
      list.appendChild(entry(d.icon, '#8fd18f', d.name, d.desc, unlocked[id], id));
    });
    list.appendChild(el('div', 'section-h', 'Evolution recipes'));
    ZN.EVOLUTIONS.forEach(function (ev) {
      var into = ZN.WEAPONS[ev.into], row = el('div', 'item');
      row.appendChild(icon(into.icon, into.color));
      var body = el('div', 'body'), rec = el('div', 'recipe');
      ev.from.forEach(function (id, i) { if (i) rec.appendChild(el('span', '', '+')); rec.appendChild(el('span', 'chip', ZN.WEAPONS[id].icon + ' ' + ZN.WEAPONS[id].name + ' (max)')); });
      if (ev.passive) { rec.appendChild(el('span', '', '+')); rec.appendChild(el('span', 'chip', ZN.PASSIVES[ev.passive].icon + ' ' + ZN.PASSIVES[ev.passive].name)); }
      body.appendChild(el('div', 'name', into.name));
      body.appendChild(rec);
      body.appendChild(el('div', 'desc', into.levels[0]));
      row.appendChild(body);
      list.appendChild(row);
    });

    function name(id) { return (ZN.WEAPONS[id] || ZN.PASSIVES[id]).name; }
    function entry(ic, color, nm, desc, isUnlocked, id) {
      var row = el('div', 'item' + (isUnlocked ? '' : ' locked'));
      row.appendChild(icon(isUnlocked ? ic : '🔒', color));
      var body = el('div', 'body');
      body.appendChild(el('div', 'name', nm));
      body.appendChild(el('div', 'desc', isUnlocked ? desc : 'Unlocks at Survivor Level ' + Save.unlockLevelOf(id)));
      row.appendChild(body);
      return row;
    }
  }

  function icon(ic, color) {
    var i = el('div', 'ico', ic);
    i.style.borderColor = color; i.style.boxShadow = 'inset 0 0 12px ' + color + '55';
    return i;
  }

  // ---------------------------------------------------------- mission
  function startMission(id) {
    var c = ZN.MAP.byId[id], cleared = Save.isCleared(id), waves = Save.wavesFor(id);
    var tier = cleared ? waves - 1 : Save.clearedCount();
    Save.data.lastCounty = id;
    show('game');
    $('hud-boss').classList.add('hidden');
    game = new ZN.Game($('game-canvas'), {
      county: c, waves: waves, tier: tier, replay: cleared,
      onHud: updateHud, onBanner: showBanner,
      onLevelUp: showLevelUp, onChest: showChest, onEnd: endMission
    });
    ZN.game = game;
    updateHud(game);
    game.start();
  }

  function updateHud(g) {
    var p = g.player;
    $('hud-xp').style.width = Math.min(100, p.xp / p.xpNext * 100) + '%';
    $('hud-level').textContent = 'LV ' + p.level;
    $('hud-wave').textContent = g.bossPhase ? 'BOSS FIGHT · ' + g.county.short : 'Wave ' + (g.waveIdx + 1) + '/' + g.waves + ' · ' + Math.max(0, Math.ceil(g.waveDur - g.waveTime)) + 's';
    $('hud-wavebar').style.width = (g.bossPhase ? 100 : g.waveTime / g.waveDur * 100) + '%';
    $('hud-kills').textContent = fmt(g.kills);
    $('hud-coins').textContent = fmt(g.runCoins);
    var sig = g.weapons.map(function (w) { return w.id + w.level; }).join() + '|' + g.passives.map(function (q) { return q.id + q.level; }).join();
    if (sig !== updateHud.sig) { updateHud.sig = sig; renderItems($('hud-items'), g); }
    if (g.boss && !g.boss.dead) {
      $('hud-boss').classList.remove('hidden');
      $('hud-bossbar').style.width = Math.max(0, g.boss.hp / g.boss.maxHp * 100) + '%';
    } else $('hud-boss').classList.add('hidden');
  }

  function renderItems(container, g) {
    container.innerHTML = '';
    g.weapons.forEach(function (w) {
      var d = ZN.WEAPONS[w.id], max = w.level >= d.max;
      var e = el('div', 'hi' + (max ? ' max' : ''), d.icon + '<b>' + (d.evolved ? '★' : max ? 'M' : w.level) + '</b>');
      e.style.borderColor = d.color;
      container.appendChild(e);
    });
    g.passives.forEach(function (q) {
      var d = ZN.PASSIVES[q.id];
      container.appendChild(el('div', 'hi passive' + (q.level >= ZN.PASSIVE_MAX ? ' max' : ''), d.icon + '<b>' + (q.level >= ZN.PASSIVE_MAX ? 'M' : q.level) + '</b>'));
    });
  }

  function showBanner(title, sub) {
    $('banner-title').textContent = title || '';
    $('banner-sub').textContent = sub || '';
    var b = $('banner');
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.classList.remove('show'); }, title ? 2600 : 1800);
  }

  function card(o, onClick) {
    var c = el('div', 'card' + (o.kind === 'evolve' ? ' evolve' : ''));
    c.appendChild(icon(o.icon, o.color));
    var body = el('div', 'body');
    body.appendChild(el('div', 'name', o.title));
    if (o.tag) body.appendChild(el('div', 'ctag', o.tag));
    body.appendChild(el('div', 'desc', o.desc));
    c.appendChild(body);
    if (onClick) c.onclick = onClick;
    return c;
  }

  function showLevelUp(options, choose) {
    var box = $('levelup-cards');
    box.innerHTML = '';
    var armed = false;
    setTimeout(function () { armed = true; }, 350); // avoid accidental taps while dragging
    options.forEach(function (o) {
      box.appendChild(card(o, function () {
        if (!armed) return;
        overlay('ov-levelup', false);
        ZN.Audio.play('click');
        choose(o);
      }));
    });
    if (game) game.joy = null;
    overlay('ov-levelup', true);
  }

  function showChest(rewards, done) {
    var box = $('chest-list');
    box.innerHTML = '';
    rewards.forEach(function (r) { box.appendChild(card({ icon: r.icon, color: r.color, title: r.title, desc: r.desc })); });
    if (game) game.joy = null;
    overlay('ov-chest', true);
    ZN.Audio.play('levelup');
    $('chest-ok').onclick = function () { overlay('ov-chest', false); done(); };
  }

  function pauseGame() {
    if (!game || game.ended || game.modal) return;
    game.paused = true; game.joy = null;
    renderItems($('pause-items'), game);
    updateSoundButtons();
    overlay('ov-pause', true);
  }
  function resumeGame() {
    overlay('ov-pause', false);
    if (game) { game.paused = false; game.last = performance.now(); }
  }

  function endMission(r) {
    var d = Save.data, g = game, county = g.county, firstClear = r.win && !Save.isCleared(county.id);
    var bonus = 0;
    if (r.win) bonus = Math.round((40 + 20 * g.waves) * g.stat.greed * (firstClear ? 1 : 0.5));
    var coins = Math.round(r.coins) + bonus;
    var accXp = r.xp + 30 * r.wavesDone + (firstClear ? 50 * g.waves : 0);
    d.coins += coins;
    d.stats.kills += r.kills; d.stats.runs++;
    if (r.win) d.stats.wins++;
    d.stats.bestLevel = Math.max(d.stats.bestLevel, r.level);
    if (firstClear) d.cleared[county.id] = g.waves;
    var gained = Save.addAccountXp(accXp);
    Save.save();

    $('res-title').textContent = r.win ? 'LIBERATED!' : 'DEFEATED';
    $('res-sub').textContent = r.win ? county.name + (firstClear ? ' is free from the horde.' : ' secured again.') : county.name + ' remains overrun. Your coins are kept.';
    var mins = Math.floor(r.time / 60), secs = Math.floor(r.time % 60);
    var rows = [
      ['Time survived', mins + ':' + (secs < 10 ? '0' : '') + secs],
      ['Waves cleared', r.wavesDone + ' / ' + g.waves],
      ['Zombies slain', fmt(r.kills)],
      ['Level reached', r.level],
      ['Coins collected', '💰 ' + fmt(r.coins)]
    ];
    if (bonus) rows.push([firstClear ? 'Liberation bonus' : 'Replay bonus', '💰 ' + fmt(bonus)]);
    rows.push(['Survivor XP', '+' + fmt(accXp)]);
    var html = rows.map(function (x) { return '<div class="res-row"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('');
    gained.forEach(function (gl) {
      var names = gl.items.map(function (id) { var it = ZN.WEAPONS[id] || ZN.PASSIVES[id]; return it.icon + ' ' + it.name; });
      html += '<div class="unlock">⭐ <b>Survivor Level ' + gl.level + '!</b>' + (names.length ? '<br>Unlocked: ' + names.join(', ') : '') + '</div>';
    });
    if (firstClear && Save.clearedCount() === ZN.COUNTIES.length) html += '<div class="unlock">🇬🇧 <b>THE UNITED KINGDOM IS LIBERATED!</b> Every county is free. Legend.</div>';
    else if (firstClear) {
      var newly = county.adj.filter(function (n) { return !Save.isCleared(n); }).map(function (n) { return ZN.MAP.byId[n].short; });
      if (newly.length) html += '<div class="unlock">🗺️ New fronts open: ' + newly.join(', ') + '</div>';
    }
    $('res-body').innerHTML = html;
    overlay('ov-results', true);
  }

  function leaveGame() {
    if (game) { game.destroy(); game = null; ZN.game = null; }
    overlay('ov-results', false); overlay('ov-pause', false); overlay('ov-levelup', false); overlay('ov-chest', false);
    selected = Save.data.lastCounty || selected;
    show('map');
  }

  // Android back button: returns true if handled
  ZN.onBack = function () {
    if (!$('ov-confirm').classList.contains('hidden')) { overlay('ov-confirm', false); return true; }
    if (current === 'game') {
      if (!$('ov-results').classList.contains('hidden')) { leaveGame(); return true; }
      if (!$('ov-pause').classList.contains('hidden')) { resumeGame(); return true; }
      pauseGame(); return true;
    }
    if (current === 'title') return false;
    if (current === 'map' && selected) { paths[selected].classList.remove('selected'); selected = null; $('county-panel').classList.add('hidden'); return true; }
    show(current === 'shop' || current === 'armoury' ? prevScreen : 'title');
    return true;
  };
  ZN.onPause = function () { if (current === 'game') pauseGame(); };

  // ------------------------------------------------------------- wiring
  function init() {
    Save.load();
    ZN.buildMap();
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { ZN.Audio.play('click'); show(b.getAttribute('data-go')); });
    });
    document.addEventListener('pointerdown', function () { ZN.Audio.unlock(); }, true);
    $('cp-go').onclick = function () { if (selected && Save.isAvailable(selected)) { ZN.Audio.play('click'); startMission(selected); } };
    $('btn-pause').addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    $('btn-pause').onclick = pauseGame;
    $('pause-resume').onclick = resumeGame;
    var toggleSound = function () { Save.data.sound = !Save.data.sound; Save.save(); updateSoundButtons(); };
    $('btn-sound').onclick = toggleSound; $('pause-sound').onclick = toggleSound;
    $('pause-quit').onclick = function () {
      confirmBox('Abandon mission?', 'You keep the coins and XP collected so far, but the county stays overrun.', function () {
        overlay('ov-pause', false);
        if (game) { game.paused = false; game.finish(); }
      });
    };
    $('res-ok').onclick = leaveGame;
    $('btn-reset').onclick = function () {
      confirmBox('Reset save?', 'This wipes all liberated counties, coins, upgrades and unlocks.', function () {
        Save.reset(); selected = null; renderMap.scrolled = false; show('title');
      });
    };
    document.addEventListener('visibilitychange', function () { if (document.hidden) ZN.onPause(); });
    window.addEventListener('resize', function () { if (current === 'map') sizeMap(); });
    updateSoundButtons();
    if (!Save.data.seenIntro) { Save.data.seenIntro = true; Save.save(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.ZN);
