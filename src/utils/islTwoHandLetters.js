/**
 * ISL manual alphabet — two-handed letter geometry.
 * Runs BEFORE the static letter MLP (which often sees zeros for hand 2).
 * verZ-Plus is untouched; this only assists letter / Learn / alphabet UI.
 */

import { dist2D, isExtended, isFist, isOTouch, thumbExtended } from './geoClassifier.js'

export const TWO_HAND_LETTERS = new Set(['A', 'B', 'F', 'G', 'H', 'K', 'P', 'Q', 'T', 'X'])

function make(label, confidence, alternates = []) {
  const topK = [{ label, confidence }]
  alternates.forEach((alt, i) => {
    topK.push({ label: alt, confidence: Math.max(0.05, confidence - 0.12 - i * 0.05) })
  })
  return { label, confidence, topK: topK.slice(0, 4), source: 'two_hand_letter' }
}

/** Four fingers up — thumb may be tucked or slightly out (MediaPipe is noisy). */
function flatFourFingers(lm, thresh = 0.015) {
  return (
    isExtended(lm, 8, 6, thresh) &&
    isExtended(lm, 12, 10, thresh) &&
    isExtended(lm, 16, 14, thresh) &&
    isExtended(lm, 20, 18, thresh)
  )
}

/** Finger out from palm — works when the active hand faces the camera. */
function fingerOut(lm, tip, pip, mcp) {
  if (isExtended(lm, tip, pip, 0.022)) return true
  const reach = dist2D(lm[tip], lm[mcp])
  const pipReach = dist2D(lm[pip], lm[mcp])
  return reach > pipReach * 0.68
}

function indexMiddleOnly(lm) {
  return (
    fingerOut(lm, 8, 6, 5) &&
    fingerOut(lm, 12, 10, 9) &&
    !fingerOut(lm, 16, 14, 13) &&
    !fingerOut(lm, 20, 18, 17)
  )
}

function threeOverThumb(lm) {
  return (
    fingerOut(lm, 8, 6, 5) &&
    fingerOut(lm, 12, 10, 9) &&
    fingerOut(lm, 16, 14, 13) &&
    !fingerOut(lm, 20, 18, 17)
  )
}

function twoOverThumb(lm) {
  return (
    fingerOut(lm, 8, 6, 5) &&
    fingerOut(lm, 12, 10, 9) &&
    !fingerOut(lm, 16, 14, 13) &&
    !fingerOut(lm, 20, 18, 17)
  )
}

/** Base palm — at least 3 of 4 fingers extended (MediaPipe often misses pinky). */
function mostlyFlatPalm(lm) {
  let n = 0
  if (isExtended(lm, 8, 6, 0.012)) n++
  if (isExtended(lm, 12, 10, 0.012)) n++
  if (isExtended(lm, 16, 14, 0.012)) n++
  if (isExtended(lm, 20, 18, 0.012)) n++
  return n >= 3
}

function palmCenter(lm) {
  return {
    x: (lm[0].x + lm[5].x + lm[17].x) / 3,
    y: (lm[0].y + lm[5].y + lm[17].y) / 3,
  }
}

/** Tight fist on one hand (not thumb–index O). */
function tightFist(lm) {
  if (isHandO(lm)) return false
  if (isFist(lm)) return true
  return (
    !isExtended(lm, 8, 6, 0.04) &&
    !isExtended(lm, 12, 10, 0.04) &&
    !isExtended(lm, 16, 14, 0.04) &&
    !isExtended(lm, 20, 18, 0.04) &&
    dist2D(lm[4], lm[8]) > 0.055
  )
}

/** Four fingers curled; thumb may extend up (ISL A / G fists). */
function fourFingersCurled(lm) {
  return (
    !isExtended(lm, 8, 6, 0.045) &&
    !isExtended(lm, 12, 10, 0.045) &&
    !isExtended(lm, 16, 14, 0.045) &&
    !isExtended(lm, 20, 18, 0.045)
  )
}

/**
 * Hardcoded ISL A — both fists (4 fingers in), thumb tips touching.
 * Thumbs are allowed to point up; only fingertips must not form an O (B).
 */
