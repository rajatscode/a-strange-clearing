import type { CosmicMood } from './mood'
import { getCosmicMood } from './mood'
import type { KarmaState } from './persistence'
import { loadKarma, saveKarma } from './persistence'
import type { Centipede } from './centipede'
import { createCentipede, updateCentipede, getHeadPosition, addMiddleSegment, removeMiddleSegment } from './centipede'
import type { Tree } from './tree'
import { generateTree, updateLeafHealth, updateLeaves } from './tree'
import type { StarField } from './stars'
import { createStarField, updateStarField, addDust } from './stars'
import type { AgentSystem } from './agents'
import { createAgentSystem, updateAgents } from './agents'
import type { PotState } from './pot'
import { createPot, updatePot } from './pot'

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
  glowBoost: number
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
  labelShown?: boolean
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
  deadZone: number
  navGlow: number
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

// Note: Star type is now in ./stars.ts as part of the StarField system

export type DeathParticle = {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  r: number
  g: number
  b: number
  radius: number
}

export type BeautyBloom = {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  hue: number
}

export type ConnectionLine = {
  x1: number
  y1: number
  x2: number
  y2: number
  alpha: number
  kind: 'cooperate' | 'hunt' | 'corrupt' | 'nourish'
}

export type GroundScar = {
  x: number
  y: number
  alpha: number
  radius: number
  dark: boolean
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

export type TextFragment = {
  text: string
  x: number
  y: number
  alpha: number
  maxAlpha: number
  lifetime: number
  phase: 'fadein' | 'hold' | 'fadeout'
  drift: number
}

export type WorldState = {
  player: Player
  centipede: Centipede
  tree: Tree
  agents: AgentSystem
  pot: PotState
  entities: Entity[]
  particles: Particle[]
  grass: GrassBlade[]
  ripples: Ripple[]
  flashes: Flash[]
  navNodes: NavNode[]
  falseBeacons: Array<{ x: number; y: number; revealed: number; phase: number; alive: boolean }>
  starField: StarField
  deathParticles: DeathParticle[]
  beautyBlooms: BeautyBloom[]
  connectionLines: ConnectionLine[]
  groundScars: GroundScar[]
  fragments: TextFragment[]
  mood: CosmicMood
  karma: KarmaState
  camera: { x: number; y: number }
  worldWidth: number
  worldHeight: number
  worldEvents: {
    entityDeath: boolean
    beautyBloom: boolean
    starFormed: boolean
    transcendence: boolean
    corruptionSpread: boolean
    cleanseSuccess: boolean
  }
  smoothKarma: {
    beauty: number
    trust: number
    hostility: number
    corruption: number
    navigability: number
  }
  mouseSpeed: number
  mouseSmoothed: number
  mouseScreenX: number
  mouseScreenY: number
  time: number
  scale: number
  lastClickTime: number
  clickCooldown: number
  lastBloomTime: number
  lastSpawnTime: number
  lastFragmentTime: number
  shownFragments: Set<string>
  transcendenceTimer: number
  transcendenceActive: boolean
  transcendenceCooldown: number
  entityIdCounter: number
  firstInteraction: boolean
  reducedMotion: boolean
  nearNavNodeMissed: boolean
  godMode: boolean
}

export const ENTITY_COLORS: Record<EntityKind, { r: number; g: number; b: number; hue: number }> = {
  wanderer:   { r: 100, g: 200, b: 220, hue: 190 },
  fragile:    { r: 220, g: 180, b: 120, hue: 35 },
  cooperator: { r: 80,  g: 220, b: 180, hue: 160 },
  defector:   { r: 240, g: 80,  b: 60,  hue: 10 },
  corruptor:  { r: 130, g: 150, b: 110, hue: 90 },
}

function spawnEntities(width: number, height: number, scale: number, totalVisits: number = 0): Entity[] {
  const area = width * height
  const baseCount = 25
  const isSmallViewport = typeof window !== 'undefined' && window.innerWidth < 400
  const areaScale = Math.max(0.6, Math.min(2.0, area / (1920 * 1080 * 6)))
  const total = Math.floor(baseCount * areaScale * (isSmallViewport ? 0.5 : 1))
  const visitOffset = (totalVisits * 0.137) % 1

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
    const radiusBase = kind === 'fragile' ? 4 : kind === 'cooperator' ? 11 : kind === 'corruptor' ? 13 : kind === 'defector' ? 11 : 7
    entities.push({
      id: `${kind}-${i}`,
      kind,
      x: ((Math.random() + visitOffset) % 1) * width * 0.8 + width * 0.1,
      y: ((Math.random() + visitOffset * 0.7) % 1) * height * 0.6 + height * 0.2,
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

  // First visit: nodes placed close to center so they're discoverable within 15-30s
  // Player starts at (0.5, 0.5) — keep nav nodes within ~10% of center
  const noteX = firstVisit
    ? width * (0.44 + Math.random() * 0.04)
    : width * (margin + Math.random() * (1 - margin * 2))
  const noteY = firstVisit
    ? height * (0.40 + Math.random() * 0.06)
    : height * (0.2 + Math.random() * 0.4)

  const artX = firstVisit
    ? width * (0.52 + Math.random() * 0.04)
    : width * (margin + Math.random() * (1 - margin * 2))
  const artY = firstVisit
    ? height * (0.44 + Math.random() * 0.06)
    : height * (0.2 + Math.random() * 0.4)

  const bioX = width * (0.48 + Math.random() * 0.04)
  const bioY = height * (0.54 + Math.random() * 0.04)

  return [
    { kind: 'note', x: noteX, y: noteY, baseX: noteX, baseY: noteY, revealed: firstVisit ? 0.15 : 0, phase: Math.random() * Math.PI * 2, route: '#/notes' },
    { kind: 'artifact', x: artX, y: artY, baseX: artX, baseY: artY, revealed: firstVisit ? 0.1 : 0, phase: Math.random() * Math.PI * 2, route: '#/artifacts' },
    { kind: 'bio', x: bioX, y: bioY, baseX: bioX, baseY: bioY, revealed: 0, phase: Math.random() * Math.PI * 2, route: '#/bio' },
  ]
}

export function createWorld(viewportWidth: number, viewportHeight: number): WorldState {
  const karma = loadKarma()
  const mood = getCosmicMood()
  const scale = viewportHeight / 800

  // World must accommodate leaf field (~1500px) + sky for stars (~500px) + ground padding
  const worldWidth = viewportWidth * 5
  const worldHeight = viewportHeight * 6

  const worldRatio = (worldWidth / viewportWidth) * (worldHeight / viewportHeight)
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768
  const isSmallViewport = window.innerWidth < 400
  const mobileScale = isSmallViewport ? 0.35 : isMobile ? 0.6 : 1
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const motionScale = reducedMotion ? 0.5 : 1
  const grassCount = Math.min(250, Math.floor((180 + mood.grassDensity * 70) * Math.sqrt(worldRatio) * mobileScale))
  const particleCount = Math.min(50, Math.floor((35 + mood.driftSpeed * 15) * Math.sqrt(worldRatio) * mobileScale * motionScale))

  const grass: GrassBlade[] = []
  for (let i = 0; i < grassCount; i++) {
    const x = (i / grassCount) * worldWidth + (Math.random() - 0.5) * (worldWidth / grassCount) * 1.5
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
      deadZone: 0,
      navGlow: 0,
    })
  }
  grass.sort((a, b) => a.baseHeight - b.baseHeight)

  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    const yBias = Math.random() < 0.3 ? worldHeight * 0.6 + Math.random() * worldHeight * 0.4 : Math.random() * worldHeight
    particles.push({
      x: Math.random() * worldWidth,
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

  const entities = spawnEntities(worldWidth, worldHeight, scale, karma.totalVisits)
  const navNodes = createNavNodes(worldWidth, worldHeight, karma)

  // Generate procedural tree -- seed from visit count for deterministic-per-visitor variation
  const treeSeed = 42 + karma.totalVisits * 7
  const tree = generateTree(treeSeed, viewportWidth, viewportHeight)

  // Player starts at tree base (trunk origin)
  const startX = tree.originX
  const startY = tree.originY

  return {
    player: {
      x: startX,
      y: startY,
      targetX: startX,
      targetY: startY,
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
      glowBoost: 0,
    },
    centipede: createCentipede(startX, startY),
    tree,
    agents: createAgentSystem(tree),
    pot: createPot(),
    entities,
    particles,
    grass,
    ripples: [],
    flashes: [],
    navNodes,
    falseBeacons: [],
    starField: createStarField(tree),
    deathParticles: [],
    beautyBlooms: [],
    connectionLines: [],
    groundScars: [],
    fragments: [],
    mood,
    karma,
    camera: { x: startX - viewportWidth / 2, y: startY - viewportHeight / 2 },
    worldWidth,
    worldHeight,
    worldEvents: {
      entityDeath: false,
      beautyBloom: false,
      starFormed: false,
      transcendence: false,
      corruptionSpread: false,
      cleanseSuccess: false,
    },
    smoothKarma: {
      beauty: karma.beauty,
      trust: karma.trust,
      hostility: karma.hostility,
      corruption: karma.corruption,
      navigability: karma.navigability,
    },
    mouseSpeed: 0,
    mouseSmoothed: 0,
    mouseScreenX: 0,
    mouseScreenY: 0,
    time: 0,
    scale,
    lastClickTime: 0,
    clickCooldown: 0.3,
    lastBloomTime: 0,
    lastSpawnTime: 0,
    lastFragmentTime: -45,
    shownFragments: new Set(),
    transcendenceTimer: 0,
    transcendenceActive: false,
    transcendenceCooldown: 0,
    entityIdCounter: entities.length,
    firstInteraction: false,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    nearNavNodeMissed: false,
    godMode: false,
  }
}

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
  type: 'none' | 'fragile_nourish' | 'cooperator_exchange' | 'defector_risk' | 'corruptor_cleanse_success' | 'corruptor_cleanse_fail' | 'ember_revive' | 'ripple' | 'false_beacon_trap' | 'fragile_harvest' | 'cooperator_drain' | 'corruption_ripple'
  entityIndex?: number
}

export function handleWorldClick(state: WorldState, x: number, y: number): ClickResult {
  const { player, karma } = state
  const now = state.time

  // Rapid click detection: < 0.5s = extractive, >= 0.5s = cooperative
  const timeSinceLastClick = now - state.lastClickTime
  const isRapidClick = timeSinceLastClick < 0.5 && timeSinceLastClick > 0.05 // > 0.05 to filter cooldown bounces

  if (timeSinceLastClick < state.clickCooldown) {
    player.aggression = Math.min(1, player.aggression + 0.05)
    karma.hostility = Math.min(1, karma.hostility + 0.01)
    return { type: 'none' }
  }
  state.lastClickTime = now

  if (!player.alive && player.emberVisible) {
    const edx = x - player.emberX
    const edy = y - player.emberY
    if (Math.sqrt(edx * edx + edy * edy) < 40 * state.scale) {
      player.alive = true
      player.energy = 0.3
      player.deathTime = 0
      player.emberVisible = false
      karma.corruption = Math.min(1, karma.corruption + 0.05)

      // Revival — gentle pull on nearby entities + beauty bloom + warm flash
      const s = state.scale
      for (let i = 0; i < state.entities.length; i++) {
        const e = state.entities[i]
        if (!e.alive) continue
        const dx = e.x - player.x
        const dy = e.y - player.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 300 * s && dist > 0) {
          e.vx -= (dx / dist) * 0.5
          e.vy -= (dy / dist) * 0.5
        }
      }
      addBeautyBloom(state, player.x, player.y, 250)
      addFlash(state, player.x, player.y, 255, 200, 120, 100 * s)
      state.worldEvents.transcendence = true

      return { type: 'ember_revive' }
    }
    return { type: 'none' }
  }

  if (!player.alive) return { type: 'none' }

  const idx = findEntityAt(state, x, y)
  if (idx >= 0) {
    const e = state.entities[idx]

    // Too weak to interact meaningfully
    if (player.energy < 0.15 && e.kind !== 'defector') {
      return { type: 'ripple' }
    }

    if (e.kind === 'fragile') {
      if (isRapidClick) {
        // HARVEST — extractive path: fast energy, karmic cost
        player.energy = Math.min(3.0, player.energy + 0.2)
        player.glowBoost = Math.min(1, player.glowBoost + 0.3)
        e.energy = Math.max(0, e.energy - 0.4)
        e.radius = Math.max(2 * state.scale, e.radius * 0.6)  // visibly shrinks
        e.trust = Math.max(0, e.trust - 0.3)
        karma.beauty = Math.max(0, karma.beauty - 0.05)
        karma.trust = Math.max(0, karma.trust - 0.03)
        karma.hostility = Math.min(1, karma.hostility + 0.03)
        karma.corruption = Math.min(1, karma.corruption + 0.02)
        // Kill if drained
        if (e.energy <= 0.05) {
          e.alive = false
          state.worldEvents.entityDeath = true
          karma.corruption = Math.min(1, karma.corruption + 0.03)
        }
        addFlash(state, e.x, e.y, 80, 120, 200, 60 * state.scale)  // cold blue flash
        addDust(state.starField, e.x, e.y, false, 3) // black dust from harvesting
        return { type: 'fragile_harvest', entityIndex: idx }
      } else if (player.energy > 0.1) {
        // NOURISH — generous path (stronger at high energy)
        const powerMult = Math.min(2, player.energy)
        const transfer = Math.min(0.15 * powerMult, player.energy - 0.05)
        player.energy -= transfer
        e.energy = Math.min(1, e.energy + transfer * 1.5)
        e.trust = Math.min(1, e.trust + 0.1)
        e.radius = Math.min(e.radius * 1.8, 12 * state.scale)
        karma.beauty = Math.min(1, karma.beauty + 0.03)
        karma.generosity = Math.min(1, karma.generosity + 0.03)
        karma.trust = Math.min(1, karma.trust + 0.02)
        karma.navigability = Math.min(1, karma.navigability + 0.1)
        addBeautyBloom(state, e.x, e.y, 150)
        addFlash(state, e.x, e.y, 255, 220, 140, 80 * state.scale)
        addDust(state.starField, e.x, e.y, true, 4) // golden dust from nourishing
        return { type: 'fragile_nourish', entityIndex: idx }
      }
    }

    if (e.kind === 'cooperator') {
      if (isRapidClick) {
        // DRAIN — most extractive act: high reward, devastating karmic cost
        player.energy = Math.min(3.0, player.energy + 0.3)
        player.glowBoost = Math.min(1, player.glowBoost + 0.4)
        e.energy = Math.max(0, e.energy - 0.3)
        e.trust = Math.max(0, e.trust - 0.4)
        e.radius = Math.max(3 * state.scale, e.radius * 0.7)
        karma.beauty = Math.max(0, karma.beauty - 0.08)
        karma.trust = Math.max(0, karma.trust - 0.06)
        karma.hostility = Math.min(1, karma.hostility + 0.04)
        karma.corruption = Math.min(1, karma.corruption + 0.04)
        // Cooperator recoils — breaks constellations
        const fdx = e.x - player.x
        const fdy = e.y - player.y
        const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
        if (fdist > 0) {
          e.vx += (fdx / fdist) * 2.5
          e.vy += (fdy / fdist) * 2.5
        }
        if (e.energy <= 0.05) {
          e.alive = false
          state.worldEvents.entityDeath = true
          karma.corruption = Math.min(1, karma.corruption + 0.05)
        }
        addFlash(state, e.x, e.y, 140, 80, 200, 80 * state.scale)  // cold purple flash
        addDust(state.starField, e.x, e.y, false, 5) // black dust from draining cooperator
        return { type: 'cooperator_drain', entityIndex: idx }
      } else {
        // MUTUAL EXCHANGE — cooperative path
        player.energy = Math.min(1, player.energy + 0.05)
        e.energy = Math.min(1, e.energy + 0.05)
        e.trust = Math.min(1, e.trust + 0.08)
        e.beauty = Math.min(1, e.beauty + 0.05)
        karma.beauty = Math.min(1, karma.beauty + 0.025)
        karma.trust = Math.min(1, karma.trust + 0.02)
        const mx = (player.x + e.x) / 2
        const my = (player.y + e.y) / 2
        addBeautyBloom(state, mx, my, 120)
        addFlash(state, mx, my, 100, 240, 180, 60 * state.scale)
        addDust(state.starField, mx, my, true, 6) // golden dust from cooperation
        return { type: 'cooperator_exchange', entityIndex: idx }
      }
    }

    if (e.kind === 'defector') {
      const drain = 0.12 + Math.random() * 0.08
      player.energy = Math.max(0, player.energy - drain)
      e.hostility = Math.min(1, e.hostility + 0.15)
      karma.hostility = Math.min(1, karma.hostility + 0.03)
      karma.extraction = Math.min(1, karma.extraction + 0.02)
      // Defector flees dramatically
      const fdx = e.x - player.x
      const fdy = e.y - player.y
      const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
      if (fdist > 0) {
        e.vx += (fdx / fdist) * 3.0
        e.vy += (fdy / fdist) * 3.0
      }
      addFlash(state, player.x, player.y, 180, 60, 40, 50 * state.scale)  // player dimming flash
      addDust(state.starField, e.x, e.y, false, 4) // black dust from defection
      return { type: 'defector_risk', entityIndex: idx }
    }

    if (e.kind === 'corruptor') {
      if (isRapidClick) {
        // HARVEST CORRUPTION — exploit it for energy, selfish path
        player.energy = Math.min(3.0, player.energy + 0.15)
        player.glowBoost = Math.min(1, player.glowBoost + 0.25)
        karma.corruption = Math.min(1, karma.corruption + 0.08)
        karma.beauty = Math.max(0, karma.beauty - 0.03)
        karma.hostility = Math.min(1, karma.hostility + 0.02)
        addFlash(state, e.x, e.y, 100, 80, 50, 70 * state.scale)  // sickly dark flash
        return { type: 'fragile_harvest', entityIndex: idx }  // reuse harvest type for visual
      }

      // CLEANSE — cooperative path, risky and generous
      const cost = 0.15
      if (player.energy < cost) return { type: 'none' }
      player.energy -= cost

      const energyBonus = Math.max(0, player.energy - 1) * 0.15
      const successChance = 0.3 + player.patience * 0.3 + karma.beauty * 0.2 + karma.trust * 0.2 + energyBonus
      if (Math.random() < successChance) {
        e.corruption = Math.max(0, e.corruption - 0.4)
        e.hostility = Math.max(0, e.hostility - 0.3)
        karma.beauty = Math.min(1, karma.beauty + 0.05)
        karma.corruption = Math.max(0, karma.corruption - 0.04)
        karma.trust = Math.min(1, karma.trust + 0.03)
        karma.navigability = Math.min(1, karma.navigability + 0.1)  // cleansing opens paths
        state.worldEvents.cleanseSuccess = true

        // Dramatic cleanse bloom — large area restoration
        addBeautyBloom(state, e.x, e.y, 300)
        addFlash(state, e.x, e.y, 200, 255, 220, 150 * state.scale)  // big warm restoration

        if (e.corruption < 0.2) {
          e.kind = 'fragile'
          e.energy = 0.3
          e.hostility = 0
          e.beauty = 0.2
        }
        return { type: 'corruptor_cleanse_success', entityIndex: idx }
      } else {
        player.energy = Math.max(0, player.energy - 0.12)
        karma.corruption = Math.min(1, karma.corruption + 0.04)
        e.hostility = Math.min(1, e.hostility + 0.2)
        // Corruption pulse outward on fail — dark flash
        addFlash(state, e.x, e.y, 60, 80, 40, 150 * state.scale)
        addFlash(state, player.x, player.y, 40, 50, 30, 60 * state.scale)  // player darkens
        return { type: 'corruptor_cleanse_fail', entityIndex: idx }
      }
    }

    if (e.kind === 'wanderer') {
      e.trust = Math.min(1, e.trust + 0.03)
      karma.trust = Math.min(1, karma.trust + 0.005)
      return { type: 'cooperator_exchange', entityIndex: idx }
    }
  }

  // Empty space click behavior depends on click speed
  if (isRapidClick) {
    // CORRUPTION RIPPLE — spam clicking poisons the world
    const poisonRadius = 180 * state.scale
    for (let i = 0; i < state.entities.length; i++) {
      const e = state.entities[i]
      if (!e.alive) continue
      const edx = x - e.x
      const edy = y - e.y
      const edist = Math.sqrt(edx * edx + edy * edy)
      if (edist < poisonRadius) {
        e.corruption = Math.min(1, e.corruption + 0.05)
        e.trust = Math.max(0, e.trust - 0.02)
        // Entities recoil from corruption
        if (edist > 10) {
          const push = (1 - edist / poisonRadius) * 0.5
          e.vx -= (edx / edist) * push
          e.vy -= (edy / edist) * push
        }
      }
    }
    karma.corruption = Math.min(1, karma.corruption + 0.02)
    karma.beauty = Math.max(0, karma.beauty - 0.01)
    return { type: 'corruption_ripple' }
  } else {
    // Normal "calling out" — attract nearby entities
    const attractRadius = 200 * state.scale
    for (let i = 0; i < state.entities.length; i++) {
      const e = state.entities[i]
      if (!e.alive) continue
      const edx = x - e.x
      const edy = y - e.y
      const edist = Math.sqrt(edx * edx + edy * edy)
      if (edist < attractRadius && edist > 10) {
        const pull = (1 - edist / attractRadius) * 0.8
        e.vx += (edx / edist) * pull
        e.vy += (edy / edist) * pull
      }
    }
    return { type: 'ripple' }
  }
}

export function updateWorld(state: WorldState, dt: number, viewportWidth: number, viewportHeight: number): void {
  state.time += dt
  const { player, karma, camera } = state

  // Reset world events
  state.worldEvents.entityDeath = false
  state.worldEvents.beautyBloom = false
  state.worldEvents.starFormed = false
  state.worldEvents.transcendence = false
  state.worldEvents.corruptionSpread = false
  state.worldEvents.cleanseSuccess = false

  // Platformer dead-zone camera: head moves freely within center of screen.
  // Camera only scrolls when head reaches the edge of the dead zone.
  const headPos = getHeadPosition(state.centipede)
  const headScreenX = headPos.x - camera.x
  const headScreenY = headPos.y - camera.y

  // Dead zone: head can be anywhere in the middle 50% of the screen
  const dzLeft = viewportWidth * 0.25
  const dzRight = viewportWidth * 0.75
  const dzTop = viewportHeight * 0.2
  const dzBottom = viewportHeight * 0.75

  let targetCamX = camera.x
  let targetCamY = camera.y

  if (headScreenX < dzLeft) targetCamX = headPos.x - dzLeft
  else if (headScreenX > dzRight) targetCamX = headPos.x - dzRight

  if (headScreenY < dzTop) targetCamY = headPos.y - dzTop
  else if (headScreenY > dzBottom) targetCamY = headPos.y - dzBottom

  // Clamp to world bounds
  targetCamX = Math.max(0, Math.min(state.worldWidth - viewportWidth, targetCamX))
  targetCamY = Math.max(0, Math.min(state.worldHeight - viewportHeight, targetCamY))

  // Smooth follow
  camera.x += (targetCamX - camera.x) * 0.15
  camera.y += (targetCamY - camera.y) * 0.15

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

    // Beauty/trust erode while dead
    karma.beauty = Math.max(0, karma.beauty - dt * 0.003)
    karma.trust = Math.max(0, karma.trust - dt * 0.002)

    // Life goes on without you — entities speed up while dead
    updateEntities(state, dt * 1.3, viewportWidth, viewportHeight)
    updateAgents(state.agents, state.tree, state.centipede.currentLeaf, dt, state.time)
    updateLeaves(state.tree, dt, state.time)
    updateStarField(state.starField, state.tree, state.karma, dt, state.time)
    rebuildConnectionLines(state)
    checkCooperatorClusters(state, dt)
    checkSpawning(state, dt, viewportWidth, viewportHeight)
    updateGrass(state, dt, viewportHeight)
    updateParticles(state, dt, viewportWidth, viewportHeight)
    updateRipples(state, dt)
    updateFlashes(state, dt)
    updateDeathParticles(state, dt)
    updateBeautyBlooms(state, dt)
    updateGroundScars(state, dt)
    updateSmoothKarma(state)
    updateLeafHealth(state.tree, dt, karma.beauty)
    updateStarField(state.starField, state.tree, karma, dt, state.time)
    periodicSave(state, dt)
    return
  }

  // Centipede hops between leaves based on mouse proximity to reachable leaves
  updateCentipede(state.centipede, state.mouseScreenX, state.mouseScreenY, viewportWidth, viewportHeight, camera.x, camera.y, dt, state.tree, state.godMode)

  // Sync player position with centipede head for backwards compat with other systems
  const centipedeHead = getHeadPosition(state.centipede)
  player.x = centipedeHead.x
  player.y = centipedeHead.y
  player.targetX = player.x
  player.targetY = player.y

  const s = state.scale
  player.aura = (25 + Math.sin(state.time * 2) * 8 + Math.min(player.energy, 1) * 15 + Math.max(0, player.energy - 1) * 30) * s

  state.mouseSmoothed += (state.mouseSpeed - state.mouseSmoothed) * 0.05

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

  // Extraction glow decays quickly
  player.glowBoost = Math.max(0, player.glowBoost - dt * 0.8)

  karma.beauty += (player.patience - 0.5) * dt * 0.054
  karma.trust += (player.stillness - player.aggression) * dt * 0.036
  karma.hostility += (player.aggression - 0.3) * dt * 0.045
  karma.navigability = Math.max(0, Math.min(1,
    karma.beauty * 0.3 + karma.trust * 0.3 - karma.hostility * 0.2 - karma.corruption * 0.2 + 0.3
  ))

  karma.beauty = Math.max(0, Math.min(1, karma.beauty))
  karma.trust = Math.max(0, Math.min(1, karma.trust))
  karma.hostility = Math.max(0, Math.min(1, karma.hostility))
  karma.navigability = Math.max(0, Math.min(1, karma.navigability))
  karma.corruption = Math.max(0, Math.min(1, karma.corruption))
  karma.patience = player.patience

  karma.hostility = Math.max(0, karma.hostility - dt * 0.012 * player.patience)

  if (player.stillness > 0.6 && player.energy < 0.8) {
    player.energy = Math.min(0.8, player.energy + dt * 0.003) // stillness regen caps at 0.8
  }

  // High energy maintenance cost — only above 1.5 buffer zone, gentle drain
  if (player.energy > 1.5) {
    player.energy -= dt * 0.005 * (player.energy - 1.5)
  }

  // Extra energy drain in corruption zones
  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive || e.kind !== 'corruptor') continue
    const dx = e.x - player.x
    const dy = e.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const zoneRadius = 150 * s * e.corruption
    if (dist < zoneRadius) {
      const proximity = 1 - dist / zoneRadius
      player.energy = Math.max(0, player.energy - dt * 0.008 * proximity * e.corruption)
    }
  }

  if (player.energy <= 0) {
    player.alive = false
    player.energy = 0
    player.deathTime = state.time
    player.emberVisible = false
    karma.deaths++

    // World visibly cools on death
    karma.beauty = Math.max(0, karma.beauty - 0.1)
    karma.hostility = Math.min(1, karma.hostility + 0.05)

    // Entities scatter on player death — strong outward force
    for (let i = 0; i < state.entities.length; i++) {
      const e = state.entities[i]
      if (!e.alive) continue
      const dx = e.x - player.x
      const dy = e.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 350 * s && dist > 0) {
        const force = (1 - dist / (350 * s)) * 5
        e.vx += (dx / dist) * force
        e.vy += (dy / dist) * force
      }
    }
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
  updateFalseBeacons(state, dt)
  updateEntityHoverInteractions(state, dt)
  updateEntities(state, dt, viewportWidth, viewportHeight)
  updateAgents(state.agents, state.tree, state.centipede.currentLeaf, dt, state.time)
  updateLeaves(state.tree, dt, state.time)
  updateStarField(state.starField, state.tree, state.karma, dt, state.time)

  // Bond mechanic — cooperation/defection
  const bondResults = updatePot(state.pot, state.agents, state.centipede, state.tree, state.karma, dt)
  for (const result of bondResults) {
    if (result.type === 'cooperate') {
      // POSITIVE SUM: return stakes + bonus. Segments were already removed at bond start.
      // Party 1 gets back: stake1 + 50% of stake2 (bonus from the other's investment)
      // Party 2 gets back: stake2 + 50% of stake1
      // The surplus that exceeds inputs becomes gold dust → stars
      const return1 = result.stake1 + Math.max(1, Math.floor(result.stake2 * 0.5))
      const return2 = result.stake2 + Math.max(1, Math.floor(result.stake1 * 0.5))
      const surplusDust = result.potSize * 1.5
      addDust(state.starField, result.playerX, result.playerY, true, surplusDust * 0.5)
      addDust(state.starField, result.agentX, result.agentY, true, surplusDust * 0.5)

      if (result.isPlayerBond) {
        player.energy = Math.min(3.0, player.energy + result.potSize * 0.08)
        for (let g = 0; g < return1; g++) addMiddleSegment(state.centipede)
        const coopAgent = state.agents.agents[result.agentIdx]
        if (coopAgent) for (let g = 0; g < return2; g++) addMiddleSegment(coopAgent.centipede)
        karma.beauty = Math.min(1, karma.beauty + 0.06 * result.spectrumValue)
        karma.trust = Math.min(1, karma.trust + 0.05 * result.spectrumValue)
      } else {
        const a1 = state.agents.agents[result.agentIdx]
        const a2 = state.agents.agents[result.agent2Idx]
        if (a1) for (let g = 0; g < return1; g++) addMiddleSegment(a1.centipede)
        if (a2) for (let g = 0; g < return2; g++) addMiddleSegment(a2.centipede)
      }

      // Immediate local bloom — nearby leaves pulse with health
      for (const leaf of state.tree.leaves) {
        const dx = leaf.x - (result.playerX + result.agentX) / 2
        const dy = leaf.y - (result.playerY + result.agentY) / 2
        if (dx * dx + dy * dy < 200 * 200) {
          leaf.health = Math.min(1, leaf.health + 0.08 * result.spectrumValue)
          leaf.glowIntensity = Math.min(1, leaf.glowIntensity + 0.1)
        }
      }

      addFlash(state, (result.playerX + result.agentX) / 2, (result.playerY + result.agentY) / 2, 255, 220, 120, 120 * state.scale)
      addBeautyBloom(state, (result.playerX + result.agentX) / 2, (result.playerY + result.agentY) / 2, 250)

    } else if (result.type === 'defect') {
      // NEGATIVE SUM: segments were already removed at bond start.
      // Defector gets back: their own stake + 70% of victim's stake
      // Victim gets back: NOTHING (their segments are gone)
      // 30% of victim's stake becomes black dust (the negative sum)
      const playerDefected = result.spectrumValue <= 0.5
      const defectorStake = playerDefected ? result.stake1 : result.stake2
      const victimStake = playerDefected ? result.stake2 : result.stake1
      const defectorReturn = defectorStake + Math.max(1, Math.floor(victimStake * 0.7))
      const defectorX = playerDefected ? result.playerX : result.agentX
      const defectorY = playerDefected ? result.playerY : result.agentY
      const victimX = playerDefected ? result.agentX : result.playerX
      const victimY = playerDefected ? result.agentY : result.playerY

      // The 30% lost goes to black dust
      addDust(state.starField, defectorX, defectorY, false, Math.ceil(victimStake * 0.3) * 3)

      if (result.isPlayerBond) {
        if (playerDefected) {
          // Player defected — gets their stake back + stolen segments
          for (let g = 0; g < defectorReturn; g++) addMiddleSegment(state.centipede)
          // Victim already lost their stake at bond start — nothing returned
          karma.beauty = Math.max(0, karma.beauty - 0.08)
          karma.hostility = Math.min(1, karma.hostility + 0.06)
          karma.corruption = Math.min(1, karma.corruption + 0.05)
        } else {
          // Agent defected — agent gets their stake back + stolen
          const defector = state.agents.agents[result.agentIdx]
          if (defector) for (let g = 0; g < defectorReturn; g++) addMiddleSegment(defector.centipede)
          // Player already lost their stake — nothing returned
          karma.trust = Math.max(0, karma.trust - 0.04)
        }
      } else {
        const a1 = state.agents.agents[result.agentIdx]
        const a2 = state.agents.agents[result.agent2Idx]
        if (playerDefected) {
          if (a1) for (let g = 0; g < defectorReturn; g++) addMiddleSegment(a1.centipede)
        } else {
          if (a2) for (let g = 0; g < defectorReturn; g++) addMiddleSegment(a2.centipede)
        }
      }

      for (const leaf of state.tree.leaves) {
        const dx = leaf.x - victimX, dy = leaf.y - victimY
        if (dx * dx + dy * dy < 200 * 200) {
          leaf.health = Math.max(0, leaf.health - 0.08)
          leaf.glowIntensity = Math.max(0, leaf.glowIntensity - 0.12)
        }
      }
      addFlash(state, defectorX, defectorY, 60, 20, 80, 100 * state.scale)

    } else if (result.type === 'mutual_defect') {
      // MUTUAL DEFECT: segments already removed at bond start.
      // Both get back 70% of their own stake. 30% lost as black dust.
      const return1 = Math.floor(result.stake1 * 0.7)
      const return2 = Math.floor(result.stake2 * 0.7)
      const dust1 = Math.ceil(result.stake1 * 0.3)
      const dust2 = Math.ceil(result.stake2 * 0.3)
      addDust(state.starField, result.playerX, result.playerY, false, dust1 * 2)
      addDust(state.starField, result.agentX, result.agentY, false, dust2 * 2)

      if (result.isPlayerBond) {
        for (let g = 0; g < return1; g++) addMiddleSegment(state.centipede)
        const a = state.agents.agents[result.agentIdx]
        if (a) for (let g = 0; g < return2; g++) addMiddleSegment(a.centipede)
        karma.hostility = Math.min(1, karma.hostility + 0.02)
        karma.corruption = Math.min(1, karma.corruption + 0.02)
      } else {
        const a1 = state.agents.agents[result.agentIdx]
        const a2 = state.agents.agents[result.agent2Idx]
        if (a1) for (let g = 0; g < return1; g++) addMiddleSegment(a1.centipede)
        if (a2) for (let g = 0; g < return2; g++) addMiddleSegment(a2.centipede)
      }

      const midX = (result.playerX + result.agentX) / 2
      const midY = (result.playerY + result.agentY) / 2
      for (const leaf of state.tree.leaves) {
        const dx = leaf.x - midX, dy = leaf.y - midY
        if (dx * dx + dy * dy < 150 * 150) {
          leaf.health = Math.max(0, leaf.health - 0.04)
          leaf.glowIntensity = Math.max(0, leaf.glowIntensity - 0.06)
        }
      }
      addFlash(state, midX, midY, 40, 20, 50, 80 * state.scale)
    }

    // --- Update agent strategy memory ---
    const updateAgentMemory = (agentIdx: number, outcome: 'cooperated' | 'was_defected' | 'defected' | 'mutual_defect', ownMove: number) => {
      const a = state.agents.agents[agentIdx]
      if (!a) return
      a.prevBondResult = a.lastBondResult
      a.lastBondResult = outcome
      a.lastOwnMove = ownMove
      a.bondCount++
      if (outcome === 'was_defected') a.everBetrayed = true
    }

    if (result.type === 'cooperate') {
      if (result.isPlayerBond) {
        updateAgentMemory(result.agentIdx, 'cooperated', result.spectrumValue > 0.5 ? 1 : 0)
      } else {
        updateAgentMemory(result.agentIdx, 'cooperated', 1)
        updateAgentMemory(result.agent2Idx, 'cooperated', 1)
      }
    } else if (result.type === 'defect') {
      if (result.isPlayerBond) {
        updateAgentMemory(result.agentIdx,
          result.spectrumValue <= 0.5 ? 'was_defected' : 'defected',
          result.spectrumValue <= 0.5 ? 1 : 0)
      } else {
        if (result.spectrumValue <= 0.5) {
          updateAgentMemory(result.agentIdx, 'defected', 0)
          updateAgentMemory(result.agent2Idx, 'was_defected', 1)
        } else {
          updateAgentMemory(result.agentIdx, 'was_defected', 1)
          updateAgentMemory(result.agent2Idx, 'defected', 0)
        }
      }
    } else if (result.type === 'mutual_defect') {
      if (result.isPlayerBond) {
        updateAgentMemory(result.agentIdx, 'mutual_defect', 0)
      } else {
        updateAgentMemory(result.agentIdx, 'mutual_defect', 0)
        updateAgentMemory(result.agent2Idx, 'mutual_defect', 0)
      }
    }

    // --- Agent death check: if any agent was a defection victim, check if they should die ---
    if (result.type === 'defect' || result.type === 'mutual_defect') {
      const checkAgentDeath = (agentIdx: number) => {
        const agent = state.agents.agents[agentIdx]
        if (!agent) return
        if (agent.centipede.segments.length <= 2) {
          // Agent dies — their life energy returns to the world as golden dust
          const head = agent.centipede.segments[0]
          if (head) {
            addDust(state.starField, head.x, head.y, true, 8) // golden burst
            // Scatter remaining segments as small dust particles
            for (const seg of agent.centipede.segments) {
              addDust(state.starField, seg.x, seg.y, true, 1)
            }
          }
          // Remove agent from system
          state.agents.agents.splice(agentIdx, 1)
        }
      }

      if (result.type === 'defect') {
        // The victim is the one who got defected ON
        if (result.isPlayerBond) {
          if (result.spectrumValue <= 0.5) {
            // Player defected — agent is the victim
            checkAgentDeath(result.agentIdx)
          }
          // If agent defected on player, player can't die this way
        } else {
          // Agent-agent: check the victim
          if (result.spectrumValue <= 0.5) {
            checkAgentDeath(result.agent2Idx) // agent2 is victim
          } else {
            checkAgentDeath(result.agentIdx) // agent1 is victim
          }
        }
      } else {
        // Mutual defect — both could die
        checkAgentDeath(result.agentIdx)
        // For agent-agent, check second agent too (use adjusted index after potential splice)
        if (!result.isPlayerBond && result.agent2Idx >= 0) {
          // If agentIdx was removed and agent2Idx was after it, adjust
          const adj = result.agent2Idx > result.agentIdx && !state.agents.agents[result.agentIdx + 1] ? result.agent2Idx - 1 : result.agent2Idx
          checkAgentDeath(adj)
        }
      }
    }
  }

  rebuildConnectionLines(state)
  checkCooperatorClusters(state, dt)
  checkSpawning(state, dt, viewportWidth, viewportHeight)
  checkTranscendence(state, dt)
  updateGrass(state, dt, viewportHeight)
  updateParticles(state, dt, viewportWidth, viewportHeight)
  updateRipples(state, dt)
  updateFlashes(state, dt)
  updateDeathParticles(state, dt)
  updateBeautyBlooms(state, dt)
  updateGroundScars(state, dt)
  updateSmoothKarma(state)
  updateLeafHealth(state.tree, dt, karma.beauty)
  updateStarField(state.starField, state.tree, karma, dt, state.time)
  updateFragments(state, dt)
  checkFragmentTriggers(state)

  // Agent spawning from healthy rain-nourished leaves
  // The world replenishes itself — healthy leaves can bud new agents
  if (state.agents.agents.length < 60 && Math.random() < 0.004) {
    const healthyLeaves = state.tree.leaves.filter(l => l.health > 0.7 && l.index > 0)
    if (healthyLeaves.length > 0) {
      const spawnLeaf = healthyLeaves[Math.floor(Math.random() * healthyLeaves.length)]
      // Karma biases which strategies emerge — good world = more prosocial strategies
      const _unused_roll = Math.random()
      const segCount = 7 + Math.floor(Math.random() * 4)
      const segments: import('./centipede').Segment[] = []
      for (let i = 0; i < segCount; i++) {
        const x = spawnLeaf.x - i * 14
        segments.push({ x, y: spawnLeaf.y, prevX: x, prevY: spawnLeaf.y })
      }
      // Strategy distribution for spawned agents mirrors world karma
      const strategies: import('./agents').AgentPersonality[] = [
        'tit_for_tat', 'generous_tft', 'generous_tft', 'forgiving_tft',
        'pavlov', 'simpleton', 'always_coop', 'detective', 'joss', 'random', 'always_defect', 'grudger',
      ]
      const strat = strategies[Math.floor(Math.random() * strategies.length)]

      state.agents.agents.push({
        centipede: {
          segments, segmentSpacing: 14, maxSegments: 80,
          currentLeaf: spawnLeaf.index, onGround: false, state: 'crawling' as const, direction: 1,
        },
        personality: strat,
        currentLeaf: spawnLeaf.index,
        targetLeaf: -1,
        goalLeaf: -1,
        hopProgress: 0,
        hopDuration: 0.8,
        thinkTimer: 0.5 + Math.random(),
        goalTimer: 0,
        phase: Math.random() * Math.PI * 2,
        state: 'wandering' as const,
        homeDepth: Math.random(),
        lastBondResult: null,
        prevBondResult: null,
        lastOwnMove: -1,
        everBetrayed: false,
        bondCount: 0,
      })
    }
  }

  periodicSave(state, dt)
}

