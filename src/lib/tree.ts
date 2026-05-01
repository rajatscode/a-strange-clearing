// Tree data structure for The Clearing v2
// A procedural branching tree generated from a seed, growing from bottom-center upward.
// The tree is the world's skeleton — branches are visual scaffolding, leaves are hop platforms.

export type Leaf = {
  index: number          // unique index in tree.leaves array
  x: number              // current floating position (animated)
  y: number
  baseX: number          // anchor position (on/near branch)
  baseY: number
  health: number         // 0-1
  size: number           // radius 6-14px
  glowIntensity: number  // 0-1
  branchId: string
  phase: number          // animation phase
  depth: number          // how high in the tree (0=bottom, 1=top) — drives difficulty
  neighbors: number[]    // indices of leaves within MAX possible hop distance (~250px)
}

export type BranchSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  branchId: string
  depth: number
}

export type Branch = {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
  depth: number
  angle: number
  length: number
  children: Branch[]
  leaves: Leaf[]
  parentId: string | null
}

export type Tree = {
  seed: number
  branches: Branch[]
  rootBranch: Branch
  leaves: Leaf[]
  originX: number
  originY: number
  width: number
  height: number
}

// Max possible hop distance — used for neighbor precomputation
const MAX_HOP_DISTANCE = 400

