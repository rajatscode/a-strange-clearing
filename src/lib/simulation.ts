import type { CosmicMood } from './mood'
import { getCosmicMood } from './mood'
import type { KarmaState } from './persistence'
import { loadKarma, saveKarma } from './persistence'

export type Player = {
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
  trail: Array<{ x: number; y: number; alpha: number }>
  deathTime: number
  emberX: number
  emberY: number
  emberVisible: boolean
}

export type EntityKind = 'wanderer' | 'fragile' | 'cooperator' | 'defector' | 'corruptor'

export type Entity = {
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
  corruption: number
  beauty: number
  alive: boolean
  phase: number
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  brightness: number
  hue: number
  phase: number
  layer: number
}

export type GrassBlade = {
  x: number
  y: number
  baseHeight: number
  bend: number
  lean: number
  phase: number
  luminous: boolean
  hue: number
}

export type Ripple = {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
}

export type Flash = {
  x: number
  y: number
  r: number
  g: number
  b: number
  radius: number
  maxRadius: number
  alpha: number
}

export type NavNodeKind = 'note' | 'artifact' | 'bio'

export type NavNode = {
  kind: NavNodeKind
  x: number
  y: number
  baseX: number
  baseY: number
  revealed: number
  phase: number
  route: string
}

export type Camera = {
  x: number
  y: number
}

export type Chunk = {
  key: string
  cx: number
  cy: number
  grass: GrassBlade[]
  particles: Particle[]
}

export type WorldState = {
  player: Player
  camera: Camera
  chunks: Map<string, Chunk>
  entities: Entity[]
  ripples: Ripple[]
  flashes: Flash[]
  navNodes: NavNode[]
  mood: CosmicMood
  karma: KarmaState
  mouseSpeed: number
  mouseSmoothed: number
  time: number
  scale: number
  viewWidth: number
  viewHeight: number
  lastClickTime: number
  clickCooldown: number
}

export const CHUNK_SIZE = 800

// Pre-computed colors per entity kind
export const ENTITY_COLORS: Record<EntityKind, { r: number; g: number; b: number; hue: number }> = {
  wanderer:   { r: 100, g: 200, b: 220, hue: 190 },
  fragile:    { r: 220, g: 180, b: 120, hue: 35 },
  cooperator: { r: 80,  g: 220, b: 180, hue: 160 },
  defector:   { r: 220, g: 150, b: 80,  hue: 30 },
  corruptor:  { r: 130, g: 150, b: 110, hue: 90 },
}

// ---- Seeded PRNG (mulberry32) ----

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chunkSeed(cx: number, cy: number): number {
  let h = (cx * 73856093) ^ (cy * 19349663)
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0
  h = (h >> 16) ^ h
  return h >>> 0
}

// ---- Chunk Generation ----

function generateChunk(cx: number, cy: number, scale: number): Chunk {
  const key = `${cx},${cy}`
  const rng = mulberry32(chunkSeed(cx, cy))
  const worldX = cx * CHUNK_SIZE
  const worldY = cy * CHUNK_SIZE

  // Grass: 60-80 blades per chunk
  const grassCount = 60 + Math.floor(rng() * 20)
  const grass: GrassBlade[] = []
  for (let i = 0; i < grassCount; i++) {
    const heightRand = rng()
    const baseHeight = (40 + heightRand * 120 + heightRand * heightRand * 160) * scale
    grass.push({
      x: worldX + rng() * CHUNK_SIZE,
      y: worldY + rng() * CHUNK_SIZE,
      baseHeight,
      bend: 0,
      lean: (rng() - 0.5) * 0.3,
      phase: rng() * Math.PI * 2,
      luminous: rng() < 0.15,
      hue: rng() < 0.4 ? 165 + rng() * 35 : 95 + rng() * 35,
    })
  }
  grass.sort((a, b) => a.baseHeight - b.baseHeight)

  // Particles: 10-15 per chunk
  const particleCount = 10 + Math.floor(rng() * 5)
  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: worldX + rng() * CHUNK_SIZE,
      y: worldY + rng() * CHUNK_SIZE,
      vx: (rng() - 0.5) * 0.4,
      vy: (rng() - 0.5) * 0.25 - 0.15,
      radius: (1.5 + rng() * 3.5) * scale,
      brightness: 0.3 + rng() * 0.5,
      hue: rng() < 0.5 ? 170 + rng() * 30 : 100 + rng() * 30,
      phase: rng() * Math.PI * 2,
      layer: Math.floor(rng() * 3),
    })
  }

  return { key, cx, cy, grass, particles }
}

