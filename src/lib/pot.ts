// Bond mechanic — proximity-based cooperation/defection between centipedes
//
// When the player is NEAR an agent (~180px), a thread forms and oscillates
// blue↔red. Click at blue = cooperate, click at red = defect.
// The spectrum is continuous — where you click determines the split ratio.
//
// Agents also bond with EACH OTHER so the player can observe and learn.
// The world teaches through visible consequences, not tutorials.

import type { AgentSystem, Agent } from './agents'
import type { Centipede } from './centipede'
import { removeMiddleSegment, addMiddleSegment } from './centipede'
import type { Tree } from './tree'
import type { KarmaState } from './persistence'

const BOND_RANGE = 180         // px — proximity to trigger bond
const BOND_OSCILLATION = 0.35  // oscillations per second (blue↔red) — slow, deliberate choice
const BOND_DURATION = 3.0      // seconds before auto-resolve
const BOND_COOLDOWN = 0.8      // quick cooldown — bonds should flow
const AGENT_BOND_RANGE = 220   // px — proximity for agent-agent bonds
const AGENT_BOND_CHANCE = 0.06  // per-frame chance of agent-agent bond forming

export type Bond = {
  // Participants
  isPlayerBond: boolean
  agentIdx: number           // the agent (for player bonds) or first agent (agent-agent)
  agent2Idx: number          // second agent for agent-agent bonds, -1 for player bonds

  // Spectrum state
  phase: number              // oscillation phase (radians)
  elapsed: number            // time since bond started

  // Stakes — segments are the currency. You literally offer your body.
  stake1: number             // segments staked by player/agent1
  stake2: number             // segments staked by agent/agent2
  potSize: number            // stake1 + stake2 (for dust calculations)

  // Resolution
  resolved: boolean
  resolveTimer: number
  spectrumValue: number      // 0=red(defect), 1=blue(cooperate) — where the click landed
  agentChoice: number        // 0-1 — what the NPC chose (hidden until resolve)
}

export type PotState = {
  bonds: Bond[]
  cooldownTimer: number      // global cooldown after player bond resolves
}

export type BondResult = {
  type: 'none' | 'cooperate' | 'defect' | 'mutual_defect'
  spectrumValue: number      // 0-1, how cooperative the resolution was
  potSize: number
  stake1: number             // segments staked by player/agent1
  stake2: number             // segments staked by agent/agent2
  playerX: number
  playerY: number
  agentX: number
  agentY: number
  agentIdx: number
  agent2Idx: number
  isPlayerBond: boolean
}

export function createPot(): PotState {
  return { bonds: [], cooldownTimer: 0 }
}

// Player clicks during an active bond
export function handlePotClick(pot: PotState): void {
  for (const bond of pot.bonds) {
    if (bond.isPlayerBond && !bond.resolved) {
      // Spectrum value at click time determines cooperation level
      bond.spectrumValue = (Math.sin(bond.phase) + 1) / 2 // 0=red, 1=blue
      bond.resolved = true
      bond.resolveTimer = 1.2
      return
    }
  }
}

// Seed the pot based on karma history + personality
function seedPot(
  karma: KarmaState, playerCentipede: Centipede, agent: Agent,
): { stake1: number; stake2: number; potSize: number } {
  // Segments ARE the currency. You offer part of your body.
  // World karma determines how much you're willing to risk.
  const worldHealth = karma.beauty * 0.6 + karma.trust * 0.4
  const riskFraction = 0.15 + worldHealth * 0.45 // 15-60% of body — real stakes

  // Player stakes — always leave at least 3 segments (head + 1 + tail)
  const playerLen = playerCentipede.segments.length
  const stake1 = Math.max(1, Math.min(playerLen - 3, Math.floor(playerLen * riskFraction)))

  // Agent stakes — same minimum
  const agentLen = agent.centipede.segments.length
  const agentRisk = (agent.personality === 'always_coop' || agent.personality === 'generous_tft') ? riskFraction * 1.2
    : agent.personality === 'always_defect' ? riskFraction * 0.6
    : riskFraction
  const stake2 = Math.max(1, Math.min(agentLen - 3, Math.floor(agentLen * agentRisk)))

  return { stake1, stake2, potSize: stake1 + stake2 }
}

