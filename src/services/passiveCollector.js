/**
 * Stage 7 — log uncertain predictions for overnight clustering (privacy-gated).
 */
const STORAGE_KEY = 'lxi_passive_uncertain'
const MAX_EVENTS = 500

export function recordUncertainEvent(event) {
  try {
    const settings = JSON.parse(localStorage.getItem('lxi_settings') || '{}')
    if (settings.disableAnalytics || settings.privacyMode) return

    const queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    queue.unshift({
      ...event,
      ts: new Date().toISOString(),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(0, MAX_EVENTS)))
  } catch (_) {}
}

export function exportUncertainEvents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
}
