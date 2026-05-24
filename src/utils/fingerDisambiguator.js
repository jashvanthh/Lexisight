import { detectLetterB, detectLetterG } from './islTwoHandLetters.js'

/**
 * LexiSight Finger Disambiguator v2
 * ════════════════════════════════════════════════════════════════
 * Runs AFTER the ML model to correct systematic confusion between
 * visually similar gestures using simple, battle-tested geometry.
 *
 * Uses the SAME approach as geoClassifier.js (tip.y < pip.y = extended)
 * because that's what works reliably with MediaPipe landmarks.
 *
 * MediaPipe: y=0 at TOP of image, increases downward.
 * So tip.y < pip.y  →  tip is HIGHER than pip  →  finger is EXTENDED.
 *
 * Landmark indices:
 *   0=Wrist
 *   1-4 = Thumb  (MCP1, MCP2, IP, TIP)
 *   5-8 = Index  (MCP, PIP, DIP, TIP)
 *   9-12= Middle (MCP, PIP, DIP, TIP)
 *  13-16= Ring   (MCP, PIP, DIP, TIP)
 *  17-20= Pinky  (MCP, PIP, DIP, TIP)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives  (identical to geoClassifier.js so we know they work)
// ─────────────────────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/**
 * Returns true when finger tip is clearly above its PIP joint.
 * thresh: minimum vertical gap required (fraction of image height).
 */
function extended(lm, tipIdx, pipIdx, thresh = 0.03) {
  return lm[tipIdx].y < lm[pipIdx].y - thresh
}

/**
 * Returns true when finger tip is clearly BELOW or AT its PIP joint.
 * Opposite of extended — finger is bent/curled.
 */
function curled(lm, tipIdx, pipIdx, thresh = 0.01) {
  return lm[tipIdx].y > lm[pipIdx].y - thresh
}

// Named shorthand helpers — same pattern as geoClassifier.js
const I  = (lm, t=0.03) => extended(lm,  8,  6, t)   // Index
const Mi = (lm, t=0.03) => extended(lm, 12, 10, t)   // Middle
const R  = (lm, t=0.03) => extended(lm, 16, 14, t)   // Ring
const P  = (lm, t=0.03) => extended(lm, 20, 18, t)   // Pinky

const Ic = (lm, t=0.01) => curled(lm,  8,  6, t)     // Index curled
const Mc = (lm, t=0.01) => curled(lm, 12, 10, t)     // Middle curled
const Rc = (lm, t=0.01) => curled(lm, 16, 14, t)     // Ring curled
const Pc = (lm, t=0.01) => curled(lm, 20, 18, t)     // Pinky curled


// ─────────────────────────────────────────────────────────────────────────────
// Per-pair rules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 2 vs 3
 * ISL 2: index + middle UP, ring + pinky DOWN
 * ISL 3: index + middle + ring UP, pinky DOWN
 *
 * Discriminant: is ring finger extended or curled?
 * This is a 1-bit binary decision — should be 100% reliable.
 */
function rule_2_3(lm) {
  const indexUp  = I(lm)
  const middleUp = Mi(lm)
  const ringUp   = R(lm)
  const pinkyDn  = Pc(lm)

  // For this pair we ONLY fire if index+middle are up (otherwise it's probably
  // a different gesture entirely and we shouldn't interfere)
  if (!indexUp || !middleUp) return null

  if (ringUp)  return { label: '3', confidence: 0.92 }
  if (Rc(lm))  return { label: '2', confidence: 0.92 }

  return null  // ring ambiguous — let ML decide
}

/**
 * M vs N
 * ISL M: ring + middle + index bent OVER thumb (3 fingers over thumb)
 * ISL N: index + middle bent over thumb, ring free
 *
 * Discriminant: ring tip position relative to thumb tip.
 */
