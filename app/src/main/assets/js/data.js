// Zombie Nation - static game data (geography, weapons, passives, enemies, shop)
'use strict';
var ZN = window.ZN = window.ZN || {};

ZN.MAX_WAVES = 20;          // waves cap so late-game missions stay a sensible length
ZN.WAVE_DURATION = 40;      // seconds per wave
ZN.FIRST_WAVE_DURATION = 60;
ZN.THREAT_MISSIONS = 3;   // missions you have to defend a counter-attacked county

// ---------------------------------------------------------------------------
// Geography. Outlines are [lat, lon] approximations of the coastline.
// ---------------------------------------------------------------------------
ZN.OUTLINES = {
  gb: [
    [50.07,-5.70],[49.96,-5.20],[50.35,-4.15],[50.22,-3.64],[50.60,-3.40],[50.72,-2.93],
    [50.52,-2.45],[50.68,-1.95],[50.78,-1.30],[50.73,-0.78],[50.82,-0.14],[50.73,0.25],
    [50.91,0.97],[51.13,1.33],[51.38,1.44],[51.48,0.60],[51.53,0.70],[51.60,0.95],
    [51.95,1.28],[52.08,1.57],[52.48,1.76],[52.93,1.30],[52.95,0.50],[52.80,0.25],
    [53.15,0.35],[53.58,0.12],[54.12,-0.08],[54.48,-0.60],[54.68,-1.18],[54.90,-1.36],
    [55.77,-2.00],[55.90,-2.13],[56.00,-2.50],[56.00,-3.20],[56.28,-2.58],[56.45,-2.85],
    [56.70,-2.45],[57.15,-2.07],[57.50,-1.78],[57.69,-2.00],[57.67,-2.50],[57.72,-3.28],
    [57.50,-4.20],[57.85,-3.78],[58.44,-3.08],[58.64,-3.02],[58.60,-3.52],[58.62,-5.00],
    [57.90,-5.30],[57.30,-5.80],[57.00,-5.85],[56.73,-6.20],[56.40,-5.50],[55.30,-5.80],
    [55.85,-4.85],[55.45,-4.65],[55.24,-4.86],[54.64,-4.86],[54.85,-4.40],[54.80,-4.05],
    [54.95,-3.30],[54.65,-3.57],[54.50,-3.62],[54.10,-3.20],[54.07,-2.86],[53.82,-3.05],
    [53.65,-3.00],[53.40,-3.10],[53.35,-3.32],[53.33,-3.83],[53.42,-4.40],[53.30,-4.68],
    [52.78,-4.75],[52.88,-4.40],[52.72,-4.06],[52.42,-4.09],[52.10,-4.70],[51.88,-5.30],
    [51.70,-5.15],[51.67,-4.70],[51.57,-4.30],[51.62,-3.90],[51.48,-3.70],[51.45,-3.17],
    [51.55,-2.90],[51.65,-2.60],[51.48,-2.75],[51.35,-2.98],[51.21,-3.47],[51.23,-3.85],
    [51.02,-4.53],[50.83,-4.55],[50.55,-4.94],[50.42,-5.08],[50.21,-5.48]
  ],
  ni: [
    [54.85,-5.80],[54.70,-5.75],[54.50,-5.45],[54.25,-5.55],[54.20,-5.88],[54.05,-6.25],
    [54.10,-6.65],[54.25,-6.95],[54.20,-7.30],[54.12,-7.60],[54.30,-8.15],[54.47,-8.10],
    [54.60,-7.75],[54.80,-7.55],[55.05,-7.30],[55.20,-6.95],[55.21,-6.50],[55.24,-6.15],
    [55.10,-5.98]
  ]
};

