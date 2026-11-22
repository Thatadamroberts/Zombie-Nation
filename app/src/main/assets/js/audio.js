// Zombie Nation - procedural sound engine (WebAudio): layered synths, filtered noise, reverb and a bus compressor
'use strict';
(function (ZN) {
  var ctx = null, master = null, sfxBus = null, revSend = null, last = {}, noiseBuf = null, distCurve = null;
  var voices = 0, MAX_VOICES = 32;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
      comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(comp);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxLevel(); sfxBus.connect(master);
      // small-room reverb from a generated impulse
      var len = Math.floor(ctx.sampleRate * 1.3), imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var dd = imp.getChannelData(c); for (var k = 0; k < len; k++) dd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
      var conv = ctx.createConvolver(); conv.buffer = imp;
      revSend = ctx.createGain(); revSend.gain.value = 0.22; revSend.connect(conv); conv.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var n = 0; n < nd.length; n++) nd[n] = Math.random() * 2 - 1;
      distCurve = new Float32Array(1024); for (var q = 0; q < 1024; q++) { var x = q / 512 - 1; distCurve[q] = Math.tanh(x * 4); }
    } catch (e) { ctx = null; }
    return ctx;
  }
  function sfxLevel() { var v = ZN.Save && ZN.Save.data ? ZN.Save.data.sfxVol : null; return v == null ? 1 : v; }

  // route a voice: dry to the SFX bus, optional reverb send, optional stereo pan
  function route(node, o, endT) {
    var outN = node;
    if (o.pan && ctx.createStereoPanner) { var pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(pn); outN = pn; }
    outN.connect(sfxBus);
    if (o.rev) { var rg = ctx.createGain(); rg.gain.value = o.rev; outN.connect(rg); rg.connect(revSend); }
  }
  function env(g, t, a, dur, vol, curve) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  var T0 = 0, PV = 1, VM = 1;   // per-sound start time, pitch variance and level
  var LEVEL = { chain: 3, slash: 2.2, robo: 2.2, snow: 2, rattle: 1.8, buff: 1.8, groan: 1.5, flame: 1.3, blade: 1.5, iceBlade: 1.5, holyBlade: 1.4, heavySwing: 1.4, bagpipes: 1.4, coo: 1.5, spit: 1.6,
    diePoof: 1.4, dieClank: 1.5, heal: 1.4, magnet: 1.4, boom: 0.8, shotgun: 0.85, bossDie: 0.9 };

  // oscillator voice: { f, f2 (slide target), type, dur, vol, a (attack), delay, lp, q, dist, rev, pan, vib }
  function osc(o) {
    var t = T0 + (o.delay || 0), s = ctx.createOscillator(), g = ctx.createGain(), node = s, dur = o.dur || 0.1;
    s.type = o.type || 'square';
    var f = o.f * (o.noPV ? 1 : PV);
    s.frequency.setValueAtTime(f, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2 * (o.noPV ? 1 : PV)), t + (o.slide || dur));
    if (o.vib) { var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; lfo.connect(lg); lg.connect(s.frequency); lfo.start(t); lfo.stop(t + (o.a || 0.005) + dur + 0.05); }
    if (o.dist) { var ws = ctx.createWaveShaper(); ws.curve = distCurve; node.connect(ws); node = ws; }
    if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = o.ft || 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + dur); fl.Q.value = o.q || 0.8; node.connect(fl); node = fl; }
    node.connect(g); env(g, t, o.a || 0.004, dur, (o.vol || 0.15) * VM);
    route(g, o);
    voices++; s.onended = function () { voices--; };
    s.start(t); s.stop(t + (o.a || 0.004) + dur + 0.05);
  }
  // filtered noise voice: { dur, vol, f (filter freq), f2 (sweep), ft (filter type), q, a, delay, rev, pan, dist }
  function nz(o) {
    var t = T0 + (o.delay || 0), s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), dur = o.dur || 0.1, node = s;
    s.buffer = noiseBuf; s.playbackRate.value = o.rate || 1;
    fl.type = o.ft || 'lowpass'; fl.frequency.setValueAtTime(o.f || 2000, t); fl.Q.value = o.q || 0.7;
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    if (o.dist) { var ws = ctx.createWaveShaper(); ws.curve = distCurve; node.connect(ws); node = ws; }
    node.connect(fl); fl.connect(g); env(g, t, o.a || 0.003, dur, (o.vol || 0.2) * VM);
    route(g, o);
    voices++; s.onended = function () { voices--; };
    s.start(t, Math.random() * 1.5); s.stop(t + (o.a || 0.003) + dur + 0.05);
  }
  function arp(notes, step, o) { notes.forEach(function (f, i) { osc(Object.assign({}, o, { f: f, delay: (o.delay || 0) + i * step })); }); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---------------------------------------------------------------- the library
  var S = {
    // ---- UI
    click:   function () { osc({ f: 1800, f2: 1200, type: 'sine', dur: 0.035, vol: 0.09 }); nz({ dur: 0.015, vol: 0.05, f: 6000, ft: 'highpass' }); },
    coin:    function () { osc({ f: 1568, type: 'square', dur: 0.06, vol: 0.05, lp: 5000 }); osc({ f: 2093, type: 'square', dur: 0.18, vol: 0.05, delay: 0.06, lp: 5000, rev: 0.3 }); },
    buy:     function () { nz({ dur: 0.05, vol: 0.12, f: 3000, ft: 'bandpass', q: 3 }); arp([1319, 1760, 2637], 0.05, { type: 'triangle', dur: 0.2, vol: 0.09, rev: 0.4 }); },
    levelup: function () { arp([523, 659, 784, 1046], 0.065, { type: 'square', dur: 0.14, vol: 0.06, lp: 4000, rev: 0.35 }); osc({ f: 1046, f2: 2093, type: 'sine', dur: 0.35, vol: 0.05, delay: 0.26, rev: 0.5 }); },
    evolve:  function () { arp([392, 523, 659, 784, 1046, 1318, 1568], 0.07, { type: 'triangle', dur: 0.3, vol: 0.1, rev: 0.6 }); nz({ dur: 1.0, vol: 0.06, f: 8000, f2: 2000, ft: 'highpass', delay: 0.1, rev: 0.6 }); osc({ f: 131, type: 'sawtooth', dur: 0.9, vol: 0.06, lp: 900, delay: 0.1 }); },
    win:     function () { arp([523, 659, 784, 1046], 0.13, { type: 'square', dur: 0.22, vol: 0.07, lp: 3500, rev: 0.4 }); arp([659, 784, 1046, 1318], 0.13, { type: 'triangle', dur: 0.5, vol: 0.06, delay: 0.55, rev: 0.6 }); osc({ f: 131, type: 'sawtooth', dur: 1.2, vol: 0.05, lp: 700, delay: 0.55 }); },
    lose:    function () { arp([392, 349, 311, 262], 0.22, { type: 'sawtooth', dur: 0.4, vol: 0.06, lp: 1200, rev: 0.5 }); osc({ f: 65, f2: 40, type: 'sine', dur: 1.4, vol: 0.18, delay: 0.7 }); },
    achieve: function () { arp([784, 988, 1175, 1568], 0.06, { type: 'triangle', dur: 0.25, vol: 0.08, rev: 0.5 }); osc({ f: 3136, type: 'sine', dur: 0.6, vol: 0.03, delay: 0.24, rev: 0.7 }); },

    // ---- generic combat
    shoot:   function () { nz({ dur: 0.05, vol: 0.13, f: 2500, f2: 600, ft: 'bandpass', q: 1.2 }); osc({ f: 260, f2: 90, type: 'square', dur: 0.06, vol: 0.06, lp: 1500 }); },
    slash:   function () { nz({ dur: 0.14, vol: 0.14, f: 1200, f2: 5000, ft: 'bandpass', q: 2.5, a: 0.02 }); },
    hit:     function () { nz({ dur: 0.05, vol: 0.12, f: 900, ft: 'lowpass' }); osc({ f: 160, f2: 70, type: 'sine', dur: 0.06, vol: 0.12 }); },
    boom:    function () { osc({ f: 110, f2: 32, type: 'sine', dur: 0.5, vol: 0.4 }); nz({ dur: 0.45, vol: 0.32, f: 2400, f2: 180, dist: true }); nz({ dur: 0.9, vol: 0.08, f: 900, f2: 120, delay: 0.05, rev: 0.6 }); },
    smallBoom: function () { osc({ f: 160, f2: 50, type: 'sine', dur: 0.22, vol: 0.25 }); nz({ dur: 0.22, vol: 0.2, f: 3000, f2: 300 }); },
    zap:     function () { osc({ f: 2400, f2: 300, type: 'sawtooth', dur: 0.12, vol: 0.06, lp: 6000 }); nz({ dur: 0.1, vol: 0.08, f: 5000, ft: 'highpass', dist: true }); },

    // ---- weapon voices
    pistol:  function () { nz({ dur: 0.06, vol: 0.16, f: 3200, f2: 700, ft: 'bandpass', q: 1 }); osc({ f: 320, f2: 80, type: 'square', dur: 0.07, vol: 0.07, lp: 1800 }); nz({ dur: 0.25, vol: 0.03, f: 1500, delay: 0.03, rev: 0.4 }); },
    shotgun: function () { osc({ f: 140, f2: 45, type: 'sine', dur: 0.18, vol: 0.3 }); nz({ dur: 0.22, vol: 0.3, f: 3500, f2: 400, dist: true }); nz({ dur: 0.08, vol: 0.08, f: 2000, ft: 'bandpass', q: 6, delay: 0.25 }); nz({ dur: 0.06, vol: 0.08, f: 1400, ft: 'bandpass', q: 6, delay: 0.34 }); },
    minigun: function () { nz({ dur: 0.035, vol: 0.12, f: 2800, f2: 900, ft: 'bandpass', q: 1.5 }); osc({ f: 200, f2: 120, type: 'square', dur: 0.03, vol: 0.05, lp: 1200 }); },
    laser:   function () { osc({ f: 2600, f2: 500, type: 'sawtooth', dur: 0.12, vol: 0.06, lp: 5000, slide: 0.1 }); osc({ f: 1300, f2: 250, type: 'square', dur: 0.1, vol: 0.03, lp: 3000 }); },
    plasma:  function () { osc({ f: 180, f2: 520, type: 'sawtooth', dur: 0.22, vol: 0.08, lp: 1400, vib: [28, 40] }); osc({ f: 90, type: 'sine', dur: 0.2, vol: 0.1 }); },
    rail:    function () { osc({ f: 300, f2: 3000, type: 'sawtooth', dur: 0.08, vol: 0.05, lp: 4000 }); nz({ dur: 0.04, vol: 0.22, f: 6000, ft: 'highpass', delay: 0.08 }); osc({ f: 90, f2: 40, type: 'sine', dur: 0.3, vol: 0.25, delay: 0.08 }); nz({ dur: 0.6, vol: 0.06, f: 3000, f2: 300, delay: 0.1, rev: 0.6 }); },
    bow:     function () { osc({ f: 220, f2: 180, type: 'triangle', dur: 0.12, vol: 0.12, lp: 1500 }); nz({ dur: 0.18, vol: 0.07, f: 1500, f2: 4000, ft: 'bandpass', q: 3, delay: 0.02 }); },
    crossbow:function () { nz({ dur: 0.03, vol: 0.18, f: 1500, ft: 'bandpass', q: 2 }); osc({ f: 160, f2: 120, type: 'triangle', dur: 0.15, vol: 0.14, lp: 1200 }); nz({ dur: 0.15, vol: 0.06, f: 2500, f2: 6000, ft: 'bandpass', q: 3, delay: 0.03 }); },
    throwW:  function () { nz({ dur: 0.22, vol: 0.11, f: 600, f2: 2600, ft: 'bandpass', q: 3, a: 0.04 }); },
    heavySwing: function () { nz({ dur: 0.22, vol: 0.16, f: 400, f2: 2000, ft: 'bandpass', q: 2, a: 0.05 }); osc({ f: 90, f2: 60, type: 'sine', dur: 0.2, vol: 0.08, delay: 0.05 }); },
    blade:   function () { nz({ dur: 0.12, vol: 0.12, f: 2000, f2: 7000, ft: 'bandpass', q: 3, a: 0.015 }); osc({ f: 3200, f2: 2600, type: 'sine', dur: 0.25, vol: 0.025, delay: 0.03, rev: 0.4 }); },
    iceBlade:function () { nz({ dur: 0.12, vol: 0.1, f: 3000, f2: 8000, ft: 'bandpass', q: 3 }); arp([2637, 3136, 3951], 0.025, { type: 'sine', dur: 0.2, vol: 0.03, rev: 0.6 }); },
    fireBlade:function () { nz({ dur: 0.22, vol: 0.16, f: 300, f2: 1600, a: 0.03 }); nz({ dur: 0.3, vol: 0.06, f: 3000, ft: 'highpass', delay: 0.04 }); },
    elecBlade:function () { nz({ dur: 0.1, vol: 0.1, f: 3000, f2: 7000, ft: 'bandpass', q: 3 }); osc({ f: 120, type: 'sawtooth', dur: 0.12, vol: 0.06, dist: true, lp: 3000, vib: [60, 30] }); },
    holyBlade:function () { nz({ dur: 0.18, vol: 0.12, f: 2000, f2: 6000, ft: 'bandpass', q: 2 }); arp([1046, 1318, 1568], 0.03, { type: 'triangle', dur: 0.35, vol: 0.05, rev: 0.7 }); },
    flame:   function () { nz({ dur: 0.14, vol: 0.1, f: 500, f2: 1400, q: 0.5 }); nz({ dur: 0.1, vol: 0.04, f: 4000, ft: 'highpass' }); },
    thunder: function () { nz({ dur: 0.05, vol: 0.2, f: 7000, ft: 'highpass' }); osc({ f: 80, f2: 35, type: 'sawtooth', dur: 0.6, vol: 0.12, lp: 300, dist: true, delay: 0.03 }); nz({ dur: 1.0, vol: 0.12, f: 600, f2: 80, delay: 0.05, rev: 0.7 }); },
    glass:   function () { arp([3200, 4100, 2800, 3600], 0.018, { type: 'sine', dur: 0.12, vol: 0.04 }); nz({ dur: 0.12, vol: 0.12, f: 6000, ft: 'highpass' }); nz({ dur: 0.5, vol: 0.06, f: 1800, ft: 'bandpass', q: 1, delay: 0.08 }); },
    bagpipes:function () { osc({ f: 233, type: 'sawtooth', dur: 0.5, vol: 0.05, lp: 1800, a: 0.05, vib: [5.5, 4], rev: 0.4 }); osc({ f: 117, type: 'sawtooth', dur: 0.5, vol: 0.04, lp: 900, a: 0.05 }); osc({ f: 466, type: 'square', dur: 0.4, vol: 0.025, lp: 2200, a: 0.05, delay: 0.08 }); },
    whack:   function () { osc({ f: 260, f2: 110, type: 'triangle', dur: 0.08, vol: 0.18 }); nz({ dur: 0.05, vol: 0.12, f: 1800, ft: 'bandpass', q: 2 }); },
    chain:   function () { for (var i = 0; i < 4; i++) nz({ dur: 0.04, vol: 0.06, f: 3000 + i * 600, ft: 'bandpass', q: 8, delay: i * 0.03 }); nz({ dur: 0.12, vol: 0.1, f: 800, f2: 3000, ft: 'bandpass', q: 2 }); },
    tok:     function () { osc({ f: 900, f2: 700, type: 'sine', dur: 0.05, vol: 0.14 }); nz({ dur: 0.02, vol: 0.08, f: 3000, ft: 'bandpass', q: 3 }); },
    coo:     function () { osc({ f: 420, f2: 360, type: 'sine', dur: 0.18, vol: 0.06, vib: [9, 25] }); },
    harpoon: function () { osc({ f: 140, f2: 95, type: 'triangle', dur: 0.25, vol: 0.12 }); nz({ dur: 0.2, vol: 0.08, f: 1000, f2: 4000, ft: 'bandpass', q: 3 }); },
    pop:     function () { osc({ f: 600, f2: 1400, type: 'sine', dur: 0.06, vol: 0.1 }); },
    bleep:   function () { osc({ f: 1760, type: 'square', dur: 0.04, vol: 0.035, lp: 4000 }); osc({ f: 2349, type: 'square', dur: 0.04, vol: 0.03, lp: 4000, delay: 0.04 }); },
    gravity: function () { osc({ f: 60, f2: 220, type: 'sawtooth', dur: 0.6, vol: 0.08, lp: 600, lp2: 1800, a: 0.1, rev: 0.5 }); osc({ f: 40, type: 'sine', dur: 0.8, vol: 0.15, a: 0.1 }); },
    launch:  function () { nz({ dur: 0.08, vol: 0.08, f: 600, ft: 'bandpass', q: 4 }); osc({ f: 120, f2: 80, type: 'triangle', dur: 0.12, vol: 0.1 }); nz({ dur: 0.4, vol: 0.09, f: 400, f2: 1600, ft: 'bandpass', q: 2, a: 0.08, delay: 0.06 }); },
    firework:function () { nz({ dur: 0.35, vol: 0.08, f: 1500, f2: 5000, ft: 'bandpass', q: 4, a: 0.1 }); osc({ f: 900, f2: 2400, type: 'sine', dur: 0.35, vol: 0.03 }); },
    snow:    function () { nz({ dur: 0.08, vol: 0.12, f: 1200, ft: 'bandpass', q: 1 }); },

    // ---- enemies
    dieSplat: function () { nz({ dur: 0.12, vol: 0.14, f: 700, f2: 200, q: 2 }); osc({ f: 120, f2: 60, type: 'sine', dur: 0.1, vol: 0.12 }); },
    dieClank: function () { arp([1200, 1700, 950], 0.03, { type: 'square', dur: 0.06, vol: 0.04, lp: 4000 }); nz({ dur: 0.1, vol: 0.12, f: 2500, ft: 'bandpass', q: 4 }); },
    diePoof:  function () { nz({ dur: 0.3, vol: 0.08, f: 1500, f2: 6000, ft: 'bandpass', q: 1, a: 0.02, rev: 0.5 }); osc({ f: 700, f2: 1400, type: 'sine', dur: 0.25, vol: 0.03, rev: 0.6 }); },
    dieRobot: function () { osc({ f: 900, f2: 120, type: 'square', dur: 0.14, vol: 0.05, lp: 3000 }); nz({ dur: 0.08, vol: 0.1, f: 5000, ft: 'highpass', dist: true }); },
    dieSquelch: function () { osc({ f: 90, f2: 30, type: 'sine', dur: 0.35, vol: 0.32 }); nz({ dur: 0.35, vol: 0.26, f: 1200, f2: 150, q: 3, dist: true }); nz({ dur: 0.5, vol: 0.06, f: 500, delay: 0.05, rev: 0.5 }); },
    groan:   function () { var f = 85 + Math.random() * 40; osc({ f: f, f2: f * 0.7, type: 'sawtooth', dur: 0.7, vol: 0.06, lp: 500, q: 4, a: 0.15, vib: [5, 6], pan: Math.random() * 1.4 - 0.7, rev: 0.4 }); },
    rattle:  function () { for (var i = 0; i < 6; i++) nz({ dur: 0.025, vol: 0.05, f: 2500, ft: 'bandpass', q: 6, delay: i * 0.04, pan: 0.3 }); },
    robo:    function () { arp([300, 450, 240], 0.07, { type: 'square', dur: 0.06, vol: 0.03, lp: 2000, pan: Math.random() * 1.4 - 0.7 }); },
    spit:    function () { nz({ dur: 0.1, vol: 0.1, f: 1500, f2: 500, ft: 'bandpass', q: 2 }); osc({ f: 300, f2: 700, type: 'sine', dur: 0.08, vol: 0.04 }); },
    boss:    function () { osc({ f: 75, f2: 48, type: 'sawtooth', dur: 1.1, vol: 0.18, lp: 700, dist: true, a: 0.08, vib: [7, 8] }); osc({ f: 112, f2: 70, type: 'sawtooth', dur: 1.0, vol: 0.08, lp: 900, a: 0.08 }); nz({ dur: 1.0, vol: 0.12, f: 600, f2: 200, a: 0.1, rev: 0.6 }); },
    bossMech:function () { osc({ f: 55, type: 'square', dur: 1.2, vol: 0.12, lp: 400, a: 0.05 }); arp([220, 330, 220, 440], 0.12, { type: 'sawtooth', dur: 0.1, vol: 0.06, lp: 2000 }); nz({ dur: 1.0, vol: 0.1, f: 3000, f2: 300, dist: true, rev: 0.5 }); },
    bossDie: function () { S.boom(); osc({ f: 140, f2: 30, type: 'sawtooth', dur: 1.6, vol: 0.12, lp: 600, dist: true, delay: 0.1, rev: 0.6 }); arp([523, 659, 784, 1046], 0.1, { type: 'triangle', dur: 0.4, vol: 0.05, delay: 0.6, rev: 0.6 }); },
    slam:    function () { osc({ f: 70, f2: 28, type: 'sine', dur: 0.5, vol: 0.4 }); nz({ dur: 0.35, vol: 0.2, f: 800, f2: 100, dist: true }); },
    warn:    function () { arp([880, 660], 0.12, { type: 'square', dur: 0.1, vol: 0.05, lp: 2500 }); },

    // ---- player and pickups
    hurt:    function () { osc({ f: 180, f2: 90, type: 'sawtooth', dur: 0.16, vol: 0.12, lp: 900 }); nz({ dur: 0.08, vol: 0.12, f: 1200, q: 1 }); },
    heal:    function () { arp([659, 880, 1175, 1568], 0.05, { type: 'sine', dur: 0.25, vol: 0.06, rev: 0.6 }); },
    gem:     function () { osc({ f: GEM.f, type: 'sine', dur: 0.08, vol: 0.06, noPV: true }); osc({ f: GEM.f * 2, type: 'sine', dur: 0.05, vol: 0.02, noPV: true, rev: 0.3 }); },
    magnet:  function () { osc({ f: 300, f2: 2400, type: 'sine', dur: 0.6, vol: 0.06, rev: 0.4 }); nz({ dur: 0.6, vol: 0.04, f: 1000, f2: 6000, ft: 'bandpass', q: 3 }); },
    chest:   function () { nz({ dur: 0.06, vol: 0.1, f: 900, ft: 'bandpass', q: 3 }); arp([784, 988, 1175, 1568, 1976], 0.06, { type: 'triangle', dur: 0.3, vol: 0.07, rev: 0.6, delay: 0.08 }); },
    buff:    function () { osc({ f: 220, f2: 880, type: 'sawtooth', dur: 0.3, vol: 0.06, lp: 2500 }); arp([880, 1109, 1319], 0.05, { type: 'square', dur: 0.12, vol: 0.04, lp: 4000, delay: 0.25, rev: 0.4 }); },
    revive:  function () { osc({ f: 130, f2: 520, type: 'sawtooth', dur: 0.8, vol: 0.08, lp: 1500, rev: 0.6 }); arp([523, 784, 1046], 0.1, { type: 'triangle', dur: 0.5, vol: 0.07, delay: 0.5, rev: 0.7 }); },
    wave:    function () { var era = ZN.game && ZN.game.era; if (era === 'future') { arp([440, 554, 659], 0.08, { type: 'sawtooth', dur: 0.25, vol: 0.05, lp: 2500, rev: 0.5 }); return; }
      osc({ f: 233, type: 'sawtooth', dur: 0.7, vol: 0.07, lp: 1100, a: 0.06, rev: 0.6, vib: [5, 3] }); osc({ f: 349, type: 'sawtooth', dur: 0.5, vol: 0.05, lp: 1300, a: 0.06, delay: 0.25, rev: 0.6 }); },
    threat:  function () { for (var i = 0; i < 3; i++) osc({ f: 700, f2: 400, type: 'square', dur: 0.18, vol: 0.05, lp: 2000, delay: i * 0.22 }); osc({ f: 60, type: 'sawtooth', dur: 0.7, vol: 0.06, lp: 300 }); },
    lieutenant: function () { osc({ f: 98, f2: 73, type: 'sawtooth', dur: 0.6, vol: 0.1, lp: 700, dist: true, a: 0.05 }); nz({ dur: 0.4, vol: 0.06, f: 900, rev: 0.4 }); }
  };
  S.dieBig = S.dieSquelch;

  // XP gems chime higher when collected in quick succession
  var GEM = { f: 1046, n: 0, t: 0 };

  // Each weapon gets its own voice: generic calls made while a weapon fires are swapped for these
  var WEAPON_SFX = {
    pistol: 'pistol', minigun: 'minigun', shotgun: 'shotgun', boomstick: 'shotgun',
    laserPistol: 'laser', photonStorm: 'laser', plasmaCannon: 'plasma', sunCannon: 'plasma', railgun: 'rail', massDriver: 'rail',
    droneSwarm: 'bleep', hiveMind: 'bleep', gravityWell: 'gravity', singularity: 'gravity',
    longbow: 'bow', arrowStorm: 'bow', crossbow: 'crossbow', ballista: 'crossbow', harpoon: 'harpoon', krakensReach: 'harpoon',
    throwingAxes: 'throwW', axeWhirlwind: 'throwW', longsword: 'blade', caliburn: 'holyBlade', halberd: 'heavySwing', yeomansWrath: 'heavySwing',
    iceSword: 'iceBlade', fireSword: 'fireBlade', elecSword: 'elecBlade', swordOfLight: 'holyBlade',
    flamethrower: 'flame', dragonsBreath: 'flame', lightning: 'thunder', thunderstorm: 'thunder', teslaBolts: 'zap',
    molotov: 'glass', napalm: 'glass', holyWater: 'glass', sanctified: 'glass', steamBombs: 'glass',
    bagpipes: 'bagpipes', highlandLament: 'bagpipes', cricketBat: 'whack', sixHitter: 'whack',
    bikeChain: 'chain', chainReaper: 'chain', cricketBall: 'tok', fastBowler: 'tok', darts: 'throwW', bullseye: 'throwW',
    pigeon: 'coo', pigeonSquadron: 'coo', gnome: 'pop', gnomeArmy: 'pop', trebuchet: 'launch', siegeEngine: 'launch',
    fireworks: 'firework', snowball: 'snow', eggs: 'throwW', pumpkin: 'launch'
  };
  var SWAPPABLE = { shoot: 1, zap: 1, slash: 1, boom: 1 };
  var weaponCtx = null;
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
    battle_medieval: { bpm: 116, roots: [38, 36, 34, 33],
      bass: [0, -1, -1, 7, -1, -1, 0, -1, 12, -1, -1, 7, -1, -1, 0, -1],
      kick: 'x.......x.......', snare: '....x.......x...', hat: 'x...x...x...x.x.',
      lead: seq([[74, 4], [77, 2], [76, 2], [74, 4], [69, 4],
                 [72, 4], [76, 2], [74, 2], [72, 4], [67, 4],
                 [70, 4], [74, 2], [72, 2], [70, 4], [65, 4],
                 [69, 4], [73, 4], [76, 4], [81, 4]]), leadVol: 0.06, bassWave: 'triangle', leadWave: 'triangle' },
    battle_future: { bpm: 138, roots: [40, 36, 43, 38],
      bass: [0, 12, 0, 12, 0, 12, 7, 12, 0, 12, 0, 12, 3, 12, 7, 12],
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xx',
      lead: seq([[76, 2], [79, 2], [83, 4], [81, 2], [79, 2], [76, 4],
                 [72, 2], [76, 2], [79, 4], [77, 2], [76, 2], [72, 4],
                 [79, 2], [83, 2], [86, 4], [84, 2], [83, 2], [79, 4],
                 [74, 2], [78, 2], [81, 4], [83, 4], [86, 4]]), leadVol: 0.035, bassWave: 'sawtooth', leadWave: 'sawtooth' },
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
      note(mf(ln), t, sd * len * 0.95, tr.leadWave || 'square', tr.leadVol);
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
    // which weapon is firing right now (set by the game loop), so its sounds can be swapped for its own voice
    weapon: function (id) { weaponCtx = id; },
    play: function (name, minGapMs, opt) {
      if (!ZN.Save.data.sound || !ensure() || ctx.state !== 'running') return;
      if (weaponCtx && SWAPPABLE[name] && WEAPON_SFX[weaponCtx]) name = WEAPON_SFX[weaponCtx];
      if (name === 'boss' && ZN.game && ZN.game.era === 'future') name = 'bossMech';
      if (!S[name]) return;
      var now = performance.now();
      if (last[name] && now - last[name] < (minGapMs || 40)) return;
      if (voices > MAX_VOICES && !(opt && opt.important)) return;
      last[name] = now;
      if (name === 'gem') { GEM.n = now - GEM.t < 450 ? Math.min(GEM.n + 1, 14) : 0; GEM.t = now; GEM.f = mtof(84 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24][GEM.n]); }
      T0 = ctx.currentTime; PV = opt && opt.pitch ? opt.pitch : 0.94 + Math.random() * 0.12; VM = LEVEL[name] || 1;
      try { S[name](); } catch (e) { /* ignore audio errors */ }
    },
    setVolume: function (v) { if (sfxBus) sfxBus.gain.value = v; },
    _debug: function () { ensure(); return { ctx: ctx, master: master, S: S, voices: function () { return voices; } }; }
  };
})(window.ZN);
