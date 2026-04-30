// Pot rendering — glowing thread between player and agent during cooperation/defection
// Thread pulses red→blue, orb at midpoint, resolution flash

import type { PotState } from './pot'

type Point = { x: number; y: number }

// Draw the pot interaction visual
// Call inside camera transform (after ctx.translate(-cam.x, -cam.y))
export function drawPot(
  ctx: CanvasRenderingContext2D,
  pot: PotState,
  playerHead: Point,
  agentHead: Point,
  time: number,
  scale: number,
): void {
  if (!pot.active) return

  const midX = (playerHead.x + agentHead.x) / 2
  const midY = (playerHead.y + agentHead.y) / 2

  // --- Resolution flash ---
  if (pot.resolved) {
    const flashProgress = 1 - pot.resolveTimer // 0→1 as resolve timer counts down from 1
    const flashAlpha = Math.max(0, (1 - flashProgress * 1.5)) * 0.8
    const flashRadius = (20 + flashProgress * 60) * scale

    if (pot.playerDecision === 'cooperate' && pot.agentDecision === 'cooperate') {
      // Gold flash for mutual cooperation
      ctx.beginPath()
      ctx.arc(midX, midY, flashRadius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(45, 80%, 70%, ${flashAlpha * 0.15})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(midX, midY, flashRadius * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(42, 75%, 80%, ${flashAlpha * 0.4})`
      ctx.fill()
    } else {
      // Dark purple flash for any defection
      ctx.beginPath()
      ctx.arc(midX, midY, flashRadius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(280, 40%, 25%, ${flashAlpha * 0.15})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(midX, midY, flashRadius * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(290, 35%, 20%, ${flashAlpha * 0.35})`
      ctx.fill()
    }

    // Fade remaining thread during resolve
    const fadeAlpha = Math.max(0, 1 - flashProgress * 2)
    if (fadeAlpha > 0.01) {
      drawThread(ctx, playerHead, agentHead, pot.timer, time, scale, fadeAlpha)
    }

    return
  }

  // --- Active pot: thread + orb ---
  drawThread(ctx, playerHead, agentHead, pot.timer, time, scale, 1)
  drawPotOrb(ctx, midX, midY, pot.potSize, pot.timer, time, scale)
}

// Glowing thread between player and agent
function drawThread(
  ctx: CanvasRenderingContext2D,
  p1: Point,
  p2: Point,
  timer: number, // 0-1
  time: number,
  scale: number,
  fadeAlpha: number,
): void {
  // Color interpolation based on timer:
  // < 0.3: red (defect zone)
  // 0.3-0.7: transition through amber to cyan
  // > 0.7: blue (cooperate zone)
  let hue: number
  let sat: number
  let lit: number

  if (timer < 0.3) {
    hue = 0 // red
    sat = 70
    lit = 60
  } else if (timer < 0.5) {
    // red → amber
    const t = (timer - 0.3) / 0.2
    hue = t * 35 // 0 → 35
    sat = 70 - t * 5
    lit = 60 + t * 5
  } else if (timer < 0.7) {
    // amber → cyan
    const t = (timer - 0.5) / 0.2
    hue = 35 + t * 175 // 35 → 210
    sat = 65 + t * 5
    lit = 65 - t * 5
  } else {
    hue = 210 // blue
    sat = 70
    lit = 60
  }

  // Pulsing width
  const pulseWidth = (2 + Math.sin(time * 6) * 1) * scale
  const glowWidth = pulseWidth * 3

  ctx.lineCap = 'round'

  // Outer glow halo
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.06 * fadeAlpha})`
  ctx.lineWidth = glowWidth
  ctx.stroke()

  // Mid glow
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.15 * fadeAlpha})`
  ctx.lineWidth = glowWidth * 0.5
  ctx.stroke()

  // Core thread
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, ${0.6 * fadeAlpha})`
  ctx.lineWidth = pulseWidth
  ctx.stroke()
}

// Glowing orb at the midpoint — the pot
function drawPotOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  potSize: number,
  timer: number,
  time: number,
  scale: number,
): void {
  // Orb size scales with pot size (clamped 4-16px base)
  const baseR = Math.max(4, Math.min(16, potSize * 0.8))
  const pulse = 0.85 + Math.sin(time * 4 + timer * Math.PI * 2) * 0.15
  const r = baseR * scale * pulse

  // Color matches the thread (timer-based)
  let hue: number
  if (timer < 0.3) hue = 0
  else if (timer < 0.7) hue = ((timer - 0.3) / 0.4) * 210
  else hue = 210

  // Outer glow
  ctx.beginPath()
  ctx.arc(x, y, r * 3, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.05)`
  ctx.fill()

  // Mid glow
  ctx.beginPath()
  ctx.arc(x, y, r * 1.8, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 65%, 65%, 0.12)`
  ctx.fill()

  // Core orb
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 60%, 75%, 0.55)`
  ctx.fill()

  // Hot center
  ctx.beginPath()
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, 50%, 90%, 0.7)`
  ctx.fill()
}
