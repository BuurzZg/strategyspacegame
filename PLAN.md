# Driftforge: plan

*Survival redesign, draft for approval. Every name in this document is a proposal you can veto.*

Driftforge is a space survival game for the browser, built in three.js on a deterministic engine. You command the **Forge**, a kilometre-long foundry-city ship stranded in a galaxy of scrap. Its faster-than-light drive is broken. To escape, you cross the galaxy, keep your people alive, and find the parts to repair the drive.

It has two layers:

1. **The galaxy map**, a management layer. You choose where to go next, spend fuel and supplies, look after your crew and the Forge's systems, and track the repair of the drive.
2. **Point-of-interest maps**, a real-time strategy layer. Every place you visit opens a 3D map: the game built in Milestones 1–3. There you mine, salvage, trade or fight, then leave.

Inspiration: Homeworld for fleet command in open 3D space; survival-journey games for the voyage. No names, assets or lore are taken from either. All content is data (YAML), so new regions, races and stories can ship later as add-on content packs.

---

## 1. Premise

The Meridian Hollow lived aboard the Forge, a foundry-city that crossed between stars by threading itself through folded space with its **Skein Drive**. On a routine jump the drive failed mid-thread. It tore loose, and the Forge was thrown out into **the Wrack**, a galaxy with no worlds left in it. It holds only the remains of whatever lived here before: endless scrap, broken moons, wrecks the size of cities, glowing nebulae and asteroid formations nobody built.

The drive still works, barely. It can make short **stitches** between nearby points, each one burning **Glim**, the pale fuel the Forge's engines run on. Every repaired component lets it stitch further. With the drive fully mended, the Forge can make one long jump home from the Wrack's outer edge, the **Shore**.

You start in **the Drift**, the debris ring around the dead star **Orrin**. It is the area built in Milestones 1–3.

Tone: lonely and beautiful, a little strange, with dry humour in the voices of the people you meet. This is a proposal; see the decisions in §15.

## 2. The run

- **Goal:** repair the Skein Drive's four components, reach the Shore, and make the final jump.
- **Loop:** look at the galaxy map, pick a destination within range, stitch there, play its map, leave, then deal with what the trip cost.
- **You lose** if the Forge is destroyed, or its crew reaches zero, or the air runs out for too long.
- **Pressure:** time is always moving. Every day your crew eats, drinks and breathes, and every stitch burns Glim. Staying anywhere too long costs you.

## 3. Layer 1: the galaxy map

### Structure

- The galaxy is generated from a **seed**: about 300–400 points of interest in the core game, spread across **regions**.
- Each region has a theme, a danger level, typical point-of-interest types, and the factions that live there.
- Regions run outward from the Drift (safe-ish, near the start) to the Shore (hostile, far).
- Points are joined by **lanes**, the stitches the drive can make. The generator guarantees that every point can be reached, and that each drive component can be reached at the repair level needed to get there.
- **Fog:** you only see the type of a point once it is inside the Forge's sensor range, or someone has told you about it.

### Travel and Glim

- A stitch costs Glim in proportion to its length, and takes time (about one to three days).
- The **jump range ring** shows how far the drive can stitch right now. Each repaired component widens it, which opens the next region.
- With no Glim you cannot stitch. You can drift to an adjacent point at sub-light speed, which costs many days, or wait for a trader or a rescue event.
- When you plan a route, it shows the cost in Glim and days, and what you will have left on arrival.

### Time

- The galaxy map has a **day clock**. My recommendation is that it only advances when you act (stitch, rest, repair) and is paused otherwise. This is decision 1 in §15.
- Inside a point-of-interest map, time runs with the real-time game: 1 day = 4 minutes of play (tunable). Supplies drain while you are there.

### The Forge's stores and systems

| Store | Comes from | Used by |
| --- | --- | --- |
| **Water** | Melting ice rocks, traders | Crew (daily); making air; growing food |
| **Air** | Life support, which splits water using power | Crew (daily) |
| **Food** | Hydroponics, which grows it from biomass and water; traders | Crew (daily) |
| **Glim** | Skimming nebulae, Glim pockets, traders | Stitches; a small daily draw by the reactor |
| **Ore** | Mining rocks (Milestone 3) | Building ships, repairs |
| **Salvage** | Cutting up wrecks | Repairs, engineering projects, trade |
| **Relics** | Rare finds, quests, trade | Drive components, blueprints |

