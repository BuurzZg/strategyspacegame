# Driftforge: plan

*Working title. Every name in this document is a placeholder you can veto.*

Driftforge is a real-time 3D space strategy game for the browser. It takes its gameplay inspiration from Homeworld (fleet command in open 3D space, a mothership as your base, resourcing, formations, research), but its names, factions, story, ships and art are all new.

It is built on the engine architecture of Glasswake (`../strategygame`). That code is copied and adapted, never imported, and the old folder is never modified.

---

## 1. Premise (original)

The star **Orrin** is collapsing. Its ring of shattered moons, **the Drift**, is the last place in the system with workable ore. Two rival foundry-cities left their dying stations and went after it. Each foundry-city is a single kilometre-long ship called a **Forge**. Whoever strips the Drift first survives the century.

| | **Meridian Hollow** (player default) | **Cinder Pact** |
| --- | --- | --- |
| Palette | Pale teal and white light | Ember red and bronze |
| Style | Precise and patient | Brutal and fast-breeding |

Both sides share one ship roster at first, as Glasswake's factions do. The factions differ in colours, lore and voice lines. They can diverge later.

**Naming rule:** nothing from Homeworld is reused. That covers race and clan names, places, ship names, and named systems or UI screens. Generic military and space words such as *mothership*, *frigate*, *destroyer* and *formation* are fine.

## 2. Core design

### Battlefield

Open 3D space, with no ground and no terrain grid. The map is a bounded box, about 160 × 160 × 60 "cells" (1 cell = 1024 world units, as in Glasswake). It contains:

- **Asteroid fields:** clusters of minable rocks. These are actors with a resource amount.
- **Debris and derelict hulks:** obstacles and scenery.
- **Nebula volumes:** spheres that look like glowing gas. Later, they cut sensor range inside them.
- **Starfield and skybox:** procedural.

### Camera

The camera orbits a focus point: the selected ship or group's centre, or a free point.

| Input | Action |
| --- | --- |
| Right-drag | Rotate (yaw and pitch) |
| Scroll | Zoom from close-up to a wide tactical view |
| Middle-drag | Pan the focus point |
| F | Focus on the selection; the camera follows it |
| Double-tap a group number | Jump to that group |

All camera motion is smoothed.

### 3D movement order

1. With ships selected, press **M** or right-click empty space. A **movement disc** appears on the horizontal plane through the selection's centre.
2. Move the mouse to set the destination on that plane.
3. Hold **Shift** and move the mouse up or down to set the **height**. A vertical **height line** and a ghost marker show the target altitude.
4. Left-click to confirm; right-click or Esc to cancel.

Right-clicking an enemy attacks it. Right-clicking an asteroid with collectors selected mines it.

### Mothership: the Forge

- A huge, slow capital ship. It is your base.
- It has a production queue, a research queue, docking bays for collectors, the largest sensor range in the fleet, and some point defence.
- **If your Forge is destroyed, you lose.**

### Resources

- **Gleaner** collector ships mine asteroid fields (ore).
- They return the ore to the Forge, or to a **Smelter** (a slow, mobile refinery ship you can park near distant fields).
- Fields deplete; there is no regrowth on the default maps.
- Ore is spent on ships and research.
- A **fleet capacity** limit plays the same role as supply in Glasswake.

### Ship classes and counters