function updateNavNodes(state: WorldState, dt: number): void {
  const { player, karma } = state
  const s = state.scale
  // Navigability strongly affects reveal radius and rate
  const navMult = karma.navigability > 0.5 ? 1 + (karma.navigability - 0.5) * 4 : karma.navigability * 0.4  // 3x at nav=1, 0.1x at nav=0
  const revealRadius = (80 + karma.navigability * 80) * s  // 2x larger glow radius
  const hintRadius = 250 * s

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
      const revealRate = (0.15 + player.patience * 0.25 + player.stillness * 0.2) * proximity * navMult
      node.revealed = Math.min(1, node.revealed + dt * revealRate)
    } else if (dist < hintRadius) {
      node.revealed = Math.max(0, node.revealed - dt * 0.03)
    } else {
      if (node.revealed > 0.2) state.nearNavNodeMissed = true
      node.revealed = Math.max(0, node.revealed - dt * 0.08)
    }
  }
}

function updateFalseBeacons(state: WorldState, dt: number): void {
  const { player, karma } = state
  const s = state.scale

  // Spawn false beacons when corruption is high enough
  if (karma.corruption > 0.3 && state.falseBeacons.length === 0 && state.time > 10) {
    const count = karma.corruption > 0.6 ? 2 : 1
    for (let i = 0; i < count; i++) {
      let bx: number, by: number, tooClose: boolean
      let attempts = 0
      do {
        bx = state.worldWidth * (0.2 + Math.random() * 0.6)
        by = state.worldHeight * (0.3 + Math.random() * 0.4)
        tooClose = state.navNodes.some(n => Math.sqrt((n.x - bx) ** 2 + (n.y - by) ** 2) < 300 * s)
        attempts++
      } while (tooClose && attempts < 20)
      state.falseBeacons.push({ x: bx, y: by, revealed: 0, phase: Math.random() * Math.PI * 2, alive: true })
    }
  }

  // Reveal/fade like nav nodes
  const revealRadius = (80 + karma.navigability * 80) * s
  for (let i = 0; i < state.falseBeacons.length; i++) {
    const fb = state.falseBeacons[i]
    if (!fb.alive) continue
    const dx = fb.x - player.x
    const dy = fb.y - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < revealRadius && player.aggression < 0.5) {
      const proximity = 1 - dist / revealRadius
      const revealRate = (0.15 + player.patience * 0.25 + player.stillness * 0.2) * proximity
      fb.revealed = Math.min(1, fb.revealed + dt * revealRate)
    } else if (dist < 200 * s) {
      fb.revealed = Math.max(0, fb.revealed - dt * 0.03)
    } else {
      fb.revealed = Math.max(0, fb.revealed - dt * 0.08)
    }
  }
}

