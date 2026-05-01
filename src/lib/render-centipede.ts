// Caterpillar rendering — The Very Hungry Caterpillar aesthetic
//
// Plump oval segments that overlap, distinct head with eyes and antennae,
// tiny feet underneath, highlight sheen on top for 3D feel.
// Each individual has unique color variation (seeded by index, NOT personality).

import type { Centipede } from './centipede'

type Camera = { x: number; y: number }

// Seeded color palette per individual — NOT tied to personality
function getColorPalette(seed: number, isPlayer: boolean) {
  if (isPlayer) {
    return {
      headHue: 8,        // rich red head (like the book!)
      bodyHue: 120,       // green body
      bodySat: 55,
      bodyLit: 42,
      sheenLit: 62,
      glowHue: 90,
    }
  }
  // Each agent gets a unique but subtle variation
  // Hash the seed into a hue range — all natural/earthy tones
  const h = ((seed * 137.5) % 360)
  // Restrict to natural caterpillar colors: greens, browns, olives, teals
  const hueOptions = [85, 95, 110, 130, 145, 160, 50, 65, 35, 170]
  const baseHue = hueOptions[Math.floor(Math.abs(Math.sin(seed * 7.3)) * hueOptions.length)]
  const hueShift = ((h % 20) - 10) // ±10 variation
  return {
    headHue: (baseHue + 30 + hueShift) % 360, // head is a shifted tone
    bodyHue: baseHue + hueShift,
    bodySat: 40 + (Math.abs(Math.sin(seed * 3.7)) * 20),
    bodyLit: 35 + (Math.abs(Math.sin(seed * 5.1)) * 15),
    sheenLit: 55 + (Math.abs(Math.sin(seed * 2.3)) * 15),
    glowHue: baseHue,
  }
}

export function drawCentipede(
  ctx: CanvasRenderingContext2D,
  centipede: Centipede,
  time: number,
  scale: number,
  cam: Camera,
  vpW: number,
  vpH: number,
  isPlayer: boolean = false,
  seed: number = 0,
): void {
  const { segments } = centipede
  if (segments.length === 0) return

  const margin = 80
  const n = segments.length
  const pal = getColorPalette(seed, isPlayer)

  // --- PASS 1: Soft ambient glow (very subtle, sells bioluminescence) ---
  const headSeg = segments[0]
  if (headSeg.x > cam.x - margin && headSeg.x < cam.x + vpW + margin &&
      headSeg.y > cam.y - margin && headSeg.y < cam.y + vpH + margin) {
    const glowR = (isPlayer ? 60 : 40) * scale
    ctx.beginPath()
    ctx.arc(headSeg.x, headSeg.y, glowR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${pal.glowHue}, 50%, 60%, ${isPlayer ? 0.06 : 0.04})`
    ctx.fill()
  }

  // --- PASS 2: Body segments (back to front for overlap) ---
  for (let i = n - 1; i >= 0; i--) {
    const seg = segments[i]

    // Off-screen culling
    if (seg.x < cam.x - margin || seg.x > cam.x + vpW + margin ||
        seg.y < cam.y - margin || seg.y > cam.y + vpH + margin) continue

    const isHead = i === 0
    const isTail = i === n - 1
    const t = n > 1 ? i / (n - 1) : 0 // 0=head, 1=tail

    // Segment dimensions — plump ovals, head is bigger
    const baseW = isHead ? 20 : isTail ? 11 : 14 - t * 3
    const baseH = isHead ? 17 : isTail ? 10 : 13 - t * 2
    const pulse = 0.95 + Math.sin(time * 2 + i * 0.5) * 0.05
    const w = baseW * scale * pulse
    const h = baseH * scale * pulse

    // Head NEVER rotates — always upright. Body segments orient along chain.
    let angle = 0
    if (!isHead && i > 0) {
      const prev = segments[i - 1]
      angle = Math.atan2(prev.y - seg.y, prev.x - seg.x)
    }

    ctx.save()
    ctx.translate(seg.x, seg.y)
    ctx.rotate(angle)

    // Color: gradual hue shift from head to tail
    const segHue = isHead ? pal.headHue : pal.bodyHue + t * 15
    const segSat = isHead ? 65 : pal.bodySat - t * 10
    const segLit = isHead ? 45 : pal.bodyLit + t * 5

    // Main body oval
    ctx.beginPath()
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${segHue}, ${segSat}%, ${segLit}%)`
    ctx.fill()

    // Sheen highlight (top crescent — 3D plumpness)
    ctx.beginPath()
    ctx.ellipse(0, -h * 0.25, w * 0.7, h * 0.4, 0, Math.PI, 0) // top half only
    ctx.fillStyle = `hsla(${segHue}, ${Math.max(20, segSat - 15)}%, ${pal.sheenLit}%, 0.4)`
    ctx.fill()

    // Dark underside (subtle shadow)
    ctx.beginPath()
    ctx.ellipse(0, h * 0.2, w * 0.8, h * 0.35, 0, 0, Math.PI)
    ctx.fillStyle = `hsla(${segHue}, ${segSat}%, ${Math.max(15, segLit - 15)}%, 0.3)`
    ctx.fill()

    // Tiny feet (two nubs on the bottom) — not on head or tail
    if (!isHead && !isTail) {
      const footY = h * 0.85
      const footR = 2.5 * scale
      ctx.fillStyle = `hsla(${segHue}, ${segSat - 10}%, ${segLit - 10}%, 0.6)`
      ctx.beginPath()
      ctx.arc(-w * 0.4, footY, footR, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(w * 0.4, footY, footR, 0, Math.PI * 2)
      ctx.fill()
    }

    // HEAD features — eyes on top, antennae on top. Always upright.
    if (isHead) {
      const eyeR = 3 * scale
      const eyeOffX = w * 0.3
      const eyeOffY = -h * 0.2

      // Eye whites
      ctx.fillStyle = `hsla(60, 30%, 90%, 0.9)`
      ctx.beginPath()
      ctx.arc(-eyeOffX, eyeOffY, eyeR, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(eyeOffX, eyeOffY, eyeR, 0, Math.PI * 2)
      ctx.fill()

      // Pupils — look in movement direction
      const pupilX = scale * 0.7 * (centipede.direction > 0 ? 1 : -1)
      ctx.fillStyle = `hsla(0, 0%, 10%, 0.85)`
      ctx.beginPath()
      ctx.arc(-eyeOffX + pupilX, eyeOffY, eyeR * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(eyeOffX + pupilX, eyeOffY, eyeR * 0.5, 0, Math.PI * 2)
      ctx.fill()

      // Antennae — two lines from top of head
      const antLen = 12 * scale
      const antX = w * 0.2
      ctx.strokeStyle = `hsla(${pal.headHue}, 40%, 50%, 0.6)`
      ctx.lineWidth = 1.5 * scale
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.moveTo(-antX, -h * 0.7)
      ctx.quadraticCurveTo(-antX - 4 * scale, -h * 0.7 - antLen * 0.6, -antX - 2 * scale, -h * 0.7 - antLen)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(-antX - 2 * scale, -h * 0.7 - antLen, 2 * scale, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${pal.headHue + 20}, 50%, 60%, 0.7)`
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(antX, -h * 0.7)
      ctx.quadraticCurveTo(antX + 4 * scale, -h * 0.7 - antLen * 0.6, antX + 2 * scale, -h * 0.7 - antLen)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(antX + 2 * scale, -h * 0.7 - antLen, 2 * scale, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${pal.headHue + 20}, 50%, 60%, 0.7)`
      ctx.fill()
    }

    ctx.restore()
  }
}
