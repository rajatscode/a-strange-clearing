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
  deathTime: number // time when player died (0 = alive)
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
  phase: number // for animation
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

export type WorldState = {
  player: Player
  entities: Entity[]
  particles: Particle[]
  grass: GrassBlade[]
  ripples: Ripple[]
  navNodes: NavNode[]
  mood: CosmicMood
  karma: KarmaState
  mouseSpeed: number
  mouseSmoothed: number
  time: number
  scale: number
  lastClickTime: number
  clickCooldown: number
}

// Pre-computed colors per entity kind (avoid per-frame string alloc)
export const ENTITY_COLORS: Record<EntityKind, { r: number; g: number; b: number; hue: number }> = {
  wanderer:   { r: 100, g: 200, b: 220, hue: 190 },
  fragile:    { r: 220, g: 180, b: 120, hue: 35 },
  cooperator: { r: 80,  g: 220, b: 180, hue: 160 },
  defector:   { r: 220, g: 150, b: 80,  hue: 30 },
  corruptor:  { r: 130, g: 150, b: 110, hue: 90 },
}

function spawnEntities(width: number, height: number, scale: number): Entity[] {
  const area = width * height
  const baseCount = 20
  const countScale = Math.max(0.5, Math.min(1.5, area / (1920 * 1080 * 4)))
  const total = Math.floor(baseCount * countScale)

  // Distribution: ~25% wanderer, ~20% fragile, ~25% cooperator, ~15% defector, ~15% corruptor
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
      x: Math.random() * width * 0.8 + width * 0.1,
      y: Math.random() * height * 0.6 + height * 0.2,
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

function createNavNodes(width: number, height: number, karma: KarmaState): NavNode[] {
  const firstVisit = karma.totalVisits <= 1
  const margin = 0.15

  // Note node — drifting, ephemeral
  const noteX = firstVisit
    ? width * (0.3 + Math.random() * 0.1)
    : width * (margin + Math.random() * (1 - margin * 2))
  const noteY = firstVisit
    ? height * (0.35 + Math.random() * 0.1)
    : height * (0.2 + Math.random() * 0.4)

  // Artifact node — more stable, geometric
  const artX = firstVisit
    ? width * (0.65 + Math.random() * 0.1)
    : width * (margin + Math.random() * (1 - margin * 2))
  const artY = firstVisit
    ? height * (0.4 + Math.random() * 0.1)
    : height * (0.2 + Math.random() * 0.4)

  // Bio node — center-ish, singular
  const bioX = width * (0.45 + Math.random() * 0.1)
  const bioY = height * (0.45 + Math.random() * 0.1)

  return [
    { kind: 'note', x: noteX, y: noteY, baseX: noteX, baseY: noteY, revealed: firstVisit ? 0.15 : 0, phase: Math.random() * Math.PI * 2, route: '#/notes' },
    { kind: 'artifact', x: artX, y: artY, baseX: artX, baseY: artY, revealed: firstVisit ? 0.1 : 0, phase: Math.random() * Math.PI * 2, route: '#/artifacts' },
    { kind: 'bio', x: bioX, y: bioY, baseX: bioX, baseY: bioY, revealed: 0, phase: Math.random() * Math.PI * 2, route: '#/bio' },
  ]
}

export function createWorld(width: number, height: number): WorldState {
  const karma = loadKarma()
  const mood = getCosmicMood()
  const scale = height / 800

  const area = width * height
  const densityScale = Math.min(1, area / (1920 * 1080 * 4))
  const grassCount = Math.floor((180 + mood.grassDensity * 70) * densityScale)
  const particleCount = Math.floor((35 + mood.driftSpeed * 15) * densityScale)

  const grass: GrassBlade[] = []
  for (let i = 0; i < grassCount; i++) {
    const x = (i / grassCount) * width + (Math.random() - 0.5) * (width / grassCount) * 1.5
    const heightRand = Math.random()
    const baseHeight = (40 + heightRand * 120 + heightRand * heightRand * 160) * scale
    grass.push({
      x,
      baseHeight,
      bend: 0,
      lean: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      luminous: Math.random() < 0.15,
      hue: Math.random() < 0.4 ? 165 + Math.random() * 35 : 95 + Math.random() * 35,
    })
  }
  grass.sort((a, b) => a.baseHeight - b.baseHeight)

  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    const yBias = Math.random() < 0.3 ? height * 0.6 + Math.random() * height * 0.4 : Math.random() * height
    particles.push({
      x: Math.random() * width,
      y: yBias,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.25 - 0.15,
      radius: (1.5 + Math.random() * 3.5) * scale,
      brightness: 0.3 + Math.random() * 0.5,
      hue: Math.random() < 0.5 ? 170 + Math.random() * 30 : 100 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      layer: Math.floor(Math.random() * 3),
    })
  }

  const entities = spawnEntities(width, height, scale)
  const navNodes = createNavNodes(width, height, karma)

  return {
    player: {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
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
    entities,
    particles,
    grass,
    ripples: [],
    navNodes,
    mood,
    karma,
    mouseSpeed: 0,
    mouseSmoothed: 0,
    time: 0,
    scale,
    lastClickTime: 0,
    clickCooldown: 0.3,
  }
}

// Find entity near a point, returns index or -1
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

  // Click cooldown — discourage spam
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
      // Partial karma scar persists
      karma.corruption = Math.min(1, karma.corruption + 0.05)
      return { type: 'ember_revive' }
    }
    return { type: 'none' }
  }

  // Dead players can't interact
  if (!player.alive) return { type: 'none' }

  // Find entity under click
  const idx = findEntityAt(state, x, y)
  if (idx >= 0) {
    const e = state.entities[idx]

    if (e.kind === 'fragile' && player.energy > 0.1) {
      // Nourish fragile entity
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
      // Mutual exchange
      player.energy = Math.min(1, player.energy + 0.05)
      e.energy = Math.min(1, e.energy + 0.03)
      e.trust = Math.min(1, e.trust + 0.05)
      e.beauty = Math.min(1, e.beauty + 0.03)
      karma.beauty = Math.min(1, karma.beauty + 0.015)
      karma.trust = Math.min(1, karma.trust + 0.01)
      return { type: 'cooperator_exchange', entityIndex: idx }
    }

    if (e.kind === 'defector') {
      // Risky — may drain player
      const drain = 0.08 + Math.random() * 0.07
      player.energy = Math.max(0, player.energy - drain)
      e.hostility = Math.min(1, e.hostility + 0.1)
      karma.hostility = Math.min(1, karma.hostility + 0.02)
      karma.extraction = Math.min(1, karma.extraction + 0.02)
      return { type: 'defector_risk', entityIndex: idx }
    }

    if (e.kind === 'corruptor') {
      // Attempt cleansing
      const cost = 0.15
      if (player.energy < cost) return { type: 'none' }
      player.energy -= cost

      // Success probability based on player virtue
      const successChance = 0.3 + player.patience * 0.3 + karma.beauty * 0.2 + karma.trust * 0.2
      if (Math.random() < successChance) {
        // Success
        e.corruption = Math.max(0, e.corruption - 0.4)
        e.hostility = Math.max(0, e.hostility - 0.3)
        karma.beauty = Math.min(1, karma.beauty + 0.04)
        karma.corruption = Math.max(0, karma.corruption - 0.03)
        karma.trust = Math.min(1, karma.trust + 0.02)
        // Transform to fragile if mostly cleansed
        if (e.corruption < 0.2) {
          e.kind = 'fragile'
          e.energy = 0.3
          e.hostility = 0
          e.beauty = 0.2
        }
        return { type: 'corruptor_cleanse_success', entityIndex: idx }
      } else {
        // Failure — retaliation
        player.energy = Math.max(0, player.energy - 0.1)
        karma.corruption = Math.min(1, karma.corruption + 0.03)
        e.hostility = Math.min(1, e.hostility + 0.15)
        return { type: 'corruptor_cleanse_fail', entityIndex: idx }
      }
    }

    // Wanderer — gentle interaction
    if (e.kind === 'wanderer') {
      e.trust = Math.min(1, e.trust + 0.03)
      karma.trust = Math.min(1, karma.trust + 0.005)
      return { type: 'cooperator_exchange', entityIndex: idx }
    }
  }

  // Empty space click — ripple
  return { type: 'ripple' }
}

