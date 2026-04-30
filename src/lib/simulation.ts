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

export type Star = {
  x: number
  y: number
  brightness: number
  phase: number
}

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

export type WorldState = {
  player: Player
  entities: Entity[]
  particles: Particle[]
  grass: GrassBlade[]
  ripples: Ripple[]
  flashes: Flash[]
  navNodes: NavNode[]
  stars: Star[]
  deathParticles: DeathParticle[]
  beautyBlooms: BeautyBloom[]
  connectionLines: ConnectionLine[]
  groundScars: GroundScar[]
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
  }
  mouseSpeed: number
  mouseSmoothed: number
  time: number
  scale: number
  lastClickTime: number
  clickCooldown: number
  lastBloomTime: number
  lastSpawnTime: number
  transcendenceTimer: number
  transcendenceActive: boolean
  transcendenceCooldown: number
  entityIdCounter: number
}

export const ENTITY_COLORS: Record<EntityKind, { r: number; g: number; b: number; hue: number }> = {
  wanderer:   { r: 100, g: 200, b: 220, hue: 190 },
  fragile:    { r: 220, g: 180, b: 120, hue: 35 },
  cooperator: { r: 80,  g: 220, b: 180, hue: 160 },
  defector:   { r: 240, g: 100, b: 60,  hue: 15 },
  corruptor:  { r: 130, g: 150, b: 110, hue: 90 },
}