There are four armour classes: Light, Medium, Heavy and Capital. Each weapon type does extra damage to some classes and reduced damage to others (Glasswake's "Versus" table).

| Class | Ship | Role | Strong against | Weak against |
| --- | --- | --- | --- | --- |
| Utility | **Gleaner** | Collector | — | everything |
| Utility | **Smelter** | Mobile refinery | — | everything |
| Utility | **Wisp** | Fast unarmed scout with long sensors | — | everything |
| Fighter | **Dart** | Interceptor (autocannon) | fighters, bombers | corvettes |
| Fighter | **Talon** | Bomber (plasma bombs) | frigates, capitals | interceptors, corvettes |
| Corvette | **Picket** | Flak corvette | fighters | frigates |
| Corvette | **Tender** | Repair corvette (heals nearby ships) | — | everything |
| Frigate | **Halberd** | Assault frigate (pulse guns) | corvettes, fighters | bombers, destroyers |
| Frigate | **Spindle** | Lance frigate (beam) | capitals | fighters |
| Destroyer | **Sabre** | Destroyer (pulse + torpedoes) | frigates | bombers, heavy capitals |
| Heavy capital | **Monolith** | Heavy cruiser (lances + flak) | destroyers, frigates | bomber swarms, Spindles |

The counter chain:

- Pickets beat fighters.
- Halberds beat corvettes.
- Talon bombers beat frigates and capitals.
- Darts beat Talons.
- Sabres beat frigates.
- Monoliths beat destroyers.
- Spindles and bomber swarms beat Monoliths.

No unit is good at everything. Every number lives in YAML, and a headless balance test checks each matchup (see §6).

### Formations

Players choose a formation for a selected group. When the group moves, ships fly in their slots, and the group travels at the speed of its slowest ship.

| Formation | Shape |
| --- | --- |
| **Wall** | A flat sheet facing the direction of travel |
| **Sphere** | Ships spread over a shell around the centre; good for escorting |
| **Wedge** | An arrowhead |
| **Column** | Single file, for narrow gaps between asteroids |
| **Ring** | A loose circle |
| **Loose** | No formation |

Slot offsets are computed in the group's local frame, so formations turn and climb with the group.

### Stances (per group)

These map directly onto Glasswake's AutoTarget stances.

| Stance | Behaviour |
| --- | --- |
| **Aggressive** | Chase and engage anything in range, with a leash |
| **Defensive** | Hold position and return fire |
| **Passive** | Never fire; flee when attacked (for collectors and scouts) |

### Research

The Forge has a research queue. Finishing a research item does one of two things:

- grants a prerequisite that unlocks new hulls in the production menu;
- grants an upgrade condition to every eligible ship, using the existing condition system.

| Tier | Research | Unlocks / effect |
| --- | --- | --- |
| 1 | Corvette Drives | Picket, Tender |
| 1 | Strike Craft | Talon |
| 1 | Refinery Hulls | Smelter |
| 2 | Frigate Keels *(needs Corvette Drives)* | Halberd |
| 2 | Lance Optics *(needs Frigate Keels)* | Spindle |
| 3 | Destroyer Yards *(needs Frigate Keels)* | Sabre |
| 4 | Capital Yards *(needs Destroyer Yards)* | Monolith |
| Upgrade | Fighter Thrusters | +20% speed for fighters |
| Upgrade | Reactive Plating | +15% hull for corvettes and frigates |
| Upgrade | Long-range Sensors | +30% sensor range |
| Upgrade | Ore Compression | +25% collector capacity |

### Sensors and the tactical map

- Every ship has a **sensor range**.
- The Forge and Wisps also have a long **contact range**. Enemies inside contact range but outside sensor range show up as unidentified blips.
- **Fog of war:** an enemy ship is only drawn when one of your sensors can see it. Blips appear only on the tactical map.
- **Tactical Plot** (toggle with **Tab**): a zoomed-out view of the whole map. It shows friendly ships as icons, contacts as blips, asteroid fields with their remaining ore, and nebulae. You can select and give move orders from it.

### AI opponent

The AI reuses Glasswake's bot-module architecture and difficulty profiles, adapted for space:

| Module | Job |
| --- | --- |
| Harvester | Keeps Gleaners busy; builds a Smelter for distant fields |
| Fleet builder | Weighted production mix plus a research plan |
| Fleet commander | Groups ships into formations, sets stances, defends the Forge, and attacks only when strong enough. It reuses the force-ratio, retreat and grouping logic. |

Difficulties are easy, normal and hard. **Autopilot**, **Watch AI** and **self-play** all carry over.

### Visual style

- Black-violet space with a dense procedural starfield and a nebula skybox.
- Low-poly procedural ships, with emissive faction colours and glowing engines that leave fading trails.
- Tracers, beams, missiles and flak bursts; explosions with debris and shockwaves.
- Selection brackets and health bars; the movement disc and height line.
- Every asset is generated in code, with no files to download.

### Audio

Glasswake's WebAudio synth, extended with engine hum, weapon and impact sounds, and comms blips.

## 3. What carries over from Glasswake

| System | Reuse | Notes |
| --- | --- | --- |
| Stack: three.js r160 (vendored), plain ES modules, no build step, Node relay | **As is** | three.js already renders 3D; nothing needs to change |
| Rules: YAML with inheritance, removals, conditions, lint | **Copy** | |
| Engine core: actor/trait/activity, orders, lockstep order manager, replays, seeded random numbers, sync hash | **Copy** | `World` loses the grid map |
| Integer math | **Extend** | Add 3D vectors, yaw and pitch, 3D distance |
| Production queue | **Adapt** | Ships launch from the Forge's bay, not a building exit |
| Supply → fleet capacity, tech tree, statistics | **Copy, rename** | |
| Combat: weapons, projectiles, warheads, versus table, health, auto-target, stances | **Adapt** | Ranges and projectiles become 3D; add homing missiles and flak bursts |
| Harvest activities | **Adapt** | Asteroids instead of crystal cells; docking with the Forge or a Smelter |
| Bot modules, difficulty profiles, autopilot, self-play | **Adapt** | No base building; adds research and formations |
| Developer mode, debug panel, cinematic director, recorder, capture script | **Adapt** | The director already works with 3D camera shots |
| HUD (DOM panels, tooltips, toasts), audio synth, menus, styles | **Adapt** | New screens: tactical plot, research tree, formation and stance bar |
| Tools: lockstep test, determinism lint, headless runner | **Copy** | |

## 4. What must be rebuilt for 3D space

| Glasswake (2D on terrain) | Driftforge (3D space) |
| --- | --- |
| Grid map: obstacles, cell occupancy, height field | **Space volume:** bounds, plus asteroids, debris and nebulae as actors or volumes. No cells. |
| Grid A* pathfinder | **Steering flight:** fly straight at the target, avoid large bodies with sphere tests, adjust speed for arrival. No grid pathfinding. |
| Mobile (2D, single facing angle) | **Flight model:** 3D position; yaw and pitch (integer angles, using the existing trig tables); acceleration and deceleration; turn rates. Banking is visual only. |
| Buildings, weaving, lattice field | **Removed.** Production and research run on ships. |
| Fog grid and fog overlay shader | **Sensor fog:** each player's visible set is computed from sensor spheres with a 3D spatial hash. The tactical plot draws the blips. |
| Ground camera rig (pan over terrain) | **Orbit camera** around a focus point or the selection |
| Picking: ray hits terrain | **Picking:** project ships to screen space, plus a ray against the movement plane |
| Right-click move on the ground | **Movement disc with height line** (see §2) |
| Minimap of the terrain | **Tactical Plot** |
| Terrain, rocks, crystal meshes | Starfield, nebula skybox, instanced asteroids, debris |
| Group move formation (2D breadth-first spread) | **3D formation templates** in the group's local frame |
| Save/load | The old game has none; it has replays only. Here a save is the settings plus the order log, and **loading re-simulates to the saved tick.** That is exact because the simulation is deterministic, and fast because it runs headless. |

**Is the stack good enough?** Yes. three.js is a 3D engine, and the integer simulation extends to 3D cleanly: squared 3D distances stay far below JavaScript's 2⁵³ exact-integer limit. Glasswake only used one 2D slice of three.js, so nothing needs replacing.

## 5. Folder layout

```
space-strategy/
  index.html          page shell, HUD markup, CSS
  lib/                three.js r160 (copied)
  rules/              world, player, defaults, ships, research, weapons (YAML)
  src/engine/         math (+3D), random, miniyaml, rules, traits, actor, activity, order,
                      ordermanager, world (3D), space (bounds/asteroids/nebulae), player
  src/traits/         flight, combat, economy (asteroid/collector/dock), production,
                      research, sensors, formation, player, bot, devmode
  src/activities/     fly, attack, harvest, dock, formation-move
  src/render/         scene (stars, skybox), ships (procedural models), asteroids,
                      effects (trails, beams, explosions), worldrenderer, director
  src/ui/             camera (orbit), input (selection, move disc), hud, tactical plot,
                      research panel, debug, audio, recorder
  server/relay.js     copied, for later multiplayer
  tools/              headless runner, lockstep test, determinism lint, self-play, balance test
  README.md, PLAN.md
```

## 6. How each milestone is tested

Every milestone ends with:

1. **Headless simulation tests in Node.** These include a determinism check (two runs, same hash) plus checks specific to the milestone.
2. **A browser run in headless Chromium.** It plays the milestone's scenario through the real UI and must finish with no console errors. I take screenshots and look at them.
3. **A short summary to you,** saying what works and how to test it, plus updated README controls.

## 7. Milestones

| # | Milestone | Playable result | Checks |
| --- | --- | --- | --- |
| **1** | **Space, camera, one ship** | A starfield and nebula skybox. The orbit camera rotates (right-drag), zooms (scroll) and focuses (F). One ship can be selected (click or box) and moved anywhere in 3D using the movement disc, Shift for height, and the height line. The ship turns, accelerates and banks; its engine glows. | The ship reaches the 3D target within tolerance; arrival is deterministic; browser smoke test; screenshot. |
| **2** | **Forge and production** | Your Forge and a production panel to build Darts, Talons, Pickets and Halberds. Ships launch from the bay to a rally point. Fleet capacity, build times, costs and a cancellable queue. | A queued ship spawns at the bay after its build time; capacity blocks over-building. |
| **3** | **Collectors and mining** | Asteroid fields with ore. Gleaners mine automatically, dock and unload at the Forge, and the ore counter rises. Then the Smelter. | A full mine-dock-unload cycle in the headless test; ore per minute in the expected range. |
| **4** | **Combat** | Weapons with projectiles, beams, missiles and flak. Health, armour classes, the damage table, explosions, debris and wrecks. An enemy test fleet and a sandbox spawner. | A headless **balance matrix** confirms each counter wins its matchup (e.g. 6 Pickets beat 6 Darts). |
| **5** | **Formations and stances** | Formation bar (Wall, Sphere, Wedge, Column, Ring, Loose) and stance bar (Aggressive, Defensive, Passive). Groups keep formation while moving and turning. Control groups. | Ships hold their slots within tolerance during and after a move; Passive ships never fire. |
| **6** | **Enemy AI and win/lose** | The Cinder Pact AI mines, builds, groups and attacks. Losing a Forge ends the game, with victory and defeat screens. Autopilot and Watch AI. | Self-play: AI-vs-AI matches always end with a winner; easy/normal/hard ordering holds. |
| **7** | **Research, sensors, fog** | A research panel with the tree; unlocks and upgrades take effect. Sensor fog. The Tactical Plot (Tab) with blips, fields and orders. A Wisp scout. | Research unlocks the right hulls; hidden enemies are invisible until in sensor range; the AI researches. |
| **8** | **Polish** | Main menu (skirmish setup, Watch AI), sound pass, HUD polish, tooltips, pause menu, save/load, debug panel, cinematic camera and recording. A final README with every control. | Full browser run through every menu; save, load, and the sync hash matches; no console errors. |

**Not in these milestones** (possible later):

- Multiplayer lobby. The engine and relay will already support it.
- A story campaign.
- Hyperspace-style jumps. These would need a fully original mechanic.
- Salvage or capture.
- Carriers that build fighters away from the Forge.

## 8. Risks and how they are handled

| Risk | Approach |
| --- | --- |
| 3D movement and formations look jittery | The simulation stays integer and deterministic; the renderer interpolates between ticks and adds banking and smoothing on top. |
| Hundreds of ships hurt the frame rate | Instanced meshes for small craft; sensor checks on a timer; a 3D spatial hash for all range queries. |
| 3D move orders are fiddly with a mouse | The disc and height line always show the target; Shift height mode; right-click quick-move at the current height. |
| Balance drifts as content grows | Every number is in YAML; the balance matrix and self-play tests run every milestone. |

## 9. Decisions for you

1. **Names:** the working title *Driftforge*; factions *Meridian Hollow* and *Cinder Pact*; the ship names in §2. Keep, or suggest your own.
2. **Folder:** `/home/user/space-strategy`, next to the existing game. Should it get its own git repository? If so, a new GitHub repo can be attached later, as before.
3. **Scope check:** single-player skirmish against the AI is the target for milestones 1–8. Is that right?
