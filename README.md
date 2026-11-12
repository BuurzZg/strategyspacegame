# Driftforge

A space survival game for the browser, built on three.js with a deterministic, lockstep-ready simulation.
You command the **Forge**, a kilometre-long foundry-city of the Meridian Hollow, stranded in the Wrack, a galaxy of scrap. Its Skein Drive is broken. Cross the galaxy, keep your people alive, and find the parts to mend it.

See [PLAN.md](PLAN.md) for the full design, the milestone plan and the decisions behind it.

**Status: Milestone 24, whole campaigns.** The death loop is the game now. A long life gets dangerous through play, and the test captain plays the real loop: it dies, wakes with its memories and goes further each life.

- **A long life is a loud one.** The days count for more the longer a life lasts (a day's attention times 4, then 8 from day 20, then 12 from day 40), so a Hand sets out around day 25 to 30 even in a first life. Hands grow with the life: 15% more Hounds and Ticks, every ship 15% tougher, for every 30 days. From day 60 a second, strong Hand hunts whatever the attention. From day 42 the Hands keep the trail: they follow the Forge itself, a lane a day, and rest only two days after you tear free.
- **Fight well and you buy time.** Every Hour you kill takes 45 days off the life's age. Killing both Hands clears the life of them.
- **Tearing free costs 12% of the whole hull.** With less than that left, the Forge comes apart; the chart warns you ("Tear free: the hull won't hold"). Being caught and harassed still never ends a life on its own.
- **Shorter campaigns.** The crew drink half the water they did (two map visits in three were water runs). Every life wakes with full tanks (7,000 ice, 2,200 Glim). **Charted space:** a lane the Forge has stitched before, in this life or an earlier one, takes a day and half the Glim, so later lives get back to the frontier fast.
- **Small galaxies** age twice as fast, are hunted from day 1, and their Mainspring is at full strength.
- **Stripped places** were already in: each return to a place in the same life yields 35% less (never under 30%). Faster wear and slower restocks were not needed.
- **The numbers** (the test captain, eight seeds each): a full galaxy takes a median of 6.5 lives and 12.8 hours to the true ending, a life about 124 minutes; a small one 5 lives and 8.2 hours, about 103 minutes a life. A strong player can escape a full galaxy in the first life on 1 seed in 8; an ordinary one never does. These targets were set with the designer after the first measurements (see PLAN.md section 12).

**Milestone 23, the brass age:** The whole game now wears the approved steampunk style (PLAN.md section 9):

- **Brass, soot and steam everywhere:** riveted soot-iron panels with dark brass edges, engraved headings in IM Fell English, a readable Spectral body and typewriter numbers in Cutive Mono. Every text colour on every background is checked at 4.5:1 or better.
- **Instruments, not numbers:** water, food, air, Glim and the boilers are round brass gauges with cream dials, a red zone and an odometer counter, on the chart and on maps. The boilers read in PSI and drop to COLD. The crew's mood is an enamel **medallion with a face** (content, uneasy, angry) with stamped icons for what is wrong. The Skein spools in a **glass pressure tube** filling with Glim light.
- **The star chart is a navigation parchment** laid out on the chart table: a stained, folded, burnt-edged sheet with a compass rose, a scale bar in spans and a cartouche. Places are **wax seals** coloured and lettered by kind (black wax and a gilt letter for the story's places), lanes are inked (teal where the drive can stitch now), closed hazard lanes are dashed in the hazard's colour and hatched with its mark, the Veil is hatched violet, clues are pencil rings, and the Forge is a brass token. The camera still orbits it.
- **Factions speak by telegraph:** a telegram card types out their words on the tape, key clicking, and your answers are brass keys numbered like the keyboard. The Choir's messages come as light; the Gaunt's arrive half burned.
- **The deck plan is a cutaway** of the Forge: lit compartments where rooms are built, dashed slots where they could be, and Deck 9 sealed at the bow until the end.
- **Riveted ships:** every hull is plate and rivets in its faction's own metal: patched plates for the Rivet Moot and the Ragged Clans, waxy cream for the Synod, rust for the Gaunt, soot for the Cinder Pact, verdigris for the Wardens, polished brass for the Reavers. Big plates carry rows of warm portholes, **smokestacks vent Glim steam** (more under way), engines leave steam, pulse batteries are **rotary guns**, and the Spindle's lance throws **lightning** from copper coils.
- **New sounds:** telegraph keys, steam hissing from a valve when the Skein spools, iron plates clanking when you build or repair, a crackling lance, and an organ chord whenever a memory comes back.
- **A model gallery** (`/tools/gallery.html`) shows every hull in any faction's plating, with its mesh and triangle counts.

**Milestone 22, the story:** The story is in, from the waking to the Shore:

- **Twelve story memories, act by act,** each at a story place on the chart, found by cutting into its hulk or given by the people who remember: the Anchorage and the Steward in the Drift; a research hulk, a Moot tally-barge, a prison barge and the Tallow Bell's Deacon in the Middens; the Knotfolk's reliquary-ship, the Choir, the Meridian Horologe and the Tithe Barge in the Hush; the Cinder Pact's Founding Hall at the Shore. **Deck 9** opens at the Shore once every other one is known. Each story memory raises the Mainspring's attention. A chain of clues and events leads from one to the next.
- **New peoples:** the **Wardens of Ninefold** (the Knotfolk, who fire on the hammer-and-cog on sight), the **Ragged Clans**, the **Brass Reavers**, and the **Hollowkin** holds, visited from the chart: **the Waiting**, who kept a beacon lit for six generations, and **the Unforgiving**, whose children skip to a rhyme about you.
- **The date:** the bridge and the chart say **Meridian date: UNKNOWN** until the Horologe is remembered. After the Anchorage they show its last record. From the Horologe on, the Empire's running clock: 147 years, 3 months and 15 days since the last record.
- **The Mainspring,** the demon lord, waits in its **lair** at the Shore's edge, near the Heartstone. Its **two hearts and its coil** ward its core; it regrows from the battle's dead, gestates its pack and drags time. Every minute **the Twain** answers it, holding the Wound near the Forge still for a few seconds. Kill it, and the final jump opens. (Ships no longer waste fire on a warded target, and a great hull is seen through the fog by its flank, not its middle.)
- **Two endings:** escape with gaps in the story, or, with every memory, **the true ending and a final choice**: pay the debt, part the halves, or keep the Twain whole (decision 38: all three, the player's choice).
- **The ending narration:** old Jacob tells the whole story in ten engraved, sepia plates built from the game's own models, with slow camera moves, an organ, strings and ticking clocks. A scene whose memories you never found plays black, and he falters. Every line has its own id, so a recorded voice can be added later with no code.

See [The story](#the-story).

**Milestone 21, the tech demons:** The force behind everything has a face now: **the Wound**, the Mainspring's tech demons, grown rather than built from wet blue-black metal, flesh and bone, lit from inside by a pulsing crimson. They play as a real RTS opponent:

- **Their ships** mirror ours: **Ticks** (swarm fighters), **Stingers** (a bone lance against big hulls), **Chimes** (they ring, and fighters come apart), **Hounds** (the line), **Gnawers** (a mountain of jaws that eats wrecks to heal), **Feeders** (their harvesters), **Hours** (living carriers that lead a Hand) and **Nurseries** (flesh growths that bud Ticks and Feeders).
- **Their economy is ichor:** Feeders strip it from wrecks, every ship that dies near a demon gives some up, and Nurseries trickle it. Shearers cutting the wrecks first starve them, so salvage is a weapon.
- **Their AI** gestates a pack in the Hour's pods, counter-builds (Chimes when you field fighters, Stingers when you field big hulls), attacks in waves when it is strong enough, falls back to regrow when a wave breaks, and plants Nurseries. Near an Hour, time drags: your ships fly at 80%. A badly hurt Hour runs to regrow.
- **On the chart, the Mainspring's attention** rises as Jacob remembers, as days pass and as the Forge lingers; silent running (now a real memory), the Choir and static fields lower it. It shows as a word: **Quiet**, **Noticed** (a lone pack roams the outer regions), **Hunted** (a **Hand** sets out from the Shore and follows where the Forge was last heard) and **Marked** (two Hands, one of them strong). Hands show on the chart, with a faint ticking, when they are two lanes away or nearer. They infest places they pass: red-ink stains on the chart, Nurseries and spore haze on the map. Burn every Nursery and the place is clean for the life, with an echo and sometimes captives.
- **Being caught is never the end:** go in and kill the Hour (the Hand is gone for the life, and attention falls a step), spool out and shake it off for a while, or stitch away and pay for tearing free.

See [The Wound](#the-wound-the-tech-demons).

**Milestone 20, traders and crew:** Each region has a **trader**, a place of its own marked with a brass bell. There's no map to play: you trade from the chart (`C`), in the trader's own voice, at your standing with their faction:

- **The Lamp & Ledger** in the Drift, kept by Wicket Arn, who never stops talking;
- **the Tallow Bell** in the Middens, a Synod refinery-chapel kept by Deacon Ilmar Sloe;
- **the Murmur** in the Hush, a Choirmoth swarm that sells **echoes** and **clues**;
- **the Last Stop** at the Shore, where Ossory Vell sells **Sabre plans** and a chart of the Shore.

Their stock comes back each life, with one of each unique good, and once found they stay on the chart in every life. The **workshop** and **still room** now need their plans from the Drift and Middens traders. **Wayhouses** (two in each region) are where drifters ask to come aboard, once a life, sometimes with a name: someone for an empty post, or a pilot looking for a ship. Crew are limited by the **berths**: nobody hires on, and no drifter joins, without somewhere to sleep. See [Traders and wayhouses](#traders-and-wayhouses).

**Milestone 19, the muster and levels:** Ships no longer rank up from kills. A ship gains a **level** for every map it launches on, survives and comes home from, once per map, up to level 5, and each level adds 5% damage and hull. A good wing commander, drills or a quick-study pilot can make levels come sooner. At **levels 3 and 5** the ship's pilot picks a **perk**, from three on offer, that changes how it fights: *Covers the Forge*, *Holds formation*, *Hunter*, *Finisher* or *Gets them home*. The hangar **berths 10 ships**, plus three for each hangar room. When more come aboard, **the muster** asks who continues. A ship scrapped gives back half its ore, its crew move into the Forge and its pilot stands by; one left adrift is lost with everyone aboard. Nothing stitches until it is settled, and no trader will sell a hull you have no berth for. See [The muster and levels](#the-muster-and-levels).

**Milestone 18, the bridge:** The crew screen is now the Forge's **bridge** (press `B`), drawn in the brass style. You look down from behind Jacob's chair at nine stations, each a console with its officer's name plate, a mood medallion, three level lamps and a state gauge. Lit consoles glow, their needles waver and steam drifts from their vents. Dark ones are grey glass and still needles, and every lamp goes gold for All hands. A new **signals officer** runs comms. Click a station for its panel: its officer, what it runs, what Jacob remembers for it (lit, or a question mark), and **training**. Every open station wakes at level 1 each life. Cogmarks and a day or two train it to level 2, then 3, and each level brings a skill: field repairs, plotted courses, quick stitch, long watch, ration plan, drills, long-range hails, signal decoding, triage, ledgers and more. Training is relearned every life, but it costs half where Jacob remembers something for that station. An officer's work counts half until their station is trained. Click the chair for the captain's panel: the life, the day, the Meridian date (UNKNOWN), the All hands streak, the Loom and Let go. On a phone the ring becomes a column. See [The bridge](#the-bridge).

**Milestone 17, the Forge as a base, and survival that weakens:** Running out of water, food, air or Glim **never kills** now. Each shortage builds **strain** (thirst, hunger, bad air, cold), a level a day up to 3, and every level makes the Forge weaker: slower work, dearer building, more Glim a stitch, weaker ships. At strain 2 and 3, stations go dark: life support stops making air, the foundry stops building, comms falls silent. The **boilers** burn 10 Glim a day; with none they go cold and everything works at half. The crew's **mood** is a medallion in the top bar (Content, Uneasy or Angry), with its causes beside it, and it changes what things cost. Under morale 15, stations' crews **strike** instead of leaving, until morale recovers or you **parley** (a day of talking, or cogmarks). When every station is green it's **All hands**: the bell rings, work is faster, stitches cheaper, ships better, and a long streak earns a song. The Forge has a **deck plan** of 8 slots for 17 **rooms** (today's projects, plus crew quarters, a mess hall, an infirmary, a chart room, a workshop and a still room), lost with each life. **Cogmarks**, stamped brass cogs, are money now: traders pay them from a purse, take them for anything, and make up the difference in a swap. See [Staying alive](#staying-alive) and [The deck plan](#the-deck-plan).

**Milestone 16, routes closed until remembered:** Every galaxy now has **hazard pockets**: a few places off to the side of a region, cut off on every side by **asteroid shoals**, **ember lanes** near the dead star, **static fields** or **the Glare**. Their lanes are drawn in the hazard's colour, and nothing gets the Forge through until Jacob remembers what does: Shields, Heat baffles, Lightning rods or Lead-lined decks. Try for a place behind one and the officer at that post tells you why, by name (*Chief engineer Lune Tennant: "Shields are dead, Captain. Take her into that field and the rocks will open us like a tin."*), or whoever is acting in the post. From then on that memory can be recalled on the Loom for two echoes, and the hazard stays open in every life. Places inside are half again as rich, and each pocket hides a wreck with a strongbox worth two echoes, once in a campaign. The navigator now reports the Veil and the drive's reach the same way. Pockets never block the way home: a single life can always escape. See [Hazards: closed routes](#hazards-closed-routes).

**Milestone 15, the Loom: memories:** You wake on a bridge you don't remember, and the chart is dark: you can see only the places one lane away. A faint signal draws a circle on the chart, "somewhere in here". Inside it is the Anchorage, a destroyed station wearing the same emblem as your ship. Cut into its core and two memories come back: the emblem, and the radar, which lights the chart. What Jacob remembers stays in every life. **The Loom** (press `L`) is the memory tree, drawn in the new brass style: 31 memories in five branches, with the ones you haven't found shown as question marks. The Skein Drive's four parts are memories now. They are found in derelicts, inside circles that sharpen as you get close, and there is nothing to fit. Hulls you have blueprints for are memories too. **Echoes**, from memories, old voices, and the place where an earlier life ended, recall memories such as the Wisp. See [Memories and the Loom](#memories-and-the-loom).

**Milestone 14, campaigns and lives:** The game is being rebuilt around a new design (see [PLAN.md](PLAN.md), version 3): one galaxy per campaign, played over many lives. Start a **new campaign** from the title screen. When the Forge is destroyed, the crew are gone or the air runs out, the life ends, and you **wake** again at the moment you first woke, in the same galaxy. The chart remembers every place you found and marks the ones you visited before. The memorial keeps everyone you lost, and the Choir remember you. Everything else (stores, fleet, hull, systems, standing) starts over. The galaxy's layout never changes, but what is on each map, which events happen and how the dice fall differ from life to life. A **Let go** button gives up a life that is going nowhere. The campaign saves as you play. Saves from earlier versions load as a campaign's first life. Memories, closed routes and the story come next. See [Starting a campaign, lives and saving](#starting-a-campaign-lives-and-saving).

**Milestone 13, named crew:** The people who run the Forge have names now. Eight officers (nine from Milestone 18, with the signals officer) head its departments (chief engineer, foundry master, grower, navigator, watch officer, quartermaster, surgeon, wing commander), and every armed ship has a named pilot or captain who flies with it and earns its ranks. Each has a trait (Steady, Gifted, Green, Grim, Beloved, Fair-weather, Iron, Ace, Careful, Hotshot, Lucky, ...) that changes their department or their ship, sometimes only under conditions ("while morale is 60 or more"). When people die, the losses pick who: an officer is as likely to starve as anyone. A pilot goes down with their ship, unless their luck holds one last time. Somebody steps up to fill every empty post. Events call people by name, and the **Crew** tab keeps a memorial. See [Named crew](#named-crew).

**Milestone 12, the first full run:** start a new voyage from the title screen and choose:

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

### Memories and the Loom

- **The first life:**
  - **The opening:** a short, confusing awakening.
  - **A dark chart:** only the places one lane from the Forge are known, and there are no deep scans.
  - **The signal:** it draws a circle round the Anchorage, a few stitches from where you wake.
  - **The Anchorage:** cut into its hulk with Shearers on its map. The station's core gives back the **emblem** and the **radar**, and the radar lights the chart in this and every later life.
- **Clue circles:** a clue draws a dashed pencil circle on the chart, never centred on what it's about but always containing it. Another clue to the same place shrinks it. Get close enough and the watch officer pinpoints it, and the place gets a gold ring. Circles stay on the chart in later lives.
- **The drive:** the Threadwound Coils, Stillwater Lens, Anchor Spindle and Heartstone are memories. Once the radar works, the engineers get a fix on the next one, as a circle. Cut it out of its derelict and the drive has it at once, in every life. There is nothing to fit, and no ore, salvage or days to spend.
- **Hulls:** a blueprint (cut from a wreck, bought, or given) brings that hull's memory back for good. The Wisp is recalled with an echo once the radar is known.
- **Echoes:** fragments of memory. You get them from story memories and drive parts, from an old voice on a forgotten band, and from the place where an earlier life ended, which holds an echo until you go back. Spend them on the Loom.
- **The Loom** (`L`, or the button in the top bar):
  - **The layout:** five rows of cogs (Origins, the Skein, the Forge, the fleet, the decks), with threads to what each one needs.
  - **What the cogs show:** a lit brass cog is remembered; a pulsing ring means you can recall it now; a question mark means not yet.
  - **Details:** click a cog to see what it is, where it waits or what it costs, and when you remembered it.
  - **The Forge row:** Shields, Heat baffles, Lightning rods and Lead-lined decks open the hazards (see below). Each shows as a dark cog until a hazard turns the Forge away, then it can be recalled for two echoes.
  - **Not yet:** the story memories, silent running and the rooms come in later milestones, and show as question marks until then.

### Hazards: closed routes

| Hazard | Where | Lanes | Who reports it | Remember |
| --- | --- | --- | --- | --- |
| Asteroid shoals | the Drift and the Middens | amber | the chief engineer | Shields |
| Ember lanes | the Drift's inner edge, near the dead star | orange | the chief engineer | Heat baffles |
| Static fields | the Middens and the Hush | blue | the watch officer | Lightning rods |
| The Glare | the Middens and the Hush | sickly yellow | the surgeon | Lead-lined decks |

- **Pockets:** three to five places in one region, cut off by a hazard on every lane in from outside. A full galaxy has four to seven, a short one two to six. They never hold the wake-up point, the Anchorage, a drive part or a station, and they sit off to the side: no route to anywhere else gets more than a stitch longer because of them, so a single life can always get home.
- **Turned away:** pick a place behind a hazard and the card says why, in the words of the officer at its post. If the post is empty, whoever is acting in it speaks, or failing that the crew. The first time, the memory that opens it can be recalled on the Loom from then on, in every life. Drifting gets no further than stitching.
- **Opened:** recall the memory (two echoes) and the hazard's lanes turn teal like any other. It stays open in every life.
- **Worth it:** places in a pocket yield half again as much. Each pocket keeps a wreck with a strongbox in Jacob's own hand: cut it open for two echoes, once in a campaign.
- **The navigator** reports the Veil and stitches too long for the drive.

### Starting a campaign, lives and saving

- **New campaign** opens the setup:
  - **Full galaxy:** about 300 places in four regions.
  - **Small galaxy:** about 120 places in the same four regions, with the drive's parts nearer each other, fuller stores at the start, cheaper fitting and one-day stitches. A shorter campaign.
  - **Guide me through my first life:** short hint cards the first time each thing comes up (the chart, planning a stitch, going in, the foundry, spooling, the report, running low, a faction's claim). Cards already seen stay seen in later lives.
  - **Galaxy seed:** blank for a random one. The seed is the whole campaign.
- **Lives:** the top bar shows the life and the day.
  - **How a life ends:** the Forge is destroyed, nobody is left aboard, or three days pass without air. You can also give a life up with **Let go**, at the bottom of the Forge tab.
  - **The wake screen** shows how long the life lasted and who was lost. **Wake** starts the next life, at the moment you first woke.
- **What carries over:**
  - every place the chart knew; places visited in an earlier life keep a faint ring and say so;
  - the memorial: the Crew tab lists everyone named who was lost in earlier lives;
  - your standing with the Choir, who remember you;
  - hint cards already seen.
- **What starts over:** stores, fleet, hull, systems, drive parts, and standing with everyone else.
  - **The crew:** the same people wake again, alive, remembering nothing.
  - **The maps:** the galaxy's layout is fixed, but what is on each map, which events happen and how the dice fall differ in every life.
- **Saving:** one campaign save, written as you play. **Save and quit** works any time, on the chart or on a map. A life that has ended is saved too, so **Continue** brings back the wake screen. Saving on a map stores the map's orders so far; loading rebuilds the map and replays them, so it comes back exactly as it was. The save is removed when the campaign is won or a new one starts.
- **Old saves:** voyages from earlier versions, with permanent death or free saves, load as a campaign's first life. Named saves from before are under **Old saves** on the title screen.
- There is no difficulty setting. The pressure is survival (water, food, air, Glim) and what is out there.

### Veterans and the Forge

- **Levels** (Milestone 19, replacing ranks from kills): see [The muster and levels](#the-muster-and-levels). Chevrons over the selection brackets show a ship's level, and the selection card shows its level and perks. The **Crew** tab lists the hangar with levels, hull and perks.
- **The hangar carries them:** recall a ship and it keeps its level and damage until the next place. Lose it and its level is gone with it.
- **Mending:** ships aboard mend 5% of their hull a day; repair bays make it 20%.
- **Forge upgrades** are rooms on the deck plan now (Milestone 17): see [The deck plan](#the-deck-plan).

### Traders and wayhouses

| Trader | Region | Kept by | Faction | Sells | One a life |
| --- | --- | --- | --- | --- | --- |
| The Lamp & Ledger | the Drift | Wicket Arn | Rivet Moot | food, salvage, spores; hands and miners; Gleaners and Shearers | the workshop plan |
| The Tallow Bell | the Middens | Deacon Ilmar Sloe | Lantern Synod | Glim, food, spores; engineers | the still room plan |
| The Murmur | the Hush | (a Choirmoth swarm) | the Choir | Glim, two echoes, two clues | |
| The Last Stop | the Shore | Ossory Vell | Cinder Pact | ore, ice, a chart of the Shore; pilots and hands; Talons and Halberds | Sabre plans |

- **Trading:** at a trader's place the card offers **Trade** (`C`) instead of Go in. Their own dialog opens, then the usual trade screen with their stock, cogmarks included. Prices follow your standing with their faction, and they won't deal if you are Hostile.
- **Special goods:** a room's plan lets you build that room this life; an echo goes to the Loom; a clue draws a circle round the next drive part; the chart shows the whole region; Sabre plans are remembered for good, like any blueprint.
- **Lives:** once found, a trader stays on the chart in every later life. Its stock, and its one-of-each goods, come back each life.
- **Wayhouses:** two in each region. At one, **Take the drifters aboard** (a day) brings 4 to 10 people, once a life. About a third of the time one of them has a name: someone who takes an empty post, or a pilot looking for a ship.
- **Berths:** hiring and drifters stop at the berths (160, plus 40 for crew quarters). Events can still crowd the Forge, which costs morale.

### The muster and levels

- **Levels:** a ship gains a level for every map it **launched on, survived and came home from**, once a map however often it docks, up to **level 5**. A ship that never leaves the bays gains nothing, and kills don't count (they stay on the pilot's record). Each level above the first adds 5% damage and hull. A good wing commander, a hangar trained in drills and a quick-study pilot can earn an extra level now and then. They never slow a level down.
- **Perks:** at levels 3 and 5 the ship's pilot picks a perk, from three on offer, that changes how it fights:

| Perk | What it does on a map |
| --- | --- |
| Covers the Forge | Only goes after enemies within about 6 km of the Forge, on a shorter leash |
| Holds formation | Launches in the defensive stance: returns fire from where it is and never chases |
| Hunter | Scans half again as far and chases twice as long |
| Finisher | Goes for the enemy closest to breaking, not the nearest |
| Gets them home | Under 30% hull, turns for the Forge and goes aboard |

- **Berths:** the hangar holds 10 ships between maps, by count; an expanded hangar and a second hangar add three each. On a map you can still build past that, up to the fleet capacity.
- **The muster:** when more ships come aboard than the berths, the chart asks who continues. For each ship left over, **scrap** it (half its ore back; its crew move into the Forge; its pilot stands by for the next ship) or **leave it adrift** (it and everyone aboard are lost). Nothing stitches until the muster is settled.
- **Losses are permanent:** a ship lost on a map is gone, and its pilot with it, unless a Lucky pilot gets out, or the infirmary's triage pulls them out.

### Named crew

The **Crew** tab on the star chart lists everyone with a name.

- **Officers** head the Forge's departments. Each one's trait changes their department's work, in percent:

| Post | From | Their work changes |
| --- | --- | --- |
| Chief engineer | engineers | how much a day of repairs mends |
| Foundry master | engineers | how fast ships are built on maps |
| Grower | hands | how much food the hydroponics grow |
| Navigator | pilots | the Glim each stitch burns |
| Watch officer | hands | how far the sensors reach |
| Quartermaster | hands | what traders ask |
| Surgeon | hands | how hard strain hits the Forge |
| Wing commander | pilots | how fast ships earn experience |
| Signals officer | hands | how tight new clue circles are drawn |

  Their work counts half while their station is at level 1, and in full once it is trained (see [The bridge](#the-bridge)).

- **Pilots and captains:** every armed ship has a named lead: a pilot, or a captain for ships crewed by hands. Select a ship on a map to see who flies it and what their trait does (damage, hull, faster experience). New ships built on a map get a new pilot from the crew. A lead whose ship is lost dies with it, or is left behind with it. A **Lucky** pilot gets out in a pod, once, and comes home **Shaken**. A lead with no ship stands by and takes the next one.
- **Traits** are defined in `content/core/crew.yaml`: a trait's work, damage, hull, learning and morale modifiers, who can have it, and when it holds. **Fair-weather** officers are brilliant only while morale is 60 or more; **Iron** ones only when it is 40 or less; the **Homesick** start to flag after day 250. Some traits grow into others: the **Green** become **Steady** after 50 days, and so do the **Shaken** after 40.
- **Losses pick who dies.** Fights and events take people at random from the role they hit, named or not: each officer is as likely to die as anyone else in their role. The log says who. When an officer is gone, someone from their role steps up, Green.
- **Head counts and names always agree.** Officers are counted in their role, never fly, and are not offered for new ships on maps.
- **Events by name:** crew events include a fever, a quarrel between officers, the chief engineer's ideas, drills, a fold in the Skein and letters home. Some only happen if a certain officer is aboard, or someone with a certain trait. When three named people are gone, the crew ask for a memorial.

### The voyage: the star chart

The chart is a 3D view of the galaxy, drawn as a navigation parchment laid out on the chart table: a stained, folded sheet with the regions inked as rings, the Veil hatched in violet, a compass rose and a scale bar. The camera orbits it like any map.

| Input | Action |
| --- | --- |
| Click a place | Its card: what is known, and the route there |
| `Enter` | The card's first action: stitch there, or go in |
| Right-drag, scroll | Rotate, zoom |
| Drag, `W A S D` | Pan |
| `F` or `Home` | Back to the Forge |
| `B` | The bridge |
| `L` | The Loom |

- **What you see:** places are wax seals, coloured and lettered by kind once the sensors have seen them (a small ink ring until then; black wax with a gilt letter for the story's places; an inked ring where you have been this life, a dashed one for an earlier life). Thick teal lanes are stitches the drive can make now, from here; other lanes are ink, fainter where they are too long for the drive. Lanes into a hazard pocket are dashed in the hazard's colour, hatched and marked with its sign, until you remember what gets the Forge through. The Forge is a brass token; the teal ring round it is the drive's reach, and the dashed pencil ring the sensors'. A gold ring marks the drive part the engineers have a fix on.
- **The card** shows the route (stitches, days, Glim, distance) and what you will have on arrival. With no Glim, the Forge can **drift** one lane at sub-light, slowly. At the Forge's place, **Go in** plays the map, and **Rest a day** raises morale (twice as much in still water).
- **The top bar** shows the day and the instruments: brass gauges for water, food and air (the days they will last), Glim and the boilers' pressure, counter plates for ore, salvage, spores, cogmarks and crew, and the crew's mood: an enamel medallion with a face, the morale, and stamped icons for what is behind it.
- **The Forge panel:**
  - **Forge:** the Loom, the Skein Drive's reach and its four parts, the deck plan and its rooms, blueprints, and the hull and six systems (drive, reactor, life support, hydroponics, foundry, sensors), each with **Repair** (a day's work by the free engineers, for ore and salvage);
  - **Crew:** the mood and its causes, strain, the nine stations and their state, strikes and parleys, the officers, engineers, pilots, miners and hands (aboard, flying ships, free), the hangar and the memorial;
  - **Hold:** every store, its change per day, and how long it lasts;
  - **Log:** what has happened.
- **Save and quit** at any time. **Permanent death:** the save is removed when the voyage ends. (A visit in progress is not saved: continuing returns to the chart as it was before going in.)

### Staying alive

- **Every day** (each stitch takes one to three; on a map, one day passes every four minutes) 150 crew need 90 water, 120 food and 150 air.
- **Life support** makes air from water. The **hydroponics** grow food from water, and much faster with **spores**. Ice from Ice Tails is the water.
- **Glim** runs the drive (about 6 per 10 spans of stitch) and the **boilers** (10 a day). Lantern Mists are full of it. With no Glim the boilers go cold: every system works at half, and the crew start to shiver.
- **Shortages weaken; they never kill.** A store under three days' need lowers morale. Each day a store is out, its **strain** rises a level, to 3 (thirst, hunger, bad air, cold), and once it is back it eases off a level a day (the mess hall and infirmary ease it faster). Every level of strain, of any kind, makes work 15% slower, building and ships 10% dearer, stitches 10% more Glim and ships 5% weaker on maps, capped at four levels. The surgeon's work softens it.
- **Stations go dark** at strain 2 and 3, one each: thirst takes life support, then the infirmary; hunger the hangar, then stores; bad air the infirmary, then comms; cold engineering, then the foundry.
- **A life ends** only when the Forge is destroyed, everyone aboard is lost in fights, or you let it go.
- **Morale and mood:** morale drifts toward how things are. Over it sits the mood everyone can see:

| Mood | When | What it does |
| --- | --- | --- |
| Content | Morale 60 or more, nothing short | Work 10% faster |
| Uneasy | Morale 30 to 59, a store running low, or strain easing off | Building, ships and Glim a stitch 10% dearer |
| Angry | Morale under 30, or a store gone | 30% dearer |

  The medallion's causes say why: thirst, hunger, bad air, cold, grief after deaths, crowding (more crew than berths), a strike. Resting, a mess hall and full stores pull the mood back up.
- **Strikes:** under morale 15, one station's crew walk off each day, and it stops working. They come back when morale is over 30, or after a **parley** on the Crew tab: a day of talking, or 40 cogmarks a station. Nobody leaves for good.
- **All hands:** when every station is green (morale 60 or more, nothing short, no strain, every station that is open online and staffed, no strike), the bell rings. While it lasts, work is a further 10% faster, stitches cost 10% less Glim, ships do 5% better, and morale doesn't fall overnight. Six days in a row earns a song.
- **Stations** (the Crew tab): engineering, navigation, sensors, foundry, life support, hangar, comms, infirmary and stores, each run by an officer. A station is online, dim (no officer, or its system under half), dark, on strike or cold. Dark, it loses what it does: no repairs or building; stitches 50% dearer; the chart dark past the next lane; no ships built; no air made; launches at half speed; nobody to hail; strain eases no faster; traders charge a quarter more. Sensors open with the radar, and the infirmary with its memory and room. See [The bridge](#the-bridge) for levels and training.

### The bridge

Press `B`, or **The bridge** in the top bar or the Crew tab.

- **The view:** Jacob's chair in the middle, under the great window. Engineering and navigation stand on the left; sensors, foundry, life support, hangar and comms along the back; the infirmary and stores on the right. Each console shows its name plate, officer, mood medallion (green, amber, red), three level lamps and a state gauge (online, dim, cold, dark or on strike).
- **Levels:** 0 while a station is dark or not open yet; every open station wakes at **1** (manned) each life. Once Jacob remembers what opens a station, it is lit from day 1 of every life: sensors with the radar, the infirmary with its memory (and its room). An officer's work counts half at level 1 and in full from level 2.
- **Training** (the station's panel): to level 2 for 30 cogmarks and a day, then level 3 for 60 and two days. It is half price where Jacob remembers anything for that station. Each level brings a skill for this life:

| Station | Officer | Level 2 | Level 3 |
| --- | --- | --- | --- |
| Engineering | Chief engineer | Field repairs: repairs a fifth cheaper | Damage control: hull damage wears systems half as much |
| Navigation | Navigator | Plotted courses: a tenth less Glim a stitch | Quick stitch: stitches of three days or more take a day less |
| Sensors | Watch officer | Long watch: sensors reach a quarter further | Cheap scans: deep scans on half the Glim |
| Foundry | Foundry master | Shift work: ships built a fifth faster | Salvage line: twice the cogmarks from salvage |
| Life support | Grower | Ration plan: a tenth less food and air | Recyclers: a sixth less water |
| Hangar | Wing commander | Drills: experience a quarter faster | Fast launch: launches a quarter faster |
| Comms | Signals officer | Long-range hails: talk to whoever holds the next place over | Signal decoding: on arrival, a chance a clue circle tightens |
| Infirmary | Surgeon | Triage: a third of leads lost with their ships are pulled out alive | Field hospital: strain costs a fifth less |
| Stores | Quartermaster | Ledgers: traders ask a tenth less | Tight holds: a tenth more of what each map brings home |

- **What Jacob remembers for a station** is listed on its panel, lit or as a question mark: the hazard memories for engineering, the drive parts for navigation, the radar and chart room for sensors, the hulls for the foundry, silent running for the hangar, story memories for comms, the infirmary for the infirmary. These last for good; training is relearned every life.
- **The captain's chair:** the life, the day, the Meridian date (UNKNOWN until the Horologe is found), morale and its causes, the All hands streak and the best this life, the Loom, and Let go.
- **All hands:** every lamp goes gold at once, with the bell and the organ, and the streak shows in the header.
- **On a phone** the stations stack in a column under the chair.
- **The Forge's systems** wear down when its hull is damaged on a map. A damaged reactor slows everything; a damaged drive reaches less far and spools slower; a damaged foundry builds slower.
- **Crew:** building a ship takes its crew from the free crew. When a ship is destroyed, half its crew get away in pods; ships left behind take all theirs.

### The deck plan

The Forge tab shows a deck plan of **8 slots**. Rooms are built with ore, salvage, days and free engineers (dearer when the crew are unhappy or strained, and not at all while engineering is dark). **Strip** a room to free its slot: a day, and nothing comes back. Rooms are physical: a new life wakes without them, but what Jacob remembers about building them stays.

| Room | Slots | What it does |
| --- | --- | --- |
| Expanded hangar, then Second hangar | 1 each | +10 fleet capacity each |
| Hydroponic racks | 1 | Hydroponics grow 50% more |
| Long-range array | 1 | Sensors reach 50% further, on the chart and on maps |
| Glim recycler | 1 | Stitches cost 20% less Glim |
| Repair bays | 1 | Ships aboard mend much faster |
| Foundry line | 1 | Ships are built a third faster |
| Fire control | 1 | The Forge's turrets hit 40% harder |
| Armoured plating, then Heavy plating | none (on the hull) | The hull is 25% stronger each |
| Launch rails | none (in the hangar) | The fleet launches twice as fast |
| Crew quarters | 1 | 40 more berths (160 to start) |
| Mess hall (remember it first) | 1 | Morale settles 5 higher; hunger and thirst ease off twice as fast |
| Infirmary (remember it first) | 1 | Every strain eases off faster, strain costs less, and the infirmary station opens |
| Chart room (remember it first) | 1 | New clue circles are a third smaller |
| Workshop (its plan first, from the Lamp & Ledger) | 1 | Repairs take a quarter less ore and salvage |
| Still room (its plan first, from the Tallow Bell) | 1 | The crew drink a fifth less water |

### The drive's parts

| Part | Where | Opens |
| --- | --- | --- |
| Threadwound Coils | a derelict in the Drift | stitches of 150 spans: the Middens |
| Stillwater Lens | a derelict in the Middens | stitches through the Veil: the Hush |
| Anchor Spindle | a derelict in the Hush | stitches of 200 spans: the Shore |
| Heartstone | a derelict deep in the Shore | the final jump, from the Shore's edge |

The engineers have a fix on one part at a time: first a circle, then the gold ring once you are close. Go in and cut into the derelict's hulk with Shearers until they find it. Its memory comes back at once, and the drive has it in every life.

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
- **Trade** (at their station, Neutral or better) is barter, with **cogmarks** to carry value. Every good has a value. Pick what you take and what you give; the deal is fair when what you give is worth at least what they ask.
  - Cogmarks are worth exactly 1 to both sides. Sell goods for cogmarks out of their purse (300, refilling like their stock), buy with them, or swap goods and press **Pay the difference in cogmarks** (or **Take the change**). Cogmarks also come from the wrecks the Shearers cut (one for every 20 salvage), and pay strikers. They are physical: a new life starts with 60.
  - While the stores station is dark, traders charge a quarter more.
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

(The rooms that upgrade the Forge are under [The deck plan](#the-deck-plan).)

- **Sensor fog** (maps on the voyage, and practice): you see other ships and stations only within sensor range of one of your own. Most ships see about 900 m, a Halberd 1.1 km, a Sabre 1.2 km, the Forge 1.6 km, a Wisp 2.6 km. Inside a nebula, seeing and being seen both happen at half range. What cannot be seen cannot be targeted, by you or by anyone else. A faint red diamond marks where a hostile was last seen.
- **The Tactical Plot** (`Tab`): the whole map from above. It shows your ships and their sensor reach, what you can see, last-seen marks, deposits, wrecks and nebulae. Click to look there.
- **The Wisp:** a fast, unarmed scout (80 ore, 1 pilot) with three times a warship's sensor range.
- **Deep scan** (star chart, at the Forge's place): a day and 40 Glim to reveal every place within twice the sensor range.
- **Blueprints:** the foundry starts able to build Darts, Pickets, Halberds, Gleaners, Shearers, Skimmers, Smelters and Wisps. **Talons, Spindles and Sabres need blueprints:**
  - cut half the salvage out of a wreck of that hull;
  - buy one (Rivet Moot and Ashen Gaunt: Talon; Cinder Pact: Spindle and Sabre);
  - or find one in an old archive.
- **Rooms** (the Forge tab): see [The deck plan](#the-deck-plan).

### The story

| Act | Region | Story places (and who remembers) | Memories |
| --- | --- | --- | --- |
| I | the Drift | the Anchorage; the Steward, Erik's yacht; the first fight with the Wardens of Ninefold | the emblem (and the radar); "We are here to help"; the old man's ship |
| II | the Middens | the Quiet Lamp (a research hulk); the Tally of Owls (a Moot tally-barge); the Long Account (a prison barge in the Ragged Clans' fields); the Deacon at the Tallow Bell | the Fray; "Afraid is cooperative"; the lists; the oath |
| III | the Hush | the Reliquary of Ninefold; the Choir, who come to you; the Meridian Horologe; the Tithe Barge | the other half; the waking; the date; the offering |
| IV | the Shore | the Founding Hall; Deck 9, once everything else is known; the Mainspring's lair | Enough; the whole truth; the final battle |

- **Finding them:** each place's events point to the next with a clue circle on the chart, and the Shearers cut each memory out of its hulk. Their memories stay in every life. The Hollowkin holds, the Waiting and the Unforgiving, are in the Middens; hail them with `C`.
- **The date:** UNKNOWN; after the emblem, the Anchorage's last record (Year 4324, Month 3, Day 2); after the Horologe, the running Meridian date (it wakes each life at Year 4471, Month 6, Day 17, 06:42:19).
- **The final battle:** go in at the lair. Break the two **hearts** and the **coil** and the core opens. Bring frigates, destroyers and lances: the Mainspring grows Stingers against big hulls and Chimes against fighters. The final jump needs the Heartstone and the Mainspring dead. On a short voyage it is 60% of itself.
- **The endings:** without the whole truth, the escape. With it, the true ending and a final choice: give the Twain to the Mainspring, give the stolen half back to the Knotfolk, or keep it whole. Then the narration plays (`Space` or a click for the next line, `Esc` to skip).
- **Where the words live:** `content/core/memories.yaml` (memories and story places), `content/core/events/story.yaml` (their events and the endings), `content/core/dialogs/` (the peoples), `content/core/narration.yaml` (Jacob's narration).

### The Wound: the tech demons

| Ship | Mirrors | Ichor | Strong against | Weak against | Notes |
| --- | --- | --- | --- | --- | --- |
| Tick | Dart | 40 | fighters | flak (Pickets) | budded in clutches by Nurseries too |
| Stinger | Talon | 110 | frigates and capitals | fighters | its lance can't be dodged |
| Chime | Picket | 150 | fighters | frigates | grown when you field fighters |
| Hound | Halberd | 380 | corvettes | Talons, Gnawers | the backbone of every Hand |
| Gnawer | Spindle and Sabre | 900 | frigates | fighters | eats wrecks to heal; strong Hands only |
| Feeder | Gleaner and Shearer | 60 | — | everything | strips wrecks and the dead for ichor |
| Hour | the Forge, small | — | fighters close in | a fleet that goes for it | gestates two at a time; time drags near it; flees at 35% and regrows |
| Nursery | — | 300 | — | anything | anchored to a rock or wreck; buds Ticks and Feeders; its creep mends demons |
| The Mainspring | the Forge | — | everything near it | lances and destroyers | only in its lair; two hearts and a coil ward its core; regrows from the dead; gestates; time drags round it |

- **Attention.** Each memory recovered adds 5; a point every 5 days (several, later in a life: see below); a point a day after 6 days at one place; 2 for each Nursery burned and 4 for each Hour killed. Silent running takes a point a day, a stay with the Choir 2 a day, a stitch through a static field 4. Noticed at 20, Hunted at 45, Marked at 80. A new life wakes with 3 points for each memory (up to 60).
- **The Hands.** One sets out from the Shore at Hunted, two at Marked, and moves a lane every 2–3 days (2 when strong) toward where the Forge was last heard, losing the trail a fifth of the time. They won't cross static fields. Running silent, the Forge is only heard where it fights. A Hand grows stronger every day it hunts.
- **Caught.** A Hand at the Forge's place has caught it. Each day there costs 3% hull (never the last of it). Going in brings its Hour and pack on after 45 seconds, growing more as the fight goes on. Kill the Hour and the Hand is destroyed for the life, and the life counts 45 days younger; spool out and it loses you for a few days; stitch away without a fight and tearing free costs 12% of the hull, 8 morale and a hit to a system, and with less hull than that left the Forge comes apart.
- **A long life** (Milestone 24). A day's attention counts 4 times from the start of a life, 8 from day 20 and 12 from day 40. A Hand's pack is 15% bigger and tougher for every 30 days of the life. From day 60 two Hands hunt, one strong, whatever the attention; from day 42 they keep the trail (following the Forge, running silent or not), move a lane a day and rest only 2 days. A small galaxy's life ages twice as fast and is hunted from day 1.
- **Infested places.** Hands may infest places they leave (Hunted and on). An infested map has two or three Nurseries, a garrison, and a spore haze (sensors at 70%). Burn every Nursery to clean it: an echo, and 40% of the time 3 to 8 captives from the havens join as hands.
- **The Proving Grounds** have a Wound section: Ticks, a Hound pack, Stingers, Chimes, a Gnawer, or a whole Hand.
- **Where the numbers live:** `content/core/rules/demons.yaml` (the ships), `weapons.yaml` (their weapons), and the `Wound` block of `voyage.yaml` (attention and the Hands).

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
- **The Wound:** ten Ticks, a Hound pack, four Stingers, three Chimes, a Gnawer, or a whole Hand (an Hour, its pack and two Feeders). The Hour grows more from the wrecks as you fight.
- **Your ships:** test ships appear ahead of the Forge.
- **+2,000 ore** and **Remove hostiles**.

### Other

| Key | Action |
| --- | --- |
| `H` or `?` | Show or hide the controls card |
| `F8` | Report a bug: what happened, what you expected, with the build, your browser and your save |

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

Monsters: the **Gnasher**, a pack hunter about the size of a fighter. It bites. The Wound's ships are listed under [The Wound](#the-wound-the-tech-demons).

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
  - the galaxy is the same for the same seed, about 300 places in four regions, every place reachable once the hazards are open;
  - each region opens at its own drive level, all of it but its hazard pockets, and not before; each part lies where the drive that can fetch it reaches without opening any hazard;
  - one day's water, food, air and Glim exactly; shortages that weaken but never kill (five days without food, forty without water), low stores, no crew;
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
- **Levels and upgrades** (`tools/ranktest.js`): checks that:
  - kills no longer earn levels; level 3 adds 10% hull and 10% damage; nothing goes past level 5;
  - a ship that launched and came home gains one level, however often it docked, and launches on the next map at that level;
  - ships aboard mend 5% a day, 20% with repair bays;
  - an upgrade that needs another is refused until that is built;
  - two hangars give 50 capacity; launch rails and the foundry line are faster; fire control is set.
- **Named crew** (`tools/crewtest.js`): checks that:
  - a new voyage fills all nine posts and gives every armed ship a named lead (and the miners none); the same seed gives the same people;
  - traits work through their conditions: repairs with a Gifted, a Green and a neutral chief engineer; a Fair-weather grower at morale 70 and 50; a Homesick one on day 100 and 260; a Gifted navigator and quartermaster; morale pulled up by the Beloved and down by the Grim; the Green turning Steady after 50 days;
  - losses are fair: losing half the free hands, 200 times, kills about half the named officers among them; forty days of losses kill named people, the memorial names them and every post is refilled; forty days of hunger kill nobody;
  - on a map: an Ace's Dart hits 20% harder, a Careful pilot's has 20% more hull, a Quick study learns faster; a new Dart gets a new pilot; a lead dies with their ship, a Lucky one gets out and comes home Shaken; the report and the voyage agree on who; a lead standing by takes the next ship;
  - events fill in names, `kill` and `mark` work, the memorial waits for three dead, and an unknown `{placeholder}` is a content error;
  - a save from before named crew loads with named crew, replays a visit in progress without the new traits, and saves again identically;
  - head counts and names agree at every step, and at the end of whole scripted voyages.
- **Memories and the Loom** (`tools/memorytest.js`): checks that:
  - there are 31 memories in five branches, and every one in this build can be had;
  - a new campaign remembers nothing;
  - the first life opens dark, with only the places one lane away known and no deep scans. The signal's circle contains the Anchorage without being centred on it. The Anchorage is in the Drift, 3 to 5 stitches from waking;
  - cutting its core brings back the emblem and the radar, with an echo and their story. The chart lights up, and the next drive part comes as a circle, not a place;
  - 300 clue circles on 30 seeds, full and short, each contain their place; a second clue shrinks a circle and it still contains the place; coming close pinpoints it;
  - life 2 remembers it all, wakes with a lit chart and a stronger drive, and never needs the Anchorage again;
  - the Wisp needs the radar and an echo; things from later milestones and things that must be found can't be recalled; the echo where a life ended waits until you go back for it;
  - a Talon blueprint in life 1 lets life 2 build Talons;
  - the new event words parse, and a bad clue is a content error;
  - a save from before memories keeps its sensors, drive parts and hulls as memories, and saves again identically.
- **Hazards** (`tools/hazardtest.js`): checks that:
  - there are four hazards, each opened by a memory and reported by a post;
  - every galaxy (12 full, 12 short) has pockets: places in one region, never the wake-up point, a drive part, an anchor or a station, with a cache wreck inside; every lane in from outside carries the hazard and no lane joins two pockets; no drive gets in without the memory, and with it the pocket opens at its region's drive level; the same seed carves the same pockets;
  - the right officer reports each hazard by name; with the post vacant, whoever is acting speaks, or the crew; the navigator reports the drive's reach and the Veil;
  - the memory can't be recalled before the hazard turns the Forge away; being turned away costs no days or Glim and is remembered; then it costs two echoes, opens the way, and stays open in the next life while the others stay closed;
  - the cache gives two echoes once, not twice, and not again in a later life; places in a pocket yield half again as much;
  - drifting is refused too; a voyage saved inside a pocket can get out;
  - the test captain gets home in a single life on 50 full and 50 short seeds, going round every pocket.
- **The base and survival** (`tools/basetest.js`): checks that:
  - there are 17 rooms for 8 slots; the mess hall needs its memory; eight rooms fill the deck plan and a ninth won't fit, but plating takes no slot; stripping takes a day and frees a slot; the still room saves water and the quarters add berths; a new life wakes with an empty deck plan, remembering how;
  - with no water, thirst strain rises a level a day to 3 and eases off a level a day after; the mess hall eases hunger and thirst faster; penalties are capped at four levels; the right stations go dark at 2 and 3 for each shortage; dark engineering, foundry and life support lose what they do; two hundred days with nothing kill nobody;
  - the boilers burn 10 Glim a day and go cold without it (systems at half, cold strain, stations cold), and light again;
  - costs follow the mood (content, uneasy, angry: 100%, 110%, 130%); a store gone makes them angry, and says why; crowding counts; an angry, strained ship with its stores back is content again within days of rest; content crews work faster;
  - under morale 15 one more station strikes each day; a parley (a day, or cogmarks) or morale over 30 ends it;
  - All hands starts when every station is green, with its bonus (work 121%, Glim 90%, ships 105%) and steady morale, earns a song after six days, and stops the day a station dims or a store runs out;
  - cogmarks are worth 1 either way; a trader's purse limits what they pay out; settling makes the difference exactly; a dark stores station charges more; a new life has 60; Shearers find them in wrecks;
  - a map is told the mood, its causes, ship cost and strength; on the map a Dart costs 150% at 150%;
  - strain, strikes and All hands save and load exactly; older saves load with none.
- **Traders and crew** (`tools/tradertest.js`): checks that:
  - there are four traders, one in each region, never in a pocket or on a story place, reachable at the region's drive level; there are two wayhouses a region; the same seed places them the same way;
  - a trader has no map to play, holds its own stock, prices by standing with its faction, and won't trade with the Hostile;
  - the workshop needs its plan, which can be bought once a life; the next life, the plan is gone, the trader has one again and the chart still shows where it is; the Murmur sells echoes and a clue; the Last Stop sells Sabre plans and a chart;
  - drifters come aboard once a life, some with names; they need berths, and hiring stops at the berths.
- **The story** (`tools/storytest.js`): checks that:
  - every story place is in its act's region, reachable at its drive level, never in a pocket or on a trader, the lair at the Shore's edge, the Hollowkin holds in the Middens, on 10 full and 10 short galaxies;
  - every story memory can be had in play, act by act, and every one has its text;
  - the date is UNKNOWN until the Horologe, shows the last record after the emblem, runs with the days, and stays known in a new life;
  - the narration's 57 lines each have their own id, every scene with memories has gap lines, each scene appears only with its memories, and the last follows the ending;
  - the Mainspring's core takes no harm while its organs live, the Twain answers it, a fleet of frigates, destroyers, lances and escorts kills it, and the battle is deterministic;
  - the final jump needs the Heartstone and the Mainspring dead; the escape and true endings, with the true ending's three choices; the new peoples;
  - the test captain reaches the true ending on every seed tried, dying and waking on the way.
- **The tech demons** (`tools/demontest.js`): checks that:
  - all eight types are in the rules, and each counter works both ways round in cost-matched fights (Pickets beat Ticks, Stingers beat Halberds, Chimes beat Darts, Talons beat Hounds, Darts beat a Gnawer, a Gnawer beats Halberds);
  - an Hour grows Chimes against fighters, Stingers against big hulls and its own mix otherwise; Feeders strip wrecks for ichor and starve when the wrecks were salvaged first;
  - on a real map with a Hand, the AI grows ships, attacks in waves, falls back when a wave breaks and comes again; an Hour plants Nurseries, drags time and runs to regrow; demon maps are deterministic;
  - an infested place has its Nurseries, garrison and haze; burning them all cleans it for the life, with an echo;
  - attention rises with memories, days and staying put, and falls with silent running, the Choir and static fields; Hunted sends a Hand from the Shore, Marked two; a new life wakes near what its memories earned;
  - a Hand catches the Forge and harasses it but never ends the life; tearing free costs; the Forge outruns it; a Hand shaken off regrows; one destroyed is gone for the life and attention falls a step; Hands infest; old saves load.
- **The muster and levels** (`tools/mustertest.js`): checks that:
  - the hangar berths 10, an expanded hangar three more, and no trader sells a hull with every berth full;
  - eleven ships for ten berths call a muster, nothing stitches until it is settled, and keeping all eleven is refused; scrapping returns half the ore and moves the crew into the Forge (the pilot stands by); leaving adrift loses the ship and its crew, the pilot on the memorial;
  - on a real map, ships that launched and came home gain a level and ships held in the bays don't; a pilot dies with their ship;
  - reaching level 3, a pilot is offered three different perks and picks one, once; at level 5, a second from three they don't have;
  - each perk does what it says on a map: defensive stance, guarding the Forge, the most damaged target, a longer hunt, and turning for home when badly hurt;
  - a save from before levels turns its ranks into levels.
- **The bridge** (`tools/bridgetest.js`): checks that:
  - there are nine stations, each with its officer (the signals officer runs comms), and two trained skills each;
  - the first life wakes with sensors and the infirmary dark and the rest manned; once the radar is remembered, sensors are lit from day 1 of every life; the infirmary opens with its memory and room; strain takes a station to level 0;
  - training costs 30 cogmarks and a day to level 2, 60 and two days to 3, half where Jacob remembers; not without the cogmarks, on strike or before a station opens; an officer's work counts half at level 1;
  - every one of the 18 trained skills does what it says, decoding tightens a circle within a few arrivals, and triage pulls about a third of lost leads out alive;
  - in the next life memories last and every station is back at level 1;
  - training saves and loads exactly; an older save loads untrained, and a signals officer steps up the next day.
- **Campaigns and lives** (`tools/campaigntest.js`): checks that:
  - a new campaign starts on life 1 with one save; the first life opens with the prologue, later ones with waking;
  - after letting go, the next life is life 2, in the same galaxy, on day 1, at the wake-up point, with stores, systems, hull, fleet and drive parts as they were at waking;
  - the same crew wake, the dead among them; the chart keeps every place it knew and marks places visited before; the memorial keeps the lost; the Choir's standing carries over and nobody else's does; hints stay seen; the campaign records how each life ended;
  - the same place has the same name and type in every life, but different contents in life 2, always the same for life 2; the first life keeps its old seeds; random events fall differently in life 2; a map in life 2 is deterministic;
  - a later life saves and loads identically; saves from before campaigns (permanent death, free saves, before named crew) load as a first life;
  - the test captain lets life 1 go on three seeds, wakes knowing more of the chart, and gets home in a later life.
- **Whole campaigns** (`tools/runtest.js`): the AI captain (`tools/captain.js`) plays the real loop, answering every event: it can die (it builds warships from its ore, mends the hull, tears free of Hands it can't beat, fights those it can, and loses fights the way a real map shows), wakes, spends its echoes on the Loom and goes further each life. It checks that:
  - on eight seeds of each size the captain reaches the true ending;
  - a full galaxy takes 5 to 8 lives and 9 to 13 hours (median), a small one 3 to 5 lives and 5 to 9 hours, and a life typically lasts 60 to 130 minutes. The estimate is 15 minutes per map visit, three quarters of a minute per stitch order and a tenth of a minute per day;
  - a first-life escape from a full galaxy is possible but rare: a strong captain manages it on at least one seed in eight, a decent one on at most two; on a small galaxy a decent captain escapes the first life on at most half the seeds;
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
- **Style** (`tools/styletest.js`): checks that:
  - every pair of text and background colours the screens use has a contrast of at least 4.5:1: the soot panels, the parchment chart (names, regions, the Veil, pencil, the Hands), telegrams (ink, the Gaunt's burned paper, the Choir's light, the standing stamps) and the gauges;
  - every hull, in every faction's plating, stays within its budget: 40 meshes and 1,500 triangles under 5 units long, 80 and 3,500 under 20, 130 and 9,000 above; a 40-a-side battle of the line stays under 1,400 meshes and 70,000 triangles (about 1,310 and 57,000: gun barrels, coils and stack fittings are merged into one mesh each);
  - every faction that builds ships has its plating, the Rivet Moot's is patched and the Synod's is cream, and no two share a colour;
  - the Forge has three smokestacks, a halberd and a sabre have theirs, a dart has none; big plates have portholes; halberds, pickets and sabres carry spinning rotary guns; creatures, the Choir, the Wound and wrecks get no steam;
  - the Spindle's lance throws lightning and the Choir's light stays a beam;
  - every kind of place has a wax seal with a colour and a letter, gauges sweep their full arc and warn when low, and the medallions and cause icons are labelled.

To look at the models, open `/tools/gallery.html` on the local server (`?faction=rivet` for another plating, `?only=forge` for one hull).

### Tester builds

```bash
bash tools/build-qa.sh qa-1
```

Copies the game into `dist/driftforge-qa-1/`, stamps the build (its name, the commit and the date) into `src/version.js` so it shows at the foot of the title screen and in every bug report, adds a README for players, and zips it as `dist/driftforge-qa-1-itch.zip` with `index.html` at the top, ready for itch.io (a project of kind HTML, played in the browser). `guide.html` is the tester guide: the controls, what to test and how to report a bug.

Testers report bugs with `F8` (or **Report a bug** on the title screen): what happened and what they expected, plus the build, the browser, the screen, what the game was doing (seed, life, day, place), its last errors and, unless they untick it, the save. They copy it or save it as a file and send it on. To replay their game, paste the whole report into the browser console:

```js
driftforge.loadReport(`...the report...`)
```

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
content/core/items.yaml         the Skein Drive's four parts, blueprints, and the rooms of the deck plan
content/core/voyage.yaml        every number behind the voyage (needs, life support, hydroponics,
                                stitch costs, repairs, morale, the boilers, the deck plan), strain,
                                moods, strikes and All hands, and the Forge's systems
content/core/names.yaml         name generators (derelicts, and people)
content/core/crew.yaml          named crew: officers' posts, the stations they run, traits, ship leads (the format is at the top)
content/core/memories.yaml      the Loom: 31 memories, and the anchors where story memories wait
content/core/traders.yaml       the four regional traders: where, whose, their dialog and stock
content/core/hazards.yaml       hazards: what each closes, who reports it and what they say, the memory
                                that opens it, its pockets per region and its colour on the chart
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
                      Diplomacy, Station, Burrows, Interdicts, Sensors, Shroud, Ranks; the Wound's
                      Feeds, Gestates, Buds, Drags, Flees and its mind, WoundAI, in demons.js; the
                      Mainspring's Organs, Regrows and the LairBattle in mainspring.js, ...)
src/activities/       per-actor tasks (FlyTo, Launch, Harvest, DeliverOre, Attack, AttackMove,
                      FormationMove, DockHangar)
src/galaxy/           the voyage: the galaxy generator (galaxy.js), the day clock, stores, systems,
                      travel and saves (voyage.js), lives (life.js), the crew (crew.js), the base: rooms, strain,
                      stations, mood, strikes and All hands (base.js), standing (standing.js),
                      comms, dialogs, trade and treaties (comms.js), events (events.js), the Wound's
                      attention, Hands and infested places (wound.js), the ending narration's scenes
                      (narration.js), practice runs (run.js)
src/render/           three.js scene: space backdrop, procedural ships, the Wound's grown hulls
                      (demons.js), rocks, clouds, crystal, nebulae, wrecks, combat effects, the star
                      chart (galaxy.js)
src/ui/               orbit camera, movement disc, input, HUD, the star chart screen (chart.js), the
                      comms and trade panel (comms.js), the Loom (loom.js), the bridge (bridge.js), the
                      ending narration (narration.js), audio
tools/                dev server, headless tests, the abstract captain (captain.js), determinism lint
```

The simulation uses integer maths only: 1024 world units per cell and 1024 angle units per turn, with z pointing up.
Rendering reads the simulation state and interpolates between ticks. Every player command goes through the order queue, so lockstep multiplayer, replays and save/load can be added later without a rewrite.

## Credits

Everything in this project is original: names, factions, story, ship designs and UI.
three.js is MIT licensed; see `lib/LICENSE`.