// id, name, short label, lat, lon, landmass, region (for ground palette)
ZN.COUNTIES = [
  // South West
  ['cornwall','Cornwall','Cornwall',50.42,-4.90,'gb','sw'],
  ['devon','Devon','Devon',50.75,-3.80,'gb','sw'],
  ['somerset','Somerset & Bristol','Somerset',51.10,-3.00,'gb','sw'],
  ['dorset','Dorset','Dorset',50.82,-2.30,'gb','sw'],
  ['wiltshire','Wiltshire','Wilts',51.30,-1.95,'gb','sw'],
  ['gloucs','Gloucestershire','Gloucs',51.85,-2.20,'gb','sw'],
  // South East
  ['hampshire','Hampshire','Hants',51.05,-1.25,'gb','se'],
  ['wsussex','West Sussex','W Sussex',50.95,-0.45,'gb','se'],
  ['esussex','East Sussex','E Sussex',50.93,0.25,'gb','se'],
  ['kent','Kent','Kent',51.20,0.80,'gb','se'],
  ['surrey','Surrey','Surrey',51.25,-0.40,'gb','se'],
  ['london','Greater London','London',51.50,-0.10,'gb','city'],
  ['berkshire','Berkshire','Berks',51.45,-1.15,'gb','se'],
  ['oxon','Oxfordshire','Oxon',51.80,-1.30,'gb','se'],
  ['bucks','Buckinghamshire','Bucks',51.80,-0.80,'gb','se'],
  ['herts','Hertfordshire','Herts',51.82,-0.25,'gb','se'],
  // East
  ['essex','Essex','Essex',51.80,0.60,'gb','east'],
  ['beds','Bedfordshire','Beds',52.08,-0.45,'gb','east'],
  ['cambs','Cambridgeshire','Cambs',52.38,0.00,'gb','east'],
  ['suffolk','Suffolk','Suffolk',52.20,1.00,'gb','east'],
  ['norfolk','Norfolk','Norfolk',52.65,1.00,'gb','east'],
  // Midlands
  ['northants','Northamptonshire','N\'hants',52.30,-0.85,'gb','mid'],
  ['warks','Warwickshire','Warks',52.30,-1.55,'gb','mid'],
  ['westmids','West Midlands','W Mids',52.50,-1.90,'gb','city'],
  ['worcs','Worcestershire','Worcs',52.20,-2.20,'gb','mid'],
  ['hereford','Herefordshire','Hereford',52.08,-2.75,'gb','mid'],
  ['shropshire','Shropshire','Shrops',52.65,-2.75,'gb','mid'],
  ['staffs','Staffordshire','Staffs',52.85,-2.00,'gb','mid'],
  ['leics','Leicestershire & Rutland','Leics',52.68,-1.05,'gb','mid'],
  ['lincs','Lincolnshire','Lincs',53.12,-0.25,'gb','east'],
  ['notts','Nottinghamshire','Notts',53.15,-1.00,'gb','mid'],
  ['derbys','Derbyshire','Derbys',53.10,-1.60,'gb','mid'],
  // North
  ['cheshire','Cheshire','Cheshire',53.18,-2.55,'gb','north'],
  ['merseyside','Merseyside','Mersey',53.45,-2.90,'gb','city'],
  ['manchester','Greater Manchester','Manc',53.52,-2.30,'gb','city'],
  ['lancs','Lancashire','Lancs',53.88,-2.60,'gb','north'],
  ['wyorks','West Yorkshire','W Yorks',53.75,-1.75,'gb','north'],
  ['syorks','South Yorkshire','S Yorks',53.48,-1.30,'gb','north'],
  ['eyorks','East Riding of Yorkshire','E Riding',53.88,-0.60,'gb','north'],
  ['nyorks','North Yorkshire','N Yorks',54.20,-1.40,'gb','north'],
  ['cumbria','Cumbria','Cumbria',54.55,-3.00,'gb','north'],
  ['durham','County Durham','Durham',54.68,-1.80,'gb','north'],
  ['tyne','Tyne and Wear','Tyne',54.93,-1.60,'gb','city'],
  ['northumb','Northumberland','N\'land',55.25,-2.05,'gb','north'],
  // Wales
  ['gwynedd','Gwynedd & Anglesey','Gwynedd',52.95,-3.95,'gb','wales'],
  ['clwyd','Clwyd','Clwyd',53.05,-3.20,'gb','wales'],
  ['powys','Powys','Powys',52.35,-3.40,'gb','wales'],
  ['dyfed','Dyfed','Dyfed',51.95,-4.30,'gb','wales'],
  ['glamorgan','Glamorgan','Glamorgan',51.62,-3.45,'gb','wales'],
  ['gwent','Gwent','Gwent',51.72,-2.98,'gb','wales'],
  // Scotland
  ['dumfries','Dumfries & Galloway','Dumfries',55.08,-3.90,'gb','scot'],
  ['borders','Scottish Borders','Borders',55.55,-2.80,'gb','scot'],
  ['ayrshire','Ayrshire','Ayrshire',55.40,-4.45,'gb','scot'],
  ['lanark','Glasgow & Lanarkshire','Glasgow',55.75,-3.95,'gb','city'],
  ['lothian','Edinburgh & Lothian','Edinburgh',55.88,-3.20,'gb','scot'],
  ['fife','Fife','Fife',56.22,-3.10,'gb','scot'],
  ['argyll','Argyll & Bute','Argyll',56.25,-5.20,'gb','scot'],
  ['perth','Stirling & Perthshire','Perth',56.55,-3.90,'gb','scot'],
  ['angus','Angus & Dundee','Angus',56.72,-2.90,'gb','scot'],
  ['aberdeen','Aberdeenshire','Aberdeen',57.25,-2.55,'gb','scot'],
  ['moray','Moray','Moray',57.45,-3.30,'gb','scot'],
  ['lochaber','Lochaber & Skye','Lochaber',57.05,-5.05,'gb','high'],
  ['highland','Inverness & Ross','Highland',57.65,-4.70,'gb','high'],
  ['caithness','Sutherland & Caithness','Caithness',58.30,-4.30,'gb','high'],
  // Northern Ireland
  ['antrim','Antrim & Belfast','Antrim',54.82,-6.20,'ni','ni'],
  ['down','County Down','Down',54.35,-5.95,'ni','ni'],
  ['armagh','Armagh & Tyrone','Tyrone',54.52,-6.85,'ni','ni'],
  ['fermanagh','Fermanagh','Fermanagh',54.36,-7.60,'ni','ni'],
  ['derry','Londonderry','Derry',54.92,-6.95,'ni','ni']
].map(function (c) {
  return { id: c[0], name: c[1], short: c[2], lat: c[3], lon: c[4], land: c[5], region: c[6] };
});

