# Driftforge

A space survival game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
You command the **Forge**, a kilometre-long foundry-city of the Meridian Hollow, stranded in the Wrack, a galaxy of scrap. Its Skein Drive is broken. Cross the galaxy, keep your people alive, and find the parts to mend it.

See [PLAN.md](PLAN.md) for the full design, the milestone plan and the decisions behind it.

**Status: Milestone 12, the first full run.** Start a new voyage from the title screen and choose:

- **the length:** a full voyage (about 300 places, four to six hours) or a short one (about 120 places, an hour and a half);
- **saving:** permanent death (save and quit any time; the save is gone when the voyage ends) or free saves (named saves, anywhere);
- **a guided first voyage:** hint cards at the right moments.

You can save on a map as well as on the star chart; loading a map rebuilds it and replays your orders exactly. The Forge is your base: upgrade it with eleven engineering projects. Ships that survive earn experience and ranks, which they keep in the hangar from place to place. See [Starting a voyage and saving](#starting-a-voyage-and-saving) and [Veterans and the Forge](#veterans-and-the-forge).

**Milestone 11, sensors, fog and engineering:** Maps on the voyage have sensor fog: you see other ships only within your own ships' sensor range, and they see you the same way. Press `Tab` for the Tactical Plot. Build the new Wisp scout to see further. Some hulls need blueprints, and engineering projects upgrade the Forge. See [Sensors, blueprints and engineering](#sensors-blueprints-and-engineering).

**Milestone 10, events, monsters and the story:** A voyage now opens with a prologue, and each drive part has its story: arriving at its derelict, finding it, fitting it. The ending plays when the Forge jumps home. Random events happen out there: distress calls (some are lures), drifting pods, comet storms, strange signals, stowaways, spore blooms. On maps, Scrapwyrms lie buried in rock fields, rust mites hatch from infested wrecks, and the Hollowhorn's song shakes a spooling Skein loose. See [Events and monsters](#events-and-monsters).

**Milestone 9, diplomacy and trade:** Hail a faction where it holds the Forge's place, or hail one of its ships or stations on a map: talk, trade, hire crew and ships, buy charts, pay tribute, and make or break treaties. See [Comms and trade](#comms-and-trade).

**Milestone 8, factions and reputation:** Five factions claim parts of the Wrack, with stations at their seats: the Rivet Moot's hull-towns, the Lantern Synod's refineries, the Ashen Gaunt's dens, the Cinder Pact's holds and the Choir's blooms. How they treat you on a map depends on your standing with them, and what you do there changes it. See [Factions and standing](#factions-and-standing).

**Milestone 7, the voyage:** Start a **new voyage** from the title screen. Each one is a new seeded galaxy of about 300 places in four regions, ringed round the dead star Orrin:

- **the Drift**, where you start;
- **the Middens**, out of reach until the drive's Threadwound Coils are mended;
- **the Hush**, behind the Veil, a nebula wall only the Stillwater Lens can stitch through;
- **the Shore**, the Wrack's outer edge, which needs the Anchor Spindle's long stitches. From its edge, with the Heartstone fitted, the Forge can jump home.

On the **star chart**, time stands still until you act. Every stitch costs Glim and days, and every day the crew drink, eat and breathe. Go in to a place to play it: gather, build, fight, then recall your ships and spool the Skein to leave. Find the drive's four parts in derelicts, fit them, and get to the Shore before the water, food or air runs out.

Places come from templates and a seed: **Scrap Shoal**, **Ore Reef**, **Ice Tail** (water), **Lantern Mist** (Glim and spores), **Wreck**, and **Still Water** (a quiet place to rest). Deeper regions are more dangerous; a place visited again yields less.

**Practice** (a single place, no day clock) and the **Proving Grounds** sandbox are still on the title screen.

Warships fight with:
- autocannons and plasma charges (fighters);
- flak (corvettes);
- pulse batteries and lances (frigates);
- torpedoes (destroyers).

Each counters something and is countered by something else. Bigger ships leave wrecks behind.

Fleets fly in formation, follow a stance, and can be saved as control groups.

Five resources: **ore** and **ice** (Gleaners mine them from rocks), **salvage** (Shearers cut it from wrecks), and **Glim** fuel and **spores** (Skimmers skim them from clouds).

Named crew members with traits come in Milestone 13.

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
| `?voyage=5` or `#voyage` | Skips the title and starts a new voyage (with that galaxy seed; add `&short` for a short voyage, `&guided` for hint cards) |
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

### Starting a voyage and saving

- **New voyage** opens the setup:
  - **Full voyage:** about 300 places, four to six hours.
  - **Short voyage:** about 120 places in the same four regions, with the drive's parts nearer each other, fuller stores at the start, cheaper fitting and one-day stitches. About an hour and a half.
  - **Permanent death:** one save. Save and quit any time, on the chart or on a map; the save is removed when the voyage ends.
  - **Free saves:** **Save…** (on the chart and on maps) makes a named save, and **Load a save** on the title screen lists them. The voyage also autosaves, so **Continue** always works.
  - **Guide me through my first voyage:** short hint cards the first time each thing comes up (the chart, planning a stitch, going in, the foundry, spooling, the report, running low, a faction's claim).
  - **Galaxy seed:** blank for a random one.
- **Saving on a map** stores the voyage and the map's orders so far. Loading rebuilds the map from the voyage and replays the orders, so it comes back exactly as it was.
- There is no difficulty setting. The pressure is survival (water, food, air, Glim) and what is out there.

### Veterans and the Forge

- **Ranks:** a ship earns experience for every enemy it destroys (more for bigger ones), and a point each time it comes home from a visit where it fought. Ranks: **Seasoned** (4), **Veteran** (10), **Elite** (20); each adds 10% damage and hull. Chevrons over the selection brackets show the rank; the selection card shows it with the experience; the **Crew** tab lists the hangar with ranks and hull.
- **The hangar carries them:** recall a ship and it keeps its experience and damage until the next place. Lose it and the rank is gone with it.
- **Mending:** ships aboard mend 5% of their hull a day; repair bays make it 20%.
- **Forge upgrades** (the Forge tab, Engineering), built with ore, salvage, days and free engineers:

| Upgrade | What it does | Needs |
| --- | --- | --- |
| Expanded hangar | +10 fleet capacity | |
| Second hangar | +10 more | Expanded hangar |
| Repair bays | Ships aboard mend 20% a day instead of 5% | |
| Foundry line | Ships are built 30% faster | |
| Fire control | The Forge's own guns do 40% more damage | |
| Launch rails | The fleet launches twice as fast on arrival | |
| Hydroponic racks | Hydroponics grow 50% more | |
| Long-range array | Sensors reach 50% further | |
| Glim recycler | Stitches cost 20% less Glim | |
| Armoured plating | +25% hull | |
| Heavy plating | +25% hull again | Armoured plating |

### The voyage: the star chart

The chart is a 3D view of the galaxy, a mostly flat disc. Each region is ringed in its colour, and the Veil is a band of violet haze.

| Input | Action |
| --- | --- |
| Click a place | Its card: what is known, and the route there |
| `Enter` | The card's first action: stitch there, or go in |
| Right-drag, scroll | Rotate, zoom |
| Drag, `W A S D` | Pan |
| `F` or `Home` | Back to the Forge |

- **What you see:** places are points, coloured by kind once the sensors have seen them (grey until then). Teal lanes are stitches the drive can make now. The teal ring round the Forge is the drive's reach, and the dashed ring the sensors'. A gold ring marks the drive part the engineers have a fix on.
- **The card** shows the route (stitches, days, Glim, distance) and what you will have on arrival. With no Glim, the Forge can **drift** one lane at sub-light, slowly. At the Forge's place, **Go in** plays the map, and **Rest a day** raises morale (twice as much in still water).
- **The top bar** shows the day, the stores (water, food and air with the days they will last), the crew and morale.
- **The Forge panel:**
  - **Forge:** the Skein Drive's reach and its four parts, with **Fit it**; the hull and six systems (drive, reactor, life support, hydroponics, foundry, sensors), each with **Repair** (a day's work by the free engineers, for ore and salvage);
  - **Crew:** morale, and engineers, pilots, miners and hands (aboard, flying ships, free);
  - **Hold:** every store, its change per day, and how long it lasts;
  - **Log:** what has happened.
- **Save and quit** at any time. **Permanent death:** the save is removed when the voyage ends. (A visit in progress is not saved: continuing returns to the chart as it was before going in.)

### Staying alive

- **Every day** (each stitch takes one to three; on a map, one day passes every four minutes) 150 crew need 90 water, 120 food and 150 air.
- **Life support** makes air from water. The **hydroponics** grow food from water, and much faster with **spores**. Ice from Ice Tails is the water.
- **Glim** runs the drive: about 6 per 10 spans of stitch, and a little each day for the reactor. Lantern Mists are full of it.
- **When things run short:**
  1. a store under three days' need lowers morale;
  2. with no water, no air or food is made;
  3. with no food, 2% of the crew die each day;
  4. with no air, 8% die each day, and three days without air ends the voyage.
- **The voyage also ends** if the crew reaches zero or the Forge is destroyed on a map.
- **Morale** drifts toward how things are. Below 30, work is slower; below 15, people take the pods and leave.
- **The Forge's systems** wear down when its hull is damaged on a map. A damaged reactor slows everything; a damaged drive reaches less far and spools slower; a damaged foundry builds slower.
- **Crew:** building a ship takes its crew from the free crew. When a ship is destroyed, half its crew get away in pods; ships left behind take all theirs.

### The drive's parts

| Part | Where | Opens |
| --- | --- | --- |
| Threadwound Coils | a derelict in the Drift | stitches of 150 spans: the Middens |
| Stillwater Lens | a derelict in the Middens | stitches through the Veil: the Hush |
| Anchor Spindle | a derelict in the Hush | stitches of 200 spans: the Shore |
| Heartstone | a derelict deep in the Shore | the final jump, from the Shore's edge |

The engineers have a fix on one part at a time: the gold ring. Go in and cut into the derelict's hulk with Shearers until they find it. Then fit it from the Forge panel (ore, salvage, days and free engineers). Later milestones add other ways to get them: quests, trade and fights with factions.

### Factions and standing

| Faction | Race | You start | Where |
| --- | --- | --- | --- |
| Rivet Moot | Hullborn | Friendly (30) | hull-towns in the Drift and the Middens |
| Lantern Synod | Tallowfolk | Neutral (0) | Glim refineries in the Middens and the Hush |
| Ashen Gaunt | Gaunt | Hostile (−60) | dens from the Middens to the Shore |
| Cinder Pact | Humans | Wary (−20) | holds in the Hush and on the Shore |
| The Choir | Choirmoths | Neutral (0) | blooms in the Middens and the Hush |

- **On the star chart,** a place a faction claims has a ring in its colour; its seat (a station) is drawn larger. The place card says whose it is, how they feel about you, and whether you have their leave to mine there. The **Standing** tab lists every faction and race.
- **On a map,** a faction's ships and station behave by your tier with them:

| Tier | Standing | They |
| --- | --- | --- |
| Hostile | −100 to −51 | attack on sight; some hunt the Forge |
| Wary | −50 to −11 | warn you off when you come within about 1.6 km, and open fire if you stay within 900 m for 20 seconds |
| Neutral | −10 to 24 | ignore you |
| Friendly | 25 to 59 | turn on whoever attacks your ships near them |
| Allied | 60 and up | fight at your side, and come to guard the Forge |

- **What changes standing** (all in `content/core/factions.yaml`):
  - firing on one of their ships: −10 a ship, and they fight back for the rest of the visit;
  - destroying a ship: −25; a station: −60;
  - taking ore, ice, salvage, Glim or spores from their claim without leave, where their ships or station can see it: the first load gets a warning, then −1 a load;
  - destroying their enemies where they can see it: +2 a kill, up to +15 a visit.
- **Leave:** the Rivet Moot, the Synod and the Cinder Pact let you mine their claims from Friendly; the Choir from Neutral; the Gaunt only if you are Allied.
- **Declaring war:** `Ctrl` + right-click a ship you are not at war with to attack it.
- **Races:** a faction you have not met starts where you stand with its race: the average of that race's factions you have met.
- **Monsters** (Gnashers) have no standing and fight everyone.

### Comms and trade

- **Hailing:** on the star chart, at a place a faction holds, **Hail** (or `C`) on the place card. On a map, select one of their ships or their station and press **Hail** (or `C`); the map waits while you talk.
- **The comms panel** shows what they say and your choices (number keys pick them). What you can say depends on your standing, whether this is their station, whether you are at war on the map, and the treaties you have. Choices you cannot pay for are shown, with what you are short of.
- **Trade** (at their station, Neutral or better) is barter: there is no money in the Wrack. Every good has a value. Pick what you take and what you give; the deal is fair when what you give is worth at least what they ask.
  - Prices follow your standing: 30% dearer when they are Hostile or Wary, 10% when Neutral, at value when Friendly, 30% cheaper when Allied. What they pay you moves the other way.
  - Prices rise as their stock runs down (up to +50% at zero), and stock comes back a little each day.
  - They pay 70% of value for goods they want, 30% for the rest.
  - Every deal raises your standing by 1.
- **Hiring** (at their station): crew by role, and crewed hulls (Rivet Moot: Darts, Pickets, Gleaners, Shearers; Cinder Pact: Talons, Halberds, Spindles; Ashen Gaunt: Darts and Talons, if you are Friendly). A hull needs room in the hangar.
- **Information:** a survey (every place within two stitches) or a chart (the whole region).
- **Treaties:**

| Treaty | Lasts | What it does |
| --- | --- | --- |
| Tribute | 15 days | Paid to the Ashen Gaunt: they hold their fire |
| Ceasefire | 10 days | Mid-fight on a map: they stand down now |
| Peace | 30 days | Amends with a faction that is Wary or Hostile: no fighting |
| Leave | 20 days | You may mine and salvage their claims without it costing standing |

  Firing on a faction while a treaty holds breaks it: −40 standing, and war for the rest of the visit.
- **Threats:** if your armed ships frighten them, they hand over goods (−10 standing); if not, it costs you (−15), and on a map they open fire.

### Sensors, blueprints and engineering

(The table of upgrades is under [Veterans and the Forge](#veterans-and-the-forge).)

- **Sensor fog** (maps on the voyage, and practice): you see other ships and stations only within sensor range of one of your own. Most ships see about 900 m, a Halberd 1.1 km, a Sabre 1.2 km, the Forge 1.6 km, a Wisp 2.6 km. Inside a nebula, seeing and being seen both happen at half range. What cannot be seen cannot be targeted, by you or by anyone else. A faint red diamond marks where a hostile was last seen.
- **The Tactical Plot** (`Tab`): the whole map from above. It shows your ships and their sensor reach, what you can see, last-seen marks, deposits, wrecks and nebulae. Click to look there.
- **The Wisp:** a fast, unarmed scout (80 ore, 1 pilot) with three times a warship's sensor range.
- **Deep scan** (star chart, at the Forge's place): a day and 40 Glim to reveal every place within twice the sensor range.
- **Blueprints:** the foundry starts able to build Darts, Pickets, Halberds, Gleaners, Shearers, Skimmers, Smelters and Wisps. **Talons, Spindles and Sabres need blueprints:**
  - cut half the salvage out of a wreck of that hull;
  - buy one (Rivet Moot and Ashen Gaunt: Talon; Cinder Pact: Spindle and Sabre);
  - or find one in an old archive.
- **Engineering projects** (the Forge tab), built with ore, salvage, days and free engineers:

| Project | What it does |
| --- | --- |
| Expanded hangar | +10 fleet capacity |
| Hydroponic racks | Hydroponics grow 50% more |
| Long-range array | Sensors reach 50% further, on the chart and on maps |
| Glim recycler | Stitches cost 20% less Glim |
| Armoured plating | The Forge's hull is 25% stronger |

### Events and monsters

- **Events** show on the star chart as a panel with a gold edge, and must be answered. They happen:
  - at the start of a voyage (the prologue);
  - on arriving somewhere;
  - during a stitch;
  - on a day of rest;
  - on finding or fitting a drive part;
  - at the final jump (the ending).

  Story events happen once. A trigger brings at most one chance event, decided by the voyage's seed, the day and the place.
- Some events leave something waiting **on the next map at that place**: a distress call that was a lure (Ashen Gaunt hunters), or a sign of a Scrapwyrm. Stitch away and it is gone.
- **Scrapwyrm:** lies buried in a rock field, unseen and untargetable, until a ship comes within about 600 m; then it surfaces and bites. Alone for 30 seconds, it burrows again. Some Scrap Shoals have one.
- **Rust mites:** some wrecks in Scrap Shoals are infested. Cutting one hatches four swarms that chew on hulls.
- **The Hollowhorn:** a leviathan the size of a Forge, in the Hollowhorn Grounds of the Hush and the Shore (rich in Glim and ice). While it is within about 2.6 km of the Forge, its song shakes a spooling Skein loose and the spool starts again. Lead it away or get clear of it before you leave.
- **Other ways to the drive's parts:** once the Choir have told you about the Skein and you are Friendly, they will part with a Stillwater Lens at one of their blooms. The Ashen Gaunt, if you are Neutral with them and the Lens is fitted, sell an Anchor Spindle at their dens.

### Places and leaving them

- **Arriving:** the Forge stitches in near one edge of the map. Its ships launch from the bays one by one, keeping the hull damage and cargo they had when they came aboard.
- **The top bar** shows the place's name, the day on the voyage, how long the scarcest of water, food and air will last (when under ten days), and your five map stores.
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
- **The voyage** (`tools/voyagetest.js`): checks that:
  - the galaxy is the same for the same seed, about 300 places in four regions, every place reachable;
  - each region opens at its own drive level, all of it, and not before; each part lies where the drive that can fetch it reaches;
  - one day's water, food, air and Glim exactly; the starvation ladder (no food, no water then no air, low stores, no crew);
  - stitching (Glim and days), range, the Veil, a damaged or wrecked drive, drifting without Glim;
  - repairs, fitting a part, the final jump;
  - on a map: building takes crew, a relic found by cutting a hulk, pods, ships left behind, days passing, system wear, places yielding less when visited again;
  - the Forge destroyed ends the voyage;
  - saving and loading give the identical voyage;
  - an abstract captain (no maps, fixed yields per visit) gets home on three seeds, and the test prints how long it took.
- **Factions** (`tools/factiontest.js`): checks that:
  - the five tiers and their bounds, starting standings, and standing never leaving −100 to 100;
  - race standing: an unmet faction starts at the average over the race's met factions;
  - the example pack adds a faction with no code, and the galaxy gives it a seat and territory, and its station and patrol appear on maps;
  - each faction gets the seats it lists; stations are their faction's place type;
  - behaviour follows the tier: Hostile fires, Wary warns then fires when you linger, Neutral ignores you until you fire, Friendly turns on your attackers, Allied comes to guard the Forge;
  - firing, kills and helping change standing by the listed amounts;
  - theft costs standing when seen without leave, nothing when unseen or with leave, and the voyage keeps the change;
  - a visit with factions is deterministic.
- **Veterans and upgrades** (`tools/ranktest.js`): checks that:
  - kills earn experience and ranks, and a rank adds 10% hull and 10% damage;
  - experience comes home in the hangar (plus a point for fighting) and launches on the next map;
  - ships aboard mend 5% a day, 20% with repair bays;
  - an upgrade that needs another is refused until that is built;
  - two hangars give 50 capacity; launch rails and the foundry line are faster; fire control is set.
- **Whole runs** (`tools/runtest.js`): checks that:
  - the AI captain (`tools/captain.js`, answering every event) gets home on eight seeds of each length;
  - most runs take four to six hours (full) and one to two hours (short) of estimated play. The estimate is 15 minutes per map visit, three quarters of a minute per stitch and a tenth of a minute per day. The captain plays lean, visiting only when it needs to;
  - saving on frame 1,100 of a map, loading and playing on gives exactly the same game as playing straight through.
- **Fog and engineering** (`tools/fogtest.js`): checks that:
  - a ship beyond sensor range is hidden and untargetable until one of yours comes close, then hidden again with its last position remembered;
  - fog works for monsters too;
  - nebulae halve sensor range, and a Wisp sees three times as far;
  - blueprints: Talons are refused without one; cutting a Talon wreck finds it and the next map can build them; the Cinder Pact sell a Sabre blueprint, once;
  - all five engineering projects change what they say, on the chart and on maps;
  - a deep scan reveals places;
  - fog is deterministic.
- **Events** (`tools/eventtest.js`): checks that:
  - all 25 events validate and can happen somewhere, and every node and choice in them can be reached;
  - the prologue opens a voyage and happens once; each drive part's storyline fires on arriving, finding and fitting;
  - chance events are deterministic and never more than one at a time;
  - a distress call can be a lure, with hunters waiting on the next map; a Scrapwyrm sign buries one in a field; waiting out a storm costs a day; leaving drops what was waiting;
  - the Scrapwyrm hides, strikes and burrows again; rust mites hatch from a cut wreck and chew on the fleet; the Hollowhorn's song stops a spool while it is near;
  - the Choir and the Gaunt routes to the Lens and the Spindle;
  - a scripted voyage that answers every event hears the prologue, every part's story and the ending.
- **Comms** (`tools/commstest.js`): checks that:
  - every dialog validates, and every node and every one of the 66 choices can be reached in some situation;
  - conditions gate choices, and choices you cannot pay for are refused;
  - prices follow standing (±30%), scarcity (+50% at zero stock) and wants exactly;
  - deals: unfair ones are refused, goods change hands, stock runs down and comes back, trading warms them;
  - hiring crew, and a hull that comes with its crew; no hull without room in the hangar;
  - treaties: tribute keeps the Gaunt's guns cold at their own den, firing breaks it (−40), Leave gives leave, treaties run out;
  - a ceasefire over comms mid-fight on a map; threats with and without a fleet; surveys and charts.
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
content/core/regions.yaml       the galaxy's regions: rings, place counts, danger, the Veil, the
                                Shore's edge, place-type weights, names
content/core/items.yaml         the Skein Drive's four parts: where they are, what they open, fitting costs
content/core/voyage.yaml        every number behind the voyage (needs, life support, hydroponics,
                                stitch costs, repairs, morale) and the Forge's systems
content/core/names.yaml         name generators (derelicts)
content/core/races.yaml         races, and where their factions start
content/core/factions.yaml      factions: seats, territory, patrols, enemies, leave; and every
                                reputation number (tiers, penalties, ranges)
content/core/rules/stations.yaml  faction stations and Choirmoth swarms
content/core/trade.yaml         values, price rules and treaty lengths
content/core/dialogs/*.yaml     comms trees, one per faction (the format is documented at the top
                                of rivet.yaml)
content/core/events/*.yaml      story and galaxy events (the format is at the top of story.yaml)
content/core/hints.yaml         hint cards for a guided first voyage
content/example-pack/           an example add-on: a second Hullborn faction, in YAML only
```

Packs listed after the core pack are merged on top of it, so a pack can add a place type or change one value of an existing ship. When the game loads, every reference is checked: a place that asks for an unknown resource or ship, or a collector that gathers an unknown resource, stops it with a message naming the file.

### Project layout

```
index.html            page, styles and HUD markup
lib/                  three.js (vendored, r160)
content/core/          the core content pack (see above)
src/engine/           deterministic core: world, actors, traits, orders, lockstep, replays (replay.js), integer maths,
                      steering (avoid.js), weapons and projectiles (weapons.js), content packs
                      (content.js), the place generator (poi.js)
src/traits/           gameplay traits (Flight, ProductionQueue, Collector, Asteroid, Cloud, Armament,
                      Attacks, AutoTarget, Stance, Formations, Wreck, PointLayout, Hangar, Skein,
                      Diplomacy, Station, Burrows, Interdicts, Sensors, Shroud, Ranks, ...)
src/activities/       per-actor tasks (FlyTo, Launch, Harvest, DeliverOre, Attack, AttackMove,
                      FormationMove, DockHangar)
src/galaxy/           the voyage: the galaxy generator (galaxy.js), the day clock, stores, systems,
                      travel and saves (voyage.js), the crew (crew.js), standing (standing.js),
                      comms, dialogs, trade and treaties (comms.js), events (events.js),
                      practice runs (run.js)
src/render/           three.js scene: space backdrop, procedural ships, rocks, clouds, crystal, nebulae,
                      wrecks, combat effects, the star chart (galaxy.js)
src/ui/               orbit camera, movement disc, input, HUD, the star chart screen (chart.js), the
                      comms and trade panel (comms.js), audio
tools/                dev server, headless tests, the abstract captain (captain.js), determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
