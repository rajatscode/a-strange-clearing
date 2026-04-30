# The Clearing

A bioluminescent ecology hidden inside a personal website — an interactive canvas world with emergent entity behavior and karma-driven atmosphere.

## Stack

Vite + React + TypeScript + Tailwind CSS + Canvas 2D + Web Audio API

## Commands

- `npm install && npm run dev` — start dev server
- `npm run build` — production build

## Key Files

- `src/lib/simulation.ts` — world state, entity AI, karma, nav node reveal logic
- `src/components/WorldCanvas.tsx` — canvas rendering, draw functions, input handling
- `src/components/AudioEngine.ts` — Web Audio drones, chimes, karma-reactive sound
- `src/App.tsx` — hash routing, page transitions (bloom/fade queue system)
- `src/lib/persistence.ts` — localStorage karma save/load with error handling
- `src/data/notes.ts` — notes content
- `src/data/artifacts.ts` — artifacts content

## Architecture

- Simulation state lives in a `useRef` (not React state) — mutated directly each frame
- `requestAnimationFrame` render loop drives both simulation updates and canvas drawing
- Karma persisted in localStorage (`clearing-karma`), recovered on reload
- Cosmic mood derived from UTC time (`getCosmicMood()`) — affects hues and drift
- World is 5x viewport wide, 3x tall with chunk-based procedural generation
- Camera follows player with smooth lerp; off-screen culling via `onScreen()` helper
- Nav nodes reveal progressively when player is nearby, patient, and non-aggressive

## Performance Constraints

- No `createRadialGradient` in hot path (only 2 fog patches use it)
- ~376 draw calls per visible frame — stay under 600
- All drawable elements must use `onScreen()` culling
- No `Math.random()` in draw path — use deterministic sin/cos with seeds
- Entity/grass/particle counts scale with world area but are capped
