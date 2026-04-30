// Star + rain + dust cycle for The Clearing v2
// Core ecology loop: cooperation -> golden dust rises -> accretes into stars ->
// stars burn fast (30-60s) -> rain falls to leaves -> leaves glow and grow

import type { Tree } from './tree'
import { nourishLeaf } from './tree'
import type { KarmaState } from './persistence'

export type Star = {
  x: number
  y: number
  brightness: number  // 0-1
  life: number         // 0-1, decreases over time
  phase: number
  birthTime: number
  lifespan: number     // total lifespan in seconds (30-60)
  rainTimer: number    // accumulator for rain emission
}

export type RainDrop = {
  x: number
  y: number
  vy: number
  brightness: number
  targetLeafIndex: number  // which leaf it falls toward
}

export type DustParticle = {
  x: number
  y: number
  vx: number
  vy: number           // negative = rising
  brightness: number
  golden: boolean       // golden = cooperation, black = defection
  life: number          // 0-1, decreases over time
}

export type StarField = {
  stars: Star[]
  rain: RainDrop[]
  dust: DustParticle[]
}

// Create initial star field with starter stars visible in the sky region
export function createStarField(tree: Tree): StarField {
  // Stars should be above the leaf field but within the world bounds
  // Leaf field goes up to ~1500px above ground, stars live above that
  const skyBaseY = tree.originY - 1600  // just above the leaf field
  const starCount = 5 + Math.floor(Math.random() * 4) // 5-8 starters

  const stars: Star[] = []
  // Use a wide horizontal spread so stars are visible when looking up
  const spread = tree.width > 200 ? tree.width * 1.5 : 2000
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: tree.originX + (Math.random() - 0.5) * spread,
      y: skyBaseY - Math.random() * 500,
      brightness: 0.5 + Math.random() * 0.5,
      life: 0.4 + Math.random() * 0.6, // start partially through lifespan
      phase: Math.random() * Math.PI * 2,
      birthTime: 0,
      lifespan: 30 + Math.random() * 30,
      rainTimer: 0,
    })
  }

  return { stars, rain: [], dust: [] }
}

// Update the full star field each frame
export function updateStarField(
  field: StarField,
  tree: Tree,
  karma: KarmaState,
  dt: number,
  time: number,
): void {
  updateStars(field, tree, karma, dt, time)
  updateRain(field, tree, dt)
  updateDust(field, tree, dt, time)
}

function updateStars(
  field: StarField,
  tree: Tree,
  karma: KarmaState,
  dt: number,
  time: number,
): void {
  // Stars burn: life decreases, emit rain while alive
  for (let i = field.stars.length - 1; i >= 0; i--) {
    const star = field.stars[i]

    // Life drains at rate determined by lifespan
    star.life -= dt / star.lifespan

    // Brightness tracks life with a pulse
    star.brightness = star.life * (0.7 + Math.sin(time * 2 + star.phase) * 0.15 + Math.sin(time * 0.8 + star.phase * 1.7) * 0.15)

    // Emit rain while alive — rate depends on brightness and karma beauty
    if (star.life > 0.05) {
      const rainRate = 0.15 + karma.beauty * 0.25 // drops per second
      star.rainTimer += dt * rainRate

      while (star.rainTimer >= 1) {
        star.rainTimer -= 1
        emitRainDrop(field, star, tree)
      }
    }

    // Death burst — extra rain on death
    if (star.life <= 0) {
      // Final rain burst
      const burstCount = 3 + Math.floor(Math.random() * 4)
      for (let j = 0; j < burstCount; j++) {
        emitRainDrop(field, star, tree)
      }
      field.stars.splice(i, 1)
    }
  }
}