// Extra links across the sea (ferry routes) so Northern Ireland is reachable.
ZN.FERRIES = [['antrim', 'ayrshire'], ['down', 'dumfries']];
// Links the Voronoi cells produce that cross water or make no geographic sense.
ZN.BLOCKED = [['devon', 'glamorgan'], ['somerset', 'glamorgan'], ['wiltshire', 'gwent'], ['esussex', 'london'], ['lancs', 'durham']];

// Ground palettes for the battlefield by region
ZN.REGION_STYLE = {
  sw:    { ground: '#3d5a2e', alt: '#46663a', decor: ['tree', 'hay', 'stone', 'grave'] },
  se:    { ground: '#45613a', alt: '#4d6b41', decor: ['tree', 'car', 'bush', 'grave'] },
  east:  { ground: '#566236', alt: '#5f6c3c', decor: ['hay', 'bush', 'tractor', 'grave'] },
  mid:   { ground: '#4a5a35', alt: '#52643b', decor: ['tree', 'car', 'barrel', 'grave'] },
  north: { ground: '#4b5940', alt: '#536247', decor: ['stone', 'wall', 'tree', 'grave'] },
  wales: { ground: '#3f6034', alt: '#476a3b', decor: ['stone', 'sheep', 'wall', 'grave'] },
  scot:  { ground: '#4e5a3e', alt: '#596648', decor: ['heather', 'stone', 'wall', 'grave'] },
  high:  { ground: '#55583f', alt: '#5e6247', decor: ['heather', 'stone', 'heather', 'grave'] },
  city:  { ground: '#4a4b4e', alt: '#525357', decor: ['car', 'barrel', 'bin', 'cone'] },
  ni:    { ground: '#3b6233', alt: '#436c3a', decor: ['stone', 'wall', 'tree', 'grave'] }
};