export function matchLetterA(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false
  if (!fourFingersCurled(lm1) || !fourFingersCurled(lm2)) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.04 || wristDist > 0.55) return false

  const thumbsTouch =
    dist2D(lm1[4], lm2[4]) < 0.18 ||
    dist2D(lm1[3], lm2[3]) < 0.16 ||
    dist2D(lm1[4], lm2[3]) < 0.16 ||
    dist2D(lm2[4], lm1[3]) < 0.16
  if (!thumbsTouch) return false

  const thumbUp =
    lm1[4].y < lm1[3].y + 0.015 ||
    lm2[4].y < lm2[3].y + 0.015 ||
    thumbExtended(lm1) ||
    thumbExtended(lm2)
  if (!thumbUp) return false

  const indexTipsApart = dist2D(lm1[8], lm2[8]) > 0.04
  if (!indexTipsApart) return false

  const notDoubleO =
    dist2D(lm1[4], lm2[8]) > 0.1 && dist2D(lm2[4], lm1[8]) > 0.1
  return notDoubleO
}

/** A — both hands tight fist, thumb tips touching. */
function tryLetterA(lm1, lm2) {
  if (!matchLetterA(lm1, lm2)) return null
  return make('A', 0.96, ['S', 'T', 'B'])
}

export function detectLetterA(lm1, lm2) {
  return tryLetterA(lm1, lm2)
}

/** Closed fist on one hand (curled pack — thumb may touch index when folded). */
function closedFist(lm) {
  if (!fourFingersCurled(lm)) return false
  if (isFist(lm)) return true
  const tipsPacked =
    dist2D(lm[8], lm[12]) < 0.13 &&
    dist2D(lm[12], lm[16]) < 0.14 &&
    dist2D(lm[8], lm[20]) < 0.2
  return tipsPacked
}

/**
 * Extract wrist-centered landmarks for stacked-fist G (top hand first, 126 floats).
 * Same layout as static MLP: 21×(x,y,z) top + 21×(x,y,z) bottom, normalized to wrist gap.
 */
export function extractStackedFistLandmarks(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return null

  const top = lm1[0].y <= lm2[0].y ? lm1 : lm2
  const bottom = top === lm1 ? lm2 : lm1
  const mx = (top[0].x + bottom[0].x) / 2
  const my = (top[0].y + bottom[0].y) / 2
  const scale = Math.max(dist2D(top[0], bottom[0]), 0.06)

  const pack = (lm) =>
    lm.flatMap((p) => [
      (p.x - mx) / scale,
      (p.y - my) / scale,
      ((p.z ?? 0) - (top[0].z ?? 0)) / scale,
    ])

  return {
    top: pack(top),
    bottom: pack(bottom),
    combined: [...pack(top), ...pack(bottom)],
    scale,
    center: { x: mx, y: my },
  }
}

/**
 * ISL B — two fists / O-shapes side by side, knuckles touching (not stacked like G).
 */
export function matchLetterBSideBySide(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.04 || wristDist > 0.52) return false

  const levelWrists = Math.abs(lm1[0].y - lm2[0].y) < 0.058
  const levelKnuckles = Math.abs(lm1[9].y - lm2[9].y) < 0.065
  if (!levelWrists || !levelKnuckles) return false

  if (Math.abs(lm1[9].y - lm2[9].y) > 0.04) return false

  const handsTouch =
    dist2D(lm1[8], lm2[8]) < 0.17 ||
    dist2D(lm1[9], lm2[9]) < 0.18 ||
    dist2D(lm1[5], lm2[5]) < 0.2 ||
    dist2D(lm1[4], lm2[4]) < 0.19 ||
    dist2D(lm1[8], lm2[5]) < 0.2 ||
    dist2D(lm2[8], lm1[5]) < 0.2

  if (!handsTouch) return false

  const bothFists = closedFist(lm1) && closedFist(lm2)
  const bothO = isHandO(lm1) && isHandO(lm2)
  return bothFists || bothO
}

export function detectLetterB(lm1, lm2) {
  if (matchLetterBSideBySide(lm1, lm2)) {
    return make('B', 0.97, ['G', 'O'])
  }
  const bO = tryLetterBDoubleO(lm1, lm2)
  if (bO) return bO
  return tryLetterBFlatPalm(lm1, lm2)
}

/**
 * Hardcoded ISL G — top fist stacked on bottom fist (matches overlay in training pose).
 */
