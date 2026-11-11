# Driftforge: plan

*Version 3, the loop redesign. **Proposed, and waiting for your decisions in §17.** No game code changes until they are answered. Milestones 1–13 are built (§12). Approved names are in §15, earlier decisions in §16. Part II, at the end, describes the game as it is built today.*

Driftforge is a space survival game for the browser, built in three.js on a deterministic engine.

You wake aboard the **Forge**, a great foundry-ship adrift in the middle of a galaxy of scrap. You don't know where you are, who you are, or why you are here. You keep the crew alive, build the Forge up, and fly its fleet in real-time battles. Piece by piece, you remember what happened. When you die, the Skein Drive drags you back to the moment you woke, in the same galaxy, and everything you remembered comes with you.

The game keeps its two layers:

1. **The star chart and the Forge.** Management, paused until you act: where to go, stores, crew and mood, rooms, trade, and the memory tree.
2. **Point-of-interest maps.** Real-time strategy in open 3D: gather, salvage and fight, then leave.

Around them is a new outer loop: the **campaign**. A campaign is one seed, one galaxy and one memory tree, played over many **lives**.

Inspirations:
- **Valheim:** one world, and progress by unlocking what lets you go further.
- **Civilization VI's tech tree:** a visible tree of unknowns.
- **Frostpunk:** a settlement's mood under pressure, lighter here.
- **Homeworld:** fleet battles.

No names, assets or lore are taken from any of them. Everything stays data (YAML), so content packs can add regions, memories, traders and stories.

---

# Part I: the new design

## 1. The concept on one page

- **A campaign is one galaxy.** You choose a seed when you start a campaign. The layout, the story locations and the traders are fixed for that campaign. A new campaign means a new seed and starting from zero.
- **A life** starts at the wake-up point on day 1, with the Forge as it was when you woke. It ends when the Forge is destroyed, the crew are gone, or the air runs out. Then you wake again: same galaxy, same moment, and everything you remember.
- **Memories are the progress.** About 30 memories sit in a tree screen called **the Loom**. Unknown ones show as question marks. There are two kinds:
  - **Knowledge:** story, lore and locations.
  - **Abilities:** radar, shields, ship types, Forge rooms and new options.

  Once remembered, a memory stays for the whole campaign.
- **Routes stay closed until you remember.** Asteroid shoals need shields, the Veil needs the Stillwater Lens, and so on. When you try to go there, a named officer tells you why you can't. Remembering opens the route for good, and it leads into parts of the galaxy you couldn't reach before.
- **The chart remembers.** Places you discovered, traders you found and clue circles stay marked after death.
- **The Forge is a small base.** You build rooms, keep people fed, and trade in a new currency. The crew's mood shows as a clear green, amber or red mark. A bad mood makes everything cost more.
- **After each map, you muster the fleet.** The hangar holds 10 ships to start. You keep the best and scrap or leave the rest. Ships that come home from a map gain a level. Ships that die are gone, with their pilot.
- **Each region has its own trader.** You trade with them straight from the chart, with no map to play.
- **Steampunk space.** Brass, copper, rivets, steam, and Glim burning in boilers. A style guide comes first, for your approval.
- **The goal is to escape the galaxy.** Proposed: a skilled player can escape in their first life, but the true ending needs every memory.

## 2. The campaign and its lives

### One galaxy, many lives

- **Starting a campaign:** pick a seed, or take a random one, and the galaxy is generated. This is today's generator, with additions (§5).
- **Starting a life:** the Forge wakes at the start point in the middle of the galaxy, which is the Drift around the dead star Orrin. It is day 1, with the starting stores, crew and fleet.
- **Ending a life:** death works as today:
  - the Forge is destroyed on a map;
  - nobody is left aboard;
  - three days pass without air.

  A wake screen follows. It shows how long this life lasted, what you found and who was lost, and then you wake again.
- **Giving up a life (decision 9):** "Let the Skein take us." A button on the chart ends the life on purpose, for when a life is going nowhere. It counts as a death.

### What carries over and what resets (proposed, decision 5)

| Thing | Across lives | Notes |
| --- | --- | --- |
| Memories, knowledge and abilities | **Kept** | The heart of the progress |
| Routes opened by memories | **Kept** | A remembered system just works from the start of every life |
| The star chart: places discovered, places visited before, traders found, clue circles, exact spots revealed | **Kept** | Places visited in an earlier life get a faded mark |
| Echoes not yet spent | **Kept** | Only if echoes are chosen (decision 11) |
| Galaxy layout, story locations, traders' locations | **Fixed by the seed** | |
| Stores, Forge hull and systems, rooms built, fleet, ship levels, currency | **Reset** | Back to the wake-up state, plus anything memories add to it (for example a remembered cache of stores) |
| The crew | **Reset** | The same officers and pilots wake again, alive (decision 6) |
| Faction standing | **Reset** | They have never met you. Proposed exception: the Choir, who can perceive the loop (decision 7) |
| The day clock | **Reset** | Day 1 |
| What is on each map | **Varies each life** | Your proposal (decision 1) |
| The memorial | **Kept** | The ship's log keeps the name of everyone lost, in every life |

### Map contents vary each life (your proposal, decision 1)

- **Fixed for the campaign:**
  - the galaxy's layout: places, their types and names, lanes and hazards;
  - the story locations;
  - the traders.
- **Different in each life:**
  - which enemies and monsters are where, and how many;
  - resource amounts and what ordinary wrecks hold (story items are always where they belong);
  - random events and ambushes.
- **How:** the map generator's seed already combines the galaxy seed, the place and the visit number. The life number joins them. Events take it too. The repeated parts (the layout, where things are) are the parts you are meant to learn. The rest stays fresh.

### Story locations placed by rules

- A new data file, `anchors.yaml`, defines each story location as an **area** plus a type of place. For example, "our old station is in the Drift, 3 to 5 stitches from the wake-up point, and is a derelict".
- The generator places each anchor somewhere inside its area, decided by the seed. This builds on how drive parts are placed today.
- **The test bot proves every seed is completable** (§13). It plays whole campaigns: it gets every memory, opens every route and reaches both endings. It also checks that a first-life escape is possible for a player who knows where everything is.

### Clues and circles

- Finding a clue draws a **circle** on the chart: "the station is somewhere in here". The circle contains the location but is not centred on it.
- A second clue shrinks the circle.
- A knowledge memory can reveal the exact spot, permanently.
- Circles and exact spots stay on the chart in every later life.

### Saves (decision 8)

Proposed:
- One campaign save that updates as you play.
- Save and quit any time, on the chart or mid-map. Mid-map saves replay exactly, as today.
- No reloading an older save: death is part of the loop.

Today's choice between permanent death and free saves would go away. The alternative is to keep free saves as an option at campaign start.

### Length targets (decision 10)

Proposed targets, all measured by the test bot:

| Run | Target |
| --- | --- |
| A first-life escape by a skilled player | 2–3 hours |
| The true ending | 8–12 hours over about 5–8 lives |
| A short campaign (about 120 places, as the short voyage is today) | 3–4 hours to the true ending |

