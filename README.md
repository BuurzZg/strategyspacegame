# Driftforge

A real-time 3D space strategy game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
Two rival Forge fleets, the **Meridian Hollow** and the **Cinder Pact**, mine and fight inside the Drift, the debris ring around the star Orrin.

See [PLAN.md](PLAN.md) for the full design, the ship roster and the milestone plan.

**Status: Milestone 3, collectors and mining.** You command your Forge, the kilometre-long mothership, beside four asteroid fields.
Gleaners mine the rocks and unload into the Forge's furnace, and that ore pays for the fleet you build. A Smelter, a mobile refinery, shortens the trip to distant fields.
Combat, formations and the AI come in later milestones.

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

Groups keep their spacing when they move. Proper formations arrive in Milestone 5.

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

### Other

| Key | Action |
| --- | --- |
| `H` or `?` | Show or hide the controls card |

## The ships in this build

| Ship | Class | Ore | Build time | Capacity | Handling |
| --- | --- | --- | --- | --- | --- |
| Forge | Mothership | — | — | provides 30 | Immense and slow. Turns in place; about 24 m/s flat out |
| Gleaner | Ore collector | 100 | 12 s | 1 | Mines and hauls on its own |
| Smelter | Mobile refinery | 600 | 40 s | 4 | Slow barge; Gleaners unload into it |
| Halberd | Assault frigate | 450 | 30 s | 6 | Heavy. Turns in place before it accelerates, and needs a long distance to stop |
| Picket | Flak corvette | 140 | 15 s | 3 | Steady mid-weight gunboat |
| Talon | Bomber | 90 | 12 s | 2 | Quick, but heavier in the turn than a Dart |
| Dart | Interceptor | 60 | 8 s | 1 | Fast and nimble. It never fully stops while cruising, so it banks through its turns |

You start with the Forge, a Halberd, two Darts and two Gleaners (10 of 30 capacity). Weapons arrive in Milestone 4.
The Smelter can be built from the start for now; from Milestone 7 it will need research first.

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

```bash
npm run check
```

Lints the simulation folders (`src/engine`, `src/traits`, `src/activities`) for anything that would break determinism, such as `Math.random`, `Math.sin` or `Date`.

### Project layout

```
index.html            page, styles and HUD markup
lib/                  three.js (vendored, r160)
rules/*.yaml          factions, ship stats and handling
src/engine/           deterministic core: world, actors, traits, orders, lockstep, integer math
src/traits/           gameplay traits (Flight, ProductionQueue, Collector, OreDropoff, Asteroid, ...)
src/activities/       per-actor tasks (FlyTo, Launch, Harvest, MineAsteroid, DeliverOre)
src/render/           three.js scene: space backdrop, procedural ships and asteroids, effects
src/ui/               orbit camera, movement disc, input, HUD, audio
tools/                dev server, headless tests, determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