export function findFalseBeaconAt(state: WorldState, x: number, y: number): number {
  const hitRadius = 35 * state.scale
  for (let i = 0; i < state.falseBeacons.length; i++) {
    const fb = state.falseBeacons[i]
    if (!fb.alive || fb.revealed < 0.95) continue
    const dx = fb.x - x
    const dy = fb.y - y
    if (Math.sqrt(dx * dx + dy * dy) < hitRadius) return i
  }
  return -1
}

export function triggerFalseBeaconTrap(state: WorldState, index: number): void {
  const fb = state.falseBeacons[index]
  fb.alive = false
  state.player.energy = Math.max(0, state.player.energy - 0.2)
  state.karma.corruption = Math.min(1, state.karma.corruption + 0.05)
  addFlash(state, fb.x, fb.y, 90, 130, 60, 120 * state.scale)
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

function killEntity(state: WorldState, e: Entity): void {
  if (!e.alive) return
  e.alive = false
  state.worldEvents.entityDeath = true

  const col = ENTITY_COLORS[e.kind]
  const count = Math.min(12, 20 - state.deathParticles.length)

  for (let j = 0; j < count; j++) {
    const angle = (j / count) * Math.PI * 2 + Math.random() * 0.3
    const speed = 1.5 + Math.random() * 3
    state.deathParticles.push({
      x: e.x, y: e.y,
      vx: Math.cos(angle) * speed * state.scale,
      vy: Math.sin(angle) * speed * state.scale,
      alpha: 0.8 + Math.random() * 0.2,
      r: col.r, g: col.g, b: col.b,
      radius: (1.5 + Math.random() * 2) * state.scale,
    })
  }

  if (state.groundScars.length < 15) {
    state.groundScars.push({
      x: e.x, y: e.y,
      alpha: 0.6,
      radius: (e.radius + 10) * state.scale,
      dark: true,
    })
  }

  addFlash(state, e.x, e.y, col.r, col.g, col.b, 40)
}

function updateEntities(state: WorldState, dt: number, _viewportWidth: number, _viewportHeight: number): void {
  const { player, mood, karma } = state
  const s = state.scale
  const time = state.time

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

      // Transcendence pull
      if (state.transcendenceActive && dist < 400 * s) {
        seekX += nx * 0.5
        seekY += ny * 0.5
      }

      if (e.kind === 'wanderer') {
        if (dist < 200 * s && e.trust > 0.5) {
          seekX += nx * 0.1 * e.trust
          seekY += ny * 0.1 * e.trust
        }
      } else if (e.kind === 'fragile') {
        if (player.energy > 1.5 && dist < 220 * s) {
          // Fragile flee from overwhelming presence
          const fearMult = (player.energy - 1.5) * 0.4
          seekX -= nx * fearMult
          seekY -= ny * fearMult
        } else if (player.aggression > 0.4 && dist < 180 * s) {
          seekX -= nx * 0.4
          seekY -= ny * 0.4
        } else if (player.energy >= 0.2 && player.stillness > 0.5 && dist < 150 * s) {
          seekX += nx * 0.08
          seekY += ny * 0.08
        }
      } else if (e.kind === 'cooperator') {
        if (dist < 250 * s) {
          const attraction = 0.25 + karma.trust * 0.20
          seekX += nx * attraction
          seekY += ny * attraction
        }
        const coopRange = 200 * s
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind !== 'cooperator') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          if (Math.abs(odx) > coopRange || Math.abs(ody) > coopRange) continue
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < coopRange && odist > 20 * s) {
            seekX += (odx / odist) * 0.10
            seekY += (ody / odist) * 0.10
          }
        }
      } else if (e.kind === 'defector') {
        if (player.energy > 1.5 && dist < 300 * s) {
          // Defectors are ATTRACTED to power — drawn to feast
          const greedMult = (player.energy - 1.5) * 0.3
          seekX += nx * greedMult
          seekY += ny * greedMult
        } else if (dist < 200 * s) {
          seekX -= nx * 0.25
          seekY -= ny * 0.25
        }
        const huntRange = 250 * s
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind !== 'fragile') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          if (Math.abs(odx) > huntRange || Math.abs(ody) > huntRange) continue
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < huntRange && odist > 15 * s) {
            seekX += (odx / odist) * 0.40
            seekY += (ody / odist) * 0.40
          }
          if (odist < 30 * s) {
            other.energy = Math.max(0, other.energy - dt * 0.35)
            e.energy = Math.min(1, e.energy + dt * 0.10)
            e.radius = Math.min(e.radius * 1.003, 15 * state.scale)
            karma.hostility = Math.min(1, karma.hostility + dt * 0.005)
            if (other.energy <= 0) {
              killEntity(state, other)
              addFlash(state, e.x, e.y, 255, 40, 30, 120 * s)
            }
          }
        }
      } else if (e.kind === 'corruptor') {
        seekX += Math.sin(time * 0.15 + e.phase) * 0.1
        seekY += Math.cos(time * 0.12 + e.phase * 1.5) * 0.08
        const corruptRange = 120 * s
        for (let j = 0; j < state.entities.length; j++) {
          if (j === i) continue
          const other = state.entities[j]
          if (!other.alive || other.kind === 'corruptor') continue
          const odx = other.x - e.x
          const ody = other.y - e.y
          if (Math.abs(odx) > corruptRange || Math.abs(ody) > corruptRange) continue
          const odist = Math.sqrt(odx * odx + ody * ody)
          if (odist < corruptRange) {
            const prevCorruption = other.corruption
            other.corruption = Math.min(1, other.corruption + dt * 0.06 * e.corruption)
            other.beauty = Math.max(0, other.beauty - dt * 0.025)
            state.worldEvents.corruptionSpread = true
            if (prevCorruption < 0.1 && other.corruption >= 0.1) {
              addFlash(state, other.x, other.y, 100, 160, 50, 80 * s)
            }
          }
        }
      }
    }

    const baseSpeed = e.kind === 'corruptor' ? 0.3 : e.kind === 'fragile' ? 0.4 : 0.6
    const speed = state.reducedMotion ? baseSpeed * 0.5 : baseSpeed
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

    const margin = 50 * s
    if (e.x < margin) e.vx += dt * 2
    if (e.x > state.worldWidth - margin) e.vx -= dt * 2
    if (e.y < margin) e.vy += dt * 2
    if (e.y > state.worldHeight - margin) e.vy -= dt * 2

    if (e.kind === 'fragile') {
      e.energy = Math.max(0, e.energy - dt * 0.015)
      if (e.energy <= 0) killEntity(state, e)
    }
  }
}

