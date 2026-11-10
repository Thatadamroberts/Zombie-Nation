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
    if (name !== current && current !== 'game' && name !== 'skills' && current !== 'skills') prevScreen = current;
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    current = name;
    if (name === 'map') renderMap();
    if (name === 'shop') renderShop();
    if (name === 'armoury') renderArmoury();
    if (name === 'survivors') renderSurvivors();
    if (name === 'achievements') renderAchievements();
    if (name === 'daily') renderDaily();
    if (name === 'event') renderEvent();
    if (name === 'relics') renderRelics();
    if (name === 'skills') renderSkills();
    if (name === 'title') { updateSoundButtons(); updateTitleBadges(); }
    if (name !== 'game') ZN.Music.play('menu');
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
    var d = Save.data, t = 'Sound: ' + (d.sound ? 'On' : 'Off'), h = 'Vibration: ' + (d.haptics !== false ? 'On' : 'Off');
    $('btn-sound').textContent = t; $('pause-sound').textContent = t;
    $('btn-haptics').textContent = h; $('pause-haptics').textContent = h;
    $('btn-shake').textContent = 'Shake: ' + (d.shake !== false ? 'On' : 'Off');
    var m = 'Music: ' + (d.music !== false ? 'On' : 'Off');
    $('btn-music').textContent = m; $('pause-music').textContent = m;
  }

  function fmtDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function updateSeasonBanner() {
    var se = ZN.currentSeason(), btn = $('season-btn'), nx = $('season-next');
    if (se) {
      var tk = (Save.data.tokens || {})[se.id] || 0;
      btn.innerHTML = se.icon + ' ' + se.name + ' event <span class="badge">' + se.token + ' ' + fmt(tk) + '</span><div style="font-size:12px;font-weight:600;opacity:0.8">Until ' + fmtDate(ZN.seasonEnd(se)) + '</div>';
      btn.style.borderColor = se.color;
      btn.classList.remove('hidden'); nx.textContent = '';
    } else {
      btn.classList.add('hidden');
      var n = ZN.nextSeason();
      nx.textContent = n ? 'Next event: ' + n.season.icon + ' ' + n.season.name + ' in ' + n.days + ' day' + (n.days === 1 ? '' : 's') : '';
    }
  }

  function renderEvent() {
    var se = ZN.currentSeason(), body = $('event-body'), d = Save.data;
    if (!se) { show('title'); return; }
    d.tokens = d.tokens || {};
    var tk = d.tokens[se.id] || 0, w = ZN.WEAPONS[se.weapon], boss = ZN.BOSSES[se.boss];
    $('event-title').textContent = se.icon + ' ' + se.name;
    $('event-tokens').textContent = se.token + ' ' + fmt(tk);
    body.innerHTML = '<div class="event-hero" style="border-color:' + se.color + '"><div class="big">' + se.icon + '</div><h2>' + se.name + '</h2><div class="desc" style="color:#cfd5dc">' + se.desc +
      '</div><div class="desc" style="color:var(--muted);margin-top:8px">Ends ' + fmtDate(ZN.seasonEnd(se)) + '</div></div>' +
      '<div class="section-h">This event</div>' +
      '<div class="item"><div class="ico">' + w.icon + '</div><div class="body"><div class="name">' + w.name + '</div><div class="desc">' + w.levels[0] + ' In the level-up pool for the whole event.</div></div></div>' +
      '<div class="item"><div class="ico">👹</div><div class="body"><div class="name">' + boss.name + '</div><div class="desc">The seasonal boss leads the horde in many missions and every daily challenge.</div></div></div>' +
      '<div class="item"><div class="ico">' + se.token + '</div><div class="body"><div class="name">' + se.tokenName + '</div><div class="desc">Dropped by zombies, lieutenants and bosses during the event. Spend them below.</div></div></div>' +
      '<div class="section-h">Event shop</div>';
    ZN.EVENT_SHOP.forEach(function (it) {
      var owned = it.id === 'weapon' && d.items[se.weapon];
      var row = el('div', 'item');
      row.appendChild(el('div', 'ico', it.id === 'weapon' ? w.icon : it.id === 'coins' ? '💰' : '⭐'));
      var b2 = el('div', 'body');
      b2.appendChild(el('div', 'name', it.id === 'weapon' ? 'Keep ' + w.name + ' forever' : it.name));
      b2.appendChild(el('div', 'desc', it.desc));
      row.appendChild(b2);
      var b = el('button', 'btn buy' + (owned ? '' : ' primary'), owned ? 'OWNED' : se.token + ' ' + it.cost);
      b.disabled = owned || tk < it.cost;
      b.onclick = function () {
        if (owned || tk < it.cost) return;
        d.tokens[se.id] = tk - it.cost;
        if (it.id === 'weapon') { d.items[se.weapon] = true; toast(w.icon + ' ' + w.name + ' is yours to keep!'); }
        if (it.id === 'coins') { d.coins += 1500; toast('💰 +1,500 coins'); }
        if (it.id === 'xp') { var lv = Save.addAccountXp(2000); toast('⭐ +2,000 survivor XP' + (lv.length ? ' · Level ' + d.accLevel + '!' : '')); }
        Save.save(); ZN.Audio.play('coin'); renderEvent();
      };
      row.appendChild(b);
      body.appendChild(row);
    });
  }

  function renderRelics() {
    var list = $('relic-list'), d = Save.data, slots = Save.relicSlots();
    list.innerHTML = '';
    $('relic-slots').textContent = d.relicEquip.length + '/' + slots + ' equipped';
    list.appendChild(el('div', 'desc', '<span style="color:var(--muted);font-size:13px;padding:0 4px">Tap a relic to equip or unequip it. You have ' + slots +
      ' slot' + (slots > 1 ? 's' : '') + (slots < ZN.RELIC_MAX_SLOTS ? ' (+1 per New Game+ cycle)' : '') + '.</span>'));
    list.appendChild(el('div', 'section-h', 'Collection · ' + Object.keys(d.relics).length + '/' + Object.keys(ZN.RELICS).length));
    Object.keys(ZN.RELICS).forEach(function (id) {
      var r = ZN.RELICS[id], have = !!d.relics[id], eq = d.relicEquip.indexOf(id) >= 0, boss = ZN.BOSSES[id];
      var row = el('div', 'item relic' + (eq ? ' equipped' : '') + (have ? '' : ' locked'));
      row.appendChild(icon(have ? r.icon : '❔', eq ? '#ffd23a' : '#3a414c'));
      var body = el('div', 'body');
      body.appendChild(el('div', 'name', have ? r.name : '???'));
      body.appendChild(el('div', 'desc', have ? r.desc : 'Defeat ' + boss.name + ' to claim this relic.'));
      row.appendChild(body);
      if (have) {
        var b = el('button', 'btn buy' + (eq ? '' : ' primary'), eq ? 'Equipped' : 'Equip');
        b.disabled = !eq && d.relicEquip.length >= slots;
        b.onclick = function () { if (Save.toggleRelic(id)) { Save.save(); ZN.Audio.play('click'); renderRelics(); } };
        row.appendChild(b);
      }
      list.appendChild(row);
    });
  }

  function updateTitleBadges() {
    updateSeasonBanner();
    var d = Save.data;
    $('relic-count').textContent = Object.keys(d.relics || {}).length + '/' + Object.keys(ZN.RELICS).length;
    $('ngplus-btn').classList.toggle('hidden', !Save.canNewGamePlus());
    $('ngplus-btn').textContent = '♾️ Begin New Game+ ' + ((d.ngPlus || 0) + 1);
    $('ng-badge').classList.toggle('hidden', !d.ngPlus);
    $('ng-badge').textContent = 'NG+' + d.ngPlus;
    var dl = Save.daily();
    $('daily-badge').classList.toggle('hidden', dl.done);
    var tc = Save.tierCounts();
    $('ach-count').textContent = tc.got + '/' + tc.total;
  }

  var toastQ = [], toastBusy = false;
  function toast(html) {
    toastQ.push(html);
    if (toastBusy) return;
    (function next() {
      if (!toastQ.length) { toastBusy = false; return; }
      toastBusy = true;
      var t = $('toast'); t.innerHTML = toastQ.shift(); t.classList.add('show');
      setTimeout(function () { t.classList.remove('show'); setTimeout(next, 400); }, 2600);
    })();
  }

  // -------------------------------------------------------------- map
  var mapBuilt = false, paths = {}, labels = {}, badges = {};

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
      var b = document.createElementNS(SVGNS, 'text');
      b.setAttribute('x', c.center[0].toFixed(1)); b.setAttribute('y', (c.center[1] - 8).toFixed(1));
      b.setAttribute('class', 'threat-badge');
      svg.appendChild(b);
      badges[c.id] = b;
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
      var th = Save.isThreatened(c.id);
      paths[c.id].setAttribute('class', 'county ' + st + (th ? ' threatened' : '') + (selected === c.id ? ' selected' : ''));
      labels[c.id].setAttribute('class', 'county-label ' + st);
      badges[c.id].textContent = th ? '⚠ ' + d.threats[c.id] : '';
    });
    $('map-coins').textContent = fmt(d.coins);
    $('map-level').innerHTML = 'Survivor Level ' + d.accLevel + (d.ngPlus ? '<span class="ng-tag">NG+' + d.ngPlus + '</span>' : '');
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
    var cleared = Save.isCleared(id), avail = Save.isAvailable(id), waves = Save.wavesFor(id), threat = Save.isThreatened(id);
    var st = threat ? 'threatened' : cleared ? 'cleared' : avail ? 'available' : 'locked';
    $('cp-name').textContent = c.name;
    var tag = $('cp-status');
    tag.className = 'tag ' + st;
    tag.textContent = threat ? 'UNDER ATTACK' : cleared ? 'LIBERATED' : avail ? 'ATTACKABLE' : 'OVERRUN';
    var tier = threat ? Save.clearedCount() : cleared ? waves - 1 : Save.clearedCount();
    var boss = ZN.BOSSES[ZN.bossFor(c)], seP = ZN.currentSeason();
    var threatLvl = ['Low', 'Moderate', 'High', 'Severe', 'Extreme', 'Apocalyptic'][Math.min(5, Math.floor(tier / 4))];
    var neighbours = c.adj.map(function (n) { return ZN.MAP.byId[n].short; }).join(', ');
    var trait = ZN.TRAITS[ZN.traitFor(c)], local = ZN.ENEMIES[ZN.REGIONAL[c.region]];
    var info = '<b>' + waves + '</b> wave' + (waves > 1 ? 's' : '') + ' + <b>' + boss.name + '</b> · Threat: <b>' + threatLvl + '</b>' +
      '<br>' + trait.icon + ' <b>' + trait.name + '</b>: ' + trait.desc +
      (local ? '<br>🧟 Local horde: <b>' + local.name + 's</b>' : '') +
      (seP ? '<br>' + seP.icon + ' <b>' + seP.name + '</b>: ' + ZN.BOSSES[seP.boss].name + ' may lead the horde' : '') + '<br>Borders: ' + neighbours;
    if (!avail) info += '<br><span style="color:#f99">Liberate a neighbouring county first.</span>';
    if (threat) info += '<br><span style="color:#ff8080"><b>The horde is counter-attacking!</b> Win here within ' + Save.data.threats[id] + ' mission' + (Save.data.threats[id] > 1 ? 's' : '') + ' or it falls.</span>';
    else if (cleared) info += '<br>Replay to farm coins and XP.';
    if (!Save.clearedCount()) info += '<br>Choose any county to begin your campaign.';
    $('cp-info').innerHTML = info;
    var go = $('cp-go');
    go.disabled = !avail;
    go.textContent = threat ? 'Defend ' + c.short : cleared ? 'Replay Mission' : avail ? 'Liberate ' + c.short : 'Locked';
    var ch = ZN.characterById(Save.data.character), sv = $('cp-survivor');
    sv.innerHTML = '<span class="sv-ico">' + ch.icon + '</span><span><b>' + ch.name + '</b> · ' + ch.title + '</span><span class="sv-change">Change ›</span>';
    sv.onclick = function () { ZN.Audio.play('click'); show('survivors'); };
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

  // ------------------------------------------------------- skill trees
  var skillChar = 'tommy';
  function tierRanks(ranks, tree, tier) { var n = 0; tree.forEach(function (pk) { if (pk.tier === tier) n += ranks[pk.id] || 0; }); return n; }
  function renderSkills() {
    var d = Save.data, ch = ZN.characterById(skillChar), tree = ZN.SKILLS[ch.id], body = $('skills-body');
    d.skills = d.skills || {};
    var ranks = d.skills[ch.id] = d.skills[ch.id] || {};
    $('skills-title').textContent = ch.icon + ' ' + ch.name;
    $('skills-coins').textContent = fmt(d.coins);
    body.innerHTML = '';
    body.appendChild(el('div', 'desc', '<span style="color:var(--muted);font-size:13px;padding:0 4px">' + ch.title + ' · perks apply only while playing ' + ch.name + '.</span>'));
    [1, 2, 3].forEach(function (tier) {
      var open = tier === 1 || tierRanks(ranks, tree, tier - 1) >= ZN.SKILL_UNLOCK;
      var box = el('div', 'tier-box' + (open ? '' : ' locked') + (tier === 3 ? ' cap' : ''));
      var need = tier === 1 ? '' : open ? 'Unlocked' : 'Needs ' + ZN.SKILL_UNLOCK + ' ranks in Tier ' + (tier === 2 ? 'I' : 'II') + ' (' + tierRanks(ranks, tree, tier - 1) + '/' + ZN.SKILL_UNLOCK + ')';
      box.appendChild(el('div', 'tier-h', '<span>' + (tier === 3 ? '★ Capstone' : 'Tier ' + (tier === 1 ? 'I' : 'II')) + '</span><span>' + need + '</span>'));
      tree.filter(function (pk) { return pk.tier === tier; }).forEach(function (pk) {
        var r = ranks[pk.id] || 0, row = el('div', 'perk');
        row.appendChild(el('div', 'pi', pk.icon));
        var pb = el('div', 'pb');
        pb.appendChild(el('div', 'pn', pk.name));
        pb.appendChild(el('div', 'pd', pk.desc));
        if (pk.max > 1) { var pips = el('div', 'pips'); for (var i = 0; i < pk.max; i++) pips.appendChild(el('div', 'pip' + (i < r ? ' on' : ''))); pb.appendChild(pips); }
        row.appendChild(pb);
        var b;
        if (r >= pk.max) b = el('button', 'btn buy', pk.max > 1 ? 'MAX' : 'OWNED');
        else {
          var cost = ZN.skillCost(tier, r);
          b = el('button', 'btn buy primary', '💰 ' + fmt(cost));
          b.disabled = !open || d.coins < cost;
          b.onclick = function () {
            if (!open || d.coins < cost) return;
            d.coins -= cost; ranks[pk.id] = r + 1; Save.save();
            ZN.Audio.play(tier === 3 ? 'evolve' : 'levelup');
            toast(pk.icon + ' ' + pk.name + (pk.max > 1 ? ' rank ' + (r + 1) : ' unlocked!'));
            var got = Save.checkAchievements(); if (got.length) { Save.save(); got.forEach(function (e) { toast('🏆 ' + Save.tierLabel(e.a, e.tier)); }); }
            renderSkills();
          };
        }
        row.appendChild(b);
        box.appendChild(row);
      });
      body.appendChild(box);
    });
  }

  // -------------------------------------------------------- survivors
  function renderSurvivors() {
    var list = $('survivor-list'), d = Save.data;
    list.innerHTML = '';
    $('surv-coins').textContent = fmt(d.coins);
    list.appendChild(el('div', 'section-h', 'Choose who takes back Britain'));
    ZN.CHARACTERS.forEach(function (ch) {
      var owned = !!d.owned[ch.id], sel = d.character === ch.id, w = ZN.WEAPONS[ch.start];
      var row = el('div', 'item' + (sel ? ' selected-surv' : ''));
      row.appendChild(icon(ch.icon, sel ? '#e0b030' : '#3a414c'));
      var body = el('div', 'body');
      body.appendChild(el('div', 'name', ch.name + ' <span style="color:var(--muted);font-weight:600">· ' + ch.title + '</span>'));
      body.appendChild(el('div', 'desc', 'Starts with ' + w.icon + ' <b>' + w.name + '</b>. ' + ch.perks));
      if (owned && ZN.SKILLS[ch.id]) {
        var ranks = (d.skills || {})[ch.id] || {}, spent = 0, total = 0;
        ZN.SKILLS[ch.id].forEach(function (pk) { spent += ranks[pk.id] || 0; total += pk.max; });
        var sb = el('button', 'btn small skill-btn', '🌳 Skill tree ' + spent + '/' + total + (ranks.cap ? ' ★' : ''));
        sb.onclick = function () { skillChar = ch.id; ZN.Audio.play('click'); show('skills'); };
        body.appendChild(sb);
      }
      row.appendChild(body);
      var b;
      if (sel) b = el('button', 'btn buy', 'Chosen');
      else if (owned) b = el('button', 'btn buy', 'Select');
      else if (ch.achievement) {
        var ac = ZN.achievementById(ch.achievement), tg = ac.tiers[(ch.achievementTier || 1) - 1][0];
        b = el('button', 'btn buy', '🔒'); b.disabled = true;
        body.appendChild(el('div', 'reward', 'Unlock: ' + Save.tierLabel(ac, ch.achievementTier || 1) + ' (' + ac.desc.replace('{n}', fmt(tg)) + ')'));
      }
      else { b = el('button', 'btn buy primary', '💰 ' + fmt(ch.cost)); b.disabled = d.coins < ch.cost; }
      b.onclick = function () {
        if (sel) return;
        if (!owned) { if (d.coins < ch.cost) return; d.coins -= ch.cost; d.owned[ch.id] = true; ZN.Audio.play('coin'); }
        else ZN.Audio.play('click');
        d.character = ch.id; Save.save(); renderSurvivors();
      };
      row.appendChild(b);
      list.appendChild(row);
    });

    list.appendChild(el('div', 'section-h', 'Companion'));
    var none = el('div', 'item pet-row' + (!d.pet ? ' selected-surv' : ''));
    none.appendChild(icon('🚫', '#3a414c'));
    none.appendChild(el('div', 'body', '<div class="name">No companion</div><div class="desc">Go it alone.</div>'));
    var nb = el('button', 'btn buy', !d.pet ? 'Chosen' : 'Select');
    nb.onclick = function () { d.pet = null; Save.save(); renderSurvivors(); };
    none.appendChild(nb); list.appendChild(none);
    list.appendChild(el('div', 'desc', '<span style="color:var(--muted);font-size:13px;padding:0 4px">Companions can never be hurt, and each one gives you a bonus.</span>'));
    Object.keys(ZN.PETS).forEach(function (id) {
      var pet = ZN.PETS[id], have = !!d.pets[id], sel = d.pet === id;
      var ac = ZN.ACHIEVEMENTS.filter(function (a) { return a.tiers.some(function (t) { return t[1].pet === id; }); })[0];
      if (ac) ac = { name: ac.name, desc: ac.desc.replace('{n}', '') };
      var buyable = !have && pet.cost;
      var row = el('div', 'item pet-row' + (sel ? ' selected-surv' : '') + (have || buyable ? '' : ' locked'));
      row.appendChild(icon(have || buyable ? pet.icon : '🔒', sel ? '#e0b030' : '#3a414c'));
      var body = el('div', 'body');
      body.appendChild(el('div', 'name', pet.name));
      body.appendChild(el('div', 'desc', have || buyable ? pet.desc : 'Unlock: ' + ac.name + ' (' + ac.desc + ')'));
      body.appendChild(el('div', 'pet-buff', '✚ ' + pet.buff));
      if (have) {
        var pl = (d.petLevels || {})[id] || 0;
        var tr = el('div', 'train-row', '<span class="stars">' + stars(pl, ZN.PET_MAX) + '</span><span class="tr-info">Power +' + Math.round((ZN.petMult(pl) - 1) * 100) + '%</span>');
        if (pl < ZN.PET_MAX) {
          var tc = ZN.petCost(pl), tb = el('button', 'btn small train', 'Train 💰 ' + fmt(tc));
          tb.disabled = d.coins < tc;
          tb.onclick = function (ev) {
            ev.stopPropagation();
            if (d.coins < tc) return;
            d.coins -= tc; d.petLevels = d.petLevels || {}; d.petLevels[id] = pl + 1; Save.save();
            ZN.Audio.play('levelup'); toast(pet.icon + ' ' + pet.name + ' trained to level ' + (pl + 1) + '!'); renderSurvivors();
          };
          tr.appendChild(tb);
        } else tr.appendChild(el('span', 'tr-max', 'MAX'));
        body.appendChild(tr);
      }
      row.appendChild(body);
      var b;
      if (buyable) { b = el('button', 'btn buy primary', '💰 ' + fmt(pet.cost)); b.disabled = d.coins < pet.cost; }
      else { b = el('button', 'btn buy', sel ? 'Chosen' : have ? 'Select' : '🔒'); b.disabled = !have; }
      b.onclick = function () {
        if (buyable) { if (d.coins < pet.cost) return; d.coins -= pet.cost; d.pets[id] = true; ZN.Audio.play('coin'); }
        else if (!have) return;
        else ZN.Audio.play('click');
        d.pet = id; Save.save(); renderSurvivors();
      };
      row.appendChild(b); list.appendChild(row);
    });
  }

  // ------------------------------------------------------- achievements
  function renderAchievements() {
    var list = $('achievement-list'), d = Save.data, x = { save: d, stats: d.stats };
    list.innerHTML = '';
    ZN.ACHIEVEMENTS.forEach(function (a) {
      var have = (d.achTiers && d.achTiers[a.id]) || 0, done = have >= a.tiers.length, v = a.value(x);
      var row = el('div', 'item ach ' + (have ? 'earned' : 'unearned') + (done ? ' complete' : ''));
      row.appendChild(icon(a.icon, done ? '#ffd23a' : have ? '#4caf50' : '#3a414c'));
      var body = el('div', 'body');
      var medals = '';
      if (a.tiers.length > 1) for (var i = 0; i < a.tiers.length; i++) medals += '<span class="medal' + (i < have ? ' on' : '') + '">' + ZN.TIER_MEDALS[i] + '</span>';
      body.appendChild(el('div', 'name', a.name + (a.tiers.length > 1 && have ? ' ' + ZN.TIER_NAMES[have - 1] : '') + (done ? ' ✅' : '') + '<span class="medals">' + medals + '</span>'));
      if (done) {
        body.appendChild(el('div', 'desc', a.desc.replace('{n}', fmt(a.tiers[a.tiers.length - 1][0])) + ' <b>Complete!</b>'));
      } else {
        var goal = a.tiers[have][0];
        body.appendChild(el('div', 'desc', a.desc.replace('{n}', fmt(goal))));
        if (goal > 1) {
          var pct = Math.max(0, Math.min(100, v / goal * 100));
          body.appendChild(el('div', 'ach-prog', '<div class="bar"><div class="bar-fill xp" style="width:' + pct + '%"></div></div><span>' + fmt(Math.min(v, goal)) + ' / ' + fmt(goal) + '</span>'));
        }
        body.appendChild(el('div', 'reward', (a.tiers.length > 1 ? 'Tier ' + ZN.TIER_NAMES[have] + ' reward: ' : 'Reward: ') + Save.rewardText(a.tiers[have][1])));
      }
      row.appendChild(body);
      list.appendChild(row);
    });
    var st = d.stats;
    list.appendChild(el('div', 'section-h', 'Service record'));
    list.appendChild(el('div', 'item', '<div class="body"><div class="desc">Zombies slain: <b>' + fmt(st.kills) + '</b><br>Missions: <b>' + st.runs + '</b> · Victories: <b>' + st.wins +
      '</b><br>Time survived: <b>' + fmt(st.timePlayed / 60) + ' min</b> · Coins earned: <b>' + fmt(st.coinsEarned) +
      '</b><br>Best level: <b>' + st.bestLevel + '</b> · Weapons evolved: <b>' + Object.keys(st.evolved).length + '/20</b><br>Bosses slain: <b>' + st.bossKills +
      '</b> (' + Object.keys(st.bosses).length + '/' + Object.keys(ZN.BOSSES).length + ' types) · Power-ups: <b>' + st.buffs +
      '</b><br>Counter-attacks repelled: <b>' + st.defended + '</b> · Daily challenges won: <b>' + st.dailies + '</b></div></div>'));
    var tc = Save.tierCounts();
    $('ach-progress').textContent = tc.got + '/' + tc.total;
  }

  // -------------------------------------------------------------- daily
  function renderDaily() {
    var body = $('daily-body'), dl = Save.daily(), c = dl.county, dse = ZN.currentSeason(), boss = ZN.BOSSES[dse ? dse.boss : ZN.bossFor(c)];
    $('daily-coins').textContent = fmt(Save.data.coins);
    var html = '<div class="daily-card"><div class="section-h" style="margin:0 0 6px">' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>' +
      '<h2>' + c.name + '</h2><div class="desc" style="color:var(--muted)">' + ZN.DAILY_WAVES + ' waves + ' + boss.name + '<br>' +
      ZN.TRAITS[ZN.traitFor(c)].icon + ' ' + ZN.TRAITS[ZN.traitFor(c)].name + '</div></div>' +
      '<div class="daily-card"><div class="section-h" style="margin:0 0 4px">Today\'s twists</div>' +
      dl.mods.map(function (m) { var md = ZN.DAILY_MODS[m]; return '<div class="mod"><div class="mi">' + md.icon + '</div><div><b>' + md.name + '</b><div class="desc" style="color:var(--muted)">' + md.desc + '</div></div></div>'; }).join('') +
      '</div><div class="daily-card">' + (dl.done ? '✅ <b>Completed today!</b> Come back tomorrow for a new challenge. You can still replay it for coins and XP.' :
      '🏆 Reward for winning: <b>💰 ' + ZN.DAILY_REWARD + ' coins</b> (once per day). Your campaign map is not affected.') + '</div>';
    body.innerHTML = html;
    var b = el('button', 'btn big primary', dl.done ? 'Play Again' : 'Start Challenge');
    b.onclick = function () { ZN.Audio.play('click'); startMission(c.id, dl); };
    body.appendChild(b);
  }

  // ---------------------------------------------------------- armoury
  function renderArmoury() {
    var list = $('armoury-list'), unlocked = Save.unlockedSet(), lvl = Save.data.accLevel;
    list.innerHTML = '';
    $('arm-level').textContent = 'Lv ' + lvl + ' · 💰 ' + fmt(Save.data.coins);
    var nextLvl = null;
    for (var l in ZN.UNLOCKS) if (+l > lvl) { nextLvl = +l; break; }
    if (nextLvl) list.appendChild(el('div', 'item', '<div class="body"><div class="name">Next unlock at Survivor Level ' + nextLvl + '</div><div class="desc">' +
      ZN.UNLOCKS[nextLvl].map(name).join(', ') + '. Earn account XP by collecting gems and clearing waves.</div></div>'));

    list.appendChild(el('div', 'section-h', 'Weapons · train mastery for permanent damage'));
    Object.keys(ZN.WEAPONS).forEach(function (id) {
      var d = ZN.WEAPONS[id];
      if (d.evolved) return;
      var row = entry(d.icon, d.color, d.name, d.kind + ' · ' + d.levels[0], unlocked[id], id);
      if (unlocked[id]) {
        var m = (Save.data.mastery || {})[id] || 0, body = row.querySelector('.body');
        var tr = el('div', 'train-row', '<span class="stars">' + stars(m, ZN.MASTERY_MAX) + '</span><span class="tr-info">Mastery +' + Math.round((ZN.masteryMult(m) - 1) * 100) + '% dmg' +
          (m >= ZN.MASTERY_MAX ? ', starts Lv 2' : '') + '</span>');
        if (m < ZN.MASTERY_MAX) {
          var mc = ZN.masteryCost(m), mb = el('button', 'btn small train', 'Train 💰 ' + fmt(mc));
          mb.disabled = Save.data.coins < mc;
          mb.onclick = function () {
            if (Save.data.coins < mc) return;
            Save.data.coins -= mc; Save.data.mastery = Save.data.mastery || {}; Save.data.mastery[id] = m + 1; Save.save();
            ZN.Audio.play('levelup'); toast(d.icon + ' ' + d.name + ' mastery ' + (m + 1) + '!'); renderArmoury();
          };
          tr.appendChild(mb);
        } else tr.appendChild(el('span', 'tr-max', 'MASTERED'));
        body.appendChild(tr);
      }
      list.appendChild(row);
    });
    list.appendChild(el('div', 'section-h', 'Passive items'));
    Object.keys(ZN.PASSIVES).forEach(function (id) {
      var d = ZN.PASSIVES[id];
      list.appendChild(entry(d.icon, '#8fd18f', d.name, d.desc, unlocked[id], id));
    });
    list.appendChild(el('div', 'section-h', 'Local hordes'));
    var seenLocal = (Save.data.stats.regional || {}), regionNames = { city: 'Cities', scot: 'Scotland', high: 'Highlands', north: 'The North', wales: 'Wales', sw: 'South West', east: 'East Anglia', mid: 'Midlands', se: 'South East', ni: 'Northern Ireland' };
    var byType = {};
    Object.keys(ZN.REGIONAL).forEach(function (rg) { var t = ZN.REGIONAL[rg]; (byType[t] = byType[t] || []).push(regionNames[rg]); });
    Object.keys(byType).forEach(function (t) {
      var en = ZN.ENEMIES[t], met = seenLocal[t];
      var row = el('div', 'item' + (met ? '' : ' locked'));
      row.appendChild(icon({ trader: '🍅', berserker: '🏴', miner: '⛏️', ram: '🐏', seagull: '🐦', bogbody: '🟫', hardhat: '👷', morris: '🔔', banshee: '👻' }[t], '#3a414c'));
      var bd = el('div', 'body');
      bd.appendChild(el('div', 'name', en.name + (met ? ' ✅' : '')));
      bd.appendChild(el('div', 'desc', byType[t].join(', ') + ' · ' + ZN.REGIONAL_DESC[t]));
      row.appendChild(bd); list.appendChild(row);
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
      var wsea = ZN.WEAPONS[id] && ZN.WEAPONS[id].season, ssea = wsea && ZN.SEASONS.filter(function (x) { return x.id === wsea; })[0];
      body.appendChild(el('div', 'desc', isUnlocked ? desc : ssea ? 'Seasonal: available during ' + ssea.icon + ' ' + ssea.name + ', or keep it forever via the event shop.' : 'Unlocks at Survivor Level ' + Save.unlockLevelOf(id)));
      row.appendChild(body);
      return row;
    }
  }

  function stars(n, max) { var s = ''; for (var i = 0; i < max; i++) s += i < n ? '★' : '☆'; return s; }

  function icon(ic, color) {
    var i = el('div', 'ico', ic);
    i.style.borderColor = color; i.style.boxShadow = 'inset 0 0 12px ' + color + '55';
    return i;
  }

  // ---------------------------------------------------------- mission
  function startMission(id, daily) {
    var c = ZN.MAP.byId[id], cleared = Save.isCleared(id), waves = Save.wavesFor(id), defend = !daily && Save.isThreatened(id);
    var tier = defend ? Save.clearedCount() : cleared ? waves - 1 : Save.clearedCount();
    if (daily) { waves = ZN.DAILY_WAVES; tier = Math.max(3, Save.clearedCount()); cleared = true; }
    else { tier += Save.ngTierBonus(); Save.data.lastCounty = id; }
    show('game');
    $('hud-boss').classList.add('hidden');
    updateBuffs.sig = null; $('hud-buffs').innerHTML = '';
    game = new ZN.Game($('game-canvas'), {
      county: c, waves: waves, tier: tier, replay: cleared, defend: defend, character: Save.data.character,
      pet: Save.data.pet, daily: !!daily, mods: daily ? daily.mods : [], ng: daily ? 0 : (Save.data.ngPlus || 0),
      onHud: updateHud, onBanner: showBanner, onBuff: function (g) { updateBuffs.sig = null; updateBuffs(g); },
      onLevelUp: showLevelUp, onChest: showChest, onEnd: endMission
    });
    ZN.game = game;
    updateHud(game);
    game.start();
    ZN.Music.play('battle');
  }

  function updateBuffs(g) {
    var box = $('hud-buffs'), active = Object.keys(g.buffs).filter(function (k) { return g.buffs[k] > 0; });
    var sig = active.join() + '|' + g.waveModList.join();
    if (sig !== updateBuffs.sig) {
      updateBuffs.sig = sig; box.innerHTML = '';
      g.waveModList.forEach(function (k) {
        var m = ZN.WAVE_MODS[k];
        box.appendChild(el('div', 'buff-chip threat', m.icon + ' ' + m.name));
      });
      active.forEach(function (k) {
        var b = ZN.BUFFS[k], c = el('div', 'buff-chip', b.icon + ' ' + b.name + '<div class="bt" id="bt-' + k + '"></div>');
        c.style.borderColor = b.color; c.style.color = b.color;
        box.appendChild(c);
      });
    }
    active.forEach(function (k) {
      var bar = $('bt-' + k);
      if (bar) { bar.style.width = Math.max(0, g.buffs[k] / ZN.BUFFS[k].time * 100) + '%'; bar.style.background = ZN.BUFFS[k].color; }
    });
  }

  function updateEventHud(g) {
    var box = $('hud-event'), ev = g.wevent;
    if (!ev) { box.classList.add('hidden'); return; }
    var info = ZN.WAVE_EVENTS[ev.type], left = Math.max(0, Math.ceil(ev.limit - ev.t)), txt = info.icon + ' ' + info.name, pct = null;
    if (ev.type === 'convoy') { txt += ' · ' + Math.max(0, Math.round(ev.van.hp)) + '% HP' + (ev.van.moving ? '' : ' · stay close!'); pct = ev.van.hp; }
    if (ev.type === 'crates') txt += ' · ' + ev.crates.filter(function (c) { return c.taken && !c.lost; }).length + '/3';
    if (ev.type === 'hold') { pct = ev.prog / ev.need * 100; txt += ev.inside ? ' · holding' : ' · get in the zone'; }
    box.innerHTML = txt + ' · ' + left + 's' + (pct !== null ? '<div class="ev-bar"><div style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div></div>' : '');
    box.classList.remove('hidden');
  }

  function updateHud(g) {
    var p = g.player;
    updateBuffs(g); updateEventHud(g);
    $('hud-xp').style.width = Math.min(100, p.xp / p.xpNext * 100) + '%';
    $('hud-level').textContent = 'LV ' + p.level;
    $('hud-wave').textContent = g.bossPhase ? 'BOSS FIGHT · ' + g.county.short : 'Wave ' + (g.waveIdx + 1) + '/' + g.waves + ' · ' + Math.max(0, Math.ceil(g.waveDur - g.waveTime)) + 's';
    $('hud-wavebar').style.width = (g.bossPhase ? 100 : g.waveTime / g.waveDur * 100) + '%';
    $('hud-kills').textContent = fmt(g.kills);
    $('hud-coins').textContent = fmt(g.runCoins);
    var sig = g.weapons.map(function (w) { return w.id + w.level; }).join() + '|' + g.passives.map(function (q) { return q.id + q.level; }).join();
    if (sig !== updateHud.sig) { updateHud.sig = sig; renderItems($('hud-items'), g); }
    var bb = g.boss && !g.boss.dead ? g.boss : g.mini && !g.mini.dead ? g.mini : null;
    if (bb) {
      $('hud-boss').classList.remove('hidden');
      $('hud-bossname').textContent = bb.def.name + (bb.enraged ? ' · ENRAGED' : '');
      $('hud-bossname').style.color = bb.def.mini ? '#d07aff' : '#ff6b6b';
      $('hud-bossbar').style.width = Math.max(0, bb.hp / bb.maxHp * 100) + '%';
      $('hud-bossbar').style.background = bb.def.mini ? 'linear-gradient(90deg,#6a2a9a,#d07aff)' : '';
    } else $('hud-boss').classList.add('hidden');
  }

  function renderItems(container, g) {
    container.innerHTML = '';
    g.weapons.forEach(function (w) {
      var d = ZN.WEAPONS[w.id], max = w.level >= d.max;
      var e = el('div', 'hi' + (max ? ' max' : '') + (d.evolved ? ' evo' : ''), d.icon + '<b>' + (max ? (d.evolved ? '★' : 'M') : (d.evolved ? '★' + w.level : w.level)) + '</b>');
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
    var box = $('levelup-cards'), tools = $('levelup-tools'), g = game, banishMode = false;
    var armed = false;
    setTimeout(function () { armed = true; }, 350); // avoid accidental taps while dragging
    function close(o) { overlay('ov-levelup', false); ZN.Audio.play('click'); choose(o); }
    function render() {
      box.innerHTML = '';
      $('levelup-sub').textContent = banishMode ? 'Tap an upgrade to banish it for this mission' : 'Choose an upgrade';
      options.forEach(function (o) {
        var c = card(o, function () {
          if (!armed) return;
          if (banishMode) {
            if (o.kind === 'evolve' || !o.id || !g) return;
            g.banished[o.id] = true; g.banishes--; banishMode = false;
            toast('🚫 ' + o.title + ' banished');
            options = g.rollOptions(); render(); return;
          }
          close(o);
        });
        if (banishMode && (o.kind === 'evolve' || !o.id)) c.style.opacity = 0.4;
        box.appendChild(c);
      });
      tools.innerHTML = '';
      if (!g) return;
      if (g.rerolls > 0) tools.appendChild(toolBtn('🔄 Reroll', g.rerolls, function () { g.rerolls--; options = g.rollOptions(); render(); }));
      if (g.skips > 0) tools.appendChild(toolBtn('⏭️ Skip', g.skips, function () { g.skips--; close({ kind: 'skip' }); }));
      if (g.banishes > 0) {
        var bb = toolBtn(banishMode ? '✖ Cancel' : '🚫 Banish', g.banishes, function () { banishMode = !banishMode; render(); });
        if (banishMode) bb.classList.add('active');
        tools.appendChild(bb);
      }
    }
    function toolBtn(label, n, fn) {
      var b = el('button', 'btn tool', label + ' <span>' + n + '</span>');
      b.onclick = function () { if (!armed) return; ZN.Audio.play('click'); fn(); };
      return b;
    }
    render();
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
    var d = Save.data, g = game, county = g.county, isDaily = g.opts.daily, firstClear = !isDaily && r.win && !Save.isCleared(county.id);
    var bonus = 0, dailyBonus = 0;
    var defending = g.opts.defend;
    if (r.win && !isDaily) bonus = Math.round((40 + 20 * g.waves) * g.stat.greed * (firstClear || defending ? 1 : 0.5));
    if (r.win && isDaily) {
      var today = Save.todayKey();
      if (!(d.daily.date === today && d.daily.won)) { dailyBonus = ZN.DAILY_REWARD; d.daily = { date: today, won: true }; d.stats.dailies++; }
    }
    var ngMul = isDaily ? 1 : 1 + ZN.NG.reward * (d.ngPlus || 0);
    bonus = Math.round(bonus * ngMul);
    var coins = Math.round(r.coins * ngMul) + bonus + dailyBonus;
    var accXp = Math.round((r.xp + 30 * r.wavesDone + (firstClear ? 50 * g.waves : 0)) * (isDaily ? 1 : 1 + ZN.NG.reward * (Save.data.ngPlus || 0)));
    d.coins += coins;
    d.stats.kills += r.kills; d.stats.runs++;
    if (r.win) d.stats.wins++;
    d.stats.bestLevel = Math.max(d.stats.bestLevel, r.level);
    if (firstClear) d.cleared[county.id] = g.waves;
    r.evolved.forEach(function (id) { d.stats.evolved[id] = true; });
    var newRelic = null;
    if (r.win) { d.stats.bosses[r.bossKey] = true; d.stats.bossKills++; newRelic = Save.grantRelic(r.bossKey); }
    d.stats.timePlayed += r.time; d.stats.coinsEarned += coins; d.stats.buffs += r.buffs || 0;
    d.stats.eventsDone = (d.stats.eventsDone || 0) + (r.eventsDone || 0);
    d.stats.regional = d.stats.regional || {};
    for (var rk in (r.regional || {})) d.stats.regional[rk] = true;
    if (r.season && r.tokens) { d.tokens = d.tokens || {}; d.tokens[r.season] = (d.tokens[r.season] || 0) + r.tokens; d.stats.tokens = (d.stats.tokens || 0) + r.tokens; }
    if (r.win && r.damageTaken === 0) d.stats.noHitWins++;
    var threats = isDaily ? { defended: null, fallen: [], newThreat: null } : Save.updateThreats(county.id, r.win);
    if (threats.defended) d.stats.defended++;
    var gained = Save.addAccountXp(accXp);
    Save.save();

    $('res-title').textContent = r.win ? 'LIBERATED!' : 'DEFEATED';
    $('res-sub').textContent = isDaily ? (r.win ? 'Daily challenge complete!' : 'The daily challenge beat you this time.') :
      r.win ? county.name + (firstClear ? ' is free from the horde.' : ' secured again.') : county.name + ' remains overrun. Your coins are kept.';
    var mins = Math.floor(r.time / 60), secs = Math.floor(r.time % 60);
    var rows = [
      ['Time survived', mins + ':' + (secs < 10 ? '0' : '') + secs],
      ['Waves cleared', r.wavesDone + ' / ' + g.waves],
      ['Zombies slain', fmt(r.kills)],
      ['Level reached', r.level],
      ['Coins collected', '💰 ' + fmt(r.coins)]
    ];
    if (bonus) rows.push([firstClear ? 'Liberation bonus' : defending ? 'Defence bonus' : 'Replay bonus', '💰 ' + fmt(bonus)]);
    if (dailyBonus) rows.push(['Daily challenge', '💰 ' + fmt(dailyBonus)]);
    if (r.eventsDone) rows.push(['Wave events completed', r.eventsDone]);
    if (r.season && r.tokens) { var sz = ZN.SEASONS.filter(function (x) { return x.id === r.season; })[0]; rows.push([sz.tokenName + ' collected', sz.token + ' ' + r.tokens]); }
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
    if (newRelic) {
      var rl = ZN.RELICS[newRelic];
      html += '<div class="unlock">🏺 <b>Relic found: ' + rl.icon + ' ' + rl.name + '</b><br>' + rl.desc + (d.relicEquip.indexOf(newRelic) >= 0 ? ' · Equipped' : ' · Equip it on the Relics screen') + '</div>';
      toast('🏺 ' + rl.name);
    }
    if (ngMul > 1) html += '<div class="unlock">♾️ New Game+ ' + d.ngPlus + ' bonus: ×' + ngMul.toFixed(1) + ' coins and XP</div>';
    if (threats.defended) html += '<div class="unlock">🛡️ <b>' + county.name + ' held!</b> The counter-attack is broken.</div>';
    threats.fallen.forEach(function (id) { html += '<div class="warn-box">💀 <b>' + ZN.MAP.byId[id].name + ' has fallen</b> back to the horde.</div>'; });
    if (threats.newThreat) html += '<div class="warn-box">⚠️ <b>Counter-attack on ' + ZN.MAP.byId[threats.newThreat].name + '!</b> Defend it within ' + ZN.THREAT_MISSIONS + ' missions or it falls.</div>';
    Object.keys(d.threats).forEach(function (id) {
      if (id !== threats.newThreat) html += '<div class="warn-box">⚠️ ' + ZN.MAP.byId[id].name + ' falls in ' + d.threats[id] + ' mission' + (d.threats[id] > 1 ? 's' : '') + '.</div>';
    });
    var earned = Save.checkAchievements();
    earned.forEach(function (e) {
      var medal = e.a.tiers.length > 1 ? ZN.TIER_MEDALS[e.tier - 1] + ' ' : '🏆 ';
      html += '<div class="unlock">' + medal + '<b>Achievement: ' + Save.tierLabel(e.a, e.tier) + '</b><br>' + Save.rewardText(e.reward) + '</div>';
      toast(medal + Save.tierLabel(e.a, e.tier));
    });
    Save.save();
    $('res-ok').textContent = isDaily ? 'Done' : 'Back to Map';
    $('res-body').innerHTML = html;
    overlay('ov-results', true);
  }

  function leaveGame() {
    var wasDaily = game && game.opts.daily;
    if (game) { game.destroy(); game = null; ZN.game = null; }
    overlay('ov-results', false); overlay('ov-pause', false); overlay('ov-levelup', false); overlay('ov-chest', false);
    if (wasDaily) { show('daily'); return; }
    selected = Save.data.lastCounty || selected;
    show('map');
  }

  // ------------------------------------------------------------- backup
  function openBackup() {
    $('backup-out').value = Save.exportCode();
    $('backup-in').value = ''; $('backup-msg').textContent = '';
    overlay('ov-backup', true);
  }
  function copyText(text) {
    try { if (window.AndroidBridge && window.AndroidBridge.copyText) { window.AndroidBridge.copyText(text); return true; } } catch (e) { /* fall through */ }
    try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text); return true; } } catch (e) { /* fall through */ }
    var ta = $('backup-out'); ta.focus(); ta.select();
    try { return document.execCommand('copy'); } catch (e) { return false; }
  }

  // Android back button: returns true if handled
  ZN.onBack = function () {
    if (!$('ov-confirm').classList.contains('hidden')) { overlay('ov-confirm', false); return true; }
    if (!$('ov-backup').classList.contains('hidden')) { overlay('ov-backup', false); return true; }
    if (current === 'game') {
      if (!$('ov-results').classList.contains('hidden')) { leaveGame(); return true; }
      if (!$('ov-pause').classList.contains('hidden')) { resumeGame(); return true; }
      pauseGame(); return true;
    }
    if (current === 'title') return false;
    if (current === 'map' && selected) { paths[selected].classList.remove('selected'); selected = null; $('county-panel').classList.add('hidden'); return true; }
    if (current === 'skills') { show('survivors'); return true; }
    show(current === 'shop' || current === 'armoury' || current === 'survivors' ? prevScreen : 'title');
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
    var toggleHaptics = function () { Save.data.haptics = Save.data.haptics === false; Save.save(); updateSoundButtons(); ZN.haptic(40); };
    $('btn-haptics').onclick = toggleHaptics; $('pause-haptics').onclick = toggleHaptics;
    $('btn-shake').onclick = function () { Save.data.shake = Save.data.shake === false; Save.save(); updateSoundButtons(); };
    $('pause-quit').onclick = function () {
      confirmBox('Abandon mission?', 'You keep the coins and XP collected so far, but the county stays overrun.', function () {
        overlay('ov-pause', false);
        if (game) { game.paused = false; game.finish(); }
      });
    };
    $('res-ok').onclick = leaveGame;
    var toggleMusic = function () { Save.data.music = Save.data.music === false; Save.save(); updateSoundButtons(); ZN.Music.refresh(); };
    $('btn-music').onclick = toggleMusic; $('pause-music').onclick = toggleMusic;
    $('btn-backup').onclick = openBackup;
    $('ngplus-btn').onclick = function () {
      var n = (Save.data.ngPlus || 0) + 1;
      confirmBox('Begin New Game+ ' + n + '?', 'The whole map resets to overrun and the horde returns much stronger (+' + Math.round(ZN.NG.hp * n * 100) + '% HP, +' +
        Math.round(ZN.NG.dmg * n * 100) + '% damage, more waves, earlier threats). You keep coins, upgrades, mastery, survivors, pets, relics and achievements, earn ×' +
        (1 + ZN.NG.reward * n).toFixed(1) + ' coins and XP, and gain a relic slot.', function () {
        Save.startNewGamePlus(); Save.checkAchievements(); Save.save();
        selected = null; renderMap.scrolled = false;
        toast('♾️ The Second Rising begins: New Game+ ' + n);
        show('map');
      });
    };
    $('backup-close').onclick = function () { overlay('ov-backup', false); };
    $('backup-copy').onclick = function () { $('backup-msg').textContent = copyText($('backup-out').value) ? 'Copied to clipboard.' : 'Select the code and copy it manually.'; };
    $('backup-share').onclick = function () {
      var code = $('backup-out').value;
      if (window.AndroidBridge && window.AndroidBridge.shareText) window.AndroidBridge.shareText(code);
      else if (navigator.share) navigator.share({ title: 'Zombie Nation save', text: code }).catch(function () {});
      else $('backup-msg').textContent = 'Sharing is not available here. Use Copy instead.';
    };
    $('backup-restore').onclick = function () {
      var code = $('backup-in').value;
      if (!code.trim()) { $('backup-msg').textContent = 'Paste a backup code first.'; return; }
      confirmBox('Restore this save?', 'Your current progress on this device will be replaced.', function () {
        var err = Save.importCode(code);
        if (err) { $('backup-msg').textContent = err; return; }
        overlay('ov-backup', false); selected = null; renderMap.scrolled = false;
        show('title'); toast('✅ Save restored');
      });
    };
    $('btn-reset').onclick = function () {
      confirmBox('Reset save?', 'This wipes all liberated counties, coins, upgrades and unlocks.', function () {
        Save.reset(); selected = null; renderMap.scrolled = false; show('title');
      });
    };
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { ZN.onPause(); ZN.Audio.suspend(); } else ZN.Audio.unlock();
    });
    window.addEventListener('resize', function () { if (current === 'map') sizeMap(); });
    updateSoundButtons(); updateTitleBadges();
    ZN.Music.play('menu');
    var startup = Save.checkAchievements();
    if (startup.length) {
      Save.save();
      startup.forEach(function (e) { toast((e.a.tiers.length > 1 ? ZN.TIER_MEDALS[e.tier - 1] : '🏆') + ' ' + Save.tierLabel(e.a, e.tier) + ' · ' + Save.rewardText(e.reward)); });
    }
    updateTitleBadges();
    if (!Save.data.seenIntro) { Save.data.seenIntro = true; Save.save(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.ZN);