// Returns chunks overlapping the viewport + margin
export function getVisibleChunks(state: WorldState): Chunk[] {
  const { camera, viewWidth, viewHeight, chunks } = state
  const margin = CHUNK_SIZE * 0.5
  const minCX = Math.floor((camera.x - viewWidth / 2 - margin) / CHUNK_SIZE)
  const maxCX = Math.floor((camera.x + viewWidth / 2 + margin) / CHUNK_SIZE)
  const minCY = Math.floor((camera.y - viewHeight / 2 - margin) / CHUNK_SIZE)
  const maxCY = Math.floor((camera.y + viewHeight / 2 + margin) / CHUNK_SIZE)

  const visible: Chunk[] = []
  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cy = minCY; cy <= maxCY; cy++) {
      const chunk = chunks.get(`${cx},${cy}`)
      if (chunk) visible.push(chunk)
    }
  }
  return visible
}

// Load chunks near camera, unload distant ones
function manageChunks(state: WorldState): void {
  const { camera, viewWidth, viewHeight, chunks, scale } = state

  // Load: 2 chunks beyond viewport
  const loadMargin = CHUNK_SIZE * 2
  const minCX = Math.floor((camera.x - viewWidth / 2 - loadMargin) / CHUNK_SIZE)
  const maxCX = Math.floor((camera.x + viewWidth / 2 + loadMargin) / CHUNK_SIZE)
  const minCY = Math.floor((camera.y - viewHeight / 2 - loadMargin) / CHUNK_SIZE)
  const maxCY = Math.floor((camera.y + viewHeight / 2 + loadMargin) / CHUNK_SIZE)

  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cy = minCY; cy <= maxCY; cy++) {
      const key = `${cx},${cy}`
      if (!chunks.has(key)) {
        chunks.set(key, generateChunk(cx, cy, scale))
      }
    }
  }

  // Unload: 4 chunks beyond viewport
  const unloadDist = CHUNK_SIZE * 4
  const halfW = viewWidth / 2
  const halfH = viewHeight / 2
  for (const [key, chunk] of chunks) {
    const chunkCenterX = (chunk.cx + 0.5) * CHUNK_SIZE
    const chunkCenterY = (chunk.cy + 0.5) * CHUNK_SIZE
    if (
      Math.abs(chunkCenterX - camera.x) > halfW + unloadDist ||
      Math.abs(chunkCenterY - camera.y) > halfH + unloadDist
    ) {
      chunks.delete(key)
    }
  }
}

// ---- Entity Spawning ----