## 3. Story: waking with nothing

### The opening

- You wake on the Forge's bridge. Alarms are sounding, the Skein Drive is still tearing loose behind you, and the chart is dark.
- The crew wake too, with the same blank. Everyone knows their trade but nobody knows their past. The officers still have their names, and still know how to do their jobs.
- The ship and the people (the Forge, the Meridian Hollow) keep their names in the data, but the player only learns them through memories.

### The first memory: the Anchorage

1. **The signal.** In the first life, the sensors catch one faint signal with an emblem in it, and a clue circle appears in the Drift.
2. **The station.** Inside the circle is a destroyed space station. It has the same emblem as the Forge's hull and the crew's uniforms. Proposed name: **the Anchorage**, the station where the Forge used to dock.
3. **The memories.** Cutting the station's hulk open on its map (a Shearer job, as with drive parts today) recovers the first memories:
   - **Our emblem** (knowledge): who these marks belong to.
   - **The radar** (ability): the chart lights up as far as the sensors reach, and deep scans work. Before this, you only see the places right next to you.
   - **Where we are** (knowledge): the rough shape of the galaxy, with the outlines of its four regions.
4. **Every later life:** you start with the radar working and the Anchorage marked. You don't need to go back.

### Why we wake again (your proposal, decision 2)

The **Skein Drive loops time**. It is the drive that failed and threw the Forge here. When the Forge dies, the drive pulls it back along its own thread to the moment of the tear.

Memories survive because they are not stored in anyone's head. They are woven into the Skein itself, which is where the name **the Loom** for the memory tree comes from. The crew wake blank each time. The drive, and you, remember. This also explains why traders' locations "stay in the ship's systems" after death.

### Two endings (your proposal, decision 3)

- **Escape.** Reach the edge with the Heartstone and jump out. A skilled player can do this in their first life if they find what the route needs: Coils, Lens, Spindle, Heartstone, and the systems that open the routes between them. You get out, but you don't know what you left behind.
- **The true ending.** It needs every memory, including the last story memory, "The whole truth", which only opens when all the others are known. It changes what the final jump means, and depends on the story direction you choose.

### Four directions for the story (decision 4: choose one, or mix)

**A. The Unravelling: something we caused.**
- **What happened:** the Meridian Hollow built the Skein Drive by pulling threads out of folded space. Here, at the Wrack, they pulled one thread too many. The galaxy is coming apart at the seams, slowly, and the scrap everywhere is what's left of the places that went first. Our station was the experiment's anchor.
- **Why we forgot:** the tear that threw us here took the memories with it.
- **Why the loop:** the drive is still tied to the thread it pulled. It keeps snapping back.
- **The true ending:** escape, and the Wrack finishes unravelling behind you. Or, knowing everything, put the thread back: mend the tear and stay, or go home as the ones who fixed it.
- **Gameplay hook:** "frayed" places, where the map itself flickers. Late memories let you stitch the fraying shut.
- **Fits:** the Choir (who know what the Skein is) and the Cinder Pact (another Forge that tried and failed).

**B. The Tithe-Taker: something hunts us.**
- **What happened:** something lives in the dead star Orrin, and it eats ships that fold space. The Wrack is its larder. Our station fought it and lost.
- **Why we forgot:** we made ourselves forget on purpose. It finds you by what you know, and a blank mind is harder to see.
- **Why the loop:** a trap of our own design, keeping us alive until we could win.
- **The true ending:** remember enough to kill it or bind it, and free the galaxy behind you.
- **Gameplay hook:** a **hunter** that moves on the chart each life. It gets closer the more you remember, making each life a race. Late memories hide you (silent running) or let you fight back.
- **Fits:** the Gaunt (who serve it, or hide from it), the Scrapwyrms (its spawn) and the Hollowhorn (an old enemy of it).

**C. The Jar: the galaxy is a trap.**
- **What happened:** the Wrack is a built thing, a galaxy-sized snare made long ago to catch ships that fold space. Every faction here descends from an earlier catch. The Cinder Pact are a Forge that was caught two hundred years ago. Our station was built to study the snare from inside, and it failed.
- **Why we forgot:** the Jar takes memories, so that its catches stay.
- **Why the loop:** the Jar resets us. It is testing us, like the others.
- **The true ending:** find the seam the builders left, and choose whether to open the Jar for everyone or slip out alone.
- **Gameplay hook:** watcher-machines on maps that "measure" you. Lore about the earlier catches is scattered through every faction.
- **Fits:** all five factions, as earlier catches. A strong reason for the Choir to be strange.

**D. The Verdigris: a spreading blight.**
- **What happened:** a green corrosion, a living rust, is eating metal and minds. It started at our station. The Wrack's scrap is what it leaves behind, and it spreads outward from the core.
- **Why we forgot:** forgetting is its first symptom.
- **Why the loop:** the drive's quarantine. It keeps pulling us back to before we were infected.
- **The true ending:** carry the cure, not the blight, out of the galaxy. Or burn it out at its source.
- **Gameplay hook:** a **spreading front** on the chart. Each day of a life, infected places spread, change, and turn hostile, which gives every life a natural clock. Late memories slow the spread or cure places. It fits the steampunk look: copper turning green.
- **Fits:** rust mites (its carriers), the Synod (who quarantine), the Rivet Moot (who are losing their towns to it).

All four keep everything already built. They change which story memories exist (the Origins branch, §4), what the story events say, and the true ending. B and D add a clock to each life, beyond the stores running down. A and C don't.

## 4. The memory tree: the Loom

### The two kinds

- **Knowledge.** Story, lore and locations. Knowledge memories reveal the Anchorage, the shape of the galaxy, an exact spot inside a circle, or where a trader is. They also tell the story.
- **Abilities.** These change what you can do:
  - **systems** that open routes: radar, shields, heat baffles, the drive's parts;
  - **ship types** the foundry can build;
  - **rooms** you can build on the Forge;
  - **new options**, such as a blind stitch or silent running.

### How memories are earned (decision 11)

**Option 1: found only.**
Every memory sits at a place or in an event. You see the tree's shape, but nothing to spend.

**Option 2: found, plus echoes (recommended).**
- **Echoes** are fragments of memory. You gather them at:
  - clue sites;
  - old wrecks;
  - certain events;
  - the place where you died in an earlier life. Your echo waits there, much like going back to your gravestone in Valheim.
- **Story and drive memories** are found at their story locations and cost nothing.
- **Ability memories** show up on the Loom once you have seen what they are for:
  - a hazard that turned you away;
  - a wreck of an unknown hull;
  - a room plan at a trader.

  Then you spend echoes to remember them, if you already know the memories they need.

Option 2 gives every life something to gather, makes a death worth something, and lets you choose your path, much like Civilization's tech tree.

### The screen

- The Loom is a tree laid out like a loom, with threads running between memories.
- **Known** memories glow and show their name and what they gave you.
- **Unknown** memories show a stamped question mark. Their threads show what leads to them, and sometimes a hint, such as "Something about the heat near Orrin".
- With echoes, a memory you can afford is picked out, and you spend echoes on it right there.