function seedAgentPot(
  karma: KarmaState, a1: Agent, a2: Agent,
): { stake1: number; stake2: number; potSize: number } {
  const worldHealth = karma.beauty * 0.6 + karma.trust * 0.4
  const riskFraction = 0.15 + worldHealth * 0.45

  const risk1 = (a1.personality === 'always_coop' || a1.personality === 'generous_tft') ? riskFraction * 1.2
    : a1.personality === 'always_defect' ? riskFraction * 0.6 : riskFraction
  const risk2 = (a2.personality === 'always_coop' || a2.personality === 'generous_tft') ? riskFraction * 1.2
    : a2.personality === 'always_defect' ? riskFraction * 0.6 : riskFraction

  const s1 = Math.max(1, Math.min(a1.centipede.segments.length - 3, Math.floor(a1.centipede.segments.length * risk1)))
  const s2 = Math.max(1, Math.min(a2.centipede.segments.length - 3, Math.floor(a2.centipede.segments.length * risk2)))
  return { stake1: s1, stake2: s2, potSize: s1 + s2 }
}

// Agent's cooperation level — based on IPD strategy + world karma influence
function agentChoice(agent: Agent, karma: KarmaState): number {
  const worldShift = (karma.beauty - karma.corruption) * 0.15
  const fuzz = (Math.random() - 0.5) * 0.15 // subtle noise
  let base: number

  switch (agent.personality) {
    case 'always_coop':
      base = 0.95
      break
    case 'always_defect':
      base = 0.1
      break
    case 'random':
      base = 0.5 + (Math.random() - 0.5) * 0.8 // wide swing
      break
    case 'tit_for_tat':
      // Mirror last experience: cooperate if last was good, defect if betrayed
      base = agent.lastBondResult === 'was_defected' ? 0.15
        : agent.lastBondResult === null ? 0.85 // start cooperative
        : 0.85
      break
    case 'generous_tft':
      // Like TFT but 30% chance of forgiving a defection
      if (agent.lastBondResult === 'was_defected') {
        base = Math.random() < 0.3 ? 0.8 : 0.15 // forgive 30%
      } else {
        base = 0.9
      }
      break
    case 'forgiving_tft':
      // Only retaliate if defected on TWICE in a row
      base = (agent.lastBondResult === 'was_defected' && agent.prevBondResult === 'was_defected')
        ? 0.15 : 0.85
      break
    case 'grudger':
      // Cooperate until betrayed once, then defect FOREVER
      base = agent.everBetrayed ? 0.05 : 0.9
      break
    case 'detective':
      // First 3 bonds: test with C, D, C. If never punished, exploit. Else TFT.
      if (agent.bondCount < 3) {
        base = agent.bondCount === 1 ? 0.1 : 0.9 // second bond is a test defection
      } else if (!agent.everBetrayed) {
        base = 0.1 // nobody punished me → exploit
      } else {
        // Play TFT
        base = agent.lastBondResult === 'was_defected' ? 0.15 : 0.85
      }
      break
    case 'pavlov':
      // Cooperate if last outcome was mutual (both coop or both defect)
      // Defect if last outcome was mixed
      if (agent.lastBondResult === 'cooperated' || agent.lastBondResult === 'mutual_defect') {
        base = 0.85 // repeat — things were "aligned"
      } else if (agent.lastBondResult === 'was_defected' || agent.lastBondResult === 'defected') {
        base = 0.2 // switch — things were "misaligned"
      } else {
        base = 0.85 // default start
      }
      break
    case 'joss':
      // TFT but sneaks in random defections ~15% of the time
      if (agent.lastBondResult === 'was_defected') {
        base = 0.15
      } else {
        base = Math.random() < 0.15 ? 0.15 : 0.85 // sneaky defect
      }
      break
    case 'simpleton':
      // If opponent cooperated last time, repeat own last move
      // If opponent defected, do opposite of own last move
      if (agent.lastBondResult === 'cooperated' || agent.lastBondResult === null) {
        base = agent.lastOwnMove >= 0 ? agent.lastOwnMove : 0.85
      } else {
        base = agent.lastOwnMove >= 0 ? 1 - agent.lastOwnMove : 0.5
      }
      break
    default:
      base = 0.6
  }

  return Math.max(0, Math.min(1, base + worldShift + fuzz))
}