export function matchLetterG(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false
  if (matchLetterBSideBySide(lm1, lm2)) return false
  if (!closedFist(lm1) || !closedFist(lm2)) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.02 || wristDist > 0.58) return false

  const top = lm1[0].y <= lm2[0].y ? lm1 : lm2
  const bottom = top === lm1 ? lm2 : lm1

  const vertSep = bottom[9].y - top[9].y
  if (vertSep < 0.04) return false

  const fistsOverlap =
    dist2D(top[9], bottom[9]) < 0.5 ||
    dist2D(top[5], bottom[5]) < 0.52 ||
    dist2D(top[0], bottom[0]) < 0.48 ||
    dist2D(top[9], bottom[5]) < 0.5 ||
    dist2D(top[5], bottom[9]) < 0.5 ||
    dist2D(top[0], bottom[9]) < 0.48 ||
    dist2D(top[9], bottom[0]) < 0.48 ||
    dist2D(top[8], bottom[9]) < 0.48 ||
    dist2D(top[9], bottom[8]) < 0.48

  if (!fistsOverlap) return false

  const sameHeight = Math.abs(lm1[0].y - lm2[0].y) < 0.045
  const thumbsTouchSide = dist2D(lm1[4], lm2[4]) < 0.15
  if (sameHeight && thumbsTouchSide && matchLetterA(lm1, lm2)) return false

  return true
}

export function detectLetterG(lm1, lm2) {
  if (!matchLetterG(lm1, lm2)) return null
  return make('G', 0.98, ['A', '0', 'B'])
}

/** B — two "O" circles (thumb+index) touching side by side (ISL fingerspelling). */
function isHandO(lm) {
  const oCircle = isOTouch(lm) || dist2D(lm[4], lm[8]) < 0.11
  return (
    oCircle &&
    !isExtended(lm, 12, 10, 0.015) &&
    !isExtended(lm, 16, 14, 0.015) &&
    !isExtended(lm, 20, 18, 0.015)
  )
}

function tryLetterBDoubleO(lm1, lm2) {
  if (!isHandO(lm1) || !isHandO(lm2)) return null

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.06 || wristDist > 0.5) return null

  const top = lm1[0].y < lm2[0].y ? lm1 : lm2
  const bottom = top === lm1 ? lm2 : lm1
  if (bottom[9].y - top[9].y > 0.035) return null

  const circlesTouch =
    dist2D(lm1[4], lm2[4]) < 0.16 ||
    dist2D(lm1[8], lm2[8]) < 0.15 ||
    dist2D(lm1[4], lm2[8]) < 0.14 ||
    dist2D(lm2[4], lm1[8]) < 0.14 ||
    dist2D(lm1[8], lm2[5]) < 0.18 ||
    dist2D(lm2[8], lm1[5]) < 0.18

  if (circlesTouch) {
    return make('B', 0.93, ['O', 'T'])
  }
  return null
}

/** Index out; other fingers mostly tucked (lenient for T / X). */
function indexOnlyExtended(lm) {
  const indexOut = isExtended(lm, 8, 6, 0.012) || dist2D(lm[8], lm[5]) > 0.09
  const othersIn =
    !isExtended(lm, 12, 10, 0.045) &&
    !isExtended(lm, 16, 14, 0.045) &&
    !isExtended(lm, 20, 18, 0.045)
  return indexOut && othersIn
}

function indexUpright(lm) {
  if (!indexOnlyExtended(lm)) return false
  return lm[8].y < lm[6].y - 0.006
}

function indexSideways(lm) {
  if (!indexOnlyExtended(lm)) return false
  const dx = Math.abs(lm[8].x - lm[6].x)
  const dy = Math.abs(lm[8].y - lm[6].y)
  return dx > dy * 0.55 || (Math.abs(lm[8].y - lm[6].y) < 0.03 && dx > 0.04)
}

/** Index + middle up together (ISL F upright hand — not a spread V). */
function indexMiddleTogetherUp(lm) {
  const indexUp = isExtended(lm, 8, 6, 0.012) || lm[8].y < lm[6].y - 0.008
  const middleUp = isExtended(lm, 12, 10, 0.012) || lm[12].y < lm[10].y - 0.008
  if (!indexUp || !middleUp) return false

  if (isExtended(lm, 16, 14, 0.038)) return false
  if (isExtended(lm, 20, 18, 0.038)) return false

  const fingersTogether = dist2D(lm[8], lm[12]) < 0.058
  return fingersTogether
}

function indexDirection(lm) {
  const dx = lm[8].x - lm[6].x
  const dy = lm[8].y - lm[6].y
  const m = Math.hypot(dx, dy) || 1e-6
  return { x: dx / m, y: dy / m }
}

