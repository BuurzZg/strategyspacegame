# Driftforge

A real-time 3D space strategy game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
Two rival Forge fleets, the **Meridian Hollow** and the **Cinder Pact**, mine and fight inside the Drift, the debris ring around the star Orrin.

See [PLAN.md](PLAN.md) for the full design, the ship roster and the milestone plan.

**Status: Milestone 2, the Forge and production.** You command your Forge, the kilometre-long mothership, and build a fleet from it.
New ships launch from bays on its flanks and fly to your rally point. Mining, combat and the AI come in later milestones.

There is no mining yet, so you start with 2,500 ore and spend it down. Milestone 3 adds the Gleaners that bring more in.

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

### Other

| Key | Action |
| --- | --- |
| `H` or `?` | Show or hide the controls card |

## The ships in this build

| Ship | Class | Ore | Build time | Capacity | Handling |
| --- | --- | --- | --- | --- | --- |
| Forge | Mothership | — | — | provides 30 | Immense and slow. Turns in place; about 24 m/s flat out |
| Halberd | Assault frigate | 450 | 30 s | 6 | Heavy. Turns in place before it accelerates, and needs a long distance to stop |
| Picket | Flak corvette | 140 | 15 s | 3 | Steady mid-weight gunboat |
| Talon | Bomber | 90 | 12 s | 2 | Quick, but heavier in the turn than a Dart |
| Dart | Interceptor | 60 | 8 s | 1 | Fast and nimble. It never fully stops while cruising, so it banks through its turns |

You start with the Forge, a Halberd and two Darts (8 of 30 capacity). Weapons arrive in Milestone 4.

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
src/traits/           gameplay traits (Flight, ProductionQueue, LaunchBay, FleetCapacity, ...)
src/activities/       per-actor tasks (FlyTo, Launch, ...)
src/render/           three.js scene: space backdrop, procedural ships, effects
src/ui/               orbit camera, movement disc, input, HUD, audio
tools/                dev server, headless tests, determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