export function updatePot(
  pot: PotState,
  agents: AgentSystem,
  centipede: Centipede,
  tree: Tree,
  karma: KarmaState,
  dt: number,
): BondResult[] {
  const results: BondResult[] = []

  // Cooldown timer
  if (pot.cooldownTimer > 0) pot.cooldownTimer -= dt

  // Update existing bonds
  for (let i = pot.bonds.length - 1; i >= 0; i--) {
    const bond = pot.bonds[i]

    if (bond.resolved) {
      bond.resolveTimer -= dt
      if (bond.resolveTimer <= 0) {
        // Emit result and remove bond
        const result = resolveBond(bond, agents, centipede)
        results.push(result)
        pot.bonds.splice(i, 1)
        if (bond.isPlayerBond) pot.cooldownTimer = BOND_COOLDOWN
      }
      continue
    }

    // Advance oscillation
    bond.phase += BOND_OSCILLATION * Math.PI * 2 * dt
    bond.elapsed += dt

    // Check if participants moved too far apart
    const { dist } = getBondPositions(bond, agents, centipede)
    const maxRange = bond.isPlayerBond ? BOND_RANGE * 1.5 : AGENT_BOND_RANGE * 1.5
    if (dist > maxRange) {
      // Broke the bond — return staked segments to both participants
      if (bond.isPlayerBond) {
        for (let s = 0; s < bond.stake1; s++) addMiddleSegment(centipede)
        const a = agents.agents[bond.agentIdx]
        if (a) for (let s = 0; s < bond.stake2; s++) addMiddleSegment(a.centipede)
      } else {
        const a1 = agents.agents[bond.agentIdx]
        const a2 = agents.agents[bond.agent2Idx]
        if (a1) for (let s = 0; s < bond.stake1; s++) addMiddleSegment(a1.centipede)
        if (a2) for (let s = 0; s < bond.stake2; s++) addMiddleSegment(a2.centipede)
      }
      pot.bonds.splice(i, 1)
      if (bond.isPlayerBond) pot.cooldownTimer = 0.5
      continue
    }

    // Auto-resolve for agent-agent bonds or timed-out player bonds
    if (bond.elapsed >= BOND_DURATION) {
      if (bond.isPlayerBond && !bond.resolved) {
        // Player waited → auto-cooperate (patience rewarded)
        bond.spectrumValue = 0.9
      }
      if (!bond.isPlayerBond) {
        // Agent-agent: resolve based on personalities
        bond.spectrumValue = agentChoice(agents.agents[bond.agentIdx], karma)
      }
      bond.resolved = true
      bond.resolveTimer = 1.0
    }
  }

  // --- Detect new player-agent bonds ---
  if (pot.cooldownTimer <= 0 && !pot.bonds.some(b => b.isPlayerBond)) {
    const playerHead = centipede.segments[0]
    if (playerHead) {
      for (let i = 0; i < agents.agents.length; i++) {
        const agent = agents.agents[i]
        if (agent.targetLeaf >= 0) continue // don't bond with hopping agents
        const agentHead = agent.centipede.segments[0]
        if (!agentHead) continue

        const dx = playerHead.x - agentHead.x
        const dy = playerHead.y - agentHead.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < BOND_RANGE) {
          const { stake1, stake2, potSize } = seedPot(karma, centipede, agent)

          // Actually PUT UP the segments — you shrink as you commit
          for (let s = 0; s < stake1; s++) removeMiddleSegment(centipede)
          for (let s = 0; s < stake2; s++) removeMiddleSegment(agent.centipede)

          pot.bonds.push({
            isPlayerBond: true,
            agentIdx: i,
            agent2Idx: -1,
            phase: -Math.PI / 2,  // start at red — you must wait for blue
            elapsed: 0,
            stake1,
            stake2,
            potSize,
            resolved: false,
            resolveTimer: 0,
            spectrumValue: 0.5,
            agentChoice: agentChoice(agent, karma),
          })
          break
        }
      }
    }
  }

  // --- Detect agent-agent bonds ---
  if (Math.random() < AGENT_BOND_CHANCE) {
    for (let i = 0; i < agents.agents.length; i++) {
      // Skip if already in a bond
      if (pot.bonds.some(b => b.agentIdx === i || b.agent2Idx === i)) continue
      const a1 = agents.agents[i]
      if (a1.targetLeaf >= 0) continue
      const h1 = a1.centipede.segments[0]
      if (!h1) continue

      for (let j = i + 1; j < agents.agents.length; j++) {
        if (pot.bonds.some(b => b.agentIdx === j || b.agent2Idx === j)) continue
        const a2 = agents.agents[j]
        if (a2.targetLeaf >= 0) continue
        const h2 = a2.centipede.segments[0]
        if (!h2) continue

        const dx = h1.x - h2.x
        const dy = h1.y - h2.y
        if (dx * dx + dy * dy < AGENT_BOND_RANGE * AGENT_BOND_RANGE) {
          const { stake1, stake2, potSize } = seedAgentPot(karma, a1, a2)

          // Agents put up their segments too
          for (let s = 0; s < stake1; s++) removeMiddleSegment(a1.centipede)
          for (let s = 0; s < stake2; s++) removeMiddleSegment(a2.centipede)

          pot.bonds.push({
            isPlayerBond: false,
            agentIdx: i,
            agent2Idx: j,
            phase: Math.random() * Math.PI,
            elapsed: 0,
            stake1,
            stake2,
            potSize,
            resolved: false,
            resolveTimer: 0,
            spectrumValue: 0.5,
            agentChoice: agentChoice(a2, karma),
          })
          break
        }
      }
    }
  }

  return results
}

