// Tree rendering for The Clearing v2
// Draws the tree on a Canvas 2D context: dark wood silhouette with bioluminescent leaf glow.
// Follows the project's culling pattern (onScreen) and camera transform conventions.

import type { Tree, Leaf } from './tree'

type Camera = { x: number; y: number }

function onScreen(x: number, y: number, cam: Camera, w: number, h: number, margin: number = 100): boolean {
  return x >= cam.x - margin && x <= cam.x + w + margin && y >= cam.y - margin && y <= cam.y + h + margin
}

// Organic leaf shape — pointed tips, asymmetric curves, seeded variation
function drawLeafPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  seed: number,
): void {
  // Slight asymmetry from seed
  const asym = Math.sin(seed * 5.3) * 0.12
  const tipSharp = 0.85 + Math.sin(seed * 7.1) * 0.1 // how pointy the tips are

  // Left tip
  ctx.moveTo(cx - w, cy + h * asym)
  // Top edge — curves up with some irregularity
  ctx.bezierCurveTo(
    cx - w * 0.55, cy - h * (1.3 + asym),
    cx + w * 0.5, cy - h * (1.4 - asym),
    cx + w * tipSharp, cy + h * asym * 0.5,
  )
  // Right tip connects to bottom edge
  ctx.bezierCurveTo(
    cx + w * 0.55, cy + h * (1.1 + asym * 0.5),
    cx - w * 0.5, cy + h * (1.2 - asym * 0.3),
    cx - w, cy + h * asym,
  )
  ctx.closePath()
}

// Draw the full tree: branches then leaves
// Call this inside the camera transform (after ctx.translate(-cam.x, -cam.y))
export function drawTree(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  cam: Camera,
  viewportW: number,
  viewportH: number,
  time: number,
  scale: number,
  reachableLeaves?: Set<number>,
  currentLeaf?: number,
  starCount?: number,
): void {
  // No branches drawn — just floating leaf pads in a void
  drawGround(ctx, tree, cam, viewportW, viewportH, scale, time)
  drawLeaves(ctx, tree, cam, viewportW, viewportH, time, scale, reachableLeaves, currentLeaf, starCount ?? 0)
}

// Draw a subtle ground plane at the bottom of the world
function drawGround(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  cam: Camera,
  w: number,
  _h: number,
  scale: number,
  time: number,
): void {
  const groundY = tree.originY
  if (groundY < cam.y - 50 || groundY > cam.y + _h + 200) return

  // Visible ground line — the walking surface
  const pulse = 0.5 + Math.sin(time * 0.5) * 0.15
  ctx.beginPath()
  ctx.moveTo(cam.x - 100, groundY)
  ctx.lineTo(cam.x + w + 100, groundY)
  ctx.strokeStyle = `hsla(160, 40%, 35%, ${0.35 * pulse})`
  ctx.lineWidth = 2.5 * scale
  ctx.stroke()

  // Softer glow line on top
  ctx.beginPath()
  ctx.moveTo(cam.x - 100, groundY)
  ctx.lineTo(cam.x + w + 100, groundY)
  ctx.strokeStyle = `hsla(160, 50%, 50%, ${0.12 * pulse})`
  ctx.lineWidth = 6 * scale
  ctx.stroke()

  // Soft glow below ground line
  ctx.fillStyle = `hsla(160, 20%, 12%, ${0.06 * pulse})`
  ctx.fillRect(cam.x - 100, groundY, w + 200, 100 * scale)
}

// Draw all branch segments as dark wood with subtle bioluminescent edge glow
export function _drawBranches(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  cam: Camera,
  w: number,
  h: number,
  scale: number,
): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Sort branches by depth so trunk draws first (behind finer branches)
  // The tree.branches array is already in generation order (depth-first),
  // but we want trunk on bottom. Stable sort by depth ascending.
  const sorted = tree.branches.slice().sort((a, b) => a.depth - b.depth)

  for (const branch of sorted) {
    // Cull branches not visible
    const midX = (branch.startX + branch.endX) / 2
    const midY = (branch.startY + branch.endY) / 2
    const branchMargin = branch.length + branch.thickness * 2
    if (!onScreen(midX, midY, cam, w, h, branchMargin)) continue

    const thickness = Math.max(1, branch.thickness * scale)

    // Edge glow — subtle bioluminescent outline (drawn first, wider)
    const glowThickness = thickness + 2 * scale
    ctx.beginPath()
    ctx.moveTo(branch.startX, branch.startY)
    ctx.lineTo(branch.endX, branch.endY)
    // Deeper branches have slightly more cyan glow, trunk is barely visible
    const glowAlpha = branch.depth === 0 ? 0.04 : 0.03 + branch.depth * 0.012
    const glowHue = 170 + branch.depth * 5
    ctx.strokeStyle = `hsla(${glowHue}, 50%, 45%, ${glowAlpha})`
    ctx.lineWidth = glowThickness
    ctx.stroke()

    // Main branch body — dark wood
    ctx.beginPath()
    ctx.moveTo(branch.startX, branch.startY)
    ctx.lineTo(branch.endX, branch.endY)
    // Trunk is darkest, outer branches slightly lighter
    const baseLit = 6 + branch.depth * 1.5
    const baseSat = 15 + branch.depth * 2
    ctx.strokeStyle = `hsl(30, ${baseSat}%, ${baseLit}%)`
    ctx.lineWidth = thickness
    ctx.stroke()
  }
}

