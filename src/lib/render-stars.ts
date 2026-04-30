// Star field rendering for The Clearing v2
// Draws stars, rain drops, and dust particles.
// No createRadialGradient in hot path — all glow done with layered arcs.

import type { StarField } from './stars'

type Camera = { x: number; y: number }

function onScreen(x: number, y: number, cam: Camera, w: number, h: number, margin: number = 80): boolean {
  return x >= cam.x - margin && x <= cam.x + w + margin && y >= cam.y - margin && y <= cam.y + h + margin
}

// Draw the full star field: stars, rain, dust
// Call this inside the camera transform (after ctx.translate(-cam.x, -cam.y))
export function drawStarField(
  ctx: CanvasRenderingContext2D,
  field: StarField,
  cam: Camera,
  w: number,
  h: number,
  time: number,
  scale: number,
): void {
  drawDust(ctx, field, cam, w, h, time, scale)
  drawStars(ctx, field, cam, w, h, time, scale)
  drawRain(ctx, field, cam, w, h, scale)
}

// Stars: warm golden-white glow, multi-layer, pulse with phase, dim as life decreases
function drawStars(
  ctx: CanvasRenderingContext2D,
  field: StarField,
  cam: Camera,
  w: number,
  h: number,
  time: number,
  scale: number,
): void {
  for (const star of field.stars) {
    if (star.life <= 0) continue

    const margin = 200 * scale
    if (!onScreen(star.x, star.y, cam, w, h, margin)) continue

    const pulse = 0.85 + Math.sin(time * 2.2 + star.phase) * 0.1 + Math.sin(time * 0.9 + star.phase * 1.5) * 0.05
    const b = Math.max(0, star.brightness) * pulse

    // Outer halo — large, very dim
    const haloR = (35 + star.life * 25) * scale
    ctx.beginPath()
    ctx.arc(star.x, star.y, haloR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(42, 80%, 75%, ${b * 0.04})`
    ctx.fill()

    // Mid glow — warm golden
    const midR = (18 + star.life * 12) * scale
    ctx.beginPath()
    ctx.arc(star.x, star.y, midR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(38, 70%, 80%, ${b * 0.12})`
    ctx.fill()

    // Bright core — white-gold
    const coreR = (6 + star.life * 4) * scale
    ctx.beginPath()
    ctx.arc(star.x, star.y, coreR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(45, 60%, 92%, ${b * 0.6})`
    ctx.fill()

    // Hot center dot
    const dotR = (2 + star.life * 1.5) * scale
    ctx.beginPath()
    ctx.arc(star.x, star.y, dotR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(50, 50%, 97%, ${b * 0.85})`
    ctx.fill()
  }
}

// Rain: thin bright streaks falling downward, cyan-white
function drawRain(
  ctx: CanvasRenderingContext2D,
  field: StarField,
  cam: Camera,
  w: number,
  h: number,
  scale: number,
): void {
  if (field.rain.length === 0) return

  ctx.lineCap = 'round'

  for (const drop of field.rain) {
    if (!onScreen(drop.x, drop.y, cam, w, h, 30)) continue

    const alpha = drop.brightness * 0.7
    if (alpha < 0.02) continue

    // Rain streak — thin vertical line showing velocity
    const streakLen = Math.min(drop.vy * 0.08, 18) * scale
    const lineW = (1.2 + drop.brightness * 0.6) * scale

    // Glow around the drop
    ctx.beginPath()
    ctx.moveTo(drop.x, drop.y - streakLen)
    ctx.lineTo(drop.x, drop.y)
    ctx.strokeStyle = `hsla(190, 70%, 80%, ${alpha * 0.2})`
    ctx.lineWidth = lineW * 3
    ctx.stroke()

    // Bright core streak
    ctx.beginPath()
    ctx.moveTo(drop.x, drop.y - streakLen)
    ctx.lineTo(drop.x, drop.y)
    ctx.strokeStyle = `hsla(185, 60%, 90%, ${alpha})`
    ctx.lineWidth = lineW
    ctx.stroke()
  }
}

// Dust: small particles drifting upward
// Golden = warm golden glow, Black = dark with purple-red tint
function drawDust(
  ctx: CanvasRenderingContext2D,
  field: StarField,
  cam: Camera,
  w: number,
  h: number,
  time: number,
  scale: number,
): void {
  for (const dust of field.dust) {
    if (dust.life <= 0) continue
    if (!onScreen(dust.x, dust.y, cam, w, h, 20)) continue

    const alpha = dust.life * dust.brightness

    if (dust.golden) {
      // Golden dust — warm glow
      const pulse = 0.8 + Math.sin(time * 3 + dust.x * 0.01) * 0.2
      const r = (2 + dust.life * 1.5) * scale * pulse

      // Outer glow
      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r * 3, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(45, 80%, 65%, ${alpha * 0.06})`
      ctx.fill()

      // Core
      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(42, 75%, 75%, ${alpha * 0.5})`
      ctx.fill()
    } else {
      // Black dust — dark with faint purple-red tint
      const r = (2 + dust.life * 1.2) * scale

      // Faint tinted glow
      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(310, 40%, 25%, ${alpha * 0.08})`
      ctx.fill()

      // Dark core
      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(320, 30%, 18%, ${alpha * 0.4})`
      ctx.fill()
    }
  }
}