function spawnEntities(scale: number): Entity[] {
  const spawnRange = CHUNK_SIZE * 1.5
  const total = 20

  const kinds: EntityKind[] = []
  const dist = [
    { kind: 'wanderer' as EntityKind, pct: 0.25 },
    { kind: 'fragile' as EntityKind, pct: 0.20 },
    { kind: 'cooperator' as EntityKind, pct: 0.25 },
    { kind: 'defector' as EntityKind, pct: 0.15 },
    { kind: 'corruptor' as EntityKind, pct: 0.15 },
  ]
  for (const d of dist) {
    const count = Math.max(1, Math.round(total * d.pct))
    for (let i = 0; i < count; i++) kinds.push(d.kind)
  }

  const entities: Entity[] = []
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]
    const radiusBase = kind === 'fragile' ? 4 : kind === 'cooperator' ? 8 : kind === 'corruptor' ? 9 : kind === 'defector' ? 7 : 6
    entities.push({
      id: `${kind}-${i}`,
      kind,
      x: (Math.random() - 0.5) * spawnRange * 2,
      y: (Math.random() - 0.5) * spawnRange * 2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.3,
      radius: radiusBase * scale,
      energy: kind === 'fragile' ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4,
      trust: kind === 'cooperator' ? 0.7 : kind === 'defector' ? 0.1 : 0.4,
      hostility: kind === 'defector' ? 0.6 : kind === 'corruptor' ? 0.8 : 0.1,
      corruption: kind === 'corruptor' ? 0.7 + Math.random() * 0.3 : 0,
      beauty: kind === 'cooperator' ? 0.6 : kind === 'fragile' ? 0.3 : 0.1,
      alive: true,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return entities
}

function createNavNodes(karma: KarmaState): NavNode[] {
  const firstVisit = karma.totalVisits <= 1
  const range = CHUNK_SIZE * 0.8

  // First visit: place nodes VERY close to origin (player start) so they're easy to find
  const noteX = firstVisit
    ? -120 + Math.random() * 60
    : (Math.random() - 0.5) * range * 2
  const noteY = firstVisit
    ? -80 + Math.random() * 60
    : (Math.random() - 0.5) * range * 2

  const artX = firstVisit
    ? 100 + Math.random() * 60
    : (Math.random() - 0.5) * range * 2
  const artY = firstVisit
    ? -50 + Math.random() * 60
    : (Math.random() - 0.5) * range * 2

  const bioX = 20 + Math.random() * 80
  const bioY = 60 + Math.random() * 80

  return [
    { kind: 'note', x: noteX, y: noteY, baseX: noteX, baseY: noteY, revealed: firstVisit ? 0.4 : 0, phase: Math.random() * Math.PI * 2, route: '#/notes' },
    { kind: 'artifact', x: artX, y: artY, baseX: artX, baseY: artY, revealed: firstVisit ? 0.35 : 0, phase: Math.random() * Math.PI * 2, route: '#/artifacts' },
    { kind: 'bio', x: bioX, y: bioY, baseX: bioX, baseY: bioY, revealed: firstVisit ? 0.2 : 0, phase: Math.random() * Math.PI * 2, route: '#/bio' },
  ]
}

export function createWorld(viewWidth: number, viewHeight: number): WorldState {
  const karma = loadKarma()
  const mood = getCosmicMood()
  const scale = viewHeight / 800

  const entities = spawnEntities(scale)
  const navNodes = createNavNodes(karma)

  const state: WorldState = {
    player: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      energy: karma.playerEnergy,
      aura: 30 * scale,
      alive: karma.playerEnergy > 0,
      stillness: 0,
      aggression: 0,
      patience: karma.patience,
      trail: [],
      deathTime: 0,
      emberX: 0,
      emberY: 0,
      emberVisible: false,
    },
    camera: { x: 0, y: 0 },
    chunks: new Map(),
    entities,
    ripples: [],
    flashes: [],
    navNodes,
    mood,
    karma,
    mouseSpeed: 0,
    mouseSmoothed: 0,
    time: 0,
    scale,
    viewWidth,
    viewHeight,
    lastClickTime: 0,
    clickCooldown: 0.3,
  }

  // Generate initial chunks around origin
  manageChunks(state)

  return state
}

// Find entity near a point (world coordinates)
export function findEntityAt(state: WorldState, x: number, y: number): number {
  const hitRadius = 30 * state.scale
  let closest = -1
  let closestDist = hitRadius
  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive) continue
    const dx = e.x - x
    const dy = e.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < closestDist) {
      closestDist = dist
      closest = i
    }
  }
  return closest
}

export type ClickResult = {
  type: 'none' | 'fragile_nourish' | 'cooperator_exchange' | 'defector_risk' | 'corruptor_cleanse_success' | 'corruptor_cleanse_fail' | 'ember_revive' | 'ripple'
  entityIndex?: number
}