/**
 * Hardcoded ISL X — two index fingers crossed (tips or middle joints overlap).
 */
export function matchLetterX(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false
  if (!indexOnlyExtended(lm1) || !indexOnlyExtended(lm2)) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.04 || wristDist > 0.55) return false

  const tipDist = dist2D(lm1[8], lm2[8])

  const cross =
    tipDist < 0.18 ||
    dist2D(lm1[8], lm2[6]) < 0.15 ||
    dist2D(lm1[8], lm2[7]) < 0.15 ||
    dist2D(lm2[8], lm1[6]) < 0.15 ||
    dist2D(lm2[8], lm1[7]) < 0.15 ||
    dist2D(lm1[8], lm2[5]) < 0.16 ||
    dist2D(lm2[8], lm1[5]) < 0.16

  if (!cross) return false

  const d1 = indexDirection(lm1)
  const d2 = indexDirection(lm2)
  const absDot = Math.abs(d1.x * d2.x + d1.y * d2.y)
  if (absDot > 0.72) return false

  const shaftCross =
    dist2D(lm1[8], lm2[6]) < 0.14 ||
    dist2D(lm2[8], lm1[6]) < 0.14 ||
    dist2D(lm1[8], lm2[7]) < 0.14 ||
    dist2D(lm2[8], lm1[7]) < 0.14

  if (shaftCross) return true
  if (tipDist < 0.17 && absDot < 0.55) return true
  return tipDist < 0.2 && absDot < 0.65
}

export function detectLetterX(lm1, lm2) {
  if (!matchLetterX(lm1, lm2)) return null
  return make('X', 0.96, ['T', 'K', 'H'])
}

/**
 * Hardcoded ISL F — index+middle up on one hand; other index crosses them horizontally.
 */
export function matchLetterF(lm1, lm2) {
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.05 || wristDist > 0.58) return false

  for (const [upright, sideways] of [
    [lm1, lm2],
    [lm2, lm1],
  ]) {
    if (!indexMiddleTogetherUp(upright)) continue
    if (!indexOnlyExtended(sideways)) continue
    if (!indexSideways(sideways)) continue
    if (isExtended(sideways, 12, 10, 0.032)) continue

    const crossBar =
      dist2D(sideways[8], upright[8]) < 0.16 ||
      dist2D(sideways[8], upright[12]) < 0.16 ||
      dist2D(sideways[8], upright[7]) < 0.14 ||
      dist2D(sideways[8], upright[11]) < 0.14 ||
      dist2D(sideways[8], upright[6]) < 0.17 ||
      dist2D(sideways[8], upright[10]) < 0.17

    const atForkHeight =
      sideways[8].y <= upright[12].y + 0.06 &&
      sideways[8].y >= upright[8].y - 0.1

    if (crossBar && atForkHeight) return true
  }
  return false
}

export function detectLetterF(lm1, lm2) {
  if (!matchLetterF(lm1, lm2)) return null
  return make('F', 0.97, ['N', 'T', 'V'])
}

/**
 * Hardcoded ISL T — sideways index resting on an upright index (T-bar).
 */
export function matchLetterT(lm1, lm2) {
  if (matchLetterF(lm1, lm2)) return false
  if (!lm1 || !lm2 || lm1.length < 21 || lm2.length < 21) return false

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.05 || wristDist > 0.58) return false

  for (const [upright, sideways] of [
    [lm1, lm2],
    [lm2, lm1],
  ]) {
    if (indexMiddleTogetherUp(upright)) continue
    if (!indexOnlyExtended(upright) || !indexOnlyExtended(sideways)) continue
    if (!indexUpright(upright)) continue
    if (!indexSideways(sideways)) continue

    const barOnShaft =
      dist2D(sideways[8], upright[6]) < 0.15 ||
      dist2D(sideways[8], upright[7]) < 0.14 ||
      dist2D(sideways[8], upright[5]) < 0.16
    const tipTouch =
      dist2D(sideways[8], upright[8]) < 0.15 ||
      dist2D(sideways[8], upright[7]) < 0.13
    const barNearUpright =
      barOnShaft ||
      tipTouch ||
      dist2D(sideways[8], upright[0]) < 0.22
    const barOnTop = sideways[8].y <= upright[6].y + 0.04

    if (barNearUpright && barOnTop) return true
  }
  return false
}