// Seeded pseudo-random number generator (deterministic per seed)
function createRng(seed: number) {
  let s = seed
  return function next(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// Generate the full tree from a seed and viewport dimensions
export function generateTree(seed: number, viewportWidth: number, viewportHeight: number): Tree {
  const rng = createRng(seed)

  // Tree is 3-5x viewport height, centered horizontally
  const treeHeight = viewportHeight * 4
  const originX = viewportWidth * 2.5  // center of a 5x-wide world
  const originY = treeHeight + viewportHeight * 0.5  // bottom of tree, with some ground padding

  const allBranches: Branch[] = []
  const allLeaves: Leaf[] = []
  let branchCounter = 0
  let leafCounter = 0

  function makeBranchId(): string {
    return `b-${branchCounter++}`
  }

  // Recursive branch generation (unchanged from original)
  function growBranch(
    startX: number,
    startY: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number,
    maxDepth: number,
    parentId: string | null,
  ): Branch {
    const id = makeBranchId()

    const endX = startX + Math.cos(angle) * length
    const endY = startY + Math.sin(angle) * length

    const branch: Branch = {
      id,
      startX,
      startY,
      endX,
      endY,
      thickness,
      depth,
      angle,
      length,
      children: [],
      leaves: [],
      parentId,
    }

    allBranches.push(branch)

    // Recurse: split into children
    if (depth < maxDepth) {
      const childCount: number = depth === 0 ? 3 : (rng() < 0.6 ? 2 : 3)
      const spreadAngle = depth === 0 ? Math.PI * 0.5 : Math.PI * (0.3 + rng() * 0.25)

      for (let i = 0; i < childCount; i++) {
        const fraction = childCount === 1 ? 0.5 : i / (childCount - 1)
        const childAngle = angle - spreadAngle / 2 + spreadAngle * fraction + (rng() - 0.5) * 0.3
        const lengthShrink = 0.55 + rng() * 0.2
        const childLength = length * lengthShrink
        const thickShrink = 0.5 + rng() * 0.15
        const childThickness = Math.max(1, thickness * thickShrink)

        const child = growBranch(
          endX, endY,
          childAngle,
          childLength,
          childThickness,
          depth + 1,
          maxDepth,
          id,
        )
        branch.children.push(child)
      }
    }

    return branch
  }

  // Grow the trunk upward
  const trunkAngle = -Math.PI / 2 + (rng() - 0.5) * 0.1
  const trunkLength = treeHeight * 0.28
  const trunkThickness = 18
  const maxDepth = 6

  const rootBranch = growBranch(
    originX, originY,
    trunkAngle,
    trunkLength,
    trunkThickness,
    0,
    maxDepth,
    null,
  )

  // Compute bounding box
  let minX = originX, maxX = originX, minY = originY, maxY = originY
  for (const b of allBranches) {
    minX = Math.min(minX, b.startX, b.endX)
    maxX = Math.max(maxX, b.startX, b.endX)
    minY = Math.min(minY, b.startY, b.endY)
    maxY = Math.max(maxY, b.startY, b.endY)
  }

  const treeW = maxX - minX
  const treeH = maxY - minY

  // --- LEAF GENERATION ---
  // Floating leaf platforms scattered in layers above the ground.
  // Dense near ground (easy to reach), sparse higher up.
  // Player walks on ground and hops UP onto leaves.

  const worldSpread = viewportWidth * 3 // horizontal spread of leaf field
  leafCounter = 0

  // Layer definitions: [count, hSpacingMin, hSpacingMax, yMin, yMax, sizeMin, sizeMax]
  type LayerDef = { count: number; hMin: number; hMax: number; yMinOff: number; yMaxOff: number; sizeMin: number; sizeMax: number }
  const layers: LayerDef[] = [
    // Bottom layer — dense, trivially reachable from ground
    { count: 40, hMin: 30, hMax: 60, yMinOff: 40, yMaxOff: 80, sizeMin: 18, sizeMax: 28 },
    // Lower canopy
    { count: 55, hMin: 60, hMax: 100, yMinOff: 100, yMaxOff: 300, sizeMin: 16, sizeMax: 26 },
    // Mid canopy
    { count: 50, hMin: 80, hMax: 140, yMinOff: 300, yMaxOff: 600, sizeMin: 15, sizeMax: 24 },
    // Upper canopy
    { count: 45, hMin: 80, hMax: 140, yMinOff: 600, yMaxOff: 1000, sizeMin: 15, sizeMax: 22 },
    // Near stellar nursery
    { count: 50, hMin: 70, hMax: 130, yMinOff: 1000, yMaxOff: 1500, sizeMin: 14, sizeMax: 20 },
    // Stellar approach — dense path into the star field
    { count: 45, hMin: 70, hMax: 120, yMinOff: 1500, yMaxOff: 2200, sizeMin: 12, sizeMax: 18 },
    // Among the stars — sparse platforms in the sky itself
    { count: 25, hMin: 100, hMax: 200, yMinOff: 2200, yMaxOff: 2800, sizeMin: 10, sizeMax: 16 },
  ]

  const totalMaxHeight = 2800 // leaves reach well into the star field

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      // Distribute horizontally across the world spread with the layer's spacing
      const hSpacing = layer.hMin + rng() * (layer.hMax - layer.hMin)
      const lx = originX - worldSpread / 2 + rng() * worldSpread
      // Vertical: random within the layer's height band
      const yOffset = layer.yMinOff + rng() * (layer.yMaxOff - layer.yMinOff)
      const ly = originY - yOffset
      const leafSize = layer.sizeMin + rng() * (layer.sizeMax - layer.sizeMin)
      const depthNorm = yOffset / totalMaxHeight // 0=bottom, 1=top

      // Suppress unused variable
      void hSpacing

      allLeaves.push({
        index: leafCounter++,
        x: lx,
        y: ly,
        baseX: lx,
        baseY: ly,
        health: 0.4 + rng() * 0.6,
        size: leafSize,
        glowIntensity: 0.3 + rng() * 0.7,
        branchId: rootBranch.id,
        phase: rng() * Math.PI * 2,
        depth: depthNorm,
        neighbors: [],
      })
    }
  }

  // Precompute neighbor indices for each leaf (within MAX_HOP_DISTANCE)
  computeNeighbors(allLeaves)

  // Verify connectivity from leaf 0 — add emergency bridges if needed
  ensureConnectivity(allLeaves, allBranches, rng, minY, treeH)

  const tree: Tree = {
    seed,
    branches: allBranches,
    rootBranch,
    leaves: allLeaves,
    originX,
    originY,
    width: treeW,
    height: treeH,
  }

  return tree
}