// Draw all leaves as glowing orbs — reachable leaves glow brighter
function drawLeaves(
  ctx: CanvasRenderingContext2D,
  tree: Tree,
  cam: Camera,
  w: number,
  h: number,
  time: number,
  scale: number,
  reachableLeaves?: Set<number>,
  currentLeaf?: number,
  starCount: number = 0,
): void {
  for (let i = 0; i < tree.leaves.length; i++) {
    const leaf = tree.leaves[i]
    if (leaf.health <= 0) continue

    const margin = leaf.size * scale * 8
    if (!onScreen(leaf.x, leaf.y, cam, w, h, margin)) continue

    const isReachable = reachableLeaves?.has(i) ?? false
    const isCurrent = i === currentLeaf
    drawLeaf(ctx, leaf, time, scale, isReachable, isCurrent, starCount)
  }
}

// Draw a single leaf as a flat horizontal platform — an actual leaf shape
// Reachable leaves glow brighter, current leaf has warm pulse
function drawLeaf(
  ctx: CanvasRenderingContext2D,
  leaf: Leaf,
  time: number,
  scale: number,
  isReachable: boolean = false,
  isCurrent: boolean = false,
  starCount: number = 0,
): void {
  const { x, y, health, size, phase } = leaf

  // Star-driven ambient light multiplier: 0 stars = 40% brightness, 15+ = 100%
  const starGlow = 0.4 + Math.min(1, starCount / 15) * 0.6

  const pulse = 1 + Math.sin(time * 1.5 + phase) * 0.05

  // Leaf shrinks when nearly dead (health < 0.1)
  const shrinkFactor = health < 0.1 ? 0.5 + health * 5 : 1.0

  // Leaf platform dimensions — wide, thin
  const leafWidth = (size * 3 + 20) * scale * pulse * shrinkFactor
  const leafHeight = (size * 0.6 + 3) * scale * pulse * shrinkFactor

  // Color based on health — dramatic shift: healthy = vibrant teal, dying = gray/brown
  const hue = health > 0.3 ? 80 + health * 80 : 30 + health * 167  // dying → brownish 30-80
  const sat = health > 0.3 ? 25 + health * 55 : 5 + health * 67    // dying → nearly gray
  const lit = health > 0.1 ? 15 + health * 30 : 6 + health * 90    // dying → very dim

  const rawAlpha = health < 0.1 ? 0.08 + health * 0.7 : Math.max(0.15, health * 0.7)
  const baseAlpha = rawAlpha * starGlow // stars dim/brighten all leaves globally
  const alpha = isReachable ? Math.max(baseAlpha, 0.6 * starGlow) : isCurrent ? Math.max(baseAlpha, 0.8 * starGlow) : baseAlpha

  // Tilt angle seeded from leaf phase — each leaf has unique orientation
  const tilt = Math.sin(phase * 3.7) * 0.15

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)

  // ── Shadow/depth: dark shape offset slightly down ──
  ctx.beginPath()
  drawLeafPath(ctx, 0, leafHeight * 0.3, leafWidth, leafHeight, phase)
  ctx.fillStyle = `hsla(${hue}, ${sat * 0.3}%, ${Math.max(3, lit - 15)}%, ${alpha * 0.3})`
  ctx.fill()

  // ── Main leaf body ──
  ctx.beginPath()
  drawLeafPath(ctx, 0, 0, leafWidth, leafHeight, phase)
  ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`
  ctx.fill()

  // ── Second layer offset: paper-mache layered feel ──
  ctx.beginPath()
  drawLeafPath(ctx, leafWidth * 0.03, -leafHeight * 0.1, leafWidth * 0.9, leafHeight * 0.85, phase + 1)
  ctx.fillStyle = `hsla(${hue + 8}, ${Math.min(100, sat + 5)}%, ${Math.min(60, lit + 6)}%, ${alpha * 0.35})`
  ctx.fill()

  // ── Central vein — thick, prominent ──
  ctx.beginPath()
  ctx.moveTo(-leafWidth * 0.8, 0)
  ctx.quadraticCurveTo(0, -leafHeight * 0.15, leafWidth * 0.8, 0)
  ctx.strokeStyle = `hsla(${hue + 15}, ${Math.min(80, sat + 10)}%, ${Math.min(55, lit + 10)}%, ${alpha * 0.6})`
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  // ── Side veins — curve outward from the central vein ──
  if (health > 0.1) {
    const veinAlpha = alpha * 0.35
    ctx.strokeStyle = `hsla(${hue + 10}, ${sat}%, ${Math.min(55, lit + 8)}%, ${veinAlpha})`
    ctx.lineWidth = 1.2 * scale
    const veinCount = Math.max(3, Math.floor(leafWidth / (12 * scale)))
    for (let v = 1; v <= veinCount; v++) {
      const t = v / (veinCount + 1)
      const vx = -leafWidth * 0.6 + leafWidth * 1.2 * t
      const spread = leafHeight * 1.0 * (1 - Math.pow(Math.abs(t - 0.5) * 2, 1.5))
      // Veins curve outward
      ctx.beginPath()
      ctx.moveTo(vx, 0)
      ctx.quadraticCurveTo(vx + leafWidth * 0.06, -spread * 0.6, vx + leafWidth * 0.03, -spread)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(vx, 0)
      ctx.quadraticCurveTo(vx + leafWidth * 0.06, spread * 0.5, vx + leafWidth * 0.03, spread * 0.85)
      ctx.stroke()
    }
  }

  // ── Edge: visible border, slightly rough ──
  ctx.beginPath()
  drawLeafPath(ctx, 0, 0, leafWidth, leafHeight, phase)
  const rimAlpha = health > 0.5 ? alpha * 0.5 : alpha * 0.2
  ctx.strokeStyle = `hsla(${hue + 20}, ${Math.min(80, sat + 15)}%, ${Math.min(65, lit + 18)}%, ${rimAlpha})`
  ctx.lineWidth = (health > 0.5 ? 2.5 : 1.5) * scale
  ctx.stroke()

  // ── Reachable shimmer ──
  if (isReachable) {
    const ringPulse = 0.4 + Math.sin(time * 3 + phase) * 0.3
    ctx.beginPath()
    drawLeafPath(ctx, 0, 0, leafWidth * 1.15, leafHeight * 1.3, phase)
    ctx.strokeStyle = `hsla(170, 70%, 65%, ${ringPulse * 0.3})`
    ctx.lineWidth = 1.5 * scale
    ctx.stroke()
  }

  // ── Current leaf warm highlight ──
  if (isCurrent) {
    const cp = 0.3 + Math.sin(time * 2) * 0.15
    ctx.beginPath()
    drawLeafPath(ctx, 0, 0, leafWidth * 1.05, leafHeight * 1.1, phase)
    ctx.fillStyle = `hsla(45, 70%, 55%, ${cp * 0.08})`
    ctx.fill()
  }

  // ── Subtle ambient glow underneath (much less dominant than before) ──
  if (health > 0.3) {
    ctx.beginPath()
    ctx.ellipse(0, leafHeight * 0.5, leafWidth * 0.8, leafHeight * 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 15}%, ${alpha * 0.06})`
    ctx.fill()
  }

  ctx.restore()
}

