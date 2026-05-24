/**
 * LexiSight Motion Analyzer — Temporal Gesture Engine
 * ═══════════════════════════════════════════════════════════════════
 * Upgrades LexiSight from a single-frame static classifier into a
 * motion-aware recognizer that tracks hand movement across frames.
 *
 * Architecture (isolated — zero imports from other LexiSight modules):
 *
 *   MotionAnalyzer (rolling 20-frame buffer)
 *     ├── push(rawLandmarks)   — add frame, evict oldest
 *     ├── getFeatures()        — compute wrist/fingertip motion features
 *     └── analyze()            — rule-based dynamic gesture detection
 *
 * Supported dynamic gestures:
 *   WHAT  — finger flutter (spread fingers oscillating side-to-side)
 *   NO    — index wag (single index oscillating left-right)
 *   COME  — beckoning (fingers curling inward repeatedly)
 *   HELLO — open hand at head/temple, waves or sweeps outward
 *   HELP  — upward fist lift (fist moving upward)
 *   J     — arc-and-hook trajectory (index only, downward arc)
 *   Z     — zigzag trajectory (index only, Z-pattern)
 *
 * Integration: one call in useClassifier.js predict() — see INTEGRATION POINT.
 *
 * Hybrid strategy:
 *   - If meanVelocity < threshold → hand is STATIC → return null
 *     (existing ML / geo pipeline runs unchanged)
 *   - If motion detected AND confidence ≥ 0.78 → return dynamic label
 *     (intercepts before ML / geo, preventing "5"/"W" mis-classification)
 *   - Otherwise → return null (fall through to existing pipeline)
 *
 * Performance: O(20 × 21) = 420 arithmetic ops per frame — sub-millisecond.
 * No ML model, no TensorFlow tensors, no canvas, no async operations.
 *
 * Debug: set window.__lexiMotionDebug = true in browser console.
 * Logs: velocity, oscillation counts, net displacement, pose state.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const BUFFER_SIZE = 20    // number of frames to retain in rolling window
const MIN_FRAMES  = 8     // minimum frames required before analysis

// Below this wrist velocity, the hand is considered static.
// Units: fraction of image width per frame (~0.6% per frame at 30fps = noticeable motion)
const STATIC_VELOCITY_THRESHOLD = 0.006

// MediaPipe Hands landmark indices
const WRIST   = 0
const IDX_TIP = 8,  IDX_PIP = 6
const MID_TIP = 12, MID_PIP = 10
const RNG_TIP = 16, RNG_PIP = 14
const PNK_TIP = 20, PNK_PIP = 18

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Euclidean magnitude of a 2D vector */
function mag(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy)
}

/** Frame-to-frame delta of a specific landmark */
function delta(lmPrev, lmCurr, idx) {
  return {
    dx: lmCurr[idx].x - lmPrev[idx].x,
    dy: lmCurr[idx].y - lmPrev[idx].y,
  }
}

/**
 * Count sign-change reversals in a sequence of signed values.
 * A reversal is when the sign flips between consecutive non-zero values.
 * Example: [+0.01, -0.02, +0.01] → 2 reversals (oscillation count = 2)
 */
function oscillationCount(values) {
  let count = 0
  let lastSign = 0
  for (const v of values) {
    const s = Math.sign(v)
    if (s !== 0 && lastSign !== 0 && s !== lastSign) count++
    if (s !== 0) lastSign = s
  }
  return count
}

/**
 * Finger extension check — identical geometry to geoClassifier.js.
 * MediaPipe: y=0 at TOP of image, increases downward.
 * tip.y < pip.y - thresh  →  tip is HIGHER than pip  →  finger EXTENDED.
 */
function isExtended(lm, tipIdx, pipIdx, thresh = 0.025) {
  return lm[tipIdx].y < lm[pipIdx].y - thresh
}

/** Thumb extension: tip far from index MCP */
function thumbExtended(lm) {
  const dx = lm[4].x - lm[5].x
  const dy = lm[4].y - lm[5].y
  return mag(dx, dy) > 0.07
}

/** Build result object matching the existing classifier output shape */
function makeResult(label, confidence, source = 'motion') {
  return {
    label,
    confidence: Math.min(0.97, confidence),
    topK: [{ label, confidence: Math.min(0.97, confidence) }],
    source,
  }
}

