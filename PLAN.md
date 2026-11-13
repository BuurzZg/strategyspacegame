# Driftforge: plan

*Version 3, the loop redesign. **Approved:** the 24 answers, the story skeleton and its update, decisions 25–37, and the steampunk style guide (§16, §3, §9). Only the true ending's final choice stays open (§17). Milestones 1–20 are built (§12); names are in §15, and Part II, at the end, describes the game as it is built today.*

Driftforge is a space survival game for the browser, built in three.js on a deterministic engine.

You wake aboard the **Forge**, a great foundry-ship adrift in the middle of a galaxy of scrap. You don't know where you are, who you are, or why you are here. You keep the crew alive, build the Forge up, and fly its fleet in real-time battles. Piece by piece, you remember what happened, and it isn't good. When you die, something drags you back to the moment you woke, in the same galaxy, and everything you remembered comes with you. To get out, you have to face it.

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
- **A life** starts at the wake-up point on day 1, with the Forge as it was when you woke. It ends when the Forge is destroyed in battle or by some other danger, or when you let it go. Shortages only weaken you (§6). Then you wake again: same galaxy, same moment, and everything you remember.
- **Memories are the progress.** About 30 memories sit in a tree screen called **the Loom**. Unknown ones show as question marks. There are two kinds:
  - **Knowledge:** story, lore and locations.
  - **Abilities:** radar, shields, ship types, Forge rooms and new options.

  Once remembered, a memory stays for the whole campaign.
- **Routes stay closed until you remember.** Asteroid shoals need shields, the Veil needs the Stillwater Lens, and so on. When you try to go there, a named officer tells you why you can't. Remembering opens the route for good, and it leads into parts of the galaxy you couldn't reach before.
- **The chart remembers.** Places you discovered, traders you found and clue circles stay marked after death.
- **The Forge is a small base, and its bridge is the heart of it.** You build rooms, keep people fed, and trade in a new currency. The crew screen is the Forge's bridge: Jacob's chair in the middle, the stations and their officers around it, dark until you remember and train them. The crew's mood shows as green, amber or red on every station. Running short never kills, but it makes the Forge weaker. When every station is green, it's All hands.
- **After each map, you muster the fleet.** The hangar holds 10 ships to start. You keep the best and scrap or leave the rest. Ships that come home from a map gain a level. Ships that die are gone, with their pilot.
- **Each region has its own trader.** You trade with them straight from the chart, with no map to play.
- **Steampunk space.** Brass, copper, rivets, steam, and Glim burning in boilers. A style guide comes first, for your approval.
- **The goal is to escape the galaxy.** The force that traps it, the Mainspring, waits at the Shore, and defeating it breaks the loop. A skilled player can do that in their first life, but the true ending needs every memory (§3).

## 2. The campaign and its lives

### One galaxy, many lives

- **Starting a campaign:** pick a seed, or take a random one, and the galaxy is generated. This is today's generator, with additions (§5).
- **Starting a life:** the Forge wakes at the start point in the middle of the galaxy, which is the Drift around the dead star Orrin. It is day 1, with the starting stores, crew and fleet.
- **Ending a life:**
  - the Forge is destroyed, on a map or by a danger in an event;
  - or nobody is left aboard, which can now only happen through losses in combat.

  Running out of water, air, food or heat no longer kills: it weakens the Forge instead (§6, "Survival weakens"). Until Milestone 17, the old rules still apply: starvation deaths, and three days without air.

  A wake screen follows. It shows how long this life lasted, what you found and who was lost, and then you wake again.
- **Giving up a life (decision 9):** a **Let go** button on the chart ends the life on purpose, for when a life is going nowhere. It counts as a death.

### What carries over and what resets (decided)

| Thing | Across lives | Notes |
| --- | --- | --- |
| Memories, knowledge and abilities | **Kept** | The heart of the progress |
| Routes opened by memories | **Kept** | A remembered system just works from the start of every life |
| The star chart: places discovered, places visited before, traders found, clue circles, exact spots revealed | **Kept** | Places visited in an earlier life get a faded mark |
| Echoes not yet spent | **Kept** | Echoes were chosen (decision 11) |
| Galaxy layout, story locations, traders' locations | **Fixed by the seed** | |
| Stores, Forge hull and systems, rooms built, fleet, ship levels, currency | **Reset** | Back to the wake-up state, plus anything memories add to it (for example a remembered cache of stores) |
| The crew | **Reset** | The same officers and pilots wake again, alive (decision 6) |
| Faction standing | **Reset** | They have never met you. The exception is the Choir, who sense the loop (decision 7) |
| The day clock | **Reset** | Day 1 |
| What is on each map | **Varies each life** | Decision 1 |
| The memorial | **Kept** | The ship's log keeps the name of everyone lost, in every life |

### Map contents vary each life (decided)

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

### Saves (decided)

- One campaign save that updates as you play.
- Save and quit any time, on the chart or mid-map. Mid-map saves replay exactly, as today.
- No reloading an older save: death is part of the loop.

Today's choice between permanent death and free saves goes away. Old saves of either kind load as campaigns.

### Length targets (decided)

Targets, all measured by the test bot:

| Run | Target |
| --- | --- |
| A first-life escape by a skilled player | 2–3 hours |
| The true ending | 8–12 hours over about 5–8 lives |
| A short campaign (about 120 places, as the short voyage is today) | 3–4 hours to the true ending |

## 3. Story: waking with nothing

*The skeleton is yours, with your story update applied (where they disagree, the update wins). The parts marked "proposal" fill gaps you left open. Tone: the story memories are dark and heavy, guilt slowly found out. Everything else stays lonely, beautiful and a bit strange, with dry humour.*

### The opening (short, and confusing on purpose)

- **The emblem first.** Dark; the view passes over the Company's emblem on the plate above the helm as it catches the first light. Then the bridge lamps flicker, die, flicker again, and hold. For now this is told in the opening's text; a real camera pass over a modelled emblem can come later, once the emblem's final design is chosen.
- **The crew wake.** People stir at their stations and ask what happened. Nobody knows.
- **"Status report."** Jacob's first words are a call for a ship status report. The answer depends on what he remembers:
  - first life: *"Nothing's working, Captain."*
  - later lives: *"Nothing's working, Captain, except the radar"*, listing every ship's system Jacob remembers (the radar, the drive parts, the hazard gear, silent running), in the Loom's order. Each such memory carries a `Status` name in `memories.yaml`, and the content lint makes sure none is missing.
- **Bodies remember, minds don't.** Their hands know the helm and their habits know the ship, but nobody knows where they are, what happened, or why they're here. The crew read their names off their uniforms.
- **Then control passes to the player.** The opening is a few lines, not a cutscene: the prologue event in the first life (then the signal and the dark chart), the waking event in every life after.
- **The first guess is wrong.** At first everyone assumes they have been out for hours, or days.

### What happened before the game

1. **The Company.** The Smith Foundry Company (proposed name; "the Company" in speech) is a powerful family House of a great empire, the Meridian Hollow. It is also an **order of faith and technology**, Christian-inspired, but it looks like a far-future spaceship crew, not a church: uniforms, ranks, a bridge, a foundry. Its faith shows only in small details: the cross emblem, a pendant on a chain, a small painted icon tucked into a station's frame. **The emblem** is a cross joined with a scientific symbol. Its final design is open; until it is chosen, the game's text uses a placeholder: *a cross with an orbit drawn through its arms* ("the cross and orbit", and "Cross-ship" in the mouths of those who hate it). It comes to the Wrack, the galaxy without worlds, on a mission to study **Ninefold**, the only planet in it.
2. **The mission was good.** It was meant to cure **the Fray**, a sickness of people who travel through folded space. Not everyone believed that.
3. **The Anchorage.** The Company builds the Anchorage, a station in the Drift within sight of Ninefold and the dead star Orrin.
4. **Erik and Jacob.** Dr. Erik Smith, head of the family and the Company's chief, leads the mission. He lets his grandfather, Dr. Jacob Smith, run a private "retirement project" aboard his own mothership, the Forge, under the Company's protection.
5. **How the galaxy's peoples react:**
   - **traders and pirates** help, but only because they fear the Company;
   - **some factions** sabotage the mission;
   - **Ninefold's people, the Knotfolk,** believe the Company has come to destroy everything.
6. **The theft (changed).**
   - **The relic.** All his life Jacob carried half of an ancient relic, **the Twain** (proposed name). The other half was in the Wrack. Finding it was his life's work: the "retirement project" was really the search, and the Company's mission was his way to get here.
   - **The guardians.** The Knotfolk guarded the other half. They were wrong about the Company's mission, but right about Jacob.
   - **The waking.** Jacob stole the other half. When the halves met, something woke: **the Mainspring**.
   - **Left open:** whether Jacob knew this would happen.
7. **The trap.** The Mainspring, lord of the tech demons, winds the galaxy shut. No stitch leaves the Wrack.
8. **A hostage.** The Company becomes the demons' hostage: do as we say, or the Anchorage is unmade. Under that threat it does terrible things across the galaxy, including taking people from the scavenger clans.
9. **The sacrifices.** The captives are given to the Mainspring, on Erik's orders. Each offering makes it stronger.
10. **Enough.** Erik realises the offerings are feeding the demon lord, not calming it, and refuses to give any more. The demons' punishment is the fall (decision 37: a, approved): the Hands fall on the Anchorage, and it burns for three days. Erik holds the line so the evacuation ships can get away, and stays to the end. The survivors flee to moons, large asteroids and wrecks across the galaxy, and start again there. The havens exist because he finally stood up.
11. **The relic saved Jacob (changed).**
    - When everything fell apart, the Twain stopped time around Jacob and the Forge. For them, not a minute has passed.
    - **147 years later** (proposal, below), the Forge comes out of a fold in space and time, its crew with their memories gone.
    - **Jacob doesn't know any of this at the start.** The player finds it out late.
    - **Nobody knows what the Twain really is,** why it can do this, or what it means. The base game gives only hints, so future add-ons can explore it.

**Why memories survive (proposal):**
- The crew wake blank in every life, but the Forge's drive records keep everything that is recovered. That record is the Loom.
- It is also why remembered things stay, and why found traders stay "in the ship's systems".

### Ninefold (proposal)

- **Where it is:** Ninefold is the dead star Orrin's one surviving world. Folded space in the Wrack is knotted there: nine folds of the Skein meet in a single knot under its crust. That knot is why the Wrack has no other planets.
- **Nothing frays there.** That is why the Company came: a cure for the Fray.
- **What it kept:** the Knotfolk kept the other half of the Twain in a reliquary at the knot. Whether the knot and the Twain are connected is one of the mysteries left for add-ons.