// ---------------------------------------------------------------------------
// Weapons. Each has max level, per-level description, and stats(level).
// The actual behaviour lives in game.js (ZN.WEAPON_LOGIC).
// ---------------------------------------------------------------------------
ZN.WEAPONS = {
  pistol: {
    name: 'Service Pistol', icon: '🔫', color: '#9aa4b1', kind: 'Ranged', max: 6,
    levels: ['Fires at the nearest zombie.', '+1 bullet', '+5 damage', '-15% cooldown', '+1 bullet', '+1 pierce, +5 damage'],
    stats: function (l) {
      return { dmg: 13 + (l >= 3 ? 5 : 0) + (l >= 6 ? 6 : 0), cd: l >= 4 ? 0.65 : 0.8,
        amount: 1 + (l >= 2 ? 1 : 0) + (l >= 5 ? 1 : 0), pierce: l >= 6 ? 2 : 1 };
    }
  },
  iceSword: {
    name: 'Ice Sword', icon: '🗡️', color: '#7fd4ff', kind: 'Melee · Frost', max: 6,
    levels: ['Slashes ahead of you, chilling zombies.', '+6 damage', '+20% area', 'Also slashes behind you', '+8 damage, -15% cooldown', 'Freezes zombies solid, +10 damage'],
    stats: function (l) {
      return { dmg: 16 + (l >= 2 ? 6 : 0) + (l >= 5 ? 8 : 0) + (l >= 6 ? 10 : 0), cd: l >= 5 ? 1.2 : 1.4,
        radius: 78 * (l >= 3 ? 1.2 : 1), dirs: l >= 4 ? 2 : 1, freeze: l >= 6 };
    }
  },
  fireSword: {
    name: 'Fire Sword', icon: '🗡️', color: '#ff7a3d', kind: 'Melee · Fire', max: 6,
    levels: ['Spinning slashes that set zombies ablaze.', '+5 damage', '+1 slash', '+20% area', 'Burn damage doubled', '+10 damage, -20% cooldown'],
    stats: function (l) {
      return { dmg: 14 + (l >= 2 ? 5 : 0) + (l >= 6 ? 10 : 0), cd: l >= 6 ? 1.2 : 1.5,
        radius: 72 * (l >= 4 ? 1.2 : 1), dirs: l >= 3 ? 2 : 1, burn: l >= 5 ? 8 : 4 };
    }
  },
  elecSword: {
    name: 'Electric Sword', icon: '🗡️', color: '#f7e64a', kind: 'Melee · Shock', max: 6,
    levels: ['Slashes ahead; lightning arcs to nearby zombies.', '+2 chain targets', '+5 damage', 'Also slashes behind you', '-20% cooldown', '+3 chains, +8 damage'],
    stats: function (l) {
      return { dmg: 12 + (l >= 3 ? 5 : 0) + (l >= 6 ? 8 : 0), cd: l >= 5 ? 0.96 : 1.2,
        radius: 68, dirs: l >= 4 ? 2 : 1, chains: 2 + (l >= 2 ? 2 : 0) + (l >= 6 ? 3 : 0) };
    }
  },
  crossbow: {
    name: 'Crossbow', icon: '🏹', color: '#c89b5c', kind: 'Ranged · Pierce', max: 6,
    levels: ['Fires piercing bolts the way you face.', '+1 bolt', '+10 damage', '+2 pierce', '+1 bolt', '+10 damage, -25% cooldown'],
    stats: function (l) {
      return { dmg: 20 + (l >= 3 ? 10 : 0) + (l >= 6 ? 10 : 0), cd: l >= 6 ? 0.9 : 1.2,
        amount: 1 + (l >= 2 ? 1 : 0) + (l >= 5 ? 1 : 0), pierce: 3 + (l >= 4 ? 2 : 0) };
    }
  },
  molotov: {
    name: 'Molotov', icon: '🍾', color: '#ff9b30', kind: 'Fire · Area', max: 6,
    levels: ['Lobs bottles that leave burning pools.', '+1 bottle', '+20% area', '+4 damage', '+1 bottle, longer burn', '+1 bottle, +5 damage'],
    stats: function (l) {
      return { dmg: 7 + (l >= 4 ? 4 : 0) + (l >= 6 ? 5 : 0), cd: 2.6,
        amount: 1 + (l >= 2 ? 1 : 0) + (l >= 5 ? 1 : 0) + (l >= 6 ? 1 : 0),
        radius: 46 * (l >= 3 ? 1.2 : 1), life: 2.5 + (l >= 5 ? 0.8 : 0) };
    }
  },
  cheese: {
    name: 'Stinking Bishop', icon: '🧀', color: '#e8d26a', kind: 'Aura', max: 6,
    levels: ['A pungent cheese aura hurts nearby zombies.', '+15% area, +2 damage', 'Ticks faster', '+15% area, +2 damage', '+3 damage', '+20% area, knocks zombies back'],
    stats: function (l) {
      var r = 58; if (l >= 2) r *= 1.15; if (l >= 4) r *= 1.15; if (l >= 6) r *= 1.2;
      return { dmg: 5 + (l >= 2 ? 2 : 0) + (l >= 4 ? 2 : 0) + (l >= 5 ? 3 : 0), tick: l >= 3 ? 0.33 : 0.42, radius: r, kb: l >= 6 };
    }
  },
  hubcaps: {
    name: 'Hubcaps', icon: '🛞', color: '#cfd6de', kind: 'Orbit', max: 6,
    levels: ['Hubcaps orbit around you.', '+1 hubcap', '+25% speed, +5 damage', '+1 hubcap', '+20% area, lasts longer', '+1 hubcap, +5 damage'],
    stats: function (l) {
      return { dmg: 10 + (l >= 3 ? 5 : 0) + (l >= 6 ? 5 : 0), amount: 2 + (l >= 2 ? 1 : 0) + (l >= 4 ? 1 : 0) + (l >= 6 ? 1 : 0),
        radius: 72 * (l >= 5 ? 1.2 : 1), spin: 3 * (l >= 3 ? 1.25 : 1), on: 3 + (l >= 5 ? 1 : 0), cycle: 5.5 };
    }
  },
  lightning: {
    name: 'Lightning Rod', icon: '⚡', color: '#a8c8ff', kind: 'Shock · Area', max: 6,
    levels: ['Calls lightning down on random zombies.', '+1 strike', '+10 damage', '+1 strike, +30% area', '-20% cooldown', '+2 strikes, +10 damage'],
    stats: function (l) {
      return { dmg: 28 + (l >= 3 ? 10 : 0) + (l >= 6 ? 10 : 0), cd: l >= 5 ? 1.9 : 2.4,
        amount: 2 + (l >= 2 ? 1 : 0) + (l >= 4 ? 1 : 0) + (l >= 6 ? 2 : 0), radius: 36 * (l >= 4 ? 1.3 : 1) };
    }
  },
  flamethrower: {
    name: 'Flamethrower', icon: '🔥', color: '#ff5a1f', kind: 'Fire · Cone', max: 6,
    levels: ['Sprays fire at the closest zombies.', '+2 damage', '+25% range', '+2 damage, stronger burn', 'Wider cone', '+4 damage'],
    stats: function (l) {
      return { dmg: 4 + (l >= 2 ? 2 : 0) + (l >= 4 ? 2 : 0) + (l >= 6 ? 4 : 0), cd: 0.1,
        range: 1 * (l >= 3 ? 1.25 : 1), spread: l >= 5 ? 0.55 : 0.32, burn: l >= 4 ? 5 : 2 };
    }
  },
  cricketBat: {
    name: 'Cricket Bat', icon: '🏏', color: '#d9b77a', kind: 'Melee · Knockback', max: 6,
    levels: ['A mighty swing that sends zombies flying.', '+6 damage', '+20% area', '-15% cooldown', 'Swings both ways', '+10 damage, huge knockback'],
    stats: function (l) {
      return { dmg: 18 + (l >= 2 ? 6 : 0) + (l >= 6 ? 10 : 0), cd: l >= 4 ? 1.1 : 1.3,
        radius: 64 * (l >= 3 ? 1.2 : 1), dirs: l >= 5 ? 2 : 1, kb: l >= 6 ? 260 : 170 };
    }
  },
  bagpipes: {
    name: 'Bagpipes', icon: '🎶', color: '#c7a0ff', kind: 'Sonic · Stun', max: 6,
    levels: ['A wailing cone of sound that stuns zombies.', 'Wider cone', '+5 damage', '+25% range', 'Longer stun', '+5 damage, -20% cooldown'],
    stats: function (l) {
      return { dmg: 13 + (l >= 3 ? 6 : 0) + (l >= 6 ? 6 : 0), cd: l >= 6 ? 1.4 : 1.75, arc: l >= 2 ? 1.3 : 0.95,
        radius: 140 * (l >= 4 ? 1.25 : 1), stun: l >= 5 ? 1.3 : 0.8 };
    }
  },
  halberd: {
    name: 'Beefeater Halberd', icon: '🔱', color: '#e0c060', kind: 'Melee · Reach', max: 6,
    levels: ['A long, narrow thrust that skewers lines of zombies.', '+8 damage', '+20% reach', 'Also thrusts behind you', '-20% cooldown', '+15 damage, sweeping arc'],
    stats: function (l) {
      return { dmg: 26 + (l >= 2 ? 8 : 0) + (l >= 6 ? 15 : 0), cd: l >= 5 ? 1.25 : 1.6,
        radius: 125 * (l >= 3 ? 1.2 : 1), dirs: l >= 4 ? 2 : 1, arc: l >= 6 ? 1.4 : 0.7 };
    }
  },
  harpoon: {
    name: 'Harpoon Gun', icon: '🪝', color: '#7fb8c8', kind: 'Ranged · Pierce', max: 6,
    levels: ['Fires heavy harpoons through rows of zombies.', '+1 harpoon', '+8 damage', '+3 pierce', '-20% cooldown', '+1 harpoon, +10 damage'],
    stats: function (l) {
      return { dmg: 22 + (l >= 3 ? 8 : 0) + (l >= 6 ? 10 : 0), cd: l >= 5 ? 1.2 : 1.5,
        amount: 1 + (l >= 2 ? 1 : 0) + (l >= 6 ? 1 : 0), pierce: 4 + (l >= 4 ? 3 : 0) };
    }
  },
  // ---- Evolutions ----
  minigun: {
    name: 'Minigun', icon: '🔫', color: '#ffd166', kind: 'Evolved · Ranged', max: 1, evolved: true,
    levels: ['A storm of lead at everything near you.'],
    stats: function () { return { dmg: 13, cd: 0.09, pierce: 2, amount: 1 }; }
  },
  swordOfLight: {
    name: 'Sword of Light', icon: '✨', color: '#fffbe0', kind: 'Legendary', max: 1, evolved: true,
    levels: ['Frost, flame and lightning fused. Orbiting blades of light and radiant bursts.'],
    stats: function () { return { dmg: 30, burstDmg: 70, cd: 2.4, radius: 92, blades: 3, beams: 10, beamLen: 280 }; }
  },
  ballista: {
    name: 'Ballista', icon: '🏹', color: '#ffb347', kind: 'Evolved · Pierce', max: 1, evolved: true,
    levels: ['Huge bolts that pierce everything, fired in a fan.'],
    stats: function () { return { dmg: 55, cd: 0.85, amount: 5, pierce: 9999 }; }
  },
  napalm: {
    name: 'Napalm Strike', icon: '☄️', color: '#ff3d00', kind: 'Evolved · Fire', max: 1, evolved: true,
    levels: ['Carpet-bombs the area in roaring flames.'],
    stats: function () { return { dmg: 15, cd: 2.0, amount: 5, radius: 72, life: 4 }; }
  },
  stilton: {
    name: 'Stilton Storm', icon: '🧀', color: '#b6e36a', kind: 'Evolved · Aura', max: 1, evolved: true,
    levels: ['A colossal cheese cloud that heals you as it hurts them.'],
    stats: function () { return { dmg: 15, tick: 0.3, radius: 120, kb: true, heal: 0.6 }; }
  },
  buzzsaw: {
    name: 'Buzzsaw Halo', icon: '⚙️', color: '#e0e6ee', kind: 'Evolved · Orbit', max: 1, evolved: true,
    levels: ['Six buzzsaws spin around you, forever.'],
    stats: function () { return { dmg: 24, amount: 6, radius: 96, spin: 4.2, on: 999, cycle: 999 }; }
  },
  thunderstorm: {
    name: 'Thunderstorm', icon: '🌩️', color: '#d0e0ff', kind: 'Evolved · Shock', max: 1, evolved: true,
    levels: ['Endless lightning that chains between zombies.'],
    stats: function () { return { dmg: 45, cd: 0.8, amount: 4, radius: 60, chains: 2 }; }
  },
  dragonsBreath: {
    name: "Dragon's Breath", icon: '🐉', color: '#ff2a00', kind: 'Evolved · Fire', max: 1, evolved: true,
    levels: ['The red dragon of Wales roars from your hands.'],
    stats: function () { return { dmg: 10, cd: 0.07, range: 2.1, spread: 0.6, burn: 8 }; }
  },
  teslaBolts: {
    name: 'Tesla Bolts', icon: '🌀', color: '#9ff3ff', kind: 'Evolved · Shock', max: 1, evolved: true,
    levels: ['Crackling bolts that chain lightning through every zombie they pierce.'],
    stats: function () { return { dmg: 34, cd: 0.7, amount: 3, pierce: 6, chains: 3 }; }
  },
  steamBombs: {
    name: 'Steam Bombs', icon: '♨️', color: '#e6f4ff', kind: 'Evolved · Frost & Fire', max: 1, evolved: true,
    levels: ['Scalding steam clouds that burn and freeze at the same time.'],
    stats: function () { return { dmg: 14, cd: 2.2, amount: 4, radius: 82, life: 4 }; }
  },
  sixHitter: {
    name: 'Six-Hitter', icon: '🏏', color: '#ffd27a', kind: 'Evolved · Boomerang', max: 1, evolved: true,
    levels: ['Hurls spinning cricket bats that smash out and back again.'],
    stats: function () { return { dmg: 32, cd: 1.5, amount: 3 }; }
  },
  highlandLament: {
    name: 'Highland Lament', icon: '🎶', color: '#d8b8ff', kind: 'Evolved · Sonic', max: 1, evolved: true,
    levels: ['A haunting lament in every direction that stuns the whole horde.'],
    stats: function () { return { dmg: 26, cd: 2.4, radius: 210, stun: 1.4 }; }
  },
  yeomansWrath: {
    name: "Yeoman's Wrath", icon: '👑', color: '#ffcc33', kind: 'Evolved · Reach', max: 1, evolved: true,
    levels: ['Royal sweeps of the halberd in every direction.'],
    stats: function () { return { dmg: 60, cd: 1.2, radius: 150 }; }
  },
  krakensReach: {
    name: "Kraken's Reach", icon: '🐙', color: '#4fd1c5', kind: 'Evolved · Pierce', max: 1, evolved: true,
    levels: ['A ring of harpoons erupts outward, slowing all they pass through.'],
    stats: function () { return { dmg: 40, cd: 1.3, amount: 8, pierce: 9999 }; }
  }
};