function spawnEntities(width: number, height: number, scale: number): Entity[] {
  const area = width * height
  const baseCount = 32
  const countScale = Math.max(0.5, Math.min(1.5, area / (1920 * 1080 * 4)))
  const total = Math.floor(baseCount * countScale)

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
    const radiusBase = kind === 'fragile' ? 4 : kind === 'cooperator' ? 8 : kind === 'corruptor' ? 9 : kind === 'defector' ? 10 : 6
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

  const noteX = firstVisit
    ? width * (0.3 + Math.random() * 0.1)
    : width * (margin + Math.random() * (1 - margin * 2))
  const noteY = firstVisit
    ? height * (0.35 + Math.random() * 0.1)
    : height * (0.2 + Math.random() * 0.4)

  const artX = firstVisit
    ? width * (0.65 + Math.random() * 0.1)
    : width * (margin + Math.random() * (1 - margin * 2))
  const artY = firstVisit
    ? height * (0.4 + Math.random() * 0.1)
    : height * (0.2 + Math.random() * 0.4)

  const bioX = width * (0.45 + Math.random() * 0.1)
  const bioY = height * (0.45 + Math.random() * 0.1)

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

  // World is larger than viewport
  const worldWidth = viewportWidth * 3
  const worldHeight = viewportHeight * 2

  const area = worldWidth * worldHeight
  const densityScale = Math.min(1, area / (1920 * 1080 * 4))
  const isMobile = 'ontouchstart' in window || window.innerWidth < 768
  const mobileScale = isMobile ? 0.6 : 1
  const grassCount = Math.floor((180 + mood.grassDensity * 70) * densityScale * mobileScale)
  const particleCount = Math.floor((35 + mood.driftSpeed * 15) * densityScale * mobileScale)

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

  const entities = spawnEntities(worldWidth, worldHeight, scale)
  const navNodes = createNavNodes(worldWidth, worldHeight, karma)

  // Player starts at center of world
  const startX = worldWidth / 2
  const startY = worldHeight / 2

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
    entities,
    particles,
    grass,
    ripples: [],
    flashes: [],
    navNodes,
    stars: [],
    deathParticles: [],
    beautyBlooms: [],
    connectionLines: [],
    groundScars: [],
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
    },
    mouseSpeed: 0,
    mouseSmoothed: 0,
    time: 0,
    scale,
    lastClickTime: 0,
    clickCooldown: 0.3,
    lastBloomTime: 0,
    lastSpawnTime: 0,
    transcendenceTimer: 0,
    transcendenceActive: false,
    transcendenceCooldown: 0,
    entityIdCounter: entities.length,
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

  if (!player.alive && player.emberVisible) {
    const edx = x - player.emberX
    const edy = y - player.emberY
    if (Math.sqrt(edx * edx + edy * edy) < 40 * state.scale) {
      player.alive = true
      player.energy = 0.3
      player.deathTime = 0
      player.emberVisible = false
      karma.corruption = Math.min(1, karma.corruption + 0.05)

      // Revival — gentle pull on nearby entities
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
      e.radius = Math.min(e.radius * 1.08, 8 * state.scale)
      karma.beauty = Math.min(1, karma.beauty + 0.02)
      karma.generosity = Math.min(1, karma.generosity + 0.03)
      karma.trust = Math.min(1, karma.trust + 0.01)
      addBeautyBloom(state, e.x, e.y, 80)
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
        state.worldEvents.cleanseSuccess = true

        // Dramatic cleanse bloom — large area restoration
        addBeautyBloom(state, e.x, e.y, 200)

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
        // Corruption pulse outward on fail
        addFlash(state, e.x, e.y, 80, 100, 60, 120 * state.scale)
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

  // Update camera — follow player when near edge (20% threshold)
  const edgeX = viewportWidth * 0.2
  const edgeY = viewportHeight * 0.2
  const playerScreenX = player.x - camera.x
  const playerScreenY = player.y - camera.y

  let targetCamX = camera.x
  let targetCamY = camera.y

  if (playerScreenX < edgeX) targetCamX = player.x - edgeX
  else if (playerScreenX > viewportWidth - edgeX) targetCamX = player.x - (viewportWidth - edgeX)

  if (playerScreenY < edgeY) targetCamY = player.y - edgeY
  else if (playerScreenY > viewportHeight - edgeY) targetCamY = player.y - (viewportHeight - edgeY)

  // Clamp camera to world bounds
  targetCamX = Math.max(0, Math.min(state.worldWidth - viewportWidth, targetCamX))
  targetCamY = Math.max(0, Math.min(state.worldHeight - viewportHeight, targetCamY))

  // Smooth lerp
  camera.x += (targetCamX - camera.x) * 0.08
  camera.y += (targetCamY - camera.y) * 0.08

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

    updateEntities(state, dt, viewportWidth, viewportHeight)
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
    periodicSave(state, dt)
    return
  }

  // Player follows mouse
  const lerpFactor = 0.12
  player.x += (player.targetX - player.x) * lerpFactor
  player.y += (player.targetY - player.y) * lerpFactor

  const s = state.scale
  player.aura = (25 + Math.sin(state.time * 2) * 8 + player.energy * 15) * s

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

  karma.beauty += (player.patience - 0.5) * dt * 0.018
  karma.trust += (player.stillness - player.aggression) * dt * 0.012
  karma.hostility += (player.aggression - 0.3) * dt * 0.015
  karma.navigability = Math.max(0, Math.min(1,
    karma.beauty * 0.3 + karma.trust * 0.3 - karma.hostility * 0.2 - karma.corruption * 0.2 + 0.3
  ))

  karma.beauty = Math.max(0, Math.min(1, karma.beauty))
  karma.trust = Math.max(0, Math.min(1, karma.trust))
  karma.hostility = Math.max(0, Math.min(1, karma.hostility))
  karma.navigability = Math.max(0, Math.min(1, karma.navigability))
  karma.corruption = Math.max(0, Math.min(1, karma.corruption))
  karma.patience = player.patience

  karma.hostility = Math.max(0, karma.hostility - dt * 0.004 * player.patience)

  if (player.stillness > 0.6) {
    player.energy = Math.min(1, player.energy + dt * 0.003)
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

    // Entities scatter on player death
    for (let i = 0; i < state.entities.length; i++) {
      const e = state.entities[i]
      if (!e.alive) continue
      const dx = e.x - player.x
      const dy = e.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 250 * s && dist > 0) {
        const force = (1 - dist / (250 * s)) * 3
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
  updateEntityHoverInteractions(state, dt)
  updateEntities(state, dt, viewportWidth, viewportHeight)
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
      const revealRate = (0.15 + player.patience * 0.25 + player.stillness * 0.2) * proximity
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
        if (player.aggression > 0.4 && dist < 180 * s) {
          seekX -= nx * 0.4
          seekY -= ny * 0.4
        } else if (player.stillness > 0.5 && dist < 150 * s) {
          seekX += nx * 0.08
          seekY += ny * 0.08
        }
      } else if (e.kind === 'cooperator') {
        if (dist < 250 * s) {
          const attraction = 0.25 + karma.trust * 0.20
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
          if (odist < 200 * s && odist > 20 * s) {
            seekX += (odx / odist) * 0.10
            seekY += (ody / odist) * 0.10
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
          if (odist < 250 * s && odist > 15 * s) {
            seekX += (odx / odist) * 0.20
            seekY += (ody / odist) * 0.20
          }
          if (odist < 30 * s) {
            other.energy = Math.max(0, other.energy - dt * 0.14)
            e.energy = Math.min(1, e.energy + dt * 0.06)
            e.radius = Math.min(e.radius * 1.001, 15 * state.scale)
            karma.hostility = Math.min(1, karma.hostility + dt * 0.003)
            if (other.energy <= 0) killEntity(state, other)
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
          if (odist < 120 * s) {
            other.corruption = Math.min(1, other.corruption + dt * 0.018 * e.corruption)
            other.beauty = Math.max(0, other.beauty - dt * 0.008)
            state.worldEvents.corruptionSpread = true
          }
        }
      }
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

    const margin = 50 * s
    if (e.x < margin) e.vx += dt * 2
    if (e.x > state.worldWidth - margin) e.vx -= dt * 2
    if (e.y < margin) e.vy += dt * 2
    if (e.y > state.worldHeight - margin) e.vy -= dt * 2

    if (e.kind === 'fragile') {
      e.energy = Math.max(0, e.energy - dt * 0.003)
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
      for (let j = i + 1; j < entities.length; j++) {
        const other = entities[j]
        if (!other.alive || other.kind !== 'cooperator') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 140 * s) {
          const alpha = (1 - dist / (140 * s)) * 0.3 * Math.min(e.energy, other.energy)
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'cooperate',
          })
        }
      }
    }

    if (e.kind === 'defector') {
      for (let j = 0; j < entities.length; j++) {
        const other = entities[j]
        if (!other.alive || other.kind !== 'fragile') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120 * s) {
          const alpha = (1 - dist / (120 * s)) * 0.4 * e.hostility
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'hunt',
          })
        }
      }
    }

    if (e.kind === 'corruptor') {
      for (let j = 0; j < entities.length; j++) {
        if (j === i) continue
        const other = entities[j]
        if (!other.alive || other.kind === 'corruptor') continue
        const dx = other.x - e.x
        const dy = other.y - e.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 100 * s) {
          const alpha = (1 - dist / (100 * s)) * 0.25 * e.corruption
          state.connectionLines.push({
            x1: e.x, y1: e.y, x2: other.x, y2: other.y,
            alpha, kind: 'corrupt',
          })
        }
      }
    }
  }

  // Nourish lines from player
  if (player.alive && player.stillness > 0.3) {
    const hoverRadius = 80 * s
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i]
      if (!e.alive) continue
      if (e.kind !== 'fragile' && e.kind !== 'cooperator') continue
      const dx = e.x - player.x
      const dy = e.y - player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < hoverRadius) {
        const alpha = (1 - dist / hoverRadius) * 0.25 * player.stillness
        state.connectionLines.push({
          x1: player.x, y1: player.y, x2: e.x, y2: e.y,
          alpha, kind: 'nourish',
        })
      }
    }
  }
}