### Draft tree (31 memories, decision 12)

| # | Memory | Kind | Branch | Needs | What it gives |
| --- | --- | --- | --- | --- | --- |
| 1 | Our emblem | Knowledge | Origins | Found at the Anchorage | The Anchorage marked forever; the first step of the story |
| 2 | The radar | Ability | Origins | Found at the Anchorage | The chart lights up within sensor range; deep scans |
| 3 | Where we are | Knowledge | Origins | 1 | The outlines of the four regions; the Drift's lanes |
| 4–8 | Five story memories | Knowledge | Origins | Story locations, in order | Written once the story direction is chosen |
| 9 | The whole truth | Knowledge | Origins | Every other memory | The true ending |
| 10 | Threadwound Coils | Ability | The Skein | A story location in the Drift | Stitches 1.5× longer: the Middens |
| 11 | Stillwater Lens | Ability | The Skein | The Choir, or a location in the Middens | Stitches through the Veil: the Hush |
| 12 | Anchor Spindle | Ability | The Skein | The Ashen Gaunt, or a location in the Hush | Long stitches; holds against the Undertow: the Shore |
| 13 | Heartstone | Ability | The Skein | A location in the Shore | The final jump |
| 14 | Blind stitch | Ability (option) | The Skein | 10 | Stitch to a place you can't see, at a risk |
| 15 | Boiler overdrive | Ability (option) | The Skein | 10 | Once a day, burn double Glim to stitch one lane past the drive's reach |
| 16 | Shields | Ability | The Forge | Turned away from a shoal | The asteroid shoals open |
| 17 | Heat baffles | Ability | The Forge | Turned away from an ember lane | The ember lanes near Orrin open |
| 18 | Lightning rods | Ability | The Forge | Turned away from a static field | The static fields open |
| 19 | Lead-lined decks | Ability | The Forge | Turned away from the Glare | The radiation belts open |
| 20 | Silent running | Ability (option) | The Forge | 18 | Fewer ambushes on the chart; on maps the Forge starts unseen |
| 21 | The emergency cache | Knowledge | The Forge | An event | Where the Forge's emergency stores were hidden: each life starts with more water, food and Glim |
| 22 | Wisp | Ability | The fleet | Seeing one | The scout hull |
| 23 | Talon | Ability | The fleet | A Talon wreck | The bomber hull |
| 24 | Sabre | Ability | The fleet | A Sabre wreck, or the Shore's trader | The frigate hull |
| 25 | Spindle | Ability | The fleet | A Spindle wreck | The heavy frigate hull |
| 26 | Monolith (new hull) | Ability | The fleet | Deep in the Shore | A capital ship |
| 27 | Mess hall | Ability | The decks | — | A room: mood rises faster |
| 28 | Infirmary | Ability | The decks | 27 | A room: fewer deaths from hunger and bad air; a pilot sometimes gets out of a lost ship |
| 29 | Chart room | Ability | The decks | 2 | A room: clue circles shrink, deep scans are cheaper |
| 30 | Second hangar deck | Ability | The decks | — | A room: +5 hangar berths |
| 31 | Workshop | Ability | The decks | — | A room: scrapping returns more; repairs cost less |

Most of this already exists in some form:
- the four drive parts and their effects;
- the radar (sensor range);
- the hulls and their blueprints;
- several rooms, which are today's engineering projects.

### Design rules

- **Options over stat boosts.** A memory should open something: a route, a hull, a room, a choice. Flat percentages stay small and rare.
- **Never undone.** A memory is never lost within a campaign.
- **Data.** Memories are YAML (`memories.yaml`): name, kind, branch, what it needs, where it is found, and what it gives. What it gives uses the event-effect vocabulary, plus new effects: `remember`, `open hazard`, `unlock hull`, `unlock room`, `reveal anchor` and `give echoes`. A content pack can add memories.

## 5. Routes closed until remembered

### Hazards

| Hazard | Where | Opened by | Who reports | What they say (example) |
| --- | --- | --- | --- | --- |
| **Asteroid shoals** | Lanes into dense debris pockets in the Drift and the Middens | Shields | Chief engineer | "Shields are dead, Captain. Take her into that field and the rocks will open us like a tin." |
| **Ember lanes** | Lanes close to the dead star Orrin | Heat baffles | Chief engineer | "The boilers can't shed that heat. We'd cook before we got through." |
| **Static fields** | Ion storms between pockets | Lightning rods | Watch officer | "Every needle on the board is spinning. We'd be stitching blind." |
| **The Glare** | Radiation belts | Lead-lined decks | Surgeon | "Half the crew would be sick in a day. The rest in two." |
| **The Veil** | The nebula wall round the Hush | Stillwater Lens | Navigator | "The Skein won't hold a thread in that." |
| **Long gaps** | Lanes longer than the drive can stitch | Coils, then the Spindle | Navigator | "That's 180 spans. The coils give us 100." |
| **The Undertow** | Gravity shear at the Shore's edge | Anchor Spindle | Navigator | "Something out there pulls. Without an anchor, we'd be dragged under." |

### How it plays

- Lanes with a hazard are drawn closed on the chart, with the hazard's symbol on them.
- Planning a route through one is refused. The officer for that hazard says why, by name, using their real name and post from the named crew. If the post is empty, whoever is acting in it speaks.
- **No way in with damage.** The route is closed until the memory is known. From then on, it opens in every life.
- Opened routes branch into **pockets**: clusters of places reached only through that hazard. Pockets hold story locations, traders, richer places and memories.

### The generator

- **Already built:** today's galaxy has four rings (the Drift, the Middens, the Hush behind the Veil, the Shore), lanes, gate places and range tiers. All of that stays.
- **New:**
  - lanes are tagged with hazards;
  - pockets are carved out of each region;
  - anchors are placed inside their areas;
  - one trader is placed per region.
- **Guarantees:**
  - every place can be reached once the right memories are known;
  - every memory can be reached;
  - with the critical-path memories only, a single life can reach the edge.

  The test bot checks all of this on many seeds.

### The drive parts (decision 13)

Proposed: the four drive parts **become memories** with the same names and effects:
- the Coils widen the range;
- the Lens opens the Veil;
- the Spindle allows long stitches;
- the Heartstone allows the final jump.

They are recovered at their story locations, as today, but there is nothing to fit, and they hold in every later life. The range ring, the Veil and the final-jump rule all stay as they are. Today's "fit a part with ore, salvage and days" goes away.

## 6. The Forge as a small base

### Rooms

- The Forge gets a **deck plan**, a cutaway of the ship with room slots. It starts with about eight free slots. You build rooms with ore, salvage, days and free engineers, as engineering projects work today.
- **Today's eleven engineering projects become rooms**, with the same effects:
  - hangar decks;
  - hydroponic racks;
  - a long-range array;
  - a Glim recycler;
  - plating;
  - repair bays;
  - a foundry line;
  - fire control;
  - launch rails.
- **New rooms:**
  - crew quarters, which set how many people can live aboard;
  - a mess hall;
  - an infirmary;
  - a chart room;
  - a workshop;
  - a still room.
