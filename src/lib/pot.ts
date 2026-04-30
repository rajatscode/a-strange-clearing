// Pot mechanic — cooperation/defection interaction between player and NPC agents
// Triggers automatically when the player's centipede shares a leaf with an NPC agent.
// Resolution: prisoner's dilemma with timed click mechanic.

import type { AgentSystem, Agent } from './agents'
import type { Centipede } from './centipede'
import type { Tree } from './tree'
import type { KarmaState } from './persistence'

export type PotState = {
  active: boolean
  agentIndex: number        // which agent we're interacting with
  leafIndex: number         // shared leaf
  timer: number             // 0-1, the pulse cycle (red at 0, blue at 1)
  duration: number          // total duration of pulse cycle (~2s)
  playerDecision: 'pending' | 'cooperate' | 'defect'
  agentDecision: 'cooperate' | 'defect'  // pre-decided based on personality
  resolved: boolean
  resolveTimer: number      // brief pause after resolution for visual feedback
  potSize: number           // amount at stake (scales with world karma)
}

export type PotResolution = {
  type: 'none' | 'both_cooperate' | 'player_defects' | 'agent_defects' | 'both_defect'
  potSize: number
  x: number
  y: number
}

export function createPot(): PotState {
  return {
    active: false,
    agentIndex: -1,
    leafIndex: -1,
    timer: 0,
    duration: 2.0,
    playerDecision: 'pending',
    agentDecision: 'cooperate',
    resolved: false,
    resolveTimer: 0,
    potSize: 0,
  }
}

// Pre-decide the agent's choice based on personality
function decideForAgent(agent: Agent): 'cooperate' | 'defect' {
  const roll = Math.random()
  if (agent.personality === 'cooperator') {
    return roll < 0.85 ? 'cooperate' : 'defect'
  } else if (agent.personality === 'defector') {
    return roll < 0.25 ? 'cooperate' : 'defect'
  } else {
    // drifter: 50/50
    return roll < 0.5 ? 'cooperate' : 'defect'
  }
}

// Called when the player clicks during an active pot — timer position determines decision
export function handlePotClick(pot: PotState): void {
  if (!pot.active || pot.resolved || pot.playerDecision !== 'pending') return

  if (pot.timer < 0.4) {
    pot.playerDecision = 'defect'
  } else if (pot.timer >= 0.6) {
    pot.playerDecision = 'cooperate'
  } else {
    // Uncertain zone (0.4-0.6): slight random lean
    pot.playerDecision = Math.random() < 0.55 ? 'cooperate' : 'defect'
  }
}

export function updatePot(
  pot: PotState,
  agents: AgentSystem,
  centipede: Centipede,
  tree: Tree,
  karma: KarmaState,
  dt: number,
): PotResolution {
  const noResult: PotResolution = { type: 'none', potSize: 0, x: 0, y: 0 }

  // --- Resolve timer countdown (post-resolution visual feedback) ---
  if (pot.resolved) {
    pot.resolveTimer -= dt
    if (pot.resolveTimer <= 0) {
      // Deactivate pot
      pot.active = false
      pot.resolved = false
      pot.resolveTimer = 0
      pot.playerDecision = 'pending'
      pot.agentIndex = -1
      pot.leafIndex = -1
      pot.timer = 0
      pot.potSize = 0
    }
    return noResult
  }

  // --- Active pot: advance timer, check for resolution ---
  if (pot.active) {
    const agent = agents.agents[pot.agentIndex]
    if (!agent) {
      pot.active = false
      return noResult
    }

    // Deactivate if either party hops away
    if (centipede.currentLeaf !== pot.leafIndex || agent.currentLeaf !== pot.leafIndex) {
      pot.active = false
      pot.playerDecision = 'pending'
      pot.timer = 0
      return noResult
    }

    // Advance timer
    pot.timer += dt / pot.duration

    // Check for resolution
    let shouldResolve = false
    if (pot.timer >= 1) {
      // Timer completed without click — auto-cooperate (patience rewarded)
      if (pot.playerDecision === 'pending') {
        pot.playerDecision = 'cooperate'
      }
      shouldResolve = true
    } else if (pot.playerDecision !== 'pending') {
      shouldResolve = true
    }

    if (shouldResolve) {
      pot.resolved = true
      pot.resolveTimer = 1.0

      // Compute resolution position (midpoint of player head and agent head)
      const playerHead = centipede.segments[0]
      const agentHead = agent.centipede.segments[0]
      const rx = (playerHead.x + agentHead.x) / 2
      const ry = (playerHead.y + agentHead.y) / 2

      const pDecision = pot.playerDecision
      const aDecision = pot.agentDecision

      if (pDecision === 'cooperate' && aDecision === 'cooperate') {
        return { type: 'both_cooperate', potSize: pot.potSize, x: rx, y: ry }
      } else if (pDecision === 'defect' && aDecision === 'cooperate') {
        return { type: 'player_defects', potSize: pot.potSize, x: rx, y: ry }
      } else if (pDecision === 'cooperate' && aDecision === 'defect') {
        return { type: 'agent_defects', potSize: pot.potSize, x: rx, y: ry }
      } else {
        return { type: 'both_defect', potSize: pot.potSize, x: rx, y: ry }
      }
    }

    return noResult
  }

  // --- Detection: check if player shares a leaf with any agent ---
  const playerLeaf = centipede.currentLeaf
  if (playerLeaf < 0 || playerLeaf >= tree.leaves.length) return noResult

  for (let i = 0; i < agents.agents.length; i++) {
    const agent = agents.agents[i]
    if (agent.currentLeaf === playerLeaf && agent.targetLeaf === -1) {
      // Start a new pot
      const basePot = 5
      pot.active = true
      pot.agentIndex = i
      pot.leafIndex = playerLeaf
      pot.timer = 0
      pot.duration = 2.0
      pot.playerDecision = 'pending'
      pot.agentDecision = decideForAgent(agent)
      pot.resolved = false
      pot.resolveTimer = 0
      pot.potSize = basePot * (1 + karma.beauty * 2)
      break
    }
  }

  return noResult
}
