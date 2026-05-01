// Bond rendering — glowing threads between bonding centipedes
// Thread oscillates blue↔red continuously. Orb pulses at midpoint.
// Agent-agent bonds are also rendered so the player can observe.

import type { PotState, Bond } from './pot'
import { getBondSpectrum } from './pot'
import type { AgentSystem } from './agents'
import type { Centipede } from './centipede'

type Camera = { x: number; y: number }

export function drawPot(
  ctx: CanvasRenderingContext2D,
  pot: PotState,
  centipede: Centipede,
  agents: AgentSystem,
  time: number,
  scale: number,
  cam: Camera,
  vpW: number,
  vpH: number,
): void {
  for (const bond of pot.bonds) {
    const p1 = getBondPoint1(bond, centipede, agents)
    const p2 = getBondPoint2(bond, agents)
    if (!p1 || !p2) continue

    // Off-screen culling
    const margin = 100
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    if (maxX < cam.x - margin || minX > cam.x + vpW + margin ||
        maxY < cam.y - margin || minY > cam.y + vpH + margin) continue

    const spectrum = getBondSpectrum(bond)
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2

    if (bond.resolved) {
      drawResolutionFlash(ctx, midX, midY, bond, time, scale)
    } else {
      drawThread(ctx, p1, p2, spectrum, time, scale, 1, bond.isPlayerBond, bond.potSize)
      drawPotOrb(ctx, midX, midY, bond.potSize, spectrum, time, scale)
      // Floating stake dots — segments orbiting the bond midpoint
      drawStakeDots(ctx, p1, p2, bond.stake1, bond.stake2, spectrum, time, scale)
    }
  }
}

function getBondPoint1(bond: Bond, centipede: Centipede, agents: AgentSystem) {
  if (bond.isPlayerBond) {
    const s = centipede.segments[0]
    return s ? { x: s.x, y: s.y } : null
  }
  const s = agents.agents[bond.agentIdx]?.centipede.segments[0]
  return s ? { x: s.x, y: s.y } : null
}

function getBondPoint2(bond: Bond, agents: AgentSystem) {
  const idx = bond.isPlayerBond ? bond.agentIdx : bond.agent2Idx
  const s = agents.agents[idx]?.centipede.segments[0]
  return s ? { x: s.x, y: s.y } : null
}

function drawResolutionFlash(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  bond: Bond,
  _time: number,
  scale: number,
): void {
  const progress = 1 - bond.resolveTimer / 1.2
  const alpha = Math.max(0, 1 - progress * 1.5) * 0.8
  const radius = (20 + progress * 80) * scale

  const isGood = bond.spectrumValue > 0.5

  if (isGood) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(45, 80%, 70%, ${alpha * 0.12})`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(42, 75%, 80%, ${alpha * 0.35})`
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(280, 40%, 25%, ${alpha * 0.12})`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(290, 35%, 20%, ${alpha * 0.3})`
    ctx.fill()
  }
}

function drawThread(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  spectrum: number,
  time: number,
  scale: number,
  fadeAlpha: number,
  isPlayer: boolean,
  potSize: number = 1,
): void {
  const hue = spectrum * 210
  const sat = 65 + spectrum * 10
  const lit = 55 + spectrum * 15

  // Thread thickness scales with stakes — bigger pot = thicker thread
  const stakeScale = Math.min(3, 1 + potSize * 0.08)
  const pulseWidth = (isPlayer ? 2.5 : 1.5) * scale * stakeScale + Math.sin(time * 6) * 0.8 * scale
  const glowWidth = pulseWidth * 3

  ctx.lineCap = 'round'

  // Outer glow
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.06 * fadeAlpha * stakeScale})`
  ctx.lineWidth = glowWidth
  ctx.stroke()

  // Core thread
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, ${(isPlayer ? 0.6 : 0.3) * fadeAlpha})`
  ctx.lineWidth = pulseWidth
  ctx.stroke()
}

// Floating dots representing staked segments — orbit between the two participants
function drawStakeDots(
  ctx: CanvasRenderingContext2D,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  stake1: number,
  stake2: number,
  spectrum: number,
  time: number,
  scale: number,
): void {
  const hue = spectrum * 210
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const dx = p2.x - p1.x, dy = p2.y - p1.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) return

  const dotR = 2.5 * scale
  const total = Math.min(stake1 + stake2, 20) // cap visual dots at 20

  for (let i = 0; i < total; i++) {
    // Dots flow from both ends toward the middle — the pot forming
    const baseT = (i + 0.5) / total // 0-1 along the thread
    const side = i < stake1 ? -1 : 1 // which participant this dot came from

    // Orbit around the thread line
    const orbitR = (8 + Math.sin(i * 2.1) * 4) * scale
    const orbitAngle = time * 3 + i * 1.2
    const perpX = -dy / dist, perpY = dx / dist

    // Position along the thread with gentle flow toward center
    const flowT = baseT + Math.sin(time * 2 + i * 0.7) * 0.05
    const dotX = p1.x + dx * flowT + perpX * Math.sin(orbitAngle) * orbitR
    const dotY = p1.y + dy * flowT + perpY * Math.sin(orbitAngle) * orbitR

    // Color: dots from p1 side are slightly different from p2 side
    const dotHue = hue + side * 15
    const alpha = 0.5 + Math.sin(time * 4 + i) * 0.2

    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${dotHue}, 60%, 70%, ${alpha})`
    ctx.fill()
  }
}

function drawPotOrb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  potSize: number,
  spectrum: number,
  time: number,
  scale: number,
): void {
  const baseR = Math.max(4, Math.min(14, potSize * 0.6))
  const pulse = 0.85 + Math.sin(time * 4) * 0.15
  const r = baseR * scale * pulse
  const hue = spectrum * 210

  ctx.beginPath()
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.05)`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 60%, 75%, 0.45)`
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 50%, 90%, 0.65)`
  ctx.fill()
}