| System | What it does | If it is damaged |
| --- | --- | --- |
| **Skein Drive** | Stitches; repair track (see below) | Shorter range, or a misjump |
| **Reactor** | Powers everything | Every other system works slower |
| **Life support** | Makes air from water | Air drains |
| **Hydroponics** | Grows food | Food drains faster |
| **Foundry** | Builds ships (the production queue) | Building is slower, or stops |
| **Sensors** | Scan range on both layers | Smaller fog-free radius |
| **Hull** | The Forge's hit points | At zero, the run ends |

Systems lose condition in combat and through events, and are repaired with Ore, Salvage and engineer time.

### Crew and morale

- **Crew** is a head count, split into roles: engineers, pilots, miners and hands. My suggestion is to start with role counts, not named individuals (decision 7).
- Every ship needs crew to fly. Building a Dart takes two pilots from the roster. If the Dart is destroyed, its crew may die, or eject in pods that Gleaners can pick up.
- Crew needs water, air and food every day. You can recruit more at hull-towns, rescue survivors, or have them join through events.
- **Morale** (0–100) rises with victories, good food and rest. It falls with shortages, losses and long stretches of empty space. Low morale slows work, then brings desertion and mutiny events.

### Consequences

These escalate, rather than ending the run at once:

1. **A store runs low:** a warning, and morale starts to slip.
2. **It runs out:**
   - no food: crew die slowly;
   - no water: no new air or food is made;
   - no air: crew die quickly, and three days without air ends the run.
3. **A system reaches 0%:** its function is lost until it is repaired.
4. **The run ends** when crew reaches zero or the Forge's hull is destroyed.

### The Skein Drive repair track

| Component | Opens | Typically found |
| --- | --- | --- |
| **Threadwound Coils** | Stitches about 1.5× longer; the second region | Salvage from ancient wrecks in the Drift and its neighbours |
| **Stillwater Lens** | Stitches through nebulae; the third region | A Choir quest, or trade with them |
| **Anchor Spindle** | Long stitches; the outer regions | Held by the Ashen Gaunt: fight, buy or negotiate |
| **Heartstone** | The final jump from the Shore | Deep in the last region |

Each component is an item defined in YAML, with recipes, prerequisites and where it can be found. A content pack can add new components or new routes to them.

### Galaxy screens

- **Star chart:** a 3D view of the galaxy disc, showing regions, points, lanes, the Forge, the jump range ring, and route planning.
- **Forge:** systems, condition, repairs and engineering projects.
- **Crew:** roles, morale and the roster.
- **Hold:** stores, cargo and relics.
- **Standing:** your reputation with every faction.
- **Log:** events, discoveries and trades.

## 4. Layer 2: point-of-interest maps

### How the current map becomes the template

The current game already builds every match from a `settings` object:

```js
{ seed, space: { w, d, h }, spawns, fields, startingShips, players }
```

`World` builds the map from that object, and world traits populate it. AsteroidFields places the fields and StartingFleet places the ships. A point-of-interest map is the same thing with a richer settings object, built by a generator instead of written by hand in `main.js`.

1. **Template.** `poi-types.yaml` describes each kind of place:
   - its size;
   - which deposits, wrecks, formations and nebulae it contains, and how many;
   - its encounter tables by region danger;
   - its events;
   - where you arrive and where you can leave.
2. **Generate.** `generatePoi(galaxySeed, poiId, visit, runState)` returns a settings object.
   - It uses the same seeded RNG, so the same place is always generated the same way.
   - If you go back somewhere, it remembers what you already took.
