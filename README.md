# Driftforge

A space survival game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
You command the **Forge**, a kilometre-long foundry-city of the Meridian Hollow, stranded in the Wrack, a galaxy of scrap. Its Skein Drive is broken. Cross the galaxy, keep your people alive, and find the parts to mend it.

See [PLAN.md](PLAN.md) for the full design, the milestone plan and the decisions behind it.

**Status: Milestone 6, places built from data.** The game opens on a start screen. Pick a place to take the Forge to:

- **Scrap Shoal:** ore rocks, dead ships, and sometimes something living in the wrecks;
- **Ore Reef:** rich ore among crystal arches and spires;
- **Ice Tail:** the debris trail of a broken comet, the best place for water;
- **Lantern Mist:** a Glim nebula with fuel and spore drifts, and things that hunt in the haze;
- **Wreck:** one giant derelict and the debris of whatever killed it.

Every place is generated from a template and a seed, so the same seed always gives the same map. The fleet launches from the Forge's hangar when it arrives. Gather what you can, then recall your ships and spool the Skein Drive to leave. A report shows what the visit gained and cost, and the run carries on to the next place with the stores and ships you left with.

The **Proving Grounds** sandbox is still on the start screen, with a panel to call in enemies.

Warships fight with:
- autocannons and plasma charges (fighters);
- flak (corvettes);
- pulse batteries and lances (frigates);
- torpedoes (destroyers).

Each counters something and is countered by something else. Bigger ships leave wrecks behind.

Fleets fly in formation, follow a stance, and can be saved as control groups.

Five resources: **ore** and **ice** (Gleaners mine them from rocks), **salvage** (Shearers cut it from wrecks), and **Glim** fuel and **spores** (Skimmers skim them from clouds).

The galaxy map, and the survival needs (water, air, food, fuel), come in Milestone 7.

## Running the game

You need Node.js 18 or newer. There are no dependencies to install and no build step.

```bash
npm start
```

Then open <http://localhost:8080>. To use another port, set `PORT`, for example `PORT=9000 npm start`.

Any static file server works too, such as `python3 -m http.server`, as long as it serves the project folder.
Opening `index.html` straight from disk (`file://`) does not work, because browsers block ES modules there.

### URL options

| Option | Effect |
| --- | --- |
| `?poi=OreReef&seed=12` or `#OreReef` | Skips the start screen and goes straight to a place (`ScrapShoal`, `OreReef`, `IceTail`, `LanternMist`, `Wreck`), with an optional seed |
| `?grounds` or `#grounds` | Skips the start screen and opens the Proving Grounds |
| `?fleet=test` or `#fleet` | The Proving Grounds, with four Darts and a second Halberd added at the start, so you can try group moves and box selection |
| `?faction=cinder` | In the Proving Grounds, flies the Cinder Pact colours instead of the Meridian Hollow |
| `?seed=123` | Changes the seed for the backdrop and the layout |

For example, <http://localhost:8080/?poi=Wreck&seed=3>. The hash forms (`#Wreck`) work where query strings can't, such as on the published play link.

## Controls

### Camera

| Input | Action |
| --- | --- |
| Right-drag | Rotate around the focus point |
| Scroll | Zoom, from close-up out to a tactical view |
| Middle-drag | Pan |
| `W` `A` `S` `D` or the arrow keys | Pan across the plane |
| `Q` / `E` | Rotate left / right |
| `F` | Focus on the selection and follow it |

After you give a move order, the camera follows the selected ships. Panning breaks the follow, and `F` picks it up again.

### Selecting ships

| Input | Action |
| --- | --- |
| Left-click | Select a ship |
| Right-click one of your ships | Select just that ship |
| `Shift` + left-click | Add a ship to, or remove it from, the selection |
| Left-drag | Box select |
| Double-click | Select a ship and focus on it |
| `Ctrl` + `A` | Select all your ships |
| Left-click a rock | See how much ore it holds |
| `Esc` | Cancel the disc, then close the production panel, then clear the selection |
| `Backspace` / `Delete` | All stop |
| `Home` | Select the Forge and focus on it |

### Plotting a move: the movement disc

