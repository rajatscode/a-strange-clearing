// Tree rendering for The Clearing v2
// Draws the tree on a Canvas 2D context: dark wood silhouette with bioluminescent leaf glow.
// Follows the project's culling pattern (onScreen) and camera transform conventions.

import type { Tree, Leaf } from './tree'

type Camera = { x: number; y: number }

function onScreen(x: number, y: number, cam: Camera, w: number, h: number, margin: number = 100): boolean {
  return x >= cam.x - margin && x <= cam.x + w + margin && y >= cam.y - margin && y <= cam.y + h + margin
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
): void {
  // No branches drawn — just floating leaf pads in a void
  drawGround(ctx, tree, cam, viewportW, viewportH, scale, time)
  drawLeaves(ctx, tree, cam, viewportW, viewportH, time, scale, reachableLeaves, currentLeaf)
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
): void {
  for (let i = 0; i < tree.leaves.length; i++) {
    const leaf = tree.leaves[i]
    if (leaf.health <= 0) continue

    const margin = leaf.size * scale * 8
    if (!onScreen(leaf.x, leaf.y, cam, w, h, margin)) continue

    const isReachable = reachableLeaves?.has(i) ?? false
    const isCurrent = i === currentLeaf
    drawLeaf(ctx, leaf, time, scale, isReachable, isCurrent)
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
): void {
  const { x, y, health, size, phase } = leaf

  const pulse = 1 + Math.sin(time * 1.5 + phase) * 0.05

  // Leaf platform dimensions — wide, thin
  const leafWidth = (size * 3 + 20) * scale * pulse
  const leafHeight = (size * 0.6 + 3) * scale * pulse

  // Color based on health
  const hue = 80 + health * 80       // 80 (yellow-green) → 160 (cyan-green)
  const sat = 25 + health * 50       // 25% → 75%
  const lit = 15 + health * 30       // 15% → 45%

  const baseAlpha = Math.max(0.15, health * 0.7)
  const alpha = isReachable ? Math.max(baseAlpha, 0.6) : isCurrent ? Math.max(baseAlpha, 0.8) : baseAlpha

  // Soft glow underneath (ambient light)
  const glowAlpha = alpha * 0.08
  ctx.beginPath()
  ctx.ellipse(x, y + leafHeight, leafWidth * 1.5, leafHeight * 4, 0, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit + 10}%, ${glowAlpha})`
  ctx.fill()

  // Reachable indicator — pulsing glow
  if (isReachable) {
    const ringPulse = 0.4 + Math.sin(time * 3 + phase) * 0.3
    ctx.beginPath()
    ctx.ellipse(x, y, leafWidth * 1.3, leafHeight * 2.5, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(170, 70%, 65%, ${ringPulse * 0.35})`
    ctx.lineWidth = 1.5 * scale
    ctx.stroke()
  }

  // Current leaf warm highlight
  if (isCurrent) {
    const cp = 0.5 + Math.sin(time * 2) * 0.2
    ctx.beginPath()
    ctx.ellipse(x, y, leafWidth * 1.2, leafHeight * 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(45, 80%, 60%, ${cp * 0.1})`
    ctx.fill()
  }

  // Main leaf body — wide ellipse (platform feel)
  ctx.beginPath()
  ctx.ellipse(x, y, leafWidth, leafHeight, 0, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`
  ctx.fill()

  // Leaf vein / highlight — lighter stripe down the middle
  ctx.beginPath()
  ctx.ellipse(x, y - leafHeight * 0.2, leafWidth * 0.7, leafHeight * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hue + 10}, ${Math.min(100, sat + 15)}%, ${Math.min(70, lit + 15)}%, ${alpha * 0.4})`
  ctx.fill()

  // Leaf edge glow — bioluminescent rim
  if (health > 0.3) {
    ctx.beginPath()
    ctx.ellipse(x, y, leafWidth, leafHeight, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${hue + 20}, ${Math.min(90, sat + 20)}%, ${Math.min(75, lit + 25)}%, ${alpha * 0.3 * health})`
    ctx.lineWidth = 1.5 * scale
    ctx.stroke()
  }
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
    // Fallback to original static background
    ctx.fillStyle = '#030308'
    ctx.fillRect(0, 0, w, h)
    return
  }

  const beauty = karma.beauty
  const corruption = karma.corruption
  const stars = starDensity ?? 0

  // Base color interpolation:
  // Beautiful world: very dark blue-green (#030812)
  // Corrupt world: pure black (#010102) with sickly olive tinge
  const beautyWeight = Math.max(0, beauty - corruption * 0.5)
  const corruptWeight = Math.max(0, corruption - beauty * 0.3)

  // Base RGB values
  const r = Math.round(3 - corruptWeight * 2 + beautyWeight * 0)
  const g = Math.round(3 + beautyWeight * 5 - corruptWeight * 2 + corruptWeight * 1)
  const b = Math.round(8 + beautyWeight * 10 - corruptWeight * 6)

  const baseR = Math.max(1, Math.min(15, r))
  const baseG = Math.max(1, Math.min(15, g))
  const baseB = Math.max(2, Math.min(20, b))

  ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`
  ctx.fillRect(0, 0, w, h)

  // Ambient glow for beautiful worlds — faint warm glow from below
  if (beauty > 0.3 && corruption < 0.5) {
    const glowAlpha = Math.max(0, (beauty - 0.3) * 0.07)
    if (glowAlpha > 0.005) {
      ctx.fillStyle = `rgba(40, 50, 20, ${glowAlpha})`
      ctx.fillRect(0, h * 0.6, w, h * 0.4)
    }
  }

  // Star density affects overall brightness (very subtle)
  if (stars > 6) {
    const starGlow = Math.min(0.02, (stars - 6) * 0.003)
    ctx.fillStyle = `rgba(30, 35, 50, ${starGlow})`
    ctx.fillRect(0, 0, w, h * 0.4)
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

  // Star density darkness: fewer stars = darker world
  if (starCount <= 2 && corruption > 0.2) {
    const despairAlpha = Math.min(0.15, (1 - starCount / 3) * 0.15)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = `rgba(0, 0, 0, ${despairAlpha})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // Suppress unused variable warning
  void cam
}