export function handleWorldClick(state: WorldState, x: number, y: number): ClickResult {
  const { player, karma } = state
  const now = state.time

  if (now - state.lastClickTime < state.clickCooldown) {
    player.aggression = Math.min(1, player.aggression + 0.05)
    karma.hostility = Math.min(1, karma.hostility + 0.01)
    return { type: 'none' }
  }
  state.lastClickTime = now

  // Death state — check for ember click
  if (!player.alive && player.emberVisible) {
    const edx = x - player.emberX
    const edy = y - player.emberY
    if (Math.sqrt(edx * edx + edy * edy) < 40 * state.scale) {
      player.alive = true
      player.energy = 0.3
      player.deathTime = 0
      player.emberVisible = false
      karma.corruption = Math.min(1, karma.corruption + 0.05)
      return { type: 'ember_revive' }
    }
    return { type: 'none' }
  }

  if (!player.alive) return { type: 'none' }

  const idx = findEntityAt(state, x, y)
  if (idx >= 0) {
    const e = state.entities[idx]

    if (e.kind === 'fragile' && player.energy > 0.1) {
      const transfer = Math.min(0.15, player.energy - 0.05)
      player.energy -= transfer
      e.energy = Math.min(1, e.energy + transfer * 1.5)
      e.trust = Math.min(1, e.trust + 0.1)
      karma.beauty = Math.min(1, karma.beauty + 0.02)
      karma.generosity = Math.min(1, karma.generosity + 0.03)
      karma.trust = Math.min(1, karma.trust + 0.01)
      return { type: 'fragile_nourish', entityIndex: idx }
    }

    if (e.kind === 'cooperator') {
      player.energy = Math.min(1, player.energy + 0.05)
      e.energy = Math.min(1, e.energy + 0.03)
      e.trust = Math.min(1, e.trust + 0.05)
      e.beauty = Math.min(1, e.beauty + 0.03)
      karma.beauty = Math.min(1, karma.beauty + 0.015)
      karma.trust = Math.min(1, karma.trust + 0.01)
      return { type: 'cooperator_exchange', entityIndex: idx }
    }

    if (e.kind === 'defector') {
      const drain = 0.08 + Math.random() * 0.07
      player.energy = Math.max(0, player.energy - drain)
      e.hostility = Math.min(1, e.hostility + 0.1)
      karma.hostility = Math.min(1, karma.hostility + 0.02)
      karma.extraction = Math.min(1, karma.extraction + 0.02)
      return { type: 'defector_risk', entityIndex: idx }
    }

    if (e.kind === 'corruptor') {
      const cost = 0.15
      if (player.energy < cost) return { type: 'none' }
      player.energy -= cost
      const successChance = 0.3 + player.patience * 0.3 + karma.beauty * 0.2 + karma.trust * 0.2
      if (Math.random() < successChance) {
        e.corruption = Math.max(0, e.corruption - 0.4)
        e.hostility = Math.max(0, e.hostility - 0.3)
        karma.beauty = Math.min(1, karma.beauty + 0.04)
        karma.corruption = Math.max(0, karma.corruption - 0.03)
        karma.trust = Math.min(1, karma.trust + 0.02)
        if (e.corruption < 0.2) {
          e.kind = 'fragile'
          e.energy = 0.3
          e.hostility = 0
          e.beauty = 0.2
        }
        return { type: 'corruptor_cleanse_success', entityIndex: idx }
      } else {
        player.energy = Math.max(0, player.energy - 0.1)
        karma.corruption = Math.min(1, karma.corruption + 0.03)
        e.hostility = Math.min(1, e.hostility + 0.15)
        return { type: 'corruptor_cleanse_fail', entityIndex: idx }
      }
    }

    if (e.kind === 'wanderer') {
      e.trust = Math.min(1, e.trust + 0.03)
      karma.trust = Math.min(1, karma.trust + 0.005)
      return { type: 'cooperator_exchange', entityIndex: idx }
    }
  }

  return { type: 'ripple' }
}