// Rebuild connection lines each frame
function rebuildConnectionLines(state: WorldState): void {
  state.connectionLines.length = 0
  const s = state.scale
  const entities = state.entities
  const player = state.player

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    if (!e.alive) continue

    if (e.kind === 'cooperator') {
      const coopLineDist = 140 * s
      for (let j = i + 1; j < entities.length; j++) {
        const other = entities[j]
        if (!other.alive || other.kind !== 'cooperator') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        if (Math.abs(dx) > coopLineDist || Math.abs(dy) > coopLineDist) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < coopLineDist) {
          const alpha = (1 - dist / (140 * s)) * 0.5 * Math.min(e.energy, other.energy)
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'cooperate',
          })
        }
      }
    }

    if (e.kind === 'defector') {
      const huntLineDist = 120 * s
      for (let j = 0; j < entities.length; j++) {
        const other = entities[j]
        if (!other.alive || other.kind !== 'fragile') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        if (Math.abs(dx) > huntLineDist || Math.abs(dy) > huntLineDist) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < huntLineDist) {
          const alpha = Math.max(0.3, (1 - dist / (120 * s)) * 0.5 * e.hostility)
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'hunt',
          })
        }
      }
    }

    if (e.kind === 'corruptor') {
      const corruptLineDist = 100 * s
      for (let j = 0; j < entities.length; j++) {
        if (j === i) continue
        const other = entities[j]
        if (!other.alive || other.kind === 'corruptor') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        if (Math.abs(dx) > corruptLineDist || Math.abs(dy) > corruptLineDist) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < corruptLineDist) {
          const alpha = Math.max(0.2, (1 - dist / (100 * s)) * 0.3 * e.corruption)
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'corrupt',
          })
        }
      }
    }
  }

  // Player-cooperator constellation lines — player participates in cooperation
  if (player.alive && player.stillness > 0.3) {
    const playerCoopDist = 150 * s
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]
      if (!e.alive) continue
      if (e.kind !== 'fragile' && e.kind !== 'cooperator') continue
      const dx = e.x - player.x
      const dy = e.y - player.y
      if (Math.abs(dx) > playerCoopDist || Math.abs(dy) > playerCoopDist) continue
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < playerCoopDist) {
        const alpha = (1 - dist / playerCoopDist) * 0.4 * player.stillness
        state.connectionLines.push({
          x1: player.x, y1: player.y, x2: e.x, y2: e.y,
          alpha, kind: e.kind === 'cooperator' ? 'cooperate' : 'nourish',
        })
      }
    }
  }
}

