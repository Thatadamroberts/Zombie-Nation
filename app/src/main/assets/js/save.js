// Zombie Nation - persistent save data (Android SharedPreferences bridge, or localStorage in a browser)
'use strict';
(function (ZN) {
  var KEY = 'zombie_nation_save_v1';

  function defaults() {
    return { v: 1, coins: 0, accXp: 0, accLevel: 1, cleared: {}, shop: {}, sound: true, haptics: true, shake: true,
      character: 'tommy', owned: { tommy: true }, threats: {}, music: true,
      achievements: {}, achTiers: null, pets: {}, pet: null, items: {}, daily: { date: '', won: false }, tokens: {},
      relics: {}, relicEquip: [], relicsMigrated: false, ngPlus: 0,
      stats: { kills: 0, runs: 0, wins: 0, bestLevel: 0, evolved: {}, bosses: {}, dailies: 0, noHitWins: 0, defended: 0,
        bossKills: 0, timePlayed: 0, coinsEarned: 0, buffs: 0, tokens: 0, eventsDone: 0 },
      seenIntro: false };
  }

  function rawLoad() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.load) return window.AndroidBridge.load();
      return window.localStorage.getItem(KEY);
    } catch (e) { return null; }
  }
  function rawSave(str) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.save) { window.AndroidBridge.save(str); return; }
      window.localStorage.setItem(KEY, str);
    } catch (e) { /* storage unavailable: progress lasts for this session only */ }
  }

  function checksum(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  var Save = ZN.Save = {
    data: defaults(),
    load: function () {
      var raw = rawLoad(), d = defaults();
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          for (var k in parsed) d[k] = parsed[k];
          d.stats = Object.assign(defaults().stats, parsed.stats || {});
        } catch (e) { /* corrupt save: start fresh */ }
      }
      Save.data = d;
      Save.migrate();
      return d;
    },

    // Converts the old one-off achievements into tiers already earned (no rewards paid twice)
    migrate: function () {
      var d = Save.data;
      // Relics for bosses beaten before relics existed
      if (!d.relicsMigrated) {
        d.relicsMigrated = true; d.relics = d.relics || {}; d.relicEquip = d.relicEquip || [];
        Object.keys(d.stats.bosses || {}).forEach(function (k) { Save.grantRelic(k); });
      }
      if (d.achTiers) return;
      d.achTiers = {};
      for (var old in d.achievements) {
        var m = ZN.ACH_MIGRATE[old];
        if (m) d.achTiers[m[0]] = Math.max(d.achTiers[m[0]] || 0, m[1]);
      }
      // Rough back-fill for stats that did not exist before
      if (!d.stats.bossKills) d.stats.bossKills = d.stats.wins || 0;
      if (!d.stats.coinsEarned) d.stats.coinsEarned = d.coins || 0;
    },
    save: function () { rawSave(JSON.stringify(Save.data)); },
    reset: function () { Save.data = defaults(); Save.save(); },

    isThreatened: function (id) { return Save.data.threats[id] > 0; },

    // Called after every mission. Ticks counter-attack timers, may start a new one.
    // Returns { defended, fallen: [ids], newThreat }
    updateThreats: function (playedId, won) {
      var d = Save.data, out = { defended: null, fallen: [], newThreat: null };
      if (won && d.threats[playedId]) { delete d.threats[playedId]; out.defended = playedId; }
      Object.keys(d.threats).forEach(function (id) {
        d.threats[id]--;
        if (d.threats[id] <= 0) { delete d.threats[id]; delete d.cleared[id]; out.fallen.push(id); }
      });
      var open = Object.keys(d.threats).length;
      if (Save.clearedCount() >= 3 && open < 2 && Math.random() < 0.4) {
        var cands = Object.keys(d.cleared).filter(function (id) {
          return id !== playedId && !d.threats[id] && ZN.MAP.byId[id].adj.some(function (n) { return !d.cleared[n]; });
        });
        if (cands.length) {
          var pick = cands[(Math.random() * cands.length) | 0];
          d.threats[pick] = ZN.THREAT_MISSIONS; out.newThreat = pick;
        }
      }
      return out;
    },

    // Grants any newly earned achievements; returns the list of them
    // Returns a list of { a, tier (1-based), reward } for each newly earned tier
    checkAchievements: function () {
      var d = Save.data, x = { save: d, stats: d.stats }, out = [];
      if (!d.achTiers) Save.migrate();
      ZN.ACHIEVEMENTS.forEach(function (a) {
        var have = d.achTiers[a.id] || 0, v = a.value(x);
        while (have < a.tiers.length && v >= a.tiers[have][0]) {
          var r = a.tiers[have][1];
          if (r.coins) d.coins += r.coins;
          if (r.character) d.owned[r.character] = true;
          if (r.pet) { d.pets[r.pet] = true; if (!d.pet) d.pet = r.pet; }
          if (r.item) d.items[r.item] = true;
          have++;
          out.push({ a: a, tier: have, reward: r });
        }
        d.achTiers[a.id] = have;
      });
      return out;
    },
    tierLabel: function (a, tier) { return a.tiers.length > 1 ? a.name + ' ' + ZN.TIER_NAMES[tier - 1] : a.name; },
    tierCounts: function () {
      var d = Save.data, got = 0, total = 0;
      ZN.ACHIEVEMENTS.forEach(function (a) { got += (d.achTiers && d.achTiers[a.id]) || 0; total += a.tiers.length; });
      return { got: got, total: total };
    },
    rewardText: function (r) {
      if (r.coins) return '💰 ' + r.coins + ' coins';
      if (r.character) { var c = ZN.characterById(r.character); return c.icon + ' New survivor: ' + c.name; }
      if (r.pet) return ZN.PETS[r.pet].icon + ' Companion: ' + ZN.PETS[r.pet].name;
      if (r.item) return ZN.PASSIVES[r.item].icon + ' New item: ' + ZN.PASSIVES[r.item].name;
      return '';
    },

    // ----- daily challenge (same for everyone on a given date)
    todayKey: function () {
      var t = new Date();
      return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
    },
    daily: function () {
      var key = Save.todayKey(), h = 2166136261;
      for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      var rnd = function () { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
      var county = ZN.COUNTIES[Math.floor(rnd() * ZN.COUNTIES.length)];
      var keys = Object.keys(ZN.DAILY_MODS), mods = [];
      while (mods.length < 2) { var k = keys[Math.floor(rnd() * keys.length)]; if (mods.indexOf(k) < 0) mods.push(k); }
      var done = Save.data.daily.date === key && Save.data.daily.won;
      return { key: key, county: county, mods: mods, done: done };
    },

    // ----- backup codes
    exportCode: function () {
      var json = JSON.stringify(Save.data), b64 = btoa(unescape(encodeURIComponent(json)));
      return 'ZN1-' + b64 + '-' + checksum(b64);
    },
    importCode: function (code) {
      code = (code || '').replace(/\s+/g, '');
      var m = /^ZN1-([A-Za-z0-9+/=]+)-([0-9a-f]{8})$/.exec(code);
      if (!m || checksum(m[1]) !== m[2]) return 'That code is incomplete or mistyped.';
      try {
        var data = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        if (!data || typeof data.cleared !== 'object') return 'That code does not contain a Zombie Nation save.';
        var d = defaults();
        for (var k in data) d[k] = data[k];
        d.stats = Object.assign(defaults().stats, data.stats || {});
        Save.data = d; Save.migrate(); Save.save();
        return null;
      } catch (e) { return 'That code could not be read.'; }
    },

    // ----- relics
    relicSlots: function () { return ZN.relicSlots(Save.data.ngPlus); },
    grantRelic: function (bossKey) {
      var d = Save.data;
      if (!ZN.RELICS[bossKey] || d.relics[bossKey]) return null;
      d.relics[bossKey] = true;
      if (d.relicEquip.length < Save.relicSlots()) d.relicEquip.push(bossKey);
      return bossKey;
    },
    toggleRelic: function (id) {
      var d = Save.data, i = d.relicEquip.indexOf(id);
      if (i >= 0) { d.relicEquip.splice(i, 1); return true; }
      if (!d.relics[id] || d.relicEquip.length >= Save.relicSlots()) return false;
      d.relicEquip.push(id); return true;
    },

    // ----- New Game+
    canNewGamePlus: function () { return Save.clearedCount() >= ZN.COUNTIES.length; },
    startNewGamePlus: function () {
      var d = Save.data;
      d.ngPlus = (d.ngPlus || 0) + 1;
      d.cleared = {}; d.threats = {}; d.lastCounty = null;
    },
    ngTierBonus: function () { return (Save.data.ngPlus || 0) * ZN.NG.tier; },

    clearedCount: function () { return Object.keys(Save.data.cleared).length; },
    isCleared: function (id) { return !!Save.data.cleared[id]; },
    isAvailable: function (id) {
      if (Save.isCleared(id)) return true;
      if (Save.clearedCount() === 0) return true; // first mission: start anywhere
      var c = ZN.MAP.byId[id];
      return c.adj.some(function (n) { return Save.isCleared(n); });
    },
    wavesFor: function (id) {
      if (Save.isCleared(id)) return Save.data.cleared[id];
      return Math.min(1 + Save.clearedCount() + (Save.data.ngPlus || 0) * ZN.NG.waves, ZN.MAX_WAVES);
    },

    unlockedSet: function () {
      var set = {}, lvl = Save.data.accLevel;
      for (var l in ZN.UNLOCKS) if (+l <= lvl) ZN.UNLOCKS[l].forEach(function (id) { set[id] = true; });
      for (var it in Save.data.items) set[it] = true;
      var season = ZN.currentSeason();
      if (season) set[season.weapon] = true;
      return set;
    },
    unlockLevelOf: function (id) {
      for (var l in ZN.UNLOCKS) if (ZN.UNLOCKS[l].indexOf(id) >= 0) return +l;
      return null;
    },
    // Adds account XP; returns array of {level, items} for each new level gained
    addAccountXp: function (n) {
      var d = Save.data, gained = [];
      d.accXp += n;
      while (d.accXp >= ZN.accountXpFor(d.accLevel)) {
        d.accXp -= ZN.accountXpFor(d.accLevel);
        d.accLevel++;
        gained.push({ level: d.accLevel, items: ZN.UNLOCKS[d.accLevel] || [] });
      }
      return gained;
    }
  };
})(window.ZN);
