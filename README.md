# Zombie Nation

A Vampire Survivors-style Android game set across a zombie-overrun United Kingdom.

## Gameplay

- **Campaign map**: 69 counties and regions across England, Wales, Scotland and Northern Ireland (with ferry links to Northern Ireland). Your first mission can be anywhere. After that you can only attack counties that border one you've already liberated.
- **Waves**: each new county has one more wave than the last (capped at 20). Each wave is 40 seconds (the first mission's single wave is 60s), and you finish by killing the horde boss. Zombies get tougher with every wave and every county you take.
- **Enemies**: Shamblers, Runners, Crawler swarms, Brutes, acid-spitting Spitters, exploding Bloaters, Red Kites, and treasure-carrying Elites.
- **Regional horde bosses**, each with its own moves (charge, summon, acid volleys, underground/underwater dives, telegraphed ground slams):
  The Beefeater Colossus (London), The Stonehenge Druid (South West), The Red Kite Matriarch (Wales), Nessie (Highlands), The Causeway Golem (Northern Ireland), The Fen Bog Beast (East), The Pit Wraith (North), The Kraken (South West coast, erupting tentacles), Black Shuck (East Anglia, pouncing hellhound), The Lambton Worm (Durham and Tyne), Spring-heeled Jack (Surrey, Kent and Sussex, leaps on you), The Green Knight (Cheshire and the Peak District, immune shield phases), Black Annis (Leicestershire, homing curse orbs), The Abomination (elsewhere).
- **Landmarks** in the battlefield: Big Ben, Stonehenge, a Cornish lighthouse, the Angel of the North, the Giant's Causeway, a Highland loch, castles, windmills, pubs, pitheads and the white cliffs.
- **Survivors** (bought with coins), each with a starting weapon and perks: Tommy (pistol), Bert the Beefeater (halberd), Rhiannon the Welsh Shepherd (molotov), Big Rab the Glaswegian Bouncer (cheese aura), Jory the Cornish Fisherman (harpoon), Morag the Highland Piper (bagpipes).
- **Counter-attacks**: after a mission, the horde may attack a liberated county on the frontier. Win a mission there within 3 missions or it falls back to the zombies.
- **Achievements**: 19 achievements, most with up to five tiers (🥉🥈🥇💎👑), e.g. Zombie Slayer at 1k / 10k / 25k / 50k / 100k kills. They pay coins or unlock exclusive content: a Welsh dragon companion (all of Wales), a Highland coo (all of Scotland), a Royal Corgi (London and the South East), a new survivor Nana Doris (10,000 kills) and the Golden Brolly item (a no-damage win).
- **Companions** can never be hurt, and each grants a passive buff: the dragon breathes fire (+10% damage), the corgi fetches XP gems (+30% pickup range), the Highland coo charges the horde (+20% HP). Buy more with coins: Count Batula the vampire bat (every bite heals you), the Wise Old Owl (swoops, +20% XP), the Black Cat (scratches, +luck and crit) and Spike the Hedgehog (rolls around you, thorns).
- **Power-up drops**: Double Weapons, Double Speed, Invincible (trample zombies), Double XP and Deep Freeze, shown with timers on the HUD. Elites always drop one.
- **Animations**: zombies rise from the ground, lurch, squash when hit, lunge to attack and topple over with gore when killed; your survivor breathes, leans, kicks up dust, flashes when hurt, sparkles on level-up and falls when defeated.
- **Daily challenge**: a new county every day with two twists (fog, sprinters, glass cannon, pistol only, giants...). Win it for 300 coins once a day.
- **Pixel-art sprites** for every survivor, zombie and companion, with walk cycles, plus **chiptune music** (menu, battle and boss tracks) generated live with WebAudio.
- **Minimap and off-screen markers** for the boss, elites and treasure chests.
- **Backup / Restore**: export your save as a code (copy it or share it to email or Drive) and restore it on another device.
- **Feel**: screen shake, slow-motion on evolutions and boss kills, and vibration on hits, level-ups and big moments. Each can be toggled.
- **In-mission levelling**: collect XP gems, then pick new weapons, passives or upgrades. You get 6 weapon slots and 6 passive slots.
- **Weapons**: Service Pistol, Ice Sword, Fire Sword, Electric Sword, Crossbow, Molotov, Stinking Bishop (cheese aura), Hubcaps (orbit), Lightning Rod, Flamethrower, Cricket Bat, Bagpipes, Beefeater Halberd, Harpoon Gun, Bike Chain (lash), Land Mines, Carrier Pigeons (homing), Lighthouse Lamp (sweeping beam), Cricket Ball (ricochet), Garden Gnome (turret).
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
  | Crossbow + Electric Sword (both max) | Tesla Bolts |
  | Molotov + Ice Sword (both max) | Steam Bombs |
  | Cricket Bat + Wellies | Six-Hitter |
  | Bagpipes + Lucky Horseshoe | Highland Lament |
  | Beefeater Halberd + Brolly | Yeoman's Wrath |
  | Harpoon Gun + Fridge Magnet | Kraken's Reach |
  | Bike Chain + Full English | Chain Reaper |
  | Land Mines + Fuel Can | Minefield |
  | Carrier Pigeons + Ammo Belt | Pigeon Squadron |
  | Lighthouse Lamp + Union Flag Cape | Beacon of Albion |
  | Cricket Ball + Pocket Watch | Fast Bowler |
  | Garden Gnome + Brolly | Gnome Army |
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
  js/art.js      landmarks, regional bosses, birds
  js/sprites.js  pixel-art sprite grids (survivors, zombies, companions)
  js/audio.js    sound effects, chiptune music sequencer, vibration
  js/ui.js       menus, map, survivors, shop, armoury, HUD
  js/save.js     save data (SharedPreferences on Android, localStorage in a browser)
app/src/main/java/.../MainActivity.java   full-screen WebView host with no dependencies
```

## Installing updates over the top

Android only installs a new version over an old one when both are signed with the same key. CI signs every build with a permanent key stored in two repository secrets (Settings → Secrets and variables → Actions):

- `ZN_KEYSTORE_BASE64`: the keystore file, base64-encoded
- `ZN_KEYSTORE_PASSWORD`: its password (also used for the key, alias `zombienation`)

Each build also gets a higher version number (the workflow run number), and pushes are published on the repo's **Releases** page as `ZombieNation-1.N.apk`. Without the secrets, builds fall back to a throwaway debug key and cannot update an existing install.

## Building the APK

- **GitHub Actions**: every push runs `.github/workflows/build-apk.yml`. Download the `zombie-nation-apk` artifact from the run, copy it to your phone and install it (allow "install unknown apps").
- **Locally**: open the project in Android Studio, or run `./gradlew assembleDebug` (needs JDK 17 and the Android SDK). The APK is written to `app/build/outputs/apk/debug/`.

## Playing in a browser

Open `app/src/main/assets/index.html` in a browser and play with WASD or the arrow keys.