export function updateWorld(state: WorldState, dt: number, width: number, height: number): void {
  state.time += dt
  const { player, karma } = state

  // Update mood every ~2 seconds
  if (Math.floor(state.time * 0.5) !== Math.floor((state.time - dt) * 0.5)) {
    Object.assign(state.mood, getCosmicMood())
  }

  // --- Player death state ---
  if (!player.alive) {
    // Track mouse but don't move player
    player.stillness = Math.min(1, player.stillness + dt * 0.2)

    // After ~5 seconds of stillness, show ember
    if (player.deathTime === 0) player.deathTime = state.time
    const timeDead = state.time - player.deathTime
    if (timeDead > 5 && player.stillness > 0.5 && !player.emberVisible) {
      player.emberX = player.x + (Math.random() - 0.5) * 60 * state.scale
      player.emberY = player.y + (Math.random() - 0.5) * 60 * state.scale
      player.emberVisible = true
    }

    // Still update entities and world even when dead
    updateEntities(state, dt, width, height)
    updateGrass(state, dt, height)
    updateParticles(state, dt, width, height)
    updateRipples(state, dt)
    periodicSave(state, dt)
    return
  }

  // Player follows mouse with lerp
  const lerpFactor = 0.08
  player.x += (player.targetX - player.x) * lerpFactor
  player.y += (player.targetY - player.y) * lerpFactor

  // Pulsing aura (scaled)
  const s = state.scale
  player.aura = (25 + Math.sin(state.time * 2) * 8 + player.energy * 15) * s

  // Mouse speed smoothing for behavior classification
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

  // Update karma from behavior — gentle shifts
  karma.beauty += (player.patience - 0.5) * dt * 0.005
  karma.trust += (player.stillness - player.aggression) * dt * 0.003
  karma.hostility += (player.aggression - 0.3) * dt * 0.004
  karma.navigability = Math.max(0, Math.min(1,
    karma.beauty * 0.3 + karma.trust * 0.3 - karma.hostility * 0.2 - karma.corruption * 0.2 + 0.3
  ))

  // Clamp karma values
  karma.beauty = Math.max(0, Math.min(1, karma.beauty))
  karma.trust = Math.max(0, Math.min(1, karma.trust))
  karma.hostility = Math.max(0, Math.min(1, karma.hostility))
  karma.navigability = Math.max(0, Math.min(1, karma.navigability))
  karma.corruption = Math.max(0, Math.min(1, karma.corruption))
  karma.patience = player.patience

  // Hostility decays slowly with patience
  karma.hostility = Math.max(0, karma.hostility - dt * 0.001 * player.patience)

  // Player energy — stillness near healthy entities grants small regen
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

  // Trail — reuse objects, limit length
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

  // Update nav nodes — progressive revelation
  updateNavNodes(state, dt)

  // Entity interactions with player (hover effects)
  updateEntityHoverInteractions(state, dt)

  updateEntities(state, dt, width, height)
  updateGrass(state, dt, height)
  updateParticles(state, dt, width, height)
  updateRipples(state, dt)
  periodicSave(state, dt)
}