1. With ships selected, **right-click empty space** (or press `M`). A disc appears at the fleet's current height.
2. **Move the mouse** to place the destination on the disc. The teal radius line shows the distance.
3. **Hold `Shift` and move the mouse up or down** to raise or lower the point. The amber height line and its tick marks show how far above or below the plane it is. Release `Shift` to keep sliding at the new height.
4. **Left-click** to engage. Right-click or `Esc` cancels.

A readout beside the marker shows the distance and the target altitude. One grid cell is 100 m.

A group of ships that isn't in a formation keeps its rough shape when it moves. To fly in a proper shape, give it a formation (below).

Ships steer round asteroids and round hulls much bigger than their own, such as the Forge and the Smelter, instead of flying through them. Each ship plans a detour past the first thing in its way and re-checks the route every third of a second.

### Production

The Forge builds one ship at a time from its queue. You pay for a ship when you queue it, and get the full cost back if you cancel it.

| Input | Action |
| --- | --- |
| `B` or the **Build** button | Open or close the production panel |
| Click a hull | Queue one |
| `Shift` + click a hull | Queue five |
| Right-click a hull | Take the last one of that type off the queue (refunded) |
| Click a ship in the queue | Cancel it (refunded) |
| `R` or **Set rally point** | Place the rally point with the movement disc (lilac this time): mouse for position, `Shift` for height, left-click to set |
| **Clear** | Remove the rally point |

- **Launching:** a finished ship appears in a bay on the Forge's flank and flies clear of the hull before it takes orders. The bays alternate port and starboard.
- **Rally point:** new ships fly to it and spread into a grid around it. With no rally point they wait beside the bay they left. The lilac beacon and its dashed line show while the Forge is selected or the panel is open.
- **Fleet capacity:** the top bar shows ore and fleet capacity, as used / available. The Forge provides 30. Each hull uses some (see the table below), and ships waiting in the queue count too. When a hull won't fit, its button turns red and says why.
- **Limits:** the queue holds 10 ships. If something can't be queued, a message under the top bar says why: not enough ore, fleet capacity reached, or the queue is full.

### Places and leaving them

- **Arriving:** the Forge stitches in near one edge of the map. Its ships launch from the bays one by one, keeping the hull damage and cargo they had when they came aboard.
- **The top bar** shows the place's name and your five stores.
- **Hovering or selecting** a rock, cloud or wreck shows what it holds. Field labels show how much is left in each field.
- **Hostiles:** some places have Ashen Gaunt raiders or a Gnasher pack. Some lurk and pounce on whatever comes close. Others hunt: after a while they come for the Forge, and a warning shows under the top bar.

The **Skein Drive** panel, bottom right, is how you leave:

| Button | Action |
| --- | --- |
| **Recall all** | Every ship flies home to the nearer bay and goes aboard. Collectors unload their holds into the stores as they come in. |
| **Launch all** | Everything aboard launches again |
| **Spool the Skein** | One minute to spool, then the Forge stitches away. Ships still outside are left behind and lost. Press it again to cancel. |

The panel counts the ships aboard and outside, and warns while ships are still outside during a spool. You can always leave; later, some enemies will be able to interrupt the spool-up.

**The report** lists each store as you arrived, what was gathered, what was spent, and what you leave with. It also lists the ships aboard, built here, destroyed and left behind, and the Forge's hull. **Choose the next place** takes you back to the start screen, which now shows the run's stores and fleet. **Start a new run** resets them.

### Gathering

You start with 1,500 ore, two Gleaners, a Shearer and a Skimmer. Collectors start work as soon as they launch.

| Collector | Gathers | From | Hold |
| --- | --- | --- | --- |
| Gleaner | ore, ice | rocks | 100 |
| Shearer | salvage | wrecks, including the giant hulk at a Wreck | 80 |
| Skimmer | Glim, spores | clouds: it flies into them and fills up | 120 |

A collector carries one kind at a time. Clouds shrink as they are skimmed and disperse when empty; wrecks break apart.

- **Gleaners work on their own.** A new Gleaner launches and starts mining straight away. It picks a good rock nearby (close, rich, and not already taken by another Gleaner), mines until its 100-ore hold is full, and unloads at the nearest Forge or Smelter. Then it heads back out.
- **Docking:** the Forge takes three Gleaners at a time on its furnace maw, at the top of the prow. A Smelter takes two, one on each flank. If every slot is busy, a Gleaner waits above the dock.
- **The top bar** shows your ore, and beside it how much was delivered in the last minute.
- **Fields** are labelled with their name and the ore left. Rocks shrink as they are mined and break apart when empty.
- **Gleaners you move stop mining.** Send them back to work with a right-click on a rock.