3. **Bring the Forge.** The Forge and its docked fleet come from the run state, not from StartingFleet. That includes hull, system damage, crew and the ships you have built. Stores go into the player's resources.
4. **Play.** The world runs exactly as it does today: deterministic, lockstep-ready, all orders through the order queue.
5. **Leave.** You order the Forge to **spool the Skein** (about 60 seconds, a countdown on screen) and recall your ships. Ships not docked when the drive fires are left behind.
6. **Report.** `world.report()` returns what changed:
   - resources gained and spent;
   - ships and crew lost;
   - damage to the Forge;
   - reputation events;
   - what you took from the map.

   This is merged into the run state, and you are back on the galaxy map.

What carries over unchanged from Milestones 1–3:
- the camera, the movement disc and the height line;
- the flight model and the steering around obstacles;
- production, launch bays and rally points;
- collectors, docking and the Smelter;
- selection, the HUD, effects and the tests.

`AsteroidFields` becomes a general `Deposits` trait, with more resource kinds (below). The skirmish setup in `main.js` becomes the **Proving Grounds**, a developer sandbox for testing and AI-vs-AI runs (decision 10).

### New things on the maps

| Thing | What it is | How you get it |
| --- | --- | --- |
| **Ore rocks** | Metal asteroids (Milestone 3) | Gleaners |
| **Ice rocks** | Pale blue rocks and comet shards | Gleaners → Water |
| **Wrecks** | Dead ships and stations; cut them apart for salvage, relics and blueprints; sometimes still occupied | **Shearer** (a new salvage cutter) |
| **Glim pockets** | Glowing condensate in nebulae | **Skimmer** (a new gas collector) |
| **Spore drifts** | Floating biomass clouds | Skimmer → Food |
| **Formations** | Arches, rings, spires and lattices of fused rock; strange, beautiful, and solid | Obstacles, cover, landmarks; some hide relics |
| **Nebula volumes** | Coloured gas that cuts sensor range and slows shields | — |
| **Escape pods** | Crew from destroyed ships | Any collector, rescues crew |
| **Stations** | Hull-towns, refineries, dens: faction bases built into wrecks | Trade, hail, or fight |

### Point-of-interest types (examples for the core game)

| Type | What you find there |
| --- | --- |
| **Scrap Shoal** | A dense debris field: ore and salvage, sometimes rust mites |
| **Wreck of the …** | One giant derelict with salvage rooms, relics, and something living inside |
| **Ore Reef** | Rich ore among crystalline arches and spires |
| **Ice Tail** | A comet's debris trail; the best source of water |
| **Lantern Mist** | A Glim nebula: fuel and spore drifts, poor sensors, things in the haze |
| **Graveyard Ring** | Hundreds of dead ships around a collapsed star; high salvage, high danger |
| **Hull-town** | A Rivet Moot settlement in a gutted capital ship: trade, repairs, crew |
| **Synod Refinery** | A Lantern Synod station that sells Glim and dislikes violence |
| **Gaunt Den** | A raider base: fight, pay tribute, or negotiate |
| **Choir Bloom** | A gathering of Choirmoths: quests and knowledge about the drive |
| **Distress Beacon** | Survivors, or a trap |
| **Hollowhorn Grounds** | A leviathan's feeding area: rare resources and a very large monster |
| **Still Water** | Empty space; a cheap, safe place to rest and repair |

Each type is one YAML template, with weighted options per region. A content pack adds new types without code.

### Ship roster

The Milestone 1–3 roster stays: Forge, Gleaner, Smelter, Dart, Talon, Picket and Halberd. The rest of the original combat roster follows: Tender, Spindle, Sabre, Monolith and the Wisp scout. Two utility hulls are new: the **Shearer** (salvage cutter) and the **Skimmer** (gas and spore collector). The counter table from the original plan still holds:

- Pickets beat fighters.
- Halberds beat corvettes.
- Talons beat frigates and capitals.
- Darts beat Talons.
- Sabres beat frigates.
- Monoliths beat destroyers.
- Spindles and bomber swarms beat Monoliths.

Every ship gets a **Crew** cost in YAML. Ships persist between points: they ride in the Forge's hangars, and hangar size is the old fleet-capacity number.

**Research becomes engineering.**
- Hulls are unlocked by **blueprints**, which you salvage, buy or earn.
- Forge upgrades are **engineering projects**, which cost Ore, Salvage, Relics and days.
- The tier list from the original plan becomes the default blueprint set.

