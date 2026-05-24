/**
 * Single-hand ISL alphabet geometry (runs before static letter MLP).
 */

import { dist2D, isExtended, isOTouch, thumbExtended } from './geoClassifier.js'

function make(label, confidence, alternates = []) {
  const topK = [{ label, confidence }]
  alternates.forEach((alt, i) => {
    topK.push({ label: alt, confidence: Math.max(0.05, confidence - 0.1 - i * 0.05) })
  })
  return { label, confidence, topK: topK.slice(0, 4), source: 'single_hand_letter' }
}

function fingerLen(lm, tip, mcp) {
  return dist2D(lm[tip], lm[mcp])
}

/** W — three fingers point up in frame (reverse of M). */
function threeFingersUp(lm) {
  return (
    lm[8].y < lm[6].y - 0.012 &&
    lm[12].y < lm[10].y - 0.012 &&
    lm[16].y < lm[14].y - 0.012
  )
}

/** One hand of ISL A — fist with thumb pointing up (not a C arc). */
function isAFistComponent(lm) {
  const fingersIn =
    !isExtended(lm, 8, 6, 0.04) &&
    !isExtended(lm, 12, 10, 0.04) &&
    !isExtended(lm, 16, 14, 0.04) &&
    !isExtended(lm, 20, 18, 0.04)
  const thumbUp = lm[4].y < lm[3].y - 0.006 || thumbExtended(lm)
  return fingersIn && thumbUp
}

/**
 * Hardcoded ISL O — thumb + index form a circle; middle, ring, pinky curled in.
 */
export function matchLetterO(lm) {
  if (!lm || lm.length < 21) return false

  const thumbIndex = dist2D(lm[4], lm[8])
  const fistNotO =
    !isExtended(lm, 8, 6, 0.04) &&
    dist2D(lm[8], lm[12]) < 0.105 &&
    dist2D(lm[8], lm[16]) < 0.13 &&
    thumbIndex < 0.095
  if (fistNotO) return false

  const circleTouch = thumbIndex < 0.08 || isOTouch(lm)
  if (!circleTouch) return false

  const othersCurled =
    !isExtended(lm, 12, 10, 0.042) &&
    !isExtended(lm, 16, 14, 0.042) &&
    !isExtended(lm, 20, 18, 0.042)

  const indexCurledToThumb =
    !isExtended(lm, 8, 6, 0.05) || thumbIndex < 0.085

  const notC = thumbIndex < 0.075
  const notD = !isExtended(lm, 8, 6, 0.035) || thumbIndex < 0.1

  return othersCurled && indexCurledToThumb && notC && notD
}

export function detectLetterO(lm) {
  if (!matchLetterO(lm)) return null
  return make('O', 0.96, ['0', 'C', 'D'])
}

/**
 * Hardcoded ISL U — index + pinky point up; middle, ring, thumb folded in.
 */
export function matchLetterU(lm) {
  if (!lm || lm.length < 21) return false
  if (matchLetterO(lm)) return false

  const indexUp = isExtended(lm, 8, 6, 0.014) || lm[8].y < lm[6].y - 0.01
  const pinkyUp = isExtended(lm, 20, 18, 0.014) || lm[20].y < lm[18].y - 0.01
  if (!indexUp || !pinkyUp) return false

  const middleDown = !isExtended(lm, 12, 10, 0.032)
  const ringDown = !isExtended(lm, 16, 14, 0.032)
  if (!middleDown || !ringDown) return false

  if (thumbExtended(lm) || lm[4].y < lm[3].y - 0.02) return false

  const middleTucked = lm[12].y > lm[10].y - 0.01 || dist2D(lm[12], lm[9]) < 0.08
  const ringTucked = lm[16].y > lm[14].y - 0.01 || dist2D(lm[16], lm[13]) < 0.09
  if (!middleTucked || !ringTucked) return false

  if (isExtended(lm, 12, 10, 0.025) && isExtended(lm, 16, 14, 0.025)) return false

  const indexPinkySpread = dist2D(lm[8], lm[20]) > 0.055
  const notV = !isExtended(lm, 12, 10, 0.022) || dist2D(lm[8], lm[12]) > dist2D(lm[8], lm[20]) * 0.85

  return indexPinkySpread && notV
}

export function detectLetterU(lm) {
  if (!matchLetterU(lm)) return null
  return make('U', 0.97, ['ROCK', 'Y', '6'])
}