### The force: the tech demons, and the Mainspring (decided: a faction; built in Milestone 21, the Mainspring itself in 22)

The force is not a monster but a **faction**: the **tech demons**, which the Company's records call **the Wound** (decision 36, approved). Their ruler is **the Mainspring** (the approved name): a living mothership, part flesh and part machine, the mirror of our Forge.

- **What it is:** the Mainspring is a vast coiled body of wet dark metal grown through with flesh. Its spine is a coiled spring that winds time, and organic light pulses along its veins. It came through the gate when the halves of the Twain met.
- **What it does:**
  - it winds things shut: the galaxy, the lanes out;
  - it **feeds on the time of the living**: every captive given to it made it stronger;
  - it wants the Twain back.
- **The Hands are its fleets.** Each Hand is led by an **Hour**, a lesser living carrier that gestates ships as it hunts. The Hands hunt the Forge in every life (decision 25, below).
- **They play as a real RTS opponent.** We meet them on strategy maps, and they gather, build, attack, retreat and rebuild.
- **The final battle** at the Shore is mothership against mothership: the Forge and its fleet against the Mainspring and its forces, in a full RTS battle.

#### Their ships (proposal)

Each one mirrors a hull of ours, grown instead of built. Names follow the clock and the body.

| Ship | Role | Mirrors | Notes |
| --- | --- | --- | --- |
| **Tick** | Swarm fighter | Dart | Budded in clutches, cheap, short-lived; always more of them. Pickets' flak eats them |
| **Stinger** | Strike craft against big hulls | Talon | A bone lance that pierces armour; comes in when you field frigates and capitals |
| **Chime** | Escort against fighters | Picket | Rings with a resonant pulse that bursts small craft; built when you field fighters |
| **Hound** | Line frigate | Halberd | The backbone of every Hand; tough, steady, hunts in pairs |
| **Gnawer** | Heavy brawler | Spindle and Sabre | Slow; eats wrecks to heal itself and to make ichor |
| **Feeder** | Harvester | Gleaner and Shearer | Strips wrecks, debris and the dead for ichor; the demons' economy. Kill these and the Hand starves |
| **Hour** | Living carrier, leads a Hand | The Forge, small | Gestates Ticks, Hounds, Chimes, Stingers and Feeders in pods along its flanks; plants Nurseries; flees to regrow when badly hurt |
| **The Mainspring** | The demon lord's mothership | The Forge | Gestates everything, including Gnawers and Hours. It has **organs** (hearts and a coil) that must be broken before its core can be hit. It regrows from the battle's own dead |

**Nurseries** are flesh growths an Hour plants on rocks and wrecks. They are anchored structures that bud Ticks and Feeders, and they can be burned.

#### How they produce (proposal)

- **Their resource is ichor:** living matter and stolen time. Where ours is ore, theirs is what dies. Feeders strip it from wrecks, debris and the dead, including every ship you lose. Nurseries add a slow trickle.
- **Gestation:** Hours and the Mainspring gestate ships in pods, which work like our production queue. Their losses become wrecks, and wrecks become ichor, so a long fight in a wreck-strewn place favours them. Your Shearers salvaging wrecks starves them, which makes salvage a weapon.
- **Their AI:** a real RTS opponent, built on our engine's production, harvesting, formations and orders.
  - **An economy:** Feeders out, Nurseries planted.
  - **Counter-building:** Chimes against your fighters, Stingers against your big hulls.
  - **Attacks in waves** when its strength passes a threshold.
  - **Retreats** to regrow when a wave breaks.
  - **Expands** by planting new Nurseries.

#### Their maps (proposal)

- **Infested places.** Where a Hand has settled, the place turns: wrecks overgrown with flesh, Nurseries anchored to rocks, veins of red light, a spore haze that cuts sensor range.
  - **Burn it out:** kill the Hour, or every Nursery, to cleanse the place for the rest of the life.
  - **The rewards:** echoes, salvage, and sometimes captives they took from the havens, rescued.
- **The creep.** Around Nurseries the flesh spreads slowly. Inside it, demons heal and your ships repair slower. Near an Hour, time drags: your ships move a little slower.
- **When a Hand catches the Forge,** an Hour arrives on the next map with its pack and keeps gestating the longer the fight lasts. Kill it fast, or spool the Skein and run.
- **On the chart:** infested places appear as spreading red-ink stains on the parchment.
- **The Mainspring's lair at the Shore:** a vast map built around the living mothership. Its organs are weak points, and it regrows from the field's dead. The Twain answers it as the battle goes on. This is the final battle.

#### How the Hands escalate (decision 25: a soft, growing threat; built in Milestone 21)

There is no countdown. The Mainspring's **attention** rises, and the Hands grow with it.

- **What raises attention:**
  - every memory recovered, because the more Jacob remembers, the louder the Twain sings;
  - days passing, slowly;
  - Nurseries burned and Hours killed (it notices);
  - staying long at one place.
- **What lowers it:** silent running; hiding with the Choir; long stitches through static fields, where the Hands won't follow.
- **What you see:** the sensors station shows attention as a word, not a number: **Quiet**, **Noticed**, **Hunted** and **Marked**. A faint ticking plays on the chart when a Hand is near.
- **What each level brings:**

| Attention | Typically | What hunts you |
| --- | --- | --- |
| **Quiet** | Act I | Nothing yet. Signs only: a dead Hour drifting, havens' stories |
| **Noticed** | Act II | A lone Hound pack roams the outer regions. Now and then Ticks and a Hound turn up on a map |
| **Hunted** | Act III | A Hand (an Hour and its pack) sets out from the Shore and follows where the Forge was last heard, about one lane every 2–3 days, sometimes losing the trail. Infested places begin to appear |
| **Marked** | Act IV, or many memories | Two Hands, faster and stronger (Stingers and Gnawers), with Nurseries planted along their way |

- **Across the campaign:** attention starts each life near the level your memories have earned. Later lives are more dangerous because Jacob knows more.
- **Being caught isn't the end:** it means a hard fight, or a costly escape. Destroying a Hand removes it for the rest of the life and lowers attention a step.
- **Data:** every number lives in YAML.

#### Their look (added to the style guide)

- **Materials:** biomechanical. Wet, cold, blue-black metal grown together with flesh, and pale bone.
- **Light:** pulsing organic light in arterial crimson and magenta. It is the opposite of our warm brass, steam and teal Glim, and it reads at a glance on any map.
- **On screen:** their comms come through as a wet, distorted signal, not a telegram. Their places stain the parchment chart.

### The Twain (proposal: the relic's name)

- **The name:** two halves of one thing, never meant to meet ("never the twain shall meet"). Jacob carried one half, and the Knotfolk guarded the other.
- **What it is like:** cold, brass-dark, older than anything in the Wrack. It sings if you hold it too long.
- **The time shield:** when it is whole, it can stop time around whatever it is close to. That is all anyone learns.
- **Alternatives:** the Clasp, the Stillpoint.

### Why Jacob comes back after each death (proposal, decision 29)

**a. The creditor (recommended).**
- While Jacob lives, the Twain shields him and the Mainspring can't take it. If he dies, the Twain would slip out of time with him and be lost to it again.
- So the Mainspring winds Jacob back to the earliest moment it can reach: the moment the shield opened, which is the moment of waking. Then it waits for him to bring the Twain to the Shore. A creditor that won't let the debtor die before he pays.
- This explains why every life starts at the same moment.

**b. The relic.** The Twain itself rewinds its bearer, and the Mainspring only hunts.

**c. Both stories exist, and the player never learns which is true.** The Choir ask: "Are you sure it is the coil that keeps winding you?"

The recommendation is **a** as what Jacob believes, with hints of **c**. Your narration's line "It would not let me die" works either way.

### Why we wake now (proposal, decision 30)

**a. The shield is failing (recommended as the truth, as far as anyone can tell).**
After 147 years, the Twain's song has faded. Time leaked in, and the Forge fell back into the world.

**b. The ritual.** A haven of the Company's descendants, the Waiting, has kept a beacon lit for "the old man with the great ship" for generations. On the anniversary of the fall they performed a ritual to call him back, and they believe it worked.

**c. The pry.** The Mainspring has been winding against the shield for a century and a half, and it finally gave way.

The recommendation is all three, in layers:
- **a** is what the late memories suggest;
- **b** is what the Waiting believe (a strong moment, below);
- **c** is the Choir's hint.

No one is sure.

### The time gap (proposal: 147 years, decision 31)

**Why 147 years:**
- **Generations:** about six, enough for tribes, twisted legends and a dead Company.
- **Living memory:** short enough that a long-lived Tallowfolk elder still remembers Jacob's face.

**How the player works it out, step by step:**

1. **Waking:** everyone assumes hours, or days.
2. **The Anchorage:** skeletons in Company uniforms and dust a finger deep. The surgeon says: "These aren't days old, Captain. Not years, either." The station's last dated log gives the **last record**: "Year 4324, Month 3, Day 2".
3. **Our emblem on a tribal ship,** painted by people who don't know what it means.
4. **The legend of the old man with the great ship.** It is told as old lore, and it is about you.
5. **A Tallowfolk elder** (Deacon Ilmar Sloe of the Tallow Bell) recognises you: "You have not aged a day. I have aged more than a hundred years."
6. **The Meridian Horologe** (below) gives the exact date. The Anchorage's last log against today's date: 147 years, 3 months and 15 days.

### The havens

- **Who they are:** the Company's survivors settled moons, large asteroids and wrecks. After 147 years their descendants, the **Hollowkin** (proposed name, from the Meridian Hollow), have gone different ways:
  - **Tribes:** primitive wreck-dwellers who paint the Company's cross emblem on their hulls as a tribal sign, not knowing what it means;
  - **Holds:** havens on small moons with some industry, but no spaceflight. You visit them from the chart, and they trade, offer crew and tell legends;
  - **Raiders:** **the Brass Reavers** (proposed name), descendants who stripped Company wrecks for brass and turned pirate.
- **The legend:** every haven has a version of "the old man with the great ship".
  - **The Waiting** keep a beacon lit for his return.
  - **The Unforgiving** curse him and frighten their children with him.
  - Both have it twisted. Their fear and hatred, handed down for generations, make the false picture stronger.

### The Meridian Horologe (proposal: the clock station)

