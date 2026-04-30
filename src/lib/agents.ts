// NPC agent system — centipede agents that hop between leaves
// Each agent has a personality (cooperator/defector/drifter) revealed through behavior, not appearance

import type { Centipede, Segment } from './centipede'
import type { Tree } from './tree'
import { getReachableLeaves } from './tree'

export type AgentPersonality = 'cooperator' | 'defector' | 'drifter'

export type Agent = {
  centipede: Centipede
  personality: AgentPersonality
  currentLeaf: number
  targetLeaf: number
  hopProgress: number
  hopDuration: number
  thinkTimer: number      // time until next hop decision
  phase: number
  state: 'wandering' | 'approaching' | 'interacting'
}

export type AgentSystem = {
  agents: Agent[]
}

// Seeded RNG for deterministic spawning
function createRng(seed: number) {
  let s = seed
  return function next(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function createAgentCentipede(startX: number, startY: number, segmentCount: number, leafIndex: number): Centipede {
  const segmentSpacing = 18
  const segments: Segment[] = []
  for (let i = 0; i < segmentCount; i++) {
    const y = startY + i * segmentSpacing
    segments.push({
      x: startX,
      y,
      prevX: startX,
      prevY: y,
    })
  }
  return {
    segments,
    segmentSpacing,
    maxSegments: 80,
    currentLeaf: leafIndex,
    targetLeaf: -1,
    hopProgress: 0,
    hopDuration: 0.2,
    onGround: false,
    fallVelocity: 0,
    state: 'crawling' as const,
    direction: 1,
    gripIndex: segmentCount - 1,
    jumpStartX: startX,
    jumpStartY: startY,
    lastLeaf: -1,
    lastLeafTimer: 0,
  }
}

export function createAgentSystem(tree: Tree, count?: number): AgentSystem {
  const rng = createRng(tree.seed * 31 + 777)

  const agentCount = count ?? 15

  if (tree.leaves.length < 2) {
    return { agents: [] }
  }

  const agents: Agent[] = []

  // Categorize leaves by depth for targeted spawning
  const bottomLeaves = tree.leaves.filter(l => l.depth < 0.15 && l.index > 0)   // near ground
  const midLeaves = tree.leaves.filter(l => l.depth >= 0.15 && l.depth < 0.5 && l.index > 0)
  const topLeaves = tree.leaves.filter(l => l.depth >= 0.5 && l.index > 0)

  // Fallbacks
  const anyLeaves = tree.leaves.filter(l => l.index > 0)
  const safeBottom = bottomLeaves.length > 0 ? bottomLeaves : anyLeaves
  const safeMid = midLeaves.length > 0 ? midLeaves : anyLeaves
  const safeTop = topLeaves.length > 0 ? topLeaves : anyLeaves

  // Spawn distribution: 8 bottom, 5 mid, 2 top
  type SpawnSpec = { pool: typeof anyLeaves; count: number }
  const specs: SpawnSpec[] = [
    { pool: safeBottom, count: Math.min(8, agentCount) },
    { pool: safeMid, count: Math.min(5, Math.max(0, agentCount - 8)) },
    { pool: safeTop, count: Math.max(0, agentCount - 13) },
  ]

  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      // Personality distribution: ~40% drifters, ~35% cooperators, ~25% defectors
      const roll = rng()
      let personality: AgentPersonality
      if (roll < 0.40) personality = 'drifter'
      else if (roll < 0.75) personality = 'cooperator'
      else personality = 'defector'

      // Pick a spawn leaf from the appropriate pool
      const spawnLeaf = spec.pool[Math.floor(rng() * spec.pool.length)]
      const leafIdx = spawnLeaf.index

      // Segment counts 8-14 — enough to hop between leaves (need ~112px reach min)
      const segCount = 8 + Math.floor(rng() * 7)

      // Think timer varies by personality
      let thinkTimer: number
      if (personality === 'cooperator') thinkTimer = 1 + rng() * 2      // 1-3s
      else if (personality === 'defector') thinkTimer = 0.5 + rng() * 1  // 0.5-1.5s
      else thinkTimer = 2 + rng() * 3                                    // 2-5s

      agents.push({
        centipede: createAgentCentipede(spawnLeaf.x, spawnLeaf.y, segCount, leafIdx),
        personality,
        currentLeaf: leafIdx,
        targetLeaf: -1,
        hopProgress: 0,
        hopDuration: 0.2,
        thinkTimer,
        phase: rng() * Math.PI * 2,
        state: 'wandering',
      })
    }
  }

  return { agents }
}

