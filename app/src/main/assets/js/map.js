// Zombie Nation - UK campaign map geometry (Voronoi counties clipped to coastline)
'use strict';
(function (ZN) {
  var KX = 58, KY = 100; // projection scale (cos(54.5deg) ~ 0.58)

  function project(lat, lon) { return [(lon + 8.6) * KX + 20, (59.0 - lat) * KY + 20]; }
  ZN.project = project;

  // Clip polygon by half-plane a*x + b*y <= c (Sutherland-Hodgman)
  function clip(poly, a, b, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      var dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
      if (dp <= 0) out.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        var t = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  }

  function pointInPoly(pt, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  ZN.pointInPoly = pointInPoly;

  function polyArea(poly) {
    var a = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  function centroid(poly) {
    var a = polyArea(poly), cx = 0, cy = 0;
    if (Math.abs(a) < 1e-6) return poly[0];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length], f = p[0] * q[1] - q[0] * p[1];
      cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
    }
    return [cx / (6 * a), cy / (6 * a)];
  }

  ZN.buildMap = function () {
    if (ZN.MAP) return ZN.MAP;
    var outlines = {}, k;
    for (k in ZN.OUTLINES) outlines[k] = ZN.OUTLINES[k].map(function (p) { return project(p[0], p[1]); });
    var counties = ZN.COUNTIES, byId = {};
    counties.forEach(function (c) { c.site = project(c.lat, c.lon); byId[c.id] = c; });

    counties.forEach(function (c) {
      var poly = outlines[c.land].slice(), s = c.site;
      counties.forEach(function (o) {
        if (o === c || o.land !== c.land) return;
        var t = o.site;
        var a = t[0] - s[0], b = t[1] - s[1];
        var cc = (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2;
        poly = clip(poly, a, b, cc);
      });
      c.poly = poly;
      c.center = poly.length > 2 ? centroid(poly) : s;
      if (!pointInPoly(c.center, poly)) c.center = s;
    });

    // Adjacency: two cells are neighbours when they share a bisector edge of real length
    counties.forEach(function (c) { c.adj = []; });
    var blocked = {};
    ZN.BLOCKED.forEach(function (b) { blocked[b[0] + '|' + b[1]] = true; });
    for (var i = 0; i < counties.length; i++) {
      for (var j = i + 1; j < counties.length; j++) {
        var A = counties[i], B = counties[j];
        if (A.land !== B.land || blocked[A.id + '|' + B.id] || blocked[B.id + '|' + A.id]) continue;
        var s = A.site, t = B.site;
        var a = t[0] - s[0], b = t[1] - s[1];
        var len = Math.sqrt(a * a + b * b);
        var cc = (t[0] * t[0] + t[1] * t[1] - s[0] * s[0] - s[1] * s[1]) / 2;
        var pts = A.poly.filter(function (p) { return Math.abs((a * p[0] + b * p[1] - cc) / len) < 0.01; });
        if (pts.length >= 2) {
          var maxD = 0;
          for (var m = 0; m < pts.length; m++) for (var n = m + 1; n < pts.length; n++) {
            var dx = pts[m][0] - pts[n][0], dy = pts[m][1] - pts[n][1];
            maxD = Math.max(maxD, Math.sqrt(dx * dx + dy * dy));
          }
          if (maxD > 2) { A.adj.push(B.id); B.adj.push(A.id); }
        }
      }
    }
    ZN.FERRIES.forEach(function (f) {
      var a = byId[f[0]], b = byId[f[1]];
      if (a.adj.indexOf(b.id) < 0) { a.adj.push(b.id); b.adj.push(a.id); }
    });

    var maxX = 0, maxY = 0;
    for (k in outlines) outlines[k].forEach(function (p) { maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    ZN.MAP = { outlines: outlines, counties: counties, byId: byId, width: maxX + 20, height: maxY + 20 };
    return ZN.MAP;
  };
})(window.ZN);