## 5. Races, factions and reputation

### Races

| Race | Who they are |
| --- | --- |
| **Humans** (Meridian Hollow) | You. Foundry people, far from home |
| **Hullborn** | Small, pale, large-eyed humanoids born inside derelict hulls. They breathe thin air, patch their homes from scrap, and are nervous, sharp traders |
| **Tallowfolk** | Slow, waxy-skinned, long-lived humanoids. They render Glim from nebula gas and keep their word to the letter |
| **Gaunt** | Tall, many-jointed humanoids sealed in rust-red pressure suits. They strip wrecks and ships, and respect strength and debts |
| **Choirmoths** | Not humanoid: swarms of luminous moth-like beings who live in nebulae and speak in light. They know what the Skein is |

### Factions

| Faction | Race | Default stance | What they offer |
| --- | --- | --- | --- |
| **Rivet Moot** | Hullborn | Friendly | Salvage, parts, repairs, crew for hire; they buy ore |
| **Lantern Synod** | Tallowfolk | Neutral | Glim, food; a strict code: no violence near their refineries |
| **Ashen Gaunt** | Gaunt | Hostile | Tribute deals, mercenary ships, the Anchor Spindle |
| **Cinder Pact** | Humans | Wary | A league descended from another Forge that never got home. Hired ships, old charts, and a rivalry |
| **The Choir** | Choirmoths | Neutral | Knowledge, quests, the Stillwater Lens |

A race can have several factions; DLC can add factions to existing races. **Space monsters are not a faction.** They have no reputation and are always hostile:

- **Scrapwyrms:** burrow through fields and ambush.
- **Rust mites:** swarms that infest wrecks and eat hulls.
- **Gnasher packs:** fast hunters.
- **The Hollowhorn:** a leviathan.

### Reputation

- Every faction has a standing from −100 to +100, shown in five tiers: **Hostile, Wary, Neutral, Friendly, Allied**.
- Each race also has a **race standing**. It is an average of its factions' standings, and it sets your starting standing with factions of that race you haven't met yet.

| Action | Change (typical) |
| --- | --- |
| Attacking their ships | −10 per attack, −25 per kill |
| Mining or salvaging in their territory without leave | −1 per load, and they warn you first |
| Trading | +1 per deal |
| Helping (quests, rescues, fighting their enemies) | +5 to +20 |
| Paying tribute | Raises their standing toward Neutral for a while |
| Breaking a treaty | −40 |

**What standing changes:**

- **Behaviour on maps:**
  - Hostile: attacks on sight.
  - Wary: keeps its distance and warns you off.
  - Neutral: ignores you.
  - Friendly: may help in fights.
  - Allied: joins them.
- **Prices:** up to ±30%.
- **What they offer:** stock, hireable ships, quests, and information such as where drive parts are.
- **Where you are welcome:** territory claims, and safe passage.

All of these numbers live in YAML.

### Diplomacy and trade

- **Hail** a faction's ship or station to open a comms panel.
- What you can do depends on standing: **trade**, **negotiate** (a ceasefire, peace, tribute, or passage), **ask** for information or quests, or **threaten**.
- **Trade** uses a buy/sell screen. Prices come from base value, local supply, your standing, and the faction's tastes.
- **Treaties** last a set number of days and have terms, for example "don't mine in our territory". The game tracks them, and breaking one costs heavily.
- **Traders** sit at hull-towns and refineries, and travel as convoys you meet on maps.

## 6. Combat

Milestone 4 continues as planned:
- weapons with projectiles, beams, homing missiles and flak;
- health, the four armour classes, and the damage (versus) table;
- explosions and debris;
- **wrecks** left behind, which become salvage once Shearers exist.

Formations and stances follow as before. Fighting is one option among several. Combat with factions costs reputation and crew; combat with monsters costs crew and gives salvage.

## 7. Content as data: packs and add-ons

All game content lives in **content packs**. The base game is the `core` pack. An add-on is just another pack.