function checkCooperatorClusters(state: WorldState, dt: number): void {
  if (state.time - state.lastBloomTime < 4) return
  const checkInterval = 2
  if (Math.floor(state.time / checkInterval) === Math.floor((state.time - dt) / checkInterval)) return

  const s = state.scale
  const clusterRadius = 120 * s
  const entities = state.entities

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    if (!e.alive || e.kind !== 'cooperator') continue

    const nearby: number[] = [i]
    for (let j = 0; j < entities.length; j++) {
      if (j === i) continue
      const other = entities[j]
      if (!other.alive || other.kind !== 'cooperator') continue
      const dx = other.x - e.x
      const dy = other.y - e.y
      if (Math.sqrt(dx * dx + dy * dy) < clusterRadius) {
        nearby.push(j)
      }
    }

    // Count player as cluster participant if nearby, still, and patient
    const playerDx = state.player.x - e.x
    const playerDy = state.player.y - e.y
    const playerInCluster = state.player.alive && state.player.stillness > 0.4 &&
      Math.sqrt(playerDx * playerDx + playerDy * playerDy) < clusterRadius
    const clusterSize = nearby.length + (playerInCluster ? 1 : 0)

    if (clusterSize >= 2) {
      let cx = 0, cy = 0
      for (const idx of nearby) {
        cx += entities[idx].x
        cy += entities[idx].y
      }
      if (playerInCluster) {
        cx += state.player.x
        cy += state.player.y
      }
      cx /= clusterSize
      cy /= clusterSize

      addBeautyBloom(state, cx, cy, 280)
      state.lastBloomTime = state.time

      for (const idx of nearby) {
        entities[idx].beauty = Math.min(1, entities[idx].beauty + 0.05)
        entities[idx].energy = Math.min(1, entities[idx].energy + 0.03)
      }
      state.karma.beauty = Math.min(1, state.karma.beauty + 0.02)

      // Emit golden dust from cooperator clusters — feeds the star cycle
      addDust(state.starField, cx, cy, true, 5 + clusterSize * 2)

      // Chance of ascension — cooperator becomes a star directly
      const skyY = state.tree.originY - state.tree.height - 100
      if (state.starField.stars.length < 12 && nearby.length >= 3 && Math.random() < 0.25) {
        state.worldEvents.starFormed = true
        const ascIdx = nearby[Math.floor(Math.random() * nearby.length)]
        const asc = entities[ascIdx]
        state.starField.stars.push({
          x: asc.x,
          y: Math.min(skyY, asc.y - 200 - Math.random() * 200),
          brightness: 0.8,
          life: 1.0,
          phase: Math.random() * Math.PI * 2,
          birthTime: state.time,
          lifespan: 30 + Math.random() * 30,
          rainTimer: 0,
        })
        const col = ENTITY_COLORS.cooperator
        for (let p = 0; p < 8; p++) {
          const angle = (p / 8) * Math.PI * 2
          if (state.deathParticles.length < 20) {
            state.deathParticles.push({
              x: asc.x, y: asc.y,
              vx: Math.cos(angle) * 1.5 * s,
              vy: -2 * s - Math.random() * 3 * s,
              alpha: 1,
              r: Math.min(255, col.r + 60), g: Math.min(255, col.g + 40), b: Math.min(255, col.b + 60),
              radius: 2 * s,
            })
          }
        }
        asc.alive = false

        if (state.groundScars.length < 15) {
          state.groundScars.push({
            x: asc.x, y: asc.y,
            alpha: 0.5, radius: 15 * s, dark: false,
          })
        }
      }

      break
    }
  }
}