// Get reach for an agent based on their centipede's segment count
function getAgentReach(agent: Agent): number {
  return agent.centipede.segments.length * agent.centipede.segmentSpacing
}

// Quadratic bezier arc for hop animation (same as player)
function bezierArc(
  x0: number, y0: number,
  x1: number, y1: number,
  t: number,
): { x: number; y: number } {
  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2
  const verticalDist = Math.abs(y1 - y0)
  const horizontalDist = Math.abs(x1 - x0)
  const arcHeight = Math.max(30, (verticalDist + horizontalDist) * 0.25)
  const cpY = midY - arcHeight

  const inv = 1 - t
  const x = inv * inv * x0 + 2 * inv * t * midX + t * t * x1
  const y = inv * inv * y0 + 2 * inv * t * cpY + t * t * y1

  return { x, y }
}

export function updateAgents(
  system: AgentSystem,
  tree: Tree,
  playerLeaf: number,
  dt: number,
  time: number,
): void {
  for (const agent of system.agents) {
    // --- Check for interaction (same leaf as player) ---
    if (agent.currentLeaf === playerLeaf && agent.targetLeaf === -1) {
      agent.state = 'interacting'
    } else {
      if (agent.state === 'interacting') agent.state = 'wandering'
    }

    // --- Hop animation ---
    if (agent.targetLeaf >= 0) {
      agent.hopProgress += dt / agent.hopDuration

      const startLeaf = tree.leaves[agent.currentLeaf]
      const endLeaf = tree.leaves[agent.targetLeaf]

      if (!startLeaf || !endLeaf) {
        agent.targetLeaf = -1
        agent.hopProgress = 0
        updateAgentBody(agent, dt)
        continue
      }

      if (agent.hopProgress >= 1) {
        // Arrived
        agent.currentLeaf = agent.targetLeaf
        agent.centipede.currentLeaf = agent.targetLeaf
        agent.targetLeaf = -1
        agent.hopProgress = 0

        const head = agent.centipede.segments[0]
        if (head) {
          head.prevX = head.x
          head.prevY = head.y
          head.x = endLeaf.x
          head.y = endLeaf.y
        }
      } else {
        // Interpolate along arc
        const pos = bezierArc(
          startLeaf.x, startLeaf.y,
          endLeaf.x, endLeaf.y,
          agent.hopProgress,
        )
        const head = agent.centipede.segments[0]
        if (head) {
          head.prevX = head.x
          head.prevY = head.y
          head.x = pos.x
          head.y = pos.y
        }
      }

      updateAgentBody(agent, dt)
      continue
    }

    // --- Idle: sitting on current leaf, think about next hop ---
    const currentLeafData = tree.leaves[agent.currentLeaf]
    if (!currentLeafData) continue

    // Snap head to current leaf
    const head = agent.centipede.segments[0]
    if (head) {
      head.prevX = head.x
      head.prevY = head.y
      head.x += (currentLeafData.x - head.x) * 0.25
      head.y += (currentLeafData.y - head.y) * 0.25
    }

    // Think timer
    agent.thinkTimer -= dt
    if (agent.thinkTimer <= 0) {
      // Time to pick a new target
      const reach = getAgentReach(agent)
      const reachable = getReachableLeaves(tree, agent.currentLeaf, reach)

      if (reachable.length > 0) {
        const chosenLeaf = pickTargetLeaf(agent, tree, reachable, playerLeaf, time)
        if (chosenLeaf >= 0) {
          agent.targetLeaf = chosenLeaf
          agent.hopProgress = 0

          // Hop duration: 0.15-0.3s
          const targetLeafData = tree.leaves[chosenLeaf]
          if (targetLeafData) {
            const dist = Math.sqrt(
              (targetLeafData.x - currentLeafData.x) ** 2 +
              (targetLeafData.y - currentLeafData.y) ** 2,
            )
            agent.hopDuration = Math.max(0.15, Math.min(0.3, dist / 1000))
          }
        }
      }

      // Reset think timer based on personality
      if (agent.personality === 'cooperator') {
        agent.thinkTimer = 1 + Math.abs(Math.sin(agent.phase * 7 + time * 0.2)) * 2
      } else if (agent.personality === 'defector') {
        agent.thinkTimer = 0.5 + Math.abs(Math.sin(agent.phase * 13 + time * 0.3)) * 1
      } else {
        agent.thinkTimer = 2 + Math.abs(Math.sin(agent.phase * 3 + time * 0.1)) * 3
      }
    }

    updateAgentBody(agent, dt)
  }
}