// Add bridge leaves to fill gaps in the canopy
export function _addBridgeLeaves(
  leaves: Leaf[],
  branches: Branch[],
  minY: number,
  treeH: number,
  rng: () => number,
): void {
  // Divide tree into vertical bands and check for horizontal gaps
  const bandCount = 12
  const bridgeBranches = branches.filter(b => b.depth >= 1)

  for (let band = 0; band < bandCount; band++) {
    const bandTop = minY + (band / bandCount) * treeH
    const bandBot = minY + ((band + 1) / bandCount) * treeH

    // Find leaves in this band
    const inBand = leaves.filter(l => l.baseY >= bandTop && l.baseY < bandBot)
    if (inBand.length === 0) continue

    // Sort by x
    inBand.sort((a, b) => a.baseX - b.baseX)

    // Check for gaps > MAX_HOP_DISTANCE between consecutive leaves
    for (let i = 0; i < inBand.length - 1; i++) {
      const gap = Math.sqrt(
        (inBand[i + 1].baseX - inBand[i].baseX) ** 2 +
        (inBand[i + 1].baseY - inBand[i].baseY) ** 2,
      )
      if (gap > MAX_HOP_DISTANCE * 0.85) {
        // Insert a bridge leaf in the middle
        const midX = (inBand[i].baseX + inBand[i + 1].baseX) / 2 + (rng() - 0.5) * 30
        const midLY = (inBand[i].baseY + inBand[i + 1].baseY) / 2 + (rng() - 0.5) * 30

        // Find nearest branch for the branchId
        let bestBranchId = bridgeBranches.length > 0 ? bridgeBranches[0].id : 'b-0'
        let bestDist = Infinity
        for (const b of bridgeBranches) {
          const bMidX = (b.startX + b.endX) / 2
          const bMidY = (b.startY + b.endY) / 2
          const d = Math.sqrt((midX - bMidX) ** 2 + (midLY - bMidY) ** 2)
          if (d < bestDist) {
            bestDist = d
            bestBranchId = b.id
          }
        }

        const depthNorm = treeH > 0 ? 1 - (midLY - minY) / treeH : 0.5
        const idx = leaves.length
        leaves.push({
          index: idx,
          x: midX,
          y: midLY,
          baseX: midX,
          baseY: midLY,
          health: 0.5 + rng() * 0.3,
          size: 7 + rng() * 4,
          glowIntensity: 0.4 + rng() * 0.4,
          branchId: bestBranchId,
          phase: rng() * Math.PI * 2,
          depth: Math.max(0, Math.min(1, depthNorm)),
          neighbors: [],
        })
      }
    }
  }
}

// Precompute neighbor indices for each leaf
function computeNeighbors(leaves: Leaf[]): void {
  const maxDistSq = MAX_HOP_DISTANCE * MAX_HOP_DISTANCE
  for (let i = 0; i < leaves.length; i++) {
    leaves[i].neighbors = []
    for (let j = 0; j < leaves.length; j++) {
      if (i === j) continue
      const dx = leaves[i].baseX - leaves[j].baseX
      const dy = leaves[i].baseY - leaves[j].baseY
      if (dx * dx + dy * dy <= maxDistSq) {
        leaves[i].neighbors.push(j)
      }
    }
  }
}