function updateNavNodes(state: WorldState, dt: number): void {
  const { player, karma } = state
  const s = state.scale
  const revealRadius = (80 + karma.navigability * 40) * s
  const hintRadius = 200 * s

  for (let i = 0; i < state.navNodes.length; i++) {
    const node = state.navNodes[i]

    // Note nodes drift slowly; artifact and bio are more stable
    if (node.kind === 'note') {
      node.x = node.baseX + Math.sin(state.time * 0.15 + node.phase) * 30 * s
      node.y = node.baseY + Math.cos(state.time * 0.12 + node.phase * 1.4) * 20 * s
    } else if (node.kind === 'artifact') {
      node.x = node.baseX + Math.sin(state.time * 0.06 + node.phase) * 8 * s
      node.y = node.baseY + Math.cos(state.time * 0.05 + node.phase) * 5 * s
    }
    // Bio stays put

    const dx = node.x - player.x
    const dy = node.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < revealRadius && player.aggression < 0.5) {
      // Reveal rate depends on patience and stillness
      const proximity = 1 - dist / revealRadius
      const revealRate = (0.15 + player.patience * 0.25 + player.stillness * 0.2) * proximity
      node.revealed = Math.min(1, node.revealed + dt * revealRate)
    } else if (dist < hintRadius) {
      // Slow decay when in hint range but not close enough
      node.revealed = Math.max(0, node.revealed - dt * 0.03)
    } else {
      // Faster decay when far away
      node.revealed = Math.max(0, node.revealed - dt * 0.08)
    }
  }
}

