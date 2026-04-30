export type CosmicMood = {
  hueBias: number
  brightness: number
  saturation: number
  grassDensity: number
  fogAmount: number
  windStrength: number
  driftSpeed: number
  glowRadius: number
  nodeRarity: number
  discoveryBias: number
  audioWarmth: number
  audioTension: number
  volatility: number
}

// Smooth oscillators derived from UTC time
function oscillate(hours: number, periodHours: number, phase: number = 0): number {
  return Math.sin((2 * Math.PI * hours) / periodHours + phase)
}

export function getCosmicMood(): CosmicMood {
  const hours = Date.now() / 1000 / 3600

  // Different periods for layered variation
  const daily = oscillate(hours, 24)
  const slow = oscillate(hours, 24 * 5, 1.7)
  const medium = oscillate(hours, 7.5, 0.4)
  const long = oscillate(hours, 24 * 17, 2.2)
  const quick = oscillate(hours, 3.3, 0.9)

  return {
    hueBias: 180 + daily * 30 + slow * 20, // cyan-ish center, drifts
    brightness: 0.35 + daily * 0.1 + medium * 0.05,
    saturation: 0.5 + slow * 0.15 + quick * 0.05,
    grassDensity: 0.7 + medium * 0.2 + long * 0.1,
    fogAmount: 0.4 + slow * 0.2 + daily * 0.1,
    windStrength: 0.5 + quick * 0.3 + medium * 0.1,
    driftSpeed: 0.3 + medium * 0.15 + quick * 0.1,
    glowRadius: 1.0 + daily * 0.3 + long * 0.2,
    nodeRarity: 0.5 + long * 0.2 + slow * 0.1,
    discoveryBias: 0.5 + daily * 0.15 + slow * 0.1,
    audioWarmth: 0.5 + daily * 0.2 + slow * 0.1,
    audioTension: 0.3 + long * 0.2 + medium * 0.15,
    volatility: 0.3 + long * 0.25 + quick * 0.1,
  }
}