- **What it is:** the Empire's timekeeping station, a cathedral of brass around a chronometer the size of a house. It still keeps official **Meridian time** (year, month, day, hour, minute, second) and has ticked alone for 147 years. Its pendulum is the only thing moving.
- **Before it is found:** the date panel on the HUD reads **UNKNOWN**. After the Anchorage it adds the last record: "Last record: Year 4324, Month 3, Day 2 · Today: UNKNOWN". Dated logs, old records and legends let the player guess.
- **When it is found:** a memory, so the date stays known in every later life. The panel shows the official Meridian date from then on, with the clock running: "Year 4471 · Month 6 · Day 17 · 06:42:19". Each life restarts at the moment of waking, so the date does too.
- **The story moment:** the chronometer, the date, and the last Anchorage log beside it. Everyone you knew died a century ago.
- **Where it is:** in the Hush (Act III), so the player usually finds it after already suspecting a long gap, but before the end.
- **Alternative names:** the Long Clock, the Chronarium.

### The false picture

The player should spend the early game believing the Company was evil. Then the truth comes in layers:

1. **They hate us. Were we the villains?** (Act I, and every haven that curses the old man)
2. **The mission was good.** They misunderstood it, or were lied to. (Act II)
3. **The real disaster was Jacob's private project:** his search for the relic, and the theft. The Knotfolk were wrong about the Company, but right about him. (Act III)
4. **Then we did terrible things out of desperation:** the kidnappings, then the sacrifices. (Act II shows the lists without the reason; Act III gives the reason)

Nobody is purely good or purely evil.

### The story by region

| Act | Region | Question | What the player learns |
| --- | --- | --- | --- |
| I | The Drift | "Who are we?" | The destroyed Anchorage, the emblem and the radar; the Company and Erik's name; that we are Jacob; the first sign of how long it's been. The Knotfolk attack on sight. Our emblem on a tribal ship |
| II | The Middens | "What did we do?" | The Fray and the mission; the Synod's oath; fear as policy; the kidnappings. The havens, the Waiting and the Unforgiving. The Cinder Pact, what's left of the Company, blame Jacob |
| III | The Hush | "Why?" | The other half of the Twain; the theft and the waking; the offering. The Meridian Horologe and the date. The Choir sense that Jacob keeps coming back |
| IV | The Shore | "The truth" | The fall, the time shield, and why we woke. The Mainspring waits; defeating it breaks the loop and lets us escape |

### The story memories (draft: 12, plus the Horologe)

Each one is darker than the last. Each is found at a story location placed by the seed within its act's region (§2), and costs no echoes.

| # | Act | Memory | Where it is found | What it reveals |
| --- | --- | --- | --- | --- |
| 1 | I | **The emblem** | The Anchorage's hulk, with the radar | The cross emblem of the Smith Foundry Company is on the station, the Forge and the uniforms, and on a pendant round a dead woman's neck: a faith and a foundry on one badge. The skeletons are old. The last log gives the **last record** date |
| 2 | I | **"We are here to help"** | The Steward, Erik's wrecked yacht | Erik's recording opening the Anchorage: "We are here to help." After the Knotfolk's attacks and a tribal ship wearing our emblem, it sounds hollow |
| 3 | I | **The old man's ship** | The Forge's registry, after the first fight with the Knotfolk | The Forge is the private ship of Dr. Jacob Smith, Erik's grandfather. You are Jacob, and you are the old man in the havens' legend. Deck 9 is sealed |
| 4 | II | **The Fray** | A Company research hulk | The Fray is killing the empire, and it killed Erik's mother. Ninefold does not fray. The mission was a cure |
| 5 | II | **The oath** | The Tallow Bell, where the Deacon remembers you | The Synod swore to guard Ninefold's knot, told the Knotfolk the Company would unpick it, and sabotaged the mission. Erik never explained himself. The Deacon has aged more than a hundred years; you haven't |
| 6 | II | **"Afraid is cooperative"** | A Rivet Moot ledger, or the Ashen Gaunt's den | The traders and pirates who helped were paid in fear. "Let them be afraid. Afraid is cooperative." The Ashen Gaunt guided Company ships to their own kin's camps |
| 7 | II | **The lists** | A prison-barge wreck in the Ragged Clans' fields | Names of clan captives, some of them sold by the Rivet Moot. Cages on the Anchorage's lower ring. Nothing says why |
| 8 | III | **The other half** | The Knotfolk's reliquary-ship in the Hush, still guarding an empty case | Jacob's life's work: half of the Twain, carried for decades, and the other half here. The retirement project was the search, and the mission was his way in. The Knotfolk were right about him |
| 9 | III | **The waking** | The Choir, who felt the two halves meet | Jacob stole the other half. When the halves met, everything that keeps time flinched, and the Mainspring woke and wound the galaxy shut. Whether he knew is not said |
| — | III | **The Meridian Horologe** (knowledge, not a story memory) | The clock station in the Hush | The official date, running from then on: 147 years since the last record |
| 10 | III | **The offering** | The tithe barge, where the captives were given | The Company was the tech demons' hostage: feed the Mainspring, or lose the Anchorage. For years its ships took captives from the clans and gave them to it, on Erik's orders, with Jacob beside him. Erik signed every order and kept every name, believing each one bought the Anchorage time. Each offering made it stronger |
| 11 | IV | **Enough** | The Cinder Pact's founding hall, at the Shore | Erik saw that the offerings were feeding the demon lord, making the Mainspring stronger, not calming it, and finally refused to send another. As punishment the Hands fell on the Anchorage, and it burned for three days. Erik held the line so the evacuation ships could get away (the havens' ancestors), and stayed to the end. The Pact keep his story, and blame the old man |
| 12 | IV | **The whole truth** | Deck 9, which opens at the Shore once every other memory is known | The Twain stopped time around Jacob and the Forge, and saved him; he did not deserve it. Why it did, and what it is, nobody knows. Why he woke now, and why he keeps coming back (decisions 29 and 30). Then the confrontation |

### Who plays which part

| Story role | Who | Native or descendant | What changes |
| --- | --- | --- | --- |
| Traders who helped out of fear | **Rivet Moot** (Hullborn) | Native alien | Still Friendly. They sold the clans' names, 147 years ago, and keep quiet about it |
| Pirates who helped out of fear | **Ashen Gaunt** (Gaunt) | Native alien | Hostile → Wary. They remember the emblem as old fear, and guided the Company to their own kin |
| Saboteurs | **Lantern Synod** (Tallowfolk) | Native alien, long-lived | An oath to guard the knot. Their elders remember Jacob in person |
| Ninefold's people, guardians of the other half | **The Knotfolk**, flying as the **Wardens of Ninefold** | **New** native race and faction | Hostile to the emblem on sight: Act I's unexplained attacks |
| The kidnapped tribes | **The Ragged Clans** | **New** faction, native **Gaunt** (not Hullborn, as in the last draft) | Gaunt scavenger tribes whose ancestors were taken. Hostile; making peace is possible |
| Erik's people | **Cinder Pact** (Humans) | Human descendants | The Company's most organised remnant: records, ships and a grudge. They tell the fall, and they blame the old man |
| The havens | **The Hollowkin** (Humans): tribes and holds | **New** faction, human descendants | Small and scattered. Some carry the emblem without knowing it, some wait for the old man, some curse him |
| Human pirates | **The Brass Reavers** (Humans) | **New** faction, human descendants | Strip the Company's wrecks; the emblem means loot to them |
| Those who sense the loop | **The Choir** (Choirmoths) | Native alien | They remember Jacob across lives (decision 7). They felt the halves meet, and give memory 9 |
| The force | **The tech demons (the Wound)**: the **Mainspring**, their living mothership and lord, and its fleets, the **Hands** | From elsewhere | A real RTS faction. Wants the Twain; its Hands hunt the Forge in every life, as a growing threat; the final battle at the Shore |
| Monsters | Scrapwyrms, rust mites, Gnashers, the Hollowhorn | Native | Unchanged. The Hollowhorn is older than the Mainspring, and hates it |

### Strong moments (proposals)

1. **Our mark on their hull** (Act I). A Hollowkin tribal skiff limps into view with the cross emblem painted on its hull, crudely, upside down. The watch officer puts it on screen next to the Forge's own hull plate. Nobody says anything.
2. **The ones who waited** (Act II). A Hollowkin hold has kept a landing beacon lit for six generations. When the Forge arrives they kneel, and their elder says their ritual brought him back. Then she asks Jacob to keep a promise he doesn't remember making. What the promise was is left open for a later memory or an add-on.
3. **The ones who curse** (Act II). At an Unforgiving haven, children chant a skipping rhyme: "Old man, old man, great black ship, took the clans and fed the coil." The player hears it long before knowing it's true.
4. **Smaller moments:**
   - the dust and skeletons at the Anchorage;
   - the Deacon who recognises you;
   - the Horologe's pendulum, the only thing moving in the station.

### Endings

- **Escape:** defeat the Mainspring at the Shore and jump out with the Heartstone, without every memory. You get out, but you never learn the whole truth. The narration has gaps (below). A skilled player can do this in their first life (decision 3).
- **The true ending:** every memory, then the confrontation knowing the whole truth, and a final choice.