function checkSpawning(state: WorldState, dt: number, _viewportWidth: number, _viewportHeight: number): void {
  const interval = 3
  if (state.time - state.lastSpawnTime < interval) return
  if (Math.floor(state.time / interval) === Math.floor((state.time - dt) / interval)) return

  const alive = state.entities.filter(e => e.alive)
  if (alive.length >= 30) return

  state.lastSpawnTime = state.time
  const s = state.scale
  const karma = state.karma

  if (karma.beauty > 0.5 && Math.random() < 0.3) {
    const coops = alive.filter(e => e.kind === 'cooperator')
    if (coops.length > 0) {
      const parent = coops[Math.floor(Math.random() * coops.length)]
      state.entities.push({
        id: `fragile-spawn-${state.entityIdCounter++}`,
        kind: 'fragile',
        x: parent.x + (Math.random() - 0.5) * 40 * s,
        y: parent.y + (Math.random() - 0.5) * 40 * s,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        radius: 4 * s,
        energy: 0.4 + Math.random() * 0.2,
        trust: 0.3, hostility: 0.1, corruption: 0, beauty: 0.3,
        alive: true, phase: Math.random() * Math.PI * 2,
      })
      addFlash(state, parent.x, parent.y, 220, 180, 120, 30)
    }
  }

  if (karma.corruption > 0.5 && Math.random() < 0.25) {
    const corrs = alive.filter(e => e.kind === 'corruptor')
    if (corrs.length > 0 && corrs.length < 5) {
      const parent = corrs[Math.floor(Math.random() * corrs.length)]
      state.entities.push({
        id: `corruptor-spawn-${state.entityIdCounter++}`,
        kind: 'corruptor',
        x: parent.x + (Math.random() - 0.5) * 60 * s,
        y: parent.y + (Math.random() - 0.5) * 60 * s,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.15,
        radius: 9 * s,
        energy: 0.6 + Math.random() * 0.3,
        trust: 0.1, hostility: 0.7, corruption: 0.5 + Math.random() * 0.3, beauty: 0,
        alive: true, phase: Math.random() * Math.PI * 2,
      })
    }
  }

  if (alive.length < 12 && Math.random() < 0.5) {
    state.entities.push({
      id: `wanderer-spawn-${state.entityIdCounter++}`,
      kind: 'wanderer',
      x: Math.random() * state.worldWidth * 0.8 + state.worldWidth * 0.1,
      y: Math.random() * state.worldHeight * 0.6 + state.worldHeight * 0.2,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      radius: 6 * s,
      energy: 0.6 + Math.random() * 0.3,
      trust: 0.4, hostility: 0.1, corruption: 0, beauty: 0.1,
      alive: true, phase: Math.random() * Math.PI * 2,
    })
  }
}

