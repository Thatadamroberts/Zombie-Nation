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

  ZN.Audio = {
    unlock: function () { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    play: function (name, minGapMs) {
      if (!ZN.Save.data.sound || !ensure() || ctx.state !== 'running') return;
      var now = performance.now();
      if (last[name] && now - last[name] < (minGapMs || 40)) return;
      last[name] = now;
      try { SOUNDS[name](); } catch (e) { /* ignore audio errors */ }
    }
  };
})(window.ZN);