```
content/
  core/
    pack.yaml            id, name, version, load order, depends on
    rules/               ships, weapons, defaults (as today)
    resources.yaml       stores and map resources, their names, values and icons
    items.yaml           drive components, relics, blueprints
    races.yaml  factions.yaml  monsters.yaml
    regions.yaml         region themes, danger, point-type weights, faction presence
    poi-types.yaml       point-of-interest templates
    events/*.yaml        galaxy and map events
    dialogs/*.yaml       comms trees per faction
    names.yaml           name generators (wrecks, people, places)
  some-addon/            another pack: new regions, races, stories; can extend or override core
```

- **Merging:** packs merge with the existing MiniYAML rules: inheritance, `-Key` removals, and later files override earlier ones. A pack can therefore add a region, add a faction to an existing race, or tweak a ship without touching core files.
- **Events and dialogs are declarative,** with no code in content. Each one has:
  - conditions: flags, standing, stores, region, crew roles;
  - choices;
  - effects from a small, fixed vocabulary: give, take, change standing, damage a system, add or remove crew, set a flag, start an encounter, open a map with modifiers, reveal points.

  New effects are added in code once and can then be used by any pack.
- **All player-facing text** is in the packs, ready for translation later.
- **A content lint** checks every pack at load time: unknown keys, broken references, unreachable events, and point types no region uses. The same goes for the test suite.
- **A test pack** in the test suite adds a region and a race with no code changes. That proves add-ons work.

## 8. Architecture: what stays, what is new

| Part | Status |
| --- | --- |
| Engine: integer maths, actors, traits, activities, orders, lockstep, seeded RNG, sync hash | **Stays** (Milestones 1–3) |
| Flight, steering round obstacles, capsule hulls, crowding | **Stays** |
| Production, launch bays, rally, collectors, docking, Smelter | **Stays**; production also draws crew |
| Rules loader (MiniYAML) | **Extended** to load content packs from manifests |
| `PlayerResources` (one currency) | **Becomes** a store of every resource kind in `resources.yaml` |
| `AsteroidFields` | **Becomes** `Deposits`, plus new `Wrecks`, `Formations`, `Nebulae`, `Encounters` and `Stations` world traits |
| Skirmish setup in `main.js` | **Becomes** the point-of-interest generator, plus the Proving Grounds sandbox |
| New: `src/galaxy/` | Galaxy generator, run state, travel, the day clock, consumption, systems, crew, reputation, trade, events. Deterministic and headless-testable like the simulation |
| New: run saves | The run state is a plain snapshot between maps (JSON). Inside a map a save is the settings plus the order log, and loading replays it. Both are exact because everything is deterministic |
| New screens | Star chart, Forge, crew, hold, standing, log, comms and trade |

Determinism stays a hard rule on both layers. It keeps saves exact, makes every system testable headless, and leaves multiplayer or co-op possible later.

## 9. Folder layout (target)

```
space-strategy/
  index.html
  lib/                 three.js r160
  content/core/        the base game as a content pack (rules/ moves here)
  src/engine/          as today, plus content-pack loading
  src/traits/          as today, plus deposits, wrecks, formations, nebulae, encounters,
                       stations, combat, crew, faction AI, monster AI
  src/activities/      as today, plus attack, salvage, skim, formation moves
  src/galaxy/          generator, run state, travel, clock, stores, systems, crew,
                       reputation, trade, events, dialogs
  src/render/          as today, plus the star chart, wrecks, formations, nebulae
  src/ui/              as today, plus galaxy screens, comms, trade
  tools/               headless tests, content lint, voyage simulator, AI captain
  README.md, PLAN.md
```

## 10. How each milestone is tested

As now, every milestone ends with:

1. Headless tests in Node, including a determinism check.
2. A browser run through the real UI in headless Chromium, with no console errors, and screenshots I look at.
3. A short summary and an updated README.
4. A commit and a push.

New kinds of test arrive with the new layers:

- **Content lint:** every pack validates.
- **Voyage simulator:** it plays the galaxy layer headless: consumption maths, the consequence ladder, galaxy connectivity, and reachability of every drive component.
- **AI captain:** it plays whole seeded runs end to end. It checks run length, difficulty, and that a run can be won.

## 11. Milestones

### Done