export function updateWorld(state: WorldState, dt: number, width: number, height: number): void {
  state.time += dt
  state.viewWidth = width
  state.viewHeight = height
  const { player, karma } = state

  // Update mood every ~2 seconds
  if (Math.floor(state.time * 0.5) !== Math.floor((state.time - dt) * 0.5)) {
    Object.assign(state.mood, getCosmicMood())
  }

  // --- Player death state ---
  if (!player.alive) {
    player.stillness = Math.min(1, player.stillness + dt * 0.2)

    if (player.deathTime === 0) player.deathTime = state.time
    const timeDead = state.time - player.deathTime
    if (timeDead > 5 && player.stillness > 0.5 && !player.emberVisible) {
      player.emberX = player.x + (Math.random() - 0.5) * 60 * state.scale
      player.emberY = player.y + (Math.random() - 0.5) * 60 * state.scale
      player.emberVisible = true
    }

    updateEntities(state, dt)
    updateGrass(state, dt)
    updateParticles(state, dt)
    updateRipples(state, dt)
    updateFlashes(state, dt)
    manageChunks(state)
    periodicSave(state, dt)
    return
  }

  // Player follows mouse target (world-space) with lerp
  const lerpFactor = 0.12
  player.x += (player.targetX - player.x) * lerpFactor
  player.y += (player.targetY - player.y) * lerpFactor

  // Camera smoothly follows player
  const cameraLerp = 0.06
  state.camera.x += (player.x - state.camera.x) * cameraLerp
  state.camera.y += (player.y - state.camera.y) * cameraLerp

  // Pulsing aura
  const s = state.scale
  player.aura = (25 + Math.sin(state.time * 2) * 8 + player.energy * 15) * s

  // Mouse speed smoothing
  state.mouseSmoothed += (state.mouseSpeed - state.mouseSmoothed) * 0.05

  // Classify behavior
  if (state.mouseSmoothed < 1) {
    player.stillness = Math.min(1, player.stillness + dt * 0.15)
    player.aggression = Math.max(0, player.aggression - dt * 0.1)
    player.patience = Math.min(1, player.patience + dt * 0.02)
  } else if (state.mouseSmoothed > 8) {
    player.stillness = Math.max(0, player.stillness - dt * 0.3)
    player.aggression = Math.min(1, player.aggression + dt * 0.2)
    player.patience = Math.max(0, player.patience - dt * 0.05)
  } else {
    player.stillness = Math.max(0, player.stillness - dt * 0.05)
    player.aggression = Math.max(0, player.aggression - dt * 0.05)
  }

  // Karma from behavior
  karma.beauty += (player.patience - 0.5) * dt * 0.005
  karma.trust += (player.stillness - player.aggression) * dt * 0.003
  karma.hostility += (player.aggression - 0.3) * dt * 0.004
  karma.navigability = Math.max(0, Math.min(1,
    karma.beauty * 0.3 + karma.trust * 0.3 - karma.hostility * 0.2 - karma.corruption * 0.2 + 0.3
  ))

  karma.beauty = Math.max(0, Math.min(1, karma.beauty))
  karma.trust = Math.max(0, Math.min(1, karma.trust))
  karma.hostility = Math.max(0, Math.min(1, karma.hostility))
  karma.navigability = Math.max(0, Math.min(1, karma.navigability))
  karma.corruption = Math.max(0, Math.min(1, karma.corruption))
  karma.patience = player.patience

  karma.hostility = Math.max(0, karma.hostility - dt * 0.001 * player.patience)

  // Energy regen from stillness
  if (player.stillness > 0.6) {
    player.energy = Math.min(1, player.energy + dt * 0.003)
  }

  // Check player death
  if (player.energy <= 0) {
    player.alive = false
    player.energy = 0
    player.deathTime = state.time
    player.emberVisible = false
    karma.deaths++
  }

  // Trail
  if (player.trail.length < 12) {
    player.trail.unshift({ x: player.x, y: player.y, alpha: 0.6 })
  } else {
    const last = player.trail.pop()!
    last.x = player.x
    last.y = player.y
    last.alpha = 0.6
    player.trail.unshift(last)
  }
  for (let i = 1; i < player.trail.length; i++) {
    player.trail[i].alpha *= 0.92
  }

  updateNavNodes(state, dt)
  updateEntityHoverInteractions(state, dt)
  updateEntities(state, dt)
  updateGrass(state, dt)
  updateParticles(state, dt)
  updateRipples(state, dt)
  updateFlashes(state, dt)
  manageChunks(state)
  periodicSave(state, dt)
}

