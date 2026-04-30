# The Clearing v2 — Design Document

## Concept

A bioluminescent ecology hidden inside a personal website. The world is a **giant tree in a void**, viewed from the side. You are a **centipede** climbing its branches. Stars burn fast overhead and rain light down onto leaves. Cooperation with other agents feeds new stars; defection corrodes them. The world's brightness and navigability is the reward — your personal site content lives on the tree as fruit/flowers that only bloom when the world thrives.

## Core Loop

```
YOU: centipede on a tree, length = reach
MOVE: mouse controls head, segments trail with spring physics
WORLD: a tree in a void, side-view, branches grow/die with nourishment

STARS burn fast (30-60s), RAIN falls to leaves below them
RAIN on leaves → leaves grow, glow, new agents can bud
NO RAIN → leaves wither, darken, fall off

APPROACH agent → thread forms automatically
HOLD to commit → thread pulses red→blue over ~2s
RELEASE at blue = cooperate, release at red = defect
BOTH sides resolve simultaneously
COOPERATE: pot splits, golden dust rises → feeds star formation
DEFECT: you steal pot, black dust rises → corrodes existing stars

WORLD KARMA (aggregate of all cooperation/defection):
- High: bigger auto-pots, brighter world, more visible content nodes
- Low: tiny pots, dark world, content hidden, leaves falling

DEATH: lose length, respawn at trunk base, karma persists
GROWTH: each cooperation adds a segment
CONTENT: fruit/flowers on branches, visible only on thriving branches
```

## Visual Design

### The Tree
- **Side-view** silhouette tree against dark void
- **Growing/dying**: branches extend/retract based on leaf nourishment
- Bioluminescent aesthetic — glowing leaves on dark branches
- Tree is **taller than viewport** — vertical scrolling, camera follows player
- **Trunk/ground** = starting area, **canopy** = where content lives, **sky above** = stars
- Branches are traversal paths; leaves are platforms/resource holders

### Leaves
- Platforms that hold rain (resources) and act as traversal nodes
- **Healthy leaves**: glow, vibrant color, easy to see, can support agents
- **Withered leaves**: dim, gray, crumbly
- **Dead leaves**: fall off the tree (branch becomes bare, gap increases)
- Leaves near content nodes glow brighter when nourished

### Stars & Rain
- Stars are born from **karmic dust** (golden particles rising from cooperation)
- Dust accretes in the sky → forms a star
- Stars burn **fast** (30-60 seconds) — Raft by Stephen Baxter reference
- While alive, stars **rain light** downward onto leaves below them
- Rain = glowing particles falling from star to leaf
- Star death: dims, final rain burst, goes dark
- **No cooperation → no new stars → no rain → world dies**

### The Player (Centipede)
- **Head** follows mouse cursor directly (snappy, no disconnect)
- **Segments** trail behind with spring/verlet physics
- Segments drape over branches/leaves naturally
- **Length = reach**: longer centipede can bridge gaps between distant leaves
- Head snaps to nearest branch surface within reach
- Bioluminescent glow, subtle pulse
- Segments added through successful cooperation

### NPC Agents (Other Centipedes)
- **Visually identical** to player at first glance
- You CANNOT reliably tell cooperator from defector by appearance
- Identity revealed through **behavioral patterns**:
  - Cooperators: steady movement, gentle approach, linger near others, golden shimmer trails
  - Defectors: erratic movement, fast approach, quick departure after interaction, subtle twitch
  - Drifters: aimless wandering, inconsistent speed
- After interacting with an agent, you develop a subtle **perceptual shimmer** — your personal read on them (not objective truth)
- Agents spawn from rain-nourished leaves (rain hits healthy leaf → chance of new agent budding)

### Dust & Particles
- **Golden dust**: rises from cooperation, drifts upward, accretes into stars
- **Black dust**: rises from defection, drifts upward, corrodes/eats existing stars
- Dust is always visible — you can see the consequences of actions across the world
- Particle trails behind centipedes (subtle, color shifts with karma)

## Interaction Design