// Evolutions: weapon(s) at max level + optional passive -> new weapon
ZN.EVOLUTIONS = [
  { from: ['iceSword', 'fireSword', 'elecSword'], passive: null, into: 'swordOfLight' },
  { from: ['pistol'], passive: 'ammoBelt', into: 'minigun' },
  { from: ['crossbow'], passive: 'fullEnglish', into: 'ballista' },
  { from: ['molotov'], passive: 'fuelCan', into: 'napalm' },
  { from: ['cheese'], passive: 'tea', into: 'stilton' },
  { from: ['hubcaps'], passive: 'brolly', into: 'buzzsaw' },
  { from: ['lightning'], passive: 'pocketWatch', into: 'thunderstorm' },
  { from: ['flamethrower'], passive: 'unionCape', into: 'dragonsBreath' },
  { from: ['crossbow', 'elecSword'], passive: null, into: 'teslaBolts' },
  { from: ['molotov', 'iceSword'], passive: null, into: 'steamBombs' },
  { from: ['cricketBat'], passive: 'wellies', into: 'sixHitter' },
  { from: ['bagpipes'], passive: 'horseshoe', into: 'highlandLament' },
  { from: ['halberd'], passive: 'brolly', into: 'yeomansWrath' },
  { from: ['harpoon'], passive: 'magnet', into: 'krakensReach' }
];