| Input (with collectors selected) | Action |
| --- | --- |
| Right-click a rock, wreck or cloud | The collectors that can work it go there. The label reads Mine, Cut or Skim. |
| Right-click the Forge or a Smelter | Come back and unload now, then carry on |

One Gleaner on a near field brings in about 180 ore a minute. Far fields are slow to work from the Forge: build a Smelter, park it beside the field, and the collectors working there unload into it instead.

### Fleet orders: formations, stances and control groups

When you have ships selected, a fleet bar appears at the bottom of the screen.

| Input | Action |
| --- | --- |
| **Formation** buttons, or `T` to cycle | Wall, Sphere, Wedge, Column, Ring, or Loose (no formation) |
| **Stance** buttons, or `V` to cycle | Aggressive, Defensive or Passive |
| `Ctrl` + `1`–`9`, or right-click a group chip | Make the selection a control group |
| `1`–`9`, or click a group chip | Select that group (`Shift` adds it to the selection) |
| `1`–`9` twice | Select the group and jump the camera to it |

- **Formations:**
  - The ships form up where they are, with the biggest ship at the centre (Sphere) or the point (Wedge).
  - When you move the whole group, it flies as one, at the pace of its slowest ship, waiting for stragglers.
  - The shape turns and climbs with the group, and settles facing the way it went.
  - While you plot the move, the disc shows where each ship's slot will be at the destination.
  - Moving only some ships of a group takes them out of it. Loose dissolves the formation.
- **Advancing in formation** (`Ctrl`+click on the disc): the group stops while its aggressive ships fight what they meet, then carries on in formation.
- **Stances:**
  - **Aggressive** ships chase enemies that come close.
  - **Defensive** ships hold position and fire at whatever comes in range.
  - **Passive** ships never fire unless you order an attack, and fly away when shot at.

  Warships start Aggressive, Gleaners and the Smelter Passive, and the Forge Defensive.
- **Control groups** show as numbered chips under the top bar. The number is also drawn on each selected ship's brackets. They are a reliable alternative if your browser keeps `Ctrl` + number for switching tabs.

### Combat

| Input | Action |
| --- | --- |
| Right-click an enemy (with warships selected) | Attack it |
| `Ctrl` + left-click on the movement disc | Advance: fly there, fighting anything met on the way |
| `Backspace` | All stop (also ends an attack) |
| Left-click an enemy or a wreck | Inspect it |

- **On their own:** idle warships engage enemies that come within about 600 m, and fight back when shot. They give up a chase that drags them more than 1.2 km from where they started.
- **Fighters** (Darts, Talons) make attack runs: in fast, weaving, break away, come round. **Bigger ships** hold off at a comfortable range and keep their guns on target.
- **The Forge** never chases anything. Its four point-defence turrets shoot at whatever comes close.
- **Hovering** an enemy shows its faction and hull in red. With warships selected, the label reads "Attack".
- **When ships die:** losses show as a message under the top bar. Fighters break up; anything bigger leaves a charred, drifting **wreck** with salvage in it, for Shearers to cut.

### The Proving Grounds

Choose **Proving Grounds** on the start screen: the Forge, its escorts and two Gleaners beside four asteroid fields. Press `G`, or the **Proving Grounds** button, to open the sandbox panel.

- **Ashen Gaunt:** Darts, Talons, Pickets, Halberds, Spindles, a Sabre, or a mixed raiding party. They appear about 3 km beyond where the camera is looking and advance on your Forge.
- **Drift fauna:** a pack of eight Gnashers, monsters that hunt in packs and bite.
- **Your ships:** test ships appear ahead of the Forge.
- **+2,000 ore** and **Remove hostiles**.

### Other

| Key | Action |
| --- | --- |
| `H` or `?` | Show or hide the controls card |

## The ships in this build