function getBondPositions(bond: Bond, agents: AgentSystem, centipede: Centipede): {
  x1: number; y1: number; x2: number; y2: number; dist: number
} {
  let x1: number, y1: number, x2: number, y2: number

  if (bond.isPlayerBond) {
    const ph = centipede.segments[0]
    const ah = agents.agents[bond.agentIdx]?.centipede.segments[0]
    x1 = ph?.x ?? 0; y1 = ph?.y ?? 0
    x2 = ah?.x ?? 0; y2 = ah?.y ?? 0
  } else {
    const h1 = agents.agents[bond.agentIdx]?.centipede.segments[0]
    const h2 = agents.agents[bond.agent2Idx]?.centipede.segments[0]
    x1 = h1?.x ?? 0; y1 = h1?.y ?? 0
    x2 = h2?.x ?? 0; y2 = h2?.y ?? 0
  }

  const dx = x2 - x1, dy = y2 - y1
  return { x1, y1, x2, y2, dist: Math.sqrt(dx * dx + dy * dy) }
}

function resolveBond(bond: Bond, agents: AgentSystem, centipede: Centipede): BondResult {
  const { x1, y1, x2, y2 } = getBondPositions(bond, agents, centipede)

  // Combine player/agent1 spectrum with agent/agent2 choice
  const myCoopLevel = bond.spectrumValue          // 0=defect, 1=cooperate
  const theirCoopLevel = bond.agentChoice          // 0=defect, 1=cooperate
  const avgCoop = (myCoopLevel + theirCoopLevel) / 2

  let type: BondResult['type']
  if (myCoopLevel > 0.5 && theirCoopLevel > 0.5) {
    type = 'cooperate'
  } else if (myCoopLevel <= 0.5 && theirCoopLevel <= 0.5) {
    type = 'mutual_defect'
  } else {
    type = 'defect' // one side defected
  }

  return {
    type,
    spectrumValue: avgCoop,
    potSize: bond.potSize,
    stake1: bond.stake1,
    stake2: bond.stake2,
    playerX: x1, playerY: y1,
    agentX: x2, agentY: y2,
    agentIdx: bond.agentIdx,
    agent2Idx: bond.agent2Idx,
    isPlayerBond: bond.isPlayerBond,
  }
}

// --- Getters for rendering ---

export function getActiveBonds(pot: PotState): Bond[] {
  return pot.bonds
}

export function getPlayerBond(pot: PotState): Bond | null {
  return pot.bonds.find(b => b.isPlayerBond) ?? null
}

export function getBondSpectrum(bond: Bond): number {
  // Returns 0-1: 0=red(defect), 1=blue(cooperate)
  return (Math.sin(bond.phase) + 1) / 2
}