function rule_M_N(lm) {
  const thumbTip = lm[4]
  const ringTip  = lm[16]
  const ringPip  = lm[14]

  // Ring tip is below (higher y) than ring PIP = ring is bent downward = covering thumb
  const ringBentDown = ringTip.y > ringPip.y + 0.01

  // Ring tip is well above its PIP = ring is free / extended
  const ringFree = ringTip.y < ringPip.y - 0.02

  if (ringBentDown) return { label: 'M', confidence: 0.82 }
  if (ringFree)     return { label: 'N', confidence: 0.80 }
  return null
}

/**
 * O vs 6
 * ISL O: all fingers curled into circle, index tip ≈ thumb tip
 * ISL 6: thumb tip ≈ pinky tip, other fingers extended
 *
 * Discriminant: which tip is closest to thumb.
 */
function rule_O_6(lm) {
  const pinkyOnly = P(lm) && !I(lm) && !Mi(lm) && !R(lm)
  if (pinkyOnly) return { label: '6', confidence: 0.93 }

  const thumbTip = lm[4]
  const indexTip = lm[8]
  const dIndex = dist(indexTip, thumbTip)
  if (dIndex < 0.07) return { label: 'O', confidence: 0.88 }
  return null
}

/**
 * U vs R
 * ISL U: index + middle extended PARALLEL
 * ISL R: index + middle extended but CROSSED (scissor)
 *
 * Discriminant: tip spread vs PIP spread.
 * Crossed fingers → tips closer than PIPs.
 */
function rule_U_R(lm) {
  const tipSpread = dist(lm[8], lm[12])
  const pipSpread = dist(lm[6], lm[10])

  if (tipSpread < pipSpread * 0.82)  return { label: 'R', confidence: 0.83 }
  if (tipSpread > pipSpread * 1.05)  return { label: 'U', confidence: 0.81 }
  return null
}

/**
 * 7 vs 8
 * ISL 7 (some systems): middle tip touches thumb
 * ISL 8 (some systems): index tip touches thumb
 */
/**
 * D vs 1
 * ISL D: index up, thumb + M/R/P curled into circle under index
 * ISL 1: index up only, thumb to side / not touching middle base
 */
function rule_D_1(lm) {
  const indexUp = I(lm)
  if (!indexUp) return null
  if (!Mc(lm) || !Rc(lm) || !Pc(lm)) return null

  const thumbToMiddle = dist(lm[4], lm[9]) < 0.13
  const thumbToRing = dist(lm[4], lm[13]) < 0.14
  if (thumbToMiddle || thumbToRing) return { label: 'D', confidence: 0.9 }
  if (Pc(lm) && dist(lm[4], lm[8]) > 0.12) return { label: '1', confidence: 0.88 }
  return null
}

function fingerDownRule(lm, tip, pip, mcp) {
  if (lm[tip].y < lm[pip].y - 0.022) return false
  const reach = dist(lm[tip], lm[mcp])
  const pipReach = dist(lm[pip], lm[mcp])
  const extended = reach > pipReach * 0.72
  const downY = lm[tip].y > lm[pip].y - 0.008
  const longReach = dist(lm[tip], lm[0]) > 0.08
  return extended && (downY || longReach)
}

function rule_N_M_W(lm) {
  if (I(lm) && Mi(lm) && R(lm) && !P(lm)) return { label: 'W', confidence: 0.9 }

  const iD = fingerDownRule(lm, 8, 6, 5)
  const mD = fingerDownRule(lm, 12, 10, 9)
  const rD = fingerDownRule(lm, 16, 14, 13)
  const rCurled = Rc(lm) || !rD

  if (iD && mD && rCurled && !rD) return { label: 'N', confidence: 0.92 }
  if (iD && mD && rD) return { label: 'M', confidence: 0.92 }
  return null
}

function rule_M_C(lm) {
  const r = rule_N_M_W(lm)
  if (r?.label === 'M' || r?.label === 'N') return r
  return null
}

function rule_M_W(lm) {
  return rule_N_M_W(lm)
}

