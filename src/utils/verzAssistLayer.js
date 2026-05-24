/**
 * Post-processing assist for verZ-Plus temporal predictions.
 * Does not load, train, or modify the verZ model — only adjusts outputs
 * when geometry strongly disagrees with a low-confidence confused label.
 */

import { classifyTwoHandGesture } from './geoClassifier.js'

/** Pairs that verZ often confuses (from training hard-neg list + field reports). */
const CONFUSION_PAIRS = [
  ['BROTHER', 'SISTER'],
  ['BOY', 'GIRL'],
  ['MOTHER', 'FATHER'],
  ['DAUGHTER', 'SON'],
  ['HAPPY', 'SAD'],
  ['GOOD', 'BAD'],
  ['BIG LARGE', 'SMALL LITTLE'],
  ['HOT', 'COLD'],
  ['DAY', 'NIGHT'],
  ['MORNING', 'EVENING'],
  ['HELLO', 'GOOD MORNING'],
  ['THANK YOU', 'GOOD'],
  ['RED', 'BLUE'],
  ['MAN', 'WOMAN'],
  ['OLD', 'NEW'],
  ['RICH', 'POOR'],
  ['MONDAY', 'FRIDAY'],
  ['WINTER', 'SUMMER'],
]

const PAIR_SET = new Map()
for (const [a, b] of CONFUSION_PAIRS) {
  PAIR_SET.set(a, b)
  PAIR_SET.set(b, a)
}

function pairMate(label) {
  return PAIR_SET.get(label) || null
}

function makeResult(label, confidence, prev, source) {
  return {
    label,
    confidence,
    topK: [{ label, confidence }, ...(prev?.topK || []).filter(t => t.label !== label).slice(0, 2)],
    source,
    _verzAssist: true,
    _mlLabel: prev?.label,
    _mlConf: prev?.confidence,
  }
}

/**
 * @param {object|null} temporalResult — output from verZ temporal head
 * @param {{ rawLandmarks?, rawLandmarks2?, topK? }} ctx
 */
export function applyVerzAssist(temporalResult, ctx = {}) {
  if (!temporalResult?.label) return temporalResult

  const { rawLandmarks, rawLandmarks2 } = ctx
  const label = temporalResult.label
  const conf = temporalResult.confidence ?? 0
  const mate = pairMate(label)

  if (!mate) return temporalResult

  const topK = temporalResult.topK || []
  const runnerUp = topK.find(t => t.label === mate)
  const margin = conf - (runnerUp?.confidence ?? 0)

  // High confidence — trust verZ
  if (conf >= 0.88 && margin > 0.12) return temporalResult

  // Both hands visible: two-hand geo can break BROTHER/SISTER-style ties
  if (rawLandmarks?.length === 21 && rawLandmarks2?.length === 21) {
    const geo = classifyTwoHandGesture(rawLandmarks, rawLandmarks2)
    if (geo?.label && geo.label !== 'X' && geo.confidence >= 0.72) {
      if (geo.label === label || geo.label === mate) {
        if (geo.label !== label && conf < 0.85) {
          return makeResult(geo.label, Math.max(geo.confidence, conf + 0.05), temporalResult, 'verz_assist_geo')
        }
      }
    }
  }

  // Ambiguous pair — suppress flip-flop unless margin is clear
  if (conf < 0.62 && margin < 0.08) {
    return { ...temporalResult, rejected: true, source: 'verz_assist_hold' }
  }

  return temporalResult
}