**The final choice** (decision 38: **all three**, the player's choice; each keeps the Twain a mystery):

**a. Pay the debt.**
Give the Twain to the Mainspring. It unwinds and goes back to wherever it came from, taking the Twain, and the Wrack opens. As the shield falls, 147 years arrive at once: the crew go home, and Jacob doesn't.

**b. Part the halves.**
Return the stolen half to the Knotfolk. The Mainspring fell asleep once before, when the halves were apart, and it falls asleep again. Jacob leaves carrying the half he came with, as he arrived. If he has made peace with them, the Knotfolk see him off.

**c. Keep it whole.**
Leave with the whole Twain and the Mainspring broken behind you. As the Forge passes the Shore, the Twain begins to sing. An ending that opens a door for add-ons.

### Deeper mysteries, left open

- Did Jacob know the theft would wake the Mainspring?
- What is the Twain? Is the Mainspring its keeper, its creditor or its prisoner?
- Is it the Mainspring or the Twain that keeps winding Jacob back?
- What did Jacob promise the Waiting?

The base game hints at all of these and answers none.

### The ending narration (built in Milestone 22)

When the player finishes the game, the whole story plays from beginning to end, narrated by old Jacob himself.

- **Format:** illustrated still scenes in the steampunk style, with slow camera moves, Jacob's narration as dramatic text, and music and sound.
- **Only what you found:** each scene needs certain memories. A scene whose memories weren't found plays blacked out, and Jacob falters ("...I don't remember this part."). The escape ending therefore has gaps; the true ending tells it all.
- **The voice:** old, tired, guilty, with dry humour. Your draft sets the tone and the beats; the final text gets written in Milestone 22.

| Scene | From your draft | Needs |
| --- | --- | --- |
| I | The Empire | Memory 1 |
| II | The mission | Memories 2 and 4 |
| III | Those who greeted us | Memories 5 and 6 |
| IV | My project | Memory 8 |
| V | The theft | Memory 9 |
| VI | The price (rewritten: the hostage) | Memories 7 and 10 |
| VII | The fall (rewritten: Erik's refusal) | Memory 11 |
| VIII | The relic | Memory 12 |
| IX | The awakening | Memory 3 and the Horologe |
| X | The end | Always shown; differs by ending |

- **Scenes VI and VII, redrafted** for Erik's new role (a guide to tone; the final text comes in the story milestone):

  > **VI. The price.** The thing shut us in, and then it named its terms. We were not its enemies. We were its hostages. Do as we were told, or watch the Anchorage unmade with everyone in it. So we did as we were told. We took people from the scavenger clans and gave them to it. Erik signed the orders. I stood beside him and said nothing useful, which I am very good at. Every name went into his ledger. Every one of them made it stronger. We didn't know that yet. I would like to say it would have stopped me.

  > **VI, if memory 10 is missing.** The thing shut us in. It named its terms, and we... no. I don't remember this. I know I did something. I feel it like cold in my bones. But the picture won't come.

  > **VII. The fall.** Erik worked it out before I did. He was always quicker than me at the things that matter. Every offering fed it. We weren't buying time; we were paying for its teeth. So my grandson said "enough", to a god, in front of everyone. It answered with fire. The Anchorage burned for three days. Erik held the docks while the last ships got away, and then he did not get away. Everyone you will meet out there, every haven, every child who curses my name, is alive because of him. I'd like him to have known that.

- **Data:** `content/core/narration.yaml`. Each scene has a title, the memories it needs, a still, a camera path, a music cue, and its lines. A scene also has gap lines, used when its memories are missing. Every line has its own id (for example `narr.vi.gap.2`), so a recorded voice can be added later as one audio file per line id, with no code change.
- **The stills:** built from the game's own procedural models (the Forge, the Anchorage burning, Ninefold, the tithe barge, the Mainspring), posed and rendered once through an engraved, sepia "etching" filter. They use slow pans and parallax, so no imported art is needed. A blacked-out scene is black with faint scratches.
- **Sound:** a slow organ and strings under ticking clocks. Each scene has its own sounds, such as the Anchorage burning or the Horologe's pendulum.

### The chase clock: the Hands (decided: yes, a soft, growing threat)

The Hands hunt the Forge in every life, as a threat that grows rather than a countdown. How they escalate is proposed under "How the Hands escalate", above.

## 4. The memory tree: the Loom

### The two kinds

- **Knowledge.** Story, lore and locations. Knowledge memories reveal the Anchorage, the shape of the galaxy, an exact spot inside a circle, or where a trader is. They also tell the story.
- **Abilities.** These change what you can do:
  - **systems** that open routes: radar, shields, heat baffles, the drive's parts;
  - **ship types** the foundry can build;
  - **rooms** you can build on the Forge;
  - **new options**, such as a blind stitch or silent running.

### How memories are earned (decided: found, plus echoes)

**Option 1: found only.**
Every memory sits at a place or in an event. You see the tree's shape, but nothing to spend.

**Option 2: found, plus echoes (chosen).**
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

### Draft tree (31 memories in five branches)

The structure is approved. Origins now holds the radar, the Meridian Horologe and the 12 story memories from §3. To keep the total at 31, five of the earlier drafts go:
- Blind stitch;
- the emergency cache;
- the Workshop, which becomes a trader's plan;
- Boiler overdrive;
- the Second hangar deck, which becomes a room you can build from the first life.

| # | Memory | Kind | Branch | Needs | What it gives |
| --- | --- | --- | --- | --- | --- |
| 1 | The radar | Ability | Origins | Found at the Anchorage, with story memory 1 | The chart lights up within sensor range; deep scans |
| 2 | The Meridian Horologe | Knowledge | Origins | Found at the clock station in the Hush | The official date on the HUD, running, in every later life |
| 3–14 | The 12 story memories: the emblem, "We are here to help", the old man's ship, the Fray, the oath, "Afraid is cooperative", the lists, the other half, the waking, the offering, the fall, the whole truth | Knowledge | Origins | Their story locations, act by act (§3); the whole truth needs every other memory | The story, and the ending narration's scenes. Some also reveal places: Ninefold, the Ragged Clans' fields, the Knotfolk's reliquary-ship |
| 15 | Threadwound Coils | Ability | The Skein | A story location in the Drift | Stitches 1.5× longer: the Middens |
| 16 | Stillwater Lens | Ability | The Skein | The Choir, or a location in the Middens | Stitches through the Veil: the Hush |
| 17 | Anchor Spindle | Ability | The Skein | The Ashen Gaunt, or a location in the Hush | Long stitches; holds against the Undertow: the Shore |
| 18 | Heartstone | Ability | The Skein | A location in the Shore | The final jump, once the Mainspring is down |
| 19 | Shields | Ability | The Forge | Turned away from a shoal | The asteroid shoals open |
| 20 | Heat baffles | Ability | The Forge | Turned away from an ember lane | The ember lanes near Orrin open |
| 21 | Lightning rods | Ability | The Forge | Turned away from a static field | The static fields open |
| 22 | Lead-lined decks | Ability | The Forge | Turned away from the Glare | The radiation belts open |
| 23 | Silent running | Ability (option) | The Forge | 21 | Fewer ambushes on the chart; on maps the Forge starts unseen; the Hands lose the trail (if chosen) |
| 24 | Wisp | Ability | The fleet | Seeing one | The scout hull |
| 25 | Talon | Ability | The fleet | A Talon wreck | The bomber hull |
| 26 | Sabre | Ability | The fleet | A Sabre wreck, or the Shore's trader | The frigate hull |
| 27 | Spindle | Ability | The fleet | A Spindle wreck | The heavy frigate hull |
| 28 | Monolith (new hull) | Ability | The fleet | Deep in the Shore | A capital ship |
| 29 | Mess hall | Ability | The decks | — | A room: mood rises faster |
| 30 | Infirmary | Ability | The decks | 29 | A room: fewer deaths from hunger and bad air; a pilot sometimes gets out of a lost ship |
| 31 | Chart room | Ability | The decks | 1 | A room: clue circles shrink, deep scans are cheaper |

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

**As built (Milestone 16):**
- `hazards.yaml` holds the four hazards: the memory that opens each, the post that reports it and what that officer says, how many pockets per region, their size, and the colour of their lanes. The Veil, long gaps and the Undertow stay as the drive's own limits, reported by the navigator.
- A pocket is three to five places in one region, carved with its own dice after everything else is placed. Every lane in from outside carries the hazard. Pockets never hold the wake-up point, an anchor, a drive part or a station, never touch another pocket, and never make the way to anywhere outside them more than one stitch longer. That keeps them off to the side, so a single life can always reach the edge (the test captain gets home on 50 full and 50 short seeds).
- Closed hazard lanes are drawn in the hazard's colour (the hatched ink and symbols come with the reskin).
- The first time a hazard turns the Forge away, the campaign remembers it, and its memory can be recalled on the Loom for two echoes. Once remembered, the hazard is open in every life.
- For now pockets hold richer places (half again as much) and one wreck with a strongbox of two echoes, once per campaign. Story locations and traders move into pockets with Milestones 20 and 22.

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

### The drive parts (decided)

The four drive parts **become memories** with the same names and effects:
- the Coils widen the range;
- the Lens opens the Veil;
- the Spindle allows long stitches;
- the Heartstone allows the final jump.

They are recovered at their story locations, as today, but there is nothing to fit, and they hold in every later life. The range ring, the Veil and the final-jump rule all stay as they are. Today's "fit a part with ore, salvage and days" goes away.

## 6. The Forge: base, survival and the bridge

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

### Currency: cogmarks (decided)

- **Cogmarks:** stamped brass cogs.
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

The crew's **mood** is a mark everyone can see. Underneath it is today's morale, the 0–100 number that rises with rest and full stores and falls with shortages and losses.

| Mark | When | Effect (decided; to be tuned in play) |
| --- | --- | --- |
| **Content** (green) | Fed and cared for: morale 60 or more, nothing running short | Repairs and building go 10% faster |
| **Uneasy** (amber) | Hungry: a store running low, or morale 30–59 | Building, ships and the Glim for each stitch cost 10% more |
| **Angry** (red) | Very hungry: a store gone, or morale under 30 | Building, ships and the Glim for each stitch cost 30% more. Under 15, stations strike (below) |

- **On screen:** the mark is a medallion in the top bar of both the chart and the maps. Small cause icons sit beside it: hunger, thirst, bad air, cold boilers, grief after deaths. You always see how they feel and why.
- **Each station has a mood too** (see "The bridge" below). It starts from the crew's morale and is pulled up or down by what that station lives with:
  - **its officer's trait:** a Beloved officer's station leans green, and a Grim one's leans amber;
  - **its own causes:** life support turns red when the air runs out, and the hangar grieves after pilots die;
  - **its state:** a station that is offline or overworked.
- **Traits still count:** Beloved and Grim officers already push morale up or down (Milestone 13).
- **Stopping the spiral:** a red mood makes things cost more, which can make the mood worse. Resting, a mess hall and full stores pull it back. The numbers are tuned so it can always be climbed out of.

**Desertion becomes strikes (decision 17, revised; decision 32).**
Under 15 morale, people no longer leave for good, because that would slowly end the run.

- **Strikes (recommended).** Each day under 15, one station's crew walk off and the station goes dark: arms folded on the bridge, a red mark, a cause icon. It returns when morale is back above 30, or after a parley.
  - A parley is a short event at the bridge that costs a day or some cogmarks.
  - Nobody is lost, but you are weaker until you fix it.
- **The alternative.** Some hands desert, but only when docked at a haven or trader, where they have somewhere to go. Never officers or ship leads, and never below 60% of the crew you woke with. You might meet them again later, living at that haven.

**All hands: the reward for a happy ship (decision 33).**

- **When:** every station is green, which means morale 60 or more, nothing short, every station online and staffed, and no strike.
- **What you see and hear:** the bridge lights up, every lamp warm gold at once. The pipes sing, a brass bell rings and an organ sting plays. A toast appears: "All hands!"
- **The bonus, while it lasts:**
  - work 10% faster on top of Content;
  - ships 5% better on maps;
  - stitches cost 10% less Glim;
  - morale doesn't fall overnight.
- **The streak:** "All hands for 6 days" counts up on the bridge.
- **Long streaks:** a long one can earn a small crew moment, an event where someone writes a song about the Forge or the officers drink a toast to the captain.
- **Data:** the numbers live in YAML.

### Survival weakens, it never kills

Running out of water, air, food or boiler heat no longer ends a life. It makes the Forge **weaker**, step by step. Lives end through combat and other dangers. This replaces the old escalation ladder (crew starving, three days without air ending the voyage), which goes in Milestone 17.

- **Strain.** Each kind of shortage (thirst, hunger, bad air, cold) has a **strain** level from 0 to 3:
  - it rises by one each day the store is empty, and falls by one each day after it is restored;
  - the infirmary and mess hall help it fall faster.
- **What each level of strain costs, added up and capped:**
  - work 15% slower (repairs, building, fitting);
  - costs 10% higher (building and ships);
  - Glim for each stitch 10% higher;
  - ships 5% worse on maps (damage, speed and rate of fire).
  - The total is capped at −60% work, so you can always still act.
- **Stations go offline.** At strain 2 and 3, one more station goes dark, chosen by the shortage:
  - bad air: the crew faint at their posts, starting with the infirmary and comms;
  - cold: the boilers' neighbours go first, engineering and the foundry;
  - hunger: the hangar and stores;
  - thirst: life support and the infirmary.

  Each dark station loses its function until it comes back (see the stations below).
- **Nobody dies of it.** People faint, sicken and shiver, and the named crew stay alive. Losses that pick who dies (Milestone 13) still happen, but only through combat and events.
- **How a life ends now:** the Forge is destroyed (in battle, or by a danger on a map or in an event), or you **Let go**. "Nobody left aboard" can still happen through combat losses, but no longer through starvation.
- **Why it still matters:** a weak Forge loses fights, burns more Glim and builds less. Glim still decides whether you can stitch at all, and the Hands (if chosen) catch a slow ship. Shortages still matter; they just don't end the life.
- **Tests:** the voyage and campaign tests that expect starvation deaths and airless endings change with it. The test captain learns that weakness, not death, is the cost.

**As built (Milestone 17).** Choices made while building it, all tunable in `voyage.yaml`, `crew.yaml` and `items.yaml`:
- **The boilers** draw 10 Glim a day (the low end of 10–15, to keep full runs inside their hours). Cold, every system works at half.
- **Strain penalties** are as written, capped at four levels whatever the surgeon. The surgeon's work (CarePct) now softens what strain costs, since nobody dies of hunger or bad air any more. On maps, strain and All hands change ships' **damage**; speed and rate of fire stay as they are for now (the Milestone 24 balance pass can add them).
- **Station moods** lean with the officer: a Beloved officer's station is judged as if morale were 15 higher, a Grim one's 10 lower. So a Grim officer doesn't block All hands on a truly happy ship.
- **All hands** counts every station that is open. Stations not open yet (sensors before the radar, the infirmary before its room) don't block it, but dark, dim, cold or striking ones do.
- **Strikes** can hit any open station, one a day, chosen by the seed. A parley is a button on the Crew tab: a day of talking, or 40 cogmarks a station; either way morale rises 5.
- **Comms** is a station without an officer until the signals officer arrives with the bridge (Milestone 18).
- **New rooms:** crew quarters (+40 berths over 160; more crew than berths makes them crowded, −10 morale), mess hall (morale +5, hunger and thirst ease twice as fast), infirmary (every strain eases faster, strain costs less, opens the infirmary station), chart room (new clue circles a third smaller), workshop (repairs a quarter cheaper), still room (a fifth less water). Plating and launch rails take no slot.
- **Cogmarks:** a new life starts with 60 (120 on a short voyage). Traders hold a purse of 300, Shearers find one cogmark per 20 salvage, and a dark stores station makes traders charge a quarter more.

### The bridge: the crew screen (decision 34)

The crew screen becomes the **Forge's bridge**: the visual centrepiece of the management layer, and the place you look after your people. It works like a town screen in a management game, but the buildings are **stations** and the people at them.

**What you see**
- A steampunk bridge seen from behind the captain's chair. **Jacob's chair** sits in the middle, raised, with the **stations** in a ring around it: brass consoles, gauges, pipes, and the warm light of each station's lamps.
- **A dark station** is grey glass and still needles. **A lit one** glows, steam drifts from its vents, and its needles move. Every lamp goes gold at once for All hands.
- **On each station:**
  - its officer's name plate and portrait;
  - their mood medallion (green, amber or red) with its cause icons;
  - the station's level as a row of lamps;
  - a state gauge (online, dim, dark, striking, cold).
- **Click a station** to open its panel:
  - the officer (name, trait, mood and why);
  - what the station does now;
  - its skills, as known, trainable or "?";
  - the training it can do this life, and its cost;
  - anything that is keeping it dark.
- **Click the chair** for the captain's panel:
  - the life, the day and the Meridian date (UNKNOWN until the Horologe);
  - morale and the All hands streak;
  - a way into the Loom;
  - the Let go button.
- **How it is drawn (decision 35):** a layered 2D illustration in SVG and canvas, with per-station lighting, animated gauges, drifting steam and slow parallax. It is crisp on phones, where the ring becomes a scrolling column of stations. The alternative is a small three.js bridge interior with real lights, which is heavier but can be orbited. Recommended: the 2D illustration.

**The stations**

The officers' posts become the stations, one each, with one new post (decision 35).

| Station | Officer (post) | What it runs | Skills from memories (permanent) | Training (each life) |
| --- | --- | --- | --- | --- |
| **Engineering** | Chief engineer | Repairs, hull, systems | Shields, heat baffles, lightning rods, lead-lined decks (the systems that open routes) | Field repairs (repairs cost less); damage control (hull damage wears systems less) |
| **Navigation** | Navigator | Stitches and routes | Threadwound Coils, Stillwater Lens, Anchor Spindle, Heartstone | Plotted courses (less Glim); quick stitch (long stitches take a day less) |
| **Sensors** | Watch officer | The chart's reach, scans, clue circles | The radar (lights the station); the chart room's sharper circles | Long watch (sensor range); cheap deep scans |
| **Foundry** | Foundry master | Building ships on maps | Hull types: Wisp, Talon, Sabre, Spindle, Monolith | Shift work (build speed); salvage line (scrap returns more) |
| **Life support** | Grower | Air, water, hydroponics | — | Ration plan (needs a little less); recyclers (water goes further) |
| **Hangar** | Wing commander | Launches, levels, perks | Silent running (the fleet's discipline) | Drills (levels come sooner); fast launch |
| **Comms** | **Signals officer** (new post, from the hands) | Hailing, havens, signals, clues | Story memories: what you can say to each faction, and the havens' dialects as you learn who they are | Long-range hails (the next place over); signal decoding (clue circles from intercepted signals) |
| **Infirmary** | Surgeon | Strain recovery, care, pods | The infirmary | Triage (more pilots get out of lost ships) |
| **Stores** | Quartermaster | The hold, trade, cogmarks | — | Ledgers (better prices); tight holds (more cargo per stitch) |

**What lasts and what resets**

The crew wake with no memories in every life, but Jacob remembers.

- **Permanent: what a station can do, because Jacob remembers how to teach it.**
  - **Skills:** a station's skills come from **memories**. Once Jacob remembers shields, the engineering station knows them in every life.
  - **Muscle memory:** the crew's hands remember what their minds don't. A station whose basic memory is known starts every life **lit at level 1**. For example, once the radar is remembered, sensors are lit from day 1.
  - **Faster teaching:** a known memory also makes that station's training cheaper and quicker, because Jacob knows how to teach it.
  - **Echoes:** they are spent only here, on memories.
- **Each life: how well the crew can do it, because they have to relearn it.**
  - **Training:** each life, you **train** stations up to the levels their memories allow, using cogmarks and days. Training is short (about a day), so a new life gets back up to speed quickly once you know what to teach.
  - **Rooms:** many stations need their room on the deck plan; the infirmary needs the infirmary, for example. Rooms are built with materials each life.
  - **Traders:** some sell one-off station gear for that life, such as a sounding horn for sensors or a better ledger for stores.
  - **Cogmarks:** they are spent only here, on training and trade.
- **Levels:** a station has levels 0 to 3.
  - **0, dark:** it doesn't work, because no memory is known, its room is missing, or it is offline.
  - **1, manned:** basic function.
  - **2, trained:** its officer's bonus counts in full, and it gains its first trained skill.
  - **3, expert:** a second trained skill.
- **At the very start of a campaign** several stations are dark or barely working:
  - sensors are dark until the radar is remembered;
  - the infirmary is dark until its memory and room exist;
  - comms can only hail the place you're at;
  - navigation does short stitches only.

  Over a campaign, more of the bridge lights up for good, and each life you light the rest.

**How it connects to what is built**
- **Officers and posts:** the officers become the stations' officers. The officer's trait still shapes the station's work and now its mood.
- **The signals officer:** a new ninth post, filled the same way as the others: drawn from the hands, promoted Green when empty.
- **Rooms** are the physical side, per life, on the deck plan. **Stations** are the crew's skill, also per life, on the bridge. **Memories** are what both are allowed to become, and they last.
- **Survival:** strain and strikes take stations dark on the bridge.

**As built (Milestone 18).** Where the table above left room:
- **Levels:** every open station wakes at level 1 each life, including those with no memories of their own (life support and stores), so nothing basic stops working at the start. "Dark at level 0" means not open yet (sensors before the radar, the infirmary before its memory and room) or taken down by strain or a strike. Navigation's short stitches at the start are the drive's own reach, not the station's level.
- **Training:** 30 cogmarks and a day to level 2, 60 and two days to level 3 (`voyage.yaml` Training), half price where Jacob remembers any of the station's memories. There's no cap from memories: any open station can reach 3.
- **The officer's bonus** counts half at level 1 and in full from level 2.
- **Skills the table left open:** the foundry's salvage line doubles cogmarks from salvage until the muster's scrap returns arrive (Milestone 19); the hangar's drills speed experience until levels replace it (Milestone 19); the infirmary's second skill is a field hospital (strain costs a fifth less); stores' tight holds bring home a tenth more of what each map gathers; quick stitch takes a day off stitches of three days or more (two days made full runs far too short).
- **Long-range hails** let you talk to whoever holds a place one lane away, but not trade or hire at that distance.
- **The signals officer** draws new clue circles tighter (CluePct, like the chart room).
- **The drawing:** a layered SVG in the approved style. Five consoles stand along the back under the window and two down each side; on a phone the stations stack in a column. Steam, needles and the starfield move gently, and all of it stops for reduced motion.

### Keeping the Forge running (decided: the boilers burn Glim)

A light version of Frostpunk's coal. Three options:

**a. The boilers burn Glim (chosen).**
- The Forge already burns 3 Glim a day for its reactor. That becomes the boilers, with a visible pressure gauge, and the draw rises to about 10–15 a day.
- If Glim runs out, the boilers go cold:
  - every system works at half;
  - life support slows;
  - the crew get cold (an amber or red cause icon), and cold strain builds (see "Survival weakens").
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

**As built (Milestone 19):**
- **Levels** are counted once a map, when a ship first docks after launching. A ship held in the bays gains nothing. The wing commander's work, the hangar's drills and a quick-study pilot can only make a level come sooner (at least a full level per map). The `train n` event effect gives n quarters of a level.
- **Perks** are five behaviours on the map AI: *Covers the Forge* (only targets within about 6 km of the Forge, half leash), *Holds formation* (launches defensive), *Hunter* (half again the scan range, twice the leash), *Finisher* (the most damaged target in range) and *Gets them home* (docks under 30% hull). Three are offered at random to each pilot, and level 5 never repeats the first pick.
- **Berths:** each hangar room adds three berths (`Bays`) as well as its map capacity.
- **The muster** is a dialog on the chart after the report, together with any perk choices. Scrapped ships' pilots stand by for the next ship; ships left adrift take everyone aboard with them.

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

**As built (Milestone 20):**
- Traders are their own place type (`Trader`), placed with their own dice after the pockets: never the wake-up point, an anchor, a derelict, a station or a pocket, and always reachable at the region's drive level. They have no map; Go in is replaced by **Trade**.
- Their goods and dialogs are in `traders.yaml` and `dialogs/<trader>.yaml`. *Unique* goods are one a life. Special goods: `plan-*` (build that room this life), `echo`, `clue` (a circle round the next drive part), `chart` (the region).
- The workshop and still room, buildable from the start in Milestone 17, now need their plan each life, from the Lamp & Ledger and the Tallow Bell.
- The Murmur's "strange coin" and the Monolith plans wait for the story (Milestone 22).

### Crew

- **Where new crew come from:**
  - hull-towns hire crew out, as today;
  - survivor pods and refugee convoys, in events and on maps;
  - places of a new type, **wayhouses**, where drifters ask to come aboard.
- **Limits:** crew quarters set the maximum aboard. (As built: hiring and wayhouse drifters stop at the berths; events and pods can still crowd the Forge past them, which costs morale.)
- **New named crew:** sometimes a newcomer is named: a pilot looking for a ship, or someone who could fill an empty post.
- **New ship types arrive over time:** from memories (Fleet branch), from traders (plans), and from cutting wrecks of a hull, as blueprints work today.

## 9. Steampunk space: style guide (approved)

The **style guide page** is approved as shown, with the chart on parchment: https://claude.ai/artifact/H5PG1TSmFj8ersC413TQrz. New screens are built in it from Milestone 15 on, and the old ones are restyled in Milestone 23. The tech demons' biomechanical look is added to it (§3).

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
| Morale | **Kept underneath** | Shown as the mood mark, with costs; the slow-work rule is replaced by the marks; desertion becomes strikes (decision 32) |
| The consequence ladder (starvation deaths, three days without air ending the run) | **Replaced** | Strain: shortages weaken the Forge and take stations dark, but never kill (Milestone 17) |
| The Crew tab, the officer posts and their traits | **Become the bridge** | Each post becomes a station, plus a new signals officer; the traits shape each station's work and mood (Milestone 18) |
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
- The base, the muster and the traders are independent of each other. Survival that weakens comes with the base, because strain needs stations. The bridge follows straight after, because it is where the stations, moods and training are shown.
- The tech demons come just before the story, which needs them for the Hands and the final battle.
- The story builds on your skeleton, and benefits from every system being in place.
- The reskin waits for your approval of the style guide. Once you approve it, new screens are built in the new style straight away.

| # | Milestone | Playable result | Checks |
| --- | --- | --- | --- |
| ~~14~~ | ~~Campaigns and lives~~ (done, §12) | Start a campaign on a seed; die and wake again in the same galaxy; the chart remembers places; maps vary each life; the wake screen; a campaign save, with old saves migrated. The goal is still today's drive parts | What persists and what resets; same layout but different map contents per life; determinism; old saves load; the bot plays several lives |
| ~~15~~ | ~~The Loom: memories~~ (done, §12) | The memory tree screen with question marks; memories in YAML; echoes; the first life's opening: the short, confusing awakening, the dark chart, the signal, the Anchorage, the radar; clue circles; drive parts become memories | Memories persist; the radar beat works on every seed; a clue circle always contains its place; content lint for memories |
| ~~16~~ | ~~Routes closed until remembered~~ (done, §12) | Hazard lanes and pockets; officers report closed routes by name; anchors placed within areas; shields, heat baffles, lightning rods and lead-lined decks | No way in without the memory; reports come from the right officer (or whoever is acting); the bot completes 50 seeds, and a single-life escape is possible on each |
| ~~17~~ | ~~The Forge as a base, and survival that weakens~~ (done, §12) | The deck plan and rooms (from today's projects, plus new ones); crew quarters; cogmarks; mood marks with causes and costs; the boilers burning Glim; **strain instead of death** for every shortage; stations as data (online, dim, dark, striking); strikes instead of desertion (if chosen); All hands and its bonus | Costs follow the mood; the spiral can be climbed out of; currency and barter agree; rooms reset per life; **no shortage ever kills or ends a life**; strain rises and falls a level a day and its penalties are capped; the right stations go dark for each shortage; All hands starts and stops exactly when every station is green |
| ~~18~~ | ~~The bridge~~ (done, §12) | The crew screen as the Forge's bridge: Jacob's chair, nine stations with their officers, moods, lamps and states; station panels with skills (known, trainable, "?"), training with cogmarks and days, and what keeps a station dark; the signals officer, a new post; muscle memory (a known memory lights its station from day 1); the All hands moment in full (light, bell, organ sting, streak); built in the approved style | Memory-given skills persist across lives and trained levels reset; a known memory starts its station at level 1; training costs less where Jacob remembers; the bridge matches the voyage state; a browser run at desktop and phone width |
| ~~19~~ | ~~The muster and levels~~ (done, §12) | 10 hangar berths; choosing who continues; scrap or leave adrift; levels from coming home; perks (if chosen) | Berths, scrap returns and crew moves; levels only for ships that launched and came back; the pilot dies with the ship |
| ~~20~~ | ~~Traders and crew~~ (done, §12) | Four regional traders on the chart (icon, trade without a map, personalities, unique stock), kept after death; wayhouses and new crew; new hulls over time | Traders persist across lives; stock resets; prices follow standing; crew limits |
| ~~21~~ | ~~The tech demons~~ (done, §12) | The Wound as a real RTS faction: Ticks, Stingers, Chimes, Hounds, Gnawers, Feeders, Hours and Nurseries; ichor from wrecks and the dead; gestation; an AI that gathers, counter-builds, attacks in waves, retreats and expands; infested places and the creep; the Mainspring's attention and the Hands hunting the Forge across the chart (Quiet, Noticed, Hunted, Marked); their biomechanical look | The AI builds, attacks and rebuilds; it counter-builds against your fleet; Feeders starve when wrecks are salvaged; attention rises and falls as specified and never forces an instant loss; a Hand can be outrun or destroyed; determinism on demon maps |
| ~~22~~ | ~~The story~~ (done, §12) | Your skeleton and story update (§3): the 12 story memories and their locations, act by act; the Twain; the time gap; the havens (the Hollowkin, with the Waiting and the Unforgiving) and the Brass Reavers; the Knotfolk and the Ragged Clans; the Meridian Horologe and the HUD date (UNKNOWN until found); the final battle at the Shore, the Forge against the living Mainspring and its forces; the escape ending and the true ending; **the ending narration**, Jacob's illustrated, narrated story, with gaps for memories not found and a line id for every line so a recorded voice can be added later | The bot reaches the true ending on every seed tried; every story memory can be reached; the confrontation can be won; the date stays UNKNOWN until the Horologe, then stays known; each narration scene appears only with its memories and falls back to its gap lines otherwise; every line has a unique id |
| ~~23~~ | ~~Steampunk reskin~~ (done, §12) | Gauges, the parchment chart, telegraph comms, medallions, the Loom and the deck plan in the approved style; riveted copper ships with smokestacks; new effects and sounds | Screenshots against the guide; text contrast; frame rate with 40 ships a side |
| ~~24~~ | ~~Whole campaigns~~ (done, §12) | The death loop balanced: long lives dangerous through play, shorter campaigns, the test captain playing the real loop (the guided first life and polish move to the next milestone) | Lives and hours inside the targets; a skilled first-life escape is possible; no seed is unwinnable |

**Later, as add-on packs:** new regions beyond the Shore, new traders, races and factions, more memories and story arcs, and co-op multiplayer (the engine stays lockstep-ready).

## 12. Milestones done (1–24)

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
| 14 | Campaigns and lives | One galaxy per campaign, played over lives; the wake screen and Let go; the chart, the memorial, hints and the Choir's standing carry over, everything physical resets; the same crew wake each life; map contents, events and dice vary per life (the first life plays as before); one campaign save (version 5), older saves load as a first life; the test captain plays campaigns of several lives. The steampunk style guide page is delivered for approval |
| 15 | The Loom: memories | 31 memories in YAML, in five branches, kept for the whole campaign; echoes (from memories, events and the echo where a life ended) recall abilities on the Loom; the first life's opening (a short, confusing awakening, a dark chart, the signal, the Anchorage, its core giving back the emblem and the radar); clue circles that contain their place, shrink with another clue and are pinpointed close up; drive parts and hulls become memories (nothing to fit); the Loom in the approved brass style; old saves keep their sensors, drive parts and hulls as memories |
| 16 | Routes closed until remembered | Four hazards in YAML (asteroid shoals, ember lanes, static fields, the Glare); pockets carved off to the side of each region, sealed by the hazard on every lane in, never across the way; the officer at the hazard's post reports it by name (or whoever is acting); the navigator reports the Veil and the drive's reach; Shields, Heat baffles, Lightning rods and Lead-lined decks recalled for two echoes once a hazard has turned the Forge away, and open in every life after; richer places and a strongbox of echoes in every pocket; hazard lanes in their colours on the chart; the test captain gets home in a single life on 50 full and 50 short seeds |
| 17 | The Forge as a base, and survival that weakens | A deck plan of 8 slots for 17 rooms (the eleven projects, plus crew quarters, mess hall, infirmary, chart room, workshop and still room; three need their memory), stripped to free a slot, lost each life; strain from thirst, hunger, bad air and cold, a level a day to 3, capped penalties, stations dark at 2 and 3; nobody dies of a shortage; the boilers burn 10 Glim a day and go cold without it; nine stations as data (online, dim, dark, striking, cold) with what each loses when dark; the crew's mood (Content, Uneasy, Angry) with causes and costs; strikes and parleys instead of desertion; All hands with its bonus, bell and song; cogmarks in trade, from a trader's purse, from wrecks, and to pay strikers; the mood on maps changes ship costs and strength |
| 18 | The bridge | The crew screen as the Forge's bridge in the approved brass style: Jacob's chair under the great window and nine consoles in a horseshoe (name plates, officers, mood medallions, level lamps, state gauges; lit ones glow, waver and steam; all lamps gold for All hands), a column on phones; station panels (officer, what it runs, memories for it lit or "?", training, what keeps it dark) and the captain's panel (life, day, Meridian date UNKNOWN, morale, All hands streak, the Loom, Let go); the signals officer, a ninth post, runs comms; levels 0 to 3, every open station waking at 1, trained to 2 and 3 each life with cogmarks and days (half price where Jacob remembers), officers' work half at level 1; 18 trained skills |
| 19 | The muster and levels | Levels replace kill experience: a level for each map a ship launched on, survived and came home from (once a map), 1 to 5 at +5% damage and hull; perks at levels 3 and 5, picked from three on offer (Covers the Forge, Holds formation, Hunter, Finisher, Gets them home), each changing how the ship fights; 10 hangar berths by count, three more per hangar room; the muster after a map with more ships than berths (scrap: half the ore back, the crew into the Forge; leave adrift: ship and crew lost), with nothing stitching until it is settled; traders refuse hulls without a berth; old saves turn ranks into levels |
| 20 | Traders and crew | Four regional traders placed by the generator, one per region (the Lamp & Ledger, the Tallow Bell, the Murmur, the Last Stop), with a brass bell on the chart, traded with from the chart in their own dialogs, prices by their faction's standing, their own stock reset each life with one of each unique good (room plans, echoes, clues, a chart, Sabre plans), and on the chart for good once found; the workshop and still room need plans; two wayhouses a region, where drifters come aboard once a life, sometimes with a name (an empty post, or a pilot); hiring and drifters stop at the berths |
| 21 | The tech demons | The Wound as a faction on maps, everyone's enemy: Ticks, Stingers, Chimes, Hounds, Gnawers, Feeders, Hours and Nurseries in YAML, each mirroring one of ours, with its own weapons and a counter both ways round; biomechanical models (wet blue-black metal, flesh, bone, a pulsing crimson light); ichor from wrecks (Feeders, starved by salvage), from the dead and from Nurseries; gestation in an Hour's pods; the WoundAI (keeps Feeders out, counter-builds Chimes against fighters and Stingers against big hulls, attacks in waves past a threshold, reinforces a winning wave, falls back to regrow, plants Nurseries); time drags near an Hour; a hurt Hour flees and regrows; the creep mends demons; attention (Quiet, Noticed, Hunted, Marked) from memories, days, staying, burning and killing, lowered by silent running (now a memory), the Choir and static fields, and waking each life near what memories earned; Hands that set out from the Shore, follow where the Forge was heard, lose the trail, won't cross static fields, grow, catch the Forge (harassing, never ending the life), can be outrun, shaken off, torn free of at a cost, or destroyed for the life (attention down a step); a lone pack roaming the outer regions at Noticed; infested places (Nurseries, garrison, spore haze) burned clean for an echo and sometimes captives; red-ink stains, Hand markers and ticking on the chart; the attention word in the top bar; the Wound in the Proving Grounds. (Ships don't repair on maps yet, so the creep's slower repairs wait for that) |
| 22 | The story | The twelve story memories with their texts, found at story places placed in each act's region after the hazard pockets (never on a water or Glim stop): the Steward, the Quiet Lamp, the Tally of Owls, the Long Account, the Reliquary of Ninefold, the Meridian Horologe, the Tithe Barge and the Founding Hall, or given by the people who remember (the registry after the first fight with the Wardens, the Deacon's oath at the Tallow Bell, the Choir's waking); Deck 9 opening at the Shore with every other one known; clue chains and events act by act; the strong moments (our mark on their hull, the Waiting, the Unforgiving); four new peoples (the Wardens of Ninefold of the Knotfolk, the Ragged Clans, the Brass Reavers, the Hollowkin holds); the Meridian date (UNKNOWN, then the last record, then the Horologe's running clock, known in every life); the Mainspring in its lair at the Shore's edge near the Heartstone (two hearts and a coil ward its core, it regrows from the dead, gestates and drags time, the Twain answers it, it is 60% of itself on a short voyage), the final jump only once it is dead; the escape ending and the true ending with its final choice (decision 38: all three); the ending narration in `narration.yaml` (ten scenes, gap lines, an id for every line, ready for a recorded voice), etched sepia plates of the game's own models with slow camera moves, organ, strings and ticking clocks; ships no longer waste fire on a warded target, and a great hull is seen through the fog by its flank; the test captain fights the lair, drifts when out of Glim, and in story mode reaches the true ending. (The full-voyage length check allows 6.5 hours now the final battle is in; Milestone 24 rebalances to the campaign targets) |
| 23 | Steampunk reskin | The approved style everywhere: the brass palette (iron, soot, steam, brass, copper, verdigris, parchment, sepia, signal red, amber, enamel) and type (IM Fell English for headings, Spectral for reading, Cutive Mono for numbers), riveted soot panels with brass edges; round brass gauges for water, food, air, Glim and the boilers (PSI, COLD) on the chart and on maps, with odometer counters; enamel mood medallions with faces and stamped cause icons; the Skein as a glass pressure tube; the star chart as a navigation parchment on the chart table (stained, folded, burnt edge, compass rose, scale bar, cartouche; wax seals coloured and lettered by kind from `poi-types.yaml` Seal; inked lanes, teal where live; closed hazard lanes dashed and hatched with their mark; the Veil hatched violet; pencil clue rings; the Forge as a brass token; ink lettering with a paper halo); telegraph comms (a telegram card typed out on the tape with key clicks, brass number keys; the Choir in light, the Gaunt half burned; events on the same card); the deck plan as a cutaway of the hull with Deck 9 sealed at the bow; riveted ships in each faction's plating (`world.yaml` Hull and Shine), portholes, smokestacks venting Glim steam, steam from the engines, rotary guns, the Spindle's lightning lance (`Arc`), copper coils; new sounds (telegraph key, valve hiss, plate clank, lance crackle, the memory organ); a model gallery page; the style test (text contrast at 4.5:1, mesh and triangle budgets per hull and for a 40-a-side battle) |
| 24 | Whole campaigns | The death loop is the game (decisions 39–41). **A long life is a loud one:** a day's attention counts 4 times from waking, 8 from day 20 and 12 from day 40; a Hand's pack 15% bigger and tougher every 30 days; from day 60 a second, strong Hand whatever the attention; from day 42 the Hands keep the trail (follow the Forge itself, a lane a day, rest 2 days); a killed Hour buys 45 days; tearing free costs 12% of the whole hull and destroys a Forge with less (the chart warns); small galaxies age twice as fast, are hunted from day 1 and fight a full-strength Mainspring. **Shorter campaigns:** water need halved, full tanks at every waking, charted space (lanes flown before: a day and half the Glim, in every life). **The test captain** plays mortal campaigns: it builds warships from ore, mends the hull, tears free of Hands it can't beat and fights those it can, loses fights the way a real map shows (a Hand left to fight takes 15–40% of the hull in two minutes and destroys the Forge in five), gathers ore before the last battle, lets a hopeless life go, and spends its echoes on waking (silent running first). **Measured** (8 seeds): full galaxy 6.5 lives, 12.8 hours, 124 minutes a life; small 5 lives, 8.2 hours, 103 minutes; a first-life escape from a full galaxy by a strong player 1 in 8, by a decent one never. The one-life checks became campaign checks (run, story, voyage, event, campaign and hazard tests) |

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
| Scope | Each milestone is playable on its own; the story's open decisions (§17) don't block the systems |

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
| Your people | **Meridian Hollow** (now the name of the empire, learned through memories) |
| Drive components | Threadwound Coils, Stillwater Lens, Anchor Spindle, Heartstone (now memories) |
| Races | Hullborn, Tallowfolk, Gaunt, Choirmoths |
| Factions | Rivet Moot, Lantern Synod, Ashen Gaunt, Cinder Pact, the Choir |
| Monsters | Scrapwyrm, rust mites, Gnasher packs, the Hollowhorn |
| Hulls | Shearer (salvage cutter), Skimmer (gas collector), and the combat roster |

Approved with your answers (decision 24):

| Thing | Name | Alternatives considered |
| --- | --- | --- |
| The memory tree | **The Loom** | The Spool, the Engram |
| Our old station | **The Anchorage** | Meridian Spire, the Cradle |
| Fragments of memory | **Echoes** | Glimmers, threads |
| Currency | **Cogmarks** | Tallies, brassbits |
| Hazards | Asteroid shoals, ember lanes, static fields, the Glare, the Undertow (and the Veil) | — |
| Traders | The Lamp & Ledger (Wicket Arn), the Tallow Bell (Deacon Ilmar Sloe), the Murmur, the Last Stop (Ossory Vell) | — |
| Places where crew join | **Wayhouses** | Drifter camps |

Proposed now, for the story (decision 26):

| Thing | Proposed name | Alternatives |
| --- | --- | --- |
| The family corporation | **The Smith Foundry Company** ("the Company") | Smith & Sons Ironworks, the Smith Combine |
| The empire | **The Meridian Hollow** (the approved name, now the empire) | — |
| The only planet | **Ninefold** | The Knot, Orrin's Child |
| Its people | **The Knotfolk**; their fleet, **the Wardens of Ninefold** | The Tethered |
| The empire's sickness | **The Fray** | The Unthreading |
| The force | **The Mainspring** | The Governor, the Escapement |
| Its hunters | **The Hands** | Pendulums, Tickers |
| The kidnapped tribes | **The Ragged Clans** (Gaunt) | The Wreckclans |
| Erik's yacht | **The Steward** | — |
| The sealed deck | **Deck 9** | — |
| The relic | **The Twain** | The Clasp, the Stillpoint |
| The clock station | **The Meridian Horologe**; its time is **Meridian time** | The Long Clock, the Chronarium |
| The Company's descendants | **The Hollowkin**: tribes and holds; the **Waiting** and the **Unforgiving** | The Emblem-folk |
| Human pirates | **The Brass Reavers** | — |

## 16. Decisions already made

From the earlier plans:

| # | Question | Decision | Under the new design |
| --- | --- | --- | --- |
| 1 | Galaxy map time | **Paused**; it moves only when you act | Unchanged |
| 2 | Death and saves | **Permanent death by default**, with save and quit; a free-save mode offered at the start | **Replaced:** death starts a new life; one campaign save (v3 decision 8) |
| 3 | Run length | **4–6 hours**, plus a **short voyage** of about 90 minutes | **Replaced:** campaign targets (v3 decision 10; now decision 41: a full galaxy in 5–8 lives and 9–13 hours, a small one in 3–5 lives and 5–9 hours) |
| 4 | Same galaxy or random | **A new seeded galaxy each run**; story locations placed by rules | **Now:** one galaxy per campaign; story locations placed within areas |
| 5 | Story | **Hand-written story moments plus random events** | Unchanged; now built on your skeleton (§3) |
| 6 | Leaving a map | **Always possible**, but some enemies can interrupt the spool-up | Unchanged |
| 7 | Crew depth | **Officers and pilots are named**, everyone else is a head count; **named crew die for good** | Now "for the rest of that life": the same crew wake again (v3 decision 6) |
| 8 | Fleet between maps | **Ships travel with you**, limited by hangar space; losses are permanent | Unchanged; hangar berths by count, and the muster |
| 9 | Scale of fights | **Up to about 40 ships a side** | Unchanged |
| 10 | Sandbox | **Keep the Proving Grounds** for testing | Unchanged |
| 11 | Tone | **Lonely, beautiful and a bit strange, with dry humour** | Unchanged, with dark story memories (§3) |
| 12 | Names | **Keep all the proposals** in §15 | Unchanged |
| 13 | Galaxy map view | **3D with the orbit camera, kept readable** | Unchanged, styled as a parchment chart |
| 14 | Difficulty setting | **None**: the pressure is survival and hostiles | Unchanged |

The 24 questions of version 3 were answered "all recommended, except 2, 4, 12 and 24":

| # | Question | Decision |
| --- | --- | --- |
| 1 | Map contents per life | **Vary each life**; the layout, story locations and traders stay fixed |
| 2 | Why we wake again | **No Skein time loop.** The force (the Mainspring) returns Jacob after each death, and defeating it breaks the loop. Memories are kept in the Forge's drive records. *Story update:* the relic, the Twain, saved Jacob with a time shield; why he comes back is decision 29 |
| 3 | Endings | **A skilled player can escape in their first life; the true ending needs every memory** |
| 4 | Story direction | **Your story skeleton, with your story update** (§3): the theft of the Twain woke the force; 147 years have passed; the havens; the Meridian Horologe; the opening and the ending narration. The force waits at the Shore and must be defeated to escape. It may hunt you within a life (decision 25) |
| 5 | What carries over | **As proposed** (§2) |
| 6 | Crew across lives | **The same people wake again**, alive, remembering nothing |
| 7 | Faction standing | **Resets each life**, except the Choir's |
| 8 | Saves | **One campaign save**, save and quit any time, no reloading older saves; free saves go |
| 9 | Giving up a life | **Yes**: the Let go button |
| 10 | Length targets | **First-life escape 2–3 h; true ending 8–12 h over about 5–8 lives; short campaign 3–4 h** |
| 11 | How memories are earned | **Found, plus echoes**, including the echo waiting where you died |
| 12 | The tree | **31 memories in five branches**, with the story memories rebuilt on the skeleton (§4) |
| 13 | Drive parts | **Become memories**; nothing to fit |
| 14 | Hazards | **As proposed** (§5) |
| 15 | Rooms | **Reset each life**; the memory of how to build them stays |
| 16 | Currency | **Cogmarks**, per life, alongside barter |
| 17 | Mood | **Content +10% work; Uneasy +10% costs; Angry +30% costs.** Desertion under 15 is being reconsidered so that it only weakens you (decision 32) |
| 18 | Keeping the Forge running | **The boilers burn Glim** |
| 19 | Hangar | **10 berths by count**; scrap returns half the ore and saves the crew; leaving adrift loses both |
| 20 | Levels | **Only ships that launched and came home**; 5 levels at +5%; perks at 3 and 5; kills no longer count |
| 21 | Traders | **Four regional traders**, tied to factions, trading from the chart |
| 22 | Faction stations | **Stay as maps** you can enter |
| 23 | Art | **Style guide first** (with Milestone 14), then new screens in the new style, then the full reskin |
| 24 | New names | **All approved** for now (§15) |

The decisions made after the story update:

| # | Question | Decision |
| --- | --- | --- |
| 25 | The chase clock | **Yes:** the Hands hunt the Forge in every life, as a soft, growing threat, not a countdown. The Hands are the tech demons' fleets (§3) |
| 26 | Story names | **Approved** |
| 27 | Memory order | **Approved**, with memory 10 and Erik's role changed: the Company was the demons' hostage; Erik saw the offerings were feeding the demon lord and refused; he is a tragic, good man |
| 28 | The cast | **Approved** |
| 29 | Why Jacob comes back | **The creditor**, with hints that it might be the Twain |
| 30 | Why he wakes now | **All three layers**, and no one is sure |
| 31 | The time gap | **147 years** |
| 32 | Instead of desertion | **Strikes** |
| 33 | All hands | **Approved** |
| 34 | What lasts on the bridge | **Approved** |
| 35 | The bridge's details | **Nine stations, the signals officer, a layered 2D drawing** |
| 36 | The tech demons' names | **Approved:** the Wound (the faction, the Company's name for them); Ticks, Stingers, Chimes, Hounds, Gnawers, Feeders, Hours and Nurseries (the ships); ichor (their resource); the Mainspring (unchanged) |
| 37 | How Erik's refusal brings the fall | **a. Punishment:** the Hands fall on the Anchorage; Erik holds the docks so the evacuation ships get away, and the havens exist because of him |
| 38 | The true ending's final choice | **All three, the player's choice:** pay the debt, part the halves, or keep the Twain whole; the narration's last scene follows the choice |
| 39 | Making long lives dangerous (Milestone 24) | **Approved:** attention grows with the length of a life; the Hands grow with the life; the bot plays the real death loop. The galaxy thins out only mildly: the stripped-places rule (already in: −35% a return, floor 30%); faster wear and slower restocks only if the numbers called for them (they did not) |
| 40 | Campaign length (Milestone 24) | The first measurements showed the story itself took 10–15 hours of play even in one flawless life, so 6–10 hours could not be reached by dying sooner. **Shorten the campaign:** the crew's water need halved; charted space (a lane stitched before, in any life, takes a day and half the Glim); then the Hands tuned so lives end around day 80–100. Also: every life wakes with full tanks; tearing free with too little hull destroys the Forge; a killed Hour buys 45 days; small galaxies age twice as fast, are hunted from day 1, and fight a full-strength Mainspring |
| 41 | Campaign targets (Milestone 24) | Proposed 5–8 lives, 40–90 minutes a life, 6–10 hours. Measured with lighter logistics, still about 11 hours at best: **adjusted** (the designer had no preference between the options; the recommended one was taken) to 5–8 lives and 9–13 hours on a full galaxy, 3–5 lives and 5–9 hours on a small one, 60–130 minutes a life. Approved for now, to be retuned from testers' feedback. A first-life escape: possible but rare on both sizes (decision 42) |
| 42 | A small galaxy's first life was escaped too often | **Approved, with the whole-truth exception:** surviving Hands come home to defend the Mainspring's lair (at full strength). So that the true-ending battle stays as it was (and the campaign targets hold), they don't come once Jacob remembers the whole truth: the Twain sings over the call. Measured: a first-life escape by a strong player 1 seed in 8, by an ordinary one 0 in 8, on both sizes; campaigns unchanged (full 6.5 lives, 12.8 hours; small 5 lives, 8.2 hours). Consequence: without the whole truth every attack on the lair meets the Hands, so the escape ending is rare in every life (a drive-only campaign escapes on about a third of seeds for a strong player within 14 lives); the reachability tests now play to the true ending. The designer keeps the lesser escape rare but possible, for players who hunt the Hands down before the lair; the lair's card spells out the choice (hunt the Hands down first, or remember the whole truth) |
| 43 | The Company's faith, the emblem and the opening (story update) | **The designer's update:** the Company is an order of faith and technology, Christian-inspired, that looks like a far-future crew, not a church; faith shows only in small details (the cross emblem, a pendant, a small icon at a station). The emblem is a cross joined with a scientific symbol, its final design open (placeholder: a cross with an orbit drawn through its arms). The opening passes over the emblem, the lamps flicker, the crew wake asking what happened, and Jacob asks for a status report: "Nothing's working, Captain", and in later lives "... except the radar", naming every system he remembers. Erik: the Company was the tech demons' hostage; he finally refused to keep sacrificing when he saw it made the Mainspring stronger (memories 10 and 11, the events and the narration all say so) |
| — | The style guide | **Approved as shown**: palette, type, the chart on parchment, instruments, ships |
| — | The force | **A real RTS faction: the tech demons.** Their lord is a living mothership (the Mainspring), their fleets are the Hands, and the final battle is mothership against mothership |

## 17. Decisions still open

Decisions 36 and 37 were answered after Milestone 20, and decision 38 (the true ending's final choice: all three) during Milestone 22 (§16).

Only the deeper mysteries stay open, on purpose: the base game hints at them and answers none.

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