### Movement
- Mouse cursor = centipede head position (direct, snappy)
- Segments follow with spring physics (slight delay, satisfying drag)
- Head snaps to nearest walkable surface (branch/leaf) within reach
- If no surface in reach → head stays at last valid position (can't fly)
- Longer centipede = farther reach between surfaces

### The Pot Mechanic (Cooperation/Defection)
1. **Approach**: Get near another agent → glowing thread auto-forms between you
2. **Commit**: Both sides automatically commit resources based on world karma level (higher karma = bigger auto-pot, rewarding cooperative worlds)
3. **Decide**: Thread pulses red→blue over ~2 seconds. Single timed click:
   - **Hold through blue** = cooperate
   - **Release at red** = defect
4. **Resolve**: Both sides resolve simultaneously (true prisoner's dilemma)
5. **Outcome**:
   - Both cooperate: pot is positive-sum (more than inputs), splits evenly, golden dust rises
   - One defects: defector takes whole pot, black dust rises
   - Both defect: pot is destroyed, black dust rises, both lose investment
6. **Feedback**: Immediate visual — dust particles streaming upward, thread dissolves

### Positive-Sum Dynamics
- Cooperation pot > sum of inputs (the world rewards cooperation)
- World karma level determines auto-pot size (virtuous cycle)
- Each successful cooperation adds a segment to the cooperating player
- Golden dust feeds star formation → more rain → more leaves → more agents → more cooperation opportunities

### Death & Revival
- Death = energy depletion (starvation, falling, corruption exposure)
- On death: segments scatter as particles, drift upward as tiny karmic dust (even death feeds the cycle)
- Respawn at trunk base with minimum length
- **Karma persists** across deaths and sessions (localStorage)
- Death is a setback (lose length/position) not a hard reset

## World State & Karma

### Karma Dimensions (persisted in localStorage)
- **World karma**: aggregate of all cooperation/defection history
  - Drives: auto-pot sizes, star formation rate, leaf health recovery, ambient brightness
- **Player karma**: individual cooperation/defection history
  - Drives: segment count, agent trust toward you, content node visibility
- **Corruption**: accumulated defection damage
  - Drives: star corrosion rate, leaf withering speed, world darkness

### World State Spectrum

**Thriving World (high karma):**
- Many stars burning bright, constant rain
- Lush leaves, glowing branches, easy traversal
- Agents plentiful, content nodes blooming as visible fruit/flowers
- Large auto-pots (cooperation is highly rewarding)
- Personal site content fully accessible

**Dying World (low karma):**
- Few or no stars, rain stopped
- Withered/fallen leaves, bare branches, gaps everywhere
- Few agents, content nodes invisible (closed buds)
- Tiny auto-pots (cooperation barely rewarding)
- Personal site content unreachable/invisible
- Dark, hard to see, hard to navigate

## Content Integration (Personal Site)

### Content Nodes = Fruit/Flowers on the Tree
- **Notes** = small luminous flowers on mid-canopy branches
- **Artifacts** = larger fruit on upper canopy branches
- **Bio** = a special bloom near the tree's crown
- Content nodes are **invisible buds** when nearby leaves are unnourished
- As leaves get rained on and glow, buds **bloom** proportionally
- Fully bloomed = clickable, opens the page content
- In a thriving world, content is obvious and easy to reach
- In a dying world, content is hidden and unreachable (branches too bare, gaps too wide)

### Page Transitions
- Click a bloomed content node → smooth transition to page content
- Page content overlays or replaces the canvas (existing bloom/fade system can be adapted)
- Audio muffles but doesn't stop
- Returning to the clearing preserves world state

## Audio Adaptation

The existing procedural audio system maps well:
- **Thriving**: Lydian pentatonic chimes, warm drones, frequent melodic events
- **Dying**: Locrian dissonance, sparse chimes, sub-bass rumble
- **Cooperation event**: Harmonic bloom sound, ascending tone
- **Defection event**: Dissonant stab, descending tone
- **Star birth**: Shimmering crescendo
- **Star death**: Fading tone, silence gap
- **Rain**: Gentle patter layered with existing noise system
- **Death**: Current death filter (lowpass muffling) works as-is

## Technical Architecture

### What to Keep
- App shell (App.tsx) — routing, transitions
- Audio engine (AudioEngine.ts) — adapt parameters, keep synthesis
- Persistence (persistence.ts) — adapt karma dimensions
- Build system (Vite + React + TS + Tailwind)

### What to Rebuild
- **simulation.ts** → new tree structure, centipede physics, pot mechanic, star/rain cycle
- **WorldCanvas.tsx** → new rendering: tree, centipedes, stars, rain, dust, leaves
- Entity types → replaced by behavioral AI centipedes
- Click mechanics → replaced by pot mechanic
- World topology → flat plane → branching tree

### Key Technical Decisions
- Tree is data structure: nodes (branch junctions), edges (branch segments), leaves (at tips/along edges)
- Centipede: chain of points with verlet/spring constraints along tree surfaces
- Camera: follows player head with smooth lerp, vertical bias (tree is tall)
- Stars: particle system in sky region, accretion from dust particles
- Rain: particle system falling from star positions to leaf positions below
- Performance: maintain <600 draw calls, off-screen culling, chunk the tree

## Implementation Order

1. **Tree structure + rendering** — procedural branching tree, leaves, dark background
2. **Centipede player** — snake-style movement, mouse-follows-head, segment physics, branch traversal
3. **Stars + rain cycle** — sky region, short-lived stars, rain particles to leaves
4. **NPC agents** — centipede AI, behavioral personalities (cooperator/defector/drifter)
5. **Pot mechanic** — thread formation, hold-to-commit, cooperate/defect, dust particles
6. **Karma → world state** — aggregate karma drives tree growth, leaf health, star rates, brightness
7. **Content nodes** — fruit/flowers that bloom on healthy branches, link to pages
8. **Audio adaptation** — retune existing system for new world states

## Open Questions
- Exact tree generation algorithm (L-system? recursive branching? hand-tuned?)
- How many NPC agents at once? (probably 5-15, scaling with tree size)
- Group cooperation (3+ agents forming constellations) — v2 feature?
- Mobile/touch support (hover doesn't exist on touch — need alternative interaction model)
- Should the tree have a fixed seed or be procedurally unique per visitor?
