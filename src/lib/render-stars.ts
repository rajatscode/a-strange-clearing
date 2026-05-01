// Star field rendering — sun-like stars with cached offscreen textures
// Stars are pre-rendered to offscreen canvases at creation, then drawn as images.
// This gives photo-realistic sun look at 1-2 draw calls per star per frame.

import type { StarField } from './stars'

type Camera = { x: number; y: number }

function onScreen(x: number, y: number, cam: Camera, w: number, h: number, margin: number = 80): boolean {
  return x >= cam.x - margin && x <= cam.x + w + margin && y >= cam.y - margin && y <= cam.y + h + margin
}

// ─── Star texture cache ───
// 5 template textures generated at startup, reused for all stars

const STAR_CACHE_SIZE = 256
const STAR_TEMPLATE_COUNT = 5
let starTemplates: OffscreenCanvas[] | null = null

function getStarTemplates(): OffscreenCanvas[] {
  if (starTemplates) return starTemplates
  starTemplates = []

  for (let t = 0; t < STAR_TEMPLATE_COUNT; t++) {
    const canvas = new OffscreenCanvas(STAR_CACHE_SIZE, STAR_CACHE_SIZE)
    const ctx = canvas.getContext('2d')!
    const cx = STAR_CACHE_SIZE / 2, cy = STAR_CACHE_SIZE / 2
    const maxR = STAR_CACHE_SIZE / 2

    // Vary hue per template: blue-white, golden, amber, orange, red
    const hues = [220, 45, 35, 20, 5]
    const hue = hues[t]
    const sat = t < 2 ? 40 : 60

    // ── Background: transparent ──
    ctx.clearRect(0, 0, STAR_CACHE_SIZE, STAR_CACHE_SIZE)

    // ── Corona wisps — stringy structures extending outward ──
    const wispCount = 20 + t * 5
    for (let w = 0; w < wispCount; w++) {
      const angle = (w / wispCount) * Math.PI * 2 + Math.sin(w * 7.3 + t) * 0.3
      const len = maxR * (0.4 + Math.abs(Math.sin(w * 3.7 + t * 5)) * 0.55)
      const wispW = 2 + Math.abs(Math.sin(w * 11.3 + t * 3)) * 4

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      // Wispy curve — slight bend
      const midAngle = angle + Math.sin(w * 2.1) * 0.15
      const midR = len * 0.6
      ctx.quadraticCurveTo(
        cx + Math.cos(midAngle) * midR,
        cy + Math.sin(midAngle) * midR,
        cx + Math.cos(angle) * len,
        cy + Math.sin(angle) * len,
      )
      ctx.strokeStyle = `hsla(${hue + Math.sin(w) * 15}, ${sat}%, 80%, 0.06)`
      ctx.lineWidth = wispW
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // ── Outer glow — radial gradient (allowed on cache canvas) ──
    const outerGrad = ctx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR * 0.85)
    outerGrad.addColorStop(0, `hsla(${hue}, ${sat}%, 85%, 0.15)`)
    outerGrad.addColorStop(0.5, `hsla(${hue}, ${sat + 10}%, 70%, 0.06)`)
    outerGrad.addColorStop(1, `hsla(${hue}, ${sat}%, 60%, 0)`)
    ctx.beginPath()
    ctx.arc(cx, cy, maxR * 0.85, 0, Math.PI * 2)
    ctx.fillStyle = outerGrad
    ctx.fill()

    // ── Main disc with limb darkening ──
    const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.35)
    discGrad.addColorStop(0, `hsla(${hue}, 20%, 98%, 0.95)`)     // white-hot center
    discGrad.addColorStop(0.3, `hsla(${hue}, ${sat - 10}%, 90%, 0.85)`)
    discGrad.addColorStop(0.6, `hsla(${hue}, ${sat}%, 75%, 0.7)`)
    discGrad.addColorStop(0.85, `hsla(${hue}, ${sat + 15}%, 55%, 0.5)`) // limb darkening
    discGrad.addColorStop(1, `hsla(${hue}, ${sat + 20}%, 40%, 0.15)`)
    ctx.beginPath()
    ctx.arc(cx, cy, maxR * 0.35, 0, Math.PI * 2)
    ctx.fillStyle = discGrad
    ctx.fill()

    // ── Surface granulation — mottled texture (darker spots) ──
    const spotCount = 12 + t * 3
    for (let s = 0; s < spotCount; s++) {
      const sAngle = Math.sin(s * 7.7 + t * 3) * Math.PI * 2
      const sDist = Math.abs(Math.sin(s * 4.3 + t)) * maxR * 0.25
      const sR = 3 + Math.abs(Math.sin(s * 9.1 + t * 7)) * 8
      ctx.beginPath()
      ctx.arc(cx + Math.cos(sAngle) * sDist, cy + Math.sin(sAngle) * sDist, sR, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue + 10}, ${sat + 10}%, 45%, 0.08)`
      ctx.fill()
    }

    // ── Bright center highlight ──
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.12)
    centerGrad.addColorStop(0, `hsla(${hue}, 10%, 100%, 0.9)`)
    centerGrad.addColorStop(1, `hsla(${hue}, 20%, 95%, 0)`)
    ctx.beginPath()
    ctx.arc(cx, cy, maxR * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = centerGrad
    ctx.fill()

    starTemplates.push(canvas)
  }

  return starTemplates
}

// ─── Main draw function ───

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
  drawScars(ctx, field, cam, w, h)
}

// ─── Stars: cached sun textures with animation ───

function drawStars(
  ctx: CanvasRenderingContext2D,
  field: StarField,
  cam: Camera,
  w: number,
  h: number,
  time: number,
  scale: number,
): void {
  const templates = getStarTemplates()

  for (const star of field.stars) {
    if (star.life <= 0) continue

    // Size: stars are HUGE. Scale with life.
    const starRadius = (80 + star.life * 120) * scale
    const margin = starRadius * 2
    if (!onScreen(star.x, star.y, cam, w, h, margin)) continue

    // Pick template based on life stage (young=blue[0], dying=red[4])
    const templateIdx = Math.min(STAR_TEMPLATE_COUNT - 1, Math.floor((1 - star.life) * STAR_TEMPLATE_COUNT))
    const template = templates[templateIdx]

    // Brightness with heartbeat pulse
    const beat = Math.pow(Math.abs(Math.sin(time * 3.5 + star.phase)), 0.3)
    const flicker = 0.9 + Math.sin(time * 7 + star.phase * 3) * 0.08
    const alpha = Math.max(0.05, star.brightness * beat * flicker)

    // Draw the cached star texture
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(star.x, star.y)
    // Slow rotation — the corona rotates
    ctx.rotate(time * 0.1 + star.phase)

    const drawSize = starRadius * 2
    ctx.drawImage(template, -drawSize / 2, -drawSize / 2, drawSize, drawSize)

    ctx.restore()

    // ── Animated flare rays on top (2-3 simple lines, cheap) ──
    const flareCount = 3
    for (let f = 0; f < flareCount; f++) {
      const fAngle = (f / flareCount) * Math.PI * 2 + time * 0.3 + star.phase
      const fLen = starRadius * (0.8 + Math.abs(Math.sin(time * 4 + star.phase * 5 + f * 2.3)) * 0.8)
      const fW = (2 + star.life * 3) * scale

      ctx.beginPath()
      ctx.moveTo(star.x, star.y)
      ctx.lineTo(
        star.x + Math.cos(fAngle) * fLen,
        star.y + Math.sin(fAngle) * fLen,
      )
      ctx.strokeStyle = `hsla(45, 60%, 90%, ${alpha * 0.07})`
      ctx.lineWidth = fW * 3
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  }
}

// ─── Rain: liquid light streaming down ───

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
    if (!onScreen(drop.x, drop.y, cam, w, h, 40)) continue

    const alpha = drop.brightness * 0.7
    if (alpha < 0.02) continue

    const streakLen = Math.min(drop.vy * 0.15, 35) * scale
    const lineW = (1 + drop.brightness * 0.8) * scale
    const wave = Math.sin(drop.y * 0.03 + drop.x * 0.01) * 2 * scale

    // Trail glow
    ctx.beginPath()
    ctx.moveTo(drop.x + wave * 0.5, drop.y - streakLen * 1.5)
    ctx.quadraticCurveTo(drop.x + wave, drop.y - streakLen * 0.5, drop.x, drop.y)
    ctx.strokeStyle = `hsla(195, 70%, 80%, ${alpha * 0.12})`
    ctx.lineWidth = lineW * 4
    ctx.stroke()

    // Core streak
    ctx.beginPath()
    ctx.moveTo(drop.x + wave * 0.3, drop.y - streakLen)
    ctx.quadraticCurveTo(drop.x + wave * 0.5, drop.y - streakLen * 0.3, drop.x, drop.y)
    ctx.strokeStyle = `hsla(190, 60%, 92%, ${alpha * 0.8})`
    ctx.lineWidth = lineW
    ctx.stroke()

    // Drop head
    ctx.beginPath()
    ctx.arc(drop.x, drop.y, lineW * 1.2, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(185, 50%, 95%, ${alpha * 0.6})`
    ctx.fill()
  }
}

