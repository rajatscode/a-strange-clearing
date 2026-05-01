// NPC agent system — centipede agents that climb the tree and seek interaction
// Each agent has a personality and a GOAL — a leaf they're navigating toward.
// Cooperators seek the player. Defectors seek high-value positions. Drifters wander.
// Movement: crawl to leaf edge toward goal → hop to next leaf → repeat.

import type { Centipede, Segment } from './centipede'
import type { Tree, Leaf } from './tree'
import { getReachableLeaves } from './tree'

// Iterated prisoner's dilemma strategies (adapted from Axelrod + carykh tournament)
// In our world, each bond is with a different opponent, so strategies respond to
// the WORLD's behavior — "what did the last person do to me?"
export type AgentPersonality =
  | 'tit_for_tat'      // mirrors what was done to them last time
  | 'generous_tft'     // tit-for-tat but 30% chance of forgiving defection (winningest IRL)
  | 'always_coop'      // naive trust — always cooperates
  | 'always_defect'    // pure selfish — always defects
  | 'grudger'          // cooperates until betrayed ONCE, then defects forever
  | 'detective'        // tests with defect early; if unpunished, exploits; else plays TFT
  | 'pavlov'           // repeats last move if it went well, switches if it went badly
  | 'joss'             // tit-for-tat but sneaks in random defections (~15%)
  | 'random'           // pure chaos — 50/50
  | 'forgiving_tft'    // only retaliates if defected on TWICE in a row
  | 'simpleton'        // if opponent cooperated, repeat last; if defected, do opposite

export type Agent = {
  centipede: Centipede
  personality: AgentPersonality
  currentLeaf: number
  targetLeaf: number
  goalLeaf: number
  hopProgress: number
  hopDuration: number
  thinkTimer: number
  goalTimer: number
  phase: number
  state: 'wandering' | 'approaching' | 'interacting'
  // Ecological anchoring
  homeDepth: number          // 0-1 preferred height — agents drift back here
  // Strategy memory
  lastBondResult: 'cooperated' | 'was_defected' | 'defected' | 'mutual_defect' | null
  prevBondResult: 'cooperated' | 'was_defected' | 'defected' | 'mutual_defect' | null
  lastOwnMove: number     // 0=defect, 1=cooperate, -1=no history
  everBetrayed: boolean    // for grudger
  bondCount: number        // for detective
}

export type AgentSystem = {
  agents: Agent[]
}