function updateNavNodes(state: WorldState, dt: number): void {
  const { player, karma } = state
  const s = state.scale
  const revealRadius = (80 + karma.navigability * 40) * s
  const hintRadius = 200 * s

  for (let i = 0; i < state.navNodes.length; i++) {
    const node = state.navNodes[i]

    if (node.kind === 'note') {
      node.x = node.baseX + Math.sin(state.time * 0.15 + node.phase) * 30 * s
      node.y = node.baseY + Math.cos(state.time * 0.12 + node.phase * 1.4) * 20 * s
    } else if (node.kind === 'artifact') {
      node.x = node.baseX + Math.sin(state.time * 0.06 + node.phase) * 8 * s
      node.y = node.baseY + Math.cos(state.time * 0.05 + node.phase) * 5 * s
    }

    const dx = node.x - player.x
    const dy = node.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < revealRadius && player.aggression < 0.5) {
      const proximity = 1 - dist / revealRadius
      const revealRate = (0.25 + player.patience * 0.3 + player.stillness * 0.25) * proximity
      node.revealed = Math.min(1, node.revealed + dt * revealRate)
    } else if (dist < hintRadius) {
      node.revealed = Math.max(0, node.revealed - dt * 0.03)
    } else {
      node.revealed = Math.max(0, node.revealed - dt * 0.08)
    }
  }
}

export function findNavNodeAt(state: WorldState, x: number, y: number): NavNode | null {
  const hitRadius = 35 * state.scale
  for (let i = 0; i < state.navNodes.length; i++) {
    const node = state.navNodes[i]
    if (node.revealed < 0.95) continue
    const dx = node.x - x
    const dy = node.y - y
    if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return node
  }
  return null
}

function updateEntityHoverInteractions(state: WorldState, dt: number): void {
  const { player, karma } = state
  const hoverRadius = 80 * state.scale

  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive) continue

    const dx = e.x - player.x
    const dy = e.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > hoverRadius) continue

    const proximity = 1 - dist / hoverRadius

    if (e.kind === 'fragile' && player.aggression < 0.3) {
      e.energy = Math.min(1, e.energy + dt * 0.02 * proximity * player.stillness)
      e.trust = Math.min(1, e.trust + dt * 0.01 * proximity)
    }

    if (e.kind === 'corruptor') {
      player.energy = Math.max(0, player.energy - dt * 0.015 * proximity * e.corruption)
      karma.corruption = Math.min(1, karma.corruption + dt * 0.002 * proximity)
    }

    if (player.stillness > 0.4) {
      e.trust = Math.min(1, e.trust + dt * 0.005 * proximity * player.stillness)
      karma.trust = Math.min(1, karma.trust + dt * 0.001 * proximity)
    }
  }
}

