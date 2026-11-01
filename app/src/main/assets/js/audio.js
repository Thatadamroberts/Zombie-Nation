// Zombie Nation - tiny procedural sound effects via WebAudio
'use strict';
(function (ZN) {
  var ctx = null, master = null, last = {};

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slide) {
    var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lp) {
    var t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lp || 1200;
    src.buffer = buf; g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  var SOUNDS = {
    shoot:   function () { tone(520, 0.06, 'square', 0.06, 0.5); },
    slash:   function () { noise(0.12, 0.15, 3000); },
    hit:     function () { tone(180, 0.05, 'triangle', 0.08, 0.6); },
    gem:     function () { tone(900 + Math.random() * 300, 0.05, 'sine', 0.07, 1.5); },
    coin:    function () { tone(1200, 0.05, 'square', 0.06, 1.3); tone(1600, 0.08, 'square', 0.04); },
    hurt:    function () { tone(140, 0.15, 'sawtooth', 0.15, 0.5); },
    boom:    function () { noise(0.4, 0.35, 600); },
    zap:     function () { tone(1400, 0.1, 'sawtooth', 0.06, 0.3); },
    levelup: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'square', 0.1); }, i * 70); }); },
    evolve:  function () { [392, 523, 659, 784, 1046, 1318].forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 'triangle', 0.14); }, i * 80); }); },
    wave:    function () { tone(220, 0.4, 'sawtooth', 0.12, 1.5); },
    boss:    function () { tone(80, 0.9, 'sawtooth', 0.2, 0.6); noise(0.6, 0.2, 400); },
    win:     function () { [523, 659, 784, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'square', 0.1); }, i * 120); }); },
    lose:    function () { [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { tone(f, 0.3, 'triangle', 0.14); }, i * 180); }); },
    click:   function () { tone(700, 0.04, 'square', 0.05); }
  };

  var lastBuzz = 0;
  // Vibration: native bridge on Android, navigator.vibrate elsewhere
  ZN.haptic = function (pattern) {
    if (ZN.Save.data.haptics === false) return;
    var now = performance.now();
    if (now - lastBuzz < 70) return;
    lastBuzz = now;
    try {
      if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(Array.isArray(pattern) ? pattern.join(',') : String(pattern));
      } else if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* vibration unavailable */ }
  };

  // ------------------------------------------------------------------ music
  // Tracks are written on a 16th-note grid. lead: [midi, steps] pairs (0 = rest).
  function seq(pairs) { var out = []; pairs.forEach(function (p) { out.push(p[0]); for (var i = 1; i < p[1]; i++) out.push(-1); }); return out; }
  var TRACKS = {
    menu: { bpm: 76, roots: [45, 41, 38, 40], chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
      bass: [0, -1, -1, -1, -1, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, -1], arp: true, kick: 'x...............', snare: '................', hat: '................',
      lead: seq([[76, 8], [72, 8], [69, 8], [72, 8], [74, 8], [77, 8], [76, 12], [0, 4]]), leadVol: 0.05, bassWave: 'triangle' },
    battle: { bpm: 132, roots: [45, 41, 48, 43, 45, 41, 43, 40],
      bass: [0, -1, 12, -1, 0, -1, 12, 0, 0, -1, 12, -1, 7, -1, 12, -1],
      kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
      lead: seq([[69, 4], [72, 2], [76, 2], [74, 2], [72, 2], [71, 2], [72, 2],
                 [69, 6], [65, 2], [69, 2], [72, 4], [0, 2],
                 [67, 4], [72, 2], [76, 2], [79, 4], [76, 2], [72, 2],
                 [74, 6], [71, 2], [67, 4], [0, 4],
                 [76, 2], [76, 2], [81, 4], [79, 2], [76, 2], [72, 4],
                 [77, 4], [76, 2], [72, 2], [69, 4], [72, 4],
                 [71, 2], [74, 2], [79, 4], [77, 2], [74, 2], [71, 4],
                 [68, 4], [71, 4], [76, 6], [0, 2]]), leadVol: 0.045, bassWave: 'square' },
    boss: { bpm: 160, roots: [45, 45, 46, 40],
      bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 1, 0, 12, 0],
      kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
      lead: seq([[81, 2], [0, 2], [81, 2], [79, 2], [77, 2], [76, 4], [0, 2],
                 [84, 2], [83, 2], [81, 2], [79, 2], [81, 8],
                 [82, 4], [81, 2], [79, 2], [77, 4], [74, 4],
                 [76, 4], [80, 4], [83, 4], [88, 4]]), leadVol: 0.04, bassWave: 'sawtooth' }
  };
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var music = { want: null, track: null, step: 0, next: 0, timer: null, gain: null };

  function note(freq, t, dur, type, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(music.gain); o.start(t); o.stop(t + dur + 0.02);
  }
  function drum(kind, t) {
    if (kind === 'kick') {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(music.gain); o.start(t); o.stop(t + 0.16);
      return;
    }
    var len = kind === 'snare' ? 0.12 : 0.03, buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gg = ctx.createGain();
    f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 7000;
    gg.gain.value = kind === 'snare' ? 0.16 : 0.05;
    src.buffer = buf; src.connect(f); f.connect(gg); gg.connect(music.gain); src.start(t);
  }
  function scheduleStep(tr, step, t) {
    var sd = 60 / tr.bpm / 4, bar = Math.floor(step / 16) % tr.roots.length, i = step % 16, root = tr.roots[bar];
    if (tr.bass[i] >= 0) note(mf(root + tr.bass[i]), t, sd * 1.8, tr.bassWave, 0.07);
    if (tr.arp) { var ch = tr.chords[bar], seqA = [0, 1, 2, 1]; note(mf(ch[seqA[i % 4]] + 12), t, sd * 1.5, 'triangle', 0.04); }
    if (tr.kick.charAt(i) === 'x') drum('kick', t);
    if (tr.snare.charAt(i) === 'x') drum('snare', t);
    if (tr.hat.charAt(i) === 'x') drum('hat', t);
    var li = step % tr.lead.length, ln = tr.lead[li];
    if (ln > 0) {
      var len = 1; while (tr.lead[(li + len) % tr.lead.length] === -1 && len < 16) len++;
      note(mf(ln), t, sd * len * 0.95, 'square', tr.leadVol);
    }
  }
  function tick() {
    var tr = TRACKS[music.track];
    if (!tr || !ctx) return;
    if (music.next < ctx.currentTime - 0.25) music.next = ctx.currentTime + 0.05;
    while (music.next < ctx.currentTime + 0.15) {
      scheduleStep(tr, music.step, music.next);
      music.step++; music.next += 60 / tr.bpm / 4;
    }
  }
  function startMusic() {
    if (!music.want || !ZN.Save.data.music || !ensure() || ctx.state !== 'running') return;
    if (music.track === music.want && music.timer) return;
    if (!music.gain) { music.gain = ctx.createGain(); music.gain.gain.value = 0.55; music.gain.connect(master); }
    music.track = music.want; music.step = 0; music.next = ctx.currentTime + 0.06;
    if (!music.timer) music.timer = setInterval(tick, 30);
  }
  ZN.Music = {
    play: function (name) { music.want = name; if (music.track !== name) { music.track = null; } startMusic(); },
    stop: function () { music.want = null; music.track = null; if (music.timer) { clearInterval(music.timer); music.timer = null; } },
    refresh: function () { if (ZN.Save.data.music) { var w = music.want; music.track = null; music.want = w; startMusic(); } else { var keep = music.want; ZN.Music.stop(); music.want = keep; } }
  };

  ZN.Audio = {
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().then(startMusic); else startMusic();
    },
    play: function (name, minGapMs) {
      if (!ZN.Save.data.sound || !ensure() || ctx.state !== 'running') return;
      var now = performance.now();
      if (last[name] && now - last[name] < (minGapMs || 40)) return;
      last[name] = now;
      try { SOUNDS[name](); } catch (e) { /* ignore audio errors */ }
    }
  };
})(window.ZN);