function createRng(seed: number) {
  let s = seed
  return function next(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const SEG_SPACING = 14

function createAgentCentipede(startX: number, startY: number, segmentCount: number, leafIndex: number): Centipede {
  const segments: Segment[] = []
  for (let i = 0; i < segmentCount; i++) {
    const x = startX - i * SEG_SPACING
    segments.push({ x, y: startY, prevX: x, prevY: startY })
  }
  return {
    segments, segmentSpacing: SEG_SPACING, maxSegments: 80,
    currentLeaf: leafIndex, onGround: false, state: 'crawling' as const, direction: 1,
  }
}

export function createAgentSystem(tree: Tree, count?: number): AgentSystem {
  const rng = createRng(tree.seed * 31 + 777)
  const agentCount = count ?? 24
  if (tree.leaves.length < 2) return { agents: [] }

  const agents: Agent[] = []

  // Strategy distribution — weighted toward prosocial (world should feel alive)
  const strategies: AgentPersonality[] = [
    'tit_for_tat', 'tit_for_tat', 'tit_for_tat',  // common
    'generous_tft', 'generous_tft', 'generous_tft', // common (winningest)
    'always_coop', 'always_coop',
    'forgiving_tft', 'forgiving_tft',
    'pavlov', 'pavlov',
    'simpleton',
    'detective',
    'joss', 'joss',
    'always_defect',
    'grudger',
    'random',
  ]

  const anyLeaves = tree.leaves.filter(l => l.index > 0)

  for (let i = 0; i < agentCount; i++) {
    const personality = strategies[Math.floor(rng() * strategies.length)]
    const segCount = 7 + Math.floor(rng() * 4)

    // Half spawn on leaves, half on the ground
    let spawnX: number, spawnY: number, spawnLeafIdx: number
    if (rng() < 0.5 && anyLeaves.length > 0) {
      const leaf = anyLeaves[Math.floor(rng() * anyLeaves.length)]
      spawnX = leaf.x
      spawnY = leaf.y
      spawnLeafIdx = leaf.index
    } else {
      // Spawn on the ground
      const worldSpread = tree.width > 200 ? tree.width * 1.5 : 2000
      spawnX = tree.originX + (rng() - 0.5) * worldSpread
      spawnY = tree.originY
      spawnLeafIdx = -1
    }

    agents.push({
      centipede: createAgentCentipede(spawnX, spawnY, segCount, spawnLeafIdx),
      personality,
      currentLeaf: spawnLeafIdx,
      targetLeaf: -1,
      goalLeaf: -1,
      hopProgress: 0,
      hopDuration: 0.8,
      thinkTimer: rng() * 0.5,
      goalTimer: 0,
      phase: rng() * Math.PI * 2,
      state: 'wandering',
      homeDepth: rng(),  // random preferred height — distributes agents across all levels
      lastBondResult: null,
      prevBondResult: null,
      lastOwnMove: -1,
      everBetrayed: false,
      bondCount: 0,
    })
  }

  return { agents }
}

function getAgentReach(agent: Agent): number {
  return agent.centipede.segments.length * agent.centipede.segmentSpacing
}

// Behavioral grouping — strategies fall into prosocial, antisocial, or neutral
function isProSocial(p: AgentPersonality): boolean {
  return p === 'always_coop' || p === 'generous_tft' || p === 'forgiving_tft' || p === 'tit_for_tat'
}
function isAntiSocial(p: AgentPersonality): boolean {
  return p === 'always_defect' || p === 'joss'
}

function bezierArc(x0: number, y0: number, x1: number, y1: number, t: number): { x: number; y: number } {
  const midX = (x0 + x1) / 2
  const arcH = Math.max(25, (Math.abs(y1 - y0) + Math.abs(x1 - x0)) * 0.2)
  const cpY = Math.min(y0, y1) - arcH
  const inv = 1 - t
  return {
    x: inv * inv * x0 + 2 * inv * t * midX + t * t * x1,
    y: inv * inv * y0 + 2 * inv * t * cpY + t * t * y1,
  }
}

// ─── Goal selection ───

function pickGoal(agent: Agent, tree: Tree, playerLeaf: number, time: number, allAgents?: Agent[]): number {
  const leaves = tree.leaves
  if (leaves.length < 2) return 0

  const candidates: { idx: number; score: number }[] = []
  const cur = leaves[agent.currentLeaf]
  const curX = cur?.x ?? tree.originX
  const curY = cur?.y ?? tree.originY

  // Collect agent positions for spatial density avoidance
  const otherPositions: { x: number; y: number }[] = []
  if (allAgents) {
    for (const a of allAgents) {
      if (a === agent) continue
      const h = a.centipede.segments[0]
      if (h) otherPositions.push({ x: h.x, y: h.y })
    }
  }

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]
    if (leaf.index === 0) continue
    if (leaf.health <= 0.05) continue // dead leaves are not goals

    let score = 0

    // 1. HEALTHY LEAVES — go where the food is (0-3 points)
    score += leaf.health * 3

    // 2. HOME DEPTH — prefer leaves near your home depth (0-4 points, strongest factor)
    const depthDist = Math.abs(leaf.depth - agent.homeDepth)
    score += Math.max(0, 4 - depthDist * 6)

    // 3. NOT TOO FAR — prefer reachable goals over distant ones (0-2 points)
    const worldDist = Math.sqrt((leaf.x - curX) ** 2 + (leaf.y - curY) ** 2)
    score += Math.max(0, 2 - worldDist * 0.002)

    // 4. PERSONALITY-SPECIFIC GOALS
    if (agent.personality === 'always_coop' && playerLeaf >= 0) {
      // Seek the player
      const pLeaf = leaves[playerLeaf]
      if (pLeaf) {
        const distToPlayer = Math.sqrt((leaf.x - pLeaf.x) ** 2 + (leaf.y - pLeaf.y) ** 2)
        score += Math.max(0, 3 - distToPlayer * 0.005)
      }
    } else if (isProSocial(agent.personality)) {
      // Seek other agents — prefer leaves near the player (where bonds happen)
      if (playerLeaf >= 0) {
        const pLeaf = leaves[playerLeaf]
        if (pLeaf) {
          const distToPlayer = Math.sqrt((leaf.x - pLeaf.x) ** 2 + (leaf.y - pLeaf.y) ** 2)
          score += Math.max(0, 1.5 - distToPlayer * 0.003)
        }
      }
    } else if (agent.personality === 'always_defect') {
      // Seek isolated positions (away from clusters, easier to exploit loners)
      score += leaf.depth * 1.5 // slight upward bias (risky, high reward)
    } else if (agent.personality === 'detective') {
      // Explore — bonus for leaves far from current position
      score += Math.min(2, worldDist * 0.001)
    }
    // grudger, pavlov, simpleton, random, joss, forgiving_tft: no special goal bias
    // They rely on homeDepth + health to find goals naturally

    // 5. DENSITY AVOIDANCE — count agents within 300px radius of this leaf
    let nearbyAgents = 0
    for (const pos of otherPositions) {
      const adx = pos.x - leaf.x, ady = pos.y - leaf.y
      if (adx * adx + ady * ady < 300 * 300) nearbyAgents++
    }
    score -= nearbyAgents * 1.2 // each nearby agent penalizes

    // 6. VARIETY — slight random noise so goals don't converge
    score += Math.abs(Math.sin(agent.phase * 17 + i * 0.7 + time * 0.1)) * 1.5

    if (score > 0) candidates.push({ idx: i, score })
  }

  if (candidates.length === 0) return agent.currentLeaf

  // Sort by score descending, pick from top 5 with randomness
  candidates.sort((a, b) => b.score - a.score)
  const topN = Math.min(5, candidates.length)
  const pick = Math.floor(Math.abs(Math.sin(agent.phase * 31 + time * 0.3)) * topN)
  return candidates[pick].idx
}