function checkTranscendence(state: WorldState, dt: number): void {
  const { player, karma } = state

  if (state.transcendenceCooldown > 0) {
    state.transcendenceCooldown -= dt
    return
  }

  if (state.transcendenceActive) {
    state.transcendenceTimer -= dt
    if (state.transcendenceTimer <= 0) {
      state.transcendenceActive = false
      player.energy = 1
      player.glowBoost = Math.min(0.5, player.glowBoost + 0.15)
      state.transcendenceCooldown = 60
      addBeautyBloom(state, player.x, player.y, 300)
      karma.beauty = Math.min(1, karma.beauty + 0.05)
      karma.trust = Math.min(1, karma.trust + 0.03)
    }
    return
  }

  if (karma.beauty > 0.85 && karma.trust > 0.85 && player.patience > 0.7) {
    state.transcendenceTimer += dt
    if (state.transcendenceTimer >= 30) {
      state.transcendenceActive = true
      state.transcendenceTimer = 4
      state.worldEvents.transcendence = true
      addBeautyBloom(state, player.x, player.y, 250)
      addFlash(state, player.x, player.y, 200, 240, 255, 150)
    }
  } else {
    state.transcendenceTimer = Math.max(0, state.transcendenceTimer - dt * 2)
  }
}

function updateDeathParticles(state: WorldState, _dt: number): void {
  for (let i = state.deathParticles.length - 1; i >= 0; i--) {
    const p = state.deathParticles[i]
    p.x += p.vx
    p.y += p.vy
    p.vx *= 0.96
    p.vy *= 0.96
    p.alpha *= 0.90
    if (p.alpha < 0.02) {
      state.deathParticles.splice(i, 1)
    }
  }
}

