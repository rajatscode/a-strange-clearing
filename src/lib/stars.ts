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
  blackDustDamage: number  // accumulated damage from black dust
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

export type StarScar = {
  x: number
  y: number
  radius: number
  alpha: number      // fades over time
  fromBlackDust: boolean  // darker scar if killed by corruption
}

export type StarField = {
  stars: Star[]
  rain: RainDrop[]
  dust: DustParticle[]
  scars: StarScar[]
}

// Create initial star field with starter stars visible in the sky region
export function createStarField(tree: Tree): StarField {
  // Stars should be above the leaf field but within the world bounds
  // Leaf field goes up to ~1500px above ground, stars live above that
  const skyBaseY = tree.originY - 2000  // lower so stars are more visible from leaves
  const starCount = 20 + Math.floor(Math.random() * 8) // 20-27 starters — sky BURNS

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
      lifespan: 10 + Math.random() * 15,
      rainTimer: 0,
      blackDustDamage: 0,
    })
  }

  return { stars, rain: [], dust: [], scars: [] }
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
  updateScars(field, dt)
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
    star.brightness = star.life * (0.5 + Math.sin(time * 2 + star.phase) * 0.3 + Math.sin(time * 0.8 + star.phase * 1.7) * 0.2)

    // Emit rain while alive — rate depends on brightness and karma beauty
    if (star.life > 0.05) {
      const rainRate = 0.8 + karma.beauty * 1.0 // drops per second (2x faster)
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

      // Leave a scar
      const scarFromBlack = star.blackDustDamage > 0.1
      field.scars.push({
        x: star.x,
        y: star.y,
        radius: 20 + star.brightness * 30,
        alpha: 1.0,
        fromBlackDust: scarFromBlack,
      })

      // Chain reaction: black dust cascade if killed by corruption
      if (scarFromBlack) {
        addDust(field, star.x, star.y, false, star.blackDustDamage * 3)
      }

      field.stars.splice(i, 1)
    }
  }
}

function emitRainDrop(field: StarField, star: Star, tree: Tree): void {
  if (field.rain.length >= 80) return // cap rain drops

  // Find a leaf below the star within horizontal range
  const hRange = 400 // wide search — rain drifts far as it falls
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
    vy: 150 + Math.random() * 100, // pixels per second downward
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
        nourishLeaf(leaf, 0.2)
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

    // Black dust seeks nearest star
    if (!dust.golden) {
      let nearestStarDist = Infinity
      let nearestStar: Star | null = null
      for (const star of field.stars) {
        const dx = star.x - dust.x
        const dy = star.y - dust.y
        const d = dx * dx + dy * dy
        if (d < nearestStarDist) { nearestStarDist = d; nearestStar = star }
      }
      if (nearestStar) {
        const dx = nearestStar.x - dust.x
        const dy = nearestStar.y - dust.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d > 1) {
          // Steer toward nearest star
          const seekSpeed = 80
          dust.vx += (dx / d) * seekSpeed * dt
          dust.vy += (dy / d) * seekSpeed * dt
        }
        // Impact: close enough to damage
        if (d < 30) {
          nearestStar.life -= 0.08
          nearestStar.blackDustDamage = (nearestStar.blackDustDamage || 0) + 0.08
          field.dust.splice(i, 1)
          continue
        }
      }
    }

    // Golden dust reaching sky region can accrete into a star
    if (dust.golden && dust.y < skyY) {
      if (field.stars.length < 40 && Math.random() < 0.2) {
        const newStar: Star = {
          x: dust.x,
          y: dust.y,
          brightness: 1.0,
          life: 1.0,
          phase: Math.random() * Math.PI * 2,
          birthTime: time,
          lifespan: 10 + Math.random() * 15,
          rainTimer: 0,
          blackDustDamage: 0,
        }
        field.stars.push(newStar)
        // Birth burst: 5-8 rain drops immediately
        const burstCount = 5 + Math.floor(Math.random() * 4)
        for (let b = 0; b < burstCount; b++) {
          emitRainDrop(field, newStar, tree)
        }
      }
      // Golden dust consumed when it reaches the sky
      field.dust.splice(i, 1)
      continue
    }

    // Remove if faded or risen way above
    if (dust.life <= 0 || dust.y < skyY - 500) {
      field.dust.splice(i, 1)
    }
  }
}

function updateScars(field: StarField, dt: number): void {
  for (let i = field.scars.length - 1; i >= 0; i--) {
    field.scars[i].alpha -= dt * (field.scars[i].fromBlackDust ? 0.008 : 0.012)
    if (field.scars[i].alpha <= 0) field.scars.splice(i, 1)
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
  if (field.dust.length + count > 400) return // global cap

  for (let i = 0; i < count; i++) {
    field.dust.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 15,
      vy: -(120 + Math.random() * 105), // rise upward (50% faster)
      brightness: 0.5 + Math.random() * 0.5,
      golden,
      life: 1.0,
    })
  }
}