| Ship | Class | Ore | Build | Capacity | Crew | Weapons | Strong against | Weak against |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Forge | Mothership | — | — | provides 30 | — | 4 point-defence turrets | fighters that come close | — |
| Gleaner | Ore and ice collector | 100 | 12 s | 1 | 3 miners | — | — | everything |
| Shearer | Salvage cutter | 120 | 13 s | 1 | 3 miners | — | — | everything |
| Skimmer | Gas collector | 110 | 12 s | 1 | 3 miners | — | — | everything |
| Smelter | Mobile refinery | 600 | 40 s | 4 | 10 engineers | — | — | everything |
| Dart | Interceptor | 60 | 8 s | 1 | 2 pilots | Autocannons (fixed, forward) | Talons, Gnashers | flak |
| Talon | Bomber | 90 | 12 s | 2 | 3 pilots | Plasma charges (fixed, forward) | frigates, capitals | Darts, flak |
| Picket | Flak corvette | 140 | 15 s | 3 | 6 hands | Flak turret | fighters, Gnashers | frigates |
| Halberd | Assault frigate | 450 | 30 s | 6 | 14 hands | Two pulse batteries | corvettes | bombers, destroyers |
| Spindle | Lance frigate | 380 | 28 s | 5 | 12 hands | One long lance (fixed, forward) | capitals | fighters |
| Sabre | Destroyer | 900 | 50 s | 10 | 30 hands | Torpedoes, two pulse batteries | frigates | bombers, Spindles |

Monsters: the **Gnasher**, a pack hunter about the size of a fighter. It bites.

On the voyage you start with the Forge, a Halberd, two Darts, two Gleaners, a Shearer and a Skimmer (12 of 30 capacity). Everything can be built from the start for now; blueprints arrive in Milestone 11.

How it works:
- **Armour and damage.** Ships have one of four armour classes: light, medium, heavy and capital. Each weapon does more or less damage to each class.
- **Aim.** Shots fly where the target is going to be, and can miss a ship that turns away. Heavy batteries only partly lead their target, so they struggle against weaving fighters.
- **Where the numbers live.** Every number is in `content/core/rules/weapons.yaml` and `content/core/rules/combat.yaml`.

## Development

```bash
npm test
```

Runs the headless tests:

- **Flight trials** (`tools/flighttest.js`): every hull, Forge included, flies to points ahead, behind, straight up, straight down, on a diagonal and a short hop away. The trials check arrival, accuracy and time, plus a determinism check and a group move.
- **Production** (`tools/productiontest.js`): checks that:
  - ships launch exactly on their build time, from the right bay, even while the Forge turns;
  - ships clear the hull, then reach their muster slot or the rally point;
  - fleet capacity, ore and the queue limit refuse what they should;
  - cancelling refunds in full, and a destroyed Forge refunds its queue;
  - the Forge is never shoved by its own ships;
  - two identical runs give the same sync hash.
- **Mining** (`tools/miningtest.js`): checks that:
  - a Gleaner goes through every stage: heading out, mining, returning, docking, unloading and undocking, and sits exactly on its dock slot while unloading;
  - ore is conserved, with field ore lost = ore banked + ore aboard;
  - one Gleaner on the near field brings in 120–220 ore a minute;
  - several Gleaners spread over the rocks, and no more than three dock at once;
  - rocks break up when empty, and a Gleaner with nothing left to mine goes idle;
  - a Smelter parked by a far field takes the deliveries, and a docked Gleaner rides along when the Forge moves;
  - move, mine and unload-now orders work, and a new Gleaner starts mining by itself;
  - the Forge's hull is a long capsule, and rocks are solid;
  - two identical runs give the same sync hash.
- **Avoidance** (`tools/avoidtest.js`): checks that:
  - every hull steers round a big rock dead ahead, and the smaller hulls thread a dense field without touching a rock;
  - ships fly across, along and diagonally over the Forge without scraping its hull;
  - a Gleaner coming home from behind the Forge flies round it to the furnace maw;
  - four Gleaners mining for four minutes scrape a rock or a hull in under 1% of their moving ticks (the result is 0);
  - two identical runs give the same sync hash.