- Some rooms can be built from life 1. Others first need their memory.
- **Rooms reset each life** (decision 15). The memory of how to build them doesn't.

### Resources

- Water, air and food keep people alive, as today.
- Ore and salvage pay for building, repairs and ships, as today.
- Glim fuels stitches, as today, and the boilers (see below).
- Spores feed the hydroponics, as today.

### Currency (decision 16)

- **Proposed names:** **cogmarks**, which are stamped brass cogs (recommended); **tallies**, which are punched brass cards; or **brassbits**.
- **How it fits the barter system:** trade today is barter, and every good already has a value. Cogmarks make that value something you can carry:
  - Sell goods for cogmarks, up to what's in the trader's purse.
  - Buy with cogmarks.
  - Or swap goods directly, as now, with cogmarks covering the difference.

  Prices still come from value, standing, stock and what the trader wants, through the same quote code.
- **Where they come from:** selling goods, strongboxes in wrecks, bounties from factions, and some events.
- **What they buy:** trade goods, crew, ships, and a trader's unique items and room plans.
- **What they don't buy:** building on the Forge still takes materials, not money.
- **Per life:** cogmarks reset with everything physical.

### Crew mood

The crew's **mood** is a mark everyone can see. It is built on today's morale, the 0–100 number that rises with rest and full stores and falls with shortages and losses.

| Mark | When | Effect (proposed numbers, decision 17) |
| --- | --- | --- |
| **Content** (green) | Fed and cared for: morale 60 or more, nothing running short | Repairs and building go 10% faster |
| **Uneasy** (amber) | Hungry: a store running low, or morale 30–59 | Building, ships and the Glim for each stitch cost 10% more |
| **Angry** (red) | Very hungry: a store gone, or morale under 30 | Building, ships and the Glim for each stitch cost 30% more. Under 15, people desert, as today |

- **On screen:** the mark is a medallion in the top bar of both the chart and the maps. Small cause icons sit beside it: hunger, thirst, bad air, cold boilers, grief after deaths. You always see how they feel and why.
- **The officers' traits still count:** Beloved and Grim officers already push morale up or down (Milestone 13).
- **Stopping the spiral:** a red mood makes things cost more, which can make the mood worse. Resting, a mess hall and full stores pull it back. The numbers are tuned so it can always be climbed out of.

### Keeping the Forge running (decision 18)

A light version of Frostpunk's coal. Three options:

**a. The boilers burn Glim (recommended).**
- The Forge already burns 3 Glim a day for its reactor. That becomes the boilers, with a visible pressure gauge, and the draw rises to about 10–15 a day.
- If Glim runs out, the boilers go cold:
  - every system works at half;
  - life support slows;
  - the crew get cold (an amber or red cause icon).
- One resource you already collect, with a real reason to keep some in reserve beyond stitching.

**b. A new fuel.**
- Coke, a dirty fuel made from ore at a smelter, feeds the boilers. Glim stays only for stitches.
- More to manage, and one more resource on the maps.

**c. Nothing new.**
- Hunger, thirst and air are enough pressure.

## 7. The hangar and the fleet after battles