// ── MotionAnalyzer ────────────────────────────────────────────────────────────

export class MotionAnalyzer {
  /**
   * @param {number} bufferSize — number of frames to retain (default 20)
   */
  constructor(bufferSize = BUFFER_SIZE) {
    this.bufferSize  = bufferSize
    this.buffer      = []  // Array<Array<{x,y,z}>> — raw landmark frames
    this.emptyFrames = 0   // consecutive frames with no valid landmarks
    // NEW CODE — stability improvements
    this.lastResult  = null  // last detected gesture (for hysteresis)
    this.resultCount = 0    // consecutive frames with same result
    this.minResultFrames = 3  // min frames before accepting gesture change
  }

  /**
   * NEW CODE — Push one frame of raw MediaPipe landmarks into the rolling buffer.
   * Returns `this` for chaining: analyzer.push(lm).analyze()
   *
   * @param {Array<{x,y,z}>} landmarks — 21 MediaPipe raw landmarks (or null)
   */
  push(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      this.emptyFrames++
      // Reset buffer after sustained absence — hand left frame
      if (this.emptyFrames > 10) this.reset()
      return this
    }
    this.emptyFrames = 0
    this.buffer.push(landmarks)
    if (this.buffer.length > this.bufferSize) this.buffer.shift()
    return this
  }

  /** Clear the buffer (e.g. when switching modes or user pauses) */
  reset() {
    this.buffer      = []
    this.emptyFrames = 0
  }

  /**
   * NEW CODE — Compute motion features from the current buffer.
   *
   * Returned features:
   *   meanVelocity  — average wrist speed (magnitude) across all frame pairs
   *   netDx / netDy — total wrist displacement across buffer
   *   oscillationX/Y — direction reversals of wrist in X / Y axes
   *   idxOscX/Y     — direction reversals of index TIP in X / Y axes
   *   midOscX       — direction reversals of middle TIP in X
   *   pose          — finger extension state of latest frame
   *
   * @returns {object|null} — null if buffer has fewer than MIN_FRAMES frames
   */
  getFeatures() {
    const n = this.buffer.length
    if (n < MIN_FRAMES) return null

    const wristDx = [], wristDy = []
    const idxDx   = [], idxDy   = []
    const midDx   = []

    for (let i = 1; i < n; i++) {
      const prev = this.buffer[i - 1]
      const curr = this.buffer[i]

      const wd = delta(prev, curr, WRIST)
      wristDx.push(wd.dx)
      wristDy.push(wd.dy)

      const id = delta(prev, curr, IDX_TIP)
      idxDx.push(id.dx)
      idxDy.push(id.dy)

      const md = delta(prev, curr, MID_TIP)
      midDx.push(md.dx)
    }

    // Mean wrist velocity (scalar speed)
    const speeds = wristDx.map((dx, i) => mag(dx, wristDy[i]))
    const meanVelocity = speeds.reduce((a, b) => a + b, 0) / speeds.length

    // Net displacement — total travel direction
    const netDx = wristDx.reduce((a, b) => a + b, 0)
    const netDy = wristDy.reduce((a, b) => a + b, 0)

    // Direction reversals (oscillation counts)
    const oscillationX = oscillationCount(wristDx)
    const oscillationY = oscillationCount(wristDy)
    const idxOscX      = oscillationCount(idxDx)
    const idxOscY      = oscillationCount(idxDy)
    const midOscX      = oscillationCount(midDx)

    // Finger pose + wrist height (MediaPipe y grows downward — small y = near top/head)
    const first = this.buffer[0]
    const latest = this.buffer[n - 1]
    const I = isExtended(latest, IDX_TIP, IDX_PIP)
    const M = isExtended(latest, MID_TIP, MID_PIP)
    const R = isExtended(latest, RNG_TIP, RNG_PIP)
    const P = isExtended(latest, PNK_TIP, PNK_PIP)
    const T = thumbExtended(latest)
    const extCount = [I, M, R, P].filter(Boolean).length
    const wristYStart = first[WRIST].y
    const wristYEnd = latest[WRIST].y

    return {
      meanVelocity,
      netDx, netDy,
      oscillationX, oscillationY,
      idxOscX, idxOscY,
      midOscX,
      wristYStart,
      wristYEnd,
      pose: { I, M, R, P, T, extCount },
      n,
    }
  }

  /**
   * NEW CODE — Run dynamic gesture detection on the current buffer.
   *
   * Returns a result object {label, confidence, topK, source:'motion'} when a
   * dynamic gesture is confirmed, or null to fall through to the existing pipeline.
   *
   * INTEGRATION POINT: called from useClassifier.js predict() after two-hand check,
   * before digit / geo / ML classifiers.
   *
   * @returns {{ label, confidence, topK, source } | null}
   */
  analyze() {
    const f = this.getFeatures()
    if (!f) return null

    const {
      meanVelocity, netDx, netDy,
      oscillationX, oscillationY,
      idxOscX, idxOscY, midOscX,
      wristYStart, wristYEnd,
      pose, n,
    } = f

    // Hand is static — let the existing static classifier handle it
    if (meanVelocity < STATIC_VELOCITY_THRESHOLD) return null

    const openHand =
      pose.extCount >= 4 || (pose.I && pose.M && pose.R && pose.P)
    const atHeadLevel = wristYStart < 0.42 || wristYEnd < 0.45
    const sweptAwayFromHead =
      Math.abs(netDx) > 0.03 ||
      (wristYEnd - wristYStart > 0.02 && Math.abs(netDx) > 0.018)
    const waveAtHead =
      oscillationX >= 2 &&
      atHeadLevel &&
      Math.abs(netDx) >= 0.02
    const isWhatFlutter =
      pose.extCount >= 3 &&
      idxOscX >= 3 &&
      midOscX >= 3 &&
      oscillationX >= 3 &&
      Math.abs(netDx) < 0.07 &&
      Math.abs(netDy) < 0.07

    // ── HELLO: flat open hand at temple/head, wave or sweep away ───────────
    // ISL greeting: palm near cheek/forehead, moves outward (not in-place WHAT).
    if (
      openHand &&
      atHeadLevel &&
      !isWhatFlutter &&
      (sweptAwayFromHead || waveAtHead) &&
      meanVelocity > 0.006
    ) {
      const conf =
        0.84 +
        Math.min(0.11, Math.abs(netDx) * 2.5) +
        (waveAtHead ? 0.03 : 0)
      return makeResult('HELLO', conf)
    }

    // DEBUG — enable with: window.__lexiMotionDebug = true
    if (typeof window !== 'undefined' && window.__lexiMotionDebug) {
      console.log(
        `[MotionAnalyzer] vel:${meanVelocity.toFixed(4)} ` +
        `oscX:${oscillationX} oscY:${oscillationY} ` +
        `idxOscX:${idxOscX} idxOscY:${idxOscY} midOscX:${midOscX} ` +
        `net:(${netDx.toFixed(3)},${netDy.toFixed(3)}) ` +
        `pose:I=${pose.I?'↑':'↓'}M=${pose.M?'↑':'↓'}` +
        `R=${pose.R?'↑':'↓'}P=${pose.P?'↑':'↓'} extCount:${pose.extCount}`
      )
    }

    // ── WHAT: finger flutter ───────────────────────────────────────────────
    // ISL "WHAT": open or spread hand shaken side-to-side (fingers flutter).
    // Static classifier sees "5" or "W" — motion fingerprint is the disambiguator.
    //
    // Rules:
    //   - Multiple fingers extended (open hand pose)
    //   - Index AND middle fingertips oscillate in X (both tips wiggle)
    //   - Wrist also oscillates (the whole hand shakes)
    //   - Low net travel (hand stays in roughly the same place)
    if (
      pose.extCount >= 3 &&       // 3+ fingers extended (open/spread hand)
      idxOscX >= 3 &&             // index tip reverses direction ≥3 times
      midOscX >= 3 &&             // middle tip also oscillating
      oscillationX >= 3 &&        // wrist oscillates too
      Math.abs(netDx) < 0.07 &&  // not actually drifting sideways
      Math.abs(netDy) < 0.07     // not drifting vertically
    ) {
      // Confidence scales up with more oscillations (more decisive gesture)
      const conf = 0.78 + Math.min(0.12, (idxOscX - 3) * 0.04)
      return makeResult('WHAT', conf)
    }

    // ── NO: index-finger wag side-to-side ─────────────────────────────────
    // ISL "NO": only index finger extended, wagging left-right.
    // Static classifier sees "1" — motion reveals the wag pattern.
    //
    // Rules:
    //   - Only index extended (all others curled)
    //   - Both wrist and index tip oscillate in X
    //   - Hand stays at roughly the same height (low netDy)
    if (
      pose.I && !pose.M && !pose.R && !pose.P &&  // index only
      oscillationX >= 3 &&                          // wrist wags ≥3x
      idxOscX >= 3 &&                               // index tip wags ≥3x
      meanVelocity > 0.008 &&
      Math.abs(netDy) < 0.05
    ) {
      const conf = 0.78 + Math.min(0.10, (oscillationX - 3) * 0.03)
      return makeResult('NO', conf)
    }

    // ── COME: beckoning inward ─────────────────────────────────────────────
    // ISL "COME": fingers bent/curled repeatedly toward the signer.
    // Static classifier sees bent fingers ("E" or similar).
    //
    // Rules:
    //   - Mostly curled fingers (beckoning shape)
    //   - Net downward displacement (toward signer, lower in image = closer)
    //   - Index tip oscillates in Y (curls down repeatedly)
    if (
      pose.extCount <= 2 &&    // fingers mostly bent
      netDy > 0.04 &&          // net downward travel (toward signer)
      idxOscY >= 2 &&          // index bends up/down repeatedly
      meanVelocity > 0.007
    ) {
      const conf = 0.78 + Math.min(0.08, (idxOscY - 2) * 0.035)
      return makeResult('COME', conf)
    }

    // ── HELP: fist lifting upward ──────────────────────────────────────────
    // ISL "HELP": closed fist placed on open palm, lifted upward.
    // Simplified to: fist moving upward (the salient motion feature).
    // Static classifier sees "A" or "S" — upward trajectory is unique.
    //
    // Rules:
    //   - All fingers curled (fist pose)
    //   - Strong net upward movement (netDy negative = moving up in image)
    //   - Linear motion (low oscillation — not wagging, just lifting)
    if (
      pose.extCount === 0 &&   // all fingers curled = fist
      !pose.T &&                // thumb not extended
      netDy < -0.05 &&         // significant upward travel
      oscillationX < 2 &&      // not shaking side to side
      oscillationY < 2 &&      // smooth linear upward (not bouncing)
      meanVelocity > 0.008
    ) {
      const conf = 0.78 + Math.min(0.08, (Math.abs(netDy) - 0.05) * 4)
      return makeResult('HELP', conf)
    }

    // ── J: index arcs downward then hooks inward ───────────────────────────
    // ISL "J": index traces a J-shape (arc down then hook under).
    // Rules:
    //   - Only index extended
    //   - Net downward travel + a horizontal component (the arc/hook)
    //   - Smooth trajectory (low oscillation — single continuous arc)
    if (
      pose.I && !pose.M && !pose.R && !pose.P &&
      n >= 10 &&
      netDy > 0.045 &&           // downward arc
      Math.abs(netDx) > 0.03 &&  // horizontal curve component
      oscillationX <= 1 &&        // smooth (no reversals during the arc)
      oscillationY <= 1 &&
      meanVelocity > 0.007
    ) {
      return makeResult('J', 0.80)
    }

    // ── Z: index traces zigzag Z-shape ────────────────────────────────────
    // ISL "Z": index traces the letter Z in the air (3 strokes).
    // Rules:
    //   - Only index extended
    //   - Multiple direction reversals in BOTH X and Y (the zigzag pattern)
    //   - Enough frames for the full Z stroke to complete
    if (
      pose.I && !pose.M && !pose.R && !pose.P &&
      n >= 12 &&
      oscillationX >= 2 &&   // at least 2 X reversals (left → right → left)
      oscillationY >= 2 &&   // at least 2 Y reversals (matches the Z strokes)
      meanVelocity > 0.009
    ) {
      return makeResult('Z', 0.79)
    }

    // No dynamic gesture matched — return null to let existing pipeline run
    return null
  }
}

// ── Browser debug helper ──────────────────────────────────────────────────────
// Enable in DevTools console: window.__lexiMotionDebug = true
// Disable:                    window.__lexiMotionDebug = false
if (typeof window !== 'undefined') {
  window.__lexiMotionDebug = false
}