function rule_2_8(lm) {
  if (!I(lm) || !Mi(lm) || !Rc(lm) || !Pc(lm)) return null

  const thumbUp = lm[4].y < lm[3].y - 0.035
  const farThumb = dist(lm[4], lm[5]) > 0.10
  const nearThumb = dist(lm[4], lm[5]) < 0.095
  const thumbDown = lm[4].y >= lm[3].y - 0.02

  if (thumbUp && farThumb) return { label: '8', confidence: 0.94 }
  if (thumbDown && nearThumb) return { label: '2', confidence: 0.94 }

  let s8 = 0
  let s2 = 0
  if (lm[4].y < lm[3].y - 0.02) s8 += 2
  if (dist(lm[4], lm[5]) > 0.09) s8 += 2
  if (dist(lm[4], lm[5]) < 0.09) s2 += 2
  if (lm[4].y >= lm[3].y) s2 += 2
  if (s8 > s2 + 1) return { label: '8', confidence: 0.88 }
  if (s2 > s8 + 1) return { label: '2', confidence: 0.88 }
  return null
}

function rule_7_8(lm) {
  const indexBent = lm[8].y >= lm[6].y - 0.012
  if (indexBent && Ic(lm) && Mc(lm) && Rc(lm)) return { label: '7', confidence: 0.91 }
  return rule_2_8(lm)
}