function checkCooperatorClusters(state: WorldState, dt: number): void {
  if (state.time - state.lastBloomTime < 15) return
  const checkInterval = 3
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

    if (nearby.length >= 3) {
      let cx = 0, cy = 0
      for (const idx of nearby) {
        cx += entities[idx].x
        cy += entities[idx].y
      }
      cx /= nearby.length
      cy /= nearby.length

      addBeautyBloom(state, cx, cy, 280)
      state.lastBloomTime = state.time

      for (const idx of nearby) {
        entities[idx].beauty = Math.min(1, entities[idx].beauty + 0.05)
        entities[idx].energy = Math.min(1, entities[idx].energy + 0.03)
      }
      state.karma.beauty = Math.min(1, state.karma.beauty + 0.02)

      // Chance of ascension
      if (state.stars.length < 15 && Math.random() < 0.15) {
        state.worldEvents.starFormed = true
        const ascIdx = nearby[Math.floor(Math.random() * nearby.length)]
        const asc = entities[ascIdx]
        state.stars.push({
          x: asc.x,
          y: Math.min(asc.y, s * 100 + Math.random() * s * 150),
          brightness: 0.7 + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
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
  const interval = 8
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
    const dy = (state.worldHeight - blade.baseHeight * 0.5) - player.y
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
  const lerpRate = 0.02 // ~2-3 second visual transition
  const sk = state.smoothKarma
  const k = state.karma
  sk.beauty += (k.beauty - sk.beauty) * lerpRate
  sk.trust += (k.trust - sk.trust) * lerpRate
  sk.hostility += (k.hostility - sk.hostility) * lerpRate
  sk.corruption += (k.corruption - sk.corruption) * lerpRate
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