// Find a clickable nav node (revealed >= 1.0) near a point
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

    // Fragile: patient hover stabilizes
    if (e.kind === 'fragile' && player.aggression < 0.3) {
      e.energy = Math.min(1, e.energy + dt * 0.02 * proximity * player.stillness)
      e.trust = Math.min(1, e.trust + dt * 0.01 * proximity)
    }

    // Corruptor: proximity drains player
    if (e.kind === 'corruptor') {
      player.energy = Math.max(0, player.energy - dt * 0.015 * proximity * e.corruption)
      karma.corruption = Math.min(1, karma.corruption + dt * 0.002 * proximity)
    }

    // Patient hover near any entity increases trust
    if (player.stillness > 0.4) {
      e.trust = Math.min(1, e.trust + dt * 0.005 * proximity * player.stillness)
      karma.trust = Math.min(1, karma.trust + dt * 0.001 * proximity)
    }
  }
}

function updateEntities(state: WorldState, dt: number, width: number, height: number): void {
  const { player, mood, karma } = state
  const s = state.scale
  const time = state.time

  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive) continue

    // Organic drift with noise
    const noiseX = Math.sin(time * 0.5 + e.phase) * 0.3 + Math.sin(time * 0.2 + e.phase * 2.1) * 0.15
    const noiseY = Math.cos(time * 0.4 + e.phase * 1.3) * 0.2 + Math.cos(time * 0.15 + e.phase * 0.7) * 0.1
    const windEffect = mood.windStrength * 0.3

    // Kind-specific behavior
    let seekX = 0, seekY = 0

    if (player.alive) {
      const dx = player.x - e.x
      const dy = player.y - e.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const nx = dist > 0 ? dx / dist : 0
      const ny = dist > 0 ? dy / dist : 0

      if (e.kind === 'wanderer') {
        // Neutral — slight drift, no strong reaction to player
        // Mildly attracted if trusted
        if (dist < 200 * s && e.trust > 0.5) {
          seekX += nx * 0.1 * e.trust
          seekY += ny * 0.1 * e.trust
        }
      } else if (e.kind === 'fragile') {
        // Shy — flee if player is aggressive, drift toward if gentle
        if (player.aggression > 0.4 && dist < 180 * s) {
          seekX -= nx * 0.4
          seekY -= ny * 0.4
        } else if (player.stillness > 0.5 && dist < 150 * s) {
          seekX += nx * 0.08
          seekY += ny * 0.08
        }
      } else if (e.kind === 'cooperator') {
        // Friendly — seeks player and other cooperators
        if (dist < 250 * s) {
          const attraction = 0.15 + karma.trust * 0.15
          seekX += nx * attraction
          seekY += ny * attraction
        }
        // Also seek nearby cooperators
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
        // Avoids player, may seek fragile entities to drain
        if (dist < 200 * s) {
          seekX -= nx * 0.25
          seekY -= ny * 0.25
        }
        // Seek fragile entities
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
          // Drain fragile on contact
          if (odist < 25 * s) {
            other.energy = Math.max(0, other.energy - dt * 0.08)
            e.energy = Math.min(1, e.energy + dt * 0.04)
            karma.hostility = Math.min(1, karma.hostility + dt * 0.002)
          }
        }
      } else if (e.kind === 'corruptor') {
        // Slow, menacing drift — spread corruption nearby
        seekX += Math.sin(time * 0.15 + e.phase) * 0.1
        seekY += Math.cos(time * 0.12 + e.phase * 1.5) * 0.08
        // Spread corruption to nearby non-corruptor entities
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

    // Apply velocity
    const speed = e.kind === 'corruptor' ? 0.3 : e.kind === 'fragile' ? 0.4 : 0.6
    e.vx += (noiseX + seekX + windEffect) * dt * 2
    e.vy += (noiseY + seekY) * dt * 2

    // Damping
    e.vx *= 0.95
    e.vy *= 0.95

    // Clamp speed
    const vel = Math.sqrt(e.vx * e.vx + e.vy * e.vy)
    if (vel > speed * s) {
      e.vx = (e.vx / vel) * speed * s
      e.vy = (e.vy / vel) * speed * s
    }

    e.x += e.vx
    e.y += e.vy

    // Keep in bounds with soft wrapping
    const margin = 50 * s
    if (e.x < margin) e.vx += dt * 2
    if (e.x > width - margin) e.vx -= dt * 2
    if (e.y < margin) e.vy += dt * 2
    if (e.y > height - margin) e.vy -= dt * 2

    // Entity energy decay for fragile entities
    if (e.kind === 'fragile') {
      e.energy = Math.max(0, e.energy - dt * 0.003)
      if (e.energy <= 0) e.alive = false
    }
  }
}