function updateEntities(state: WorldState, dt: number): void {
  const { player, mood, karma } = state
  const s = state.scale
  const time = state.time
  const homeRange = CHUNK_SIZE * 3

  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive) continue

    const noiseX = Math.sin(time * 0.5 + e.phase) * 0.3 + Math.sin(time * 0.2 + e.phase * 2.1) * 0.15
    const noiseY = Math.cos(time * 0.4 + e.phase * 1.3) * 0.2 + Math.cos(time * 0.15 + e.phase * 0.7) * 0.1
    const windEffect = mood.windStrength * 0.3

    let seekX = 0, seekY = 0

    if (player.alive) {
      const dx = player.x - e.x
      const dy = player.y - e.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const nx = dist > 0 ? dx / dist : 0
      const ny = dist > 0 ? dy / dist : 0

      if (e.kind === 'wanderer') {
        if (dist < 200 * s && e.trust > 0.5) {
          seekX += nx * 0.1 * e.trust
          seekY += ny * 0.1 * e.trust
        }
      } else if (e.kind === 'fragile') {
        if (player.aggression > 0.4 && dist < 180 * s) {
          seekX -= nx * 0.4
          seekY -= ny * 0.4
        } else if (player.stillness > 0.5 && dist < 150 * s) {
          seekX += nx * 0.08
          seekY += ny * 0.08
        }
      } else if (e.kind === 'cooperator') {
        if (dist < 250 * s) {
          const attraction = 0.15 + karma.trust * 0.15
          seekX += nx * attraction
          seekY += ny * attraction
        }
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind !== 'cooperator') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < 150 * s && odist > 20 * s) {
            seekX += (odx / odist) * 0.05
            seekY += (ody / odist) * 0.05
          }
        }
      } else if (e.kind === 'defector') {
        if (dist < 200 * s) {
          seekX -= nx * 0.25
          seekY -= ny * 0.25
        }
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind !== 'fragile') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < 180 * s && odist > 15 * s) {
            seekX += (odx / odist) * 0.12
            seekY += (ody / odist) * 0.12
          }
          if (odist < 25 * s) {
            other.energy = Math.max(0, other.energy - dt * 0.08)
            e.energy = Math.min(1, e.energy + dt * 0.04)
            karma.hostility = Math.min(1, karma.hostility + dt * 0.002)
          }
        }
      } else if (e.kind === 'corruptor') {
        seekX += Math.sin(time * 0.15 + e.phase) * 0.1
        seekY += Math.cos(time * 0.12 + e.phase * 1.5) * 0.08
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind === 'corruptor') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < 100 * s) {
            other.corruption = Math.min(1, other.corruption + dt * 0.01 * e.corruption)
            other.beauty = Math.max(0, other.beauty - dt * 0.005)
          }
        }
      }
    }

    // Loose home range pull — prevent infinite drift
    const distFromHome = Math.sqrt(e.x * e.x + e.y * e.y)
    if (distFromHome > homeRange) {
      const pullStrength = (distFromHome - homeRange) * 0.0001
      seekX -= (e.x / distFromHome) * pullStrength
      seekY -= (e.y / distFromHome) * pullStrength
    }

    const speed = e.kind === 'corruptor' ? 0.3 : e.kind === 'fragile' ? 0.4 : 0.6
    e.vx += (noiseX + seekX + windEffect) * dt * 2
    e.vy += (noiseY + seekY) * dt * 2

    e.vx *= 0.95
    e.vy *= 0.95

    const vel = Math.sqrt(e.vx * e.vx + e.vy * e.vy)
    if (vel > speed * s) {
      e.vx = (e.vx / vel) * speed * s
      e.vy = (e.vy / vel) * speed * s
    }

    e.x += e.vx
    e.y += e.vy

    if (e.kind === 'fragile') {
      e.energy = Math.max(0, e.energy - dt * 0.003)
      if (e.energy <= 0) e.alive = false
    }
  }
}