// Draw the dark void background with karma-reactive color
// Call this BEFORE the camera transform
export function drawVoidBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  karma?: { beauty: number; corruption: number; hostility: number },
  starDensity?: number,
): void {
  if (!karma) {
    ctx.fillStyle = '#030308'
    ctx.fillRect(0, 0, w, h)
    return
  }

  const corruption = karma.corruption
  const s = Math.max(0, starDensity ?? 0)
  const corruptDrain = Math.max(0, 1 - corruption * 0.4)

  // UTC time drives the base color palette — each visit feels different
  const hours = Date.now() / 1000 / 3600
  const utcHue = (Math.sin(hours / 24 * Math.PI * 2) * 30 + Math.sin(hours / 120 * Math.PI * 2 + 1.7) * 20)
  // utcHue drifts ±50 around 0 — shifts the entire world's tint
  const utcWarm = Math.sin(hours / 7.5 * Math.PI * 2 + 0.4) * 0.5 + 0.5 // 0-1 warmth cycle

  // Star density DRAMATICALLY drives background brightness
  // UTC time shifts the HUE of that brightness
  const starT = Math.min(1, s / 20)

  // Base RGB from star density, tinted by UTC
  const tintR = 0.3 + utcWarm * 0.4 // warmer times = more red
  const tintG = 0.5 + (1 - utcWarm) * 0.3 // cooler times = more green
  const tintB = 0.8 + Math.sin(utcHue * 0.02) * 0.2 // always bluish, varies

  const maxBright = 60 // maximum RGB component at full stars
  const baseR = Math.round(starT * maxBright * tintR * corruptDrain)
  const baseG = Math.round(starT * maxBright * tintG * corruptDrain)
  const baseB = Math.round(starT * maxBright * tintB * corruptDrain)

  ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`
  ctx.fillRect(0, 0, w, h)

  // Ambient glow for star-rich worlds
  if (starT > 0.3 && corruption < 0.5) {
    const glowAlpha = starT * 0.15
    const glowR = Math.round(40 * tintR)
    const glowG = Math.round(55 * tintG)
    const glowB = Math.round(50 * tintB)
    ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${glowAlpha})`
    ctx.fillRect(0, h * 0.5, w, h * 0.5)
  }

  // Sky glow
  if (s > 3) {
    const skyGlow = Math.min(0.2, (s - 3) * 0.015)
    ctx.fillStyle = `rgba(${Math.round(20 * tintR)}, ${Math.round(35 * tintG)}, ${Math.round(60 * tintB)}, ${skyGlow})`
    ctx.fillRect(0, 0, w, h * 0.5)
  }

  // Warm horizon for many stars
  if (s > 10) {
    const warmGlow = Math.min(0.08, (s - 10) * 0.006)
    ctx.fillStyle = `rgba(${Math.round(55 * tintR)}, ${Math.round(40 * tintG)}, ${Math.round(25 * tintB)}, ${warmGlow})`
    ctx.fillRect(0, h * 0.65, w, h * 0.35)
  }
}

