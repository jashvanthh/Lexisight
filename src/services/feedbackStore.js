/**
 * User feedback + runtime correction hints.
 * Local cache (offline) + Convex sync via useFeedbackConvex.
 */

const FEEDBACK_KEY = 'lxi_feedback'
const OVERRIDES_KEY = 'lxi_runtime_overrides'
const MAX_EVENTS = 2000
const OVERRIDE_MIN_VOTES = 2

/** In-memory overrides loaded from Convex (useFeedbackConvex). */
let remoteOverridesCache = []

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[feedbackStore] save failed', e)
  }
}

export function setRemoteOverrides(list) {
  remoteOverridesCache = Array.isArray(list) ? list : []
}

function mergeOverrides() {
  const local = readJson(OVERRIDES_KEY, [])
  const byKey = new Map()

  for (const o of local) {
    byKey.set(o.key, { ...o })
  }
  for (const o of remoteOverridesCache) {
    const prev = byKey.get(o.key)
    if (!prev || o.votes >= prev.votes) {
      byKey.set(o.key, { ...o })
    } else {
      byKey.set(o.key, {
        ...prev,
        votes: Math.max(prev.votes, o.votes),
      })
    }
  }

  return Array.from(byKey.values())
}

/**
 * Local-only save (always runs; Convex called from hook).
 */
export function recordFeedbackLocal(entry) {
  const queue = readJson(FEEDBACK_KEY, [])
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    predicted: entry.predicted,
    isCorrect: !!entry.isCorrect,
    correctLabel: entry.correctLabel || null,
    mode: entry.mode || 'word',
    confidence: entry.confidence ?? null,
    topK: entry.topK?.slice(0, 4) || [],
    ts: new Date().toISOString(),
  }
  queue.unshift(row)
  writeJson(FEEDBACK_KEY, queue.slice(0, MAX_EVENTS))

  if (!entry.isCorrect && entry.correctLabel && entry.correctLabel !== entry.predicted) {
    upsertOverrideLocal(entry.predicted, entry.correctLabel, entry.mode || 'word')
  }

  return row
}

/** @deprecated Use useFeedbackConvex().recordFeedback */
export function recordFeedback(entry) {
  return recordFeedbackLocal(entry)
}

function upsertOverrideLocal(predicted, correctLabel, mode) {
  const list = readJson(OVERRIDES_KEY, [])
  const key = `${mode}:${predicted}->${correctLabel}`
  const existing = list.find((o) => o.key === key)
  if (existing) {
    existing.votes += 1
    existing.updatedAt = new Date().toISOString()
  } else {
    list.push({
      key,
      predicted,
      correctLabel,
      mode,
      votes: 1,
      updatedAt: new Date().toISOString(),
    })
  }
  writeJson(OVERRIDES_KEY, list)
}

export function getFeedbackEvents() {
  return readJson(FEEDBACK_KEY, [])
}

export function getRuntimeOverrides() {
  return mergeOverrides()
}

/**
 * If users often mark a prediction wrong, prefer the corrected label at runtime.
 */
export function applyRuntimeCorrection(result, mode = 'word') {
  if (!result?.label) return result

  const list = getRuntimeOverrides().filter(
    (o) => o.mode === mode && o.predicted === result.label && o.votes >= OVERRIDE_MIN_VOTES,
  )
  if (!list.length) return result

  list.sort((a, b) => b.votes - a.votes)
  const best = list[0]

  return {
    ...result,
    label: best.correctLabel,
    confidence: Math.max(result.confidence ?? 0, 0.88),
    source: result.source ? `${result.source}+feedback` : 'feedback_override',
    _feedbackFrom: result.label,
  }
}

export function getFeedbackStats() {
  const events = getFeedbackEvents()
  const total = events.length
  const correct = events.filter((e) => e.isCorrect).length
  return { total, correct, incorrect: total - correct }
}