| # | Milestone | Result |
| --- | --- | --- |
| 1 | Camera and 3D movement | Orbit camera; movement disc with height line; the flight model |
| 2 | Forge and production | The Forge, a production queue, launch bays, rally points, fleet capacity |
| 3 | Collectors and mining | Asteroid fields, Gleaners, docking, the Smelter, ore income; capsule hulls; steering round obstacles (since added) |

### Next

| # | Milestone | Playable result | Checks |
| --- | --- | --- | --- |
| **4** | **Combat** | Weapons (projectiles, beams, missiles, flak), health, armour, the versus table, explosions, wrecks that stay behind. A sandbox spawner and a hostile test fleet (Gaunt raiders) plus a monster pack (Gnashers). Ships get a Crew value (shown, not used yet). | Balance matrix: each counter wins its matchup; kills, damage and wreck creation are deterministic |
| **5** | **Formations, stances, control groups** | Formation and stance bars, groups that hold their shape in 3D, control groups. Fights get bigger now, so this comes early | Ships hold their slots within tolerance; Passive ships never fire |
| **6** | **Point-of-interest maps from data** | The core content pack and the generator. Five point types (Scrap Shoal, Ore Reef, Ice Tail, Lantern Mist, Wreck). New resources (ice, salvage, Glim, spores), the Shearer and the Skimmer, wrecks, formations and nebulae. Arriving, spooling the Skein to leave, and an end-of-visit report. A launcher to pick a type and a seed | Generation is deterministic; every template validates; the report accounts for every resource; ships left behind are lost |
| **7** | **Galaxy map and the voyage** | A seeded galaxy (about 300 points, four regions), the star chart, stitching with Glim, the day clock, water, air and food, crew roles and morale, Forge systems and damage, the consequence ladder and game over. The run state flows in and out of maps; the drive repair track; saving on the galaxy map. Monsters and derelicts only | Voyage simulator: consumption maths, the starvation ladder, connectivity, components reachable, save/load identical |
| **8** | **Races, factions, reputation** | The five factions in YAML; faction fleets on maps acting by standing; territory claims (stealing costs standing); stations; reputation changes from actions; the standing screen | Reputation maths; behaviour follows tier; stealing is detected; a test pack adds a faction with no code |
| **9** | **Diplomacy and trade** | Hailing, the comms panel (dialogs in YAML), the trade screen with standing-based prices, tribute, ceasefire and peace treaties, hiring crew and ships, buying information | Price maths; treaties enforced; every dialog validates and every branch is reachable |
| **10** | **Events, monsters, story** | Galaxy and map events (distress beacons, ambushes, discoveries); monster behaviours (Scrapwyrm ambushes, mite infestations, the Hollowhorn); a prologue, the drive-component storylines, and the ending | Every event validates and is reachable; monster behaviour tests; a scripted run reaches the ending |
| **11** | **Sensors, fog, engineering** | Sensor fog on maps, the Tactical Plot (Tab), galaxy scanning, blueprints and engineering projects, the Wisp scout | Hidden ships stay hidden until seen; blueprints unlock the right hulls |
| **12** | **Polish and the first full run** | Main menu, new-run setup (seed and difficulty), a tutorial, a sound pass, a balance pass to the target run length, the AI captain, and a final README | The AI captain finishes many seeded runs headless; run length is within the target; no console errors |

Each milestone is playable on its own. Milestones 4 and 5 run in the Proving Grounds sandbox. From Milestone 6 you play generated points. From Milestone 7 you play a whole voyage.

**Later, as add-on packs:** new regions beyond the Shore, new races and factions, story arcs, co-op multiplayer (the engine stays lockstep-ready).

## 12. Risks

| Risk | Approach |
| --- | --- |
| Two layers double the scope | The galaxy layer is mostly data and simple screens. Its rules are plain deterministic maths and are tested headless. The 3D work stays where it already is: on the maps |
| Survival tuning: too harsh or too easy | All numbers live in YAML. The voyage simulator and the AI captain measure starvation rates and run length on many seeds |
| Generated maps feel samey | Point types mix hand-made templates with seeded variation; formations, nebulae and events add character; regions change the palette and the mix |
| Content packs become a second programming language | Events and dialogs stay declarative, with a fixed vocabulary of effects. New behaviour goes into code once and is then usable by every pack |
| Performance with wrecks, formations and nebulae | Instanced meshes, the existing spatial hash, and steering that only checks obstacles near the path |