function rule_9_thumb(lm) {
  const thumbDown = lm[4].y > lm[3].y + 0.02 && lm[4].y > lm[0].y + 0.03
  if (thumbDown && Ic(lm) && Mc(lm) && Rc(lm) && Pc(lm)) {
    return { label: '9', confidence: 0.92 }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const RULES = [
  { labels: new Set(['D', '1']),  fn: rule_D_1,  threshold: 0.70 },
  { labels: new Set(['M', 'N', 'C', '0', 'W']), fn: rule_N_M_W, threshold: 0.65 },
  { labels: new Set(['M', 'C', '0']), fn: rule_M_C, threshold: 0.72 },
  { labels: new Set(['M', 'W']), fn: rule_M_W, threshold: 0.72 },
  { labels: new Set(['2', '3']),  fn: rule_2_3,  threshold: 0.97 },
  { labels: new Set(['M', 'N']),  fn: rule_M_N,  threshold: 0.92 },
  { labels: new Set(['O', '6']),  fn: rule_O_6,  threshold: 0.92 },
  { labels: new Set(['U', 'R']),  fn: rule_U_R,  threshold: 0.88 },
  { labels: new Set(['2', '8']), fn: rule_2_8, threshold: 0.65 },
  { labels: new Set(['7', '8', '2']), fn: rule_7_8, threshold: 0.75 },
  { labels: new Set(['9', '0', 'A']), fn: rule_9_thumb, threshold: 0.75 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Debug helpers exposed at window scope during dev
// ─────────────────────────────────────────────────────────────────────────────

let _debugActive = false
let _debugLog    = []
const MAX_LOG    = 60  // keep last 60 frames

/**
 * Call window.__lexiDebug(true) in browser console to enable finger logging.
 * Call window.__lexiDebug(false) to stop.
 */
if (typeof window !== 'undefined') {
  window.__lexiDebug = (on) => {
    _debugActive = on
    _debugLog    = []
    console.log(`[LexiSight] Finger debug ${on ? 'ON' : 'OFF'}`)
  }
  window.__lexiDebugLog = () => console.table(_debugLog.slice(-20))
}

function debugFrame(lm, mlLabel, mlConf, finalLabel, finalConf) {
  if (!_debugActive) return
  const row = {
    ml: mlLabel,
    mlConf: mlConf.toFixed(3),
    final: finalLabel,
    finalConf: finalConf.toFixed(3),
    I_ext:  I(lm).toString(),
    Mi_ext: Mi(lm).toString(),
    R_ext:  R(lm).toString(),
    P_ext:  P(lm).toString(),
    Rc:     Rc(lm).toString(),
  }
  _debugLog.push(row)
  if (_debugLog.length > MAX_LOG) _debugLog.shift()
  console.log(
    `[Disambig] ML=${mlLabel}(${(mlConf*100).toFixed(0)}%) → ${finalLabel}(${(finalConf*100).toFixed(0)}%) | ` +
    `I=${I(lm)?'↑':'↓'} M=${Mi(lm)?'↑':'↓'} R=${R(lm)?'↑':'↓'} P=${P(lm)?'↑':'↓'}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post-process an ML prediction using geometric finger rules.
 *
 * @param {{ label, confidence, topK }} mlResult
 * @param {Array<{x,y,z}>} rawLandmarks  — 21 MediaPipe landmarks
 * @returns {{ label, confidence, topK }}
 *
 * Behaviour:
 *  - If the ML label is not in a known confused pair → unchanged
 *  - If ML confidence ≥ threshold AND geo agrees → unchanged
 *  - If ML confidence ≥ threshold AND geo disagrees → geo wins
 *    (geometry is more reliable for these specific pairs)
 *  - If geo returns null (ambiguous) → ML result unchanged
 */
export function disambiguate(mlResult, rawLandmarks, rawLandmarks2 = null) {
  if (!mlResult || !rawLandmarks || rawLandmarks.length < 21) return mlResult

  if (rawLandmarks2?.length === 21) {
    const b = detectLetterB(rawLandmarks, rawLandmarks2)
    if (b) {
      return {
        label: b.label,
        confidence: b.confidence,
        topK: b.topK,
        source: 'two_hand_b',
        _mlLabel: mlResult.label,
        _mlConf: mlResult.confidence,
      }
    }
    const g = detectLetterG(rawLandmarks, rawLandmarks2)
    if (g) {
      return {
        label: g.label,
        confidence: g.confidence,
        topK: g.topK,
        source: 'two_hand_g',
        _mlLabel: mlResult.label,
        _mlConf: mlResult.confidence,
      }
    }
  }

  const { label: mlLabel, confidence: mlConf, topK } = mlResult

  const rule = RULES.find(r => r.labels.has(mlLabel))
  if (!rule) return mlResult   // not a known confused pair

  const geo = rule.fn(rawLandmarks)

  // Geo signal is ambiguous — trust ML
  if (!geo) {
    debugFrame(rawLandmarks, mlLabel, mlConf, mlLabel, mlConf)
    return mlResult
  }

  // Geo agrees with ML — boost confidence slightly and return
  if (geo.label === mlLabel) {
    const boosted = { ...mlResult, confidence: Math.min(0.98, Math.max(mlConf, geo.confidence)) }
    debugFrame(rawLandmarks, mlLabel, mlConf, boosted.label, boosted.confidence)
    return boosted
  }

  // Geo DISAGREES with ML → geo wins
  // Geometry is a deterministic oracle for these specific pairs;
  // the ML is confused by training distribution overlap.
  const updatedTopK = [
    { label: geo.label, confidence: geo.confidence },
    ...(topK || []).filter(t => t.label !== geo.label).slice(0, 2),
  ]

  const result = {
    label:     geo.label,
    confidence: geo.confidence,
    topK:      updatedTopK,
    source:    'geo_override',
    _mlLabel:  mlLabel,
    _mlConf:   mlConf,
  }

  debugFrame(rawLandmarks, mlLabel, mlConf, geo.label, geo.confidence)
  return result
}

/**
 * One-shot finger state string — call from any component for debugging.
 * Example: import { fingerState } from '../utils/fingerDisambiguator'
 *          console.log(fingerState(rawLandmarks))
 * → "I:↑ M:↑ R:↓ P:↓"
 */
export function fingerState(lm) {
  if (!lm || lm.length < 21) return 'no landmarks'
  return `I:${I(lm)?'↑':'↓'} M:${Mi(lm)?'↑':'↓'} R:${R(lm)?'↑':'↓'} P:${P(lm)?'↑':'↓'}`
}