/**
 * Hardcoded ISL C — curved C: thumb + fingers arched, tips clustered (not 3 fingers down).
 */
export function matchLetterC(lm, lm2 = null) {
  if (!lm || lm.length < 21) return false
  if (matchLetterO(lm)) return false
  if (isAFistComponent(lm)) return false
  if (lm2?.length === 21 && isAFistComponent(lm2)) return false

  const thumbIndex = dist2D(lm[4], lm[8])
  if (thumbIndex < 0.045 || thumbIndex > 0.22) return false

  const tipsClustered =
    dist2D(lm[8], lm[12]) < 0.095 &&
    dist2D(lm[12], lm[16]) < 0.1 &&
    dist2D(lm[8], lm[20]) < 0.14

  const fingersCurved =
    !isExtended(lm, 8, 6, 0.058) &&
    !isExtended(lm, 12, 10, 0.058) &&
    !isExtended(lm, 16, 14, 0.058)

  const thumbFormsC = thumbIndex > 0.06 && dist2D(lm[4], lm[5]) > 0.035

  const notThreeDown =
    !(lm[8].y >= lm[6].y && lm[12].y >= lm[10].y && lm[16].y >= lm[14].y &&
      fingerLen(lm, 8, 5) > 0.08 && fingerLen(lm, 12, 9) > 0.08 && fingerLen(lm, 16, 13) > 0.08)

  return tipsClustered && fingersCurved && thumbFormsC && notThreeDown && !threeFingersUp(lm)
}

export function detectLetterC(lm, lm2 = null) {
  if (!matchLetterC(lm, lm2)) return null
  return make('C', 0.96, ['O', 'M', 'S'])
}

/**
 * Hardcoded ISL V — reverse of N: index + middle up in a V; ring, pinky, thumb in.
 */
export function matchLetterV(lm) {
  if (!lm || lm.length < 21) return false
  if (matchLetterU(lm)) return false

  const indexUp = isExtended(lm, 8, 6, 0.018) || lm[8].y < lm[6].y - 0.008
  const middleUp = isExtended(lm, 12, 10, 0.018) || lm[12].y < lm[10].y - 0.008
  if (!indexUp || !middleUp) return false

  if (isExtended(lm, 16, 14, 0.032)) return false
  if (isExtended(lm, 20, 18, 0.032)) return false

  const vSpread = dist2D(lm[8], lm[12]) > 0.032
  if (!vSpread) return false

  const twoUp = lm[8].y < lm[6].y + 0.02 && lm[12].y < lm[10].y + 0.02
  if (!twoUp) return false

  const iLen = fingerLen(lm, 8, 5)
  const mLen = fingerLen(lm, 12, 9)
  const rLen = fingerLen(lm, 16, 13)
  const twoDown =
    lm[8].y >= lm[6].y - 0.01 &&
    lm[12].y >= lm[10].y - 0.01 &&
    rLen < iLen * 0.92
  if (twoDown) return false

  const notThreeUp = !threeFingersUp(lm)
  const notM =
    !(iLen > 0.075 && mLen > 0.075 && rLen > 0.075 && lm[16].y >= lm[14].y - 0.01)

  return notThreeUp && notM
}

export function detectLetterV(lm) {
  if (!matchLetterV(lm)) return null
  return make('V', 0.96, ['N', '2', 'U'])
}

/**
 * Hardcoded ISL M — index, middle, ring extended downward; thumb + pinky tucked.
 */
export function matchLetterM(lm) {
  if (!lm || lm.length < 21) return false
  if (matchLetterO(lm)) return false
  if (matchLetterC(lm)) return false
  if (matchLetterV(lm)) return false

  const iLen = fingerLen(lm, 8, 5)
  const mLen = fingerLen(lm, 12, 9)
  const rLen = fingerLen(lm, 16, 13)
  const pLen = fingerLen(lm, 20, 17)

  const threeLong = iLen > 0.075 && mLen > 0.075 && rLen > 0.075
  if (!threeLong) return false

  const pinkyIn = pLen < rLen * 0.9 || !isExtended(lm, 20, 18, 0.045)
  if (!pinkyIn) return false

  const thumbIn = dist2D(lm[4], lm[5]) < 0.16 || dist2D(lm[4], lm[9]) < 0.17 || !thumbExtended(lm)
  if (!thumbIn) return false

  if (threeFingersUp(lm)) return false

  const iDown = lm[8].y >= lm[6].y - 0.015
  const mDown = lm[12].y >= lm[10].y - 0.015
  const rDown = lm[16].y >= lm[14].y - 0.015
  const threeDown = iDown && mDown && rDown

  const fingersSpread =
    dist2D(lm[8], lm[12]) > 0.04 || dist2D(lm[12], lm[16]) > 0.04
  if (!fingersSpread) return false

  const notN = !(iDown && mDown && !rDown && rLen < iLen * 0.88)

  return (threeDown || threeLong) && notN
}

