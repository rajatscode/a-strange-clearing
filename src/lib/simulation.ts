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
  // Trail positions
  trail: Array<{ x: number; y: number; alpha: number }>
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
  layer: number // 0=far background, 1=mid, 2=near
}

export type GrassBlade = {
  x: number
  baseHeight: number
  bend: number
  lean: number // natural asymmetry
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

export type WorldState = {
  player: Player
  particles: Particle[]
  grass: GrassBlade[]
  ripples: Ripple[]
  mood: CosmicMood
  karma: KarmaState
  mouseSpeed: number
  mouseSmoothed: number
  time: number
  scale: number
}

export function createWorld(width: number, height: number): WorldState {
  const karma = loadKarma()
  const mood = getCosmicMood()
  // Scale factor so visuals look right at any DPR
  const scale = height / 800

  const area = width * height
  const densityScale = Math.min(1, area / (1920 * 1080 * 4)) // scale down for large canvases
  const grassCount = Math.floor((180 + mood.grassDensity * 70) * densityScale)
  const particleCount = Math.floor((35 + mood.driftSpeed * 15) * densityScale)

  const grass: GrassBlade[] = []
  for (let i = 0; i < grassCount; i++) {
    const x = (i / grassCount) * width + (Math.random() - 0.5) * (width / grassCount) * 1.5
    const heightRand = Math.random()
    // Scale grass height to canvas size — covers bottom ~15-30% of screen
    const baseHeight = (40 + heightRand * 120 + heightRand * heightRand * 160) * scale
    grass.push({
      x,
      baseHeight,
      bend: 0,
      lean: (Math.random() - 0.5) * 0.3, // natural lean direction
      phase: Math.random() * Math.PI * 2,
      luminous: Math.random() < 0.15, // More luminous tips
      hue: Math.random() < 0.4 ? 165 + Math.random() * 35 : 95 + Math.random() * 35, // cyan or acid green
    })
  }

  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    // Bias some particles toward the lower half (near grass)
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

  return {
    player: {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      energy: karma.playerEnergy,
      aura: 30 * scale,
      alive: true,
      stillness: 0,
      aggression: 0,
      patience: karma.patience,
      trail: [],
    },
    particles,
    grass,
    ripples: [],
    mood,
    karma,
    mouseSpeed: 0,
    mouseSmoothed: 0,
    time: 0,
    scale,
  }
}

export function updateWorld(state: WorldState, dt: number, width: number, height: number): void {
  state.time += dt
  const { player, mood, karma } = state

  // Update mood every ~2 seconds
  if (Math.floor(state.time * 0.5) !== Math.floor((state.time - dt) * 0.5)) {
    Object.assign(state.mood, getCosmicMood())
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
  karma.navigability += (karma.trust - karma.hostility) * dt * 0.002

  // Clamp karma values
  karma.beauty = Math.max(0, Math.min(1, karma.beauty))
  karma.trust = Math.max(0, Math.min(1, karma.trust))
  karma.hostility = Math.max(0, Math.min(1, karma.hostility))
  karma.navigability = Math.max(0, Math.min(1, karma.navigability))
  karma.corruption = Math.max(0, Math.min(1, karma.corruption))
  karma.patience = player.patience

  // Trail — reuse objects, limit length
  if (player.trail.length < 12) {
    player.trail.unshift({ x: player.x, y: player.y, alpha: 0.6 })
  } else {
    // Rotate last element to front instead of allocating
    const last = player.trail.pop()!
    last.x = player.x
    last.y = player.y
    last.alpha = 0.6
    player.trail.unshift(last)
  }
  for (let i = 1; i < player.trail.length; i++) {
    player.trail[i].alpha *= 0.92
  }

  // Update grass — layered wind for organic movement
  const windTime = state.time * (0.6 + mood.windStrength * 1.0)
  for (const blade of state.grass) {
    // Multi-frequency wind sway — gives organic feel
    const wind1 = Math.sin(windTime + blade.phase) * (0.2 + mood.windStrength * 0.15)
    const wind2 = Math.sin(windTime * 0.7 + blade.phase * 1.3 + 1.2) * 0.08
    const wind3 = Math.sin(windTime * 0.3 + blade.x * 0.003) * 0.06 // spatial wave
    const wind = wind1 + wind2 + wind3

    // Player interaction — grass bends away from player
    const dx = blade.x - player.x
    const dy = (height - blade.baseHeight * 0.5) - player.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const bendRadius = 150 * s

    let playerBend = 0
    if (dist < bendRadius) {
      const force = (1 - dist / bendRadius) * 0.7
      playerBend = (dx > 0 ? 1 : -1) * force
    }

    // Smooth toward target bend (includes natural lean)
    const targetBend = wind + playerBend + blade.lean
    blade.bend += (targetBend - blade.bend) * 0.12
  }

  // Update particles
  for (const p of state.particles) {
    // Organic drifting
    p.x += (p.vx + Math.sin(state.time * 0.3 + p.phase) * 0.2 * mood.driftSpeed) * s
    p.y += (p.vy + Math.cos(state.time * 0.2 + p.phase * 1.3) * 0.15 * mood.driftSpeed) * s

    // Player proximity reaction
    const pdx = p.x - player.x
    const pdy = p.y - player.y
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy)
    const pushRadius = 100 * s
    if (pdist < pushRadius) {
      const push = (1 - pdist / pushRadius) * 0.3 * s
      p.x += pdx / pdist * push
      p.y += pdy / pdist * push
    }

    // Pulsing brightness
    p.brightness = 0.2 + Math.sin(state.time + p.phase) * 0.15 + 0.15

    // Wrap around
    if (p.x < -20) p.x = width + 20
    if (p.x > width + 20) p.x = -20
    if (p.y < -20) p.y = height + 20
    if (p.y > height + 20) p.y = -20
  }

  // Update ripples
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const r = state.ripples[i]
    r.radius += dt * 120 * state.scale
    r.alpha *= 0.96
    if (r.alpha < 0.01 || r.radius > r.maxRadius) {
      state.ripples.splice(i, 1)
    }
  }

  // Periodic karma save (~every 5 seconds)
  if (Math.floor(state.time / 5) !== Math.floor((state.time - dt) / 5)) {
    karma.playerEnergy = player.energy
    saveKarma(karma)
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