// ─── Next hop: pick the neighbor that gets closest to the goal ───

function pickNextHop(agent: Agent, tree: Tree, reachable: number[]): number {
  if (reachable.length === 0) return -1
  if (agent.goalLeaf < 0) return reachable[0]

  const goal = tree.leaves[agent.goalLeaf]
  if (!goal) return reachable[0]

  // Pick the reachable leaf closest to the goal
  let bestIdx = reachable[0]
  let bestDist = Infinity
  for (const li of reachable) {
    const leaf = tree.leaves[li]
    const dx = leaf.x - goal.x
    const dy = leaf.y - goal.y
    const dist = dx * dx + dy * dy
    if (dist < bestDist) { bestDist = dist; bestIdx = li }
  }
  return bestIdx
}

// ─── Main update ───

export function updateAgents(
  system: AgentSystem,
  tree: Tree,
  playerLeaf: number,
  dt: number,
  time: number,
): void {
  for (const agent of system.agents) {
    // --- Goal management ---
    agent.goalTimer -= dt
    if (agent.goalTimer <= 0 || agent.goalLeaf < 0) {
      agent.goalLeaf = pickGoal(agent, tree, playerLeaf, time, system.agents)
      // Re-evaluate goal periodically
      agent.goalTimer = isAntiSocial(agent.personality) ? 4 + Math.sin(agent.phase) * 2
        : isProSocial(agent.personality) ? 6 + Math.sin(agent.phase) * 3
        : 8 + Math.sin(agent.phase) * 4
    }

    // Reached goal? Pick new one
    if (agent.currentLeaf === agent.goalLeaf) {
      agent.goalLeaf = pickGoal(agent, tree, playerLeaf, time, system.agents)
    }

    // Goal leaf died? Re-pick
    if (agent.goalLeaf >= 0 && agent.goalLeaf < tree.leaves.length && tree.leaves[agent.goalLeaf].health <= 0) {
      agent.goalLeaf = pickGoal(agent, tree, playerLeaf, time, system.agents)
    }

    // Current leaf died? Fall to nearest healthy leaf or ground
    const curLeaf = tree.leaves[agent.currentLeaf]
    if (curLeaf && curLeaf.health <= 0 && agent.targetLeaf < 0) {
      // Find nearest healthy leaf within generous range
      let bestLeaf = -1
      let bestDist = Infinity
      const head = agent.centipede.segments[0]
      if (head) {
        for (let li = 0; li < tree.leaves.length; li++) {
          const leaf = tree.leaves[li]
          if (leaf.health <= 0 || li === agent.currentLeaf) continue
          const dx = leaf.x - head.x, dy = leaf.y - head.y
          const d = dx * dx + dy * dy
          if (d < bestDist) { bestDist = d; bestLeaf = li }
        }
      }
      if (bestLeaf >= 0 && bestDist < 500 * 500) {
        agent.targetLeaf = bestLeaf
        agent.hopProgress = 0
        agent.hopDuration = 0.6
      }
      // If no leaf nearby, agent just stays and body physics will drop segments
    }

    // --- Interaction check ---
    if (agent.currentLeaf === playerLeaf && agent.targetLeaf === -1) {
      agent.state = 'interacting'
    } else if (agent.state === 'interacting') {
      agent.state = 'wandering'
    }

    const head = agent.centipede.segments[0]
    if (!head) continue

    // --- Hopping between leaves ---
    if (agent.targetLeaf >= 0) {
      agent.hopProgress += dt / agent.hopDuration

      const startLeaf = tree.leaves[agent.currentLeaf]
      const endLeaf = tree.leaves[agent.targetLeaf]

      // Start position: leaf or ground
      const startX = startLeaf?.x ?? head.x
      const startY = startLeaf?.y ?? tree.originY

      if (!endLeaf || endLeaf.health <= 0) {
        agent.targetLeaf = -1
        agent.hopProgress = 0
        updateAgentBody(agent, tree)
        continue
      }

      if (agent.hopProgress >= 1) {
        agent.currentLeaf = agent.targetLeaf
        agent.centipede.currentLeaf = agent.targetLeaf
        agent.targetLeaf = -1
        agent.hopProgress = 0
        head.prevX = head.x; head.prevY = head.y
        head.x = endLeaf.x; head.y = endLeaf.y
      } else {
        const easeT = agent.hopProgress * agent.hopProgress * (3 - 2 * agent.hopProgress)
        const pos = bezierArc(startX, startY, endLeaf.x, endLeaf.y, easeT)
        head.prevX = head.x; head.prevY = head.y
        head.x = pos.x; head.y = pos.y
      }

      updateAgentBody(agent, tree)
      continue
    }

    // --- Idle behavior: on a leaf or on the ground ---
    const leafData = tree.leaves[agent.currentLeaf]

    if (!leafData) {
      // ON THE GROUND — crawl toward the nearest leaf and hop to it
      head.prevX = head.x; head.prevY = head.y
      // Find nearest healthy leaf
      let nearestLeaf = -1, nearestDist = Infinity
      for (let li = 0; li < tree.leaves.length; li++) {
        const l = tree.leaves[li]
        if (l.health <= 0) continue
        const dx = l.x - head.x, dy = l.y - head.y
        const d = dx * dx + dy * dy
        if (d < nearestDist) { nearestDist = d; nearestLeaf = li }
      }
      if (nearestLeaf >= 0) {
        // Crawl toward the nearest leaf on the ground
        const targetLeafData = tree.leaves[nearestLeaf]
        const dir = Math.sign(targetLeafData.x - head.x)
        head.x += dir * 120 * dt // crawl speed on ground
        head.y = tree.originY
        agent.centipede.direction = dir || 1

        // Close enough? Hop up to it
        if (Math.abs(head.x - targetLeafData.x) < 100) {
          agent.targetLeaf = nearestLeaf
          agent.hopProgress = 0
          agent.hopDuration = 0.6
        }
      }
      updateAgentBody(agent, tree)
      continue
    }

    // ON A LEAF — crawl toward the goal direction
    const goalData = agent.goalLeaf >= 0 ? tree.leaves[agent.goalLeaf] : null
    const goalDirX = goalData ? Math.sign(goalData.x - leafData.x) : 0

    const leafHalfW = leafData.size * 1.5
    const edgeTarget = leafData.x + goalDirX * leafHalfW * 0.6
    const targetX = goalDirX === 0 ? leafData.x : edgeTarget

    head.prevX = head.x; head.prevY = head.y
    head.x += (targetX - head.x) * Math.min(1, 4 * dt)
    head.y += (leafData.y - head.y) * Math.min(1, 6 * dt)

    agent.centipede.direction = goalDirX !== 0 ? goalDirX : agent.centipede.direction

    // Think timer — decide when to hop
    agent.thinkTimer -= dt
    if (agent.thinkTimer <= 0) {
      const reach = getAgentReach(agent) * 2.5 // agents hop between leaves generously
      const reachable = getReachableLeaves(tree, agent.currentLeaf, reach)

      if (reachable.length > 0) {
        const chosen = pickNextHop(agent, tree, reachable)
        if (chosen >= 0) {
          agent.targetLeaf = chosen
          agent.hopProgress = 0

          const target = tree.leaves[chosen]
          if (target) {
            const dist = Math.sqrt(
              (target.x - leafData.x) ** 2 + (target.y - leafData.y) ** 2,
            )
            // Personality affects hop speed
            const speedMul = isAntiSocial(agent.personality) ? 0.7
              : isProSocial(agent.personality) ? 1.0 : 1.3
            agent.hopDuration = Math.max(0.3, Math.min(0.8, dist / 350)) * speedMul
          }
        }
      }

      // Think timer — agents should be ACTIVE
      if (isProSocial(agent.personality)) {
        agent.thinkTimer = 0.5 + Math.abs(Math.sin(agent.phase * 7 + time * 0.2)) * 0.7
      } else if (isAntiSocial(agent.personality)) {
        agent.thinkTimer = 0.2 + Math.abs(Math.sin(agent.phase * 13 + time * 0.3)) * 0.4
      } else {
        agent.thinkTimer = 1.0 + Math.abs(Math.sin(agent.phase * 3 + time * 0.1)) * 1.5
      }
    }

    updateAgentBody(agent, tree)
  }
}