function detectM(lm) {
  if (matchLetterM(lm)) return make('M', 0.96, ['N', 'W'])
  return null
}

function detectC(lm) {
  return detectLetterC(lm)
}

/** D — index up; thumb + other fingers form circle at palm (not plain "1"). */
function detectO(lm) {
  return detectLetterO(lm)
}

function detectU(lm) {
  return detectLetterU(lm)
}

/** D — index up; thumb + other fingers form circle at palm (not plain "1"). */
export function matchLetterD(lm) {
  if (!lm || lm.length < 21) return false
  if (matchLetterO(lm) || matchLetterU(lm) || matchLetterC(lm)) return false

  const indexUp = isExtended(lm, 8, 6, 0.02) || lm[8].y < lm[6].y - 0.008
  if (!indexUp) return false

  const middleDown = !isExtended(lm, 12, 10, 0.015)
  const ringDown = !isExtended(lm, 16, 14, 0.015)
  const pinkyDown = !isExtended(lm, 20, 18, 0.015)
  if (!middleDown || !ringDown || !pinkyDown) return false

  const thumbMiddleRing =
    dist2D(lm[4], lm[12]) < 0.12 ||
    dist2D(lm[4], lm[16]) < 0.13 ||
    (dist2D(lm[4], lm[9]) < 0.1 && dist2D(lm[4], lm[8]) < 0.11)
  const thumbIndexO = dist2D(lm[4], lm[8]) < 0.09

  if (!thumbMiddleRing && !thumbIndexO) return false
  if (dist2D(lm[4], lm[8]) > 0.16 && thumbExtended(lm)) return false

  // Index up + fist (T upright hand) — thumb tucked, not a D circle
  if (
    dist2D(lm[4], lm[8]) > 0.11 &&
    !thumbIndexO &&
    !isExtended(lm, 12, 10, 0.015) &&
    !isExtended(lm, 16, 14, 0.015)
  ) {
    return false
  }

  return true
}

export function detectLetterD(lm) {
  if (!matchLetterD(lm)) return null
  return make('D', 0.94, ['1', 'G'])
}

function detectD(lm) {
  return detectLetterD(lm)
}

/** W — index + middle + ring up (not M). */
function detectW(lm) {
  if (!isExtended(lm, 8, 6, 0.02) || !isExtended(lm, 12, 10, 0.02) || !isExtended(lm, 16, 14, 0.02)) {
    return null
  }
  if (isExtended(lm, 20, 18, 0.02)) return null
  if (!threeFingersUp(lm)) return null
  if (thumbExtended(lm)) return null
  return make('W', 0.9, ['M', '3'])
}

function detectV(lm) {
  return detectLetterV(lm)
}

/** N — index + middle down; ring + pinky tucked. */
function detectN(lm) {
  if (matchLetterC(lm)) return null
  if (matchLetterV(lm)) return null

  const iLen = fingerLen(lm, 8, 5)
  const mLen = fingerLen(lm, 12, 9)
  const rLen = fingerLen(lm, 16, 13)

  const iDown = lm[8].y >= lm[6].y - 0.015
  const mDown = lm[12].y >= lm[10].y - 0.015
  const rUp = lm[16].y < lm[14].y - 0.01 || rLen < iLen * 0.88

  if (!iDown || !mDown || !rUp) return null
  if (matchLetterM(lm)) return null
  if (thumbExtended(lm)) return null
  return make('N', 0.92, ['M', 'H'])
}

const DETECTORS = [detectO, detectU, detectC, detectV, detectM, detectD, detectW, detectN]

/**
 * @param {Array} lm — 21 MediaPipe landmarks
 * @param {Array|null} lm2 — second hand; when present, skip C (two-hand A uses fists)
 */
export function classifySingleHandLetter(lm, lm2 = null) {
  if (!lm || lm.length < 21) return null
  const detectors =
    lm2?.length === 21 ? [detectU, detectV, detectM, detectD, detectW, detectN] : DETECTORS
  for (const fn of detectors) {
    const r = fn(lm)
    if (r) return r
  }
  return null
}