export function detectLetterT(lm1, lm2) {
  if (!matchLetterT(lm1, lm2)) return null
  return make('T', 0.96, ['X', 'L', '1'])
}

/** B — flat hand resting on flat palm (alternate ISL teaching shape). */
function tryLetterBFlatPalm(lm1, lm2) {
  const flat1 = flatFourFingers(lm1)
  const flat2 = flatFourFingers(lm2)
  if (!flat1 || !flat2) return null

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.035 || wristDist > 0.48) return null

  const palmsAligned = Math.abs(lm1[0].y - lm2[0].y) < 0.14
  const stacked =
    dist2D(lm1[9], lm2[5]) < 0.22 ||
    dist2D(lm2[9], lm1[5]) < 0.22 ||
    dist2D(lm1[8], lm2[9]) < 0.24 ||
    dist2D(lm2[8], lm1[9]) < 0.24 ||
    wristDist < 0.34

  if (palmsAligned && stacked) {
    return make('B', 0.88, ['4', 'W'])
  }
  return null
}

/**
 * @param {Array} lm1
 * @param {Array} lm2
 * @returns {{ label, confidence, topK, source } | null}
 */
export function classifyTwoHandLetter(lm1, lm2) {
  if (!lm1 || lm1.length < 21 || !lm2 || lm2.length < 21) return null

  const b = detectLetterB(lm1, lm2)
  if (b) return b

  const g = detectLetterG(lm1, lm2)
  if (g) return g

  const f = detectLetterF(lm1, lm2)
  if (f) return f

  const t = detectLetterT(lm1, lm2)
  if (t) return t

  const x = detectLetterX(lm1, lm2)
  if (x) return x

  const a = tryLetterA(lm1, lm2)
  if (a) return a

  const wristDist = dist2D(lm1[0], lm2[0])
  if (wristDist < 0.03 || wristDist > 0.58) return null

  const { base, active } = pickRoles(lm1, lm2)
  const baseFlat = flatFourFingers(base) || mostlyFlatPalm(base)
  const activeOnBase = dist2D(active[0], base[0]) < 0.42

  if (!activeOnBase) return null

  if (!baseFlat) {
    return null
  }

  const touchBase =
    dist2D(active[8], base[9]) < 0.18 ||
    dist2D(active[8], palmCenter(base)) < 0.16

  if (indexMiddleOnly(active) && touchBase) {
    return make('H', 0.84, ['V', 'K'])
  }

  if (twoOverThumb(active) && touchBase) {
    const nearThumb =
      dist2D(active[8], base[4]) < 0.2 ||
      dist2D(active[12], base[4]) < 0.2 ||
      dist2D(active[8], base[9]) < 0.2
    if (nearThumb) return make('N', 0.86, ['M', 'T'])
  }

  if (threeOverThumb(active) && touchBase) {
    const nearThumb =
      dist2D(active[12], base[4]) < 0.22 ||
      dist2D(active[16], base[4]) < 0.22 ||
      dist2D(active[8], base[9]) < 0.22
    if (nearThumb) return make('M', 0.86, ['N', 'E'])
  }

  if (indexMiddleOnly(active)) {
    const thumbNear =
      dist2D(base[4], active[9]) < 0.14 || dist2D(base[4], active[5]) < 0.14
    if (thumbNear) return make('K', 0.81, ['H', 'P'])
  }

  if (indexMiddleOnly(active) && active[0].y > base[0].y + 0.04) {
    return make('P', 0.78, ['K', 'Q'])
  }

  if (isExtended(active, 8, 6) && !isExtended(active, 12, 10) && active[8].y > base[9].y) {
    return make('Q', 0.76, ['G', 'P'])
  }

  return null
}

function pickRoles(lm1, lm2) {
  const flat1 = flatFourFingers(lm1) || mostlyFlatPalm(lm1)
  const flat2 = flatFourFingers(lm2) || mostlyFlatPalm(lm2)
  if (flat1 && !flat2) return { base: lm1, active: lm2 }
  if (flat2 && !flat1) return { base: lm2, active: lm1 }
  const c1 = palmCenter(lm1)
  const c2 = palmCenter(lm2)
  if (c1.y > c2.y + 0.02) return { base: lm1, active: lm2 }
  if (c2.y > c1.y + 0.02) return { base: lm2, active: lm1 }
  return { base: lm1, active: lm2 }
}