function updateBeautyBlooms(state: WorldState, dt: number): void {
  for (let i = state.beautyBlooms.length - 1; i >= 0; i--) {
    const b = state.beautyBlooms[i]
    b.radius += dt * 80 * state.scale
    b.alpha *= 0.96
    if (b.alpha < 0.01 || b.radius > b.maxRadius) {
      state.beautyBlooms.splice(i, 1)
    }
  }
}

function updateGroundScars(state: WorldState, _dt: number): void {
  for (let i = state.groundScars.length - 1; i >= 0; i--) {
    const scar = state.groundScars[i]
    scar.alpha *= 0.995
    if (scar.alpha < 0.02) {
      state.groundScars.splice(i, 1)
    }
  }
}

function addBeautyBloom(state: WorldState, x: number, y: number, maxR: number): void {
  if (state.beautyBlooms.length >= 5) return
  state.worldEvents.beautyBloom = true
  state.beautyBlooms.push({
    x, y,
    radius: 5 * state.scale,
    maxRadius: maxR * state.scale,
    alpha: 0.6,
    hue: 160 + Math.random() * 30,
  })
}

function updateGrass(state: WorldState, _dt: number, _viewportHeight: number): void {
  const { player, mood, entities } = state
  const s = state.scale
  const animSpeed = state.reducedMotion ? 0 : 1
  const windTime = state.time * (0.6 + mood.windStrength * 1.0)

  // Cache corruptors once per frame for dead zone checks
  const corruptors: Array<{x: number, y: number, corruption: number}> = []
  for (let ci = 0; ci < entities.length; ci++) {
    const ce = entities[ci]
    if (ce.kind === 'corruptor' && ce.alive) corruptors.push(ce)
  }
  const dzRange = 120 * s
  const dzRangeSq = dzRange * dzRange

  for (let i = 0; i < state.grass.length; i++) {
    const blade = state.grass[i]
    const wind1 = Math.sin(windTime + blade.phase) * (0.2 + mood.windStrength * 0.15) * animSpeed
    const wind2 = Math.sin(windTime * 0.7 + blade.phase * 1.3 + 1.2) * 0.08 * animSpeed
    const wind3 = Math.sin(windTime * 0.3 + blade.x * 0.003) * 0.06 * animSpeed
    const wind = wind1 + wind2 + wind3

    const dx = blade.x - player.x
    const dy = (state.worldHeight - blade.baseHeight * 0.5) - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const bendRadius = 150 * s

    let playerBend = 0
    if (dist < bendRadius) {
      const force = (1 - dist / bendRadius) * 0.7 * (1 + state.mouseSmoothed * 0.1)
      playerBend = (dx > 0 ? 1 : -1) * force
    }

    const targetBend = wind + playerBend + blade.lean
    blade.bend += (targetBend - blade.bend) * 0.12

    // Dead zone: grass near corruptors turns gray/brown
    let dz = 0
    for (let ci = 0; ci < corruptors.length; ci++) {
      const ce = corruptors[ci]
      const cdx = blade.x - ce.x
      if (Math.abs(cdx) > dzRange) continue
      const cdy = (state.worldHeight - blade.baseHeight) - ce.y
      if (Math.abs(cdy) > dzRange) continue
      const cdistSq = cdx * cdx + cdy * cdy
      if (cdistSq < dzRangeSq) {
        dz = Math.max(dz, (1 - Math.sqrt(cdistSq) / dzRange) * ce.corruption)
      }
    }
    blade.deadZone = dz

    // Nav glow: grass near hidden nav nodes glows warmer
    let ng = 0
    const navRange = 100 * s
    const navRangeSq = navRange * navRange
    for (let n = 0; n < state.navNodes.length; n++) {
      const node = state.navNodes[n]
      const ndx = blade.x - node.x
      if (Math.abs(ndx) > navRange) continue
      const ndy = (state.worldHeight - blade.baseHeight) - node.y
      if (Math.abs(ndy) > navRange) continue
      const ndistSq = ndx * ndx + ndy * ndy
      if (ndistSq < navRangeSq) {
        ng = Math.max(ng, (1 - Math.sqrt(ndistSq) / navRange) * 0.3)
      }
    }
    blade.navGlow = ng
  }
}

function updateParticles(state: WorldState, _dt: number, _viewportWidth: number, _viewportHeight: number): void {
  const { player, mood } = state
  const s = state.scale
  const ww = state.worldWidth
  const wh = state.worldHeight

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

    if (p.x < -20) p.x = ww + 20
    if (p.x > ww + 20) p.x = -20
    if (p.y < -20) p.y = wh + 20
    if (p.y > wh + 20) p.y = -20
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

function updateSmoothKarma(state: WorldState): void {
  const lerpRate = 0.15 // fast tracking — world reacts in 2-3 seconds
  const sk = state.smoothKarma
  const k = state.karma
  sk.beauty += (k.beauty - sk.beauty) * lerpRate
  sk.trust += (k.trust - sk.trust) * lerpRate
  sk.hostility += (k.hostility - sk.hostility) * lerpRate
  sk.corruption += (k.corruption - sk.corruption) * lerpRate
  sk.navigability += (k.navigability - sk.navigability) * lerpRate
}

function updateFragments(state: WorldState, dt: number): void {
  for (let i = state.fragments.length - 1; i >= 0; i--) {
    const f = state.fragments[i]
    f.lifetime -= dt
    f.x += f.drift * dt

    if (f.lifetime > 8) {
      f.phase = 'fadein'
      f.alpha = f.maxAlpha * ((10 - f.lifetime) / 2) // 0→maxAlpha over 2s
    } else if (f.lifetime > 3) {
      f.phase = 'hold'
      f.alpha = f.maxAlpha
    } else {
      f.phase = 'fadeout'
      f.alpha = f.maxAlpha * (f.lifetime / 3) // maxAlpha→0 over 3s
    }

    if (f.lifetime <= 0 || f.alpha < 0.01) {
      state.fragments.splice(i, 1)
    }
  }
}

function spawnFragment(state: WorldState, text: string): void {
  if (state.fragments.length > 0) return
  if (state.shownFragments.has(text)) return
  if (state.time - state.lastFragmentTime < 45) return
  if (!state.player.alive) return

  state.shownFragments.add(text)
  state.lastFragmentTime = state.time
  state.fragments.push({
    text,
    x: state.player.x + (Math.random() - 0.5) * 200,
    y: state.player.y - 60 + (Math.random() - 0.5) * 60,
    alpha: 0,
    maxAlpha: 0.25,
    lifetime: 10,
    phase: 'fadein',
    drift: (Math.random() - 0.5) * 0.15,
  })
}

function checkFragmentTriggers(state: WorldState): void {
  if (state.fragments.length > 0) return
  if (!state.player.alive) return

  const { karma, time, navNodes, player } = state
  const anyRevealed = navNodes.some(n => n.revealed > 0.5)
  const anyFound = navNodes.some(n => n.revealed >= 1.0)

  if (karma.totalVisits <= 1 && time < 5) {
    spawnFragment(state, 'arrival is a disturbance')
  } else if (karma.totalVisits > 1 && time < 8) {
    spawnFragment(state, 'the field remembers')
  }

  if (time > 15 && !anyRevealed) {
    spawnFragment(state, 'look closer')
  }

  if (state.nearNavNodeMissed) {
    spawnFragment(state, 'not everything surfaces')
    state.nearNavNodeMissed = false
  }

  if (time > 40 && !anyFound) {
    spawnFragment(state, 'some paths only appear when disturbed')
  }

  if (karma.beauty > 0.6 && player.stillness > 0.6) {
    spawnFragment(state, 'memory made a shelter')
  }

  // 5+ entities within 200px
  let nearbyCount = 0
  const s = state.scale
  for (let i = 0; i < state.entities.length; i++) {
    const e = state.entities[i]
    if (!e.alive) continue
    const dx = e.x - player.x
    const dy = e.y - player.y
    if (dx * dx + dy * dy < (200 * s) * (200 * s)) nearbyCount++
  }
  if (nearbyCount >= 5 && karma.trust < 0.3) {
    spawnFragment(state, 'density is not intimacy')
  }

  if (player.aggression > 0.6) {
    spawnFragment(state, 'contact increases; meaning does not')
  }

  if (anyFound) {
    spawnFragment(state, 'leave with what you find')
  }

  if (player.aggression > 0.5 && karma.beauty < 0.3) {
    spawnFragment(state, 'not every system wants optimization')
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
    x, y,
    radius: 5 * state.scale,
    maxRadius: (150 + state.karma.beauty * 100) * state.scale,
    alpha: 0.5 + state.karma.beauty * 0.3,
  })
}

export function addFlash(state: WorldState, x: number, y: number, r: number, g: number, b: number, size?: number): void {
  const s = state.scale
  state.flashes.push({
    x, y, r, g, b,
    radius: 5 * s,
    maxRadius: (size ?? 60) * s,
    alpha: 0.8,
  })
}
