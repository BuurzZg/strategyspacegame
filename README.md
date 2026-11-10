# Driftforge

A space survival game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
You command the **Forge**, a kilometre-long foundry-city of the Meridian Hollow, stranded in the Wrack, a galaxy of scrap. Its Skein Drive is broken. Cross the galaxy, keep your people alive, and find the parts to mend it.

See [PLAN.md](PLAN.md) for the full design, the milestone plan and the decisions behind it.

**Status: Milestone 5, formations and stances, in the Proving Grounds.** The game opens in the Proving Grounds, a testing sandbox. You get the Forge, its escorts, Gleaners mining four asteroid fields, and a panel to call in enemies.

Warships fight with:
- autocannons and plasma charges (fighters);
- flak (corvettes);
- pulse batteries and lances (frigates);
- torpedoes (destroyers).

Each counters something and is countered by something else. Bigger ships leave wrecks behind.

Fleets fly in formation, follow a stance, and can be saved as control groups.

The galaxy map and the survival voyage come in later milestones.

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
| `?fleet=test` or `#fleet` | Adds four Darts and a second Halberd at the start, so you can try group moves and box selection |
| `?faction=cinder` | Flies the Cinder Pact colours instead of the Meridian Hollow |
| `?seed=123` | Changes the seed for the backdrop and the asteroid layout |

For example, <http://localhost:8080/?fleet=test>.

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

### Mining

You start with 1,500 ore and two Gleaners. Both start mining as soon as the game begins.

- **Gleaners work on their own.** A new Gleaner launches and starts mining straight away. It picks a good rock nearby (close, rich, and not already taken by another Gleaner), mines until its 100-ore hold is full, and unloads at the nearest Forge or Smelter. Then it heads back out.
- **Docking:** the Forge takes three Gleaners at a time on its furnace maw, at the top of the prow. A Smelter takes two, one on each flank. If every slot is busy, a Gleaner waits above the dock.
- **The top bar** shows your ore, and beside it how much was delivered in the last minute.
- **Fields** are labelled with their name and the ore left. Rocks shrink as they are mined and break apart when empty.
- **Gleaners you move stop mining.** Send them back to work with a right-click on a rock.

| Input (with Gleaners selected) | Action |
| --- | --- |
| Right-click a rock | Mine that rock |
| Right-click the Forge or a Smelter | Come back and unload now, then carry on mining |

One Gleaner on the nearest field brings in about 180 ore a minute. The far field, Ostrel Deep, is the richest, but the round trip from the Forge is long. Build a Smelter, park it beside that field, and the Gleaners mining there unload into it instead.

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
- **When ships die:** losses show as a message under the top bar. Fighters break up; anything bigger leaves a charred, drifting **wreck** with salvage in it. Salvage can be collected from Milestone 6.

### The Proving Grounds

Press `G`, or the **Proving Grounds** button, to open the sandbox panel.

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
| Gleaner | Ore collector | 100 | 12 s | 1 | 3 miners | — | — | everything |
| Smelter | Mobile refinery | 600 | 40 s | 4 | 10 engineers | — | — | everything |
| Dart | Interceptor | 60 | 8 s | 1 | 2 pilots | Autocannons (fixed, forward) | Talons, Gnashers | flak |
| Talon | Bomber | 90 | 12 s | 2 | 3 pilots | Plasma charges (fixed, forward) | frigates, capitals | Darts, flak |
| Picket | Flak corvette | 140 | 15 s | 3 | 6 hands | Flak turret | fighters, Gnashers | frigates |
| Halberd | Assault frigate | 450 | 30 s | 6 | 14 hands | Two pulse batteries | corvettes | bombers, destroyers |
| Spindle | Lance frigate | 380 | 28 s | 5 | 12 hands | One long lance (fixed, forward) | capitals | fighters |
| Sabre | Destroyer | 900 | 50 s | 10 | 30 hands | Torpedoes, two pulse batteries | frigates | bombers, Spindles |

Monsters: the **Gnasher**, a pack hunter about the size of a fighter. It bites.

You start with the Forge, a Halberd, two Darts and two Gleaners (10 of 30 capacity). Everything can be built from the start for now; blueprints arrive in Milestone 11.

How it works:
- **Armour and damage.** Ships have one of four armour classes: light, medium, heavy and capital. Each weapon does more or less damage to each class.
- **Aim.** Shots fly where the target is going to be, and can miss a ship that turns away. Heavy batteries only partly lead their target, so they struggle against weaving fighters.
- **Where the numbers live.** Every number is in `rules/weapons.yaml` and `rules/combat.yaml`.

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

Lints the simulation folders (`src/engine`, `src/traits`, `src/activities`) for anything that would break determinism, such as `Math.random`, `Math.sin` or `Date`.

### Project layout

```
index.html            page, styles and HUD markup
lib/                  three.js (vendored, r160)
rules/*.yaml          factions, ships, warships, fauna, weapons, and combat fits layered onto the hulls
src/engine/           deterministic core: world, actors, traits, orders, lockstep, integer maths,
                      steering (avoid.js), weapons and projectiles (weapons.js)
src/traits/           gameplay traits (Flight, ProductionQueue, Collector, Armament, Attacks, AutoTarget,
                      Stance, Formations, Wreck, ProvingGrounds, ...)
src/activities/       per-actor tasks (FlyTo, Launch, Harvest, DeliverOre, Attack, AttackMove, FormationMove)
src/render/           three.js scene: space backdrop, procedural ships, asteroids and wrecks, combat effects
src/ui/               orbit camera, movement disc, input, HUD, audio
tools/                dev server, headless tests, determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
