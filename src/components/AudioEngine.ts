import type { CosmicMood } from '../lib/mood'

export type AudioParams = {
  mood: CosmicMood
  beauty: number
  trust: number
  hostility: number
  corruption: number
  playerEnergy: number
  playerAlive: boolean
  mouseSpeed: number
  isHovering: boolean
  clickEvent: boolean
  cleansing: boolean
  entityDeath: boolean
  beautyBloom: boolean
  starFormed: boolean
  transcendence: boolean
  corruptionSpread: boolean
  cleanseSuccess: boolean
}

// Lydian pentatonic from D (beautiful state)
const LYDIAN_FREQS = [146.8, 164.8, 185.0, 220.0, 246.9]
// Locrian/minor for hostile/corrupt state
const LOCRIAN_FREQS = [82.4, 87.3, 98.0, 110.0, 116.5]

export class AudioEngine {
  private ctx: AudioContext | null = null
  private started = false
  private muted = false

  // Master
  private master: GainNode | null = null

  // Drone layer — 3 oscillators through shared filter
  private droneOscs: OscillatorNode[] = []
  private droneGains: GainNode[] = []
  private droneFilter: BiquadFilterNode | null = null

  // Sub-bass pulse for corruption/hostility
  private subBassOsc: OscillatorNode | null = null
  private subBassGain: GainNode | null = null

  // Noise layer
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private noiseGain: GainNode | null = null

  // Hover shimmer
  private shimmerOsc: OscillatorNode | null = null
  private shimmerGain: GainNode | null = null

  // Death filter
  private deathFilter: BiquadFilterNode | null = null

  // State tracking
  private lastParams: Partial<AudioParams> = {}
  private chimeTimeout: ReturnType<typeof setTimeout> | null = null
  private lastChimeIndex = 0 // for step-wise movement
  private disposed = false

  start(): void {
    if (this.started || this.disposed) return

    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }

    this.started = true
    const ctx = this.ctx

    // Master gain — smooth fade-in on start to avoid noise gaps
    this.master = ctx.createGain()
    this.master.gain.setValueAtTime(0, ctx.currentTime)
    this.master.gain.setTargetAtTime(0.2, ctx.currentTime, 0.15)

    // Death filter (always in chain, starts open)
    this.deathFilter = ctx.createBiquadFilter()
    this.deathFilter.type = 'lowpass'
    this.deathFilter.frequency.value = 20000
    this.deathFilter.Q.value = 0.5

    this.master.connect(this.deathFilter)
    this.deathFilter.connect(ctx.destination)