## 13. Names (proposals)

| Thing | Proposal | Alternatives |
| --- | --- | --- |
| The game | Driftforge | — |
| The drive | **Skein Drive**: it threads the Forge through folded space; short hops are *stitches* | Lanternwake Drive, Foldwright |
| The fuel | **Glim**: a pale, luminous condensate skimmed from nebulae | Wickfire, Palewater |
| The galaxy | **The Wrack** | The Tatterdeep, the Long Scrap |
| Start region | **The Drift**, round the dead star Orrin | — |
| Escape edge | **The Shore** | The Rim of Lights |
| Your people | **Meridian Hollow** | — |
| Drive components | Threadwound Coils, Stillwater Lens, Anchor Spindle, Heartstone | — |
| Races | Hullborn, Tallowfolk, Gaunt, Choirmoths | — |
| Factions | Rivet Moot, Lantern Synod, Ashen Gaunt, Cinder Pact, the Choir | — |
| Monsters | Scrapwyrm, rust mites, Gnasher packs, the Hollowhorn | — |
| New hulls | Shearer (salvage cutter), Skimmer (gas collector) | — |

## 14. What changes from the previous plan

- **Removed:**
  - skirmish against a rival AI Forge as the goal;
  - victory and defeat by destroying the enemy Forge;
  - the old Milestone 6, "Enemy AI and win/lose".
- **Kept:**
  - everything built in Milestones 1–3;
  - combat, formations, stances, sensors and fog;
  - the ship roster and counter table;
  - determinism, the tests, and the browser checks.
- **Changed:**
  - research becomes blueprints and engineering;
  - the Cinder Pact becomes a faction you meet;
  - the AI becomes faction and monster behaviour plus the AI captain;
  - the skirmish setup becomes the Proving Grounds sandbox.

## 15. Decisions for you

Each has my recommendation first.

1. **Galaxy map time.** Paused, advancing only when you act (stitch, rest, repair)? Or always running in real time? *I recommend paused. Maps already supply the real-time pressure.*
2. **Death and saves.** Permanent death (roguelike), or loadable saves? *I recommend permanent death by default: an autosave on the galaxy map, removed when the run ends. Plus an optional "Captain's Log" mode with free saves.*
3. **Run length.** *I recommend 4–6 hours for a full run, about 60–90 game days and 25–40 points visited, with a "short voyage" setting of about 90 minutes.*
4. **Same galaxy or random?** *I recommend a new seeded galaxy each run, with a shareable seed. Story points such as components, faction homes and Choir Blooms are placed by rules, so every run tells the same story in a different place.*
5. **Story.** Hand-written story beats (prologue, component storylines, ending, faction arcs) plus random events? Or random events only? *I recommend both.*
6. **Leaving a map.** Can you always leave (60 s spool, ships not aboard are lost)? Or can some enemies block or interrupt the spool? *I recommend: always possible, but some threats can interrupt it, such as a Gaunt interdictor or the Hollowhorn.*
7. **Crew depth.** Role counts (engineers, pilots, miners, hands), or named individuals with traits? *I recommend role counts now; named officers could come in a later pack.*
8. **Fleet between maps.** Do your ships travel with you in the Forge's hangars? *I recommend yes: hangar space caps the fleet, and losses are permanent.*
9. **Scale of fights.** Roughly how big should battles get? *I recommend up to about 40 ships a side.*
10. **Keep a sandbox mode?** *I recommend keeping the Proving Grounds as a developer and testing sandbox, reachable from the main menu.*
11. **Tone.** *I recommend lonely, beautiful and a little strange, with dry humour from the people you meet.* Or darker, or lighter?
12. **Names.** Keep the proposals in §13, or change any?
13. **The galaxy map view.** A full 3D galaxy you orbit with the same camera? Or a flatter, chart-like map? *I recommend 3D, reusing the orbit camera and the visual style.*