// Draw atmospheric fog/visibility overlay based on karma
// Call inside the camera transform, AFTER tree, BEFORE agents
export function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: { x: number; y: number },
  karma: { beauty: number; corruption: number; hostility: number },
  starCount: number,
  _time: number,
): void {
  const corruption = karma.corruption
  const beauty = karma.beauty

  // Corruption fog: dims everything when corruption > 0.3
  if (corruption > 0.3) {
    const fogAlpha = Math.min(0.6, (corruption - 0.3) * 0.857) // 0→0.6 as corruption 0.3→1.0

    // Draw fog in screen space — need to offset by camera
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset to screen space
    ctx.fillStyle = `rgba(2, 3, 2, ${fogAlpha})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // Beauty lifts fog: slight warm glow at edges when beauty > 0.5
  if (beauty > 0.5 && corruption < 0.7) {
    const warmAlpha = Math.min(0.04, (beauty - 0.5) * 0.08)
    if (warmAlpha > 0.003) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // Warm glow from bottom edge
      ctx.fillStyle = `rgba(50, 45, 25, ${warmAlpha})`
      ctx.fillRect(0, h * 0.7, w, h * 0.3)
      // Subtle side glow
      ctx.fillStyle = `rgba(40, 40, 30, ${warmAlpha * 0.5})`
      ctx.fillRect(0, 0, w * 0.05, h)
      ctx.fillRect(w * 0.95, 0, w * 0.05, h)
      ctx.restore()
    }
  }

  // === STAR-COUNT FOG: fewer stars = world goes VERY DARK ===
  if (starCount < 15) {
    // 0 stars: fog alpha 0.55, 15 stars: 0 — this is DRAMATIC
    const starFogAlpha = Math.max(0, (1 - starCount / 15) * 0.55)
    if (starFogAlpha > 0.01) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = `rgba(0, 0, 0, ${starFogAlpha})`
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
  }

  // === VIGNETTE: stars DOMINATE field of view ===
  // 0 stars = you can barely see past your nose
  // 20+ stars = wide open, clear day
  const starVisibility = Math.min(1, starCount / 20)

  // Stars contribute 80%, karma 20% — stars are the primary driver
  const worldHealth = beauty * 0.6 + (1 - corruption) * 0.4
  const combinedVisibility = starVisibility * 0.8 + worldHealth * 0.2

  const vignetteStrength = Math.max(0, 1 - combinedVisibility)
  const vignetteAlpha = vignetteStrength * 0.9 // max 0.9 opacity — nearly blind at 0 stars

  if (vignetteAlpha > 0.02) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const cx = w / 2, cy = h / 2
    const screenDiag = Math.max(w, h)
    // 0 stars: innerR = 20% of screen (extreme tunnel). Many stars: innerR = 70%
    const innerR = screenDiag * (0.2 + combinedVisibility * 0.5)
    // outerR: tight when dark, wide when bright
    const outerR = screenDiag * (0.55 + combinedVisibility * 0.4)
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR)
    grad.addColorStop(0, `rgba(0, 0, 0, 0)`)
    grad.addColorStop(1, `rgba(0, 0, 0, ${vignetteAlpha})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  void cam
}
