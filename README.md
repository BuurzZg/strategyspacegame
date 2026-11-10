# Driftforge

A real-time 3D space strategy game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
Two rival Forge fleets, the **Meridian Hollow** and the **Cinder Pact**, mine and fight inside the Drift, the debris ring around the star Orrin.

See [PLAN.md](PLAN.md) for the full design, the ship roster and the milestone plan.

**Status: Milestone 1, flight trials.** You get a camera, the movement disc with its height line, and ships that fly in full 3D.
Production, mining, combat and the AI come in later milestones.

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
| `?fleet=test` or `#fleet` | Adds four Darts and a second Halberd, so you can try group moves and box selection |
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
| `Esc` | Clear the selection |
| `Backspace` / `Delete` | All stop |

### Plotting a move: the movement disc

1. With ships selected, **right-click empty space** (or press `M`). A disc appears at the fleet's current height.
2. **Move the mouse** to place the destination on the disc. The teal radius line shows the distance.
3. **Hold `Shift` and move the mouse up or down** to raise or lower the point. The amber height line and its tick marks show how far above or below the plane it is. Release `Shift` to keep sliding at the new height.
4. **Left-click** to engage. Right-click or `Esc` cancels.

A readout beside the marker shows the distance and the target altitude. One grid cell is 100 m.

Groups keep their spacing when they move. Proper formations arrive in Milestone 5.

### Other

| Key | Action |
| --- | --- |
| `H` or `?` | Show or hide the controls card |

## The ships in this build

| Ship | Class | Handling |
| --- | --- | --- |
| Halberd | Frigate | Heavy. Turns in place before it accelerates, and needs a long distance to stop |
| Dart | Fighter | Fast and nimble. It never fully stops while cruising, so it banks through its turns |

## Development

```bash
npm test
```

Runs the headless flight trials. Both hulls fly to points ahead, behind, straight up, straight down, on a diagonal and a short hop away, and the trials check arrival, accuracy and time. They also check that two identical runs give the same sync hash, and that a group move works.

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
src/traits/           gameplay traits (Flight, Health, Tooltip, ...)
src/activities/       per-actor tasks (FlyTo, ...)
src/render/           three.js scene: space backdrop, procedural ships, effects
src/ui/               orbit camera, movement disc, input, HUD, audio
tools/                dev server, headless tests, determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