    this.initDrone(ctx)
    this.initSubBass(ctx)
    this.initNoise(ctx)
    this.initShimmer(ctx)
    this.scheduleChime()
  }

  private initDrone(ctx: AudioContext): void {
    // D3 root (146.8Hz) + perfect 5th (220Hz) + sub-octave (73.4Hz)
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 400
    this.droneFilter.Q.value = 1.5
    this.droneFilter.connect(this.master!)

    const baseFreqs = [146.8, 220.0, 73.4]
    const types: OscillatorType[] = ['sine', 'sine', 'sine']
    const volumes = [0.10, 0.06, 0.08]

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = types[i]
      osc.frequency.value = baseFreqs[i]

      const gain = ctx.createGain()
      gain.gain.value = volumes[i]

      osc.connect(gain)
      gain.connect(this.droneFilter)
      osc.start()

      this.droneOscs.push(osc)
      this.droneGains.push(gain)
    }
  }

  private initSubBass(ctx: AudioContext): void {
    // Sub-bass pulse for corruption/hostility — barely audible, felt as unease
    this.subBassOsc = ctx.createOscillator()
    this.subBassOsc.type = 'sine'
    this.subBassOsc.frequency.value = 22
    this.subBassGain = ctx.createGain()
    this.subBassGain.gain.value = 0 // starts silent, activated by corruption/hostility
    this.subBassOsc.connect(this.subBassGain)
    this.subBassGain.connect(this.master!)
    this.subBassOsc.start()
  }

  private initNoise(ctx: AudioContext): void {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseSource = ctx.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true

    this.noiseFilter = ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 2000
    this.noiseFilter.Q.value = 3.0

    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0.010

    this.noiseSource.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.master!)
    this.noiseSource.start()
  }

  private initShimmer(ctx: AudioContext): void {
    this.shimmerOsc = ctx.createOscillator()
    this.shimmerOsc.type = 'sine'
    this.shimmerOsc.frequency.value = 2400

    this.shimmerGain = ctx.createGain()
    this.shimmerGain.gain.value = 0

    this.shimmerOsc.connect(this.shimmerGain)
    this.shimmerGain.connect(this.master!)
    this.shimmerOsc.start()
  }

  private scheduleChime(): void {
    if (this.disposed || !this.ctx) return

    const beauty = this.lastParams.beauty ?? 0.5
    const hostility = this.lastParams.hostility ?? 0.1
    const corruption = this.lastParams.corruption ?? 0.1
    const alive = this.lastParams.playerAlive ?? true

    // Beautiful: frequent (2-4s). Corrupt/hostile: rare (8-15s). Dead: very rare (10-20s).
    let baseInterval: number
    if (!alive) {
      baseInterval = 10000 + Math.random() * 10000
    } else if (beauty > 0.6) {
      baseInterval = 2000 + (1 - beauty) * 2000
    } else if (corruption > 0.5 || hostility > 0.6) {
      baseInterval = 8000 + corruption * 7000
    } else {
      baseInterval = 4000 + (1 - beauty) * 6000
    }

    // ±30% jitter for organic feel
    const jitter = baseInterval * (0.7 + Math.random() * 0.6)

    this.chimeTimeout = setTimeout(() => {
      if (this.disposed || !this.ctx || this.muted) {
        this.scheduleChime()
        return
      }
      this.playChime(beauty, hostility, corruption, alive)
      this.scheduleChime()
    }, jitter)
  }

  private playChime(beauty: number, hostility: number, corruption: number, alive: boolean): void {
    const ctx = this.ctx!
    const now = ctx.currentTime

    // Pick scale based on state
    const scale = (corruption > 0.5 || hostility > 0.6) ? LOCRIAN_FREQS : LYDIAN_FREQS

    // Step-wise movement: 60% chance to move by 1-2 steps, 40% random
    let idx: number
    if (Math.random() < 0.6) {
      const step = Math.random() < 0.5 ? 1 : (Math.random() < 0.5 ? -1 : 2)
      idx = Math.max(0, Math.min(scale.length - 1, this.lastChimeIndex + step))
    } else {
      idx = Math.floor(Math.random() * scale.length)
    }
    this.lastChimeIndex = idx

    let freq = scale[idx]

    // Octave doubling
    if (beauty > 0.6 && Math.random() < 0.4) freq *= 2
    else if (hostility > 0.6 && Math.random() < 0.2) freq *= 0.5
    if (!alive) freq *= 0.5 // death: lower octave

    // ±5-15 cents random detuning for organic feel
    const detuneCents = (Math.random() - 0.5) * 20
    freq *= Math.pow(2, detuneCents / 1200)

    const osc = ctx.createOscillator()
    osc.type = (corruption > 0.5 || hostility > 0.6) ? 'triangle' : 'sine'
    osc.frequency.value = freq

    // ±30% random volume variation
    const volVariation = 0.7 + Math.random() * 0.6
    const baseVolume = beauty > 0.6
      ? 0.06 + beauty * 0.05
      : hostility > 0.6
        ? 0.015 + (1 - hostility) * 0.02
        : 0.03 + beauty * 0.03
    const volume = baseVolume * volVariation

    // Variable attack time (5ms sudden to 100ms bloom)
    const attackTime = 0.005 + Math.random() * 0.095

    // Decay: beautiful = long (4-8s), hostile = short, dead = glacial
    const decayTime = !alive
      ? 3 + Math.random() * 4
      : beauty > 0.6
        ? 4 + beauty * 4
        : hostility > 0.6
          ? 0.6 + Math.random() * 0.4
          : 1.5 + Math.random() * 2

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + attackTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decayTime)

    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(now)
    osc.stop(now + decayTime + 0.5)

    // Dissonant second tone in hostile/corrupt worlds
    if ((hostility > 0.6 || corruption > 0.5) && Math.random() < 0.5) {
      const dissonantFreq = freq * (1 + (Math.random() * 0.06 - 0.03))
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = dissonantFreq
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0, now)
      gain2.gain.linearRampToValueAtTime(volume * 0.4, now + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + decayTime * 0.7)
      osc2.connect(gain2)
      gain2.connect(this.master!)
      osc2.start(now + 0.03)
      osc2.stop(now + decayTime + 0.5)
      osc2.onended = () => { osc2.disconnect(); gain2.disconnect() }
    }

    osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }

  private playClickBloom(cleansing: boolean): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = cleansing ? 220 : 330

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0, now)
    oscGain.gain.linearRampToValueAtTime(0.08, now + 0.01)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

    osc.connect(oscGain)
    oscGain.connect(this.master!)
    osc.start(now)
    osc.stop(now + 0.7)

    // Noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.15)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    }

    const nSrc = ctx.createBufferSource()
    nSrc.buffer = buf
    const nFilter = ctx.createBiquadFilter()
    nFilter.type = 'bandpass'
    nFilter.frequency.value = cleansing ? 600 : 1200
    nFilter.Q.value = 1.5
    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.04, now)
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
    nSrc.connect(nFilter)
    nFilter.connect(nGain)
    nGain.connect(this.master!)
    nSrc.start(now)

    osc.onended = () => { osc.disconnect(); oscGain.disconnect() }
    nSrc.onended = () => { nSrc.disconnect(); nFilter.disconnect(); nGain.disconnect() }
  }

  // --- Event stingers ---

  private playEntityDeath(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // Falling sine (freq → freq/2 glide over 1.5s) + noise burst
    const startFreq = 300
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(startFreq / 2, now + 1.5)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(now)
    osc.stop(now + 2)

    // Brief noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.1)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    const nSrc = ctx.createBufferSource()
    nSrc.buffer = buf
    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.03, now)
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
    nSrc.connect(nGain)
    nGain.connect(this.master!)
    nSrc.start(now)

    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    nSrc.onended = () => { nSrc.disconnect(); nGain.disconnect() }
  }

  private playBeautyBloom(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // Stacked 5ths (root + P5 + octave), sine, slow swell, 3s
    const root = 220
    const freqs = [root, root * 3 / 2, root * 2]
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freqs[i]
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      // Slow swell
      gain.gain.linearRampToValueAtTime(0.04, now + 0.3)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3)
      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(now)
      osc.stop(now + 3.5)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
  }

  private playStarFormed(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // Lydian fragment: 3 ascending notes, 1s
    const notes = [LYDIAN_FREQS[0] * 2, LYDIAN_FREQS[2] * 2, LYDIAN_FREQS[4] * 2]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = notes[i]
      const gain = ctx.createGain()
      const t = now + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.045, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(t)
      osc.stop(t + 1)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
  }

  private playTranscendence(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // Full harmonic series (1:2:3:4:5), 4s swell — major chord emergence
    const fundamental = 146.8
    for (let i = 1; i <= 5; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = fundamental * i
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      // Staggered swell
      gain.gain.linearRampToValueAtTime(0.035 / i, now + 0.5 + i * 0.2)
      gain.gain.setValueAtTime(0.035 / i, now + 3)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 4)
      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(now)
      osc.stop(now + 4.5)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
  }

  private playCorruptionSpread(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // 3-note ascending microtonal cluster, triangle wave, quiet, 1s
    const baseFreq = 82.4
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = baseFreq * (1 + i * 0.07) // microtonal spacing
      const gain = ctx.createGain()
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.025, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(t)
      osc.stop(t + 1)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
  }

  private playCleanseSuccess(): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime
    // Tritone → perfect 5th resolution (220+311 → 220+330), 2s
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(220, now)
    osc1.frequency.setValueAtTime(220, now + 2) // holds
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(311, now) // tritone
    osc2.frequency.linearRampToValueAtTime(330, now + 1) // resolves to P5
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.05, now + 0.05)
    gain.gain.setValueAtTime(0.05, now + 1.2)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2)
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(this.master!)
    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 2.5)
    osc2.stop(now + 2.5)
    osc1.onended = () => { osc1.disconnect(); osc2.disconnect(); gain.disconnect() }
  }

  update(params: AudioParams): void {
    if (!this.started || !this.ctx || this.disposed) return

    // Resume if suspended (autoplay policy) — just resume, don't restart gain from 0
    // Restarting gain causes audible stops/starts
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    const ctx = this.ctx
    const now = ctx.currentTime
    const last = this.lastParams
    const DELTA = 0.01

    // Click bloom
    if (params.clickEvent) {
      this.playClickBloom(params.cleansing)
    }

    // Event sounds — one-shot, only when triggered
    if (params.entityDeath) this.playEntityDeath()
    if (params.beautyBloom) this.playBeautyBloom()
    if (params.starFormed) this.playStarFormed()
    if (params.transcendence) this.playTranscendence()
    if (params.corruptionSpread) this.playCorruptionSpread()
    if (params.cleanseSuccess) this.playCleanseSuccess()

    // --- Drone: dramatically shift with karma ---
    if (this.droneFilter && (
      Math.abs((last.beauty ?? 0) - params.beauty) > DELTA ||
      Math.abs((last.corruption ?? 0) - params.corruption) > DELTA ||
      Math.abs((last.hostility ?? 0) - params.hostility) > DELTA ||
      Math.abs((params.mood?.audioWarmth ?? 0) - (last.mood?.audioWarmth ?? 0)) > DELTA
    )) {
      const warmth = params.mood.audioWarmth

      // Beautiful (>0.6): D3 root, wide open filter 1200-2000Hz
      // Corrupt (>0.5): E2 root, muffled 80-300Hz
      // Neutral: moderate 300-600Hz
      let cutoff: number
      if (params.beauty > 0.6) {
        cutoff = 1200 + (params.beauty - 0.6) * 2000 + warmth * 300
      } else if (params.corruption > 0.5) {
        cutoff = 80 + (1 - params.corruption) * 220
      } else {
        cutoff = 300 + warmth * 300 + params.beauty * 300
      }
      this.droneFilter.frequency.setTargetAtTime(Math.max(60, cutoff), now, 2.5)

      // Q: beautiful = gentle (1.0), corrupt = harsh narrow (4-6)
      const q = params.beauty > 0.6
        ? 0.8 + params.beauty * 0.3
        : params.corruption > 0.5
          ? 3.0 + params.corruption * 3.0
          : 1.5
      this.droneFilter.Q.setTargetAtTime(q, now, 2.0)

      // Root frequencies shift based on state
      // Beautiful: D3 (146.8) + A3 (220) + D2 (73.4)
      // Corrupt: E2 (82.4) + Bb2 (116.5) — minor 2nd beating + tritone
      // Hostile: drop pitch lower
      if (params.corruption > 0.5) {
        const corr = params.corruption
        this.droneOscs[0]?.frequency.exponentialRampToValueAtTime(82.4, now + 4.0)
        this.droneOscs[1]?.frequency.exponentialRampToValueAtTime(87.3 + corr * 5, now + 4.0) // beating minor 2nd
        this.droneOscs[2]?.frequency.exponentialRampToValueAtTime(116.5, now + 4.0) // tritone
        // Switch osc1 to triangle for harsher timbre
        if (this.droneOscs[1]) this.droneOscs[1].type = 'triangle'
      } else if (params.beauty > 0.6) {
        this.droneOscs[0]?.frequency.exponentialRampToValueAtTime(146.8, now + 4.0)
        // ±2 cents gentle chorus
        this.droneOscs[1]?.frequency.exponentialRampToValueAtTime(220.0 + 0.25, now + 4.0)
        this.droneOscs[2]?.frequency.exponentialRampToValueAtTime(73.4, now + 4.0)
        if (this.droneOscs[1]) this.droneOscs[1].type = 'sine'
      } else {
        // Neutral: gentle D root
        const hostDrop = params.hostility > 0.6 ? (params.hostility - 0.6) * 20 : 0
        this.droneOscs[0]?.frequency.exponentialRampToValueAtTime(146.8 - hostDrop, now + 3.0)
        this.droneOscs[1]?.frequency.exponentialRampToValueAtTime(220.0, now + 3.0)
        this.droneOscs[2]?.frequency.exponentialRampToValueAtTime(73.4, now + 3.0)
        if (this.droneOscs[1]) this.droneOscs[1].type = 'sine'
      }

      // Volume: beauty = rich and full, corruption = thinner
      for (let i = 0; i < this.droneGains.length; i++) {
        const baseVol = i === 0 ? 0.10 : i === 1 ? 0.06 : 0.08
        const beautyBoost = params.beauty > 0.6 ? 1.0 + (params.beauty - 0.6) * 2.5 : 0.5 + params.beauty * 0.8
        const corruptionDrain = params.corruption > 0.5 ? 1.0 - (params.corruption - 0.5) * 0.4 : 1.0
        this.droneGains[i].gain.setTargetAtTime(baseVol * beautyBoost * corruptionDrain, now, 2.0)
      }
    }

    // --- Sub-bass pulse ---
    if (this.subBassGain && this.subBassOsc) {
      const needSubBass = params.corruption > 0.5 || params.hostility > 0.6
      const subVol = needSubBass
        ? 0.04 + Math.max(params.corruption - 0.5, 0) * 0.08 + Math.max(params.hostility - 0.6, 0) * 0.06
        : 0
      this.subBassGain.gain.setTargetAtTime(subVol, now, 2.5)
      // Corruption: 18-25Hz, Hostility: 25-35Hz
      const subFreq = params.corruption > params.hostility
        ? 18 + params.corruption * 7
        : 25 + params.hostility * 10
      this.subBassOsc.frequency.setTargetAtTime(subFreq, now, 2.5)
    }

    // --- Noise: beautiful = high gentle breeze, corrupt = low rumbling static ---
    if (this.noiseFilter && this.noiseGain && (
      Math.abs((params.mood?.windStrength ?? 0) - (last.mood?.windStrength ?? 0)) > DELTA ||
      Math.abs((last.corruption ?? 0) - params.corruption) > DELTA ||
      Math.abs((last.beauty ?? 0) - params.beauty) > DELTA
    )) {
      let windFreq: number, windQ: number, windVol: number

      if (params.corruption > 0.5) {
        // Wide bandpass 200-500Hz, loud rumbling static
        windFreq = 200 + params.mood.windStrength * 300
        windQ = 0.5 - (params.corruption - 0.5) * 0.4
        windVol = 0.025 + (params.corruption - 0.5) * 0.07 + params.mood.windStrength * 0.01
      } else if (params.beauty > 0.6) {
        // High bandpass 2-4kHz, narrow gentle breeze
        windFreq = 2000 + params.mood.windStrength * 2000 + params.beauty * 500
        windQ = 4.0 + params.beauty * 3.0
        windVol = 0.005 + params.mood.windStrength * 0.004
      } else {
        windFreq = 800 + params.mood.windStrength * 600
        windQ = 2.5 - params.corruption * 1.5
        windVol = 0.010 + params.corruption * 0.015 + params.mood.windStrength * 0.006
      }

      this.noiseFilter.frequency.setTargetAtTime(windFreq, now, 2.5)
      this.noiseFilter.Q.setTargetAtTime(Math.max(0.3, windQ), now, 2.0)
      this.noiseGain.gain.setTargetAtTime(windVol, now, 2.0)
    }

    // Hover shimmer
    if (this.shimmerGain) {
      const targetShimmer = params.isHovering ? 0.025 : 0
      if (Math.abs(this.shimmerGain.gain.value - targetShimmer) > 0.005) {
        this.shimmerGain.gain.setTargetAtTime(targetShimmer, now, params.isHovering ? 0.3 : 0.8)
      }
    }

    // Death state: muffle everything, shift to A3 + minor 3rd drone
    if (this.deathFilter && this.master) {
      if (params.playerAlive !== last.playerAlive) {
        if (!params.playerAlive) {
          this.deathFilter.frequency.setTargetAtTime(400, now, 0.3)
          this.master.gain.setTargetAtTime(0.1, now, 0.3)
          // Death drone: A3 (220) + C4 (261.6), sparse
          this.droneOscs[0]?.frequency.setTargetAtTime(220, now, 1.0)
          this.droneOscs[1]?.frequency.setTargetAtTime(261.6, now, 1.0)
          this.droneOscs[2]?.frequency.setTargetAtTime(110, now, 1.0)
        } else {
          this.deathFilter.frequency.setTargetAtTime(20000, now, 2.0)
          this.master.gain.setTargetAtTime(0.2, now, 2.0)
        }
      }
    }

    // Master volume scales with energy
    if (this.master && Math.abs((last.playerEnergy ?? 1) - params.playerEnergy) > DELTA) {
      const vol = 0.15 + params.playerEnergy * 0.1
      if (params.playerAlive) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : vol, now, 0.5)
      }
    }

    this.lastParams = { ...params, mood: { ...params.mood } }
  }

  setMuffled(muffled: boolean): void {
    if (!this.ctx || !this.master || !this.deathFilter) return
    const now = this.ctx.currentTime
    if (muffled) {
      this.deathFilter.frequency.setTargetAtTime(600, now, 1.0)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.08, now, 1.0)
    } else {
      this.deathFilter.frequency.setTargetAtTime(20000, now, 1.0)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.2, now, 1.0)
    }
  }

  toggle(): void {
    if (!this.ctx || !this.master) return
    this.muted = !this.muted
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.2, now, 0.3)
  }

  isMuted(): boolean {
    return this.muted
  }

  dispose(): void {
    this.disposed = true
    if (this.chimeTimeout) clearTimeout(this.chimeTimeout)

    for (const osc of this.droneOscs) {
      try { osc.stop(); osc.disconnect() } catch { /* already stopped */ }
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); this.noiseSource.disconnect() } catch { /* */ }
    }
    if (this.shimmerOsc) {
      try { this.shimmerOsc.stop(); this.shimmerOsc.disconnect() } catch { /* */ }
    }
    if (this.subBassOsc) {
      try { this.subBassOsc.stop(); this.subBassOsc.disconnect() } catch { /* */ }
    }

    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }

    this.started = false
  }
}