function updateGrass(state: WorldState, _dt: number): void {
  const { player, mood } = state
  const s = state.scale
  const windTime = state.time * (0.6 + mood.windStrength * 1.0)

  const visibleChunks = getVisibleChunks(state)
  for (let c = 0; c < visibleChunks.length; c++) {
    const chunk = visibleChunks[c]
    for (let i = 0; i < chunk.grass.length; i++) {
      const blade = chunk.grass[i]
      const wind1 = Math.sin(windTime + blade.phase) * (0.2 + mood.windStrength * 0.15)
      const wind2 = Math.sin(windTime * 0.7 + blade.phase * 1.3 + 1.2) * 0.08
      const wind3 = Math.sin(windTime * 0.3 + blade.x * 0.003) * 0.06
      const wind = wind1 + wind2 + wind3

      const dx = blade.x - player.x
      const dy = (blade.y - blade.baseHeight * 0.5) - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const bendRadius = 150 * s

      let playerBend = 0
      if (dist < bendRadius) {
        const force = (1 - dist / bendRadius) * 0.7
        playerBend = (dx > 0 ? 1 : -1) * force
      }

      const targetBend = wind + playerBend + blade.lean
      blade.bend += (targetBend - blade.bend) * 0.12
    }
  }
}

function updateParticles(state: WorldState, _dt: number): void {
  const { player, mood } = state
  const s = state.scale

  const visibleChunks = getVisibleChunks(state)
  for (let c = 0; c < visibleChunks.length; c++) {
    const chunk = visibleChunks[c]
    const chunkMinX = chunk.cx * CHUNK_SIZE
    const chunkMinY = chunk.cy * CHUNK_SIZE

    for (let i = 0; i < chunk.particles.length; i++) {
      const p = chunk.particles[i]
      p.x += (p.vx + Math.sin(state.time * 0.3 + p.phase) * 0.2 * mood.driftSpeed) * s
      p.y += (p.vy + Math.cos(state.time * 0.2 + p.phase * 1.3) * 0.15 * mood.driftSpeed) * s

      const pdx = p.x - player.x
      const pdy = p.y - player.y
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
      const pushRadius = 100 * s
      if (pdist < pushRadius && pdist > 0) {
        const push = (1 - pdist / pushRadius) * 0.3 * s
        p.x += (pdx / pdist) * push
        p.y += (pdy / pdist) * push
      }

      p.brightness = 0.2 + Math.sin(state.time + p.phase) * 0.15 + 0.15

      // Wrap within chunk bounds
      if (p.x < chunkMinX) p.x += CHUNK_SIZE
      if (p.x >= chunkMinX + CHUNK_SIZE) p.x -= CHUNK_SIZE
      if (p.y < chunkMinY) p.y += CHUNK_SIZE
      if (p.y >= chunkMinY + CHUNK_SIZE) p.y -= CHUNK_SIZE
    }
  }
}

function updateRipples(state: WorldState, dt: number): void {
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const r = state.ripples[i]
    r.radius += dt * 120 * state.scale
    r.alpha *= 0.97
    if (r.alpha < 0.01 || r.radius > r.maxRadius) {
      state.ripples.splice(i, 1)
    }
  }
}

function updateFlashes(state: WorldState, _dt: number): void {
  for (let i = state.flashes.length - 1; i >= 0; i--) {
    const f = state.flashes[i]
    f.radius += (f.maxRadius - f.radius) * 0.15
    f.alpha *= 0.88
    if (f.alpha < 0.02) {
      state.flashes.splice(i, 1)
    }
  }
}

function periodicSave(state: WorldState, dt: number): void {
  if (Math.floor(state.time / 5) !== Math.floor((state.time - dt) / 5)) {
    state.karma.playerEnergy = state.player.energy
    saveKarma(state.karma)
  }
}

export function addRipple(state: WorldState, x: number, y: number): void {
  state.ripples.push({
    x,
    y,
    radius: 5 * state.scale,
    maxRadius: (150 + state.karma.beauty * 100) * state.scale,
    alpha: 0.5 + state.karma.beauty * 0.3,
  })
}

export function addFlash(state: WorldState, x: number, y: number, r: number, g: number, b: number, size?: number): void {
  const s = state.scale
  state.flashes.push({
    x,
    y,
    r,
    g,
    b,
    radius: 5 * s,
    maxRadius: (size ?? 60) * s,
    alpha: 0.8,
  })
}