function updateGrass(state: WorldState, _dt: number, height: number): void {
  const { player, mood } = state
  const s = state.scale
  const windTime = state.time * (0.6 + mood.windStrength * 1.0)

  for (let i = 0; i < state.grass.length; i++) {
    const blade = state.grass[i]
    const wind1 = Math.sin(windTime + blade.phase) * (0.2 + mood.windStrength * 0.15)
    const wind2 = Math.sin(windTime * 0.7 + blade.phase * 1.3 + 1.2) * 0.08
    const wind3 = Math.sin(windTime * 0.3 + blade.x * 0.003) * 0.06
    const wind = wind1 + wind2 + wind3

    const dx = blade.x - player.x
    const dy = (height - blade.baseHeight * 0.5) - player.y
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

function updateParticles(state: WorldState, _dt: number, width: number, height: number): void {
  const { player, mood } = state
  const s = state.scale

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i]
    p.x += (p.vx + Math.sin(state.time * 0.3 + p.phase) * 0.2 * mood.driftSpeed) * s
    p.y += (p.vy + Math.cos(state.time * 0.2 + p.phase * 1.3) * 0.15 * mood.driftSpeed) * s

    const pdx = p.x - player.x
    const pdy = p.y - player.y
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
    const pushRadius = 100 * s
    if (pdist < pushRadius && pdist > 0) {
      const push = (1 - pdist / pushRadius) * 0.3 * s
      p.x += pdx / pdist * push
      p.y += pdy / pdist * push
    }

    p.brightness = 0.2 + Math.sin(state.time + p.phase) * 0.15 + 0.15

    if (p.x < -20) p.x = width + 20
    if (p.x > width + 20) p.x = -20
    if (p.y < -20) p.y = height + 20
    if (p.y > height + 20) p.y = -20
  }
}

function updateRipples(state: WorldState, dt: number): void {
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const r = state.ripples[i]
    r.radius += dt * 120 * state.scale
    r.alpha *= 0.96
    if (r.alpha < 0.01 || r.radius > r.maxRadius) {
      state.ripples.splice(i, 1)
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
