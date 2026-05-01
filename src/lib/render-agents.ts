// Agent rendering — each agent has unique color variation (seeded, NOT tied to personality)

import type { AgentSystem } from './agents'
import { drawCentipede } from './render-centipede'

type Camera = { x: number; y: number }

export function drawAgents(
  ctx: CanvasRenderingContext2D,
  system: AgentSystem,
  time: number,
  scale: number,
  cam: Camera,
  vpW: number,
  vpH: number,
): void {
  for (let i = 0; i < system.agents.length; i++) {
    const agent = system.agents[i]
    // Seed from phase (set at creation, unique per agent) — NOT personality
    const seed = Math.floor(agent.phase * 1000)
    drawCentipede(ctx, agent.centipede, time, scale, cam, vpW, vpH, false, seed)
  }
}