- **Hangar berths.** The hangar holds **10 ships** (by count, not today's capacity points), and hangar rooms add berths. On a map you can still build past that, up to the map's fleet limit as today. Building more than the hangar holds forces a choice later.
- **The muster.** When the Forge leaves a map, the report screen lists the ships that came aboard. If there are more than the berths, you choose which continue. For each leftover ship:
  - **Scrap it:** half its ore comes back, and its crew move into the Forge.
  - **Leave it adrift:** the ship and its crew stay behind and are lost.

  Ships still outside when the Skein fires are left behind, as today.
- **Levels (decision 20).** These replace today's experience from kills:
  - A ship gains a **level for each map it launched on, survived, and came home from**.
  - Levels run from 1 to 5. Each level adds a little damage and hull, proposed at +5%.
  - At levels 3 and 5 the pilot picks a perk, which is an option rather than a number: for example "covers the Forge" or "won't break formation".
  - The pilot's trait still applies (Milestone 13).
- **Losses are permanent.** A ship lost on a map is gone, and its pilot with it, as today. A Lucky pilot can still get out once.

## 8. Traders and crew

### Regional traders (decision 21)

- **On the chart:** traders are their own kind of place, with a distinct icon (a brass bell). They show once discovered, and stay on the chart in every later life.
- **No map to play.** When the Forge is at a trader, you trade from the chart. This reuses today's comms panel and trade screen, so nothing opens in 3D.
- **One per region**, Valheim-style. Each has a personality (a comms dialog) and goods that suit the region, including things you would otherwise have to grind for:

| Region | Trader (proposed) | Who | Sells |
| --- | --- | --- | --- |
| The Drift | **The Lamp & Ledger**, kept by **Wicket Arn** | A Hullborn scrap-broker of the Rivet Moot who never stops talking | Food, salvage tools, the Workshop plan, Gleaner and Shearer parts, hangar fittings; buys ore |
| The Middens | **The Tallow Bell**, kept by **Deacon Ilmar Sloe** | A Lantern Synod refinery-chapel; formal, honest to the letter | Glim, boiler fittings, the Still room, preserved food |
| The Hush | **The Murmur** | A Choirmoth swarm that trades in light | Clue circles, exact spots, echoes, a hint of the Lens; pays in strange coin |
| The Shore | **The Last Stop**, kept by **Ossory Vell** | A Cinder Pact quartermaster, descended from a Forge that never got home; dry and bitter | Warship plans (Sabre, Monolith), charts of the Shore, hired crews |

- **Factions:** each trader belongs to a faction, and prices follow your standing with it (as today). They won't trade if you are Hostile. Faction stations stay as maps you can enter, for fights and missions (decision 22).
- **Stock:** resets each life. Unique items are one per life.

### Crew

- **Where new crew come from:**
  - hull-towns hire crew out, as today;
  - survivor pods and refugee convoys, in events and on maps;
  - places of a new type, **wayhouses**, where drifters ask to come aboard.
- **Limits:** crew quarters set the maximum aboard.
- **New named crew:** sometimes a newcomer is named: a pilot looking for a ship, or someone who could fill an empty post.
- **New ship types arrive over time:** from memories (Fleet branch), from traders (plans), and from cutting wrecks of a hull, as blueprints work today.

## 9. Steampunk space: style guide (proposal)

The art changes only after you approve a **style guide page** with real examples. It is delivered with Milestone 14. Here is what it will propose.

### Materials and mood

- Iron hulls, copper plating and brass trim.
- Rivets in rows, gears, pipes, pressure gauges and steam.
- **Glim** burns pale teal-green in boilers and smokestacks. It is the one cold, bright colour in a warm, metal world, and it keeps today's accent colour.
- Light comes from portholes, boiler glow and Glim exhaust. The tone stays lonely and beautiful.

### Palette (first proposal)

| Token | Colour | Use |
| --- | --- | --- |
| Iron | `#16130F` | Backgrounds |
| Soot | `#221D17` | Panels |
| Brass | `#C9A04E` | Frames, bezels, headings |
| Dark brass | `#8C6A2C` | Borders, engraving |
| Copper | `#B8693D` | Buttons, plating |
| Verdigris | `#4F9C8A` | Secondary accents |
| Parchment | `#E9DCBC` | The star chart |
| Sepia ink | `#3B2A1A` | Ink on the chart |
| Glim | `#9EF0D8` | Glow, selection, the active thing |
| Signal red | `#C2402F` | Danger, Angry |
| Amber | `#E3A33B` | Warnings, Uneasy |
| Enamel green | `#5E9E4F` | Content |

Text must keep at least a 4.5:1 contrast. Mood never relies on colour alone: every mark has an icon and a word.

### Type (first proposal, Google Fonts)

- **IM Fell English SC** for headings and chart labels: old printed charts.
- **Spectral** for body text and the UI: a readable serif.
- **Cutive Mono** for gauge counters and telegraph text.

### Components the guide will show

- **Gauges.** Round brass bezels with cream dials and black needles, with a red zone:
  - water, air, food and Glim, each with a small days-left counter;
  - the boiler's pressure;
  - the Skein's spool as a filling pressure tube.
- **The star chart as a navigation parchment:**
  - stained paper, ink lanes, and places as wax-seal stamps by type;
  - closed hazard lanes as hatched ink with the hazard's symbol;
  - clue circles drawn as dashed pencil rings;
  - traders as bell stamps;
  - region names hand-lettered in italic;
  - a compass rose, and the Forge as a small brass token.

  It stays 3D with the orbit camera, kept flat and readable (decision 13 of §16), like a chart laid on a table.
- **Telegraph comms.** Faction messages arrive as telegram cards in typewriter type. Choices are brass telegraph keys.
- **Mood medallions.** Enamel badges with a face: green content, amber uneasy, red angry. Cause icons are stamped beside them: a loaf, a drop, lungs, a cold boiler, a grave.
- **The Loom.** Memories are brass cogs on a loom frame joined by glowing threads. Unknown memories are blank cogs with a stamped question mark.
- **The deck plan.** A cutaway of the Forge with rooms as lit compartments.
- **Ships:**
  - hulls of dark iron with copper plating bands and brass trim, rows of rivets, portholes with warm light, and smokestacks venting Glim-lit steam;
  - faction looks: patched, mismatched plates for the Rivet Moot; waxy cream and brass for the Synod; rust-red and spiked for the Gaunt; soot-black and ember for the Cinder Pact;
  - the Choirmoths stay organic light, in contrast.
- **Weapons and effects:**
  - autocannons become rotary guns;
  - the lance becomes an arc of lightning;
  - thrusters puff steam.
- **Sound:** hissing valves, clanks, telegraph clicks, and an organ chord when a memory returns.

The models stay procedural (built in code, as today), so the restyle doesn't need imported art, and battles of 40 ships a side stay fast.

## 10. What is reused, what changes, what is new

| Part | What happens | Notes |
| --- | --- | --- |
| Engine: integer maths, actors, traits, orders, lockstep, seeded RNG, sync hash, replays | **Kept** | Determinism stays a hard rule |
| Flight, steering, formations, stances, combat, weapons, fog, sensors, mining, salvage, production, launch bays | **Kept** | The whole RTS layer |
| Point-of-interest generator and place types | **Kept** | Its seed gains the life number |
| Galaxy generator: rings, lanes, range tiers, the Veil, gate places, territory | **Kept, extended** | Hazard lanes, pockets, anchors placed in areas, traders, the Anchorage near the start |
| The voyage state and its rules (day clock, stores, needs, systems, morale) | **Kept as one life** | A new campaign state wraps it: memories, chart knowledge, echoes, deaths, memorial |
| Saves | **Changed** | Version 5: campaign + life + an optional map in progress. Old voyages become campaigns on life 1. The permanent-death/free-save choice changes (decision 8) |
| Drive parts (found, then fitted) | **Replaced** | They become memories; the range ring, Veil and final-jump logic are reused |
| Engineering projects | **Become rooms** | On a deck plan; unlocked by memories; built each life |
| Blueprints | **Become memories and trader plans** | Cutting a wreck of a hull still finds it |
| Veterancy (experience from kills) | **Replaced** | Levels from coming home; the HUD chevrons and Crew-tab rows are reused |
| Fleet capacity (points) | **Split** | A hangar berth count between places; the capacity limit stays on maps |
| Named crew, traits, losses that pick who dies | **Kept** | Officers report closed routes; across lives, decision 6 |
| Morale | **Kept underneath** | Shown as the mood mark, with costs; the slow-work rule is replaced by the marks |
| Factions, standing, comms dialogs, treaties | **Kept** | Standing resets each life (decision 7) |
| Barter trade (value, quote, deal) | **Kept, extended** | Cogmarks; trading at traders from the chart |
| Events, the condition and effect vocabulary | **Kept, extended** | New conditions (`remembers`, `life >=`, `clue`) and effects (`remember`, `echoes`, `clue`, `open`) |
| Hints for a guided first voyage | **Kept** | Rewritten for the first life |
| The test captain | **Extended** | It becomes a campaign captain: plays lives, dies, remembers, and proves seeds completable |
| UI: chart, HUD, comms, report | **Restyled** | After the style guide |
| New screens | **New** | The Loom, the deck plan, the mood medallion, the muster, the trader, the wake screen |
| Ship models and effects | **Restyled** | Procedural steampunk detail |

## 11. Milestones (proposed)

Each milestone is playable and ends with tests, a browser run, the README and a push, as before.

**Why this order:**
- The campaign loop comes first, because everything else depends on what survives a death.
- Memories come next, then the routes they open.
- The base, the muster and the traders are independent of each other.
- The story needs your choice of direction, and benefits from every system being in place.
- The reskin waits for your approval of the style guide. Once you approve it, new screens are built in the new style straight away.

| # | Milestone | Playable result | Checks |
| --- | --- | --- | --- |
| **14** | **Campaigns and lives** (with the style guide page, for your approval) | Start a campaign on a seed; die and wake again in the same galaxy; the chart remembers places; maps vary each life; the wake screen; a campaign save, with old saves migrated. The goal is still today's drive parts | What persists and what resets; same layout but different map contents per life; determinism; old saves load; the bot plays several lives |
| **15** | **The Loom: memories** | The memory tree screen with question marks; memories in YAML; echoes (if chosen); the first life's opening: the dark chart, the signal, the Anchorage, the radar; clue circles; drive parts become memories | Memories persist; the radar beat works on every seed; a clue circle always contains its place; content lint for memories |
| **16** | **Routes closed until remembered** | Hazard lanes and pockets; officers report closed routes by name; anchors placed within areas; shields, heat baffles, lightning rods and lead-lined decks | No way in without the memory; reports come from the right officer (or whoever is acting); the bot completes 50 seeds, and a single-life escape is possible on each |
| **17** | **The Forge as a base** | The deck plan and rooms (from today's projects, plus new ones); crew quarters; cogmarks; mood marks with causes and costs; the boilers (if chosen) | Costs follow the mood; the spiral can be climbed out of; currency and barter agree; rooms reset per life |
| **18** | **The muster and levels** | 10 hangar berths; choosing who continues; scrap or leave adrift; levels from coming home; perks (if chosen) | Berths, scrap returns and crew moves; levels only for ships that launched and came back; the pilot dies with the ship |
| **19** | **Traders and crew** | Four regional traders on the chart (icon, trade without a map, personalities, unique stock), kept after death; wayhouses and new crew; new hulls over time | Traders persist across lives; stock resets; prices follow standing; crew limits |
| **20** | **The story** | The chosen direction: story memories, story locations and events, the escape ending and the true ending | The bot reaches the true ending on every seed tried; every story memory can be reached; the endings play |
| **21** | **Steampunk reskin** | Gauges, the parchment chart, telegraph comms, medallions, the Loom and the deck plan in the approved style; riveted copper ships with smokestacks; new effects and sounds | Screenshots against the guide; text contrast; frame rate with 40 ships a side |
| **22** | **Whole campaigns** | Balance across seeds; the first life rewritten as a guided start; polish | Lives and hours inside the targets; a skilled first-life escape is possible; no seed is unwinnable |

**Later, as add-on packs:** new regions beyond the Shore, new traders, races and factions, more memories and story arcs, and co-op multiplayer (the engine stays lockstep-ready).

## 12. Milestones done (1–13)

| # | Milestone | Result |
| --- | --- | --- |
| 1 | Camera and 3D movement | Orbit camera; movement disc with height line; the flight model |
| 2 | Forge and production | The Forge, a production queue, launch bays, rally points, fleet capacity |
| 3 | Collectors and mining | Asteroid fields, Gleaners, docking, the Smelter, ore income; capsule hulls; steering round obstacles (since added) |
| 4 | Combat | Projectiles, beams, missiles, flak; armour and the versus table; wrecks; the Proving Grounds spawner; the balance matrix |
| 5 | Formations, stances, control groups | Five formations at the slowest ship's pace; aggressive, defensive and passive stances; control groups |
| 6 | Point-of-interest maps from data | Content packs; five place types (then Still Water); ice, salvage, Glim and spores; the Shearer and Skimmer; the hangar, recall, spooling the Skein, the visit report |
| 7 | Galaxy map and the voyage | About 300 places in four regions (the Drift, the Middens, the Hush behind the Veil, the Shore); the star chart; stitching with Glim; the day clock; water, air, food; crew roles and morale; Forge systems and wear; the drive repair track; saves with permanent death; the voyage simulator |
| 8 | Races, factions, reputation | Five races and five factions in YAML; territory and stations on the galaxy; faction fleets on maps acting by standing (hostile, wary, neutral, friendly, allied); firing, kills, helping and theft change standing; the standing screen; an example add-on pack adds a faction with no code |
| 9 | Diplomacy and trade | Hailing from the chart and on maps; comms dialogs in YAML with a fixed vocabulary of conditions and effects; barter trade with prices from value, standing, stock and wants; hiring crew and crewed ships; buying surveys and charts; tribute, ceasefire, peace and leave treaties, enforced on maps and broken by firing; threats |
| 10 | Events, monsters, story | 25 events in YAML (the prologue, each drive part's arrival, discovery and fitting, the Hush, the Shore, the ending; distress calls that may be lures, pods, comet storms, signals, stowaways, spore blooms); Scrapwyrms that lie buried in rock fields and ambush; rust mites that hatch from infested wrecks; the Hollowhorn, whose song shakes a spooling Skein loose; the Choir and the Gaunt as other routes to the Lens and the Spindle |
| 11 | Sensors, fog, engineering | Sensor fog on voyage maps (unseen ships cannot be seen or targeted by anyone; nebulae halve sensor range; last-seen markers); the Tactical Plot (Tab); the Wisp scout; deep scans on the chart; blueprints (Talon, Spindle and Sabre start locked: found by cutting wrecks of that hull, bought, or given in events); five engineering projects |
| 12 | Polish and the first full run | New-run setup (seed, full or short voyage, permanent death or free saves, a guided first voyage with hint cards); saving anywhere, mid-map saves replayed exactly; named save slots; veterancy (ships earn ranks and keep them in the hangar); eleven Forge upgrades, some building on others; ships mend aboard; a sound pass; the AI captain finishes seeded runs of both lengths inside the target play time. No difficulty setting (decided: the pressure is survival and hostiles) |
| 13 | Named crew | Eight officer posts and a named pilot or captain for every armed ship, counted in their roles; 17 traits in YAML (work, damage, hull, learning, morale; conditions; growth; Lucky escapes); losses pick who dies, fairly; leads die with their ships on maps; promotions fill empty posts; crew events by name, the memorial; old saves load with named crew. Decided: officers and pilots are named, everyone else stays a head count; deaths are permanent |

## 13. How each milestone is tested

Every milestone ends, as now, with:
1. headless tests in Node, including a determinism check;
2. a browser run through the real UI in headless Chromium, with no console errors and screenshots I look at;
3. a short summary and an updated README;
4. a commit and a push.

New for the loop:

- **The campaign captain.** Today's test captain plays the galaxy layer. It becomes a player of whole campaigns: it lives, dies, wakes, remembers, and goes further each time. It runs on many seeds and checks that:
  - every memory and both endings can be reached (no unwinnable seed);
  - a single-life escape is possible with perfect knowledge;
  - lives and hours land near the targets (judged by the median, since single runs swing).
- **Persistence tests.** For each item in the "carries over" table, a test dies and checks it.
- **Generator tests.**
  - Anchors always land inside their areas.
  - Clue circles always contain their place.
  - Every pocket opens with its memory.
  - The same seed always gives the same galaxy.
- **Content lint.** It now also covers memories, anchors, hazards, traders and rooms.

## 14. Risks

| Risk | Approach |
| --- | --- |
| Repeating lives gets boring | Map contents vary each life; memories add options, not just numbers; later lives start further ahead (radar, the Anchorage known, routes open); a life can be given up |
| Grind | Abilities never need rebuilding; knowledge memories shorten every later life; traders sell what you'd otherwise grind for |
| Gating makes a first-life escape impossible, or a seed unwinnable | The generator guarantees it, and the campaign captain proves it on many seeds |
| A bad mood spirals | Effects capped in YAML; rest, the mess hall and full stores always pull it back; tested |
| The reskin is a large amount of art | Style guide first; procedural models and SVG/CSS instruments, no asset pipeline; restyle only after approval |
| Old saves | Version 5 migration: an old voyage becomes a campaign on life 1, with its drive parts turned into memories |
| Scope | Each milestone is playable on its own; the story waits for your choice of direction without blocking the systems |

## 15. Names

Approved earlier:

| Thing | Name |
| --- | --- |
| The game | Driftforge |
| The drive | **Skein Drive**: it threads the Forge through folded space; short hops are *stitches* |
| The fuel | **Glim**: a pale, luminous condensate skimmed from nebulae |
| The galaxy | **The Wrack** |
| Start region | **The Drift**, round the dead star Orrin |
| Escape edge | **The Shore** |
| Your people | **Meridian Hollow** (now learned through memories) |
| Drive components | Threadwound Coils, Stillwater Lens, Anchor Spindle, Heartstone (now memories) |
| Races | Hullborn, Tallowfolk, Gaunt, Choirmoths |
| Factions | Rivet Moot, Lantern Synod, Ashen Gaunt, Cinder Pact, the Choir |
| Monsters | Scrapwyrm, rust mites, Gnasher packs, the Hollowhorn |
| Hulls | Shearer (salvage cutter), Skimmer (gas collector), and the combat roster |

Proposed now (decision 24):

| Thing | Proposed name | Alternatives |
| --- | --- | --- |
| The memory tree | **The Loom** | The Spool, the Engram |
| Our old station | **The Anchorage** | Meridian Spire, the Cradle |
| Fragments of memory | **Echoes** | Glimmers, threads |
| Currency | **Cogmarks** | Tallies, brassbits |
| Hazards | Asteroid shoals, ember lanes, static fields, the Glare, the Undertow (and the Veil) | — |
| Traders | The Lamp & Ledger (Wicket Arn), the Tallow Bell (Deacon Ilmar Sloe), the Murmur, the Last Stop (Ossory Vell) | — |
| Places where crew join | **Wayhouses** | Drifter camps |

## 16. Decisions already made

| # | Question | Decision | Under the new design |
| --- | --- | --- | --- |
| 1 | Galaxy map time | **Paused**; it moves only when you act | Unchanged |
| 2 | Death and saves | **Permanent death by default**, with save and quit; a free-save mode offered at the start | **Replaced:** death starts a new life (decision 8) |
| 3 | Run length | **4–6 hours**, plus a **short voyage** of about 90 minutes | **Replaced:** campaign targets (decision 10) |
| 4 | Same galaxy or random | **A new seeded galaxy each run**; story locations placed by rules | **Now:** one galaxy per campaign; story locations placed within areas |
| 5 | Story | **Hand-written story moments plus random events** | Unchanged; the direction is decision 4 |
| 6 | Leaving a map | **Always possible**, but some enemies can interrupt the spool-up | Unchanged |
| 7 | Crew depth | **Officers and pilots are named**, everyone else is a head count; **named crew die for good** | "For good" becomes "for the rest of that life" if the crew wake again (decision 6) |
| 8 | Fleet between maps | **Ships travel with you**, limited by hangar space; losses are permanent | Unchanged; hangar berths by count, and the muster |
| 9 | Scale of fights | **Up to about 40 ships a side** | Unchanged |
| 10 | Sandbox | **Keep the Proving Grounds** for testing | Unchanged |
| 11 | Tone | **Lonely, beautiful and a bit strange, with dry humour** | Unchanged, now in brass and steam |
| 12 | Names | **Keep all the proposals** in §15 | New ones proposed (decision 24) |
| 13 | Galaxy map view | **3D with the orbit camera, kept readable** | Unchanged, styled as a parchment chart |
| 14 | Difficulty setting | **None**: the pressure is survival and hostiles | Unchanged |

## 17. Decisions needed now

Each has a recommendation, so "all recommended, except…" is a fine answer.

**Your proposals**

1. **Map contents vary each life**, while the layout, story locations and traders stay fixed. *Recommended: yes.*
2. **The Skein Drive loops time**, and memories are woven into the Skein. *Recommended: yes.*
3. **A skilled player can escape in their first life; the true ending needs every memory.** *Recommended: yes.*

**The story**

4. **Which direction:** A, the Unravelling (something we caused); B, the Tithe-Taker (something hunts us); C, the Jar (the galaxy is a trap); or D, the Verdigris (a spreading blight). Or a mix. B and D also add a clock to each life. *No recommendation: your call.*

**The loop**

5. **What carries over between lives:** the table in §2. Memories, routes, chart knowledge and the memorial carry over; everything physical resets. *Recommended: as proposed.*
6. **The crew across lives:** the same officers and pilots wake again each life, alive, not remembering, *or* a new crew each life. *Recommended: the same people.* Their deaths are then permanent for the rest of that life, and the memorial keeps every name across lives.
7. **Faction standing resets each life**, except the Choir, who perceive the loop. *Recommended: yes.*
8. **Saves:** one campaign save, save and quit any time, no reloading older saves; the free-save mode goes. *Recommended: yes.* The alternative is to keep free saves as an option.
9. **Giving up a life:** "Let the Skein take us" on the chart. *Recommended: yes.*
10. **Length targets:** a skilled first-life escape in 2–3 h, the true ending in 8–12 h over about 5–8 lives, and a short campaign of 3–4 h. *Recommended: yes, including keeping the short campaign.*

**Memories**

11. **How memories are earned:** found only (option 1), or found plus **echoes** spent on the Loom (option 2), including the echo waiting where you died. *Recommended: option 2.*
12. **The draft tree** in §4 (31 memories in five branches), as a starting point to tune. *Recommended: yes.*

**Routes**

13. **The drive parts become memories** (nothing to fit; the range ring, the Veil and the final jump stay). *Recommended: yes.*
14. **The hazard set:** shoals (shields), ember lanes (heat baffles), static fields (lightning rods), the Glare (lead-lined decks), the Veil (the Lens), long gaps and the Undertow (the Coils and the Spindle). *Recommended: yes.*

**The Forge**

15. **Rooms reset each life**, while the memory of how to build them stays. *Recommended: yes.*
16. **Currency name:** cogmarks, tallies or brassbits. Per life; barter stays alongside. *Recommended: cogmarks.*
17. **Mood marks and costs:** Content +10% work speed; Uneasy +10% costs; Angry +30% costs; desertion under 15. *Recommended: yes, to tune in play.*
18. **Keeping the Forge running:** a, the boilers burn Glim; b, a new fuel; c, nothing new. *Recommended: a.*

**The fleet**

19. **Hangar:** 10 berths by ship count. Scrapping returns half the ore and saves the crew; leaving a ship adrift loses ship and crew. *Recommended: yes.*
20. **Levels:** only ships that launched and came home gain a level; 5 levels at +5% each; a perk choice at levels 3 and 5; kills no longer count. *Recommended: yes.*

**Traders**

21. **Four regional traders** as in §8, each tied to a faction, trading from the chart. *Recommended: yes.* A wandering trader could come later as an add-on.
22. **Faction stations stay as maps** you can enter (fights and missions), separate from traders. *Recommended: yes.*

**Art and names**

23. **Style guide first** (with Milestone 14), then new screens in the new style, then the full reskin (Milestone 21), with procedural steampunk ship models. *Recommended: yes.*
24. **The new names** in §15: the Loom, the Anchorage, echoes, cogmarks, the hazards and the traders. *Recommended: approve, or rename any.*

---

# Part II: the game as built (Milestones 1–13), for reference

This is how the game works today. Part I says what changes.

## The two layers

1. **The galaxy map**, a management layer. You choose where to go next, spend fuel and supplies, look after the crew and the Forge's systems, and track the repair of the drive.
2. **Point-of-interest maps**, a real-time strategy layer. Every place you visit opens a 3D map. There you mine, salvage, trade or fight, then leave.

The goal of a voyage today: find and fit the Skein Drive's four parts, reach the Shore, and make the final jump. You lose if the Forge is destroyed, the crew reaches zero, or the air runs out for three days.

## The galaxy

- **Places:** about 300 (120 in a short voyage) in four rings: the Drift around the dead star Orrin; the Middens; the Hush behind the Veil; the Shore. They come from a seed.
- **Lanes and gates:** places are joined by lanes. Gate places and a spanning tree per region guarantee every place can be reached.
- **Drive gating:**
  - the Threadwound Coils allow stitches of 150 spans;
  - the Stillwater Lens opens the Veil;
  - the Anchor Spindle allows stitches of 201 spans;
  - the Heartstone allows the final jump from the Shore's edge.
- **Factions:** they hold seats (stations) and territory.
- **Travel:** a stitch costs Glim and days. Drifting at sub-light costs no Glim but takes many days.
- **The day clock** only runs when you act. On a map, 1 day = 4 minutes of play.
- **Each day:** the crew drink, eat and breathe; life support makes air from water; hydroponics grow food from water (faster with spores); the reactor burns a little Glim; morale drifts.
- **Systems:** drive, reactor, life support, hydroponics, foundry and sensors. They wear with hull damage and are repaired with ore, salvage and engineers.
- **The Forge's screens:** systems, the drive's parts, engineering projects, the crew, the hold, standing and the log.
- **Sensors** reveal places within range; deep scans reveal more.

## The maps

- **Generation:** a map comes from a YAML template (`poi-types.yaml`) and a seed. It can contain:
  - rock fields with ore and ice;
  - wrecks and a giant hulk;
  - Glim and spore clouds;
  - spires and nebulae;
  - stations and encounters.

  A place visited again yields less.
- **Arriving:** the Forge brings its hangar. Ships launch from the bays one after another.
- **On the map:**
  - **gathering:** Gleaners mine, Shearers cut wrecks (and find relics and blueprints), Skimmers skim clouds;
  - **building:** the Forge builds ships with ore and free crew;
  - **fighting:** combat follows the versus table, with formations, stances and control groups;
  - **sensors:** sensor fog and the Tactical Plot.
- **Leaving:** recall the ships and spool the Skein for about a minute. Ships still outside are left behind.
- **The report:** stores gained and spent, ships and crew lost, standing changes and finds, merged into the voyage.

## Races, factions and reputation

- **Races:** the Humans of the Meridian Hollow, the Hullborn, the Tallowfolk, the Gaunt and the Choirmoths.
- **Factions:** the Rivet Moot, the Lantern Synod, the Ashen Gaunt, the Cinder Pact and the Choir.
- **Standing:** −100 to 100, in five tiers: Hostile, Wary, Neutral, Friendly and Allied.
  - It sets how a faction acts on maps, their prices, what they offer and where you are welcome.
  - Firing, kills, helping and theft change it. Unmet factions start at their race's standing.
- **Monsters:** Scrapwyrms, rust mites, Gnasher packs and the Hollowhorn. They are always hostile.

## Comms, trade and events

- **Hailing:** hail a faction from the chart at their place, or hail their ships and stations on maps.
- **Dialogs** are YAML trees with conditions and effects from a fixed vocabulary.
- **Trade is barter.**
  - Every good has a value.
  - Prices move with standing, stock and what the trader wants.
  - A deal is fair when what you give is worth at least what you take.
  - You can hire crew and crewed ships, and buy surveys, charts and blueprints.
- **Treaties:** ceasefire, peace, leave and tribute, with lengths. Breaking one costs standing.
- **Events:** story and galaxy events (YAML), fired at the start, on arrival, on travel, on rest days, and when parts are found or fitted. Their choices use the same vocabulary as dialogs.

## The Forge, the fleet and the crew

- **Engineering:** eleven projects, some building on others: hangars, racks, an array, a recycler, plating, repair bays, a foundry line, fire control and launch rails.
- **Blueprints:** some hulls are locked until their blueprint is found.
- **Veterancy:** experience from kills and from fights survived. Ranks (Seasoned, Veteran, Elite) add damage and hull, ride in the hangar, and are lost with the ship. Ships aboard mend daily.
- **The crew:** 150 people in four roles (engineers, pilots, miners and hands).
  - **Officers:** eight officers head departments and never fly.
  - **Ship leads:** every armed ship has a named pilot or captain who flies with it.
  - **Traits** (YAML) change departments and ships, sometimes only under conditions, and some grow into others.
  - **Losses** pick who dies, fairly. Leads die with their ships unless a Lucky one gets out. Empty posts are filled by promotion.
  - **Events** name people, and the Crew tab keeps a memorial.
- **Morale** (0–100) rises with rest and full stores and falls with shortages and losses. Below 30, work is slower; below 15, people desert.

## Saves and setup

- **New-run setup:** seed, full or short voyage, permanent death or free saves, and a guided first voyage with hint cards.
- **Saving:** save anywhere. A mid-map save is the settings plus the order log, and loading replays it exactly. Named save slots exist in free-save mode.

## Content packs

- **Packs:** all content lives in packs under `content/`. The base game is `core`. Packs merge with MiniYAML: later packs add to or override earlier ones, and `-Key` removes.
- **What a pack holds:**
  - rules: actors and weapons;
  - resources;
  - place types;
  - regions;
  - items;
  - voyage numbers;
  - names;
  - races and factions;
  - trade;
  - dialogs;
  - events;
  - hints;
  - crew.
- **Checks:** a content lint checks every reference when packs load.
- **Example:** an example pack adds a faction with no code.

## Architecture

- **Engine:** integer maths, actors with traits and activities, orders through an order manager (lockstep-ready), a seeded RNG, a sync hash and exact replays.
- **Determinism:** a hard rule in the simulation and the galaxy layer. A lint enforces it.
- **`src/galaxy/`** holds the voyage layer: generator, voyage state, crew, standing, comms and events. It is plain deterministic code, tested headless.
- **Tests:** 16 headless test suites in `tools/`, run by `npm test`. The test captain plays whole voyages.

## Folder layout

```
space-strategy/
  index.html
  lib/                 three.js r160
  content/core/        the base game as a content pack
  content/example-pack an add-on example
  src/engine/          simulation engine, content loading, the map generator, replays
  src/traits/          ship and world behaviour (flight, combat, production, hangar, sensors, ranks, diplomacy, monsters)
  src/activities/      what ships do (fly, attack, harvest, launch, dock, formation moves)
  src/galaxy/          galaxy generator, voyage, crew, standing, comms, events, practice runs
  src/render/          three.js rendering: ships, effects, space, the star chart
  src/ui/              HUD, chart screen, comms, input, camera, audio
  tools/               headless tests, the test captain, the dev server
  README.md, PLAN.md
```