// ─── Dust particles ───

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
      const pulse = 0.8 + Math.sin(time * 3 + dust.x * 0.01) * 0.2
      const r = (2 + dust.life * 1.5) * scale * pulse

      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r * 3, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(45, 80%, 65%, ${alpha * 0.06})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(42, 75%, 75%, ${alpha * 0.5})`
      ctx.fill()
    } else {
      const r = (2 + dust.life * 1.2) * scale

      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(310, 40%, 25%, ${alpha * 0.08})`
      ctx.fill()

      ctx.beginPath()
      ctx.arc(dust.x, dust.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(320, 30%, 18%, ${alpha * 0.4})`
      ctx.fill()
    }
  }
}

// ─── Star scars ───

function drawScars(
  ctx: CanvasRenderingContext2D,
  starField: StarField,
  cam: Camera,
  vpW: number,
  vpH: number,
): void {
  for (const scar of starField.scars) {
    if (scar.x < cam.x - 60 || scar.x > cam.x + vpW + 60 ||
        scar.y < cam.y - 60 || scar.y > cam.y + vpH + 60) continue

    const hue = scar.fromBlackDust ? 280 : 45
    const alpha = scar.alpha * 0.3
    ctx.beginPath()
    ctx.arc(scar.x, scar.y, scar.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${hue}, 40%, 50%, ${alpha})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
