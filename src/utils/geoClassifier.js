/**
 * LexiSight Geometric ISL Gesture Classifier
 * ════════════════════════════════════════════
 * Works directly from MediaPipe Hands raw landmarks (21 points).
 * No trained model required — uses finger extension geometry.
 *
 * Landmark indices (MediaPipe Hands):
 *   0  = Wrist
 *   1-4  = Thumb  (CMC, MCP, IP, TIP)
 *   5-8  = Index  (MCP, PIP, DIP, TIP)
 *   9-12 = Middle (MCP, PIP, DIP, TIP)
 *  13-16 = Ring   (MCP, PIP, DIP, TIP)
 *  17-20 = Pinky  (MCP, PIP, DIP, TIP)
 *
 
 */

// ── Utility helpers ──────────────────────────────────────────────────────────

export function dist2D(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/** A finger is considered "extended" when its tip is far from its base joint (MCP) */
export function isExtended(lm, tipIdx, pipIdx, thresh = 0.025) {
  if (!lm || lm.length < 21) return false
  const pw = dist2D(lm[5], lm[17]) || 0.001
  const baseIdx = tipIdx - 3
  return dist2D(lm[tipIdx], lm[baseIdx]) > pw * 0.95
}

/** Strict extension — larger gap required (reduces false positives) */
function isExtendedStrict(lm, tipIdx, pipIdx) {
  if (!lm || lm.length < 21) return false
  const pw = dist2D(lm[5], lm[17]) || 0.001
  const baseIdx = tipIdx - 3
  return dist2D(lm[tipIdx], lm[baseIdx]) > pw * 1.1
}

/** Finger is definitively curled — tip close to base joint */
function isCurled(lm, tipIdx, pipIdx) {
  if (!lm || lm.length < 21) return true
  const pw = dist2D(lm[5], lm[17]) || 0.001
  const baseIdx = tipIdx - 3
  return dist2D(lm[tipIdx], lm[baseIdx]) < pw * 0.85
}

/** Thumb extension: tip must be clearly away from BOTH the index MCP AND the middle MCP.
 *  Uses palm-width normalization so distance is scale-invariant.
 *  A thumb resting naturally to the side (e.g. during "3") will NOT trigger this.
 *  Only a genuinely spread/pointing thumb (as in "5", "7", "8", "9", "up") will. */
export function thumbExtended(lm) {
  const pw = dist2D(lm[5], lm[17]) || 0.001   // palm width: index MCP → pinky MCP
  const farFromIndexMCP  = dist2D(lm[4], lm[5]) > pw * 1.0   // tip vs index base
  const farFromMiddleMCP = dist2D(lm[4], lm[9]) > pw * 0.9   // tip vs middle base
  return farFromIndexMCP && farFromMiddleMCP
}

/** NEW: Check if thumb is folded across palm (characteristic of "4" gesture) */
function thumbFoldedAcross(lm) {
  // Thumb tip (4) should be close to index finger base (5) or middle finger base (9)
  // AND thumb should NOT be pointing upward
  const thumbNearIndex = dist2D(lm[4], lm[5]) < 0.12
  const thumbNearMiddle = dist2D(lm[4], lm[9]) < 0.15
  const thumbNotUp = !thumbPointingUp(lm)
  
  return (thumbNearIndex || thumbNearMiddle) && thumbNotUp
}

/** Thumb pointing upward (tip above IP joint) */
function thumbPointingUp(lm) {
  return lm[4].y < lm[3].y - 0.02
}

/** Thumb pointing downward (thumbs-down / digit 9) */
function thumbPointingDown(lm) {
  return lm[4].y > lm[3].y + 0.02 && lm[4].y > lm[0].y + 0.03
}

/** Index bent at PIP (hook), not straight up like 1 */
function indexFingerBent(lm) {
  return lm[8].y >= lm[6].y - 0.012
}

/** Index fully tucked into palm (digit 0 fist — not a 7 hook). */
function indexTuckedInFist(lm) {
  return (
    dist2D(lm[8], lm[5]) < 0.115 &&
    dist2D(lm[8], lm[9]) < 0.11 &&
    !isExtended(lm, 8, 6, 0.02)
  )
}

/** ISL 0 — tight closed fist, all digits including index curled in. */
export function matchDigit0(lm) {
  if (!lm || lm.length < 21) return false
  if (thumbPointingDown(lm)) return false
  if (isExtended(lm, 20, 18, 0.025)) return false

  return (
    isFist(lm) &&
    isCurled(lm, 8, 6) &&
    isCurled(lm, 12, 10) &&
    isCurled(lm, 16, 14) &&
    isCurled(lm, 20, 18) &&
    (indexTuckedInFist(lm) || dist2D(lm[8], lm[5]) < 0.13)
  )
}

/** ISL 7 — index hooked out; must not match a full fist (0). */
function matchDigit7(lm) {
  if (matchDigit0(lm)) return false
  if (!indexFingerBent(lm) || isExtended(lm, 8, 6, 0.02)) return false
  if (indexTuckedInFist(lm)) return false
  if (!isCurled(lm, 12, 10) || !isCurled(lm, 16, 14) || !isCurled(lm, 20, 18)) return false

  const hookOut =
    dist2D(lm[8], lm[5]) > 0.1 ||
    dist2D(lm[8], lm[0]) > 0.12 ||
    dist2D(lm[8], lm[9]) > 0.11

  return hookOut
}

/** Index + middle up, ring + pinky down — shared by 2 and 8 */
function isTwoEightHandShape(lm) {
  return (
    isExtended(lm, 8, 6) &&
    isExtended(lm, 12, 10) &&
    isCurled(lm, 16, 14) &&
    isCurled(lm, 20, 18)
  )
}

/** 8: thumb clearly out (up and away from palm) */
function thumbClearlyOutFor8(lm) {
  const thumbUp = lm[4].y < lm[3].y - 0.035
  const farFromIndexBase = dist2D(lm[4], lm[5]) > 0.10
  const awayFromMiddle = dist2D(lm[4], lm[9]) > 0.11
  const aboveWrist = lm[4].y < lm[0].y - 0.01
  return (thumbUp && farFromIndexBase) || (farFromIndexBase && awayFromMiddle && aboveWrist)
}

/** 2: thumb tucked — not up, close to palm / index side */
function thumbTuckedFor2(lm) {
  const notUp = lm[4].y >= lm[3].y - 0.02
  const nearIndexBase = dist2D(lm[4], lm[5]) < 0.095
  const nearMiddleBase = dist2D(lm[4], lm[9]) < 0.11
  const folded = thumbFoldedAcross(lm)
  return folded || (notUp && (nearIndexBase || nearMiddleBase))
}

/**
 * Split 2 vs 8 when hand shape is index+middle up (peace / three-with-thumb).
 * @returns {'2'|'8'|null}
 */
export function resolveDigit2Or8(lm) {
  if (!lm || lm.length < 21 || !isTwoEightHandShape(lm)) return null

  const out8 = thumbClearlyOutFor8(lm)
  const tuck2 = thumbTuckedFor2(lm)

  if (out8 && !tuck2) return '8'
  if (tuck2 && !out8) return '2'

  // Ambiguous thumb — score both signals
  let score8 = 0
  let score2 = 0
  if (lm[4].y < lm[3].y - 0.02) score8 += 2
  if (dist2D(lm[4], lm[5]) > 0.09) score8 += 2
  if (lm[4].y < lm[0].y) score8 += 1
  if (thumbFoldedAcross(lm)) score2 += 3
  if (dist2D(lm[4], lm[5]) < 0.09) score2 += 2
  if (lm[4].y >= lm[3].y) score2 += 1

  if (score8 > score2 + 1) return '8'
  if (score2 > score8 + 1) return '2'
  return null
}

/** Distance between two fingertips */
function tipDist(lm, a, b) {
  return dist2D(lm[a], lm[b])
}

/** Index and middle form a wide V (spread > 4cm equivalent) */
function isVShape(lm) {
  return tipDist(lm, 8, 12) > 0.04
}

/** All 4 fingertips spread wide (open hand) — HELLO needs a VERY wide spread */
function isSpread(lm) {
  return tipDist(lm, 8, 20) > 0.28  // FIX: raised from 0.22 to 0.28 to reduce HELLO false positives
}

/** Index tip nearly touches thumb tip (O round shape) */
export function isOTouch(lm) {
  return tipDist(lm, 4, 8) < 0.06
}

/** All fingers tightly curled (fist) */
export function isFist(lm) {
  const t = !thumbExtended(lm)
  const i = !isExtended(lm, 8, 6)
  const m = !isExtended(lm, 12, 10)
  const r = !isExtended(lm, 16, 14)
  const p = !isExtended(lm, 20, 18)
  return t && i && m && r && p
}

/** Build a result object matching the ML classifier output shape */
function make(label, confidence, alternates = []) {
  const topK = [{ label, confidence }]
  alternates.forEach((alt, i) => {
    topK.push({ label: alt, confidence: Math.max(0.01, confidence - 0.15 - i * 0.06) })
  })
  return { label, confidence, topK: topK.slice(0, 4), source: 'geo' }
}

// ════════════════════════════════════════════════════════════════════════════
// ISL DIGIT CLASSIFIER — Pure geometry, bypasses ML entirely.
//
// HARDCODED FINGER-COUNT RULES (as specified by user):
//   1 finger up  (index only)              → "1"
//   2 fingers up (index + middle)          → "2"
//   3 fingers up (index + middle + ring)   → "3"
//   4 fingers up (index+middle+ring+pinky) → "4"
//   All 5 up                               → "5"
//   Thumb only up (thumbs-up)              → "up"
//   Thumb + index up                       → "7"
//   Thumb + index + middle up              → "8"
//   Thumb + index + middle + ring up       → "9"
//   Closed fist                            → "0"
// ════════════════════════════════════════════════════════════════════════════

/**
 * Classify ISL digits / number gestures from raw MediaPipe landmarks.
 * All rules are fully hardcoded — no ML involved.
 *
 * @param {Array<{x,y,z}>} lm — 21 MediaPipe landmarks
 */
export function classifyISLDigit(lm) {
  if (!lm || lm.length < 21) return null

  const pw = dist2D(lm[5], lm[17]) || 0.001  // palm width (scale reference)

  // ── Digit-specific helpers ────────────────────────────────────────────
  // These are STRICTER than the general isExtended/isCurled.
  // A finger is only "UP" for digit purposes when its tip is:
  //   (a) far from its MCP base (distance check), AND
  //   (b) visually above its PIP joint (Y-axis check)
  // This prevents relaxed/half-curled fingers in L-shape or other poses
  // from being falsely counted as "extended".

  function fingerUp(tipIdx) {
    const baseIdx = tipIdx - 3  // MCP
    const pipIdx  = tipIdx - 2  // PIP
    const farFromBase = dist2D(lm[tipIdx], lm[baseIdx]) > pw * 1.05
    const abovePIP    = lm[tipIdx].y < lm[pipIdx].y - pw * 0.1
    return farFromBase && abovePIP
  }

  function fingerDown(tipIdx) {
    const baseIdx = tipIdx - 3
    const pipIdx  = tipIdx - 2
    // Either close to MCP (tight curl), OR tip not above PIP (relaxed curl)
    const closeToBase = dist2D(lm[tipIdx], lm[baseIdx]) < pw * 0.9
    const notAbovePIP = lm[tipIdx].y >= lm[pipIdx].y - pw * 0.05
    return closeToBase || notAbovePIP
  }

  const I_up   = fingerUp(8)    // Index
  const M_up   = fingerUp(12)   // Middle
  const R_up   = fingerUp(16)   // Ring
  const P_up   = fingerUp(20)   // Pinky

  const I_down = fingerDown(8)
  const M_down = fingerDown(12)
  const R_down = fingerDown(16)
  const P_down = fingerDown(20)

  const T_ext  = thumbExtended(lm)  // Thumb (existing logic is fine for thumb)

  // ══════════════════════════════════════════════════════════════════════
  // RULES — most specific → least specific to avoid ambiguity
  // ══════════════════════════════════════════════════════════════════════

  // ── 0: Tight closed fist ─────────────────────────────────────────────
  if (matchDigit0(lm)) {
    return make('0', 0.97, ['A', 'O'])
  }

  // ── 5: ALL 5 fingers up (open hand) ──────────────────────────────────
  if (T_ext && I_up && M_up && R_up && P_up) {
    return make('5', 0.97, ['HELLO', 'STOP'])
  }

  // ── 9: Thumb + Index + Middle + Ring up, Pinky down ──────────────────
  if (T_ext && I_up && M_up && R_up && P_down) {
    return make('9', 0.96, ['4'])
  }

  // ── 8: Thumb + Index + Middle up, Ring + Pinky down ──────────────────
  if (T_ext && I_up && M_up && R_down && P_down) {
    return make('8', 0.96, ['2', '3'])
  }

  // ── 7: Thumb + Index up ONLY, Middle + Ring + Pinky down ─────────────
  if (T_ext && I_up && M_down && R_down && P_down) {
    return make('7', 0.96, ['L', '1'])
  }

  // ── 6: Thumb only up (thumbs-up), all four fingers down ───────────────
  if (T_ext && I_down && M_down && R_down && P_down && thumbPointingUp(lm)) {
    return make('6', 0.96, ['GOOD', 'YES'])
  }

  // ── 4: Index + Middle + Ring + Pinky up, thumb NOT extended ──────────
  if (!T_ext && I_up && M_up && R_up && P_up) {
    return make('4', 0.96, ['B'])
  }

  // ── 3: Index + Middle + Ring up, Pinky + Thumb down ──────────────────
  if (!T_ext && I_up && M_up && R_up && P_down) {
    return make('3', 0.96, ['W'])
  }

  // ── 2: Index + Middle up, Ring + Pinky + Thumb down ──────────────────
  if (!T_ext && I_up && M_up && R_down && P_down) {
    return make('2', 0.96, ['V', 'PEACE'])
  }

  // ── 1: Index only up, all others down ────────────────────────────────
  if (!T_ext && I_up && M_down && R_down && P_down) {
    return make('1', 0.96, ['D', 'POINT'])
  }

  // No clear number pattern
  return null
}

// ── Main classifier ──────────────────────────────────────────────────────────

/**
 * Classify a hand gesture from raw MediaPipe Hands landmarks.
 * @param {Array<{x:number, y:number, z:number}>} lm - 21 landmarks
 * @returns {{ label: string, confidence: number, topK: Array }} | null
 */
export function classifyGesture(lm, mode = 'letter') {
  if (!lm || lm.length < 21) return null

  // ── Finger state booleans ─────────────────────────────────────
  const T = thumbExtended(lm)       // Thumb
  const I = isExtended(lm, 8, 6)    // Index
  const M = isExtended(lm, 12, 10)  // Middle
  const R = isExtended(lm, 16, 14)  // Ring
  const P = isExtended(lm, 20, 18)  // Pinky

  // ── Extra features ────────────────────────────────────────────
  const spread  = isSpread(lm)
  const vShape  = isVShape(lm)
  const oTouch  = isOTouch(lm)
  const thumbUp = thumbPointingUp(lm)
  const fist    = isFist(lm)

  const extCount = [T, I, M, R, P].filter(Boolean).length

  // ══ Gesture Rules (priority order) ═══════════════════════════

  // ── 4 fingers up, thumb across ──
  if (!T && I && M && R && P) return make('4', 0.88, ['B', 'FOUR', 'NO'])

  // ── Open hand (all 5) ───────────────────────────────────────
  if (T && I && M && R && P) {
    if (spread) return make('HELLO',  0.93, ['5', 'OPEN', 'STOP'])
    return           make('STOP',    0.85, ['HELLO', '5', 'OPEN'])
  }

  // ── Thumb + pinky → I Love You / Y ───────────────────────
  if (T && !I && !M && !R && P)  return make('ILY',  0.90, ['Y', 'ROCK', 'LOVE'])

  // ── Thumb + index + middle + ring → 4 ────────────────────
  if (T && I && M && R && !P)    return make('4',    0.78, ['THREE', 'W'])

  // ── Index + middle + ring up → W / 3 / WATER ─────────────
  if (!T && I && M && R && !P)   return make('W',    0.80, ['3', 'THREE', 'WATER'])

  // ── Thumb + index only → L ────────────────────────────────
  if (T && I && !M && !R && !P)  return make('L',    0.88, ['GUN', 'POINT', '1'])

  // ── Index + middle → V or 2 ──────────────────────────────
  if (!T && I && M && !R && !P) {
    if (vShape) return make('V',    0.88, ['PEACE', 'VICTORY', '2'])
    return           make('2',     0.80, ['V', 'PEACE', 'TWO'])
  }

  // ── Index + middle touching thumb → pinch / OK gesture ─────
  // Previously labeled as NO, but ISL NO is a dynamic wag (handled by MotionAnalyzer).
  // This static pinch shape is closer to O or a tap gesture.
  if (!R && !P && dist2D(lm[8], lm[4]) < 0.12 && dist2D(lm[12], lm[4]) < 0.12) {
    if (mode === 'word') {
      return make('NO', 0.85, ['OK', 'TAP', 'PINCH'])
    }
    return make('O', 0.78, ['OK', 'TAP', 'PINCH'])
  }

  // ── Index only → 1 / D ───────────────────────────────────
  if (!T && I && !M && !R && !P) return make('1',    0.85, ['D', 'POINT', 'INDEX'])

  // ── Pinky only → I ───────────────────────────────────────
  if (!T && !I && !M && !R && P)  return make('I',   0.82, ['PINKY', 'BABY'])

  // ── Middle only ───────────────────────────────────────────
  if (!T && !I && M && !R && !P)  return make('D',   0.68, ['MIDDLE'])

  // ── Thumb + pinky + index → ILY in word mode, 3 in letter mode ────────────
  if (T && I && !M && !R && P) {
    if (mode === 'word') {
      return make('ILY', 0.95, ['Y', 'ROCK', 'LOVE'])
    }
    return make('3',   0.75, ['THREE', 'FAMILY'])
  }

  // ── Thumb only ───────────────────────────────────────────
  if (T && !I && !M && !R && !P) {
    if (thumbUp) return make('GOOD', 0.90, ['YES', 'A', 'THUMBSUP'])
    if (thumbPointingDown(lm)) {
      return make('BAD', 0.92, ['A', 'DOWN'])
    }
    return             make('A',    0.75, ['S', 'GOOD', 'FIST'])
  }

  // ── O shape (index meets thumb) ──────────────────────────
  if (oTouch && !M && !R && !P)   return make('O',   0.85, ['ZERO', 'C', 'OK'])

  // ── Full fist / curled fingers → A / S / YES ──────────────────────────────
  if (!I && !M && !R && !P) {
    if (mode === 'word') {
      return make('YES', 0.94, ['S', 'FIST'])
    }
    if (fist) {
      return make('A',   0.72, ['S', 'YES', 'FIST'])
    }
  }

  // ── Thumb + index + middle → 3 ────────────────────────────
  if (T && I && M && !R && !P)    return make('3',   0.76, ['THREE', 'W', 'WATER'])

  // ── Ring + pinky (no others) ─────────────────────────────
  if (!T && !I && !M && R && P)   return make('U',   0.68, ['R', 'TOGETHER'])

  // ── Index + pinky (horns) ────────────────────────────────
  if (!T && I && !M && !R && P)   return make('ROCK', 0.78, ['HORNS', 'U'])

  return null
}

// ── Two-Hand Gesture Classifier ──────────────────────────────────────────────

/**
 * Classify two-hand ISL signs from two MediaPipe hand landmark sets.
 * Called BEFORE the single-hand ML model — takes priority when both hands visible.
 *
 * @param {Array} lm1  - Primary hand landmarks (21 points {x,y,z})
 * @param {Array} lm2  - Secondary hand landmarks (21 points, may be null)
 * @returns {{ label, confidence, topK }} | null
 */
export function classifyTwoHandGesture(lm1, lm2) {
  if (!lm1 || lm1.length < 21 || !lm2 || lm2.length < 21) return null

  const wristDist = dist2D(lm1[0], lm2[0])
  const handsClose = wristDist < 0.35
  const handsVeryClose = wristDist < 0.18

  const I1 = isExtended(lm1, 8, 6)
  const I2 = isExtended(lm2, 8, 6)
  const fist1 = isFist(lm1)
  const fist2 = isFist(lm2)
  const oTouch1 = isOTouch(lm1)
  const oTouch2 = isOTouch(lm2)
  const flat1 = isExtended(lm1, 8, 6) && isExtended(lm1, 12, 10) && isExtended(lm1, 16, 14)
  const flat2 = isExtended(lm2, 8, 6) && isExtended(lm2, 12, 10) && isExtended(lm2, 16, 14)

  const pw1 = dist2D(lm1[5], lm1[17]) || 0.05
  const pw2 = dist2D(lm2[5], lm2[17]) || 0.05
  const avgPw = (pw1 + pw2) / 2

  const curled1 = !I1 && !isExtended(lm1, 12, 10) && !isExtended(lm1, 16, 14) && !isExtended(lm1, 20, 18)
  const curled2 = !I2 && !isExtended(lm2, 12, 10) && !isExtended(lm2, 16, 14) && !isExtended(lm2, 20, 18)

  // ── DOCTOR: one hand flat, index/middle tips of the other hand touching the flat hand's wrist ──
  const isDoctor1 = flat2 && (dist2D(lm1[8], lm2[0]) < avgPw * 1.4 || dist2D(lm1[12], lm2[0]) < avgPw * 1.4)
  const isDoctor2 = flat1 && (dist2D(lm2[8], lm1[0]) < avgPw * 1.4 || dist2D(lm2[12], lm1[0]) < avgPw * 1.4)
  if (isDoctor1 || isDoctor2) {
    return make('DOCTOR', 0.94, ['HELP', 'MEDICINE', 'PAIN'])
  }

  // ── FRIEND: both index fingers hooked ────────────────────────────────────
  if (I1 && I2 && handsClose && !isExtended(lm1, 12, 10) && !isExtended(lm2, 12, 10)) {
    const tipDist = dist2D(lm1[8], lm2[8])
    if (tipDist < 0.12) {
      // Differentiate X from FRIEND based on wrist layout
      // Usually X is crossed index fingers, resembling a cross.
      return make('X', 0.85, ['FRIEND', 'CROSS'])
    }
  }

  // ── TOGETHER: both fists close ────────────────────────────────────────────
  if (fist1 && fist2 && handsVeryClose) return make('TOGETHER', 0.80, ['WITH', 'FRIEND'])

  // ── FAMILY: both O-hands spread outward ──────────────────────────────────
  if (oTouch1 && oTouch2 && handsClose) return make('FAMILY', 0.82, ['GROUP', 'TOGETHER'])

  // ── MORE: both flat-O tips touching ──────────────────────────────────────
  if (oTouch1 && oTouch2 && handsVeryClose) return make('MORE', 0.79, ['AGAIN', 'EXTRA'])

  // ── MEET: both index fingers pointing together ────────────────────────────
  if (I1 && I2 && handsClose && dist2D(lm1[8], lm2[8]) < 0.08)
    return make('MEET', 0.76, ['HI', 'GREET'])

  // ── PLEASE: both flat open hands pressed together / close ──────────────────
  if (flat1 && flat2 && dist2D(lm1[9], lm2[9]) < avgPw * 2.5) {
    return make('PLEASE', 0.88, ['SORRY', 'SCHOOL', 'TOGETHER'])
  }

  // ── SCHOOL: both flat hands clapping ─────────────────────────────────────
  if (flat1 && flat2 && handsVeryClose) return make('SCHOOL', 0.75, ['CLASS', 'LEARN'])

  // ── LOVE: crossed fists on chest ─────────────────────────────────────────
  if (fist1 && fist2 && wristDist < 0.25) return make('LOVE', 0.74, ['HUG', 'CARE'])

  // ── HELP: dominant hand is fist, sitting on top of flat palm ─────────────
  const isHelp1 = curled1 && flat2 && dist2D(lm1[9], lm2[9]) < avgPw * 2.3
  const isHelp2 = curled2 && flat1 && dist2D(lm2[9], lm1[9]) < avgPw * 2.3
  if (isHelp1 || isHelp2) return make('HELP', 0.92, ['SUPPORT', 'WORK'])

  return null
}

/**
 * Hybrid ISL Fingerspelling Classifier (A-Z)
 * Hand-coded rules based on the user's specific hybrid chart.
 * Uses MediaPipe Hand landmarks (lm1 = primary/pen, lm2 = secondary/paper).
 */
export function classifyISLLetter(lm1, lm2) {
  if (!lm1 || lm1.length < 21) {
    return null;
  }

  // Determine if we have a valid second hand.
  // We check if lm2 exists and is physically separated from lm1.
  // If the wrist distance is extremely small (< 0.08), it's a double-detection/ghost hand of the same hand.
  const hasTwoHands = lm2 && lm2.length === 21 && dist2D(lm1[0], lm2[0]) > 0.08;

  // Scale-invariant palm width (Index MCP to Pinky MCP distance)
  const pw1 = dist2D(lm1[5], lm1[17]) || 0.001;
  const pw2 = hasTwoHands ? (dist2D(lm2[5], lm2[17]) || 0.001) : 0.001;

  // Helper to extract extension and curl properties for all five fingers
  const getFingerState = (h, pw) => {
    const dThumb  = dist2D(h[4], h[2]);  // thumb tip to MCP
    const dIndex  = dist2D(h[8], h[5]);  // index tip to MCP
    const dMiddle = dist2D(h[12], h[9]); // middle tip to MCP
    const dRing   = dist2D(h[16], h[13]);// ring tip to MCP
    const dPinky  = dist2D(h[20], h[17]);// pinky tip to MCP

    // Thresholds tuned precisely from photo landmark extraction values
    const extT = dThumb > pw * 0.7;
    const extI = dIndex > pw * 1.0;
    const extM = dMiddle > pw * 1.05;
    const extR = dRing > pw * 1.05;
    const extP = dPinky > pw * 1.05;

    const curlT = dThumb < pw * 0.7;
    const curlI = dIndex < pw * 1.15;
    const curlM = dMiddle < pw * 1.45; // Tuned from vertical index finger curls in D-shape
    const curlR = dRing < pw * 1.45;
    const curlP = dPinky < pw * 1.45;

    return {
      dThumb, dIndex, dMiddle, dRing, dPinky,
      extT, extI, extM, extR, extP,
      curlT, curlI, curlM, curlR, curlP
    };
  };

  const f1 = getFingerState(lm1, pw1);
  const f2 = hasTwoHands ? getFingerState(lm2, pw2) : null;

  // 1. TWO-HANDED CHECKS (A, B, D, E, F, G, H, K, M, N, P, Q, R, S, T, X, Y, Z)
  if (hasTwoHands && f2) {
    const checkTwoHanded = (h_pen, h_paper, pw_pen, pw_paper, pen, paper) => {
      // ── A: Both hands fists, thumbs pointing up and touching ──
      const aThumbClose = dist2D(h_pen[4], h_paper[4]) / Math.max(pw_pen, 0.04) < 2.5;
      const aThumbUp = (h_pen[4].y < h_pen[0].y + 0.08 || h_pen[4].y < h_pen[2].y + 0.05) &&
                       (h_paper[4].y < h_paper[0].y + 0.08 || h_paper[4].y < h_paper[2].y + 0.05);
      const aFingersCurled = (!pen.extM || pen.curlM) && (!pen.extR || pen.curlR) &&
                             (!paper.extM || paper.curlM) && (!paper.extR || paper.curlR);
      if (aThumbClose && aThumbUp && aFingersCurled) {
        return make('A', 0.98);
      }

      // ── B: Both hands form loops, loops touch ──
      const loop_pen = dist2D(h_pen[8], h_pen[4]) < pw_pen * 1.4;
      const loop_paper = dist2D(h_paper[8], h_paper[4]) < pw_paper * 1.4;
      const penOpen = dist2D(h_pen[12], h_pen[9]) > pw_pen * 0.7 && dist2D(h_pen[16], h_pen[13]) > pw_pen * 0.7;
      const paperOpen = dist2D(h_paper[12], h_paper[9]) > pw_paper * 0.7 && dist2D(h_paper[16], h_paper[13]) > pw_paper * 0.7;

      if (loop_pen && loop_paper && penOpen && paperOpen) {
        const dIndexTips = dist2D(h_pen[8], h_paper[8]);
        const dThumbTips = dist2D(h_pen[4], h_paper[4]);
        if (dIndexTips / pw_pen < 1.8 && dThumbTips / pw_pen < 1.8) {
          return make('B', 0.98);
        }
      }

      // ── D: Left index vertical, right forms loop ──
      // Top touches index-to-index, bottom touches thumb-to-index PIP/MCP
      const penFormsLoop = dist2D(h_pen[8], h_pen[4]) < pw_pen * 1.4;
      const paperPointing = dist2D(h_paper[8], h_paper[5]) > pw_paper * 0.8 &&
                            dist2D(h_paper[12], h_paper[9]) < pw_paper * 1.3 &&
                            dist2D(h_paper[16], h_paper[13]) < pw_paper * 1.3;

      if (paperPointing && penFormsLoop) {
        const dTop = Math.min(
          dist2D(h_pen[8], h_paper[8]),
          dist2D(h_pen[8], h_paper[7])
        );
        const dBottom = Math.min(
          dist2D(h_pen[4], h_paper[6]),
          dist2D(h_pen[4], h_paper[5]),
          dist2D(h_pen[4], h_paper[9])
        );
        if (dTop / pw_pen < 1.8 && dBottom / pw_pen < 1.8) {
          return make('D', 0.98);
        }
      }

      // ── E: Active index tip touches base index finger ──
      // Ensure the active hand is pointing and not forming a loop
      const penNotLoop = dist2D(h_pen[8], h_pen[4]) > pw_pen * 1.35;
      if (paper.extI && pen.extI && penNotLoop) {
        const dists = [
          dist2D(h_pen[8], h_paper[8]),
          dist2D(h_pen[8], h_paper[7]),
          dist2D(h_pen[8], h_paper[6]),
          dist2D(h_pen[8], h_paper[5])
        ];
        const minD = Math.min(...dists);
        if (minD / Math.max(pw_pen, 0.04) < 1.5) {
           return make('E', 0.98);
        }
      }

      // ── F: Both hands index and middle extended, crossing perpendicularly ──
      // Calculate individual finger lengths and crossing ratios on every frame for debugging
      const pen_I_len = dist2D(h_pen[8], h_pen[5]) / pw_pen;
      const pen_M_len = dist2D(h_pen[12], h_pen[9]) / pw_pen;
      const paper_I_len = dist2D(h_paper[8], h_paper[5]) / pw_paper;
      const paper_M_len = dist2D(h_paper[12], h_paper[9]) / pw_paper;

      const dIndex = Math.min(
        dist2D(h_pen[6], h_paper[6]),
        dist2D(h_pen[6], h_paper[7]),
        dist2D(h_pen[7], h_paper[6]),
        dist2D(h_pen[7], h_paper[7]),
        dist2D(h_pen[8], h_paper[6]),
        dist2D(h_pen[8], h_paper[7])
      );

      const dMiddle = Math.min(
        dist2D(h_pen[10], h_paper[10]),
        dist2D(h_pen[10], h_paper[11]),
        dist2D(h_pen[11], h_paper[10]),
        dist2D(h_pen[11], h_paper[11]),
        dist2D(h_pen[12], h_paper[10]),
        dist2D(h_pen[12], h_paper[11])
      );

      const ratioI = dIndex / pw_pen;
      const ratioM = dMiddle / pw_pen;

      // Always log so the signer can inspect what geometric limits are computed
      console.log(`[F Debug] pen_I:${pen_I_len.toFixed(2)}, pen_M:${pen_M_len.toFixed(2)}, paper_I:${paper_I_len.toFixed(2)}, paper_M:${paper_M_len.toFixed(2)}, ratioI:${ratioI.toFixed(2)}, ratioM:${ratioM.toFixed(2)}`);

      // Sideways-relaxed pointing finger checks (> 0.8 palm width)
      const penPointingF = pen_I_len > 0.8 && pen_M_len > 0.8;
      const paperPointingF = paper_I_len > 0.8 && paper_M_len > 0.8;
      const notBothFlat = !(paper.extR && paper.extP && pen.extR && pen.extP);

      if (penPointingF && paperPointingF && notBothFlat) {
        if (ratioI < 1.8 && ratioM < 1.8) {
          return make('F', 0.98);
        }
      }

      // ── G: Fist on fist (one fist stacked on top of the other) ──
      const paperFist = paper.curlI && paper.curlM && paper.curlR && paper.curlP;
      const penFist = pen.curlI && pen.curlM && pen.curlR && pen.curlP;
      if (paperFist && penFist) {
        const dKnuckles = dist2D(h_pen[9], h_paper[9]);
        if (dKnuckles / pw_pen < 1.8) {
          return make('G', 0.98);
        }
      }

      // ── H: Palms flat and overlap ──
      if (paper.extI && paper.extM && paper.extR && paper.extP &&
          pen.extI && pen.extM && pen.extR && pen.extP) {
        const dPalms = dist2D(h_pen[9], h_paper[9]);
        if (dPalms / pw_pen < 1.8) return make('H', 0.98);
      }

      // ── K: Right index tip touches Left index PIP/middle ──
      if (paper.extI && paper.curlM && paper.curlR && paper.curlP &&
          pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dTouch = dist2D(h_pen[8], h_paper[6]); // 6 is PIP
        if (dTouch / pw_pen < 0.6) return make('K', 0.98);
      }

      // ── M: Left hand flat palm up, Right index, middle, ring touch left palm ──
      if (paper.extI && paper.extM && paper.extR && paper.extP &&
          pen.extI && pen.extM && pen.extR && pen.curlP) {
        const dT1 = dist2D(h_pen[8], h_paper[9]);
        const dT2 = dist2D(h_pen[12], h_paper[9]);
        const dT3 = dist2D(h_pen[16], h_paper[9]);
        if (dT1 / pw_pen < 0.8 && dT2 / pw_pen < 0.8 && dT3 / pw_pen < 0.8) {
          return make('M', 0.98);
        }
      }

      // ── N: Left hand flat palm up, Right index and middle touch left palm ──
      if (paper.extI && paper.extM && paper.extR && paper.extP &&
          pen.extI && pen.extM && pen.curlR && pen.curlP) {
        const dT1 = dist2D(h_pen[8], h_paper[9]);
        const dT2 = dist2D(h_pen[12], h_paper[9]);
        if (dT1 / pw_pen < 0.8 && dT2 / pw_pen < 0.8) {
          return make('N', 0.98);
        }
      }

      // ── P: Left index pointing up, Right loop touches Left index tip ──
      if (paper.extI && paper.curlM && paper.curlR && paper.curlP) {
        const rLoop = dist2D(h_pen[8], h_pen[4]) < pw_pen * 1.25;
        if (rLoop && dist2D(h_pen[8], h_paper[8]) / pw_pen < 0.6) {
          return make('P', 0.98);
        }
      }

      // ── Q: Left loop, Right index tip sits inside left loop ──
      const lLoop = dist2D(h_paper[8], h_paper[4]) < pw_paper * 1.25;
      if (lLoop && pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dIn = dist2D(h_pen[8], h_paper[4]); // near thumb tip
        if (dIn / pw_pen < 0.7) return make('Q', 0.98);
      }

      // ── R: Left hand flat, Right index curved resting on Left palm ──
      if (paper.extI && paper.extM && paper.extR && paper.extP &&
          pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dPalm = dist2D(h_pen[8], h_paper[9]);
        if (dPalm / pw_pen < 0.6) return make('R', 0.98);
      }

      // ── S: Both fists, pinkies extended and hooked ──
      if (pen.curlI && pen.curlM && pen.curlR && pen.extP &&
          paper.curlI && paper.curlM && paper.curlR && paper.extP) {
        const dPinkies = dist2D(h_pen[20], h_paper[20]);
        if (dPinkies / pw_pen < 0.8) return make('S', 0.98);
      }

      // ── T: Left index vertically pointing, Right index horizontally touching Left tip ──
      if (paper.extI && paper.curlM && paper.curlR && paper.curlP &&
          pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dTip = dist2D(h_pen[8], h_paper[8]);
        if (dTip / pw_pen < 0.6) return make('T', 0.98);
      }

      // ── X: Crossed index fingers forming a cross ──
      if (paper.extI && paper.curlM && paper.curlR && paper.curlP &&
          pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dJoints = dist2D(h_pen[6], h_paper[6]); // PIP joints close
        const dTips = dist2D(h_pen[8], h_paper[8]);   // Tips relatively close
        if (dJoints / pw_pen < 0.8 && dTips / pw_pen < 0.8) return make('X', 0.98);
      }

      // ── Y: Left hand shaka, Right index tip touches thumb crook ──
      if (paper.extT && paper.extP && paper.curlI && paper.curlM && paper.curlR &&
          pen.extI && pen.curlM && pen.curlR && pen.curlP) {
        const dCrook = dist2D(h_pen[8], h_paper[5]); // base of index
        if (dCrook / pw_pen < 0.7) return make('Y', 0.98);
      }

      // ── Z: Palms touch perpendicularly ──
      if (paper.extI && paper.extM && paper.extR && paper.extP &&
          pen.extI && pen.extM && pen.extR && pen.extP) {
        const dPalm = dist2D(h_pen[9], h_paper[9]);
        if (dPalm / pw_pen < 0.8) return make('Z', 0.98);
      }

      return null;
    };

    const twoHandRes = checkTwoHanded(lm1, lm2, pw1, pw2, f1, f2) || 
                       checkTwoHanded(lm2, lm1, pw2, pw1, f2, f1);
    if (twoHandRes) return twoHandRes;
  }

  // 2. ONE-HANDED CHECKS (C, I, L, O, U, V, W)
  // Only evaluate one-handed gestures if only one hand is visible,
  // or if the two hands are physically far apart (not forming a two-handed sign)
  const isHandsApart = !hasTwoHands || dist2D(lm1[0], lm2[0]) > 0.35;

  if (isHandsApart) {
    const checkOneHanded = (h, pw, f) => {
      // ── C: Curved hand forming a cup ──
      const dIndexThumb = dist2D(h[8], h[4]);
      const isC = dist2D(h[8], h[5]) > pw * 0.7 &&
                  dist2D(h[12], h[9]) > pw * 0.7 &&
                  dist2D(h[16], h[13]) > pw * 0.7 &&
                  dist2D(h[20], h[17]) > pw * 0.7 &&
                  dIndexThumb >= pw * 0.9 && dIndexThumb <= pw * 2.5;
      if (isC) return make('C', 0.98);

      // ── I: Index finger pointing straight up, others curled ──
      const isI = f.extI && f.curlM && f.curlR && f.curlP && f.curlT;
      if (isI) return make('I', 0.98);

      // ── L: Thumb and index extended forming a 90-degree L shape ──
      const isL = f.extI && f.extT && f.curlM && f.curlR && f.curlP &&
                  dIndexThumb > pw * 1.4;
      if (isL) return make('L', 0.98);

      // ── O: Single hand fingers curved into circle (index & thumb touching) ──
      const isO = f.curlM && f.curlR && f.curlP && dIndexThumb < pw * 0.8;
      if (isO) return make('O', 0.98);

      // ── U: Index and pinky extended, middle and ring curled ──
      const isU = f.extI && f.extP && f.curlM && f.curlR && f.curlT;
      if (isU) return make('U', 0.98);

      // ── V: Index and middle extended, ring, pinky, thumb curled ──
      const dIndexMiddle = dist2D(h[8], h[12]);
      const isV = f.extI && f.extM && f.curlR && f.curlP && f.curlT &&
                  dIndexMiddle > pw * 0.5;
      if (isV) return make('V', 0.98);

      // ── W: Index, middle, ring extended, pinky and thumb curled ──
      const isW = f.extI && f.extM && f.extR && f.curlP && f.curlT;
      if (isW) return make('W', 0.98);

      return null;
    };

    const oneHandRes = checkOneHanded(lm1, pw1, f1) || 
                       (hasTwoHands && f2 ? checkOneHanded(lm2, pw2, f2) : null);
    if (oneHandRes) return oneHandRes;
  }

  return null;
}