// ---------------------------------------------------------------------------
// Passive items (max level 5)
// ---------------------------------------------------------------------------
ZN.PASSIVES = {
  tea:         { name: 'Cup of Tea',       icon: '☕', desc: '+20 max HP, +0.2 HP/s regen per level', apply: function (s, l) { s.maxHp += 20 * l; s.regen += 0.2 * l; } },
  wellies:     { name: 'Wellies',          icon: '🥾', desc: '+10% move speed per level', apply: function (s, l) { s.speed *= 1 + 0.1 * l; } },
  fullEnglish: { name: 'Full English',     icon: '🍳', desc: '+10% damage per level', apply: function (s, l) { s.might += 0.1 * l; } },
  magnet:      { name: 'Fridge Magnet',    icon: '🧲', desc: '+30% pickup range per level', apply: function (s, l) { s.magnet *= 1 + 0.3 * l; } },
  ammoBelt:    { name: 'Ammo Belt',        icon: '🎗️', desc: '+1 projectile at levels 1, 3 and 5', apply: function (s, l) { s.amount += Math.floor((l + 1) / 2); } },
  pocketWatch: { name: 'Pocket Watch',     icon: '⏱️', desc: '-8% weapon cooldown per level', apply: function (s, l) { s.cooldown *= 1 - 0.08 * l; } },
  brolly:      { name: 'Brolly',           icon: '☂️', desc: '+1 armour per level', apply: function (s, l) { s.armor += l; } },
  fuelCan:     { name: 'Fuel Can',         icon: '⛽', desc: '+12% effect duration per level', apply: function (s, l) { s.duration *= 1 + 0.12 * l; } },
  unionCape:   { name: 'Union Flag Cape',  icon: '🦸', desc: '+10% area per level', apply: function (s, l) { s.area *= 1 + 0.1 * l; } },
  horseshoe:   { name: 'Lucky Horseshoe',  icon: '🧿', desc: '+10% luck and +4% crit chance per level', apply: function (s, l) { s.luck += 0.1 * l; s.crit += 0.04 * l; } }
};
ZN.PASSIVE_MAX = 5;
ZN.MAX_WEAPON_SLOTS = 6;
ZN.MAX_PASSIVE_SLOTS = 6;

// Account level at which each item becomes available in the level-up pool
ZN.UNLOCKS = {
  1: ['pistol', 'iceSword', 'cheese', 'molotov', 'tea', 'wellies', 'fullEnglish', 'magnet', 'ammoBelt'],
  2: ['fireSword', 'cricketBat'],
  3: ['crossbow', 'pocketWatch'],
  4: ['hubcaps', 'brolly'],
  5: ['elecSword'],
  6: ['lightning', 'fuelCan', 'bagpipes'],
  7: ['flamethrower', 'unionCape'],
  8: ['horseshoe', 'halberd'],
  9: ['harpoon']
};