// ─── Agent body physics (same drape model as player) ───

function updateAgentBody(agent: Agent, tree: Tree): void {
  const { segments, segmentSpacing } = agent.centipede
  if (segments.length <= 1) return

  const groundY = tree.originY
  const DRAPE = segmentSpacing * 0.7
  const FOLLOW = 0.6
  const dir = agent.centipede.direction

  for (let i = 1; i < segments.length; i++) {
    const leader = segments[i - 1]
    const seg = segments[i]

    const surf = probeAgentSurface(seg.x, seg.y, tree.leaves, groundY)

    let grounded = false
    if (surf !== null) {
      const dxL = leader.x - seg.x
      const dyL = leader.y - surf
      grounded = Math.sqrt(dxL * dxL + dyL * dyL) <= segmentSpacing * 1.5
    }

    seg.prevX = seg.x; seg.prevY = seg.y

    if (grounded && surf !== null) {
      const idealX = leader.x - segmentSpacing * dir
      seg.x += (idealX - seg.x) * FOLLOW
      seg.y = surf
    } else {
      let dx = seg.x - leader.x
      let dy = seg.y - leader.y + DRAPE
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.001) {
        seg.x = leader.x + (dx / dist) * segmentSpacing
        seg.y = leader.y + (dy / dist) * segmentSpacing
      }

      if (seg.y >= groundY) { seg.y = groundY; seg.prevY = seg.y }
      else {
        for (let li = 0; li < tree.leaves.length; li++) {
          const leaf = tree.leaves[li]
          if (leaf.health <= 0) continue
          const hw = leaf.size * 2
          if (seg.x >= leaf.x - hw && seg.x <= leaf.x + hw &&
              seg.y >= leaf.y - 10 && seg.y <= leaf.y + segmentSpacing) {
            seg.y = leaf.y; seg.prevY = seg.y; break
          }
        }
      }
    }
  }
}

function probeAgentSurface(x: number, y: number, leaves: Leaf[], groundY: number): number | null {
  if (y >= groundY - 10) return groundY
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]
    if (leaf.health <= 0) continue
    const hw = leaf.size * 2
    if (x >= leaf.x - hw && x <= leaf.x + hw && Math.abs(y - leaf.y) < 10) return leaf.y
  }
  return null
}