// Ensure every leaf is reachable from leaf 0 via chains of neighbors
// If not, add emergency bridge leaves
function ensureConnectivity(
  leaves: Leaf[],
  branches: Branch[],
  rng: () => number,
  minY: number,
  treeH: number,
): void {
  for (let attempt = 0; attempt < 5; attempt++) {
    // BFS from leaf 0
    const visited = new Set<number>()
    const queue = [0]
    visited.add(0)
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const n of leaves[cur].neighbors) {
        if (!visited.has(n)) {
          visited.add(n)
          queue.push(n)
        }
      }
    }

    if (visited.size === leaves.length) return // all connected

    // Find the closest unreached leaf to any reached leaf and bridge them
    let bestGap = Infinity
    let bestReachedIdx = 0
    let bestUnreachedIdx = 0

    for (const ri of visited) {
      for (let ui = 0; ui < leaves.length; ui++) {
        if (visited.has(ui)) continue
        const dx = leaves[ri].baseX - leaves[ui].baseX
        const dy = leaves[ri].baseY - leaves[ui].baseY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < bestGap) {
          bestGap = dist
          bestReachedIdx = ri
          bestUnreachedIdx = ui
        }
      }
    }

    if (bestGap > MAX_HOP_DISTANCE) {
      // Need bridge leaves between these two
      const steps = Math.ceil(bestGap / (MAX_HOP_DISTANCE * 0.7))
      const lr = leaves[bestReachedIdx]
      const lu = leaves[bestUnreachedIdx]
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const bx = lr.baseX + (lu.baseX - lr.baseX) * t + (rng() - 0.5) * 20
        const by = lr.baseY + (lu.baseY - lr.baseY) * t + (rng() - 0.5) * 20
        const depthNorm = treeH > 0 ? 1 - (by - minY) / treeH : 0.5

        let bestBranchId = branches[0]?.id ?? 'b-0'
        let bestBDist = Infinity
        for (const b of branches) {
          const bMidX = (b.startX + b.endX) / 2
          const bMidY = (b.startY + b.endY) / 2
          const d = Math.sqrt((bx - bMidX) ** 2 + (by - bMidY) ** 2)
          if (d < bestBDist) {
            bestBDist = d
            bestBranchId = b.id
          }
        }

        const idx = leaves.length
        leaves.push({
          index: idx,
          x: bx,
          y: by,
          baseX: bx,
          baseY: by,
          health: 0.5 + rng() * 0.3,
          size: 7 + rng() * 3,
          glowIntensity: 0.4 + rng() * 0.3,
          branchId: bestBranchId,
          phase: rng() * Math.PI * 2,
          depth: Math.max(0, Math.min(1, depthNorm)),
          neighbors: [],
        })
      }

      // Recompute neighbors after adding bridges
      computeNeighbors(leaves)
    } else {
      // They're within range but not connected — recompute should fix
      computeNeighbors(leaves)
    }
  }
}

// Get all branch segments as flat list (for rendering)
export function getAllBranchSegments(tree: Tree): BranchSegment[] {
  const segments: BranchSegment[] = []
  for (const b of tree.branches) {
    segments.push({
      x1: b.startX,
      y1: b.startY,
      x2: b.endX,
      y2: b.endY,
      thickness: b.thickness,
      branchId: b.id,
      depth: b.depth,
    })
  }
  return segments
}

// Get all leaves (convenience — tree.leaves is already flat)
export function getAllLeaves(tree: Tree): Leaf[] {
  return tree.leaves
}

// Find the nearest point on any branch to a given world position
export function findNearestBranchPoint(
  tree: Tree,
  wx: number,
  wy: number,
): { x: number; y: number; distance: number; branchId: string } {
  let bestDist = Infinity
  let bestX = tree.originX
  let bestY = tree.originY
  let bestBranchId = tree.rootBranch.id

  for (const b of tree.branches) {
    const result = nearestPointOnSegment(b.startX, b.startY, b.endX, b.endY, wx, wy)
    if (result.distance < bestDist) {
      bestDist = result.distance
      bestX = result.x
      bestY = result.y
      bestBranchId = b.id
    }
  }

  return { x: bestX, y: bestY, distance: bestDist, branchId: bestBranchId }
}

// Walk along a branch surface
export function walkAlongBranch(
  tree: Tree,
  branchId: string,
  t: number,
  side: 'left' | 'right' | 'top',
): { x: number; y: number } {
  const branch = tree.branches.find(b => b.id === branchId)
  if (!branch) return { x: tree.originX, y: tree.originY }

  const clampedT = Math.max(0, Math.min(1, t))
  const x = branch.startX + (branch.endX - branch.startX) * clampedT
  const y = branch.startY + (branch.endY - branch.startY) * clampedT

  const dx = branch.endX - branch.startX
  const dy = branch.endY - branch.startY
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { x, y }

  const nx = -dy / len
  const ny = dx / len

  const offset = branch.thickness * 0.5

  if (side === 'left') {
    return { x: x + nx * offset, y: y + ny * offset }
  } else if (side === 'right') {
    return { x: x - nx * offset, y: y - ny * offset }
  } else {
    if (ny < 0) {
      return { x: x + nx * offset, y: y + ny * offset }
    } else {
      return { x: x - nx * offset, y: y - ny * offset }
    }
  }
}