// Account XP needed to go from level L to L+1
ZN.accountXpFor = function (level) { return Math.round(160 * Math.pow(level, 1.45)); };

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
ZN.ENEMIES = {
  shambler: { name: 'Shambler', hp: 12, speed: 40, dmg: 8, r: 12, xp: 1, color: '#6f9b5a', skin: '#8fbf72' },
  runner:   { name: 'Runner',   hp: 8,  speed: 78, dmg: 6, r: 10, xp: 1, color: '#9b8a4a', skin: '#c7b46a' },
  crawler:  { name: 'Crawler',  hp: 6,  speed: 95, dmg: 5, r: 8,  xp: 1, color: '#5a6e4a', skin: '#7f966a' },
  brute:    { name: 'Brute',    hp: 70, speed: 30, dmg: 18, r: 20, xp: 5, color: '#5b7a7a', skin: '#7fa3a0' },
  spitter:  { name: 'Spitter',  hp: 20, speed: 36, dmg: 6, r: 12, xp: 3, color: '#7a5a8a', skin: '#a37fb5', ranged: true },
  bloater:  { name: 'Bloater',  hp: 32, speed: 32, dmg: 8, r: 16, xp: 3, color: '#8a7a3a', skin: '#c2b35a', explodes: true },
  kite:     { name: 'Red Kite', hp: 7, speed: 120, dmg: 6, r: 9, xp: 1, color: '#8a3a2a', skin: '#c46a3a', flyer: true },
  elite:    { name: 'Elite',    hp: 70, speed: 42, dmg: 20, r: 22, xp: 20, color: '#7a2f8a', skin: '#b55ac7', elite: true },
  boss:     { name: 'The Abomination', hp: 320, speed: 46, dmg: 30, r: 38, xp: 60, color: '#8a2a2a', skin: '#c45a4a', boss: true }
};

// ---------------------------------------------------------------------------
// Permanent upgrades bought with coins
// ---------------------------------------------------------------------------
ZN.SHOP = [
  { id: 'might',    name: 'Might',      icon: '💪', desc: '+5% damage',          max: 5, cost: 60 },
  { id: 'maxHp',    name: 'Vitality',   icon: '❤️', desc: '+10% max HP',          max: 5, cost: 50 },
  { id: 'armor',    name: 'Armour',     icon: '🛡️', desc: '+1 armour',            max: 3, cost: 80 },
  { id: 'regen',    name: 'Recovery',   icon: '💚', desc: '+0.1 HP/s regen',      max: 5, cost: 50 },
  { id: 'speed',    name: 'Swiftness',  icon: '👟', desc: '+5% move speed',       max: 3, cost: 50 },
  { id: 'cooldown', name: 'Haste',      icon: '⌛', desc: '-3% cooldown',         max: 3, cost: 120 },
  { id: 'area',     name: 'Reach',      icon: '⭕', desc: '+5% area',             max: 3, cost: 100 },
  { id: 'duration', name: 'Endurance',  icon: '⏳', desc: '+10% duration',        max: 2, cost: 80 },
  { id: 'amount',   name: 'Duplicator', icon: '➕', desc: '+1 projectile',        max: 1, cost: 600 },
  { id: 'magnet',   name: 'Attraction', icon: '🧲', desc: '+25% pickup range',    max: 2, cost: 40 },
  { id: 'luck',     name: 'Fortune',    icon: '🍀', desc: '+10% luck',            max: 3, cost: 70 },
  { id: 'growth',   name: 'Growth',     icon: '📈', desc: '+5% XP gain',          max: 5, cost: 90 },
  { id: 'greed',    name: 'Greed',      icon: '💰', desc: '+10% coins',           max: 5, cost: 60 },
  { id: 'revival',  name: 'Second Wind',icon: '🪽', desc: 'Revive once per mission at 50% HP', max: 1, cost: 800 }
];
ZN.shopCost = function (item, rank) { return Math.round(item.cost * (1 + rank * 0.75)); };

