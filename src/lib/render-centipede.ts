// Centipede rendering — bioluminescent glowing segments connected by thin light threads
// Draw order: glow layer (larger, dimmer) first, then solid segments on top

import type { Centipede } from './centipede'

type Camera = { x: number; y: number }

/** Render the centipede in world space. Call within a ctx.save()/restore() that has camera transform applied. */
export function drawCentipede(
  ctx: CanvasRenderingContext2D,
  centipede: Centipede,
  time: number,
  scale: number,
  cam: Camera,
  vpW: number,
  vpH: number,
  isPlayer: boolean = false,
): void {
  const { segments } = centipede
  if (segments.length === 0) return

  const margin = 60
  const totalSegments = segments.length

  // --- PASS 1: Glow layer (larger radii, low alpha) ---
  for (let i = 0; i < totalSegments; i++) {
    const seg = segments[i]

    // Off-screen culling
    if (seg.x < cam.x - margin || seg.x > cam.x + vpW + margin ||
        seg.y < cam.y - margin || seg.y > cam.y + vpH + margin) continue

    const isHead = i === 0
    // Brightness falls off from head to tail
    const t = totalSegments > 1 ? i / (totalSegments - 1) : 0
    const brightness = 1.0 - t * 0.7 // head=1.0, tail=0.3

    // Gentle pulse — each segment slightly out of phase for a wave effect
    const pulse = 0.85 + Math.sin(time * 2.5 + i * 0.4) * 0.15

    const glowRadius = (isHead ? 50 : 36 - t * 10) * scale * pulse
    const glowAlpha = brightness * 0.08 * pulse

    // Outer glow
    const glowHue = isPlayer ? 45 : 178
    ctx.beginPath()
    ctx.arc(seg.x, seg.y, glowRadius, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${glowHue}, 60%, 70%, ${glowAlpha})`
    ctx.fill()

    // Mid glow (tighter, slightly brighter)
    ctx.beginPath()
    ctx.arc(seg.x, seg.y, glowRadius * 0.55, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${glowHue}, 55%, 75%, ${glowAlpha * 1.5})`
    ctx.fill()
  }

  // --- PASS 2: Connecting lines (thin glowing threads between segments) ---
  if (totalSegments > 1) {
    ctx.lineCap = 'round'
    for (let i = 1; i < totalSegments; i++) {
      const prev = segments[i - 1]
      const seg = segments[i]

      // Skip if both off-screen
      const bothOffScreen =
        (prev.x < cam.x - margin && seg.x < cam.x - margin) ||
        (prev.x > cam.x + vpW + margin && seg.x > cam.x + vpW + margin) ||
        (prev.y < cam.y - margin && seg.y < cam.y - margin) ||
        (prev.y > cam.y + vpH + margin && seg.y > cam.y + vpH + margin)
      if (bothOffScreen) continue

      const t = i / (totalSegments - 1)
      const lineAlpha = (1.0 - t * 0.6) * 0.35
      const lineWidth = (2.0 - t * 0.8) * scale

      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(seg.x, seg.y)
      ctx.strokeStyle = `hsla(180, 50%, 72%, ${lineAlpha})`
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
  }

  // --- PASS 3: Solid segments (small bright circles) ---
  for (let i = totalSegments - 1; i >= 0; i--) {
    const seg = segments[i]

    // Off-screen culling
    if (seg.x < cam.x - margin || seg.x > cam.x + vpW + margin ||
        seg.y < cam.y - margin || seg.y > cam.y + vpH + margin) continue

    const isHead = i === 0
    const t = totalSegments > 1 ? i / (totalSegments - 1) : 0
    const brightness = 1.0 - t * 0.6

    const pulse = 0.9 + Math.sin(time * 2.5 + i * 0.4) * 0.1

    // Segment radius: head is larger, body tapers toward tail
    const segRadius = isHead
      ? 18 * scale * pulse
      : (14 - t * 4) * scale * pulse

    // Player: warm golden-amber. Agents: cool cyan.
    const hue = isPlayer
      ? (isHead ? 45 : 55 + t * 10)    // gold → amber
      : (isHead ? 172 : 180 + t * 8)   // teal → cyan
    const sat = isPlayer
      ? (isHead ? 80 : 65 - t * 10)
      : (isHead ? 65 : 55 - t * 10)
    const lit = isHead ? 88 : 82 - t * 12

    // Core segment
    ctx.beginPath()
    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${brightness * 0.85})`
    ctx.fill()

    // Bright center dot
    if (isHead || i % 2 === 0) {
      const dotRadius = segRadius * (isHead ? 0.5 : 0.4)
      ctx.beginPath()
      ctx.arc(seg.x, seg.y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue - 5}, ${Math.min(80, sat + 15)}%, ${Math.min(98, lit + 10)}%, ${brightness * 0.95})`
      ctx.fill()
    }
  }
}
