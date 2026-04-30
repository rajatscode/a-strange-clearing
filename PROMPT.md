Absolutely. Put this in a file like `BRIEF.md` and give it to Claude.

```text
You are building an interactive personal website that is more art piece than portfolio.

Do not reduce this to a normal website.
Do not cut scope unless something is technically impossible.
Do not replace the concept with a template.
Do not add a top nav, hero section, CTA buttons, résumé sections, marketing copy, or generic portfolio cards.
Do not over-explain the site with text.
Do not make it cute.
Do not make it corporate.
Do not make it a startup landing page.
Do not make it a productivity blog.
Do not make it cyberpunk slop.
Do not make it a lore wiki.
Do not make it sterile.

This should feel like a hidden place someone discovers while lost online at 2am.

The site is a dark, interactive, bioluminescent clearing. It is part grassy field, part night sky, part wetland, part stellar nursery, part small moral universe. The ground and sky should blur together. There should be glowing neon blobs, tall grass of varying heights, drifting spores/stars, soft haze, faint trails, and hidden objects. The user should not immediately know what everything is. They should explore.

This is not primarily for recruiters. It is not trying to efficiently explain a person. It is an invitation to wander, pay attention, and discover things.

The site has only three real content destinations:

1. Notes
2. Artifacts
3. Bio

But these destinations must not appear as obvious navigation. The user finds them inside the world.

The landing page is the main experience. The other pages are discovered through interaction.

The visitor is also present inside the world as a small glowing entity. They are not merely a cursor. They are a small god/blob whose behavior changes the ecology. They can create beauty, destroy ugliness, cooperate, defect, get lost, lose energy, and temporarily die.

Build this as a polished MVP, but not a toy demo. It should have product sense, atmosphere, and coherence. Constantly evaluate whether the result feels like a hidden living place rather than a portfolio. If it starts feeling like a normal website, correct course.

TECH STACK

Use:
- React
- TypeScript
- Tailwind
- HTML canvas or WebGL. 2D canvas is acceptable if the effect is beautiful.
- Web Audio API for procedural sound.
- Local data files for Notes and Artifacts.
- localStorage for persistent karmic/ecological state.
- No backend required.
- No stock music.
- No external image assets unless absolutely necessary.
- Prefer procedural visuals.

Suggested structure:

src/
  components/
    WorldCanvas.tsx
    AudioEngine.ts
    DiscoveredOverlay.tsx
    PageShell.tsx
    NoteView.tsx
    ArtifactView.tsx
    EnergyGlyph.tsx
  data/
    notes.ts
    artifacts.ts
    fragments.ts
  lib/
    mood.ts
    simulation.ts
    persistence.ts
    geometry.ts
  pages or app routes:
    index
    notes
    artifacts
    bio

If using Next.js, use the app router if convenient. If using Vite, implement simple client-side routing. Do what is fastest while preserving the concept.

CORE EXPERIENCE

The first thing the user sees should be the living clearing.

No big explanatory homepage.
No “Hi, I’m Rajat.”
No “Welcome to my portfolio.”
No obvious nav bar.

At most, there may be a tiny faint title or fragment, such as:

“The Clearing”

or

“look closer”

or no text at all.

The world itself is the interface.

The user explores using only:

- mouse movement
- hover
- click

No visible controls except a very subtle mute/unmute glyph for sound and maybe an extremely subtle reset/rebirth affordance if the user dies.

No keyboard controls required. Do not depend on keyboard input.

VISUAL ART DIRECTION

The world should look like:

- a dark grassy clearing at night
- glowing neon blobs/spores/stars moving through it
- bioluminescent tips in tall grass
- ground and sky blending together
- deep haze and depth
- ambiguous horizon
- organic and astronomical at once

Palette:

Base:
- near-black
- deep blue-black
- deep green-black
- dark indigo

Accents:
- electric cyan
- acid green
- ultraviolet violet
- dim blue
- rare amber/orange for warmth, danger, or life force

Avoid:
- flat black background with random dots
- generic particle field
- obvious sci-fi dashboard
- cyberpunk city aesthetic
- shiny glassmorphism panels
- white cards
- large text overlays
- corporate gradients
- cartoon game UI

The visual should feel alive, not like a screensaver.

Use layers:

1. Background depth:
   - dark gradient
   - faint mist
   - subtle noise/grain
   - barely visible star/spore particles

2. Horizon ambiguity:
   - do not draw a clean horizon line
   - blend grass into sky and sky into grass
   - use fog and glow to make depth uncertain

3. Grass:
   - many procedural grass filaments
   - varied height
   - subtle wind motion
   - grass bends near the player/mouse
   - occasional luminous tips
   - grass density varies with world mood

4. Entities:
   - glowing blobs / spores / seeds
   - soft halos
   - organic motion
   - some are friendly, some fearful, some parasitic, some corrupted
   - entity behavior should be visually legible but not explicitly labeled

5. Hidden nodes:
   - Notes appear as drifting fragments/fireflies/page-shards
   - Artifacts appear as more solid geometric relics/buried machines/glass objects
   - Bio appears as a singular quiet object: cairn, monolith, still pool, beacon, or maker’s mark

6. Effects:
   - soft trails
   - ripples on click
   - blooms when beauty increases
   - static/sickly distortion when corruption increases
   - gentle color shifts over time

The site should have aesthetic depth. Spend effort on polish: glow falloff, opacity, easing, trails, subtle movement, and composition.

If the result looks like a default canvas particle demo, it has failed.

INTERACTION MODEL

The user is represented as a glowing entity/blob in the world.

The mouse controls or influences this entity, but the entity should feel embodied, not exactly identical to the cursor. It can lag behind slightly, pulse, glow, or leave a faint trail.

Mouse movement:
- slow, gentle movement should be interpreted as attentive and careful
- frantic, jagged movement should disturb the field
- nearby grass bends
- nearby blobs respond
- hidden objects may flicker into visibility

Hover:
- hovering patiently over a thing is like listening/witnessing
- it can reveal hidden glyphs
- it can stabilize weak entities
- it can increase trust
- it can expose Notes, Artifacts, or Bio entrances
- it should not dump lots of text

Click:
- click is intervention
- depending on context, click can nourish, extract, cleanse, break, enter, or disturb
- click should sometimes be risky
- click should not always be good
- the meaning should be inferred through consequence

The site should teach the user that attention matters.

HIDDEN NAVIGATION

The three destinations must be embedded in the world.

There should be no obvious menu saying Notes / Artifacts / Bio.

The user discovers entrances.

Notes:
- appear as drifting fireflies, page fragments, luminous seed pods, faint glyphs, tiny scraps
- they are more ephemeral, numerous, and delicate
- when approached/hovered patiently, a note symbol sharpens
- clicking enters a note or the notes archive

Artifacts:
- appear as strange solid objects, relics, shards, buried machines, geometric anomalies
- they are more stable and less common than notes
- clicking enters an artifact/project view or artifact archive

Bio:
- appears as a singular stable object
- a quiet central/rare thing: cairn, monolith, still pool, compass, beacon, maker’s mark
- should not be too obvious at first, but should be findable
- clicking opens a tiny bio page

Fairness:
- Hidden navigation must not be impossible.
- A curious user should find something within 15–30 seconds.
- The site can demand attention, but it must reward it.
- The user should not feel permanently stuck.
- As trust/beauty/navigability increases, paths should become easier to find.
- As hostility/corruption increases, paths should become harder to find.

INNER PAGES

The inner pages should be calmer and more legible than the landing world, but still feel connected to it.

They should not look like a normal blog template.

Notes page:
- rough notes / chaotic blog / fragments
- presented like found scraps, constellation/archive, or sparse field notes
- readable once opened
- local data is fine
- include sample notes
- use very little framing copy

Sample note titles:
- Density is not intimacy
- Not every system wants optimization
- Trust is cheaper than verification only after memory exists
- A mountain is a machine for returning scale to the body
- Against sterile ambition
- Contact increases; meaning does not
- The private weather of human beings

Each note can have:
- title
- date
- tags
- status: rough, fragment, field note, unfinished
- short excerpt
- body placeholder

Artifacts page:
- projects / experiments / things made
- should feel like inspecting relics, not viewing portfolio cards
- local data is fine
- each artifact should have title, type, status, description, links

Sample artifacts:
- The Clearing — procedural field / alive
- Small Games for Coordination Failure — simulation sketches / unstable
- Systems Tools — interfaces for making hidden structure visible / seed
- Ski Field Log — terrain/weather archive / dormant
- Sound Weather Engine — procedural audio experiment / seed

Bio page:
- very short
- grounded
- no self-mythologizing
- no résumé language

Possible copy:

“Rajat.
I build software and small systems.
I like tools, mountains, cities, long drives, rough notes, and conversations that become more honest than expected.”

Maybe add tiny icon links:
- mail
- github
- maybe writing/rss

Keep it small.

TEXT PHILOSOPHY

Use very little text, especially in the landing world.

The site should not explain itself.

Allowed text fragments, used rarely:
- look closer
- not everything surfaces
- some paths only appear when disturbed
- leave with what you find
- memory made a shelter
- density is not intimacy
- not every system wants optimization
- arrival is a disturbance
- contact increases; meaning does not
- the field remembers

Use these sparingly. They should appear as environmental fragments, not slogans.

Do not plaster aphorisms everywhere.

The writing should be restrained. The interface can be mysterious; the prose should be plain.

PROCEDURAL TIME-VARYING WORLD

The site must change over time.

Use current UTC time to derive a smoothly varying world mood.

Do not use a hard hash that abruptly changes the whole world.

Use smooth functions:
- sine/cosine waves with different periods
- low-frequency oscillations
- optionally interpolated seeded values
- smooth noise if implemented

The world should vary gradually over minutes, hours, and days.

Create a global mood object derived from UTC time, such as:

type CosmicMood = {
  hueBias: number
  brightness: number
  saturation: number
  grassDensity: number
  fogAmount: number
  windStrength: number
  driftSpeed: number
  glowRadius: number
  nodeRarity: number
  discoveryBias: number
  audioWarmth: number
  audioTension: number
  volatility: number
}

Use this mood object to affect:
- palette
- grass density/height/motion
- particle count
- blob behavior
- hidden node probability
- fog
- sound
- hostility/cooperation probabilities

Example design:
- daily cycle affects warmth and brightness
- multi-hour cycle affects fog and density
- multi-day cycle affects volatility/tension
- shorter slow cycle affects wind and motion

The same visitor returning later should feel that the world is related but different.

MORAL / ECOLOGICAL SYSTEM

The user is a small god/blob in the ecology.

Their behavior teaches the universe how to behave.

If they act cooperatively, patiently, and beautifully, the world becomes more cooperative, more beautiful, and easier to navigate.

If they act greedily, destructively, or parasitically, the world becomes harsher, uglier, more deceptive, and harder to navigate.

Do not explain this explicitly in text.
Let the user infer it through consequence.

Track world/player values such as:

type KarmaState = {
  beauty: number
  trust: number
  hostility: number
  navigability: number
  corruption: number
  playerEnergy: number
  generosity: number
  extraction: number
  patience: number
}

Persist some of this in localStorage. The world should remember the visitor’s moral history across sessions.

Combine:
- current UTC-derived cosmic mood
- persistent local karmic history
- current session behavior

World state = cosmic weather + user karma + current local ecology.

BEHAVIORAL INTERPRETATION

Gentle behavior:
- slow mouse movement
- patient hover
- not spam-clicking
- approaching weak entities without draining them
- clicking corrupted/ugly things carefully
- spending energy to nourish/stabilize

Effects:
- increases trust
- increases beauty
- increases navigability
- colors become friendlier
- grass glows more
- blobs cooperate more
- notes/artifacts/bio become easier to find
- sound becomes richer and more harmonic

Aggressive/extractive behavior:
- frantic mouse movement
- spam clicking
- repeatedly harvesting energy from fragile entities
- breaking stable clusters
- disturbing beautiful areas
- ignoring corruption while extracting from beauty

Effects:
- increases hostility
- increases corruption
- lowers trust
- lowers navigability
- colors become colder/sicker/grayer
- sound becomes harsher/thinner/more dissonant
- blobs defect more
- paths hide deeper
- energy drains faster

Important:
Do not make this simplistic “good vs evil.”
Do not label meters “good” or “evil.”
Do not display morality scores.

The field should have ethics, not messaging.

CREATE BEAUTY / DESTROY UGLINESS

The moral obligation is not merely “be nice.”

There should be corrupt or ugly/parasitic growths in the world:
- black thorny forms
- static nests
- sickly gray blooms
- energy leeches
- false beacons
- parasitic blobs
- dead zones

Destroying or cleansing these should be good, but risky and costly.

When the player cleanses corruption:
- player energy decreases
- beauty may increase
- local colors recover
- grass may glow
- nearby entities become more cooperative
- hidden paths may become clearer
- sound may resolve into harmony

But:
- corruption can retaliate
- attacking the wrong thing can harm beauty
- mindless destruction should increase hostility/corruption
- cleansing should require attention, not spam-clicking

The deeper ethic:
Create beauty.
Protect beauty.
Destroy ugliness without becoming ugly.

PLAYER ENERGY AND DEATH

The player has energy.

Represent it subtly:
- a glowing aura around the player blob
- a small circular glyph
- a pulse intensity
- not a big HUD bar if avoidable

Energy is lost through:
- overreaching
- corruption
- predation
- bad interactions
- aggressive extraction
- risky cleansing
- getting trapped/lost in hostile zones

Energy is gained through:
- cooperative exchanges
- discovering healthy nodes
- restoring beauty
- trusted interaction
- patience
- resonance with the field

When energy reaches zero:
- the player dies / loses agency
- controls stop working
- player blob fades
- world desaturates or grays from player perspective
- sound continues but becomes distant
- the world keeps going without them
- hidden pages may remain visible but unreachable
- this should feel haunting, not like a videogame “game over”

Do not show a big GAME OVER screen.

Recovery:
Do not instantly respawn.

Preferred recovery:
- if the user remains still for a while, a faint ember appears
- clicking the ember restores a small amount of energy
- the world remains partially scarred by what happened
- this rewards stillness/reflection

Also allow browser refresh to reset session-level death, but keep some persistent karma.

PROCEDURAL SOUND

Add procedural sound using Web Audio API.

Audio must start only after user interaction due to browser autoplay rules.

Include a very subtle mute/unmute glyph.

Sound should be:
- quiet
- ambient
- sparse
- living
- reactive
- not stock music
- not a song loop
- not annoying
- not overly dramatic

Sound palette:
- filtered drones
- soft wind/noise texture
- glassy chimes
- faint pulses
- distant low rumbles
- small blooms on click
- overtones when hovering hidden objects
- harsher noise/static when corrupted
- more harmonic resonance when beautiful/trusting

Audio should react to:
- cosmic mood
- karma state
- player energy
- mouse movement
- hovering nodes
- clicking/intervening
- corruption/beauty events

Examples:
- high trust/beauty: warmer intervals, soft chimes, richer drones
- high corruption/hostility: detuning, filtered noise, brittle tones, thinner sound
- low player energy: muffled/distant audio
- death state: world sound continues but feels far away
- hover over note/artifact/bio: faint overtone or directional shimmer
- cleansing corruption: risky dissonance resolving into bloom if successful

Implement tastefully. Keep default volume low.

PRODUCT SENSE AND AESTHETIC REVIEW

You must not just implement features mechanically.

After building, review the result against the intended experience:

Ask:
- Does this feel like a hidden place?
- Does it feel alive?
- Does it avoid looking like a generic particle demo?
- Is there too much text?
- Is navigation discoverable without being obvious?
- Can a curious user find something within 15–30 seconds?
- Does cooperation/defection visibly change the world?
- Does the sound deepen immersion without becoming annoying?
- Does the world change smoothly over time?
- Does death feel haunting rather than gimmicky?
- Does this feel more like art than portfolio?

If the answer to any of these is no, revise the implementation.

Prioritize:
1. atmosphere
2. interaction feel
3. visual beauty
4. discoverability
5. moral consequence
6. content pages

Do not stop at “functional.”
Make it feel good.

MINIMUM MVP REQUIREMENTS

Do not cut these:

1. Fullscreen procedural landing world.
2. Dark bioluminescent clearing visual.
3. Player represented as glowing entity.
4. Mouse movement, hover, and click interactions.
5. Hidden discovery of Notes, Artifacts, and Bio.
6. Smooth UTC-time-derived cosmic mood.
7. Persistent local karma/ecological state.
8. Cooperation/defection style consequences.
9. Beauty/corruption changes affecting visuals and navigation.
10. Player energy and death/loss-of-agency state.
11. Reflective recovery through stillness/ember.
12. Procedural audio via Web Audio API.
13. Sparse inner pages for Notes, Artifacts, Bio.
14. Very little text on the landing page.
15. No obvious nav bar.

If you must simplify, simplify implementation details, not the concept.

For example:
- use fewer entity types, but preserve moral consequence
- use 2D canvas instead of WebGL, but preserve beauty
- use simple oscillators for sound, but preserve procedural reactivity
- use local mock content, but preserve hidden discovery

Do not simplify into:
- a normal homepage
- a menu
- a portfolio template
- a static blog
- a particle background behind cards

IMPLEMENTATION DETAILS

World entities:

Use entities like:

type EntityKind =
  | "wanderer"
  | "fragile"
  | "cooperator"
  | "defector"
  | "corruptor"
  | "note"
  | "artifact"
  | "bio"

type Entity = {
  id: string
  kind: EntityKind
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  energy: number
  trust: number
  hostility: number
  volatility: number
  corruption: number
  beauty: number
  revealed: number
  alive: boolean
}

The player:

type Player = {
  x: number
  y: number
  targetX: number
  targetY: number
  energy: number
  aura: number
  alive: boolean
  stillness: number
  aggression: number
  patience: number
}

On each frame:
- update cosmic mood from UTC time
- update player position toward mouse
- compute mouse movement smoothness/aggression
- move entities with drift/wind/noise
- apply attraction/repulsion
- update grass bending
- detect proximity/hover
- reveal hidden nodes gradually
- process clicks as contextual interventions
- update karma values
- update colors/sound parameters
- draw all layers

Game-theoretic interactions:
When player or entities interact, use probabilities affected by trust/hostility/corruption.

High trust increases cooperation.
High hostility increases defection.
High corruption increases predation/deception.
High beauty increases restoration.
High navigability increases reveal radius.

Click interpretation examples:
- Clicking a fragile low-energy entity while player has energy can transfer energy to it.
- Clicking a bright healthy entity repeatedly can harvest/drain it, giving short-term energy but lowering trust/beauty.
- Clicking a corruptor can attempt cleansing, costing energy with chance of success depending on patience/beauty/trust.
- Clicking a note/artifact/bio node when revealed enters that page.
- Clicking randomly/spam-clicking increases aggression/hostility.

Hover interpretation:
- Remaining near a hidden node increases reveal.
- Remaining near fragile entities can stabilize them if player aggression is low.
- Hovering corrupted entities is risky and may drain energy slowly.
- Patient hover increases patience/trust.

Stillness:
- Track when the player/mouse is still.
- Stillness can reduce hostility slightly.
- In death state, stillness eventually reveals ember for recovery.

Persistence:
Use localStorage to store a summarized karma state:
- beauty
- trust
- hostility
- corruption
- navigability
- totalVisits
- deaths
- lastVisit

Do not permanently punish too harshly.
Let the world recover slowly over time.

TIME MOOD EXAMPLE

Implement something like:

const hours = Date.now() / 1000 / 3600

const daily = Math.sin((2 * Math.PI * hours) / 24)
const slow = Math.sin((2 * Math.PI * hours) / (24 * 5) + 1.7)
const medium = Math.sin((2 * Math.PI * hours) / 7.5 + 0.4)
const long = Math.sin((2 * Math.PI * hours) / (24 * 17) + 2.2)

Use these to generate mood fields.

The exact formula does not matter. Smoothness matters.

CONTENT

Create mock local content.

Notes:

[
  {
    title: "Density is not intimacy",
    status: "fragment",
    tags: ["cities", "weather", "systems"],
    excerpt: "Proximity can simulate knowledge without producing it.",
    body: "Placeholder rough note..."
  },
  {
    title: "Not every system wants optimization",
    status: "rough",
    tags: ["tools", "self-trust"],
    excerpt: "Some things become worse when made legible too early.",
    body: "Placeholder rough note..."
  },
  {
    title: "Trust is cheaper than verification only after memory exists",
    status: "field note",
    tags: ["games", "coordination"],
    excerpt: "A small note on repeated contact.",
    body: "Placeholder rough note..."
  },
  {
    title: "A mountain is a machine for returning scale to the body",
    status: "field note",
    tags: ["outside", "skiing"],
    excerpt: "Some terrain changes the size of your problems.",
    body: "Placeholder rough note..."
  }
]

Artifacts:

[
  {
    title: "The Clearing",
    type: "procedural field",
    status: "alive",
    description: "A small moral ecology hidden inside a personal website.",
    why: "Because some things are more honest when modeled indirectly."
  },
  {
    title: "Small Games for Coordination Failure",
    type: "simulation sketches",
    status: "unstable",
    description: "Tiny worlds about trust, incentives, collapse, and repair.",
    why: "Because incentives are easier to feel when they move."
  },
  {
    title: "Systems Tools",
    type: "interface experiments",
    status: "seed",
    description: "Interfaces for making hidden structure visible.",
    why: "Because tools should preserve the shape of thought."
  },
  {
    title: "Ski Field Log",
    type: "terrain archive",
    status: "dormant",
    description: "A personal archive of days, conditions, vertical, and weather.",
    why: "Because memory gets better when it has terrain."
  }
]

Bio:

“Rajat.
I build software and small systems.
I like tools, mountains, cities, long drives, rough notes, and conversations that become more honest than expected.”

ROUTING / PAGE ENTRY

When the player clicks a revealed destination:
- transition elegantly
- do not hard-cut if possible
- maybe fade through darkness, fog, or a bloom
- inner page appears
- provide a subtle way back to the clearing, preferably an icon/glyph, not a huge back button

Inner pages can have minimal text labels because content needs readability, but keep chrome sparse.

ACCESSIBILITY / FALLBACK

Still make it usable:
- provide reduced motion fallback if prefers-reduced-motion
- provide mute
- ensure text pages are readable
- ensure there is some way to access content if canvas fails, perhaps with hidden/simple fallback links near bottom or after a timeout
- keep contrast acceptable on inner pages

But do not let accessibility fallback become the primary visual experience.

MOBILE

Mobile can be simpler:
- touch moves/influences player
- tap acts as click
- reduce entity count
- sound still opt-in
- hidden nodes still discoverable

PERFORMANCE

Use requestAnimationFrame.
Avoid React state updates every frame for the canvas.
Keep simulation state in refs/classes.
Throttle expensive operations.
Use devicePixelRatio carefully.
Scale entity count based on screen size/performance.

FINAL DELIVERABLE

Deliver a working site with:
- full source code
- clean structure
- comments for non-obvious simulation/audio logic
- no placeholders that break the experience
- sample data for notes/artifacts
- polished visual and interaction pass

Before finalizing, run an aesthetic/product review and revise.

Again: this is more art than portfolio.

The success condition is not “the user can find the bio quickly.”
The success condition is:

A lost person at 2am lands here, moves their mouse, notices the grass bend, hears a faint tone wake up, finds a glowing thing in the dark, realizes the world is responding to the quality of their attention, and decides to stay.
```