// Personality-driven leaf selection
function pickTargetLeaf(
  agent: Agent,
  tree: Tree,
  reachable: number[],
  playerLeaf: number,
  time: number,
): number {
  if (reachable.length === 0) return -1

  const currentLeafData = tree.leaves[agent.currentLeaf]
  const playerLeafData = tree.leaves[playerLeaf]
  if (!currentLeafData || !playerLeafData) {
    // Fallback: pick deterministic pseudo-random
    const idx = Math.floor(Math.abs(Math.sin(agent.phase * 41 + time * 0.3)) * reachable.length) % reachable.length
    return reachable[idx]
  }

  if (agent.personality === 'cooperator') {
    // Prefer leaves closer to the player — move toward player steadily
    let bestIdx = reachable[0]
    let bestDist = Infinity
    for (const li of reachable) {
      const leaf = tree.leaves[li]
      const dx = leaf.x - playerLeafData.x
      const dy = leaf.y - playerLeafData.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = li
      }
    }
    // Sometimes pick a slightly random one to avoid robotic behavior (~20% of the time)
    if (Math.sin(agent.phase * 17 + time * 0.4) > 0.6 && reachable.length > 1) {
      const idx = Math.floor(Math.abs(Math.sin(agent.phase * 23 + time * 0.7)) * reachable.length) % reachable.length
      return reachable[idx]
    }
    return bestIdx
  }

  if (agent.personality === 'defector') {
    // Erratic: sometimes rush toward player, sometimes dart away
    const rushToward = Math.sin(agent.phase * 19 + time * 0.5) > 0
    if (rushToward) {
      // Quick approach — pick closest to player
      let bestIdx = reachable[0]
      let bestDist = Infinity
      for (const li of reachable) {
        const leaf = tree.leaves[li]
        const dx = leaf.x - playerLeafData.x
        const dy = leaf.y - playerLeafData.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = li
        }
      }
      return bestIdx
    } else {
      // Dart away — pick farthest from player
      let bestIdx = reachable[0]
      let bestDist = 0
      for (const li of reachable) {
        const leaf = tree.leaves[li]
        const dx = leaf.x - playerLeafData.x
        const dy = leaf.y - playerLeafData.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > bestDist) {
          bestDist = dist
          bestIdx = li
        }
      }
      return bestIdx
    }
  }

  // Drifter: random neighbor
  const idx = Math.floor(Math.abs(Math.sin(agent.phase * 29 + time * 0.15)) * reachable.length) % reachable.length
  return reachable[idx]
}

// Update agent body segments — verlet physics trailing behind head
function updateAgentBody(agent: Agent, dt: number): void {
  const { segments, segmentSpacing } = agent.centipede
  if (segments.length <= 1) return

  const clampedDt = Math.min(dt, 0.05)
  const dtScale = clampedDt / 0.016

  const DAMPING = 0.92
  const GRAVITY = 0.08
  const CONSTRAINT_ITERATIONS = 3

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    const vx = (seg.x - seg.prevX) * DAMPING
    const vy = (seg.y - seg.prevY) * DAMPING

    seg.prevX = seg.x
    seg.prevY = seg.y

    seg.x += vx * dtScale
    seg.y += vy * dtScale + GRAVITY * dtScale
  }

  for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
    for (let i = 1; i < segments.length; i++) {
      const parent = segments[i - 1]
      const seg = segments[i]

      const dx = seg.x - parent.x
      const dy = seg.y - parent.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 0.001) continue

      if (dist > segmentSpacing) {
        const correction = (dist - segmentSpacing) / dist
        seg.x -= dx * correction
        seg.y -= dy * correction
      }
    }
  }
}