- **Combat** (`tools/combattest.js`): checks that:
  - damage follows the armour table exactly;
  - shots hit a target holding still and mostly miss a fighter crossing at full speed;
  - flak hits several fighters at once, and torpedoes chase a moving frigate;
  - fixed guns only fire forward, while turrets fire all round;
  - kills remove the ship and big hulls leave a solid wreck worth 40% of their cost;
  - targeting, leashes, attack orders, Stop and advancing all work;
  - the Forge's point defence fires without the Forge moving;
  - a 40-a-side battle is deterministic and takes about 0.2 ms per tick.
- **Formations** (`tools/formationtest.js`): checks that:
  - slots never overlap, in any formation of 2 to 24 ships;
  - every formation forms up, holds its shape on a 6.5 km curving climb (about 30 units off-slot on average), keeps to the slowest ship's pace, and settles facing the way it went;
  - groups re-shape when a ship dies, ships leave when ordered off alone, and Loose dissolves the group;
  - stances work: Passive never fires and flees, Defensive fires without chasing, and Aggressive chases;
  - an advancing wedge destroys an enemy in its path and re-forms;
  - two identical runs give the same sync hash.
- **Places** (`tools/poitest.js`): checks that:
  - every template gives exactly the same map for the same seed, a different map for a different seed, and no field on top of the Forge's arrival point;
  - every place type builds what its layout promised, and the fleet launches from the hangar;
  - every resource kind can be gathered;
  - Recall brings every ship aboard, keeping hull damage, and collectors unload as they come in;
  - the Skein spools for a full minute, then the Forge leaves; ships outside are left behind;
  - the report accounts for every unit of every store (end = start + every change, kind by kind) and lists what was built;
  - the next place starts with exactly the fleet that was aboard and the stores that were left;
  - hunting packs wait out their delay, then come for the Forge;
  - a Dart crosses the giant hulk without touching it;
  - two identical visits give the same sync hash.
- **Balance** (`tools/balancetest.js`): cost-matched battles, each fought twice with the sides swapped. The counter has to win both, keeping at least 25% of its value:
  - Pickets beat Darts;
  - Halberds beat Pickets;
  - Talons beat Halberds;
  - Darts beat Talons;
  - a Sabre beats Halberds;
  - Spindles beat a Sabre;
  - Darts beat Spindles;
  - Pickets beat a Gnasher pack.

```bash
npm run check
```

Lints the simulation folders (`src/engine`, `src/traits`, `src/activities`, `src/galaxy`) for anything that would break determinism, such as `Math.random`, `Math.sin` or `Date`. `npm test` runs it first.

### Content packs

Everything the game is made of lives in **content packs**, so new content (and later DLC) can be added without touching the code. The core pack is `content/core/`:

```
content/core/pack.yaml          the manifest: which files hold rules, weapons, resources and place types
content/core/rules/*.yaml       factions, ships, warships, fauna, deposits, combat fits
content/core/rules/weapons.yaml weapons
content/core/resources.yaml     the five resources: name, description, colour, order
content/core/poi-types.yaml     place templates: size, sky, rock fields, wrecks, the hulk, clouds,
                                crystal formations, nebulae, encounters and names (the format is
                                documented at the top of the file)
```

Packs listed after the core pack are merged on top of it, so a pack can add a place type or change one value of an existing ship. When the game loads, every reference is checked: a place that asks for an unknown resource or ship, or a collector that gathers an unknown resource, stops it with a message naming the file.

### Project layout

```
index.html            page, styles and HUD markup
lib/                  three.js (vendored, r160)
content/core/          the core content pack (see above)
src/engine/           deterministic core: world, actors, traits, orders, lockstep, integer maths,
                      steering (avoid.js), weapons and projectiles (weapons.js), content packs
                      (content.js), the place generator (poi.js)
src/traits/           gameplay traits (Flight, ProductionQueue, Collector, Asteroid, Cloud, Armament,
                      Attacks, AutoTarget, Stance, Formations, Wreck, PointLayout, Hangar, Skein, ...)
src/activities/       per-actor tasks (FlyTo, Launch, Harvest, DeliverOre, Attack, AttackMove,
                      FormationMove, DockHangar)
src/galaxy/           the run: stores, fleet and visits carried from place to place (run.js)
src/render/           three.js scene: space backdrop, procedural ships, rocks, clouds, crystal, nebulae,
                      wrecks, combat effects
src/ui/               orbit camera, movement disc, input, HUD, audio
tools/                dev server, headless tests, determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