// Update leaf health over time
// Lower leaves wither slower and passively regenerate (roots/ground moisture)
// Upper leaves depend entirely on stellar rain
export function updateLeafHealth(tree: Tree, dt: number, worldKarmaBeauty: number): void {
  const baseWither = 0.005 * (1 - worldKarmaBeauty * 0.6)
  for (const leaf of tree.leaves) {
    if (leaf.health <= 0) {
      leaf.glowIntensity = 0
      // Dead leaves slowly regenerate near the bottom (ground moisture)
      if (leaf.depth < 0.2) {
        leaf.health = Math.min(0.3, leaf.health + dt * 0.002)
      }
      continue
    }

    // Wither rate scales with height: bottom leaves wither 3× slower
    const heightFactor = 0.3 + leaf.depth * 0.7 // 0.3 at bottom, 1.0 at top
    leaf.health = Math.max(0, leaf.health - dt * baseWither * heightFactor)

    // Passive regeneration for lower leaves (ground moisture / roots)
    if (leaf.depth < 0.3) {
      const regenRate = 0.003 * (0.3 - leaf.depth) * (1 + worldKarmaBeauty) // stronger in good world
      leaf.health = Math.min(0.6, leaf.health + dt * regenRate) // caps at 60% from ground alone
    }

    if (leaf.health <= 0) {
      leaf.glowIntensity = 0
    } else {
      leaf.glowIntensity = leaf.health * (0.6 + Math.sin(leaf.phase) * 0.4)
    }
  }
}

// Nourish a leaf (from rain, player interaction, etc.)
export function nourishLeaf(leaf: Leaf, amount: number): void {
  leaf.health = Math.min(1, leaf.health + amount)
  leaf.glowIntensity = Math.min(1, leaf.glowIntensity + amount * 0.5)
}

// Update leaf positions with gentle bobbing animation
export function updateLeaves(tree: Tree, _dt: number, time: number): void {
  for (const leaf of tree.leaves) {
    // Ground leaf stays put
    if (leaf.index === 0) continue

    // Sinusoidal bob — amplitude scales with health (dying leaves are still)
    const healthScale = Math.max(0.05, leaf.health)
    const amplitude = (3 + leaf.size * 0.15) * healthScale
    leaf.x = leaf.baseX + Math.sin(time * 1.2 + leaf.phase) * amplitude * 0.3
    leaf.y = leaf.baseY + Math.sin(time * 0.8 + leaf.phase * 1.4) * amplitude
  }
}

// Get reachable leaves from a given leaf index, within a specific reach distance
export function getReachableLeaves(tree: Tree, leafIndex: number, reach: number): number[] {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) return []
  const leaf = tree.leaves[leafIndex]
  const reachSq = reach * reach
  const result: number[] = []
  for (const nIdx of leaf.neighbors) {
    const n = tree.leaves[nIdx]
    const dx = n.x - leaf.x
    const dy = n.y - leaf.y
    if (dx * dx + dy * dy <= reachSq) {
      result.push(nIdx)
    }
  }
  return result
}

// Find the nearest leaf to a world position
export function findNearestLeaf(tree: Tree, worldX: number, worldY: number): number {
  let bestIdx = 0
  let bestDistSq = Infinity
  for (let i = 0; i < tree.leaves.length; i++) {
    const leaf = tree.leaves[i]
    const dx = leaf.x - worldX
    const dy = leaf.y - worldY
    const distSq = dx * dx + dy * dy
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestIdx = i
    }
  }
  return bestIdx
}

// ---- Internal helpers ----

function nearestPointOnSegment(
  x1: number, y1: number, x2: number, y2: number,
  px: number, py: number,
): { x: number; y: number; distance: number; t: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    const d = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
    return { x: x1, y: y1, distance: d, t: 0 }
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const closestX = x1 + t * dx
  const closestY = y1 + t * dy
  const dist = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2)

  return { x: closestX, y: closestY, distance: dist, t }
}
