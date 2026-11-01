// Zombie Nation - persistent save data (Android SharedPreferences bridge, or localStorage in a browser)
'use strict';
(function (ZN) {
  var KEY = 'zombie_nation_save_v1';

  function defaults() {
    return { v: 1, coins: 0, accXp: 0, accLevel: 1, cleared: {}, shop: {}, sound: true, haptics: true, shake: true,
      character: 'tommy', owned: { tommy: true }, threats: {},
      stats: { kills: 0, runs: 0, wins: 0, bestLevel: 0 }, seenIntro: false };
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
      return d;
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
      return Math.min(1 + Save.clearedCount(), ZN.MAX_WAVES);
    },

    unlockedSet: function () {
      var set = {}, lvl = Save.data.accLevel;
      for (var l in ZN.UNLOCKS) if (+l <= lvl) ZN.UNLOCKS[l].forEach(function (id) { set[id] = true; });
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