// ---------------------------------------------------------------------------
// Playable survivors (bought with coins)
// ---------------------------------------------------------------------------
ZN.CHARACTERS = [
  { id: 'tommy', name: 'Tommy', title: 'The Survivor', icon: '🧢', cost: 0, start: 'pistol',
    perks: 'Balanced all-rounder.', coat: '#26466e', hat: 'flat', hatColor: '#5a4a3a',
    apply: function () {} },
  { id: 'beefeater', name: 'Bert', title: 'Beefeater', icon: '💂', cost: 300, start: 'halberd',
    perks: '+2 armour, +20 max HP, -10% speed.', coat: '#b3101e', hat: 'bonnet', hatColor: '#1a1a2a',
    apply: function (s) { s.armor += 2; s.maxHp += 20; s.speed *= 0.9; } },
  { id: 'shepherd', name: 'Rhiannon', title: 'Welsh Shepherd', icon: '🐑', cost: 400, start: 'molotov',
    perks: '+15% speed, +40% pickup range.', coat: '#2f6b3a', hat: 'beanie', hatColor: '#c8102e',
    apply: function (s) { s.speed *= 1.15; s.magnet *= 1.4; } },
  { id: 'bouncer', name: 'Big Rab', title: 'Glaswegian Bouncer', icon: '🥃', cost: 500, start: 'cheese',
    perks: '+30% max HP, +15% area, +0.3 HP/s regen.', coat: '#1c1c1c', hat: 'bald', hatColor: '#f1c9a0',
    apply: function (s) { s.maxHp *= 1.3; s.area *= 1.15; s.regen += 0.3; } },
  { id: 'fisherman', name: 'Jory', title: 'Cornish Fisherman', icon: '🎣', cost: 500, start: 'harpoon',
    perks: '+25% luck, +25% coins, +5% crit.', coat: '#e0b020', hat: 'souwester', hatColor: '#e0b020',
    apply: function (s) { s.luck += 0.25; s.greed += 0.25; s.crit += 0.05; } },
  { id: 'piper', name: 'Morag', title: 'Highland Piper', icon: '🎶', cost: 650, start: 'bagpipes',
    perks: '-10% cooldown, +20% effect duration.', coat: '#2b4a8a', hat: 'tam', hatColor: '#1f6b3a',
    apply: function (s) { s.cooldown *= 0.9; s.duration *= 1.2; } }
];
ZN.characterById = function (id) {
  for (var i = 0; i < ZN.CHARACTERS.length; i++) if (ZN.CHARACTERS[i].id === id) return ZN.CHARACTERS[i];
  return ZN.CHARACTERS[0];
};

// ---------------------------------------------------------------------------
// Regional horde bosses. abilities: charge, summon, volley, dive, slam
// ---------------------------------------------------------------------------
ZN.BOSSES = {
  abomination: { name: 'The Abomination', hpMul: 1, speed: 46, r: 38, color: '#8a2a2a', skin: '#c45a4a', shape: 'zombie', abilities: ['charge', 'summon'], minion: 'shambler' },
  colossus:    { name: 'The Beefeater Colossus', hpMul: 1.2, speed: 40, r: 44, color: '#9a1020', skin: '#c9a080', shape: 'beefeater', abilities: ['charge', 'volley', 'summon'], minion: 'runner', shot: '#ffd23a' },
  druid:       { name: 'The Stonehenge Druid', hpMul: 0.9, speed: 38, r: 34, color: '#5a5a6a', skin: '#a8b0a0', shape: 'druid', abilities: ['volley', 'summon', 'slam'], minion: 'shambler', shot: '#b0b8a8' },
  kite:        { name: 'The Red Kite Matriarch', hpMul: 0.85, speed: 70, r: 34, color: '#7a2a1a', skin: '#c46a3a', shape: 'kite', abilities: ['charge', 'summon'], minion: 'kite', flyer: true },
  nessie:      { name: 'Nessie', hpMul: 1.15, speed: 50, r: 40, color: '#2f5a4a', skin: '#4f8a6a', shape: 'nessie', abilities: ['dive', 'volley', 'dive'], minion: 'crawler', shot: '#6fd0c0' },
  golem:       { name: "The Causeway Golem", hpMul: 1.4, speed: 30, r: 46, color: '#3a3a40', skin: '#5a5a66', shape: 'golem', abilities: ['slam', 'slam', 'summon'], minion: 'shambler' },
  bogbeast:    { name: 'The Fen Bog Beast', hpMul: 1.0, speed: 36, r: 40, color: '#4a5a2a', skin: '#7a8a3a', shape: 'zombie', abilities: ['volley', 'summon', 'charge'], minion: 'bloater', shot: '#9be03a' },
  pitwraith:   { name: 'The Pit Wraith', hpMul: 1.0, speed: 44, r: 36, color: '#2a2a2a', skin: '#6a6a6a', shape: 'zombie', abilities: ['dive', 'charge', 'summon'], minion: 'runner' }
};
ZN.REGION_BOSS = { sw: 'druid', se: 'abomination', east: 'bogbeast', mid: 'abomination', north: 'pitwraith',
  wales: 'kite', scot: 'abomination', high: 'nessie', city: 'abomination', ni: 'golem' };
ZN.COUNTY_BOSS = { london: 'colossus', wiltshire: 'druid', powys: 'kite', highland: 'nessie', lochaber: 'nessie',
  caithness: 'nessie', antrim: 'golem', perth: 'nessie', argyll: 'nessie' };

// Landmarks drawn near the start of each mission
ZN.REGION_LANDMARK = { sw: 'church', se: 'church', east: 'windmill', mid: 'pub', north: 'pithead', wales: 'castle',
  scot: 'castle', high: 'loch', city: 'pub', ni: 'causeway' };
ZN.COUNTY_LANDMARK = { london: 'bigben', wiltshire: 'stonehenge', cornwall: 'lighthouse', devon: 'lighthouse', tyne: 'angel',
  durham: 'angel', antrim: 'causeway', highland: 'loch', lochaber: 'loch', lothian: 'castle', gwynedd: 'castle',
  kent: 'cliffs', esussex: 'cliffs', norfolk: 'windmill', cambs: 'windmill', manchester: 'pub', westmids: 'pub' };
ZN.bossFor = function (c) { return ZN.COUNTY_BOSS[c.id] || ZN.REGION_BOSS[c.region] || 'abomination'; };
ZN.landmarkFor = function (c) { return ZN.COUNTY_LANDMARK[c.id] || ZN.REGION_LANDMARK[c.region] || 'church'; };
