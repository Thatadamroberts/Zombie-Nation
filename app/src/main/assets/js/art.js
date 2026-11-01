// Zombie Nation - procedural art: landmarks, regional bosses, flyers, survivor hats
'use strict';
(function (ZN) {
  var TAU = Math.PI * 2;

  function shadow(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
  }

  // ------------------------------------------------------------ landmarks
  var LANDMARKS = {
    bigben: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 60, 14);
      ctx.fillStyle = '#8a7a50'; ctx.fillRect(x - 22, y - 170, 44, 176);
      ctx.fillStyle = '#a8955f';
      for (var i = 0; i < 6; i++) ctx.fillRect(x - 18 + (i % 3) * 13, y - 150 + Math.floor(i / 3) * 50, 8, 30);
      ctx.fillStyle = '#6a5a38'; ctx.fillRect(x - 26, y - 128, 52, 46);
      ctx.fillStyle = '#f2ecd0'; ctx.beginPath(); ctx.arc(x, y - 105, 18, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.beginPath();
      var a = g.time * 0.5; ctx.moveTo(x, y - 105); ctx.lineTo(x + Math.cos(a) * 13, y - 105 + Math.sin(a) * 13);
      ctx.moveTo(x, y - 105); ctx.lineTo(x + Math.cos(a / 12) * 8, y - 105 + Math.sin(a / 12) * 8); ctx.stroke();
      ctx.fillStyle = '#4a4a3a'; ctx.beginPath(); ctx.moveTo(x - 24, y - 170); ctx.lineTo(x, y - 225); ctx.lineTo(x + 24, y - 170); ctx.fill();
      ctx.fillStyle = '#d8b84a'; ctx.fillRect(x - 1.5, y - 240, 3, 18);
    },
    stonehenge: function (g, ctx, x, y) {
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * TAU, sx = x + Math.cos(a) * 95, sy = y + Math.sin(a) * 55;
        shadow(ctx, sx + 4, sy + 6, 14, 5);
        ctx.fillStyle = '#8c8f86'; ctx.fillRect(sx - 9, sy - 34, 18, 38);
        ctx.fillStyle = '#a3a69c'; ctx.fillRect(sx - 9, sy - 34, 6, 38);
        if (i % 2 === 0) { ctx.fillStyle = '#7d8078'; ctx.fillRect(sx - 12, sy - 40, 40, 8); }
      }
      ctx.fillStyle = '#8c8f86'; ctx.fillRect(x - 14, y - 50, 28, 52);
      ctx.fillStyle = '#6f726a'; ctx.fillRect(x - 20, y - 58, 40, 10);
    },
    lighthouse: function (g, ctx, x, y) {
      shadow(ctx, x + 8, y + 4, 34, 10);
      for (var i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#c8102e' : '#f2f2f2';
        var w0 = 26 - i * 2.5, w1 = 26 - (i + 1) * 2.5;
        ctx.beginPath(); ctx.moveTo(x - w0, y - i * 26); ctx.lineTo(x + w0, y - i * 26); ctx.lineTo(x + w1, y - (i + 1) * 26); ctx.lineTo(x - w1, y - (i + 1) * 26); ctx.fill();
      }
      ctx.fillStyle = '#333'; ctx.fillRect(x - 14, y - 150, 28, 20);
      ctx.fillStyle = '#fff6a0'; ctx.fillRect(x - 10, y - 147, 20, 14);
      var a = g.time * 1.2;
      ctx.fillStyle = 'rgba(255,246,160,0.18)'; ctx.beginPath(); ctx.moveTo(x, y - 140);
      ctx.lineTo(x + Math.cos(a - 0.15) * 320, y - 140 + Math.sin(a - 0.15) * 120); ctx.lineTo(x + Math.cos(a + 0.15) * 320, y - 140 + Math.sin(a + 0.15) * 120); ctx.fill();
      ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.moveTo(x - 16, y - 150); ctx.lineTo(x, y - 168); ctx.lineTo(x + 16, y - 150); ctx.fill();
    },
    angel: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 110, 12);
      ctx.fillStyle = '#8a4a24';
      ctx.fillRect(x - 9, y - 120, 18, 124);
      ctx.beginPath(); ctx.arc(x, y - 128, 11, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 120, y - 92); ctx.lineTo(x + 120, y - 92); ctx.lineTo(x + 116, y - 78); ctx.lineTo(x - 116, y - 78); ctx.fill();
      ctx.strokeStyle = '#6a3618'; ctx.lineWidth = 1.5;
      for (var i = -110; i <= 110; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y - 92); ctx.lineTo(x + i, y - 78); ctx.stroke(); }
    },
    causeway: function (g, ctx, x, y) {
      for (var i = 0; i < 26; i++) {
        var col = i % 6, row = Math.floor(i / 6), hx = x - 75 + col * 30 + (row % 2) * 15, hy = y - 30 + row * 22, hgt = 6 + ((i * 7) % 5) * 5;
        ctx.fillStyle = '#2a2a30'; hex(ctx, hx, hy + 4, 15); ctx.fill();
        ctx.fillStyle = '#3e3e46'; ctx.fillRect(hx - 13, hy - hgt, 26, hgt + 2);
        ctx.fillStyle = '#5c5c66'; hex(ctx, hx, hy - hgt, 15); ctx.fill();
      }
    },
    loch: function (g, ctx, x, y) {
      ctx.fillStyle = '#244a66'; ctx.beginPath(); ctx.ellipse(x, y, 190, 80, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2e5c7c'; ctx.beginPath(); ctx.ellipse(x - 20, y - 8, 150, 55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = 2;
      for (var i = 0; i < 6; i++) { var rx = x - 120 + i * 45, ry = y - 20 + (i % 3) * 18; ctx.beginPath(); ctx.arc(rx, ry + Math.sin(g.time * 2 + i) * 2, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      if (Math.sin(g.time * 0.4) > 0.3) {
        ctx.fillStyle = '#2f5a4a';
        for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x + 30 + k * 22, y + 10, 9, 8, 0, Math.PI, TAU); ctx.fill(); }
        ctx.fillRect(x + 92, y - 22, 6, 30); ctx.beginPath(); ctx.ellipse(x + 98, y - 24, 9, 5, 0, 0, TAU); ctx.fill();
      }
    },
    castle: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 130, 14);
      ctx.fillStyle = '#7a7a72'; ctx.fillRect(x - 110, y - 60, 220, 64);
      ctx.fillStyle = '#8a8a82';
      for (var i = 0; i < 11; i++) ctx.fillRect(x - 110 + i * 21, y - 72, 12, 14);
      [-110, 110].forEach(function (tx) {
        ctx.fillStyle = '#6a6a62'; ctx.fillRect(x + tx - 22, y - 110, 44, 114);
        ctx.fillStyle = '#7a7a72'; for (var j = 0; j < 3; j++) ctx.fillRect(x + tx - 22 + j * 17, y - 122, 10, 14);
        ctx.fillStyle = '#222'; ctx.fillRect(x + tx - 4, y - 90, 8, 16);
      });
      ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.moveTo(x - 20, y + 4); ctx.lineTo(x - 20, y - 26); ctx.arc(x, y - 26, 20, Math.PI, 0); ctx.lineTo(x + 20, y + 4); ctx.fill();
      ctx.fillStyle = g.county.region === 'wales' ? '#c8102e' : '#1f4e8c';
      ctx.fillRect(x + 110, y - 150, 26, 16); ctx.fillStyle = '#ddd'; ctx.fillRect(x + 108, y - 150, 2, 30);
    },
    church: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 80, 12);
      ctx.fillStyle = '#8a8478'; ctx.fillRect(x - 60, y - 50, 90, 54);
      ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.moveTo(x - 66, y - 50); ctx.lineTo(x - 15, y - 82); ctx.lineTo(x + 36, y - 50); ctx.fill();
      ctx.fillStyle = '#7d776b'; ctx.fillRect(x + 30, y - 100, 34, 104);
      ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.moveTo(x + 26, y - 100); ctx.lineTo(x + 47, y - 160); ctx.lineTo(x + 68, y - 100); ctx.fill();
      ctx.fillStyle = '#3a5a8a'; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 45 + i * 24, y - 30, 6, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 51 + i * 24, y - 30, 12, 14); }
      ctx.fillStyle = '#2a1e14'; ctx.fillRect(x + 40, y - 22, 14, 26);
    },
    windmill: function (g, ctx, x, y) {
      shadow(ctx, x + 8, y + 6, 40, 10);
      ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(x - 30, y + 4); ctx.lineTo(x - 18, y - 110); ctx.lineTo(x + 18, y - 110); ctx.lineTo(x + 30, y + 4); ctx.fill();
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y - 116, 18, Math.PI, 0); ctx.fill();
      ctx.save(); ctx.translate(x, y - 110); ctx.rotate(g.time * 0.8);
      ctx.fillStyle = '#e8e0cc'; ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2;
      for (var i = 0; i < 4; i++) { ctx.rotate(TAU / 4); ctx.fillRect(6, -8, 80, 16); ctx.strokeRect(6, -8, 80, 16); }
      ctx.restore();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y - 110, 6, 0, TAU); ctx.fill();
    },
    pub: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 90, 12);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 80, y - 70, 160, 74);
      ctx.fillStyle = '#4a3020';
      for (var i = 0; i < 5; i++) ctx.fillRect(x - 80 + i * 40, y - 70, 5, 74);
      ctx.fillRect(x - 80, y - 40, 160, 4);
      ctx.fillStyle = '#5a2a1a'; ctx.beginPath(); ctx.moveTo(x - 90, y - 70); ctx.lineTo(x, y - 110); ctx.lineTo(x + 90, y - 70); ctx.fill();
      ctx.fillStyle = '#1f3a2a'; ctx.fillRect(x - 12, y - 30, 24, 34);
      ctx.fillStyle = '#ffd86a'; ctx.fillRect(x - 60, y - 30, 26, 18); ctx.fillRect(x + 34, y - 30, 26, 18);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 88, y - 80, 3, 50);
      ctx.fillStyle = '#7a1010'; ctx.fillRect(x + 92, y - 76, 46, 30);
      ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('THE', x + 115, y - 64); ctx.fillText(g.county.region === 'city' ? 'CROWN' : 'RED LION', x + 115, y - 53);
    },
    pithead: function (g, ctx, x, y) {
      shadow(ctx, x + 10, y + 6, 70, 12);
      ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x - 70, y - 40, 60, 44);
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - 10, y + 2); ctx.lineTo(x + 20, y - 130); ctx.lineTo(x + 50, y + 2); ctx.moveTo(x - 2, y - 40); ctx.lineTo(x + 42, y - 40); ctx.moveTo(x + 5, y - 80); ctx.lineTo(x + 36, y - 80); ctx.stroke();
      ctx.save(); ctx.translate(x + 20, y - 130); ctx.rotate(g.time * 1.5);
      ctx.strokeStyle = '#8a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke();
      for (var i = 0; i < 4; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke(); }
      ctx.restore();
    },
    cliffs: function (g, ctx, x, y) {
      ctx.fillStyle = '#2a5a7a'; ctx.fillRect(x - 260, y - 140, 520, 70);
      ctx.fillStyle = '#f0eee4'; ctx.beginPath(); ctx.moveTo(x - 260, y - 70);
      for (var i = 0; i <= 13; i++) ctx.lineTo(x - 260 + i * 40, y - 70 + (i % 2 ? 10 : -4));
      ctx.lineTo(x + 260, y - 30); ctx.lineTo(x - 260, y - 30); ctx.fill();
      ctx.fillStyle = '#d8d6cc'; ctx.fillRect(x - 260, y - 40, 520, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      for (var k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x - 240 + k * 90 + Math.sin(g.time + k) * 8, y - 115); ctx.lineTo(x - 210 + k * 90 + Math.sin(g.time + k) * 8, y - 115); ctx.stroke(); }
    }
  };

  function hex(ctx, x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) { var a = i / 6 * TAU + Math.PI / 6; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6); }
    ctx.closePath();
  }

  ZN.drawLandmark = function (g, ctx, type, x, y) { (LANDMARKS[type] || LANDMARKS.church)(g, ctx, x, y); };

  // ------------------------------------------------- bosses and flyers
  function flash(ctx, e) {
    if (e.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
    if (e.freezeT > 0) { ctx.fillStyle = 'rgba(160,220,255,0.5)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, TAU); ctx.fill(); }
    if (e.burnT > 0) { ctx.fillStyle = 'rgba(255,140,0,0.6)'; ctx.beginPath(); ctx.arc(e.x + (Math.random() - 0.5) * e.r, e.y - e.r * 0.5, e.r * 0.3, 0, TAU); ctx.fill(); }
  }

  function eyes(ctx, x, y, s, col) {
    ctx.fillStyle = col || '#ffea00';
    ctx.beginPath(); ctx.arc(x - s, y, Math.max(2, s * 0.45), 0, TAU); ctx.arc(x + s, y, Math.max(2, s * 0.45), 0, TAU); ctx.fill();
  }

  function windLine(ctx, e) {
    if (e.windT > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.cdx * 300, e.y + e.cdy * 300); ctx.stroke(); }
  }

  function bird(ctx, e, g, scale) {
    var r = e.r * scale, dir = e.dir || 0, flap = Math.sin(e.anim * 2.5) * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 1.6, r, r * 0.35, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(dir);
    ctx.fillStyle = e.def.color;
    ctx.beginPath(); ctx.moveTo(r * 0.2, 0); ctx.lineTo(-r * 0.4, -r * (1.6 + flap)); ctx.lineTo(-r * 0.7, -r * 0.2); ctx.lineTo(-r * 0.7, r * 0.2); ctx.lineTo(-r * 0.4, r * (1.6 + flap)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a1a0a'; ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(-r * 1.4, -r * 0.4); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 1.4, r * 0.4); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.1); ctx.lineTo(r * 1.25, 0); ctx.lineTo(r * 0.9, r * 0.1); ctx.fill();
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.15, Math.max(1.5, r * 0.1), 0, TAU); ctx.fill();
    ctx.restore();
  }

  var SHAPES = {
    kite: function (g, ctx, e) { windLine(ctx, e); bird(ctx, e, g, 1); },
    beefeater: function (g, ctx, e) {
      var r = e.r; windLine(ctx, e);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9a1020'; ctx.beginPath(); ctx.ellipse(e.x, e.y, r * 0.85, r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd23a'; ctx.fillRect(e.x - r * 0.85, e.y - r * 0.1, r * 1.7, r * 0.15); ctx.fillRect(e.x - r * 0.08, e.y - r * 0.9, r * 0.16, r * 1.7);
      ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.arc(e.x, e.y - r * 0.9, r * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.ellipse(e.x, e.y - r * 1.25, r * 0.6, r * 0.22, 0, 0, TAU); ctx.fill(); ctx.fillRect(e.x - r * 0.35, e.y - r * 1.5, r * 0.7, r * 0.3);
      eyes(ctx, e.x, e.y - r * 0.9, r * 0.17, '#ff2a2a');
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(e.x + r * 0.9, e.y + r); ctx.lineTo(e.x + r * 1.1, e.y - r * 1.8); ctx.stroke();
      ctx.fillStyle = '#cfd6de'; ctx.beginPath(); ctx.moveTo(e.x + r * 1.1, e.y - r * 2.2); ctx.lineTo(e.x + r * 1.45, e.y - r * 1.6); ctx.lineTo(e.x + r * 0.95, e.y - r * 1.55); ctx.fill();
    },
    druid: function (g, ctx, e) {
      var r = e.r;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8d8c8'; ctx.beginPath(); ctx.moveTo(e.x - r, e.y + r * 0.9); ctx.lineTo(e.x - r * 0.4, e.y - r * 1.1); ctx.lineTo(e.x + r * 0.4, e.y - r * 1.1); ctx.lineTo(e.x + r, e.y + r * 0.9); ctx.fill();
      ctx.fillStyle = '#4a5a3a'; ctx.beginPath(); ctx.arc(e.x, e.y - r * 0.95, r * 0.5, Math.PI, 0); ctx.lineTo(e.x + r * 0.3, e.y - r * 0.3); ctx.lineTo(e.x - r * 0.3, e.y - r * 0.3); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e.x, e.y - r * 0.75, r * 0.3, 0, TAU); ctx.fill();
      eyes(ctx, e.x, e.y - r * 0.78, r * 0.12, '#7dff8a');
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(e.x - r * 1.1, e.y + r); ctx.lineTo(e.x - r * 1.2, e.y - r * 1.6); ctx.stroke();
      ctx.fillStyle = 'rgba(125,255,138,' + (0.5 + Math.sin(g.time * 6) * 0.3) + ')'; ctx.beginPath(); ctx.arc(e.x - r * 1.2, e.y - r * 1.7, r * 0.25, 0, TAU); ctx.fill();
    },
    nessie: function (g, ctx, e) {
      var r = e.r, d = e.dir || 0, sway = Math.sin(e.anim) * 0.2;
      ctx.fillStyle = '#244a66'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.4, r * 1.6, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = e.def.color;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(e.x - Math.cos(d) * r * (0.3 + i * 0.5), e.y + r * 0.3 - Math.sin(d) * r * 0.3 * i, r * 0.35, r * 0.4, 0, Math.PI, TAU); ctx.fill(); }
      var nx = e.x + Math.cos(d + sway) * r * 0.6, ny = e.y - r * 1.4;
      ctx.strokeStyle = e.def.color; ctx.lineWidth = r * 0.35; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(d) * r * 0.3, e.y + r * 0.2); ctx.quadraticCurveTo(e.x + Math.cos(d) * r * 0.9, e.y - r * 0.4, nx, ny); ctx.stroke();
      ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.ellipse(nx + Math.cos(d) * r * 0.2, ny, r * 0.38, r * 0.24, 0, 0, TAU); ctx.fill();
      eyes(ctx, nx + Math.cos(d) * r * 0.25, ny - r * 0.06, r * 0.1, '#ff2a2a');
    },
    golem: function (g, ctx, e) {
      var r = e.r;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r * 1.1, r * 0.4, 0, 0, TAU); ctx.fill();
      for (var i = 0; i < 7; i++) {
        var a = i / 6 * TAU, hx = i ? e.x + Math.cos(a) * r * 0.55 : e.x, hy = i ? e.y + Math.sin(a) * r * 0.45 : e.y - r * 0.3;
        ctx.fillStyle = i ? '#3e3e46' : '#4a4a54'; hex(ctx, hx, hy, r * 0.42); ctx.fill();
        ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      eyes(ctx, e.x, e.y - r * 0.35, r * 0.18, '#ff7a2a');
    },
    kraken: function (g, ctx, e) {
      var r = e.r, t = g.time;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r * 1.3, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = e.def.color; ctx.lineCap = 'round';
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * TAU + Math.sin(t * 2 + i) * 0.2, L = r * 1.5;
        ctx.lineWidth = r * 0.22;
        ctx.beginPath(); ctx.moveTo(e.x, e.y + r * 0.2);
        ctx.quadraticCurveTo(e.x + Math.cos(a) * L * 0.6 + Math.sin(t * 3 + i) * 8, e.y + r * 0.2 + Math.sin(a) * L * 0.4,
          e.x + Math.cos(a + Math.sin(t * 2.5 + i) * 0.4) * L, e.y + r * 0.3 + Math.sin(a) * L * 0.55);
        ctx.stroke();
      }
      ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.ellipse(e.x, e.y - r * 0.3, r * 0.75, r * 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = e.def.color; for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(e.x - r * 0.4 + k * r * 0.27, e.y - r * 0.9 + (k % 2) * 6, r * 0.09, 0, TAU); ctx.fill(); }
      eyes(ctx, e.x, e.y - r * 0.15, r * 0.28, '#ffd23a');
      ctx.fillStyle = '#111'; ctx.fillRect(e.x - r * 0.3, e.y - r * 0.2, r * 0.08, r * 0.14); ctx.fillRect(e.x + r * 0.24, e.y - r * 0.2, r * 0.08, r * 0.14);
    },
    shuck: function (g, ctx, e) {
      var r = e.r, flip = Math.cos(e.dir || 0) < 0 ? -1 : 1, run = Math.sin(e.anim * 2);
      windLine(ctx, e);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r * 1.2, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(flip, 1);
      ctx.fillStyle = '#0c0c10';
      ctx.fillRect(-r * 0.7 + run * 4, r * 0.1, r * 0.2, r * 0.7); ctx.fillRect(r * 0.4 - run * 4, r * 0.1, r * 0.2, r * 0.7);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.1); ctx.lineTo(-r * 1.5, -r * 0.6 + run * 4); ctx.lineTo(-r * 0.85, r * 0.15); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.95, -r * 0.4, r * 0.42, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.7); ctx.lineTo(r * 0.85, -r * 1.1); ctx.lineTo(r * 1.05, -r * 0.75); ctx.fill();
      ctx.fillRect(r * 1.1, -r * 0.4, r * 0.45, r * 0.25);
      ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 12; ctx.fillStyle = '#ff3030';
      ctx.beginPath(); ctx.arc(r * 1.1, -r * 0.5, r * 0.11, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
      if (Math.random() < 0.3) g.emit(e.x - flip * r, e.y, 1, 'rgba(60,60,80,0.6)', 20, 0.6, 4, -20);
    },
    worm: function (g, ctx, e) {
      var r = e.r, d = e.dir || 0, t = g.time;
      for (var i = 6; i >= 0; i--) {
        var off = i * r * 0.55, wig = Math.sin(t * 5 - i * 0.8) * r * 0.25;
        var sx = e.x - Math.cos(d) * off - Math.sin(d) * wig, sy = e.y - Math.sin(d) * off + Math.cos(d) * wig;
        var rr = r * (0.7 - i * 0.06);
        ctx.fillStyle = i % 2 ? e.def.color : e.def.skin; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      }
      var hx = e.x + Math.cos(d) * r * 0.3, hy = e.y + Math.sin(d) * r * 0.3;
      ctx.fillStyle = '#3a1010'; ctx.beginPath(); ctx.arc(hx + Math.cos(d) * r * 0.4, hy + Math.sin(d) * r * 0.4, r * 0.32, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f0e8d0';
      for (var k = 0; k < 6; k++) { var ta = k / 6 * TAU; ctx.beginPath(); ctx.arc(hx + Math.cos(d) * r * 0.4 + Math.cos(ta) * r * 0.25, hy + Math.sin(d) * r * 0.4 + Math.sin(ta) * r * 0.25, 2, 0, TAU); ctx.fill(); }
      eyes(ctx, hx - Math.cos(d) * r * 0.1, hy - r * 0.35, r * 0.2, '#ffea00');
    },
    jack: function (g, ctx, e) {
      var r = e.r, bounce = Math.abs(Math.sin(g.time * 8)) * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.9, r * 0.7, r * 0.25, 0, 0, TAU); ctx.fill();
      var y = e.y - bounce;
      ctx.strokeStyle = '#a0a8b0'; ctx.lineWidth = 2; ctx.beginPath();
      for (var i = 0; i < 6; i++) { ctx.lineTo(e.x - 5 + (i % 2) * 10, y + r * 0.5 + i * 3); } ctx.stroke();
      ctx.fillStyle = '#14141c'; ctx.beginPath(); ctx.moveTo(e.x - r * 0.9, y + r * 0.55); ctx.lineTo(e.x, y - r * 0.9); ctx.lineTo(e.x + r * 0.9, y + r * 0.55); ctx.fill();
      ctx.fillStyle = '#7a1020'; ctx.beginPath(); ctx.moveTo(e.x - r * 0.5, y + r * 0.4); ctx.lineTo(e.x, y - r * 0.5); ctx.lineTo(e.x + r * 0.5, y + r * 0.4); ctx.fill();
      ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.arc(e.x, y - r * 0.9, r * 0.32, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0a10'; ctx.fillRect(e.x - r * 0.45, y - r * 1.2, r * 0.9, r * 0.1); ctx.fillRect(e.x - r * 0.28, y - r * 1.75, r * 0.56, r * 0.58);
      ctx.shadowColor = '#5ad1ff'; ctx.shadowBlur = 10; eyes(ctx, e.x, y - r * 0.92, r * 0.13, '#5ad1ff'); ctx.shadowBlur = 0;
    },
    knight: function (g, ctx, e) {
      var r = e.r;
      windLine(ctx, e);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1e4a2a'; ctx.fillRect(e.x - r * 0.45, e.y + r * 0.2, r * 0.3, r * 0.65); ctx.fillRect(e.x + r * 0.15, e.y + r * 0.2, r * 0.3, r * 0.65);
      ctx.fillStyle = e.def.color; ctx.beginPath(); ctx.ellipse(e.x, e.y - r * 0.05, r * 0.7, r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a8a4a'; ctx.beginPath(); ctx.arc(e.x, e.y - r * 0.8, r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a1a0a'; ctx.fillRect(e.x - r * 0.3, e.y - r * 0.85, r * 0.6, r * 0.1);
      ctx.fillStyle = '#ff3030'; ctx.fillRect(e.x - r * 0.2, e.y - r * 0.86, r * 0.1, r * 0.08); ctx.fillRect(e.x + r * 0.1, e.y - r * 0.86, r * 0.1, r * 0.08);
      ctx.fillStyle = '#5ab05a'; ctx.beginPath(); ctx.moveTo(e.x - r * 0.1, e.y - r * 1.2); ctx.lineTo(e.x, e.y - r * 1.55); ctx.lineTo(e.x + r * 0.1, e.y - r * 1.2); ctx.fill();
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(e.x + r * 0.8, e.y + r * 0.8); ctx.lineTo(e.x + r * 0.8, e.y - r * 1.4); ctx.stroke();
      ctx.fillStyle = '#c8d0d8'; ctx.beginPath(); ctx.moveTo(e.x + r * 0.8, e.y - r * 1.4); ctx.quadraticCurveTo(e.x + r * 1.6, e.y - r * 1.1, e.x + r * 0.8, e.y - r * 0.6); ctx.fill();
    },
    annis: function (g, ctx, e) {
      var r = e.r, sway = Math.sin(g.time * 3) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.85, r, r * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.moveTo(e.x - r, e.y + r * 0.9); ctx.lineTo(e.x - r * 0.3 + sway, e.y - r * 0.6); ctx.lineTo(e.x + r * 0.5 + sway, e.y - r * 0.5); ctx.lineTo(e.x + r, e.y + r * 0.9); ctx.fill();
      ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.ellipse(e.x + sway, e.y - r * 0.7, r * 0.55, r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = e.def.skin; ctx.beginPath(); ctx.ellipse(e.x + sway + r * 0.1, e.y - r * 0.75, r * 0.32, r * 0.4, 0, 0, TAU); ctx.fill();
      eyes(ctx, e.x + sway + r * 0.1, e.y - r * 0.85, r * 0.12, '#ffea00');
      ctx.strokeStyle = '#8a8a9a'; ctx.lineWidth = 2;
      [-1, 1].forEach(function (sd) { for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(e.x + sd * r * 0.8, e.y + r * 0.1); ctx.lineTo(e.x + sd * r * (1.05 + k * 0.08), e.y + r * (0.35 + k * 0.12)); ctx.stroke(); } });
    },
    zombie: null
  };

  ZN.drawSpecial = function (g, ctx, e) {
    if (e.def.flyer && !e.def.boss) { bird(ctx, e, g, 1); flash(ctx, e); return; }
    var fn = SHAPES[e.def.shape] || SHAPES.kite;
    if (e.leapZ) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * (1 - e.leapZ / 300), e.r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(0, -e.leapZ);
    }
    fn(g, ctx, e);
    flash(ctx, e);
    if (e.leapZ) ctx.restore();
    if (e.shieldT > 0) {
      ctx.strokeStyle = 'rgba(125,255,138,' + (0.6 + Math.sin(g.time * 12) * 0.3) + ')'; ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(125,255,138,0.15)';
      hex(ctx, e.x, e.y - e.r * 0.2, e.r * 1.5); ctx.fill(); ctx.stroke();
    }
  };

  // ------------------------------------------------ mini boss accessories
  // Drawn over the brute sprite. Sprite: height r*2.9, feet at y + r*0.95, head near the top-left (faces right).
  ZN.drawAccessory = function (g, ctx, e) {
    var r = e.r, H = r * 2.9, feet = e.y + r * 0.95, flip = Math.cos(e.dir || 0) < 0 ? -1 : 1;
    var hx = e.x - flip * H * 0.09, hy = feet - H * 0.8, bx = e.x, by = feet - H * 0.45;
    ctx.save();
    switch (e.def.accessory) {
      case 'butcher':
        ctx.fillStyle = 'rgba(240,240,235,0.9)'; ctx.fillRect(bx - H * 0.18, by - H * 0.08, H * 0.36, H * 0.3);
        ctx.fillStyle = '#9a1a1a'; ctx.fillRect(bx - H * 0.1, by, H * 0.08, H * 0.06); ctx.fillRect(bx + H * 0.04, by + H * 0.1, H * 0.06, H * 0.05);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(bx + flip * H * 0.3, by - H * 0.05, flip * H * 0.05, H * 0.12);
        ctx.fillStyle = '#d0d4da'; ctx.fillRect(bx + flip * H * 0.28, by - H * 0.25, flip * H * 0.2, H * 0.2);
        break;
      case 'plague':
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(hx, hy - H * 0.12, H * 0.24, H * 0.06, 0, 0, TAU); ctx.fill();
        ctx.fillRect(hx - H * 0.12, hy - H * 0.3, H * 0.24, H * 0.18);
        ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.moveTo(hx + flip * H * 0.08, hy - H * 0.04); ctx.lineTo(hx + flip * H * 0.34, hy + H * 0.06); ctx.lineTo(hx + flip * H * 0.08, hy + H * 0.08); ctx.fill();
        ctx.fillStyle = '#7dff4a'; ctx.beginPath(); ctx.arc(hx + flip * H * 0.05, hy - H * 0.02, H * 0.03, 0, TAU); ctx.fill();
        break;
      case 'horseman':
        ctx.fillStyle = '#14101c'; ctx.beginPath(); ctx.arc(hx, hy, H * 0.17, 0, TAU); ctx.fill();
        for (var f = 0; f < 3; f++) { ctx.fillStyle = 'rgba(255,' + (90 + f * 50) + ',20,0.8)'; ctx.beginPath(); ctx.arc(hx + Math.sin(g.time * 9 + f) * 4, hy - H * 0.08 - f * H * 0.06, H * (0.08 - f * 0.02), 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#e07a10'; ctx.beginPath(); ctx.ellipse(bx - flip * H * 0.3, by + H * 0.05, H * 0.12, H * 0.1, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2a1a00'; ctx.fillRect(bx - flip * H * 0.34, by + H * 0.02, H * 0.03, H * 0.03); ctx.fillRect(bx - flip * H * 0.27, by + H * 0.02, H * 0.03, H * 0.03);
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(bx - flip * H * 0.33, by + H * 0.08, H * 0.08, H * 0.02);
        break;
      case 'witch':
        ctx.fillStyle = '#1a2a1a'; ctx.beginPath(); ctx.ellipse(hx, hy - H * 0.1, H * 0.26, H * 0.05, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx - H * 0.14, hy - H * 0.11); ctx.lineTo(hx - flip * H * 0.12, hy - H * 0.52); ctx.lineTo(hx + H * 0.14, hy - H * 0.11); ctx.fill();
        ctx.fillStyle = '#7dff4a'; ctx.fillRect(hx - H * 0.13, hy - H * 0.16, H * 0.26, H * 0.04);
        break;
      case 'vicar':
        ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - H * 0.08, hy + H * 0.13, H * 0.16, H * 0.04);
        ctx.fillStyle = '#d0b040'; ctx.fillRect(bx - H * 0.015, by - H * 0.02, H * 0.03, H * 0.14); ctx.fillRect(bx - H * 0.05, by + H * 0.02, H * 0.1, H * 0.03);
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(hx, hy - H * 0.1, H * 0.2, H * 0.05, 0, 0, TAU); ctx.fill();
        ctx.fillRect(hx - H * 0.11, hy - H * 0.2, H * 0.22, H * 0.1);
        break;
      case 'hooligan':
        for (var sI = 0; sI < 5; sI++) { ctx.fillStyle = sI % 2 ? '#ffffff' : '#c8102e'; ctx.fillRect(hx - H * 0.16 + sI * H * 0.065, hy + H * 0.12, H * 0.065, H * 0.06); }
        ctx.fillStyle = '#c8102e'; ctx.fillRect(hx - flip * H * 0.04, hy + H * 0.15, H * 0.06, H * 0.2);
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx, hy - H * 0.06, H * 0.14, Math.PI, 0); ctx.fill();
        break;
      case 'rugby':
        ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(hx, hy - H * 0.02, H * 0.15, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - H * 0.18, by - H * 0.05, H * 0.36, H * 0.04);
        ctx.fillStyle = '#8a4a1a'; ctx.beginPath(); ctx.ellipse(bx - flip * H * 0.26, by + H * 0.06, H * 0.12, H * 0.07, flip * 0.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - flip * H * 0.3, by + H * 0.06); ctx.lineTo(bx - flip * H * 0.22, by + H * 0.06); ctx.stroke();
        break;
    }
    ctx.restore();
  };

  ZN.drawEnrage = function (g, ctx, e) {
    var pulse = 0.35 + Math.sin(g.time * 10) * 0.15, R = e.r * 1.8;
    var gr = ctx.createRadialGradient(e.x, e.y, e.r * 0.4, e.x, e.y, R);
    gr.addColorStop(0, 'rgba(255,40,20,' + pulse + ')'); gr.addColorStop(1, 'rgba(255,40,20,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x, e.y - (e.leapZ || 0), R, 0, TAU); ctx.fill();
  };

  // --------------------------------------------------------- survivor hats
  ZN.drawHat = function (ctx, ch, x, y) {
    ctx.fillStyle = ch.hatColor;
    switch (ch.hat) {
      case 'bonnet':
        ctx.beginPath(); ctx.ellipse(x, y - 5, 10, 3.5, 0, 0, TAU); ctx.fill();
        ctx.fillRect(x - 6, y - 10, 12, 6);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(x - 6, y - 6, 12, 1.5); break;
      case 'beanie':
        ctx.beginPath(); ctx.arc(x, y - 3, 7.5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 11, 2.5, 0, TAU); ctx.fill(); break;
      case 'bald':
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - 2, y - 4, 2.5, 0, TAU); ctx.fill(); break;
      case 'souwester':
        ctx.beginPath(); ctx.ellipse(x, y - 3, 11, 3.5, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, 0); ctx.fill(); break;
      case 'tam':
        ctx.beginPath(); ctx.ellipse(x + 1, y - 6, 9, 4, -0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x + 1, y - 10, 2.5, 0, TAU); ctx.fill(); break;
      default: // flat cap
        ctx.beginPath(); ctx.ellipse(x + 1, y - 4, 8, 4, 0, Math.PI, TAU); ctx.fill();
        ctx.fillRect(x - 7, y - 4, 16, 2);
    }
  };
})(window.ZN);