function emitRainDrop(field: StarField, star: Star, tree: Tree): void {
  if (field.rain.length >= 80) return // cap rain drops

  // Find a leaf below the star within horizontal range
  const hRange = 200 // horizontal search range from star
  const candidates: number[] = []
  for (let i = 0; i < tree.leaves.length; i++) {
    const leaf = tree.leaves[i]
    if (leaf.health <= 0) continue
    const dx = Math.abs(leaf.x - star.x)
    if (dx < hRange && leaf.y > star.y) {
      candidates.push(i)
    }
  }

  // If no leaves below, rain falls straight down and dissipates
  const targetIdx = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : -1

  field.rain.push({
    x: star.x + (Math.random() - 0.5) * 20,
    y: star.y + Math.random() * 10,
    vy: 80 + Math.random() * 60, // pixels per second downward
    brightness: 0.6 + Math.random() * 0.4,
    targetLeafIndex: targetIdx,
  })
}

function updateRain(field: StarField, tree: Tree, dt: number): void {
  for (let i = field.rain.length - 1; i >= 0; i--) {
    const drop = field.rain[i]

    // Gravity + drift toward target leaf
    drop.vy += dt * 30 // mild acceleration
    drop.y += drop.vy * dt

    if (drop.targetLeafIndex >= 0 && drop.targetLeafIndex < tree.leaves.length) {
      const targetLeaf = tree.leaves[drop.targetLeafIndex]
      // Gentle horizontal drift toward target
      const dx = targetLeaf.x - drop.x
      drop.x += dx * dt * 0.8
    }

    // Dim as it falls
    drop.brightness = Math.max(0, drop.brightness - dt * 0.15)

    // Check if rain hit its target leaf
    let hit = false
    if (drop.targetLeafIndex >= 0 && drop.targetLeafIndex < tree.leaves.length) {
      const leaf = tree.leaves[drop.targetLeafIndex]
      const dx = drop.x - leaf.x
      const dy = drop.y - leaf.y
      const hitRadius = leaf.size * 3 + 15
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        nourishLeaf(leaf, 0.08)
        hit = true
      }
    }

    // Remove if hit a leaf or fell too far below the tree
    if (hit || drop.y > tree.originY + 200 || drop.brightness <= 0) {
      field.rain.splice(i, 1)
    }
  }
}

function updateDust(field: StarField, tree: Tree, dt: number, time: number): void {
  const skyY = tree.originY - tree.height - 100 // sky region threshold

  for (let i = field.dust.length - 1; i >= 0; i--) {
    const dust = field.dust[i]

    // Rise upward
    dust.y += dust.vy * dt
    dust.x += dust.vx * dt

    // Gentle horizontal drift
    dust.vx += Math.sin(time * 0.5 + i * 0.3) * dt * 2
    dust.vx *= 0.98

    dust.life -= dt * 0.03 // slow fade

    // Golden dust reaching sky region can accrete into a star
    if (dust.golden && dust.y < skyY) {
      if (field.stars.length < 12 && Math.random() < 0.08) {
        field.stars.push({
          x: dust.x,
          y: dust.y,
          brightness: 0.8,
          life: 1.0,
          phase: Math.random() * Math.PI * 2,
          birthTime: time,
          lifespan: 30 + Math.random() * 30,
          rainTimer: 0,
        })
      }
      // Golden dust consumed when it reaches the sky
      field.dust.splice(i, 1)
      continue
    }

    // Black dust reaching a star corrodes it
    if (!dust.golden && dust.y < skyY) {
      for (let j = 0; j < field.stars.length; j++) {
        const star = field.stars[j]
        const dx = dust.x - star.x
        const dy = dust.y - star.y
        if (dx * dx + dy * dy < 150 * 150) {
          star.life -= 0.05 // corrode the star
          field.dust.splice(i, 1)
          break
        }
      }
      if (i >= field.dust.length) continue // was removed
    }

    // Remove if faded or risen way above
    if (dust.life <= 0 || dust.y < skyY - 500) {
      field.dust.splice(i, 1)
    }
  }
}

// Spawn dust particles — called from cooperation/defection events
export function addDust(
  field: StarField,
  x: number,
  y: number,
  golden: boolean,
  amount: number,
): void {
  const count = Math.min(Math.floor(amount), 30) // cap per burst
  if (field.dust.length + count > 200) return // global cap

  for (let i = 0; i < count; i++) {
    field.dust.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 15,
      vy: -(40 + Math.random() * 40), // rise upward
      brightness: 0.5 + Math.random() * 0.5,
      golden,
      life: 1.0,
    })
  }
}
