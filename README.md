# Zombie Nation

A Vampire Survivors-style Android game set across a zombie-overrun United Kingdom.

## Gameplay

- **Campaign map**: 69 counties and regions across England, Wales, Scotland and Northern Ireland (with ferry links to Northern Ireland). Your first mission can be anywhere. After that you can only attack counties that border one you've already liberated.
- **Waves**: each new county has one more wave than the last (capped at 20). Each wave is 40 seconds (the first mission's single wave is 60s), and you finish by killing the horde boss. Zombies get tougher with every wave and every county you take.
- **Enemies**: Shamblers, Runners, Crawler swarms, Brutes, acid-spitting Spitters, exploding Bloaters, treasure-carrying Elites, and The Abomination (a boss that charges and summons).
- **In-mission levelling**: collect XP gems, then pick new weapons, passives or upgrades. You get 6 weapon slots and 6 passive slots.
- **Weapons**: Service Pistol, Ice Sword, Fire Sword, Electric Sword, Crossbow, Molotov, Stinking Bishop (cheese aura), Hubcaps (orbit), Lightning Rod, Flamethrower.
- **Evolutions**:
  | Recipe | Result |
  |---|---|
  | Ice Sword + Fire Sword + Electric Sword (all max) | **Sword of Light** |
  | Service Pistol + Ammo Belt | Minigun |
  | Crossbow + Full English | Ballista |
  | Molotov + Fuel Can | Napalm Strike |
  | Stinking Bishop + Cup of Tea | Stilton Storm |
  | Hubcaps + Brolly | Buzzsaw Halo |
  | Lightning Rod + Pocket Watch | Thunderstorm |
  | Flamethrower + Union Flag Cape | Dragon's Breath |
- **Coins** (kept even if you die) buy permanent stat upgrades: Might, Vitality, Armour, Recovery, Haste, Reach, Greed, Second Wind and more.
- **Survivor level** (account XP from every mission) unlocks new weapons and passives, which can then turn up in level-up choices.

## Controls

Touch and drag anywhere to move (floating joystick). Weapons fire on their own. The Android back button pauses the game or closes menus.

## Project layout

```
app/src/main/assets/            the game (HTML5 canvas, plain JS, no build step)
  index.html, style.css
  js/data.js     counties, weapons, passives, evolutions, enemies, shop
  js/map.js      UK map: Voronoi county shapes clipped to the coastline, adjacency
  js/game.js     mission engine (waves, zombies, pickups, rendering)
  js/weapons.js  weapon behaviours
  js/ui.js       menus, map, shop, armoury, HUD
  js/save.js     save data (SharedPreferences on Android, localStorage in a browser)
app/src/main/java/.../MainActivity.java   full-screen WebView host with no dependencies
```

## Building the APK

- **GitHub Actions**: every push runs `.github/workflows/build-apk.yml`. Download the `zombie-nation-apk` artifact from the run, copy it to your phone and install it (allow "install unknown apps").
- **Locally**: open the project in Android Studio, or run `./gradlew assembleDebug` (needs JDK 17 and the Android SDK). The APK is written to `app/build/outputs/apk/debug/`.

## Playing in a browser

Open `app/src/main/assets/index.html` in a browser and play with WASD or the arrow keys.
